# Native Linux CLI census — r6-census, 2026-10-25

**Nine workload profiles run on the unmodified copied jitk syscall implementation:** musl jq, Lua, MicroPython, and BusyBox sed/awk/grep/sort/wc/tar-list. **Gate 9 remains open:** the official jq release fails, SQLite cannot read its database yet, and ripgrep needs both loader and runtime semantics. The first three product targets should be **jq → immutable SQLite → constrained ripgrep**. BusyBox is an immediate supplementary bundle.

The census covers **29 named tools/applets**, represented by **32 primary artifact/workload rows**: 25 successful static ET_EXEC rows for 24 named tools, six successful dynamic contrast rows, and one official musl DuckDB CLI that cannot start because its interpreter is absent. jq has release/musl variants, DuckDB has musl/glibc variants, and Git has diff/shell-alias workloads. Two additional ripgrep profiles investigate recursive search and file mmap. Applets share one BusyBox executable and are **not seven independent runtime implementations**.

## Method and evidence boundary

Read R6-BRIEF and its architecture, performance, shard, ABI-v2, memory/ledger, contracts, kernel/packer/manifest, grow-controller and demo-narrative inputs before collecting evidence. The grow controller is read only: it creates private Git commits and promotes release pointers, so it was not executed under the no-commit instruction. No model proposals, handler changes, shared kernel writes, deployment or commits were made.

Environment: Apple M4 Pro host; existing `kvm-dev`, Ubuntu 26.04.1 arm64, Linux 7.0.0-38-generic, six vCPUs, approximately 9 GiB RAM, 4,096-byte pages, nested HVF → KVM. GCC 15.2.0, locally built musl 1.2.5, installed Rust stable 1.99.1 with `aarch64-unknown-none`. [Environment](raw/environment.json) records exact versions, uptime, load and package receipts. These are functional compatibility measurements; **no latency, CPU, native dirty-memory or density claim is made**. Native vDSO calls are invisible to strace; an absent syscall in this tiny workload is not proof it is unnecessary generally.

Each primary artifact/workload has **n=1 full native trace and n=1 separate `strace -f -c` run**. Full traces use `strace -f -qq -v -s 0 -yy`: unlimited strings, argument arrays, decoded file descriptors and all descendants. The matrix's distinct syscall set is the union of those two runs, excluding only the initial exec and retaining child execs. All 31 executable primary rows match their declared exit and deterministic stdout across both runs (Git diff correctly exits 1). The musl DuckDB row fails both exec attempts. Two extra rg profiles have the same two-run protocol. This is workload coverage, not a 30-run acceptance gate or complete Linux compatibility proof.

Inputs are tiny JSON/YAML/CSV/text, an 8,192-byte SQLite DB containing 9/1/5/3/5, a USTAR list fixture, Markdown, a one-page PDF and an 80-sample WAV. stdin/stdout are pipes; file workloads open fixture inputs read-only. Native processes use `LC_ALL=C`, `LANG=C`, `HOME=/nonexistent`, `TZ=UTC`, `GOMAXPROCS=1`, `NO_COLOR=1`. Guest argv is equivalent (BusyBox argv[0] must actually be `busybox`); **guest env currently contains only `PATH=/`**, so this is output equivalence, not identical startup environments/auxv. Native `/proc`/`/sys`, vDSO and libc fallbacks explain additional guest-only misses.

Kernel source was copied once into `/home/dev/r6-census/kernel/`, with [source hashes](raw/kernel-source-hashes.json), [copy/build provenance](raw/provenance.json), and retained `kernel.tar.gz` SHA-256 `a0584853652a5e349c6baff4dcf6206b29f3af5e9e8ebe69bf0eb02afd73e2a2`. That snapshot has 24 syscall slots / 23 handler names; registered rt_sigaction/rt_sigprocmask/mremap still return ENOSYS. This identifies the measured baseline while r6-shard works concurrently. **Registered does not mean Linux-equivalent.**

Fifteen packer-admitted primary rows were built with unchanged copied handlers and `grow-trace`, then run once through copied `/home/dev/r6-census/bin/jitk-vmm`, the existing Linux/libkrun path. Each run has a five-second watchdog and kill/reap on timeout; stdout/stderr remain pipes for the sandbox contract. Success requires **guest terminal exit 0 + exact application stdout + sandbox ack**; VMM exit 0 alone is insufficient. Nine pass, six fail. The remaining 17 primary rows have measured packer rejections, not invented guest failures. Two separate wider-loader diagnostic runs are reported below and do not change runs-today status.

Initial native/baseline batches used `flock /home/dev/bench.lock`. Final full-string recapture, contrast, injection and diagnostic runs are untimed functional work, with per-run load/uptime retained; they ran without the benchmark lock while the other agent held it for a long benchmark. Incidental strace time columns are not performance results. Native/injection process groups are bounded and reaped, core dumps disabled. No third-party aarch64 binary ran on the Mac.

## Measured matrix

`E` = bounded metadata/ioctl/pread compatibility; `M` = memory permissions, signals, file mmap, local writable-FS/pipe semantics; `H` = threads, process creation or network. Effort is **engineering judgment**, in focused engineer-days familiar with this tree, including independent semantic/mutation checks. It is not inferred from experiment duration. Shared infrastructure costs are not additive per row. “N (loader)” means the current packer rejects the unchanged artifact; runtime compatibility is unproven. Full syscall sets are in the next table and [MATRIX.csv](MATRIX.csv).

