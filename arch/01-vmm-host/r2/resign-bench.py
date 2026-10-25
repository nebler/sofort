import json,pathlib,subprocess,time
import runpy,types
b=types.SimpleNamespace(**runpy.run_path(str(pathlib.Path(__file__).with_name('cold-bench.py'))))
r={'uptime_start':subprocess.check_output(['uptime'],text=True).strip(),'samples':[]}
path=b.TMP/'scan-test'
subprocess.run(['cp',str(b.TMP/'static-strip'),str(path)],check=True)
ent=pathlib.Path(__file__).resolve().parents[1]/'hypervisor.entitlements'
for i in range(30):
 subprocess.run(['codesign','--force','--sign','-','--identifier',f'jitk.r2.scan.{time.time_ns()}.{i}','--entitlements',str(ent),str(path)],check=True,capture_output=True)
 r['samples'].append({'first':b.sample('scan-test'),'subsequent':b.sample('scan-test')})
 if i%5==4:print('signed launches',i+1,flush=True)
r['summary']={kind:b.summary([v[kind] for v in r['samples']]) for kind in ('first','subsequent')}
r['uptime_end']=subprocess.check_output(['uptime'],text=True).strip()
(b.ROOT/'resign-results.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r['summary'],indent=2))
