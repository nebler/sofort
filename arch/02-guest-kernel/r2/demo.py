#!/usr/bin/env python3
"""Real virtio v1 demo: collect 64 calls before answering any, then reverse."""
from measure import VM
import time,json
v=VM()
try:
 boot=v.ready();time.sleep(.01);start=time.perf_counter_ns()
 v.run('return await Promise.all(Array.from({length:64},(_,i)=>test.echo(i)));')
 calls=[v.recv() for _ in range(64)]
 assert [m['id'] for m in calls]==list(range(1,65))
 assert all(m['t']=='call' and m['args']==[i] for i,m in enumerate(calls))
 for m in reversed(calls):v.send({'t':'ret','id':m['id'],'ok':m['args'][0]})
 done=v.recv();assert done=={'t':'done','ok':list(range(64))},done
 elapsed=(time.perf_counter_ns()-start)/1e6
 print(json.dumps({'status':'PASS','transport':'real virtio-console','calls':64,'reply_order':'64..1','result':done['ok'],'warm_ms':elapsed,'calls_s':64e3/elapsed,'ready_ms':boot},indent=2))
finally:v.close()
