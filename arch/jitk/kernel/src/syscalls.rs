pub mod nr {
    #[cfg(feature = "transport-ring")]
    pub const DUP3: usize = 24;
    pub const IOCTL: usize = 29;
    pub const READ: usize = 63;
    pub const WRITE: usize = 64;
    pub const PPOLL: usize = 73;
}
include!(concat!(env!("OUT_DIR"), "/dispatch.rs"));

// Controller-owned checked helpers; candidate modules never dereference pointers.
pub fn copyin(addr: usize, dst: &mut [u8]) -> Result<(), isize> {
    let pa = crate::user::access(addr, dst.len(), false).ok_or(-14isize)?;
    // SAFETY: access checks all source pages; dst is an exclusive EL1 buffer,
    // disjoint from EL0, which is stopped until this syscall returns.
    unsafe {
        core::ptr::copy_nonoverlapping(pa as *const u8, dst.as_mut_ptr(), dst.len());
    }
    Ok(())
}
pub fn copyout(addr: usize, src: &[u8]) -> Result<(), isize> {
    let pa = crate::user::access(addr, src.len(), true).ok_or(-14isize)?;
    // SAFETY: access checks all destination pages writable; src is EL1 data,
    // disjoint from EL0, which cannot run concurrently with this copy.
    unsafe {
        core::ptr::copy_nonoverlapping(src.as_ptr(), pa as *mut u8, src.len());
    }
    Ok(())
}
pub fn writable(addr: usize, len: usize) -> bool {
    crate::user::access(addr, len, true).is_some()
}
pub fn now_ns() -> u64 {
    crate::wait::now_ns()
}
pub fn poll_fd(fd: i32, events: i16) -> i16 {
    // SAFETY: Called from the sole masked-IRQ syscall context after console initialization;
    // service completes before querying cursor state and no queue reference escapes.
    unsafe {
        crate::console::service();
        match fd {
            i32::MIN..=-1 => 0,
            0 => {
                if crate::console::available() && events & 1 != 0 {
                    1
                } else if crate::console::eof() {
                    16
                } else {
                    0
                }
            }
            1 | 2 => events & 4,
            _ => 32,
        }
    }
}
pub fn park_poll(deadline: Option<u64>, input: bool) {
    // SAFETY: Called from the sole masked-IRQ syscall context after wait/console
    // initialization; the caller holds no console/ring-state borrow across the wait.
    unsafe {
        crate::wait::park_for(deadline.unwrap_or(u64::MAX), input);
    }
}
pub fn stderr(va: usize, len: usize) -> isize {
    #[cfg(feature = "grow-trace")]
    // SAFETY: EL0 is stopped in the sole masked-IRQ context. access checks all source pages;
    // bounded stack encoding is copied synchronously into console records.
    unsafe {
        if len > 1024 * 1024 {
            return -22;
        }
        let Some(pa) = crate::user::access(va, len, false) else {
            return -14;
        };
        let b = core::slice::from_raw_parts(pa as *const u8, len);
        for chunk in b.chunks(128) {
            let mut encoded = [0u8; 256];
            for (i, x) in chunk.iter().enumerate() {
                encoded[i * 2] = b"0123456789abcdef"[(x >> 4) as usize];
                encoded[i * 2 + 1] = b"0123456789abcdef"[(x & 15) as usize];
            }
            crate::console::record(b"\x1e{\"v\":2,\"kind\":\"log\",\"hex\":\"");
            crate::console::record(&encoded[..chunk.len() * 2]);
            crate::console::record(b"\"}\n");
        }
    }
    let _ = va;
    len as isize
}

pub fn read_console(addr: usize, len: usize) -> isize {
    if len > 1024 * 1024 {
        return -22;
    }
    // SAFETY: the stopped EL0 caller cannot modify mappings during the copy.
    // access checks every page writable, and user buffers cannot alias EL1 data.
    unsafe {
        match crate::user::access(addr, len, true) {
            Some(pa) => {
                crate::console::read(core::slice::from_raw_parts_mut(pa as *mut u8, len)) as isize
            }
            None => -14,
        }
    }
}

// The array range is checked once by readv/writev before walking its elements.
// Copies avoid lending a user-memory reference to handler logic.
pub fn iovec(addr: usize, index: usize) -> (usize, usize) {
    let mut bytes = [0u8; 16];
    copyin(addr + index * 16, &mut bytes).expect("validated iovec array");
    (
        usize::from_le_bytes(bytes[..8].try_into().unwrap()),
        usize::from_le_bytes(bytes[8..].try_into().unwrap()),
    )
}
