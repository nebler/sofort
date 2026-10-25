# Canonical jitk kernel (owner 02)

Experimental shard build: `make ring` (Linux/arm64 toolchain, `llvm-objcopy`) or
`sh build-ring.sh` emits **`dist/kernel-ring.bin`** in a separate `target-ring/`
cache. It enables `transport-ring`, packs the same static qjs payload and selects
`ring-bootstrap.js`. It never overwrites `dist/kernel.bin`. The default build,
argv, virtio/FDT/GIC path and syscall contracts are unchanged. See
[`../shard/ABI-R6.md`](../shard/ABI-R6.md) for its bounded ABI-v2 subset and explicit
RNG, clocks, deadline and policy limitations; it is not a production cutover.

`make -C arch/jitk/kernel` builds the 32 MiB AArch64 RAW image. Requires Rust
1.95.0 + aarch64-unknown-none, Python 3, LLVM objcopy (override `OBJCOPY`).
There are no Cargo dependencies or network downloads. `payload/qjs` is the stripped
static Bellard qjs from the spike; its source digest is recorded in the manifest.
The default bootstrap is read directly from `../protocol/bootstrap.js`; it is not
copied. Default argv: qjs --std --memory-limit 16777216 -e <canonical bootstrap>.

Outputs: `dist/kernel.bin`, `dist/kernel-<sha256>.bin`, `dist/manifest.json`, and
`dist/kernel-<sha256>.json`. The manifest records exact ELF/flat/image digests,
segments, argv and syscall numbers/names/handler hashes/registration. The digest
names immutable image contents; `kernel.bin` and `manifest.json` select latest.
`make test` runs packer regression, handler tests and real-VM regressions; the
integrated vmm launcher must be built first (set `JITK_VMM_BINARY` to its executable;
the default is `../vmm/dist/jitk-vmm`;
`JITK_TEST_HOST` selects a legacy positional-image test host). The full G1/G2 harness is `python3 tests/measure.py park 0` and `... integration`.
`.READY` identifies the tested artifact; rebuilding with changed inputs does not
certify that artifact. Tests use bounded controller deadlines and kill/reap all VMs.
Build cache defaults to `target/`; test outputs and scratch default to
`test-results/` and `test-work/` inside this subtree. `JITK_TEST_OUTPUT`,
`JITK_GROW_CONTRACT_WORK`, `JITK_PROBE_WORK`, and `JITK_LUA_PROFILE_WORK`
override those test paths. The grow-contract assembly fixtures ship in
`tests/fixtures/grow/`; no historical area checkout or scratch fixture is needed.

## vmm/ contract

One vCPU, **32 MiB** RAM starting at 0x80000000; load RAW at 0x80000000 and
pass the FDT in x0. Exactly one virtio-mmio inout console port named jitk maps
fd0/fd1. No PL011 or filesystem device (resources are packed in the image, see below). FDT supplies console address/SPI and GICD/GICR.
Kernel + stack occupy the first 512 KiB; packed executable starts at 0x80080000.
EL0 RX is also read-only/NX through its privileged alias. mmap recycles holes;
brk is separately bounded; qjs has a 16 MiB heap cap. Keep panic=abort and a host
SIGKILL watchdog. Process status/EOF never establishes application success.

Bootargs (ASCII, space-delimited):
`jitk.seed=<32 hexadecimal digits> jitk.epoch_ns=<Unix nanoseconds>
jitk.counter=<CNTVCT ticks paired with epoch> jitk.tick_us=0`.
On HVF the counter domain is mach_absolute_time. Bracket wall time with counter
reads and retain the least-preempted pair. Without a counter, epoch origin is
kernel entry and has no sub-ms guarantee. tick_us=0 selects native GIC/WFI;
Omitting tick_us also selects native WFI; positive values select a timer-only fallback. Finite ppoll always uses CNTV/WFI.
IRQ handling rechecks the used rings after IAR/EOI before WFI. No busy polling
while parked. The console drains/reposts control buffers and preserves partial
RX tails; PORT_OPEN=0 is EOF, reported as POLLHUP after buffered input drains.

Follow `../protocol/PROTOCOL-v1.md`. EL0 stdout permits only printable ASCII
0x20..0x7e plus LF; DEL and other controls terminate the guest. writev validates
all iovecs before emitting any byte. fd2 is dropped in production. Kernel records
start 0x1e and end LF; never treat them as guest success. Diagnostics cannot splice
into a partial guest line. The host still validates every untrusted JSON frame.

## grow/ contract

