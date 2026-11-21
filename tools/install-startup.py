"""Apply native storage compatibility and disable the bundled host updater."""
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

# The enhancement is tied to an audited host version. Host updates are supplied
# through the enhancement installer, so native checks and installation stay off.
archive = Archive(app)
updater = archive.read('dist/updater.js').decode('utf8')
update_marker = '// OH_MY_ANTIGRAVITY_MANAGED_UPDATES_V2'
if update_marker not in updater:
    replacements = [
        ('function setAutoUpdateChecking(enabled) {', '// The last update state',
         'function setAutoUpdateChecking(enabled) {\n    return false;\n}\n'),
        ('function initAutoUpdater(isHeadless, settingsService) {', 'function checkForUpdates(',
         'function initAutoUpdater(isHeadless, settingsService) {\n'
         '    ' + update_marker + '\n'
         '    electron_updater_1.autoUpdater.autoDownload = false;\n'
         '    electron_updater_1.autoUpdater.autoInstallOnAppQuit = false;\n'
         '    exports.updateActions[MenuUpdateStep.CheckForUpdates] = undefined;\n'
         '    exports.updateActions[MenuUpdateStep.RestartToUpdate] = undefined;\n'
         '    updateMenuState(MenuUpdateStep.CheckForUpdates);\n'
         '    broadcastState({ type: types_1.UpdateState.Idle });\n'
         "    console.log('[AutoUpdater] Native updates disabled by Oh My Antigravity.');\n"
         '}\n'),
        ('function checkForUpdates(isManual = false) {', '/**\n * Builds the update status',
         'function checkForUpdates(isManual = false) {\n    return false;\n}\n'
         'function quitAndInstall() {\n    return false;\n}\n'),
        ('function applyHostUpdate() {', '/**\n * Electron native quitAndInstall',
         'function applyHostUpdate() {\n    return false;\n}\n'),
    ]
    for begin, end, replacement in replacements:
        if updater.count(begin) != 1 or updater.count(end) != 1:
            raise RuntimeError('Native updater structure changed: ' + begin)
        first = updater.index(begin)
        last = updater.index(end, first)
        updater = updater[:first] + replacement + updater[last:]
    app.write_bytes(archive.rewrite({'dist/updater.js': updater.encode('utf8')}))
    state['patched_sha256'] = sha256(app.read_bytes()).hexdigest()
    state['changed_entries'] = list(dict.fromkeys([*state['changed_entries'], 'dist/updater.js']))
    manifest.write_text(json.dumps(state, indent=2), encoding='utf8')

# Renderer IPC otherwise marks updates ready and calls electron-updater directly,
# bypassing the policy in updater.js even when no update check has run.
archive = Archive(app)
ipc = archive.read('dist/ipcHandlers.js').decode('utf8')
ipc_marker = '// OH_MY_ANTIGRAVITY_UPDATE_IPC_V1'
if ipc_marker not in ipc:
    begin = "    // Auto-updater\n    localOnly('updater:apply',"
    end = "    localOnly('updater:get-state',"
    if ipc.count(begin) != 1 or ipc.count(end) != 1:
        raise RuntimeError('Native update IPC handlers changed.')
    first = ipc.index(begin)
    last = ipc.index(end, first)
    replacement = '    ' + ipc_marker + '\n' + (
        "    localOnly('updater:apply', () => (0, updater_1.applyHostUpdate)());\n"
        "    localOnly('updater:quit-and-install', () => (0, updater_1.quitAndInstall)());\n"
    )
    ipc = ipc[:first] + replacement + ipc[last:]
    app.write_bytes(archive.rewrite({'dist/ipcHandlers.js': ipc.encode('utf8')}))
    state['patched_sha256'] = sha256(app.read_bytes()).hexdigest()
    state['changed_entries'] = list(dict.fromkeys([*state['changed_entries'], 'dist/ipcHandlers.js']))
    manifest.write_text(json.dumps(state, indent=2), encoding='utf8')
