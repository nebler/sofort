# R7 native byte streams and late-bound input ABI

Supersedes the native/byte/file restrictions in [ABI-R6](ABI-R6.md). QuickJS
keeps its R6/R7 RNG contract and major=2/minor=0. Native binds use major=2,
minor=1 and the **exact feature bundle 7** at control+0x20: bit 0 byte streams,
bit 1 native entry/completion, bit 2 RO input archive. No implicit downgrade,
unknown bits, partial feature bundles, JSON-to-byte reinterpretation, or use
with fixture ABI v0. Host-selected mode is private host state; guest writes to
control never negotiate features or enlarge bounds.

## JS profile: messages, ring version 3 (ABI 12)

Supersedes ABI-R6's JS-profile call slots and source page; the geometry below
is unchanged. A message is one or more consecutive records of one kind and
identity in one ring; every record but the last has flags `JSON_UTF8|MORE`
(MORE=2) and exactly 16,352 payload bytes, the last `JSON_UTF8`. Bounds
(`jitk-abi` `ring`) are on the concatenated payload:

| Message | Ring, identity | Bound | Guest side |
|---|---|---|---|
| SOURCE=9 | RX, 0 | SOURCE_BYTES (control+0x228) <= 73,728, UTF-8 | `read(0)`, blocking in WAIT for the next record; 0 at its end |
| CALL=1 | TX, call id 1..4096 in order, cap 1 | 1 MiB printable ASCII; at most 64 open | `write(128+id)`; -EINVAL past 64 open |
| RET=2 / ERR=3 | RX, an open call id, cap 1 | the class's reply bound (`Class::reply_bytes`): 1 MiB on glue-2m/4m, 2 MiB on glue-8m, 4 MiB on glue-16m (`MAX_REPLY_BYTES`); host output, which only the host checks | `read(104)`: 8-byte prefix (id u32, kind u16, flags u16) + one record's payload; -EAGAIN when RX is empty; the final record closes the call |
| CONSOLE=10 | TX, 0 | 32 KiB, at most 1,024 per run | `write(103)`, one-way; JSON `[level, message]` |
| DONE=5 | TX, 0 | 1 MiB | `write(102)`, refused (-EBUSY) while a call is open; then FINISH |

The guest copies replies straight from RX to user memory (no kernel reply
buffers); a 4,096-bit set marks the open calls. The host keeps RX records
that do not fit yet (the SOURCE message at bind, replies) in a per-slot
backlog and writes them before every vCPU entry. Policy mode: SUBMIT (TX full)
runs on; a WAIT runs on while the backlog is not empty, else parks the slot
until a reply or, when the WAIT's DEADLINE word (control+0x230, the guest's
ppoll timeout on the slot clock) is finite, until that time; this is how
setTimeout/setInterval wake a parked guest. The lease bounds every wait.

Since ABI 12 the guest kernel also writes the run's heap high-water to
control+0x268 (`HEAP_PEAK`, u64): the highest end of the mmap window it mapped
above the window's base plus the highest brk break above the heap base, raised
whenever user pages are mapped and again before DONE. It starts each run at
the prepared snapshot's value (the arena and control page are restored). The
host reads it when the run stops, before the reset, takes at most the class's
arena bytes and reports it in IPC STATS; it is a measurement, never trusted.

## Records and credit

The R6 control/TX/RX GPAs, 80 KiB transport allocation, 32,768-byte rings,
32-byte little-endian headers, aligned atomic byte cursors and release/acquire
ordering remain. Header offsets are: record bytes u32 @0, kind u16 @4, flags
u16 @6, generation u64 @8, identity u64 @16, payload bytes u32 @24, cap u32
@28. Record bytes = align8(32 + payload bytes), 32..16,384 inclusive; payload
<=16,352; trailing padding zero. Records may wrap, with no PAD record.

Native TX accepts only these kinds; RX is unused:

| Kind | Flags | Identity | Payload |
|---|---|---|---|
| STDOUT=6 | 0 | byte offset in stdout | nonempty arbitrary bytes |
| STDERR=7 | 0 | byte offset in stderr | nonempty arbitrary bytes |
| NATIVE_EXIT=8 | 0 | 0 | exactly 24 bytes below |
| LOG=4 | JSON_UTF8=1 | 0 | canonical diagnostic JSON below |

