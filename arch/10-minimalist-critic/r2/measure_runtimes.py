#!/usr/bin/env python3
"""Runs inside the copied Linux oracle; strace and no-vDSO probes are separate."""
import hashlib, json, math, os, pathlib, re, statistics, subprocess
import sys
sys.path.insert(0, '/review/oracle')
from normalize import NR

root = pathlib.Path('/out')
baseline = set('brk close exit_group getcwd ioctl lseek mmap mremap munmap openat read readlinkat readv set_tid_address writev clock_gettime ppoll'.split())
assert len(baseline) == 17
sql = "CREATE TABLE t(x INTEGER); INSERT INTO t VALUES(9),(1),(5),(3),(5); SELECT json_object('count',count(*),'sum',sum(x),'max',max(x)) FROM t;"
cases = {
    'lua': ('/bin-input/lua-static', ['/case/agent.lua'], b'9 1 5 3 5\n', b'{"count":5,"sum":23,"max":9}\n'),
    'sqlite': ('/bin-input/sqlite3-static', ['-batch', '-init', '/dev/null', ':memory:', sql], b'', b'{"count":5,"sum":23,"max":9}\n'),
    'sqlite-time-random': ('/bin-input/sqlite3-static', ['-batch', '-init', '/dev/null', ':memory:', "SELECT length(randomblob(32))=32 AND unixepoch('now')>1700000000;"], b'', b'1\n'),
}
inverse = {v:k for k,v in NR.items()}
def stats(xs):
    ys = sorted(xs)
    return dict(n=len(xs), median=statistics.median(xs), p90=ys[math.ceil(.9*len(xs))-1], p99=ys[math.ceil(.99*len(xs))-1])

results = {'baseline_17': sorted(baseline), 'cases':{}}
for name, (binary, args, data, expected) in cases.items():
    if name not in os.getenv('ORACLE_CASES', 'lua,sqlite').split(','):
        continue
    case = root / name
    case.mkdir(exist_ok=True)
    names, vdso_names, durations, event_counts = set(), set(), [], []
    for i in range(30):
        out = case / f'run-{i:02}'
        out.mkdir(exist_ok=True)
        env = dict(os.environ, ORACLE_OUT=str(out), ORACLE_BINARY=binary)
        run = subprocess.run(['python3', '/review/oracle/entry.py', *args], input=data, capture_output=True, env=env, timeout=25)
        (out/'driver.stdout').write_bytes(run.stdout)
        (out/'driver.stderr').write_bytes(run.stderr)
        if run.returncode:
            raise RuntimeError(run.stderr.decode())
        meta = json.loads((out/'meta.json').read_text())
        assert meta['exit'] == 0 and (out/'stdout.bin').read_bytes() == expected
        names.update(meta['syscalls'])
        durations.append(meta['seconds']*1000)
        event_counts.append(meta['events'])
        probe = subprocess.run(['/bin-input/no-vdso', binary, *args], input=data, capture_output=True, timeout=20,
                               env={'PATH':'/usr/bin:/bin', 'LANG':'C', 'LC_ALL':'C', 'TZ':'UTC'}, cwd='/case')
        (out/'no-vdso.stdout').write_bytes(probe.stdout)
        (out/'no-vdso.stderr').write_bytes(probe.stderr)
        assert probe.returncode == 0 and probe.stdout == expected and b'cleared=1 exit=0' in probe.stderr
        for nr in re.findall(rb'nr=(\d+) count=', probe.stderr):
            vdso_names.add(inverse[int(nr)])
    guest = (names - {'execve'}) | vdso_names
    results['cases'][name] = dict(binary_sha256=hashlib.sha256(pathlib.Path(binary).read_bytes()).hexdigest(),
        bytes=pathlib.Path(binary).stat().st_size, argv=args, n=30, traced_names=sorted(names),
        traced_count=len(names), no_vdso_names=sorted(vdso_names), guest_names=sorted(guest),
        guest_count=len(guest), delta_vs_17=sorted(guest-baseline), unused_from_17=sorted(baseline-guest),
        oracle_traced_wall_ms=stats(durations), events=stats(event_counts), all_outputs_equal=True)
(root/os.getenv('ORACLE_SUMMARY', 'runtime-summary.json')).write_text(json.dumps(results, indent=2)+'\n')
print(json.dumps(results, indent=2))
