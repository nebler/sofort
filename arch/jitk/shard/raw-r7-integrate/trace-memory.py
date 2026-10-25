#!/usr/bin/env python3
"""Offline diagnostic only; run under bench.lock after building trace images."""
import json,os,pathlib,struct,subprocess
root=pathlib.Path(os.environ['JITK_NATIVE_ROOT'])
real=root/'arch/jitk/shard/target/release/real'
results=[]
for name,tool in [('zstd-4m','zstd'),('micropython-2m','micropython'),('zstd-8m','zstd')]:
    base=root/f'trace-{name}'
    with (root/f'raw/trace-prepare-{name}.jsonl').open('wb') as out:
        subprocess.run([str(real),'prepare',str(base.with_suffix('.bin')),str(base)],stdout=out,check=True)
    request=(root/f'ledger-{tool}.request').read_bytes()
    p=subprocess.run([str(real),'native-worker',f'{tool}={base}'],input=struct.pack('<I',len(request))+request,
        env=dict(os.environ,JITK_NATIVE_DIAGNOSTICS='1'),capture_output=True,timeout=60,check=True)
    (root/f'raw/trace-{name}.stderr').write_bytes(p.stderr)
    (root/f'raw/trace-{name}.response').write_bytes(p.stdout)
    status,code,olen,elen,limited=struct.unpack_from('<5I',p.stdout,4)
    r=dict(profile=name,worker_status=status,exit_code=code,stdout_bytes=olen,stderr_bytes=elen,limited=limited)
    results.append(r);print(r,flush=True)
(root/'raw/memory-trace-results.json').write_text(json.dumps(results,indent=2)+'\n')
