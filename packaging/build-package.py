"""Stage an explicit distribution allowlist; no user profiles or native app assets."""
import hashlib
import argparse
import json
from pathlib import Path
import shutil
import os
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = ROOT / 'packaging'
STAGE = PACKAGE / 'stage'
EXCLUDED = {'__pycache__','.git','.data','data','sdk','tests','tools','history-v1','usage-v1'}


def copy(source, target, excluded=EXCLUDED):
    if source.is_dir():
        shutil.copytree(source, target, dirs_exist_ok=True,
                        ignore=lambda directory, names:[n for n in names if n in excluded or n.endswith(('.pyc','.log','.map'))])
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--node', default=os.environ.get('AGY_NODE_EXE') or
                        (str(PACKAGE / 'downloads/node.exe') if (PACKAGE / 'downloads/node.exe').exists() else shutil.which('node')))
    parser.add_argument('--iscc', default=os.environ.get('AGY_ISCC_EXE') or str(PACKAGE / 'inno/ISCC.exe'))
    args = parser.parse_args()
    subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',
                    str(PACKAGE / 'fetch-dependencies.ps1'),'-VerifyOnly'],check=True)
    if STAGE.exists() and not args.refresh:
        raise RuntimeError('Stage already exists; use a fresh staging directory for a new release.')
    STAGE.mkdir(parents=True, exist_ok=True)
    for relative in ['tools/asar.py','tools/install-locale.py','tools/install-dashboard.py','tools/install-channels.py',
                     'tools/ui-catalog.mjs','tools/build-locale.mjs','tools/locale','frontend','locales']:
        copy(ROOT / relative, STAGE / relative)
    for name in ['install.py','extract-web.py','managed_files.py','preflight.ps1','embedded-web.json']:
        copy(PACKAGE / name, STAGE / 'installer' / name)
    for name in ['acorn','acorn-walk']:
        copy(ROOT / 'node_modules' / name, STAGE / 'node_modules' / name)
    copy(ROOT / 'plugins/agent-workflow-zh', STAGE / 'plugins/agent-workflow-zh')
    copy(ROOT / 'integrations/channel-router', STAGE / 'integrations/channel-router')
    mcp = STAGE / 'plugins/agent-workflow-zh/mcp_config.json'
    mcp.write_text(json.dumps({'mcpServers':{'workflow':{'command':'node','args':['runtime/server.mjs']}}},indent=2),encoding='utf8')
    dashboard = ROOT / 'integrations/antigrative-dashboard'
    for name in ['assets','compat','sidecars','manage.py','plugin.json','LICENSE','README.zh-CN.md','COMPATIBILITY.md']:
        copy(dashboard / name, STAGE / 'integrations/antigrative-dashboard' / name)
    if not args.node:
        raise RuntimeError('Node.js not found; use --node or AGY_NODE_EXE.')
    copy(Path(args.node), STAGE / 'runtime/node/node.exe')
    copy(PACKAGE / 'downloads/NODE-LICENSE.txt', STAGE / 'licenses/NODE-LICENSE.txt')
    copy(dashboard / 'LICENSE', STAGE / 'licenses/DASHBOARD-MIT.txt')
    with zipfile.ZipFile(PACKAGE / 'downloads/python-3.12.10-embed-amd64.zip') as archive:
        archive.extractall(STAGE / 'runtime/python')
    python_paths = STAGE / 'runtime/python/python312._pth'
    python_paths.write_text('python312.zip\n.\n../../installer\n../../tools\n',encoding='ascii')
    copy(STAGE / 'runtime/python/LICENSE.txt', STAGE / 'licenses/PYTHON-LICENSE.txt')
    copy(ROOT / 'LICENSE', STAGE / 'licenses/CUSTOM-MIT.txt')
    copy(PACKAGE / 'install-info.txt', STAGE / 'README.txt')
    (STAGE / 'inspection').mkdir(exist_ok=True)
    inventory = {str(f.relative_to(STAGE)).replace('\\','/'):hashlib.sha256(f.read_bytes()).hexdigest()
                 for f in sorted(STAGE.rglob('*')) if f.is_file() and f.name != 'distribution-manifest.json'}
    (STAGE / 'distribution-manifest.json').write_text(json.dumps({'version':'1.4.0','files':inventory},indent=2),encoding='utf8')
    subprocess.run([args.iscc,'/Qp',str(PACKAGE / 'setup.iss')],check=True)
    output = ROOT / 'dist/OhMyAntigravity-1.4.0-win-x64-setup.exe'
    sha = hashlib.sha256(output.read_bytes()).hexdigest()
    (output.with_suffix('.sha256')).write_text(sha + '  ' + output.name + '\n',encoding='ascii')
    print(json.dumps({'file':str(output),'bytes':output.stat().st_size,'sha256':sha,'payload_files':len(inventory)},indent=2))


if __name__ == '__main__':
    main()
