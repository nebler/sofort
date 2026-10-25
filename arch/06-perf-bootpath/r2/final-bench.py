import json,random
from pathlib import Path
from bench import sample,stats,uptime
from spawn import sample as startup
R=Path(__file__).resolve().parent;T=Path('/tmp/jitk-06/r2')
cases=['print','tool','pre-tool'];r=dict(uptime_start=uptime(),rows={k:[] for k in cases},startup=[])
order=cases*100;random.Random(6011).shuffle(order)
for i,k in enumerate(order):
 mode=k.replace('pre-','');pre=k.startswith('pre-')
 args=[str(T/'jitk-vmm'),'--image',str(T/(mode+'.bin')),'--mem-mib','64']+(['--wait-go'] if pre else [])
 r['rows'][k].append(sample(mode,pre,args=args))
 if i%30==29:print(i+1,uptime(),flush=True)
for i in range(100):r['startup'].append(startup('vmm-final','posix_spawn'))
r['uptime_end']=uptime();r['summary']={k:{m:stats([x['ms'][m] for x in rows]) for m in rows[0]['ms']} for k,rows in r['rows'].items()};r['startup_summary']={m:stats([x[m] for x in r['startup']]) for m in r['startup'][0]}
(R/'final-vmm.json').write_text(json.dumps(r,indent=2));print(json.dumps(r['summary'],indent=2));print(r['startup_summary'])
