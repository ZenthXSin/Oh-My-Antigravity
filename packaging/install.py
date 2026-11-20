"""Compose native localization, Agent plugin and upstream Dashboard installation."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(ROOT / 'tools'))
from managed_files import ManagedFiles, read_json, write_json
from asar import Archive


def run(arguments, environment):
    result = subprocess.run([str(a) for a in arguments], cwd=ROOT, env=environment,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf8',
                            creationflags=subprocess.CREATE_NO_WINDOW)
    with (ROOT / 'install.log').open('a', encoding='utf8') as log:
        log.write(result.stdout)
    if result.returncode:
        raise RuntimeError(result.stdout[-3500:])


def manager(environment):
    os.environ.update(environment)
    spec = importlib.util.spec_from_file_location('dashboard_manager', ROOT / 'integrations/antigrative-dashboard/manage.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def install_agent(home, node):
    target = home / '.gemini/config/plugins/agent-workflow-zh'
    shutil.copytree(ROOT / 'plugins/agent-workflow-zh', target, dirs_exist_ok=True)
    mcp = read_json(target / 'mcp_config.json')
    mcp['mcpServers']['workflow'] = {'command':str(node),'args':[str(target / 'runtime/server.mjs')]}
    write_json(target / 'mcp_config.json', mcp)
    hook_command = '"' + str(node) + '" "' + str(target / 'runtime/hook.mjs') + '"'
    hooks = read_json(target / 'hooks.json')
    hooks['agent-workflow']['PreInvocation'][0]['command'] = hook_command
    hooks['agent-workflow']['PostToolUse'][0]['hooks'][0]['command'] = hook_command
    hooks['agent-workflow']['Stop'][0]['command'] = hook_command
    write_json(target / 'hooks.json', hooks)
    config_file = home / '.gemini/config/config.json'
    config = read_json(config_file)
    config.setdefault('plugins', {}).setdefault('agent-workflow-zh', {})['enabled'] = True
    write_json(config_file, config)


def main():
    for note in ['install-error.txt','install-result.txt']:
        (ROOT / note).unlink(missing_ok=True)
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['install','uninstall','recover'])
    parser.add_argument('--app-path')
    parser.add_argument('--profile-home')
    args = parser.parse_args()
    state_file = ROOT / 'backups/application.json'
    state = read_json(state_file)
    profile = args.profile_home or state.get('profile_home')
    if profile:
        os.environ.update(USERPROFILE=profile, APPDATA=str(Path(profile) / 'AppData/Roaming'),
                          LOCALAPPDATA=str(Path(profile) / 'AppData/Local'))
    home = Path.home()
    app = Path(args.app_path or state.get('app_path') or home / 'AppData/Local/Programs/antigravity')
    archive = app / 'resources/app.asar'
    node = ROOT / 'runtime/node/node.exe'
    environment = {**os.environ,'AGY_APP_ASAR':str(archive),'AG_PULSE_APP_ASAR':str(archive),
                   'PYTHONUTF8':'1','PATH':str(node.parent) + os.pathsep + os.environ.get('PATH','')}
    run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',ROOT / 'installer/preflight.ps1','-AppPath',app], environment)
    config_file = home / '.gemini/config/config.json'
    targets = {'plugin-agent':home / '.gemini/config/plugins/agent-workflow-zh',
               'plugin-dashboard':home / '.gemini/config/plugins/antigravity-pulse',
               'locale':home / '.gemini/antigravity-custom/config.json',
               'dashboard-settings':Path(os.environ['LOCALAPPDATA']) / 'AntigravityPulse/settings.json',
               'dashboard-preferences':Path(os.environ['LOCALAPPDATA']) / 'AntigravityPulse/preferences.json',
               'plugin-channels':home / '.gemini/config/plugins/oh-my-channels'}
    files = ManagedFiles(ROOT, targets)
    if args.action == 'install':
        version = json.loads(Archive(archive).read('package.json'))['version']
        if version != '2.33.0':
            raise RuntimeError('此增强包仅支持已审核的 Antigravity 2.33.0，当前为 ' + version)
        run([sys.executable,ROOT / 'installer/extract-web.py',app / 'resources/bin/language_server.exe',
             ROOT / 'installer/embedded-web.json',ROOT / 'original-web'], environment)
        run([node,ROOT / 'tools/ui-catalog.mjs'], environment)
        run([node,ROOT / 'tools/build-locale.mjs'], environment)
        if not state:
            config = read_json(config_file)
            plugins = config.get('plugins', {})
            from managed_files import digest
            (ROOT / 'backups').mkdir(exist_ok=True)
            shutil.copy2(archive, ROOT / 'backups/prior-app.asar')
            state = {'app_path':str(app),'profile_home':profile,'prior_app_sha256':digest(archive),
                     'plugin_entries':{n:plugins.get(n) for n in ['agent-workflow-zh','antigravity-pulse','oh-my-channels']}}
            write_json(state_file, state)
        for name in ['agent-workflow-zh','antigravity-pulse','oh-my-channels']:
            if name not in state['plugin_entries']:
                state['plugin_entries'][name]=read_json(config_file).get('plugins',{}).get(name)
        write_json(state_file,state)
        files.begin()
        try:
            install_agent(home, node)
            shutil.copytree(ROOT / 'integrations/channel-router',targets['plugin-channels'] / 'runtime',dirs_exist_ok=True)
            write_json(targets['plugin-channels'] / 'plugin.json',{'name':'oh-my-channels','display_name':'Oh My Antigravity Channels','description':'Native Agent API channel aggregation','version':'1.0.0'})
            config=read_json(config_file)
            config.setdefault('plugins',{}).setdefault('oh-my-channels',{})['enabled']=True
            write_json(config_file,config)
            run([sys.executable,ROOT / 'tools/install-dashboard.py'], environment)
            sidecar = targets['plugin-dashboard'] / 'sidecars/panel/sidecar.json'
            definition = read_json(sidecar)
            definition['command'] = str(node)
            write_json(sidecar, definition)
            preferences = read_json(targets['dashboard-preferences'])
            if not preferences:
                write_json(targets['dashboard-preferences'], {'schema':1,'language':'zh-CN','languageGuideDismissed':True,
                                                            'usageGuideDismissed':False,'speedStyle':'minimal','revision':1})
            run([sys.executable,ROOT / 'tools/install-locale.py'], environment)
            run([sys.executable,ROOT / 'tools/install-channels.py'], environment)
            files.finish()
        except Exception:
            files.finish()
            files.receipt['status'] = 'recovery_required'
            write_json(files.receipt_file, files.receipt)
            state['installed_entries'] = {n:read_json(config_file).get('plugins', {}).get(n) for n in state['plugin_entries']}
            write_json(state_file, state)
            run([sys.executable,ROOT / 'installer/install.py','recover'], environment)
            raise
        state['installed_entries'] = {n:read_json(config_file).get('plugins', {}).get(n) for n in state['plugin_entries']}
        write_json(state_file, state)
        (ROOT / 'install-result.txt').write_text('安装完成：设置 → 通用 → 语言，可选择简体中文或 English。',encoding='utf8')
    else:
        files.validate_plugins()
        manifest = read_json(ROOT / 'backups/2.33.0/manifest.json')
        from managed_files import digest
        allowed = {state['prior_app_sha256']}
        if manifest:
            allowed.add(manifest['patched_sha256'])
        if digest(archive) not in allowed:
            raise RuntimeError('Antigravity 已更新或归档被修改，保留补丁与备份，拒绝覆盖未知程序。')
        prior = ROOT / 'backups/prior-app.asar'
        if digest(prior) != state['prior_app_sha256']:
            raise RuntimeError('原有应用归档备份校验失败。')
        dashboard = manager(environment)
        if state['plugin_entries'].get('antigravity-pulse') is None:
            settings = read_json(targets['dashboard-settings'])
            dashboard.launch_config().remove_desktop_launch(home=home,local=Path(os.environ['LOCALAPPDATA']),managed=settings.get('managedLaunch'))
        shutil.copy2(prior, archive)
        files.restore()
        config = read_json(config_file)
        entries = config.setdefault('plugins', {})
        for name, previous in state['plugin_entries'].items():
            if name in state.get('installed_entries', {}) and entries.get(name) != state['installed_entries'][name]:
                continue
            if previous is None:
                entries.pop(name, None)
            else:
                entries[name] = previous
        write_json(config_file, config)
        (ROOT / 'install-result.txt').write_text('增强包已撤回，用户数据和 Goal 记录保留。',encoding='utf8')
        if args.action == 'uninstall':
            state_file.unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        (ROOT / 'install-error.txt').write_text(str(error), encoding='utf8')
        sys.exit(1)
