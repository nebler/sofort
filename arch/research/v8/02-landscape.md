# Who is building portable, durable, forkable execution?

Research date: **2026-10-27**. Angle: competitive landscape for the V8/Wasm sibling of Sofort. Read `BRIEF.md` and the existing portability evidence before researching. This task changes only this report; no builds, deployments, commits, purchases, or contacts were made.

**Labels:** **F** = primary-source fact, including an explicitly attributed vendor/repository claim; **M** = measurement; **I** = inference; **E** = estimate. There are **no new runtime measurements in this report**. The Oct 25 Sofort measurements are identified as prior measurements, not reproduced here. All linked web sources were inspected on **2026-10-27**, unless explicitly described as an unsuccessful retrieval. A publication date is given when available; “current source” means the public source inspected on that date, not a claim about its last release.

## The answer that changes the positioning

**I — Go with changes. The basic mechanism is occupied, including surprisingly close implementations.** Do not position this as the invention of snapshotting a JavaScript interpreter in Wasm, preserving promises, cloning a paused computation, or shipping a small heap between machines. The strongest counterexamples are:

- **F — Vercel Labs `quickjs-wasi`:** QuickJS-NG in Wasm, whole-VM snapshots including pending promises, binary serialization, and named host callback rebinding. The current package source says **3.6.3**; this is beyond the March 2026 RFC's original experiment. [Runtime][VQ], [package version][VQP].
- **F — Vercel Workflow:** experimental VM-memory snapshot support was **merged on October 1, 2026**, including storage implementations for local, Postgres, and Vercel Worlds. It is no longer accurate to describe this only as an open proposal. [Storage PR][VWS], [runtime PR][VWR], [release notes][VREL].
- **F — LangChain `quickjs-rs`:** QuickJS-NG compiled to Wasm and hosted by Wasmtime, with whole-heap snapshots, closures, aliases, and pending promises. Deep Agents has a checkpoint delta implementation for those images. [Runtime][LQ], [checkpoint code][LDELTA].
- **F — `coder-mike/xs-sandbox`:** a Wasm build of the XS JavaScript engine, **Node and browser** support, a `Uint8Array` heap snapshot, restore on another machine, and an advertised **~85 kB empty snapshot**. It is not QuickJS, but it directly overlaps the small-file/browser/server pitch. [README][XS].
- **F — Golem:** host-call journaling for ordinary Wasm programs, suspension/recovery, and execution `fork()`. Its normal recovery reconstructs the heap by replay; its current optional snapshots are application state plus files, not a portable dump of an arbitrary active Wasm stack. [Durability][GD], [fork description, October 2026][GB], [snapshot contract][GS].
- **F — Small projects go further in particular directions:** Stencil's `dquickts` serializes a QuickJS heap and safepoint-suspended synchronous frames; `TimeTravelJS` rewrites QuickJS execution to put frames in memory and offers browser history forks. [dquickts][DQ], [TimeTravelJS][TT].

**I — The remaining opportunity is a product and interoperability contract:** an independently usable, versioned capsule that carries a parked program, pending tool identities, authority requirements, and a replay position; works through tested adapters in browser Workers, server runtimes, and actual edge deployments; and has correct fork/effect ownership semantics. This survey did **not** find a mature product publicly demonstrating that entire contract as one supported feature. That is a bounded finding, not proof that nobody has it privately or that no new repo exists.

**I — “~100 KB” is a useful demo property, not a moat or a general size guarantee.** `xs-sandbox` already advertises smaller empty heaps. Other projects compress or delta-encode snapshots. Heap size depends on the program, retained data, engine, and shared base. The engine module, host adapters, tools, and stored external data are additional artifacts.

## What counts as the same capability?

**I — These distinctions prevent most misleading comparisons.**

1. **Journal recovery:** rerun code and supply previously recorded input/effect results. A local heap may be reconstructed exactly without being serialized. Golem, Temporal, Restate, Inngest, and DBOS mainly belong here.
2. **Application checkpoint:** explicitly serialize chosen data and call a recovery handler. A Cloudflare fiber's JSON `stash()` is this, even though the documentation calls it a snapshot.
3. **Interpreter image:** capture an interpreter's heap and continuations while the enclosing Wasm/native stack is quiescent, or after explicitly moving frames into serializable state. This is the closest capsule comparison.
4. **Machine/process image:** preserve guest RAM, registers, kernel/process state, and disk. E2B, Daytona, Modal, Morph, and Blaxel can preserve running programs, but their snapshots belong to their machine/runtime infrastructure.
5. **Initialization image:** Wizer, JS toolchain preinitialization, and engine startup snapshots avoid initialization. Repeatedly starting from one image resembles cloning, but does not by itself establish arbitrary mid-execution durability.

**I — Fork also has three meanings.** Creating another task with the same input is not a fork of existing execution. Copying a journal prefix is an execution-history fork. Restoring the same heap image into two independent instances is a memory fork. Both latter forms can be useful; neither duplicates an external payment, TCP peer, browser DOM, or database transaction safely by itself.

In the tables, **browser** means *the guest computation runs inside the browser*, not that a browser UI calls a remote VM. **ND** means no documented capability found in the sources inspected; it is deliberately weaker than “impossible.” **I: clone** means multiple restores appear sufficient mechanically, but a supported fork API or external-effect contract was not established. Mature base products can have experimental snapshot features.

## Comparison: direct and commercially important overlaps

The implementation descriptions below are **F** unless a cell explicitly says **I** or **ND**. Maturity is a source-based assessment, not an independent security certification.

