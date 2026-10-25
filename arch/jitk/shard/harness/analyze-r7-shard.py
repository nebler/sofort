#!/usr/bin/env python3
"""Reduce the R7 cgroup curves and validate conformance/stress receipts offline."""
import json
import math
import pathlib
import statistics
import sys

root = pathlib.Path(sys.argv[1])


def read_json(path):
    return json.loads(path.read_text())


def events(path):
    return [json.loads(line) for line in path.read_text().splitlines()]


def fit(rows, value):
    xs = [r['n'] for r in rows]
    ys = [value(r) for r in rows]
    mx, my = statistics.mean(xs), statistics.mean(ys)
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx)**2 for x in xs)
    fixed = my - slope * mx
    total = sum((y - my)**2 for y in ys)
    residual = sum((y - fixed - slope * x)**2 for x, y in zip(xs, ys))
    return dict(bytes_per_vm=slope, fixed_bytes=fixed, r2=1 - residual / total if total else 1)


def median(row, path):
    def value(sample):
        for key in path:
            sample = sample[key]
        return sample
    return statistics.median(value(s) for s in row['samples'])


def quantiles(values):
    values = sorted(values)
    assert values
    return dict(n=len(values), p50_ns=values[math.ceil(.5 * len(values)) - 1],
                p99_ns=values[math.ceil(.99 * len(values)) - 1], max_ns=max(values))


ledger = {}
for name in ['ready', 'return2', 'one_tool', 'promise10', 'json64k', 'bomb', 'attack_hold']:
    curves, cells = [], []
    for rep in range(2):
        rows = [read_json(root / f'ledger-{rep}-{name}-{n}.json') for n in [1, 16, 64, 256]]
        fields = dict(current=['memory_current'], anon=['memory_stat', 'anon'],
                      file=['memory_stat', 'file'], kernel=['memory_stat', 'kernel'],
                      sock=['memory_stat', 'sock'], pss=['smaps_rollup_kib', 'Pss'],
                      private_dirty=['smaps_rollup_kib', 'Private_Dirty'])
        curve = {key: fit(rows, lambda r, p=path: median(r, p) *
                         (1024 if p[0] == 'smaps_rollup_kib' else 1))
                 for key, path in fields.items()}
        curve['peak'] = fit(rows, lambda r: r['memory_peak'])
        curves.append(curve)
        for row in rows:
            residuals = []
            for sample in row['samples']:
                residual = sample['memory_current'] - sum(sample['memory_stat'].get(k, 0)
                                                          for k in ['anon', 'file', 'kernel', 'sock'])
                residuals.append(dict(bytes=residual, percent=100 * residual / sample['memory_current']))
            cells.append(dict(n=row['n'], rep=rep, memory_current=median(row, ['memory_current']),
                              memory_peak=row['memory_peak'], idle_cpu_usec=row['idle_cpu_usec'],
                              residual=residuals, loadavg=[s['loadavg'].strip() for s in row['samples']],
                              threads=[int(s['status'].split('Threads:\t')[1].splitlines()[0])
                                       for s in row['samples']]))
    slopes = [c['current']['bytes_per_vm'] for c in curves]
    ledger[name] = dict(marginal_mib_per_vm=statistics.mean(slopes) / 2**20,
                        slope_range_bytes=[min(slopes), max(slopes)],
                        peak_mib_per_vm=statistics.mean(c['peak']['bytes_per_vm'] for c in curves) / 2**20,
                        fixed_mib=statistics.mean(c['current']['fixed_bytes'] for c in curves) / 2**20,
                        components_bytes={k: statistics.mean(c[k]['bytes_per_vm'] for c in curves)
                                          for k in curves[0]}, curves=curves, cells=cells)

bench = {}
for name in ['return2', 'one_tool', 'promise10', 'canary']:
    rows = events(root / f'bench-{name}.jsonl')
    samples = [r for r in rows if r['event'] == 'sample']
    bench[name] = dict(n=len(samples), metrics={key: quantiles([r[key] for r in samples])
                       for key in ['reset_ns', 'run_ns', 'owner_reply_ns', 'wait_to_finish_ns']},
                       cpu_mean_ns=statistics.mean(r['cpu_ns'] for r in samples),
                       environment=rows[0], summary=rows[-1])

hostile = {}
for name in ['bomb', 'arena_attack', 'json64k']:
    rows = events(root / f'hostile-{name}.jsonl')
    samples = [r for r in rows if r['event'] == 'contained']
    assert len(samples) == 100
    for i, row in enumerate(samples):
        assert row['i'] == i
        if name == 'arena_attack':
            assert row['error'] == 'memory_bound: write outside glue-2m arena at 0x80000000'
        else:
            assert row['result'] == {'err': {'name': 'InternalError', 'message': 'out of memory'}}
    hostile[name] = dict(n=len(samples), outcome=samples[0], environment=rows[0])

stress_rows = events(root / 'stress-10000.jsonl')
stress = stress_rows[-1]
assert stress['runs'] == 10000 and stress['canary_leaks'] == stress['cross_talk'] == 0
assert stress['fresh_entropy'] == stress['runs']
stress_batches = {key: quantiles([r[key] for r in stress_rows if r['event'] == 'stress_batch'])
                  for key in ['batch_ns', 'max_run_ns']}
wait = read_json(root / 'wait-1024.json')
assert wait['n'] == 1024 and wait['events'][-1]['lost'] == 0
assert wait['events'][0]['owners'] == 4 and len(wait['task_ids']) == 5
assert 'Threads:\t1\n' in wait['watchdog_status']

deadlines = {}
for n in [1, 16, 64]:
    paths = sorted(root.glob(f'deadlines-{n}-*.jsonl'))
    assert len(paths) == 5
    samples, environments = [], []
    for path in paths:
        rows = events(path)
        batch = [r for r in rows if r['event'] == 'deadline']
        assert len(batch) == n and rows[-1]['reused_cleanly'] == n
        samples.extend(batch)
        environments.append(rows[0])
    deadlines[n] = dict(batches=len(paths), environments=environments,
                        **{key: quantiles([r[key] for r in samples])
                           for key in ['stop_latency_ns', 'reset_error_latency_ns']})

staggered = []
for path in sorted(root.glob('staggered-*.jsonl')):
    rows = events(path)
    assert rows[-1]['unrelated_spins_survived_early_expiry']
    staggered.extend(r['reset_error_latency_ns'] for r in rows if r['event'] == 'staggered_deadline')
assert len(staggered) == 40
escalation = read_json(root / 'escalation.json')
assert escalation['returncode'] == -9
cleanup = read_json(root / 'ledger-cleanup.json')
assert not cleanup['remaining_cgroups'] and not any(cleanup['memory_events'].values())

out = dict(ledger=ledger, bench=bench, hostile=hostile, stress=stress, wait=wait,
           stress_batches=stress_batches,
           deadlines=deadlines, staggered=quantiles(staggered), escalation=escalation,
           ledger_cleanup=cleanup)
(root / 'summary-r7-shard.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps({k: {field: v[field] for field in
                     ['marginal_mib_per_vm', 'peak_mib_per_vm', 'slope_range_bytes', 'fixed_mib']}
                  for k, v in ledger.items()}, indent=2))
print(json.dumps(deadlines, indent=2))
