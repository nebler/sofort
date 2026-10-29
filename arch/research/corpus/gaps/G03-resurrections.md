# G03 — Resurrections: every killed idea, re-run through the tailwind filter (2026-10-29)

**Assignment.** Rounds 1–12 killed ideas with filters that round 13 dropped or changed. This report lists every distinct
killed or parked idea I could find, re-runs each one through the round-13 filter (`../BRIEF-tailwind.md`, unchanged in
`../BRIEF-gaps.md`), re-checks the "already taken" deaths against 2026 activity, and develops the strongest
resurrections in the grow → oracle → ratchet form.

**Labels.**
- **Q**: quoted;
- **F**: sourced;
- **I**: inference;
- **E**: estimate.

"Checked" means I opened the source myself on 2026-10-29.

**How the inventory was built.**
- **My own reading:** `../../RESEARCH-SUMMARY.md` (§0–16), A09's 131-row audit, `flip/04-broad.md`'s 25-idea sorting
  table, `flip2/06-sweep.md` in full, and `stack/` and `connect26/SUMMARY.md`.
- **Four parallel extraction passes** (reading helpers, no writing):
  - catalogue R1–R5;
  - catalogue R6–R9 (with R1–R5, that is the catalogue's 1,109 entries plus 362 rejected one-liners);
  - `stack/`, `connect26/` and the side folders (`cloudflare-goose/`, `primitive/`, `portability/`, `next/`,
    `podcast/`, `product/`, `pitch/`, and the top-level notes);
  - `synthesis/S01–S07` and `ambition/A01–A08`, plus the round-13 cut lists.

  Each helper returned rows with `file:line` anchors, 1,364 raw rows in all. I merged and deduplicated them into the
  468 rows of §3, folding the "occupied" one-liners into one group row per report. The full ledgers, with every line
  anchor, came back to me in the session, and I spot-checked the rows that matter for a verdict against the source.

---

## 1. What changed in the filter, and what that frees

| Old filter (rounds 1–12) | Where it killed | Round-13 filter | What that frees, and what it doesn't |
|---|---|---|---|
| **100–1000× ambition** (A09: "Product/Tool rung → NO") | Nearly every tool-sized finalist from rounds 6–12 | **About 10×**: "very ambitious for one person" | Frees deep, solo-sized artifacts. It does *not* free tools whose whole value is code a model can write. |
| **One-shot test read as "the value must be non-code"** (data, people, institutions) | All tools; pushed survivors into commons and registries | **One-shot test:** the accumulated grown artifact, the structure and the check count as value | Frees *grown catalogues checked against an oracle* (a kernel's syscalls, a library's boxes, a language's lexers). Still kills fixtures, wrappers and harnesses. |
| **Needs users / demand evidence** ("niche market", "demand inferred", "tiny buyer") | Protocol learning, RLBox, OpenZL, Rubi, verified numerics | **Clear value, no users needed** | Frees ideas killed only by market size. |
| **Needs community / an institution** (B01–B20) | The 20 A09 survivors | **Solo**: no partners, participants or private data | Kills the commons **again**. Their solo kernels mostly turn back into the small tools A09 already rejected. |
| **Stack-native**: Cloudflare/TS-adjacent, "the platform builds it" | Everything non-web from rounds 6–7 after round 8 | **Any language except Python** | Frees compression, C libraries, protocols and lexers. Platform-owned ideas stay dead as TAKEN. |
| **Flip rule, gate 4**: "whoever owns the check wins" | QEC, PLC, zkVM, simulation codes | **Not taken**, checked in 2026 | Frees ideas whose oracle is *public* (a reference implementation, a round-trip, an official lexer). Incumbent-owned oracles stay dead. |
| **"The loop is free; the check is scarce"** (read as a reason to kill) | Every "propose and check" idea in rounds 2–7 | **The check is the builder's contribution** | Reverses the sign. A scarce, hard-to-game check is now the moat, not the objection. |
| **Pre-AI priors**: "missing capabilities aren't missing code", "per-case labour keeps it niche" | Fault-grown Node (round 3), RLBox, SFI, mappers | Dropped | GrowOS disproved the former. Most ideas it killed were later taken by others (Deno), so they stay dead anyway. |

**Kill tests that still apply, and that do most of the killing below:**
- **TAKEN, active in 2026.**
- **Excluded:** GrowOS lineage, the builder-rejected list, and round-13 ideas (T01–T08).
- **Fails tailwind:** the value *is* the code, so the next model writes it.
- **Needs people, devices or private data.**
- **No oracle the agent cannot edit.**
- **A mechanism, not a value.**

---

## 2. Verdict codes used in the table

- **R**: resurrected, developed in §5.
- **P**: passes the new filter; held in reserve (§5.4).
- **T**: stays taken; the taker is active in 2026. §4 lists the re-checks.
- **XG**: GrowOS lineage (kernel/OS growing, driver environments, the STEPS loop, DB personality).
- **XB**: on the builder-rejected list in `BRIEF-tailwind.md`.
- **X13**: already pitched in round 13 (T01–T08 picks and runners-up).
- **Ft**: fails tailwind. A wrapper, fixture, adapter, harness or port whose value is its code; one prompt for the
  next model.
- **Fs**: fails solo / no-users. Needs participants, partners, customers' traffic, physical devices or private data.
- **Fo**: fails oracle. No independent check the agent cannot edit, or the check is gameable or circular.
- **Fv**: a mechanism without a value, or the economics were measured and refuted.
- **Fp**: Python-bound, or physics/capital-bound.

---

## 3. The inventory: every distinct killed or parked idea

**Columns:**
- **Died of** is the reason the round gave.
- **New** is the round-13 verdict code (§2).
- **Why** is the new reason in a few words.

Near-duplicates are merged into one row. A row's anchor is its round folder unless a `file:line` is given.

### 3.1 Rounds 1–5: capsules, moonshots, superhuman critic, teleport (`v8/`, `moonshots/`, `moonshots2/`, `teleport/`)

| # | Idea | From | Died of | New | Why |
|---:|---|---|---|---|---|
| 1 | QuickJS/Wasm heap capsules: snapshot, fork, move | v8/01–06 | Taken (§11) | T | Vercel quickjs-wasi + Workflow, Golem, XS, LangChain quickjs-rs, Weave |
| 2 | Host contract / effect semantics for capsules ("the open gap") | v8 §2 | Mechanism; folded into Workflow engines | Fv | Engines own effect semantics |
| 3 | Agents submit upgrades to running software as checked futures (PJama) | moonshots/01 | Narrowed (critic 3/4/3) | X13 | T05 LiveImage |
| 4 | Executable citations | moonshots/01 | Narrowed (3/2/4) | XB | Executable scientific record |
| 5 | Telescript-style visiting computation | moonshots/01 | Mechanism | Fv | Code Mode / Workers already move code to data |
| 6 | Immune repair colonies | moonshots/02 | Narrowed (2/3/3) | Fs | Needs live production failures |
| 7 | Programs that co-evolve with their working state | moonshots/02 | Folded | X13 | LiveImage |
| 8 | Failure-search gate: rehearse many futures before one real action | moonshots/03 | "Dies; selective qualification survives" | Ft | A harness; the next model writes it |
| 9 | Exact replay + counterfactual production debugger | moonshots/03; critic "best survivor" 4/4/4 | Dropped; Replay.io, rr/Pernosco | T | Replay vendors; also needs production traffic |
| 10 | Runnable computation receipts / notarised cross-party receipts | moonshots/04; theory | Narrowed; counterparties | Fs | Value needs a counterparty |
| 11 | Conserved authority: cloning a computer must not clone its money | moonshots/04; worsening #3 | Infra | Ft | A broker policy; prompt-sized |
| 12 | One browser continuation → eight branches → downloadable continuation | moonshots/05 | Mechanism | Fv | No value beyond the capsule |
| 13 | Fault-grown Node: treat a missing API as a fault | moonshots/06 | Critic: "missing capabilities aren't missing code" (pre-AI prior) | T | Deno node-compat skill, active (§4) |
| 14 | Oracle Foundry: a factory for acceptance checks | moonshots/07 | Narrowed to one contract family | Fo | A foundry of oracles has no oracle of its own |
| 15 | Fresh failure bank / executable failure capsules | moonshots/07 | Narrowed | Fs | Fresh failures come from users; SWE-bench-style sets exist |
| 16 | Fork swarm | moonshots/05 → critic | Refuted (1/2/4) | Fv | — |
| 17 | "Never pay twice for agent work": reasoning CDN / build system for agent work | moonshots2/01,03 | Builder: "isn't that the provider's cache?" | Fv | Output tokens dominate; cheaper inference erases it |
| 18 | Agent JIT / trace compilation / incremental agents (88.75% of decisions removed) | moonshots2/02 | Taken (§11) | T | Muscle-Mem, PreAct, Agent JIT, SKILL-DISCO, TraceCompiler |
| 19 | Thought Builds (Salsa/Adapton for agent work) | moonshots2/03 | 100× sparse, 0 dense | Fv | Cheaper inference erases it |
| 20 | Origins schedule shared agent work | moonshots2/04 #1 | Taken (§11) | T | Cloudflare Pay Per Crawl / AI Crawl Control |
| 21 | Lifecycle / GC for generated computers | moonshots2/04 #2 | Infra | Ft | Leases; prompt-sized |
| 22 | Visiting compute + a compiler for tool traffic (100–1000× fewer bytes) | moonshots2/05 | Infra | T | Code Mode |
| 23 | Counterparty receipts (theory lens) | moonshots2/06 | Needs counterparties | Fs | — |
| 24 | Teleporting programs for scarce compute | teleport/01 | No GPU capacity added | Fv | Heap carries neither weights nor KV cache |
| 25 | "The job comes to your data" (100–100,000× fewer bytes) | teleport/01,05 | Feature, $0.3–1.2M ARR ceiling | Fv | Pushdown/Code Mode deliver it |
| 26 | Cross-machine contract: home broker owns effects | teleport/03 | Design | Fv | Workflow engines |
| 27 | Immortal / long-running Workers | teleport/06 | Taken (§11) | T | Workflows, Vercel Workflow, Temporal, Inngest, Trigger.dev |
| 28 | Idle agent-fleet hosting | teleport/07 | Taken (§11) | T | DO hibernation, E2B/Daytona/Fly pause |
| 29 | Branching expensive working state | teleport/07 | $313/mo vs $180k/mo inference | Fv | Measured economics |
| 30 | Warm build-state migration | teleport/08 | Taken (§11) | T | BuildBuddy, E2B snapshots |
| 31 | Warm, isolated test worlds for coding agents | teleport/08 | Feature | T | E2B/Daytona snapshots |
| 32 | Seeded-state testing (14/15), forked agent prefixes | teleport/09 | "Useful feature, not a big idea" | Ft | — |
| 33 | Runnable failure specimens / save games for generated code / fork lab | teleport/10 | Feature | Ft | — |
| 34 | Upgrade clinic: migrate live occupied app states, gate one future | moonshots/01 ONE (R2:42) | Critic: "agents keep explicit schemas" | X13 | LiveImage |
| 35 | Visiting agents / executable agreements / agent guilds | moonshots/01, 04 | Host or party participation | Fs | — |
| 36 | NonStop repair: farm of tested candidate recoveries | moonshots/01 | Becomes automated incident repair | Fs | Needs production failures |
| 37 | Personal mainframe / shared computational rooms / planetary continuation exchange | moonshots/01 | Weak demand; Croquet, CRDTs, queues | Fv | — |
| 38 | Computer foundry: agents grow a program's minimal host | moonshots/01 | "Do not duplicate GrowOS" | XG | — |
| 39 | Software ecotypes / endosymbiotic assembly / morphogenetic edge tissue | moonshots/02 | Must beat tuning; analogy fails | Fv | — |
| 40 | Stateful discovery archipelagos (evolve with partial search state) | moonshots/02 #3 | "AlphaEvolve on Workers" | T | AlphaEvolve, OpenEvolve |
| 41 | POET for incidents: co-evolve failure environments and recovery | moonshots/02 | Archive ≠ progress | XB | Agent-era Jepsen family; Antithesis |
| 42 | Recovery spore banks; metabolic discovery commons | moonshots/02 | Feature; reward proxies gamed | Ft | Also Fo |
| 43 | Action compiler: MCTS over live continuations | moonshots/02 #3 | "Stronger single-pass model makes it optional" | Fv | Tailwind runs against it |
| 44 | Time Warp society / speculative interfaces / causal microscope / history telescope / entropy budget / observer lab | moonshots/03 | Runners-up | Fv | Mechanisms; prefetch and replay cover them |
| 45 | Fork firms / executable work orders / spot exchange for in-progress work | moonshots/04 | Fresh tasks simpler; acceptance gamed | Fv | — |
| 46 | Licensed knowledge supply chains with receipts | moonshots/04 | Platform | T | Pay Per Crawl, x402 |
| 47 | Underwrite agent actions; transferable mandates | moonshots/04 | Insurers; export suffices | Fs | — |
| 48 | The computer follows its user / its data; live cells across cities | moonshots/05 | Sync engines; Smart Placement; partitions | Fv | — |
| 49 | Billion sleeping agents; every URL a resumable computer | moonshots/05 | Platform | T | DO hibernation, Cloudflare Computer |
| 50 | Personal device mesh; continuation CDN | moonshots/05 | Wrong buyer; wasted inference | Fv | — |
| 51 | Every capsule carries its grown runtime; Blank OS | moonshots/06 | GrowOS | XG | — |
| 52 | Software rewrites itself toward a held-out oracle, forever | moonshots/06 #2 | Superoptimisation taken; STEPS = GrowOS | T | AlphaEvolve; XG for STEPS |
| 53 | Grow the oracle: agent-probed behavioural map of the ecosystem | moonshots/06 | Demand unvalidated | XB | Package Behavior Atlas |
| 54 | API resurrection from a behavioural fossil | moonshots/06 | "Migration consulting" | X13 | Cutover, Grow-install (T01) |
| 55 | Malleable app grown at the point of use; the grower grows itself | moonshots/06 | Prototypes exist; weak scoreboard | T | Ink & Switch, pi-world, Darwin Gödel Machine |
| 56 | Future Browser: compare executable futures before acting | moonshots/07 #2 | Unobservable state | Fv | — |
| 57 | Capsule Lab: executable notebooks for AI scientists | moonshots/07 #3 | Adoption | Fs | — |
| 58 | Internet Wind Tunnel: branchable API world calibrated to traces | moonshots/07 | World validation dominates | T | StrongDM DTU, Pome, AgentTwin, WebArena |
| 59 | Cybersyn org wind tunnel; Reality Slot; Agent Residency | moonshots/07 | Data partner; instruments; IAM bundling | Fs | — |
| 60 | Speculation Budgeter | moonshots/07 | Crowded | T | Cloud schedulers |
| 61 | Context once (executable map of a recurring world) | moonshots2/01 | "Better models orient in one query" | Ft | — |
| 62 | Yield the accelerator / accelerator valet (park agent, lease KV) | moonshots2/01, 05 | Inference host owns it | T | vLLM, Dynamo, Continuum |
| 63 | Deadline-aware capacity; power-following continuations | moonshots2/01, 05 | Grid contracts | Fs | — |
| 64 | Model-free capsule forge; budget compiler; multi-level IR for agents | moonshots2/02 | Bundle + state suffices | Ft | — |
| 65 | Superoptimizer for agent workflows; Halide for agents; supercompiler | moonshots2/02 | Taken | T | STOKE/egg + LLMs, SKILL-DISCO |
| 66 | System R for intelligence (materialised views over model calls) | moonshots2/03 | Taken | T | Palimpzest, LOTUS |
| 67 | Living spreadsheet of agent observations; scheduler for cognition | moonshots2/03 | Vertical of #1 | Fv | — |
| 68 | Demand paging for context; transaction manager; consensus + CRDTs for agents | moonshots2/03 | Taken | T | MemGPT, PagedAttention, workflow engines |
| 69 | Round-trip compiler; compiler for tool traffic; inference-adjacent tool appliances | moonshots2/04, 05 | Platform; one model call erases it | T | Code Mode, Cap'n Web |
| 70 | Inference refinery; observation capsules; common computation store | moonshots2/04, 06 | Caching erases it | Fv | — |
| 71 | Runtime closure commons (patch shared substrate) | moonshots2/04 | "Most direct GrowOS extension" | XG | — |
| 72 | Fresh evidence exchange / fresh-observation clearinghouse | moonshots2/04, 06 | Source relationships | Fs | — |
| 73 | Tail budget for agent chains; speculate on reads | moonshots2/01, 05 | Feature | Ft | — |
| 74 | Single-address-space internet of capsules | moonshots2/05 | Coherence fails | Fv | — |
| 75 | Precision/placement ladder device → edge → central | moonshots2/05 | Crowded | T | On-device models |
| 76 | Proof-carrying actions; specification escrow; metric-pressure lab | moonshots2/06 | Authorization suffices; judges absorb | Ft | — |
| 77 | Data-local proof capsules; market for accepted progress | moonshots2/06 | Taken | T | Succinct, Boundless |
| 78 | Hybrid device/cloud split | teleport/01 | Inference replaced, not JS moved | T | Transformers.js, Prompt API |
| 79 | Follow the sun / green power; volunteer devices | teleport/01 | Queue + routing wins; untrusted hosts | Fv | Also Fo |
| 80 | Analysis job moves to a private dataset; customer-controlled runner | teleport/05 | Local dispatch wins | Fv | — |
| 81 | Deploy-surviving in-flight work; live migration off a draining machine | teleport/06 | Shared solution | T | Workflows, Temporal, CRIU |
| 82 | Clone a "trained" agent; fleet ops via live movement | teleport/07 | Config/memory export | Fv | — |
| 83 | Warm TS checker per branch; warm bundler graph | teleport/08 | Native TS 7; disk caches | T | TS 7, Turbopack |
| 84 | 13 live-heap use cases (game servers, simulation, notebooks, spreadsheets, edge personalization, offline apps, education, browser automation, backtesting, science workflows, CI controller, interactive fiction, robots) | teleport/09 | Explicit state measured cheaper | Fv | — |
| 85 | 11 wildcards (spores, warm-state grocery, resold computation, paused-program app store, live attachments, URL-as-program, Smalltalk world, Erlang colony, TeaTime universes, HPC miniature, organ transplant) | teleport/10 | Killed by their own critics | Fv | — |
| 86 | About 60 refuted claims ("git for heaps", heap rollback of the world, global atomic transactions, any-city placement, wake < X ms, DO relocation, heap as DRM, signed checkpoints as proof…) | moonshots–teleport rejected lists | Physics / semantics | Fv | Claims, not ideas; listed once |

### 3.2 Round 6: old ideas whose economics flipped (`flip/`)

| # | Idea | From | Died of | New | Why |
|---:|---|---|---|---|---|
| 87 | Grow the environment around unmodified Linux drivers (DDE kits) | flip/01 ONE bet | Parked; GrowOS family | XG | Also XB (driver translation) |
| 88 | Proof-maintained GrowOS handlers | flip/01 §2 | GrowOS | XG | — |
| 89 | ISA ports / instruction selectors grown against executable ISA semantics | flip/01 §3 | Parked | X13 | Lemma (T02); G08 S18–S22 |
| 90 | Certified hot-region binary translation with fallback | flip/01 §4 | "Kill if no customer workload" (users) | T | FEX, Box64, Rosetta; Lemma's shape |
| 91 | Superoptimisation and synthesised compiler rewrites | flip/01 §5 | Taken | T | AlphaEvolve, Souper; Lemma |
| 92 | Partial evaluation / workload-specific specialisation | flip/01 §6 | Parked | X13 | Futamura (T02); Bespoke OLAP |
| 93 | Capability microkernels with generated wiring | flip/01 §7 | OS | XG | — |
| 94 | Dense forkable execution (VM fork, library OS) | flip/01 §8 | Taken | T | E2B, BuildBuddy, Fly |
| 95 | Proof-carrying generated plugins in one process | flip/01 §9 | "Wasm tools for agents occupied" | T | Wassette, Akamai; a typed DSL suffices |
| 96 | Firmware rehosting, peripheral models grown from failures | flip/01 §10 | Parked | T | DevGen (ACL 2026), per G02; the oracle is physical |
| 97 | New unikernel; sandbox cloud; driver synthesis from datasheets | flip/01 rejected | Taken / capital | XG | Also XB |
| 98 | Grow one app's missing DB behaviour against the original server (Babelfish tail) | flip/02 ONE bet | GrowOS family | XG | Also T01 Cutover (X13) |
| 99 | Self-tuning databases | flip/02 | Never died (AutoAdmin 1998) | T | — |
| 100 | Agentic TLA+ / model checking of systems | flip/02 | Taken | T | Specula (249 bugs, 48 systems); also XB (agent-era Jepsen) |
| 101 | COBOL migration | flip/02 | Taken | T | IBM, AWS |
| 102 | Crash-safe cleanup of run resources (leases + distributed GC) | flip/03 ONE bet; §13 #7 | "Fix upstream" | Ft | — |
| 103 | Fair queues; macaroon budget tokens; workflow engines; DST | flip/03 rejected | Taken | T | SatGate, Antithesis and others |
| 104 | **Library sandboxing / SFI by agent (RLBox + untrusted-library oracle)** | flip/04 #1 | §13 "narrow/uncool"; A09 "→ B06" (100×, non-code) | **R** | §5.2 |
| 105 | Rules as code | flip/04 #2 | Institutions | T | PolicyEngine, Axiom, L4, Catala |
| 106 | N-version programming | flip/04 #3 | Correlated failure (Knight–Leveson) | Fo | Model versions correlate even more |
| 107 | Mutation testing | flip/04 #4 | Taken | T | Meta ACH, Google |
| 108 | Property-based testing | flip/04 #5 | Taken | T | Anthropic agentic PBT |
| 109 | Design by contract / dependent types / proofs | flip/04 #6 | Taken | T | Vericoding, AutoVerus, Dafny loops |
| 110 | Expert systems; Cyc | flip/04 #7–8 | Obsoleted | Fv | The model replaces them |
| 111 | Semantic web | flip/04 #9 | Social; obsoleted | Fs | — |
| 112 | High-level synthesis | flip/04 #10 | Taken | T | LAAFD, AMD |
| 113 | Per-workload custom accelerators | flip/04 #11 | Capital | Fp | — |
| 114 | Formal hardware verification (assertions) | flip/04 #12 | Taken | T | ProofLoop, ChatSVA, EDA vendors |
| 115 | Porting Fortran / legacy HPC | flip/04 #13 | Taken | T | LANL, Argonne, LLNL |
| 116 | Computational reproducibility | flip/04 #14 | No incentive | XB | Executable scientific record |
| 117 | Verified numerics (Herbie, FPTaylor) | flip/04 #15 | "Niche demand" (users) | T | CORE-MATH, RLIBM, Sollya, Herbie active |
| 118 | Memory-safe rewrites of C/C++ | flip/04 #16 | Taken | T | DARPA TRACTOR, Fontations |
| 119 | Capability hardware (CHERI) | flip/04 #17 | Hardware | Fp | — |
| 120 | Object capabilities / IFC for agents | flip/04 #18 | Lens B → labelled Code Mode | Ft | See §3.3 |
| 121 | Literate programming; end-user programming; program synthesis | flip/04 #19, #23, #24 | Obsoleted | Fv | — |
| 122 | Model-driven engineering | flip/04 #20 | Social | T | Spec-driven dev (Kiro, Spec Kit) |
| 123 | Structure editors | flip/04 #21 | Humans hate tree editing | Fv | Agents don't type |
| 124 | Smalltalk/Lisp live images | flip/04 #22 | Social | X13 | LiveImage |
| 125 | Accessibility / localisation / API migrations | flip/04 #25 | Taken | T | GitHub, Deque, Moderne |
| 126 | Post-merge integration (land, find culprit, revert) | flip/05 ONE bet; §13 #1 | Withdrawn in round 10 | T | Graft, LUCI, Mogplex, HydraFlow; also Fs |
| 127 | Revert rehearsal (prove the revert fixes the current tip) | stack SUMMARY §1.5 | Narrow remnant | Ft | — |
| 128 | Git storage and serving at agent scale | flip/05 | Taken (§11) | T | Anthropic Scion, Cursor, GitHub, Artifacts and 8+ others |
| 129 | Lampson's hints as a rule | flip/06 | Framing | Fv | A selection rule, not a project |
| 130 | Agoric computing / markets inside a fleet | flip/06 | Markets lose inside one principal | Fv | — |
| 131 | Point the GrowOS loop at compression (Kay's STEPS) | flip/06 ONE bet | GrowOS family | XG | — |
| 132 | Exokernel / KeyKOS / Opal / Singularity / Plan 9 as an agent OS; orthogonal persistence | flip/01 rejected | Not labour-killed | XG | Also Fv |
| 133 | Universal binary recompilation; universal partial evaluator; another verified compiler | flip/01 rejected | Taken | T | DBTs, weval, CompCert, CakeML |
| 134 | Autonomous firmware boot repair | flip/01 rejected | Taken | T | FirmCure, FirmPilot |
| 135 | Active networks / agent-built in-network functions; P4 porting between targets | flip/02 | No driving use case; ASIC timing | Fv | Also Fs (hardware) |
| 136 | Close socket-API gaps in kernel-bypass stacks; fresh user-space TCP | flip/02 | Mature stacks | T | F-Stack, Seastar, Demikernel |
| 137 | RFC → verified implementation of a neglected protocol extension | flip/02 #2 | Low novelty; needs a maintainer | T | Everest, Cryspen/hax, agentic SPARK; G06's ground |
| 138 | Protocol interop adapter / repair factory | flip/02 | Voting doesn't settle blame | Fo | Also T (QUIC Interop Runner, TLS-Anvil) |
| 139 | Agent-grown index/codec/layout for one storage workload | flip/02 | Physics trade-offs | T | ELMo-Tune-V2, StorageXTuner, Bespoke OLAP |
| 140 | Per-app server specialisation | flip/02 | Conditional niche | X13 | Futamura; weval |
| 141 | COBOL/CICS transaction-equivalence capture | flip/02 #3 | Access-constrained | T | IBM watsonx Z, AWS Transform |
| 142 | Another S3-compatible store | flip/02 | Durability engineering | T | Ceph, MinIO, R2 |
| 143 | Root-task reservations; attenuated delegation (macaroons + budgets) | flip/03 | Crowded | T | Temporal, Restate, SatGate, Auth0 |
| 144 | CAS/dedup agent environments; incremental shared context; provider idempotency contracts | flip/03 | Taken | T | Modal, E2B, Materialize, Feldera, DBOS |
| 145 | Artifact lineage with permission/deletion invalidation | flip/03 #3 | Unverifiable capture | Fo | Also T (OpenLineage) |
| 146 | Fault-contract DST suites for agent boundaries | flip/03 | Antithesis harness | XB | Agent-era Jepsen |
| 147 | Whole-job deadlines with hedging; CRDT run documents | flip/03 | Taken; meaning not preserved | T | llm-d; Automerge |
| 148 | Rules-as-code audit (independent statute encoding vs deployed system) | flip/04 kept #2 | Slow institutional buyers | Fs | — |
| 149 | N-agent disagreement as ambiguity detector for draft laws | flip/04 kept #3 | Small market | Fo | Disagreement isn't an oracle |
| 150 | **Agent-grown independent rebuilds of the package long tail** | flip/05 #2 | "Google already does this and says AI rebuilds are next" | T | Google OSS Rebuild ships an LLM rebuild agent (§4 note) |
| 151 | Review early-cutoff (route artifact-identical changes past review) | flip/05 #3 | Modest gap | Ft | — |
| 152 | Hermetic Bazel/Nix by agent; traced test selection; speculative merge queue | flip/05 | Taken | T | any2bazel, Launchable, Trunk, Aviator |
| 153 | Server-side VCS; stacked diffs; op-based/CRDT VCS; SWHID provenance; issue triage | flip/05 | Taken | T | Scion, Graphite, Zed DeltaDB, Software Heritage, GitHub |
| 154 | Patch theory / structural merge for agent conflicts | flip/05 | "Models absorb it" | T | Mergiraf, jj, Pijul |
| 155 | Agent TLA+ trace validation; verifying compiler | flip/06 | Taken | T | Specula; Lean FRO, Verus |
| 156 | Object capabilities for agents; conserved capabilities across forks (ERTP) | flip/06 | Adoption, not labour | T | CaMeL, Cap'n Web, Agoric ERTP, IETF drafts |
| 157 | Agoric rent/retainer GC; transclusion with attribution and payment | flip/06 | Weak oracle | Fo | — |
| 158 | Plan 9 namespaces / MCP as 9P; sagas; five-minute rule for KV; actors for agents; capability negotiation | flip/06 | Taken | T | AgentFS, Temporal, provider cache tiers, DOs, MCP/A2A |
| 159 | Confinement against prompt-injection exfiltration (Lampson) | flip/06 | Covert channels | Fp | Information theory |
| 160 | Bush/Licklider/Engelbart/Victor augmentation ideas | flip/06 | No oracle | Fo | — |

### 3.3 Round 7: AI compute, compilers × Code Mode, the sweep (`flip2/`)

| # | Idea | From | Died of | New | Why |
|---:|---|---|---|---|---|
| 161 | GPU kernel agents | flip2/01 | Taken (§11) | T | NVIDIA, AMD, Meta, Modular, Makora, Alibaba |
| 162 | Maintain one customer's CUDA → AMD operator port | flip2/01 bet | Needs a customer | Fs | Also T (HIPIFY/SCALE/ZLUDA) |
| 163 | Distributed-training ops agents | flip2/02 | Taken (§11) | T | TSGuard, Minerva, AEGIS, ByteCheckpoint |
| 164 | Keep recovery equivalent across training-stack changes | flip2/02 bet | Needs a cluster | Fs | — |
| 165 | LLM proposer + old verifier (CEGIS, egg, Alive2, invariants, decompilation, repair) | flip2/03 | Taken (§11) | T | Direct LLM prior art for each |
| 166 | Maintained translation validation of agent rewrites | flip2/03 bet | Parked | X13 | Lemma, Grow-install |
| 167 | Labelled Code Mode (IFC at every outgoing call) | flip2/04; §13 #4 | "Security tool, not exciting"; A09 "→ B11" | Ft | Runtime feature, prompt-sized for a fixed lattice |
| 168 | Code Mode performance tricks | flip2/04 | Code Mode's own win | T | — |
| 169 | Old numerics revival (NVFP4, MX, Muon, TurboQuant, Ozaki) | flip2/05 | Taken (§11) | T | In production |
| 170 | Evidence gate for agent experiments (64% of kept gains are noise) | flip2/05; §13 #5 | Tool; A09 "→ B02" | Ft | Preregistration + statistics is prompt-sized |
| 171 | LLM heuristic / algorithm discovery as a product | flip2/06 | Commoditised | T | AlphaEvolve GA, OpenEvolve, ADRS |
| 172 | Agent-evolved SAT/SMT solvers | flip2/06 | Taken | T | SATLUTION, LLM2SMT (§4) |
| 173 | Formalising mathematics (QED manifesto) | flip2/06 | Taken | T | Math Inc, Harmonic, DeepMind |
| 174 | AI-verified zkVM circuits | flip2/06 | Taken | T | EF zkEVM FV, Aristotle, zkSecurity |
| 175 | FHE programming agents | flip2/06 | Overhead, not labour | Fp | — |
| 176 | Agent-driven PQC migration | flip2/06 §3.7 | Weak application oracle | Fo | Also T (security vendors) |
| 177 | Key / agent-identity transparency logs | flip2/06 | Alive, never labour-killed | T | CT, CONIKS, Sigstore |
| 178 | LLM relevance assessment for IR | flip2/06 | Circular oracle | Fo | — |
| 179 | Procedural generation / inverse procedural modelling | flip2/06 | VLM-judge oracle | Fo | — |
| 180 | Graphics API layers and drivers grown against Khronos CTS | flip2/06 §3.4 | Round 1's driver bet | XB | Driver translation |
| 181 | LLM reward design / sim-to-real; runtime assurance | flip2/06 | Taken; simulator fidelity | T | NVIDIA Eureka; aerospace |
| 182 | PLC code generation | flip2/06 | Incumbent toolchain | T | LLM4PLC/Agents4PLC/SemaPLC |
| 183 | MMS-gated simulation codes | flip2/06 §3.6 | Taken academically | T | MOOSEnger, RL-with-MMS; G02 covers |
| 184 | Agentic bioinformatics pipelines | flip2/06 | Data access | Fs | Also T (VariantBench, Biomni) |
| 185 | Agentic architecture DSE | flip2/06 | Simulator ≠ silicon | T | gem5 Co-Pilot |
| 186 | Quantum compiler passes; LLM-discovered QEC codes | flip2/06 | Incumbents; 5+ groups | T | IBM, MPI, OmniQEC |
| 187 | **LLM-evolved QEC decoders (Stim oracle)** | flip2/06 §3.2, top 3 | Gate 4: hardware labs own it; Python start | **P** | Reserve (§5.4) |
| 188 | WCET timing models by agents | flip2/06 | Unsound oracle | Fo | — |
| 189 | DO-178C MC/DC test generation | flip2/06 §3.8 | Coverage gameable | Fo | — |
| 190 | Classic CV revival | flip2/06 | Obsoleted | Fv | — |
| 191 | LLM-designed congestion control | flip2/06 | Taken | T | PolicySmith, GenCC |
| 192 | Automated mechanism design | flip2/06 | Intractability | Fp | — |
| 193 | Authored intelligent tutors | flip2/06 | Obsoleted by live tutors | Fv | — |
| 194 | Risch/Rubi integration rule growth | flip2/06 | "Perfect oracle, negligible buyer" (users) | X13 | GrowCAS (T04) |
| 195 | **Agent-grown OpenZL format descriptions** | flip2/06 ONE bet | Never pursued (stack-native, users, Meta risk) | **R** | §5.3 |
| 196 | **Certificate-carrying evolved code** | flip2/06 §3.3, top 3 | "Reads as a feature for AlphaEvolve" | **P** | Reserve (§5.4) |
| 197 | **Protocol model learning with LLM-written mappers** | flip2/06 §3.5 | "Niche security-testing market" (users) | **P** | Reserve (§5.4) |
| 198 | Agents extend kernel generators (PHiPAC/ATLAS); LLM tile guessing | flip2/01 | Commoditised | T | Inductor, Helion, AMD GEAK |
| 199 | Grow FFT codelet vocabularies (FFTW/SPIRAL) | flip2/01 | "No unsupplied FFT market" (users) | T | FFTW, SPIRAL generators |
| 200 | Structure-specialised sparse/ragged kernels; Halide schedules; TVM rules | flip2/01 #2–3 | Owners are the compiler projects | T | Meta KernelEvolve, SparseTIR, Helion, TVM |
| 201 | Polyhedral lifts; STOKE-style PTX search; systolic mapping; tensor-graph rewrites | flip2/01 | Taken | T | PLuTo, Standard Kernel, Pallas, LGuess, EggMind |
| 202 | Independent anti-reward-hacking judge for agent kernels | flip2/01 | Not an empty market | T | SK-Check, KernelBench-Verified |
| 203 | Training incident → minimised reproducer; SDC probes | flip2/02 #2–3 | Needs operator cases | Fs | Also T (TSGuard, AEGIS) |
| 204 | Fail-slow mitigation; elastic runtimes; parallelism repair; collectives; gang scheduling; serving policies | flip2/02 | Taken | T | GREYHOUND, torchft, GSPMD, MSCCL++, Run:ai, vLLM |
| 205 | Agent-maintained cluster simulator | flip2/02 | Not an independent oracle | Fo | — |
| 206 | CEGIS pilot; e-graph rewrite package for an underserved DSL | flip2/03 | Wrapper copyable; no users | T | LLM-CEGIS-Repair, EggMind |
| 207 | Behavioural qualification of decompiled binaries | flip2/03 | Recompilation ≠ behaviour | T | Decompile-Diverge, RevEng.AI |
| 208 | LLM fuzz generators for a new compiler extension | flip2/03 #3 | Gap closed | T | MetaMut, LegoFuzz |
| 209 | Maintained invariant / LiquidHaskell / separation-logic proofs | flip2/03 | Taken | T | LOOPY, LEMUR, LHC, Spec-Agent |
| 210 | Precise third-party type stubs for a dynamic framework | flip2/03 #2 | Weak oracle; Python | Fp | — |
| 211 | Guarded parallel fast paths; attribute-grammar frontends; backport repair | flip2/03 | Taken | T | AutoParLLM, ChopChop, CodeMender |
| 212 | Code Mode optimisations: auto-batching, predicate pushdown, speculative pre-execution, plan-time staging, static cost bounds, symbolic pre-run, record/replay | flip2/04 | Code Mode's own win or taken | T | Cap'n Web, CaMeL, CaMeLoT, agentrr |
| 213 | Backward slicing "why did the agent do that?" from host handles | flip2/04 #2 | Observability vendors | Fs | — |
| 214 | tsc pre-check of generated programs; an agent DSL per task family | flip2/04 | "A 50-line feature"; models worse on DSLs | Ft | — |
| 215 | Agent-drafted tool contracts with blame assignment | flip2/04 #3 | Published | T | Symbolic Constraint Agents |
| 216 | Higham-bound precision-contract numerics oracle; shadow-precision root-causing | flip2/05 #2 | "A feature, not a company" | XB | Cross-GPU numerical atlas family |
| 217 | Training-data lineage with deletion by construction | flip2/05 #3 | Nobody retrains for a deletion | Fs | — |
| 218 | 18 numerics/data revivals (ABFT, bitwise parity, MX/posits, VQ, Ozaki, Muon, MinHash, LSH, interval bounds, arithmetic coding, HLL, suffix arrays, Monarch, RevNets, revolve, curricula, BO) | flip2/05 | Harvested or refuted | T | §11 |

### 3.4 Rounds 8–9: the split agent and the deep TypeScript/Cloudflare round (`split/`, `deep/`)

| # | Idea | From | Died of | New | Why |
|---:|---|---|---|---|---|
| 219 | Split agent: unmodified Pi in Worker + DO, grown Node, on-demand hands, 10–50× cheaper | split/ | Taken; 4–24× measured | T | Cloudflare Computer, pi-durable, PiHarness |
| 220 | Brain on a Durable Object with "free model waiting" | split/03 | DO can't sleep on an open stream | Fv | Measured |
| 221 | Agent-grown Node compatibility in workerd ("GrowOS for JS runtimes") | split/02 | Taken (§11) | T | Deno node-compat skill (§4); also XG-shaped |
| 222 | Headless Pi SDK + workerd adapters | split/02 | Weak value | T | Pi Cloudflare Code Mode adapter |
| 223 | TypeScript shell (just-bash) for simple commands | split/01 | 0.2–0.3% of command-seconds | Fv | Also T (Vercel just-bash) |
| 224 | Grow jitk into a general dev Linux (bash, git, node) | split/04 | OS project of unknown length | XG | — |
| 225 | Hands: tested TS command subset + warm Linux runner per burst | split/04 | Taken | T | Computer, Sprites, E2B |
| 226 | Workspace data plane: DO manifest + journal + CAS + cached overlay | split/05 | Taken | T | Computer, ArtifactFS |
| 227 | Per-syscall remote FS over a DO bridge; whole-dependency sync per command | split/05 | 50–500 s metadata latency | Fv | Measured |
| 228 | Pinned Pi CLI surviving eviction (billing demo) | split/06 | Thin ceiling | Fv | — |
| 229 | 12 pain-mined fixtures (reconnect/reset pack, resolution witness, RSC cache microscope, packed-consumer fixtures, diagnostic debt ledger, JSON declaration mapper, TS 7 transform host, N-API workbench, provenance diff, clock adapter, remote HMR fixture, request-cost artifact) | deep/01 | "An afternoon"; owned | Ft | Most are also T |
| 230 | Copy-on-write SQLite/D1 fork per agent attempt | deep/02 #2 | D1 fork planned | T | Neon, Turso, D1 roadmap |
| 231 | 12 primitive combinations (versioned running app, browser-as-hands, code-to-data, website→tool compiler, git for swarms, x402 budgets, Iceberg in tab, multi-device sessions, on-device inference via DO, edge typecheck, pre-run type checks, e2e fleets) | deep/02 | 12 of 16 taken | T | Replit, Stagehand, Cursor, DuckDB, Electric, VoidZero |
| 232 | Third-party WebMCP injection | deep/02 | Blocked by spec | Fv | — |
| 233 | New durable effect-typed agent language ("Await"); pause-at-any-await pass; content-addressed TS; typed holes | deep/03 | Taken | T | Unison, Golem, Zapcode, Monty, Hazel |
| 234 | Effect-manifest pass + batched approval | deep/03 | Builder passed (≈ labelled Code Mode) | Ft | — |
| 235 | Durable-dialect tsc checker; crash-at-every-await testing | deep/03 #3 | "Platforms would write it in a week" | T | Temporal workflowcheck |
| 236 | Choreographic Code Mode across browser + Worker + DO | deep/03 #2 | "The model writes two programs and an RPC" | Ft | — |
| 237 | LLM-native compiler diagnostics | deep/03 | "Better models need it less" | Fv | Anti-tailwind |
| 238 | Replay receipts ("cheap to verify") | deep/03 | Generic verification killed | Fo | — |
| 239 | Partial-clone Git over DO/R2; seekable PDF ops on R2; bounded FFprobe over R2 | deep/04 #2–3 | Existing libraries | T | isomorphic-git, PDF.js, libav.js |
| 240 | 14 engine ports into Workers (Postgres per DO, JS build system, TS 7 per DO, Oxc toolbox, tree-sitter, ripgrep, Office→PDF, small-model inference, SQLite extensions, Typst, Git forge, DuckDB, Pyodide, ImageMagick) | deep/04 | "Every famous engine has a Wasm port" | T | PGlite, worker-bundler, web-tree-sitter, typst.ts, ducklings |
| 241 | Web for agents: delegated auth, identity SDK, payments, agent-readable sites, MCP registry, inboxes, browser automation, agent analytics | deep/05 | Platforms bundle it | T | Auth0, Web Bot Auth, x402/AP2, AgentMail, Stagehand |
| 242 | Replayable MCP Events store; site-owned effect reconciliation | deep/05 #2–3 | Upstream absorption; exists in Python | T | Hookdeck, Svix, effect-broker |
| 243 | Legitimate-agent CAPTCHA lane; cross-provider activity receipts; A2A↔MCP bridge | deep/05 | Permission; signatures ≠ work; semantics differ | Fs | Also Fo/Fv |
| 244 | Absorb: owned code replacing tiny deps, differential-fuzzed | deep/06 #3 | "Fixable by an AGENTS.md line" | X13 | Grow-install (T01) |
| 245 | Preview data overlays; shared type-check cache; install firewall; hallucinated-package guard; Vitest TIA; span→trace join; publish monitor; codemod fleet; R2 build cache | deep/06 | Owned | T | Neon, Nx, Socket, Aikido, Vitest, Entire, codemod.com |
| 246 | Per-package isolates; distributed tsgo across 1,000 Workers | deep/06 | RPC cost; a 16-core box wins | Fv | Measured |

### 3.5 Rounds 10–11: the stack round and Connect 2026 (`stack/`, `connect26/`)

| # | Idea | From | Died of | New | Why |
|---:|---|---|---|---|---|
| 247 | Converter Witness (Zigbee device traffic → converter regressions) | stack/01 | Demand; owner may absorb | Fs | Needs devices; near XB (hardware traces) |
| 248 | Remote lifetime scopes (leases, epochs for async jobs) | stack/02 | "TTL may suffice" | Ft | — |
| 249 | Command-law gate / Causal Command Diff / Command Diff | stack/03,05,10 | Foldkit #622/#626 | T | Upstream roadmap |
| 250 | LiveStore upgrade rehearsal | stack/04 | May reduce to a recipe | Ft | — |
| 251 | Browser handoff corpus | stack/06 | Trivial Playwright | XB | Divergence-map family |
| 252 | Alchemy Recovery Lab | stack/07 | Sieve, Faultline; Alchemy tests | Ft | — |
| 253 | Pi lifecycle conformance | stack/08 | Contribution only | Ft | — |
| 254 | Feature-collision workbench | stack/09 | Low demand | Ft | Real collisions need real users (Fs) |
| 255 | RigorBench (does rigor help agents?) | stack/10; stack #1 | Benchmark upkeep; A09 "→ B02" | Fo | Self-generated tasks aren't an independent endpoint |
| 256 | Generated UI / per-app DBs / extensions / skills / TLA+ / DST for TS | stack §1.2 | Taken | T | genUI, DO Facets, Pi, bb, Val Town, Stately |
| 257 | Tool makers (LATM, Voyager, selfMCP, BabyAGI, ToolMaker) | stack §4 | Taken | T | — |
| 258 | 75k agents on a Raspberry Pi (Infinity) | stack §5 | Extrapolation refuted | Fv | — |
| 259 | Mixed-version DO identity / migration rehearsal | connect26/02 | A09: "a newer model one-shot the fix" | Ft | The brief's own warning case |
| 260 | Passive hibernation-eligibility assertions | connect26/03 | Platform owns the hook | T | Cloudflare roadmap |
| 261 | Cache-aware tenant Cutover Witness | connect26/04 | No shared asset | Fs | Fleet observations |
| 262 | Sampling / exactness witness | connect26/05 | Checker is code | Ft | — |
| 263 | Business-action conformance fixtures | connect26/01 | Integration | Ft | — |
| 264 | Combined Workers transition harness | connect26 §2 | Five pains ≠ one platform | XB | Agent-era Jepsen family |
| 265 | Agent-web stack, Postcept, agent hosting, DO files/tracing, agent git hosting, AI review, rollout, classifiers | connect26 §1.4 | Taken | T | Cloudflare and vendors |
| 266 | USB-serial witness packs; BootDiff waveform diff per firmware PR | stack/01 runners-up | Thin gap | Fs | Devices; near XB |
| 267 | Silicon-vs-datasheet register probes (executable datasheets) | stack/01 | Generator taken; execution remains | Fs | Needs boards; an atlas (XB family) |
| 268 | 16 hardware one-liners (agent Verilog, SVA, Chisel, HLS pragmas, datasheet→driver, register generators, peripheral growth, device schemas, USB/HID replay, Saleae analyzers, firmware bench, MCU state machines, robot skills, OTA campaigns, TSX circuits, WebGPU kernels) | stack/01 rejected | Occupied | T | FormalRTL, ProofLoop, LAAFD, Termite-2, svd2rust, Fuzzware, umockdev |
| 269 | Payload-aware Command replay; extension teardown qualification | stack/02 runners-up | Demand; upstream work | T | Foldkit, bb |
| 270 | 16 runtime one-liners (TS Infinity, priority scheduler, TS OTP, Effect race scheduler, concurrency hunter, Wasm plugins, budgets, host-API growth, JS replay runtime, hot actor swap, plugin rollback, Effect diff, inspectors…) | stack/02 rejected | Occupied | T | Temporal, Orleans, Extism, SatGate, Deno, Golem, bb |
| 271 | Effect service types as permissions; obligation memory outside compaction | stack/02 | Types miss ambient effects | Fv | — |
| 272 | DSL-clause audit; agent-grown macros under a fixed contract | stack/03 runners-up | Upstream regression work | Ft | Also T (syntax-spec, CEL) |
| 273 | 17 language one-liners (formal-contract diffs, vacuous-spec detector, refinement language, TS vs Zod via Z3, session types, typestate, architecture rules, proof maintenance, TLA+/Quint bridge, contracts, spec synthesis, UI catalogs, TS→Wasm plugins, macros, Foldkit linter, evidence platform) | stack/03 rejected | Occupied | T | FSL, MutDafny, Theorem, llmcontract, TSArch, AutoVerus, Specula, Arkhe |
| 274 | Data-order diagnostic; app remixes sharing records via lenses | stack/04 runners-up | Gap 2; Jazz | T | Drizzle, Dolt, Jazz, Cambria |
| 275 | 13 data one-liners (event-sourcing, CoW SQLite VFS, proof-carrying migrations, rehearsal CLI, zero-downtime schemas, invariant DBs, temporal tables, event registries, self-extending columns, joint restore, schema-PR conflicts, migration receipts) | stack/04 rejected | Occupied | T | LiveStore, Neon, Prisma, Atlas, pgroll, XTDB, Confluent |
| 276 | Async handoff fault corpus across RAP/MCP/Workers; Hydro idempotence obligations | stack/05 | Already being built | T | MCP conformance, Hydro #3214 |
| 277 | 18 distributed one-liners (executable stubs, API journeys, AsyncAPI, Buf gates, session types, choreography compiler, DST for TS, edge-actor proofs, cheap actors, TLA+, retry-storm checker, protocol rewrites, pipelining, co-simulation, event inbox, LLM protocol-FSM inference, exactly-once wrapper) | stack/05 rejected | Occupied or refuted | T | Specmatic, Schemathesis, Buf, Antithesis, Hydro, ProtocolGPT/ChatAFL/SpecFSM |
| 278 | Plugin replacement under live UI; causal replay bridge; production replay gate | stack/06 | Upstream | T | Foldkit, VS Code host |
| 279 | 14 frontend one-liners (session→Story, live Effect in Story, path-tested machines, UI race model checking, ARIA contracts, visual auto-judge, closed design systems, design-system skills, genUI protocols, self-writing app, message migrations, portable UI heap, browserless tests) | stack/06 rejected | Occupied or refuted | T | Stately, fast-check, ARIA-AT, Percy, json-render, Lamdera |
| 280 | Release Gate Witness | stack/07 | Weakest demand | Fs | — |
| 281 | 15 infra one-liners (speculative merge queue, SLO-as-code, runbook state machines, incident curricula, runbook diffs, on-call investigator, all-TS infra framework, universal rollback, Nix/Bazel factory, rebuild agent-added deps, PR cost gate, leased previews, config delivery, provider factory) | stack/07 rejected | Occupied or refuted | T | Graphite, OpenSLO, Rundeck, Sentry Seer, Pulumi, any2bazel, OSS Rebuild, Infracost |
| 282 | Consumer-owned effect checks on an installed extension set; withdrawal rehearsal | stack/08 runners-up | Demand; uninstall taken | Fs | — |
| 283 | 17 self-extending-agent one-liners (hot-reloaded tools, self-editing IDE, trajectories→skills, tool-making MCP, extension contracts, skill registries, MCP compliance, skill sandboxes, differential extension oracle, skill pruning, dotfiles, artifacts, tool discovery, contracts from own calls, harmlessness proofs, typed hot reload, durable hosting) | stack/08 rejected | Occupied or no oracle | T | Pi, bb, LATM, Voyager, selfMCP, Tessl, Extism |
| 284 | Rebase personal features over upstream; saved genUI compatibility across versions | stack/09 runners-up | Incumbents; upstream | T | Val Town, Jazz, A2UI suite |
| 285 | 13 self-extending-app one-liners (prompt-grown features, genUI protocol, typed UI machines, per-app storage, per-user extension sandboxes, Smalltalk world, formula generator, growing notes, inspectors, fork lenses, fork-and-merge, website mods, reversible extensions) | stack/09 rejected | Occupied or refuted | T | Artifacts, A2UI, Stately, DO Facets, pi-world, Potluck, Val Town |
| 286 | 16 rigor-flip one-liners (CASE workbench, UML repair, NL 4GL, TS→VDM, literate workspaces, Larch contracts, N-version voting, actor runtime, API gateways, MISRA-for-TS, typed infra plans, SRE agent, statechart upgrade checker, spec-weakening firewall) | stack/10 rejected | Occupied or no oracle | T | Mendix Maia, Event-B Agent, Stately, oasdiff, SpecGuard |
| 287 | Executable exit drill for a replaceable internal app; publisher visibility fixtures | connect26/01 runners-up | Weak; needs a publisher | Fs | — |
| 288 | Basin event-to-metric evidence bundle; working-tree fidelity probes for lazy git mounts | connect26/02 runners-up | Overlaps mature suites | T | OpenLineage, ArtifactFS, Tigris |
| 289 | Alarm business-effect check under interruption; hottest-DO partition rehearsal | connect26/03 runners-up | Adapters dominate; k6 suffices | Ft | — |
| 290 | Route Budget (body-inspecting proxy fixtures); Cascade Ledger (detector-cascade coverage) | connect26/04 runners-up | Operators; base rates | Fs | — |
| 291 | Worker Heap Check; App Retention Plan | connect26/05 runners-up | Weak defensibility; no incident | Ft | — |
| 292 | About 90 "do not pitch" one-liners across the five Connect reports (origin scheduling, bot identity, Markdown facades, agent wallets, generic extraction, skill libraries, agent filesystems, Basin wrappers, DO helpers, rollback, tenant routers, classifiers, tracing, media routing, metering, marketplaces…) | connect26/01–05 | Cloudflare's roadmap or occupied | T | Listed by report and line in the extraction ledgers |

### 3.6 Side folders and pre-round notes (`cloudflare-goose/`, `primitive/`, `portability/`, `next/`, `podcast/`, `product/`, `pitch/`, top-level notes)

Almost everything here is a product, wedge or demo of jitk or the capsule. It is therefore GrowOS lineage, or the
capsule mechanism that §11 lists as taken.

| # | Idea | From | Died of | New | Why |
|---|---|---|---|---|---|
| 293 | Capsule: portable Code Mode continuations (QuickJS-Wasm + DO journal + R2) | cloudflare-goose pick | Snapshot trick is prior art | T | quickjs-wasi, Vercel Workflow, Golem |
| 294 | EffectLab (fork a paused program, inject alternative tool replies); Crashpack (executable incident attachment) | cloudflare-goose | Native fork/replay features | T | Golem forks, Temporal replay |
| 295 | Goose Cells / RunGit / Wander / Goose Scatter / PocketCloud / LiveCaps / Goose → wasm32 | cloudflare-goose | Weak demand, owner advantage, or refuted | Fv | Also T |
| 296 | NativeGate: Workers call a tiny native jitk VM | cloudflare-goose | Crowded thesis | XG | Hyperlight, Containers |
| 297 | Tool-only interpreter SDK; execution backend for generated n8n/Retool; durable private actors; continuation worker | primitive/01 picks | Hyperlight/Wasm/Golem suffice | XG | jitk substrate |
| 298 | Batched DB UDFs; durable browser controller; VM-per-job CI; "cheaper Ethereum"; job-queue rebuild | primitive/01 rejected | Refuted | Fv | — |
| 299 | Durable generated tool programs; reproducible incidents; capsule registry; fork-explore-commit; child computers; assistant per user | primitive/02 | Taken | T | Temporal, Golem, E2B, LangGraph, DOs |
| 300 | 17 old-research ideas on jitk (branchable worlds, approval continuations, attenuable capability objects, prepared/undoable computation, speculation under predicted tool results, function shipping, frozen images, glue unikernels, deterministic islands, mobile agents…) | primitive/03 | Below the top 3, then substrate excluded | XG | — |
| 301 | Resumable Code Mode executor; native tool coprocessor; million dormant computers in R2; per-run hardware VMs | primitive/04 | Code Mode taken; jitk doesn't run on Cloudflare | T | Also XG |
| 302 | Portable QuickJS/Wasm backend: pause/fork/move across runtimes | portability/02 | Prior art | T | quickjs-wasi, Golem |
| 303 | Seccomp USER_NOTIF jitk backend; x86-64 jitk port; native RAM → Wasm resume | portability/01, 03 | Security tier; deferred; refuted | XG | — |
| 304 | Per-recipe kernels; per-request kernel generation; jitk vs isolates positioning | next/ | 32–128 KiB upside; offline growth | XG | — |
| 305 | Fern backlog (effects journal, SnapshotProvider upstream, hook bindings, MCP resource trees, credential broker, Go Cap'n Web, wazero tier, OPA approval, skills-as-resources…) | podcast/REVIEW | Product features | Ft | Several T (KEP #762, Executor, Composio) |
| 306 | Embedded ARM/KVM backend wedge; E2B replacement; RL environments; hosted SaaS; sandbox for every framework | product/ | "No proven wedge" | XG | — |
| 307 | Local MCP code-mode sandbox → embedded SaaS runtime; OSS core + hosting; OEM licensing; polyglot HW-VM code mode | pitch/ | Wedge unproven; Hyperlight, Dynamic Workers | XG | Also T |
| 308 | About 20 demo concepts (computer per program, red syscall, poisoned issue, runaway program, SQLite learns to read, break-the-VM event…) | pitch/06–09; product/01 | Demos of jitk | XG | — |
| 309 | Auditable replayable agent actions; any-language plugins; untrusted-data transforms; run side for compiled binaries; per-request scripts | landscape.md, cloudflare.md | jitk use cases | XG | Wasm components and isolates entrenched |
| 310 | Hour-long jitk workspaces; "a Lambda that never bills while waiting"; memoised computers / whole-computer PGO | SCOPE-QA.md | gVisor years; taken | XG | Also T (Workflows, DO hibernation) |

### 3.7 Round 12: the corpus, A09's audit and the standing list (`corpus/`, §13)

These rows cover A09's audit rows not already listed above. Most died at A09's ambition rung ("Tool/Product → NO").
**Under the new filter almost all of them still fail, but now on tailwind**: their value is code the next model writes.
The 20 "PASS" directions died when the builder rejected institutions, and they fail **solo** now.

| # | Idea | From | Died of | New | Why |
|---:|---|---|---|---|---|
| 311 | Replaygate (production traffic as the oracle for agent PRs) | deep/06; §13 #2 | A09 "→ B19/B20"; replay is sold | Fs | Needs an app's real traffic; also T (Curtail ReGrade, Replay.io) |
| 312 | Replay diff ("about to email twice") | deep/03; §13 #3 | Foldkit / Vercel in-flight upgrades | T | — |
| 313 | Follow-me Durable Objects | deep/02; §13 #6 | Sync engines deliver the value | Fv | — |
| 314 | RLBox sandboxing of C libraries (as listed in §13 #7) | §13 #7 | "Narrow, contribution, uncool" | **R** | ≈ #104, the same idea listed twice |
| 315 | Tenuo edge port | deep/05; §13 #7 | Port | Ft | — |
| 316 | Workspace repro reducer | deep/01; §13 #7 | Tool | Ft | — |
| 317 | Wasm git merge kernel | deep/04; §13 #7 | Library port | Ft | — |
| 318 | Schema lenses for forks of generated apps | deep/02; §13 #7 | 30,000 lens-law passes accepted wrong units | Fo | Lens laws don't check meaning |
| 319 | GrowOS toward bash/git/node; DB personality; Labelled Code Mode in jitk | §13 GrowOS | Excluded | XG | — |
| 320 | Agent job bid calibration | E01 #1 | Tool | Ft | A fixed cap may solve it |
| 321 | Semantic conversion incl. governance; semantic-consumer upgrade rehearsal | E01 #2–3 | Business meaning | Fs | — |
| 322 | Shared-skill change-impact rehearsal; skill-composition conformance corpus | E01 #4; S06 #1 | Needs consumers | Ft | — |
| 323 | Controller-trace game behaviour comparison | E01 #5 | Game testing exists | X13 | Lockstep (T03) |
| 324 | Operator legacy-model retirement rehearsal | E02 #1; S03 #1 | Capacity data | Fs | — |
| 325 | Verifiable public projection of private development | E02 #2 | Tool | Ft | — |
| 326 | Engineering control map with intervention history | E02 #3 | Owner preferences | Fs | — |
| 327 | Counterexamples for competing SDK shapes | E02 #4 | Taste | Fo | — |
| 328 | Private/offline classifier parity corpus | E02 #5; S03 #2 | Consented data | Fs | — |
| 329 | Blind product-insight rediscovery | E03 #1; S05 #3 | Pre-insight material | Fs | — |
| 330 | Attention-saturation decision receipts | E03 #2 | Integration | Ft | — |
| 331 | Stateful playtest repair packets | E03 #3 | Local inputs | Ft | — |
| 332 | Cross-machine shell/environment assumption census | E03 #4; S06 #2 | Models learn to stop | Ft | — |
| 333 | Cumulative product-surface gate | E03 #5 | Product judgment | Fo | — |
| 334 | Changed-opinion index | E04 #1 | Private history | Fs | — |
| 335 | Management incentive preflight | E04 #2 | Weak analogies | Fo | — |
| 336 | Supported-combination coverage ledger | E04 #3 | Owner input | Ft | — |
| 337 | Cross-screen design exception inbox | E04 #4 | Taste | Fo | — |
| 338 | AI engineering-student assessment | E04 #5 | Learning evidence | Fs | — |
| 339 | Production-code witness for test-only abstractions | E05 #1 | Tool | Ft | — |
| 340 | Expiring business-rationale fixtures | E05 #2 | Owner tradeoffs | Fs | — |
| 341 | Recovery-path dependency drill; recovery-load envelope | E05 #3; S04 P04 | Declared ≠ discovered | Fs | Operational traces |
| 342 | Retry vs repeated-intent corpus | E05 #4 | Operation identity | Fs | — |
| 343 | Architectural prediction follow-through | E05 #5 | Longitudinal | Fs | — |
| 344 | Recipient-side media handoff preflight | E06 #1 | Adapter | Ft | — |
| 345 | Fresh-context learned-skill rehearsal | E06 #2 | Existing mechanisms | Ft | — |
| 346 | Hybrid token/recurrent-cache checkpoint conformance | E06 #3 | Upstream corpus | Ft | — |
| 347 | Speculative-decoding length/domain diagnosis | E06 #4 | Benchmark | Ft | — |
| 348 | Same prompt, different environment routing audit | E06 #5 | Environment outcomes | Fs | — |
| 349 | Blind-eval evidence auditor | E07 #1 | Can't manufacture an oracle | Ft | — |
| 350 | Cases vs commentary transfer experiment | E07 #2 | Licensed material, experts | Fs | — |
| 351 | UI jitter / temporal interaction assertions | E07 #3; S06 #3 | Code | X13 | Interaction Foundry (T06) |
| 352 | Incident restitution reconciliation; fix-live support receipt | E07 #4–5 | Integration | Ft | — |
| 353 | Nested Code Mode artifact identity/lifetime | E08 #1; S01 #3 | Adapter | Ft | — |
| 354 | Direct vs composed permission fixtures | E08 #2 | Fixtures | Ft | — |
| 355 | Model rollout under conflicting user profiles | E08 #3 | Real preferences | Fs | — |
| 356 | Interrupt/steer/cancel at side-effect boundaries | E08 #4; S01 #5 | Conformance suite | Ft | — |
| 357 | Rehearse an upstream update against a personal fork | E08 #5 | Owner modifications | Fs | — |
| 358 | Data → code → chart → prose analytical integrity | E09 #1 | Bindings | Ft | — |
| 359 | Research-set omission witness | E09 #2 | No open-web completeness oracle | Fo | — |
| 360 | Web Serial bootloader/reconnect witness | E09 #3 | Devices | Fs | — |
| 361 | GPUI accessibility fixtures | E09 #4 | Assistive users | Fs | — |
| 362 | False-negative audit for semantic check selection | E09 #5 | Generic mechanism | Ft | — |
| 363 | Exposure-aware shim retirement | E10 #1; S01 #1 | Deletion bot built | T | — |
| 364 | GPU telemetry upgrade-meaning fixtures | E10 #2; S03 #3 | Hardware | Fs | Near XB (cross-GPU atlas) |
| 365 | Small-message coordination-tax diagnosis | E10 #3 | Measurements | Fs | — |
| 366 | WhichBinary: intended vs executed artifact | E10 #4; S02 #2; S07 #3 | "Designed to become prompt-sized" | Ft | — |
| 367 | Invalidate learned query skills when meaning changes | E10 #5 | Owner meanings | Fs | — |
| 368 | Disposability envelope / executable retirement | E11 #1; S02 #3; S05 #2 | Declarations | XB | Preservation family |
| 369 | Architectural shortcut witness | E11 #2; S02 #1 | Not an observable property | Fo | — |
| 370 | Restart settings receipt | E11 #3; S01 #2 | Tiny tool | Ft | — |
| 371 | Provider-owned semantic service fake | E11 #4 | Fakes | T | StrongDM DTU, LocalStack; Cutover (T01) |
| 372 | Sandbox capability witness | E11 #5 | Upstream feature | Ft | — |
| 373 | Tailor once vs keep editing (family-app field study) | S05 #1 | Bounded study | Fs | Household data |
| 374 | Attention vs coding concurrency study | S07 #4 | Study | Fs | — |
| 375 | Longitudinal fork-upkeep casebook | S07 #5 | Casebook | Fs | — |
| 376 | Paid apprenticeship infrastructure | E12 #1 | People | Fs | — |
| 377 | Shared high-altitude launch tower | E12 #2 | Parked; physics/capital | Fp | — |
| 378 | B01 Federation of real company task worlds | E12 #3 | PASS → builder rejected institutions | Fs | Companies' tasks |
| 379 | B02 Replicated software-methods lab (incl. org science, causal observatory, web-architecture trials) | E12 #4, E13 #2, E15 #4, E16 #1, E19 #3 | PASS → rejected | Fs | Participants are the asset |
| 380 | Market for useful compute with task grades | E12 #5 | Counterparties | Fs | — |
| 381 | B03 Live planetary computational commons | E13 #1 | PASS → rejected | XB | Scientific commons |
| 382 | B04 Production-linked review/acceptance evidence commons | E13 #3 | PASS → rejected | XB | Evidence commons |
| 383 | API design laboratory with real consumers | E13 #4 | Consumers | Fs | — |
| 384 | Attention-bounded preventive-maintenance network | E13 #5 | Merge authority | Fs | — |
| 385 | B05 Cooperatively observed infrastructure | E14 #1 | PASS → rejected | Fs | Physical capture |
| 386 | B06 Shared memory-safety boundary across LLVM ecosystems | E14 #2 | PASS → rejected | XB | Fil-C extended to all LLVM languages |
| 387 | Change authority across silos; durable identity for places; portable personal memory | E14 #3–5 | Authority | Fs | — |
| 388 | B07 Runtime cost-contract commons | E15 #1 | PASS → rejected | Fs | Consumer workloads |
| 389 | B08 Capability continuity / ten-year offline rebuild-and-run | E15 #2, E16 #4 | PASS → rejected | XB | Preservation archive |
| 390 | B09 Accessible graphics interaction commons | E15 #3 | PASS → rejected | Fs | Compensated users |
| 391 | Prospective product-decision/outcome commons | E15 #5 | Archive | Fs | — |
| 392 | B10 Cross-device numerical semantics commons | E16 #2 | PASS → rejected | XB | Cross-GPU numerical atlas |
| 393 | B11 Independent semantic audit commons for languages | E16 #3 | PASS → rejected | Fs | Expert adjudication, pooled funding |
| 394 | B12 Cross-engine storage recovery qualification | E16 #5 | PASS → rejected | XB | Agent-era Jepsen |
| 395 | B13 Public digestion of machine-produced mathematics | E17 #1 | PASS → rejected | Fo | Human comprehension is the only oracle |
| 396 | B14 Observatory of live research incl. failures | E17 #2 | PASS → rejected | XB | Scientific registry |
| 397 | Research apprenticeship network | E17 #3 | People | Fs | — |
| 398 | B15 Public device-to-device continuity evidence | E17 #4 | PASS → rejected | Fs | Carriers and devices |
| 399 | Common human-attention limits across agents | E17 #5 | Platform absorption | T | — |
| 400 | B16 Network delivering complete physical projects | E18 #1 | PASS → rejected | XB | Repair/fabrication network |
| 401 | B17 Institutional meaning attached to finished work | E18 #2 | PASS → rejected | Fs | Owner adjudication |
| 402 | B18 Researcher-owned commons of unresolved questions | E18 #3 | PASS → rejected | XB | Scientific registries |
| 403 | B19 Shared real customer failure worlds | E18 #4 | PASS → rejected | Fs | Private topology |
| 404 | Cross-company evidence-exception network | E18 #5 | Swift/GLEIF | Fs | — |
| 405 | B20 Federated executable web-ecosystem spec / Package Behavior Atlas | E19 #1; corpus SUMMARY #1 | PASS → rejected | XB | Package atlas / executable web spec |
| 406 | Paid maintainer relief/succession commons | E19 #2 | Staffing, funding | Fs | — |
| 407 | Living human-outcomes commons for generated UI | E19 #4 | User panels | Fs | — |
| 408 | **Sparse-context language processing (classify–carve–compress beyond JS)** | E19 #5 (A09:155) | "NO pending discovery" (100×, one-shot) | **R** | §5.1 |
| 409 | Judgment compiler (owner precedents → policies) | A04 pick | Builder rejected | XB | — |
| 410 | Live computational commons (Hazel/Omar) | A01 crazy pick | Builder rejected; Hazel active | XB | — |
| 411 | Continuously executable scientific record | A05 pick | Builder rejected | XB | CODECHECK (NWO) |
| 412 | Open repair and fabrication network; 3D-print fit atlas | A06 pick | Builder rejected | XB | — |
| 413 | Software mutuals (stewardship after the maker leaves) | A07 pick | Builder rejected | XB | Community stewardship |
| 414 | Commons of outcomes for small local task models (≤1% of cloud cost) | A08 pick | Builder rejected; Python ML | Fp | Also Fs |

**The rest of round 12: S01–S07 projects and the A01–A08 runners-up.** Most of the roughly 150 S-file projects are
fixtures. They are grouped by type below, and each group is named in full in the extraction ledgers with `file:line`.

| # | Idea | From | Died of | New | Why |
|---|---|---|---|---|---|
| 415 | 14 harness conformance fixtures: settings survive a crash, artifact lifetime, cancel/steer races, plugin hot-reload, product contracts, interrupted business effects, handoff authority, setup readiness, negative controls, completion state, composed skills, durable-harness migration, old-client/new-plugin, requester transitions | S01 P02–P20 | Owners absorb; 100× + one-shot | Ft | Most also T (oneharness, ACP, skill-up, Amp) |
| 416 | Consumer-owned regression matrix for a shared skill | S01 P05 = S02 P05, S06 P07 | Needs downstream teams | Fs | Also T (skill-up, Promptfoo) |
| 417 | Act-vs-ask study; attention load under agent concurrency; cost per accepted outcome | S01 P15, P16, P22 | Studies | Fs | Also T (DX, Jellyfish, Cue) |
| 418 | "React for agents": portable agent abstraction / scenario atlas | S01 P19 = S04 P36 | Underspecified | T | ACP, Agent Skills, MS Agent Framework |
| 419 | Preserve the conditions behind a learned rule | S01 P21 | Rule regression taken | T | skill-up, Harness Training |
| 420 | Runtime architecture obligations (green tests hiding a wrong design) | S02 P01 = S04 P37 | Static guards shipped | Fo | Also T (ArchUnitTS, Sigrid) |
| 421 | 10 software-factory fixtures: RigorBench follow-ups, test retirement by history, agent-TDD oracle, test-weakening cases, eval-evidence audit, review dissent, review complexity, batch obligations, cross-packager matrix, emitted-code checks | S02 P04–P17 | Mature or taken | T | Stryker, TDDev, GreenLie, Bastion, Polygraph, FileCheck |
| 422 | Served-release receipt; repro admission pack; product-surface review | S02 P18–P28 | Release platforms; templates | Ft | — |
| 423 | Management casebook; senior-spiral exercise; delayed-repair learning test; cross-level handoff; manager work-trial rubric; decision→consequence dataset | S02 P21–P26 | Teaching material; participants | Fs | — |
| 424 | Withheld by S02: post-merge platform, architecture cleanup campaigns, generated-app catalogs, rationale capture, "unit tests are obsolete", automated manager ranking | S02 withheld | Shipped or invalid | T | gitai, OpenRewrite, Backstage, Diffractor |
| 425 | 13 model/cost fixtures: subsidy-exit replay, cache continuity, hybrid-cache corpus, speculative-decoding cliff, coordination tax, cascade audit, quantization recipe, provenance receipt, heartbeat census, latent-state contract | S03 P04–P18 | Taken or weak | T | ccusage, llm-d, vLLM, SPEED-Bench, AIConfigurator |
| 426 | Cross-silicon product/numerical parity fixtures | S03 P10 | Owner exists | XB | Cross-GPU numerical atlas |
| 427 | Inference-price-shock revives agent-VM savings | S03 §1 | Arithmetic refutes it | Fv | — |
| 428 | Cost monitors, classifier platforms, cache proxies/routers, multi-silicon compilers, retirement bots, doc-format benchmarks | S03 killed lists | Taken | T | ccusage, Langfuse, Clef, Modular, ModelShift |
| 429 | 20 infrastructure fixtures: semantic conversion, stale SQL skills, consumer upgrades, business-example review, event-to-answer coverage, numbers-in-prose, permission fixtures, sandbox probes, retained-heap regression, dev-loop conformance, GPUI fixtures, body-routing parity, lazy-git fixtures, checkout report, schema branches, resource cleanup, batch interference, dated business failures, retention plan, creation-to-ready benchmark | S04 P05–P35 | Owned, or one assertion in an existing suite | Ft | Most also T |
| 430 | Cloudflare-operated Postgres; compute-bid vs owner-priority guard | S04 P38, P40 | Vendor wish; fixed limits | Fv | — |
| 431 | Author current-view editor; spoiler-safe game catch-up; which login owns a subscription; depth-camera mural; reference vs remake trace; personal media extension; small human desires; malleable personal-app framework | S05 P04–P20 | Taken or no unmet user | T | Delphi, Savecraft, Powermove, Manyshape, Ink & Switch |
| 432 | Cases vs commentary legal study; adversarial private→public repo projection | S05 P14–P15 | Experts; Copybara | Fs | Also T |
| 433 | 11 practice recipes: proof-of-behaviour, correction-to-check, environment-mismatch, fresh-context replay, target-machine bundles, playtest repair adapter, interview fixture, workflow exports, product-taste study | S06 P01–P25 | Public workflows | T | rstack, Pstack, Matt's skills, Archon, BugItGo |
| 434 | Workflow bundles, friction dashboards, replay tools, quota accounting, highlight readers, entitlement SDKs | S06 A01–A19 | Shipped | T | tstack, Code Insights, Playwright, ccusage, Stigg |
| 435 | Combined change-rehearsal platform; platform-wide semantic truth layer; generic execution receipts; fork manager; another attention inbox | S07 §1–5 | Rejected by S07 | T | Pact, Ossie, in-toto, ForkSync, Cue |
| 436 | Kill list restated by the S files (durable hosting, Code Mode, skill markets, routers, auth gateways, AI review, agent git, TS ports, app hosting, proposer+verifier loops) | S01–S05, A01–A03 | Taken | T | §11 |
| 437 | Open Computational School; Counterfactual Towns; executable public-rules commons; "Wikipedia, but functions" | A01 runners-up | Teachers, residents, institutions | Fs | Also T (Wikifunctions, OpenFisca) |
| 438 | Continuing fault record for databases/queues | A02 runner-up | Judgment-heavy | XB | Agent-era Jepsen |
| 439 | Public defect/fix/recurrence record; Recompute Atlas; cross-vendor numerical record | A02 #3–4, other | Label economics; adjudication | XB | Evidence commons, executable record, numerical atlas |
| 440 | Compiler-audit commons from generated C programs | A02 other | No new boundary | T | Csmith, YARPGen |
| 441 | Library of genuine customer failure worlds; compute-only UI-outcomes commons | A02 other | Consent; generated sessions ≠ humans | Fs | Also Fo |
| 442 | Port scientific Fortran while preserving conclusions | A03 #2 | Scientist partner | Fs | Also T (ForTress, LAFT) |
| 443 | Translate a C/driver estate with hardware traces; executable formally specified web platform | A03 #3, #5 | Builder rejected | XB | — |
| 444 | Proof-backed coreutils/OpenSSL/SQLite/zlib replacements | A03 #4 | Entry points occupied | T | uutils, aws-lc, Turso, lean-zip |
| 445 | Intent version control; conserved-authority constitution; judgment exchange | A04 #2–4 | No semantic graph; tokens suffice; markets | Fo | Also T (Biscuit, Tenuo) |
| 446 | Formalize a whole field + proof digestion; federated world model; live observatory of AI research; research apprenticeships | A05 #2–5 | Funded overlap; institutions | T | Formal Frontier, Mathlib, DestinE, 1stProof; XB/Fs |
| 447 | Continuously observed editable city; device-capability commons; fabrication network that grows its capabilities | A06 #2–4 | Capture access; mature ecosystems | Fs | Also T (ESPHome, Home Assistant) |
| 448 | 20 km tower; text-to-CAD and fab-ordering wrappers | A06 boundary, occupied | Capital; products exist | Fp | Also T (Zoo, Backflip, Xometry) |
| 449 | Institutions without compulsory apps; public works for fitted personal computing; another app builder | A07 #2–3, prior art | Institutions; incumbents | Fs | Also T (Lovable, Bolt, Replit) |
| 450 | Proof-carrying volunteer search; compute exchange settling on delivered work; agent demand as a grid resource | A08 #2–4 | Donors, liquidity, utilities | Fs | Also T (BOINC, Akash, Emerald AI) |
| 451 | Idle-device / WAN-sharded inference; stranger-hosted agents | A08 verdict | Memory ≠ throughput | Fv | Measured |

### 3.8 Round 13 cut lists (died under the *current* filter, listed for completeness)

| # | Idea | From | Died of | New | Why |
|---:|---|---|---|---|---|
| 452 | A bespoke or fast Rust compiler grown against rustc | T01 §7 | Four efforts (lust-lang, rustd, Relax, Astral) | T | — |
| 453 | Twins of the services agents call | T01 §7 | StrongDM DTU, Pome, AgentTwin, LocalStack | T | — |
| 454 | Byte-exact decompilation of games and binaries | T01 §7 | momo5502, freeqaz | T | §4 |
| 455 | Workload-specific database engines | T01 §7 | Bespoke OLAP (VLDB'26) | T | §4 |
| 456 | Rewrites carrying proofs | T01 §7 | lean-zip; Lean FRO | T | §4 |
| 457 | Adobe-format fidelity grown against Adobe | T01 §7 | ArtCraft (134 of 135 PSDs) | T | — |
| 458 | Lockstep game ports checked by replay | T01 §7 | Bau contest, Rosebud, OpenMW port | T | — |
| 459 | Just-in-time hardware | T01 §7 | Physical oracle | XB | 3D-print fit atlas |
| 460 | Excel-exact engine checked against cached .xlsx values | T01 §7 | "No seed" | T | IronCalc (§4) |

| 461 | T01–T08 picks and runners-up: Grow-install / Unfinished Library, Transplant, Cutover, Lemma, Futamura, Soundcheck, GrowWorld, Lockstep, Glitch Frontier, GrowCAS, Proven Handbook, Implication Atlas, NativeTxn, SplitActor, LiveImage, Interaction Foundry, File Surgery, Task Continuations, DeltaForge, ByteGarden, ProofSkip, Living Workbench, Growing Build Rules | tailwind/SUMMARY | Current round's ideas | X13 | Not re-pitched |
| 462 | Agent audits of soundness/miscompilation; grown executable language specs; port an ecosystem into a new language | T02 cuts | Jepsen / exec-spec shape | XB | — |
| 463 | On-demand game content; story worlds; the Primer; proof games | T03 cuts | Taken; needs learners | T | Meshy, Roblox 4D, Dreamlands, lean4game |
| 464 | Proven OEIS; formal archives; certified optimisation constants; correctly rounded libm | T04 cuts | Taken | T | AlphaProof Nexus, Lean Pool, AlphaEvolve, CORE-MATH, RLIBM |
| 465 | Protocols grown from RFCs; virtual device models; another Homa | T05 cuts | Taken | T | RFC2Code, AUTOSPEC, DevGen, HomaModule |
| 466 | GenUI SDKs; self-editing apps; program microscopes; growable file viewers; generated-UI maintenance benchmarks | T06 cuts | Taken | T | A2UI, Tambo, Glamorous Toolkit, Persephone, EvoGenUI-Bench |
| 467 | Universal decoder / self-decoding format; schema lenses / CRDT synthesis | T07 cuts | Taken | T | AnyBlox; Cambria, Katara |
| 468 | Generated tools retained across sessions; SDKs from API descriptions | T08 cuts | Taken | T | NVIDIA NOOA, AWS Strands, Stainless |

---

## 4. "Taken" deaths, re-checked for stalled takers (2026-10-29)

The rule: a TAKEN death stays dead unless the taker has stalled or quit. I re-checked every taker behind an idea that
would otherwise pass the new filter.

| Idea that would otherwise pass | Taker | Status on 2026-10-29 (F) | Verdict |
|---|---|---|---|
| Agent-grown Node compatibility / fault-grown Node (rounds 2, 8) | Deno's `node-compat` agent skill | Active. Deno 2.8 is reported at 76.4% of Node's own test suite ([summary of the release notes](https://dev.to/0xgosu/deno-28-makes-the-node-compatibility-bet-real-ijd)), and the skill ships in `denoland/deno` | **T** |
| Workload-specific database engines (round 13 cut, Mattis/Theo seeds) | Bespoke OLAP, TU Darmstadt | Active. Published at VLDB 2026 with code ([arXiv 2603.02001](https://arxiv.org/abs/2603.02001), [PVLDB 19](https://www.vldb.org/pvldb/vol19/p3759-wehrstein.pdf)) | **T** |
| Proven rewrites of C libraries | lean-zip (Kim Morrison, Lean FRO) | Active. Presented June 2026 ([Lean talk](https://lean-lang.org/presentations/20260604_DFMD/)) | **T** |
| Agent-evolved SAT/SMT solvers | SATLUTION (NVIDIA), LLM2SMT | SATLUTION: a 2025 paper with no public code found ([arXiv 2509.07367](https://arxiv.org/abs/2509.07367)). LLM2SMT: March 2026. Crowded rather than stalled | **T** |
| Excel-exact formula engine (round 13 cut: "no seed") | IronCalc and others | Active. IronCalc 0.8.3 tests itself against Excel-computed files ([docs.rs](https://docs.rs/crate/ironcalc/0.8.3)) | **T** |
| Live Wasm migration ("teleport") | Weave | Small (93 commits, 48 stars, [repo](https://github.com/dphilla/weave)). The idea fails value anyway | **Fv** |
| Byte-exact game decompilation (round 13) | momo5502, freeqaz | Active hobbyists. Only decomp.wtf was archived, on 2026-10-15 (per T01 §7) | **T** |
| Agent-grown independent rebuilds of the package long tail (flip/05 #2) | Google OSS Rebuild | Active. The repo has `cmd/agent` and `internal/agent`, which call Gemini via `google.golang.org/genai` to infer rebuild recipes, plus 1,549 commits with the latest on 2026-10-29 ([repo](https://github.com/google/oss-rebuild); checked via the GitHub API) | **T** |
| Oracle Foundry, Internet Wind Tunnel, API resurrection (round 2) | StrongDM DTU, Pome, AgentTwin; T01 Cutover | Service twins are active, and Cutover was pitched in round 13 | **T / X13** |
| Library sandbox retrofits by agent | none found | Firefox still has six RLBox libraries ([searchfox](https://searchfox.org/firefox-main/source/security/rlbox/docs/index.md)); no LLM automation found | **R** (§5.2) |
| Agent-grown OpenZL format descriptions | Meta (risk) | Moving. Collet: LLM SDDL "actually works"; "dozens more" formats planned ([LWN](https://lwn.net/Articles/1053018/)) | **R** (§5.3), Open 2 |
| Multi-language SIMD lexing | none (OXC covers JavaScript only) | One-language projects only (§5.1) | **R** (§5.1) |
| LLM-written mappers for protocol learning | none found | Human-mapper learning is active ([SSTIC 2026](https://www.sstic.org/2026/presentation/using_active_automata_learning_to_find_vulnerabilities_in_network_stacks/)) | **P** |
| Certificates required of evolved code | none found | Google's guide lists no certificates (updated 2026-10-28) | **P** |
| LLM-evolved QEC decoders | none found | qBraid's AlphaEvolve work covers encodings, not decoders | **P** |

**I — The general finding.** None of the takers I checked has stalled. The one small taker (Weave) backs an idea that
fails on value regardless. Every "taken" death in the inventory stays dead.

---

## 5. The resurrections

All three developed ideas came from the only two places where earlier rounds asked "which old idea died of per-case
labour, and has a public check?": the flip rounds (`flip/04`, `flip2/06`) and A09's "pending discovery" row. Rounds
8–11 produced no resurrection. Under any filter, their kills were correct: platform-taken, or tool-sized.

### 5.1 Carve: every programming language lexed at memory bandwidth, token for token identical to its official lexer

**Name and one sentence.** An agent grows a classify–carve–compress SIMD lexer for one language after another. A
language is admitted only when its token stream matches the language's own official lexer exactly, on a held-out
corpus and on adversarial files, at several GB/s. The accepted lexers are plain Rust that runs with no model.

**What it resurrects.** A09 row E19 #5 (E19 P04), "sparse-context language-processing research". It died as "**NO
pending discovery**; H/M. 'Research might discover something' cannot itself pass both tests". The reason given was "a
port, likely", and "a new general algorithm/theorem is not assured" (`ambition/A09-critic.md:155`). Both
objections belonged to the old filter. The tailwind filter does not ask for a theorem; it asks for a grown artifact
with an uneditable check.

**The seed (Q, checked against `transcripts/p3-64-viteconf-viteconf-2026-5th-edition-we-are-vite.txt`).** Shannon
Jackson, principal engineer at Atlassian, ViteConf 2026. Auto-captions normalised: "pausing"/"pasa" → parsing,
"byes" → bytes.
- [2:40:00] "[Parsing] is underneath everything. linting, bundling, code highlighting, meta frameworks… I spent eight
  months working on this and nearly quitting quitting twice because I was getting negative results."
- [2:46:00] "95 to 99% of all [bytes] don't require any context at all. Which leads me to the solution not just for
  JavaScript, but for any low density context dependent language. And this is the algorithm that cracked it.
  Classify, carve, compress."
- [2:47:00] "…it can lex JavaScript source code at roughly 6 to 7 GB per second."
- [2:52:00] "users will see a two times improvement in [parse] speed on 95% of files."

This is a seed of the GrowOS kind: one practitioner says the method generalises to a whole class, and then builds only
one member of it.

**How the algorithm works, plainly (Q/I).**
1. **Classify:** SIMD instructions mark every token start and end, 64 bytes at a time.
2. **Carve:** a scalar pass visits only the 1–5% of bytes that need context and repairs them: strings, comments,
   templates, regex versus division.
3. **Compress:** the bitmap is packed into a dense token array.

The parser then reads tokens from an array instead of pulling them one by one. He credits that un-fusing, more than
the SIMD itself, for the end-to-end gain he expects (2:50–2:52).

**What grows, and its oracle.**
- **What the builder designs (I).**
  - A small lexer IR: a declarative "context sketch" of which constructs open and close context-dependent regions.
  - The bitmap-to-token-array runtime.
  - A canonical token format, with a per-language mapping from official token kinds. It is fixed before growth starts.
  - The harness, the acceptance rule and the public scoreboard.
- **What the agent grows, per language and ISA (I).** The carve routines for each context construct, classify kernels
  for AVX2, AVX-512, NEON, SVE2 and Wasm SIMD128, and the compress stage.
- **The growth trigger, the equivalent of GrowOS's missing syscall (I).** A file the accepted lexer cannot certify:
  a mismatch on a newly added corpus file, or a new language version. That lexer drops to a scalar fallback and is
  queued for regrowth.
- **The oracle the agent cannot edit (I).**
  1. **The official lexer as a black box.** Examples: rustc's `rustc_lexer`, Go's `go/scanner`, CPython's tokenizer
     (run as a reference binary; the builder writes no Python), the TypeScript compiler's scanner, clang's raw-token
     dump, javac's scanner, Ruby's Ripper. Token kinds and byte spans must be equal under the fixed mapping.
  2. **A held-out corpus split by repository, not by file.** Several GB per language from permissively licensed code,
     never shown to the agent.
  3. **Generated adversarial files** aimed at carve constructs: nested quotes, unterminated comments, Unicode
     identifiers, CRLF, BOMs, and constructs placed across 64-byte block boundaries.
  4. **Throughput on fixed hardware**, the median of repeated runs.
  5. **A mutation check on the oracle itself:** bugs injected into a correct lexer must be caught, or the harness is
     too weak.
- **The ratchet (I).** For each (language, language version, ISA), the scoreboard keeps the fastest token-identical
  lexer. A mismatch demotes it to the scalar path until it is regrown, so nothing accepted is silently lost.

**Tailwind, and why the next model doesn't eat it (I).**
- **What the models are working against is the hard carve logic.** Examples: Python f-strings (nested since PEP 701),
  Ruby, Perl and shell heredocs, C++ raw strings, Swift and Kotlin interpolation, Rust `r#"…"#` strings and nested
  block comments, Haskell layout, and division-versus-regex-style ambiguities.
- **Each model release can do more of it:** crack more of these constructs, write better kernels for more ISAs, and
  shrink the share of bytes that need carving. Because the oracle and the corpus never move, every gain is real.
- **The next model doesn't eat it.** From a prompt, it produces one plausible lexer. Carve holds a measured,
  oracle-checked catalogue across languages × versions × ISAs, plus the harness that makes "identical" mean something.

**One-shot test (I/E).**
- **What a model two generations ahead could do (E):** probably write a decent SIMD lexer for an easy language from one
  prompt.
- **What it cannot produce from a prompt (I):**
  - more than 30 languages × 4 ISAs;
  - each proven token-identical to the official lexer on tens of GB of real code.

  That needs per-language oracle harnesses (each in a different toolchain), the corpus, the hardware and days of runs.
  The one existing human instance took eight months of search (Q, 2:40).

**About 10× (E).** "simdjson for every programming language" is very ambitious for one person, but not impossible. Once
the IR exists, each further language is days of agent time plus harness work.

**Value proposition.** Every code tool (linters, formatters, bundlers, code search, AI code indexers) can tokenize
source at memory bandwidth, with a guarantee that its tokens are exactly the compiler's.
- **For JavaScript (Q):** the speaker projects about 2× end-to-end parse speed on 95% of files, with the work
  "rolling out over the coming months and probably early into next year" (2:51–2:52).
- **For other languages (I):** the end-to-end gain is unknown. Measuring it is part of the project.

**The 6-week version (E).**
- **Week 1:** canonical token format, and oracle adapters for Go, Rust, Python, C, Java and TypeScript. Also a
  repository-split held-out corpus (about 5 GB per language), the adversarial generator, and the oracle mutation test.
- **Week 2:** calibration. JSON against simdjson, and JavaScript against OXC's lexer and the speaker's published
  prototype gist (2:52).
- **Weeks 3–5:** the IR and runtime. Agents grow the six languages on AVX2 and on NEON (the builder's M-series Mac).
- **Week 6:** an unseen language (Lua or Zig) grown overnight, end to end, plus the write-up.

**The demo.** A terminal scoreboard with one row per language: official lexer MB/s, Carve GB/s, identical files out of
total, and the share of bytes carved. Then a live "add Zig" run: the agent works overnight, and by morning Zig runs at
N GB/s with zero mismatches on 2 GB, next to the list of mismatches the oracle caught on the way. The "wait, what?"
line: *"Python tokenized at 4 GB/s, and every token matches CPython's own tokenizer on 5 GB of GitHub code."*

**Prior art, and what's left (F, searches dated 2026-10-29).**
- **simdjson** ([repo](https://github.com/simdjson/simdjson), [Langdale & Lemire 2019](https://arxiv.org/abs/1902.08318)).
  In plain terms: it showed that a parser can find every structural character with SIMD bitmasks *before* parsing,
  and so parse JSON at GB/s. Carve's seed extends that idea to languages whose meaning depends on context.
- **OXC is integrating the speaker's JavaScript lexer** (Q, 2:41). Its docs mention SIMD on x86-64 AVX2, with other
  platforms "work in progress" ([docs mirror](https://docsearch.algolia.com/mcp/docs/repo/oxc-project/oxc); unverified
  wording).
- **One-language human projects:**
  - Validark's compaction-based Zig tokenizer: AVX-512 only, 1.4 GB/s, "~2.75x faster than current", April 2025
    ([ziggit](https://ziggit.dev/t/new-compaction-based-zig-tokenizer/9661)).
  - A TU Delft thesis lexing C with SIMD at about 12× GCC's lexer, without Unicode
    ([repository](https://repository.tudelft.nl/file/File_0dd21f86-ee80-49e2-b4d1-bdb56f84f265)).
  - HTML: [fhp-tokenizer](https://docs.rs/fhp-tokenizer) and [arXiv 2503.01662](https://www.arxiv.org/pdf/2503.01662)
    (about 20× HTML scanning on ARM).
  - SQL: [Lime's SIMD tokenizer](https://gregburd.codeberg.page/lime/tokenize__simd_8h_source.html).
  - DNS zone files ([arXiv 2411.12035](https://arxiv.org/pdf/2411.12035)).
- **A useful negative (F).** In 2014, Brian Schott added SIMD to the D lexer's whitespace and string routines and got
  "only a few percent"
  ([D mailing list](https://lists.puremagic.com/pipermail/digitalmars-d/2014-June/200029.html)). The seed speaker
  made the same point: local SIMD tricks fail, and the gain comes from un-fusing the lexer from the parser
  (Q, 2:43 and 2:50).
- **What's left (I):** each of these is one hand-made language. None checks token identity against an official lexer
  at corpus scale. No one has tested the speaker's generalisation claim ("any low density context dependent
  language"). I found no multi-language SIMD lexer generator in 2026 searches.

**The kill test (E: 3 days, about $100–300 of model calls).** Grow Go and Python against the harness. Kill if any of
these happens:
1. Token-identical lexers stay below 3× the official lexer's throughput.
2. The carved share is above 20% of bytes on the corpus, so the low-density assumption fails outside JavaScript.
3. The current frontier model one-shots a lexer that passes the full held-out and adversarial suite at the same
   speed. Then the catalogue is a prompt, and the idea fails tailwind.
4. The speaker or OXC announces a multi-language generalisation. Then contribute languages instead.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 4 | 4 | 3 | 4 | 5 | 5 |

### 5.2 Boxed: every widely used C library in an in-process sandbox, grown one library at a time

**Name and one sentence.** A program depends on a C library nobody has boxed yet. An agent compiles that library to
Wasm, wraps it with RLBox's tainted types, and writes a validator for every value that crosses back. The box is
accepted only after byte-identical differential runs and long untrusted-library fuzzing find nothing. Accepted boxes
run with no model.

**What it resurrects.** `flip/04` rank 1, "Library sandbox retrofits by agent: RLBox with a hostile-library oracle". It
was the only one of 25 old ideas in that table that was "**uncrowded** (no LLM work found)" (`flip/04-broad.md:30`).
It then died three times:
1. **flip/04 itself:** "a bridge technology; Rust rewrites with differential oracles are winning at Chrome. It is
   weaker than GrowOS" (`flip/04-broad.md:18–19`).
2. **§13 #7:** "smaller ones… each is narrow, a contribution, or uncool".
3. **A09:** "**NO → B06**; H. Adopting an existing boundary does not create a new evidence or participant asset"
   (100× and non-code tests).

Under the new filter, the grown, fuzz-evidenced catalogue *is* the asset, and no institution is needed.

**The seed.**
- **The issue (Q, checked):** RLBox maintainer Deian Stefan, RLBox v2 RFC, 2023-01-04. The C wrappers are "tedious
  boilerplate code that developers have to write by hand today"
  ([PLSysSec/rlbox discussion #50](https://github.com/PLSysSec/rlbox/discussions/50)).
- **The paper (F):** Narayan et al., "Retrofitting Fine Grain Isolation in the Firefox Renderer", USENIX Security 2020
  ([arXiv 2003.00572](https://arxiv.org/abs/2003.00572)). In plain terms, the team compiled libraries to WebAssembly
  and back to C. They then used C++ types to mark every value coming out of a library as *tainted* until code checked
  it, so a memory bug inside the library cannot corrupt the browser. Each library took "a bit over two days" and about
  180 lines, plus hand-written validators (28 sites for JPEG, 51 for PNG, per `flip/04:72–73`).
- **The adoption gap (F, checked):** Firefox ships six such libraries (graphite, ogg, hunspell, expat, woff2 and
  soundtouch), still six on 2026-10-29
  ([searchfox](https://searchfox.org/firefox-main/source/security/rlbox/docs/index.md)). Per-library labour and review
  are why it never spread.

**What grows, and its oracle.**
- **What the agent grows, per library (I):**
  - a wasm2c build recipe;
  - a tainted-type API wrapper;
  - validators;
  - a box manifest: memory cap, allowed callbacks, the host-visible API.
- **What the builder designs (I):**
  - the manifest format;
  - the oracle;
  - the acceptance rule;
  - re-verification against upstream releases;
  - consumer bindings: C++ initially, Rust and Go later.
- **The growth trigger (I).** A build that links an unboxed library is a fault and is queued.
- **The oracle the agent cannot edit (I):**
  1. **The compiler.** `tainted<T>` will not compile until every crossing is validated or explicitly copied. This
     checks that the boundary marking is complete.
  2. **Differential runs.** The boxed and native library run on a corpus and must produce byte-identical outputs.
     This checks functional equivalence.
  3. **An untrusted-library harness.** The library side is replaced by an adversarial stand-in that returns
     fuzzer-chosen values and scribbles over its own sandbox memory, while the host runs under ASan and UBSan. Any host
     fault is a "validator fault" returned to the agent.
  4. **A necessity check.** Each validator is removed in turn, and the harness must then find a host fault; otherwise
     the validator is marked untested. This stops "validate everything" no-ops from passing.
- **The ratchet (I).**
  - A published box records the library version, the recipe and its evidence: CPU-hours clean and coverage.
  - Every upstream release re-runs the oracle, and a regression demotes the box.
  - The catalogue only grows.

**Tailwind, and why the next model doesn't eat it (I).**
- **Harder targets need better models.** Bigger, gnarlier APIs (libxml2, libarchive, poppler, ImageMagick coders,
  libavcodec subsets) and semantic validators (a length used for logic, not just memory) need them, and each model
  release boxes more of that tail, faster.
- **The safety does not rest on trusting the model's code.** The sandbox confines the library's memory errors, and the
  evidence comes from harnesses the agent cannot touch.
- **What a prompt yields is one wrapper.** The catalogue, with thousands of fuzzing CPU-hours and version tracking, is
  accumulated.

**One-shot test (I).**
- **What a model can do from a prompt:** box libyaml.
- **What it cannot produce:** 100 boxes, each with independent fuzz evidence and re-verified on every upstream release.

**About 10× (E).** Boxes for the 100 C parsing and codec libraries that Rust, C++ and Go programs most often vendor.
That is very ambitious for one person.

**Value proposition.** Use libwebp, libxml2 or libarchive unchanged, and if one of them has a memory bug, the bug stays
inside its box. Two facts show the stakes:
- **The share (F):** memory-safety bugs are about 70% of serious security bugs in Chromium
  ([Chromium](https://www.chromium.org/Home/chromium-security/memory-safety/)).
- **The example (F):** the 2023 libwebp heap overflow, CVE-2023-4863, reached Chrome and every app that bundled the
  library ([Tenable](https://www.tenable.com/cve/CVE-2023-4863)).

Unlike a rewrite, a box keeps behaviour byte-identical, so there is no compatibility risk.

**The 6-week version (E).**
- **Week 1:** the toolchain (RLBox, wasm2c and the no-op sandbox), the four oracle layers, and five targets: libyaml,
  cJSON, libpng, the libwebp decoder and zstd.
- **Week 2:** calibration on Firefox's expat box. Regrow its validators blind and compare them with Mozilla's; the
  necessity check must rate Mozilla's validators as necessary.
- **Weeks 3–5:** agents box the five libraries. Record agent wall-clock against the paper's two person-days,
  validators written, faults found and overhead.
- **Week 6:** publish the boxes with their evidence, and switch one real C++ image tool to the boxed libwebp.

**The demo.** A split screen.
- **Left:** the untrusted-library harness drives a host that uses native libwebp, and ASan reports host faults
  within seconds.
- **Right:** the same harness against boxed libwebp runs for hours with zero host faults, with a ticker of the
  validator faults the agent fixed during growth.

**Prior art, and what's left (F, searches dated 2026-10-29).**
- **RLBox itself** (manual; six libraries in Firefox).
- **Google's Sandboxed API.** Process-based, with hand-written policies; the code dates from 2019–2023
  ([docs](https://developers.google.com/code-sandboxing/sandboxed-api)).
- **LLM-CAL** ([NDSS 2026](https://www.ndss-symposium.org/wp-content/uploads/2026-s709-paper.pdf)). In plain terms: an
  LLM annotates C code so that a tool can split cryptographic code into a trusted-hardware part and an ordinary part.
  It is adjacent: partitioning, not library boxing, and it has no adversarial-library oracle.
- **Compartmentalization-aware program repair** (ICSE 2026 journal track;
  [record](https://research.manchester.ac.uk/en/publications/compartmentalization-aware-automated-program-repair/)).
- **The rewrite alternative.** [DARPA TRACTOR](https://www.darpa.mil/research/programs/translating-all-c-to-rust)
  (C to Rust) and Chrome's Rust rewrites (`flip/04:115–116`).
- **Distinct from the rejected "Fil-C extended to all LLVM languages."** Fil-C changes the compiler so that C itself
  is memory-safe. Boxed changes nothing about the language; it contains one library and checks what crosses its
  boundary.
- **What's left (I):** no agent-grown catalogue of boxed libraries, and no evidence-backed catalogue of any kind.
  Searches for LLM-driven RLBox or library sandboxing on 2026-10-29 found none.

**The risks (F/I).**
- **wasm2c overhead on hot codecs.** The expert objection quoted in `flip/04:115–116` is 10–40%.
- **The sandbox runtime is itself a target.**
  - [CVE-2026-90648](https://osv.dev/vulnerability/CVE-2026-90648): a wasm2c sandbox escape on 32-bit platforms.
  - Wasmtime's 2026-04-09 batch: twelve advisories, eleven found with LLM tooling
    ([Bytecode Alliance](https://bytecodealliance.org/articles/wasmtime-security-advisories), via `flip/01:194`).
  - The response: keep the trusted runtime small, pin it, and re-run the oracle on every runtime release.
- **Proximity to the rejected Fil-C item** (see above).

**The kill test (E: 2 days, from `flip/04:116–118`).** Box libyaml and libpng. Kill if any of these happens:
1. At least 30% of accepted validators pass the harness, yet a reviewer still finds a semantic hole. The oracle is then
   too weak.
2. wasm2c overhead is above 25% on 3 of the 5 libraries.
3. The necessity check shows that the harness leaves most validators untested.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 4 | 3 | 4 | 4 | 4 | 4 |

### 5.3 Format Foundry: a compressor that grows a codec for each file format it meets

**Name and one sentence.** Whenever a file falls back to generic zstd, an agent writes an OpenZL format description for
it. The description is kept only if OpenZL's fixed universal decoder round-trips every file and held-out files get
measurably smaller at a set speed. The result compresses at GB/s with no model.

**What it resurrects.** `flip2/06`'s ONE bet, "Grow format descriptions for format-aware compression (OpenZL), with
roundtrip as the oracle" (`flip2/06-sweep.md:98`). It was never developed. It died to filters the new round dropped:
- **Stack-native:** from round 8 on, rounds had to be Cloudflare/TypeScript-adjacent.
- **Needs users:** the value case leaned on paying customers' data, "a $1–3k/month service per customer is plausible
  only at multi-PB scale" (`:135–136`).
- **Occupancy risk:** "Meta wrote the LLM spec page" (`:131`).

**The seed.**
- **Yann Collet, OpenZL's lead (Q), quoted by Jake Edge in
  [LWN, 2026-01-14](https://lwn.net/Articles/1053018/):**
  - designing a format-specific algorithm "typically takes around 18 months";
  - asking an LLM to write SDDL "actually works", but "like every LLM, you should read it".
- **Meta Engineering (Q),
  [2025-10-06](https://engineering.fb.com/2025/10/06/developer-tools/openzl-open-source-format-aware-compression-framework/):**
  every bespoke scheme means "another compressor and decompressor to create, ship, audit, patch, and trust". The same
  post's benchmark on one file (F): zstd -3 at 1.31×, xz -9 at 1.64×, and OpenZL at 2.06×, compressing at 340 MB/s and
  decompressing at 1,200 MB/s.
- **Coverage today (F):** OpenZL supports "around a dozen formats", with dozens more planned (LWN).

**What grows, and its oracle.**
- **What the agent grows, per format (I):** an SDDL description or parser, plus a trained plan.
- **What the builder designs (I):**
  - **The growth trigger, a "format fault":** a crawler runs every file through the current registry, and each fallback
    to zstd is a fault.
  - The acceptance gate, held-out splits by date and source, the registry and the scoreboard.
- **A later rung (I):** new transforms inside the compression graph. Each is accepted only with exhaustive
  round-trip tests *and* a Lean proof that decoding inverts encoding, on the
  [lean-zip](https://lean-lang.org/presentations/20260604_DFMD/) precedent.
- **The oracle the agent cannot edit (I, from `flip2/06:116–125`):**
  1. **Lossless round-trip of every file through OpenZL's fixed universal decoder.** The agent cannot ship a custom
     decoder, so it cannot hide data inside one.
  2. **Compressed bytes on held-out files,** counting plan and dictionary bytes.
  3. **A throughput floor** for both compression and decompression.
  4. **A baseline floor:** the result must beat max(zstd -19 with a trained dictionary, OpenZL with no description).
- **The ratchet (I).** One registry entry per format version. It is replaced only by a better score on the same
  held-out set, and any failure falls back to zstd, never to data loss.

**Tailwind, and why the next model doesn't eat it (I).**
- **The specs are hard and the score is honest.** Better models read gnarlier specs (GRIB2, FITS, HDF5 internals,
  pcap-ng, game replays, CAN logs) and find better transforms, and the score is a byte count that cannot be faked.
- **The artifact sits where no model can.** It runs in storage and network hot paths at GB/s (`flip2/06` gate 3).
- **What a prompt yields is one description.** The registry of hundreds, with held-out evidence, is accumulated.

**One-shot test (I).**
- **What a model can do:** write one good description.
- **What it cannot produce from a prompt:**
  - a measured registry across hundreds of public formats;
  - transforms that come with proofs.

**About 10× (E).** The "zstd of everything": beat zstd -19 by at least 1.3× on 100 common structured formats at zstd
speeds. That is very ambitious for one person.

**Value proposition.** Files 1.3–2× smaller than zstd at zstd's speed, for every format the system has met, and every
file still round-trips.

**The 6-week version (E, extending `flip2/06`'s two-week proof).**
- **Week 1:** build OpenZL's CLI and trainer from source (the 2026-10-28 attempt with the Python wheel failed because
  the wheel has no trainer; `flip2/06:153–156`), and pick 15 public formats with their baselines: pcap, Parquet pages,
  protobuf-delimited logs, OTLP dumps, GRIB2, FITS, BAM, SQLite pages, game replays, CAN logs, NetCDF, GLB, MIDI,
  OSM PBF and GeoTIFF.
- **Weeks 2–4:** the agent writes descriptions with only the spec, sample files and a read-only harness.
- **Week 5:** the format-fault crawler, run on a mixed corpus.
- **Week 6:** the scoreboard and the write-up, plus optionally one proof-carrying transform.

**The demo.** Point it at a folder of 40 file types. It finds 12 that it doesn't know and grows codecs overnight. By
morning the folder is 1.4× smaller than zstd -19, and every file round-trips.

**Prior art, and what's left (F, searches dated 2026-10-29).**
- **OpenZL itself.** Meta is moving in this direction: the [2026 paper](https://arxiv.org/abs/2605.09928), an "SDDL for
  LLMs" spec page ([openzl.org/sddl](https://openzl.org/sddl/)), Collet's LWN remarks, and an "automated compressor
  explorer" that "is getting better at proposing safe, testable changes" (Meta post).
- **[AgentGC](https://arxiv.org/abs/2601.13559)** (January 2026). In plain terms, a team used several LLM agents to
  evolve compressors for genomics files. It covers one domain and has no public registry.
- **LLM-as-compressor work.** Here the model sits in the decode path, which is a different idea. Example:
  [arXiv 2607.24192](https://arxiv.org/pdf/2607.24192), on source code.
- **What's left (I):**
  - the long tail of public formats Meta will not prioritise;
  - a public held-out scoreboard;
  - transforms that come with proofs.

  This is the weakest "Open" of the three: Meta owns the framework and is heading the same way.

**The kill test (E, from `flip2/06:147–151`).** Kill if, on held-out files, the grown plan beats max(zstd -19 with a
dictionary, OpenZL generic) by less than 15% on at least 6 of 10 formats at equal or better decode speed. Also kill if
more than 2 formats need human edits. If Meta ships agent authoring plus a public format library before the proof finishes, stop the
project story and keep the results as upstream contributions.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 4 | 3 | 4 | 2 | 4 | 4 |

### 5.4 Reserves: these pass the new filter, but are weaker than the three above

**Mealy Foundry: learned state machines for protocol implementations, with LLM-written mappers.**

**Resurrects:** `flip2/06` §3.5. It died as "plausible and unoccupied, but a niche security-testing market that overlaps
`flip/02`" (`flip2/06-sweep.md:479`), a needs-users death the new filter drops.

**The method, plainly (F).**
- **How it learns:** Angluin's L* algorithm (1987) learns a state machine by sending inputs and watching outputs.
- **The labour:** a hand-written *mapper* turns abstract inputs such as "ClientHello" into real bytes, one protocol at
  a time.
- **What it found:** de Ruiter & Poll (USENIX Security 2015) used it to find state-machine flaws in TLS libraries
  ([Vaandrager, CACM 2017](https://cacm.acm.org/research/model-learning/)).

**The grown form (I).**
- **What grows:** the agent writes and extends the mapper (the input alphabet) from the RFC.
- **The oracle:** the live implementation answers the queries, and fixed-budget conformance suites check the learned
  model.
- **The ratchet:** the alphabet only grows.
- **What runs without a model:** the learned models and their derived regression tests.

**2026 check (F).** At
[SSTIC 2026](https://www.sstic.org/2026/presentation/using_active_automata_learning_to_find_vulnerabilities_in_network_stacks/),
active learning with human-built mappers found authentication bypasses in TLS and SSH stacks. So the method is alive,
but I found no LLM-as-mapper work. The adjacent static approach is occupied: ProtocolGPT, ChatAFL and SpecFSM infer
protocol state machines from code or RFCs (`stack/05` rejected list; [arXiv 2405.00393](https://arxiv.org/abs/2405.00393)).

**Why it is a reserve.**
- The artifact is a map of implementations, close to the rejected "divergence map" family.
- It overlaps G06's networking ground.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 3 | 3 | 3 | 4 | 4 | 3 |

**Receipts: agent-evolved solvers that must carry certificates checked by tiny verified checkers.**

**Resurrects:** `flip2/06` §3.3. It died as "reads as a feature for Google's AlphaEvolve or OpenEvolve rather than a
product" (`flip2/06-sweep.md:228`).

**The idea, plainly (F).** A certifying algorithm returns its answer plus a witness that a small checker verifies. For
example, a dual solution proves that a linear program's answer is optimal (McConnell, Mehlhorn, Näher & Schweitzer,
[2011](https://doi.org/10.1016/j.cosrev.2010.09.009)).

**2026 check (F).**
- Google's AlphaEvolve reward-hacking guide recommends held-out validation, AST checks and hidden scoring files, but no
  certificates ([docs](https://docs.cloud.google.com/gemini/enterprise/docs/alphaevolve/developer-guide/reward-hacking-prevention),
  updated 2026-10-28; checked).
- Proof logging with verified checkers is active in academia: VeriPB with the CakePB checker
  ([CP 2026](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.CP.2026.21)).

**Why it is a reserve.**
- Same shape as G08's ContactForge (certificate-checked geometry) and T04's GrowCAS (proof-carrying answers).
- The value is indirect.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 4 | 2 | 3 | 3 | 5 | 3 |

**Evolved quantum error-correction decoders, gated by circuit-level simulation in Stim.**

**Resurrects:** `flip2/06` §3.2. It died to gate 4 ("buyers are about 10–20 hardware companies… can run the same loop
in-house") and to a Python starting point.

**2026 check (F).** I found no LLM-evolved decoder.
[qBraid used AlphaEvolve](https://qbraid.com/press/qbraid-uses-alphaevolve-for-quantum-error-correction) (June 2026),
but for fermion-to-qubit encodings, not decoders.

**Why it is a reserve.**
- No practitioner seed in the corpus.
- The builder has no quantum background.
- It must beat tuned decoders (Relay-BP) and survive FPGA latency, not just untuned BP-OSD.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 4 | 3 | 2 | 3 | 3 | 2 |

---

## 6. What the re-run says about the old filters

**The counts (from §3's "New" column, primary code only).** 468 rows, naming roughly 1,000 ideas once the group rows
are expanded (E).

| Code | Rows | Share | What it means |
|---|---:|---:|---|
| T | 169 | 36% | Stays taken; the taker is active in 2026 |
| Fs | 81 | 17% | Needs people, partners, traffic, devices or private data |
| Ft | 60 | 13% | A tool whose value is its code; one prompt for the next model |
| Fv | 50 | 11% | A mechanism without a value, or economics measured and refuted |
| XB | 31 | 7% | On the builder-rejected list |
| Fo | 25 | 5% | No oracle the agent cannot edit |
| XG | 22 | 5% | GrowOS lineage (most side-folder work was jitk itself) |
| X13 | 14 | 3% | Already pitched in round 13 |
| Fp | 9 | 2% | Physics, capital or Python |
| **R / P** | **4 / 3** | **1.5%** | **3 resurrections (one listed twice) and 3 reserves** |

**Seven patterns (I).**
1. **About half the deaths were correct under any filter.** Taken, refuted or physics-bound account for 228 of 468
   rows. Dropping a filter cannot revive them.
2. **The tools die again, now for the honest reason.** Round 12 killed the fixtures, witnesses, rehearsals and adapters
   of rounds 9–12 with "100×". The real reason is tailwind: their value is code the next model writes (85 rows, Ft and
   Fo). A09's own warning list is the clearest case: WhichBinary, restart receipts, hibernation hooks, permission
   wrappers.
3. **"Solo" kills the institutions a second time.** 112 rows need participants or are on the rejected list; that
   covers nearly every A09 "PASS" direction (B01–B20). Strip out the participants and what is left is the small tool
   of pattern 2. No B-direction resurrects.
4. **What resurrects is one narrow class, and it has GrowOS's shape.** All six survivors share four things:
   - **They died to filters this round dropped:** "needs users", "stack-native", "100×", or flip-rule gate 4 ("whoever
     owns the check wins"). None died to TAKEN.
   - **Their oracle is public, and no incumbent owns it:**
     - official lexers;
     - a fixed universal decoder;
     - a differential and adversarial harness around an unchanged library;
     - live protocol implementations;
     - tiny verified checkers;
     - a circuit simulator.
   - **There is a one-off human precedent proving one case works:**
     - the speaker's JavaScript lexer;
     - Firefox's six boxes;
     - OpenZL's dozen formats;
     - de Ruiter and Poll's learned TLS models;
     - LEDA's certifying algorithms and DRAT proof checking;
     - the hand-built decoders (MWPM, union-find, BP-OSD).
   - **The work is per-case labour that agents remove.**
5. **They came from two places.** The flip rounds (6–7) asked exactly the right question ("which old idea died of
   per-case labour, and has a cheap independent check?"). The other source is one A09 row, which a "100×" filter was
   built to discard. Rounds 8–11 produced none, because their brief required Cloudflare/TypeScript adjacency, so their
   candidates were platform-shaped.
6. **"Taken" stays taken.** Every taker I re-checked is active today (§4). That includes the most GrowOS-shaped old
   death of all, agent-grown Node compatibility (Deno), and the long-tail rebuild idea (flip/05 #2). Google's
   [OSS Rebuild](https://github.com/google/oss-rebuild) now has an `internal/agent` package that calls Gemini through
   `google.golang.org/genai` to infer rebuild recipes, with commits on 2026-10-29 (F, checked via the GitHub API).
7. **A search rule for the next sweep.** Look for three things together:
   - a practitioner claiming "this generalises";
   - a single human-built instance;
   - an official reference implementation to check against.

   Carve was found that way: in a corpus row that the old ambition filter had already discarded.

---

## 7. Ranked table and TL;DR

| # | Idea | Resurrects | What grows | Oracle the agent cannot edit | Tail | Cool | Value | Open | Solo | Demo | Sum | Kill test |
|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | **Carve**: every language lexed at memory bandwidth | A09 E19 #5, sparse-context lexing ("NO pending discovery") | Per-language carve rules and per-ISA SIMD kernels | Official lexers on a repo-split held-out corpus, adversarial files, measured GB/s | 4 | 4 | 3 | 4 | 5 | 5 | **25** | 3 days on Go and Python: ≥3× at token identity, carved share ≤20%, not one-shottable today |
| 2 | **Boxed**: the C library ecosystem in in-process sandboxes | `flip/04` #1, RLBox retrofits ("narrow", "→ B06") | Per-library box: recipe, tainted API, validators | Byte-identical differential runs, untrusted-library fuzzing under ASan, validator-necessity check | 4 | 3 | 4 | 4 | 4 | 4 | **23** | 2 days on libyaml and libpng: semantic holes under 30%, overhead ≤25% |
| 3 | **Format Foundry**: a codec for each format it meets | `flip2/06` ONE bet, OpenZL descriptions (never pursued) | Per-format SDDL descriptions and plans; later, proven transforms | Fixed universal decoder round-trip, held-out bytes, speed floor | 4 | 3 | 4 | 2 | 4 | 4 | 21 | 2 weeks on 10 formats: ≥15% over the best baseline on ≥6 of them |
| 4 | Mealy Foundry (reserve) | `flip2/06` §3.5, LLM mappers ("niche market") | Mappers and learned protocol models | Live implementations plus conformance testing | 3 | 3 | 3 | 4 | 4 | 3 | 20 | Does an LLM mapper learn a TLS 1.3 model as large as the hand-written one? |
| 5 | Receipts (reserve) | `flip2/06` §3.3, certificate-carrying code | Certifying solvers | Small verified checkers | 4 | 2 | 3 | 3 | 5 | 3 | 20 | Held-out wrong-answer rate with and without certificates (`flip2/06:238–242`) |
| 6 | Evolved QEC decoders (reserve) | `flip2/06` §3.2 | Decoder programs | Stim circuit-level simulation | 4 | 3 | 2 | 3 | 3 | 2 | 17 | Beat tuned Relay-BP at equal op budget, after HLS synthesis |

**ONE pick: Carve.**
- **The seed:** a verified practitioner prediction of the GrowOS kind ("not just for JavaScript, but for any low
  density context dependent language").
- **The check:** an oracle that is public and uneditable (each language's own lexer), and a number that cannot be faked
  (GB/s at token identity).
- **Fit:** compiler and systems work the builder is good at, a demo that works on a laptop, and a 3-day kill test.

**Runner-up: Boxed.** It has the clearer value, but it sits close to the rejected Fil-C item, and the builder has called
security tools "not exciting" (§13 #4).

**TL;DR**
1. Of 468 inventory rows (about 1,000 killed ideas), 98.5% stay dead under the tailwind filter. A third are taken by
   teams still active in 2026. Most of the rest are tools a prompt can write, or institutions that need people.
2. Three ideas come back, all with the same shape: a one-off human precedent, a public oracle, and per-case labour that
   agents remove. They are Carve (SIMD lexers for every language), Boxed (RLBox boxes for C libraries) and Format
   Foundry (OpenZL codecs per format, exposed to Meta's roadmap).
3. Pick Carve: a verified ViteConf 2026 seed, official lexers as the oracle, an honest GB/s number, and a kill test in
   three days.
