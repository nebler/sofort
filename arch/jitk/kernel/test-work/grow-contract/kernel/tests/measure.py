#!/usr/bin/env python3
import os,sys,time,json,select,subprocess,statistics,resource
from pathlib import Path
import importlib.util
_spec=importlib.util.spec_from_file_location('bench06',Path(__file__).resolve().parents[2]/'bench/run.py')
_bench=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_bench)
def load_gate():return _bench.gate(6,.25,.1)
ROOT=Path(os.environ.get('JITK_TEST_OUTPUT',str(Path(__file__).resolve().parents[1]/'test-results'))).resolve()
ROOT.mkdir(parents=True,exist_ok=True)
HOST=os.environ.get('JITK_TEST_HOST',str(Path(__file__).resolve().parent/'host.sh')); KERNEL=os.environ.get('JITK_TEST_KERNEL',str(Path(__file__).resolve().parents[1]/'dist/kernel.bin'))
def quant(a):
 s=sorted(a);return {'n':len(s),'p50':statistics.median(s),'p90':s[min(len(s)-1,int(len(s)*.90))],'p99':s[min(len(s)-1,int(len(s)*.99))]}
class VM:
 def __init__(self,tick=0,kernel=KERNEL,wait_go=False):
  self.started=time.perf_counter_ns();self.p=subprocess.Popen([HOST,kernel]+(["--wait-go"] if wait_go else []),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={**os.environ,'JITK_TICK_US':str(tick)})
  self.buf=b'';self.records=[];self.stderr=b'';self.streams=[self.p.stdout,self.p.stderr]
  if wait_go:
   deadline=time.monotonic()+5
   while b'JITK_WAIT_GO\n' not in self.stderr:
    rs,_,_=select.select([self.p.stderr],[],[],max(0,deadline-time.monotonic()))
    if not rs:self.close();raise TimeoutError('pre-spawn preparation')
    b=os.read(self.p.stderr.fileno(),65536)
    if not b:self.close();raise RuntimeError('pre-spawn host exited')
    self.stderr+=b
 def send(self,m):
  b=json.dumps(m,ensure_ascii=True,separators=(',',':')).encode()+b'\n';self.p.stdin.write(b);self.p.stdin.flush()
 def recv(self,timeout=3):
  end=time.monotonic()+timeout
  while True:
   if b'\n' in self.buf:
    line,self.buf=self.buf.split(b'\n',1)
    if line.startswith(b'\x1e'):self.records.append(line.decode());continue
    return json.loads(line)
   if self.p.stdout not in self.streams:raise RuntimeError({'exit':self.p.poll(),'records':self.records,'stderr':self.stderr.decode(),'partial':self.buf.decode()})
   rs,_,_=select.select(self.streams,[],[],max(0,end-time.monotonic()))
   if not rs:raise TimeoutError({'records':self.records,'stderr':self.stderr.decode(),'partial':self.buf.decode()})
   for r in rs:
    b=os.read(r.fileno(),65536)
    if not b:self.streams.remove(r);continue
    if r==self.p.stdout:self.buf+=b
    else:self.stderr+=b
 def ready(self):
  m=self.recv(timeout=10);assert m=={'t':'ready','v':1},m
  return (time.perf_counter_ns()-self.started)/1e6
 def run(self,code,ns=None):self.send({'t':'run','code':code,'ns':ns or {'test':['echo']}})
 def close(self):
  if self.p.poll() is None:self.p.kill()
  self.p.wait();self.p.stdin.close();self.p.stdout.close();self.p.stderr.close()
def cpu(pid):
 t=subprocess.check_output(['ps','-p',str(pid),'-o','time='],text=True).strip();m,s=t.split(':');return int(m)*60+float(s)
def park(tick,count=1000,idle=10,kernel=KERNEL):
 v=VM(tick,kernel);result={'gate':load_gate(),'tick_us':tick,'load':subprocess.check_output(['uptime'],text=True).strip()}
 try:
  result['ready_ms']=v.ready();c0=cpu(v.p.pid);start=time.monotonic();time.sleep(idle);elapsed=time.monotonic()-start;c1=cpu(v.p.pid)
  result.update(idle_seconds=elapsed,idle_cpu_seconds=c1-c0,idle_core_percent=(c1-c0)/elapsed*100)
  v.run(f'for(let i=0;i<{count};i++) await test.echo(i); return "ok";');rtt=[];start=time.perf_counter_ns()
  for i in range(count):
   m=v.recv();assert m['t']=='call' and m['id']==i+1 and m['args']==[i],m
   now=time.perf_counter_ns();rtt.append((now-start)/1e3)
   # Make a genuine park between selected replies; send only after outbound call.
   if i%100==0:time.sleep(.003)
   start=time.perf_counter_ns();v.send({'t':'ret','id':m['id'],'ok':i})
  assert v.recv()=={'t':'done','ok':'ok'}
  result.update(exchanges=count,rtt_us=quant(rtt),records=v.records,status='PASS')
 except Exception as e:result.update(status='FAIL',error=repr(e),exchanges=locals().get('i',-1),rtt_us=quant(rtt) if locals().get('rtt') else None)
 finally:v.close()
 return result
def integration(n=30):
 result={'load':subprocess.check_output(['uptime'],text=True).strip()};boot=[];warm=[];batch=[];calls=[]
 result['sample_load']=[]
 for _ in range(n):
  g=load_gate();result['sample_load'].append({'gate':g,'uptime':subprocess.check_output(['uptime'],text=True).strip()})
  v=VM()
  try:
   boot.append(v.ready());time.sleep(.005)
   start=time.perf_counter_ns();v.run('return await test.echo(1);');m=v.recv();assert m['t']=='call';v.send({'t':'ret','id':m['id'],'ok':2});assert v.recv()=={'t':'done','ok':2};warm.append((time.perf_counter_ns()-start)/1e3)
  finally:v.close()
  v=VM()
  try:
   v.ready();time.sleep(.005);start=time.perf_counter_ns();v.run('return await Promise.all(Array.from({length:64},(_,i)=>test.echo(i)));')
   pending=[]
   for i in range(64):
    m=v.recv();assert m['t']=='call' and m['args']==[i] and m['id']==i+1,m;pending.append(m)
   call_end=time.perf_counter_ns()
   for m in reversed(pending):v.send({'t':'ret','id':m['id'],'ok':m['args'][0]})
   assert v.recv()=={'t':'done','ok':list(range(64))}
   batch.append((time.perf_counter_ns()-start)/1e3);calls.append((call_end-start)/1e3)
  finally:v.close()
 result.update(ready_ms=quant(boot),parked_one_call_us=quant(warm),promise64_us=quant(batch),emit64_us=quant(calls),throughput_calls_s=quant([64e6/t for t in batch]),status='PASS')
 return result
if __name__=='__main__':
 action=sys.argv[1] if len(sys.argv)>1 else 'park'
 result=park(int(sys.argv[2])) if action=='park' else integration()
 out=ROOT/(f'parking-{sys.argv[2]}.json' if action=='park' else 'integration.json');out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
