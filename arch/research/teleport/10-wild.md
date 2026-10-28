# Wildcards: live programs as specimens, save games, and experimental worlds

Research date: **2026-10-28**. Read: [BRIEF-2](BRIEF-2.md), [BRIEF](BRIEF.md), and the TL;DRs/verdicts of reports [01](01-compute.md), [02](02-history.md), [03](03-contract.md), [04](04-spike.md), and [05](05-product.md); relevant measurement/contract sections were also consulted.

**F** = sourced fact, including attributed vendor statements. **F-prior** = a repository measurement attributed to its original report, not reproduced here. **M** = measured in this investigation; **there are no new M claims**. **I** = inference or proposed design. **E** = estimate, hypothetical workload, price experiment, or arithmetic. Every idea, ambition, product decision, demo, and draft tweet below is **I** unless separately marked. Sources were accessed **2026-10-28**; publication/update dates appear in the source notes. No experiments, accounts, deployments, installs, outreach, or posts were performed.

## Decision

**I — Keep three narrow uses:** a runnable failure specimen; a shareable save game for generated agent code; and a laboratory that forks hidden program state before an experiment. The ambitious common destination is **unfinished work becoming a transferable artifact**: someone else can continue or interrogate the actual computation, rather than reconstruct its intent from a transcript. This is useful only for the part of work actually inside the captured runtime.

**I — Reject the universal market around it for now.** A program attachment, URL, spore, or shop listing is a distribution metaphor. None independently establishes a reason to snapshot a heap. Selling warmed computations has unattractive CPU economics, and selling an agent's heap does not sell its model's attention/KV state, legal rights, credentials, or access to someone else's tools.

**I — Confidence:** medium in the narrow technical utility, low in incremental willingness to pay. These are three retained proof candidates with concrete value hypotheses, not three validated businesses. There are no customer interviews or production traces in this investigation. Unknown incidence of the relevant hidden-state problems is the largest commercial uncertainty.

## The adversary every idea must beat

**F — Cached replay is stronger than “start over.”** Golem documents recovering completed model/tool calls from its operation log while rebuilding local variables and the stack through reexecution; its optional application snapshots reduce replay. Restate documents durable specialist-agent routing and remote calls. LangGraph checkpoints already support branching, and resuming an interrupt reruns the interrupted node's prefix. [Golem recovery][G1], [Golem snapshots][G2], [Restate handoffs][R1], [LangGraph forks][L2], [LangGraph interrupts][L1].

**I — Consequence:** do not count avoided historical LLM/API charges against a correctly journaled baseline. Nondeterministic input is recoverable when its exact result and delivery order were recorded. The remaining advantages are avoided local prefix computation, preservation of opaque/generated objects and continuations without per-program exporters, and movement into a different compatible executor. If there is neither replay nor a preexisting checkpoint, a snapshot taken afterward cannot recover a lost past.

**I — Give each alternative its best case:**

- **JSON + code:** prefer it for explicit domain state, easy schema migration, inspection, and small transfers. A custom serializer/state-machine transformation can represent more than naive `JSON.stringify`; compare its authoring cost rather than claiming closures make recovery impossible.
- **Temporal/Restate/Golem:** prefer durable journal replay when local reconstruction is cheap and external effects dominate. **F:** Temporal checks replayed commands against event history; it is not merely a JSON state machine that loses local control flow [TE1]. **I:** compare nearest checkpoints, caches, and history compaction where applicable, not unbounded entry replay by decree.
- **Cloudflare Workflows/hibernating DOs:** prefer managed steps/events and explicit durable state when those fit. **F:** Workflow docs warn that memory outside steps can disappear; DO hibernation resets memory [C4][C3]. **I:** generated opaque in-step state can motivate an interpreter checkpoint, but ordinary durable waiting cannot.
- **V8 startup snapshots:** prefer them for build-time initialization, especially when execution can retain the JIT. **F:** Node documents startup snapshot support for single-executable applications [N1]. **I:** require evidence of a per-run pending continuation before choosing another engine merely to warm libraries.
- **Containers/VM or process checkpoints:** prefer them when the useful state includes an OS process tree, filesystem, or native environment. **F:** CRIU checkpoints Linux tasks and documents integration with container systems [CT1]. **I:** a headless JS image's narrower browser/Worker portability is a tradeoff, not a claim to preserve more state. No container experiment is permitted in this brief, so comparison here is architectural and no size/speed advantage is measured.
- **Rerun:** prefer it whenever starting clean is faster and cheaper than capture, storage, transfer, compatibility management, and recovery. Tiny tasks should be allowed to make the entire teleport mechanism look unnecessary.

**F — The snapshot engine is already available.** Vercel's quickjs-wasi documents VM snapshots including pending promises, restoration, and rebinding host callbacks. That is a direct implementation alternative; an application built on it could offer these same experiences. [quickjs-wasi][Q1]. **I:** sell a reliable workflow/integration, not a memory-copy primitive.

**F-prior — Working envelope, not universal numbers:** the [hop spike](04-spike.md) demonstrated Node→local workerd→Chrome→Node and 100 divergent forks. Warm small-pattern restore-to-next-boundary times were about **0.4 ms** on Chrome/Node, while observed browser HTTP hops sometimes stalled for seconds. A 50 MiB pseudorandom workload needed about **52.53 MB zstd**. Sparse synthetic deltas were about **22–23 KB**; delta transfer itself was not qualified. The [earlier roadblocks](../v8/03-roadblocks.md) measured **1.50–6.39 MB gzip** examples and **5.2–11.5×** QuickJS/Wasm slowdowns against V8 on two small glue tasks, **31.1×** on an integer recurrence. No result licenses a universal 100 KB or submillisecond handoff claim.

**E — A falsifiable break-even model.** Let `P` be the prefix CPU that cached replay must rebuild, `C` capture/compression cost, `S` shipped bytes, `B` effective bytes/second, and `D` durable ownership/rebinding/decode/restore cost. One handoff saves latency only when `P > C + S/B + D`, before any interpreter penalty on the original run. Compare end-to-end execution against host V8 too. For `N` forks on the same engine, replay costs roughly `N(P + U)` and snapshotting `P + C + N(S/B + D + U)`, where `U` is each suffix; this does not include branch-specific model calls. JSON costs `P + export + N(load + U)` and can beat both.

**E — Scale anchors used below:** 3 MB takes **240 ms at 100 Mbit/s**, **2.4 s at 10 Mbit/s**, payload only. A 20 KB JSON checkpoint takes **1.6 ms at 100 Mbit/s**. Thus a 3 MB heap needs a meaningful reconstruction or engineering advantage over JSON; a 20 ms prefix is an obvious loser over a slow link.

**F/E — Dollars constrain the fantasies.** Workers Standard lists **$0.02/additional million CPU-ms**. One second of marginal CPU is therefore **$0.00002**; one million one-second tasks are **$20** before included usage, requests, limits, and orchestration. A 30-second prefix costs **$0.0006**, and avoiding it 100 times saves only **$0.06** of that marginal CPU. R2 Standard lists **$0.015/GB-month**: one million 3 MB images occupy 3,000 GB, **$45/month gross storage**, before history, operations, broker costs, and allowances. Storage can be cheap without generating a market. [Workers pricing, updated 2026-10-02][C1], [R2 pricing, updated 2026-10-26][C2].

