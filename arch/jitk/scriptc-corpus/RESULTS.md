# scriptc 0.4.5 corpus on jitk

Measured 2026-10-26 on a macOS arm64 host: corpus **v0.4.5 / 4ee477d11eb9a71f0a018e5f5bed171a954fc2f7** (flat entries plus directory `main.*`), compiled by scriptc 0.4.5 to static aarch64-linux-musl ELFs. Linux reference: the same ELF under strace in `jitk-oracle:08`; Node reference: Node 24.22.0 in the pinned bookworm image. jitk: the unchanged canonical kernel (copied into `.work/kernel`, canonical release profile, `qjs,grow-trace` features) under `/tmp/jitk-r8/vmm-mac/jitk-vmm`. No corpus source, kernel or grow file was changed.

**jitk pass rate today: 161/4127 compiled programs (3.9%) with the jitk link layout; 0/4127 with scriptc's stock link layout.** A pass means byte-identical stdout, stderr and exit code to Linux with a complete guest trace. 160 of the passes also match Node. Every compiled ELF was attempted.

"jitk link layout" means only the image base changes: `zig-link.sh` passes `-Wl,--image-base=0x400000` to the same Zig linker. Source, compiler, runtime pack and code generation are unchanged. The same relinked ELF is used for Linux, Node comparison and jitk, so every comparison is like for like. Stock ELFs are refused by the packer, so all jitk results below use the relinked layout; see "Loader and packer gaps".

Stages: 4138 entries; build build-error: 2; compiled: 4127; refused: 9. Linux versus Node (compiled): linux-timeout: 4; match: 4070; mismatch: 39; reference-error: 14. jitk (compiled): crash: 3789; loader-refusal: 80; mismatch: 2; missing-syscall: 95; pass: 161.

## Tiers

| Tier | Entries | Compiled | Linux completed | Linux = Node | jitk pass | jitk pass / compiled |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | 3347 | 3337 | 3336 | 3321 | 154 | 4.6% |
| T2 | 400 | 400 | 400 | 385 | 6 | 1.5% |
| T3 | 184 | 183 | 182 | 168 | 0 | 0.0% |
| T4 | 207 | 207 | 205 | 196 | 1 | 0.5% |

T1 is stdio plus compute; T2 adds files, timers and clocks; T3 adds Workers, threads, subprocesses and async rename; T4 adds networking. Tiers are a conservative classification from source features and the observed Linux syscall set. The allocator's CPU-count probe and optional helper thread do not promote a compute program out of T1. Refused programs have source-only tiers.

| Tier | jitk outcome counts |
| --- | --- |
| T1 | crash: 3112; loader-refusal: 37; mismatch: 2; missing-syscall: 32; pass: 154 |
| T2 | crash: 345; loader-refusal: 26; missing-syscall: 23; pass: 6 |
| T3 | crash: 162; missing-syscall: 21 |
| T4 | crash: 170; loader-refusal: 17; missing-syscall: 19; pass: 1 |

Programs whose whole Linux syscall set is already registered in jitk: **52** (52 match Node). jitk outcomes for them: crash: 2; pass: 50. All T1/T2 compiled programs: crash: 3457; loader-refusal: 63; mismatch: 2; missing-syscall: 55; pass: 160.

## Why programs fail on jitk

Outcome classes:

- **pass**: byte-identical output and exit, with a complete trace.
- **missing-syscall**: the guest hit an unregistered syscall that Linux also executed, and the Linux single-syscall ENOSYS experiment did not show that call to be tolerated.
- **crash**: a fault, abort, deadline expiry, or a guest terminated by the stdout transport.
- **mismatch**: a complete run with different bytes or exit.
- **loader-refusal**: the canonical packer rejected the ELF.

A missing call that only the guest made, such as `tkill` from `abort()`, is a consequence and is not counted as a blocker. The cause column is a heuristic: the blocking missing syscall if there is one; otherwise the stdout transport limit; otherwise the **last** registered-syscall error that Linux never returned for the same call.

