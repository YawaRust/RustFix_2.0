import { TARGET } from "./data";

export type ControlOpts = {
  services: boolean;
  policy: boolean;
  noreboot: boolean;
  internet: boolean;
};

const NL = "\n";

const header = (title: string) =>
  [
    "#Requires -RunAsAdministrator",
    "# ==========================================================",
    "#  RustFix by yawaside  ·  " + title,
    "#  Цель: " + TARGET.name + " · сборка " + TARGET.full,
    "#  Канал: https://t.me/TriagedRust",
    "#  Запуск: powershell -NoProfile -ExecutionPolicy Bypass -File .\\RustFix.ps1",
    "# ==========================================================",
    "",
    "$ErrorActionPreference = 'Continue'",
    "$Target = [version]'" + TARGET.full + "'",
    "$Host.UI.RawUI.WindowTitle = 'RustFix by yawaside'",
    "",
    "function LF($m){ Write-Host ('[RustFix] ' + $m) -ForegroundColor Yellow }",
    "function OK($m){ Write-Host ('[RustFix] ' + $m) -ForegroundColor Green }",
    "function ER($m){ Write-Host ('[RustFix] ' + $m) -ForegroundColor Red }",
    "function HD($m){ Write-Host $m -ForegroundColor Cyan }",
    "",
  ].join(NL);

const footer = [
  "",
  "HD '---------------------------------------------------------'",
  "Read-Host 'RustFix: работа завершена, нажмите Enter'",
  "",
].join(NL);

/* ------------------------------ 01 · диагностика ------------------------------ */

export function diagScript(): string {
  return (
    header("проверка установленной сборки") +
    [
      "HD '=== 01 · ПРОВЕРКА СБОРКИ ==='",
      "",
      "$cv = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'",
      "$cur  = [version]($cv.CurrentBuild + '.' + $cv.UBR)",
      "",
      "LF ('Сборка    : ' + $cur)",
      "LF ('Ветка     : ' + $cv.DisplayVersion + '  (' + $cv.ProductName + ')')",
      "LF ('Эталон    : ' + $Target + '  —  " + TARGET.name + ", стабильный канал')",
      "LF ('Устройство: ' + $env:COMPUTERNAME)",
      "HD ''",
      "",
      "if ($cur -eq $Target) {",
      "  OK 'БИЛД СООТВЕТСТВУЕТ. Откатывать обновления не требуется.'",
      "}",
      "elseif ($cur.Build -ne $Target.Build) {",
      "  ER ('НЕ СООТВЕТСТВУЕТ: ветка ' + $cur.Build + ' вместо " + TARGET.build + " (' + " +
        JSON.stringify(TARGET.branch) +
        " + ').')",
      "  ER 'Нужна чистая установка " +
        TARGET.name +
        " — раздел 04 (переустановка ОС).'",
      "}",
      "elseif ($cur.Revision -lt $Target.Revision) {",
      "  ER ('БИЛД УСТАРЕЛ: не хватает ' + ($Target.Revision - $cur.Revision) + ' ревизий UBR.')",
      "  ER ('Снимите лишние пакеты в разделе 02 и поставьте накопительное обновление до UBR " +
        TARGET.ubr +
        ".')",
      "}",
      "else {",
      "  ER ('БИЛД НОВЕЕ ЭТАЛОНА: UBR ' + $cur.Revision + ' > " + TARGET.ubr + ".')",
      "  ER 'Сборка вышла за пределы стабильного канала — откатите пакеты в разделе 02.'",
      "}",
      "",
      "HD '=== Последние установленные обновления ==='",
      "Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 15 HotFixID, Description, InstalledOn | Format-Table -AutoSize",
      "",
      "HD '=== Накопительные пакеты хранилища (CBS) ==='",
      "Get-WindowsPackage -Online | Where-Object { $_.PackageState -eq 'Installed' } | Select-Object -First 15 PackageName, ReleaseType | Format-Table -AutoSize",
      "",
      "HD '=== Целостность хранилища компонентов ==='",
      "DISM.exe /Online /Cleanup-Image /ScanHealth",
    ].join(NL) +
    footer
  );
}

/* ------------------------------ 02 · удаление ------------------------------ */

