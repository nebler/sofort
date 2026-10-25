from pathlib import Path
import subprocess,os,sys
r=Path('/tmp/sofort-a2');d=r/'libkrun/target/release/deps'
cmd=['rustc','+1.95.0','--edition=2024','-O','-C','lto=fat','-C','panic=abort','-C','debuginfo=1',str(r/'arch/jitk/vmm/src/main.rs'),'--extern',f'krun={d}/libkrun.rlib','-L',f'dependency={d}','--cfg','sandbox_ready','-o',str(r/sys.argv[1])]
for crate,pattern in [('libc','liblibc-*.rlib'),('utils','libkrun_utils-*.rlib')]+([('hvf','libkrun_hvf-*.rlib')] if '--trace' in sys.argv else []):
 p=sorted(d.glob(pattern),key=lambda x:x.stat().st_mtime,reverse=True);assert len(p)>=1,p;cmd+=['--extern',f'{crate}={p[0]}']
subprocess.run(cmd,check=True)
subprocess.run(['codesign','--force','--sign','-','--entitlements',str(r/'arch/jitk/vmm/hypervisor.entitlements'),str(r/sys.argv[1])],check=True)