| First cause (compiled, not passing) | Programs |
| --- | --- |
| divergent:mmap:-22 | 3765 |
| missing:prlimit64+sched_getaffinity | 44 |
| stdout-control-byte | 22 |
| missing:sched_getaffinity | 17 |
| missing:pipe2 | 13 |
| missing:getrandom | 5 |
| missing:faccessat | 3 |
| missing:pipe2+sched_getaffinity | 3 |
| divergent:mmap:-12 | 2 |
| missing:getpid | 2 |
| missing:uname | 2 |
| divergent:openat:-2 | 1 |
| fault | 1 |
| missing:getgid+getuid+sched_getaffinity | 1 |
| missing:getpid+kill | 1 |
| missing:getppid | 1 |
| missing:getpriority | 1 |
| missing:getrusage | 1 |
| missing:sysinfo | 1 |

| Crash kind | Programs |
| --- | --- |
| abort | 3766 |
| stdout-control-byte | 22 |
| fault | 1 |

| Guest error that Linux never returned (call:ret) | Programs |
| --- | --- |
| mmap:-22 | 3836 |
| mmap:-12 | 3729 |
| fcntl:-22 | 97 |
| openat:-2 | 28 |
| readlinkat:-2 | 1 |

`mmap:-22` is the dominant blocker. The scriptc runtime allocator passes a non-NULL **address hint** without MAP_FIXED, e.g. `mmap(0x7e1000, 0x1f000, RW, PRIVATE|ANONYMOUS)` to grow downward next to an existing region. Linux treats the hint as advisory. The jitk handler returns EINVAL for any non-NULL address. The runtime then reports the allocation failure on fd2 and calls `abort()`; `tkill(SIGABRT)` is ENOSYS, and musl's `a_crash()` faults. `mmap:-12` comes from the runtime's multi-GiB NORESERVE reservation probes, which exceed jitk's 32 MiB guest. The runtime falls back from these; they appear in passing programs too. `stdout-control-byte` is the printable-ASCII stdout protocol: any UTF-8 or control byte on fd1 terminates the guest.

## Missing-syscall frequency

Each row counts programs, not calls.

- **Linux seen**: the ELF executed the syscall on Linux and jitk has no slot for it. The initial launcher execve is excluded.
- **Linux changed**: for a stable, Node-matching baseline, returning ENOSYS for that one syscall changed stdout, stderr or exit. This is a Linux counterfactual.
- **Single (Linux)**: the program's only causal Linux blocker.
- **jitk blocked**: programs classified missing-syscall on jitk with this call among the blocking calls; **jitk single**: the only blocking call.

Rows are sorted single-blocker first.

