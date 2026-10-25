# Better X on a pausable tiny computer

Research date: **2026-10-25**. Angle: existing projects and execution models that could become meaningfully better if rebuilt on jitk/Sofort. Read `BRIEF.md` first; also consulted `arch/FINAL.md`, the snapshot/memory research, and the prior value audit. No new benchmarks, code changes, commits, or external communications were performed. This report is the only authored file.

**F** = documented fact, including explicitly attributed local measurements. **I** = inference, proposed design, judgment, estimate, or acceptance test. Descriptions of competitors below are sourced to their own documentation or repositories. Product claims are not independently benchmarked results. All rebuilt designs, effort estimates, scores, and rankings are **I**. Planned Sofort features remain planned throughout.

## Finding

**I: The best opportunity is an execution layer for untrusted, tool-using programs that need to wait, recover, and branch—not a wholesale replacement for an established application platform.** The attractive conjunction is hardware isolation, one enforceable effects boundary, and eventual capture of the actual program continuation. None of those individually establishes a new category.

**F:** Golem already offers automatic durability at its Wasm/host boundary, without step wrappers, and documents recovery of ordinary program execution using an operation log. E2B preserves memory and files across pause/resume. Daytona documents live VM forks. Modal documents memory snapshots, including VM snapshots in alpha. Consequently, “ordinary code that resumes,” “save a running computer,” and “fork an agent” are existing capabilities. [Golem durability](https://learn.golem.cloud/v1.6/concepts/durable-execution), [E2B persistence](https://docs.e2b.dev/sandbox/persistence), [Daytona persistence](https://www.daytona.io/docs/en/persistence/), [Modal VM snapshots](https://modal.com/docs/guide/vm-memory-snapshots).

**I:** The credible improvement is making this combination sufficiently small and embeddable for a SaaS vendor to give every customer script its own computer, while keeping credentials and all consequential actions in a trusted broker. The commercial question is whether those vendors need hardware isolation or native static binaries enough to choose it over Wasm, an isolate, or a conventional sandbox.

## What the primitive actually supplies

**F, local brief:** Today: static QuickJS JS and static Lua inside a hardware-isolated microVM; a small Rust kernel; read-only resources; one JSON-lines tool channel; fresh single-use VMs; MCP integration. The brief reports approximately 6 ms raw cold start, 9 ms through the executor, 2.1 ms warm MCP tool call, 4.8 CPU-ms per VM, and 10.7 MiB per VM. These are local measurements, not fleet cost or service-level guarantees. [Brief](BRIEF.md), [status and measurement context](../../FINAL.md).

**F, local scope:** Shared CoW snapshots targeting approximately 1 MiB marginal memory, snapshotting at pending tool calls, migration/fork/resume, deterministic replay, capability stubs/promise pipelining, and content-addressed images are **planned**. Arbitrary static binaries are an architectural possibility, not demonstrated support for arbitrary languages. There are no threads, fork/exec, general networking, shared libraries, or writable persistent filesystem today. QuickJS loses substantially to V8 JIT on computation. [Brief](BRIEF.md), [memory analysis](../next/01-snapshots-memory.md).

For dependency descriptions below:

- **B:** built hardware isolation, restricted guest, tool channel, JS/Lua, read-only resources.
- **P-S:** planned snapshot/restore/fork/migration at an I/O boundary.
- **P-M:** planned shared backing and low marginal memory; actual dirty working set must be measured.
- **P-D:** planned controlled nondeterminism plus durable effect journal/replay.
- **P-C:** planned capability objects, durable rebinding, and promise pipelining.
- **P-H:** planned content-addressed images and cache.

**I:** Schedulers, replicated storage, leases, policy UIs, timers, connectors, billing, observability, and delivery guarantees are additional product engineering. They do not emerge from a snapshot.

## Wide survey: what deserves rebuilding?

These are **I screening judgments**, with factual comparisons cited. Ten selected areas receive full treatment afterward.

- **Temporal:** strong fit for *untrusted workflow bodies*; weak case for replacing its entire control plane. Existing event-history replay already recovers workflows. See deep dive 1. [Temporal history](https://docs.temporal.io/encyclopedia/event-history).
- **Restate:** strong comparator, not an easy target. Its services, virtual objects, durable promises, and immutable deployments already cover much of the desired application model. See 1–2. [Restate services](https://docs.restate.dev/concepts/services/).
- **Inngest:** convenient step-based execution already exists; a tenant-code substrate could improve the trust boundary. See 1 and 3. [Inngest primitives](https://www.inngest.com/docs/durable-execution/primitives).
- **DBOS:** offers durable workflows as a library rather than requiring a VM per workflow. Sofort must justify extra infrastructure with hostile code or opaque continuations. See 1. [DBOS workflows](https://docs.dbos.dev/typescript/tutorials/workflow-tutorial).
- **Cloudflare Workflows / Vercel Workflow:** a less annotation-heavy, native-binary continuation model is interesting; simple durable waits are already solved. See 1. [Cloudflare API](https://developers.cloudflare.com/workflows/build/workers-api/), [Vercel directives](https://github.com/vercel/workflow/blob/main/docs/content/docs/v5/how-it-works/understanding-directives.mdx).
- **Durable Objects / Orleans / Akka:** good for private conversational state and code owned by different tenants; worse for tiny trusted actors with frequent messages. See 2.
- **Erlang/BEAM:** borrow its supervision model; do not claim a hardware VM is a better lightweight process. Supervision restarts failed children; continuation durability is a separate property. [OTP supervision](https://www.erlang.org/doc/system/sup_princ.html).
- **Golem:** closest semantic competitor. The differentiator must be hardware/native execution or embedding economics, rather than “no workflow DSL.” See 1–3. [Golem](https://golem.cloud/).
- **Lambda / SnapStart / Workers:** select tool-only FaaS workloads, not general cloud functions. Snapshot initialization and mediated RPC are existing techniques. See 8.
- **Jupyter kernels / Observable / marimo:** strongest as small operational notebooks with effect history, weaker as general scientific notebooks. See 7.
- **Figma / VS Code plugins:** strong new plugin-host design; extensive existing APIs make drop-in replacement unrealistic. See 5.
- **Shopify Functions / Envoy filters:** weaker: Wasm already fits portable, bounded extension logic; a VM/tool round trip may damage the hot path. See 5.
- **Database UDFs / Postgres extensions:** attractive batched unsafe-code boundary; unsuitable replacement for arbitrary server-internal hooks. See 6.
- **CI runners:** reject as general replacement under today's constraints. Real builds need processes, mutable files, toolchains, and often network. A small policy/check runner is feasible but is a different product. GitHub-hosted Actions already use ephemeral isolated VMs. [GitHub runner security](https://docs.github.com/en/actions/reference/security/secure-use).
- **Browser automation:** safer durable controller, not a tiny browser or a snapshot of the website. See 9.
- **Zapier / n8n / Retool:** improve generated code and authority control; rebuilding connector catalogs and editors is unnecessary. See 4.
- **Game servers/mods:** promising for isolated quest scripts, turn-based matches, and replayable bots. Lua support is useful; a full engine/server exceeds scope. Nakama already supplies restricted scripting. [Nakama Lua](https://heroiclabs.com/docs/nakama/server-framework/lua-runtime/).
- **Smart contracts / deterministic VMs:** reject “cheaper Ethereum” as a category error. Replay does not supply consensus, replicated verification, adversarial gas accounting, or trustless settlement. Useful instead for centrally hosted policy rules. [EVM](https://ethereum.org/developers/docs/evm), [gas](https://ethereum.org/developers/docs/gas/).
- **Job queues / cron:** retain the scheduler and queue; replace untrusted job execution. Snapshotting does not solve schedule ownership, duplicate delivery, backpressure, or poison messages. BullMQ already recommends idempotent jobs; Celery already documents single-scheduler requirements. [BullMQ](https://docs.bullmq.io/patterns/idempotent-jobs), [Celery](https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html).
- **Chatbots / bots:** good packaging of durable actors plus capability-bound automation. A bot's gateway connection should remain on the host. Not a separate underlying runtime opportunity from 2–4.
- **ChatGPT/Claude-style code interpreters, E2B, Modal, Daytona:** strong *tool-glue* niche; weak general shell/data-science replacement. See 3.
- **RL environment frameworks:** strong for small procedural environments and untrusted task generators; weak for GPU/physics/browser worlds already outside the VM. See 10.

## Ten deeper rebuilds

Effort estimates assume 2–3 experienced systems/product engineers, reuse of the existing runtime, and **successful implementation of the named planned prerequisites**. They estimate an additional usable pilot, not research time for those prerequisites or production feature parity. Demo and business scores use 1–5; business measures plausible customer value and adoption, not market-size arithmetic.

### 1. Better durable execution: a continuation worker for Temporal/Restate-like systems

**Pitch / users [I]:** Run an ordinary tenant-authored program until its next effect; store its whole continuation instead of making the author design serializable steps. Buyers are workflow-platform vendors and teams hosting customer-defined agents.

**What exists / pain [F]:** Temporal rebuilds workflow state from event history, with deterministic workflow code and careful deployment/versioning. Restate exposes journaled operations through a context API. Inngest memoizes named steps and requires JSON step results. DBOS wraps workflow steps. Cloudflare exposes `step.do`, sleeps, and event waits; Vercel separates deterministic workflow code from steps. The burden is not that these cannot survive waits, but that durable boundaries, serialization, and compatibility enter the programming model. [Temporal safe deployments](https://github.com/temporalio/documentation/blob/main/docs/develop/safe-deployments.mdx), [Restate service examples](https://docs.restate.dev/concepts/services/), [Inngest step results](https://www.inngest.com/docs/reference/typescript/v4/functions/step-run), [DBOS](https://docs.dbos.dev/typescript/tutorials/workflow-tutorial), [Cloudflare](https://developers.cloudflare.com/workflows/build/workers-api/), [Vercel workflow/step model](https://github.com/vercel/workflow/blob/main/skills/workflow/SKILL.md).

**Rebuild / newly possible [I]:** A worker accepts a pinned image and grant set. A call such as `await tools.waitForApproval(...)` parks the entire JS heap, locals, closures, and stack. Durable host metadata binds the unresolved call to a timer/event. A replacement worker restores the continuation. A generated workflow can keep a complex in-memory parser or decision tree without a hand-authored serialization schema. A read-only fork can test alternate tool responses from precisely that continuation.

**Closest existing thing / necessity [F/I]:** Golem already journals host interactions without annotations, including nondeterministic inputs; its recovery reconstructs execution through replay and supports optional state snapshots. **F:** this defeats a broad novelty claim. **I:** Sofort is necessary only when hardware containment of the guest runtime, compatible native static code, or avoiding replay of expensive in-guest computation materially matters. For supported Wasm programs, Golem may be the simpler choice. [Golem durable execution](https://learn.golem.cloud/v1.6/concepts/durable-execution).

**Verdict [I]:** Better for untrusted opaque program continuations; merely different, and currently much less complete, for trusted business workflows. A VM snapshot pins executable memory: it does not make upgrading long-lived workflows easier. Keep old images, migrate explicitly, or restart from an application checkpoint. Do not erase Temporal's value in visibility, operations, routing, and mature failure handling.

**Dependencies / effort / scores [I]:** B + P-S + P-D essential; P-M for density, P-C for external authority, P-H for pinning. Pilot: 3–6 months as a worker backend; full engine replacement is a multi-year distraction. Demo **4/5**; business **4/5**. **Test:** a closure-heavy approval workflow survives executor and host failure, without author-written state serialization; compare recovery cost and code complexity against both Restate and Golem. Reject if snapshots cost more than replay and users do not value the hardware boundary.

### 2. Better actors: durable private processes for customer agents and bots

**Pitch / users [I]:** Give each customer's assistant, bot, or turn-based session a private process that can sleep with its call stack intact. Buyers are multi-tenant agent and collaboration products.

**What exists / pain [F]:** Durable Objects offer stable stateful identities and WebSocket hibernation, but hibernation resets in-memory state and reruns the constructor. Orleans reads persistent grain data on activation and requires explicit writes for changes. Akka persists events or durable state and reconstructs actors; actor-state snapshots are not arbitrary suspended stacks. These are capable systems, but persistent application state remains distinct from an active computation. [Durable Object hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [Orleans persistence](https://learn.microsoft.com/en-us/dotnet/orleans/grains/grain-persistence), [Akka persistence](https://doc.akka.io/libraries/akka-core/current/typed/persistence.html).

**Rebuild / newly possible [I]:** One process loops over `await mailbox.next()`. Mailboxes, ingress connections, timers, and routing live on the host. A dormant agent becomes a disk continuation; one waiting in the middle of a tool-assisted conversation resumes without reconstructing its local state machine. Different tenants can upload incompatible or unsafe guest code without sharing a language runtime address space. Branches can rehearse a bot response against recorded history.

**Closest existing thing / necessity [I]:** Golem's durable agents are closer than a plain actor framework. BEAM's processes remain an excellent choice for trusted high-message-rate services, and OTP supervision is reusable design knowledge. Hardware isolation becomes necessary when actor code crosses a tenant trust boundary or includes a native runtime/library one does not want to trust with host memory. The snapshot becomes useful when preserving control flow saves meaningful application work—not for a counter with a few fields.

**Verdict [I]:** Better for coarse, intermittently active, untrusted agents; worse for millions of tiny chatty trusted actors. Even a 1 MiB actor is large relative to a small logical state record. A single mailbox consumer also creates head-of-line blocking while awaiting a tool; signals, cancellation, and concurrency need an explicit design. Split-brain actors must be prevented with leases and fencing.

**Dependencies / effort / scores [I]:** B gives isolation today; P-S/P-D give durability; P-M controls economics; P-C supplies mailbox/object handles. Pilot: 3–5 months including directory, mailbox, and single-writer fencing. Demo **5/5**; business **4/5**. **Test:** pause and relocate 10,000 genuinely idle agents, measuring total fleet memory and event-to-resume p99; then revoke a capability before wake-up. Reject the generic actor pitch if a small explicit-state implementation is substantially cheaper and equally simple.

### 3. Better code interpreters: a small, credential-free tool computer

**Pitch / users [I]:** Let a model write a useful tool program while the host retains credentials, permissions, and audit history. Buyers are agent SDKs, enterprise assistants, and vendors embedding generated code.

**What exists / pain [F]:** Claude's hosted code execution runs Python/Bash and supports programmatic tool calls and REPL state persistence in current versions. E2B already preserves loaded variables and running processes across pause/resume. Daytona supports VM memory forks; Modal offers memory snapshots. Thus continuity and branching are real competitors, not absent features. [Claude execution](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool), [E2B](https://docs.e2b.dev/sandbox/persistence), [Daytona](https://www.daytona.io/docs/en/persistence/), [Modal snapshots](https://modal.com/docs/guide/sandbox-snapshots).

**Core pain / rebuilt version [I]:** A full Linux sandbox is useful when the task needs pip, shell, files, and scientific packages. It is unnecessarily broad for “fetch twenty CRM records, transform them, and request one approved update.” Sofort makes that narrow program a guest with no ambient network or host filesystem access. JS/Lua code calls a schema-checked host tool; credentials never enter guest memory. A denied call can fail at the broker even if the interpreter is compromised. Planned snapshots let a session wait for a person, or fork before a consequential call.

**Closest existing thing / necessity [F/I]:** Hyperlight already embeds hardware-isolated execution. Microsoft's Agent Framework documents Hyperlight-backed CodeAct and host-tool calls. **I:** this is the direct baseline for the built feature, rather than comparing only with an unrestricted shell. Sofort needs to win on integration, compatible static runtimes, policy enforcement, and measured behavior. A small kernel is not by itself a proof of greater end-to-end safety. [Hyperlight](https://github.com/hyperlight-dev/hyperlight), [Agent Framework integration](https://github.com/MicrosoftDocs/azure-ai-docs/blob/main/agent-framework/integrations/by-component/context-providers/hyperlight.md).

**Verdict [I]:** The best near-term fit. Built capabilities already support a restricted tool interpreter; durability can be added later. It is better for tool-glue isolation and host ownership of authority, not a replacement for ChatGPT/Claude-style general data analysis. Python with native packages, filesystem workflows, and arbitrary subprocesses remains outside the demonstrated envelope. User-visible pricing cannot be inferred from VM size; model and external API charges may dominate.

**Dependencies / effort / scores [I]:** B for an immediate SDK; P-C for richer authority; P-S/P-D/P-M for durable sessions and cheap branches. Pilot: 4–8 weeks for a JS/Lua execution SDK with typed tools, budgets, and trace UI. Demo **5/5**; business **4/5**. **Test:** one generated program batches tool reads, attempts an unauthorized operation, pauses for a human, and resumes after host replacement. Benchmark the built path separately from the planned path against Hyperlight and a Wasm implementation. Require an actual customer to prefer tool-only scope over Linux compatibility.

### 4. Better n8n/Zapier/Retool: generated automation with explicit authority

**Pitch / users [I]:** Keep the existing automation editor and connectors, but run every customer-authored code block or small automation in a private tool-only computer. Buyers are automation SaaS operators and teams enabling AI-generated workflows.

**What exists / pain [F]:** n8n already persists execution data for waits and resumes it from a database. Its current task-runner documentation recommends external runners and hardening for production; internal runners share the main process's OS identity. Retool Workflows already has blocks, functions, release versions, and a Temporal-backed worker/code-executor architecture. Sofort is not inventing sleeping workflows or low-code orchestration. [n8n Wait](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait), [n8n runners](https://docs.n8n.io/deploy/host-n8n/configure-n8n/set-up-task-runners.md), [Retool workflow model](https://docs.retool.com/workflows/quickstart), [Retool architecture](https://docs.retool.com/self-hosted/self-managed/quickstart).

**Rebuild / newly possible [I]:** A workflow is ordinary JS with connectors exposed as narrow tools. The host checks resource, row/customer scope, spending budget, and approval before each effect. `await approval(request)` preserves local continuation; a preview branch uses recorded reads and a simulated write broker. A user can inspect the intended update, grant one approved action, and wake the same program. The immediate integration can be just a replacement Code-node executor, leaving existing wait semantics intact.

**Closest existing thing / necessity [I]:** n8n's external runners plus its existing Wait node are a serious simpler baseline. Restate/Inngest can also host approval workflows. Sofort matters when accepting adversarial or model-generated logic at high tenant density, or when preserving opaque local state makes the workflow substantially easier to author. Trusted, curated node graphs do not inherently need a hardware VM.

**Verdict [I]:** A safer execution component is plausible; “cheaper Zapier” is not established. Connector maintenance, OAuth lifecycle, schema changes, rate limits, and user experience dominate the platform rebuild. Secret-free guests also require narrow connectors: a generic authenticated HTTP tool can give guest code excessive power despite hiding the token. Approval must bind to exact arguments and data versions; waking a stale continuation must not silently authorize a changed action.

**Dependencies / effort / scores [I]:** B for isolation; P-C for scoped connector objects; P-S/P-D for seamless long waits, P-M for concurrency. Pilot: 2–4 months for an integration with 3–5 connectors and one approval flow. Demo **5/5**; business **5/5** for embedding, **2/5** for rebuilding the full platform. **Test:** run the same onboarding/refund automation on n8n external runners and Sofort, comparing operator setup, prevented authority misuse, recovery, and total cost. Reject if it only removes visible boxes from a workflow editor.

### 5. Better plugins: a capability-based extension host

**Pitch / users [I]:** Make third-party extensions safe enough to install without giving them the host application's full authority. Buyers are SaaS platforms introducing customer plugins and editors with sensitive documents.

**What exists / pain [F]:** VS Code documents that extensions have the same permissions as the editor, including files, networking, and external processes. Figma already uses a minimal JS sandbox with message passing to a separate UI environment and domain restrictions. Extism supplies portable Wasm plugins with host functions. Shopify Functions use Wasm and can obtain external data through host-mediated fetch targets; Envoy supports Proxy-Wasm extensions. These are materially different trust and performance models. [VS Code permissions](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security), [Figma environment](https://developers.figma.com/docs/plugins/how-plugins-run/), [Extism host functions](https://extism.org/docs/concepts/host-functions/), [Shopify fetch/run](https://shopify.dev/docs/apps/build/functions/network-access/use-network-access), [Envoy Wasm](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/advanced/wasm).

**Rebuild / newly possible [I]:** Grant a plugin objects such as `selectedDocument.read`, `selection.proposeEdit`, or `customerRecords.queryAllowed`. Each lives on the host; the guest receives stubs, never raw host pointers or credentials. Long-running transformations can pause for approval or unload while preserving state. A native static parser could run inside its own microVM without requiring the host to embed that parser's memory-unsafety risk. UI rendering remains in the app/browser.

**Closest existing thing / necessity [I]:** Extism and Hyperlight are closer than permissive Node extensions. Wasm is likely better for portable, compact, low-latency plugins already supported by its toolchain. Sofort becomes attractive when a vendor requires a hardware boundary or wants to reuse a suitable native static binary. Planned continuations add most value for multi-stage plugins, not simple formatters.

**Verdict [I]:** A strong greenfield host design, a poor drop-in rebuild of the entire VS Code/Figma ecosystem. Existing plugins often expect broad Node/browser APIs or synchronous fine-grained access. Thousands of per-node RPCs could overwhelm the useful work: tools need batch document operations, and promise pipelining cannot remove every transfer. Envoy's per-request hot path and Shopify's bounded functions are particularly weak targets unless native compatibility creates an exceptional benefit.

**Dependencies / effort / scores [I]:** B for basic isolation; P-C and good host API design are central; P-S/P-D optional for long-lived plugins; P-H useful for distribution. Pilot: 2–4 months for one host and a deliberately small plugin API. Demo **4/5**; business **4/5**. **Test:** port three real useful plugins, including one native parser, preserving latency while proving the broker rejects all calls outside their grants. Reject if almost every extension requests an unrestricted escape hatch.

### 6. Better database UDFs: isolated batched user code beside Postgres

**Pitch / users [I]:** Allow customer-defined parsers and transforms without loading customer-native code into the database backend. Buyers are managed databases, ETL products, and SaaS systems offering custom data logic.

**What exists / pain [F]:** PostgreSQL notes that functions execute with backend OS permissions and that unsafe native functions can alter server internals; untrusted languages are restricted accordingly. PL/Python is untrusted. However, trusted languages already exist: PL/Rust can provide trusted native-compiled Rust functions under supported compilation conditions and exposes SPI. “No safe UDFs exist” would be false. [Postgres function security](https://www.postgresql.org/docs/current/perm-functions.html), [PL/Python](https://www.postgresql.org/docs/current/plpython.htm), [PL/Rust](https://plrust.io/).

**Rebuild / newly possible [I]:** A trusted extension or adjacent service sends a batch of rows into a VM and accepts a bounded result. The guest cannot inspect database process memory or open a socket. Restricted query tools run under the caller's database role and carefully selected transaction context. Better initial scope: pure batch transformations, validators, and parsers, with **no database-calling tool at all**. A native parser's failure kills one guest rather than corrupting a backend. Reproducible input/image records aid diagnosis.

**Closest existing thing / necessity [I]:** Trusted PL/Rust, Wasm UDF hosts, or an ordinary external transform service may be sufficient. Sofort is necessary only for hardware containment of unsafe compatible binaries or a compelling small-call embedding story. It cannot replace Postgres extensions needing shared memory, planner hooks, access methods, or direct server-internal structures without removing those extensions' purpose.

**Verdict [I]:** Better as a batched boundary for dangerous or tenant-supplied compute; usually worse as a scalar UDF invoked per row. JSON conversion, IPC, and VM dispatch can swamp simple functions. Pausing an active database transaction for a day would retain locks or stale MVCC state; it is not a feature. Durable jobs should end the transaction, store identifiers/versions, and revalidate on resume. External effects cannot be made atomic with a database transaction merely by snapshotting.

**Dependencies / effort / scores [I]:** B sufficient for a pure JS/Lua prototype; a native binary needs compatibility validation. P-H/P-D improve reproducibility; P-S is optional and often inappropriate inside queries. Pilot: 3–6 months with a narrow trusted integration and batch API. Demo **3/5**; business **4/5**. **Test:** batch a realistic parser workload against PL/Rust/Wasm/external workers, including cancellation and oversized output. Reject if isolation comes with unacceptable query latency or users need server-internal hooks.

### 7. Better operational notebooks/REPLs: save the running analysis, including effects

**Pitch / users [I]:** Share an exact small tool-backed investigation that a colleague can resume or branch, rather than just sharing its source and rendered outputs. Users are support engineers, incident responders, and API/data investigators.

**What exists / pain [F]:** Jupyter documents notebook files as inputs, outputs, and explanatory content; computation lives in kernels. Observable already provides reactive topological cell execution; marimo explicitly addresses hidden state with reactive execution. E2B's memory persistence already preserves running variables. Thus “a reproducible notebook” and “a persistent REPL” are insufficient differentiators. [Jupyter](https://jupyter-notebook.readthedocs.io/en/stable/notebook.html), [Observable execution model](https://observablehq.github.io/documentation/cells/observable-javascript), [marimo reactivity](https://docs.marimo.io/guides/reactivity/), [E2B persistence](https://docs.e2b.dev/sandbox/persistence).

**Rebuild / newly possible [I]:** A notebook is a small JS/Lua kernel with an immutable image, a sequence of cell submissions, a snapshot at tool-boundary checkpoints, and an effect journal. A colleague gets a private fork of the same heap and recorded API responses. They can inspect “what did this incident investigation actually see?” without refetching a now-changed service. Credentials stay with the broker, and sensitive resource access is reauthorized for the recipient. A live branch can refresh data explicitly.

**Closest existing thing / necessity [I]:** E2B/Modal/Daytona already offer underlying state persistence; reactive notebooks already improve source reproducibility. Sofort's distinctive contribution would be a small shareable continuation whose external authority is kept separate. This matters for short operational scripts with many API calls. It does not inherently improve a notebook that has no external effects or already reconstructs cheaply from source.

**Verdict [I]:** Better operational handoff; not better Jupyter for general data science today. NumPy/Pandas, native packages, subprocesses, huge datasets, plots, GPUs, and filesystem workflows are a major missing compatibility surface. Persisting every hidden variable also preserves stale or mistaken state; source order and data lineage still need a visible UI. Sharing snapshots can disclose data even if they contain no credentials, so an image hash is not an authorization mechanism.

**Dependencies / effort / scores [I]:** B supports a narrow stateless notebook; P-S/P-D make the exact-state pitch; P-C handles sharing, P-M/P-H help economics. Pilot: 2–4 months for JS/Lua operational notebooks, much longer for Python science parity. Demo **5/5**; business **3/5**. **Test:** transfer an investigation to a different authorized user/host, reproduce its recorded results, and branch it without repeating earlier API calls. Reject if users primarily need Python package compatibility or a saved notebook plus fixtures works as well.

### 8. Better FaaS: durable tool functions with no guest sockets

**Pitch / users [I]:** Offer small functions that can suspend during long external waits and resume actual local state, under an explicit host API. Buyers are embedded function platforms rather than general-purpose cloud users.

**What exists / pain [F]:** AWS SnapStart initializes an environment, snapshots it, and restores environments before invoking handlers. AWS explicitly documents uniqueness and connection-state hazards. Workers already combine isolate security with mediated APIs and capability-style RPC. Sofort cannot claim snapshot startup or credential mediation as unique. [SnapStart lifecycle](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html), [SnapStart uniqueness](https://docs.aws.amazon.com/lambda/latest/dg/snapstart-uniqueness.html), [Workers security](https://developers.cloudflare.com/workers/reference/security-model/), [Workers RPC capabilities](https://developers.cloudflare.com/workers/runtime-apis/rpc/visibility/).

**Rebuild / newly possible [I]:** A function can await a host timer, external response, or human action; an invocation snapshot preserves its own execution, rather than just a pre-invocation initialized baseline. With no guest network stacks or writable host mounts, restoring guest state requires rebinding a small set of logical tool handles rather than restoring arbitrary sockets. Package hashes cache initialized code/resources; host grants determine what the function may do.

**Closest existing thing / necessity [I]:** Golem and durable workflow services are already aimed at this programming experience. Hyperlight is a direct microVM substrate. Sofort's reason to exist is the combination of a hardware boundary, compatible native static programs, and unusually narrow host integration. A stateless trusted handler gains little from snapshotting its invocation; Workers' highly optimized isolates may be faster and cheaper.

**Verdict [I]:** Better for a deliberately constrained embedded FaaS; different and less compatible for Lambda/Workers generally. No networking forces integration rewriting, and no threads/shared libraries/processes rules out many ordinary functions. Brokering I/O moves complexity and load to the host. A 6 ms local cold result is not proof of an advantage over a provisioned or snapshot-warm managed platform.

**Dependencies / effort / scores [I]:** B for one-shot functions, P-S/P-D for durable invocation, P-M/P-H for density/cache, P-C for APIs. Pilot: 4–8 months including an ingress/scheduling service; cloud-platform parity is out of scope. Demo **4/5**; business **3/5**. **Test:** identical tool-only functions, including a long wait, against Golem and a Workers workflow; include host RPC, snapshot I/O, storage, and restore tail latency. Reject a generic “cheaper serverless” claim without total-cost evidence.

### 9. Better browser automation: durable, restricted controllers

**Pitch / users [I]:** Let an untrusted automation program drive only an approved browser session and preserve its own progress across waits or crashes. Buyers are agentic RPA and browser-agent platforms.

**What exists / pain [F]:** Playwright already provides cheap isolated browser contexts and authenticated-state reuse. Its authentication docs warn that stored cookies/headers are sensitive and distinguish tests that mutate server-side state. Browserbase already offers live human takeover. BrowserGym is already a framework for web-agent research. Sofort does not create those capabilities. [Playwright isolation](https://playwright.dev/docs/browser-contexts), [authentication](https://playwright.dev/docs/auth), [Browserbase live view](https://docs.browserbase.com/platform/browser/observability/session-live-view), [BrowserGym](https://github.com/ServiceNow/BrowserGym).

**Rebuild / newly possible [I]:** Run the generated control program in Sofort. The trusted browser service owns the actual browser, cookies, and downloads and exposes bounded operations such as inspect, click an observed locator, or propose a submission. The controller can be durably parked at “await user approval” without keeping its own process hot. Journaled observations support exact replay of the controller's decisions; forked controllers can test alternate plans against a recorded observation stream or cloned test application.

**Closest existing thing / necessity [I]:** A workflow engine controlling Browserbase/Playwright already recovers orchestration. A normal sandbox or Golem can isolate the controller. Sofort matters where the controller is hostile, the hardware boundary is required, and its state is small. The browser remains the large and attack-exposed component; moving a tiny controller does not make the whole automation cheap.

**Verdict [I]:** Modestly better safety and debugging; not a forkable browser universe. A VM snapshot contains neither Chromium nor website/server state. A broker-held browser session can expire during a long wait. Replaying observations does not roll back a purchase, restore a DOM, or reproduce a changing website. Arbitrary page evaluation or generic clicking can bypass a supposed “approval before payment” rule unless host policy meaningfully constrains those operations.

**Dependencies / effort / scores [I]:** B for the controller boundary; P-S/P-D/P-C for durable sessions and tool handles. Browser checkpointing/reconnection is a separate system. Pilot: 2–4 months for restricted form workflows. Demo **4/5**; business **3/5**. **Test:** kill the controller before and after submitting a test form, restore it without duplicate submission, and demonstrate explicit failure when the browser resource is gone. Reject if keeping the browser alive dominates every claimed resource saving.

### 10. Better RL environments: forkable small worlds and task generators

**Pitch / users [I]:** Package an untrusted procedural environment as a tiny isolated computer and branch its exact internal state at an action boundary. Users are agent-evaluation teams, training-platform operators, and researchers doing look-ahead search.

**What exists / pain [F]:** Gymnasium standardizes `step` and `reset`, including seeded randomness, but custom environments implement their own dynamics. MuJoCo already describes an integration state sufficient to reproduce its dynamics; it notes that recomputing derived data may be faster than copying the whole simulation. Daytona explicitly documents sandbox forking and an RL integration. Generic “environments with save states” is not a new invention. [Gymnasium API](https://gymnasium.farama.org/v1.0.0/api/env/), [MuJoCo state](https://mujoco.readthedocs.io/en/latest/programming/simulation.html), [Daytona fork release and veRL guide](https://www.daytona.io/changelog/sandbox-forking-sdk-and-org-metrics).

**Rebuild / newly possible [I]:** A JS/Lua world loops until `await nextAction(observation)`. Snapshot there; fork N variants; supply different actions to each. The snapshot includes hidden task-generator state, runtime objects, and control flow without requiring an environment-specific serializer. The trainer stays outside; the VM needs no GPU. Resource budgets and no network make customer-authored environments safer to host. A content-addressed image plus recorded actions is a portable failure artifact.

**Closest existing thing / necessity [I]:** Existing simulator state APIs are better when available; a Wasm environment may be lighter and more portable. Sofort is necessary when the environment implementation is untrusted or includes compatible native code, and automatic whole-program state capture saves substantial engineering. If the environment merely calls an external simulator/browser, its snapshot does not include the world: that service needs its own branch/checkpoint mechanism.

**Verdict [I]:** An appealing specialist experiment and excellent demo, with uncertain commercial advantage. Strong fit: small puzzles, tool-use simulators, interactive text worlds, and generated benchmark tasks. Poor fit: GPU worlds, large physics state, and throughput-sensitive trusted environments. Instruction-level/hardware differences and floating-point behavior also limit claims about portable bit-exact replay.

**Dependencies / effort / scores [I]:** B for containment; P-S/P-D for branch/replay, P-M for scale, P-H for artifact identity. Pilot: 2–4 months after snapshot primitives, plus a host Gymnasium adapter. Demo **5/5**; business **3/5**. **Test:** fork a hidden-state text environment into 100 branches and reproduce reward trajectories after moving hosts, then compare branches/second and memory against explicit state serialization, Wasm, and Daytona. Reject if VM overhead dominates environment stepping.

## The semantic and economic objections that every rebuild must answer

### A continuation is not a distributed transaction

**I:** The pending tool call is a clean *guest* checkpoint, not proof that the external world has no in-flight state. The broker may have charged a card and crashed before durably recording its result. Recovery must distinguish prepared, dispatched, completed, and delivered calls; use stable idempotency keys and reconciliation where supported. Unsupported external effects remain at-least-once or require explicit operator resolution. Golem and Inngest document this network-boundary limitation. [Golem guarantees](https://learn.golem.cloud/v1.6/concepts/durable-execution), [Inngest retries and effects](https://www.inngest.com/docs/durable-execution/guides-and-advanced/error-handling).

**I:** Forking must create branch identities and policy contexts. Read-only historical replay can reuse recorded results; speculative branches should receive denied/simulated writes. Promoting a branch authorizes new effects, not a magical commit of its simulated external world. Mailbox delivery, ownership leases, outbox records, and stale-executor fencing remain necessary.

### Exact replay is a contract, not simply controlled clock/random syscalls

**I:** Under the exercise assumption, P-D is achievable. The product must still define its supported execution envelope: pinned binary/kernel/resources, controlled clocks and entropy, journaled delivery/completion order, stable tool decoding, CPU/architecture compatibility, and limits on exposed nondeterministic instructions. The current single-thread restriction helps. “Any language” should mean a supported static runtime/program under that contract, not arbitrary Linux behavior or automatic cross-ISA migration.

**I:** Existing PRNG state copied in a snapshot is intentionally identical for replay, but may need branch-specific reseeding for live forks. IDs, tool-call keys, and capability identities must be allocated in a branch-aware host context. Simply reseeding the kernel cannot rewrite entropy already buffered in user space. AWS documents analogous uniqueness hazards. [SnapStart uniqueness](https://docs.aws.amazon.com/lambda/latest/dg/snapstart-uniqueness.html).

### One MiB is not a universal state size or a cost model

**I, arithmetic:** At 1 MiB private state each, 100,000 simultaneously resident guests need about **97.7 GiB**, before shared image pages, host processes, hypervisor allocations, broker buffers, and journals. One million 1 MiB disk continuations approach **0.954 TiB** before replication. Compact explicit state and event logs may cost much less. A large heap still makes a large snapshot; the local memory report explicitly distinguishes marginal sharing targets from peak working set. [Local memory analysis](../next/01-snapshots-memory.md).

**I:** Persistent snapshots and deterministic journals have separate roles. A warm baseline accelerates initialization; a per-invocation snapshot preserves progress; a journal establishes durable ordering and recovery after the latest snapshot. Shared backing reduces resident duplication, not the amount of private state an application generates. A million parked durable workflows already need not occupy a million running processes on competing platforms. [Inngest waits](https://www.inngest.com/docs/durable-execution/primitives), [Restate awakeables and suspension](https://docs.restate.dev/develop/python/awakeables/).

**I:** The correct benchmark compares completed useful work, total CPU, total physical memory, snapshot bytes and writes, restore p50/p99, tool-broker load, and operational labor. Measure against Hyperlight/Wasm for tiny execution, Golem for automatic durability, and E2B/Daytona/Modal for full-state sandboxes. Comparing Sofort's future private working set to a competitor's configured RAM is invalid.

### Authority and long-term compatibility are host responsibilities

**I:** A saved capability stub must resolve through a fresh host policy check on restore. Revocation, expiry, tenant identity, exact approved arguments, and resource versions must survive migration. Never snapshot raw broker credentials into a guest. The host must protect snapshots as sensitive data even when secrets are absent. Hashing a grant description provides identity, not continuing authorization.

**I:** Snapshot preservation favors binary pinning. Security patching, image retention, CPU compatibility, schema evolution, and months-old suspended code are real operational obligations. Content-addressed images can identify the old program exactly; they do not safely transplant a live stack into a new binary. These costs are especially serious for long-running workflows and shared notebooks.

## Which parts can be sold before snapshots exist?

**I:** Three built-scope pilots are honest now: a tool-only JS/Lua interpreter SDK, an isolated automation Code-node backend, and a batch plugin/UDF runner. They sell the hardware boundary and host-controlled API. They must not advertise durable continuations, 1 MiB guests, migration, or deterministic forks as shipped capabilities.

**I:** The most useful planned milestone is not an impressive idle-VM count. It is one small program that blocks on an approval call, survives host termination, restores on a compatible second host, has its grant revoked correctly, and cannot repeat a previously committed external effect. Then demonstrate a read-only fork. That sequence verifies the application-level promise behind several otherwise redundant product pitches.

## Top three, ranked

### 1. Tool-only interpreter SDK for generated agent code

**I:** Best fit with what exists today; shortest route to a useful pilot. Start with B and three narrow tools, with explicit trace and budget controls. Sell to vendors that already host generated code and want credentials outside the guest. Add continuation durability as a separate milestone. Demo **5/5**, business **4/5**, confidence **medium-high in technical fit / medium in differentiation**.

**Why it wins:** the program already wants tool-mediated I/O, small heaps, and short bursts—the primitive's constraints line up with the task. **Why it could lose:** Hyperlight and Wasm may supply enough containment with less integration work, while customers may insist on Python/Linux. First falsification experiment: an actual agent-SDK adopter chooses it over both alternatives on a measured representative workload.

### 2. Execution backend for generated n8n/Retool-style automation

**I:** Strongest identifiable buyer pain and embedding business. Reuse editors/connectors; isolate customer code and enforce exact grants at the broker. A built-only Code-node pilot can precede P-S/P-D. Demo **5/5**, business **5/5 for embedding**, confidence **medium**.

**Why it wins:** customer-authored automation crosses a trust boundary and often waits on APIs or people. **Why it could lose:** external runners plus existing durable waits may already solve the problem adequately. First falsification experiment: integrate one real automation platform and show an authority or operating-cost improvement its current runner cannot match without equivalent complexity.

### 3. Durable private actors for tenant agents and bots

**I:** Best longer-term expression of the complete planned primitive: coarse private processes, durable mailboxes, no guest sockets, continuation-preserving sleep, replayable decisions. Target customer agents and turn-based sessions, not high-frequency general actors. Demo **5/5**, business **4/5**, confidence **medium-low until P-S/P-M/P-D are measured**.

**Why it wins:** it makes ordinary control flow persist across long conversations and human waits. **Why it could lose:** Golem already offers the essential semantics, and explicit compact actor state may beat VM continuations economically. First falsification experiment: compare the same 10,000-agent workload with Golem and a conventional explicit-state actor implementation, including failures, revocation, storage, and full fleet memory.
