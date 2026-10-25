#!/usr/bin/env python3
"""Out-of-process watchdog. Parent sends +PID SECONDS / -PID. EOF kills all."""
import os, select, signal, sys, time
from processes import kill_descendants
owned = {}
def kill(pid):
    kill_descendants(pid)
    try: os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError: pass
    except PermissionError:
        try: os.kill(pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError): pass
buf = b''
while True:
    now = time.monotonic()
    for pid, deadline in list(owned.items()):
        if deadline <= now:
            kill(pid); owned.pop(pid, None)
    timeout = max(0, min(1, min(owned.values(), default=now+1)-now))
    if not select.select([0], [], [], timeout)[0]: continue
    data = os.read(0, 65536)
    if not data:
        for pid in owned: kill(pid)
        break
    buf += data
    while b'\n' in buf:
        line, buf = buf.split(b'\n', 1)
        if line.startswith(b'+'):
            pid, seconds = line[1:].split(); owned[int(pid)] = time.monotonic()+float(seconds)
        elif line.startswith(b'-'): owned.pop(int(line[1:]), None)
