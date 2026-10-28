[← Catalogue index](README.md) · [Research summary](../RESEARCH-SUMMARY.md)

**59 entries.** Reports in this round:

- [01-compute: Does movable JS relieve scarce compute?](#01-compute-does-movable-js-relieve-scarce-compute)
- [02-history: Moving running programs: the recurring promise, the failures, and the 2026 opening](#02-history-moving-running-programs-the-recurring-promise-the-failures-and-the-2026-opening)
- [03-contract: The cross-machine contract: move computation, keep effects at home](#03-contract-the-cross-machine-contract-move-computation-keep-effects-at-home)
- [04-spike: Local teleport hop chain and 100 forks](#04-spike-local-teleport-hop-chain-and-100-forks)
- [05-product: Teleporting programs: value, buyer, and an honest demo](#05-product-teleporting-programs-value-buyer-and-an-honest-demo)

---

## Round 4 — teleporting programs — `teleport/` (reports 01–05)
The round tested the builder's idea that a running QuickJS/Wasm JavaScript program can pause mid-`await` and resume or fork on another machine (Worker/DO, browser, phone), and his claim that "if programs can move, we can distribute the compute". The mechanism works: a live heap hopped Node → workerd → headless Chrome → Node and forked 100 ways with byte-identical results, ~0.4 ms restores and ~20 KB sparse deltas. But snapshot size follows heap entropy (~52.5 MB for 50 MiB random data), and browser transfers stalled for seconds. The rest of the round was skeptical. Moving JS relieves no GPU/HBM/KV scarcity. "It moves" is not novel (Telescript, Termite, SqueakJS, Weave, Vercel quickjs-wasi, Golem). The buildable, unsolved part is a cross-machine contract in which a durable home broker owns effects, secrets, budgets and ownership. Product value is narrow: keeping generated tool code intact across approval and host changes, and taking a multi-stage job to private data. Every report came back **go-with-changes**, with explicit no-gos for "free compute everywhere" and for markets of strangers' idle devices.

### 01-compute: Does movable JS relieve scarce compute?
Lens: the builder's claim that movable programs can "distribute the compute", tested by naming which resource is actually scarce (GPU prefill, decode/KV/HBM, CPU glue, network/origin, storage, power) and whether moving a QuickJS/Wasm continuation touches it. Headline: GPU/HBM, site power and origin/network locality are scarce; cheap JS CPU is not, and a moved JS heap carries neither weights nor KV, so it adds no inference capacity. ONE bet: sell movement only where stateful placement unlocks selective near-data work or a quality-checked device/cloud split. Verdict: **go-with-changes** for the compute-scarcity angle.

#### A. Follow the data (visit the data owner)
- **What:** Move the live program to a data owner's site, reduce a large dataset there, and ship back only the small answer.
- **How it would work:** The continuation pauses at a tool await, hops to a host beside the owner's data, runs the selective joins/filters/sequential tool calls locally, and returns a small result; most plausible for stateful multi-owner workflows.
- **Evidence / numbers:** E: 1 GB reduced to 1 MB avoids ~1,000× cross-boundary bytes; a 10 KB answer ~100,000× (a bytes denominator, not total compute). E: at S3's F $0.09/GB, one avoided 1 GB download saves ~$0.09; scan CPU still runs. F: Cloudflare Placement gives single-digit-ms access to an upstream. [AWS S3 pricing](https://aws.amazon.com/s3/pricing/); [Cloudflare Placement](https://developers.cloudflare.com/workers/configuration/placement/).
- **Prior art / who has it:** SQL/query pushdown, stored procedures, a stateless Worker with Cloudflare Smart Placement.
- **Verdict:** KEPT (one of two defensible uses) — the 100× version is "cross-boundary bytes avoided on selective data workflows"; only valid if it beats pushdown/placement, not just bulk export. Owner must authorise foreign code; a capsule that retains the dataset becomes a disallowed export.
- **Kill test / first proof:** Two-owner, multi-stage read-only workload with a 1 GiB fixture and small answer vs five baselines (export, SQL pushdown+queue, Cloudflare placement, stateless source+JSON/replay, movable continuation); require ≥100× fewer bytes vs export and a material gain vs the strongest pushdown/placement baseline.

#### B. Follow free GPU/model capacity
- **What:** Move the program to wherever a model endpoint has free capacity or lower price.
- **How it would work:** The capsule waits, changes endpoint, or carries non-model state when a region fails or gets cheaper.
- **Evidence / numbers:** F: AWS Bedrock cross-region inference already routes requests to regional capacity; the global option advertises ~10% savings. I: moving a 3 MB JS image often costs more latency than routing a prompt; it changes neither prefill FLOPs nor decode HBM demand. [AWS cross-region inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html).
- **Prior art / who has it:** AWS Bedrock cross-region/global inference profiles; Cloudflare AI Gateway Auto Router.
- **Verdict:** KILLED as a capacity lever — the model must already be loaded/licensed there; route the model request instead. Useful only if the whole workflow must resume beside the selected capacity.
- **Kill test / first proof:** n/a beyond the general kill test.

#### C. User device, cloud for hard calls (hybrid split)
- **What:** Run the orchestrator on the user's device, resolve qualified tasks with local rules or a resident small model, and call the cloud only for hard cases.
- **How it would work:** The moved JS calls a resident local model (browser WebGPU/WebNN, Chrome Prompt API, Apple Foundation Models) through a host import; the copied heap does not contain GPU objects.
- **Evidence / numbers:** E: 90% local resolution of 1M tasks cuts central calls 1M→100k; model charges $9,000→$900 (Sonnet 4 list $3/$15 per M tokens, 2,000 in + 200 out). 99% would be 100× fewer, but no source establishes such a hit rate. E: a 3B 2-bit model is a 0.75 GB ideal minimum. F: Chrome built-in models need 22 GB free storage and >4 GB VRAM or 16 GB RAM/≥4 cores, and exclude Android/iOS; ~85% global WebGPU browser support (Hugging Face, March 2026). [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api); [Apple WWDC25](https://developer.apple.com/videos/play/wwdc2025/286/); [Transformers.js WebGPU](https://huggingface.co/docs/transformers.js/guides/webgpu).
- **Prior art / who has it:** Transformers.js, Chrome Prompt API, Apple Foundation Models, Bedrock intelligent prompt routing; a normal client app with local fallback.
- **Verdict:** KEPT (second defensible use) — a credible GPU lever only because inference is replaced, not because JS moved; users pay device energy, and quality and eligibility narrow it.
- **Kill test / first proof:** 1,000 held-out extraction/classification tasks across browser WebGPU or built-in/native local models with cloud fallback; report quality, eligibility, cold load, energy, central calls and device cost.

#### D. Follow the sun / green power
- **What:** Move delay-tolerant jobs to a warm site or time with lower price or grid carbon intensity.
- **How it would work:** The continuation pauses and resumes in the chosen region; mobility adds value only when meaningful in-flight local state must survive the shift.
- **Evidence / numbers:** F: Google 2025 regional grid averages are 19 gCO₂e/kWh in Stockholm and 588 in Jakarta (E: ~31×, not a measured job reduction). F: Spot VMs up to 90–91% off; OpenAI Batch gives 50% off with a 24 h window and no JS heap shipped. [Google carbon data](https://cloud.google.com/sustainability/region-carbon); [OpenAI Batch](https://developers.openai.com/api/docs/guides/batch); [AWS Spot](https://aws.amazon.com/ec2/spot/pricing/).
- **Prior art / who has it:** OpenAI Batch API, AWS/Google Spot, delayed queues plus request routing.
- **Verdict:** KILLED for single waiting tasks — a delayed queue plus model-request routing usually wins; a carbon claim needs hourly marginal signals, not annual CFE%.
- **Kill test / first proof:** n/a.

#### E. Volunteer / idle-device agent work
- **What:** Ship agent work to opt-in idle laptops, phones and browser tabs.
- **How it would work:** BOINC-style pull of independent work with checkpoint/retry and redundant validation, here carried as live heaps.
- **Evidence / numbers:** E: 1M opt-in laptops at one core-hour/day gives 1M core-hours/day in principle (a scenario, not an accessible fleet). F: GSMA puts 2025 smartphone ownership at 54% of the world's population, and ITU counts 6.0B Internet users (reach, not idle CPU). F: Cast AI 2026 sample shows 8% CPU, 20% memory, 5% GPU utilisation. F: Chrome freezes CPU-heavy background tabs under Energy Saver; iOS background time is discretionary. [BOINC paper](https://boinc.berkeley.edu/boinc_a_platform_for_volunteer_computing.pdf); [Cast AI 2026](https://cast.ai/reports/kubernetes-optimization-report/); [Chrome freezing](https://developer.chrome.com/blog/freezing-on-energy-saver).
- **Prior art / who has it:** BOINC; Spot/preemptible markets for idle server CPU.
- **Verdict:** KILLED for agent workflows — untrusted volunteers cannot own credentials or side effects; the best fit is consented, read-only, verifiable batch CPU work, where plain task chunks are easier to audit than live-heap migration.
- **Kill test / first proof:** n/a.

#### Product hypothesis: mobility as an orchestration primitive
- **What:** Position the movable continuation as an orchestration primitive for stateful selective near-data work and hybrid device/cloud work, not an accelerator scheduler.
- **How it would work:** The near-data buyer saves exported bytes, origin round trips or compliance friction; the hybrid buyer cuts central model demand on narrow, quality-checked tasks. For cheap-region and idle-CPU work, movement is only a durability/placement convenience.
- **Evidence / numbers:** E: 10 ms of Worker CPU on 1M requests costs $0.20 vs $9,000 in model charges, so removing all glue CPU cuts the bill 0.0022%; even at a 5% CPU share the ceiling is 1.053×. M-prior: QuickJS/Wasm is 5.2× slower than V8 on JSON/filter/group (3.993 vs 0.772 ms), 11.5× on validation, 31.1× on a scalar recurrence; a 3 MB snapshot needs 2.4 s at 10 Mbit/s; images are 99,854 B (simple) to 1.50 MB (Zod) to 6.39 MB (freed buffer). [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/); [IEA 2026](https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary).
- **Prior art / who has it:** Request/region routing (Bedrock, AI Gateway Auto Router), Smart Placement, batching/warm serving, model routers.
- **Verdict:** KEPT as the ONE bet (go-with-changes) — no public Workers API guarantees same-host GPU placement, KV eviction access, or execution on a phone's NPU.
- **Kill test / first proof:** Instrument real agent-job traces by prefill/decode tokens, tool CPU, origin bytes/RTTs, storage and deadlines; reject placements whose saved scarce resource is smaller than migration overhead.

#### Rejected in this report
- **Copying a JS continuation distributes frontier inference / creates GPU capacity** — the heap holds neither weights (~16 GB for 8B BF16) nor KV (E: 1 GiB at 8,192 tokens); it cannot free a provider's parked KV without serving-engine cooperation.
- **100× end-to-end agent savings** — CPU glue is a negligible share of cost; only bytes avoided or central calls avoided can reach 100×, and neither is measured against strong baselines.
- **Moving to relieve CPU glue cost** — CPU is cheap, and the portable interpreter uses more CPU than direct V8.
- **Single-site placement via mobility** — request routing, Smart Placement, batching and model routers already solve it; moving mid-turn can lose prompt-cache affinity.

### 02-history: Moving running programs: the recurring promise, the failures, and the 2026 opening
Lens: history of mobile agents, process migration, object mobility, images, continuation web servers and VM migration, plus a bounded 2026 prior-art update. Headline: the essential mechanisms were already shown (Telescript, D'Agents, Emerald, Scheme continuations, images); mechanism was never the only obstacle. Adoption failed on demand, infrastructure, adequate alternatives and machine ownership, while VM migration succeeded inside controlled domains with a recurring operational buyer. Weave (2026) already documents live browser/native Wasm migration. ONE bet: a constrained, versioned continuation runtime with measured placement value and brokered effects. Verdict: **go-with-changes**; do not base the thesis on novelty, GPU relief or a market for strangers' idle devices.

#### Mobile agents (1990s): the program carries its task to the service
- **What:** An electronic representative travels through networks to act for its owner, preserving control flow across hops.
- **How it would work:** Telescript's `go` resumed at the next instruction at the destination, and `send` built travelling clones, with capability/resource permits. Aglets, Voyager and JADE moved serialized objects or agents (weak mobility); D'Agents had strong mobility for Tcl and Java.
- **Evidence / numbers:** F: Telescript was announced on 1994-01-06, and its October 1995 language reference specifies permits. F: AT&T discontinued PersonaLink on 1996-08-30. F: OMG MAF 1.0 (Jan 2000) explicitly excluded language interoperability. F: IBM's 1995 report found individual benefits "not overwhelming". F: NIST SP 800-19 (1999) covers two-way security threats. [Telescript reference](https://bitsavers.trailing-edge.com/pdf/generalMagic/Telescript_Language_Reference_Oct95.pdf); [D'Agents 2002](https://www.cs.dartmouth.edu/dfk/research/gray-spe/index.html); [Harrison et al. 1995](https://scispace.com/pdf/mobile-agents-are-they-a-good-idea-4ev3mskzkw.pdf).
- **Prior art / who has it:** General Magic Telescript/PersonaLink, IBM Aglets, Agent Tcl/D'Agents, ObjectSpace Voyager, JADE, OMG MASIF/MAF.
- **Verdict:** KILLED as a universal visiting-agent market — coordination trap (hosts need a reason to install before a market exists), malicious-host problem, and HTTP services/queries removed the same chatter. Wasm improves the substrate; it does not invent capability-limited mobile agents.
- **Kill test / first proof:** n/a.

#### Process migration to idle workstations
- **What:** Offload running processes to idle machines and evict them when owners return.
- **How it would work:** V System, Charlotte and Sprite moved same-architecture processes. MOSIX kept a home-node deputy for syscalls; Condor's Standard Universe relinked jobs for checkpoint, remote syscalls and restart.
- **Evidence / numbers:** F: Sprite was in daily use by late 1988, did most migration at `exec`, saw 3–6× compile speedups, and ran at ~10 sites. F: openMosix ended on 2008-03-01, citing cheap multicore and virtualisation. F: the Milojičić et al. 2000 ACM survey names the real barriers as too few compelling applications, inadequate infrastructure, simpler alternatives sufficing, and users refusing to share workstations. [Sprite paper](https://web.stanford.edu/~ouster/cgi-bin/papers/migration-spe.pdf); [Process Migration survey](https://doi.org/10.1145/367701.367728); [Sprite retrospective](https://web.stanford.edu/~ouster/cgi-bin/spriteRetrospective.php).
- **Prior art / who has it:** V System, Charlotte, Sprite, MOSIX/openMosix, HTCondor (now uses application-level checkpoints).
- **Verdict:** KILLED as the thesis (lesson kept) — it is a demand test: name which user loses work or money without mid-execution relocation. Placing a new task correctly was often the cheaper answer, and residual home dependencies were a conscious tradeoff.
- **Kill test / first proof:** n/a.

#### Language-level object mobility and serializable continuations
- **What:** Make location and movement part of the language: move objects or processes, ship closures and continuations, migrate or clone tasks.
- **How it would work:** Emerald `move`/call-by-move; Obliq distributed lexical scope; Kali Scheme transmitting closures and continuations; Termite `migrate-task` capturing a Gambit continuation and spawning it remotely; Erlang remote spawn, links, monitors and hot code loading.
- **Evidence / numbers:** F: Emerald (TOCS, Feb 1988); Obliq (POPL 1995) warns of undesirable network traffic; Kali (TOPLAS 1995); Termite (2006) shows migration, cloning and dynamic code change, leaving mailbox/links behind. F: Erlang has no API to export an arbitrary active BEAM stack. [Emerald](https://people.eecs.berkeley.edu/~prabal/resources/osprelim/JLH%2B88.pdf); [Termite](https://www.iro.umontreal.ca/~feeley/papers/GermainFeeleyMonnierSW06.pdf); [Obliq](https://www.usenix.org/publications/compsystems/1995/win_cardelli.pdf).
- **Prior art / who has it:** Emerald, Obliq, Kali Scheme/Scheme 48, Termite/Gambit, Erlang/OTP.
- **Verdict:** Prior art (lesson kept) — Termite is direct prior art for "fork this running program". A continuation is not the whole actor: mailbox, identity, links (here pending tool calls, streams, timers, approvals, next-effect ownership) need explicit decisions. A computation can move while its dependency graph does not.
- **Kill test / first proof:** n/a.

#### Images: a running world as a file
- **What:** Save the entire living object world as an image and resume it elsewhere, including in a browser.
- **How it would work:** Lisp machine saved worlds; Squeak images snapshot all living objects and resume inside the snapshot method; SqueakJS runs unmodified images in a web page.
- **Evidence / numbers:** F: Symbolics Genera 7 manual (1986) on world loading; SqueakJS DLS paper (Oct 2014). [Genera manual](https://bitsavers.trailing-edge.com/pdf/symbolics/3600_series/Site_Maintenance_Genera_7_0_Dec86.pdf); [SqueakJS paper](https://freudenbergs.de/bert/publications/Freudenberg-2014-SqueakJS.pdf).
- **Prior art / who has it:** Symbolics Genera, Smalltalk/Squeak, SqueakJS.
- **Verdict:** Prior art — a decisive qualification to browser-portability novelty claims. It does not migrate sockets, DOM or external processes.
- **Kill test / first proof:** n/a.

#### Continuation-based web servers: suspend across user interactions
- **What:** Write sequential interaction code whose continuation is retained across page requests, possibly serialized to disk or the client.
- **How it would work:** PLT/Racket stateful vs stateless (serializable) servlets; Seaside components with backtracking where a continuation may be invoked repeatedly; Arc/Anarki server-side `fnid` closure tables with expiry.
- **Evidence / numbers:** F: Racket documents serializability limits, untransformed library contexts, and code changes invalidating continuations. F: Seaside (2004/2007) supports multiple invocations. [Racket stateless servlets](https://docs.racket-lang.org/web-server/stateless.html); [Seaside 2007](https://scg.unibe.ch/archive/papers/Duca07a-SeasideIEEE-SCG.pdf); [Anarki srv.arc](https://github.com/arclanguage/anarki/blob/master/lib/srv.arc).
- **Prior art / who has it:** PLT/Racket web server, Seaside, Viaweb/Arc.
- **Verdict:** Prior art (warning kept) — retained control state brings session memory, versioning, inspection, expiry and repeated-invocation semantics. Backtracking a purchase flow cannot undo a committed purchase, and the same applies to forked agent checkpoints.
- **Kill test / first proof:** n/a.

#### Unison: language-level distribution with current infrastructure
- **What:** A `Remote` ability with fork/await and location-aware computations; handlers capture continuations at operation boundaries.
- **How it would work:** The distributed program is separated from the handler/backend. The Volturno case study adds location-aware refs/promises, transactional storage and view-change fencing.
- **Evidence / numbers:** F: described 2023-03-07; Volturno 2025-11-03; Unison Cloud (Nimbus workers, control plane, UI) MIT-licensed on 2026-10-08. [Remote computations](https://www.unison-lang.org/blog/visualizing-remote/); [Volturno](https://www.unison-lang.org/blog/volturno-design/); [Cloud open source](https://www.unison-lang.org/blog/unison-cloud-open-source/).
- **Prior art / who has it:** Unison / Unison Cloud.
- **Verdict:** Prior art — weakens "distributed computation is locked in a closed provider". Sophisticated mobility still needs fencing. There is no evidence of a browser backend or QuickJS interop.
- **Kill test / first proof:** n/a.

#### VM live migration: why it succeeded
- **What:** Move a running VM between hosts with a bounded final pause, with no guest changes.
- **How it would work:** Pre-copy memory while the guest runs, then stop-and-copy. The boundary includes the kernel, so application, kernel and communication state move together.
- **Evidence / numbers:** F: VMware vMotion shipped in 2003 (USENIX 2005); Xen (NSDI 2005) downtime as low as 60 ms (a paper result). I: five aligned factors were a complete boundary, one operator controlling hosts/network/storage/credentials, no rewrite, a recurring maintenance/rebalancing buyer, and an acceptable limited compatibility domain. [Clark et al. 2005](https://www.usenix.org/legacy/publications/library/proceedings/nsdi05/tech/full_papers/clark/clark_html/index.html); [Nelson et al. 2005](https://www.usenix.org/legacy/events/usenix05/tech/general/full_papers/short_papers/nelson/nelson_html/index.html).
- **Prior art / who has it:** VMware vMotion, Xen.
- **Verdict:** KEPT as the model to inherit — the closest successful ancestor is the operator's controlled migration domain plus language-level continuation capture.
- **Kill test / first proof:** n/a.

#### CRIU: process/container checkpoint-restore
- **What:** Checkpoint and restore Linux process state, including TCP connections via `TCP_REPAIR`.
- **How it would work:** It dumps process state through kernel interfaces. TCP restore needs the original IP at the destination; external resources need caller help.
- **Evidence / numbers:** F: CRIU TCP and external-resource documentation. [CRIU TCP](https://www.criu.org/TCP_connection); [External resources](https://criu.org/External_resources).
- **Prior art / who has it:** CRIU.
- **Verdict:** Prior art, not a portable browser format — copying address-space bytes cannot recreate a TCP connection or a mounted filesystem. Do not group it with vMotion.
- **Kill test / first proof:** n/a.

#### Weave: live Wasm migration into and out of browsers (new 2026 comparator)
- **What:** An Apache-2.0 compiler/runtime that migrates executing Wasm across Wasmtime, Node/V8, wazero, WAMR, and Chrome↔native/Chrome↔Chrome.
- **How it would work:** It rewrites module control flow so live locals and control state spill to linear memory at polls (function entries and loop back-edges), with unwind/rewind and pre-copy plus a final transfer. A prepare/commit ownership protocol means an uncertain commit cannot authorise source resumption.
- **Evidence / numbers:** F: repo created 2026-07-03, last push 2026-10-08. These are author claims not replicated here. It rejects shared-memory threads, `externref` and newer features, and says durable failover still needs a coordinator/fencing. [Repository](https://github.com/dphilla/weave); [DESIGN.md](https://github.com/dphilla/weave/blob/main/docs/DESIGN.md); [PROTOCOL.md](https://github.com/dphilla/weave/blob/main/docs/PROTOCOL.md).
- **Prior art / who has it:** Weave (`dphilla/weave`).
- **Verdict:** Comparator — do not claim browser↔server live continuation movement is unimplemented in 2026. Production use, hostile-input resilience and managed tool authority are unproven.
- **Kill test / first proof:** Pin Weave source and run its browser↔native and failure-handoff scenarios locally; compare overhead, state size, unsupported features and what the demos prove vs an await-only interpreter image.

#### Named platforms in 2026: what they do and do not add
- **What:** A re-check of incumbents for any new live-state-transfer contract.
- **How it would work:** Golem uses oplog replay plus optional snapshots, and fork copies history/files. Vercel quickjs-wasi does whole-VM capture with experimental Workflow snapshots. DO hibernation discards memory and reruns the constructor. Workflows has retryable idempotent steps. Container snapshots exclude memory and processes. Wasmer Instaboot is a post-startup snapshot. Fly Machines suspend only *attempts* snapshot resume. Temporal/Restate use history/journal reconstruction with pinned deployments.
- **Evidence / numbers:** F: DO lifecycle docs and Workflows rules updated 2026-10-15; Containers snapshot guide 2026-09-30; Instaboot 2024-06-20; Fly suspend June 2024; Restate versioning article 2026-03-11. [DO lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/); [Fly Machines API](https://docs.fly.io/machines/api/machines-resource); [Restate](https://restate.dev/blog/dealing-with-versioning-in-long-running-agents).
- **Prior art / who has it:** Golem, Vercel, Cloudflare (DO, Workflows, Containers), Wasmer, Fly, Temporal, Restate.
- **Verdict:** No new heap-transfer contract found. Vercel is the close competing mechanism, Golem replay is a substantive competitor, and Fly suspend should not be marketed as cross-host portability.
- **Kill test / first proof:** n/a.

#### Using spare capacity: the four scarcity claims
- **What:** Separate claims that moving programs relieves scarcity of CPU glue, GPU/HBM, data/network/origin, or RAM held by waiting programs.
- **How it would work:** CPU glue can be recovered on idle devices if it offsets interpreter overhead and churn. GPU/HBM is not relieved because weights and KV don't move. Data locality is the classic mobile-agent win but needs a host beside the data. Waiting RAM can be freed by images, but replay, checkpoints and VM suspend substitute.
- **Evidence / numbers:** F-prior: snapshots 1.5–6.4 MB compressed; ~5–11× V8 gap on glue. E: at 10 Mbit/s, 100 KiB = 81.9 ms and 6 MiB = 5.03 s; at 100 Mbit/s, 1 MiB = 83.9 ms. I: a move pays only if saved queueing + avoided transfer + avoided reconstruction + cheaper execution exceeds capture + transfer + restore + coordination + slower execution + verification.
- **Prior art / who has it:** See 01-compute; moonshots2/05-systems.
- **Verdict:** NARROWED — only data locality and late-changing placement after state accumulates survive; "green" needs measured energy.
- **Kill test / first proof:** Compare migration with fresh placement, restart/replay and explicit checkpoints on a workload whose state and best location change; measure useful CPU, latency, bytes, memory and recovery under device loss.

#### Constrained, versioned continuation runtime with brokered effects
- **What:** JS continuations only at documented host-return safepoints, in a versioned interpreter module with bounded memory/instructions/output and a few explicit host operations.
- **How it would work:** A durable broker owns each pending operation by stable ID. The capsule records which inputs reached the guest; the broker records which real effects occurred and who may act next. A browser restore gets fresh, limited authority, not copied secrets. Start with a trusted compatible pool, with opt-in browser participation only for exposable/verifiable tasks.
- **Evidence / numbers:** I: built from the "walls moved in 2026" table (Wasm validated format, browser/edge reach, journals/leases/epochs, content-addressed modules); trust, effects, versioning and economics still block.
- **Prior art / who has it:** VM migration domains; Weave's prepare/commit; Temporal/Restate journals.
- **Verdict:** KEPT (the ONE bet, go-with-changes) — differentiation is an inspectable compatibility/effect contract and handoff experience, not small snapshots or resume-twice (both prior art).
- **Kill test / first proof:** Specify module/ABI hashes, safe suspension rules, pending-op IDs, journal cursor, ownership epoch, branch authority, version transitions, cancellation and uncertain commits; show a stale source cannot issue a real write after handoff.

#### Fork as a policy operation
- **What:** Treat forking as an authority decision as well as a memory copy.
- **How it would work:** The contract decides which branches may write, what they may read, how they are cancelled, and how approvals apply after policy/tool versions change. Simulation branches share recorded inputs; committing one branch fences stale owners without pretending external history rewound.
- **Evidence / numbers:** I, from Seaside/Termite/Racket repeated-invocation history.
- **Prior art / who has it:** Seaside, Termite, JADE `doClone()`, Golem fork.
- **Verdict:** KEPT as part of the bet.
- **Kill test / first proof:** n/a.

#### Rejected in this report
- **"Migration was impossible until Wasm" / technical novelty** — Telescript, D'Agents, Termite, SqueakJS and Weave already did it.
- **Universal market for strangers' idle devices** — owners close tabs, sleep devices and refuse sharing; malicious hosts can falsify results; incentives and verification cost more than the cycles.
- **Automatic GPU relief** — a JS orchestrator moves no weights, kernels or KV.
- **"There were no standards"** — MASIF/MAF existed; the missing piece was a common execution/service/authority contract.
- **"They all died because of security"** — the primary records don't support a single cause; demand, alternatives and ecosystem cost mattered.

### 03-contract: The cross-machine contract: move computation, keep effects at home
Lens: a normative v1 protocol design (all I unless marked) for what may cross machines when a QuickJS/Wasm capsule moves, forks or replays. Headline: the capsule may move its continuation but never its authority or the identity of an accepted operation. One trusted durable home broker owns journal, pending operations, deadlines, grants, approvals and budgets, and executors only hold a fenced right to propose the next turn. ONE bet: build the home-broker, transactional-output version as a 15–20 engineer-day local v1. Verdict: **go-with-changes**, rejecting autonomous offline authority, arbitrary external exactly-once, and trusted return of phone-executed memory.

#### Home broker with three invariants
- **What:** One trusted, durable home broker per run and its branches; executors in Node, browser Workers and Workers/DOs run the same approved QuickJS/Wasm build.
- **How it would work:** Invariants are (1) one authoritative continuation per branch (only the current `(branchId, ownerEpoch, turnId, expectedHead)` may commit); (2) one identity per accepted operation (`callKey`), with replay never sending a request; (3) authority and conserved resources live outside the heap. Home outage suspends progress, and there is no offline authority transfer in v1.
- **Evidence / numbers:** F: builds on the Oct 25 spike (exact-build, empty-stack restore, divergent replies). I: it moves CPU orchestration only, not GPU/HBM/KV or origin services.
- **Prior art / who has it:** Temporal, Restate, Golem v1.6 oplog/fork, E vats, Waterken/Ken, Cap'n Proto/Cap'n Web, E mint/purse, Restate sagas (each mapped to a design consequence in §2).
- **Verdict:** KEPT (core of the ONE bet).
- **Kill test / first proof:** Freeze the four-import profile and envelope; implement bounded capture/import plus one SQLite branch/call ledger and a reference deduplicating sink.

#### Asymmetric trust: trusted servers continue, phones only speculate
- **What:** A trusted server may continue directly from a trusted snapshot; a user-controlled phone may run a speculative copy, but its returned memory never becomes authoritative.
- **How it would work:** A trusted executor independently reconstructs authoritative state (from the last trusted snapshot plus broker-authenticated inputs, or by recomputing) and never overlays phone bytes.
- **Evidence / numbers:** I: integrity-critical CPU work offloaded to a hostile phone must run again on a trusted machine, saving no trusted computation and possibly increasing total CPU.
- **Prior art / who has it:** n/a (TEE attestation and verifiable computation are out of v1 scope).
- **Verdict:** KEPT — deliberately sacrifices CPU-offload benefit for integrity. Useful offload cases are trusted spare executors, user-owned computation under the user's own authority, or proposals with a cheap application-specific validator.
- **Kill test / first proof:** Demonstrate speculative browser-Worker resume with trusted reconstruction on return; measure whether offloaded CPU exceeds transfer plus revalidation cost.

#### Execution and persistence: turns, output barrier, delivery barrier
- **What:** A small deployment (one broker plus SQLite on a trusted Node host; a SQLite DO plus R2 is an alternative adapter) with snapshot-every-turn durability.
- **How it would work:** A turn selects at most one external input, drains jobs with a bounded pump, and returns to the host at WAITING/DONE with no active imports and no unregistered wake source. Imports only stage proposals into a bounded outbox. Before any dispatch or visible output, the broker atomically commits snapshot, applied-input cursor, import trace, outbox intents and reservations; on failure the candidate heap is discarded. Delivery is acknowledged only by the next committed checkpoint. Blobs are written first and hashes published atomically afterward; no SQL transaction is held open during HTTP.
- **Evidence / numbers:** I: minimum tables are runs, branches, turns, events, operations, attempts, observations, grants, effect_permits, budget_accounts, reservations and snapshots, with a hash-chained append-only journal and write-once outcomes.
- **Prior art / who has it:** Waterken/Ken output buffering; Temporal/Restate journals.
- **Verdict:** KEPT — avoids building a partial-turn durability protocol in v1.
- **Kill test / first proof:** n/a.

#### Ownership: epoch-fenced moves; accepted calls stay at home
- **What:** Moves are an atomic compare-and-swap from parked source to reserved target with an incremented `ownerEpoch`.
- **How it would work:** Target admission happens before handoff, and the target starts only after receiving the committed claim; a replacement can get a further epoch from the same checkpoint. A stale source's new turns fail fencing. Leases use the broker's clock. Operations admitted before a move continue in the home dispatcher, and replies go to the home `callKey` ledger. Only trusted connector responses, authenticated callbacks or verified reconciliation may settle an operation; an executor cannot manufacture `resolve(callKey, receipt)`.
- **Evidence / numbers:** I. An epoch is explicitly not an external idempotency key.
- **Prior art / who has it:** Weave prepare/commit (see 02); lease/epoch fencing.
- **Verdict:** KEPT.
- **Kill test / first proof:** Demonstrate trusted Node↔Node moves; show a stale source cannot commit after handoff.

#### Concrete v1 import ABI (`teleport_v1`)
- **What:** Four synchronous, non-reentrant imports (`call`, `clock`, `random_fill`, `log`) with no ambient WASI networking, filesystem, clock or random.
- **How it would work:** `HostRequest` is call/sleep/cancel with a strictly increasing `localId`. The guest surface is `tool(capSlot, method, args)`, `sleepUntil(tick)` and `cancel(localId)`; `Date.now`/`performance.now`/`Math.random` route through imports. Encoding is JCS-canonical JSON (RFC 8785). Import statuses 0–6, where any nonzero status poisons the turn. `callKey = SHA256(JCS(["teleport-call/1", tenantId, runId, originBranchId, localId]))`, with a `requestHash` over method, normalised args, deadline and capability identity; retries cannot change bytes, API version or principal.
- **Evidence / numbers:** I: proposed limits of 64 KiB per request/reply, depth 32, 32 outstanding promises, 64 requests/turn, 256 KiB outbox/turn, 4 KiB/log, 16 KiB logs/turn, 64 KiB random/turn. M: both TypeScript blocks (145 lines) pass `tsc --strict` 5.9.3.
- **Prior art / who has it:** RFC 8785; the spike's WASI imports do not implement this.
- **Verdict:** KEPT (step 1 of the bet).
- **Kill test / first proof:** n/a.

#### Snapshot envelope and import order
- **What:** A signed, hash-bound file format (`TLPT0001`, u32 length ≤ 64 KiB, canonical `SnapshotEnvelopeV1`, gzip memory, canonical host-state JSON).
- **How it would work:** Host state holds next IDs, pending bindings (`localId → callKey`), xoshiro256** RNG state, logical clock and subscription cursors, never sockets or stubs. The header is signed against a preconfigured key registry, and a signature proves the supplier, not the execution. Header fields describe a checkpoint, not current authority. Import order is: bounded decompression → hash/signature/tenant → approved build manifest → home history lookup → ownership/admission → export policy → capability rebinding and reservation → restore → replay tail → authorise live. A fork creates a home-signed child overlay referencing the same memory bytes.
- **Evidence / numbers:** I. The branch head is `SHA256(complete file)`, distinct from the journal tip, which avoids a hash cycle.
- **Prior art / who has it:** xoshiro256** (Blackman/Vigna 2018).
- **Verdict:** KEPT.
- **Kill test / first proof:** n/a.

#### Pending call through move, fork and replay (two state machines)
- **What:** Separate the one real operation ledger from each branch's observation of it.
- **How it would work:** `ATTEMPT_ADMITTED` is pessimistic, so crash recovery yields UNKNOWN. Only definitive provider evidence gives KNOWN_ERROR, and timeouts or 500s do not. A fork child observes inherited calls without a copied dispatcher attempt, cancellation authority or approval. Replay is read-only and stops with `REPLAY_DIVERGED`/`REPLAY_END` on mismatch. The broker's delivery-append transaction is the linearisation point for `Promise.race`. Fork is a deduplicated broker operation on the current committed checkpoint; historical live forks are rejected in v1, and speculative results cannot merge or grant authority.
- **Evidence / numbers:** I (transition table of 9 cases).
- **Prior art / who has it:** Golem fork identity; Temporal command comparison.
- **Verdict:** KEPT — "combining into a single `Promise.pending` flag is the common error".
- **Kill test / first proof:** Fork while a write is pending; two pending replies racing a timer.

#### Logical time, durable timers, and fork entropy
- **What:** Replace device clocks with home-owned logical time and branch-domain RNG.
- **How it would work:** The home keeps `tickMs = max(previous, sampledHomeUtc)`; wall and elapsed time are frozen per turn and recorded for replay. Timers store `dueTickMs`, and a move or fork inherits the absolute due tick, with one `TIMER_FIRED` per timer. Business expiry and `dispatchBeforeUtcMs` are rechecked at admission; a client deadline cannot enforce "must not execute after 17:00". The branch seed is `SHA256(JCS(["teleport-rng/1", rootSeed, branchId]))`, reset at a recorded fork boundary.
- **Evidence / numbers:** F: W3C High Resolution Time (WD 2026-09-01) does not synchronise devices; Temporal durable timers.
- **Prior art / who has it:** Temporal timers; Restate retry-stable random/time.
- **Verdict:** KEPT — "forks diverge" applies only to future runtime-entropy draws, not to copied user PRNGs. Crypto keys and nonces are broker operations. Hard real-time guarantees are rejected.
- **Kill test / first proof:** Replay prefix and child RNG boundaries.

#### Capability rebinding and credentials outside the capsule
- **What:** A `capSlot` is a logical designation that the broker maps to a narrow connector facet; credentials never enter the heap.
- **How it would work:** Arrival authority = creation ceiling ∩ current home policy ∩ destination policy ∩ branch mode ∩ current approvals. A missing required binding rejects the move, with no fallback to a stronger local tool. OAuth tokens, keys, cookies, TLS state and signing keys stay in broker stores, and re-auth yields a fresh ephemeral session. Migration does not clear taint labels or regenerate approvals.
- **Evidence / numbers:** I. Caveat: secrets a program intentionally receives can stay in its heap; no snapshotter can reliably scrub them, so they need export labels.
- **Prior art / who has it:** Object-capability lineage (E, Cap'n Web).
- **Verdict:** KEPT.
- **Kill test / first proof:** Revoked approval; absent optional/required caps.

#### Exactly-once boundary, connector recovery contracts, and business permits
- **What:** Promise one logical accepted operation and one committed outcome per `callKey`. External exactly-once is conditional on the effect sink.
- **How it would work:** The connector contract is set by the broker: retry approved pure reads; get a strong once-per-key effect when mutation and dedup row share a database transaction (the v1 reference sink); reconcile under providers with stable operation IDs and outcome lookup; get conditional dedup within finite idempotency windows (else `BLOCKED_RECONCILIATION`); reject mutation bindings with no dedup (generic SMTP, arbitrary webhooks). A single-use `businessPermit` binds order/amount/recipient so a child cannot charge twice. Permit aliasing maps observers to the original `callKey`. Epoch or attempt numbers never go in provider keys. Sagas get their own `comp:<callKey>:<step>` identity.
- **Evidence / numbers:** F: Stripe v1 retains the first result including 500s, keys can be pruned after ≥24 h, max 255 chars. I: the adapter sends `Idempotency-Key: tp1_<callKey>` (68 chars) and stops resends by 23 h. [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests); [Restate sagas](https://docs.restate.dev/guides/sagas).
- **Prior art / who has it:** Stripe idempotency keys, Restate sagas, Golem's internal-vs-external distinction.
- **Verdict:** KEPT — losing availability by blocking is the safe outcome when the sink cannot resolve ambiguity. Unconditional once-only charging is not promised.
- **Kill test / first proof:** A reference sink: a SQLite HTTP service transactionally inserting `(businessPermit, callKey, requestHash, receipt)` with the mutation, plus a deliberately unsafe endpoint.

#### Conserved budgets
- **What:** Integer account balances at home for fuel, remote cost, egress bytes, storage bytes, outstanding-operation slots and branch slots.
- **How it would work:** The invariant is `issued = spent + reserved + Σavailable`. A move transfers the account reference, and replay never restores balances from a file. A fork debits the parent and credits children in one transaction. Crashed or unverified turns burn the whole fuel reservation; phone fuel reports cannot refund.
- **Evidence / numbers:** I: worked example, 100 units − 20 spent − 10 reserved = 70; three children × 15 leaves the parent 25; the inherited reservation exists once.
- **Prior art / who has it:** E mint/purse.
- **Verdict:** KEPT — closes rollback/fork/refill attacks without a marketplace or proof system.
- **Kill test / first proof:** Stale budget header test.

#### Streams, sockets and reconnect
- **What:** No live transport crosses a snapshot.
- **How it would work:** Fetches are home-owned and fully buffered. TCP/TLS/WebSockets/Cap'n Web tables/host Promises/readers are never snapshotted. A moving executor reconnects and calls `observe(callKey)`/`readEvents(afterEventSeq)`. A resumable stream is a durable broker binding plus cursor, read with `stream.read({afterCursor, maxBytes})` → `{items, nextCursor, eof}`, with `CURSOR_EXPIRED` on loss. Active local streams, exclusive sessions and held locks/transactions are rejected.
- **Evidence / numbers:** F: Cap'n Web tables are session-local and pending calls reject on disconnect. [Cap'n Web sessions](https://github.com/cloudflare/capnweb/blob/main/packages/docs/src/content/docs/guides/sessions.mdx).
- **Prior art / who has it:** Cap'n Proto/Cap'n Web, E offline references.
- **Verdict:** KEPT, scoped to a synthetic broker event-log connector in v1.
- **Kill test / first proof:** Cursor-loss test.

#### Rules table and ten v1 rejection boundaries
- **What:** A move/fork/replay matrix for each held resource, plus ten explicit error classes.
- **How it would work:** The errors are `NOT_QUIESCENT`, `INCOMPATIBLE_BUILD` (no cross-build heap upgrades), `BAD_SNAPSHOT`/`STALE_AUTHORITY`, `UNVERIFIED_CONTINUATION`, `CAP_UNAVAILABLE`/`EXPORT_DENIED`, `UNSAFE_EFFECT`, `RESOURCE_NOT_PORTABLE`, `FORK_AUTHORITY_DENIED`/`BUDGET_EXHAUSTED`, `OFFLINE_AUTHORITY_UNSUPPORTED`/`DEADLINE_UNSUPPORTED`, and `REPLAY_DIVERGED`/`REPLAY_END`.
- **Evidence / numbers:** I.
- **Prior art / who has it:** n/a.
- **Verdict:** KEPT as the v1 boundary.
- **Kill test / first proof:** n/a.

#### Adversarial scenario A: "the charge succeeded, the reply vanished, both laptops woke up"
- **What:** A €40 order-42 payment is charged, the broker crashes before the receipt, and the user moves to B and forks C while A is partitioned; at hour 30 someone proposes a new key.
- **How it would work:** All observers point to the one `callKey`, and A is fenced out. The attempt is recovered as UNKNOWN; only the home dispatcher retries the exact key within the safe window. C has no payment authority (the permit is consumed). At hour 30 the operation blocks for reconciliation and a new key is rejected.
- **Evidence / numbers:** I.
- **Prior art / who has it:** Stripe idempotency semantics.
- **Verdict:** Defended — chooses a visible unresolved payment over a possible duplicate.
- **Kill test / first proof:** Kill-at-every-boundary matrix.

#### Adversarial scenario B: "the phone skips approval, adds money, signs its modified heap"
- **What:** A phone edits a speculative capsule (`approved=true`, `transfer(1_000_000)`, a billion budget) and signs it with its genuine device key plus a forged transcript.
- **How it would work:** The signature proves which device supplied the bytes, not what ran. The broker checks grants, args, permits and balances independently; the authoritative path reconstructs from the last trusted snapshot.
- **Evidence / numbers:** I.
- **Prior art / who has it:** n/a.
- **Verdict:** Defended — but this kills untrusted-phone compute savings for integrity-critical work in v1.
- **Kill test / first proof:** Phone-signed tampering rejection demo.

#### Adversarial scenario C: "rollback for more time and money, then exploit reconnect"
- **What:** Fork 100×, restore an old copy to refill quota, set the clock back a day, and replay stream item 81's side effect on reconnect.
- **How it would work:** Files grant no ownership, so fan-out fails at branch-slot exhaustion. Stale snapshots only replay under capped claims. Home time keeps the timer. The stream restarts at the committed cursor. The ledger key, permit and sink dedup prevent a second effect, or the read returns `CURSOR_EXPIRED`.
- **Evidence / numbers:** I.
- **Prior art / who has it:** n/a.
- **Verdict:** Defended.
- **Kill test / first proof:** n/a.

#### Buildable v1 plan
- **What:** A restricted local research implementation.
- **How it would work:** 3–4 days for imports, reply delivery and envelope; 4–5 for SQLite home, barriers, routing and fencing; 3–4 for fork accounts, RNG, timers and replay; 3–4 for handoff and crash injection; 2–3 for hostile-envelope/authority tests.
- **Evidence / numbers:** E: 15–20 engineer-days (vs the V8 report's 43–73-day hardened architecture).
- **Prior art / who has it:** n/a.
- **Verdict:** KEPT (go-with-changes) — production Cloudflare deployment, untrusted-compute proof, home migration, marketplace rewards and broad connectors are excluded.
- **Kill test / first proof:** Required acceptance checks: kill before/after intent commit, attempt admission, sink mutation, receipt commit, input selection, heap application, checkpoint commit and handoff; assert one sink mutation, one outcome, no duplicate delivery, no stale-epoch outbox; simulate a dispatcher zombie.

#### Rejected in this report
- **Autonomous offline authority / migrating the home to another trust domain** — `OFFLINE_AUTHORITY_UNSUPPORTED`; home outage suspends progress instead.
- **Arbitrary external exactly-once effects** — impossible without sink dedup/transactions or reconciliation; generic SMTP and unkeyed writes are rejected.
- **Trusted return of phone-executed memory** — a device signature is not execution evidence.
- **Cross-build raw-heap upgrades** — `INCOMPATIBLE_BUILD`.
- **Serialized RPC stubs / pipeline graphs / live sockets in snapshots** — session-local and not portable.
- **Strict cross-machine physical monotonic time and provider-unenforced deadlines** — not achievable with this design.
- **Historical live forks / injecting hypothetical results / merging speculative state** — rejected in v1.

### 04-spike: Local teleport hop chain and 100 forks
Lens: a local measurement spike, not an idea list. One QuickJS/Wasm continuation (counter, closure, cyclic object, a live 1/10/50 MiB `Uint8Array`, an unresolved promise) hopped Node → local workerd → headless Chrome → Node and was then forked 100 ways. Headline: all chains and forks matched uninterrupted executions byte for byte, warm 1 MiB hops took single-digit ms, and sparse deltas were ~20 KB, but snapshot size follows heap entropy and browser transfer stalls reached seconds. Bet/verdict: **go-with-changes** for cooperative QuickJS/Wasm teleportation (keep the exact-module/quiescent contract, make ownership durable, use compression/deltas for large state).

#### Result: the live hop chain works
- **What:** Whether one parked continuation can advance its existing awaited promise on four different hosts without rerunning from source.
- **How it would work:** Node parks on request 1; workerd replies 11 and parks on request 2; Chrome replies 22 and parks on request 3; Node replies 33 and parks on request 4; a comparison branch gets 44 and finishes. The program fills and checksums every data byte and mutates one byte on a distinct 64 KiB page per reply.
- **Evidence / numbers:** M: all 18 heap/entropy chain trials and a separate fork-chain trial were byte-identical to uninterrupted Node runs (direct string equality). Each restored hop emitted exactly one next request, never re-emitting the pending one. Example output hash `9da23da9…`. M: Apple M4 Pro, Node 24.22.1, workerd 2026-10-25, Chrome 156 headless.
- **Prior art / who has it:** Oct 25 portability spike (`../portability/02-wasm.md`).
- **Verdict:** Establishes portable cooperative checkpoints across Node/workerd/Chrome for this program. Deterministic integer replies mean this is not an external-effect deduplication test.
- **Kill test / first proof:** n/a.

#### Result: the 16 MiB memory cap blocks large heaps (rebuilt module)
- **What:** Whether the archived module could hold a 50 MiB allocation.
- **How it would work:** The original reactor was run, then rebuilt from copied sources with `JS_SetMemoryLimit(rt,128 MiB)` and `--max-memory=134217728`.
- **Evidence / numbers:** M: the original fails with `InternalError: out of memory`, and raising only the Wasm maximum (32→128 MiB) still fails. Final module SHA-256 `980a38bf…` is used for every final table.
- **Prior art / who has it:** n/a.
- **Verdict:** Shows the old 16 MiB setting blocks large allocations; does NOT qualify allocator accounting as a reliable hard budget.
- **Kill test / first proof:** n/a.

#### Result: capsule format and restore contract
- **What:** The minimum envelope needed to resume.
- **How it would work:** A 32-bit LE header length, then JSON `{format, stack, pending}` (98–99 B), then all linear memory. Restore calls `_initialize`, grows and overwrites memory, restores `__stack_pointer`, and does not call QuickJS `init`. Checkpoints are taken only after `eval_code`/`reply` and job draining return to the host. The immutable Wasm binary is preloaded at each destination and never transferred.
- **Evidence / numbers:** M as described. F: the Wasm spec distinguishes memories, globals, tables and stack, so a memory copy is not generic Wasm serialization. [Wasm runtime structure](https://webassembly.github.io/spec/core/exec/runtime.html); [Workers Wasm](https://developers.cloudflare.com/workers/runtime-apis/webassembly/).
- **Prior art / who has it:** n/a.
- **Verdict:** A restricted checkpoint contract (quiescent boundary plus static table plus exact module) makes the measured subset work.
- **Kill test / first proof:** n/a.

#### Result: snapshot size per hop tracks heap entropy
- **What:** Raw and compressed envelope sizes per outgoing hop for 1/10/50 MiB patterned vs pseudorandom data.
- **How it would work:** Node `gzipSync` level 9 and `zstdCompressSync` level 3 on the full envelope; raw is what was transferred.
- **Evidence / numbers:** M: raw 2,097,250 / 11,403,362 / 53,346,402 B (2.00 / 10.875 / 50.875 MiB + header). Patterned zstd 96,834 / 97,656 / 101,509 B; gzip 105,746 / 142,045 / 304,754 B. Pseudorandom zstd 1,145,411 / 10,585,216 / 52,530,187 B (~50.10 MiB). M: Node codec time for patterned 1/10/50 MiB was gzip 26.71/41.48/123.20 ms vs zstd 0.86/1.77/5.51 ms; pseudorandom 50 MiB gzip 808.33 ms vs zstd 58.36 ms (single sample).
- **Prior art / who has it:** n/a.
- **Verdict:** Rules out "~100 KB" as a fixed snapshot bound; that figure describes a small or compressible working set. zstd is far faster than gzip. Compressed-transfer latency was not measured.
- **Kill test / first proof:** n/a.

#### Result: per-hop serialize / restore / useful-work / HTTP times
- **What:** Source serialization, destination restore, restore-to-next-await, and full loopback HTTP hop time.
- **How it would work:** Raw binary over loopback HTTP. Restore includes header parse, instantiating the precompiled module, `_initialize`, memory copy and stack restore. Patterned 1 MiB n=6 warm (first cold run excluded); others n=3 or n=1. workerd's clock has integer-ms resolution.
- **Evidence / numbers:** M: warm 1 MiB patterned HTTP medians 3.65 / 8.40 / 3.20 ms (Node→workerd / workerd→Chrome / Chrome→Node); restore-to-useful 1.00 / 0.40 / 0.41 ms. 50 MiB patterned HTTP medians 185.60 / 1058.20 / 158.80 ms, with restore-to-useful 8.00 / 20.30 / 5.65 ms. 50 MiB random (n=1) 167.00 / 296.40 / 218.10 ms. M: excluded cold 1 MiB HTTP times 22.22 / 31.70 / 5.60 ms.
- **Prior art / who has it:** n/a.
- **Verdict:** Restore itself is sub-ms to tens of ms; transport dominates large raw hops. Reporting only restore-copy numbers would materially understate handoff latency.
- **Kill test / first proof:** n/a.

#### Result: browser transfer stalls
- **What:** Outliers on the workerd→Chrome leg.
- **How it would work:** Observed within the hop timings above.
- **Evidence / numbers:** M: 50 MiB patterned workerd→Chrome ranged 223–2,941 ms against a 20.3 ms restore-to-useful median. The 1 MiB random control had 857 and 1,693 ms outliers followed by a 7 ms trial (median 856.90 ms).
- **Prior art / who has it:** n/a.
- **Verdict:** Cause not isolated (browser scheduling, GC, HTTP buffering, host contention are candidates, not findings); not attributable to entropy or QuickJS.
- **Kill test / first proof:** Repeat on a separate machine and a constrained browser with more trials to isolate the stalls; measure browser cancellation/eviction.

#### Result: consecutive snapshot deltas are small for sparse updates
- **What:** Size of the per-hop change between consecutive snapshots.
- **How it would work:** Strip headers, compare aligned 4 KiB blocks, and encode each changed block as a 4-byte index plus the block. This is a snapshot scan, not dirty-page tracking. Comparing unaligned whole envelopes is wrong because the header grows one byte and shifts memory.
- **Evidence / numbers:** M: 22 changed 4 KiB blocks per hop in every case = 90,200 raw bytes. zstd ~18.5–19.8 KB patterned and ~22.1–23.0 KB pseudorandom (gzip 19–21 KiB / 22–23 KiB). At 64 KiB page granularity, 5 pages = 327,700 raw bytes, zstd ~33.4–35.7 KB. E: at 100 Mbit/s, 52.53 MB ≈ 4.20 s vs 23 KB ≈ 1.84 ms (10 Mbit/s: ~42 s vs 18 ms).
- **Prior art / who has it:** n/a.
- **Verdict:** Supports small deltas for sparse-update workloads only (one data byte plus allocator/stack/promise churn). Bulk mutation, GC-heavy and shuffled heaps are untested; scan cost was not timed; no delta transport or restore was used.
- **Kill test / first proof:** Transfer and apply real deltas: validate the base hash, rebuild byte-identical memory, time scan+codec+transfer+restore together, and add bulk-mutation/GC-heavy controls.

#### Result: 100 divergent forks from one checkpoint
- **What:** Whether one returned checkpoint can fork into 100 instances that diverge correctly.
- **How it would work:** 100 distinct Wasm instances copy the 1 MiB-data checkpoint at request 4, each gets a reply 0…99, and each is compared to a separately initialised uninterrupted run. Execution is sequential.
- **Evidence / numbers:** M: 100 unique outputs, all matching references (sequence hash `150ad2f7…`). Fork 0 ends with counter 73 and results `[18,40,73,73]`; fork 99 with 172 and `[18,40,73,172]`. M: total 5.025 s sequential; median restore 0.303 ms; median completion after restore 46.49 ms (includes full 1 MiB checksum); per-copy 47.00 ms (43.62–101.86). Logical linear memory totalled 200 MiB.
- **Prior art / who has it:** n/a.
- **Verdict:** Fork correctness established, with prior history and closure state intact. Not a parallel-CPU or parked-density measurement; copy-on-write sharing not implemented.
- **Kill test / first proof:** n/a.

#### Result: boundaries and compute-scarcity implication
- **What:** What the spike does not show.
- **How it would work:** n/a.
- **Evidence / numbers:** M: untested are real remote networks, cross-ISA transfer, phone/browser eviction, engine-version changes, production Cloudflare limits, hostile snapshots, authenticated capsules, real tool effects, leased ownership, arbitrary JS, and interruption inside an active Wasm/C frame. Peak scratch was 127 MiB.
- **Prior art / who has it:** n/a.
- **Verdict:** An HTTP ack or copied resolver does not prove durable exactly-once handoff. It moves CPU interpreter state only and does not relieve GPU/HBM/KV pressure. An idle browser is a destination, not demonstrated trustworthy contributed compute or net energy savings.
- **Kill test / first proof:** Implement the handoff protocol (exact module/ABI hash, authenticated envelope, pending-effect ledger, destination acceptance, source revocation) and inject failures at every acknowledgment boundary.

### 05-product: Teleporting programs: value, buyer, and an honest demo
Lens: product value, buyer and price, tested against incumbents (Cloudflare Workflows/Code Mode, Temporal, Vercel Workflow with QuickJS snapshots, quickjs-wasi, quickjs-rs, XS Sandbox, Golem). Headline: credible value is keeping a generated tool program intact when its next step belongs somewhere else; cheap sleeping is already solved, and most of the nine examined uses do not need a live program. ONE bet: an embeddable agent-platform runtime integration (Bet A), with a conditional local/private-data adapter (Bet B) and a 65-second "the job comes to your data" demo. Verdict: **go-with-changes** for product/demo; **no-go** for a generic "free compute everywhere" pitch.

#### 1. Generated integration code waits three days for approval
- **What:** A generated function reads several systems, builds a reconciliation draft with helper closures, and pauses before proposing a write; the human returns days later.
- **How it would work:** The live image means arbitrary generated lexical state needs no recovery schema and its computational prefix need not rerun. Approval can resume it on any supported host.
- **Evidence / numbers:** E: saving 4–8 engineering hours/month = $600–$1,200/month at an assumed $150/h. F: Cloudflare Code Mode already does abort-and-replay approvals with recorded connector results; Vercel Workflow ships optional QuickJS snapshots (`WORKFLOW_VM=quickjs`, 1,000-event interval). [Code Mode](https://developers.cloudflare.com/agents/tools/codemode/how-it-works/); [Vercel Workflows pricing/limits](https://vercel.com/docs/workflows/pricing).
- **Prior art / who has it:** Temporal, Cloudflare Workflows/Code Mode, Vercel Workflow, Restate, Golem, Postgres job row + JSON.
- **Verdict:** KEPT (#1 near-term integration wedge) — weak standalone novelty; short JSON loops are cheaply replayable.
- **Kill test / first proof:** Demand traces showing replay/schema trouble before selling.

#### 2. A long-running agent hands CPU work to the user's laptop
- **What:** A remote in-progress job continues on the user's eligible device when they open it.
- **How it would work:** The capsule preserves expensive intermediate indexes and a complicated generated continuation across the host change.
- **Evidence / numbers:** E: 1M jobs × 1 cloud CPU-second avoids only $20 of Workers CPU at $0.02/M CPU-ms. F-prior: QuickJS is slower than V8. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
- **Prior art / who has it:** Run JS/Wasm locally from the start, local worker, native helper, cloud workflow with JSON checkpoints.
- **Verdict:** KILLED as a general cost product; retained as an opt-in placement feature — it externalises cost to the user without saving total energy.
- **Kill test / first proof:** n/a.

#### 3. A game or interactive app follows laptop→phone
- **What:** Continue an exact small simulation/puzzle/creative session, including pending interaction and hidden logic, on another device.
- **How it would work:** Small pure-JS simulation state with transient closures resumes without a save schema.
- **Evidence / numbers:** E: avoiding 1–3 weeks of custom save work = $6K–$18K once; disappears if save/version conversion is needed anyway.
- **Prior art / who has it:** Explicit save games/JSON, server-authoritative sessions, CRDTs, remote streaming.
- **Verdict:** RUNNER-UP (attractive visual, uncertain SDK budget) — DOM, GPU textures, audio, sockets and native state don't travel; competitive games can't trust a client heap; no consumer subscription thesis.
- **Kill test / first proof:** n/a.

#### 4. An analysis job moves to a private dataset
- **What:** The first half of a generated job uses remote tools; the second needs data the cloud cannot or should not receive in bulk.
- **How it would work:** The multi-stage program arrives with its plan and intermediate state, binds a newly approved local reader, and finishes there. It must not carry the bulk data, and must not send a post-scan heap back (retained/freed payload leakage).
- **Evidence / numbers:** E: avoiding a 2 GB upload at 20 Mbit/s removes a 13 min 20 s payload floor vs a 3 MB checkpoint in 1.2 s. At $0.05/GB it saves only $0.10/job, so upload friction and private-network access are the real benefit.
- **Prior art / who has it:** SQL/query pushdown, customer-installed worker, browser Wasm/DuckDB, RPC to a local tool, JSON plan dispatch.
- **Verdict:** KEPT (strongest actual relocation rationale; basis of Bet B) — conditional on beating local task dispatch.
- **Kill test / first proof:** See Bet B hard gate.

#### 5. Fork an agent to explore 100 options
- **What:** Expensive shared preprocessing, then 100 independent candidate evaluations from the forked state.
- **How it would work:** Reuse a real expensive prefix with nontrivial hidden state and supply distinct candidate replies.
- **Evidence / numbers:** E: prefix P=$0.10 and suffix S=$0.02 give $12 for independent recomputation vs $2.10 + fork overhead; if cached/JSON state also shares P, incremental savings approach zero.
- **Prior art / who has it:** `Promise.all`, task queues, prompt/result caching, JSON cloning, Golem forks, sandbox/VM forks.
- **Verdict:** RUNNER-UP (useful secondary primitive after measuring prefix cost) — not 100× inference savings; no portable Wasm copy-on-write; speculative writes must be denied.
- **Kill test / first proof:** n/a.

#### 6. Ship a failing agent's exact parked state to a debugger
- **What:** Open a pinned-runtime capsule at the boundary just before a fault, inspect it, feed a recorded reply, and branch hypothetical replies offline.
- **How it would work:** A tool-boundary incident artifact, not reverse single-stepping.
- **Evidence / numbers:** E: one saved 2–4 h incident/month = $300–$600/month/team.
- **Prior art / who has it:** Traces, saved inputs, Temporal replay, tool journals, Golem revert/fork, core dumps.
- **Verdict:** RUNNER-UP (credible runtime feature, weaker first product than approval integration) — external services change, and images may contain customer data or secrets; automatic redaction is unsafe.
- **Kill test / first proof:** n/a.

#### 7. Offline-first field work continues on another device
- **What:** A partially completed generated calculation continues offline, then on another device.
- **How it would work:** Preserve one interrupted local calculation or wizard with explicit single-owner handoff.
- **Evidence / numbers:** E: 2–5 h saved = $300–$750 per incident/integration; recurrence unknown. F: Ink & Switch local-first essay (April 2019). [Local-first](https://www.inkandswitch.com/essay/local-first/).
- **Prior art / who has it:** IndexedDB/SQLite with explicit ops, CRDTs/local-first sync, durable outboxes.
- **Verdict:** KILLED as independent buyer (supplement to CRDTs only) — copying heaps gives no merge or conflict resolution.
- **Kill test / first proof:** n/a.

#### 8. Move work off an overloaded/preempted CPU worker
- **What:** A long multi-stage JS job reaches an I/O boundary before its spot/short-lived worker drains, and resumes elsewhere.
- **How it would work:** Retain a costly prefix during planned drain and resume on a compatible available host.
- **Evidence / numbers:** E: a 10,000 CPU-hour/month pool at $0.05/h = $500, so a 30% placement edge = $150/month gross.
- **Prior art / who has it:** Queue retry, Temporal/Restate/Golem recovery, chunk checkpoints, stateless autoscaling, process/VM checkpointing.
- **Verdict:** KILLED as solo-business wedge (infrastructure feature at existing scale) — no checkpoint during CPU loops; sudden failure loses work since the last checkpoint.
- **Kill test / first proof:** n/a.

#### 9. A job crosses into a customer-controlled runner after authorization
- **What:** A centrally planned task continues inside the customer's runner, where private APIs and credentials live.
- **How it would work:** Retain the generated continuation while swapping its available tools; the destination admits only a declared capability set.
- **Evidence / numbers:** E: eliminating a separate 40–80 h integration = $6K–$12K once, but the secure runner can cost more.
- **Prior art / who has it:** Customer-hosted Temporal workers, self-hosted Golem, outbound connector agents, remote tool RPC, JSON dispatch.
- **Verdict:** NARROWED (expansion of #4, not a separate enterprise platform) — a heap is not authorization; Wasm can't hide data from its host.
- **Kill test / first proof:** n/a.

#### Bet A: agent-platform runtime integration
- **What:** An open embeddable core (checkpoint/restore, pending-call identities, bounded resources, host-adapter conformance, a small approval/effect broker) plus supported browser/Node adapters, sold to runtime leads at small agent-product companies.
- **How it would work:** The commercial unit is a supported production application/workspace, with compute, retained bytes and tool/model charges shown separately. Teams pay only for an integration they can verify but don't want to own (pending effects, placement/authority, old-build recovery, cancellation, budgets, support).
- **Evidence / numbers:** E: $500 scoped pilot, then $250–$500/month per production app; breakeven is 1.7–3.3 h saved/month, target 4–8 h. A 40 h migration ($6K) takes 10 months to recover at $600/month; embedding the first path must take ≤1 day.
- **Prior art / who has it:** quickjs-wasi (if the deliverable is only `snapshot()`/`restore()`, willingness to pay is near zero).
- **Verdict:** KEPT (#1, strongest initial product) — moderate confidence in a useful feature, low in an independent company; no buyer evidence.
- **Kill test / first proof:** Recruit five teams, get two real paused-program traces, offer the paid pilot. Compare a trace against JSON/local dispatch, Cloudflare-style replay and an existing snapshot runtime; stop the standalone claim if a simpler baseline is within 10% with less effort.

#### Bet B: bring a multi-stage job to local/private data
- **What:** The runtime plus a browser/private-runner adapter for integration/analytics-agent vendors losing adoption to slow uploads or unreachable data.
- **How it would work:** Start with one read-only reconciliation pipeline and one destination adapter; sell a supported integration, not universal privacy.
- **Evidence / numbers:** E: $2K fixed pilot, then $500–$1,500/month per vendor workspace. 10 h/month × $150 = $1,500 supports only the low end; no percentage-of-compute billing.
- **Prior art / who has it:** Local JSON-task Wasm workers; browser-owned remote tools.
- **Verdict:** KEPT (#2, conditional product).
- **Kill test / first proof:** Hard gate: compare against "dispatch a JSON task to a local Wasm worker" and "invoke a browser-owned tool remotely"; if either matches latency at lower integration cost with adequate durability, ship that instead.

#### Does compute distribution hold up?
- **What:** Whether relocating the JS program distributes scarce compute.
- **How it would work:** Assessed per bottleneck: CPU orchestration, GPU/HBM inference, data/network, device capacity, region/carbon.
- **Evidence / numbers:** F-prior: 5.2–11.5× slower than V8 on warm fixtures, 31.1× on an integer recurrence; snapshots 1.50 MB (Zod), 2.88 MB (5,000 records), 6.39 MB (retained 6 MiB buffer, not reduced by freeing). E: 1M one-second CPU jobs = $20; 100M × 100 ms = $200. F/E: R2 300 GB (100k × 3 MB) ≈ $4.50/month; 1M park/read pairs ≈ $4.86. F: Chrome freezes/discards hidden pages. [R2 pricing](https://developers.cloudflare.com/r2/pricing/); [Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api).
- **Prior art / who has it:** Host-side model routers.
- **Verdict:** NARROWED — yes for data/authority locality and planned movement to known capacity; no evidence for a scarcity-relieving global compute network; start with customer-controlled devices.
- **Kill test / first proof:** n/a.

#### Demo: "The job comes to your data" (65 seconds)
- **What:** A reconciliation job planned on a separate Node machine parks before reading a locally selected CSV, is restored in the user's browser Worker, and finishes locally with "file upload bytes: 0".
- **How it would work:** Two physical machines on a LAN. Exact module/ABI validation; source frozen and stopped before the destination gets the tool reply. A fresh read-only file capability is bound; bounded row windows stream through the host; results stay local so no second snapshot exports private rows.
- **Evidence / numbers:** E: 5–8 engineer-days for harness and recording. Day one must prove source checkpoint → browser Worker → structured local read → correct result without entry replay. Record ten rehearsals plus one continuous 1× handoff. F: the archived bridge accepts only integer replies, so a structured reply adapter is needed.
- **Prior art / who has it:** v8/05-demo browser→server handoff and file teaser.
- **Verdict:** KEPT — fallback is the 30-second file→fresh-browser restore teaser, withholding the local-data claim. A numeric "42" demo proves a primitive, not reconciliation value.
- **Kill test / first proof:** Acceptance: an unfamiliar engineer runs it; source stopped before delivery; draft changes with the file; original entry not re-evaluated; no tool redispatched.

#### Twitter/X hooks and killing replies
- **What:** Three draft hooks: (1) "This job needed a file on my laptop… No file upload"; (2) "Generated agent code can wait days for approval. Saving its transcript isn't saving its closures"; (3) "A file containing a waiting JavaScript program…".
- **How it would work:** Pre-empt hypothetical expert replies with prior-art links and baselines.
- **Evidence / numbers:** I: the killing replies are "our library already snapshots promises" (Vercel/XS/LangChain), "we already wait without a process" (Cloudflare/Temporal/Golem), "why not replay or JSON?", "run a function near the file", "you moved glue, not weights/KV", "both owners can resume / payment before snapshot", "I can edit the image", and "the phone sleeps; CPU is cheap; QuickJS is slower".
- **Prior art / who has it:** v8/06-signal.
- **Verdict:** KEPT with conditions — hooks 1 and 2 need the new demo to pass; hook 3 matches the existing spike. Show a failed wrong-build restore and a rejected duplicate approval.
- **Kill test / first proof:** n/a.

#### Rejected in this report
- **Marketplace for idle computers** — untrusted devices add verification, secrets, consent and availability problems.
- **Consumer continuity platform** — no generic consumer subscription thesis.
- **Replacement for workflow engines** — incumbents already provide durability without state machines.
- **"Free compute everywhere" / accelerator or green-compute claims** — no-go; JS migration releases no KV/HBM, and CPU glue savings are tiny.
- **Selling bare `snapshot()`/`restore()`** — open alternatives make willingness to pay near zero.
