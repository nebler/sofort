use crate::syscalls::{copyout, now_ns};
pub fn call(a: &[usize; 6]) -> isize {
    if a[0] != 0 && a[0] != 1 {
        return -22;
    }
    // SAFETY: boot initializes the epoch before EL0; it is immutable in a run.
    let offset = if a[0] == 0 {
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
