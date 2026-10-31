# GrowOS novelty: prior art and defensible claims

Research cutoff: **2026-10-31**. Repository inspected at `e84bc278a06b98289ca6ca90bd1b0bb3fb36c90a`. This is desk research: repository/source reads and public web research only. No builds, tests, benchmarks, containers, virtual machines, or Linux execution were performed. This report is the only file written by this task.

**Evidence labels:** **V** means verified in an inspected primary source, including an explicitly attributed author/project result; it does not mean independently reproduced. **I** means this report's inference. **U** means unverified or not established by the inspected sources. A missing public description is not proof that a capability does not exist. Mutable documentation describes what was visible at the cutoff; historical results must be tied to their own artifacts.

## Verdict

- **The broad idea is not new.** LLM generation plus executable-reference checking already exists in systems translation and emulation; Linux-reference compatibility testing is established OS practice. Combining these ingredients is a credible engineering/research direction, not an invention of either ingredient. [FLOURINE][S06], [LEMU][S05], [gVisor][S09]
- **“An agent builds/evolves an OS” and “an agent builds a Linux-compatible kernel” are already occupied claims.** OSFoundry and Ginux are especially important 2026 comparators, beyond the numerous hobby OS demonstrations. [OSFoundry][S01], [Ginux][S03]
- **The closest method precedent found is LEMU:** incremental LLM synthesis/repair of QEMU instruction translators, checked against hardware or a reference translator, with separate held-out evaluation. The unit is an instruction rule rather than a Linux syscall. [LEMU][S05]
- **The closest OS-development precedents are SysSpec/SpecFS, OSFoundry, and AI-assisted StarryOS compatibility fixes.** They establish generated systems components, feature evolution, and workload/ABI-driven repair; the inspected evidence does not establish GrowOS's complete sealed Linux differential acceptance arrangement. [SysSpec][S02], [StarryOS account][S12]
- **A very close public practitioner precedent predates the GrowOS result:** Cormack's October 10 interview describes agent-written Rust `mkfs.xfs` matched against the original. A public repository actually exists; its narrower default-metadata scope contradicts treating the interview's “all flags” aspiration as demonstrated completeness. [Interview][S04], [implementation][S04b]
- **What may be distinctive is the particular evaluated combination:** workload-discovered missing Linux behavior → constrained handler proposal → Linux-derived visible and sealed checks → test-sensitivity controls and integration regression gates → retained code in an EL0/EL1-separated hardware guest. **I: no exact public match was found; “first” is not established.**
- **Gate design is the stronger research story than code generation.** Hidden tests, mutation testing, trusted evaluators, and retained successful implementations are established techniques. A contribution needs evidence that this particular gate arrangement detects plausible wrong syscall implementations and reduces development effort. [Reboot][S07], [EvalPlus][S25], [SWE-Marathon][S26]
- **Correct the numerical claim:** the specified Phase 2 report says **159/3,947 (4.0%) → 3,198/3,947 (81.0%)**, not 11% → 81%; stock-layout ELFs reach 73.2%. `mmap` alone accounts for 2,924/3,039 newly passing programs. The October 31 merge check covers a smaller re-recorded corpus and does not remeasure the full 81% headline. [Local results](../../jitk/docs/results/scriptc-corpus-phase2.md), [merge validation](../../jitk/docs/results/scriptc-corpus-stage0.md)
- **Do not claim Linux equivalence, autonomous kernel creation, or security qualification.** Historical gate-passing path handlers were wrong, normalization suppresses some semantics, human helpers were essential, and Linux oracle environment changes altered expected errors. These are useful findings about acceptance limits, not details to omit. [Path experiment](../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md), [oracle corrections](../../jitk/docs/results/oracle-recordings.md)

## Closest prior work table

Closeness is to the **growth/acceptance method**, not a ranking of OS quality. “No sealed gate established” means the inspected publication does not demonstrate that property. Results below are upstream-reported (**V**), not rerun here.

