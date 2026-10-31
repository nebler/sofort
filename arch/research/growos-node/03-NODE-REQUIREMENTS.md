# Node.js and V8 kernel requirements for Sofort Stage 2

Research date: 2026-10-31. Scope: Linux **aarch64**, Node **22.23.4 / 24.22.1**, with particular source inspection of 24.22.1. These are maintained LTS lines, but the release schedule now places Node 26 in LTS too; this report deliberately follows the requested 22/24 scope. [Release schedule][N0]

Evidence labels: **[V]** verified in a cited upstream source; **[R]** verified by reading this repository; **[I]** engineering inference or recommendation; **[U]** unresolved without qualification of the selected binary. Source verification is not a claim that the program has run under Sofort. No build, benchmark, tracing, Docker, VM, or Linux execution was performed for this research. The only created file is this report.

## Summary

- **[I] Cheapest route to actual Node:** a pinned, fully static musl aarch64 build of upstream Node 24, interpreter mode first, native addons/child processes/inspector excluded from the initial workload. Recompiling upstream does not require changing application source; using a patched packaging runtime is a separate compatibility choice.
- **[R] This exceeds handler growth alone.** Current ELF placement, memory arenas, single-thread assumptions, signals returning ENOSYS, and missing readiness objects must change together. The checked-in `slots.json` names are not evidence of implemented handlers.
- **[V] `--jitless` removes runtime executable-memory allocation**, including JS JIT and regexp code generation. It still needs precompiled RX executable segments and ordinary virtual-memory protection changes. [Jitless design][V1]
- **[V] Stock Node 22/24 configurations disable pointer compression and the V8 sandbox.** A 4 GiB cage and approximately 1 TiB sandbox are conditional build requirements, not the baseline for these Node binaries. [22 configuration][N1], [24 configuration][N2]
- **[V] Sparse `PROT_NONE` reservations, `mprotect`, `munmap`, and real `MADV_DONTNEED` remain central.** Committing every reserved page would turn cheap virtual space into prohibitive physical memory. [POSIX allocator][V2]
- **[V] Strict W^X is a separate JIT blocker:** the checked Node 22/24 Linux V8 implementations request RWX code pages; the old `--write-protect-code-memory` flag is absent. Adding RW→RX `mprotect` alone will not make these unmodified JITs work. [22 code permissions][V3], [24 code permissions][V4]
- **[V/I] Plan for about seven initial OS threads in an ordinary inspector-enabled build:** main + four platform workers + delayed-task scheduler + inspector signal watchdog; four libuv workers appear lazily. This is a source-derived normal configuration, not a universal measured count. [Platform][N3], [Inspector][N4], [Pool][L1]
- **[V] `--v8-pool-size=0` means automatic sizing, not zero threads.** `--single-threaded` suppresses V8 background work but does not remove Node's platform threads. Flags alone do not yield a stock one- or two-thread process. [Pool sizing][N3], [V8 flags][V5]
- **[V] Linux libuv needs epoll and eventfd; signals also use pipes.** Timers normally use userspace heaps plus the epoll timeout, not timerfd; signalfd is not the ordinary libuv signal backend. [Async wakeups][L2], [Signals][L3], [Timers][L4]
- **[V] io_uring is optional.** Set `UV_USE_IO_URING=0` for the filesystem/SQPOLL path and return ENOSYS for `io_uring_setup`; modern libuv can still probe io_uring for epoll batching despite that environment setting. [Linux backend][L5]
- **[V] Static-musl arm64 Node 22/24 artifacts do exist in `yao-pkg/pkg-fetch`**, around 58.5/63.7 MB respectively, but they are patched packaging runtimes. Standard unofficial arm64-musl Node builds require shared libraries. [Artifacts][B1], [Build flags][B2], [Unofficial builds][B3]
- **[V/I] Node startup snapshots and SEA simplify initialization/distribution, not the kernel ABI.** Sofort should ultimately checkpoint a quiescent initialized VM before request-specific sockets, credentials, and entropy-derived state are created. [SEA][N5], [Startup snapshot API][N6]
- **[U] No qualified Node 22/24 static-musl Linux-arm64 idle RSS or startup latency was found.** Published older/Linux and contemporary/macOS measurements only establish scale; they do not validate the requested microsecond-to-millisecond reset target.
- **[I] Cheapest useful agent route remains existing QuickJS plus narrow Node/Web API shims and host effects.** LLRT is a useful implementation reference; it is not full Node. Deno, Bun, and workerd do not remove the OS integration problem.

## Prioritized Stage 2 syscall and feature list

Risk means implementation/correctness risk relative to the present kernel: **L** = bounded extension; **M** = new coherent object/state behavior; **H** = scheduler, memory, networking, or reset redesign; **VH** = major runtime/security-contract change. Priorities are cumulative. These are a source-informed implementation plan **[I]**, not a measured minimal allowlist **[U]**.

### A. Must-have substrate for `node --jitless -e 'console.log(1)'`

The literal command retains Node's default thread counts. A reduced diagnostic profile can later use:

```sh
UV_THREADPOOL_SIZE=1 UV_USE_IO_URING=0 node \
  --jitless --single-threaded --v8-pool-size=1 \
  --disable-sigusr1 --disable-wasm-trap-handler \
  -e 'console.log(1)'
```

This is a proposed invocation, not a tested result. The two environment values must reach `envp`; the current loader supplies only `PATH=/`. `--disable-sigusr1` requires a sufficiently recent 22.x (added 22.14) and is present in the selected versions. Check V8 options against the exact pinned build. [Node CLI][N7]

