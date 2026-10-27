# Biology, evolution and artificial life: software populations with inherited lives

Research date: **2026-10-27**. Lens: biology, evolution and artificial life. Scope: ambitious applications of the capsule, followed by experiments that can disqualify them. This report is the only repository file written; no deployments, model experiments, runtime benchmarks or commits were performed.

**Claim labels:** **F** = sourced fact, including an explicitly attributed research or vendor result; **M-prior** = an existing local measurement, not reproduced here; **I** = inference, proposal or judgment; **E** = estimate, assumed budget or proposed experimental threshold. There are **no new M runtime results**. Cost arithmetic was checked locally; it remains **E**, because workload assumptions are unmeasured. Linked web sources were consulted on **2026-10-27**; publication dates or years appear beside historical claims. All proof plans are proposed, each separately taking an estimated 1–2 weeks with the common substrate below. All video scripts and tweets are **conditional drafts for after the corresponding proof**, not descriptions of completed experiments.

## The thesis

**I — The opportunity is software that inherits experience and earns the right to continue.** A capsule can carry an algorithm and its accumulated cache, partial solution, learned preferences, failure history and pending continuation. Forking offers controlled descendants from the same experienced individual. Sleeping makes it possible to preserve a useful minority that would otherwise be discarded. Migration lets those descendants encounter different workloads. Stronger models supply more competent mutations and recombinations; independent execution determines which deserve resources.

**I — My bet is an immune repair colony:** a failing integration forks at its last valid checkpoint, tries bounded repairs against the same incident, preserves successful specialists, and promotes a repair only after independent checks. The larger ambition is a worldwide population of services whose recovery experience becomes heritable executable material. The critical experiment is whether inherited live state improves recovery enough to justify a capsule rather than ordinary source search, JSON state or replay.

### What the ancestors actually established

