# Extending serverless lifespan: durable continuations, not immortal processes

Research date: **2026-10-28**. All external sources below were checked on that date unless a publication date is supplied. Read [BRIEF-2](BRIEF-2.md), [BRIEF](BRIEF.md), and the TL;DRs/verdicts of reports 01–05 first. Only this report was edited; no deployments, accounts, installs, builds, or new runtime experiments.

Labels: **F** = sourced fact; **M (prior)** = measurement reported by the existing local research, not independently repeated here; **I** = inference; **E** = estimate or proposed experiment. Dollar amounts are USD, before tax. Marginal prices exclude allowances unless stated.

## 1. Answer

**I — GO-WITH-CHANGES for a narrow runtime integration; no-go for “ordinary Workers need us to run for two hours.”** A paid HTTP Worker can already spend two hours waiting on APIs while its client stays connected. A process can still disappear, and background invocation limits are real, but Cloudflare Workflows, durable agent fibers, Vercel Workflow, Trigger.dev, Temporal, Inngest, and AWS durable functions already address long-lived logical jobs.

**I — The useful promise is:** preserve a supported program's closure graph and execution position across invocation replacement, without making its author describe that state as workflow steps or recovery JSON. The best customer is already executing generated JavaScript in a restricted interpreter. Such a customer has already paid much of the compatibility and interpreter cost. “Unmodified code” means guest control flow can remain unchanged; it does **not** mean an arbitrary Node application, browser, socket, or native extension becomes portable.

**F — There is direct competitive overlap today.** Vercel's official documentation offers an experimental QuickJS runtime with heap snapshots, defaulting to a snapshot every 1,000 events. Its ordinary workflow runtime instead replays history. Trigger.dev uses process checkpoint/restore. Neither “heap snapshots” nor “no timeout” is a standalone differentiator. [Vercel Workflow limits and QuickJS configuration](https://vercel.com/docs/workflows/pricing), [Trigger.dev architecture](https://trigger.dev/docs/how-it-works).

## 2. The actual limits in October 2026

### Cloudflare Workers

| Constraint | Current documented limit — **F** | Consequence — **I** |
| --- | --- | --- |
| HTTP CPU | Free: 10 ms. Paid: default 30 s; configurable maximum 300 s. I/O waiting is excluded. | Increasing configuration often fixes the immediate problem. Checkpointing cannot make CPU free. |
| HTTP wall time | No fixed limit while client stays connected; `waitUntil()` adds at most 30 s after completion/disconnect. | A two-hour HTTP agent need not hop solely because two hours elapsed. |
| Memory | 128 MB per isolate, including JavaScript and Wasm allocations. | Invocation replacement does not increase capacity. |
| Cron | 15 min wall time; paid CPU: 30 s for intervals under one hour, 15 min for intervals of at least one hour. | Schedule another bounded invocation or use durable orchestration. |
| Routine runtime replacement | Old processes drain existing requests/connections for up to 20 min, measured per process. Crashes/resource pressure may interrupt earlier. | A long connection is not a durability guarantee. |

