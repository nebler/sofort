from pathlib import Path
import subprocess,os
L=Path(os.environ.get('A4_LIBKRUN','/tmp/sofort-a4/libkrun'));D=L/'target/release/deps';R=Path('/tmp/sofort-a4/head/arch/jitk/vmm');out=os.environ.get('A4_VMM_OUT','/tmp/sofort-a4/bin/jitk-vmm')
a=['rustc','--edition=2024','-O','-C','lto=fat','-C','panic=abort',str(R/'src/main.rs'),'--extern',f'krun={D}/libkrun.rlib','-L',f'dependency={D}','-o',out]
for c,p in [('libc','liblibc-*.rlib'),('utils','libkrun_utils-*.rlib')]:
 ps=list(D.glob(p));assert len(ps)==1;a+=['--extern',f'{c}={ps[0]}']
if (R/'sandbox/.READY').exists():a+=['--cfg','sandbox_ready']
subprocess.run(a,env=dict(os.environ,RUSTUP_TOOLCHAIN='1.95.0'),check=True)
subprocess.run(['codesign','--force','--sign','-','--entitlements',str(R/'hypervisor.entitlements'),out],check=True)
