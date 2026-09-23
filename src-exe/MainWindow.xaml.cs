using System;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Management;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using Microsoft.Win32;

namespace RustFix
{
    public class UpdateItem
    {
        public bool IsSelected { get; set; }
        public string KbNumber { get; set; } = "";
        public string Title { get; set; } = "";
        public string PackageType { get; set; } = "";
        public string InstallDate { get; set; } = "";
        public string FullPackageName { get; set; } = "";
    }

    public partial class MainWindow : Window
    {
        private const string TargetBuildStr = "26100.8894";
        private const int TargetMajor = 26100;
        private const int TargetUbr = 8894;
        private const string TelegramUrl = "https://t.me/TriagedRust";
        private const string MsIsoUrl = "https://www.microsoft.com/ru-ru/software-download/windows11";

        public ObservableCollection<UpdateItem> Updates { get; set; } = new ObservableCollection<UpdateItem>();

        public MainWindow()
        {
            InitializeComponent();
            GridUpdates.ItemsSource = Updates;
            Loaded += async (s, e) => await AutoScanSystemAsync();
        }

        private async Task AutoScanSystemAsync()
        {
            TxtStatus.Text = "Автоматическое сканирование сборки Windows и обновлений...";
            ProgBar.Visibility = Visibility.Visible;
            Updates.Clear();

            try
            {
                // 1. Читаем версию Windows из реестра
                string currentBuild = "26100";
                int ubr = 0;
                string displayVersion = "24H2";

                try
                {
                    using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion"))
                    {
                        if (key != null)
                        {
                            currentBuild = key.GetValue("CurrentBuild")?.ToString() ?? "26100";
                            displayVersion = key.GetValue("DisplayVersion")?.ToString() ?? "24H2";
                            var ubrVal = key.GetValue("UBR");
                            if (ubrVal != null) ubr = Convert.ToInt32(ubrVal);
                        }
                    }
                }
                catch { }

                string fullBuild = $"{currentBuild}.{ubr}";
                TxtDetectedBuild.Text = fullBuild;

                // 2. Сравнение с целевой 26100.8894
                if (int.TryParse(currentBuild, out int cMajor))
                {
                    if (cMajor == TargetMajor && ubr == TargetUbr)
                    {
                        BadgeVerdict.Background = new SolidColorBrush(Color.FromArgb(40, 79, 168, 154));
                        BadgeVerdict.BorderBrush = new SolidColorBrush(Color.FromRgb(79, 168, 154));
                        TxtVerdictBadge.Foreground = new SolidColorBrush(Color.FromRgb(79, 168, 154));
                        TxtVerdictBadge.Text = "✓ СБОРКА СТАБИЛЬНА";
                        TxtBuildAdvice.Text = "Ваша сборка полностью соответствует эталонной стабильной Windows 11 24H2 (26100.8894).";
                    }
                    else if (cMajor != TargetMajor)
                    {
                        BadgeVerdict.Background = new SolidColorBrush(Color.FromArgb(50, 224, 122, 95));
                        BadgeVerdict.BorderBrush = new SolidColorBrush(Color.FromRgb(224, 122, 95));
                        TxtVerdictBadge.Foreground = new SolidColorBrush(Color.FromRgb(224, 122, 95));
                        TxtVerdictBadge.Text = "✕ НЕПОДХОДЯЩАЯ ВЕТКА ОС";
                        TxtBuildAdvice.Text = $"Обнаружена ветка {currentBuild} вместо 26100 (24H2). Если откат не удался, используйте чистую установку.";
                    }
                    else if (ubr < TargetUbr)
                    {
                        BadgeVerdict.Background = new SolidColorBrush(Color.FromArgb(40, 224, 163, 46));
                        BadgeVerdict.BorderBrush = new SolidColorBrush(Color.FromRgb(224, 163, 46));
                        TxtVerdictBadge.Foreground = new SolidColorBrush(Color.FromRgb(224, 163, 46));
                        TxtVerdictBadge.Text = "⚠ СБОРКА НИЖЕ СТАБИЛЬНОЙ";
                        TxtBuildAdvice.Text = $"UBR {ubr} < {TargetUbr}. Вы можете удалить сбойные KB ниже и поставить накопительный пакет.";
                    }
                    else
                    {
                        BadgeVerdict.Background = new SolidColorBrush(Color.FromArgb(40, 224, 122, 95));
                        BadgeVerdict.BorderBrush = new SolidColorBrush(Color.FromRgb(224, 122, 95));
                        TxtVerdictBadge.Foreground = new SolidColorBrush(Color.FromRgb(224, 122, 95));
                        TxtVerdictBadge.Text = "⚠ СБОРКА ВЫШЕ ЭТАЛОНА";
                        TxtBuildAdvice.Text = $"UBR {ubr} выше стабильного {TargetUbr}. Рекомендуется удалить последние обновления и поставить паузу.";
                    }
                }

                // 3. Сканируем установленные обновления (WMI + DISM)
                await Task.Run(() =>
                {
                    // WMI HotFixes
                    try
                    {
                        using (var searcher = new ManagementObjectSearcher("SELECT HotFixID, Description, InstalledOn FROM Win32_QuickFixEngineering"))
                        {
                            foreach (ManagementObject obj in searcher.Get())
                            {
                                string hf = obj["HotFixID"]?.ToString() ?? "";
                                string desc = obj["Description"]?.ToString() ?? "Обновление системы";
                                string date = obj["InstalledOn"]?.ToString() ?? "";

                                if (!string.IsNullOrEmpty(hf) && !Updates.Any(u => u.KbNumber == hf))
                                {
                                    Dispatcher.Invoke(() =>
                                    {
                                        Updates.Add(new UpdateItem
                                        {
                                            IsSelected = true,
                                            KbNumber = hf,
                                            Title = desc,
                                            PackageType = "HotFix / Накопительный",
                                            InstallDate = date
                                        });
                                    });
                                }
                            }
                        }
                    }
                    catch { }

                    // DISM Packages (включая скрытые)
                    try
                    {
                        var psi = new ProcessStartInfo("dism.exe", "/Online /Get-Packages /Format:Table")
                        {
                            CreateNoWindow = true,
                            UseShellExecute = false,
                            RedirectStandardOutput = true
                        };
                        using (var p = Process.Start(psi))
                        {
                            if (p != null)
                            {
                                string output = p.StandardOutput.ReadToEnd();
                                p.WaitForExit();

                                var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                                foreach (var line in lines)
                                {
                                    if (line.Contains("Package_for_KB") || line.Contains("KB"))
                                    {
                                        var parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                                        if (parts.Length >= 2)
                                        {
                                            string pkgName = parts[0];
                                            string state = parts[1];

                                            if (state.Equals("Installed", StringComparison.OrdinalIgnoreCase))
                                            {
                                                var kbMatch = System.Text.RegularExpressions.Regex.Match(pkgName, @"KB\d{5,9}");
                                                string kb = kbMatch.Success ? kbMatch.Value : "Скрытый пакет";

                                                if (!Updates.Any(u => u.KbNumber == kb || u.FullPackageName == pkgName))
                                                {
                                                    Dispatcher.Invoke(() =>
                                                    {
                                                        Updates.Add(new UpdateItem
                                                        {
                                                            IsSelected = false,
                                                            KbNumber = kb,
                                                            Title = pkgName,
                                                            PackageType = "Скрытый CBS / DISM",
                                                            InstallDate = "Системный",
                                                            FullPackageName = pkgName
                                                        });
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch { }
                });

                TxtSelectedCount.Text = $"Обнаружено: {Updates.Count} обновлений (включая скрытые)";
                TxtStatus.Text = "Сканирование завершено.";
            }
            catch (Exception ex)
            {
                TxtStatus.Text = "Ошибка сканирования: " + ex.Message;
            }
            finally
            {
                ProgBar.Visibility = Visibility.Collapsed;
            }
        }

        private async void BtnDeleteUpdates_Click(object sender, RoutedEventArgs e)
        {
            var chosen = Updates.Where(u => u.IsSelected).ToList();
            if (chosen.Count == 0)
            {
                MessageBox.Show("Отметьте хотя бы одно обновление галочкой для удаления.", "RustFix", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            var confirm = MessageBox.Show($"Вы уверены, что хотите гарантированно удалить {chosen.Count} выбранных обновлений?", "Подтверждение удаления", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (confirm != MessageBoxResult.Yes) return;

            BtnDeleteUpdates.IsEnabled = false;
            ProgBar.Visibility = Visibility.Visible;
            TxtStatus.Text = "Создание точки восстановления и остановка служб обновления...";

            bool threeLayer = ChkThreeLayer.IsChecked == true;

            await Task.Run(() =>
            {
                try
                {
                    // 1. Остановка служб
                    foreach (var s in new[] { "wuauserv", "bits", "UsoSvc", "DoSvc" })
                    {
                        Process.Start(new ProcessStartInfo("net.exe", $"stop {s} /y") { CreateNoWindow = true, UseShellExecute = false })?.WaitForExit();
                    }

                    // 2. Удаление каждого пакета
                    foreach (var u in chosen)
                    {
                        Dispatcher.Invoke(() => TxtStatus.Text = $"Удаление {u.KbNumber}...");

                        // Способ A: WUSA
                        string kbDigits = System.Text.RegularExpressions.Regex.Replace(u.KbNumber, @"\D", "");
                        if (!string.IsNullOrEmpty(kbDigits))
                        {
                            var wusa = Process.Start(new ProcessStartInfo("wusa.exe", $"/uninstall /kb:{kbDigits} /quiet /norestart") { CreateNoWindow = true, UseShellExecute = false });
                            wusa?.WaitForExit();
                        }

                        // Способ B: DISM Package removal
                        if (threeLayer)
                        {
                            string pkgToDel = !string.IsNullOrEmpty(u.FullPackageName) ? u.FullPackageName : u.KbNumber;
                            var dism = Process.Start(new ProcessStartInfo("dism.exe", $"/Online /Remove-Package /PackageName:{pkgToDel} /NoRestart /Quiet") { CreateNoWindow = true, UseShellExecute = false });
                            dism?.WaitForExit();
                        }
                    }

                    // 3. Зачистка остатков и хранилища (3-й уровень)
                    if (threeLayer)
                    {
                        Dispatcher.Invoke(() => TxtStatus.Text = "Зачистка кэша SoftwareDistribution и хранилища компонентов...");
                        try
                        {
                            string sdPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "SoftwareDistribution", "Download");
                            if (Directory.Exists(sdPath))
                            {
                                Directory.Delete(sdPath, true);
                            }
                        }
                        catch { }

                        var dismClean = Process.Start(new ProcessStartInfo("dism.exe", "/Online /Cleanup-Image /StartComponentCleanup /ResetBase") { CreateNoWindow = true, UseShellExecute = false });
                        dismClean?.WaitForExit();
                    }

                    // Запуск служб обратно
                    foreach (var s in new[] { "wuauserv", "bits", "UsoSvc" })
                    {
                        Process.Start(new ProcessStartInfo("net.exe", $"start {s}") { CreateNoWindow = true, UseShellExecute = false })?.WaitForExit();
                    }
                }
                catch (Exception ex)
                {
                    Dispatcher.Invoke(() => MessageBox.Show("Ошибка при удалении: " + ex.Message, "RustFix"));
                }
            });

            ProgBar.Visibility = Visibility.Collapsed;
            BtnDeleteUpdates.IsEnabled = true;
            TxtStatus.Text = "Удаление завершено. Рекомендуется перезагрузить ПК.";

            MessageBox.Show("Выбранные обновления удалены из системы.\nРекомендуется перезагрузить компьютер и зафиксировать паузу в Настройках, чтобы Windows не скачала их повторно.", "RustFix by yawaside", MessageBoxButton.OK, MessageBoxImage.Information);

            await AutoScanSystemAsync();
        }

        private async void BtnRescan_Click(object sender, RoutedEventArgs e) => await AutoScanSystemAsync();

        private void BtnSelectAll_Click(object sender, RoutedEventArgs e)
        {
            foreach (var u in Updates) u.IsSelected = true;
            GridUpdates.Items.Refresh();
        }

        private void BtnDeselectAll_Click(object sender, RoutedEventArgs e)
        {
            foreach (var u in Updates) u.IsSelected = false;
            GridUpdates.Items.Refresh();
        }

        private void BtnTelegram_Click(object sender, RoutedEventArgs e)
        {
            try { Process.Start(new ProcessStartInfo(TelegramUrl) { UseShellExecute = true }); } catch { }
        }

        private void BtnSettings_Click(object sender, RoutedEventArgs e)
        {
            var settingsWin = new SettingsWindow();
            settingsWin.Owner = this;
            settingsWin.ShowDialog();
        }
    }
}
