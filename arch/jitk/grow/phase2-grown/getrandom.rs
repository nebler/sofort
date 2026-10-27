use super::{copyout, now_ns, writable};
use core::sync::atomic::{AtomicU64, Ordering};

pub fn call(a: &[usize]) -> isize {
    if a.len() < 3 {
        return -22;
    }
    let addr = a[0];
    let len = a[1];
    let flags = a[2] as u32;
    if flags & !7 != 0 || flags & 6 == 6 {
        return -22;
    }
    if addr > 0x0000_ffff_ffff_ffffusize {
        return -14;
    }
    if len == 0 {
        return 0;
    }
    if len > isize::MAX as usize || !writable(addr, len) {
        return -14;
    }
    static SEQUENCE: AtomicU64 = AtomicU64::new(1);
    let mut state = now_ns()
        ^ SEQUENCE.fetch_add(0x9e3779b97f4a7c15, Ordering::Relaxed);
    let mut buffer = [0u8; 256];
    let mut done = 0usize;
    while done < len {
        let count = (len - done).min(buffer.len());
        for byte in &mut buffer[..count] {
            state = state.wrapping_add(0x9e3779b97f4a7c15);
            let mut value = state;
            value = (value ^ (value >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
            value = (value ^ (value >> 27)).wrapping_mul(0x94d049bb133111eb);
            *byte = (value ^ (value >> 31)) as u8;
        }
        if let Err(error) = copyout(addr + done, &buffer[..count]) {
            return if done == 0 { error } else { done as isize };
        }
        done += count;
    }
    done as isize
}