**E — Commercial notation:** all labor examples use an assumed **$150/hour loaded engineering cost**. `R100` means hypothetical annual subscription revenue at **100 paying organizations**, not TAM, a forecast, or evidence that 100 buyers exist. The cards deliberately expose both price ceilings and missing demand. The recurring business scenarios overlap and must not be summed.

## What the older ideas and other sciences actually contribute

- **I — Cells dividing:** copying a working state is a useful analogy for branching. It does not imply independent evidence: identical saved randomness produces correlated futures. Give forks explicit entropy domains and separate budgets; compare outcomes against held-out cases. Biological inspiration here is conceptual, not a claim that mitosis is a heap-copy implementation.
- **F — Spores:** Kikuchi et al. studied dormant *B. subtilis* spores integrating nutrient pulses through preexisting electrochemical potential. **I:** borrow conditional awakening after accumulated evidence, with a host-side watcher; dormant bytes cannot inspect their own environment. [Science, 2022-10-07][B1].
- **I — Viruses:** borrow a compact program delivered to a host that supplies missing machinery. For software the receiving owner must explicitly admit it and grant resources. A virus-like distribution strategy does not solve consent, confidentiality, or tool admission; the useful version is an invited plugin.
- **F — Telescript:** the 1996 workshop record describes `go` preserving execution state and `send`/`clone` distributing agents. White's own platform proposal includes permissions, waiting, checkpointing, and debugging. **I:** the lesson is to package authority and lifecycle along with the artifact; neither travel nor email transport is a new thesis. [Workshop record][T1], [White, 1996-03-11][T2].
- **F — Lisp/Smalltalk images:** Pharo documents saving objects, running programs, and the environment in an image. SBCL's `save-lisp-and-die` preserves global state while unwinding the stack. **I:** “Lisp image” is not one uniform full-continuation contract; retaining exact executable state has decades of precedent. [Pharo, 2022-03-26][S1], [SBCL manual, accessed 2026-10-28][S2].
- **F — Plan 9:** per-process namespaces compose local/remote resources behind a uniform protocol. **I:** stable tool names plus explicit rebinding are more valuable than pretending an open resource travels with memory. [Pike et al., 1992; reprinted 1993][P1].
- **F — Erlang:** supervisors restart children, limit restart frequency, and escalate failures. **I:** revive a known-good capsule after environmental failures, but do not repeatedly restore a corrupted/broken state and call that healing. [OTP supervision principles][E1].
- **F — Web continuations:** Racket serializes continuations into client/server storage and can put a continuation into a URL; its docs describe source compatibility and serializability constraints. **I:** a URL can identify a continuation, but bookmarkability and access control do not require a live heap. [Racket stateless servlets][W1].
- **F — Croquet/TeaTime:** Reed's 2005 work describes replicated computation; current Croquet docs explain ordered events, deterministic model time/randomness, and joining from a snapshot plus later events. **I:** a fork needs no automatic merge, and replicating a heap once does not synchronize its future. [Reed, OOPSLA 2005][CR0], [Croquet snapshots][CR1], [Croquet FAQ][CR2].
- **F — HPC and “time reversal”:** SCR manages checkpoint/restart datasets and recovery from incomplete/failed checkpoints. rr implements reverse execution through recorded execution and restartable checkpoints. **I:** neither preserves the whole external universe; rewind means restore then execute recorded inputs forward, and never undo a payment or an email. [SCR concepts][H1], [rr project][D1].
- **I — Economics:** a live computation is a reproducible digital good, not inherently a scarce rival good. Selling sole ownership requires a brokered execution right, not merely withholding a copy. A warmed state can be inventory, an option to continue, or a paid service milestone, but its value is capped by cheaper reconstruction and by the rights a buyer actually receives.

## Seventeen ideas, with their strongest versions and their failure modes

The **100×** lines are deliberately ambitious destinations, not achieved multipliers. Each card includes a one- to two-week rejection experiment; only the three retained cards merit an expanded implementation plan.

### 1. Mitosis: fork one prepared agent into an experimental population — KEEP, narrowly

- **One sentence:** fork a parked generated program into alternative tool replies or policies and compare its futures without reconstructing hidden local state.
- **100× version:** every risky agent decision opens an experimental population; measured outcomes choose a continuation, while the parent retains the ability to stop.
- **Pain/current practice:** agent evaluation teams use graph forks, cached traces, and repeated runs; those already retain completed steps. **F:** LangGraph explicitly supports checkpoint forks [L2]. **E:** 100 experiments with a 30 s replayed local prefix waste 3,000 s versus one prefix; this is a qualifying workload, not measured customer prevalence.
- **Why live state:** a 3 MB closure/Map/iterator-rich prefix could be restored without a custom exporter. **E:** 100 copies transfer 300 MB and consume roughly 24 s of aggregate 100 Mbit/s payload time; compare to 3,000 s prefix CPU, then to a much cheaper explicit-state checkpoint. Historical LLM spend is equal under cached replay.
- **Who pays/value:** runtime/evaluation teams, **E $250–$750/month**, `R100 $0.3–0.9M`, only for faster experiments or avoided adapter work; saving $0.06 CPU per batch cannot support this price.
- **Killer objection/expert reply:** “LangGraph already forks; your 100 children may explore the same randomness, and JSON is faster.” Correct unless hidden in-node state is costly to expose and the suffix is a meaningful experiment. Selecting a winner does not merge heaps or authorize that branch to write.
- **1–2 week proof/demo/tweet:** run the same 100 suffixes from cached replay, JSON, and heap branches; require exact reference outputs and a useful aggregate-time or integration advantage. Demo a failing branch beside a successful branch. Draft: “Same parked JS state, 100 controlled futures; here is where forks beat cached replay—and where JSON wins.”

### 2. Spores: jobs germinate only when conditions are favorable — KILL as a standalone product

- **One sentence:** park an unfinished job until price, data availability, connectivity, or approval crosses its wake threshold.
- **100× version:** billions of dormant computational intentions wait for evidence and awaken at the cheapest useful moment.
- **Pain/current practice:** schedulers, durable timers, queues, and workflow events already cover waiting. **F:** DO WebSocket hibernation stops duration charging, resets memory, and reruns the constructor [C3]. **E:** a million 3 MB parked images have only $45/month gross R2 storage; this does not measure a customer's avoidable bill.
- **Why live state:** useful only if awakening otherwise rebuilds a substantial hidden prefix; the 240 ms/3 MB transfer floor can dominate an ordinary timer handler. “Wait three days” alone favors JSON/workflows.
- **Who pays/value:** automation platforms; **E ceiling $50/month** for a minor convenience, `R100 $60K`; no sourced unmet demand or standalone price justification.
- **Killer objection/expert reply:** “This is a timer and a state row.” The program still needs an external watcher, so it cannot independently sense cheap compute while dormant.
- **1-week proof/demo/tweet:** schedule 1,000 local synthetic wake events and compare JSON/DO-style reconstruction with capsule restore; count actual billed-resource proxies and errors. Demo a job waking on its third condition signal. Draft: “Dormant code wakes on conditions; the experiment asks whether its heap adds anything over a timer.”

