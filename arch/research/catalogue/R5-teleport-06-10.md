[← Catalogue index](README.md) · [Research summary](../RESEARCH-SUMMARY.md)

**60 entries.** Reports in this round:

- [06-lifespan: Extending serverless lifespan: durable continuations, not immortal processes](#06-lifespan-extending-serverless-lifespan-durable-continuations-not-immortal-processes)
- [07-fleets: Agent fleets: cheap sleeping is solved; cheap continuation branching may still matter](#07-fleets-agent-fleets-cheap-sleeping-is-solved-cheap-continuation-branching-may-still-matter)
- [08-compilers: Warm compiler heaps, forked test worlds, and agent build loops](#08-compilers-warm-compiler-heaps-forked-test-worlds-and-agent-build-loops)
- [09-model: When does a live heap pay for itself?](#09-model-when-does-a-live-heap-pay-for-itself)
- [10-wild: Wildcards: live programs as specimens, save games, and experimental worlds](#10-wild-wildcards-live-programs-as-specimens-save-games-and-experimental-worlds)

---

## Round 5 — where live state beats replay — `teleport/` (reports 06–10)
Round 2 of the teleport research demanded value: find concrete situations where a movable or forkable live program clearly beats plain JSON state, journal replay (Temporal/Restate/Golem/Workflows), DO hibernation, V8 startup snapshots, containers or just re-running. The test was that live state wins when rebuilding state is expensive or impossible and the state is small to ship. All five lenses (serverless lifespan, agent fleets, compiler/test heaps, a break-even cost model, wildcards) reached the same answer. Cheap sleeping and long lifetimes are already solved. Correct replay already reuses LLM results, so "avoided inference spend" is $0. The only defensible region is small, opaque, generated JS state with a costly local prefix that is reused or forked often. The surviving bets are narrow embeddable features inside an existing generated-code sandbox: a durable continuation adapter, fork-and-resume for paired evaluation, isolated seeded test worlds, and runnable failure specimens. None has yet beaten its strongest baseline on a customer trace. All verdicts are **go-with-changes** for these narrow features and **no-go** for immortal Workers, cheap idle fleets, QuickJS-hosted compilers, or a universal economy of roaming live programs.

### 06-lifespan: Extending serverless lifespan: durable continuations, not immortal processes
Lens: whether a live heap extends serverless lifetimes beyond current limits (Workers, DOs, Lambda, Vercel, Deno, Netlify), costed against Workflows, Agents fibers, Queues, Containers, Vercel Workflow, Temporal, Inngest, Trigger.dev, Step Functions and Lambda durable functions. Headline: paid HTTP Workers already have no fixed wall timeout, incumbents already keep logical jobs alive, and in a worked two-hour example Workflows costs ~$0.00255 vs ~$0.00529 for heap checkpoints. Heaps win only on awkward live control state or expensive local reconstruction. ONE bet: a durable continuation adapter for generated tool code inside an existing QuickJS agent runtime (DO/SQLite home broker, R2 bounded checkpoints). Verdict: **go-with-changes** for that integration; **no-go** for a general "immortal Workers" platform.

#### A. Generated or deeply nested agent control flow
- **What:** Preserve a generated function's closures, cycles, mutually recursive helpers, `Map` of pending work and local error handlers across invocation replacement, with no recovery steps in the guest.
- **How it would work:** The guest source stays identical between ordinary and checkpoint execution; the broker records effects and the heap resumes at the original await.
- **Evidence / numbers:** E: for a 300–1,000-line guest, 120 model turns and a 2–8 MiB compressed heap, the win is 2–5 engineering days per integration at $800/day = $1,600–$4,000, not CPU dollars. F: the Cloudflare fiber API asks developers to rebuild recovery from JSON `stash()` and says it loses the original closure; Agents docs report restarts "1–2x per day" (SDK author statement, not an SLA). E: Workflows integration is 0.5–2 days for a simple loop vs 3–10 days for closure-heavy/generated code. [Agents durable execution](https://github.com/cloudflare/agents/blob/main/docs/agents/durable-execution.md); [Workflows rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/); [Vercel snapshot RFC](https://github.com/vercel/workflow/discussions/1298).
- **Prior art / who has it:** Cloudflare Workflows/Agents fibers, Vercel Workflow QuickJS snapshots, Inngest, Temporal.
- **Verdict:** KEPT (#1; the ONE bet) — best mix of current pain, avoided rewrite cost and already-paid interpreter overhead. The advantage shrinks once a reusable workflow adapter handles the variants.
- **Kill test / first proof:** Ten-day proof (below); compare against a native Workflows adapter plus Vercel QuickJS snapshots, not just handcrafted JSON.

#### B. Costly LLM history
- **What:** Use the heap to avoid re-paying for long LLM histories after interruption.
- **How it would work:** The heap keeps locally assembled prompts, parsed responses and closure state, but not provider KV cache, response streams, prefix-cache eligibility or TCP connections.
- **Evidence / numbers:** E: at $0.05/turn, 120 turns = $6. Losing the in-flight request wastes ≤$0.05 in either design, and restarting all 120 is a deliberately weak baseline. F: durable replay returns stored results for completed steps. [Lambda durable functions](https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html); [Cloudflare chat recovery](https://developers.cloudflare.com/agents/communication-channels/chat/chat-agents/); Agents #1257 (durable AI Gateway response buffer proposal).
- **Prior art / who has it:** Workflows, Temporal, Lambda durable functions, Vercel Workflow.
- **Verdict:** KILLED as standalone differentiation — proper replay also avoids reissuing LLM calls. Helps only if rebuilding local state from history is expensive.
- **Kill test / first proof:** Test a durable provider-call broker/response buffer separately.

#### C. Expensive in-memory indexes/caches
- **What:** Snapshot a pointer-rich mutable local index instead of rebuilding it on each cold continuation.
- **How it would work:** Restore a checkpoint rather than an interpreted full rebuild; immutable indexes should be separate cached artifacts.
- **Evidence / numbers:** E: a 20 MiB index takes 3 s native and 24 s interpreted (8×) to rebuild, vs a 5 MiB checkpoint in ~0.42 s at 100 Mbit/s plus 0.1–0.5 s restore, saving ~23 s per cold continuation. E: at 1M cold resumptions/month, avoiding 3 s native CPU = $60/month and 24 s interpreted = $480/month, but 5.24 TB of R2 reads.
- **Prior art / who has it:** Native V8 worker loading a serialized index image; DO SQLite; external search infrastructure.
- **Verdict:** RUNNER-UP (#2) — only after native serialized indexes and DO SQLite lose a real benchmark; latency is more plausible value than compute margin.
- **Kill test / first proof:** Kill if native serialized-index loading matches heap restore.

#### D. Deploy-surviving in-flight work
- **What:** Let in-flight jobs survive deploys and unexpected termination.
- **How it would work:** Periodic durable checkpoints during normal progress. Shutdown-time snapshots cannot work because there is no reliable shutdown hook. Run the old pinned guest/module build under a compatible host, since an old heap cannot load into newly compiled guest code.
- **Evidence / numbers:** E: 10,000 two-hour jobs at 8% interruption = 800 recoveries; cutting 2 s reconstruction to 0.1 s saves 1,520 CPU-s ≈ $0.03. Removing five $100 support cases = $500 (unvalidated). F: Workers drain old processes ≤20 min; DO runtime updates give in-flight requests 30 s; DOs have no shutdown hook. [DO lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/); [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
- **Prior art / who has it:** Workflows, Temporal (version-pinned replay).
- **Verdict:** NARROWED (real need, shared solution) — sell preserved state or less implementation burden, not a recovery-cost advantage.
- **Kill test / first proof:** n/a.

#### E. Live migration off a draining machine
- **What:** Cooperative capture at the next host await, an acknowledged destination and a fenced source move a logical job before planned shutdown.
- **How it would work:** Attractive for a runtime operator controlling both executors, versions and effect ownership. Ordinary Worker code gets no drain notifications, and abrupt crashes restore the previous checkpoint.
- **Evidence / numbers:** E: a 5 MiB image takes ~0.42 s one-way at 100 Mbit/s vs 24 s interpreted index rebuild. F: Trigger.dev checkpoints Node via CRIU at supported waits; Small-1x for two hours ≈ $0.2434. [Trigger.dev architecture](https://trigger.dev/docs/how-it-works); [Trigger.dev pricing](https://trigger.dev/pricing).
- **Prior art / who has it:** Trigger.dev/CRIU, VM/container checkpoint, native serialized state, version-pinned replay.
- **Verdict:** RUNNER-UP (#3) — the portable Wasm variant wins only across incompatible hosts or with a materially cheaper restricted guest; compare to CRIU first.
- **Kill test / first proof:** n/a.

#### Hard boundaries
- **What:** Constraints that apply to every live-heap lifespan design.
- **How it would work:** n/a.
- **Evidence / numbers:** M (prior): 5–11× slower glue, 1.5–6.4 MB snapshots, 22–23 KB sparse deltas (not production-proven). I: a 50 MB guest plus capture copy and staging can exhaust the 128 MB isolate, and Wasm high-water memory need not shrink. Await-only checkpoints can't capture a synchronous loop before CPU termination. E: a 5 MiB snapshot every minute for 2 h writes 0.629 GB; retaining all for a month costs $0.0094/job ($9,437/M jobs). Bulk heaps in DO SQLite cost more than R2. Write blobs first, publish the head atomically, then GC. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- **Prior art / who has it:** n/a.
- **Verdict:** "Immortal" must mean a recoverable logical job, never guaranteed infinite execution; memory leaks, bad loops and expired sessions survive a faithful restore.
- **Kill test / first proof:** Kill if the 128 MB memory budget fails.

#### Worked example: a two-hour agent on Workers
- **What:** Cost both designs on the same contract: 120 sequential turns, 240 effect boundaries, 7,200 s wall, 30-day retention.
- **How it would work:** Workflows uses two step families with stable IDs. The heap design uses R2 snapshots per boundary, a Queues pointer, and a SQLite DO broker/outbox keeping one recoverable head.
- **Evidence / numbers:** E: Workflows uses 12 s CPU ($0.00024) + 240 steps ($0.00192) + state ($0.000393) ≈ $0.00255/run. The heap design uses 120 s CPU ($0.0024) + R2 ($0.00117) + Queues ($0.000288) + DO ($0.000841) + retention ≈ $0.00529/run, both vs $6 model spend. 240 × 2 MiB = 503.3 MB written and 503.3 MB read (~1.01 GB traffic/job); retaining all images pushes the heap subtotal above $0.0128. At 100k runs/month: $255 vs $529 against $600,000 model spend. Workflows would need ~137 extra CPU-s/run of reconstruction to match. Effort: Workflows loop 4–16 h; guest adapter to a qualified runtime 2–8 h (building the runtime is a 1–2 week proof). [Workflows pricing](https://developers.cloudflare.com/workflows/reference/pricing/); [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
- **Prior art / who has it:** Cloudflare Workflows.
- **Verdict:** For a simple loop, Workflows is the recommendation; neither design resurrects a provider request killed mid-flight.
- **Kill test / first proof:** n/a.

#### Plain V8 / workerd snapshots instead of QuickJS
- **What:** Use native V8 heap snapshots (no interpreter tax) to preserve a pending await.
- **How it would work:** Options are a custom native V8/workerd embedder at quiescent awaits, source/CPS transformation, journal replay on V8, process/container/VM checkpoint, or heap-profiler JSON/structured clone (diagnostic only).
- **Evidence / numbers:** M (prior): a Node 24.22.1 `--build-snapshot` blob with an unresolved Promise resumed to print `resumed 42` in a fresh process. F: workerd source has `jsg/snapshot.h` `SnapshotArtifact`/`MutableSnapshot`, and `createSnapshotBlob()` destroys live Wrappables and snapshots before serving requests (startup zygote, not live-request checkpoint). [V8 SnapshotCreator](https://v8.github.io/api/head/classv8_1_1SnapshotCreator.html); [workerd snapshot.h](https://github.com/cloudflare/workerd/blob/main/src/workerd/jsg/snapshot.h); [Node V8 API](https://nodejs.org/api/v8.html).
- **Prior art / who has it:** V8 SnapshotCreator, Node startupSnapshot, workerd zygote snapshots, Trigger.dev CRIU, Vercel (snapshot over journal).
- **Verdict:** RUNNER-UP — a credible server-only alternative and serious long-term threat to the performance argument. Use QuickJS/Wasm for the short proof; don't build V8 just to test the thesis.
- **Kill test / first proof:** n/a.

#### Buyer, price and rough business size
- **What:** Three overlapping buyer segments.
- **How it would work:** Open-source runtime with paid integration/support, or a feature in an existing platform.
- **Evidence / numbers:** E: generated-code agent runtimes on QuickJS at $500–$2,000/month, 20–100 customers = $120k–$2.4M ARR. Dynamic-index platforms at $250–$1,000/month, 20–50 = $60k–$600k ARR. Draining-executor operators at $1,000–$5,000/month, 5–20 = $60k–$1.2M ARR. All hypothetical, with no verified demand; do not add as TAM.
- **Prior art / who has it:** n/a.
- **Verdict:** A general immortality service competing on fractions of a cent is implausible.
- **Kill test / first proof:** n/a.

#### Ten-day brokered checkpoint proof
- **What:** A local workerd/Miniflare proof with no deploy.
- **How it would work:** Days 1–2 pin interpreter/ABI and pick one closure-heavy fixture plus one JSON loop vs idiomatic Workflows, Agents `stash` and Vercel QuickJS. Days 3–5 build SQLite broker/head/epoch, blob store and outbox with no guest recovery steps. Days 6–7 force ten invocation replacements during a two-hour run and inject failures at every boundary. Days 8–9 benchmark 2/8/32 MiB, high-entropy, GC churn, long sync work and a dynamic index. Day 10 compares replay, JSON, native index and CRIU estimates.
- **Evidence / numbers:** E acceptance: no duplicate sink effects; correct after ten replacements; no repeated LLM request; peak <96 MB; p95 <1 s for a 2 MiB checkpoint; and either ≥50% less integration/recovery code or ≥5× faster cold reconstruction than the best native baseline.
- **Prior art / who has it:** n/a.
- **Verdict:** KEPT (step 2 of next steps).
- **Kill test / first proof:** Kill if a generic step adapter runs all fixtures with comparable code, native index loading matches restore, 128 MB fails, or most remaining work is application-specific recovery. An equivalent Vercel adapter means integrate/contribute instead.

#### Demo and tweet
- **What:** A 60-second demo: a generated function with a cyclic work graph, captured counter and nested error handler, after 73 recorded operations, survives killing the entire local workerd process and continues at the await in a fresh host.
- **How it would work:** Show unchanged guest source, a new process ID, the same state digest, one receipt per operation, full checkpoint bytes and persist/restore latency, then the ordinary loop baseline completing via recorded steps.
- **Evidence / numbers:** I: the killing reply is "HTTP Workers already run indefinitely while connected; Workflows keeps LLM results; Vercel snapshots QuickJS; Trigger.dev checkpoints Node."
- **Prior art / who has it:** n/a.
- **Verdict:** KEPT conditionally — only a measured customer fixture removing substantial recovery work or latency answers it; otherwise drop the immortality framing.
- **Kill test / first proof:** n/a.

#### Rejected in this report
- **"Ordinary Workers need us to run for two hours"** — paid HTTP Workers have no fixed wall limit while connected; CPU limits are configurable (cloudflare-os #603 fixed by setting 120–300 s); subrequests now default to 10,000.
- **General "immortal Workers" platform** — no-go; incumbents keep logical jobs alive, and the economics are fractions of a cent.
- **Snapshot on shutdown notification** — no reliable shutdown hook on Workers/DOs.
- **"Other systems cannot run loops / replay calls the LLM again / Trigger.dev requires rewriting every step"** — false competitive claims.
- **DO hibernation as a saved heap** — hibernation discards memory and reruns the constructor.

### 07-fleets: Agent fleets: cheap sleeping is solved; cheap continuation branching may still matter
Lens: fleet operators running very large numbers of agents (Cloudflare DOs/Agents, Modal, E2B, Daytona, Fly Sprites, Golem, LangGraph, Codex, Devin, Sierra, Decagon), with an explicit 1M-agent/99%-idle cost model. Headline: idle compute is already ~free on several platforms. In the model, a live-image executor costs ~$530/month vs ~$216 for JSON, and VM-shaped alternatives cost far more because they reserve 1 GiB/vCPU per active agent, not because they lack heap capture. Branching is valuable, but the evidence for a heap-fork advantage is narrow. ONE bet: a fork-and-resume adapter for generated JS tool programs, proved by a paired graph/journal-vs-heap experiment. Verdict: **go-with-changes**; **no-go** for a standalone "cheaper idle agents" thesis.

#### B. Branch exact paused working state for search and paired evaluation
- **What:** Capture once before a hard decision and run 8–32 alternate future tool/model inputs from the exact accumulated JS working state; collect evidence through a coordinator and promote one continuation.
- **How it would work:** Branches get inherited receipts, new branch identity and entropy domain, split budgets, read-only/isolated sinks, cancellation, and a single authorised commit path. Paired comparisons keep identical past inputs while changing only future dispatch. There is no heap merge.
- **Evidence / numbers:** F: LATS (ICML 2024) reaches 92.7% HumanEval pass@1 with GPT-4; tree search improved VisualWebArena 39.7% relative (to 26.4%); Anthropic's multi-agent Research scored +90.2% over single Opus 4 at ~15× chat tokens. E: an eight-way fork saving 2 s prefix rebuilds saves 13.93 CPU-s ≈ $0.00028/task ($279/M), too little for a generic surcharge. E: price $3,000–$10,000/month; ten buyers = $0.36–$1.2M ARR. [LATS](https://proceedings.mlr.press/v235/zhou24r.html); [Tree search for LM agents](https://arxiv.org/abs/2407.01476); [Anthropic Research](https://www.anthropic.com/research/multi-agent-research-system).
- **Prior art / who has it:** LangGraph time-travel forks, Golem/journal forks, E2B snapshot clones, Modal sandbox memory snapshots, Daytona VM forks, managed Devins.
- **Verdict:** KEPT (#1; basis of the ONE bet) — best wedge when the branch point lies inside generated code and prefix reconstruction is material.
- **Kill test / first proof:** A read-only search fixture with fixed local API datasets and 200 cases, branched 8 ways at an await with a shared budget, vs LangGraph-style branching, journal forks and JSON+source. Pass only with ≥20% more correct completed investigations at the same deadline and external-call budget (or verified lower integration work). Kill if all useful branch points are already graph checkpoints or extra tokens explain the gain.

#### A. Preserve generated working state through waits and host drains
- **What:** Park an opaque generated JS program after substantial initialisation, release its executor, and resume on a replacement host with its locals intact; pack and drain units without bespoke serializers.
- **How it would work:** Completed tool calls are journaled; the live image removes only the remaining local rebuild.
- **Evidence / numbers:** E: draining 10,000 1 MB guests moves 10 GB (~10 s at 1 GB/s). A 2 s/agent replay baseline is 20,000 CPU-s (200 s on 100 cores), but a 5 ms explicit checkpoint is only 50 CPU-s, so live images lose. E: $2,000–$5,000/month integration; 20 buyers = $0.48–$1.2M ARR. F: Cloudflare documents closures and promises disappearing on eviction. [Code Mode durable runtime](https://developers.cloudflare.com/agents/tools/codemode/durable-runtime/); [Agents fibers](https://developers.cloudflare.com/agents/agent-class/durable-execution/).
- **Prior art / who has it:** Durable Code Mode + DO, Golem snapshots/replay, VM checkpoints.
- **Verdict:** KEPT (#2) — earns a place only when replay or explicit checkpoints are costly; idle-dollar savings fail.
- **Kill test / first proof:** Two Node executors plus local workerd, 10,000 logical identities, generated closures/cycles, 40 recorded tool outcomes, approval waits and forced kills, vs Code Mode-style replay and JSON, varying prefix CPU 5 ms/500 ms/5 s. Pass only at ≥5× lower p95 recovery vs replay on a real contributed workload; kill if JSON is within 10%.

#### C. Relocate an established agent beside changing users or data
- **What:** Move a small prepared execution state after the best location changes, keeping identity and authority at a home broker.
- **How it would work:** Executors change while the broker stays put; real locality needs useful computation beside the data, not tool calls tunnelled home.
- **Evidence / numbers:** F: existing DOs do not relocate, and location hints apply only to the first request. E: 20 interactions × 80 ms RTT = 1.6 s saved, minus 50 ms move = 1.55 s net before interpreter slowdown. E: $5,000–$15,000/month; five buyers = $0.3–$0.9M ARR. [DO data location](https://developers.cloudflare.com/durable-objects/reference/data-location/).
- **Prior art / who has it:** Request routing, query pushdown, fresh placement + JSON.
- **Verdict:** KEPT (#3) — a genuine DO feature gap, but routing plus JSON often captures most of the value.
- **Kill test / first proof:** Two local executors emulating regions A/B with injected latency, moving after the fifth data step, vs fresh placement + JSON, recorded replay and query pushdown. Reject if state is easy to copy as data, home-broker RTT stays on the critical path, or privacy forbids moving the image.

#### Clone a "trained" agent to every user
- **What:** Distribute a curated initialised working set (generated helpers, derived indexes, parsed policies, proven plans) as copies.
- **How it would work:** Template image is immutable, and tenant credentials are injected by the broker afterwards.
- **Evidence / numbers:** E: 1,000 × 1 MB copies = 1 GB payload; shared immutable data may make conventional baselines much smaller.
- **Prior art / who has it:** Exported config/memory, prepared runtime images, module + JSON.
- **Verdict:** NARROWED (weaker subcase of prepared-state fan-out; no independent willingness to pay) — the killing reply is "you copied a cache and context; no model learning was cloned".
- **Kill test / first proof:** Start 1,000 identities from (1) a live image, (2) source + serialized policy/index, (3) a prepared runtime image; measure bytes, startup-to-useful, isolation and steady CPU.

#### Hibernating a million agents cheaply (the 1M/99%-idle model)
- **What:** Sell near-free idle agents at fleet scale.
- **How it would work:** 1M identities over 30 days at 1% active wall time = 10,000 concurrent, 7.2M active hours, 30M wakes. JSON is 100 KB/agent; the image is 1 MB archived and 2 MiB active.
- **Evidence / numbers:** E: monthly modelled components are DO + JSON $41,496.50; JSON Worker + R2 $216.30; live images on Worker + R2 $529.80; E2B $479,520; Modal $683,769.60; Daytona $712,800; Sprites $459,057.60; Golem not established. E: inference at Sonnet 5.5 list ($2/$10 per M) adds $180,000/month, so the $313.50 JSON-vs-image gap is <0.2%. E: a density upper bound of 45,875 × 2 MiB guests vs 89 × 1 GiB per 128 GiB host (512×), not a capacity claim. E: a million-agent burst in 60 s = 16,667 starts/s needing 16.7 GB/s. F: Modal shows 1M concurrent sandboxes in under a minute; E2B resume ~1 s; Fly warm/cold wakes 100–500 ms / 1–2 s. [Modal](https://modal.com/blog/scaling-to-1-million-concurrent-sandboxes-in-seconds); [E2B persistence](https://docs.e2b.dev/sandbox/persistence); [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).
- **Prior art / who has it:** DO hibernation, E2B pause, Golem unload/replay, Fly Sprites sleep, Modal snapshots, Daytona VM pause.
- **Verdict:** KILLED as differentiator — the gap comes from choosing a tiny event-driven runtime over reserved VMs, and the explicit-state Worker is cheaper than live images.
- **Kill test / first proof:** n/a.

#### Fleet operations gained from live movement (packing, drain, burst, version change)
- **What:** Use live images for packing/rebalancing, deploy drains, burst scaling from prepared capsules, and resuming across model/tool version changes.
- **How it would work:** Three recovery classes (explicit checkpoints; journal replay + periodic checkpoints; exact-build live images), with images as an accelerator for the last two, not a replacement for an effect ledger.
- **Evidence / numbers:** I: an exact module hash can resume old bytes on a new host, but changing guest or interpreter invalidates layout. Updating the model for the next request is easy; identical future answers after a model change are impossible. "Merge results" must mean typed application data.
- **Prior art / who has it:** SQLite actors, Golem, durable Code Mode, E2B/Modal clones, warm pools, startup snapshots.
- **Verdict:** NARROWED — each operation has a strong substitute; on Cloudflare, physical host placement is provider-controlled.
- **Kill test / first proof:** n/a.

#### The fleet control plane is part of the product
- **What:** A minimum operational contract: identity → current-owner mapping, durable inbox/outbox and receipts, monotonic owner epochs, module/ABI/image hashes, bounded images, routing, schedules, per-branch budgets, cancellation, retention/GC, and current authorisation at resume.
- **How it would work:** Partition authority by tenant/agent and reuse DOs or another durable store for identity and receipts. Start with trusted compatible executors, since trusted reconstruction of browser heaps erases savings.
- **Evidence / numbers:** E: 50 buyers × $60k/year = $3M ARR, or 200 × $120k = $24M ARR (unvalidated; the three sketches overlap).
- **Prior art / who has it:** 03-contract.
- **Verdict:** KEPT as a required component — "a broker per fleet is a bottleneck; a brokerless heap is unsafe".
- **Kill test / first proof:** Obtain two opt-in anonymised traces (state bytes, safe branch points, reconstruction CPU, duty cycle, tool-environment dependencies); then run the 1–2 week fork/drain proof.

#### Rejected in this report
- **"A million agents that cost nothing while idle"** — DOs, E2B, Golem and Sprites already remove idle compute billing.
- **"Fork a running agent" as a distinguishing mechanism by itself** — E2B, Modal, Daytona, LangGraph and Golem already branch.
- **Generic support-agent hosting** — the best incumbent is SQLite/JSON plus hibernation; model and voice costs dominate.
- **"Daytona only has disk snapshots"** — false for stable VM sandboxes.
- **Treating replay as re-calling the LLM** — an unfair baseline; journals return recorded responses.
- **Million-agent concurrency or 99% idle as industry statistics** — not established by public user/conversation counts; Cloudflare's 99/1 is illustrative.

### 08-compilers: Warm compiler heaps, forked test worlds, and agent build loops
Lens: developer tools (compiler/checker heaps, bundlers, test worlds, CI environments) where expensive warm state could be snapshotted and forked, traced through distcc, Bazel, Zygote, Smalltalk/Lisp images, V8 snapshots, CRaC and Firecracker. Headline: BuildBuddy already ships the server-side trick (warm Bazel state in Firecracker snapshots moved between executors). CPU-minute savings are surprisingly small, and QuickJS's 5–11× glue penalty can erase every saved second. ONE bet: a two-week warm isolated test-world fork experiment on a portable pure-TS module, with V8 persistent/reset and V8 startup images as controls. Verdict: **go-with-changes** for forked warm test environments; **no-go** for QuickJS-hosted `tsc` as a speed play or generic "new snapshot CI".

#### C. Isolated tests from a seeded, booted application world
- **What:** Snapshot after fixtures, schema construction, dependency injection and app boot; fork independent mutation/test branches for coding-agent patches, each starting clean.
- **How it would work:** The parent becomes immutable; branches get independent memory, filesystem overlays, fixture state and effect identities. Clocks, randomness, temp paths and ports are rebound, and receipts are retained without write permission. An immutable fork removes the reset-contamination class that a serial daemon has.
- **Evidence / numbers:** E (deliberately favourable model): 10 s seed+boot, 0.2 s restore, 0.05 s V8 suffix, 5× QuickJS, 100 branches gives fresh V8 1005 s vs warm interpreted fork 95 s, but persistent V8 with cheap reset ≈ 15 s. E: at 100k branches/month, saving 9 s = 15k runner-minutes ≈ $90/month. Price $500–$2k/month; 50 buyers = $0.3–$1.2M ARR (hypothesis). F: PostgreSQL template databases; Vitest lifecycle. [Postgres CREATE DATABASE](https://www.postgresql.org/docs/current/sql-createdatabase.html); [Vitest lifecycle](https://vitest.dev/guide/lifecycle.html).
- **Prior art / who has it:** Global setup, persistent workers, transactional rollback, DB templates, Android Zygote, E2B memory snapshots.
- **Verdict:** KEPT (#1; the ONE bet) — clearest need for rich live state plus clean forks. Native/VM backends are credible for Node+database stacks.
- **Kill test / first proof:** A real small pure-TS service/domain module running in V8 and QuickJS with synthetic in-memory data and a derived index; fork 20 branches corrupting different fixture rows and check the parent and siblings stay unchanged. Baselines: fresh V8, persistent V8 + reset, V8 startup image, fresh/persistent QuickJS, serialized fixture reload. The killing reply is "transactions or a warm test pool give the same isolation faster".

#### D. CI resumes an entire warm job environment
- **What:** Resume a CI job from yesterday's warm analysis graphs, JIT state and running local services on a new machine.
- **How it would work:** Whole-VM snapshots (Firecracker) after filesystem caches have already removed downloads and installs; a QuickJS heap cannot hold native tools, shells or filesystem state.
- **Evidence / numbers:** F: BuildBuddy (2026-01-26) reports a fully cached Bazel build of ~6 min, of which 3.5 min was setup (~58%), cut to a 30 s median with snapshotted runners; resume takes hundreds of ms, and a 16 GB/50 GB VM is a 66 GB logical snapshot. F: Namespace reports ~2 min of cache-transfer delay. E: 100k jobs × 210 s = 350k runner-minutes ≈ $2,100/month; capturing 20–30% gives $420–$630/month per account; 100 accounts ≈ $0.50–$0.76M ARR. [BuildBuddy report](https://www.buildbuddy.io/blog/fast-runners-at-scale/); [BuildBuddy remote runners](https://www.buildbuddy.io/docs/remote-runner-introduction/); [Namespace](https://namespace.so/blog/zero-latency-caching).
- **Prior art / who has it:** BuildBuddy, E2B reusable memory snapshots, Namespace cache volumes, Depot prepared filesystems (no process memory).
- **Verdict:** KEPT (#2) as an integration into an existing runner system, not a new QuickJS CI engine — the strongest evidence of value and the strongest incumbent ("BuildBuddy already ships this").
- **Kill test / first proof:** A TypeScript controller/telemetry around existing native snapshot-runner results on one agreed CI workload vs prepared image + cache volume, warm persistent runner and Firecracker snapshot product (partner experiment; not executable under the brief's constraints).

#### A. Warm TypeScript checker / language server per PR or agent branch
- **What:** Fork a warmed checker heap (cyclic ASTs, symbols, resolution caches, lazily evaluated types) into one clean graph per patch, then narrowly invalidate.
- **How it would work:** Exercise diagnostics before capture so lazy queries are warm, then fork per edit without writing a stable serializer (`.tsbuildinfo` is a project graph on disk, not a running checker).
- **Evidence / numbers:** F: Microsoft (2025-03-11) VS Code 1.505M LOC project load 9.6 s JS → 1.2 s native; full compiles VS Code 77.8 → 7.5 s, Playwright 11.1 → 1.1 s, TypeORM 17.5 → 1.3 s, tRPC 5.5 → 0.6 s (not all warmup). TypeScript 7.0 shipped 2026-07-08 (8–12× faster). E: 20 fresh launches × 9.6 s = 192 s vs 24 s native. E: 100k checks/month saving 1 s ≈ $10/month, 10 s ≈ $100/month; pilot $500–$2,000/month; ten buyers = $60k–$240k ARR. [TS native port](https://devblogs.microsoft.com/typescript/typescript-native-port/); [TS 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
- **Prior art / who has it:** Native TS 7, watch mode/language services, project references, incremental builds, V8 startup snapshots (V8 demonstrated preloading TypeScript in 2015, ~100 ms saved), Bazel persistent workers (2–4× Java).
- **Verdict:** KEPT (#3) — native TS, incremental caches and persistent services sharply cut the margin; portability may matter more than compute.
- **Kill test / first proof:** A pinned TS 6 JS compiler with a virtual dependency tree plus changed-file overlay vs native TS 7, incremental builds, a persistent language service and V8 startup snapshots, then QuickJS. Stop the QuickJS path if the API can't be adapted or the heap exceeds the cap within two days. Killing reply: "TS 7 plus a persistent service is faster; your edits invalidate the cache anyway."

#### B. Warm bundler or dev-server graph
- **What:** Checkpoint a warm build graph (e.g. a persistent `esbuild-wasm` context) at an idle boundary, restore elsewhere, edit and rebuild.
- **How it would work:** Needs a separate Wasm snapshot adapter, since QuickJS memory does not snapshot an external esbuild instance or its Go runtime.
- **Evidence / numbers:** F: Next.js 15 up to 76.7% faster startup; Turbopack persistent cache restored a >10 s route in <500 ms; filesystem caching default since 16.1/16.3. F: esbuild 0.39 s vs webpack 41.21 s; `esbuild-wasm` can be 10× slower than native. E: 100k preview starts saving 5 s ≈ $50/month (30 s ≈ $300); a 50 MB image needs ≥4 s at 100 Mbit/s. E: $1k/month; 100 buyers = $1.2M ARR (scenario). [Turbopack](https://nextjs.org/blog/turbopack-for-development-stable); [Next.js FS cache](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache); [esbuild](https://esbuild.github.io/getting-started/).
- **Prior art / who has it:** esbuild contexts, Turbopack filesystem cache, HMR, persistent dev servers.
- **Verdict:** RUNNER-UP — adds value only for isolated branches or host loss after significant graph building. Killing reply: "already restarts from disk in under 500 ms".
- **Kill test / first proof:** Compare against native esbuild, its rebuild API, a persistent Wasm worker, cached outputs and disk-cache restart.

#### E. Ship partially built state to idle machines or browsers
- **What:** Migrate mid-graph-construction or compilation state to another host on preemption or relocation.
- **How it would work:** Needs a cooperative host safe point between phases; a long synchronous check has none, and forking a compiler doesn't divide its remaining work.
- **Evidence / numbers:** E: 100 MB moving in 8 s to avoid 60 s rebuild has margin; avoiding 1.2 s native load does not. 10k preempted jobs × 60 s ≈ $60/month; $100–$500/month × 20 customers = $24k–$120k ARR (discovery hypothesis).
- **Prior art / who has it:** distcc, Icecream, Bazel remote execution, Nix remote builders, BuildBuddy.
- **Verdict:** KILLED as an open browser compute market — action-boundary dispatch and artifacts usually have better granularity, and untrusted browser output can't certify release builds.
- **Kill test / first proof:** A bounded cooperative graph-building workload with a safe point, one host forced off, finishing on a second, vs restart, explicit serialized graph, journal replay and action-boundary dispatch.

#### Break-even model and common acceptance gate
- **What:** A general inequality for snapshot-forking warm tools.
- **How it would work:** With W = rebuildable init, U = useful suffix, k = CPU multiplier, A = capture cost, R = per-child restore and N = branches, snapshotting wins only if `N[W − R − (k−1)U] > kW + A`.
- **Evidence / numbers:** E: with W=10 s, R=0.2 s, the suffix must be <2.45 s (k=5) or <0.98 s (k=11); with W=1 s, <0.20 s / 0.08 s. A 32 MiB parent plus 100 resident children = 3.125 GiB. F-prior: QuickJS is 5.2×/11.5×/31.1× V8; Zod heap 5.51 MB raw / 1.50 MB gzip; 5,000 records 5.96/2.88 MB. F: GitHub Linux runners $0.006/min (2-core) and $0.022/min (8-core). [GitHub runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing).
- **Prior art / who has it:** Persistent services cost ≈ W + NU and are usually stronger still.
- **Verdict:** Go/no-go thresholds: zero mismatches or leakage; ≥2× end-to-end vs the strongest correct baseline; ≥30% latency with all transfer and miss costs; a buyer trace. Use reset/explicit state if within 10%, and switch backend if native/VM wins.
- **Kill test / first proof:** A 10-working-day gate: pin the workload and controls (days 1–2), one capture/restore/overlay (3–5), 100 varied patches plus contamination tests (6–8), cold/warm/miss trials (9–10).

#### Rejected in this report
- **QuickJS-hosted `tsc` as a general speed play** — native TS 7 is 8–12× faster and the interpreter penalty erases savings.
- **Generic "new snapshot CI" positioning** — BuildBuddy already moves Firecracker-snapshotted runners.
- **Porting Turbopack/Next.js or a Postgres+Node suite onto the QuickJS capsule** — outside the ABI; use native/VM snapshots.
- **Treating the spike's ~0.4 ms restore as a compiler SLA** — excludes capture, compression, transfer, storage and invalidation.
- **A population-average "agents spend X% warming tools"** — no sourced figure exists.

### 09-model: When does a live heap pay for itself?
Lens: an economic break-even model comparing four reconstruction methods (run from scratch, journal replay, explicit state/JSON, live heap), calibrated on the 04-spike numbers, then a scored scan of 17 domains (R reconstruction benefit / J explicit-state friction / X placement need / F fit / $ buyer value, each 0–3, max 15). Headline: a live heap wins only when a small compatible state is reused often, its computational prefix is costly to rebuild, and an equally good explicit representation is expensive to maintain. The resource is avoidable reconstruction, not the original cost of LLM inputs, which correct replay already reuses. ONE bet: prove seeded-state testing of opaque/generated sandbox programs. Verdict: **go-with-changes** for the cost/value angle; a generic "moving heaps saves inference dollars" pitch fails.

#### Break-even model: four reconstruction methods and crossover equations
- **What:** A common accounting frame so that heap, replay, JSON and rerun are compared for the same next observable behaviour.
- **How it would work:** `T_R = F_R + I + L(u + b/B)` vs `T_H = F_H + W/B`, so the heap beats replay when `L > [F_H − F_R − I + W/B]/(u + b/B)`. The JSON crossover counts omitted-state rebuild G against `(W − Z)/B`. Engineering crossover: `w_dev·ΔD > A(k_H − k_J)`. Forking in the same engine saves CPU if `(K−1)P > C + KR`; moving a native workload into an interpreter needs `(K−α)P > (α−1)KU + C + KR`. The optimal snapshot interval is `k* = sqrt(2C/(q_e u))`, so snapshot plus tail replay is often optimal.
- **Evidence / numbers:** M-prior anchors: H ≈ 2 MiB, S ≈ 97 KB zstd (random 1 MiB → 1,145,411 B; 50 MiB → 52.53 MB), restore-to-useful ≈ 0.4 ms, Δ ≈ 20 KB, 5.2–11.5× and 31.1× interpreter tax. E: the crossover vs cached replay is ~655 events at a 37.75 ms move (~2,050 at 10 Mbit/s). E: modelled handoff is 37.75 ms (zstd small), 121.6 ms (random small), 4,302 ms (50 MiB random) at 100 Mbit/s. E: at α=6, K=100, P=100 ms, U=2 ms, native 10.2 s vs heap 2.3 s, but with U=100 ms native 20 s vs heap 61.1 s. E: one write/read snapshot must avoid ~248 ms replay CPU/use to pay for itself; with capture-once, restore-1,000, ~23.2 ms. E: 16 saved engineering hours ($2,400) support only $0.0024/use over 1M uses; a 15–20-day broker = $18–24k shared effort. [Temporal](https://docs.temporal.io/workflow-execution); [Vercel snapshots](https://vercel.com/docs/workflows/pricing); [Golem snapshotting](https://learn.golem.cloud/v1.6/develop/snapshotting).
- **Prior art / who has it:** Temporal worker cache/replay, Cloudflare Code Mode, Restate, Vercel QuickJS snapshots + tail, Golem, Firecracker, Node startup snapshots, AWS SnapStart.
- **Verdict:** KEPT as the evaluation method — "a 0.4 ms restore must never be relabelled a 0.4 ms migration"; replay that re-calls the LLM is an invalid baseline.
- **Kill test / first proof:** Measure L, replay CPU after step caching, H, S, dirty-page rate, cold/base-cache rates, suffix CPU and integration hours on two real sandbox workloads, then rerank.

#### 1. Agent fleets (generated async tool programs) — 13/15
- **What:** Platforms running generated async tool programs with captured intermediate state that are repeatedly branched or must resume on another supported executor.
- **How it would work:** Fork or hand off the live continuation instead of rebuilding a 400 ms local prefix; recorded model results are reused under every baseline.
- **Evidence / numbers:** E: P=400 ms, 2/0.10 MB, 1,000/h, T_floor 38 ms; R/J/X/F/$ = 2/3/3/3/2. E: 100 branches 42.0 → 2.9 CPU-s (14.5×, $0.000782); incremental avoided LLM spend is $0 vs correct replay. E: 4 h/month = $600, test $250/month ($300K ARR at 100 teams; ~334 teams for $1M). F: Vercel warns >2,000-event histories replay slowly. [LangGraph persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence); [Code Mode](https://developers.cloudflare.com/agents/tools/codemode/how-it-works/).
- **Prior art / who has it:** Vercel/Golem snapshots, Code Mode replay, LangGraph checkpoints.
- **Verdict:** KEPT (#2) — needs actual opaque state and a necessary host change; a 20 KB plan + result refs beats it.
- **Kill test / first proof:** Two generated programs with 100–10,000 recorded calls and a 400 ms prefix vs Code Mode-style replay and an explicit plan/result state; fork 100 replies, trusted Node→workerd handoff. Go: a real host-change requirement plus a substantial replay-latency cut or 4 measured engineering hours saved. Killing reply: "my journaled steps and 20 KB state already do this".

#### 2. Long serverless jobs — 7/15
- **What:** Integration/ETL teams with repeated local prefixes between waits.
- **How it would work:** Guest snapshot plus tail vs bounded replay and `{step, resultRefs}` JSON.
- **Evidence / numbers:** E: P=100 ms after step caching, 4/0.50 MB, 10/h, T_floor 70 ms; 1/1/1/2/2. F: Workflows bills no CPU while waiting. E: $100/month feature → $120K ARR. [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/).
- **Prior art / who has it:** Workflows, Temporal, Restate, JSON step rows.
- **Verdict:** KILLED as a product (feature at most) — an unrecorded 60 s API call is not a 60 s replay opportunity; sleeping supports no premium. Killing reply: "Continue-As-New or a cached step result removes your whole prefix."
- **Kill test / first proof:** Model 10,000 steps with recorded responses and approval waits.

#### 3. Production bug reproduction in the sandbox — 12/15
- **What:** An executable bug report: pinned program, live await state at the last safe cut before a fault, and recorded future inputs, for teams already running tenant/generated code in the guest.
- **How it would work:** Send the pinned artifact to a local harness with bounded inspection helpers; branch future inputs without real effects.
- **Evidence / numbers:** E: P=10,000 ms, 2/0.10, 20/h; 2/3/2/2/3. E: 20 attempts 202.0 → 12.1 CPU-s (16.7×, $0.0038). E: 10 investigation h/month = $1,500, so $500/month → $600K ARR. E: capturing 5 ms after every 2 ms turn adds 250% CPU, so capture coarsely or sample. F: rr record/replay slowdowns as low as 1.2× on Firefox tests. [rr](https://rr-project.org/).
- **Prior art / who has it:** rr, exact input replay, explicit diagnostic dumps.
- **Verdict:** KEPT (#3) — survives only as a useful adjunct or demonstrably simpler support workflow. Killing reply: "a deterministic trace gives causality and reverse stepping; your image pins the buggy build."
- **Kill test / first proof:** Three guest-only faults (closure mutation, aliasing/cycles, reply ordering); time-to-reproduce and time-to-locate vs input replay and logs; wrong-build rejection; acceptable healthy-traffic capture overhead.

#### 4. Testing from seeded states — 14/15
- **What:** Sandbox/runtime/plugin-SDK teams exploring hundreds of future replies after one expensive setup whose private lexical state has no stable fixture.
- **How it would work:** Seed once, capture at an await cut, fork 1,000 divergent futures; recorded effects only, fixed builds, short suffixes.
- **Evidence / numbers:** E: P=2,000 ms, 2/0.10, 1,000/h; 3/3/2/3/3. E: 1,000 branches 2,020 → 27.0 CPU-s (74.8×, $0.03986/batch, ~$39.86/month at 1,000 batches), but complete JSON fixtures do 24.0 s, so JSON wins CPU. E: value is 8 fixture h/month = $1,200; $500/month → $600K ARR (~167 teams for $1M). F: Antithesis explores tens to hundreds of thousands of branching timelines per run. [Antithesis](https://antithesis.com/docs/introduction/how_antithesis_works/).
- **Prior art / who has it:** Antithesis, complete JSON/binary fixtures, native process/VM clone, incumbent sandbox fork modes.
- **Verdict:** KEPT (#1; the ONE bet) — concentrates every favourable term and can fail fast and honestly.
- **Kill test / first proof:** 5–10 days: a corpus of ~20 programs with closures/cycles/typed arrays/pending awaits plus data-only controls; capture/fork/vary replies; sweep history, suffix, entropy and mutation at K = 1/10/100/1,000; send one exact-version artifact Node → workerd/browser Worker. Go: ≥10× less reconstruction CPU than entry replay AND ≥4 measured integration hours saved or coverage of private state the fixture omits; abandon if an explicit schema is within 10%.

#### 5. Game servers / multiplayer handoff — 6/15
- **What:** Move a room/quest-script continuation between servers.
- **How it would work:** Hand off at a tick boundary with player connections at a session broker.
- **Evidence / numbers:** E: P=50 ms, 16/4 MB, 60/h, T_floor ≥350 ms; 1/0/2/1/2. A 50 KB room state rehydrates in ~5 ms. F: Colyseus full state on join, then deltas. E: $200/month → $240K ARR. [Colyseus](https://docs.colyseus.io/state).
- **Prior art / who has it:** Colyseus, DO WebSocket hibernation.
- **Verdict:** KILLED (generic rooms fail the gate) — killing reply: "our 50 KB room save is faster and upgradeable".
- **Kill test / first proof:** A TS room with 100 entities at 60 Hz vs explicit entity/script state and dirty-field deltas.

#### 6. Simulation / Monte-Carlo branching — 9/15
- **What:** Fork event-driven policy simulators after a shared warm-up.
- **How it would work:** Branch after warm-up into 1,000 input streams.
- **Evidence / numbers:** E: P=5,000 ms, 16/8 MB, 1,000/h, T_floor ≥670 ms; 3/1/2/1/2. Native `clone()` or OS CoW in 2–10 ms. F: OpenSpiel `Clone()`/serialization. E: $250/month → $300K ARR. [OpenSpiel](https://github.com/google-deepmind/open_spiel/blob/master/open_spiel/spiel.h).
- **Prior art / who has it:** OpenSpiel, native clone, OS copy-on-write.
- **Verdict:** RUNNER-UP (feature for portable opaque JS models) — the QuickJS suffix tax may dominate. Killing reply: "a native clone is faster and your suffix runs six times slower."
- **Kill test / first proof:** A TS discrete-event sim fork vs entry replay, explicit event-queue/RNG clone and native clone, with long-suffix controls.

#### 7. Notebooks / data exploration — 6/15
- **What:** Keep a prepared analysis kernel alive across sessions.
- **How it would work:** Snapshot a small JS notebook's live locals; large data stays in artifacts.
- **Evidence / numbers:** E: P=60,000 ms uncached, 1024/500 MB, 1/h, so payload alone is ~40 s; 2/1/1/0/2. F: notebook JSON stores cells, not kernel continuations. E: $100/month → $120K ARR. [Jupyter format](https://nbformat.readthedocs.io/en/latest/format_description.html).
- **Prior art / who has it:** Arrow/Parquet artifacts, cached dataframes.
- **Verdict:** KILLED (no Python market follows) — killing reply: "reloading my cached dataframe is cheaper, and this doesn't run my kernel."
- **Kill test / first proof:** n/a.

#### 8. Spreadsheets / live documents — 6/15
- **What:** Snapshot a formula engine's derived dependency cache.
- **How it would work:** Single-writer derived-cache acceleration only.
- **Evidence / numbers:** E: P=1,000 ms, 16/4 MB, 60/h, ≥350 ms; 2/0/1/1/2. F: Yjs updates are commutative, associative and idempotent (semantic replication the heap lacks). E: $200/month → $240K ARR. [Yjs](https://docs.yjs.dev/api/document-updates).
- **Prior art / who has it:** Yjs/CRDTs, incremental formula caches.
- **Verdict:** KILLED as document format; possible single-writer cache feature.
- **Kill test / first proof:** A TS formula DAG with an op log across 1,000 edits, including concurrent edits as a rejection case.

#### 9. Edge personalization — 4/15
- **What:** Move per-user heap state to the edge.
- **How it would work:** n/a.
- **Evidence / numbers:** E: P=2 ms, 1/0.10 MB, 100,000/h; 0/0/1/2/1. A 200-byte profile/cached JSON is cheaper. E: $50/month → $60K ARR.
- **Prior art / who has it:** Normal caching/config delivery.
- **Verdict:** KILLED — "there is no expensive state to rebuild."
- **Kill test / first proof:** n/a.

#### 10. Offline-first apps — 4/15
- **What:** Hand a heap between offline devices.
- **How it would work:** Single-owner continuation handoff.
- **Evidence / numbers:** E: P=5 ms, 4/1 MB, 2/h; 0/0/2/1/1. E: $100/month → $120K ARR.
- **Prior art / who has it:** SQLite/IndexedDB plus op log/CRDT (Yjs state vectors).
- **Verdict:** KILLED — heap transport has no convergence semantics.
- **Kill test / first proof:** n/a.

#### 11. Education / sandboxes — 9/15
- **What:** Save and branch a student's in-progress program with closures at an awaited choice.
- **How it would work:** Student-specific live continuation beyond a shared startup image.
- **Evidence / numbers:** E: P=300 ms, 2/0.10, 100/h; 1/2/2/3/1. E: $50/month → $60K ARR. F: Node startup snapshot hooks are the baseline.
- **Prior art / who has it:** Node startup snapshots + lesson JSON.
- **Verdict:** RUNNER-UP (feature; modest budgets) — killing reply: "lesson state is serializable and rebuilds in 10 ms."
- **Kill test / first proof:** 100 saved sessions plus an update vs startup image + JSON.

#### 12. Browser automation — 7/15
- **What:** Move a browser-automation orchestrator's live state.
- **How it would work:** The controller moves and reconnects to the same remote browser.
- **Evidence / numbers:** E: P=30 ms orchestration (excluding 30 s page activity), 2/0.10, 60/h; 1/1/2/1/2. F: Playwright persists auth state, not a paused browser. E: $200/month → $240K ARR. [Playwright auth](https://playwright.dev/docs/auth).
- **Prior art / who has it:** Playwright storage state, session IDs.
- **Verdict:** KILLED — "the controller moved; the remote browser did not."
- **Kill test / first proof:** n/a.

#### 13. Financial backtesting — 7/15
- **What:** Branch strategies after a shared warm-up.
- **How it would work:** 100 post-warm-up strategy branches.
- **Evidence / numbers:** E: P=10,000 ms, 50/10 MB, 100/h, ≥830 ms; 3/1/1/0/2. Explicit indicators/positions/RNG (0.5 MB) restore in ~75 ms. F: QuantConnect warns warm-up can time out. E: $250/month → $300K ARR. [QuantConnect warm-up](https://www.quantconnect.com/docs/v2/writing-algorithms/historical-data/warm-up-periods).
- **Prior art / who has it:** Indicator serialization, native engine cloning.
- **Verdict:** KILLED (low fit).
- **Kill test / first proof:** n/a.

#### 14. Scientific workflows — 4/15
- **What:** Heap-checkpoint pipeline orchestration.
- **How it would work:** n/a.
- **Evidence / numbers:** E: P=20 ms after task cache, 8/1 MB, 5/h; 1/0/1/0/2; $0 standalone value. F: Nextflow caches and resumes tasks. [Nextflow](https://docs.seqera.io/nextflow/cache-and-resume).
- **Prior art / who has it:** Nextflow/Seqera, native in-task checkpointing.
- **Verdict:** KILLED — the expensive computation is outside the heap and already cached.
- **Kill test / first proof:** n/a.

#### 15. CI — 4/15
- **What:** Heap-checkpoint a JS build scheduler.
- **How it would work:** n/a.
- **Evidence / numbers:** E: P=40 ms dispatcher, 8/1 MB, 100/h; 1/0/1/0/2; $0 standalone value. F: GitHub Actions cache keys. [GitHub caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching).
- **Prior art / who has it:** Build caches, runner/VM snapshots.
- **Verdict:** KILLED — "checkpointing a controller is not checkpointing the compiler." Seeded testing is counted separately.
- **Kill test / first proof:** n/a.

#### 16. Interactive fiction / AI NPCs — 6/15
- **What:** Live generated quest continuations moving between devices.
- **How it would work:** n/a.
- **Evidence / numbers:** E: P=5 ms, 2/0.10, 30/h; 0/1/2/2/1. F: Ink `Story.state.ToJson()`/`LoadJson()`. E: $50/month → $60K ARR. [Ink](https://github.com/inkle/ink/blob/master/Documentation/RunningYourInk.md).
- **Prior art / who has it:** Ink saves, journaled dialogue.
- **Verdict:** KILLED — "Ink's save format is smaller and survives our releases."
- **Kill test / first proof:** n/a.

#### 17. Robotic / IoT controllers — 3/15
- **What:** Restore controller memory on another device.
- **How it would work:** n/a.
- **Evidence / numbers:** E: P=2 ms, 2/0.10, 60/h; 38 ms already misses a 5 ms deadline; 0/1/1/0/1; $0 value. F: ROS 2 managed-node lifecycle. [ROS 2 lifecycle](https://design.ros2.org/articles/node_lifecycle.html).
- **Prior art / who has it:** ROS 2 lifecycle, versioned commands.
- **Verdict:** KILLED — controller memory does not restore the physical world.
- **Kill test / first proof:** n/a.

#### Rejected in this report (where live state definitely loses)
- **Small, already-explicit state** — a 2 ms JSON restore beats a 38 ms heap plus build pinning.
- **History that is mostly recorded external work** — replay recorded LLM results; re-buying them is an invalid baseline.
- **A warm worker or bounded replay tail already suffices** — continue-as-new and cached steps bound the work.
- **Raw, incompressible or rapidly rewritten data** — 50 MiB random takes ~42 s at 10 Mbit/s; new destinations have no delta base.
- **Native throughput or unsupported state needed** — Python, native libs, GPU, DOM, subprocesses, drivers; at α=6 long suffixes lose.
- **Native/local cloning already shares the prefix** — VM CoW or simulation clones.
- **Independent writers, long-lived archives, frequent upgrades** — CRDTs and schemas give merge/migration; heaps don't.
- **Rare reconstruction with continuous checkpointing** — capture cost on all sessions exceeds savings.
- **No compatible safe point or consistent external cut** — transactions, live pages and actuators can't be rewound.
- **Returned computation must be re-executed to trust it** — trusted replay erases the saved CPU.
- **"Long-running agents save inference dollars by moving their heap"** — fails the strong-baseline test.

### 10-wild: Wildcards: live programs as specimens, save games, and experimental worlds
Lens: 17 deliberately ambitious wildcard uses drawn from biology (mitosis, spores, viruses), Telescript, Lisp/Smalltalk images, Plan 9, Erlang, web continuations, Croquet/TeaTime, HPC checkpointing and economics. Each must beat cached replay, JSON+code, Temporal/Restate/Golem, Workflows/DOs, V8 startup snapshots, container/VM checkpoints and rerun, with quickjs-wasi as an existing engine. Headline: seventeen ideas reduce to three proof candidates (runnable failure specimens, same-team save games, a branch laboratory); the universal market of roaming live programs is rejected. ONE bet: the runnable failure specimen as an embeddable feature for an existing generated-code runtime. Verdict: **go-with-changes** for the narrow artifact/debugging feature; **no-go** for a universal economy of roaming live programs.

#### The adversary every idea must beat (shared break-even model)
- **What:** The baseline set and arithmetic all 17 ideas are judged against.
- **How it would work:** One handoff saves latency only if `P > C + S/B + D`. For N same-engine forks, replay ≈ `N(P+U)` vs snapshot ≈ `P + C + N(S/B + D + U)`, and JSON ≈ `P + export + N(load + U)` can beat both. Avoided historical LLM charges never count against a correctly journaled baseline.
- **Evidence / numbers:** E: 3 MB = 240 ms at 100 Mbit/s and 2.4 s at 10 Mbit/s; 20 KB JSON = 1.6 ms. E: 1 s Workers CPU = $0.00002; a 30 s prefix = $0.0006, so avoiding it 100× saves $0.06. 1M × 3 MB images = 3,000 GB ≈ $45/month R2. F-prior: restore ~0.4 ms; 50 MiB random = 52.53 MB zstd; deltas 22–23 KB; 1.50–6.39 MB gzip examples; 5.2–11.5×/31.1× slowdown. [Golem snapshotting](https://learn.golem.cloud/v1.6/develop/snapshotting); [quickjs-wasi](https://github.com/vercel-labs/quickjs-wasi); [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
- **Prior art / who has it:** Golem, Restate, LangGraph forks/interrupts, Temporal, Cloudflare Workflows/DO, Node startup snapshots, CRIU, Vercel quickjs-wasi.
- **Verdict:** Framing — remaining advantages are avoided local prefix compute, preserving opaque/generated objects without per-program exporters, and moving to a different compatible executor. Sell a reliable workflow/integration, not a memory-copy primitive.
- **Kill test / first proof:** n/a.

#### 1. Mitosis: fork one prepared agent into an experimental population
- **What:** Fork a parked generated program into alternative tool replies or policies and compare futures without reconstructing hidden local state. 100× version: every risky agent decision opens an experimental population.
- **How it would work:** Checkpoint once before a controlled next input. Branches get distinct IDs, capped budgets and explicit entropy; pick a result and never merge heaps. Only an approved selected branch may call a committing sink.
- **Evidence / numbers:** E: 100 experiments with a 30 s prefix waste 3,000 s vs one; 100 × 3 MB copies = 300 MB (~24 s payload). E counterexample: V8 2 s prefix, 10× QuickJS, 100 branches gives live forks ~40 s vs V8 reruns 201 s (~5×, not 100×), but explicit JSON + V8 ≈ 4 s (10× better than live forks). E: $250–$750/month, R100 $0.3–0.9M; a $500/month fee needs ~8,334 batches/month just to match $0.06 CPU savings. F: LangGraph checkpoint forks. [LangGraph time travel](https://docs.langchain.com/oss/javascript/langgraph/use-time-travel); [Golem forking](https://learn.golem.cloud/v1.6/develop/forking).
- **Prior art / who has it:** LangGraph, Golem fork/snapshot.
- **Verdict:** KEPT (#3, narrowly) — a branch laboratory only for programs already needing a sandbox, with repeated expensive local prefixes; no autonomous swarm or public compute exchange.
- **Kill test / first proof:** 7–10 days: three generated tasks with hidden state plus three controls (prefix 20 ms–30 s, state 0.1–10 MB), 1/10/100 sequential branches vs host-V8 cached replay, same-engine replay, expert JSON + V8 and nearest graph checkpoint. Gate: ≥5× aggregate turnaround vs the strongest cached-replay baseline, or ≥1 engineer-day avoided per new program family. Kill if branch time is mostly new model calls, prefixes are cheap after caching, or exporters are easy. Killing reply: "your state is a cache; export it once and keep the JIT".

#### 2. Spores: jobs germinate only when conditions are favourable
- **What:** Park an unfinished job until price, data, connectivity or approval crosses a wake threshold. 100× version: billions of dormant intentions waking at the cheapest useful moment.
- **How it would work:** A host-side watcher wakes the capsule, since dormant bytes cannot sense their environment.
- **Evidence / numbers:** F: B. subtilis spores integrate nutrient pulses (Kikuchi et al., Science, 2022-10-07). F: DO hibernation stops duration billing. E: 1M × 3 MB parked = $45/month; ceiling $50/month, R100 $60K.
- **Prior art / who has it:** Schedulers, durable timers, queues, workflow events, DO hibernation.
- **Verdict:** KILLED as a standalone product — "this is a timer and a state row".
- **Kill test / first proof:** 1,000 local synthetic wake events, JSON/DO-style vs capsule restore.

#### 3. Invited viral capsule: a program enters the data owner's host
- **What:** Send unfinished analysis to an explicitly consenting customer runner that grants read-only tools beside its data.
- **How it would work:** The host supplies the missing machinery (virus analogy) but must admit the program and grant resources: an invited plugin.
- **Evidence / numbers:** E: 1 GB reduced locally to 100 KB avoids ~10,000× transfer (locality shared with SQL); 3 MB move vs ~10 s rebuild. E: $500–$1,500/month, R100 $0.6–1.8M.
- **Prior art / who has it:** Private runners, connector APIs, query pushdown, JSON dispatch.
- **Verdict:** MERGED into #9 — "run my query near my database; why import your VM?" Private placement is not confidential computation, and a returned post-read heap may leak data.
- **Kill test / first proof:** A synthetic 100 MB streamed fixture, Node→workerd handoff vs JSON task dispatch and local query.

#### 4. Warm computation grocery: buy a ready-to-continue state
- **What:** Sell an initialised parser, search workspace or analysis state instead of source plus setup. 100× version: a commodity exchange of computational intermediates.
- **How it would work:** Live snapshots of partially solved opaque state with provenance and freshness contracts.
- **Evidence / numbers:** E: a 30 s prefix = $0.0006; 1M sales at $0.001 = $1K gross. E: $100/month internal, R100 $120K. F: V8 custom startup snapshots (2015). [V8 startup snapshots](https://v8.dev/blog/custom-startup-snapshots).
- **Prior art / who has it:** Caches, prebuilt indexes, startup images.
- **Verdict:** KILLED as a public market; internal cache kept as an optimisation — "stale, runtime-specific, and more expensive than rebuilding".
- **Kill test / first proof:** Ten init fixtures as raw code, explicit cache, V8 startup state and live snapshot.

#### 5. Resell unfinished computation: work-in-progress changes owners
- **What:** A buyer purchases a partially completed running investigation and may resell its remaining work.
- **How it would work:** A broker-controlled right to continue, rather than withholding a copy.
- **Evidence / numbers:** E: $10/accepted milestone; 100 customers × 10/month = $120K GTV, $12K revenue at 10% take.
- **Prior art / who has it:** Consulting deliverables, milestone contracts.
- **Verdict:** KILLED (market thesis) — "I cannot value it without inspecting it; inspection gives me a copy". Rights, stale assumptions, adverse selection and duplicated effects dominate.
- **Kill test / first proof:** Simulate ten local milestone exchanges with broker-controlled continuation rights.

#### 6. Time-reversal console: rewind an agent's world
- **What:** Restore earlier checkpoints and replay recorded imports forward to find where state went wrong, varying one input.
- **How it would work:** Rewind means restore then replay forward; external history stays real, and await-only snapshots give no instruction-level stepping.
- **Evidence / numbers:** E: 20 iterations × 30 s prefix = 10 min; 20 × 3 MB restores = 60 MB vs 600 s replay. E: $250/month, R100 $300K (same buyers as #7). F: rr reverse execution. [rr](https://rr-project.org/).
- **Prior art / who has it:** rr, graph time travel, tracing.
- **Verdict:** MERGED into #7 with the reversal claim removed — "you can rewind the guest, not my database or the model service".
- **Kill test / first proof:** A 50-boundary trace, five checkpoints, ten edited futures vs nearest-checkpoint JSON replay.

#### 7. Failure specimen: attach the actual failing computation to an issue
- **What:** A failure report carries the last healthy parked program, its exact build and a bounded effect tape, so another engineer (or repair agent) can reproduce and branch it locally without production credentials. 100× version: every agent incident becomes an executable regression specimen.
- **How it would work:** A manifest with code/build, checkpoint identity, tape cursor, pending request and plain-language status. Replay mode allows recorded continuation and branch-specific next replies and rejects network/write requests. Fixes are verified by rerunning corrected source from entry, not continuing an old frame. Exports are limited to approved synthetic/sanitized-origin specimens.
- **Evidence / numbers:** F: LangChain survey (1,300+ respondents, 2026-06-12) shows 89% have agent observability, 62% detailed tracing, 32% name quality the leading barrier (adjacent pain, not snapshot demand). E: 4 incidents/month × 1 h = $600/month. E: $250 pilot, then $200–$500/month/application; R100 $0.24–0.6M. [LangChain State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering).
- **Prior art / who has it:** Traces, deterministic replay bundles, graph checkpoints, rr, quickjs-wasi.
- **Verdict:** KEPT (#1; the ONE bet) — useful even without moving production jobs; the decisive risk is that record/replay gives the same result with less burden.
- **Kill test / first proof:** 10 days: ten generated-JS fixtures with closure/aliasing/iterator/async-state failures plus two controls, a Node exporter and workerd receiver, vs code + deterministic tape + cached replay and an expert JSON checkpoint (quickjs-wasi if available), with ≥3 engineers counterbalanced. Pass: all ten reproduce with exact hashes and zero network effects, ≥8/10 branchable on a separate executor, ≥2× median diagnosis improvement or ≥30 min saved per incident, two teams with ≥2 such incidents/month, capture overhead ≤10%. Kill if cached replay is within 10%, hidden state is rarely causal, general heap redaction is required, or debugging the interpreter becomes the task. Killing reply: "your tape alone reconstructs this in 80 ms."

#### 8. Agent organ transplant: specialists exchange live programs
- **What:** Hand an opaque subtask's continuation to another agent harness instead of reconstructing progress from prose.
- **How it would work:** Two harnesses share one runtime/ABI; the JS controller's exact work transfers, but not the remote LLM's activations.
- **Evidence / numbers:** E: two ten-minute lost-context corrections = $50/handoff (incidence unknown); 3 MB capsule vs 20 KB structured handoff. E: $250–$750/month, R100 $0.3–0.9M. F: Restate durable specialist handoffs. [Restate multi-agent](https://docs.restate.dev/ai/patterns/multi-agent).
- **Prior art / who has it:** Typed tool calls, artifact stores, Restate.
- **Verdict:** MERGED into #9 — "the next model needs explicit context anyway".
- **Kill test / first proof:** Ten integration tasks: summary vs JSON vs cached replay vs continuation transfer.

#### 9. Shareable save game for agent work
- **What:** Save an agent-generated JS job at a tool/approval boundary and let a teammate continue a controlled copy without reconstructing hidden intermediate state. 100× version: unfinished work as shareable and branchable as a document.
- **How it would work:** Pause at an approval or missing-resource boundary; export manifest/image/tape; kill the source; claim from a separate Node process or local workerd. The destination grants fresh read-only adapters, never inherited credentials. Includes #3/#8/#14 as uses or infrastructure and #11/#12 as packaging/interfaces.
- **Evidence / numbers:** F: LangGraph interrupts wait indefinitely but restart the current node. E: eight interruptions × 20 min = $400/month pain. E: $100–$300/month, R100 $0.12–0.36M; a 40 h ($6K) integration kills a small-team sale. [LangGraph interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts).
- **Prior art / who has it:** Shared sessions, exported messages/files, LangGraph checkpoints, durable approval workflows.
- **Verdict:** KEPT (#2) — only for generated code with hidden in-node state within one trusted team first, not a whole coding-agent computer.
- **Kill test / first proof:** 10 days: ten generated integration programs plus two JSON controls; 100 resume cycles with stale/duplicate claims, expired approvals, wrong builds and transfer failures, vs JSON dispatch, cached replay and LangGraph-style nodes. Pass: 100/100 cycles correct, zero redispatches, stale sources fenced; value gate: ≤1 day to embed and ≥4 h/month saved on three traces (≥2× resume or ≥50% less adapter effort). Kill if messages+files are the state or replay restores in <100 ms. Killing reply: "we share LangGraph checkpoints already."

#### 10. App store of paused programs
- **What:** Distribute task-specific programs already parked where the user supplies data or consent.
- **How it would work:** n/a.
- **Evidence / numbers:** E: $5/month/user; 100 orgs × 10 users = R100 $60K.
- **Prior art / who has it:** Templates, hosted apps, notebooks, workflow catalogs.
- **Verdict:** KILLED until #9 has demand — "you are selling a template with more compatibility and inspection problems".
- **Kill test / first proof:** Five templates as code+JSON vs paused images.

#### 11. Email attachments that continue working
- **What:** Send a paused report/reconciliation that the recipient explicitly opens in a compatible sandbox and continues.
- **How it would work:** Explicit open, fresh grants, zero network tools in preview, never auto-execute.
- **Evidence / numbers:** E: one 15 min clarification = $37.50; 3 MB is ~4 MB base64. E: $5/user/month, R100 $60K.
- **Prior art / who has it:** Attachments, forms, approval links, shared task URLs; Telescript.
- **Verdict:** KILLED as a product; kept as packaging for #9 — "an executable attachment is a worse approval link".
- **Kill test / first proof:** Local export/import of a capsule file vs a shared JSON task.

#### 12. A URL that is a running program
- **What:** Opening a URL creates a controlled branch from a named parked computation.
- **How it would work:** Content-addressed lookup plus an explicit branch button; a GET/preview never triggers effects.
- **Evidence / numbers:** F: Racket serialises continuations into URLs. E: standalone price $0. [Racket stateless servlets](https://docs.racket-lang.org/web-server/stateless.html).
- **Prior art / who has it:** Racket, session/notebook links.
- **Verdict:** KILLED as a distinct mechanism; kept as an interface for #7/#9 — "that's a session ID".
- **Kill test / first proof:** 100 repeat opens, zero effects, stable parent, wrong-build rejection.

#### 13. Personal Smalltalk world: an app follows its owner
- **What:** Carry a personalised application world between desktop, browser and phone.
- **How it would work:** A headless domain model moves; the UI is rebuilt.
- **Evidence / numbers:** F: Pharo saves running object worlds. E: 2 min × 20 sessions = $100/month; $10/month, R100 $120K.
- **Prior art / who has it:** Pharo/Smalltalk, local-first sync.
- **Verdict:** KILLED (broad app claim) — "your image is not my application or device environment".
- **Kill test / first proof:** One domain model, two thin UIs, vs JSON across ten edits and a version change.

#### 14. Plan 9 travel kit: remount the world under a live job
- **What:** A moved program keeps stable logical tool names while the destination supplies newly authorised implementations.
- **How it would work:** Per-namespace rebinding with explicit ABI, version, cancellation, size limits and effect identity; mismatched semantics fail visibly.
- **Evidence / numbers:** F: Plan 9 per-process namespaces (Pike et al., 1992). E: 4 adapter h/month = $600; 3 MB/240 ms vs 10 s rebuild. E: $250–$750/month, R100 $0.3–0.9M.
- **Prior art / who has it:** Plan 9, RPC stubs, DI, connector registries.
- **Verdict:** MERGED (infrastructure) into #9 — "you reinvented service discovery".
- **Kill test / first proof:** Bind `readRows` to two synthetic hosts and reject one incompatible adapter.

#### 15. Erlang colony: supervised live workers replace failed siblings
- **What:** A supervisor resumes the latest known-good capsule on another worker after an environmental failure.
- **How it would work:** OTP-style restart limits and escalation; stale owners fenced externally.
- **Evidence / numbers:** E: replacing a 30 s rebuild with a 0.5 s handoff saves ~$0.00059/recovery; $100/month, R100 $120K. F: Erlang supervision limits restarts. [OTP supervision](https://erlang.org/documentation/doc-4.9.1/doc/design_principles/sup_princ.html).
- **Prior art / who has it:** Erlang/OTP, workflow retries, process/container restart.
- **Verdict:** KILLED (generalised self-healing) — "restart a clean worker; don't replicate the fault".
- **Kill test / first proof:** 100 injected exits and stale-owner attempts vs JSON checkpoints and cached replay.

#### 16. TeaTime universes: fork a shared live world
- **What:** Collaborators branch an active simulation or planning session and compare outcomes.
- **How it would work:** Branch, then choose a scenario or merge explicit domain commands; no byte-level heap merge.
- **Evidence / numbers:** F: Croquet joins from snapshot plus ordered events with deterministic time/randomness. E: 60 s rebuild × 20 alternatives = 20 min; $500/month, R100 $600K. [Croquet snapshots](https://croquet.io/croquet/croquet/tutorial-2_7_snapshots.html).
- **Prior art / who has it:** Croquet/TeaTime (Reed 2005), event-sourced models.
- **Verdict:** KILLED (generic collaboration); a potential domain application later — "branches do not merge, and our solver already exports state".
- **Kill test / first proof:** 20 branches of a deterministic sim vs seeded rerun and an explicit model snapshot.

#### 17. HPC miniature: checkpoint/restart on interruptible capacity
- **What:** Move long-running generated JS jobs away from eviction or resource limits, keeping completed local work.
- **How it would work:** Cooperative yields during CPU work; forced preemptions.
- **Evidence / numbers:** E: 100 lost 30 s prefixes/day = 50 CPU-min ≈ $0.06/day; $100/month, R100 $120K. F: SCR checkpoint/restart.
- **Prior art / who has it:** SCR, batch schedulers, spot-aware systems, queue retries.
- **Verdict:** KILLED (broad compute proposition) — "an interpreter that is 5–31× slower can consume more than all the restarts it avoids".
- **Kill test / first proof:** Three bounded CPU fixtures with yields and preemptions vs V8 rerun, JSON and cached replay.
