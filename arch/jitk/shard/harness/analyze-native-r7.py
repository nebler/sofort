#!/usr/bin/env python3
"""R6 least-squares memory accounting applied to the native Lua fixture."""
import json,pathlib,statistics,sys
root=pathlib.Path(sys.argv[1])
def fit(rows,key):
    xs=[r['n'] for r in rows];ys=[statistics.median(key(s) for s in r['samples']) for r in rows]
    mx=statistics.mean(xs);my=statistics.mean(ys)
    slope=sum((x-mx)*(y-my) for x,y in zip(xs,ys))/sum((x-mx)**2 for x in xs)
    fixed=my-slope*mx;total=sum((y-my)**2 for y in ys)
    return dict(bytes_per_vm=slope,fixed_bytes=fixed,r2=1-sum((y-fixed-slope*x)**2 for x,y in zip(xs,ys))/total if total else 1)
def summarize(path,name="native_lua"):
    curves=[];cells=[];residual=[]
    for rep in range(2):
        rows=[json.loads((path/f'ledger-{rep}-{name}-{n}.json').read_text()) for n in [1,16,64,256]]
        fields={'current':lambda s:s['memory_current']}
        for k in ['anon','file','kernel','pagetables','kernel_stack','slab']:
            fields[k]=lambda s,k=k:s['memory_stat'][k]
        for k in ['Pss','Private_Dirty']:
            fields[k]=lambda s,k=k:s['smaps_rollup_kib'][k]*1024
        curves.append({k:fit(rows,f) for k,f in fields.items()})
        for row in rows:
            cells.append(dict(n=row['n'],rep=rep,bytes=statistics.median(s['memory_current'] for s in row['samples']),idle_cpu_usec=row['idle_cpu_usec']))
            for s in row['samples']:
                residual.append((s['memory_current']-sum(s['memory_stat'].get(k,0) for k in ['anon','file','kernel','sock']))/s['memory_current']*100)
    return dict(marginal_mib=statistics.mean(c['current']['bytes_per_vm'] for c in curves)/2**20,
                components_bytes={k:statistics.mean(c[k]['bytes_per_vm'] for c in curves) for k in curves[0]},
                curves=curves,cells=cells,max_abs_residual_percent=max(map(abs,residual)))
names=sorted(p.name[len('ledger-0-'):-len('-1.json')] for p in root.glob('ledger-0-*-1.json'))
out=dict(tools={name:summarize(root,name) for name in names})
if 'native_lua' in names:out['final']=out['tools']['native_lua']
if (root/'ledger-before').is_dir():out['before_cache_fix']=summarize(root/'ledger-before')
(root/'memory-summary.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