export function removalScript(kb: string[], threeLayer: boolean): string {
  const clean = kb.map((k) => k.replace(/[^0-9a-zA-Z]/gi, "")).filter(Boolean);
  const list = clean.length
    ? "$Kb = @(" + clean.map((k) => "'" + k + "'").join(", ") + ")"
    : "# пустой список = будут сняты ВСЕ установленные пакеты CBS" + NL + "$Kb = @()";

  const out: string[] = [
    list,
    "",
    "HD '=== 02 · УДАЛЕНИЕ ОБНОВЛЕНИЙ ==='",
    "",
    "# --- страховка: точка восстановления -----------------------------",
    "LF 'Создаю точку восстановления...'",
    "try {",
    "  Checkpoint-Computer -Description 'RustFix - перед удалением обновлений' -RestorePointType MODIFY_SETTINGS -ErrorAction Stop",
    "  OK 'точка восстановления создана'",
    "} catch {",
    "  ER ('точка не создана: ' + $_.Exception.Message + ' — продолжаю')",
    "}",
    "",
    "# --- остановка служб обновления ----------------------------------",
    "LF 'Останавливаю службы обновления...'",
    "foreach ($s in @('wuauserv','bits','UsoSvc','DoSvc')) {",
    "  try { Stop-Service -Name $s -Force -ErrorAction Stop; OK ('остановлена: ' + $s) }",
    "  catch { ER ('не удалось остановить ' + $s + ': ' + $_.Exception.Message) }",
    "}",
    "Start-Sleep -Seconds 2",
    "",
    "# --- сбор пакетов к снятию ----------------------------------------",
    "$pkg = @()",
    "if ($Kb.Count -eq 0) {",
    "  LF 'Список KB не задан — забираю все установленные пакеты CBS.'",
    "  $pkg = Get-WindowsPackage -Online | Where-Object { $_.PackageState -eq 'Installed' } | Select-Object -ExpandProperty PackageName",
    "} else {",
    "  foreach ($k in $Kb) {",
    "    $n = $k -replace '[^0-9]',''",
    "    LF ('Поиск пакета ' + $k)",
    "    $hit = Get-WindowsPackage -Online | Where-Object { $_.PackageName -like ('*' + $n + '*') }",
    "    foreach ($h in $hit) { $pkg += $h.PackageName }",
    "    if (-not $hit) { ER ('пакет ' + $k + ' в CBS не найден') }",
    "  }",
    "}",
    "$pkg = $pkg | Select-Object -Unique",
    "if (-not $pkg) { ER 'Пакеты для удаления не найдены.' }",
    "$failed = @()",
    "",
    "# --- метод A · wusa.exe -------------------------------------------",
    "HD ''",
    "LF 'Метод A — wusa.exe (кабинетные обновления и MSU)'",
    "foreach ($k in $Kb) {",
    "  $n = $k -replace '[^0-9]',''",
    "  $p = Start-Process -FilePath 'wusa.exe' -ArgumentList ('/uninstall /kb:' + $n + ' /quiet /norestart') -Wait -PassThru -NoNewWindow",
    "  if ($p.ExitCode -eq 0 -or $p.ExitCode -eq 3010) { OK ('снято: ' + $k) }",
    "  else { ER ($k + ' -> код ' + $p.ExitCode) }",
    "}",
  ];

  if (threeLayer) {
    out.push(
      "",
      "# --- метод B · хранилище компонентов (CBS / DISM) -----------------",
      "HD ''",
      "LF 'Метод B — Remove-WindowsPackage с откатом на DISM'",
      "foreach ($p in $pkg) {",
      "  try {",
      "    Remove-WindowsPackage -Online -PackageName $p -NoRestart -ErrorAction Stop | Out-Null",
      "    OK ('удалён пакет: ' + $p)",
      "  } catch {",
      "    ER ('cmdlet отказал, пробую DISM: ' + $p)",
      "    $a = '/Online /Remove-Package /PackageName:' + $p + ' /NoRestart /Quiet'",
      "    $r = Start-Process -FilePath ($env:SystemRoot + '\\System32\\Dism.exe') -ArgumentList $a -Wait -PassThru -NoNewWindow",
      "    if ($r.ExitCode -eq 0 -or $r.ExitCode -eq 3010) { OK ('удалён DISM: ' + $p) }",
      "    else { $failed += $p; ER ('не снят: ' + $p + ' (код ' + $r.ExitCode + ')') }",
      "  }",
      "}",
      "",
      "# --- метод C · полная зачистка ------------------------------------",
      "HD ''",
      "LF 'Метод C — кэш ЦО, отложенные файлы, журналы'",
      "Stop-Service -Name wuauserv,bits,UsoSvc,DoSvc -Force -ErrorAction SilentlyContinue",
      "$paths = @(",
      "  \"$env:windir\\SoftwareDistribution\\Download\",",
      "  \"$env:ProgramData\\Microsoft\\Windows\\DeliveryOptimization\\Cache\",",
      "  \"$env:windir\\Logs\\CBS\"",
      ")",
      "foreach ($path in $paths) {",
      "  if (Test-Path $path) {",
      "    Get-ChildItem -Path $path -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'CBS.log' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue",
      "    OK ('очищен: ' + $path)",
      "  }",
      "}",
      "foreach ($f in @(\"$env:windir\\pending.xml\", \"$env:windir\\WinSxS\\pending.xml\")) {",
      "  if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue; OK ('удалён: ' + $f) }",
      "}",
      "",
      "LF 'Анализ хранилища компонентов...'",
      "DISM.exe /Online /Cleanup-Image /AnalyzeComponentStore",
      "",
      "Start-Service -Name wuauserv,bits,UsoSvc -ErrorAction SilentlyContinue",
      "HD ''",
      "if ($failed.Count -gt 0) {",
      "  ER ('НЕ СНЯТО ПАКЕТОВ: ' + $failed.Count)",
      "  $failed | ForEach-Object { ER ('  - ' + $_) }",
      "  ER 'Перезагрузитесь и повторите; если не помогло — раздел 04 (переустановка ОС).'",
      "} else {",
      "  OK 'Все выбранные обновления удалены.'",
      "}",
      "ER 'Важно: чтобы пакет не вернулся, включите паузу или блокировку в разделе 03.'",
    );
  } else {
    out.push(
      "",
      "LF 'Одноуровневый режим: выполнен только метод A (wusa).'",
      "Start-Service -Name wuauserv,bits,UsoSvc -ErrorAction SilentlyContinue",
      "ER 'Пакет остался в системе? Включите «Гарантированное удаление» (3 уровня) в разделе 02.'",
    );
  }

  return header("удаление обновлений · гарантированное снятие") + out.join(NL) + footer;
}

