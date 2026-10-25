#!/usr/bin/env python3
import json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parent
results={}
for mode,kernel in [('concurrent','kk_hang'),('drop','kk_hang'),('sequential','kk')]:
    p=subprocess.run(['/tmp/jitk-01/two-vms',mode,f'/tmp/jitk-spike/boot/{kernel}.bin'],capture_output=True,timeout=5)
    results[mode]={'rc':p.returncode,'stdout':p.stdout.decode(),'stderr':p.stderr.decode()}
p=subprocess.run(['/tmp/jitk-01/hvf-two'],capture_output=True,timeout=5)
results['raw-hvf']={'rc':p.returncode,'stdout':p.stdout.decode(),'stderr':p.stderr.decode()}
(root/'process-results.json').write_text(json.dumps(results,indent=2)+'\n')
print({name:result['rc'] for name,result in results.items()})