| Tool → category | Used syscalls | Missing slot names in native workload | Blocking semantics / difficulty | Runs today | Estimated grow effort |
|---|---:|---|---|---|---|
| [jq](raw/jq/native.json) → data | 18 | fstat, futex, getrandom, mprotect, prlimit64, rseq, set_robust_list | M: RELRO mprotect; entropy; fd metadata; glibc probes | N | 1–3 d; prefer musl artifact |
| [jq-musl](raw/jq-musl/native.json) → data | 14 | getrandom | None for fixture; getpid/getrandom misses tolerated | Y | 0 handler work; byte/entropy integration 1–2 d shared |
| [gojq](raw/gojq/native.json) → data | 28 | clone, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, futex, getpid, gettid, madvise, nanosleep, pread64, prlimit64, rt_sigreturn, sched_getaffinity, sigaltstack, tgkill | H: Go threads/futex/signals/netpoll; low VAs; sparse large mmap | N (loader) | Linux tier; weeks if pursued |
| [yq](raw/yq/native.json) → data | 25 | clone, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, fstat, futex, gettid, madvise, nanosleep, prctl, prlimit64, sched_getaffinity, sched_yield, sigaltstack | H: Go threads/futex/signals/netpoll; low VAs; sparse large mmap | N (loader) | Linux tier; weeks if pursued |
| [miller](raw/miller/native.json) → data | 28 | clone, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, fstat, futex, getpid, gettid, madvise, nanosleep, prctl, prlimit64, rt_sigreturn, sched_getaffinity, sched_yield, sigaltstack, tgkill | H: Go threads/futex/signals/netpoll; low VAs; sparse large mmap | N (loader) | Linux tier; weeks if pursued |
| [dasel](raw/dasel/native.json) → data | 26 | clone, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, fstat, futex, gettid, getuid, madvise, nanosleep, prctl, prlimit64, sched_getaffinity, sigaltstack | H: Go threads/futex/signals/netpoll; low VAs; sparse large mmap | N (loader) | Linux tier; weeks if pursued |
| [gron](raw/gron/native.json) → data | 23 | clone, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, futex, gettid, madvise, nanosleep, pread64, prlimit64, sched_getaffinity, sigaltstack | H: Go threads/futex/signals/netpoll; low VAs; sparse large mmap | N (loader) | Linux tier; weeks if pursued |
| [qsv](raw/qsv/native.json) → data | 29 | clone, fstat, futex, getrandom, gettid, mkdirat, mprotect, prctl, sched_getaffinity, sigaltstack, uname | H: threads; M: signals/guard pages; mkdirat(.) error semantics; large ELF | N (loader) | Linux tier; weeks if pursued |
| [rg](raw/rg/native.json) → search | 25 | fstat, getrandom, madvise, mprotect, sched_getaffinity, sigaltstack, uname | M: wider ELF, SIGPIPE registration, guard mprotect/mmap; E: fstat | N (loader) | 4–8 d estimate, constrained -j1 --no-mmap |
| [fd](raw/fd/native.json) → search | 25 | clone, futex, getrandom, gettid, mprotect, sched_yield, sigaltstack | H: threads even --threads 1; M: ELF/signals/guard pages | N (loader) | Linux tier initially; weeks for thread support |
| [sd](raw/sd/native.json) → text | 13 | getrandom, mprotect, sigaltstack | M: SIGPIPE registration; guard mprotect/mmap; optional altstack | N | 2–4 d; shares Rust work with rg |
| [bb-sed](raw/bb-sed/native.json) → text | 8 | — | None for this stream substitution | Y | 0 handler work |
| [bb-awk](raw/bb-awk/native.json) → text | 8 | — | None for this stream aggregate | Y | 0 handler work |
| [bb-grep](raw/bb-grep/native.json) → text | 8 | — | None for this stream match | Y | 0 handler work |
| [bb-sort](raw/bb-sort/native.json) → text | 7 | — | None for this small in-memory sort; spills not tested | Y | 0 handler work |
| [bb-wc](raw/bb-wc/native.json) → text | 5 | — | None for this stream line count | Y | 0 handler work |
| [bb-tar](raw/bb-tar/native.json) → compression | 10 | getuid | None for list-only USTAR; getuid miss tolerated | Y | 0 handler work; extraction needs writable FS |
| [sqlite3](raw/sqlite3/native.json) → database | 19 | faccessat, fstat, getpid, pread64 | E: fstat + pread64; immutable RO URI avoids locks/journal | N | 2–4 d incl. semantic/mutation gates |
| [duckdb](raw/duckdb/native.json) → database | 0 | — | Dynamic musl interpreter + 3 DT_NEEDED libs; not executable here | N (loader) | Linux tier; static CLI not measured |
| [duckdb-gnu](raw/duckdb-gnu/native.json) → database | 29 | clone3, faccessat, fstat, futex, getrandom, madvise, mprotect, pread64, prlimit64, rseq, sched_getaffinity, set_robust_list, sysinfo | Dynamic loader; H: threads/futex; large ELF; CPU/sysfs discovery | N (loader) | Linux tier |
| [bb-gzip](raw/bb-gzip/native.json) → compression | 8 | — | Byte stdout; no missing slot before rejection | N | 1–2 d shared byte transport; unverified after change |
| [zstd](raw/zstd/native.json) → compression | 12 | — | Byte stdout; CPU clock id 2 EINVAL tolerated; no slot miss | N | 1–2 d shared byte transport; unverified after change |
| [xz](raw/xz/native.json) → compression | 22 | fadvise64, fstat, geteuid, landlock_create_ruleset, landlock_restrict_self, pipe2, prctl, prlimit64, sysinfo | M: self-pipe, fcntl GETFL/SETFL, signals; E: fstat; prctl profile; bytes | N | 3–5 d; after shared byte transport |
| [lua](raw/lua/native.json) → language | 13 | — | None for this file sum; signal ENOSYS profile tolerated | Y | 0 handler work |
| [micropython](raw/micropython/native.json) → language | 10 | — | None for this file sum; configured Unix standard build | Y | 0 handler work; not all modules tested |
| [esbuild](raw/esbuild/native.json) → language | 19 | clone, futex, gettid, madvise, nanosleep, pread64, prlimit64, sched_getaffinity, sigaltstack | H: Go threads/futex/signals; low VAs; sparse large mmap | N (loader) | Linux tier; weeks if pursued |
| [pandoc](raw/pandoc/native.json) → documents | 36 | clone, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, fstat, futex, madvise, mkdirat, mprotect, pipe2, prctl, prlimit64, sched_getaffinity, sched_yield, sysinfo, timerfd_create, timerfd_settime | H: RTS threads/event loop; ~169 MiB load span; mkdirat(.) profile | N (loader) | Linux tier |
| [qpdf](raw/qpdf/native.json) → documents | 20 | faccessat, fstat, futex, getrandom, mprotect, prlimit64, rseq, set_robust_list | Dynamic Ubuntu build; E: metadata; M: loader/protection | N (loader) | Linux tier for measured artifact; musl build unmeasured |
| [ffmpeg](raw/ffmpeg/native.json) → media | 29 | clone3, dup, faccessat, fstat, futex, getrandom, getrusage, madvise, mprotect, prctl, prlimit64, rseq, set_robust_list | Dynamic despite static-dependency build label; H: threads; ~126 MiB span | N (loader) | Linux tier |
| [git](raw/git/native.json) → hard | 21 | faccessat, fstat, getrandom, mprotect, prlimit64, rseq, set_robust_list | Dynamic build; E: metadata; this no-index diff has no child exec | N (loader) | Linux tier for full Git; static build unmeasured |
| [git-shell](raw/git-shell/native.json) → hard | 31 | clone, execve, faccessat, fstat, getegid, geteuid, getgid, getpid, getppid, getrandom, getuid, mprotect, pipe2, prlimit64, rseq, set_robust_list, wait4 | H: clone + exec shell + wait4 + pipe2 in alias workload | N (loader) | Linux tier; not a dependency of no-index diff |
| [curl](raw/curl/native.json) → hard | 34 | connect, eventfd2, faccessat, fstat, futex, geteuid, getrandom, getsockname, getsockopt, madvise, mprotect, prlimit64, recvfrom, rseq, sendto, set_robust_list, setsockopt, socket | H: actual socket/connect/send/recv; dynamic loader | N (loader) | Linux tier / brokered HTTP capability |

