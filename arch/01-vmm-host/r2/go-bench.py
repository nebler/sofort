import json,math,os,pathlib,random,re,statistics,subprocess,time,runpy,types
b=types.SimpleNamespace(**runpy.run_path(str(pathlib.Path(__file__).with_name('cold-bench.py'))))
pk=types.SimpleNamespace(**runpy.run_path(str(pathlib.Path(__file__).with_name('parking-test.py'))))
def sample(binary,guest,idle=0):
 p=subprocess.Popen([str(b.TMP/binary),'--image',str(b.TMP/guest),'--mem-mib','64' if guest=='qjs-r1.bin' else '32','--wait-go'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0)
 err=b''
 try:
  while b'WAIT_GO' not in err:err+=pk.read(p.stderr.fileno(),30)
  c0=pk.cpu(p.pid);s=time.monotonic_ns()
  if idle:time.sleep(idle)
  idle_elapsed=(time.monotonic_ns()-s)/1e9;c1=pk.cpu(p.pid)
  start=time.monotonic_ns();p.stdin.write(b'g')
  out=b'';ready=None;gt=None
  while True:
   try:v=pk.read(p.stdout.fileno(),5)
   except RuntimeError:break
   out+=v
   if gt is None and (m:=re.search(rb'GUEST_TICKS ([0-9a-f]+)\n',out)):gt=b.ns(int(m[1],16))
   if ready is None and b'READY\n' in out:ready=time.monotonic_ns()
  p.wait(timeout=5)
  assert p.returncode==0,(p.returncode,out,err+p.stderr.read())
  r={'guest_ms':(gt-start)/1e6,'output':out.decode()}
  if ready:r['ready_ms']=(ready-start)/1e6
  if idle:r['idle_percent']=(c1-c0)/(idle_elapsed*1e9)*100;r['idle_seconds']=idle_elapsed
  return r
 finally:
  if p.poll() is None:p.kill()
  p.wait()
if __name__=='__main__':
 r={'uptime_start':subprocess.check_output(['uptime'],text=True).strip(),'samples':{k:[] for k in ['first.bin','qjs-r1.bin']}}
 r['idle']=sample('static-minimal','first.bin',5)
 for i in range(100):
  order=list(r['samples']);random.shuffle(order)
  for guest in order:r['samples'][guest].append(sample('static-minimal',guest))
  if i%20==19:print('go samples',i+1,flush=True)
 r['uptime_end']=subprocess.check_output(['uptime'],text=True).strip()
 r['summary']={k:b.summary([{a:c for a,c in v.items() if a.endswith('_ms')} for v in vs]) for k,vs in r['samples'].items()}
 (b.ROOT/'go-results.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r['summary'],indent=2),flush=True)
