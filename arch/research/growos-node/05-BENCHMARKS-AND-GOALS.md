# Benchmarks and goals for GrowOS → Node

Desk research, 2026-10-31. Repository HEAD when inspected: `7a4be6a51a83acba5567342f032b8066f4eb575a`. No builds, benchmark executions, Docker, VMs, Linux execution, provisioning, or dependency installation were performed. This report is the only file created or changed by this research.

Evidence labels: **[V-local]** = verified by reading repository evidence, not independently reproduced; **[V-source]** = verified in the linked upstream publication/source, not a reproduced result; **[P]** = proposed target/protocol; **[I]** = inference or estimated budget. Published numbers retain their authors' measurement boundaries. All web sources were accessed on 2026-10-31. Mutable upstream branches must be pinned before an experiment.

## Summary

- **[P] Use two connected ladders:** compatibility on independently scored real programs, then useful executions per machine/dollar. Syscall counts and agent solve rates alone do not establish runtime value.
- **[V-local] Stage 0 has an exact baseline:** 3,198/3,947 comparable compiled programs match Linux, including 644/792 held-out. The lower bound over all 4,127 compiled programs is 77.5%; the 81% result is not arbitrary Linux or Node compatibility. [R9]
- **[P] Stage 1 should earn 100/100 file-workflow cases:** unchanged jq and SQLite binaries, real cwd, writes, errors, and reset isolation. Read-only immutable SQLite queries cannot certify writable SQLite.
- **[P] Stage 2 should earn ≥190/200 preselected offline Node tests under the normal JIT**, with a separately reported `--jitless` result, and mandatory thread/futex/signal/executable-memory invariants. The 95% threshold is a product policy, not an upstream certification.
- **[V-source] LTP and gVisor are strong syscall yards; neither is a small-kernel drop-in.** Their runners and many tests assume processes, filesystems, privileges, or networking. Extract versioned executable cases without weakening assertions. [L1], [G1]
- **[V-source] Node's `parallel` suite is not a no-network/no-child-process subset.** Excluding `internet` only excludes real outbound tests; loopback and spawning remain elsewhere. A source-audited manifest is necessary. [N1]
- **[P] Keep Test262 secondary.** It checks JavaScript semantics, largely inherited from V8; V8 JIT stress plus syscall/state tests are more diagnostic for this kernel. [J1], [J2]
- **[V-local] The current QuickJS result is stronger than the original tiny-slot story:** the final glue-16m profile completes all 25 recorded v1 programs; small-job HVF reset is 34–40 µs, but real-task reset p50 is 208 µs on glue-16m, and used footprint is larger than idle footprint. None is a Node-on-metal result. [R6]
- **[P] Stage 3 means ≥10× on reset, unique memory, or usable VM density, with no regression on the other axes**, using the same Node binary and workloads against tuned Firecracker snapshot restore. A numerical planning goal is ≤0.3 ms warm reset-to-ready, derived from a historical <3 ms ARM Firecracker target; only a new same-host ratio decides. [F1]
- **[V-source] Firecracker already supports demand-paged, private CoW mappings.** A comparison against copying its entire configured RAM would be unfair. UFFD is a separate backend with an external handler, not automatically a faster or shared-memory backend. [F2], [F3]
- **[V-source] Snapshot speed is occupied prior art:** REAP reports 3.7× average cold-start improvement; FaaSnap reports up to 3.5× end-to-end improvement; Groundhog reports low median sequential-isolation overhead. These are different boundaries and isolation models. [P1], [P2], [P5]
- **[P] Use AWS `c7g.metal` first:** 64 vCPU, 128 GiB, verified list price $2.32/hour in us-east-1 Linux; use `m7g.metal` at $2.6112/hour for the memory-rich confirmation. No cloud experiment is authorized or launched by this report. [A1]
- **[P] Stage 4 should demonstrate ≥2× correct workflow replays per sandbox infrastructure dollar**, preserving task outcomes, then seek repeat external use. Node support alone does not supply the shell/process/package environment that full Terminal-Bench or SWE-bench assumes.
- **[P] Public suite + sealed release set:** publish code, development fixtures and raw losing rows; keep family-level held-outs, randomized data and graders outside the growth agent. Release used held-outs after a decision and replenish them.

## Stage-by-stage goals

All numeric thresholds below are proposals unless explicitly marked as an existing observation. Freeze case IDs, supported contract, timeout rules, artifact hashes, and denominators before work. A skipped, unbuildable, unsupported, or timed-out member of a frozen acceptance set is not a pass. Separately disclose cases outside the contract rather than implying a whole upstream suite passed.

| Stage | One primary metric and concrete target | One guard metric | Held-out set | Public demo | Kill criterion / change of course |
|---|---|---|---|---|---|
| **0 — merge grown kernel** | **≥3,198/3,947 Linux-exact comparable programs**, including **≥644/792 held-out**. Origin: measured phase-2 result, not a new ambition [R9]. Preserve the all-compiled lower-bound row, **≥3,198/4,127 = 77.5%**, so exclusions cannot raise the score. | **0 newly failing previously passing case IDs** across comparable visible + held-out cases; aggregate equality cannot hide swapped failures. | Existing sealed 792-program split; additionally retain a fresh family-level audit set, not exposed to merging/growth. Existing split is secret membership within a public corpus, not secret program content [R8]. | A clean, pinned artifact runs the same unchanged static programs as Linux, with an inspectable before/after failure ledger. Show Linux equivalence separately from Node equivalence. | Do not promote if the merged artifact cannot retain the baseline with identical inputs, or if its apparent gain comes from changed output normalization/exclusions. Timebox initial integration to **2 engineer-weeks [P]**; if blocked by oracle/transport issues, repair those rather than adding handlers. |
| **1 — cwd + per-run scratch** | **100/100 file workflows Linux-exact**, on both visible and hidden halves: 40 jq input/file cases, 40 SQLite read/write/transaction cases, 20 path/error/reset cases. Origin: a proposed small acceptance contract; Linux oracle defines 100%, with public jq/SQLite fixtures as seeds [Q1], [Q2]. | **0 cross-run scratch canary leaks in 10,000 randomized A→reset→B sequences**; unexpected residual files/fds/cwd or prior content fail. This is finite evidence, not a security proof. | 50/100 workflows held out by template family; unseen directory trees, file sizes, binary bytes, SQL data and failure sequences. Existing corpus held-out remains a regression suite. | Agent creates files in its actual cwd, transforms JSON with unchanged jq, updates a real SQLite DB, returns verified artifacts; next run starts empty. | Stop the “computer” claim if correctness needs filename-specific handlers, read-only/`immutable=1` SQLite substitutions, or disabling journaling to pass. After **2 weeks [P]**, either support the frozen file contract or explicitly narrow the product. |
| **2 — Node jitless → JIT** | **≥190/200 preselected upstream offline Node test files pass with default JIT**, minimum **90% in each declared family**. Origin: proposed 95% readiness policy against a Linux-qualified 200/200 reference; not a claimed upstream standard. Publish jitless/default-JIT scores separately; both must meet target. | **100% of a frozen 50-case kernel state suite**: threads/futex races, signal masks/delivery, poll/timer completion, executable-memory transitions and post-reset cleanup. Any violated mandatory invariant blocks advancement even if Node percentage passes. | 50/200 Node files hidden by feature family; hidden scheduling seeds and input sizes for all 50 state cases; fresh modules/JIT shapes not used during growth. Do not select tests after seeing GrowOS results. | Unchanged Node source/binary runs async fs + timers + `worker_threads`, then a loop that demonstrably optimizes/deoptimizes under V8. Both results match Linux across reset. | Do not call JIT “done” if it actually falls back to jitless, suppresses assertions, patches Node APIs, or weakens the hardware boundary. Reassess after **4 engineer-weeks [P]** without a general path to the manifest. Fork/exec and general sockets are separately declared gaps, not hidden failures. |
| **3 — decisive Linux-metal gate** | **Benefit factor B ≥10**, defined below: at least one of reset (both p50 and p99), unique MiB/VM, or VMs/box at SLO improves ≥10× against the best qualifying Firecracker configuration, while all other ratios are ≥1. Origin: owner's investment rule. **≤0.3 ms warm reset-to-ready** is only a planning target derived from historical <3 ms ARM restore [F1]. | **0 regressions in the matched outcome/SLO/resource contract**: same correct outcomes; no worse other gate axes, CPU/correct run, or cost/correct run. Evaluate uncertainty conservatively, not by rounding ratios. | Sealed 20% of workload families/data plus mixed-order dirty-set sizes, snapshot diversity and 1% hostile jobs. One untouched confirmation on a second metal allocation. | Live density/latency board: same JIT Node, same jobs, full-Linux Firecracker versus GrowOS; click through raw samples, failures and accounting. | **No ≥10× advantage, or any material regression elsewhere ⇒ no-go for the broad custom-kernel investment.** A failed/incomplete comparison is “not decided,” never “go.” Tune Firecracker first; allow one preregistered rerun for a diagnosed harness issue, then narrow to a workload with demonstrated value or use Linux. |
| **4 — SDK, npm layers, tool bridge, Python** | **≥2× correct workflow replays per sandbox infrastructure dollar** versus tuned full-Linux microVMs, at the same frozen per-workflow p99 SLO. Origin: proposed product hurdle: a 10× primitive win must survive SDK/layer/I/O overhead. Score 100 pinned workflows, not hello-world. Model spend is disclosed separately and in all-in totals. | **0 lost task successes versus Linux on paired frozen-agent replays** across the 100 workflows; preserve each successful reference outcome, not merely the aggregate. | 25/100 workflows held out by package/task family, including Python, npm loading, binary file round trips, cancellation, and bridge-denial cases; external pilot inputs arrive after release freeze. | One SDK runs Node/npm + Python artifact jobs with a policy-checked tool bridge; a Harbor adapter runs an explicitly supported task subset. Full terminal-agent demo only after shell/process support exists. | After **4 pilot weeks [P]**, if the benefit is <2× or **fewer than 3 independent teams voluntarily repeat ≥100 correct runs/week**, stop broad productization and interview/narrow. The adoption test complements the benchmark; it cannot be replaced with a synthetic score. |

