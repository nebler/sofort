#!/usr/bin/env python3
"""Freeze explicit evidence into the review area, with content hashes.

The spec is {"artifacts": {label: absolute_path}, "evidence": {label: path}}.
Relative evidence paths are resolved from the checkout; artifacts are copied
only into review scratch. Existing different bytes are never overwritten.
"""
import argparse,hashlib,json,os,shutil
from datetime import datetime,timezone
from pathlib import Path
HERE=Path(__file__).resolve().parent
CHECKOUT=HERE.parents[2]
DEST=HERE/'frozen'
SCRATCH=Path('/tmp/jitk-10/r4/frozen-artifacts')
def sha(data):return hashlib.sha256(data).hexdigest()
def copy(src,dst):
 data=src.read_bytes()
 if dst.exists():assert dst.read_bytes()==data, f'frozen evidence changed: {dst}'
 else:
  dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
 return {'source':str(src),'frozen':str(dst),'sha256':sha(data),'bytes':len(data)}
def main():
 p=argparse.ArgumentParser();p.add_argument('spec',type=Path);a=p.parse_args()
 spec=json.loads(a.spec.read_text());out={'frozen_utc':datetime.now(timezone.utc).isoformat(),
 'load':list(os.getloadavg()),'artifacts':{},'recorded_artifacts':spec.get('recorded_artifacts',{}),'evidence':{}}
 for label,value in spec['artifacts'].items():
  src=Path(value).resolve(strict=True);out['artifacts'][label]=copy(src,SCRATCH/label)
 for label,value in spec['evidence'].items():
  src=Path(value);src=src if src.is_absolute() else CHECKOUT/src
  out['evidence'][label]=copy(src,DEST/label)
 # Also pin owner coordination/source snapshots independently of report prose.
 src=CHECKOUT/'arch/jitk'
 for subtree in ('kernel','executor','grow','bench','bench/hyperlight','linux','vmm','vmm/sandbox','protocol'):
  for name in ('.R4','.READY'):
   path=src/subtree/name
   if path.is_file():out['evidence'][subtree+'/'+name]=copy(path,DEST/'markers'/subtree/name)
 manifest=DEST/'manifest.json'
 # Manifest hash can be cited without hashing itself or the report that cites it.
 manifest.write_text(json.dumps(out,indent=2)+'\n')
 print(json.dumps({'manifest':str(manifest),'sha256':sha(manifest.read_bytes()),
                   'artifacts':{k:v['sha256'] for k,v in out['artifacts'].items()},'evidence_count':len(out['evidence'])},indent=2))
if __name__=='__main__':main()
