#!/bin/sh
set -eu
# Run from arch/04-executor-ts; setup-qjs.sh supplies /tmp/jitk-04/qjs-static.
python3 - <<'PY'
import json
frames=[{'t':'run','code':"(async()=>{const r=await github.listIssues({repo:'x'});return r.length;})()",'providers':[{'name':'github'}]},{'id':0,'ok':[{'id':1},{'id':2}]}]
open('/tmp/jitk-04/protocol-input.jsonl','w').write(''.join(json.dumps(f)+'\n' for f in frames))
PY
docker run --rm --platform linux/arm64 -v /tmp/jitk-04:/work -v "$PWD":/src:ro alpine sh -c 'apk add --no-cache strace >/work/strace-install.log && strace -f -o /work/guest.strace /work/qjs-static /src/guest.mjs </work/protocol-input.jsonl' > static-protocol-result.jsonl
cp /tmp/jitk-04/guest.strace guest.strace
python3 - <<'PY'
import re,json
s=open('guest.strace').read();calls=sorted(set(re.findall(r'^\d+\s+(\w+)\(',s,re.M)))
open('guest-syscalls.json','w').write(json.dumps({'syscalls':calls,'count':len(calls)},indent=2)+'\n')
PY
