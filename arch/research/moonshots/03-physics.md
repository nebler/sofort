# Physics, time and many worlds: the edge as a multiverse engine

Research date: **2026-10-27**. Lens: physics, time, causality and branching execution. Written against [the moonshots brief](BRIEF.md).

**Labels:** **F** = sourced fact; **M** = measurement; **I** = inference, proposal or judgment; **E** = estimate, illustrative calculation or proposed experimental threshold. **M-prior** identifies measurements in the supplied research, not work rerun here. There are **no new runtime measurements** in this report. All web sources cited were inspected on **2026-10-27**; original publication dates appear beside the relevant citations. Proposed demos and tweets describe experiments to build, not completed capabilities. No deployments or external writes were performed.

## Thesis: buy experience before buying consequences

**I — The 100x opportunity is to make irreversible actions scarce and simulated experience abundant.** A program should accumulate thousands of possible histories before it earns permission to change one real thing. The product is a runtime for *conditional rehearsal*: execute the actual decision program, preserve its intermediate state, vary what it encounters, inspect failures, and release one bounded action through a trusted broker. Better models make the plans, adversaries and simulators better; they also make the eventual actions consequential enough to justify more rehearsal.

**I — My bet is a failure-search gate for agent writes, with a counterfactual debugger as its development interface.** The expansive version is a planet-scale service in which every consequential agent action arrives with a branching execution history and an explicit account of what was tested. The useful first version is much narrower: one TypeScript program, a few specified tools, a deterministic simulated environment, and a single independently checked real write.

**F/M-prior — Starting point, not invention:** the required [landscape](../v8/02-landscape.md), [roadblocks](../v8/03-roadblocks.md), [signal](../v8/06-signal.md), [Wasm portability](../portability/02-wasm.md), [demo §0, §9 and §10](../../../demo.md), and [GrowOS controller](../../jitk/grow/README.md) were read. Their evidence already includes heap/promise snapshots, divergent restores and local cross-host execution. It also includes realistic compressed snapshots of roughly **1.5–6.4 MB**, **5–11x** interpreter overhead on tested glue workloads, broken inner memory accounting in the spike, and linear-memory high-water retention. Prior art includes quickjs-wasi, quickjs-rs, XS, Golem and TimeTravelJS. This report proposes products above those mechanisms.

**I — Scope of the proposed proofs:** checkpoint QuickJS at a pending guest promise after all Wasm frames have returned to the host. Pin the module, mutable-state representation and import ABI. These experiments do not require arbitrary V8/native-stack capture. Native jitk remains a distinct hardware backend; its RAM image is not a portable wasm32 heap.

### What physics contributes—and where the analogy ends