| Builder / product | What it does; captured state | Fork? | Browser execution / movement | Licence and openness | Maturity as of 2026-10-27 |
|---|---|---|---|---|---|
| **Vercel Labs quickjs-wasi** [VQS][VQS] [VQ][VQ] | Sandboxed JS; linear-memory image plus VM pointers/stack metadata; pending promises; binary persistence; rebind host callbacks | **I: clone** by restoring one image twice; no transactional tool-fork contract established | Browser, Node, Deno, Bun are documented hosts; no supported all-host edge migration matrix found | MIT; public engine wrapper and TS API | Public package, source version 3.6.3; rapidly developing library |
| **Vercel Workflow SDK** [VREL][VREL] [VWI][VWI] | Durable workflow event log; QuickJS engine can save compressed/encrypted memory snapshots at suspension and consume subsequent events | ND for live heap branching; new runs alone are not forks | Workflow orchestration is server-facing; do not infer browser heap migration from a portable engine dependency | Apache-2.0 SDK; hosted World/service is separate | Active SDK; **memory snapshot interface and threshold explicitly experimental**, merged Oct 1 |
| **Vercel durable-harness** [VH][VH] [VHD][VHD] | Coding-agent harness sessions, turns, model/tool calls made durable over Workflow Worlds; recovery from event log | Session/history behavior; no documented arbitrary interpreter-heap fork | Public source includes IndexedDB testing/browser storage work; no whole-heap browser/server transfer contract established | Apache-2.0 public project | Announced Oct 19; package explicitly experimental, 0.0.x |
| **Vercel Sandbox** [VS][VS] [VSD][VSD] [VCA][VCA] | Firecracker-backed execution; persistent sandboxes, filesystem snapshots and disk-based continuation across sessions | Filesystem branching/fork supported; **not a live memory fork** in the inspected persistence docs | Remote Linux execution; browser UI/client only | Hosted infrastructure; public SDK does not make the service open source | Commercial service; filesystem persistence is shipped |
| **Golem Cloud / self-hosted runtime** [GD][GD] [GB][GB] | Wasm VM; every host interaction in oplog; reexecution reconstructs locals/closures/files. Optional application-state snapshot plus filesystem baseline | **Yes**, SDK `fork()` and history-prefix forks; implementation copies history/files and recovers child | Server Wasm runtime; no browser executor for its full durable host ABI found | Current server **BSL 1.1**, Apache-2.0 after four years; self-hostable/source-available. SDK/toolchain licences separate [GL][GL] | Established durable runtime; current managed Cloud described as Developer Preview |
| **Cloudflare Workers** [CW][CW] | V8 isolates; JS/Wasm execution; ordinary isolate memory is transient | ND for live isolate heap export/fork | Edge server execution; browser is a client. A Wasm guest may be portable independently | workerd Apache-2.0; managed platform is proprietary | Mature platform; no general live-heap migration API found |
| **Cloudflare Dynamic Workers** [CDW][CDW] | Load untrusted JS/Wasm dynamically into isolated Workers; explicit bindings/capabilities and resource limits | New child instances, **not** documented copies of an existing heap | Edge/workerd; no browser Dynamic Worker host | Loader source in Apache-2.0 workerd; hosted product separate | Shipped developer platform capability; exact limits remain platform-specific |
| **Cloudflare Durable Objects** [CDO][CDO] | Addressed actors plus durable storage; hibernation discards in-memory state and reactivation runs constructor | Can create a new object/copy application data; ND for live heap fork | Server-side actors; web clients do not execute actor heap | workerd code public; durable managed storage/service separate | Mature; **durable data is not durable V8 heap** |
| **Cloudflare Code Mode** [CCM][CCM] | Executes generated tool-composition code in isolated executor. Durable runtime logs connector calls/steps; approval aborts a pass and replay reruns source | No live heap fork found; rollback is connector compensation | DynamicWorkerExecutor runs on edge; browser-owned tools are RPC endpoints, not relocated execution | MIT package within public `cloudflare/agents` | Experimental package/runtime; current docs updated Oct 12 |
| **Cloudflare Agents SDK / fibers** [CF][CF] | DO-backed agents, SQLite state, queues/schedules; fibers explicitly save JSON recovery data with `stash()` and invoke recovery hook | User-defined state cloning only; ND for heap continuation fork | Agents run on DOs; browser SDK connects to them | MIT SDK; hosted services separate | Active SDK; fiber recovery is shipped, but is explicit checkpoint recovery |
| **Cloudflare Sandbox / Containers** [CSNAP][CSNAP] | Full container **filesystem** snapshots; explicitly excludes memory and running processes; tied to originating image version | New container from filesystem snapshot; not a live process fork | Remote containers; browser terminal is a client | Hosted container service; SDK/source openness does not include the managed infrastructure | Container snapshots public beta; docs updated Sep 30 / Oct 22 |
| **Temporal** [TEMP][TEMP] [TR][TR] | Durable workflows; deterministic workflow code + activity/timer/signal event history; replay rebuilds state | **Reset** copies history to a new run and terminates original; not two concurrent live memory branches | Server workers; browser client use is not workflow execution | MIT server and SDKs; proprietary managed Cloud | Mature production system |
| **Restate** [RE][RE] [REG][REG] | Journals durable steps/RPC/timers; SDK reconstructs execution by replay; keyed virtual-object state stored separately | Restart/recovery supported; ND for general concurrent live-heap fork | HTTP services/serverless hosts; no portable browser heap execution contract found | Server BSL 1.1 → Apache-2.0 after four years; public SDKs separate [REL][REL] | Production runtime and managed service |
| **Inngest** [IN][IN] | Stores step results; handler reruns and memoizes completed steps. TS v4 “checkpointing” runs consecutive steps in one handler, not heap-image persistence | Reruns/replay and child functions; ND for memory-image fork | Orchestrates hosted HTTP/connected functions; no browser continuation image | Server SSPL with future Apache licence; public SDKs separate [INL][INL] | Production platform; do not confuse its checkpoint term with memory snapshots |
| **DBOS** [DB][DB] [DBF][DBF] | Workflow inputs/step results in database; recovery reexecutes workflow prefix using saved results | **Yes, history fork** from selected step under new workflow ID; rewind mutates original history instead | Server SDKs; no browser heap migration | MIT TS runtime; managed offering separate | Production-oriented SDKs; documented fork/rewind APIs |
| **LangChain quickjs-rs / Deep Agents** [LQ][LQ] [LDELTA][LDELTA] | Python host + Wasmtime + QuickJS-NG Wasm; whole guest image including closures/job queue/promises. Deep Agents stores image/delta chains in checkpoints | **I: clone** of image; generic LangGraph checkpoint branching is distinct from pending external-call branching | Public wrapper is Python/Wasmtime; browser bridge and cross-V8 image exchange ND | MIT runtime, QuickJS MIT; public Deep Agents integration | Recent active package/integration, not a browser/edge portability product |
| **E2B** [E2][E2] [E2A][E2A] | Linux microVM per sandbox; memory/process/rootfs snapshots and dirty-page/rootfs diffs; pause/resume/checkpoint | **Yes**, sandbox snapshot-based fork, now also CLI support | Server microVM; browser clients/desktop streams only | Current runtime Apache-2.0; Embed/self-host option. Managed infrastructure/service separate | Production sandbox platform; fork and lifecycle modes evolving in 2026 |
| **Daytona** [DY][DY] [DYL][DYL] | Linux microVM memory+disk pause/resume and named snapshots; v2 `fork` defaults to memory for a running source | **Yes**, running processes copied; disk-only option. macOS is disk-only; GPU excludes these features | Remote machines; no browser execution of the VM | **Production core closed source since June 11, 2026**; old repo archived, SDKs/docs public [DYCL][DYCL] | Commercial service; VM pause/fork announced July 10 |
| **Modal** [MO][MO] [MOV][MOV] | Filesystem/directory images separately from full sandbox memory snapshots; current VM snapshot backend preserves memory and filesystem | **Yes**, restore snapshot into new sandboxes | Remote sandbox only | Hosted backend proprietary; Apache-2.0 Python client | Production compute; **sandbox memory snapshots alpha**, enabled-customer restrictions and backend-specific limits |
| **Morph Cloud / Infinibranch** [MOR][MOR] | Snapshot/branch full VM environments; preserves application/memory state through sleep | **Yes**, central product behavior | Remote VM/Devbox; browser terminal is client | Commercial proprietary service; client tooling separate | Commercial platform; no public portable browser snapshot format found |
| **Blaxel** [BL][BL] | Idle hibernation stores guest memory/process state and RAM-backed writable filesystem; base image separate | Hibernation yes; general fork API ND in inspected sources | Remote microVMs; no browser executor | Hosted proprietary service; SDK openness is separate | Commercial agent sandbox platform; Oct 8 snapshot architecture post |
| **Deno Sandbox / Deploy** [DEN][DEN] [DENV][DENV] | Run generated code in cloud sandboxes; protected secrets/egress; volumes and **filesystem** snapshots for prepared environments | New sandboxes/volume copies, not documented running-heap fork | Remote sandbox/Deploy execution; Deno-compatible source is not browser process state | Deno runtime MIT; hosted Sandbox/Deploy infrastructure not equivalent to the runtime licence | Sandbox launched beta Feb 3; Deploy platform production |

## Comparison: interpreter, toolchain, and research competitors

