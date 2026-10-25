use crate::{console as c, syscalls as s};
use core::fmt::{self, Write};
static mut SEQ: usize = 0;
struct Writer;
static mut BUFFER: [u8;2048] = [0;2048];
static mut LEN: usize = 0;
impl Write for Writer {
    fn write_str(&mut self, text: &str) -> fmt::Result {
        unsafe {
            assert!(LEN + text.len() <= 2048);
            BUFFER[LEN..LEN+text.len()].copy_from_slice(text.as_bytes());
            LEN += text.len();
        }
        Ok(())
    }
}
fn flush() { unsafe { c::record(&BUFFER[..LEN]); LEN=0; } }
fn bytes(addr: usize, len: usize) {
    // The G4 profile is deliberately bounded. Never silently truncate buffers.
    if len > 128 { let _ = write!(Writer,"null"); return; }
    let mut b = [0u8;128];
    if s::copyin(addr, &mut b[..len]).is_err() { let _=write!(Writer,"null"); return; }
    let _=write!(Writer,"\"");
    for x in &b[..len] { let _=write!(Writer,"{x:02x}"); }
    let _=write!(Writer,"\"");
}
pub fn enter(n:usize,a:&[usize;6],pc:usize) {
    if !cfg!(feature="grow-trace") && s::registered(n) { return; }
    unsafe { SEQ += 1; }
    let kind=if s::registered(n) {"sys.enter"} else {"missing"};
    let _=write!(Writer,"\x1e{{\"v\":2,\"kind\":\"{kind}\",\"seq\":{},\"nr\":{n},\"pc\":{pc},\"args\":[",unsafe{SEQ});
    for (i,x) in a.iter().enumerate() { let _=write!(Writer,"{}{x}",if i==0{""}else{","}); }
    let _=write!(Writer,"],\"input\":");
    if n==64 { bytes(a[1],a[2]); }
    else if n==73 { bytes(a[0],a[1].saturating_mul(8)); }
    else { let _=write!(Writer,"null"); }
    let _=write!(Writer,",\"timeout\":");
    if n==73 && a[2]!=0 { bytes(a[2],16); } else { let _=write!(Writer,"null"); }
    let _=write!(Writer,"}}\n");
    flush();
}
pub fn exit(n:usize,a:&[usize;6],ret:isize) {
    if !cfg!(feature="grow-trace") { return; }
    let _=write!(Writer,"\x1e{{\"v\":2,\"kind\":\"sys.exit\",\"seq\":{},\"ret\":{ret},\"output\":",unsafe{SEQ});
    if n==63 && ret>0 { bytes(a[1],ret as usize); }
    else if n==73 { bytes(a[0],a[1].saturating_mul(8)); }
    else if n==29 { bytes(a[2],8); }
    else { let _=write!(Writer,"null"); }
    let _=write!(Writer,"}}\n");
    flush();
}
pub fn terminal(code:usize) {
    if !cfg!(feature="grow-trace") { return; }
    let _=write!(Writer,"\x1e{{\"v\":2,\"kind\":\"done\",\"seq\":{},\"code\":{code}}}\n",unsafe{SEQ});
    flush();
}
