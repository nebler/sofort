#!/usr/bin/env python3
from measure import *
result={'load':subprocess.check_output(['uptime'],text=True).strip()}
v=VM(wait_go=True)
try:
 a=cpu(v.p.pid);start=time.monotonic();time.sleep(10);elapsed=time.monotonic()-start;b=cpu(v.p.pid)
 result.update(idle_seconds=elapsed,idle_cpu_seconds=b-a,idle_core_percent=(b-a)/elapsed*100)
finally:v.close()
times=[]
for _ in range(30):
 v=VM(wait_go=True)
 try:
  start=time.perf_counter_ns();v.p.stdin.write(b'G');v.p.stdin.flush();v.ready();v.run('return await test.echo(1);');m=v.recv();assert m['t']=='call';v.send({'t':'ret','id':1,'ok':2});assert v.recv()=={'t':'done','ok':2};times.append((time.perf_counter_ns()-start)/1e3)
 finally:v.close()
result.update(status='PASS',go_to_result_us=quant(times));(ROOT/'prespawn.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
