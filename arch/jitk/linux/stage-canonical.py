#!/usr/bin/env python3
"""Reuse an owner-01 canonical build, with verification and area-05-owned output."""
import hashlib,json,os,shutil,sys
from pathlib import Path
binary=Path(sys.argv[1]).resolve();metadata=json.loads((binary.parent/'build.json').read_text())
assert metadata['sandbox_ready'], 'canonical binary still has fail-closed sandbox stub'
assert metadata['revision']=='a1d8616765da03980f3be1bb8714bfdd3842f33c'
assert metadata['panic']=='abort' and metadata['features']==[]
assert hashlib.sha256(binary.read_bytes()).hexdigest()==metadata['binary_sha256']
root=Path(__file__).resolve().parent;work=Path(os.getenv('JITK_WORK',str(root/'.work')));work.mkdir(parents=True,exist_ok=True)
for name,digest in metadata['patches_sha256'].items():
 assert hashlib.sha256((root.parent/'vmm/patches'/name).read_bytes()).hexdigest()==digest,(name,'patch drift')
shutil.copy2(binary,work/'jitk-vmm');shutil.copy2(binary.parent/'build.json',work/'build.json')
print(json.dumps(metadata))
