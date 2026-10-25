"""On the r1 private instrumented libkrun, retain only the first vCPU entry.
Apply r1 instrument_libkrun.py and add_payload_trace.py to a fresh private copy
first. All events remain buffered until _exit, avoiding per-VM-exit I/O.
"""
from pathlib import Path
p=Path('/tmp/jitk-06/libkrun/src/hvf/src/lib.rs');s=p.read_text()
a='unsafe { jitk_trace::mark(c"vcpu_run_begin".as_ptr()); }'
b='static FIRST: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);\n        if FIRST.swap(false, std::sync::atomic::Ordering::Relaxed) { unsafe { jitk_trace::mark(c"vcpu_run_begin".as_ptr()); } }'
if 'static FIRST:' not in s:
 assert s.count(a)==1;s=s.replace(a,b)
s=s.replace('        unsafe { jitk_trace::mark(c"vcpu_run_end".as_ptr()); }','');p.write_text(s)
