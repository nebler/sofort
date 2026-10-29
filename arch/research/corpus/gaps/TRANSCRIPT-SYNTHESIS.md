# Transcript gap synthesis — E20–E27

Research date: **2026-10-29**. Scope: gap analysis, not development of the existing shortlist. Read both briefs and all eight complete extractions, [E20](../extract/E20.md), [E21](../extract/E21.md), [E22](../extract/E22.md), [E23](../extract/E23.md), [E24](../extract/E24.md), [E25](../extract/E25.md), [E26](../extract/E26.md), [E27](../extract/E27.md). Raw transcripts were inspected selectively for the six quote checks below; metadata was scanned across the files. **Q** = caption quotation; **F** = sourced observation; **I** = inference; **E** = estimate. Proposed artifacts, oracles, rankings and research questions are I/E, not demonstrated implementations.

**I — Main discovery:** these communities add precise boundaries where an existing correctness story stops: source proof versus compiled memory consumption; instruction semantics versus peripheral timing; valid eBPF programs versus compatible compositions; connected road tiles versus comfortable traversal. They offer better practitioner seeds than another generic agent-plus-tests proposal. They do **not** establish an untaken project that passes every filter. Source-facing compiled memory bounds are the strongest remaining research lead; Verilator and eBPF need substantially narrower novelty claims. A fresh check kills the broad CPU ray-query proposal: concrete implementations are already under review.

## What coverage actually changed

**F — Acquisition and counting audit.** [G09](G09-videos-pl-systems.md) and [G10](G10-videos-hw-games-sec.md) each nominate 40 distinct videos. Joining their ranked YouTube IDs against actual `g1-01…40` and `g2-01…40` headers gives 80/80 exact matches, 80 downloaded slots, **80 unique video IDs**, and no overlap with the preceding 152 corpus videos. The current corpus directory therefore contains **232 files / 232 IDs**. The separate [Connect26 transcript directory](../../connect26/transcripts/) adds 13 distinct IDs, giving **245 files / 245 IDs** across those two directories. The brief's earlier 165 was 152 + 13, not 165 files in this corpus directory. Uniqueness means video identity, not independent speakers, claims or ideas.

| F — Count | PL/systems g1 | Hardware/games/etc. g2 | Added total |
|---|---:|---:|---:|
| Downloaded slots / unique IDs | 40 / 40 | 40 / 40 | 80 / 80 |
| Listed duration | 28:35:07 | 31:59:54 | **60:35:01** |
| Raw timestamp buckets | 1,733 | 1,933 | **3,666** |
| Whitespace-delimited raw words, including headers | 297,133 | 319,765 | **616,898** |
| Extraction signal-ledger rows | 1,675 | 1,647 | **3,322** |

**F — Ledger definition:** count Markdown rows beginning with a g1/g2 slot and a timestamp containing a colon. This counts signal records, including multiple records from one minute; it excludes summary, candidate and audit tables. Counts are E20 **576**, E21 **376**, E22 **320**, E23 **403**, E24 **443**, E25 **406**, E26 **438**, E27 **360**. Rows are neither unique quotations nor independent opportunities. Reproduce the central file/row counts from the repository root, without Python:

```sh
node <<'NODE'
const fs = require('node:fs');
const base = 'arch/research/corpus';
let signals = 0;
for (let n = 20; n <= 27; n++) {
  const s = fs.readFileSync(`${base}/extract/E${n}.md`, 'utf8');
  const count = s.split('\n').filter(l =>
    /^\|\s*g[12]-\d{2}\s*\|\s*\d+(?::\d+){1,2}/.test(l)).length;
  signals += count; console.log(`E${n}`, count);
}
const scan = dir => fs.readdirSync(dir).filter(f => f.endsWith('.txt')).map(f => {
  const s = fs.readFileSync(`${dir}/${f}`, 'utf8');
  const header = s.split('\n').slice(0, 2).join('\n');
  const id = header.match(/[?&]v=([\w-]{11})/)?.[1];
  if (!id) throw Error(`Missing ID: ${f}`);
  return { f, s, id };
});
const corpus = scan(`${base}/transcripts`);
const added = corpus.filter(x => /^g[12]-\d{2}-/.test(x.f));
const old = corpus.filter(x => !/^g[12]-\d{2}-/.test(x.f));
const connect = scan('arch/research/connect26/transcripts');
const unique = xs => new Set(xs.map(x => x.id)).size;
console.log({ signals, added: [added.length, unique(added)],
  corpus: [corpus.length, unique(corpus)], connect: [connect.length, unique(connect)],
  combined: [corpus.length + connect.length, unique([...corpus, ...connect])],
  overlapOld: added.filter(x => old.some(y => y.id === x.id)).length,
  buckets: added.reduce((n, x) => n + (x.s.match(/^\[\d+(?::\d{2}){1,2}\]/gm) || []).length, 0),
  words: added.reduce((n, x) => n + x.s.trim().split(/\s+/).length, 0) });
NODE
```

