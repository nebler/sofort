#!/usr/bin/env python3
import subprocess,time,os,json,math,statistics,pathlib,random
root=pathlib.Path('/tmp/jitk-06')
cases={'stock':('host-plain','lib'),'buffered':('host-buffered','instrumented')}
order=list(cases)*100; random.Random(6).shuffle(order)
rows=[]
for name in order:
    host,lib=cases[name]
    start=time.perf_counter_ns()
    p=subprocess.run([str(root/host),str(root/'kk.bin')],env=dict(os.environ,DYLD_LIBRARY_PATH=str(root/lib)),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,close_fds=False,check=True)
    rows.append({'case':name,'us':(time.perf_counter_ns()-start)/1000})
out=pathlib.Path(__file__).parent
(out/'control-raw.json').write_text(json.dumps(rows,indent=2)+'\n')
for k in cases:
    v=sorted(r['us'] for r in rows if r['case']==k)
    print(k,len(v),statistics.median(v),v[89],v[98])
