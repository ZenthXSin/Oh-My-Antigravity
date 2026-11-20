param([string]$AppPath, [string]$PackagePath, [string]$ErrorFile = (Join-Path $env:TEMP 'AntigravityCustom-preflight.txt'))
$env:PSModulePath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\Modules;$env:ProgramFiles\WindowsPowerShell\Modules"
$ErrorActionPreference = 'Stop'
try {
  if (-not (Test-Path -LiteralPath (Join-Path $AppPath 'resources\app.asar'))) { throw 'Antigravity was not found. Select the directory containing Antigravity.exe.' }
  $taskRunning = @(Get-CimInstance Win32_Process -Filter "name = 'Antigravity.exe'" | Where-Object { $_.ExecutablePath -eq (Join-Path $AppPath 'Antigravity.exe') })
  if ($taskRunning.Count -gt 0) { throw 'Fully quit Antigravity, then retry. The installer will not force-stop your tasks.' }
  if($PackagePath) {
    $taskRuntimeRoot=[IO.Path]::GetFullPath((Join-Path $PackagePath 'runtime'))+'\'
    $taskRuntime=@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($taskRuntimeRoot,[StringComparison]::OrdinalIgnoreCase) })
    if($taskRuntime.Count -gt 0) { throw 'Enhancement background processes are still running. Close them or restart Windows, then retry.' }
  }
  exit 0
} catch {
  [IO.File]::WriteAllText($ErrorFile, $_.Exception.Message, [Text.UTF8Encoding]::new($false))
  exit 1
}
