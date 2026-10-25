#!/usr/bin/env python3
import subprocess,pathlib,json,re,math,statistics
out=pathlib.Path('/results'); rows=[]
code="for(let i=0;i<128;i++){let a=new Uint8Array(1024*1024);for(let p=0;p<a.length;p+=4096)a[p]=i;} __benchStamp('done');"
for i in range(30):
 trace=pathlib.Path('/tmp/jitk-06/churn.trace')
 p=subprocess.run(['strace','-qq','-e','trace=brk,mmap,munmap','-o',str(trace),'/tmp/jitk-06/quickjs/qjs','--memory-limit','8388608','-e',code],text=True,capture_output=True,check=True)
 text=trace.read_text(); sizes=[int(x) for x in re.findall(r'mmap\(NULL, (\d+),.*= 0x',text)]
 unmaps=[int(x) for x in re.findall(r'munmap\(0x[0-9a-f]+, (\d+)\)\s+= 0',text)]
 stamp=json.loads(next(x[6:] for x in p.stderr.splitlines() if x.startswith('BENCH ')))
 rows.append({'mmap_bytes':sum(sizes),'munmap_bytes':sum(unmaps),'mmap_count':len(sizes),'hwm_kib':stamp['hwm_kib']})
(out/'churn-raw.json').write_text(json.dumps(rows,indent=2)+'\n')
for key in rows[0]:
 v=sorted(x[key] for x in rows); print(key,'n=30 median/p90/p99',statistics.median(v),v[26],v[29])
(out/'churn-example.trace').write_text(text)
