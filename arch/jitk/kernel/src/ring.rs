//! Experimental v2 subset. See shard/ABI-R6.md; never linked into default.
use crate::abi::ring::*;
use crate::syscalls::nr;
use core::sync::atomic::{
    AtomicU64,
    Ordering::{Acquire, Release},
};
pub const CTRL: usize = CONTROL_GPA as usize;
const TX: usize = TX_GPA as usize;
const RX: usize = RX_GPA as usize;
const SIZE: usize = RING_BYTES;
const LIMIT: usize = REPLY_BYTES;
// assert! conditions keep their source text: the length of each stringified
// condition is in the image, and an unchanged image is the refactor oracle
// (ARCH.md). The literals they still spell are tied to the ABI here.
// (fs.rs spells the archive bound.)
const _: () = assert!(
    MAX_CALLS == 32 && MAX_ARGS == 32 && JSON_UTF8 == 1 && ARCHIVE_LIMIT == 4 * 1024 * 1024
);
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum PendingState {
    Free,
    Waiting,
    Ready,
    Consumed,
}
#[derive(Clone, Copy)]
struct Pending {
    state: PendingState,
    kind: u16,
    len: usize,
    bytes: [u8; LIMIT],
}
static mut PENDING: [Pending; MAX_CALLS] = [Pending {
    state: PendingState::Free,
    kind: 0,
    len: 0,
    bytes: [0; LIMIT],
}; MAX_CALLS];
static mut NEXT: usize = 1;
static mut INPUT: usize = 0;
static mut CANARY: u64 = 0;
static mut REPAIR_READ: bool = false;