| Syscall | Linux seen | T1/T2 seen | Linux changed | T1/T2 changed | Single (Linux) | jitk seen | jitk blocked | jitk single |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sched_getaffinity | 4066 | 3677 | 0 | 0 | 0 | 3969 | 65 | 17 |
| pipe2 | 242 | 35 | 182 | 0 | 13 | 16 | 16 | 13 |
| getrandom | 74 | 71 | 74 | 71 | 68 | 5 | 5 | 5 |
| faccessat | 55 | 48 | 31 | 25 | 4 | 3 | 3 | 3 |
| uname | 51 | 3 | 4 | 3 | 1 | 2 | 2 | 2 |
| getpid | 161 | 56 | 28 | 6 | 0 | 20 | 3 | 2 |
| sysinfo | 8 | 5 | 3 | 3 | 1 | 1 | 1 | 1 |
| getrusage | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| getpriority | 2 | 2 | 2 | 2 | 0 | 1 | 1 | 1 |
| getppid | 49 | 1 | 3 | 1 | 0 | 1 | 1 | 1 |
| mprotect | 210 | 70 | 162 | 70 | 52 | 0 | 0 | 0 |
| unlinkat | 122 | 97 | 116 | 95 | 8 | 0 | 0 | 0 |
| nanosleep | 276 | 174 | 17 | 7 | 7 | 0 | 0 | 0 |
| chdir | 22 | 14 | 21 | 14 | 2 | 0 | 0 | 0 |
| statfs | 4 | 4 | 4 | 4 | 1 | 0 | 0 | 0 |
| prlimit64 | 4070 | 3681 | 0 | 0 | 0 | 2374 | 44 | 0 |
| kill | 19 | 2 | 15 | 2 | 0 | 1 | 1 | 0 |
| getuid | 60 | 6 | 2 | 2 | 0 | 4 | 1 | 0 |
| getgid | 59 | 5 | 2 | 2 | 0 | 1 | 1 | 0 |
| mkdirat | 103 | 77 | 92 | 75 | 0 | 0 | 0 | 0 |
| fchmodat | 16 | 13 | 14 | 13 | 0 | 0 | 0 | 0 |
| ftruncate | 14 | 13 | 12 | 11 | 0 | 0 | 0 | 0 |
| fchmod | 10 | 9 | 10 | 9 | 0 | 0 | 0 | 0 |
| symlinkat | 9 | 8 | 9 | 8 | 0 | 0 | 0 | 0 |
| pwrite64 | 8 | 8 | 8 | 8 | 0 | 0 | 0 | 0 |
| rt_sigreturn | 18 | 7 | 16 | 7 | 0 | 0 | 0 | 0 |
| utimensat | 5 | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| renameat | 10 | 3 | 10 | 3 | 0 | 0 | 0 | 0 |
| linkat | 4 | 3 | 4 | 3 | 0 | 0 | 0 | 0 |
| fchownat | 5 | 5 | 3 | 3 | 0 | 0 | 0 | 0 |
| fdatasync | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 |
| sigaltstack | 15 | 14 | 3 | 2 | 0 | 0 | 0 | 0 |
| fsync | 3 | 2 | 3 | 2 | 0 | 0 | 0 | 0 |
| inotify_add_watch | 3 | 2 | 3 | 2 | 0 | 0 | 0 | 0 |
| inotify_init1 | 3 | 2 | 3 | 2 | 0 | 0 | 0 | 0 |
| getegid | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| geteuid | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| getgroups | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| setpriority | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| clone | 257 | 63 | 173 | 0 | 0 | 0 | 0 | 0 |
| socket | 136 | 0 | 131 | 0 | 0 | 0 | 0 | 0 |
| bind | 135 | 0 | 130 | 0 | 0 | 0 | 0 | 0 |
| epoll_create1 | 179 | 0 | 129 | 0 | 0 | 0 | 0 | 0 |
| listen | 125 | 0 | 124 | 0 | 0 | 0 | 0 | 0 |
| epoll_ctl | 177 | 0 | 123 | 0 | 0 | 0 | 0 | 0 |
| epoll_pwait | 173 | 0 | 123 | 0 | 0 | 0 | 0 | 0 |
| connect | 126 | 0 | 123 | 0 | 0 | 0 | 0 | 0 |
| getsockname | 128 | 0 | 122 | 0 | 0 | 0 | 0 | 0 |
| getsockopt | 121 | 0 | 119 | 0 | 0 | 0 | 0 | 0 |
| accept | 120 | 0 | 117 | 0 | 0 | 0 | 0 | 0 |
| sendto | 100 | 0 | 93 | 0 | 0 | 0 | 0 | 0 |
| dup3 | 107 | 0 | 85 | 0 | 0 | 0 | 0 | 0 |
| sendmsg | 57 | 0 | 54 | 0 | 0 | 0 | 0 | 0 |
| wait4 | 107 | 0 | 44 | 0 | 0 | 0 | 0 | 0 |
| shutdown | 87 | 0 | 34 | 0 | 0 | 0 | 0 | 0 |
| execve | 108 | 0 | 19 | 0 | 0 | 0 | 0 | 0 |
| timerfd_create | 72 | 0 | 12 | 0 | 0 | 0 | 0 | 0 |
| timerfd_settime | 72 | 0 | 12 | 0 | 0 | 0 | 0 | 0 |
| setsockopt | 126 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| getpeername | 16 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| recvfrom | 5 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| rt_sigpending | 39 | 19 | 2 | 0 | 0 | 0 | 0 | 0 |
| rt_sigtimedwait | 4 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| setsid | 4 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| madvise | 4061 | 3672 | 1 | 0 | 0 | 0 | 0 | 0 |
| futex | 157 | 63 | 0 | 0 | 0 | 0 | 0 | 0 |
| umask | 97 | 0 | 0 | 0 | 0 | 94 | 0 | 0 |
| setgid | 54 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| setuid | 54 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| pidfd_open | 48 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| statx | 39 | 34 | 0 | 0 | 0 | 0 | 0 | 0 |
| sendfile | 14 | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| sched_yield | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| inotify_rm_watch | 3 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| fchown | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| gettid | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| prctl | 2 | 2 | 0 | 0 | 0 | 1 | 0 | 0 |
| restart_syscall | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| getrlimit | 0 | 0 | 0 | 0 | 0 | 2374 | 0 | 0 |
| tkill | 0 | 0 | 0 | 0 | 0 | 3860 | 0 | 0 |

