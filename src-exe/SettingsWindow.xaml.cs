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

        private void SetPauseDays(int days)
        {
            try
            {
                using (var key = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\WindowsUpdate\UX\Settings"))
                {
                    if (key != null)
                    {
                        if (days <= 0)
                        {
                            foreach (var n in new[] { "PauseUpdatesStartTime", "PauseUpdatesEndTime", "PauseQualityUpdatesStartTime", "PauseQualityUpdatesEndTime", "PauseFeatureUpdatesStartTime", "PauseFeatureUpdatesEndTime" })
                            {
                                key.DeleteValue(n, false);
                            }
                            MessageBox.Show("Пауза обновлений снята.", "RustFix", MessageBoxButton.OK, MessageBoxImage.Information);
                        }
                        else
                        {
                            string s = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
                            string e = DateTime.UtcNow.AddDays(days).ToString("yyyy-MM-ddTHH:mm:ssZ");

                            key.SetValue("PauseUpdatesStartTime", s, RegistryValueKind.String);
                            key.SetValue("PauseUpdatesEndTime", e, RegistryValueKind.String);
                            key.SetValue("PauseQualityUpdatesStartTime", s, RegistryValueKind.String);
                            key.SetValue("PauseQualityUpdatesEndTime", e, RegistryValueKind.String);
                            key.SetValue("PauseFeatureUpdatesStartTime", s, RegistryValueKind.String);
                            key.SetValue("PauseFeatureUpdatesEndTime", e, RegistryValueKind.String);

                            MessageBox.Show($"Обновления успешно приостановлены на {days} дней (до {DateTime.Now.AddDays(days):dd.MM.yyyy}).", "RustFix", MessageBoxButton.OK, MessageBoxImage.Information);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Ошибка изменения параметров реестра: " + ex.Message, "RustFix");
            }
        }

        private void BtnPause7_Click(object sender, RoutedEventArgs e) => SetPauseDays(7);
        private void BtnPause28_Click(object sender, RoutedEventArgs e) => SetPauseDays(28);
        private void BtnPause245_Click(object sender, RoutedEventArgs e) => SetPauseDays(245);
        private void BtnPause0_Click(object sender, RoutedEventArgs e) => SetPauseDays(0);

        private void BtnApplyPolicies_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                using (var au = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"))
                {
                    if (au != null)
                    {
                        if (ChkNoAutoUpdate.IsChecked == true)
                        {
                            au.SetValue("NoAutoUpdate", 1, RegistryValueKind.DWord);
                            au.SetValue("AUOptions", 1, RegistryValueKind.DWord);
                        }
                        if (ChkNoReboot.IsChecked == true)
                        {
                            au.SetValue("NoAutoRebootWithLoggedOnUsers", 1, RegistryValueKind.DWord);
                        }
                    }
                }

                if (ChkDisableServices.IsChecked == true)
                {
                    foreach (var s in new[] { "wuauserv", "UsoSvc", "bits" })
                    {
                        Process.Start(new ProcessStartInfo("sc.exe", $"config {s} start=disabled") { CreateNoWindow = true, UseShellExecute = false })?.WaitForExit();
                        Process.Start(new ProcessStartInfo("net.exe", $"stop {s} /y") { CreateNoWindow = true, UseShellExecute = false })?.WaitForExit();
                    }
                }

                MessageBox.Show("Блокировки успешно применены в реестре и службах Windows.", "RustFix", MessageBoxButton.OK, MessageBoxImage.Information);
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
                SetPauseDays(0);

                try { Registry.LocalMachine.DeleteSubKeyTree(@"SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate", false); } catch { }

                foreach (var s in new[] { "wuauserv", "UsoSvc", "bits" })
                {
                    Process.Start(new ProcessStartInfo("sc.exe", $"config {s} start=demand") { CreateNoWindow = true, UseShellExecute = false })?.WaitForExit();
                    Process.Start(new ProcessStartInfo("net.exe", $"start {s}") { CreateNoWindow = true, UseShellExecute = false })?.WaitForExit();
                }

                MessageBox.Show("Штатный режим обновлений Windows восстановлен.", "RustFix", MessageBoxButton.OK, MessageBoxImage.Information);
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