| Order / ID | Kernel or image requirement | Minimum useful semantics | Risk |
|---|---|---|---|
| A0 | Admit a substantially larger static ELF; correct initial stack/auxv/envp, TLS, FP/SIMD | Extend packer/image and writable-arena budgets; supply page size, PHDR/ENTRY, random bytes and conservative CPU features. Handle static TLS and `TPIDR_EL0`. Avoid dynamic loader and static PIE relocation work initially. | **H** |
| A1 | `mmap` (222), `mprotect` (226), `munmap` (215), `brk` (214) | Anonymous PRIVATE RW/R/NONE; address hints; alignment; guard pages; sparse reservation metadata; safe subrange protection and release. Add fixed placement where the selected libc/V8 path actually needs it. No executable heap allocation for this stage. | **H** |
| A2 | `madvise` (233) | `MADV_DONTNEED`: discard anonymous contents so future reads see zeros; preserve mapping/protection. Do not report success without the required content behavior. Optional hugepage/fork/naming advice can fail using Linux-compatible errors. | **M** |
| A3 | pthread substrate: `clone` (220), `futex` (98), `set_tid_address` (96), thread `exit` (93), process `exit_group` (94), `gettid` (178) | Shared VM/files/signal dispositions, separate stacks/TLS, unique TIDs, parent TID store and clear-child-TID wake; futex wait/wake, timeout, compare-before-sleep, private/shared addressing; complete register context. Return ENOSYS for `clone3` (435) if using a libc with verified fallback. | **H** |
| A4 | Scheduler + monotonic deadlines | Run newly cloned threads while the main thread waits at startup; deschedule futex/epoll sleepers; wake on completion/timeout. Prefer simple timer preemption. One vCPU is sufficient; one runnable thread forever is not. | **H** |
| A5 | `rt_sigaction` (134), `rt_sigprocmask` (135); later `rt_sigreturn` (139), `tgkill` (131), `sigaltstack` (132) where exercised | Store/query dispositions and per-thread masks correctly. Node checks registration results. Fully implement delivery/return for signals admitted by the profile; a no-delivery diagnostic milestone is explicitly narrower than general Node compatibility. | **H** |
| A6 | `epoll_create1` (20), `epoll_ctl` (21), `epoll_pwait` (22), `eventfd2` (19), `pipe2` (59) | Pollable descriptors with NONBLOCK/CLOEXEC; eventfd 64-bit counter reads/writes, EAGAIN/overflow; pipe buffering/EOF; epoll ADD/MOD/DEL, opaque user data, readiness, timeouts and close/reuse correctness. They occur during runtime initialization, not just HTTP. | **H** |
| A7 | stdio/general fd operations: `read`, `write`, `readv`, `writev`, `close`, `fstat`, `fcntl`, `ioctl` | Consistent fd types and `F_GETFL/F_SETFL` nonblocking flags, not only CLOEXEC. A non-TTY stdout is simplest; `ioctl(TCGETS)` can return ENOTTY. Support short I/O and EAGAIN. | **M** |
| A8 | Entropy/time: `getrandom` (278), `clock_gettime` (113); libc-selected time queries | Real entropy, not time-based pseudo-random bytes; realtime/monotonic and any selected coarse clock fallback. No vDSO is required if libc's syscall path works. | **M**, **H** for safe snapshot reseeding |
| A9 | Process/environment probes: `getpid`, UID/GID/effective IDs, `getcwd`, `readlinkat`, `prlimit64` (261), `sched_getaffinity` (123), `sysinfo` (179), `uname`; `prctl` (167) as selected | Return coherent guest identity, one-CPU affinity and actual guest resource budgets. `/proc/self/exe` should resolve to the guest executable; missing optional cgroup/proc files can be ENOENT. Thread-name prctl can be a bounded implementation. Audit optional `capget` probe. | **L–M** |
| A10 | Optional probes and errno contracts | `io_uring_setup`, `clone3`, `rseq`, `membarrier`, unsupported `statx`/`faccessat2` paths: use deliberate ENOSYS/fallback decisions, never blanket fake success. `set_robust_list` must either be implemented for admitted robust mutex use or rejected consistently with the selected libc. | **M** |
| A11 | Snapshot/reset for the new objects | Snapshot all guest thread contexts, wait queues, fd tables, VMAs, timers, writable RAM and page tables together; preserve immutable sharing. A single-vCPU register snapshot alone cannot reconstruct multiple guest threads. | **H** |

**Acceptance boundary [I]:** the first complete milestone is output `1\n`, successful cleanup, repeated restore with independent entropy and no stale readiness, and unchanged immutable pages. Passing `node --version` is insufficient because it can exit before V8/platform initialization. Validate the literal command separately from the reduced-flags profile.

### B. Additional requirements for the V8 JIT

| Order / ID | Requirement | Why it follows | Risk |
|---|---|---|---|
| B0 | Decide strict W^X integration before adding executable heap permissions | Selected Linux-arm64 V8 requests RWX; neither `--no-opt` nor `--no-memory-protection-keys` turns this into RW→RX. Keeping W^X requires a V8 write-scope/allocator port or a different supported mechanism. If an entirely unmodified Linux Node binary is mandatory, this conflicts with current strict W^X. | **VH** |
| B1 | Executable-memory lifetime and permission transitions | For a port: NONE→RW→RX and controlled reopening, metadata separation, rejection of simultaneous writable/executable aliases, TLB invalidation, safe page reuse. During writes, other guest threads must not execute affected pages. | **H** |
| B2 | Larger sparse VA region for CodeRange | In the checked uncompressed arm64 build, the default maximum CodeRange is 256 MiB; the isolate normally skips its required CodeRange in jitless mode. Current ring mmap window is only 160 MiB. | **H** |
| B3 | aarch64 instruction-cache coherency | Support the selected toolchain's `__builtin___clear_cache` implementation and user-accessible cache/CTR operations, or provide correct trap handling; instruction visibility must hold after emission, patching and snapshot restore. This is more than a syscall name. | **H** |
| B4 | Background GC/compiler fairness and restore qualification | Start with `--single-threaded`; later enable concurrent work only with correct futex/scheduling behavior. Track executable-page writes in reset/dirty accounting. | **H** |
| B5 | Wasm as a separate milestone | Native Wasm code generation, bounds-check/trap strategy, guards, signal faults and potentially much larger reservations. Initially exclude Wasm; disabling its trap handler reduces VA needs but does not remove Wasm JIT. | **H** |

### C. Additional requirements for an HTTP-calling agent script

These build on A, and can be delivered **before B** using jitless Node. JSON itself needs no special syscall.

| Order / ID | Requirement | Cheapest useful contract | Risk |
|---|---|---|---|
| C0 | Immutable JS/module files | `openat`, `newfstatat`/`fstat` or libc/libuv fallback from `statx`, `read`/`pread64`, `close`, `lseek`, `readlinkat`, `getdents64` as needed. Package modules and `package.json`; defer npm installation and native addons. | **M** |
| C1 | Real asynchronous file/DNS work | Lazy libuv pool with `UV_THREADPOOL_SIZE=1`; correct completion eventfd and main-loop wakeups. Explicit file offsets and shared-open-file-description semantics matter. | **M–H** |
| C2 | Host-backed Linux socket objects | `socket`, nonblocking `connect`, `getsockopt(SO_ERROR)`, `setsockopt`, `getsockname`/`getpeername`, read/write/writev and selected send/recv variants, `shutdown`, close, fcntl and epoll integration. Return EINPROGRESS/EAGAIN/EOF/reset faithfully; support short writes and backpressure. | **H** |
| C3 | DNS | Normal `dns.lookup`/HTTP uses libc `getaddrinfo` in libuv's pool; provide `/etc/hosts`, `/etc/resolv.conf`, and needed UDP/TCP resolution or a faithful broker. `dns.resolve*` uses c-ares instead. Numeric addresses/custom lookup can narrow a deliberately restricted first script. | **H** |
| C4 | HTTPS and wall clock | Bundled OpenSSL handles TLS in userspace; supply cryptographic entropy, trustworthy time and CA roots (bundled Node roots or explicit files). Close/reset all connections and state with appropriate run ownership. | **H** |
| C5 | Timer and cancellation behavior | `clock_gettime` + epoll deadlines; nanosleep/clock_nanosleep or ppoll as libc/workload needs. Test DNS failure, connect timeout, abort, refused connections, partial I/O and peer close. No timerfd prerequisite. | **M–H** |
| C6 | Writable fs only if workload demands it | `pwrite64`/write, `mkdirat`, `unlinkat`, `renameat*`, `ftruncate`, `fsync`/`fdatasync`, permissions/cwd/quota and reset histories. Keep read-only inputs for the first agent workload. | **H** |
| C7 | Snapshot external-state boundary | Checkpoint before opening network connections; after restore assign fresh host handles/run generation, refresh time and randomness, recreate epoll registrations where needed, discard old DNS/TLS/request state. Guest RAM rollback cannot roll back an HTTP side effect. | **H** |