Strictness note: a missing call counts as blocking unless **this program's** experiment showed it tolerated. Programs without an experiment (Linux≠Node, reference errors, unstable baselines) therefore count even ubiquitous calls as blockers. **61** of the 95 missing-syscall programs are blocked only by calls that every corpus experiment tolerated (sched_getaffinity, prlimit64, futex, umask, setgid, setuid, pidfd_open, statx, sendfile). Their real cause is elsewhere: 61 of them end in the same `tkill(SIGABRT)` abort as the mmap-hint programs. By Linux-vs-Node status: linux-timeout: 3; match: 9; mismatch: 35; reference-error: 14.

Unstable repeated Linux baselines: **10**. Programs whose Linux baseline differs from Node, times out or is unstable give usage evidence but no causal claim. ENOSYS experiments use one syscall at a time; combinations are not tested. The jitk columns are lower bounds today, because most programs stop at the mmap hint before reaching later calls.

## Loader and packer gaps

| Stock scriptc link (base 0x1000000): canonical packer | Programs |
| --- | --- |
| segment outside payload arena | 4127 |

| jitk link layout (base 0x400000): canonical packer refusal | Programs |
| --- | --- |
| segment outside payload arena | 80 |

The packer admits only static ET_EXEC PT_LOAD segments inside **[0x400000, 0x680000]** (2.5 MiB), with no page sharing between segments and no W+X. scriptc/Zig links at 0x1000000, so every unmodified ELF is refused before VM launch. These are loader results, not syscall results. Relinking at 0x400000 fixes placement. A refusal that remains under the jitk layout means the image plus .bss does not fit the 2.5 MiB window. Other layout limits: 32 MiB guest RAM, a fixed 128 KiB EL0 stack window (the ELF requests a 16 MiB GNU_STACK), no file mmap, and a read-only filesystem.

Runner bug fixed in this round: the previous run built images with an incremental Cargo profile. Rust incremental compilation does not track the `.incbin` payload inside `global_asm!`, so every image silently carried the **first** payload while the constants (entry, segments) came from the new ELF. The resulting faults were artifacts. `guest.ts` now uses the canonical non-incremental profile and refuses any image whose `kernel.bin` does not contain the packed ELF byte for byte. This would also affect any other tool that reuses an incremental jitk target dir across payloads.

## clone returning ENOSYS

On Linux, every traced clone in a stable, Node-matching baseline is re-run with clone forced to ENOSYS: changes-output-or-exit: 173; linux-node-mismatch: 19; linux-timeout: 2; survives: 63. "survives" means stdout, stderr and exit are unchanged for that exact program. The changes come from Worker, subprocess and thread programs (T3). Unresolved labels make no claim.

