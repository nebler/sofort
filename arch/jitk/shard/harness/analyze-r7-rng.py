#!/usr/bin/env python3
"""R7 reduction of the unchanged R6 cgroup observer and canary reset method."""
import gzip, json, math, pathlib, statistics, sys

root=pathlib.Path(sys.argv[1])
baselines=dict(return2=.484038,one_tool=.503431,promise10=.548644)
def fit(rows,field):
    xs=[r['n'] for r in rows]
    ys=[statistics.median(field(s) for s in r['samples']) for r in rows]
    mx,my=statistics.mean(xs),statistics.mean(ys)
    slope=sum((x-mx)*(y-my) for x,y in zip(xs,ys))/sum((x-mx)**2 for x in xs)
    fixed=my-slope*mx
    r2=1-sum((y-fixed-slope*x)**2 for x,y in zip(xs,ys))/sum((y-my)**2 for y in ys)
    return dict(bytes_per_vm=slope,fixed_bytes=fixed,r2=r2)
ledger={}
for name,baseline in baselines.items():
    curves=[]
    for rep in range(2):
        rows=[json.loads((root/f'ledger-{rep}-{name}-{n}.json').read_text()) for n in [1,16,64,256]]
        curves.append(dict(current=fit(rows,lambda s:s['memory_current']),
                           private_dirty=fit(rows,lambda s:1024*s['smaps_rollup_kib']['Private_Dirty']),
                           kernel=fit(rows,lambda s:s['memory_stat']['kernel']),
                           loadavg=[s['loadavg'] for r in rows for s in r['samples']]))
    slopes=[c['current']['bytes_per_vm'] for c in curves]
    mib=statistics.mean(slopes)/2**20
    ledger[name]=dict(mib_per_vm=mib,delta_r6_mib=mib-baseline,
                      slopes_bytes=slopes,curves=curves)
canary=root/'canary-10000.jsonl'
data=canary.read_text() if canary.exists() else ''.join(
    gzip.decompress(p.read_bytes()).decode() for p in sorted(root.glob('canary-10000.part-*.jsonl.gz')))
rows=[json.loads(s) for s in data.splitlines()]
samples=[r for r in rows if r['event']=='sample']
resets=sorted(r['reset_ns'] for r in samples)
reset=dict(n=len(resets),p50_ms=resets[math.ceil(.5*len(resets))-1]/1e6,
           p99_ms=resets[math.ceil(.99*len(resets))-1]/1e6)
reset.update(delta_r6_p50_ms=reset['p50_ms']-2.603,delta_r6_p99_ms=reset['p99_ms']-3.440)
summary=dict(ledger=ledger,canary_reset=reset,environment=rows[0],
             canary_summary=next(r for r in rows if r['event']=='summary'))
(root/'summary-r7-rng.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:{a:v[a] for a in ['mib_per_vm','delta_r6_mib','slopes_bytes']} for k,v in ledger.items()},indent=2))
print(json.dumps(reset,indent=2))
