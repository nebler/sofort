import json,statistics as st,collections,re,sys
from pathlib import Path
exec(open('/tmp/sofort-a2/analyze.py').read().split('for f in R.glob')[0])
file=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/sofort-a2/raw/vmm3.json');d=json.loads(file.read_text());out={}
for r in d['samples']:
 r['marks']={};r['exits_at']={}
 for line in r['lines']['err']:
  if line.startswith('A2 {'):
   m=json.loads(line[3:]);r['marks'][m['id']]=m
  elif line.startswith('A2_ORIGIN '):r['origin_ns']=int(line.split()[1])
  elif line.startswith('A2_EXITS '):r['exits']=json.loads(line[9:])
  elif line.startswith('A2_AT '):
   _,id,counts=line.split(' ',2);r['exits_at'][int(id)]=json.loads(counts)
 for l in r['lines']['out']:
  if l.startswith('\x1eA2G '):r['guest_ticks']=[int(x,16) for x in l.split()[1:]]
rows=[r for r in d['samples'] if not r['warmup']]
for key in sorted(set(r['image']+'/'+r['case'] for r in rows)):
 a=[r for r in rows if r['image']+'/'+r['case']==key];v={'n':len(a),'load':[min(r['load'][0] for r in a),max(r['load'][0] for r in a)],'phases':{},'total':{}}
 for k in ['ready_us','run_us','user_us','sys_us','cold_us','reap_us']:v['total'][k]=stats([r[k] for r in a])
 phases=[('pre-main',None,0),('argv seed clock',0,1),('console configure',1,2),('payload config',2,3),('sandbox prepare',3,4),('sandbox apply',4,5),('ack',5,6),('libkrun context',6,20),('choose payload',20,21),('anonymous RAM mmap',21,23),('image read to RAM',23,24),('payload finish',24,26),('commandline',26,27),('HV VM create',27,28),('map prelude',28,29),('HV map memory',29,30),('devices GIC FDT',30,32),('thread startup',32,33),('HV vCPU create',33,34),('vCPU register setup',34,40),('guest boot to READY',40,50),('parked idle',50,51),('RUN to DONE',51,52),('DONE to shutdown',52,90),('console teardown',90,99)]
 for name,l,h in phases:
  pairs=[r for r in a if h in r['marks'] and (l is None or l in r['marks'])]
  if not pairs:continue
  s={}
  for k in ['user_us','sys_us','ns']:
   vals=[r['marks'][h][k]-(r['marks'][l][k] if l is not None else (r['spawn_ns']-r['origin_ns'] if k=='ns' and 'origin_ns' in r else 0)) for r in pairs]
   s['wall_us' if k=='ns' else k]=stats([x/1000 if k=='ns' else x for x in vals])
  v['phases'][name]=s
 for l,h,name in [(50,51,'idle'),(51,52,'run'),(0,50,'boot')]:
  bb=[]
  for r in a:
   if h in r['exits_at'] and (l in r['exits_at'] or l==0):bb.append([x-y for x,y in zip(r['exits_at'][h],r['exits_at'].get(l,[0]*80))])
  if bb:v['exits_'+name]={str(i):stats([r[i] for r in bb]) for i in range(80) if any(r[i] for r in bb)}
 gt=[r for r in a if 'guest_ticks' in r]
 if gt:
  v['guest']={}
  for l,h,name in [(0,1,'boot BSS clear'),(1,2,'kernel MMU'),(2,3,'FDT config'),(3,4,'virtio console init'),(4,5,'GIC init'),(6,7,'EL0 pages argv'),(7,8,'aliases cache clean'),(8,10,'libc to qjs main'),(10,11,'qjs main to runtime'),(11,13,'JS runtime'),(13,12,'runtime to context'),(12,14,'JS context modules'),(14,15,'helpers to bootstrap eval'),(15,16,'bootstrap eval to READY')]:
   vals=[(r['guest_ticks'][h]-r['guest_ticks'][l])*125/3/1000 for r in gt if r['guest_ticks'][h] and r['guest_ticks'][l]]
   if vals:v['guest'][name]=stats(vals)
 out[key]=v
(R/'raw'/('summary-'+file.stem+'.json')).write_text(json.dumps(out,indent=2))
for key,v in out.items():
 print(key,v['n'],v['load'])
 for p,s in v['phases'].items():print(p,round(s['wall_us']['p50'],1),round(s['user_us']['p50'],1),round(s['sys_us']['p50'],1))
 print('exits run',v.get('exits_run'));print('guest',[(k,round(s['p50'],1)) for k,s in v.get('guest',{}).items()])