Copy this subtree before editing handlers. All mutable outputs can be isolated:

```sh
JITK_ELF=/absolute/static-aarch64-elf \
JITK_ARGV_JSON='["lua","-e","print(2)"]' \
CARGO_TARGET_DIR=/tmp/jitk-example/target \
JITK_OUT_DIR=/tmp/jitk-example/out \
sh /absolute/copied-kernel/build.sh --features grow-trace
```

`JITK_ARGV_JSON` is a JSON array of 1..32 strings, no NUL, total UTF-8 storage
<30000 bytes. It overrides all default qjs arguments. `JITK_SCRIPT` replaces only
the default qjs -e argument. For a copy without sibling protocol/, set an explicit
argv or script. `JITK_ELF` defaults to payload/qjs; static ET_EXEC AArch64 only,
PT_LOAD VAs in [0x400000,0x680000], entry executable and PHDR table loaded.
W+X and ANY page-sharing between PT_LOAD segments are rejected (including RX/RW).
Nonconforming executables must be relinked; there is no runtime relocation/parser.

`slots.json` fixes syscall numbers. build.rs emits dispatch and registered slots
from `src/syscalls/<name>.rs`; deleting a file requires no other change. Multiple
slots may name the same handler: 93 (exit) and 94 (exit_group) both use `exit.rs`
because the guest has exactly one thread. The module is emitted once; deleting
it unregisters both slots. Reserved
134 rt_sigaction and 135 rt_sigprocmask are installed as Lua profile handlers:
they ALWAYS return -38, touch no user pointers, and install no signal state.
The owner-applied 6-line patch and native Linux injection evidence come from
`../grow/results/canonical-r3/`. `syscalls.manifest.json` records that restricted
contract; the artifact manifest includes its contents and SHA256. A growth replay
deletes these handlers in its copied tree before rediscovery.
216 mremap is registered and returns -38 (musl fallback). Unregistered syscalls
return -38 and ALWAYS emit the v2 `missing` record; a registered handler returning
-38 is ordinary and NEVER emits missing. The pure-Rust candidate helper API in
syscalls.rs provides copyin, copyout, writable, now_ns, poll_fd and park(deadline) and park_poll(deadline, input_interest).
ppoll supports <=16 fds, ignored negative fds, stdout/stderr POLLOUT, unknown fd
POLLNVAL, stdin POLLIN/POLLHUP, finite/NULL waits, and ENOSYS for non-NULL signal
masks. Overflow and invalid timespecs/pointers are errors.

`--features grow-trace` adds the area-08 v2 guest emitter (no trace by default):

```
<RS>{"v":2,"kind":"missing","seq":1,"nr":29,"pc":4194304,"args":[0,0,0,0,0,0],"input":null,"timeout":null}<LF>
<RS>{"v":2,"kind":"sys.exit","seq":1,"ret":-38,"output":null}<LF>
```

Registered entry kind is sys.enter. All numbers are decimal, raw argument registers
are unsigned, returns signed. input is bounded lowercase hex for write and ppoll;
timeout is 16-byte timespec hex for ppoll; exit output captures read, ppoll, and
8-byte ioctl canary. Buffers >128 bytes or unreadable pointers produce JSON null,
never silent truncation. Exit emits kind done with seq/code. Developer fd2 is
hex-encoded kind log. Trace records wait for a complete EL0 line (16 KiB bound,
otherwise fail closed) to preserve D8. A final unterminated line cannot carry a
terminal kernel record. Compare bounded probe profiles, not arbitrary qjs traces.

Security integration is owned by vmm/sandbox and executor/policy; this subtree
only enforces EL0 isolation, pointer checking, W^X and stdout framing.

Lua profile verification after applying the owner patch:
`python3 tests/lua_profile.py` builds an isolated alternate-ELF image and checks
30 fresh VMs against grow's normal-Linux reference. It requires the grow payload
and fixture and uses the same test host settings as the other VM checks. It
asserts both signal numbers return ENOSYS without missing records. Lua has no
signal installation, masking state, delivery or threads in this kernel.

## Read-only resources (in-memory filesystem)

A purpose-built image is grown kernel + static binary + resources:
`sh build.sh --resources DIR` (or `JITK_RESOURCES=DIR`) packs DIR as the guest's
`/`. Without it, `/` is an empty directory. `prepare.py` appends one archive to
`payload.flat`, directly after the executable (VA `0x400000+flat`). brk starts at
`HEAP = max(0x680000, page_align(archive end))`, and mmap starts at `HEAP+1.5 MiB`. With no
or small resources the layout is unchanged. Resources consume the 32 MiB guest RAM
1:1. The packer requires at least 4 MiB of mmap arena. Only regular files and directories are packed;
symlinks/special files and names >255 bytes fail the build. All files are
mode 0444, dirs 0555, uid/gid 0, times 0. Contents are not compressed.