/// # Safety
/// off selects an aligned u64 within the mapped control page; the host accesses the same field
/// atomically under the ring publication protocol.
pub unsafe fn load(off: usize) -> u64 {
    // SAFETY: off selects an aligned u64 within the mapped control page; the host accesses
    // the same field atomically under the ring publication protocol.
    unsafe { (&*((CTRL + off) as *const AtomicU64)).load(Acquire) }
}
pub unsafe fn store(off: usize, v: u64) {
    // SAFETY: off selects an aligned, guest-owned u64 in mapped control memory. Release
    // publication follows payload writes and the host uses acquire reads.
    unsafe { (&*((CTRL + off) as *const AtomicU64)).store(v, Release) }
}
/// # Safety
/// base is TX_GPA or RX_GPA in mapped transport memory. Cursor arithmetic stays in the ring;
/// the protocol grants the guest this payload span until publication/consumption.
unsafe fn copy_ring(base: usize, cursor: usize, b: &mut [u8], write: bool) {
    for (i, x) in b.iter_mut().enumerate() {
        let p = (base + (cursor + i) % SIZE) as *mut u8;
        // SAFETY: base is TX_GPA or RX_GPA in mapped transport memory. Cursor arithmetic
        // stays in the ring; the protocol grants the guest this payload span until
        // publication/consumption.
        unsafe {
            if write {
                p.write(*x);
            } else {
                *x = p.read();
            }
        }
    }
}
/// # Safety
/// The host has published immutable run seed/clock fields while this vCPU is stopped. The sole
/// masked-IRQ vCPU exclusively updates kernel seed/epoch state.
pub unsafe fn boot_info() {
    // SAFETY: The host has published immutable run seed/clock fields while this vCPU is
    // stopped. The sole masked-IRQ vCPU exclusively updates kernel seed/epoch state.
    unsafe {
        core::ptr::copy_nonoverlapping(
            (CTRL + SEED) as *const u8,
            (&raw mut crate::SEED).cast::<u8>(),
            16,
        );
        crate::EPOCH_OFFSET = load(EPOCH_NS).saturating_sub(load(MONOTONIC_NS));
    }
}
/// # Safety
/// Called once at EL1 with the control page mapped and the stopped host having published the
/// ABI header.
pub unsafe fn init(_: usize) {
    // SAFETY: Called once at EL1 with the control page mapped and the stopped host having
    // published the ABI header.
    unsafe {
        assert_eq!((CTRL as *const u32).read(), MAGIC);
        assert_eq!(((CTRL + 4) as *const u16).read(), RING_VERSION);
    }
}
/// # Safety
/// The sole masked-IRQ vCPU owns TX. Producer/consumer bounds are checked before writes; host
/// consumption follows release publication, and no local ring reference spans a doorbell.
unsafe fn send(kind: u16, flags: u16, id: u64, payload: &[u8]) {
    // SAFETY: The sole masked-IRQ vCPU owns TX. Producer/consumer bounds are checked before
    // writes; host consumption follows release publication, and no local ring reference
    // spans a doorbell.
    unsafe {
        let len = (HEADER_BYTES + payload.len() + 7) & !7;
        assert!(len <= RECORD_BYTES);
        let mut prod = load(TX_PRODUCER) as usize;
        loop {
            let cons = load(TX_CONSUMER) as usize;
            assert!(prod >= cons && prod - cons <= SIZE);
            if len <= SIZE - (prod - cons) {
                break;
            }
            crate::arch::doorbell(SUBMIT);
            prod = load(TX_PRODUCER) as usize;
        }
        let mut h = [0u8; HEADER_BYTES];
        h[..4].copy_from_slice(&(len as u32).to_le_bytes());
        h[4..6].copy_from_slice(&kind.to_le_bytes());
        h[6..8].copy_from_slice(&flags.to_le_bytes());
        h[8..16].copy_from_slice(&load(GENERATION).to_le_bytes());
        h[16..24].copy_from_slice(&id.to_le_bytes());
        h[24..28].copy_from_slice(&(payload.len() as u32).to_le_bytes());
        if kind == CALL {
            h[28..].copy_from_slice(&CALL_CAP.to_le_bytes());
        }
        copy_ring(TX, prod, &mut h, true);
        // No allocator or unbounded stack copy. The user range was checked.
        for (i, b) in payload.iter().enumerate() {
            ((TX + (prod + HEADER_BYTES + i) % SIZE) as *mut u8).write(*b);
        }
        for i in HEADER_BYTES + payload.len()..len {
            ((TX + (prod + i) % SIZE) as *mut u8).write(0);
        }
        store(TX_PRODUCER, prod.checked_add(len).unwrap() as u64);
    }
}
/// # Safety
/// The sole masked-IRQ vCPU owns pending/RX state. Acquire observes host publication; checked
/// header/payload/padding bounds precede copies, and release returns consumed bytes.
pub unsafe fn service() {
    // SAFETY: The sole masked-IRQ vCPU owns pending/RX state. Acquire observes host
    // publication; checked header/payload/padding bounds precede copies, and release returns
    // consumed bytes.
    unsafe {
        let prod = load(RX_PRODUCER) as usize;
        let mut cons = load(RX_CONSUMER) as usize;
        assert!(prod >= cons && prod - cons <= SIZE && prod.is_multiple_of(8));
        while cons < prod {
            assert!(prod - cons >= HEADER_BYTES);
            let mut h = [0u8; HEADER_BYTES];
            copy_ring(RX, cons, &mut h, false);
            let len = u32::from_le_bytes(h[..4].try_into().unwrap()) as usize;
            let kind = u16::from_le_bytes(h[4..6].try_into().unwrap());
            let flags = u16::from_le_bytes(h[6..8].try_into().unwrap());
            let genid = u64::from_le_bytes(h[8..16].try_into().unwrap());
            let id = u64::from_le_bytes(h[16..24].try_into().unwrap()) as usize;
            let n = u32::from_le_bytes(h[24..28].try_into().unwrap()) as usize;
            assert!(
                (HEADER_BYTES..=RECORD_BYTES).contains(&len)
                    && len.is_multiple_of(8)
                    && len <= prod - cons
            );
            assert!(n <= LIMIT && len == (HEADER_BYTES + n + 7) & !7 && flags == 1);
            assert!(
                genid == load(GENERATION) && (1..=32).contains(&id) && (kind == RET || kind == ERR)
            );
            assert_eq!(u32::from_le_bytes(h[28..].try_into().unwrap()), CALL_CAP);
            let p = &mut PENDING[id - 1];
            assert_eq!(p.state, PendingState::Waiting);
            copy_ring(RX, cons + HEADER_BYTES, &mut p.bytes[..n], false);
            let mut padding = [0u8; 7];
            copy_ring(
                RX,
                cons + HEADER_BYTES + n,
                &mut padding[..len - HEADER_BYTES - n],
                false,
            );
            assert!(padding.iter().all(|b| *b == 0));
            p.len = n;
            p.kind = kind;
            p.state = PendingState::Ready;
            cons += len;
        }
        store(RX_CONSUMER, cons as u64);
    }
}
/// # Safety
/// Only this masked-IRQ context reads pending/input state; iteration ends before any state
/// mutation or doorbell.
pub unsafe fn available() -> bool {
    // SAFETY: Only this masked-IRQ context reads pending/input state; iteration ends before
    // any state mutation or doorbell.
    unsafe {
        !native()
            && (INPUT < load(SOURCE_BYTES) as usize
                || (&*core::ptr::addr_of!(PENDING))
                    .iter()
                    .any(|p| p.state == PendingState::Ready))
    }
}
/// # Safety
/// The mapped feature word is aligned and host-published; native mode is immutable for this run.
pub unsafe fn eof() -> bool {
    // SAFETY: The mapped feature word is aligned and host-published; native mode is
    // immutable for this run.
    unsafe { native() }
}
pub unsafe fn read(dst: &mut [u8]) -> usize {
    // SAFETY: The host-published source bytes stay immutable until stopped reset. INPUT is
    // owned by this masked-IRQ context and dst is disjoint from control memory.
    unsafe {
        if native() {
            return 0;
        }
        let len = load(SOURCE_BYTES) as usize;
        assert!(len <= SOURCE_LIMIT);
        let n = dst.len().min(len - INPUT);
        dst[..n].copy_from_slice(core::slice::from_raw_parts(
            (CTRL + SOURCE_OFFSET + INPUT) as *const u8,
            n,
        ));
        INPUT += n;
        n
    }
}
/// # Safety
/// The sole masked-IRQ vCPU owns TX. The bounded stack encoder is live through send; send
/// copies bytes before release publication.
pub unsafe fn write(b: &[u8]) {
    // SAFETY: The sole masked-IRQ vCPU owns TX. The bounded stack encoder is live through
    // send; send copies bytes before release publication.
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
            send(LOG, JSON_UTF8, 0, &json[..at + 2]);
        }
    }
}
/// # Safety
/// The caller owns TX in the sole masked-IRQ context and b remains readable until write copies
/// it into the ring.
pub unsafe fn user_write(b: &[u8]) {
    // SAFETY: The caller owns TX in the sole masked-IRQ context and b remains readable until
    // write copies it into the ring.
    unsafe { write(b) }
}
pub unsafe fn record(b: &[u8]) {
    // SAFETY: The caller owns TX in the sole masked-IRQ context and b remains readable until
    // write copies it into the ring.
    unsafe { write(b) }
}
/// # Safety
/// The caller owns TX in the sole masked-IRQ context and s remains readable until write copies
/// it into the ring.
pub unsafe fn print(s: &str) {
    // SAFETY: The caller owns TX in the sole masked-IRQ context and s remains readable until
    // write copies it into the ring.
    unsafe { write(s.as_bytes()) }
}
pub unsafe fn hex(n: usize) {
    let mut b = [b'0'; 16];
    for i in 0..16 {
        b[15 - i] = b"0123456789abcdef"[(n >> (i * 4)) & 15];
    }
    // SAFETY: The masked-IRQ context owns TX and the local buffer remains live until write
    // has copied it.
    unsafe { write(&b) }
}

