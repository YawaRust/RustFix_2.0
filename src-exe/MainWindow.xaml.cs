using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Management;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using Microsoft.Win32;

namespace RustFix
{
    public sealed class UpdateItem : INotifyPropertyChanged
    {
        private bool _isSelected;

        public bool IsSelected
        {
            get => _isSelected;
            set
            {
                if (_isSelected == value) return;
                _isSelected = value;
                PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsSelected)));
            }
        }

        public bool CanRemove { get; set; }
        public string KbNumber { get; set; } = "";
        public string Title { get; set; } = "";
        public string PackageType { get; set; } = "";
        public string InstallDate { get; set; } = "";
        public string RemovalStatus { get; set; } = "";
        public string FullPackageName { get; set; } = "";

        public event PropertyChangedEventHandler? PropertyChanged;
    }

    public partial class MainWindow : Window
    {
        private const int TargetMajor = 26100;
        private const int TargetUbr = 8894;
        private const string TelegramUrl = "https://t.me/TriagedRust";

        public ObservableCollection<UpdateItem> Updates { get; } = new();

        public MainWindow()
        {
            InitializeComponent();
            GridUpdates.ItemsSource = Updates;
            Loaded += async (_, _) => await AutoScanSystemAsync();
        }

        private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ClickCount == 2)
            {
                WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
                return;
            }
            DragMove();
        }

        private void BtnMinimize_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
        private void BtnClose_Click(object sender, RoutedEventArgs e) => Close();

        private async Task AutoScanSystemAsync()
        {
            TxtStatus.Text = "Автоматическое сканирование сборки и установленных пакетов...";
            ProgBar.Visibility = Visibility.Visible;
            BtnDeleteUpdates.IsEnabled = false;
            BtnRescan.IsEnabled = false;
            Updates.Clear();

            try
            {
                SetBuildVerdict();
                var found = await Task.Run(ScanInstalledUpdates);

                foreach (var item in found)
                {
                    item.PropertyChanged += (_, args) =>
                    {
                        if (args.PropertyName == nameof(UpdateItem.IsSelected)) RefreshCount();
                    };
                    Updates.Add(item);
                }

                RefreshCount();
                TxtStatus.Text = found.Count == 0
                    ? "Не удалось обнаружить удаляемые обновления. Нажмите «Обновить список» для повторной проверки."
                    : "Сканирование завершено: показаны обычные KB и скрытые пакеты CBS/DISM.";
            }
            catch (Exception ex)
            {
                TxtStatus.Text = "Ошибка сканирования: " + ex.Message;
            }
            finally
            {
                ProgBar.Visibility = Visibility.Collapsed;
                BtnDeleteUpdates.IsEnabled = true;
                BtnRescan.IsEnabled = true;
            }
        }

        private void SetBuildVerdict()
        {
            string currentBuild = "—";
            int major = 0;
            int ubr = 0;

            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
                var b = key?.GetValue("CurrentBuild")?.ToString() ?? "0";
                major = int.TryParse(b, out var parsed) ? parsed : 0;
                ubr = Convert.ToInt32(key?.GetValue("UBR") ?? 0);
                currentBuild = $"{b}.{ubr}";
            }
            catch { }

            TxtDetectedBuild.Text = currentBuild;

            if (major == TargetMajor && ubr == TargetUbr)
            {
                SetBadge("✓ БИЛД СТАБИЛЕН", "#4FA89A", "#153A34");
                TxtBuildAdvice.Text = "Ваша система соответствует стабильной Windows 11 24H2 (26100.8894). Откат не требуется.";
            }
            else if (major != TargetMajor)
            {
                SetBadge("✕ ДРУГАЯ ВЕРСИЯ", "#E8823F", "#311A13");
                TxtBuildAdvice.Text = $"Установлена ветка {major}, а нужна 26100 / 24H2. Откат KB не заменит переустановку другой версии Windows.";
            }
            else if (ubr < TargetUbr)
            {
                SetBadge("⚠ НИЖЕ ЭТАЛОНА", "#E0A32E", "#312714");
                TxtBuildAdvice.Text = $"Сборка отстаёт от эталона на {TargetUbr - ubr} UBR. В списке ниже можно снять проблемные последние пакеты.";
            }
            else
            {
                SetBadge("⚠ ВЫШЕ ЭТАЛОНА", "#E8823F", "#311A13");
                TxtBuildAdvice.Text = $"Сборка новее стабильной на {ubr - TargetUbr} UBR. Отметьте последние накопительные пакеты для отката.";
            }
        }

        private void SetBadge(string text, string foreground, string background)
        {
            TxtVerdictBadge.Text = text;
            TxtVerdictBadge.Foreground = Brush(foreground);
            BadgeVerdict.Background = Brush(background);
            BadgeVerdict.BorderBrush = Brush(foreground);
        }

        private static SolidColorBrush Brush(string hex) =>
            (SolidColorBrush)new BrushConverter().ConvertFromString(hex)!;

        private List<UpdateItem> ScanInstalledUpdates()
        {
            var result = new List<UpdateItem>();
            var identities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // 1. Обычные обновления Windows (WMI): наиболее понятны для пользователя.
            try
            {
                using var searcher = new ManagementObjectSearcher(
                    "SELECT HotFixID, Description, InstalledOn FROM Win32_QuickFixEngineering");

                foreach (ManagementObject obj in searcher.Get())
                {
                    var kb = obj["HotFixID"]?.ToString()?.Trim() ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(kb)) continue;

                    string rawDate = obj["InstalledOn"]?.ToString() ?? string.Empty;
                    string date = DateTime.TryParse(rawDate, out var parsed)
                        ? parsed.ToString("yyyy-MM-dd")
                        : (string.IsNullOrEmpty(rawDate) ? "—" : rawDate);

                    result.Add(new UpdateItem
                    {
                        IsSelected = true,
                        CanRemove = true,
                        KbNumber = kb,
                        Title = obj["Description"]?.ToString()?.Trim() ?? "Windows Update",
                        PackageType = "KB (HotFix)",
                        InstallDate = date,
                        RemovalStatus = "Можно удалить"
                    });
                    identities.Add(kb);
                }
            }
            catch { }

            // 2. Скрытые пакеты CBS/WinSxS: DISM через Get-WindowsPackage.
            // JSON вместо текстовой таблицы DISM: не зависит от языка Windows.
            try
            {
                const string command = "Get-WindowsPackage -Online | Where-Object {$_.PackageState -eq 'Installed'} | Select-Object PackageName,ReleaseType,InstallTime | ConvertTo-Json -Compress";
                string json = RunProcess("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command);

                if (!string.IsNullOrWhiteSpace(json))
                {
                    using var doc = JsonDocument.Parse(json);
                    var packages = doc.RootElement.ValueKind == JsonValueKind.Array
                        ? doc.RootElement.EnumerateArray().ToArray()
                        : new[] { doc.RootElement };

                    foreach (var package in packages)
                    {
                        if (!package.TryGetProperty("PackageName", out var nameNode)) continue;
                        string packageName = nameNode.GetString() ?? string.Empty;
                        if (string.IsNullOrWhiteSpace(packageName) || !LooksLikeUpdatePackage(packageName)) continue;

                        string releaseType = package.TryGetProperty("ReleaseType", out var releaseNode)
                            ? releaseNode.GetString() ?? "CBS"
                            : "CBS";
                        string installDate = package.TryGetProperty("InstallTime", out var timeNode)
                            ? FormatInstallDate(timeNode)
                            : "Системный";

                        bool protectedComponent = IsProtectedComponent(packageName);
                        var kbMatch = Regex.Match(packageName, @"KB\d{5,9}", RegexOptions.IgnoreCase);
                        string kb = kbMatch.Success ? kbMatch.Value.ToUpperInvariant() : "CBS-компонент";

                        // Не добавляем точную копию уже найденного пакета, но CBS-версию KB показываем.
                        string identity = "CBS:" + packageName;
                        if (!identities.Add(identity)) continue;

                        result.Add(new UpdateItem
                        {
                            IsSelected = !protectedComponent && kbMatch.Success,
                            CanRemove = !protectedComponent && kbMatch.Success,
                            KbNumber = kb,
                            Title = packageName,
                            PackageType = protectedComponent ? "Защищённый CBS" : "Скрытый CBS / DISM",
                            InstallDate = installDate,
                            FullPackageName = packageName,
                            RemovalStatus = protectedComponent ? "Защищено Windows" : (kbMatch.Success ? "Можно попробовать снять" : "Только просмотр")
                        });
                    }
                }
            }
            catch { }

            return result
                .OrderByDescending(item => item.CanRemove)
                .ThenByDescending(item => item.InstallDate)
                .Take(120)
                .ToList();
        }

        private static bool LooksLikeUpdatePackage(string packageName)
        {
            return packageName.Contains("KB", StringComparison.OrdinalIgnoreCase)
                || packageName.Contains("RollupFix", StringComparison.OrdinalIgnoreCase)
                || packageName.Contains("ServicingStack", StringComparison.OrdinalIgnoreCase)
                || packageName.Contains("Cumulative", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsProtectedComponent(string packageName)
        {
            string[] protectedTerms =
            {
                "ServicingStack", "Foundation", "LanguagePack", "FeaturesOnDemand",
                "WinPE", "Client-Desktop-Required-Package"
            };
            return protectedTerms.Any(term => packageName.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        private static string FormatInstallDate(JsonElement element)
        {
            string raw = element.ToString();
            return DateTime.TryParse(raw, out var date) ? date.ToString("yyyy-MM-dd") : "Системный";
        }

        private static string RunProcess(string fileName, params string[] arguments)
        {
            var info = new ProcessStartInfo(fileName)
            {
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };
            foreach (var argument in arguments) info.ArgumentList.Add(argument);

            using var process = Process.Start(info);
            if (process == null) return string.Empty;
            string stdout = process.StandardOutput.ReadToEnd();
            process.WaitForExit(90_000);
            return stdout;
        }

        private static int RunProcessWithExitCode(string fileName, params string[] arguments)
        {
            var info = new ProcessStartInfo(fileName)
            {
                UseShellExecute = false,
                CreateNoWindow = true
            };
            foreach (var argument in arguments) info.ArgumentList.Add(argument);
            using var process = Process.Start(info);
            if (process == null) return -1;
            process.WaitForExit(180_000);
            return process.ExitCode;
        }

        private async void BtnDeleteUpdates_Click(object sender, RoutedEventArgs e)
        {
            var chosen = Updates.Where(item => item.IsSelected && item.CanRemove).ToList();
            if (chosen.Count == 0)
            {
                MessageBox.Show("Отметьте хотя бы одно доступное обновление.", "RustFix by yawaside", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            var answer = MessageBox.Show(
                $"Удалить {chosen.Count} выбранных обновлений?\n\nRustFix остановит службы обновления, снимет пакеты через wusa/DISM и очистит кэш Центра обновления.",
                "Подтвердите удаление",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);
            if (answer != MessageBoxResult.Yes) return;

            BtnDeleteUpdates.IsEnabled = false;
            ProgBar.Visibility = Visibility.Visible;
            bool fullMode = ChkThreeLayer.IsChecked == true;
            int failed = 0;

            try
            {
                await Task.Run(() =>
                {
                    Dispatcher.Invoke(() => TxtStatus.Text = "Создание точки восстановления...");
                    TryCreateRestorePoint();

                    Dispatcher.Invoke(() => TxtStatus.Text = "Остановка служб Windows Update...");
                    foreach (var service in new[] { "wuauserv", "bits", "UsoSvc", "DoSvc" })
                    {
                        TryRun("net.exe", "stop", service, "/y");
                    }

                    foreach (var item in chosen)
                    {
                        Dispatcher.Invoke(() => TxtStatus.Text = $"Удаление {item.KbNumber}...");
                        bool removed = false;
                        string kbDigits = Regex.Replace(item.KbNumber, "\\D", string.Empty);

                        if (!string.IsNullOrEmpty(kbDigits))
                        {
                            int code = RunProcessWithExitCode("wusa.exe", "/uninstall", "/kb:" + kbDigits, "/quiet", "/norestart");
                            removed = code == 0 || code == 3010;
                        }

                        if (fullMode && !string.IsNullOrWhiteSpace(item.FullPackageName))
                        {
                            int code = RunProcessWithExitCode("dism.exe", "/Online", "/Remove-Package", "/PackageName:" + item.FullPackageName, "/NoRestart", "/Quiet");
                            removed = removed || code == 0 || code == 3010;
                        }

                        if (!removed) failed++;
                    }

                    if (fullMode)
                    {
                        Dispatcher.Invoke(() => TxtStatus.Text = "Очистка кэша Центра обновления...");
                        ClearUpdateCache();
                        // No ResetBase here: it would make other installed packages impossible to uninstall.
                        TryRun("dism.exe", "/Online", "/Cleanup-Image", "/StartComponentCleanup", "/Quiet", "/NoRestart");
                    }

                    foreach (var service in new[] { "wuauserv", "bits", "UsoSvc" })
                    {
                        TryRun("net.exe", "start", service);
                    }
                });

                string report = failed == 0
                    ? $"Обработка завершена. Выбрано пакетов: {chosen.Count}.\n\nПерезагрузите ПК, затем включите паузу в «Настройках», чтобы Windows не вернула обновления."
                    : $"Обработка завершена. Не удалось снять пакетов: {failed}.\n\nПерезагрузите ПК и повторите; для защищённых компонентов используйте раздел «Если откат не помог» в Настройках.";
                MessageBox.Show(report, "RustFix by yawaside", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Ошибка при обработке обновлений: " + ex.Message, "RustFix by yawaside", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                ProgBar.Visibility = Visibility.Collapsed;
                BtnDeleteUpdates.IsEnabled = true;
                await AutoScanSystemAsync();
            }
        }

        private static void TryCreateRestorePoint()
        {
            try
            {
                RunProcess("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
                    "try { Checkpoint-Computer -Description 'RustFix before update removal' -RestorePointType MODIFY_SETTINGS -ErrorAction Stop } catch { }");
            }
            catch { }
        }

        private static void ClearUpdateCache()
        {
            try
            {
                string download = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "SoftwareDistribution", "Download");
                if (Directory.Exists(download))
                {
                    foreach (var path in Directory.EnumerateFileSystemEntries(download))
                    {
                        try
                        {
                            if (Directory.Exists(path)) Directory.Delete(path, true);
                            else File.Delete(path);
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }

        private static void TryRun(string fileName, params string[] arguments)
        {
            try { RunProcessWithExitCode(fileName, arguments); } catch { }
        }

        private async void BtnRescan_Click(object sender, RoutedEventArgs e) => await AutoScanSystemAsync();

        private void BtnSelectAll_Click(object sender, RoutedEventArgs e)
        {
            foreach (var item in Updates.Where(item => item.CanRemove)) item.IsSelected = true;
            GridUpdates.Items.Refresh();
            RefreshCount();
        }

        private void BtnDeselectAll_Click(object sender, RoutedEventArgs e)
        {
            foreach (var item in Updates) item.IsSelected = false;
            GridUpdates.Items.Refresh();
            RefreshCount();
        }

        private void RefreshCount()
        {
            int selected = Updates.Count(item => item.IsSelected && item.CanRemove);
            int protectedCount = Updates.Count(item => !item.CanRemove);
            TxtSelectedCount.Text = $"Найдено: {Updates.Count} · Выбрано: {selected}" + (protectedCount > 0 ? $" · Защищено: {protectedCount}" : string.Empty);
        }

        private void BtnTelegram_Click(object sender, RoutedEventArgs e)
        {
            try { Process.Start(new ProcessStartInfo(TelegramUrl) { UseShellExecute = true }); } catch { }
        }

        private void BtnSettings_Click(object sender, RoutedEventArgs e)
        {
            var window = new SettingsWindow { Owner = this };
            window.ShowDialog();
        }
    }
}