Missing columns are **observed unregistered names**, not a mandatory shopping list. For example, jq-musl succeeds despite guest getpid/getrandom misses; tar-list succeeds despite guest getuid. SQLite's tolerated getpid and jq-musl's additional guest-only getpid are preserved in jitk.json; the latter is absent from the native syscall column. Conversely, sd's fatal startup operation is an already-registered signal handler returning ENOSYS; its first *unregistered* miss is tkill during abort, after the causal failure.

| Tool/artifact | Full distinct native syscall set (two-run union, initial exec excluded) |
|---|---|
| jq | brk, close, exit_group, fstat, futex, getcwd, getrandom, ioctl, mprotect, newfstatat, openat, prlimit64, read, readlinkat, rseq, set_robust_list, set_tid_address, write |
| jq-musl | brk, close, exit_group, getcwd, getrandom, ioctl, mmap, munmap, newfstatat, openat, read, readlinkat, set_tid_address, writev |
| gojq | clone, close, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, exit_group, fcntl, futex, getpid, gettid, lseek, madvise, mmap, nanosleep, newfstatat, openat, pread64, prlimit64, read, readlinkat, rt_sigaction, rt_sigprocmask, rt_sigreturn, sched_getaffinity, sigaltstack, tgkill, write |
| yq | clone, close, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, exit_group, fcntl, fstat, futex, gettid, madvise, mmap, nanosleep, newfstatat, openat, prctl, prlimit64, read, rt_sigaction, rt_sigprocmask, sched_getaffinity, sched_yield, sigaltstack, write |
| miller | clone, close, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, exit_group, fcntl, fstat, futex, getpid, gettid, ioctl, madvise, mmap, nanosleep, openat, prctl, prlimit64, read, rt_sigaction, rt_sigprocmask, rt_sigreturn, sched_getaffinity, sched_yield, sigaltstack, tgkill, write |
| dasel | clone, close, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, exit_group, fcntl, fstat, futex, gettid, getuid, ioctl, madvise, mmap, nanosleep, newfstatat, openat, prctl, prlimit64, read, rt_sigaction, rt_sigprocmask, sched_getaffinity, sigaltstack, write |
| gron | clone, close, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, exit_group, fcntl, futex, gettid, ioctl, madvise, mmap, nanosleep, openat, pread64, prlimit64, read, rt_sigaction, rt_sigprocmask, sched_getaffinity, sigaltstack, write |
| qsv | brk, clock_gettime, clone, close, exit_group, fcntl, fstat, futex, getcwd, getrandom, gettid, lseek, mkdirat, mmap, mprotect, munmap, newfstatat, openat, ppoll, prctl, read, readlinkat, rt_sigaction, rt_sigprocmask, sched_getaffinity, set_tid_address, sigaltstack, uname, write |
| rg | brk, clock_gettime, close, exit_group, fcntl, fstat, getcwd, getrandom, ioctl, madvise, mmap, mprotect, munmap, newfstatat, openat, ppoll, read, readlinkat, rt_sigaction, rt_sigprocmask, sched_getaffinity, set_tid_address, sigaltstack, uname, write |
| fd | brk, clock_gettime, clone, close, exit, exit_group, fcntl, futex, getcwd, getdents64, getrandom, gettid, ioctl, mmap, mprotect, munmap, newfstatat, openat, ppoll, rt_sigaction, rt_sigprocmask, sched_yield, set_tid_address, sigaltstack, write |
| sd | brk, exit_group, getrandom, mmap, mprotect, munmap, ppoll, read, rt_sigaction, rt_sigprocmask, set_tid_address, sigaltstack, write |
| bb-sed | brk, exit_group, ioctl, mmap, munmap, read, set_tid_address, writev |
| bb-awk | brk, close, exit_group, ioctl, mmap, read, set_tid_address, writev |
| bb-grep | brk, exit_group, ioctl, mmap, munmap, read, set_tid_address, writev |
| bb-sort | brk, exit_group, ioctl, mmap, read, set_tid_address, writev |
| bb-wc | exit_group, ioctl, read, set_tid_address, writev |
| bb-tar | brk, exit_group, getuid, ioctl, lseek, mmap, openat, read, set_tid_address, writev |
| sqlite3 | brk, close, exit_group, faccessat, fcntl, fstat, getcwd, getpid, ioctl, mmap, munmap, newfstatat, openat, pread64, read, rt_sigaction, rt_sigprocmask, set_tid_address, writev |
| duckdb | No process entered: interpreter absent |
| duckdb-gnu | brk, clone3, close, exit, exit_group, faccessat, fstat, futex, getrandom, ioctl, lseek, madvise, mmap, mprotect, munmap, newfstatat, openat, pread64, prlimit64, read, readlinkat, rseq, rt_sigaction, rt_sigprocmask, sched_getaffinity, set_robust_list, set_tid_address, sysinfo, write |
| bb-gzip | brk, close, exit_group, ioctl, mmap, read, set_tid_address, write |
| zstd | brk, clock_gettime, close, exit_group, ioctl, mmap, munmap, newfstatat, openat, readv, set_tid_address, writev |
| xz | brk, clock_gettime, close, exit_group, fadvise64, fcntl, fstat, geteuid, ioctl, landlock_create_ruleset, landlock_restrict_self, mmap, openat, pipe2, prctl, prlimit64, read, rt_sigaction, rt_sigprocmask, set_tid_address, sysinfo, write |
| lua | brk, clock_gettime, close, exit_group, ioctl, mmap, munmap, openat, read, rt_sigaction, rt_sigprocmask, set_tid_address, writev |
| micropython | brk, exit_group, mmap, openat, read, readlinkat, rt_sigaction, rt_sigprocmask, set_tid_address, write |
| esbuild | clone, close, exit_group, fcntl, futex, gettid, ioctl, madvise, mmap, nanosleep, openat, pread64, prlimit64, read, rt_sigaction, rt_sigprocmask, sched_getaffinity, sigaltstack, write |
| pandoc | brk, clock_gettime, clone, close, epoll_create1, epoll_ctl, epoll_pwait, eventfd2, exit, exit_group, fcntl, fstat, futex, getcwd, ioctl, madvise, mkdirat, mmap, mprotect, munmap, newfstatat, openat, pipe2, ppoll, prctl, prlimit64, read, rt_sigaction, rt_sigprocmask, sched_getaffinity, sched_yield, set_tid_address, sysinfo, timerfd_create, timerfd_settime, write |
| qpdf | brk, close, exit_group, faccessat, fstat, futex, getrandom, lseek, mmap, mprotect, munmap, newfstatat, openat, prlimit64, read, rseq, rt_sigprocmask, set_robust_list, set_tid_address, write |
| ffmpeg | brk, clone3, close, dup, exit, exit_group, faccessat, fcntl, fstat, futex, getrandom, getrusage, ioctl, lseek, madvise, mmap, mprotect, munmap, newfstatat, openat, prctl, prlimit64, read, rseq, rt_sigaction, rt_sigprocmask, set_robust_list, set_tid_address, write |
| git | brk, close, exit_group, faccessat, fstat, getcwd, getrandom, ioctl, mmap, mprotect, munmap, newfstatat, openat, prlimit64, read, rseq, rt_sigaction, rt_sigprocmask, set_robust_list, set_tid_address, write |
| git-shell | brk, clone, close, execve, exit_group, faccessat, fcntl, fstat, getcwd, getegid, geteuid, getgid, getpid, getppid, getrandom, getuid, mmap, mprotect, munmap, newfstatat, openat, pipe2, prlimit64, read, rseq, rt_sigaction, rt_sigprocmask, set_robust_list, set_tid_address, wait4, write |
| curl | brk, close, connect, eventfd2, exit_group, faccessat, fcntl, fstat, futex, geteuid, getrandom, getsockname, getsockopt, ioctl, lseek, madvise, mmap, mprotect, munmap, newfstatat, openat, ppoll, prlimit64, read, recvfrom, rseq, rt_sigaction, rt_sigprocmask, sendto, set_robust_list, set_tid_address, setsockopt, socket, write |

