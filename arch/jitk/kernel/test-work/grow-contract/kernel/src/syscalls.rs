#![allow(unused_imports, unused_variables, unused_unsafe)]
include!(concat!(env!("OUT_DIR"), "/dispatch.rs"));

// Controller-owned checked helpers; candidate modules never dereference pointers.
pub fn copyin(addr: usize, dst: &mut [u8]) -> Result<(), isize> {
    unsafe {
        let pa = crate::user::access(addr, dst.len(), false).ok_or(-14isize)?;
        core::ptr::copy_nonoverlapping(pa as *const u8, dst.as_mut_ptr(), dst.len());
    }
    Ok(())
}
pub fn copyout(addr: usize, src: &[u8]) -> Result<(), isize> {
    unsafe {
        let pa = crate::user::access(addr, src.len(), true).ok_or(-14isize)?;
        core::ptr::copy_nonoverlapping(src.as_ptr(), pa as *mut u8, src.len());
    }
    Ok(())
}
pub fn writable(addr: usize, len: usize) -> bool {
    unsafe { crate::user::access(addr, len, true).is_some() }
}
pub fn now_ns() -> u64 { crate::wait::now_ns() }
pub fn poll_fd(fd: i32, events: i16) -> i16 {
    unsafe {
        crate::console::service();
        match fd {
            i32::MIN..=-1 => 0,
            0 => if crate::console::available() && events & 1 != 0 { 1 }
                 else if crate::console::eof() { 16 } else { 0 },
            1 | 2 => events & 4,
            _ => 32,
        }
    }
}
#[allow(dead_code)]
pub fn park(deadline: Option<u64>) { park_poll(deadline, true); }
pub fn park_poll(deadline: Option<u64>, input: bool) {
    unsafe { crate::wait::park_for(deadline.unwrap_or(u64::MAX), input); }
}
pub unsafe fn stderr(va: usize, len: usize) -> isize {
    #[cfg(feature="grow-trace")]
    unsafe {
        if len > 1024*1024 { return -22; }
        let Some(pa) = crate::user::access(va, len, false) else { return -14; };
        let b = core::slice::from_raw_parts(pa as *const u8, len);
        for chunk in b.chunks(128) {
            let mut encoded = [0u8; 256];
            for (i, x) in chunk.iter().enumerate() {
                encoded[i*2] = b"0123456789abcdef"[(x>>4) as usize];
                encoded[i*2+1] = b"0123456789abcdef"[(x&15) as usize];
            }
            crate::console::record(b"\x1e{\"v\":2,\"kind\":\"log\",\"hex\":\"");
            crate::console::record(&encoded[..chunk.len()*2]);
            crate::console::record(b"\"}\n");
        }
    }
    let _ = va;
    len as isize
}
