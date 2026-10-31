# The hard number: cost to reach the same verified compatibility

Research date: **2026-10-31**. Repository HEAD read: `e84bc278a06b98289ca6ca90bd1b0bb3fb36c90a`. Desk research only: repository/evidence reads, small in-memory JSON/CSV reductions, and upstream web/API/source reads. No build, benchmark, Docker, VM, Linux execution, or model-growth run was performed. This report is the only file written.

Labels: **M** = observed in retained measurements or directly counted source/metadata; **P** = upstream published claim; **E** = estimate/interpretation; **D** = proposed experimental design. Source counts are measurements of text, not measurements of behavioral correctness. Unknown is not zero.

## Recommendation

- **Publish one comparative number: `R = manual all-in development cost / GrowOS all-in development cost`, to reach the same preregistered compatibility target under the same independent checks.** Higher is better. Include implementation, primitives, oracle work, review, failures, integration, and correction costs; specify a fixed workload and starting kernel.
- **Today's R: not measured.** There is no timed manual control arm and no complete GrowOS cost ledger. Existing evidence establishes compatibility progress, not superiority to hand-written compatibility.
- **Today's strongest outcome:** historical Phase 2 gained **610 held-out passes**, from **34/792 to 644/792**, with zero observed comparable-program regressions. Overall: **159 → 3,198 / 3,947** comparable compiled programs, **4.0% → 81.0%**. The roughly 11% starting point in the brief is not the matched baseline in these records. [L2]
- **Do not call that 3,039 autonomous gains:** 50 gains were placement-only; mmap alone explains 2,924, and required 55 lines of externally authored safe mapping helpers. Eight retained handlers cost 30 Phase-2 proposal calls including failures/invalidated calls, but the surrounding implementation-agent work is not metered by those receipts. [L1], [L2]
- **Keep the October 31 qualification separate:** stage-0 preserved 1,848 old passes on **2,313 comparable** programs from a partial 2,400-program census, including 386/386 old held-out passes; it did not rerun the full 81% denominator. [L4]
- **The reference correction is material:** the fstat/openat mode-3 acceptance inherited Docker Desktop/root filesystem behavior. Visible references were rerecorded on Linux; two sealed recordings remain Docker Desktop recordings. No current, full, independently rerecorded Linux confirmation of the historical headline is established here. [L5]
- **Convincing proposed hurdle:** at least **3× lower all-in cost**, with a prespecified lower 95% uncertainty bound above 3×, across independently selected task bundles including stateful/multi-file work; identical quality and zero observed regressions are eligibility conditions. This is a proposed research hurdle, not an observed result or a universal standard.
- **Falsification:** `R ≤ 1` means no cost advantage in that experiment; a confidence interval crossing 1 is inconclusive. A quality-gate failure invalidates a cost win. A precise 1–3× result supports a smaller advantage, not the proposed strong headline.

## Our measured costs and gains

### What is being counted

There are three different units: **proposal calls**, **transactions** (up to three attempts), and **distinct retained implementations**. Repeated regeneration of one known syscall is not another syscall implemented. “Accepted” below means the recorded gate accepted it; it does not mean full Linux equivalence. “Retained” means selected for that historical assembled kernel, not necessarily the unchanged implementation shipped after stage-0.

The per-target costs below were recomputed from [PHASE2.csv](../../jitk/grow/experiments/PHASE2.csv), [PATHFS.csv](../../jitk/grow/experiments/PATHFS.csv), and readable `agent-usage.json` receipts under:

- `/Users/noah/sofort-local-evidence/growos-phase2-2026-10-27/grow-results/`
- `/Users/noah/sofort-local-evidence/growos-pathfs-2026-10-27/grow-results/`

Each receipt is a JSON array; sum `input_tokens` and `output_tokens` once per physical proposal directory. Reasoning is a subset of output; cached input is a subset of input. All these Phase-2/Path-FS usage receipts report zero cached tokens. These are CLI-reported usage quantities, not invoices. The source writes usage from `turn.completed` events, so interrupted/filtered calls can lack a usage receipt. [agent.ts](../../jitk/grow/agent.ts), [retries.ts](../../jitk/grow/retries.ts)

Wall seconds are **summed attempt durations**, including proposal and gates, not active human time or VM latency. They omit preparation, baseline corpus runs outside the transaction, full-census reruns, orchestration, review, and some interrupted infrastructure work. Do not add overlapping elapsed and summed times.

### Phase 2: all targets, with rejected and discarded work charged

All entries are **M**, with causal/semantic qualifications from [the experiment report][L1]. Inputs/outputs are exact integer receipt totals. The gain columns are **incremental gate samples**, not full-corpus attribution: `new / sampled`, visible and held-out. Later targets built on earlier accepted handlers.

| Target | Proposal calls charged | Input / output tokens | Summed recorded attempt seconds | Gate-sample new visible / held-out | Historical disposition and intervention |
|---|---:|---:|---:|---|---|
| mmap | **4**: 1 valid + 3 invalidated helper-import calls | **144,683 / 2,601** | **200.1 valid; ≥32.7 invalid** | 90/150; 40/60 | Retained, 74 lines. Three safe mapping helpers and module re-export had to be authored outside the proposal; first transaction invalidated for controller import failure. Third invalidated call has usage but no complete elapsed/rejection record found. |
| getrandom | 1 | 70,875 / 610 | 114.6 | 48/61; 11/13 | Retained, 43 lines. Generator's random-write observation fixed before batch. Later replaced with ChaCha20 during stage-0. |
| uname | 1 | 21,704 / 265 | 78.2 | 0/44; 0/7 | Retained, 24 lines; oracle-environment constants subsequently de-overfitted. |
| getpid | 1 | 18,305 / 61 | 159.2 | 0/130; 0/31 | Retained, 4 lines; positive-identity checking was weak; later rewritten. |
| faccessat | 1 | 215,367 / 296 | 84.4 | 3/42; 0/13 | Retained, 24 lines. Existing archive API supplied. |
| getpriority | 2 | 60,550 / 599 | 70.8 | 0/1; 0/1 | Retained, 19 lines. First candidate failed held-out; feedback repaired it. |
| getppid | 1 | 18,314 / 50 | 72.7 | 0/42; 0/7 | Retained, 4 lines; later de-overfitted with pid behavior. |
| sysinfo | **5**, across 2 transactions | 103,901 / 2,188 | 143.3 | 1/7; 0/1 | Retained, 26 lines. First transaction's 3 attempts failed against pinned slow-changing host values. Spaced calibration fixed the profile; next transaction had one child-wait false rejection, then acceptance. Later de-overfitted. |
| unlinkat | 2 | 71,193 / 1,682 | 185.6 | 0/92; 0/30 | Gate accepted, **excluded by inspection as overfit**. First attempt failed held-out. |
| mkdirat | 1 | 200,206 / 1,082 | 141.3 | 0/78; 0/25 | Gate accepted, **excluded by inspection as overfit**: simulated writable container paths. |
| chdir | 1 | 21,288 / 477 | 65.3 | 0/17; 0/5 | Gate accepted, **excluded by inspection as overfit**: path names rather than general state. |
| statfs | **4**, across 2 transactions | 287,799 / 3,507 | 147.2 | 0/4; 0/0 | First transaction: 3 held-out failures from blank-line observation bug; next accepted. **Excluded by inspection** for host filesystem constants/path behavior. |
| getrusage | 6, across 2 transactions | 235,193 / 5,016 | 218.8 | Not reached | Both exhausted 3 attempts. Generator pinned Linux process counters; first also had blank-line failures. Not evidence that a satisfiable contract defeated the model. |
| nanosleep | 0 | No proposal usage | Setup time unavailable | Not reached | Empty held-out split: refused before sampling. |
| mprotect, pipe2 | 0 in this batch | No proposal usage | Not measured | Not reached | Deferred: require shared page-permission or fd/buffer machinery outside a single handler file. |
| **Total** | **30 calls** | **1,469,378 / 18,434** | **1,681.4 s in CSV + ≥32.7 s invalidated receipts** | Do not sum overlapping samples | **12 gate acceptances; 8 selected**, 218 grown lines. Reasoning subset: 5,202 tokens. Not an all-in cost. |