**Common release requirements [P]:** preserve prior-stage regression sets; zero observed forbidden host effects; complete cleanup; calibrated deadlines; named remaining gaps. Performance success cannot waive them. Historical R4 exposure failures are frozen artifact-specific evidence; the current README explicitly warns against treating that ledger as today's state [R1]–[R3]. Requalify the exact release, rather than declaring either that old failures are current or that later functional receipts erase them.

### Target construction and honest hill-climbing

**[P] Separate three loops.** (1) Developer loop: 20–50 relevant visible cases, target ≤30 seconds once artifacts exist. (2) Candidate loop: affected syscall families + representative unchanged integrations, target ≤5 minutes. (3) Sealed release loop: full fixed denominators, ≥3 repetitions for nondeterministic/racy cases, then the metal campaign. These are latency budgets for future automation, not measured runtimes. If a syscall needs longer stress, keep a short diagnostic slice and an overnight remote stress lane; never shorten the release test merely to meet the loop budget.

**[P] Stage-4 workload composition:** freeze 40 npm/module workflows, 30 Python workflows and 30 artifact/tool-bridge workflows, split 75 visible / 25 hidden by family. Include medium jobs and repeated multi-call work, not only tiny computations; qualify reference solutions on Linux first. Frozen agent-generated programs isolate execution effects. A smaller paired live-agent pilot checks adaptation and UX, with its model, sampling, turn/token limits and costs disclosed; it does not establish statistical task-success equivalence.

The historical scriptc corpus cannot supply all held-outs forever. Its existing roughly 20% split is by filename hash [R8]; near-duplicate tests can straddle it. **[P] New sets split by provenance/template/package family**, with different data and state histories on the hidden side. The release evaluator controls the seed commitment, data, binary hashes and expected results. Keep these outside proposer checkouts, prompts, tool outputs and retry feedback. Return coarse category feedback during iteration; limit hidden submissions to one per candidate release. A pass/fail oracle itself leaks information under unlimited queries.

**[P] Test the evaluator.** Before growth, run known wrong-return/state-corruption/reset mutants and require meaningful rejection, plus correct Linux controls. A timeout or crash of an invalid mutant is not semantic coverage. The local grow README already distinguishes mutation-based test qualification from grading the candidate; retain that distinction [R7]. Add mutations for path aliasing, stale fd offsets, lost wakeups, short writes, signals during waits, omitted JIT cache synchronization, and old scratch content.

**[P] Publish two denominators:** all selected cases and eligible-by-frozen-contract cases. Publish unknown/unavailable cases separately. For Stage 0, retain both comparable and all-compiled scores; do not silently shrink 3,947 after a drift. For Node, report file count, assertions/subtests if obtainable, skips, requested features and families. Five repeated copies of a test are five samples, not five independent capabilities.

## Benchmark survey

### Reading the cost/time column

**No suite runtime was measured in this research.** Except where a source explicitly supplies a number, durations below are **[I] remote execution budgets after building/installing artifacts**, excluding one-time setup. They are not portable performance facts. At the verified c7g.metal price, 5/15/60 minutes cost about **$0.19/$0.58/$2.32** for the host alone. Model/API, storage and network charges are additional. Full upstream campaigns often have no fixed runtime; report actual setup and run time on the first remote pilot.

### Kernel, libc and runtime correctness

| Yardstick | What it measures / how to run | Cost/time and gaming risk | Fit for Sofort |
|---|---|---|---|
| **Existing scriptc corpus + v1** [R4], [R5], [R8], [R9] | Corpus: same ELF against Linux, exact stdout/stderr/exit. v1: same recorded programs/tools and independent answers, S1–S5 serving scenarios. The existing reducer keeps failures and supports raw-data verification. | **[I]** affected-case pilot ≤5 min; full corpus budget 30–120 min until calibrated. High risk if output normalization, link layout, fixture membership, memory class or denominator changes. v1's 25 programs are public training data. | **Stages 0–4.** Reuse runner/oracles; add Node adapter and held-out families. Current S5 RSS and sampled child CPU are insufficient for decisive memory/CPU claims [R5]. |
| **LTP syscall subsets** [L1] | Reliability and syscall semantics. Current docs use `./kirk -f syscalls`; older releases use `./runltp -f syscalls`. Individual prebuilt tests can run directly. Select fd/path/memory cases first, then clone/futex/signals/epoll. Keep upstream expected return/error/state checks. | **[I]** 20–50 selected cases: 1–5 min; broad suite: hours or more, unknown here. Many cases need root, mounts, helpers or destructive stress. Gaming: treat `TCONF`/unbuilt tests as successes, skip hard variants, implement only observed arguments. | **Stage 1 selected files; Stage 2 selected concurrency/memory.** Host-side orchestration can launch one executable per VM; no need to port the complete shell/Python runner into the guest. Some C tests internally fork: retain them as blocked until support exists. |
| **LTP quickhit; Open POSIX Testsuite** [L2], [L1] | Historical `quickhit` is a small syscall selection, **not a guarantee of no processes or cheap execution**. Open POSIX has independent configure/generated makefiles and interface tests. Build exact selected binaries remotely. | **[I]** selected POSIX cases 2–10 min. `quickhit` was found in an Android LTP revision; requested raw upstream paths returned 404, so do not assume it is a current installed suite. Naming/privilege skips can game both. | Use historical quickhit as a case-discovery list. **Stage 2** POSIX thread/signal cases are useful; full POSIX is outside early scope. Pin revision and publish an explicit Sofort subset. |
| **gVisor syscall tests** [G1] | C++ GoogleTest suites designed to run against Linux and gVisor. Example reference: `bazel test //test/syscalls:access_test_native`. Individual binaries allow `--gtest_filter`; target architecture/libc/toolchain must be pinned. | **[I]** 50–200 relevant cases: 2–10 min; all targets unbounded here. Building Bazel/C++ dependencies is separate. Selective filters or changed skips can inflate coverage; many helpers assume procfs/fork/mount/network. | Excellent **Stages 1–2** semantic source: filesystem, mmap/mprotect, signals, futex and epoll. Guest packaging/static linkage is engineering work, not something upstream promises works on GrowOS. Native Linux is the oracle; running `runsc` itself inside GrowOS is unnecessary. |
| **musl `libc-test` functional/regression** [M1] | libc-agnostic suite maintained by musl's math-library author. Upstream says functional/regression tests should pass, with exceptions elsewhere for optional features/math accuracy. Build selected static AArch64 executables against the same musl remotely; run each unchanged under Linux and guest. | **[I]** selected OS-touching cases 1–5 min; full functional/regression 10–30 min budget. Math/string tests can dominate the score without exercising the kernel. Upstream checkout was bot-blocked here; exact build-target syntax is **not verified**. | **Stage 0** pure-libc smoke; **Stages 1–2** stdio, allocation, pthread/signal/time tests. Report categories separately and test the actual linked libc. It is neither a Linux-kernel certification nor solely kernel tests. |
| **jq tests + writable SQLite/SQL Logic Test** [Q1], [Q2] | jq's test driver invokes `jq --run-tests tests/jq.test`; supplement expression tests with input files, cwd and output artifacts. SQLite's public testing account distinguishes Tcl, SQL Logic Test and other harnesses. Drive frozen SQL batches against unchanged `sqlite3` and compare results/database state to Linux. | **[I]** Stage-1 100 cases ≤5 min; a larger SQL corpus 10–60 min budget. Full SQLite testing is vastly larger and includes harness requirements. Gaming: only in-memory SQL, omit rollback/locking, disable journaling, or compare outputs without file effects. | **Stage 1 primary demo.** Single-process transactions/rollback first. Multi-process contention, WAL shared memory and crash-durability are separate capabilities. Ephemeral RAM scratch does not promise persistence across power loss. |
| **Node core tests** [N1], [N2], [N6] | Host-side `tools/test.py` handles test selection, metadata, timeout and an alternate Node executable (`--shell`). For GrowOS, a wrapper launches one guest per selected test. Direct `node test/parallel/<file>.js` is valid only with required metadata flags/env and fixtures preserved. | **[I]** 200-file offline set 5–15 min; broader default suites 30–120 min budget. Interpreter-only success, disabled features and skipped assertions can inflate results. No portable measured suite duration was found. | **Stage 2 primary compatibility metric.** Begin pure computation/Buffer/path/events, then streams/timers/fs, then worker threads and executable-memory cases. Exclude unsupported facilities in the contract before tuning; still show the full selected denominator. |
| **Test262** [J1] | ECMAScript conformance: fresh realm per test, harness files, strict/non-strict variants, async completion and feature metadata. Use a compliant runner; invoking every file as ordinary Node CommonJS is invalid. | **[I]** 500-case smoke 1–5 min; full suite tens of minutes to hours depending on process startup/variants. Easy to game with missing harness APIs, treating negatives as passes, dropping async/agent cases. | Secondary **Stage 2** regression signal for V8 integration. Most arithmetic/language behavior was implemented by V8, not GrowOS; Atomics/concurrent-agent cases touch kernel-relevant behavior. Not the headline hill to climb. |
| **V8 mjsunit / regress / JS perf tests** [J2] | V8's own runner supports suite/case filters; existing `d8` artifacts can run tests. Its performance runner is separate from correctness runs. Many tests need V8 shell globals/intrinsics unavailable in normal Node. | **[I]** 50 selected JIT/regression cases 1–5 min; broad suites hours budget. Optimizer flags, warmup and invalid adaptation can game results. Do not rewrite assertions to make Node accept `d8`-specific files. | **Stage 2 targeted companion** and **Stage 3 JIT-heavy workloads**. Prefer Node-valid stress programs plus separate upstream `d8` conformance rows. Confirm optimization/deoptimization and restored executable code before timing. |

