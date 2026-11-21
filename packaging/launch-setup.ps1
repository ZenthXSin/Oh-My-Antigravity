param([string]$Installer = (Join-Path $PSScriptRoot 'OhMyAntigravity-1.4.3-win-x64-setup.exe'), [switch]$Silent)
$ErrorActionPreference = 'Stop'
$taskPriorModules = $env:PSModulePath
$taskPriorTemp = $env:TEMP
$taskPriorTmp = $env:TMP
try {
  $env:PSModulePath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\Modules;$env:ProgramFiles\WindowsPowerShell\Modules"
  $taskInstaller = [IO.Path]::GetFullPath($Installer)
  if (-not [IO.File]::Exists($taskInstaller)) { throw "Installer not found: $taskInstaller" }
  $taskTempRoot = [IO.Path]::Combine([Environment]::GetFolderPath('LocalApplicationData'), 'OhMyAntigravity', 'InstallerTemp')
  $taskTemp = [IO.Path]::Combine($taskTempRoot, [Guid]::NewGuid().ToString('N'))
  [IO.Directory]::CreateDirectory($taskTemp) | Out-Null
  $taskProbe = [IO.Path]::Combine($taskTemp, 'write-check.txt')
  [IO.File]::WriteAllText($taskProbe, 'writable')
  [IO.File]::Delete($taskProbe)
  $env:TEMP = $taskTemp
  $env:TMP = $taskTemp
  $taskArguments = @('/NORESTART', ('/LOG="' + [IO.Path]::Combine($taskTempRoot, 'setup.log') + '"'))
  $taskStart = @{FilePath=$taskInstaller; ArgumentList=$taskArguments; PassThru=$true; Wait=$true}
  if ($Silent) {
    $taskStart.ArgumentList += '/VERYSILENT'
    $taskStart.ArgumentList += '/SUPPRESSMSGBOXES'
    $taskStart.WindowStyle = 'Hidden'
  }
  $taskProcess = Start-Process @taskStart
  exit $taskProcess.ExitCode
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
} finally {
  $env:PSModulePath = $taskPriorModules
  $env:TEMP = $taskPriorTemp
  $env:TMP = $taskPriorTmp
}