Supplemental allocator diagnostic (`allocator-probe.ts`, excluded from corpus counts). It keeps 400,000 objects live, which crosses the allocator's 1 MiB pre-fault threshold and makes the runtime try its optional helper thread. Linux: clone observed **true**, ENOSYS injected **true**, output and exit preserved **true**, matches Node **true**. So on Linux the runtime survives clone returning ENOSYS. jitk, same ELF: `{"outcome":"crash","cloneReached":false,"missing":["sched_getaffinity","tkill"],"errors":["mmap:-12","mmap:-22","rt_sigaction:-38","rt_sigprocmask:-38","sched_getaffinity:-38","tkill:-38"],"fault":"esr=0000000092000046 far=0000000000000000 pc=0000000000420ea8","abort":true,"trace":"99c319d1d755cb3d53c6dd987ef35044d43fcb8424a813b9d8b12b8f252ee010"}`. Reproduce with `make fallback`.

## scriptc versus Node

linux-timeout: 4; match: 4070; mismatch: 39; reference-error: 14.

| Visible program | Linux vs Node |
| --- | --- |
| 1360-spawn-sync.ts | linux-timeout |
| 1521-fs-lstat-lock.ts | mismatch |
| 1523-spawn-options.ts | mismatch |
| 1540-os-userinfo.ts | mismatch |
| 1619-cjs-esm-reexport-invisible/main.mjs | reference-error |
| 1655-spawnsync-neutral.ts | mismatch |
| 2123-ambient-import-crash/main.ts | reference-error |
| 2659-top-level-await-dynamic-cycle/main.ts | reference-error |
| 2663-top-level-await-dependency-errors/main.ts | reference-error |
| 2707-array-search-huge-sparse.ts | reference-error |
| 2893-child-stdin-duplex.ts | mismatch |
| 2894-child-stdin-backpressure.ts | mismatch |
| 2895-child-stdin-write-after-end.ts | mismatch |
| 2896-child-stdin-write-after-finish.ts | mismatch |
| 2897-child-stdin-destroy.ts | mismatch |
| 2941-fsp-lstat-identity.ts | mismatch |
| 2974-array-search-from-index.ts | reference-error |
| 4065-cycle-init-throws/main.ts | reference-error |
| 4066-cycle-top-level-tdz/main.ts | reference-error |
| 5111-var-hoisting-closures-classes.ts | mismatch |
| 5543-fs-promises-typed.ts | mismatch |
| 5632-promisify-dns.ts | mismatch |
| 5648-dns-lookup-forms.ts | mismatch |
| 5650-dns-lookup-errors-untyped.cjs | linux-timeout |
| 5747-fs-stat-throw-if-no-entry.ts | mismatch |
| 5963-date-to-string.ts | mismatch |
| 5964-date-dynamic-conversions.js | mismatch |
| 5965-date-objects.ts | mismatch |
| 5966-date-time-values.ts | mismatch |
| 5970-net-connect-host-name.ts | mismatch |
| 6140-cjs-require-tdz-throws/main.js | reference-error |
| 6230-date-parse-legacy.ts | mismatch |
| 6231-date-local-fields.ts | mismatch |
| 6610-npm-execa-child-mixin/main.ts | mismatch |
| 6611-child-properties-across-modules/main.cjs | linux-timeout |
| 8020-date-setters.ts | mismatch |
| 8025-date-subclass-setters.ts | mismatch |
| 8026-date-subclass-setters-dynamic.mjs | mismatch |
| date-zone-intervals.ts | mismatch |
| fs-native-realpath.ts | mismatch |
| node24-fs-timestamps-symlinks.ts | mismatch |

16 further non-matching programs are in the held-out subset and are not named. A mismatch means the scriptc ELF on Linux/musl and Node disagree on stdout or declared exit, and on stderr when the exit is 0. These are scriptc investigation candidates, not jitk results; triage is in SCRIPTC-GAPS.md. A reference-error means Node itself failed or did not match the corpus' declared exit, which is environmental (no network, read-only source, Alpine without subprocess tools).