**F — Community mix:** G09 supplies 40 PL/systems talks: language and compiler researchers, Rust/OCaml/Zig practitioners, database builders, runtime and testing engineers. G10's mutually exclusive editorial categories are hardware/EDA **9**, games **8**, defensive/hardware security **9**, graphics **7**, networking **7**. These categories classify primary subjects, not every topic discussed. Across the two queues there are **30 uploader labels**. TigerBeetle and FOSSi contribute seven slots each; ACM SIGPLAN six; Rust Foundation, CMU Database Group, USENIX and GDC five each. Those seven labels account for **40/80 slots**. Uploader labels are taken from G09/G10, since some raw headers use an event/title instead of the uploader. Three Hot Chips files contain eleven presentations plus questions; a video is not a uniform-sized observation. The repeated ending in g2-40 15:00–19:00 is not additional independent evidence. [G09](G09-videos-pl-systems.md), [G10](G10-videos-hw-games-sec.md), [E26](../extract/E26.md), [E27](../extract/E27.md).

**F/I — Selection limits:** upload years are 2024 **8**, 2025 **59**, 2026 **13**; upload date is not event date. The queues were deliberately selected for English captions, long technical talks, Q&A and roadmaps. G09/G10 record ten videos with an uploaded English subtitle option and seventy with only automatic English available. Actual raw source headers say `en-orig` in 79 files and `en` in one, the English presentation/interpretation of Nintendo's talk. That header does not preserve full fetch provenance or independently establish caption accuracy. There are **zero direct non-English transcript sources** in this batch. The selection favors recorded conference speakers, maintainers, public successes and vendor roadmaps; it cannot estimate how common a pain is among practitioners. Multiple Slang talks, recurring speakers and venue clusters are corroboration, not independent votes. ASR damages names, code and numbers; slides and omitted demonstrations matter. [G09](G09-videos-pl-systems.md), [G10](G10-videos-hw-games-sec.md), [E25](../extract/E25.md), [E27](../extract/E27.md).

## Six headline quotations checked against raw minute buckets

**F — Method:** each exact short quotation below occurs in the linked raw bucket. Attribution follows the extraction's speaker/context register. This verifies caption text, not audio; timestamps locate one-minute buckets, not exact utterance seconds. Ellipses are avoided so ASR repairs are not silently presented as speech.

| Q — Speaker and raw location | Exact caption fragment | What it supports, and its limit |
|---|---|---|
| Magnus Myreen, [g1-01][r01], 35:00; context 28:00–36:00 | “it's really ugly to work with” | Existing compiled space-cost reasoning is awkward. The next bucket's small-program limitation is garbled; use paraphrase, not a polished invented quotation. |
| Yong, answering the CPU ray-tracing question, [g2-07][r07], 1:01:00; question 1:00:00 | “we haven't been prioritizing that work yet” | A historical request, not a current empty market. The 2026 PRs below supersede the broad opportunity claim. |
| Verilator maintainer, [g2-08][r08], 15:00; audience question 14:00 | “we're not working on this actively right now” | A small UVM change causing extensive C++ churn was acknowledged. Neither a fix nor permanent abandonment follows. |
| Satnam Singh, [g1-21][r21], 1:03:00 | “dynamic configuration was hard to sell because it was hard to verify” | Verification of transitions mattered. He also describes historical proof work; formal reconfiguration is not a new invention. |
| Prashant Kannan, [g2-36][r36], 20:00; Q&A 19:00–21:00 | “we'll have to rethink how we're going to do this” | NetEdit's black-box feature composition lacks a settled answer in that talk. It says nothing about all subsequent work. |
| Colin, [g2-26][r26], 24:00; geometry discussion 22:00–25:00 | “QA team of two people” | A concrete scale mismatch during procedural generation. “hundreds of thousands of tests” and “zero generation bugs” at 25:00 are reported testing/launch outcomes, not completeness proofs. |

