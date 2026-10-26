use crate::{
    console as c,
    syscalls::{self as s, nr},
};
use core::fmt::{self, Write};
static mut SEQ: usize = 0;
struct Writer;
static mut BUFFER: [u8; 2048] = [0; 2048];
static mut LEN: usize = 0;
impl Write for Writer {
    fn write_str(&mut self, text: &str) -> fmt::Result {
        // SAFETY: Only the sole masked-IRQ syscall context accesses trace state. The
        // length check bounds BUFFER writes and no buffer reference escapes.
        unsafe {
            assert!(LEN + text.len() <= 2048);
            BUFFER[LEN..LEN + text.len()].copy_from_slice(text.as_bytes());
            LEN += text.len();
        }
        Ok(())
    }
}
fn flush() {
    // SAFETY: Only this masked-IRQ context accesses BUFFER/LEN. record copies synchronously
    // and does not reenter tracing; the slice ends before LEN is reset.
    unsafe {
        c::record(&BUFFER[..LEN]);
        LEN = 0;
    }
}
fn bytes(addr: usize, len: usize) {
    // The G4 profile is deliberately bounded. Never silently truncate buffers.
    if len > 128 {
        let _ = write!(Writer, "null");
        return;
    }
    let mut b = [0u8; 128];
    if s::copyin(addr, &mut b[..len]).is_err() {
        let _ = write!(Writer, "null");
        return;
    }
    let _ = write!(Writer, "\"");
    for x in &b[..len] {
        let _ = write!(Writer, "{x:02x}");
    }
    let _ = write!(Writer, "\"");
}
pub fn enter(n: usize, a: &[usize; 6], pc: usize) {
    if !cfg!(feature = "grow-trace") && s::registered(n) {
        return;
    }
    // SAFETY: Only the sole masked-IRQ syscall context updates the sequence; no reference to
    // mutable trace state escapes.
    unsafe {
        SEQ += 1;
    }
    let kind = if s::registered(n) {
        "sys.enter"
    } else {
        "missing"
    };
    let _ = write!(
        Writer,
        "\x1e{{\"v\":2,\"kind\":\"{kind}\",\"seq\":{},\"nr\":{n},\"pc\":{pc},\"args\":[",
        sequence()
    );
    for (i, x) in a.iter().enumerate() {
        let _ = write!(Writer, "{}{x}", if i == 0 { "" } else { "," });
    }
    let _ = write!(Writer, "],\"input\":");
    if n == nr::WRITE {
        bytes(a[1], a[2]);
    } else if n == nr::PPOLL {
        bytes(a[0], a[1].saturating_mul(8));
    } else {
        let _ = write!(Writer, "null");
    }
    let _ = write!(Writer, ",\"timeout\":");
    if n == nr::PPOLL && a[2] != 0 {
        bytes(a[2], 16);
    } else {
        let _ = write!(Writer, "null");
    }
    let _ = writeln!(Writer, "}}");
    flush();
}
pub fn exit(n: usize, a: &[usize; 6], ret: isize) {
    if !cfg!(feature = "grow-trace") {
        return;
    }
    let _ = write!(
        Writer,
        "\x1e{{\"v\":2,\"kind\":\"sys.exit\",\"seq\":{},\"ret\":{ret},\"output\":",
        sequence()
    );
    if n == nr::READ && ret > 0 {
        bytes(a[1], ret as usize);
    } else if n == nr::PPOLL {
        bytes(a[0], a[1].saturating_mul(8));
    } else if n == nr::IOCTL {
        bytes(a[2], 8);
    } else {
        let _ = write!(Writer, "null");
    }
    let _ = writeln!(Writer, "}}");
    flush();
}
pub fn terminal(code: usize) {
    if !cfg!(feature = "grow-trace") {
        return;
    }
    let _ = writeln!(
        Writer,
        "\x1e{{\"v\":2,\"kind\":\"done\",\"seq\":{},\"code\":{code}}}",
        sequence()
    );
    flush();
}

fn sequence() -> usize {
    // SAFETY: only the one masked-IRQ syscall context accesses trace state.
    unsafe { SEQ }
}
