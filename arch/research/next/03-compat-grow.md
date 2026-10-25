# Binary compatibility, syscall coverage, and the agent-grown kernel

Research snapshot: 2026-10-25. **Conclusion: jitk's restricted static-binary tier is credible; arbitrary Linux compatibility at <=2 MiB/VM is unproven. Prioritize syscall semantics and shared memory before per-recipe kernel compilation.** A few dozen syscall *numbers* can support useful tools, but futexes, signals, memory mappings, and filesystem state dominate the engineering cost. The existing growth demonstration establishes three bounded contracts, not an autonomous general Linux implementation.

Evidence: **[P]** published measurements; **[S]** source inspected; **[D]** my recount of published data; **[E]** estimate or proposed experiment, not measured. Read all ten documents specified by BRIEF.md and inspected kernel, grow, resource-FS, VMM, executor, protocol, MCP, and benchmark material. Local source snapshot: `3b7ff54b2461c1a3b0d2fbc8815b64968f48b678`. No runtime benchmarks or growth transactions were executed in this research round. Upstream code was inspected, not executed.

## 1. What jitk actually supports today

The checked-in [`slots.json`](../../jitk/kernel/slots.json) has **24 syscall-number entries, 23 distinct handler names**; `exit`/`exit_group` share one handler. This is narrower and more precise than the brief's approximate 26. Registration includes unconditional `ENOSYS` implementations of `mremap`, `rt_sigaction`, and `rt_sigprocmask`. `set_tid_address` returns 1. `fcntl` supports descriptor flags, not locking. `mmap` accepts only a restricted anonymous read/write form; `mprotect`, `clone`, `futex`, and `epoll` are absent. Count these as restricted contracts, never 24 complete Linux syscalls. [S: handler files under `kernel/src/syscalls/`, [`build.rs`](../../jitk/kernel/build.rs).]

There is also a compatibility barrier **before the first missing syscall**: [`prepare.py`](../../jitk/kernel/prepare.py) accepts static AArch64 `ET_EXEC`, rejects dynamic/interpreter segments, and requires every load segment inside `0x400000..0x680000`: **2.5 MiB including BSS and address-space gaps**. Static PIE needs relocation support; larger tools need a different layout. [`user.rs`](../../jitk/kernel/src/user.rs) supplies a small fixed stack/auxv and direct virtual-to-physical translation. A syscall census alone cannot establish that Python, Node, or an ordinary Go/Rust build can load.

The production stdout contract is also narrower than Linux: `write`/`writev` reject bytes outside printable ASCII plus LF, and stderr is dropped outside growth tracing. Ordinary Unicode/binary tool output therefore needs an explicit transport/runner profile or encoding adapter; it is not repaired by adding a missing syscall. [`PROTOCOL-v1.md`](../../jitk/protocol/PROTOCOL-v1.md), [`writev.rs`](../../jitk/kernel/src/syscalls/writev.rs), [`stderr`](../../jitk/kernel/src/syscalls.rs). The recipe estimates below assume this output boundary is addressed.

Use the latest local measurements, not superseded R4 gate prose: quiet Apple M-series/libkrun/HVF reports **10.7 MiB footprint/VM, 4.8 CPU-ms/VM, ~6 ms raw cold boot, 0.285 ms parked one-tool**; executor cold is **9.2 ms** after watchdog replacement. These are whole-stack measurements, with incomplete HVF kernel-memory attribution, not kernel-only costs. [`FINAL.md`](../../FINAL.md), [`quickjs-verdict.md`](../quickjs-verdict.md), [`RESULTS-native-watchdog`](../../jitk/bench/RESULTS-native-watchdog-2026-10-24.md). The proposed <=2 MiB and <=1 CPU-ms targets require a new memory/VMM path, independently of syscall coverage.

## 2. What the closest systems built

### HermiTux: the direct architectural precedent

**[P]** Olivier et al., VEE'19, implement Linux load/runtime ABI compatibility, static/dynamic ELF support, syscall interception, optional syscall-to-call rewriting, and musl substitution. The prototype reports **83 syscalls**, **10,675 added/modified LOC**, **9 MB memory**, and roughly **3% compute/memory overhead**. Hardware: Xeon E5-2637, 3 GHz, 64 GB RAM, Ubuntu 16.04/KVM. Its modularization experiment used a **64-syscall** baseline: SQLite's **31 calls** reduced kernel `.text` **11.34%**, hello world's **10** reduced it **19.84%**, and a five-call minimum reduced it **21.87%**. These are executable-code savings, not equivalent RSS reductions. [HermiTux paper, §§3–5, Table 1][H].

**For jitk [E]:** the Linux ABI boundary and build-time selection are established techniques. The distinctive opportunity is automating feature discovery, implementation, and acceptance. Binary rewriting would bypass jitk's EL0/EL1 separation and checked-pointer path unless carefully redesigned; it is not a free optimization. The [upstream repository][HR] now says HermiTux is no longer actively maintained and points to Unikraft. Compatibility maintenance needs a persistent test corpus, not just a clever loader.

### Unikraft: specialization below the syscall dispatcher

