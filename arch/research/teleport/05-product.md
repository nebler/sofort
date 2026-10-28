# Teleporting programs: value, buyer, and an honest demo

Research date: **2026-10-28**. Scope: product research and a proposed recording, not an implementation or launch. **F** = sourced fact, including explicitly attributed earlier local measurements; **M** = measured in this research; **I** = inference/recommendation; **E** = estimate, scenario, price hypothesis, or proposed acceptance target. No new runtime benchmarks or customer interviews were performed; there are no new **M** performance claims. All external sources below were checked on **2026-10-28**; publication/update dates are stated where available. Prices are USD, excluding taxes.

## The answer to “but what is the value?”

**I — The credible value is: keep a generated tool program intact when its next step belongs somewhere else.** An agent-platform engineer can let an ordinary async function wait for approval, then continue in a browser or private runner with its closures and intermediate state preserved. They avoid writing a recovery schema for each generated program, replaying its computational prefix, or rebuilding its execution environment at every handoff. The buyer pays for fewer integration/recovery bugs and access to otherwise inaccessible data. Cheap sleeping alone is insufficient differentiation.

**I — Strongest initial product:** an embeddable runtime for agent-platform teams, with checkpoint/restore, pending-call identities, bounded resources, host-adapter conformance, and a small approval/effect broker. **Second, conditional product:** the same runtime plus a browser/private-runner adapter that takes a multi-stage job to local data. Do not start with a marketplace for idle computers, a consumer continuity platform, or a replacement for workflow engines.

**I — The uncomfortable answer:** most examples do not require moving a live program. JSON plus a queue, a workflow, an RPC to a device, or starting a function beside the data often wins. A closure and cyclic object establish the mechanism; they do not establish a customer benefit. If the job can be represented as `{step, inputs, result}`, use that baseline and expect teleportation to lose on simplicity.

**F — The prior reports already establish the visual hook and its limits.** [V8 demo](../v8/05-demo.md) recommends prepared browser→server handoff and a file teaser; [V8 signal](../v8/06-signal.md) prioritizes inspectable evidence over reach and warns about unsupported “full agent” claims. This report changes the product story: **server→device, because the next work requires local data**, rather than repeating “close a laptop, remote job continues.” It retains their source-destruction proof, readable counters, exact runtime identity, and continuous handoff recording. This project remains separate from jitk/GrowOS.

## What incumbents already remove from the pitch

