# Ten concepts, ranked: Sofort × Cloudflare × Goose

Research cutoff: **2026-10-25**. Lane: concept selection for one open-source career project, built by one person in evenings. Read the [brief](BRIEF.md), [primitive 01](../primitive/01-better-x.md), [02](../primitive/02-agent-space.md), [03](../primitive/03-old-research.md), [04](../primitive/04-cloudflare-signal.md), [V1](../../V1.md), [Wasm report](../portability/02-wasm.md), and the requested sections of [demo.md](../../../demo.md), including §9.

**Recommendation: build Capsule, a portable continuation executor for tool programs.** A program reaches an approval, its execution becomes a versioned file, the original executor dies, and the file resumes in a different engine or a browser. Ship a narrow Code Mode integration, a failure harness, and honest cost curves. Use the existing QuickJS/Wasm result; do not put a Goose port, a jitk snapshot implementation, or a workerd fork on the critical path.

**Runner-up: EffectLab, a counterfactual tool-response test bench.** It uses the same primitive but sells a different outcome: reproduce one decision point and test alternative futures without live writes. Choose this packaging if the first week's comparison finds little value in durable execution alone. These are alternative project centers, not instructions to build two products.

## Evidence and scope

- **[S] Sourced:** external documentation or an explicitly attributed existing local result. **[M] Measured in this lane:** none. **[E] Estimated:** arithmetic, design, targets, effort, scores and predictions. A number inherited from another report is **[S-local]**, not a new measurement. Numbered ranks, source-code identifiers, and demonstration timestamps are organizational notation.
- All concepts, demo scripts, hiring assessments and reactions below are **[E]**. Demo timestamps describe a proposed 60-second recording, not measured runtime. “Kenton/Sunil interest” means an audience-fit hypothesis; no one has endorsed a project or promised amplification. A documented limitation is evidence of a gap, not an admission that Cloudflare wants this implementation.
- No deployment, account creation, login, outreach, posting, third-party build, or benchmark was performed. The only intended repository write is this report. The prior spike's `bridge.c`, `snapshot.py`, `restore.mjs`, `summary.json` and Dynamic Worker result still existed in `/tmp/portability-wasm/` when checked; their experiments were not rerun.
- This is an **alternative capstone recommendation**, not a change to the agreed Sofort v1. [V1 §5](../../V1.md) explicitly excludes Wasm, Cloudflare integration and durable continuations. The kernel work in the other session remains independent. Any later implementation experiment belongs in `/Users/noah/code/sofort-spikes/concepts/`, under the brief's rules.

### What can be reused honestly

**[S-local]** The current v1 report records approximately **0.48–0.55 MiB marginal memory per small jitk VM**, on nested KVM. It does not establish a millisecond end-to-end service: latency and CPU targets remain unmet there. Native host-to-host continuation transfer is not shipped. [V1 evidence and limits](../../V1.md).

**[S-local]** The Wasm prototype already parked an unresolved QuickJS promise containing a closure, cyclic object, typed array and Map. Its exact module resumed in Wasmtime, Node, Chromium, local workerd and a local Dynamic Worker. A specimen compressed to **99,854 bytes**; logical memory was **2 MiB**, and small-instance incremental RSS was approximately **0.32–0.38 MiB**, with a substantial shared engine baseline. These are workload-specific local observations, not hosted Workers benchmarks. [Wasm §1 and §3](../portability/02-wasm.md).

The mechanism matters: QuickJS puts the JavaScript continuation in its own heap. The host waits until all Wasm frames have returned, then saves memory, mutable globals and bridge metadata. This is **cooperative checkpointing at a tool boundary**, not arbitrary V8-isolate serialization or arbitrary Wasm-stack capture. Native jitk RAM does not become a Wasm capsule by copying it.

### Goose: the attractive premise needs a correction