### 3. Invited viral capsule: a program enters the data owner's host — MERGE into #9

- **One sentence:** send unfinished analysis to an explicitly consenting customer runner that grants read-only tools beside its data.
- **100× version:** a portable analysis travels through multiple institutions, accumulating approved results without centralizing their source datasets.
- **Pain/current practice:** private runners, connector APIs, query pushdown, and JSON task dispatch. No sourced frequency or budget for the specific live-state variant was found. **E:** 1 GB input reduced locally to 100 KB avoids about 10,000× result-only transfer; that is locality value shared with SQL, not evidence for heaps.
- **Why live state:** a changing, opaque plan assembled over previous stages might need 3 MB to move versus an estimated 10 s reconstruction. JSON task placement still wins if it carries enough state in kilobytes. Returning a post-read heap may leak source data remnants.
- **Who pays/value:** integration vendors, **E $500–$1,500/month** per vendor workspace, `R100 $0.6–1.8M`, conditional on access/revenue enabled or recurring integration work saved.
- **Killer objection/expert reply:** “Run my query near my database; why import your VM?” A hostile host can also read or alter the capsule. Private placement is not confidential computation.
- **2-week proof/demo/tweet:** synthetic 100 MB streamed fixture, compact plan, Node→local workerd handoff; compare JSON task dispatch and local query execution, including all bytes. Demo the same unfinished plan continuing at the data owner. Draft: “The job visits the data; JSON gets the same chance to win.”

### 4. Warm computation grocery: buy a ready-to-continue state — KILL public market; retain internal cache as an optimization

- **One sentence:** sell an already initialized parser, search workspace, or analysis state instead of source code and setup instructions.
- **100× version:** a commodity exchange of computational intermediates, with provenance, freshness, and exact resumption contracts.
- **Pain/current practice:** caches, prebuilt indexes, model endpoints, and startup images. **F:** V8 documented custom startup snapshots in 2015 [V1]. **E:** a 30 s CPU prefix costs $0.0006 at the cited Worker marginal tariff, which is a poor retail margin anchor.
- **Why live state:** could retain a 3 MB partially solved search with opaque solver internals; initialization-only goods are served well by startup snapshots or serialized indexes. Paid LLM outputs can already be cached as data.
- **Who pays/value:** internal platform teams might pay for latency; **E $100/month**, `R100 $120K`, not a defensible public marketplace from this evidence. Hypothetically 1M sales at $0.001 yield $1K gross before all fees/support.
- **Killer objection/expert reply:** “Your warm item is stale, runtime-specific, and more expensive than rebuilding it.” Provenance and rights cost more to support than commodity glue saves.
- **1-week proof/demo/tweet:** offer ten real initialization fixtures as raw code, explicit-state cache, V8 startup state where supported, and live snapshots; measure cold completion. Demo opening a prepared parser. Draft: “A shelf of warm programs, priced against the cost of making them again.”

### 5. Resell unfinished computation: work-in-progress changes owners — KILL market thesis

- **One sentence:** a buyer purchases a partially completed running investigation and may later resell its remaining work.
- **100× version:** paid research becomes a liquid market of executable milestones and options on future results.
- **Pain/current practice:** consulting deliverables, notebooks, task queues, and milestone contracts; no primary evidence of demand for a resaleable JS continuation was found. **E:** 20 minutes of historical model work is irrelevant to replacement cost if the output/log is already available.
- **Why live state:** only a useful small partial solver state or closure-rich investigation has an advantage over its result and provenance. **E:** a 3 MB checkpoint replacing 30 s of local reconstruction saves latency but only $0.0006 marginal CPU.
- **Who pays/value:** specialized research service buyers, **E $10 per accepted milestone**; 100 customers buying ten/month is $120K annual gross transaction value, only $12K revenue at a hypothetical 10% take. This is not a market estimate.
- **Killer objection/expert reply:** “I cannot value it without inspecting it; inspection gives me a copy.” Rights, stale external assumptions, adverse selection, and duplicated effects dominate portability.
- **2-week proof/demo/tweet:** simulate ten paid-milestone exchanges locally with a broker-controlled right to continue; measure whether buyers can evaluate results without importing authority. Demo a read-only handover, not real trading. Draft: “A computation can change hands; whether anyone buys the unfinished part is the harder question.”

### 6. Time-reversal console: rewind an agent's world — MERGE into #7, remove reversal claim

- **One sentence:** restore earlier checkpoints and replay recorded imports to inspect where an agent's state became wrong.
- **100× version:** inspect any historical decision, vary one input, and compare a counterfactual future alongside reality.
- **Pain/current practice:** tracing, deterministic record/replay, and graph time travel; **F:** rr already supplies reverse execution via replay [D1]. **E:** 20 local investigation iterations with a 30 s prefix consume ten minutes before any suffix work.
- **Why live state:** reduces repeated traversal and preserves hidden in-node state; an input journal remains required between checkpoints. **E:** 20 restores of 3 MB move 60 MB versus replaying 600 s of prefix, but a proper nearest-checkpoint baseline may remove most of that gap.
- **Who pays/value:** agent debugger teams, **E $250/month**, `R100 $300K`; count the same buyer pool as #7, not additional revenue.
- **Killer objection/expert reply:** “You can rewind the guest, not my database or the model service.” Correct; clock, entropy, import delivery order, and effect suppression must be explicit. Await-only snapshots do not offer arbitrary instruction-level stepping.
- **2-week proof/demo/tweet:** a 50-boundary trace, five checkpoints, exact recorded forward replay and ten edited futures; compare nearest-checkpoint JSON replay. Demo the earliest differing boundary. Draft: “Restore the past, replay forward, change one reply; external history stays real.”

### 7. Failure specimen: attach the actual failing computation to an issue — KEEP, rank #1

- **One sentence:** a failure report carries the last healthy parked program, its exact build, and a bounded effect tape so another engineer can reproduce and branch it locally.
- **100× version:** every useful agent incident becomes an executable regression specimen that a maintainer or repair agent can examine without production credentials.
- **Pain/current practice:** traces, prompts, screenshots, mocked reruns, and graph checkpoints. **F:** LangChain's survey of 1,300+ respondents reports 89% agent observability, 62% detailed tracing, and 32% naming quality as a leading production barrier [L0]. This establishes adjacent pain, not snapshot demand. **E:** four incidents/month × one hour saved = $600/month engineering benefit.
- **Why live state:** retains mutation, aliasing, closure-captured state, and pending control flow inside generated code without writing a bespoke serializer for each incident. **E:** a 3 MB specimen plus bounded tape replacing 30 minutes of manual reconstruction is valuable even if engine restore itself is merely ordinary speed. Cached replay may reproduce it equally well and must be tried.
- **Who pays/value:** platforms embedding generated JS and their support teams, **E $200–$500/month**, `R100 $0.24–0.6M`; a $250 pilot should require at least two independently reproduced incidents.
- **Killer objection/expert reply:** “I already have a deterministic replay bundle; your heap leaks customer data and cannot run patched code.” Valid. Export only approved synthetic/sanitized-origin specimens; pin old builds, change future replies or an explicit strategy hook, and verify fixes by rerunning source. General heap redaction and hot-patching suspended frames are excluded.
- **2-week proof/demo/tweet:** reproduce ten generated-code failures in a separate executor, then compare trace-only, cached replay, explicit-state, and capsule workflows using diagnosis time and correctness. Demo opening an issue artifact and trying a different next reply. Draft: “This bug report contains its waiting program. Continue the failing run locally, with recorded tools and no production authority.”

