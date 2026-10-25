import subprocess,time,json,os,sys,select
from pathlib import Path
R=Path('/tmp/sofort-a2');mode=sys.argv[1]
p=subprocess.Popen([str(R/'vmm-base'),'--image',str(R/'images/base/kernel.bin'),'--sandbox-profile',str(R/'profile.sbbin'),'--wait-go'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0)
err=b''
while b'WAIT_GO' not in err:err+=os.read(p.stderr.fileno(),4096)
if mode=='sample':cmd=['sample',str(p.pid),'2','1','-mayDie','-file',str(R/'raw/sample-vmm.txt')]
else:cmd=['xctrace','record','--template','Time Profiler','--time-limit','3s','--output',str(R/'raw/vmm.trace'),'--attach',str(p.pid)]
f=open(R/f'raw/{mode}-command.log','wb');s=subprocess.Popen(cmd,stdout=f,stderr=f);time.sleep(.6 if mode=='sample' else 1)
t=time.perf_counter_ns();p.stdin.write(b'G');ready=p.stdout.readline();assert ready==b'{"t":"ready","v":1}\n',ready
p.stdin.write(b'{"t":"run","code":"let x=0;for(let i=0;i<2000000;i++)x+=i;return 2;","ns":{}}\n')
out=p.stdout.read();p.wait(timeout=10)
try:s.wait(timeout=15)
except subprocess.TimeoutExpired:s.kill();s.wait()
f.close();(R/f'raw/{mode}-meta.json').write_text(json.dumps({'mode':mode,'uptime':subprocess.check_output(['uptime'],text=True),'command':cmd,'exit':s.returncode,'vmm_exit':p.returncode,'ready':ready.decode(),'out':out.decode(),'elapsed_us':(time.perf_counter_ns()-t)/1000}))