**Defer [I]:** fork/exec/wait, servers/accept, inotify, io_uring, signalfd, timerfd, robust-mutex recovery beyond the chosen contract, native addons, worker_threads and inspector transport. Deferring child processes does **not** defer `clone` for pthreads.

## 1. Startup and representative syscall requirements

### 1.1 What published traces establish

**[V] A first-hand published aarch64 trace exists.** Sasaki Hasuto's February 2026 experiment includes an empty script and synchronous/asynchronous file reads. Library paths identify aarch64 glibc, but the post does not establish the exact Node version. Its baseline lists:

`openat statx mmap munmap mprotect read futex close rt_sigaction fstat clone fcntl getpid capget ioctl getuid getgid rt_sigprocmask geteuid getegid brk madvise set_tid_address set_robust_list rseq pipe2 prlimit64 epoll_ctl write eventfd2 epoll_create1 prctl epoll_pwait getrandom io_uring_setup clone3 getcwd faccessat readlinkat sched_getaffinity gettid execve`.

**[U] This is neither a Node-24 allowlist nor a complete all-thread inventory:** the baseline statistics use `strace -c` without `-f`; later examples follow threads but filter calls. `clone3` and `io_uring_setup` fail in that baseline, demonstrating why “observed” and “required successful implementation” differ. The async example exposes worker-thread file operations and futex/event-loop coordination. [Published experiment][T1]

**[V] Another useful implementation precedent is Nanos:** its developer documents getting Node 18 to run in a one-process unikernel, with libc-version-sensitive `clone3` and `brk` behavior. It supports the feasibility of a restricted Linux ABI, not a claim that Sofort only needs those two calls. [Nanos porting report][T2]

**[I] Qualification matrix, on a separate authorized Linux machine later:** pin binary hash, libc/toolchain, bundled libuv/V8 versions, argv/env, CPU/page size and files; collect all-thread startup and steady-state calls separately for (a) literal jitless hello, (b) reduced flags, (c) sync/async file read, (d) JSON+timers, (e) HTTP, (f) HTTPS+DNS, then (g) JIT. Exercise failure fallbacks, not just successful traces. No such tracing was done here.

### 1.2 The libuv backend

**[V] Networking is nonblocking readiness-driven; ordinary filesystem work uses the thread pool.** Async fs, `getaddrinfo`/`getnameinfo`, selected crypto and compression operations use worker execution. Work submission can lazily create the entire configured pool. [Design][L6], [Thread pool][L1]

- **[V] epoll:** the checked Linux backend creates epoll instances and waits with `epoll_pwait`. aarch64's generic syscall ABI should guide implementation; do not copy x86-only syscall spellings such as `arch_prctl` or assume `epoll_wait` is the syscall Node will issue. `epoll_pwait2` is not necessary for this checked backend. [Linux implementation][L5]
- **[V] eventfd:** Linux `uv_async` directly uses a nonblocking CLOEXEC eventfd. The other-platform pipe fallback is not a reason to return ENOSYS for Linux eventfd and expect startup to continue. [Async implementation][L2]
- **[V] pipes/signals:** libuv uses a pipe for signal serialization and per-loop notification, plus `sigaction`/pthread signal masks. It does not normally use Linux signalfd. `pipe2` remains useful even with child_process excluded. [Signal implementation][L3]
- **[V] timers:** libuv maintains timer deadlines in a userspace heap and calculates the next poll timeout. Ordinary `setTimeout`/`setInterval` do not imply timerfd_create/settime. Correct clocks and blocking deadlines are required. [Timer implementation][L4]
- **[V] io_uring:** libuv 1.45 introduced filesystem io_uring; 1.49 reverted the default filesystem behavior to the threadpool with opt-in SQPOLL. [Loop API][L7] Node 22.0 bundled 1.48, while checked Node 24.22.1 bundles 1.52.1, so major-version-only assumptions are unsafe. [22 libuv version][L8], [24 version][L9]

**[V] Important disable detail:** in 24.22.1's Linux backend, `UV_USE_IO_URING=0` controls SQPOLL selection, whereas the non-SQPOLL epoll-control optimization may still attempt setup. Setup failure falls back. **[I]** Keep all io_uring syscalls unsupported initially and return ENOSYS at setup; do not needlessly implement ring mapping/opcodes to run this workload. [Backend selection and failure path][L5]

### 1.3 libc, probes, and files

**[V] musl does not remove pthreads:** its `pthread_create` maps stacks with guards, applies mprotect, and invokes clone with shared-process flags, TLS and clear-child-TID behavior. [musl pthread implementation][C1] **[I]** A fully static musl binary is attractive because it removes the ELF interpreter, shared-library lookup and much glibc/NSS variability, not because it has a tiny universal syscall set.

**[V] Recent glibc can try clone3 and fall back to clone on ENOSYS; other errors are not interchangeable.** Build configuration can assume clone3 support, so pin libc as well. [glibc clone wrapper][C2] Glibc TLS initialization registers robust lists and rseq; its source handles failed/disabled rseq registration. [TLS initialization][C3] **[I]** `rseq = ENOSYS` is preferable to implementing restartable sequences initially. If ever supported, preemption/migration/restart semantics must be real. No aarch64 `arch_prctl` requirement exists: preserve the thread pointer register instead.

**[V] `/proc/self/maps` is read by V8 Linux mapping-gap and shared-library introspection helpers, with failure paths when opening fails.** This is not proof every Node invocation requires it to succeed. [Linux V8 platform][V6] **[I]** Defer full procfs; provide a coherent generated maps view only if the chosen code path requires it. Static canned mappings would become wrong after mmap/mprotect.

**[V/I] Other proc/system probes:** libuv reads memory/cgroup/uptime/CPU information for sizing and APIs; some memory/uptime paths have syscall fallbacks. Missing cgroup files can indicate no cgroup limit. Return actual guest memory via sysinfo and a one-CPU affinity mask, and supply conservative HWCAP/HWCAP2 in auxv. V8's ARM feature detection uses auxv or proc fallback depending on libc/build. [CPU detection][V7] Optional `prctl` naming does not imply seccomp/namespace support.

**[V] Node initializes many signal dispositions and checks results.** Current Sofort's always-ENOSYS signal handlers cannot be retained for unmodified Node startup. [Node process initialization][N8] **[I]** A narrow no-external-signal test may first store/query dispositions without injecting signals, but that must not be represented as complete delivery support.

