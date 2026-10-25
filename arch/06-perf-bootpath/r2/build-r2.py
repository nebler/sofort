from pathlib import Path
import os,subprocess
R=Path(__file__).resolve().parent;T=Path('/tmp/jitk-06/r2')
for mode in ['print','tool']:
 env=dict(os.environ,CARGO_TARGET_DIR=str(T/'r2-kernel-target'),RUSTFLAGS=f'-C link-arg=-T{R}/kernel-r2/link.ld')
 if mode=='print':env['JITK_SCRIPT']=(R/'print.js').read_text()
 else:env.pop('JITK_SCRIPT',None)
 subprocess.run(['cargo','+1.95.0','build','--release','--target','aarch64-unknown-none','--features','qjs'],cwd=R/'kernel-r2',env=env,check=True)
 subprocess.run(['/opt/homebrew/opt/llvm@22/bin/llvm-objcopy','-O','binary',str(T/'r2-kernel-target/aarch64-unknown-none/release/jitk-02'),str(T/('r2-'+mode+'.bin'))],check=True)