#### A genuinely offline, no-child-process Node subset

**[V-source]** `internet` means real outbound connections; tests elsewhere can use local sockets. `parallel` and `sequential` describe scheduling, not capabilities [N1]. Also, `test/common/index.js` can respawn Node when required `// Flags:` or `// Env:` metadata is missing [N2]. A naive import grep is insufficient: helpers can spawn indirectly, and importing `net` is not itself a socket operation.

**[P] Construct the 200-file manifest on remote Linux before kernel work:** 40 Buffer/encoding, 40 events/path/util/assert, 40 streams/timers/promises, 40 fs/module-loading, 40 workers/Atomics/crypto/JIT-related files. These are proposed quotas, **not a verified count of eligible tests in v24.22.1**. Source-audit recursive helpers, flags, fixture paths and status rules. Trace two Linux runs per candidate for `execve/clone` distinctions, socket use and filesystem effects. A thread creation is allowed in the later group; process spawning is not. If a quota lacks eligible files, revise and publish the manifest before evaluating GrowOS, not after failures.

Verified candidate bodies include `test-path.js`, `test-event-emitter-add-listeners.js`, and `test-timers-immediate.js`; none of those bodies spawns a process or opens a socket [N3], [N4], [N5]. This is source-level eligibility, not a claim they currently boot on GrowOS. Crypto tests can use worker pools without external networking; filesystem tests can spawn indirectly; classify actual behavior.

Preserve upstream flags and env from a **host** runner so `common` need not respawn. Run the normal and `--jitless` binary modes with identical files. Keep timeout/skip handling in the trusted wrapper; do not set `NODE_SKIP_FLAG_CHECK` to bypass required semantics. Exclude `internet`, inspector/debugger, child-process/cluster, external commands, addon builds and actual sockets from this initial subset, with reasons. Loopback networking can be a later, independently scored expansion.

For the JIT demo, **[P]** use separate diagnostic runs with optimization/deoptimization traces and kernel executable-mapping observations; then disable verbose tracing for timed runs. Test a fresh request after restore, randomized code shapes, GC, compiled-code reuse, thread wakeups and an executable page modified/reused across runs. Test262 passing or a fast arithmetic loop alone does not prove that V8's JIT executed correctly.

### Sandbox latency, lifecycle and academic yardsticks