## Artifact and loader inventory

[ARTIFACTS.csv](ARTIFACTS.csv) records **full SHA-256, exact byte size, version, source, ELF type, PT_TLS file/memory size, every PT_LOAD interval and the packer error** for every row. [raw/provenance/](raw/provenance/) retains official release catalogs, selected URLs/digests, source receipts and build configurations; each [raw/&lt;tool&gt;/metadata.json](raw/jq/metadata.json) contains the full ELF program headers. Sizes below are actual retained binaries; locally built binaries are generally unstripped, and dynamic CLI sizes exclude their shared libraries.

| Artifact | Version | Binary bytes | ELF/linkage | PT_TLS initialized / total bytes | SHA-256 prefix (full in CSV) |
|---|---|---:|---|---|---|
| jq | jq-1.8.2 | 1,797,688 | ET_EXEC; static | 32 / 104 | `8b85c817833814dd` |
| jq-musl | jq-1.8.2 | 1,131,552 | ET_EXEC; static | 0 / 4 | `8d689ba1c53a9aed` |
| gojq | v0.12.19 | 4,063,394 | ET_EXEC; static | none | `2f8ae7d8204f8b4c` |
| yq | v4.54.1 | 13,172,896 | ET_EXEC; static | none | `189088da0c6429ec` |
| miller | v6.22.0 | 16,253,090 | ET_EXEC; static | none | `ae390e84c62be0fc` |
| dasel | v3.11.2 | 9,765,026 | ET_EXEC; static | none | `df33920a792cd8ee` |
| gron | v0.7.1 | 6,553,724 | ET_EXEC; static | none | `61ebde143f649521` |
| qsv | 26.0.0 | 18,039,008 | ET_EXEC; static | 176 / 2064 | `415fc575f91404c2` |
| rg | 15.2.0 | 4,466,000 | ET_EXEC; static | 2456 / 2592 | `c14cdb389f34e504` |
| fd | v10.5.0 | 3,080,696 | ET_EXEC; static | 48 / 168 | `90dab774d9288992` |
| sd | v1.1.0 | 2,027,704 | ET_EXEC; static | 32 / 176 | `376d61e1f5e776a7` |
| bb-sed | 1.37.0 | 329,480 | ET_EXEC; static | none | `e6e0d9874eef980f` |
| bb-awk | 1.37.0 | 329,480 | ET_EXEC; static | none | `e6e0d9874eef980f` |
| bb-grep | 1.37.0 | 329,480 | ET_EXEC; static | none | `e6e0d9874eef980f` |
| bb-sort | 1.37.0 | 329,480 | ET_EXEC; static | none | `e6e0d9874eef980f` |
| bb-wc | 1.37.0 | 329,480 | ET_EXEC; static | none | `e6e0d9874eef980f` |
| bb-tar | 1.37.0 | 329,480 | ET_EXEC; static | none | `e6e0d9874eef980f` |
| sqlite3 | 3.50.4 | 1,392,336 | ET_EXEC; static | none | `005073a6c1c0e71c` |
| duckdb | v2.0.0 | 69,372,808 | ET_DYN; dynamic | 0 / 24880 | `7b46903d3068543b` |
| duckdb-gnu | v2.0.0 | 75,289,208 | ET_EXEC; dynamic | 2704 / 27584 | `f4c681bcf41a5c43` |
| bb-gzip | 1.37.0 | 329,480 | ET_EXEC; static | none | `e6e0d9874eef980f` |
| zstd | v1.5.7 | 1,127,240 | ET_EXEC; static | none | `5a52c331442b8939` |
| xz | v5.8.4 | 321,176 | ET_EXEC; static | none | `77d0a2af37564d37` |
| lua | 5.4.8 | 395,104 | ET_EXEC; static | none | `6d825f225d7beff5` |
| micropython | v1.27.0 | 591,376 | ET_EXEC; static | none | `4626bf11458cb187` |
| esbuild | 0.28.2 | 10,289,264 | ET_EXEC; static | none | `90bd269553d258e8` |
| pandoc | 3.12.1 | 177,158,224 | ET_EXEC; static | none | `4cbd8455add85a1e` |
| qpdf | 12.3.2 (Ubuntu) | 67,856 | ET_DYN; dynamic | none | `d76fb93c99324194` |
| ffmpeg | N-128013-g6b05263b44-20261024 | 120,113,896 | ET_DYN; dynamic | 136 / 1136 | `28a1f9e92dd691cd` |
| git | 2.53.0 (Ubuntu) | 4,329,080 | ET_DYN; dynamic | none | `171572a95cb70f20` |
| git-shell | 2.53.0 (Ubuntu) | 4,329,080 | ET_DYN; dynamic | none | `171572a95cb70f20` |
| curl | 8.18.0 (Ubuntu) | 330,288 | ET_DYN; dynamic | none | `765d83012477a472` |

Release binaries for jq, gojq, yq, miller, dasel, rg, fd, sd, qsvlite, Pandoc and DuckDB were fetched from their projects' GitHub releases into separate empty directories. Published GitHub asset SHA-256 digests / project checksum files were checked **before execution**. esbuild is the official `@esbuild/linux-arm64` npm artifact, verified against npm SHA-512 integrity. gron has no published release checksum in the selected old release, so its binary was **source-built with CGO_ENABLED=0**, verified Go modules/checksum database, an official checksum-verified local Go toolchain, `-trimpath`, and a recorded build recipe.

BusyBox 1.37.0 is an unmodified-source musl build with seven enabled applets; published source SHA-256 and the exact [.config](raw/busybox.config) are retained. zstd 1.5.7 uses upstream source and `HAVE_THREAD=0`; xz 5.8.4 uses upstream source and `--disable-threads`, then libtool `-all-static` at final link. Their published source checksums are verified. jq-musl uses the same jq 1.8.2 upstream source as the release, builtin Oniguruma and `--enable-all-static`; source SHA-256 `71b8d6e8f5fe81f6c6d0d110e3892251f6ce76ed095abd315e26e6e1193af3af` is verified. No application source was patched.

