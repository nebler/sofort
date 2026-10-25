# Cloudflare signal: the missing continuation underneath the agent cloud

Research cutoff: **2026-10-25**. Angle: Cloudflare agents, compute, persistence, and the opportunity for Sofort/jitk.

**[F]** means a fact supported by the linked public source or inspected source code. **[I]** means inference, recommendation, forecast, or an engineering estimate. **[P]** means a Sofort capability explicitly planned in the research brief, not demonstrated today. Negative findings are bounded searches, not claims about Cloudflare's private roadmap.

## Decision

**[I] Cloudflare validates the direction unusually strongly, but already owns most of the obvious product.** “A computer for every agent,” generated code with capability-only access, persistent workspaces, durable workflows, remote MCP, scoped credentials, and fast disposable execution are all present. Selling another JS code-mode sandbox, agent workspace, filesystem, or approval framework would collide with its existing stack.

**[I] The specific opening is a small, hardware-isolated continuation that survives losing its execution host, including while waiting on a tool, without requiring the program to become a workflow or replay from its beginning.** Cloudflare's public interfaces preserve databases, files, events, and explicit recovery records. The inspected interfaces do not preserve an arbitrary running program's entire machine state at that point. That difference can matter for unmodified static binaries, expensive intermediate computation, and agent-written programs with nested closures and concurrent outstanding calls. It often does **not** matter for short deterministic JS scripts: Dynamic Workers plus Code Mode replay or Dynamic Workflows already solve those adequately.

**[I] Best route:** start as an external `Executor` and narrowly scoped Cloudflare Computer backend, with Workers/Agents as the front door, a Durable Object as the durable address and execution ledger, R2 as snapshot storage, and a Sofort KVM fleet as execution capacity. Do not claim this runs inside Cloudflare Containers without proving nested virtualization is available. Treat a native Cloudflare runtime partnership as a later outcome, not a prerequisite or investment thesis.

## 1. What is actually built on our side

**[F, supplied brief]** Sofort currently runs static QuickJS and static Lua in a libkrun microVM, using KVM on Linux or HVF on macOS, on a roughly 1.7k-line `no_std` Rust kernel with 24 syscall slots. The guest's only external I/O is a JSON-lines tool channel to the trusted executor. The brief reports about 6 ms raw cold start, 9 ms through the executor, 2.1 ms warm MCP calls, 6.5 ms for ten concurrent calls, 4.8 CPU-ms per VM, and 10.7 MiB per VM. These are supplied local measurements, not independently rerun in this research. [Primitive brief](BRIEF.md).

**[P]** Shared copy-on-write snapshots targeting approximately 1 MiB marginal RAM per VM; pausing a whole VM at a pending tool call; durable snapshot storage; copying/forking/moving and resuming mid-line; deterministic replay using controlled time/randomness and a tool-result journal; capability stubs and promise pipelining; content-addressed computer images.

**[I]** The continuation thesis depends on those planned pieces. Today's built product can demonstrate a fresh, constrained hardware VM and an executor integration. It cannot honestly demonstrate “sleep three days, kill the host, resume the same stack” yet. Approximately 1 MiB marginal resident RAM is also **not evidence** that a self-contained, portable checkpoint occupies 1 MiB on R2: shared base images, dirty pages, VM/device metadata, compression, and image retention must be measured separately.

**[F, brief]** There is no fork/exec, threading, shared-library support, general network, or writable persistent filesystem today. Full Linux workspaces are out of scope. **[I]** Consequently “any static binary in principle” must not become “any Linux binary works now,” and Python/native wheels are not an already-shipped Sofort advantage. QuickJS's reported 3–5x performance disadvantage to V8 also precludes a generic JS throughput pitch.

## 2. Cloudflare's stack as of the cutoff

### 2.1 Workers and Dynamic Worker Loader: the default execution competitor