**Rejection accounting:** PHASE2.csv contains **27 actual attempt rows: 12 accepted, 15 rejected**, plus one setup-only row. Rejections: **10 held-out**, **4 visible `semantic_error_state_0`**, **1 visible `semantic_error_state_26`** (the documented child-wait false rejection). The additional **3 invalidated mmap CLI calls** are charged above; only two complete rejection receipts were found, both build failures. The CSV deliberately excluded them from valid-run accounting; economics must retain their cost. The four inspection exclusions are **false acceptances at the stated gate**, not four more model-attempt rejections. At target level the batch accepted 12 distinct names, retained 8, exhausted getrusage, refused nanosleep setup, and deferred mprotect/pipe2. [L1]

**Human/outer-agent contribution:** the round reports **0 interactive user minutes**, approximately **2 h 45 min implementation-agent elapsed time**, and untimed lead/brief preparation. That is not zero engineering effort. Outside proposals: **55 kernel Rust lines**, **8 loader/build TS lines**, **9 slot entries**, **14 kernel-test lines**, **477 controller lines**, **74 grow-test lines**, and **241 corpus-tooling lines**. The report attributes these to the implementation agent, not to the user; their model cost is absent from the nested proposal receipts. Profile repair, oracle design, manual exclusions, helper design, and later merge/correction work are real interventions even when another agent performs them. [L1]

### What the full corpus actually gained

| Quantity | Measured value | Interpretation |
|---|---:|---|
| Comparable compiled programs | 3,947 | 4,127 compiled minus 180 ELF-drift exclusions. |
| Before → after, all comparable | 159 → 3,198 | **+3,039**, +77.0 percentage points; no observed comparable regressions. |
| Visible before → after | 125 → 2,554 / 3,155 | +2,429. |
| Held-out before → after | 34 → 644 / 792 | **+610**, +77.02 points; 610/758 previously failing = **80.47%** recovered. |
| Lower-bound pass rate over all compiled | 3,198 / 4,127 = 77.5% | Counts excluded ELF-drift cases as not passing. |
| Stock-layout pass rate | 2,888 / 3,947 = 73.2% | 81% uses the jitk link layout, with unmodified program source but relinked ELFs. |
| mmap alone | 2,924 new passes | **96.22% of all gains**, on the supplied mapping primitives. |
| Other exact attribution combinations | mmap+getrandom 54; placement alone 50; getrandom alone 5; mmap+faccessat 5; uname+sysinfo 1 | Sum with mmap-alone = 3,039. Placement-only gains: 33 visible + 17 held-out. |
| getpid/getppid/getpriority alone | 0 | Useful semantics can have no immediate program unlock; do not invent per-handler independent gains. |

Source: [full Phase-2 corpus report][L2]. “Exercised a new syscall” and “caused a newly passing program” are different. Independent per-handler full-corpus ablations were not retained for every handler; the attribution table uses exercised-change combinations. Gate-sample gains (e.g. faccessat +3) cannot be substituted for full-corpus totals or summed with them. Full-census reruns reportedly took about 70 minutes apiece with three workers, separately from proposal-attempt seconds. [L2]

### Path-FS regrowth: stronger oracle, almost no workload gain

**M**, same receipt method. Every accepted transaction passed its recorded visible/held-out probes, two wrong-return mutants, SQLite 10/10 and sampled zero-regression checks. [L3]

| Target | Calls | Input / output tokens | Attempt seconds | New visible / held-out sample | Disposition |
|---|---:|---:|---:|---|---|
| statfs | 2 | **103,407 / 356 recorded for successful call only** | 94.0 | 1/4; 0/0 | Retained, 22 lines. First call content-filter refused; no usage receipt, so its token cost is unknown. No held-out corpus program exercises it. Struct values still emulate the oracle environment. |
| unlinkat | 1 | 38,870 / 280 | 149.3 | 0/92; 0/30 | Gate accepted, **tree-variant audit rejected**; excluded. PATHFS.csv says 24 lines; prose report says 23: preserve discrepancy, no economic inference from lines. |
| mkdirat | 1 | 203,026 / 215 | 124.5 | 0/78; 0/25 | Retained, 9 lines; general read-only lookup semantics. |
| chdir | 1 | 24,375 / 194 | 57.8 | 0/17; 0/5 | Retained, 13 lines, **cannot change cwd**. Narrow empty-tree success; not general chdir. |
| **Total** | **5** | **369,678 / 1,045 metered** | **425.6** | **Full-corpus gain: +1 visible, +0 held-out** | 4 gate accepted, 3 selected; 44 added lines, 11-handler assembled kernel. Reasoning subset 280. |

Only one proposal was rejected in-loop (content filter); one accepted candidate was later rejected by an independent tree-variant audit. Tree parity alone did not expose state-history errors. The round required a chroot launcher, archive unpacking/tree hashes, exposing `fs.rs` in prompts, and a statfs generator repair; no complete labor/time/dollar allocation is recorded. Its full rerun also excluded one additional ELF-drift case and identified a flaky unrelated RSA test; the same-ID comparison reports zero regressions. [L3]

### Earlier accepted handlers and experiments: do not count repeated recovery as new coverage

The reports were relocated into `arch/jitk/docs/results/`; the only current `grow/EXPERIMENTS-*.md` is Path-FS. Historical E1 metadata and summaries remain in `grow/experiments/`.