MicroPython 1.27.0 is upstream's full source distribution, Unix **standard** variant with SSL/FFI/btree disabled and empty frozen manifest, statically linked; threads remain a compiled capability but this workload creates none. Its source SHA-256 is recorded; **no upstream checksum/signature was found or independently authenticated for that tarball**, so do not label it a verified release binary. musl source matches the prior experiment's SHA-256 and Alpine's independently published SHA-512, retained in `raw/provenance/toolchain-musl/alpine-APKBUILD`. It is an experimental local musl 1.2.5 toolchain, not a current distribution security profile. Local C builds have pinned sources/configuration/compiler receipts; byte-identical rebuilds across dates/toolchains were **not tested**.

Lua and SQLite reuse the exact existing static artifacts and their recorded original build provenance. Lua SHA-256 is `6d825f225d7beff5a9707ec10db63cf3347524dc3ba183b16d0f6d809d2f0929`; SQLite is `005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff`, matching the pitch investigation. Git/curl are copies of the VM's installed Ubuntu dynamic binaries (`dpkg -V` receipt retained). qpdf and two missing libraries were downloaded/extracted locally, **not installed**, with .deb SHA-256 checked against apt package metadata. FFmpeg is a checksum-verified **BtbN build, not an upstream FFmpeg-provided binary**. Its “static” distribution statically bundles many dependencies but **has PT_INTERP**, as do both measured DuckDB CLI variants. Neither is evidence that jitk accepts a static PIE.

## Where each feasible guest stops

All rows here are n=1 final baseline run. Raw records are `raw/<tool>/jitk.stdout`, host ack is `.stderr`, and the reduction is `jitk.json`; exact image hashes and argv are in retained VM `images/<tool>/manifest.json`. Failed BusyBox argv[0] pilots were corrected before these final results.

| Artifact/profile | Measured outcome |
|---|---|
| jq official 1.8.2 | Guest exit **127**. First missing nr99 set_robust_list is tolerated; rseq/prlimit64/getrandom also miss. Fatal nr226 **mprotect → ENOSYS**, then glibc “cannot apply additional memory protection after relocation.” |
| jq-musl 1.8.2 | Guest exit **0**, stdout `7\n`. Missing getrandom/getpid are tolerated for this arithmetic query. This is **not** a randomness or crypto test. |
| SQLite 3.50.4 immutable file | Guest exit **1**, no stdout. faccessat/getpid misses precede **fstat(3) → ENOSYS**. Native Linux reads DB pages using **pread64**. |
| sd 1.1.0 | No guest done record; faults during abort. rt_sigaction(SIGPIPE) returns ENOSYS and Rust prints “fatal runtime error: assertion failed: signal(...) != SIG_ERR”. tkill is a later abort-path miss. |
| Lua 5.4.8 | Guest exit **0**, file sum `10\n`, no unregistered misses. Existing signal ENOSYS contract is tolerated. |
| MicroPython 1.27.0 standard | Guest exit **0**, identical file sum `10\n`, no unregistered misses. |
| BusyBox sed / awk / grep / sort / wc | Each guest exit **0**, exact native stream output, no unregistered misses. Small sort does not test external spills. |
| BusyBox tar `-tf` | Guest exit **0**, `input.txt\n`; missing getuid tolerated. No extraction or compression-helper execution claim. |
| BusyBox gzip `-c` | Reaches output then **fatal control byte**. No unregistered miss before rejection. |
| zstd `-q -c -T1` | Reaches writev then **fatal control byte**. No unregistered miss. clock_gettime clock id 2 returns EINVAL, tolerated. |
| xz `-c -T1` | Guest exit **1**. Missing geteuid is tolerated; **pipe2 → ENOSYS** causes “Error creating a pipe”. This is its signal-notification self-pipe, not a child process. |

A separate diagnostic copies the kernel again to `kernel-wide/` and makes only [two loader/cache-range changes](raw/wide-loader.patch): ET_EXEC upper bound `0x680000 → 0xa00000`, matching cache maintenance coverage; no syscall handler edits. Unchanged rg and fd then enter EL0 and **both fail at the same SIGPIPE registration as sd**, followed by abort-path tkill/fault. Raw: [rg wide trace](raw/rg/wide.stdout), [fd wide trace](raw/fd/wide.stdout); n=1 each. The current packer still rejects them, so their matrix status remains N. rg's load range ends at **0x8de740**; fd's at **0x703758**. Merely changing the numeric loader window is insufficient.

## Frequency and required-versus-optional evidence

Denominator: **25 executable static artifact/workload rows**, including both jq variants and seven same-binary BusyBox applets. Dynamic contrasts, unavailable musl DuckDB and the extra rg profiles are excluded. Frequencies count exposure in either native run, **not proven complete unlocks**. A tool may also be blocked by loader, threads and several other calls. Frequency alone would misleadingly prioritize a Go thread scheduler over the two SQLite calls.

| Unregistered syscall / group | Rows exposed | Meaning for growth |
|---|---:|---|
| futex | 10 | Thread/runtime infrastructure; 10 rows are not ten cheap unlocks. |
| sigaltstack | 10 | Often queried/installed by Rust/Go; ENOSYS tolerated in the tested Rust normal paths. |
| clone | 9 | All nine are thread creation here; major scheduler/TLS/futex work. |
| fstat | 9 | Best metadata primitive: directly fatal for SQLite, rg and xz under injection. |
| prlimit64 | 9 | Mostly runtime discovery; optional in the tested jq/xz cases. |
| sched_getaffinity | 9 | CPU sizing; rg tolerates ENOSYS; Go scheduler still needs threads. |
| gettid | 8 | Thread identity, not equivalent to only adding a constant-return syscall. |
| madvise | 8 | Memory policy; rg tolerates ENOSYS in this workload. |
| getrandom | 6 | jq release fails without entropy; musl jq, rg and sd tolerate ENOSYS here. |
| mprotect | 6 | Mandatory glibc RELRO and Rust guard permissions, not a success stub. |
| pread64 | 4 | SQLite needs exact positional reads; other exposure is Go startup/executable reads. |
| pipe2 | 2 | xz self-pipe and Pandoc RTS; not necessarily fork. |
| mkdirat | 2 | qsv/Pandoc probe mkdirat(".") expecting EEXIST; no successful write observed. |
| epoll_create1 / epoll_ctl / epoll_pwait / eventfd2 | 6 each | Five data-oriented Go tools plus Pandoc use netpoll/event loops despite no external network. |

Remaining exact frequencies and member tools are in [raw/summary.json](raw/summary.json). Registered partial surfaces are at least as important: mmap **23/25**, ioctl **20/25**, rt_sigaction and rt_sigprocmask **15/25** each, fcntl **12/25**, munmap/newfstatat **11/25** each, clock_gettime **7/25**, ppoll **5/25**. A native mmap(PROT_NONE, MAP_FIXED) request may be tolerated by musl when rejected, while a Rust guard mprotect failure is fatal. Slot counts cannot predict that.

