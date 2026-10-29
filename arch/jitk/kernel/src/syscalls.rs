// Generated from slots.json and src/arch/<arch>/syscalls.json: handler modules,
// dispatch, registered(), and `nr` (Linux syscall numbers on this arch).
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
// Controller-owned anonymous-memory primitives. A handler chooses addresses;
// these check every range against the mmap arena and own the page tables, so
// handler code needs no unsafe and cannot reach the image, archive or stack.
#[allow(
    dead_code,
    reason = "Grown mmap policies use these; the canonical mmap predates them."
)]
pub fn mmap_arena() -> (usize, usize) {
    #[cfg(feature = "transport-ring")]
    let limit = crate::mmu::mmap_limit();
    #[cfg(not(feature = "transport-ring"))]
    let limit = crate::memory::MMAP_END;
    (crate::user::MMAP, limit)
}
#[allow(
    dead_code,
    reason = "Grown mmap policies use these; the canonical mmap predates them."
)]
pub fn page_mapped(va: usize) -> bool {
    let (start, end) = mmap_arena();
    (start..end).contains(&va) && crate::mmu::valid(va & !4095, false)
}
#[allow(
    dead_code,
    reason = "Grown mmap policies use these; the canonical mmap predates them."
)]
pub fn map_zeroed(base: usize, len: usize) -> bool {
    let (start, end) = mmap_arena();
    let Some(stop) = base.checked_add(len) else {
        return false;
    };
    if !base.is_multiple_of(4096)
        || len == 0
        || !len.is_multiple_of(4096)
        || base < start
        || stop > end
    {
        return false;
    }
    if (base..stop)
        .step_by(4096)
        .any(|va| crate::mmu::valid(va, false))
    {
        return false;
    }
    // SAFETY: the range is page-aligned, inside the mmap arena and unmapped, so
    // its backing is disjoint from every live mapping. This masked-IRQ trap owns
    // the tables and flushes before EL0 resumes.
    unsafe {
        crate::user::pages(base, stop, true, false);
        core::ptr::write_bytes(crate::mmu::physical(base) as *mut u8, 0, len);
        crate::mmu::flush();
    }
    true
}
pub fn now_ns() -> u64 {
    crate::wait::now_ns()
}
pub fn poll_fd(fd: i32, events: i16) -> i16 {
    // SAFETY: Called from the sole masked-IRQ syscall context after console initialization;
    // service completes before querying cursor state and no queue reference escapes.
    unsafe {
        crate::console::service();
        if fd < 0 {
            return 0;
        }
        match crate::fs::kind(fd as usize) {
            // Linux reports a regular file (or directory) always readable and
            // writable: DEFAULT_POLLMASK, masked by the requested events.
            Ok(crate::fs::FdKind::Archive) => events & 0x145,
            Ok(crate::fs::FdKind::Console) if fd == 0 => {
                if crate::console::available() && events & 1 != 0 {
                    1
                } else if crate::console::eof() {
                    16
                } else {
                    0
                }
            }
            Ok(crate::fs::FdKind::Console) => events & 4,
            Err(_) => 32,
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
/// A write nobody reads (fd 2 in production; fd 1 of the ring JS profile). The
/// buffer is still checked as Linux would: EFAULT for unmapped bytes, EINVAL past
/// the 1 MiB write bound (as stdout), 0 for an empty write.
pub fn discard(va: usize, len: usize) -> isize {
    if len == 0 {
        return 0;
    }
    if len > 1024 * 1024 {
        return -22;
    }
    match crate::user::access(va, len, false) {
        Some(_) => len as isize,
        None => -14,
    }
}
pub fn stderr(va: usize, len: usize) -> isize {
    let checked = discard(va, len);
    #[cfg(feature = "grow-trace")]
    // SAFETY: EL0 is stopped in the sole masked-IRQ context. discard checked all source
    // pages; bounded stack encoding is copied synchronously into console records.
    unsafe {
        if checked <= 0 {
            return checked;
        }
        let pa = crate::user::access(va, len, false).expect("checked stderr buffer");
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
    checked
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
