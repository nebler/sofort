# R6 real-guest transport: bounded ABI-v2 subset

R7 native/byte/file support is specified in [ABI-R7.md](ABI-R7.md); native binds
use minor 1 and negotiated feature bundle 7. The QuickJS profile remains below.

R7 entropy amendment: the control layout is unchanged; the ring-only payload and
run-entry repair now follow items 1 and 9 below. R6 measurements remain historical.

`kernel --features transport-ring` and shard binary `real` are a separate pair.
The original `jitk-shard` binary still runs fixture ABI v0. Neither format is
interchangeable. The default kernel's virtio path is unchanged.

## Implemented wire contract

ABI-v2 magic `JTK2`, major 2/minor 0; aligned little-endian byte cursors at
`0x40 / 0x80 / 0xc0 / 0x100`, release publication/acquire consumption; exact
32-byte headers; maximum 16,384-byte records; zero padding; two-span-equivalent
ring wrap (the implementation copies bytes modulo 32,768); generation and call
IDs; direction/kind, cap slot, flags, cursor/length bounds and duplicate checks.
Host copies payload once to owner-private memory, validates that copy, and
synthesizes echo from that same copy. No guest pointers cross this interface.

The 16 KiB control, 32 KiB TX and 32 KiB RX extents are contiguous at GPAs
`0x81d00000`, `0x81d04000`, `0x81d0c000`. This relocates the proposal's fixture
addresses, which collide with the real kernel. Exactly 81,920 bytes are reserved
inside the existing 32 MiB RAM memslot. They are demand-paged; this experiment
**does not eagerly dirty all 80 KiB per slot**. Small runs touch only their used
pages. Kernel reply staging is additional memory, included in the measured
CoW delta, rather than hidden inside the 80 KiB transport allocation.

The unmapped GPA `0x10000000` accepts aligned u32 stores:

- 1 SUBMIT drains the batch, publishes immediate synthetic replies, and resumes.
- 2 WAIT implicitly submits. Pending MMIO stays pending while parked and completes
  in the ordinary resume KVM_RUN. The single owner also publishes all completions,
  so there is no concurrent producer between checking and parking.
- 3 FINISH stops before QuickJS teardown. Before reset, the owner completes MMIO
  with immediate_exit=1 / EINTR. This is one completion-only ioctl per finished
  run, included in the next reset; it is not a guest-generated VM exit.
- 4 CHECKPOINT is offline only. It completes its MMIO before snapshot capture.
- 5 REPAIRED_READY is an offline memory-observation stop, requested by a host flag.
  It occurs after trusted EL1 repair and before returning to QuickJS. Normal runs
  do not emit it. Its pending store is drained on teardown.

No GIC, virtio, IRQ delivery, guest timer programming, WFI, or HVC is linked on
this path. Boot assembly, stage-1 tables, user entry, trap-frame access, boot data,
doorbell and host-clock access live under `kernel/src/arch/aarch64/`. Untouched
legacy implementations remain in place for the shipping build. This is a cheap
port boundary, not a completed architecture-neutral kernel or an x86 port.

## Explicit restrictions and deviations

1. The runtime is **Bellard QuickJS 2026-06-04 with a native checkpoint/reseed
   hook**, statically linked to patched musl 1.2.5 as `payload/qjs-ring`,
   packed with the normal ELF packer. A separate prepared bootstrap uses its
   standard `os.read`/`os.write` API, with ring-only pseudo-fds intercepted in EL1:
   fd100 CHECKPOINT; fd101 one-shot 32 native repair bytes; fd102 FINISH; fd129..160 CALL/RET for
   IDs 1..32. fd0 carries source and readiness. These are an experimental bridge,
   not Linux fds or the future `/cap/<slot>/call` interface.
2. A run has at most 32 total calls, one capability slot (`cap_slot=1`), and
   **1,024 bytes of encoded argument-array/result JSON per call**. Synthetic echo
   returns the complete argument array. It has no external effects, credentials,
   provider integration, Node IPC, or policy validation. **Gate 6 is out of scope.**
   There is no general namespace/grant binding or production JSON validator here.
3. EL1 has 32 fixed 1,024-byte reply destinations plus small metadata. A service
   pass routes all records by `(generation, call_id)`, including replies arriving
   before the ID a caller reads. This is a real kernel demultiplexer. It uses
   bounded kernel staging, then checked copyout on read, rather than pre-posted,
   pinned EL0 destinations. Reservation is 32 KiB, below the proposed 64 KiB cap.
   There is no per-call Vec or 32×64 KiB allocation. RET_ERR becomes an I/O error
   in this bootstrap; the complete proposed error-schema behavior is unimplemented.
4. JSON_UTF8 records currently contain an ASCII-escaped JSON subset. Source is
   at most 8,192 ASCII bytes in late-bound control storage at offset `0x400`.
   The stock JS bridge still constructs a string from bytes; no claim is made
   that a native zero-copy UTF-8 embedder or the codemode typed-array codec exists.
