# Go / Rust / C static binaries on jitk

Method note: Docker was NOT available (`docker info` failed), so nothing below is measured. Every syscall list is INFERRED from runtime source and prior strace experience (arm64 numbers not verified). Sources, read from memory and not re-fetched this session: Go `src/runtime/os_linux.go`, `sys_linux_arm64.s`, `signal_unix.go`, `proc.go` (sysmon, newm); Rust `library/std/src/sys/pal/unix/{mod,thread,stack_overflow}.rs`; musl `src/env/__libc_start_main.c`, `src/thread/pthread_create.c`; Linux arm64 syscall table. First action for any follow-up: run `strace -f -c` in an arm64 container to confirm.

## 1. Go (linux/arm64, static)

Startup, INFERRED: `rt_sigprocmask`, `sched_getaffinity`, `openat("/sys/kernel/mm/transparent_hugepage/hpage_pmd_size")` + `read` + `close` (a failed open is tolerated), several `mmap` calls (PROT_NONE reservations for arenas, 64 MiB-class and larger), `mmap` hints at fixed addresses (0xc000000000), `munmap`, `sigaltstack`, a loop of about 65 `rt_sigaction` calls (every signal, with SA_ONSTACK|SA_SIGINFO|SA_RESTORER), `gettid`, `clone` (CLONE_VM|FS|FILES|SIGHAND|SYSVSEM|THREAD) for sysmon, then more clones for template/GC-worker Ms, `futex` (WAIT/WAKE with PRIVATE), `epoll_create1`, `eventfd2` or `pipe2`, `epoll_ctl` (netpoll init, lazy since 1.1x), `readlinkat("/proc/self/exe")`, `getrandom`/AT_RANDOM, `prctl(PR_SET_VMA_ANON_NAME)` on newer versions (ignorable).

Steady state, INFERRED: `futex` sleep/wake, `nanosleep` or `clock_nanosleep` (sysmon usleep 20us up to 10ms), `sched_yield`, `tgkill` + `rt_sigreturn` (SIGURG async preemption, sent by sysmon to the running M), `madvise(MADV_DONTNEED/FREE/COLLAPSE)` from the scavenger, more `mmap`/`munmap`, `write` to fd 1/2, `clock_gettime` (vDSO normally, falls back to the syscall if no vDSO), `exit_group`.

Can we avoid threads? Not fully. `GOMAXPROCS=1` only limits Ps. `sysmon` is started via `newm` in `runtime.main` with no P, so a `clone` always happens, and it is needed for preemption of tight loops and netpoll. Blocking syscalls and cgo/`LockOSThread` spawn extra Ms. No GODEBUG disables sysmon. `GODEBUG=asyncpreemptoff=1` removes SIGURG preemption only. Realistic approach: implement `clone(CLONE_THREAD)` as a real kernel thread.

Kernel features needed (INFERRED):
- Task struct, per-thread TPIDR_EL0 (Go uses it for TLS g), `CLONE_CHILD_CLEARTID`/`set_tid_address` (already stubbed), `gettid`, `exit` per thread vs `exit_group`.
- A cooperative-plus-timer scheduler on 1 vCPU. Preempt on the generic timer (CNTP), since sysmon needs to run while the main M is spinning.
- `futex` WAIT/WAKE (private only, about 100 LOC with a waitqueue), `nanosleep` and `clock_nanosleep` with timer wakeups, `sched_yield`, `sched_getaffinity` (return 1 CPU).
- Signals: sigaction table, a sigframe on the alt stack or user stack with ucontext and siginfo, `rt_sigreturn`, `tgkill`/`tkill`/`kill`, a pending mask, and `sigaltstack`. A SIGSEGV-to-user-handler path is needed because Go's nil-check and stack-growth faults use it. Faults from EL0 need to be delivered as SIGSEGV.
- `epoll_*`/`eventfd`/`pipe2` can be tiny fakes. Netpoll only needs to initialize, and Go tolerates epoll failure only at init in some versions, so fake it.
- `madvise` as a no-op, `mmap` with MAP_FIXED, MAP_NORESERVE and PROT_NONE reservations. Go reserves large virtual ranges, so the kernel needs lazy demand paging with a virtual address space far above 32 MiB of physical RAM. Currently mmap probably is a bump allocator and would fail. This is the big hidden cost.
- The Go heap arena (about 4 MiB chunks plus metadata) and goroutine stacks put the floor at roughly 8-15 MiB RSS for hello world. Fits in 32 MiB but is tight for real programs.