| Lens | Sourced starting point | Engineering consequence proposed here |
| --- | --- | --- |
| Relative states / many worlds | **F:** Everett's relative-state formulation treats observers and their records within quantum mechanics; published **1957-07-01**. [Original publication](https://journals.aps.org/rmp/abstract/10.1103/RevModPhys.29.454), [primary text with editorial annotations](https://jamesowenweatherall.com/SCPPRG/EverettHugh1957PhDThesis_BarrettComments.pdf). | **I:** Give each fork its own observations, history and identity; compare conditional futures. This is an analogy, with no quantum speedup or physical branching claim. |
| Sum over histories | **F:** Feynman's **1948-04-01** formulation sums complex contributions before squaring to obtain probabilities. [Original paper/abstract](https://journals.aps.org/rmp/abstract/10.1103/RevModPhys.20.367). | **I:** Account for alternative paths and their weights. Software rollout weights are ordinary probabilities or explicit stress scenarios, not quantum amplitudes; counting forks does not establish likelihood. |
| Virtual time | **F:** Jefferson's **July 1985** Time Warp uses saved states and antimessages to roll back speculative distributed computation. [Original paper](https://worrydream.com/refs/Jefferson_1985_-_Virtual_Time.pdf). | **I:** Run cooperative agents ahead, then invalidate dependent speculative work when a prediction changes. External effects need a separate release boundary. |
| Light cones | **F:** Lamport's **July 1978** happened-before relation is a partial order; his paper explicitly connects it to relativity. [Original paper](https://lamport.azurewebsites.net/pubs/time-clocks.pdf). | **I:** Replay the affected causal region rather than all history; distinguish concurrency from an arbitrary timestamp order. |
| Reversibility / entropy | **F:** Landauer (**July 1961**) links logical irreversibility and dissipation; Bennett (**November 1973**) constructs reversible computation using retained history and reverse execution. [Landauer](https://ieeexplore.ieee.org/abstract/document/5392446/authors), [Bennett](https://worrydream.com/refs/Bennett_1973_-_Logical_Reversibility_of_Computation.pdf). | **I:** Decide which history to retain, recompute or discard. Snapshot rollback on ordinary hardware is not thermodynamically reversible computation. |
| Coarse-graining | **F:** Wilson's **1971-11-01** work formalizes renormalization-group scaling. [Original paper/abstract](https://journals.aps.org/prb/abstract/10.1103/PhysRevB.4.3174). | **I:** Maintain several resolutions of execution history, each preserving named observables. A prose summary cannot replace exact executable state. |

## The boundary that makes the ambition coherent

### A perfect record of the program is not a perfect model of its world

**I — Use three separate terms in the API and demo:**

1. **Recorded past:** actual tool replies, clock/random inputs and delivery order. Replay can be exact within a qualified deterministic profile.
2. **Hypothetical future:** tool replies produced by a versioned simulator, fixture or model. Its validity is an assumption, with provenance and uncertainty.
3. **Committed reality:** the external effects the trusted broker actually released and reconciled.

**I — A fork must include the simulated environment state as well as the program state.** Copying only the JS continuation while all children mutate the same fake inventory/database contaminates the experiment. Each child needs its own environment overlay or an immutable base plus a private event tail. Clock, timer queue, PRNG state, pending messages and simulator version belong to that world. An immutable snapshot can be shared in storage; executing children still require separate Wasm memories on the browser/Workers path.

**I — Record LLM outputs as external inputs too.** Replaying a model call means returning its recorded response, not asking the current model to answer again. A fresh candidate or adversarial response is a new branch event. Model inference weights/KV caches are not in the capsule. Shared-prefix execution saves program work; it does not make 10,000 fresh generations free.

**E — The lucky-future trap:** action A earns +10 with probability 0.1 and −2 otherwise; action B earns +1 certainly. A's expected value is −0.8. Among 10,000 sampled A futures, finding at least one +10 is virtually certain. Committing A because that branch looks best still loses 90% of the time. **I:** search over actions or observation-dependent policies, average or stress-test their environment outcomes, and commit a decision—not a wished-for observation. Restoring the same seed 10,000 times is not 10,000 independent trials.

**I — Weight contract:** separate the target environment distribution from the search policy. For a finite scenario set with justified probabilities, score an action by `sum(p(scenario) * utility(action, scenario))`, alongside explicit hard constraints and tail losses. If the adversary deliberately oversamples failures, raw failure frequency is not an estimate of deployment risk. Correct sampling weights require a justified target model and coverage of its support; otherwise present a stress-test result without a probability claim. Ten extra copies of a favourable path must not increase its probability mass.

**I — The safe promotion rule:** a hypothetical suffix cannot become the authoritative production heap. Select an action/policy, restore the last real checkpoint, release its first authorized effect, ingest the *actual* result, then replan. An already-computed prefix may be reused only when every input it depended on is real and still valid. If real inventory, permission, code version or approval changed during search, invalidate/revalidate the decision. Multiple external writes require multiple boundaries or an actual transactional tool; one capsule cannot make unrelated APIs atomic.

### A concrete Cloudflare shape

**I — Proposed common substrate for all nine experiments:**

- **Workers / Dynamic Workers:** execute a pinned QuickJS-Wasm module with bounded imports. Pass source, snapshots and journals as data. Grant speculative instances no outbound capability and no write credentials; even apparently read-only requests can leak information or have effects, so rehearsals use recorded or deliberately brokered inputs.
- **Durable Object:** coordinate one decision root, branch IDs, budgets, checkpoints and an effect ledger. Store ownership epochs and the winning action digest in durable storage. Do not funnel every rollout byte through one globally hot object; shard scheduling below the root.
- **R2:** retain content-addressed checkpoint anchors, environment fixtures and journal chunks. Upload immutable data before making its hash authoritative in the coordinator. A published metadata reference must never point to an incomplete image.
- **Queues / Workflows:** distribute bounded batches and resume search across invocations. Duplicate or late results are harmless only when accepted against branch ID, parent hash, simulator version and root epoch. Place shared state near its execution; scattering a communicating tree globally can cost more than it saves.
- **Browser:** inspect the tree and execute small trusted demo worlds in Web Workers. Treat a user-supplied image as untrusted data; server-side replay and policy checks decide whether an action is authorized.

**F — Deployment constraints checked today:** Workers have **128 MB per isolate**, including Wasm; Dynamic Workers allow **4 distinct in-flight children per Worker request**, or **10 per Durable Object I/O context**. These are not global fleet limits. Dynamic Workers expose configurable bindings and network access. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (current docs), [Dynamic Workers limits](https://developers.cloudflare.com/dynamic-workers/platform/limits/) (**2026-08-27**), [loading/capabilities](https://developers.cloudflare.com/dynamic-workers/getting-started/) (**2026-10-12**). **I:** keep an explicit bounded frontier; the first proof is not 10,000 simultaneous heaps in one Worker. Hosted qualification remains a proposed experiment, distinct from existing local workerd results.

**I — Commit protocol, narrowly specified:** persist an effect intent containing root/epoch, selected action hash, read-version preconditions, tool grant and stable logical operation ID. The broker checks those preconditions and rejects stale branches. Execute using connector-supported idempotency or a transaction that includes the ledger, then store/reconcile the receipt. A crash after a remote effect and before recording its result is **unknown**, not permission to retry blindly. Without remote deduplication/status lookup, stop that operation for reconciliation. Fencing in the coordinator prevents new dispatches; it does not cancel an already-dispatched request.

**I — For the first demo, make the one real effect a configuration update in a separate owned service whose effect and deduplication record share one transaction.** That proves a real, inspectable single logical effect for that connector. It does not prove exactly-once arbitrary email, payments or deployment providers. Keep credentials outside all downloadable heaps.

**F — This output boundary is old and fundamental:** Jefferson explicitly defers physical output until it cannot be rolled back, and Fowler's **2005-12-12** event-sourcing essay warns that replay must not resend external updates. [Time Warp §4.3.4](https://worrydream.com/refs/Jefferson_1985_-_Virtual_Time.pdf), [Event Sourcing, external updates](https://www.martinfowler.com/eaaDev/EventSourcing.html). **I:** the opportunity is to make that discipline usable by agent programs, not to claim that snapshotting invented it.

### What “10,000 worlds” would cost

**E — Illustrative arithmetic, not a benchmark:** 10,000 branches at 50 CPU-ms each consume **500 CPU-seconds**, or **8.3 core-minutes**. With 64 perfectly utilized execution lanes the compute-only lower bound is **7.8 seconds**; scheduling, I/O, restore, metering and inference add to it. Fetching a separate 3 MB image for every child moves **30 GB**. Sharing one anchor avoids duplicate storage but not every restore/copy or transfer. Ten thousand fresh model calls also cost ten thousand calls.

**I — Therefore the plausible 100x mechanism is structural:** retain expensive common prefixes, keep large tool payloads outside the heap, explore many cheap environment continuations per generated policy, prioritize decision-changing branches, and retain failing witnesses. Use 10,000 as an honestly counted cumulative rollout budget. Report candidate policies, environment draws, distinct terminal outcomes and duplicated traces separately. Stronger models may reduce the necessary branch count; the product must optimize decisions, not maximize a spectacle counter.

## 1. The action compiler: MCTS over live continuations

**Idea — I:** compile a proposed agent action into an executable search tree, using real suspended program states as nodes and selecting the action with the strongest validated outcomes. **100x version — I:** every consequential tool call becomes a request to an edge planning engine that searches thousands of continuation/environment pairs and returns a contingent policy, its assumptions and its first permitted effect.

**Lineage — F:** Kocsis and Szepesvári's **2006** UCT allocates simulation effort adaptively; its guarantees assume a generative environment model and specified MDP conditions. [Original paper](https://aima.cs.berkeley.edu/~russell/classes/cs294/s11/readings/Kocsis%2BSzepesvari:2006.pdf). Agent tree search is already direct prior art: LATS combines MCTS with language-model actions, values and reflection (**2023-10-06**, revised **2024-06-06**). [Authors' paper](https://arxiv.org/abs/2310.04406).

**What stalled / what changes — I:** ordinary application environments rarely offer a trustworthy `clone()` and generative response model; prompt search alone does not supply one. Capsules turn the *program* into a cloneable search node and preserve expensive work before the decision. The external environment remains the hard part. Use typed tool simulators and measured response distributions; do not claim that arbitrary API responses have become predictable. This is an execution substrate for planning, not a new MCTS algorithm.

**Mechanism — I:** alternate decision nodes and environment nodes. Generate a small diverse action set; fork the paused heap and environment overlay; run cheap continuations; back up utility and invariant failures; spend additional rollouts near choices that could change. Reuse the same scenario seeds across candidates for paired comparisons, while deliberately separating branch identity from PRNG state. Keep a held-out scenario set out of search; model-generated probabilities without calibration are scenario proposals, not confidence intervals. Prefer bounded reward plus hard admissibility constraints over “the model liked this ending.”

**Stronger models — I:** better candidates, more useful state abstractions and better tool models raise the return on executable search. The failure mode is equally clear: if a stronger single-pass model matches the search at lower total cost, this becomes an optional expensive mode. Execution evidence and integration, rather than reasoning traces, have to earn the premium.

**Value — I:** operators of release/configuration agents, fleet schedulers and business-process agents pay for fewer costly choices and auditable decision evidence. Begin with owned software state transitions; uncontrolled human responses are a poor first world model.

**First proof — E, 10–14 days:** TypeScript deployment planner; 8–16 candidate configurations; QuickJS-Wasm checkpoint after reading an immutable service snapshot; simulated capacity/failure/traffic responses; Node/workerd rollout runner and a small hosted Worker qualification. Compare single-pass, equal-budget source reruns and checkpoint-backed search on 100 held-out simulator seeds. Measure realized utility, failures, total inference/CPU, wall time and common-prefix savings. Release one version-checked configuration update through the owned connector. The 10,000-rollout mode should largely reuse policies, not call an LLM 10,000 times.

**Demo + hook — I, 60–90 s:** show the naive plan break under one traffic scenario; expand the tree, identify a robust candidate, race a stale competing branch, and show one accepted update receipt. Caption the traffic model as simulated and the final configuration write as real. **Draft tweet:** “Before this agent changes a config, it runs its actual program through a tree of simulated traffic and failures. One version-checked write gets out. QuickJS/Wasm continuations + MCTS; simulator and baselines included.”

**Kill test — E:** on the held-out task set, executable search fails to improve realized utility over equal-total-budget candidate generation plus ordinary tests. That result kills the planner product wedge; cheap fork timing alone cannot rescue it.

## 2. The counterfactual production debugger

**Idea — I:** turn a captured production failure into an executable experiment: rewind to a tool boundary, change one input or supported policy decision, and compare the resulting causal histories. **100x version — I:** an agent investigates incidents by submitting hundreds of interventions against a captured program and a declared environment model, returning the smallest reproducible failure and a repair hypothesis with explicit limits.

**Lineage — F:** rr records executions and supports reverse debugging; its **2017-05-16** report targets deployable low-parallelism record/replay rather than general counterfactual world prediction. [Original report](https://arxiv.org/abs/1705.05937). Pernosco offers state/history and control/data-flow inspection over recordings. [Product documentation](https://pernos.co/) (current). Event sourcing already supports historical reconstruction and replay. [Fowler, 2005-12-12](https://www.martinfowler.com/eaaDev/EventSourcing.html).

**What stalled / what changes — I:** retaining a history answers “what happened?” much more directly than “what would have happened?” The latter needs new responses after an intervention. Large process traces, platform constraints and missing external state make broad adoption expensive; those are limitations, not evidence that rr/Pernosco failed. The tool-only capsule narrows capture and intervention to a small contract and makes the incident downloadable into a browser. TimeTravelJS already overlaps browser history branching, as the supplied landscape notes; differentiation must be production-tool provenance and modelled divergence.

**Mechanism — I:** unchanged-prefix replay verifies every tool-request digest and returns its recorded answer. At the intervention point, fork the image. Reuse a subsequent recorded reply only when request, input provenance and declared environmental dependencies still match; otherwise stop or consult a branch-local simulator. A changed reserve request cannot inherit the old successful reservation reply. Changing source requires replay from a compatible source boundary, not patching arbitrary compiled heap objects. Begin with response substitutions and a pre-existing policy-configuration input, not arbitrary code hot swapping.

**Stronger models — I:** models can propose and prioritize interventions, locate likely responsibility and write repair candidates. Executable witnesses let a stronger model test its explanations. Require a successful prediction on a withheld real/simulated reproduction; a fluent causal narrative is not the oracle.

**Value — I:** agent-platform and SRE teams pay to shorten diagnosis, share exact failures and evaluate a patch against the incident corpus. The wedge is “give the investigator an executable incident,” rather than another chat over logs. Synthetic interventions show causation within the captured model, not identification of every real-world counterfactual.

**First proof — E, 7–10 days:** capture a TypeScript order coordinator with duplicate completion, timeout and inventory race bugs, using synthetic tenant data. Preserve a closure, Map and pending promise in its checkpoint. Export one incident; load it in browser and Node; replay exactly, then branch at the duplicate reply and policy input. Use a tiny event-sourced inventory simulator after divergence. Verify the patch by source replay over a withheld incident set, with zero production dispatches. Record capture cost and which dependencies made each later reply reusable or unusable. Synthetic data avoids pretending arbitrary live heaps can be redacted without changing execution; real capture needs a separate data-handling contract, including freed bytes retained in images.

**Demo + hook — I, 60 s:** open one incident file, reproduce an erroneous order, drag back to the reply, fork three alternatives, and show the differing tool histories. Show an “unknown external response” stop once. **Draft tweet:** “An incident file you can run: replay the failure, fork at a tool reply, and test a repair. Recorded history stays exact; changed futures use a labelled simulator. No production calls during replay.”

**Kill test — E:** in blinded seeded-incident trials, engineers using the executable incident do not reach correct diagnoses faster than engineers with structured logs and a conventional reproducer, after including capture/integration cost.

## 3. The failure-search gate: rehearse disasters before releasing a write

**Idea — I:** require an agent's proposed write to survive adversarial execution under tool failures, stale observations and malicious data before the broker will consider committing it. **100x version — I:** consequential agents continually face an automated adversary that searches thousands of possible worlds for a counterexample, and every allowed effect carries a replayable test history plus independently enforced invariants.

**Lineage — F:** FoundationDB's **SIGMOD 2021** paper describes deterministic simulation and fault injection; it also names limitations around performance, dependencies and mismatches with real OS contracts. [Original paper §3](https://www.foundationdb.org/files/fdb-paper.pdf). Antithesis's **2024-03-20** engineering account describes controlling hardware time, scheduling and I/O to make systems reproducible. [First-party account](https://antithesis.com/blog/deterministic_hypervisor/). These are established approaches, not a newly discovered testing category.

**What stalled / what changes — I:** FoundationDB succeeded with substantial architectural discipline; a deterministic hypervisor expands coverage at considerable infrastructure effort. Neither technique supplies a correct model of an arbitrary remote business API. Sofort's deliberately tiny I/O surface makes *agent orchestration* a tractable narrower target. The adjacent GrowOS lesson is unusually relevant: independent oracles, held-out cases and deliberate wrong implementations are needed to assess whether tests can reject a convincing cheat. [Local controller](../../jitk/grow/README.md).

**Mechanism — I:** the adversary mutates only contract-permitted inputs: retryable failures, duplicate deliveries, reordered independent completions, expiry, approval revocation, stale reads and prompt-injection content in data fields. Illegal simulator responses are a separate robustness suite. An independent checker evaluates invariants such as target identity, grant freshness, spending bound or “no second logical release.” Search retains minimized witnesses. Passing means “no failure found under these contracts and budgets,” not “safe in every possible world.” A broker-enforced allowlist can provide a stronger *bounded* guarantee even if testing misses a case.

**Stronger models — I:** stronger agents attempt more complicated writes; stronger adversaries discover semantic traps that random faults miss; stronger repair agents can use witnesses. Keep simulator contracts and acceptance checks outside the proposing model's control. If one model writes the plan, universe and verdict, 10,000 branches can merely amplify the same error.

**Value — I:** companies deploying agents into configuration management, support actions and data maintenance pay for a release gate, incident witnesses and connector-specific assurance. The first buyer needs a few high-value effects, not arbitrary autonomous world access. “Agents that never make irreversible mistakes” is a research ambition; the sellable promise specifies exactly which mistakes the broker makes impossible and which are only tested.

**First proof — E, 10–14 days:** one agent-controlled service-configuration tool; three independently authored safety predicates; a TypeScript simulator and QuickJS-Wasm forks; 10,000 cumulative suffix rollouts over multiple budgets. Seed ten policy/controller defects, retain a held-out defect/contract set, and compare adversarial guidance with random fuzzing and ordinary source reruns at equal CPU/model budgets. Freeze the acceptance oracle before search. Demonstrate crashes before dispatch, after effect and before receipt, duplicate queue delivery, forged child results and a stale owner. The owned transactional connector should record one logical update or an explicit refusal.

**Demo + hook — I, 75–90 s:** ask an agent to perform a plausible config rollout; the adversary finds a stale-approval path and produces a minimal replay; a repair passes the disclosed suite; press commit and show one real update receipt. **Draft tweet:** “This agent tried the release in thousands of simulated failure timelines before one config write was allowed. The adversary found an approval race. Passing is bounded evidence, not a claim of infallibility; replay and effect ledger are open.”

**Kill test — E:** at equal total compute and the same frozen oracle, the guided multiverse gate finds no additional held-out material defects over ordinary property-based fault testing. Then the capsule UI may remain useful, but the expensive gate has not earned its cost.

## 4. Time Warp society: agents that run ahead of one another

**Idea — I:** let cooperating agent programs consume tentative messages and advance without waiting, then roll back dependent work when a tentative assumption is revoked. **100x version — I:** a distributed agent organization prepares plans, artifacts and negotiations across the edge while causally stable decisions cross a separate real-effect frontier.

**Lineage — F:** Jefferson's Time Warp advances logical processes optimistically, restores previous state on stragglers and uses antimessages to retract messages; global virtual time supports reclaiming history and deferring irrevocable output. [July 1985 original](https://worrydream.com/refs/Jefferson_1985_-_Virtual_Time.pdf). **I:** this remains an active simulation technique; its costs, rather than historical failure, are the relevant lesson.

**What stalled / what changes — I:** saved-state cost, excessive optimism and rollback propagation can consume the parallelism gained. General business processes also include effects that cannot be retracted. Small parked states and common-prefix storage lower some costs; models can produce useful tentative artifacts before missing information arrives. They cannot retroactively unsend an email. Use this only where substantial pure work can overlap real latency.

**Mechanism — I:** messages have causal IDs, virtual timestamps and tentative/confirmed status. If a purchase-planning actor retracts a budget assumption, send invalidations to all descendants that consumed it; restore their last unaffected checkpoints and reuse content-addressed pure artifacts where inputs still match. Distinguish an output that is final for this simulation from one authorized in reality. GVT is useful only under declared timestamp and message-accounting rules; a late real-world fact cannot simply be assigned to an already fossil-collected past. Receive new facts at the current boundary and invalidate affected plans.

**F/I — A colony snapshot must include channels:** Chandy and Lamport's **February 1985** distributed-snapshot work captures a consistent global state including in-transit messages under its channel assumptions. [Original paper](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/Determining-Global-States-of-a-Distributed-System.pdf). **I:** independently copying every actor heap can create an impossible world, such as a received message with no corresponding send. The first harness should use one authoritative scheduler to checkpoint actor states and pending deliveries together; distributed cuts come later with an explicit transport protocol.

**Stronger models — I:** longer useful speculative prefixes and better predictions can improve overlap. More entangled agent work can also worsen rollback. The system needs measured useful-work fraction and an adaptive optimism window, not confidence in a model's forecast alone.

**Value — I:** teams running multi-agent release preparation, report generation or build orchestration pay for lower end-to-end latency. Begin with document/build artifacts and local simulated messages; independently irreversible purchases and messages make a poor first workflow.

**First proof — E, 10–14 days:** three TS actors—compatibility checker, release-note writer and rollout planner—each checkpointed at tool waits. Compare conservative scheduling with optimistic simulated-message delivery under configurable delayed facts. Track invalidation DAG, committed work, wasted CPU/tokens and completion latency; include highly coupled and adversarially late-message cases. Use logical processes in a local workerd/Node runner first; a DO coordinates a small hosted follow-up. One final release-record write sits behind the common broker.

**Demo + hook — I, 60 s:** three actors race ahead; a late compatibility result turns red; dependent futures visibly collapse while an unrelated artifact survives; corrected work finishes. **Draft tweet:** “Time Warp for cooperating agent programs: consume tentative results, run ahead, retract dependent futures when a fact changes. Only the stable approved release record leaves the simulator. Rollback cost is on screen.”

**Kill test — E:** on the target latency-dominated workload, optimistic execution's end-to-end completion time is no better than conservative scheduling once rollback, duplicate inference and coordination are included. Demote this before attempting global distribution.

## 5. Speculative interfaces: prepare the next interaction, then select it

**Idea — I:** fork an application's suspended controller into several likely next interactions so a user's chosen path has already done its expensive pure work. **100x version — I:** an interface maintains an executable cloud of possible next states across browser and edge, offering immediate previews while committing only the interaction the user actually chooses.

**Lineage — F:** Craig Zilles's **2004** “Increasing Interactivity by Predicting User Actions” explicitly proposes predicted-input execution with checkpointing, sandboxing and commit after validation. [Original workshop note](https://www.cs.utexas.edu/~skeckler/wild04/Paper4.pdf). **I:** ordinary prefetching and optimistic interfaces are substantial existing substitutes; the proposed extension is preserving an arbitrary qualified controller continuation, not inventing prediction.

**What stalled / what changes — I:** checkpointing general applications, containing their speculative I/O and predicting high-value interactions were difficult. A tool-only controller is a narrower target, and models can predict semantically complex next operations. Models also increase prediction cost, and ordinary prefetch may already capture most benefit. This deserves a demo but not priority over safety/debugging.

**Mechanism — I:** capture controller state, not the browser's actual DOM/socket state. Branches return immutable view models or render commands; the real UI renders only the chosen branch. Other possible outcomes are visibly labelled previews. A predicted input must match user intent and current data versions before cached work is reused. No hypothetical reservation, network request or analytics event is dispatched. Fresh remote information needs brokered reads or an expired-preview indicator.

**Stronger models — I:** better action prediction increases hit rate, but stronger models may also reduce ordinary interaction latency and erase the benefit. Surviving value is complex multi-step preview/undo and expensive pure transforms, not universal “instant AI.” Rank it below products whose value grows with the stakes of model autonomy.

**Value — I:** SaaS builders with slow configuration, analysis or workflow editors pay for responsive previews and fewer abandoned interactions. A checkout example should use simulated inventory until confirmation; do not present predicted stock as an actual hold.

**First proof — E, 7–10 days:** browser Web Worker with a QuickJS-Wasm editor controller paused on `nextInput()`. Fork five likely configuration edits from the same checkpoint; compute a deliberately realistic expensive validation/view model. On actual input, validate base version, select the matching result and discard the rest. Compare with optimized ordinary memoization/prefetch, not an artificially blocking baseline. Measure p50/p95 interaction latency, hit rate, bytes, CPU and wasted work on a held-out click trace; no battery claim without measurement.

**Demo + hook — I, 30–45 s:** preview five different application changes from one controller; choose one, reveal the fork histories, then show a stale prediction being invalidated correctly. **Draft tweet:** “The controller ran five possible next interactions while I was deciding. My click selects matching pure work; speculative branches cannot write. This is a QuickJS/Wasm prototype, compared with ordinary prefetch—not a snapshot of the browser.”

**Kill test — E:** held-out interaction traces show no worthwhile latency improvement over optimized prefetch/memoization within the same CPU and transfer budget. Better-looking speculative tiles would not justify the runtime.

## 6. The causal microscope: replay only the light cone

**Idea — I:** capture the causal dependency graph of tool interactions and fork only the part of execution affected by an intervention. **100x version — I:** an agent asks “which ordering or observation could have caused this?” and the engine explores equivalence classes of causal histories rather than millions of redundant total-order schedules.

**Lineage — F:** Lamport (**July 1978**) distinguishes happened-before from arbitrary total order. [Original](https://lamport.azurewebsites.net/pubs/time-clocks.pdf). COPS (**SOSP 2011**) tracks cross-key causal dependencies before exposing writes. [Authors' abstract](https://www.cs.cmu.edu/~dga/papers/cops-sosp2011-abstract.html). Flanagan and Godefroid's **POPL 2005** dynamic partial-order reduction identifies backtracking points from observed interactions. [Original paper](https://patricegodefroid.github.io/public_psfiles/popl2005.pdf).

**What stalled / what changes — I:** dependency metadata and state explosion remain expensive, and uninstrumented side channels destroy completeness. A narrow tool ABI makes operation/resource identity visible. Agents can suggest likely conflict sets, but authoritative independence must come from audited tool contracts or conservative instrumentation. Timestamp proximity is not causation; Lamport scalar clocks do not let one infer that every lower timestamp caused every higher timestamp.

**Mechanism — I:** log parent event IDs, message send/receive edges, resource/version reads and declared writes. Establish conservative independence rules; enumerate allowed completion orders for conflicting pending operations. Use a broker/event-loop checkpoint to replay alternate delivery orders. Within an opaque heap, any received input can affect all subsequent internal computation: begin with whole-capsule suffix replay, then optimize at explicit actor/module boundaries. Shared inventory conflicts still need version checks or transactions; causal consistency alone does not prevent double allocation.

**Stronger models — I:** more concurrent calls and agents create more useful causal structure to inspect. Models can propose interventions and explain minimized witnesses. The reduction algorithm must remain correct without believing those explanations. This is a high-value acceleration layer for ideas 2–4, probably not the initial standalone company.

**Value — I:** platform engineers debugging intermittent agent races and developers testing workflow controllers depend on reproducible schedules. Reduced replay cost matters when the alternative repeatedly invokes long prefixes or expensive inference.

**First proof — E, 7–12 days:** TS harness for four tool/actor operations with explicit read/write sets; include independent catalog reads plus two conflicting inventory updates. Exhaustively enumerate a bounded schedule set, then compare against dependency-guided exploration for identical terminal outcomes and bug witnesses. Add a malicious/incorrect independence annotation to establish that the conservative mode remains the trusted reference. Store causal metadata with capsule checkpoints and render a textual causal explanation in the debugger.

**Demo + hook — I, 45–60 s:** a noisy incident trace shrinks to the conflicting messages; swapping independent results changes nothing, but one legal conflict order reproduces the bug. **Draft tweet:** “Which events could actually change this failure? Tool-call causality cuts the replay search down to the relevant schedules. The bounded demo checks reduced exploration against exhaustive outcomes; clock order alone isn't the dependency model.”

**Kill test — E:** conservative dependency tracking retains nearly all schedule permutations on representative agent workflows, so its total cost is no lower than naive bounded exploration. Keep the graph for inspection, drop the optimization claim.

## 7. The history telescope: coarse-grain worlds without losing witnesses

**Idea — I:** compile huge execution trees into several property-specific resolutions, keeping exact anchors/witnesses underneath a navigable abstract history. **100x version — I:** months of agent experience remain searchable as a compact causal atlas that can zoom from a semantic outcome class back into an executable incident and refine itself when a supposedly irrelevant detail matters.

**Lineage — F:** Wilson's **1971** renormalization work is the physical inspiration for changing scale. [Original](https://journals.aps.org/prb/abstract/10.1103/PhysRevB.4.3174). The closer software mechanism is counterexample-guided abstraction refinement: Clarke et al., **CAV 2000 / JACM September 2003**, distinguish abstract spurious counterexamples and refine the abstraction. [Authors' full paper](https://www.cs.cmu.edu/~emc/papers/Papers%20In%20Refereed%20Journals/Counterexample-guided%20abstraction%20refinement.pdf).

**What stalled / what changes — I:** useful abstractions are property-dependent; forgetting a hidden variable can erase exactly the bug being sought. Models can propose predicates and names for outcome classes, but universal semantic equivalence of arbitrary JS states is not a plausible week-two feature. The practical new ingredient is cheap executable representatives that continuously test and challenge the proposed coarse-graining.

**Mechanism — I:** maintain exact content-addressed snapshots/journal anchors; a causal event index; and a lossy semantic navigation layer. For a specified invariant, group states by validated predicates such as grant version, pending logical effect and resource ownership—not merely by similar LLM summaries. A class contains exact representative pointers and accumulated scenario weight. Equal heap hashes plus compatible full environment/authority state permit a narrow exact reuse rule; different heaps with similar summaries do not. Learned classes guide search only unless a formal abstraction establishes a stronger guarantee. Expand/refine a class whenever probes distinguish its future behavior.

**Stronger models — I:** longer agent lifetimes create more history, while models can propose better abstractions and find challenging probes. This remains valuable as a debugger/search layer even when models have larger context windows: an executable reference is a different artifact from reading a longer transcript.

**Value — I:** operators of high-volume agent fleets pay for comprehensible incident retention and reusable regression corpora. Initially this is supporting infrastructure; selling “compressed understanding” before proving witness preservation would be premature.

**First proof — E, 10–14 days:** generate 10,000 bounded histories of one approval/retry controller with known invariants and a hidden version-dependent bug. Build hand-authored predicate classes, then let a model propose refinements. Test compression against exhaustive outcome/witness accounting on the bounded corpus. Keep raw anchors during the experiment; report index bytes, retained exact bytes and query time separately. Demonstrate one false grouping that is split after replay probes disagree.

**Demo + hook — I, 45–60 s:** zoom from 10,000 paths to a dozen outcome classes, select “stale approval,” reopen its exact failing continuation, and watch a bad coarse grouping split. **Draft tweet:** “A telescope for agent histories: semantic classes for navigation, exact replay underneath. A counterexample forces the summary to refine. We measure what gets compressed and which bug witnesses survive; prose never substitutes for the heap.”

**Kill test — E:** a grouping used to prune search loses a known material failure on the withheld bounded corpus. Stop using that abstraction for pruning; it may remain a labelled navigation index.

## 8. The entropy budget: spend compute on worlds that change the decision

**Idea — I:** schedule forks by expected decision value per CPU/token/byte budget, retaining surprising or dangerous witnesses and reconstructing cheap redundant history. **100x version — I:** a multiverse engine performs metareasoning about its own search—when to branch, where to checkpoint, when to ask for a real observation, and when to stop because further imagined experience cannot improve the action.

**Lineage — F:** Shannon's **July/October 1948** entropy quantifies uncertainty in a specified probability distribution. [Original paper](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf). Landauer and Bennett connect information loss/history to physical computation, as cited above. **I:** the operational analogy is a resource tradeoff between retaining state and recomputing it. Shannon entropy, compressed-image size, heap allocation and joules are distinct quantities. None is a universal proxy for business risk.

**What stalled / what changes — I:** reversible hardware is a different project, and retaining all intermediate state is expensive on ordinary systems. The capsule does not reverse CPU gates; it restores/replays stored state. The earlier measurements of freed high-water bytes remaining in snapshots make naive compression-based “state entropy” especially misleading. What changes is access to an explicit tree, repeatable rollouts and measurable costs; a model can suggest where another experiment would be informative.

**Mechanism — I:** maintain a candidate ranking with uncertainty, a hard risk-exploration allocation and observed branch cost. Spend the next batch on scenarios capable of changing the selected action or exposing a forbidden effect. Stop on a compute deadline, dominated alternatives, or insufficient simulator fidelity; sometimes the best next operation is a real read, not another simulation. Compare outcome diversity and weighted sample concentration, not raw fork count. Keep rare catastrophic witnesses regardless of their effect on average reward. Cache useful prefixes and choose checkpoint spacing using measured restore/recompute costs.

**Stronger models — I:** better predictions of experiment value and more accurate simulators can improve allocation. However, fixed UCT, diversity sampling and hand-built risk strata are strong cheap substitutes. This is demoted as an independent moonshot: if it works, it is the search engine's optimizer, not a credible thermodynamic revolution.

**Value — I:** high-volume search users pay through lower total decision cost or more defects found within the same budget. A standalone “entropy dashboard” has weak buyer value; integrate it with idea 1 or 3.

**First proof — E, 7–10 days:** implement random, fixed stratified, UCT-style and decision-change scheduling over the same saved TS controller/environment states. Give each the same CPU/model-call allowance and a hidden rare-failure stratum. Vary checkpoint spacing. Measure action regret, missed failures, real cost and terminal-state diversity on held-out seeds; include a case where low-probability failures must dominate the decision. Keep any learned scheduler from changing the acceptance oracle.

**Demo + hook — I, 30–45 s:** two equal-budget searches run beside each other; one keeps repeating familiar endings, the other finds a decision-changing failure and stops. **Draft tweet:** “10,000 forks can be 10,000 copies of the same mistake. This scheduler spends its budget on futures that could change the action, with a protected budget for rare failures. CPU, tokens and missed bugs are compared with simple baselines.”

**Kill test — E:** the learned allocation policy offers no held-out improvement over fixed risk-stratified sampling and ordinary UCT after its own inference cost. Use the simple scheduler and drop the separate product story.

## 9. The observer laboratory: test what an agent could know

**Idea — I:** fork the same decision process under different lawful information views to expose actions that depend on unavailable, stale or unauthorized knowledge. **100x version — I:** every multi-party automated decision is rehearsed from each principal's actual information frame, including possible hidden states, and the system identifies the smallest observation or authorization needed to act responsibly.

**Lineage — F:** Everett motivates observer-relative records, but the direct engineering foundation is Halpern and Moses's **July 1990** framework for local and group knowledge in distributed systems. Their results expose limitations on attaining common knowledge under practical communication assumptions. [Original paper](https://groups.csail.mit.edu/tds/papers/Halpern/JACM90.pdf). **I:** differing permissions or stale caches are not literally Lorentz transformations; “frame” names an information projection, not physical equivalence.

**What stalled / what changes — I:** epistemic reasoning becomes combinatorial as possible local histories multiply, and it rarely arrives as a familiar developer tool. Capsules let the actual policy run inside explicit information partitions. Models can generate plausible hidden cases and explain disagreements, while the harness enforces who can observe which fact. Relativity contributes intellectual discipline: an omniscient operator's view cannot silently be given to every agent.

**Mechanism — I:** create a public program checkpoint *before* private observations, then supply branch-specific views through tools. Never fork a privileged heap and hope masking the next prompt removes secrets already in memory. For each information set, test candidate policies over multiple hidden states consistent with that view. Require a policy to choose using its observations, without selecting the best action separately after peeking at each hidden state. Conflicting objectives need an explicit aggregation/authority rule; majority vote across copies of one model is not consensus among independent principals.

**Stronger models — I:** stronger agents can act on subtler hints and larger contexts, making inadvertent omniscience and permission leakage harder to spot manually. Better adversarial hidden-state generation improves tests. Models do not remove the underlying knowledge limits; sometimes the correct answer is to request a fresh read or refuse an action.

**Value — I:** builders of multi-tenant support agents, internal authorization workflows and collaborative planning systems pay for tests that catch information leaks, stale assumptions and unsupported decisions. This is a credible specialist suite within the failure-search gate, but a broad marketplace of “observer worlds” is not yet a focused business.

**First proof — E, 7–12 days:** a TS support controller whose available tools differ for customer, support worker and administrator. Fork from a clean checkpoint into role-specific views; cross those with hidden account-owner and approval states. Include a privileged-data leak, an approval-revocation case and a decision that can only be resolved by a fresh authorized read. Check data provenance and effect target against an independent role policy. Compare with ordinary permission/unit tests on held-out templates.

**Demo + hook — I, 45–60 s:** show three lawful views of the same request; the agent appears confident in each, but incompatible hidden states force an extra observation before the broker allows a write. **Draft tweet:** “Same agent program, different lawful views. We fork it before private data arrives and test hidden states it can't distinguish. The useful result is sometimes the one extra authorized question it must ask—not a more confident answer.”

**Kill test — E:** on held-out permission/staleness cases, view-based execution finds no material mistakes beyond conventional authorization and data-flow tests at comparable integration effort. Keep it as a small test mode rather than a separate platform.

## Evaluation rules shared by the shortlist

**I — The decisive benchmark is better decisions or better discovered failures per total budget.** Publish source rerun, ordinary property-testing, candidate-generation and single-pass baselines where applicable. Forking only wins mechanically when a meaningful common prefix or captured intermediate state exists; replaying a ten-line pure function can be simpler and faster. Measure the actual prefix/suffix mix instead of assuming a capsule advantage.

**I — Avoid three sources of fake confidence:** no training/search access to held-out scenarios; no acceptance oracle generated and graded by the same unchecked model; no replay reuse after dependencies diverge. Show simulator-contract violations separately from real program bugs. A deliberately seeded bug is a legitimate test when disclosed; it is not evidence of a defect discovered in production.

**I — Record a small reproducibility manifest:** program/module/bootstrap hashes, deterministic profile, exact parent snapshot, environment base/version, branch intervention, PRNG streams, logical time, tool request/reply digests, delivery order, scenario weights, budgets, oracle version and effect receipts. Retain winning and failing witnesses. Browser edits and downloaded snapshots never grant authority by themselves. Include resource-control overhead; the supplied spike still needs allocator/stack accounting and independently enforceable execution budgets before public untrusted use.

**E — A bounded release claim:** “The independent broker enforces these three invariants for this one connector; this policy additionally passed N scenario runs under simulator S.” That is reviewable. “The agent explored every future and therefore cannot make irreversible mistakes” is not a conclusion any finite test of an open world supports.

## Ranked shortlist and the one bet

**I — Ranking is a judgment about product leverage, model improvement, a believable two-week proof and strength of an honest demo—not measured market demand.**

| Rank | Idea | Decision |
| --- | --- | --- |
| **1** | **3. Failure-search gate** | Bet here: clear effect boundary, rising stakes as agents improve, executable failure evidence. |
| **2** | **2. Counterfactual production debugger** | Best entry interface and immediate developer value; model fidelity limits counterfactual claims. |
| **3** | **1. Action compiler / MCTS** | Largest planning upside; proceed first where environments are owned and reward is checkable. |
| 4 | 6. Causal microscope | Valuable correctness/performance layer for the first three. |
| 5 | 4. Time Warp society | Ambitious concurrency product; must beat conservative scheduling after wasted work. |
| 6 | 9. Observer laboratory | Useful specialized failure suite; permissions/information provenance supply the concrete wedge. |
| 7 | 7. History telescope | Necessary at scale; property-preserving abstraction is hard and not initially the product. |
| 8 | 5. Speculative interfaces | Strong visual demo, weaker durable advantage over prefetch as models get faster. |
| 9 | 8. Entropy budget | Keep the resource-allocation research; demote the standalone thermodynamics framing. |

**I — #1 case: the failure-search gate.** More capable models will perform longer, more consequential actions; that increases the value of independent enforcement and realistic rehearsal. A few well-specified connectors make the first version possible without pretending to simulate the whole internet. A counterexample that can be downloaded, replayed and repaired is strong engineering evidence, and one real write behind a visible ledger gives the demo a consequential ending. The risk is that simulator fidelity and ordinary testing do most of the work, leaving forkable heaps as optional plumbing. The equal-budget kill test is deliberately aimed at that risk.

**I — #2 case: the production debugger.** This has the smallest trust leap: reproduce an actual recorded past, then expose exactly where a hypothetical intervention leaves known history. Teams already suffer from intermittent failures, and stronger models are better investigators when they can run experiments. The differentiator is not generic time travel; it is executable tool-orchestration incidents with controlled divergence and zero accidental reissues. Even if full counterfactual prediction fails, exact replay and shared witnesses retain value. The danger is an attractive viewer that adds less than a good conventional reproducer.

**I — #3 case: the action compiler.** This most directly turns a program into a searchable universe, with policies as choices and environment continuations as weighted possibilities. Better models improve both plans and search guidance, while capsules avoid recomputing deep prefixes. Its addressable ambition is huge, but a poor simulator can confidently choose the wrong action faster. Start with owned state machines and independently measured outcomes; expand only after the planned decision wins in real or withheld environments. Do not build a generic “best timeline” API before establishing that narrow result.

**I — The ONE I would bet on: idea 3, the failure-search gate.** Build its first implementation around **one configuration-update connector and three independent invariants**, then make idea 2's debugger the way to inspect failures. Use idea 1's search to explore the actual continuation, but optimize first for finding a counterexample rather than the prettiest ending. The public proof is: an agent proposes an action; a legal failure timeline breaks it; the witness replays; a revised policy survives a disclosed held-out suite; one version-checked real write is recorded. “The planet's edge as a multiverse engine” is the expansion path once this narrow contract earns trust.

## Five-line TL;DR

1. **I:** The moonshot is abundant executable rehearsal before scarce real effects; stronger agents make that boundary more valuable.
2. **I:** Best bet: a failure-search gate, with a counterfactual production debugger and live-state MCTS underneath it.
3. **I:** A capsule captures the program; a versioned simulator supplies hypothetical futures, whose weights and limits must stay explicit.
4. **I:** Commit one checked action from real history, ingest its actual result, then replan; a lucky simulated future cannot be promoted into reality.
5. **E/I:** Prove one connector in two weeks, beat equal-budget ordinary testing/search, and show the replayable failure plus one real effect receipt.
