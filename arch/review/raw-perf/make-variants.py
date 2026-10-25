"""Run in review scratch. Creates measurement variants; never run in the product tree."""
from pathlib import Path
p = Path('shard/src')
original = (p / 'real_kvm.rs').read_text()
needle = 'unsafe { madvise(self.ram.ptr.cast(), RAM, 4) }'
assert original.count(needle) == 1
replacement = '''unsafe {
                let class = self.snapshot.as_ref().unwrap().class;
                let a = madvise(self.ram.ptr.add(class.start()).cast(), class.bytes(), 4);
                let b = madvise(self.ram.ptr.add(CTRL).cast(), arena::RING_BYTES, 4);
                a.min(b)
            }'''
(p / 'writable_kvm.rs').write_text(original.replace(needle, replacement))
probe = (p / 'bin/perf_review.rs').read_text()
(p / 'bin/perf_writable.rs').write_text(probe.replace('../real_kvm.rs', '../writable_kvm.rs'))
drain_probe = probe.replace('let mut calls = 0;', 'let mut calls = 0; let mut wait_drain_ns = 0u64; let finish_drain_ns;')
drain_probe = drain_probe.replace('if e.op == 3 { finish = e.finish.unwrap(); break; }', '''if e.op == 3 {
                let d = Instant::now(); slot.drain(); finish_drain_ns = d.elapsed().as_nanos() as u64;
                finish = e.finish.unwrap(); break;
            }
            let d = Instant::now(); slot.drain(); wait_drain_ns += d.elapsed().as_nanos() as u64;''')
drain_probe = drain_probe.replace('let run = t.elapsed().as_nanos();', '''let run = t.elapsed().as_nanos();
        if i >= 5 { eprintln!("{{\\"i\\":{},\\"wait_drain_ns\\":{wait_drain_ns},\\"finish_drain_ns\\":{finish_drain_ns}}}",i-5); }''')
(p / 'bin/perf_drain.rs').write_text(drain_probe)
# Reset-only components in original module, with controlled dirtiness and no guest.
extra = '''
impl Slot {
    pub fn review_reset_parts(&mut self, dirty: bool) -> [u64; 3] {
        if dirty { for off in (0..RAM).step_by(4096) {
            unsafe { std::hint::black_box(self.ram.ptr.add(off).read_volatile()); }
        }}
        let t = Instant::now(); self.drain(); let drain = t.elapsed().as_nanos() as u64;
        let t = Instant::now();
        check(unsafe { madvise(self.ram.ptr.cast(), RAM, 4) }, "review discard");
        let discard = t.elapsed().as_nanos() as u64;
        let t = Instant::now(); self.restore_regs(&self.snapshot.as_ref().unwrap().regs);
        [drain, discard, t.elapsed().as_nanos() as u64]
    }
}
'''
(p / 'parts_kvm.rs').write_text(original + extra)
parts = '''
#[path="../arena.rs"] mod arena;
#[path="../parts_kvm.rs"] mod kvm;
#[path="../lease.rs"] mod lease;
fn main() {
 let a:Vec<String>=std::env::args().collect();
 let k=kvm::Kvm::new(); let snap=kvm::Snapshot::load(&a[1]);
 let mut s=kvm::Slot::new(&k,snap);
 for i in 0..205 {let p=s.review_reset_parts(a[2]=="touched");
 if i>=5 {println!("{{\\"i\\":{},\\"drain_ns\\":{},\\"discard_ns\\":{},\\"regs_ns\\":{}}}",i-5,p[0],p[1],p[2]);}}
}
'''
(p / 'bin/perf_parts.rs').write_text(parts)
