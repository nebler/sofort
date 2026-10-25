#!/usr/bin/env python3
"""Build an isolated runtime-ELF-copy comparison; never edit final kernel."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parent; out=Path('/tmp/jitk-02/r2/loader-comparison');out.mkdir(exist_ok=True)
shutil.copytree(root/'src',out/'src',dirs_exist_ok=True)
for f in ['Cargo.toml','Cargo.lock','link.ld','bootstrap.js']:shutil.copy(root/f,out/f)
p=out/'src/main.rs';s=p.read_text();s='\n'.join(l for l in s.splitlines() if not l.startswith('global_asm!(".section .packed'))+'\n';p.write_text(s)
p=out/'link.ld';s=p.read_text();s='\n'.join(l for l in s.splitlines() if 'ASSERT(__kernel_end' not in l and '. = 0x80080000;' not in l and '.packed :' not in l)+'\n';p.write_text(s)
p=out/'src/mmu.rs';p.write_text(p.read_text().replace('0x80080000 +','0x80400000 +'))
p=out/'src/user.rs';s=p.read_text();old=(root.parent/'src/user.rs').read_text();a=old.index('static ELF:');b=old.index('unsafe fn pages');helpers=old[a:b].replace('static mut BRK: usize = 0x680000;\n','').replace('static mut NEXT: usize = 0x800000;\n','');s=s.replace('static mut BRK:',helpers+'static mut BRK:');a=old.index('        assert!(\n');b=old.index('        pages(0x1fe0000',a);start=s.index('        for &(start, end, w, x)');end=s.index('        pages(0x1fe0000',start);s=s[:start]+old[a:b]+s[end:];p.write_text(s)
print(out)
