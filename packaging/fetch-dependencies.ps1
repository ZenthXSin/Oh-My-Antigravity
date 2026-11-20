param([switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1')
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1')
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Management\Microsoft.PowerShell.Management.psd1')
$taskPackage = $PSScriptRoot
$taskDownloads = Join-Path $taskPackage 'downloads'
$taskDependencies = @(
  @{Name='node.exe'; Url='https://nodejs.org/dist/v24.14.1/win-x64/node.exe'; Hash='58E74BF02FC5BBACC41DCB8BEF089961CD5BDDD37830B87784E4FC624D145D1F'; Signer='OpenJS Foundation'},
  @{Name='Antigravity-2.33.0-x64.exe'; Url='https://storage.googleapis.com/antigravity-public/antigravity-hub/2.33.0-4731201358004224/windows-x64/Antigravity-x64.exe'; Hash='44AEA1C00F3B347FD60AB7291D267DBB04A5080F6C3212A8A31CF1426DDF86CB'; Signer='Google LLC'},
  @{Name='python-3.12.10-embed-amd64.zip'; Url='https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip'; Hash='4ACBED6DD1C744B0376E3B1CF57CE906F9DC9E95E68824584C8099A63025A3C3'},
  @{Name='innosetup-6.7.4.exe'; Url='https://files.jrsoftware.org/is/6/innosetup-6.7.4.exe'; Hash='A549929319F9120716677C685535CA4671E4B937B5FDC87E2585F32D8EB30E8C'; Signer='Pyrsys B.V.'},
  @{Name='NODE-LICENSE.txt'; Url='https://raw.githubusercontent.com/nodejs/node/v24.14.1/LICENSE'; Hash='4573185D56580DA2B890BA34A85A409257640F1C5632EADE4300137266194D18'}
)
if (-not $VerifyOnly) { New-Item -ItemType Directory -Path $taskDownloads -Force | Out-Null }
foreach ($taskDependency in $taskDependencies) {
  $taskFile = Join-Path $taskDownloads $taskDependency.Name
  if (-not (Test-Path -LiteralPath $taskFile)) {
    if ($VerifyOnly) { throw "Missing dependency: $taskFile. Run packaging/fetch-dependencies.ps1." }
    Invoke-WebRequest -UseBasicParsing -Uri $taskDependency.Url -OutFile $taskFile
  }
  if ((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash -ne $taskDependency.Hash) { throw "Checksum mismatch: $($taskDependency.Name)" }
  if ($taskDependency.Signer) {
    $taskSignature = Get-AuthenticodeSignature -LiteralPath $taskFile
    if ($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch [regex]::Escape($taskDependency.Signer)) { throw "Signature verification failed: $($taskDependency.Name)" }
  }
}
if (-not $VerifyOnly) {
  $taskCompiler = Join-Path $taskPackage 'inno\ISCC.exe'
  if (-not (Test-Path -LiteralPath $taskCompiler)) {
    $taskInno = Join-Path $taskDownloads 'innosetup-6.7.4.exe'
    $taskInnoDir = Join-Path $taskPackage 'inno'
    $taskProcess = Start-Process -FilePath $taskInno -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER /DIR=`"$taskInnoDir`" /NOICONS" -WindowStyle Hidden -Wait -PassThru
    if ($taskProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $taskCompiler)) { throw 'Inno Setup installation failed.' }
  }
}
Write-Output 'Pinned distribution dependencies verified.'