| Builder / project | What it does; captured state | Fork? | Browser execution / movement | Licence and openness | Maturity / important boundary |
|---|---|---|---|---|---|
| **XS Sandbox (`coder-mike/xs-sandbox`)** [XS][XS] [XSI][XSI] [XSP][XSP] | XS engine compiled to Wasm; quiescent heap export/restore; JSON-only host messages; README says empty snapshot ~85 kB | **I: clone** with multiple restores; durable tool broker ND | **Explicit Node and browser support**; Cloudflare edge adapter ND | Wrapper MIT; embedded Moddable LGPLv3/Apache-2.0 terms | Small public library; known runtime/stack-check issues documented; no production migration SLA |
| **Stencil `dquickts`** [DQ][DQ] [DQL][DQL] | Engine-level heap serialization with object indexes; pending async state plus selected synchronous frames moved to heap at safepoints; full/base/delta images | **I: clone** fresh runtimes from same snapshot | Native C/Rust; same build/word size required. Browser/Wasm package not established | MIT, including engine modifications and bindings | Repo created Oct 19; last push Oct 20; unreleased additions. More ambitious than await-only checkpoints |
| **NDevTK TimeTravelJS** [TT][TT] | Stackless QuickJS rewrite in Wasm; heap, interpreter frames/PC, virtual clock, embedded DOM; per-step COW page undo/redo, without reexecution | **Yes**, history branches after changing a past variable, per project | **Browser** app; cross-host durable service not established | Source public; no top-level project licence found. Vendored QuickJS MIT/Lexbor Apache notices do not licence all glue automatically | Research/demo project, not a supported agent platform |
| **santhreal/jsdet** [JSD][JSD] [JSDA][JSDA] | Malware/dynamic analysis using QuickJS-in-Wasm under Wasmtime; architecture describes linear-memory snapshot/restore for branching analysis | Branch/exploration architecture; shipped fork API/coverage unverified | Wasmtime server/tooling; browser adapter ND | MIT public repo | Very early repository; treat architecture claims separately from validated features |
| **igouss/pi-world** [PIW][PIW] | Agent grows a persistent QuickJS-Wasm application heap using quickjs-wasi; immutable snapshot revisions, speculative changes/checks, rollback | **Designed**, not shipped live execution fork; README separates deployed/built/spike/designed features | Prototype on celld/worker isolates; web UI is a client, not browser migration | Public source; no top-level licence established in inspected tree | Working single-node prototype; durable pending-promise path is a spike/design. Author reports ~146 KB gzip head images |
| **QuickJS-emscripten / rquickjs** [QE][QE] [RQ][RQ] | Widely reused QuickJS embedding layers; Emscripten/Asyncify or Rust/Wasm integration, callbacks, limits | ND for general durable whole-VM image API in upstream docs | quickjs-emscripten supports browser/Node; rquickjs supports native/Wasm targets | MIT wrappers/QuickJS; component notices apply | Established building blocks; async suspension is not by itself portable serialization |
| **Wasmer / WASIX / Instaboot** [WAS][WAS] [WCLI][WCLI] [WF][WF] | Journals syscalls, thread stacks, memory changes; snapshots restore thread/memory state; Asyncify required for described snapshot path; stack checkpoint/rewind and POSIX-like fork | **Yes**, WASIX `proc_fork(copy_memory)` | Wasmer has browser tooling, but server WASIX journaling/fork ABI is **not established as a drop-in browser API** | MIT runtime; Edge service separate | Shipped runtime mechanisms, present before 2026; not merely a startup-image idea |
| **Wasmtime / Wizer** [WT][WT] [WIZ][WIZ] | Wasmtime module serialization caches compiled code. Wizer executes initialization and emits a new Wasm module with initialized instance state | Reinstantiate an initialization image; ND for arbitrary live-stack export via standard Wasmtime API | Wizer output is Wasm; browser use depends on imports/features. Wasmtime itself is native | Apache-2.0 with LLVM exception | Mature runtime and preinit tooling; **compiled-module serialization is not instance checkpointing** |
| **Fermyon / Spin** [SPIN][SPIN] [SPKV][SPKV] | Wasmtime-based event components; JS SDK uses StarlingMonkey; KV/DB for persistent application state, preinit for startup | Fresh instances from component artifact; ND for live JS heap fork | Server/cloud/edge runtime; a component's browser compatibility is a separate adapter question | Spin Apache-2.0; framework now at `spinframework/spin`; hosted offerings separate | Production serverless ecosystem; not a general resumable process product |
| **Bytecode Alliance StarlingMonkey** [SM][SM] | SpiderMonkey engine compiled to Wasm with web builtins and WASI event loop; raw/specialized component variants | ND for supported durable running-heap fork | Component runtimes; browser via compatible component tooling/imports, not a universal host image contract | Apache-2.0 project plus bundled SpiderMonkey/dependency notices | Production users include Fastly Compute and Spin JS |
| **Bytecode Alliance ComponentizeJS** [CJS][CJS] | Turns JS + WIT into specialized Wasm components using StarlingMonkey and Wizer/preinit; event-loop/API plumbing | Reinstantiate built artifact; no live checkpoint/fork API found | Components can target compatible runtimes; browser adapters via jco | Apache-2.0 with LLVM exception; engine/dependency notices separate | Active toolchain; build-time heap initialization is not arbitrary suspension persistence |
| **Bytecode Alliance jco** [JCO][JCO] [JCOT][JCOT] | Transpiles components into JS modules and core Wasm; WASI shims for Node/browser; JS component authoring tools | ND; it is a toolchain, not an execution-history store | **Explicit browser and Node support**, subject to WASI/web capability limits | Apache-2.0 with LLVM exception | Active enabling infrastructure; does not automatically make host resources migratable |
| **Shopify-origin Javy** [JAV][JAV] [JAVI][JAVI] | QuickJS-based JS→Wasm toolchain; preinitializes runtime using Wizer; small dynamically linked programs share a runtime provider | Many starts from preinitialized module; general active heap fork ND | Wasm execution possible with required host/WASI adapters; browser deployment not a durable transfer contract | Apache-2.0 project, QuickJS/dependency terms separate; now Bytecode Alliance repo | Established compiler/runtime used for constrained functions; not a capsule scheduler |
| **Figma QuickJS plugin sandbox** [FIGSEC][FIGSEC] [FIGDOC][FIGDOC] | Figma's security update explicitly identifies **QuickJS cross-compiled to Wasm**; restricted plugin environment and messaging to iframe | No public persisted heap/fork API found | **Yes**, actual browser plugin execution; no move-to-server product found | Product implementation proprietary; QuickJS upstream MIT and public ecosystem wrappers separate | Long-running production precedent; historical disclosure does not establish every private 2026 engine detail |
| **Pyodide / CPython-Wasm** [PYS][PYS] [PYC][PYC] | CPython heap in Wasm. Pyodide private snapshot code copies linear memory plus serialized JS-reference registry; exact build identity checked | **I: clone** at compatible quiescent states, if all external refs reconstructed; no supported arbitrary CPython stack migration promise | Browser and Node base runtime; host/JS resources complicate transport; standard CPython-Wasm alone supplies no full checkpoint service | Pyodide MPL-2.0; CPython PSF and package licences separate | Mature Python-Wasm stack; snapshot APIs inspected are private/ignored, not a public stability guarantee |
| **Agoric SwingSet / xsnap / Moddable XS** [AG][AG] [AGR][AGR] | Resumable JS worker heap snapshots and transcript replay after baseline; snapshots restore on another computer | **I: clone** worker image; blockchain/vat identity and external authorities are separate | xsnap is native Node-controlled worker; XS has independent Wasm ports, not the same product | Agoric code Apache-2.0; XS/dependency licences must be checked separately | Production JS durability precedent years before this proposal |
| **Microvium** [MIC][MIC] [MICC][MICC] | Small JS subset; serializable loaded modules/functions/object state; run/build on desktop then resume snapshot in portable C VM | **I: clone** snapshot | Portable C; repo has Wasm build support, but browser/server/edge matrix ND | MIT | Established embedded-engine project; JS subset and 64 kB ROM/RAM ceiling make it a different workload envelope |
| **Pydantic Monty** [MON][MON] [MONR][MONR] | Python interpreter in Rust; dump whole session or paused call stack at host-call/future suspension; restore bytes in fresh session | **I: clone** compatible dumps; external effects still host-owned | Native and Wasm worker sessions; not a JS engine | MIT | v1.0 Sep 25; v1.4 Oct 26. Very close **programming model** in another language |
| **Lunatic** [LUN][LUN] | Erlang-inspired Wasm actors/processes with isolated heaps/stacks, supervision, messaging and distributed nodes | Spawn is documented; durable existing-process snapshot/fork ND | Server runtime; browser executor ND | Apache-2.0 OR MIT | Real implementation; repo last push Mar 29, **2025**. Do not present as active 2026 snapshot startup |
| **Unison / Unison Cloud** [UNI][UNI] [UNIF][UNIF] | Content-addressed code; typed abilities/continuations let computations and their dependencies execute remotely | `Remote.fork` spawns a remote computation; not arbitrary JS heap copying | Requires Unison runtimes; browser JS heap migration ND | MIT language/runtime, bundled BSD notices; Cloud separate | Shipped language/cloud; strongest conceptual precedent for moving code+data, different language contract |
| **Trigora / TCC Engine** [TCC][TCC] [TCCE][TCCE] | Continuation checkpointing at durable boundaries; stores resumable continuation/live state rather than replaying history; Rust engine supports native/Wasm embedding | Dynamic branching/child executions; live cloned-heap fork not established | Wasm embeddable engine; browser/server/edge compatibility of a single image ND | CLI/SDKs MIT; **engine BSL 1.1**, revenue/competing-infrastructure conditions, Apache change date in 2030 | Small 2026 entrant found through HN; claims should not be mistaken for independently benchmarked full-JS semantics |
| **Portmark** [PORT][PORT] | Signed portable-agent envelopes, policy-limited tool host, state checkpoint migration, optional Wasm payloads | ND for a live heap fork | Native/Node/Wasmtime paths; browser migration ND | Current source Elastic-2.0; earlier MIT versions identified by author | Reference implementation; migrates declared agent state, not demonstrated arbitrary active JS heap |
| **Faasm** [FAA][FAA] [FAAR][FAAR] | Wasm Faaslets, initialized snapshots, shared memory/state abstractions and server isolation | Initialized snapshot clones; do not infer arbitrary browser continuation fork | Linux/server runtime; browser ABI ND | Apache-2.0 | Published ATC 2020 system and public runtime; important old prior art |