| Work; date/status | Generated artifact or growth process | Reference / acceptance / reported result | Relationship to GrowOS |
|---|---|---|---|
| **OSFoundry / SpecOS**, 2026 preprint; displayed submission August 8, date caveat below [S01][S01] | Specification-guided agents construct and evolve an xv6-derived OS; also Linux fixes | Build/boot/tests and semantic review; 70/70 xv6 tests; 11 Linux tasks | **Very close OS scope.** No real-Linux differential/secret-probe pipeline established |
| **SysSpec / SpecFS**, December 2025 preprint; FAST 2026 [S02][S02] | Generate modular C filesystem; regenerate features from specification patches | Spec review + unit/regression/xfstests; ~4,300 LOC, 45 modules, ten Ext4-inspired features | **Very close component evolution.** FUSE userspace filesystem, different oracle |
| **Ginux**, October 2026 technical report; evaluated commit October 23 [S03][S03] | Human-directed agent builds Rust x86-64 kernel and Linux personality | Executable ABI/application gates; selected Alpine programs and Rocky 10 systemd boot | **Very close kernel/compatibility scope.** Sealed differential acceptance not established |
| **Cormack `mkfs-xfs`**, October 10–11, 2026 interview/blog + public code [S04][S04], [S04b][S04b] | Agent rewrites filesystem formatter as Rust library | Pinned original formatter; byte/metadata comparison; bounded default metadata support | **Very close systems oracle workflow.** Not a syscall layer or kernel-growth experiment |
| **LEMU**, Journal of Systems Architecture, August 2026 [S05][S05] | LLM generates and repairs per-instruction QEMU TCG rules | IR checks + execution traces from hardware/QEMU; 85.0% within ten rounds; held-out vendor tests 89.5% | **Closest synthesis method.** Instruction semantics rather than Linux ABI; held-out evaluation is not necessarily a secret promotion gate |
| **FLOURINE**, May 19, 2024 preprint [S06][S06] | LLM C/Go→Rust translation and counterexample-driven repair | Original executable + cross-language differential fuzzing; best model translates ~47% | Direct precedent for accepting generated low-level code against an executable reference |
| **Reboot**, June 25, 2026 preprint [S07][S07] | Incrementally restore features while translating interpreters to safe Rust | Six interpreters, 6–23k LOC; 100% supplied tests, 62–92% never-exposed validation tests | Strong precedent for incremental systems generation with separately withheld evaluation |
| **Syzygy**, December 18, 2024 preprint; LLM4Code 2025 preliminary version [S08][S08] | Dependency-ordered C→Rust code/test translation guided by dynamic analysis | Zopfli ~3k C LOC, 98 functions; source/translation equivalence tests | Generated retained systems library; no OS or Linux semantic oracle |
| **gVisor syscall tests**, longstanding, current primary docs [S09][S09] | Humans implement Linux ABI in Sentry | Same tests on Linux and gVisor; Linux-first development policy | **Exact compatibility-reference precedent.** LLM proposer and sealed acceptance not established |
| **Fuchsia Starnix tests**, longstanding project/current docs [S10][S10] | Rust Linux UAPI personality on Zircon | Same syscall binaries cross-tested on Linux; Machina Linux test variants | Same real-Linux validation principle, different kernel substrate; no demonstrated grow agent |
| **Asterinas**, ATC July 2025; current conformance tree [S11][S11], [S11b][S11b] | Safe-Rust Linux ABI implementation over OSTD | Paper reports 210+ syscalls; project integrates LTP/gVisor/other tests | Linux-compatible Rust kernel/testing already established; not an agent-growth result |
| **StarryOS / TGOSKits fixes**, May–June 2026; account updated October 11 [S12][S12], [S12b][S12b] | AI-assisted, narrowly scoped ABI fixes motivated by syscall tests/nginx | Raw-syscall regressions, Linux ABI comparison, multi-architecture execution; account reports 146 futex checks | **Close practical overlap:** AI + workload-driven Linux compatibility; sealed automatic oracle gate U |
| **syz-verifier**, Linux Plumbers 2021; current docs [S13][S13], [S13b][S13b] | Compare syscall-sequence behavior across kernels | Current description compares errno on corpus programs; talk considers Linux vs gVisor | Differential syscall testing predates LLMs; not code generation |
| **OSVBench**, April 29, 2025 preprint; AAAI March 14, 2026 [S14][S14] | Generate formal syscall transition specifications for Hyperkernel | 245 tasks; verifier/oracle-spec comparison including buggy implementations | Kernel-specific generated artifacts, trusted checking and injected faults; not Linux handler synthesis |
| **BODHI**, 2026 preprint; displayed April 22 date [S15][S15] | Domain-guided C→Python/Z3 syscall specification inference | OSVBench; best reported 96.73% Pass@1 | Follow-on formal-spec generation; not executable Linux-reference growth |
| **AUTODRIVER / DRIVEBENCH**, November 24, 2025 preprint [S16][S16] | LLM closed-loop maintenance of Linux drivers across kernel changes | 235 validated corpus cases; 55-case evaluation, 56.4% compilation; boot checks | Agent-written OS component patches already done; initialization is weaker than differential semantics |
| **DevGen**, ACL demo July 2–7, 2026; also FSE 2026 record [S17][S17], [S17b][S17b] | Generate QEMU device models from Linux driver source | Compile/execution repair; usable models for 44/50 drivers including minor manual fixes | Generated system emulation, but driver responsiveness/fuzzing reach is not hardware-equivalence checking |
| **KernelGPT**, December 31, 2023 preprint; ASPLOS 2025 [S18][S18] | Generate syzkaller syscall descriptions; validate/repair them | Reports 24 new Linux bugs, 11 CVEs | Generates **fuzzer specifications**, not syscall implementations |
| **CrashFixer / Live-kBench**, April 2025 / February 2026 preprints [S19][S19], [S19b][S19b] | Agents patch Linux to resolve crashes | Reproducer execution; later evaluation separates crash resolution from equivalent patches | OS repair precedent; no-crash acceptance does not establish intended semantics |
| **DiffSpec**, October 5, 2024 preprint [S20][S20] | LLM constructs differential tests for eBPF/Wasm implementations | Reports confirmed eBPF/Wasm bugs | Reference-driven test generation rather than implementation growth |
| **Carlini C compiler**, February 5, 2026 first-party engineering report [S21][S21] | Agents grow Rust compiler toward real workload support | Test suites, CI and GCC oracle; ~100k LOC; Linux build demonstration | Clear precedent for workload-driven systems generation with a mature reference |
| **Intel IDEAS / RustAssure**, 2026 / October 2025 [S22][S22], [S22b][S22b] | LLM C→Rust generation with equivalence infrastructure | IDEAS equivalence test generation; RustAssure differential symbolic testing | Low-level translation correctness already an active field; no kernel-growth result |
| **Google giflib-rs**, public by 2026 cutoff [S23][S23] | AI-assisted API-compatible Rust library replacement | Primary README documents deliberately retained behavior differences | Real generated compatibility artifact; primary blog's large-scale validation figures not independently readable here |
| **JitSynth**, CAV 2020; **oracle-guided synthesis**, ICSE 2010 [S24][S24], [S24b][S24b] | Synthesize JITs from interpreters / programs from oracle queries | Symbolic semantic checks / SMT-driven learning | Foundational generate/check/reference pattern, without LLMs |
| **Termite / RevNIC**, SOSP 2009 / EuroSys 2010 [S36][S36], [S36b][S36b] | Synthesize drivers from formal interfaces / reverse-engineer driver binaries into new drivers | Termite demonstrates Linux and FreeBSD drivers; RevNIC ports four NIC drivers, producing 11 binaries | Automated OS-component creation and reference-derived portability long predate LLMs |
| **EvalPlus / SWE-Marathon**, 2023 / June 2026 [S25][S25], [S26][S26] | Evaluate generated code using stronger tests; protect long-horizon verifiers | Expanded reference tests; hidden assets and anti-cheating controls | Test hardening, held-out checking and verifier separation are not new individually |
| **AlphaEvolve / KernelEvolve**, May 2025 / April 2, 2026 [S27][S27], [S27b][S27b] | Generate/select retained programs or accelerator kernels under evaluators | Automated correctness/performance feedback; accumulating successful code/experience | “Grow and retain code after machine checks” already done; accelerator kernels ≠ OS kernels |

## Detailed notes

### 1. What exactly is being compared

GrowOS should be described as **offline development of a restricted Linux execution profile**. The target artifact is a tiny Rust `no_std` AArch64 guest kernel with EL0 programs and EL1 handlers. The model is a proposer during development, not a syscall implementation queried at runtime. One unmodified static Linux ELF executes per hardware VM. This is meaningfully different from calling an agent framework an “OS,” or running inference inside a conventional kernel. [Kernel README](../../jitk/kernel/README.md)

For comparison, separate five properties:

1. Does a model generate **implementation code**, rather than tests, policies or formal specifications?
2. Does generated code implement **Linux ABI behavior**, rather than a new interface or device approximation?
3. Is **executed Linux behavior** the semantic reference, rather than prose, an LLM judge or simple crash absence?
4. Are tests/reference outputs and acceptance authority **outside proposer control**, including genuinely reserved inputs?
5. Does the system **accumulate useful compatibility** from workload failures, with independently evaluated outcomes and effort?

No inspected public item establishes all five in GrowOS's exact configuration. Several establish most of the methodological pieces. **I:** the potential contribution is the combination and its measured consequences; a conjunction of implementation choices is not automatically a publishable research contribution.

### 2. OSFoundry and SysSpec: the mandatory OS-generation comparisons

**V:** OSFoundry uses a persistent Plan plus OS specifications, implementation/review/refinement roles, and build/QEMU/GDB feedback. Its SpecOS derives from xv6; module accuracy includes an LLM judge. **I:** this defeats claims to first agent-driven OS construction/evolution. Its “oracle” baseline supplies dependency source in the prompt; that term does **not** denote GrowOS's Linux execution oracle. No differential or held-out Linux gate was established in the inspected full text. [Paper §§4–5][S01]

**V:** SysSpec's SpecFS generates a FUSE filesystem from functional, module and concurrency specifications. Validation uses model review and traditional tests; the paper reports 690/754 xfstests passes, with failures attributed to unsupported functionality. It also regenerates features from specification patches and caches validated implementations. **I:** OS-component generation and retained feature evolution are prior art. Its source explicitly leaves kernel-mode execution and crash consistency outside the demonstrated scope. [Paper §§4.5–6.6][S02]

**Date caveat (U):** the inspected OSFoundry arXiv page displays August 8, 2026, despite identifier `2609.25018`. BODHI similarly displays April 22 under `2605.23931`. Preserve those displayed dates as source metadata, but verify authoritative announcement/version records before making a day-level priority argument. Both are pre-cutoff 2026 leads regardless of that discrepancy. [OSFoundry record][S01a], [BODHI record][S15]

### 3. Ginux: a concurrent independent Linux-compatible agent-built kernel

**V:** the technical report distinguishes its October 23 checkpoint from later development and reports a human-directed implementation/execute/diagnose/revise process. It explicitly says behavioral gates were developed alongside the kernel and disclaims broad Linux compatibility or independent reproduction. **I:** its scale and successful Linux userspace execution make it a mandatory comparator, not a hobby-demo footnote. [Report][S03b]

**U:** the inspected report, README, roadmap and hardening plan do not establish a separately sealed Linux differential acceptance corpus, mutant-based test qualification, or proposer-denied reference assets. This is an evidence boundary, not a claim that Ginux has no differential tests anywhere. Compare historical artifacts rather than silently attributing today's hardening to the eleven-day experiment. [Roadmap][S03c], [hardening track][S03d]

### 4. LEMU: the closest oracle-guided low-level generation method

