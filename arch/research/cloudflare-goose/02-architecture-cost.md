# Sofort’s portable tier on Cloudflare: architecture, constraints and cost

Research cutoff: **2026-10-25**. Public documentation and source inspected at this cutoff; no Cloudflare account, login, deployment, or outreach was used. This is a research design, not a deployed system. The existing Wasm spike supplies the continuation evidence; this lane did not rerun its benchmarks. Read in context with [the brief](BRIEF.md), [v1 scope](../../V1.md), [Cloudflare signal](../primitive/04-cloudflare-signal.md), and [Wasm portability evidence](../portability/02-wasm.md).

**Labels throughout:** **[S] sourced** public fact or published price; **[M-prior] measured** in the cited existing local spike, not independently measured here; **[E] estimated** workload, arithmetic, proposed behavior, effort, or judgment. Numbers inside a table inherit its caption’s label unless explicitly marked otherwise. USD, before tax; decimal GB for pricing, binary KiB/MiB for explicitly binary sizes. Section numbers and protocol versions are identifiers, not measurements.

## 1. Decision

**[E] Build a small continuation runtime and a reference Cloudflare adapter, not another hosted agent platform.** A Worker authenticates; a SQLite Durable Object owns each computer’s address, journal and fencing epoch; R2 stores immutable capsules; a Dynamic Worker runs the exact QuickJS-Wasm image for one tenant/run identity. At a tool call the guest returns to a quiescent Wasm boundary, its state is saved, and all handlers finish. A later event restores that state on a fresh executor. Forking makes new branch identities referencing the same checkpoint, with separately authorized future effects.

Three findings constrain the pitch:

