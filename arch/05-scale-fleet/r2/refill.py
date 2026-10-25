#!/usr/bin/env python3
import concurrent.futures as cf, hashlib, json, math, os, resource, subprocess, time
from pathlib import Path
OUT=Path(__file__).parent/'results'
def pct(xs,p):return sorted(xs)[max(0,math.ceil(p*len(xs))-1)]
def one(_):
    t=time.perf_counter(); p=subprocess.Popen(['/tmp/jitk-05/r2/host-r1','/tmp/jitk-05/r2/kernel-r1.bin'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try: out,err=p.communicate(timeout=5)
    except BaseException:
        p.kill();p.communicate();raise
    return {'ms':(time.perf_counter()-t)*1000,'ok':p.returncode==0 and b'\nhi\n' in out,'rc':p.returncode,'err':err.decode(errors='replace')[:300]}
def main():
    result={'guest':'02 R1 qjs print("hi") -> SYSTEM_OFF; 64 MiB; one console','host_sha256':hashlib.sha256(Path('/tmp/jitk-05/r2/host-r1').read_bytes()).hexdigest(),'kernel_sha256':hashlib.sha256(Path('/tmp/jitk-05/r2/kernel-r1.bin').read_bytes()).hexdigest(),'runs':[]}
    # Two reverse-order sweeps expose order/load sensitivity; no warmup exclusion.
    for repeat,order in enumerate(([1,2,4,8,12],[12,8,4,2,1])):
        for c in order:
            up=subprocess.check_output(['uptime'],text=True).strip(); u0=resource.getrusage(resource.RUSAGE_CHILDREN);t=time.perf_counter()
            with cf.ThreadPoolExecutor(max_workers=c) as pool: rows=list(pool.map(one,range(240)))
            elapsed=time.perf_counter()-t;u1=resource.getrusage(resource.RUSAGE_CHILDREN); n=sum(r['ok'] for r in rows);xs=[r['ms'] for r in rows if r['ok']]
            row={'repeat':repeat,'concurrency':c,'attempts':len(rows),'completed':n,'elapsed_s':elapsed,'completed_vms_s':n/elapsed,'latency_ms':{'p50':pct(xs,.5),'p90':pct(xs,.9),'p99':pct(xs,.99),'max':max(xs)},'children_user_ms_vm':(u1.ru_utime-u0.ru_utime)*1000/n,'children_sys_ms_vm':(u1.ru_stime-u0.ru_stime)*1000/n,'children_cpu_ms_vm':((u1.ru_utime+u1.ru_stime)-(u0.ru_utime+u0.ru_stime))*1000/n,'uptime_before':up,'uptime_after':subprocess.check_output(['uptime'],text=True).strip(),'samples':rows}
            result['runs'].append(row); (OUT/'refill.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in row.items() if k!='samples'}),flush=True)
if __name__=='__main__':main()
