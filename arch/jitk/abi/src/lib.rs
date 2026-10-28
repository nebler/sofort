//! The jitk guest-ring and host-IPC ABI: the one definition of every value two
//! components must agree on. The kernel (`no_std`, guest) and the shard (host
//! engine) depend on this crate; `src/bin/abi-gen.rs` emits the TypeScript,
//! C-header and guest-bootstrap copies from it (`make -C abi gen`, checked by
//! `make -C abi test`). Specs: `shard/ABI-R7.md` (ring) and
//! `executor/ipc/ABI.md` (IPC).
//!
//! Guest physical layout is per architecture ([`layout`]); [`ring`] is the
//! flat view of the one supported architecture (aarch64) that both sides use.
//! The kernel addresses guest memory by GPA, the shard by offset into guest
//! RAM; both are derived here from one [`layout::Layout`].
//!
//! The shard and abi-gen use this as a Cargo dependency. The ring kernel
//! mounts this file as `mod abi` (`#[path]`, kernel/src/main.rs), because a
//! Cargo dependency changes the kernel crate's metadata hash and so its image
//! bytes. Keep the file self-contained: no dependencies, no `crate::` paths.
#![no_std]

/// Version of everything below that a peer observes: the ring layout and
/// records, the IPC geometry and messages, the limits and the prepared
/// snapshot format. The shard sends it in READY and the prepared snapshot
/// `.identity` records it; Node and the shard refuse a mismatch. Bump it with
/// any change to a value in this crate.
pub const ABI_VERSION: u32 = 10;

pub mod layout {
    //! Guest physical memory layout, per architecture.

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub enum Arch {
        Aarch64,
    }

    /// Guest RAM is one contiguous extent at `ram_gpa`. Everything the host
    /// maps for the ring transport lies inside it, at a fixed offset; the
    /// read-only archive and the doorbell page lie outside it.
    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub struct Layout {
        pub arch: Arch,
        pub ram_gpa: u64,
        pub ram_bytes: usize,
        /// MMIO doorbell page (outside RAM).
        pub doorbell_gpa: u64,
        /// Late-bound read-only archive extent (outside RAM; native profile).
        pub archive_gpa: u64,
        /// Writable arena, as an offset into RAM.
        pub arena_offset: usize,
        /// Control page, as an offset into RAM; TX and RX rings follow it.
        pub control_offset: usize,
        pub control_bytes: usize,
        pub ring_bytes: usize,
    }

    impl Layout {
        pub const fn arena_gpa(&self) -> u64 {
            self.ram_gpa + self.arena_offset as u64
        }
        pub const fn control_gpa(&self) -> u64 {
            self.ram_gpa + self.control_offset as u64
        }
        /// Guest-to-host ring, offset into RAM.
        pub const fn tx_offset(&self) -> usize {
            self.control_offset + self.control_bytes
        }
        /// Host-to-guest ring, offset into RAM.
        pub const fn rx_offset(&self) -> usize {
            self.tx_offset() + self.ring_bytes
        }
        pub const fn tx_gpa(&self) -> u64 {
            self.ram_gpa + self.tx_offset() as u64
        }
        pub const fn rx_gpa(&self) -> u64 {
            self.ram_gpa + self.rx_offset() as u64
        }
        /// Control page plus both rings: the second writable extent.
        pub const fn transport_bytes(&self) -> usize {
            self.control_bytes + 2 * self.ring_bytes
        }
    }

    pub const AARCH64: Layout = Layout {
        arch: Arch::Aarch64,
        ram_gpa: 0x8000_0000,
        ram_bytes: 32 << 20,
        doorbell_gpa: 0x1000_0000,
        archive_gpa: 0x8200_0000,
        arena_offset: 0x180_0000,
        control_offset: 0x1d0_0000,
        control_bytes: 0x4000,
        ring_bytes: 0x8000,
    };

    const _: () = {
        let l = AARCH64;
        assert!(l.arena_offset < l.control_offset);
        assert!(l.control_offset + l.transport_bytes() <= l.ram_bytes);
        assert!(l.archive_gpa >= l.ram_gpa + l.ram_bytes as u64);
        assert!(l.doorbell_gpa + 0x1000 <= l.ram_gpa);
    };
}

