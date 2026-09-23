using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;

namespace RustFix;

public sealed class UpdateItem : INotifyPropertyChanged
{
    private bool _isSelected;

    public bool IsSelected
    {
        get => _isSelected;
        set
        {
            if (value && !CanAttemptRemove || _isSelected == value) return;
            _isSelected = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsSelected)));
        }
    }

    public string KbNumber { get; init; } = "";
    public string Title { get; init; } = "";
    public string PackageType { get; init; } = "";
    public string InstallDate { get; init; } = "";
    public string PackageIdentity { get; init; } = "";
    public bool CanAttemptRemove { get; init; }
    public string RemoveHint { get; init; } = "";

    public event PropertyChangedEventHandler? PropertyChanged;
}

public partial class MainWindow : Window
{
    private const int TargetBuild = 26100;
    private const int TargetUbr = 8894;
    private const string TargetFull = "26100.8894";

    private readonly ObservableCollection<UpdateItem> _updates = new();
    private bool _busy;

    public MainWindow()
    {
        InitializeComponent();
        GridUpdates.ItemsSource = _updates;
        Loaded += async (_, _) => await ScanAsync();
    }

    private void SetBusy(bool value)
    {
        _busy = value;
        ProgBar.Visibility = value ? Visibility.Visible : Visibility.Collapsed;
        BtnRescan.IsEnabled = !value;
        BtnSettings.IsEnabled = !value;
        BtnSelectAll.IsEnabled = !value;
        BtnDeselectAll.IsEnabled = !value;
        UpdateSelection();
    }

    private void UpdateSelection()
    {
        var count = _updates.Count(u => u.IsSelected && u.CanAttemptRemove);
        TxtSelectedCount.Text = $"Найдено: {_updates.Count}  ·  Выбрано: {count}";
        BtnDeleteUpdates.IsEnabled = !_busy && count > 0;
    }

    private async Task<ScanResult?> ScanAsync()
    {
        if (_busy) return null;
        SetBusy(true);
        TxtStatus.Text = "Читаю версию Windows и пакеты CBS / HotFix...";
        TxtDetectedBuild.Text = "Проверка...";

        try
        {
            var scan = await WindowsUpdateService.ScanAsync();
            _updates.Clear();
            foreach (var item in scan.Updates)
            {
                item.PropertyChanged += (_, _) => UpdateSelection();
                _updates.Add(item);
            }
            ShowBuild(scan.Build);
            TxtStatus.Text = scan.Warning == null
                ? $"Сканирование завершено. {_updates.Count} записей (включая CBS)."
                : "Сканирование частичное — наведите курсор, чтобы увидеть причину.";
            TxtStatus.ToolTip = scan.Warning;
            return scan;
        }
        catch (Exception ex)
        {
            ShowBuild(null);
            TxtStatus.Text = "Не удалось выполнить сканирование.";
            TxtStatus.ToolTip = ex.Message;
            MessageBox.Show(this, ex.Message, "Ошибка сканирования", MessageBoxButton.OK, MessageBoxImage.Error);
            return null;
        }
        finally { SetBusy(false); }
    }

    private void ShowBuild(BuildDetails? build)
    {
        if (build == null)
        {
            TxtDetectedBuild.Text = "не определена";
            TxtVerdictBadge.Text = "НЕИЗВЕСТНО";
            TxtVerdictBadge.Foreground = Brushes.Orange;
            TxtBuildAdvice.Text = "Версию не удалось прочитать из реестра. Подробности в строке состояния.";
            return;
        }

        TxtDetectedBuild.Text = build.Full + " (" + build.Version + ")";
        if (build.Build != TargetBuild || !string.Equals(build.Version, "24H2", StringComparison.OrdinalIgnoreCase))
        {
            TxtVerdictBadge.Text = "ДРУГАЯ ВЕРСИЯ";
            TxtVerdictBadge.Foreground = Brushes.OrangeRed;
            TxtBuildAdvice.Text = "Это не 24H2 / 26100. Откат KB не заменит переустановку другой версии Windows.";
        }
        else if (build.Ubr == TargetUbr)
        {
            TxtVerdictBadge.Text = "СОВПАДАЕТ";
            TxtVerdictBadge.Foreground = Brushes.MediumAquamarine;
            TxtBuildAdvice.Text = "Установлена целевая сборка " + TargetFull + ". Удаление обновлений не требуется.";
        }
        else
        {
            TxtVerdictBadge.Text = build.Ubr > TargetUbr ? "НОВЕЕ ЦЕЛИ" : "НИЖЕ ЦЕЛИ";
            TxtVerdictBadge.Foreground = Brushes.Goldenrod;
            TxtBuildAdvice.Text = $"Текущая ревизия {build.Ubr}; цель {TargetUbr}. Откат обновлений не гарантирует получение именно {TargetFull}.";
        }
    }

