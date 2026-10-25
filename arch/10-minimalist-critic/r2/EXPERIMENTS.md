# Round-2 measured evidence

All writes are under area 10 or `/tmp/jitk-10/`. Docker containers are named
`jitk-10-r2-*`, resource-bounded and removed after use. No other area's kernel,
toolchain or source was modified. Existing R1 artifacts remain intact.

## 1. Boot objection: FIXED by retracting the inference

The old 27.29 ms number is a valid observation of a contended run, **not a
startup floor**. I accept the lead's objection. Contention is a plausible
explanation; no controlled causal attribution was measured. The lead's
bare 5.75 / actual qjs 8.70 ms at load ~17 are the better provisional baseline,
but neither establishes quiet-host production latency.

Command: `python3 -B arch/10-minimalist-critic/r2/bench_boot.py`.
One discarded warmup/case, n=30/case, deterministic randomized interleaving,
warm file cache, fresh process/VM, whole spawn→shutdown→reap; 64 MiB guest RAM.
Python uses a parent-side communicate timeout, with process-group kill/reap on
timeout. All 90 measured runs exit 0; qjs output is checked for `hi`.

- Original launcher, bare: p50 **11.230 ms**, p90 **12.205**, p99 **13.491**.
- One-port launcher, bare: **11.511 / 12.123 / 13.350 ms**.
- Same one-port launcher, real R1 qjs kernel: **13.952 / 14.634 / 16.578 ms**.

`uptime`: before **15.46/56.93/49.54**, after **15.02/56.15/49.31**.
This less-contended rerun is **not an idle-host experiment**; it does not
reproduce or rebut 5.75/8.70 ms. Launcher and measurement conditions differ,
and the cause of the remaining gap is UNVERIFIED. Earlier in this review the
same artifacts/harness at load **112.08/53.27/31.96 → 125.50/60.07/34.89**
gave original bare **101.171/236.777/445.063**, one-port bare
**108.157/315.218/428.029**, and qjs **427.395/784.285/1003.321 ms**, n=30/case.
Those saturated results remain in `boot-highload-results.json` and its log.
All 180 measured launches across the two runs exited 0. Identical hashes and
large variation show why shared-host timing cannot define an architecture floor.
No medians are subtracted to infer a qjs/copy cost. No qjs-ready, parked result,
CPU cost or KVM performance is inferred. Nearest-rank p99 at n=30 is the maximum,
not an SLO estimate. Full samples include load averages per launch, image/host
hashes and stdout: `boot-results.json`. The initial copied-host launch lacked
its dylib search path and aborted before measurement; the harness now supplies
a private library copy via DYLD_LIBRARY_PATH. These are C spike launchers, not
a measurement of the final sandboxed panic=abort Rust product worker.

## 2. D14: two real static-musl AArch64 executables

Built from untouched public sources in the existing **arm64 Alpine 3.22**
oracle image, GCC **14.2.0-r6**, musl **1.2.5-r13**, binutils **2.44-r3**.
Source archive and binary SHA256 receipts: `sources.json`, `build.log`.
ELF headers in `lua-elf.txt` and `sqlite-elf.txt`: both AArch64 ET_EXEC,
no PT_INTERP or PT_DYNAMIC. Sources/build products live in `/tmp/jitk-10/r2`.

