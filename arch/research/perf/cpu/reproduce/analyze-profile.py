import json,collections,bisect
from pathlib import Path
R=Path('/tmp/sofort-a2');res={}
for p in R.glob('raw/*.cpuprofile'):
 d=json.loads(p.read_text());pid=int(p.name.split('.')[3]);log=R/'raw'/('host-profile-log.json' if pid==68347 else f'mcp-server-{pid}.json')
 if not log.exists():continue
 rows=json.loads(log.read_text())['rows'];windows=sorted((x['begin']['hr'],x['end']['hr']) for x in rows);starts=[x[0] for x in windows];nodes={n['id']:n for n in d['nodes']};parent={c:n['id'] for n in d['nodes'] for c in n.get('children',[])};counts=collections.Counter();inclusive=collections.Counter();t=d['startTime'];inside=0;active=0
 for sample,delta in zip(d['samples'],d['timeDeltas']):
  t+=delta;i=bisect.bisect_right(starts,t)-1
  # Whole process profile: V8 and hrtime clock origins differ; do not silently align them.
  # Report samples for startup/refill/request combined, and use explicit probes for CPU/request.
  inside+=1;n=nodes[sample];cf=n['callFrame'];name=cf['functionName'] or '(anonymous)';url=cf.get('url','');key=name+' @ '+url
  counts[key]+=1
  if name not in ['(idle)','(program)']:active+=1
  seen=set();nid=sample
  while nid in nodes:
   cf=nodes[nid]['callFrame'];k=(cf['functionName'] or '(anonymous)')+' @ '+cf.get('url','');seen.add(k);nid=parent.get(nid)
  inclusive.update(seen)
 res[p.name]={'pid':pid,'request_windows_recorded_but_not_clock_aligned':len(windows),'whole_process_samples':inside,'nonidle_nonprogram_samples':active,'startTime':d['startTime'],'window_first':windows[0],'self':counts.most_common(45),'inclusive':inclusive.most_common(45)}
 print(p.name,inside,active,'starts',d['startTime'],windows[0]);print('\n'.join(str(x) for x in counts.most_common(14)))
(R/'raw/profile-summary.json').write_text(json.dumps(res,indent=2))