**[I/U] `membarrier`:** no mandatory call was found in the checked V8 Linux platform/cache paths. Start unsupported, verify the actual binary's fallback; a hypothetical runtime/native addon using it changes scope. `getrandom` should succeed for normal Node/OpenSSL entropy, with `/dev/urandom` as a libc/crypto-dependent fallback. A vDSO is an optimization: omit AT_SYSINFO_EHDR rather than advertise a nonexistent one, and implement the clock syscall fallback. Coarse-clock probing may need EINVAL plus verified fallback or actual support.

### 1.4 Memory semantics and current repository mismatch

**[V] V8 POSIX allocation translates inaccessible reservations to `PROT_NONE` and uses `MAP_NORESERVE`, later changing protections and discarding pages. `DiscardSystemPages` on Linux uses `MADV_DONTNEED` and checks success.** [Allocator][V2] **[I]** The guest needs VMA reservations distinct from backed pages. Reserve sparse intervals, allocate backing at commit/fault, preserve guard holes, and enforce budgets on physical commitment. `MAP_NORESERVE` must not bypass Sofort's own resource limits.

**[V] Conditional reservation sizes:** pointer compression uses a 4 GiB aligned cage. [Pointer compression][V8] V8 sandbox configurations normally target a 1 TiB region with guard areas; the checked header diagrams 32 GiB guards on either side, while constants/build revisions can add further guards. A partially reserved fallback has weaker isolation properties. [Sandbox header][V9], [Sandbox constants][V10] These are virtual reservations, not 1 TiB RAM requirements. Node's selected default configurations disable both features; distro/custom engines must be checked individually.

**[V] CodeRange is a different reservation.** In the checked arm64 defaults it is 256 MiB when required, even without pointer compression. `RequiresCodeRange()` excludes jitless mode; explicit embedder constraints may still request one. [Constants][V11], [Isolate requirement][V12], [Heap setup][V13]

**[R] Concrete local constraints:**

- `kernel/packer.ts` admits static ELF only, rejects PT_DYNAMIC/PT_INTERP and W+X segments, bounds the load image below `IMAGE_END = 0x1880000`, and permits at most sixteen program headers. The available loaded span from `0x400000` is about 20.5 MiB. A current Node binary needs image-layout work; release file size alone does not determine its loaded extent.
- `src/memory.rs` caps console user VA at `0x2400000`; ring user VA ends at `0xc000000`. Ring mmap starts at `0x2000000`, leaving 160 MiB. Stage-1 TCR currently uses T0SZ=25 (39-bit VA), so a future full 1 TiB sandbox would additionally require wider page-table/VA support.
- `src/syscalls/mmap.rs` accepts only null-address, RW, anonymous, non-MAP_FIXED mappings. `heap.rs` immediately backs allocations. That rejects inaccessible reservations and pthread stack guards.
- `src/user.rs` asserts W^X and creates an environment containing only PATH. Its access checks and fixed stack/image layout would need to follow a larger sparse VMA model.
- `rt_sigaction.rs` and `rt_sigprocmask.rs` explicitly return ENOSYS; `set_tid_address.rs` returns constant 1. There are no canonical clone/futex/epoll/mprotect handlers in the inspected source directory. `fcntl.rs` only supports CLOEXEC flags.
- `generate.ts` turns a named slot whose handler source is absent into ENOSYS. Thus slots for `getrandom`, `madvise`, `sched_getaffinity` or sysinfo do not establish successful implementations. Experimental files under `grow/phase2-grown/` are separate artifacts.

**[I] Implication:** first design memory/thread/fd primitives with checked ownership and reset behavior, then let GrowOS grow handlers over those primitives. A collection of individually returning-success stubs cannot supply these interacting contracts. This agrees with the distinction between console growth evidence and shipping-profile qualification in the existing GrowOS fit summary.

## 2. JIT, Wasm and strict W^X

### 2.1 Jitless is the correct first milestone

**[V] V8 jitless uses its bytecode interpreter and interpreted regular expressions.** Compiled-in builtins remain native code. [Jitless announcement][V1] The checked flags disable relevant compiler tiers and regexp compilation; Wasm interpreter support is conditional on `V8_ENABLE_DRUMBRAKE`. [Flags][V5] **[I/U]** Initially treat WebAssembly as unavailable under the qualified jitless Node profile; do not promise DrumBrake merely because upstream V8 contains it. A newer custom build enabling it needs separate qualification.

**[V] `--disable-wasm-trap-handler` changes Wasm bounds checks, not JS JIT permissions.** The checked CLI describes typically 8 GiB VA cages for wasm32 memory and 16 GiB for wasm64, with fallback improvements in later 24.x. **[I]** Disable it for initial bring-up to avoid unnecessary trap handling/probes; if Wasm is later admitted, validate explicit bounds checks and smaller reservations independently. [CLI][N7]

### 2.2 Do these V8 versions ever use RWX?

**[V] Yes, on the Linux-arm64 configurations examined.** Node 22.23.4's `mutable-page.h` returns RWX code-modification permission without the Apple protection mechanism unless jitless; Node 24.22.1's `mutable-page-metadata.h` similarly chooses RWX for non-jitless execution. The POSIX allocator translates this into PROT_READ|PROT_WRITE|PROT_EXEC. [22][V3], [24][V4], [Permission translation][V2]

**[V] On this platform, the default fallback `RwxMemoryWriteScope` has empty SetWritable/SetExecutable methods.** Fast protection is compiled for supported Apple platforms or Linux x64 PKU; the checked build gates PKU on Linux x64, not arm64. [Write-scope implementation][V14], [Platform gates][V15] **[I]** An aarch64 W^X kernel will reject the requested RWX mappings. Silently accepting the request as RX would then fault on code emission; accepting it as RW would fault on execution.

**[V] Neither checked 22.23.4 nor 24.22.1 `flag-definitions.h` contains `write_protect_code_memory`.** [22 flags][V16], [24 flags][V5] **[I]** Old advice to pass `--write-protect-code-memory` is not a solution for the selected releases. `--no-opt`, disabling individual tiers, or `--single-threaded` still allows executable-memory allocation. `--jitless` is the verified available flag avoiding runtime executable allocation. Disabling memory-protection keys does not create an mprotect-based W^X backend.

### 2.3 Options compatible with Sofort's security contract

**[I] Preferred:** keep strict W^X and jitless until a real workload needs JIT throughput. A later port could replace the fallback write scopes with coordinated permission transitions and separate metadata from executable pages. The port must cover JS code, builtin copying, Wasm, patching, relocations and page reuse; a global RW→RX toggle while other threads execute is unsafe. Single-threaded V8 work simplifies coordination but Node still has OS threads.

