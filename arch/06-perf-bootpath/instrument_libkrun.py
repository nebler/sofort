#!/usr/bin/env python3
"""Apply only to a private copy of libkrun a1d8616."""
from pathlib import Path
p=Path('/tmp/jitk-06/libkrun')
f=p/'src/hvf/src/lib.rs'
s=f.read_text()
s+='''
// Benchmark only: buffered, monotonic timestamps; no I/O on measured path.
pub mod jitk_trace {
    use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
    use std::ffi::{CStr, c_char};
    struct Slot { name: AtomicUsize, ns: AtomicU64 }
    static EVENTS: [Slot;256] = [const { Slot { name: AtomicUsize::new(0), ns: AtomicU64::new(0) } };256];
    static COUNT: AtomicUsize = AtomicUsize::new(0);
    unsafe extern "C" { fn clock_gettime_nsec_np(clock: i32) -> u64; fn write(fd: i32, p: *const std::ffi::c_void, n: usize) -> isize; }
    pub unsafe fn mark(name: *const c_char) {
        let ns = unsafe { clock_gettime_nsec_np(4) }; // Darwin CLOCK_MONOTONIC_RAW
        let i = COUNT.fetch_add(1, Ordering::Relaxed);
        if i < 256 {
            EVENTS[i].name.store(name as usize, Ordering::Relaxed);
            EVENTS[i].ns.store(ns, Ordering::Release);
        }
    }
    pub fn dump() {
        let mut s = String::from("{\\\"events\\\":[");
        for i in 0..COUNT.load(Ordering::Acquire).min(256) {
            let ns = EVENTS[i].ns.load(Ordering::Acquire);
            let name = unsafe { CStr::from_ptr(EVENTS[i].name.load(Ordering::Relaxed) as *const c_char) }.to_str().unwrap();
            if i > 0 { s.push(','); }
            s.push_str(&format!("[\\\"{name}\\\",{ns}]"));
        }
        s.push_str("]}\\n");
        unsafe { write(2,s.as_ptr().cast(),s.len()); }
    }
}
'''
s=s.replace('let ret = unsafe { hv_vm_create(config) };','unsafe { jitk_trace::mark(c"vm_create_begin".as_ptr()); }\n        let ret = unsafe { hv_vm_create(config) };\n        unsafe { jitk_trace::mark(c"vm_create_end".as_ptr()); }')
s=s.replace('        let ret = unsafe {\n            hv_vm_map(', '        unsafe { jitk_trace::mark(c"vm_map_begin".as_ptr()); }\n        let ret = unsafe {\n            hv_vm_map(')
s=s.replace('        if ret != HV_SUCCESS {\n            Err(Error::MemoryMap)', '        unsafe { jitk_trace::mark(c"vm_map_end".as_ptr()); }\n        if ret != HV_SUCCESS {\n            Err(Error::MemoryMap)')
s=s.replace('        let ret = unsafe {\n            hv_vcpu_create(', '        unsafe { jitk_trace::mark(c"vcpu_create_begin".as_ptr()); }\n        let ret = unsafe {\n            hv_vcpu_create(')
s=s.replace('        if ret != HV_SUCCESS {\n            return Err(Error::VcpuCreate);\n        }\n\n        //', '        unsafe { jitk_trace::mark(c"vcpu_create_end".as_ptr()); }\n        if ret != HV_SUCCESS {\n            return Err(Error::VcpuCreate);\n        }\n\n        //',1)
s=s.replace('        let ret = unsafe { hv_vcpu_run(self.vcpuid) };', '        unsafe { jitk_trace::mark(c"vcpu_run_begin".as_ptr()); }\n        let ret = unsafe { hv_vcpu_run(self.vcpuid) };\n        unsafe { jitk_trace::mark(c"vcpu_run_end".as_ptr()); }')
f.write_text(s)
f=p/'src/libkrun/src/lib.rs'
f.write_text(f.read_text()+'''\n#[unsafe(no_mangle)]
pub unsafe extern "C" fn jitk_trace_mark(name: *const std::ffi::c_char) { unsafe { hvf::jitk_trace::mark(name); } }
#[unsafe(no_mangle)]
pub extern "C" fn jitk_trace_dump() { hvf::jitk_trace::dump(); }
''')
f=p/'src/libkrun/src/vmm/mod.rs'
s=f.read_text().replace('            libc::_exit(exit_code);','            hvf::jitk_trace::mark(c"exit_begin".as_ptr());\n            hvf::jitk_trace::dump();\n            libc::_exit(exit_code);')
f.write_text(s)