**[P]** Kuenzer et al., EuroSys'21, make allocators, scheduling, locks, device/network interfaces, and compatibility APIs selectable micro-libraries. Evaluated applications produced approximately **1 MB images**, **2–6 MB minimum guest RAM**, and **<1 ms guest initialization**; total boot was approximately **3–40 ms depending on VMM**. Hardware: i7-9700K, 3.6 GHz, 32 GB, KVM, pinned cores. Reported **1.7–2.7x** application improvements concern that specialized stack, not today's binary-loader path or total host memory/VM. [Paper][U], [reproducible artifact][UA].

**[S]** Current `syscall_shim` generates dispatch/wrappers, weak unavailable-call stubs, optional tracing, and user-TLS switching; its handler configuration supports x86-64 and ARM64. [`app-elfloader`][EL] performs runtime ELF loading; the companion runner documents static/dynamic **PIE** support. Its worked deployment examples remain x86-64, so end-to-end ARM64 application coverage was **not verified here**. Source snapshots: Unikraft `359307a2a4cc9c1feb22683d841650902b799e4d`, elfloader `0cd7a2b2c4d5ece85647c0c9903b50426e849420`. [Shim configuration][US], [binary entry/TLS handling][UB], [runner][ER].

The code shows why names are insufficient: [`posix-futex/futex.c`][UF] has real wait queues, scheduler interactions, timeout handling, and explicit unsupported variants. `FUTEX_WAIT_BITSET` accepts only an all-bits mask; some operations return `ENOSYS`. **For jitk [E]:** specialize stateful subsystems behind stable helpers. Adding independent one-file handlers cannot implement scheduler-wide invariants. Conversely, keeping an unused scheduler out of a single-thread profile can matter more than deleting twenty tiny syscall wrappers.

### OSv: broader runtimes require a real OS core

**[P]** Kivity et al., USENIX ATC'14, combine one application/address space with threads, virtual memory, demand paging, VFS, networking, and Linux/library compatibility. On i7-4770 3.4 GHz/16 GB/Fedora 20/KVM, OSv+Memcached reached service in **0.6 s**, used an **11 MB image**, and achieved **127,275 versus 104,394 transactions/s**. That is a server-stack throughput result, not a sub-millisecond sandbox benchmark. [OSv paper, §4][O].

OSv's [ABI wiki][OW] explains single-process restrictions and signal difficulties, but was last edited in 2019 and contains explicitly stale statements. Do not use it as a current syscall inventory. **For jitk [E]:** OSv demonstrates the integration work behind useful compatibility; its memory or performance cannot be inferred from a count of implemented calls. It also warns against calling library ABI substitution and raw static-binary syscall compatibility the same capability.

### Lupine: a small superset can be almost as good

**[P]** Kuo et al., EuroSys'20, specialize Linux 4.0 with Kconfig and optional Kernel Mode Linux (KML). On Xeon E3-1270 v6 3.8 GHz/16 GB, one-vCPU guests, reported minima include **~4 MB image, 21 MB configured guest memory, 23 ms boot without KML**. KML conflicts with paravirtualization in the prototype: KML boot is about **71 ms**. **19 additional configuration options** cover the tested top-20 Docker applications. The general configuration adds **2 ms boot**, has similar memory, and delivers **1.19/1.20/1.29/1.15x** baseline throughput versus specialized **1.21/1.22/1.33/1.14x**. KML gives up to **40% syscall microbenchmark benefit**, only about **4% macrobenchmark benefit**. The abstract's “20 µs” conflicts with Figure 9's approximately **0.02 µs** axis; do not propagate the abstract number. [Lupine §§3–5, Figs. 7–10, Table 4][L].

**For jitk [E]:** compare one small, lazily initialized superset with a few structural profiles. Per-task specialization is a hypothesis to measure, not an assumed density multiplier. KML also changes the protection model and is not a drop-in improvement for hostile EL0 code.

## 3. Discover requirements with Loupe; use static analysis as a cross-check

Tsai et al., EuroSys'16, analyze Ubuntu 15.04 binaries/libraries and weight API footprints by package popularity. They find **224 ubiquitous syscall dependencies**, **208 ioctl/fcntl/prctl operations**, and hundreds of pseudo-files; the major weighted-coverage gains occur between the **81st and 202nd** calls. This is distribution-level, conservative API dependence, not a claim that one recipe requires 200 calls. Their important contribution for jitk is measuring operations and pseudo-files alongside numbers, and ranking additions by workloads enabled. [Tsai et al.][T].

Loupe actively replaces features with **`ENOSYS` stubs** or **success fakes**, runs an application-specific checker, repeats trials, and validates the resulting combination. A feature that is individually dispensable may not be dispensable alongside all others. Its [tool documentation][LR] and [analysis implementation][LC] provide a much closer discovery mechanism than “trace every call and implement it.”

**[P]** ASPLOS'24 reports **148 required versus 180 traced** calls across 116 applications; supporting half of its 62 OSv applications takes **37 implementations versus 92** in the historical development order. Across seven applications, average stub/fake eligibility is **46% for test suites**, **60% for benchmarks**. Crucially, altered semantics can bias metrics: Redis `munmap` removal increases memory **19%**, `close` removal increases open FDs **8x**, and incorrect `futex` treatment reduces performance **66%**. [Loupe §§4–5, Table 2][LP]. These are warnings for jitk's acceptance metrics, not permission to remove functionality invisibly.

### Recounted artifact: useful numbers with workload qualifications

