//! The ring transport (shard/ABI-R7.md, ring version 3); never linked into default.
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
const _: () = assert!(MAX_ARGS == 32 && JSON_UTF8 == 1 && ARCHIVE_LIMIT == 4 * 1024 * 1024);
// Calls sent whose final reply record the guest has not read yet: one bit per
// call id (bit i-1 is id i). The guest never buffers a reply: RET/ERR records
// stay in the RX ring until read(FD_REPLY) copies them to user memory.
static mut WAITING: [u64; MAX_CALLS / 64] = [0; MAX_CALLS / 64];
static mut OUTSTANDING: usize = 0;
static mut NEXT: usize = 1;
static mut LOGS: usize = 0;
// SOURCE bytes read so far, and bytes of the RX head record already read.
static mut INPUT: usize = 0;
static mut HEAD_AT: usize = 0;
static mut CANARY: u64 = 0;
static mut REPAIR_READ: bool = false;
// The highest mapped ends of the mmap window and of the brk heap, above
// their bases; HEAP_PEAK is their sum. Restored with the arena each run, so
// a run starts from the prepared snapshot's high-water.
static mut MMAP_HIGH: usize = 0;
static mut BRK_HIGH: usize = 0;

/// User pages `start..end` were just mapped: raise HEAP_PEAK when they
/// extend the mmap window's or the brk heap's high-water.
///
/// # Safety
/// Called by `user::pages` (this is `crate::console` in ring builds) in the sole masked-IRQ EL1 context, which owns
/// these counters and the guest-owned HEAP_PEAK control field.
pub unsafe fn heap_mapped(start: usize, end: usize) {
    let end = (end + 4095) & !4095;
    // SAFETY: the caller's masked-IRQ context exclusively owns both counters
    // (read and written by value, no reference escapes) and the field.
    unsafe {
        if (crate::user::MMAP..crate::mmu::mmap_limit()).contains(&start) {
            MMAP_HIGH = MMAP_HIGH.max(end - crate::user::MMAP);
        } else if (crate::user::HEAP..crate::mmu::heap_limit()).contains(&start) {
            BRK_HIGH = BRK_HIGH.max(end - crate::user::HEAP);
        } else {
            return;
        }
        store(HEAP_PEAK, (MMAP_HIGH + BRK_HIGH) as u64);
    }
}

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
        let len = record_len(payload.len());
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
        let mut h = RecordHeader {
            len: len as u32,
            kind,
            flags,
            generation: load(GENERATION),
            id,
            n: payload.len() as u32,
            cap: if kind == CALL { CALL_CAP } else { 0 },
        }
        .encode();
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
/// One JSON message as consecutive records: full MORE fragments, then the rest.
/// # Safety
/// As `send`; payload stays readable until the last fragment is copied.
unsafe fn send_message(kind: u16, id: u64, payload: &[u8]) {
    // SAFETY: as send's; each fragment is copied before the next one is taken.
    unsafe {
        let last = payload.len().saturating_sub(1) / MAX_PAYLOAD;
        for (i, chunk) in payload.chunks(MAX_PAYLOAD).enumerate() {
            let more = if i < last { MORE } else { 0 };
            send(kind, JSON_UTF8 | more, id, chunk);
        }
        if payload.is_empty() {
            send(kind, JSON_UTF8, id, &[]);
        }
    }
}
/// The unread RX head record, checked against its framing and this run: its
/// header and its cursor.
/// # Safety
/// The sole masked-IRQ vCPU owns RX consumption; acquire observes host publication.
unsafe fn head() -> Option<(RecordHeader, usize)> {
    // SAFETY: The sole masked-IRQ vCPU owns RX consumption; header bytes are copied out of
    // the ring before any check, and the bounds below precede every payload copy.
    unsafe {
        let prod = load(RX_PRODUCER) as usize;
        let cons = load(RX_CONSUMER) as usize;
        assert!(prod >= cons && prod - cons <= SIZE && prod.is_multiple_of(8));
        if cons == prod {
            return None;
        }
        assert!(prod - cons >= HEADER_BYTES);
        let mut b = [0u8; HEADER_BYTES];
        copy_ring(RX, cons, &mut b, false);
        let h = RecordHeader::decode(&b);
        assert!(h.framed(prod - cons) && h.flags & !MORE == JSON_UTF8);
        assert!(h.generation == load(GENERATION));
        // A MORE fragment is full, so it has no padding to check.
        assert!(h.flags & MORE == 0 || h.n as usize == MAX_PAYLOAD);
        let mut padding = [0u8; 7];
        let n = h.n as usize;
        copy_ring(
            RX,
            cons + HEADER_BYTES + n,
            &mut padding[..h.len as usize - HEADER_BYTES - n],
            false,
        );
        assert!(padding.iter().all(|b| *b == 0));
        Some((h, cons))
    }
}
/// # Safety
/// Only the masked-IRQ context calls it, after copying the head record's payload.
unsafe fn pop(h: &RecordHeader, cons: usize) {
    // SAFETY: release returns the consumed head record's bytes to the host.
    unsafe {
        HEAD_AT = 0;
        store(RX_CONSUMER, (cons + h.len as usize) as u64);
    }
}
/// RX records stay in the ring until the guest reads them (`read`,
/// `FD_REPLY`), so there is nothing to move here.
pub unsafe fn service() {}
/// # Safety
/// Only this masked-IRQ context reads RX/input state; no state mutation or doorbell.
pub unsafe fn available() -> bool {
    // SAFETY: Only this masked-IRQ context reads RX/input state.
    unsafe { !native() && (INPUT < load(SOURCE_BYTES) as usize || head().is_some()) }
}
/// # Safety
/// The mapped feature word is aligned and host-published; native mode is immutable for this run.
pub unsafe fn eof() -> bool {
    // SAFETY: The mapped feature word is aligned and host-published; native mode is
    // immutable for this run.
    unsafe { native() }
}
/// fd 0 of the JS profile: the SOURCE message, then end of file. Blocks (WAIT)
/// while the host has not yet put its next record on RX.
pub unsafe fn read(dst: &mut [u8]) -> usize {
    // SAFETY: The sole masked-IRQ vCPU owns RX consumption and INPUT/HEAD_AT; dst is
    // disjoint from transport memory and each copy is bounded by the checked head record.
    unsafe {
        if native() {
            return 0;
        }
        let total = load(SOURCE_BYTES) as usize;
        assert!(total <= SOURCE_LIMIT);
        loop {
            if INPUT == total || dst.is_empty() {
                return 0;
            }
            let Some((h, cons)) = head() else {
                crate::wait::park_for(u64::MAX, true);
                continue;
            };
            let n = h.n as usize;
            let last = h.flags & MORE == 0;
            assert!(h.kind == SOURCE && h.id == 0 && h.cap == 0);
            assert!(HEAD_AT < n && INPUT - HEAD_AT + n <= total);
            assert_eq!(last, INPUT - HEAD_AT + n == total);
            let k = dst.len().min(n - HEAD_AT);
            copy_ring(RX, cons + HEADER_BYTES + HEAD_AT, &mut dst[..k], false);
            INPUT += k;
            HEAD_AT += k;
            if HEAD_AT == n {
                pop(&h, cons);
            }
            return k;
        }
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
/// Whether call `id` (1..=MAX_CALLS) still waits for its final reply record.
/// # Safety
/// The masked-IRQ context owns WAITING.
unsafe fn waiting(id: usize) -> bool {
    // SAFETY: The masked-IRQ context owns WAITING; id is checked first.
    unsafe { (1..=MAX_CALLS).contains(&id) && WAITING[(id - 1) / 64] & (1 << ((id - 1) % 64)) != 0 }
}
/// # Safety
/// The masked-IRQ context owns WAITING; id is in 1..=MAX_CALLS.
unsafe fn set_waiting(id: usize, on: bool) {
    // SAFETY: The masked-IRQ context owns WAITING; the caller checked id.
    unsafe {
        let bit = 1u64 << ((id - 1) % 64);
        if on {
            WAITING[(id - 1) / 64] |= bit;
        } else {
            WAITING[(id - 1) / 64] &= !bit;
        }
    }
}

// Ring-only pseudo-fds, intercepted before the unchanged Linux dispatcher:
// 100 checkpoint; 101 repair bytes; 102 finish; 103 console; 104 replies;
// 129..=4224 call ids.
/// # Safety
/// Entered only from the sole masked-IRQ EL1 trap with PAN cleared. User ranges are checked
/// before access; run state is exclusive and no ring borrow crosses a doorbell.
pub unsafe fn syscall(n: usize, a: &[usize; 6]) -> Option<isize> {
    // SAFETY: Entered only from the sole masked-IRQ EL1 trap with PAN cleared. User ranges
    // are checked before access; run state is exclusive and no ring borrow crosses a
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
        if !(FD_CHECKPOINT..=FD_REPLY).contains(&fd)
            && !(FD_CALL_FIRST..=FD_CALL_LAST).contains(&fd)
        {
            return None;
        }
        if n == nr::WRITE && fd == FD_CHECKPOINT {
            // Only the bootstrap checkpoints, once, before any call or input.
            // After restore tenant code can reach this fd too: refuse, never panic.
            if CANARY != 0 || NEXT != 1 || INPUT != 0 {
                return Some(-9);
            }
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
            if OUTSTANDING != 0 {
                return Some(-16);
            }
            // Published again with the completion, whatever the host did to it.
            store(HEAP_PEAK, (MMAP_HIGH + BRK_HIGH) as u64);
            send_message(DONE, 0, core::slice::from_raw_parts(pa as *const u8, len));
            crate::arch::doorbell(FINISH);
            loop {
                core::hint::spin_loop()
            }
        }
        if fd == FD_CONSOLE && n == nr::WRITE {
            if len > CONSOLE_BYTES {
                return Some(-22);
            }
            if LOGS >= MAX_LOGS {
                return Some(-28);
            }
            let Some(pa) = crate::user::access(addr, len, false) else {
                return Some(-14);
            };
            LOGS += 1;
            send_message(
                CONSOLE,
                0,
                core::slice::from_raw_parts(pa as *const u8, len),
            );
            return Some(len as isize);
        }
        if fd == FD_REPLY && n == nr::READ {
            let Some((h, cons)) = head() else {
                return Some(-11);
            };
            let (id, k) = (h.id as usize, h.n as usize);
            assert!((h.kind == RET || h.kind == ERR) && h.cap == CALL_CAP && waiting(id));
            assert_eq!({ HEAD_AT }, 0);
            if len < REPLY_PREFIX_BYTES + k {
                return Some(-22);
            }
            let Some(pa) = crate::user::access(addr, REPLY_PREFIX_BYTES + k, true) else {
                return Some(-14);
            };
            let dst = core::slice::from_raw_parts_mut(pa as *mut u8, REPLY_PREFIX_BYTES + k);
            dst[..4].copy_from_slice(&(id as u32).to_le_bytes());
            dst[4..6].copy_from_slice(&h.kind.to_le_bytes());
            dst[6..8].copy_from_slice(&h.flags.to_le_bytes());
            copy_ring(
                RX,
                cons + HEADER_BYTES,
                &mut dst[REPLY_PREFIX_BYTES..],
                false,
            );
            pop(&h, cons);
            if h.flags & MORE == 0 {
                set_waiting(id, false);
                OUTSTANDING -= 1;
            }
            return Some((REPLY_PREFIX_BYTES + k) as isize);
        }
        if !(FD_CALL_FIRST..=FD_CALL_LAST).contains(&fd) || n != nr::WRITE {
            return Some(-9);
        }
        let id = fd - FD_CALL_BASE;
        if len > CALL_BYTES || id != NEXT || OUTSTANDING >= MAX_OUTSTANDING {
            return Some(-22);
        }
        let Some(pa) = crate::user::access(addr, len, false) else {
            return Some(-14);
        };
        set_waiting(id, true);
        OUTSTANDING += 1;
        NEXT += 1;
        send_message(
            CALL,
            id as u64,
            core::slice::from_raw_parts(pa as *const u8, len),
        );
        Some(len as isize)
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
        assert!((1..=32).contains(&count) && len <= ARGV_BYTES);
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