// Ring-only pseudo-fds, intercepted before the unchanged Linux dispatcher.
// 100 checkpoint; 101 repair bytes; 102 finish; 129..160 bounded call ids.
/// # Safety
/// Entered only from the sole masked-IRQ EL1 trap with PAN cleared. User ranges are checked
/// before access; run state is exclusive and no pending borrow crosses a doorbell.
pub unsafe fn syscall(n: usize, a: &[usize; 6]) -> Option<isize> {
    // SAFETY: Entered only from the sole masked-IRQ EL1 trap with PAN cleared. User ranges
    // are checked before access; run state is exclusive and no pending borrow crosses a
    // doorbell.
    unsafe {
        if native() {
            if n == nr::DUP3 {
                // Narrow dup3 profile: regular file -> stdin, no console aliasing.
                return Some(if a[1] == 0 {
                    crate::fs::dup_stdin(a[0], a[2])
                } else {
                    -38
                });
            }
            return None;
        }
        let (fd, addr, len) = (a[0], a[1], a[2]);
        if n != nr::READ && n != nr::WRITE {
            return None;
        }
        if !(FD_CHECKPOINT..=FD_FINISH).contains(&fd)
            && !(FD_CALL_FIRST..=FD_CALL_LAST).contains(&fd)
        {
            return None;
        }
        if n == nr::WRITE && fd == FD_CHECKPOINT {
            assert_eq!({ CANARY }, 0);
            assert_eq!({ NEXT }, 1);
            assert_eq!({ INPUT }, 0);
            crate::arch::doorbell(CHECKPOINT); // offline CHECKPOINT, after bootstrap
            // A reset VM resumes here: drop guest TLB entries and instructions
            // cached before the host restored memory (hvf-spike/REPORT.md risk 3;
            // KVM's copy reset keeps the physical pages, so without CTR_EL0.DIC
            // the previous job's code could still run from the I-cache).
            crate::mmu::flush();
            crate::arch::invalidate_icache();
            boot_info();
            assert_eq!({ CANARY }, 0);
            CANARY = load(GENERATION);
            assert!(CANARY != 0);
            store(REPAIRED_GENERATION, CANARY); // trusted repair completed, observed by host
            if load(SAMPLE_READY) != 0 {
                crate::arch::doorbell(REPAIRED_READY);
            } // offline repaired-READY sample
            return Some(0);
        }
        if fd == FD_REPAIR && n == nr::READ {
            if CANARY == 0 || REPAIR_READ {
                return Some(-9);
            }
            if len < REPAIR_BYTES {
                return Some(-22);
            }
            let mut b = [0u8; REPAIR_BYTES];
            b[..8].copy_from_slice(&load(GENERATION).to_le_bytes());
            b[8..24].copy_from_slice(&{ crate::SEED });
            b[24..].copy_from_slice(&load(EPOCH_NS).to_le_bytes());
            if let Err(e) = crate::syscalls::copyout(addr, &b) {
                return Some(e);
            }
            REPAIR_READ = true;
            // Seed delivery is one-shot. Keep raw entropy off the JS heap and
            // remove its kernel/control copies before tenant source is read.
            core::ptr::write_volatile(&raw mut crate::SEED, [0; 16]);
            for i in 0..16 {
                core::ptr::write_volatile((CTRL + SEED + i) as *mut u8, 0);
                core::ptr::write_volatile(b.as_mut_ptr().add(8 + i), 0);
            }
            return Some(REPAIR_BYTES as isize);
        }
        if fd == FD_FINISH && n == nr::WRITE {
            if len > DONE_BYTES {
                return Some(-22);
            }
            let Some(pa) = crate::user::access(addr, len, false) else {
                return Some(-14);
            };
            if (&*core::ptr::addr_of!(PENDING))
                .iter()
                .any(|p| p.state == PendingState::Waiting || p.state == PendingState::Ready)
            {
                return Some(-16);
            }
            send(
                DONE,
                JSON_UTF8,
                0,
                core::slice::from_raw_parts(pa as *const u8, len),
            );
            crate::arch::doorbell(FINISH);
            loop {
                core::hint::spin_loop()
            }
        }
        if !(FD_CALL_FIRST..=FD_CALL_LAST).contains(&fd) {
            return Some(-9);
        }
        let id = fd - FD_CALL_BASE;
        if n == nr::WRITE {
            if len > CALL_BYTES || id != NEXT || PENDING[id - 1].state != PendingState::Free {
                return Some(-22);
            }
            let Some(pa) = crate::user::access(addr, len, false) else {
                return Some(-14);
            };
            PENDING[id - 1].state = PendingState::Waiting;
            NEXT += 1;
            send(
                CALL,
                JSON_UTF8,
                id as u64,
                core::slice::from_raw_parts(pa as *const u8, len),
            );
            Some(len as isize)
        } else {
            service();
            let p = &mut PENDING[id - 1];
            if p.state != PendingState::Ready {
                return Some(-11);
            }
            if len < p.len {
                return Some(-22);
            }
            if let Err(e) = crate::syscalls::copyout(addr, &p.bytes[..p.len]) {
                return Some(e);
            }
            p.state = PendingState::Consumed;
            Some(if p.kind == RET { p.len as isize } else { -5 })
        }
    }
}