| Yardstick | Verified measurement / how to run | Cost/time and gaming risk | Fit / what to borrow |
|---|---|---|---|
| **Superagent AI Code Sandbox Benchmark 2026** [S1] | January article compares DX/features/pricing and lists roughly 150 ms E2B, 90 ms Daytona, 25 ms Blaxel. The inspected page does not provide a reproducible timing campaign, raw latency samples or runner. | Reading is free; repeat timing time/cost **unknown from this source**. Vendor-style create/resume numbers have different boundaries. Do not treat these as matched measurements or derive a 10× local-kernel claim from them. | **Stage 4 DX checklist/context**, not Stage 3 baseline. A separately mentioned “agent experience” benchmark could not be verified at the guessed page; no results from it are relied on here. |
| **LogRocket sandbox comparison** [S2] | Article reports create→executed-command and resume→executed-command timings: E2B 717/662 ms, Daytona 742/1,254 ms, Modal 2,437/2,347 ms. It explicitly distinguishes Modal snapshot boot from in-place resume. | Exact per-run campaign cost/time and statistical sample count are **not established here**; no portable p99 follows from the displayed point figures. Region, network, cached image and persistence differences can dominate. | **Stage 4 user-facing boundary.** Borrow first verified command as readiness; do not compare these hosted times to an in-process 40 µs reset or copy their isolation ranking as technical proof. |
| **ComputeSDK Burst TTI and DAX** [S3], [S4] | TTI: create to first successful `runCommand`, 100 concurrent sandboxes/run, raw JSON published. DAX: package setup, Node/Bun, pinned repository clone, install and typecheck phases. Public repo supplies adapters/campaign code. | **[I]** TTI pilot 1–5 min; DAX 5–20 min/provider, plus API/billing minimums. Composite weights, provider CPU allocations, registry locality and warmed caches affect ranking; show raw distributions/successes. | TTI is a strong **Stage 4 public demo format**; DAX is a later full-development-environment check, requiring packages/network/processes not promised by Stage 2. Pin a dated result, not the moving leaderboard. |
| **Firecracker upstream snapshot docs** [F1], [F2], [F3], [F4] | Historical v1.0 docs give ARM restore target <3 ms for 2 vCPU/512 MB/one disk/one net device, x86 <8 ms with 5 ms p90. Current snapshot docs no longer make that numeric promise. Run a new same-host prepared-Node experiment. | **[I]** matched pilot 2 hours; decisive campaign 8–16 hours/host, about $18.56–$37.12 c7g compute. Not a cost to reproduce an official fixed benchmark. API-only timing, eager full-copy baselines, or overconfigured guests mislead. | **Stage 3 mandatory baseline.** Modern File/CoW restore and tuned UFFD must be considered. Production host docs record console logging changing ARM restore from 3 to 8.5 ms: publish host configuration [F4]. |
| **REAP (ASPLOS 2021)** [P1], [P1a] | Records stable page working sets and prefetches them; paper reports **3.7× average reduction in cold-start delay** relative to baseline snapshotting. vHive is a research infrastructure starting point. | **[I]** adapt a small workload pilot in 1 remote day; full original reproduction may take days. Setup/version archaeology is separate. Gaming: learned working set matches evaluation input, cold cache only on the losing side. | **Stage 3 protocol inspiration:** measure first-result faults and fresh-input working-set changes. Do not import its speedup as an absolute reset baseline. |
| **FaaSnap (EuroSys 2022)** [P2], [P2a] | Compact loading sets, region-aware mapping and concurrent paging; reports **up to 3.5× end-to-end improvement**, averaging **3.5% slower than memory-cached snapshots**. Artifact has modified Firecracker/kernel, rootfs, Redis inputs and `sudo ./test.py test-2inputs.json`. | **[I]** 1–2 remote days for artifact setup; 2–8 hours per selected matrix. Historical x86 build path is documented; AArch64 portability is **unverified**. Page-set training/input leakage can favor it. | **Stage 3** strong optimized-baseline lesson. Stock Firecracker + a basic UFFD handler is not the same system as FaaSnap. Report a FaaSnap-inspired optimization as such, rather than claiming original reproduction. |
| **Catalyzer (ASPLOS 2020)** [P3] | Published system targets sub-millisecond startup using initialization-less booting and sandbox fork. Paper includes application, concurrency and memory experiments; NodeJS-Web cached metadata is about **302.6 KB**, **not total sandbox footprint**. | **[I]** original setup/reproduction several remote days; an adapted workload slice 1–4 hours after setup. Cache-point placement and calling metadata “memory per sandbox” can inflate claims. | Prior art for **Stages 2–3**. Borrow runtime-only versus function-specific snapshot distinction and PSS accounting. No drop-in ARM runner or matched Node reset figure was verified. |
| **SEUSS (2019 preprint / EuroSys 2020 lineage)** [P4], [P4a] | Unikernel snapshot stacks/shareable initialized environments. Inspected preprint reports **50× lower minimal uncached deployment time**, **17× more concurrent environments**, and 51× uncached-workload throughput against its container/OpenWhisk setup. | **[I]** several remote days for EbbRT/OpenWhisk environment; original experiment cost unknown. Baseline, snapshot cache point and workload diversity strongly determine the ratio. Repo is a proof of concept, not an off-the-shelf ARM product benchmark. | **Stage 3 prior art** closest to the “full runtime in tiny snapshot” narrative. Its container baseline is not modern Firecracker, so 50× is not a target directly transferable to Sofort. |
| **Groundhog (EuroSys 2023)** [P5], [P5a] | Sequential request isolation via restoring process state. Three suites: median end-to-end latency overhead **1.5%**, 95th-percentile overhead across tested workloads **7%**; median throughput overhead 2.5%, 95th 49.6%, relative to insecure runtime reuse. | **[I]** several remote days to reproduce integration; 1–4 hours for a selected reset slice after setup. “95p overhead” here is not a per-request p99 latency. Long functions can hide expensive resets. | **Stage 3 reset methodology / Stage 4 alternative.** Pair arbitrary attacker-written code only with an independently suitable containment layer; process rollback alone is a different boundary from one hardware VM per run. |
| **SeBS** [P6] | Open serverless benchmark suite/framework with application functions and input generation. Run a selected function/input campaign via its documented deployment/experiment tools; retain runtime/deployment config. | **[I]** 10–30 min selected local/remote function slice after setup; cloud campaign cost depends on provider. Picking CPU-heavy functions can hide isolation overhead; external services can dominate. | **Stages 3–4** workload source, especially bounded Node data work. Adaptation removing cloud storage must be disclosed. Do not claim full SeBS results for three borrowed functions. |

### Agent workloads and 2025–2026 sandbox evaluations

| Yardstick | What it measures / how to run | Cost/time and gaming risk | Stage fit |
|---|---|---|---|
| **Terminal-Bench 2.0 + Harbor** [B1], [B2], [B3], [B4] | Versioned 89-task research benchmark of terminal tasks, task-specific verification and container environments. Harbor provides custom sandbox lifecycle/exec/file-transfer interfaces. Typical job uses `harbor run -t <task> -a <agent> -m <model> -e <environment>`; freeze dataset version rather than asserting 2.0 is latest. | **[I]** 5-task pilot: 30–120 min, **$20–$100 model budget**; full evaluation hours/days and model-dependent. Tests/task instructions are public; writable tests or reward files allow cheating. Use an independent/separate verifier where applicable. | **Stage 4 only for supported subset.** Shell, pipes, multiple processes, tools, dependencies and sometimes services are required. Node JIT is insufficient. Run oracle/reference solutions first to measure environment compatibility, then identical agents to measure usefulness. A subset is not an official full score. |
| **SWE-bench / Lite / Verified-style harnesses** [B5], [B6] | Apply a proposed patch and run repository tests in Docker. Official entrypoint: `python -m swebench.harness.run_evaluation --dataset_name princeton-nlp/SWE-bench_Lite --predictions_path <file> --max_workers <n> --run_id <id>`. Patches/reference tests can be frozen to remove model variance. | **[I]** 5-issue replay 15–90 min after images; full hundreds of issues hours/days, image storage and setup substantial. Public issue/patch leakage, changed tests and broken environment setup can corrupt scores. | **Late Stage 4 / broader roadmap.** Python/build tools/process trees needed; verify ARM image availability per instance. A host-Linux Docker grader can validate returned artifacts, but must not perform the unsupported in-sandbox execution on GrowOS's behalf. |
| **Kubernetes SIGs Agent Sandbox performance tests** [B7] | Current docs include Go E2E startup/claim and warm-pool benchmarks plus ClusterLoader2 scale tests. Example `go test -bench=BenchmarkChromeSandboxClaimStartup -benchtime=10x ./test/e2e/...` against a live configured cluster. | **[I]** 10–30 min smoke after cluster provisioning; cluster/day-scale campaigns expensive relative to a kernel loop. Pod readiness, warm-pool adoption and sustained replenishment are different measurements. | **Stage 4 control-plane yardstick**, not Stage 3 kernel baseline. Borrow burst versus sustained load and warm-pool exhaustion tests; do not deploy Kubernetes just to compare local reset. |
| **FrigaZzz agent-sandbox-benchmark (Oct 2026 snapshot)** [B8] | Public independent-code checks, retained failures/fingerprints and **975 heterogeneous attempts**. Fixtures include exact stdout, binary transfer, CSV pipeline, offline wheel, persistent files/recovery. CLI: `python -m src.cli run --backend <provider> --suite realistic --repeats 5`. | **[I]** 5-repeat selected-fixture pilot 5–20 min plus provider charges. Source warns 5/5 pilot cohorts are not SLAs; documented list usage is not invoiced cost. Heterogeneous counts cannot be pooled as reliability. | Useful **Stage 4 contract seeds**, especially output fidelity/cancellation/artifacts. Port selected fixtures, preserve independent evaluator. It is a recent community benchmark, not a de facto standard or containment proof. |
| **ControlPlane sandbox-probe (2026)** [B9] | Agentic sandbox enumeration/exposure checks; its reports inventory boundary/configuration surfaces. Run only a reviewed, bounded subset against the exact permitted profile on remote test hosts. | **[I]** selected non-exploit probes 5–15 min; larger adversarial work separately budgeted. A feature fingerprint or failed known probe is not proof against unknown escapes. Kernel exploits are neither required nor appropriate for routine performance scoring. | **Stage 4 security guard source**, plus targeted negative tests earlier. Keep it separate from latency/goodput, with an explicit threat model and known coverage. |

**[I] Recommendation:** the recurring public hill should be a small **Sofort Linux-equivalence + reset benchmark**, composed from upstream tests and real data jobs, rather than a weighted “best agent sandbox” ranking. Publish exact subset names, versions, feature dependencies, oracle decisions and losing rows. Use full agent evaluations less frequently, because model variance/cost and multi-minute tasks obscure microsecond reset improvements.

## Stage 3 gate protocol

Everything in this section is **[P] an experiment specification**, except explicitly cited upstream behavior, verified prices, and the historical baseline. It must run on rented/dedicated Linux metal, **never on this shared laptop or a local Linux VM**.

### 1. Decision contract and hardware

Use `us-east-1` On-Demand Linux rates verified directly from AWS's public price feed [A1]. These exclude EBS, egress, tax, setup time and other services. Availability/capacity and quota were not tested.

