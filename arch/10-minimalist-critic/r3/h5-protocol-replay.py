#!/usr/bin/env python3
"""Delegate 03's exact hostile suite to a frozen v2 production VMM/image pair."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys

AREA = Path(__file__).resolve().parent
PROTOCOL = Path('/tmp/jitk-10/h2-01/jitk/protocol')
BINARY = '/tmp/jitk-10/h5-resource/jitk-vmm'
IMAGE = '/tmp/jitk-10/h5-resource/kernel.bin'
watchdog = str(PROTOCOL / 'watchdog.py')
env = dict(os.environ, JITK_VMM=BINARY, JITK_IMAGE=IMAGE, JITK_VMM_CLI='01-vmm', JITK_VM_N='30')
data = {'started_utc': datetime.now(timezone.utc).isoformat(),
        'uptime_before': subprocess.check_output(['uptime'], text=True).strip(),
        'vmm_sha256': hashlib.sha256(Path(BINARY).read_bytes()).hexdigest(),
        'image_sha256': hashlib.sha256(Path(IMAGE).read_bytes()).hexdigest(),
        'scope': 'Unmodified owner03 hostile runner, 30/case, frozen v2 production VMM and image; no real tools or credentials.'}
log = AREA / 'h5-protocol-replay.log'
with log.open('w') as stream:
    p = subprocess.Popen(['/tmp/jitk-09/node-real', str(PROTOCOL / 'hostile/run.mjs')],
                         env=env, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        data['exit_code'] = p.wait(timeout=600)
    except subprocess.TimeoutExpired:
        os.killpg(p.pid, signal.SIGKILL)
        p.wait()
        data.update(exit_code=124, timed_out=True)

def owned_children():
    rows = subprocess.check_output(['ps', '-axo', 'pid=,command='], text=True).splitlines()
    found = []
    for row in rows:
        pid, command = row.strip().split(None, 1)
        if command.startswith(BINARY + ' ') or (watchdog in command and command.startswith('/usr/bin/python3 ')):
            found.append(int(pid))
    return found

left = owned_children()
data['cleanup_pids'] = left
for pid in left:
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
data['children_after'] = owned_children()
result = PROTOCOL / 'hostile/results.json'
if data['exit_code'] == 0 and result.is_file():
    destination = AREA / 'h5-protocol-v2-results.json'
    shutil.copyfile(result, destination)
    cases = json.loads(destination.read_text())['cases']
    data.update(cases=len(cases), passed=sum(c['pass'] for c in cases), failed=sum(c['fail'] for c in cases),
                results_sha256=hashlib.sha256(destination.read_bytes()).hexdigest())
data['finished_utc'] = datetime.now(timezone.utc).isoformat()
data['uptime_after'] = subprocess.check_output(['uptime'], text=True).strip()
(AREA / 'h5-protocol-replay.json').write_text(json.dumps(data, indent=2) + '\n')
print(json.dumps(data, indent=2))
sys.exit(0 if data['exit_code'] == 0 and not data['children_after'] and data.get('passed') == 570 else 1)
