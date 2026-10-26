#!/usr/bin/env python3
"""Build owner-02 sources in area-05's private workdir; never write kernel/."""
import hashlib,json,os,shutil,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent
work=Path(os.getenv('JITK_WORK',str(root/'.work'))).resolve();work.mkdir(parents=True,exist_ok=True)
source=root.parent/'kernel';dest=work/'kernel'
if dest.exists():shutil.rmtree(dest)
shutil.copytree(source,dest,ignore=shutil.ignore_patterns('.work','target','target-ring','dist','__pycache__','.READY'))
protocol=root.parent/'protocol/bootstrap.js'
script=protocol.read_text()
env={**os.environ,'JITK_SCRIPT':script,'CARGO_TARGET_DIR':str(work/'kernel-target'),'JITK_OUT_DIR':str(work)}
if os.uname().sysname=='Linux':env['OBJCOPY']='llvm-objcopy'
subprocess.run(['sh','build.sh'],cwd=dest,env=env,check=True)
files=[*dest.rglob('*.rs'),dest/'Cargo.toml',dest/'build.rs',dest/'payload/qjs']
inputs={str(p.relative_to(work)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files};inputs['protocol/bootstrap.js']=hashlib.sha256(script.encode()).hexdigest()
(work/'kernel-inputs.json').write_text(json.dumps(inputs,indent=2))

