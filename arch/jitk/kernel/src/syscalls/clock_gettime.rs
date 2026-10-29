use crate::syscalls::{copyout, now_ns};
pub fn call(a: &[usize; 6]) -> isize {
    // Linux takes clockid_t as a 32-bit int.
    let clock = a[0] as u32;
    if clock != 0 && clock != 1 {
        return -22;
    }
    // SAFETY: boot initializes the epoch before EL0; it is immutable in a run.
    let offset = if clock == 0 {
        // SAFETY: Boot initializes EPOCH_OFFSET before EL0; the offset remains immutable
        // throughout this run.
        unsafe { crate::EPOCH_OFFSET }
    } else {
        0
    };
    let ns = now_ns() + offset;
    let mut out = [0u8; 16];
    out[..8].copy_from_slice(&(ns / 1_000_000_000).to_le_bytes());
    out[8..].copy_from_slice(&(ns % 1_000_000_000).to_le_bytes());
    match copyout(a[1], &out) {
        Ok(()) => 0,
        Err(e) => e,
    }
}
