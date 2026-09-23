# RustFix by yawaside

**Портативное EXE-приложение для Windows 11** (.NET 8 WPF, один файл, без установки).
Автоматически сканирует систему, показывает установленную сборку и все обновления
(включая скрытые пакеты CBS/DISM), удаляет их гарантированно и управляет
Центром обновления.

Целевой стабильный билд: **Windows 11 24H2 · Сборка ОС 26100.8894**
Канал: **https://t.me/TriagedRust**

---

## Скачать готовый RustFix.exe

1. Откройте страницу **Releases** репозитория.
2. В свежем релизе скачайте **`RustFix.exe`** (раздел Assets).
3. Запустите двойным кликом → подтвердите UAC. Всё.

Приложение **само**:
- читает сборку ОС из реестра (`CurrentBuild.UBR`) и сверяет с эталоном `26100.8894`;
- сканирует обновления через WMI (`Win32_QuickFixEngineering`) **и** DISM
  (`/Online /Get-Packages`) — видны и скрытые системные пакеты;
- удаляет отмеченные обновления в 3 уровня: `wusa` → `DISM /Remove-Package` →
  зачистка `SoftwareDistribution` и сброс базы WinSxS;
- в «Настройках»: пауза (7 дн / 4 нед / 35 нед), полное отключение
  (NoAutoUpdate, службы wuauserv/UsoSvc/BITS), запрет автоперезагрузки,
  восстановление штатного режима, инструкция по переустановке со ссылкой
  на официальный образ 24H2.

## Как exe попадает в Releases (автоматически)

Workflow `.github/workflows/build-exe.yml` запускается **при каждом push в main**:

```
push в main  →  GitHub Actions (windows-latest, ~2–3 мин)
             →  dotnet publish: single-file RustFix.exe
             →  автоматический релиз v1.5.<номер сборки> с RustFix.exe
```

Ничего вручную делать не нужно. Хотите именованный релиз — создайте тег:

```bash
git tag v1.5.0
git push origin v1.5.0     # → релиз "v1.5.0" с RustFix.exe
```

Артефакт `RustFix-exe` также доступен на странице каждой сборки в Actions.

## Сборка локально

Нужен только .NET 8 SDK (Windows):

```bash
dotnet publish src-exe/RustFix.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist-exe
# результат: dist-exe/RustFix.exe
```

## Структура репозитория

```
src-exe/               само EXE-приложение (C# / WPF / .NET 8)
  RustFix.csproj       single-file publish, requireAdministrator
  MainWindow.*         главный экран: автоскан билда + список обновлений
  SettingsWindow.*     настройки: пауза, отключение, восстановление, о программе
.github/workflows/
  build-exe.yml        сборка exe + публикация в Releases при каждом push
src/                   веб-превью интерфейса (React, для демонстрации)
```

## Важно

- EXE запрашивает права администратора через манифест (`requireAdministrator`) —
  это необходимо для DISM, служб и реестра.
- Перед удалением рекомендуется точка восстановления / бэкап.
- После удаления поставьте паузу в «Настройках», чтобы Windows не вернула пакеты.
- Телеметрии нет.
