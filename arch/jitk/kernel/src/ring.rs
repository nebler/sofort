//! Experimental v2 subset. See shard/ABI-R6.md; never linked into default.
use core::sync::atomic::{
    AtomicU64,
    Ordering::{Acquire, Release},
};
pub const CTRL: usize = 0x81d00000;
const TX: usize = CTRL + 0x4000;
const RX: usize = CTRL + 0xc000;
const SIZE: usize = 32768;
const LIMIT: usize = 1024;
#[derive(Clone, Copy)]
struct Pending {
    state: u8,
    kind: u16,
    len: usize,
    bytes: [u8; LIMIT],
}
static mut PENDING: [Pending; 32] = [Pending {
    state: 0,
    kind: 0,
    len: 0,
    bytes: [0; LIMIT],
}; 32];
static mut NEXT: usize = 1;
static mut INPUT: usize = 0;
static mut CANARY: u64 = 0;
static mut REPAIR_READ: bool = false;

pub unsafe fn load(off: usize) -> u64 {
    unsafe { (&*((CTRL + off) as *const AtomicU64)).load(Acquire) }
}
pub unsafe fn store(off: usize, v: u64) {
    unsafe { (&*((CTRL + off) as *const AtomicU64)).store(v, Release) }
}
unsafe fn copy_ring(base: usize, cursor: usize, b: &mut [u8], write: bool) {
    for (i, x) in b.iter_mut().enumerate() {
        let p = (base + (cursor + i) % SIZE) as *mut u8;
        unsafe {
            if write {
                p.write(*x);
            } else {
                *x = p.read();
            }
        }
    }
}
pub unsafe fn init(_: usize) {
    unsafe {
        assert_eq!((CTRL as *const u32).read(), 0x324b544a);
        assert_eq!(((CTRL + 4) as *const u16).read(), 2);
    }
}
unsafe fn send(kind: u16, flags: u16, id: u64, payload: &[u8]) {
    unsafe {
        let len = (32 + payload.len() + 7) & !7;
        assert!(len <= 16384);
        let mut prod = load(0x40) as usize;
        loop {
            let cons = load(0x80) as usize;
            assert!(prod >= cons && prod - cons <= SIZE);
            if len <= SIZE - (prod - cons) {
                break;
            }
            crate::arch::doorbell(1);
            prod = load(0x40) as usize;
        }
        let mut h = [0u8; 32];
        h[..4].copy_from_slice(&(len as u32).to_le_bytes());
        h[4..6].copy_from_slice(&kind.to_le_bytes());
        h[6..8].copy_from_slice(&flags.to_le_bytes());
        h[8..16].copy_from_slice(&load(8).to_le_bytes());
        h[16..24].copy_from_slice(&id.to_le_bytes());
        h[24..28].copy_from_slice(&(payload.len() as u32).to_le_bytes());
        if kind == 1 {
            h[28..].copy_from_slice(&1u32.to_le_bytes());
        }
        copy_ring(TX, prod, &mut h, true);
        // No allocator or unbounded stack copy. The user range was checked.
        for (i, b) in payload.iter().enumerate() {
            ((TX + (prod + 32 + i) % SIZE) as *mut u8).write(*b);
        }
        for i in 32 + payload.len()..len {
            ((TX + (prod + i) % SIZE) as *mut u8).write(0);
        }
        store(0x40, prod.checked_add(len).unwrap() as u64);
    }
}
pub unsafe fn service() {
    unsafe {
        let prod = load(0xc0) as usize;
        let mut cons = load(0x100) as usize;
        assert!(prod >= cons && prod - cons <= SIZE && prod % 8 == 0);
        while cons < prod {
            assert!(prod - cons >= 32);
            let mut h = [0u8; 32];
            copy_ring(RX, cons, &mut h, false);
            let len = u32::from_le_bytes(h[..4].try_into().unwrap()) as usize;
            let kind = u16::from_le_bytes(h[4..6].try_into().unwrap());
            let flags = u16::from_le_bytes(h[6..8].try_into().unwrap());
            let genid = u64::from_le_bytes(h[8..16].try_into().unwrap());
            let id = u64::from_le_bytes(h[16..24].try_into().unwrap()) as usize;
            let n = u32::from_le_bytes(h[24..28].try_into().unwrap()) as usize;
            assert!((32..=16384).contains(&len) && len % 8 == 0 && len <= prod - cons);
            assert!(n <= LIMIT && len == (32 + n + 7) & !7 && flags == 1);
            assert!(genid == load(8) && (1..=32).contains(&id) && (kind == 2 || kind == 3));
            assert_eq!(u32::from_le_bytes(h[28..].try_into().unwrap()), 1);
            let p = &mut PENDING[id - 1];
            assert_eq!(p.state, 1);
            copy_ring(RX, cons + 32, &mut p.bytes[..n], false);
            let mut padding = [0u8; 7];
            copy_ring(RX, cons + 32 + n, &mut padding[..len - 32 - n], false);
            assert!(padding.iter().all(|b| *b == 0));
            p.len = n;
            p.kind = kind;
            p.state = 2;
            cons += len;
        }
        store(0x100, cons as u64);
    }
}
pub unsafe fn available() -> bool {
    unsafe { !native() && (INPUT < load(0x228) as usize || PENDING.iter().any(|p| p.state == 2)) }
}
pub unsafe fn eof() -> bool {
    unsafe { native() }
}
pub unsafe fn read(dst: &mut [u8]) -> usize {
    unsafe {
        if native() { return 0; }
        let len = load(0x228) as usize;
        assert!(len <= 8192);
        let n = dst.len().min(len - INPUT);
        dst[..n].copy_from_slice(core::slice::from_raw_parts(
            (CTRL + 0x400 + INPUT) as *const u8,
            n,
        ));
        INPUT += n;
        n
    }
}
pub unsafe fn write(b: &[u8]) {
    unsafe {
        // Diagnostics retain JSON_UTF8 LOG semantics; never mix with native bytes.
        for chunk in b.chunks(256) {
            let mut json = [0u8; 1600];
            let prefix = b"{\"level\":\"debug\",\"msg\":\"";
            json[..prefix.len()].copy_from_slice(prefix);
            let mut at = prefix.len();
            for byte in chunk {
                json[at..at + 4].copy_from_slice(b"\\u00");
                json[at + 4] = b"0123456789abcdef"[(byte >> 4) as usize];
                json[at + 5] = b"0123456789abcdef"[(byte & 15) as usize];
                at += 6;
            }
            json[at..at + 2].copy_from_slice(b"\"}");
            send(4, 1, 0, &json[..at + 2]);
        }
    }
}
pub unsafe fn user_write(b: &[u8]) {
    unsafe { write(b) }
}
pub unsafe fn record(b: &[u8]) {
    unsafe { write(b) }
}
pub unsafe fn print(s: &str) {
    unsafe { write(s.as_bytes()) }
}
pub unsafe fn hex(n: usize) {
    let mut b = [b'0'; 16];
    for i in 0..16 {
        b[15 - i] = b"0123456789abcdef"[(n >> (i * 4)) & 15];
    }
    unsafe { write(&b) }
}