**[D]** Recounted `dyn.csv` in [loupedb commit `a076cf9…`][DB]. “Required” below means `used=Y` and all three fake/stub/either classifications `N`, using the documented [CSV schema][DF]. Counts are x86-64 syscall numbers, including traced launch/loader behavior such as `execve` and `arch_prctl`; **do not add these to an ARM64 manifest unchanged**. No new executions were performed. The corpus describes environments in Dockerfiles, but I found no uniformly pinned CPU model for these coverage entries; these are coverage counts, not transferable latency measurements.

| Artifact workload | Invoked | Classified required | What the artifact actually tests |
|---|---:|---:|---|
| SQLite benchmark | 29 | 11 | Imported C/SQLite workload; not a general sqlite3 shell contract |
| SQLite suite | 50 | 29 | Imported suite; includes process/socket behavior from the wider test environment |
| Python 3 version | 20 | 7 | `python3 --version`; no imports, computation, or I/O workload |
| CPython entire suite | 175 | 156 | Exercises OS facilities intentionally; a very different target |
| Node benchmark | 38 | 14 | Async regex/string benchmark; checker script is simply `exit 0` |
| Node Express | 45 | 14 | Toy web-server workload |
| Deno | 55 | 15 | `deno run hello.ts`; not general Deno compatibility |
| Go example | 64 | 26 | **`go run` includes compiler/launcher**, not just a static executable |
| Go HTTP client | 44 | 16 | Built client, HTTP/TLS against Google; environment/network dependent |
| Rust entry | 60 | 21 | **`rustc hello.rs`**, not execution of its output |
| Rust PIE example | 23 | 8 | Actual built hello-world executable; not verified static-musl |

Sources: [SQLite data][DS], [Python version environment][DPV], [Python suite data][DPS], [Node environment/checker][DN], [Express][DNE], [Deno][DD], [Go compiler environment][DG], [Go client][DGC], [Rust compiler][DR], [Rust executable][DRE]. The SQLite/Python imported entries lack the same environment detail as newer entries. The dataset itself disclaims guaranteed correctness.

The lesson is **not “Node needs fourteen syscalls.”** It is that weak success checks can classify essential behavior as dispensable. A checker must validate exact outputs, errors, resource use, and the intended side effects. Stub/fake *combinations* must pass again. Record app hash, libc, architecture, arguments, inputs, environment, and enabled features as the compatibility unit.

### Static/dynamic tools and their proper role

| Tool | Mechanism and published evidence | Application to jitk |
|---|---|---|
| B-Side, Middleware'24 | Binary disassembly, symbolic execution, wrapper detection; 557 binaries, average **43** identified calls versus **271 Chestnut / 95 sysfilter**; **79.2%** analysis completion. Explicit soundness limitations. [B] | Find paths traces miss; x86-64 prototype needs ARM64 work. An analysis failure must not yield an empty allowlist. |
| sysfilter, RAID'20 | Egalito binary call graphs and seccomp enforcement; **411 binaries/~38.5k validation tests**, ~30k-binary survey. [SF] | Conservative candidate set; not semantic correctness of handlers. |
| Chestnut, CCSW'21 | LLVM source analysis, binary analysis, optional dynamic refinement; 18 applications, averages **302/288 calls blocked** by its two static methods. [CH] | Build-time analysis useful where we control compilation; old LLVM/toolchain and architecture assumptions need checking. |
| Confine, RAID'20 | Container/dependency static analysis; 150 images; blocks **>=145 of 326 calls** for over half. [CF] | Good superset/dependency discipline; too broad to predict a single static recipe's minimum. |
| strace + Loupe | Observed behavior plus active fault injection | Best first-day path; needs held-out inputs and resource/performance assertions. |

[B]: https://arxiv.org/abs/2410.18053
[SF]: https://www.usenix.org/conference/raid2020/presentation/demarinis
[CH]: https://www.cc0x1f.net/publications/chestnut.pdf
[CF]: https://www.usenix.org/conference/raid2020/presentation/ghavanmnia

None of these syscall-filter studies measures memory reclaimed by deleting the corresponding kernel implementation. Seccomp attack-surface reduction is not physical-memory specialization. Static over-approximation and dynamic under-coverage are complementary; neither verifies handlers' Linux semantics.

## 4. What the requested tools probably need

**All ranges below are [E] planning estimates of distinct syscall numbers needing some genuine implementation for the stated recipe, not published Loupe results or verified jitk compatibility.** They exclude the host's initial `execve`, combine suitable Linux alternatives, and assume pinned musl/static builds where feasible. Published artifact counts above constrain expectations but cannot determine these numbers. No rg or jq entry was found in the checked Loupe corpus.

