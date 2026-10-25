from pathlib import Path
import shutil
R=Path(__file__).resolve().parent
K=R/'kernel'
K.mkdir(exist_ok=True)
S=Path('arch/02-guest-kernel')
for f in ['Cargo.toml','link.ld']:
 shutil.copy(S/f,K/f)
shutil.copytree(S/'src',K/'src',dirs_exist_ok=True)
p=K/'src/boot.S';s=p.read_text().replace('_start:\n','_start:\n    mrs x21, cntvct_el0\n').replace('2:  mov x0, x20','2:  ldr x1, =PERF_ENTRY\n    str x21, [x1]\n    mov x0, x20');p.write_text(s)
p=K/'src/main.rs';s=p.read_text().replace('mod console;','mod console;\nmod perf;').replace('mmu::init();','mmu::init();\n        perf::mark(1);').replace('        console::print("hello jitk fdt=");\n        console::hex(fdt);\n        console::print("\\n");','').replace('pub unsafe fn off() -> ! {','pub unsafe fn off() -> ! {\n    unsafe { perf::dump(); }');p.write_text(s)
p=K/'src/user.rs';s=p.read_text().replace('include_bytes!("/tmp/jitk-02/qjs-stripped")','include_bytes!("/tmp/jitk-06/qjs-stripped")').replace('assert!(code.len() < 2048);','assert!(code.len() < 2048);').replace('        asm!("msr vbar_el1','        crate::perf::mark(2);\n        asm!("msr vbar_el1').replace('        let f = core::slice::from_raw_parts_mut(frame, 33);','        crate::perf::first_syscall();\n        let f = core::slice::from_raw_parts_mut(frame, 33);').replace('                c::write(core::slice::from_raw_parts(pa as *const u8, len));','                let bytes=core::slice::from_raw_parts(pa as *const u8, len);\n                if bytes.starts_with(b"FIRST") { crate::perf::mark(4); }\n                crate::perf::observe(bytes);\n                c::write(bytes);');p.write_text(s)
shutil.copy(R/'perf.rs', K/'src/perf.rs')
# Synchronous, fixed echo workload for r1's blocking read; real qjs and console.
(R/'tool.js').write_text('''std.out.puts('FIRST\\n');std.out.flush();
std.out.puts('{"t":"ready","v":1}\\n');std.out.flush();
JSON.parse(std.in.getline());
std.out.puts('{"t":"call","id":1,"ns":"math","fn":"add","args":[1,1]}\\n');std.out.flush();
let r=JSON.parse(std.in.getline());
std.out.puts(JSON.stringify({t:'done',ok:r.ok})+'\\n');std.out.flush();
''')
(R/'print.js').write_text('''std.out.puts('FIRST\\n');std.out.flush();print('hi');std.out.puts('{"t":"ready","v":1}\\n');std.out.flush();''')