**V:** LEMU retrieves ISA documentation, emits constrained QEMU TCG translation rules, checks compile-time IR properties and instruction-level execution traces, and feeds structured discrepancies back for localized repair. References are physical hardware for C28x/C66x and upstream QEMU for ORBIS32. It reports separate vendor/library/benchmark generalization results. [Publisher article][S05]

**I:** “a learned proposer fills missing low-level semantics, an execution reference decides if it works” is therefore already demonstrated outside OS syscalls. GrowOS differs in Linux ABI/environment/state, real user/kernel separation and compatibility gains on unchanged applications. **U:** the accessible article does not establish that LEMU's held-out evaluations are cryptographically sealed, inaccessible to the agent, or mandatory acceptance gates. Do not claim it lacks held-out tests; it expressly has them. A code artifact and full experimental protocol would be needed for a finer comparison.

### 5. The October `mkfs.xfs` discussion is stronger prior art than its retellings suggest

**V:** the October 10 Cormack interview describes an agent building a Rust formatter by matching the original bytes across configurations; Huntley's October 11 post explicitly advocates golden-oracle porting. [Interview][S04], [post][S04a]

**V:** `justincormack/mkfs-xfs` is public. Its README limits support to the default single-data-device metadata surface, with no stable API or CLI. The comparison example fixes UUID/random seed and compares the generated metadata manifest against reference extents. **I:** this is a concrete systems-tool oracle workflow, but not evidence of every `mkfs.xfs` flag or arbitrary filesystem-history equivalence. No reserved-probe or mutant acceptance design was established. [README][S04b], [comparison source][S04c]

### 6. Differentially checked systems translation is established

**V:** FLOURINE already compiles LLM translations, differentially fuzzes against the original, and retries using counterexamples or restart strategies. Its reference is executable source behavior, not an LLM opinion. It studies manageable extracted C/Go code rather than a whole OS. [Paper][S06]

**V:** Syzygy grows a safe Rust translation in dependency order with dynamically informed code/test translation and source-equivalence testing. [Paper][S08]

**V:** Reboot adds an especially relevant feature-restoration strategy and tests never exposed to its translation system. Its gap between supplied-suite success and separate validation is directly relevant to GrowOS's gate-quality question. **I:** incremental feature growth and held-out systems validation cannot be claimed as original in the abstract. [Paper][S07]

**V:** IDEAS documents equivalence-test generation and isolated translation workflows; RustAssure explicitly uses differential symbolic testing for LLM translations. The latter reports 89.8% compilable functions, of which 69.9% produced equivalent symbolic return values, across five applications/libraries. **U:** an IDEAS accuracy result was not established here, and no numerical comparison with GrowOS is justified across these task distributions. [IDEAS][S22], [RustAssure][S22b]

**V:** Google's giflib-rs README identifies an AI-assisted API-compatible replacement, while documenting changes for invalid dimensions, write failures and OOM. The first-party validation blog returned no readable body through this research interface. **U:** therefore this report does not adopt secondary reports' 30-million-image/200-million-iteration figures as verified facts. The public code is enough to establish the compatibility-rewrite precedent. [README][S23], [unreadable first-party blog][S23b]

### 7. Linux as compatibility oracle: gVisor and Starnix

**V:** gVisor's test documentation says syscall tests run on both Linux and gVisor, recommends writing them on Linux before implementing support, and warns that man pages can be wrong. This is Linux implementation behavior as authority for adding new syscall/argument behavior. **I:** attaching an LLM proposer changes the labor and automation, not the origin of this validation principle. These are principally Linux-grounded assertion tests, not necessarily automatic raw-output diffs for every case. [Test methodology][S09]

**V:** Starnix's guide explicitly cross-tests Linux UAPI with the same binaries; its Machina runtime supplies Linux VM variants alongside Starnix tests. **I:** running real Linux as an acceptance reference for an independently implemented syscall surface is plainly prior practice. Neither source establishes a GrowOS-style agent proposing bounded patches against sealed generated profiles. [Test-writing guide][S10], [Machina guide][S10b]

### 8. Asterinas and StarryOS: Rust compatibility and practical AI collaboration

**V:** Asterinas's ATC 2025 paper establishes a substantial Linux-compatible safe-Rust kernel; current source has conformance adapters for established external suites. **I:** Rust, small unsafe foundations, and Linux binary compatibility should be background architecture, not GrowOS's novelty claim. **U:** this review does not establish agent-grown Asterinas syscall code under an immutable Linux differential gate. Its proof-assistance work is a separate line. [ATC paper][S11], [test tree][S11b], [verification project][S11c]

**V:** the StarryOS training account explicitly describes collaboration with AI, scoped syscall/ABI changes, focused C reproducers and real-app-driven requirements. It covers futex/robust-list repairs and nginx-dependent socket behavior. PR #657 was merged May 18, 2026. **I:** even “AI-assisted workload-driven Linux compatibility development” is too broad as a priority claim. **U:** neither the account nor sampled PR establishes agent-only proposals, blind Linux-output acceptance, or sealed held-out cases. Distinguish TGOSKits from the separate Starry-OS repository. [Account][S12], [PR][S12b], [test layers][S12c]

### 9. syzkaller differential checks, conformance suites and older filesystem testing

**V:** syz-verifier's current documentation describes comparing existing syscall-sequence corpus programs across Linux versions, presently using returned errno. Its 2021 talk also discusses Linux-vs-gVisor comparison and intentional-difference noise. **U:** an April 2025 issue records that the tool was then broken; that historical status must not be asserted as its October 2026 status. [Current upstream documentation][S13], [2021 talk][S13b], [historical issue][S13c]

**V:** LTP and its POSIX tests supply established regression/conformance infrastructure; Asterinas and Starnix already integrate external suites. Linux behavior is broader and sometimes different from POSIX's required behavior. Passing a POSIX suite is not exact Linux ABI equivalence. [LTP][S28], [Asterinas integration][S11b]

**V:** older randomized filesystem testing used Linux filesystems as a differential oracle, comparing return values, errors and resulting filesystem state. This predates generative models by many years. **I:** GrowOS should emphasize how it chooses, seals and qualifies its observations rather than presenting Linux differential testing itself as new. [Groce et al., 2008 paper][S29]

### 10. Generated drivers, syscall descriptions and repair: avoid category errors

**V:** Termite synthesized driver C from formal device/OS interfaces, demonstrating Linux drivers and reuse for FreeBSD. RevNIC executed and analyzed existing binary drivers, extracted device behavior and generated replacement drivers for multiple OSes; it reports four source NIC drivers and 11 output binaries. **I:** both defeat claims that automated creation of OS compatibility components or reuse of observed implementation behavior began with LLMs. Neither uses LLM proposals or GrowOS's sealed Linux syscall acceptance. [Termite, SOSP 2009][S36], [RevNIC, EuroSys 2010][S36b]

**V:** AUTODRIVER generates maintenance patches for actual Linux drivers, with compilation and QEMU initialization checks. Those checks do not establish full device functionality or Linux-reference equivalence. [Paper][S16]

**V:** DevGen generates the **virtual device**, not the driver. Successful interaction permits fuzzing real driver code, but does not demonstrate faithful physical-device semantics. Its 44/50 figure includes small manual fixes and complementary models. The similarly named SECUTE 2026 AutoDriver instead generates **fuzz harnesses for libraries**; it is not a second Linux-driver implementation system. [DevGen][S17], [unrelated AutoDriver][S17c]

**V:** KernelGPT generates syzkaller input descriptions, with validation/repair; it does not implement syscall handlers. **I:** “syscall synthesis” in this literature often means generating inputs or descriptions. Read the artifact type before counting it as direct prior implementation work. [KernelGPT][S18]