Cap is always zero. Generation must equal the host-bound, nonzero generation.
Stream identity starts at zero independently for each stream, then equals the
exact number of previously accepted bytes in that stream. It is **not a call
ID** in this negotiated mode. Stream boundaries preserve each stream's byte
order; no cross-stream merged ordering is promised. Kernel chunks writes at
16,344 bytes; receivers permit the full 16,352-byte payload bound.

Completion is status u32 @0 (Linux exit/exit_group low 8 bits, 0..255), flags
u32 @4 (bit 0 output limit encountered; all other bits zero), stdout byte total
u64 @8, stderr byte total u64 @16. Totals must equal host shadow totals. Exactly
one completion is required, last in TX, on doorbell FINISH=3. A completion on
SUBMIT/WAIT, trailing bytes/records, duplicate completion, missing completion or
an exception/fatal stop is a sandbox failure, never guest exit zero. Program
nonzero status still returns all preceding stdout/stderr bytes successfully.

LOG remains JSON: `{"level":"debug","msg":"..."}` with each diagnostic byte
escaped as `\u00hh`. A record encodes at most 256 message bytes; aggregate
encoded diagnostic payload is at most 16 KiB/run. The host validates this
restricted canonical schema and discards diagnostic records. Native output
never uses LOG. QuickJS diagnostics now use this same JSON encoding. The JS
profile's LOG records (kernel diagnostics; tenant code has no LOG path: the
kernel checks and drops tenant fd 1/2 writes, returning their length, and
reports each unregistered syscall number once, at most 8 per run) have
the same `ring::LOG_BYTES` (16 KiB) per run: more, as from a compromised
kernel, fails that run (`guest_protocol: LOG budget`), never the shard. The host discards them;
`JITK_SHARD_DIAGNOSTICS=1` prints them to shard stderr for offline debugging.

The combined stdout+stderr cap is host-chosen, <=1,048,576 bytes, stored at
control+0x260 and retained independently by the host. A write exceeding remaining
credit returns a positive short count, marks outputLimited, and emits only
that prefix; further nonempty writes return EFBIG. Zero-length writes emit no
record. Completion still carries the program's actual status; outputLimited
is an explicit additional field. This is bounded capture, not a promise that
programs recover from short writes. At most 65,536 native records/run are
accepted, including LOG and completion; payload capture grows only within the
aggregate cap. No guest-selected host allocation or pointer is followed.

The host first validates produced-consumed (monotonic, no overflow, <=32,768,
8-aligned), copies exactly 32 header bytes, checks every header bound before
allocating/copying at most 16,352 further bytes, and validates/uses those same
private copies. It validates padding, kind/direction, flags, generation, cap,
offsets and totals before accepting bytes. The consumer cursor is host-shadowed
and published only after copying. Guest edits to request_consumed cannot grant
host acceptance credit. On TX pressure the kernel SUBMITs; the fixed worker
drains and returns byte credit before reentry. No output-dependent unbounded
queue, UTF-8 decoding of output, or per-run helper process exists.

## Prepared native entry and bind

### Bounded layout identity (R7 integration)

Every prepared `.layout` is exactly nine little-endian u64 words: magic
`0x414e4552414b544a`, layout version **2**, admission class MiB (2/4/8/16), arena
GPA, arena bytes, ring bytes (81,920), ELF writable-data reservation (65,536),
brk reservation (65,536), and user stack bytes (131,072). The linked kernel
contains the identical marker; restore checks the sidecar against that marker
and the host's finite class catalogue. Legacy/unknown layouts and mismatched
sidecars are rejected. Class selection is offline, never guest-negotiated.

| Class | Arena GPA | Writable arena bytes | Prepared native profiles |
|---|---|---:|---|
| glue-2m | `0x81800000` | 1,310,720 | jq-musl, sqlite3, busybox, lua |
| glue-4m | `0x81800000` | 2,883,584 | micropython, zstd |
| glue-8m | `0x81400000` | 7,077,888 | none (JS) |
| glue-16m | `0x80c00000` | 15,466,496 | none (JS) |