**F — Waiting is not inherently billed execution.** Cloudflare Workflows charges CPU while executing, not while idle, sleeping, or awaiting an API. Its September 21 pricing page also lists request, step, and storage charges; “no CPU while sleeping” does not mean free total operation. Durable Object WebSocket hibernation stops duration billing, but resets in-memory state and reruns the constructor. [Workflows pricing, updated September 21, 2026](https://developers.cloudflare.com/workflows/reference/pricing/); [DO WebSockets, updated September 30, 2026](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

**F — Temporal and Vercel already sell durable async code.** Temporal reconstructs workflow state on workers by replay; its Cloud bill meters Actions and storage, not a dedicated sleeping process for every workflow. Actions start at $50/million, with plan/storage charges additional. Vercel documents deterministic recovery, waits, and managed persistence; its current pricing/limits page explicitly documents optional QuickJS snapshots, enabled with `WORKFLOW_VM=quickjs`, defaulting to a 1,000-event snapshot interval. This is a direct competing capability, beyond the experimental-merge evidence in yesterday's landscape. [Temporal Actions](https://docs.temporal.io/evaluate/cloud/actions); [Temporal pricing source, current main](https://github.com/temporalio/documentation/blob/main/docs/evaluate/cloud/pricing.mdx); [Vercel overview](https://vercel.com/docs/workflows); [Vercel snapshot settings](https://vercel.com/docs/workflows/pricing).

**F — Generated-code approval does not automatically require heap persistence either.** Cloudflare Code Mode documents abort-and-replay approvals: applied connector calls return recorded results on the next pass. It requires matching call order/arguments, provides `codemode.step()` for nondeterministic work, and warns about concurrent-call ordering. **I:** a capsule can avoid replaying guest computation after a saved boundary; it still needs host-call recording and effect control. Compare correctness and integration effort against this existing implementation, not against a hand-built broken loop. [How Code Mode works, current docs](https://developers.cloudflare.com/agents/tools/codemode/how-it-works/).

**F — The memory trick is available elsewhere.** Vercel's `quickjs-wasi` documents full-VM snapshots, pending promises, browser usage, and rebinding named host callbacks. LangChain's `quickjs-rs` documents whole-heap images preserving closures/aliases and exact-build validation. XS Sandbox documents Node/browser operation and moving a heap snapshot to another machine. Golem documents suspension without resident compute/memory, journal recovery, and agent forks. [quickjs-wasi, current README](https://github.com/vercel-labs/quickjs-wasi); [quickjs-rs, current README](https://github.com/langchain-ai/quickjs-rs); [XS Sandbox, current README](https://github.com/coder-mike/xs-sandbox/blob/main/readme.md); [Golem v1.6 lifecycle](https://learn.golem.cloud/v1.6/concepts/agent-lifecycle); [Golem explanation, October 2026](https://golem.cloud/blog/whats-this-golem-cloud-thing-about/).

**I — Positioning consequence:** “your generated program can carry on across supported hosts, with explicit tool authority” is a possible product. “Durability without rewriting every function into a state machine” describes benefits incumbents also provide. Even browser/server snapshot transport is insufficient by itself; the completed integration must beat importing an existing library.

## Nine concrete uses, with a skeptical value assessment

**I/E — These are buyer hypotheses, not evidence that named companies have these problems or will buy.** Engineering value below uses an assumed loaded engineering rate of **$150/hour**. Dollar values are gross potential benefit before adoption/support costs. Generic alternatives refer to the sourced behavior above and [yesterday's broader comparison](../v8/02-landscape.md), which also covers Restate, DBOS, VM snapshots, and local-first systems.

### 1. Generated integration code waits three days for approval

**I — Pain/owner:** the runtime lead at a support, operations, or integration-agent SaaS. A generated function reads several systems, builds a reconciliation draft, holds helper closures, and pauses before proposing a write. The human returns after the execution host has disappeared.

**I — Today:** Temporal, Cloudflare Workflows/Code Mode, Vercel Workflow, Restate, Golem, or a Postgres job row plus JSON. These already avoid holding a server during the wait. Handwritten workflows can retain linear code through replay; the claim is not that every alternative forces manual state machines.

**I — Where a live image helps:** arbitrary generated lexical state need not become an application recovery schema; the captured computational prefix need not rerun. A later approval can choose a supported host. **Where it does not:** a short loop over JSON tool results is cheaply replayable; Vercel and Golem already cover much of this. Pure same-host sleeping does not need portability. Old runtime builds, expired credentials, stale reads, and ownership remain operational work.

**E — Value:** saving **4–8 engineering hours/month** of bespoke recovery/approval maintenance is **$600–$1,200/month**, if observed. Avoided CPU is usually much smaller. **I — Rank: strongest near-term integration wedge; weak standalone novelty.** Demand traces showing replay/schema trouble before selling it.

### 2. A long-running agent hands CPU work to the user's laptop

**I — Pain/owner:** a desktop/browser agent vendor paying for per-user transforms, previews, or incremental calculations. A job is already in progress remotely; the user opens an eligible device and elects to continue there.

**I — Today:** run JS/Wasm locally from the start, send a task description to a local worker, use a native helper, or keep the cloud workflow with JSON checkpoints. If inference is remote, those alternatives keep calling the same model API.

**I — Where a live image helps:** preserving expensive intermediate indexes and a complicated generated continuation across a host change. **Where it does not:** CPU-heavy QuickJS is slower than host V8 in earlier tests; mobile availability, battery, and fallback add work. The vendor may save money by externalizing costs to the user, without saving total energy. An RPC to a local transform may be simpler than moving the orchestrator.

**E — Value:** **one million jobs × one cloud CPU-second** avoids only **$20 in marginal Workers CPU** at $0.02/million CPU-ms, before additional checkpoint traffic. Large per-user reserved containers could change the bill, but compare sleeping containers and local-from-start execution. **I — Rank: reject as a general cost product; retain as an opt-in placement feature.** [Workers tariff, current docs](https://developers.cloudflare.com/workers/platform/pricing/).

### 3. A game or interactive app follows laptop→phone

**I — Pain/owner:** a small simulation, puzzle, or creative-tool developer whose user wants to continue an exact session on another device, including a pending interaction and hidden simulation logic.

**I — Today:** explicit save games/JSON, a server-authoritative session, CRDT document state, or remote streaming. Those are often better because their formats survive software updates and express what the product should retain.

**I — Where a live image helps:** small pure-JS simulation state with transient closures and no external handles can resume without writing a save schema. **Where it does not:** DOM, GPU textures, audio devices, sockets, OS handles, and native engine state are outside this capsule. The destination must rebuild UI and services; a phone needs its own qualified runtime. Competitive games cannot trust a client-provided heap as authoritative.

**E — Value:** avoiding **1–3 weeks** of custom session-save work could be **$6K–$18K once**, assuming 40-hour weeks. That value disappears if save/version conversion is already needed for the app's long-term storage. **I — Rank: attractive visual, uncertain SDK budget; no generic consumer subscription thesis.**

### 4. An analysis job moves to a private dataset

**I — Pain/owner:** a developer building reconciliation, log analysis, or document agents for customers whose files live in a browser-selected directory or private network. The first half of a generated job uses remote tools; the second needs data the cloud cannot or should not receive in bulk.

**I — Today:** SQL/query pushdown, a customer-installed worker, browser-side Wasm/DuckDB, an RPC to a local tool, or a workflow that dispatches a JSON plan. These solve data locality without live migration and are mandatory baselines.

**I — Where a live image helps:** a multi-stage program can arrive with its computed plan and intermediate state, bind a newly approved local reader, and finish there. **Where it does not:** a standalone query can just start there. The capsule must not contain the supposedly unexported bulk data. After reading private data, sending its raw heap back can leak retained or freed payloads; finish locally or export an explicitly selected result, not an allegedly sanitized heap.

**E — Value:** avoiding a **2 GB** upload over **20 Mbit/s** removes a **13 min 20 s payload-only floor**. Shipping an assumed **3 MB** checkpoint instead takes **1.2 s** at that rate, plus module/setup and local scan time. An assumed $0.05/GB charge would save only $0.10/job; avoided upload friction/private-network integration is the stronger benefit. **I — Rank: strongest actual relocation rationale, conditional on beating local task dispatch.**

### 5. Fork an agent to explore 100 options

**I — Pain/owner:** an agent evaluation/search platform with expensive shared preprocessing followed by independent candidate evaluation: routes, patches, data-cleaning plans, or tool strategies.

**I — Today:** `Promise.all`, task queues, common prompt/result caching, JSON state cloning, Golem forks, or sandbox/VM forks. A model can propose 100 candidates without cloning a JS heap.

**I — Where a live image helps:** reuse a real expensive prefix containing nontrivial hidden state, then supply distinct candidate replies. **Where it does not:** branches with the same inputs/random state are initially identical; the runtime does not create different model thoughts. Subsequent inference/tool calls still cost money. There is no portable Wasm copy-on-write promise, and speculative writes must be denied or isolated before the winner is selected.

**E — Value:** if shared prefix cost is **P=$0.10** and each suffix costs **S=$0.02**, independent recomputation costs **$12**, while one prefix plus 100 suffixes costs **$2.10 + fork overhead**. If ordinary cached/JSON state also shares P, incremental capsule savings approach zero. **I — Rank: useful secondary primitive after measuring prefix cost; not 100× inference savings.**

### 6. Ship a failing agent's exact parked state to a debugger

**I — Pain/owner:** an agent SaaS's on-call/runtime engineer. A customer reports a failure after a long tool sequence; recreating the same intermediate graph and input order is difficult.

**I — Today:** traces, saved inputs, Temporal replay, recorded tool journals, Golem revert/fork, or a conventional crash/core dump. Application state plus a deterministic fixture often reproduces the fault well enough.

**I — Where a live image helps:** open a pinned-runtime capsule at the boundary immediately before the fault, inspect its retained state, give it a recorded reply, and branch a hypothetical reply offline. **Where it does not:** external services have changed; without recorded inputs the future is not exact. This is a tool-boundary incident artifact, not reverse single-stepping. Images may contain customer data, deleted bytes, or secrets; automatic “redaction” is not safe without a defined representation.

**E — Value:** one saved **2–4-hour incident/month** is **$300–$600/month/team**. That supports an add-on if engineers actually use it; it does not establish a new observability budget. **I — Rank: credible runtime feature, weaker first product than approval integration.**

### 7. Offline-first field work continues on another device

**I — Pain/owner:** a field-inspection or creative-workflow vendor. A partially completed generated calculation continues without network, then the user opens it on another device.

**I — Today:** IndexedDB/SQLite with explicit operations, CRDTs/local-first sync, durable outboxes, and JSON checkpoints. **F:** local-first research directly addresses offline use, ownership, and multi-device collaboration; CRDTs concern replicated data convergence. [Ink & Switch, April 2019](https://www.inkandswitch.com/essay/local-first/).

**I — Where a live image helps:** preserve one interrupted local calculation or wizard, with explicit single-owner handoff. **Where it does not:** two offline devices can both continue. Copying heaps provides neither merge semantics nor conflict resolution. The application still needs data versioning, outbox/idempotency, and a merge or ownership policy. “Logic runs locally and syncs” is largely a data-model problem.

**E — Value:** **2–5 hours** saved restoring a user's unfinished work or implementing transient calculation checkpoints is **$300–$750 per incident/integration**, under the assumed rate. Recurrence is unknown. **I — Rank: supplement CRDTs, do not replace them; weak independent buyer.**

### 8. Move work off an overloaded/preempted CPU worker

**I — Pain/owner:** a batch/agent platform using short-lived or spot workers with variable queues. A long multi-stage JS job reaches an I/O boundary before the current worker drains.

**I — Today:** queue retry, Temporal/Restate/Golem recovery, explicit chunk checkpoints, stateless autoscaling, or process/VM checkpointing. Stateless work can be scheduled onto spare capacity without ever migrating a continuation.

**I — Where a live image helps:** retain a useful costly prefix during planned drain and resume in an already-available compatible host. **Where it does not:** no checkpoint point means no move during a CPU loop; sudden failure loses work since the last persisted checkpoint. A scheduler, compatibility fleet, transfer cost model, and capacity reservations are additional products. Owned idle capacity has opportunity cost even when its marginal bill is zero.

**E — Value:** an assumed **10,000 CPU-hours/month** pool priced at **$0.05/hour** spends **$500**; a 30% placement advantage is only **$150/month gross** before slower execution, transfers, and operations. These rates are illustrative, not a provider quote. **I — Rank: infrastructure feature for existing scale, poor solo-business wedge.**

### 9. A job crosses into a customer-controlled runner after authorization

**I — Pain/owner:** an enterprise automation vendor. A centrally planned task needs a customer's private API or internal tool, with credentials that must remain in that customer's runner.

**I — Today:** customer-hosted Temporal workers, Golem/self-hosted workflow services, an outbound connector agent, remote tool RPC, or JSON job dispatch. Often moving only the next request is the correct answer.

**I — Where a live image helps:** retain a complex generated continuation while replacing its available tools; the destination admits only a declared capability set. **Where it does not:** a heap is not authorization. A hostile client can alter one; imported request fields cannot grant themselves credentials. Cross-host trust, tenant attribution, approvals, audit, and outbound-result policy must be enforced outside the guest. Wasm cannot conceal the program's data from the machine executing it.

**E — Value:** eliminating a genuinely separate **40–80-hour** integration is **$6K–$12K once**, but building the secure runner can cost more. **I — Rank: possible expansion of #4, not a separate initial enterprise platform.** Do not assume a security/procurement buyer wants downloadable live memory.

## Who pays, and how much?

### Bet A: agent-platform runtime integration

**I — Buyer:** the head of engineering/runtime lead at a small agent-product company, not an individual user waiting for approval. Qualify teams running generated multi-tool programs with multiple approval boundaries and actual replay/recovery bugs. Deliver an open embeddable core plus supported browser/Node adapters, pinned-artifact retention, an effect/approval integration, and runnable failure cases. The commercial unit is the supported production application/workspace, with active compute, retained bytes, and tool/model charges visible separately.

**E — Price test:** **$500 for a scoped integration pilot**, then **$250–$500/month per production application**, with an explicitly agreed usage envelope and support scope. This is a willingness-to-pay experiment, not a market price. At $150/hour, the monthly fee needs about **1.7–3.3 hours saved** just to break even; target **4–8 hours** for buyer surplus. A 40-hour migration costs $6K and takes **10 months to recover at $600/month gross benefit**, even before subscription charges. An engineer should be able to embed the first useful path in **one day or less** for this small-team pricing to make sense.

**I — Why pay instead of using quickjs-wasi?** Only for an integration they can verify but do not want to own: correct pending effects, host placement/authority, old-build recovery, cancellation, byte/memory budgets, and support. If the deliverable is only `snapshot()`/`restore()`, the open alternatives are compelling and willingness to pay should be assumed near zero. Large runtime vendors are potential collaborators or competitors, not validated customers.

### Bet B: bring a multi-stage job to local/private data

**I — Buyer:** an integration/analytics-agent vendor already losing adoption because uploads are slow, data is unreachable, or a customer needs a private runner. Start with one read-only reconciliation pipeline and one destination adapter. Sell a working supported integration, not a claim of universal privacy.

**E — Price test:** **$2K fixed pilot** for a bounded connector/adapter, then **$500–$1,500/month per vendor workspace** if it eliminates recurring integration/support effort or enables contracted use. A scenario with **10 hours/month saved × $150 = $1,500** supports only the lower end comfortably. Higher pricing requires evidenced revenue/access value or additional savings; the ten-hour scenario does not justify it. No percentage-of-compute-savings billing: most CPU savings are too small and attribution too ambiguous.

**I — Hard gate:** compare the same customer flow against **dispatch a JSON task to a local Wasm worker** and **invoke a browser-owned tool remotely**. If either has similar latency, lower integration cost, and adequate durability, ship that simpler design. The product might become a local tool adapter with optional capsule state; that is an acceptable finding.

**I — Business confidence:** moderate that there is a useful feature, low that there is an independent company here. There are no buyer conversations, budgets, paid pilots, or retention evidence in this research. The defensible asset would be working integrations and trustworthy lifecycle semantics, not the interpreter or a small checkpoint file.

## Does compute distribution hold up?

**I — Separate what moves from what remains expensive.** The capsule contains guest JS state and its continuation. It does not contain model weights, GPU/HBM allocations, provider KV caches, private datasets outside the guest, or an existing OS/browser session. Moving the JS program next to an available GPU does not reserve that GPU; a host-side model router can often choose the same endpoint without moving the program. Earlier [systems](../moonshots2/05-systems.md) and [compute](../moonshots2/01-compute.md) reports make this distinction; this product should inherit it.

| Bottleneck | I: what relocation can improve | I: what it cannot claim |
| --- | --- | --- |
| CPU orchestration | Release resident state during waits; place resumable work on available CPU hosts | Free LLM inference, or meaningful savings without an actual CPU/residency bill |
| GPU/HBM inference | Possibly coordinate a call to a local model through a host tool | Export provider KV state or turn a phone CPU into accelerator capacity |
| Data access/network | Run bounded processing beside a large/private source; reduce remote round-trips | Outperform query pushdown automatically; avoid transferring datasets already embedded in the heap |
| Device capacity | Use a consenting foreground device; fall back at saved boundaries | Reliable background browser capacity, zero battery cost, host confidentiality, or verified honest results |
| Region/carbon | Allow placement when deadlines, tool locality, and policy permit | Lower energy/emissions without power, transfer, runtime, and displaced-capacity measurements |

**F — Constraints already measured elsewhere in this repo:** the [October 27 roadblocks report](../v8/03-roadblocks.md) found **5.2–11.5×** slower execution versus host V8 on two warmed data-processing/validation fixtures, and **31.1×** on a million-step integer recurrence. It also found **1.50 MB gzip** for one Zod workload, **2.88 MB** for a synthetic 5,000-record workload, and **6.39 MB** for a retained six-MiB binary buffer. Freeing that buffer did not materially reduce compressed snapshot size. These are attributed local experiments, not measurements of customer agents or of this research. High-water memory and deleted payload retention undermine the universal 100 KB story.

**E — The CPU ceiling:** at the cited marginal Workers tariff, one million one-second CPU jobs = **1 billion CPU-ms = $20**. Even **100 million × 100 ms** is **$200**. These exclude included allowances and request charges, so represent gross CPU avoidance, not invoice savings. Moving the same interpreted workload may avoid its cloud CPU charge; moving a formerly JITed workload also incurs the interpreter's performance difference. Measure useful jobs, battery/energy, and fallback overhead, not just relocated instructions.

**F/E — Parking is cheap storage but not magical economics:** R2 Standard lists **$0.015/GB-month**, **$4.50/million writes**, and **$0.36/million reads**, with free Internet egress. **100,000 × 3 MB = 300 GB**, about **$4.50/month gross storage**, and a million park/read pairs are about **$4.86 gross operations**, before allowances/rounding and before any runtime, journal, broker, or retention cost. JSON may be much smaller; an existing workflow also externalizes dormant state. [R2 pricing, updated October 26, 2026](https://developers.cloudflare.com/r2/pricing/).

**F/I — Browser capacity is interruptible:** Chrome documents freezing/discarding hidden pages and warns that termination events are unreliable, particularly on mobile. Therefore use foreground opt-in device execution, persisted safe points, and a fallback policy. There is no reliable “phone quietly works for days” claim. [Chrome Page Lifecycle, current documentation](https://developer.chrome.com/docs/web-platform/page-lifecycle-api).

**I — Distribution verdict:** **yes for data/authority locality and planned movement to known capacity; no evidence for a scarcity-relieving global compute network.** Independent untrusted devices add result verification, secrets exposure, consent, scheduling, and availability problems. Start with devices the customer controls. Describe avoided bytes, accessible tools, and retained work; do not claim accelerator relief or greener computation from a JS handoff alone.

## The demo: “The job comes to your data” — 65 seconds

**I — Proposed concept, not an existing capability.** Show a reconciliation job planned on a separate Node machine, parked before access to a locally selected CSV, then restored inside the user's browser to finish against that file. The user sees a useful draft result while the source executor is gone. This combines the strongest relocation rationale with the previous report's continuity proof. The surprise is **a waiting program arrives on the laptop**, rather than a browser displaying a remote result.

**I — Recording topology:** use two physical machines on a local network, with the Node host labelled **`Node · cloud role · LAN prototype`** and the receiver **`Executes in this browser Worker`**. No hosted-edge/cloud deployment is implied. Prepare a fixed program and synthetic files, clearly labelled. There is no paid model call, no marketplace, no arbitrary uploaded code service, and no real business write. The returned artifact is a local draft/download.

| Time | I: action/caption | I: evidence |
| --- | --- | --- |
| 00–04 | Two panes: `This job needs a file on your laptop.` Pending local-file tool; destination says `No file uploaded`. | Name the user problem before the engine. Persistent `Synthetic reconciliation · QuickJS/Wasm prototype`. |
| 04–12 | On source machine, run the fixed reconciliation program with a presenter-entered nonce. It computes a compact matching plan and parks at a local-data call. | Closure/Map retain the plan; entry count is 1. Highlight a known tool boundary, not a pretend instruction pointer. |
| 12–21 | Click `Continue on my laptop`. Transfer real checkpoint; show actual state bytes plus separate cached module status. | Destination validates exact module/ABI and stores a checkpoint matching the source hash. Source is frozen. Show actual full handoff elapsed time. |
| 21–28 | Source termination/ownership transfer completes; remove its execution permission. | Source guest alive = 0 before destination receives the tool reply; destination entry evaluations = 0. Prepared handoff, not sudden-failure recovery. |
| 28–37 | User grants the browser reader a specific synthetic local file. | Browser host retains its File handle; handles are not claimed to travel in the capsule. Bind fresh read-only capability. |
| 37–51 | Restored guest receives bounded row windows and finishes the reconciliation locally. Optionally disconnect external networking once transfer is complete, if rehearsed. | Actual output events, preserved nonce/closure/cycle checks, local execution-host badge. Scan only enough data to fit the demonstrated resource limits. |
| 51–59 | Result: unmatched-invoice draft plus receipt: `Original stopped; resumed here; file upload bytes: 0`. | Byte counter covers the reader's entire outbound path, including tool traffic; fixture contains no remote model calls. Result derived from real scanned rows. |
| 59–65 | `Move the program to the data.` Expandable proof/limitations link. | `Prepared tool-boundary handoff · local CPU only · exact runtime build`. No dollar/energy savings badge. |

**I — What makes it honest:** stream file windows through the host instead of retaining the whole file in the guest; bound guest work, raw image, and host queues. Keep results local so a second snapshot does not export private row remnants. Show transmitted bytes and total completion time, without inventing a cloud baseline. “File upload bytes: 0” is narrow: the program and checkpoint did cross the network, and any explicitly exported result would also count separately. The dataset is synthetic; this demonstration is not a privacy certification.

**F → I — Build delta from the earlier demo:** existing evidence covers Wasmtime-origin restore into Node, Chromium and local workerd, two numeric replies, and controlled replay. The archived bridge accepts integer replies; a real CSV/window result needs a bounded structured/binary reply adapter. Source Node capture, local-file capability binding, browser-owned execution, effect/ownership handoff, and the new receipt need qualification. Reuse the envelope/ledger proof plan in [05-demo](../v8/05-demo.md); do not mark these new directions “already working.” [Original evidence](../portability/02-wasm.md).

**E — Effort/gates:** approximately **5–8 engineer-days** for this thin harness and recording, conditional on the existing reactor working; not a production service estimate. Day one must prove **new source-host checkpoint → destination browser Worker → structured local read → correct result without entry replay**. Then qualify source stop, wrong-build rejection, bounded data, duplicate reply, and a clean transfer failure. Use an independent source termination signal; a browser `terminate()` call alone is not an acknowledged teardown protocol.

**I — Acceptance:** an unfamiliar engineer can run it locally; source is stopped before delivery; checkpoint identity/build match; expected draft changes when the input file changes; original entry is not reevaluated; no original tool is redispatched; full handoff metrics and module bytes are available. Record ten rehearsals, failures included in notes, and one continuous 1× handoff. If local data adapters fail, use the prior report's **30-second file→fresh-browser restore** teaser and explicitly withhold the local-data/product claim. A numeric `42` demo can prove a primitive; it cannot prove reconciliation value.

**I — Compute-distribution angle in the film:** the destination performs the next stage on the user's opted-in CPU and no source guest remains active. That demonstrates placement. It does not demonstrate automatic discovery of free capacity, lower total energy, mobile background availability, or cheaper inference. A scheduler/capacity counter belongs in a later video only after it makes and records real placement decisions.

## Twitter/X: hooks and the replies that could sink them

**I — Build on the prior signal report:** keep its runnable artifact, clear claims, prior-art links, and expert-proof receipt. Do not repeat engagement counts or combine this with the kernel story. The call to action is for a runtime team with a real approval/local-data problem to try the artifact. These are draft posts, not sent messages. Drafts 1 and 2 require the corresponding new demonstration to pass; draft 3 matches the existing spike more closely.

**I — Hook 1: user value / recommended after the new demo**

> This job needed a file on my laptop. So I moved its waiting JS program into my browser, stopped the source, and finished locally. No file upload. QuickJS/Wasm prototype; handoff at a tool call. Demo + reproducible receipt below.

**I — Hook 2: the payer's problem**

> Generated agent code can wait days for approval. Saving its transcript isn't saving its closures. This prototype resumes the parked program on another host, without rerunning its prefix. QuickJS/Wasm, at tool boundaries. Compare it with workflows below.

**I — Hook 3: inspectable existing mechanism**

> A file containing a waiting JavaScript program: restore it in Node or a browser, change the tool reply, get a different future. QuickJS in Wasm; exact runtime build required. Useful for approvals? Maybe. Source, prior art, and limits below.

**I — The replies below are hypothetical expert objections, not quotations, predictions, or endorsements by named people.** Names identify relevant technical audiences already examined in [06-signal](../v8/06-signal.md).

| Hypothetical expert reply | Why it could kill the claim | I: pre-empt with evidence or concede |
| --- | --- | --- |
| Vercel/XS/LangChain runtime maintainer: “Our library already snapshots promises and works in browsers.” | Correctly removes mechanism novelty. | Name/link all three in the first technical reply. Publish the adapter/authority integration and baseline; if it adds nothing, call this an experiment built in an occupied space. |
| Cloudflare/Temporal/Golem engineer: “We already wait without keeping a process alive.” | Destroys the cheap-sleep headline. | Say the value is retained generated state and host placement. Show a concrete prefix/recovery problem; acknowledge workflow sleep/replay and existing snapshot modes. |
| Code-mode reviewer such as Armin Ronacher: “Why not replay or save JSON?” | Removes the need for a new runtime in many real workloads. | Publish the same task using JSON and replay, including programmer effort, guest CPU, checkpoint bytes, and correctness. Concede when the simple state model wins. |
| Local-first/data engineer: “Run a function near the file. Why ship a heap?” | Query pushdown and local task dispatch may capture all the benefit. | Demonstrate a meaningful pre-existing multi-stage continuation; compare an RPC and JSON task worker. Zero upload proves locality, not the necessity of migration. |
| Inference engineer: “You moved glue, not weights or KV. This doesn't solve GPU scarcity.” | Correct; destroys a broad compute-scarcity claim. | State which CPU work moved and where inference remains. Report model calls/cost separately; use no accelerator-savings hook. |
| Distributed-systems engineer: “Both owners can resume, or a payment succeeds before the snapshot.” | Heap persistence cannot grant exactly-once external effects. | Publish ownership/fencing and effect-before-ack failure cases. For the film, label supervised handoff and read-only tools. Reject stale/duplicate replies and unauthorized branch effects. |
| Security/agent reviewer such as Simon Willison: “I can edit the image. Where are the credentials, stale bytes, and resource limits?” | A digest is identity, not authenticity or authorization; importing arbitrary state is risky. | Fixed builds, bounded restore, independent broker checks, no guest credentials, fresh grants, and explicitly trusted fixture inputs. Admit no host confidentiality and no general redaction promise. |
| Browser/FinOps engineer: “The phone sleeps; CPU is cheap; QuickJS is slower. Who benefits?” | Destroys free-device-compute economics and always-on availability. | Foreground opt-in, explicit fallback and actual useful-job accounting. Sell local data access/engineering savings; no battery, green, or free-inference claim. |

**I — A technical reply that strengthens trust:** show one failed wrong-build restore, a rejected duplicate approval, and why exporting a post-scan heap can export private data. These demonstrate ownership of the limitations. The response to a correct objection is a narrowed claim or improved experiment, not an argument that an incumbent “doesn't really count.”

## 5-line TL;DR

1. **I:** The best value is preserving generated tool code across approval and host changes; cheap sleeping is already solved.
2. **I/E:** Test agent-runtime teams at $250–$500/month; test local/private-data integrations at $500–$1,500/month, with paid pilots and explicit alternatives.
3. **I:** Data/authority locality justifies moving work; ordinary CPU glue usually cannot justify a compute-savings business, and JS migration does not release model KV/HBM.
4. **I:** Record a 65-second source→browser reconciliation handoff: source stopped, local file stays local, actual continuation resumes; label every unbuilt part until qualified.
5. **I:** Prior art, JSON/replay baselines, host authority, image leakage, and device availability decide credibility; none of the pricing hypotheses is validated demand.

**Verdict — GO-WITH-CHANGES for the product/demo angle.** Pursue an agent-runtime integration and a local-data proof. **No-go for a generic “free compute everywhere” pitch** without useful-job economics and a real capacity bottleneck that relocation removes.

**The three next steps:**

1. **I/E:** Recruit five relevant runtime/product teams for discovery, obtain two real paused-program traces, and offer the scoped paid pilot. Require a concrete replay/recovery or local-data failure; compliments and video views are insufficient. This report authorizes no outreach or posting.
2. **I/E:** Compare one trace against JSON/local task dispatch, Cloudflare-style replay, and an existing snapshot runtime. Measure integration hours, correctness, full restore latency, bytes, peak memory, CPU and external-model cost. Stop the standalone product claim if a simpler baseline meets the need within 10% of relevant performance and less implementation effort.
3. **I:** Qualify and record the 65-second local-data handoff, then publish its reproducible artifact, uncut receipt, known failures, and prior art together. Release only the file teaser if the destination adapter or ownership proof does not pass.
