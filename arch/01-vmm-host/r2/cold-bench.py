#!/usr/bin/env python3
import ctypes,json,math,pathlib,random,re,statistics,subprocess,time,sys
ROOT=pathlib.Path(__file__).resolve().parent
TMP=pathlib.Path('/tmp/jitk-01/r2')
class Timebase(ctypes.Structure):_fields_=[('numer',ctypes.c_uint32),('denom',ctypes.c_uint32)]
lib=ctypes.CDLL('/usr/lib/libSystem.B.dylib'); tb=Timebase();lib.mach_timebase_info(ctypes.byref(tb))
def ns(ticks):return ticks*tb.numer//tb.denom
def sample(binary):
 start=time.monotonic_ns()
 p=subprocess.run([str(TMP/binary),'--image',str(TMP/'first.bin')],capture_output=True,timeout=30)
 end=time.monotonic_ns()
 if p.returncode!=0:raise RuntimeError((binary,p.returncode,p.stderr,p.stdout))
 main=ns(int(re.search(rb'MAIN_TICKS (\d+)',p.stderr)[1]))
 guest=ns(int(re.search(rb'GUEST_TICKS ([0-9a-f]+)',p.stdout)[1],16))
 assert start<=main<=guest<=end,(start,main,guest,end)
 return dict(main_ms=(main-start)/1e6,guest_ms=(guest-start)/1e6,total_ms=(end-start)/1e6)
def summary(rows):
 return {key:dict(median=statistics.median(r[key] for r in rows),p90=sorted(r[key] for r in rows)[math.ceil(.9*len(rows))-1],p99=sorted(r[key] for r in rows)[math.ceil(.99*len(rows))-1]) for key in rows[0]}
if __name__=='__main__':
 binaries=sys.argv[1:] or ['dynamic','static-baseline','static-strip','static-lto','static-minimal']
 r={'uptime_start':subprocess.check_output(['uptime'],text=True).strip(),'timebase':[tb.numer,tb.denom],'samples':{b:[] for b in binaries},'first_observed':{}}
 for b in binaries:
  r['first_observed'][b]=sample(b)
  for _ in range(3):sample(b)
 random.seed(101)
 for i in range(100):
  order=binaries[:];random.shuffle(order)
  for b in order:r['samples'][b].append(sample(b))
  if i%20==19:print('completed',i+1,flush=True)
 r['uptime_end']=subprocess.check_output(['uptime'],text=True).strip();r['summary']={b:summary(v) for b,v in r['samples'].items()}
 (ROOT/'cold-results.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items() if k!='samples'},indent=2))