## Twelve practitioner seeds and their remaining boundaries

“New” below means newly surfaced by this expansion relative to the excluded shortlist. It does not mean invented here or absent from prior art. **Taken** means the broad capability has concrete existing work; **open residual** means a specific missing boundary is evidenced, with novelty still to establish; **unresolved** means the supposed gap or oracle remains uncertain. Other than the live audits in the next section, prior-art dispositions inherit E20–E27's triage and were not all independently re-audited. All six-week scopes and kills are proposed research tests; none was executed.

### S01 — Source-facing compiled memory bounds

**Seed F/Q:** Myreen's memory discussion and awkward intermediate-language proofs, [g1-01][r01] 28:00–36:00. **I — Value/growth:** accumulate source-level space lemmas and checked translations into CakeML's existing compiled-space theorem, so a source proof states an actual executable's memory requirement. The fixed oracle must include GC roots, stack, compiler configuration and external-call assumptions. Better models could grow and repair the bridge; accumulated linked proofs are the hypothesized one-shot barrier, not proof-writing alone. **E — Six weeks/demo:** one allocating loop, one list/container transformation, and an optimization that changes retention; show the binary-bound certificate changing correctly. **Status:** unresolved but strongest integration lead; detailed audit below. **Kill:** existing tooling already supplies this join, or useful bounds require effectively reimplementing each compiler pass in source annotations. [E20](../extract/E20.md).

### S02 — Incremental verification-model compilation beyond C++ cache stability

**Seed F/Q:** the one-line-UVM-edit rebuild question, [g2-08][r08] 14:00–15:00. **I — Value/growth:** grow independently reusable class/type/layout compilation units inside an explicitly dependency-tracked simulation architecture. Oracles compare event/state traces against unchanged Verilator and measure edit-to-run time plus simulation throughput. The valuable artifact would be preserved semantic boundaries, not an agent selecting compiler flags; stronger models help extend supported constructs. **E — Six weeks/demo:** one public class-heavy testbench, a fixed edit suite and cold/warm timing distributions. **Status:** broad incremental compilation is taken; architectural residual unresolved. Stable filenames/ccache alone are specifically disfavored by current maintainer evidence. **Kill:** existing splitting/hierarchical modes solve the measured edits, or throughput/layout coupling removes the benefit. [E24](../extract/E24.md); live audit below.

### S03 — Cross-hook eBPF feature-transition contracts

**Seed F/Q:** Kannan's black-box interactions and production issues, [g2-36][r36] 19:00–21:00. **I — Value/growth:** grow user-space summaries and checked adapters for two existing hooks sharing a socket lifecycle, including version transitions. Freeze hook semantics, map ownership and intended feature behavior outside the generator; add counterexamples and proofs to the retained compatibility layer. Better models could cover more interactions, but only an actual kernel-mediated state model creates a one-shot barrier. **E — Six weeks/demo:** one open two-feature counterexample, reproduced and rejected during an upgrade without rejecting harmless compositions. **Status:** generic composition, interference checks and transactional manifests are taken/active; narrower residual unresolved. **Kill:** DRACO, KRAKENGUARD or current contract work handles the same case, or modeling the required Linux state exceeds solo scope. [E27](../extract/E27.md); live audit below.

### S04 — Checked stateful FPGA reconfiguration controllers

**Seed F/Q:** Singh, [g1-21][r21] 1:02:00–1:03:00. **I — Value/growth:** grow application-specific quiesce, drain, state-transfer and restart controllers, checked against a fixed transition relation, protocol monitors and resource constraints. Correct configurations do not imply correct switching. Better models could extend the library of transition implementations; preserving state across heterogeneous configurations is the proposed accumulated value. **E — Six weeks/demo:** two small streaming configurations with in-flight data, a deliberately faulty switch, and a checked working controller. **Status:** verification and reconfiguration already exist, including work described by Singh; reusable application-transition synthesis is unresolved. **Kill:** ordinary protocol/controller templates suffice, or essential timing/vendor details require inaccessible hardware data. This grows controllers, not an OS. [E22](../extract/E22.md).

### S05 — CPU-hosted bus/peripheral abstractions with explicit fidelity

