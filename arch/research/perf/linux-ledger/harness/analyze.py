#!/usr/bin/env python3
"""Reduce the raw ledger with OLS y=fixed+N*marginal; no external modules."""
import json, math, statistics, sys
from pathlib import Path
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]/'raw'
def fit(rows):
    xs=[r[0] for r in rows];ys=[r[1] for r in rows]
    xm=statistics.mean(xs);ym=statistics.mean(ys)
    b=sum((x-xm)*(y-ym) for x,y in rows)/sum((x-xm)**2 for x in xs)
    a=ym-b*xm;sse=sum((y-a-b*x)**2 for x,y in rows);sst=sum((y-ym)**2 for y in ys)
    return {'marginal_bytes_per_vm':b,'fixed_bytes':a,'r_squared':1-sse/sst if sst else None,'max_abs_residual_bytes':max(abs(y-a-b*x) for x,y in rows),'points':rows}
def median_stat(row,fn):return statistics.median(fn(s) for s in row['samples'])
def metrics(r):
    proc=lambda k:median_stat(r,lambda s:s['process_sum'].get(k,0))
    cg=lambda k:median_stat(r,lambda s:s['cgroup']['memory_stat'].get(k,0))
    out={f'process_{k}':proc(k) for k in ['Pss','Rss','Private_Dirty','Private_Clean','Shared_Clean','Shared_Dirty','Anonymous','AnonHugePages','Pss_Anon','Pss_File','Pss_Shmem']}
    out.update({f'cgroup_{k}':cg(k) for k in ['anon','file','kernel','kernel_stack','pagetables','sec_pagetables','slab','slab_reclaimable','slab_unreclaimable','percpu','vmalloc','sock','shmem']})
    out.update(cgroup_current=median_stat(r,lambda s:s['cgroup']['memory_current']),pss_plus_cgroup_kernel=proc('Pss')+cg('kernel'),charge_residual=median_stat(r,lambda s:s['charge_residual']))
    out.update(parent_current=median_stat(r,lambda s:s['system']['parent']['memory_current']),parent_kernel=median_stat(r,lambda s:s['system']['parent']['memory_stat'].get('kernel',0)),parent_kernel_stack=median_stat(r,lambda s:s['system']['parent']['memory_stat'].get('kernel_stack',0)))
    for k in ['MemFree','MemAvailable','PageTables','SecPageTables','Slab','SReclaimable','SUnreclaim','KernelStack','AnonPages','Cached']:
        out[f'system_{k}']=median_stat(r,lambda s:s['system']['meminfo'].get(k,0))
    for name in set().union(*(s['system']['kvm_slab'].keys() for s in r['samples'])):
        out[f'slab_active_{name}']=median_stat(r,lambda s:s['system']['kvm_slab'].get(name,{}).get('active_bytes',0))
    return out
summary={'method':'OLS y = fixed_bytes + N * marginal_bytes_per_vm, each point median of 3 samples; separate fits per repetition; units bytes. System-wide fits are noisy diagnostics, not added to cgroup charges.','kinds':{}}
for path in sorted(root.glob('ledger-*.json')):
    data=json.loads(path.read_text());kind=data['kind'];dest=summary['kinds'].setdefault(kind,{'repetitions':[]})
    rows=[{'n':r['n'],**metrics(r),'idle_cpu_pct_core_per_vm':r['idle_cpu_pct_core_per_vm']} for r in data['rows']]
    fits={k:fit([(r['n'],r[k]) for r in rows]) for k in rows[0] if k not in ('n','idle_cpu_pct_core_per_vm')} if len(rows)>1 else {}
    closure=[abs(s['charge_residual'])/s['cgroup']['memory_current'] for r in data['rows'] for s in r['samples']]
    rep={'file':path.name,'rep':data['rep'],'rows':rows,'fits':fits,'max_charge_residual_fraction':max(closure),'max_parent_peak_bytes':max(s['system']['parent']['memory_peak'] for r in data['rows'] for s in r['samples']),'error':data.get('error')}
    dest['repetitions'].append(rep)
for kind,dest in summary['kinds'].items():
    keys=set.intersection(*(set(r['fits']) for r in dest['repetitions']))
    dest['fit_mean']={k:{field:statistics.mean(r['fits'][k][field] for r in dest['repetitions']) for field in ('marginal_bytes_per_vm','fixed_bytes')} for k in sorted(keys)}
    dest['fit_marginal_range']={k:[min(r['fits'][k]['marginal_bytes_per_vm'] for r in dest['repetitions']),max(r['fits'][k]['marginal_bytes_per_vm'] for r in dest['repetitions'])] for k in sorted(keys)}
    p=root/f'boot-{kind}.json'
    if p.exists():
        boot=json.loads(p.read_text());dest['boot']={k:boot[k] for k in ('n','ready_ms','cpu_ms')}
    if 'cgroup_current' in dest['fit_mean']:
        print(kind, 'marginal MiB',round(dest['fit_mean']['cgroup_current']['marginal_bytes_per_vm']/2**20,6),'fixed MiB',round(dest['fit_mean']['cgroup_current']['fixed_bytes']/2**20,6),'pss MiB',round(dest['fit_mean']['process_Pss']['marginal_bytes_per_vm']/2**20,6),'kernel MiB',round(dest['fit_mean']['cgroup_kernel']['marginal_bytes_per_vm']/2**20,6))
(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
