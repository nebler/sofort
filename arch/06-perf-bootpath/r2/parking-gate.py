import json,os,time,subprocess,selectors
from pathlib import Path
from bench import stats,uptime,clock
R=Path(__file__).resolve().parent;T=Path('/tmp/jitk-06/r2')
def cpu(pid):
 raw=subprocess.check_output(['ps','-p',str(pid),'-o','time='],text=True).strip();m,s=raw.split(':');return int(m)*60+float(s)
def gate(mode):
 env=dict(os.environ,JITK_TICK_US='0' if mode=='A' else '1000')
 p=subprocess.Popen([str(T/'host-static'),'--image',str(T/'r2-tool.bin')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,bufsize=0)
 sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ,'out');sel.register(p.stderr,selectors.EVENT_READ,'err');buf=b'';err=b'';records=[]
 def recv(timeout=10):
  nonlocal buf,err
  end=time.monotonic()+timeout
  while True:
   if b'\n' in buf:
    line,buf=buf.split(b'\n',1)
    if line.startswith(b'\x1e') or line==b'FIRST':records.append(line.decode());continue
    return json.loads(line)
   if time.monotonic()>end:raise TimeoutError((buf,err))
   for key,_ in sel.select(.1):
    b=os.read(key.fileobj.fileno(),65536)
    if not b:raise RuntimeError((p.poll(),buf,err))
    if key.data=='err':err+=b
    else:buf+=b
 def send(m):p.stdin.write(json.dumps(m,separators=(',',':')).encode()+b'\n')
 r=dict(mode=mode,uptime_start=uptime(),exchanges=0)
 try:
  assert recv()=={'t':'ready','v':1}
  c0=cpu(p.pid);start=time.monotonic();time.sleep(10);elapsed=time.monotonic()-start;c1=cpu(p.pid)
  r.update(idle_wall_s=elapsed,idle_cpu_s=c1-c0,idle_core_percent=(c1-c0)/elapsed*100,idle_core_percent_upper=(c1-c0+.01)/elapsed*100,cpu_counter_resolution_s=.01)
  send(dict(t='run',code='for(let i=0;i<1000;i++) await math.add(1,1); return 2;',ns={'math':['add']}));start=clock();rtt=[]
  for i in range(1000):
   m=recv();assert m['t']=='call' and m['id']==i+1 and m['args']==[1,1],m
   rtt.append((clock()-start)/1e6);r['exchanges']=i+1
   # Force genuine idle between calls, excluding host pause from RTT.
   time.sleep(.003);start=clock();send(dict(t='ret',id=m['id'],ok=2))
  assert recv()=={'t':'done','ok':2}
  r['rtt_ms']=rtt;r['rtt_summary']=stats(rtt);r['status']='PASS' if r['idle_core_percent_upper']<2 else 'FAIL_IDLE_CPU'
 finally:
  if p.poll() is None:p.kill()
  p.wait();p.stdin.close();p.stdout.close();p.stderr.close();sel.close()
 r['uptime_end']=uptime();return r
if __name__=='__main__':
 r={}
 for m in ['A','B']:
  r[m]=gate(m);print(m,{k:v for k,v in r[m].items() if k!='rtt_ms'},flush=True)
 (R/'parking-gate.json').write_text(json.dumps(r,indent=2))
