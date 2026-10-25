import json,os,subprocess,sys,threading,time
from pathlib import Path
w=Path(sys.argv[1]);log=Path(sys.argv[2]);cmd=['qemu-system-aarch64','-M','virt,virtualization=on,gic-version=3','-accel','hvf','-cpu','host','-smp',os.getenv('JITK_NESTED_VCPUS','1'),'-m','6144','-kernel',str(w/'vmlinuz'),'-initrd',str(w/'test.cpio.gz'),'-append','console=ttyAMA0 rdinit=/init quiet','-nographic','-no-reboot']
stop=threading.Event();loads=[]
def sample():
 while not stop.is_set():
  loads.append({'unix':time.time(),'uptime':subprocess.check_output(['uptime'],text=True).strip(),'loadavg':list(os.getloadavg())})
  stop.wait(1)
thread=threading.Thread(target=sample);thread.start()
try:
 with log.open('wb') as f:
  p=subprocess.Popen(cmd,stdin=subprocess.DEVNULL,stdout=f,stderr=subprocess.STDOUT)
  try:p.wait(timeout=int(os.getenv('JITK_NESTED_TIMEOUT','1800')))
  finally:
   if p.poll() is None:p.kill()
   p.wait()
finally:
 stop.set();thread.join();(log.parent/'host-load.json').write_text(json.dumps(loads,indent=2)+'\n')
 (log.parent/'nested-command.json').write_text(json.dumps([arg.replace(str(w),'$JITK_WORK') for arg in cmd],indent=2)+'\n')
