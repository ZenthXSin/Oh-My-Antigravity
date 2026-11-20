param([string]$AppPath, [string]$ErrorFile = (Join-Path $env:TEMP 'AntigravityCustom-preflight.txt'))
$ErrorActionPreference = 'Stop'
try {
  if (-not (Test-Path -LiteralPath (Join-Path $AppPath 'resources\app.asar'))) { throw 'Antigravity was not found. Select the directory containing Antigravity.exe.' }
  $taskRunning = @(Get-CimInstance Win32_Process -Filter "name = 'Antigravity.exe'" | Where-Object { $_.ExecutablePath -eq (Join-Path $AppPath 'Antigravity.exe') })
  if ($taskRunning.Count -gt 0) { throw 'Fully quit Antigravity, then retry. The installer will not force-stop your tasks.' }
  exit 0
} catch {
  [IO.File]::WriteAllText($ErrorFile, $_.Exception.Message, [Text.UTF8Encoding]::new($false))
  exit 1
}