**[I] Alternatives with different contracts:** dual aliases can keep each virtual mapping individually W^X while leaving the same physical code writable and executable through different addresses; that violates a stronger physical-page W^X invariant. Accepting ordinary RWX would relax the stated kernel policy. Neither should be slipped in as a syscall compatibility fix. A custom V8 build also ends the “unmodified Node binary” claim, even if JS remains unmodified.

### 2.4 What restricted hosts actually demonstrate

| Host | Verified mechanism | Relevance to Sofort |
|---|---|---|
| gVisor | Linux ABI implementation, including memory and threading calls; Node is among regression-tested runtimes. [Compatibility][E1], [arm64 syscall table][E2] | **[I]** Demonstrates that a userspace kernel can host Node; not evidence of an all-RWX-denied V8 setup or a tiny syscall requirement. |
| iOS / Apple silicon | Historical V8 iOS guidance mandates jitless (explicitly dated Dec 2020). Newer Apple BrowserEngineKit provides entitled JIT W^X mechanisms; V8 also contains corresponding platform support. [iOS guide][E3], [Apple API][E4], [Write-scope contract][V17] | **[I]** Permission to JIT is platform-specific. Sofort's guest is a Linux ABI on aarch64; macOS hosting via HVF does not expose host MAP_JIT or pthread JIT toggles to guest Linux code. |
| Cloudflare Workers / workerd | Workers combine V8 isolates with process sandboxing, seccomp/namespaces and host-brokered effects. Cloudflare's production sandbox can deny filesystem syscalls; local workerd does not include all those defenses. [Security model][E5] | **[I]** Shows the value of moving I/O behind a host API; it does not eliminate JIT memory support or make workerd a minimal Linux binary. |
| Fuchsia | V8's native Fuchsia port uses Zircon VMOs/VMARs and obtains executable authority through VMEX / `vmo_replace_as_executable`. Its permission conversion includes RWX. [Port][E6], [Executable VMO syscall][E7] | **[I]** Capability-controlled executable memory is a porting model, not proof that stock Linux V8 only requests RW→RX. |

## 3. Threads and one-vCPU scheduling

### 3.1 Source-derived thread budget

**[V] Node's configured V8 platform pool defaults to four.** NodePlatform also starts a delayed-task scheduling thread and creates worker threads during platform setup. [Default option][N9], [Thread creation][N3] Inspector-enabled POSIX Node normally starts a detached signal watchdog to handle SIGUSR1 even without `--inspect`; active inspector transport can add more work/threads. `--disable-sigusr1` avoids the signal-start path in selected recent releases; compiling without inspector removes it more comprehensively. [Inspector][N4]

| Profile | Expected base OS threads, before application-created workers |
|---|---|
| Ordinary selected build, default pools, inspector signal path active | **[I] ~7:** main 1 + V8 workers 4 + delayed scheduler 1 + inspector watchdog 1 |
| Same process after first async fs/getaddrinfo pool operation | **[I] ~11:** above + libuv default 4 |
| `--v8-pool-size=1 --disable-sigusr1` | **[I] ~3:** main + one platform worker + delayed scheduler |
| Above, `UV_THREADPOOL_SIZE=1`, after async fs/DNS | **[I] ~4** |

**[U] Counts vary with build options, worker creation failures, profiling/inspector, dependencies and application behavior.** These are derived budgets, not measurements of the chosen static binaries. Each pool worker reserves stack space; libuv documents 8 MiB stacks since 1.45. Physical RSS is much smaller than the reservation until touched. [Pool documentation][L1]

### 3.2 Flag meanings and the 1–2 thread question

**[V] `--single-threaded` is a V8 flag disabling background tasks and implying single-threaded GC.** Node still constructs its own NodePlatform. `--v8-pool-size=0` selects approximately available parallelism minus one, clamped to at least one worker. Setting `UV_THREADPOOL_SIZE=0` is not a supported way to remove the pool; use 1 and avoid pool-using APIs until ready. [V8 flag definitions][V5], [Node pool implementation][N3]

**[I] One or two total OS threads therefore needs a Node platform/embedder change**, not just flags. A custom foreground-only platform plus synchronous/host-mediated fs/DNS could achieve a narrower runtime, but then it is a maintained port. Merely building `--without-v8-platform` is not evidence of a working zero-thread Node: the embedder still must provide an appropriate V8 platform and Node task semantics.

### 3.3 Can one vCPU run it correctly?

**[I] Yes.** Shared-address-space pthread concurrency does not require simultaneous physical execution. Save/restore GPRs, FP/SIMD, stack, thread pointer, signal mask and thread identity. Implement atomic futex compare-and-sleep/wake, correct absolute/relative timeouts, and thread-exit wakeups; allow another runnable thread to proceed whenever one blocks. Memory-ordering instructions must retain their architectural meaning.

**[I] Cooperative scheduling solely at blocking syscalls is fragile.** Locks can spin in userspace, V8's safepoint/GC handshakes can wait for another thread, and a tenant can remain CPU-bound. A simple round-robin preemptive scheduler driven by a guest timer is a more credible correctness baseline. External vCPU watchdog interruption alone enforces a deadline but does not schedule the other guest thread needed for progress.

**[I] Multi-thread snapshots are feasible on one vCPU** if all thread contexts and scheduler state live in captured guest memory and the current vCPU state is captured at a controlled boundary. Stop at quiescence, with no pending host I/O or external handles. Reset must restore blocked/runnable state and time bases coherently; otherwise a restored futex address or timer deadline can look valid while referring to a different logical run.

## 4. Static builds, SEA, snapshots, RSS and startup

### 4.1 What is published, and what “static” means

| Publisher / route | What sources verify | Caveat |
|---|---|---|
| nodejs.org release binaries | Standard upstream distribution route. | **[I]** Ordinary Linux glibc distribution is not the desired no-interpreter musl artifact; it brings loader/shared-library requirements into a kernel that forbids them. |
| `nodejs/unofficial-builds` arm64-musl | Publishes musl arm64 binaries; documents libstdc++ requirement. [B3] | **[V]** Musl-linked is not synonymous with fully static. Exact dependencies need ELF inspection; do not choose this expecting no PT_INTERP. |
| `yao-pkg/pkg-fetch` | Publishes Node 22/24 `linuxstatic-arm64`; musl toolchain workflows and `--fully-static` configure path, with inspector disabled. [B2], [B4] | **[V/I]** Patched Node for packaging; useful ready artifact/reference, not a clean upstream binary. Compare its patches and startup behavior before using it as the compatibility target. |
| `astefanutti/scratch-node` | Historical multiarch musl-based images, including arm64v8; README lists Node 18-era 18.7 MB compressed / 47.5 MB unpacked image. [B5] | **[V]** Dockerfile uses `--partly-static` and ships a musl loader. Historical image sizes are not current fully static Node24 binary sizes. No image was pulled or run. |
| Self-built upstream Node | `configure.py` supports `--fully-static`, `--partly-static`, inspector and snapshot options. [B6] | **[I]** Best controlled long-term profile, built elsewhere. Pin modern musl/C++ toolchain and all bundled dependencies, retain upstream patches/version provenance. |