// Ring-only pseudo-fds, intercepted before the unchanged Linux dispatcher.
// 100 checkpoint; 101 repair bytes; 102 finish; 129..160 bounded call ids.
pub unsafe fn syscall(n: usize, a: &[usize; 6]) -> Option<isize> {
    unsafe {
        if native() {
            if n == 24 { // Narrow dup3 profile: regular file -> stdin, no console aliasing.
                return Some(if a[1] == 0 { crate::fs::dup_stdin(a[0], a[2]) } else { -38 });
            }
            return None;
        }
        let (fd, addr, len) = (a[0], a[1], a[2]);
        if n != 63 && n != 64 {
            return None;
        }
        if fd < 100 || (fd > 102 && !(129..=160).contains(&fd)) {
            return None;
        }
        if n == 64 && fd == 100 {
            assert_eq!(CANARY, 0);
            assert_eq!(NEXT, 1);
            assert_eq!(INPUT, 0);
            crate::arch::doorbell(4); // offline CHECKPOINT, after bootstrap
            crate::arch::boot_info();
            assert_eq!(CANARY, 0);
            CANARY = load(8);
            assert!(CANARY != 0);
            store(0x238, CANARY); // trusted repair completed, observed by host
            if load(0x240) != 0 {
                crate::arch::doorbell(5);
            } // offline repaired-READY sample
            return Some(0);
        }
        if fd == 101 && n == 63 {
            if CANARY == 0 || REPAIR_READ {
                return Some(-9);
            }
            if len < 32 {
                return Some(-22);
            }
            let mut b = [0u8; 32];
            b[..8].copy_from_slice(&load(8).to_le_bytes());
            b[8..24].copy_from_slice(&crate::SEED);
            b[24..].copy_from_slice(&load(0x218).to_le_bytes());
            if let Err(e) = crate::syscalls::copyout(addr, &b) {
                return Some(e);
            }
            REPAIR_READ = true;
            // Seed delivery is one-shot. Keep raw entropy off the JS heap and
            // remove its kernel/control copies before tenant source is read.
            core::ptr::write_volatile(&raw mut crate::SEED, [0; 16]);
            for i in 0..16 {
                core::ptr::write_volatile((CTRL + 0x208 + i) as *mut u8, 0);
                core::ptr::write_volatile(b.as_mut_ptr().add(8 + i), 0);
            }
            return Some(32);
        }
        if fd == 102 && n == 64 {
            if len > 16352 {
                return Some(-22);
            }
            let Some(pa) = crate::user::access(addr, len, false) else {
                return Some(-14);
            };
            if PENDING.iter().any(|p| p.state == 1 || p.state == 2) {
                return Some(-16);
            }
            send(5, 1, 0, core::slice::from_raw_parts(pa as *const u8, len));
            crate::arch::doorbell(3);
            loop {
                core::hint::spin_loop()
            }
        }
        if !(129..=160).contains(&fd) {
            return Some(-9);
        }
        let id = fd - 128;
        if n == 64 {
            if len > LIMIT || id != NEXT || PENDING[id - 1].state != 0 {
                return Some(-22);
            }
            let Some(pa) = crate::user::access(addr, len, false) else {
                return Some(-14);
            };
            PENDING[id - 1].state = 1;
            NEXT += 1;
            send(
                1,
                1,
                id as u64,
                core::slice::from_raw_parts(pa as *const u8, len),
            );
            Some(len as isize)
        } else {
            service();
            let p = &mut PENDING[id - 1];
            if p.state != 2 {
                return Some(-11);
            }
            if len < p.len {
                return Some(-22);
            }
            if let Err(e) = crate::syscalls::copyout(addr, &p.bytes[..p.len]) {
                return Some(e);
            }
            p.state = 3;
            Some(if p.kind == 2 { p.len as isize } else { -5 })
        }
    }
}