**V:** CrashFixer and Live-kBench address kernel crash repair. The later benchmark distinguishes resolving a reproducer from producing a semantically equivalent fix. **I:** a kernel that no longer crashes can simply skip an operation; GrowOS's behavioral acceptance is a materially different objective, albeit not a new general verification principle. [CrashFixer][S19], [Live-kBench][S19b]

### 11. Formal syscall specifications and proofs are adjacent, not interchangeable

**V:** OSVBench generates formal Hyperkernel state-machine specifications, evaluated with a verifier and reference specifications, including injected-bug variants. BODHI improves this task with domain guidance. **I:** these establish kernel-specific model generation constrained by independent checks, but their “oracle” is not executed Linux, and their output is not a running Linux-compatible handler. [OSVBench][S14], [BODHI][S15]

**V:** MachCSL's September 2026 preprint reports AI-assisted verification of 6,593 lines of xv6 C/assembly against detailed RISC-V semantics, finding nine xv6 bugs and one Sail bug. This is stronger proof machinery for a different specification, not Linux compatibility growth. [Paper][S30]

**V:** JitSynth synthesizes in-kernel DSL compilers from source/target interpreters with solver-backed semantic guarantees. Oracle-guided component synthesis dates to at least ICSE 2010. **I:** GrowOS is a testing-based synthesis workflow; do not call it formally verified or full CEGIS unless its verifier really supplies the required semantic guarantee/counterexample relation. [JitSynth][S24], [oracle-guided synthesis][S24b]

### 12. Generated tests, secret evaluation and accepted-code retention

**V:** DiffSpec generates meaningful differential tests from specifications, code and bug information; it evaluates eBPF runtimes and Wasm validators. Its role is test generation, not implementing the tested system. [Paper][S20]

**V:** EvalPlus demonstrates that more powerful reference-derived tests expose wrong generated programs missed by original suites. SWE-Marathon documents visible/hidden checks and anti-cheating measures, including sealed evaluation assets and integrity checks. **I:** stronger tests, hidden assets and source/evaluator isolation are established techniques. What GrowOS needs to show is their adequacy for Linux state and environment semantics. [EvalPlus][S25], [SWE-Marathon paper][S26]

**V:** AlphaEvolve and Meta's KernelEvolve already retain evaluated code/experience and repeatedly generate improved candidates. The latter optimizes accelerator code; it does not grow an OS kernel. **I:** retention and self-improvement language alone adds no novelty. [AlphaEvolve][S27], [KernelEvolve][S27b]

### 13. Agent-built OS projects and “AI OS” false positives

**V:** Arjun Guha's SlopOS README attributes its kernel/userland work to a coding agent, using Scheme over a small C kernel. SlopLabs/slopos is a different project and explicitly describes an OS designed/written by agents. Viralcode/vib-OS claims an AI-built custom kernel. **U:** this research did not establish a Linux-reference acceptance gate or independently reproduced completeness for these projects. Exact initial public dates require release/commit-history checks; January 2026 discovery dates for the first and third were surfaced, not fully audited. [Guha SlopOS][S31], [SlopLabs][S31b], [vib-OS][S31c]

**V:** Fable-OS describes an agent directly controlling its kernel; AIOS and Agent libOS present agent-oriented runtime abstractions. The Agent libOS abstract explicitly excludes drivers, kernel-mode isolation and a POSIX-compatible OS. **I:** runtime control/self-extension differs from offline Linux compatibility synthesis. Do not dismiss all such projects as fake, but do not equate an “agent kernel” metaphor with EL1 code. [Fable-OS][S32], [AIOS][S32b], [Agent libOS][S32c]

**U:** additional 2026 projects such as EMBER, GLaDOS and AgentOS appeared in discovery. Their advertised capabilities and dates are not sufficiently audited here to make them priority-defining evidence. Their existence reinforces the need to avoid “first agent wrote an OS”; the closer, better-supported comparators above already settle that claim.

### 14. AutoOS, self-growing systems and specialization

**V:** ICML 2024 AutoOS searches Linux **configuration options** with an LLM and reports up to 25% improvement over vendor configurations; BYOS likewise generates configurations using OS knowledge and reports improvements of 7.1–155.4% in its settings. They do not synthesize missing Linux ABI implementation code. Successful boot/performance tuning is a different acceptance objective. [AutoOS publication][S33c], [BYOS][S33b]

**V:** Unikraft's EuroSys 2021 work already constructs application-specialized systems from modular OS libraries. Nanos already pursues single-application Linux binary execution in a VM. **I:** workload-specific small systems and one-program-per-VM architecture are prior art. Linking existing selected code is different from synthesizing missing behavior on demand. [Unikraft paper][S34], [Nanos][S34b]

**I:** describe GrowOS's “on-demand” behavior precisely: workload failures guide **offline** development, and retained implementations are reused. It does not currently establish a production VM safely rewriting its own kernel on each missing syscall, general online self-repair, or model-free discovery of the entire needed OS design. Its safe substrate and extension interface are designed engineering inputs.

### 15. What the repository actually supports, and what changed after the experiments

The brief's full gate description must not be projected onto every experimental result:

- **Original named-profile loop:** `grow/loop.ts` invokes probe-constant lint, independent host tests for the filesystem profiles, semantic/error/state probes, sealed probes, targeted mutants and application integration. Source validation is a separate stage. [Current loop](../../jitk/grow/loop.ts)
- **Phase 2:** the inspected `phase2.ts` invokes source validation, generated visible/held-out observations, two constant-wrong-return controls, SQLite and visible/held-out corpus integration. It does **not** invoke the named-profile constant lint or independent host handler-test gate. Its `checkHost` call checks runner/protocol conditions; it is not the independent filesystem assertion suite. [Current Phase 2 code](../../jitk/grow/phase2.ts), [historical report](../../jitk/docs/results/grow-phase2-2026-10-27.md)
- **Mutants grade test sensitivity.** In the named-profile design they are known wrong implementations checked by the probes; in Phase 2 the sampled wrong-return variants replace the handler. Rejecting them does not prove the accepted candidate correct. Crashes, incomplete protocol and timeouts must not count as semantic mutant rejection. Thirty repeats are repeatability evidence, not thirty independent semantic cases.
- **Historical path failure:** accepted `chdir` could return success without changing cwd; a tree-variant audit caught accepted `unlinkat`; host filesystem constants passed coarse output checks. Several candidates were excluded by human judgment after passing gates. Therefore automated gate acceptance and final kernel inclusion are different events. [Path audit](../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md)
- **Do not carry old defects forward as current facts.** The October 29 fit research describes substring validation and a tree variant used only post hoc. At this inspected HEAD, `validateSource` uses Rust tokens and rejects compile-time input names; Phase 2 preparation defaults to a different held-out tree. Those are source-inspected changes, not evidence that historical accepted candidates received the newer gates or proof that compilation isolation is complete. [Validator](../../jitk/grow/loop.ts), [profile preparation](../../jitk/grow/phase2.ts)
- **Linux environment is part of the oracle.** October 31 re-recording on a Linux runner with uid 65534 changed `openat` access-mode errors that root/Docker Desktop recordings had shaped. Two sealed recordings remain Docker Desktop references. A container image hash pins userspace, not the host Linux kernel, mount implementation, credentials or all resource behavior. [Oracle recordings](../../jitk/docs/results/oracle-recordings.md)

The strongest numerical account is consequently:

| Artifact/evaluation | What was measured | Interpretation |
|---|---|---|
| Phase 2, October 27 | 159/3,947 → 3,198/3,947 comparable compiled programs; visible 81.0%, held-out 81.3%; no comparable regressions | Strong within-corpus compatibility gain; 180 drifted ELFs excluded |
| Same result over all 4,127 compiled programs | 3,198/4,127 = 77.5% lower bound | Counts excluded programs as not passing |
| Stock-link-layout ELFs | 2,888/3,947 = 73.2% | The 81% number uses the specified jitk link layout; keep source-unmodified and stock-binary-unmodified claims separate |
| Attribution | `mmap` alone 2,924 new passes; human placement change alone 50; human mmap helpers 55 lines | Large corpus size does not imply thousands of independent syscall behaviors or wholly autonomous implementation |
| Stage 0 merge, October 31 | 1,848/1,848 earlier passes retained, including 386 held-out, among 2,313 comparable programs in a 2,400-program re-recording | Demonstrates no regressions on the comparable subset; not a new full-corpus 81% measurement |