1. **[S/E] Cheap sleep is already available.** DOs can persist state and return; Workflows can sleep without CPU billing; Code Mode already supports approval replay. Sofort adds retained computation and portable, inspectable branch points, not the first durable agent. [DO lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/), [Workflows pricing](https://developers.cloudflare.com/workflows/reference/pricing/), [Code Mode runtime source](https://github.com/cloudflare/agents/blob/321814b6c13f72cff82161e7eb20312574ac9b7a/docs/codemode/runtime.md).
2. **[S/E] Dynamic Worker creation can dominate the bill.** Published pricing is **$0.002 per unique Worker ID/code combination used per day**, after the published monthly inclusion. A fresh ID for every resume costs approximately **$2,000 per million resumes**, before storage and execution. Prefer a stable tenant/runtime-version ID when isolation requirements permit; retain run identity in the DO and request data. [Dynamic Workers pricing](https://developers.cloudflare.com/dynamic-workers/pricing/).
3. **[E] Goose is optional research, not the critical path.** Flat values simplify data transfer, but do not serialize an active C stack, program counter, queues, or effects. QuickJS’s existing heap continuation is the fastest route to a credible demo. Do not rewrite Sofort or expand the [local native-tool v1](../../V1.md) for this lane.

## 2. Platform facts at the cutoff

### Workers and Wasm

**[S] Current limits:** **128 MB per isolate**, shared across concurrent requests and including JS/Wasm memory; HTTP CPU **10 ms Free**, **30 s default Paid**, configurable to **300 s**; startup **1 s**. Current Workers limits list a **64 MiB Worker size** for both plans. Paid subrequests default to **10,000**, configurable higher; **6** connections may simultaneously await response headers. HTTP has no fixed wall-time limit while connected, but runtime replacement and disconnects terminate work; `waitUntil()` supplies at most **30 s** afterward. These are execution constraints, not persistence. [Workers limits, updated Oct 12](https://developers.cloudflare.com/workers/platform/limits/).

**[S] Wasm:** import a precompiled module and instantiate it; Workers supports SIMD, but no Worker threads. General WASI remains experimental/incomplete. The normal API does not let an application compile arbitrary Wasm bytes through unrestricted `WebAssembly.compile`; Dynamic Workers’ `{wasm: ArrayBuffer}` module loader is the relevant runtime loading path. [Wasm support](https://developers.cloudflare.com/workers/runtime-apis/webassembly/), [Dynamic Worker module types](https://developers.cloudflare.com/dynamic-workers/api-reference/).

**[E] Consequence:** ship a trusted interpreter module with explicit host imports, not a Linux/WASI compatibility promise. A compressed capsule must be bounded by its **decompressed** memory size plus interpreter/JS/copying overhead. A small resident-instance measurement does not give permission to pack arbitrarily many instances into one isolate. Pin the module, shim ABI, feature baseline and compatibility date.

### Startup snapshots and workerd PR #7880

**[S] PR [#7880, “Enable minimal snapshot roundtrip”](https://github.com/cloudflare/workerd/pull/7880) was open and unmerged when checked; GitHub metadata last updated Oct 23.** Its implementation consumes an initialization snapshot generated by a disposable zygote so eligible Workers avoid evaluating top-level code again. It is behind `STARTUP_SNAPSHOT`; the PR description excludes Python, ScriptSource and Wasm cases and additionally requires `typescript_implemented_streams`. Failures fall back to ordinary initialization. [Live API metadata](https://api.github.com/repos/cloudflare/workerd/pulls/7880), [patch](https://github.com/cloudflare/workerd/pull/7880/files).

**[E] It is neither a public arbitrary-request checkpoint API nor evidence of portable suspended V8 stacks.** Do not budget a startup speedup for Sofort’s Wasm path from this PR. The cold-start optimization is adjacent roadmap work and a warning that Cloudflare is investing here, not the same primitive as a post-tool capsule.

### Dynamic Workers

**[S] API and isolation:** configure `worker_loaders`; `env.LOADER.load(code)` creates a fresh Worker; `get(id, callback)` caches by stable identity but never guarantees the same isolate across calls. `WorkerCode` supplies `mainModule`, modules including Wasm bytes, environment bindings, compatibility date and limits. `globalOutbound: null` blocks global HTTP/TCP access; omission inherits the parent’s outbound network. Give only selected capabilities. The product explicitly documents untrusted code and user-uploaded platform apps. [Overview](https://developers.cloudflare.com/dynamic-workers/), [API](https://developers.cloudflare.com/dynamic-workers/api-reference/).

**[S] Limits:** at most **4 distinct in-flight Dynamic Workers per ordinary Worker request**, **10 per DO’s shared I/O context**. Per-invocation `cpuMs` and `subRequests` can lower resource limits; reaching a limit throws, rather than creating a checkpoint. [Concurrency limits, Aug 27](https://developers.cloudflare.com/dynamic-workers/platform/limits/), [custom limits, Oct 12](https://developers.cloudflare.com/dynamic-workers/usage/limits/).

**[S] Billing:** Workers Paid required; requests and CPU share Workers Standard allowances/rates, but Dynamic Workers charge both isolate startup CPU and execution CPU. Daily unique creation depends on **both ID and code**; `load()` counts each invocation as a creation. Stable identity saves repeat daily creation charges, not durable memory. [Pricing](https://developers.cloudflare.com/dynamic-workers/pricing/).

**[E] Use one logical sandbox identity per run for the strict demo; offer one per tenant/runtime version for repeated production resumes.** Keep the wrapper/Wasm/config immutable for a given ID. Do not bake a new capsule, run-specific binding or source string into `WorkerCode` on every resume: pass data per request, instantiate fresh Wasm memory, and discard it when finished. The tenant variant retains an isolate boundary between tenants, not a guaranteed separate isolate between simultaneous runs of the same tenant.

### Workers for Platforms (WFP)

**[S] This is the explicit multi-tenant application product:** a dispatch namespace contains deployed user Workers; a dispatcher selects a user Worker, with optional outbound Worker and custom CPU/subrequest limits. Namespaces default to untrusted mode, with separated caches and no `request.cf`; their user Workers avoid ordinary per-account script-count limits. This is distinct from the runtime Worker Loader. [Overview](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/), [architecture](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/how-workers-for-platforms-works/).

**[S] Published plan:** **$25/month**, **20M requests**, **60M CPU-ms**, **1,000 scripts**; overages **$0.30/M requests**, **$0.02/M CPU-ms**, **$0.02/additional script/month**. Dispatch → user → outbound is billed as one request, with CPU summed. Its pricing page still lists **30 s CPU/invocation**; do not silently apply ordinary Workers’ newer maximum to WFP. [WFP pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/).

**[E] A WFP-deployed trusted Wasm runner per tenant is an alternative execution adapter.** It trades runtime code-loading flexibility for explicit platform packaging and monthly script economics. Do not assume buying WFP automatically changes Dynamic Worker prices or that every binding/product can be nested inside WFP. Notably, Workflows’ current limits explicitly say Workflows cannot be deployed in WFP namespaces. [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/).

### Durable Objects: storage, alarms and hibernation

**[S] Use SQLite-backed objects.** Object count and Paid aggregate storage are unlimited; one object has **10 GB** storage. SQLite KV’s **combined key + value maximum is 2 MB**; a SQL string/BLOB/row also maxes at **2 MB**. Legacy KV-backed objects instead have **2 KiB keys and 128 KiB values**, and are restricted to existing eligible namespaces. Paid CPU is **30 s default**, configurable to **5 min**. A single object is single-threaded, with a documented soft throughput limit around **1,000 requests/s**. [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/).

**[S] SQL storage supports transactions, strongly consistent per-object state and point-in-time recovery of the database.** It does not persist the JavaScript heap. [SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/). **[E] Put manifests and small journals here, not whole computers or large tool responses.** Even where a compressed capsule fits the value limit, R2 decouples capsule growth and retention from DO coordination.

**[S] Hibernation discards memory and reruns the constructor.** It requires no active request/event, scheduled JS timer callbacks, unfinished I/O/`waitUntil()`, open outbound connection, or standard WebSocket API use. Hibernatable incoming WebSockets can remain connected, without preserving the application heap. Eligibility currently leads to hibernation after about **10 s**; eligible idle time is already unbilled. Pending operations can prevent eviction for up to **15 min per operation**, not guaranteed unlimited survival. Deployments and runtime changes can still interrupt work; there is no reliable shutdown callback. [Lifecycle, Oct 15](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/).

**[S] Alarms:** one scheduled alarm per object; at-least-once execution; exceptions cause exponential retries starting at **2 s**, up to **6 retries**. Persist several deadlines in a table and use the one alarm for the earliest. An alarm is a fresh handler, not a saved async call stack. [Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/).

**[E] Never leave the computer DO awaiting a human, LLM stream, outbound WebSocket, or long-running tool.** Save a durable job reference, finish the handler, and wake on a callback/alarm. This is essential for both cost and recoverability.

### R2 and Queues

**[S] R2** provides strongly consistent object reads/writes; caches can still serve stale data. Bucket object count/storage have no documented upper limit. Objects are roughly **5 TiB maximum**, with roughly **5 GiB single-part uploads**; **one write/s to the same key** is the relevant hot-key restriction. [Consistency](https://developers.cloudflare.com/r2/reference/consistency/), [limits](https://developers.cloudflare.com/r2/platform/limits/).

**[E] Use private bindings and immutable, tenant-scoped content hashes.** Upload first, publish the pointer second. A mutable `latest` R2 key is unnecessary and risks write throttling. Store the authoritative head in the DO. A cross-DO/R2 transaction does not exist; orphan collection must be reference-aware. Do not expose capsule memory through a public bucket or treat a hash alone as access control.

**[S] Queues** has at-least-once, unordered delivery. Limits include **128 KB messages**, **100/message batch**, **5,000 messages/s per queue**, **250 concurrent push consumers**, **25 GB backlog**, and **14-day maximum retention** on Paid (**4 days default**, versus **24 h Free**). [Delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/), [limits](https://developers.cloudflare.com/queues/platform/limits/), [pricing](https://developers.cloudflare.com/queues/platform/pricing/).

**[E] Queue only computer/effect IDs and epoch references.** A compressed capsule near the message ceiling is still the wrong payload. A Queue is a wake-up/retry transport; the DO journal is the long-lived source of truth, including approvals waiting beyond retention. Use a transactional outbox plus an alarm to repair enqueue failures.

### Workflows and Dynamic Workflows

**[S] Workflows persists explicit step outputs, sleeps and event waits; steps need idempotent external behavior when retried.** Dynamic Workflows uses `@cloudflare/dynamic-workflows`, a Worker Loader and a Workflow entrypoint to reload the appropriate tenant code. Its helper functions include `wrapWorkflowBinding` and `createDynamicWorkflowEntrypoint`; code is loaded at runtime rather than separately deployed for each workflow. [Rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/), [Dynamic Workflows guide](https://developers.cloudflare.com/dynamic-workers/usage/dynamic-workflows/).

**[S] Current Paid limits:** **50,000 running instances/account**, **300 creations/s/account and 100/s/workflow**, **2M queued instances**, **1 MiB non-stream step result/event payload**, **1 GB persisted state/instance**, **365-day sleep**, **10,000 steps default**, configurable to **25,000**. Waiting instances do not consume running concurrency slots. The page’s explanatory prose still says 10,000 concurrent instances; its table and [April changelog](https://developers.cloudflare.com/changelog/product/workflows/) state 50,000. Worker-size prose on this page is also older than current Workers limits. [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/).

**[E] Millions of sleeping workflows already work conceptually; millions of simultaneously waking workflows need backpressure.** For small explicit JSON state and ordinary approvals, use this product. Sofort should not invent durable scheduling to replace it.

### Containers, Sandbox SDK and `/dev/kvm`

**[S] Containers runs native Linux images inside Firecracker microVMs, controlled through Workers/DOs.** Current smallest predefined `lite` is **256 MiB and 1/16 vCPU**; largest predefined is **12 GiB and 4 vCPU**. Default account quotas include **6 TiB memory and 1,500 vCPU**. [Architecture](https://developers.cloudflare.com/containers/concepts/architecture/), [limits, Oct 21](https://developers.cloudflare.com/containers/platform/limits/).

**[S] Current container snapshots capture filesystems, excluding memory and processes**, are tied to the source image version, and require the `durable_object` scheduling policy. Retention is **30 days**, refreshed by restore. A snapshot can restore from another DO. [Snapshots](https://developers.cloudflare.com/containers/guides/snapshots/).

**[S] Billing** uses **10 ms** increments; provisioned memory/disk and active CPU, with Workers and DO charges additional. Paid overages are **$0.0000025/GiB-s memory**, **$0.000020/vCPU-s**, **$0.00000007/GB-s disk**, plus regional egress. [Container pricing, Oct 5](https://developers.cloudflare.com/containers/platform/pricing/).

**[S/E] Is `/dev/kvm` exposed? Unknown.** The reviewed architecture, instance limits and [Container start API](https://developers.cloudflare.com/containers/api/durable-object-container/) supply no customer nested-KVM guarantee or device-pass-through option. Searching these documents for KVM/nested/device privileges found no affirmative support. Firecracker on Cloudflare’s host does not establish guest virtualization extensions or a usable `/dev/kvm`. Local Docker privileges/FUSE are not evidence about production. No account-based probe was permitted. **The proposed Wasm tier needs no KVM; a native jitk tier must remain external unless support is actually established.**

**[S] Sandbox SDK 1.0 changes the integration:** application-owned DOs call `this.ctx.container`; command arguments use arrays, and app code owns lifecycle, process records, snapshot handles and retries. Do not implement against old package-owned Sandbox DO/server assumptions. [Migration, Oct 23](https://developers.cloudflare.com/sandbox/sdk/migrate/changes-in-1-0/). **[E] It is a useful native tool capability/provider, not Sofort’s portable continuation engine.**

### Cloudflare Computer, Agents SDK and Code Mode

**[S] Cloudflare Computer is a persistent Workspace runtime, separate from Cloudflare OS.** Its DO-backed SQLite filesystem is authoritative; backends include isolate JavaScript, isolate shell and Containers. At inspected commit `2b23503`, some runtime/backend surfaces are experimental. Active Worker executions cannot be serialized across host restart; orphaned running records become failed. [Package status](https://github.com/cloudflare/computer/blob/2b23503eac1f4efa8403908e472c472f747b61f7/packages/computer/README.md), [runtime contract](https://github.com/cloudflare/computer/blob/2b23503eac1f4efa8403908e472c472f747b61f7/docs/05_runtime_interface.md).

**[S] Agents SDK provides state, communication, scheduling, MCP and execution/recovery primitives.** Its fiber recovery uses explicitly stashed data and recovery hooks, not serialization of the original lambda. [Agents docs](https://developers.cloudflare.com/agents/), [pinned durable-execution contract](https://github.com/cloudflare/agents/blob/321814b6c13f72cff82161e7eb20312574ac9b7a/docs/agents/durable-execution.md).

**[S] Code Mode’s executor seam**, at inspected Agents commit `321814b6`, is `execute(code, providersOrFns, options?) -> Promise<ExecuteResult>`. Inputs include resolved provider functions/preludes and optional connector bindings; results have a value, optional error and logs. Implementations return errors as data. [Executor interface](https://github.com/cloudflare/agents/blob/321814b6c13f72cff82161e7eb20312574ac9b7a/packages/codemode/src/executor-types.ts).

**[S] Its durable runtime already aborts at approvals and replays recorded tool results.** It requires deterministic code up to tool boundaries, offers `codemode.step()` for nondeterminism, warns against concurrent connector calls in pausable runs because arrival ordering can change, and documents the executing/result-recording crash window. [Runtime contract](https://github.com/cloudflare/agents/blob/321814b6c13f72cff82161e7eb20312574ac9b7a/docs/codemode/runtime.md).

**[E] Keep the synchronous Executor adapter for short calls, but add durable `start/status/resume/cancel/fork/export` receipts.** An unresolved `Promise<ExecuteResult>` is not a suitable API for waiting several days. The eventual Computer adapter should implement a narrow execution backend/handle surface, not promise complete shell/filesystem compatibility.

## 3. Terms, acceptable use and the platform product

### Documents actually read

**[S] Read the [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/) (last updated Sep 12, 2025), [Developer Platform service-specific terms](https://www.cloudflare.com/service-specific-terms-developer-platform/) (Sep 28, 2026), and [the linked abuse policy](https://www.cloudflare.com/trust-hub/abuse-approach/).** The operative general acceptable-use clauses are **Self-Serve §2.7**, supplemented by Developer Platform **§§4, 6, 8**. The reviewed agreement links its abuse approach from §2.7; a separate general document at the guessed `/acceptable-use-policy/` returned 404. This report does not substitute a reseller’s “AUP” or Cloudflare’s website-use terms for the actual customer agreement.

Selected short quotations below are exact excerpts; the surrounding obligations are paraphrased with clause references so the quoted fragments do not conceal their context.

| Document / clause [S] | Exact excerpt [S] | Practical reading [E] |
| --- | --- | --- |
| Self-Serve §2.2.1(a) | “sell access to the Services to any third party” | General restriction applies unless Cloudflare expressly permits it in writing. Do not infer blanket infrastructure resale rights from having an API token. |
| Self-Serve §2.2.1(c) | “intended to circumvent Service-specific usage limits” | Splitting a request cannot be marketed as a loophole around CPU limits or quotas. |
| Self-Serve §2.7(d) | “phishing, spamming” | Sofort remains accountable for abusive use by its users. |
| Developer Platform §10 | “you may use Workers for Platforms” | Specific exception permits making certain Workers functionality available to end users on the customer’s Internet Properties, subject to agreement restrictions. |
| Developer Platform §4(i) | “crypto-mining software or other malicious code” | Sandbox isolation is not an exemption for prohibited content or activity. |
| Developer Platform §3 | “responsible for the acts of your End Users” | Platform operator owns support and abuse response obligations. |

Sources for the table: [Self-Serve §§2.2.1, 2.7](https://www.cloudflare.com/terms/), [Developer Platform §§3, 4, 10](https://www.cloudflare.com/service-specific-terms-developer-platform/).

**[S] Additional relevant obligations:** Self-Serve §2.2.1(b) prohibits undue burden/disruption; §2.2.2 permits published benchmarks provided replication information is made available. §2.7 also addresses unlawful material and malicious-code distribution. Developer Platform §4 requires documentation compliance; §8 allows blocking/removal and service suspension for prohibited hosted content. Its §5 expressly reserves Cloudflare’s ability to build competing products, without using customer content/confidential information. [Agreement](https://www.cloudflare.com/terms/), [Developer Platform terms](https://www.cloudflare.com/service-specific-terms-developer-platform/). The abuse policy distinguishes hosted Workers content, which Cloudflare can remove, from pass-through CDN content. [Abuse approach](https://www.cloudflare.com/trust-hub/abuse-approach/).

### Answer: is users’ untrusted code allowed?

**[E, interpretation of the sources] Yes: untrusted customer/AI code is an explicit intended use of both Dynamic Workers and Workers for Platforms.** There is no general rule here that “all untrusted code on Workers is forbidden” or that merely interpreting user code in Wasm violates the terms. [Dynamic Workers use cases](https://developers.cloudflare.com/dynamic-workers/), [WFP use cases](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/).

**[E] The commercial permission has a sharper boundary:** WFP has the express contractual end-user exception. Dynamic Workers’ platform-use documentation is strong evidence of supported intended use, but the reviewed Developer Platform §10 names WFP and does not separately name Dynamic Workers. Therefore a paid compute-on-compute service built solely on ordinary Paid Workers + Loader should not claim an unqualified resale exemption. Use WFP’s documented route or obtain explicit written coverage for the intended Dynamic Worker service before a commercial launch. This research contacted nobody and made no account changes; local prototyping can proceed without resolving a commercial contract.

**[E] CPU slicing:** the Workers limits docs themselves recommend processing smaller chunks across requests. Genuine durable work at tool/event boundaries is not automatically prohibited. The risk is deliberately evading a configured limit: recursively invoking fresh Workers, generating artificial yield calls or new identities to continue an over-budget run, rotating accounts to multiply allowances, or selling “unlimited CPU” through such mechanisms. Enforce per-computer and per-tenant cumulative budgets as well as platform per-invocation limits, and stop or route genuinely long compute to Containers. [Limits guidance](https://developers.cloudflare.com/workers/platform/limits/), [Self-Serve §2.2.1(c)](https://www.cloudflare.com/terms/).

## 4. Proposed Cloudflare-native architecture

Everything in this section is **[E] proposed**, except the explicitly linked prior prototype observations. The portable tier is software isolation: **it does not inherit per-run jitk hardware isolation simply by sharing the Sofort name.** Hosted Workers supplies its own defense in depth; standalone workerd explicitly needs an enclosing security boundary for hostile code. [workerd warning](https://github.com/cloudflare/workerd#warning-workerd-is-not-a-hardened-sandbox).

### Ownership and persistent records

| Component [E] | Owns |
| --- | --- |
| Front-door Worker | Authentication, tenant authorization, idempotent command IDs, quotas, start/status/approve/resume/fork/cancel/export endpoints. Never returns raw bearer capabilities in a capsule. |
| Computer DO, named from tenant + computer UUID | One authoritative head and writer: module hash, capsule hash, branch parent, checkpoint number, epoch/lease, policy reference, lifecycle status, operation journal, durable outbox, next deadline. |
| R2 | Immutable module/base images, capsules and oversized tool results. Keys scoped to tenant plus digest; host-authenticated manifests. No mutable singleton head. |
| Executor Dynamic Worker | Exact trusted wrapper + QuickJS-Wasm image; restores one run into fresh memory, executes bounded work, returns a checkpoint candidate and tool intents. No ambient outbound access or raw R2/DO namespace binding. |
| Tool dispatcher + Queue | Claims journaled work, rechecks authorization, invokes approved services with durable effect IDs, records receipts/results, requests a later resume. Holds secrets outside guest memory. |
| Alarm / optional Workflow | Repairs pending outbox entries and expired leases, wakes due work. Workflows may orchestrate external long jobs, but do not wrap each guest instruction. |

The DO can invoke the executor for a **short bounded** slice and await it. Only the tool dispatcher may perform real external effects; the executor just returns intents. Thus losing the executor before a park commit repeats pure computation, not unjournaled effects. DO awaiting the brief slice is billed and modeled; DO awaiting the tool/human is forbidden by design.

Persist records conceptually as:

```text
computer(tenant, computer, branch, epoch, headHash, checkpointNo,
         moduleHash, deliveredCursor, status, leaseOwner, leaseUntil, policyRef)
effect(effectId, guestCallId, intentDigest, tool, policyVersion,
       state, resultHash, dispatchAttempt, remoteJobId, deliveredCheckpoint)
outbox(eventId, kind, effectId, nextAttemptAt, attempts)
command(commandId, inputDigest, receipt)
```

`effectId` is derived from computer/branch identity and a durable guest-call sequence, not the current execution epoch. **Retries reuse it.** The epoch is only a stale-executor fencing token. Reusing a command ID with different content is an error; callbacks with the same effect ID but conflicting results require reconciliation. Store guest call IDs and stable settlement order in both the checkpoint bridge metadata and journal.

### Effects protocol: prepared → dispatched → completed → delivered

| State [E] | Durable meaning | Safe recovery |
| --- | --- | --- |
| `prepared` | Authorized intent plus pending-call capsule/head and outbox entry committed in one DO transaction. No tool call may precede this. | Re-enqueue/claim the same effect; do not invent a new key. |
| `dispatched` | Dispatcher durably claimed an attempt and committed before attempting external delivery. This means “may have been sent,” not proof of receipt. | Query remote job/idempotency status or retry with the same key. If the remote has neither, preserve ambiguous status for operator/user resolution. |
| `completed` | Tool outcome/receipt durably recorded and immutable; possibly stored in R2 with a DO pointer. | Deliver the saved outcome to a restored guest; never rerun the tool merely because the guest did not acknowledge. |
| `delivered` | A successor capsule has been durably published whose guest state/cursor includes consumption of that outcome. | Restore that successor. Duplicate callbacks/resume commands return the existing receipt. |

There can be several pending effects. Persist IDs at emission and settlement ordering explicitly; do not identify calls only by arrival order. Initially support one awaited call to keep the protocol small, then add `Promise.all` with an atomic checkpoint containing every outstanding call. The existing spike’s two branch replies are not production proof of concurrent crash recovery.

### Sequence: run, park, wait and resume

```mermaid
sequenceDiagram
    participant U as Client or Agent
    participant F as Front-door Worker
    participant D as Computer DO + SQLite
    participant X as Dynamic Worker / QuickJS-Wasm
    participant R as R2 capsules
    participant Q as Queue + trusted dispatcher
    participant T as Tool or approval service
    U->>F: start(commandId, program, grants)
    F->>D: authorize + deduplicate command
    D->>D: commit epoch, lease, run intent
    D->>X: execute slice(image, input/head, epoch)
    X->>X: guest awaits tool; drain jobs, return to host
    X-->>D: checkpoint candidate + pending intent
    D->>R: PUT immutable capsule
    R-->>D: persisted object + hash
    D->>D: transaction: head + prepared effect + outbox + alarm
    D-->>F: durable parked receipt
    F-->>U: computer address / parked status
    Note over D,X: executor invocation ends; DO can hibernate
    D->>Q: send outbox event (retryable)
    Q->>D: claim effect under current policy
    D->>D: commit dispatched attempt
    D-->>Q: same effectId / remote idempotency key
    Q->>T: invoke(effectId, arguments)
    Note over D,T: no DO request held while awaiting a long job
    T->>F: completion or approval callback(effectId, result)
    F->>D: validate callback + store result
    D->>D: commit completed + wake outbox
    D->>R: GET current capsule
    D->>X: fresh slice(capsule, recorded result, new epoch)
    X->>X: restore exact image; resolve pending guest promise
    X-->>D: successor capsule + consumed cursor + next intents
    D->>R: PUT immutable successor
    D->>D: transaction: advance head, delivered, next prepared effects
    D-->>U: status via later request / hibernating socket
```

The diagram’s enqueue is a separate commit boundary: response acknowledgement relies on the durable outbox/alarm, not an unawaited `send()`. A short direct tool can return its result through the dispatcher; a long tool must provide an asynchronous job ID/callback or be managed by a Workflow/Container. A dropped ordinary fetch cannot be resurrected from guest bytes.

### Capsule and resume contract

**[M-prior] The existing spike captured 2,097,152 bytes of Wasm memory plus `__stack_pointer`, compressed to 99,854 bytes**, while preserving a QuickJS closure, cycle, Map and typed array across Wasmtime → Node/browser/local workerd/local Dynamic Worker. Both forks returned the expected divergent answers, with no newly emitted tool request on restore. This is one small program on one Mac, not hosted Cloudflare latency or a size bound for arbitrary programs. [Exact evidence and limitations](../portability/02-wasm.md#31-preferred-path-quickjs-heap-continuation-empty-wasm-stack).

At `await tool(...)`, QuickJS stores its continuation in its own heap; once control returns to the Wasm host and jobs/imports are quiescent, no active Wasm stack has to be captured. Save:

- Exact module/build hash, ABI and capsule-format version, memory size/pages, all mutable globals, and tables if mutable; exclude unsupported externrefs/host GC state.
- Guest heap, promise/job state, bridge queues, pending IDs/intent digests, reply-settlement order and delivered cursor.
- Virtual time, PRNG state and logical resources; never a host wall clock, live RPC stub, stream, socket, credential, or open database transaction.
- Tenant/computer/branch, parent checkpoint, epoch/checkpoint number, integrity/authentication and required capabilities/isolation level.

Restore the **same image**, grow memory within a hard cap, restore state and reconstruct imports from trusted logical grant references. Do not initialize QuickJS over restored memory. Reauthorize grants on resume and bind current host capabilities; a signed old capsule does not override revocation. Guest-supplied state remains untrusted: validate manifest lengths, decompression ceilings, ABI and effect arguments.

“Resume anywhere” means **a host implementing this pinned Wasm ABI and policy**, not an arbitrary browser with server authority. A browser can run a fork offline; its computed claims cannot authorize server effects. Wasm ↔ native jitk RAM transfer is not supported; cross-family migration requires replay or a shared inner Wasm runtime. An infinite CPU loop never reaching a tool boundary is killed at the configured budget and can only recover from an earlier checkpoint.

### Fork N ways and move

```mermaid
sequenceDiagram
    participant U as Caller
    participant P as Parent Computer DO
    participant R as R2
    participant Q as Fan-out Queue
    participant C as Child Computer DOs
    participant X as Fresh executor invocations
    U->>P: fork(commandId, committedHead, N, branch policy)
    P->>P: freeze head; persist deterministic child IDs + fork outbox
    P-->>U: branch receipts (creation can be pending)
    P->>Q: child-create messages (duplicates allowed)
    Q->>C: create child if absent
    C->>C: commit parent hash + independent epoch/effect namespace
    C->>R: GET shared immutable parent capsule
    C->>X: restore; inject branch-specific reply
    X-->>C: divergent checkpoint / result
    C->>R: PUT each changed capsule
    C->>C: commit independent branch head
```

A parent fork outbox makes child creation idempotent; the operation is not an atomic transaction across all children. Initial branches share an immutable capsule object, then materialize separate changed snapshots. Keep reference/retention records before garbage collection; simple short-lived prototype retention can avoid a distributed reference-counting system.

Fork **before dispatch** or at a committed `completed` outcome. A dispatched non-idempotent mutation has one owner; forks cannot inherit the right to resend it. Completed history may be shared. Future effects get branch-specific IDs and grants. Default branches are read-only/simulated; committing one branch does not undo other branches’ external writes. For comparison experiments, explicitly decide whether PRNG streams are identical or independently reseeded, and record that choice.

For a move, the DO revokes the old execution lease and increments the epoch before another executor can publish a head. Tool dispatch always checks the current fence through trusted coordination. This fences future authorized operations; it cannot retract a remote effect already accepted. The DO address stays the same while the executor disappears. There is no promise of manual placement of the DO itself, or zero-latency global migration.

Do not fan out N Dynamic Workers concurrently from one handler: ordinary requests allow four, and one DO context ten. Schedule branches through their own DOs/Queue and enforce account/tenant concurrency and spending limits. At the modeled **100M resumes / 30-day month**, mean traffic is only **38.6 resumes/s [E]**, but synchronized approval storms can exceed quotas by orders of magnitude.

### Failure cases and invariants

| Failure [E] | Required behavior |
| --- | --- |
| DO eviction/deploy while parked | Reconstruct from SQLite head/journal; no heap state or shutdown hook required. New constructor does not blindly overwrite an existing alarm. |
| DO restart while old slice still runs | Current epoch/head comparison rejects stale checkpoint publication. Old executor has no direct external-effect authority. |
| Worker crashes before uploading candidate | Restore previous committed capsule, reuse recorded results, rerun only unsaved local computation. |
| R2 upload succeeds, DO transaction fails | Blob is an orphan, never the authoritative head. Retry commit with expected epoch/head or garbage-collect after a grace period. |
| DO commits prepared/head, Queue send fails | Persisted alarm/outbox republishes. Duplicate publishes are harmless at claim time. |
| Dispatcher crashes after `dispatched`, before sending | Treat as possibly sent; query or resend same remote idempotency key. Dispatched state alone cannot prove absence of an effect. |
| Tool succeeds, Worker dies before result commit | Remote idempotency/job lookup recovers the receipt. Without either, retain ambiguous outcome and reconcile; no exactly-once claim. |
| Result committed, executor dies during delivery | Effect remains completed. Restore preceding head and deliver that recorded result again; uncommitted successor memory is discarded. |
| Successor saved, callback/resume delivered twice | DO command/result dedup and delivered cursor return the same receipt; same expected head can advance only once. |
| CPU/memory kill or incompatible capsule | No trap-time checkpoint is assumed. Stop with recoverable prior head or explicit failure; never silently use a different interpreter version. |
| Queue retention exhausted / alarm retries exhausted | Journal remains pending; expose stalled state and use bounded scheduled repair. Do not assume six automatic alarm retries guarantee progress forever. |
| Grant revoked / user cancels during execution | Persist decision/fence; refuse new effects and head advances as appropriate. An already accepted external operation may still finish and must be journaled. |
| Capsule corrupt/missing or R2 unavailable | Verify hash; retry storage failure; retain prior valid head if policy permits. Never acknowledge a durable park whose referenced bytes are unavailable. |

The useful guarantee is **durable, deduplicated transitions plus idempotent/reconcilable effects**, not universal exactly-once external execution. Completing an HTTP request and committing SQLite cannot be made one distributed transaction by snapshots.

## 5. What Sofort adds, and what would kill it

| Need [E] | DO + Workflows + Code Mode replay | Sofort portable tier |
| --- | --- | --- |
| Durable address, approvals, sleeps, retries | Already solves these; usually preferable. | Reuses them. |
| Small deterministic generated program | Replay recorded tool results is simple and often cheaper. | Extra interpreter/checkpoint machinery is hard to justify. |
| Closure/cyclic heap/partially computed state | Must reconstruct through replay or explicit serialization/step design. | Preserves pinned QuickJS heap at a tool boundary. |
| Expensive pure computation before a wait | Can store explicit results at authored steps. | Captures opaque intermediate state without rewriting guest source into workflow steps. |
| Fork an existing decision point and change the next reply | Re-execute prefix or author/export branch state. | Clone the checkpoint; retain shared history; no prefix computation. |
| Export continuation to a browser/Node/Wasmtime | Not a portable running-state artifact in those products. | A defined capsule works across qualified hosts using the same Wasm image. |
| Arbitrary native Linux tools / full environment | Containers/Sandbox already handle these. | Wasm recompilation/ABI only; native jitk remains a separate tier. |
| Exactly-once mutations | Needs downstream idempotency/transactions/reconciliation. | Same requirement. |

**[S/E] Prior art is strong.** Golem records external interactions and reconstructs execution through oplog replay; user-defined snapshots accelerate recovery, and it already has fork APIs. [Durability](https://learn.golem.cloud/v1.6/concepts/durable-execution), [snapshotting](https://learn.golem.cloud/v1.6/develop/snapshotting), [forking](https://learn.golem.cloud/v1.6/develop/forking). E2B preserves process memory and supports pause/fork, while Daytona now distinguishes container filesystem snapshots from VM memory snapshots. [E2B persistence](https://docs.e2b.dev/sandbox/persistence), [Daytona snapshots](https://www.daytona.io/docs/snapshots/). Hyperlight already weakens any density-only hardware claim; the existing local research found comparable tiny-instance memory, not an order-of-magnitude universal lead. [Existing comparison](../portability/02-wasm.md).

**[E] Cloudflare can erase the narrow gap** by adding continuation-preserving Wasm/tool boundaries or native checkpoint support behind Computer/Code Mode, or making its replay path sufficient for target programs. Startup snapshots are not that API today, but Computer + Dynamic Workers + Workflows + DO facets leave little product surface unoccupied. A compact open-source capsule ABI, excellent crash semantics and a convincing fork/move demo are a career-scale contribution; an acquisition thesis or generic “cheap sandbox” company is not established.

## 6. Cost model

### Published rates used

All entries in this table are **[S] published prices/allowances**, checked at the cutoff. These are public list rates, not committed-volume quotes. Allowances are **account-wide and applied once**, not per computer, worker or tenant.

| Meter | Published rate / included usage | Source |
| --- | --- | --- |
| Workers Standard | $5/month minimum; 10M requests and 30M CPU-ms included; then $0.30/M requests and $0.02/M CPU-ms | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Dynamic Worker creation | 1,000 unique creations/month included; then $0.002 per distinct ID/code/day; startup CPU also billed | [Dynamic pricing](https://developers.cloudflare.com/dynamic-workers/pricing/) |
| DO requests/duration | 1M requests and 400k GB-s included; $0.15/M requests; $12.50/M GB-s; allocated 128 MB billed while active/non-hibernatable | [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| DO SQLite | 25B rows read, 50M rows written, 5 GB-month included; then $0.001/M reads, $1/M writes, $0.20/GB-month | [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| R2 Standard | 10 GB-month, 1M Class A, 10M Class B included; then $0.015/GB-month, $4.50/M A, $0.36/M B; no egress fee | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| Queue | 1M operations/month included, then $0.40/M; small delivered message normally takes 3 operations; each 64 KB chunk separately metered | [Queue pricing](https://developers.cloudflare.com/queues/platform/pricing/) |
| Workflows | Shared Workers CPU/request meters; 500k steps/month included, then $0.80/100k; 1 GB-month included, then $0.20/GB-month | [Workflows pricing](https://developers.cloudflare.com/workflows/reference/pricing/) |

**[S] Important meter details:** DO deletes and `setAlarm()` count as row writes; indexes/hidden state can amplify rows. DO compute/request overage is rounded up to published billing units; R2 also rounds up storage/operation units. Workflow sleeps/waits incur no CPU, but steps/storage are billed as of the published **Aug 10, 2026** start date. [DO billing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [R2 billing](https://developers.cloudflare.com/r2/pricing/), [Workflow billing change](https://developers.cloudflare.com/changelog/product/workflows/).

### Workload assumptions [E]

These are intentionally explicit so another lane can replace them with measured counters:

- **30-day month**; paused count `N` is the average retained population, not the number of monthly creations.
- One latest capsule per computer, **100,000 compressed bytes**, rounded from the **99,854-byte [M-prior]** test, not an arbitrary-program estimate. No retained history in the base case.
- **65,536 bytes total DO database storage/computer**, including manifest, bounded recent journal/outbox and database overhead. This is an unmeasured budget, not just JSON payload size. Idle DO has no live handler/socket/timer and consumes zero duration.
- A resume cycle processes one saved result, executes until the next tool boundary, writes one new capsule and schedules one small tool job. Budget **3 billed Worker invocations** (front door, Dynamic Worker, unbatched queue consumer), **4 DO requests**, **20 CPU-ms total Workers CPU including amortized startup/codec**, **250 ms total DO active wall time**, **10 SQL row writes and 20 reads**, **1 R2 GET and 1 PUT**, **1 delivered Queue message**. Actual scheduling/callback/repair choices can increase these counts.
- Includes no LLM/tool/API fees, observability, cross-provider network charges, large tool-result storage, initial population construction, long-job Workflows/Containers, retained checkpoint history, GC scanning, retry traffic, abuse, enterprise minimums or commercial WFP coverage. Those must be separately budgeted.
- `U` is the number of distinct Dynamic Worker ID/code/day combinations actually invoked during the month. It depends on active tenants, days and code changes, not paused population. With one invocation per cycle, `U ≤ R`; changing wrapper code or per-run environment/config can defeat reuse.

### Paused population, no activity [E]

Storage-only monthly overage, before the common $5 plan minimum. Applies aggregate inclusion then rounds overage GB upward. Initialization/writes are separate.

| Paused computers | R2 capsule GB | DO metadata GB | R2 storage $/month | DO storage $/month | Combined storage $/month |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 0.10 | 0.065536 | $0 | $0 | **$0** |
| 100,000 | 10 | 6.5536 | $0 | $0.40 | **$0.40** |
| 10,000,000 | 1,000 | 655.36 | $14.85 | $130.20 | **$145.05** |

Formula: `0.015 × ceil(max(0, N×100000/1e9 − 10)) + 0.20 × ceil(max(0, N×65536/1e9 − 5))`. A never-instantiated DO address costs no database space, but every actually parked computer in this design has stored coordination state. At high population, DO metadata dominates the tiny R2 capsule.

### Resume traffic before Dynamic Worker creation and retained storage [E]

| Monthly meter | 1M resumes | 100M resumes |
| --- | ---: | ---: |
| Workers minimum | $5.00 | $5.00 |
| Workers requests: `3R` | $0 | $87.00 |
| Workers CPU: `20R ms` | $0 | $39.40 |
| DO requests: `4R` | $0.45 | $59.85 |
| DO duration: `0.128 × 0.25 × R GB-s` | $0 | $37.50 |
| SQL writes: `10R` | $0 | $950.00 |
| SQL reads: `20R` | $0 | $0 |
| Queues: `3R operations` | $0.80 | $119.60 |
| R2 writes: `R Class A` | $0 | $445.50 |
| R2 reads: `R Class B` | $0 | $32.40 |
| **Subtotal** | **$6.25** | **$1,776.25** |

DO duration uses the documented allocated-memory billing convention and rounds positive excess GB-s to million-unit increments. A production call trace may batch Queue consumers and share DO activity, or add repairs and receipts. The table is a design budget, not an invoice prediction.

Add `0.002 × max(0, U − 1000)` for Dynamic Worker creations. Examples **[E]**:

| Identity pattern | Monthly `U` assumption | Creation surcharge |
| --- | ---: | ---: |
| Fresh run/worker for each of 1M resumes | 1,000,000 | **$1,998** |
| Fresh run/worker for each of 100M resumes | 100,000,000 | **$199,998** |
| 1,000 stable tenants active every day | 30,000 | **$58** |
| 100,000 stable tenants active every day | 3,000,000 | **$5,998** |

The last row requires at least that many invocations, so it cannot be combined with only 1M monthly resumes. Dormant computers incur no Dynamic Worker creation charge. A warm isolate disappearing and being reconstructed does not by itself change its stable daily ID/code billing identity.

### The six requested population/traffic combinations [E]

This deliberately shows the expensive **fresh worker per resume** case: subtotal + creation surcharge + paused storage. The strict per-run design can do better when the same run resumes repeatedly on the same day; use its actual `U`.

| Average paused population | 1M resumes/month | 100M resumes/month |
| ---: | ---: | ---: |
| 1,000 | **$2,004.25** | **$201,774.25** |
| 100,000 | **$2,004.65** | **$201,774.65** |
| 10,000,000 | **$2,149.30** | **$201,919.30** |

With **1,000 stable active tenants**, the same columns become **$64.25 / $1,834.25** plus the applicable paused-storage row. This large difference is an identity choice, not an interpreter optimization. These Dynamic-only figures are not a claim of commercial contractual clearance; see §3.

### Plain DO + Workflows, Code Mode replay, and WFP alternatives [E]

**Plain DO:** for an application that can express the same state transition directly in JS/JSON, use one front request + one DO request, **20 CPU-ms**, **250 ms DO active duration**, **4 SQL writes and 10 reads/resume**. Persist only the same metadata budget; omit R2 capsules/Queue/Dynamic Workers. That gives approximately **$5 at 1M** and **$473.75 at 100M resumes**, plus metadata storage. It is cheaper and semantically sufficient for many agents. These counts are a small reference workload, not a lower bound on every production application.

**Workflows:** for a steady cohort with **one new instance per resume cycle**, one front request + one Workflow invocation, **20 CPU-ms** and **3 billed steps** per cycle, estimate **$25 at 1M** and **$2,497.40 at 100M**, before retained state. Formula: Workers base/request/CPU + `8 × max(0, 3R/1e6 − 0.5)`. For **existing long-lived instances**, resuming does not itself create a new Workflow invocation; use actual initial creation count and front/event requests, reducing the request term. Store **16 KiB/paused instance [E]**: extra storage is roughly **$0 / $0.20 / $32.60** at the requested populations, before engine overhead and completed-instance retention. Sleeping population does not consume running slots. This is explicit workflow state, not an equivalent opaque heap.

**DO + Workflows together:** using the plain DO control budget above plus those three Workflow steps, one added Workflow invocation/cycle and **16 KiB extra state**, gives approximately **$25 at 1M** and **$2,899.75 at 100M**, plus both state stores. That is an illustrative orchestration-heavy baseline; it would be wasteful to duplicate both journals where a single Workflow suffices. Dynamic Workflows adds its actual Dynamic Worker ID/day and invocation/startup charges; it is not a free escape from the loader meter.

**Code Mode replay:** has no separate published engine fee; pay the actual DO/facet, storage, loader and CPU meters. If every approval replays the prefix, the bill depends on prefix CPU and logged calls. It can be cheaper than capsule writes for tiny scripts. Benchmark increasingly expensive prefixes and repeated approval points before claiming checkpoint savings.

**WFP per-tenant runner alternative:** with **1,000 deployed tenant scripts**, estimate execution-plan charges of **$25 at 1M cycles** and **$87.80 at 100M** for one billable dispatch chain/cycle and the same total **20 CPU-ms**. More scripts add the published monthly fee: **100k scripts add $1,980**, **10M add $199,980**. Add the relevant DO/R2/Queue path and separate ordinary Worker traffic; do not combine the WFP plan inclusions with Standard inclusions as if they were universally interchangeable. This prices an alternative adapter; it does not establish WFP supports the proposed Dynamic Workflows nesting.

### Lambda, E2B and Daytona comparison

**[S] Lambda Event Functions:** first-tier US-East x86 examples publish **$0.20/M requests** and **$0.0000166667/GB-s**, with **1M requests / 400k GB-s** free monthly. Tenant-isolated environment creation has an additional price; the pricing example uses **$0.000167 per 1 GB x86 environment creation**. [Lambda pricing](https://aws.amazon.com/lambda/pricing/), [tenant isolation](https://docs.aws.amazon.com/lambda/latest/dg/tenant-isolation.html).

**[S] Lambda MicroVMs is a separate current product:** published US-East ARM examples use **$0.0000276944/vCPU-s**, **$0.0000036667/GB-s**, snapshot writes **$0.0038/GB**, reads **$0.00155/GB**, storage **$0.08/GB-month**, with suspend preserving disk/memory for up to **8 h**. [Current Lambda pricing, MicroVM section](https://aws.amazon.com/lambda/pricing/). **[E] Do not compare only legacy Lambda cold functions and omit this much closer continuation competitor.**

**[S] E2B:** published CPU **$0.000014/vCPU-s**, RAM **$0.0000045/GiB-s**; default **2 vCPU / 4 GiB**, Pro **$150/month**. Paused sandboxes are not billed; persistence docs say no automatic paused expiry and include memory/processes. [Prices](https://e2b.dev/pricing), [paused billing](https://e2b.dev/enterprise), [persistence](https://docs.e2b.dev/sandbox/persistence). **[E] Therefore “millions paused cost much less than E2B” is not supported by public list pricing.** Population/quota guarantees at that scale need a quote; no account was used to test them.

**[S] Daytona:** compute **$0.0504/vCPU-h**, RAM **$0.0162/GiB-h**, disk **$0.000108/GiB-h** after a published first-five-free allowance, billed per second. VM `paused` stops CPU/RAM billing and retains memory without a separate memory fee; reserved disk is billed. Container `archived` has no resource billing but is not a live process continuation. [Prices](https://www.daytona.io/pricing), [state-specific billing](https://www.daytona.io/docs/billing/).

Illustrative active-slice comparison **[E]**, deliberately excluding storage/journals/tool costs and applying no volume discounts or one-time credits:

| Execution choice | Assumed billable slice [E] | 1M slices, gross usage [E] | 100M slices, gross usage [E] |
| --- | --- | ---: | ---: |
| Workers CPU only | 20 CPU-ms | $0.40 | $40 |
| Lambda Event Function | 1 GB × 100 ms + 1 request | $1.87 | $186.67 |
| E2B default | 2 vCPU + 4 GiB × 1 billable second | $46 | $4,600 |
| Daytona small compute | 1 vCPU + 1 GiB × 1 billable second | $18.50 | $1,850 |
| Lambda MicroVM | 1 vCPU + 2 GB × 1 billable second | $35.03 | $3,502.78 |

These are **not equal-performance benchmarks**: the Worker CPU assumption differs from provisioned Linux environment wall time. One billable second for E2B/Daytona is an assumed workload, not a claimed mandatory one-second minimum. If actual billable active time is shorter, scale linearly; startup and pause overhead must be measured. Add E2B Pro’s **$150** if that plan is needed; concurrency upgrades/enterprise commitments are extra. Lambda’s free tier makes the illustrated 1M Event Function usage **$0**, and 100M usage approximately **$179.80**; add isolated-environment creations, storage and orchestration to obtain a comparable service.

Paused-state comparison **[E]**:

| Product / model | 1k paused | 100k paused | 10M paused | What is actually preserved |
| --- | ---: | ---: | ---: | --- |
| Sofort reference design | $0 | $0.40 | $145.05 | 100 KB R2 capsule + 64 KiB DO metadata; excludes $5 base |
| Plain DO metadata budget | $0 | $0.40 | $130.20 | Explicit durable state, not guest heap |
| Workflow state budget | $0 | $0.20 | $32.60 | 16 KiB/instance assumption; storage overhead/retention extra |
| E2B | $0 published paused usage | $0 published paused usage | $0 published paused usage; capacity unverified | Native sandbox disk + memory under product policy |
| Daytona VM, 10 GiB reserved disk, ignoring free allowance | $777.60 | $77,760 | $7,776,000 | Disk billed, memory retained without memory charge |
| Lambda MicroVM, hypothetical 2 GB saved state | $160 | $16,000 | $1,600,000 | Snapshot bytes; **not a 30-day suspend entitlement** |

Daytona formula is `N × 10 × 720 × 0.000108`; choosing **10 GiB** is an estimate, not its minimum. If the first **5 GiB** allowance applies per sandbox, those disk figures halve; the pricing page does not clearly state the allowance’s scope, so do not present the gross figures as a quote. Lambda’s table is storage-rate arithmetic only: **8-hour suspend** is not indefinite parked execution. Its assumed **2 GB** capsule also incurs **$0.0107 per suspend/resume cycle [E]**, or **$10,700 / $1,070,000 at 1M / 100M cycles**, before active compute. Different actual dirty/snapshot bytes change this directly.

Ordinary Lambda has no comparable durable paused-heap SKU: run Sofort’s own Wasm capsule protocol on it and add object storage, ledger and wake-up costs, or use Lambda Durable Functions’ explicit steps. It is a plausible portable destination, not a requirement to keep a Lambda invocation open for a month.

### Sensitivities that matter more than the tiny-VM headline [E]

- At **10M computers**, each extra **1 KiB of DO state** is **10.24 GB**, about **$2.05/month** marginal. Unbounded audit history dominates eventually; compact safely, retain receipts for remote idempotency windows, and archive history intentionally.
- At **100M resumes**, each extra billed SQL row mutation/cycle adds roughly **$100/month** after inclusion; retaining extra indexes, alarms and deletion traffic matters. Each extra capsule PUT costs about **$450/month**. Amortizing saves only if the stronger crash/effect semantics remain intact.
- At **10M computers**, changing capsule size from **100 KB to 1 MiB / 10 MiB** makes raw R2 storage about **$157 / $1,573 per month**, versus about **$15**. Compression ratios are workload-dependent. Keeping every checkpoint for a month at **100M × 100 KB** adds approximately **10 TB**, about **$150/month** raw, besides latest heads and tool-result history; do not assume dedup always wins.
- Every additional **1 s DO active time/resume** at **100M** adds about **$160/month** marginal duration. A DO pinned all month costs about **$4.15/object-month** at list duration rates before the shared allowance. Returning between events is essential; tiny actual guest memory does not lower allocated-DO billing.
- Every **100 CPU-ms/resume** at **100M** adds **$200/month** Workers CPU. The **$0.002** fresh daily-worker charge equals **100,000 CPU-ms** at the CPU list rate: creation can overwhelm execution for short slices.
- Independent forks share paused base storage initially, but each executed branch consumes CPU, invocations and possibly a new Dynamic Worker identity. No free-N-way-compute claim.
- None of the population tables establishes platform approval or burst capacity at that scale. Load testing, account quotas, failure-domain recovery and restore-storm behavior remain unmeasured.

## 7. Local feasibility and solo-dev effort

### What can run without a Cloudflare account?

**[E] The core demo can be fully local:** front-door Worker + SQLite Computer DO + local R2 + Dynamic Worker Loader + local tool service + Queue/alarm. **[S]** Wrangler simulates DO, R2, Queues and Workflows locally; Dynamic Workers’ official starter explicitly runs with `npm run dev`. [Binding matrix](https://developers.cloudflare.com/workers/local-development/bindings-per-env/), [Dynamic Worker starter](https://developers.cloudflare.com/dynamic-workers/examples/dynamic-workers-starter/), [Queue local development](https://developers.cloudflare.com/queues/configuration/local-development/), [Workflows local development](https://developers.cloudflare.com/workflows/build/local-development/).

| Piece | No-account local route [E, grounded in linked docs] | Needs real Cloudflare resources to establish |
| --- | --- | --- |
| Worker/DO/SQLite/R2 | `wrangler dev` with persistent local state, local-only bindings, no `remote: true` | Global routing, replicated durability, hosted eviction/billing/quotas |
| Dynamic Worker + trusted QuickJS module | `worker_loaders`; same loader API; existing spike already used local workerd | Hosted startup, CPU accounting and untrusted-code defense in depth |
| Alarms / Queue wake-up | Local simulation; kill/restart process using persisted journal; inject duplicate messages | Production delivery/retry timing and behavior through outages |
| Workflows / Dynamic Workflows comparison | Local Workflows emulation plus installed dynamic-workflows library | Hosted scheduler scale, retention/billing; verify exact SDK versions |
| WFP dispatch namespace | Mock adapter or use Loader for no-account core demo | Official local WFP mode connects a local dispatcher to **deployed remote user Workers**, so a real namespace/account is needed for faithful WFP validation |
| Containers / Sandbox tool | Local Docker-compatible engine; no hosted account required for local images | Cloudflare production Firecracker isolation, snapshots, placement, quotas and `/dev/kvm` |
| Computer / Agents / Code Mode | Local packages + DO + mocked LLM/tools; isolate backend for Computer | Real LLM services/credentials, hosted integrations and account-only resources |

Sources for product-specific distinctions: [WFP local development](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/local-development/), [Container local Docker mode](https://developers.cloudflare.com/containers/guides/local-dev/), [Computer package](https://github.com/cloudflare/computer/blob/2b23503eac1f4efa8403908e472c472f747b61f7/packages/computer/README.md).

**[E] Use Wrangler/Miniflare for local service emulation; raw workerd alone is not the entire managed platform.** The existing direct-workerd loader test proves execution compatibility, not a local replica of replicated DO/R2/Queues/Workflows control planes. Downloading packages/toolchains requires network initially; the actual mocked demo can run without account credentials. Keep telemetry/auth integrations disabled for an intentionally offline run.

**[S/E] Local isolation caveat is operationally real:** standalone workerd/Miniflare is not a hardened hostile-code boundary. Run only the reviewed demo guest locally, or put the development process in a VM for adversarial tests. This is directly stated in the [official Dynamic Worker starter](https://developers.cloudflare.com/dynamic-workers/examples/dynamic-workers-starter/), not a claim that hosted Workers lacks defenses.

### Smallest convincing demonstration [E]

1. Start a rich QuickJS function holding a closure, cyclic object, typed array checksum and accumulated pure computation. Use a deterministic local tool service with an idempotency-key lookup table.
2. Complete one mock mutation, park at a second approval boundary, and display the **actual compressed/uncompressed checkpoint sizes**, DO epoch/head and four journal states.
3. Kill the executor, then stop the entire Wrangler process. Restart from the same persisted local state; show reconstruction without relying on a shutdown hook.
4. Approve twice with the same callback/command IDs. Restore, continue the closure, and show the mutation receipt/key occurred only once in the remote mock’s durable table.
5. Fork the parked checkpoint into read-only branches with different tool replies; resume one in local workerd and one in Node/browser. Never claim a live Cloudflare edge migration from this.
6. Repeat with the mock remote applying its mutation and deliberately dropping the response before DO completion. Recover by idempotency lookup; then show an intentionally non-idempotent tool ending in **ambiguous**, not silently retried.
7. Compare against a tiny Dynamic Workflow/Code Mode replay program and publish prefix CPU, checkpoint bytes, complete resume latency and modeled meters. A trivial replay example should win where it is simpler.

Proposed minimal config shape (illustrative, not a validated file created in this lane):

```jsonc
{
  "name": "sofort-portable-spike",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-25",
  "worker_loaders": [{ "binding": "LOADER" }],
  "durable_objects": {
    "bindings": [{ "name": "COMPUTERS", "class_name": "Computer" }]
  },
  "exports": { "Computer": { "type": "durable-object", "storage": "sqlite" } },
  "r2_buckets": [{ "binding": "CAPSULES", "bucket_name": "local-capsules" }],
  "queues": {
    "producers": [{ "binding": "JOBS", "queue": "local-jobs" }],
    "consumers": [{ "queue": "local-jobs", "max_batch_size": 1 }]
  }
}
```

Use current pinned Wrangler/package versions supporting these APIs; local resource names do not create cloud resources. Run only `wrangler dev`, never `deploy`, login, remote bindings or remote dev for the no-account experiment. Build files belong under `/Users/noah/code/sofort-spikes/cloudflare-architecture/`, outside the active repository’s code.

### Solo-dev effort [E], assuming the existing QuickJS-Wasm spike is reusable

| Work | Focused days |
| --- | ---: |
| Pin runtime and loader; capsule manifest/validation; reproduce Node ↔ local Worker restoration | 1–2 |
| DO state machine, epoch checks, R2 publish protocol, durable receipts | 2–3 |
| Journal/outbox, idempotent local tool, callbacks/alarms/Queue and ambiguous-outcome path | 2–3 |
| Fork/move, crash injection, duplicate-callback assertions and browser/Node branch | 1–2 |
| Narrow Code Mode Executor adapter + honest Workflow/replay comparison | 1–2 |
| Demo polish, counters, reproducible readme and measured artifact sizes | 1–2 |
| **Credible local research demo** | **8–14 days** |

**[E] A first visual happy path is 3–5 days**, not the crash-safe milestone. With a full-time job, the credible milestone is roughly **3–6 calendar weeks** at reduced availability. A hosted validation pass adds **2–4 focused days** after separately authorized account access; a commercial service’s metering, support, migrations, key rotation, abuse handling, availability and contract work is outside this estimate. A narrow Computer backend adds **2–4 days** beyond the Executor adapter. Goose-Wasm compilation plus cooperative/Asyncify tool-boundary suspension is an additional **3–7-day research allowance**, with unknown outcome; broad language compatibility takes longer.

**[E] Stop condition:** if the rich-state demo cannot beat replay on a meaningful expensive prefix, or the identity meter cannot be amortized under required isolation, keep the capsule runtime as a strong open-source demonstration and do not build the hosted platform. The intended career lever is a rigorous, compact primitive Cloudflare can understand and reuse.

## 8. Evidence and unresolved checks

**[S] This lane fetched current canonical docs and pinned SDK/source files, plus live PR metadata.** Downloaded reference material is in `/Users/noah/code/sofort-spikes/cloudflare-architecture/evidence/`; no third-party build scripts were executed. Only this report was intentionally added inside the repository. Source links are placed next to claims; prior benchmark observations remain attributed to the existing Wasm report.

**[E] Still unverified:** hosted CPU/startup/restore latency and cross-ISA qualification; actual capsule/journal growth under real agent programs; exact SQL/index/hidden-row write amplification; hosted Dynamic Worker identity accounting for the chosen wrapper/config; commercially applicable Dynamic Worker/WFP permission/package; WFP binding combinations; production nested KVM; managed quota agreements for millions of parked sandboxes; Daytona’s first-five-free scope. These are concrete validation items, not reasons to postpone the no-account prototype.
