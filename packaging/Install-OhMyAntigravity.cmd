@echo off
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-setup.ps1" %*
if errorlevel 1 (
  echo Installation failed. See the message above and the setup log under LocalAppData\OhMyAntigravity\InstallerTemp.
  pause
  exit /b 1
)
