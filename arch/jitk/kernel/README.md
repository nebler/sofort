# jitk guest kernel

A small `no_std` AArch64 kernel that runs one unmodified static Linux ELF
(QuickJS by default) at EL0 behind a fixed table of syscall handlers. One
source tree builds two profiles:

| Profile | Build | Transport | Booted by | Used for |
| --- | --- | --- | --- | --- |
| ring (`transport-ring`) | `make ring` or `sh build-ring.sh` → `dist/kernel-ring.bin` (cache `target-ring/`), packing `payload/qjs-ring` and `ring-bootstrap.js` | shared-memory rings and a doorbell, ABI v11 ([`../abi/`](../abi/README.md), [`../shard/ABI-R7.md`](../shard/ABI-R7.md)) | the ring engine from a prepared snapshot (`make -C ../shard snapshot`): `hvf` on macOS, `real` (KVM) on Linux | the product: executor and MCP |
| console (default) | `sh build.sh` (run by `make -C .. build`) → `dist/kernel.bin`, packing `payload/qjs` and `../protocol/bootstrap.js` | one virtio-mmio console, protocol v1 on stdio | `hvf console` on macOS (below) | GrowOS, `scriptc-corpus`, this subtree's VM tests, the protocol VM tests |

[`.READY`](.READY) pins the console image and the gates that ran on it; it
is written only by `make promote` ([`promote.ts`](promote.ts)), which runs
every gate on the built image and refuses otherwise. The ring images are
identified by the shard snapshot key instead (`../shard/README.md`).

Source layout: an architecture-neutral core plus `src/arch/aarch64/` (boot,
vectors, MMU, timer/GIC, FDT, trap entry, MMIO, syscall numbers, stat layout).
[ARCH.md](ARCH.md) describes the interface an x86_64 port implements;
`arch-lint` keeps assembly and AArch64 names out of the core.

## Build

The image is a 32 MiB AArch64 RAW image. It needs the Rust pin from
`../tools/deps.json` with `aarch64-unknown-none`, LLVM `llvm-objcopy`
(Homebrew LLVM on the Mac; override with `OBJCOPY`) and the scriptc tools in
`.work/bin/` (`make build`). There are no Cargo dependencies or network
downloads. `payload/qjs` is a stripped static Bellard qjs; its source digest
is recorded in the manifest. The console bootstrap is read directly from
`../protocol/bootstrap.js`, not copied. Default argv: `qjs --std
--memory-limit 16777216 --stack-size 81920 -e <bootstrap>` (the user stack is
96 KiB; see `generate.ts`).

Outputs: `dist/kernel.bin`, `dist/kernel-<sha256>.bin`, `dist/manifest.json`
and `dist/kernel-<sha256>.json`. The manifest records exact ELF/flat/image
digests, segments, argv and syscall numbers/names/handler hashes/registration.
The digest names immutable image contents; `kernel.bin` and `manifest.json`
select the latest. Rebuilding with changed inputs does not certify that
artifact; only `make promote` moves `.READY`.

## Test

`make test` runs the packer regression, handler tests and real-VM regressions
on macOS arm64. The VMs are the HVF engine's console runner,
`$JITK_SHARD_BINARY console --image IMAGE` (`tests/host.sh`; `make -C ..
deps` builds the engine and the delegate passes it; `JITK_TEST_HOST` selects
another positional-image test host). The full G1/G2 harness is
`.work/bin/tests/measure park 0` and `... integration`. Tests use bounded
controller deadlines and kill and reap every VM. The build cache defaults to
`target/`; test outputs and scratch default to `test-results/` and
`test-work/` here (`JITK_TEST_OUTPUT`, `JITK_GROW_CONTRACT_WORK`,
`JITK_PROBE_WORK` and `JITK_LUA_PROFILE_WORK` override them). The grow-contract
assembly fixtures ship in `tests/fixtures/grow/`.