- **F — Core War, Jones and Dewdney, March/May 1984:** Redcode programs compete inside a simulated memory machine. It supplies an adversarial arena, not an automatic connection between winning and useful work. [Original guidelines, March 1984](https://www.ccapitalia.net/descarga/docs/1984-core-war-guidelines.pdf); [Dewdney's original article, 1984-05-01](https://www.scientificamerican.com/article/computer-recreations-1984-05/). **I:** preserve the arena and reproducible contests; replace destructive memory competition with constrained service contracts.
- **F — Tierra, Ray, 1991/1992:** self-replicating programs compete for CPU time and memory; parasites, resistance and cooperation appeared. Ray's own future-work section explicitly distinguishes these organisms from useful application programs and proposes rewarding inserted application code. [1991 paper](https://tomray.me/pubs/alife2/Ray1991AnApproachToTheSynthesisOfLife.pdf); [1992 account](https://tomray.me/pubs/tierra/); [application-program limitation](https://tomray.me/pubs/tierra/node32.html). **I:** globally distributed digital organisms and computational metabolism are old ideas. Edge distribution alone does not supply a new purpose or a progress measure.
- **F — Avida, Lenski, Ofria, Pennock and Adami, 2003-05-08:** complex logic functions evolved through intermediates when simpler functions were also selectively rewarded; some initially harmful mutations became stepping stones. [Original Nature paper](https://www.nature.com/articles/nature01568). **I:** reward structure and retained stepping stones matter. This is evidence about a designed digital environment, not evidence that raw survival produces useful business software.
- **F — Koza, 1992:** genetic programming breeds executable programs using selection and program recombination. [Author's original chapter](https://www.genetic-programming.com/jkpdf/soucek1992.pdf). **I:** LLMs improve the proposal distribution over programs; they do not remove the search, evaluation or specification problems.

**I — “Organism” is an engineering model here, not a claim of consciousness or biological life.** These are domesticated populations: a trusted host controls resources, division and effects. A guest may request a child; it cannot mint execution rights. Replication success must follow externally verified utility. Selecting whoever creates the most copies would optimize a fork bomb.

## A substrate on which the ideas are meaningful

### Genome, phenotype, inheritance and death

**I — Use three separately versioned records.** The **genome** is source, policy/module hashes and the declared state schema. The **phenotype** is a compatible interpreter image plus its learned state and pending continuation. The **environment record** is a trusted journal cursor, evaluator version, workload identity, grants, remaining budgets and owner lease. A heap hash alone cannot reconstruct or authorize a living program.

**I — Division** references an immutable parent image, assigns a fresh child identity and splits a parent-funded resource allowance. Each running child still needs its own restored memory; the ordinary browser/Node Wasm API does not provide resident copy-on-write cloning. **Migration** transfers execution ownership using a lease epoch and rebinds destination tools. The sender loses its dispatch rights. **Sporulation** stores a restorable image and compatibility dependencies, then releases runtime memory. **Death** revokes the lease and reclaims execution resources; a tombstone and optional research specimen can remain. An **apoptosis** request is cooperative early exit, with host-enforced termination as the actual backstop.

**I — Mutation is not random editing of heap bytes.** Keep a fixed, inspectable event loop that calls a replaceable policy registry at explicit boundaries. Install a candidate function through the guest engine at quiescence and invoke it on subsequent decisions. A previously captured closure retains its original code and assumptions. If an edit changes those assumptions, restart/replay under the new genome or run a validated application-state migration. **Recombination** exchanges typed source modules or explicitly exported state; it does not concatenate two interpreter heaps. Record lineage as a DAG when descendants have several donors.

**I — “Epigenetics” means inherited non-code adaptation in this report:** two children with identical source can inherit different caches, learned thresholds or routing memories. Biology also has memory transmitted through cellular factors: Kundu and Peterson's **2010** yeast experiments attribute GAL transcriptional memory primarily to inherited signaling factors rather than novel chromatin structures. [Primary study, online 2010-03-08](https://pmc.ncbi.nlm.nih.gov/articles/PMC2863693/). **F** applies to that experimental finding; **I** applies to the software analogy. Heap inheritance is Lamarckian in the engineering sense that acquired state is deliberately retained; it is not a faithful model of genetic inheritance.

### Capsule constraints inherited from this repository

- **M-prior:** the [2026-10-25 Wasm spike](../portability/02-wasm.md) restored a parked QuickJS promise, closures and structured state across Wasmtime, Node, Chromium and **local** workerd/Dynamic Workers. The example was **99,854 gzip bytes**, with a separate compatible engine. It checkpointed with no active Wasm frames. Hosted edge execution, arbitrary stack capture and native-jitk-to-Wasm heap conversion were not established.
- **M-prior:** the [2026-10-27 roadblock report](../v8/03-roadblocks.md) found useful package/state examples around **1.5–6.4 MB compressed**, ineffective allocator accounting, non-shrinking linear memory, and roughly **5–11×** interpreter overhead versus direct V8 on the measured glue workloads. Freed payloads can remain in image bytes. **I:** resource limits and data minimization precede public evolution; clearing a JS reference does not sanitize a downloadable genome's phenotype.
- **F/local research:** the [landscape](../v8/02-landscape.md) documents QuickJS/Wasm heap snapshots, pending-promise durability and forks in neighboring systems. The [signal report](../v8/06-signal.md) favors a visible useful result with inspectable evidence. The [demo pitches](../../../demo.md) provide the pause/fork/move framing; the newer roadblock measurements supersede their small-image planning constants. **I:** none of these moonshots should sell ordinary snapshotting as the invention.
- **F/local design:** [GrowOS](../../jitk/grow/README.md) separates proposal generation from hidden probes, independent assertions and acceptance gates. **I:** borrow that experimental discipline for every evolutionary evaluator; do not propose a second kernel-growth project under a biological name.

**F — Cloudflare execution constraints, checked 2026-10-27:** Worker memory is **128 MB per isolate including Wasm**, shared across concurrent requests. Dynamic Workers support per-invocation CPU/subrequest limits; distinct in-flight children are limited to **4 per Worker request** and **10 per Durable Object I/O context**. [Worker limits](https://developers.cloudflare.com/workers/platform/limits/); [custom budgets, updated 2026-10-12](https://developers.cloudflare.com/dynamic-workers/usage/limits/); [concurrency, updated 2026-08-27](https://developers.cloudflare.com/dynamic-workers/platform/limits/).

**I — Shared implementation:** a TypeScript controller uses Queues for bounded evaluation work, R2 for content-addressed images/journals, sharded Durable Objects for population metadata and leases, and a fixed QuickJS/Wasm interpreter in Workers or Dynamic Workers for short slices. LLM requests run through a trusted host adapter; model weights and credentials do not live in capsules. Large numerical search or native verification can use Containers or a Node/native tool. Workflows can orchestrate rounds. Browser execution is an optional reproducibility destination. These are ordinary platform components, not a claim of arbitrary geographic placement: record actual placement and do not label logical niches as separate physical edge locations.

**I — Common evaluation rule:** candidates cannot write the grader, hidden cases, receipts, resource ledger or production authorization. During selection, tools are read-only or journal-backed simulations. Only a trusted promoter grants a selected branch a new bounded effect lease. Remote effects still need idempotency/reconciliation; promoting one branch does not magically resolve an external write with an unknown outcome. Pair descendants on identical input/journal prefixes, log their intentionally split randomness, and measure actual outcomes rather than image-byte equality.

## 1. Immune repair colonies: recover from the exact failing life

### Idea and 100× version

**I — One sentence:** capture a failing service's last valid state, clone it into competing repair attempts, and keep independently verified survivors as recovery memory. **100×:** every long-lived integration carries a repertoire of validated recovery phenotypes, so an outage anywhere creates reusable repair experience for compatible services elsewhere, including unusual states that source-only tests never exercise.

### Lineage, what stalled, and what changes

**F — Forrest et al., 1994** proposed self/non-self change detection with negative selection and explicitly described practical application as unresolved. [Original paper](https://conferences.computer.org/sp/pdfs/sp/1994/00044264.pdf). **F — de Castro and von Zuben, June 2002** implemented clonal selection and affinity maturation for recognition/optimization. [CLONALG](https://www.cs.unm.edu/~forrest/classes/immuno-class/readings/DeCastro.pdf). **I:** the useful translation is selective expansion of incident-matching repairs followed by retention, not an anomaly detector that declares every unfamiliar request malicious. “Self” is a signed contract/version; unfamiliar behavior is a triage signal.

**F — GenProg's 2012 study** reported patches for 55 of 105 defects using genetic program repair. [Original experiment](https://www.cs.cmu.edu/~clegoues/docs/legoues-icse2012-genprog-preprint.pdf). **F — Qi et al., 2015-05-29** found that evaluation errors and weak tests allowed many reported patches to be wrong or remove functionality. [Primary reanalysis](https://dspace.mit.edu/entities/publication/f994ba82-810b-4ea9-93b6-1573434eae3e). **I:** automated repair did not lack a biological metaphor. It lacked reliable correctness evidence and good search. Models improve semantic edits; capsules add the exact experienced incident, including warm internal structures. Neither fixes a bad oracle.

### Stronger models and value

**I:** stronger models should propose more state-compatible repairs and explain migration preconditions. The accumulated incident corpus and independently verified repair repertoire grow with use. A single future model may repair an easy incident immediately; the population remains useful for rare failures, independent validation and competing recovery strategies. **Who pays:** integration vendors, workflow platforms and SRE teams, for fewer stuck jobs, less incident diagnosis and less manual reconstruction of customer state. Start with read/transform integrations with clear semantic outputs.

### First proof in 1–2 weeks

**E — Days 1–3:** build a resumable pagination/normalization workflow with a Map, duplicate-detection history and a pending provider reply; introduce six documented fault classes such as schema drift, missing fields and changed pagination semantics. Freeze a separate held-out fixture set before proposals. **I:** the orchestrator remains fixed; only a normalizer/retry policy called after the pending reply may change. State-shape edits require explicit migration or replay.

**E — Days 4–7:** fork up to 16 children per incident, install model-proposed policy modules, deliver the same error/reply and evaluate against independent expected records and invariant checks. A deletion/empty-output mutant must fail. Keep successful repairs as bounded “memory cells.” **E — Days 8–10:** revive a successful phenotype on a second supported host, run related unseen faults, then qualify one hosted Worker path if available. Show rejected candidates, duplicated queue delivery and stale-owner rejection.

**I — Baselines:** same model/budget doing source-only repair from a fresh run; same model with journal replay; explicit JSON checkpoint recovery; fixed retries plus rollback. Count total model tokens, useful completed records, false repairs, bytes, recovery time and evaluator cost. **E — Success target:** reduce median end-to-end recovery time by at least 2× against the best baseline on held-out stateful incidents, with no accepted semantic failure in the bounded test set. This is a pilot gate, not proof of production correctness.

### Demo + conditional tweet

**I — 75 s:** a workflow fails halfway through a real-shaped dataset; freeze its state hash; show 16 descendants, including a fast wrong fix that loses records; reject it; resume a verified child with its Map/history intact on another host. End with held-out results and the effect ledger. Label fixtures and simulated writes on screen.

> A failed workflow became a repair colony. Its children inherited the same pending call and working state, tried different patches, and faced a separate grader. The survivor resumed elsewhere. QuickJS/Wasm prototype; fault fixtures and limits linked.

### Kill test

**E/I — Kill the capsule product if** the best replay/JSON/source-repair baseline reaches the same held-out recovery quality and comes within 20% of total recovery time and cost. Keep any useful repair algorithm; the organism substrate has then failed to earn its complexity. Any accepted “repair” that merely suppresses required output invalidates that run before this comparison.

## 2. Software ecotypes: a service that fits its habitat

### Idea and 100× version

**I — One sentence:** maintain a diverse population of stateful service specialists and route each workload to the lineage that fits it. **100×:** millions of per-tenant, per-workload service ecotypes adapt their cache, retry, batching and parsing behavior while preserving the same external contract; compatible specialists migrate and colonize new niches without relearning every operational lesson.

### Lineage, what stalled, and what changes

**F — Hutchinson, 1957** formalized niches as combinations of environmental conditions permitting persistence. [Original paper](https://www.wsl.ch/lud/biodiversity_events/papers/Hutchinson-1957bc.pdf). **F — Mouret and Clune, 2015-04-20** introduced MAP-Elites to retain high-performing solutions throughout a user-defined behavioral space. [Primary paper](https://arxiv.org/abs/1504.04909). **F — Cully et al., 2015-05-27** used a precomputed behavior repertoire to help damaged robots adapt in their experiments. [Primary paper](https://www.nature.com/articles/nature14422). **I:** a robust repertoire can be more valuable than one global champion. This is quality-diversity, not a guarantee that a larger model will spontaneously invent useful niches.

**I — Historical limit:** handcrafted representations/descriptors constrain what can be retained, and simulated fitness may not transfer. Today LLMs can generate semantic policy alternatives and propose descriptors, while actual request traces test them. Keep descriptors interpretable and fixed for each experiment; an optimizer allowed to redefine “diverse” can manufacture novelty. Whole-heap inheritance preserves acquired adaptation; the epigenetic analogy above explains why genome identity alone is insufficient.

### Stronger models and value

**I:** stronger models enlarge the policy family beyond tuning numeric thresholds: conditional batching, recognizing a provider's unusual rate-limit response, or choosing different indexes. Real tenant traces and state histories remain necessary even when generation becomes easy. **Who pays:** API aggregators, ingestion platforms and expensive agent-tool services, for lower upstream calls and fewer tail failures under tenant-specific conditions. Do not begin by replacing a mature CDN's global routing system.

### First proof in 1–2 weeks

**E:** implement a TypeScript API aggregator over a controlled provider with three workload habitats: hot repeated keys, broad cold scans, and bursts with throttling. Use an archive of 12–24 niches described by achieved cache footprint and upstream request rate; rank within each niche by successful work under a latency/error constraint. Source mutations change cache/retry/batch policy. Heap inheritance preserves the learned key distribution and warm indexes. Keep tenant state isolated.

**E:** spend the second week on abrupt workload shifts, including a held-out fourth trace, and migrating a successful image between two qualified hosts. Replay the same trace for each candidate before small canaries; prevent descendants from seeing the evaluator's future request schedule. **I — Baselines:** best static policy, conventional parameter tuner plus cache warm-up, contextual policy selection, and source-only evolution with explicit state export. Ablate inherited memory while keeping code identical. Measure completed requests, p95 latency, upstream costs, migration/checkpoint cost and switching regret.

**E — Success target:** at least 20% fewer upstream requests than the best static/tuned baseline at the same success/latency limits after a workload shift, with a separately measurable advantage from inherited phenotype. The gain is an experimental target, not a forecast. If only parameter tuning wins, use it.

### Demo + conditional tweet

**I — 60 s:** three visibly different traffic streams feed three descendants of the same service. Freeze code hashes to show that warm phenotypes differ. Flip the traffic mix; resurrect a previously minor specialist and migrate it. Show aggregate cost and held-out latency, not merely a colorful niche map.

> One service, several habitats. We kept a repertoire of working specialists instead of one winner, then changed the traffic. A sleeping specialist returned with its learned state. Controlled trace experiment; MAP-Elites lineage and baseline results linked.

### Kill test

**E/I — Kill the organism version if** a conventional tuner/selector with explicit cache state matches it within 5% of held-out useful work per total dollar, including generation, switching and snapshots. A niche visualization without a net operational gain is insufficient.

## 3. Stateful discovery archipelagos: preserve the search, not only its source

### Idea and 100× version

**I — One sentence:** evolve algorithms by branching experienced search processes, retaining their partial constructions and archives, rather than restarting every candidate from an empty heap. **100×:** a persistent discovery engine runs millions of funded search lineages across scheduling, packing and other verifiable design problems, freezes them between grants, and lets useful state and algorithmic modules transfer between compatible islands.

### Lineage, what stalled, and what changes

**F — AlphaEvolve, announced 2025-05-14, paper 2025-06-16,** combines LLM code proposals, automated evaluators and evolutionary selection, with reported applications to mathematics and computing infrastructure. [Primary paper](https://arxiv.org/abs/2506.13131). **F — Google's 2026-05-07 update** reports continuing infrastructure use, including cache policies and database heuristics. [First-party update](https://deepmind.google/blog/alphaevolve-impact/). **F — OpenEvolve's current repository** already implements LLM-driven evolution with quality-diversity and islands. [Author-maintained source, inspected 2026-10-27](https://github.com/algorithmicsuperintelligence/openevolve). **I:** “AlphaEvolve on Workers” is occupied and weak positioning.

**I — The narrower new hypothesis:** the selectable object can include useful *search experience*—a population of partial packings, tabu memory, an incremental evaluator, a warm constraint graph—not just an algorithm text and score. Koza supplies program breeding; Tierra supplies resource-limited individuals. Historical brittleness is addressed partly by semantic model proposals and typed interfaces. Evaluation cost, overfitting and the availability of a trusted checker remain limiting. A source-level compiler or mature solver with an excellent checkpoint format may already be better.

### Stronger models and value

**I:** better models propose more meaningful changes to neighborhoods, branching rules and search decomposition. Expensive accumulated search state survives model upgrades; a new model can interrogate and branch an old useful search. **Who pays:** scheduling, logistics and infrastructure teams whose existing heuristics leave measurable cost on a constrained task. Choose one existing, independently checkable problem before promising scientific discovery across fields.

### First proof in 1–2 weeks

**E:** use one-dimensional bin packing with an explicit independent feasibility checker, a standard heuristic baseline and sealed generated instance families. Build a JS search capsule with an in-memory population of partial solutions and learned neighborhood statistics. Checkpoint at a periodic host call. Branch identical mature searches; mutate only subsequent neighborhood-selection/scoring functions. Reject changes incompatible with the saved representation. Recombination exchanges validated partial packings or policy modules, not heaps.

**E:** run 8–16 islands for several bounded rounds. Store dormant leaders in R2; schedule short Worker slices through Queues and place any expensive verification behind a bounded tool. Compare against fresh-source LLM evolution, serial continuation, explicit application checkpoints, best-fit decreasing and a suitable conventional local search. Share initialization fairly: charge the warm-up prefix once when it is actually shared, and charge every descendant's subsequent work. Evaluate final policies on unseen sizes/distributions. **E — Gate:** improve held-out solution quality at equal total compute/model budget, and reduce time-to-target by at least 2× over fresh-source evolution. Report the remaining gap to conventional search rather than hiding it.

### Demo + conditional tweet

**I — 90 s:** show a difficult packing instance and a real partially completed search; fork its exact archived state into several strategies; sleep the branches; change model proposer; wake them and verify every candidate packing with a separate checker. Show the best conventional baseline and the full search/model bill.

> Evolutionary coding already works on algorithm problems. This experiment selects a different object: algorithm + accumulated search state. We forked a mature search, changed its next moves, and checked every result independently. Bin-packing prototype and equal-budget baselines linked.

### Kill test

**E/I — Kill the capsule-specific thesis if** explicit application checkpoints preserve the same useful state with less than 10% extra engineering/runtime cost and equal time-to-quality, or inherited search offers no advantage over fresh candidates. The discovered heuristic may still be useful; billions of program-organisms would be unnecessary.

## 4. POET for incidents: evolve environments that teach useful resilience

### Idea and 100× version

**I — One sentence:** co-evolve failure environments and recovery programs, transferring successful recovery phenotypes between incident families. **100×:** an expanding, executable curriculum of real operational failure modes continuously discovers new resilience capabilities and supplies evidence for changes before production encounters those failures.

### Lineage, what stalled, and what changes

**F — Lehman and Stanley, 2011** showed novelty search outperforming objective search in their maze/walking experiments by avoiding deceptive objectives. [Original paper, author text mirrored as PDF](https://gwern.net/doc/reinforcement-learning/exploration/2011-lehman.pdf). **F — POET, Wang et al., 2019-01-07,** jointly generates environments and solutions and transfers solutions between them. [Primary paper](https://arxiv.org/abs/1901.01753). **F — Enhanced POET, 2020-03-19,** explicitly identifies a limited problem space and missing universal progress measure as impediments, alongside algorithmic limitations. [Primary paper](https://arxiv.org/abs/2003.08536).

**I — Lesson:** an ever-growing archive is not proof of open-ended progress. LLM environment operators can mutate meaningful protocol/failure structures instead of only terrain parameters, and capsules preserve the difficult pending state. The simulation-to-reality gap remains. Source novelty, random output or a new synthetic error string is not a new operational capability.

### Stronger models and value

**I:** stronger models can invent plausible combinations of schema drift, duplicate events, timeout windows and partial results, and transfer a repair across different APIs. Better inventors make external realism constraints more important. **Who pays:** workflow engines, agent platforms and integration vendors, for validated failure corpora and reproducible, minimized incidents their current tests miss. This could feed the repair colony, but its product is discovery of useful failure classes rather than live remediation.

### First proof in 1–2 weeks

**E:** start from 10 documented failure scenarios in a toy webhook-to-index workflow. An environment genome is a bounded TypeScript event schedule over schema changes, duplicates, reordering and failures. A solver genome is a recovery policy. A joint checkpoint captures both their application states and their journal cut; independent leases keep the pair from issuing real effects.

**I:** admit an environment only if its protocol constraints hold and at least one reference strategy can solve it; prefer challenges on which existing strategies differ. Select novelty from behavioral outcomes such as data loss, duplicate intent, incomplete progress and recovery path, with exact trace features fixed beforehand. Use independent data-integrity invariants as non-negotiable quality constraints. Transfer archived solver policies/compatible phenotypes to newly admitted environments.

**E:** compare equal-budget POET-style generation with random protocol-valid faults, fixed chaos scenarios, coverage-guided fuzzing and one LLM generating tests without co-evolution. Reserve an independently authored evaluation corpus that the generator never sees. **E — Gate:** discover at least three minimized, independently confirmed failure mechanisms absent from the seeds and improve recovery on the reserved corpus; compare failure discovery per total dollar. Ten similar variants count as one mechanism.

### Demo + conditional tweet

**I — 75 s:** split-screen evolving incidents and solver lineages; freeze a newly found duplicate/loss trace; transfer a previously minor recovery strategy; replay the minimized case deterministically; reveal whether improvement transfers to the sealed corpus. Keep all fault injection inside the test environment.

> Our test environment learned to make the workflow fail, and recovery strategies transferred between failures. Inspired by POET and novelty search. The useful result is a minimized incident and a verified fix—not the size of the evolutionary tree. Synthetic lab; sources linked.

### Kill test

**E/I — Kill the co-evolution claim if** the final solver population fails to outperform fixed/random/coverage-guided curricula on the independently authored corpus at equal budget. An endless stream of exotic synthetic incidents without transfer is a simulation project.

## 5. Endosymbiotic service assembly: domesticate specialists into larger organisms

### Idea and 100× version

**I — One sentence:** let services acquire validated specialist modules or subordinate capsules, and select whole consortia by the useful work their cooperation enables. **100×:** software can assemble new services by acquiring mature parsers, reconciliers, planners and indexes with explicit compatibility contracts, inheriting accumulated expertise instead of rebuilding every capability.

### Lineage, what stalled, and what changes

**F — Lynn Sagan/Margulis, 1967,** proposed an origin of eukaryotic organization through ancient symbioses. [Original paper](https://courses.seas.harvard.edu/climate/eli/Courses/EPS281r/Sources/Origin-of-life/Lynn-Margulis-Sagan-1967.pdf). This cites a historical theory, not an endorsement of every organelle-origin proposal in that paper. **F — Woese, 1998-06-09,** proposed a genetic-annealing account emphasizing communal evolution and lateral gene transfer. [Original paper](https://academic.uprm.edu/lrios/6006/woese-universal%20ancestor.pdf). **I:** evolution can gain capabilities through association and transfer, not only incremental edits along a family tree.

**I — Engineering translation:** horizontal gene transfer installs typed source modules or explicit learned artifacts. Endosymbiosis retains a separately isolated specialist capsule behind a narrow interface. If integration later warrants compilation into one genome, distill its policy and explicitly migrate data; never merge raw memories. The unit of selection is sometimes the consortium. Evaluate pair/whole-service contribution, since an individually cheap component can make the overall system worse.

**I — Historical/software limit:** dependencies, plugins and service composition already provide capability acquisition. What is difficult is compatibility, credit assignment and preserving useful acquired state under composition. LLMs can synthesize adapters and migrations; executable contracts can reject bad combinations. This is a hypothesis for reducing integration effort, not a new package manager with organism terminology.

### Stronger models and value

**I:** better models understand mismatched schemas, synthesize better interfaces and identify promising donor capabilities. Independently validated component experience can outlast a particular model. **Who pays:** vertical integration and data-migration vendors, for assembling uncommon customer workflows from known working pieces without manually rebuilding every edge case. Cross-customer raw heaps are a poor donor format; use non-sensitive, provenance-tracked artifacts.

### First proof in 1–2 weeks

**E:** make three capsule types: format detector/parser, incremental deduplicator and schema reconciler. Each has a typed JSON message contract and a small state-export schema. Evolve assemblages for unseen combinations of three document formats and two schemas. A trusted TypeScript scheduler controls all grants; a specialist cannot inherit its caller's network authority. LLMs propose interface adapters and one reusable module transfer. Preserve within-tenant indexes as compatible state, not arbitrary data across customers.

**I:** run a leave-one-component-out assay to attribute contribution; compare the consortium with an explicitly hand-composed pipeline and a fresh single-model implementation. **E — Gate:** reuse validated specialist state/modules to solve at least two held-out combinations with less total generation and integration work than both baselines, while passing independent round-trip/data-conservation checks. Count inter-capsule messaging and memory overhead. This pilot demonstrates controlled acquisition, not spontaneous multicellular life.

### Demo + conditional tweet

**I — 60 s:** a reconciler fails on an unseen format; show it acquiring a parser under an explicit contract; remove the donor to demonstrate necessity; show a successful composition and a rejected incompatible transfer. Display the lineage DAG and exact grants beside real transformed records.

> A service acquired a specialist instead of rewriting itself. The donor kept its own boundary; a generated adapter had to pass independent contracts. Endosymbiosis-inspired composition, with one controlled module transfer. No heap merging; data and evaluation fixtures linked.

### Kill test

**E/I — Kill this as a separate product if** typed packages plus ordinary RPC deliver the same held-out compositions with no greater integration work and lower operating cost. The likely surviving artifact is a component-contract technique inside the other ideas.

## 6. Morphogenetic edge tissue: repair the topology of a service

### Idea and 100× version

**I — One sentence:** synthesize local rules that make a distributed service rebuild a useful topology after nodes, queues or workload regions disappear. **100×:** a service grows bounded processing “organs” near demand, differentiates replicas into ingestion/indexing/repair roles, and restores function after damage without a handwritten recovery plan for every topology.

### Lineage, what stalled, and what changes

**F — Lenia, Chan, 2019,** demonstrates diverse autonomous patterns in continuous-state cellular automata. [Original publication](https://www.complex-systems.com/abstracts/v28_i03_a01/). **F — Growing Neural Cellular Automata, Mordvintsev et al., 2020-02-11,** trains local update rules for growth, persistence and regeneration, including damage during training. [Original interactive paper](https://distill.pub/2020/growing-ca/). **I:** local regulation can generate a robust global structure. Neither paper establishes correct distributed service recovery, and visual regeneration is not evidence of preserved data or consensus.

**I — What changes:** capsules supply portable cell state; model-generated rules can be selected on queue drain, replica availability and integrity rather than pixel similarity. The major obstacle is still the network: asynchronous delivery, partitions and duplicate events invalidate naive grid analogies. Keep a trusted quota/lease substrate and an explicit consistency protocol; local “growth” is a request for resources, not self-authorized replication. The capsule controls logical placement; Cloudflare decides actual execution placement.

### Stronger models and value

**I — Conditional:** stronger models might synthesize better local control rules and adversarial tests, but established queueing/control and reconciliation algorithms could remain simpler and superior. **Who depends on it:** intermittently connected ingestion or distributed indexing systems whose logical topology changes frequently. This ranks low until it beats explicit reconciliation and autoscaling on service metrics.

### First proof in 1–2 weeks

**E:** implement 32–64 logical cells over a local workerd/TypeScript event harness, then a small hosted subset if qualified. Each capsule chooses a role using bounded neighbor messages and observed queue pressure. A separate Durable Object limits total replicas and grants unique ownership epochs for partitioned work. An LLM proposes local rules; a deterministic simulator evaluates many message/failure schedules before actual execution. This is rule synthesis inspired by NCA, not a claim of training a neural cellular automaton in two weeks.

**E:** delete a third of the active cells and delay/reorder messages while processing immutable records into an independently checked index. Compare with a desired-state reconciler, a conventional autoscaler and fixed overprovisioning. Measure work lost/duplicated, time to drain backlog, total resource use and recovery under schedules withheld from the proposer. **E — Gate:** at least 20% lower recovery cost at the same integrity and backlog-clearance limits than the best conventional baseline across held-out failures.

### Demo + conditional tweet

**I — 60 s:** delete a visible chunk of the processing topology while an index builds; survivors request role changes and bounded offspring; show the backlog recovering and verify the final index hash. Show the reconciler baseline beside it. The node graphic is a view of real receipts, not the experiment's outcome metric.

> We cut a running service topology apart. Local rules rebuilt its processing roles while a separate checker watched the data. Morphogenesis-inspired prototype; logical cells, bounded growth, real queue metrics. The conventional reconciler comparison is in the results.

### Kill test

**E/I — Kill this direction if** local rules fail the predeclared cost advantage against reconciliation/autoscaling on held-out asynchronous failures. A visually satisfying regrowth animation does not rescue it. This is the weakest direct extrapolation from the cited science.

## 7. Recovery spore banks: preserve adaptations that current selection would erase

### Idea and 100× version

**I — One sentence:** maintain a diversity-preserving archive of executable service phenotypes and resurrect the right one when an old failure regime returns. **100×:** operators keep a compact “biodiversity reserve” of rare but validated recovery states across versions and tenants, so sudden environmental change does not require rediscovering extinct operational knowledge.

### Lineage, what stalled, and what changes

**F — Ulrich et al., 2018-12-04,** report dormancy/resistance experiments in Bacillus spores and the first two years of a planned 500-year longevity study, not 500 years of demonstrated survival. [Original study](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0208425). **I:** a dormant population can preserve options without paying the full active metabolic cost. In software, preserve the exact engine/import contract as part of viability; durable bytes alone are insufficient.

**F — Ray's 1995 network-Tierra work** already proposed a network-wide biodiversity reserve for digital organisms. [Primary ATR network report, 1995-04-27](https://results.atr.jp/35th/techreport/TR-H-0145/index_e.html). **I:** the new value must be useful, tested resurrection of acquired operational states. Ordinary backups, rollback images and checkpoint recovery already exist. The hard work is choosing rare experiences to keep, checking ongoing compatibility and showing faster recovery than replay.

### Stronger models and value

**I — Partial multiplier:** better models can summarize a phenotype's preconditions, diagnose a returning regime and propose compatibility migrations. If regenerating a solution becomes cheaper than preserving it, spores lose value. The durable asset must therefore be expensive accumulated experience: a validated warm index, partial reconciliation or rare incident state, rather than a small function a model can rewrite instantly. **Who pays:** long-tail integration vendors and seasonal/event-driven services, for lower recovery time after dormant periods and sudden provider reversions.

### First proof in 1–2 weeks

**E:** run a stateful ingestion workflow through three regimes; keep a repertoire of 20–50 distinctive checkpoints, exact engines and synthetic journal inputs. Compare archive policies: newest-only, highest-score-only, random retention and quality-diversity retention under the same byte limit. Return to an earlier regime after introducing a schema/host-adapter version change. A resuscitation assay restores each candidate, revalidates grants and checks correctness before any service use. Include an intentionally incompatible image and show rejection.

**I:** do not pretend a ten-day experiment proves long-term archival survival. The pilot tests interrupted execution and compatibility change. **E:** compare total restoration, retrieval, decompression, migration and warm-up time against a normal deployment rollback, JSON state, and journal replay. **E — Gate:** recover useful work at least 2× faster than the best baseline while preserving independent data invariants; the archive must select a rare useful phenotype more reliably than newest-only retention under the same capacity.

### Demo + conditional tweet

**I — 45 s:** a retired specialist is shown as an R2 object; kill all runtime owners; reintroduce an old provider regime; choose and wake the matching spore; reject a genuinely incompatible neighbor; display dependency bytes and recovery timing.

> We preserved service adaptations that today's traffic no longer needed. When an old failure regime returned, a retired phenotype woke with its working state. Executable recovery repertoire prototype; engine dependencies and replay/rollback baselines included.

### Kill test

**E/I — Kill the standalone offering if** source rollback plus replay/application state matches useful recovery within 20% after all compatibility and archive-maintenance costs. Keep diversity retention as a feature of repair colonies or discovery archives.

## 8. Metabolic discovery commons: a food web paid for useful work

### Idea and 100× version

**I — One sentence:** operate a bounded ecosystem in which discovery programs earn future compute from independently validated outputs and useful contributions to other programs. **100×:** billions of mostly dormant specialist organisms form a research economy: constructors produce candidates, checkers certify them, translators adapt them, and consumers fund the useful paths, while unproductive lineages exhaust their allowance and sleep or die.

### Lineage, what stalled, and what changes

**F — Tierra's 1992 account** makes CPU and memory scarce resources and reports host/parasite interactions, cooperation and cheating. [Ray's original account](https://tomray.me/pubs/tierra/). **F — Cannon, 1929-07-01,** described physiological homeostasis as coordinated maintenance of steady conditions. [Primary paper](https://journals.physiology.org/doi/10.1152/physrev.1929.9.3.399). **F — Kerr, Wyllie and Currie, 1972-08-01,** characterized apoptosis as controlled cell deletion complementary to proliferation. [Primary paper](https://www.nature.com/articles/bjc197233). **I:** an ecosystem requires maintained budgets and turnover; unrestricted replication is not ecology useful to a customer.

**I — Food-web mapping:** data producers feed constructors; validators enable consumers to trust constructed artifacts; consumers supply the externally funded demand. The budget is an accounting currency, not thermodynamic energy. “Carrying capacity” is the admitted active work under real CPU, RAM, storage and model quotas. Neither biology nor markets guarantee that individual advantage aligns with system benefit. Collusion, fake demand and reciprocal self-payment are predictable failure modes. Endogenous reproduction alone historically supplied no independent application-value guarantee; trusted external tasks and verifiers must supply one now.

### Stronger models and value

**I — Ambitious but weak as a first product:** stronger models can generate richer specialists and identify useful combinations, while also becoming better at exploiting reward proxies. **Who might pay:** an organization with a continuous backlog of objectively checkable optimization/discovery tasks, funding a fixed budget for accepted improvements. An open marketplace without that demand is premature. Do not pitch a token economy; start with an internal research scheduler denominated in actual costs.

### First proof in 1–2 weeks

**E:** operate 100–1,000 logical organisms, no more than a small bounded active pool, on a packing/counterexample task family with separate constructor, checker and translator roles. Most genomes are generated once and reused; do not run one LLM call per organism per tick. Have the trusted controller debit CPU slices, tool/model use and checkpoint bytes. Forking splits remaining credit; restore never resets debt. A rolling tenant cap is a homeostatic guard. Dormancy preserves rare verified candidates; hard lease expiry terminates stale active owners.

**I:** pay a contribution only when independently checked work is accepted by an external task, with ablations or sampled counterfactuals for intermediate credit. Cap dependency depth and ban internal circular payments. Test a zero-utility prolific replicator and a mutually endorsing pair: both must fail to earn new allowance. Compare against centralized priority scheduling and a conventional island search under the same total budget. **E — Gate:** at least 20% more independently accepted task improvements per total dollar across sealed task seeds, with no quota overspend. These tests check a mechanism; they cannot prove an open economy ungameable.

### Demo + conditional tweet

**I — 90 s:** real useful-work receipts feed a small food-web view; a cheater makes many copies but runs out of inherited credit; a previously quiet lineage earns funding by supplying a verified improvement; show exact spend against centralized scheduling.

> This program ecosystem has a metabolism: CPU, model calls and stored state all cost credit. Replication earns nothing by itself. Verified useful work funds descendants; cheaters exhaust their allowance. Small controlled discovery economy, with a centralized baseline and full ledger.

### Kill test

**E/I — Kill the commons product if** accepted improvements per dollar fail to exceed centralized scheduling by the predeclared 20%, including credit-assignment overhead. Keep resource accounting and mortality as infrastructure. A bustling artificial economy without a paying external task is not value.

## What “billions across the edge” would actually require

**I — Population size is a storage/discovery claim before it is a concurrency claim.** A billion lineage records can refer to fewer distinct immutable images. A billion unique experienced phenotypes is a much larger undertaking. Most must be dormant, and only externally triggered or funded individuals should wake. Constantly checkpointing or asking a model to mutate every organism is a poor default.

**F — R2 Standard rates, updated 2026-10-26:** $0.015/GB-month storage, $4.50 per million Class A operations and $0.36 per million Class B operations; Internet egress is free at R2's layer. [Official pricing](https://developers.cloudflare.com/r2/pricing/).

**E — Arithmetic for one billion distinct images, decimal units, one retained version, before allowances/tax/metadata/replication/compute:** at 0.1 MB/image, storage is 100 TB and about **$1,500/month**; at 1.5 MB, **1.5 PB / $22,500**; at 3 MB, **3 PB / $45,000**; at 6.4 MB, **6.4 PB / $96,000**. Ten retained versions multiply that storage unless measured sharing reduces it. One billion writes cost about **$4,500** and one billion reads **$360**. One full-population checkpoint per day for 30 days costs **$135,000 in writes** plus **$10,800 in reads** if every image is also read daily, before storage and CPU. “Sleeping has no resident guest RAM” does not mean free preservation.

**E:** if 1% of that population wakes each day and uses 100 CPU-ms, the guest slices alone consume roughly **278 CPU-hours/day**. If 0.1% is resident simultaneously with 3 MB of state, state alone occupies **3 TB** across the fleet; copies, runtime and owner overhead are additional. **I:** account throughput, scheduler sharding, recovery bursts and actual placements need qualification; these arithmetic examples establish neither Cloudflare capacity nor a purchasable fleet configuration. Model inference can dominate every term, so select a tiny mutation frontier and reuse each validated mutation across many compatible individuals.

**I — The ecology worth building is task-driven.** Niches are actual workload/failure regimes; carrying capacity is host admission; food is externally funded useful work; competition is constrained evaluation; migration is adaptation transfer; extinction is resource reclamation; spores preserve options. This discipline turns artificial life into software that fits, repairs and discovers. Counting animated organisms does not.

## Evaluation that could change the ranking

**I:** compare three increasingly strong substrates for the same proposal/evaluation loop: source plus fresh execution; source plus explicit serializable state/journal replay; full compatible capsule state. Hold model, candidate count, training feedback and total spend constant. Include simple random/parameter search and established domain algorithms where relevant. A strong one-shot model plus a good checker is an essential baseline, not an adversary to omit.

**I:** predeclare hidden task families and thresholds; keep the final test separate from selection. Repeated adaptive querying can overfit even a once-hidden test, so reserve a final corpus and record how often development results informed proposals. Use multiple seeds and paired workload traces; show failures and uncertainty rather than reporting a single winning run. Toy pilot thresholds above indicate whether to expand, not statistical certification. Every accepted improvement needs a task-level correctness check, plus total generation/evaluation/restore/storage cost.

**I — A finite archive is not open-endedness.** For POET/discovery, look for new independently recognizable problem families, measurable transfer to external tasks, continued marginal useful discovery under fixed resources, and useful stepping stones that would have been lost by winner-only selection. A changed hash, larger program, higher lineage count or LLM-assigned novelty score is inadequate. Model upgrades are mutation-operator changes; record their version and budget so a better proposer is not misreported as autonomous ecological progress.

## Ranked shortlist and the bet

**I — Full ranking:** **1. Immune repair colonies; 2. Software ecotypes; 3. Stateful discovery archipelagos; 4. POET incident foundry; 5. Recovery spore banks; 6. Endosymbiotic service assembly; 7. Morphogenetic edge tissue; 8. Metabolic discovery commons.** Rank reflects customer value, plausible capsule-specific advantage, complementarity with stronger models and quality of a two-week falsification. Items 5 and 8 are more convincing as features of the leaders; item 7 has the largest gap between inspiring science and operational proof.

**1 — Immune repair colonies.** **I:** this has the clearest buyer and the strongest reason to preserve an exact life: a rare failing state is expensive to reconstruct and may contain the evidence needed for repair. Clonal expansion, negative selection against regressions and retained recovery memory translate into concrete operations. It also makes the strongest short video: break a stateful workflow, reject a deceptive fix, move the verified survivor. Its historical failure mode is well documented by program-repair reanalysis, so independent semantic evaluation is central. The replay/JSON baseline can decisively falsify the capsule requirement.

**2 — Software ecotypes.** **I:** quality-diversity gives a principled reason to retain multiple useful specialists, and inherited warm state offers a measurable adaptation advantage. Workload heterogeneity supplies recurring demand even as models improve. It can grow from one aggregator into many tenant-specific services without claiming arbitrary application self-modification. The main commercial objection is that policy selection, caches and conventional tuning already work; the prototype must beat that combination on held-out useful work per total dollar. This is the strongest alternative if repair correctness proves too difficult to establish.

**3 — Stateful discovery archipelagos.** **I:** a trusted checker makes real value unusually legible: the packing fits, the schedule is feasible, or the proposed counterexample verifies. Better models make mutation increasingly productive. AlphaEvolve and OpenEvolve establish formidable prior art and eliminate a generic evolutionary-coding pitch. The differentiated experiment is whether preserving expensive partial search states changes the economics of discovery. If application-level checkpoints do the job more simply, keep the discovered algorithm and abandon the capsule-platform story.

**I — The ONE I would bet on:** **immune repair colonies for stateful API ingestion workflows**, initially limited to policy changes after explicit checkpoints. Build one excellent incident-to-survivor demonstration and an honest capsule-versus-replay comparison. Then add ecotype diversity and spore retention as the repertoire grows. Use POET later to expand the incident curriculum. The 100× destination is a service population that accumulates transferable recovery experience across millions of integrations; the first proof is one workflow whose inherited state makes a verified repair materially cheaper.

## 5-line TL;DR

1. **I:** Evolve programs together with their acquired working state; cheap replication alone produces no useful objective.
2. **I:** Bet on immune repair colonies, then workload ecotypes and stateful algorithm discovery, each judged by an independent checker.
3. **I:** Stronger models improve mutation and recombination; real incidents, inherited experience, diverse repertoires and external evaluation remain valuable.
4. **M-prior/E:** Real images can be megabytes; billions must be mostly dormant, sparsely mutated and charged for every wake, write and model call.
5. **I:** In two weeks, prove capsule inheritance beats fresh execution, replay and explicit state—or drop the organism substrate and keep the useful algorithm.
