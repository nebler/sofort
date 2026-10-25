from pathlib import Path
import shutil,json,hashlib
R=Path(__file__).resolve().parent;S=Path('arch/02-guest-kernel/r2');T=Path('/tmp/jitk-06/r2');K=R/'kernel-r2'
assert (S/'READY').exists()
K.mkdir(exist_ok=True)
for f in ['Cargo.toml','link.ld','bootstrap.js']:
 shutil.copy(S/f,K/f)
shutil.copytree(S/'src',K/'src',dirs_exist_ok=True)
shutil.copy('/tmp/jitk-02/r2/qjs.flat',T/'qjs.flat')
shutil.copy('/tmp/jitk-02/r2/kernel.bin',T/'r2-original.bin')
shutil.copy(R/'perf.rs',K/'src/perf.rs')
p=K/'src/boot.S';s=p.read_text().replace('_start:\n','_start:\n    mrs x21, cntvct_el0\n').replace('2:  mov x0, x20','2:  ldr x1, =PERF_ENTRY\n    str x21, [x1]\n    mov x0, x20');p.write_text(s)
p=K/'src/main.rs';s=p.read_text().replace('/tmp/jitk-02/r2/qjs.flat','/tmp/jitk-06/r2/qjs.flat').replace('mod console;','mod console;\nmod perf;').replace('mmu::init();','mmu::init();\n        perf::mark(1);').replace('pub unsafe fn off() -> ! {','pub unsafe fn off() -> ! {\n    unsafe { perf::dump(); }');p.write_text(s)
p=K/'src/user.rs';s=p.read_text().replace('        asm!("msr vbar_el1','        crate::perf::mark(2);\n        asm!("msr vbar_el1').replace('        let f = core::slice::from_raw_parts_mut(frame, 33);','        crate::perf::first_syscall();\n        let f = core::slice::from_raw_parts_mut(frame, 33);').replace('                c::user_write(bytes);','                if bytes.starts_with(b"FIRST") { crate::perf::mark(4); }\n                crate::perf::observe(bytes);\n                c::user_write(bytes);');p.write_text(s)
p=K/'bootstrap.js';p.write_text("std.out.puts('FIRST\\n');std.out.flush();\n"+p.read_text())
# Timer B is deliberately isolated: no guest GIC setup, no ICC ack reads.
p=K/'src/main.rs';v=p.read_text().replace('wait::init(config.dist, config.redist, config.irq, config.tick);','if config.tick==0 {wait::init(config.dist, config.redist, config.irq,0);} else {wait::timer_only(config.tick);}')
p.write_text(v)
p=K/'src/wait.rs';v=p.read_text().replace('        ack();','        if TICK==0 {ack();}')+'\npub unsafe fn timer_only(t:u64){unsafe {TICK=t;}}\n';p.write_text(v)
p=K/'src/user.rs';v=p.read_text().replace('                    if ready != 0 || crate::wait::now_ns() >= deadline {\n                        return ready;','                    if ready != 0 || crate::wait::now_ns() >= deadline {\n                        if ready != 0 {crate::perf::wake();}\n                        return ready;');p.write_text(v)
p=K/'src/perf.rs';s=p.read_text().replace('TIMES:[u64;6]=[0;6]','TIMES:[u64;7]=[0;7]');s+='\npub unsafe fn wake() {unsafe {if TIMES[5]!=0 && TIMES[6]==0 {mark(6);}}}\n';p.write_text(s)
(R/'r2-source.json').write_text(json.dumps(dict(ready=(S/'READY').read_text(),original_sha256=hashlib.sha256((T/'r2-original.bin').read_bytes()).hexdigest(),sources={str(p.relative_to(S)):hashlib.sha256(p.read_bytes()).hexdigest() for p in S.rglob('*') if p.is_file() and p.suffix in ['.rs','.S','.js','.toml','.ld']}),indent=2))
