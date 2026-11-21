"""Allow native storage's existing fallback for Windows EXDEV replacements."""
import json
import os
from hashlib import sha256
from pathlib import Path
from asar import Archive

ROOT = Path(__file__).resolve().parent.parent
app = Path(os.environ['AGY_APP_ASAR'])
manifest = ROOT / 'backups/2.33.0/manifest.json'
state = json.loads(manifest.read_text(encoding='utf8'))
if sha256(app.read_bytes()).hexdigest() != state['patched_sha256']:
    raise RuntimeError('Native archive changed; refusing to patch an unknown installation.')
archive = Archive(app)
source = archive.read('dist/storage.js').decode('utf8')
marker = '// OH_MY_ANTIGRAVITY_STORAGE_EXDEV_V1'
if marker not in source:
    anchor = '                const code = errnoCode(e);\n                if (code === undefined || !REPLACE_REFUSED_CODES.has(code))'
    if source.count(anchor) != 1:
        raise RuntimeError('Native storage fallback changed.')
    source = source.replace(anchor, '                const code = errnoCode(e);\n                ' + marker + "\n                if (process.platform === 'win32' && code === 'EXDEV') return false;\n                if (code === undefined || !REPLACE_REFUSED_CODES.has(code))", 1)
    app.write_bytes(archive.rewrite({'dist/storage.js': source.encode('utf8')}))
    state['patched_sha256'] = sha256(app.read_bytes()).hexdigest()
    state['changed_entries'] = list(dict.fromkeys([*state['changed_entries'], 'dist/storage.js']))
    manifest.write_text(json.dumps(state, indent=2), encoding='utf8')

# The enhancement is tied to an audited host version. Native quit-time
# installation would replace its integration before a compatible update exists.
archive = Archive(app)
updater = archive.read('dist/updater.js').decode('utf8')
update_marker = '// OH_MY_ANTIGRAVITY_MANAGED_UPDATES_V1'
if update_marker not in updater:
    update_anchor = '    electron_updater_1.autoUpdater.autoInstallOnAppQuit = electron_1.app.isPackaged;'
    if updater.count(update_anchor) != 1:
        raise RuntimeError('Native update installation policy changed.')
    updater = updater.replace(update_anchor, '    ' + update_marker + '\n    electron_updater_1.autoUpdater.autoInstallOnAppQuit = false;', 1)
    app.write_bytes(archive.rewrite({'dist/updater.js': updater.encode('utf8')}))
    state['patched_sha256'] = sha256(app.read_bytes()).hexdigest()
    state['changed_entries'] = list(dict.fromkeys([*state['changed_entries'], 'dist/updater.js']))
    manifest.write_text(json.dumps(state, indent=2), encoding='utf8')