The [36 single-call ENOSYS sensitivity checks](raw/sensitivity.json) each run the unchanged binary n=1, retaining full trace/stdout/stderr/status. All targeted calls were actually injected, with no timeout. Results that determine prioritization:

| Profile | ENOSYS changes the workload result | ENOSYS preserves this result |
|---|---|---|
| official jq | mprotect; getrandom (glibc arc4random abort) | set_robust_list, rseq, prlimit64 |
| musl jq | — | getrandom |
| SQLite | fstat; pread64 (both disk-I/O failure) | faccessat, getpid, rt_sigaction, rt_sigprocmask |
| rg | rt_sigaction; mprotect (alternative-stack guard panic); fstat | sigaltstack, getrandom, sched_getaffinity, uname, madvise |
| sd | rt_sigaction; mprotect | sigaltstack, getrandom |
| xz | pipe2; prctl (“Failed to enable the sandbox”); fstat | geteuid, landlock_create_ruleset, prlimit64, sysinfo, fadvise64 |
| BusyBox tar-list | — | getuid |
| qsvlite select | rt_sigaction; mkdirat | fstat |

These are independent single-failure probes, not a combined compatibility profile. Native success after one injected failure does not prove every combination will work. No fake always-success mprotect, signal, random or thread handler is recommended.

## Runtime and filesystem features

[FEATURES.csv](FEATURES.csv) records exact clone/fork flags, child exec count, mmap calls, attempted filesystem mutations, /proc, /sys, /dev paths and ioctl arguments. Main-profile observations:

* **Threads:** Go gojq/yq/miller/dasel/gron/esbuild create CLONE_THREAD workers even with GOMAXPROCS=1. fd creates threads even with `--threads 1`; qsvlite, Pandoc, DuckDB and FFmpeg create threads in their small workloads. No selected rg `-j1 --no-mmap`, sd, musl C tool or BusyBox workload creates threads. Compiled thread support elsewhere in a binary is not disproved.
* **Fork/exec:** Git's no-index diff does not spawn; its separate shell-alias profile does clone + child exec + wait4/pipe2. Initial exec used to start every straced program is excluded. Do not claim every Git operation requires fork or every xz pipe implies a process.
* **File mmap:** no main static workload maps a file; dynamic contrast loaders do. The extra [rg --mmap profile](raw/profiles/rg-mmap/full.strace) maps the 23-byte input with **PROT_READ | MAP_SHARED**, fd3. [Recursive rg](raw/profiles/rg-recursive/native.json) also succeeds natively with `--sort path -j1 --no-mmap`. Initial rg support should require that bounded profile; compressed search can invoke helpers and is excluded.
* **Writable filesystem:** no successful ordinary filesystem write is observed. qsv/Pandoc call **mkdirat(".") → EEXIST**; returning ENOSYS breaks qsv logging initialization even though creating a directory is unnecessary. Git opens the actual `/dev/null` O_RDWR; this is a device requirement, not a writable repository. Tar extraction, sort spill, sd in-place updates, DB journal/WAL, Git checkout/index and Pandoc external filters are untested and belong to additional contracts.
* **Discovery files:** Go tools inspect /proc/self/cgroup, /proc/self/mountinfo and /sys cgroup/CPU data; some also read /proc/self/exe. qsv inspects cpuinfo/meminfo/stat and cgroup/CPU topology; rg's jemalloc checks /proc/sys/vm/overcommit_memory and /sys/kernel/mm/transparent_hugepage/enabled. The default guest has none; normal native exposure does not prove each file mandatory. Either expose truthful bounded virtual data or validate ENOENT fallbacks; never provide host paths/topology/credentials automatically.
* **TTY/ioctl:** measured stream profiles mostly probe **TIOCGWINSZ → ENOTTY**, which jitk already returns for fd0–2. TCGETS-like terminal discovery is optional in general CLI modes; no universal terminal emulation is established. For byte pipes, return truthful ENOTTY/EBADF with correct pointer/error behavior; do not invent terminal dimensions. fcntl currently only supports F_GETFD/F_SETFD; xz needs GETFL/SETFL with O_NONBLOCK on its self-pipe/stdout, and Go/Pandoc event loops need more FD kinds.
* **Network:** curl actually performs local TCP HTTP through socket/connect/sendto/recvfrom; network is not inferred from a name or dependency. No external network is used in measured workloads. HTTP is served by an offline Python fixture in this agent's directory, never a proposed runtime helper. Full curl DNS/TLS/proxy behavior is unmeasured; brokered capability calls or a Linux tier are the appropriate implementation paths.

## Loader/runtime work required for gate 9

1. **Wider static ET_EXEC mapping with class admission.** Current packer allows PT_LOAD only in `[0x400000,0x680000]`, at most 16 program headers, no PT_DYNAMIC/PT_INTERP, no W+X or page-sharing segments. Go release ELFs start at **0x10000**, so widening only the upper bound cannot admit them: physical translation, page-table indexing, access checks and stack/heap layout need lower-VA/sparse-VA support. rg needs the upper bound to exceed 0x8de740. qsv needs much more image space; Pandoc's last loaded address is 0xad07ca8, far beyond the current 32 MiB machine. Keep shared RX/RO pages separate from the bounded writable arena and do not translate file size into private memory or accept every large binary into glue-2m.
2. **Static PIE is a separate loader feature.** No acquired static artifact is a static PIE: every accepted static binary is ET_EXEC. If later required, ET_DYN without interpreter/DT_NEEDED needs a chosen load bias, checked AArch64 relocations, relocated entry/PHDR/auxv, RELRO and W^X validation. The measured ET_DYN DuckDB/FFmpeg/Git/curl/qpdf binaries are dynamic, and need an interpreter/libraries; calling them “static PIE” would conceal the blocker. Keep dynamic loading in the Linux tier initially.
3. **Real initial stack, argv/env and auxv.** Preserve 16-byte SP alignment, argc/argv/terminators, correct argv[0], AT_PHDR/PHENT/PHNUM/ENTRY/PAGESZ/UID/EUID/GID/EGID/SECURE/RANDOM/NULL. Today's supported set is visible in `src/user.rs`; it lacks AT_EXECFN/HWCAP/HWCAP2/CLKTCK and a vDSO. Add truthful CPU/ABI values only as needed; source/behavior audit must establish dependencies that strace cannot see. Build bounded, declared per-run env and argv after restore; honor HOME/locale/temp/cache/config behavior deliberately. Never snapshot tenant env or secrets.
4. **TLS and permissions.** PT_TLS sizes above are measured, not heap reservations. Static musl/glibc normally initialize TLS themselves from PHDR/auxv; don't assume a missing x86-style arch_prctl on aarch64. TPIDR_EL0 is guest CPU state. Thread support would require separate TLS/stacks/TIDs, clone semantics, real futex/wakeup/signal interactions and reset state. mprotect must enforce page permissions/guard pages/RELRO and W^X; mmap needs declared hints/PROT_NONE/MAP_FIXED policies and zero-fill/reuse semantics. ENOSYS and a false success are both insufficient for the Rust/glibc cases.
5. **Byte stdout/stderr and proper completion.** Today's printable-ASCII-only stdout rejects gzip/zstd and would reject ordinary Unicode or tabs; fd2 is dropped in production. It also cannot safely use a final partial line as a terminal trace boundary. Native output must be raw length-delimited bytes with separate stdout/stderr streams, partial writes/backpressure/EOF, and an independently validated exit status. This is a prerequisite even for tools whose tiny ASCII fixture already passes.
6. **Checkpoint before entering the executable.** Snapshot the prepared kernel + validated ELF/resource mappings before EL0 `_start`; restore core/system/FP state including TLS registers, reset FD/allocator/signal/ring state under the stopped-generation barrier, then bind argv/env/input/caps, seed/clock and jump. Static libc/runtime initialization still happens per run at this boundary; do not import QuickJS's initialized-runtime latency/memory figures. No tenant resource, consumed input, output or prior grant may survive. Measure native dirty pages/peak reservation separately.