/* ------------------------------ 03 · контроль ------------------------------ */

export function controlScript(pauseDays: number, o: ControlOpts): string {
  const out: string[] = [];

  if (pauseDays > 0) {
    const z = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
    const start = z(new Date());
    const end = z(new Date(Date.now() + pauseDays * 864e5));
    out.push(
      "HD '=== Приостановка обновлений ==='",
      "$S = '" + start + "'",
      "$E = '" + end + "'",
      "New-Item -Path 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings' -Force | Out-Null",
      "foreach ($n in @('PauseUpdatesStartTime','PauseQualityUpdatesStartTime','PauseFeatureUpdatesStartTime')) {",
      "  Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings' -Name $n -Value $S -Type String",
      "}",
      "foreach ($n in @('PauseUpdatesEndTime','PauseQualityUpdatesEndTime','PauseFeatureUpdatesEndTime')) {",
      "  Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings' -Name $n -Value $E -Type String",
      "}",
      "OK ('обновления приостановлены до ' + $E)",
      "",
    );
  }

  if (o.policy) {
    out.push(
      "HD '=== Политика: отключить автообновления ==='",
      "$au = 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU'",
      "$wu = 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate'",
      "New-Item -Path $au -Force | Out-Null",
      "New-Item -Path $wu -Force | Out-Null",
      "Set-ItemProperty -Path $au -Name 'NoAutoUpdate' -Value 1 -Type DWord",
      "Set-ItemProperty -Path $au -Name 'AUOptions' -Value 1 -Type DWord",
      "Set-ItemProperty -Path $wu -Name 'DisableWindowsUpdateAccess' -Value 1 -Type DWord",
      "OK 'политика применена: автоматическая проверка обновлений отключена'",
      "",
    );
  }

  if (o.internet) {
    out.push(
      "HD '=== Блокировка связи с серверами обновлений ==='",
      "$wu = 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate'",
      "New-Item -Path $wu -Force | Out-Null",
      "Set-ItemProperty -Path $wu -Name 'DoNotConnectToWindowsUpdateInternetLocations' -Value 1 -Type DWord",
      "$hosts = \"$env:windir\\System32\\drivers\\etc\\hosts\"",
      "if (-not (Select-String -Path $hosts -Pattern 'download.windowsupdate.com' -Quiet -ErrorAction SilentlyContinue)) {",
      "  Add-Content -Path $hosts -Value ('0.0.0.0 download.windowsupdate.com' + [Environment]::NewLine + '0.0.0.0 www.update.microsoft.com')",
      "  OK 'запись добавлена в hosts'",
      "}",
      "ipconfig /flushdns | Out-Null",
      "",
    );
  }

  if (o.noreboot) {
    out.push(
      "HD '=== Запрет автоматической перезагрузки ==='",
      "$au = 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU'",
      "New-Item -Path $au -Force | Out-Null",
      "Set-ItemProperty -Path $au -Name 'NoAutoRebootWithLoggedOnUsers' -Value 1 -Type DWord",
      "OK 'автоперезагрузка при наличии вошедшего пользователя запрещена'",
      "",
    );
  }

  if (o.services) {
    out.push(
      "HD '=== Отключение служб обновления ==='",
      "foreach ($s in @('wuauserv','UsoSvc','bits')) {",
      "  try { Stop-Service -Name $s -Force -ErrorAction Stop; Set-Service -Name $s -StartupType Disabled; OK ('отключена: ' + $s) }",
      "  catch { ER ('служба ' + $s + ': ' + $_.Exception.Message) }",
      "}",
      "ER 'Центр обновления начнёт выдавать ошибку 0x80248007 — это ожидаемо.'",
      "",
    );
  }

  if (!out.length) {
    out.push(
      "ER 'Ни одно действие не выбрано — включите паузу или блокировку в разделе 03.'",
      "",
    );
  }

  return header("контроль обновлений Windows") + out.join(NL) + footer;
}

