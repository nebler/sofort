import os,sys,time,json,subprocess,select,resource,ctypes,random,hashlib,platform
from pathlib import Path
R=Path('/tmp/sofort-a2')
class Usage(ctypes.Structure):
 _fields_=[('uuid',ctypes.c_uint8*16)]+[(k,ctypes.c_uint64) for k in ('user_ns','system_ns','idle','interrupt','pageins','wired','rss','footprint','start','exit')]
L=ctypes.CDLL('/usr/lib/libproc.dylib')
def usage(pid):
 u=Usage();rc=L.proc_pid_rusage(pid,0,ctypes.byref(u));return None if rc else {k:int(getattr(u,k)) for k in ('user_ns','system_ns')}
def one(binary,image,case,parked,trace):
 env={'PATH':'/usr/bin:/bin',**({'A2_TRACE':'1'} if trace else {})}
 args=[str(R/binary),'--image',str(R/image),'--sandbox-profile',str(R/'profile.sbbin')]
 obs={'binary':binary,'image':image,'case':case,'parked':parked,'trace':trace,'load':os.getloadavg(),'uptime':subprocess.check_output(['uptime'],text=True).strip()}
 t0=time.perf_counter_ns();p=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0)
 fds={p.stdout.fileno():'out',p.stderr.fileno():'err'};buf={'out':b'','err':b''};events=[];lines={'out':[],'err':[]};run=None;ready=None;cpu_ready=None;cpu_run=None;cpu_done=None;done=None
 deadline=time.monotonic()+30
 try:
  while fds:
   if time.monotonic()>deadline:raise TimeoutError(lines)
   for fd in select.select(list(fds),[],[],.1)[0]:
    b=os.read(fd,65536);kind=fds[fd]
    if not b:del fds[fd];continue
    events.append({'kind':kind,'bytes':len(b),'ns':time.perf_counter_ns()-t0})
    buf[kind]+=b
    while b'\n' in buf[kind]:
     line,buf[kind]=buf[kind].split(b'\n',1);lines[kind].append(line.decode(errors='replace'));now=time.perf_counter_ns()
     if kind!='out' or line.startswith(b'\x1e'):continue
     m=json.loads(line)
     if m['t']=='ready':
      ready=now;cpu_ready=usage(p.pid)
      if parked:time.sleep(.005)
      cpu_run=usage(p.pid);run=time.perf_counter_ns();wire=json.dumps({'t':'run','code':'return 2;' if case=='return2' else 'return await test.echo(2);','ns':{'test':['echo']}},separators=(',',':')).encode()+b'\n';p.stdin.write(wire)
     elif m['t']=='call':
      p.stdin.write(json.dumps({'t':'ret','id':m['id'],'ok':2},separators=(',',':')).encode()+b'\n')
     elif m['t']=='done':
      done=now;cpu_done=usage(p.pid);assert m=={'t':'done','ok':2},m
  pid,status,u=os.wait4(p.pid,0);p.returncode=os.waitstatus_to_exitcode(status);end=time.perf_counter_ns()
  assert done and p.returncode==0,(lines,p.returncode)
  obs.update(spawn_ns=t0,ready_us=(ready-t0)/1000,run_us=(done-run)/1000,cold_us=(done-t0)/1000,reap_us=(end-t0)/1000,user_us=u.ru_utime*1e6,sys_us=u.ru_stime*1e6,nvcsw=u.ru_nvcsw,nivcsw=u.ru_nivcsw,cpu_ready=cpu_ready,cpu_run=cpu_run,cpu_done=cpu_done,io_events=events,lines=lines)
 finally:
  if p.returncode is None:p.kill();p.wait()
 return obs
if __name__=='__main__':
 n=int(sys.argv[1]) if len(sys.argv)>1 else 30
 specs=[('vmm-base','images/base/kernel.bin',False),('vmm-trace','images/base/kernel.bin',True),('vmm-trace','images/trace/kernel.bin',True)]
 data={'commit':(R/'COMMIT').read_text().strip(),'date':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'platform':platform.platform(),'samples':[],'uptime_start':subprocess.check_output(['uptime'],text=True)}
 for i in range(n+3):
  batch=[(b,k,t,c,p) for b,k,t in specs for c in ['return2','one_tool'] for p in [False,True]];random.Random(i).shuffle(batch)
  for b,k,t,c,p in batch:
   x=one(b,k,c,p,t);x['iteration']=i;x['warmup']=i<3;data['samples'].append(x)
  (R/'raw/vmm.json').write_text(json.dumps(data,indent=2))
  if i%10==0:print(i,os.getloadavg(),flush=True)
 data['uptime_end']=subprocess.check_output(['uptime'],text=True);(R/'raw/vmm.json').write_text(json.dumps(data,indent=2))
