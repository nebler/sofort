# Agent space: computers as durable, copyable agent capabilities

Research date: 2026-10-25. Angle: what agents gain from the proposed Sofort primitive, and what they already have elsewhere.

**Evidence notation:** **F** = documented external fact or explicitly identified local project fact; **I** = inference, proposal, estimate, or judgment. Local performance figures come from the supplied [brief](BRIEF.md), not new benchmarks. Planned capabilities are assumptions for this exercise, not implementation claims. Vendor documentation describes contracts, not independently verified performance. Searches and primary documentation were consulted on the research date; mutable documentation is not a historical release archive.

## 1. Finding

**I — The opportunity is making a running agent-generated program a cheap, durable object.** An agent could retain a parser halfway through a job, a collection of closures implementing a plan, a partially evaluated policy, or a specialized tool adapter; stop paying for its resident execution while waiting; then resume, copy, inspect, or hand off that exact computation. This changes the unit of agent infrastructure from “conversation plus reconstructed workspace” to “conversation plus explicit executable continuation.”

**F — None of persistence, sleeping agents, machine snapshots, or branching is new individually.** E2B already documents memory-preserving pause/resume and one-to-many sandbox snapshots. Golem documents durable replay and a `fork()` that continues both agents from the current execution point. Cloudflare documents Code Mode approval pauses resumed by replay. These are direct substitutes, not distant analogies. [E2B persistence](https://docs.e2b.dev/sandbox/persistence), [E2B snapshots](https://docs.e2b.dev/sandbox/snapshots), [Golem forking](https://learn.golem.cloud/v1.6/develop/forking), [Cloudflare durable Code Mode](https://developers.cloudflare.com/agents/tools/codemode/durable-runtime/).

**I — Sofort's credible distinction is a combination:** hardware isolation; selected native static binaries; preservation of opaque heap/stack state without application serialization; a deliberately complete tool-mediated effects boundary; and potentially small marginal copies. The research does not establish that nobody else can combine these. It also does not establish a density or price advantage over durable Wasm or isolates.

**I — The strongest demand comes from generated, difficult-to-serialize control flow and expensive accumulated computation.** If the entire state is ten JSON fields and a transcript, a database-backed workflow is simpler and may use much less than 1 MiB. A snapshot is valuable when it preserves something costly or fragile to reconstruct, not merely because the file is small.

## 2. What is actually handed to the agent?

### Built versus assumed

**F, local — Built:** fresh single-use hardware microVMs; static QuickJS and Lua; one JSON-lines channel to trusted host tools; read-only resources; MCP integration; an offline kernel-growth loop. The brief reports approximately 6 ms raw cold start, 9 ms through the executor, 2.1 ms warm MCP calls, 6.5 ms for ten concurrent synthetic tool calls, 4.8 CPU-ms per VM, and 10.7 MiB per VM in the measured contexts. These are not fleet capacity measurements. [Brief](BRIEF.md), [local value audit](../pitch/01-value-audit.md).

**F, local — Planned:** approximately 1 MiB marginal memory with shared copy-on-write snapshots on Linux KVM; pause at a pending tool call; restore, copy, fork, and move the continuation; deterministic time/randomness and result journals; capability stubs and promise pipelining; content-addressed prepared images. No report below treats these as shipped.

**I — “A computer is a 1 MiB file” conflates several budgets.** Marginal physical memory, serialized snapshot size, total guest state, shared image size, journal size, and remote tool state are different. A portable continuation may reference a larger immutable base. Cross-host copies lose local sharing unless that base is already cached. A guest processing large data can dirty far more than 1 MiB. The local memory research explicitly limits the target to parked/small workloads and notes incomplete hypervisor/host accounting. [Snapshot and memory research](../next/01-snapshots-memory.md).

### Proposed capability contract — all I

The agent should receive opaque references and operations, not a directory of VM internals:

| Operation | Useful meaning | Required boundary |
| --- | --- | --- |
| `spawn(image, input, grants, budget)` | Start a program or prepared template. | Grants are checked by the host; child budgets consume a parent allocation. |
| `pause(id)` | Reach a tool-channel safe point and persist a continuation. | Not an arbitrary preemptive debugger stop; an infinite compute loop needs termination or a separate mechanism. |
| `fork(snapshot, branchInput)` | Create a distinct instance from the same executable state. | Fork identity, randomness, budgets, and effect rights need explicit treatment. |
| `resume(id, resultOrEvent)` | Deliver the matching awaited result/event and continue. | One fenced owner, event deduplication, and current authorization checks. |
| `send(address, message)` | Deliver a durable typed message to an agent computer. | An address identifies a recipient; it does not confer authority. |
| `replay(snapshot, journal)` | Reproduce execution with recorded inputs and no live effects. | Validate expected call sequence and fail on divergence. |

**I — Three identities must remain separate:** the hash of an immutable image, the identity/version of a mutable snapshot, and the stable address of a live logical agent. Content addressing answers “which bytes?” It does not answer “who may resume this?” or “which copy owns the next write?” A grant manifest must include the relevant scope/policy version without embedding reusable credentials or treating possession of the image hash as authorization.

**I — There are two useful deployments.** First, existing Claude/Codex/etc. harnesses use Sofort as a tool for durable snippets. This preserves the snippet, not the outer harness. Second, a small custom agent loop runs inside the guest and calls the model through a host capability; then transcript references, local plan, and program control flow can live together. Neither deployment runs model weights inside 1 MiB. Stock Node/Python harnesses and full Linux coding environments are outside today's guest compatibility.

## 3. Current harnesses: the real baseline

**I — Reading rule for this section:** a documented feature is **F**; the stated consequence for Sofort is **I**. Absence of a documented whole-machine continuation API is not proof that a vendor has no internal snapshots. The comparison concerns exposed contracts.

### Claude Code

**F —** Claude Code has separate-context subagents, resumable agent transcripts, configurable persistent memory directories, background work, and conversation forks. Its checkpoint feature tracks edits made through its editing tools and can rewind conversation and/or code; it does not generally reverse arbitrary shell or external effects. [Subagents](https://code.claude.com/docs/en/sub-agents), [checkpointing](https://code.claude.com/docs/en/checkpointing).

**I — Wall:** resuming a transcript or rewinding tracked files does not reconstruct an arbitrary interrupted interpreter heap, remote process, or API world. Sofort could make a generated tool program survive independently of the Claude process. It does not fix Claude's context limitations or supply a Linux development machine. “Claude cannot resume or remember” is false.

### Codex

**F —** Codex exposes saved-chat resume, conversation fork, and managed worktree options for new/forked sessions. Subagent orchestration includes spawning, follow-ups, waiting, and closing threads; local subagents inherit sandbox/approval settings. The official command documentation explicitly describes transcript reload and cloning chats. [Developer commands](https://learn.chatgpt.com/docs/developer-commands), [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

**F —** Codex also supports automatic context compaction and optional local memories extracted from prior chats. Those memories include summaries, durable entries, and supporting evidence under the Codex home directory; current documentation says local memories are off by default. These are context-management/persistence features rather than saved arbitrary tool heaps. [Best practices](https://learn.chatgpt.com/docs/learn/best-practices), [local memories](https://learn.chatgpt.com/docs/customization/memories).

**I — Wall:** a worktree separates source changes, not all execution or remote service state. A saved chat does not promise recovery of the stack inside a custom tool that was interrupted. A Sofort tool can add that continuation beneath Codex; it cannot make the whole existing Codex process fit the restricted guest. Approval UX also remains a harness/product responsibility.

### Cursor

**F —** Current Cursor supports resumable subagents, isolated worktrees or cloud environments, cloud subagents with their own VM and branch, and local/cloud handoff. Cloud environments can start from prepared snapshots. Checkpoint restore reverts files; conversation branching is separate. [Subagents](https://cursor.com/docs/subagents), [Cloud Agents](https://cursor.com/docs/cloud-agent), [agent checkpoint behavior](https://prod.cursor.com/help/ai-features/agent).

**F —** Cursor automations can read/write persistent named memory notes across runs of the same automation. The notes live outside the agent's working filesystem. This already decouples useful long-term context from the disposable workspace. [Automation memories](https://cursor.com/docs/cloud-agent/automations).

**I — Wall:** “an agent gets its own computer” and human handoff are already productized. The potential improvement is the cost and portability of a very restricted continuation, not inventing cloud agents. Cursor's fuller environment is preferable when the agent needs package installation, browsers, subprocesses, or normal test suites. No matched snapshot-density benchmark was found here.

### Devin

**F —** Devin sessions boot fresh copies of prepared environment snapshots. Current documentation describes managed child sessions with messaging, completion/input notifications that wake the coordinator, sleep controls, and recorded resumable dynamic workflows. Humans can take over the IDE/browser/shell. Memory is maintained separately in a Git repository of Markdown notes, with background consolidation. [Environment](https://docs.devin.ai/onboard-devin/environment), [advanced capabilities](https://docs.devin.ai/work-with-devin/advanced-capabilities), [session tools](https://docs.devin.ai/work-with-devin/devin-session-tools), [memory](https://docs.devin.ai/product-guides/memory).

**I — Wall:** child computers, sleeping coordination, reusable setup, and shared human access already exist. The cited interfaces do not establish arbitrary export/fork of a running session as a tiny portable file with deterministic execution replay. Sofort's narrower machine could be cheaper for small tool workflows, while failing entirely at much of Devin's development workload.

### OpenAI Agents SDK

**F —** The SDK offers sessions/history or server-managed conversation state, specialist handoffs, and approval interruptions with serializable resumable run state. Its sandbox documentation explicitly separates harness `RunState`, reconnectable sandbox session state, and snapshots that seed fresh workspace contents; capabilities vary with the provider. [Running agents](https://developers.openai.com/api/docs/guides/agents/running-agents), [approvals](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals), [sandbox state](https://developers.openai.com/api/docs/guides/agents/sandboxes).

**I — Wall:** the SDK can already wait across approval and persist a run. It does not imply that every custom tool's arbitrary local state or provider's execution environment is included in that state. Sofort could be a provider/tool implementation beneath it. Do not confuse this application-owned SDK with the managed Agents API, which also offers long-running sessions and saved progress. [Official runtime comparison](https://developers.openai.com/api/docs/guides/agents).

### Anthropic Agent SDK

**F —** The SDK persists conversation history, supports continue/resume/fork, and has external transcript-store adapters for cross-host resume. Its docs expressly distinguish sessions from filesystem state. File checkpointing is a separate feature, with restrictions on which tool edits it tracks. [Sessions](https://code.claude.com/docs/en/agent-sdk/sessions), [file checkpointing](https://code.claude.com/docs/en/agent-sdk/file-checkpointing).

**F —** It also exposes specialist subagents as a supported SDK feature, rather than requiring applications to build delegation from raw model calls. [SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents). **I —** Cross-session semantic memory can be supplied through explicit project instructions, skills, or application tools/storage; session transcripts themselves should not be mistaken for a separate learned memory system.

**I — Wall:** moving conversation history to another host is already supported. A whole running program, including opaque library state, is a different artifact. Sofort might avoid custom serialization of that program, but cannot automatically preserve SDK-side hooks, host callbacks, browser sessions, or external tools. Anthropic's separately managed multiagent sessions also have their own thread lifecycle; the local SDK is not the entire product landscape. [Managed session threads](https://platform.claude.com/docs/en/managed-agents/session-threads).

### LangGraph

**F —** Checkpointers persist graph state per thread; stores provide cross-thread memory. Interrupts can wait indefinitely with durable storage, but the interrupted node restarts from its beginning on resume. Time travel supports replay/fork from checkpoints; nodes after the checkpoint execute again, including model/API calls, which may return different outputs. [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts), [time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel).

**I — Wall:** developers must choose durable state boundaries and manage repeated work/effects. A machine continuation could retain opaque state inside a node and resume without rerunning its prefix. But graph checkpoints are more inspectable, often smaller, and easier to migrate across code changes. Sofort should integrate with a graph, not claim graphs cannot branch or wait.

### Letta / MemGPT

**F —** Letta makes agents persistent entities with prompts, tools, memory blocks, and stored messages, including out-of-context history. Blocks can be shared between agents. It exposes serialized agent export/import; the export is JSON, with options such as excluding messages. [Stateful agents](https://docs.letta.com/v1-sdk/concepts/stateful-agents), [memory blocks](https://docs.letta.com/tutorials/attaching-detaching-blocks/), [agent export](https://docs.letta.com/api/typescript/resources/agents/methods/export_file).

**I — Wall:** semantic memory and program continuation solve different problems. Letta already covers “an assistant remembers me” and portable agent configuration/history. Sofort adds value if the assistant must retain an expensive live computation or opaque runtime object; a heap snapshot does not decide what information should be remembered or inserted into model context. In many personal-assistant designs, Letta-style records are the better substrate.

### CrewAI

**F —** Current CrewAI has explicit event-driven checkpoints for crews, flows, and agents, with restore and fork into separate lineages. It supports JSON/SQLite providers and selectable checkpoint frequency. Flows also persist state and can recover pending asynchronous human feedback with `from_pending()` and `resume()`. [Checkpointing](https://docs.crewai.com/v1.15.30/en/concepts/checkpointing), [flow persistence](https://docs.crewai.com/v1.15.30/en/concepts/flows), [human feedback](https://docs.crewai.com/v1.15.30/en/learn/human-feedback-in-flows).

**F —** Its current unified memory API supports saving and recalling records with hierarchical scopes and relevance/recency/importance scoring, usable from crews, agents, or flows. Memory retrieval is distinct from restoring execution. [Memory](https://docs.crewai.com/v1.15.30/en/concepts/memory).

**I — Wall:** it reconstructs framework-defined execution state at selected events; this is not a promise to capture every arbitrary native stack or external process. Sofort could make a generated tool's inner execution durable. It does not introduce checkpoint/fork semantics to a framework that lacks them. Comparisons based only on older CrewAI task replay would understate the present baseline.

### The closest competitors sit below the harness

**F —** E2B's snapshot contract includes filesystem and memory, permits many descendants, and warns that active client connections drop during snapshotting. Its pause contract preserves running processes and loaded variables. [Snapshots](https://docs.e2b.dev/sandbox/snapshots), [persistence](https://docs.e2b.dev/sandbox/persistence).

**F —** Golem persists nondeterministic interactions in an operation log, rebuilds computation through replay, can unload idle agents and recover elsewhere, and supports optional state snapshots. It also exposes agent communication and execution-point forks. [Durability](https://learn.golem.cloud/v1.6/concepts/durable-execution), [forking](https://learn.golem.cloud/v1.6/develop/forking), [communication](https://learn.golem.cloud/v1.6/concepts/communication).

**F —** Cloudflare's durable Code Mode records completed calls and resumes approval-paused scripts through replay; configured `revert` handlers provide compensation. Its broader Agents runtime retains durable state and fiber checkpoints, but ordinary in-memory variables and closures do not survive eviction. [Durable Code Mode](https://developers.cloudflare.com/agents/tools/codemode/durable-runtime/), [long-running agents](https://developers.cloudflare.com/agents/concepts/agentic-patterns/long-running-agents/).

**F —** Temporal already reconstructs workflow execution from event history, returning recorded activity/timer results during replay. Hyperlight already provides small hardware-isolated applications with explicit host functions. [Temporal task replay](https://docs.temporal.io/tasks), [Hyperlight](https://hyperlight.org/).

**I — Consequence:** the product test is not “can an agent sleep?” It is “does preserving this opaque continuation beat explicit durable state or replay, under the same isolation/effect contract, with the same useful workload?” Hardware isolation and selected static-binary support are choices; they are not automatic wins over Wasm. E2B's broader compatibility is a benefit, not merely waste.

## 4. Ten concrete opportunities

All pitches, necessity judgments, effort estimates, and scores below are **I**. Existing capabilities referenced here use the **F** baseline above. Scores run 1–5. Effort means an experienced small team's prototype work **after the required planned substrate is working**; hardening, multi-region operation, and the substrate itself are additional. The estimates are not delivery commitments.

### A. Generated programs that live across weeks of waits

**Pitch:** Write an ordinary sequential tool program once; let its exact continuation survive approvals, schedules, and machine replacement.

**Users/new capability:** teams building procurement, onboarding, incident follow-up, or research pipelines. An agent writes a nested program whose partially constructed objects, closures, and loop positions survive a two-week wait. It can abandon the outer chat without rewriting that program into an explicit graph or serializing every local variable.

**Closest/necessity:** Temporal, Golem, Cloudflare durable Code Mode, and framework checkpoints already address durability. The primitive is necessary only for the desired combination of opaque execution preservation and this isolation/compatibility contract. For a fixed workflow or cheap deterministic prefix, replay or an explicit state machine is likely better. A long wait by itself is not a differentiator.

**Depends on:** built tool boundary; planned snapshot/restore; host-side durable timers, inbox, effect journal, and ownership fencing. The latter services are not supplied by a VM image.

**Failure test:** kill the host at each boundary around an approval and tool completion; recover without losing local state or repeating a completed mutation. Revalidate stale inputs after a long pause.

**Effort:** 3–6 weeks for one end-to-end workflow; production recovery/upgrade policy is substantial. **Demo 4/5; business 4/5.** Better models increase value by generating more useful bespoke programs and managing longer obligations.

### B. Thousands of cheap child computers

**Pitch:** Give every small delegated job its own bounded, disposable execution context.

**Users/new capability:** extraction, evaluation, tenant-specific connectors, and operations platforms. One parent can maintain thousands of independent cursors or staged computations while activating only a bounded subset. Children need not each be an LLM conversation; most should be ordinary code workers, with model calls only at ambiguous points.

**Closest/necessity:** process pools, isolates, Wasm, batch jobs, E2B, and current coding subagents already fan out. Cheap hardware-isolated continuations matter when each child accumulates nontrivial state and must remain isolated while dormant. Merely issuing a thousand HTTP requests does not require a thousand computers.

**Depends on:** built isolation/tool concurrency; planned shared snapshots and low marginal memory; a scheduler, quotas, cancellation, and backpressure. Guest `fork/exec` is not required: host lifecycle tools create sibling VMs.

**Failure test:** benchmark full host memory and useful jobs/s with 1,000 and 10,000 children, including dirty heaps, journals, host callbacks, and teardown. Throttle model/tool concurrency separately from VM count.

**Effort:** 2–4 weeks for bounded fan-out; months for a reliable fleet. **Demo 5/5; business 3/5.** Better models improve decomposition, but duplicate low-quality LLM workers are a weak-model crutch and an expensive one.

### C. Fork execution, explore branches, commit one

**Pitch:** Preserve an exact computational prefix, explore alternative tool trajectories, and authorize one resulting effect plan.

**Users/new capability:** planners, enterprise automation, agent research, and rollout infrastructure. A branch inherits all computed local state, not a verbal summary. It can explore multi-step consequences against an isolated database branch, simulator, versioned dataset, or preview API, then expose the result for selection.

**Closest/necessity:** LangGraph and CrewAI already fork state; Golem forks execution; E2B forks machines. Real-environment tree search also predates this primitive. [Tree Search for Language Model Agents](https://arxiv.org/abs/2407.01476). The incremental case is much cheaper copies of a valuable execution prefix with a uniform tool gate. For a cheap prefix or expensive model/API calls, VM copy cost barely matters.

**Hard limit:** copying a VM does not copy Stripe, a live browser service, a warehouse, or a human recipient. Forking immediately before sending an email lets branches compare drafts; it cannot let them each send the email and later select which send happened. A browser driven by a host tool remains outside the VM snapshot.

**Depends on:** planned fork/restore; branch-specific tool environments; host enforcement of read/preview/write rights; one authorized commit path with stale-version checks. “Commit” here is a proposed application protocol, not an existing Sofort operation or generic transaction.

**Effort:** 4–8 weeks for one forkable domain; arbitrary SaaS branching is not a bounded engineering task. **Demo 5/5; business 4/5 in a narrow domain.** Better models make branches more productive, but the optimal branch count may shrink as one-shot quality rises.

### D. Save a warmed computer as an executable skill or memory

**Pitch:** Save “ready to do the useful next step,” including the hidden work required to get there.

**Users/new capability:** agents repeatedly normalizing vendor records, validating payloads, applying policies, or operating unusual static libraries. A prepared capsule can contain an initialized library, compiled matcher, schema index, or partial evaluator and wait at `receive(input)`. An agent invokes copies as a tool instead of rebuilding its state on every use.

**Closest/necessity:** ordinary services, cached functions, SDK skills, VM templates, E2B snapshots, and Letta agent exports already reuse work. A snapshot earns its place when initialization is expensive and opaque, or the useful state exists only after execution. If a short script plus JSON is equivalent, ship that: it is easier to inspect and upgrade.

**Memory distinction:** this is procedural/computational memory, not automatic learning. A saved heap does not alter model weights or make forgotten facts visible in a future prompt. Pair it with a textual descriptor, input/output schema, provenance, validity conditions, and evidence of successful use. Tenant data must not enter a shared template.

**Depends on:** planned snapshots, image caching, and capability rebinding. Prepared templates should be tenant-free; mutable private snapshots need separate identity and storage. Today's fresh static-runtime execution can already prototype the tool interface without claiming warm-state reuse.

**Effort:** 2–4 weeks for a capsule registry and one useful skill. **Demo 4/5; business 4/5.** Better models can discover, compose, and maintain more useful capsules. Freezing a giant prompt to compensate for poor recall has a weaker future case.

### E. Hand the exact paused computation to a human or another agent

**Pitch:** Escalate a live task as a resumable artifact, including the pending decision and its computational context.

**Users/new capability:** support operations, approvals, specialist review, and agent platform teams. A specialist can replay a failure, inspect intermediate evidence through a structured view, and supply a typed result to the pending call. Ownership can move while local state stays intact; a read-only fork allows review without consuming the original continuation.

**Closest/necessity:** Devin takeover, Cursor cloud/local handoff, SDK approval state, and transferable transcripts already work. Sofort adds something only when exact tool-program state matters. A human cannot meaningfully “open” an opaque heap; the application must render the pending operation, inputs, provenance, and consequences. This is not a tiny remote desktop.

**Depends on:** planned pause/transfer, snapshot compatibility, durable identity, access controls, a review UI, and a single-owner lease. New owners get scoped capabilities; copying stubs must not copy authority automatically.

**Effort:** 3–5 weeks for a two-agent and human-review demonstration. **Demo 4/5; business 4/5 as part of A, weaker standalone.** Better agents still need approval and expertise boundaries; fewer remedial rescues may be necessary.

### F. Move the running program next to the data

**Pitch:** Transfer a compact continuation to a trusted executor inside the data's location, then resume its tool calls there.

**Users/new capability:** data platforms, enterprise connectors, and regional processing. The resumed guest uses local host capabilities to scan or aggregate data, returning only a bounded result. It carries accumulated computation across locations instead of restarting an arbitrary analysis at each site.

**Closest/necessity:** database pushdown, stored procedures, serverless functions, remote agents, and E2B deployments near data already move computation. Snapshot migration matters only when the continuation is valuable and transfer is cheaper than reconstruction. Static functions can normally be deployed without moving a running VM.

**Limits:** the guest has no network or filesystem access to the dataset; local trusted tools must expose it. A snapshot may already contain sensitive source-region data, so moving it can violate the very residency constraint the design aims to satisfy. Migration needs compatible ISA/runtime/image versions; ARM↔x86 or arbitrary KVM↔HVF resume is not established. Hosted model calls can still export information.

**Depends on:** planned portable snapshots, cached bases, tool-capability rebinding, location policy, and placement. **Effort:** 4–8 weeks across two controlled compatible hosts. **Demo 3/5; business 3/5.** Better models raise the value of complex local programs; the main competition remains simpler pushdown.

### G. Exact replay for debugging, evals, and training

**Pitch:** Turn a production agent-tool failure into a reproducible execution capsule and branch it at a chosen decision.

**Users/new capability:** agent platform engineers, eval teams, and RL researchers. Reproduce the same tool program without paying for or repeating external effects; identify the first call divergence; create controlled variants from a common prefix. Long-lived partial computations become portable failure fixtures.

**Closest/necessity:** traces, API cassettes, Temporal/Golem replay, language-level test fixtures, and snapshot sandboxes already cover parts of this. The useful increment is exact opaque guest execution with all permitted I/O observable at one boundary, plus cheap branchable prefixes. If a JSON request/response fixture reproduces the bug, no machine snapshot is needed.

**RL limit:** replaying recorded model outputs reproduces an old trajectory; it does not evaluate a new policy or produce new credit assignment by itself. Agent Lightning already separates execution from training and supplies an explicit credit-assignment mechanism. Sofort could supply reset states and controlled interventions beneath such a system, not replace its learning algorithm. [Agent Lightning paper](https://arxiv.org/abs/2508.03680).

**Depends on:** planned deterministic execution and snapshots; a complete ordered journal, request validation, trace linkage, and resettable external environments for counterfactuals. Model request/response bytes, versions, sampling settings, and available training metadata need recording separately.

**Effort:** 3–6 weeks for record/replay and a divergence viewer; RL integration is another project. **Demo 5/5; business 4/5.** Better models make failures rarer but more consequential and longer to reproduce. Evidence infrastructure remains valuable.

### H. Multi-agent systems where every agent is an addressed computer

**Pitch:** Give each agent a durable address, isolated local program state, a mailbox, and explicit capabilities.

**Users/new capability:** platforms coordinating long-lived cases, organizations, projects, or devices. A case agent can retain a private execution continuation, send a subtask to another address, and sleep while awaiting a typed response. Hardware isolation can separate mutually distrustful agent code even when a common model authored it.

**Closest/necessity:** the actor model, Cloudflare Durable Objects, Golem agents, and database-backed Letta agents already provide durable identity/state. Sofort is necessary only when each actor needs an opaque resumable native computation under a VM boundary. Most actors need a few records and a function; serializing those is more efficient.

**Limits:** a VM per actor does not supply delivery semantics, distributed transactions, deadlock avoidance, authority propagation, or automatic merge of divergent heaps. An agent snapshot is not a globally consistent snapshot of all its peers. A mailbox and timer service are external durable systems.

**Depends on:** planned snapshots/stubs; host routing, outbox/inbox, fencing, deduplication, fair scheduling, and lifecycle GC. Promise pipelining can reduce host-call round trips, not abolish distributed coordination.

**Effort:** 4–8 weeks for one host and two actor types; multi-host production is months. **Demo 3/5; business 3/5.** Better models expand useful autonomous interactions, but “every reasoning persona needs a VM” is unjustified.

### I. Agents that grow their own kernel profile

**Pitch:** An agent encountering an unsupported static program proposes the smallest new runtime contract and packages a tested image for future work.

**Users/new capability:** runtime engineers and teams with unusual, repeated static-binary workloads. A missing syscall becomes an offline compatibility-development task with an artifact, tests, and versioned provenance. Better models could help build a library of narrow kernel profiles instead of forcing every workload into the same expanding kernel.

**F, local — Existing scope:** the current growth loop copies the kernel into disposable development storage, removes known handlers, regrows them, builds, and compares stated contracts against Linux. Default mode reuses recorded proposals; live mode invokes an agent. Signal profiles deliberately return ENOSYS, and Lua already computes without the missing handlers. This is not broad autonomous Linux implementation. [Growth README](../../jitk/grow/README.md).

**I — Closest/necessity:** normal AI-assisted systems programming, unikernel specialization, Hyperlight guests, and ordinary compatibility development. The tiny explicit kernel and oracle loop make bounded changes reviewable; snapshots are optional. A running untrusted tenant should not hot-patch its kernel or grant itself new host tools. Kernel adaptation does not equal model self-improvement.

**Depends on:** the built offline growth loop; stronger contract coverage and promotion controls for broader use; planned content-addressed profile caching is useful. **Effort:** 2–6 weeks for one meaningful additional contract, unpredictable for broad binary support. **Demo 5/5; business 2/5 standalone.** Better models clearly help synthesis, but trusted specification, validation, and maintenance remain the hard product.

### J. A persistent assistant for each of one million users

**Pitch:** Keep a private computational continuation per user without reserving a full active development VM for everyone.

**Users/new capability:** consumer assistant products and multitenant workflow providers. Each assistant can own small ongoing computations, wake on events, and retain exact progress over months. A pool schedules active guests while dormant continuations live in storage.

**Closest/necessity:** stateful-agent databases, Durable Objects, durable workflows, and existing paused sandboxes. These already serve dormant identities without a dedicated resident machine. Sofort's case is private executable state, not simply “one user, one memory.” An ordinary record may be kilobytes rather than a megabyte.

**Economics:** 1,000 × 1 MiB is about 0.98 GiB; 10,000 is 9.77 GiB; one million is 976.6 GiB, about 0.95 TiB, before bases, metadata, journals, replicas, hypervisor state, or host executors. These are arithmetic scenarios, not measured capacities or proof serialized files are 1 MiB. A 1% active fraction would still mean 10,000 simultaneously active assistants; a 1% fraction is an assumption, not a traffic model. Inference and tool costs may dominate.

**Depends on:** planned low memory and disk pause; essentially all production control-plane services, tenant isolation, privacy/deletion, and bounded wakeup fan-out. **Effort:** 3–6 weeks for a small synthetic population; a credible million-user service is a separate multi-quarter effort. **Demo 4/5; business 3/5, unproven demand for the VM portion.** Better models improve assistant utility; they do not make per-user heaps the cheapest representation of preferences.

## 5. Three workflows, step by step

All workflows are **I**, proposed implementations assuming the named planned capabilities. Tool names illustrate contracts; they are not claims that these endpoints exist today.

### Workflow 1: a ten-day vendor renewal with human and specialist handoff

1. A parent harness spawns a QuickJS computer with scoped capabilities to read one vendor's contract metadata, inspect relevant usage, and prepare a renewal request. It has no general network or filesystem access and no standing purchasing authority.
2. The generated program joins the tool results, builds a local matching/index structure, and calculates options. It retains intermediate objects and a proposed renewal inside the guest. Large source documents remain in trusted storage and are referenced by versioned IDs.
3. The program reaches `await review.request({proposalDigest, evidenceRefs, expiresAt})`. The host records the exact pending operation and snapshot as one recoverable transition, then unloads the VM. The scheduled deadline and approval record live in durable host storage.
4. Ten days pass. No model tokens or guest CPU are consumed just to wait. Snapshot storage, indexing, and the host control plane still cost something. This is suspended execution, not ten days of uninterrupted computation.
5. A human opens an application view showing the proposal, evidence, expected effect, and expiry. The system can give a specialist agent a read-only fork to check the assumptions. The specialist receives both a readable brief and access to the preserved computation; it does not have to infer intent from an opaque binary.
6. The specialist reports that usage has changed. The host delivers a typed “revise using these current versions” response to the original pending call, and the guest continues with its existing local computation. If the proposal changes, the earlier approval digest is invalid; a new proposal needs the appropriate authorization.
7. Once the final proposal is approved, the host acquires the current ownership lease, rechecks grants and source versions, and allows the single designated instance to issue the renewal action. A supported provider idempotency key binds retries to this logical operation.
8. The host journals the resulting receipt before feeding it to the guest. The guest records completion through a host storage capability and waits for a later confirmation event or exits. If remote acceptance is uncertain and the provider lacks deduplication/status lookup, recovery stops for reconciliation rather than inventing an exactly-once guarantee.

**Why use the primitive?** The case is retaining hard-to-serialize program state without turning the generated program into a bespoke durable graph. If the calculation is a few cheap joins, Cloudflare/Temporal/Golem or SDK state is sufficient. **Demo proof:** pause with a nested closure and live library object, destroy the worker process, resume on a compatible second worker, and show that the prefix was not recomputed. Human approval is an application feature still to build.

### Workflow 2: fork twenty real fulfillment experiments, authorize one plan

1. An agent receives the task “allocate these orders across warehouses under these constraints.” A small guest reads a versioned order/inventory view through trusted tools and constructs an expensive local constraint representation. It cannot mutate production inventory.
2. At `await strategy.choose()` the host captures snapshot S. This is an intentional branch input boundary, not arbitrary mutation of the guest heap.
3. The host forks S twenty ways, returning a different candidate policy to the awaited call in each branch. It creates twenty separately isolated tool-side database branches or preview workspaces from the same relevant baseline. Each guest is bound only to its own workspace; those workspaces are separate from the VM snapshot.
4. Branches call actual allocation/validation tools against those isolated environments. They observe concrete constraint failures, revise plans, and explore subsequent steps. This is more than twenty text suggestions: each branch has an executable local trajectory and real tool feedback, though it is still an experiment outside production.
5. A bounded scheduler allows, for example, four active branches at once. A host ledger caps total model/tool spending across all descendants. Paused branch count is not allowed to hide unlimited API spend.
6. An independent scorer checks measurable outcomes: all orders accounted for, stock constraints satisfied, explicit shipping costs, and unsupported assumptions. The parent selects a candidate and discards the others. There is no attempt to merge twenty arbitrary heaps.
7. The selected branch emits a typed effect plan with source-version preconditions. A human or policy authorizes that exact plan. Production tools revalidate inventory and apply it under their own transaction/idempotency semantics; if the baseline changed, the operation conflicts and replans.
8. Only after successful production application may the host allow an external shipment instruction or customer notification. Killing the nineteen other VMs does not cancel any remote effects they already performed; therefore they never received those capabilities.

**Why use the primitive?** Copying the expensive local prefix and pausing many alternatives could reduce reconstruction cost. If the expensive state is actually in the external database and the guest has little local state, database branching plus ordinary code workers wins most of the value. **Demo proof:** record both guest-copy cost and environment-copy cost; show twenty distinct valid trajectories and exactly one production authorization. Expanding to 1,000 branches is justified only by better outcomes per total dollar.

### Workflow 3: replay an incident, train against a decision, save a reusable tool

1. A generated static-runtime adapter has handled many customer records when it fails on a tool-response/schema edge case. The runtime retains a preceding safe-point snapshot, the immutable base image ID, and the journal through failure. The capsule is tenant-private because heap and journal can contain customer data.
2. A debugging agent starts replay in a capability mode with no live external effects. The executor supplies recorded tool results and validates requests and delivery order. The same guest failure occurs without repeating writes or buying new model responses.
3. The agent inspects a structured trace and exports selected intermediate values through explicit debug tools. It identifies whether failure began in a model-proposed mapping, generated adapter code, tool response, or runtime behavior. Exact replay narrows reproduction; it does not explain the bug automatically.
4. For a model-decision experiment, the evaluator forks the unchanged pre-decision snapshot and supplies alternative outputs at a designated model-call boundary. Each rollout receives its own resettable fixture environment. Holding fixture state and relevant random inputs fixed gives a controlled comparison, not proof of causality in the live external world.
5. The training system records observations, chosen actions, rewards, policy identity, token/log-probability metadata where available, and downstream outcomes. A credit-assignment algorithm uses these transitions. Reusing the old recorded model output alone creates no new training signal.
6. If the fix changes source or binaries, the debugger rebuilds a new image and reruns the recorded inputs from a compatible initialization point. It does not load an old machine heap into arbitrary new code. The failing journal becomes a regression fixture; the old image remains available for reproduction.
7. After independent validation on held-out cases, the agent prepares a tenant-free initialized adapter and pauses it at `await input.receive()`. It registers an immutable skill template with schemas, version constraints, tests, textual usage instructions, and provenance.
8. Future agents fork that template with fresh tenant capabilities and private input. The successful computational setup is reused; the production incident's customer data and authority are not. A normal script/package is preferred if it is equally cheap and reliable.

**Why use the primitive?** It joins opaque-state reproduction, controlled branching, and reuse of initialized program state. Traces plus JSON fixtures are the cheaper baseline. **Demo proof:** one reproducible incident, one deliberate replay divergence, one intervention whose measured result changes, and one clean capsule reused on unseen input. No claim of autonomous model training follows from a snapshot alone.

## 6. The contracts that determine whether these ideas work

Everything in this section is **I**, derived from the proposed architecture, except explicitly cited existing behavior.

### A snapshot boundary is not an effect transaction

The brief's single-channel design removes guest sockets and direct host file handles from migration. It does not eliminate executor state. A pending call may represent an already-running HTTP request, an uncertain remote mutation, an approval, a timer, or one member of a `Promise.all`. The executor must durably classify every outstanding operation and associate results with stable logical call IDs. Promise completion order is itself an input.

A useful call lifecycle is: persist intent → authorize → dispatch → persist receipt → deliver result → acknowledge guest progress. Crashes between dispatch and receipt require provider idempotency, remote status lookup, or explicit reconciliation. This sequence alone does not atomically commit a remote SaaS operation and a local journal. Transport request IDs are insufficient unless the remote system honors their semantics.

Forking also cannot multiply a single-use approval, spending limit, lock ownership, reservation, or commit right. A child should normally inherit attenuated read/preview rights. The parent family shares a total spending budget. Production commit authority belongs to one selected lineage under a current lease. Changing branch identity should not accidentally generate fresh keys that duplicate an already-applied logical effect.

### Exact replay has a deliberately narrower meaning than “run it again”

An exact guest replay needs the same machine/image/runtime contract and all nondeterministic inputs: tool results and errors, order of delivery, exposed time, random bytes, timers, and any visible scheduling/cancellation decisions. Raw CPU sources of nondeterminism, if reachable, must be constrained or included. A claim for “any language” is conditional on supported binaries using that controlled machine contract; it is not compatibility with arbitrary Linux programs, devices, or hardware instructions.

Model inference is external I/O. Replaying its recorded output can reproduce guest behavior even if the provider later changes the model. Calling the provider again with temperature zero does not establish exact replay. API traces also may not expose everything a training algorithm needs.

Three modes should be explicit:

- **Recorded replay:** consume original inputs, deny live effects, reject an unexpected next call. Useful for reproduction and auditing.
- **Counterfactual fork:** intentionally change a selected input/action, then use isolated or resettable environment state. Useful for evals, search, and training.
- **Live resume:** reconnect current capabilities and continue against today's world. Useful for work, subject to current grants, expiry, and conflicts.

These modes cannot be silently interchanged. A new branch's unexpected tool request has no answer in an old cassette; the runtime must fail or route it to the declared branch environment, not invent a result. A journal of one path does not contain the world required to evaluate every alternative path.

### Durability and privacy live outside the guest too

Disk pause is not crash durability unless the snapshot, associated journal offset, pending-call record, base-image references, and ownership transition are recoverably consistent. Durable inboxes/timers wake unloaded computers. Fencing prevents a failed worker and its replacement both resuming the same logical instance. Deadlines, cancellation, and resource accounting continue to apply to host callbacks; killing the guest cannot recall a request already accepted remotely.

Opaque snapshots are difficult to edit, redact, search, and merge. Credentials staying outside the guest helps, but tool results can still contain secrets or personal data. Encryption, tenant-scoped keys, retention, deletion across descendant snapshots/journals, and a provenance graph are product requirements. Cross-tenant content-addressed deduplication needs care; a shared prepared template must not retain tenant state.

Long pauses also pin old binaries and semantics. Replaying old code under new policy, or applying new code to an old heap, is not an automatic upgrade strategy. Retain compatible runtimes or export explicit application state at planned upgrade points. Golem's documented replay/update mechanisms are a baseline to study rather than a problem Sofort uniquely encounters. [Golem durability and updates](https://learn.golem.cloud/v1.6/concepts/durable-execution).

### Density does not substitute for useful-work economics

The full unit cost includes VM CPU, shared/private memory, restore I/O, snapshot storage, journaling, host tool execution, model tokens, external service fees, and operational overhead. Starting more agents can increase reasoning cost even if machines become free. A thousand dormant code cursors can be useful; a thousand redundant model conversations often are not.

The measured ~6 ms cold start says little about weeks-long workflows where model/tool calls take seconds. The planned memory target matters more for many dormant or speculative continuations. To establish advantage, benchmark the same generated program and identical effects policy against: explicit JSON state; Cloudflare-style replay; Golem; an isolate/Wasm runtime; and an E2B-style fuller sandbox where appropriate. Include an expensive opaque prefix and a cheap serializable prefix, so the experiment can show where snapshots lose.

## 7. What gets more valuable as models improve?

All judgments here are **I**. Model quality, inference price, and inference throughput can improve independently; cheap VM copies do not imply cheap cognition.

| Mechanism | Durable reason to want it with stronger models | Weak-model compensation to avoid confusing with the opportunity |
| --- | --- | --- |
| Weeks-long continuations | More useful bespoke programs, more ongoing obligations, and ordinary real-world waits. | Keeping a poor plan alive forever without reconsidering it. |
| Isolation and scoped tools | More capable generated code can affect more valuable systems. | Assuming a VM makes the model's authorized actions correct. |
| Fork/search | High-stakes verification, optimization, and exploration can remain useful even with excellent models. | Brute-force sampling to repair elementary planning errors; optimal branching may decline. |
| Executable skills | A better model can discover and compose more useful initialized computations. | Saving repeated prompt scaffolding because the model cannot follow a short instruction. |
| Replay/evals | Rare failures can involve longer trajectories and more consequential actions. | Reproducing old model mistakes without testing a new policy or fixing the environment. |
| Handoff | Authorization, organizational ownership, and specialist knowledge remain. | Constant human rescue from routine incompetence. |
| Kernel growth | Better synthesis can expand tested compatibility contracts. | Runtime self-modification treated as learning or a replacement for specification. |
| Per-user persistence | Better assistants create more valuable long-term tasks. | Treating all semantic memory as a frozen process heap. |

**I — The strongest trend is agents writing and owning more software, not merely talking longer.** More useful generated programs create more execution state worth keeping, inspecting, isolating, and handing off. Conversely, if stronger models can cheaply reconstruct the same computation from a compact specification, the economic case for preserving its heap becomes weaker. Measure both paths.

## 8. Top three, ranked

These are **I**, ranked for an initial product/research wedge, not by novelty alone. All require planned capabilities; none is advertised as ready today.

**I — Outside the top three:** bounded fork/search (C) is the most striking demonstration, but success depends on the external environment being forkable or previewable. Thousands of computers and one million personal assistants are consequences to validate after useful per-instance state and economics are proven; they are weak standalone pitches. The agent that grows kernel profiles is distinctive research, but its direct buyer is narrower than the buyer for durable agent tools.

1. **Durable generated tool programs with approval and event waits (A, incorporating E).** Best practical starting point: preserves nontrivial opaque computation while fitting today's tool-mediated guest scope. Build one program that demonstrably cannot be recovered by just reloading its transcript, then destroy the host and resume it. Target custom agent platforms, not full coding workspaces. **Demo 4/5, business 4/5.** Kill the pitch if matched replay/explicit-state implementations are equally simple and cheaper.
2. **Reproducible agent-tool incidents and controlled eval branches (G).** Strong demonstration and a useful engineering buyer: ship the failing computation with its inputs, reproduce it without live effects, and locate the first divergence. Start with debugging/evals; treat RL as a later integration. **Demo 5/5, business 4/5.** Kill the snapshot component if ordinary trace fixtures reproduce the same incidents reliably.
3. **Reusable initialized capability tools (D).** A small registry of clean executable capsules is a bounded extension of the same substrate and benefits from stronger code-generating models. Demonstrate meaningful saved initialization or retained opaque state, typed interfaces, and fresh per-invocation grants. **Demo 4/5, business 4/5.** Kill the capsule format where a normal package plus serialized data is easier to inspect and just as cheap.