Source for these rows: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), updated **2026-10-12**. **F:** paid subrequests now default to **10,000**, configurable up to **10 million**; Free remains **50 external / 1,000 internal**. Redirects also consume requests. Six simultaneous outgoing connections remain a separate constraint. The subrequest increase shipped **2026-02-11**; repeating the old paid 1,000 limit would materially overstate demand for hopping. [Subrequest-limit announcement](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/), [limits](https://developers.cloudflare.com/workers/platform/limits/).

**F — Queues:** each consumer has **15 min wall time**, default **30 s CPU**, configurable to **5 min**. Message size is **128 KB**; retention is configurable to **14 days** on Paid, **24 h** on Free; maximum retries **100**, batch size **100**, delivery delay up to **24 h**. Store a heap in object storage and queue a pointer. **F — Documentation disagreement:** the broad Workers pricing page says up to 15 min CPU for Queue consumers, while the dedicated Queues limits/configuration page specifies 300,000 ms. This report uses the dedicated page's **5 min**, and would verify an account's effective configuration before deployment. [Queues limits](https://developers.cloudflare.com/queues/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

### Durable Objects: hibernation is not a saved heap

**F:** current lifecycle documentation says:

- A hibernateable object can hibernate after **10 s** idle. Hibernation discards memory; supported WebSockets remain connected; the constructor runs again on activation.
- Hibernation requires no pending timers, unfinished I/O/`waitUntil`, outbound connections, standard WebSocket API usage, or active request/event.
- Idle, non-hibernateable objects ordinarily evict after **70–140 s**. Pending operations can prevent eviction for up to **15 min per operation**; a later operation can extend residency.
- Shutdowns occur on code deployment, runtime updates, inactivity, or placement decisions. There is **no shutdown hook**.
- In-flight HTTP/RPC may finish without storage access; a storage access during shutdown stops the request to preserve uniqueness. Runtime-system updates allow such in-flight DO requests **30 s**. WebSockets terminate.

[Durable Object lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/), updated **2026-10-15**. **I:** the general Workers 20-minute drain and DO-specific 30-second update rule describe different shutdown paths; promise the stricter applicable behavior, not a universal grace period.

**F:** DO CPU defaults to **30 s**, configurable to **5 min**. Incoming requests/messages replenish the documented CPU window; memory is still **128 MB per isolate**, potentially shared by several DO instances. Alarms have **15 min wall time**, one scheduled alarm per object, at-least-once execution, and up to **six automatic retries** with exponential backoff. An alarm wakes fresh code; it does not resurrect local variables. [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [alarms](https://developers.cloudflare.com/durable-objects/api/alarms/), [invocation wall-time table](https://developers.cloudflare.com/queues/platform/limits/).

**F — Recent changes weaken old eviction anecdotes.** The **2026-06-19** announcement specifically addressed long LLM streams being cut off at the inactivity window: outbound TCP/WebSocket connections now prevent eviction, with a 15-minute prevention window per connection. The October lifecycle documentation describes pending operations more broadly than that announcement. Use the latest lifecycle contract, and test the actual I/O primitive; do not assume every old “70 seconds” report still reproduces. [June announcement](https://developers.cloudflare.com/changelog/post/2026-06-19-outbound-connections-keep-dos-alive/).

### Other platforms

| Platform | October 2026 position — **F** | Implication — **I** |
| --- | --- | --- |
| AWS Lambda event functions | Conventional single invocation maximum **900 s / 15 min**, default timeout **3 s**; memory **128–10,240 MB**. Current quotas additionally list **90 min** for qualifying asynchronous/event-source invocations on **Managed Instances**, with exclusions. [Quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html), [timeout API](https://docs.aws.amazon.com/cli/latest/reference/lambda/create-function.html). | “All Lambda is limited to 15 minutes” is now too broad. Name the compute type. |
| Vercel Functions / Fluid | Default **300 s**. Hobby max **300 s**; Pro/Enterprise GA max **800 s**. Per-function extended beta reaches **1,800 s** for supported Node/Bun/Python versions with Fluid; Secure Compute/Static IP restrictions apply. [Duration configuration](https://vercel.com/docs/functions/configuring-functions/duration), [2026-06-15 announcement](https://vercel.com/changelog/vercel-functions-can-now-run-up-to-30-minutes). | Fluid changes concurrency and billing, not durable heap ownership. Beyond 30 min still needs another execution mechanism. |
| Deno Deploy, current platform | V2 removes per-request CPU limits. Build configuration documents **768 MB default runtime memory**, up to **4 GB** on Pro. Instances may stop at any time; idle timeout is **5 s–10 min**; SIGINT gives **5 s** before SIGKILL. [V2 migration](https://docs.deno.com/subhosting/manual/api_migration_guide/), [build/runtime configuration](https://docs.deno.com/deploy/reference/builds/), [runtime lifecycle](https://docs.deno.com/deploy/reference/runtime/). | No fixed request-duration ceiling was found in these current documents. Do not invent one or mistake idle eviction for a request timeout. |
| Deno Deploy Classic / old Subhosting | Legacy docs describe **512 MB** and averaged **50/200 ms CPU** quotas for old subhosting tiers. V1's announced shutdown was **2026-07-20**. [Legacy limits](https://docs.deno.com/subhosting/manual/pricing_and_limits/). | Those numbers are not current Deploy V2 execution limits. |
| Netlify Functions | Synchronous/streaming **60 s**, scheduled **30 s**, background **15 min**; default memory **1,024 MB**. Background functions return 202 and execute separately. [Configuration](https://docs.netlify.com/build/functions/configuration/), [streaming API](https://docs.netlify.com/build/functions/api/), [background functions](https://docs.netlify.com/build/functions/background-functions/). | Background dispatch removes client waiting, but is not arbitrary-duration execution or automatic continuation. |

**I — Deploy survival needs a narrower definition.** A durable job can continue after deployment by running its **old pinned guest/module build** under a compatible new host. An old engine heap cannot generally be loaded into newly compiled guest code. Retain old artifacts until their runs finish; explicit state migration is a different feature. Network connections and caller stacks still need reconnect/job-status APIs.

## 3. How much pain exists? Concrete reports, no fabricated incidence rate

**F:** the following is a deliberately selected evidence sample, not a survey of all applications:

| Evidence | What happened / workaround | What it establishes |
| --- | --- | --- |
| [cloudflare-os #603](https://github.com/cloudflare/cloudflare-os/issues/603), **2026-09-30** | Approximately seven-minute agent turns failed under default DO CPU. Setting 120–300 s removed the failure; reverting restored it. A maintainer argued for progress-based CPU top-ups because simply increasing limits makes infinite loops expensive. | A highly relevant contemporary failure, with an inexpensive configuration baseline. It does not establish a need for heap migration. |
| [Agents #2276](https://github.com/cloudflare/agents/issues/2276), **2026-09-15**, fixed/released September 18 | Restart during an empty opened stream or pending retry could skip a recoverable submission or mark it failed. Reporter supplied version-locked reproductions and recovery patches. | Reconstructing durable agent state has real edge cases. These particular bugs were fixed, not an enduring reason to replace the SDK. |
| [Agents #1257](https://github.com/cloudflare/agents/issues/1257), **2026-04-04** | Maintainer proposed a durable AI Gateway response buffer: fiber recovery alone still needs another inference request after the upstream connection dies. | Heap persistence and durable upstream I/O are separate problems. A proposal is not evidence that buffering was shipped. |
| [Next.js #71161](https://github.com/vercel/next.js/issues/71161), **2024-10-11** | Server Action timeout appeared as undefined to application code while the network response was 504. | Timeout failures also create application/debugging costs; this predates today's larger limits. |
| [Vercel community #4788](https://github.com/vercel/community/discussions/4788), **2023-11-09** | A production 504 was discussed as a possible Hobby duration issue; author ultimately fixed configuration. | An important negative control: a timeout search result is not automatically a long-compute customer. |

**F:** Cloudflare's own Agents documentation provides `keepAlive()`, `runFiber()`, JSON `stash()`, and `onFiberRecovered()`. It explicitly describes loss of the original closure and reports nondeterministic code/runtime restarts “1–2x per day.” Treat that frequency as an SDK author's operational statement, **not** a platform SLA or measured fleet failure rate. Current lifecycle documentation supersedes its older inactivity shorthand. [Durable execution](https://github.com/cloudflare/agents/blob/main/docs/agents/durable-execution.md).

**F:** Cloudflare documents plan/state machines, alarm-driven next steps, partial-stream persistence, and recovery callbacks; Vercel maintains a timeout troubleshooting guide. These are stronger evidence of recurring design demand than raw search-result counts. [Long-running agents](https://github.com/cloudflare/agents/blob/main/docs/agents/long-running-agents.md), [chat recovery](https://developers.cloudflare.com/agents/communication-channels/chat/chat-agents/), [Vercel troubleshooting](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out). The Vercel guide's older duration figures conflict with newer duration documentation; use it for workaround evidence only.

**I — Frequency verdict:** genuine pain among long-turn agents, imports, and background jobs; no defensible percentage of developers or invocations hitting limits was found. Neither this evidence sample nor the SDK's restart statement supports a market-size multiplier. The buying question is whether recovery requires expensive **non-serializable control state**, rather than whether a developer has ever seen a 504.

## 4. What developers use now: rewrite cost and money

**E:** integration estimates below are for one existing small TypeScript agent with model/tool adapters, by an experienced developer. They are not vendor promises or measured migration studies. Production rollout, audits, and complicated application redesign can take much longer. **F:** prices are checked public list rates; compute/model/storage extras remain relevant.

| Alternative | Required change / preservation model | Money and estimated integration |
| --- | --- | --- |
| **Cloudflare Workflows** | Wrap external/nondeterministic work in named `step.do`; return durable values rather than depending on mutations inside earlier steps. Loops remain ordinary code, so “rewrite into steps” need not mean a visual DAG. Recovery restores recorded step results, not an arbitrary live step closure. [Rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/). | Workers Paid **$5/month minimum**; request/CPU rates plus **$0.80/100,000 steps**, **$0.20/GB-month** state beyond allowances. **E: 0.5–2 days** for a simple loop, **3–10 days** for closure-heavy/generated code. [Pricing](https://developers.cloudflare.com/workflows/reference/pricing/). |
| **DO alarms / Agents fibers** | Persist explicit JSON/cursor, schedule next work, implement recovery hook; sockets reopen. `runFiber` cannot recreate the original callback automatically. [Fibers](https://github.com/cloudflare/agents/blob/main/docs/agents/durable-execution.md), [alarms](https://developers.cloudflare.com/durable-objects/api/alarms/). | DO requests **$0.15/million**; duration **$12.50/million GB-s**; SQLite writes **$1/million rows**, storage **$0.20/GB-month**, after allowances. **E: 1–3 days** small explicit state, **1–2 weeks** complex recovery. [Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/). |
| **Queues chaining** | Break work into bounded batches; commit cursor and enqueue continuation; implement deduplication and recovery from commit/enqueue gaps. Large state lives elsewhere. [Limits](https://developers.cloudflare.com/queues/platform/limits/). | **$0.40/million operations**, typically three per message per 64 KB chunk, plus Worker/storage. **E: 1–3 days** for a cursor loop, longer for arbitrary control flow. [Pricing](https://developers.cloudflare.com/queues/platform/pricing/). |
| **Cloudflare Containers** | Package Node/Linux application; avoid interpreter tax and gain more memory. Manage process restart/recovery. New container snapshots preserve **filesystem**, not executing JS heap/registers. [Container snapshot changelog](https://developers.cloudflare.com/changelog/product/containers/). | Active CPU **$0.000020/vCPU-s**, provisioned memory **$0.0000025/GiB-s**, disk **$0.00000007/GB-s**, plus DO/Worker/egress. **E: 0.5–2 days** packaging, additional recovery work. [Pricing](https://developers.cloudflare.com/containers/platform/pricing/). |
| **Vercel Workflow** | Add `"use workflow"` / `"use step"`, observe serialization/runtime boundaries. Experimental QuickJS snapshots optimize orchestration recovery; effect steps still run separately. [Workflow/step contract](https://workflow-sdk.dev/docs/foundations/workflows-and-steps), [snapshot RFC, March 7](https://github.com/vercel/workflow/discussions/1298). | **$20/million events**; **$0.50/GB written**, **$0.50/GB-month retained**; Functions and Queues extra. A normal step produces three events. **E: 0.5–2 days** ordinary loop, more for unsupported dependencies. [Pricing](https://vercel.com/docs/workflows/pricing). |
| **Temporal** | Deterministic Workflow plus Activities for effects, worker hosting/versioning; plain loops are supported. Recorded Activity results prevent completed LLM calls being repeated. [Execution model](https://docs.temporal.io/workflow-execution). | Current direct Cloud offer starts **$50/million actions**, active/retained history **$0.042/$0.00105 per GB-hour**, developer support 10% of usage; worker compute extra. Direct pricing currently says **no base monthly fee**; older Marketplace offer differs. **E: 2–5 days** small workflow, weeks for broader adoption. [Current pricing](https://temporal.io/pricing), [billable actions](https://docs.temporal.io/evaluate/cloud/actions). |
| **Inngest** | Wrap work in `step.run` / durable waits; step results are memoized and handlers reconstruct control flow. Hosted serverless endpoint remains subject to its provider's per-step timeout. [Execution model](https://www.inngest.com/docs/durable-execution/durable-workflows). | Free **50,000 executions/month**; Pro **$99/month**, **1 million included**. Execution count = runs + steps; published Pro overages start **$0.000050/execution**, declining by volume; hosting extra. **E: 0.5–2 days** simple loop. [Pricing](https://www.inngest.com/pricing). |
| **Trigger.dev** | Wrap task and deploy to managed workers; arbitrary long-running Node code is natural. CRIU captures process memory/registers/file descriptors at supported waits/subtasks. Crash/retry semantics still require care. [Architecture](https://trigger.dev/docs/how-it-works). | Free has **$5 monthly credits**; Hobby **$10**, Pro **$50**. Small-1x **$0.0000338/s** plus **$0.000025/run**: two continuously executing hours ≈ **$0.2434** before credits. **E: 0.5–2 days**. Wait/checkpoint thresholds differ between pricing and architecture pages; verify current SDK behavior. [Pricing](https://trigger.dev/pricing). |
| **Lambda + Step Functions** | Split into Lambda tasks and states/DSL or SDK-generated definition; pass serializable values/S3 pointers. Standard can last **one year**, Express **five minutes**. [Types](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html). | Standard **$0.025/1,000 state transitions** in N. Virginia, Lambda charges extra. 240 transitions = **$0.006** before allowance. **E: 1–3 days** small agent, longer with IAM/deployment integration. [Pricing](https://aws.amazon.com/step-functions/pricing/). |
| **Lambda durable functions** | Since **2025-12-02**, SDK steps/waits inside a handler; replay skips completed operations; up to **one year** logical duration. Another contemporary baseline, without a separate Step Functions graph. [Launch](https://aws.amazon.com/about-aws/whats-new/2025/12/lambda-durable-multi-step-applications-ai-workflows/), [model](https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html). | **$8/million durable operations**, **$0.25/GB written**, **$0.15/GB-month retained**, plus Lambda including replay invocations. **E: 1–3 days**. October 13 increased limits to **30,000 operations**, **1 MB checkpoint payloads**. [Pricing](https://aws.amazon.com/lambda/pricing/), [limit increase](https://aws.amazon.com/about-aws/whats-new/2026/10/aws-lambda-durable-gen-limit-increase/). |

**F — Workflows also has limits.** Cloudflare documents unlimited overall wall duration, bounded CPU per invocation (30 s default / 5 min configurable), and **10,000 steps default / 25,000 configurable** on Paid; Free has **1,024 steps**. A step can wait indefinitely in wall time, subject to configured timeout/retry behavior and CPU. **I:** distinguish durable workflow lifetime from one execution of a step. One giant `step.do` can avoid initial restructuring but restarts its unfinished body after interruption; it does not preserve its live closure. [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/).

**I — Strongest competitive conclusion:** sell fewer application recovery annotations for a constrained program, not “other systems cannot run loops,” “replay calls the LLM again,” or “Trigger.dev requires rewriting every operation into a step.” Vercel's snapshot implementation keeps the event log authoritative and still brokers steps. The same architecture can be adopted inside an incumbent. [Vercel snapshot design](https://github.com/vercel/workflow/discussions/1298), [released experimental snapshot interface](https://github.com/vercel/workflow/releases).

## 5. Where a live heap wins, and where it does not

### A. Generated or deeply nested agent control flow: strongest candidate

**F:** the current Cloudflare fiber API asks the developer to reconstruct recovery using JSON; Vercel's step API requires identifiable effect boundaries. **I:** a generated function containing closures, cycles, mutually recursive helpers, a `Map` of pending work, and local error handlers can be much harder to export as application state than a `{turn, messages}` loop.

**E:** compare a 300–1,000-line supported guest, 120 model turns, **2–8 MiB compressed heap**, against wrapping the two effect adapters plus hand-writing recovery for ten control-flow variants. The possible win is **2–5 engineering days** avoided per integration at an assumed **$800/day = $1,600–$4,000**, not dollars of CPU per run. Once a reusable workflow adapter handles these variants, that advantage shrinks. **I:** software generated repeatedly at runtime is a better fit than one fixed loop that a developer can refactor once.

**I:** the buyer is an agent-runtime or code-execution platform embedding a restricted engine. A useful two-week proof must keep guest source identical between ordinary execution and checkpoint execution, and compare with a native Workflows adapter plus Vercel QuickJS snapshots, not only handcrafted JSON.

### B. Costly LLM history: useful condition, usually insufficient by itself

**I:** a heap preserves locally assembled prompts, parsed responses, local reasoning artifacts and closure state. It does **not** preserve the remote model's GPU KV cache, provider-side response stream, prefix-cache eligibility, or a TCP connection. Every normal new model request still sends whatever context its API requires.

**F:** durable workflow replay returns stored results for completed effect steps. Cloudflare documents rebuilding a partial answer from buffered chunks; interruption can still sever upstream inference. [Lambda replay explanation](https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html), [Cloudflare chat recovery](https://developers.cloudflare.com/agents/communication-channels/chat/chat-agents/). **I:** expensive past LLM calls do not favor heaps over correctly implemented replay; both can avoid reissuing those calls. A heap helps only if rebuilding *local program state* from the recorded history is expensive, or retrofitting effect recording otherwise changes the program substantially.

**E:** at an assumed **$0.05/model turn**, 120 turns cost **$6**. Losing the latest unfinished model request may waste up to another $0.05 in either design; blindly restarting all 120 would waste $6, but that is a deliberately weak baseline. Test a durable provider-call broker/response buffer separately. An external effect that completed without a recorded receipt remains ambiguous with either runtime.

### C. Expensive in-memory indexes/caches: conditional candidate

**E:** consider a **20 MiB** pointer-rich local index taking **3 s native** to rebuild from durable source. At eightfold interpreter cost, a full rebuild takes **24 s**. A **5 MiB** checkpoint transferred over an assumed effective **100 Mbit/s** takes about **0.42 s** for download alone; allow an estimated **0.1–0.5 s** for loading/decompression/restore and verify it. Against that interpreted rebuild, a snapshot could save roughly **23 s** per cold continuation.

**I:** the fair baseline is a native V8 worker loading a serialized index image, or a DO using SQLite, not an interpreted full rebuild on every hop. An immutable index should generally be a separately cached binary artifact, not recopied with every mutable heap. Only a dynamic index with expensive hidden structure and modest changes strongly favors heap capture. The buyer is a document/reconciliation or agent-analysis runtime with measured cold rebuild costs; external search infrastructure already beats this for indexes exceeding Worker memory.

**E:** at 1 million cold resumptions/month, avoiding 3 s native CPU represents **$60/month** of Worker CPU at current marginal rates; avoiding 24 s interpreted CPU represents **$480/month**. A single 5 MiB R2 read adds roughly $0.36/million operations but **5.24 TB of read bytes** across the fleet; checkpoint writes and serialization CPU matter. Thus latency and compatibility are more plausible value than raw compute margin.

### D. Deploy-surviving in-flight work: real need, shared solution

**I:** periodic durable checkpoints allow recovery after unexpected termination, losing at most the work since the last checkpoint plus any unrecorded effect. Snapshotting only when receiving a shutdown notification cannot work on ordinary Workers/DOs: there is no reliable user shutdown callback before every kill. The program must checkpoint **during normal progress**.

**E:** 10,000 two-hour jobs/month at an assumed 8% interruption rate would require **800 recoveries**. If a heap cuts **2 s** local reconstruction to **0.1 s**, it saves 1,520 CPU seconds, only about **$0.03** at native Worker CPU rates. If it removes **five human support cases at $100 each**, that would save **$500**—an unvalidated business assumption. Proper Workflows/Temporal recovery may remove those cases already. Sell demonstrably preserved state or reduced implementation burden, not a universal recovery-cost advantage.

### E. Live migration off a draining machine: strongest in controlled infrastructure

**I:** cooperative capture at the next host-await, an acknowledged destination, and a fenced source can transfer a logical job before a planned shutdown. That is attractive for a runtime operator controlling both executors, version compatibility, and effect ownership. Ordinary Worker application code does not get reliable machine-drain notifications or arbitrary placement control; surviving an abrupt crash means restore from the **previous** checkpoint, not live migration at the instant of death.

**E:** a 5 MiB image needs roughly **0.42 s** one-way at 100 Mbit/s, versus **24 s** to rebuild the example interpreted index. A plain VM/container checkpoint may preserve Node/V8 with no interpreter penalty on the operator's Linux fleet. The portable Wasm variant wins only if it must also run across incompatible host environments or its small, restricted guest is materially cheaper to package. Strong baselines: Trigger.dev/CRIU, native serialized application state, and version-pinned replay.

### Hard boundaries

- **M (prior):** local research measured roughly **5–11×** slower glue execution than native V8 and **1.5–6.4 MB compressed** nontrivial snapshots. These are workload-specific, not universal ratios. Existing hop tests measured roughly **22–23 KB sparse deltas**, but did not prove production incremental persistence/recovery. [Roadblocks](../v8/03-roadblocks.md), [hop/delta evidence](04-spike.md).
- **I:** under 128 MB, a 50 MB guest plus a full capture copy and decoded/compressed staging buffers can exhaust memory. Wasm high-water memory need not shrink after GC. Stream/chunk persistence and impose an admission limit substantially below 128 MB; measure the complete host/guest peak.
- **I:** cooperative await-only checkpoints cannot capture an arbitrary synchronous loop just before CPU termination. The host needs frequent safe returns, an instrumented resumable execution mechanism, or enough reserved CPU to reach a boundary and persist. Same-thread JavaScript timers do not preempt a busy guest. Keep an outer watchdog and conserved logical-job budgets so fresh invocations do not reset authority or spend limits.
- **F/I:** R2 Standard costs **$0.015/GB-month**, **$4.50/million writes**, **$0.36/million reads**, with free internet egress. A 5 MiB snapshot every minute for two hours writes **0.629 GB**; retain all for one month and storage alone costs **$0.0094/job**, or **$9,437/million jobs**, plus operations/compute. Keeping only a recoverable head and a bounded delta chain dramatically changes this. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- **I:** putting bulk heaps directly in DO SQLite makes storage more expensive than R2 and adds row/value/chunk constraints. Use the DO for the transactional head, epoch and effect ledger. R2 and DO do not share a transaction: write immutable blobs first, atomically publish a head, and garbage-collect unreachable blobs later.
- **I:** timeouts are not all recoverable. A memory leak survives a faithful heap restore; a bad infinite loop continues to be bad; an expired provider session stays expired. Completion still needs cancellation, terminal error handling, retention, quotas and bounded retries. “Immortal” must mean a recoverable logical job, never guaranteed infinite execution.

## 6. Worked example: a two-hour agent on Workers

**E — Workload assumptions:** 120 sequential turns over approximately 7,200 s wall time. Each turn contains one LLM call and one tool call, **240 durable effect boundaries**. Total ordinary guest CPU is **12 s**; QuickJS costs **8× = 96 s**. Budget an additional **24 s CPU** across hashing, codecs, copies and adapters, making the checkpoint system **120 s CPU total**. Each durable response averages **8 KiB**, so recorded results total **1,966,080 bytes**. A checkpoint averages **2 MiB compressed**, with peak total Worker memory below 96 MB. Those CPU, size, memory and latency assumptions are **not measurements of this workload**.

**E — Correctness contract:** both designs persist effect identities/results, use idempotent tools or reconciliation, retain history for 30 days, and resume on a fresh invocation after failure. The heap design writes 240 immutable snapshots and later reads each once, but promptly deletes superseded snapshots, keeping one materialized recoverable head. Queue messages carry pointers under 64 KB. Model/tool charges are identical: assumed **$6** plus any external tool fees.

**I — Workflows implementation:** two named step families inside the loop, stable turn-based IDs, model/tool outputs returned as data, local history reconstructed from those values. **E:** 240 executed steps, one workflow creation, 12 s CPU including trivial reconstruction for this example. No full conversation needs to be returned on every step. This is a deliberately efficient baseline; actual replay CPU and internal metadata storage must be measured.

**I — Heap implementation:** persist the parked guest plus pending-operation identity before making its effect eligible; broker executes/captures the result, schedules a fenced resumption, and the guest continues at its original await. An outbox/reconciler repairs lost notifications. For accounting, assume 240 pointer messages, 241 runner invocations, 720 coordinator requests, 720 small row writes, 1,440 row reads, 7.2 s of billed coordinator residency and 0.5 MB ledger overhead. This is a proposed accounting model, not a production implementation. Actual alarms, retries, indexes, outbox updates and billed residency can add usage.

| Item — **E**, allowances exhausted | Cloudflare Workflows | Heap + R2 + Queues + SQLite DO |
| --- | ---: | ---: |
| CPU | 12,000 ms × $0.02/million = **$0.000240** | 120,000 ms × same = **$0.002400** |
| Workflow steps | 240 × $0.80/100,000 = **$0.001920** | — |
| Invocation requests | **$0.0000003** | 241 × $0.30/million = **$0.0000723** |
| R2 PUT + GET | — | 240 × ($4.50 + $0.36)/million = **$0.0011664** |
| Queue operations | Included in managed workflow mechanism | 240 × 3 × $0.40/million = **$0.000288** |
| Coordinator requests, rows, duration | Included in managed workflow mechanism | **$0.000841**, under stated accounting |
| 30-day retained state | 1.966 MB × $0.20/GB-month = **$0.000393** | Latest heap **$0.0000315** + receipts/ledger **$0.000493** |
| Approximate runtime subtotal | **$0.00255/run** | **$0.00529/run** |
| With assumed model charges | **$6.00255** | **$6.00529** |

**F — Rate references:** [Workers CPU/requests and $5 account minimum](https://developers.cloudflare.com/workers/platform/pricing/), [Workflows steps/state](https://developers.cloudflare.com/workflows/reference/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/), [Queues](https://developers.cloudflare.com/queues/platform/pricing/), [DO SQLite/requests/duration](https://developers.cloudflare.com/durable-objects/platform/pricing/). **E:** numbers are smooth marginal allocations; provider rounding applies to aggregate usage, not literal tiny per-job invoices. Small deployments may remain within allowances and just pay the shared $5 minimum. Excluded: optional logs, measured retry traffic, additional metadata, and unmeasured host CPU beyond the explicit budget. Two hours of changing snapshots' transient storage adds a small amount; it does not change the conclusion.

**E — Byte accounting:** 240 × 2 MiB = **503.3 MB written**, and another 503.3 MB read, roughly **1.01 GB checkpoint traffic/job** despite a 2 MiB retained head. Retaining every image for a month instead adds **$0.00755/job**, pushing the heap subtotal above **$0.0128**. A validated 20 KB delta scheme could reduce traffic substantially, but prior sparse-delta measurements do not establish that this agent has sparse changes or that a long delta chain is recoverable.

**E — Economic result:** at 100,000 runs/month, before allowances, roughly **$255 vs $529** runtime, against **$600,000 model spend**. A native Workflows implementation would need about **137 additional CPU seconds/run** of reconstruction before its modeled bill reaches the checkpoint bill. Large histories can cause replay overhead; simple history arrays often will not. Benchmark rather than assume that threshold is crossed.

**E — Complexity result:** simple Workflows loop **4–16 engineering hours**; guest adapter to an already production-qualified checkpoint runtime **2–8 hours**. Building that runtime/broker from this spike is **not** 2–8 hours: a scoped **1–2 week proof** is plausible; production durability and operations are additional work. Against this simple loop, Workflows is the recommendation. Against generated closure-heavy variants, measure the avoided recovery code and integration hours.

**I — Failure result:** kill at minute 73, after the latest effect receipt is committed: both systems reuse all prior LLM results. Heap capture can retain local closure position; Workflows reconstructs it. Kill during a provider request: neither saved heap alone nor replay can resurrect the dead connection. Durable provider-side completion/retrieval or an independently surviving broker is necessary. Raising HTTP CPU limits and holding the connection open is the cheap non-durable control, not the strongest durability baseline.

## 7. Could plain V8 do this instead of QuickJS?

**F — V8 exposes relevant primitives, not a general live migration contract.** `v8::SnapshotCreator` produces startup blobs, with embedder callbacks/external references and optional compiled-code treatment. A successful result is documented as a startup snapshot. Current context serialization checks require an empty microtask queue; C++/host resources need explicit handling. [SnapshotCreator](https://v8.github.io/api/head/classv8_1_1SnapshotCreator.html), [context serializer](https://github.com/v8/v8/blob/main/src/snapshot/context-serializer.cc).

**M (prior) — Do not claim that V8 cannot preserve an await.** The existing [tech-stack report, §4](../v8/04-techstack.md) built a Node 24.22.1 startup snapshot containing an unresolved Promise and captured local object; a fresh process supplied the response and printed `resumed 42`. It was prepared under `--build-snapshot`, not captured from an arbitrary running production Node isolate. **F:** Node's public `startupSnapshot` API is a snapshot-building API; `v8.serialize` serializes values, and DevTools heap snapshots are diagnostic, not restartable execution images. [Node V8 API](https://nodejs.org/api/v8.html).

**F — Important October workerd finding:** current source actually contains native V8 startup-snapshot infrastructure. `jsg/snapshot.h` defines `SnapshotArtifact`, a `MutableSnapshot` zygote and `FinalizedSnapshot` consumer, requiring matching external references. `IsolateBase::createSnapshotBlob()` destroys live Wrappables, clears handles, settles cleanup, and calls `CreateBlob(kClear)`. Worker initialization runs the zygote's top-level code, explicitly avoids request-serving handles, and snapshots before it handles requests. [Snapshot types](https://github.com/cloudflare/workerd/blob/main/src/workerd/jsg/snapshot.h), [snapshot creation](https://github.com/cloudflare/workerd/blob/main/src/workerd/jsg/setup.c%2B%2B), [Worker initialization](https://github.com/cloudflare/workerd/blob/main/src/workerd/io/worker.c%2B%2B). These files were also inspected read-only in the local upstream checkout.

**I:** this is real startup-state capture, and could remove repeated expensive initialization. It is **not evidence of a public Worker API to checkpoint an active request/DO heap and resume it elsewhere**. The inspected path is destructive preparation of a zygote, clears compiled function code, and deliberately avoids live host objects. Building live checkpoints would need a restricted host ABI, ownership of resource reattachment, a reusable snapshot lifecycle, exact-build compatibility and an execution journal. A counterexample is enough to reject “V8 fundamentally cannot”; it is not enough to claim managed Workers already offers this feature.

| Route | Feasibility / tradeoff — **I**, with relevant **F** sources |
| --- | --- |
| Custom native V8/workerd embedder | Plausible at quiescent host-await boundaries; may recover JIT advantages between checkpoints. Requires substantial native/embedder work and tight engine-version constraints. Not callable by ordinary hosted Worker JavaScript. |
| Source/CPS transformation | Convert async control flow, locals and callbacks into explicit serializable frames; execute transformed code on V8. Potentially faster than interpreting everything, but language coverage and transparent libraries are difficult. This is a compiler/runtime project, not an API toggle. |
| Journal replay on V8 | Existing practical solution. Handles ordinary programs once effects are captured; reconstruction cost depends on history and pure work. Snapshotting can be an optimization layered over the journal, as Vercel demonstrates. |
| Process/container/VM checkpoint | Captures native V8 together with surrounding process, avoiding QuickJS overhead; heavier platform/image/kernel constraints and special handling for external sockets. Trigger.dev already supplies a managed CRIU-based version. [Architecture](https://trigger.dev/docs/how-it-works). |
| Heap-profiler JSON / structured clone | Useful for diagnostics or supported data values, not an executable arbitrary-stack/closure restore. [Node APIs](https://nodejs.org/api/v8.html). |

**I — Decision:** use QuickJS/Wasm for the short proof because portable engine memory is already demonstrated and available from JavaScript in all target hosts. Keep native V8 snapshots as a credible server-only alternative and a serious threat to the long-term performance argument. Do not build V8 merely to test the business thesis.

## 8. Buyer, price, and rough business size

**E — Candidate buyers and willingness-to-pay hypotheses:**

| Customer | Paid value to test | Plausible initial price / bottom-up size |
| --- | --- | --- |
| Generated-code agent runtime already using QuickJS | Remove hand-written continuation schemas, support arbitrary generated control flow within a fixed ABI, maintain recovery across host replacement. | **$500–$2,000/month** runtime integration/support. Hypothetical **20–100 customers = $120,000–$2.4 million ARR**. No verified account count or demand. |
| Platform with expensive dynamic local indexes | Lower p95 cold-resume latency while keeping object identity and mutable index structure. | **$250–$1,000/month**, or embedded license. Hypothetical **20–50 customers = $60,000–$600,000 ARR**; requires measured native serialized-index disadvantage. |
| Operator with draining short-lived executors | Move a restricted guest across hosts without restarting local computation; central broker retains authority. | **$1,000–$5,000/month** pilot/support. Hypothetical **5–20 operators = $60,000–$1.2 million ARR**; CRIU and VM migration are strong alternatives. |

**I:** these segments overlap; do not add them as TAM. Public reports establish a problem class, not this number of buyers. The worked example gives no basis for a high per-run “compute savings” margin. An open-source runtime with paid integration/support, or a feature in an existing platform, is more plausible than a general immortality service competing on fractions of a cent.

## 9. A small 1–2 week proof, with a kill test

**E — Ten-day TypeScript/Wasm/Cloudflare-compatible proof; local workerd/Miniflare, no account/deploy required:**

1. **Days 1–2:** pin the existing interpreter/module/ABI; select one closure-heavy generated-code fixture and one ordinary JSON-state loop. Record input bytes, effect receipts, CPU, memory and native reconstruction work. Strong baseline: idiomatic Cloudflare Workflows with stable step names; include Agents `stash` recovery and Vercel's experimental QuickJS runtime where locally runnable.
2. **Days 3–5:** implement SQLite broker/head/epoch and immutable blob storage locally, pointer notifications/outbox, and version-pinned restore. Use the same guest source without inserting recovery steps. Produce pending intent → snapshot → committed head → effect receipt → fresh invocation. Deduplicate the sink by logical run and operation ID. Stop stale executors from issuing effects.
3. **Days 6–7:** force **ten invocation replacements** during a two-hour scripted run, plus a time-scaled fast run. Inject failures before/after blob upload, head publication, notification, effect completion and reply delivery. Include receipt-loss ambiguity, a corrupt snapshot and a missing base delta. Compare output and effect ledger to an uninterrupted reference.
4. **Days 8–9:** benchmark **2/8/32 MiB** heaps, high-entropy data, GC churn, long synchronous work and a dynamic index. Report full persist-to-resume p50/p95, all bytes, codec CPU, billed-unit estimates, peak host memory and integration code/hours. Test configurable CPU limits with conservative headroom; a synthetic forced slice is not proof that production pre-limit prediction works.
5. **Day 10:** compare replay, explicit JSON, native serialized index and container/process-checkpoint estimates. Publish the fixture, receipts and known unsupported APIs in a small artifact; record a demo only after correctness passes. A second runtime can be omitted if it would obscure whether the recovery feature has value.

**E — Acceptance:** no duplicate committed sink effects in the fault matrix; correct completion after all ten replacements; no completed LLM request repeated; peak memory below **96 MB**; materialization plus persistence plus restored execution p95 **<1 s** for a 2 MiB checkpoint on a stated local/network setup. Require either **≥50% less integration/recovery code** across the generated fixtures at comparable correctness, or **≥5× faster cold reconstruction** than the strongest applicable native baseline. Cost must include interpreter CPU and all stored versions. These are proposed thresholds, not achieved results.

**I — Kill it if:** a generic step adapter runs all fixtures with comparable code, native serialized-index loading matches heap restore, the 128 MB memory budget fails, or most of the remaining engineering is still application-specific recovery. An equivalent Vercel snapshot adapter that already satisfies the customer requirement is a reason to integrate/contribute, not to relabel the same mechanism.

## 10. Demo and tweet

**E — 60-second demo:** show a generated function with a cyclic work graph, captured local counter and nested error handler. It has made 73 recorded model/tool operations. Terminate the **entire local workerd process**, start a fresh compatible host, load the committed checkpoint and continue at the await. Show unchanged guest source, a new process/invocation ID, the same state digest and exactly one committed receipt per operation. Then show the ordinary loop baseline completing just as correctly via recorded step results; contrast the required application annotations. Display the full checkpoint bytes and full persistence/restore latency, not only memory-copy time.

**E — Proposed tweet:** “This generated JS agent lost its Worker process. A fresh invocation resumed its pending await, with closures and object identity intact. No recovery steps in the guest. The tradeoff: an interpreted runtime, bounded heap, and a durable effect broker. Here's the comparison with Workflows.” No posting is authorized by this report.

**I — Expert reply that kills the broad pitch:** “HTTP Workers already run indefinitely while connected. Workflows already keeps LLM results; Vercel snapshots QuickJS; Trigger.dev checkpoints Node. Why accept your interpreter penalty and effect protocol?” The only good answer is a measured customer fixture where a small live continuation removes substantial recovery work or reconstruction latency. If that result is absent, the immortality framing should be abandoned.

## Ranked top three and the ONE bet

1. **I:** **Generated JS already inside a restricted interpreter**, retaining complex closure/control state across invocation replacement. Best combination of current pain, avoided rewrite cost, and already-paid interpreter overhead.
2. **I:** **Small, mutable, costly-to-rebuild in-memory structures**, after native serialized indexes and DO SQLite lose a real benchmark. Latency benefit is more plausible than compute-cost savings.
3. **I:** **Planned drain migration inside a controlled runtime fleet**, especially when the same guest must run on heterogeneous hosts. Compare to CRIU before claiming a new operator advantage.

**ONE bet — I:** a **durable continuation adapter for generated tool code**, integrated into an existing QuickJS agent runtime, with a DO/SQLite home broker and R2-backed bounded checkpoints. Start with that buyer's actual unsupported control flow. Long LLM history, two-hour duration and deploy survival are supporting circumstances, not independently sufficient differentiation.

## Five-line TL;DR

1. **F/I:** Paid HTTP Workers have no fixed wall timeout; CPU, memory, background invocation limits and process replacement remain real.
2. **F:** Workflows, Agents fibers, Vercel QuickJS snapshots, Trigger.dev and AWS durable functions already keep logical jobs alive.
3. **E:** A two-hour example costs about **$0.00255 with Workflows vs $0.00529 with heap checkpoints**, before identical model costs and allowances.
4. **I:** Heaps win on awkward live control state or expensive local reconstruction; they do not preserve upstream sockets or save completed LLM calls relative to proper replay.
5. **I:** Plain V8 can preserve prepared heap state; workerd now has startup snapshot machinery, but no identified public live-request checkpoint API.

**Verdict — GO-WITH-CHANGES for restricted generated-code runtime integration; NO-GO for a general “immortal Workers” platform justified by duration limits or LLM-history savings alone.**

**Three next steps:**

1. **E:** Obtain one real generated-control-flow recovery fixture and a buyer's baseline integration effort; reject a plain messages/cursor loop as the flagship.
2. **E:** Build the ten-day brokered checkpoint proof and compare against Workflows plus Vercel's snapshot runtime, including the full fault matrix and memory costs.
3. **E:** Proceed only after the integration/latency threshold passes; otherwise contribute the adapter to an incumbent or stop this product angle.
