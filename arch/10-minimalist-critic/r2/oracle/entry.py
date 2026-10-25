import hashlib, json, os, pathlib, platform, subprocess, sys, time
from normalize import normalize
# /case contains immutable bin + fixtures. /out is a private bounded scratch mount.
out = pathlib.Path(os.getenv('ORACLE_OUT', '/out')); out.mkdir(parents=True, exist_ok=True)
cmd = ['strace', '-f', '-qq', '-v', '-X', 'raw', '-xx', '-s', '1048576',
       '-o', str(out/'raw.strace')]
if os.getenv('INJECT_ERRNO'):
    name = os.getenv('INJECT_SYSCALL', 'ioctl')
    assert name in ('ioctl', 'mremap')
    cmd += ['-e', 'inject=' + name + ':error=' + os.environ['INJECT_ERRNO']]
binary = os.getenv('ORACLE_BINARY', '/case/qjs-static')
cmd += ['--', binary] + sys.argv[1:]
env = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'TZ': 'UTC'}
start = time.monotonic()
with open(out/'stdout.bin', 'wb') as stdout, open(out/'stderr.bin', 'wb') as stderr:
    try:
        p = subprocess.run(cmd, stdin=sys.stdin.buffer, stdout=stdout, stderr=stderr,
                           env=env, cwd='/case', timeout=20)
        code = p.returncode
    except subprocess.TimeoutExpired:
        raise SystemExit('oracle timeout: trace rejected')
events = normalize((out/'raw.strace').read_text(), require_exit=True)
if code < 0 or int(events[-1]['args'][0], 0) != code:
    raise SystemExit('inconsistent or signaled exit: trace rejected')
with open(out/'trace.jsonl', 'w') as f:
    for e in events: f.write(json.dumps(e, separators=(',', ':')) + '\n')
meta = {'arch': platform.machine(), 'kernel': platform.release(), 'exit': code,
        'seconds': round(time.monotonic()-start, 6), 'events': len(events),
        'syscalls': sorted({e['name'] for e in events}),
        'binary_sha256': hashlib.sha256(pathlib.Path(binary).read_bytes()).hexdigest(),
        'strace': subprocess.check_output(['strace','-V'], text=True).splitlines()[0]}
(out/'meta.json').write_text(json.dumps(meta, indent=2)+'\n')
print(json.dumps(meta))
