import os,subprocess,time,json,random,ctypes,shutil,re
from pathlib import Path
from bench import stats,uptime
R=Path(__file__).resolve().parent;T=Path('/tmp/jitk-06/r2')
clock=lambda:time.clock_gettime_ns(time.CLOCK_MONOTONIC_RAW)
lib=ctypes.CDLL('/usr/lib/libSystem.B.dylib');lib.mach_absolute_time.restype=ctypes.c_uint64
class TB(ctypes.Structure):_fields_=[('numer',ctypes.c_uint32),('denom',ctypes.c_uint32)]
tb=TB();lib.mach_timebase_info(ctypes.byref(tb))
def absolute():return lib.mach_absolute_time()*tb.numer//tb.denom
def sample(binary,method):
 args=[str(T/binary)]
 if binary.startswith('vmm-'):args+=['--image','/tmp/jitk-01/r2/first.bin']
 out_r,out_w=os.pipe();err_r,err_w=os.pipe()
 start=clock();start_abs=absolute()
 if method=='posix_spawn':
  pid=os.posix_spawn(args[0],args,os.environ,file_actions=[(os.POSIX_SPAWN_DUP2,out_w,1),(os.POSIX_SPAWN_DUP2,err_w,2),(os.POSIX_SPAWN_CLOSE,out_r),(os.POSIX_SPAWN_CLOSE,err_r)])
 else:
  pid=os.fork()
  if pid==0:
   os.dup2(out_w,1);os.dup2(err_w,2);os.close(out_r);os.close(err_r);os.execve(args[0],args,os.environ);os._exit(127)
 spawned=clock();os.close(out_w);os.close(err_w)
 # Tiny bounded outputs; no pipe fills. External watchdog uses SIGALRM.
 import signal
 def timeout(*_):os.kill(pid,9);raise TimeoutError(binary)
 old=signal.signal(signal.SIGALRM,timeout);signal.alarm(10)
 try:
  out=os.read(out_r,65536);err=b''
  while b:=os.read(err_r,65536):err+=b
  _,status=os.waitpid(pid,0)
 finally:
  signal.alarm(0);signal.signal(signal.SIGALRM,old);os.close(out_r);os.close(err_r)
 end=clock();assert status==0,(binary,status,out,err)
 if binary.startswith('vmm-'):
  main=int(re.search(rb'MAIN_TICKS (\d+)',err)[1])*tb.numer//tb.denom;lat=(main-start_abs)/1e6
 else:
  main=int(re.search(rb'MAIN (\d+)',out)[1]);lat=(main-start)/1e6
 assert lat>=0
 return dict(spawn_main_ms=lat,spawn_return_ms=(spawned-start)/1e6,whole_ms=(end-start)/1e6)
if __name__=='__main__':
 for b in ['dynamic','static-baseline','static-strip','static-lto','static-minimal']:
  shutil.copy2('/tmp/jitk-01/r2/'+b,T/('vmm-'+b))
 binaries=['control','control-hvf','control-krun']+['vmm-'+x for x in ['dynamic','static-baseline','static-strip','static-lto','static-minimal']]
 cases=[(b,m) for b in binaries for m in ['posix_spawn','fork_exec']]
 data=dict(uptime_start=uptime(),timebase=[tb.numer,tb.denom],rows={b+'/'+m:[] for b,m in cases},first={})
 for b,m in cases:data['first'][b+'/'+m]=sample(b,m)
 order=cases*100;random.Random(601).shuffle(order)
 for i,(b,m) in enumerate(order):
  data['rows'][b+'/'+m].append(sample(b,m))
  if i%160==159:print('samples',i+1,uptime(),flush=True)
 data['uptime_end']=uptime();data['summary']={k:{m:stats([r[m] for r in rs]) for m in rs[0]} for k,rs in data['rows'].items()}
 (R/'spawn-python.json').write_text(json.dumps(data,indent=2));print(json.dumps(data['summary'],indent=2))
