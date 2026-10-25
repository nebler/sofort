#!/usr/bin/env python3
"""Owner-07 syscall probe, using filters generated from the exact canonical BPF module."""
import hashlib,json,os,shlex,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent;work=Path(os.getenv('JITK_WORK',str(root/'.work'))).resolve();work.mkdir(parents=True,exist_ok=True)
module=(root.parent/'vmm/sandbox/mod.rs').read_text()
source=module[module.index('pub mod bpf {'):module.index('#[cfg(test)]')]
source+='''
fn main() {
 use bpf::*;
 for (role,sets) in [("main",&[COMMON,MAIN,CONSOLE][..]),("vcpu",&[COMMON,VCPU][..]),("console",&[COMMON,CONSOLE][..])] {
  let bytes:Vec<u8>=compile(sets).iter().flat_map(|n|n.to_le_bytes()).collect();
  std::fs::write(format!("{role}.bpf"),bytes).unwrap();
 }
}
'''
(work/'filter-gen.rs').write_text(source)
subprocess.run(['rustc','--edition=2024',str(work/'filter-gen.rs'),'-o',str(work/'filter-gen')],check=True)
subprocess.run([str(work/'filter-gen')],cwd=work,check=True)
cc=shlex.split(os.getenv('CC','cc'))
subprocess.run([*cc,'-O2',str(root/'seccomp-probe.c'),'-o',str(work/'seccomp-probe')],check=True)
(work/'probe-inputs.json').write_text(json.dumps({'sandbox_module_sha256':hashlib.sha256(module.encode()).hexdigest(),'probe_source_sha256':hashlib.sha256((root/'seccomp-probe.c').read_bytes()).hexdigest()},indent=2))