| Target recipe | Planning range | First likely barrier / scope decision |
|---|---:|---|
| `jq` stdin JSON → stdout; no modules/files | **10–20** | Allocator, fd metadata, locale/time/random probes; test large input, errors and allocation failure. |
| `rg --threads 1 --no-mmap` over read-only resources | **20–35** | Directory walking/stat variants, fd flags, readlink, signal startup; some flag/build combinations may still initialize thread machinery. |
| Default parallel rg | **30–50** | Thread creation, TLS, futex, signal masks, stack mappings; count increase understates subsystem cost. |
| SQLite `:memory:` SQL/JSON, no extensions/temp spills | **15–30** | Time/entropy, allocator; verify mutex paths, and cap sorts so accidental disk use is observable. |
| SQLite read-only immutable DB | **20–35** | `pread64`, metadata/access queries, real resource reads; no writable/WAL guarantee. |
| Writable SQLite with journaling | **30–50+** | Real write/truncate/sync/locking/rename/unlink semantics; not served by current read-only archive. |
| CPython restricted JSON/text script with imports | **25–45** | Larger ELF, module filesystem, entropy/time, memory protection, signal initialization. Full stdlib suite is a different tier: artifact **156 required**. |
| Node/V8-style runtime, ordinary event-loop use | **40–70+** | Larger/dynamic ELF, threads/futex, executable mappings, eventfd/epoll/pipes, proc/resource probes; footprint exceeds kernel-wrapper costs. |
| Go `CGO_ENABLED=0` static compute/JSON binary | **25–40**, network **35–55** | Runtime creates OS threads; signal stacks/preemption, futex, large virtual reservations. `GOMAXPROCS=1` is not a one-thread guarantee. |
| Rust-musl static synchronous transform | **10–25**, threaded/async **25–45** | Much better initial fit than Go; libc startup/signals and requested libraries still matter. |

Why scope those recipes: ripgrep exposes thread and mmap controls in its [flag definitions][RG]. Go's [Linux runtime][GO] includes clone/futex/signal handling, and its [memory layer][GM] reserves/protects address ranges. jitk's eager anonymous-RW allocator cannot simply treat reservation sizes as physical allocations. SQLite's [rollback journal/locking design][SQL] and [WAL shared-memory design][WAL] require observable filesystem semantics. A single owner of a private transient DB can use a narrower contract, but must not claim durability or shared-database behavior.

**Expected trajectory [E]:** jq, synchronous Rust, serial rg, and in-memory SQLite plausibly share a **30–50-call union**. This is a hypothesis for a census, not a result: syscall names overlap but their argument domains may not. Python adds module loading and memory/signal semantics. Go/Node add scheduling and event semantics that violate today's explicit no-threads/no-signal-delivery scope. Do not promise “+five calls” beyond the exact SQLite fixture those five unblock.

## 5. Where growth fails, and where simplification is legitimate

**Threads/futex.** A waiting operation needs atomic compare-and-queue, wakeups, timeouts, interruption, TLS, per-thread stacks, and exit cleanup. Wake-before-wait races cannot be solved by returning success. The current global `static mut` FS/console state assumes serialization; adding scheduling changes its correctness conditions. One guest vCPU still has concurrent interleavings. Existing contracts also change: `exit` must end one thread while `exit_group` ends the process; their current shared whole-VM implementation becomes invalid. [S: [`fs.rs`](../../jitk/kernel/src/fs.rs), [`wait.rs`](../../jitk/kernel/src/wait.rs), [`exit.rs`](../../jitk/kernel/src/syscalls/exit.rs); comparison: Unikraft [futex implementation][UF].]

**Signals.** `rt_sigaction` is just entry configuration; delivery needs per-thread masks, pending queues, alternate stacks, ABI signal frames, `rt_sigreturn`, interrupted waits, and restart rules. Lua's observed fallback does not validate Go preemption or Python's signal behavior. Returning `ENOSYS` can be an honest unsupported feature; returning zero without installing a handler lies about state. [S: current [`rt_sigaction.rs`](../../jitk/kernel/src/syscalls/rt_sigaction.rs), [`grow/README`](../../jitk/grow/README.md).]

**Memory mappings.** Reserved versus committed pages, file-backed mappings, partial unmaps, fixed mappings, protection changes, reuse/zeroing, offsets, guard pages, and alias permissions interact. Current `mmap` eagerly zeroes and maps every requested page and uses a fixed arena; it rejects `PROT_NONE`. An implementation accepting a new flag without its semantics can fail silently rather than emit a missing-call record. This is a stronger blocker than dispatch-table size. [S: [`mmap.rs`](../../jitk/kernel/src/syscalls/mmap.rs), [`mmu.rs`](../../jitk/kernel/src/mmu.rs).]

**epoll and descriptors.** Readiness must remain consistent across nonblocking read/write, EOF, hangup, closure/reuse, one-shot/edge triggering, and eventfd/timers. A tiny implementation restricted to the protocol's one input channel is reasonable; it does not establish compatibility with libuv or a Go network poller. Stub new optional variants only when a tested fallback exists; do not fake notifications. [E, based on current [`poll_fd`](../../jitk/kernel/src/syscalls.rs) and the target runtime mechanisms above.]

**`/proc` and ABI discovery.** CPUID/auxv, CPU counts, affinity, resource limits, `/proc/self/maps`, `/proc/self/exe`, and `/dev/urandom` can affect allocators and runtime policy. Provide stable, internally consistent virtual facts or a genuine absence/error. An invented maps file inconsistent with `mmap` is worse than no file. Audit supported filesystem path/opcode combinations just as carefully as numbers. [Tsai API analysis][T]; [Gramine feature inventory][GR].

Gramine usefully documents **partial** contracts: private intra-process futexes, specific operations, no PI support, and explicit threading/signal/pseudo-file behavior. Its feature page warns that its last major update corresponds to **v1.6/November 2023**, so it is design evidence, not a verified 2026 inventory. gVisor's current generated ARM64 page lists **253 full/partial of 295 entries, 42 unsupported**; this is that table's universe, not every modern Linux syscall. Its compatibility strategy deliberately relies on runtime fallbacks and says supported-call counts alone do not predict application success. [Gramine][GR], [gVisor table][GV], [gVisor strategy][GC]. Comparable total-host memory/VM or cold-restore numbers for these two systems were **not verified** here; no density inference follows from their coverage.

