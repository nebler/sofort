#!/usr/bin/env python3
"""Focused shard suite on the existing kvm-dev backend; never manage its VM.

Build the ring image/prepared base first (README). All new remote writes remain
in /home/dev/r7-ipc. Dependencies install from package-lock with scripts disabled.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import shlex
import subprocess
import tarfile
import time

executor = Path(__file__).resolve().parents[1]
root = executor.parents[2]
common = Path(subprocess.check_output(['git', '-C', str(root), 'rev-parse',
                                      '--path-format=absolute', '--git-common-dir'], text=True).strip())
ssh = Path(os.environ.get('JITK_NESTED_SSH', str(common.parent / 'kvm-dev/ssh.sh')))
if not ssh.is_file():
    raise SystemExit('set JITK_NESTED_SSH to the existing kvm-dev ssh.sh wrapper')
identity = hashlib.sha256(str(root).encode()).hexdigest()[:12]
remote = f'/home/dev/r7-ipc/test-{identity}'
node = os.environ.get('JITK_SHARD_REMOTE_NODE', '/home/dev/r7-ipc/node/node-v24.13.0-linux-arm64/bin/node')
snapshot = os.environ.get('JITK_SHARD_REMOTE_SNAPSHOT', '/home/dev/r7-ipc/prepared')
if not node.startswith('/home/dev/r7-ipc/') or not snapshot.startswith('/home/dev/r7-ipc/'):
    raise SystemExit('remote Node and prepared base must be inside /home/dev/r7-ipc/')
files = []
for part in ['arch/jitk/shard', 'arch/jitk/executor', 'arch/jitk/protocol', 'arch/jitk/bench/hyperlight', 'arch/jitk/mcp']:
    directory = root / part
    for source in sorted(directory.rglob('*')):
        relative = source.relative_to(directory)
        if source.is_symlink() or not source.is_file():
            continue
        if any(p in {'target', 'node_modules', 'build', 'dist', '__pycache__'} or p.startswith('raw') for p in relative.parts):
            continue
        if source.suffix not in {'.rs', '.c', '.h', '.S', '.ts', '.mjs', '.js', '.json', '.toml', '.lock', '.sh', '.py'} and source.name != '.npmrc':
            continue
        if source.stat().st_size > 1048576:
            continue
        files.append((source, str(source.relative_to(root))))
archive = io.BytesIO()
with tarfile.open(fileobj=archive, mode='w') as tar:
    for source, name in files:
        tar.add(source, arcname=name, recursive=False)
subprocess.run([str(ssh), f'mkdir -p {shlex.quote(remote)} && cd {shlex.quote(remote)} && tar xf -'],
               input=archive.getvalue(), check=True, timeout=30)
q = shlex.quote
node_root = str(Path(node).parent.parent)
benchmark = os.environ.get('JITK_SHARD_BENCH') == '1'
lock_wait = 1800 if benchmark else 600
run_suite = '"$JITK_NODE" build/shard-check.js'
if benchmark:
    run_suite += ' && "$JITK_NODE" build/shard-bench.js'
commands = f'''set -eu
cd {q(remote)}/arch/jitk/shard
PATH=/home/dev/.cargo/bin:$PATH cargo +stable test --offline --bin real
PATH=/home/dev/.cargo/bin:$PATH cargo +stable build --release --offline --bin real
cd ../executor
{q(node)} {q(node_root)}/lib/node_modules/npm/bin/npm-cli.js ci --ignore-scripts --no-audit --no-fund --cache {q(remote)}/npm-cache
export JITK_NODE={q(node)}
export JITK_SHARD_BINARY={q(remote)}/arch/jitk/shard/target/release/real
export JITK_SHARD_SNAPSHOT={q(snapshot)}
sh run.sh build
flock -w {lock_wait} /home/dev/bench.lock sh -c {q(run_suite)}
'''
receipt = {'backend': 'ssh', 'remote': remote, 'node': node, 'snapshot': snapshot,
           'source_sha256': {name: hashlib.sha256(source.read_bytes()).hexdigest() for source, name in files},
           'command': commands, 'started_unix': time.time(), 'benchmark': benchmark, 'vm_lifecycle_changes': False}
output = executor / 'raw-r7-ipc'
output.mkdir(exist_ok=True)
(output / 'ssh-command.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(f'jitk: shard suite via {ssh}; scratch={remote}; lock wait <={lock_wait}s', flush=True)
with (output / 'ssh-test.log').open('w') as log:
    result = subprocess.run([str(ssh), commands], stdout=log, stderr=subprocess.STDOUT, timeout=lock_wait + 300)
log_text = (output / 'ssh-test.log').read_text()
if benchmark and result.returncode == 0:
    measurements = []
    for line in log_text.splitlines():
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if value.get('event') in {'environment', 'summary', 'sample', 'deadlines'}:
            measurements.append(line)
    (output / 'bench-final.jsonl').write_text('\n'.join(measurements) + '\n')
print(log_text[-8000:], flush=True)
raise SystemExit(result.returncode)
