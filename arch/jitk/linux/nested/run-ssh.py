#!/usr/bin/env python3
"""Run the unchanged nested profile in an existing VM, in a private directory."""
import hashlib
import io
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tarfile
import time

from watch import run

root = Path(__file__).resolve().parents[1]
work = Path(sys.argv[1]).resolve()
log = Path(sys.argv[2])
override = os.getenv('JITK_NESTED_SSH')
if override:
    ssh = Path(override).resolve()
else:
    common = subprocess.check_output(['git', '-C', str(root), 'rev-parse',
                                      '--path-format=absolute', '--git-common-dir'], text=True).strip()
    ssh = Path(common).parent / 'kvm-dev/ssh.sh'
if not ssh.is_file():
    sys.exit('existing nested VM required: set JITK_NESTED_SSH to its ssh wrapper; see linux/README.md')

# One private run per invocation/worktree. Never rsync --delete into shared code.
identity = hashlib.sha256(str(root).encode()).hexdigest()[:12]
remote = f'/home/dev/r7-suite/{identity}-{os.getpid()}'
subprocess.run([str(ssh), f'mkdir -p {remote}'], check=True, timeout=20)
files = [(root / 'suite.py', 'suite.py'), (root / 'nested/watch.py', 'watch.py')]
files += [(work / name, name) for name in ['jitk-vmm', 'spawn-cg', 'kernel.bin', 'seccomp-probe']]
files += [(work / (name + '.bin'), name + '.bin') for name in
          ['kk', 'bad-sysreg', 'console_avail_oob', 'mmio-halfword',
           'rtc_oob_read', 'unknown-hvc', 'unknown-smc']]
files += [(work / (role + '.bpf'), role + '.bpf') for role in ['main', 'vcpu', 'console']]
payload = io.BytesIO()
with tarfile.open(fileobj=payload, mode='w') as archive:
    for source, name in files:
        archive.add(source, arcname=name, recursive=False)
subprocess.run([str(ssh), f'cd {remote} && tar xf -'], input=payload.getvalue(),
               check=True, timeout=30)
env = {'JITK_BIN': remote, 'JITK_REPORT': remote + '/report.json', 'JITK_LABEL': 'NESTED',
       'JITK_HOST_UPTIME': subprocess.check_output(['uptime'], text=True).strip()}
for key in ['JITK_TIMEOUT_S', 'JITK_GATE_TIMEOUT_S', 'JITK_GATE_DEADLINE_S',
            'JITK_STARTUP_TIMEOUT_S', 'JITK_NESTED_TIMEOUT', 'JITK_BOOT_N',
            'JITK_SWEEP_N', 'JITK_MAX_CONCURRENCY', 'JITK_DENSITY']:
    if key in os.environ:
        env[key] = os.environ[key]
# The remote monitor survives a broken SSH stream and terminates this suite's
# process group. flock serializes measurements without changing the VM itself.
lock_timeout = float(os.getenv('JITK_LOCK_TIMEOUT_S', '600'))
if lock_timeout <= 0:
    sys.exit('JITK_LOCK_TIMEOUT_S must be positive')
command = ['sudo', 'flock', '-E', '75', '-w', str(lock_timeout), '/home/dev/bench.lock', 'env',
           *(f'{key}={value}' for key, value in env.items()), 'sh', '-c',
           'ulimit -n 16384; exec "$@"', 'sh', 'python3', remote + '/watch.py',
           '--log', remote + '/suite.log', '--', 'python3', remote + '/suite.py']
receipt = {'backend': 'ssh', 'ssh_wrapper': str(ssh), 'remote_directory': remote,
           'started_unix': time.time(),
           'source_sha256': {name: hashlib.sha256(source.read_bytes()).hexdigest()
                             for source, name in files},
           'command': command, 'lock_timeout_s': lock_timeout, 'vm_lifecycle_changes': False}
(log.parent / 'nested-command.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(f'jitk: full NESTED suite over {ssh}; scratch={remote}; bench.lock wait <= {lock_timeout:g}s', flush=True)
status = run([str(ssh), shlex.join(command)], log,
             progress_timeout=float(os.getenv('JITK_GATE_TIMEOUT_S', '60')) + 15,
             startup_allowance=lock_timeout, suite_allowance=lock_timeout)
if status == 75:
    sys.exit(f'jitk: bench.lock busy after {lock_timeout:g}s; no test gate ran (log={log})')
if status:
    messages = [line for line in log.read_text(errors='replace').splitlines()
                if line.startswith('JITK_TIMEOUT ')]
    if messages:
        print(messages[-1][:1000], file=sys.stderr, flush=True)
    print(f'jitk: nested suite failed (exit {status}); log={log}', file=sys.stderr, flush=True)
if status == 0:
    subprocess.run([str(ssh), f'sudo rm -rf -- {remote}'], check=True, timeout=20)
sys.exit(status)