| Experiment / target | Calls, acceptance and wall cost (M) | Gains and limits |
|---|---|---|
| R7 fstat + pread64 | **Directly authored, REPLAY**, not live proposals; 10 and 17 handler source lines. Labor/token attribution unavailable. | Ten distinct unchanged SQLite cases pass in each transaction (20 exact tuples, **not 20 distinct programs**); causal deletion checks fail first at fstat, then pread64. It is not an LLM-vs-human control: an implementation agent wrote the canonical handlers. [L6] |
| E0 ppoll / signal profiles | 5 batches, 13 CLI calls; 4/5 complete; one 240 s CLI timeout. ppoll accepted 4/5. No sealed split then. | Signal profiles intentionally preserve ENOSYS, not working signal delivery/masking. [L7] |
| E1 ppoll, pilot+main | **79 calls**, 72/72 transactions accepted; **3,445.5 summed s**. | Repeated recovery of one existing handler, QuickJS integration; not 72 distinct syscall discoveries. |
| E1 fstat, pilot+main | **88 calls**, 72/72 accepted; **3,558.1 summed s**. | Existing hand-authored profile and host ABI checks; SQLite integration. Original reference later corrected. |
| E1 pread64, pilot+main | **111 calls**, 70/72 accepted; **5,330.5 summed s**. | Two old-model transactions exhausted; fd narrowing, errno precedence, count/pointer errors. |
| E1 pooled | **278 calls**, 214/216 accepted; **12,334.0 summed s**. Pilot usage: **1,019,261 input / 41,970 output**, 107,008 cached and 19,104 reasoning subsets. Main: **5,059,211 / 238,315**, 1,230,848 cached and 117,904 reasoning; **231 of 232 main calls metered**. | **64 rejected attempts**: 22 build, 21 visible, 20 held-out, 1 CLI. Per-target token splits not present in the committed summary inspected; aggregate is published. Initial invalid pilot work is separate and incompletely costed. [L7] |
| E2 red-team (two wordings) | **30 calls**, 25 accepted, 5 rejected; **652,073 / 16,921 tokens**; **1,111 summed s** (rounded report totals). | Rejects: 2 lint, 2 build, 1 visible. All five constructed/model overfits fail held-out when replayed independently, but integration catches none. This tests gate adequacy, not additional supported programs. [L8] |
| E3 getrandom | 12 calls, 10 accepted transactions; 318.4 summed s | One old-model error; one new-model false rejection from random sentinel collision. |
| E3 uname | 11 calls, 10 accepted; 179.0 s | One incomplete visible protocol/fault. |
| E3 faccessat | 10 calls, 10 accepted; 455.3 s | Some later failed stronger Phase-2 probes. |
| E3 getpid | 10 calls, 10 accepted; 298.2 s | Any positive constant pid could pass original profile. |
| E3 sched_getaffinity | 14 calls, 8 accepted; 378.3 s | Two transactions exhaust three attempts on held-out pid=-1 errno. |
| E3 madvise | 10 calls, 10 accepted; 206.5 s | Missing unmapped-range coverage; not full madvise semantics. |
| E3 pooled | **67 calls**, **58/60 transactions** accepted, 9 rejected attempts; **1,796,002 / 40,315 tokens**, cached 117,760/reasoning 23,232 subsets; **1,835.5 summed s**, approximately 16 min batch elapsed. | Six distinct target names; only getpid/faccessat have unchanged SQLite integration exercising them. 9/9 old semantic mutants killed by generated probes. Per-target token receipts not reduced in the committed E3 CSV. [L8] |

E1 target totals were reduced from [summary.json](../../jitk/grow/experiments/summary.json); E3 from [E3.csv](../../jitk/grow/experiments/E3.csv), filtering to the two live model IDs, excluding canonical/mutant-grade rows. The E3 CSV's `accepted` column on mutant controls is not a count of grown handlers.

Earlier reports explicitly say **sampling human minutes=0** omits prior profile/API/spec authoring. E2/E3 reports approximately **50 min implementation-agent elapsed**, excluding earlier work/briefs. Partial red-team runs, invalid graders, a failed unauthenticated Claude smoke, early E1 pilot repairs, and interrupted preparation are not fully represented in final batch totals. No amortized cost per novel syscall can be honestly obtained by adding only successful-batch tokens. [L7], [L8]

### October 31: what today's evidence does and does not certify

**M/P from retained repo reports:** stage-0 compared an old grown kernel (`verify81`, October 30) with merged `c465d991`. The partial `full-r2` census contains 2,400 compiled programs; **87 were already ELF-drift**, leaving **2,313 comparable**, with **1,848 passes before and after (79.9%)**. Held-out: **479 comparable, 386 old passes retained**. It preserves the de-overfitted uname/sysinfo/statfs/pids/getpriority, ChaCha20 getrandom, and PROT_EXEC refusal on that tested distribution. The other **1,727 compiled programs** from `full` were not remeasured like for like. These counts neither reproduce 81% nor supply a fresh before-growth baseline. [L4]

The Linux-host oracle change altered **openat permission/readonly-mount errno ordering and fstat's unreadable-metadata case**; pread64 and 13 SQLite recordings did not change. This is a reference/environment error, not proof that fstat alone generated a bad stat structure. The host tests also inherited the old assumption and required amendment. Two sealed held-out recordings remain Docker Desktop recordings. The valid current statement is therefore **historical gains plus scoped regression preservation and a documented oracle correction**, not “full Linux correctness reverified today.” Correction/requalification costs have not been attributed to handlers. [L5]

## Hand-written effort comparison

### What the web can actually establish

There is **no directly comparable published dollar-per-correct-syscall or labor-hour-per-syscall measurement in the primary sources found**. Kernel scope, reused drivers/VFS/network stacks, supported flags, stub policy, architecture, review standard, and test depth differ. Contributor identities are not FTEs, commits are not hours, and recent repositories are not proven to be written without AI assistance. In particular, FTL/Moss are evidence of small-team compatibility development, not certified “pure human” controls.

The table combines **P** syscall claims with **M** read-only source/metadata counts. History columns refer to the **whole default-branch repository**, not just ABI code. The contributor counts are GitHub API returned attributed identities, including bots and aliases; external dependencies/private predecessors can be absent. **Person-years are unknown for every row.** These are effort proxies, not a speedup denominator.

