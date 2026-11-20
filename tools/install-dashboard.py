"""Run the upstream installer with a narrow Windows EXDEV workaround."""
import importlib.util
import os
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = root / 'integrations/antigrative-dashboard/manage.py'
original_replace = os.replace


def windows_replace(source, target, *args, **kwargs):
    try:
        return original_replace(source, target, *args, **kwargs)
    except OSError as error:
        if os.name != 'nt' or error.winerror != 17 or args or kwargs:
            raise
        # This user's encrypted Windows directories reject some same-folder
        # renames. Only regular files in the identical directory may fall back.
        source, target = Path(source), Path(target)
        if source.parent.resolve() != target.parent.resolve() or not source.is_file():
            raise
        content = source.read_bytes()
        shutil.copyfile(source, target)
        if target.read_bytes() != content:
            raise RuntimeError('Configuration copy verification failed')
        source.unlink()


os.replace = windows_replace
spec = importlib.util.spec_from_file_location('dashboard_manager', source)
manager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manager)
manager.install()