### 8. Agent organ transplant: specialists exchange live programs — MERGE into #9

- **One sentence:** hand an opaque subtask's continuation to another agent harness instead of asking its model to reconstruct progress from prose.
- **100× version:** teams of interchangeable specialists pass executable work between owners while retaining exact provenance and bounded execution rights.
- **Pain/current practice:** typed tool calls, artifact stores, summaries, durable remote-agent calls. **F:** Restate documents durable specialist selection and cross-service handoffs [R1]. **E:** two lost-context corrections at ten minutes each create $50 labor value per handoff if humans are actually involved; no incidence is established.
- **Why live state:** preserves the JS controller's exact work; it does not preserve a remote LLM's hidden activations or make the receiving model understand a heap. A small manifest and human-readable status remain necessary. **E:** compare a 3 MB capsule with a 20 KB structured handoff plus cached import tape.
- **Who pays/value:** agent-platform teams, **E $250–$750/month**, `R100 $0.3–0.9M`, conditional on fewer actual handoff failures; shared buyer pool with #9.
- **Killer objection/expert reply:** “The next model needs explicit context anyway.” If the useful state is already messages/files, those artifacts are the right handoff. An opaque interpreter can make collaboration harder.
- **2-week proof/demo/tweet:** ten integration tasks, two harnesses sharing one runtime/ABI, synthetic tools; compare summary, JSON artifacts, cached replay, and continuation transfer. Demo a different harness finishing the task. Draft: “Hand off the controller's live work, then measure whether the specialist still needs the same explanation.”

### 9. Shareable save game for agent work — KEEP, rank #2

- **One sentence:** save an agent-generated JS job at a tool/approval boundary and let a teammate continue a controlled copy without reconstructing its hidden intermediate state.
- **100× version:** unfinished digital work is as shareable and branchable as a document, across teams, devices, and consenting private runners.
- **Pain/current practice:** shared sessions, exported messages/files, checkpoints, durable approval workflows. **F:** LangGraph supports indefinite interrupt waiting but restarts the current node [L1]. **E:** eight interruptions/month requiring 20 minutes of manual recovery imply $400 labor pain; the price must shrink if actual recovery is one click today.
- **Why live state:** strongest for generated code that creates stateful closures, object graphs, and nested awaits not predesigned as a graph schema. A 3 MB image can replace an estimated 5 s rebuild or a custom adapter; a cached replay log may eliminate the need entirely. Movement also requires a new host's tool grants.
- **Who pays/value:** code-execution platforms and integration-agent vendors, **E $100–$300/month**, `R100 $0.12–0.36M`, with a separately scoped integration pilot. At $200/month the assumed $400 benefit leaves room, but a 40 h integration ($6K) destroys a small-team sale.
- **Killer objection/expert reply:** “Session sharing already does this, and a transcript plus filesystem is the whole agent state.” Correct for many coding agents. Keep only the embedded generated-program segment; a browser, terminal, filesystem, model KV, or OS process outside that segment does not travel.
- **2-week proof/demo/tweet:** ten closure-rich generated programs, teammate restore after original executor exit, duplicate claims rejected, no repeated completed imports; compare explicit-state and cached-replay sharing. Demo approval→different executor→correct draft output. Draft: “A save game for the code inside an agent: share the parked program, grant fresh tools, continue from its wait.”

### 10. App store of paused programs — KILL until #9 has demand

- **One sentence:** distribute task-specific programs already parked at the point where a user supplies their data or consent.
- **100× version:** users buy outcomes-in-progress instead of installing applications and configuring workflows.
- **Pain/current practice:** templates, hosted apps, notebooks, workflow catalogs; no sourced evidence of buyers preferring opaque running instances. **E:** a 20 s setup saving is worth little when templates already take one click.
- **Why live state:** only per-instance accumulated state distinguishes it from a code template/startup snapshot. A 3 MB generic warm image can be larger and less auditable than the task's source and configuration.
- **Who pays/value:** vertical workflow vendors, **E $5/month/user**, 100 organizations × ten users implies `R100 $60K`; acquisition/support economics are unknown.
- **Killer objection/expert reply:** “You are selling a template with more compatibility and inspection problems.” Marketplace discovery, trust, refunds, and state freshness are larger work than restoring the object.
- **1-week proof/demo/tweet:** prepare five task templates both as code+JSON and paused images; measure user setup/completion and payload. Demo one parked report waiting for a file. Draft: “Five ready-to-continue programs versus five normal templates; which actually gets the task done sooner?”

### 11. Email attachments that continue working — KILL as product; packaging for #9

- **One sentence:** send a paused report or reconciliation task that the recipient explicitly opens in a compatible sandbox and continues.
- **100× version:** business correspondence contains executable unfinished work rather than prose requests and disconnected files.
- **Pain/current practice:** document attachments, forms, approval links, shared task URLs. **E:** avoiding one 15-minute clarification is worth $37.50 at the assumed labor rate, but no evidence connects that saving to preserved JS control flow.
- **Why live state:** only if meaningful hidden work preceded the handoff; otherwise a form plus JSON is smaller and easier to inspect. **E:** 3 MB becomes about 4 MB under base64 before message overhead; many communications need only a short state URL.
- **Who pays/value:** workflow vendors, **E $5/user/month**, the same hypothetical `R100 $60K` at ten seats/org; no separate incremental business established.
- **Killer objection/expert reply:** “An executable attachment is a worse approval link.” Email transport does not carry authorization; forwarded mail must not confer write rights. Never auto-execute on receipt or preview.
- **1-week proof/demo/tweet:** locally export/import a capsule file, no mail sending; compare a shared JSON-backed task. Require explicit open, fresh grants, and zero network tools in preview. Demo a recipient continuing read-only work. Draft: “An attachment can contain unfinished work; opening it should grant nothing by itself.”

### 12. A URL that is a running program — KILL as distinct mechanism; useful interface for #7/#9

- **One sentence:** opening a URL creates a controlled branch from a named parked computation.
- **100× version:** the web links to executable situations, so any demonstration, calculation, or bug can be continued rather than merely viewed.
- **Pain/current practice:** session links, notebook links, server-side continuation URLs. **F:** Racket documents serializing continuations into URLs [W1]. **E:** a 3 MB embedded payload becomes roughly 4 MB base64; a short pointer is the practical version.
- **Why live state:** the linked object may preserve hidden execution state, but the URL itself could identify JSON, a replay log, or a remote session equally well. Content identity must be separate from permission to run or issue effects.
- **Who pays/value:** developers of #7/#9; **E standalone incremental price $0**, `R100 $0`. It is navigation, not an additional product.
- **Killer objection/expert reply:** “That's a session ID.” Often yes. URLs may leak through sharing/logging, so a read link cannot be an implicit unlimited write capability. A GET/preview must not trigger a purchase or approval.
- **1-week proof/demo/tweet:** local content-addressed lookup and explicit branch button; test 100 repeat opens, zero effects, stable parent, wrong-build rejection. Demo two URLs continuing different futures. Draft: “This link names a paused program; opening it previews, continuing it creates a fresh authorized branch.”