### Acceptable stub/fake policy for jitk [E]

* **Prefer truthful failure:** terminal probing → `ENOTTY`, missing file → `ENOENT`, unsupported optional syscall → `ENOSYS`, writes to the archive → `EROFS`. Use Linux's operation-specific errno, not one universal fallback.
* **Implement a restricted truth:** fixed `getpid`/UID/CPU facts can describe a one-process VM; no-op CLOEXEC may be valid while exec is impossible. Record the invariant that makes the simplification valid and revisit it when that invariant changes.
* **Single-use lifetime can eliminate some reclamation:** only if a hard resource bound proves the *entire run* fits. Fake `munmap`/`close` may save code but increases peak pages/fds before teardown. Test peak private memory and descriptor exhaustion, not just successful exit.
* **Never fake an advertised effect:** entropy production, synchronization, protection, durable sync, security transitions, I/O output or notifications. Deterministic test randomness is a named recipe contract; production `getrandom` needs CSPRNG bytes from a correctly seeded stream, with clone-unique state after snapshot restore.
* Keep normal-Linux and injected-Linux results separately labeled. An injected oracle proves fallback behavior under an altered platform, not normal Linux equivalence.

## 6. Is 90/90 against Linux strong enough?

**No for expanding the compatibility claim; yes for its precisely bounded regression claim.** [`grow/loop.py`](../../jitk/grow/loop.py) deletes three known handlers and regrows only `ppoll`, `rt_sigaction`, and `rt_sigprocmask`; `SLOTS` is hardcoded. The agent prompt already specifies their intended semantics. Each transaction runs **one native reference probe** and **30 fresh guest repetitions**. Signal probes inject Linux `ENOSYS`. Thus 90/90 is three repeated fixtures, not 90 distinct syscall contracts or unseen-application support. Lua already computed successfully before those two signal stubs were installed. [S: [`agent.py`](../../jitk/grow/agent.py), [`loop.py`](../../jitk/grow/loop.py), [`README`](../../jitk/grow/README.md).]

The implementation has worthwhile safeguards: one-file proposals, controller-owned checked-copy helpers, unchanged-source hashes, strict trace normalization, complete-trace/exit requirements, external deadlines, and hashed manifests. But `adapters.py` understands only seven syscall numbers; pointer arguments often normalize to `PTR`, and trace buffers are bounded at 128 bytes. The read-only FS suite adds useful behavior—148-line raw probe plus Lua/QJS workloads, each repeated 30 times—but principally compares stdout and completion, not all kernel side effects. [S: [`adapters.py`](../../jitk/grow/adapters.py), [`trace.rs`](../../jitk/kernel/src/trace.rs), [`fs_diff.py`](../../jitk/kernel/tests/fs_diff.py).]

Thirty repetitions improve evidence about nondeterministic failure. They scarcely increase semantic input coverage. Even if trials were independent, zero failures in 30 gives only an approximately **9.5% one-sided 95% upper bound** on per-trial failure probability (`1 - 0.05^(1/30)`); pooling unlike fixtures is inappropriate. The real problem is missing input classes, not selecting a larger repetition count. [E: binomial calculation, assumptions stated.]

### A practical acceptance ladder [E]

1. **Discovery:** native ARM64 trace of the exact binary, plus active one-feature failure injection, held-out inputs, and final combined-profile validation. Distinguish missing numbers, unsupported arguments/paths, intentional policy denial, semantic mismatch, and resource exhaustion. The existing registration-based miss record cannot discover all these classes.
2. **Per-feature contracts:** port small tests for boundary pointers, overflow, alignment, zero lengths, invalid/combined flags, malformed structures, and output-buffer canaries. Compare errno *and defined output bytes*. Verify state through subsequent calls.
3. **Stateful sequences:** randomized `open/read/seek/close/reuse`, `map/write/unmap/remap`, and resource exhaustion. For threads, add wake-before-wait, timeout races, exit, and signal interruption before accepting the subsystem.
4. **Application correctness:** held-out jq programs, rg trees/options, SQLite queries/imports/sorts/errors, and runtime suites relevant to the declared profile. Check stdout/stderr/status, files, resource bounds, CPU, and latency. Verify normal Linux and the admitted restricted Linux profile separately.
5. **Isolation and restore:** existing hostile-pointer/device tests plus snapshot reset of every new writable subsystem. Mutate handlers deliberately—wrong errno, skipped write, dropped wake—to establish that acceptance detects meaningful defects.

