#!/usr/bin/env python3
from measure import *
result={'load':subprocess.check_output(['uptime'],text=True).strip()}
def one(code):
 v=VM()
 try:
  v.ready();lo=time.time_ns();v.run(code);m=v.recv();hi=time.time_ns();assert m['t']=='done',m;return m,lo,hi
 finally:v.close()
churn='let sum=0;for(let i=0;i<128;i++){let a=new Uint8Array(1048576);a[0]=i;a[a.length-1]=i;sum+=a[0];a=null;std.gc();}return sum;'
m,_,_=one(churn);assert m=={'t':'done','ok':8128},m
result['churn']={'cumulative_bytes':128*1048576,'ram_mib':32,'result':m}
clocks=[];bounds=[]
for i in range(30):
 m,lo,hi=one('return Date.now();');guest=m['ok']*1000000
 bounds.append(lo-1000000<=guest<=hi+1000000);clocks.append((guest-(lo+hi)//2)/1e6)
assert all(bounds),(bounds,clocks)
result['clock']={'host_interval_plus_1ms':sum(bounds),'n':30,'midpoint_delta_ms':quant(clocks)}
# Exercise a finite ppoll via QuickJS event-loop timers, then a NULL wait for run.
lat=[]
for i in range(30):
 start=time.perf_counter_ns();m,_,_=one('await new Promise(resolve=>setTimeout(resolve,5));return 2;');assert m=={'t':'done','ok':2},m;lat.append((time.perf_counter_ns()-start)/1e6)
result['finite_timer_e2e_ms']=quant(lat)
# EOF arrives as PORT_OPEN=0; the bootstrap must detect it and terminate.
v=VM()
try:
 v.ready();v.p.stdin.close()
 try: m=v.recv();raise AssertionError(m)
 except RuntimeError: result['eof']='PASS: clean input EOF terminates without a success frame'
finally:
 if v.p.poll() is None:v.p.kill()
 v.p.wait();v.p.stdout.close();v.p.stderr.close()
# Fragment a run frame one byte at a time and resolve a large frame spanning RX buffers.
v=VM()
try:
 v.ready();frame=json.dumps({'t':'run','code':'return await test.echo(1);','ns':{'test':['echo']}}).encode()+b'\n'
 for b in frame:v.p.stdin.write(bytes([b]));v.p.stdin.flush()
 m=v.recv();assert m['t']=='call';v.send({'t':'ret','id':1,'ok':'x'*32768});assert v.recv()=={'t':'done','ok':'x'*32768};result['partial_rx']='PASS: 1-byte run fragments + 32KiB ret'
finally:v.close()
# Native os.write cannot forge a kernel-prefixed record.
v=VM()
try:
 v.ready();v.run('os.write(1,new Uint8Array([30,10]).buffer,0,2);return 2;')
 try:m=v.recv();raise AssertionError(m)
 except RuntimeError:
  assert any('fatal control byte' in r for r in v.records),v.records;result['control_forgery']=v.records
finally:v.close()
result['status']='PASS';(ROOT/'checks.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
