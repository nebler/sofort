import json
from pathlib import Path
from bench import sample,stats,uptime
R=Path(__file__).resolve().parent
r=dict(uptime_start=uptime(),rows=[])
for i in range(100):
 r['rows'].append(sample('tool',True))
 if i%20==19:print(i+1,uptime(),flush=True)
r['uptime_end']=uptime();r['summary']={m:stats([x['ms'][m] for x in r['rows']]) for m in r['rows'][0]['ms']}
(R/'pre-spawn.json').write_text(json.dumps(r,indent=2));print(json.dumps(r['summary'],indent=2))
