# Value gaps: who gets value, what blocks them, and whether there is a wedge

Research date: **2026-10-28**. Scope: the value side of the complete [product gap table](../../PRODUCT-GAPS.md), especially Program reach and Linux feature parity. Research only: no deployments, accounts, purchases, outreach, benchmarks, VM access, commits, or changes outside this report.

Evidence labels: **F** = sourced fact or explicitly attributed vendor/user claim; **M** = an existing repository measurement, not remeasured here; **I** = inference or recommendation; **E** = estimate, hypothetical workload, or proposed acceptance threshold. All web sources were checked on 2026-10-28; undated pages below mean the live documentation on that date. Prices exclude tax, negotiated discounts, model/tool charges, network and storage unless specified. Engineer-days mean one engineer familiar with this repository. Estimates are not quotations or commitments.

## Decision

**I — There is no demonstrated commercial wedge yet.** The best candidate is an **embedded, locally operated backend for short, mostly unique JavaScript code-mode programs, beside an existing trusted tool broker, where the operator specifically requires a hardware boundary**. The buyer would be a platform engineer inside an agent or automation product, rather than the end user of that product. The narrow job is running generated glue code, not giving an agent a general computer.

**I — Prioritize payload parity and an independently runnable integration over more Linux breadth.** A 1 KiB tool-result ceiling obstructs the central code-mode job today. Missing timers are optional for a deliberately small execution contract. The 261 stdout failures are a genuine byte-transport limitation of one path, but are not 261 customer use cases. AArch64-only sharply limits drop-in embedding; the evidence does not establish what fraction of buyers it loses.