Sources: [Phase 2 corpus](../../jitk/docs/results/scriptc-corpus-phase2.md), [growth account](../../jitk/docs/results/grow-phase2-2026-10-27.md), [stage 0](../../jitk/docs/results/scriptc-corpus-stage0.md). The read-only summaries, not private raw receipts, are the basis here. **U:** the brief's ~11% baseline was not supported by these specified comparable-denominator reports; it may refer to another checkpoint and needs its own citation.

## Claims we can and cannot make

### Recommended claim now

> **GrowOS is an experimental workflow for extending a small, hardware-isolated Linux-compatible guest kernel with LLM-proposed syscall handlers. Compatibility gaps observed in workloads guide bounded proposals, which are evaluated against real-Linux observations using visible and sealed probes, test-sensitivity controls and integration regression checks. We report the resulting compatibility gains and the incorrect implementations that finite acceptance checks still allowed.**

This wording describes the demonstrated project without claiming exclusive priority or universal correctness. Specify the gate version for each experiment; mention independent host assertions only for the profiles that actually ran them.

For the result sentence:

> **In the October 27 experiment, eight grown handlers, together with disclosed human changes, increased byte-identical Linux outcomes from 159 to 3,198 of 3,947 comparable scriptc-compiled programs (4.0% to 81.0%). The October 31 merge retained all 1,848 prior passes on the smaller comparable re-recorded subset.**

Include the stock-layout result and dominant `mmap` attribution nearby. “Eight grown handlers caused the entire improvement” would misattribute human changes and interactions.

### A cautious novelty sentence

> **Our contribution is a case study and acceptance methodology for workload-driven synthesis of Linux syscall compatibility in a small guest kernel, emphasizing proposer-independent Linux observations, reserved probes, and explicit measurement of acceptance failures. We found close precedents in agentic OS development and reference-checked systems synthesis, but no public demonstration of this exact combination in the sources surveyed through October 31, 2026.**

**I:** this is the maximum defensible priority language from this desk review. “To our knowledge” does not turn an insufficient search into proof. An unqualified first-of-kind claim should wait for author/artifact follow-up on the closest work and an independently timestamped GrowOS artifact.

### Already done elsewhere

| Proposed claim | Decision and reason |
|---|---|
| First LLM/agent-written OS, kernel, driver, or OS component | **Cannot claim.** Multiple directly relevant demonstrations and papers precede this result |
| First agent-created Linux-compatible kernel | **Cannot claim.** Ginux is a direct public comparator |
| First system that evolves OS functionality using agents and tests | **Cannot claim.** OSFoundry/SpecFS already cover the broad category |
| First generation loop checked against a real executable oracle | **Cannot claim.** Both classic synthesis and LLM systems translation precede it |
| First differential Linux syscall testing or Linux-as-specification approach | **Cannot claim.** gVisor/Starnix/syz-verifier establish the principle |
| First use of held-out tests, mutation controls, or protected evaluators for generated code | **Cannot claim.** These are established evaluation methods |
| First application-specialized small OS or one-program VM | **Cannot claim.** Unikernel/library-OS work already occupies this architecture |
| First measured exact GrowOS pipeline | **Unestablished.** Potentially distinctive, but narrow conjunction alone is weak research novelty |
| A useful measured kernel-growth case study with unusually explicit acceptance audits | **Can claim descriptively**, tied to released artifacts and measured gate versions |
| Fully autonomous OS development | **Cannot claim.** Human-owned substrate, helpers, probe design, generator fixes and inclusion decisions matter |
| Linux ABI equivalent / correct by construction / formally verified | **Cannot claim.** Finite observations and normalization do not imply refinement over all states |
| Secure because Rust + hardware VM + Linux-exact tests | **Cannot claim.** Functional parity, memory safety, privilege separation and containment require separate arguments |
| 81% of Linux applications, or full Node compatibility | **Cannot claim.** The population is the specified scriptc corpus and layout |
| Lower engineering cost than writing handlers manually | **Not yet established.** Needs a matched productivity baseline including all oracle/helper labor |

### What would turn the remaining distinction into a research contribution

**I:** the most promising result is not another successful generated handler. It is showing that independent Linux observations plus structurally held-out histories reject realistic overfits that simpler generation/test workflows accept, while reducing total compatibility-development effort. A coherent stateful capability would test the method more severely than scalar identity calls. Such a result could distinguish this work from OSFoundry's specification/review method and ordinary differential translation, even if no individual technique is new.

The negative results can themselves contribute: environment mismatch, normalization-induced blind spots, state omitted from generated probes, and a split that is secret but structurally redundant. Documenting those systematically would be more credible than claiming the existing gates make generated kernel code trustworthy in general.

## Evidence reviewers will demand

### 1. Priority and directly comparable artifacts

Publish a dated, immutable GrowOS release: kernel/controller commits, accepted source, prompt templates, allowed helper API, probe generators, gate definitions and reference-environment manifest. State when each component became public; a local commit date or merge date does not establish publication priority.

Compare explicitly with **OSFoundry, SysSpec, Ginux, LEMU, Cormack's formatter, FLOURINE and Reboot**. Obtain missing artifact/protocol details where possible. Do not equate different uses of “oracle,” “verification,” “kernel,” or “driver.” Exact source-access and held-out rules must be compared, not guessed from abstracts.

### 2. One acceptance ledger per historical experiment

List every target, attempt, model/version, token and time budget, public feedback, result stage, and final inclusion decision. Preserve failed builds, quota pauses, filtered proposals, timeouts, manual exclusions and invalidated profiles. Separate LIVE generation from replay, regrowth of an existing handler from entirely new behavior, and gate acceptance from promotion.

Publish the actual gate matrix for named profiles versus E3/Phase 2/path experiments. Tests that were added after a failure cannot be credited retroactively. Record human/agent-controller interventions and kernel primitives separately, including failed unsatisfiable profiles and revised observation rules.

### 3. A trustworthy, explicit Linux reference relation

Pin Linux release/build/config, architecture and page size, libc/compiler, binary hashes, uid/gid/capabilities, environment, fd types, cwd, filesystem bytes/topology/permissions, mounts, limits and reference launcher. A Docker digest alone does not pin Linux. Explain when a recorded result is authoritative and how live Linux reruns detect drift.

Specify every comparison: raw return/errno, output buffer bytes/fields, untouched memory, fd offsets, filesystem contents, signals, mappings and exit behavior. For random values, clocks, process identities and environment metadata, publish exactly what is normalized and why. Security properties such as entropy unpredictability require their own specification; write extent or varying bytes are insufficient.

Show that environment matching is substantive: root/non-root access checks, read-only permission/error precedence, mount-dependent `statfs`, guest capacity and filesystem-tree variants. Disclose remaining Desktop-only sealed recordings and their eventual Linux-host revalidation.

### 4. Separation and integrity of evaluator authority

Prove operationally which paths and tools the proposer, compiler and runtime can access. Test alternate token spellings/macros/attributes, imported helpers, compiler-time reads, build-script hooks, path traversal, stdout protocol spoofing and result-file tampering. Hash checks and token filtering are controls, not a proof of hermetic compilation.

Separate development probes used for iterative feedback from a **final reserved evaluation**. Even pass/fail hidden results leak information across retries and repeated experiments. Freeze splits before generation, prevent benchmark-specific prompt tuning against final tests, and retain exact access/feedback receipts.

### 5. Structurally independent state and environment coverage