**[F]** Workers supports JavaScript/TypeScript, Python, Rust and other languages through WebAssembly; Python is CPython/Pyodide compiled to Wasm inside a V8 isolate. Python packages need pure-Python or compatible PyEmscripten/Pyodide builds; threading and multiprocessing are not functional. This is a substantial polyglot platform, not literally “JS only.” It does not make Workers an arbitrary native ELF execution ABI. [Languages](https://developers.cloudflare.com/workers/languages/), [Python implementation](https://developers.cloudflare.com/workers/languages/python/how-python-workers-work/), [packages](https://developers.cloudflare.com/workers/languages/python/packages/), [stdlib limits](https://developers.cloudflare.com/workers/languages/python/stdlib/).

**[F]** Dynamic Workers accepts code at runtime. `LOADER.load(code)` creates a fresh Worker; `LOADER.get(id, callback)` permits cached reuse while the Worker remains available. JS, Python and Wasm modules are supported; TypeScript needs transpilation, with `@cloudflare/worker-bundler` providing bundling/dependency support. `globalOutbound: null` makes global `fetch()` and `connect()` fail; explicit service/capability bindings can still expose selected operations. Without that setting, outbound access inherits from the parent. [Getting started](https://developers.cloudflare.com/dynamic-workers/getting-started/), [API](https://developers.cloudflare.com/dynamic-workers/api-reference/).

**[I]** This already provides the most important Sofort *policy* pattern: generated code with no ambient network and tools supplied as authority. “Credentials stay on the host,” “all effects are mediated,” and “cheap disposable execution” are not unique to us. The distinction is the runtime ABI, hardware boundary, and eventually the preservation of the running continuation.

**[F]** Kenton Varda's March 24 announcement describes millisecond isolate startup and claims a 100x startup advantage over containers; those are vendor comparisons, not a matched benchmark against Sofort. Python Dynamic Workers are explicitly documented as slower to start than JS. [Dynamic Workers announcement](https://blog.cloudflare.com/dynamic-workers/), [API language warning](https://developers.cloudflare.com/dynamic-workers/api-reference/).

**[I]** Do not use the old research's “1000x faster than Cloudflare Containers” assertion. Its arithmetic was not justified by 6–9 ms versus 1–3 seconds, the workloads were unmatched, and September changed the container implementation again. Compare equal code, location, image cache state, complete tool RTT and billing before making a competitive performance claim.

### 2.2 Code Mode: real SDK seams, and durability already exists

**[F]** Code Mode means generated programs compose tool calls, rather than presenting every tool schema directly to the model. Matt Carey's February 20 demonstration exposes Cloudflare's API through `search` and `execute`, with roughly 1,000 tokens of initial context instead of thousands of endpoint definitions. [Code Mode MCP announcement](https://blog.cloudflare.com/code-mode-mcp/).

**[F, source]** The inspected Agents checkout is `321814b6c13f72cff82161e7eb20312574ac9b7a`. Its `@cloudflare/codemode` contract is `Executor.execute(code, providersOrFns, options?) -> Promise<ExecuteResult>`, with results, errors and logs, resolved providers, optional provider prelude, and connector bindings. That is a real substitution boundary for an executor. [Pinned contract](https://github.com/cloudflare/agents/blob/321814b6c13f72cff82161e7eb20312574ac9b7a/packages/codemode/src/executor-types.ts).

**[F, source]** Code Mode's durable runtime already implements approval-driven abort-and-replay. It logs calls, aborts at an approval boundary, and reruns the same code using recorded results for completed calls. Its docs require deterministic execution up to tool boundaries, provide `codemode.step()` for nondeterministic work, and currently advise issuing connector calls sequentially in runs that might pause, because arrival-order sequencing can diverge with `Promise.all`. A crash between marking a call executing and recording its result can cause it to execute again. [Pinned runtime documentation](https://github.com/cloudflare/agents/blob/321814b6c13f72cff82161e7eb20312574ac9b7a/docs/codemode/runtime.md).

**[I]** The useful wedge is therefore “resume the existing stack and heap, with supported concurrent pending calls,” not “add approvals to code mode.” Replay is usually sufficient for tiny generated scripts. The executor interface alone is also insufficient for durable parking: it returns a Promise, not a durable receipt. A robust adapter needs a separate start/status/park/resume/cancel contract so a DO does not remain awaiting that Promise for days.

### 2.3 Agents SDK, Think, Durable Objects, facets

**[F]** Project Think was announced April 15 as new Agents SDK primitives for durable execution, sub-agents, sandboxed code and persistent sessions, plus an opinionated base class. Current Agents documentation covers state, scheduling, queues, channels, MCP, browsers, files, Code Mode, Workflows, skills and recovery. [Project Think](https://blog.cloudflare.com/project-think/), [Agents documentation](https://developers.cloudflare.com/agents/).

**[F, source]** `runFiber()`/`startFiber()` record work in SQLite, keep the agent alive, support `stash()` checkpoints, and invoke recovery hooks after interruption. **The original lambda is not serialized.** Recovery receives a name, JSON snapshot and metadata, and application code decides how to continue. The current source also has retained statuses, idempotency keys, inspection/cancellation and manual resolution. These are meaningful existing recovery primitives, not merely aspirational marketing. [Pinned durable execution docs](https://github.com/cloudflare/agents/blob/321814b6c13f72cff82161e7eb20312574ac9b7a/docs/agents/durable-execution.md).

**[F]** Durable Objects combine an addressable object with private, transactional, strongly consistent storage. SQLite-backed objects have SQL, KV, alarms and point-in-time recovery over the database, including the preceding 30 days. The database is durable; the JS object instance is not. [Storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

**[F]** The lifecycle documentation, updated October 15, says hibernation discards in-memory state and reruns the constructor when an event wakes the object. Hibernation requires no pending I/O/`waitUntil`, outbound connection, timer callback, active request/event, or standard WebSocket API use. Eligible objects currently hibernate after about ten seconds. Pending operations can prevent eviction for up to fifteen minutes per operation; updates and other shutdowns still require recovery. [Current lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/).

**[I]** An awaited tool fetch thus prevents hibernation; it does **not** mean every idle agent must pay indefinitely. A developer can persist a job and return, then wake on a callback or alarm. The missing property is transparent preservation of arbitrary local execution state across that split. Avoid the stronger and false claim that DOs cannot implement cheap sleeping agents.

**[F]** Hibernatable incoming WebSockets preserve connectivity, not the application's heap. Alarms wake an object to run a handler; the handler may restart and has at-least-once execution with bounded automatic retries. There is one scheduled alarm slot per DO. They are not stored JS continuations. [Lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/), [alarms](https://developers.cloudflare.com/durable-objects/api/alarms/).

**[F]** Durable Object Facets, announced April 13 by Kenton, let runtime-loaded apps instantiate isolated SQLite-backed objects. **[I]** This directly occupies the “one durable personal app per agent/user” space. It does not imply preservation of a paused instruction pointer. [Facets announcement](https://blog.cloudflare.com/durable-object-facets-dynamic-workers/).

### 2.4 Workflows, including Dynamic Workflows: the strongest practical substitute

**[F]** Workflows persists step results and supports retries, durable sleeps and external events. Its rules explicitly discuss idempotency because a step may execute more than once. April's control-plane redesign targeted agents creating work at machine speed. [Rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/), [April redesign](https://blog.cloudflare.com/workflows-v2/).

**[F]** Dynamic Workflows was announced May 1 and is documented for code loaded into Dynamic Workers at runtime. Generated tenant code can use durable steps, sleep for days and wait for events without registering every workflow ahead of time. This closes an important gap that a static “Workers versus VM” comparison would miss. [Announcement](https://blog.cloudflare.com/dynamic-workflows/), [current API guide](https://developers.cloudflare.com/dynamic-workers/usage/dynamic-workflows/).

**[I]** For approvals, cron-style automations, cancellable delayed email, and durable API orchestration, first ask why Dynamic Workflows is insufficient. Sofort is useful only when preserving computation *inside/between* those authored boundaries, avoiding refactoring an existing program, preserving a supported native runtime, or forking a running computation matters. A Workflow can itself orchestrate Sofort executions; these need not be exclusive architectures.

### 2.5 Containers and Sandbox SDK: native code and snapshots already belong here

**[F]** Cloudflare Containers runs general language/runtime images; each instance has its own kernel and network in a Firecracker microVM. A Worker/DO controls it. Thus Cloudflare already has hardware-isolated native-code infrastructure; “Cloudflare only offers V8 security” is false. [Overview](https://developers.cloudflare.com/containers/), [lifecycle/architecture](https://developers.cloudflare.com/containers/concepts/architecture/).

**[F]** Sandboxes reached GA during April's Agents Week. The SDK supplies the agent environment around Containers: commands, files, background processes, sessions and services. Cloudflare also announced outbound Workers for sandbox egress controls, including credential injection without putting secrets in generated code. [April launch roundup](https://blog.cloudflare.com/agents-week-in-review/), [Sandbox docs](https://developers.cloudflare.com/sandbox/).

**[F]** The current documentation goes further than the older research: Sandbox SDK **1.0** migration guidance, updated October 23, replaces the package-owned `Sandbox` DO/server with an application-written DO calling `this.ctx.container` directly. Commands use argument arrays; file operations use small helpers; lifecycle, process records, preview tokens, snapshot IDs and retry decisions belong to application code. The package does not automatically persist those records or retry operations. **[I]** This sharpens the integration opportunity around a durable execution controller, while making an adapter built against old 0.x session/server assumptions stale. It also confirms that application-defined continuation and side-effect semantics remain necessary. [Changes in 1.0](https://developers.cloudflare.com/sandbox/sdk/migrate/changes-in-1-0/).

**[F]** September 30's redesign claims sixfold faster starts, runtime image/instance selection, DO-owned scheduling, and public-beta filesystem snapshots. Current snapshot docs are explicit: **filesystem only, excluding memory and running processes**, tied to the source image version. A handle can restore into another DO; snapshots have a 30-day TTL refreshed by restore. [Redesign](https://blog.cloudflare.com/faster-agent-sandboxes/), [snapshot contract](https://developers.cloudflare.com/containers/guides/snapshots/).

**[F]** Current predefined sizes begin at 256 MiB and 1/16 vCPU; custom instance types have separate constraints. Account quotas and snapshot limits exist. **[I]** This is a plausible density gap for small continuations, not a proof of a particular cost advantage: compare provisioned container resources with actual shared-VM accounting and measure both. [Limits, updated October 21](https://developers.cloudflare.com/containers/platform/limits/).

**[F]** Cloudflare disclosed and remediated a cross-tenant residual-disk exposure in September. The incident involved storage block reuse under Firecracker, not evidence that V8 or hardware virtualization is intrinsically unsafe. **[I]** This is also a warning for Sofort: tiny guests do not eliminate snapshot, storage-reuse or host-control-plane vulnerabilities. [Cloudflare incident account](https://blog.cloudflare.com/containers-cross-tenant-vulnerability/).

### 2.6 Cloudflare Computer exists; it is not Cloudflare OS

**[F]** Matt Carey and Aron Carroll announced `@cloudflare/computer` on August 3 as an agent runtime selecting between isolates and containers. The central abstraction is a persistent workspace, not a new hypervisor or literal custom kernel. [Announcement](https://blog.cloudflare.com/cloudflare-computer/).

**[F, source]** Inspected checkout: `2b23503eac1f4efa8403908e472c472f747b61f7`. A DO owns an authoritative SQLite filesystem. Backends include a container with `computerd`/FUSE and Cap'n Web synchronization, an isolate shell using `just-bash`, and isolate JavaScript with workspace-backed `node:fs/promises` and host modules. `workspace.runtime.exec(source, {backend})` routes execution. The README warns that design docs are forward-looking. [Pinned README](https://github.com/cloudflare/computer/blob/2b23503eac1f4efa8403908e472c472f747b61f7/README.md).

**[F, source]** The package marks core Workspace, SQLite filesystem and Worker JavaScript stable; ContainerBackend, shell, sync/daemon wire protocol and interruption/replay mechanisms are experimental. Active Worker executions cannot be serialized across host restart; orphaned running records are reconciled to failed. Experimental replay/restart does not change that into a saved running isolate. [Status matrix](https://github.com/cloudflare/computer/blob/2b23503eac1f4efa8403908e472c472f747b61f7/packages/computer/README.md), [runtime lifecycle](https://github.com/cloudflare/computer/blob/2b23503eac1f4efa8403908e472c472f747b61f7/docs/05_runtime_interface.md).

**[I]** Computer is the cleanest product integration and a serious competitor. Its workspace gives a user's agent a consistent environment across execution targets. Sofort could add a small continuation-preserving target, but should not pretend its read-only resources and tool channel implement Computer's entire filesystem/shell contract today.

### 2.7 Cloudflare OS: Kenton's capability platform, not a generated unikernel

**[F]** Cloudflare OS was open-sourced August 5; October 1 opened a waitlist for managed deployments. It combines organizational agent workspaces, personal apps, context/skills and governed integrations. The managed option was a waitlist announcement, not evidence of general availability. [Open-source launch](https://blog.cloudflare.com/cloudflare-os/), [managed announcement](https://blog.cloudflare.com/managed-cloudflare-os/).

**[F, source]** `/tmp/ref-repos/cloudflare-os` exists at `835de9e8776429fc16781edbe66367d879a64b87`. Its README maps “kernel” to a Worker/DO application backend, “processes” to gadgets, and “drivers” to Gatekeepers. Workspaces are DOs, gadgets are Dynamic Worker facets, and Gatekeepers mediate authority and external effects. It says runtime features including Dynamic Workers and facets were built specifically to support OS. [Pinned README](https://github.com/cloudflare/cloudflare-os/blob/835de9e8776429fc16781edbe66367d879a64b87/README.md).

**[F, source]** Agent code is loaded with `LOADER.load()`, restricted `env` capabilities and `globalOutbound: null`. It uses a bespoke execution harness rather than merely wrapping `@cloudflare/codemode`. Gatekeepers can simulate pending mutations so the agent continues before a user approves a batch. Browser/app-facing RPC uses Cap'n Web; internal agent-to-Gatekeeper execution also uses native workerd RPC. [Pinned overseer](https://github.com/cloudflare/cloudflare-os/blob/835de9e8776429fc16781edbe66367d879a64b87/packages/workshop-backend/src/overseer.ts), [Gatekeeper explanation](https://github.com/cloudflare/cloudflare-os/blob/835de9e8776429fc16781edbe66367d879a64b87/README.md#gatekeepers-a-capability-based-security-layer).

**[I]** OS demonstrates purpose-built *applications*, per-user isolation and capability introduction. The public code does not substantiate “Cloudflare already generates a purpose-built unikernel for each task.” Its simulation approach is sometimes better UX than pausing: if projected results suffice, the agent can finish preparing work. Sofort matters where the result cannot responsibly be simulated and actual continuation must wait.

### 2.8 Cap'n Web: relevant wire semantics, no durable sessions for free

**[F]** Kenton's September 2025 Cap'n Web is an open-source JS-native capability RPC system, usable outside Workers. It supports bidirectional stubs and promise pipelining over WebSockets, HTTP batches and custom transports. **[I]** This closely matches a guest holding authority-limited proxies and an executor owning credentials, while reducing dependent-call network waterfalls where the remote participates. [Launch](https://blog.cloudflare.com/capnweb-javascript-rpc-library/), [repository](https://github.com/cloudflare/capnweb).

**[F, source]** The protocol's sessions are transient: ending the transport invalidates session stubs; nothing persists automatically. Security docs also note that applications must bound outstanding calls/live exports themselves. A custom transport can carry RPC messages over the Sofort tool channel. [Custom transport](https://github.com/cloudflare/capnweb/blob/7666553/packages/docs/src/content/docs/transports/custom.mdx), [security](https://github.com/cloudflare/capnweb/blob/7666553/packages/docs/src/content/docs/guides/security.mdx).

**[I]** Snapshotting a guest with numeric stub IDs is insufficient. Preserve durable logical capability IDs in the executor, recreate the transport/session, and rebind only still-authorized resources. Raw session reference IDs cannot become durable permissions. Cloudflare OS's per-execution stub lifetime is an additional reason to define explicit reauthorization after resuming.

### 2.9 AI Gateway, Browser Rendering/Run, R2 and D1

**[F]** AI Gateway provides a model access/control layer; September 30 added Auto Router public beta using `cloudflare/auto`. **[I]** Sofort should consume it for model calls and attribution; it is neither a continuation store nor an agent execution runtime. Inference may dominate total agent cost, so saving idle CPU alone is not automatically a large customer bill reduction. [Auto Router announcement](https://blog.cloudflare.com/auto-router/).

**[F]** Browser Rendering was renamed **Browser Run** on April 15; a May announcement moved it onto Containers. **[I]** Treat browsers as external tools. A paused Sofort guest does not preserve Chrome's tabs, cookies, sockets or live remote session. Persist browser job/session references and explicitly define expiration/recreation semantics. Running Chromium inside the tiny kernel is outside the brief. [Rename and agent features](https://blog.cloudflare.com/browser-run-for-ai-agents/), [Container migration](https://blog.cloudflare.com/browser-run-containers/).

**[F]** R2 is strongly consistent object storage; Standard storage is $0.015/GB-month, with operation charges and no Internet egress bandwidth charge. **[I]** It is a plausible snapshot/blob/image store. D1 is serverless SQL accessed from Workers bindings, useful for account/project indexes and cross-computer queries; a DO's own SQLite is the simpler authority for one computer's lease and state transitions. Neither product persists CPU registers or a heap unless we first serialize those ourselves. [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [D1](https://developers.cloudflare.com/d1/get-started/).

**[I, arithmetic]** If a complete durable checkpoint eventually really occupies 1 MiB, one million checkpoints occupy about 1,048.6 decimal GB and cost about **$15.73/month in R2 Standard storage**, before free allowances, rounding, replicas we add, base images, manifests, logs and operations. One million writes plus reads is another nominal $4.50 + $0.36 before allowances. This is a scenario, not a measured Sofort cost or an all-in service price. Frequent checkpointing, journal traffic, host RAM, active compute and network RTT can dominate it.

### 2.10 MCP hosting and remote MCP: separate protocol lifetime from computer lifetime

**[F]** Cloudflare hosts remote MCP on Workers with OAuth/scoped authorization support. Its October 22 transport/server docs recommend `createMcpHandler()` and stateless Streamable HTTP for new servers. `McpAgent` is deprecated and feature-frozen; sessionful `McpAgent`/`WorkerTransport` routes remain a legacy migration lane for features including replay and pushed requests. The docs also describe internal RPC transport between Cloudflare components without public HTTP; that path does not provide OAuth authentication. [Remote server guide](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/), [transport](https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/).

**[I]** Expose durable Sofort execution IDs as business resources behind that endpoint, rather than equating one MCP transport session with one computer. A reconnecting/new stateless request can fetch status or authorize a resume through the DO. Keep MCP at the integration boundary and use Cap'n Web internally only where its capability semantics help; they are distinct protocols. This is a credible complement to Cloudflare's hosting, but a generic remote-MCP server or authenticated tool gateway would duplicate an existing product. For external clients, report an operation accepted/pending through a supported explicit contract instead of keeping a transport request alive for a multi-day pause.

## 3. Announcement timeline and the public people signal

### 3.1 The 2026 announcements that change the thesis

| Date | Verified signal | Implication for Sofort [I] |
| --- | --- | --- |
| March 24 | Dynamic Workers open beta / direct runtime loading | Cheap generated JS execution is already occupied. |
| April 12–17 | Agents Week: Sandboxes GA, facets, Think, workflow scaling, Browser Run, sandbox egress, Artifacts | Cloudflare is assembling the whole agent substrate, including native runtime escape hatches. |
| May 1 | Dynamic Workflows | Durable *generated* programs are already supported at explicit step boundaries. |
| August 2–7 | Another Agents Week; Computer and open-source OS; newer MCP direction | “Agent computer” and company workspaces are actual product bets, not just podcast speculation. |
| September 28–October 2 | Birthday Week: Container redesign/filesystem snapshots; managed OS waitlist; AI Gateway routing; Artifacts open beta and Git-platform invitation; K2 event streams | The native/durable competition is moving quickly; existing routing/storage pieces also make integration easier. |
| October 9 | Kenton and Ryan Dahl announce Deno joining Cloudflare and workerd/celld convergence for self-hosting | “Run the Workers model on your own infrastructure” is no longer a clear differentiation by itself. |
| October 22–25 | Open startup-snapshot consumption PR | Watch real source progress, not only launch-week branding. |

Sources: [Dynamic Workers](https://blog.cloudflare.com/dynamic-workers/), [April Agents Week roundup](https://blog.cloudflare.com/agents-week-in-review/), [Dynamic Workflows](https://blog.cloudflare.com/dynamic-workflows/), [August welcome](https://blog.cloudflare.com/agents-week-welcome/), [Birthday Week roundup](https://blog.cloudflare.com/birthday-week-2026-wrap-up/), [Deno announcement](https://blog.cloudflare.com/deno-joins-cloudflare/), [snapshot PR](https://github.com/cloudflare/workerd/pull/7880).

**[F, search scope]** I did not verify a distinct event under the exact name “Developer Week 2026.” Cloudflare's April and August primary pages use **Agents Week**; older Developer Week pages are 2025 or earlier. The report uses the actual 2026 events rather than silently relabeling an old Developer Week. **[I]** This is a nomenclature correction, not evidence that no developer announcements occurred in 2026.

### 3.2 What the named people publicly say, and how much weight to put on it

**[F]** The supplied Next Token Ep 07 transcript opens with a recording date of October 12, 2026; the show's published listing gives October 19. The transcript has turn-taking but no reliable speaker labels on every utterance. Use its timestamps for the discussion and separately authored sources for firm personal attribution. None of this is a committed Cloudflare roadmap. [Episode/show notes](https://podcasts.apple.com/nz/podcast/whats-after-code-mode-ep-07/id6784829318?i=1000797105720), [local transcript](../next-token-ep07-transcript.txt).

- **Kenton Varda. [F]** Authored/coauthored Code Mode, Cap'n Web, Dynamic Workers, facets, and the October Deno/self-hosting announcement. OS's source explicitly identifies itself as the Workers team's intended use of its own primitives. **[I]** The relevant sustained theme is capability security plus colocated state and distributed objects, not public evidence of a secret Sofort-equivalent VMM. [Author index](https://blog.cloudflare.com/author/kenton-varda/), [Code Mode](https://blog.cloudflare.com/code-mode/), [Deno](https://blog.cloudflare.com/deno-joins-cloudflare/).
- **Sunil Pai. [F]** Coauthored Project Think with Kate Reznykova. The podcast discussion around 00:53–00:54 predicts purpose-built, just-in-time computers/unikernels; around 01:00–01:02 it emphasizes Kenton's stubs/promise-pipelining approach and invites people to inspect OS. **[I]** This is an unusually close conceptual invitation for Sofort, but the unlabelled local transcript is insufficient to turn every sentence into a verified Sunil quotation, and enthusiasm is not a runtime commitment. [Think](https://blog.cloudflare.com/project-think/), [episode](https://podcasts.apple.com/nz/podcast/whats-after-code-mode-ep-07/id6784829318?i=1000797105720).
- **Matt Carey. [F]** His authored work establishes the small Code Mode tool surface and Computer's runtime-selection direction. In the episode's 00:37–00:42 discussion, Computer is described evolving from separate isolate/container execution tools toward JS importing a container capability; 00:56–01:03 discusses resources, executable stubs and Cap'n Web. His public talk is linked as “MCP is middleware.” **[I]** An external computer exposed as a library/tool fits this direction better than forcing a new MCP tool list or replacing the agent. [Computer](https://blog.cloudflare.com/cloudflare-computer/), [API Code Mode](https://blog.cloudflare.com/code-mode-mcp/), [talk](https://www.youtube.com/watch?v=YBYUvGOuotE&t=1251s).
- **Dillon Mulroy. [F]** Coauthored Artifacts and the October invitation to build a Git platform on Cloudflare; the episode's opening discusses Artifacts open beta, and its show notes link his Code Mode/Jev demonstration. **[I]** His clearest verifiable signal is reusable/versioned agent work, tool composition and visible demos. A resumable computation should have a shareable, versioned record, but Artifacts is not itself a running-memory snapshot format. [Artifacts](https://blog.cloudflare.com/artifacts-git-for-agents-beta/), [Git-platform invitation](https://blog.cloudflare.com/next-git-platform-on-cloudflare/).
- **Rita Kozlov. [F]** Her April and August Agents Week posts frame infrastructure around autonomous agents, rather than human-oriented cloud assumptions. The August framing asks what primitives agents need; April addresses the scale of simultaneous agent sessions. **[I]** Density, idle-resource economics and controlled authority align with that product direction. It does not show a specific demand for an externally supplied unikernel. Do not confuse Rita with **Dina Kozlov**, a separate author on the Git-platform post. [April welcome](https://blog.cloudflare.com/welcome-to-agents-week/), [August welcome](https://blog.cloudflare.com/agents-week-welcome/).

**[F, supplied transcript]** Around 00:43–00:44, participants specifically discuss approvals delayed for days, yielding a script around slow work, and async tool/inference calls. Around 00:50–00:54, reusable scripts, events and durable execution precede the unikernel prediction. **[I]** These give a much better demo brief than a generic microVM benchmark: make generated code wait, survive losing the host, and continue with its local state intact.

## 4. workerd source/issues audit: snapshot does not always mean continuation

**[F]** Inspected local workerd checkout: `2c37de0d944552d8e5404924290dafb43a0e7d53`. Searches covered runtime/server source and headers, Cap'n Proto definitions and Markdown for snapshot/checkpoint/hibernation, durable execution, Firecracker, microVM, unikernel, libkrun and Hyperlight. A separate live GitHub issue/PR search on October 25 found the following:

1. **V8 startup snapshots are real, active engineering. [F]** [PR #6908](https://github.com/cloudflare/workerd/pull/6908), merged by the cutoff, produces a snapshot after initialized top-level code in a disposable zygote. [PR #7880](https://github.com/cloudflare/workerd/pull/7880), open/unmerged when inspected, consumes it for eligible Workers behind `STARTUP_SNAPSHOT`. Its exclusions include Python/ScriptSource/Wasm cases and its current eligibility requires TypeScript-implemented streams. It can fall back to ordinary startup. [Pinned `SnapshotArtifact`](https://github.com/cloudflare/workerd/blob/2c37de0d944552d8e5404924290dafb43a0e7d53/src/workerd/jsg/snapshot.h).
2. **Python already uses memory snapshots for initialization. [F]** The Python deployment path initializes imports and snapshots Wasm linear memory for bootstrap. This is not a snapshot of an arbitrary request paused on a remote effect. [Python implementation](https://developers.cloudflare.com/workers/languages/python/how-python-workers-work/).
3. **DO storage snapshots are another different thing. [F, source]** `ActorSqlite::snapshot` is documented in source as capturing the object's *storage* at a bookmark/current position. Its opaque capability can transfer over RPC. That is not a serializable saved JS stack. [Pinned actor storage declarations](https://github.com/cloudflare/workerd/blob/2c37de0d944552d8e5404924290dafb43a0e7d53/src/workerd/api/actor-state.h), [snapshot serialization implementation](https://github.com/cloudflare/workerd/blob/2c37de0d944552d8e5404924290dafb43a0e7d53/src/workerd/api/snapshot.c++).
4. **Live socket hibernation is incomplete. [F]** [Issue #4864](https://github.com/cloudflare/workerd/issues/4864) requests outgoing-WebSocket hibernation and remained open. Its initial claim of indefinite pinning should not override October's newer lifecycle documentation. **[I]** This is evidence of a concrete pain point, not evidence Sofort can preserve the remote socket: our host still owns that problem.
5. **Native-ish Wasm execution could improve. [F]** [Issue #7813](https://github.com/cloudflare/workerd/issues/7813), opened October 18, proposes WASI preview1 with filesystem providers and a JSPI async host. The inspected `node:wasi` is a stub throwing `ERR_METHOD_NOT_IMPLEMENTED`. The proposal discusses synchronous guest I/O over async providers and Wasm/JS suspension constraints. It is a contributor proposal, not an accepted Cloudflare roadmap. [Pinned stub](https://github.com/cloudflare/workerd/blob/2c37de0d944552d8e5404924290dafb43a0e7d53/src/node/wasi.ts).
6. **Snapshot interfaces are still moving. [F]** [Issue #7862](https://github.com/cloudflare/workerd/issues/7862), opened October 21, identifies documentation/types/hosted-behavior discrepancies around Container snapshot arguments, image metadata and directory snapshot producers. It is an issue author's bounded experiment, not an official guarantee. **[I]** Pin compatibility dates and tested SDK versions in an adapter.
7. **No located VM/unikernel workerd backend or arbitrary running-isolate checkpoint API. [F, bounded negative]** Live issue/PR queries for `repo:cloudflare/workerd unikernel` and `microvm` returned zero results; the inspected runtime sources supplied no matching backend. Existing VM infrastructure lives in Containers. **[I]** Private infrastructure work may be invisible, and keyword searches cannot prove absence. The positive evidence above supports a narrower conclusion: the visible snapshot work optimizes initialization/storage, while public recovery semantics still reconstruct execution.

**[F]** workerd's README says the standalone runtime is not a hardened sandbox and advises an enclosing secure sandbox for malicious code. It separately states Cloudflare's hosting service adds layers of defense. **[I]** This strengthens an on-premises “hardware boundary around each untrusted run” story, but does not license saying hosted Cloudflare Workers has no defense in depth. Sofort's actual trusted base includes libkrun, KVM/HVF, host OS, executor, parsers and snapshot machinery, not only its 1.7k-line guest kernel. [Pinned workerd warning](https://github.com/cloudflare/workerd/blob/2c37de0d944552d8e5404924290dafb43a0e7d53/README.md).

## 5. (a) Structural gaps: which ones need this primitive?

| Gap | Existing Cloudflare answer [F] | What Sofort would add [I/P] | Necessity verdict [I] |
| --- | --- | --- | --- |
| Local heap/stack lost when execution disappears | DO SQLite; fibers with JSON stash/recovery; Computer journals; Workflows steps | Preserve the whole constrained machine, including nested execution state | Strongest gap when continuation state is hard/expensive to reconstruct; unnecessary for trivial deterministic scripts |
| Awaiting an external call prevents hibernation | Split into durable job plus callback; Workflow wait/event | Park at the tool boundary without rewriting the guest into an event handler | DX and density advantage; not a new ability to implement sleeping agents |
| Native binaries outside Wasm ABI | Firecracker Containers/Sandboxes | Small verified static binaries without a full Linux guest/userland | Real niche; syscall compatibility is a hard limitation, not solved by being static |
| Cost of recovering expensive local work | Persist intermediate results, replay recorded tools, choose workflow boundaries | Resume retained memory instead of redoing computation | Valuable only when computation/state dominates checkpoint and transfer costs |
| Fork a running program at a decision boundary | New isolate/workflow instances; copy files/state explicitly | Branch the existing continuation and apply different tool outcomes/grants | Distinctive exploration/testing primitive; external effects must remain isolated |
| Strong boundary for self-hosted generated code | Wrap workerd in a VM; use Containers on hosted platform | Per-run hardware VM with tightly constrained I/O | Valid deployment choice; not unique hardware isolation across Cloudflare's entire platform |
| Credentials and scoped authority | Bindings, Gatekeepers, sandbox egress, OAuth | Carry logical grants across VM lifecycle | Integration requirement; essentially no differentiation alone |
| Persist files and expose tools/skills | Computer filesystem, Artifacts, Agents skills and MCP | Resource bundles as part of a content-addressed machine | Mostly occupied; a machine identity is new only if it includes verifiable execution/grant semantics |

**[I] Two limitations remain even after snapshots work.** First, a saved guest cannot resurrect an LLM's dropped HTTP stream, a database transaction, an expiring browser or a remote API's internal state. Host jobs/results need durable identities or explicit recovery policies. Second, a snapshot cannot make a non-idempotent external effect exactly once: a crash after the service applied an effect but before its receipt was journaled is still ambiguous. Tool-channel mediation makes this easier to reason about, but only downstream idempotency keys, transactions or reconciliation can close particular cases.

## 6. (b) Build on top: a concrete deployment and its hard edges

### 6.1 Feasible today: Cloudflare control plane, external Sofort execution

**[I] Proposed ownership:**

- Worker / remote MCP endpoint: authenticate the user, enforce quotas, expose start/status/approve/cancel and stream status.
- Agents SDK or OS Gatekeeper: own the user's interaction and scoped tool/API access; keep long-lived credentials out of the guest.
- One DO per logical computer/execution family: store manifest, status, execution generation, lease, pending tool intents/results, latest checkpoint pointer, grant references and callback deduplication keys.
- R2: immutable machine base images/checkpoint blobs plus content hashes. D1, if needed, indexes accounts/projects/runs across DOs.
- Sofort host fleet with `/dev/kvm`: own the libkrun VMs and trusted executor; park/resume under a lease issued by the DO.
- AI Gateway and Browser Run: ordinary external capabilities invoked by the trusted side, with their own durable job/session references.

**[I] Minimal durable lifecycle:**

1. Persist a run intent and image/grant manifest; return a durable receipt promptly.
2. Acquire a generation-fenced execution lease; start the VM on a compatible host.
3. At a tool boundary, record a stable call ID and authorized intent before dispatch. Either finish quickly or checkpoint the blocked VM and return the host's RAM to the pool.
4. Upload the immutable checkpoint, verify its hash, then publish its pointer/status in DO storage. Do not acknowledge a durable park before both are safe. R2 and DO are separate commit boundaries: recover orphaned blobs and incomplete pointer transitions.
5. End the DO invocation. Do not keep an awaited fetch, heartbeat or permanently open outbound socket merely to wait for this computer.
6. Receive approval/job completion as a fresh request/alarm; persist the tool result and deduplicate it. Revalidate grants, lease the next host, restore the VM, and deliver the result under the original call identity.
7. Atomically advance the DO's logical generation/state. Reject stale hosts and repeated callbacks. Handle cancellation and expiry as persisted decisions.

**[P]** Steps involving checkpoint/restore/replay require the planned primitive. **[I]** The DO's identity stays stable even if the executor host changes. “Same address, new host, same continuation” is the useful contract. It still needs compatible CPU architecture/features, kernel/image versions and VM-device state; a raw VM snapshot is not automatically cross-architecture or cross-version portable.

### 6.2 Containers/Sandbox backend: distinguish integration from physical hosting

**[F]** Cloudflare's public Container docs promise a Firecracker guest, not nested KVM or customer-supplied VMM/kernel execution. **[I]** No verified `/dev/kvm` access was obtained in this task. Do not present nesting libkrun inside Sandbox as supported, or assume Docker-in-Docker implies nested virtualization. They are different capabilities.

**[I]** Three meanings of “Sofort as a Sandbox backend” should be kept separate:

1. **External execution provider:** an SDK/tool module in a Worker or Sandbox forwards a selected operation to our KVM fleet. Feasible without Cloudflare changing its platform; the CPU work happens elsewhere.
2. **A Cloudflare Computer backend:** implement its pluggable backend/handle contract against that service. This is an application integration, not replacing Cloudflare's Firecracker runtime. Its current `WorkspaceBackend.connect(host)` returns a `BackendHandle` including RPC, runtime identity, sync policy and close semantics. A restricted module/structured-result backend is a better first target than pretending to be a general shell. [Pinned backend contract](https://github.com/cloudflare/computer/blob/2b23503eac1f4efa8403908e472c472f747b61f7/packages/computer/src/backend.ts).
3. **Native provider runtime:** Cloudflare exposes the KVM host layer or adopts a Sofort-like guest below its own Container abstraction. Plausible partnership work, entirely unverified and unavailable as a self-serve path today.

**[I]** Software-emulating our guest in a Container or Worker could exercise interfaces but loses the proposed hardware boundary/performance model. It is not evidence that Sofort's intended backend runs on Cloudflare.

### 6.3 The two adapter contracts

**[I] Code Mode:** map provider calls onto authorized executor callbacks; serialize results/errors/logs compatibly. Support connector calls through a Worker bridge rather than trying to serialize live workerd bindings into VM memory. Keep the ordinary `Executor.execute()` for short calls; add a durable controller returning an execution ID for long waits. Existing durable Code Mode replay must not unknowingly rerun a Sofort operation that already has a retained execution ID.

**[I] Computer:** expose a named `sofort` backend with an explicit supported-program/resource profile. Route files through host-mediated methods or preload read-only bundles; do not claim writable POSIX persistence/FUSE until implemented. `runtimeId` should identify the logical machine incarnation with fencing semantics, while a separate host ID can change on migration. The source's execution journals/status tools can remain the UI around our continuation.

**[I] Cap'n Web:** use it for host-to-DO/gatekeeper calls where interoperable stubs and pipelining help. A guest transport can be added later, with bounded frames/calls/exports and resource lifetimes. For the first prototype, existing JSON tool messages are sufficient. Pipelining does not eliminate latency to an arbitrary plain-MCP server that cannot execute the dependent chain remotely.

## 7. (c) Products next to Cloudflare: six candidates, with necessity tests

All efforts below are **[I]** rough focused engineering estimates, not commitments. They assume one or two experienced engineers, existing deployment access, and exclude independent security certification. Scores: demo/social and business potential, each 1–5. Production estimates depend heavily on the unbuilt snapshot work.

### Idea 1 — Resumable Code Mode executor

- **Pitch:** “Your agent's program waits three days for approval, loses its host, then continues inside the same function.”
- **Who uses it:** agent platform/harness developers using Cloudflare Code Mode or Computer; automation teams with expensive local computation and many waiting runs.
- **Newly possible [P]:** retain the original heap/stack, supported native runtime and concurrent pending-call graph across durable parking and migration, without workflow annotations throughout the program.
- **Already exists [F]:** Code Mode abort/replay, Dynamic Workflows, fibers and Computer's experimental restart/replay. **Why these can fall short [I]:** reconstruction requires determinism, authored boundaries/recovery logic or recomputation. For small scripts they do not fall short enough; do not sell to those workloads.
- **Primitive dependency:** built VM/executor for an adapter today; planned checkpoints, durable host-call ledger and grant rebinding for the actual product.
- **Effort [I]:** 1–2 weeks for a constrained external adapter; 6–12+ weeks for a convincing limited durable prototype after a usable snapshot path; multi-quarter hardening for a trustworthy service.
- **Demo/social:** **5/5**. **Business:** **4/5**, contingent on proving this saves integration/recovery cost customers actually experience.

### Idea 2 — Native tool coprocessor for Workers agents

- **Pitch:** “Keep your agent on Workers; send only the unsupported static program to a tiny hardware-isolated computer.”
- **Who uses it:** Workers SaaS platforms executing constrained user/agent programs; teams maintaining awkward Wasm ports or overprovisioned native sidecars.
- **Newly possible [I]:** execute a tested static binary through the same mediated tool surface at low local startup cost, without standing up a full Linux workspace per operation.
- **Already exists [F]:** Containers, Sandbox and Wasm builds. **Why these can fall short [I]:** provisioned resource floor/startup or Wasm port/toolchain friction. Cloudflare's improved Containers and WASI work reduce the opening; remote RTT can erase local boot gains.
- **Primitive dependency:** built static-runtime VM and resources; per-program syscall compatibility must be verified. Planned content-addressed images improve distribution; snapshots are optional for the first product.
- **Effort [I]:** 2–4 weeks for one measured program/profile and Worker client; 6–12+ weeks for quotas, metering, deployment and several supported profiles. A broad binary catalog is a much larger undertaking.
- **Demo/social:** **4/5**. **Business:** **3/5**. Require a real binary and a meaningful workload that isn't already easy in Wasm.

### Idea 3 — Forkable agent computation and policy test bench

- **Pitch:** “Pause before the next effect, fork the computer, and compare outcomes under different approvals or tool results.”
- **Who uses it:** harness developers, agent evaluation teams, enterprise policy/gatekeeper authors.
- **Newly possible [P]:** branch after expensive preparation with identical local state; replay recorded reads; compare continuation outputs and proposed effects without repeatedly paying for the prefix.
- **Already exists [F]:** workflow branching, Code Mode replay and OS Gatekeeper simulation. **Why these can fall short [I]:** they reproduce application state/results rather than the precise execution continuation; simulation also needs a service-specific model. If the prefix is cheap and deterministic, ordinary replay is sufficient.
- **Primitive dependency:** planned snapshots/forks, deterministic controls and result journaling; fresh child identities, isolated journals and attenuated grants. Every fork must default to record-only effects or separate test resources.
- **Effort [I]:** 4–8 weeks after reliable restore for a focused evaluation demo; 3–6+ months to make it useful across real integrations.
- **Demo/social:** **5/5**. **Business:** **3/5**, potentially stronger as a developer product attached to idea 1 than as another general eval platform.

### Idea 4 — A million dormant computers in R2

- **Pitch:** “An address per computer, stored as bytes while it waits, with no retained execution VM.”
- **Who uses it:** agent-service operators with very high dormant/active ratios and intermediate state worth preserving.
- **Newly possible [P]:** inactive *execution continuations*, rather than just inactive agent records, survive as snapshots and resume on demand.
- **Already exists [F]:** hibernating DOs, Workflows waits and filesystem snapshots. **Why these can fall short [I]:** none preserves the whole unsupported program's running state. For a typical agent whose memory is already in SQLite, they are enough.
- **Primitive dependency:** planned durable checkpoints, sparse/shared storage and reliable resume fleet; R2/DO integration is straightforward relative to the VM machinery.
- **Effort [I]:** 2–4 weeks for the control/storage plane after snapshot support; multi-month load, restore-storm, retention and billing validation. A million metadata rows is not a million-computer execution benchmark.
- **Demo/social:** **5/5** if actual checkpoint bytes and restored samples are shown. **Business:** **2/5** standalone; mostly a scale proof for idea 1. Storage being cheap is not a complete customer product.

### Idea 5 — Per-run hardware execution for self-hosted Workers/OS

- **Pitch:** “Keep the Workers capability model on your infrastructure, add a hardware boundary for selected untrusted executions.”
- **Who uses it:** enterprises self-hosting OS/workerd with specific isolation or offline requirements; not customers needing unrestricted Linux desktops.
- **Newly possible [I]:** a narrowly supported run crosses into a per-run hardware VM without placing credentials or general host/network access in that guest; durable continuation follows later.
- **Already exists [F]:** workerd inside a VM, hosted Containers, and the announced workerd/celld self-hosting effort. **Why these can fall short [I]:** coarse enclosing VMs may cost more per tenant/run; our narrow ABI may be easier to constrain. These are deployment-specific claims needing measurements and a threat model, not automatic security superiority.
- **Primitive dependency:** built VM and tool channel; planned checkpointing only for long-lived runs. Audits and host lifecycle matter at least as much as guest-kernel line count.
- **Effort [I]:** 4–8 weeks for a limited demonstrator; multi-quarter security/support work for enterprise deployment.
- **Demo/social:** **3/5**. **Business:** **3/5**, only with an identified buyer requirement and willingness to accept the compatibility limits.

### Idea 6 — Content-addressed capability computers/skills

- **Pitch:** “A reusable skill references the exact computer image, resource bundle and grant request it needs.”
- **Who uses it:** plugin/skill authors and platforms distributing repeatable constrained computations.
- **Newly possible [P]:** a resumable machine's kernel/binary/resource identity becomes a verifiable cache key and execution artifact, rather than merely a source-code bundle.
- **Already exists [F]:** Agents Skills, Computer bundles, Artifacts, Dynamic Worker version IDs and OS Blueprints. **Why these can fall short [I]:** none inherently identifies the custom machine state/ABI/grant contract. If scripts plus a Wasm runtime work, a machine image adds operational complexity without new user value.
- **Primitive dependency:** planned content-addressed images, manifests, deterministic replay and optionally checkpoints; grant requests must be resolved per user, never baked-in live credentials.
- **Effort [I]:** 3–6 weeks for a manifest/cache prototype after the image format settles; a viable distribution ecosystem is much longer.
- **Demo/social:** **4/5**. **Business:** **2/5** standalone; useful packaging for the first two ideas.

## 8. (d) What Cloudflare could ship in the next twelve months

These are **[I] forecasts**, not reported plans. Confidence is relative to the public signals above.

| Possible shipment by October 2027 | Confidence / basis | Effect on Sofort |
| --- | --- | --- |
| Better Computer/Think integration, stable interruption/replay, broader framework support | High: existing APIs, examples and experimental recovery work | Kills generic “stateful code mode” positioning; validates a backend seam but lowers willingness to pay for transparent resume |
| Faster/cached Containers with richer disk snapshots, cloning and better lifecycle management | High: September redesign and current snapshot APIs | Kills native-boot-only pitches for many workloads; validates per-agent machines and the need for persistent execution resources |
| Broader Dynamic Workflows and automated wrapping of generated tools/steps | High: already shipped dynamic execution and durability separately and together | Can cover most approval/sleep use cases without machine checkpoints; strongest near-term substitute |
| More language/WASI/JSPI support, packages and startup snapshot coverage | Medium-high: existing Python snapshots, active V8 work, contributor WASI proposal | Shrinks static-binary/Wasm-port gap; startup snapshots alone do not kill mid-execution continuation |
| Memory/process checkpoints for Containers, beyond filesystem snapshots | Medium-low: technical adjacency, but no public commitment found | Major threat; kills much of the native continuation wedge if restore cost/density/authority semantics are competitive |
| Durable arbitrary JS continuations at host-call boundaries, via interpreter/checkpoint machinery | Medium-low: direct market need and existing replay systems, but no verified workerd running-isolate API | Could kill the JS portion cheaply without preserving native VM execution; would strongly validate demand |
| A tiny custom-guest/microVM tier under Workers/Computer | Low-to-medium: adjacent Firecracker infrastructure plus public purpose-built-computer discussion; no verified implementation | Closest kill scenario, particularly if first-party networking/storage/pricing outweigh our technical edge |
| Much easier portable/self-hosted Workers and DOs through Deno/celld integration | High on direction, uncertain on dates/completeness | Kills “portable Cloudflare primitives” as a differentiator; may create more customers for optional hardware executors |

**[I] What would actually kill the thesis:** a supported Cloudflare API which takes a running generated program, durably parks its continuation at a capability call, releases active memory, restores on another host without redoing the prefix, handles granted resources safely, and does so at comparable economics for the supported workloads. A disk snapshot or initialized-isolate snapshot is not that API. Neither is “resume where you left off” marketing without a precise execution contract.

**[I] Watch list:** PR #7880 and successors; Computer's interruption API/status changes; Agents fiber recovery design; Dynamic Workflows ergonomics; Container documentation changing “not memory or running processes”; any public custom-kernel/nested-KVM API; WASI issue #7813; OS Gatekeeper capability lifetime/recovery. A bounded quarterly audit is more useful than treating the podcast as a purchase order.

## 9. (e) Would Cloudflare want this?

### 9.1 Credible partnership/integration story

**[I] Yes, conditionally:** “You have agent identities, capabilities, databases and distribution. We supply a small, language-independent continuation backend between Dynamic Workers and full Linux sandboxes.” The win is completing their product ladder without asking users to leave Agents/Computer/OS or move credentials into generated code. An R2/DO integration also creates Cloudflare usage while our service owns the specialized execution capacity.

**[I] Good initial asks:** technical feedback on the Executor/Computer adapter; a reference integration/example; confirmation of supported capability/session semantics; access to representative workloads; eventually infrastructure evaluation below the Container abstraction. Do not start by asking for general nested KVM access or a marketplace commitment.

**[I] Credible adoption sequence:** open reference adapter and reproducible failure demo → a few customer workloads where replay/steps cause measurable pain → independent security/performance validation → native backend evaluation. Cloudflare should be able to reject the runtime and still use the adapter's durable execution contract. That makes the work useful without a partnership deal.

### 9.2 Acquisition story: possible, not a strategy

**[F]** Cloudflare has acquired adjacent developer/runtime teams, including PartyKit and, as of October 9's announcement, Deno. **[I]** This establishes willingness to bring runtime expertise into the platform, not evidence of interest in Sofort. A small unbuilt checkpoint feature is easy to dismiss or build internally. A validated native continuation format, exceptional measured density/restore behavior, audited host mediation, and users demanding it would make a build-versus-buy discussion credible. The kernel-growth loop could add value if it reliably expands compatibility; differential syscall tests alone are not a security proof. [PartyKit](https://blog.cloudflare.com/cloudflare-acquires-partykit/), [Deno](https://blog.cloudflare.com/deno-joins-cloudflare/).

**[I] Reasons they might not want it:** V8/Wasm handles most agent glue; Containers handles the compatibility tail; a third runtime increases maintenance and security responsibility; snapshot compatibility and capability renewal are hard; an external fleet breaks their locality advantages; replay may solve enough at lower complexity. “Sunil said unikernels” is not enough to overcome any of these.

### 9.3 The demo their developer audience might amplify

**[I] Title:** **“Cloudflare routes the computer. R2 stores it. The computer remembers where it stopped.”**

**[I] One short recorded sequence, with source and a rerunnable command:**

1. Start an Agent/Computer run through a Worker. Show the DO address and a supported QuickJS/Lua program with local variables, a closure and a computed checksum. It prepares a batch of API changes, then reaches a genuinely unsimulatable approval/tool result.
2. Park the VM at that boundary. Show measured checkpoint bytes, shared-base bytes, time to durable acknowledgement, and resident VM count dropping. These must be real measurements; no “1 MiB” label borrowed from a RAM target.
3. Kill the executor process/host. Restart the DO too, so the demo cannot be explained by a surviving JS closure. Close and reopen the UI; the logical computer address remains the same.
4. Approve through the Worker. Restore on a second compatible KVM host, deliver the same call's recorded result, and show the program continuing inside the function with its local checksum intact. Show that the already-completed mutating call did not execute a second time, explaining the downstream idempotency key used.
5. Optionally fork the checkpoint into ten **read-only or simulated-effect** branches with different tool responses. Display a compact comparison and a shared execution prefix. Do not fork production write authority ten ways.
6. Give an honest comparison: Dynamic Workers for fresh JS; Dynamic Workflows/Code Mode replay for ordinary durable scripts; Container snapshots for files; Sofort for this retained running-machine case. Report end-to-end latency including Cloudflare-to-host RTT.

**[I] Why this could travel:** it extends Cloudflare's actual Computer/Agents story, exposes Cloudflare's DO/R2 value, demonstrates the exact distinction between files and a running continuation, and lets observers falsify it by killing hosts. A benchmark of VM boot alone is much less compelling to their users.

**[I] Tailor the technical explanation:** Kenton—capability lifetimes, promise identity and migration correctness; Matt—one narrow tool/Executor surface and framework composition; Sunil—purpose-built computers with measured density and real pause/resume; Dillon—reproducible code, versioned execution records and a visually clear branch/fork demo; Rita—an adoption path and a workload cost curve, including inference and operations rather than RAM alone. These are audience-fit hypotheses, not commitments from those people.

**[I] Demo now versus later:** today publish only the supported VM/Executor integration and local measurements. The host-kill/resume/fork sequence is gated on planned snapshot functionality. Until implemented, put it in a design document or explicitly labeled animation, never an implied live product demo. No outreach or posting was performed for this research.

## 10. Evidence quality, corrections, and next validation

**[F]** Read the requested brief, both prior Cloudflare reports and the supplied podcast transcript; inspected the local OS, Computer, Agents, Cap'n Web and workerd checkouts; checked current official docs/blogs and live GitHub issue/PR metadata. Existing repositories were read without modification. This report is the only intended write.

**[I] Corrections to carry forward:**

- Computer is real and independent from OS; the OS metaphor is not a unikernel.
- Dynamic Workers supports Python and Wasm, with important startup/ABI limits.
- Durable generated programs already exist through Dynamic Workflows, not only predeclared applications.
- Code Mode already has durable approval replay; fibers already have JSON recovery checkpoints.
- September Container snapshots are files, explicitly not process/memory continuation.
- Sandbox SDK 1.0 moves command/lifecycle control into application DO code; new MCP servers use the stateless handler rather than deprecated `McpAgent`.
- workerd already has startup snapshot work and Python memory bootstrap; absence of *all* snapshotting would be false.
- Hosted Workers defense in depth and Firecracker Containers invalidate “Cloudflare is only an isolate boundary.”
- A remote Executor is feasible; self-serve KVM inside Containers was not verified.
- Current lifecycle docs are newer than some issue reports and stale preview docs; pending I/O details must use the October page.
- Generic self-hosting differentiation weakened further with the Deno/workerd/celld announcement.

**[I] Next experiments, in order:** (1) a real compatible external Code Mode call with complete RTT and costs; (2) a minimal snapshot preserving local state at a tool boundary and surviving host loss; (3) crash-window tests around tool dispatch/result persistence with idempotent and non-idempotent test services; (4) reauthorization and session rebinding after expiry/revocation; (5) matched comparison against Dynamic Workflows and Code Mode replay; (6) measured checkpoint size, shared memory, restore storms and native-program compatibility. Those tests decide whether this is a product gap or an elegant implementation detail.

## Top three, ranked

1. **Resumable Code Mode executor / narrow Computer backend.** Best fit with Cloudflare's actual architecture and the clearest missing execution property. Build the adapter on today's VM, then earn the stronger continuation claim with a host-kill test. Demo **5/5**, business **4/5**; core differentiation **planned**.
2. **Native tool coprocessor for Workers agents.** Most actionable with the built primitive; find one real supported static program whose Wasm/container alternative is measurably worse end to end. Demo **4/5**, business **3/5**; initial runtime **built**, breadth unproven.
3. **Forkable agent computation/policy test bench.** Strongest distinctive follow-on demonstration and developer utility once snapshots work; preserve computation while suppressing duplicate real-world effects. Demo **5/5**, business **3/5**; core mechanism **planned**.
