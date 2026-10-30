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
pub const ABI_VERSION: u32 = 12;

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
        /// Control page, as an offset into RAM; TX and RX rings follow it.
        /// Each arena class places its writable arena below it
        /// (`arena::Class::start`).
        pub control_offset: usize,
        pub control_bytes: usize,
        pub ring_bytes: usize,
    }

    impl Layout {
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
        control_offset: 0x1d0_0000,
        control_bytes: 0x4000,
        ring_bytes: 0x8000,
    };

    const _: () = {
        let l = AARCH64;
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
    pub const CONTROL_GPA: u64 = LAYOUT.control_gpa();
    pub const TX_GPA: u64 = LAYOUT.tx_gpa();
    pub const RX_GPA: u64 = LAYOUT.rx_gpa();
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
    pub const RING_VERSION: u16 = 3;
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
    /// Written by the guest kernel: the run's heap high-water in bytes, the
    /// highest end of the mmap window it mapped (above its base) plus the
    /// highest brk break (above the heap base). It only rises within a run
    /// and starts at the prepared snapshot's value. Untrusted; the host
    /// reports it in IPC STATS, at most the class's arena bytes.
    pub const HEAP_PEAK: usize = 0x268;
    /// NUL-separated argv (native profile), at this control offset. The JS
    /// run source is not here: it is the SOURCE message on the RX ring, and
    /// SOURCE_BYTES is its length.
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
    /// Host to guest, id 0: the JS run source (SOURCE_BYTES bytes), the first
    /// message on RX of every JS run.
    pub const SOURCE: u16 = 9;
    /// Guest to host, id 0: one tenant console line, JSON `[level, message]`.
    /// One-way (no reply); at most MAX_LOGS per run.
    pub const CONSOLE: u16 = 10;
    /// `flags` of JSON records (CALL, RET, ERR, LOG, DONE, SOURCE, CONSOLE).
    pub const JSON_UTF8: u16 = 1;
    /// `flags` bit of a JSON record whose message continues in the next
    /// record. A message (CALL, DONE, CONSOLE on TX; SOURCE, RET, ERR on RX)
    /// is one or more consecutive records of one kind and id; every one but
    /// the last carries MORE and exactly MAX_PAYLOAD bytes. A message's
    /// bounds below are on its concatenated payload.
    pub const MORE: u16 = 2;
    /// `cap` of CALL and RET records in the JS profile; native records carry 0.
    pub const CALL_CAP: u32 = 1;

    // --- Ring pseudo-fds of the JS profile (intercepted read/write). ---
    pub const FD_CHECKPOINT: usize = 100;
    pub const FD_REPAIR: usize = 101;
    pub const FD_FINISH: usize = 102;
    /// write: one CONSOLE message.
    pub const FD_CONSOLE: usize = 103;
    /// read: the next RET/ERR record on RX, as REPLY_PREFIX_BYTES (id u32,
    /// kind u16, flags u16, little endian) then its payload; -EAGAIN when
    /// none. The buffer must hold REPLY_PREFIX_BYTES + MAX_PAYLOAD.
    pub const FD_REPLY: usize = 104;
    pub const REPLY_PREFIX_BYTES: usize = 8;
    /// write to `FD_CALL_BASE + i`: the CALL message of call id `i`
    /// (1..=MAX_CALLS, in order).
    pub const FD_CALL_BASE: usize = 128;
    pub const FD_CALL_FIRST: usize = FD_CALL_BASE + 1;
    pub const FD_CALL_LAST: usize = FD_CALL_BASE + MAX_CALLS;

    // --- Guest-visible limits: the console (v1) path's, protocol/dispatcher.ts LIMIT. ---
    /// Tool calls per run (call ids 1..=MAX_CALLS); LIMIT.calls.
    pub const MAX_CALLS: usize = 4096;
    /// Calls sent and not yet answered; LIMIT.outstanding.
    pub const MAX_OUTSTANDING: usize = 64;
    /// CALL payload bytes of the outstanding calls; LIMIT.inflight.
    pub const INFLIGHT_BYTES: usize = 2 * 1024 * 1024;
    /// CALL message bytes; LIMIT.frame.
    pub const CALL_BYTES: usize = 1024 * 1024;
    /// The largest RET/ERR (reply) message of any class. A run's bound is
    /// its class's (`arena::Class::reply_bytes`): replies are trusted host
    /// output, so the bound grows with the heap that has to hold them, while
    /// every guest message keeps the console path's 1 MiB frame.
    pub const MAX_REPLY_BYTES: usize = 4 * 1024 * 1024;
    /// DONE message bytes; LIMIT.frame.
    pub const DONE_BYTES: usize = 1024 * 1024;
    /// SOURCE message bytes: the START source, UTF-8, which binds at most
    /// LIMIT.code (65,536) bytes of tenant code as data behind the adapter
    /// call and at most 64 namespace names (executor/shard-backend.ts).
    pub const SOURCE_LIMIT: usize = 72 * 1024;
    /// CONSOLE messages per run; LIMIT.logs.
    pub const MAX_LOGS: usize = 1024;
    /// CONSOLE message bytes: a LIMIT.log (4,096-byte UTF-8) line escaped to
    /// ASCII (at most 6 bytes per byte) plus the level.
    pub const CONSOLE_BYTES: usize = 32 * 1024;
    /// Native argv storage bytes at SOURCE_OFFSET.
    pub const ARGV_BYTES: usize = 8192;
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
        assert!(SOURCE_OFFSET + ARGV_BYTES <= CONTROL_BYTES);
        assert!(OUTPUT_BYTES < HEAP_PEAK && HEAP_PEAK < SOURCE_OFFSET);
        assert!(MAX_OUTSTANDING <= MAX_CALLS && MAX_CALLS.is_multiple_of(64));
        assert!(INFLIGHT_BYTES >= CALL_BYTES);
        assert!(CONSOLE_BYTES >= 6 * 4096 + 64);
        assert!(RECORD_BYTES <= RING_BYTES);
        // A full record is 8-aligned, so MORE fragments never carry padding.
        assert!(record_len(MAX_PAYLOAD) == RECORD_BYTES);
        assert!(FD_REPLY < FD_CALL_FIRST);
    };

    /// Record bytes for a payload: align8(HEADER_BYTES + payload).
    pub const fn record_len(payload: usize) -> usize {
        (HEADER_BYTES + payload + 7) & !7
    }
    /// Records of a message of `bytes` payload bytes (at least one).
    pub const fn records(bytes: usize) -> usize {
        if bytes == 0 {
            1
        } else {
            bytes.div_ceil(MAX_PAYLOAD)
        }
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
    use super::ring::{CONTROL, MAX_REPLY_BYTES, RAM_GPA, TRANSPORT_BYTES};

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

    /// The lowest arena start: guest RAM below it holds the kernel image and
    /// the packed payload (QuickJS; the linker refuses an image whose packed
    /// payload would overlap its arena).
    pub const IMAGE_BYTES: usize = 0x80_0000;
    /// The guest kernel maps RAM in 2 MiB blocks and an arena in 4 KiB pages
    /// within its own blocks, so an arena starts on a block and ends below
    /// the control page's block.
    pub const BLOCK_BYTES: usize = 0x20_0000;

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub enum Class {
        Glue2m,
        Glue4m,
        Glue8m,
        Glue16m,
    }

    impl Class {
        pub const ALL: [Self; 4] = [Self::Glue2m, Self::Glue4m, Self::Glue8m, Self::Glue16m];
        pub const fn name(self) -> &'static str {
            match self {
                Self::Glue2m => "glue-2m",
                Self::Glue4m => "glue-4m",
                Self::Glue8m => "glue-8m",
                Self::Glue16m => "glue-16m",
            }
        }
        const fn mib(self) -> u64 {
            match self {
                Self::Glue2m => 2,
                Self::Glue4m => 4,
                Self::Glue8m => 8,
                Self::Glue16m => 16,
            }
        }
        /// The memory reservation an admission (IPC START) charges.
        pub const fn admission_bytes(self) -> u32 {
            (self.mib() as u32) << 20
        }
        /// Writable arena bytes: the charge less 0.75 MiB (glue-2m) or
        /// 1.25 MiB (the larger classes), which covers the transport and the
        /// host's per-slot state.
        pub const fn bytes(self) -> usize {
            match self {
                Self::Glue2m => 1_310_720,
                Self::Glue4m => 2_883_584,
                Self::Glue8m => 7_077_888,
                Self::Glue16m => 15_466_496,
            }
        }
        /// Arena start, as an offset into guest RAM: the highest block from
        /// which the arena still ends below the control page's block
        /// (glue-2m and glue-4m keep 0x1800000, their ABI 11 address).
        pub const fn start(self) -> usize {
            match self {
                Self::Glue2m | Self::Glue4m => 0x180_0000,
                Self::Glue8m => 0x140_0000,
                Self::Glue16m => 0xc0_0000,
            }
        }
        /// Arena start, as a guest physical address.
        pub const fn gpa(self) -> u64 {
            RAM_GPA + self.start() as u64
        }
        /// RET/ERR (tool reply) message bytes of a run of this class, so
        /// that the heap and not the frame bounds a reply: the power of two
        /// above the largest reply the class's heap holds (shard/README.md
        /// "Limits": 107 KiB, 545 KiB, 1,227 KiB, 2,759 KiB), at least the
        /// console path's 1 MiB frame. Guest messages stay at 1 MiB.
        pub const fn reply_bytes(self) -> usize {
            match self {
                Self::Glue2m | Self::Glue4m => 1024 * 1024,
                Self::Glue8m => 2 * 1024 * 1024,
                Self::Glue16m => MAX_REPLY_BYTES,
            }
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
                self.gpa(),
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
        let mut largest = 0;
        while i < Class::ALL.len() {
            let c = Class::ALL[i];
            assert!(c.bytes().is_multiple_of(4096));
            assert!(c.bytes() > CANARY_BYTES + STACK_BYTES + DATA_BYTES + BRK_BYTES);
            assert!(c.start() >= IMAGE_BYTES && c.start().is_multiple_of(BLOCK_BYTES));
            assert!(c.end() <= CONTROL / BLOCK_BYTES * BLOCK_BYTES);
            assert!(c.reply_bytes() >= 1024 * 1024 && c.reply_bytes() <= MAX_REPLY_BYTES);
            assert!((c.admission_bytes() as usize) > c.bytes() + TRANSPORT_BYTES);
            if c.reply_bytes() > largest {
                largest = c.reply_bytes();
            }
            i += 1;
        }
        assert!(largest == MAX_REPLY_BYTES);
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
    // length u32, flags u32, reserved u32 = 0.
    pub const KIND_AT: usize = 0;
    pub const SLOT_AT: usize = 4;
    pub const GENERATION_AT: usize = 8;
    pub const ID_AT: usize = 16;
    pub const LENGTH_AT: usize = 20;
    pub const FLAGS_AT: usize = 24;
    pub const RESERVED_AT: usize = 28;
    /// `flags`: the message continues in the next record. A message is one or
    /// more consecutive records of one direction with the same kind, slot,
    /// generation and id; every one but the last carries MORE and exactly
    /// PAYLOAD bytes. The per-kind bounds below are on the whole message.
    pub const MORE: u32 = 1;

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
    /// One tenant console line (the guest's CONSOLE message), id 0. No reply.
    pub const LOG: u32 = 25;

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
    /// STATS payload: owner CPU ns, stopped ns, reset-done ns, the run's
    /// heap high-water bytes (ring::HEAP_PEAK, at most the class's arena
    /// bytes; 0 when no run was bound), the round-trip count, then at most
    /// STATS_ROUND_TRIPS u64.
    pub const STATS_FIXED_BYTES: usize = 40;
    /// STATS offsets of the heap high-water and the round-trip count.
    pub const STATS_HEAP_PEAK_AT: usize = 24;
    pub const STATS_COUNT_AT: usize = 32;
    pub const STATS_ROUND_TRIPS: usize = super::ring::MAX_CALLS;
    /// The largest shard -> Node message payload (CALL, DONE, LOG, STATS,
    /// ERROR): what Node reassembles. These carry guest bytes, so they keep
    /// the console path's frame whatever the class.
    pub const MESSAGE_BYTES: usize = super::ring::CALL_BYTES;
    /// The largest Node -> shard message payload (START, REPLY, CANCEL): what
    /// the shard (and the HVF zygote's children) reassemble. Trusted; a
    /// REPLY is further bounded by the run's class (`Class::reply_bytes`).
    pub const NODE_MESSAGE_BYTES: usize = super::ring::MAX_REPLY_BYTES;
    /// Records a message of `bytes` payload bytes takes (at least one).
    pub const fn records(bytes: usize) -> usize {
        if bytes == 0 {
            1
        } else {
            bytes.div_ceil(PAYLOAD)
        }
    }
    /// Messages one generation may send: one per call and per log, STATS,
    /// DONE/ERROR, RELEASED or QUARANTINED.
    pub const MESSAGES_PER_GENERATION: usize = super::ring::MAX_CALLS + super::ring::MAX_LOGS + 3;
    /// Messages of one generation not yet delivered to Node: Node answers
    /// only delivered calls, so at most MAX_OUTSTANDING calls, plus every log,
    /// STATS, DONE/ERROR and RELEASED/QUARANTINED.
    pub const QUEUED_PER_GENERATION: usize =
        super::ring::MAX_OUTSTANDING + super::ring::MAX_LOGS + 3;
    /// The shard's outbound message queue bound: every slot's generation plus READY.
    pub const OUTBOUND: usize = MAX_SLOTS * QUEUED_PER_GENERATION + 1;
    /// Records Node may send one slot in one generation: START, a reply to
    /// each outstanding call, CANCEL.
    pub const NODE_RECORDS_PER_GENERATION: usize =
        records(START_HEADER_BYTES + super::ring::SOURCE_LIMIT)
            + super::ring::MAX_OUTSTANDING * records(super::ring::MAX_REPLY_BYTES)
            + 1;
    /// Node's unflushed record bound (every slot's generation), and the HVF
    /// zygote's per-child queue bound (one slot's).
    pub const NODE_OUTBOUND: usize = MAX_SLOTS * NODE_RECORDS_PER_GENERATION;

    const _: () = {
        use super::ring;
        assert!(ring::DONE_BYTES <= MESSAGE_BYTES && ring::MAX_REPLY_BYTES <= NODE_MESSAGE_BYTES);
        assert!(MESSAGE_BYTES <= NODE_MESSAGE_BYTES);
        assert!(START_HEADER_BYTES + ring::SOURCE_LIMIT <= NODE_MESSAGE_BYTES);
        assert!(ring::CONSOLE_BYTES <= MESSAGE_BYTES);
        assert!(STATS_FIXED_BYTES + 8 * STATS_ROUND_TRIPS <= MESSAGE_BYTES);
        // A guest record's payload always fits one IPC record.
        assert!(ring::MAX_PAYLOAD <= PAYLOAD);
        assert!(MAX_SLOTS as u64 <= CAPACITY);
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
        assert_eq!(arena::Class::Glue2m.gpa(), 0x8180_0000);
        assert_eq!(ring::TRANSPORT_BYTES, 81920);
        assert_eq!(ring::FD_CALL_LAST, 4224);
        assert_eq!(ring::JS_VERSION, 0x3_324b_544a);
        assert_eq!(ipc::BYTES, 2_105_344);
        assert_eq!(ipc::DATA + ipc::REGION, 1_054_720);
        assert_eq!(ipc::OUTBOUND, 69_825);
        assert_eq!(ipc::NODE_RECORDS_PER_GENERATION, 5 + 64 * 256 + 1);
    }

    #[test]
    fn message_fragments() {
        assert_eq!(ring::records(0), 1);
        assert_eq!(ring::records(ring::MAX_PAYLOAD), 1);
        assert_eq!(ring::records(ring::MAX_PAYLOAD + 1), 2);
        assert_eq!(ring::records(ring::CALL_BYTES), 65);
        assert_eq!(ipc::records(ipc::PAYLOAD), 1);
        assert_eq!(ipc::records(arena::Class::Glue2m.reply_bytes()), 64);
        assert_eq!(ipc::records(ring::MAX_REPLY_BYTES), 256);
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
        assert_eq!(
            arena::Class::Glue8m.layout()[2..6],
            [8, 0x8140_0000, 7_077_888, 81920]
        );
        assert_eq!(
            arena::Class::Glue16m.layout()[2..6],
            [16, 0x80c0_0000, 15_466_496, 81920]
        );
        assert_eq!(arena::Class::Glue2m.admission_bytes(), 2 << 20);
        for c in arena::Class::ALL {
            assert_eq!(arena::Class::from_layout(&c.layout_bytes()), Some(c));
        }
    }

    #[test]
    fn reply_bounds_grow_with_the_class_only() {
        use arena::Class;
        assert_eq!(Class::Glue2m.reply_bytes(), 1 << 20);
        assert_eq!(Class::Glue4m.reply_bytes(), 1 << 20);
        assert_eq!(Class::Glue8m.reply_bytes(), 2 << 20);
        assert_eq!(Class::Glue16m.reply_bytes(), 4 << 20);
        // Guest messages keep the console path's frame on every class.
        assert_eq!(ipc::MESSAGE_BYTES, 1 << 20);
        assert_eq!(ring::CALL_BYTES, 1 << 20);
        assert_eq!(ring::DONE_BYTES, 1 << 20);
    }
}
