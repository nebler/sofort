import json, subprocess, time, os
from pathlib import Path
p=Path(__file__).parent/'results'/'hvf-limit.json'
result={'sysctls':subprocess.getoutput("sysctl kern.maxproc kern.maxprocperuid kern.hv.max_address_spaces kern.hv.supported"),'rounds':[]}
for repeat in range(2):
    live=[];row={'uptime':subprocess.getoutput('uptime'),'system_processes':len(subprocess.check_output(['ps','-axo','pid']).splitlines())-1,'failures':[]}
    try:
        for i in range(160):
            child=subprocess.Popen(['/tmp/jitk-05/r2/hvf-slot'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            code=child.stdout.readline().decode().strip()
            if code=='0x0':live.append(child)
            else:
                child.wait(timeout=2);row['failures'].append({'attempt':i+1,'hv_return':code,'rc':child.returncode})
                if len(row['failures'])==30:break
        row['slots_created']=len(live)
        row['vm_stat']=subprocess.getoutput('vm_stat')
        # Release exactly one of our slots, prove same one becomes available.
        old=live.pop();old.stdin.close();old.wait(timeout=2)
        q=subprocess.Popen(['/tmp/jitk-05/r2/hvf-slot'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
        row['after_release_one']=q.stdout.readline().decode().strip();live.append(q)
        row['uptime_after']=subprocess.getoutput('uptime')
    finally:
        for q in live:
            q.stdin.close()
        for q in live:
            try:q.wait(timeout=2)
            except subprocess.TimeoutExpired:q.kill();q.wait()
    row['survivors']=sum(q.poll() is None for q in live);result['rounds'].append(row);p.write_text(json.dumps(result,indent=2));print(row)
