#!/usr/bin/env python3
"""Paired-by-block, 10,000-resample bootstrap. All confidence is run-local."""
import json,random,statistics,sys
from pathlib import Path
P=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent/'results'
d=json.loads((P/'raw.json').read_text());rows=d['samples']
assert all(r['status']=='PASS' for r in rows)
def q(a):
 s=sorted(a)
 def at(p):
  x=(len(s)-1)*p;i=int(x);return s[i]+(s[min(i+1,len(s)-1)]-s[i])*(x-i)
 return {'n':len(s),'median':statistics.median(s),'p90':at(.90),'p99':at(.99),'min':s[0],'max':s[-1]}
def paired(a,b):
 assert a.keys()==b.keys() and len(a)>=30
 keys=sorted(a);av=[a[k] for k in keys];bv=[b[k] for k in keys];rng=random.Random(39009)
 ds=[];rs=[]
 for _ in range(10000):
  idx=[rng.randrange(len(keys)) for _ in keys]
  am=statistics.median(av[i] for i in idx);bm=statistics.median(bv[i] for i in idx)
  ds.append(am-bm);rs.append(am/bm)
 ds.sort();rs.sort();am=statistics.median(av);bm=statistics.median(bv)
 return {'n':len(keys),'jitk_median_ms':am,'other_median_ms':bm,
  'difference_ms':am-bm,'difference_ci95_ms':[ds[249],ds[9749]],
  'jitk_over_other':am/bm,'ratio_ci95':[rs[249],rs[9749]],
  'winner':'jitk' if ds[9749]<0 else 'other' if ds[249]>0 else 'inconclusive'}
comparisons=[]
for j,h in [('jitk-cold','hl-strict-cold'),('jitk-parked','hl-strict-prespawned'),('jitk-parked','hl-logical-clone')]:
 for case in sorted({r['case'] for r in rows if r['mode']==j}):
  av={r['block']:r['latency_ms'] for r in rows if r['mode']==j and r['case']==case}
  bv={r['block']:r['latency_ms'] for r in rows if r['mode']==h and r['case']==case}
  comparisons.append({'jitk_mode':j,'other_mode':h,'case':case,**paired(av,bv)})
(P/'verdict.json').write_text(json.dumps(comparisons,indent=2)+'\n')
summary=[]
for name in sorted({r['name'] for r in rows}):
 a=[r for r in rows if r['name']==name]
 summary.append({'name':name,**{key:q([r[key] for r in a]) for key in ['latency_ms','rss_mib','footprint_mib','max_pending'] if key in a[0]},
  'load1':q([r['load_before'][0] for r in a]),'gate_passed':sum(r['gate']['passed'] for r in a)})
(P/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
mem=[]
for metric in ['rss_mib','footprint_mib']:
 units={n:{r['block']:r[metric] for r in rows if r['name']==f'memory/hl-logical/{n}'} for n in [1,17,33]}
 marginal={i:(units[33][i]-units[1][i])/32 for i in units[1]}
 mid={i:(units[17][i]-units[1][i])/16 for i in units[1]}
 upper={i:(units[33][i]-units[17][i])/16 for i in units[1]}
 rng=random.Random(39010);a=list(marginal.values());boot=sorted(statistics.median(rng.choices(a,k=len(a))) for _ in range(10000))
 mem.append({'metric':metric,'logical1_total':q(list(units[1].values())),
   'logical17_total':q(list(units[17].values())),'logical33_total':q(list(units[33].values())),
   'marginal_1_to_33_mib':q(a),'marginal_median_ci95_mib':[boot[249],boot[9749]],
   'marginal_1_to_17_mib':q(list(mid.values())),'marginal_17_to_33_mib':q(list(upper.values()))})
(P/'memory.json').write_text(json.dumps(mem,indent=2)+'\n')
for c in comparisons:print(c['jitk_mode'],c['other_mode'],c['case'],c['winner'],round(c['difference_ms'],3),[round(v,3) for v in c['difference_ci95_ms']])