**[V] Concrete published static artifact sizes:** the GitHub release asset listing on the research date reports `node-v22.23.4-linuxstatic-arm64` **58.5 MB** and `node-v24.22.1-linuxstatic-arm64` **63.7 MB**, uploaded 2026-10-23. These are GitHub-displayed asset sizes, not RSS, loaded PT_LOAD extent, or a measured stripped self-build. [Release assets][B1] The repository's expected hashes match those asset digests. [Hash manifest][B7]

**[I] Recommended controlled build profile:** fully static musl; no shared libraries/native addon loading; inspector omitted; small-ICU only if its internationalization restrictions are acceptable; keep built-in Node/V8 startup snapshots. Keep bundled TLS and required Web/Node APIs. Do not disable startup snapshots to simplify a cross-build and then silently attribute its different startup cost to Sofort.

**[I/U] Static caveats:** musl's ordinary static execution does not provide general dlopen support; N-API addons are not automatically portable, and packaging tools can carry loader patches. Static PIE can contain dynamic relocation metadata despite no interpreter, which the current packer rejects. A non-PIE static executable is the narrower initial target. Bundling ICU/CA data and locale files affects binary size and behavior. Node's documented official Linux support baseline is not a proof that every newer syscall must succeed; probe fallbacks still matter.

### 4.2 Three kinds of snapshots

1. **[V] V8 startup snapshot:** serialized engine heap/initial context, normally built into Node. It avoids repeating bootstrap initialization; it does not capture arbitrary kernel state. [V8 snapshot explanation][V18]
2. **[V] Node user startup snapshot:** `--build-snapshot` produces a blob, `--snapshot-blob` restores it, with serialize/deserialize hooks. The selected binary checks version/platform/architecture and compatible V8 flags/CPU features. A script can register its deserialize entry point. [CLI][N7], [API][N6]
3. **[R/I] Sofort hardware-VM snapshot:** captures initialized guest memory and machine/kernel state, potentially including the live Node runtime. This is the layer that can avoid repeating libc startup, pthread creation and V8 deserialization on every job. It needs qualification of new thread/fd/memory state rather than a different JS heap file format.

**[V] SEA** embeds application preparation data into a Node executable and optionally uses startup snapshots/code cache. Cross-platform SEA generation cannot simply reuse those caches/snapshots; selected docs require disabling them for such generation. [SEA documentation][N5] **[I]** SEA can reduce module-file distribution, but it neither statically links libc by itself nor removes epoll/pthread/mmap requirements. Bundle application dependencies offline; snapshot-compatible initialization still has restrictions. Do not snapshot an active HTTP exchange or arbitrary native resource and assume it serializes.

**[I] Suggested VM checkpoint:** load bundled code and immutable data, finish deterministic initialization, let background tasks quiesce, then park at an explicit guest checkpoint before per-run input/effects. Reinitialize per-run entropy, time offsets, deadlines and external-handle generations. Restoring userspace OpenSSL DRBG or V8 random state can replay it even if later `getrandom` calls return fresh bytes. Kernel RNG reseeding alone does not fix already-captured userspace state. Reseed/recreate it before use, or checkpoint before creation. TLS session caches and identifiers need the same analysis.

### 4.3 Memory and time: evidence versus planning assumptions

| Quantity | Evidence | What may be concluded |
|---|---|---|
| Linux idle-like Node memory | **[V]** Node issue #44332 reports Node18.7.0 Linux RSS 40,235,008 bytes (~38.4 MiB) from a tiny memory-query invocation. Architecture is not established there. [M1] | This is an older contextual point, not Node22/24 aarch64 `node -e 0`. |
| Contemporary Node startup | **[V]** Node performance issue #180 reports warm Node22 semicolon-script startup 27.5 ms on one macOS machine; another report in the thread gives 16.4 ms. Linux observations differ. [M2] | Hardware, OS, global initialization and build affect results substantially. Neither number is Linux-arm64 static-musl jitless startup. |
| Effect of built-in snapshots | **[V]** Joyee Cheung's Node Congress talk describes approximately 40→20 ms on her MacBook. [M3] | A real bootstrap optimization, not a universal latency guarantee. |
| V8 context restoration | **[V]** Historical V8 article gives 40→<2 ms for context creation on a desktop. [V18] | Context creation only; not Node process startup or VM reset. |
| Exact requested baseline | **[U]** No matched published Node22/24 aarch64 static-musl `node -e 0` RSS/startup measurement was qualified in this research. | Must remain an explicit evidence gap. |

**[I] Initial engineering budget:** provision a new experimental memory class with roughly **128–256 MiB physical headroom** for bring-up, then shrink using actual committed/dirty pages. This is a conservative starting allocation, not a measured minimum or a performance forecast. Do not equate V8 heap limits, binary size, virtual reservations, host RSS, guest physical memory and per-reset copied bytes.

**[I] Economics of the target:** even a tens-of-milliseconds process startup is compatible with an inexpensive warmed checkpoint, but the new dirty working set can dominate reset cost. Measure restore-to-first-instruction, request latency and reset-to-reusable separately on the qualified future platform, with shared immutable pages and total fleet memory accounted consistently. No microsecond-to-millisecond Node reset result is established by this desk research.

## 5. Smaller alternatives and the cheapest decision

| Runtime | Verified upstream properties | Inferred Stage 2 cost relative to full Node |
|---|---|---|
| Deno | V8/Rust embedding; current-thread Tokio helper still has blocking-task facilities. Node compatibility is a separate implementation. [D1], [D2] | **[I] H:** V8 virtual/executable-memory requirements remain; Tokio/Mio still need polling, sockets, clocks and threading. A single-thread async scheduler does not mean a one-thread executable. A custom `deno_core` embedder could narrow APIs but is a different runtime target. |
| Bun | JavaScriptCore engine, Node-compatible API goal, Linux arm64 and musl distributions. [D3], [D4] | **[I] H:** switches engine, not OS complexity; JSC JIT/GC, fd polling, network and pool behavior still need support. Older reports describe mandatory io_uring in some paths, but that cannot establish current universal requirements. No qualified current Bun syscall inventory or verified global io_uring-disable flag was found; do not select it on the assumption it is a simpler kernel port. |
| LLRT (AWS) | QuickJS-based Rust runtime, deliberately partial Node API compatibility, arm64 musl targets. Current matrix includes partial fs/streams/timers/net and fetch-oriented use, but node:http/https/tls are not complete replacements. [D5], [D6] | **[I] M–H as a whole binary; L–M as a design reference:** avoids V8 JIT/cages, but stock CLI uses Tokio and can create threads; network/TLS/fs still need kernel support. A selected Node-like API layer over Sofort's existing QuickJS avoids much of that port. |
| txiki.js | QuickJS-ng + libuv, Web/WinterTC-oriented runtime with file I/O, TCP/UDP, HTTP and additional APIs. [D7] | **[I] M:** smaller engine and no JS JIT, but libuv epoll/eventfd/pthread and TLS/network work remain. It is not a promised drop-in Node implementation. Good source/reference for a small evented runtime. |
| workerd | V8-based service runtime, Linux/macOS arm64 support; current prebuilt Linux requirement includes glibc 2.35+. Local runtime needs an external security sandbox for hostile code. [D8] | **[I] H:** embeds substantial C++/KJ/Cap'n Proto/service machinery; Node compatibility is selective. Useful effect-brokering architecture, not a cheaper first static Linux guest. |
| Hermes | Mobile-oriented engine with compact bytecode and ahead-of-time optimization; Linux/macOS CLI build paths. [D9] | **[I] M–H:** an interpreter/bytecode configuration avoids V8 JIT problems, but no complete Node fs/http/module ecosystem comes with the engine. Its smaller-engine benefit does not pay for recreating Node APIs by itself. Pin engine configuration rather than assuming every future Hermes build has identical JIT behavior. |

