# T05 — systems, runtimes and infrastructure

**2026-10-29. Q = transcript quotation; F = externally sourced fact; I = inference/proposal; E = estimate.** Transcript timestamps are caption buckets, not second-accurate utterance times. Proposals, targets and demos below have not been implemented or measured.

**I — Result:** three substantial user-space projects remain worth a bounded attempt: **NativeTxn**, **SplitActor**, and **LiveImage**. Their outputs are running infrastructure with a growing implementation, rather than evidence collections. Existing isolation engines, actor systems and live-update machinery are foundations to reuse. The possible openings are narrower than those categories; the prior-art sections identify them explicitly.

**I — Scope:** no kernel growth, syscall implementation, driver translation, hardware-trace programme, agent-era Jepsen, compatibility atlas or new sandbox hosting company. An internal checker is part of each construction process, not the proposed product. The generic proposer/verifier loop is also not claimed as an invention.

## 1. NativeTxn — grow native capabilities with commit-or-discard effects

**I — One sentence:** a native-module runtime in which requesting an unsupported C/C++ operation causes an agent to construct and qualify a reusable capsule whose callbacks and returned data either commit together to the host or leave it unchanged.

### The seed

**Q — Jonathan Blow, Software Unscripted, `p3-37-software-unscripted-podcast-jonathan-blow-on-programming-language-desi.txt`, 1:27:00:** “you don't have to serialize and deserialize and reparse and look for parse errors”. He is describing the appeal of sharing structured data across a native plugin boundary. [Raw transcript, line 91](../transcripts/p3-37-software-unscripted-podcast-jonathan-blow-on-programming-language-desi.txt#L91).