| Project | Linux ABI breadth (published or explicitly scoped count) | Public history / contributors (M) | Tests and coverage-over-time evidence | Effort estimate and comparison boundary (E) |
|---|---|---|---|---|
| **gVisor** | **255 full/partial of 295 listed ARM64 calls**; partial includes stubs. [G1] | First reachable commit **2018-04-27**, latest sampled **2026-10-31**; **13,378 commits**, **370 API contributor identities**. [GH-G] | Native Linux-vs-gVisor syscall tests, x86/ARM lanes; Google reported **over 1,500 syscall tests in May 2019**. [G2], [G3] | About **8.5 calendar years of public history**, with pre-public development uncounted. Broad process/network/filesystem semantics greatly exceed eight GrowOS leaf handlers. No defensible person-years/$ estimate. |
| **Asterinas** | **Over 210** syscalls in June 2025 paper; **240+ x86-64** in current book. [A1], [A2] | **2022-05-17 → 2026-10-30**; **4,826 commits**, **104 identities**. [GH-A] | LTP, gVisor, kselftest/xfstests integrations; inspected LTP recipe pins **20260529**, Kirk **v4.1.0**. Authors' 2025 account: **three years**, **50+ contributors**, **100K+ Rust lines**. [A3], [A4] | Roughly **4.5 public calendar years**. More than 210 → 240+ is a milestone comparison, not exactly +30 independently verified calls. Production-oriented breadth and OSTD work are not marginal syscall labor. |
| **StarryOS** | **210 distinct `Sysno::` labels** in sampled dispatcher, architecture union; includes **11 dummy-fd calls + 3 timer calls returning Ok(0)**. This is a dispatch inventory, not 210 correct calls. [S1] | Reachable history **2024-07-23 → 2026-03-09**; **647 commits**, **25 identities**. Repository itself created **2025-09-03** (history imported). [GH-S] | Four-architecture runtime CI including AArch64, rootfs `ci-test`; no maintained comparable pass-denominator series found. [S2] | Approximately **20 months of sampled history**, plus ArceOS/crates and earlier Starry work. Current root activity is not the whole project's effort. Never divide those months by the dispatch count. |
| **Unikraft + app-elfloader** | Compatibility docs say **160+ syscalls**; Loupe's historical `7d6707f` inventory says **174**. These are differently dated definitions, not regression evidence. ELF binary compatibility docs specify x86-64/PIE. [U1], [P1] | Core **2017-11-29 → 2026-10-23**, **4,156 commits / 114 identities**; loader **2019-04-15 → 2026-10-02**, **121 / 27**. Do not add overlapping contributor counts. [GH-U], [GH-UE] | libc-test integration, subsystem tests; application catalog and Loupe support plans. [U2], [U3] | About **nine calendar years of core history** and **7.5 loader history**, not nine staff-years. Loader's small commit count inherits the core's compatibility investment. Current commercial Linux-based backend examples are not open-source kernel compatibility evidence. |
| **OSv** | Sample template has **150 `SYSCALL0..6` entries**, plus futex in `linux.cc`; raw architecture/config union, aliases and partial implementations remain. Historical app-support proxy below. [O1] | **2012-12-01 → 2026-10-26**; **8,882 commits**, **113 identities**. [GH-O] | Kernel/libc tests and osv-apps. Loupe reconstructs app support from folder git history, explicitly acknowledging uncertainty. [O2], [P1] | Nearly **14 calendar years** across a full single-process OS/libc environment. Current symbols and syscall traps are different coverage units; no present labor/$-per-call figure. |
| **Nanos** | **187 distinct lexical `register_syscall` names** across **29 C files** under `src/unix` and `src/net`; **10 explicitly ignore/unimplemented handler labels** identified in those matches. Architecture union, not a validated total. [N1] | **2017-12-23 → 2026-10-25**; **3,590 commits**, **39 identities**. [GH-N] | Runtime tests include mmap/futex/signals/epoll/filesystem; e2e runtime applications. Public book's “supported” list includes intentional stubs and should not be treated as full correctness. [N2], [N3] | Almost **nine calendar years** on a single-application kernel. Closer runtime shape than gVisor, but its networking/writable filesystem/threading support exceeds GrowOS's tested contract. |
| **FTL** | **52 explicit `SYS_* =>` dispatch arms** in sampled Linux personality. No independent all-flag conformance count. [F1] | **2026-01-25 → 2026-10-27**; **697 commits**, **1 attributed identity (`nuta`)**. [GH-F] | TypeScript/Bun VM e2e tests; launch **Sep 14**, multithreaded Tokio **Oct 3**, Zone/VFS expansion **Oct 28**, 2026. [F2], [F3], [F4] | Approximately **nine calendar months** by one attributed committer, not nine full-time person-months. Small kernels can gain substantial compatibility quickly without a large organization. Prior work/reuse and AI assistance are unquantified. |
| **Moss** | README claims **109** calls; pinned syscall table has **126 rows marked true**. Preserve discrepancy; neither is a tested conformance total. [M1], [M2] | **2025-11-16 → 2026-10-13**; **624 commits**, **16 identities**; two leading identities account for **300 + 254 commits**. [GH-M] | README claims **230+ host utility tests**, plus guest `usertest`; not 230 Linux ABI coverage proofs. [M1], [M3] | Roughly **11 calendar months**, concentrated in two identities. Existing Arch ARM64 userspace support is a useful milestone; no trustworthy person-years inferred from concentration. |

**How history was measured:** read GitHub `/repos/{owner}/{repo}`, `/commits?per_page=1`, the pagination `rel=last` page, and `/contributors?per_page=100` plus the last page if needed. Commit counts are reachable default-branch totals from pagination; first date is oldest returned committer date, not necessarily project inception. Contributor totals are page counts, not deduplicated people. APIs and pinned head IDs are listed below. Repository creation can postdate its history; gVisor's initial public snapshot can hide years of earlier work. No repository was cloned or executed.

**How source breadth was measured:** FTL: unique line-start `SYS_* =>` arms. Starry: distinct `Sysno::name` labels after `let result = match sysno`, without evaluating cfg; inspect dummy/no-op arms. OSv: line-start `SYSCALL[0-6](` invocations in the template, with the separate futex invocation noted. Nanos: unique first syscall-name arguments in lexical `register_syscall(map, name, handler)`-style calls in the stated source directories; conditional branches/comments were not preprocessed, so this is an inventory proxy. Moss: lines ending `| true |`. None is comparable to a frozen independent ABI-test score.

### Closest published effort comparison: Loupe, not dollars per syscall