**Seed F:** Cantabria's presenter distinguishes Spike instruction behavior from timing and costly simulator adaptation, [g2-40][r40] 02:00, 06:00, 08:00, 12:00–13:00. **I — Value/growth:** accumulate executable peripheral/bus abstractions retaining interrupt and I/O ordering under a declared timing envelope, falling back to RTL outside it. Separate instruction, ordering and timing oracles; a fast ISA model supplies only the former. Better models could extend supported behavior against public RTL. **E — Six weeks/demo:** one UART/DMA-style peripheral, held-out traffic, rejected timing counterexample, speed measured at equal fidelity. **Status:** Spike-RTL, Golden Gate and simulator-generation frameworks occupy the broad direction; CPU-hosted residual unresolved. **Kill:** integration dominates savings or the timing envelope does not generalize. Do not reuse the talk's preliminary speed/error figures as a universal result. [E27](../extract/E27.md).

### S06 — Body-checked interior-mutability dependency summaries

**Seed F:** Justus Adam describes Paralegal's manual models and interior-mutability approximation, [g1-29][r29] 05:00, 15:00–17:00. **I — Value/growth:** grow summaries that expose hidden data dependencies and check each summary against a bounded Rust/MIR body semantics. A frozen privacy-flow specification then consumes them. Better models help cover library idioms; checked summary composition is the hypothesized persistent value. **E — Six weeks/demo:** one `RefCell`-style wrapper and one privacy flow previously hidden by reference-based approximation. **Status:** Paralegal already analyzes flows; Mendel and trusted capability annotations overlap. A body-to-summary checked bridge is unresolved. **Kill:** soundness requires modeling unrestricted unsafe code, or existing annotations solve the example cheaply. Owner intent and incomplete external models remain assumptions. [E22](../extract/E22.md).

### S07 — A finite, camera-safe road geometry vocabulary

**Seed F/Q:** Marielle Fox and Colin's missing tile shapes and bad camera turns, [g2-26][r26] 18:00–25:00, 48:00–50:00. **I — Value/growth:** extend actual junction/connector meshes within a finite road grammar, with fixed connectivity, curvature, clearance and camera-motion contracts. Better models add realizable pieces rather than merely sampling more arrangements; the retained checked basis is the proposed barrier to one-shot replacement. **E — Six weeks/demo:** request an unsupported diagonal junction, grow the missing piece, then traverse every allowed local composition. **Status:** Red Hook solved its own basis; Tessera/DeBroglie already assemble constrained tiles. Generalization beyond that basis is unresolved. **Kill:** a small hand-authored library suffices or desirable art cannot be expressed by the chosen oracle. This is a geometric vocabulary, not another general game-mechanics proposal. [E26](../extract/E26.md).

### S08 — Cancellation-correct async compositions

**Seed F:** Rain distinguishes local cancellation safety from nonlocal correctness and partial I/O progress, [g1-19][r19] 12:00–20:00, 28:00–29:00. **I — Value/growth:** grow adapters/state machines for particular compositions, preserving commit/progress invariants across cancellation points. Freeze scheduling semantics and external effects; a model checker plus explicit state invariants checks additions. Stronger models could cover more protocols; neither more unit tests nor a generic Rust assistant supplies the claimed barrier. **E — Six weeks/demo:** two cancel-safe operations whose composition loses progress, followed by an adapter preserving it under all bounded schedules. **Status:** cancellation libraries, RobustMutex and the cited research already occupy major pieces; unsupported composition not yet identified. **Kill:** existing primitives fix the example directly, or finite schedules are the only possible guarantee. [E21](../extract/E21.md).

### S09 — Observation consumers with loss/order/CPU contracts

**Seed F:** Zain Malik and Grzegorz Głąb's eBPF rollout incident and high-core reproduction, [g2-14][r14] 18:00–26:00. **I — Value/growth:** grow user-space event consumption, batching and overload behaviors against declared loss, ordering, latency and CPU budgets. Keep kernel transports unchanged and benchmark both perf/ring variants: the talk does not establish one universal winner. Better models could extend workload-specific implementations; retained semantic contracts plus adversarial workloads are the proposed barrier. **E — Six weeks/demo:** reproduce a public high-core failure pattern and compare a stock tuned consumer against a grown one under equal loss budgets. **Status:** transport selection and tuning are taken; reusable contract-preserving consumers unresolved. **Kill:** stock batching/affinity achieves the result, or performance depends on unavailable production traces. [E25](../extract/E25.md).

### S10 — Energy-adaptive peripheral/application behavior

