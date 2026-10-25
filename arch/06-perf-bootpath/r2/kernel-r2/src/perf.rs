use core::arch::asm;
#[unsafe(no_mangle)] pub static mut PERF_ENTRY:u64=0;
static mut TIMES:[u64;7]=[0;7];
pub unsafe fn mark(i:usize) { unsafe { let t:u64; asm!("isb","mrs {t},cntvct_el0",t=out(reg)t); TIMES[i]=t; } }
pub unsafe fn first_syscall() { unsafe { if TIMES[3]==0 { mark(3); } } }
pub unsafe fn dump() { unsafe {
 TIMES[0]=PERF_ENTRY;
 crate::console::print("\x1ePERF ");
 let hz:u64;asm!("mrs {h},cntfrq_el0",h=out(reg)hz);crate::console::hex(hz as usize);
 for t in TIMES {crate::console::print(" ");crate::console::hex(t as usize);}
 crate::console::print("\n");
} }

pub unsafe fn observe(bytes:&[u8]) {unsafe {
 static mut MATCH:usize=0;const PAT:&[u8]=b"{\"t\":\"ready\"";
 for &b in bytes { if b==PAT[MATCH] { MATCH+=1; if MATCH==PAT.len(){mark(5);MATCH=0;} } else {MATCH=if b==PAT[0]{1}else{0};} }
} }

pub unsafe fn wake() {unsafe {if TIMES[5]!=0 && TIMES[6]==0 {mark(6);}}}
