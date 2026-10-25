import pathlib,json,statistics,collections,csv
R=pathlib.Path(__file__).resolve().parent
RAW=R/'raw'
def dist(xs):
    xs=sorted(xs)
    return dict(n=len(xs),median=statistics.median(xs),min=min(xs),max=max(xs),p90=xs[min(len(xs)-1,int(len(xs)*.9))],p99=xs[min(len(xs)-1,int(len(xs)*.99))]) if xs else {}
summ={};checks=[];attrs={};traces={}
for f in sorted(RAW.glob('*.jsonl')):
    if f.name.startswith(('debug-','smoke-','validated-','ranges-')):continue
    es=[json.loads(x) for x in f.read_text().splitlines()]
    if not es or es[0].get('event')!='environment':continue
    env=es[0];group=collections.defaultdict(list);res=[]
    for e in es:
        if e['event']=='point':group[e['pid']].append(e)
        elif e['event'] in ('result','init'):res.append(e)
    samples=[]
    for pid,pts in group.items():
        starts=[e for e in pts if e['phase']=='start'];ends=[e for e in pts if e['phase']=='end']
        if not starts or not ends:continue
        assert len(starts)==len(ends)==1,(f,pid)
        for e in pts:
            a=e['snapshot'];checks.append(dict(file=f.name,pid=pid,phase=e['phase'],pagemap=a['private4'],smaps=a['smaps']['Private_Dirty'],difference=a['private4']-a['smaps']['Private_Dirty']))
        peak=max(pts,key=lambda e:e['snapshot']['private4'])
        a=peak['snapshot'];end=ends[0]['snapshot'];start=starts[0]['snapshot']
        union={p['addr'] for e in pts for p in e['snapshot']['pages']}
        samples.append(dict(pid=pid,private4=a['private4'],private16=max(e['snapshot']['private16'] for e in pts),pss=a['smaps']['Pss'],private_end=end['private4'],private_start=start['private4'],rss_peak=max(e['snapshot']['smaps']['Rss'] for e in pts),minflt=end['stat']['minflt']-start['stat']['minflt'],fault_upper4=start['private4']+4096*(end['stat']['minflt']-start['stat']['minflt']),union4=len(union)*4096,union16=len({p//16384 for p in union})*16384,phase=peak['phase']))
        attrs.setdefault(f.stem,[]).append(dict(pid=pid,category=a['by_category'],tags=a['by_tag_overlap']))
        writes={e['page']:e['mask'] for e in es if e['event']=='write_site' and e['pid']==pid}
        if writes:
            template=next(e for e in es if e['event']=='template')
            ranges=template['ranges'];preexisting={p['addr'] for p in template['snapshot']['pages']}
            kinds={1:'refcount',2:'atom_refcount',3:'allocator_header',4:'cycle_gc'}
            traces.setdefault(f.stem,[]).append(dict(pid=pid,gc_count=next(e['count'] for e in es if e['event']=='gc_count' and e['pid']==pid),bytes_all={k:4096*len([p for p,m in writes.items() if m&(1<<bit)]) for bit,k in kinds.items()},bytes_preexisting={k:4096*len([p for p,m in writes.items() if m&(1<<bit) and p in preexisting]) for bit,k in kinds.items()},dirty_preexisting={k:4096*len([p for p,m in writes.items() if m&(1<<bit) and p in preexisting and p in union]) for bit,k in kinds.items()}))
    z=dict(environment=env,samples=samples,load=env['environment']['load'],phase_counts=dict(collections.Counter(s['phase'] for s in samples)),metrics={k:dist([s[k] for s in samples]) for k in ['private4','private16','private_end','private_start','pss','rss_peak','minflt','fault_upper4','union4','union16']},timing_samples=res if env['mode']!='census' else [],timing={k:dist([e[k] for e in res if k in e]) for k in ['restore_ns','cpu_ns','wall_ns','minflt','maxrss_kib','arena_used']})
    summ[f.stem]=z
# Aggregate the three independently initialized default templates.
cases=['empty','return2','one_tool','promise10','source8k','json64k','json1m']
baseline={}
for w in cases:
    names=[k for k in summ if k.startswith(f'O2-default-{w}-memory')]
    ss=[s for k in names for s in summ[k]['samples']]
    baseline[w]={k:dist([s[k] for s in ss]) for k in ['private4','private16','private_end','pss','minflt','fault_upper4','union4','union16']}
inter=collections.defaultdict(list);rounds=collections.defaultdict(dict)
for k,v in summ.items():
    if k.startswith('interleaved-'):
        _,rnd,tag=k.split('-',2)
        inter[tag]+=v['timing_samples'];rounds[tag][rnd]=v['timing']['cpu_ns']['median']
inter={k:dict(cpu_ns=dist([s['cpu_ns'] for s in ss]),wall_ns=dist([s['wall_ns'] for s in ss]),round_medians=rounds[k]) for k,ss in inter.items()}
out=dict(baseline=baseline,runs=summ,attribution=attrs,trace=traces,interleaved=inter,validation=dict(points=len(checks),mismatches=[x for x in checks if x['difference']]))
(R/'summary.json').write_text(json.dumps(out,indent=2))
with (R/'workloads.csv').open('w') as f:
    cw=csv.writer(f);cw.writerow(['workload','n','observed_union4_median_bytes','observed_union4_min','observed_union4_max','observed_union16_median_bytes','observed_union16_min','observed_union16_max','peak_private4_median_bytes','peak_private16_median_bytes','pss_at_peak_median_bytes','minflt_median','end_private4_median_bytes','cpu_median_ns','restore_median_ns'])
    for w,a in baseline.items():
        c=summ.get(f'O2-default-{w}-cpu',{}).get('timing',{})
        cw.writerow([w,a['private4'].get('n'),a['union4'].get('median'),a['union4'].get('min'),a['union4'].get('max'),a['union16'].get('median'),a['union16'].get('min'),a['union16'].get('max'),a['private4'].get('median'),a['private16'].get('median'),a['pss'].get('median'),a['minflt'].get('median'),a['private_end'].get('median'),c.get('cpu_ns',{}).get('median'),c.get('restore_ns',{}).get('median')])
print((R/'workloads.csv').read_text())
print('validation',dict(points=len(checks),mismatches=len(out['validation']['mismatches'])))
