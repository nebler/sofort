# Round 10 · 02-runtime · 28 October 2026

**[I] Verdict:** do not build another agent VM, actor framework, idle-agent host, or TypeScript Infinity. The useful runtime boundary is ownership of effects and resources when an agent, process, or module disappears. My ONE pick is **remote lifetime scopes for asynchronous tools**, narrowly qualified against Infinity's existing subscription-cleanup failure. Two weaker experiments survive: payload-aware Command replay and qualification of extension teardown.

**Evidence convention:** **F** = checked primary source; **M** = experiment run for this report; **I** = interpretation/proposal; **E** = estimate/target. Mutable sources were accessed **2026-10-28**; dates below are publication, release, or issue dates where available. A source's benchmark is F, never M. Negative search results mean “not located in this search,” not proof of absence.

**Scope:** read the entire [research summary](../RESEARCH-SUMMARY.md), skimmed the [catalogue index](../catalogue/README.md), and revisited the relevant R2, R3, R6, R7 and R9 entries. Read Infinity's README, runtime/serverless/RAP documentation and implementation at commit [1abc6fcff1f186124f924b56aa92c3a3684c90c5](https://github.com/hydro-project/infinity/tree/1abc6fcff1f186124f924b56aa92c3a3684c90c5). No model APIs, deployments, containers, or VMs were used. Scratch occupied approximately 11 MB before cleanup.

## 1. What changed at this layer