pub mod ring {
    //! The guest ring ABI (`shard/ABI-R7.md`) on the supported architecture:
    //! layout, control-page fields, records, doorbells, pseudo-fds and limits.
    use super::layout::{AARCH64, Layout};

    pub const LAYOUT: Layout = AARCH64;

    // --- Layout, as GPAs (kernel) and as RAM offsets (shard). ---
    pub const RAM_GPA: u64 = LAYOUT.ram_gpa;
    pub const RAM_BYTES: usize = LAYOUT.ram_bytes;
    pub const DOORBELL_GPA: u64 = LAYOUT.doorbell_gpa;
    pub const ARCHIVE_GPA: u64 = LAYOUT.archive_gpa;
    pub const ARENA_GPA: u64 = LAYOUT.arena_gpa();
    pub const CONTROL_GPA: u64 = LAYOUT.control_gpa();
    pub const TX_GPA: u64 = LAYOUT.tx_gpa();
    pub const RX_GPA: u64 = LAYOUT.rx_gpa();
    pub const ARENA_OFFSET: usize = LAYOUT.arena_offset;
    pub const CONTROL: usize = LAYOUT.control_offset;
    pub const TX: usize = LAYOUT.tx_offset();
    pub const RX: usize = LAYOUT.rx_offset();
    pub const CONTROL_BYTES: usize = LAYOUT.control_bytes;
    pub const RING_BYTES: usize = LAYOUT.ring_bytes;
    pub const TRANSPORT_BYTES: usize = LAYOUT.transport_bytes();

    // --- Control page header (offset 0). ---
    /// `JTK2` at control offset 0 (u32).
    pub const MAGIC: u32 = 0x324b544a;
    /// Ring ABI major version, u16 at control offset 4.
    pub const RING_VERSION: u16 = 2;
    /// The first control word of a JS run.
    pub const JS_VERSION: u64 = MAGIC as u64 | (RING_VERSION as u64) << 32;
    /// The first control word of a native run (R7 feature flag at bit 48).
    pub const NATIVE_VERSION: u64 = JS_VERSION | (1 << 48);
    /// FEATURES value selecting the R7 native bundle (streams, entry, archive).
    pub const NATIVE_FEATURES: u64 = 7;

    // --- Control page fields: offsets from the control page, aligned u64s. ---
    pub const GENERATION: usize = 0x8;
    pub const RING_LIMITS: usize = 0x10;
    pub const CALL_LIMITS: usize = 0x18;
    pub const FEATURES: usize = 0x20;
    pub const TX_PRODUCER: usize = 0x40;
    pub const TX_CONSUMER: usize = 0x80;
    pub const RX_PRODUCER: usize = 0xc0;
    pub const RX_CONSUMER: usize = 0x100;
    pub const WAIT_EPOCH: usize = 0x140;
    pub const WAIT_MASK: usize = 0x148;
    pub const HOST_EPOCH: usize = 0x180;
    pub const REPLY_READY: usize = 0x188;
    pub const SEED: usize = 0x208;
    pub const EPOCH_NS: usize = 0x218;
    pub const MONOTONIC_NS: usize = 0x220;
    pub const SOURCE_BYTES: usize = 0x228;
    pub const DEADLINE: usize = 0x230;
    pub const REPAIRED_GENERATION: usize = 0x238;
    pub const SAMPLE_READY: usize = 0x240;
    pub const ARGC: usize = 0x248;
    pub const ARCHIVE_BYTES: usize = 0x250;
    pub const OUTPUT_BYTES: usize = 0x260;
    /// Run source (JS) or NUL-separated argv (native), at this control offset.
    pub const SOURCE_OFFSET: usize = 0x400;

    // --- Doorbell operations (u32 written to the doorbell page). ---
    pub const SUBMIT: u32 = 1;
    pub const WAIT: u32 = 2;
    pub const FINISH: u32 = 3;
    pub const CHECKPOINT: u32 = 4;
    pub const REPAIRED_READY: u32 = 5;

