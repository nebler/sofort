import subprocess,json,os,time
from pathlib import Path
from spawn import sample
from bench import stats,uptime
R=Path(__file__).resolve().parent;T=Path('/tmp/jitk-06/r2')
r=dict(uptime_start=uptime(),rows={},dyld={})
for b in ['control','control-hvf','control-krun','vmm-static-minimal']:
 rows=[]
 for i in range(100):
  subprocess.run(['codesign','-f','-s','-','--identifier',f'jitk.06.{b}.{i}.{time.time_ns()}','--entitlements','/tmp/jitk-06/lib/chroot_vm.entitlements',str(T/b)],capture_output=True,check=True)
  rows.append(dict(first=sample(b,'posix_spawn'),second=sample(b,'posix_spawn')))
 r['rows'][b]=rows
for b in ['control','control-krun','vmm-static-minimal']:
 args=[str(T/b)]+(['--image','/tmp/jitk-01/r2/first.bin'] if b.startswith('vmm-') else [])
 p=subprocess.run(args,capture_output=True,timeout=10,env=dict(os.environ,DYLD_PRINT_STATISTICS='1',DYLD_PRINT_STATISTICS_DETAILS='1'))
 r['dyld'][b]=dict(rc=p.returncode,stdout=p.stdout.decode(),stderr=p.stderr.decode())
r['uptime_end']=uptime();r['summary']={b:{phase:stats([x[phase]['spawn_main_ms'] for x in rows]) for phase in ['first','second']} for b,rows in r['rows'].items()}
(R/'resign.json').write_text(json.dumps(r,indent=2));print(json.dumps(r['summary'],indent=2))
