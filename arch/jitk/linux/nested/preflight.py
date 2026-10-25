"""Non-VM checks while the canonical VMM build waits for security integration."""
import json,os,signal,subprocess
from pathlib import Path
b=Path('/work');cg=Path('/sys/fs/cgroup/jitk-05-preflight');cg.mkdir();rows=[]
p=subprocess.run([str(b/'spawn-cg'),str(cg),'/bin/sh','-c','cat /proc/self/cgroup'],capture_output=True,timeout=30)
assert p.returncode==0 and b'jitk-05-preflight' in p.stdout,(p.returncode,p.stdout,p.stderr)
rows.append({'case':'CLONE_INTO_CGROUP','pass':True,'stdout':p.stdout.decode()});cg.rmdir()
for role in ['main','vcpu','console']:
 for action in ['exit','openat','socket','execve','kvm-create-vm','kvm-run','mmap-exec','kill']:
  expected=0 if action=='exit' or (role=='vcpu' and action=='kvm-run') else -signal.SIGSYS
  p=subprocess.run([str(b/'seccomp-probe'),str(b/(role+'.bpf')),action],capture_output=True,timeout=30)
  rows.append({'role':role,'action':action,'rc':p.returncode,'expected':expected,'pass':p.returncode==expected})
assert all(r['pass'] for r in rows),rows
print('PREFLIGHT_PASS '+json.dumps({'label':'NESTED','rows':rows,'uptime':Path('/proc/uptime').read_text().strip()+' loadavg='+Path('/proc/loadavg').read_text().strip()}),flush=True)