Hold out operation histories and whole fixture families, not just alternative constants from one template. Required next examples include `chdir → relative open`, independently opened versus duplicated file offsets, unlink/rename with open handles, fd reuse, invalid-pointer/error precedence, partial unmaps and permission changes. Extend to signal/futex/thread histories only when those capabilities are claimed.

For concurrency, compare sets of allowed outcomes and invariants under controlled schedules rather than demanding one arbitrary Linux scheduling result. For scratch quotas or product restrictions, define the intended restricted contract instead of silently redefining Linux to equal a single host run.

### 6. Strong wrong implementations and gate ablations

Require known-plausible wrong candidates to compile and complete before counting a semantic rejection. Include unchanged cwd, copied shared offset, wrong directory error precedence, success without page-table protection changes, stale state after reset and weak randomness, as applicable. Constant `ENOSYS` and arbitrary negative returns are only smoke controls.

Measure gate precision/recall on independently constructed wrong handlers and valid alternatives. Ablate visible-only, held-out probes, independent host assertions, semantic mutants, filesystem matching, lint and integration separately. The question is how much each gate prevents **false acceptance**, not just whether its own canonical mutant fails.

### 7. Generalization and causal attribution

Finish an ELF-stable full-corpus reference recording and remeasure the exact merged artifact. Freeze a genuinely new workload distribution: independently compiled static tools, different runtimes/libcs where in scope, and workloads not used to choose targets. Report all denominators, unsupported prerequisites, exclusions and flaky results.

Run per-change/leave-one-out attribution, especially separating `mmap`, placement and human helpers. Correlated programs sharing one compiler runtime are useful workloads but are not independent samples of Linux ABI correctness. Report both program pass rates and semantic-family coverage.

### 8. Productivity and the role of the model

Use identical safe primitives and equivalent acceptance criteria for: expert manual implementation, ordinary coding-agent/test workflow, source-guided porting from a permissively licensed kernel where appropriate, and the GrowOS oracle workflow. Include all human time for helper design, contracts, probe generation, oracle calibration, debugging, review and requalification, plus model/compute costs and unsuccessful attempts.

Measure correct useful capabilities per total engineering hour, not handler LOC or model calls alone. Repeat across multiple targets/models and distinguish “discovers semantics from observations” from “recalls public Linux behavior.” Pretrained knowledge or copied semantic templates can be useful, but are not evidence of independent semantic discovery.

### 9. Integration, isolation and reproducibility

Qualify the actual final kernel/profile/backend/snapshot, not just host tests or a disposable console overlay. Check lifecycle/reset state, resource exhaustion, fault handling and EL0/EL1 permission enforcement separately. Console growth results do not automatically qualify the ring/native product path.

Release enough small artifacts for an independent lab to reproduce observations on a Linux reference host and the supported guest platform. This research intentionally performed none of those executions on the shared laptop. Source inspection supports a novelty assessment, not validation of the reported performance or security.

## Search coverage, sources and limitations

### Search method and stopping rule

Searches covered the requested 2023–2026 window, with older foundational work where it directly defeats a broad novelty claim. Query families included LLM/agent OS and kernel construction; Linux syscall/ABI/emulation generation; device-driver generation and maintenance; unikernel library porting; differential Linux/kernel/filesystem tests; executable-reference translation; held-out systems evaluation; and self-growing/on-demand systems. Venue-directed searches included arXiv, ACM, USENIX, OSDI, SOSP, EuroSys, ASPLOS and HotOS; FAST and software-engineering/verification venues yielded important closer matches.

Representative queries were `LLM operating system kernel synthesis Linux syscall differential testing`, `gVisor LLM syscall implementation`, `LLM Linux ABI emulation generated syscall`, `LLM device drivers generation`, `LLM kernel oracle`, and venue-qualified OS synthesis/code-generation searches. Follow-up searches used exact titles, checked primary publications/repos, and distinguished driver implementations from fuzz drivers and GPU kernels. Backward/adjacent searches from OSFoundry, SysSpec, OSVBench, KernelGPT and systems-translation results supplied further leads.

OSDI 2025/2026 program pages, SOSP 2026 poster material, the ASPLOS 2026 AgenticOS workshop site and relevant HotOS papers were used as venue checks. This is **not** a claim to have read every paper in every proceedings volume. Search engines, indexing delays, inaccessible artifacts, unpublished industrial work and non-English coverage constrain negative findings. The StarryOS Chinese account was read directly and summarized in English; this was not a systematic Chinese-language literature review.

Two close primary papers were available as full HTML (OSFoundry and SysSpec). LEMU's detailed publisher abstract/introduction/evaluation summary was readable, but its full gated implementation/artifact was not audited. Some GitHub pages had inconsistent cached/live views; no operating-status conclusion depends on a single old page. The Google validation blog had no readable body. Unverified hobby-project claims and secondhand writeups were discovery leads only. No talk video was watched; the Cormack interview transcript and conference paper/slide text were read.

### Primary sources

The following URLs support the comparisons above. Dates refer to publication/version metadata or explicitly dated first-party accounts; “current” means inspected at the cutoff. Moving source URLs should be pinned to commits for a publication artifact.

