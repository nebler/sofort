[← Catalogue index](README.md) · [Research summary](../RESEARCH-SUMMARY.md)

**90 entries.** Reports in this round:

- [01-systems: Systems whose economics might flip](#01-systems-systems-whose-economics-might-flip)
- [02-networks: Lens A: the networking, database, and distributed-systems graveyard](#02-networks-lens-a-the-networking-database-and-distributed-systems-graveyard)
- [03-scale-dist: Old distributed-systems ideas whose demand flipped](#03-scale-dist-old-distributed-systems-ideas-whose-demand-flipped)
- [04-broad: The graveyard outside OS/infra: which old ideas did agents actually un-kill?](#04-broad-the-graveyard-outside-osinfra-which-old-ideas-did-agents-actually-un-kill)
- [05-scale-code: Lens B — the software-production pipeline at agent scale](#05-scale-code-lens-b--the-software-production-pipeline-at-agent-scale)
- [06-giants: Giants — what the great computer scientists left unfinished, and what 2026 changes](#06-giants-giants--what-the-great-computer-scientists-left-unfinished-and-what-2026-changes)

---

## Round 6 — old ideas whose economics flipped — `flip/`
The round stopped looking for new technology-anchored ideas and asked two questions across all of computer science, calibrated on GrowOS (an old idea, unikernels, that died of manual labour and revives because agents absorb the long tail against an oracle). Lens A, the graveyard: which technically right ideas died of manual labour, long-tail effort or expert scarcity, and could flip now that code is nearly free and checking is cheap (strongest where an oracle exists)? Lens B, needed more than ever: which old ideas become more necessary at agent scale (10–100x more code, commits, CI runs, sandboxes, identities)? Six reports covered systems, networks/databases, distributed scale, the rest of CS, the code-production pipeline, and the "giants". Overall verdict: most ideas that died of labour and have a checkable oracle have already been revived by labs and big companies (mutation testing, property-based testing, API migrations, proofs, Fortran porting, rules-as-code, TLA+ agents, COBOL migration). Other famous corpses died of things agents don't fix (correlated failures, social causes, hardware), or a strong model makes them obsolete (Cyc, expert systems). Every report's bet was a narrow go-with-changes pilot: grown driver environments around unmodified Linux drivers (01), one application's missing database personality with the incumbent database as oracle (02), crash-safe collection of everything a run creates via leases/distributed GC (03), agent RLBox sandbox retrofits checked by a hostile-library oracle (04), and the Kay/STEPS shrink loop under a byte-identical substitution gate (06). The strongest finding was Lens B post-merge integration (05): land first, test trunk snapshots, find the culprit with flake-aware bisection, auto-revert with evidence. The pain is verified in primary sources (Anthropic 2,500 → 30,000+ merges/day; GitHub monthly commits 1.4B → 2.9B), the fix is old and proven (Google TAP), and no packaged product was found.

### 01-systems: Systems whose economics might flip
Desk research (no M results) across two lenses, A (labour-intensive systems ideas) and B (isolation and execution at agent scale). It looks at ten old systems ideas and records explicit rejections. Headline: cheap code generation does not make checking cheap. The scarce asset is an independent, non-vacuous acceptance oracle plus repeatable maintenance evidence. Dense agent sandboxes show the clearest demand flip, but that space is the most crowded. The ONE bet is a maintained driver-adapter grower: keep an existing Linux driver unchanged and grow the target-OS environment it needs, checked against independent behaviour across updates. Verdict: go-with-changes, i.e. a narrow two-week go/no-go pilot that must beat Genode/DDE on a held-out variant, with §2 proof maintenance as the fallback.

#### Grow the driver environment, keeping the mature driver (§1)
- **What:** Run an existing Linux device driver outside its original kernel. An agent grows the kernel-service adapter it expects (allocation, interrupts, scheduling, timers, locks), and the driver code itself does not change.
- **How it would work:** A missing-service fault leads the agent to propose an adapter implementation. The same frozen driver and external workload then run on Linux/QEMU (reference) and on the target. Packets/blocks/serial data, error outcomes, reset/cancellation and legal state transitions are compared, and unsupported calls fail instead of returning fake success.
- **Evidence / numbers:** F: Genode 21.08 retrospective: individual ports are expensive, updates are risky, and Linux+Genode expertise is rare. The i.MX8 graphics port took two months. F: AUTODRIVER: 235 validated corpus cases, 56.4% compilation success on 55 evaluated cases, boot checks narrower than functional correctness. F: Genode 26.08 updates ARM driver environments to Linux 6.18.19. I/E: 20 platform teams at €25k–€100k/year ≈ €0.5m–€2m/year. That is a small specialist business. Sources: [Genode 21.08](https://genode.org/documentation/release-notes/21.08), [AUTODRIVER](https://arxiv.org/abs/2511.18924), [Goel & Duchamp 1996](https://www.usenix.org/legacy/publications/library/proceedings/sd96/full_papers/goel.txt).
- **Prior art / who has it:** Goel & Duchamp (Linux-driver emulation in Mach, 1996); Genode DDE-Linux (already generates dummy functions/stubs); AUTODRIVER; LeVasseur et al. driver-in-VM (OSDI 2004) as the baseline to beat.
- **Verdict:** KEPT (#1, the ONE bet). It has the strongest direct evidence of a manual-labour bottleneck and sits right next to GrowOS. The ranking holds only if it beats Genode's existing methodology on a held-out driver/revision. Principal objection: Genode already automates the mechanical work, and the hard semantics may lack a strong oracle.
- **Kill test / first proof:** Two weeks on the PL031 RTC driver under QEMU (read/set time, alarm, cancellation, interrupts), then an upgrade to a held-out revision or variant. E: kill if more than two engineer-days of device-specific hand fixes are needed after the harness exists, if a stub conceals any held-out failure, or if existing DDE reuse is cheaper.

#### Driver-in-VM baseline (variant of §1)
- **What:** Keep the driver's entire original OS in an isolated VM instead of reimplementing its internal semantics.
- **How it would work:** The driver runs in an unmodified guest OS, and the new system talks to that VM. Nothing in the kernel API has to be reimplemented.
- **Evidence / numbers:** F: LeVasseur et al., [OSDI December 2004](https://www.usenix.org/events/osdi04/tech/full_papers/levasseur/levasseur.pdf).
- **Prior art / who has it:** LeVasseur and colleagues.
- **Verdict:** Treated as the baseline, not a bet. If a customer can afford it, the adapter must win on measured footprint, latency or assurance, because porting fewer lines is not automatically better.
- **Kill test / first proof:** None given separately.

#### Proof-maintained compatibility handlers and systems components (§2)
- **What:** Prove implementation refinement of small, explicit systems specifications (GrowOS leaf handlers) and maintain those proofs as the code changes. The aim is compatibility components whose behavioural regression evidence and immutable contracts survive each repair.
- **How it would work:** A minimised behavioural mismatch goes to an independent contract check. The agent repairs code and proof, followed by Linux differential tests, Verus invariants and bounded Kani harnesses, with mutation tests to catch vacuous contracts. Added assumptions, admitted lemmas, weakened preconditions and trusted-stub edits are disallowed without review.
- **Evidence / numbers:** F: seL4 took ~20 person-years and >200,000 Isabelle lines (another account: 12 py for the functional proof plus 12–13 py for tools). F: IronFleet ~3.7 person-years. F: AutoVerus >90% of 150 Rust tasks. F: VeriStruct 128/129 functions across 11 modules. F: KVerus 23 upstream-accepted Asterinas MM proofs, 51% repo-level success. F: Kani >16,000 harnesses per change. F: Hyperkernel verified 50 handlers in ~15 min on 8 cores. I/E: 10 customers at €50k–€150k/year ≈ €0.5m–€1.5m/year. Sources: [VeriStruct](https://arxiv.org/abs/2510.25015v4), [KVerus](https://arxiv.org/abs/2605.03822v2), [Hyperkernel](https://unsat.cs.washington.edu/papers/nelson-hyperkernel.pdf).
- **Prior art / who has it:** seL4, Hyperkernel, IronFleet, AutoVerus, VeriStruct, KVerus, Kani. "LLM writes Verus proofs" is already occupied.
- **Verdict:** KEPT (#2), and the fallback if the §1 bet fails. It has the strongest model-improvement tailwind and is the smallest security-relevant artifact one engineer could close. The value must come from independent contracts and maintained integration, not from proof generation alone.
- **Kill test / first proof:** Three GrowOS leaf components in pure Rust: descriptor-table transitions, range/permission checks, and bounded message/ABI decoding. E: requires ≥10 meaningful mutants rejected, no oracle edits, and a recorded cut in human repair time. Kill if contract review costs more than it saves, if the proof omits the changed state, or if a seeded violation passes.

#### ISA ports and instruction selectors grown against executable semantics (§3)
- **What:** An untrusted agent proposes compiler backend rules for a neglected target or ISA extension, and a trusted checker accepts each translation against formal machine semantics.
- **How it would work:** Independently supplied Sail/ASL semantics plus IR semantics check each selector's register/flag/memory effects, with Spike/QEMU differential execution on top. Kernel ports would need extra ABI, trap, page-table and atomic acceptance suites.
- **Evidence / numbers:** F: ARRIVAL verifies nearly all AArch64 selectors reachable from Wasm core and needs 2.6× fewer handwritten specs. F: ARM-TV found 46 previously unknown LLVM AArch64 backend bugs. F: Sail RISC-V model adopted by RISC-V International. F: CakeML backend uses 12 intermediate languages. I/E: 5–20 engagements at €25k–€100k ≈ €0.125m–€2m of project revenue. Sources: [ARRIVAL](https://cfallin.org/pubs/oopsla2025_arrival.pdf), [sail-riscv](https://github.com/riscv/sail-riscv), [VeriISLE](https://github.com/bytecodealliance/wasmtime/blob/main/cranelift/isle/veri/README.md).
- **Prior art / who has it:** CompCert, CakeML, ARRIVAL, ARM-TV, VeriISLE (in Cranelift), Sail, TableGen/ISLE generators.
- **Verdict:** KEPT (#3). Executable ISA semantics make an unusually good oracle. Objection: mainstream cases are already handled, so a buyer needs a real unsupported target, and kernel ports are a larger follow-on.
- **Kill test / first proof:** An agent adds 20 RV64 integer/bitmanip lowerings to a tiny Rust IR, checked against pinned Sail and Spike/QEMU, with signedness/zero-extension/shift cases held out. E: kill if 10 held-out rules need more than two engineer-days of spec glue, if checking dominates the two weeks, or if intrinsics already solve the problem.

#### Certified binary hot-region translation with a conservative fallback (§4)
- **What:** Generate checked translations of hot binary regions (e.g. x86 to AArch64) and fall back to an established translator or interpreter for anything unsupported.
- **How it would work:** The source machine execution is the reference. For straight-line integer regions, full architectural state and memory effects are compared by symbolic equivalence plus randomised execution. Signals, syscalls, self-modifying code, FP and concurrency stay on the existing DBT.
- **Evidence / numbers:** F: Guaranteed Guess (LLM x86→ARM/RISC-V) reports ~99% correct on HumanEval but 49% on BringUpBench, and 1.73× vs Rosetta 2 on its workloads. F: Box64 0.3.8 adds persistent translated-code caching. I/E: 3–10 projects at €50k–€200k ≈ €0.15m–€2m of project revenue. Sources: [Guaranteed Guess](https://arxiv.org/abs/2506.14606), [Box64](https://box86.org/2025/10/new-box64-v0-3-8-released/), [Dynamo PLDI 2000](https://www.cse.iitm.ac.in/~krishna/courses/2022/odd-cs6013/BalaDusterwaldBanerjiaPLDI2000.pdf).
- **Prior art / who has it:** Dynamo, Transmeta Code Morphing, Rosetta, QEMU, Box64, DynamoRIO, Guaranteed Guess.
- **Verdict:** RUNNER-UP (#6 of 10). Technically attractive but commercially narrow, and licensing, recompilation or existing emulation can erase the opportunity.
- **Kill test / first proof:** Ten pure x86 integer leaf routines to AArch64, with end-to-end time measured including dispatch. E: kill if no material workload remains after exclusions, if a baseline compiler matches it, or if total runtime improves by less than 10% at an amortisable cost.

#### Superoptimisation and synthesised compiler rewrites (§5)
- **What:** Use model proposals in place of enumerative search to find shorter or faster equivalent instruction sequences or compiler rewrites.
- **How it would work:** An LLVM IR extraction queue feeds agent proposals, Alive2 accepts or rejects them, and hardware benchmarks measure them. Instruction count is never the sole performance oracle.
- **Evidence / numbers:** F: Souper produced a 4.4% smaller Clang binary. F: Iago (LLM replacement for Souper) found 7.4% fewer optimisations, but 35.7% of its finds were new. F: AlphaEvolve gave a 23% Gemini-kernel improvement and a 1% cut in total training time. I/E: a 1% gain on €10m/year of compute ≈ €100k/year. Sources: [Massalin 1987](https://www.brinckerhoff.org/clements/2214-csc530/Files/massalin-1987.pdf), [Souper](https://research.google/pubs/souper-a-synthesizing-superoptimizer/), [AlphaEvolve](https://cloud.google.com/blog/products/ai-machine-learning/alphaevolve-on-google-cloud/).
- **Prior art / who has it:** Massalin, Souper, Iago, AlphaEvolve, Alive2, LLVM/MSVC.
- **Verdict:** KILLED as a generic standalone product (#9). Iago and AlphaEvolve occupy the proposal/test/keep loop, and LLVM will absorb the rules. It survives only as a customer-specific target with genuinely missing semantics or deployment integration.
- **Kill test / first proof:** 20 real hot leaf functions. E: at least three useful accepted rewrites and positive one-year savings after search and integration costs.

#### Partial evaluation and workload-specific whole-program specialisation (§6)
- **What:** Specialise interpreters or programs for stable, known inputs (configs, DSL programs) into a guarded fast path. Agents supply annotations, extract stable configuration and repair residual-program mismatches.
- **How it would work:** The original interpreter and the residual program run differentially on identical inputs, clock, FS, network transcript and config. Guards enforce the specialised assumptions, and a semantically complete fallback handles everything else.
- **Evidence / numbers:** F: weval reports 2.17× for SpiderMonkey and 1.84× for Lua vs their interpreters (not vs their JITs). I/E: a €2m/year workload with a net 10% saving ≈ €200k/year. E: target a net 20% beyond constant propagation/LTO/PGO, plus a break-even run count. Sources: [weval PLDI 2025](https://c1f.net/pubs/pldi2025_weval.pdf), [Futamura 1971](https://fi.ftmr.info/PE-Museum/PE-Original-English1971.pdf), [Mix retrospective](https://pure.itu.dk/ws/portalfiles/portal/102597804/mix-history-20231218T0709.pdf).
- **Prior art / who has it:** Futamura, Jones/Gomard/Sestoft (Mix), weval + Wizer (Bytecode Alliance), Truffle, PGO, JITs, database query compilation.
- **Verdict:** RUNNER-UP (#4), conditional on a real repeated customer workload. Use existing compiler machinery. It could be useful infrastructure without being a company.
- **Kill test / first proof:** A Rust bytecode interpreter for a policy DSL, or weval on a supported interpreter, with one frozen program/config tested on held-out inputs and injected config changes. Kill if a baseline equals it, if assumptions can't be guarded, or if the workload changes before amortisation.

#### Capability microkernels with generated service wiring and compatibility adapters (§7)
- **What:** Agents generate RPC adapter glue and authority configurations for small appliances on existing capability microkernel frameworks. This is a framework extension, not a new desktop OS.
- **How it would work:** capDL or system descriptions expose the initial capabilities, static graph checks reject unwanted paths, and integration tests check that permitted operations work and others are denied, all against an independently frozen policy.
- **Evidence / numbers:** F: Microkit 2.1.0 (Nov 2025) added x86-64, capDL init and multicore. F: LionsOS says driver/component verification is incomplete. I: no sourced number shows demand for another microkernel vendor. I/E: 5 engagements at €50k–€200k ≈ €0.25m–€1m. Sources: [Microkit 2.1.0](https://docs.sel4.systems/releases/microkit/2.1.0), [LionsOS](https://lionsos.org/), [Liedtke 1995](https://os.itec.kit.edu/deutsch/65_1029.php).
- **Prior art / who has it:** Liedtke/L4, EROS/KeyKOS, seL4 Microkit, LionsOS, Genode, existing binding generators.
- **Verdict:** RUNNER-UP (#7). Kill it as a standalone product if the work is mostly templating or apps need broad Linux authority. Keep it as a possible frontend to existing frameworks.
- **Kill test / first proof:** A Microkit/QEMU example with parser, storage and untrusted client, where a malicious client fails to get storage authority. E: two held-out service APIs with less than one engineer-day of hand glue each.

#### Dense, forkable, stateful execution: VM fork and library-OS economics (§8)
- **What:** Clone initialised execution state (VM fork, snapshots, library OS) cheaply instead of booting per task, for millions of agent sandboxes.
- **How it would work:** Cold-boot and cloned runs are compared under a controlled clock/entropy/network. Tests cover branch divergence, parent termination, crash/restart, OOM and dirty-page isolation. One unsolved mechanism (e.g. workload-aware idle-page reclamation) gets a prototype.
- **Evidence / numbers:** F: DeepSeek DSec: ~160-node units, 3M sandboxes/day, >380,000 concurrent, >5,000 creations/s, up to 800 microVMs or 3,200 containers per node (heterogeneous backends). F: Drawbridge library OS ~16 MB working set. F: the Firecracker 5 MiB figure is VMM overhead only. I/E: 100,000 sandboxes × 50 MiB ≈ 4.8 TiB. A 10% cut on €5m/year ≈ €500k/year. Sources: [DSec](https://arxiv.org/html/2609.22978v1), [SnowFlock](https://www.scs.stanford.edu/~rumble/papers/LagarCavillaEurosys09.pdf), [E2B runtime](https://github.com/e2b-dev/runtime).
- **Prior art / who has it:** SnowFlock, Drawbridge (archived), Exokernel, Firecracker, E2B, DSec, Microsandbox, Modal (VM and gVisor runtimes), Unikraft.
- **Verdict:** KILLED as a new entry point (#10). It has the strongest demonstrated demand flip but the most occupied product space, and a generic fast-sandbox API is disqualified.
- **Kill test / first proof:** On a dedicated KVM host, compare cold boot, Firecracker snapshot restore and E2B for three prepared images (p50/p99, touched memory, dirty pages, errors). E: kill unless it beats the strongest baseline by ≥25% on cost per accepted task at comparable isolation and latency, or solves an unmet compatibility constraint.

#### Proof-carrying generated plugins and software isolation in one process (§9)
- **What:** Agent-generated plugins carry a checkable certificate that they satisfy a narrow host policy, e.g. output fields come only from permitted inputs and stay within size bounds. This goes beyond memory isolation.
- **How it would work:** A Rust host accepts programs in a loop-free plugin DSL with explicit host capabilities. A minimal checker validates the certificate, and the checked DSL is interpreted to avoid a false binary-PCC claim. Runtime fuel and host-call permissions remain as enforcement.
- **Evidence / numbers:** F: on 9 Apr 2026 Wasmtime published 12 advisories, 11 found with LLM tooling, 2 Critical. I/E: a 10 ms process boundary × 100m/day ≈ 278 wall-clock-equivalent hours/day. 5 customers at €20k–€100k/year ≈ €0.1m–€0.5m/year. Sources: [Wasmtime advisories](https://bytecodealliance.org/articles/wasmtime-security-advisories), [Wassette](https://opensource.microsoft.com/blog/2025/08/06/introducing-wassette-webassembly-based-tools-for-ai-agents/), [Necula POPL 1997](https://homes.cs.washington.edu/~mernst/teaching/6.893/readings/necula-popl97.pdf).
- **Prior art / who has it:** Wahbe et al. SFI, Necula PCC, Singularity, Microsoft Wassette, Akamai Agent Sandbox, Wasm/Wasmtime.
- **Verdict:** RUNNER-UP (#8). Restrict the policy before expanding the language. "Wasm tools for agents" is occupied. Kill if the extra property has no buyer, the DSL is too restrictive, or a simple type checker does the same.
- **Kill test / first proof:** E: synthesise 20 held-out tasks and reject 10 policy-violating mutants, compared against a Wasmtime implementation of the same policy.

#### Firmware rehosting and peripheral models grown from failures (§10)
- **What:** Agents infer missing peripheral models so embedded firmware runs in emulation. The narrowed version is a fidelity-tested model for a specific device family rather than "it boots."
- **How it would work:** A blocked MMIO/HAL call leads the agent to propose behaviour, which is compared against an independently stimulated reference (physical board traces, vendor simulator or RTL) using held-out fault/error stimuli.
- **Evidence / numbers:** F: P²IM ran 79% of 70 firmware without manual help. F: DevGen produced usable QEMU models for 44/50 PCI/PCIe drivers. F: FirmCure reports 90.5% service interactivity across 21 images and 5 architectures. F: FirmPilot raised web reachability from 25.49% to 52.39% vs FirmAE. I/E: 10 contracts at €20k–€100k/year ≈ €0.2m–€1m/year. Sources: [DevGen](https://aclanthology.org/2026.acl-demo.24/), [FirmPilot](https://arxiv.org/abs/2607.14903), [HALucinator](https://www.usenix.org/system/files/sec20summer_clements_prepub.pdf).
- **Prior art / who has it:** HALucinator, P²IM, Fuzzware, DevGen, FirmCure, FirmPilot, FirmAE.
- **Verdict:** RUNNER-UP (#5), conditional on an independent reference. The generic version is already revived and the oracle is weak without hardware.
- **Kill test / first proof:** Open-source MCU firmware with one peripheral (UART/SPI) removed from a second emulator, tested on held-out init/timeout/interrupt scenarios against the untouched reference. E: kill if under 90% of a predeclared held-out suite matches, if no independent reference exists, or if HAL-level emulation already satisfies the tests.

#### Termite-style spec-based driver synthesis, revived wholesale (discussed under the ONE bet)
- **What:** Generate driver C from combined OS and device specifications.
- **How it would work:** OS-interface and device-protocol specs are synthesised into a driver, as in the original push-button design. Termite-2 moved to user-guided synthesis.
- **Evidence / numbers:** F: Termite-2 reported that the older output's structure, maintainability and synthesis scalability blocked adoption. F: Pancake verifies a practical Ethernet driver at ~3 person-months for verification after manual transcription. Sources: [Termite SOSP 2009](https://ryzhyk.net/publications/Ryzhyk_CKSH_09.pdf), [Termite-2 OSDI 2014](https://www.usenix.org/system/files/conference/osdi14/osdi14-paper-ryzhyk.pdf), [Pancake 2025](https://trustworthy.systems/publications/papers/Zhao_LTUTSTASSSMNH_25.pdf).
- **Prior art / who has it:** Termite, Termite-2, Pancake/CakeML.
- **Verdict:** KILLED as a wholesale revival. Reusing mature drivers reduces the need to reconstruct every device protocol, and these projects kill the claim that "nobody does verified driver construction." Their semantics and tooling can still be used where appropriate.
- **Kill test / first proof:** None given.

#### Rejected in this report
- **A new general-purpose unikernel** — GrowOS already occupies this; another one adds little without a distinct driver, port or verification wedge.
- **A wholesale exokernel replacement for Linux** — deployment and ecosystem migration remain; the library-OS/density subset is evaluated in §8.
- **"Microkernels were inherently slow, now AI fixes them"** — Liedtke rejected the inherent-slowdown premise in 1995; the real question is ecosystem integration and authority.
- **Resurrect KeyKOS/EROS/Coyotos as a complete OS** — no 2024–2026 evidence that agents solve the full compatibility, persistence and deployment package; §7 keeps only bounded assembly.
- **Orthogonal persistence as ordinary agent checkpointing** — EROS's single-level store did not restore external-service effects, and VM snapshots already cover local state.
- **Opal-style single address space as the new sandbox** — shared addresses alone are not the isolation mechanism, and no labour-cost flip was established.
- **Singularity as a drop-in Linux alternative** — its closed-code/ownership assumptions are central, and arbitrary native packages don't gain those properties from cheap porting.
- **Plan 9 as an "agent OS"** — namespaces fit, but no specific buyer or acceptance oracle separates it from Linux namespace/tool adapters.
- **Another CompCert/CakeML from scratch** — verified compilers and support businesses already exist; extend target coverage instead.
- **Generic superoptimisation agent** — Iago and AlphaEvolve occupy it; keep only a neglected target/workload (§5).
- **Universal partial evaluator** — weval and JIT/PGO cover the important cases; a stable workload and amortisation calculation must come first (§6).
- **Universal binary-to-binary recompilation** — DBT is alive and test-checked LLM transpilation exists; keep only checkable hot regions or a specific legacy target (§4).
- **Another fast agent-sandbox cloud** — mature snapshot runtimes and production-scale DSec make cold-start alone inadequate (§8).
- **"Proof-carrying" plugins that merely pass tests or carry signatures** — that is not Necula's proof of a host-defined policy; Wasm runtimes are the baseline (§9).
- **Autonomous firmware boot repair** — FirmCure and FirmPilot occupy it; independent behavioural fidelity is the remaining question (§10).
- **Arbitrary device-driver synthesis from datasheets** — Termite/Pancake already identify the specification problem; undocumented hardware, timing, DMA and errors mean source generation isn't the whole cost.

### 02-networks: Lens A: the networking, database, and distributed-systems graveyard
Desk research (no M claims) across networking, servers, distributed systems, databases, storage and compatibility-led legacy migration, asking which old ideas were killed by manual labour that agents now make cheap. Headline: the useful graveyard is the long tail of compatibility, not old systems that sound interesting. Active networks lacked a use case, and AutoAdmin, LSMs, interop automation and S3 compatibility mostly succeeded rather than died. 2025–2026 prior art already covers agentic protocol verification, TLA+ modelling, storage tuning and COBOL equivalence testing. The ONE bet is to grow one application's missing database personality (SQL Server→PostgreSQL/Babelfish), using the incumbent database as an executable oracle. Verdict: **go-with-changes**, a conditional bet that requires endpoint access, a blocked paying sponsor, and a win over DMS/Babelfish plus an ordinary coding agent.

#### 1. Active networks (operator-controlled functions vs. packet-carried capsules)
- **What:** Revive Tennenhouse and Wetherall's 1996 user-injected computation in network nodes, including packets that carry executable capsules.
- **How it would work:** Agents cheaply implement bounded middlebox functions plus their tests, checked by mirroring packet inputs against an existing proxy or firewall and comparing outputs and state effects.
- **Evidence / numbers:** F: the 2019 Wetherall/Tennenhouse retrospective blames stalled adoption on the lack of a driving use case, not on coding cost. F: the P4 consortium's February 2026 review lists Cisco, Oxide and Xsight joining in 2025, which shows operator programmability is active but is not evidence of capsule demand. No sourced 2024–2026 labour or adoption number supports a revival. E: $25k/year per managed application-specific network function × 40 deployments = $1m/year beachhead. [Towards an Active Network Architecture, 1996](https://people.eecs.berkeley.edu/~sylvia/papers/active.pdf), [retrospective 2019](https://ccronline.sigcomm.org/wp-content/uploads/2019/10/acmdl19-340.pdf), [P4 review Feb 2026](https://p4.org/2025-at-a-glance/).
- **Prior art / who has it:** P4 and its control interface, plus PlanetLab, SDN and the P4 lineage. Calling this "agent-built active networks" would mostly rename an existing market.
- **Verdict:** KILLED. Rejected as a standalone revival and ranked last of 12. It does not solve trust, ownership or the missing use case, and the bounded replacement collapses into #2 or #10.
- **Kill test / first proof:** Over two weeks, an agent implements a preexisting packet transformation in a local Rust or Wasm processor and is checked by differential replay, resource limits and held-out malformed packets against a conventional proxy plugin. Kill if the benefit needs network-wide adoption or an existing plugin is equally cheap. Expert killer: "an ordinary programmable middlebox; capsules add nothing."

#### 2. P4 and programmable dataplanes (target porting)
- **What:** Use agents to port stateful dataplane functions between P4 targets, covering the expert-scarce target-specific work rather than generic English→P4 generation.
- **How it would work:** An agent loop absorbs compiler diagnostics and target-porting work. It is checked against existing forwarding behaviour plus independent packet and state traces, P4Testgen semantics, and compiler/resource reports.
- **Evidence / numbers:** F: P4Testgen (SIGCOMM 2023) modelled V1model, eBPF, PNA and Tofino, with effort scaling with target complexity. F: a November 2025 paper already generates P4 with fine-tuned LLMs and released a 50-test benchmark. F: Intel stopped granting open-p4studio real-board software access on January 1, 2026. E: $50k–200k per port; 20 ports/year at $100k = $2m services beachhead. No TAM was sourced. [P4Testgen](https://natefoster.org/papers/p4testgen.pdf), [Dumitru et al. 2025](https://www.sciencedirect.com/science/article/pii/S1389128625006759), [open-p4studio](https://github.com/p4lang/open-p4studio).
- **Prior art / who has it:** P4Testgen, the 2025 LLM P4 paper, open-p4studio, P4-Spectec, and P4Runtime 1.5.0. Generic generation is already occupied.
- **Verdict:** NARROWED. A useful niche with hardware-heavy sales, 4th overall (first in the "remaining order"). BMv2 agreement does not prove ASIC timing, line rate or target fit.
- **Kill test / first proof:** Port an existing stateful ACL or telemetry function between two software targets, using a frozen Rust reference and generated PTF tests, with no hardware claim. Kill if it saves under 50% of expert time against existing templates, or if no buyer supplies a supported target.

#### 3. User-space network stacks (socket compatibility closure)
- **What:** Use agents to port applications onto kernel-bypass stacks and fill in missing socket and API behaviour, starting from an existing stack rather than a new TCP core.
- **How it would work:** A Rust socket-call trace harness, checked against Linux/FreeBSD, packetdrill scripts and independent TCP peers. Behaviour is compared through allowed behaviours, not byte-identical captures.
- **Evidence / numbers:** F: mTCP in 2014 reported up to 25× more small transactions than Linux (historical result). F: a 2026 IEICE edge study measured 3.09× throughput and 62% lower p99 for one DPDK/Seastar memcached condition versus POSIX, which is workload-specific. E: a fleet with $1m/year network-bound CPU could pay $20k–50k/year if savings exceed 15%; 30 × $30k = $0.9m/year. [mTCP](https://www.usenix.org/conference/nsdi14/technical-sessions/presentation/jeong), [IEICE 2026](https://globals.ieice.org/en_transactions/information/10.1587/transinf.2025EDP7023/_f), [Demikernel HotOS 2019](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/04/demikernel-hotos19.pdf).
- **Prior art / who has it:** F-Stack (FreeBSD over DPDK, v1.25 November 2025), Seastar's native and POSIX stacks, and Microsoft Demikernel (prototype).
- **Verdict:** NARROWED. A credible labour wedge but a difficult standalone company, 7th overall. A better model also makes reusing an existing stack easier.
- **Kill test / first proof:** One small server on an existing stack, where the agent repairs three API gaps, half the traces are reserved, and real peers are used. Kill if tuning or reusing F-Stack or Linux gets within 10% of the benefit with less effort. Expert killer: "you won by pinning idle cores or ignoring offloads."

#### 4. RFC to verified implementation (underserved protocol extension)
- **What:** Use an agent proof/interop loop to produce verified implementations of protocol pieces, aimed at a small neglected industrial protocol extension rather than generic verified TLS.
- **How it would work:** The agent writes code and contracts, a machine checks the proofs against reviewed contracts, and independent peer failures, official vectors and malformed-state tests drive repair.
- **Evidence / numbers:** F: Project Everest's 2025 retrospective reports deployed components but an incomplete miTLS-fstar handshake proof. A 2025 OpenSSL conference talk estimates many PhD-student-years per verified component. F: the July 2026 Ada/SPARK report discharged 49,280 obligations at about 20–40× lower supervision cost (author-reported). There, an SSH key-derivation defect passed the proofs but failed against OpenSSH. F: in PSMBench (NeurIPS 2025, 14 protocols), state F1 reached 0.82 but transition F1 at most 0.38. E: $30k–150k per verified extension; 20 × $75k = $1.5m/year. [Everest retrospective](https://project-everest.github.io/assets/everest-perspectives-2025.pdf), [The Prover Is the Judge](https://arxiv.org/html/2607.14340v1), [PSMBench](https://proceedings.neurips.cc/paper_files/paper/2025/hash/521bd9583b3a39e92f662ee57e81e5ce-Abstract-Datasets_and_Benchmarks_Track.html).
- **Prior art / who has it:** Everest/EverParse, Cryspen Bert13/Bertie with hax (CCS 2025), and the 2026 agentic SPARK work.
- **Verdict:** KEPT (#2). The strongest direct 2026 evidence that proof/interop loops cut expert supervision. Confidence is medium on the labour flip and low on generic novelty, and it is viable only with a paying maintainer.
- **Kill test / first proof:** Build one bounded binary parser or state transition from a specified RFC section in Rust with Verus or an existing toolchain. Contracts and vectors are frozen independently, an existing implementation serves as the peer, and negative and fragmented inputs are reserved. Kill if success needs a weakened contract, held-out peer failures remain, or an existing verified library already covers the need. Expert killer: "you proved a weak model, not the protocol."

#### 5. Protocol compatibility and interop testing (adapter/repair factory)
- **What:** Automate the human work around interop matrices: endpoint adapters, stateful scenarios, adjudicating differences, and turning a standards change into a reproduction and a candidate patch.
- **How it would work:** A runner launches several independent peers, asserts specific standards obligations, keeps the transcripts, and has an agent add adapters and minimise failures.
- **Evidence / numbers:** F: in 2022, TLS-Anvil found 15 interop issues among other defects across 13 implementations. F: the September 14, 2026 rustls advisory covers a TLS encryption-boundary issue that five other libraries rejected. F: the QUIC Interop Runner already supports QUIC and WebTransport. E: $10k–40k/year per SDK or protocol vendor; 100 × $20k = $2m/year. [TLS-Anvil](https://www.usenix.org/conference/usenixsecurity22/presentation/maehren), [rustls advisory](https://github.com/rustls/rustls/security/advisories/GHSA-2mjx-qc3c-rqvc), [QUIC Interop Runner](https://github.com/quic-interop/quic-interop-runner).
- **Prior art / who has it:** McKeeman differential testing (1998), packetdrill, QUIC Interop Runner, TLS-Anvil, Spec2Code (ASE 2025), the 2025 LLM RFC-update differential analysis, and Mokav.
- **Verdict:** NARROWED. A valuable component but a weaker independent bet, 6th overall. Majority voting does not settle blame.
- **Kill test / first proof:** Take one HTTP/2 or QUIC extension with three peers and a Rust/TypeScript native runner, and have the agent add one adapter and minimise failures against the upstream suites. Kill if there are no actionable cases beyond those suites, or if adapters need constant expert handholding. Expert killer: "existing CI plus a coding agent."

#### 6. Database personalities and wire compatibility (workload-specific personality closure)
- **What:** Grow the missing behavioural surface of an existing compatibility layer (e.g. Babelfish for SQL Server→PostgreSQL) for one named application, using the incumbent database as the executable oracle. Focus areas are errors, types, catalogs, casts, collations, session state and transaction/rollback behaviour.
- **How it would work:** Capture and replay identical snapshots and operation sequences on source and target, then compare typed values, SQLSTATE/vendor errors, update counts, catalog results, transaction outcomes and final state, using permitted histories for concurrency. The agent patches the layer, while the acceptance suite and comparator stay outside its write authority. The deliverable is a maintained behavioural envelope per application/version, with upstreamable fixes preferred over a private fork.
- **Evidence / numbers:** F: FreeTDS (1997) and the Babelfish proposal (December 2020). F: Babelfish 5.4.2 (July 20, 2026) fixed a TVP repeated-row bug, and 5.4.1 fixed skipped rows under concurrent UPDATE/OUTPUT. F: Doltgres reached 99% on SQL Logic Test on July 10, 2026, which is not 99% of PostgreSQL. F: AWS DMS generative schema conversion (December 2024) claims "up to 90%" schema conversion (vendor-reported). E: $10k–25k pilot, then $50k–150k per migration envelope; 50 × $75k = $3.75m/year, mostly services. [Babelfish release notes](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraPostgreSQLReleaseNotes/AuroraBabelfish.Updates.html), [Doltgres 99%](https://www.dolthub.com/blog/2026-07-10-doltgres-99-percent-sql-logic-tests/), [DMS launch](https://aws.amazon.com/about-aws/whats-new/2024/12/aws-dms-schema-conversion-generative-ai/).
- **Prior art / who has it:** Babelfish (AWS), Dolt/MySQL, Doltgres/PostgreSQL (which also runs the PostgreSQL regression suite), and AWS DMS generative schema conversion.
- **Verdict:** KEPT (#1). This is the ONE bet and the strongest bounded GrowOS analogue. Confidence is medium on technical fit and low-to-medium on an unoccupied business wedge, conditional on endpoint access and a blocked buyer.
- **Kill test / first proof:** The two-week protocol runs as follows. Days 1–3: the sponsor supplies dev endpoints and an app, the setup is frozen, and five blocked behaviours are identified (stop if access fails). Days 4–5: capture/replay and shrinking, with templates held out, and two budget-matched tracks (plain coding agent vs. structured loop). Days 6–10: three independent gaps are repaired. Days 11–14: unseen operations, rollback/session, typed results, and a mutation test of the comparator. Continue only if at least 3 real blockers close, holdout shows zero accepted state corruption, expert time drops by at least 50% including harness work, and the sponsor prefers a paid pilot. Also kill if fewer than 3 of 5 blockers are representable as stable differential tests. Expert killer: "DMS/Babelfish plus my tests and a normal agent save the same time."

#### 7. Learned/self-tuning databases and automatic indexing
- **What:** Use agents to run the monitor→diagnose→experiment→rollback loop for index and configuration tuning, a revival of AutoAdmin and learned optimizers such as Neo.
- **How it would work:** Candidates (e.g. from HypoPG or an advisor) are materialised on a representative clone and run on mixed reads and writes, with results checked for equivalence. Holdout is split by template and time, and build cost is included.
- **Evidence / numbers:** F: AutoAdmin shipped in SQL Server 7.0 (1998). F: a VLDB 2024 reproducibility study found PostgreSQL beating learned optimizers in almost all experiments. F: OtterTune died (2020–2024), cause not established. F: LLM4IA (CIKM 2025) shows 5–10% over the Extend advisor on TPC-H/DS. E: $1k/month for $3k/month savings × 100 accounts = $1.2m ARR, with provider-bundled features as the ceiling. [AutoAdmin](https://www.microsoft.com/en-us/research/project/autoadmin/), [Lehmann et al. VLDB 2024](https://digitalcollection.zhaw.ch/bitstream/11475/30586/3/2024_Lehmann-etal_Learned-query-optimizers_VLDB.pdf), [LLM4IA](https://xmudm.github.io/files/Lyu25LLM4IA.pdf).
- **Prior art / who has it:** Bao (2021), Google Kepler, Azure automatic tuning, Supabase index_advisor, LLM4IA, and conformal-prediction learned optimizers (VLDB 2025).
- **Verdict:** KILLED. Generic autonomous DBA rejected, 10th overall. AutoAdmin succeeded, and the performance oracle is noisy and costly.
- **Kill test / first proof:** On PostgreSQL, limited to indexes and a small hint/config space, compared against existing advisors and budget-matched search. Kill if existing advisors plus bounded search capture 80% of savings, or if the gains vanish after build/inference cost and distribution shift.

#### 8. Log-structured and workload-specialized storage
- **What:** An agent grows an index, codec or layout around one distinctive stable workload, a revival of LSM trees and Idreos's self-designing stores.
- **How it would work:** A Rust append-only store for a fixed TTL/log workload, checked against a logical reference (map, SQLite or RocksDB), with operation logs, permitted acknowledged-write prefixes, crash/restart tests and corruption detection.
- **Evidence / numbers:** F: ELMo-Tune-V2 (February 2025) reports up to about 14× YCSB over defaults but only 34%/26% end-to-end on NebulaGraph/Kvrocks. F: StorageXTuner (October 2025) adds an agentic loop across four engines. E: a vendor spending $2m/year on storage pays $50k–150k/year for at least 20% all-in savings; 20 × $100k = $2m/year. [ELMo-Tune-V2](https://arxiv.org/abs/2502.17606), [StorageXTuner](https://arxiv.org/abs/2510.25017), [RUM conjecture](https://research.ibm.com/publications/designing-access-methods-the-rum-conjecture).
- **Prior art / who has it:** Dostoevsky (2018), design continuums (CIDR 2019), ELMo-Tune-V2, StorageXTuner, and the RocksDB tuning guide.
- **Verdict:** NARROWED. Reserved for a distinctive workload, 5th overall. Generic agentic RocksDB tuning is rejected, because physics trade-offs and recovery/format obligations remain.
- **Kill test / first proof:** Over two weeks: crash-boundary simulation, held-out skew/expiry mixes, and a comparison with tuned RocksDB/SQLite including compaction, disk bytes and peak memory. Kill below a 2× resource-efficiency gain against the tuned baseline, or on any acknowledged-write-loss counterexample.

#### 9. Distributed-system verification (agentic TLA+/Jepsen)
- **What:** Use agents to extract TLA+ models and invariants from real systems, instrument code, validate traces and reproduce violations, cutting the months of expert specification work.
- **How it would work:** TLC with independently reviewed invariants, trace conformance, linearizability/serializability checkers and deterministic fault execution. The agent builds the model and trace adapter.
- **Evidence / numbers:** F: AWS (2015) reported seven teams finding value. F: Specula authors report 249 bugs across 48 systems, with runs of 1.43–9.86 h (preprint, not reproduced). F: Jepsen's October 16, 2026 release fixed a safety bug in its own checking dependency. F: Antithesis raised a $105m Series A (December 2025), with customers including Jane Street and MongoDB. E: $30k–100k/year per vendor; 50 × $60k = $3m/year. [Specula](https://arxiv.org/html/2607.25333v2), [AWS CACM 2015](https://www.amazon.science/publications/how-amazon-web-services-uses-formal-methods), [Antithesis announcement](https://tools.prnewswire.com/en-us/live/20823/release/20251203EN37581).
- **Prior art / who has it:** Specula (direct prior art for the whole concept), Antithesis, Jepsen, FoundationDB simulation, and AWS P.
- **Verdict:** KILLED. The generic autonomous TLA+/Jepsen product is rejected, 9th overall. "LLM writes TLA+" becomes a commodity, and the competition is unusually direct.
- **Kill test / first proof:** One small open-source lease/queue service with externally reviewed properties and seeded historical bugs, compared with Specula and a plain agent at equal cost. Kill if it needs invariant relaxation, cannot reproduce failures in unmodified code, or has no coverage advantage.

#### 10. Server specialization per application
- **What:** Agents build application-specific fast paths that strip unneeded generality from a server, a revival of the Synthesis kernel and MIT Cheetah/XIO.
- **How it would work:** Keep existing HTTP/TLS/auth libraries and specialise routing, serialization or a hot adapter in Rust. Check against the original server's responses, side effects, error paths and restart behaviour, not only successful requests.
- **Evidence / numbers:** F: Katana (2006) called writing OS extensions difficult. F: weval (PLDI 2025) reports 3–5× JS speedups over the generic interpreter, which is not a comparison with V8 JIT. F: Unikraft's Prisma story (December 2025) claims over 100k isolated DBs per server and images going from 280MB to 61MB (vendor-reported). E: a $5m/year compute host funds $100k/year for 10% savings; 10 customers = $1m/year. [Synthesis 1988](https://www.usenix.org/legacy/publications/compsystems/1988/win_pu.pdf), [weval PLDI 2025](https://c1f.net/pubs/pldi2025_weval.pdf), [Unikraft Prisma](https://unikraft.com/customer-stories/prisma-postgres).
- **Prior art / who has it:** weval/Bytecode Alliance, partial evaluation and JITs, and Unikraft.
- **Verdict:** NARROWED. A conditional technical niche with weak evidence of an economy-wide labour flip, 8th overall.
- **Kill test / first proof:** One stable CPU-bound service, compared against the original, PGO/LTO and specialization frameworks on held-out request/error sequences. Kill below 30% all-in CPU/memory savings, or if ordinary optimisation recovers 80% of the gain. Expert killer: "PGO or a serializer swap gets the same."

#### 11. Mainframe/COBOL/CICS migration (transaction equivalence and side-effect capture)
- **What:** A strangler-fig replacement of one transaction or batch slice, with the old system kept running as judge. The value is in capturing CICS/DB2/VSAM and external side effects, not in generating Java.
- **How it would work:** Capture transaction inputs, before/after DB and file state, commit/rollback boundaries, messages, return codes, decimal/encoding semantics and batch-order dependencies. The agent repairs the translated candidate against frozen outputs on unseen fixtures.
- **Evidence / numbers:** F: IBM FSE 2025 calls manual COBOL→Java validation labour-intensive and automates equivalence tests via symbolic execution. F: AWS (December 2025) says testing typically takes over 50% of modernisation duration (vendor claim). No 2026 full-system cost multiplier was found. E: $25k–100k per pilot, $100k–500k/year per pipeline; 20 × $150k = $3m/year. [IBM FSE 2025](https://research.ibm.com/publications/automated-testing-of-cobol-to-java-transformation), [AWS Transform testing](https://aws.amazon.com/about-aws/whats-new/2025/12/transform-mainframe-testing-automation/), [Strangler Fig](https://martinfowler.com/bliki/OriginalStranglerFigApplication.html).
- **Prior art / who has it:** IBM watsonx Code Assistant for Z (with the Z Validation Assistant), AWS Transform for mainframe, and IBM recorded integration tests.
- **Verdict:** KEPT (#3). Top-three economics, but crowded and access-constrained. Confidence is medium on value and low on a solo entrant's access and differentiation, and it risks becoming a consulting business.
- **Kill test / first proof:** Use an authorized captured transaction slice and a Rust fixture runner, comparing packed decimals, files, DB writes and rollback. A GnuCOBOL fixture tests mechanics only. Kill if real side effects cannot be captured by day 3, or if incumbent tools cover the transaction with comparable specialist time.

#### 12. S3 and API/SDK compatibility
- **What:** Agents close S3 compatibility gaps (headers, errors, SDK corner cases) in an existing store for one SDK-driven workload.
- **How it would work:** A native stateful comparator runs against an authorized AWS endpoint, pinned SDKs and the Ceph tests. It compares status/error codes, signing, pagination, multipart state, checksums, conditions and post-operation state, with variable fields normalised.
- **Evidence / numbers:** F: Cloudflare's R2 matrix (October 14, 2026) lists unsupported operations and checksum differences. Ceph s3-tests marks cases that fail on AWS itself. F: S3 at 20 years holds over 500 trillion objects at over 200m requests/sec (scale, not obtainable revenue). E: $20k–80k/year per store vendor; 30 × $40k = $1.2m/year. [R2 matrix](https://developers.cloudflare.com/r2/api/s3/api/), [ceph/s3-tests](https://github.com/ceph/s3-tests), [AWS S3 20 years](https://aws.amazon.com/blogs/aws/twenty-years-of-amazon-s3-and-building-whats-next/).
- **Prior art / who has it:** Eucalyptus Walrus (late 2000s), Ceph s3-tests, MinIO, Cloudflare R2, and SeaweedFS.
- **Verdict:** KILLED as another general S3-compatible store, 11th overall. It remains possible as a vendor feature, but durability engineering stays expensive.
- **Kill test / first proof:** One existing store and one SDK workload (multipart/checksum). Without an AWS endpoint the oracle is downgraded. Kill if mature stores already pass the workload, or if repair needs unproven durability/availability promises. Expert killer: "the gap was intentional or already covered by Ceph tests."

#### Rejected in this report
- **#1 Arbitrary active-network capsules:** no labour-only death and no convincing new deployment incentive, and operator-controlled successors already exist.
- **#2 Generic English→P4 generation:** direct 2025 prior art. Target porting stays interesting only with hardware/vendor access and a buyer.
- **#3 Fresh general-purpose user-space TCP:** mature reusable stacks and Linux are formidable, and polling, sharing and operations costs survive cheap code.
- **#4 Generic verified TLS generator:** Everest, Bert13 and the 2026 agentic SPARK work are direct prior art. Only a paid, unsupported extension is retained.
- **#5 Generic protocol interop dashboard:** existing runners already automate matrices. The residual work is adapter maintenance and actionable repair.
- **#6 Universal PostgreSQL/MySQL/SQL Server replacement:** the compatibility surface is too broad. Only application-scoped closure on an existing engine or layer is retained.
- **#7 Autonomous DBA/learned optimizer/automatic indexing:** AutoAdmin was not dead, current products and papers already automate much of it, and performance oracles remain costly and noisy.
- **#8 Generic agentic RocksDB tuner or bespoke engine for every app:** direct 2025 tuning prior art and recovery/format obligations. A structural advantage over a tuned engine is required.
- **#9 Generic autonomous TLA+/Jepsen service:** Specula already models, trace-checks and reproduces, and Antithesis and Jepsen already sell adjacent acceptance infrastructure.
- **#10 Per-app server rewrite without a measured hotspot:** compilers, PGO, serializers and specialised deployment can erase the benefit with much less maintenance.
- **#11 Generic COBOL→Java conversion:** IBM and AWS already offer transformation plus validation. Only a demonstrably missing transaction-evidence capability is retained.
- **#12 Another general S3-compatible store:** the compatibility ecosystem already exists, and a cheap frontend does not provide durable storage or operational differentiation.

### 03-scale-dist: Old distributed-systems ideas whose demand flipped
Lens B (distributed systems, infrastructure and data): ten classic techniques (fair queueing, leases/GC, capabilities, CAS, differential dataflow, sagas, provenance, DST, tail-at-scale, CRDTs) checked against established 2024–2026 scale (E2B monthly sandbox starts up ≥375×, Datadog rate-limit errors, 109:1 machine/human identities). Desk research only, so there are no M claims. Headline finding: most of these ideas never died. What changed is that small application teams now inherit specialist-scale workloads, and most revivals already have serious modern implementations. The ONE bet is a crash-safe run-resource collector with a fault-tested ownership contract, starting with machines plus snapshots across two provider contracts. Verdict: go-with-changes (narrow two-week proof, then a commercial kill gate of three operators with real lifecycle failures and at least $500/month in savings).

#### Admission control and fair queueing (root-task reservation across heterogeneous resources)
- **What:** A request must get capacity before it creates work. Reservations are keyed by tenant, root task, resource class, deadline and reservation, and they span model tokens, tool calls and sandbox lifetimes through child delegation.
- **How it would work:** A TypeScript gateway backed by PostgreSQL reservations carries a root budget through child jobs, with a bounded backlog and backoff. A serial ledger checks that admitted reservations never exceed capacity. A weighted-service oracle checks fairness, but only for declared costs and continuously backlogged tenants.
- **Evidence / numbers:** [F] Datadog: ~8.4M rate-limit errors in March 2026, ~one-third of LLM-call errors (60% in February). Counterweight [F]: 59% of agentic requests made only one service call. [F] E2B monthly starts went from 40k (Mar 2024) to >15M/month (2025), [I] ≥375×. [F] Anthropic: ~4× tokens for agents, 15× for multi-agent research (token multipliers, not worker counts). [E] Value: a 5% waste reduction on $100k–$1m/month spend is $5k–$50k/month, so a $1k–$5k/month integration could fit. [E] Stress workload: 100 people × 10 jobs × 10 children × 10 ops = 100,000 ops in a burst. Sources: [Datadog](https://www.datadoghq.com/state-of-ai-engineering/), [Inngest Constraint API](https://www.inngest.com/blog/announcing-the-constraint-api), [Temporal fairness GA](https://temporal.io/changelog/priority-fairness-generally-available).
- **Prior art / who has it:** Fair queueing (Demers/Keshav/Shenker 1989), SEDA (2001). Temporal priority/fairness GA (2026-05-05). Inngest concurrency/throttle/tenant keys/atomic capacity leases. Restate 1.8 virtual queues (2026-10-15). LiteLLM and Bifrost budgets and rate controls. SatGate.
- **Verdict:** KEPT (#2 of the ranked top three). It has the strongest immediate pain evidence, but the market is crowded and a new general-purpose queue is a poor wedge. Largest risk: ordinary configuration already solves it, or worst-case reservations waste too much capacity.
- **Kill test / first proof:** 100 tenants and 10,000 child jobs against two model-shaped mocks and one sandbox-shaped mock, crashing workers between acquire, start, settle and release. Targets: no over-admission, no starvation, and abandoned reservations recovered within two lease periods. Kill if Temporal plus LiteLLM meets the same invariants with ordinary configuration, or if reservation pessimism costs more throughput than it saves.

#### Leases and distributed garbage collection (run-scoped resource ownership and collection) — the ONE bet
- **What:** Make abandoned agent work collectible. One run-scoped ownership graph spans machines, snapshots, temporary credentials and external jobs, with crash-safe collection and explicit retention roots.
- **How it would work:** A controller durably records create intent and a stable provider identity before the external call. It ties resources to a run epoch, renews ownership leases, mediates every new create (fencing stale workers at the tool boundary) and preserves retention roots. It also reconciles ambiguous creates, retries idempotent cleanup, and reports unresolved obligations until provider inventory confirms deletion. A provider DELETE ack is not treated as proof of deletion. Where a provider cannot reconcile creation identity, the controller states the weaker guarantee instead.
- **Evidence / numbers:** [F] Inngest's 2026-10-08 sandbox beta leaves destroy-on-success and permanent-failure cleanup to application code. [F] background-agents issue #841 (2026-06-27) records hash-named base images accumulating across Modal, Vercel, Daytona and OpenComputer (framed as storage hygiene). [E] At 1M creations/day, 0.1% leaked is 1,000/day; at $0.05/hour that costs $1,500/month for one extra hour each, or $36,000/month for 24 hours (a sensitivity calculation, not measured leakage). [E] Value: $500–$3k/month starting with two providers plus snapshots. Sources: [Inngest beta](https://www.inngest.com/blog/sandboxes-are-a-durability-problem), [issue #841](https://github.com/ColeMurray/background-agents/issues/841), [E2B history](https://e2b.dev/about).
- **Prior art / who has it:** Gray–Cheriton leases (1989), Jini renewable leases (1999), Java RMI DGC. Kubernetes owner references, cascading deletion and finalizers. Cloud Custodian. Daytona auto-stop/archive/delete. Inngest durable sandbox steps. AgentCube idle/max-lifetime collection. [I] This is a composition opportunity, not a new GC algorithm.
- **Verdict:** KEPT (#1, the ONE bet). It combines real scale, a concrete open failure report, a strong bounded oracle and a feasible two-week proof. Largest risk: it is a small, easily internalized integration with too little budget or leakage pain behind it.
- **Kill test / first proof:** A Rust or TypeScript controller with PostgreSQL intent records against two local fake provider APIs, injecting lost replies, late creates, duplicate deletes, outages and old workers waking. Two-week plan [E]: days 1–3 protocol and contracts, 4–7 controller and crash recovery, 8–10 deterministic schedules and mutants, 11–14 comparison with TTL/finalizer approaches plus a demo. Requirements: zero erroneous deletion of retained fixtures, eventual collection, and rejection of old-epoch creates. Kill if a standard controller plus provider TTLs handles it with little custom logic, or if buyers find leaks immaterial. Commercial gate: three operators with concrete failures, else stop (possibly contribute upstream).

#### Capability delegation (attenuated authority for child agents)
- **What:** A parent delegates a smaller authority to a child, not a shared admin key. The authority is scoped to run, resource, action and lifetime. Spend is atomically reserved against a shared root ledger rather than copied into each token.
- **How it would work:** A TypeScript mediator around tools uses an existing macaroon implementation plus a transactional budget ledger. The oracle checks that the child's authority is a subset of the parent's, that expiry never expands, that revocation applies at the next governed access, and that children cannot double-spend.
- **Evidence / numbers:** [F] CyberArk: 82 machine identities per human (2025, n=2,600) and 109:1 (2026, n=2,900+). These are survey ratios that include all workloads. [E] Value: $20k–$100k/year for a specific high-value connector plus revocation evidence. Sources: [CyberArk 2025](https://insyte.amplifye.ai/amplifyai-website/assets/Cybersecurity-and-compliance/2025-Identity-Security-Landscape.pdf), [SatGate macaroons](https://cloud.satgate.io/docs/reference/macaroons), [Cap'n Web](https://blog.cloudflare.com/capnweb-javascript-rpc-library/).
- **Prior art / who has it:** Dennis–Van Horn (1966), SPKI (RFC 2693, 1999), Macaroons (2014). AWS AgentCore Identity (Aug 2025). Auth0 for AI Agents GA (Nov 2025). Microsoft Entra agent identities. Cloudflare Cap'n Web (Sep 2025). SatGate (macaroons, child budgets, MCP enforcement, cascade revocation).
- **Verdict:** NARROWED. Generic "macaroons for agents" fails the prior-art test because SatGate covers it. An interoperability/conformance adapter may survive, and integrating into an incumbent is more plausible than replacing enterprise identity.
- **Kill test / first proof:** The root grants "read project A, create ≤2 sandboxes, no deletes, expires in 10 min". Run 10,000 delegation/replay cases, kill and restart the issuer, and compare with SatGate at the contract level first. Kill if existing products satisfy the deployment boundary, or if leaked provider credentials can bypass the mediator.

#### Content addressing and deduplication (shared immutable inputs, private mutable work)
- **What:** Venti-style CAS for agent environments: a manifest, immutable chunks and a separate writable layer, so thousands of branches share one setup and keep only their diffs.
- **How it would work:** A Rust chunker with a local filesystem CAS and copy-on-write-style manifests. The oracle reconstructs from the manifest, verifies chunk hashes against a full copy, and compares test results between cold and cloned environments. Env vars, seeds, sockets, time and secrets need explicit snapshot semantics.
- **Evidence / numbers:** [E] A 2 GB base cloned for 10,000 jobs is 20 TB of transfer without sharing, versus 2 GB plus diffs in the ideal shared case. [E] 100,000 jobs/day each saving 10 s of one-vCPU setup is ≈278 vCPU-hours/day. [F] Foundation paper (2008): Venti's disk throughput economics did not suit consumers. Sources: [Venti FAST 2002](https://www.usenix.org/conference/fast-02/venti-new-approach-archival-data-storage), [Modal directory snapshots](https://modal.com/blog/product-updates-directory-snapshots-glm-5-billing-updates-and-more), [Modal GPU snapshots](https://modal.com/blog/gpu-mem-snapshots).
- **Prior art / who has it:** Venti, build systems, OCI layers and BuildKit. Modal disk snapshots (Jan 2025), directory snapshots (Feb/Mar 2026) and GPU memory snapshots (Jul 2025). Inngest snapshot-and-clone. E2B snapshot boot.
- **Verdict:** NARROWED. Use the primitive and reject a generic clone platform. The remaining hypothesis is portable, auditable artifact manifests with retention and dependency-aware collection across providers.
- **Kill test / first proof:** 1,000 logical branches of a small repo (artifacts <200 MB), mutated, reconstructed and compared to full copies, testing retention roots and failed uploads. No VM or Docker is needed. Kill if provider-native caches erase the benefit, or if secret isolation and portability require recreating the whole runtime.

#### Incremental and differential dataflow (maintained shared agent context)
- **What:** Incrementally maintain shared derived context (balances, inventory, permission-filtered context) so many agents reading the same business state don't each repeat the joins.
- **How it would work:** A versioned context DAG compiled onto an existing incremental engine. At each logical watermark, maintained views are compared to full batch SQL over the same snapshot (inserts, deletes, late events, restarts, schema changes). LLM summaries are versioned and recomputed rather than treated as algebraically incremental.
- **Evidence / numbers:** [F] Unity Catalog: >100M tables, 400k models, 75k workspaces, ~60k API req/s. [F] Materialize claims >1M updates/s and sub-second freshness, marketed for agents. [E] Value: a 30% cut on a $200k/year recompute bill is $60k/year, so $10k–$30k/year for the integration. [E] Target: 10× less recompute at 0.1% changes per cycle. Sources: [Differential Dataflow](https://www.microsoft.com/en-us/research/publication/differential-dataflow/), [Materialize agents](https://materialize.com/blog/ai-agents-need-digital-twins/), [Feldera docs](https://docs.feldera.com/).
- **Prior art / who has it:** Differential Dataflow (McSherry et al., 2013). Materialize (agent-ready views plus MCP). Feldera/DBSP.
- **Verdict:** NARROWED. The gap hypothesis is only a narrow integration layer atop Materialize/Feldera that proves deletion and permission invalidation against batch execution. A new engine is rejected.
- **Kill test / first proof:** A TypeScript CDC fixture generator plus an existing engine and a SQLite/DuckDB oracle over 100,000 rows, with 1,000 synthetic agents reading. Target exact watermark equality. Kill if indexes and batching come within 2× on cost/latency, or invalidation can't cover the outputs the buyer actually uses.

#### Durable journals, sagas and idempotent effects (provider-specific effect contracts)
- **What:** A retry must not become a second purchase. Narrow provider-specific effect contracts and conformance fixtures, with effect identity drawn from the approval/business operation rather than the model's tool-call ID.
- **How it would work:** A TypeScript journal on PostgreSQL against a fake refund provider in two modes: stable idempotency key, and no deduplication. Crash after every transition and deliberately replan with a fresh call ID. With a cooperative sink the system shows exactly one effect; without one it exposes an explicit unknown/reconcile state.
- **Evidence / numbers:** [F] Temporal: 130B monthly actions and 1,500+ paying customers (Aug 2024). [F] LangGraph Platform: ~400 production deployments (May 2025). [F] CapLease preprint (Aug 2026) studies semantic reissuance and shows effect protection needs an idempotent sink. [E] Value: avoiding a few duplicated $500 operations may justify a $1k/month connector. Sources: [DBOS guarantees](https://docs.dbos.dev/explanations/concurrent-executions), [Restate agents](https://restate.dev/blog/resilient-serverless-agents), [CapLease](https://arxiv.org/html/2608.01710v1).
- **Prior art / who has it:** Birrell–Nelson RPC (1984), Sagas (1987). Temporal, Restate, DBOS, LangGraph, Inngest.
- **Verdict:** NARROWED. Only provider-specific effect contracts remain, not another workflow engine. Universal exactly-once is rejected.
- **Kill test / first proof:** Lose the "refund succeeded" reply and restart every worker, then show either one refund or an unresolved state according to the sink contract. Kill if reliable business-operation IDs can't be established, or existing workflow/provider idempotency handles the case.

#### Provenance and lineage (versioned artifact lineage with permission/deletion invalidation)
- **What:** Artifact-level dependency tracking across source records, prompts, sandbox outputs and downstream actions. It answers which outputs must be rebuilt or hidden after a source version or permission changes.
- **How it would work:** A TypeScript artifact-manifest emitter plus a SQLite dependency index exporting PROV/OpenLineage-compatible relationships. Instrumented reads/writes capture mechanical dependencies, and conservative edges are labelled as such. Selective invalidation is compared with a full rebuild, and a hidden read is injected to show the oracle detects incomplete capture.
- **Evidence / numbers:** [F] OpenLineage's Aug 2026 explicit-lineage proposal: inputs × outputs implies false edges. [F] Unity Catalog documents lineage gaps (renames, rollback). [F] Anthropic MCP account: hundreds to thousands of tools across dozens of servers. [E] 1,000 runs × 10 artifacts = 10,000 dependency-bearing objects per batch. [E] Value: $10k–$50k/year if it cuts a recurring manual rebuild/incident process. Sources: [OpenLineage explicit lineage](https://openlineage.io/blog/explicit-lineage/), [Unity Catalog lineage](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage), [Provenance Semirings](https://www.cs.ucdavis.edu/~green/papers/pods07.pdf).
- **Prior art / who has it:** Provenance Semirings (2007), W3C PROV-DM (2013). OpenLineage, Unity Catalog. OpenTelemetry GenAI/agent conventions. Restate plus Langfuse.
- **Verdict:** KEPT (#3 of the ranked top three). It is more differentiated than another trace UI and has an oracle for deterministic captured pipelines. Largest risk: incomplete capture or uncontrolled downstream copies make the outcome unverifiable. It uses conservative semantics and rejects claims about hidden model reasoning.
- **Kill test / first proof:** Revoke one source document and show affected derivatives blocked, unrelated work untouched, and external copies reported. Kill if the valuable outputs lie outside controllable storage, or if conservative dependencies invalidate nearly everything.

#### Deterministic simulation testing (fault-contract suites for agent integration boundaries)
- **What:** Explore the failure schedules that generated systems will meet, using reusable fault-contract suites for a narrow agent integration boundary (e.g. provider creates plus workflow cancellation).
- **How it would work:** A Rust discrete-event simulator for a small lease/resource controller with injected clock, transport, store and provider models. It explores seeded schedules, shrinks failures, and uses mutants to prove the workload exercises the properties. The report prefers feeding a mature simulator over writing a hypervisor.
- **Evidence / numbers:** [F] Antithesis (Sep 2026): an agent mutation campaign of 19 mutations over 46 runs falsified 11 of 13 properties and found 3 upstream rqlite bugs. [F] Aiven: 2,200 logical hours of DST on Diskless Kafka (Mar 2026). [E] Value: $20k–$100k/year for a domain-specific suite. Target [E]: 10,000 seeded schedules and all 5 hand-written mutants killed. Sources: [FoundationDB paper](https://www.foundationdb.org/files/fdb-paper.pdf), [Antithesis mutation testing](https://antithesis.com/blog/2026/mutation-testing/), [Aiven](https://aiven.io/blog/deterministic-simulation-testing-in-diskless-apache-kafka).
- **Prior art / who has it:** FoundationDB simulator (talk 2014, paper 2021). Antithesis (deterministic hypervisor, agent skills, mutation testing).
- **Verdict:** NARROWED. Build it into the chosen bet and reject a generic testing platform. The most immediate value is internal verification for candidates 1 and 2.
- **Kill test / first proof:** A worker resumes after lease expiry and creates an orphan, then the exact seed is replayed after the fix. Kill the standalone product if a normal Antithesis harness solves the integration, or if provider models can't be validated against real contracts.

#### Tail-at-scale methods (whole-job deadlines, budget-aware hedging and cancellation)
- **What:** Optimize completion of the whole fan-out job under a cost budget rather than median call latency. This means application-wide deadline/cancellation propagation plus bounded delayed hedging.
- **How it would work:** A TypeScript fan-out harness over 100 mock read-only tools with correlated and independent delays, root deadlines, bounded delayed hedging and acknowledged cancellation. It compares no hedge, naive hedge and budget-aware hedge, including a saturated case where hedging must turn off. Non-idempotent effects are never hedged without the candidate-6 effect contract.
- **Evidence / numbers:** [F] Cloudflare: AI user-action crawling up >15× in 2025, versus 19% overall traffic growth. [E] With a 1% independent slow-call rate, P(at least one slow call) is 9.6% at 10 calls, 63.4% at 100 and 99.996% at 1,000. [F] DistServe: up to 7.4× capacity or 12.6× tighter SLO. [F] Splitwise: 2.35× throughput at fixed cost/power. [E] Target: ≥30% lower p99 with ≤10% extra paid work. Sources: [Tail at Scale](https://users.cs.utah.edu/~stutsman/cs6450/public/papers/tail-at-scale.pdf), [DistServe](https://arxiv.org/abs/2401.09670), [llm-d 1.0](https://cloud.google.com/blog/topics/ai-infrastructure/llm-d-1-0-an-open-source-stack-for-distributed-inference).
- **Prior art / who has it:** Dean–Barroso (2013). DistServe, Splitwise, llm-d 1.0 (2026-10-20: multi-tenant flow control, cache-aware routing, disaggregation).
- **Verdict:** NARROWED. A new distributed inference engine is heavily contested. Application-wide deadline/cancellation propagation remains only an integration hypothesis, and the 100× model effect is mixed.
- **Kill test / first proof:** 99 children finish and one stalls, which is then cancelled or hedged per the declared result contract while showing every attempt's cost. Kill if savings vanish under correlated load, answer quality falls, or real provider billing ignores cancellation.

#### CRDTs and local-first state (ephemeral-replica retirement for structured agent work products)
- **What:** Many disposable workers merge observations into a shared run document without a central lock. The narrow gap is ephemeral-replica retirement, bounded history and reviewed merges.
- **How it would work:** A TypeScript/Automerge investigation document with independently keyed findings, explicit review states and epoch-based replica retirement. The oracle reorders, duplicates, delays and partitions delivery to verify convergence, and tests application constraints separately.
- **Evidence / numbers:** [F] Automerge 3 (Jul 2025): >10× lower memory, with Moby Dick dropping from 700 MB to 1.3 MB (project benchmark). [F] Ericsson: 22.3B IoT connections at end-2025. [I] No primary measurement shows a 100× surge in concurrent CRDT editors. [E] Value: $5k–$25k/year for a narrow sync integration, with no standalone market evidence. Sources: [CRDT TR 2011](https://dsf.berkeley.edu/cs286/papers/crdt-tr2011.pdf), [local-first](https://www.inkandswitch.com/essay/local-first/), [Automerge 3](https://automerge.org/blog/automerge-3/).
- **Prior art / who has it:** Shapiro et al. CRDTs (2011), Ink & Switch local-first (2019), Automerge, Zed parallel agent threads (not CRDT-coordinated).
- **Verdict:** KILLED as the lead bet. Direct scale-breakage evidence is weakest here, convergence does not preserve program meaning, and the idea may lose value as worktrees and branches suffice.
- **Kill test / first proof:** 1,000 synthetic short-lived actors plus one late returner, compared against append-only events plus a central DB, and against branch merge. Targets: convergence, bounded metadata after retirement, and no silent acceptance of retired-writer edits. Kill if central append-only state or worktrees meet the offline/latency needs.

#### Rejected in this report
- **Generic fair agent queue** — Temporal, Restate and Inngest already occupy it. Only heterogeneous root-task reservations remain worth testing.
- **Macaroons/budget tokens for agents as a standalone invention** — SatGate directly covers the proposed revival, and durable consumption still needs a ledger.
- **Generic agent checkpoint/workflow platform** — Temporal, Restate, DBOS, LangGraph and Inngest already provide the central machinery.
- **Universal exactly-once tool calls** — unsupported without a cooperative sink or a reconcilable business identity. Journaling does not repair the external commit gap.
- **New sandbox snapshot/dedup cloud** — Modal, E2B and related runtimes are already rebuilding it. Portable retention is the narrower seam.
- **New streaming SQL/context engine** — Materialize and Feldera already implement the hard primitive. Use their engines and test a specific invalidation integration.
- **Generic agent observability/lineage graph** — existing tracing and catalogs are substantial. Only a testable invalidation outcome distinguishes the wedge.
- **Generic agent-driven deterministic testing platform** — Antithesis already has the agent harness loop and mutation testing. Use it or build a bounded domain suite.
- **Another distributed inference engine** — llm-d and the serving research ecosystem are actively implementing the resource/tail techniques. A two-week general competitor is implausible.
- **CRDTs as the default answer to parallel coding** — convergence does not preserve program meaning, and evidence of a new widespread scaling failure is weak.
- **Consensus or sharding as a new standalone bet** — Inngest already separates constraint enforcement and is moving its queue toward FoundationDB. The primitives are essential but don't identify a new buyer problem.
- **Global "IoT/agents will be 1,000× larger" market thesis** — the sourced populations and growth rates are heterogeneous. Use observed workloads and labelled stress scenarios instead.

### 04-broad: The graveyard outside OS/infra: which old ideas did agents actually un-kill?
Lens A only, applied to 25 old ideas from software engineering, programming languages, security, hardware/EDA, scientific computing, AI history, knowledge bases, accessibility/localisation and migrations. Each idea is sorted by what killed it, whether agents remove that killer, how strong its oracle is, and who harvests it in 2026. Headline: almost every idea killed by labour that also has a strong oracle has already been revived by big players (Meta, Google, Amazon, Anthropic, GitHub, AMD, PolicyEngine). Many famous corpses died of non-labour causes that agents don't fix, and the AI graveyard (Cyc, expert systems, semantic web, synthesis) is obsoleted rather than revived. The ONE bet is agent-driven RLBox library-sandbox retrofits checked by a hostile-library fuzzer. Verdict: go-with-changes, i.e. a 2-week proof with two kill tests. The report says outright that it is weaker than GrowOS, a bridge technology with a 2–4 year window, worth doing as a CV/OSS artefact rather than a company.

#### Library sandbox retrofits by agent: RLBox with a hostile-library oracle (§1, table #1)
- **What:** Wrap each untrusted C/C++ library in an in-process sandbox. Every value crossing back into the host becomes a `tainted<T>` type that the compiler refuses to use until a validator checks it. An agent does the conversion work and writes the validators.
- **How it would work:** Build with the RLBox noop sandbox, and the agent converts call sites until tainted<T> compiles (the compiler errors serve as a built-in fault list, the same "fault → piece" signal as GrowOS's missing syscall). Then switch to wasm2c and require byte-identical output to the native build on test + fuzz corpora. Finally run a hostile library that returns arbitrary values and scribbles over sandbox memory at every crossing while the host runs under ASan/UBSan. Each crash goes back to the agent as a "validator fault".
- **Evidence / numbers:** F: RLBox paper: "a bit over two days to sandbox a library ... roughly 180 LOC (25% code increase)", plus 28 validator sites for JPEG and 51 for PNG. F: after ~5 years Firefox ships only six RLBox libraries (graphite, ogg, hunspell, expat, woff2, soundtouch). F: the 2023 RLBox v2 RFC still calls the wrappers "tedious boilerplate code". I: the scarce resource was security-review attention plus wasm2c throughput cost, not the two days. F: memory-safety bugs are ~70% of serious security bugs at Chromium/Microsoft. E: a small tool market (tens of $M). E: window maybe 2–4 years. Oracle: strong (compiler, differential) / moderate (hostile library checks host memory safety, not semantic policy). Sources: [RLBox, arXiv 2003.00572](https://arxiv.org/abs/2003.00572), [Wahbe SFI 1993](https://doi.org/10.1145/168619.168635), [Chrome Fontations blog](https://developer.chrome.com/blog/memory-safety-fonts).
- **Prior art / who has it:** No LLM/agent-driven RLBox or compartmentalisation work found. Neighbours: RLBox v2 RFC (rule-based wrapper generation), PrivTrans (2004), the compartmentalisation SoK (IEEE S&P 2025), and the C→Rust translators (DARPA TRACTOR performers UW–Madison and Aarno Labs, SafeTrans). The competing remedy is Chrome Skrifa/Fontations, which replaced FreeType in Chrome 133 and is checked by the "fauntlet" diff tool. The repo already has a matching "hostile shard peer" fixture (commit `be019353`).
- **Verdict:** KEPT (#1, the ONE bet). It is the only idea in this lens that is labour-killed, uncrowded and GrowOS-shaped. Superhuman test is mixed: a 100× model makes Rust rewrites cheap too, but sandboxing still wins for unowned, vendored or regulated code and compounds with a later rewrite. Weaker than GrowOS; treat it as a CV artefact and possible OSS adoption, not a company. Expected expert objection: "two days was never the bottleneck; review was, and wasm2c costs 10–40% on codecs, so we'd rather rewrite."
- **Kill test / first proof:** 2 weeks, with a TypeScript driver and a small C++ host plus libxml2, libyaml, cJSON, zstd and libwebp. Measure agent wall-clock per library vs ~2 person-days, validators added, hostile-fuzz crashes found before and after, and wasm2c overhead. Kill if (i) ≥30% of agent validators pass hostile fuzz but a human reviewer still finds a semantic hole, or (ii) wasm2c overhead is >25% on 3 of 5 libraries.

#### Rules as code via independent re-encoding and differential audit (§2, table #2)
- **What:** Write legislation as executable logic so that eligibility and tax decisions are computed, checked and explained mechanically. The surviving angle is the *audit* product: an agent re-encodes a statute independently and the result is diffed against deployed government systems to find their bugs.
- **How it would work:** The agent encodes EITC + CTC + standard deduction (TY2024) from IRC text alone, in Catala or TS, without seeing either implementation. It then runs a 3-way diff (statute encoding vs IRS Direct File Fact Graph vs PolicyEngine-US) over 1M synthetic households, clusters the disagreements and traces each to a statute line.
- **Evidence / numbers:** F: Catala authors formalised ~15% of IRC §121 in ~350 lines. F: LLM pipelines now write Catala from statute (NLLP 2025 benchmark; German statutes, multi-agent, ICML 2026). F: IRS open-sourced Direct File and its Scala Fact Graph in May 2025. F: 2024 Policy2Code teams found direct LLM policy code "subpar" (Beeck Center), but that was 2024 models with no differential loop. F: US improper payments ~$162B in FY2024 (GAO-25-107753); I: only a fraction comes from rules bugs. E: grant- or consulting-shaped business. Oracle: strong for already-implemented law, none for new law. Sources: [Catala, arXiv 2103.03198](https://arxiv.org/abs/2103.03198), [IRS fact-graph](https://github.com/IRS-Public/fact-graph), [policyengine-claude](https://github.com/policyengine/policyengine-claude).
- **Prior art / who has it:** Sergot et al. (British Nationality Act, 1986); Catala; NZ Better Rules (2018). PolicyEngine has an official Claude Code plugin with `encode-policy` multi-agent workflows. The Axiom Foundation runs Rule Atlas and `rulespec-us` (`axiom-encode`, an oracle-coverage ratchet, 2,827 commits). Legalese L4 + MCP server (Singapore). OpenFisca.
- **Verdict:** KEPT (#2). Authoring is crowded "by the right people", and only the audit of deployed systems is open. Superhuman test: more valuable, because administrative decisions must be deterministic, versioned and explainable, and benefit eligibility is high-risk under the EU AI Act (Annex III §5(a)). The model should write and audit the rules, not be them. The original killer was institutional (legislatures never made code authoritative). Buyers are slow. Expected killer reply: "every diff you found is already in our issue tracker."
- **Kill test / first proof:** Kill if there are fewer than 3 novel, maintainer-confirmed bugs in shipped implementations within 2 weeks.

#### N-version programming as an oracle and ambiguity detector (§3, table #3)
- **What:** The original idea: N teams independently implement one spec and majority-vote at runtime. The revival drops fault tolerance and uses disagreement among N agents as a detector of ambiguous spec regions, aimed at draft legislation.
- **How it would work:** 8 agents in 3 languages independently encode a draft bill or regulation section with numeric outcomes. Inputs are fuzzed, disagreements clustered, and a lawyer rates the precision. It manufactures an oracle where none exists (weak per item, useful in aggregate) and merges naturally with #2.
- **Evidence / numbers:** F: Knight & Leveson (1986): 27 versions on 1M inputs rejected the independence hypothesis. F: Ron, Baudry & Monperrus (arXiv 2606.20158, 2026-06-18) re-ran it with coding agents and found "substantial common-mode failure". Majority-vote triples still cut mean failures from 387.4 to 131.0, and co-failures cluster on ambiguous spec parts. F: SpecLens: experts accepted 185 of 197 LLM-found protocol ambiguities, and 60 produced divergence between two 5G implementations. F: VeriSpec's naive baseline precision was 1.4% (arXiv 2610.01847). E: small but prestigious market. Sources: [Avizienis 1985](https://doi.org/10.1109/TSE.1985.231893), [Knight–Leveson 1986](https://doi.org/10.1109/TSE.1986.6312924), [arXiv 2606.20158](https://arxiv.org/abs/2606.20158).
- **Prior art / who has it:** SpecLens (3GPP/O-RAN/DNS), Galápagos (LLM N-version), DiffSpec. Protocols are covered; draft legislation is not (no hit found).
- **Verdict:** KEPT (#3). Agents fix the cost but not the killer (correlation); this turns the correlation into the product. Superhuman test: as runtime fault tolerance it becomes obsolete (more correlation), but it holds as an ambiguity detector because ambiguity lives in the spec. Small market.
- **Kill test / first proof:** Drop it if precision after triage is <50%.

#### Mutation testing (§4, table #4)
- **What:** Seed small faults; a good test suite kills them (DeMillo, Lipton & Sayward 1978).
- **How it would work:** An LLM equivalence judge plus an LLM test writer remove the human labour of triaging equivalent mutants and writing killing tests. The proposed proof combines cargo-mutants, an LLM equivalence filter and an agent killing-test writer.
- **Evidence / numbers:** F: died of compute cost plus the equivalent-mutant problem; Google ran it diff-scoped (Petrović & Ivanković 2018). F: Meta ACH equivalence detector precision/recall 0.79/0.47, rising to 0.95/0.96 with simple preprocessing, and engineers accepted 73% of generated tests ([arXiv 2501.12862](https://arxiv.org/abs/2501.12862)). E: the gap is an OSS "ACH". Oracle: strong.
- **Prior art / who has it:** Meta ACH (FSE 2025), Google, Stryker, cargo-mutants, mutmut.
- **Verdict:** KILLED as a bet (flipped and harvested). Use it inside sofort's own agent loops as the quality gate for agent-written tests (Lens B overlap). Superhuman test: more valuable. Expected killer reply: "Meta published it; you rebuilt a paper."
- **Kill test / first proof:** Proof sketched: 3 Rust crates, measuring surviving-mutant reduction per $ (I).

#### Property-based testing (§5, table #5)
- **What:** QuickCheck-style random testing against stated properties (Claessen & Hughes, ICFP 2000). It stayed niche because inventing properties and generators is expert work.
- **How it would work:** A coding agent invents the properties and generators, runs them, and reports the minimised counterexamples as bugs.
- **Evidence / numbers:** F: Maaz, DeVoe, Hatfield-Dodds & Carlini ran a Claude Code agent over 100 Python packages. 56% of reports were valid bugs, 86% of the top-21 were valid, and patches were merged into NumPy and others ([arXiv 2510.09907](https://arxiv.org/abs/2510.09907)). F: an Anthropic follow-up (2026-01-14) reports hundreds of candidate bugs ([red.anthropic.com](https://red.anthropic.com/2026/property-based-testing)). Oracle: strong (minimised counterexample).
- **Prior art / who has it:** Anthropic agentic PBT, Hypothesis, Kiro specs.
- **Verdict:** KILLED as a bet (flipped and harvested): "done by the people who made the tools." Superhuman test: more valuable.
- **Kill test / first proof:** None given.

#### Design by contract, refinement (B/Z) and dependent types (§6, table #6)
- **What:** Annotate code with contracts or refinement specs and prove it correct (Meyer 1986–92; Abrial's B-Book 1996).
- **How it would work:** Agents run generate–check–repair loops for proofs and contracts (e.g. Dafny with tests as oracles). That removes the proof labour but exposes the spec-intent bottleneck.
- **Evidence / numbers:** F: Paris Line 14 (B-method) needed 23,000 proof obligations (17% proved interactively) for 86k lines of Ada; no bugs were found after proof, yet uptake stayed small outside rail. F: vericoding (12,504 tasks): Dafny 82.2%, Verus 44.2%, Lean 26.8%; Dafny state of the art went from 68% (June 2024) to 89%. F: LLMs bias toward weak postconditions (NL2Contract). Oracle: strong for "the proof checks", weak for "the spec says what you meant". Sources: [vericoding, arXiv 2509.22908](https://arxiv.org/abs/2509.22908), [Lecomte et al., arXiv 2005.07190](https://arxiv.org/abs/2005.07190), [NL2Contract, arXiv 2510.12702](https://arxiv.org/abs/2510.12702).
- **Prior art / who has it:** Very crowded: vericoding, AutoVerus, Dafny loops, Harmonic, Axiom, Math Inc, Galois, AWS.
- **Verdict:** KILLED for this lens (flipping and crowded; spec intent is the residue agents can't fix). Superhuman test: more valuable. Formal verification is left to other reports as a calibration example.
- **Kill test / first proof:** None given.

#### Expert systems / knowledge engineering (§7, table #7)
- **What:** Hand-built rule bases encoding expert knowledge (Feigenbaum, IJCAI 1977, who named the knowledge-acquisition bottleneck).
- **How it would work:** Not revived. Knowledge acquisition is now free, but the LLM replaces the rule base as the artefact.
- **Evidence / numbers:** F: XCON grew to 6,200 rules by 1987, with "approximately 50% change every year", and became "increasingly ... more difficult to change". Oracle: weak (historical decisions).
- **Prior art / who has it:** Absorbed by LLMs. The residue (law that demands determinism and audit) is #2.
- **Verdict:** KILLED (obsoleted, not revived). Superhuman test fails: a 100× model makes hand-curated rule bases strictly worse.
- **Kill test / first proof:** None given.

#### Cyc (§7, table #8)
- **What:** Lenat's 1984 project to hand-curate a commonsense knowledge base.
- **How it would work:** Not revived; the LLM *is* the commonsense KB.
- **Evidence / numbers:** F: ~2,000 person-years by 2017, against a 1983 estimate of 1,000–3,000 ([Wikipedia: Cyc](https://en.wikipedia.org/wiki/Cyc); [Lenat et al., AI Magazine 1985](https://ojs.aaai.org/index.php/aimagazine/article/view/510)). Oracle: none.
- **Prior art / who has it:** LLMs.
- **Verdict:** KILLED (obsoleted).
- **Kill test / first proof:** None given.

#### Semantic web (§7, table #9)
- **What:** Machine-readable, ontology-annotated web publishing (Berners-Lee, Hendler & Lassila, 2001).
- **How it would work:** Not revived. LLMs read prose pages directly. Agent traffic might create a new publisher incentive (llms.txt, MCP), but the report classes that as Lens B and social, not labour.
- **Evidence / numbers:** F: adoption failures were blamed on complexity and on not serving typical users ([Hitzler et al., SWJ 2019](https://journals.sagepub.com/doi/10.3233/SW-190387)). Oracle: none.
- **Prior art / who has it:** schema.org survived via SEO.
- **Verdict:** KILLED. The killer (publisher incentive) is social, so agents don't fix it, and the model obsoletes it anyway.
- **Kill test / first proof:** None given.

#### High-level synthesis (HLS) tuning (§8, table #10)
- **What:** Compile C/C++ to RTL (Catapult, Vivado/Vitis HLS). Agents do the expert pragma and dataflow tuning that kept the QoR gap open.
- **How it would work:** An agent iterates pragmas and dataflow structure against C-sim/co-sim and synthesis reports.
- **Evidence / numbers:** F: LAAFD reaches a 99.9% geomean of hand-tuned Vitis HLS performance across 15 kernels with co-sim feedback ([arXiv 2602.06085](https://arxiv.org/abs/2602.06085)). F: AMD publishes LLM-aided HLS case studies in 2026 ([AMD](https://www.amd.com/en/developer/resources/technical-articles/2026/llm-aided-hls-dataflow-optimization-a-sha-256.html)). E: EDA ~$15B+. Oracle: strong; the most oracle-rich area in this lens.
- **Prior art / who has it:** Dense: HLS-Eval, Bench4HLS, LIFT, LAAFD, AMD, and the EDA vendors' own AI suites.
- **Verdict:** KILLED for a solo engineer (flipping but vendor-owned; toolchains are proprietary and buyers are captive to Cadence/Synopsys/AMD). Superhuman test: more valuable. Expected killer reply: "AMD will ship this in Vitis."
- **Kill test / first proof:** Proof sketched: a Vitis HLS agent on 10 MachSuite kernels.

#### Per-workload custom accelerators (§8, table #11)
- **What:** Build custom silicon for each workload.
- **How it would work:** Not applicable; the killer is capital, not labour.
- **Evidence / numbers:** I: the killer is silicon NRE and masks plus demand concentration; "masks still cost what they cost". Oracle: strong.
- **Prior art / who has it:** Hyperscalers only.
- **Verdict:** KILLED (agents don't fix capital).
- **Kill test / first proof:** None given.

#### Formal hardware verification (assertions/FPV) (§8, table #12)
- **What:** Assertion-based formal property verification of hardware; it was held back by scarce assertion-writing expertise.
- **How it would work:** An agent writes SVA and iterates it against JasperGold proofs and counterexamples.
- **Evidence / numbers:** F: ProofLoop iterates SVA against JasperGold proofs ([arXiv 2604.23100](https://arxiv.org/abs/2604.23100)). Table: agents fix it "partly". Oracle: strong (proofs/CEX).
- **Prior art / who has it:** ProofLoop, ChatSVA, STELLAR, EDA vendors.
- **Verdict:** KILLED (grouped with HLS: vendor-owned and crowded). Superhuman test: more valuable.
- **Kill test / first proof:** None given.

#### Porting Fortran / legacy HPC (§9, table #13)
- **What:** Agents port legacy Fortran scientific codes (e.g. Fortran→C++).
- **How it would work:** LLM translation checked against tolerance-bounded numerical outputs.
- **Evidence / numbers:** F: LANL measured LLM Fortran→C++ compile rates and output similarity ([arXiv 2504.15424](https://arxiv.org/abs/2504.15424)). F: Argonne built CodeScribe ([arXiv 2410.24119](https://arxiv.org/abs/2410.24119)). Killer was labour plus numerics expertise. Oracle: moderate.
- **Prior art / who has it:** DOE labs (LANL, Argonne CodeScribe, LLNL data).
- **Verdict:** KILLED. Labour flipped, but the labs own it; the buyer is DOE.
- **Kill test / first proof:** None given.

#### Computational reproducibility (§9, table #14)
- **What:** Reproduce published computational results with agents (the Claerbout/Donoho reproducible-research lineage, 1990s).
- **How it would work:** An agent re-runs a paper's code and data and checks against the paper's own tables.
- **Evidence / numbers:** F: CORE-Bench's best agent scored 22.2% on the hardest tasks ([Princeton](https://crab.cs.princeton.edu/core-website)). F: I4R ran Machine/Cyborg/Human replication games (Open Philanthropy grant). Oracle: moderate.
- **Prior art / who has it:** Princeton CORE-Bench, I4R.
- **Verdict:** KILLED. Labour flips but the incentive doesn't: nobody is paid to reproduce, journals and funders must require it, and there is no paying buyer. It is a policy problem.
- **Kill test / first proof:** None given.

#### Verified numerics (Herbie, FPTaylor) (table #15)
- **What:** Tools that check or improve floating-point accuracy (Herbie 2015, FPTaylor).
- **How it would work:** Table-only entry; no mechanism proposed.
- **Evidence / numbers:** The table says the killer was niche demand, not labour. Oracle: strong.
- **Prior art / who has it:** Herbie, FPTaylor; "stays niche".
- **Verdict:** KILLED. It was never labour-bound and agents don't fix niche demand.
- **Kill test / first proof:** None given.

#### Memory-safe rewrites of C/C++ (table #16; neighbour discussed in §1)
- **What:** Rewrite C/C++ in a memory-safe language (Rust), checked differentially against the original.
- **How it would work:** An agent or translator produces Rust that is diffed against the original's behaviour (e.g. Chrome's FreeType-vs-Skrifa "fauntlet").
- **Evidence / numbers:** F: Skrifa/Fontations replaced FreeType for web fonts in Chrome 133 (Feb 2025). F: DARPA TRACTOR performers were announced in 2025. Killer was labour plus semantic risk; agents fix it ("yes"). Oracle: strong.
- **Prior art / who has it:** DARPA TRACTOR (UW–Madison, Aarno Labs), Chrome Fontations, Microsoft, SafeTrans.
- **Verdict:** KILLED (crowded; covered by other reports). It is also the remedy that bounds the #1 bet's window.
- **Kill test / first proof:** None given.

#### Capability hardware (CHERI) (§11, table #17)
- **What:** Hardware capabilities for memory safety (CHERI 2010→).
- **How it would work:** Not applicable; porting labour is already tiny, so agents have nothing to remove.
- **Evidence / numbers:** F: a ~6 MLoC X11/Qt/KDE stack needed 0.026% of lines changed, with one engineer for ~3 months ([Capabilities Ltd report, 2021](https://www.cl.cam.ac.uk/research/security/ctsrd/pdfs/20210917-capltd-cheri-desktop-report-version1-FINAL.pdf)). I: the killer is hardware availability and ecosystem. Oracle: strong.
- **Prior art / who has it:** CHERIoT, Morello (prototype).
- **Verdict:** KILLED: "Agents don't fix CHERI's blocker."
- **Kill test / first proof:** None given.

#### Object capabilities / information-flow control (§11, table #18)
- **What:** Capability security and IFC (Dennis & Van Horn 1966; Miller 2006; Denning 1976; Myers JFlow 1999).
- **How it would work:** What flipped is demand, not labour: prompt-injected agents need IFC and capabilities.
- **Evidence / numbers:** I: the killer was label annotation, label creep and declassification policy, which is partly labour and partly design. F: CaMeL solves 77% of AgentDojo tasks with provable security vs 84% undefended ([arXiv 2503.18813](https://arxiv.org/abs/2503.18813)). Oracle: moderate.
- **Prior art / who has it:** CaMeL (DeepMind 2025) for agents.
- **Verdict:** KILLED for this lens. It moves to Lens B and is out of scope here.
- **Kill test / first proof:** None given.

#### Literate programming (§12, table #19)
- **What:** Knuth's (1984) woven code-plus-prose documents.
- **How it would work:** Not revived; a model that explains code on demand obsoletes the woven document.
- **Evidence / numbers:** I: died because humans won't write everything twice (and of drift). Oracle: weak. Source: [Knuth 1984](https://doi.org/10.1093/comjnl/27.2.97).
- **Prior art / who has it:** None; obsoleted.
- **Verdict:** KILLED (human-factors death; obsoleted).
- **Kill test / first proof:** None given.

#### Model-driven engineering / MDA (§12, table #20)
- **What:** Generate systems from formal models (OMG MDA, 2001).
- **How it would work:** Not revived as such. "Spec-driven development", where the model is prose and the generator is an LLM, is a different idea.
- **Evidence / numbers:** F: failure was "largely ... social and organizational factors" (Hutchinson, Whittle, Rouncefield et al., ICSE 2011; IEEE Software 2014, 450 practitioners) ([Lancaster eprints](https://eprints.lancs.ac.uk/id/eprint/69765)). Oracle: weak.
- **Prior art / who has it:** Kiro, Spec Kit (spec-driven dev).
- **Verdict:** KILLED (social/organisational killer; agents don't fix it).
- **Kill test / first proof:** None given.

#### Structure editors (§12, table #21)
- **What:** Syntax-directed program editors (Cornell Program Synthesizer, Teitelbaum & Reps 1981).
- **How it would work:** Not revived; agents don't type, so the motivation disappears rather than flips.
- **Evidence / numbers:** I: humans hated tree editing. Source: [Teitelbaum & Reps 1981](https://doi.org/10.1145/358746.358755).
- **Prior art / who has it:** Niche (Hazel, JetBrains MPS).
- **Verdict:** KILLED (human factors).
- **Kill test / first proof:** None given.

#### Smalltalk/Lisp live images (§12, table #22)
- **What:** Persistent live programming environments (Smalltalk-80, Lisp machines).
- **How it would work:** Not applicable; there is no labour story.
- **Evidence / numbers:** I: killed by deployment and social factors.
- **Prior art / who has it:** Niche.
- **Verdict:** KILLED (agents don't fix it).
- **Kill test / first proof:** None given.

#### End-user programming / programming by demonstration (§12, table #23)
- **What:** Let non-programmers create programs from examples (Nardi 1993; Cypher 1993).
- **How it would work:** Solved by LLMs ("vibe coding") rather than revived.
- **Evidence / numbers:** I: killed by the difficulty of generalising from examples.
- **Prior art / who has it:** Vibe coding.
- **Verdict:** KILLED (obsoleted; LLMs solved it).
- **Kill test / first proof:** None given.

#### Program synthesis (§12, table #24)
- **What:** Derive programs automatically from specs or examples (Manna & Waldinger, TOPLAS 1980; FlashFill, POPL 2011).
- **How it would work:** Solved by LLMs; the LLM is the synthesiser.
- **Evidence / numbers:** I: killed by search blow-up. Oracle: strong. Source: [Manna & Waldinger 1980](https://doi.org/10.1145/357084.357090).
- **Prior art / who has it:** LLMs.
- **Verdict:** KILLED (obsoleted).
- **Kill test / first proof:** None given.

#### Accessibility, localisation and API/doc migrations (§10, table #25)
- **What:** Agents do long-tail remediation labour: WCAG-conformant UIs, i18n of legacy apps, and library/API migrations.
- **How it would work:** Agents edit code in bulk, checked by build + tests for migrations and by automated accessibility engines plus humans for a11y.
- **Evidence / numbers:** F: 94.8% of the top 1M home pages have detectable WCAG failures, averaging 51 errors per page ([WebAIM Million 2025](https://webaim.org/projects/million/2025)). F: the FTC made accessiBe pay $1M over overlay compliance claims. F: the European Accessibility Act has applied since 28 June 2025, so demand flipped along with labour. F: Amazon claims 4,500 developer-years saved on Java 17 upgrades. F: Google reports >75% of AI-generated characters landing and 5,359 files migrated in 3 months for JUnit ([arXiv 2501.06972](https://arxiv.org/abs/2501.06972)). Secondary/vendor claims: a GitHub a11y agent pilot over 3,535 PRs (May 2026, unverified), and Deque's axe MCP server "257 hours to 4" ([Deque](https://www.deque.com/customer-stories/mcpstory/)). Oracle: strong for migrations, weak for a11y (engines catch only part of WCAG; screen-reader UX needs humans).
- **Prior art / who has it:** GitHub, Deque, accessiBe Code Agent (2026-09-17); Moderne/OpenRewrite, Amazon Q, Google.
- **Verdict:** KILLED (flipped and crowded; a market of incumbents with distribution). Superhuman test: more valuable, but it commoditises.
- **Kill test / first proof:** None given.

#### Rejected in this report
- **Mutation testing** — flipped; Meta ACH (0.95/0.96 equivalence, 73% acceptance) already ships it.
- **Property-based testing** — flipped; Anthropic's agentic PBT found and merged real bugs in NumPy and others.
- **DbC / B / dependent types** — proof labour flipped (vericoding 82–89% Dafny); spec intent remains; crowded.
- **Expert systems / Cyc / semantic web** — a superhuman model obsoletes hand-built KBs; the semantic web's killer is social.
- **HLS / FPV** — oracle-rich and flipping, but owned by AMD/Cadence/Synopsys and academia (LAAFD 99.9%).
- **Custom accelerators per workload** — the killer is mask NRE capital, not labour.
- **Fortran porting** — DOE labs (LANL, Argonne, LLNL) are on it.
- **Reproducibility** — labour flips, the incentive doesn't; no paying buyer.
- **Verified numerics (Herbie)** — never labour-bound; niche demand.
- **Memory-safe C/C++ rewrites** — crowded (TRACTOR, Chrome, Microsoft); covered by other reports.
- **CHERI / capabilities** — porting is already 0.026%; the blocker is hardware. IFC → Lens B (CaMeL).
- **Literate programming, MDE, structure editors, live images** — human-factors deaths; agents don't fix or obsolete them.
- **End-user programming / program synthesis** — solved by LLMs, not revived.
- **Accessibility / localisation / API migrations** — flipped, with incentives (EAA June 2025) and incumbents (GitHub, Deque, accessiBe, Google, Amazon, Moderne) already there.
- **Rules-as-code authoring** — PolicyEngine's Claude plugin and the Axiom Foundation already do agent encoding with oracle tracking; only the *audit* angle (§2) survives.

### 05-scale-code: Lens B — the software-production pipeline at agent scale
Lens: version control, code review, CI/build, package ecosystems, issue tracking, monorepos and release engineering. Which human-scale assumptions break when agents produce 10–100× more commits, PRs, CI runs and packages, and which old ideas fix the break. Headline: agent scale is real (GitHub commits 1.4B → 2.9B/month Apr → Aug 2026, ~35× in a year **E**; Anthropic 2.5k → 30k+ merges/day in four months **F**). Storage and serving is already crowded. The unsolved break is integration: serial and batched merge queues collapse above ~10³ merges/day (computed **M**). The ONE bet is idea 1, post-submit integration (milestones, flake-aware culprit finding, evidence-carrying auto-revert) for GitHub repos. Verdict: go-with-changes, gated by a 2-week proof on false reverts and red-trunk time. The main risk is that it ends up a feature of GitHub or the queue vendors rather than a company.

#### Post-submit integration for everyone: milestone testing + flake-aware culprit finding + evidence-carrying auto-revert
- **What:** Changes land after their own presubmit. Trunk snapshots ("milestones") are tested continuously, culprits are found by flake-aware bisection, and an automatic revert or agent fix-forward is filed with evidence attached.
- **How it would work:** Milestone testing with adaptive binary splitting (TAP-style) costs about 1 + c·⌈log₂B⌉ suite runs per milestone, where c = p·B culprits. A Bayesian noisy binary search (FACF) separates flakes from real failures. Revert-then-green confirms the culprit, and the culprit finder hands an agent a minimal repro for fix-forward. The 2-week proof is in TypeScript: a replay simulator over a real repo's last 5,000 commits and CI history, with injected breaks at p ∈ {0.1, 1, 5}% and measured flake rates; a ~300-LOC re-implementation of FACF; and a GitHub App that runs milestones on `main` and files revert PRs carrying their posterior ("P(culprit)=0.97, 6 runs").
- **Evidence / numbers:** A serial queue caps at 1440/T merges/day, which is 144/day at T = 10 min **M**. A batched queue at λ = 30k/day (B = 208) gives P(batch clean) of 0.81 / 0.35 / 0.12 at p_resid 0.1% / 0.5% / 1%. Reaching P(clean) ≥ 0.9 needs 2 / 10 / 20 independent partitions, and 199 at 300k/day with p = 1% **M**. Batch queues fail >50% of the time at 30k/day unless p_resid ≤ 0.3% **M**. Post-merge costs 0.013 / 0.085 / 0.41 suite runs per change at p 0.1% / 1% / 5% (λ = 30k), and 0.12 at 300k/day with p = 1%, against 1.0 for per-change runs on tip. That is 8–75× fewer integration runs, ~12× at 1% **M**. Flakiness is left out of the model, so true costs are likely 2–3× the table **E**. Anthropic: 30k+ merges/day, ~25M CI checkouts/day, "What does CI even mean when hundreds or even thousands of changes can merge while tests are running?", global lock dropped **F**. Google TAP 2016: 800K builds and 150M test runs/day, per-commit testing cost "growing quadratically" **F**. Cross-agent textual-conflict rate is 41.7% (79.4% of agent PRs are in co-active pairs) **F**. Hypothetical org: 300 engineers × 10 agents × 5 PRs/day = 15k/day **E**. Graphite reportedly sold to Cursor above its $290M valuation **F (2nd)**. Sources: [Anthropic, Redesigning source control](https://www.anthropic.com/engineering/redesigning-source-control); [Memon et al. 2017 (TAP)](https://research.google/pubs/taming-google-scale-continuous-testing/); [Flake-Aware Culprit Finding, ICST 2023](https://research.google/pubs/flake-aware-culprit-finding/).
- **Prior art / who has it:** Google TAP plus culprit finding, FACF (2023) and SafeRevert (2024). git bisect (2005). Chromium Findit → LUCI Bisection (open source, tied to LUCI/Buildbucket). Anthropic (internal, on Scion). Meta (internal). The opposing pre-merge tradition: Not-Rocket-Science rule/bors (2014), Zuul (2012+), Uber SubmitQueue (2019). Dropbox Athena (2019) deliberately did not auto-revert. Vendors (GitHub merge queue, Graphite/Cursor, Mergify, Aviator, Trunk) sell only pre-merge queues, plus flaky-test quarantine (Mergify, 2026-07-24). Searches on 2026-10-28 found no product that combines post-merge milestones, flake-aware culprit finding and auto-revert for GitHub. This is absence of evidence, not proof.
- **Verdict:** KEPT (#1, THE ONE BET). Oracle strong. Superhuman test: more valuable, because better models lower p_resid and make post-merge cheaper. Prior-art risk medium. The gap is real. It is the only break that has a public owner admission, collapse arithmetic, a documented old fix, a strong oracle, models making it cheaper, and no product.
- **Kill test / first proof:** On replayed real history with measured flake rates, kill if false reverts exceed 1% of reverts or red-trunk time exceeds 10% of the day at p_resid = 1%. Also kill if GitHub or a queue vendor ships post-merge bisect-and-revert first. The killer reply to answer: main is red during bisection, so agents branch from red main and cascade, and auto-revert on flaky signals reverts innocent changes.

#### Agent-grown independent rebuilds for the package long tail ("reproducible builds, finally at registry scale")
- **What:** Rebuild every published package from its tagged source in an independent environment and compare it with the published artifact, bit-for-bit or with an explained diff. A mismatch is evidence of tampering.
- **How it would work:** GrowOS-shaped loop: fault (no recipe or mismatch) → agent writes a build recipe in a sandbox → rebuild from the git tag, normalise the tarball, diff against the published artifact (diffoscope-explained) → accept. The output is a multi-party attestation that a third party accepts.
- **Evidence / numbers:** PyPI 2025: 130K new projects, 3.9M new files, >2,000 malware reports, 20% of uploads via trusted publishing **F**. Registries had 454,600 new malicious packages in 2025 (vendor count) **F (2nd)**. Shai-Hulud hit 500+ npm packages, then ~796 in "2.0", and injected payloads into tarballs that were not in git. The May 2026 TanStack wave shipped with valid SLSA L3 provenance **F**. BuildBench (NeurIPS 2025): 64% strict build success for a Claude-3.7-based agent, against 10% for prior tooling **F**. Chainguard claims 88% of npm's top 500 **F**. Sources: [arXiv:2509.25248 (BuildBench)](https://arxiv.org/abs/2509.25248); [Google OSS Rebuild](https://github.com/google/oss-rebuild); [PyPI 2025 in review](https://blog.pypi.org/posts/2025-12-31-pypi-2025-in-review).
- **Prior art / who has it:** Thompson "Reflections on Trusting Trust" (1984); Wheeler diverse double-compiling (2005/2009); Debian Reproducible Builds (2013→); Nix (2006). Google OSS Rebuild (Jul 2025; npm, PyPI, crates; ~9.5K packages at launch; README lists "AI-driven rebuilds" as a goal). Chainguard Libraries (commercial). Reproducible Central (Maven); rebuilderd (Arch/Debian). The gap is the long tail beyond roughly the top 10K packages, plus multi-party attestations.
- **Verdict:** KEPT (#2, runner-up). Oracle strongest. Superhuman test: more valuable, but narrow in scope because it checks the build path, not malicious source. Prior-art risk high (OSS Rebuild, Chainguard). Gap is real for the long tail only. Value is "evidence another party accepts", sold to security budgets (Socket, Chainguard, Endor, Snyk buyers).
- **Kill test / first proof:** Proof: take the top 5,000 npm packages that ship built artifacts and are not in OSS Rebuild. Report coverage gained, cost per package, and how many replayed Shai-Hulud/TanStack versions get flagged. Kill if agent rebuild success is below 30% on the long tail, or if OSS Rebuild announces agent-inferred recipes at scale.

#### Review early-cutoff: route changes whose shipped artifact did not change away from humans
- **What:** Treat review like a build with early cutoff. A change that leaves every shipped artifact byte-identical under a reproducible build cannot have changed behaviour, so humans review only the changes whose output hash moved, ranked by which artifacts moved.
- **How it would work:** A CI/review check builds the shipped artifacts reproducibly, compares their hashes with the parent's, and labels PRs "artifact-identical" and which artifacts changed. It is a routing signal, not auto-approval. Every target platform has to be built, because build tags matter.
- **Evidence / numbers:** Measured on the last 151 first-parent commits of junegunn/fzf (Go, darwin/arm64, stripped `-trimpath` build, 0 build failures) **M**. 36% (54/151) left the binary byte-identical, including 11% (9/84) of source-touching commits. A typical path filter was wrong in 21% (31/151): 22 commits (15%) it would have waved through as docs/scripts changed the binary, because fzf `go:embed`s its shell scripts and man page. That is the unsafe direction. 9 commits it flagged as source changed nothing (comment and test cleanups, Windows-only files, `make tag`). Review time rose +91% to 5×, and 31% more PRs merged with no review **F (2nd)**. Agent histories probably have more mechanical churn **I** (not measured). Source: [Build Systems à la Carte, ICFP 2018](https://dl.acm.org/doi/10.1145/3236774).
- **Prior art / who has it:** Early cutoff (Mokhov, Mitchell, Peyton Jones 2018); Yocto Hash Equivalence (2019); Jackson & Ladd "Semantic Diff" (1994); Godlin & Strichman regression verification (2009). Anthropic Antique (internal, hand-written rules on "comment-only vs sensitive logical" approvals); a `refactor-verifier` agent skill (per-definition body hashes); Bazel/target-determinator compute affected targets but do not gate review. No product found.
- **Verdict:** KEPT (#3, runner-up). Oracle strong for compiled artifacts and weak for dynamic languages, which need normalised bytecode or AST. Superhuman test: more valuable, but it clears only the boring share. Prior-art risk low. The gap is modest. It passed its own kill test, but only modestly. The sharper result is that "did the shipped artifact change?" is a cheap oracle that beats path-based routing in both directions.
- **Kill test / first proof:** Kill if under ~5% of source-touching commits leave the artifact identical, because a path filter would then get almost all the value. On fzf it was 11%, so it passed. Proof: rerun the experiment across 20 repos in Go, Rust and TS, plus a GitHub check that labels artifact-identical PRs.

#### Agent-maintained hermetic, content-addressed builds (Vesta → Blaze/Bazel, Nix)
- **What:** Agents maintain the BUILD graph, so hermetic, cached, content-addressed builds become affordable for small teams.
- **How it would work:** Agents keep the dependency map current and migrate repos to Bazel/Nix. The oracle is that the same outputs and tests pass before and after the migration.
- **Evidence / numbers:** Anchorage rejected Bazel in 2022 because of the upkeep, then adopted it in 2026 because agents maintain it. CI stayed at ~3 min while Go packages doubled (188 → 366) **F**. Sources: [Anchorage, 2026-09-03](https://www.anchorage.com/research/when-agents-write-the-code-the-tooling-trade-offs-flip); [EngFlow any2bazel](https://blog.engflow.com/2026/09/09/introducing-any2bazel-oss-bazel-migration-tool/).
- **Prior art / who has it:** Vesta (DEC/Compaq SRC, SRC-RR-168, 2001); Nix (Dolstra 2004/2006); Blaze (~2006) → Bazel (2015). Already being done: EngFlow any2bazel (Sep 2026), Fuchsia BEADS agent skills, Bazel's AI-driven Bzlmod migration, Flox "deterministic agents". The value goes to consulting and remote-execution vendors (EngFlow, BuildBuddy, Aspect).
- **Verdict:** KILLED. The flip is already happening (a Lens A flip in progress). Oracle strong. Superhuman test: more valuable. Prior art: done.
- **Kill test / first proof:** Proof not worth it, since someone already does this.

#### Traced (inferred) dependency graphs for repos without BUILD files
- **What:** Infer dependency graphs by tracing builds and tests, so regression test selection and graph-partitioned queues work without hand-written BUILD files.
- **How it would work:** Per-language instrumentation records which files each build step or test touches. Only affected tests are selected. Safety check: full-suite results must equal selected-suite results.
- **Evidence / numbers:** CI minutes doubled in a year (Actions 1B → 2.1B min/week) **F**. Graph-partitioned merge queues (Trunk, Aviator, Mergify) require a graph **F**. Counter-evidence: Anchorage measured affected-test selection at 1.6 s saved per PR and rejected it **F**. Source: [Ekstazi, ISSTA 2015](https://dl.acm.org/doi/10.1145/2771783.2771784).
- **Prior art / who has it:** Vesta's automatic dependency recording; Ekstazi (2015); Rattle (OOPSLA 2020); Microsoft BuildXL; Rothermel & Harrold safe RTS (TOSEM 1997); Meta predictive selection (2019). Already done by pytest-testmon, Jest `--findRelatedTests`, Datadog TIA, Develocity PTS, CloudBees Smart Tests (Launchable), Nx affected, BuildBuddy/EngFlow/NativeLink caches.
- **Verdict:** KILLED. Mostly done; it is a feature, not a bet. Value is small for small suites, and vendors cover the big-suite cases. Oracle strong. Superhuman test: neutral to positive.

#### Build-graph-partitioned speculative merge queue (Zuul, SubmitQueue)
- **What:** Test the speculative future state of the queue in parallel, split into independent partitions using the build graph.
- **How it would work:** A conflict analyzer over the build graph runs independent changes in parallel queues, so the batch failure rate stays low.
- **Evidence / numbers:** At λ = 30k/day, 2–20 partitions are needed for P(batch clean) ≥ 0.9 (p_resid 0.1–1%), and 199 at 300k/day with 1% **M**. Partitioning needs a precise dependency graph, which most repos lack **I**. Source: [Mergify Parallel Scopes, 2026-04-13](https://docs.mergify.com/changelog/2026-04-13-parallel-scopes.md).
- **Prior art / who has it:** Zuul (OpenStack, James Blair, ~2012); Uber SubmitQueue (EuroSys 2019). Done: Trunk (Bazel parallel queues), Aviator (affected targets from Bazel/Nx/Turbo), Mergify Parallel Scopes, Graphite.
- **Verdict:** KILLED. Not a gap; already shipped. Oracle strong. Superhuman test: neutral, because it helps only when p_resid is high. Idea 1 is its complement for repos without a graph or above the partition ceiling.

#### Central, server-side version control with virtual working copies (Piper/CitC, Mononoke/EdenFS, VFS for Git)
- **What:** Replace git's offline, clone-everything model with central server-side VCS and virtual working copies for always-online agents.
- **How it would work:** Server-side operations over content-addressed changesets, with lazily materialised working copies. The oracle is git compatibility and round-tripping of history.
- **Evidence / numbers:** Anthropic: ~25M CI checkouts/day (>600 PB/day if fetched naively), ~100 GB history, >25 GB working copy, hundreds of mirrors. Git's offline-first design "was actively undermining" scaling **F**. GitHub: 2.9B commits/month, >3M CPU cores and 120 PB of storage added, 7 h 47 min outage on Aug 17 2026 **F**. Scion: seven engineers, five months, 200× smaller infrastructure **F**. Entire claims 570k clones/hour **F (2nd)**. Cloudflare Artifacts costs $0.15/1k ops **F**. Sources: [Anthropic, Redesigning source control](https://www.anthropic.com/engineering/redesigning-source-control); [GitHub Aug 17 outage post](https://github.blog/news-insights/company-news/the-august-17-outage-and-the-work-ahead/); [Cloudflare Artifacts](https://blog.cloudflare.com/artifacts-git-for-agents-beta/).
- **Prior art / who has it:** Google Piper/CitC (CACM 2016); Meta Sapling/Mononoke/EdenFS (open-sourced 2022); Microsoft VFS for Git (2017) → Scalar (in git since 2.38). Crowded: Anthropic Scion (credits Mononoke/Bonsai after an attribution dispute), Cursor Continuity/Origin (S3 WAL + CAS), GitHub read scaling, Entire ($60M seed), Pierre Code Storage ($23M), Cloudflare Artifacts (git on Durable Objects), ERSC (jj's creator as CTO), Shopify CEO's walgit.
- **Verdict:** KILLED. Crowded (8+ efforts), not a single-engineer gap. Oracle strong. Superhuman test: more valuable.

#### Change-based review with stacked diffs (Mondrian → Rietveld → Gerrit; Phabricator)
- **What:** Review small, dependent changes as stacks instead of branch PRs.
- **How it would work:** Each change is reviewed on its own and ordered in a stack, which suits smaller, dependent agent changes. The oracle is human acceptance, which is weak.
- **Evidence / numbers:** None quantified beyond the general review-load figures (+91% to 5× review time) **F (2nd)**. Source: [GitHub stacked PRs](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests).
- **Prior art / who has it:** Google Mondrian (~2006) → Rietveld (2008) → Gerrit (2008/09); Facebook Phabricator/Differential (~2007, open-sourced 2011, Phacility wound down 2021). Done: GitHub stacked PRs (`gh stack`, preview 2026-07-30), Graphite → Cursor (Dec 2025), Sapling ReviewStack, Devin stacked PRs.
- **Verdict:** KILLED. Not a gap; GitHub and Graphite/Cursor shipped it. Oracle weak. Superhuman test: less valuable if review shifts to intent, though still useful for ordering.

#### Patch theory and structural merge (Darcs, Pijul, semistructured merge, Mergiraf, jj)
- **What:** Use patch algebra or syntax-aware merge to resolve the flood of cross-agent conflicts.
- **How it would work:** Commuting patches or AST-level three-way merge resolve conflicts that textual merge cannot. At most it would be a zero-token pre-filter before an LLM. Oracle medium: tests after the merge, plus agreement with the developer's resolution.
- **Evidence / numbers:** Replayed three-way merges show a 41.7% textual-conflict rate for cross-agent pairs and 19.8% within one agent; 84% of conflicted files are source code **F** ([arXiv:2607.04697](https://arxiv.org/abs/2607.04697), 33,596 PRs). LLMs match human resolutions 55–59% of the time, against 36.7% for the best structured tool **F (2nd)**. Semantic interference: 1 of 834 mined Django pairs, 97% on constructed tasks **F** ([arXiv:2609.25396](https://arxiv.org/abs/2609.25396)). Anthropic: Claude fixes conflicts "faster than humans can even identify them" **F**.
- **Prior art / who has it:** Darcs (David Roundy, 2002–03); Pijul (Meunier & Becker; still 1.0 beta.22, Aug 2026) on Mimram & Di Giusto's categorical theory of patches (2013); semistructured merge (Apel et al., FSE 2011); Mergiraf (2024); LastMerge; jj first-class conflicts.
- **Verdict:** KILLED. Obsolescing: models absorb it, and semantic interference is rare in practice and caught by tests. It died before on Darcs' exponential merge cases, git's network effect and per-language grammar labour.

#### Operation-based / CRDT version control (OT 1989, CRDTs 2011)
- **What:** Version control built on operations or CRDTs instead of snapshots, giving edit-level provenance for agents that edit continuously.
- **How it would work:** Every edit is recorded as an operation that merges convergently, so there are no snapshot commits. Oracle weak.
- **Evidence / numbers:** None quantified. Source: [Zed DeltaDB announcement](https://zed.dev/blog/introducing-deltadb).
- **Prior art / who has it:** Ellis & Gibbs (SIGMOD 1989); Shapiro et al. CRDTs (2011). Done: Zed DeltaDB/Delta (announced 2025, waitlist 2026).
- **Verdict:** KILLED. Not a gap: Zed is doing it, and the buyer is unclear. Superhuman test: neutral.

#### Universal content-addressed source archive and intrinsic IDs (Software Heritage, SWHID)
- **What:** Use Software Heritage's archive and SWHIDs to answer provenance and licence questions for generated code.
- **How it would work:** Intrinsic content hashes identify any file or revision against a universal archive. Oracle strong (hashes).
- **Evidence / numbers:** The archive holds >22B unique files (Dec 2024). SWHID became ISO/IEC 18670 in Apr 2025 **F**. Sources: [iPRES 2017](https://hal.science/hal-01590958); [SWHID ISO announcement](https://openchainproject.org/news/2025/04/29/from-heritage-to-hash-swhid-becomes-a-global-iso-iec-standard).
- **Prior art / who has it:** Software Heritage (Di Cosmo & Zacchiroli, launched 2016) does it itself.
- **Verdict:** KILLED. It works but stays academic and archival, and the buyer is weak. Superhuman test: neutral.

#### Issue de-duplication and triage (Runeson et al., ICSE 2007)
- **What:** Automatically detect duplicate bug reports and triage incoming issues as agents file more of them.
- **How it would work:** Similarity detection over issue text (the 2007 approach), which LLM triage now subsumes. Oracle weak.
- **Evidence / numbers:** GitHub started restricting issue creation (Jun 30, 2026), choosing to gate issues rather than triage them **F** ([VS Magazine](https://visualstudiomagazine.com/articles/2026/06/30/github-extends-contribution-controls-from-prs-to-issues.aspx)).
- **Prior art / who has it:** Runeson et al. (ICSE 2007); LLM triage everywhere.
- **Verdict:** KILLED. Obsolete: LLM triage subsumes it and GitHub gates issues instead.

#### Rejected in this report
- **Server-side VCS / virtual FS (Piper, CitC, EdenFS, Scalar)** — eight or more teams are already rebuilding it, two with fresh funding.
- **Agent-maintained Bazel/Nix** — the flip is already happening (Anchorage, any2bazel, Fuchsia BEADS).
- **Traced deps / regression test selection** — vendors cover it, and Anchorage measured only 1.6 s/PR saved.
- **Graph-partitioned speculative queues (Zuul/SubmitQueue)** — shipped by Trunk, Aviator and Mergify.
- **Stacked diffs (Gerrit/Phabricator)** — GitHub and Graphite/Cursor shipped it in 2025–26.
- **Patch theory / structural merge (Darcs/Pijul/Mergiraf)** — LLMs resolve conflicts better, and semantic interference is rare in practice.
- **CRDT/operation VCS** — Zed DeltaDB is doing it, with an unclear buyer.
- **Software Heritage / SWHID for agent provenance** — done by SWH, no buyer.
- **Issue dedup** — LLM triage and GitHub's gating took it.

### 06-giants: Giants — what the great computer scientists left unfinished, and what 2026 changes
The lens is people: unfinished ideas from great computer scientists, read through both the graveyard lens (A) and the "needed more than ever" lens (B). The organising rule is Lampson's 1983 hint: a hint "may be wrong", so "it is checked against the 'truth'". Model output is a hint, so old ideas flip where a cheap truth exists to check it against. Pike's 2000 admission that "90-95% of the work in Plan 9" went to honouring external standards explains why lean systems died: compatibility labour, which agents now absorb. The ripest revivals (Lamport/TLA+, Hoare's verifying compiler) are already being done well by others. The ONE bet is the Kay–Wirth "shrink loop" gated by Liskov substitution: agents rewrite a system to minimum size while staying byte-identical on a held-out corpus. Verdict: go, with an explicit kill test.

#### Lampson's hint rule (framing for the whole round)
- **What:** Lampson, *Hints for Computer System Design* (1983, §3): a hint is a saved result that "may be wrong", so "there must be a way to check its correctness before taking any unrecoverable action. It is checked against the 'truth'". Model output is a hint in this sense.
- **How it would work:** used as the selection rule. Old ideas flip exactly where a cheap "truth" (oracle) exists, e.g. GrowOS's Linux oracle. Also "Plan to throw one away; you will anyhow": with agents, throwing away a thousand drafts is cheap. Hamming's "reasonable attack" (1986) supplies the ranking rule, and Pike's 90–95% standards-labour figure supplies the Lens A thesis.
- **Evidence / numbers:** Lampson quote checked against the PDF **F**; Pike, *Systems Software Research is Irrelevant* (2000-02-21), "90-95% of the work in Plan 9 was directly or indirectly to honor externally imposed standards" **F**. Sources: https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/acrobat-17.pdf · https://doc.cat-v.org/bell_labs/utah2000/utah2000.html
- **Prior art / who has it:** Lampson, Pike, Hamming (framing).
- **Verdict:** framing, not a bet. It is the report's lens.

#### Kay–Wirth lean systems (STEPS), revived as an agent compression loop
- **What:** STEPS (VPRI, NSF grant 0639876, 2006–2012) set a 20,000-line budget for personal computing "from the end-user down to the metal", 3–4 orders of magnitude less code than usual. Wirth's *A Plea for Lean Software* (1995, Reiser's law) and Hoare's "make it so simple that there are obviously no deficiencies" (1980) made the same case. The revival points agents at minimising *size* rather than adding code.
- **How it would work:** take the GrowOS loop and invert the gate: fault → shrink proposal → differential test → accept only if the size metric drops and every visible and held-out case stays byte-identical. Size = zstd-compressed source bytes *including* any DSL implementation, since Kay counted the meta-tools too. A second, hard-to-game metric: the tokens a fresh agent needs to land held-out change requests. Candidate targets: YAML 1.2 (yaml-test-suite plus libyaml differential fuzzing), CommonMark (spec plus cmark), or GrowOS's grown syscall layer against Linux. Measure the baseline with cloc, use the smallest *compliant* human implementation as the bar, and write it in Rust or TS with no Docker.
- **Evidence / numbers:** STEPS's Frank editor, KScript compiler and FRP evaluator came to "about 10,000 lines" versus "over 100 million lines" for a typical desktop OS and suite (VPRI TR-2012-001) **F**. Why it died: STEPS was a "science project" that ended with the grant, Frank never shipped, and Oberon stayed a teaching system **F**. What flipped: Anthropic's 16-agent team built a C compiler (~100k lines) that builds Linux 6.9 on three architectures in ~2 weeks for ~$20k, with GCC as the oracle **F**. Agents produce bloat: FastRender is 1–3M lines and did not compile cleanly (The Register) **F**, and a 2026 Harvard study found agents raise lines of code ~30% while issue resolution "barely moves" **F** (secondary report). seL4 took ~20 person-years (brief's calibration). Code got cheaper to write but not to understand or verify, so size is the cost to minimise **I**. Sources: https://tinlizzie.org/VPRIPapers/tr2012001_steps.pdf · https://www.anthropic.com/engineering/building-c-compiler · https://simonwillison.net/2026/Jan/23/fastrender/
- **Prior art / who has it:** Chisel (Heo et al., CCS 2018): RL-guided debloating against a property test on 13–90 KLOC UNIX utilities **F**, but it removes features rather than preserving all behaviour. C-Reduce / delta debugging keep only a single property. TRIM (2026) minimises agent patches only, by up to 32.9% of the "CodeSlop" **F**. CodeScene's agent refactor did 300k lines for ~$4k **F**, but optimises "code health", not size. The author found nobody running whole-system, behaviour-preserving compression with an oracle (searches only, not a claim to be first).
- **Verdict:** KEPT (#1, the ONE bet; ranked first by opening). Strong oracle, agents push size the wrong way, size compounds into verification, audit and edge costs, and it reuses the GrowOS loop. Value: smaller TCB, "compress, then verify", Workers/edge bundle size and cold start, supply chain. Buyers are security/compliance teams and platform vendors; market size unknown, plausibly a services and tool market rather than a platform **E**. Superhuman test: more valuable, because size still prices auditors, regulators, weaker reviewers, cold starts and attack surface **I**. The risk is that cheap superhuman verification weakens the readability argument **I**.
- **Kill test / first proof:** at an equal pass rate, stop if the compressed version is not ≥3× smaller than the smallest compliant human implementation (DSL counted), or if a fresh agent needs *more* tokens to land 10 held-out change requests on it than on the original. Demo: a live counter of lines and bytes falling while the pass rate stays at 100%. Expert kill reply: "LOC is a vanity metric … STEPS only hit its numbers by hiding complexity in bespoke DSLs."

#### Liskov substitution as the acceptance gate
- **What:** Liskov (1987, *Data Abstraction and Hierarchy*): S may replace T if "for all programs P defined in terms of T, the behavior of P is unchanged when o1 is substituted for o2". Read "all programs P" as the corpus and you get GrowOS's gate.
- **How it would work:** every agent-proposed rewrite is a substitute for the original. It is accepted only if it is behaviour-identical (byte-identical) on visible and held-out corpora, plus fuzzing. The original system is the oracle.
- **Evidence / numbers:** Liskov quote **F**. Oracle rated strong.
- **Prior art / who has it:** GrowOS's own differential gate; differential testing generally.
- **Verdict:** KEPT, as part of #1. It is the gate that makes the shrink loop checkable.

#### Lamport: specs before code, checked against code by trace validation
- **What:** write model-checkable TLA+ specs before or alongside code, now derived by agents from source and checked against the implementation by trace validation.
- **How it would work:** instrument the code and replay its traces through the spec. TLC/Apalache check the model, and trace validation checks conformance.
- **Evidence / numbers:** AWS found TLA+ bugs that needed 35-step traces to reach (Newcombe et al., CACM 2015) **F**. SysMoBench (ICLR 2026): frontier models write syntactically valid TLA+ almost every time, with gaps in conformance and invariants **F**. Specula won the first TLA+ Foundation/NVIDIA GenAI challenge and reports 382 reproducible bugs in 67 projects as of 2026-08-19 **F** (secondary report). Sources: https://www.alphaxiv.org/abs/2607.25333 · https://arxiv.org/abs/2509.23130v2 · https://foundation.tlapl.us/challenge/
- **Prior art / who has it:** Specula (Cheng, Xu, Huang), SysMoBench, the TLA+ Foundation challenge, and Kiro/Spec Kit as informal spec-driven tools. AWS, Azure and MongoDB already pay for this work **I**.
- **Verdict:** KILLED as something to build (rejected list): ripest of all (#1 in the ripeness ranking) but "already taken well". Use it, don't build it. Superhuman test: more valuable, because specs become what humans sign off on **I**.
- **Kill test / first proof:** no separate build. Point Specula at our own TS/Rust services and contribute upstream.

#### Hoare–Dijkstra: the verifying compiler, correctness by construction
- **What:** Hoare's grand challenge (JACM 2003) for a compiler that guarantees correctness before the program runs. Dijkstra: testing shows "the presence of bugs, but never … their absence". EWD667 (1978) on formal texts "ruling out all sorts of nonsense" reads in 2026 as an argument for formal specs *between* prompts and code.
- **How it would work:** the proof checker tolerates a hallucinating model: it rejects any invalid proof and forces the agent to retry (Kleppmann).
- **Evidence / numbers:** Kleppmann 2025-12-08 quote **F**; vericoding benchmark (arXiv 2509.22908) covers Lean, Verus and Dafny **F**. seL4 took ~20 person-years (brief's calibration). Oracle: the strongest of any item (the proof checker). Sources: https://martin.kleppmann.com/2025/12/08/ai-formal-verification.html · https://arxiv.org/pdf/2509.22908
- **Prior art / who has it:** Lean FRO, Harmonic, Verus groups, the vericoding authors, AWS. Crowded.
- **Verdict:** NARROWED. Don't compete head-on; enter via item 1 ("compress first, then verify"), since verification cost grows with code size. Superhuman test: more valuable, and the bottleneck moves entirely to specs.

#### Object capabilities for agents (Dennis–Van Horn, Hardy, Miller)
- **What:** authority travels only with unforgeable references, with no ambient authority (Dennis & Van Horn 1966; Hardy, *The Confused Deputy* 1988; Miller, *Robust Composition* 2006, E, Hardened JavaScript). Miller–Drexler: encapsulation serves "the same crucial function as property rights".
- **How it would work:** prompt injection is treated as a confused-deputy problem at scale. Capability metadata is attached to values, and agents get attenuable credentials.
- **Evidence / numbers:** CaMeL (Google DeepMind, 2025-03-24) solves 77% of AgentDojo tasks "with provable security" against 84% undefended **F**. Cap'n Web (Cloudflare, 2025-09-22) is schemaless ocap RPC for JS under 10 kB **F**. IETF `draft-niyikiza-oauth-attenuating-agent-tokens` (2026-03-16), a WIMSE credential-delegation draft (July 2026), and the OAuth WG recharter with agents in scope (June 2026) **F** (secondary report). Why niche: mainstream stacks shipped ambient authority, retrofitting is a rewrite, and Wei Dai's 2019 thread blames security labour and rewrite cost **F**. Sources: https://simonwillison.net/2025/Apr/11/camel/ · https://github.com/cloudflare/capnweb · https://datatracker.ietf.org/doc/draft-niyikiza-oauth-attenuating-agent-tokens/
- **Prior art / who has it:** CaMeL, Cap'n Web, IETF drafts, E/Hardened JS, Agoric.
- **Verdict:** NARROWED to conserved rights across forks (next entry). Ripeness #4; the blocker is adoption, not labour. Oracle medium (AgentDojo-style attack suites, checkable reference monitors). Superhuman test: more valuable, because a smarter injected model is a better attacker **I**.

#### Conserved capabilities across agent forks (ERTP purses over Cap'n Web)
- **What:** attenuated tokens are *copyable*, so a forked agent duplicates its authority. Miller's answer is conserved, exclusive rights: purses and payments that cannot be duplicated, as in Agoric's ERTP **I** (ERTP spec not re-read this round). This is the earlier round's "conserved mandates across copies".
- **How it would work:** ERTP-style purses over Cap'n Web for agent authority (spend limits, API quotas, data-egress allowances). Each fork gets a split purse, so the total can never exceed the mandate.
- **Evidence / numbers:** none measured yet.
- **Prior art / who has it:** Miller's own work (ERTP, Agoric); IETF attenuating-token drafts and quota servers are the nearest absorbers.
- **Verdict:** RUNNER-UP (#3 of the top 3). Necessary, and the copy problem is real, but it is the closest to being absorbed by IETF drafts plus a quota server.
- **Kill test / first proof:** 100 agent forks with split purses and an injected adversary; measure whether total spend or egress ever exceeds the mandate, compared with bearer-token attenuation. Kill if a quota service with per-fork sub-keys gives the same guarantees at <1 ms added latency, which would make the capability machinery ceremony. Expert reply: "Just keep a central quota server" (Lampson's truth check, which may well be enough).

#### Agoric markets: live auctions for compute inside a fleet (Miller–Drexler 1988)
- **What:** *Markets and Computation* and *Incentive Engineering* (1988): "a software system using market mechanisms". Processor time goes by the escalator auction ("a processor always runs the highest-bidding process"), which reduces to round-robin among initial-strategy bidders.
- **How it would work:** agents with different principals bid for shared tools, APIs and sandboxes. LLM agents can read prices, and payment rails such as x402 exist.
- **Evidence / numbers:** the authors' own caveats: "In small systems, the overhead of accounting and negotiations is unjustified" (§7), and there is "no open-systems language which provides for ownership and trade of basic computational resources" (§4.5) **F**. Why it didn't happen: overhead versus value; programs have one owner (Wei Dai 2019) **F**; de-marketing history: Spawn (1992) became lottery scheduling (OSDI 1994), AWS Spot dropped bidding in Nov 2017, and Solana rent became a refundable deposit **F**; no micropayments and confusing pricing **F**. What flipped: an ACID debit+credit+journal row in SQLite costs 2.9 µs batched / 20.7 µs per commit (M4 Pro) **M**, ~2×10⁻¹⁰ $ at ~$0.04/vCPU-hour **E**, against ~$10⁻³–10⁻¹ per LLM call **E**, so accounting is ~10⁻⁶–10⁻⁹ of the resource **I**; x402 passed ~138M transactions on Base by Q3 2026, 87% under 10¢ (Chainalysis, secondary) **F**. Counter-evidence: TRM Labs puts real agentic x402 volume at ~$5–11k a month, with adjusted dollar volume down ~77% from the Nov 2025 peak **F**; Magentic Marketplace (arXiv 2510.25779) found ~80–100% first-offer acceptance and welfare degrading with market size **F**; *Virtual Agent Economies* (arXiv 2509.10147) argues for designed sandbox economies (position paper) **F**; the Token Budgets paper (63 overrun incidents) proposes affine-typed budget pools, not auctions **F**. Sources: https://papers.agoric.com/papers/markets-and-computation-agoric-open-systems/full-text/ · https://www.lesswrong.com/posts/5XzQQHwYtSgrATzMC/why-didn-t-agoric-computing-become-popular · https://arxiv.org/html/2510.25779v1
- **Prior art / who has it:** Spawn, lottery scheduling, AWS Spot, Solana, x402, Agora (arXiv 2607.09600, auctions for task allocation) **F**, DeepMind position paper.
- **Verdict:** KILLED for live auctions inside a fleet (rejected list): four decades of de-marketing plus current first-proposal bias. Prediction: inside one principal's fleet, tickets, quotas and budgets win; markets win only *across* principals **I**. Oracle weak to medium. Superhuman test: more valuable **I**. Ripeness #5.

#### Agoric rent and retainer GC for agent artifacts
- **What:** the Miller–Drexler "market sweep" GC: landlords charge rent for storage, objects that don't pay are evicted (garbage collected), and objects "needed but rarely used" survive by charging clients retainer fees (§1.3, §3.2). Applied to agent artifacts nobody owns the deletion of: sandboxes, VM/heap snapshots, branches, preview deploys, prefix/KV caches, forked prefixes. A TTL guesses wrong both ways.
- **How it would work:** each artifact pays rent from the budget of whoever *references* it. An artifact nobody references can't collect retainer fees and is evicted.
- **Evidence / numbers:** the economics inverted, since accounting costs ~10⁻⁶–10⁻⁹ of the resource (**M**/**E**, see above). The authors admit market GC is "substantially more expensive than typical garbage collection algorithms" (§3.3) **F**.
- **Prior art / who has it:** Miller–Drexler 1988; TTL and LRU as the baselines.
- **Verdict:** RUNNER-UP (#2 of the top 3). The one concrete Miller–Drexler mechanism whose economics clearly inverted, but the oracle is weak and brute-force TTLs may win (Lampson: "When in doubt, use brute force" **F**).
- **Kill test / first proof:** a TS library plus a simulator comparing total cost (storage rent plus re-creation cost) against TTL and LRU, on our snapshot/fork logs and Anthropic-style 5-minute/1-hour cache tiers. Kill if it doesn't beat a tuned TTL+LRU by ≥20% total cost on real traces. Expert reply: "reference counting with extra steps and a currency nobody wants to manage."

#### Plan 9 per-process namespaces for agents (Pike et al.)
- **What:** "a per-process name space and a simple message-oriented file system protocol" (*The Use of Name Spaces in Plan 9*), giving each agent its own composed view of the world, since agents are best at files and shell.
- **How it would work:** per-agent copy-on-write overlays and file trees; the leftover idea is "MCP as a 9P tree", since MCP reinvented RPC where Plan 9 would have used a file tree **I**.
- **Evidence / numbers:** partially won already: Linux mount namespaces (descended from rfork) underpin every container, and 9P survives in WSL2 and gVisor's gofer **I**. Turso's AgentFS (2025) gives each session a SQLite-backed COW overlay with a tool-call audit log **F**. Source: https://turso.tech/blog/agentfs
- **Prior art / who has it:** containers, AgentFS, WSL2, gVisor.
- **Verdict:** KILLED. Mostly absorbed; the leftover is a weekend hack, not a bet. Oracle weak (agent task success rate); superhuman test neutral. Ripeness #6.

#### Nelson: transclusion, two-way links, transcopyright, provenance
- **What:** *Xanalogical Structure, Needed Now More than Ever* (1999): deep links, transclusion as "visible re-use", deep versioning, and a copyright scheme where the quote stays bound to its source. The Web "vastly but incorrectly simplifies" this into "fragile ever-breaking one-way links" **F**.
- **How it would work:** LLM answers are transclusion without provenance; attribution plus payment to sources.
- **Evidence / numbers:** ProRata/Gist pays publishers 50% of ad revenue in proportion to attributed contribution, with 500+ publishers by mid 2025 (company figures) **F**. Cloudflare pay-per-crawl and RSL (2025) cited from memory, not re-verified. Why it died: engineering never converged (Xanadu, 1960–) and the one-way Web won. Source: https://www.businesswire.com/news/home/20250606852177/en/ProRata-AI-Signs-Partnerships-With-More-Than-500-Publications-Giving-Gist.ai-One-of-the-Largest-Licensed-Content-Libraries-in-Generative-AI-Search
- **Prior art / who has it:** ProRata/Gist, Cloudflare pay-per-crawl, RSL.
- **Verdict:** KILLED. Real demand, but a weak oracle (attribution of a generated sentence is itself inference) and well-funded incumbents. Not for a single engineer. Superhuman test: more valuable but less checkable. Ripeness #7.

#### Gray: transactions and sagas for agent actions
- **What:** atomic, durable, isolated actions, with compensation for long-lived ones (*The Transaction Concept*, VLDB 1981; sagas, Garcia-Molina & Salem 1987), applied to agents taking irreversible real-world actions.
- **How it would work:** agent steps run as saga steps with compensating actions; durable execution underneath.
- **Evidence / numbers:** SagaLLM (PVLDB 2025) and Robust Agent Compensation (2026) cover agent sagas **F**. Sources: https://arxiv.org/abs/2503.11951v3 · https://arxiv.org/pdf/2605.03409
- **Prior art / who has it:** SagaLLM, RAC, Temporal, Restate.
- **Verdict:** KILLED. Gray's ideas are being revived by others, competently. Oracle medium; superhuman test neutral. Ripeness #8.

#### Gray: the 5-minute rule for KV caches
- **What:** keep data in memory if it is re-referenced within ~5 minutes (Gray & Putzolu 1987), applied to the memory-versus-recompute trade of LLM KV caches.
- **How it would work:** break-even analysis between cache residency and recomputing the prefix.
- **Evidence / numbers:** applied to LLM KV caches in arXiv 2411.07447 (Nov 2024) **F**; prompt caching ships as 5-minute and 1-hour tiers **F**. Source: https://arxiv.org/pdf/2411.07447
- **Prior art / who has it:** arXiv 2411.07447, provider prompt-cache tiers.
- **Verdict:** KILLED. Already done and shipped.

#### Hewitt–Armstrong: actors and let it crash
- **What:** Hewitt's *A Universal Modular ACTOR Formalism for Artificial Intelligence* (IJCAI 1973) **F**; Armstrong's thesis (2003) adds supervision trees: restart, don't repair.
- **How it would work:** agents as supervised actors, restarting from checkpoints. Footnote on Gray's 1985 Heisenbug finding: agent failures are mostly Heisenbugs, so restarting from a checkpoint is the right default **I**.
- **Evidence / numbers:** no figures; fate stated as "won" **I**.
- **Prior art / who has it:** Durable Objects and Cloudflare's Agents SDK, Orleans virtual actors, Temporal.
- **Verdict:** KILLED. It already happened; it is the substrate. Ripeness #9.

#### Knuth: literate programming
- **What:** "let us concentrate rather on explaining to human beings what we want a computer to do" (*Literate Programming*, 1984) **F**.
- **How it would work:** prose generated alongside code by models, now that prose is free. It died because of the dual maintenance burden, and because programmers don't write prose.
- **Evidence / numbers:** DeepWiki turns any repo into a wiki in 30 seconds to minutes **F**. Source: https://docs.devin.ai/work-with-devin/deepwiki
- **Prior art / who has it:** DeepWiki and similar.
- **Verdict:** KILLED. Absorbed, and it gets *less* valuable under the superhuman test as the model becomes the reader **I**. Ripeness #10.

#### Bush, Licklider, Engelbart, Victor: symbiosis, trails, bootstrapping, immediate connection
- **What:** Bush (1945) associative "trails" and "trail blazers" **F**; Licklider (1960): "About 85 per cent of my 'thinking' time was spent getting into a position to think" **F**, the 85% agents absorb; Engelbart's bootstrapping (improving the improvement process), today AlphaEvolve and Darwin Gödel Machine-style work **I**; Victor (2012): "creators need an immediate connection" **F**, today artifacts and live previews.
- **How it would work:** interface and human-augmentation ideas; no mechanism proposed.
- **Evidence / numbers:** quotes only. Source: https://groups.csail.mit.edu/medg/people/psz/Licklider.html
- **Prior art / who has it:** everyone (AlphaEvolve, DGM, artifacts, live previews).
- **Verdict:** KILLED, kept as framing only. No oracle, and all heavily pursued. Ripeness #11.

#### Licklider's "What language do you speak?" (capability negotiation)
- **What:** Licklider's 1963-04-23 Intergalactic memo: networked centers must "agree upon some language or, at least, upon some conventions for asking such questions as 'What language do you speak?'" **F**.
- **How it would work:** this is MCP/A2A capability negotiation, 62 years early.
- **Evidence / numbers:** memo quote **F**. Source: https://www.thekurzweillibrary.com/memorandum-for-members-and-affiliates-of-the-intergalactic-computer-network
- **Prior art / who has it:** MCP, A2A.
- **Verdict:** KILLED. Already built.

#### Lampson: confinement (an anti-flip)
- **What:** *A Note on the Confinement Problem* (1973): a program must be unable to leak information except to its caller, and covert channels make that hard in principle **F** (thesis from memory). The "lethal trifecta" of prompt-injection exfiltration is the confinement problem.
- **How it would work:** no flip. The practical answers are narrowing authority (item 4) and narrowing egress.
- **Evidence / numbers:** attribution correction: "another level of indirection" is Wheeler's; Lampson's 1992 Turing lecture credits David Wheeler **F**. Source: https://en.wikipedia.org/wiki/Fundamental_theorem_of_software_engineering
- **Prior art / who has it:** none named.
- **Verdict:** KILLED as a flip. Needed more than ever, but the obstacle is information theory, not labour, so agents don't flip it. Ripeness #12 ("no, inherent").

#### Ripeness ranking (has the blocker actually gone?)
- **What:** a 12-row table scoring each idea by lens, whether the blocker is gone, oracle, superhuman test, whether it is already taken, and the opening for one engineer.
- **How it would work:** ripeness ≠ opportunity. Order: 1 Lamport specs + trace validation (blocker gone yes, oracle strong, ↑, taken by Specula, "use it"); 2 Hoare/Dijkstra verifying compiler (mostly, strongest, ↑, crowded, "via #3"); 3 Kay/Wirth/Hoare lean systems + Liskov gate (yes, strong, ↑, partial/debloating only, **high**); 4 object capabilities (n/a adoption, medium, ↑, CaMeL/Cap'n Web/IETF, narrow: conserved rights across forks); 5 agoric markets (partly, weak–medium, ↑, position papers/x402, narrow: rent/retainer GC); 6 Plan 9 namespaces (yes, weak, =, AgentFS/containers, low); 7 Nelson transclusion (no, oracle; weak; ↑ but unchecked; ProRata; low); 8 Gray (yes, medium, =, SagaLLM/KV caching, none); 9 actors (done, —, =, DO/Temporal, none); 10 Knuth (yes, weak, ↓, DeepWiki, none); 11 Bush/Licklider/Engelbart/Victor (—, none, =, everyone, framing only); 12 Lampson confinement (no, inherent; —; ↑; —; anti-flip).
- **Evidence / numbers:** as in the individual entries.
- **Prior art / who has it:** see the "Already taken?" column.
- **Verdict:** the top 3 by *opening* are 1) Kay–Wirth compression under a Liskov gate, 2) agoric rent/retainer GC, 3) conserved capabilities across forks (ERTP over Cap'n Web).

#### Rejected in this report
- **Literate programming (Knuth)** — DeepWiki-class tools absorbed it, and it gets less valuable as models become the readers.
- **Actors / let it crash (Hewitt, Armstrong)** — already the substrate (Durable Objects, Orleans, Temporal).
- **Sagas / 5-minute rule (Gray)** — SagaLLM, RAC and KV-cache break-even work, plus shipped cache tiers.
- **Plan 9 namespaces** — containers plus AgentFS; the rest is a weekend hack.
- **Xanadu transclusion (Nelson)** — demand is real, but attribution has no strong oracle and incumbents are funded.
- **Live auctions inside a fleet (agoric scheduling)** — four decades of de-marketing evidence, and current agents show first-proposal bias.
- **Confinement (Lampson 1973)** — inherent covert channels, not labour; agents don't flip it.
- **Symbiosis, trails, bootstrapping, live programming (Licklider, Bush, Engelbart, Victor)** — no oracle, and everyone is building them; kept only as framing.
- **Licklider's "What language do you speak?"** — built (MCP/A2A).
- **TLA+ revival (Lamport)** — ripest of all, but Specula already does it well; use it rather than build it.
