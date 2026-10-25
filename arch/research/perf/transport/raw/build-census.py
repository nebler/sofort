from pathlib import Path
import subprocess,os
R=Path('/tmp/sofort-a4');k=R/'head/arch/jitk/kernel'
env=dict(os.environ,CARGO_TARGET_DIR=str(R/'census-kernel-target'),JITK_OUT_DIR=str(R/'census-images'),JITK_SCRIPT=(R/'clean/arch/jitk/protocol/bootstrap.js').read_text())
with (R/'raw/census-kernel-build.log').open('w') as f:subprocess.run(['sh','build.sh'],cwd=k,env=env,stdout=f,stderr=subprocess.STDOUT,check=True)