**[V] LLRT's startup/cost headline is an AWS Lambda workload comparison, not a Sofort VM-reset result.** Its own documentation emphasizes partial API coverage and slower behavior on heavy computation. [LLRT limitations][D5] **[I]** It is a closer match to JSON + fetch + service orchestration than replacing V8 inside Node: Node has deep V8 bindings, so swapping engines is not a small build option.

**[I] Recommended product split:** preserve a small QuickJS profile with a stated API contract (`console`, Buffer/encoding, URL, timers, promises, JSON, narrow read-only fs and host-mediated fetch). Bundle and qualify the intended agent scripts against that contract. This is a cheaper *useful-script* milestone; it does not satisfy a literal full-Node compatibility objective. Independently grow an upstream Node24 static-musl profile when npm/Node semantics actually matter. Keep child_process, native addons and general OS access outside that initial contract.

**[I] Final implementation order, with risk tags:**

1. **A0–A2 [H/M]:** larger static image and memory class, sparse VMA reservations, non-executable protection changes and discard semantics.
2. **A3–A5 [H]:** real pthread/TLS/futex scheduling and signal state; one vCPU with timer preemption.
3. **A6–A10 [H/M]:** pollable fd objects, epoll/eventfd/pipes, stdio, entropy/time/probes and explicit optional-call fallbacks; prove literal jitless hello.
4. **A11 [H]:** quiescent Node checkpoint and whole-kernel/thread/fd reset, including userspace entropy state.
5. **C0–C7 [M/H]:** read-only module bundle, one libuv fs/DNS worker, brokered nonblocking sockets, DNS, HTTPS and timer cancellation; prove the actual agent script while jitless.
6. **B0–B5 [VH/H]:** only after workload evidence justifies it, port V8's executable-memory backend for strict W^X, provide arm64 cache coherency and larger CodeRange, then qualify JIT and Wasm separately. There is no verified flags-only strict-W^X JIT route for the selected stock Linux-arm64 Node binaries.

## Sources and URLs

All web sources were read on 2026-10-31. Versioned Node links are preferred over moving HEAD. Moving alternative-runtime and packaging sources describe the observed repository state, not a forever-stable distribution guarantee. Published experiments are first-hand contextual observations; source code establishes code paths, not execution coverage under Sofort.

### Repository evidence

- [jitk README](../../jitk/README.md), [architecture](../../jitk/docs/ARCHITECTURE.md), [GrowOS fit summary](../growos-fit/SUMMARY.md).
- [ELF packer](../../jitk/kernel/packer.ts), [prepare](../../jitk/kernel/prepare.ts), [handler generator](../../jitk/kernel/generate.ts), [slots](../../jitk/kernel/slots.json), [aarch64 syscall names/numbers](../../jitk/kernel/src/arch/aarch64/syscalls.json).
- [user entry/access](../../jitk/kernel/src/user.rs), [memory layout](../../jitk/kernel/src/memory.rs), [ring MMU](../../jitk/kernel/src/arch/aarch64/mmu_ring.rs), [heap](../../jitk/kernel/src/heap.rs), [filesystem](../../jitk/kernel/src/fs.rs).
- [mmap](../../jitk/kernel/src/syscalls/mmap.rs), [fcntl](../../jitk/kernel/src/syscalls/fcntl.rs), [signal action](../../jitk/kernel/src/syscalls/rt_sigaction.rs), [signal mask](../../jitk/kernel/src/syscalls/rt_sigprocmask.rs), [set_tid_address](../../jitk/kernel/src/syscalls/set_tid_address.rs), [clock](../../jitk/kernel/src/syscalls/clock_gettime.rs).

### Node, V8, libuv and libc primary sources

- [N0 — Node release schedule][N0]
- [N1 — Node22.23.4 build configuration][N1]; [N2 — Node24.22.1 build configuration][N2]
- [N3 — Node platform threads/pool sizing][N3]; [N4 — inspector/watchdog implementation][N4]
- [N5 — SEA documentation][N5]; [N6 — startup snapshot API][N6]; [N7 — selected-version CLI][N7]
- [N8 — Node process initialization/signals][N8]; [N9 — default Node platform pool option][N9]
- [V1 — V8 JIT-less mode][V1]; [V2 — selected V8 POSIX allocator][V2]
- [V3 — Node22 V8 mutable-page code permissions][V3]; [V4 — Node24 V8 mutable-page code permissions][V4]
- [V5 — Node24 V8 flag definitions][V5]; [V16 — Node22 V8 flag definitions][V16]
- [V6 — V8 Linux maps parsing][V6]; [V7 — V8 CPU feature detection][V7]; [V8 — pointer compression][V8]
- [V9 — sandbox layout/fallback][V9]; [V10 — sandbox constants][V10]; [V11 — CodeRange constants][V11]; [V12 — jitless CodeRange exclusion][V12]; [V13 — heap CodeRange setup][V13]
- [V14 — code write scopes][V14]; [V15 — platform protection gates][V15]; [V17 — code memory access contract][V17]; [V18 — V8 startup snapshots][V18]; [V19 — arm64 instruction-cache handling][V19]
- [L1 — libuv thread pool][L1]; [L2 — async/eventfd implementation][L2]; [L3 — signal/pipe implementation][L3]; [L4 — timers][L4]; [L5 — selected Linux backend][L5]; [L6 — design overview][L6]; [L7 — loop/io_uring opt-in][L7]; [L8 — original Node22 libuv version][L8]; [L9 — selected Node24 libuv version][L9]
- [L10 — TCP implementation][L10]; [L11 — filesystem implementation][L11]
- [C1 — musl pthread_create][C1]; [C2 — glibc clone fallback][C2]; [C3 — glibc TLS/rseq/robust-list setup][C3]

### Published observations, artifacts and restricted-host precedents