Effort: threads/scheduler about 600-900 LOC, signals about 400-600 LOC, futex/time about 200 LOC, VM (demand paging, PROT_NONE) about 400 LOC. Together that roughly triples the 1.4k-LOC kernel, with 2-4 weeks of agent-assisted work. The signal/preempt interaction is the main risk.

Value for code-mode: medium. Go gives easy cross-compiled tools (e.g. a static `gojq`, `yq`, `mdbook`-like tools), but threads and signals are a heavy tax. Defer.

## 2. Rust (aarch64-unknown-linux-musl, static)

Startup (std `rt::init`, INFERRED): `sigaction(SIGPIPE, SIG_IGN)`; `poll` on fds 0,1,2 with 0 timeout (via `ppoll` on musl 1.2 and newer, which is already implemented) and `fcntl(F_GETFD)` fallback to reopen `/dev/null` for closed fds, which is tolerable if poll reports valid fds; `sigaltstack` + `sigaction(SIGSEGV, SIGBUS)` for stack overflow handlers (`stack_overflow::init`), preceded by `mmap` of a guard page plus the alt stack (`mprotect`) and `getrlimit`/`pthread_getattr_np` (which may read `/proc/self/maps` on glibc only; musl uses `pthread_getattr_np` without maps; main thread guard calc may call `mmap`/`munmap`). Also `prctl(PR_SET_VMA)` ignorable, `getrandom` for HashMap seeds (implemented), `set_tid_address`, `rt_sigprocmask`, `brk`/`mmap` allocation (musl malloc, or mimalloc/jemalloc variants that use `madvise`), `exit_group`.