`make test-ring` checks the ring JS profile's tenant-reachable kernel paths
(`tests/ring-tenant-check.mjs`: stdout/stderr, missing syscalls, the
checkpoint fd) through the executor on this host's ring engine (HVF or KVM)
with the prepared glue-2m snapshot; CI runs it in `ci-mac` and `ci-kvm`.

## Ring JS profile: tenant output and diagnostics

Tenant code in the JS profile has no output channel besides `tools.log`
(ABI-R7: no LOG path). `write`/`writev` to fd 1 or 2 check the buffer as
Linux would (EFAULT for unmapped bytes, EINVAL past 1 MiB per buffer) and drop
it, returning its length, so `print`, `std.out` and `std.err` never stop or
fail a run. Native mode keeps its byte streams. LOG records are kernel
diagnostics only; within their 16 KiB per-run budget the kernel reports each
unregistered syscall number once, for at most 8 numbers per run (further
calls still return -38 silently). `write` to the checkpoint fd outside the
bootstrap state returns EBADF.

## Ring payload and entropy after restore

The ring payload has a native `os.snapshotCheckpoint()` hook: after the EL1
checkpoint resumes and installs fresh entropy, it repairs the existing
context's Math.random state, musl AT_RANDOM/stack guards/mallocng metadata
secret, and libc PRNGs before returning to the bootstrap or reading source.
The seed is delivered once through fd101, erased in EL1, and never exposed as
JS bytes. `run.entropy` is a domain-separated public receipt. Math.random and
libc PRNGs keep their upstream non-cryptographic semantics; native code must
use an independently designed entropy API for cryptographic randomness
(getrandom is not implemented).

Rebuild this payload **inside a Linux arm64 VM**, into a new directory:
`sh payload/ring-rng/build.sh /absolute/NEW_WORK`, then copy
`NEW_WORK/qjs-ring` to `payload/qjs-ring`. Sources, checksums, compiler flags
and the mallocng repair are explicit in that recipe (QuickJS 2026-06-04, musl
1.2.5); the stripped `payload/qjs` cannot be reproduced from its recorded ELF
digest alone. See [the R7 RNG report](../docs/results/shard-r7-rng.md) for
measured provenance and restrictions. All frames spanning guard rotation are
built without stack protection, including libc; do not enable it without
redesigning checkpoint unwinding.

## Console launcher contract (`hvf console`)

One vCPU, **32 MiB** RAM starting at 0x80000000; load RAW at 0x80000000 and
pass the FDT in x0. Exactly one virtio-mmio inout console port named jitk maps
fd0/fd1 (`../shard/src/hvf/console.rs` implements it; it passes a positive
`jitk.tick_us`, so the kernel never programs the GIC the FDT names). No PL011 or filesystem device (resources are packed in the image, see below). FDT supplies console address/SPI and GICD/GICR.
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
all iovecs before emitting any byte. fd2 is checked like fd1 (EFAULT, EINVAL past
1 MiB) and dropped in production. Kernel records
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
PT_LOAD VAs in [0x400000, IMAGE_END = 0x1880000] (the image must leave the 1.5 MiB brk heap
and a 4 MiB mmap arena below 0x1e00000), entry executable and PHDR table loaded. A
higher base, such as scriptc/Zig's default 0x1000000, is padded with unmapped zero pages
from 0x400000; heap and mmap stay above the image, so the arena shrinks by the padding.
W+X and ANY page-sharing between PT_LOAD segments are rejected (including RX/RW).
Nonconforming executables must be relinked; there is no runtime relocation/parser.

