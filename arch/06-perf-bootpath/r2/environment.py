from pathlib import Path
import subprocess,json,hashlib
R=Path(__file__).resolve().parent
cmds=[['uptime'],['sw_vers'],['sysctl','-n','machdep.cpu.brand_string','hw.logicalcpu','hw.memsize'],['/tmp/jitk-09/node-real','--version'],['python3','--version'],['otool','-L','/tmp/jitk-06/r2/host'],['otool','-L','/tmp/jitk-06/r2/vmm-static-minimal'],['codesign','-dvvv','/tmp/jitk-06/r2/host']]
r={'commands':[],'sha256':{}}
for c in cmds:
 p=subprocess.run(c,capture_output=True,text=True);r['commands'].append(dict(argv=c,rc=p.returncode,stdout=p.stdout,stderr=p.stderr))
for p in [*Path('/tmp/jitk-06/r2').glob('*.bin'),Path('/tmp/jitk-06/r2/host'),Path('/tmp/jitk-06/r2/libkrun.2.dylib'),Path('/tmp/jitk-06/r2/jitk-vmm'),Path('/tmp/jitk-06/r2/host-static'),Path('/tmp/jitk-06/r2/vmm-final')]:
 r['sha256'][str(p)]=hashlib.sha256(p.read_bytes()).hexdigest()
(R/'environment.json').write_text(json.dumps(r,indent=2))
