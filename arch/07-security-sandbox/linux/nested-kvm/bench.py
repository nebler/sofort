import json, random, subprocess, time, sys
def median(xs): s = sorted(xs); n = len(s); return s[n//2] if n % 2 else (s[n//2-1] + s[n//2]) / 2
CG = '/sys/fs/cgroup/jitk/slot0'
def run(m):
    env, pre = m
    e = {'LD_LIBRARY_PATH': '/work', 'JITK_TIME': '1', **env}
    t = time.perf_counter_ns(); p = subprocess.run(pre + ['/work/jitk-vmm', 'kk.bin'], env=e, capture_output=True)
    dt = (time.perf_counter_ns() - t) / 1e6
    assert p.returncode == 0, (env, p.returncode, p.stderr)
    steps = {}
    for l in p.stderr.decode().splitlines():
        if l.startswith('T '): _, k, v = l.split(); steps[k] = int(v) / 1e3
    return dt, steps
modes = {'unconfined': ({'JITK_CONFINE': '0'}, []), 'confined': ({}, []),
         'confined-notsync': ({'JITK_TSYNC': '0'}, []),
         'confined+setns': ({'JITK_NETNS': '/tmp/emptyns'}, []),
         'confined+unshare-netns': ({'JITK_NETNS': 'unshare'}, []),
         'confined+cgroup-migrate': ({'JITK_CGROUP': CG}, []),
         'confined+clone-into-cgroup': ({}, ['/work/spawn-cg', CG])}
if len(sys.argv) > 1: modes = {k: v for k, v in modes.items() if k in sys.argv[1:]}
for _ in range(3):
    for m in modes: run(modes[m])
wall = {m: [] for m in modes}; steps = {m: {} for m in modes}
for _ in range(30):
    o = list(modes); random.shuffle(o)
    for m in o:
        dt, s = run(modes[m]); wall[m].append(dt)
        for k, v in s.items(): steps[m].setdefault(k, []).append(v)
p90 = lambda xs: sorted(xs)[26]
summ = {m: {'n': 30, 'wall_median_ms': round(median(wall[m]), 3), 'wall_p90_ms': round(p90(wall[m]), 3),
            'steps_median_us': {k: round(median(v), 1) for k, v in steps[m].items()},
            'steps_p90_us': {k: round(p90(v), 1) for k, v in steps[m].items()}} for m in modes}
print('BENCH ' + json.dumps({'summary': summ, 'wall_ms': wall}))