### 13. Personal Smalltalk world: an app follows its owner — KILL broad app claim

- **One sentence:** carry a personalized application world between desktop, browser, and phone without rebuilding its in-memory domain state.
- **100× version:** personal computing becomes a collection of living objects that outlast devices and can be handed to collaborators.
- **Pain/current practice:** local-first state sync, databases, cross-device sessions, VM images. **F:** Pharo already saves running object worlds [S1]. **E:** saving two minutes/session × 20 sessions/month is $100 labor-equivalent value for a qualified professional, not established willingness to pay.
- **Why live state:** arbitrary internal objects and closures can continue; the DOM, GPU resources, native GUI, and open OS handles still need reconstruction. A 3 MB domain image could help, but 20 KB explicit domain state commonly travels more easily and survives code updates.
- **Who pays/value:** professional-tool users, **E $10/month**, 100 organizations × ten seats implies `R100 $120K`; unclear incremental value over sync.
- **Killer objection/expert reply:** “Your image is not my application or device environment.” Exact-version islands and poor state migration can make durable files more useful than a live image.
- **2-week proof/demo/tweet:** one headless domain model and two thin UIs, no general UI migration; compare JSON save/load across ten edits and an application version change. Demo identical next computation on the other UI. Draft: “The domain model moves; the UI is rebuilt. Here is the actual continuity boundary.”

### 14. Plan 9 travel kit: remount the world under a live job — MERGE infrastructure into #9

- **One sentence:** a moved program retains stable logical tool names while the destination supplies newly authorized implementations.
- **100× version:** programs navigate compatible resource namespaces across organizations with the same ease as opening another directory.
- **Pain/current practice:** RPC stubs, dependency injection, connector registries, private runners. **F:** Plan 9's namespaces compose remote/local resources [P1]. **E:** eliminating four adapter hours/month is $600 benefit; no evidence those hours require continuation transfer.
- **Why live state:** useful when a multi-stage job arrives with significant hidden progress and its next resource exists only there; tool rebinding alone works with stateless functions. **E:** 3 MB/240 ms plus admission against a 10 s rebuild may help, whereas an ordinary 20 KB task favors dispatch.
- **Who pays/value:** integration platforms, **E $250–$750/month**, `R100 $0.3–0.9M`; same integration business as #9/#3.
- **Killer objection/expert reply:** “You reinvented service discovery, and names conceal incompatible semantics.” Correct unless ABI, version, cancellation, size limits, and effect identity are explicit. A file handle or transaction cannot become valid merely by naming it again.
- **2-week proof/demo/tweet:** bind `readRows` to two synthetic local hosts, deliberately reject one incompatible adapter; compare JSON/RPC dispatch. Demo a job preserving progress while its resource binding changes. Draft: “Keep the continuation, rebind the tools; mismatched semantics must fail visibly.”

### 15. Erlang colony: supervised live workers replace failed siblings — KILL generalized self-healing

- **One sentence:** a supervisor resumes the latest known-good capsule on another worker after an environmental failure.
- **100× version:** applications become supervised colonies that redistribute and reproduce their useful state automatically.
- **Pain/current practice:** workflow retries, actor supervision, replicated queues, process/container restart. **F:** Erlang supervision limits repeated restarts and escalates persistent failures [E1]. **E:** replacing a 30 s rebuild with a 0.5 s full handoff matters to recovery latency, but saves only about $0.00059 marginal CPU per recovery.
- **Why live state:** progress survives inside opaque code; ordinary JSON state plus a queue often does the same. A corrupt heap or deterministic bug follows its clone. Snapshot-at-await cannot rescue a process killed before its last checkpoint.
- **Who pays/value:** platforms with real recovery objectives, **E $100/month**, `R100 $120K`; no evidence for a new resilience budget instead of incumbent workflows.
- **Killer objection/expert reply:** “Restart a clean worker; don't replicate the fault.” A stale owner can duplicate writes unless fenced externally. Supervision is a control plane, not a property of copying bytes.
- **2-week proof/demo/tweet:** local supervisor, ten workers sequentially exercised, 100 injected exits and stale-owner attempts; compare JSON checkpoints and cached replay. Demo recovery plus deliberate escalation of a repeated bug. Draft: “Move after a host failure; stop after the same bug repeats. Supervision still needs policy.”

### 16. TeaTime universes: fork a shared live world — KILL generic collaboration; potential domain application later

- **One sentence:** collaborators branch an active simulation or planning session, experiment independently, and compare outcomes.
- **100× version:** planning becomes a shared multiverse of executable scenarios rather than disconnected spreadsheets and presentations.
- **Pain/current practice:** versioned scenarios, deterministic simulation seeds, event-sourced models. **F:** Croquet already joins from snapshots plus ordered later events and supplies deterministic model time/randomness [CR1][CR2]. **E:** a 60 s scenario rebuild across 20 alternatives wastes 20 minutes; the qualifying live working set might be 3 MB, but is unmeasured.
- **Why live state:** arbitrary solver internals could be preserved without an exporter; domain-aware snapshots and event replay usually retain better inspectability. All collaborators still need ordered events or an explicit coordination model after the initial copy.
- **Who pays/value:** planning/simulation-tool vendors, **E $500/month**, `R100 $600K`, conditional on a real solver and recurring usage; not a generic world-sync business.
- **Killer objection/expert reply:** “Branches do not merge, and our solver already exports state.” Byte-level merging of two heaps has no business semantics; choose a scenario or merge explicit domain commands/results.
- **2-week proof/demo/tweet:** 20 branches of one small deterministic simulation; compare seeded rerun, explicit model snapshot, and live image, including divergence and convergence rules. Demo two worlds side-by-side. Draft: “Fork a live scenario; compare its future. Joining the worlds still requires domain rules.”

### 17. HPC miniature: checkpoint/restart on interruptible capacity — KILL broad compute proposition

- **One sentence:** move long-running generated JS jobs away from eviction, resource limits, or an unavailable machine while retaining completed local work.
- **100× version:** compute jobs flow across heterogeneous available hosts, surviving interruptions without workflow rewrites.
- **Pain/current practice:** checkpoint/restart libraries, batch schedulers, spot-aware systems, queue retries. **F:** SCR explicitly handles interrupted runs and checkpoint recovery [H1]. **E:** 100 lost 30 s prefixes/day total 50 CPU-minutes, about **$0.06/day** at the cited Worker marginal tariff; the real value would need to be deadline/recovery, not that bill.
- **Why live state:** a 3 MB resumable working set is attractive relative to a long prefix; large scientific datasets, GPU allocations, and external files do not fit this promise. Await-only programs also need deliberate cooperative boundaries during CPU work.
- **Who pays/value:** niche runtime operators, **E $100/month**, `R100 $120K`, only if a measured recovery objective supports it. No evidence of a broad addressable JS/HPC workload was found.
- **Killer objection/expert reply:** “An interpreter that is 5–31× slower can consume more resources than all the restarts it avoids.” Compare total execution and an optimized native/Wasm solver, not merely resume time.
- **2-week proof/demo/tweet:** three bounded CPU fixtures, explicit yields, forced preemptions, host V8 rerun/JSON checkpoints/cached replay versus capsules. Demo an honest survival case and a slowdown case. Draft: “Checkpointing survives preemption; total useful compute decides whether the move was worth it.”