Each arena starts on a 2 MiB block (the kernel maps its own page tables per
arena block) at or above 8 MiB of RAM, and ends below the control page's
block (`0x81c00000`); the kernel and its packed payload lie below it.
`JITK_RING_CLASS` selects the linked layout; unset retains glue-2m for QuickJS.
The native preparation harness selects the table above per pinned executable
and records it in `profiles.json` and each snapshot. Five RAM memslots retain
exactly the arena and 80-KiB transport as writable; all remaining RAM is both
KVM-read-only and host-read-only. Input memslot 63 stays read-only and is mapped
EL1-only/read-only in stage 1 across its full admitted 4 MiB. Input extent charges
are additional to the writable class reservation.

On the ring syscall path, after full range/page/permission validation,
`user::access` returns the user virtual mapping with EL1 PAN cleared for the
syscall. Hardware walks each page, so a buffer or iovec spanning relocated
physical regions remains contiguous to its caller. Other kernel entry and the
default libkrun access path are unchanged. The freestanding region probe checks
byte buffers, split iovecs, RO copyout denial and unmapped tails against Linux.

`JITK_RING_NATIVE=1 JITK_ELF=... sh kernel/build-ring.sh` builds a profile with
argv marker `["@ring-native"]`, no packed resource directory and one static
ET_EXEC. It does not change the default image. Each tool has one immutable
shared prepared `.mem`/`.regs` pair. CHECKPOINT=4 happens in trusted EL1 after
mapping ELF/stack pages and offline code-cache maintenance, **before argv construction, AT_RANDOM installation,
libc initialization or entry into the native ELF**. Thus libc starts normally
with fresh AT_RANDOM; there are no initialized native libc guards to rotate.
This is intentionally less prepared than QuickJS's post-initialization snapshot.

At the stopped reset barrier the host drains MMIO, discards the previous private
RAM delta, restores registers, removes the old input memslot and drops its
mapping. It maps the new input, binds a strictly increasing generation, fresh
16-byte host seed and fresh epoch/monotonic baseline, then resumes CHECKPOINT.
EL1 refreshes boot_info, verifies the native bundle and records the repaired
generation before constructing the initial Linux stack. Tenant data/argv/files
are never written into the prepared files. Existing R6 machine-local snapshot
limitations still apply (trusted local files, no signed/cache-key manifest).

| Control offset | Type | Native bind field |
|---:|---|---|
| 0x208 | bytes[16] | fresh seed (same R7 host entropy source) |
| 0x218 / 0x220 | u64 / u64 | epoch ns / monotonic ns |
| 0x228 | u64 | argv storage length, <=8192 including NULs |
| 0x238 | u64 | EL1 repaired generation |
| 0x248 | u64 | argc, 1..32 including argv[0] |
| 0x250 | u64 | exact RO archive bytes, 16..4,194,304 |
| 0x258 | u64 | reserved zero |
| 0x260 | u64 | aggregate capture cap, <=1,048,576 |
| 0x268 | u64 | guest-written heap high-water (`HEAP_PEAK`, both profiles) |
| 0x400 | bytes[8192] | argc consecutive NUL-terminated scalar UTF-8 args |

## Read-only input extent and fd subset

One separately allocated, fully sealed memfd per active run contains the existing
`JITKFS01` archive (16-byte header, 24-byte entries, byte-sorted contiguous
children, names, file data; exactly the format in kernel/prepare.py).
Its zero-padded, 4-KiB-rounded extent maps **GPA 0x82000000**, **KVM memslot 63**,
KVM_MEM_READONLY. The host mapping is PROT_READ and the file has WRITE/SHRINK/
GROW/SEAL seals. It is outside the snapshot's 32 MiB RAM and is never user-mapped.
The existing ring EL1 identity map covers this GPA; no page-table or memory
syscall change is needed. Reserve memslot 63 when merging the arena work.

