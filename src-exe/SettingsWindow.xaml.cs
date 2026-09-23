using System;
using System.Diagnostics;
using System.Windows;
using Microsoft.Win32;

namespace RustFix
{
    public partial class SettingsWindow : Window
    {
        private const string TelegramUrl = "https://t.me/TriagedRust";
        private const string MsIsoUrl = "https://www.microsoft.com/ru-ru/software-download/windows11";

        public SettingsWindow()
        {
            InitializeComponent();
        }

        private bool SetPauseDays(int days, bool showConfirmation = true)
        {
            try
            {
                using (var key = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\WindowsUpdate\UX\Settings"))
                {
                    if (key == null) throw new InvalidOperationException("Нет доступа к параметрам Windows Update.");
                    if (days <= 0)
                    {
                        foreach (var n in new[] { "PauseUpdatesStartTime", "PauseUpdatesEndTime", "PauseQualityUpdatesStartTime", "PauseQualityUpdatesEndTime", "PauseFeatureUpdatesStartTime", "PauseFeatureUpdatesEndTime" })
                        {
                            key.DeleteValue(n, false);
                        }
                    }
                    else
                    {
                        string s = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
                        string end = DateTime.UtcNow.AddDays(days).ToString("yyyy-MM-ddTHH:mm:ssZ");
                        foreach (var n in new[] { "PauseUpdatesStartTime", "PauseQualityUpdatesStartTime", "PauseFeatureUpdatesStartTime" })
                            key.SetValue(n, s, RegistryValueKind.String);
                        foreach (var n in new[] { "PauseUpdatesEndTime", "PauseQualityUpdatesEndTime", "PauseFeatureUpdatesEndTime" })
                            key.SetValue(n, end, RegistryValueKind.String);
                    }
                }
                if (showConfirmation)
                    MessageBox.Show(days == 0 ? "Даты паузы удалены." :
                        $"Даты паузы записаны до {DateTime.Now.AddDays(days):dd.MM.yyyy}. Проверьте состояние в Центре обновления Windows.",
                        "RustFix", MessageBoxButton.OK, MessageBoxImage.Information);
                return true;
            }
            catch (Exception ex)
            {
                MessageBox.Show("Ошибка изменения параметров реестра: " + ex.Message, "RustFix");
                return false;
            }
        }

        private void BtnPause7_Click(object sender, RoutedEventArgs e) => SetPauseDays(7);
        private void BtnPause28_Click(object sender, RoutedEventArgs e) => SetPauseDays(28);
        private void BtnPause35_Click(object sender, RoutedEventArgs e) => SetPauseDays(35);
        private void BtnPause0_Click(object sender, RoutedEventArgs e) => SetPauseDays(0);

        private void BtnApplyPolicies_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                using (var au = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"))
                {
                    if (au == null) throw new InvalidOperationException("Нет доступа к политикам Windows Update.");
                    if (ChkNoAutoUpdate.IsChecked == true)
                    {
                        au.SetValue("NoAutoUpdate", 1, RegistryValueKind.DWord);
                        au.SetValue("AUOptions", 1, RegistryValueKind.DWord);
                    }
                    if (ChkNoReboot.IsChecked == true)
                        au.SetValue("NoAutoRebootWithLoggedOnUsers", 1, RegistryValueKind.DWord);
                }

                MessageBox.Show("Выбранные политики записаны. Windows может применять их после перезагрузки; проверьте статус в Центре обновления.",
                    "RustFix", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Ошибка: " + ex.Message, "RustFix");
            }
        }

        private void BtnRestoreDefaults_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (!SetPauseDays(0, false)) return;
                using (var au = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU", true))
                {
                    if (au != null)
                    {
                        au.DeleteValue("NoAutoUpdate", false);
                        au.DeleteValue("AUOptions", false);
                        au.DeleteValue("NoAutoRebootWithLoggedOnUsers", false);
                    }
                }

                MessageBox.Show("Даты паузы и политики RustFix удалены. Перезагрузите ПК и проверьте Центр обновления.",
                    "RustFix", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Ошибка восстановления: " + ex.Message, "RustFix");
            }
        }

        private void BtnMsDownload_Click(object sender, RoutedEventArgs e)
        {
            try { Process.Start(new ProcessStartInfo(MsIsoUrl) { UseShellExecute = true }); } catch { }
        }

        private void TelegramLink_Click(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            try { Process.Start(new ProcessStartInfo(TelegramUrl) { UseShellExecute = true }); } catch { }
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e) => Close();
    }
}
