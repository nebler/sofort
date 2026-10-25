#!/usr/bin/env python3
"""H1: literal cp -R snapshot, then make build test; preserve exact receipts."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

AREA = Path(__file__).resolve().parents[1]
SOURCE = AREA.parent / 'jitk'
TEMP = Path('/tmp/jitk-10')
DEST = TEMP / 'clean'

def source_inventory(root):
    excluded = {'node_modules', 'target', 'build', 'dist', 'results', 'evidence', 'out',
                '.git', '__pycache__', '.work', '.npm-cache'}
    extensions = {'.rs', '.S', '.c', '.h', '.py', '.js', '.mjs', '.ts', '.sh', '.lua', '.toml', '.ld', '.sb', '.diff'}
    names = {'.READY', 'Makefile', 'Cargo.lock', 'package-lock.json', 'package.json', '.npmrc',
             'slots.json', 'cases.json', 'vectors.json', 'adapter.json', 'release.json', 'Dockerfile'}
    result = {}
    for directory, subdirs, files in os.walk(root):
        subdirs[:] = [name for name in subdirs if name not in excluded and not (Path(directory) / name).is_symlink()]
        for name in files:
            path = Path(directory) / name
            if path.suffix in extensions or name in names or 'payload' in path.parts:
                if path.is_file():
                    result[str(path.relative_to(root))] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result

run_id = sys.argv[1]
assert run_id.replace('-', '').isalnum()
receipt = {'started_utc': datetime.now(timezone.utc).isoformat(),
           'command': 'cp -R arch/jitk /tmp/jitk-10/clean && (cd /tmp/jitk-10/clean && make build test)',
           'markers': {str(p.relative_to(SOURCE)): p.read_text() for p in SOURCE.rglob('.READY')
                       if not set(p.parts) & {'node_modules', 'target'}},
           'uptime_before': subprocess.check_output(['uptime'], text=True).strip()}
TEMP.mkdir(exist_ok=True)
if DEST.exists():
    shutil.rmtree(DEST)
log = AREA / 'r3' / f'h1-{run_id}.log'
started = time.monotonic()
env = dict(os.environ, JITK_KERNEL_CARGO_TARGET_DIR=str(TEMP / 'kernel-target'),
           JITK_VMM_BUILD=str(TEMP / 'vmm'), JITK_TEST_IMAGES=str(TEMP / 'test-images'),
           JITK_WORK=str(TEMP / 'linux'),
           JITK_VMM_BINARY=str(TEMP / 'vmm/jitk-vmm'), CARGO_BUILD_JOBS='2', TMPDIR=str(TEMP))
receipt['overrides'] = {k: env[k] for k in ['JITK_KERNEL_CARGO_TARGET_DIR', 'JITK_VMM_BUILD', 'JITK_TEST_IMAGES', 'JITK_VMM_BINARY', 'CARGO_BUILD_JOBS']}
with log.open('w') as stream:
    receipt['source_before_copy'] = source_inventory(SOURCE)
    try:
        copy = subprocess.run(['cp', '-R', str(SOURCE), str(DEST)], stdout=stream, stderr=subprocess.STDOUT, timeout=600)
        receipt['copy_exit'] = copy.returncode
    except subprocess.TimeoutExpired:
        receipt.update(copy_exit=124, copy_timed_out=True)
    if receipt['copy_exit'] == 0:
        receipt['source_after_copy'] = source_inventory(SOURCE)
        receipt['copied_source'] = source_inventory(DEST)
        receipt['copy_source_stable'] = receipt['source_before_copy'] == receipt['source_after_copy'] == receipt['copied_source']
        process = subprocess.Popen(['make', 'build', 'test'], cwd=DEST, env=env,
                                   stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            receipt['make_exit'] = process.wait(timeout=1800)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
            receipt.update(make_exit=124, timed_out=True)
    else:
        receipt['make_exit'] = None
receipt['elapsed_s'] = time.monotonic() - started
receipt['uptime_after'] = subprocess.check_output(['uptime'], text=True).strip()
receipt['finished_utc'] = datetime.now(timezone.utc).isoformat()
receipt['log_sha256'] = hashlib.sha256(log.read_bytes()).hexdigest()
(AREA / 'r3' / f'h1-{run_id}.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in {'source_before_copy','source_after_copy','copied_source','markers'}}, indent=2))
print(log.read_text()[-12000:])