Use [gVisor's syscall suite][GT] as a catalog of Linux-first semantic cases. Its policy adds tests for new arguments as well as calls. [LTP][LT] provides fine-grained syscall tests, but its test library uses fork/shared-memory and many cases need privileges/devices: **extract individual cases into freestanding static probes**, do not attempt the whole runner first. Linux-incompatible LTP prerequisites are skips, not passes. [LTP harness implementation][LH].

[Syzkaller's `syz-verifier`][SV] replays an existing syscall corpus across kernels and currently compares errnos; it does not itself generate new fuzz inputs. Adapt the approach, not necessarily its heavyweight executor. Its [original report][SD] identifies timing, nondeterminism, accumulated state, and intentional API changes as differential false-positive sources. Canonicalize only genuinely unspecified values; preserve alias identity, byte counts, errors, and state transitions. Independently test the oracle normalizer so it cannot erase the defect under test.

## 7. Can coverage grow while staying small and fast?

**Yes in principle, if features allocate lazily and avoid extra crossings; no evidence guarantees the target.** A dispatch entry has little intrinsic CPU cost. The relevant quantities are touched private pages, subsystem initialization, scheduling, page faults, and hypercalls. Slow emulation or a busy-wait fallback can dominate CPU even when the kernel source is tiny. A shared, unused implementation costs shared code storage rather than per-run work. [E; supported structurally by HermiTux/Unikraft and Lupine results above.]

**Current image layout gives a particularly important bound [S/E].** [`link.ld`](../../jitk/kernel/link.ld) puts `.packed` at `0x80080000`, exactly **512 KiB** after the kernel base, and asserts that kernel state fits below it. With the same payload, removing handlers inside that space does **not** move the payload or shorten the raw image. It may reduce code pages touched; this is unmeasured. The page-table declarations alone reserve **204 KiB** (`3 + 32 + 16` 4-KiB tables), plus a **64 KiB kernel stack**. These are more concrete targets than source-line counts. Shared versus private/touched behavior still requires measurement.

### Per-recipe versus one superset: quantified bounds

HermiTux's measured reductions concern `.text`, not total VM memory. Lupine's general configuration has almost the specialized configuration's throughput and memory. Neither establishes that a separate syscall set per recipe materially improves jitk density. [H], [L].

For an **unshared future layout**, suppose stripping unused functionality really removes **32–128 KiB of resident/private memory per VM**. This is an experimental assumption, not a measurement. At 10.7 MiB/VM, savings are **0.29–1.17%**. At 2 MiB/VM they become **1.56–6.25%**, giving approximately **1.6–6.7% more capacity**. Across 1,000 VMs that is **31–125 MiB**. It cannot explain a 10.7 → 2 MiB transition.

The local resource-load experiment measured approximately **0.15 ms/MiB** copied into the guest. At that slope, removing 32–128 KiB saves only **~5–19 µs** of copying; this is an extrapolation, not measured kernel-specialization latency. A shared/lazy code page that never faults in saves **zero** copy or execution time when removed. [`RESULTS-fs.md`](../../jitk/kernel/RESULTS-fs.md). Large bootstrap/initialization omissions can have larger effects; measure them independently.

For **CoW/shared images**, compare total physical memory, not summed RSS:

`M_superset = shared_union + N × private_superset + host_state`

`M_recipes = sum(shared_image_per_recipe) + N × mean(private_recipe) + host_state`

Illustration [E]: a **384 KiB** common superset versus **twenty separately backed 320 KiB** specialized kernels uses **0.375 versus 6.25 MiB** shared code if all are resident. The latter needs **5.875 MiB** of private-state savings across the fleet just to break even. Identical bytes in different files do not automatically share page-cache backing. Separate a common kernel mapping from payload/resources, or preserve shared backing explicitly; do not assume linker similarity provides deduplication.

If specialization removes **64 KiB of touched per-VM state**, it saves **62.5 MiB at 1,000 VMs** and can readily beat that duplication. If it merely removes untouched shared text, the common superset usually wins. A sensible initial profile split is **single-thread transform / read-only filesystem / threaded runtime**, based on state and initialization, rather than one binary per arbitrary syscall subset. Keep per-recipe exposed-operation policies even when code is shared. The security benefit of absent code and the density benefit of absent private state are distinct.

## 8. What 2024–2026 generated-OS research actually establishes

* **kGym/kBench, NeurIPS'24 [P]:** real Linux crash-repair environment; best reported baseline **0.72% unassisted / 5.38% with buggy files identified**. These historical models/tasks do not predict today's agent, but expose the difficulty of hardware-aware concurrent repair. [kGym][KG].
* **KernelGPT, ASPLOS'25 [P]:** generates syscall/fuzzer specifications, not kernel handlers. Reports **24 new bugs, 21 confirmed, 12 fixed, 11 CVEs**. The useful precedent is independent execution feedback and richer generated test descriptions. [Paper][KGP], [code][KGC].
* **AUTODRIVER/DRIVEBENCH, November 2025 preprint [P]:** **235 validated** kernel→driver evolution cases; evaluation of **55** achieves **56.4% compilation success**. Boot/initialization checks are weaker than functional hardware verification; this does not demonstrate autonomous driver synthesis. [Paper][AD].
* **DevGen, FSE'26 / ACL'26 demo [P]:** generates **QEMU device models**, not physical drivers: **44/50** Linux 6.18 drivers modeled; **7 previously unknown crashes**. This supports agents building test environments, while requiring an independent oracle to avoid model/implementation collusion. [FSE paper][DEV], [ACL demo][DEVD].
* **OSVBench, 2025 preprint / AAAI'26 [P]:** **245** Hyperkernel specification tasks; the downloaded arXiv table reports **38.78% GPT-4o Pass@1**, with substantial semantic/syntax failures. The table and surrounding prose disagree on some model scores; use the explicitly identified table, not a synthetic “best model” number. [Paper][OV], [benchmark][OVC].
* **OSFoundry, 2026 preprint [P]:** specification-guided xv6/RISC-V construction/evolution, **~8k specification lines/~13k generated C**, **70 functional tests**, and **9/11 Linux fixes versus 5/11 Codex**. It starts from a blueprint derived from xv6, not an unexplained OS from nothing. It is close conceptual prior art to persistent kernel-growth contracts, without establishing Linux-ABI equivalence or jitk's density target. [Paper §§5.1–5.2][OF].
* **φ-Bench, July/August 2026 preprint [P]:** **505** filesystem tasks, five trials/model/task, server Xeon E5-2687W v4/96 GB plus model APIs. Best task-category pass rates reach **61.6% debugging, 37.6% performance optimization, 41.9% new features**. Compile success and functional/performance success remain different objectives. [Paper §4][PH].

**Implication [E]:** keep model generation offline, bounded by immutable task contracts and an independently owned acceptance corpus. Let agents produce candidate handlers and adversarial tests, but do not let a candidate redefine success, normalize away mismatches, or promote its own profile. The present one-file safe-helper restriction is valuable for leaf handlers; scheduler/VM/signal changes require explicit subsystem-wide contracts. An ENOSYS-triggered loop also needs semantic-failure and performance-regression triggers. There is no evidence here that generated code alone makes broad compatibility fit a 1.6k-LOC core.

## Top 5 gaps/blockers

1. **Loader, address-space, and output limits precede coverage.** Static `ET_EXEC` only, 2.5 MiB load arena, fixed stack/VA→PA mapping, anonymous-RW-only mmap, and ASCII-only stdout block ordinary binaries or inputs before useful syscall growth.
2. **Growth is currently three known regrowth tasks.** Hardcoded slots, supplied semantics, two injected-ENOSYS contracts, and repeated fixtures cannot substantiate autonomous unseen-feature growth or broad Linux equivalence.
3. **Threads/signals are a structural expansion.** Go/Node and parallel tools require coordinated scheduling, TLS, futex, signal-frame, and mapping invariants. Adding handlers around the existing global state can introduce races and CPU-heavy fallbacks.
4. **Small syscall counts conceal missing behavior.** Loupe's version-only/compiler/weak-checker entries cannot justify general runtime claims. Writable SQLite, `/proc`, descriptor state, flags, and rare error paths need workload-specific contracts.
5. **Per-recipe density benefits are unmeasured and may reverse with sharing.** Fixed image padding can erase byte savings; separate kernel files can duplicate shared code. Total host/private memory and CPU attribution remain necessary to assess <=2 MiB/<=1 CPU-ms feasibility.

## Top 5 recommendations

1. **Run an ARM64 recipe census first (<1 day, 4–6 hours).** Pin actual jq, serial rg, SQLite `:memory:`, Rust-musl, Go-no-cgo, restricted Python and Node binaries; report loadability separately. Trace representative and held-out workloads, inject optional-call failures, validate the combined profile, and count argument operations/pseudo-files. **Expected impact [E]:** no direct RAM saving; may avoid an entire threaded-runtime subsystem. **Decision:** validate or reject the proposed 30–50-call transform union; never extrapolate from `--version`.
2. **Replace repetition-led acceptance with semantic cases (<1 day, 6–8 hours).** Extract 20–50 relevant gVisor/LTP cases, add output canaries and stateful fd/mmap sequences, and run 1,000 bounded generated sequences plus deliberate bad-handler mutations. Keep 30-run repetition for race-sensitive cases. **Expected impact [E]:** near-zero production RAM/latency; prevents accepting silent incompatibility or busy-wait regressions. **Kill:** any materially wrong mutation surviving acceptance invalidates the gate's claimed scope.
3. **Measure profile savings against a common superset (<1 day, 4–8 hours).** In an isolated experiment compare stripped, superset, and subsystem-disabled kernels with the same payload, then a shared-backed layout. Record `.text`, raw-image bytes, dirty pages/PSS, host allocations, restore p50/p99 and CPU at 1/32/256 VMs. **Expected impact [E]:** handler-only saving likely zero raw bytes today; use **32–128 KiB and 5–19 µs** only as sensitivity bounds. **Decision:** defer per-recipe binaries unless measured private-memory or latency savings exceed the build/cache cost; retain operation policies regardless.
4. **Prove or reject one threaded-runtime slice (<1 day, 6–8 hours).** Trace a precompiled Go hello/JSON binary with `GOMAXPROCS=1`; inventory actual thread, futex, signal, and mapping requirements. Design their shared state machine before writing handlers; compare with synchronous Rust and serial rg recipes. **Expected impact [E]:** avoids prematurely committing to at least one stack/TLS/scheduler state per extra thread; even a touched 64 KiB/thread would consume 3.1% of a 2 MiB budget. **Kill:** if ordinary Go needs prohibited semantics, classify it as another tier rather than weakening synchronization.
5. **Test genuine unseen growth on SQLite/jq (<1 day, 4–8 hours, bounded subset).** Choose a currently absent leaf feature such as `getrandom` or `pread64`, supply a reviewed contract, have the agent propose it, then use hidden tests, previous-profile regressions and memory/CPU gates. Record attempts, wall time, source delta, and rejected proposals. Do not attempt the full Loupe SQLite suite in this day budget. **Expected impact [E]:** small leaf-code cost, no runtime model calls; useful non-JS coverage with unchanged VM lifecycle. **Success:** the feature is necessary for a new held-out workload and passes both semantic and resource gates. **Kill:** matching an injected oracle or merely recovering existing Lua output is insufficient.

[H]: https://www.ssrg.ece.vt.edu/papers/vee2019.pdf
[HR]: https://github.com/ssrg-vt/hermitux
[U]: https://arxiv.org/abs/2104.12721
[UA]: https://github.com/unikraft/eurosys21-artifacts
[EL]: https://github.com/unikraft/app-elfloader/tree/0cd7a2b2c4d5ece85647c0c9903b50426e849420
[ER]: https://github.com/unikraft/run-app-elfloader
[US]: https://github.com/unikraft/unikraft/blob/359307a2a4cc9c1feb22683d841650902b799e4d/lib/syscall_shim/Config.uk
[UB]: https://github.com/unikraft/unikraft/blob/359307a2a4cc9c1feb22683d841650902b799e4d/lib/syscall_shim/uk_syscall_binary.c
[UF]: https://github.com/unikraft/unikraft/blob/359307a2a4cc9c1feb22683d841650902b799e4d/lib/posix-futex/futex.c
[O]: https://www.usenix.org/system/files/conference/atc14/atc14-paper-kivity.pdf
[OW]: https://github.com/cloudius-systems/osv/wiki/OSv-Linux-ABI-Compatibility
[L]: https://people.cs.vt.edu/djwillia/papers/eurosys20-lupine.pdf
[T]: https://oscarlab.github.io/papers/syspop16.pdf
[LP]: https://arxiv.org/abs/2309.15996
[LR]: https://github.com/unikraft/loupe/blob/edce8006156f39c20d6f6c5968df88007dbec018/README.md
[LC]: https://github.com/unikraft/loupe/blob/edce8006156f39c20d6f6c5968df88007dbec018/explore.py
[DB]: https://github.com/unikraft/loupedb/tree/a076cf972d7d7bacc73693455d979a9522ed2c5a
[DF]: https://github.com/unikraft/loupe/blob/edce8006156f39c20d6f6c5968df88007dbec018/doc/DATABASE_FORMAT.md
[DS]: https://github.com/unikraft/loupedb/tree/a076cf972d7d7bacc73693455d979a9522ed2c5a/sqlite
[DPV]: https://github.com/unikraft/loupedb/tree/a076cf972d7d7bacc73693455d979a9522ed2c5a/python3
[DPS]: https://github.com/unikraft/loupedb/tree/a076cf972d7d7bacc73693455d979a9522ed2c5a/python
[DN]: https://github.com/unikraft/loupedb/tree/a076cf972d7d7bacc73693455d979a9522ed2c5a/nodejs
[DNE]: https://github.com/unikraft/loupedb/tree/a076cf972d7d7bacc73693455d979a9522ed2c5a/node-express
[DD]: https://github.com/unikraft/loupedb/tree/a076cf972d7d7bacc73693455d979a9522ed2c5a/deno
[DG]: https://github.com/unikraft/loupedb/tree/a076cf972d7d7bacc73693455d979a9522ed2c5a/golang-example
[DGC]: https://github.com/unikraft/loupedb/tree/a076cf972d7d7bacc73693455d979a9522ed2c5a/golang-httpclient
[DR]: https://github.com/unikraft/loupedb/tree/a076cf972d7d7bacc73693455d979a9522ed2c5a/rust
[DRE]: https://github.com/unikraft/loupedb/tree/a076cf972d7d7bacc73693455d979a9522ed2c5a/rust-pie-example
[RG]: https://github.com/BurntSushi/ripgrep/blob/master/crates/core/flags/defs.rs
[GO]: https://go.dev/src/runtime/os_linux.go
[GM]: https://go.dev/src/runtime/mem_linux.go
[SQL]: https://www.sqlite.org/lockingv3.html
[WAL]: https://www.sqlite.org/wal.html
[GR]: https://gramine.readthedocs.io/en/stable/devel/features.html
[GV]: https://gvisor.dev/docs/user_guide/compatibility/linux/arm64/
[GC]: https://gvisor.dev/docs/user_guide/compatibility/
[GT]: https://github.com/google/gvisor/blob/master/test/syscalls/README.md
[LT]: https://github.com/linux-test-project/ltp/blob/master/doc/users/quick_start.rst
[LH]: https://github.com/linux-test-project/ltp/blob/master/lib/README.md
[SV]: https://github.com/google/syzkaller/blob/master/docs/syz_verifier.md
[SD]: https://lkml.iu.edu/2108.1/02504.html
[KG]: https://proceedings.neurips.cc/paper_files/paper/2024/hash/8e9ed2a28af7d9085180e3817b2c9a57-Abstract-Datasets_and_Benchmarks_Track.html
[KGP]: https://yangchenyuan.github.io/files/ASPLOS25-KernelGPT.pdf
[KGC]: https://github.com/ise-uiuc/KernelGPT
[AD]: https://arxiv.org/abs/2511.18924
[DEV]: https://doi.org/10.1145/3803437.3805564
[DEVD]: https://aclanthology.org/2026.acl-demo.24.pdf
[OV]: https://arxiv.org/abs/2504.20964
[OVC]: https://github.com/lishangyu-hkust/OSVBench
[OF]: https://arxiv.org/abs/2609.25018
[PH]: https://arxiv.org/abs/2608.00280