    // --- Records. ---
    pub const HEADER_BYTES: usize = 32;
    pub const RECORD_BYTES: usize = 16384;
    pub const MAX_PAYLOAD: usize = RECORD_BYTES - HEADER_BYTES;
    pub const CALL: u16 = 1;
    pub const RET: u16 = 2;
    pub const ERR: u16 = 3;
    pub const LOG: u16 = 4;
    pub const DONE: u16 = 5;
    pub const STDOUT: u16 = 6;
    pub const STDERR: u16 = 7;
    pub const NATIVE_EXIT: u16 = 8;
    /// `flags` of JSON records (CALL, RET, ERR, LOG, DONE).
    pub const JSON_UTF8: u16 = 1;
    /// `cap` of CALL and RET records in the JS profile; native records carry 0.
    pub const CALL_CAP: u32 = 1;

    // --- Ring pseudo-fds of the JS profile (intercepted read/write). ---
    pub const FD_CHECKPOINT: usize = 100;
    pub const FD_REPAIR: usize = 101;
    pub const FD_FINISH: usize = 102;
    /// Call id `i` (1..=MAX_CALLS) is fd `FD_CALL_BASE + i`.
    pub const FD_CALL_BASE: usize = 128;
    pub const FD_CALL_FIRST: usize = FD_CALL_BASE + 1;
    pub const FD_CALL_LAST: usize = FD_CALL_BASE + MAX_CALLS;

    // --- Guest-visible limits. ---
    /// Tool calls per run (call ids 1..=MAX_CALLS).
    pub const MAX_CALLS: usize = 32;
    /// CALL payload bytes.
    pub const CALL_BYTES: usize = 1024;
    /// RET/ERR (reply) payload bytes.
    pub const REPLY_BYTES: usize = 1024;
    /// DONE payload bytes.
    pub const DONE_BYTES: usize = MAX_PAYLOAD;
    /// Run source (JS) or argv storage (native) bytes.
    pub const SOURCE_LIMIT: usize = 8192;
    /// Native argv entries.
    pub const MAX_ARGS: usize = 32;
    /// Aggregate native stdout+stderr capture cap.
    pub const OUTPUT_LIMIT: usize = 1024 * 1024;
    /// LOG payload bytes per run (kernel diagnostics; tenant code has no LOG
    /// path). More fails that run: the shard's stderr is bounded for its
    /// whole lifetime, so a compromised kernel must not flood it.
    pub const LOG_BYTES: usize = 16384;
    /// Read-only archive bytes at ARCHIVE_GPA (native profile; `ARCHIVE_BYTES`).
    pub const ARCHIVE_LIMIT: usize = 4 * 1024 * 1024;
    /// Bytes the kernel returns from `read(FD_REPAIR)`: generation u64,
    /// 16 entropy bytes, epoch ns u64.
    pub const REPAIR_BYTES: usize = 32;
    /// The QuickJS checkpoint receipt: repair record with the public receipt
    /// in place of the entropy, plus a 16-byte libc receipt.
    pub const CHECKPOINT_RECEIPT_BYTES: usize = 48;

    const _: () = {
        assert!(SOURCE_OFFSET + SOURCE_LIMIT <= CONTROL_BYTES);
        assert!(OUTPUT_BYTES < SOURCE_OFFSET);
        assert!(MAX_CALLS <= 32); // the shard tracks calls in a u32 bitmap
        assert!(CALL_BYTES <= MAX_PAYLOAD && REPLY_BYTES <= MAX_PAYLOAD);
        assert!(RECORD_BYTES <= RING_BYTES);
        assert!(FD_FINISH < FD_CALL_FIRST);
    };

    /// Record bytes for a payload: align8(HEADER_BYTES + payload).
    pub const fn record_len(payload: usize) -> usize {
        (HEADER_BYTES + payload + 7) & !7
    }

    /// The 32-byte little-endian record header: len u32 @0, kind u16 @4,
    /// flags u16 @6, generation u64 @8, id u64 @16 (stream offset for
    /// STDOUT/STDERR), payload bytes u32 @24, cap u32 @28.
    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub struct RecordHeader {
        pub len: u32,
        pub kind: u16,
        pub flags: u16,
        pub generation: u64,
        pub id: u64,
        pub n: u32,
        pub cap: u32,
    }