5. FINISH is at most 16,352 payload bytes. No fragments, blobs, large tool replies,
   binary typed-array wire compatibility, live-byte broker credit, cancellation
   protocol, or effect reconciliation. The 64 KiB benchmark parses and serializes
   **local structured JSON**, then returns its length; it is not a 64 KiB tool reply.
6. Queueing flushes at first blocking poll, FINISH, or TX credit pressure. There
   is no cooperative interrupt hook to bound a CPU job's deferred submissions.
   Promise.all(10) uses actual QuickJS promises and ten records in one WAIT batch;
   synthetic completions are ready together and published in reverse ID order.
   Independently delayed provider completions are not measured.
7. LOG records currently carry raw developer diagnostic bytes, rather than the
   proposed `{level,msg}` schema. They are diagnostics only, never success.
   Host assertions reject malformed frames by aborting the research shard; this
   is not production containment or error recovery for hostile guests.
8. Control repair extension (offsets relative to control): seed[16] `0x208`,
   Unix epoch ns `0x218`, monotonic ns `0x220`, source length u64 `0x228`, wait
   deadline u64 `0x230`, repaired generation u64 `0x238`, repaired-READY flag u64
   `0x240`, source bytes `0x400`. Generation is the ordinary v2 field at `0x8`.
   No pointers or credentials are stored. Host entropy comes from `/dev/urandom`.
   R7 consumes seed[16] once and erases it from EL1/control after successful
   copyout to the native hook; fd101 then returns EBADF, including to tenant code.
9. Trusted repair updates kernel seed, generation and `epoch_offset=epoch−mono`
   before EL0 resumes. Host refreshes monotonic time at each KVM entry; guest time
   is frozen during uninterrupted CPU work. There is no timer/deadline scheduler.
   R7's native `os.snapshotCheckpoint()` spans fd100 and fd101, derives private
   repair keys with ChaCha20 block 0 (128-bit host seed repeated as a 256-bit key,
   zero nonce), and overwrites the existing context's xorshift state. Saved native
   Math.random function references therefore use the repaired state too. Zero
   xorshift state maps to 1. It replaces AT_RANDOM, global/thread stack canaries,
   mallocng's secret and every existing metadata-area check, and seeds rand,
   random and the global rand48 family. Repair precedes JS return/source read.
   Every native frame across guard rotation is built without stack protection;
   the runtime is single-threaded. This mechanism is specific to pinned musl 1.2.5.
   The hook checks actual guards/allocator metadata, clears its seed buffers, then
   returns a 48-byte ArrayBuffer: generation[8], public entropy receipt[16] from
   block 1, epoch[8], and fingerprint[16] of actual AT_RANDOM from block 2 keyed
   by AT_RANDOM itself. Neither output discloses the seed or private repair keys.
   Math.random and libc PRNGs remain non-cryptographic; no cryptographic random
   API, timer/deadline scheduler, ASLR, or other platform repair is added.
10. There is one fixed owner thread in the real-guest experiment, also acting as
    the immediate echo reactor. A WAIT releases the vCPU; parked slots retain no
    threads. The earlier v0 binary still exercises four owners. Node notification
    IPC, multi-owner real-guest scheduling and watchdog generation leases are not
    implemented. External supervisor kill can contain a runaway process, but is
    not evidence of a functioning production deadline/lease mechanism.
11. All 32 MiB RAM remains stage-2 writable. The class-sized writable arena and
    read-only extents from architecture §2.3 are not implemented. Observed memory
    is not an adversarial upper bound, peak admission reservation, or proof that
    arbitrary 64 KiB data fits a hard 2 MiB class.

## Snapshot and reset

Offline boot enters the normal static ELF at EL0, initializes QuickJS, evaluates
the prepared helper definitions and installs the event-loop read handler.
CHECKPOINT is inside the bootstrap's top-level evaluation, before its run-entry
suffix; it is not a native embedder callback after JS_Eval has returned. The
bootstrap was compiled before the checkpoint, and its preparation prefix is not
reparsed or reexecuted per restore.
The explicit fd100 checkpoint is before reading repair/run input or constructing
any tenant AsyncFunction. CHECKPOINT's MMIO is completed, then all RAM and all
257 registers returned by KVM_GET_REG_LIST (including system, core and SIMD/FP
state, variable register widths) are captured. Files use create_new and mode
0444; runtime opens them read-only. They are never overwritten by a restore.
This is a local-machine snapshot format, without cross-host compatibility,
cryptographic signing, cache-key validation, or production immutable-store hardening.

Each slot maps the same `.mem` file MAP_PRIVATE, MADV_NOHUGEPAGE, in one stable
KVM memslot. Reset is stopped MMIO completion, MADV_DONTNEED of the entire mapping,
then restoration of the saved registers. No memslot re-registration/remapping,
reboot, per-call process, UFFD or KSM. Generation increments within the slot
lifetime. Host-owned cursor/identity state resets at the same barrier. The host
must never concurrently operate a slot from a second thread.
