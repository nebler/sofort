#!/usr/bin/env python3
from pathlib import Path
import subprocess,os,json,time,resource
p=Path(__file__).resolve().parent
code=Path('/tmp/jitk-spike/sc/codemode.js').read_text().replace("import * as std from 'std';",'')
env=os.environ.copy();env['JITK_SCRIPT']=code
subprocess.run(['sh',str(p/'build.sh'),'--features','qjs'],env=env,check=True)
start=time.perf_counter_ns();child=subprocess.Popen(['/tmp/jitk-02/host','/tmp/jitk-02/kernel.bin'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
lines=[]
for line in iter(child.stdout.readline,b''):
    lines.append(line.decode())
    if line.startswith(b'{'):
        msg=json.loads(line)
        if msg['t']=='call':
            response={'ok':[{'id':42,'title':'fix thing','created':0}]} if msg['id']==0 else {'ok':True}
            child.stdin.write(json.dumps(response).encode()+b'\n');child.stdin.flush()
child.wait(timeout=5)
assert child.returncode==0 and any('"count":1' in line for line in lines),lines
(p/'exchange.log').write_text(''.join(lines))
print('Sequential exchange PASS', (time.perf_counter_ns()-start)/1e6,'ms')
env['JITK_SCRIPT']='print("READY");std.in.getline();print("hi")'
subprocess.run(['sh',str(p/'build.sh'),'--features','qjs'],env=env,check=True)
before=resource.getrusage(resource.RUSAGE_CHILDREN)
start=time.perf_counter();child=subprocess.Popen(['/tmp/jitk-02/host','/tmp/jitk-02/kernel.bin'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
while child.stdout.readline()!=b'READY\n':pass
idle_start=time.perf_counter();time.sleep(1);idle=time.perf_counter()-idle_start
child.stdin.write(b'resume\n');child.stdin.flush();rest=child.stdout.read();child.wait(timeout=5)
after=resource.getrusage(resource.RUSAGE_CHILDREN)
cpu=after.ru_utime+after.ru_stime-before.ru_utime-before.ru_stime
r={'idle_wall_seconds':idle,'whole_wall_seconds':time.perf_counter()-start,'host_cpu_seconds':cpu,'cpu_per_idle_wall':cpu/idle,'output':rest.decode(),'returncode':child.returncode}
(p/'idle-cpu.json').write_text(json.dumps(r,indent=2));print(r)
