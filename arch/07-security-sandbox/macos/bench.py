#!/usr/bin/env python3
"""n=30 per mode, 5 warmups, randomized interleaved rounds; whole fresh-process wall time
(spawn -> sandbox -> VM build/boot -> PSCI SYSTEM_OFF -> reap) + in-process sandbox cost."""
import json, os, random, statistics, subprocess, sys, time
R = '/tmp/jitk-07/r2'; HERE = os.path.dirname(os.path.abspath(__file__))
MODES = {
  'none':      (['./jitk-vmm', 'kk.bin'], {}),
  'sbpl':      (['./jitk-vmm', 'kk.bin'], {'JITK_SB': 'sbpl'}),
  'compiled':  (['./jitk-vmm', 'kk.bin'], {'JITK_SB': 'compiled'}),
  'sandbox-exec': (['/usr/bin/sandbox-exec', '-f', f'{HERE}/sbexec.sb', './jitk-vmm', 'kk.bin'], {}),
}
def run(m):
    argv, env = MODES[m]
    e = {'JITK_TIME': '1', **env}
    t = time.perf_counter_ns(); p = subprocess.run(argv, cwd=R, env=e, capture_output=True); dt = (time.perf_counter_ns() - t) / 1e6
    assert p.returncode == 0, (m, p.returncode, p.stderr)
    ns = [int(l.split('=')[1]) for l in p.stderr.decode().split() if l.startswith('sandbox_ns=')]
    return dt, (ns[0] / 1e6 if ns else None)
for _ in range(5):
    for m in MODES: run(m)
raw = {m: [] for m in MODES}; inner = {m: [] for m in MODES}
for _ in range(30):
    order = list(MODES); random.shuffle(order)
    for m in order:
        dt, s = run(m); raw[m].append(dt)
        if s is not None: inner[m].append(s)
p90 = lambda xs: sorted(xs)[26]
summ = {}
for m in MODES:
    d = [a - b for a, b in zip(raw[m], raw['none'])]
    summ[m] = {'n': 30, 'median_ms': statistics.median(raw[m]), 'p90_ms': p90(raw[m]),
               'paired_added_median_ms': statistics.median(d)}
    if inner[m]: summ[m].update(inner_median_ms=statistics.median(inner[m]), inner_p90_ms=p90(inner[m]))
out = {'load': os.getloadavg(), 'summary': summ, 'raw_ms': raw, 'inner_ms': inner}
json.dump(out, open(f'{HERE}/latency-r2.json', 'w'), indent=1)
print(json.dumps({'load': out['load'], 'summary': summ}, indent=1))
