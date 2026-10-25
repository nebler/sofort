import json,statistics,math
from pathlib import Path
R=Path('/tmp/sofort-a4/raw')
def read(name):return json.loads((R/(name+'.json')).read_text())
def stats(v):
 v=sorted(v);return {'n':len(v),'p50':statistics.median(v),'p99':v[math.ceil(.99*len(v))-1],'min':v[0],'max':v[-1]}
def fmt(v):
 d=stats(v);f=lambda x:str(int(x)) if float(x).is_integer() else f'{x:.2f}'
 return f"{f(d['p50'])} ({f(d['min'])}–{f(d['max'])})"
def table(headers,rows):return '\n'.join(['| '+' | '.join(headers)+' |','|'+'|'.join(['---']*len(headers))+'|']+['| '+' | '.join(map(str,row))+' |'for row in rows])+'\n\n'
x=read('transport-final');b=read('transport-baseline');seq=read('transport-sequential100');j=read('transport-node-syscalls');out=[];summary={'environment':{k:x[k]for k in ['date','node','loadBefore','loadAfter']},'transport':{},'baseline':{},'components':{}}
names=['one','parallel10','result64k'];rs={n:[q for q in x['rows']if q['name']==n]for n in names}
assert all(len(v)==31 for v in rs.values())
for n,xs in rs.items():
 for q in xs:
  assert q['result']['result']['length']=={'one':1,'parallel10':10,'result64k':65536}[n]
  assert q['guest'][0]==sum(q['guest'][1:6]),q
  assert q['guest'][6]==q['host']['c'][1]
  assert q['guest'][7]==q['host']['c'][2]
  assert q['host']['c'][0]-1==sum(q['host']['c'][i]for i in [1,2,3,4,27,28])
  assert q['guest'][9]==q['host']['c'][15]
  assert q['guest'][11]==q['host']['c'][12]
 summary['transport'][n]={'windowUs':stats([q['windowUs']for q in xs]),'guest':{str(i):stats([q['guest'][i]for q in xs])for i in range(32)},'host':{str(i):stats([q['host']['c'][i]for q in xs])for i in range(30)},'sys':{str(i):stats([q['sys']['c'][i]for q in xs])for i in range(16)}}
out+=['## Current tool-round timings\n\nAll times are µs. Transport samples are individual rounds; component percentiles\nare percentiles of batch means. Empirical p99 with n=31 is the largest sample,\nnot a tail-latency guarantee.\n\n']
rows=[]
for n in names:
 bs=[q['result']['result']['guestRoundUs']for q in b['rows']if q['name']==n];ds=[q['windowUs']for q in rs[n]];summary['baseline'][n]=stats(bs)
 rows.append([n,len(bs),f"{statistics.median(bs):.2f}",f"{stats(bs)['p99']:.2f}",f"{statistics.median(ds):.2f}",f"{stats(ds)['p99']:.2f}"])
