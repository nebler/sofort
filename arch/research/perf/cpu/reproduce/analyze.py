import json,statistics as st,collections
from pathlib import Path
R=Path('/tmp/sofort-a2');out={}
def q(a,p):
 a=sorted(a);i=(len(a)-1)*p;lo=int(i);return a[lo]+(a[min(lo+1,len(a)-1)]-a[lo])*(i-lo)
def stats(a):return {'n':len(a),'mean':st.mean(a),'p50':st.median(a),'p90':q(a,.9),'p99':q(a,.99),'min':min(a),'max':max(a)}
for f in R.glob('raw/host-*-*.json'):
 d=json.loads(f.read_text());rows=d.get('rows',[])
 if not rows or 'start' not in rows[0]:continue
 result={}
 for label in sorted(set(r['label'] for r in rows)):
  a=[r for r in rows if r['label']==label and not r['warmup']];v={}
  for k in ['user','system']:v[k]=stats([r['end']['cpu'][k]-r['start']['cpu'][k] for r in a])
  v['wall']=stats([r['end']['t']-r['start']['t'] for r in a]);v['load']=[min(r['load'][0] for r in a),max(r['load'][0] for r in a)]
  for k in ['loopCount','events','eventsWaiting']:v['uv_'+k]=stats([r['end']['uv'][k]-r['start']['uv'][k] for r in a])
  for k in ['voluntaryContextSwitches','involuntaryContextSwitches']:v[k]=stats([r['end']['ru'][k]-r['start']['ru'][k] for r in a])
  if all('serviceEnd' in r and 'children' in r['start'] for r in a):
   for label2,finish in [('request','end'),('service','serviceEnd')]:
    v[label2+'_node_cpu']=stats([sum(r[finish]['cpu'][k]-r['start']['cpu'][k] for k in ['user','system']) for r in a])
    v[label2+'_child_cpu']=stats([sum(r[finish]['children'][k]-r['start']['children'][k] for k in ['user','system']) for r in a])
  phases={}
  for l,h in [('start','acquired'),('acquired','runSent'),('runSent','done'),('runSent','firstCall'),('firstCall','firstRet'),('firstRet','done'),('done','resolve')]:
   pairs=[]
   for r in a:
    m={x['name']:x for x in r['marks']}
    if l in m and h in m:pairs.append((m[l],m[h]))
   if pairs:phases[l+'→'+h]={'wall':stats([b['t']-a['t'] for a,b in pairs]),'user':stats([b['cpu']['user']-a['cpu']['user'] for a,b in pairs]),'sys':stats([b['cpu']['system']-a['cpu']['system'] for a,b in pairs])}
  v['phases']=phases;result[label]=v
 out[f.name]=result
for f in R.glob('raw/mcp-server-*.json'):
 d=json.loads(f.read_text());v={}
 for ci,c in enumerate(['return2','one_tool']):
  # Client interleaves per iteration; associate by sequence, not timestamp wall alignment.
  pid=d['pid'];clientfile='mcp-client-hooks-profile.json' if len(d['rows'])>150 else 'mcp-client-hooks.json';client=json.loads((R/'raw'/clientfile).read_text())['rows']
  pairs=[(a,b) for a,b in zip(client,d['rows']) if a['case']==c and not a['warmup']];a=[b for _,b in pairs]
  v[c]={'wall':stats([r['end']['t']-r['begin']['t'] for r in a]),'client_wall':stats([r['end']-r['t'] for r,_ in pairs]),'user':stats([r['end']['cpu']['user']-r['begin']['cpu']['user'] for r in a]),'system':stats([r['end']['cpu']['system']-r['begin']['cpu']['system'] for r in a]),'counts':{k:stats([r['counts'].get(k,0) for r in a]) for k in set(k for r in a for k in r['counts'])},'phases':{}}
  for l,h in [('stdinChunk','handlerBegin'),('handlerBegin','start'),('start','acquired'),('acquired','bodyBegin'),('bodyBegin','bodyEnd'),('bodyEnd','runSent'),('runSent','done'),('runSent','firstCall'),('firstCall','firstRet'),('firstRet','done'),('done','resolve'),('resolve','handlerEnd'),('handlerEnd','stdoutWrite')]:
   pairs2=[]
   for r in a:
    m={x['name']:x for x in r['marks']}
    if l in m and h in m:pairs2.append((m[l],m[h]))
   if pairs2:v[c]['phases'][l+'→'+h]={'wall':stats([b['us']-a['us'] for a,b in pairs2]),'cpu':stats([sum(b['cpu'][k]-a['cpu'][k] for k in ['user','system']) for a,b in pairs2])}
 out[f.name]=v
(R/'raw/summary-host.json').write_text(json.dumps(out,indent=2))
for f,v in out.items():
 print(f)
 for l,s in v.items():print(l,*(f'{k}={s[k]["p50"]:.1f}' for k in ['wall','user','system'] if k in s))

for f in R.glob('raw/mcp-client-*.json'):
 d=json.loads(f.read_text());v={}
 for c in ['return2','one_tool']:
  a=[r for r in d['rows'] if not r['warmup'] and r['case']==c]
  v[c]={'wall':stats([r['end']-r['t'] for r in a]),'client_cpu':stats([sum(r['cpu'].values()) for r in a]),'load':[min(r['load'][0] for r in a),max(r['load'][0] for r in a)]}
 out[f.name]=v
(R/'raw/summary-host.json').write_text(json.dumps(out,indent=2))
