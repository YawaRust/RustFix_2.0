@echo off
rem ============================================================
rem  RustFix by yawaside — портативный запуск (без установки)
rem  Открывает приложение в отдельном окне Edge (--app),
rem  1в1 как нативное .exe. WebView2/Edge уже есть в Windows 11.
rem  Канал: https://t.me/TriagedRust
rem ============================================================
setlocal
cd /d "%~dp0"
set "PAGE=%~dp0app\index.html?app=1"

set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" --app="file:///%PAGE:\=/%" --user-data-dir="%~dp0.profile" --window-size=1440,920
) else (
  echo Microsoft Edge не найден — открываю в браузере по умолчанию...
  start "" "%~dp0app\index.html"
)
endlocal