## Closest implementations: what the table alone can hide

### Vercel is already implementing the underlying idea

**F — The March 7, 2026 Workflow RFC explicitly proposed running workflows in QuickJS-Wasm, saving the VM at suspension, restoring pending resolvers, and applying only subsequent events.** It described a fresh image around 256 KB and compression reducing size by roughly 60–70%. Those are the author's RFC figures, not measurements here. [RFC][VRFC].

**F — The October implementation retains replay as the correctness baseline.** `experimental_snapshots` is optional; without it Worlds replay the event history. Snapshot bytes and their event cursor must be stored atomically. The threshold runtime saves compressed/encrypted VM images, and normally requires an encryption key. [World interface][VWI], [October runtime merge][VWR].

**I — Implications:** the narrow claim “save a JS await continuation in a Wasm image to avoid replay” is directly occupied. Vercel can assemble a broader offering from engine, workflow store, harness adapters, and sandbox tools. Its public pieces do not establish an opaque snapshot of an entire native harness process: a Claude/Codex integration can make a *protocol/session* durable without serializing every local variable in the original executable.

**I — Fork by restoring twice is a small engine-level extension, not a deep barrier.** In quickjs-wasi, host callbacks must be rebound; the host must separately reconstruct pending tool delivery. The hard part of a production fork is deciding which branch may execute which external effect, and what happens when a tool completed but the result was not yet committed. Nothing about the ease of copying memory solves that.

**F — Inspecting the current quickjs-wasi serializer confirms the narrow capture boundary.** Format v2 stores linear memory, stack/runtime/context pointers, and extension loading metadata. Its header is versioned but carries no engine-module content hash. Restore reinstantiates extensions at their recorded memory/table offsets before copying memory. [Implementation][VQS]. **I — A transferable capsule should wrap this with module identity and broker metadata; versioned serialization alone is not a cross-version interoperability guarantee.**

### LangChain occupies the agent-framework route

**F — quickjs-rs explicitly requires a quiescent snapshot point: no in-flight `eval_async` or pending async host calls.** Its restoration checks guest build identity; its security contract treats images as trusted producer output, not arbitrary safe input. That caveat matters for Sofort's preferred “parked on a tool promise” API: a pending guest promise is different from an active host coroutine/callback crossing the embedding boundary. [Runtime contract][LQ].

**F — Deep Agents' `_snapshot.py` documents full heap images around 1.4 MB in its use case and successive binary patches around 200 B–1 KB, with periodic anchors.** It also includes snapshot authentication bound to thread identity. These are upstream implementation figures, not a head-to-head measurement. [Checkpoint code][LDELTA].

**I — Implications:** persistent REPLs, checkpointed agent tools, and small incremental histories are already being integrated where agent developers spend time. A capsule library without a better embedding/API story could become replaceable plumbing under LangGraph/Deep Agents. Conversely, that ecosystem is a plausible adopter if Sofort supplies a supported JS/browser/edge host layer rather than competing on framework orchestration.

### XS, Stencil, and TimeTravelJS remove most novelty claims

**F — XS Sandbox drains runnable promise jobs synchronously before returning and exposes JSON messages; its README records disabled stack checks and runtime issues.** [XS README][XS]. **I — Its size is an empty-heap example, not proof of general pending-tool/fork/edge correctness.** Browser-to-edge deployment and durable effect semantics remain separate work.

**F — The actual wrapper rejects `snapshot()` while the sandbox is active, allocates an output buffer through `takeSnapshot`, and returns a copied byte array; restore constructs another sandbox.** [Wrapper source][XSI]. **I — This is direct source evidence of the quiescent image API, not proof that an arbitrary synchronous stack can be exported.**

**F — dquickts uses semantic serialization, not a raw Wasm memory copy.** It registers native functions, writes indexes instead of pointers, and can serialize selected synchronous frames after a safepoint unwind. Its published limitations include same engine build/word size, unsupported host resources unless custom hooks exist, and trusted snapshot input. [Engine README][DQ], [snapshot implementation][DQS].

**I — That is potentially more expressive than an await-only capsule**, but is a different maintenance bet: a substantial QuickJS fork and serializer coverage rather than “all guest pointers remain valid in wasm32 linear memory.” Browser support and source-level correctness across the claimed engine features need validation. Do not turn a new repository's detailed README into a production-readiness conclusion.

**F — TimeTravelJS claims instruction/line-level snapshots and branches entirely in the browser by making the QuickJS interpreter stackless.** This is a more general suspension transformation than the Sofort spike's empty-Wasm-stack boundary. It includes an embedded DOM model in captured memory; that is different from capturing the actual browser DOM. [Project][TT].

**F — pi-world is also unusually close to the “branchable worlds” demo.** It uses quickjs-wasi images and checks proposed program changes against checkpoints, while explicitly labelling durable pauses/forks/replay as designed or spiked. [Current README][PIW]. **I — Compete on a completed execution/migration contract, not on the idea of an agent modifying a persistent heap.**

### Golem is the strongest semantic competitor, even without memory images

**F — Golem records external interactions at the Wasm-host boundary, including clock/random and concurrent completion order.** Its normal recovery reruns the program against the oplog. It documents `fork()` of history/files and optional user-defined application snapshots to reduce recovery replay. [Durability][GD], [snapshotting][GS], [fork behavior][GFORK].

**I — Its “resumes mid-function with memory/call stack/files” outcome is a real substitute**, even though recovery is not a flat heap restore. The user does not necessarily care whether the heap was copied or reconstructed. The meaningful differences are recovery work, language/host restrictions, artifact exportability, deployment footprint, and browser participation.

**F — Do not call today's Golem server permissively open source.** The inspected licence is BSL 1.1 with restrictions on commercial hosted/managed developer-platform services and a four-year Apache-2.0 conversion. This differs from its website's informal “open source” wording. [Actual licence][GL]. **I — A genuinely permissive, embeddable capsule runtime could matter to infrastructure vendors that cannot simply embed Golem under those terms.**

### Cloudflare owns the natural edge distribution path

**F — Code Mode's durable runtime is explicitly an abort-and-replay system:** it records ordered connector calls, aborts for approval, and reruns source using saved results. Direct nondeterminism needs `codemode.step()` or equivalent journal discipline. Its executor stores no durable state; the runtime does. Browser-owned tools and browser automation do not imply browser-owned code execution. [How it works, updated October 12][CCM].