**Seed F:** Ben Calhoun's graceful capability reduction and firmware policy hooks, [g2-30][r30] 37:00, 50:00–52:00, 57:00–58:00. **I — Value/growth:** accumulate application policies that quiesce peripherals, preserve useful service and recover under abrupt energy loss. Freeze peripheral contracts and board-calibrated energy/timing models; check power traces plus declared state invariants. Better models extend policies, but they cannot invent trustworthy physical calibration. **E — Six weeks/demo:** one purchasable board, one sensor/radio pair, repeatable power interruption and service-quality comparison. **Status:** Everactive, ETAP, energy-harvesting compiler optimization and DIPS already cover substantial ground; application-specific residual unresolved. **Kill:** existing systems already express the behavior, or proprietary silicon is necessary. This does not establish robotics coverage. [E26](../extract/E26.md).

### S11 — Approval independence under a declared authority model

**Seed F:** Dino Dai Zovi's shared-administrator failure domains, [g2-12][r12] 43:00–45:00; supply-chain corroboration in [E25](../extract/E25.md), g2-15 12:00–21:00. **I — Value/growth:** grow deployable approval arrangements and checked adapters under an explicit graph of administrators, credentials, CI roots and recovery authority. The oracle checks stated independence assumptions; missing authorities must produce “unknown.” Better models extend integrations; value requires executing a separation invariant, not generating a diagram. **E — Six weeks/demo:** two apparently independent approvals with a shared recovery root, then a corrected public sandbox configuration. **Status:** multiparty approval systems already exist; residual unresolved and private-configuration risk high. **Kill:** existing policy checks express the invariant, or collecting a truthful authority graph requires organizational participation. A graph proof cannot certify unlisted relationships. [E25](../extract/E25.md).

### S12 — CPU ray-query support: retain the seed, drop the broad pitch

**Seed F/Q:** CPU ray-query request, [g2-07][r07] 1:00:00–1:01:00; Slang's later heterogeneous work, [E25](../extract/E25.md), g2-19 07:00–09:00, 28:00–29:00. **I — Original shape:** grow CPU implementations under a fixed shader/ray-query ABI and conformance scenes; better models expand semantics and preserve retained compatibility. **E — Six weeks/demo:** a CPU-rendered scene exercising candidate traversal and instance transforms. **Status: taken / being built.** The live PRs below implement that core, so there is no independent project recommendation or reason to spend six weeks duplicating it. **Kill:** already satisfied by current primary evidence. Unimplemented motion/refit cases are backlog items, not automatic evidence for a separate opportunity. [E24](../extract/E24.md).

## Current primary-source audits: the three leading questions

