using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace RustFix;

internal sealed record BuildDetails(int Build, int Ubr, string Version)
{
    public string Full => $"{Build}.{Ubr}";
}

internal sealed record ScanResult(BuildDetails? Build, IReadOnlyList<UpdateItem> Updates, string? Warning);

internal readonly record struct CommandResult(int ExitCode, string Output, string Error);

internal static class CommandRunner
{
    public static async Task<CommandResult> RunAsync(string file, IEnumerable<string> args, TimeSpan timeout)
    {
        var info = new ProcessStartInfo(file)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var arg in args) info.ArgumentList.Add(arg);

        using var process = new Process { StartInfo = info };
        if (!process.Start()) throw new InvalidOperationException($"Не удалось запустить {file}.");

        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();
        using var limit = new CancellationTokenSource(timeout);
        try
        {
            await process.WaitForExitAsync(limit.Token);
        }
        catch (OperationCanceledException)
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            throw new TimeoutException($"Время ожидания {Path.GetFileName(file)} истекло.");
        }

        return new CommandResult(process.ExitCode, await output, await error);
    }

    public static Task<CommandResult> PowerShellAsync(string script, TimeSpan timeout)
    {
        var exe = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),
            "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
        var encoded = Convert.ToBase64String(Encoding.Unicode.GetBytes(script));
        return RunAsync(exe, new[] { "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded }, timeout);
    }
}

internal static class WindowsUpdateService
{
    // Get-HotFix is not a complete list. CBS exposes additional package identities,
    // including rollups without a KB number in the normal update history.
    private const string ScanScript = """
        $ErrorActionPreference = 'Stop'
        $packages = @()
        $hotfixes = @()
        $cbsError = ''
        $hotfixError = ''
        try {
          $packages = @(Get-WindowsPackage -Online -ErrorAction Stop | Where-Object { $_.PackageState -eq 'Installed' } | ForEach-Object {
            $date = ''
            if ($_.InstallTime) { try { $date = ([datetime]$_.InstallTime).ToString('yyyy-MM-dd') } catch {} }
            [pscustomobject]@{ name = [string]$_.PackageName; type = [string]$_.ReleaseType; date = $date }
          })
        } catch { $cbsError = $_.Exception.Message }
        try {
          $hotfixes = @(Get-HotFix -ErrorAction Stop | Where-Object { $_.HotFixID -match '^KB\d+$' } | ForEach-Object {
            $date = ''
            if ($_.InstalledOn) { try { $date = ([datetime]$_.InstalledOn).ToString('yyyy-MM-dd') } catch {} }
            [pscustomobject]@{ kb = [string]$_.HotFixID; title = [string]$_.Description; date = $date }
          })
        } catch { $hotfixError = $_.Exception.Message }
        $data = @{ packages = $packages; hotfixes = $hotfixes; cbsError = $cbsError; hotfixError = $hotfixError } | ConvertTo-Json -Compress -Depth 5
        [Console]::Out.WriteLine('RUSTFIX_JSON:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($data)))
        """;

