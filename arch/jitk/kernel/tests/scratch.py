"""Disposable build trees; explicit overrides survive, always writable on exit."""
import atexit
import os
from pathlib import Path
import shutil
import signal
import tempfile


def writable(root):
    for directory, dirs, files in os.walk(root):
        for path in [Path(directory), *(Path(directory) / name for name in files)]:
            if not path.is_symlink():
                path.chmod(path.stat().st_mode | 0o700)


def workspace(variable, name):
    override = os.environ.get(variable)
    root = Path(override).resolve() if override else Path(tempfile.mkdtemp(prefix=f'jitk-{name}-'))
    root.mkdir(parents=True, exist_ok=True)

    def cleanup():
        if root.exists():
            writable(root)
            if not override:
                shutil.rmtree(root)

    atexit.register(cleanup)
    # Python's normal exit runs cleanup on SIGTERM as well as exceptions/Ctrl-C.
    signal.signal(signal.SIGTERM, lambda signum, frame: __import__('sys').exit(128 + signum))
    return root
