import json,os,random,time
from pathlib import Path
from bench import sample,stats,uptime
R=Path(__file__).resolve().parent;T=Path('/tmp/jitk-06/r2')
def run(k):
 mode='print' if k=='trace-print' else 'tool';pre='pre' in k;park='park' in k
 image=T/('r2-original.bin' if k.startswith('exact') else 'r2-'+mode+'.bin')
 host=T/('jitk-vmm' if k.startswith('exact') else 'host-static')
 args=[str(host),'--image',str(image)]+(['--wait-go'] if pre else [])
 env=dict(os.environ,JITK_TICK_US='1000' if k.endswith('B') else '0')
 return sample(mode,pre,args=args,parked=park,env=env)
if __name__=='__main__':
 import sys
 n=int(sys.argv[1]) if len(sys.argv)>1 else 100
 cases=['trace-print','trace-cold','trace-pre','trace-park-A','trace-park-B','exact-cold','exact-pre','exact-park-A']
 r=dict(uptime_start=uptime(),rows={k:[] for k in cases},first={},load_samples=[])
 for k in cases:r['first'][k]=run(k)
 order=cases*n;random.Random(6022).shuffle(order)
 for i,k in enumerate(order):
  r['rows'][k].append(run(k))
  if i%40==39:
   load=uptime();r['load_samples'].append(dict(after=i+1,uptime=load));print(i+1,load,flush=True)
 r['uptime_end']=uptime();r['summary']={k:{m:stats([x['ms'][m] for x in rows]) for m in rows[0]['ms']} for k,rows in r['rows'].items()}
 (R/'r2-integrated.json').write_text(json.dumps(r,indent=2));print(json.dumps(r['summary'],indent=2))