## The cull

**I — Independent retained products/features:** #7, #9, and the narrow experiment mode of #1. #6 becomes part of #7; #3/#8/#14 become particular uses or infrastructure of #9; #11/#12 become artifact interfaces. These merges do not create additional buyers or multiply the market.

**I — Stop:** #2, #4, #5, #10, #13, #15, #16, #17 as standalone bets. Each either gets its value from a simpler incumbent mechanism, lacks a specific buyer pain, or has economics dominated by integration/runtime costs. A future customer trace could reopen a narrow case, but the analogy alone cannot.

**I — What survived the most ruthless test:** not “live state always beats JSON/replay,” but “an operator should sometimes save arbitrary generated state without understanding and rewriting its schema.” The value is likely reduced human reconstruction and integration work. Performance becomes the deciding reason only when cached local reconstruction is repeatedly expensive. None of the retained ideas has demonstrated an advantage over quickjs-wasi plus an equivalent artifact/broker integration.

## Ranked top three and their 1–2 week proofs

All three proofs use **TypeScript hosts, the existing exact-build QuickJS/Wasm artifact, and local workerd/Miniflare where available**. No deployment or paid model call is required. Use recorded, synthetic-origin tool responses and frozen generated-code fixtures; disclose their provenance. Do not handwrite only snapshot-friendly fixtures. Existing binaries/dependencies must fit the brief's disk budget; no toolchain build is prerequisite. A comparison harness is not a claim to have qualified the whole Temporal, Restate, or Golem service.

**I — Common controls:** code/module/import-ABI hashes, bounded input/raw memory/CPU/output, stable pending-call IDs, ledgered receipts, no credentials in guest state, and read-only/recorded tools by default. Same tool tape and outputs for all recovery baselines. Pin runtime versions. Count codec, I/O, cold module loading, durable writes, rebinding, and source termination in handoff time. Record both full checkpoint and tape sizes, interpreter overhead on original execution, p50/p95 with at least 30 repetitions per selected fixture, and a high-entropy/memory-high-water control. Run repeats sequentially to keep memory bounded.

**I — Ownership:** moving means one fenced live owner; forking means distinct branch identities with explicitly granted future rights. An approved write on the parent is not copied approval. Record an operation before dispatch; ambiguous external outcomes require sink deduplication or reconciliation. Only an elected, newly approved branch may call a synthetic committing sink. Clone entropy deliberately, distinguishing identical-input reproduction from independently sampled futures. These are restricted experiments borrowing the [home-broker contract](03-contract.md), not a production implementation of its full 15–20-day scope.

### Rank 1 — Runnable failure specimens (#7 + bounded #6)

**I — Why this leads:** a portable specimen has immediate use even without geographically moving a production job. The human can perform a controlled experiment at the failure boundary. Its potential economic benefit is engineering time, large enough to matter at small scale. The decisive risk is that complete record/replay already gives the same result with less operational burden.

**I/E — 10 working days:**

1. **Days 1–2:** freeze ten generated-JS fixtures with observable closure/aliasing/iterator/async-state failures and two ordinary explicit-state controls. Include an import rejection, a branch-order issue, a malformed tool result, and deterministic state corruption. Save before the relevant boundary; an OOM/trap may prevent postfailure capture. Produce a manifest containing exact code/build, checkpoint identity, tape cursor, pending request, and a plain-language status. Implement no arbitrary object inspector.
2. **Days 3–5:** local Node exporter/importer and workerd receiver. Permit exact recorded continuation and branch-specific next tool replies; reject future network/write requests in replay mode. Kill the source before restoration. Include malformed/truncated/wrong-build artifacts and a host-only resource deliberately missing on restore.
3. **Days 6–7:** implement the strongest inexpensive baselines: **complete code + deterministic import tape + cached replay**, and **expert-authored JSON checkpoint/state machine** for the same task. Add quickjs-wasi as a pinned drop-in engine comparator if already locally available within the budget; otherwise report its integration as untested. Compare a normal V8 rerun too. Give the baseline author the same repair budget, and count exporter authoring time separately from diagnosis time.
4. **Days 8–10:** counterbalance artifact order for at least three engineers if available; compare time to reproduce, identify the next wrong transition, and produce a verified regression. Without independent participants, label timing a builder-only result and withhold the human-time claim. Rerun corrected source from entry against the tape; continuing an old frame does not establish that new code is fixed.

**I — Pass:** all ten cases reproduce with exact guest/output hashes at recorded boundaries, zero network effects during replay, and at least 8/10 can be continued and experimentally differentiated on a separate executor. **E commercial gate:** independently observed median diagnosis workflow improves by at least **2×**, or saves **≥30 minutes per qualifying incident** against the strongest working baseline; two relevant platform teams must identify at least two such incidents/month before proposing a subscription. These are targets, not expected results. Snapshot capture must not add more than 10% to the qualifying original workload's elapsed time unless the buyer explicitly values the tradeoff.

**I — Kill:** cached replay is within 10% of diagnosis time with less integration; hidden guest state is rarely causal; an acceptable data export requires general-purpose heap redaction; or debugging the interpreter becomes the task. A specimen that merely contains a customer prompt is not a gain over a trace.

**I — Demo:** a 60 s continuous local recording: issue artifact→source absent→exact recorded failure→branch with alternative reply→different result→source-level regression rerun. **Draft tweet:** “This bug report includes a waiting JS program, its exact build, and recorded tools. Open it locally, reproduce the failure, try a different next reply. Cached replay and JSON baselines included.” **Killing expert reply:** “Your tape alone reconstructs this in 80 ms.” Publish that result if true; it ends the performance claim and probably this product unless the artifact workflow independently saves time.

### Rank 2 — Same-team save games for generated code (#9, with #8/#14)

**I — Why second:** concrete continuity is appealing, but shared sessions and durable workflows already solve much of it. The qualifying segment is generated code with hidden in-node state, not an entire coding-agent computer. Begin within one trusted team/runtime boundary, then test a private runner. Receiving code or a modified heap must never itself convey trusted authority.

**I/E — 10 working days:**

1. **Days 1–2:** freeze ten generated integration programs plus two trivial JSON controls. Use small fixtures such as paginated reconciliation, an incremental parser, and nested tool-call decisions. All nonrepeatable inputs are recorded. Log how many useful bytes actually live in the guest versus host files/tools/messages.
2. **Days 3–5:** pause at an approval or missing-resource boundary; export manifest/image/tape; terminate the original process; claim a continuation from a separate local Node process. Add local workerd as a destination for at least three supported cases. Share files locally; no real email or accounts. Destination grants new read-only adapters, never inherited credentials.
3. **Days 6–7:** compare **explicit JSON task/state dispatch**, **complete cached-import replay**, and **LangGraph-style checkpointed nodes with fine-grained tasks**. Give the latter its best restructuring within the fixed adapter budget. Use an actual locally available SDK where possible; label any semantic stand-in. For one private-data case compare remote tool invocation and query pushdown, since locality alone does not justify memory migration.
4. **Days 8–10:** 100 sequential resume cycles across the corpus; duplicate/stale claim attempts; expired/rejected approvals; missing host handles; wrong builds; and failure during file transfer. A minimal local durable ledger/synthetic sink exercises fencing, not arbitrary external exactly-once effects. Measure task correctness, completed imports repeated, recovery time, integration hours, bytes, and useful work to final draft.