**F/I — The strongest commercial number is a tariff, not a performance victory:** Cloudflare charges $0.002 for each newly created Dynamic Worker per day; one-shot loading counts once per invocation. At one million unique programs, that is approximately **$2,000 of creation charges**, before inclusions and other usage. That makes discovery with high-uniqueness code-mode operators worthwhile. It does not prove jitk wins: repeated-code caching, open-source QuickJS/Wasm, and Hyperlight can erase the opportunity. [Cloudflare pricing, updated 2026-06-11](https://developers.cloudflare.com/dynamic-workers/pricing/).

**I — The evidence supports open source as distribution, an embedded library/backend as the conditional product, and a strong CV capstone regardless of sales.** It does not support funding a hosted sandbox service before an external operator supplies a workload and a reason the established libraries cannot serve it.

## 1. What changed since the pitch reports

This builds on [demo.md](../../../demo.md), [pitch 01](../pitch/01-value-audit.md), [02](../pitch/02-hosting-landscape.md), [03](../pitch/03-agentic-coding.md), [04](../pitch/04-scale-and-economics.md), and the positioning/demo proposals in [05](../pitch/05-twitter-pitch.md), [06](../pitch/06-demo-spectacle.md), [07](../pitch/07-demo-practical.md), [08](../pitch/08-demo-narrative.md), [09](../pitch/09-demo-virality.md). The related code-mode finding in [flip2/04](../flip2/04-codemode.md) remains relevant: the valuable unit of authority is one program, and intermediate data can remain outside model context. That benefit belongs to code mode generally, not uniquely to jitk.

| Earlier statement or proposed story | Current evidence and its consequence |
|---|---|
| Low-latency Linux execution was still an optimization target | **M:** latest nested-KVM one-tool executor result is **1.10 ms p50 / 1.86 ms p99**, with **1.72 CPU-ms/run** including Node, shard and watchdog. Multi-slot throughput is bimodal under nesting. This replaces older 9–10 ms Mac / 39 ms shard figures for this exact Linux path; it is neither a metal result nor a remote API result. [2026-10-28 copy-restore results](../../jitk/bench/RESULTS-copy-restore-2026-10-28.md). |
| jitk might have a decisive memory advantage over Hyperlight | **M:** measured small-run marginal memory is about **0.5 MiB/VM**, approximately parity; Hyperlight is around 4% lower for return2, with lower fixed process cost. Neither language support nor a large workload inherits that footprint automatically. [2026-10-27 memory comparison](../../jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md). |
| A fresh VM is destroyed and recreated for every timed run | **F/M:** the shard reuses a KVM slot after restoring pristine guest memory/registers and installing fresh per-run state. The older Mac process lifecycle differs. Say **fresh guest state per run in a hardware VM**, and explain slot reuse; do not imply a new KVM object/host process on every call. [Copy-restore lifecycle](../../jitk/bench/RESULTS-copy-restore-2026-10-28.md), [R7 restore/RNG contract](../../jitk/shard/RESULTS-R7-rng.md). |
| SQLite cannot yet read a real database; binary output still needs inventing | **M:** the separate Linux native mode already has byte streams and base64 MCP results; **82/82 exact tuples across 41 cases** match the Linux reference, including SQLite database queries, jq bytes, gzip/zstd, stderr and nonzero status. The old SQLite growth video is now a retrospective, not a new product unlock. [R7 bytes results, 2026-10-25](../../jitk/shard/RESULTS-R7-bytes.md). |
| Only a tiny synthetic program subset runs | **M:** the phase-2 grown kernel runs **3,198/3,947 comparable compiled scriptc programs, 81.0%**, byte-identically to Linux; 180 path-sensitive builds are excluded. This is a much stronger growth demonstration, not broad Node/Python/Linux compatibility. [Phase-2 corpus, 2026-10-27](../../jitk/scriptc-corpus/RESULTS-PHASE2.md). |
| Determinism is an actual differentiator today | **F/M:** the restore path deliberately reseeds randomness; the RNG receipt reports 10,000 distinct initial samples across 10,000 restores. Freshness is implemented; complete deterministic replay is not established. A replay contract must bind time, entropy, tool replies and completion order. [RNG results](../../jitk/shard/RESULTS-R7-rng.md). |

**F/I — Two older landscape statements are stale:** [landscape.md](../landscape.md) and [cloudflare.md](../cloudflare.md) describe Dynamic Worker creation billing as waived; the current tariff is active. Their “Hyperlight cannot do native Linux” framing is also too broad: [Hyperlight-Unikraft](https://github.com/hyperlight-dev/hyperlight-unikraft) is a direct compatibility competitor. Its documented host calls remain synchronous; that warrants a matched async-tool experiment, not a claim that its whole ecosystem is slower. [Call contract, live](https://github.com/hyperlight-dev/hyperlight-unikraft/blob/main/docs/calls.md).

**F — The current readiness evidence remains adverse.** R9 documents the payload/source/timer differences, lack of shard OS confinement, shard-controlled deadline authority, an error path capable of terminating the shared channel, setup depending on hand-created files, and the separate serial native lifecycle. The brief's review path resolves to [arch/review/R9-ARCH-QUALITY.md](../../review/R9-ARCH-QUALITY.md), especially N1, N5, N6 and R7 carry-overs. A fast normal return does not remove these product blockers.

## 2. What the current alternatives cost

### Rate card: primary sources, checked 2026-10-28

**F:** rates and billing semantics below are provider statements. **I:** the last column identifies the purchasing implication. Configured memory, resident bytes, concurrency quotas and active host density are different quantities.

| Alternative | Published price and important unit | What the operator is buying / implication |
|---|---|---|
| **E2B** | $0.000014/vCPU-s + $0.0000045/GiB-s, running time; Pro **$150/month + usage**. Default listed shape is 2 vCPU/4 GiB, or **$0.1656/hour** by arithmetic. Hobby includes a one-time $100 credit. [Pricing](https://e2b.dev/pricing). | A full environment, SDKs and managed operations. Cheap short runs can cost less than replacing its integration. |
| **Daytona** | **$0.0504/vCPU-hour + $0.0162/GiB-hour**; storage $0.000108/GiB-hour after 5 free GiB; pricing page says per-second billing and $200 initial compute. [Pricing](https://www.daytona.io/pricing), [billing](https://www.daytona.io/docs/billing). | 1 vCPU/1 GiB is $0.0666/hour before disk. Default Linux containers and dedicated VM classes are distinct; do not equate their startup claims. |
| **Modal Sandboxes** | **$0.00003942/physical-core-s** (one physical core = two vCPUs), minimum 0.125 cores; **$0.00000667/GiB-s**. Sandbox rates differ from ordinary Functions. Billed per second on max(request, actual usage). [Pricing](https://modal.com/pricing), [resource contract](https://modal.com/docs/guide/sandbox-resources). | 0.5 physical core + 1 GiB is $0.094968/hour. Correct units matter more than quoting the cheaper Functions tariff. |
| **Vercel Sandbox** | Default-region active CPU **$0.128/vCPU-hour**, provisioned memory **$0.0212/GB-hour**, creations **$0.60/million**. Each vCPU includes 2 GB. Memory has a **one-minute minimum increment**. Hobby allowances; Pro usage draws on its $20 monthly credit. [Pricing and quotas](https://vercel.com/docs/sandbox/pricing). | CPU waiting on tools is unbilled; repeatedly allocating a separate short sandbox can still incur the memory minimum. Reusing a session changes the calculation. |
| **Cloudflare Dynamic Workers** | Paid Workers plan; new code/ID combination **$0.002/Worker/day**; additional requests $0.30/million and CPU $0.02/million CPU-ms. Same ID/code can be reused; one-shot load counts each invocation. [Pricing, 2026-06-11](https://developers.cloudflare.com/dynamic-workers/pricing/). | Strong substitute for JS code mode; unique generated programs can be expensive even when CPU is cheap. |
| **Cloudflare Containers / Sandbox** | $5 Workers Paid plan; additional active CPU **$0.000020/vCPU-s**, provisioned memory **$0.0000025/GiB-s**, provisioned disk **$0.00000007/GB-s**; metered every 10 ms, with included usage. [Pricing, 2026-10-05](https://developers.cloudflare.com/containers/platform/pricing/). | Full Linux option with active-CPU billing. A small guest is not the only route to low I/O-wait CPU charges. |
| **Lambda Event Functions** | US East ARM duration **$0.0000133334/GB-s**, x86 first tier $0.0000166667/GB-s, requests **$0.20/million**; allowances apply. [AWS pricing](https://aws.amazon.com/lambda/pricing/). | Extremely cheap trusted function dispatch. Execution environments can be reused, so the ordinary invoke price does not purchase a new isolation boundary for every untrusted program. |
| **Lambda MicroVMs** | US East Graviton worked examples publish **$0.0000276944/vCPU-s + $0.0000036667/GB-s**, baseline resources billed while running; snapshots and transfer extra. Default baseline 1 vCPU/2 GB is about $0.1261/hour. [AWS pricing, MicroVM examples](https://aws.amazon.com/lambda/pricing/). | A closer full-VM substitute. ARM64 is explicitly supported; arm64 itself is not proof of an unsellable platform. [Quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html). |
| **Fly Machines** | Current public pricing selector shows shared-cpu-1x/256 MB **$0.0030/hour ($2.19/month)**; billed per second while started; volume/egress separate. Regional docs show different rates, so quote the selected region before a purchase. [Current pricing](https://fly.io/pricing/), [regional resource pricing](https://fly.io/docs/about/pricing/). | A cheap general machine to amortize a worker pool. Shared CPU and a full performance core are not equivalent. It is not a remotely hosted sub-millisecond function service. |
| **Prime Sandboxes** | **$0.02/vCPU-hour + $0.0125/GiB-hour + $0.0002/GiB disk-hour**; no subscription/minimum spend; page says rates valid through December 22. Its example 1 vCPU/1 GiB/5 GiB is **$0.0335/hour**. [Primary product/rate page](https://primeintellect.one/sandboxes). | Cheap full-VM infrastructure with RL integrations. Another reason not to infer high willingness to pay from rollout volume alone. |
| **Judge0** | Shared-cloud page currently shows **€27/month for 2,000 submissions/day**, €54 for 5,000/day, €107 for 10,000/day; €0.001 per extra submission. Self-hostable open source, with infrastructure/operations remaining the user's cost. [Pricing/product](https://judge0.com/). | Buyers can buy grading/API convenience and 60+ languages cheaply. A runtime must replace a meaningful part of that complete job. |
| **Embedded runtimes** | Vercel Labs run is **Apache-2.0**; Hyperlight and Extism are also open-source alternatives with no hosted per-call bill for self-operation. [run repository](https://github.com/vercel-labs/run), [Hyperlight](https://github.com/hyperlight-dev/hyperlight), [Extism](https://github.com/extism/extism). | Hosting and integration still cost money. Competing with a library means proving why the additional VM machinery is needed, not undercutting a cloud tariff. |

**F — Pricing ambiguity to retain:** Daytona exposes both established and v2 documentation with different shapes/billing descriptions. This report uses the public pricing page plus the main billing documentation, not an inferred universal minimum. Fly's marketing selector and regional documentation also differ. Neither ambiguity is permission to select the most expensive interpretation for a comparison.

### A million short runs: sensitivity, not a fabricated head-to-head bill

**E:** assume one million independently isolated runs/month; 1 ms useful guest compute; ignore free tiers, plans, storage, transfer and all integration labor initially. These are deliberately different service contracts, not equivalent performance results.

| Scenario | Arithmetic | What it establishes |
|---|---|---|
| Cloudflare, unique code/ID each run | Approximately **$2,000 creation charges**, plus request/startup/execution charges; inclusions reduce this | A concrete high-uniqueness discovery signal, not a general Workers cost disadvantage. [Tariff](https://developers.cloudflare.com/dynamic-workers/pricing/). |
| E2B, 2 vCPU/4 GiB, **one billed running second** per run | **$46 usage**, plus the applicable plan | Even a one-second allocation per tiny job can be cheap. One second is a scenario, not a verified provider rounding minimum; include create/cleanup time from real invoices. [Rates](https://e2b.dev/pricing). |
| Daytona, 1 vCPU/1 GiB, one billed second | **$18.50 usage**, plus disk | Cost alone will rarely justify a bespoke runtime at low volume. Same caveat about actual billed lifetime. [Rates](https://www.daytona.io/pricing). |
| Modal, 0.5 physical core/1 GiB, one billed second | **$26.38 usage** | Model actual resource bursting/reservations, rather than calling this a fixed universal per-run price. [Rates](https://modal.com/pricing). |
| Vercel, separate 1-vCPU/2-GB sandbox for every run, one minute memory charge each | Memory **$706.67**, creation **$0.60**; 1 ms active CPU/run adds **$0.0356** | The minimum can dominate. Session reuse and included credits change it materially. [Pricing](https://vercel.com/docs/sandbox/pricing). |
| Lambda Event, 128 MiB ARM, 1 ms billed duration | Approximately **$0.2017** including requests, before free tier | The cheapest-looking dispatch number does not establish fresh untrusted-program isolation. [Pricing](https://aws.amazon.com/lambda/pricing/). |
| jitk measured execution component | **M/I:** 1.72 CPU-ms × one million = **1,720 CPU-s = 0.478 CPU-hours** | A resource quantity, not an invoice, sustained-throughput proof or metal result. [Measured scope](../../jitk/bench/RESULTS-copy-restore-2026-10-28.md). |

**E/I — Why “a nickel” does not prove a business:** multiplying that last CPU quantity by a hypothetical $0.05/core-hour gives about **$0.024/million**. This excludes idle hosts, fixed host runtime memory, usable capacity, tool execution, retries, operations and labor. At an illustrative $500 engineer-day, one maintenance day exceeds the modeled E2B usage saving by an order of magnitude. A real switching calculation is:

**avoided provider bill + value of needed boundary/placement − host bill − integration and maintenance labor − extra failures/support.**

**I — Billing granularity matters most when each run needs independent freshness.** Batching 1,000 programs into one existing full-Linux sandbox can amortize overhead, but it must supply the required boundary between those programs. Compare against the cheapest alternative meeting that requirement. Never assume the buyer currently buys one full VM per test case.

## 3. Ranked segments: jobs, evidence of pain, payment, blockers

**I:** rank is near-term suitability for this solo engineer's actual runtime, not total market size. The first two overlap organizationally: “code-mode executor” identifies a workload owner; “agent platform” describes the broader product and budget. No named organization below has expressed interest in buying jitk.

### 1. Code-mode tool executors inside an existing product

**Job / buyer — I:** execute model-written JS that fans out to approved business tools, joins/filter results, and returns a compact answer. The product already has authentication, tenant-aware tools and a model loop. The buyer is its platform/backend owner; the desired unit is an executor backend, not another agent framework.

**Current solution and cost — F:** Cloudflare's Code Mode has exactly this architecture: generated code calls provided methods, with outbound access blocked through the executor configuration. The documented custom Executor seam is the natural integration point. Alternatives include the free run library, workerd/Wasm, or a small slice of E2B/Daytona/Modal usage priced above. [Cloudflare example, updated 2026-05-05](https://developers.cloudflare.com/dynamic-workers/examples/codemode/), [Executor interface](https://github.com/cloudflare/agents/blob/main/docs/agents/codemode.md).

**Pain evidence — F:** Anthropic's 2025-11-24 programmatic-tool-calling article illustrates 20 users with 50–100 expense lines each, reducing large intermediate data to a small final result. It reports 37% average token reduction on its complex research tasks. This is evidence for processing tool data inside a program, not for choosing jitk. The same article explicitly says simple small lookups benefit less. [Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use). A real self-hosting issue reports workerd RSS growth under continuous load and asks for controllable memory budgets; that is one user's report, not a general Cloudflare production failure. [workerd #6824, opened 2026-06-17](https://github.com/cloudflare/workerd/issues/6824).

**Value blockers — I:** 1 KiB replies immediately block this class of data processing; 8 KiB source including adapters and the current 32-call bounds constrain real compositions. Stable errors, cancellation, bounded admission, an installable ARM/KVM backend and the existing adapter actually passing upstream cases matter. The absence of raw native stdout and most Linux syscalls is irrelevant to a JSON-only JS contract. Timers can be omitted initially if the host supplies a bounded delay/polling capability when needed.

**Payment / disqualification — I/E:** an embedded support/integration pilot is plausible only if hardware isolation or local placement is a stated requirement, or a demonstrably large unique-code bill exists. A $1,000–3,000 fixed-scope pilot would be a price test, not established willingness to pay. If a free fresh QuickJS context meets their threat model, this segment has no reason to accept jitk's setup burden.

### 2. Agent platform builders: a fast lane inside the existing computer

**Job / buyer — I:** offer a shell/browser/full workspace and a separate low-authority route for small generated tool programs. The platform team pays to avoid giving every transformation access to the whole workspace. The end user pays for the agent's completed task, not for VM creation.

**Current solution and cost — F:** E2B, Daytona, Vercel Sandbox, Modal and Fly sell fuller environments at the rates in §2. E2B's Manus customer description explicitly says it needs a full virtual computer and 27 tools; it is evidence against replacing the whole workspace with jitk. [E2B customer statement, live](https://e2b.dev/). Cloudflare's new environment-selection guide explicitly recommends using both scoped Dynamic Workers and a Linux Container in one coding agent. [Guide, updated 2026-10-22](https://developers.cloudflare.com/sandbox/concepts/).

**Pain evidence — F:** Pydantic's E2B integration documentation explains that sandboxes continue running and billing after an agent run, and that default images still need project dependencies and often a custom template. That demonstrates lifecycle and dependency work, not universal dissatisfaction with E2B. [Pydantic E2B workspace documentation](https://pydantic.dev/docs/ai/harness/e2b-sandbox/).

**Value blockers — I:** payload/source parity, containment, API stability, traces, operational failure semantics and tenant-bound tool grants block the fast lane. Full Node/Python, git, package managers, writable workspaces, subprocesses and browser support block replacing the workspace. These are separate gaps; adding byte stdout does not solve them. A fallback to a vendor sandbox must be selected before effects occur and retain an equivalent authority policy; rerunning a partially completed tool program can duplicate writes.

**Payment / disqualification — I:** a fast lane may be a useful internal component at high execution volume. It is not attractive if another pool must be operated just to save 50 ms on a task dominated by model/API seconds. Discover how often the fast lane would actually be used and which existing component it removes.

### 3. Plugin hosts and customer-defined automation

**Job / buyer — I:** let SaaS customers supply short scoring, routing, validation or transformation logic without inheriting the SaaS process's credentials or another customer's state. The buyer is the platform/product owner; the commercial value can be enabling a paid customization feature.

**Current solution and cost — F:** Extism embeds Wasm plugins with explicitly supplied host functions; run supplies a fresh QuickJS context. Both avoid a hosted per-call fee. Cloudflare Workers for Platforms costs **$25/month including 20M requests, 60M CPU-ms and 1,000 scripts**; repeated stable customer plugins are its natural workload. [Extism contract](https://extism.org/docs/concepts/plug-in/), [run](https://run-sdk.dev/docs/foundations/sandbox), [Workers for Platforms pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/).

**Pain evidence — F:** n8n's July 22, 2026 advisory describes shared module-cache poisoning between users' Code-node runs; patched versions are listed. Its task-runner docs recommend an external runner boundary for production. This establishes a concrete freshness/isolation problem, not that jitk is immune to equivalent host-side mistakes. [Maintainer advisory](https://github.com/n8n-io/n8n/security/advisories/GHSA-9cmh-xcqm-5hqr), [task-runner architecture](https://docs.n8n.io/deploy/host-n8n/configure-n8n/set-up-task-runners/).

**Value blockers — I:** tenant-bound grants, bounded memory/CPU, host-controlled deadlines, recoverable crashes, release/version pinning and installation are hard blockers. Raw bytes matter for plugin APIs that process files, but a JSON formula plugin does not need arbitrary Linux. Timers, networking and packages are blockers only if the advertised plugin API promises them. A host-side cache or overly broad capability can still cross tenants even when every guest starts fresh.

**Payment / disqualification — I:** potentially stronger support revenue than selling compute, but stable plugin code avoids the unique-code tariff and Wasm is already portable. Validate a hardware-boundary requirement before optimizing for this segment; do not build a plugin marketplace/editor as a prerequisite.

### 4. Eval/RL harness operators: many short untrusted runs

**Job / buyer — I:** evaluate candidate solutions/test cases, compute rewards, and keep expensive inference/training workers from waiting on a slow verifier. An experiment infrastructure owner pays for throughput, isolation, language fidelity and correct rewards.

**Current solution and cost — F:** Open R1 documents E2B and Morph providers; E2B's Hugging Face case reports 150–170 ms session starts and says reward latency matters for GPU idle time. Crucially, its example creates a sandbox and gathers multiple scripts inside it: it does not establish a separate VM for every test. [Open R1 repository](https://github.com/huggingface/open-r1), [customer case, 2025-03-31](https://e2b.dev/customers/how-hugging-face-is-using-e2b-to-replicate-deepseek-r1). Prime's $0.0335/hour example and Modal's sandbox tariff are relevant competing cost floors.

**Pain evidence — F:** EvalPlus documents 200 × 164 candidates with roughly 700+ tests each taking 2–10 minutes in its example, warns against oversubscribing cores, and uses reference-relative timeouts. This proves performance and timing fidelity matter, while also showing mature batching/early-stop alternatives. [Execution guidance](https://github.com/evalplus/evalplus/blob/master/docs/execution.md). Prime's file-transfer issue reports **100–300 MB grading archives** and concurrent-rollout memory pressure. That is evidence of a real large-workspace workload that jitk's tiny class does not address. [Prime #824, 2026-08-06](https://github.com/PrimeIntellect-ai/prime/issues/824).

**Value blockers — I:** ordinary Python/CPython packages, C++/Rust toolchains, filesystem behavior, process APIs, exit/stderr fidelity and x86 artifacts block most of the demonstrated workflows. MicroPython fixtures are not Python benchmark compatibility. A JS-only verifier with small bounded fixtures is the plausible subset; use one VM for the agreed submission/test boundary, not automatically for each assertion. For it, payload limits, independent deadlines, cancellation, reset correctness and admitted throughput matter more than timers or general networking.

**Payment / disqualification — I:** large volume is not enough: most of the evidenced demand needs the wrong runtime. No source here establishes a buyer generating millions of sufficiently short JS/native-profile runs that cannot use an existing pool. Keep RL as a targeted design-partner experiment, not the leading market claim. Reward determinism also requires the same runtime/ISA/timeout policy; using a small non-Linux ABI must not silently change pass/fail scores.

### 5. Education, online judges and coding assessments

**Job / buyer — I:** compile/run student or candidate submissions, compare exact output, enforce time/memory limits and return comprehensible diagnostics. Schools, judge operators and assessment vendors pay for a dependable grading API, language catalog and predictable administration.

**Current solution and cost — F:** Judge0 already offers 60+ languages, extra files, input, compiler options, limits and result details at €27–107/month shared-cloud tiers, or self-hosting. Its API explicitly supports base64 for data that cannot be represented as UTF-8. [Product/pricing](https://judge0.com/), [submission API](https://github.com/judge0/judge0/blob/master/docs/api/submissions/create_a_submission.md).

**Pain evidence — F:** the maintainer's 2024-04-18 symlink advisory records sandbox escape in older versions, patched in 1.13.1. This is a concrete boundary-maintenance cost; it does not establish a current unpatched Judge0 defect or a security advantage for an unaudited jitk deployment. [Advisory](https://github.com/judge0/judge0/security/advisories/GHSA-h9g2-45c8-89cf).

**Value blockers — I:** mainstream language/toolchain support, stdin and exact stdout/stderr/exit status, distinct timeout/OOM verdicts, quotas and safe repeated admission are hard requirements. A printable-only byte contract can mark a correct submission wrong. A JS fundamentals course with a declared QuickJS subset could use jitk; kernel startup is unlikely to be the purchasing criterion. Timers are unnecessary for pure algorithms, but a course teaching Node or asynchronous web APIs needs their semantics. An 8 KiB source cap is too restrictive for a general project assessment.

**Payment / disqualification — I:** sensible pilot: one small JS course or specialized native grader. Broad judge replacement is expensive and competes against a low subscription price. Language breadth is a value gap, not visual polish, for this segment.

### 6. Data/ETL snippet runners

**Job / buyer — I:** normalize one record or bounded batch, validate a schema, run a regex or user-defined enrichment step beside a data pipeline. The buyer is a data platform team. Arbitrary pandas/DuckDB/media transformations are a much broader product.

**Current solution and cost — F:** Redpanda Connect's JavaScript processor uses embedded goja and reuses runtimes across invocations; it documents that globals survive and warns that pooling prevents deterministic use of those globals. That is already a no-per-call-cloud-fee solution. Lambda, Modal and full Linux workers cover package-heavy transforms at §2 rates. [Processor documentation](https://docs.redpanda.com/connect/components/processors/javascript/).

**Pain evidence — F:** n8n's current large-workflow guidance says Code nodes can increase memory by copying inputs/outputs and recommends projecting early, batching, and passing references for large files. Those are real data-movement costs that a 0.5 MiB empty/small VM does not abolish. [Operator guidance, undated live page](https://support.n8n.io/article/optimizing-and-debugging-large-workflows-in-n8n-s4a4a93ogxsxtyta34z3br80).

**Value blockers — I:** payload bytes, structured/binary values, bounded batch memory, error propagation and byte-exact output block value. 1 KiB is too small for ordinary records with nested fields, let alone batches. Heavy JSON/QuickJS compute may lose to V8 or native transforms; 1 ms startup is less relevant once compute dominates. For tiny one-record transformations, VM lifecycle overhead can cost more than useful work; batching changes the trust unit. Native gzip/jq are real supported profiles, but their measured byte correctness supplies neither large-data streaming nor the small-JS memory figure.

**Payment / disqualification — I:** pursue only a multi-tenant untrusted-transform slice whose operator values fresh state and hardware isolation. A trusted ETL author already running goja/SQL/Bloblang has little reason to add KVM. Do not broaden the kernel to chase pandas or DuckDB before a concrete workload exists.

### 7. CI and test fan-out

**Job / buyer — I:** run build/test jobs from pull requests, isolate untrusted repositories, fan out tests and collect artifacts. The buyer is a developer productivity or CI infrastructure team.

**Current solution and cost — F:** GitHub currently prices Linux slim x64 at **$0.002/minute**, standard 2-core x64 at **$0.006/minute**, and 2-core ARM at **$0.005/minute**, rounding each job up to a whole minute. Included/free usage can apply. Full Linux sandboxes and ephemeral runners are existing alternatives. [Runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing).

**Pain evidence — F:** GitLab warns that a malicious job on a non-ephemeral shared runner can compromise other repositories. Buildkite recommends ephemeral isolated environments, clean checkouts and separation of untrusted jobs. These are concrete whole-job requirements, not a request for a smaller JS VM. [GitLab security guidance](https://docs.gitlab.com/runner/security/), [Buildkite checklist](https://buildkite.com/docs/platform/security/checklist).

**Value blockers — I:** checkout, package installation, subprocesses, writable filesystem, network/service dependencies, toolchains and large artifacts are hard blockers. x86-only dependencies and absence of KVM on a chosen runner are additional adoption barriers. Raw bytes and Linux JS parity are necessary but insufficient. A narrow expression/property-test service might work, but it belongs with the eval segment; it does not replace CI. Comparing 1 ms jitk execution with GitHub's minute-rounded invoice without preserving full-job semantics is misleading.

**Payment / disqualification — I:** deprioritize. The gap is most of a development environment, and incumbent CI can batch small tests in one job already.

### 8. Edge and small-device execution

**Job / buyer — I:** execute tenant rules near a device/data source, ideally with low memory and limited connectivity. The buyer is an edge/embedded platform operator; a hardware architecture alone does not make an edge distribution product.

**Current solution and cost — F:** Workers/Dynamic Workers provide globally managed isolate execution; Extism/Wasm can embed locally. Cloudflare also distinguishes the full Linux/container route from known-method Dynamic Workers. [Environment guide](https://developers.cloudflare.com/sandbox/concepts/), [Extism](https://extism.org/docs/concepts/plug-in/). The relevant cloud prices are in §2; local open-source operation has no per-call service fee but still consumes a device and support effort.

**Pain evidence / strength — F/I:** Cloudflare documents unsupported subprocesses/native add-ons in the Dynamic Worker tier, a real ABI boundary. It does not prove customers want jitk on edge devices. No strong first-person edge buyer pain or willingness-to-pay evidence emerged in this research; this segment has the weakest demand evidence here.

**Value blockers — I:** usable KVM/EL2, interrupt/platform support, installation/update/rollback, power/resource limits and remote diagnostics matter before more syscall names. An ARM device may have virtualization unavailable; a Cloudflare Worker is not an ARM/KVM host one can install jitk into. Existing hardware-reach research still treats Pi support as engineering work. [Portability estimate](../portability/03-hardware-reach.md). A geographically centralized jitk API loses the claimed edge-placement benefit. Keep a Pi demo as a systems demo, not market validation.

## 4. Blocker matrix across the whole gap table

**I — Interpretation:** **B** = blocks the normal advertised job or any credible production offer; **C** = conditional on workload/deployment or blocks adoption rather than semantics; **P** = low priority for that narrow job, potentially cosmetic initially. A P does not certify security or mean “never.” Code-mode and plugin columns assume constrained JS. Eval/education/ETL/CI columns represent their ordinary broader jobs, with narrow exceptions described in §3. “Proof” means minimum independent reproducibility/operational evidence, not necessarily a paid external audit.

| Gap | Code-mode executor | Agent platform | Plugin host | Eval/RL | Education/judge | Data/ETL | CI/test | Edge |
|---|---|---|---|---|---|---|---|---|
| Distribution / repeatable clean setup | B | B | B | B | B | B | B | B |
| Stable API, docs, errors, cancellation | B | B | B | B | B | B | B | B |
| Built-in tenancy / billing | C: host can own it | C: often already owned | C: host can own it | C: single lab vs service | B for public service | C | C | C |
| Operations: limits, observability, upgrades | B | B | B | B | B | B | B | B |
| Linux: 1 KiB tool reply cap | B | B for fast lane | C/B for data plugins | B for tool/data grading | C: pure stdin path differs | B | C: broader ABI already blocks | C |
| Linux: 8 KiB source incl. adapters | C/B | C/B | C | B for general solutions | B for projects | C | B | C |
| Linux: missing JS timers | P/C | C | C | P for pure algorithms | P/C by course | P/C | C | C |
| aarch64-only / exposed virtualization | C: severe for embedding | C | C: severe for drop-in | C/B for pinned artifacts | C | C/B for packages | B for many existing jobs | C: platform-specific |
| Shard confinement + independent deadlines | B | B | B | B | B | B | B | B |
| Printable-only native output path | P for JSON JS | C for native tools | C | B for exact-output jobs | B | B for binary/file jobs | B | C |
| Missing broad Linux/runtime behavior | P | B for whole workspace | P/C | B for mainstream Python/C++ | B for multi-language | B for package-heavy data | B | C |
| Proof from outside / second machine / CI | B for production choice | B | B | B for trustworthy scores | B for production service | B | B | B |
| Full external security audit at first demo | P | C | C | C | C | C | C | C |
| “Million VMs” spectacle or a prettier dashboard | P | P | P | P | P | P | P | P |

**I — The key distinction:** throughput and correctness matter to a buyer; a million-run counter is just one way to demonstrate them. Auditability and reproducibility matter; publishing a large corpus percentage with no buyer workload can still be cosmetic. Conversely, boring API failure recovery is commercially important even if it produces no exciting video.

## 5. Program reach: separate transport, runtime and demand

### Does anyone care about the 261 programs?

**M:** the phase-2 report's 261 comparable failures are 211 visible + 50 held-out cases whose first observed cause is stdout-control-byte rejection. They are **6.6% of the 3,947 comparable programs**. They are from a compiler corpus, not 261 different tools, users, customers or jobs. Fixing output could expose later failures. Adding all 261 to today's passes gives a purely arithmetic ceiling of 3,459/3,947, about 87.6%; it is not a predicted post-fix pass rate. [Corpus results](../../jitk/scriptc-corpus/RESULTS-PHASE2.md).

**I — Buyers do care about the underlying behavior:** Unicode text, NUL-delimited search output, compressed data, arbitrary files, diagnostics and nonzero exit status are routine interfaces. A grader must not reject a correct program because of its bytes. A JSON-only code-mode caller need not care: JSON escaping can represent Unicode without raw UTF-8 output on the control stream. That narrower product should say so explicitly.

**F/M — The cheapest path is partly built.** Linux native mode negotiates separate stdout/stderr stream records, bounded capture and completion status; MCP returns base64 objects. It preserves NUL and invalid UTF-8 and has exact Linux comparison receipts. Inspecting the current write handler confirms the native-mode branch bypasses the ordinary text output path. [R7 bytes receipt](../../jitk/shard/RESULTS-R7-bytes.md), [write handler](../../jitk/kernel/src/syscalls/write.rs), [MCP native adapter](../../jitk/mcp/native.mjs).

**I/E — Cheapest credible fill:** reuse that native framing for the relevant compiled-program/corpus path, expose its capability accurately, and rerun a byte-focused held-out subset. Estimate **2–4 days, $0 incremental software cost**, using existing artifacts and a consenting existing ARM/KVM test host. First targets: Unicode, NUL, invalid UTF-8, separate stderr, partial-output-plus-error, output limit and exact guest exit. Carry generation/length/credit validation through every layer. This is a transport/lifecycle integration task, not 261 kernel features.

**I — A host wrapper applied after execution cannot recover bytes if the guest is killed when writing them.** Base64 must be produced inside an allowed path or the transport must carry bytes. Relinking arbitrary programs to emit base64 reduces compatibility and creates per-tool maintenance. Reuse the existing byte protocol rather than describing a host-side string conversion as the complete fix.

**F/I — Native mode still has product limits:** one serial worker; concurrent calls return LIMIT; timeout/cancel kills the worker and requires MCP restart; 4 MiB archive and 1 MiB output capture bounds. Therefore “we have binary output” is accurate for that mode, while “native execution is ready for many concurrent tenants” is not. [Contract and limits](../../jitk/shard/RESULTS-R7-bytes.md), [R9 native lifecycle finding](../../review/R9-ARCH-QUALITY.md).

### Which additional Linux behavior would earn its cost?

**I:** rank by a submitted workload, not by syscall frequency or corpus coverage alone.

| Proposed reach expansion | Value assessment | Cheapest credible action / effort (E) |
|---|---|---|
| Correct native byte/result handling | Immediately useful to graders, file transforms and supported CLI tools | Reuse R7 protocol and integrate corpus/lifecycle, 2–4 days, $0 software |
| Package existing jq / immutable SQLite / selected Lua profiles | Useful, intelligible native examples already supported by receipts | Ship exact hashes/build recipes and examples, 1–2 days, $0; no new broad ABI promise |
| More scriptc allocator/placement coverage | Strong compiler/kernel-growth evidence; value if somebody deploys those compiled programs | One workload/held-out regression at a time, 1–3 days per bounded investigation, $0 |
| pipe2, writable cwd, epoll because the remaining corpus uses them | Could unlock real event loops/file tools, but starts broadening the machine contract | Collect the actual failing user job first; 0.5–1 day triage, $0. No automatic implementation recommendation |
| CPython + packages, npm/Node, Go runtime, full ripgrep or Git | Required by broad RL/CI/data jobs; output wrapping alone cannot supply these | Route to an existing Linux tier first. A router/profile preflight is 2–4 days, plus vendor usage at §2 rates; general ABI expansion is weeks to months |
| Full Linux fallback implemented as a new VM platform | Broad reach, but competes directly with mature VM stacks | Use an existing provider or maintained runtime; do not build a second hosted product to hide the first one's incompatibility |

**M/F — Boundary of the native evidence:** the older [native census](../native-census/RESULTS.md) is useful for failure categories, but its SQLite and byte-output failures are superseded by R7. The currently evidenced profiles are selected static artifacts. Dynamic loading, threads, signals, child processes and filesystem expectations remain materially different for other binaries. “Static” does not mean “will run.”

## 6. Linux feature parity: what blocks the core value

### 1 KiB replies: a hard blocker for ordinary tool composition

**F:** current source enforces 1,024-byte call/reply limits in the guest, IPC and TypeScript backend. Oversized replies become a LIMIT error. This is **input to the program**, not just a cap on its final answer to the model. [R9 N6](../../review/R9-ARCH-QUALITY.md), [shard backend](../../jitk/executor/shard-backend.ts), [ring bootstrap](../../jitk/kernel/ring-bootstrap.js).

**I — Therefore “filter before returning” is not a workaround when filtering is supposed to happen inside the VM.** An issue body, CRM record, document passage, schema or one page of records can exceed 1 KiB. Anthropic's expense example supplies a concrete representative job (§3.1). Moving all projection into trusted tools may be desirable, but then the host must anticipate the query or implement a richer data API; it reduces the generality being sold.

**F/I — Tiny-page pagination also has limits:** the current IPC path bounds call IDs to 32 and tool payloads to 1,024 bytes. A 50 KiB result would need at least 50 full 1 KiB chunks before envelopes, exceeding that current per-run call space. The exact feasible payload is smaller once JSON framing is included. [Backend bounds](../../jitk/executor/shard-backend.ts), [IPC admission](../../jitk/shard/src/ipc_service.rs). A scalar-only demonstration can work under these caps, but it does not validate ordinary code mode.

**I/E — Cheapest credible fill:** introduce one versioned bounded payload contract across kernel, shard, bootstrap and SDK; use the shared ABI refactor R9 recommends. Establish a modest inline class, for example **64 KiB replies as a proposed target**, plus explicit blob handles/projection for larger objects. Do not just increase three independent constants and keep the memory claim unchanged. Estimate **3–6 days including parity and malformed/oversized/cancellation cases**, $0 incremental software cost; profile memory again at representative sizes. Acceptance targets are choices to test, not supported limits today.

**F/I — This closes a functional deficit, not a unique feature:** Hyperlight-Unikraft already documents roughly 69 KB limits for host-call arguments/results and replies. A useful payload class is part of reaching the competitive baseline. [Current call limits](https://github.com/hyperlight-dev/hyperlight-unikraft/blob/main/docs/calls.md).

### 8 KiB source: an adoption ceiling, not always a job failure

**F/I:** the limit includes trusted adapters; it is not 8 KiB of usable customer code. Source encoding/wrapping and provider names consume space. This can block generated workflows, bundled helpers and longer student solutions before useful computation begins. [Source construction](../../jitk/executor/shard-backend.ts).

**I/E:** make raw tenant-source bytes an explicit field with a documented independent limit, keep tool dispatch/prepared helpers outside that budget, and return a precise pre-execution error. **1–3 additional days** after the shared wire work, $0. A proposed initial 32–64 KiB source class should be driven by captured programs and memory measurements. A narrow 20-line glue workload may not need it immediately; source truncation or secret fallback to a larger-authority runtime is unacceptable.

### Timers: lower priority for the wedge

**F — Counterevidence to treating every missing API as a blocker:** run deliberately provides no setTimeout/setInterval, despite targeting the same generated-code/host-function job. Its Date and Math.random contract is deterministic. [run sandbox documentation](https://run-sdk.dev/docs/foundations/sandbox).

**I:** timers matter for retry/backoff, polling, throttling and some libraries. They do not matter for a bounded pure transform or Promise.all over host functions that already time out. A trusted, quota-controlled delay capability can handle a narrow polling case. It does not supply complete JS timer semantics, and unlimited sleeps/outstanding timers can become a resource-denial problem.

**I/E:** first document unsupported timers and capture affected workload examples, **0.5 day, $0**. Add a bounded host delay if demanded, **0.5–1 day** with cancellation/budget semantics. Full backend-equivalent timer behavior is **2–4 days estimated** after agreeing scheduling/clock semantics; if replay is a requirement, timer firing/order must be journaled or virtualized. Do not build it ahead of payload handling solely to make a parity row green.

### The shared parity corpus is a buyer-enablement tool

**I/E:** a minimum suite should compare result/log/error classes across both backends on the same supported snippets, including payload boundary cases, Unicode, errors, concurrency, cancellation, timeout, source overhead and any timer contract. Add a useful JSON workload larger than 1 KiB, not just more scalar echoes. Budget **1–2 days to establish the runner**; subsequent feature work includes its own cases. R9 already recommends this; the new value argument is that it makes a Mac integration predict Linux deployment behavior. It is essential for the embedded route, even when a live hosted API is deferred.

## 7. Does aarch64-only lose most buyers? Is determinism real?

### Architecture reach

**I — There is no defensible percentage of lost buyers in the evidence.** We have no prospect sample, workload distribution or qualified pipeline. “Most clouds” is also not the right unit: a provider having ARM instances does not imply those instances expose KVM, and a customer's available x86 fleet is not automatically replaceable by an ARM host.

| Deployment / workload | Effect of aarch64-only (I) |
|---|---|
| Hosted execution accepting JS/text inputs | Clients can use any ISA. Architecture is largely hidden; latency, region, trust and service terms dominate. |
| Library inside a customer's existing service | A direct placement blocker on an x86 host. Requires a separate ARM/KVM execution pool or a port, increasing operational cost. |
| Existing compiled binaries, native extensions, pinned eval artifacts | A semantic/dependency blocker when only x86 artifacts exist; recompilation can change results and does not establish ABI support. |
| Apple Silicon developer integration | A plausible local foothold; does not validate high-density Linux operation or Intel/Windows installation. |
| ARM cloud/edge host | Necessary but insufficient: must expose usable virtualization and supported platform features. |

**F/I — ARM is commercially viable but not automatically accessible:** AWS explicitly documents ARM64 Lambda MicroVMs, and GitHub sells ARM runners. Neither service exposes a supported jitk/KVM embedding target just because its underlying CPU is ARM. [AWS limits](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html), [GitHub runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing).

**I/E — Cheapest fill now:** publish an explicit host/support matrix and require the pilot to use an existing supported ARM/KVM host, **0.5–1 day, $0**. Run the same package on a second consenting machine before inviting production use. Do not spend the earlier **31–50 engineer-day x86 port estimate** to eliminate a hypothetical objection; confirm a real partner is blocked and cannot accept a separate pool. [Hardware-reach estimate](../portability/03-hardware-reach.md). No cloud rental or host change was performed for this report.

### Determinism is a potential product property, not an automatic VM property

**F/I:** fresh RNG reseeding is intentional, while tool replies, time and concurrent completion order can vary. A single effects channel makes recording/replay *tractable*; it does not make today's executions automatically identical. The user-facing claim should distinguish “starts from a controlled pristine image” from “replays deterministically.” [RNG implementation receipt](../../jitk/shard/RESULTS-R7-rng.md).

**I/E:** define a restricted replay profile: pinned image/runtime/ISA, recorded public entropy/time inputs and tool response/error/order, no live side effects on replay. A **1–3 day bounded spike, $0**, could test byte-identical outputs for a small corpus; it would not deliver durable continuations, exactly-once effects or cryptographic guarantees. Given run already documents deterministic time/random, determinism by itself is not a moat. Keep pause/fork/ship demos from demo.md labeled planned for the hardware tier until implemented and validated.

## 8. The wedge: one conditional segment, with explicit switch and stop tests

**I — Chosen candidate:** an agent-platform operator already running a tenant-aware tool broker on **Linux ARM/KVM**, receiving **many unique, short JS programs** that touch bounded structured data. The operator needs **fresh guest state plus hardware isolation**, requires code/data to stay beside that broker, and is prepared to use a constrained JS profile without Node/npm. The deployment is an execution library/backend inside their product.

This combines the properties that actually help:

- **M/I:** about 1.1 ms local executor overhead makes many small boundaries plausible; do not promise that percentile on metal or through a network.
- **M/I:** about 0.5 MiB marginal memory for small programs permits a modest resident pool; actual admission currently reserves 2 MiB/run, and large payloads need a new measurement.
- **F/I:** one host-tool channel concentrates authorization and logging in a broker the customer already owns.
- **F/I:** pristine reset avoids relying on cleaning a shared module cache/context between unrelated guest programs. Shared host tools/caches still need tenant isolation.
- **I:** a fully recorded effects boundary could improve debugging/reproducibility later. It is not part of the present switching proof.

### The number that would prove value

**I — None of the current numbers proves a switch.** The strongest measured peer is Hyperlight, which has approximately the same memory cost. The async benchmark from the older pitch compares a synchronous bridge and is not a general incumbent result. There is no external workload, measured operator invoice or maintained-library integration comparison.

**E — The relevant economic test:** for the unique-code workload, measure the actual current monthly bill and compare it to **host cost plus integration/maintenance**, with the same freshness/authority contract. A million unique Worker creations makes a $2,000-scale line item visible (§2), but an E2B one-second scenario is only $46 usage, and a suitable open-source library has no usage tariff. If the prospect's current bill is $50/month, a custom runtime will usually not win on compute savings. Do not generalize the Cloudflare creation tariff to fixed-code plugins.

**E — Proposed two-week validation, with stopping criteria:**

1. **Workload evidence:** obtain 100 representative, redacted real programs, input-size distribution, per-run duration, volume and current deployment/invoice. A claimed high volume without artifacts is not enough. No outreach or collection occurred in this research.
2. **Fit:** at least 95/100 work unchanged under an explicit constrained contract; unsupported cases fail before effects and remain visible. Threshold is a proposed gate. Fix the 1 KiB problem before calling failures “market mismatch.”
3. **Required boundary:** the operator names why run/Wasm/workerd is insufficient and why local ARM placement is acceptable. Compare Hyperlight or Hyperlight-Unikraft as the maintained hardware baseline.
4. **Matched performance/cost:** measure complete API latency, p95/p99, queueing, tool time, reset/reap, error recovery and all-process CPU on real KVM hardware. Seek a material improvement, for example **3× lower full execution-tier cost or a documented latency requirement competitors miss**; do not choose a benchmark after seeing the winner. A 4% memory difference is not a switching event.
5. **Commercial evidence:** the operator installs it on its own host and agrees to a bounded paid integration/support pilot or supplies sustained use and engineering effort. Praise and social attention do not count as payment evidence.

**I — Kill or adopt instead:** if a maintained hardware library meets the contract within the same effort/cost envelope, use it as the substrate or keep jitk as the kernel-growth research contribution. If no operator meets the boundary/language/placement conditions, there is no present commercial wedge. Neither RL volume nor “agents need computers” rescues that conclusion.

## 9. Cheapest credible way to fill each product gap

**I/E:** this is a value-driven order for the proposed embedded pilot. Estimates overlap; do not sum them as independent guaranteed work. Money is incremental using existing development hardware and public repositories, not unpaid labor. Any future use of another person's host needs that owner's consent; none is requested or used here.

| Gap | Minimum credible fill and place | Money / days (E) | What it unlocks next |
|---|---|---|---|
| **Distribution** | One exact Linux ARM64/KVM package with pinned prepared image/helper provenance and clean-clone smoke command; release artifact in this repo/GitHub Releases. Remove hand-created snapshot path dependence first. | $0 software/distribution; **2–4 days**, including clean setup | An external engineer can try the existing contract without reproducing the research environment |
| **User API** | Freeze a small execution/result/error/cancel contract, version it, and ship one Cloudflare Executor example. State unsupported connector paths and limits. Use the upstream seam, not a new framework. | $0; **1–3 days** after packaging | A real host-product integration and realistic workload capture |
| **Multi-tenancy** | For embedding, consume the host's authenticated context, tenant-bound grants and admission quotas; add per-run counters. Do not build accounts/billing when the host already has them. | $0 additional service; **2–4 days** for a narrow integration. Hosted identity/billing is additional work | One customer can safely attribute limits and failures; not a standalone multi-tenant service yet |
| **Operations** | Structured run/error/reset/queue metrics, bounded logs, image IDs, restart/recovery, one upgrade/rollback recipe. Send to the host product's existing logging/metrics. | $0 new SaaS; **1–3 days** | A pilot can tell whether errors, deadlines or overload are destroying value |
| **Linux parity** | Shared versioned payload contract + >1 KiB useful task + side-by-side corpus. Source-size separation next; timers only if workloads need them. | $0 software; **3–6 days payload work + 1–2 days corpus**, source/timer work as §6 | The core code-mode data job works on deployment Linux, not only on the Mac |
| **Hardware** | Repeat bounded measurements/package setup on a second available ARM/KVM machine; publish host constraints. Prefer volunteered existing hardware before renting metal; AWS c7g.metal is the brief's cloud candidate, subject to availability and a current regional quote. | **$0 if existing host access is available; 1–2 days** after setup. If none is available, budget **$10 for a short separately scoped ARM bare-metal session**, an estimate/ceiling requiring that quote; do not promise the old “under $1” bill | Independent platform evidence. Does not unlock x86 installation; the port remains the 31–50-day earlier estimate |
| **Shard containment** | Fix shared-channel error scope, place deadline authority outside the shard, sanitize native worker environment, then add OS confinement compatible with the actual KVM/IPC syscall needs. Reuse the repository's confinement work where applicable. | $0 software; **3–7 days estimated**, potentially longer if confinement conflicts with deployment. No certification claim | Appropriate basis for an external hostile-workload pilot; all production segments depend on it |
| **Program reach** | Expose/reuse existing native byte mode, exact status and supported profiles; integrate serial-worker recovery and corpus path before expanding syscalls. Preflight unsupported jobs to an existing Linux provider with explicit policy. | $0 for byte/profile integration, **2–4 days**; router **2–4 additional days** plus §2 usage | File transforms/graders can trust bytes; broader jobs have a deliberate escape hatch |
| **Proof from outside** | One external clean install plus a second-machine CI recipe and a published failure ledger. Seek code-mode maintainers/users and one relevant operator, not a generic launch audience. | $0 volunteer review/public CI within available allowances; **1–2 preparation days**, elapsed feedback unknown | Evidence someone can install/use it and concrete reasons to prioritize the next gap |

**I — External audit is not the cheapest substitute for this sequence.** An informal reviewer, a second host and passing tests are not an external security audit. A paid audit has no quote in this research; defer procurement and scope it with a partner after the architecture/contract stabilizes. Do not assign it an invented fixed price or suggest that a clean corpus means production certification.

**I — Change to PRODUCT-GAPS.md's suggested order:** for buyer discovery, put a useful >1 KiB tool-data integration and clean package **ahead of** the million-run spectacle; keep containment ahead of accepting hostile external workloads. A small bare-metal measurement is still necessary for hosting claims, but not permission to build a fleet, tenancy product or x86 port in advance of demand. A recorded CV demonstration can ship earlier with explicit prototype limitations.

## 10. Which delivery path the evidence supports

| Path | Assessment (I) | Bounded next artifact, effort/cash (E) |
|---|---|---|
| **Open-source runtime** | Best immediate distribution and credibility route. Lets others inspect/replace pieces and submit workload failures. Open source alone is not a revenue model; a maintenance promise would be additional work. | A supported-profile release, example and measured failure ledger, **3–5 days** after core fixes, **$0 incremental** |
| **Library/backend inside someone else's product** | Best conditional product. The host owns accounts, tools, credentials, state, queues and billing; jitk earns its place with a needed execution boundary. Expect support/integration revenue before metered compute revenue. | One operator's adapter and workload receipt, **5–10 integration days** depending on gaps, **$0 new hosting** when using their existing supported host. Pilot price is an experiment, not evidence |
| **Hosted sandbox API** | Weak evidence now. Competes on languages, reliability, scale, regions and on-call operation against well-funded providers. A cheap per-run CPU component does not establish hosted unit economics. | Defer. Even a narrow service is **at least several weeks** plus ongoing security/operations. A provisional **$50–200/month infrastructure envelope** would be an unvalidated budget, not an ARM/KVM provider quote or full business cost |
| **CV / engineering research project only** | Already well supported. The kernel-growth/differential-testing work, measured reset optimization, memory accounting and honest limitations are useful evidence for platform engineering hiring. This is a success even if the market test fails. | A reproducible engineering case study and 5–8 minute demo, **2–4 days**, **$0 remote publication/presentation**; no commercial service required |

**I — Recommendation:** ship open source toward one embedded integration, while treating the CV outcome as the guaranteed useful deliverable. Do not turn the portfolio into an unsupported 24/7 service merely to look like a startup. Conversely, do not label it “CV only” until the small, falsifiable operator test has been tried.

## 11. Demos that reveal value, with honest failure modes

These are proposals, not implemented demos. Use fixtures, existing receipts and recorded snippets initially, avoiding a model API or live external service as a necessary dependency. A fixture must be labeled; a replay must not be labeled live. Cash estimates assume existing hardware and no paid generation/deployment.

### A. “The tool returned 64 KiB. The model got the answer.” — primary product demo

**Viewer / first 10 seconds — I:** the screen shows a support/release question, a large tool response counter and a small useful decision with two reasons. Reveal the generated JS and that the tool data was processed inside a fresh guest. The difference from pitch/07's scalar-friendly demo is a realistic input large enough to expose today's Linux cap.

**Real vs staged — F/I:** the existing executor and host-tool calls are real; a fixed, labeled issue/expense fixture avoids network variance. Today the >1 KiB Linux run fails, so show the actual LIMIT result until payload work is complete. The proposed after-state must not be prerecorded as if already implemented. Do not invent 64 KiB as a supported limit today.

**Number on screen — E:** actual input bytes, returned bytes, validated result, complete API p50/p95 over a declared run count, and max resident/charged memory for that workload. Separately label the historical **1.10 ms / 1.72 CPU-ms** small one-tool receipt; it does not time this data-heavy workflow.

**What can go wrong live — I:** payload allocation changes the memory class; adapters exceed source size; output is malformed; host tools stall; live model emits unsupported code. Keep the fixed snippet runnable and errors visible. **Build: 1–2 days demo work after payload/parity work; $0.** This is the most useful design-partner artifact.

### B. “Poison this run; the next run still starts clean.” — isolation and operations demo

**First 10 seconds — I:** two runs side by side: A stores a unique canary and loops or emits malformed output; B returns its own clean value, with a visible run/generation receipt and bounded failure for A.

**Real vs staged — I:** adversarial code is deliberately supplied, not claimed to be a successful prompt injection. Use actual VM/backend state and a host heartbeat. Before containment/error-scope fixes, the shared-channel bug may legitimately stop B; show that as a finding, not a successful production boundary.

**Number on screen — E:** completed valid jobs / admitted jobs, timeout-to-recovery, queue depth and zero *observed* canary cross-talk across a declared batch. Define the observation domain; a finite canary test is not an escape proof.

**Live risk / cost — I/E:** shared shard failure, dead native worker, or event-loop stall can spoil recovery. Build **1 day** after lifecycle fixes, **$0**. This demonstrates why operations and independent deadlines are value gaps, without implying that an authorized host action can be undone by resetting a guest.

### C. “The compressed bytes survive the boundary.” — native reach demo

**First 10 seconds — I:** a supported gzip/zstd profile produces binary output; the viewer sees an exact hash/byte comparison and a successful decode outside the untrusted guest, then an intentional error with separate stderr and nonzero status.

**Real vs staged — F/I:** reuse the pinned R7 profiles and a labeled local fixture. Linux native byte transport is built; the corpus/native lifecycle integration is still separate. Do not substitute a hardcoded expected hash for measuring the result or imply all compression formats/options are supported.

**Number on screen — M/E:** historical **82/82 exact tuples** with its date, plus a new live exact-byte verdict if actually run. The combined output cap is **1 MiB**, and the fixture should be much smaller. Show the supported profile name and image hash.

**Live risk / cost — I/E:** native worker is serial and dies on timeout; missing prepared artifacts can block setup. Allow **0.5–1 day to package a reproducible fixture**, $0, with lifecycle fixes scheduled separately. This is a clearer reach claim than counting 261 synthetic programs.

### D. “10,000 short grading jobs, with correct verdicts.” — conditional eval demo

**First 10 seconds — I:** candidate programs produce pass/fail/timeout verdicts beside a live throughput/queue counter. A visibly incorrect candidate fails; the next one still works.

**Real vs staged — I:** use explicitly JS/QuickJS or already-supported native-profile tasks and an independent expected-answer checker. Label supplied candidates as a fixture set. This is not HumanEval Python, Open R1 compatibility or a real RL training run.

**Number on screen — E:** correct verdicts/total, admitted/completed/error counts, full CPU time, wall time and memory. Do not derive “millions/sec” from the nested sequential measurement or imply concurrent residency from a cumulative run counter.

**Live risk / cost — I/E:** nested throughput bimodality, timing-sensitive verdicts and unsupported programs can distort the result. Build **1–2 days** after independent deadlines and a real operator provides the fixture shape; $0 on existing hardware. Defer if no operator requests it.

**I — Do not lead the buyer demo with “one million VMs” or “pull the plug.”** The former proves lifecycle volume only when correctly instrumented; the latter needs hardware continuation and effect semantics not established here. They can become useful systems stories after the narrower product job works.

## 12. Presentations and places to put the evidence

| Audience / venue | Show | Honest claim today / preparation (I/E) |
|---|---|---|
| Code-mode maintainers and users in [Cloudflare Agents](https://github.com/cloudflare/agents) / [TanStack AI](https://github.com/TanStack/ai) | One supported Executor integration, the >1 KiB failure/fix, complete errors and installation recipe | “An experimental hardware-VM backend for this constrained executor contract.” No claim of complete connector compatibility. **1–2 days**, $0; seek workload reports, not endorsement |
| Eval infrastructure engineers around [Open R1](https://github.com/huggingface/open-r1) / [Prime verifiers](https://github.com/PrimeIntellect-ai/verifiers) | A tiny independent grader, language limits, freshness and actual CPU/queue measurements | “A possible fast lane for short supported programs; Python/package parity is absent.” **1 day adapted deck**, $0; only useful if the constrained workload is real |
| Platform/security-minded SaaS engineers | The n8n cache-poisoning lesson, fresh-state experiment, trusted tool boundary and unresolved host containment | “Guest freshness is one defense layer; host authorization and confinement still matter.” **1–2 days**, $0 remote. Do not pitch an unaudited prototype as a remediation for an advisory |
| KL/SEA systems community: [Rust Malaysia meetup](https://rust-malaysia.github.io/meetup/) | A short Rust/KVM architecture walkthrough, copy-restore result, byte-correctness example and failed hypotheses | “I built and measured a small restricted runtime; here is the evidence and where it breaks.” The meetup page has a talk-proposal route and previous recordings; no future slot/acceptance is assumed. **1–2 days talk prep**, $0 remote; no travel required |
| Hiring managers / platform-engineering interviews in KL/SEA | One architecture page, artifact-bound measurements, a reproducible installation, two bugs and the tradeoffs behind fixes | “I can build, measure, debug and scope a low-level system.” **0.5–1 day interview adaptation**, $0. This claim is stronger now than claiming product-market fit |
| Engineering post accompanying the repository | The customer-shaped task first; then reset/memory evidence, matched Hyperlight result and explicit unsupported matrix | “Fresh guest state with roughly millisecond local overhead on a measured nested ARM setup.” **1–2 days**, $0. Keep hardware, sample count, measurement boundary and date next to every chart |

**I — Keep the sales presentation short:** the job and before/after result; the actual execution boundary; the comparison against the operator's present solution; remaining unsupported cases; and the exact pilot acceptance criteria. Kernel LOC, syscall count and aggregate corpus coverage are supporting engineering evidence, not the first slide's customer benefit.

## 13. What the evidence does not establish

- **I:** no observed willingness to pay for jitk, no external installation, no qualified market size and no reason to estimate a percentage of buyers lost to ARM.
- **F/I:** vendor customer stories establish that sandbox demand exists; they often demonstrate full-computer and Python workloads that this runtime cannot serve.
- **M/I:** local small-run latency/memory receipts are useful and substantially improved, but do not establish production throughput, native-profile footprint, a hosted margin, deterministic replay or a security advantage over maintained alternatives.
- **I:** issue/advisory evidence is a purposive sample, not failure-rate measurement. Patched incumbent defects are reasons to take isolation seriously, not proof of a commercial opening for this prototype.
- **I:** the biggest unresolved question is whether a specific operator needs the combination of local hardware isolation, short JS and fresh state enough to accept the constrained runtime and setup. More syscall coverage cannot answer it.

## Ranked top 3 moves

1. **I/E — Make the useful code-mode data job work on Linux.** Shared payload contract, parity corpus and a labeled >1 KiB fixture; plan **4–8 overlapping engineer-days**, $0 incremental software cost. This tests the core value promise and establishes deployment behavior.
2. **I/E — Prepare a contained, installable embedded pilot and seek one operator workload.** Fix shared-channel/deadline/confinement prerequisites, package one supported ARM/KVM release and one upstream adapter. Approximately **1–2 weeks depending on overlap and confinement findings**, $0 new service on an existing supported host; external feedback time unknown. Do not build accounts/billing or promise production safety in advance.
3. **I/E — Publish the measured engineering case study and reuse it for KL/SEA hiring/community talks.** Show byte correctness, reset optimization, matched Hyperlight parity and limitations. **2–4 days**, $0 remote. Pursue wider native reach or x86 only when the operator workload identifies its value.

## The ONE move to do first

**I — Write and run a single customer-shaped Linux parity case whose tool returns more than 1 KiB and whose program reduces it to a small correct answer.** Capture the current LIMIT failure, then use it to drive the shared payload contract and its boundary tests. **E:** half a day to define/package the case, followed by the §6 implementation estimate. This is more informative about the intended product than another scalar benchmark or an extra syscall. Run it only in the separately authorized implementation phase; this report performs no experiment.

## Five-line TL;DR

1. **I:** No proven commercial wedge; the best candidate is an embedded ARM/KVM backend for short, unique JS tool programs requiring hardware isolation.
2. **I:** The 1 KiB tool-reply cap blocks the core data-composition job; missing timers often do not, and 261 synthetic stdout failures are not a market.
3. **M/F:** Binary native streams already exist; integrate their supported path and lifecycle instead of inventing the same fix again.
4. **F/I:** Unique Dynamic Worker creation can cost about $2,000/million, but cheap full sandboxes and free embedded runtimes prevent a general price-win claim.
5. **I:** Ship a useful parity case, a reproducible contained integration and an honest engineering story; defer hosted infrastructure and broad compatibility until demand is concrete.

## Rejected ideas

- **I — General E2B/Daytona replacement:** missing packages, processes, writable workspaces and operational breadth dominate the task.
- **I — RL as the automatic first market:** the strongest evidenced workloads use Python/full environments; volume alone does not make them compatible.
- **I — “261 programs fixed” as the value headline:** compiler-corpus cases are not users, and transport repair may reveal later failures.
- **I — Full timer parity before payloads:** a supported minimal code-mode contract can omit timers; it cannot process an oversized tool result it never receives.
- **I — Immediate x86 port:** costly prior estimate, no qualified blocked partner yet; validate placement first.
- **I — Full Linux fallback built from scratch:** use an established tier and explicit routing rather than add a second infrastructure project.
- **I — Standalone multi-tenant hosted service now:** no external demand, containment/readiness gaps and no complete hosted cost model.
- **I — Selling deterministic replay as built:** pristine restore and fresh entropy are not a recorded deterministic effects contract.
- **I — “A million computers for a nickel” as a purchasing argument:** component CPU arithmetic excludes hosting, operations, labor and buyer workflow value.
- **I — Pure spectacle instead of independent use:** a strong CV demo is worthwhile, but only another operator's workload and installation can validate the product hypothesis.
