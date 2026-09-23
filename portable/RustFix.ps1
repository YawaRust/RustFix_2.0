#Requires -Version 5.1
# ==========================================================================
#  RustFix by yawaside — портативная утилита Windows 11 24H2
#  Целевая сборка: Windows 11 24H2 / 26100.8894
#  Канал: https://t.me/TriagedRust
# ==========================================================================

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName System.Windows.Forms

$script:TargetFull  = '26100.8894'
$script:TargetBuild = 26100
$script:TargetUbr   = 8894
$script:TargetName  = 'Windows 11 24H2'
$script:Version     = '1.5.0'
$script:Telegram    = 'https://t.me/TriagedRust'
$script:Microsoft   = 'https://www.microsoft.com/ru-ru/software-download/windows11'

# Проверка прав администратора
$identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    try {
        $launch = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
        Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $launch -ErrorAction Stop
    } catch {
        [System.Windows.MessageBox]::Show('RustFix требует запуск от имени администратора.', 'RustFix') | Out-Null
    }
    exit
}

# Окно интерфейса
$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="RustFix by yawaside · Windows 11 24H2"
        Height="580" Width="800" WindowStartupLocation="CenterScreen"
        Background="#12100F" Foreground="#EFE7DE" FontFamily="Segoe UI" FontSize="13">
    <Grid Margin="18">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <DockPanel Grid.Row="0" Margin="0,0,0,14">
            <Button x:Name="BtnTg" DockPanel.Dock="Right" Content="t.me/TriagedRust" Background="#163833" Foreground="#4FA89A" BorderBrush="#4FA89A" Padding="12,6" Cursor="Hand"/>
            <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                <TextBlock Text="RustFix by yawaside" FontSize="18" FontWeight="Bold" Foreground="#FFFFFF"/>
                <TextBlock Text="  portable .exe" FontSize="12" Foreground="#8F8379" VerticalAlignment="Center"/>
            </StackPanel>
        </DockPanel>

        <!-- Билд статус -->
        <Border Grid.Row="1" Background="#1B1715" BorderBrush="#2E2520" BorderThickness="1" CornerRadius="6" Padding="14" Margin="0,0,0,12">
            <DockPanel>
                <Border x:Name="BadgeVerdict" DockPanel.Dock="Right" Background="#221E1C" BorderBrush="#3D322A" BorderThickness="1" Padding="10,6" CornerRadius="4">
                    <TextBlock x:Name="TxtVerdict" Text="СКАН..." FontWeight="Bold" Foreground="#8F8379"/>
                </Border>
                <StackPanel>
                    <TextBlock Text="АВТОСКАН ВЕРСИИ WINDOWS" FontSize="10" FontWeight="Bold" Foreground="#8F8379"/>
                    <StackPanel Orientation="Horizontal" Margin="0,4,0,0">
                        <TextBlock Text="Обнаружена сборка: " Foreground="#B0A499"/>
                        <TextBlock x:Name="TxtCurBuild" Text="26100.xxxx" FontWeight="Bold" Foreground="#FFFFFF"/>
                        <TextBlock Text="   Эталон: 26100.8894 (24H2)" Foreground="#4FA89A" Margin="10,0,0,0"/>
                    </StackPanel>
                </StackPanel>
            </DockPanel>
        </Border>

        <!-- Список обновлений -->
        <Border Grid.Row="2" Background="#1B1715" BorderBrush="#2E2520" BorderThickness="1" CornerRadius="6" Padding="12">
            <DataGrid x:Name="GridPkgs" Background="#12100F" BorderBrush="#2E2520" Foreground="#EFE7DE" RowBackground="#171312" AlternatingRowBackground="#1B1715" AutoGenerateColumns="False" CanUserAddRows="False" HeadersVisibility="Column" GridLinesVisibility="Horizontal">
                <DataGrid.Columns>
                    <DataGridCheckBoxColumn Header="" Binding="{Binding Sel, Mode=TwoWay}" Width="35"/>
                    <DataGridTextColumn Header="KB" Binding="{Binding Kb}" FontWeight="Bold" Foreground="#E8823F" Width="95"/>
                    <DataGridTextColumn Header="Описание / Пакет" Binding="{Binding Title}" Width="*"/>
                    <DataGridTextColumn Header="Источник" Binding="{Binding Source}" Width="120"/>
                </DataGrid.Columns>
            </DataGrid>
        </Border>

        <!-- Действие -->
        <DockPanel Grid.Row="3" Margin="0,12,0,0">
            <TextBlock x:Name="TxtStatus" Text="Готово к удалению" Foreground="#8F8379" VerticalAlignment="Center"/>
            <Button x:Name="BtnRemove" Content="УДАЛИТЬ ВЫБРАННЫЕ ОБНОВЛЕНИЯ" Background="#C75B24" Foreground="#FFFFFF" FontWeight="Bold" Padding="18,10" HorizontalAlignment="Right" Cursor="Hand"/>
        </DockPanel>
    </Grid>
</Window>
'@

$doc = New-Object System.Xml.XmlDocument
$doc.LoadXml($xaml)
$win = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $doc))

$grid = $win.FindName('GridPkgs')
$txtCur = $win.FindName('TxtCurBuild')
$txtV = $win.FindName('TxtVerdict')
$btnRem = $win.FindName('BtnRemove')
$btnTg = $win.FindName('BtnTg')
$txtStat = $win.FindName('TxtStatus')

# Чтение реестра
$cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$cur = "$($cv.CurrentBuild).$($cv.UBR)"
$txtCur.Text = $cur

if ($cur -eq '26100.8894') {
    $txtV.Text = '✓ СТАБИЛЬНАЯ'
    $txtV.Foreground = [Windows.Media.Brushes]::MediumAquamarine
} else {
    $txtV.Text = '⚠ ТРЕБУЕТ ВНИМАНИЯ'
    $txtV.Foreground = [Windows.Media.Brushes]::SandyBrown
}

# Поиск обновлений
$items = New-Object System.Collections.ArrayList
try {
    Get-HotFix | ForEach-Object {
        [void]$items.Add([pscustomobject]@{ Sel = $true; Kb = $_.HotFixID; Title = $_.Description; Source = 'HotFix' })
    }
} catch { }

try {
    Get-WindowsPackage -Online | Where-Object { $_.PackageState -eq 'Installed' -and $_.PackageName -match 'KB(\d+)' } | ForEach-Object {
        $kb = 'KB' + $Matches[1]
        [void]$items.Add([pscustomobject]@{ Sel = $true; Kb = $kb; Title = $_.PackageName; Source = 'Скрытый CBS' })
    }
} catch { }

$grid.ItemsSource = $items

$btnTg.Add_Click({ Start-Process $script:Telegram })

$btnRem.Add_Click({
    $selected = @($grid.ItemsSource | Where-Object { $_.Sel })
    if ($selected.Count -eq 0) {
        [Windows.MessageBox]::Show('Выберите обновления для удаления.') | Out-Null
        return
    }

    $txtStat.Text = "Удаление $($selected.Count) пакетов..."
    foreach ($item in $selected) {
        $num = $item.Kb -replace '\D',''
        Start-Process 'wusa.exe' -ArgumentList "/uninstall /kb:$num /quiet /norestart" -Wait -NoNewWindow
    }
    [Windows.MessageBox]::Show('Выбранные обновления удалены. Рекомендуется перезагрузить ПК.', 'RustFix') | Out-Null
})

$win.ShowDialog() | Out-Null