**P/E:** Loupe studied **116 applications and 11 OSes**. Its OSv history reconstruction used a **62-application** set; the detailed §4.2 example needs **37 syscall implementations to support 31 apps** under its optimized plan, versus **92 organically** and **142 under naive dynamic analysis**. The abstract's wording is less precise about the 62-app set; use the detailed **31-app** endpoint. **92/37 = 2.49× fewer implementation units**, not 2.49× less labor: the authors explicitly say syscall costs differ and folder timestamps approximate support dates. Stubbing/faking are allowed there, so it does not impose GrowOS's exact-byte contract. [Loupe §4.2](https://arxiv.org/html/2309.15996v1#S4.SS2)

**E:** This is strong prior art for choosing profitable missing semantics from workloads. GrowOS must demonstrate an additional benefit over **a capable manual implementer using workload prioritization, Linux observations, existing tests and reusable code**, not just over an unguided kernel project. The new contribution to test is proposal-and-verification efficiency, including oracle construction and semantic repair. Public history supports “months to years of sustained project work”; it does not support “a Linux syscall costs X engineer-days.”

## Candidate headline metrics

### 1. All-in cost ratio at a fixed verified compatibility target — recommended

**Exact definition (D):** freeze task bundles, starting kernel, ELF/compiler/libc, resources, helper APIs and quality contract before either arm starts. A bundle is a named workload family plus a specified missing semantic feature, not an arbitrary syscall label. Define `Q` as at least **80% of independently selected workload families passing all their withheld cases**, with **zero observed regressions** in the frozen old-pass suite and a mandatory independent semantic/state suite. Give each family equal weight; publish raw program counts too. Exact bytes/status are required for deterministic outputs; environmental/random behavior needs a predeclared relational contract, not broad normalization.

For the complete campaign, charge both arms' failures and timeouts, not only bundles that succeed:

```text
C_arm(Q) = paid human development/review hours × preregistered loaded hourly rate
         + all model/proposal/orchestration charges
         + attributable build/oracle/test/CI/compute charges
         + feature-specific primitive, test, integration and correction costs

R_Q = C_manual(Q) / C_grow(Q)
```

A campaign only yields R when **both arms reach Q** under the same contract; quality failure disqualifies an arm. An arm stopped at a preregistered budget is right-censored: report its success fraction and spend, and only the corresponding justified bound on R. Never remove its failed tasks or assign an infinite speedup. Hold back an audit suite, allow a fixed remediation budget, and certify after remediation; its costs count. After audit disclosure the suite is retired, not reused as fresh held-out evidence.

**Measurement with existing tooling:** fork both arms from the same committed seed with target behavior absent; give both the same primitives, visible generated profiles, Linux observations and test interfaces. Retain `phase2`/`retryTransaction` run IDs, source/profile hashes, usage, per-stage clocks and failures. Add a campaign-level append-only ledger for outer-agent sessions, active human time, provider invoices, oracle generation, manual rewrites and integration. Freeze `census` IDs/ELF hashes and an independent family split. Retain full `(stdout,stderr,exit)` plus file/state effects; upstream gVisor/LTP cases and fresh state histories supply independent checks. Current Phase-2 gates do **not** provide that entire state suite or an independent host harness for every new target; add them rather than assuming README's generic gate description covers all targets.

**Baseline:** experienced manual implementation/porting into the same kernel, with the same workload ranking and helpers and permitted upstream references. No generative implementation in this arm if claiming superiority to hand-written work; ordinary debuggers/tests are allowed. Separately report a practical modern coding-agent baseline using identical model/budget but ordinary editing/tests without GrowOS's controller, so any advantage can be attributed to the growth method rather than model access. Existing gVisor/Starry/OSv histories are context, not the denominator.

**Shared cost:** evaluator work genuinely identical for both arms may be charged equally once per arm; growth-specific profile repair/scaffolding belongs to GrowOS. Feature-specific primitives cannot be moved outside its clock after seeing failures. Publish marginal and first-use fully burdened cost; choose the latter for the headline. Existing generic kernel substrate is common starting capital, clearly disclosed. Do not silently amortize controller/oracle development over hypothetical future growth.

**Gaming/prevention:** easy leaf targets, slow manual implementers, expensive human-rate assumptions, free agent orchestration, helper leakage and reused held-out gates all inflate R. Use independent task selection including stateful/multi-file cases, balance implementer expertise, randomized task order across matched developers, fixed resources/budgets, equal access to source/tests, complete cost receipts, and sensitivity to labor rates. Human assistance with the grow arm is permitted but must be recorded and charged. Have an independent evaluator run a final once-only audit.

**Today's value:** **not computable**. Missing manual arm, all-in costs, clean final audit, and family-based task manifest. Historical 81% cannot stand in for Q under this new definition.

**Convincing target/failure:** proposed **R ≥ 3 with lower 95% bound >3**, using paired independent bundles and a prespecified cluster-level analysis. Start with at least **20 bundles** spanning leaf and stateful/multi-file behavior; this is a design minimum, not a power calculation—do a pilot for variance and freeze confirmatory sample size afterward. Require rate sensitivity to preserve the result and no quality relaxation. `R ≤ 1` refutes the cost advantage for the tested scope. An interval spanning 1 is unresolved; any leaked holdout or material semantic failure requires correction/requalification before a headline.

### 2. Newly verified held-out workload coverage per all-in dollar

**Exact definition (D):** `Y = sum_j w_j [pass_after(j) − pass_before(j)] / C`, where a family passes only if all its preregistered hidden cases pass, `sum w_j = 1`, and C includes all campaign work. Freeze tasks that fail or are unsupported in the denominator. Publish a separate regression count; only zero-regression artifacts qualify. Do not choose weights after growth. An optional implementation diagnostic is **distinct semantic contracts passing the independent suite per dollar**, with aliases/no-op refusals excluded; bare syscall names are too unequal for a headline.

**Measure:** join immutable `census` journals by program ID **and ELF hash**, cluster by workload family/compiler-runtime dependency, compare before/after, and join the complete ledger from metric 1. Report visible and held-out separately, confidence intervals by family, and non-comparable/excluded counts. The current raw corpus supports the program-level numerator, not family weighting or dollar denominator.

**Baseline:** equal-budget manual/ported implementation on the same seed and manifest. Compare `Y_grow/Y_manual`; this deals better with campaigns where neither arm reaches metric 1's threshold.

**Gaming/prevention:** duplicate workloads and common allocator dependencies multiply successes; success-only spending drops failed targets; shared host environments permit constants to pass. Deduplicate/family-weight before testing, include all spend, vary environment/state independently, and publish causal ablations. Test the same compiler/runtime across independently chosen application families rather than calling thousands of shared-runtime files independent successes.

**Today's value:** no honest per-dollar figure. Historical raw-program delta is **610 held-out** (593 if removing 17 placement-only gains, though other helper contributions remain), and **3,039 total** (2,989 excluding 50 placement-only gains). As a narrow receipt diagnostic only, **610 / 1.469378 = 415.14 new held-out programs per million reported input tokens**; or 8 selected handlers / 1.469378 = 5.44 per million input tokens. Neither is all-in, family-weighted, billed cost, or corrected Linux revalidation. The numerator includes placement and other outer-agent work absent from that token denominator. Path-FS added **zero held-out programs** despite 369,678 metered input tokens plus an unmetered refusal: a useful negative result.

### 3. Held-out compatibility gain with zero observed regressions

**Exact definition (D):** for a frozen comparable set H, `Δ_H = (passing_after − passing_before)/|H|`, paired by ID/hash, with an independent regression constraint `old-pass → fail = 0`. Report after-pass rate, previously-failing recovery fraction and full-denominator lower bound. This measures quality/progress, not efficiency. An explicit named-workload time-to-compatibility can be a secondary clock, using the same start/stop rules as metric 1; hours since a project's founding are not its baseline.

**Measure:** existing `census rerun` and program-level comparison already implement much of this. Re-record Linux references on a real Linux runner with a pinned filesystem, uid, memory limits, architecture and kernel identity; hash the environment and payload. Complete `full-r2`, retain ELF artifacts/source identity and run frozen independent state histories. Audit references independently of candidate authors.

**Baseline:** the same seed kernel for causal progress, and manual growth under an equal budget to compare methods. A mature gVisor pass rate alone is neither a manual growth rate nor its cost.

**Gaming/prevention:** a moving denominator, rebuilding different ELFs, unsuitable reference normalization, gate-selected held-out sets, and a changed baseline can manufacture gains. Freeze manifests and binaries; show every exclusion/failure, distinguish public training gates from final audit, and report timeouts/skips as not passing. Zero observed regressions is a finite sample statement, not a guarantee.

**Today's value:** historical **644/792 = 81.31%**, versus **34/792 = 4.29%**, **Δ=77.02 percentage points**, **610/758 = 80.47% recovery**, zero observed comparable regressions. Stage-0 separately retained **386/386 old held-out passes on 479 comparable held-out programs**. These denominators cannot be concatenated into a current full-corpus measurement. This is the defensible progress headline now, explicitly dated and oracle-qualified; it does not answer “beats manual.”

## Gaming risks that matter most

| Risk already evidenced or plausible | Required control |
|---|---|
| **Oracle agreement mistaken for Linux agreement**: Docker Desktop sharing/root permissions shaped accepted openat/fstat behavior | Independent Linux host recording; record kernel/uid/mount/filesystem provenance, not just container hash. Rerecord sealed probes too. Keep the mode-3 failure as a permanent counterexample. |
| **Overfits pass both splits**: four Phase-2 path handlers; new unlinkat fails variant tree; chdir lacks cwd state | Independently generated trees and operation histories (`chdir → relative open`, rename/unlink/fd reuse, mapping permissions). Vary hidden environments as well as scalars. |
| **Repeated visible runs masquerade as new coverage** | Count distinct cases/histories and fresh environments, not 30 reruns as 30 semantic examples. |
| **Mutant count mistaken for candidate proof** | Existing canonical mutants grade probe adequacy; they do not inspect candidates. Require semantic mutants for the new feature and audit candidate behavior independently. Two wrong-return constants do not validate state. |
| **Gate-held-out score mistaken for generalization** | A candidate accepted against held-out passes it by construction. Use all-visible-passing attempts for disagreement statistics, and a distinct final audit unseen by growth/controllers. E1's informative agreement was 214/234 = 91.5%, not 214/214. [L8] |
| **Model/outer-agent assistance hidden as zero human work** | Charge helper/tool/oracle design, manual fixes, reviewers and all agent sessions, including invalid/filtered/quota/interrupted calls. Preserve missingness explicitly. |
| **Syscall name inflation and false success** | Score semantics and useful workloads; distinguish stubs/ENOSYS, aliases, partial flags and stateful implementation. Retire acceptance when a new counterexample breaks it. |
| **Thousands of programs share one allocator bottleneck** | Family weighting and dependency-stratified reporting; causal ablations. 96.22% mmap-alone share makes independent task replication essential. |
| **Reference noise produces false rejection or easy normalization** | Retain raw observations; calibrate varying quantities carefully; independently specify relations, extent, errno and state. Repair must precede a fresh frozen batch, and its cost counts. |
| **Manual baseline handicapped** | Equal substrate, workload prioritization, tests, code reuse rights, architecture/resource constraints and comparable expertise. Include a modern ordinary-agent baseline as a separate attribution control. |
| **Post-correction claims silently inherit old evidence** | Revoke affected certification, append corrected runs/denominators, and charge repair. Preserve historical results as historical. |

## What is missing to compute the recommended number

1. **A manual arm.** No same-start, same-target, same-quality timed hand-written/ported implementation campaign exists. Public commit histories cannot replace it.
2. **Complete model charges.** Per-provider prices/invoices, subscription allocation policy, cached/reasoning treatment, and outer implementation-agent sessions. A model name such as `gpt-6.1-sol` is not a verified billable price SKU. Path-FS's filtered call and one E1 main call lack metering; invalidated/partial batches also need accounting.
3. **Active human labor and scope.** Briefs, API/primitive design, oracle/test authoring, debugging, inspection, review, stage-0 rewrites and the October 31 correction. Approximate outer-agent elapsed times are not person-hours or billed compute.
4. **Infrastructure ledger.** Per-stage build/oracle/corpus/audit costs and timestamps across the entire campaign. Current attempt clocks exclude substantial work. Avoid counting overlapping elapsed time twice or inventing machine rental charges for a shared laptop.
5. **An independent once-only final evaluation.** Current held-out probes participate in acceptance and share generator/reference assumptions; they are not an untouched final audit. Add stateful/multi-file workloads and feature-specific independent tests.
6. **A completed, corrected Linux reference census.** Complete `full-r2` on remote Linux, rerecord the two sealed probes, pin uid/tree/memory/kernel and exact ELF hashes, and compare the exact final artifact. Until then no corrected current 81% or all-handler Linux-equivalence claim.
7. **A fixed economic decision contract.** Named workloads/families, feature scope, stopping/censoring rules, human rate/sensitivity range, shared-tool amortization, and independent replication sample size. Publish total campaign costs and failures alongside R.

**Practical next study (D):** prepare a blind matched experiment on remote Linux infrastructure, beginning with a small variance pilot and then frozen independent leaf/stateful bundles. Both implementers start from the same seed and APIs; use workload-guided manual prioritization. Do not run that campaign on this laptop. The present report authorizes no infrastructure provisioning or future execution; it specifies what evidence would resolve the research question.

## Sources and provenance

### Local evidence

- **L0:** [Grow README](../../jitk/grow/README.md), [phase2 controller](../../jitk/grow/phase2.ts), [retry accounting](../../jitk/grow/retries.ts), [usage extraction](../../jitk/grow/agent.ts), [recorded-oracle store](../../jitk/grow/oracle-store.ts). Source/read audit, not test execution.
- **L1:** [Phase-2 growth report](../../jitk/docs/results/grow-phase2-2026-10-27.md), [PHASE2.csv](../../jitk/grow/experiments/PHASE2.csv); raw receipts in the two absolute evidence roots above. Aggregated all 30 Phase-2 usage receipts; invalidated mmap has three receipts but only two rejection records.
- **L2:** [Phase-2 corpus](../../jitk/docs/results/scriptc-corpus-phase2.md), [original corpus](../../jitk/scriptc-corpus/RESULTS.md), [grown manifest](../../jitk/grow/phase2-grown/GROWN.json).
- **L3:** [Path-FS report](../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md), [PATHFS.csv](../../jitk/grow/experiments/PATHFS.csv); four successful-call usage receipts, five calls total.
- **L4:** [Stage-0 merge comparison](../../jitk/docs/results/scriptc-corpus-stage0.md).
- **L5:** [Oracle-recording correction](../../jitk/docs/results/oracle-recordings.md).
- **L6:** [R7 SQLite report](../../jitk/docs/results/grow-r7.md).
- **L7:** [E0/E1 report](../../jitk/docs/results/grow-e0-e1-2026-10-26.md), [E1 summary](../../jitk/grow/experiments/summary.json), [E1 main metadata](../../jitk/grow/experiments/E1.json), [pilot metadata](../../jitk/grow/experiments/E1-pilot.json), [split validation](../../jitk/grow/experiments/split-validation.json).
- **L8:** [E2/E3 report](../../jitk/docs/results/grow-e2-e3-2026-10-26.md), [E2.csv](../../jitk/grow/experiments/E2.csv), [E3.csv](../../jitk/grow/experiments/E3.csv).
- **L9:** [GrowOS fit evidence/method](../growos-fit/00-EVIDENCE-AND-METHOD.md), [economics](../growos-fit/01-IMPLEMENTATION-AND-ECONOMICS.md), [needs/products](../growos-fit/02-TRANSCRIPT-NEEDS-AND-PRODUCTS.md), [growth/oracles](../growos-fit/03-GROWTH-METHOD-AND-ORACLES.md), [critical review](../growos-fit/04-CRITICAL-REVIEW.md), [summary](../growos-fit/SUMMARY.md), [brief](../growos-fit/BRIEF.md); context and prior interpretation, not new measurements.
- **L10:** [Compatibility-kernel survey](../growos-node/02-COMPAT-KERNELS.md), [benchmarks/goals](../growos-node/05-BENCHMARKS-AND-GOALS.md). Upstream numbers used above were checked against primary web/source records instead of assumed from these surveys.

### Primary web sources

All accessed 2026-10-31. Mutable docs and APIs can change. Pinned source URLs below identify the inspected tree; historical project claims retain their original dates.

- **P1:** [Loupe, arXiv/ASPLOS 2024 paper](https://arxiv.org/abs/2309.15996), [detailed HTML](https://arxiv.org/html/2309.15996v1), [support-plan data](https://github.com/unikraft/loupedb). The detailed 31-app endpoint takes precedence over ambiguous abstract phrasing.
- **G1:** [gVisor generated ARM64 table](https://gvisor.dev/docs/user_guide/compatibility/linux/arm64/).
- **G2:** [gVisor syscall-test methodology](https://raw.githubusercontent.com/google/gvisor/master/test/syscalls/README.md).
- **G3:** [Google: gVisor one year later, May 31, 2019](https://opensource.googleblog.com/2019/05/gvisor-one-year-later.html).
- **A1:** [Asterinas June 2025 paper](https://arxiv.org/abs/2506.03876).
- **A2:** [Asterinas x86-64 compatibility table](https://asterinas.github.io/book/kernel/linux-compatibility/index.html).
- **A3:** [Authors' 2025 USENIX overview](https://www.usenix.org/publications/loginonline/asterinas-rust-based-framekernel-reimagine-linux-2020s).
- **A4:** [Pinned LTP recipe](https://github.com/asterinas/asterinas/blob/7861bff17133b941cf89329917033541d14813ab/test/initramfs/nix/conformance/ltp.nix), [conformance directory](https://github.com/asterinas/asterinas/tree/7861bff17133b941cf89329917033541d14813ab/test/initramfs/src/conformance).
- **S1:** [Pinned Starry dispatcher](https://github.com/Starry-OS/StarryOS/blob/2e075accf4fb0aefdd1d252ebd9ccf29727d9923/kernel/src/syscall/mod.rs).
- **S2:** [Pinned Starry CI](https://github.com/Starry-OS/StarryOS/blob/2e075accf4fb0aefdd1d252ebd9ccf29727d9923/.github/workflows/test.yml), [runtime template](https://github.com/Starry-OS/StarryOS/blob/2e075accf4fb0aefdd1d252ebd9ccf29727d9923/.github/workflows/test-template.yml).
- **U1:** [Unikraft compatibility docs](https://unikraft.org/docs/concepts/compatibility).
- **U2:** [Unikraft libc-test integration](https://github.com/unikraft/lib-libc-test), [subsystem libraries/tests](https://github.com/unikraft/unikraft/tree/359307a2a4cc9c1feb22683d841650902b799e4d/lib).
- **U3:** [ELF loader](https://github.com/unikraft/app-elfloader/tree/0cd7a2b2c4d5ece85647c0c9903b50426e849420), [application catalog](https://github.com/unikraft/catalog).
- **O1:** [Pinned OSv dispatch template](https://github.com/cloudius-systems/osv/blob/28c0f5a4b6687492387fca6b4f325faa4d891f93/syscalls/syscalls.cc.in), [separate futex/ABI adapter](https://github.com/cloudius-systems/osv/blob/28c0f5a4b6687492387fca6b4f325faa4d891f93/linux.cc).
- **O2:** [OSv tests](https://github.com/cloudius-systems/osv/tree/28c0f5a4b6687492387fca6b4f325faa4d891f93/tests), [ABI deviations, historically dated](https://github.com/cloudius-systems/osv/wiki/OSv-Linux-ABI-Compatibility), [application history](https://github.com/cloudius-systems/osv-apps).
- **N1:** [Nanos syscall source](https://github.com/nanovms/nanos/tree/7305c30689e1f3c6a5366ba9f5ec477ecfbaf8bd/src/unix), [network registrations](https://github.com/nanovms/nanos/blob/7305c30689e1f3c6a5366ba9f5ec477ecfbaf8bd/src/net/netsyscall.c).
- **N2:** [Nanos runtime tests](https://github.com/nanovms/nanos/tree/7305c30689e1f3c6a5366ba9f5ec477ecfbaf8bd/test/runtime), [e2e tests](https://github.com/nanovms/nanos/tree/7305c30689e1f3c6a5366ba9f5ec477ecfbaf8bd/test/e2e).
- **N3:** [Nanos book/syscall list](https://nanos.org/thebook).
- **F1:** [Pinned FTL dispatcher](https://github.com/nuta/ftl/blob/170dfd146eb14c7aa123b12978b29c1d8972bb25/lx/src/syscall/mod.rs).
- **F2:** [FTL introduction, September 14, 2026](https://seiya.me/blog/introducing-ftl).
- **F3:** [FTL 0.1.0, October 3, 2026](https://seiya.me/blog/ftl-v0.1.0).
- **F4:** [Pinned FTL changelog including 0.2.0](https://github.com/nuta/ftl/blob/170dfd146eb14c7aa123b12978b29c1d8972bb25/CHANGELOG.md), [tests](https://github.com/nuta/ftl/tree/170dfd146eb14c7aa123b12978b29c1d8972bb25/tests). Branch-tip raw web cache initially omitted 0.2.0; pinned direct source confirmed it. Changelog says blocking calls **are** interruptible; the October 3 blog says **not** interruptible, so no exact signal-conformance claim is inferred.
- **M1:** [Pinned Moss README](https://github.com/hexagonal-sun/moss-kernel/blob/1358b5d78b9151e382dc60ccda7fe0de191e56af/README.md).
- **M2:** [Pinned Moss syscall table](https://github.com/hexagonal-sun/moss-kernel/blob/1358b5d78b9151e382dc60ccda7fe0de191e56af/etc/syscalls_linux_aarch64.md).
- **M3:** [Moss guest tests](https://github.com/hexagonal-sun/moss-kernel/tree/1358b5d78b9151e382dc60ccda7fe0de191e56af/usertest), [host library](https://github.com/hexagonal-sun/moss-kernel/tree/1358b5d78b9151e382dc60ccda7fe0de191e56af/libkernel).

### GitHub metadata observations and exact sampled heads

Each row links the commit-list and contributor endpoints used. The table preserves observation values because APIs are mutable; no raw JSON files were written. Reachable history includes imported commits and all repository work, not just Linux compatibility.

| ID / repository | Sampled default-branch head | Commit list / contributors APIs |
|---|---|---|
| GH-G — google/gvisor | `aa767e4c43d011121271551fe24da501a56f729d` | [commits](https://api.github.com/repos/google/gvisor/commits?per_page=1), [contributors](https://api.github.com/repos/google/gvisor/contributors?per_page=100) |
| GH-A — asterinas/asterinas | `7861bff17133b941cf89329917033541d14813ab` | [commits](https://api.github.com/repos/asterinas/asterinas/commits?per_page=1), [contributors](https://api.github.com/repos/asterinas/asterinas/contributors?per_page=100) |
| GH-S — Starry-OS/StarryOS | `2e075accf4fb0aefdd1d252ebd9ccf29727d9923` | [commits](https://api.github.com/repos/Starry-OS/StarryOS/commits?per_page=1), [contributors](https://api.github.com/repos/Starry-OS/StarryOS/contributors?per_page=100) |
| GH-U — unikraft/unikraft | `359307a2a4cc9c1feb22683d841650902b799e4d` | [commits](https://api.github.com/repos/unikraft/unikraft/commits?per_page=1), [contributors](https://api.github.com/repos/unikraft/unikraft/contributors?per_page=100) |
| GH-UE — unikraft/app-elfloader | `0cd7a2b2c4d5ece85647c0c9903b50426e849420` | [commits](https://api.github.com/repos/unikraft/app-elfloader/commits?per_page=1), [contributors](https://api.github.com/repos/unikraft/app-elfloader/contributors?per_page=100) |
| GH-O — cloudius-systems/osv | `28c0f5a4b6687492387fca6b4f325faa4d891f93` | [commits](https://api.github.com/repos/cloudius-systems/osv/commits?per_page=1), [contributors](https://api.github.com/repos/cloudius-systems/osv/contributors?per_page=100) |
| GH-N — nanovms/nanos | `7305c30689e1f3c6a5366ba9f5ec477ecfbaf8bd` | [commits](https://api.github.com/repos/nanovms/nanos/commits?per_page=1), [contributors](https://api.github.com/repos/nanovms/nanos/contributors?per_page=100) |
| GH-F — nuta/ftl | `170dfd146eb14c7aa123b12978b29c1d8972bb25` | [commits](https://api.github.com/repos/nuta/ftl/commits?per_page=1), [contributors](https://api.github.com/repos/nuta/ftl/contributors?per_page=100) |
| GH-M — hexagonal-sun/moss-kernel | `1358b5d78b9151e382dc60ccda7fe0de191e56af` | [commits](https://api.github.com/repos/hexagonal-sun/moss-kernel/commits?per_page=1), [contributors](https://api.github.com/repos/hexagonal-sun/moss-kernel/contributors?per_page=100) |

[L1]: ../../jitk/docs/results/grow-phase2-2026-10-27.md
[L2]: ../../jitk/docs/results/scriptc-corpus-phase2.md
[L3]: ../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md
[L4]: ../../jitk/docs/results/scriptc-corpus-stage0.md
[L5]: ../../jitk/docs/results/oracle-recordings.md
[L6]: ../../jitk/docs/results/grow-r7.md
[L7]: ../../jitk/docs/results/grow-e0-e1-2026-10-26.md
[L8]: ../../jitk/docs/results/grow-e2-e3-2026-10-26.md
[G1]: https://gvisor.dev/docs/user_guide/compatibility/linux/arm64/
[G2]: https://raw.githubusercontent.com/google/gvisor/master/test/syscalls/README.md
[G3]: https://opensource.googleblog.com/2019/05/gvisor-one-year-later.html
[A1]: https://arxiv.org/abs/2506.03876
[A2]: https://asterinas.github.io/book/kernel/linux-compatibility/index.html
[A3]: https://www.usenix.org/publications/loginonline/asterinas-rust-based-framekernel-reimagine-linux-2020s
[A4]: https://github.com/asterinas/asterinas/blob/7861bff17133b941cf89329917033541d14813ab/test/initramfs/nix/conformance/ltp.nix
[S1]: https://github.com/Starry-OS/StarryOS/blob/2e075accf4fb0aefdd1d252ebd9ccf29727d9923/kernel/src/syscall/mod.rs
[S2]: https://github.com/Starry-OS/StarryOS/blob/2e075accf4fb0aefdd1d252ebd9ccf29727d9923/.github/workflows/test.yml
[U1]: https://unikraft.org/docs/concepts/compatibility
[U2]: https://github.com/unikraft/lib-libc-test
[U3]: https://github.com/unikraft/catalog
[P1]: https://arxiv.org/html/2309.15996v1
[O1]: https://github.com/cloudius-systems/osv/blob/28c0f5a4b6687492387fca6b4f325faa4d891f93/syscalls/syscalls.cc.in
[O2]: https://github.com/cloudius-systems/osv/tree/28c0f5a4b6687492387fca6b4f325faa4d891f93/tests
[N1]: https://github.com/nanovms/nanos/tree/7305c30689e1f3c6a5366ba9f5ec477ecfbaf8bd/src/unix
[N2]: https://github.com/nanovms/nanos/tree/7305c30689e1f3c6a5366ba9f5ec477ecfbaf8bd/test/runtime
[N3]: https://nanos.org/thebook
[F1]: https://github.com/nuta/ftl/blob/170dfd146eb14c7aa123b12978b29c1d8972bb25/lx/src/syscall/mod.rs
[M1]: https://github.com/hexagonal-sun/moss-kernel/blob/1358b5d78b9151e382dc60ccda7fe0de191e56af/README.md
[M2]: https://github.com/hexagonal-sun/moss-kernel/blob/1358b5d78b9151e382dc60ccda7fe0de191e56af/etc/syscalls_linux_aarch64.md
[M3]: https://github.com/hexagonal-sun/moss-kernel/tree/1358b5d78b9151e382dc60ccda7fe0de191e56af/usertest
[GH-G]: https://api.github.com/repos/google/gvisor/commits?per_page=1
[GH-A]: https://api.github.com/repos/asterinas/asterinas/commits?per_page=1
[GH-S]: https://api.github.com/repos/Starry-OS/StarryOS/commits?per_page=1
[GH-U]: https://api.github.com/repos/unikraft/unikraft/commits?per_page=1
[GH-UE]: https://api.github.com/repos/unikraft/app-elfloader/commits?per_page=1
[GH-O]: https://api.github.com/repos/cloudius-systems/osv/commits?per_page=1
[GH-N]: https://api.github.com/repos/nanovms/nanos/commits?per_page=1
[GH-F]: https://api.github.com/repos/nuta/ftl/commits?per_page=1
[GH-M]: https://api.github.com/repos/hexagonal-sun/moss-kernel/commits?per_page=1

[F2]: https://seiya.me/blog/introducing-ftl
[F3]: https://seiya.me/blog/ftl-v0.1.0
[F4]: https://github.com/nuta/ftl/blob/170dfd146eb14c7aa123b12978b29c1d8972bb25/CHANGELOG.md