**F — Agents fibers also do not preserve stacks.** `stash()` accepts JSON and replaces the prior checkpoint; application code implements `onFiberRecovered()`. DO hibernation discards ordinary in-memory state. [Fibers][CF], [DO lifecycle, updated October 15][CDO].

**I — Cloudflare can ship a capsule using the same strategy as Sofort:** a small interpreter in Wasm, Dynamic Worker isolation/bindings, SQLite/R2 persistence, and Agents/Code Mode integration. It does not need a generic V8 isolate serializer. It already controls several of the hardest distribution and tool-authority seams. A browser-to-edge continuation example would be an easy story for it to tell once the format and broker semantics are fixed.

### VM providers compete on the result, with a different artifact boundary

**F — E2B and Daytona now provide actual running-state branches; old descriptions of them as filesystem-only are stale.** E2B's current source describes memory dirty-page/rootfs diffs and checkpoint/pause handling; its September 21 changelog lists CLI sandbox fork. Daytona's v2 API defaults to memory forks for running Linux sandboxes and explicitly distinguishes disk-only/macOS/GPU cases. [E2B architecture][E2A], [E2B changelog][E2CH], [Daytona API][DY].

**F — Modal's memory-snapshot capability remains alpha in current docs.** Its current VM backend also has enabled-customer restrictions. Common snapshot documentation describes TCP reset/reconnection requirements, instance-type constraints, retention, and backend-specific running-exec limitations. These must not be flattened into “all workloads can be frozen anywhere.” [Snapshot guide][MO], [VM backend][MOV].

**I — The capsule advantage is reach and controlled scope, not the invention of pause/fork.** A complete Linux environment runs far more software. A small interpreter with a few host imports can make state transport/rebinding much simpler and can run in a browser. Its lower *artifact size for constrained workloads* is credible; its superiority in total resident memory is not established by configured-GB VM prices. The local October 27 report already finds jitk and Hyperlight in the same per-VM memory range. [Local fair memory comparison](../../jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md).

## Academic work: portable execution state is an established research problem

The central problem is that Wasm linear memory does **not** include all active operand/control frames, mutable globals, tables, imported resources, or runtime state. The projects below attack that missing state rather than assuming a byte copy solves everything.

| Work / date | F: mechanism and demonstrated scope | Fork / browser / openness / maturity |
|---|---|---|
| **Wharf / MVVM**, arXiv **2024-10-21**, current public MVVM artifact | Uses Wasm as machine-independent state plus a WASI/system-state virtualization layer; checkpoint/restore and compiler/runtime support for heterogeneous-host migration | Migration research, not a browser JS product. **I:** multiple restores might branch, but managed effect-safe fork is unverified. Public artifact; MVVM top-level BSD-2-Clause, dependencies separate. [Paper][WHARF], [artifact][MVVM], [licence][MVL] |
| **Wanco**, POPL SRC **2025-01-22**, MPLR **2025-10-14** | AOT instrumentation, stack maps/on-stack replacement between native machine state and portable Wasm state; paper targets Linux ARMv8/x86-64 | Compiler/runtime cooperation, not stock browser execution. Checkpoint/restore implemented; live fork service ND. MIT code, benchmark exceptions. Research artifact. Reported overhead belongs to paper workloads, not QuickJS inference. [MPLR paper abstract][WANP], [source][WANC], [licence][WANL] |
| **Tinto, Marchiori, Vardanega**, JSA 168, **November 2025** | Rewrites Wasm bytecode into regions with checkpoint/restore procedures; targets migration across heterogeneous runtimes and compiled execution | Runtime-neutral migration is the goal; no agent tool-broker or general browser-JS product demonstrated. Public/open-source tools reported; exact code licence not independently established. Paper is open access under Creative Commons. [University record][TIN], [paper][TINPDF] |
| **Nakata / Matsubara**, Mid4CC **2025-12-15** | Self-host a Wasm interpreter inside Wasm so inner execution state has one representation, then snapshot it; conceptually close to interpreter-in-Wasm capsules | Browser support/fork service not established from the talk. Public author presentation; accompanying implementation licence not verified. Research, not a commercial runtime. [Author slides][NAK] |
| **Faasm**, USENIX ATC **July 2020** | Restores already initialized Wasm Faaslets and supplies server host facilities, shared state and memory mechanisms | Important prior art for efficient snapshot-based server execution; not a demonstration of browser/server live JS migration. Apache-2.0 runtime. [Paper][FAA], [source][FAAR] |

**I — Sofort's deliberate `await` boundary is a scope reduction, not a solution to arbitrary Wasm checkpointing.** An unresolved guest promise stores the JS continuation as interpreter heap objects; after the embedding returns, the live Wasm stack can be empty. The Oct 25 spike demonstrated this specific case. Arbitrary preemption inside QuickJS C/native code needs transformations such as Asyncify, a stackless interpreter, or explicit engine/compiler support. Do not bundle that stronger claim into the browser/server/edge pitch.

## GitHub, Hacker News, and X discovery audit

**F — Searches were run on all three requested surfaces.** This is a broad, bounded landscape survey rather than a claim to enumerate every sandbox service or private project.