**F — S01, memory bounds.** [Do You Have Space for Dessert? (OOPSLA 2020)](https://cakeml.org/oopsla20.pdf), especially §2.3, already connects a concrete heap/stack cost semantics at CakeML's DataLang level to generated machine code. In plain terms, it can justify that enough memory is available; the difficulty is making programmers reason about a compiler intermediate representation. Its discussion explains why a useful source-level account must accommodate allocation transformations rather than simply count source allocations.

[A High-Level Separation Logic for Heap Space under Garbage Collection (POPL 2023)](https://iris-project.org/pdfs/2023-popl-diamonds.pdf), §2.1, instead provides high-level reasoning about which objects remain reachable, including roots and closures, in a formal language using Coq/Iris. It explicitly presents that work as complementary to CakeML, with adaptation to DataLang left as integration work. The current [CakeML projects page](https://cakeml.org/projects.html) lists space-cost work among currently idle projects. **I — Residual:** joining convenient source proofs to actual compiler/GC bounds is plausible; neither paper nor that project listing proves nobody subsequently joined them. This is an integration question, not a proposal for another verified compiler or generic proof agent. Search and prototype that join before treating S01 as open.

**F — S02, Verilator.** [Issue #2958](https://github.com/verilator/verilator/issues/2958) documents C++ changes preventing effective ccache reuse. Earlier splitting work improved reuse in a particular OpenTitan configuration; it did not establish stable incremental behavior for every edit. Crucially, the issue was **closed on 2026-03-21**, and the [closing maintainer comment](https://github.com/verilator/verilator/issues/2958#issuecomment-4103174957) says shared precompiled-header dependencies make even an added variable force recompilation, while newer optimizations make stable C++ harder. Closure does not mean the original pain was fixed.

The current [Verilator argument documentation](https://verilator.org/guide/latest/exe_verilator.html#cmdoption-output-groups) already supplies output splitting/grouping and warns about caching tradeoffs. **I — Residual:** “generate stable C++” repeats an old approach that the maintainer explicitly rejects as the right solution. Only a measured architectural alternative that handles dependency/layout coupling while retaining simulation speed remains worth investigating. No evidence here establishes that such an alternative is feasible, much less untaken. S02 ranks highly as a concrete research question, with a low openness score.

**F — S03, eBPF composition.** [DRACO: Towards Functional Verification of eBPF Programs (2024)](https://marioskogias.github.io/docs/draco.pdf), §3.2, goes beyond the kernel verifier by checking intended behavior and relevant map/packet dependencies; its evaluated focus is XDP, leaving dependencies on other internal kernel state for later. In plain terms, passing the kernel verifier says too little about what a feature does, while DRACO checks more of that intent. Its stated scope does not itself settle cross-hook socket lifecycle interactions.

But 2026 is no longer empty: [KRAKENGUARD, NSDI 2026](https://www.usenix.org/conference/nsdi26/presentation/patel) checks load-time policies and cross-program interference, and [vBPF, OSDI 2026](https://www.usenix.org/conference/osdi26/presentation/zhang-jing) supplies tenant attribution, dispatch and state isolation. These are substantive composition/isolation mechanisms, though isolated tenants are not the same question as intentionally cooperating features sharing state. [Yaksha-Prashna (2026)](https://arxiv.org/abs/2602.11232) also addresses bytecode conformance and dependencies. **I:** none should be dismissed on the strength of an older talk.

Moreover, Eunomia's 2026 primary [hook-composition contract notes](https://eunomia.dev/research/ebpf-hook-composition-contract/) and [stateful transactional-upgrade notes](https://eunomia.dev/research/stateful-ebpf-transactional-upgrade/) already describe typed composition manifests, ownership and versioned chain transitions. These are research designs, not evidence of a released complete implementation, but they defeat a broad conceptual novelty claim. **I — Residual:** establish one exact kernel-mediated two-hook case outside these systems, then ask whether a small fixed semantics can verify it. Until that comparison, mark S03 unresolved rather than open.

**F — Additional novelty correction, S12.** As checked through the live GitHub API on 2026-10-29, [slang-rhi PR #803](https://github.com/shader-slang/slang-rhi/pull/803), created July 30 and updated October 4, is open, unmerged and not a draft. It implements TinyBVH-backed CPU acceleration structures and ray queries, with triangle/procedural geometry and instances. Its dependency, [Slang PR #12282](https://github.com/shader-slang/slang/pull/12282), is also open/unmerged/not a draft, updated October 28; it adds the CPU provider ABI, prelude/intrinsics and tests. The [main API matrix](https://github.com/shader-slang/slang-rhi/blob/main/docs/api.md) still marks CPU acceleration/ray-pipeline entries unsupported. An unsupported release matrix therefore does not imply an unoccupied project. Author-reported test passes were not rerun here; ray-query support is also narrower than a complete ray-tracing pipeline. **I:** drop the broad proposal, or contribute upstream within a separately authorized task.

## What the new communities add, and what remains missing

**F/I — PL and systems:** memory exhaustion, cancellation, unsafe/interior-mutability models and determinism show that a locally correct component can invalidate an end-to-end claim. TigerBeetle's four fuzzers missed an intersection of query behavior and out-of-order values ([E21](../extract/E21.md), g1-12 32:00–34:00); serial replay can mask a parallel bug ([E22](../extract/E22.md), g1-30 14:00–15:00). The lesson is to specify the missing relation, not merely add more tests. New evidence for existing T07 directions—procedural IVM and compact variable-tail storage—is corroboration only, not a re-pitch ([E23](../extract/E23.md), g1-32 37:00–38:00; g1-35).

**F/I — Hardware and graphics:** the oracle itself becomes an engineering project. A verified hardware transformation inherits the correctness of primitive models ([E24](../extract/E24.md), g2-02 32:00–34:00); checking generator instances is weaker than checking all parameters ([E26](../extract/E26.md), g2-23 19:00–20:00). CPU/GPU performance comparisons depend on workload, ABI, synchronization and physical calibration. This supports explicit, restricted contracts; it does not reopen the rejected cross-GPU numerical atlas or generic kernel-agent proposals.

**F/I — Games:** connections, traversal, camera motion, art direction and authoring effort are distinct criteria. Road generation supplies a concrete finite geometric problem; vehicle feel and mechanical sound expose valuable but weaker measurement/perceptual oracles ([E25](../extract/E25.md), g2-17 46:00–56:00; g2-18 56:00–59:00). A numerical score cannot establish an artist's intent. Generic simulation/game growth would overlap excluded work; S07 is deliberately bounded.

**F/I — Security and networking:** authority dependencies, compositional state, rollout behavior and overhead matter beyond local verifier acceptance. The Retina incident's high-core consumer cost is not captured by a four-core throughput check ([g2-14][r14] 18:00–26:00). NetEdit provides real orchestration already, while Homa's Q&A contests queue and fairness explanations ([E25](../extract/E25.md), g2-20 27:00–32:00). Neither talk licenses a universal performance improvement claim.

| Gap from the brief / additional blind spot | Assessment after this batch |
|---|---|
| Almost no PL/systems, hardware, games, graphics, security or networking transcripts | **Closed as a presence gap.** The 80-ID expansion is substantive. Depth, representativeness and idea-search exhaustion remain unestablished. [G09](G09-videos-pl-systems.md), [G10](G10-videos-hw-games-sec.md). |
| Papers and issue trackers absent | **Partially closed across the wider gap round.** [G08](G08-papers-trackers.md) separately reports 16 paper seeds and 24 tracker/mailing-list seeds; this report adds targeted primary audits. E20–E27 are principally conference transcripts plus prior-art checks, not representative sampling of practitioners' open backlogs. |
| Audio DSP | **Partial/incidental.** Vehicle and Nintendo sound, WebGPU FFT and the Spike-RTL I²S example touch audio; dedicated DSP compilers, real-time plugin authors and production audio issue workflows remain unsampled here. [E25](../extract/E25.md), [E27](../extract/E27.md). |
| Embedded | **Partial.** CHERIoT, harvested-energy firmware and bus/peripheral simulation are present. Broad embedded control, firmware maintenance and field reliability are not covered by these examples. [E26](../extract/E26.md), [E27](../extract/E27.md). |
| Robotics | **Still untouched as a dedicated community.** No dedicated ROS/control/robotics practitioner series was selected; hardware presence cannot substitute for it. [G09](G09-videos-pl-systems.md), [G10](G10-videos-hw-games-sec.md). |
| Direct non-English sources | **Still untouched.** One English-interpreted Japanese talk is not native-language community coverage; all 80 fetched texts are English. Raw source headers; [G10](G10-videos-hw-games-sec.md). |
| Inverse-oracle search and old killed ideas | **Outside this synthesis.** Separate gap reports address those methods; this transcript expansion does not establish either search as exhausted. [Gap summary](SUMMARY.md), [brief](../BRIEF-gaps.md). |
| A genuinely untaken, ambitious, solo, no-users-needed tailwind project | **Unresolved.** Twelve seeds are not twelve validated proposals. The primary audits reduce the broad novelty claims rather than certify a winner. |

**I — Bounded next questions:** (1) For S01, can a source-level root/liveness assertion for one allocating loop be translated into the existing DataLang space theorem without duplicating compiler execution? Check current CakeML proof code and the POPL authors' subsequent work before implementation. (2) For S02, which public UVM edit class remains expensive under current split/hierarchical/PCH configurations, and can one dependency boundary improve total edit-to-run time without harming simulation throughput? (3) For S03, name one shared-socket-state/version counterexample not handled by the 2026 systems; abandon the lead if none survives comparison. These are small falsification inquiries, not permission to build three broad platforms.

**I — Next source sample:** select a bounded set of dedicated audio-DSP and robotics/embedded talks, including native non-English sources, plus current maintainer issue threads recording repeated failures, workarounds and rejected designs. Preserve caption provenance and distinguish request, proposed solution, merged implementation and released capability. This addresses remaining selection holes; another batch cannot certify that all interesting ideas have been searched.

**I — Guarantee limit:** finite tests establish outcomes on sampled inputs, not universal correctness. Proofs establish a fixed statement under a particular semantics and assumptions; an agent that weakens that statement has not improved the system ([E20](../extract/E20.md), g1-06 15:00). The proposed ratchet needs an oracle/specification the generator cannot edit, provenance and revocation when specifications, dependencies or environments change. Persisted code alone is neither a tailwind moat nor a forever-valid guarantee. No prototypes, performance benchmarks, six-week demos or kill tests were executed for this synthesis.

[r01]: ../transcripts/g1-01-acm-sigplan-pldi24-much-still-to-do-in-compiler-verification-a-perspec.txt
[r07]: ../transcripts/g2-07-the-khronos-group-developing-with-slang-tools-techniques-and-future-di.txt
[r08]: ../transcripts/g2-08-fossi-foundation-next-big-step-for-verilator-towards-four-state-logic-.txt
[r21]: ../transcripts/g1-21-acm-sigplan-icfp-25-functional-programming-for-hardware-design.txt
[r36]: ../transcripts/g2-36-acm-sigcomm-sigcomm-24-netedit-network-ebpf-orchestration-platform.txt
[r26]: ../transcripts/g2-26-gdc-festival-of-gaming-evolving-worlds-from-chaos-the-art-led-approach.txt
[r40]: ../transcripts/g2-40-risc-v-international-spike-rtl-quasi-cycle-accuracy-hardware-software-.txt
[r29]: ../transcripts/g1-29-usenix-osdi-25-paralegal-practical-static-analysis-for-privacy-bugs.txt
[r19]: ../transcripts/g1-19-rustconf-2025-rust-foundation-rain-cancelling-async-rust.txt
[r14]: ../transcripts/g2-14-cncf-cloud-native-computing-foundation-when-an-ebpf-rollout-brought-do.txt
[r30]: ../transcripts/g2-30-hotchipsvideos-hc2025-s6-power-methodology.txt
[r12]: ../transcripts/g2-12-offensivecon-offensivecon25-dino-dai-zovi-keynote-how-offensive-securi.txt

## Ranked research questions, not validated product recommendations

**I/E — Scores 1–5:** Tail = model tailwind; Cool = subjective interest; Value = value if successful; Open = apparent remaining space after known overlap; Solo = feasibility; Demo = demonstration clarity. Higher is better. Open scores express weak comparative evidence, not probabilities or assertions of absence. Rank prioritizes the next research question, not a summed score. **Pick: S01 for a bounded integration audit; no all-filter winner yet.**

| Rank | Seed | Tail | Cool | Value | Open | Solo | Demo | Disposition |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| 1 | S01 Source-facing compiled memory bounds | 5 | 4 | 4 | 3 | 2 | 4 | Plausible residual; integration unresolved |
| 2 | S02 Incremental verification-model compilation | 4 | 4 | 4 | 1 | 3 | 4 | Broad work taken; architecture unresolved |
| 3 | S03 Cross-hook eBPF transitions | 4 | 4 | 4 | 1 | 2 | 4 | Active overlapping work; exact case needed |
| 4 | S04 Stateful FPGA reconfiguration | 4 | 5 | 4 | 2 | 2 | 5 | Existing proofs; reusable residual unclear |
| 5 | S05 Timed bus/peripheral abstractions | 4 | 4 | 4 | 2 | 3 | 4 | Broad work taken; fidelity/cost unresolved |
| 6 | S06 Interior-mutability summaries | 4 | 3 | 4 | 2 | 3 | 4 | Sound checked bridge unresolved |
| 7 | S07 Camera-safe road vocabulary | 4 | 4 | 3 | 2 | 4 | 5 | Particular basis solved; extension unclear |
| 8 | S08 Async cancellation compositions | 4 | 3 | 4 | 1 | 3 | 4 | Need example beyond existing primitives |
| 9 | S09 Contracted observation consumers | 4 | 3 | 4 | 2 | 3 | 4 | Could collapse into ordinary tuning |
| 10 | S10 Energy-adaptive peripheral behavior | 4 | 4 | 4 | 2 | 2 | 5 | Heavy existing work/calibration burden |
| 11 | S11 Approval independence | 3 | 3 | 4 | 2 | 2 | 4 | Authority completeness/solo risk |
| 12 | S12 CPU ray queries | 4 | 4 | 4 | 1 | 3 | 5 | Taken / being built; drop broad pitch |

**TL;DR —** 80 new unique videos and 3,322 signal rows close broad community-presence gaps, not the search for worthwhile ideas.  
Source-facing compiled memory bounds merit the next bounded inquiry; Verilator and eBPF have sharp constraints, and CPU ray queries are already being built.  
Dedicated audio DSP, robotics, non-English sources and practitioner backlog sampling remain gaps; no all-filter winner or universal correctness claim is established.
