from pathlib import Path
R=Path(__file__).resolve().parent;P=Path('/tmp/jitk-06/r2/libkrun')
p=P/'src/hvf/src/lib.rs';s=p.read_text()
assert 'pub mod jitk_trace' not in s
old=Path('/tmp/jitk-06/libkrun/src/hvf/src/lib.rs').read_text()
s+='\n'+old[old.index('pub mod jitk_trace {'):]
s=s.replace('        let ret = unsafe { hv_vcpu_run(self.vcpuid) };','''        static FIRST: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);
        if FIRST.swap(false, std::sync::atomic::Ordering::Relaxed) {unsafe {jitk_trace::mark(c"vcpu_run_begin".as_ptr());}}
        let ret = unsafe { hv_vcpu_run(self.vcpuid) };''')
p.write_text(s)
p=P/'src/libkrun/src/lib.rs';s=p.read_text()+'''
#[unsafe(no_mangle)]
pub unsafe extern "C" fn jitk_trace_mark(name: *const std::ffi::c_char) {unsafe {hvf::jitk_trace::mark(name);}}
''';p.write_text(s)
p=P/'src/libkrun/src/vmm/mod.rs';s=p.read_text().replace('            libc::_exit(exit_code);','''            hvf::jitk_trace::mark(c"exit_begin".as_ptr());
            hvf::jitk_trace::dump();
            libc::_exit(exit_code);''');p.write_text(s)
s=(R/'final-host.rs').read_text().replace('fn main() {','fn main() {\n    unsafe {jitk_trace_mark(c"main".as_ptr());}')
s=s.replace('    fn sandbox_init(', '    fn jitk_trace_mark(name: *const c_char);\n    fn sandbox_init(')
s=s.replace('    sandbox(image)?;','    unsafe {jitk_trace_mark(c"sandbox_begin".as_ptr());}\n    sandbox(image)?;\n    unsafe {jitk_trace_mark(c"sandbox_end".as_ptr());}')
s=s.replace('    builder.build()?.run();','    unsafe {jitk_trace_mark(c"build_begin".as_ptr());}\n    let vm=builder.build()?;\n    unsafe {jitk_trace_mark(c"build_end".as_ptr());}\n    vm.run();')
s=s.replace('                1 => break,','                1 => {unsafe {jitk_trace_mark(c"go".as_ptr());} break},')
s=s.replace('let cmdline = format!', 'let tick=std::env::var("JITK_TICK_US").unwrap_or("0".into());\n    let cmdline = format!').replace('jitk.counter={counter}"','jitk.counter={counter} jitk.tick_us={tick}"')
(R/'host-static.rs').write_text(s)