    impl RecordHeader {
        /// Decodes the fields only; callers check them against their bounds.
        pub fn decode(h: &[u8; HEADER_BYTES]) -> Self {
            let u32_at = |at: usize| u32::from_le_bytes([h[at], h[at + 1], h[at + 2], h[at + 3]]);
            let u64_at = |at: usize| {
                let mut b = [0; 8];
                b.copy_from_slice(&h[at..at + 8]);
                u64::from_le_bytes(b)
            };
            Self {
                len: u32_at(0),
                kind: u16::from_le_bytes([h[4], h[5]]),
                flags: u16::from_le_bytes([h[6], h[7]]),
                generation: u64_at(8),
                id: u64_at(16),
                n: u32_at(24),
                cap: u32_at(28),
            }
        }
        pub fn encode(&self) -> [u8; HEADER_BYTES] {
            let mut h = [0; HEADER_BYTES];
            h[..4].copy_from_slice(&self.len.to_le_bytes());
            h[4..6].copy_from_slice(&self.kind.to_le_bytes());
            h[6..8].copy_from_slice(&self.flags.to_le_bytes());
            h[8..16].copy_from_slice(&self.generation.to_le_bytes());
            h[16..24].copy_from_slice(&self.id.to_le_bytes());
            h[24..28].copy_from_slice(&self.n.to_le_bytes());
            h[28..].copy_from_slice(&self.cap.to_le_bytes());
            h
        }
        /// The framing every record must satisfy, given `available` produced
        /// and unconsumed bytes: 8-aligned length in HEADER_BYTES..=RECORD_BYTES,
        /// within `available`, equal to `record_len(n)`.
        pub fn framed(&self, available: usize) -> bool {
            let (len, n) = (self.len as usize, self.n as usize);
            (HEADER_BYTES..=RECORD_BYTES).contains(&len)
                && len.is_multiple_of(8)
                && len <= available
                && n <= MAX_PAYLOAD
                && len == record_len(n)
        }
    }
}

pub mod arena {
    //! Arena classes and the layout record the kernel links into `.rodata`
    //! and the offline preparer copies to the snapshot `.layout` sidecar.
    use super::ring::{ARENA_GPA, ARENA_OFFSET, TRANSPORT_BYTES};

    /// `JTKARENA`.
    pub const LAYOUT_MAGIC: u64 = 0x414e4552414b544a;
    pub const LAYOUT_VERSION: u64 = 2;
    pub const LAYOUT_WORDS: usize = 9;
    pub const LAYOUT_BYTES: usize = 8 * LAYOUT_WORDS;
    /// Arena carve-out, from its end: one canary page, then the stack.
    pub const CANARY_BYTES: usize = 4096;
    pub const STACK_BYTES: usize = 0x20000;
    pub const DATA_BYTES: usize = 0x10000;
    pub const BRK_BYTES: usize = 0x10000;

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub enum Class {
        Glue2m,
        Glue4m,
    }

