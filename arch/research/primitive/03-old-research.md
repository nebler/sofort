# Old research worth reviving on a pausable tiny computer

Research date: 2026-10-25. Angle: systems, programming languages, and distributed-systems ideas whose deployment assumptions were too demanding for broad adoption. Prepared against [BRIEF.md](BRIEF.md); only this report was written. No implementation or benchmark was performed.

## Finding

**The best revival is a first-class, branchable continuation whose external effects are controlled by a broker.** A small computer blocked on a tool result can become an object that an agent stores, duplicates, tests, hands to a human, or resumes elsewhere. Worlds, persistent processes, speculative execution, and replay debugging become different operations on the same object.

**[I] The opportunity is narrower than “old research finally works.”** Several predecessors worked commercially or remain useful. KeyKOS was small and deployed; rr is practical; Firecracker is production infrastructure; Catalyzer's authors report industrial adoption. Their history does not support a blanket story that memory was always too large or isolation unavailable. Sofort's potentially useful change is to restrict the operating environment until execution state and external interactions become manageable together.

**[I] Recommended order:** reproducible incident capsules first as an engineering milestone; branchable worlds as the distinctive demonstration; persistent approval continuations as the product wedge. The final top-three ranking weighs novelty as well as delivery risk, so it puts worlds first.

## Evidence, scope, and cost conventions

- **[F]** means a published/source-backed fact, or a project fact explicitly supplied by the brief. **[I]** means my interpretation, proposed product, estimate, or hypothesis. Historical adoption explanations marked [I] are diagnoses, not measured causal histories.
- **Built [B], per brief:** fresh single-use hardware microVM; static QuickJS and Lua; JSON-lines tool channel as the only guest I/O; trusted host executor; MCP server; read-only resource FS. Reported measurements: approximately 6 ms raw cold / 9 ms through executor, 2.1 ms warm MCP call, 10.7 MiB per parked VM. These are supplied project measurements, not independently reproduced here. [F: brief](BRIEF.md)
- **Planned [S]:** snapshot/restore at an explicit pending-tool boundary, disk persistence, host-side cloning, compatible-host migration, and shared CoW pages targeting roughly 1 MiB marginal memory. **Planned [R]:** kernel-controlled nondeterminism and deterministic replay from snapshots plus an ordered interaction journal. **Planned [C]:** capability stubs and promise pipelining. **Planned [H]:** content-addressed images keyed by kernel profile, binaries, resources, and grants. These labels do not assert delivery. [F: brief](BRIEF.md)
- **[F] Compatibility limits:** no guest fork/exec, threads, shared libraries, network, or writable persistent filesystem today; QuickJS is reported 3–5× slower than V8 JIT. Host-side snapshot cloning is planned and is distinct from adding guest `fork`. Full Linux development workspaces remain out of scope. [Brief](BRIEF.md)
- **[I] Additional host work [E]:** durable request ledger, effect classification, authorization, branch selection, idempotency, quotas, and audit receipts. These are necessary implementation work beyond the named planned primitive. A VM snapshot alone supplies none of them.
- **[I] “1 MiB” is not a demonstrated archive size, peak working set, or whole-host per-tenant cost.** Shared resident memory, private dirty memory, snapshot bytes, journal bytes, and hypervisor overhead must be measured separately. Large JSON results or heaps can dominate. The existing [memory research](../next/01-snapshots-memory.md) explicitly makes these distinctions.
- **[I] Effort:** engineer-weeks (ew), for one experienced engineer building a narrow Linux prototype on one ISA. Shared foundations [S]+[R]+basic [E] are provisionally **4–8 ew**, with substantial uncertainty; capability rebinding and migration add risk. Per-idea effort below is **additional** to its missing foundations, not a production estimate. Hardened multi-tenant service operation is a separate project. [B]-only proposals can start immediately.
- **[I] Scores:** novelty N, feasibility F, demo/Twitter D, and business B are 1–5; higher is better. Novelty measures the proposed combination relative to the checked alternatives, not invention priority. Feasibility includes today's missing substrate. Demo appeal and business potential are hypotheses, not market evidence.

## Current alternatives that constrain every revival

