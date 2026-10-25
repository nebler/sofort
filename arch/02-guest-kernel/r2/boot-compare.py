#!/usr/bin/env python3
from measure import *
paths={'packed':KERNEL,'runtime_elf_copy':'/tmp/jitk-02/r2/loader-kernel.bin'}
r={k:[] for k in paths};raw=[]
result={'load':subprocess.check_output(['uptime'],text=True).strip()}
for i in range(30):
 pair={}
 for k in (list(paths) if i%2==0 else list(reversed(paths))):
  v=VM(kernel=paths[k])
  try:
   ready=v.ready();v.run('return 2;');assert v.recv()=={'t':'done','ok':2};r[k].append(ready);pair[k]=ready
  finally:v.close()
 raw.append(pair)
result.update(ready_ms={k:quant(a) for k,a in r.items()},paired_packed_minus_loader_ms=quant([p['packed']-p['runtime_elf_copy'] for p in raw]),raw_pairs=raw,image_bytes={k:Path(p).stat().st_size for k,p in paths.items()})
(ROOT/'boot-compare.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='raw_pairs'},indent=2))