## Grow-loop readiness

The current `grow/loop.py` is fixed to **ppoll (73), rt_sigaction (134), rt_sigprocmask (135)** and its small G4 adapters. It does not already grow fstat/pread64. SQLite work therefore includes trusted slot/catalog/controller scope changes, independent probes, stat/pread argument-and-byte normalization, checked guest output capture and fd-position assertions. The current trace emitter only captures bounded read/ppoll/ioctl buffers; it cannot establish a complete SQLite differential by matching syscall numbers.

Its first-missing discovery would stop at SQLite's **tolerated faccessat**, before the fatal fstat, and at sd's **abort-path tkill**, after the fatal registered signal failure. Growth must combine application result, handler return/arguments, trace/loader/protocol failure class and native sensitivity. Never count “missing names disappeared” as an accepted after-state.

## First three growth targets and exact contracts

**1. jq 1.8.2 from unchanged upstream source, musl static build.** The tested `[.items[].n] | add` file workload already returns 7 with no handler changes, giving JSON projection/filter/reduction value immediately. Broaden to stdin, Unicode/raw output, error stderr and bounded modules through the byte transport. Add **getrandom (nr278)** backed by fresh per-run entropy with checked pointers, legal flags, partial-read/error behavior and reset tests; make guest identity/getpid (nr172) truthful if exposing it. Those are correctness work for general use, not demonstrated blockers of this query. Existing openat/read/close/newfstatat/readlinkat/ioctl/brk/mmap suffice for the observed successful path despite tolerated allocator guard-map fallback. If shipping the **official glibc release binary** instead, separately grow mprotect (nr226), entropy, fstat (nr80), and any used single-thread futex contract; our injection shows set_robust_list/rseq/prlimit64 can remain declared ENOSYS for this fixture. Do not silently relabel the musl build as the official release asset.

**2. SQLite 3.50.4 immutable, read-only DB URI.** Add **fstat nr80** over archive descriptors (and truthful pipe metadata where required), reusing the existing aarch64 128-byte stat layout; validate fds, pointers, inode/mode/size/block accounting and errno precedence. Add **pread64 nr67**: checked user destination, signed 64-bit offset, EOF/short-read/zero-count behavior, offset overflow and **no change to the descriptor's seek position**. Native sensitivity proves both matter. faccessat nr48 and getpid nr172 are observed compatibility probes but tolerated as ENOSYS for this workload; signal ENOSYS also remains tolerated. `immutable=1&mode=ro` avoids locking, journal/WAL, sync, truncate and writable FS. Keep extensions and arbitrary SQL functions out of the initial claim. Require exact query output plus direct negative/error/offset tests and deliberate wrong-page/stat-size mutations. Estimate 2–4 days for engineering/gates; the pitch's 28–44 hours includes a broader capture/video plan and is not a measured implementation time.

**3. ripgrep 15.2.0, fixed files or bounded tree, `--no-config --no-ignore --no-mmap -j1 --sort path` where ordered tree output matters.** Grow the wider ET_EXEC layout first; add **fstat nr80**; replace the current **rt_sigaction nr134 / rt_sigprocmask nr135 ENOSYS profiles** with checked, stateful, explicitly scoped single-thread registration/query/mask behavior, including Rust's SIGPIPE setup. Add **mprotect nr226** for the real stack guard and refine anonymous **mmap nr222** semantics (PROT_NONE, supported hints/fixed mappings, allocator bounds/zeroing). Native sigaltstack nr132 ENOSYS is tolerated in this normal path, so a full altstack implementation is not proven mandatory; native mprotect and signal registration failures are fatal. getrandom, madvise, sched_getaffinity and uname ENOSYS each preserve this output, but combinations and entropy semantics remain to be validated. The observed jemalloc /proc and /sys reads require fallback tests. File mmap, multithreading, PCRE2/JIT, gzip/helper search and arbitrary config are outside the first profile. Estimate 4–8 days, with a stop/go after the loader + signal/guard spike; switch profiles/tier if it expands into a scheduler.

BusyBox's six passing applets and existing Lua/MicroPython should be exposed alongside jq once the same byte/error/limit contracts are in place. sd is a useful follow-on beneficiary of Rust signal/guard work. zstd and gzip are the next byte-transport beneficiaries; **after-state not yet tested**. Choose these before investing in full Go/Haskell scheduling.

## Mapping native stdio and files to ABI-v2 /cap

This is a **proposed native-stream extension**, not something the current JSON-only ABI-v2 or shard v0 already implements. Keep v2's 16 KiB control + two 32 KiB byte-cursor rings (**81,920 bytes**), 32-byte record header, 16,384-byte record bound, release/acquire publication, owner-only cursor updates, generation/call identity, bounded reservations and SUBMIT/WAIT/FINISH. Unknown kinds/flags remain fatal until a version/feature is negotiated.

