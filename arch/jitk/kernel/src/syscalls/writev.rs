#[cfg(not(feature = "transport-ring"))]
use crate::console as c;
use crate::{syscalls::iovec, user::*};
pub fn call(a: &[usize; 6]) -> isize {
    // Linux takes the descriptor as an unsigned int.
    let fd = a[0] as u32 as usize;
    if fd != 1 && fd != 2 {
        return -9;
    }
    if a[2] > 1024 {
        return -22;
    }
    // No iovec is read for an empty vector (Linux: writev(fd, NULL, 0) == 0).
    if a[2] == 0 {
        return 0;
    }
    let Some(_) = access(a[1], a[2] * 16, false) else {
        return -14;
    };
    // Validate the complete writev before emitting any prefix.
    for i in 0..a[2] {
        let (base, len) = iovec(a[1], i);
        if len == 0 {
            continue;
        }
        if len > 1024 * 1024 {
            return -22;
        }
        let Some(_p) = access(base, len, false) else {
            return -14;
        };
        // Console stdout is printable ASCII and LF (kernel/README.md).
        #[cfg(not(feature = "transport-ring"))]
        if fd == 1 {
            // SAFETY: EL0 is stopped in this masked-IRQ trap and access checked every
            // source page; the slice is only read before the terminal diagnostic.
            let bytes = unsafe { core::slice::from_raw_parts(_p as *const u8, len) };
            if bytes.iter().any(|&b| (b < 32 && b != 10) || b >= 127) {
                // SAFETY: This masked-IRQ trap owns console state; off is terminal.
                unsafe {
                    c::print("\x1efatal control byte\n");
                    crate::off();
                }
            }
        }
    }
    let mut total = 0;
    #[cfg(feature = "transport-ring")]
    // SAFETY: This masked-IRQ trap owns console/TX state and EL0 is stopped. The complete
    // iovec range and each used payload are checked above; only stdout/stderr reach
    // native_output.
    if unsafe { crate::console::native() } {
        for i in 0..a[2] {
            let (base, len) = iovec(a[1], i);
            // SAFETY: as above; native_output checks its range again before copying.
            let r = unsafe { crate::console::native_output(fd, base, len) };
            if r < 0 {
                return if total > 0 { total } else { r };
            }
            total += r;
            if r as usize != len {
                break;
            }
        }
        return total;
    }
    for i in 0..a[2] {
        let (base, len) = iovec(a[1], i);
        let r = if fd == 2 {
            crate::syscalls::stderr(base, len)
        } else {
            output(base, len)
        };
        if r < 0 {
            return if total > 0 { total } else { r };
        }
        total += r;
    }
    total
}
