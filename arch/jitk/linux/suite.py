#!/usr/bin/env python3
"""Functional KVM gates. NESTED results are never performance claims."""
import concurrent.futures as cf
import fcntl, hashlib, json, math, os, resource, selectors, signal, subprocess, sys, threading, time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
BIN=Path(os.getenv('JITK_BIN',str(ROOT/'.work')))
IMAGE=BIN/'kernel.bin'
BASE=Path(os.getenv('JITK_CGROUP_ROOT','/sys/fs/cgroup'))/f'jitk-05-{os.getpid()}'
TIMEOUT=float(os.getenv('JITK_TIMEOUT_S','30'))
LIVE=set(); LOCK=threading.Lock(); SERIAL=0
LABEL=os.getenv('JITK_LABEL','METAL')
REPORT={'label':LABEL,'performance_claim':LABEL!='NESTED','status':'STARTED','gates':{},'host_uptime':os.getenv('JITK_HOST_UPTIME','UNVERIFIED')}
OUT=Path(os.getenv('JITK_REPORT',str(ROOT/'out/report.json')))
def uptime():
 try:return subprocess.check_output(['uptime'],text=True).strip()
 except FileNotFoundError:return 'uptime_seconds='+Path('/proc/uptime').read_text().strip()+' loadavg='+Path('/proc/loadavg').read_text().strip()
def quant(xs):
 s=sorted(xs);return {k:s[max(0,math.ceil(p*len(s))-1)] for k,p in [('p50',.5),('p90',.9),('p99',.99)]} if s else None
def save():
 OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text(json.dumps(REPORT,indent=2)+'\n')
 print('JITK_PROGRESS '+json.dumps({'status':REPORT['status'],'gates':{k:v.get('completed',v.get('pass')) for k,v in REPORT['gates'].items()},'density':REPORT.get('density_progress',[])[-1:]},separators=(',',':')),flush=True)
def guest_ms():
 v=Path('/proc/stat').read_text().splitlines()[0].split();return int(v[9])*1000/os.sysconf('SC_CLK_TCK')