Single-thread Rust: hello world, `jaq`, `jq-rs` (mostly pure compute) need only the existing set plus `sigaltstack`, `sigaction` that succeeds (stub storing handlers), `getrlimit`/`prlimit64`, `madvise` (no-op), `fcntl`, `readlinkat` ENOENT, and `fstat`/`newfstatat` on fds 0-2 (Rust's `stdout` uses `LineWriter`; `isatty` via `ioctl(TCGETS)`).
Thread-using CLIs: ripgrep (rayon-like parallel walk with `std::thread::spawn` unless `-j1`; `--threads 1` works single-threaded), fd (the `ignore` crate, parallel by default, `-j1` avoids it), typst (rayon, comemo, font discovery in the filesystem; heavy), ruff (rayon, filesystem walk, config discovery; `--no-cache`, single file mode may work). All need `getdents64`, `openat`, `newfstatat`, `statx`, `readlinkat`, `getcwd`, `lseek`, `close`, `pread64`, plus `clone`+`futex` for threads (same as Go, but musl pthreads are simpler: one `clone` flavor, `set_robust_list`, `madvise`, `futex` WAIT/WAKE, `mmap` of thread stacks, and `tgkill` for cancellation only). Rust threads need no preemptive signals, so cooperative threads that switch at blocking points (futex/sleep/yield/read) are enough in many cases, with timer preemption as an optional extra.

Wasmtime static as a guest: needs `mmap` of huge PROT_NONE reservations (Cranelift's guard regions are 4 GiB+ 2 GiB by default, fixable with `static_memory_maximum_size=0` / `signals_based_traps(false)`), SIGSEGV handlers for traps (can be turned off via config), threads (cranelift parallel compile, off with config), JIT needing W^X mprotect and `__clear_cache` (EL0 `dc cvau`/`ic ivau` work in userspace if the kernel permits). With a pulley interpreter build (no JIT), the load drops. Binary size is about 15-30 MiB static, which strains 32 MiB RAM. Effort: high; a lightweight interpreter (wasm3/wasmi, in Rust, single thread) is a much better fit.

Effort for Rust single-thread CLI tier: about 10-15 syscalls, 1-2 days of agent growth. Threads tier: shared with Go work.

## 3. C tools

| Tool | Syscalls beyond current | Filesystem |
|---|---|---|
| sqlite3 shell (musl static) | `openat`, `fstat`/`newfstatat`, `fcntl` (locks, return 0), `pread64`/`pwrite64`, `lseek`, `ftruncate`, `fsync`, `unlink`, `getcwd`, `access`, `geteuid` family, `mremap` optional | `:memory:` works with no FS; stdin script via `.read /dev/stdin` or pipe; persistence needs FS |
| jq (1.7 static) | `fstat`, `ioctl`, `readlinkat`, optionally `openat` for `--rawfile`/`-f` | none for stdin-to-stdout filters; `$HOME/.jq` lookup just ENOENT |
| CPython static (python-build-standalone) | `openat`, `newfstatat`/`statx`, `getdents64`, `readlinkat`, `getcwd`, `lseek`, `pread`, `fcntl`, `dup`, `pipe2`, `getpid`, `uname`, `sysinfo`, `prlimit64`, `getrandom`, `futex` (GIL; works single-thread), `rt_sigaction` (real), `clock_nanosleep`, `sched_getaffinity` | needs stdlib: about 30-60 MiB unpacked (could be a zipped `python3x.zip`, which is much smaller). Needs read-only tar/cpio FS plus `/tmp` tmpfs for `.pyc`, `-S -E -I -B` skip site, can drop to about 10 syscall additions |
| Lua 5.4, QuickJS | already running | none |

CPython RAM: about 10 MiB RSS for startup with `-S`, and `-X frozen_modules=on` (3.11 and newer) avoids reading `os`/`site`/`codecs` from disk, so `python -S -c` may need only the frozen modules. It is a very high-value target (agents already write Python) but 32 MiB leaves little room and `import` of anything beyond builtins needs the FS.

A minimal read-only FS (initramfs-style tar index plus in-memory writable `/tmp`) costs about 300-500 LOC: fd table, `openat`, `read`, `pread64`, `lseek`, `fstat`/`newfstatat`/`statx`, `getdents64`, `close`, `readlinkat`, `getcwd`, `dup`/`dup3`, `fcntl`, `unlinkat`, `mkdirat`, plus `write` to tmpfs files. This single investment unlocks sqlite persistence, Python, ripgrep/fd, and Rust config probing, so it comes first.

## Summary table

| Binary class | Extra syscalls/features | Kernel features | Effort | Value for agent code-mode |
|---|---|---|---|---|
| Rust single-thread CLI (jaq, rg -j1, fd -j1) | sigaltstack, sigaction (store only), prlimit64/getrlimit, madvise noop, fcntl, fstat, getdents64/openat if FS | stubbed signals; optional RO FS | Low (1-3 days) | High: fast, small tools |
| C: jq, sqlite3 `:memory:` | fstat, fcntl, lseek, pread/pwrite | none (FS for persistence) | Low | High (structured data) |
| FS layer (tar RO + tmpfs) | openat/getdents64/statx family | in-kernel VFS 300-500 LOC | Medium | Very high enabler |
| CPython static with frozen/zip stdlib | about 25 more syscalls, real rt_sigaction storage | FS, 10-20 MiB RAM | Medium (1-2 weeks) | Very high, RAM-tight |
| Rust multithread (rg, fd, ruff, typst) | clone, futex, set_robust_list, tgkill, nanosleep | cooperative threads on 1 vCPU, timer optional | Medium-high (1-2 weeks) | Medium (can use -j1 mostly) |
| Go static | all of the above plus real signal delivery, SIGURG preemption, sigaltstack, SIGSEGV to user, big PROT_NONE reserve, epoll fakes, madvise | preemptive scheduler, sigframes, demand-paged VM | High (3-6 weeks) | Medium: heavy for the gain |
| wasmtime static | big VM reservations, mprotect W^X, signals (or disable), threads | demand paging, JIT cache ops | High; prefer wasmi/wasm3 | Low-medium (RAM) |

## Recommendation (INFERRED)
Order: (1) stubbed signals + `sigaltstack` + `prlimit64` + `fcntl`/`fstat` so single-thread Rust works; (2) RO tar FS + tmpfs; (3) CPython with frozen stdlib; (4) cooperative threads with futex (covers musl pthreads and Rust `std::thread`); (5) full signals and preemptive scheduler only if Go is a goal. Validate each step with `strace -f -c` on arm64 Docker, which this research could not do.