| Host | Hardware advertised in the pricing feed | USD/hour verified | Purpose / estimated compute-only allowance |
|---|---|---:|---|
| `c7g.metal` | 64 vCPU, 128 GiB, EBS-only, Graviton3 family [A2] | **2.320000** | Primary CPU/density gate; 16 h = **$37.12** |
| `m7g.metal` | 64 vCPU, 256 GiB, EBS-only | **2.611200** | Confirm memory-limited density on independent allocation; 8 h = **$20.89** |
| `m6g.metal` | 64 vCPU, 256 GiB, EBS-only | **2.464000** | Optional older Graviton reference; historical Firecracker ARM test family |
| `c8g.metal-24xl` | 96 vCPU, 192 GiB, EBS-only | **3.828480** | Optional newer-generation check; 8 h = **$30.63** |
| `c8g.metal-48xl` | 192 vCPU, 384 GiB, EBS-only | **7.656960** | Only if scaling question warrants it; unnecessary for first gate |

**Initial budget [I]:** 16 h c7g + 8 h m7g ≈ **$58.01 compute**, before disk/network/setup. Reserve **$100–$150 total [P]** for a bounded first campaign; this is a planning allowance, not a provisioned resource or an invoice prediction. At least two independent allocations are desirable; one busy host cannot establish reproducibility. The full Cartesian matrix can exceed this allowance: preregister a bounded pilot and decisive subset, record actual setup time, and stop at the campaign cap rather than silently expanding spend. A remote prepare-only pilot should fail fast if `/dev/kvm`, AArch64 virtualization, required interrupt-controller support or guest features are unavailable.

Freeze host AMI, kernel/KVM version, page size, Firecracker release/commit, jailer/seccomp configuration, microcode/firmware if exposed, Node/libc/OpenSSL/ICU versions, guest kernels, rootfs/snapshot hashes, CPU affinity and clock policy. Use cgroup v2, quiet host logs and equal mitigations. Record THP/KSM/swap settings; default **swap off, KSM off**, same base-page configuration, with huge pages a separate row. Pin collector/generator to reserved cores; use identical worker core sets. Count reserved cores in the machine price. Do not compare HVF time with KVM-metal time.

### 2. Equivalent artifacts and snapshot points

The principal experiment uses **the exact same AArch64 Linux Node ELF hash, JS files, modules, inputs, environment and resource limits** on both kernels. Prefer an upstream-source, statically linked musl build if needed; build remotely and disclose all configuration. If using an official dynamically linked binary, ship the same loader/shared libraries on both. An unsupported loader is a compatibility failure, not permission to substitute a smaller JS engine. Compile/build once, outside the timing path; amortize its cost in a separate deployment row.

Use 1 vCPU per VM initially, with the same Node worker/thread settings and memory limits. Sweep guest RAM, for example **128/256/512 MiB**, but select each backend's smallest reliable configuration on the development set. Node must have equal useful heap/working-set capacity; configured guest RAM need not be equal. Freeze chosen settings before hidden evaluation. Add a 2-vCPU worker workload row if the actual product requires CPU-parallel workers.

Define two snapshots, identically on both stacks:

1. **Runtime-ready:** Node initialized and waiting for request input; no evaluated request code/data. This represents fresh agent-written programs.
2. **Application-ready:** fixed modules loaded and optional function/JIT warmup complete on development inputs; all workers quiescent. The submitted hidden request and secrets have not been consumed.

Do not snapshot Sofort after compiling the exact hidden program while snapshotting Firecracker before module import. If using a function-specific cache, charge its build, snapshot and storage cost and report cache hit/miss rates. Sweep **1, 32 and 256 distinct templates** to expose the cost of keeping all templates hot.

Writable scratch is fresh per run. For Firecracker, use a read-only prepared rootfs plus guest tmpfs for the matched ephemeral contract; persistent writable-disk variants are separate. Scratch creation, disposal, descriptor cleanup, VMM replacement/reap, bridge reconnection, per-run entropy and admission accounting belong to the measured lifecycle. Return the same artifact bytes. Restored time, RNG uniqueness, stale file offsets, timers and half-completed I/O are correctness cases, not just setup details.

### 3. Workload matrix and hidden data

| Family | Concrete work | Why it matters / measured controls |
|---|---|---|
| **A: minimal** | `return 1`; small JSON parse/stringify; 4 KiB output | Diagnostic floor only. Cannot alone decide the public 10× claim. |
| **B: recorded useful JS** | All 25 existing T1–T5 programs ported to a thin Node request wrapper, identical replay data; latency-scale 0 **and** recorded delays | Separates runtime overhead from real tool waits, payload/heap pressure and the SDK bridge. Original QuickJS rows remain separate. |
| **C: file work** | Stage-1 cwd/scratch jq operations and SQLite transactions; Node creates/reads/renames files and returns artifacts | Requires actual post-run filesystem cleanup and arbitrary-byte transport. Score bytes plus filesystem effects. |
| **D: JIT and runtime state** | Unseen hot loops, polymorphic functions, GC, Buffer/crypto tasks, worker messaging/Atomics; pre- and post-JIT template variants | Prevents reporting jitless-only or template-specific wins; workers/futex/signals continue across an ordinary request, then reset cleanly. |
| **E: dirty memory** | Allocate/touch/read back 64 KiB, 1, 8, 32 and 64 MiB, sequential and random pages, with deterministic answer | Count actual unique dirty pages, host faults and memory high-water. Randomized order breaks identical-job hot sets. Large rows may need a larger guest profile; publish it. |
| **F: hostile/recovery** | 1% infinite loops, allocation exhaustion, oversized output, denied tool invocation and corrupt request; each followed by a victim/canary | Measure timeout overshoot, victim p99, usable-slot recovery and residue. Never run dangerous host exploits to measure this. |

Keep at least **20% of family templates and data generators sealed**. Some kernels' reset policies can favor repeated write sets; include mixed A/B/E order and forced periodic policy cycles. Include several new module layouts and varying payload sizes. Do not inspect held-out performance while tuning either stack. All selected correct Linux reference cases remain in the denominator; if a workload cannot execute on GrowOS, it blocks the matched claim for that advertised contract.

### 4. Firecracker configuration: a serious opponent

**Verified behavior [V-source]:** snapshot load resumes an existing guest state in a different Firecracker process; ordinary File restore uses `MAP_PRIVATE` memory-file mapping and CoW anonymous pages on writes; disks are separately managed; loading is a pre-boot operation [F2]. Thus it is wrong to model Firecracker restore as an unavoidable full memory copy or a fresh Linux boot.

Benchmark these **separate** configurations:

| Arm | Policy to freeze on development data | Accounting and fairness |
|---|---|---|
| **FC-File-warm** | Prepared full snapshot, ordinary private mapping, immutable snapshot file in warm page cache; release-build VMM, snapshot load/resume | Core opponent for hot snapshot/reset. Include new process/jailer/API setup on the demand path, or disclose the pre-created pool and charge its resources. |
| **FC-File-cold** | Same snapshot, deliberately nonresident snapshot pages on dedicated remote host | Measures storage misses. Do not mix it with the warm headline. Keep cache-control work outside request timing and document the mechanism; report read I/O. |
| **FC-UFFD-warm/cold** | External handler serves faults; compare demand paging and development-trained prefetch/batched loading | Count handler processes/threads, cache and CPU. Use fresh hidden inputs to test working-set generalization. File CoW and UFFD-copy have different sharing behavior. |
| **FC-reserve pool** | Prepared/paused disposable snapshots with capacity reserve, refilled continuously | Charge all ready and replenishing slots. Once a slot runs attacker-controlled code, reusing it requires full reset; simply clearing JS globals is not equivalent. |
| **FC-tuned optional** | Proven preload/CoW-sharing optimization or a maintained accelerated restore path that can implement the same contract | Report patch/handler code and validation; show stock rows too. Include it in the opponent frontier if it is deployable and correct. Do not require reproducing every historical research OS before deciding. |

**[V-source] UFFD** passes page-fault handling to a userspace process; Firecracker registers anonymous guest memory and the handler can load pages via `UFFDIO_COPY` [F3]. This does **not** inherently share guest physical pages between VMs. Ordinary File mappings may be better for memory density. Give UFFD an honest tuning pass, but do not force it as the baseline when it loses. Match the cache budget and account for handler memory. Learned prefetch sets must come only from development inputs.

