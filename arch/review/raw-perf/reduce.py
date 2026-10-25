"""Run in raw-perf after collecting raw JSONL. Values ending _ns become us."""
from pathlib import Path
import collections, json, math, statistics
out = {}
for pattern in ('probe-*.jsonl','writable-*.jsonl','parts-*.jsonl','drain-*.jsonl'):
    for p in sorted(Path('.').glob(pattern)):
        rows=[json.loads(l) for l in p.read_text().splitlines()]
        for row in rows:
            if 'result' in row:
                assert row['calls'] in (0,1) and row['exits'] == row['calls']+1, (p,row)
                assert row['result'] == {'ok':2 if row['calls']==0 else 42}, (p,row)
        out[p.name]={'n':len(rows)}
        for key in rows[0]:
            if key.endswith('_ns'):
                v=sorted(r[key]/1000 for r in rows)
                out[p.name][key[:-3]+'_us']={'mean':statistics.mean(v),'p50':v[math.ceil(len(v)*.5)-1],'p99':v[math.ceil(len(v)*.99)-1]}
for p in Path('.').glob('memory*.jsonl'):
    r=[json.loads(l) for l in p.read_text().splitlines()]
    out[p.name]={'rows':r,'private_dirty_kib_per_slot_64_to_128':{}}
    for source in {x['source_bytes'] for x in r}:
        points={x['n']:x['private_dirty_kib'] for x in r if x['source_bytes']==source}
        if 64 in points and 128 in points:
            out[p.name]['private_dirty_kib_per_slot_64_to_128'][source]=(points[128]-points[64])/64
if Path('batch-trace.txt').exists():
    s=Path('batch-trace.txt').read_text()
    out['batch_ioctls']=dict(collections.Counter(l.split(', ')[1] for l in s.splitlines() if l.startswith('ioctl(')))
Path('summary.json').write_text(json.dumps(out,indent=2)+'\n')