**[S]** Goose emits C, has whole-program compilation, share-nothing workers and flat queue payloads, and excludes escaping closures and function pointers. Those are useful ingredients for a compact data-processing runtime. They are not evidence of an existing wasm32 backend or checkpoint ABI. [Goose README](https://github.com/aardappel/goose).

**[S]** The specification distinguishes flat values from references and slices; its C representation still includes ordinary addresses, resizable-value headers and data-stack control pointers. Therefore “all live Goose state is pointer-free” is false. A blocked C call also has control state beyond its payload. [Goose specification, §1.1 and Appendix C](https://github.com/aardappel/goose/blob/master/docs/goose_spec.md).

**[S]** Goose already exposes framed byte images and checked loading for appropriate data structures. Building another serializer is weak novelty. **[E]** For a Goose actor MVP, export an explicit `handle(state, message) -> (newState, effects)` entrypoint, return before persisting, and pin the format/compiler. That preserves actor data, not a suspended function. Saving a live Goose computation needs a separate state-machine transformation, Asyncify-like mechanism, or a qualified whole-Wasm checkpoint. [Goose reference, binary images](https://github.com/aardappel/goose/blob/master/docs/reference.md).

## Prior-art floor: the claims we cannot make

These comparisons apply to every concept; each concept identifies its closest overlaps below.

- **Golem [S]:** automatic durability uses a host-interaction log; ordinary computation is replayed. Its documentation also covers application snapshots and actual agent forks at the current execution point. “Durable ordinary code,” “fork an agent,” and “no repeated model call during replay” are occupied claims. The narrow possible distinction is a small, independently transportable opaque execution image across stock engines, with a measured no-recomputation restore. Do not assume Golem cannot reproduce the application outcome. [Durability](https://learn.golem.cloud/v1.6/concepts/durable-execution), [snapshotting](https://learn.golem.cloud/v1.6/develop/snapshotting), [forking](https://learn.golem.cloud/v1.6/develop/forking).
- **Cloudflare [S]:** Code Mode already persists connector results and approvals and supports deterministic replay. Dynamic Workflows runs runtime-loaded tenant code with durable workflow machinery. Durable Objects already provide identities and durable databases; hibernation discards the JavaScript heap. Container snapshots explicitly exclude memory and processes. None of that establishes an available generic export of a paused execution to a browser. [Code Mode mechanics](https://developers.cloudflare.com/agents/tools/codemode/how-it-works/), [Dynamic Workflows](https://blog.cloudflare.com/dynamic-workflows/), [DO lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/), [Container snapshots](https://developers.cloudflare.com/containers/guides/snapshots/).
- **Temporal / Restate [S]:** durable workflows, keyed state, waits and recovery already exist. A checkpoint project must justify preserving opaque execution state rather than using their application programming models. [Temporal execution](https://docs.temporal.io/workflow-execution), [Restate services and virtual objects](https://docs.restate.dev/foundations/services).
- **E2B / Hyperlight [S]:** E2B preserves memory and processes when paused. Hyperlight is an embeddable microVM runtime; Hyperlight-Unikraft also documents Linux runtime support and warm snapshots. Small hardware execution, native compatibility and memory persistence are not individually new. [E2B persistence](https://docs.e2b.dev/sandbox/persistence), [Hyperlight](https://github.com/hyperlight-dev/hyperlight), [pinned Hyperlight-Unikraft README](https://github.com/hyperlight-dev/hyperlight-unikraft/blob/5f14d1e73039f2cfb4928766586cfe75a87301ad/README.md).
- **Unison / Erlang / Lunatic [S]:** distributed code and data mobility, supervision, isolated actors and Wasm processes all precede this project. [Unison](https://www.unison-lang.org/), [OTP supervision](https://www.erlang.org/doc/system/sup_princ.html), [Lunatic](https://github.com/lunatic-solutions/lunatic).
- **wasmCloud / Fermyon Spin [S]:** portable Wasm applications and capability-mediated services are established. wasmCloud's documented components keep state with providers; Spin supplies a serverless Wasm framework. A new language wrapper around either model is insufficient differentiation. [wasmCloud components](https://wasmcloud.com/docs/v1/concepts/components/), [Spin](https://github.com/spinframework/spin).

## Cost arithmetic used in the concepts

**[S]** R2 Standard list rates are **$0.015/GB-month**, **$4.50/million Class A operations**, **$0.36/million Class B operations**, with no Internet egress bandwidth fee. Workers Standard overage rates include **$0.30/million requests** and **$0.02/million CPU-ms**; the paid subscription has a minimum. DO billing includes requests, duration and database storage/operations. These are different meters; small Wasm RSS does not reduce the DO's billed memory allocation. [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

**[E, arithmetic]** At the specimen's **99,854 bytes**, one million distinct checkpoints occupy **99.854 decimal GB**, giving **about $1.50/month in blob storage** before allowances and rounding. Creating each once and reading each once adds nominal operations of **$4.86**. This is neither a measured cloud bill nor a complete service cost. Compression is already reflected in the specimen; do not compress that estimate again. Manifests, shared images, journals, retained history, DO activity, compute and inference are additional.

**[E, sensitivity]** At **1 MiB/checkpoint**, the same million becomes **about $15.73/month** in storage; at **10 MiB**, **about $157.29/month**. Rewriting a million small checkpoints daily changes the operation cost radically even if retained storage stays flat. Publish checkpoint frequency and object count alongside size. At a hypothetical **10 CPU-ms/wake**, one million wakes use **$0.20** of Workers Standard CPU overage at the quoted rate, excluding every other meter; this is a unit illustration, not a prediction of Capsule's CPU cost or Dynamic Worker pricing.

**[E]** An honest local release can measure bytes, CPU, requests and recovery behavior and feed them into a dated price calculator. It cannot claim measured global Workers scale, cloud latency, placement, or an invoice without a permitted hosted experiment. This research authorizes no such experiment.

## Ranking method

All scores are **[E]**, from **1–5**, higher is better: **N**ovelty, **D**emo, **E**ngineering depth, **F**easibility in solo evenings, **C**loudflare fit, and **K**ill-risk **inverse**. **K=1** means easily obsoleted or crushed by prerequisites; **K=5** means relatively resilient. Novelty is the remaining implementation/product distinction after naming prior art, not a claim of invention.

Weighted score **[E]**: `0.20N + 0.15D + 0.20E + 0.20F + 0.15C + 0.10K`. Feasibility and substantive work matter more than a viral title. NativeGate and Wander tie numerically; NativeGate ranks ahead because it uses more built machinery. Effort estimates below assume reuse of existing artifacts, approximately **15–18 focused hours/week**, no team, and a research-grade open-source release rather than a supported hosted service.

1. **Capsule — portable Code Mode continuations:** **4.30/5**. N4 D5 E5 F4 C5 K2. **Build.**
2. **EffectLab — fork one decision point into test futures:** **4.20/5**. N4 D5 E4 F4 C5 K3. **Runner-up; alternate packaging.**
3. **Crashpack — an executable incident attachment:** **4.00/5**. N3 D4 E4 F5 C4 K4. **Best fallback if time gets tight.**
4. **Goose Cells — flat-state actors on Durable Objects:** **3.65/5**. N3 D4 E4 F3 C5 K3. **Interesting compiler/runtime experiment; weaker user demand.**
5. **RunGit — version control for paused execution:** **3.55/5**. N3 D5 E4 F3 C4 K2. **Good Capsule interface; weak separate project.**
6. **NativeGate — a native tool coprocessor for Workers:** **3.40/5**. N2 D4 E5 F3 C4 K2. **Strong systems work, crowded thesis.**
7. **Wander — move a computation to approved data:** **3.40/5**. N4 D5 E4 F2 C3 K2. **Too much trust/placement scope.**
8. **Goose Scatter — typed share-nothing Workers:** **3.20/5**. N2 D4 E4 F3 C4 K2. **Useful port, largely familiar semantics.**
9. **PocketCloud — a computer per user for “$0”:** **2.90/5**. N2 D5 E3 F3 C3 K1. **Reject the headline and the platform scope.**
10. **LiveCaps workerd extension — serialize live isolates:** **2.80/5**. N3 D3 E5 F1 C3 K1. **Reject for this time budget.**

## 1. Capsule: continuations as an application-level Cloudflare primitive

**Pitch:** Save a tool program at `await`, kill its owner, and resume the same execution in a different Wasm engine without rerunning its prefix.

**What remains new:** The engineering contribution is a versioned, independently readable capsule ABI plus a tested ownership protocol across Node/Wasmtime/workerd/browser. Cloudflare's [approval replay](https://developers.cloudflare.com/agents/tools/codemode/how-it-works/) and [Dynamic Workflows](https://blog.cloudflare.com/dynamic-workflows/) recover the business operation already; [Golem](https://learn.golem.cloud/v1.6/concepts/durable-execution) is the closest semantic competitor. [E2B](https://docs.e2b.dev/sandbox/persistence) preserves a much broader environment. The proposed distinction is the small portable artifact and recovery without redoing opaque computation, not the existence of persistence. No verified global-first claim is warranted.

**60-second demo:** 0–12s: a program builds an indexed dependency graph, captures it in a closure and asks for approval. 12–25s: download its capsule; display measured bytes and zero live execution instances. 25–38s: kill the executor and restart the local DO controller. 38–50s: approve and resume in local workerd. 50–60s: resume a read-only fork in a Chromium tab; show an unchanged prefix-execution counter and divergent correct output. Label every runtime local.

**Scale/cost headline:** “A million paused computations would occupy about **100 GB** on this small fixture; blob storage approximately **$1.50/month**” **[E]**, with the full cost exclusions above. Measure **10,000 distinct locally produced capsules [E target]**, not copies of one hash, and restore every one under bounded concurrency. Actual cloud scale remains unmeasured. A restore benchmark must include decompression, initialization/caching, policy and persistence separately.

**Depth / effort:** Capsule invariants, a capability-safe boundary, durable checkpoint publication, ownership epochs, stale-resume rejection and cross-engine differential tests. **[E] 4 weeks, 64–72 hours**, conditional on the existing spike reproducing; **5–6 weeks** if packaging/integration slips. One unresolved call, one pinned interpreter build and one small tool schema. Full concurrent pending-call graphs are excluded.

**Cloudflare reaction / kill:** Strong Kenton hypothesis if the talk centers on durable authority and stale owners; strong Sunil hypothesis if the demo is one import and a visible host kill. It fills the documented heap-loss distinction, not an unfilled approvals feature. A first-party portable continuation executor would substantially kill the wedge. Startup snapshot [PR #7880](https://github.com/cloudflare/workerd/pull/7880) is relevant roadmap pressure, but describes bootstrap reuse rather than this live export.

**Career value:** The best combined evidence for runtime, distributed-systems and developer-platform roles: code reviewers can inspect a small protocol, break it, and rerun the benchmarks. Strong enough to discuss beyond Cloudflare. Score: **N4 D5 E5 F4 C5 K2**.

## 2. EffectLab: fork the agent's next tool result

**Pitch:** Pause one tool-using program before a consequential decision, inject alternative replies into identical execution state, and compare proposed effects with writes disabled.

**What remains new:** A usable counterfactual test fixture that includes the actual continuation and a strict effect broker, rather than only prompt/trace replay. [Golem forks](https://learn.golem.cloud/v1.6/develop/forking) defeat “first forkable agent”; [Temporal histories](https://docs.temporal.io/encyclopedia/event-history) already support replay-based testing. Cloudflare's [Code Mode](https://developers.cloudflare.com/agents/tools/codemode/how-it-works/) already retains tool history. The distinction is one portable decision fixture that runs against multiple policy/tool contracts across engines. It does not rewind a remote service or clone an LLM provider's hidden state.

**60-second demo:** A renewal agent has parsed a real-sized contract fixture and is waiting for a pricing/permission response. Fork it into **32 branches [E demo target]** with price changes, stale versions, denials and malformed replies. Show which branches request unauthorized writes. Change one broker rule; rerun and watch the forbidden proposals disappear. Export a failing branch for reproduction in a browser. Use recorded model output; include no implication of free inference.

**Scale/cost headline:** “One prefix, **1,000 alternative replies [E target]**.” With prefix CPU `P`, suffix CPU `S`, branch restore cost `R` and branch count `B`, compute saved over replay is approximately `(B−1)P−BR` **[E model]**. If `P=100 ms`, `R=1 ms`, `B=1,000`, the saving is **98.9 CPU-seconds [E scenario]**, before capture and scheduling. Measure the actual values and include cheap-prefix cases. Cached API/model calls are already reused by replay and are not extra savings.

**Depth / effort:** Branch identities, deterministic reply scheduling, effect-proposal traces and actionable differences. **[E] 4–5 weeks, 65–85 hours**, reusing the spike; no general eval platform or connector catalog. “Promote a branch” means reauthorize and issue its proposed actions against current resource versions; there is no generic atomic world commit.

**Cloudflare reaction / kill:** Good Sunil/Agents demo; Kenton interest depends on demonstrating authority isolation rather than a tree animation. It complements the [Think](https://blog.cloudflare.com/project-think/) direction. High competition from native agent eval and fork features; narrower contract-testing usefulness survives better than generic branching.

**Career value:** Particularly good for agent infrastructure and reliability teams. Less kernel depth than Capsule, more immediate engineering utility. Score: **N4 D5 E4 F4 C5 K3**.

## 3. Crashpack: the bug report that is a running program

**Pitch:** Attach a compact failing execution to an issue; the maintainer opens it locally and resumes at the bad tool response, without credentials or a production account.

**What remains new:** A deliberately small interoperability/debugging artifact containing an opaque guest continuation, exact runtime identity and a recorded tool boundary. [Temporal replay](https://docs.temporal.io/encyclopedia/event-history), [Golem's log recovery](https://learn.golem.cloud/v1.6/concepts/durable-execution) and ordinary trace fixtures already reproduce many failures. The remaining value is preserving a difficult internal state and removing the original deployment requirement. It is also closely related to traditional record/replay; do not call executable bug reports a new invention.

**60-second demo:** A parser/agent fails only after building a complex graph and processing a particular tool reply. Click “export incident,” stop the original app, open the artifact in an offline local browser viewer, and reproduce the failure. Replace only the bad reply and show the successful suffix. Display the first divergent host request. The runtime and original source remain pinned; this does not patch a live heap into a new interpreter.

**Scale/cost headline:** “An executable attachment under **256 KiB [E target]** for the small fixture.” At the **99,854-byte [S-local]** specimen size, **10,000 reports [E scenario]** need about **1 GB**, approximately **$0.015/month [E]** of R2 blob storage. Real incidents can be much larger. Measure attachment-size distribution and replay success, not just the smallest example.

**Depth / effort:** Artifact validation, failure isolation, deterministic fixture execution and a good format inspector. **[E] 3–4 weeks, 45–60 hours**. Local files and a browser viewer suffice; DO/R2 adapters are optional. Export only synthetic or deliberately shareable fixtures: arbitrary memory redaction can corrupt the image, so “automatic safe redaction” is outside scope.

**Cloudflare reaction / kill:** Lower spectacle, strong maintainer empathy. Relevant to Workers/Agents SDK debugging without claiming Cloudflare cannot diagnose its own platform. A native execution-bundle debugger competes, but an open interchange fixture remains useful.

**Career value:** Most likely to finish cleanly and earn a detailed technical review. Good reliability/developer-tools signal across APAC teams. Score: **N3 D4 E4 F5 C4 K4**.

## 4. Goose Cells: a flat-state actor on each Durable Object

**Pitch:** Compile a Goose handler to Wasm; each DO stores its compact state blob and executes one deterministic message transition at a time.

**What remains new:** Primarily a Goose runtime/ABI port and a measured state-layout experiment. [DOs](https://developers.cloudflare.com/durable-objects/), [Restate virtual objects](https://docs.restate.dev/foundations/services), [Erlang supervision](https://www.erlang.org/doc/system/sup_princ.html) and [Lunatic](https://github.com/lunatic-solutions/lunatic) already establish the actor model. [wasmCloud](https://wasmcloud.com/docs/v1/concepts/components/) already supplies capability-mediated Wasm logic. Goose's flat values could reduce encoding and state bytes; DO transactions provide durability. **This is explicit-state persistence, not saved Goose stacks.** The novelty score stays modest until a nontrivial benchmark shows a real advantage.

**60-second demo:** Run a turn-based auction with **1,000 local actors [E target]**; corrupt one message and show its actor rejecting it while others progress. Evict/recreate controllers and recover from stored flat state. Compare the same application state as JSON and a hand-packed TypeScript binary structure. Show the latter comparison even if Goose loses. Fork one actor's data to compare bidding policies.

**Scale/cost headline:** **1 million × 1 KiB = 1.024 GB [E scenario]** of payload, about **$0.205/month [E]** at the DO SQL storage overage rate, before database overhead, requests, writes, minimums and allowances. This is not a million active DOs benchmark. Small state does not lower each active DO's billed duration allocation. Measure state size, handler CPU and cold module overhead.

**Depth / effort:** wasm32 C-runtime adaptation, checked binary ABI, explicit effects/outbox and inbox deduplication. **[E] 4–6 weeks, 70–100 hours** if a state-only Goose program compiles promptly. Native queue/thread support is not portable to Workers unchanged; [Workers threading limitations](https://developers.cloudflare.com/workers/runtime-apis/webassembly/) require replacing it with host dispatch. Kill the project if this becomes compiler surgery.

**Cloudflare reaction / kill:** Plausible Kenton interest as a clean non-JS DO example; Sunil might amplify a compact actor demo. It fills language reach rather than an absent actor capability. First-party Wasm-component/DO language tooling could absorb it.

**Career value:** Strong compiler/embedding sample, weaker broad adoption story because users must choose a new language. Score: **N3 D4 E4 F3 C5 K3**.

## 5. RunGit: Git for running programs on R2

**Pitch:** Commit a paused computation, branch it, inspect its tool history and check out a runnable continuation.

**What remains new:** A content-addressed DAG whose nodes include an executable continuation and effect lineage. [Golem forking](https://learn.golem.cloud/v1.6/develop/forking), [E2B persistence](https://docs.e2b.dev/sandbox/persistence) and [Unison's content-addressed code/data model](https://www.unison-lang.org/) already cover important pieces. An R2 object named by a hash is not an invention. The useful addition would be a rigorous, portable runtime artifact plus meaningful branch inspection. “Merge two live heaps” is not available; merging proposals must be application-specific.

**60-second demo:** `commit`, `branch conservative`, `branch aggressive`, then inject different replies. Kill the process, `checkout` either branch in another engine, and show its locals and proposed effects. Diff source identity, call history and proposals; show raw memory hashes as opaque data, not a fake semantic heap diff. A branch never rewinds external writes.

**Scale/cost headline:** “**1,000 branches [E scenario]**, one immutable base.” If a measured full image is **100 KiB** and a measured branch delta is **4 KiB**, storage would be approximately **4 MiB rather than 98 MiB [E]**, excluding manifests and history. Neither delta size nor compression ratio is measured here. Many tiny page objects can cost more in operations and reads; pack each checkpoint's deltas rather than doing an R2 PUT per dirty page.

**Depth / effort:** Integrity, immutable publication, parent lineage, retention/garbage collection and reconstructible deltas. **[E] 5–6 weeks, 80–100 hours** for a useful constrained CLI; a safe general store plus browser UI is larger.

**Cloudflare reaction / kill:** Good visual hook, but likely to be read as a storage/UI layer over snapshots. It complements R2; first-party execution snapshots plus artifact tooling could erase most of the story. The interesting part is already Capsule's core.

**Career value:** Good storage-systems artifact if the GC and corruption story are excellent. Less focused than the winner; keep `export/import/fork` and postpone Git vocabulary. Score: **N3 D5 E4 F3 C4 K2**.

## 6. NativeGate: Workers call a tiny native computer

**Pitch:** Keep orchestration on Workers and run a narrowly supported native static tool in a fresh jitk VM on an external ARM host.

**What remains new:** An unusually small, measured hardware executor and a convenient Cloudflare adapter, rather than a new sandbox category. [Hyperlight](https://github.com/hyperlight-dev/hyperlight) and [Hyperlight-Unikraft](https://github.com/hyperlight-dev/hyperlight-unikraft/blob/5f14d1e73039f2cfb4928766586cfe75a87301ad/README.md) are serious direct comparisons. [Cloudflare Containers](https://developers.cloudflare.com/containers/) and [Spin](https://github.com/spinframework/spin) cover native/container and Wasm alternatives. Do not repeat the outdated assertion that Hyperlight cannot support Linux runtimes. The supported syscall/tool profile must earn the integration.

**60-second demo:** A Worker-shaped client submits a batch of hostile JSON inputs. Each file gets a fresh hardware VM running an already-supported native `jq` profile. Show bounded timeouts and byte-identical results against Linux, with malicious inputs contained. Compare batching and full client-to-host elapsed time with a Wasm build and an available container baseline. Label the client and fleet local in this research release.

**Scale/cost headline:** **1,000 × 0.5 MiB ≈ 500 MiB [E arithmetic from S-local small-VM slope]**, excluding tool working sets, shared bases, VMM/controller overhead and host capacity. This is not measured parser-fleet memory or a throughput claim. The **256 MiB minimum predefined Container size [S]** is configured/billed capacity; comparing it to marginal jitk RSS is not a matched physical-memory result. [Container limits](https://developers.cloudflare.com/containers/platform/limits/).

**Depth / effort:** ABI, quotas, deadlines, byte streams and host authorization. **[E] 4–6 weeks, 70–100 hours**, conditional on the other session's v1 work landing; otherwise an adapter alone is not a shippable sandbox. Do not take over or modify that kernel work for this lane.

**Cloudflare reaction / kill:** Good Sunil purpose-built-computer fit; weaker first-party fit because the external host adds RTT and operations. Generic tool execution is not a gap Cloudflare has left open. Cheaper Containers or improved Wasm ports can eliminate the benefit without replicating jitk.

**Career value:** Very high low-level systems signal, but the most compelling engineering is the existing Sofort project. It is a poor reason to begin another project. Score: **N2 D4 E5 F3 C4 K2**.

## 7. Wander: carry computation to the data, then home

**Pitch:** Move a paused computation between approved execution sites so it can work beside private data and carry only its continuation/result onward.

**What remains new:** Capability-rechecked execution mobility on stock Wasm engines with explicit site policy. [Unison](https://www.unison-lang.org/docs/usage-topics/general-faqs/) already supports distributed computing abstractions, and [wasmCloud](https://wasmcloud.com/docs/v1/concepts/components/) distributes portable components. Shipping code to data is older still. The possible distinction is moving an already-started opaque program plus a verifiable handoff protocol, without a common hosting platform. User-controlled destinations are never trusted merely because their output has a hash.

**60-second demo:** Build partial graph-analysis state in a local worker, pause, move it into a second local process with an exclusive read-only dataset, then return a derived summary to a browser. Show original capability IDs failing at the destination until reauthorized. Display exactly what data enters the capsule; secrets and derived sensitive data do not disappear when computation migrates.

**Scale/cost headline:** **10 GB dataset versus a 100 KiB capsule ≈ 98,000× fewer transferred payload bytes [E scenario]** if the dataset is already present at the destination and the result is small. Include module transfer, fetches, replies and actual bytes on the wire. This does not imply the same factor in time or money, and R2's no-egress-fee model may remove the supposed bandwidth bill advantage.

**Depth / effort:** Transfer integrity, explicit source relinquishment, destination policy, tool rebinding and result provenance. **[E] 6+ weeks, 100–140 hours** for something credible; a staged three-process demonstration is easier but does not prove locality management. Workers does not grant an application arbitrary physical placement just because it holds a capsule.

**Cloudflare reaction / kill:** Kenton could care about the capability protocol; Sunil could like the live movement. The gap is not publicly established placement demand. It may conflict with Cloudflare's existing placement strategy or be unnecessary once tool calls already execute beside data.

**Career value:** Strong distributed-systems interview material, substantial risk of a research demo without a user. Defer. Score: **N4 D5 E4 F2 C3 K2**.

## 8. Goose Scatter: share-nothing Goose workers across Queues

**Pitch:** Compile separate Goose worker entrypoints to Wasm and route flat typed jobs through Workers and Queues, with explicit retries and deduplication.

**What remains new:** A genuine Goose distributed backend and clear binary message ABI, if implemented. [Erlang/OTP](https://www.erlang.org/doc/system/sup_princ.html), [Lunatic](https://github.com/lunatic-solutions/lunatic), [wasmCloud](https://wasmcloud.com/docs/v1/concepts/components/) and [Spin](https://github.com/spinframework/spin) make share-nothing Wasm workers familiar territory. Across a network, `memcpy` is only the local encoding step; dispatch, transport and billing remain. Native Goose blocking queue calls require an asynchronous host protocol or returned batch jobs, not a literal thread API replacement.

**60-second demo:** Split a terrain/simulation fixture into deterministic tiles, distribute work, inject duplicates and a poison job, restart consumers and reproduce the final hash. Compare the same algorithm with a batched Rust/Wasm or TypeScript worker. Keep one coordinator and fixed worker kinds; no Erlang replacement or general scheduler.

**Scale/cost headline:** A million small jobs normally mean **3 million Queue operations [S behavior; E workload]** before retries. At **$0.40/million operations [S]**, that is nominally **$1.20 [E]** before included allocations, compute, DO coordination and storage. Batching handler invocations does not erase per-message operations. [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/). Measure encoding bytes and completed jobs/CPU-second locally; hosted throughput remains unmeasured.

**Depth / effort:** wasm32 port, typed job framing, bounded fan-out and at-least-once delivery semantics. **[E] 5–6 weeks, 80–100 hours**, contingent on a small Goose-to-Wasm port. The compiler/runtime port can absorb the whole budget.

**Cloudflare reaction / kill:** Useful ecosystem example and perhaps a Sunil demo, but no major admitted capability gap. Existing queue consumers already do the hard distribution work; Goose needs a convincing CPU/encoding advantage.

**Career value:** Broadly understandable distributed backend sample, less unique than the portable-continuation story. Score: **N2 D4 E4 F3 C4 K2**.

## 9. PocketCloud: a computer per user for “$0”

**Pitch:** Every user gets an addressed, sleeping tool program stored as a blob, with execution allocated only when an event arrives.

**What remains new:** Retaining the actual suspended continuation for a narrow program; the rest is an existing [DO](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)/[Restate virtual-object](https://docs.restate.dev/foundations/services)/[Golem](https://learn.golem.cloud/v1.6/concepts/durable-execution) model. [Cloudflare Computer](https://blog.cloudflare.com/cloudflare-computer/) directly occupies the personal execution-environment framing. A database row is usually better if a user's state is already a few fields. The phrase “computer” must not imply shell, browser, package installation or arbitrary native software.

**60-second demo:** Create **10,000 local sleepers [E target]**, discard every Wasm instance, restart the process and wake a random displayed user in another runtime. Show state complexity, snapshot bytes and local memory returning toward baseline. Then reveal the honest bill components. A million generated IDs or copied blobs is not a million running-program test.

**Scale/cost headline:** Zero retained execution instances while sleeping is measurable; **$0 total cost is false**. The small-fixture million is about **$1.50/month [E]** in blob storage alone. Free tiers can hide low-traffic charges, not eliminate resource use or establish scalable economics. Wake rates, history, DO duration, inference and retention dominate different workloads. [R2](https://developers.cloudflare.com/r2/pricing/), [DO billing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

**Depth / effort:** **[E] 3–4 weeks, 45–65 hours** for a preset local demo using the Wasm spike; **months [E]** for a trustworthy multi-tenant personal-computer platform. The count makes an effective benchmark scene inside Capsule, not a sufficient project purpose.

**Cloudflare reaction / kill:** Likely “we already do cheap dormant objects,” unless the heap is visibly the point. The largest social hook has the weakest technical positioning and the most first-party overlap.

**Career value:** Risks looking like pricing theatre. Replace the title with measured “bytes per paused computation,” then use it as supporting evidence. Score: **N2 D5 E3 F3 C3 K1**.

## 10. LiveCaps: an open-source workerd continuation extension

**Pitch:** Add a runtime API that exports and restores a live Worker execution, including pending capability calls.

**What remains new:** If truly achieved, a major embeddable-runtime capability. But [workerd PR #7880](https://github.com/cloudflare/workerd/pull/7880) already develops startup snapshot consumption; initialized-state reuse is not this project. Existing [Code Mode replay](https://developers.cloudflare.com/agents/tools/codemode/how-it-works/) is the practical substitute. A wrapper around QuickJS/Wasm can provide the narrow behavior, but then this is Capsule with a workerd adapter, not generic live-V8 serialization.

**60-second demo:** In the ambitious version, stop at a pending RPC, kill the original runtime and restore its Worker elsewhere with correct stubs. A startup-only snapshot or JSON application checkpoint must be labeled accordingly. A real demonstration must account for host objects, promises, stream state, binding/session identity and resources outside V8's heap.

**Scale/cost headline:** **[E target, not a forecast]** export a small execution in **under 1 MiB** and restore under **10 ms** locally. There is no honest basis for promising these figures or a hosted cost advantage before an implementation. Measure full engine memory and pinned-version restrictions, not only serialized blob size.

**Depth / effort:** **[E] 3–6+ months, hundreds of hours** for even a tightly constrained genuine live-isolate feature; engine and workerd knowledge are prerequisites. An upstream-sized startup snapshot, WASI or resource-lifetime fix may fit weeks, but that is a different project and should be selected with maintainers' actual needs.

**Cloudflare reaction / kill:** Kenton would inspect the correctness constraints closely. A credible small upstream fix can be valuable; an unsupported generic-snapshot promise is more likely to expose inexperience. The runtime owner has both architectural advantage and active adjacent work. A fork also creates a maintenance liability.

**Career value:** Highest theoretical engineering ceiling, lowest chance of a finished hiring artifact this month. Explicitly reject. Score: **N3 D3 E5 F1 C3 K1**.

## Winner specification: what Capsule actually ships

### One project, one narrow promise

**[E]** A tool program can cooperatively yield, export its opaque QuickJS/Wasm continuation, and resume on another supported engine with the same pinned module. The external controller decides whether it may resume or issue effects. It can fork into a read-only test branch. The release proves that promise with failure injection and a reproducible matrix.

The launch claim should be: **“I turned a paused tool program into a portable file. It survives losing its executor and can finish in your browser.”** “Cloudflare primitive” describes an application-level library/example, not a new supported platform API or an endorsed product.

**[E]** Proposed components:

- A small capsule library: `start`, `poll`, `export`, `import`, `resume`, `forkReadOnly`, `cancel`. Export contains format/build hashes, compressed memory, exported mutable globals, logical pending-call ID/digest, execution/branch/owner epoch, and environment/budget metadata. Native compiled caches are not portable artifacts.
- A pinned QuickJS/Wasm reactor with a deliberately small import allowlist and an enforceable execution budget. End a run that cannot reach a checkpoint; do not promise arbitrary preemption plus persistence. Browser execution belongs in a dedicated Worker so the host can terminate it.
- Node and local workerd adapters as the required execution pair; a browser read-only viewer is the memorable handoff. Wasmtime conformance is an additional check using the existing artifact, not a rewrite of its host in a new language.
- One local DO controller owns the durable lifecycle record; local R2 bindings hold immutable blobs. Keep authority records in transactional storage. Upload the blob first, then atomically publish its hash in the controller. A crash can leave an orphan blob; it must not leave a published missing checkpoint. Maintain the existing owner until handoff is durably acknowledged.
- A Code Mode `Executor` adapter for runs that complete, plus a separate explicit lifecycle API for durable park/resume. The existing executor Promise is not a durable receipt. Do not silently route a parked run back through Code Mode's abort/replay runtime, which would replay the prefix and undermine the promise. Pin the upstream interface and state the integration limit. [Executor contract audited by the prior research](https://github.com/cloudflare/agents/blob/321814b6c13f72cff82161e7eb20312574ac9b7a/packages/codemode/src/executor-types.ts).

**[E]** Do not build a personal cloud, scheduler fleet, language, generic heap debugger, package registry, connector marketplace or full Computer filesystem backend. Do not implement jitk snapshots here. Do not make Goose compilation a dependency; the flat-state experiment is a later optional benchmark only if it can be timeboxed without changing the result.

### Correctness that makes the project worth hiring for

**[E]** Permit one unresolved guest call in the first release. Checkpoint only after Wasm returns, job draining finishes and the controller has a consistent pending-call record. Multiple concurrent tools, races, socket/stream handles and externally held JS objects are rejected rather than partly captured.

**[E]** Give each transfer an incrementing owner epoch. Every effect dispatch checks the current epoch and current permission at the broker; an old executor cannot dispatch after transfer or cancellation. The capsule's content hash proves integrity, not authorization. Importing bytes or knowing their hash gives no write authority. Browser forks can compute and propose effects; the server must not accept a browser's claimed computation as trusted evidence. Rebind logical tool handles under fresh policy; never restore a live Cap'n Web session ID as authority. [Cap'n Web's session/object-capability model](https://github.com/cloudflare/capnweb).

**[E]** For mutating tools, persist stable effect IDs and prepared/dispatched/completed/delivered states. In the demo, use one idempotent test service with a durable counter keyed by effect ID. An ambiguous non-idempotent dispatch becomes `needs-reconciliation`; it is not silently retried. Revoking an epoch cannot undo a request that was already accepted externally. This is the explicit boundary of the guarantee, not universal exactly-once execution.

**[E]** Copying a guest's random state is correct for reproducing its suffix. Host effect IDs, branch IDs and grants must nevertheless be fresh and branch-aware. Track guest clocks/randomness under a stated profile; record reply delivery order. Reject a capsule with a mismatched module hash, schema, capability contract or memory bound. Patching an interpreter means old capsules need their old build or explicit migration/replay; no transparent live-image upgrade is promised.

## Four-week build plan for Capsule

Every task, duration and acceptance threshold here is **[E]**. Total **64–72 focused hours**. The plan assumes the existing spike can be archived and reproduced promptly. All implementation stays outside the repo under the brief's constraints; use local-only Cloudflare bindings and fixtures throughout. No hosted proof is required or implied.

### Week 1 — prove the wedge before building infrastructure (16–18 hours)

1. Inspect and archive the existing spike sources, module, hashes and raw results. Read scripts before execution; isolated Python invocations use `-I`. Reproduce the closure/cycle fixture from Node into local workerd, then terminate the original Node process before resuming.
2. Turn the implicit snapshot assumptions into a short ABI checklist: immutable module, exported mutable globals, static tables, no active frames, one pending call, fixed imports and exact environment metadata.
3. Build matched replay and explicit-state baselines for two realistic tool programs: incremental dependency-graph analysis, and a parsed rule/index preparation followed by approval. Include a cheap arithmetic/control fixture. The replay baseline reuses all recorded tool/model results. Measure prefix CPU, snapshot/compression cost, restore CPU, state bytes and authoring complexity.
4. Produce a CLI that starts, parks, exports and resumes a capsule in a fresh process; wrong-build imports fail closed. No UI yet.

**Milestone:** a rerunnable host-kill demonstration and the falsification result below. **Stop the durable-executor product pitch if the wedge fails.** Do not spend the next three weeks decorating it. Keep Crashpack as a smaller artifact if only debugging is compelling.

### Week 2 — make ownership and effects survive failure (18–20 hours)

1. Implement the local DO lifecycle record and immutable R2-blob publication. Define `running → parked → resuming → running/completed`, plus cancelled/failed/reconciliation states. Return a parked receipt; do not leave a DO awaiting a guest promise while it sleeps.
2. Add epoch fencing, exact pending-call digests, cancellation and fresh authorization. Read-only branches receive their own lineage and cannot dispatch writes.
3. Implement the one-tool effect ledger and idempotent counter service. Inject process crashes before/after blob upload, lifecycle publication, effect dispatch, result persistence and reply delivery. On restart, reject stale callbacks and duplicated approvals.
4. Add a Code Mode adapter/example with its lifecycle limitation documented; demonstrate that the prefix is not replayed through another layer.

**Milestone:** restart both executor and local controller, resume once, and demonstrate that a stale owner is denied. For the supported idempotent service, the externally visible prefix write stays at one. For the deliberately unsupported service, surface reconciliation instead of inventing a result.

### Week 3 — earn portability and scale claims (15–17 hours)

1. Finish the dedicated-browser-Worker viewer: import, inspect metadata, supply a synthetic reply, resume and terminate. No production write capabilities. Repeat the same fixture against Wasmtime using the existing host if compatible.
2. Run the cross-engine fixture corpus: closure, cycle, Map, typed array, controlled clock/random state, thrown error and rejected tool promise. Test cancellation and corruption as well as successful restore. Record engine versions and module digest.
3. Produce **10,000 distinct capsules [E target]** with varying actual program state; discard live instances; restore all under fixed concurrency. Record failures, actual unique bytes and restored-instance counts. Add larger **1 MiB and 10 MiB live-state cases [E test sizes]** so the small example does not stand in for everything.
4. Publish CPU/latency distributions, compression cost, peak process memory and engine baseline, end-to-end local park acknowledgement and resume time, operation counts and dated price projections. Separate cold module compilation from warmed restore.

**Milestone:** a machine-readable evidence bundle and passing supported-runtime matrix. If resources prevent the intended count, publish the achieved count; do not extrapolate it into a measured fleet. If a second physical machine/ISA is unavailable, mark cross-ISA support untested.

### Week 4 — ship a reviewable open-source artifact (15–17 hours)

1. Cut to the minimal package: capsule library, reactor build recipe, local Cloudflare example, CLI, browser viewer, conformance fixtures and benchmark harness. Include dependencies/licenses and reproducible artifact hashes; choose the repository license explicitly rather than implying ownership of bundled runtimes.
2. Add a short architecture/limitations document and a “break this” command that repeats the crash windows. Pin interpreter and upstream integration versions. Check memory/input bounds and demonstrate a tight-loop termination case.
3. Record the proposed 60-second host-kill/handoff video with all local/runtime labels visible. A scale panel reports completed measured runs; its price panel says estimate. Record the cheap-replay case as well as the favorable case.
4. Prepare the launch post and one-page hiring packet. The release is ready for the author to publish later; this research and build plan do not authorize posting or outreach. Leave no “global scale” assertion dependent on a cloud experiment that never happened.

**Milestone:** a clean local setup reproduces park, kill, transfer, read-only fork and stale-owner denial from one documented command, plus downloadable raw evidence. If the budget slips, cut delta storage, decorative UI and extra adapters first; retain ownership/failure tests and the replay comparison.

## Falsification: the early result that should stop us

**[E] Primary stop test, by the end of week 1:** On the two representative fixtures, compare the same observable results under Capsule, recorded-result replay, and explicit-state recovery. Use the same inputs and tools; count local computation separately from API/model costs.

Stop Capsule as a durable-execution product if **both** hold:

1. Replay or explicit state is as easy to integrate for these workloads and its full recovery cost is within **2× [E decision threshold]** of capsule recovery after including capture, compression and storage work at the actual pause frequency; and
2. Exporting the live opaque state to a different engine provides no concrete workflow/debugging benefit beyond running the original source with recorded replies.

Those thresholds are selection rules, not benchmark results. One contrived heavy loop is insufficient to pass. A retained parser/index or genuinely awkward internal state must justify the mechanism. As a positive bar, aim for at least one natural fixture with **≥3× less recovery CPU [E target]** or a convincing eliminated application serializer, while showing the workloads where capsules lose.

**[E] Independent technical stop conditions:** the original spike cannot be reproduced in the first **two evenings**; arbitrary guest work cannot be bounded without blocking the controller; quiescence cannot be determined reliably; or exporting a valid checkpoint depends on unrecorded external references. Freeze scope and publish findings rather than creating an engine project.

**[E] Week-2 stop condition:** an old owner or read-only fork can dispatch an unauthorized new effect, or the supported idempotent service repeats a committed write during the specified crash windows. Do not launch a durability guarantee until corrected. An ambiguous unsupported external write may correctly halt for reconciliation; that is a pass for the stated contract, not a hidden failure.

**[E] Strategic kill condition:** if Cloudflare or Golem can already export the same class of opaque continuation into stock browser/workerd runtimes, with no prefix replay and equivalent ownership semantics, the claimed interoperability gap disappears. Reposition as an integration/conformance contribution or stop. A startup snapshot, JSON application snapshot or replay-based fork alone does not establish that equivalence.

## Launch post outline

**[E] Working title:** “I saved a running tool program to a file, killed its executor, and finished it in a browser.”

1. Lead with the host-kill clip and the exact continuation line. Give the one-command local reproduction immediately.
2. Explain the narrow problem with a real fixture: rebuilding opaque preparation state across an approval, and handing an execution to another engine. State that ordinary workflows and replay remain the better default for many scripts.
3. Explain the mechanism in plain language: JavaScript continuation inside QuickJS, QuickJS inside Wasm, empty Wasm stack at the checkpoint, bytes plus the host ledger. This is an interpreter-backed runtime, not serialization of arbitrary V8 execution.
4. Show measured evidence: versioned fixture inputs, bytes before/after compression, park/restore CPU and p50/p95/p99 with sample counts, full process memory and shared baseline, failure outcomes and the actual portability matrix.
5. Show the price model with operation counts, active-compute assumptions and checkpoint-size sensitivity. Keep the million-sleepers calculation labeled **estimate**. Explain why idle memory is not a total agent bill and why inference is unchanged.
6. Name the nearest prior art before a reader does: Golem for automatic durability/forking, Cloudflare Code Mode replay and Dynamic Workflows, E2B memory persistence, Hyperlight for hardware execution. State the exact smaller claim.
7. Give the correctness section equal billing: immutable publication, stale-owner rejection, revoked grants, branch-specific authority, idempotent service versus reconciliation. Link the adversarial harness.
8. Finish with a bounded contribution invitation: try a hard fixture, report a broken restore or improve an adapter. Mention the separate jitk hardware tier as existing related work; do not imply it can import these Wasm bytes as native RAM. No acquisition pitch.

## Career strategy, including APAC/Kuala Lumpur

**[E]** Optimize for a technically credible conversation with a runtime or distributed-systems team, not a retweet count. The strongest hiring packet is a short video, a compact implementation whose invariants fit on a page, a reproducible failure harness, and a cost model that survives hostile review. A maintainer can evaluate that asynchronously across time zones.

**[S]** Kenton's coauthored [Cap'n Web introduction](https://blog.cloudflare.com/capnweb-javascript-rpc-library/) establishes a capability/RPC interest; [Project Think](https://blog.cloudflare.com/project-think/) establishes Sunil's agent-runtime involvement. **[E]** Capsule's authority-preserving transfer is the most relevant Kenton angle; a working Code Mode example and a clear handoff demo are the Sunil angle. Neither source supports predicting a retweet, an opening on their team, or an acquisition.

**[E]** Make the portfolio usable for Workers/runtime, Agents, reliability and developer-platform applications generally. Be explicit about wishing to work from KL/APAC; location and employment eligibility are separate from project merit. I did not verify a current KL-based Cloudflare runtime opening, and the fetched jobs page did not provide enough information to establish one. Use the actual role's permitted locations when applying; a global careers page does not establish “remote from anywhere.” [Cloudflare current jobs entrypoint](https://www.cloudflare.com/careers/jobs/).

**[E] Final selection:** Capsule wins on the conjunction of reusable measured machinery, a visceral demonstration, a small reviewable correctness protocol, and direct Cloudflare integration. Its defensibility is limited and must be admitted. EffectLab is the runner-up because it offers a concrete engineering use even when replay is sufficient for durability. Goose Cells deserves a later narrowly timed spike; it should not turn this month's career artifact into a compiler/runtime rewrite.