/* ------------------------------ 04 · восстановление ------------------------------ */

export function restoreScript(): string {
  return (
    header("возврат штатного режима обновлений") +
    [
      "HD '=== ВОССТАНОВЛЕНИЕ ОБНОВЛЕНИЙ ==='",
      "",
      "# 1. снятие паузы",
      "Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings' -Name 'PauseUpdatesStartTime','PauseUpdatesEndTime','PauseQualityUpdatesStartTime','PauseQualityUpdatesEndTime','PauseFeatureUpdatesStartTime','PauseFeatureUpdatesEndTime' -ErrorAction SilentlyContinue",
      "OK 'пауза снята'",
      "",
      "# 2. снятие политик",
      "Remove-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate' -Recurse -Force -ErrorAction SilentlyContinue",
      "OK 'политики обновлений удалены'",
      "",
      "# 3. возврат служб",
      "foreach ($s in @('wuauserv','UsoSvc','bits')) {",
      "  Set-Service -Name $s -StartupType Manual -ErrorAction SilentlyContinue",
      "  Start-Service -Name $s -ErrorAction SilentlyContinue",
      "  OK ('служба восстановлена: ' + $s)",
      "}",
      "",
      "# 4. чистка кэша Центра обновления",
      "Stop-Service -Name wuauserv,bits -Force -ErrorAction SilentlyContinue",
      "Remove-Item \"$env:windir\\SoftwareDistribution\\Download\\*\" -Recurse -Force -ErrorAction SilentlyContinue",
      "Start-Service -Name wuauserv,bits -ErrorAction SilentlyContinue",
      "OK 'кэш ЦО очищен'",
      "",
      "# 5. возврат записей hosts",
      "$hosts = \"$env:windir\\System32\\drivers\\etc\\hosts\"",
      "(Get-Content $hosts -ErrorAction SilentlyContinue) | Where-Object { $_ -notmatch 'windowsupdate.com|update.microsoft.com' } | Set-Content $hosts -ErrorAction SilentlyContinue",
      "ipconfig /flushdns | Out-Null",
      "OK 'hosts очищен'",
      "",
      "# 6. целостность системы",
      "DISM.exe /Online /Cleanup-Image /RestoreHealth",
      "sfc.exe /scannow",
    ].join(NL) +
    footer
  );
}

/* ------------------------------ сборка и выдача ------------------------------ */

export function buildAll(
  kb: string[],
  threeLayer: boolean,
  pauseDays: number,
  o: ControlOpts,
): string {
  return [
    diagScript(),
    removalScript(kb, threeLayer),
    controlScript(pauseDays, o),
    restoreScript(),
  ]
    .map((s) => s.replace(/#Requires -RunAsAdministrator\r?\n/g, ""))
    .join(NL + NL);
}

export function download(name: string, text: string) {
  const blob = new Blob(["\ufeff" + text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
