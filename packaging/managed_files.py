"""Back up and restore only the files owned by this enhancement."""
import hashlib
import json
from pathlib import Path
import shutil


def digest(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def read_json(file):
    return json.loads(Path(file).read_text(encoding='utf-8-sig')) if Path(file).exists() else {}


def write_json(file, value):
    file = Path(file)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf8')


class ManagedFiles:
    def __init__(self, root, targets):
        self.root = Path(root)
        self.targets = targets
        self.receipt_file = self.root / 'backups/install-receipt.json'
        self.receipt = read_json(self.receipt_file)
        if self.receipt.get('status') == 'restored':
            self.receipt = {}

    def begin(self):
        if self.receipt:
            if self.receipt['status'] != 'installed':
                raise RuntimeError('前次安装未完成，请先运行 installer/install.py recover。')
            self.validate_plugins()
            self.receipt['status'] = 'updating'
        else:
            groups = {}
            for name, target in self.targets.items():
                target = Path(target)
                files = list(target.rglob('*')) if target.is_dir() else [target] if target.exists() else []
                old = {}
                for file in files:
                    if not file.is_file() or any(p in {'.data','data','__pycache__','history-v1','usage-v1','sdk'} for p in file.parts):
                        continue
                    if file.is_symlink():
                        raise RuntimeError('不覆盖链接文件：' + str(file))
                    relative = str(file.relative_to(target)) if target.is_dir() else '.'
                    backup = self.root / 'backups/files' / name / (relative if relative != '.' else 'original')
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(file, backup)
                    old[relative] = digest(file)
                groups[name] = {'target':str(target),'directory':target.is_dir() or name.startswith('plugin-'),'original':old}
            self.receipt = {'status':'installing','groups':groups}
        write_json(self.receipt_file, self.receipt)

    def finish(self):
        for group in self.receipt['groups'].values():
            target = Path(group['target'])
            files = list(target.rglob('*')) if group['directory'] else [target]
            group['installed'] = {str(f.relative_to(target)) if group['directory'] else '.':digest(f)
                                  for f in files if f.is_file() and not any(p in {'.data','data','__pycache__','history-v1','usage-v1','sdk'} for p in f.parts)}
        self.receipt['status'] = 'installed'
        write_json(self.receipt_file, self.receipt)

    def validate_plugins(self):
        for name, group in self.receipt['groups'].items():
            if not name.startswith('plugin-'):
                continue
            for relative, expected in group.get('installed', {}).items():
                file = Path(group['target']) / relative
                if file.exists() and digest(file) != expected:
                    raise RuntimeError('插件文件安装后被修改，保留文件以便处理：' + str(file))

    def restore(self):
        self.validate_plugins()
        for name, group in self.receipt['groups'].items():
            target = Path(group['target'])
            if not group['directory'] and target.exists() and group.get('installed', {}).get('.') != digest(target):
                continue  # Preserve subsequent changes to user preferences.
            for relative, expected in group.get('installed', {}).items():
                file = target / relative if group['directory'] else target
                if relative not in group['original'] and file.is_file() and digest(file) == expected:
                    file.unlink()
            for relative, expected in group['original'].items():
                backup = self.root / 'backups/files' / name / (relative if relative != '.' else 'original')
                if digest(backup) != expected:
                    raise RuntimeError('备份校验失败：' + str(backup))
                file = target / relative if group['directory'] else target
                file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(backup, file)
            if group['directory'] and target.exists():
                for directory in sorted((p for p in target.rglob('*') if p.is_dir()), key=lambda p:len(p.parts), reverse=True):
                    if not any(directory.iterdir()):
                        directory.rmdir()
                if not any(target.iterdir()):
                    target.rmdir()
        self.receipt['status'] = 'restored'
        write_json(self.receipt_file, self.receipt)