**I — Pass:** 100/100 controlled cycles preserve the specified outputs and pending-call identity; zero completed import redispatches; stale sources cannot commit; every missing grant/build is rejected visibly. **E value gate:** on at least three independently supplied qualifying traces, a developer embeds the useful path in **≤1 day** and saves **≥4 engineering hours/month** or demonstrably enables a paid workflow blocked by the alternatives. For a timing claim require **≥2×** end-to-end resumption benefit against cached replay; for an ergonomics claim, measure a **≥50%** reduction in adapter effort with correct behavior. Report if only one gate passes.

**I — Kill:** messages+files are the useful state; replay restores in <100 ms while the capsule transfer takes seconds; the guest lacks essential browser/OS state; or the JSON adapter takes two hours once and survives upgrades better. A task that never needed to move does not demonstrate placement value.

**I — Demo:** a teammate opens a locally shared save file, sees status and required tools, receives a fresh read-only grant, and finishes a reconciliation draft after the source exits. Record output equivalence and full byte/time receipts. **Draft tweet:** “A teammate continued this agent-generated JS job from its pending tool call after I stopped the original executor. Exact runtime, fresh tool grants, no prefix replay. Here's the comparison with sharing JSON and a replay log.” **Killing expert reply:** “We share LangGraph checkpoints already; your generated node can just return its state.” Require a real nontrivial node/exporter case; otherwise integrate normal checkpoints.

### Rank 3 — Branch laboratory for opaque generated programs (#1)

**I — Why third:** controlled counterfactuals have value, but forks are established and interpreter overhead can erase a prefix-reuse gain. Retain only a laboratory for programs already requiring a sandbox/hidden continuation, with repeated expensive *local* prefixes. Do not build an autonomous swarm or a public compute exchange.

**E — The counterexample to keep visible:** suppose V8 needs a 2 s prefix, QuickJS takes 10× longer, and there are 100 branches. With 0.1 s restore/transfer and 0.1 s QuickJS suffixes, live forks cost approximately **20 + 100 × (0.1 + 0.1) = 40 s**. V8 reruns with 0.01 s suffixes cost **201 s**: about 5× aggregate-time improvement, not 100×. But if an explicit JSON checkpoint permits 0.01 s load and the same V8 suffix, its total is approximately **2 + 100 × (0.01 + 0.01) = 4 s**, ignoring a small exporter cost: about 10× better than live forks. All figures are illustrative and must be measured.

**I/E — 7–10 working days:**

1. **Days 1–2:** choose three real or frozen generated tasks with hidden local state and three simple controls. Include one compact partial search, one parser/reconciliation workspace, and one agent tool controller. Vary local prefix work from 20 ms to 30 s and compressed state from roughly 0.1 to 10 MB. Do not construct a useless CPU loop solely to win the benchmark.
2. **Days 3–4:** checkpoint once before a controlled next input; run 1/10/100 branches sequentially. Same-input branches must match uninterrupted references. Future alternatives receive distinct branch IDs, capped budgets, and explicit entropy handling. Choose a result; do not merge mutated heaps.
3. **Days 5–7:** compare **host-V8 cached-import replay**, **same-engine replay**, **expert JSON exporter + V8 continuation/state machine**, and **nearest graph checkpoint**. Golem's existing fork/snapshot contract is an incumbent semantic baseline [G2][G3]; use it if locally available within constraints, otherwise state that no performance comparison was run. A benchmark against bare entry rerun is insufficient.
4. **Days 8–10:** test that intended experimental alternatives actually diverge, evaluate on fixed held-out cases, then charge a synthetic committing sink only from the explicitly approved selected branch. Measure total CPU, peak memory, total bytes, capture/restore costs, original run overhead, branch startup, completion, and implementation effort. Serial aggregate-time improvement must not be presented as parallel wall-clock speedup.

**I — Pass:** all same-input branches match references; different policy experiments are causally distinct; forked budgets sum to no more than the original allocation; losing branches have zero real effects. **E value gate:** at least **5× aggregate experiment turnaround** against the strongest working cached-replay baseline on a useful qualifying task, or **≥1 engineer-day avoided per new generated-program family** with competitive completion time; neither may conceal a faster low-effort JSON solution. Recruit three runtime teams for trace qualification later, without assuming research outreach has occurred.

**I — Kill:** most branch time is new model calls; prefixes are cheap after caching; explicit exporters are easy; independent forks mostly repeat the same failure; or always-on QuickJS overhead costs more than reuse saves. At $0.06 marginal CPU saved per modeled batch, a proposed $500/month fee needs roughly 8,334 batches/month just to match CPU savings, before integration; latency/developer-time value must carry the sale.

**I — Demo:** one original preparation, ten displayed branch outcomes, counters proving that historical imports were not billed again in either replay or live modes, and a prominent JSON result. **Draft tweet:** “We forked the same prepared JS program into 100 tool-response experiments. The benchmark includes V8 cached replay, explicit JSON state, full transfer costs, and the cases where the heap loses.” **Killing expert reply:** “Your state is a cache; export it once and keep the JIT.” If that is cheap and correct, use the cache and retire the live-state performance pitch.

## The ONE bet

**I — Build the runnable failure specimen, as an embeddable feature for an existing generated-code runtime.** It exposes a useful action—continue this exact failed situation—without requiring a universal host marketplace, continuous background phones, buyers for tiny CPU savings, or organizations accepting visiting agents. Start with approved synthetic-origin cases inside a trusted team. Treat captured private data, exact-build retention, host-resource absence, and source-level fix verification as product constraints.

**E — Commercial test:** a **$250 scoped pilot**, then **$200–$500/month/application** only after recurrent independently observed incident savings. One hour saved at $150 does not justify $500/month; four hours saved gives $600 benefit, which leaves little buyer surplus at the high end. A 100-customer scenario is $0.24–0.6M annual subscriptions, plausible as a useful integration feature but no evidence for a large standalone company. A costly platform integration needs a larger buyer or should stop.

**I — The ambition retained:** support incidents become shareable experiments; successful specimens become regression cases; later the same artifact format supports safe team save games and branch experiments. This is a sequence of observable jobs to be done, not evidence that a universal “living software” economy will follow.

## Primary-source notes

All links below were accessed **2026-10-28**. Undated documentation is identified as such; source dates are not inferred from search crawl dates. Product documentation describes vendor contracts/capabilities, not independent production validation. Derived workload and market numbers in the report are estimates, not source findings.