- **GitHub:** repository API and indexed source searches included `quickjs snapshot in:description`, `quickjs snapshot in:name,description,readme`, `snapshot javascript wasm in:description`, `wasm checkpoint migration in:name,description`, and additional engine-specific searches. Broad README search returned many false positives, including release artifacts called “SNAPSHOT”; these were not counted as live heap implementations. Directly inspected relevant discoveries include **quickjs-wasi, quickjs-rs, dquickts, TimeTravelJS, jsdet, xs-sandbox, pi-world, Trigora, and Portmark**. Public source is evidence of an implementation/proposal, not proof of maturity.
- **Hacker News:** used the public Algolia API's date search with a **2026-01-01 lower bound**, plus indexed HN queries. `durable execution` surfaced **[Trigora's Show HN, October 7](https://news.ycombinator.com/item?id=49994446)** and its September 9 article; subsequent assessment above uses the author's repository and engine terms, not commenter speculation. A precise `QuickJS snapshot` story query returned no 2026 stories in that API search; broader Wasm queries were noisy. Search coverage is not a market-share estimate. [API query][HNQ].
- **X:** separate indexed searches for `"quickjs-wasi" site:x.com`, `"dquickts" site:x.com`, `"durable-harness" site:x.com`, and broader QuickJS/Wasm snapshot terms returned **no usable primary posts**. X indexing/access is incomplete. No capability claim here relies on an unseen tweet, and these empty results are **not evidence of absence**. Recent project claims are anchored to their repositories, docs, and announcements instead.

**F — Repository metadata checks sharpen maturity rather than ranking popularity.** quickjs-wasi was created March 6 and last pushed October 19; quickjs-rs April 16 / October 23; dquickts October 19 / October 20; TimeTravelJS July 19 / September 25; jsdet April 25 / August 30; Portmark August 28 / October 27. Lunatic's last push was March 29, 2025. These are GitHub metadata dates read on October 27, not promises that the default-branch feature shipped in a package. The current Daytona legacy repository reports `archived: true`. [Representative API metadata][GHMETA], [Daytona repository notice][DYREPO].

**I — Other adjacent categories are crowded too.** LangGraph-style graph checkpoints, ordinary actor stores, code-mode wrappers, CRIU/native process tools, Firecracker snapshot managers, and initialized JS heaps all predate this proposal. They are not interchangeable with a portable active interpreter heap. The report concentrates on the named platforms and the closest newly discovered implementations; it does not claim every CI runner, agent framework, code interpreter API, or historical continuation language has been exhaustively audited.

## What is occupied, and what is still open?

### Already done by somebody

| Claim fragment | Assessment on 2026-10-27 |
|---|---|
| Execute hostile/generated JS in a sandbox | **F: heavily occupied.** Figma/QuickJS embeddings, Workers/Dynamic Workers, the Vercel and LangChain Wasm interpreters, and VM sandbox providers all address versions of it. Isolation boundaries and capabilities differ. |
| Pause ordinary code at external waits and recover after failures | **F: occupied.** Golem, Temporal, Restate, Inngest, DBOS, Vercel Workflow and Code Mode cover it through different replay/checkpoint models. |
| Preserve actual JS closures/promises rather than manually selected JSON state | **F: occupied.** quickjs-wasi, quickjs-rs and dquickts explicitly document it. |
| Serialize an interpreter heap as bytes | **F: occupied.** QuickJS variants, XS Sandbox/xsnap and Microvium. |
| Small snapshot around 100 KB | **F: occupied as an example**, particularly XS Sandbox's ~85 kB empty image. **I:** any universal fixed-size promise would be false for growing heaps. |
| Browser and server run an image of the same JS VM | **F: documented in XS Sandbox.** **F/M-prior:** Sofort's Oct 25 spike also exercised Wasmtime→Node/browser/workerd/Dynamic Worker. This report did not independently reproduce either. |
| Fork a running program | **F: occupied.** Golem history fork; E2B/Daytona/Modal/Morph machine snapshots; TimeTravelJS browser timelines. **I:** repeated restore of other interpreter images mechanically enables branches. |
| Avoid recovery cost proportional to the entire execution history | **F: occupied.** Vercel snapshot+delta-event recovery, Golem optional snapshots, Trigora continuation checkpoints, and interpreter snapshot tools. Actual restoration still scales with loaded state. |
| Move execution state across CPU architectures | **F: established for constrained interpreters/Wasm and academic systems.** Native machine memory images remain ISA/runtime dependent. |
| Same hardware and software isolation programming model | **I: useful integration angle, not automatically a unique primitive.** The two tiers need explicit trust/compatibility boundaries; native jitk RAM is not directly a Wasm image. |

### Plausibly unoccupied as a mature, coherent offering

These are **I — gaps in the inspected public product contracts**, not unqualified claims that no one has written such code:

1. **A genuinely portable execution capsule, not a platform snapshot ID.** A downloadable, content-addressed state artifact with exact engine/module identity, schema/ABI version, required imports/capabilities, pending operations, and journal cursor; usable without the originating cloud account. Reconstructing a host callback registry must be specified, not left as an embedding exercise.
2. **Supported browser↔server↔edge handoff of the *same parked program*.** A browser Worker starts work, a server restores it, an edge Worker forks it, and a browser can later receive the chosen continuation. Existing libraries make much of this plausible. This survey found no mature product guaranteeing the full matrix, deployment compatibility, resource ceilings, and artifact lifecycle. The gap could be closed quickly by existing players.
3. **Forkable tool authority and effect ownership.** Distinguish simulated/recorded tool replies from permission to issue a real write. Persist operation identity before dispatch, resolve uncertain outcomes, invalidate or reissue credentials per branch, and forbid a stale branch from resuming after ownership transfers. Golem/workflow engines already solve substantial parts; “snapshot + journal” alone is not a new exactly-once protocol.
4. **A useful small-computer scope with explicit limits.** Standardize the tool-only ABI, CPU/memory/output caps, cancellation, compatibility rejection, and trusted snapshot provenance. Exclude accidental filesystem/socket/host-object capture. This can be simpler and more portable than an entire Node process or Linux machine.
5. **A polished debugger and handoff experience.** Inspect “what is this program waiting for?”, fork with different tool answers, compare outcomes, export the incident, and resume on another host. TimeTravelJS and pi-world already explore overlapping experiences. Sofort would need better integration and reliability, not merely the same demonstration.

**I — What is *not* a durable differentiator:** “we use QuickJS in Wasm,” “awaits survive,” “no server RAM while sleeping,” “forks are cheap,” or “~100 KB compressed.” Each is already public prior art or straightforwardly adjacent. Permissive licensing, cross-host conformance, effect semantics, and developer experience are more defensible reasons to choose an implementation, although none prevents a well-resourced competitor from copying the product shape.

### What the file must not promise

**I — Be precise about “live.”** A parked interpreter continuation can be live semantically even with an empty native/Wasm stack. It does not imply stopping the host at any instruction. **I — Be precise about “move.”** Import results and authority bindings can move; an already-issued HTTP request, real browser document, GPU kernel, native addon, or socket peer does not become portable because the JS heap did. **I — Be precise about “file.”** A state delta depends on its base; an interpreter image depends on a compatible engine module; encrypted bytes depend on keys. Report the dependency set and total bytes, not just the smallest member.

**M-prior — The local evidence remains valuable:** [Oct 25 portability report](../portability/02-wasm.md) demonstrated the exact constrained path on local runtimes and two diverging forks. **I — It establishes feasibility in Sofort's chosen ABI, not market uniqueness or a production Cloudflare deployment.** The next work should turn that scoped feasibility into a supported contract.

## Who is most likely to ship the remaining combination next?

These are **I — relative judgments**, not forecasts with measured probabilities.

1. **Vercel / its engine and Workflow contributors.** It already owns the closest JS/Wasm library, a snapshot-backed durable runtime, local/Postgres/cloud stores, and fresh harness integrations. The most likely route is a reusable quickjs-wasi capsule adapter plus Workflow semantics. **Part of the proposed combination has already shipped experimentally.** Adding a browser/edge conformance story would not require a new engine invention.
2. **Cloudflare.** Best distribution advantage for edge execution and tools, existing Dynamic Workers/DOs/Agents/Code Mode, and a natural browser-initiated use case. A Wasm interpreter sidesteps the need to expose V8 internal isolate state. Its current replay/JSON mechanisms leave a clear incremental feature path.
3. **LangChain.** Already has an interpreter image and checkpoint integration close to real agent workflows. Browser/TypeScript/edge adapters and pending-operation transport are the missing part of this specific combination; adoption pressure can fund them.
4. **Golem.** Strongest existing durable-host semantics and execution-history forks. It could package snapshot acceleration/export and a narrower portable guest ABI. Browser participation would require a deliberate change to its current server-runtime contract, and its platform business/licence may favor cloud-bound execution.
5. **A small runtime team: Stencil, the XS/Microvium ecosystem, or a new continuation startup.** dquickts and XS Sandbox show how much a focused team can already implement. Trigora and Monty show demand for serialized continuations beyond JS. Small size and low-level portability are not reserved for cloud incumbents.

**I — E2B, Daytona, Modal, Morph, and Blaxel are more likely to improve machine branching/hibernation than prioritize browser interpreter images.** They already satisfy the stronger compatibility requirement for full Linux applications. They remain major substitutes whenever customers value npm/native tools, filesystem state, and complete agent workspaces more than browser portability.

## Primary-source index and dates

All entries: **accessed 2026-10-27**. Older papers and launch posts are included as prior art; current docs/source were also inspected where available. Licence statements refer to inspected files, not a blanket conclusion about every dependency or hosted component. Mutable branch links are intentional for current-state evidence; the two decisive Vercel merge links and commit SHAs make that finding reproducible.

- **VQ / VQP:** [quickjs-wasi README][VQ], [package.json][VQP], current source, version 3.6.3; repo created 2026-03-06, pushed 2026-10-19.
- **VQS:** [quickjs-wasi snapshot implementation][VQS], current source; serializer format version 2 and extension reconstruction inspected directly.
- **VRFC:** [Workflow RFC #1298][VRFC], **2026-03-07**.
- **VWS / VWR:** [PR #3250][VWS], merged **2026-10-01**, commit `2084d3598c578f1d96f82ca8e4062629a43a28aa`; [PR #3251][VWR], merged **2026-10-01**, commit `b79ad013d254d60cc1e53e65dfd806da24a8964b`.
- **VREL / VWI:** [Workflow release notes][VREL], [current snapshot storage interface][VWI].
- **VH / VHD:** [Making every harness durable][VH], **2026-10-19**; [package README][VHD], current source; [Apache licence](https://github.com/vercel-labs/durable-harness/blob/main/LICENSE.md).
- **VS / VSD / VCA:** [Sandbox persistence guide][VS], **2026-06-29**; [Sandbox snapshot implementation][VSD], **2026-04-02**; [cloud agent lifecycle/fork description][VCA], October 2026; [vendor's explicit filesystem-versus-memory comparison](https://vercel.com/kb/guide/vercel-sandbox-vs-e2b).
- **GD / GS / GB / GFORK:** [Golem durability][GD], [user-defined snapshotting][GS], current v1.6 docs; [October overview with `fork()`][GB], October 2026; [durable-stream prefix fork contract][GFORK].
- **GL:** [Golem current BSL licence][GL].
- **CW / CDW / CDO:** [Workers Wasm][CW], [Dynamic Workers][CDW], current docs; [DO lifecycle][CDO], updated **2026-10-15**.
- **CCM / CF:** [Code Mode implementation model][CCM], updated **2026-10-12**; [fiber execution/recovery][CF], current docs; [Code Mode source](https://github.com/cloudflare/agents/tree/main/packages/codemode), [MIT licence](https://github.com/cloudflare/agents/blob/main/LICENSE).
- **CSNAP:** [Container filesystem snapshot contract][CSNAP], updated **2026-09-30**; [sandbox save/restore guide](https://developers.cloudflare.com/sandbox/files/save-and-restore-a-workspace/), updated **2026-10-22**.
- **TEMP / TR:** [Temporal workflow/replay model][TEMP], [reset definition][TR], current docs; [MIT server](https://github.com/temporalio/temporal).
- **RE / REG / REL:** [Restate versioned agent recovery][RE], March 2026; [official Go SDK replay contract][REG], current package; [actual server licence][REL].
- **IN / INL:** [Inngest workflow model][IN], current docs; [server licence][INL].
- **DB / DBF:** [DBOS TS workflows][DB], [fork/rewind][DBF], current docs; [MIT runtime](https://github.com/dbos-inc/dbos-transact-ts).
- **LQ / LDELTA:** [quickjs-rs README][LQ], [Deep Agents snapshot/delta code][LDELTA], current source; [MIT licence](https://github.com/langchain-ai/quickjs-rs/blob/main/LICENSE).
- **E2 / E2A / E2CH:** [E2B platform][E2], [runtime architecture][E2A], [2026 weekly changelog][E2CH], including **2026-09-21** CLI fork and **2026-10-12** filesystem-only lifecycle modes.
- **DY / DYL / DYCL:** [Daytona v2 API][DY], [Linux memory snapshots][DYL], current docs; [pause/fork launch](https://www.daytona.io/dotfiles/vms-pause-and-fork), **2026-07-10**; [closed-source announcement][DYCL], **2026-06-11**; [archived repository notice][DYREPO].
- **MO / MOV:** [Modal snapshot types and limitations][MO], [VM memory snapshot alpha][MOV], current docs; [Apache client](https://github.com/modal-labs/modal-client).
- **MOR / BL:** [Morph developer documentation][MOR], current; [Blaxel snapshot architecture][BL], **2026-10-08**.
- **DEN / DENV:** [Deno Sandbox launch][DEN], **2026-02-03**; [volume snapshot contract][DENV], current docs.
- **XS / XSI / XSP:** [XS Sandbox README][XS], [wrapper implementation][XSI], [package licence metadata][XSP], current source, including browser/Node usage, size and limitations.
- **DQ / DQS / DQL:** [dquickts README][DQ], [snapshot source][DQS], [MIT licence][DQL], current source; repository created **2026-10-19**.
- **TT / JSD / JSDA / PIW:** [TimeTravelJS][TT], [jsdet][JSD], [jsdet architecture][JSDA], [pi-world][PIW], current repositories; implementation status is qualified above.
- **QE / RQ:** [quickjs-emscripten][QE], [rquickjs][RQ], current READMEs.
- **WAS / WCLI / WF / WT / WIZ:** [Wasmer Instaboot internals][WAS], 2024; [current CLI journal/snapshot options][WCLI], [WASIX fork][WF], [Wasmtime module serialization][WT], [current Wizer API/caveats][WIZ].
- **SPIN / SPKV / SM:** [Spin source][SPIN], [Spin application persistence model][SPKV], [StarlingMonkey README/adopters][SM], current source/docs.
- **CJS / JCO / JCOT / JAV / JAVI:** [ComponentizeJS][CJS], [jco][JCO], [jco browser transpilation docs][JCOT], [Javy][JAV], [Javy preinit issue][JAVI], issue opened **2026-08-09**; the issue is evidence of preinitialization behavior, not an endorsed vulnerability assessment.
- **FIG / FIGSEC / FIGDOC:** [Figma's architecture article][FIG], **2019-08-22**, later amended; [security follow-up explicitly naming QuickJS][FIGSEC], 2019; [current plugin environment][FIGDOC]. Historical use does not establish unchanged private engine internals in 2026.
- **PYS / PYC:** [Pyodide snapshot implementation][PYS], [loader/config/build identity][PYC], current private source APIs.
- **AG / AGR:** [Agoric xsnap API][AG], [snapshot plus transcript recovery issue][AGR], issue **2022-04-08**, plus current source.
- **MIC / MICC / MON / MONR:** [Microvium][MIC], [snapshot concepts][MICC], current docs; [Monty snapshot API][MON], [Monty releases][MONR], latest **2026-10-26**.
- **LUN / UNI / UNIF:** [Lunatic source][LUN], last push **2025-03-29**; [Unison continuation/remote explanation][UNI], 2023; [current runtime/distribution FAQ][UNIF].
- **TCC / TCCE / PORT:** [Trigora][TCC], [TCC Engine][TCCE], current source; [Portmark][PORT], current reference implementation and source-available terms.
- **WHARF / MVVM / WANC / WANP / TIN / NAK / FAA:** research dates and publication/artefact links appear in the academic comparison above.

## Five-line TL;DR

1. **F:** QuickJS-in-Wasm heap snapshots with pending promises already exist at Vercel and LangChain; Vercel Workflow merged experimental snapshot recovery on October 1, 2026.
2. **F:** XS Sandbox already documents browser/Node heap transport and an ~85 kB empty image; small-file JS computers are established prior art.
3. **F:** Golem, workflow engines, and VM sandbox providers already cover durable execution and several kinds of fork, with materially different capture mechanisms.
4. **I:** The remaining gap is a supported provider-neutral capsule, browser/server/edge conformance, and correct pending-tool/authority/effect semantics—not the memory-copy trick.
5. **I:** Vercel is the nearest likely consolidator, followed by Cloudflare and LangChain; Sofort should compete on the completed contract and a compelling integration.

**Verdict — GO-WITH-CHANGES for this angle.** Build if portability and tool-boundary semantics are the product; do not build on a premise of unoccupied snapshot technology or a unique ~100 KB size claim.

**The three things I would do next:**

1. **Run a small competitor conformance spike** against pinned quickjs-wasi, quickjs-rs, and XS Sandbox: pending guest promise, closure/cycle/typed array, two divergent restores, and browser→server→actual edge deployment. Record unsupported cases and *total* artifacts. Compare with the existing Sofort spike before committing to a separate engine wrapper.
2. **Specify capsule and fork semantics first:** engine/module hash, state kind/version, import ABI, journal cursor, pending-operation IDs, branch identity, authority rebinding, ownership fencing, crash points, and trusted-image provenance. Make the broker responsible for real effects and uncertain outcomes.
3. **Deliver one differentiating end-to-end demo:** a browser-started program pauses for approval, exports its capsule, forks on an edge host with simulated tool outcomes, and resumes the selected branch on a server with exactly one authorized real write. Publish the compatibility matrix and failure behavior; keep jitk as the explicit hardware tier.

[VQ]: https://github.com/vercel-labs/quickjs-wasi
[VQP]: https://github.com/vercel-labs/quickjs-wasi/blob/main/package.json
[VQS]: https://github.com/vercel-labs/quickjs-wasi/blob/main/src/index.ts
[VRFC]: https://github.com/vercel/workflow/discussions/1298
[VWS]: https://github.com/vercel/workflow/pull/3250
[VWR]: https://github.com/vercel/workflow/pull/3251
[VREL]: https://github.com/vercel/workflow/releases
[VWI]: https://github.com/vercel/workflow/blob/main/packages/world/src/interfaces.ts
[VH]: https://vercel.com/blog/making-every-harness-durable
[VHD]: https://github.com/vercel-labs/durable-harness/blob/main/packages/durable-harness/README.md
[VS]: https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence
[VSD]: https://vercel.com/blog/optimizing-vercel-sandbox-snapshots
[VCA]: https://vercel.com/i/cloud-agents
[GD]: https://learn.golem.cloud/v1.6/concepts/durable-execution
[GS]: https://learn.golem.cloud/v1.6/develop/snapshotting
[GB]: https://golem.cloud/blog/whats-this-golem-cloud-thing-about/
[GFORK]: https://learn.golem.cloud/v1.6/develop/durable-stream-forks
[GL]: https://github.com/golemcloud/golem/blob/main/LICENSE
[CW]: https://developers.cloudflare.com/workers/runtime-apis/webassembly/
[CDW]: https://developers.cloudflare.com/dynamic-workers/
[CDO]: https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
[CCM]: https://developers.cloudflare.com/agents/tools/codemode/how-it-works/
[CF]: https://developers.cloudflare.com/agents/runtime/execution/durable-execution/
[CSNAP]: https://developers.cloudflare.com/containers/guides/snapshots/
[TEMP]: https://docs.temporal.io/workflows
[TR]: https://docs.temporal.io/glossary#reset
[RE]: https://restate.dev/blog/dealing-with-versioning-in-long-running-agents
[REG]: https://pkg.go.dev/github.com/restatedev/sdk-go
[REL]: https://github.com/restatedev/restate/blob/main/LICENSE
[IN]: https://www.inngest.com/docs/durable-execution/durable-workflows
[INL]: https://github.com/inngest/inngest/blob/main/LICENSE.md
[DB]: https://docs.dbos.dev/typescript/tutorials/workflow-tutorial
[DBF]: https://docs.dbos.dev/typescript/tutorials/workflow-management
[LQ]: https://github.com/langchain-ai/quickjs-rs
[LDELTA]: https://github.com/langchain-ai/deepagents/blob/main/libs/partners/quickjs/langchain_quickjs/_snapshot.py
[E2]: https://e2b.dev/
[E2A]: https://github.com/e2b-dev/runtime/blob/main/docs/ARCHITECTURE.md
[E2CH]: https://changelog.e2b.dev/product-updates
[DY]: https://www.daytona.io/docs/en/v2/typescript-sdk/sandbox/
[DYL]: https://www.daytona.io/docs/en/v2/linux-sandboxes/
[DYCL]: https://www.daytona.io/dotfiles/updates/daytona-is-going-closed-source
[DYREPO]: https://github.com/daytonaio/daytona
[MO]: https://modal.com/docs/guide/sandbox-snapshots
[MOV]: https://modal.com/docs/guide/vm-memory-snapshots
[MOR]: https://cloud.morph.so/docs/developers
[BL]: https://blaxel.ai/blog/sandbox-snapshot-hibernate-resume-ai-agents
[DEN]: https://deno.com/blog/introducing-deno-sandbox
[DENV]: https://docs.deno.com/sandbox/volumes/
[XS]: https://github.com/coder-mike/xs-sandbox/blob/main/readme.md
[XSI]: https://github.com/coder-mike/xs-sandbox/blob/main/src/index.mts
[XSP]: https://github.com/coder-mike/xs-sandbox/blob/main/package.json
[DQ]: https://github.com/stencil-hq/dquickts
[DQS]: https://github.com/stencil-hq/dquickts/blob/master/quickjs-snapshot.c
[DQL]: https://github.com/stencil-hq/dquickts/blob/master/LICENSE
[TT]: https://github.com/NDevTK/TimeTravelJS
[JSD]: https://github.com/santhreal/jsdet
[JSDA]: https://github.com/santhreal/jsdet/blob/main/ARCHITECTURE.md
[PIW]: https://github.com/igouss/pi-world
[QE]: https://github.com/justjake/quickjs-emscripten
[RQ]: https://github.com/DelSkayn/rquickjs
[WAS]: https://wasmer.io/posts/announcing-instaboot-instant-cold-starts-for-serverless-apps
[WCLI]: https://docs.wasmer.io/runtime/cli/
[WF]: https://www.wasix.org/docs/api-reference/wasix/proc_fork/
[WT]: https://docs.wasmtime.dev/api/wasmtime/struct.Module.html
[WIZ]: https://docs.wasmtime.dev/api/wasmtime_wizer/struct.Wizer.html
[SPIN]: https://github.com/spinframework/spin
[SPKV]: https://developer.fermyon.com/cloud/changelog/cloud-key-value
[SM]: https://github.com/bytecodealliance/StarlingMonkey
[CJS]: https://github.com/bytecodealliance/ComponentizeJS
[JCO]: https://github.com/bytecodealliance/jco
[JCOT]: https://github.com/bytecodealliance/jco/blob/main/docs/src/transpiling.md
[JAV]: https://github.com/bytecodealliance/javy
[JAVI]: https://github.com/bytecodealliance/javy/issues/1270
[FIG]: https://www.figma.com/blog/how-we-built-the-figma-plugin-system/
[FIGSEC]: https://www.figma.com/blog/an-update-on-plugin-security/
[FIGDOC]: https://developers.figma.com/docs/plugins/how-plugins-run/
[PYS]: https://github.com/pyodide/pyodide/blob/main/src/js/snapshot.ts
[PYC]: https://github.com/pyodide/pyodide/blob/main/src/js/pyodide.ts
[AG]: https://github.com/Agoric/agoric-sdk/blob/master/packages/xsnap/README.md
[AGR]: https://github.com/Agoric/agoric-sdk/issues/5040
[MIC]: https://github.com/coder-mike/microvium
[MICC]: https://github.com/coder-mike/microvium/blob/main/doc/concepts.md
[MON]: https://github.com/pydantic/monty/blob/main/docs/snapshots.md
[MONR]: https://github.com/pydantic/monty/releases
[LUN]: https://github.com/lunatic-solutions/lunatic
[UNI]: https://www.unison-lang.org/blog/visualizing-remote/
[UNIF]: https://www.unison-lang.org/docs/usage-topics/general-faqs/
[TCC]: https://github.com/trigora-dev/trigora
[TCCE]: https://github.com/trigora-dev/tcc-engine
[PORT]: https://github.com/Itsthewayofyou/portmark
[FAA]: https://www.usenix.org/conference/atc20/presentation/shillaker
[FAAR]: https://github.com/faasm/faasm
[WHARF]: https://arxiv.org/abs/2410.15894
[MVVM]: https://github.com/Multi-V-VM/MVVM/blob/main/README.md
[MVL]: https://github.com/Multi-V-VM/MVVM/blob/main/LICENSE
[WANP]: https://conf.researchr.org/details/icfp-splash-2025/mplr-2025-papers/1/Bringing-Together-Cross-ISA-Checkpoint-Restoration-and-AOT-Compilation-of-WebAssembly
[WANC]: https://github.com/tamaroning/wanco
[WANL]: https://github.com/tamaroning/wanco/blob/master/LICENSE
[TIN]: https://www.research.unipd.it/handle/11577/3558761
[TINPDF]: https://research.unipd.it/retrieve/3f09ee34-9cc7-4356-b4a9-ffc7694ad4a2/JSA%202025%20-%20Tinto.pdf
[NAK]: https://d1eu30co0ohy4w.cloudfront.net/chikuwait/restore-in-edge-cloud-continuum
[HNQ]: https://hn.algolia.com/api/v1/search_by_date?query=durable%20execution&tags=story&numericFilters=created_at_i%3E1767225600
[GHMETA]: https://api.github.com/repos/vercel-labs/quickjs-wasi
