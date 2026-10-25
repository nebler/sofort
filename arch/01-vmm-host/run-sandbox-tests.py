#!/usr/bin/env python3
import json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parent
marker=root/'sandbox-denied.txt';marker.write_text('synthetic sandbox marker\n')
results={}
for name,args in [('boot',['/tmp/jitk-01/jitk-vmm','/tmp/jitk-01/probe.bin']),('denials',['/tmp/jitk-01/sandbox-probe',str(marker)])]:
    p=subprocess.run(['/usr/bin/sandbox-exec','-f',str(root/'dev-sandbox.sb'),*args],capture_output=True,timeout=5)
    results[name]={'rc':p.returncode,'stdout':p.stdout.decode(),'stderr':p.stderr.decode()}
(root/'sandbox-results.json').write_text(json.dumps(results,indent=2)+'\n')
print({name:r['rc'] for name,r in results.items()})
assert all(r['rc']==0 for r in results.values())