    private async void BtnDeleteUpdates_Click(object sender, RoutedEventArgs e)
    {
        if (_busy) return;
        var selected = _updates.Where(u => u.IsSelected && u.CanAttemptRemove).ToList();
        if (selected.Count == 0) return;

        var confirmation = MessageBox.Show(this,
            $"Попробовать удалить {selected.Count} обновлений?\n\n" +
            "Сделайте резервную копию важных данных. Не каждый пакет Windows допускает откат; " +
            "программа покажет код ошибки, если снятие невозможно. Подтвердите UAC и не выключайте компьютер до завершения.",
            "Подтверждение удаления", MessageBoxButton.YesNo, MessageBoxImage.Warning);
        if (confirmation != MessageBoxResult.Yes) return;

        SetBusy(true);
        var results = new System.Collections.Generic.List<(UpdateItem Item, CommandResult Result)>();
        try
        {
            TxtStatus.Text = "Создаю точку восстановления...";
            try
            {
                var restore = await CommandRunner.PowerShellAsync(
                    "Checkpoint-Computer -Description 'RustFix: before update removal' -RestorePointType MODIFY_SETTINGS -ErrorAction Stop",
                    TimeSpan.FromMinutes(2));
                if (restore.ExitCode != 0)
                    throw new InvalidOperationException(restore.Error.Trim());
            }
            catch (Exception ex)
            {
                if (MessageBox.Show(this,
                    "Точка восстановления не создана: " + ex.Message +
                    "\n\nПродолжить без неё? Только если у вас уже есть резервная копия.",
                    "Нет точки восстановления", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes)
                    return;
            }

            foreach (var item in selected)
            {
                TxtStatus.Text = "Снимаю " + (item.KbNumber == "—" ? item.PackageIdentity : item.KbNumber) + "...";
                try
                {
                    var result = await WindowsUpdateService.RemoveAsync(item);
                    results.Add((item, result));
                }
                catch (Exception ex)
                {
                    results.Add((item, new CommandResult(-1, "", ex.Message)));
                }
            }
        }
        finally { SetBusy(false); }

        // A zero exit code means Windows accepted the command, not that a reboot
        // has completed the rollback. Re-read installed state before reporting it.
        var scanAfter = await ScanAsync();
        var accepted = 0;
        var pending = 0;
        var failed = new System.Collections.Generic.List<string>();
        foreach (var (item, result) in results)
        {
            var label = item.KbNumber == "—" ? item.PackageIdentity : item.KbNumber;
            if (result.ExitCode is 0 or 3010 or 1641)
            {
                var stillPresent = scanAfter == null || scanAfter.Warning != null ||
                    scanAfter.Updates.Any(u => item.PackageIdentity.Length > 0
                        ? u.PackageIdentity.Equals(item.PackageIdentity, StringComparison.OrdinalIgnoreCase)
                        : u.KbNumber.Equals(item.KbNumber, StringComparison.OrdinalIgnoreCase));
                if (result.ExitCode != 0 || stillPresent) pending++;
                else accepted++;
            }
            else
            {
                var reason = result.Error.Trim();
                if (reason.Length == 0) reason = "Откат отклонён Windows.";
                failed.Add($"{label}: 0x{result.ExitCode:X8} ({reason[..Math.Min(reason.Length, 100)]})");
            }
        }

        var message = new StringBuilder();
        message.AppendLine($"Снято и подтверждено повторным сканированием: {accepted}.");
        message.AppendLine($"Ожидают перезагрузки или проверки: {pending}.");
        message.AppendLine($"Ошибок Windows: {failed.Count}.");
        if (failed.Count > 0)
        {
            message.AppendLine();
            foreach (var error in failed.Take(5)) message.AppendLine(error);
            message.AppendLine("Если Windows отказывает в откате, откройте «Настройки → Если откат не помог».");
        }
        if (pending > 0) message.AppendLine("Перезагрузите ПК и нажмите «Обновить список».");
        TxtStatus.Text = failed.Count > 0 ? "Есть ошибки удаления — подробности в отчёте." : "Проверка удаления завершена.";
        MessageBox.Show(this, message.ToString(), "Результат удаления", MessageBoxButton.OK,
            failed.Count > 0 ? MessageBoxImage.Warning : MessageBoxImage.Information);
    }

    private async void BtnRescan_Click(object sender, RoutedEventArgs e) => await ScanAsync();

    private void BtnSelectAll_Click(object sender, RoutedEventArgs e)
    {
        foreach (var update in _updates.Where(u => u.CanAttemptRemove)) update.IsSelected = true;
    }

    private void BtnDeselectAll_Click(object sender, RoutedEventArgs e)
    {
        foreach (var update in _updates) update.IsSelected = false;
    }

    private void BtnSettings_Click(object sender, RoutedEventArgs e) =>
        new SettingsWindow { Owner = this }.ShowDialog();
}