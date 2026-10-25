#!/usr/bin/env python3
import json, os, resource, subprocess, time
scripts={
 'bootstrap': 'let tools=new Proxy({}, {get:(_,n)=>async x=>({name:n,arg:x})}); Promise.all([tools.echo({x:1}),tools.echo({x:2})]).then(x=>console.log(JSON.stringify(x)))',
 'json_256k': 'let s="x".repeat(262144); let o=JSON.parse(JSON.stringify({s})); console.log(o.s.length)',
 'json_1m': 'let s="x".repeat(1048576); let o=JSON.parse(JSON.stringify({s})); console.log(o.s.length)',
 'json_4m': 'let s="x".repeat(4194304); let o=JSON.parse(JSON.stringify({s})); console.log(o.s.length)',
}
for heap in ['8M','16M']:
 for name,code in scripts.items():
  pid=os.fork()
  if pid==0:
   t=time.perf_counter()
   p=subprocess.run(['busybox','time','-v','/qjs','--memory-limit',heap,'--stack-size','256k','-e',code],capture_output=True)
   print(json.dumps(dict(heap=heap,case=name,returncode=p.returncode,wall_ms=1000*(time.perf_counter()-t),
       stdout=p.stdout.decode().strip(),stderr=p.stderr.decode().strip())),flush=True)
   os._exit(0)
  os.waitpid(pid,0)
