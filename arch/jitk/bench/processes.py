"""Kill only an owned process and its current descendants, including new sessions."""
import os
import signal
import subprocess
import time

def descendants(pid):
    rows = subprocess.check_output(['/bin/ps', '-axo', 'pid=,ppid='], text=True, timeout=5)
    edges = [tuple(map(int, line.split())) for line in rows.splitlines() if line.strip()]
    owned = {pid}
    while True:
        more = {child for child, parent in edges if parent in owned}
        if more <= owned: return owned - {pid}
        owned |= more

def kill_descendants(pid):
    children = descendants(pid)
    for child in children:
        try: os.kill(child, signal.SIGKILL)
        except (ProcessLookupError, PermissionError): pass
    # Let the still-living parent reap children before its own termination.
    if children: time.sleep(.2)