out.append(table(['Case','n','baseline p50','baseline p99','probes p50','probes p99'],rows))
a=[q['result']['result']['guestRoundUs']/100 for q in seq['rows']];out.append(f"Sequential 100-call cross-check: n={len(a)} sessions ×100 awaited calls, per-call\nmean p50 **{statistics.median(a):.2f} µs**, range {min(a):.2f}–{max(a):.2f} µs.\nThis amortizes one guest timing pair, not call serialization or policy.\n\n")
out.append(table(['Run','Load before','Load after'],[['baseline',b['loadBefore'],b['loadAfter']],['census',x['loadBefore'],x['loadAfter']],['sequential100',seq['loadBefore'],seq['loadAfter']]]))
out.append('## Counts per call / per ten-call batch\n\nCounts below are medians with observed min–max, n=31 per column. Concurrent\ncompletion, RX coalescing and scheduling legitimately vary counts.\n\n')
metrics=[('guest total syscalls',lambda q:q['guest'][0]),('guest read / ppoll',None),('guest writev(66)',lambda q:q['guest'][15]),('guest mmap(222)',lambda q:q['guest'][19]),('guest munmap(215)',lambda q:q['guest'][20]),('guest console TX copies/chunks',lambda q:q['guest'][8]),('guest console RX copies/chunks',lambda q:q['guest'][10]),('TX / RX wire bytes',None),('MMIO write exits',lambda q:q['host']['c'][1]),('MMIO read exits',lambda q:q['host']['c'][2]),('all actual HV returns, marker excluded',lambda q:q['host']['c'][0]-1),('guest WFI instructions',lambda q:q['guest'][13]),('WFX / canceled / vtimer exits',None),('actual HVF GIC SPI injection requests',lambda q:q['host']['c'][29]),('console TX worker park returns',lambda q:q['host']['c'][19]),('console RX worker park returns',lambda q:q['host']['c'][21]),('console poll returns',lambda q:q['host']['c'][17]),('console event-manager callbacks',lambda q:q['host']['c'][22]),('Node loop turns spanned',lambda q:q['tickStop']-q['tickStart']+1)]
rows=[]
for label,fn in metrics:
 if fn:vals=[fmt([fn(q)for q in rs[n]])for n in names]
 elif label=='guest read / ppoll':vals=[fmt([q['guest'][1]for q in rs[n]])+' / '+fmt([q['guest'][3]for q in rs[n]])for n in names]
 elif label=='TX / RX wire bytes':vals=[fmt([q['guest'][9]for q in rs[n]])+' / '+fmt([q['guest'][11]for q in rs[n]])for n in names]
 else:vals=[' / '.join(fmt([q['host']['c'][i]for q in rs[n]])for i in [3,4,27])for n in names]
 rows.append([label,*vals])
out.append(table(['Metric','one','Promise.all(10)','64 KiB result'],rows))
out.append('### Host stream and notification syscalls\n\nVMM counts include Darwin’s **pipe-backed eventfd** notifications. Node’s\nfirst call-delivery read precedes its callback probe; one initiating read is\nadded explicitly. Counts otherwise cover the stated probe interval. Polls\nalready sleeping at BEGIN can return inside it without an in-window entry.\nNode child stdio uses libuv stream plumbing; the separate pipe microbenchmark\nuses actual `pipe()` descriptors.\n\n')
sysidx=[0,4,6,8,10,12,14]
metrics=[('VMM console input read attempts',lambda q:q['host']['c'][10]),('VMM console input successful reads',lambda q:q['host']['c'][11]),('VMM console output write attempts',lambda q:q['host']['c'][14]),('VMM all read attempts (incl eventfd)',lambda q:q['sys']['c'][0]),('VMM all write attempts (incl eventfd)',lambda q:q['sys']['c'][4]),('VMM poll entries / returns',None),('VMM kevent entries',lambda q:q['sys']['c'][12]),('VMM selected POSIX syscall entries total',lambda q:sum(q['sys']['c'][i]for i in sysidx)),('Node read attempts (+initial call read)',lambda q:1+q['nodeSys'][0]+q['nodeSys'][6]),('Node write/writev attempts',lambda q:q['nodeSys'][4]+q['nodeSys'][8]),('Node kevent/kevent64 entries',lambda q:q['nodeSys'][12]+q['nodeSys'][14]),('Node selected entries (+initial read)',lambda q:1+sum(q['nodeSys'][i]for i in sysidx))]
rows=[]
for label,fn in metrics:
 vals=[fmt([fn(q)for q in rs[n]])for n in names]if fn else[fmt([q['sys']['c'][10]for q in rs[n]])+' / '+fmt([q['sys']['c'][11]for q in rs[n]])for n in names]
 rows.append([label,*vals])