- **S01 / S01a — OSFoundry**, 2026 preprint: [full paper](https://arxiv.org/html/2609.25018v1), [record and displayed submission history](https://arxiv.org/abs/2609.25018). The date inconsistency is disclosed above; no venue acceptance inferred.
- **S02 — SysSpec/SpecFS**, December 2025 preprint / FAST 2026: [full paper](https://arxiv.org/html/2512.13047v1), [USENIX presentation record](https://www.usenix.org/conference/fast26/presentation/liu-qingyuan). USENIX record was discovered/read initially; later fetches timed out, so detailed claims use the paper.
- **S03–S03d — Ginux**, October 2026: [repository](https://github.com/gmkurtzer/ginux), [technical-report source](https://raw.githubusercontent.com/gmkurtzer/ginux/main/docs/paper/ginux-ai-systems-report.tex), [verification roadmap](https://raw.githubusercontent.com/gmkurtzer/ginux/main/docs/ROADMAP.md), [separate hardening track](https://raw.githubusercontent.com/gmkurtzer/ginux/main/docs/FEEDBACK-HARDENING-RESEARCH.md). Repository API tree sampled as `22d20a63544855148992e20d27d71c0e42f319d2`; this is a tree object, not the paper checkpoint commit. Report identifies checkpoint `d11c126a048a51fe7eb9c4105f31760add1027ea`.
- **S04–S04c — Cormack/Huntley**, October 10–11, 2026: [interview transcript](https://buttondown.com/justincormack/archive/unikernels-in-2026-part-1-geoffrey-huntley/), [Huntley post](https://ghuntley.com/unikernels/), [mkfs-xfs README](https://raw.githubusercontent.com/justincormack/mkfs-xfs/main/README.md), [comparison implementation](https://raw.githubusercontent.com/justincormack/mkfs-xfs/main/examples/compare_xfsprogs.rs).
- **S05 — LEMU**, Journal of Systems Architecture 177, August 2026, article 103870: [publisher article](https://www.sciencedirect.com/science/article/abs/pii/S1383762126001888), DOI `10.1016/j.sysarc.2026.103870`.
- **S06 — FLOURINE**, May 19, 2024: [arXiv record](https://arxiv.org/abs/2405.11514), [author-hosted paper](https://mengwangoxf.github.io/Papers/draft.pdf). The paper/abstract spells the tool FLOURINE; some secondary accounts use FLUORINE.
- **S07 — Reboot**, June 25, 2026: [Mostly Automatic Translation of Language Interpreters from C to Safe Rust](https://arxiv.org/abs/2606.27122).
- **S08 — Syzygy**, December 18/21, 2024: [record](https://arxiv.org/abs/2412.14234), [project paper](https://syzygy-project.github.io/assets/paper.pdf).
- **S09 — gVisor**, current: [syscall-test methodology](https://github.com/google/gvisor/blob/master/test/syscalls/README.md), [Linux support table](https://gvisor.dev/docs/user_guide/compatibility/linux/amd64/).
- **S10 / S10b — Starnix**, current: [test-writing guide, sampled revision](https://fuchsia.googlesource.com/fuchsia/+/86e8f56eb90dcb9d27091ea516e7bde1e0322f0e/docs/development/starnix/writing_and_running_starnix_tests.md), [Machina Linux cross-testing](https://fuchsia.dev/fuchsia-src/development/starnix/machina_runtime_for_linux_testing).
- **S11–S11c — Asterinas**, July 2025 and current: [ATC paper/presentation](https://www.usenix.org/conference/atc25/presentation/peng-yuke), [conformance source](https://github.com/asterinas/asterinas/tree/main/test/initramfs/src/conformance), [Vostd verification project](https://github.com/asterinas/vostd). Verification work is not attributed as Linux syscall synthesis.
- **S12–S12c — StarryOS/TGOSKits**, 2026: [June 27 account, edited October 11](https://rcore-os.cn/blog/2026/06/27/20260627-LetsWalkInLine-2026%E6%98%A5%E5%AD%A3%E8%AE%AD%E7%BB%83%E8%90%A5%E6%80%BB%E7%BB%93%E6%8A%A5%E5%91%8A%EF%BC%9A%E5%9B%B4%E7%BB%95-StarryOS-Linux-%E5%85%BC%E5%AE%B9%E6%80%A7%E7%9A%84%E8%8B%A5%E5%B9%B2%E4%BF%AE%E5%A4%8D%E4%B8%8E%E6%8E%A2%E7%B4%A2/), [PR #657](https://github.com/rcore-os/tgoskits/pull/657), [test architecture, updated October 26](https://rcore-os.cn/tgoskits/docs/architecture/fs/testing).
- **S13–S13c — syz-verifier**, 2021/current: [upstream documentation](https://github.com/google/syzkaller/blob/master/docs/syz_verifier.md), [Linux Plumbers 2021 slides](https://lpc.events/event/11/contributions/1033/attachments/742/1621/syz-verifier%20-%20Linux%20Plumbers%202021.pdf), [April 2025 broken-status issue](https://github.com/google/syzkaller/issues/5950). Current documentation text also inspected in a [Fuchsia upstream-source snapshot](https://fuchsia.googlesource.com/third_party/syzkaller/+/d3ecef46ced1151c0ce914035cba3ddcae10de42/docs/syz_verifier.md).
- **S14 — OSVBench**, April 29, 2025 / March 14, 2026: [arXiv paper](https://arxiv.org/html/2504.20964v1), [AAAI publication](https://ojs.aaai.org/index.php/AAAI/article/view/40437), [authors' code](https://github.com/lishangyu-hkust/OSVBench).
- **S15 — BODHI**, 2026: [primary record](https://arxiv.org/abs/2605.23931); date caveat above.
- **S16 — AUTODRIVER/DRIVEBENCH**, November 24, 2025: [LLM-Driven Kernel Evolution: Automating Driver Updates in Linux](https://arxiv.org/abs/2511.18924).
- **S17–S17c — DevGen / name collision**, 2026: [ACL paper](https://aclanthology.org/2026.acl-demo.24.pdf), [FSE record](https://doi.org/10.1145/3803437.3805564), [unrelated SECUTE AutoDriver fuzz-harness paper](https://conf.researchr.org/details/ase-2026/secute-2026-papers/2/AutoDriver-Purely-Source-based-Driver-Generation-for-Standard-Library-Fuzzing-Pipeli).
- **S18 — KernelGPT**, December 31, 2023 / ASPLOS 2025: [primary version history](https://arxiv.org/abs/2401.00563), [author-hosted ASPLOS paper](https://yangchenyuan.github.io/files/ASPLOS25-KernelGPT.pdf).
- **S19 / S19b — kernel repair**, 2025/2026: [CrashFixer](https://arxiv.org/abs/2504.20412), [Live-kBench](https://arxiv.org/abs/2602.02690), [authors' ICML paper](https://www.cs.columbia.edu/~kkaffes/papers/outrunning-llm-cutoffs-icml26.pdf).
- **S20 — DiffSpec**, October 5, 2024 preprint: [paper record](https://arxiv.org/abs/2410.04249).
- **S21 — Carlini compiler**, February 5, 2026: [first-party engineering report](https://www.anthropic.com/engineering/building-c-compiler).
- **S22 / S22b — translation equivalence**: [Intel IDEAS current README](https://raw.githubusercontent.com/IntelLabs/IDEAS/main/README.md), [RustAssure, October 2025](https://arxiv.org/abs/2510.07604).
- **S23 / S23b — Google compatibility rewrite**: [giflib-rs primary README](https://raw.githubusercontent.com/google/giflib-rs/main/README.md), [Scaling Memory Safety first-party blog](https://bughunters.google.com/blog/scaling-memory-safety). Blog-body metrics remain U here.
- **S24 / S24b — foundational synthesis**: [JitSynth, CAV 2020](https://link.springer.com/chapter/10.1007/978-3-030-53291-8_29), [authors' artifact](https://github.com/uw-unsat/jitsynth), [Jha et al., ICSE 2010 author page](https://people.eecs.berkeley.edu/~sseshia/pubs/b2hd-jha-icse10.html).
- **S25 — EvalPlus**, NeurIPS 2023: [publication](https://papers.neurips.cc/paper_files/paper/2023/hash/43e9d647ccd3e4b7b5baab53f0368686-Abstract-Conference.html).
- **S26 — SWE-Marathon**, June 2026, later revised public materials: [paper](https://www.swe-marathon.org/swe-marathon-paper.pdf), [project](https://www.swe-marathon.org/), [authors' repository](https://github.com/abundant-ai/swe-marathon). No inference that every current anti-cheating control existed in the initial release.
- **S27 / S27b — evaluator-driven generation**: [AlphaEvolve white paper, June 16, 2025](https://arxiv.org/abs/2506.13131), [Meta KernelEvolve, April 2, 2026](https://engineering.fb.com/2026/04/02/developer-tools/kernelevolve-how-metas-ranking-engineer-agent-optimizes-ai-infrastructure/).
- **S28 — LTP**, current: [Linux Test Project](https://github.com/linux-test-project/ltp).
- **S29 — older filesystem oracle testing**: [Groce et al., 2008 paper](https://agroce.github.io/cfv08.pdf). The paper itself, rather than search-engine crawl dates, establishes its historical status.
- **S30 — MachCSL/xv6**, September 3, 2026: [primary preprint](https://arxiv.org/abs/2609.04043).
- **S31–S31c — agent-written OS projects**: [Guha SlopOS](https://github.com/arjunguha/SlopOS), [SlopLabs/slopos](https://github.com/SlopLabs/slopos), [viralcode/vib-OS](https://github.com/viralcode/vib-OS). Do not conflate the two SlopOS repositories.
- **S32–S32c — agent-facing runtimes**: [Fable-OS](https://github.com/robiot/fable-os), [AIOS, March 2024](https://arxiv.org/abs/2403.16971), [Agent libOS, June 2026](https://arxiv.org/abs/2606.03895).
- **S33 / S33b / S33c — configuration generation**: [AutoOS ICML 2024 author repository](https://github.com/QiMeng-IPRC/AutoOS), [AutoOS paper](https://openreview.net/pdf?id=Rp8R9C0Sth), [AutoOS PMLR publication](https://proceedings.mlr.press/v235/chen24at.html), [BYOS, March 2025](https://arxiv.org/abs/2503.09663).
- **S34 / S34b — specialized OS background**: [Unikraft EuroSys 2021 paper](https://owl.eu.com/papers/unikraft-eurosys21.pdf), [Nanos kernel](https://github.com/nanovms/nanos).
- **S35 — venue checks**: [OSDI 2025 sessions](https://www.usenix.org/conference/osdi25/technical-sessions), [OSDI 2026 sessions](https://www.usenix.org/conference/osdi26/technical-sessions), [SOSP 2026 posters](https://sigops.org/s/conferences/sosp/2026/posters.html), [ASPLOS 2026 AgenticOS workshop](https://os-for-agent.github.io/asplos-2026.html), [HotOS 2025 learned-policy guardrails paper](https://sigops.org/s/conferences/hotos/2025/papers/hotos25-156.pdf), [HotOS 2025 Symphony paper](https://yecl.org/publications/gim2025hotos.pdf). These primarily concern learned policies, agent runtimes or AI-serving infrastructure, not the exact GrowOS pipeline.
- **S36 / S36b — historical driver synthesis**: [Automatic Device Driver Synthesis with Termite, SOSP 2009](https://cgi.cse.unsw.edu.au/~ikuz/publications/sosp.09.pdf), [Reverse Engineering of Binary Device Drivers with RevNIC, EuroSys 2010](https://www-new.llvm.org/pubs/2010-04-EUROSYS-RevNIC.pdf).

### Local context read

All requested context was inspected: [Grow README](../../jitk/grow/README.md), [Phase 2 corpus](../../jitk/docs/results/scriptc-corpus-phase2.md), [stage 0 merge](../../jitk/docs/results/scriptc-corpus-stage0.md), [oracle recordings](../../jitk/docs/results/oracle-recordings.md), [path experiment](../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md), [fit summary](../growos-fit/SUMMARY.md), [growth/oracle analysis](../growos-fit/03-GROWTH-METHOD-AND-ORACLES.md), [Node summary](../growos-node/SUMMARY.md), and [compatibility-kernel analysis](../growos-node/02-COMPAT-KERNELS.md). Additional current source reads covered `loop.ts`, `phase2.ts`, kernel README and the relocated Phase 2 growth report. Historical summaries were checked against current code where their observations could have become stale.

[S01]: https://arxiv.org/html/2609.25018v1
[S01a]: https://arxiv.org/abs/2609.25018
[S02]: https://arxiv.org/html/2512.13047v1
[S03]: https://github.com/gmkurtzer/ginux
[S03b]: https://raw.githubusercontent.com/gmkurtzer/ginux/main/docs/paper/ginux-ai-systems-report.tex
[S03c]: https://raw.githubusercontent.com/gmkurtzer/ginux/main/docs/ROADMAP.md
[S03d]: https://raw.githubusercontent.com/gmkurtzer/ginux/main/docs/FEEDBACK-HARDENING-RESEARCH.md
[S04]: https://buttondown.com/justincormack/archive/unikernels-in-2026-part-1-geoffrey-huntley/
[S04a]: https://ghuntley.com/unikernels/
[S04b]: https://raw.githubusercontent.com/justincormack/mkfs-xfs/main/README.md
[S04c]: https://raw.githubusercontent.com/justincormack/mkfs-xfs/main/examples/compare_xfsprogs.rs
[S05]: https://www.sciencedirect.com/science/article/abs/pii/S1383762126001888
[S06]: https://arxiv.org/abs/2405.11514
[S07]: https://arxiv.org/abs/2606.27122
[S08]: https://arxiv.org/abs/2412.14234
[S09]: https://github.com/google/gvisor/blob/master/test/syscalls/README.md
[S10]: https://fuchsia.googlesource.com/fuchsia/+/86e8f56eb90dcb9d27091ea516e7bde1e0322f0e/docs/development/starnix/writing_and_running_starnix_tests.md
[S10b]: https://fuchsia.dev/fuchsia-src/development/starnix/machina_runtime_for_linux_testing
[S11]: https://www.usenix.org/conference/atc25/presentation/peng-yuke
[S11b]: https://github.com/asterinas/asterinas/tree/main/test/initramfs/src/conformance
[S11c]: https://github.com/asterinas/vostd
[S12]: https://rcore-os.cn/blog/2026/06/27/20260627-LetsWalkInLine-2026%E6%98%A5%E5%AD%A3%E8%AE%AD%E7%BB%83%E8%90%A5%E6%80%BB%E7%BB%93%E6%8A%A5%E5%91%8A%EF%BC%9A%E5%9B%B4%E7%BB%95-StarryOS-Linux-%E5%85%BC%E5%AE%B9%E6%80%A7%E7%9A%84%E8%8B%A5%E5%B9%B2%E4%BF%AE%E5%A4%8D%E4%B8%8E%E6%8E%A2%E7%B4%A2/
[S12b]: https://github.com/rcore-os/tgoskits/pull/657
[S12c]: https://rcore-os.cn/tgoskits/docs/architecture/fs/testing
[S13]: https://github.com/google/syzkaller/blob/master/docs/syz_verifier.md
[S13b]: https://lpc.events/event/11/contributions/1033/attachments/742/1621/syz-verifier%20-%20Linux%20Plumbers%202021.pdf
[S13c]: https://github.com/google/syzkaller/issues/5950
[S14]: https://ojs.aaai.org/index.php/AAAI/article/view/40437
[S15]: https://arxiv.org/abs/2605.23931
[S16]: https://arxiv.org/abs/2511.18924
[S17]: https://aclanthology.org/2026.acl-demo.24.pdf
[S17b]: https://doi.org/10.1145/3803437.3805564
[S17c]: https://conf.researchr.org/details/ase-2026/secute-2026-papers/2/AutoDriver-Purely-Source-based-Driver-Generation-for-Standard-Library-Fuzzing-Pipeli
[S18]: https://arxiv.org/abs/2401.00563
[S19]: https://arxiv.org/abs/2504.20412
[S19b]: https://arxiv.org/abs/2602.02690
[S20]: https://arxiv.org/abs/2410.04249
[S21]: https://www.anthropic.com/engineering/building-c-compiler
[S22]: https://raw.githubusercontent.com/IntelLabs/IDEAS/main/README.md
[S22b]: https://arxiv.org/abs/2510.07604
[S23]: https://raw.githubusercontent.com/google/giflib-rs/main/README.md
[S23b]: https://bughunters.google.com/blog/scaling-memory-safety
[S24]: https://link.springer.com/chapter/10.1007/978-3-030-53291-8_29
[S24b]: https://people.eecs.berkeley.edu/~sseshia/pubs/b2hd-jha-icse10.html
[S25]: https://papers.neurips.cc/paper_files/paper/2023/hash/43e9d647ccd3e4b7b5baab53f0368686-Abstract-Conference.html
[S26]: https://www.swe-marathon.org/swe-marathon-paper.pdf
[S27]: https://arxiv.org/abs/2506.13131
[S27b]: https://engineering.fb.com/2026/04/02/developer-tools/kernelevolve-how-metas-ranking-engineer-agent-optimizes-ai-infrastructure/
[S28]: https://github.com/linux-test-project/ltp
[S29]: https://agroce.github.io/cfv08.pdf
[S30]: https://arxiv.org/abs/2609.04043
[S31]: https://github.com/arjunguha/SlopOS
[S31b]: https://github.com/SlopLabs/slopos
[S31c]: https://github.com/viralcode/vib-OS
[S32]: https://github.com/robiot/fable-os
[S32b]: https://arxiv.org/abs/2403.16971
[S32c]: https://arxiv.org/abs/2606.03895
[S33]: https://github.com/QiMeng-IPRC/AutoOS
[S33b]: https://arxiv.org/abs/2503.09663
[S33c]: https://proceedings.mlr.press/v235/chen24at.html
[S34]: https://owl.eu.com/papers/unikraft-eurosys21.pdf
[S34b]: https://github.com/nanovms/nanos
[S36]: https://cgi.cse.unsw.edu.au/~ikuz/publications/sosp.09.pdf
[S36b]: https://www-new.llvm.org/pubs/2010-04-EUROSYS-RevNIC.pdf