Full memory snapshots are prepared once. Do not time creating a full snapshot after every invocation if restoration from the immutable base is all the contract requires. Do not rely on an unsupported “restore over an already booted Firecracker VM” API; process replacement and/or continuously replenished virgin reserves are valid implementations. CoW rootfs/reflinks, if needed, belong in lifecycle cost; an ephemeral tmpfs contract can avoid disk-copy cost for both.

Tune on the visible set and freeze a small Pareto frontier of correct configurations. For each claimed axis compare against **the strongest eligible Firecracker result for that axis**, even if one configuration wins latency and another memory; show all configurations rather than synthesizing a fictional single Firecracker configuration. This deliberately makes the investment hurdle conservative.

### 5. Timing boundaries and sampling

Use host monotonic timestamps (`CLOCK_MONOTONIC_RAW` or a recorded equivalent), integer nanoseconds, one sample ID from admission to reusable capacity. Guest wall clocks are not the authoritative timer. Record:

- **`reset_internal`**: first reset action to backend saying the snapshot is reusable. Diagnostic only.
- **`reset_ready`**: prior result accepted/termination ordered → previous guest can no longer act → scratch/state reset/replacement → fresh request channel responds to a hidden nonce. This is the comparable reset p50/p99 metric. Deferred page faults in the nonce handler count.
- **`first_correct_result`**: scheduled request arrival → independent oracle verifies the result and returned artifacts. Includes queueing, restore, input transfer, page faults, compilation when appropriate, execution and output transfer.
- **`capacity_reusable`**: arrival → that execution's capacity is safely available again, including teardown/replenishment. A reserve pool cannot make cleanup disappear.
- **`cold_service`**: a new service/supervisor starts → first correct result, with snapshot cache state declared. Include pool establishment. Report separately from hot per-run reset.

Do not add or subtract separately computed percentiles. Store paired phase timestamps per attempt. For v1 tools, retain union-of-in-flight tool time as a diagnostic, and report end-to-end latency as well; async tool overlap makes a naive sum wrong.

**[P] Sampling:** 200 warmups per cell; **at least max(10,000, 1,000 × number of individually reported workload rows) measured requests/cell**, divided across **5 randomized interleaved blocks**. Each individual workload row needs at least 1,000 samples wherever p99 is quoted. Final density boundary gets **≥100,000 attempts or 30 minutes, whichever is longer**, three independent repetitions. The original spec's 1,000 samples is a useful floor, but only about ten samples occupy the top percentile [R4]. Use block/bootstrap or order-statistic confidence intervals and include censored failures. Timeouts never vanish from the CDF: show their mass at/above the deadline, and do not replace unknown completion latency with an optimistic successful time.

Run one backend at a time to avoid mutual cache/memory interference, randomize backend order by block, and equalize/precondition cache state each time. Record machine utilization, PSI, faults, I/O and temperature/frequency where available. Whole paired blocks may be invalidated for predeclared environmental reasons; retain them publicly with the reason. Never discard individual slow samples after observing them. Collect expensive smaps/traces in separate resource passes; verify their observer overhead on a small timing control.

### 6. Unique memory, sharing and total machine cost

**Definitions [V-source]:** Linux `smaps_rollup` aggregates mapping statistics; PSS apportions shared resident pages, and private clean/dirty bytes identify private resident memory [H1]. cgroup v2 exposes current/peak memory and per-category kernel/file/anonymous charges [H2]. **USS and PSS are not interchangeable.** RSS sum double-counts shared pages; USS alone omits shared templates and host costs.

**[P] At N = 0, 1, 2, 4, … up to the useful limit**, in quiescent, actively serving, post-large-job, immediate post-reset, 2-second idle and 30-second idle states, collect:

1. Every VMM/supervisor/worker/bridge/watchdog/UFFD PID's `smaps_rollup`, `status`, lifetime and cgroup membership. For ordinary-page rows, **USS = Private_Clean + Private_Dirty**; record huge-page counters separately if enabled. Report per-VM distributions, not just a grand mean.
2. **Aggregate PSS across the complete stack**, including mapped template/handler processes. Fit `M(N) = M_fixed + N × m_marginal` where it is approximately linear; publish raw curves and residuals, and separate sharing breakpoints instead of forcing a line.
3. Pool/service **cgroup `memory.current`, `memory.peak`, `memory.stat`** (anon/file/kernel/page tables/slab as available); also host MemAvailable/page cache and KVM-related kernel memory changes. Record snapshot cache once, scratch, page tables and ready reserves. Do not sum PSS and cgroup usage: they are complementary views.
4. A second **whole-host delta/density** check, because shared page-cache first-charge attribution and kernel allocations can make cgroup-only allocation unfair. Place the complete experiment stack and snapshot-cache warmer in the same accounting scope; use the same preconditioning for each arm.

The **gate's unique-memory axis** is marginal resident **USS per live VM including apportioned private helper costs** under the real mixed workload, checked against aggregate PSS/cgroup slope. Publish idle USS separately. A ≥10× USS win is disqualified if shared/fixed overhead raises total memory or usable density is worse. Never use configured guest RAM, snapshot file length, VM address space, or the M4's idle 2.4 MiB engine footprint as this metric.

Count total cgroup CPU user+system per **correct completed job**, including exiting processes and helpers, not a final `ps` census. Record host CPU/softirq and kernel overhead deltas where possible. Allocation bandwidth, fault cost and replenishment consume resources even if reset itself looks fast.

### 7. VMs per box at a p99 SLO; goodput; dollars

Measure **two distinct densities**:

- **Resident density:** maximum correctly initialized isolated slots within a declared memory budget, with every slot answering a nonce after a shuffled sweep. Reserve 20% of host RAM for OS/safety in both arms. Count all ready/replenishing slots and cache. This is not active throughput.
- **Usable density `N_SLO`:** maximum resident slots with **one independent Poisson request/second/slot**, same workload mix, each request gets clean state, **p99 within the frozen per-family SLO, ≥99.9% correct completion, no unbounded backlog**, for the final validation interval. Also report maximum stable open-loop correct goodput at other rates. The offered rate/slot is a benchmark contract, not an assertion that every customer uses it.

Freeze SLOs before candidate tuning: **minimal/nonce full result p99 ≤10 ms**; for useful workload family `j`, **`SLO_j = max(10 ms, 2 × native-warm-Linux p99_j + 10 ms)`**, measured once at low load on the same CPU budget; add the fixed critical-path tool-delay allowance for recorded-delay rows. Native Linux is a diagnostic lower bound, not an isolation-equivalent competitor. Publish the resulting numeric SLO manifest. The 10 ms overhead allowance comes from the repository's historical planning criterion, not achieved metal performance [R2]. Never let a moving baseline relax the SLO during tuning.

Sweep slot count and offered load geometrically, then binary-search within 10% around the boundary. Open-loop schedule timestamps are external to workers, so stalled systems cannot suppress arrivals. Failures, overload rejections and missed schedules remain in the denominator. Validate the chosen boundary on a fresh allocation. Under 1% hostile traffic, keep hostile outcomes separate but count their cost and measure victim p99/recovery; compare against clean load at the same offered rate.

For a campaign with duration `T` seconds, `K` correct, SLO-qualified runs, host hourly price `H`, and ancillary cost `A`:

```text
cost_per_million_correct = 1,000,000 × (H × T / 3600 + A) / K
steady_state_compute_only = 1,000,000 × H / (3600 × correct_goodput_per_second)
```

**[I] Illustrative arithmetic only:** c7g at 1,000 correct runs/s costs **$0.644/million** compute; at 100/s, **$6.44/million**. These are not Sofort or Firecracker measurements. Use whole-machine price once; do not add fictitious vCPU/RAM rental charges on top. Include underutilization and reserve-pool idle in a **10%/50%/near-SLO utilization curve**, image build/snapshot preparation amortized over declared run volumes, storage/read I/O and deployment operations. Hosted comparison uses actual billed units/minimums and invoice evidence when available. Show model costs separately and in all-in Stage-4 totals; a 10× kernel win need not change an LLM-dominated bill materially.

### 8. Formal go/no-go and publication

For a frozen useful workload mix, define conservative benefit ratios using matching cache/snapshot modes:

```text
R_reset = min(FC_reset_ready_p50 / Sofort_reset_ready_p50,
              FC_reset_ready_p99 / Sofort_reset_ready_p99)
R_memory = FC_marginal_unique_MiB / Sofort_marginal_unique_MiB
R_density = Sofort_N_SLO / FC_N_SLO
B = max(R_reset, R_memory, R_density)
```