    impl Class {
        pub const ALL: [Self; 2] = [Self::Glue2m, Self::Glue4m];
        pub const fn name(self) -> &'static str {
            match self {
                Self::Glue2m => "glue-2m",
                Self::Glue4m => "glue-4m",
            }
        }
        const fn mib(self) -> u64 {
            match self {
                Self::Glue2m => 2,
                Self::Glue4m => 4,
            }
        }
        /// The memory reservation an admission (IPC START) charges.
        pub const fn admission_bytes(self) -> u32 {
            (self.mib() as u32) << 20
        }
        /// Writable arena bytes.
        pub const fn bytes(self) -> usize {
            match self {
                Self::Glue2m => 1_310_720,
                Self::Glue4m => 2_883_584,
            }
        }
        /// Arena start, as an offset into guest RAM.
        pub const fn start(self) -> usize {
            ARENA_OFFSET
        }
        pub const fn end(self) -> usize {
            self.start() + self.bytes()
        }
        pub const fn canary(self) -> usize {
            self.end() - CANARY_BYTES
        }
        pub const fn layout(self) -> [u64; LAYOUT_WORDS] {
            [
                LAYOUT_MAGIC,
                LAYOUT_VERSION,
                self.mib(),
                ARENA_GPA,
                self.bytes() as u64,
                TRANSPORT_BYTES as u64,
                DATA_BYTES as u64,
                BRK_BYTES as u64,
                STACK_BYTES as u64,
            ]
        }
        pub fn layout_bytes(self) -> [u8; LAYOUT_BYTES] {
            let mut b = [0; LAYOUT_BYTES];
            for (chunk, word) in b.chunks_exact_mut(8).zip(self.layout()) {
                chunk.copy_from_slice(&word.to_le_bytes());
            }
            b
        }
        pub fn from_layout(bytes: &[u8]) -> Option<Self> {
            Self::ALL.into_iter().find(|c| c.layout_bytes() == bytes)
        }
        /// Stable memslots over guest RAM (`ram` bytes, control page at
        /// offset `ctrl`): immutable extents alternate with the two writable
        /// extents, the arena and the transport.
        pub fn regions(self, ram: usize, ctrl: usize) -> [(usize, usize, bool); 5] {
            let end = self.end();
            assert!(end < ctrl && ctrl + TRANSPORT_BYTES < ram);
            [
                (0, self.start(), false),
                (self.start(), end, true),
                (end, ctrl, false),
                (ctrl, ctrl + TRANSPORT_BYTES, true),
                (ctrl + TRANSPORT_BYTES, ram, false),
            ]
        }
    }

    const _: () = {
        let mut i = 0;
        while i < Class::ALL.len() {
            let c = Class::ALL[i];
            assert!(c.bytes().is_multiple_of(4096));
            assert!(c.bytes() > CANARY_BYTES + STACK_BYTES + DATA_BYTES + BRK_BYTES);
            assert!(c.end() < super::ring::CONTROL);
            i += 1;
        }
    };
}

pub mod ipc {
    //! Node <-> shard shared-memory IPC (`executor/ipc/ABI.md`). RX and TX are
    //! named from the shard's side: RX is the Node -> shard queue.

    /// Slots per direction.
    pub const CAPACITY: u64 = 64;
    pub const PAYLOAD: usize = 16384;
    pub const HEADER_BYTES: usize = 32;
    pub const RECORD: usize = HEADER_BYTES + PAYLOAD;
    pub const REGION: usize = CAPACITY as usize * RECORD;
    /// Control bytes before the Node -> shard region.
    pub const DATA: usize = 4096;
    /// Exact sealed memfd size.
    pub const BYTES: usize = DATA + 2 * REGION;
    /// Atomic u64 record cursors in the control bytes.
    pub const RX_PRODUCER: usize = 64;
    pub const RX_CONSUMER: usize = 128;
    pub const TX_PRODUCER: usize = 192;
    pub const TX_CONSUMER: usize = 256;

    // Header: kind u32, slot u32, generation u64, identity u32, payload
    // length u32, reserved u64 = 0.
    pub const KIND_AT: usize = 0;
    pub const SLOT_AT: usize = 4;
    pub const GENERATION_AT: usize = 8;
    pub const ID_AT: usize = 16;
    pub const LENGTH_AT: usize = 20;
    pub const RESERVED_AT: usize = 24;

    // Node -> shard.
    pub const START: u32 = 1;
    pub const REPLY: u32 = 2;
    pub const CANCEL: u32 = 3;
    // Shard -> Node.
    pub const CALL: u32 = 16;
    pub const DONE: u32 = 17;
    pub const ERROR: u32 = 18;
    pub const RELEASED: u32 = 19;
    /// Payload: ABI_VERSION as u32 LE (READY_BYTES bytes).
    pub const READY: u32 = 20;
    pub const PING: u32 = 21;
    pub const STATS: u32 = 22;
    /// In place of RELEASED: the reset failed and the slot is out of service
    /// for the shard's lifetime (never admits again). Payload: the reason,
    /// at most ERROR_BYTES printable ASCII bytes.
    pub const QUARANTINED: u32 = 23;
    /// A quarantined slot serves again: the engine replaced what failed
    /// (HVF: re-forked its engine process from the pristine snapshot).
    /// Generation: the one QUARANTINED ended; no payload. Node counts the slot
    /// as capacity again and admits its next generation.
    pub const RESTORED: u32 = 24;

