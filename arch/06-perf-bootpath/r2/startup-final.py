import json,random
from pathlib import Path
from spawn import sample
from bench import stats,uptime
R=Path(__file__).resolve().parent
cases=[(b,m) for b in ['control','control-hvf','control-krun','vmm-final'] for m in ['posix_spawn','fork_exec']]
r=dict(uptime_start=uptime(),rows={b+'/'+m:[] for b,m in cases})
order=cases*100;random.Random(6063).shuffle(order)
for i,(b,m) in enumerate(order):
 r['rows'][b+'/'+m].append(sample(b,m))
 if i%80==79:print(i+1,uptime(),flush=True)
r['uptime_end']=uptime();r['summary']={k:{m:stats([x[m] for x in rows]) for m in rows[0]} for k,rows in r['rows'].items()}
(R/'startup-final.json').write_text(json.dumps(r,indent=2));print(json.dumps(r['summary'],indent=2))
