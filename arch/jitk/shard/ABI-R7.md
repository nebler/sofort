# R7 native byte streams and late-bound input ABI

Supersedes the native/byte/file restrictions in [ABI-R6](ABI-R6.md). QuickJS
keeps its R6/R7 RNG contract and major=2/minor=0. Native binds use major=2,
minor=1 and the **exact feature bundle 7** at control+0x20: bit 0 byte streams,
bit 1 native entry/completion, bit 2 RO input archive. No implicit downgrade,
unknown bits, partial feature bundles, JSON-to-byte reinterpretation, or use
with fixture ABI v0. Host-selected mode is private host state; guest writes to
control never negotiate features or enlarge bounds.

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
never uses LOG. QuickJS diagnostics now use this same JSON encoding.

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
`JNR7`, u16-le tool byte length + UTF-8 tool, u16-le argc, argc strings each
u16-le byte length + UTF-8, u16-le file count, then files (u16-le path length +
UTF-8 path, u32-le data length + bytes). All trailing bytes are rejected.
Tool names are 1..64 ASCII alphanumeric/underscore/hyphen. The Node layer supplies
argv[0]=tool; the remaining arguments are late-bound. No shell is involved.

Response payload starts with five u32-le words: worker status (0 success / 1
sandbox failure), guest status, stdout length, stderr length, outputLimited.
Success appends stdout then stderr; lengths sum to <=1 MiB. Failure zeroes the
last four words and appends <=512 diagnostic bytes. Node bounds the frame before
copying and validates all fields. MCP returns base64 objects for both streams,
exitCode and outputLimited; a nonzero guest status is a completed run, not an
MCP transport error. Native worker timeout/cancellation kills that persistent
worker and requires MCP-server restart; it is not the new shard lease protocol.

On Mac, `execute` remains libkrun and `run` returns UNSUPPORTED. On Linux arm64,
`run` uses this KVM ring worker; the existing `execute` adapter remains libkrun
until the separately owned Node/shard policy cutover. A native-only server can
set `execute:false`; it lists both tools but execute returns UNSUPPORTED. No
production Node-policy IPC, multi-owner native pool, lease integration, metal
timing, hard native memory class or full Linux ABI claim follows from this work.
