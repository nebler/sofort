import json,os,time,subprocess,selectors,re,math,statistics,random,ctypes
from pathlib import Path
R=Path(__file__).resolve().parent;T=Path('/tmp/jitk-06/r2')
clock=lambda:time.clock_gettime_ns(time.CLOCK_MONOTONIC_RAW)
def stats(v):
 v=sorted(v);return dict(n=len(v),p50=statistics.median(v),p90=v[math.ceil(.90*len(v))-1],p99=v[math.ceil(.99*len(v))-1],min=v[0])
class TB(ctypes.Structure):_fields_=[('numer',ctypes.c_uint32),('denom',ctypes.c_uint32)]
lib=ctypes.CDLL('/usr/lib/libSystem.B.dylib');tb=TB();lib.mach_timebase_info(ctypes.byref(tb));lib.mach_absolute_time.restype=ctypes.c_uint64
def bridge():
 lo=clock();ticks=lib.mach_absolute_time();hi=clock()
 return dict(offset_ns=(lo+hi)//2-ticks*tb.numer//tb.denom,uncertainty_ns=(hi-lo)//2,timebase=[tb.numer,tb.denom])
def uptime():return subprocess.check_output(['uptime'],text=True).strip()
def sample(mode,pre=False,host=None,image=None,args=None,parked=False,env=None):
 cal=bridge()
 start=clock();p=subprocess.Popen(args or [str(host or T/'host'),str(image or T/(mode+'.bin'))]+(['--wait-go'] if pre else []),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0,env=env)
 spawn_return=clock();sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ,'out');sel.register(p.stderr,selectors.EVENT_READ,'err')
 out=b'';err=b'';buf=b'';e={'spawn':start,'spawn_return':spawn_return};deadline=time.monotonic()+10
 try:
  while sel.get_map():
   if time.monotonic()>deadline:raise TimeoutError((out,err))
   for key,_ in sel.select(.1):
    b=os.read(key.fileobj.fileno(),65536);now=clock()
    if not b:sel.unregister(key.fileobj);continue
    if key.data=='err':
     err+=b
     if b'WAIT_GO' in err and 'go_send' not in e:
      e['go_send']=clock();p.stdin.write(b'G');
     continue
    out+=b;buf+=b
    while b'\n' in buf:
     line,buf=buf.split(b'\n',1)
     if line==b'FIRST':e['first_line']=now
     if line==b'hi':e['print_line']=now
     if line.startswith(b'{'):
      msg=json.loads(line)
      if msg['t']=='ready':
       e['ready_line']=now
       if mode=='tool':
        if parked:time.sleep(.005)
        e['submit']=clock();p.stdin.write(b'{"t":"run","code":"return await math.add(1,1)","ns":{"math":["add"]}}\n')
      elif msg['t']=='call':
       assert msg['args']==[1,1],msg;e['call_line']=now;e['ret_send']=clock();p.stdin.write(b'{"t":"ret","id":1,"ok":2}\n')
      elif msg['t']=='done':assert msg['ok']==2,msg;e['result']=now
  rc=p.wait(timeout=3);e['reap']=clock();assert rc==0,(rc,out,err)
 finally:
  if p.poll() is None:p.kill();p.wait()
  sel.close();p.stdin.close();p.stdout.close();p.stderr.close()
 trace=next((json.loads(x) for x in err.splitlines() if x.startswith(b'{"events"')),{'events':[]})
 e.update(dict(trace['events']))
 g=re.search(rb'\x1ePERF ([0-9a-f ]+)',out)
 guest={}
 if g:
  hz,*ts=[int(x,16) for x in g[1].split()];guest=dict(zip(['entry','mmu','el0','syscall','qjs_first','ready','rx'],ts));guest['hz']=hz
 m={}
 for a,b,key in [('spawn','main','spawn_main'),('main','build_begin','main_build'),('build_begin','vcpu_run_begin','build_vcpu'),('vcpu_run_begin','ready_line','vcpu_ready'),('ready_line','result','ready_result'),('submit','call_line','submit_call'),('submit','result','submit_result'),('ret_send','result','ret_result'),('spawn','print_line','cold_print'),('spawn','result','cold_result'),('go_send','ready_line','go_ready'),('go_send','result','go_result'),('go_send','go','go_wake'),('go_send','build_begin','go_wake_build'),('result','exit_begin','result_exit'),('exit_begin','reap','exit_reap'),('spawn','reap','whole'),('sandbox_begin','sandbox_end','sandbox'),('result','reap','result_reap'),('kernel_read_begin','kernel_write_end','payload')]:
  if a in e and b in e:m[key]=(e[b]-e[a])/1e6
 for a,b in [('entry','mmu'),('mmu','el0'),('el0','syscall'),('syscall','qjs_first'),('qjs_first','ready'),('entry','ready')]:
  if guest.get(a) and guest.get(b):m['guest_'+a+'_'+b]=(guest[b]-guest[a])*1000/guest['hz']
 mapped={k:int(t*1_000_000_000//guest['hz'])+cal['offset_ns'] for k,t in guest.items() if k!='hz' and t}
 # Source confirms fresh-boot CNTVCT=mach_absolute_time (vtimer_offset=0).
 # Bracketed per-process bridge records uncertainty and validates ordering.
 if 'entry' in mapped and 'vcpu_run_begin' in e:
  assert mapped['entry']>=e['vcpu_run_begin']-cal['uncertainty_ns'],(mapped,e,cal)
  m['vcpu_kernel_entry']=(mapped['entry']-e['vcpu_run_begin'])/1e6
 if 'ready' in mapped:
  assert mapped['ready']<=e['ready_line']+cal['uncertainty_ns'],(mapped,e,cal)
  m['guest_ready_receipt']=(e['ready_line']-mapped['ready'])/1e6
 if 'rx' in mapped and 'submit' in e:
  assert e['submit']-cal['uncertainty_ns']<=mapped['rx']<=e['call_line']+cal['uncertainty_ns'],(mapped,e,cal)
  m['wake_rx']=(mapped['rx']-e['submit'])/1e6
 return dict(events=e,guest=guest,clock_bridge=cal,guest_host_ns=mapped,ms=m,stdout=out.decode(),stderr=err.decode())
if __name__=='__main__':
 import sys
 n=int(sys.argv[1]) if len(sys.argv)>1 else 100
 cases=['print','tool','pre-tool'];data=dict(uptime_start=uptime(),rows={k:[] for k in cases},first={})
 for k in cases:data['first'][k]=sample(k.replace('pre-',''),k.startswith('pre'))
 order=cases*n;random.Random(606).shuffle(order)
 for i,k in enumerate(order):
  data['rows'][k].append(sample(k.replace('pre-',''),k.startswith('pre')))
  if i%30==29:print('samples',i+1,uptime(),flush=True)
 data['uptime_end']=uptime();data['summary']={k:{m:stats([r['ms'][m] for r in rs]) for m in rs[0]['ms']} for k,rs in data['rows'].items()}
 (R/'integrated.json').write_text(json.dumps(data,indent=2));print(json.dumps(data['summary'],indent=2))
