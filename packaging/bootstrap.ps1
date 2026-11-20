param([string]$Installer, [string]$AppPath, [string]$ErrorFile)
$ErrorActionPreference = 'Stop'
try {
  $taskHash = (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash
  if ($taskHash -ne '44AEA1C00F3B347FD60AB7291D267DBB04A5080F6C3212A8A31CF1426DDF86CB') { throw 'Official installer checksum mismatch.' }
  $taskSignature = Get-AuthenticodeSignature -LiteralPath $Installer
  if ($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch 'Google LLC') { throw 'The official Google installer signature could not be verified.' }
  $taskProcess = Start-Process -FilePath $Installer -ArgumentList "/S /D=$AppPath" -WindowStyle Hidden -PassThru -Wait
  if ($taskProcess.ExitCode -ne 0) { throw "Official installer failed: $($taskProcess.ExitCode)." }
  if (-not (Test-Path -LiteralPath (Join-Path $AppPath 'resources\app.asar'))) { throw 'Official installation was not found at the selected directory.' }
  exit 0
} catch {
  [IO.File]::WriteAllText($ErrorFile, $_.Exception.Message, [Text.UTF8Encoding]::new($false))
  exit 1
}
