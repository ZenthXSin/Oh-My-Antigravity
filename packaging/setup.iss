#define ProductVersion "1.4.6"
[Setup]
AppId={{94F84883-63A1-4512-ABCC-B47B8BE32DC1}
AppName=Oh My Antigravity
AppVersion={#ProductVersion}
AppPublisher=Oh My Antigravity Community
DefaultDirName={localappdata}\AntigravityCustom
DefaultGroupName=Oh My Antigravity
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=OhMyAntigravity-1.4.6-win-x64-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
CloseApplications=no
RestartApplications=no
UninstallDisplayName=Oh My Antigravity
LicenseFile=distribution-license.txt
InfoBeforeFile=install-info.txt

[Languages]
Name: "chinesesimp"; MessagesFile: "ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "stage\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "preflight.ps1"; Flags: dontcopy
Source: "bootstrap.ps1"; Flags: dontcopy
Source: "downloads\Antigravity-2.33.0-x64.exe"; Flags: dontcopy nocompression

[Icons]
Name: "{group}\Antigravity 增强版"; Filename: "{code:GetHost}\Antigravity.exe"; Parameters: "--disable-gpu --remote-debugging-port=0 --remote-debugging-address=127.0.0.1"; WorkingDir: "{code:GetHost}"
Name: "{group}\卸载增强包"; Filename: "{uninstallexe}"

[Code]
var
  HostPage: TInputDirWizardPage;
  HostDirectory: String;
  InstallFailed: Boolean;

function GetHost(Param: String): String;
begin
  Result := HostDirectory;
end;

procedure InitializeWizard;
begin
  HostPage := CreateInputDirPage(wpWelcome, '选择 Antigravity 安装目录',
    '本增强包适用于 Antigravity 2.33.0',
    '首次安装会自动内置 Antigravity。默认无需账号或提供商即可进入本地工作区；已有接入和会话配置保留。', False, '');
  HostPage.Add('Antigravity 安装目录：');
  HostDirectory := ExpandConstant('{localappdata}\Programs\antigravity');
  if ExpandConstant('{param:HOST|}') <> '' then HostDirectory := ExpandConstant('{param:HOST|}');
  HostPage.Values[0] := HostDirectory;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var ExitCode: Integer; ErrorText: AnsiString; NativeInstaller: String;
begin
  HostDirectory := HostPage.Values[0];
  if not FileExists(HostDirectory + '\resources\app.asar') then begin
    ExtractTemporaryFile('Antigravity-2.33.0-x64.exe');
    NativeInstaller := ExpandConstant('{tmp}\Antigravity-2.33.0-x64.exe');
    ExtractTemporaryFile('bootstrap.ps1');
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\bootstrap.ps1') + '" -Installer "' + NativeInstaller + '" -AppPath "' + HostDirectory + '" -ErrorFile "' + ExpandConstant('{tmp}\preflight-error.txt') + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then begin
      Result := '无法启动官方安装程序。'; Exit;
    end;
    if ExitCode <> 0 then begin
      if LoadStringFromFile(ExpandConstant('{tmp}\preflight-error.txt'), ErrorText) then Result := UTF8Decode(ErrorText)
      else Result := '官方安装失败，请重试。';
      Exit;
    end;
  end;
  ExtractTemporaryFile('preflight.ps1');
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\preflight.ps1') + '" -AppPath "' + HostDirectory + '" -PackagePath "' + ExpandConstant('{app}') + '" -ErrorFile "' + ExpandConstant('{tmp}\preflight-error.txt') + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
    Result := '无法检查 Antigravity 状态。';
  if ExitCode <> 0 then begin
    if LoadStringFromFile(ExpandConstant('{tmp}\preflight-error.txt'), ErrorText) then
      Result := UTF8Decode(ErrorText)
    else Result := '请先完全退出 Antigravity，确认目录后重试。';
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var ExitCode: Integer; ErrorText: AnsiString; Arguments: String;
begin
  if CurStep = ssPostInstall then begin
    InstallFailed := True;
    Arguments := '"' + ExpandConstant('{app}\installer\install.py') + '" install --app-path "' + HostDirectory + '"';
    if ExpandConstant('{param:PROFILE_HOME|}') <> '' then
      Arguments := Arguments + ' --profile-home "' + ExpandConstant('{param:PROFILE_HOME|}') + '"';
    if not Exec(ExpandConstant('{app}\runtime\python\python.exe'),
      Arguments,
      ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode) then
      RaiseException('无法启动增强包安装器。');
    if ExitCode <> 0 then begin
      if LoadStringFromFile(ExpandConstant('{app}\install-error.txt'), ErrorText) then
        RaiseException(UTF8Decode(ErrorText))
      else RaiseException('安装未完成，请查看安装目录中的 install-error.txt。');
    end;
    InstallFailed := False;
  end;
end;

function GetCustomSetupExitCode: Integer;
begin
  if InstallFailed then Result := 1 else Result := 0;
end;

function InitializeUninstall: Boolean;
var ExitCode: Integer; ErrorText: AnsiString;
begin
  Result := Exec(ExpandConstant('{app}\runtime\python\python.exe'),
    '"' + ExpandConstant('{app}\installer\install.py') + '" uninstall',
    ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode);
  if ExitCode <> 0 then begin
    Result := False;
    if LoadStringFromFile(ExpandConstant('{app}\install-error.txt'), ErrorText) then
      MsgBox(UTF8Decode(ErrorText), mbError, MB_OK)
    else MsgBox('撤回失败，已保留增强包文件。请先退出 Antigravity 后重试。', mbError, MB_OK);
  end;
end;