- **Lua 5.4.8**: `make -j2 posix MYCFLAGS='-O2 -fno-pie'
  MYLDFLAGS='-static -no-pie'`; standard POSIX configuration, no readline or
  loadable C modules. Stripped executable **395,104 B**.
  Source checksum verified against [Lua's official download index](https://www.lua.org/ftp/).
- **SQLite 3.50.4** shell: `gcc -O2 -static -no-pie shell.c sqlite3.c
  -lpthread -ldl -lm`; no source patches, no feature-omission defines, no
  readline. Stripped executable **1,392,336 B**. sqlite3.c SHA3-256 verified
  against the [official 3.50.4 release receipt](https://sqlite.org/releaselog/3_50_4.html).
  These are pinned test builds, not claims about the latest releases.

Copied **all of 08's oracle/** into this directory. Local changes to entry.py
only select the binary/output path by environment; normalize.py gains the
verified AArch64 `fcntl=25` name mapping (`fcntl-header.txt`). The first richer
SQLite trace was correctly rejected on unknown fcntl; retained error:
`extra-first-failure.log`. The normalizer still rejects unsupported syntax,
unknown syscalls, threads, missing exits and truncation. Four original decoder
tests pass. Exact image ID: `sha256:458a19a1e97ca3687507732f8e11cc5054f97cf4989fd796f4cc9faddba08f67`;
full image/package receipts are retained, rather than assuming mutable APK
repositories rebuild byte-identically.

Each fixture has **30 strace runs plus 30 separate no-vDSO ptrace runs**.
The latter uses 08's copied no-vdso.c to clear AT_SYSINFO_EHDR, counts the target's
syscall entries after exec, and checks exit/stdout. No nested tracer or hidden
vDSO assumption. Standard runs use copied normalization and retain raw strace,
canonical JSONL, stdout/stderr and hashes. All 30 runs per fixture have one
identical syscall-name set; traces themselves are not claimed byte-identical
because addresses, time, PID and random bytes vary.

The **comparison baseline of 17** is the D10/R1 *workload union*, not a count
of 02's match arms:
`brk clock_gettime close exit_group getcwd ioctl lseek mmap mremap munmap
openat ppoll read readlinkat readv set_tid_address writev`.
`execve` is counted in raw Linux evidence but excluded from guest requirements.
An added name can be a profile-ENOSYS handler; fewer names does not mean a subset.

### Lua: load a script, read stdin, sort/aggregate, emit JSON

`lua-static /case/agent.lua`, stdin `9 1 5 3 5\n`, output exactly
`{"count":5,"sum":23,"max":9}\n`, **30/30** in both tracing modes.

- Standard strace: **14 names including execve**, 43 events every run.
- No-vDSO exposes **clock_gettime (2 calls)**; true guest union **14 names**:
  `brk clock_gettime close exit_group ioctl mmap munmap openat read readv
  rt_sigaction rt_sigprocmask set_tid_address writev`.
- **Added vs 17: 2**, `rt_sigaction(134)` and `rt_sigprocmask(135)`.
  Combined jitk+Lua set **19**; unused jitk names: getcwd/lseek/mremap/ppoll/readlinkat.
- Semantic delta: openat/read/readv/close on an immutable embedded script FD;
  fd0 EOF; signal-registration/mask calls; the first mmap is a fixed-address
  PROT_NONE heap guard, unlike 02's anonymous-RW-only accepted domain.
- **Incremental kernel LOC estimate: 200–350, UNVERIFIED**. Allocate roughly
  90–140 for immutable-file descriptors and read/readv state, 30–60 for bounded
  argv/layout/allocator contracts, 20–50 for explicit guard/signal profile
  behavior and 60–100 integration/trace/output plumbing. Components overlap;
  this is a conservative rounded planning range, excluding independent tests.
  A full signal-delivery implementation is explicitly outside this estimate.

### SQLite: in-memory table/aggregate query

`sqlite3-static -batch -init /dev/null :memory: <CREATE/INSERT/SELECT>`;
exact SQL is in measure_runtimes.py and every argv receipt. Same exact JSON
output as Lua, **30/30** in both tracing modes.

- Strace **14 names including execve**, 43 events; no-vDSO adds no name.
- Guest union **13**: `brk close exit_group faccessat ioctl mmap munmap openat
  read rt_sigaction rt_sigprocmask set_tid_address writev`.
- **Added vs 17: 3**, faccessat(48), rt_sigaction(134), rt_sigprocmask(135).
  Combined contract **20** names. No futex, threads, persistent DB file,
  filesystem locks, fsync or mmap-backed DB is exercised by this fixture.
- Semantic delta includes `/dev/null` EOF fixture, ENOENT access/open probes
  on literal `:memory:`, signal setup and the same optional guard.
- **Incremental kernel estimate: 200–350 LOC, UNVERIFIED**, mostly the same
  file/argv/profile plumbing as Lua, plus narrow faccessat handling. Do not
  sum both estimates: shared file/memory support dominates. Database persistence,
  extensions, threads and arbitrary files are outside the support contract.

### SQLite sensitivity check: time and random bytes

Same static binary, query `SELECT length(randomblob(32))=32 AND
unixepoch('now')>1700000000;`; expected `1\n`. **30/30** in both modes.
Strace 16 names including execve/40 events, then hidden clock_gettime exposed.

- Guest union **16**: `brk clock_gettime close exit_group faccessat fcntl
  getpid ioctl mmap munmap openat read rt_sigaction rt_sigprocmask
  set_tid_address writev`.
- **Added vs 17: 5**: faccessat, fcntl(25), getpid(172), rt_sigaction,
  rt_sigprocmask. Combined jitk+SQLite set **22**; Lua adds no further name.
- Opens `/dev/urandom`, sets FD_CLOEXEC with fcntl, reads 44 bytes. Support
  requires genuine bounded randomness semantics (or a clearly test-only taped
  fixture), not a silently repeated AT_RANDOM buffer. Existing clock handler
  needs correct epoch; getpid/FD flags need narrow declared behavior.
- **Incremental kernel estimate: 300–550 LOC, UNVERIFIED**, depending on vetted
  seeded-generator/virtual-device reuse. This richer fixture is not the next
  minimal demo; the Linux ABI is useful but has growing semantic obligations.

## 3. Can optional services be rejected? Measured fallback, not strict equivalence

`fallback_probes.py`: **n=30/case/profile** native strace fault injections,
exact same executable, argv, input and expected output as the base fixtures.
Both Lua and SQLite pass **30/30** when the first mmap guard returns EINVAL,
and **30/30** when all rt_sigaction/rt_sigprocmask calls return ENOSYS.
Every injection is verified in retained traces (1 guard, Lua 3 signal events,
SQLite 2). Rejecting the guard and both signal calls together also passes
**30/30 per binary** (Lua 4 injected events, SQLite 3); results are in
`results/fallback/combined-summary.json`. Combined-probe uptime before was
**75.75/87.74/57.06**; its after observation is in combined-load-after.txt.

Therefore the observed two signal names do **not** force a real signal
subsystem for these fixtures. Declare/retest ENOSYS and the optional guard
failure in the profile; it changes the Linux trace, so never call this strict
equivalence. The immutable-file FD requirement remains. Passing fault injection
does not prove the actual kernel's allocator, copies, virtio, startup or EOF.
**Neither second binary was run inside jitk in this area; that remains UNVERIFIED.**

## 4. Benchmark context and numbers (all timings are tracer overhead)

Base oracle `uptime` before **26.72/21.10/19.12**, after **27.24/21.48/19.30**.
n=30, traced wall p50/p90/p99: Lua **43.193/78.575/152.785 ms**;
SQLite aggregate **24.001/43.250/47.613 ms**. These include strace and ptrace
scheduling, not container launch; they are **not runtime performance numbers**.

Richer SQLite: before **136.86/81.00/45.50**, post-run observation
**75.75/87.74/57.06**; **1910.057/3293.339/4079.477 ms**. No performance
comparison is justified at this contention. Separate signal/guard probes:
before **124.71/70.76/40.33**, post-run observation **75.75/87.74/57.06**.
They are categorical fallback tests, not latency benchmarks. All uptime receipts
and all samples remain alongside results; shared-host load was uncontrolled.

## 5. Reproduction and scope

Read `build.sh`, `prepare.py`, `measure_runtimes.py`, `fallback_probes.py` and
copied oracle first. Existing Docker `jitk-oracle:08` image and read-only spike
artifacts are prerequisites. `python3 -B arch/10-minimalist-critic/r2/reproduce.py
--boot` rebuilds, traces all fixtures/profiles and repeats boot with private
artifacts. Omit --boot for syscall-only work. It does not install host packages.
`sources.json` records exact public download URLs/checksums. The copied Dockerfile
describes the oracle image but mutable APK repositories prevent a promise of
bit-identical rebuilds; preserve the recorded OCI image for exact replay.

Gate status: assigned syscall-surface experiment **PASS**; old 27-ms inference
**WITHDRAWN**. Less-contended n=30 boot rerun completed; quiet-host boot,
second binary on jitk, final integrated parking,
real-virtio 64-call run, real-kernel growth and bare-metal KVM are not independently
verified by this review. The one-page proposal is R2.md; per-decision evidence,
including live R2 owner notes clearly separated from R1, is DECISION-AUDIT.md.