out.append(table(['Measured syscall family','one','Promise.all(10)','64 KiB result'],rows))
out.append('### JSON and data movement\n\n')
metrics=[('Guest JSON encode / full decode','3 / 3','30 / 30','3 / 3'),('Host JSON encode',*[fmt([q['nodeCounts'].get('jsonEncode',0)for q in rs[n]])for n in names]),('Host all JSON.parse calls',*[fmt([q['nodeCounts'].get('jsonDecode',0)for q in rs[n]])for n in names]),('Host true envelope-key JSON decodes (source cross-check)','11','110','11'),('Host structuredClone calls',*[fmt([q['nodeCounts'].get('structuredClone',0)for q in rs[n]])for n in names]),('Host TextEncoder calls / bytes',*[fmt([q['nodeCounts'].get('textEncode',0)for q in rs[n]])+' / '+fmt([q['nodeCounts'].get('textEncodeBytes',0)for q in rs[n]])for n in names]),('Host TextDecoder calls / characters',*[fmt([q['nodeCounts'].get('textDecode',0)for q in rs[n]])+' / '+fmt([q['nodeCounts'].get('textDecodeChars',0)for q in rs[n]])for n in names])]
out.append(table(['Operation','one','Promise.all(10)','64 KiB result'],metrics))
out.append('Guest JSON counters are from the separately retained n=31 JS-counter run\n(`transport-node-syscalls.json`), cross-checked against HEAD source. Final syscall\ncensus embeds the **exact unmodified HEAD bootstrap**: wrapping the 1 KiB\n`String.fromCharCode(...bytes)` with another rest/spread function itself adds\nallocator syscalls, so that observer was removed from the authoritative census.\nThe supplemental “key decode” token classifier also counts the scalar `"x"`\nresult: 12 string-token parses means 11 keys plus one scalar, not 12 keys.\n\n')
# Isolated component summary.
out.append('## Isolated component microbenchmarks\n\n')
for file,title,shape_key,op_key,value_key in [('qjs-components','QuickJS in the clean HVF guest','shape','op','us'),('node-components','Node dispatcher and codec','shape','op','us'),('policy-components','Node policy, no credentials/network','mode',None,'us'),('pipe','Persistent fork child, two anonymous pipes','scenario',None,'batchUs')]:
 r=read(file);groups={}
 for row in r['rows']:groups.setdefault((row.get(shape_key),row.get(op_key)if op_key else ''),[]).append(row[value_key])
 summary['components'][file]={str(k):stats(v)for k,v in groups.items()}
 out.append(f'### {title}\n\n')
 rows=[]
 for k,v in groups.items():
  it=next(z for z in r['rows']if z.get(shape_key)==k[0]and(not op_key or z.get(op_key)==k[1]));rows.append([*k,len(v),it.get('n',it.get('iterations')),f'{statistics.median(v):.3f}',f"{stats(v)['p99']:.3f}"])
 out.append(table(['Shape','Operation','samples','iterations/sample','p50 µs','p99 µs'],rows))
 if file=='pipe':out.append('Scenario 0: one 61-byte request, 27-byte reply; 1: ten such calls\nper batch; 2: one 61-byte request, 65,564-byte reply. Requests use 61 bytes\nas a nearby fixed-size transport fixture; real census frames are 56/28 bytes\n(or 54/65,563 for bulk). Batch RTT is not divided by ten in this table.\n\n')
 if file=='policy-components':out.append('`executor_policy_path` includes argument codec round-trip, both clones,\nfreeze and async policy callback, decide/dispatch, and result codec. Run creation\nis outside the measured interval. The microbenchmark omits the abort signal to\navoid accumulating listeners across 2,000 repeated calls; actual census calls\nuse the real signal, deadlines and policy path.\n\n')
 if 'loadBefore'in r:out.append(f"Load: `{r['loadBefore']}` → `{r['loadAfter']}`.\n\n")
# Detailed Node stages, no cross-clock subtraction.
out.append('## Instrumented Node stages for one call\n\nThese are wall times from the same process clock with detailed probes active.\nThey explain the trace; they are not bare implementation CPU costs. Individual\nmedians do not sum to a median total.\n\n')
pairs=[('frame feed + validation','stdout.before','message'),('policy decide + argument conversion','policy.before','policy.decided'),('freeze + policy callback','policy.decided','policy.callback'),('policy dispatch + immediate provider','provider.before','provider.after'),('result conversion + writer scheduling','provider.after','send.before'),('reply encode + repeated validation','send.before','send.encoded'),('stream write + completion callback','send.encoded','stdin.callback')]
rows=[]
for label,start,end in pairs:
 vals=[]
 for q in rs['one']:
  ev={}
  for e in q['events']:
   if'ns'in e:ev.setdefault(e['event'],int(e['ns']))
  vals.append((ev[end]-ev[start])/1000)
 rows.append([label,31,f'{statistics.median(vals):.2f}',f"{stats(vals)['p99']:.2f}"])
out.append(table(['Stage','n','p50 µs','p99 µs'],rows))
(R/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');(R/'measured-tables.md').write_text(''.join(out));print('validated final samples and generated measured tables')