// R7 native feature bundle: byte streams, native entry, late-bound RO archive.
static mut OUTPUT: [usize; 2] = [0; 2];
static mut OUTPUT_LIMITED: bool = false;
/// # Safety
/// The aligned feature control word is mapped and host-published; its value remains fixed for
/// the run.
pub unsafe fn native() -> bool {
    // SAFETY: The aligned feature control word is mapped and host-published; its value
    // remains fixed for the run.
    unsafe { load(FEATURES) == NATIVE_FEATURES }
}
pub unsafe fn native_checkpoint() {
    // SAFETY: Called once before native EL0 entry. This vCPU owns MMU/repair state; no
    // transport borrow survives the stopped-host checkpoint/boot-info refresh.
    unsafe {
        // Cache maintenance can take stage-2 write faults even for clean code.
        // Do it offline so restore does not CoW the entire 2.3 MiB loader range.
        crate::mmu::protect_aliases();
        crate::mmu::flush();
        crate::arch::sync_icache(0x400000, 0x650000);
        crate::arch::doorbell(CHECKPOINT);
        // A reset VM resumes here; see the glue CHECKPOINT above.
        crate::mmu::flush();
        crate::arch::invalidate_icache();
        boot_info();
        assert!(native());
        assert!(load(OUTPUT_BYTES) <= OUTPUT_LIMIT as u64);
        store(REPAIRED_GENERATION, load(GENERATION));
    }
}
/// # Safety
/// The host-published source block stays immutable for the run. Returned string references are
/// discarded by stopped snapshot reset before the host may replace those bytes.
pub unsafe fn native_args(args: &mut [&'static str; MAX_ARGS]) -> usize {
    // SAFETY: The host-published source block stays immutable for the run. Returned string
    // references are discarded by stopped snapshot reset before the host may replace those
    // bytes.
    unsafe {
        let count = load(ARGC) as usize;
        let len = load(SOURCE_BYTES) as usize;
        assert!((1..=32).contains(&count) && len <= SOURCE_LIMIT);
        let bytes = core::slice::from_raw_parts((CTRL + SOURCE_OFFSET) as *const u8, len);
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
/// # Safety
/// fd is stdout or stderr; this masked-IRQ trap owns OUTPUT/TX. User pages are checked, EL0 is
/// stopped, and send copies bytes before publication.
pub unsafe fn native_output(fd: usize, addr: usize, len: usize) -> isize {
    // SAFETY: fd is stdout or stderr; this masked-IRQ trap owns OUTPUT/TX. User pages are
    // checked, EL0 is stopped, and send copies bytes before publication.
    unsafe {
        if len == 0 {
            return 0;
        }
        if len > OUTPUT_LIMIT {
            return -22;
        }
        let Some(pa) = crate::user::access(addr, len, false) else {
            return -14;
        };
        let budget = load(OUTPUT_BYTES) as usize;
        let count = len.min(budget.saturating_sub(OUTPUT[0] + OUTPUT[1]));
        if count < len {
            OUTPUT_LIMITED = true;
        }
        if count == 0 && len != 0 {
            return -27;
        }
        let stream = fd - 1;
        let bytes = core::slice::from_raw_parts(pa as *const u8, count);
        for chunk in bytes.chunks(16344) {
            // Offset occupies call_id for stream records; payload is pure bytes.
            send(STDOUT + stream as u16, 0, OUTPUT[stream] as u64, chunk);
            OUTPUT[stream] += chunk.len();
        }
        count as isize
    }
}
/// # Safety
/// This masked-IRQ trap exclusively owns output totals/TX; native exit is copied and published
/// before the terminal FINISH doorbell.
pub unsafe fn native_finish(status: usize) -> ! {
    // SAFETY: This masked-IRQ trap exclusively owns output totals/TX; native exit is copied
    // and published before the terminal FINISH doorbell.
    unsafe {
        let mut b = [0u8; 24];
        b[..4].copy_from_slice(&((status & 255) as u32).to_le_bytes());
        b[4..8].copy_from_slice(&(OUTPUT_LIMITED as u32).to_le_bytes());
        b[8..16].copy_from_slice(&(OUTPUT[0] as u64).to_le_bytes());
        b[16..24].copy_from_slice(&(OUTPUT[1] as u64).to_le_bytes());
        send(NATIVE_EXIT, 0, 0, &b);
        crate::arch::doorbell(FINISH);
        loop {
            core::hint::spin_loop();
        }
    }
}
