// The guest's own figures: uptime on CLOCK_MONOTONIC's clock, the mmap window
// as total RAM with its unmapped pages free, no swap, one process.
use super::{copyout, mmap_arena, now_ns, page_mapped};

pub fn call(a: &[usize]) -> isize {
    // Grown for the console profile; ring builds keep their surface (ENOSYS).
    if cfg!(feature = "transport-ring") {
        return -38;
    }
    let addr = match a.first() {
        Some(&addr) => addr,
        None => return -14,
    };
    if addr == 0 || addr.checked_add(112).is_none() {
        return -14;
    }
    let (start, end) = mmap_arena();
    let (low, high) = ((start + 4095) & !4095, end & !4095);
    let total = high.saturating_sub(low);
    let used = (low..high)
        .step_by(4096)
        .filter(|&p| page_mapped(p))
        .count()
        * 4096;
    // uptime, loads[3], totalram, freeram, sharedram, bufferram, totalswap, freeswap
    let fields: [u64; 10] = [
        now_ns() / 1_000_000_000,
        0,
        0,
        0,
        total as u64,
        (total - used) as u64,
        0,
        0,
        0,
        0,
    ];
    let mut info = [0u8; 112];
    for (i, value) in fields.iter().enumerate() {
        info[i * 8..i * 8 + 8].copy_from_slice(&value.to_le_bytes());
    }
    info[80..82].copy_from_slice(&1u16.to_le_bytes()); // procs
    info[104..108].copy_from_slice(&1u32.to_le_bytes()); // mem_unit
    match copyout(addr, &info) {
        Ok(()) => 0,
        Err(err) => err,
    }
}
