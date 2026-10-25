from pathlib import Path
import os,subprocess,sys
R=Path(__file__).resolve().parent
T=Path('/tmp/jitk-06/r2')
for mode in sys.argv[1:] or ['print','tool']:
 env=dict(os.environ,CARGO_TARGET_DIR=str(T/'kernel-target'),RUSTFLAGS=f'-C link-arg=-T{R}/kernel/link.ld',JITK_SCRIPT=(R/(mode+'.js')).read_text())
 subprocess.run(['cargo','+1.95.0','build','--release','--target','aarch64-unknown-none','--features','qjs'],cwd=R/'kernel',env=env,check=True)
 subprocess.run(['/opt/homebrew/opt/llvm@22/bin/llvm-objcopy','-O','binary',str(T/'kernel-target/aarch64-unknown-none/release/jitk-02'),str(T/(mode+'.bin'))],check=True)