`slots.json` maps Linux syscall names to handler modules. The numbers come from
the architecture's table, `src/arch/aarch64/syscalls.json`; a new slot needs an
entry there too. build.rs emits dispatch, registered slots and
`syscalls::nr` from `src/syscalls/<name>.rs`; deleting a file requires no other
change. Multiple slots may name the same handler: exit (93) and exit_group (94) both use `exit.rs`
because the guest has exactly one thread. The module is emitted once; deleting
it unregisters both slots. Reserved
134 rt_sigaction and 135 rt_sigprocmask are installed as Lua profile handlers:
they ALWAYS return -38, touch no user pointers, and install no signal state.
The owner-applied 6-line patch and native Linux injection evidence come from
`arch/08-grow-loop/r3/grow-results/canonical-r3/`. `syscalls.manifest.json` records that restricted
contract; the artifact manifest includes its contents and SHA256. A growth replay
deletes these handlers in its copied tree before rediscovery.
216 mremap is registered and returns -38 (musl fallback). Unregistered syscalls
return -38 and ALWAYS emit the v2 `missing` record in the console profile (ring
builds: once per number, at most 8 numbers per run); a registered handler returning
-38 is ordinary and NEVER emits missing. The pure-Rust candidate helper API in
syscalls.rs provides copyin, copyout, writable, now_ns, poll_fd and park(deadline) and park_poll(deadline, input_interest).
ppoll supports <=16 fds, ignored negative fds, stdout/stderr POLLOUT, open archive
fds POLLIN|POLLOUT (a regular file), unknown fd POLLNVAL, stdin POLLIN/POLLHUP, finite/NULL waits, and ENOSYS for non-NULL signal
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

Host confinement belongs to the engine (`../shard/src/hvf/jitk.sb`) and host
policy to `../executor/policy`; this subtree
only enforces EL0 isolation, pointer checking, W^X and stdout framing.

Lua profile verification after applying the owner patch:
`.work/bin/tests/lua_profile` builds an isolated alternate-ELF image and checks
30 fresh VMs against grow's normal-Linux reference. It requires the grow payload
and fixture and uses the same test host settings as the other VM checks. It
asserts both signal numbers return ENOSYS without missing records. Lua has no
signal installation, masking state, delivery or threads in this kernel.

## Read-only resources (in-memory filesystem)

A purpose-built image is grown kernel + static binary + resources:
`sh build.sh --resources DIR` (or `JITK_RESOURCES=DIR`) packs DIR as the guest's
`/`. Without it, `/` is an empty directory. `prepare.ts` appends one archive to
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
on use (corruption returns EIO, never panics: `tests/test_fs.ts`).

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
SQLite corpus. See [the R7 grow report](../docs/results/grow-r7.md)
for per-case stdout/stderr/exit comparisons and artifact identities. This is a
developer grow-trace demonstration on the console profile with printable stdout; production
native streams and stderr are separate ring work. faccessat/getpid remain
tolerated missing compatibility probes; the signal handlers remain ENOSYS.

Gates: `tests/test_fs.ts` (host-compiled real handlers + index corruption),
`tests/fs_diff.ts` (Docker `jitk-oracle:08` with the tree bind-mounted `:ro` and
`ulimit -n 64`, versus 30 fresh VMs each for a 148-line raw-syscall probe
(`tests/fixtures/fs/probe.c`), Lua stdlib and QuickJS std/os workloads. Stdout
must be byte-identical with no `missing` records. It also covers the protocol bootstrap.
QuickJS's bootstrap already exposes `std`/`os` (`qjs --std`), so submitted
code can read resources with `std.loadFile`. No guest API was added or widened.
`tests/fs_bench.ts` measures size/boot/footprint. See `RESULTS-fs.md`.

Native tooling uses the arch/jitk scriptc 0.4.5 pin in `../tools/` and the
shared helpers in `../tslib/`. Run `make tools` to compile the tools under
`.work/bin/`. See [`SCRIPTC-GAPS.md`](SCRIPTC-GAPS.md) for compiler workarounds and the
[Python port parity report](../docs/results/port-parity-kernel-2026-10-26.md).

`make linux-tools` cross-compiles static aarch64 musl executables for the
Linux-only filesystem diagnostic and ring-rng source patcher. Set
`JITK_FS_LINUX_ROOT` to the staged filesystem fixtures on Linux, or
`JITK_RING_PATCH_TOOL` to the cross-compiled patcher when running its build recipe.