**Q — Blow, same video, 1:28:00:** “an integer that you're supposed to decrement again before leaving the code and then it crashes and now you're just screwed.” The surrounding example concerns shared synchronization state left damaged by a crashing component. [Raw transcript, line 92](../transcripts/p3-37-software-unscripted-podcast-jonathan-blow-on-programming-language-desi.txt#L92).

**I — The opening in those sentences:** efficient isolation is insufficient when a host has already accepted part of a foreign component's work. The missing affordance is a native capability that can fail midway without poisoning the host's next operation.

**F — This failure class is concrete:** Mozilla's July 2026 [bug 2053583](https://bugzilla.mozilla.org/show_bug.cgi?id=2053583) describes host glyph records committed before later sandbox-output validation failed; fallback processing then reused the partially modified destination. The tracker marks it resolved/fixed. This is evidence of a boundary failure class, not a claim about a currently vulnerable release, and I did not reproduce it.

### What grows, and what the builder designs

**I — The growing artifact:** executable capsules for increasingly difficult native API families: opaque handles, borrowed buffers, callbacks, aliasing output structures, stateful sequences and disposal. Each contains the compiled bridge, ownership/effect contract, validators, restart procedure and exact supported library revision. An application asking for a missing operation triggers growth of this implementation; successful capsules remain callable without inference.

**I — The builder's structure:** a Rust host runtime and a small contract language for borrowed immutable regions, compartment-owned mutable state, staged host mutations and explicit commits. Use an existing process or software-fault-isolation backend. A callback can read approved host data and append a proposed mutation; it cannot mutate arbitrary host objects or acquire host locks. Freeze or copy foreign-owned output before validating it, then publish accepted changes at a host-controlled commit point. Read-only bulk buffers can use shared mappings; zero-copy is an optimization where ownership permits it, not a universal promise.

**I — Failure semantics:** on abort, timeout or invalid output, discard the pending host changes and abandon or reconstruct the affected native compartment. Continuing to use half-mutated opaque native state is forbidden unless a qualified recovery operation exists. Network, device and file effects require separate brokers; an already-sent email cannot be rolled back by this runtime. The initial domain is in-memory processing, with no irreversible external effects inside a call.

**I — Checks:** the fixed runtime enforces where writes and callbacks may go. Compare successful calls with ordinary native execution on public fixtures; inject failure at callback and validation boundaries; assert that failure leaves the committed host graph unchanged. Test alias identity, repeated use, malformed outputs and callbacks that reenter the interface. Models can propose annotations and bridges, but cannot loosen the host contract to make them pass. These checks establish scoped properties; they do not certify arbitrary native code.

### Tailwind and the one-shot test

**I — Tailwind:** better models can untangle more complex ownership conventions and construct richer recovery capsules. They enlarge the callable native world while the host's commit rules remain fixed. A model upgrade also revisits capsules previously rejected for excessive copying or unsupported callback patterns. Existing qualified capsules keep working.

**I — One-shot test:** “wrap this function” is prompt-sized and already occupied. The proposed value is the functioning transaction runtime plus an accumulated, composable implementation of difficult native boundaries. A generated binding alone does not establish which aliases survive, what callbacks already changed, or whether a failed opaque object can be reused. A later model could replace the implementation; it still needs to satisfy the same operational contracts across the grown capability set. This is an engineering-scale hypothesis, not a claim that models can never implement it.

**I — Value proposition:** use a fast native dependency and survive its failed calls without leaving your application half-modified.

### Six-week version

**E — Deliverable:** Linux/x86-64, Rust host, existing process isolation, one staged-effect mechanism, and two independently shaped public integrations: a Graphite-style shaping boundary and a libxml2 SAX callback boundary. The native libraries remain native. Begin with copying output; add a shared immutable input path only after the semantics work. A single ambitious builder can construct this slice without Mozilla participation or private fixtures; a broadly useful runtime is an estimated 9–18-month undertaking.

**E — Demo:** a service repeatedly shapes text and builds document structures. A newly requested native operation initially reports unsupported. The growth process produces a capsule, qualifies it and installs it. Force a failure after several callbacks have proposed host updates: the previous host graph remains intact, fallback succeeds, and the next call works. Then disable the model and repeat the operation. The surprising part is the failed component's unfinished work disappearing while its successfully grown capability stays available.

### Prior art and what remains

- **F — [RLBox](https://rlbox.dev/) and [Firefox's integration documentation](https://gecko-docs.mozilla.org.s3.amazonaws.com/rlbox/index.html)** already provide library isolation and explicit treatment of untrusted boundary values. A project merely generating more RLBox wrappers is insufficient.
- **F — [SBox](https://github.com/lfi-project/sbox)** already supports process/LFI backends, multithreading, callbacks, shared memory, pointer wrappers and input/output helpers. These mechanisms should be reused or compared directly.
- **F — [Microsoft's Verona sandbox](https://github.com/microsoft/verona-sandbox)** implements a shared-heap process boundary and safe-callback design; its repository was archived on June 15, 2026. [Encapsulated Functions](https://sns.cs.princeton.edu/assets/papers/2023-encapfn-schuermann.pdf) already combines protection with Rust abstractions around foreign libraries. Neither memory isolation nor low-copy FFI is an empty category.
- **F — [tarnish](https://github.com/corrode/tarnish)** already isolates crash-prone native work in processes with recovery. Keeping the parent alive is also occupied.

**I — Residual, medium novelty confidence:** a growing implementation of **host-effect transactions across stateful native calls**, including callback effects and recovery eligibility, above those existing isolation mechanisms. The reviewed descriptions do not establish that complete combination. Microsoft and Mozilla already own substantial adjacent work; this is not a claim to have discovered library sandboxing. Even memory-safe foreign code can return an error after partial callbacks, so this is distinct from extending Fil-C to more languages.

### The kill

**I — Strongest objection:** ordinary subprocess isolation plus staging is enough; the agent-generated part degenerates into a thin binding generator. Alternatively, useful APIs require so much copying, reconstruction or application-specific policy that the general runtime has little value.

**E — Cheapest test, three days:** implement one nested callback case on SBox/process isolation with no general framework. Make it fail after partially proposing a host-graph update, then call it again. Compare with a handwritten staged wrapper. Kill the larger project if the entire result is a small conventional wrapper, or if avoiding partial commits requires changing the library's algorithm. Continue only if the same explicit ownership/effect machinery handles the second API family with substantially less manual reasoning. A useful upstream patch is a valid outcome, but does not rescue the larger pitch.

## 2. SplitActor — grow a service's distributed shape while it runs

**I — One sentence:** a stateful actor runtime that responds to a hot object by growing, checking and installing an application-specific decomposition of its state and operations while preserving the actor's public identity and declared consistency contract.

### The seed

**Q — Ashley Peacock, Cloudflare Connect 2026, `09-why-modern-software-engineering-needs-durable-objects.txt`, 12:00:** “the hot singleton is the most common one you'll see.” [Raw transcript, line 16](../../connect26/transcripts/09-why-modern-software-engineering-needs-durable-objects.txt#L16).

**Q — Peacock, same video, 13:00:** “Break it down as small as you can while making sure you don't have too much coordination between your durable objects”. The next example separates durable message acceptance from fan-out. [Raw transcript, line 17](../../connect26/transcripts/09-why-modern-software-engineering-needs-durable-objects.txt#L17).

**I — The inversion:** today the operator chooses the partition and rewrites the application. Here the running service can acquire a new decomposition as a retained implementation capability. The demand signal is a measured bottleneck, not an LLM deciding that distributed architecture sounds attractive. Peacock's numerical platform limits are not used as universal capacity facts.

### What grows, and what the builder designs

**I — The growing artifact:** qualified decomposition modules: partition/recombine functions, rewritten operations, coordination requirements and live handover procedures. Growth proceeds from keyed state to separable fan-out, shared aggregates, reservations and operations touching several partitions. Modules become reusable implementations with explicit preconditions; the runtime does not ask the model to redesign every request.

**I — The builder's structure:** a Rust actor runtime with deterministic state transitions expressed in a restricted representation, a stable public actor address, durable inboxes, and an epoch-fenced ownership transfer. The model proposes a decomposition and a refinement map back to the original sequential state machine. Existing storage, transport and consensus implementations supply their ordinary services; the project does not grow a new kernel or reinvent consensus.

**I — Checks:** preserve return values and observable operation ordering under the declared contract, account for every acknowledged message during handover, and retain the original implementation as fallback. Mechanically check algebraic preconditions for supported rewrites; use bounded schedule exploration and differential execution against the frozen sequential reference for concrete transitions. Partitioned execution is accepted only when its consistency obligations are discharged. A globally ordered operation may remain behind a coordinator. Bounded exploration is not an unbounded liveness proof, and stronger models do not make an intrinsically serial operation parallel.

### Tailwind and the one-shot test

**I — Tailwind:** stronger models can discover decompositions requiring more semantic reasoning and produce the accompanying implementation and obligations. The grown rewrite vocabulary gets larger; existing checked transformations remain useful. Better models increase the range of applications that the runtime can reshape, rather than replacing a fixed optimization recommendation.

**I — One-shot test:** generating a sharded chat application is easy relative to constructing this runtime. The durable artifact is a library of executable, qualified transformations plus a handover mechanism that works with old state and in-flight operations. A prompt naming “sharding” supplies neither the application's consistency contract nor the correct transition from its current deployed state. If the implementation only chooses among a few handwritten sharding templates, it fails this test.

**I — Value proposition:** a service can outgrow its original single-object design without a manual distributed rewrite.

### Six-week version

**E — Deliverable:** three ordinary Linux processes; one deliberately restricted actor representation containing keyed maps and a message log; independently specified operation semantics; a growth interface; and one online decomposition that changes both storage ownership and execution. Use a public example service and synthetic load. A genuinely reusable system is an estimated 12–24-month solo project; arbitrary existing JavaScript actors are outside the initial scope.

**E — Demo:** a collaboration service begins as one actor containing document state and subscribers. After a document becomes hot, the system grows and installs a document-state/subscriber-fan-out decomposition. Existing clients retain their logical service address; the run shows the cutover, preserved message identities, and measured queueing reduction. A subsequent cross-document operation forces coordination or is refused. The demo must include traffic during the ownership transition, not merely restarting into a new topology.

### Prior art and what remains

- **F — [Orleans stateless workers](https://learn.microsoft.com/en-us/dotnet/orleans/grains/stateless-worker-grains)** already scale activations under load. Its documentation also explains the coordination problem when those activations retain state. Autoscaling actors is not new.
- **F — [Hydro](https://github.com/hydro-project/hydro)** is a distributed Rust framework with explicit correctness-oriented constructs. Its [research programme](https://hydro.run/research/) includes protocol partitioning/decoupling rewrites, automatic compartmentalization and verified CRDT synthesis. The broad claim “compile sequential logic into scalable distributed logic” is taken.
- **F — [Autonomous Topology Mutation](https://arxiv.org/abs/2607.20488), submitted June 2026**, already detects overload, splits an LLM agent into specialized children, transfers memory under routing rules and validates a shadow topology. “Agents can grow their team topology” is taken too. Its reported setting is multi-agent task execution, rather than refinement of an ordinary deterministic stateful service.

**I — Residual, medium-low novelty confidence:** **online application-actor decomposition with a retained external identity and a checked state/in-flight-message transition**, growing new implementations rather than only applying a fixed optimizer's existing rules. Hydro is the closest intellectual owner. The candidate survives only in that operational transition and application-runtime scope; a Hydro adapter alone is too small. The reviewed sources do not demonstrate this exact combination, but the research overlap is substantial.

### The kill

**I — Strongest objection:** the semantically useful decompositions are either already available as algebraic rewrites, or depend on a human choosing new application semantics. Preserving strict ordering may leave the original bottleneck untouched.

**E — Cheapest test, four days:** use the existing actor/stream machinery to implement a keyed workload with one operation spanning two keys. Require a decomposition, live cutover and a refinement map while preserving the original return semantics. Kill if improvement comes only from ordinary stateless fan-out, if weakening the contract is required, or if the declared invariants cannot distinguish a subtly wrong move. This produces the service itself; a generic fault-testing product is explicitly outside the proposal.

## 3. LiveImage — grow a running program through checked state and continuation changes

**I — One sentence:** a user-space live-program runtime where agents add capabilities by extending code, migrating the current object graph and mapping suspended work into the new version, with the change committed only after its compatibility obligations pass.

### The seed

**Q — Geoffrey Huntley, State of Agentic Coding #11, `80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt`, 0:46:00:** “once that that function's defined, it's defined.” He is demonstrating a running Lisp environment extended through model calls. [Raw transcript, line 50](../transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt#L50).

**Q — Huntley, same video, 0:49:00:** “you can evolve the program that's running live”. [Raw transcript, line 53](../transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt#L53).

**Q — Armin Ronacher, same video, 0:52:00:** “not everything is serializable.” His surrounding explanation identifies effects and runtime state as the difficulty behind restart and image preservation. [Raw transcript, line 56](../transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt#L56).

**I — Important qualification:** Huntley already built the live-edit demonstration. Recreating chat-connected Lisp, a hot-reload panel or a self-extending harness would be a duplicate. The candidate is the difficult continuation of that demonstration: changing the shape of real state and unfinished work without discarding either.

### What grows, and what the builder designs

**I — The growing artifact:** the running application and a retained sequence of capability additions: new methods, object layouts, migration maps, suspended-frame mappings and compatibility obligations. The long-term runtime can acquire reusable migration capabilities for maps, shared references, timers, subscriptions and state machines. The language substrate itself need not be new.

**I — The builder's structure:** a Rust executor for restricted Wasm modules, explicit versioned object identities, and suspended continuations represented as typed records at declared safe points. Transport connections and timers are host-owned handles, not arbitrary serializable objects. An update is a transaction over code, graph state and suspended records. Begin on one host; do not promise updates to arbitrary native stack frames.

**I — Checks:** validate graph identity and alias relationships; check that each supported old continuation has an authorized target; compare unchanged operations through a declared abstraction map; and test migration interruption before publishing the new version. Shadow runs cannot emit external effects. After commit, effect handles remain fenced so old and new code cannot both act as owner. Rollback requires an explicit reverse mapping or returning to the saved pre-commit state; reversing memory does not reverse effects already issued after the update.

**I — The semantic boundary:** adding a field or changing representation can preserve an old contract. Changing an auction's rules cannot be inferred as “equivalent” by the runtime. The builder must authorize that contract change and say which unfinished operations retain old semantics. Refuse an unsupported migration rather than silently restart the work.

### Tailwind and the one-shot test

**I — Tailwind:** better models can construct more difficult graph and continuation transformations, increasing how far a living program can evolve in one step. Its existing capabilities, migration paths and explicit semantic commitments remain in place. The product's job becomes more useful as agents propose larger changes to long-lived software.

**I — One-shot test:** a model can generate the next application version or an example migration. That is not the complete value: the runtime must transfer the actual extant graph, pending work and live handles under a checked relationship, across an accumulating set of supported transformations. “Add a chat box to hot reload” fails; “preserve this suspended operation across this representation change under this contract” is the substantive obligation. A model that writes the migration still benefits from the runtime that can qualify and apply it.

**I — Value proposition:** add features to a running stateful service without throwing away its unfinished work.

### Six-week version

**E — Deliverable:** one host, a restricted typed object graph, explicit suspension points, code-generation epochs and transactional upgrade of one live application. Grow support for a representation-changing update and a suspended-record update. A useful general runtime is an estimated 12–18-month solo effort; it does not require production users or access to another company's infrastructure.

**E — Demo:** a live multiplayer lobby has shared player objects, timers and an auction suspended awaiting bids. Request team auctions. The agent builds the feature and migrates the graph and pending auction while clients remain connected. A proposed migration that duplicates a player's balance or aliases the wrong team object is rejected. The accepted version resumes the old auction under its explicitly retained rules and runs new team auctions afterward. Show object identity and pending-work continuity, not just an unchanged browser connection.

### Prior art and what remains

- **F — [Golem's current update modes](https://learn.golem.cloud/v1.6/how-to-guides/common/golem-update-running-agents)** already cover history-replay updates and explicit snapshot-based migration for incompatible state. The docs describe manual migration at an idle invocation boundary and link language-specific snapshot skills. A model writing snapshot functions is not an empty opening.
- **F — [Cordis / DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/index.md)** already supplies plugin lifecycle handling, managed effect disposal, composition and hot reload. A self-extending plugin runtime is occupied by an active major-model-vendor project.
- **F — [PASTA](https://github.com/zelinzhao/pasta), ICSE 2021**, synthesizes object-state transformers for Java updates. Automated migration predates modern coding agents.
- **F — [Active DSU](https://doi.org/10.1145/3689492.3690046), Onward! 2024**, changes data and control flow of active functions using call-stack updating. Updating unfinished execution is also established research.

**I — Residual, low-to-medium novelty confidence:** a growth-oriented application runtime that makes **graph migration and explicit suspended-continuation migration one checked installation operation**, retaining the resulting implementations. Ordinary hot reload, snapshots and agent-written migration scripts are dropped. Golem is the strongest incumbent threat; if it already carries the same continuation obligations through its update mechanism, the scope collapses. This is the weakest of the three novelty cases.

### The kill

**I — Strongest objection:** this combines familiar dynamic updating techniques into a restrictive new programming environment, and the restrictions cost more than migration saves. Golem plus an ordinary coding agent may already deliver the practical value.

**E — Cheapest test, three days:** attempt the same shared-reference and paused-operation update in Golem, then in a tiny explicit-continuation prototype. Kill if the existing stack preserves the required semantics with an ordinary snapshot function, or if the prototype succeeds only because all meaningful state was flattened into an application-specific script. Demand an actual unsupported continuation change before building a new executor.

## Search audit and discarded directions

**F — Search date:** 2026-10-29. Used live web searches, the connected GitHub repository search, official repositories, product documentation and research papers. HN served as discovery, followed through to primary sources. X searches returned no usable indexed results; that is a coverage limitation, not evidence that nobody is building these projects. Negative GitHub searches are similarly weak because repository descriptions are incomplete.

**I — Corpus procedure:** screened the systems/runtime/network entries in `synthesis/S05-seeds.md`, followed the relevant extraction and Connect ledgers, and checked the quoted sentences in the raw files cited above. Also inspected the Next Token Ep07 neighborhood at 00:43–01:02: async execution, retained scripts, statefulness and callable remote resources. Those adjacent mechanisms already have owners; the excluded unikernel prediction was used to understand the growth shape, not as a candidate. Read the prior kill list, corpus summary and A09 critique to avoid restoring rejected products.

| Area | Examples of queries actually run | Outcome used here |
|---|---|---|
| Native boundaries | GitHub: `transactional sandbox library`, `crash atomic FFI`; web: `library compartmentalization rollback crash recovery sandbox native`, `"sandbox" "rollback" "RLBox"`; HN/X: `"sandbox" "RLBox"`; arXiv: `"library sandboxing" "rollback"` | Found SBox, Verona, Encapsulated Functions, tarnish and the fixed Mozilla partial-commit report. Retained only the host-effect transaction scope. |
| Distributed shape | GitHub: `actor sharding synthesis`, `actor runtime online repartition migration synthesis`; web: `LLM automatically split stateful actor bottleneck`; HN/X: `"actor" "sharding" "AI"`; arXiv: `"actor" "partition" "synthesis"` and broader distributed-synthesis searches | Found Hydro's substantive overlap and ATM's direct team-topology overlap. Retained only ordinary service-state refinement plus online cutover. |
| Live evolution | GitHub: `dynamic software updating LLM`, `state migration hot reload`; HN: `"LLM" "hot reload"`; X: `"LLM" "live programming"`; arXiv: `"dynamic software updating" language model`; web: `"PASTA" "Synthesizing Object State Transformers"` | Found Golem, Cordis, PASTA and Active DSU. Dropped chat-connected hot reload and routine generated migrations. |

**F/I — Additional cuts from real searches:** [APG / RFC2Code, AAAI 2026](https://ojs.aaai.org/index.php/AAAI/article/download/37048/41010), already generates protocol implementations from RFCs; [AUTOSPEC](https://arxiv.org/abs/2511.17977) already derives executable protocol specifications. [DevGen, FSE 2026](https://conf.researchr.org/details/fse-2026/fse-2026-ideas-visions-and-reflections/13/DevGen-Automated-Generation-of-Virtual-Device-Models-for-Kernel-Drivers-via-Large-La) generates QEMU device models with iterative execution feedback; [PFSM](https://doi.org/10.1109/MILCOM64451.2025.11309963) generates peripheral state machines. These eliminate the tempting broad protocol-growth and virtual-device-growth pitches. They are not additional proposals.

**F/I — Network cut:** Ousterhout's [Homa talk](../transcripts/67-ai-engineer-homa-the-end-of-tcp-for-ai-clusters-john-ousterhout-stanfo.txt) supplied a strong latency prediction, but Homa is already his active implementation project. [NECC](https://github.com/zmrui/NECC) already generates and evaluates customized congestion controllers with LLMs. Neither another Homa nor a generic model-driven congestion optimizer is promoted here.

## Ranking and ONE pick

**I — Ranking is judgment, not measured demand or a claim of uncontested novelty.**

1. **NativeTxn.** The narrowest independent value claim, a concrete failure class, public integration material, and a growth unit that remains executable after inference stops. The serious risk is collapsing into ordinary staged wrappers.
2. **SplitActor.** The most ambitious destination: grow the service's architecture around its actual load. Hydro overlap and the possibility of irreducible coordination make its early falsification especially important.
3. **LiveImage.** The clearest live-growth practitioner demonstration, but also the most crowded adjacent territory. Its residual depends on a continuation-migration case that Golem and existing DSU cannot already handle economically.

**I — ONE pick: NativeTxn.** Start with the partial-callback-commit problem and attempt the two-family kill test before building a general bridge generator. Its finished value would be a computer that acquires useful native operations while keeping failed operations from damaging its host. Better models expand that computer's capabilities; they do not remove the need for its execution contract.

**I — Three-line TL;DR**  
Grow native operations inside commit-or-discard effect capsules; keep each qualified implementation.  
Next investigate actors that grow a new distributed shape, then live programs that migrate unfinished execution.  
The worthwhile artifact is working infrastructure that accumulates capability; broad protocol generation, hosting and ordinary hot reload already have owners.
