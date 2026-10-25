import os,subprocess,select,time,json,sys
p=subprocess.Popen(['/tmp/jitk-02/r2/host','/tmp/jitk-02/r2/kernel.bin'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={**os.environ,'JITK_TICK_US':sys.argv[1] if len(sys.argv)>1 else '1000'})
try:
 deadline=time.monotonic()+3;buf=b''
 while time.monotonic()<deadline:
  rs,_,_=select.select([p.stdout,p.stderr],[],[],.1)
  for r in rs:
   b=os.read(r.fileno(),65536)
   if b:print(('OUT' if r==p.stdout else 'ERR'),repr(b),flush=True);buf+=b
  if b'"ready"' in buf:
   p.stdin.write(json.dumps({'t':'run','code':'return 1+1','ns':{}}).encode()+b'\n');p.stdin.flush();buf=b''
  if p.poll() is not None:break
finally:
 if p.poll() is None:p.kill()
 p.wait()
 print('exit',p.returncode)