**Go only if** conservative confidence bounds establish **B ≥10**, **all three ratios ≥1**, no loss of supported outcomes, and no regression in CPU/correct job, useful first-result p99, or cost/correct job. Require the decisive result on the primary host and directional confirmation on the second allocation. Show each family, including dirty-memory and tool-heavy rows; a tiny no-op-only win is insufficient. If the improvement is confined to a preregistered useful niche, label that niche and narrow the investment case accordingly.

“Not worse elsewhere” is literal here. A **5% engineering tolerance** may guide exploration, but it is **not a formal pass** under the owner's stricter rule. If the confidence interval cannot distinguish equality/regression, report inconclusive and gather the preregistered confirmation; do not claim proof of equivalence. Any compatibility or containment violation is a failure irrespective of speed. A missing tuned baseline is unfinished work.

Publish a runnable reducer and a machine-readable bundle containing: Git/artifact/container hashes; full configuration and threat/feature contract; snapshot cache point and warmness; CPU/page/cache settings; exact workload and SLO manifests; per-attempt timestamps/outcomes/faults; whole-stack memory curves; dollars and billing assumptions; all losing/unavailable rows; and the go/no-go calculation. Publish held-out IDs/data after the decision, replacing them before the next hill-climb. Keep model secrets and tenant data out of evidence.

The human-facing report should have **latency CDFs (including failure mass), memory versus slots, and goodput/p99 versus arrival rate**, plus a simple per-family score table. Separate primitive timing, end-to-end useful work, and hosted UX. State “not measured” where evidence is absent. This makes the benchmark a repeatable public demonstration without turning a research result into a broad Linux-compatibility or security claim.

## Sources and evidence boundaries

### Repository sources read

- **R1:** [jitk README](../../jitk/README.md) — current engine/default/pinning/CI contracts and warning that R4 ledgers are frozen.
- **R2:** [KILL-CRITERIA.md](../../jitk/docs/KILL-CRITERIA.md) — historical investment/exposure criteria, including unmeasured metal overhead/density.
- **R3:** [CLAIMS.md](../../jitk/docs/CLAIMS.md) — exact historical artifact scopes and explicit non-claims.
- **R4:** [SPEC-V1.md](../../jitk/bench/SPEC-V1.md) — workload, serving and evidence contract.
- **R5:** [v1 README](../../jitk/bench/v1/README.md), [fit matrix](../../jitk/bench/v1/results/2026-10-30-fit-matrix.md), [scriptc compile](../../jitk/bench/v1/results/2026-10-30-scriptc-compile.md), [capacity](../../jitk/bench/v1/results/2026-10-31-capacity.md) — actual failures, configuration fairness, compiler limitations and later revisions.
- **R6:** [2026-10-31 memory report](../../jitk/bench/v1/results/2026-10-31-memory.md) — final allocator/reset/default profile and risks; source-reported measurements, not rerun here.
- **R7:** [GrowOS README](../../jitk/grow/README.md) — gate isolation, mutation meaning, no general ABI/write-FS claim.
- **R8:** [scriptc corpus README](../../jitk/scriptc-corpus/README.md) — pins, oracle and private filename-hash split.
- **R9:** [phase-2 corpus result](../../jitk/docs/results/scriptc-corpus-phase2.md), [growth report](../../jitk/docs/results/grow-phase2-2026-10-27.md), [path-FS result](../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md) — comparable/lower-bound denominators, same-ID regressions and small effect of read-only filesystem growth.
- **R10:** [Evidence and method](../growos-fit/00-EVIDENCE-AND-METHOD.md) — runtime/growth/application distinction, economics and evidence limitations.

### Upstream suites and runtime sources