- [T1 — Sasaki Hasuto's aarch64 syscall experiments][T1]; [T2 — Nanos developer's Node18 porting report][T2]
- [B1 — pkg-fetch release asset listing][B1]; [B2 — pkg-fetch configure flags][B2]; [B3 — Node unofficial-builds][B3]; [B4 — static-musl workflows][B4]; [B5 — historical scratch-node][B5]; [B6 — upstream configure options][B6]; [B7 — pkg-fetch expected hashes][B7]
- [M1 — Node Linux RSS observation][M1]; [M2 — Node startup benchmark discussion][M2]; [M3 — Joyee Cheung startup-snapshot talk][M3]
- [E1 — gVisor application compatibility][E1]; [E2 — gVisor arm64 syscall table][E2]; [E3 — historical V8 iOS guidance][E3]; [E4 — Apple BrowserEngineKit JIT protection][E4]; [E5 — Cloudflare production security model][E5]; [E6 — V8 Fuchsia allocator][E6]; [E7 — Fuchsia executable VMO API][E7]

### Alternative runtime primary sources

- [D1 — Deno current-thread Tokio helper][D1]; [D2 — rusty_v8][D2]
- [D3 — Bun project/engine][D3]; [D4 — Bun installation/targets][D4]
- [D5 — LLRT scope, compatibility, performance claims and limitations][D5]; [D6 — LLRT musl target/build definitions][D6]; [D10 — LLRT CLI Tokio entry][D10]
- [D7 — txiki.js project/API scope][D7]; [D8 — workerd project/platform/runtime scope][D8]; [D9 — Hermes engine][D9]

[N0]: https://github.com/nodejs/Release/blob/main/schedule.json
[N1]: https://github.com/nodejs/node/blob/v22.23.4/common.gypi
[N2]: https://github.com/nodejs/node/blob/v24.22.1/common.gypi
[N3]: https://github.com/nodejs/node/blob/v24.22.1/src/node_platform.cc
[N4]: https://github.com/nodejs/node/blob/v24.22.1/src/inspector_agent.cc
[N5]: https://github.com/nodejs/node/blob/v24.22.1/doc/api/single-executable-applications.md
[N6]: https://github.com/nodejs/node/blob/v24.22.1/doc/api/v8.md
[N7]: https://github.com/nodejs/node/blob/v24.22.1/doc/api/cli.md
[N8]: https://github.com/nodejs/node/blob/v24.22.1/src/node.cc
[N9]: https://github.com/nodejs/node/blob/v24.22.1/src/node_options.h
[V1]: https://v8.dev/blog/jitless
[V2]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/base/platform/platform-posix.cc
[V3]: https://github.com/nodejs/node/blob/v22.23.4/deps/v8/src/heap/mutable-page.h
[V4]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/heap/mutable-page-metadata.h
[V5]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/flags/flag-definitions.h
[V6]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/base/platform/platform-linux.cc
[V7]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/base/cpu.cc
[V8]: https://v8.dev/blog/pointer-compression
[V9]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/sandbox/sandbox.h
[V10]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/include/v8-internal.h
[V11]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/common/globals.h
[V12]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/execution/isolate.cc
[V13]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/heap/heap.cc
[V14]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/common/code-memory-access-inl.h
[V15]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/base/build_config.h
[V16]: https://github.com/nodejs/node/blob/v22.23.4/deps/v8/src/flags/flag-definitions.h
[V17]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/common/code-memory-access.h
[V18]: https://v8.dev/blog/custom-startup-snapshots
[V19]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/codegen/arm64/cpu-arm64.cc
[L1]: https://docs.libuv.org/en/v1.x/threadpool.html
[L2]: https://github.com/nodejs/node/blob/v24.22.1/deps/uv/src/unix/async.c
[L3]: https://github.com/nodejs/node/blob/v24.22.1/deps/uv/src/unix/signal.c
[L4]: https://github.com/nodejs/node/blob/v24.22.1/deps/uv/src/timer.c
[L5]: https://github.com/nodejs/node/blob/v24.22.1/deps/uv/src/unix/linux.c
[L6]: https://docs.libuv.org/en/v1.x/design.html
[L7]: https://docs.libuv.org/en/v1.x/loop.html
[L8]: https://github.com/nodejs/node/blob/v22.0.0/deps/uv/include/uv/version.h
[L9]: https://github.com/nodejs/node/blob/v24.22.1/deps/uv/include/uv/version.h
[L10]: https://github.com/nodejs/node/blob/v24.22.1/deps/uv/src/unix/tcp.c
[L11]: https://github.com/nodejs/node/blob/v24.22.1/deps/uv/src/unix/fs.c
[C1]: https://git.musl-libc.org/cgit/musl/tree/src/thread/pthread_create.c
[C2]: https://github.com/bminor/glibc/blob/release/2.39/master/sysdeps/unix/sysv/linux/clone-internal.c
[C3]: https://github.com/bminor/glibc/blob/master/sysdeps/nptl/dl-tls_init_tp.c
[T1]: https://dev.classmethod.jp/articles/nodejs-async-deep-dive-with-syscalls/
[T2]: https://richiejp.com/nanos-clone3-brk-and-nodejs
[B1]: https://github.com/yao-pkg/pkg-fetch/releases/expanded_assets/v3.6
[B2]: https://github.com/yao-pkg/pkg-fetch/blob/master/lib/build.ts
[B3]: https://github.com/nodejs/unofficial-builds
[B4]: https://github.com/yao-pkg/pkg-fetch/blob/master/.github/workflows/build-linuxstatic.yml
[B5]: https://github.com/astefanutti/scratch-node
[B6]: https://github.com/nodejs/node/blob/v24.22.1/configure.py
[B7]: https://github.com/yao-pkg/pkg-fetch/blob/master/lib/expected-shas.json
[M1]: https://github.com/nodejs/node/issues/44332
[M2]: https://github.com/nodejs/performance/issues/180
[M3]: https://gitnation.com/contents/nodejs-startup-snapshots
[E1]: https://gvisor.dev/docs/user_guide/compatibility/
[E2]: https://gvisor.dev/docs/user_guide/compatibility/linux/arm64/
[E3]: https://v8.dev/docs/cross-compile-ios
[E4]: https://developer.apple.com/documentation/browserenginekit/protecting-code-compiled-just-in-time
[E5]: https://developers.cloudflare.com/workers/reference/security-model/
[E6]: https://github.com/nodejs/node/blob/v24.22.1/deps/v8/src/base/platform/platform-fuchsia.cc
[E7]: https://fuchsia.dev/reference/syscalls/vmo_replace_as_executable
[D1]: https://github.com/denoland/deno/blob/main/runtime/tokio_util.rs
[D2]: https://github.com/denoland/rusty_v8
[D3]: https://github.com/oven-sh/bun
[D4]: https://bun.com/docs/installation
[D5]: https://github.com/awslabs/llrt
[D6]: https://github.com/awslabs/llrt/blob/main/Makefile
[D7]: https://github.com/saghul/txiki.js
[D8]: https://github.com/cloudflare/workerd
[D9]: https://github.com/facebook/hermes
[D10]: https://github.com/awslabs/llrt/blob/main/llrt/src/main.rs