| Compiler refusal code | Programs (codes overlap) |
| --- | --- |
| SC1090 | 1 |
| SC3004 | 1 |
| SC9001 | 7 |

## What to grow first

1. **mmap address hints (a registered-syscall semantic gap, not a new syscall).** Treat a non-NULL hint without MAP_FIXED as advisory, as Linux does. This is the first cause for **3765** compiled programs (3433 T1/T2). Nothing else is reachable until it is fixed.
2. **Image placement and size.** Either accept scriptc's stock base (0x1000000) or keep the relink adapter as a pinned build step; 4127 stock ELFs are refused today.
3. **Transport.** Non-ASCII stdout terminates **22** programs. Production stdout needs a byte-exact framing.
4. **Syscalls**, ranked by single-blocker programs (jitk plus Linux counterfactual), then by T1/T2 programs changed under ENOSYS. Corpus-tolerated calls are excluded:

| Rank | Syscall | Single (jitk + Linux) | T1/T2 changed | All changed | Linux seen |
| --- | --- | --- | --- | --- | --- |
| 1 | getrandom | 73 | 71 | 74 | 74 |
| 2 | mprotect | 52 | 70 | 162 | 210 |
| 3 | pipe2 | 26 | 0 | 182 | 242 |
| 4 | unlinkat | 8 | 95 | 116 | 122 |
| 5 | faccessat | 7 | 25 | 31 | 55 |
| 6 | nanosleep | 7 | 7 | 17 | 276 |
| 7 | uname | 3 | 3 | 4 | 51 |
| 8 | chdir | 2 | 14 | 21 | 22 |
| 9 | getpid | 2 | 6 | 28 | 161 |
| 10 | sysinfo | 2 | 3 | 3 | 8 |
| 11 | getrusage | 2 | 1 | 1 | 1 |
| 12 | statfs | 1 | 4 | 4 | 4 |
| 13 | getpriority | 1 | 2 | 2 | 2 |
| 14 | getppid | 1 | 1 | 3 | 49 |
| 15 | mkdirat | 0 | 75 | 92 | 103 |

`sched_getaffinity`, `madvise` and `prlimit64` appear in almost every program but are tolerated: ENOSYS leaves the output unchanged, so they belong in the grow loop's tolerated set, not its targets. A zero causal count can also mean a busy-wait fallback, an unexercised path, or no stable baseline; it does not prove a syscall unnecessary. Threads, futex and epoll stay in the T3/T4 phase.

## Held-out subset

A private seed in `.work/split-seed` (mode 0600) selects **826** of 4138 entries (SHA256(seed, NUL, name), first 32 bits mod 100 < 20). Public `census.csv` and this file contain only visible names. Aggregate counts include held-out programs. `summary.json` records only a seed commitment. The grow loop's proposer gets visible evidence only; the trusted gate runs `make heldout` (`run --id heldout --selection heldout`). Never mount `.work/`, the corpus snapshot or the seed into a proposer checkout.

## Reproduction and disk

`make -C arch/jitk/scriptc-corpus census` (or `run`) resumes the full pipeline: build, Node, Linux, ENOSYS experiments, packer, jitk. It then runs the allocator diagnostic. `make report` regenerates this file; `make test` checks the parser, classifier, tier, split and embedding invariants; `make audit` cross-checks journal, summary, CSV and pins. Per-program ELFs, traces and images are deleted after each receipt; receipts, journals and bounded mismatch snippets stay in ignored `.work/`.

Disk before:
```text
Filesystem      Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s5   460Gi   372Gi    35Gi    92%     23M  368M    6%   /System/Volumes/Data
```

Disk after:
```text
Filesystem      Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s5   460Gi   374Gi    33Gi    92%     23M  345M    6%   /System/Volumes/Data
```

Neither Docker image was rebuilt or retagged; no prune ran. At most three census containers ran at once (two oracle, one Node).