// R7 native feature bundle: byte streams, native entry, late-bound RO archive.
const NATIVE_FEATURES: u64 = 7;
const OUTPUT_LIMIT: usize = 1024 * 1024;
static mut OUTPUT: [usize; 2] = [0; 2];
static mut OUTPUT_LIMITED: bool = false;
pub unsafe fn native() -> bool {
    unsafe { load(0x20) == NATIVE_FEATURES }
}
pub unsafe fn native_checkpoint() {
    unsafe {
        // Cache maintenance can take stage-2 write faults even for clean code.
        // Do it offline so restore does not CoW the entire 2.3 MiB loader range.
        crate::mmu::protect_aliases();
        crate::mmu::flush();
        for va in (0x400000..0x650000).step_by(64) {
            core::arch::asm!("dc cvau,{a}", a=in(reg) crate::mmu::physical(va));
        }
        core::arch::asm!("dsb ish", "ic iallu", "dsb ish", "isb");
        crate::arch::doorbell(4);
        crate::arch::boot_info();
        assert!(native());
        assert!(load(0x260) <= OUTPUT_LIMIT as u64);
        store(0x238, load(8));
    }
}
pub unsafe fn native_args(args: &mut [&'static str; 32]) -> usize {
    unsafe {
        let count = load(0x248) as usize;
        let len = load(0x228) as usize;
        assert!((1..=32).contains(&count) && len <= 8192);
        let bytes = core::slice::from_raw_parts((CTRL + 0x400) as *const u8, len);
        let mut at = 0;
        for arg in &mut args[..count] {
            let n = bytes[at..].iter().position(|b| *b == 0).unwrap();
            *arg = core::str::from_utf8(&bytes[at..at + n]).unwrap();
            at += n + 1;
        }
        assert_eq!(at, len);
        count
    }
}
pub unsafe fn native_output(fd: usize, addr: usize, len: usize) -> isize {
    unsafe {
        if len == 0 { return 0; }
        if len > 1024 * 1024 { return -22; }
        let Some(pa) = crate::user::access(addr, len, false) else { return -14; };
        let budget = load(0x260) as usize;
        let count = len.min(budget.saturating_sub(OUTPUT[0] + OUTPUT[1]));
        if count < len { OUTPUT_LIMITED = true; }
        if count == 0 && len != 0 { return -27; }
        let stream = fd - 1;
        let bytes = core::slice::from_raw_parts(pa as *const u8, count);
        for chunk in bytes.chunks(16344) {
            // Offset occupies call_id for stream records; payload is pure bytes.
            send(6 + stream as u16, 0, OUTPUT[stream] as u64, chunk);
            OUTPUT[stream] += chunk.len();
        }
        count as isize
    }
}
pub unsafe fn native_finish(status: usize) -> ! {
    unsafe {
        let mut b = [0u8; 24];
        b[..4].copy_from_slice(&((status & 255) as u32).to_le_bytes());
        b[4..8].copy_from_slice(&(OUTPUT_LIMITED as u32).to_le_bytes());
        b[8..16].copy_from_slice(&(OUTPUT[0] as u64).to_le_bytes());
        b[16..24].copy_from_slice(&(OUTPUT[1] as u64).to_le_bytes());
        send(8, 0, 0, &b);
        crate::arch::doorbell(3);
        loop { core::hint::spin_loop(); }
    }
}
