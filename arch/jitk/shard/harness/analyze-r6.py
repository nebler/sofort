#!/usr/bin/env python3
"""Reduce retained R6 JSON; no VM or runtime work occurs in this script."""
import json,math,pathlib,statistics,sys
root=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/home/dev/r6-shard/raw')
def fit(rows,key):
    xs=[r['n'] for r in rows]; ys=[key(r) for r in rows]
    mx=statistics.mean(xs);my=statistics.mean(ys)
    slope=sum((x-mx)*(y-my) for x,y in zip(xs,ys))/sum((x-mx)**2 for x in xs)
    fixed=my-slope*mx
    total=sum((y-my)**2 for y in ys)
    r2=1-sum((y-fixed-slope*x)**2 for x,y in zip(xs,ys))/total if total else 1
    return dict(bytes_per_vm=slope,fixed_bytes=fixed,r2=r2)
def med(r,path):
    def get(s):
        for key in path:s=s[key]
        return s
    return statistics.median(get(s) for s in r['samples'])
ledger={}
for name in ['ready','return2','one_tool','promise10','json64k']:
    curves=[]; cells=[]
    for rep in range(2):
        rows=[json.loads((root/f'ledger-{rep}-{name}-{n}.json').read_text()) for n in [1,16,64,256]]
        fields=dict(current=['memory_current'],anon=['memory_stat','anon'],file=['memory_stat','file'],
          kernel=['memory_stat','kernel'],sock=['memory_stat','sock'],pss=['smaps_rollup_kib','Pss'],
          private_dirty=['smaps_rollup_kib','Private_Dirty'],rss=['smaps_rollup_kib','Rss'])
        curves.append({k:fit(rows,lambda r,p=p:med(r,p)*(1024 if p[0]=='smaps_rollup_kib' else 1)) for k,p in fields.items()})
        for r in rows:
            component=lambda s:sum(s['memory_stat'].get(k,0) for k in ['anon','file','kernel','sock'])
            residual=[dict(bytes=s['memory_current']-component(s),percent=100*(s['memory_current']-component(s))/s['memory_current']) for s in r['samples']]
            cells.append(dict(n=r['n'],rep=rep,memory_current=med(r,['memory_current']),
              idle_cpu_usec=r['idle_cpu_usec'],residual=residual,
              loadavg=[s['loadavg'].strip() for s in r['samples']],
              threads=[int(s['status'].split('Threads:\t')[1].splitlines()[0]) for s in r['samples']]))
    current=[c['current']['bytes_per_vm'] for c in curves]
    ledger[name]=dict(marginal_mib_per_vm=statistics.mean(current)/2**20,
      slope_range_bytes=[min(current),max(current)],fixed_mib=statistics.mean(c['current']['fixed_bytes'] for c in curves)/2**20,
      components_bytes={k:statistics.mean(c[k]['bytes_per_vm'] for c in curves) for k in curves[0]},curves=curves,cells=cells)
def quantiles(a):
    a=sorted(a)
    return dict(n=len(a),p50_ns=a[math.ceil(.5*len(a))-1],p99_ns=a[math.ceil(.99*len(a))-1],mean_ns=statistics.mean(a))
bench={}
for name in ['return2','one_tool','promise10','json64k','canary']:
    path=root/('canary-10000.jsonl' if name=='canary' else f'bench-{name}.jsonl')
    rows=[json.loads(l) for l in path.read_text().splitlines()];samples=[r for r in rows if r['event']=='sample']
    summary=next(r for r in rows if r['event']=='summary')
    bench[name]=dict(summary=summary,environment=rows[0],
      metrics={k:quantiles([r[k] for r in samples]) for k in ['reset_ns','run_ns','cpu_ns','wait_to_finish_ns','owner_reply_ns']},
      resets_including_mmio_drain=True,nearest_rank_percentiles=True)
out=dict(ledger=ledger,bench=bench)
(root/'summary-r6.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:{'mib_per_vm':v['marginal_mib_per_vm'],'range_bytes':v['slope_range_bytes'],'fixed_mib':v['fixed_mib']} for k,v in ledger.items()},indent=2))
for k,v in bench.items():print(k,json.dumps(v['metrics']))
