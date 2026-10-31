// getrandom from ChaCha20 keyed with the run's 16-byte host seed (console
// boot: jitk.seed=, read from the host's /dev/urandom unless a fixed seed was
// asked for). The key is the seed and a domain label, so the stream is not
// AT_RANDOM itself, but a program that reads AT_RANDOM can derive it: it is a
// per-run stream for one tenant, not a secret from that tenant.
//
// Ring builds return ENOSYS: there the seed is handed to the payload once and
// zeroed (ring.rs), so there is nothing left to key a stream with.
#[cfg(not(feature = "transport-ring"))]
use super::{copyout, writable};
#[cfg(not(feature = "transport-ring"))]
use core::sync::atomic::{AtomicU64, Ordering};

#[cfg(feature = "transport-ring")]
pub fn call(a: &[usize]) -> isize {
    let _ = a;
    -38
}

#[cfg(not(feature = "transport-ring"))]
pub fn call(a: &[usize]) -> isize {
    if a.len() < 3 {
        return -22;
    }
    let (addr, len, flags) = (a[0], a[1], a[2] as u32);
    // GRND_NONBLOCK | GRND_RANDOM | GRND_INSECURE; RANDOM and INSECURE exclude each other.
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
    // SAFETY: boot writes SEED before EL0 starts; it is immutable for the run.
    let seed = unsafe { crate::SEED };
    if seed == [0; 16] {
        return -38;
    }
    let mut key = [0u32; 8];
    for (i, word) in key[..4].iter_mut().enumerate() {
        *word = u32::from_le_bytes(seed[i * 4..i * 4 + 4].try_into().unwrap());
    }
    for (i, word) in key[4..].iter_mut().enumerate() {
        *word = u32::from_le_bytes(b"jitk.getrandom.k"[i * 4..i * 4 + 4].try_into().unwrap());
    }
    // One stream per run: blocks are numbered across calls.
    static BLOCK: AtomicU64 = AtomicU64::new(0);
    let mut done = 0usize;
    while done < len {
        let block = chacha20(&key, BLOCK.fetch_add(1, Ordering::Relaxed));
        let count = (len - done).min(block.len());
        if let Err(error) = copyout(addr + done, &block[..count]) {
            return if done == 0 { error } else { done as isize };
        }
        done += count;
    }
    done as isize
}

#[cfg(not(feature = "transport-ring"))]
fn chacha20(key: &[u32; 8], counter: u64) -> [u8; 64] {
    let mut state = [0u32; 16];
    state[..4].copy_from_slice(&[0x6170_7865, 0x3320_646e, 0x7962_2d32, 0x6b20_6574]);
    state[4..12].copy_from_slice(key);
    state[12] = counter as u32;
    state[13] = (counter >> 32) as u32;
    let mut x = state;
    let quarter = |x: &mut [u32; 16], a: usize, b: usize, c: usize, d: usize| {
        x[a] = x[a].wrapping_add(x[b]);
        x[d] = (x[d] ^ x[a]).rotate_left(16);
        x[c] = x[c].wrapping_add(x[d]);
        x[b] = (x[b] ^ x[c]).rotate_left(12);
        x[a] = x[a].wrapping_add(x[b]);
        x[d] = (x[d] ^ x[a]).rotate_left(8);
        x[c] = x[c].wrapping_add(x[d]);
        x[b] = (x[b] ^ x[c]).rotate_left(7);
    };
    for _ in 0..10 {
        quarter(&mut x, 0, 4, 8, 12);
        quarter(&mut x, 1, 5, 9, 13);
        quarter(&mut x, 2, 6, 10, 14);
        quarter(&mut x, 3, 7, 11, 15);
        quarter(&mut x, 0, 5, 10, 15);
        quarter(&mut x, 1, 6, 11, 12);
        quarter(&mut x, 2, 7, 8, 13);
        quarter(&mut x, 3, 4, 9, 14);
    }
    let mut out = [0u8; 64];
    for i in 0..16 {
        out[i * 4..i * 4 + 4].copy_from_slice(&x[i].wrapping_add(state[i]).to_le_bytes());
    }
    out
}