- **L1:** [LTP installation/execution](https://linux-test-project.readthedocs.io/en/latest/users/quick_start.html), [LTP source](https://github.com/linux-test-project/ltp), [syscalls manifest](https://github.com/linux-test-project/ltp/blob/master/runtest/syscalls). Current documentation uses Kirk; exact selected release controls command syntax.
- **L2:** [Historical Android LTP quickhit manifest](https://android.googlesource.com/platform/external/ltp/+/5eca7e63c48f85c59486da4abd803b7ac9aed4b7/runtest/quickhit). Evidence for that revision only; current upstream raw paths were unavailable.
- **G1:** [gVisor syscall-test README](https://raw.githubusercontent.com/google/gvisor/master/test/syscalls/README.md). Test framework/targets, Linux reference and save/restore caveats.
- **M1:** [musl libc-test description](https://wiki.musl-libc.org/libc-test), [musl writing-tests guide](https://wiki.musl-libc.org/writing-tests), [author's repository mirror](https://repo.or.cz/w/libc-test.git). Suite description verified; raw Makefile retrieval encountered bot protection.
- **Q1:** [jq test corpus](https://github.com/jqlang/jq/blob/master/tests/jq.test), [jq test driver](https://raw.githubusercontent.com/jqlang/jq/master/tests/jqtest).
- **Q2:** [SQLite testing](https://www2.sqlite.org/testing.html), [SQL Logic Test description](https://www.sqlite.org/sqllogictest/doc/trunk/about.wiki). Main testing account accessible; Fossil documentation sometimes returned browser verification.
- **N1:** [Node v24.22.1 test directories](https://raw.githubusercontent.com/nodejs/node/v24.22.1/test/README.md).
- **N2:** [Node common helper, including metadata-triggered respawn](https://raw.githubusercontent.com/nodejs/node/v24.22.1/test/common/index.js).
- **N3:** [Node path test](https://raw.githubusercontent.com/nodejs/node/v24.22.1/test/parallel/test-path.js).
- **N4:** [Node EventEmitter test](https://raw.githubusercontent.com/nodejs/node/v24.22.1/test/parallel/test-event-emitter-add-listeners.js).
- **N5:** [Node immediate timer test](https://raw.githubusercontent.com/nodejs/node/v24.22.1/test/parallel/test-timers-immediate.js).
- **N6:** [Node test runner](https://raw.githubusercontent.com/nodejs/node/v24.22.1/tools/test.py), [writing tests](https://raw.githubusercontent.com/nodejs/node/v24.22.1/doc/contributing/writing-tests.md), [Node CLI](https://nodejs.org/api/cli.html). Pinned v24 source used where available; generic CLI page is mutable.
- **J1:** [Test262](https://github.com/tc39/test262), [interpretation rules](https://github.com/tc39/test262/blob/main/INTERPRETING.md).
- **J2:** [V8 testing and performance runners](https://v8.dev/docs/test).

### Sandbox and academic sources

- **S1:** [Superagent, AI Code Sandbox Benchmark 2026](https://www.superagent.sh/blog/ai-code-sandbox-benchmark-2026) — January 16, 2026; comparison-page statements, not an independently verified latency campaign.
- **S2:** [LogRocket, comparing AI agent sandbox platforms](https://blog.logrocket.com/comparing-ai-agent-sandbox-platforms-e2b-modal-daytona-and-more/) — article's own measured create/resume boundaries; figures not reproduced here.
- **S3:** [ComputeSDK methodology](https://www.computesdk.com/methodology/), [sandbox benchmark page](https://www.computesdk.com/benchmarks/sandboxes).
- **S4:** [ComputeSDK benchmark source/raw results repository](https://github.com/computesdk/benchmarks).
- **F1:** [Firecracker v1.0.0 snapshot-support.md](https://raw.githubusercontent.com/firecracker-microvm/firecracker/v1.0.0/docs/snapshotting/snapshot-support.md) — historical numeric targets, not a current guarantee or an end-to-end Node benchmark.
- **F2:** [Current Firecracker snapshot documentation](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md) — File/CoW, lifecycle and snapshot safety/uniqueness considerations.
- **F3:** [Firecracker page-fault handling/UFFD](https://raw.githubusercontent.com/firecracker-microvm/firecracker/main/docs/snapshotting/handling-page-faults-on-snapshot-resume.md) — explicit external handler and copying flow.
- **F4:** [Firecracker production host setup](https://github.com/firecracker-microvm/firecracker/blob/main/docs/prod-host-setup.md) — host logging sensitivity and operational configuration.
- **P1:** [REAP paper: Benchmarking, Analysis, and Optimization of Serverless Function Snapshots](https://arxiv.org/abs/2101.09355) — ASPLOS 2021, abstract's 3.7× average cold-start reduction.
- **P1a:** [vHive](https://github.com/vhive-serverless/vhive) — evolving research framework, not a promise of exact historical reproduction.
- **P2:** [FaaSnap paper](https://www.sysnet.ucsd.edu/~voelker/pubs/faasnap-eurosys22.pdf) — EuroSys 2022, end-to-end and cached-snapshot comparisons.
- **P2a:** [FaaSnap artifact instructions](https://raw.githubusercontent.com/ucsdsysnet/faasnap/master/README.md).
- **P3:** [Catalyzer paper](https://ipads.se.sjtu.edu.cn/_media/publications/catalyzer-asplos20.pdf) — ASPLOS 2020. Indexed paper text/figures accessible; a later direct fetch timed out. No artifact execution or ARM portability verified.
- **P4:** [SEUSS preprint](https://arxiv.org/pdf/1910.01558) — inspected 2019 preprint; its numerical claims retain that version's scope.
- **P4a:** [SEUSS proof-of-concept repository](https://github.com/SESA/SEUSS).
- **P5:** [Groundhog paper and artifact appendix](https://people.mpi-sws.org/~dg/papers/eurosys2023-groundhog.pdf) — EuroSys 2023; reported overhead is relative to container/runtime reuse.
- **P5a:** [Groundhog automation](https://gitlab.mpi-sws.org/groundhog/automation).
- **P6:** [SeBS source](https://github.com/spcl/serverless-benchmarks).

### Agent workloads, measurement and hardware

- **B1:** [Terminal-Bench 2.0 announcement](https://www.tbench.ai/news/announcement-2-0), [research paper](https://arxiv.org/abs/2601.11868). Version-specific 89-task yardstick; not a claim it is the latest available release.
- **B2:** [Harbor quick start](https://docs.harborframework.com/getting-started/quick-start).
- **B3:** [Harbor custom sandboxes](https://docs.harborframework.com/sandboxes/custom-sandboxes).
- **B4:** [Harbor separate verifier](https://docs.harborframework.com/tasks/separate-verifier).
- **B5:** [SWE-bench evaluation guide](https://www.swebench.com/SWE-bench/guides/evaluation/).
- **B6:** [SWE-bench project](https://www.swebench.com/).
- **B7:** [Kubernetes SIGs Agent Sandbox performance assessment](https://agent-sandbox.sigs.k8s.io/docs/performance-assessment/).
- **B8:** [FrigaZzz agent-sandbox-benchmark](https://github.com/FrigaZzz/agent-sandbox-benchmark) — October 13, 2026 retained snapshot as described by its own README; recent community evidence, not reproduced.
- **B9:** [ControlPlane sandbox-probe](https://github.com/ControlPlaneIO/sandbox-probe), [October 2026 report](https://control-plane.io/publications/sandbox-probe-reports/).
- **H1:** [Linux proc/smaps documentation](https://docs.kernel.org/filesystems/proc.html).
- **H2:** [Linux cgroup v2 memory/CPU accounting](https://docs.kernel.org/admin-guide/cgroup-v2.html).
- **A1:** [AWS public On-Demand Linux price feed, US East (N. Virginia), USD](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/US%20East%20%28N.%20Virginia%29/Linux/index.json). Retrieved read-only and decompressed in memory; 695,489-byte JSON inspected. Rates above are the feed's instance-specific `price` values, not third-party calculators. Recheck at provisioning.
- **A2:** [AWS compute-optimized instance specifications](https://docs.aws.amazon.com/ec2/latest/instancetypes/co.html).

**Remaining uncertainties:** eligible Node 200-file manifest, static/dynamic Node build feasibility, guest socket/process breadth, suite wall times, actual snapshot sharing/USS and usable metal density are unmeasured. They are explicit future experiments, not conclusions of this desk research. Public suites and finite canaries can guide growth and reveal defects; they cannot prove full Linux equivalence or absence of sandbox escapes.

<!-- Reference links for the inline evidence IDs. -->
[R1]: ../../jitk/README.md
[R2]: ../../jitk/docs/KILL-CRITERIA.md
[R3]: ../../jitk/docs/CLAIMS.md
[R4]: ../../jitk/bench/SPEC-V1.md
[R5]: ../../jitk/bench/v1/README.md
[R6]: ../../jitk/bench/v1/results/2026-10-31-memory.md
[R7]: ../../jitk/grow/README.md
[R8]: ../../jitk/scriptc-corpus/README.md
[R9]: ../../jitk/docs/results/scriptc-corpus-phase2.md
[R10]: ../growos-fit/00-EVIDENCE-AND-METHOD.md
[L1]: https://linux-test-project.readthedocs.io/en/latest/users/quick_start.html
[L2]: https://android.googlesource.com/platform/external/ltp/+/5eca7e63c48f85c59486da4abd803b7ac9aed4b7/runtest/quickhit
[G1]: https://raw.githubusercontent.com/google/gvisor/master/test/syscalls/README.md
[M1]: https://wiki.musl-libc.org/libc-test
[Q1]: https://github.com/jqlang/jq/blob/master/tests/jq.test
[Q2]: https://www2.sqlite.org/testing.html
[N1]: https://raw.githubusercontent.com/nodejs/node/v24.22.1/test/README.md
[N2]: https://raw.githubusercontent.com/nodejs/node/v24.22.1/test/common/index.js
[N3]: https://raw.githubusercontent.com/nodejs/node/v24.22.1/test/parallel/test-path.js
[N4]: https://raw.githubusercontent.com/nodejs/node/v24.22.1/test/parallel/test-event-emitter-add-listeners.js
[N5]: https://raw.githubusercontent.com/nodejs/node/v24.22.1/test/parallel/test-timers-immediate.js
[N6]: https://raw.githubusercontent.com/nodejs/node/v24.22.1/tools/test.py
[J1]: https://github.com/tc39/test262
[J2]: https://v8.dev/docs/test
[S1]: https://www.superagent.sh/blog/ai-code-sandbox-benchmark-2026
[S2]: https://blog.logrocket.com/comparing-ai-agent-sandbox-platforms-e2b-modal-daytona-and-more/
[S3]: https://www.computesdk.com/methodology/
[S4]: https://github.com/computesdk/benchmarks
[F1]: https://raw.githubusercontent.com/firecracker-microvm/firecracker/v1.0.0/docs/snapshotting/snapshot-support.md
[F2]: https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md
[F3]: https://raw.githubusercontent.com/firecracker-microvm/firecracker/main/docs/snapshotting/handling-page-faults-on-snapshot-resume.md
[F4]: https://github.com/firecracker-microvm/firecracker/blob/main/docs/prod-host-setup.md
[P1]: https://arxiv.org/abs/2101.09355
[P1a]: https://github.com/vhive-serverless/vhive
[P2]: https://www.sysnet.ucsd.edu/~voelker/pubs/faasnap-eurosys22.pdf
[P2a]: https://raw.githubusercontent.com/ucsdsysnet/faasnap/master/README.md
[P3]: https://ipads.se.sjtu.edu.cn/_media/publications/catalyzer-asplos20.pdf
[P4]: https://arxiv.org/pdf/1910.01558
[P4a]: https://github.com/SESA/SEUSS
[P5]: https://people.mpi-sws.org/~dg/papers/eurosys2023-groundhog.pdf
[P5a]: https://gitlab.mpi-sws.org/groundhog/automation
[P6]: https://github.com/spcl/serverless-benchmarks
[B1]: https://www.tbench.ai/news/announcement-2-0
[B2]: https://docs.harborframework.com/getting-started/quick-start
[B3]: https://docs.harborframework.com/sandboxes/custom-sandboxes
[B4]: https://docs.harborframework.com/tasks/separate-verifier
[B5]: https://www.swebench.com/SWE-bench/guides/evaluation/
[B6]: https://www.swebench.com/
[B7]: https://agent-sandbox.sigs.k8s.io/docs/performance-assessment/
[B8]: https://github.com/FrigaZzz/agent-sandbox-benchmark
[B9]: https://github.com/ControlPlaneIO/sandbox-probe
[H1]: https://docs.kernel.org/filesystems/proc.html
[H2]: https://docs.kernel.org/admin-guide/cgroup-v2.html
[A1]: https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/US%20East%20%28N.%20Virginia%29/Linux/index.json
[A2]: https://docs.aws.amazon.com/ec2/latest/instancetypes/co.html
