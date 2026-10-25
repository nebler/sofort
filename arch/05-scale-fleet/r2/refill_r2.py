import hashlib,importlib.util,json
from pathlib import Path
base=Path(__file__).parent
spec=importlib.util.spec_from_file_location('bench',base/'linux-kit/bench.py');bench=importlib.util.module_from_spec(spec);spec.loader.exec_module(bench)
cmd=['/tmp/jitk-05/r2/host-r2','/tmp/jitk-05/r2/kernel-r2.bin']
result={'guest':'02 R2 READY snapshot, native panic=abort VMM, 32MiB, packed qjs IRQ-only parking; run return 1+1 -> done2 -> exit0','command':cmd,'sha256':{p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in cmd},'runs':[]}
try:
 for rep,order in enumerate(([1,2,4,8,12],[12,8,4,2,1])):
  for c in order:
   row=bench.batch(240,c,cmd);row['repeat']=rep;result['runs'].append(row);(base/'results/refill-r2.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in row.items() if k!='samples'}),flush=True)
finally:bench.cleanup_all()
