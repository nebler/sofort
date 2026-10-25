#!/usr/bin/env python3
"""Sequential Popen -> libkrun builder completion. Not guest console-ready latency."""
import json, pathlib, selectors, statistics, subprocess, time
T=pathlib.Path('/tmp/jitk-05'); procs=[]; times=[]
try:
 for i in range(128):
  t=time.perf_counter()
  p=subprocess.Popen([str(T/'host_ready'),str(T/'kk_hang.bin')],cwd=T,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  procs.append(p)
  with selectors.DefaultSelector() as s:
   s.register(p.stderr,selectors.EVENT_READ)
   if not s.select(5): raise TimeoutError('VMM construction')
   line=p.stderr.readline().decode().strip()
  dt=1000*(time.perf_counter()-t)
  if line!='READY':
   print(json.dumps(dict(index=i+1,error=line,elapsed_ms=dt)),flush=True); break
  times.append(dt)
  if len(times) in [1,10,25,50,100,127]:
   print(json.dumps(dict(live=len(times),median_build_ms=statistics.median(times),p90_build_ms=sorted(times)[int((len(times)-1)*.9)],
    serial_build_vms_sec=len(times)/(sum(times)/1000),last_build_ms=dt)),flush=True)
finally:
 for p in procs:
  if p.poll() is None:p.kill()
 for p in procs:p.wait()
 print(json.dumps(dict(cleanup_live=sum(p.poll() is None for p in procs))),flush=True)
