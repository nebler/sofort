//! Diagnostic (`--features heap-trace`, ring builds only; never in a product
//! image): records every memory syscall a run makes and the mmap window's
//! layout at its first ENOMEM, and sends them as console lines before the
//! completion (`bench/v1/harness/heap-trace.ts` decodes them).
//!
//! A record is one u64: op (4 bits) and three 20-bit page counts or page
//! numbers (VA >> 12), so the trace fits the executor's console budget.
//! - 1 mmap: a pages, b result page (0xfffff on failure)
//! - 2 munmap: a pages, b page (0xfffff: the call failed)
//! - 3 mremap: a old pages, b old page, c new pages; record 7 follows: a
//!   result page (0xfffff on failure)
//! - 4 brk: a resulting break page, b requested break page
//! - 5 madvise: a pages, b page
//!
//! In records 1, 2, 4, 5 and 7, c is the pages mapped in the mmap window
//! after the call.
use crate::syscalls::nr;

const RECORDS: usize = 14000;
const PAGES: usize = 0x2400000 / 4096;
static mut TRACE: [u64; RECORDS] = [0; RECORDS];
static mut COUNT: usize = 0;
static mut DROPPED: usize = 0;
static mut CALLS: [usize; 8] = [0; 8];
static mut PEAK_LIVE: usize = 0;
static mut OOM_BITMAP: [u64; PAGES / 64] = [0; PAGES / 64];
static mut OOM_REQUEST: usize = 0;
static mut OOM_LIVE: usize = 0;
static mut OOMS: usize = 0;
static mut LINE: [u8; 4096] = [0; 4096];

fn page(v: usize) -> u64 {
    (v as u64 >> 12) & 0xfffff
}
unsafe fn push(op: u64, a: u64, b: u64, c: u64) {
    // SAFETY: the sole masked-IRQ trap owns the trace.
    unsafe {
        if COUNT < RECORDS {
            TRACE[COUNT] = op << 60 | (a & 0xfffff) << 40 | (b & 0xfffff) << 20 | (c & 0xfffff);
            COUNT += 1;
        } else {
            DROPPED += 1;
        }
    }
}
fn live() -> usize {
    let (start, end) = crate::syscalls::mmap_arena();
    (start..end)
        .step_by(4096)
        .filter(|&va| crate::mmu::valid(va, false))
        .count()
}
/// Called by mmap before it returns ENOMEM.
///
/// # Safety
/// The sole masked-IRQ trap owns the trace.
pub unsafe fn enomem(len: usize) {
    // SAFETY: as above.
    unsafe {
        OOMS += 1;
        if OOMS > 1 {
            return;
        }
        OOM_REQUEST = len >> 12;
        OOM_LIVE = live();
        for va in (crate::memory::USER_BASE..crate::memory::USER_END).step_by(4096) {
            if crate::mmu::valid(va, false) {
                let p = va >> 12;
                OOM_BITMAP[p / 64] |= 1 << (p % 64);
            }
        }
    }
}
/// After every syscall (the trap's `syscall_entry`).
///
/// # Safety
/// The sole masked-IRQ trap owns the trace.
pub unsafe fn record(n: usize, a: &[usize; 6], ret: isize) {
    // SAFETY: as above.
    unsafe {
        let pages = |len: usize| (len as u64).div_ceil(4096);
        let fail = |r: isize| if r < 0 { 0xfffff } else { page(r as usize) };
        let l = live();
        PEAK_LIVE = PEAK_LIVE.max(l);
        let l = l as u64;
        let op = match n {
            nr::MMAP => {
                push(1, pages(a[1]), fail(ret), l);
                1
            }
            nr::MUNMAP => {
                push(2, pages(a[1]), if ret != 0 { 0xfffff } else { page(a[0]) }, l);
                2
            }
            nr::MREMAP => {
                push(3, pages(a[1]), page(a[0]), pages(a[2]));
                push(7, fail(ret), 0, l);
                3
            }
            nr::BRK => {
                push(4, page(ret as usize), page(a[0]), l);
                4
            }
            nr::MADVISE => {
                push(5, pages(a[1]), page(a[0]), l);
                5
            }
            _ => return,
        };
        CALLS[op] += 1;
    }
}
unsafe fn line(tag: &[u8], body: &[u8]) {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    // SAFETY: the sole masked-IRQ trap owns LINE and TX.
    unsafe {
        let b = &mut *(&raw mut LINE);
        let head = b"[\"log\",\"HT:";
        let mut n = 0;
        for &x in head.iter().chain(tag).chain(b":") {
            b[n] = x;
            n += 1;
        }
        for &x in body {
            b[n] = HEX[(x >> 4) as usize];
            b[n + 1] = HEX[(x & 15) as usize];
            n += 2;
        }
        b[n] = b'"';
        b[n + 1] = b']';
        crate::console::send_console(&b[..n + 2]);
    }
}
fn words(w: &[u64]) -> &[u8] {
    // SAFETY: u64 slices are plain bytes.
    unsafe { core::slice::from_raw_parts(w.as_ptr().cast(), w.len() * 8) }
}
/// Send the trace before the completion.
///
/// # Safety
/// The sole masked-IRQ trap owns the trace and TX.
pub unsafe fn emit() {
    // SAFETY: as above.
    unsafe {
        let (start, end) = crate::syscalls::mmap_arena();
        let summary = [
            COUNT as u64,
            DROPPED as u64,
            CALLS[1] as u64,
            CALLS[2] as u64,
            CALLS[3] as u64,
            CALLS[4] as u64,
            CALLS[5] as u64,
            PEAK_LIVE as u64,
            OOMS as u64,
            OOM_REQUEST as u64,
            OOM_LIVE as u64,
            start as u64,
            end as u64,
            crate::user::HEAP as u64,
        ];
        line(b"S", words(&summary));
        if OOMS > 0 {
            for (i, c) in words(&*(&raw const OOM_BITMAP)).chunks(1984).enumerate() {
                line(&[b'B', b'0' + i as u8], c);
            }
        }
        for c in words(&(&*(&raw const TRACE))[..COUNT]).chunks(1984) {
            line(b"T", c);
        }
    }
}