    private static readonly Regex KbPattern = new(@"KB\d{5,9}", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static async Task<ScanResult> ScanAsync()
    {
        BuildDetails? build = null;
        var warnings = new List<string>();
        try
        {
            using var key = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64)
                .OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
                ?? throw new InvalidOperationException("Раздел CurrentVersion не найден.");

            var rawBuild = key.GetValue("CurrentBuildNumber")?.ToString()
                ?? key.GetValue("CurrentBuild")?.ToString();
            if (!int.TryParse(rawBuild, out var major) ||
                !int.TryParse(key.GetValue("UBR")?.ToString(), out var ubr))
                throw new InvalidOperationException("CurrentBuild/UBR отсутствует или повреждён.");

            build = new BuildDetails(major, ubr, key.GetValue("DisplayVersion")?.ToString() ?? "неизвестно");
        }
        catch (Exception ex) { warnings.Add("Версия Windows: " + ex.Message); }

        var updates = new List<UpdateItem>();
        try
        {
            var result = await CommandRunner.PowerShellAsync(ScanScript, TimeSpan.FromMinutes(5));
            if (result.ExitCode != 0) throw new InvalidOperationException(result.Error.Trim());

            var marker = result.Output.Split('\n')
                .Select(s => s.Trim())
                .LastOrDefault(s => s.StartsWith("RUSTFIX_JSON:", StringComparison.Ordinal));
            if (marker == null) throw new InvalidOperationException("PowerShell не вернул список пакетов.");

            var json = Encoding.UTF8.GetString(Convert.FromBase64String(marker["RUSTFIX_JSON:".Length..]));
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            var cbsError = Value(root, "cbsError");
            var hotfixError = Value(root, "hotfixError");
            if (cbsError.Length > 0) warnings.Add("CBS: " + cbsError);
            if (hotfixError.Length > 0) warnings.Add("Get-HotFix: " + hotfixError);

            var hotfixes = new Dictionary<string, (string Title, string Date)>(StringComparer.OrdinalIgnoreCase);
            foreach (var hf in root.GetProperty("hotfixes").EnumerateArray())
            {
                var kb = Value(hf, "kb");
                if (KbPattern.IsMatch(kb)) hotfixes[kb] = (Value(hf, "title"), Value(hf, "date"));
            }

            var coveredKbs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var pkg in root.GetProperty("packages").EnumerateArray())
            {
                var name = Value(pkg, "name");
                var type = Value(pkg, "type");
                if (name.Length == 0 ||
                    !name.Contains("Package_for_", StringComparison.OrdinalIgnoreCase) &&
                    !type.Contains("Update", StringComparison.OrdinalIgnoreCase) &&
                    !type.Contains("Hotfix", StringComparison.OrdinalIgnoreCase)) continue;

                var kbMatch = KbPattern.Match(name);
                var kb = kbMatch.Success ? kbMatch.Value.ToUpperInvariant() : "—";
                var inHotfix = kbMatch.Success && hotfixes.ContainsKey(kb);
                if (inHotfix) coveredKbs.Add(kb);

                // Only rollups/KB updates are selectable. Foundational/SSU packages
                // are shown for transparency but Windows does not support removing them.
                var candidate = (name.StartsWith("Package_for_RollupFix", StringComparison.OrdinalIgnoreCase) ||
                                 name.StartsWith("Package_for_KB", StringComparison.OrdinalIgnoreCase)) &&
                                !name.Contains("ServicingStack", StringComparison.OrdinalIgnoreCase) &&
                                !name.Contains("Foundation", StringComparison.OrdinalIgnoreCase) &&
                                !name.Contains("SSU", StringComparison.OrdinalIgnoreCase);

                updates.Add(new UpdateItem
                {
                    KbNumber = kb,
                    Title = inHotfix ? hotfixes[kb].Title + " · " + name : name,
                    PackageType = inHotfix ? "CBS + KB" : "CBS (скрыт от HotFix)",
                    InstallDate = Value(pkg, "date"),
                    PackageIdentity = name,
                    CanAttemptRemove = candidate,
                    RemoveHint = candidate ? "Можно попробовать снять" : "Системный / защищён"
                });
            }

            foreach (var (kb, hf) in hotfixes)
            {
                if (coveredKbs.Contains(kb)) continue;
                updates.Add(new UpdateItem
                {
                    KbNumber = kb,
                    Title = hf.Title.Length == 0 ? "Обновление Windows" : hf.Title,
                    PackageType = "KB (HotFix)",
                    InstallDate = hf.Date,
                    CanAttemptRemove = true,
                    RemoveHint = "Можно попробовать снять"
                });
            }
        }
        catch (Exception ex) { warnings.Add("Список обновлений: " + ex.Message); }

        return new ScanResult(build,
            updates.OrderByDescending(u => u.InstallDate).ThenBy(u => u.KbNumber).ToList(),
            warnings.Count == 0 ? null : string.Join("\n", warnings));
    }

    private static string Value(JsonElement item, string property) =>
        item.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? "" : "";

    public static async Task<CommandResult> RemoveAsync(UpdateItem item)
    {
        var dism = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "System32", "dism.exe");
        CommandResult? first = null;
        if (item.PackageIdentity.Length > 0)
        {
            first = await CommandRunner.RunAsync(dism,
                new[] { "/Online", "/Remove-Package", "/PackageName:" + item.PackageIdentity, "/NoRestart", "/English" },
                TimeSpan.FromMinutes(15));
            if (first.Value.ExitCode is 0 or 3010 or 1641) return first.Value;
        }

        if (!KbPattern.IsMatch(item.KbNumber))
            return first ?? new CommandResult(-1, "", "Нет KB и точного CBS PackageName.");

        var wusa = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "System32", "wusa.exe");
        var digits = item.KbNumber[2..];
        var second = await CommandRunner.RunAsync(wusa,
            new[] { "/uninstall", "/kb:" + digits, "/quiet", "/norestart" },
            TimeSpan.FromMinutes(15));
        return second.ExitCode is 0 or 3010 or 1641 ? second :
            new CommandResult(second.ExitCode, second.Output,
                (first?.Error ?? "") + "\n" + second.Error);
    }
}