- **[F] Generated concurrency is now a measurable orchestration problem.** A 7 October 2026 preprint compares dynamic subagent concurrency across **354 tasks and 2,124 executions**, identifying **13 concurrency-specific failure modes**. **[I]** This supports studying ownership, scheduling and cancellation; it does not establish that a particular runtime fixes agent coordination. [Li et al., arXiv:2610.10263](https://arxiv.org/abs/2610.10263).
- **[F] The runtime ingredients have converged.** WASI **0.3.0 shipped 11 June 2026**, adding native component-model async, futures and streams. These are composition primitives, not persistence or external-effect guarantees. [WASI release](https://wasi.dev/releases/wasi-p3). **[F]** Effect's npm registry reported **4.0.7**, published 28 October, during this research; its runtime provides fibers and scoped cleanup, and its ecosystem includes cluster/workflow execution. [Registry metadata](https://registry.npmjs.org/effect/latest), [runtime documentation](https://effect.website/docs/v4/runtime).
- **[F] Self-extension is already a product behavior.** bb's **4 August 2026** release lets an agent scaffold, build, install and reload plugins, including tools, services, scheduled work, UI and SQLite storage. **[I]** The interesting remaining question is what survives installation and removal, rather than whether an agent can write a plugin. [bb changelog](https://getbb.app/changelog).
- **[F] Platform ownership is consolidating.** The Deno team announced joining Cloudflare on **9 October 2026**, with workerd/celld integration and self-hostable Workers/DOs as the direction. **[I]** A standalone runtime competing on Workers compatibility or cheap activation is an especially poor side-project bet. [Cloudflare announcement](https://blog.cloudflare.com/deno-joins-cloudflare/).
- **[F] The concurrency-checking revival is already underway.** REINS, revised **13 October 2026**, uses agent-generated scheduling hypotheses with a controlled scheduler; the authors report six new bugs, three developer-confirmed. **[I]** “LLM writes bad schedules; conventional machinery checks them” is occupied. [REINS](https://arxiv.org/abs/2610.13421).

**[I] The economic flip is qualified:** agents make explicit scopes, schemas, state transitions, migrations and effect descriptions cheaper to author. They do not make a specification correct, an external service transactional, or an uncooperative operation cancellable. The runtime earns its place by enforcing the declared boundary independently of generated code.

### The substrate map

| Substrate | Checked capability | Consequence for agent-written code |
|---|---|---|
| OS process / resource boundary | **[F]** Deno's own guidance combines runtime restrictions with OS isolation for untrusted code; native code and subprocesses can escape JS-level restrictions. [Deno](https://docs.deno.com/runtime/fundamentals/security/) | **[I]** A resource scope needs an authority that outlives the guest. A finally block cannot be the crash-recovery mechanism. |
| V8 / workerd | **[F]** V8's heap sandbox contains memory-corruption propagation; Dynamic Workers separately control bindings and outbound networking. [V8, 4 April 2024](https://v8.dev/blog/sandbox), [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/) | **[I]** Engine memory isolation, application capabilities and business-effect policy are separate contracts. |
| Bun / Deno | **[F]** Bun 1.4, 20 August 2026, reports 1,517 added Node tests and over 2,900 issue fixes. Deno permissions apply to a thread's code collectively, rather than independently per imported module. [Bun](https://bun.sh/blog/bun-v1.4), [Deno](https://docs.deno.com/runtime/fundamentals/security/) | **[I]** Compatibility and speed belong to runtime maintainers. A dependency's TypeScript signature does not confine its I/O. |
| BEAM | **[F]** Erlang processes have isolated heaps/mailboxes; its documentation gives 327 words for a newly spawned process, including heap/stack. [Process guide](https://www.erlang.org/doc/system/eff_guide_processes.html) | **[I]** Lightweight waiting and supervision are established. Compare populated histories and working state, not an empty process against an agent transcript. |
| JVM / Orleans / Akka | **[F]** JDK 26 includes structured concurrency as a sixth preview. Orleans serializes turns per activation, with request non-reentrancy by default; Akka Typed stops an unsupervised actor on an unexpected exception. [JDK 26](https://www.oracle.com/java/technologies/javase/26all-relnotes.html), [Orleans](https://dotnet.github.io/orleans/docs/grains/request-scheduling/), [Akka](https://doc.akka.io/libraries/akka-core/current/typed/fault-tolerance.html) | **[I]** Virtual threads, actor supervision and durable recovery solve different problems. None makes external child jobs disappear automatically. |
| Wasm components / Wasmtime | **[F]** Components give typed interaction contracts; Wasmtime offers fuel and epoch interruption, with trapping or yielding. [Component model](https://component-model.bytecodealliance.org/design/why-component-model.html), [interruption](https://docs.wasmtime.dev/examples-interrupting-wasm.html) | **[I]** Suitable foundations for replaceable generated computation. An imported function still needs an application-specific authority and lifetime contract. |
| Effect fibers | **[F]** The runtime interprets Effects, yields cooperatively and manages async work/finalizers. TestClock supplies controlled time. [Runtime](https://effect.website/docs/v4/runtime), [TestClock](https://effect.website/docs/v4/testing/testclock) | **[I]** Good structure for honest application code. Arbitrary JS inside a thunk can still perform ambient I/O or monopolize the host; the effect type is not a sandbox. |

## 2. Infinity, examined below the headline

### 2.1 What the implementation actually does

**[F]** Infinity is an Apache-2.0 Rust research framework from Hydro, publicly introduced on **23 October 2026** by Shadaj Laddad. Its launch post describes saved conversation histories as stackless continuations and identifies scheduling policy, event authenticity and tree compaction as open questions. **[I]** Its distinctive contribution is the combination of an LLM-facing asynchronous conversation discipline, a tool callback protocol and interchangeable local/serverless drivers. It is not an invention of lightweight processes. [Launch post](https://aws.amazon.com/blogs/opensource/introducing-infinity-a-runtime-for-extreme-agent-concurrency/), [README](https://github.com/hydro-project/infinity/blob/1abc6fcff1f186124f924b56aa92c3a3684c90c5/README.md).

**[F]** A slice loads history, prepares incoming messages, streams model output, commits a turn and dispatches at most one asynchronous tool call. Synchronous tools may loop through additional completions inside that slice. Model inference and the dispatch acknowledgement still involve awaited operations. **[I]** “Never blocks” means it does not retain an agent continuation while an asynchronous tool works; it is not a hard upper bound on completion time or an absence of network waits. [Step implementation](https://github.com/hydro-project/infinity/blob/1abc6fcff1f186124f924b56aa92c3a3684c90c5/crates/infinity-agent-core/src/system/thread.rs#L410), [completion loop](https://infinity.hydro.run/docs/infinity-runtime/low-level/completion-loop/).

**[F]** User inputs, results, timers and reports enter a common message path. Subscription events normally create temporary children, keeping unrelated event work out of the parent's context; associative events, such as command output, are handled inline. Model APIs see valid tool-call/result structure through synthetic events. **[I]** This model-facing representation is useful engineering beyond “use an actor mailbox”: an LLM is not an ordinary deterministic message handler. [Architecture](https://infinity.hydro.run/docs/infinity-runtime/architecture/), [event preparation source](https://github.com/hydro-project/infinity/blob/1abc6fcff1f186124f924b56aa92c3a3684c90c5/crates/infinity-agent-core/src/event_processor.rs#L889).

**[F]** The AWS deployment uses SQS FIFO message groups for per-thread serialization, Aurora DSQL for histories, DynamoDB for deduplication state, and SQS delays/EventBridge for timers. **[I]** The durable behavior comes from that whole composition, not from retaining a Rust future. [Serverless architecture](https://infinity.hydro.run/docs/infinity-runtime/serverless/architecture/).

### 2.2 The 75k claim: useful evidence, different experiment

**[F]** The launch post says the actual benchmark ran **80,000 agents and 3.2 million scripted completions on one AMD EPYC 9R14 thread**, using in-memory stores. It extrapolates roughly 100–103 KB per idle history to approximately 75,000 histories in 8 GB, the RAM of a Raspberry Pi 5. It does not report that workload executed on the Pi. [Benchmark description](https://aws.amazon.com/blogs/opensource/introducing-infinity-a-runtime-for-extreme-agent-concurrency/).

**[F]** The checked-in benchmark uses an in-process ScriptedModel, twenty synthetic tool-calling turns by default, approximately 1.2 KB assistant completions, a synthetic tool and RSS sampling after agents idle. It exercises real queue/runtime plumbing but no shell, actual model inference, network tools or database fleet. [agent_scale.rs](https://github.com/hydro-project/infinity/blob/1abc6fcff1f186124f924b56aa92c3a3684c90c5/crates/infinity-agent-core/examples/agent_scale.rs#L1).

**[I]** This demonstrates that histories dominate dormant-agent memory. It does not demonstrate 75k active coding environments, 75k simultaneous inference requests, an end-to-end cost advantage over Durable Objects, or less memory than comparably populated BEAM actors. Storage, tool processes and inference do not become free when the agent loop exits. No independent benchmark was run here.

### 2.3 What RAP adds, and what it leaves open

**[F]** RAP invokes a tool over HTTP with a callback destination. Results arrive later without retaining the original agent request; subscriptions can produce repeated events. Its MCP proxy can keep the agent dormant while the proxy waits on an unchanged MCP server. **[I]** The waiting obligation moves to the tool/proxy infrastructure; it is not eliminated. [RAP overview](https://infinity.hydro.run/docs/rap/spec/overview/), [MCP compatibility](https://infinity.hydro.run/docs/rap/about/mcp-compatibility/).

**[F]** Current MCP must be compared, not only the 2025 synchronous baseline. The **2026-07-28 Tasks extension** supports deferred execution, result retrieval and subscribed task notifications. Cancellation expresses cooperative intent and may finish in another terminal state. **[I]** RAP's callback-to-a-dormant-runtime shape remains a useful distinction, but “MCP cannot represent asynchronous work” is obsolete. [Current Tasks extension](https://tasks.extensions.modelcontextprotocol.io/), [SEP-2663](https://tasks.extensions.modelcontextprotocol.io/seps/2663-tasks-extension).

**[F]** RAP explicitly makes cancellation and thread closure advisory: servers may ignore them, notifications can be lost, and implementations need independent expiration/cleanup. Tool-result processing should tolerate duplicate deliveries and reject unmatched results. **[I]** This is where a useful lifetime contract could sit; it cannot be claimed as a guarantee supplied by RAP today. [Cancellation](https://infinity.hydro.run/docs/rap/spec/basic/tool-cancellation/), [closure](https://infinity.hydro.run/docs/rap/spec/basic/thread-closure/), [results](https://infinity.hydro.run/docs/rap/spec/basic/tool-result/).

**[F]** RAP even specifies migration of stateful tool servers, with a needsMigration manifest field and a /migrate handshake. **[I]** “Move the agent and its tools” is therefore not an untouched extension either. [Migration specification](https://infinity.hydro.run/docs/rap/spec/basic/migration/).

### 2.4 Code audit: promises to qualify, not alleged exploits

| Source observation | Interpretation / test required |
|---|---|
| **[F]** Thread.step_no_defer commits history before execute_action_with_error_result dispatches a tool. [thread.rs](https://github.com/hydro-project/infinity/blob/1abc6fcff1f186124f924b56aa92c3a3684c90c5/crates/infinity-agent-core/src/system/thread.rs#L562) | **[I]** Correct ordering prevents a result preceding its recorded call. Crash between commit and dispatch still requires recovery logic; an outbox/dispatch crash test is necessary before assuming eventual invocation. This inspection did not establish an end-to-end defect. |
| **[F]** HistoryManager.sync appends messages, then separately updates processed IDs; the latter result is discarded in this method. [event_processor.rs](https://github.com/hydro-project/infinity/blob/1abc6fcff1f186124f924b56aa92c3a3684c90c5/crates/infinity-agent-core/src/event_processor.rs#L627) | **[I]** The traits do not expose one atomic transaction covering both stores. Verify failure/redelivery behavior for each backend; stable IDs and FIFO alone are not a proof of external exactly-once effects. |
| **[F]** The local driver tears down idle workers and recreates them on input, with tests covering subscriptions waking idle threads. [driver.rs](https://github.com/hydro-project/infinity/blob/1abc6fcff1f186124f924b56aa92c3a3684c90c5/crates/infinity-agent-core/src/system/local/driver.rs#L220) | **[I]** This is actual lifecycle machinery, not merely one permanently parked Tokio task per dormant history. Pending tools/observers can affect the active worker's lifetime. |
| **[F]** The provider guide says runtime-level inference timeouts are not supplied; provider implementations classify failures and implement their own stall handling. [Providers](https://infinity.hydro.run/docs/infinity-runtime/model-providers/) | **[I]** A bounded-slice diagram is not an enforceable per-agent CPU/time budget. |
| **[F]** Per-thread tools/configuration can be reconstructed through ThreadConfigSource; the guide distinguishes root-wide and leaf-specific capability sets. [Configuration](https://infinity.hydro.run/docs/infinity-runtime/agent-systems/dynamic-configuration/) | **[I]** This supports authority selection. It does not confine arbitrary Rust tool code or provide typed effect enforcement across network services. |
| **[F]** rap-test-servers is explicitly unpublished test support for in-process stub servers used by UI/e2e suites. [Source](https://github.com/hydro-project/infinity/blob/1abc6fcff1f186124f924b56aa92c3a3684c90c5/crates/rap-test-servers/src/lib.rs#L1) | **[I]** Existing tests deserve reuse. A public lifecycle failure corpus could add coverage, but a new general testing platform would be excessive. |

### 2.5 Compared with the closest runtimes

| Prior art | What it already supplies | Infinity's useful difference / limit |
|---|---|---|
| Erlang/OTP | **[F]** Lightweight processes; module replacement can retain current and old code concurrently. [Processes](https://www.erlang.org/doc/system/eff_guide_processes.html), [code loading](https://www.erlang.org/doc/system/code_loading.html) | **[I]** Transcript-as-continuation and RAP package LLM-specific asynchronous events. Infinity does not replace BEAM isolation, preemptive scheduling or OTP release management. |
| Orleans | **[F]** Virtual-actor activation and turn scheduling; default non-reentrancy avoids interleaved state mutation, with explicit reentrancy options. [Scheduling](https://dotnet.github.io/orleans/docs/grains/request-scheduling/) | **[I]** Infinity presents an agent-specific conversation/tool lifecycle over a similar activation idea. Actor activation itself is established. |
| Akka | **[F]** Explicit actor supervision and restart strategies; Typed's default failure behavior is stop. [Fault tolerance](https://doc.akka.io/libraries/akka-core/current/typed/fault-tolerance.html) | **[I]** Infinity's parent/child context tree is not automatically an OTP/Akka failure-containment tree. Context inheritance and supervision must be specified separately. |
| Durable Objects / Agents | **[F]** Durable identity/storage, activation lifecycle and alarms already exist; hibernation has eligibility conditions. [DO lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/), [state API](https://developers.cloudflare.com/durable-objects/api/state/) | **[I]** RAP is useful as a portable tool-side contract. Merely storing a transcript in SQLite and waking on callbacks adds little. |
| Golem | **[F]** Durable execution, explicit upgrades, snapshots and failed-update fallback; 1.6 adds runtime-enforced read-only methods and dynamic discovery. [Updates](https://learn.golem.cloud/v1.6/how-to-guides/common/golem-update-running-agents), [1.6 release, October 2026](https://golem.cloud/blog/golem-1-6-agents-tools-and-artifacts/) | **[I]** Infinity focuses on agent history rather than recovering an arbitrary application continuation. A new “durable, upgradable Wasm agent” overlaps Golem directly. |
| Temporal | **[F]** Durable workflows, activity boundaries, history replay, versioning and cancellation scopes. Activity cancellation still needs cooperation/heartbeats. [Definition](https://docs.temporal.io/workflow-definition), [cancellation](https://docs.temporal.io/develop/typescript/workflows/cancellation) | **[I]** Infinity makes events and conversation trees native to the harness. It does not supersede durable orchestration or transactional effect handling. |

**[I] What a TS/Workers counterpart would add:** a RAP adapter mapping a thread to DO SQLite, callbacks to serialized mailbox events, timers to alarms, and tools to separately operated services. It could make existing RAP tools usable from Workers agents and expose portable qualification fixtures.

**[I] What it would not add:** a new concurrency model, arbitrary-stack durability, guaranteed tool cancellation, or an inference-cost breakthrough. A DO processing model output is active during the stream; the callback boundary permits dormancy after the turn and dispatch complete. Keep inbox/outbox intent, deduplication and callback authentication in the host, and qualify interleavings rather than assuming a DO serializes a whole async turn.

**[F]** Infinity already provides a **TypeScript “building a runtime” tutorial**, including a production checklist for durable storage, FIFO, deduplication and lifecycle notifications. **[I]** A port is an adapter contribution unless it proves an additional contract. [Tutorial](https://infinity.hydro.run/docs/rap/using-rap/building-a-runtime/).

## 3. Where rigor actually flips

| Technique | What becomes cheaper | The independent runtime check | Boundary the check cannot cross |
|---|---|---|---|
| Supervision / structured concurrency | **[I]** Agents annotate ownership and generate cleanup adapters for every task and tool resource. | **[I]** Host-owned scope graph, bounded restart policy, resource inventory after teardown. | **[I]** Restarting code cannot reverse an email or stop an unrelated server that ignores cancellation. |
| Typed capabilities | **[I]** Explicit import/service manifests become affordable even for tiny modules. | **[F]** Dynamic Workers bindings/outbound controls, component imports or SES endowments can restrict access. [Workers](https://developers.cloudflare.com/dynamic-workers/), [Endo](https://github.com/endojs/endo/tree/master/packages/import-bundle) | **[I]** TypeScript types and Effect's R parameter alone do not remove ambient authority. A tool description is not an enforced grant. |
| Deterministic scheduling | **[I]** Agents generate scenarios and invariants rather than manually handcrafting one failure schedule. | **[F]** Effect simulation kernels and Rust Shuttle already control schedules and replay paths. [Effect kernel](https://github.com/systemfsoftware/systemfsoftware/tree/main/packages/sim/effect-sim-kernel), [Shuttle](https://docs.rs/shuttle/latest/shuttle/) | **[I]** A bounded schedule search is evidence within a bound, not a universal concurrency proof. External I/O must be modeled or rejected. |
| Effects as values | **[I]** Models write verbose named Commands with explicit serializable arguments. | **[I]** A host compares observed emitted Commands and checks every actual governed dispatch against that description. | **[I]** A label attached to an arbitrary Effect does not describe everything its thunk can do. |
| Live upgrade | **[I]** Agents author migrations and version adapters per state shape. | **[I]** Validate stored states, rehearse traces, compare effect arguments, pin callbacks to epochs and atomically activate. | **[I]** Passing old examples cannot establish new business intent, reversibility of external effects, or correctness on unseen states. |
| Resource management | **[I]** Explicit leases, retention roots and reconcile hooks become routine boilerplate. | **[I]** Tool-side expiry/fencing plus inventory reconciliation, independent of the sleeping/failed agent. | **[I]** A host cannot collect a resource whose creation it never mediated or whose identity the provider cannot reconcile. |

**[F] Important prior-art correction:** @systemfsoftware/effect-sim-kernel **1.0.0 was published 1 October 2026**. Its README covers scheduling decisions, PCT/search, shrinking, interruption at chosen steps, deadlocks, real-timer escapes and replay. It hooks Effect internals and names 4.0.0 as its qualified version. Its companion conformance-spec includes linearizability and interruption-release checks; differential-spec compares implementations under explored schedules. [Registry](https://registry.npmjs.org/@systemfsoftware/effect-sim-kernel), [kernel](https://github.com/systemfsoftware/systemfsoftware/tree/main/packages/sim/effect-sim-kernel), [conformance](https://github.com/systemfsoftware/systemfsoftware/tree/main/packages/sim/conformance-spec), [differential](https://github.com/systemfsoftware/systemfsoftware/tree/main/packages/sim/differential-spec).

**[I] Therefore:** do not pitch “Antithesis for Effect,” “interrupt every fiber step,” or “model checking for agent-written TS” as an empty category. A version-qualified adapter or an application's authoritative invariant may be valuable; another scheduler is not the gap.

### A runtime designed for code written by agents

**[I]** Its stable kernel should be smaller than the code it admits:

1. Generated modules receive explicit capabilities, code identity, input/output schemas, resource limits and a scope. Generated code does not edit the host's policy, capture log or acceptance rule.
2. Persist domain state and pending obligations separately from ephemeral fibers. Outstanding subscriptions, approvals and jobs are typed records, not facts remembered only by an LLM summary.
3. Tool dispatch is mediated. Record an operation's durable identity before delivery; distinguish an accepted request, completed effect, ambiguous outcome and completed cleanup.
4. Treat cancellation, disposal, timeout, crash and upgrade as different state transitions. Every boundary states whether it stops future calls, waits for completion, expires a resource or merely requests cooperation.
5. Runtime checks fail explicitly outside their coverage: unobserved command internals, missing trace entries, changed schemas, unmanaged promises, unknown resources and incomplete migrations.
6. Produce replayable evidence and accept that policies evolve. An owner can authorize a deliberate behavior change; generated code cannot silently redefine the check that approves its own change.

**[I]** This is an execution contract assembled from existing mechanisms, not a proposal for a new language or general-purpose OS.

## 4. Self-extension: what belongs in the runtime

**[F] bb identification:** the best match for the brief's “bb” is **getbb.app / get-bb/bb**, not babashka. Its explicit agent-authored plugin workflow matches the prompt closely. Babashka remains relevant historical substrate: SCI exposes a configured symbol/class environment and can restrict interpreted programs. [bb release history](https://getbb.app/changelog), [SCI](https://github.com/babashka/sci).

**[F]** Pi supports TypeScript extensions, dynamic tool registration and runtime reload. Its current documentation explicitly says extensions share Pi's OS permissions; code after an awaited reload still executes in the old closure and should treat that handler as terminal. **[I]** Agent authorship has made extension production ordinary; it has not made in-process extension execution a capability boundary. [Pi extension documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).

**[F]** bb already snapshots plugin database/settings/storage/schedules/secrets/registration before activation and restores on activation failure. Its public testing harness exercises atomic reload, disposal, stale API rejection, service aborts, storage and schema-RPC behavior. **[I]** “Transactional plugin installation for an agent-grown app” is substantially implemented prior art. [Configuration](https://github.com/get-bb/bb/blob/main/docs/configuration.md), [testing guide](https://github.com/get-bb/bb/blob/main/plugins/bb-guide/skills/bb-plugin-authoring/references/testing.md).

**[I] Historical pattern map:**

| Pattern / lineage | What to preserve | Acceptance check at the runtime boundary |
|---|---|---|
| Lisp/Smalltalk images; Emacs extensions | Inspect a live world and replace behavior locally. | Version identity, explicit persistent-state migration and confined authority. An image alone cannot declare its outstanding external obligations. |
| HyperCard / spreadsheets | A stable host interprets small user-defined behaviors over shared data. | Schema and dependency validation, bounded recalculation, explicit escape into external effects. |
| Glamorous Toolkit / moldable development | Generate domain-specific inspectors and actions where the data already lives. | Separate read-only views from actions; constrain each view's resource use and permitted reads. **[F]** GT documents thousands of contextual views and live-object-driven tooling. [GT guide](https://book.gtoolkit.com/how-to-get-started-with-moldable-developme-lor2271nbpvdqfx46d0prlk2). |
| Pi / bb | Let an agent install tools and UI inside the user's existing work surface. | Activation transaction, scoped resources, stale-generation rejection, lifecycle qualification. |
| Components / Extism / SES | Make new behavior a separately admitted module with explicit host imports. | Validate interfaces/imports, limit execution and check the host operation at dispatch. **[F]** Extism already exposes host functions and a JS SDK. [Host functions](https://extism.org/docs/concepts/host-functions/), [JS host](https://extism.org/docs/quickstart/host-quickstart/). |

**[F]** Erlang retains current and old module code; loading another version can purge processes still using old code. Golem explicitly distinguishes replay-compatible automatic updates from snapshot-based manual migration. **[I]** Hot loading, state migration and safe external-effect continuity are different operations. [Erlang](https://www.erlang.org/doc/system/code_loading.html), [Golem updates](https://learn.golem.cloud/v1.6/how-to-guides/common/golem-update-running-agents).

**[I] Recommended extension transaction:** stage immutable code → validate imports/schemas → instantiate without production write authority → migrate a copied state → rehearse selected histories → quiesce or version-route pending work → commit code/state/authority epoch → retire old resources. Failed activation can restore local state; external effects need their own reconciliation contract. An agent may propose a new module, but must not add a privileged host import merely by editing its manifest.

**[I] Where these patterns stop flipping:** generating the migration is cheaper; choosing the valid migration is not free. Live software also needs user-understandable state, shared data and ownership. Ink & Switch's June 2025 essay identifies composition and communal creation as central, rather than reducing malleability to an AI code generator. [Malleable Software](https://www.inkandswitch.com/essay/malleable-software/).

## 5. Eighteen ideas, searched before retention

**[I]** These include fresh combinations and explicit rechecks of catalogue material. “Retain” means a bounded experiment, not an established market.

| # | Candidate and rigor mechanism | Closest checked prior art / killer | Verdict |
|---|---|---|---|
| 1 | TS Infinity: transcript actors waking from callbacks. | **[F]** Infinity has a TS runtime guide; Workers Agents/DOs cover activation. [Guide](https://infinity.hydro.run/docs/rap/using-rap/building-a-runtime/), [DO lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/). | **[I] Reject.** A protocol adapter, not a new runtime opportunity. |
| 2 | Agent-aware priority scheduler: foreground work outranks subscription storms. | **[F]** Infinity calls scheduling policy open research; Temporal already ships task-queue priority/fairness. [Infinity launch](https://aws.amazon.com/blogs/opensource/introducing-infinity-a-runtime-for-extreme-agent-concurrency/), [Temporal](https://temporal.io/changelog/priority-fairness-generally-available). | **[I] Reject standalone.** Contribute a measured policy upstream; no demonstrated missing queue. |
| 3 | Durable OTP for generated TS actors, with explicit restart budgets. | **[F]** Orleans, Akka, Effect cluster and Workers agents supply actor/runtime primitives. [Orleans](https://dotnet.github.io/orleans/docs/grains/request-scheduling/), [Effect cluster](https://effect.website/docs/v4/api/effect/cluster/EntityAddress). | **[I] Reject.** More generation does not create an unoccupied actor-framework category. |
| 4 | Controlled Effect scheduler with race exploration and fiber-step interruption. | **[F]** effect-sim-kernel and conformance-spec cover the proposal closely. [Kernel](https://github.com/systemfsoftware/systemfsoftware/tree/main/packages/sim/effect-sim-kernel). | **[I] Reject.** Direct prior art, including the appealing interruption demo. |
| 5 | Agent-guided concurrency bug hunter over a conventional scheduler. | **[F]** REINS already does hypothesis-guided scheduling; Shuttle supplies controlled Rust testing. [REINS](https://arxiv.org/abs/2610.13421), [Shuttle](https://docs.rs/shuttle/latest/shuttle/). | **[I] Reject generic.** R6/03 already narrowed deterministic testing to contract fixtures. |
| 6 | Runtime-grown Wasm plugins with typed host interfaces. | **[F]** Extism, WASI components and Golem already provide substantial substrate. [Extism](https://extism.org/docs/concepts/host-functions/), [WASI](https://wasi.dev/releases/wasi-p3), [Golem 1.6](https://golem.cloud/blog/golem-1-6-agents-tools-and-artifacts/). | **[I] Reject as new engine.** Use an incumbent. |
| 7 | Compile Effect service types into a permission-enforcing runtime. | **[F]** SES endowments, Deno permissions/broker and Dynamic Worker bindings already enforce capabilities. [Endo](https://github.com/endojs/endo/tree/master/packages/import-bundle), [Deno](https://docs.deno.com/runtime/fundamentals/security/). | **[I] Reject broad claim.** Types miss ambient effects; an enforcement adapter is a feature. |
| 8 | Conserved child-agent budgets checked at every governed call. | **[F]** SatGate has attenuated tokens, budgets and cascade revocation. [SatGate](https://cloud.satgate.io/docs/reference/macaroons). | **[I] Reject.** R3/04 and R6/06 already found this crowded. |
| 9 | Fault-triggered host API growth checked against a reference runtime. | **[F]** Prior rounds verified Deno's compatibility-agent workflow; runtime compatibility is actively maintained by owners. [Summary §11](../RESEARCH-SUMMARY.md#11-the-kill-list), [Deno source](https://github.com/denoland/deno). | **[I] Reject.** Explicit kill-list item; no resurrection. |
| 10 | Full JS replay runtime for generated applications. | **[F]** Temporal, Golem, Pure Effect, and Hale already occupy replay; Hale compares wire payloads and journal arguments. [Hale](https://hale-lang.org/docs/systems/replay/), [Pure Effect](https://github.com/aycangulez/pure-effect). | **[I] Reject generic.** New VM unnecessary. |
| 11 | Versioned state migrations plus hot actor replacement. | **[F]** Golem has automatic/manual updates; XState v6 alpha adds machine-version migration surfaces. [Golem](https://learn.golem.cloud/v1.6/how-to-guides/common/golem-update-running-agents), [XState](https://dev.stately.ai/docs/xstate/v6/persist-and-restore-actors). | **[I] Reject broad feature.** Retain only payload/obligation qualification inside #16/#17. |
| 12 | Atomic installation and rollback for agent-written plugins. | **[F]** bb already snapshots plugin-owned host state and restores failed activation. [bb configuration](https://github.com/get-bb/bb/blob/main/docs/configuration.md). | **[I] Reject.** Especially strong direct prior art. |
| 13 | Static semantic effect diff for large agent PRs. | **[F]** effect-analyzer has IR-level structural diff and audit gates. [Analyzer](https://github.com/jagreehal/effect-analyzer). | **[I] Reject.** Differentiate dynamic payloads, not another structural visualization. |
| 14 | Generate contextual runtime inspectors from domain schemas. | **[F]** GT's moldable agent harness and contextual views already do this; bb/Pi offer UI extension surfaces. [GT](https://gtoolkit.com/), [Pi](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md). | **[I] Reject generic.** Specific inspectors are useful application features. |
| 15 | Keep subscriptions/budgets/approvals outside LLM compaction, with referential-integrity checks. | **[F]** Infinity has explicit subscription state; issue #56 requests including it in summaries. Deuz has versioned durable run state. [#56](https://github.com/hydro-project/infinity/issues/56), [Deuz operations](https://deuz-sdk.tech/docs/modules/operations). | **[I] Fold into #17.** Deterministic ownership records matter; a new memory/compaction engine does not follow. |
| 16 | Replay recorded Messages through candidate code and compare emitted Command identities, multiplicity and arguments. | **[F]** Foldkit already records Messages/Command args; Pure Effect records results but documents argument blindness; effect-analyzer is static, Hale is another language. [Foldkit](https://foldkit.dev/core/devtools), [Pure Effect](https://github.com/aycangulez/pure-effect#what-a-replay-cannot-check), [Hale](https://hale-lang.org/docs/systems/replay/). | **[I] Retain B.** Narrow production-corpus adapter, adjacent to R9 replay diff. |
| 17 | Durable remote scopes: every tool job/subscription has a lease, owner epoch and reconcile hook. | **[F]** RAP closure/cancellation are advisory; #45 reports orphan subscriptions. K8s GC, Temporal cancellation and Deuz run leases are close. [#45](https://github.com/hydro-project/infinity/issues/45), [K8s](https://kubernetes.io/docs/concepts/architecture/garbage-collection/), [Deuz](https://deuz-sdk.tech/docs/modules/operations). | **[I] Retain A, ONE pick.** R6/03 narrowed to the public asynchronous-tool boundary. |
| 18 | Qualify generated extensions through reload/failure/dispose sequences and independently inspect leaked work. | **[F]** bb already has lifecycle testing; Pi/Pi-Web have documented historical leaks across host lifecycle paths. [bb harness](https://github.com/get-bb/bb/blob/main/plugins/bb-guide/skills/bb-plugin-authoring/references/testing.md), [Pi-Web #546](https://github.com/agegr/pi-web/issues/546). | **[I] Retain C conditionally.** Public corpus/adapters only; substantial chance it is merely upstream test work. |

### Earlier ideas whose status changed

- **[I] R6/03 distributed scale → A:** [run-resource ownership and collection](../catalogue/R6-flip.md#leases-and-distributed-garbage-collection-run-scoped-resource-ownership-and-collection--the-one-bet) gains a concrete runtime-specific entry point: RAP's advisory close contract plus Infinity #45. This is narrower qualification of an existing survivor, not a new GC algorithm.
- **[I] R3/03 and R3/04 → A:** [generated-software GC and Lease OS](../catalogue/R3-moonshots2.md) lose their OS/platform framing. The feasible unit is a mediated job/subscription with a recoverable external identity.
- **[I] R9/03 replay diff → B:** [changing code against an existing journal](../catalogue/R9-deep.md#4-replay-diff-edit-a-running-typescript-program-and-see-what-the-edit-does-to-its-past) expands from names/order to payload comparison. Pure Effect, Temporal and Golem reveal why replay compatibility alone is insufficient.
- **[I] R2/01 live upgrades → C:** [agents submitting checked upgrades to running programs](../catalogue/R2-moonshots.md) is now substantially covered by bb/Golem. Only qualification across embedding and teardown boundaries remains plausible.
- **[I] R6/03 deterministic integration simulation:** [fault-contract suites](../catalogue/R6-flip.md#deterministic-simulation-testing-fault-contract-suites-for-agent-integration-boundaries) remain the right implementation technique for A/C. Generic simulation is even more crowded than the catalogue suggested.

## 6. Finalist A — remote lifetime scopes for asynchronous tools

**[I] One sentence:** make a remote tool's job or subscription an explicitly owned, expiring resource that cannot regain authority after its owning scope closes.

**[I] 30-second demo:** start a shell-output subscription and a webhook-style watcher; kill the runtime before it sends close; the tool-side supervisor expires the old scope, reports the exact retained/reaped obligations, and refuses a delayed invocation from that epoch. Reopen a new session: new work runs, the old callback is recorded as stale, and no old watcher reattaches itself.

**[F] Beneficiary and pain:** Infinity tool/server authors have an open **27 June 2026** issue, **#45**, stating active subscriptions survive ungraceful shutdown. The requested recovery includes identifying incomplete commands and sending a terminal event on server boot. At access time it had **zero reactions**. **[I]** This is concrete correctness pain and a named maintainer audience, but weak evidence of broad demand or monetary savings. [Issue #45](https://github.com/hydro-project/infinity/issues/45).

**[F] Closest prior art:** RAP already recommends TTL/independent cleanup; Kubernetes has ownership/finalizers; Temporal has cancellation scopes and heartbeat-based activity cancellation; Deuz has run leases, drain/cancel and fenced commits. **[I] Gap hypothesis:** these do not, in the checked surfaces, supply one reusable RAP tool-side contract tying a subscription and its actual external process/resource to durable owner identity, independent expiry and stale-generation rejection across runtimes. This must be checked against maintained implementations before claiming a missing package. [RAP closure](https://infinity.hydro.run/docs/rap/spec/basic/thread-closure/), [Temporal cancellation](https://docs.temporal.io/develop/typescript/workflows/cancellation), [Deuz operations](https://deuz-sdk.tech/docs/modules/operations), [K8s finalizers](https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/).

**[I] Contract and independent check:**

- A trusted coordinator stores scope ID, monotonically increasing epoch, desired lifetime, retention roots, resource IDs and unresolved outcomes. An opt-in adapter validates them at the tool boundary. Do not silently add nonstandard RAP fields and call the result standard compliance.
- The tool persists create intent and a stable operation/resource identity before acknowledging acceptance. It can enumerate its resources after restart and reconcile an acknowledgement lost in transit.
- Closed epochs reject new governed creates. Existing jobs transition through closing/expired/reconciled states; a kill acknowledgement is distinct from observed termination. Late results do not resurrect a closed scope.
- Test loss, duplication, restarts and delayed old invocations against an external resource inventory and a small state-machine model. Preserve explicitly retained resources. Expose ambiguous creates/deletes instead of declaring collection complete.

**[I] The hibernation trap:** an absent agent process is not a dead scope. A durable root decides continued ownership while the agent sleeps; renewal cannot depend on a heartbeat from the dormant agent. A tool-side timer enforces expiry, with renewals from a coordinator/alarm or an explicitly authorized long lease. Control traffic and retained records cost something. During partition, expiry can stop legitimate work; continuing it can retain abandoned work. The policy must choose visibly.

**[I] How an agent could game it:** bypass the mediated create API; create an unrelated process/service; lie about resource IDs; retain every resource; write directly using a credential outside the broker. Preventing those requires authority confinement and independently observed inventory. V1 covers cooperative tools and a controlled subprocess supervisor, not arbitrary provider resources or retroactive reversal of external writes. Epoch checks at callback ingestion alone do not stop an old tool causing an external effect.

**[I] Why better models help rather than remove it:** a better model still cannot execute a finally block after the host dies or decide an unreachable server's outcome. More autonomous tools increase the population of external obligations; generating provider adapters gets easier.

**[I] Why the owner would not simply erase it:** Infinity should adopt the basic fix; Cloudflare could own a Workers-only version. An independent OSS project survives only as a shared tool-side contract and failure corpus used by multiple runtimes. If all useful logic fits the sandbox server's startup cleanup, contribute it there and stop. There is no defensible standalone “lease OS” claim.

**[E] 2–3-week version:** days 1–3 specify the scope state machine and integration with RAP; days 4–7 implement SQLite-backed tool-side intent/lease storage and a controlled local subprocess adapter; days 8–11 add restart inventory, stale-epoch rejection and terminal events; days 12–15 add a Worker/DO-shaped coordinator adapter and a deterministic HTTP fault driver. One machine, no hosted service, no inference dependency. Durable sleep and explicit retention must work before a showcase.

**[I] Expert reply that kills it:** “RAP already tells tools to implement TTLs; our existing job service and startup reconciliation solve #45 without your protocol.”

**[E] 1–2-day kill test:** implement the #45 scenario and one timer/watch subscription using existing RAP hooks plus plain TTLs. Exercise at least 100 seeded schedules covering crash-before-ack, lost callback, cancel/result race, tool restart and delayed old epoch. Keep the abstraction only if it eliminates duplicated lifecycle logic across both adapters and distinguishes retained, expired and unknown resources correctly. Require interest from two independent tool maintainers before expanding. If ordinary TTL plus boot reconciliation meets the contract, upstream that implementation and abandon the extra layer.

## 7. Finalist B — payload-aware Command replay across code changes

**[I] One sentence:** replay production Messages through an agent PR and show the changed outward Command multiset and payloads before granting production effects.

**[I] 30-second demo:** replay a recorded checkout on old/new update functions. Both return the same success screen, but the candidate emits SendEmail twice or changes Refund.amount from 10 to 1000. Show the exact Message and arguments that introduced the change; export the short history as a Story test.

**[F] Closest prior art is closer than the brief assumed:**

- Foldkit already records Model, Messages, named Commands/arguments and lifecycle results. Its Command representation contains name, optional args and an arbitrary Effect; Story/Scene substitute results through recorded message-mapping metadata. [Command implementation](https://github.com/foldkit/foldkit/blob/main/packages/foldkit/src/command/index.ts), [DevTools integration](https://github.com/foldkit/foldkit/blob/main/packages/foldkit/src/runtime/devToolsIntegration.ts).
- Pure Effect already records production runs and replays them offline. Its documentation explicitly says replay does not assert Command arguments. **[M]** The experiment below confirms this on 0.23.0. [Replay limits](https://github.com/aycangulez/pure-effect#what-a-replay-cannot-check).
- Temporal permits changing Activity/Child Workflow input parameters while retaining replay compatibility. Golem documents that automatic-update HTTP replay compares method, URL and headers, omitting the request body. These are compatibility semantics, not defects. [Temporal](https://docs.temporal.io/workflow-definition), [Golem lifecycle](https://learn.golem.cloud/v1.6/concepts/agent-lifecycle).
- effect-analyzer already compares Effect structure; Hale already has payload-aware runtime replay/diff, in its own language. **[I]** Neither generic semantic diff nor generic effects-as-values replay is novel. [Analyzer](https://github.com/jagreehal/effect-analyzer), [Hale](https://hale-lang.org/docs/systems/replay/).

**[I] Precise gap:** a Foldkit-native, production-corpus gate comparing actual candidate-emitted Command args/multiplicity, handling recorded completion identities and schema coverage, with Story-test export. No exact maintained package was located in the GitHub/npm/documentation searches. This is a small adaptation and qualification opportunity; its owners could ship it.

**[F] Pain evidence:** the replay limits are documented by three implementers, and the measurement exhibits the blind spot. **[I]** That establishes a technical limitation, not user demand for this specific gate. The likely beneficiary is a maintainer accepting agent changes to a command-driven checkout/admin application. No public Foldkit customer incident or reaction-backed demand for cross-version Command diff was found. Value confidence is therefore lower than the demo quality.

**[I] Check and coverage:** retain an input model/schema version, ordered inbound Messages, Command invocation/completion identities and canonical arguments. Run candidate update code in an isolated environment without production bindings/outbound access, with fixed recorded nondeterministic inputs. Compare each causal Message's emitted names, counts, keys and complete declared args. Commands in a batch may be concurrent, so do not invent order from array position. If a changed/new Command lacks a compatible recorded result, stop that causal suffix and mark it unexplored; do not feed an old result to an unrelated operation.

**[I] Important anti-gaming limit:** Command metadata can lie. Changing the hidden Effect body while keeping name/args unchanged defeats a metadata-only diff. Mark changed Command implementations as unqualified unless their actual host calls are separately intercepted. Mandatory args schemas help only when dispatch uses them as the authoritative inputs. A no-args closure capturing a URL/amount is outside V1's payload guarantee. Candidate code must not alter the stored baseline, redaction rules or acceptance config.

**[I] What passes:** observed equivalence on retained traces. A changed Command is a review item, not automatically a regression. A deliberately changed business rule needs owner-approved expectations. Redacted data, nonserializable arguments, missing Messages and schema mismatch produce explicit coverage gaps.

**[I] Better models:** evolving intent and historical state persist even with excellent code generation. Rehearsal becomes more useful with frequent changes. Models can produce a patch and a proposed expectation update, but the owner of the production corpus must approve the latter independently.

**[I] Platform response:** Foldkit should adopt the adapter; a cross-framework trace format is useful only after two real adapters exist. Cloudflare cannot own every app's domain Messages or accepted effect changes, but can absorb the execution sandbox. Do not build storage/hosting to manufacture differentiation.

**[E] 2–3-week version:** one Foldkit adapter using existing recording metadata; JSON-only named Commands with explicit args; isolated replay of selected app histories; argument/multiplicity diff; incomplete-tail reporting; Story-test exporter. Spend the later week qualifying renames, duplicate completions, cancellation, concurrent commands and versioned schemas. Support for arbitrary Effect programs is out of scope.

**[I] Expert reply that kills it:** “Our current Story tests plus a 100-line DevTools export already do this; you cannot inspect the Effect's hidden calls.”

**[E] 1–2-day kill test:** use three publicly available command-driven examples; create ten seeded changes, including duplicate dispatch, changed args, deliberate behavior changes, missing result and hidden implementation-only edits. Require faithful old-code replay on at least 98% of eligible retained transitions, detection of every covered duplicate/payload change, and an explicit unsupported result for hidden-body edits. If useful traces require custom per-app instrumentation, or the existing harness does it with trivial glue, contribute the glue and stop.

### Measured replay blind spot

**[M]** On **Node v26.13.0**, using the published, dependency-free **pure-effect@0.23.0** tarball, this local program recorded a fake €10 refund, replayed a candidate closing over €1,000, then ran the candidate against the same in-memory fake sink:

~~~js
import assert from 'node:assert/strict';
import { Command, recordEffect, replayEffect, runEffect } from 'pure-effect';

const sent = [];
function flow(amount) {
  const cmdRefund = () => {
    sent.push({ amount, currency: 'EUR' });
    return { ok: true };
  };
  return Command(cmdRefund);
}

const oldRun = await recordEffect(flow(10));
const replay = await replayEffect(flow(1000), oldRun.trace);
assert.equal(replay.result.type, 'Success');
assert.equal(sent.length, 1); // replay performed no live refund
await runEffect(flow(1000));
assert.deepEqual(sent.map(x => x.amount), [10, 1000]);
~~~

**[M] Result:** replay returned Success({ok:true}) with **zero unreached entries**; the recorded entry had command, path, result and durationMs, with no arguments. Actual old/candidate fake-sink payloads differed by **100×**. No real payment or external effect occurred.

**[I] Interpretation:** this confirms Pure Effect's documented boundary. It does not show that a Command-metadata diff could discover a hidden closure value. A successful V1 must require explicit observable args or instrument the actual governed dispatch. Generic replay is already built; this narrower coverage contract is the experiment.

## 8. Finalist C — extension teardown qualification across embedding paths

**[I] One sentence:** run generated extensions through install, reload, failed replacement, session switch, dispose and host-loss sequences, and publish which resource/authority obligations the host actually discharges.

**[I] 30-second demo:** install a watcher extension, reload repeatedly, then dispose the embedded session while a callback is pending. An external observer shows a retained process/timer and a stale-generation action. Apply the host adapter fix; repeat the identical sequence and show bounded resource counts and rejection of the stale action.

**[F] Beneficiaries/pain:** Pi-Web **#546**, opened **18 August 2026**, reports **nine orphan children consuming roughly 900 MB** on one host because embedded teardown did not deliver the extension shutdown path. It was closed by **25 August**, with zero reactions at access. Pi **#3093**, **13 April**, reports reload leaving an 80 ms spinner interval alive and idle CPU use; it closed the next day. **[I]** These are historical failures and evidence that embedding paths matter, not claims those bugs remain open. [Pi-Web #546](https://github.com/agegr/pi-web/issues/546), [Pi #3093](https://github.com/earendil-works/pi/issues/3093).

**[F] Closest prior art:** bb's official test harness already has lifecycle.install/reload/dispose, real temporary SQLite, stale API checks, service aborts and host-worker-exit simulation. VS Code has an extension integration-test host; Effect conformance-spec includes release checks after interruption. **[I] Gap hypothesis:** a portable, versioned failure corpus for real embedding/disposal sequences and independently inventoried resources, using these existing harnesses. The basic harness and atomic reload feature fail the novelty test. [bb testing](https://github.com/get-bb/bb/blob/main/plugins/bb-guide/skills/bb-plugin-authoring/references/testing.md), [VS Code](https://code.visualstudio.com/api/working-with-extensions/testing-extension), [Effect checks](https://github.com/systemfsoftware/systemfsoftware/tree/main/packages/sim/conformance-spec).

**[I] Check:** drive the real host boundary, observe child/process resources outside the extension, record callbacks reaching the host after generation retirement, and verify persisted state and retained registrations after failed replacement. A retained-resource allowance is host-owned. Test reload and embedded dispose separately; a passing reload test cannot stand in for teardown.

**[I] Gaming/limit:** Pi extensions have the host's full OS permissions. They can bypass wrappers, spawn untracked work or change the observer's process; in-process monkeypatching is not an adversarial acceptance boundary. V1 must run qualification in an expendable child host with independently owned fixtures and clearly limit guarantees to mediated resources. A hostile arbitrary extension does not become acceptable because tests pass. Generic sandboxing belongs elsewhere.

**[I] Why it survives better models:** lifetime ownership, version transitions and API evolution remain real. Better models reduce coding mistakes, so this gets weaker unless the corpus protects multiple embeddings against changing lifecycle contracts. A benchmark consisting only of old fixed bugs will be exhausted.

**[I] Why owners would adopt it:** exactly because it should become their versioned compatibility fixtures. No reason a single-host maintainer cannot ship it. The side-project opportunity is maintaining the boundary cases across two hosts; if that cannot be demonstrated, this is a contribution rather than a separate package.

**[E] 2–3-week version:** reuse bb's testing harness for one backend, add one Pi embedding fixture and a local process/timer watcher, define lifecycle scenarios declaratively, add stale-callback and failed-migration cases, publish machine-readable coverage per host/version. Do not build a replacement plugin loader or a general memory profiler.

**[I] Expert reply that kills it:** “Our public harness already exercises disposal and failed reload; two closed bugs do not justify another framework.”

**[E] 1–2-day kill test:** take the two historical reproductions and three deliberately introduced lifecycle mutants; compare the existing upstream suites with the proposed corpus. Continue only if it catches at least two realistic missing boundary cases without private imports or duplicated host internals. If bb's existing harness and Pi regression tests cover them all, submit missing fixtures upstream and reject the standalone project.

## 9. Ranking, ONE pick, TL;DR and rejections

**[I] Scores are judgments, not measurements.** Each is 1–5; “gap” includes the substantial prior-art penalty, and “value” penalizes inferred demand. Equal totals are ordered by evidence and feasibility.

| Rank | Finalist | Cool | TS / CF / Vercel adjacency | Real gap | Value / pain | Survives better models | Not GrowOS | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | A · Remote lifetime scopes for async tools | 3 | 5 | 3 | 3 | 5 | 5 | **24/30** |
| 2 | B · Payload-aware Command replay | 4 | 5 | 3 | 2 | 5 | 5 | **24/30** |
| 3 | C · Extension teardown qualification | 3 | 5 | 2 | 3 | 4 | 5 | **22/30** |

**[I] ONE pick: A — remote lifetime scopes, starting with Infinity #45 and two tool adapters.** It has a current, named failure, a public protocol boundary and an acceptance check owned by the tool supervisor rather than the model. Run the two-day comparison against plain TTL/startup cleanup before building a library. Success can be a small upstream contribution; a new agent runtime is unnecessary. B has a sharper visual demo but less demand evidence and a serious metadata-versus-real-effects coverage problem.

**[F] Signal reality:** the HN submission of Infinity's launch post had **2 points / 0 comments** when checked; the June 2025 malleable-software essay had **294 points / 114 comments**. **[I]** Live software draws interest, but runtime density alone is not demonstrated launch traction. These are changing snapshots, not forecasts. [Infinity thread](https://news.ycombinator.com/item?id=50219851), [malleable software thread](https://news.ycombinator.com/item?id=44237881).

### Five-line TL;DR

1. **[I]** Infinity's useful contribution is its LLM-aware event/tool contract; actor activation and cheap waiting are established.
2. **[F]** The 75k-on-a-Pi headline extrapolates an EPYC/scripted-model memory test; Effect schedule exploration already has direct prior art.
3. **[I]** Rigor flips where a host owns capabilities, lifetimes and acceptance evidence independently of generated modules.
4. **[M/I]** Replay can miss a 100× changed effect payload; explicit observed arguments are essential, while ordinary replay/semantic diff are crowded.
5. **[I]** Build the bounded remote-scope kill test around RAP orphan subscriptions, then contribute upstream if plain TTL/reconciliation suffices.

### Rejected ideas — one line each, with the killer

- **[I] TS Infinity:** Infinity's own TypeScript guide plus Workers Agents/DO activation.
- **[I] Agent-aware general scheduler:** Temporal fairness and existing admission primitives; Infinity's own scheduling roadmap.
- **[I] Another TS OTP/actor framework:** Orleans, Akka, Effect cluster and Workers actors.
- **[I] Effect schedule-exploration kernel:** @systemfsoftware/effect-sim-kernel, including interruption and replay.
- **[I] Agent-guided schedule search:** REINS; controlled concurrency testing is already an active field.
- **[I] Generic generated Wasm plugin engine:** Extism, WASI components and Golem.
- **[I] Effect types as an isolation boundary:** ambient JS/native I/O; use actual host capabilities.
- **[I] Fork-safe agent budgets:** SatGate and the prior rounds' conserved-authority analysis.
- **[I] Runtime-grown host compatibility:** established compatibility-agent work and the explicit kill list.
- **[I] New full-JS replay VM:** Temporal/Golem/Hale/Pure Effect and the earlier snapshot findings.
- **[I] Generic stateful hot upgrade:** Golem snapshots/migrations, Erlang code replacement and XState versioning.
- **[I] Atomic agent-plugin installation:** bb already implements activation snapshots and rollback.
- **[I] Static semantic Effect diff:** effect-analyzer.
- **[I] Generated moldable inspector platform:** Glamorous Toolkit and existing extension surfaces.
- **[I] Separate compaction/obligation-memory engine:** explicit runtime subscription/run stores; keep referential checks inside A.
- **[I] Unconditional standalone extension-test framework:** bb's public lifecycle harness; C survives only as a useful shared failure corpus.
