#!/usr/bin/env python3
"""Diagnostic only: broaden the copied ET_EXEC window for rg/fd; no handler edits."""
import os,pathlib,shutil,json,subprocess,difflib
import census
R=census.R;K=R/'kernel-wide';shutil.copytree(R/'kernel',K,ignore=shutil.ignore_patterns('target','dist','test-work','test-results','__pycache__'))
changes={'prepare.py':('0x680000','0xa00000'),'src/user.rs':('0x400000..0x650000','0x400000..0xa00000')}
patch=''
for name,(old,new) in changes.items():
 p=K/name;s=p.read_text();t=s.replace(old,new);assert s!=t;p.write_text(t);patch+=''.join(difflib.unified_diff(s.splitlines(True),t.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
(R/'raw/wide-loader.patch').write_text(patch)
for name in ('rg','fd'):
 d=R/'raw'/name;n=json.loads((d/'native.json').read_text());w=n['workload'];out=R/'images'/(name+'-wide');out.mkdir(parents=True,exist_ok=True)
 e=dict(os.environ,PATH='/home/dev/.cargo/bin:/usr/bin:/bin',JITK_ELF=w['binary'],JITK_ARGV_JSON=json.dumps([name]+w['argv']),JITK_RESOURCES=str(census.FIX),CARGO_TARGET_DIR=str(R/'wide-target'))
 with (d/'wide-build.log').open('wb') as log:p=subprocess.run(['cargo','+stable','build','--locked','--offline','--release','--target','aarch64-unknown-none','--features','grow-trace'],cwd=K,env=e,stdout=log,stderr=log)
 if p.returncode:census.dump(d/'wide.json',{'build_failed':True});continue
 subprocess.run(['llvm-objcopy','-O','binary',R/'wide-target/aarch64-unknown-none/release/jitk-02',out/'kernel.bin'],check=True)
 r=census.proc([R/'bin/jitk-vmm','--image',out/'kernel.bin'],bytes.fromhex(w['stdin_hex']),timeout=5,e=dict(os.environ,GLIBC_TUNABLES='glibc.malloc.hugetlb=0'))
 (d/'wide.stdout').write_bytes(bytes.fromhex(r.pop('stdout_hex')));(d/'wide.stderr').write_bytes(bytes.fromhex(r.pop('stderr_hex')));r.update(kernel_sha256=census.sha(out/'kernel.bin'),diagnostic_only=True);census.dump(d/'wide.json',r)
 print(name,'wide',r,flush=True)