    pub const READY_BYTES: usize = 4;
    /// Physical sandbox slots per shard.
    pub const MAX_SLOTS: usize = 64;
    /// START payload: deadline ns u64 @0, call cap u32 @8, call bytes u32 @12,
    /// source bytes u32 @16, memory reservation u32 @20, source @24.
    pub const START_HEADER_BYTES: usize = 24;
    /// The latest admitted START deadline, from now.
    pub const DEADLINE_HORIZON_NS: u64 = 60_000_000_000;
    /// ERROR payload bytes.
    pub const ERROR_BYTES: usize = 512;
    /// STATS payload: four u64 then at most STATS_ROUND_TRIPS u64.
    pub const STATS_FIXED_BYTES: usize = 32;
    pub const STATS_ROUND_TRIPS: usize = super::ring::MAX_CALLS;
    /// Records one generation may send: one per call, STATS, DONE/ERROR,
    /// RELEASED or QUARANTINED.
    pub const RECORDS_PER_GENERATION: usize = super::ring::MAX_CALLS + 3;
    /// Outbound queue bound: every slot's generation plus READY.
    pub const OUTBOUND: usize = MAX_SLOTS * RECORDS_PER_GENERATION + 1;

    const _: () = {
        assert!(super::ring::DONE_BYTES <= PAYLOAD);
        assert!(MAX_SLOTS as u64 <= CAPACITY);
        assert!(START_HEADER_BYTES + super::ring::SOURCE_LIMIT <= PAYLOAD);
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use ring::RecordHeader;

    #[test]
    fn published_values_are_unchanged() {
        // The wire values of shard/ABI-R7.md and executor/ipc/ABI.md.
        assert_eq!(ring::CONTROL_GPA, 0x81d0_0000);
        assert_eq!(ring::TX_GPA, 0x81d0_4000);
        assert_eq!(ring::RX_GPA, 0x81d0_c000);
        assert_eq!(ring::RX, ring::CONTROL + 0xc000);
        assert_eq!(ring::ARENA_GPA, 0x8180_0000);
        assert_eq!(ring::TRANSPORT_BYTES, 81920);
        assert_eq!(ring::JS_VERSION, 0x2_324b_544a);
        assert_eq!(ring::FD_CALL_LAST, 160);
        assert_eq!(ipc::BYTES, 2_105_344);
        assert_eq!(ipc::DATA + ipc::REGION, 1_054_720);
        assert_eq!(ipc::OUTBOUND, 2241);
    }

    #[test]
    fn record_header_round_trips() {
        let h = RecordHeader {
            len: 48,
            kind: ring::CALL,
            flags: ring::JSON_UTF8,
            generation: 0x0102_0304_0506_0708,
            id: 3,
            n: 9,
            cap: ring::CALL_CAP,
        };
        let b = h.encode();
        assert_eq!(&b[..8], &[48, 0, 0, 0, 1, 0, 1, 0]);
        assert_eq!(RecordHeader::decode(&b), h);
        assert!(h.framed(48));
        assert!(!h.framed(40));
        assert!(!RecordHeader { len: 56, ..h }.framed(64));
        assert!(!RecordHeader { len: 20, n: 0, ..h }.framed(64));
    }

    #[test]
    fn layout_record_matches_the_kernel_record() {
        let b = arena::Class::Glue2m.layout_bytes();
        assert_eq!(&b[..8], b"JTKARENA");
        assert_eq!(arena::Class::from_layout(&b), Some(arena::Class::Glue2m));
        assert_eq!(
            arena::Class::Glue4m.layout()[3..6],
            [0x8180_0000, 2_883_584, 81920]
        );
        assert_eq!(arena::Class::Glue2m.admission_bytes(), 2 << 20);
    }
}
