#!/usr/bin/env python3
# Compare clock origins in the common CNTVCT/mach counter domain, eliminating RTT.
import ctypes,time,json,subprocess
from measure import VM,quant,ROOT
lib=ctypes.CDLL('/usr/lib/libSystem.B.dylib')
lib.mach_absolute_time.restype=ctypes.c_uint64
class TB(ctypes.Structure):_fields_=[('numer',ctypes.c_uint32),('denom',ctypes.c_uint32)]
tb=TB();assert lib.mach_timebase_info(ctypes.byref(tb))==0
def host_offset():
 samples=[]
 for _ in range(16):
  a=lib.mach_absolute_time();r=time.time_ns();b=lib.mach_absolute_time();samples.append((b-a,r-(a+(b-a)//2)*tb.numer//tb.denom))
 return min(samples)[1]/1e6
samples=[];widths=[];bound=[]
result={'load':subprocess.check_output(['uptime'],text=True).strip()}
for _ in range(30):
 v=VM()
 try:
  v.ready();offset=host_offset();v.run('let best=null;for(let i=0;i<64;i++){let a=os.now(),r=Date.now(),b=os.now();if(!best||b-a<best[2]-best[0])best=[a,r,b];}return best;')
  m=v.recv();assert m['t']=='done',m;a,r,b=m['ok'];delta=r-(a+b)/2-offset;samples.append(delta);widths.append(b-a);bound.append(abs(delta)+(b-a)/2)
 finally:v.close()
assert max(bound)<1,(samples,widths,bound)
result.update(status='PASS',n=30,method='Realtime minus guest counter compared with host realtime minus same-domain mach counter; 64 bracketed guest samples, narrowest retained. Date.now is millisecond quantized.',origin_error_ms=quant(samples),guest_bracket_width_ms=quant(widths),worst_abs_error_bound_ms=max(bound),samples_ms=samples)
(ROOT/'clock-check.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
