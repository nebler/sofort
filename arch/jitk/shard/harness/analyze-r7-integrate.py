#!/usr/bin/env python3
"""Offline integration reducer; run after the R7 native/shard/class ledgers."""
import json, pathlib, statistics, sys

ROOT = pathlib.Path(sys.argv[1])

def rows(path):
    return [json.loads(line) for line in path.read_text().splitlines()]

def fit(xs, ys):
    mx, my = statistics.mean(xs), statistics.mean(ys)
    slope = sum((x-mx)*(y-my) for x, y in zip(xs, ys))/sum((x-mx)**2 for x in xs)
    fixed = my-slope*mx
    total = sum((y-my)**2 for y in ys)
    return dict(bytes_per_vm=slope, fixed_bytes=fixed,
        r2=1-sum((y-fixed-slope*x)**2 for x, y in zip(xs, ys))/total if total else 1)

def ledger(path, name):
    curves = []
    for rep in range(2):
        cells = [json.loads((path/f'ledger-{rep}-{name}-{n}.json').read_text()) for n in [1,16,64,256]]
        assert all(c['idle_cpu_usec'] == 0 for c in cells)
        xs = [c['n'] for c in cells]
        fields = dict(current=lambda s:s['memory_current'], anon=lambda s:s['memory_stat']['anon'],
            file=lambda s:s['memory_stat']['file'], kernel=lambda s:s['memory_stat']['kernel'],
            private_dirty=lambda s:s['smaps_rollup_kib']['Private_Dirty']*1024)
        curve = {k:fit(xs, [statistics.median(f(s) for s in c['samples']) for c in cells]) for k,f in fields.items()}
        curve['peak'] = fit(xs, [c['memory_peak'] for c in cells])
        curves.append(curve)
    return dict(curves=curves, mean_mib={k:statistics.mean(c[k]['bytes_per_vm'] for c in curves)/2**20 for k in curves[0]})

def main():
    out = dict(native={}, dirty_classes={}, hostile_counts={})
    for name in ['jq-musl','sqlite3','busybox','zstd','lua','micropython']:
        out['native'][name] = ledger(ROOT/'raw-native-ledger', name)
    for cls in ['glue-2m','glue-4m']:
        path = ROOT/'raw-shard' if cls == 'glue-2m' else ROOT/'raw-classes'/cls
        out['dirty_classes'][cls] = ledger(path, 'attack_hold')
        for fixture in (['bomb','arena_attack','json64k'] if cls == 'glue-2m' else ['bomb','arena_attack']):
            file = ROOT/'raw-shard'/f'hostile-{fixture}.jsonl' if cls == 'glue-2m' else ROOT/'raw-classes'/f'hostile-{cls}-{fixture}.jsonl'
            runs = [r for r in rows(file) if r['event'] == 'contained']
            assert len(runs) == 100
            for r in runs:
                if fixture == 'arena_attack':
                    assert r['error'] == 'memory_bound: write outside class arena at 0x80000000'
                else:
                    assert r['result'] == {'err':{'name':'InternalError','message':'out of memory'}}
            out['hostile_counts'][f'{cls}/{fixture}'] = len(runs)
    (ROOT/'raw/integration-summary.json').write_text(json.dumps(out, indent=2)+'\n')
    print(json.dumps(out, indent=2))

if __name__ == '__main__':
    main()
