#!/usr/bin/env python3
import ctypes,json,os,pathlib,select,subprocess,sys,time,statistics,math,tempfile
ROOT=pathlib.Path(__file__).resolve().parent
TMP=pathlib.Path('/tmp/jitk-01/r2')
lib=ctypes.CDLL('/usr/lib/libSystem.B.dylib')
class Timebase(ctypes.Structure):_fields_=[('numer',ctypes.c_uint32),('denom',ctypes.c_uint32)]
tb=Timebase();lib.mach_timebase_info(ctypes.byref(tb))
class Task(ctypes.Structure):
 _fields_=[('virtual',ctypes.c_uint64),('resident',ctypes.c_uint64),('user',ctypes.c_uint64),('system',ctypes.c_uint64),('threads_user',ctypes.c_uint64),('threads_system',ctypes.c_uint64),('policy',ctypes.c_int32),('faults',ctypes.c_int32),('pageins',ctypes.c_int32),('cow',ctypes.c_int32),('sent',ctypes.c_int32),('received',ctypes.c_int32),('unix',ctypes.c_int32),('mach',ctypes.c_int32),('switches',ctypes.c_int32),('threads',ctypes.c_int32),('running',ctypes.c_int32),('priority',ctypes.c_int32)]
def cpu(pid):
 t=Task();n=lib.proc_pidinfo(pid,4,0,ctypes.byref(t),ctypes.sizeof(t));assert n==ctypes.sizeof(t),(n,ctypes.get_errno());return (t.user+t.system)*tb.numer//tb.denom

def read(fd,timeout=5):
 if not select.select([fd],[],[],timeout)[0]:raise TimeoutError('pipe timeout')
 b=os.read(fd,65536)
 if not b:raise RuntimeError('pipe EOF')
 return b

def run(binary,guest,forced=False,idle=5,n=1000):
 env=dict(os.environ)
 if forced:env['JITK_USERSPACE_GIC']='1'
 else:env.pop('JITK_USERSPACE_GIC',None)
 r={'binary':binary,'guest':guest,'forced':forced,'uptime':subprocess.check_output(['uptime'],text=True).strip(),'n':n}
 errors=tempfile.TemporaryFile(dir=TMP)
 p=subprocess.Popen([str(TMP/binary),'--image',str(TMP/guest)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=errors,env=env,bufsize=0)
 try:
  out=b''
  while b'virtio-count=' not in out:out+=read(p.stdout.fileno(),30)
  # Ready report is queued before entering WFI. Wait long enough to park.
  time.sleep(.05)
  before=cpu(p.pid);start=time.monotonic_ns();time.sleep(idle)
  r['idle_seconds']=(time.monotonic_ns()-start)/1e9;r['idle_cpu_delta']=cpu(p.pid)-before;r['idle_cpu_percent']=r['idle_cpu_delta']/(r['idle_seconds']*1e9)*100
  samples=[]
  for i in range(n):
   time.sleep(.001)
   b=bytes([33+i%90]);t=time.monotonic_ns();p.stdin.write(b)
   assert read(p.stdout.fileno(),1)==b
   samples.append((time.monotonic_ns()-t)/1e6)
  p.wait(timeout=3)
  r.update(rc=p.returncode,samples_ms=samples,median_ms=statistics.median(samples),p90_ms=sorted(samples)[math.ceil(.9*n)-1],p99_ms=sorted(samples)[math.ceil(.99*n)-1],report=out.decode())
 except Exception as e:r['error']=repr(e)
 finally:
  if p.poll() is None:p.kill()
  p.wait();errors.seek(0);r['stderr']=errors.read().decode();errors.close();r['cpu_units']='mach ticks converted to ns (125/3)' 
 return r
if __name__=='__main__':
 r=run(sys.argv[1],sys.argv[2],len(sys.argv)>3)
 dest=ROOT/('parking-'+sys.argv[1]+'-'+sys.argv[2]+('-forced' if len(sys.argv)>3 else '')+'.json')
 dest.write_text(json.dumps(r,indent=2)+'\n');print({k:v for k,v in r.items() if k not in ('samples_ms','report','stderr')},flush=True)