| Linux operation | Proposed mapping and required behavior |
|---|---|
| read(0) / readv(0) | Negotiated raw stdin records in host→guest ring; a small stream prefix identifies fd, byte offset and EOF separately. Copy at most requested bytes, preserve partial tails, return 0 only after buffered data drains and explicit EOF. WAIT releases the owner lane for unavailable data. Never fabricate an empty JSON line as EOF. |
| write(1/2) / writev | Negotiated distinct STDOUT/STDERR byte records in guest→host ring; flags do not claim JSON_UTF8. Fragment at the admitted maximum; with a proposed 16-byte stream prefix, an unfragmented chunk holds **16,336 data bytes** (16,384 − 32 − 16). Preserve stream order, arbitrary bytes, separate stderr, short writes/credit and total-output limits. Validate copied user/ring bytes once; control output must not be parsed as guest JSON or kernel success. |
| exit / exit_group | Explicit native completion containing exit status and drained stream state, independent of output encoding/newlines. Drain committed bytes, cancel/reconcile pending effects, stop slot before reset. Existing FINISH JSON semantics need a negotiated native completion contract; a VMM exit is never the application result. |
| open/read/lseek/fstat/pread of declared files | Immutable recipe resources stay in shared RO image extents. Per-run files bind late to admitted RO blobs/extent descriptors, e.g. `/cap/files/input.json` or `/cap/files/demo.db`, passed by argv. Expose stable size/mode/offset/EOF and independently tracked fd offsets. pread can be served locally from an RO extent; range-capability fetches use CALL/RET with bounded cache/reservation. Do not bake tenant blobs into a reusable snapshot. |
| mmap of a granted file | Later optional feature: page-aligned RO file extents and validated ranges/lifetimes, including MAP_SHARED reads and EOF/tail handling. The packed archive's names/index/adjacent files must not become visible by aliasing a partial shared page; align extents or safely stage boundary pages. File descriptors may close while valid mappings remain alive. Initial rg uses --no-mmap instead. |
| /cap/<slot>/call | A declared request commits **exactly one effect** at the documented commit boundary; use the same late-bound capability dispatcher as JS. Bind a call identity once, reject duplicate commits, read bounded reply bytes/errors then EOF, and expose readiness through ppoll. Kernel demux must drain and route other replies while this reader waits. Host policy validates the private copied arguments, grants and budgets; a file path is not a credential. |
| ppoll / blocking fd / backpressure | Per-stream/per-call predicates, generation and completion epochs feed the same WAIT lost-wakeup rule. No host helper process or thread per blocked native call. Bound outstanding IO buffers and blob reservations as well as the 80 KiB transport. |

General writable files are a separate admitted memory-filesystem contract, not implied by stdout. SQLite writes need locking/journal/sync semantics; Git checkout/index needs mutation/rename/exec semantics. Route those and the measured Go/Haskell/thread-heavy, DuckDB, FFmpeg, full Git/curl, and dynamic qpdf profiles to a **Linux tier**. HTTP effects should normally use brokered `/cap` calls rather than exposing network sockets to arbitrary CLIs.

## Reproduction, raw locations and what is not done

Repository deliverables: this report; [MATRIX.csv](MATRIX.csv), [ARTIFACTS.csv](ARTIFACTS.csv), [FEATURES.csv](FEATURES.csv); [summary.json](raw/summary.json); [validation.json](raw/validation.json); all final full/count traces, guest records, injection results and ELF metadata under [raw/](raw/). Each raw case includes exact argv, stdin hex, stdout/stderr hex, exit, load and uptime. The report's full tables are generated by `python3 arch/research/native-census/write-report.py` from those retained records.

Large source archives, extracted sources, compiler caches, release executables, copied kernel and built image binaries remain **only in `/home/dev/r6-census/` on kvm-dev** (approximately 2.9 GiB at collection; exact receipt retained). Do not stop/restart that VM. Mac report/raw use is a few MiB, below the 1 GiB allowance. Original sources/kernel and other agents' directories were read only. The shared `make -C arch/jitk test` was not run: no shared built code changed, and the other owner is concurrently modifying it. This census does not certify those concurrent changes.

Exact retained-artifact reruns (functional work; lock when comparing times):

```sh
# Existing VM, from repo on Mac. Stage this scope's *.py into /home/dev/r6-census/ if absent.
./kvm-dev/ssh.sh 'cd /home/dev/r6-census && flock /home/dev/bench.lock python3 census.py native'
./kvm-dev/ssh.sh 'cd /home/dev/r6-census && flock /home/dev/bench.lock python3 census.py jitk'
./kvm-dev/ssh.sh 'cd /home/dev/r6-census && python3 sensitivity.py'
./kvm-dev/ssh.sh 'cd /home/dev/r6-census && python3 contrasts.py && python3 qpdf.py && python3 extra-profiles.py'
./kvm-dev/ssh.sh 'cd /home/dev/r6-census && python3 analyze.py'
```

`probe-wide.py` intentionally requires a new empty `kernel-wide/` destination; retain/rename the existing diagnostic directory before another run. `media.py` is an acquisition-plus-run script requiring a new empty ffmpeg directory; rerun its recorded workload from `raw/media-workloads.json` against the retained executable instead of downloading a floating `latest`. For acquisition/build reconstruction, use **recorded URLs/digests** in provenance, and the staged acquire/build/fix scripts and build logs. `acquire.py` itself discovers current releases and is not an exact-version replay. The retained source tar and local build flags are the baseline; scripts never mutate shared code.

The Linux build uses installed `cargo +stable build --locked --offline --release --target aarch64-unknown-none --features grow-trace`, with JITK_ELF/JITK_ARGV_JSON/JITK_RESOURCES/CARGO_TARGET_DIR all set to this agent's directories, then llvm-objcopy and the copied artifact.py. This is the same pack/build pipeline as build.sh, whose hard-pinned Rust 1.95.0 is not installed in the VM; the compiler substitution is explicit in provenance. Image manifest records remain in `images/<tool>/`. No handler source/hash substitution is hidden.

**Not done:** actual SQLite/rg growth; combined-ENOSYS contract acceptance; 30 fresh-VM semantic/mutation gates; full signal delivery/threads/fork/network; static builds of Git/curl/qpdf/DuckDB/FFmpeg; static PIE; writable filesystem; large/adversarial inputs; complete locale/config/module/terminal behavior; native dirty-page/RSS/cgroup peak accounting; native entry snapshots or ABI-v2 bytes; Hyperlight/Wasm feature comparison tests. Therefore gate 9 is **partially evidenced, not passed**, and none of these results establishes a native-tool 2 MiB density class.

## Findings → recommended changes

1. **Publish the exact musl jq artifact/profile as the first native foothold.** It and eight other profiles already run in the copied current kernel. Preserve the distinction from the failing official glibc jq binary, and fix byte/error/entropy contracts before broadening the promise.
2. **Grow fstat + pread64 for immutable SQLite next.** These are the clearest measured mandatory additions, with no loader/thread/network requirement; carry forward the pitch's unchanged-binary/query demonstration and independent error/offset mutation tests.
3. **Make a bounded Rust profile for rg, then sd.** Wider ET_EXEC, real signal registration and memory protection are coupled; the two-line diagnostic proves a loader-only change does not suffice. Keep -j1/--no-mmap/config/helper restrictions explicit, and measure private memory before class admission.
4. **Make native byte streams and exit status a negotiated ABI feature.** It immediately removes the observed gzip/zstd rejection and supports Unicode/stderr/partial output. Keep ring bounds, generations, credit and host validation; do not repurpose JSON LOG into unchecked binary data.
5. **Use measured workload profiles and Linux-tier routing.** Go/Haskell runtimes, fd/qsv, DuckDB/FFmpeg and full Git/curl are infrastructure expansions, not a handful of easy syscall stubs. Record unsupported semantics honestly; fstat frequency is useful, while clone/futex frequency is a warning about scope.
6. **Extend the grow gate beyond missing-name discovery.** Record registered ENOSYS, argument-sensitive errors, fatal output protocol events and loader failures; accept a candidate only with independent semantic/error/state cases, rejected mutations and unchanged-program integration. Thirty repeats alone would not catch a false-success signal/mprotect/pread implementation.