**[F] Durable execution and forking already exist.** Temporal reconstructs workflow state by replaying event history, with nondeterministic work in Activities. Golem records interactions at its Wasm/host boundary and rebuilds execution from its oplog; its worker API also supports forks at an oplog index. Ordinary durability or “fork an agent” is therefore insufficient differentiation. [Temporal workflow definitions](https://docs.temporal.io/workflow-definition), [Golem durable execution](https://learn.golem.cloud/v1.6/concepts/durable-execution), [Golem worker fork API](https://learn.golem.cloud/v1.6/rest-api/worker#fork-a-worker)

**[F] Small hardware sandboxes and warm snapshots already exist.** Hyperlight-Unikraft's pinned October 24, 2026 README documents ordinary Linux runtimes, default-deny host access, warmed snapshots, and MCP integration. Firecracker supports restoring a running guest; open connections and compatibility have explicit limitations. [Hyperlight-Unikraft, pinned README](https://github.com/hyperlight-dev/hyperlight-unikraft/blob/5f14d1e73039f2cfb4928766586cfe75a87301ad/README.md), [Firecracker snapshot documentation](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md)

**[I] Necessity test used below:** Sofort matters when a user simultaneously needs supported native execution, hardware separation from other tenants, and operations on the complete live continuation without hand-serializing application state. If a Wasm target, a trusted workflow, a SQL query, or an ordinary process suffices, prefer the existing tool. No reviewed idea intrinsically requires Sofort by name; its implementation must earn the role through measurements and simpler integration.

## 1. Process migration → move an agent continuation, not a Unix workstation

**Pitch / user [I]:** an agent platform can move a paused task off an evicted host without restarting its program or repeating completed tool calls.

**Original idea and papers [F]:** Douglis and Ousterhout, *Transparent Process Migration: Design Alternatives and the Sprite Implementation*, **Software: Practice and Experience, 1991**, moved executing processes among workstations and evicted them when owners returned. Barak and La'adan, *The MOSIX Multicomputer Operating System for High Performance Cluster Computing*, **Future Generation Computer Systems, 1998**, used preemptive migration for adaptive resource sharing. Litzkow, Livny, and Mutka, *Condor—A Hunter of Idle Workstations*, **ICDCS, 1988**, checkpointed background jobs and moved them to available machines. [Sprite paper](https://onlinelibrary.wiley.com/doi/10.1002/spe.4380210802), [MOSIX paper](https://doi.org/10.1016/S0167-739X(97)00037-X), [Condor paper](https://www.cs.umd.edu/class/fall2022/cmsc714/Readings/condor-icdcs88.pdf)

**Why niche [F/I]:** migration had to preserve OS relationships, not just registers. Historical Condor standard-universe jobs needed relinking and excluded fork/exec, kernel threads, and several IPC/memory features; long-lived connections could delay migration. A practical MOSIX deployment reported home-node syscall forwarding prevented effective distribution of its build workload. [F: historical Condor manual](https://htcondor.readthedocs.io/en/v8_8/users-manual/running-a-job-steps.html), [F: McClure et al., USENIX ATC/FREENIX, 2000](https://static.usenix.org/event/usenix2000/freenix/full_papers/mcclure/mcclure_html/index.html). [I] These systems were useful; broad transparent Unix compatibility was the expensive ambition.

**What changed / build [I]:** AI glue programs frequently wait on remote work; their CPU state may be small while tools hold the real resources. Hardware virtualization is commodity, and MCP offers existing tool integrations. Keep those integrations at a stable broker, save the continuation at a clean boundary, and transfer it to a compatible worker. Implement leases and fencing so old and new workers cannot both execute live effects. Destination workers must recover the pending-request record rather than reissue it blindly.

**Closest / necessity [I]:** CRIU/VM migration is preferable for real Linux workloads; Golem already supplies durable relocation semantics for its target. Sofort's case is a small native capsule with no sockets/files to reconstruct. Transfer time still depends on actual bytes and network latency; arm64 snapshots do not become x86 snapshots, and HVF→KVM is not automatically supported.

**Dependencies / effort / scores [I]:** [B]+[S]+[E], [C] for durable handle rebinding; +3–6 ew after local restore. N3 / F3 / D4 / B3. Demo: drain one worker while a program awaits a tool; resume elsewhere with the same local variables and exactly one broker-owned request.

## 2. Orthogonal persistence → persistent approval continuations

**Pitch / user [I]:** an automation developer writes a normal program that waits days for a person, survives a host restart, and resumes with its local state intact.

**Original idea and papers [F]:** Bomberger et al., *The KeyKOS Nanokernel Architecture*, **USENIX Workshop on Micro-Kernels and Other Kernel Architectures, 1992**, describes a capability OS in commercial use since 1983 with checkpointed process/register state. Shapiro, Smith, and Farber, *EROS: A Fast Capability System*, **SOSP, 1999**, combines transparent persistence and protected components. Dearle et al., *Grasshopper: An Orthogonally Persistent Operating System*, **Computing Systems 7(3), 1994**, makes storage, execution, and access explicit through containers, loci, and capabilities. Atkinson et al., *An Orthogonally Persistent Java*, **ACM SIGMOD Record 25(4), 1996**, pursues persistence without application-level flattening. [KeyKOS](https://pdos.csail.mit.edu/6.828/2010/readings/keykos.pdf), [EROS](https://flint.cs.yale.edu/cs428/doc/eros.pdf), [Grasshopper](https://www.usenix.org/publications/compsystems/1994/sum_dearle.pdf), [PJava/PJama lineage](https://w3.cs.jmu.edu/bernstdh/web/CS685/papers/atkinson-et-al-1996.pdf)

**Later PJama evidence [F]:** Atkinson and Jordan, *A Review of the Rationale and Architectures of PJama*, **Sun Microsystems Laboratories technical report SMLI TR-2000-90, 2000**, reports durability, schema evolution with instance reformatting, platform migration, and recovery. These were implemented capabilities, not problems nobody had solved. [PJama review, successor Oracle Labs archive](https://apexapps.oracle.com/pls/apex/f?p=94065%3A10%3A113433518364425%3A1780)

**Why niche [F/I]:** Grasshopper explicitly identifies the inefficiency of building a complete persistent abstract machine over a conventional OS; PJava notes the scarcity of persistent OSes and practical gaps such as AWT persistence. EROS reports competitive primitive costs, so “capabilities were too slow” is an inaccurate explanation. [I] Ecosystem replacement, foreign-resource recovery, code evolution, and preserving bad state mattered at least as much as RAM. Persistence does not fix a persistent bug.

**What changed / build [I]:** give each generated tool program its own durable lifetime rather than making an entire desktop persistent. Implement `await approval(request)` as a pending broker response; checkpoint, release resident execution resources, and restore when approval arrives. Pin the old kernel/runtime/code while the continuation lives. Offer explicit export/restart for upgrades rather than promising arbitrary live code migration.

**Closest / necessity [I]:** Temporal and Golem already solve the user-level durability problem; Waterken also persisted capability-connected objects. Sofort is justified only where preserving a supported native runtime's complete live stack/heap behind a hardware boundary is valuable. It should coexist with a workflow engine, not recreate schedules, queues, retries, and operations consoles prematurely.

**Dependencies / effort / scores [I]:** [B]+[S]+[E], [R] for recovery between checkpoints; +2–4 ew. N3 / F4 / D5 / B4. Demo: stop a host while `approval` is pending, restart next day, and finish without manually serializing local state or repeating earlier tools.

## 3. Mobile agents → carry a running program to an approved data site

**Pitch / user [I]:** an enterprise data owner receives a bounded program, runs it beside private tools, and returns a small result instead of exporting raw data.

**Original idea and papers [F]:** Jim White's Telescript account, *A Common Agent Platform*, **W3C/OMG Workshop on Distributed Objects and Mobile Code, 1996**, describes unattended programs endowed with authority and able to move between hosts. Lange and Oshima, *Mobile Agents with Java: The Aglet API*, **World Wide Web 1(3), 1998**, describes Java agents that dispatch among execution contexts. Robert Gray, *Agent Tcl: A Flexible and Secure Mobile-Agent System*, **USENIX Tcl/Tk Workshop, 1996**, explicitly identifies Telescript's language and security-model complexity as a barrier. [Telescript](https://www.w3.org/OOP/9606_Workshop/submissions/36-w3c-paper.htm), [Aglets paper](https://csis.pace.edu/~marchese/CS865/Papers/aglet.pdf), [Agent Tcl](https://www.usenix.org/legacy/publications/library/proceedings/tcl96/gray.html)

**Why niche [I]:** asking many organizations to install mutually compatible agent engines and trust visiting code created a network adoption problem. Language sandboxes did not eliminate resource accounting or the distinction between protecting a host from an agent and protecting an agent from its host. Aglets' serialized-object lifecycle is also not equivalent to transporting an arbitrary native instruction pointer.

**What changed / build [I]:** AI agents can produce short bespoke programs; MCP supplies useful service endpoints; hardware isolation can contain visiting code; planned small snapshots reduce transport cost. Build a two-site service: suspend, export an encrypted capsule, import into an explicitly trusted compatible site, and bind a destination-specific capability set. Start with source-plus-input shipping; add live continuation movement only when preserving work is demonstrably useful.

**Closest / necessity [I]:** remote functions, database UDFs, and Wasm plugins are simpler for one-hop computation. The distinctive version is multi-step native computation that must retain intermediate execution state across approved sites. Isolation protects the host; a hostile host can still inspect the guest's data without an additional confidentiality mechanism. Shipping does not override data export policy.

**Dependencies / effort / scores [I]:** [B] for fresh remote execution; [S]+[C]+[E] for live transport; +4–8 ew. N4 / F2 / D5 / B3. Demo: a running program visits two approved sites while raw datasets stay local. Do not call it general secure Internet mobility.

## 4. Capability systems → an agent's authority becomes explicit, attenuable state

**Pitch / user [I]:** platform owners give generated code an object granting one task's authority, rather than credentials with an ambient account identity.

**Original idea and sources [F]:** KeyKOS and EROS above provide the OS lineage. Klein et al., *seL4: Formal Verification of an OS Kernel*, **SOSP, 2009**, establishes machine-checked kernel functional correctness under stated assumptions. Miller, *Robust Composition*, **Johns Hopkins PhD dissertation, 2006**, develops E's access-control/concurrency model. Waterken's **project documentation, 2008-era**, describes persistent Java objects, eventual sends, and web-key authority. Fuchsia's **living project documentation, checked 2026**, routes capabilities through component namespaces. [seL4](https://sites.cs.ucsb.edu/~sherwood/cs290/papers/sel4.pdf), [E dissertation](https://www.erights.org/talks/thesis/index.html), [Waterken](https://waterken.sourceforge.net/), [Fuchsia](https://fuchsia.dev/fuchsia-src/concepts/components/v2/capabilities)

**Why niche [I]:** new OS/language adoption and compatibility with ambient-authority libraries were major costs. Revocation, durable identities, and understanding delegated authority remained real design tasks. These ideas are alive; the primitive is not reviving capabilities from extinction, and its small kernel has none of seL4's proof merely by being small.

**What changed / build [I]:** make the host channel a reference monitor for arbitrary guest bytes. A guest-local handle indexes a per-run host table; JSON strings cannot nominate arbitrary objects. Wrap objects with task-specific method/argument limits, deadline, and host-held budget. Stubs can be copied, but authority is rechecked at every invocation. Forks share a parent quota rather than duplicating it. Revocation generations live outside rollbackable guest memory.

**Closest / necessity [F/I]:** Cap'n Proto RPC already passes capabilities and pipelines calls; Varda and Faulkner's *Cap'n Web*, **Cloudflare project release, 2025**, brings JSON-based object RPC to the web. [F: Cap'n Proto](https://capnproto.org/rpc.html), [F: Cap'n Web](https://blog.cloudflare.com/capnweb-javascript-rpc-library/). [I] Sofort adds a containment boundary for code that is not written in a capability-safe language. MCP is an integration surface, not the enforcement mechanism; pipelining reduces round trips only when dependencies can actually be represented in the protocol.

**Dependencies / effort / scores [I]:** [B]+[C]+[E], [S] for durable vats; +3–6 ew for a deliberately small object protocol. N3 / F4 / D4 / B4. Demo: a branch attempts a forbidden method, exceeds the shared quota, and tries an old revoked handle after restore; all fail at the host.

## 5. Smalltalk/Lisp images → a frozen executable thought, with provenance

**Pitch / user [I]:** an agent researcher saves a running experiment, shares its complete state with a teammate, and forks it without reconstructing the notebook session.

**Original idea and sources [F]:** Ingalls et al., *Back to the Future: The Story of Squeak, a Practical Smalltalk Written in Itself*, **OOPSLA, 1997**, describes the image/object-memory and portable interpreter approach. Teitelman and Masinter, *The Interlisp Programming Environment*, **IEEE Computer 14(4), 1981**, documents the interactive Lisp environment. Modern Lisp retains image saving: SBCL documents that `save-lisp-and-die` preserves global state, unwinds the stack, changes streams, and constrains running threads. [Squeak paper](https://worrydream.com/refs/Ingalls_1997_-_Back_to_the_Future.pdf), [Interlisp paper](https://larrymasinter.net/interlisp-ieee.pdf), [SBCL source contract](https://github.com/sbcl/sbcl/blob/master/src/code/save.lisp)

**Why niche [I]:** images were practical inside their ecosystems. Portability, source review, hidden mutable state, runtime compatibility, and external handles were the costs of treating an entire environment as a document. A saved heap is not automatically a restartable live process, as SBCL's explicit restrictions illustrate.

**What changed / build [I]:** use tiny task images rather than huge development environments. Package the snapshot with immutable code/resource hashes, a human-readable source manifest, a journal prefix, and a capability request manifest. Publish a “resume this experiment” artifact that opens in offline replay by default. It captures program state, not the LLM's internal weights or hidden inference state; model responses are recorded inputs.

**Closest / necessity [I]:** Squeak/Pharo images, SBCL cores, notebooks, and VM snapshots already cover large parts. Sofort is useful when the experiment contains untrusted generated native execution and must retain its actual pending computation. There is little advantage for a pure data-analysis notebook whose state can be exported cleanly. This proposal does not claim Lisp itself is supported today.

**Dependencies / effort / scores [I]:** [S]+[R]+[H]+[E]; +2–3 ew for artifact packaging after replay exists. N2 / F4 / D4 / B2. Demo: share an artifact, inspect its source and grants, resume at the same pending call, then branch. Long-lived artifact compatibility remains a support commitment.

## 6. Deterministic systems → independent deterministic islands, not deterministic shared memory

**Pitch / user [I]:** an agent runtime runs many independent programs concurrently while making each program reproducible from a fixed input history.

**Original idea and papers [F]:** Devietti et al., *DMP: Deterministic Shared Memory Multiprocessing*, **ASPLOS, 2009**, controls inter-thread communication. Bocchino et al., *A Type and Effect System for Deterministic Parallel Java*, **OOPSLA, 2009**, uses language-level restrictions. Liu et al., *Dthreads: Efficient Deterministic Multithreading*, **SOSP, 2011**, separates threads into processes and orders updates. Veeraraghavan et al., *DoublePlay: Parallelizing Sequential Logging and Replay*, **ASPLOS, 2011—not EuroSys**, uses additional execution and epoch parallelism to simplify recording. [DMP](https://llvm.org/pubs/2009-03-ASPLOS-DMP.html), [DPJ specification and paper reference](https://dpj.cs.illinois.edu/DPJ/Download_files/DPJSpecification.html), [Dthreads proceedings](https://sigops.org/s/conferences/sosp/2011/current/abstracts.html), [DoublePlay](https://people.cs.vt.edu/dongyoon/papers/ASPLOS-11-DoublePlay.pdf)

**Closer ancestor [F]:** Aviram et al., *Efficient System-Enforced Deterministic Parallelism*, **OSDI, 2010**, makes Determinator's shared-nothing spaces and communication deterministic. Hermit, **current project documentation, checked 2026; no conference venue asserted**, determinizes Linux execution through interception and thread scheduling. [Determinator](https://dedis.cs.yale.edu/2010/det/papers/osdi10-abs/), [Hermit](https://github.com/facebookexperimental/hermit)

**Why niche / what changed [I]:** unrestricted shared-memory concurrency forces expensive ordering, restricted languages, or complex recording. Sofort currently has no threads; most proposed parallelism is between VMs. Keep that restriction. AI tool programs can tolerate sequential local computation while host operations overlap. Record reply-delivery order, including errors, timeouts, and cancellation. Replaying values alone is insufficient when `Promise.race` or callback order changes control flow.

**Build / closest / necessity [I]:** an island runner and scheduler whose per-VM journal determines all visible inputs. Compare against Hermit for Linux compatibility and against Wasm for small deterministic execution. Sofort's benefit is the narrower native/hardware envelope; it does not solve deterministic multithreading. Audit timer registers, hardware random instructions, CPU features, floating-point modes, and kernel-visible events before asserting exact replay. One physical core alone is not sufficient.

**Dependencies / effort / scores [I]:** [B]+[R]+[E], [S] for replay anchors; +2–4 ew of determinism validation. N2 / F3 / D3 / B3. Demo: reorder live remote completions, capture the ordering, and reproduce the same branch on repeated offline runs. Parallel islands need a separate global ordering if they share external state.

## 7. Record/replay and time travel → an executable incident attachment

**Pitch / user [I]:** an agent-platform engineer attaches the failing computer and its inputs to a bug report, then investigates offline without touching production tools.

**Original idea and papers [F]:** Dunlap et al., *ReVirt: Enabling Intrusion Analysis Through Virtual-Machine Logging and Replay*, **OSDI, 2002**, records VM execution for later analysis. O'Callahan et al., *Engineering Record and Replay for Deployability*, **USENIX ATC, 2017**, makes rr practical for real low-parallelism applications using stock software/hardware under specific constraints. rr already offers reverse execution; this is not a new debugger category. [ReVirt](https://www.usenix.org/conference/osdi-02/revirt-enabling-intrusion-analysis-through-virtual-machine-logging-and-replay), [rr](https://www.usenix.org/conference/atc17/technical-sessions/presentation/ocallahan)

**Why not universal [F/I]:** rr's paper discusses deployment burdens of whole-VM capture, instrumentation, compiler changes, and multiprocessor ordering. Its successful solution still has an explicit hardware/OS/workload envelope. [I] Sofort trades broad application compatibility for a much smaller capture boundary, rather than discovering a universal low-overhead replay technique.

**What changed / build [I]:** model outputs and tool responses are already explicit data at the guest boundary; small execution state can make incident retention practical. Save image identity, snapshot, exact ordered requests/replies, virtual clock/random events, and final observable state digest. Replay with no live write capabilities. Halt at the first unexpected outgoing request instead of returning an old result by sequence number alone. Add a user interface for stepping between tool boundaries; source-level reverse stepping requires additional runtime/debug instrumentation and is a later feature.

**Closest / necessity [I]:** rr remains better for supported ordinary Linux programs; telemetry traces remain cheaper for merely observing calls. Golem history debugging competes directly. Sofort earns its place if a replay artifact captures otherwise inaccessible native program state and hardware isolation permits handling an untrusted incident safely. Redacting captured bytes can invalidate exact replay; encrypted access-controlled originals and separately sanitized reproductions are different artifacts.

**Dependencies / effort / scores [I]:** [B]+[R]+[H]+[E], [S] for short replay distances; +2–4 ew. N3 / F4 / D5 / B4. Demo: replay one failed run repeatedly with production access disabled, then inject a changed tool result as an explicitly new branch. Re-querying an LLM is not replay.

## 8. Speculator → continue under a predicted tool result, with output fenced

**Pitch / user [I]:** a latency-sensitive agent workflow computes ahead while a slow read is outstanding and discards the work if its prediction was wrong.

**Original idea and paper [F]:** Nightingale, Chen, and Flinn, *Speculative Execution in a Distributed File System*, **SOSP, 2005**, introduces Speculator: checkpoint, predict a remote operation, continue, and roll back on mismatch. It tracks causal dependencies among processes and prevents speculative execution from externalizing output before validation. [Speculator paper](https://www.cs.cmu.edu/~dga/15-849/papers/speculator-sosp2005.pdf)

**Why niche [F/I]:** the implementation must handle dependency propagation through OS interactions and coordinate file-system protocols. [I] The hard part is not simply cheap checkpointing; an incorrect prediction must never become an irreversible external action. Broadly capturing Unix IPC makes that enforcement expensive.

**What changed / build [I]:** a single tool channel supplies a natural place to stop all externally visible effects. Prototype only predictable reads: cached resource metadata or a result with a small discrete outcome set. Resume a clone with the predicted reply while the broker awaits the actual result. Buffer or deny further tool requests until dependencies validate; even a read can leak data or consume billable resources. On byte-for-byte match, keep the clone; otherwise resume the parent with the actual reply. Use semantic equivalence only when explicitly defined by the tool.

**Closest / necessity [I]:** prefetch, cached reads, and ordinary application speculation can avoid the platform work. Sofort matters for generated imperative code whose state cannot be easily undone by the application. Do not speculate on unconstrained model prose: exact-match probability is poor, and extra model calls may cost much more than the saved latency. Cap'n Proto promise pipelining avoids some waterfalls without making predictions; use that first where applicable.

**Dependencies / effort / scores [I]:** [S]+[R]+strict [E]; +3–5 ew. N4 / F3 / D5 / B3. Demo: a delayed metadata lookup, a correct prediction, a wrong prediction, and proof that no speculative branch issued a real mutation. Measure useful latency saved per extra CPU/tool dollar.

## 9. Warth's Worlds → first-class alternative futures for arbitrary guest state

**Pitch / user [I]:** an agent can bookmark its running computation, explore alternatives, and adopt one future while discarding the others.

**Original idea and paper [F]:** Warth, Ohshima, Kaehler, and Kay, *Worlds: Controlling the Scope of Side Effects*, **ECOOP, 2011**, makes state a first-class construct in JavaScript and Squeak. Worlds can sprout children, retain local changes, and commit changes to a parent. An earlier Warth/Kay **VPRI research note, 2008**, is a precursor, not the final four-author conference paper. [ECOOP paper, authors' technical-report copy](https://tinlizzie.org/VPRIPapers/tr2011001_final_worlds.pdf)

**Why niche [I]:** language/runtime changes are necessary when every field lookup and update can depend on a world. Native libraries and external effects do not automatically respect those semantics. Smalltalk/JS research prototypes demonstrated the abstraction, but did not turn arbitrary remote APIs into mergeable state.

**What changed / build [I]:** planned CoW microVM clones move the isolation boundary below the entire guest runtime. AI agents are natural consumers of multiple alternatives and can tolerate explicit branch selection. Implement host APIs `bookmark`, `branch`, `inspect`, `select`, and `discard`, callable through the tool protocol. Each child gets a hypothetical reply to the pending call and an isolated journal suffix. Initially allow only recorded reads and simulated writes. A winning branch can receive newly checked live grants.

**Critical semantic limit [I]:** this is a whole-computation analogue of Worlds, not an implementation of the paper's object-level commit/merge semantics. Select a winning VM; do not merge two arbitrary heaps. Already-issued effects cannot be discarded. “Commit” initially means selecting a continuation and submitting its proposed effects through a broker with validation, not atomically changing the Internet.

**Closest / necessity [I]:** Golem already forks worker histories; ordinary process `fork` and language Worlds remain strong alternatives. Sofort's possible distinction is hardware-separated native continuation branches with measured low marginal state. For a small serializable planner state, duplicating a JSON structure is simpler.

**Dependencies / effort / scores [I]:** [B]+[S]+[R]+[E], [C] for branch authority; +3–5 ew for a branch manager and inspectable effect proposals. N4 / F3 / D5 / B4. Demo: one prepared continuation, eight futures from the same pending read, one selected outcome, zero writes from losing branches. Measure real memory and branch overhead rather than assuming eight MiB.

## 10. Transactional/undoable computation → prepare effects before choosing to issue them

**Pitch / user [I]:** an automation operator inspects a proposed action set while the program's internal state remains parked immediately before those actions.

**Original idea and papers [F]:** Satyanarayanan et al., *Lightweight Recoverable Virtual Memory*, **SOSP, 1993**, offers transactional guarantees for regions of virtual memory. Frantz and Landau, *Object-Oriented Transaction Processing in the KeyKOS Microkernel*, **USENIX Microkernels and Other Architectures Symposium, 1993**, combines checkpointed objects with transaction processing. Waterken's *Live Fast, Die Young and Leave a Good-Looking Corpse*, **project design document, 2008**, persists objects at event-turn boundaries before externally visible I/O. [RVM](https://doi.org/10.1145/168619.168631), [KeyKOS transactions](https://www.usenix.org/conference/usenix-microkernels-and-other-architectures-symposium/object-oriented-transaction), [Waterken persistence/upgrade](https://waterken.sourceforge.net/upgrade/)

**Why niche [I]:** memory atomicity and external-service atomicity are different problems. A local transaction does not recall a sent email. Cross-system transactions require participant protocols; compensation is an application-specific action and can fail. Waterken's upgrade discussion is particularly relevant: durable state needs a lifecycle, not just a save button.

**What changed / build [I]:** the only-I/O channel makes it possible to enforce a prepare stage for generated code. Expose tool adapters that return opaque proposal tokens and anticipated results. Checkpoint before submitting proposals. After review, revalidate versions and invoke the live adapter under a durable operation ID. Where a service supports a genuine transaction, use it; elsewhere submit actions individually with visible partial-failure state. Never synthesize successful write results unless the adapter supplies a valid simulation model.

**Closest / necessity [I]:** SQL transactions, dry-run APIs, workflow sagas, and existing approval systems often suffice. Sofort adds rollback of otherwise opaque native execution state around preparation. It cannot supply arbitrary atomic multi-tool commits. The crash after a remote write succeeds but before its response is durably logged still needs remote idempotency or reconciliation.

**Dependencies / effort / scores [I]:** [B]+[E] for a simple approval gate; [S]+[R] for persistent transactional computation; +3–6 ew for two carefully chosen adapters. N3 / F3 / D5 / B4. Demo: review and reject a prepared change, resume another branch, and inject a partial commit failure honestly.

## 11. Fork-based search → reuse a computational prefix, not just a prompt

**Pitch / user [I]:** an evaluation engineer explores tool outcomes or candidate plans from the same expensive prepared program state.

**Original idea and paper [F]:** Cadar, Dunbar, and Engler, *KLEE: Unassisted and Automatic Generation of High-Coverage Tests for Complex Systems Programs*, **OSDI, 2008**, maintains execution states with registers, stack, heap, and path constraints, forks at feasible branches, and selects states with search heuristics. [KLEE](https://static.usenix.org/event/osdi08/tech/full_papers/cadar/cadar_html/)

**Why niche [I]:** symbolic search faces state explosion, environment modeling, and constraint-solving costs. Those remain. Sofort does not gain symbolic execution from VM cloning, nor does physical CoW make the number of futures stop growing exponentially.

**What changed / build [I]:** tool-boundary branching is much coarser than instruction-level search. An AI agent can choose a small number of meaningful alternatives, and the host can bound each branch's CPU, RAM, token spend, and effects. Snapshot after a costly parse/index step, supply 8–32 candidate inputs as replies to an explicit branch tool, and compare outputs under a fixed evaluator. Cache completed prefix results and retain only a bounded beam of continuations.

**Closest / necessity [I]:** Golem's worker forks are a direct competitor; KLEE remains appropriate for symbolic tests; serializing a small planner is often sufficient. Sofort helps when native prefix state is opaque and expensive to recreate. If the only costly prefix is remote LLM computation, caching the response bytes may buy most of the benefit without VM cloning. A clone does not share an external model's KV cache unless a separate model-serving interface implements that.

**Dependencies / effort / scores [I]:** [S]+[R]+[E]; +2–4 ew for bounded search orchestration. N3 / F4 / D5 / B3. Demo: compare rerun-from-start, explicit-state serialization, and snapshot branching on the same evaluation task. Adoption requires a useful speed/cost gain, not just a wide branching animation.

## 12. Unikernels → a disposable operating environment for each piece of generated glue

**Pitch / user [I]:** a tool platform runs small untrusted programs with a kernel profile that contains only the guest interfaces those programs need.

**Original idea and papers [F]:** Madhavapeddy et al., *Unikernels: Library Operating Systems for the Cloud*, **ASPLOS, 2013**, specializes application and system libraries into a small appliance. Martins et al., *ClickOS and the Art of Network Function Virtualization*, **NSDI, 2014**, builds small VMs for packet processing. Manco et al., *My VM Is Lighter (and Safer) than Your Container*, **SOSP, 2017**, shows LightVM needs both small guests and a fast Xen control plane; its reported VM boot is 2.3 ms. [Mirage paper](https://anil.recoil.org/papers/2013-asplos-mirage), [ClickOS](https://www.usenix.org/conference/nsdi14/technical-sessions/presentation/martins), [LightVM](https://www.cs.utexas.edu/~witchel/380L/papers/manco17sosp-lightvm.pdf)

**Why niche [F/I]:** Mirage explicitly trades source-level conventional-OS compatibility for specialization; it remains an active project. LightVM establishes that shrinking the guest without fixing the toolstack leaves a creation bottleneck. [F: current Mirage](https://mirageos.org/). [I] Porting libraries, debugging, packaging, and operations complexity limited the appeal of replacing ordinary server deployment. The demand for full Linux did not disappear.

**What changed / build [I]:** generated glue is a more constrained customer than a traditional application developer. The brief's syscall-oracle/differential-test loop can produce versioned profiles offline, while MCP replaces guest networking and authentication libraries for many tasks. Build a finite catalog of inspected profiles and a manifest showing exactly which static binary/resource set passed which compatibility cases. Do not grow a production kernel in response to an untrusted request.

**Closest / necessity [I]:** Hyperlight-Unikraft and Wasm plugins already serve this territory. Sofort's design also differs from classic single-address-space unikernels by retaining its stated guest kernel/program interface. A smaller custom kernel must earn its compatibility and maintenance costs; low LOC is not a security proof. Full dev workspaces and network middleboxes are out of scope.

**Dependencies / effort / scores [I]:** [B] now, [H] for cached profiles; +2–4 ew for one additional useful static tool/profile and a reproducible conformance manifest. N2 / F4 / D4 / B3. Demo: one real generated task, its minimal kernel profile, successful Linux differential cases, and an unsupported operation failing clearly.

## 13. Computational caching and FaaS snapshots → cache a capability-safe computer

**Pitch / user [I]:** an agent platform instantiates a prepared interpreter and resource set for each snippet, then can checkpoint that snippet's own progress.

**Original idea and papers [F]:** Cadden et al., *SEUSS: Skip Redundant Paths to Make Serverless Fast*, **EuroSys, 2020**, layers shared execution snapshots. Du et al., *Catalyzer: Sub-Millisecond Startup for Serverless Computing with Initialization-Less Booting*, **ASPLOS, 2020**, offers lazy restore and sandbox fork; the authors report adoption by Ant Financial. Ustiugov et al., *Benchmarking, Analysis, and Optimization of Serverless Function Snapshots*, **ASPLOS, 2021**, introduces REAP's working-set recording/prefetch. Ao, Porter, and Voelker, *FaaSnap: FaaS Made Fast Using Snapshot-based VMs*, **EuroSys, 2022**, improves loading with concurrent paging and region-aware mapping. [SEUSS](https://cs-web.bu.edu/~jappavoo/Resources/Papers/seuss.pdf), [Catalyzer author page](https://ipads.sjtu.edu.cn/pub/projects/catalyzer), [REAP](https://ustiugov.github.io/assets/files/REAP_ASPLOS21.pdf), [FaaSnap](https://www.sysnet.ucsd.edu/~voelker/pubs/faasnap-eurosys22.pdf)

**Not failed research [F]:** Agache et al., *Firecracker: Lightweight Virtualization for Serverless Applications*, **NSDI, 2020**, describes deployed Lambda/Fargate infrastructure. Modern snapshot functionality is documented separately from that paper. SEUSS's evaluated contexts execute in ring 3 under a trusted OS, rather than one KVM isolation domain per cached function. These results cannot establish Sofort's per-hardware-VM density. [Firecracker paper](https://www.usenix.org/conference/nsdi20/presentation/agache), [SEUSS §5–6](https://cs-web.bu.edu/~jappavoo/Resources/Papers/seuss.pdf)

**What changed / build [I]:** cache an initialized, tenant-free kernel+interpreter+resource image, inject run-specific data and grants afterward, then create private continuations only when worth retaining. MCP supplies a uniform external interaction route for those continuations. Separate template caching from mid-execution checkpoints: the cited cold-start work already owns much of the former idea. Content addressing needs compatibility metadata and build provenance; a hash does not itself verify policy.

**Closest / necessity [I]:** use existing warm sandboxes if startup is the only objective. Sofort's proposed value is combining cheap startup with later durable/branchable execution at tool boundaries. Snapshotting after tenant data or PRNG initialization risks unintended sharing or duplicate identities; live branch IDs, quotas, and authority must be host-managed. Do not assume an SSD-prefetch optimization helps a tiny hot page-cache image.

**Dependencies / effort / scores [I]:** [S]+[H]+[E]; +2–4 ew for layering/cache policy after basic restore. N1 / F4 / D4 / B3. Demo: measured cold/warm/burst behavior, total memory ledger, and two tenants proving that private data and identity are not shared. This is enabling infrastructure, not the primary revival story.

## 14. Function shipping versus data shipping → send bounded code to tools

**Pitch / user [I]:** a data-heavy tool exposes a bounded compute endpoint so an agent receives a summary instead of thousands of intermediate records.

**Original idea and paper [F]:** Franklin, Jónsson, and Kossmann, *Performance Tradeoffs for Client-Server Query Processing*, **SIGMOD, 1996**, compares data shipping, query shipping, and flexible hybrid placement; no single pure placement wins across conditions. [Paper](https://db.in.tum.de/research/publications/conferences/sigmod96.pdf)

**Why niche / correction [I]:** function shipping did not fail—databases and remote functions are obvious successful forms. Arbitrary user code near data was harder because of safety, accounting, language compatibility, deployment, and optimizer uncertainty. Modern hardware isolation helps with containment but does not make arbitrary code more efficient than a database query.

**What changed / build [I]:** agents can generate small transformations to fit a specific question, while MCP offers a discoverable route to a provider-controlled executor. Expose an approved compute tool that accepts code or a prepared image identifier, grants only bounded scans/aggregations, and returns a result with provenance. Keep database access in the host adapter; no guest socket is needed. Move a continuation only when it has useful private state—usually shipping source plus inputs is cheaper.

**Closest / necessity [I]:** SQL, stored procedures, Wasm UDFs, and Cap'n Web's restricted pipelined mapping are closer and simpler for expressible queries. Sofort is justified when the transformation exceeds those models, the code is untrusted, and a supported native library is required. The data provider must install the executor; an MCP endpoint does not permit arbitrary compute by itself. Reading data inside a VM does not establish output confidentiality or prevent inference from returned aggregates.

**Dependencies / effort / scores [I]:** [B]+[E] for fresh function shipping; [S]+[C] only for continuation placement; +2–4 ew for a bounded local adapter. N2 / F4 / D4 / B4. Demo: the same real task with data shipped versus code shipped, measuring transferred bytes, end-to-end time, and provider CPU. Reject it when SQL already wins.

## 15. Plan 9 namespaces → each agent sees its own small world of tools

**Pitch / user [I]:** an agent's tool names retain stable meanings while a host chooses the resources, permissions, and test/live bindings behind those names.

**Original idea and papers [F]:** Pike et al., *The Use of Name Spaces in Plan 9*, **ACM SIGOPS European Workshop, 1992; reprinted in ACM SIGOPS Operating Systems Review 27(2), 1993**, makes a process's composed namespace a central abstraction. Pike et al., *Plan 9 from Bell Labs*, **Computing Systems, 1995**, presents resources accessed through a uniform file protocol and private namespaces. The design is richer than the slogan “everything is a file.” [Namespaces](https://9p.io/sys/doc/names.html), [Plan 9](https://9p.io/sys/doc/9.html)

**Why niche [I]:** the coherent system required a new OS, services, conventions, and application ecosystem. A uniform naming interface did not erase the semantic differences among resources. Modern namespaces and containers reuse related ideas; the historical concept is not missing from current systems.

**What changed / build [I]:** MCP makes a task-specific service environment plausible without replacing the user's desktop. Construct a manifest mapping stable guest-local tool names to narrowly authorized host objects. The same code can run with a recorded inbox, a test inbox, or an explicitly granted live inbox. Create a fresh VM with the chosen namespace today; branch namespaces with snapshots later. Expose only task-relevant schemas and resource names to reduce integration complexity.

**Closest / necessity [I]:** dependency injection, MCP proxies, Fuchsia routing, and WASI capabilities already solve most of this. Sofort adds hardware enforcement that guest code has no alternate host I/O route. Namespace virtualization alone is a broker feature, not a reason to adopt a custom microVM. Rebinding a snapshot must be explicit in provenance: a test-to-live namespace change changes execution meaning even when code hashes match. No new writable filesystem is required.

**Dependencies / effort / scores [I]:** [B]+[E]; [C] for object identity and attenuation, [H] for manifest identity; +1–2 ew for name routing. N2 / F4 / D4 / B3. Demo: identical code against replay, test, and live bindings, with unauthorized tool names unavailable. Treat this as an enabling layer for worlds and approvals.

## 16. Agoric/market computing → budgeted computation that can be parked or sold

**Pitch / user [I]:** an internal agent platform allocates a finite compute/tool budget to competing task continuations and suspends low-value work cheaply.

**Original idea and paper [F]:** Miller and Drexler, *Markets and Computation: Agoric Open Systems*, **The Ecology of Computation, edited research volume, 1988**, proposes local markets for computational resources and reusable software components. [Author/project archive](https://papers.agoric.com/papers/markets-and-computation-agoric-open-systems/abstract/)

**Why niche [I]:** useful internal prices, metering, trust, adversarial incentives, and transaction overhead are hard. Treating every function call as a market can cost more than scheduling it directly. Today's primitive addresses the unit of execution and resource containment; it does not solve mechanism design or prove the quality of a result.

**What changed / build [I]:** AI-generated work has a visible budget tradeoff and can propose alternatives. A small paused continuation could become a unit of admission or placement. Start with an internal scheduler: a task receives host-held CPU, memory, tool-call, and model-spend allowances; branches draw from the same account; low-priority continuations are parked rather than killed. Benchmark a fixed-priority policy before introducing auctions.

**Closest / necessity [I]:** cloud spot markets, job schedulers, cgroups, and token-budgeting platforms already supply most of the economics. Sofort adds value only if migration/parking of opaque native state materially improves utilization. An open marketplace of roaming capsules would also need payments, identity, dispute resolution, and safe data handling; none is made practical merely by a 1 MiB target. Do not build a token or public exchange to demonstrate the substrate.

**Dependencies / effort / scores [I]:** [B]+[E] for metering; [S]+[C] for parked market participants; +3–5 ew for an internal allocation experiment, much more for a market. N3 / F2 / D4 / B2. Demo: a fixed shared budget cannot be multiplied by making a thousand clones. The business claim requires utilization gains over a normal scheduler.

## 17. End-to-end auditability → independently replay an agent's claimed behavior

**Pitch / user [I]:** an agent-platform customer can verify how a bounded program transformed recorded inputs into proposed or authorized actions.

**Original idea and paper [F]:** Haeberlen, Kouznetsov, and Druschel, *PeerReview: Practical Accountability for Distributed Systems*, **SOSP, 2007**, uses tamper-evident interaction records and deterministic replay against a reference implementation to detect observable deviations. Its assumptions include signed messages and checking by a correct participant. [Authors' expanded paper](https://www.mpi-sws.org/tr/2007-003.pdf)

**Why niche [I]:** general applications are not conveniently deterministic; recording input histories may expose sensitive data; reproducing environments is expensive. Attribution also needs a trustworthy identity and evidence source. Logs cannot make an unobserved external action visible or force an external service to report truthfully.

**What changed / build [I]:** the tiny execution envelope and explicit I/O permit a bounded verification story. Package image/profile/resource identities, ordered request and response hashes with available payloads, snapshot ancestry, grant changes, approval records, and host-signed receipts. An independent verifier reruns the guest with the recorded inputs and checks its emitted requests and final digest. Record enough of the executor's decision path to explain why each live request was allowed; do not imply a guest replay verifies the host's entire execution.

**Closest / necessity [I]:** signed workflow histories, provenance systems, ordinary execution logs, and durable Wasm histories already provide substantial evidence. Sofort's contribution would be small reproducible native artifacts, not cryptographic proof by isolation. Hardware virtualization does not attest execution to a remote customer. A dishonest sole logger can fabricate inputs; a remote API's output can be false; replay proves consistency with supplied inputs, not truth, policy correctness, or task quality. Stronger assurance needs independent receipts, attestation, or additional trust mechanisms.

**Dependencies / effort / scores [I]:** [R]+[H]+[E], [S] for efficient anchors, [C] for authority provenance; +3–5 ew after replay. N3 / F3 / D4 / B4. Demo: alter one journal record or grant and detect the inconsistency; then demonstrate the boundary by supplying a consistent but false input. That second case should pass computational replay and remain labeled unverified externally.

## Shared architecture: what must exist before the attractive demos are honest

**[I] One coherent capsule format can support most proposals.** Include immutable image identity and compatibility envelope; sparse memory and full architectural/device state at a defined safe point; parent snapshot hash; journal prefix; virtual clock/random state; outstanding call IDs; and a requested capability manifest. Keep credentials, revocation epochs, mutable quota balances, execution leases, and the authoritative request ledger at the host. Snapshot data may still contain private tool results even when credentials never enter the guest.

**[I] Define the safe point as a protocol operation, not “whenever an await happens.”** A language `await` may coexist with outstanding tools, queued callbacks, partial JSON messages, or non-quiescent device queues. Initially permit exactly one broker-registered pending call, complete framing, and an explicit guest/VMM checkpoint acknowledgement. Preserve Promise-all concurrency in ordinary execution; either drain it or record the entire outstanding set before snapshotting. VMM, kernel, interpreter, and executor must agree which party owns the next reply.

**[I] Use three broker modes with enforceable boundaries:** replay serves recorded events and rejects divergence; exploration serves approved recorded/simulated inputs and denies live effects; live mode checks current grants and quotas on every call. Tool names or model assurances cannot select the mode. A result-dependent branch that changes an outgoing request has crossed into a new history and cannot keep consuming old results blindly.

**[F] MCP annotations are hints, not enforceable truth.** The schema warns that tool annotations may not faithfully describe behavior and should not determine decisions for untrusted servers. [MCP schema, 2025-06-18 specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/schema.mdx). **[I]** The broker needs trusted adapters with explicit semantics for reads, billable operations, simulations, writes, and idempotency. A purported read can trigger remote computation or exfiltrate arguments. An outbound tool request is already an observable effect.

**[I] Separate exactly reproducible guest execution from exactly-once external action.** Write a durable intent before issuing a request; use stable operation IDs and provider idempotency where available; persist results before delivering them; fence obsolete executors. A crash in the “service committed, broker has no result” interval cannot be repaired by replay alone. Unknown outcomes need reconciliation or explicit operator handling. Selecting one branch does not atomically commit its future actions across unrelated services.

**[I] Freeze a compatible execution envelope.** Same ISA, supported CPU feature set, VM state format, kernel/runtime/binary/resources, and deterministic input-delivery rules are the starting point. Pinning a source hash alone is insufficient for native replay. Keep a restore compatibility test suite and fail closed on unsupported images. Do not promise arbitrary macOS/Linux or cross-ISA continuation portability.

**[I] Keep the deterministic security boundary narrow.** Virtual time, randomness, supported instructions, interrupts, asynchronous deliveries, and error results must be controlled or logged. The interpreter's event loop and native undefined behavior need an explicit support contract. Current absence of shared-memory guest threads is an advantage to preserve until deterministic semantics are justified. Reproducibility does not remove side channels or prove host isolation.

## Experiments that could falsify the revival thesis

These are proposed acceptance experiments [I], not results:

1. **Whole-state density:** retain 1,000 distinct small continuations; report shared backing, private dirty pages, host allocations, hypervisor charges, archive size, and journal growth. Repeat after realistic JSON input. If private state routinely grows by tens of MiB, cheap branching is not the default product story.
2. **Restore correctness under failure:** kill execution before intent, after intent, during tool work, after remote success, after result logging, and after guest delivery. Show the precise duplicate/unknown-outcome behavior. A successful happy-path pause/resume is insufficient.
3. **Replay closure:** replay programs with random/time reads, errors, multiple pending promises, and varying completion orders. Compare requests, outputs, and defined state digests. Zero live tools should be required. Find and document every nondeterministic escape.
4. **Branch economics:** compare fresh re-execution, explicit JSON-state cloning, Golem forks, and Sofort clones on the same useful workload. Include model cost and prefix caching. Snapshot branching loses its case if serialization or cached responses buy the same result more simply.
5. **Authority across restore:** revoke a handle and spend a shared budget, then restore an old snapshot and fork it repeatedly. Neither permission nor money may reappear. Confirm that copying a capsule does not silently grant its holder live access.
6. **Product differentiation:** test against Hyperlight-Unikraft using identical tool semantics and lifecycle. If it can supply the same clean continuation API with less work, adopt it as substrate rather than defend a custom kernel for its own sake.

## Ranking by novelty and feasibility

**[I] Novelty leaders:** Worlds adapted to complete native/hardware continuations (§9, N4); predictable-tool speculation with enforced effect fencing (§8, N4); live capability rebinding across approved sites (§3, N4). None merits an unsupported “first” claim. Their novelty lies in combining semantics and deployment constraints, and §3 has the largest trust/adoption obstacle.

**[I] Feasibility leaders from today's state:** tool namespaces (§15, F4) and fresh function shipping (§14, F4) can start with [B]; they are useful but comparatively unoriginal. Among continuation revivals, incident capsules (§7, F4), persistent approvals (§2, F4), bounded fork search (§11, F4), and image packaging (§5, F4) have the best path once local snapshot/replay foundations exist. Worlds and speculation remain F3 because correct effect handling is part of the feature.

**[I] Full priority order:** 1 Worlds (§9); 2 incident capsules (§7); 3 persistent approvals (§2); 4 capability objects (§4); 5 bounded fork search (§11); 6 prepared/undoable computation (§10); 7 end-to-end replay evidence (§17); 8 predictable-tool speculation (§8); 9 function shipping (§14); 10 process migration (§1); 11 tool namespaces (§15); 12 frozen experiment images (§5); 13 generated-glue kernel profiles (§12); 14 computational caching (§13); 15 deterministic islands as a standalone product (§6); 16 mobile agents across organizations (§3); 17 market computing (§16). Lower-ranked infrastructure can still be a prerequisite for the leaders. This order favors a differentiated deliverable with a credible buyer, rather than historical elegance alone.

## Top 3 ranked

1. **Branchable worlds for agent tool programs (§9) — N4 / F3 / D5 / B4.** Best distinctive revival: preserve opaque execution state, explore a bounded number of alternative futures, and select a continuation while the broker prevents losing branches from acting. Build one simulated/read-only environment first. The decisive demonstration is useful branching with measured memory and zero leaked effects. Golem forks and explicit-state cloning are mandatory comparisons; do not claim generic agent branching is new.
2. **Executable incident capsules (§7) — N3 / F4 / D5 / B4.** Best first engineering milestone and clearest operational use: a reproducible failing run that requires no production access. Begin with tool-boundary time travel and strict request matching, then add deeper debugging. The decisive result is faithful offline reproduction of a real failure at an affordable retention cost. It also validates the replay machinery that worlds will need.
3. **Persistent approval continuations (§2) — N3 / F4 / D5 / B4.** Best path from demonstration to a useful automation feature: preserve supported native program state while awaiting a person, release resident compute, and resume under freshly checked authority. Integrate existing workflow infrastructure for timers/operations. The decisive result is crash-safe pause/resume plus honest handling of uncertain external effects. Temporal, Golem, and Hyperlight are strong alternatives; the hardware/native continuation requirement must be real.