- **B1:** Kikuchi et al., [“Electrochemical potential enables dormant spores to integrate environmental signals”][B1], *Science* 378, 43–49, **2022-10-07**, author manuscript. Inspiration for conditional awakening, not proof of a software scheduling market.
- **T1/T2:** [Dartmouth mobile-agent workshop presentation record][T1], **1996**, including James White's navigation session; Jim White, General Magic, [“A Common Agent Platform”][T2], **1996-03-11**. Primary workshop record and author proposal.
- **S1/S2:** [*Pharo 9 by Example*, §2.5][S1], PDF edition **2022-03-26**; [SBCL 2.6.9 manual, “Saving a Core Image”][S2], current manual, undated section. Their image contracts differ.
- **P1:** Pike et al., Bell Labs, [“The Use of Name Spaces in Plan 9”][P1], **1992** workshop paper, **1993-04** reprint. Hosted text includes subsequent system examples; the thesis used here is namespaces/resources.
- **E1:** Erlang/OTP [Supervision Principles][E1], historical OTP documentation, undated page. Supports restart limitation/escalation, not heap resurrection semantics.
- **W1:** Racket [Stateless Servlets][W1], current undated docs; describes transformations, continuation URLs, source compatibility, and restrictions.
- **CR0/CR1/CR2:** David P. Reed, [“Designing Croquet's TeaTime”][CR0], **2005-10**, DOI 10.1145/1094855.1094861; publisher access blocked during this search, with abstract/bibliography discoverable in search. Operational claims here rely on the accessible primary [Croquet snapshot tutorial][CR1], **2024 copyright**, and [Croquet FAQ][CR2], undated, rather than inferred details of the inaccessible paper.
- **H1/D1:** [SCR 3.1.0 concepts][H1], current undated versioned docs; [rr project][D1], current undated project page. Checkpoint/restart and replay are working precedents rather than new product opportunities by themselves.
- **L0:** LangChain [State of Agent Engineering][L0], page dated **2026-06-12**; vendor survey of **1,300+** professionals. Selection bias and adjacent subject matter prevent interpreting its percentages as demand for snapshots.
- **L1/L2:** LangGraph JavaScript [interrupts][L1] and [time travel/forks][L2], current undated docs. Node restart and graph checkpoint reuse are different from an opaque interpreter heap; they remain strong alternatives.
- **G1/G2/G3:** Golem v1.6 [durable execution][G1], [user-defined snapshotting][G2], and [forking agents][G3], current undated versioned docs. The previously referenced `/develop/durable-stream-forks` URL returned 404; the current navigation resolves to `/develop/forking`. Snapshot docs explicitly discuss replay cost and schema/custom save/load; no local Golem experiment was performed.
- **R1:** Restate [multi-agent orchestration][R1], current undated docs, including remote handoffs and journaled decisions/results.
- **Q1/V1:** Vercel Labs [quickjs-wasi README][Q1], current repository documentation; V8 [custom startup snapshots][V1], **2015-09-25**, historical explanation, not a complete statement of today's V8 API restrictions. No claim here relies on its old typed-array limitation still holding.
- **C1/C2/C3:** Cloudflare [Workers pricing][C1], updated **2026-10-02**; [R2 pricing][C2], **2026-10-26**; [DO WebSockets/hibernation][C3], **2026-09-30**. All dollar examples use marginal/gross list rates and disclose exclusions.
- **TE1/C4/N1/CT1:** Temporal [Workflow Execution/replay][TE1], current undated docs; Cloudflare [Rules of Workflows][C4], updated **2026-10-15**; Node [single-executable applications/startup snapshots][N1], current documentation served as **v26.12.1**; [CRIU project README][CT1], current undated project documentation. The CRIU wiki timed out; the project-owned repository supports the limited Linux/container checkpoint claim.

## Five-line TL;DR

1. **I:** Seventeen ambitious ideas reduce to three useful proof candidates: runnable failures, generated-code save games, and controlled fork experiments.
2. **F/I:** Telescript, images, continuations, supervision, and Croquet already contain the central metaphors; reliable authority and a paid user problem decide value.
3. **I:** Live state wins only when preserving hidden progress saves more than cached replay, explicit checkpoints, runtime slowdown, and transfer cost; historical LLM charges are not automatic savings.
4. **I/E:** Bet on executable incident specimens; test for ≥2× diagnosis improvement or ≥30 minutes saved per qualifying incident, then test a $250 pilot.
5. **I:** Reject the public warm-state market, executable-email business, universal spores, and free-compute swarm until a concrete workload defeats their simpler baselines.

**Verdict — GO-WITH-CHANGES for the wildcard angle:** pursue the narrow artifact/debugging feature. **NO-GO for a universal economy of roaming live programs on this evidence.** No retained candidate has yet beaten the strongest baseline on a customer trace.

**The three next steps:**

1. **I:** Obtain two relevant incident traces and establish whether hidden guest state actually causes costly reconstruction; source consent and sanitization must precede specimen export. No outreach was performed or authorized by this report.
2. **I/E:** Run the 10-day failure-specimen comparison against complete cached replay, expert JSON state, and an existing snapshot engine; publish failures and full workflow timings as well as the attractive restore number.
3. **I:** Keep #9/#1 only if the same real traces justify them; otherwise deliver the useful replay/checkpoint adapter and stop the standalone live-program product claim.

[B1]: https://pmc.ncbi.nlm.nih.gov/articles/PMC10593254/
[T1]: https://www.cs.dartmouth.edu/dfk/research/project/dagents/workshop/1996/summaries.html
[T2]: https://www.w3.org/OOP/9606_Workshop/submissions/36-w3c-paper.htm
[S1]: https://books.pharo.org/pharo-by-example9/pdf/2022-03-26-index.pdf
[S2]: https://www.sbcl.org/manual/index.html#Saving-a-Core-Image
[P1]: https://9p.io/sys/doc/names.html
[E1]: https://erlang.org/documentation/doc-4.9.1/doc/design_principles/sup_princ.html
[W1]: https://docs.racket-lang.org/web-server/stateless.html
[CR0]: https://doi.org/10.1145/1094855.1094861
[CR1]: https://croquet.io/croquet/croquet/tutorial-2_7_snapshots.html
[CR2]: https://croquet.io/faq/
[H1]: https://scr.readthedocs.io/en/latest/users/overview.html
[D1]: https://rr-project.org/
[L0]: https://www.langchain.com/state-of-agent-engineering
[L1]: https://docs.langchain.com/oss/javascript/langgraph/interrupts
[L2]: https://docs.langchain.com/oss/javascript/langgraph/use-time-travel
[G1]: https://learn.golem.cloud/v1.6/concepts/durable-execution
[G2]: https://learn.golem.cloud/v1.6/develop/snapshotting
[G3]: https://learn.golem.cloud/v1.6/develop/forking
[R1]: https://docs.restate.dev/ai/patterns/multi-agent
[Q1]: https://github.com/vercel-labs/quickjs-wasi
[V1]: https://v8.dev/blog/custom-startup-snapshots
[C1]: https://developers.cloudflare.com/workers/platform/pricing/
[C2]: https://developers.cloudflare.com/r2/pricing/
[C3]: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
[TE1]: https://docs.temporal.io/workflow-execution
[C4]: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
[N1]: https://nodejs.org/api/single-executable-applications.html
[CT1]: https://github.com/checkpoint-restore/criu
