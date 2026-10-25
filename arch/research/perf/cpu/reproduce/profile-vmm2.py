import subprocess,time,json,os,sys,select
from pathlib import Path
R=Path('/tmp/sofort-a2');mode=sys.argv[1];log=R/f'raw/{mode}2-command.log';meta={'uptime':subprocess.check_output(['uptime'],text=True)}
p=subprocess.Popen([str(R/'vmm-base'),'--image',str(R/'images/base/kernel.bin'),'--sandbox-profile',str(R/'profile.sbbin'),'--wait-go'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0)
err=b''
while b'WAIT_GO' not in err:err+=os.read(p.stderr.fileno(),4096)
cmd=['sample',str(p.pid),'2','1','-mayDie','-file',str(R/'raw/sample2-vmm.txt')] if mode=='sample' else ['xctrace','record','--template','Time Profiler','--time-limit','5s','--output',str(R/'raw/vmm2.trace'),'--attach',str(p.pid)]
f=open(log,'wb');s=subprocess.Popen(cmd,stdout=f,stderr=f)
# Keep target alive until the profiler has had time to attach. Avoid claiming these as latency runs.
start=time.monotonic()
if mode=='xctrace':
 while time.monotonic()-start<30 and s.poll() is None:
  if 'Starting recording' in log.read_text(errors='replace'):break
  time.sleep(.2)
else:time.sleep(2)
p.stdin.write(b'G');ready=p.stdout.readline();assert ready==b'{"t":"ready","v":1}\n',ready
p.stdin.write(b'{"t":"run","code":"let x=0;for(let i=0;i<10000000;i++)x+=i;return 2;","ns":{}}\n');out=p.stdout.read();p.wait(timeout=10)
try:s.wait(timeout=30)
except subprocess.TimeoutExpired:s.kill();s.wait()
f.close();meta.update(command=cmd,exit=s.returncode,vmm_exit=p.returncode,out=out.decode(),profiler_log=log.read_text(errors='replace'),elapsed_s=time.monotonic()-start);(R/f'raw/{mode}2-meta.json').write_text(json.dumps(meta,indent=2))
