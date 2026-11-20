"""安装中文前端加载补丁，保留版本绑定的原件和明确的撤回入口。"""
import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from asar import Archive

ROOT = Path(__file__).resolve().parent.parent
APP = Path(os.environ.get('AGY_APP_ASAR', str(Path(os.environ['LOCALAPPDATA']) / 'Programs/antigravity/resources/app.asar')))
CONFIG = Path.home() / '.gemini/antigravity-custom/config.json'
BACKUP = ROOT / 'backups/2.33.0/app.asar'
MANIFEST = ROOT / 'backups/2.33.0/manifest.json'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def enable_config():
    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    config = json.loads(CONFIG.read_text(encoding='utf8')) if CONFIG.exists() else {}
    config.update({'version': '2.33.0', 'locale_enabled': True, 'web_bundle_path': str(ROOT / 'web')})
    CONFIG.write_text(json.dumps(config, indent=2), encoding='utf8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    current = APP.read_bytes()
    # Adopt this same patch's verified backup when a distributable installer
    # moves the web bundle from the development directory to its own directory.
    if not MANIFEST.exists() and CONFIG.exists():
        old_config = json.loads(CONFIG.read_text(encoding='utf8'))
        old_root = Path(old_config.get('web_bundle_path', str(ROOT / 'web'))).parent
        old_manifest = old_root / 'backups/2.33.0/manifest.json'
        old_backup = old_root / 'backups/2.33.0/app.asar'
        if old_manifest.exists() and old_backup.exists():
            info = json.loads(old_manifest.read_text(encoding='utf8'))
            original = old_backup.read_bytes()
            if digest(current) == info['patched_sha256'] and digest(original) == info['original_sha256']:
                BACKUP.parent.mkdir(parents=True, exist_ok=True)
                BACKUP.write_bytes(original)
                MANIFEST.write_text(json.dumps(info, indent=2), encoding='utf8')
    if args.restore:
        info = json.loads(MANIFEST.read_text(encoding='utf8'))
        if digest(current) != info['patched_sha256']:
            raise RuntimeError('程序已更新或存在其他改动，拒绝覆盖未知版本')
        original = BACKUP.read_bytes()
        if digest(original) != info['original_sha256']:
            raise RuntimeError('备份完整性校验失败')
        APP.write_bytes(original)
        if CONFIG.exists():
            config = json.loads(CONFIG.read_text(encoding='utf8'))
            config['locale_enabled'] = False
            CONFIG.write_text(json.dumps(config, indent=2), encoding='utf8')
        print('中文化补丁已撤回')
        return
    if MANIFEST.exists():
        info = json.loads(MANIFEST.read_text(encoding='utf8'))
        if digest(current) == info['patched_sha256']:
            enable_config()
            print('中文化补丁已安装并启用')
            return
        if digest(current) != info['original_sha256']:
            raise RuntimeError('已有补丁但当前归档不同，需检查更新或其他改动')
    archive = Archive(APP)
    package = json.loads(archive.read('package.json'))
    if package['version'] != '2.33.0':
        raise RuntimeError('此补丁只验证了 2.33.0')
    source = archive.read('dist/lsDefaults.js').decode('utf8')
    anchor = '        opts.ideVersion,\n'
    if source.count(anchor) != 1:
        raise RuntimeError('原生启动参数结构不匹配')
    helper = '''
function localChineseBundleArgs(version) {
    if (process.platform !== 'win32' || version !== '2.33.0') return [];
    try {
        const fs = require('fs');
        const path = require('path');
        const file = path.join(require('os').homedir(), '.gemini', 'antigravity-custom', 'config.json');
        const config = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (config.locale_enabled !== true || config.version !== version || typeof config.web_bundle_path !== 'string') return [];
        if (!fs.existsSync(path.join(config.web_bundle_path, 'main.js'))) return [];
        return ['--web_bundle_path', config.web_bundle_path];
    } catch { return []; }
}
'''
    source += helper
    source = source.replace(anchor, anchor + '        ...localChineseBundleArgs(opts.ideVersion),\n')
    replacements = {'dist/lsDefaults.js': source.encode('utf8')}
    patched = archive.rewrite(replacements)
    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    if BACKUP.exists() and BACKUP.read_bytes() != current:
        raise RuntimeError('已有不同原件备份，拒绝覆盖')
    BACKUP.write_bytes(current)
    temp = BACKUP.parent / 'patched.asar'
    temp.write_bytes(patched)
    check = Archive(temp)
    for name, entry in archive.entries():
        if entry.get('unpacked') or 'link' in entry:
            continue
        expected = replacements.get(name, archive.read(name))
        if check.read(name) != expected:
            raise RuntimeError('归档校验失败：' + name)
    enable_config()
    APP.write_bytes(patched)
    MANIFEST.write_text(json.dumps({'version': package['version'], 'original_sha256': digest(current), 'patched_sha256': digest(patched), 'changed_entries': list(replacements)}, indent=2), encoding='utf8')
    print('已安装中文前端加载补丁；原件位于 ' + str(BACKUP))


if __name__ == '__main__':
    main()