Format (custom, not cpio): `JITKFS01`, u32 count, u32 0; `count` 24-byte
entries `u32 name_off,name_len,parent,is_dir,a,b`; names; data. Entry 0 is `/`.
Directories are breadth-first so children are contiguous and byte-sorted
(`a,b` = first child, count; files: `a,b` = data offset, size). Lookup is a
binary search per path component; getdents64 is a slice walk. cpio newc would need
a linear scan of ASCII-hex headers on every open and prefix scans for directory
listing. This index needs no boot-time parse, and every field is bounds-checked
on use (corruption returns EIO, never panics: `tests/test_fs.py`).

Isolation: archive pages are never mapped at EL0 (`fs-user-read` probe:
translation fault). Their kernel alias is read-only (`fs-alias-write` probe:
permission fault). The table holds at most 64 fds (EMFILE). Paths are copied with
checked copyin a page at a time (EFAULT; ENAMETOOLONG at 4096/255). `..` at `/`
stays at `/`, and cwd is `/`. Every component, including `.`/`..`/trailing `/`,
requires a directory. There is no write path: write access modes, O_TRUNC, and
O_CREAT of a missing name return EROFS. Errno precedence matches Linux on a
read-only bind mount. O_ACCMODE 3 opens an fd that is neither readable nor
writable (reads EBADF), as Linux does. Out of contract: O_PATH (EINVAL),
fcntl other than F_GETFD/F_SETFD (EINVAL), AT_EMPTY_PATH on console fds (EBADF),
no mmap of files, no statx/faccessat. Descriptor metadata and positional reads
are available through fstat (80) and pread64 (67), described below.

Syscalls (slot, file): openat 56, close 57, lseek 62, read 63, readv 65,
readlinkat 78 (existing slots, now archive-aware; console fds unchanged), and
new fcntl 25, getdents64 61, newfstatat 79. They were found empirically by
stracing Lua 5.4 and Bellard qjs on Linux (Lua: openat/read/readv/lseek/close;
qjs adds newfstatat, fcntl F_SETFD, getdents64, readlinkat). Runtime delta:
+253/-49 lines (`src/fs.rs` 108, handler files 4-28 each).

R7 adds **fstat 80** and **pread64 67** for immutable read-only SQLite. fstat
shares the checked 128-byte AArch64 stat layout with newfstatat: archive
device/inode/mode/size/block accounting are deterministic; console fds describe
synthetic pipes (FIFO 0600, size/blocks 0, 4096-byte block size). Invalid/closed
archive fds return EBADF before pointer validation. pread64 returns exact
positional bytes, short reads and EOF without changing the fd offset; negative
offsets and signed offset+length overflow return EINVAL, bad destinations
EFAULT, unreadable/closed fds EBADF, directories EISDIR and console fds ESPIPE.
Zero-count and EOF reads do not dereference an unused destination. These calls
do not add a write path. The shared stat helper replaces the old duplicate
newfstatat byte-layout code without changing pathname metadata.

The grow controller accepts both handlers only after independent Linux
semantic/error/state cases, executable rejected mutations and an unchanged
SQLite corpus. See [`../grow/RESULTS-R7-grow.md`](../grow/RESULTS-R7-grow.md)
for per-case stdout/stderr/exit comparisons and artifact identities. This is a
developer grow-trace/libkrun demonstration with printable stdout; production
native streams and stderr are separate ring work. faccessat/getpid remain
tolerated missing compatibility probes; the signal handlers remain ENOSYS.

Gates: `tests/test_fs.py` (host-compiled real handlers + index corruption),
`tests/fs_diff.py` (Docker `jitk-oracle:08` with the tree bind-mounted `:ro` and
`ulimit -n 64`, versus 30 fresh VMs each for a 148-line raw-syscall probe
(`tests/fixtures/fs/probe.c`), Lua stdlib and QuickJS std/os workloads. Stdout
must be byte-identical with no `missing` records. It also covers the protocol bootstrap.
QuickJS's bootstrap already exposes `std`/`os` (`qjs --std`), so submitted
code can read resources with `std.loadFile`. No guest API was added or widened.
`tests/fs_bench.py` measures size/boot/footprint. See `RESULTS-fs.md`.
