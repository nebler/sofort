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
pub fn now_ns() -> u64 {
    let t: u64; let hz: u64;
    unsafe { core::arch::asm!("mrs {t},cntvct_el0", "mrs {h},cntfrq_el0",t=out(reg)t,h=out(reg)hz); }
    (t as u128 * 1_000_000_000 / hz as u128) as u64
}
pub fn poll_fd(fd: i32, events: i16) -> i16 {
    match fd {
        i32::MIN..=-1 => 0,
        0 => if events & 1 != 0 && unsafe { crate::console::readable() } { 1 } else { 0 },
        1 | 2 => events & 4,
        _ => 32, // POLLNVAL
    }
}
