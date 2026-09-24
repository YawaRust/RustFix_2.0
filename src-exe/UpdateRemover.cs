using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace RustFix
{
    /// <summary>Итог снятия одного обновления.</summary>
    public sealed record UpdateResult(string Kb, bool Success, bool NeedsReboot, string Method, string Check);

    /// <summary>Состояние пакета после независимой проверки.</summary>
    public enum VerifyState
    {
        Removed,
        Pending,
        Installed,
        Unknown
    }

    /// <summary>
    /// Движок снятия обновлений. Работает адресно: каждая команда относится
    /// только к одному KB, поэтому остальные обновления не затрагиваются.
    ///
    /// Уровни:
    ///   1. DISM /Online /Remove-Package /PackageName:&lt;точное имя&gt; /NoRestart
    ///   2. wusa.exe /uninstall /kb:&lt;номер&gt; /quiet /norestart
    ///   3. Принудительно: остановка служб обслуживания, получение владения
    ///      файлами пакета в %windir%\servicing\Packages и их удаление.
    ///      Это единственный способ снять KB, который Windows помечает как
    ///      неудаляемый после объединения контрольных точек SSU/LCU.
    /// </summary>
    public static class UpdateRemover
    {
        private static readonly string[] UpdateServices =
        {
            "wuauserv", "bits", "cryptsvc", "msiserver", "TrustedInstaller", "DoSvc", "UsoSvc"
        };

        private static string WindowsDir =>
            Environment.GetFolderPath(Environment.SpecialFolder.Windows);

        private static string ServicingPackagesDir => Path.Combine(WindowsDir, "servicing", "Packages");

        private static string BackupDir =>
            Path.Combine(Path.GetTempPath(), "RustFix", "servicing-backup");

        /* ───────────────────────── службы ───────────────────────── */

        public static void StopUpdateServices()
        {
            foreach (string service in UpdateServices)
                RunCode("net.exe", "stop", service, "/y");
        }

        public static void StartUpdateServices()
        {
            foreach (string service in new[] { "TrustedInstaller", "wuauserv", "bits", "cryptsvc", "UsoSvc" })
                RunCode("net.exe", "start", service);
        }

        /* ───────────────────────── обслуживание ───────────────────────── */

        public static bool CreateRestorePoint()
        {
            try
            {
                string output = Run("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
                    "try { Checkpoint-Computer -Description 'RustFix before KB removal' -RestorePointType MODIFY_SETTINGS -ErrorAction Stop; 'OK' } catch { 'FAIL' }");
                return output.Contains("OK", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        /// <summary>Снимок всех установленных KB: пакеты CBS и записи HotFix.</summary>
        public static HashSet<string> Snapshot()
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                const string command =
                    "$p=@(); try { $p=Get-WindowsPackage -Online | Where-Object {$_.PackageState -eq 'Installed'} | ForEach-Object {$_.PackageName} } catch {}; " +
                    "$h=@(); try { $h=Get-HotFix | ForEach-Object {$_.HotFixID} } catch {}; " +
                    "((@($p)+@($h)) -join [Environment]::NewLine)";

                foreach (Match match in Regex.Matches(Run("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command),
                             @"KB(\d{5,9})", RegexOptions.IgnoreCase))
                    set.Add(match.Groups[1].Value);
            }
            catch { }
            return set;
        }

        /// <summary>KB → точное имя пакета CBS.</summary>
        public static Dictionary<string, string> MapKbToPackage()
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                const string command =
                    "Get-WindowsPackage -Online | Where-Object {$_.PackageState -eq 'Installed'} | Select-Object -ExpandProperty PackageName";
                string output = Run("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command);

                foreach (string line in output.Split('\n'))
                {
                    string name = line.Trim();
                    if (name.Length == 0) continue;
                    var match = Regex.Match(name, @"KB(\d{5,9})", RegexOptions.IgnoreCase);
                    if (match.Success) map.TryAdd(match.Groups[1].Value, name);
                }
            }
            catch { }
            return map;
        }

        public static bool CleanDownloadCache()
        {
            bool touched = false;
            try
            {
                string download = Path.Combine(WindowsDir, "SoftwareDistribution", "Download");
                if (!Directory.Exists(download)) return false;

                foreach (string path in Directory.EnumerateFileSystemEntries(download))
                {
                    try
                    {
                        if (Directory.Exists(path)) Directory.Delete(path, true);
                        else File.Delete(path);
                        touched = true;
                    }
                    catch { }
                }
            }
            catch { }
            return touched;
        }

        /* ───────────────────────── снятие ───────────────────────── */

        public static UpdateResult Remove(string kbNumber, string knownPackage, bool allowForce)
        {
            string kbDigits = Regex.Replace(kbNumber, "\\D", string.Empty);
            if (kbDigits.Length == 0)
                return new UpdateResult(kbNumber, false, false, "нет номера KB", "пропущено");

            string package = Resolve(knownPackage, kbDigits);
            var used = new List<string>();
            bool rebootCode = false;
            var state = Verify(kbDigits, package);

            if (state == VerifyState.Removed)
                return new UpdateResult(kbNumber, true, false, "не требуется", "пакет не найден");

            // Уровень 1: точечный DISM. /Quiet не передаём — с ним часть систем отвечает кодом 87.
            if (!string.IsNullOrWhiteSpace(package))
            {
                int code = RunCode("dism.exe", "/Online", "/Remove-Package", "/PackageName:" + package, "/NoRestart");
                used.Add("DISM " + Code(code));
                rebootCode |= code == 3010 || code == 1641;
                state = Verify(kbDigits, package);
            }

            // Уровень 2: wusa по номеру KB.
            if (state != VerifyState.Removed && state != VerifyState.Pending)
            {
                int code = RunCode("wusa.exe", "/uninstall", "/kb:" + kbDigits, "/quiet", "/norestart");
                used.Add("wusa " + Code(code));
                rebootCode |= code == 3010 || code == 1641;
                state = Verify(kbDigits, package);
            }

            // Уровень 3: принудительное владение файлами пакета.
            if ((state == VerifyState.Installed || state == VerifyState.Unknown) && allowForce)
            {
                int removed = ForceRemovePackageFiles(kbDigits);
                if (removed > 0)
                {
                    used.Add("владение и удаление файлов служб: " + removed + " шт.");
                    state = Verify(kbDigits, package);
                    if (state == VerifyState.Installed || state == VerifyState.Unknown)
                        state = VerifyState.Pending; // файлы сняты, требуется перезагрузка
                }
                else
                {
                    used.Add("файлы служб не найдены");
                }
            }

            string method = used.Count > 0 ? string.Join(" · ", used) : "нет доступного способа";
            string check = CheckText(state);
            bool success = state == VerifyState.Removed || state == VerifyState.Pending;
            bool needsReboot = rebootCode || state == VerifyState.Pending;
            return new UpdateResult(kbNumber, success, needsReboot, method, check);
        }

        private static string Resolve(string knownPackage, string kbDigits)
        {
            if (!string.IsNullOrWhiteSpace(knownPackage) &&
                knownPackage.IndexOf("KB" + kbDigits, StringComparison.OrdinalIgnoreCase) >= 0)
                return knownPackage;

            var map = MapKbToPackage();
            return map.TryGetValue(kbDigits, out var name) ? name : string.Empty;
        }

        /// <summary>
        /// Снимает файлы пакета (*.mum, *.cat) из хранилища обслуживания.
        /// Сначала пробует переместить их в резервную папку, при неудаче удаляет.
        /// Возвращает количество обработанных файлов.
        /// </summary>
        private static int ForceRemovePackageFiles(string kbDigits)
        {
            int handled = 0;
            try
            {
                if (!Directory.Exists(ServicingPackagesDir)) return 0;

                string[] files = Directory.GetFiles(ServicingPackagesDir, "*KB" + kbDigits + "*");
                if (files.Length == 0) return 0;

                Directory.CreateDirectory(BackupDir);

                foreach (string file in files)
                {
                    // Служба обслуживания держит файлы за собой: возвращаем владение администраторам.
                    RunCode("takeown.exe", "/f", file, "/a");
                    RunCode("icacls.exe", file, "/grant", "*S-1-5-32-544:F", "/c");

                    string target = Path.Combine(BackupDir, Path.GetFileName(file));
                    try
                    {
                        if (File.Exists(target)) File.Delete(target);
                        File.Move(file, target, true);
                        handled++;
                        continue;
                    }
                    catch { }

                    try
                    {
                        File.Delete(file);
                        handled++;
                    }
                    catch { }
                }
            }
            catch { }

            return handled;
        }

        /* ───────────────────────── проверка ───────────────────────── */

        public static VerifyState Verify(string kbDigits, string package)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(package))
                {
                    string safe = package.Replace("'", "''");
                    string state = Run("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
                        $"try {{ (Get-WindowsPackage -Online -PackageName '{safe}' -ErrorAction Stop).PackageState }} catch {{ 'ABSENT' }}").Trim();

                    if (state.Equals("ABSENT", StringComparison.OrdinalIgnoreCase)) return VerifyState.Removed;
                    if (state.IndexOf("UninstallPending", StringComparison.OrdinalIgnoreCase) >= 0) return VerifyState.Pending;
                    if (state.Equals("Installed", StringComparison.OrdinalIgnoreCase))
                        return FilesGone(kbDigits) ? VerifyState.Pending : VerifyState.Installed;
                }

                if (kbDigits.Length > 0)
                {
                    string hotfix = Run("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
                        $"if (Get-HotFix -Id KB{kbDigits} -ErrorAction SilentlyContinue) {{ 'YES' }} else {{ 'NO' }}").Trim();

                    if (hotfix.Equals("NO", StringComparison.OrdinalIgnoreCase)) return VerifyState.Removed;
                    if (hotfix.Equals("YES", StringComparison.OrdinalIgnoreCase)) return VerifyState.Installed;
                }
            }
            catch { }

            return VerifyState.Unknown;
        }

        private static bool FilesGone(string kbDigits)
        {
            try
            {
                if (!Directory.Exists(ServicingPackagesDir)) return false;
                return Directory.GetFiles(ServicingPackagesDir, "*KB" + kbDigits + "*").Length == 0;
            }
            catch
            {
                return false;
            }
        }

        public static string CheckText(VerifyState state) => state switch
        {
            VerifyState.Removed => "пакет удалён",
            VerifyState.Pending => "снято, вступит в силу после перезагрузки",
            VerifyState.Installed => "ОСТАЛСЯ В СИСТЕМЕ",
            _ => "нет ответа системы"
        };

        public static string Code(int code) =>
            code == 0 ? "OK"
            : code == -1 ? "таймаут"
            : code == 3010 || code == 1641 ? "нужна перезагрузка"
            : $"код 0x{code:X8}";

        /* ───────────────────────── запуск процессов ───────────────────────── */

        public static string Run(string fileName, params string[] arguments)
        {
            try
            {
                var info = new ProcessStartInfo(fileName)
                {
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };
                foreach (string argument in arguments) info.ArgumentList.Add(argument);

                using var process = Process.Start(info);
                if (process == null) return string.Empty;

                string stdout;
                try { stdout = process.StandardOutput.ReadToEnd(); }
                catch { stdout = string.Empty; }

                if (!process.WaitForExit(120_000))
                {
                    try { process.Kill(entireProcessTree: true); } catch { }
                }
                return stdout;
            }
            catch
            {
                return string.Empty;
            }
        }

        public static int RunCode(string fileName, params string[] arguments)
        {
            try
            {
                var info = new ProcessStartInfo(fileName)
                {
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                foreach (string argument in arguments) info.ArgumentList.Add(argument);

                using var process = Process.Start(info);
                if (process == null) return -1;

                if (!process.WaitForExit(240_000))
                {
                    try { process.Kill(entireProcessTree: true); } catch { }
                    return -1;
                }
                return process.ExitCode;
            }
            catch
            {
                return -1;
            }
        }
    }
}