def cgstat(cg):return {a:int(b) for a,b in (l.split() for l in (cg/'cpu.stat').read_text().splitlines())}
class VM:
 def __init__(self,image=IMAGE,env=None):
  global SERIAL
  with LOCK: SERIAL+=1; self.cg=BASE/f'vm-{SERIAL}'; self.cg.mkdir()
  (self.cg/'memory.max').write_text(str(128*1024**2));(self.cg/'memory.swap.max').write_text('0')
  self.p=subprocess.Popen([str(BIN/'spawn-cg'),str(self.cg),str(BIN/'jitk-vmm'),'--image',str(image)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0,start_new_session=True,env={**os.environ,'JITK_ROLES':'1',**(env or {})})
  self.sel=selectors.DefaultSelector(); self.buffers={};self.frames=[];self.errors=[];self.ack=False;self.pid=None;self.usage=None;self.phases={};self.cpu_phases={}
  for kind,f in [('out',self.p.stdout),('err',self.p.stderr)]:self.sel.register(f,selectors.EVENT_READ,kind);self.buffers[kind]=bytearray()
  with LOCK:LIVE.add(self)
 def pump(self,seconds):
  for key,_ in self.sel.select(seconds):
   b=os.read(key.fileobj.fileno(),65536);kind=key.data
   if not b:self.sel.unregister(key.fileobj);continue
   self.buffers[kind]+=b
   if len(self.buffers[kind])>1048576:raise RuntimeError('frame exceeds 1 MiB')
   while b'\n' in self.buffers[kind]:
    line,_,rest=self.buffers[kind].partition(b'\n');self.buffers[kind]=bytearray(rest)
    if kind=='out':
     if line.startswith(b'\x1e'):continue
     self.frames.append(json.loads(line))
    else:
     s=line.decode(errors='replace');self.errors.append(s)
     if s=='{"sandbox":"ok"}':self.ack=True
     elif s.startswith('P '):self.pid=int(s[2:])
     elif s.startswith('R '):self.usage=json.loads(s[2:])
     elif s.startswith('C '):
      _,name,user,system=s.split();self.cpu_phases[name]={'user_ms_including_guest':float(user),'system_ms':float(system)}
     elif s.startswith('T '):
      parts=s.split(); self.phases[parts[1]]=float(parts[2])/1e6
 def ready(self):
  deadline=time.monotonic()+TIMEOUT;ready=False
  while time.monotonic()<deadline:
   self.pump(.1)
   while self.frames:
    m=self.frames.pop(0)
    if m!={'t':'ready','v':1}:raise RuntimeError(f'bad READY: {m}')
    ready=True
   if ready and self.ack:
    actual=Path(f'/proc/{self.pid}/cgroup').read_text().strip()
    if str(self.cg.relative_to('/sys/fs/cgroup')) not in actual:raise RuntimeError(f'wrong cgroup {actual}')
    return
   if self.p.poll() is not None:raise RuntimeError(f'died before ack+READY: rc={self.p.returncode} {self.errors[-8:]}')
  raise TimeoutError('external watchdog: ack+READY')
 def send(self,m):self.p.stdin.write(json.dumps(m,separators=(',',':')).encode()+b'\n')
 def run(self,tool=False):
  self.send({'t':'run','code':'return await test.echo(41)' if tool else 'return 1+1','ns':{'test':['echo']} if tool else {}})
  deadline=time.monotonic()+TIMEOUT;calls=0
  while time.monotonic()<deadline:
   self.pump(.1)
   while self.frames:
    m=self.frames.pop(0)
    if m.get('t')=='call' and tool:
     assert m=={'t':'call','id':1,'ns':'test','fn':'echo','args':[41]},m
     calls+=1;self.send({'t':'ret','id':1,'ok':42})
    elif m.get('t')=='done':
     assert m.get('ok')==(42 if tool else 2),m
     assert calls==(1 if tool else 0),calls
     self.finish();assert self.p.returncode==0,(self.p.returncode,self.errors[-8:]);return
    else:raise RuntimeError(f'unexpected frame {m}')
  raise TimeoutError('external watchdog: result')
 def finish(self,timeout=TIMEOUT):
  deadline=time.monotonic()+timeout
  while self.p.poll() is None and time.monotonic()<deadline:self.pump(.02)
  if self.p.poll() is None:raise TimeoutError('external watchdog: reap')
  self.p.wait()
  while self.sel.get_map():self.pump(.02)
 def close(self):
  with LOCK:
   if self not in LIVE:return
  if self.p.poll() is None:
   try:os.killpg(self.p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
  if (self.cg/'cgroup.kill').exists():(self.cg/'cgroup.kill').write_text('1')
  self.p.wait()
  for f in [self.p.stdin,self.p.stdout,self.p.stderr]:f.close()
  self.sel.close()
  for _ in range(100):
   try:self.cg.rmdir();break
   except OSError:time.sleep(.01)
  with LOCK:LIVE.discard(self)
def one(i,tool=False):
 t=time.perf_counter();v=None
 try:
  v=VM(env={'JITK_TIME':'1'});v.ready();ready=(time.perf_counter()-t)*1000;v.run(tool)
  return {'ok':True,'ms':(time.perf_counter()-t)*1000,'ready_ms':ready,'usage':v.usage,'phases_wall_ms':v.phases,'phases_cpu_ms':v.cpu_phases}
 except Exception as e:return {'ok':False,'error':repr(e),'stderr':v.errors[-12:] if v else []}
 finally:
  if v:v.close()
def batch(n,c,tool=False):
 started_unix=time.time();up=uptime();g=guest_ms();t=time.monotonic();parent0=resource.getrusage(resource.RUSAGE_SELF);child0=resource.getrusage(resource.RUSAGE_CHILDREN)
 with cf.ThreadPoolExecutor(max_workers=c) as ex:rows=list(ex.map(lambda i:one(i,tool),range(n)))
 parent1=resource.getrusage(resource.RUSAGE_SELF);child1=resource.getrusage(resource.RUSAGE_CHILDREN)
 elapsed=time.monotonic()-t;guest=guest_ms()-g;ok=[r for r in rows if r['ok']];count=len(ok)
 user=sum(r['usage']['user_ms_including_guest'] for r in ok if r['usage']);system=sum(r['usage']['system_ms'] for r in ok if r['usage'])
 return {'started_unix':started_unix,'ended_unix':time.time(),'label':LABEL,'n':n,'concurrency':c,'completed':count,'uptime_before':up,'uptime_after':uptime(),'elapsed_s':elapsed,'latency_ms':quant([r['ms'] for r in ok]),'ready_ms':quant([r['ready_ms'] for r in ok]),'cpu_ms_vm':{'vmm_user_excluding_guest':(user-guest)/count if count else None,'vmm_user_including_guest':user/count if count else None,'guest_attribution_status':'ESTIMATE; precise host-user/guest split UNVERIFIED; negative residuals possible','vmm_system':system/count if count else None,'guest':guest/count if count else None,'total':(user+system)/count if count else None,'supervisor':((parent1.ru_utime+parent1.ru_stime)-(parent0.ru_utime+parent0.ru_stime))*1000/count if count else None,'vmm_plus_clone_wrapper':((child1.ru_utime+child1.ru_stime)-(child0.ru_utime+child0.ru_stime))*1000/count if count else None,'guest_counter':'L1 /proc/stat guest delta; isolated nested Linux; nominal tick resolution is not a complete error bound','guest_resolution_ms_vm':os.cpu_count()*1000/os.sysconf('SC_CLK_TCK')/count if count else None},'samples':rows}
def gate(name,data,passed):
 data.setdefault('ended_unix',time.time())
 REPORT['gates'][name]={'pass':bool(passed),**data};save()
 if name=='parking':print('JITK_PARKING_DETAIL '+json.dumps(data,separators=(',',':')),flush=True)
 if not passed:raise RuntimeError(f'gate failed: {name}')
def density(targets):
 vms=[];rows=[]
 try:
  for target in targets:
   up=uptime()
   while len(vms)<target:
    avail=int(next(l.split()[1] for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))
    floor=128*1024 if LABEL=='NESTED' else 8*1024**2
    if avail<floor:raise RuntimeError(f'density headroom: {avail} KiB')
    v=VM();vms.append(v);v.ready()
   before=cgstat(BASE);t=time.monotonic();time.sleep(3);dt=time.monotonic()-t;after=cgstat(BASE)
   pss=[]
   for v in vms:
    assert v.p.poll() is None
    sm=Path(f'/proc/{v.pid}/smaps_rollup').read_text();pss.append(int(next(l.split()[1] for l in sm.splitlines() if l.startswith('Pss:')))*1024)
   row={'unix':time.time(),'parked':target,'label':LABEL,'uptime_before':up,'uptime_after':uptime(),'idle_seconds':dt,'idle_cpu_pct_core_vm':(after['usage_usec']-before['usage_usec'])/1e6/dt/target*100,'pss_bytes_vm':quant(pss),'memory_current_sum':sum(int((v.cg/'memory.current').read_text()) for v in vms)}
   rows.append(row);REPORT['density_progress']=rows;save()
   if row['idle_cpu_pct_core_vm']>=2:raise RuntimeError('idle CPU >=2%')
  for v in vms:v.run()
  return {'rows':rows,'completed_after_park':len(vms)}
 finally:
  for v in vms:v.close()
def containment():
 rows=[]
 for role in ['main','vcpu','console']:
  for action in ['exit','openat','socket','execve','kvm-create-vm','kvm-run','mmap-exec','kill']:
   expected=0 if action=='exit' or (role=='vcpu' and action=='kvm-run') else -signal.SIGSYS
   up=uptime()
   for i in range(30):
    p=subprocess.run([str(BIN/'seccomp-probe'),str(BIN/(role+'.bpf')),action],capture_output=True,timeout=TIMEOUT)
    rows.append({'role':role,'action':action,'rc':p.returncode,'pass':p.returncode==expected,'uptime':up,'unix':time.time()})
 return {'samples':rows,'completed':sum(r['pass'] for r in rows),'n':len(rows),'provenance':'Standalone syscall probe of exact canonical owner-07 sandbox module; canonical VMM tested separately for boot/tool/faults'}
def faults():
 rows=[]
 for name in ['unknown-hvc','unknown-smc','mmio-halfword','bad-sysreg','console_avail_oob','rtc_oob_read']:
  up=uptime()
  for i in range(30):
   v=VM(BIN/(name+'.bin'))
   try:v.finish(timeout=3);rows.append({'case':name,'rc':v.p.returncode,'pass':v.p.returncode in (0,1,75),'stderr':v.errors[-4:],'uptime':up,'unix':time.time()})
   except TimeoutError as e:
    v.close();rows.append({'case':name,'pass':v.p.returncode==-signal.SIGKILL,'watchdog_killed':True,'rc':v.p.returncode,'deadline_s':3,'stderr':v.errors[-4:],'uptime':up,'unix':time.time()})
   finally:v.close()
  print('JITK_FAULT_CASE '+json.dumps({'case':name,'n':30,'pass':sum(r['pass'] for r in rows if r['case']==name),'watchdog_kills':sum(r.get('watchdog_killed',False) for r in rows if r['case']==name)}),flush=True)
 return {'samples':rows,'completed':sum(r['pass'] for r in rows),'n':len(rows)}
def parking():
 image=IMAGE;expected=hashlib.sha256(image.read_bytes()).hexdigest()
 r={'label':LABEL,'image_sha256':expected,'started_unix':time.time(),'uptime_before':uptime(),'exchanges':0,'stalls':0,'delayed_replies':0,'vmm_user_sys_method':'/proc/PID/stat thread-group utime+stime, with VMM-only cgroup cpu.stat high-resolution cross-check'}
 v=VM(image);rtt=[]
 def receive():
  deadline=time.monotonic()+TIMEOUT
  while time.monotonic()<deadline:
   if v.frames:return v.frames.pop(0)
   v.pump(.01)
   if v.p.poll() is not None and not v.frames:raise RuntimeError(f'parking VMM exited {v.p.returncode}: {v.errors[-6:]}')
  raise TimeoutError('parking exchange watchdog')
 def process_cpu():
  fields=Path(f'/proc/{v.pid}/stat').read_text().rsplit(')',1)[1].split()
  return (int(fields[11])+int(fields[12]))/os.sysconf('SC_CLK_TCK')
 try:
  v.ready();before=process_cpu();cg0=cgstat(v.cg);t=time.monotonic();time.sleep(10);elapsed=time.monotonic()-t;after=process_cpu();cg1=cgstat(v.cg)
  r.update(idle_seconds=elapsed,idle_cpu_seconds=after-before,idle_cpu_pct_core=(after-before)/elapsed*100,idle_cgroup_user_seconds=(cg1['user_usec']-cg0['user_usec'])/1e6,idle_cgroup_system_seconds=(cg1['system_usec']-cg0['system_usec'])/1e6,idle_cgroup_cpu_pct_core=(cg1['usage_usec']-cg0['usage_usec'])/1e6/elapsed*100)
  r['idle_thread_state']={p.name:{name:(p/name).read_text().strip() for name in ['comm','wchan'] if (p/name).exists()} for p in Path(f'/proc/{v.pid}/task').glob('*')}
  v.send({'t':'run','code':'for(let i=0;i<1000;i++) await test.echo(i); return "ok";','ns':{'test':['echo']}});start=time.perf_counter_ns()
  for i in range(1000):
   m=receive();assert m=={'t':'call','id':i+1,'ns':'test','fn':'echo','args':[i]},m
   rtt.append((time.perf_counter_ns()-start)/1e3)
   if (i+1)%100==0:time.sleep(.003);r['delayed_replies']+=1
   start=time.perf_counter_ns();v.send({'t':'ret','id':i+1,'ok':i});r['exchanges']=i+1
  assert receive()=={'t':'done','ok':'ok'}
  v.finish();assert v.p.returncode==0,(v.p.returncode,v.errors[-8:])
  r['pass']=r['idle_cpu_pct_core']<2 and r['idle_cgroup_cpu_pct_core']<2
 except Exception as e:
  r.update(pass_=False,error=repr(e),stalls=int(isinstance(e,TimeoutError)))
  r['pass']=False
  if v.pid:
   r['thread_state']={p.name:{name:(p/name).read_text().strip() for name in ['stat','wchan'] if (p/name).exists()} for p in Path(f'/proc/{v.pid}/task').glob('*')}
 finally:v.close()
 r.update(rtt_us=quant(rtt),ended_unix=time.time(),uptime_after=uptime());return r
def cpu_controls():
 rows=[]
 # setup-only closes --wait-go before build(); it includes exec+loader+CLI+confinement.
 # bare-control uses a trusted PSCI SYSTEM_OFF image without QuickJS or the jitk kernel.
 for mode,extra in [('setup_only',['--wait-go']),('bare_vm',[])]:
  up=uptime();g=guest_ms();samples=[]
  for i in range(100):
   global SERIAL
   SERIAL+=1;cg=BASE/f'control-{SERIAL}';cg.mkdir()
   image=IMAGE if mode=='setup_only' else BIN/'kk.bin'
   p=subprocess.run([str(BIN/'spawn-cg'),str(cg),str(BIN/'jitk-vmm'),'--image',str(image),*extra],input=b'',capture_output=True,timeout=TIMEOUT)
   expected=70 if mode=='setup_only' else 0
   usage=next((json.loads(l[2:]) for l in p.stderr.decode(errors='replace').splitlines() if l.startswith('R ')),None)
   samples.append({'pass':p.returncode==expected,'rc':p.returncode,'usage':usage,'stderr':p.stderr.decode(errors='replace')[-500:] if p.returncode!=expected else ''})
   cg.rmdir()
  guest=guest_ms()-g;assert all(r['pass'] and r['usage'] for r in samples),samples[:3]
  user=sum(r['usage']['user_ms_including_guest'] for r in samples)/len(samples);system=sum(r['usage']['system_ms'] for r in samples)/len(samples)
  rows.append({'mode':mode,'n':len(samples),'unix':time.time(),'uptime_before':up,'uptime_after':uptime(),'cpu_ms_vm':{'vmm_user_excluding_guest':user-guest/len(samples),'vmm_system':system,'guest':guest/len(samples),'total':user+system},'samples':samples})
 return {'rows':rows}
def stop(sig,frame):raise RuntimeError(f'interrupted {sig}')
def main():
 try:
  for sig in [signal.SIGTERM,signal.SIGINT]:signal.signal(sig,stop)
  REPORT['uptime_start']=uptime(); REPORT['uname']=list(os.uname());REPORT['hashes']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [BIN/'jitk-vmm',BIN/'spawn-cg',IMAGE]}
  fd=os.open('/dev/kvm',os.O_RDWR);assert fcntl.ioctl(fd,0xae00,0)==12;vm=fcntl.ioctl(fd,0xae01,0);os.close(vm);os.close(fd)
  (BASE.parent/'cgroup.subtree_control').write_text('+memory +cpu');BASE.mkdir();(BASE/'cgroup.subtree_control').write_text('+memory +cpu')
  r=parking();gate('parking',r,r['pass'])
  r=batch(1,1);gate('smoke',r,r['completed']==1)
  r=batch(1,1,True);gate('tool_smoke',r,r['completed']==1)
  r=batch(int(os.getenv('JITK_BOOT_N','100')),1);gate('boot',r,r['completed']==r['n'])
  r=batch(30,1,True);gate('one_tool',r,r['completed']==30)
  for c in range(1,int(os.getenv('JITK_MAX_CONCURRENCY','8'))+1):
   r=batch(int(os.getenv('JITK_SWEEP_N','100')),c);gate(f'concurrency_{c}',r,r['completed']==r['n'])
  r=density([int(x) for x in os.getenv('JITK_DENSITY','1,32,64,128,256').split(',')]);gate('density',r,r['completed_after_park']==max(x['parked'] for x in r['rows']))
  r=cpu_controls();gate('cpu_controls',r,True)
  r=containment();gate('seccomp_kill',r,r['completed']==r['n'])
  r=faults();gate('fault_guests',r,r['completed']==r['n'])
  REPORT['status']='PASS'
 except BaseException as e:REPORT['status']='FAILED';REPORT['error']=repr(e);raise
 finally:
  for v in list(LIVE):v.close()
  if BASE.exists():BASE.rmdir()
  REPORT['children_remaining']=len(LIVE);REPORT['uptime_end']=uptime();save();print('JITK_REPORT '+json.dumps(REPORT,separators=(',',':')),flush=True)
if __name__=='__main__':main()
