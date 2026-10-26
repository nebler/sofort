use crate::{console as c, syscalls::iovec, user::*};
pub fn call(a: &[usize; 6]) -> isize {
    if a[2] > 1024 {
        return -22;
    }
    let Some(_) = access(a[1], a[2] * 16, false) else {
        return -14;
    };
    let mut total = 0;
    if a[0] != 1 && a[0] != 2 {
        return -9;
    }
    #[cfg(feature = "transport-ring")]
    // SAFETY: This masked-IRQ trap owns console/TX state and EL0 is stopped. The complete
    // iovec range and each used payload are checked before reading; only stdout/stderr reach
    // native_output.
    if unsafe { crate::console::native() } {
        for i in 0..a[2] {
            let (base, len) = iovec(a[1], i);
            if len == 0 {
                continue;
            }
            if len > 1024 * 1024 {
                return -22;
            }
            if access(base, len, false).is_none() {
                return -14;
            }
        }
        for i in 0..a[2] {
            let (base, len) = iovec(a[1], i);
            // SAFETY: This masked-IRQ trap owns console/TX state and EL0 is stopped.
            // The complete iovec range and each used payload are checked before
            // reading; only stdout/stderr reach native_output.
            let r = unsafe { crate::console::native_output(a[0], base, len) };
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
    // Validate the complete writev before emitting any prefix.
    if a[0] == 1 {
        for i in 0..a[2] {
            let (base, len) = iovec(a[1], i);
            if len == 0 {
                continue;
            }
            if len > 1024 * 1024 {
                return -22;
            }
            let Some(p) = access(base, len, false) else {
                return -14;
            };
            // SAFETY: This masked-IRQ trap owns console/TX state and EL0 is stopped.
            // The complete iovec range and each used payload are checked before
            // reading; only stdout/stderr reach native_output.
            let bytes = unsafe { core::slice::from_raw_parts(p as *const u8, len) };
            if bytes.iter().any(|&b| (b < 32 && b != 10) || b >= 127) {
                // SAFETY: This masked-IRQ trap owns console/TX state and EL0 is
                // stopped. The complete iovec range and each used payload are
                // checked before reading; only stdout/stderr reach
                // native_output.
                unsafe {
                    c::print("\x1efatal control byte\n");
                    crate::off();
                }
            }
        }
    }
    for i in 0..a[2] {
        let (base, len) = iovec(a[1], i);
        let r = if a[0] == 2 {
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