Host input bounds: <=64 files, <=1024 archive nodes (plus root), <=4 MiB archive
including metadata, relative scalar UTF-8 paths <=1024 bytes, <=16 components,
components 1..255 bytes, no empty/`.`/`..`/NUL, no duplicate or file/directory
collision. Parent directories are synthesized. The kernel uses the existing
checked archive/fd API for openat/read/readv/pread64/fstat/newfstatat/lseek/
getdents64/close and read-only errors; no host filesystem path is opened at run
time. Empty stdin is EOF. The bounded ring fd table additionally supports the
native **dup3(regular_fd, 0, flags)** profile needed by BusyBox gzip file input:
flags 0 or O_CLOEXEC, a shared open-description offset, independent descriptor
flags, and retained lifetime after closing the original fd. Other dup3 targets
return ENOSYS; console aliases/writable descriptors/exec remain unsupported.

## Persistent worker IPC and MCP

`real native-worker TOOL=SNAPSHOT_BASE ...` loads 1..16 prepared profiles once,
keeps one reusable slot/profile, and executes serially on one thread. Its stdin
and stdout carry u32-le length-prefixed frames; a request is at most 4 MiB+16 KiB:
`JNR8`, u32-le run budget in milliseconds (1..2^32-1), u16-le tool byte length
+ UTF-8 tool, u16-le argc, argc strings each u16-le byte length + UTF-8, u16-le
file count, then files (u16-le path length + UTF-8 path, u32-le data length +
bytes). All trailing bytes are rejected; so is the budget-less `JNR7` frame
(`native request magic`).
Tool names are 1..64 ASCII alphanumeric/underscore/hyphen. The Node layer supplies
argv[0]=tool; the remaining arguments are late-bound. No shell is involved.

Response payload starts with five u32-le words: worker status (0 success / 1
sandbox failure / 2 deadline), guest status, stdout length, stderr length,
outputLimited. Success appends stdout then stderr; lengths sum to <=1 MiB.
Failure zeroes the last four words and appends <=512 diagnostic bytes. Node
bounds the frame before copying and validates all fields. MCP returns base64
objects for both streams, exitCode and outputLimited; a nonzero guest status is
a completed run, not an MCP transport error.

Deadlines and supervision (2026-10-29). The worker bounds each run itself: its
deadline is the budget after the run starts. On Linux the shard's lease
watchdog (`lease.rs`, a separate confined process started with the worker)
kicks the vCPU out of KVM_RUN at the deadline and SIGKILLs the worker if it has
not stopped 100 ms later; on macOS a supervisor thread kicks the vCPU
(hv_vcpus_exit). The run then answers status 2 and the worker stays usable (the
next run resets the slot). The worker dies with its parent: PR_SET_PDEATHSIG on
Linux, a kqueue NOTE_EXIT watch of the parent on macOS, both effective while
the vCPU runs; it refuses to start once its parent is gone. Node
(`executor/native-backend.ts`) sends the session's remaining time as the
budget, fails the session at its deadline (TIMEOUT), and kills the worker only
if it has not reported 1 s later or on a broken frame. A cancel mid-run (there
is no per-run cancel) ends the session at once and drains the worker, which
finishes the run within its budget; only a run without a deadline is stopped
by killing the worker. The next request then gets a new worker; at most 5
restarts per 60 s, after which the engine answers `native engine unavailable`
until the window has passed. Messages separate a failed job (`native job
failed`, the worker is fine), a failed engine (`native engine failed`, it
restarts) and an unavailable engine.

On macOS arm64, `run` uses `hvf native-worker` (`src/hvf/native.rs`, 2026-10-28):
the same frames, bind, byte streams and fd subset; profiles prepared by `hvf
prepare`; the archive in anonymous host memory made read-only, mapped at the
same GPA read-only and never executable, rounded to the 16-KiB HVF granule
(KVM: 4 KiB); one VM per process, so a run for another profile replaces the
slot's VM (~1–7 ms with the run) instead of keeping one per profile. Its
process enters jitk.sb for the first profile's directory and drops fork
(RLIMIT_NPROC 0) before any VM exists. `make -C shard check-native-hvf` runs
the 41 cases twice against the Linux oracle a Linux `check-native-r7` recorded.
`execute` stays libkrun by default there. On Linux arm64,
`run` uses this KVM ring worker; the existing `execute` adapter remains libkrun
until the separately owned Node/shard policy cutover. A native-only server can
set `execute:false`; it lists both tools but execute returns UNSUPPORTED. No
production Node-policy IPC, multi-owner native pool, lease integration, metal
timing, hard native memory class or full Linux ABI claim follows from this work.
