# Sofort across scale: usefulness, economics, and a business worth building

Research date: **2026-10-25**. Research only: no existing project files changed, no commits, no posts, and no cloud resources provisioned. Public prices are USD list prices retrieved today; taxes, discounts, model inference, external tools, and network/storage charges are excluded unless stated. Willingness-to-pay ranges below are **customer-discovery hypotheses**, not observed demand or market-size estimates.

## Recommendation

**Start with a local MCP code-mode sandbox for developers building tool-using agents; monetize the same execution contract as an embedded automation runtime for SaaS companies.** The useful promise is simple: an agent gets a disposable computer with exactly the tools it needs, while credentials and authority remain with the host.

The laptop experience can earn distribution before Sofort operates a cloud. The SaaS product can earn meaningful revenue before Sofort proves hyperscale density. Large-scale infrastructure licensing becomes plausible after sustained Linux metal measurements and independent security review. A general-purpose E2B replacement would require a much larger compatibility and operations project.

The strongest economic insight is that tiny snippets can have almost negligible *marginal CPU cost*, yet still have substantial customer value because they make a new product feature feasible. Saving one engineer from building an execution-and-policy service can matter more than saving ten cents per million calls.

## What the evidence supports today

The primary local sources are [FINAL.md](../../FINAL.md), [PLAN-R5.md](../../PLAN-R5.md), the [integrated README](../../jitk/README.md), [quiet benchmark](../../jitk/bench/RESULTS-quiet-2026-10-24.md), [native-watchdog benchmark](../../jitk/bench/RESULTS-native-watchdog-2026-10-24.md), [MCP measurements](../../jitk/mcp/RESULTS.md), and the [2026-10-25 synthesis](../next/SYNTHESIS.md). These are existing results, not rerun for this report.

- **Implemented:** fresh single-use hardware microVMs using libkrun/HVF on macOS and libkrun/KVM on Linux; static QuickJS and demonstrated Lua; a small custom Rust kernel; JSON-lines tool I/O through a trusted TypeScript executor; a native watchdog; bounded pools; a working MCP server; and a restricted read-only guest resource filesystem.
- **Measured on macOS:** approximately 0.285 ms p50 for a raw parked one-tool run; approximately 5.9–6.0 ms raw cold execution; approximately 9.2–9.6 ms executor cold execution after the watchdog change; approximately 4.8 CPU-ms per tiny VM lifecycle; and approximately 10.7 MiB reported VM process footprint in the canonical comparison.
- **Closer to the actual local user experience:** the long-lived MCP server measured approximately **2.1 ms p50 one-tool calls**, including SDK and stdio, with approximately 0.36 ms added over its in-process core. First client use was approximately 5–6 ms after server warmup. This is a different harness from the raw VM benchmark.
- **Refill:** approximately 684 VM/s with **eight concurrent builders**. Inspection of `bench/run.py:refill` shows eight workers, not a benchmark restricted to eight dedicated physical cores. Do not turn this into a guaranteed per-core cloud capacity claim.
- **Accounting limits:** CPU includes child user+system time through reap but excludes watchdog/supervisor CPU. The 10.7 MiB process footprint excludes HVF kernel allocations and is neither configured guest RAM nor all-in marginal host memory. Later loader changes and filesystem results use different revisions; do not subtract their savings from the older number and advertise a synthesized new baseline.
- **Linux:** nested-KVM functionality has been demonstrated; production bare-metal latency, CPU cost, and density remain unmeasured. Nested results do not validate a cloud price/performance claim.
- **Compatibility:** the loader currently admits restricted static ARM64 executables, with a 2.5 MiB payload arena and substantial mapping/thread/signal limitations. There is no demonstrated general Python, Node, npm, shell, browser, or arbitrary Linux workload support. A Python *client SDK* and Python *inside the guest* are separate deliverables.
- **Roadmap:** shared snapshots, tiny private deltas, thread-free waiting, and late-bound grants are well-motivated proposals. The synthesis explicitly labels sub-2-MiB density, faster restore, and lower CPU numbers as targets.

The older [kill-criteria ledger](../../jitk/docs/KILL-CRITERIA.md) freezes R4 failures; the later integration report records fixes to the import guard and watchdog. Neither document justifies blanket production-safety claims. Remaining exposure gates and the final-artifact hostile matrix still matter.

“Agent-grown” means an **offline development and verification loop**. It does not mean a production request asks an LLM to compile a new kernel before executing. The latest synthesis favors shared runtime/kernel images with per-run policy until specialization proves a measurable benefit.

## 1. Solo developer / indie hacker

**Job to be done:** let an agent write small programs that combine tools, filter results, and compute locally without granting that program ambient access to the laptop.

**Value proposition:** “Give your agent a disposable computer on your Mac, with only the files and tools you explicitly provide.”

### Useful laptop work

An indie developer can ask an MCP-capable coding assistant to run JS that compares API responses, checks a generated configuration, computes a pricing scenario, joins issue and release data, or reduces a large local dataset to a small answer. A provider can expose a narrow read-only project-data interface; the guest can loop and transform without receiving a general shell or filesystem mount. Local draft-generation tools can return a patch or proposed automation for review.

The code-mode benefit is expressing loops and `Promise.all` in one execution rather than making the model narrate every individual tool call. Potential model-round-trip and context savings depend on the task; measure them rather than assume a multiplier. The existing parallel-tool benchmark supports host-side concurrency, not a particular token-savings claim.

This can integrate with Claude Code, Cursor, or Codex **as an additional MCP execution tool**, subject to each client's configuration. It does not automatically intercept their built-in shell or protect all other MCP servers. If the agent still has a separate unrestricted terminal, the overall assistant still has that authority.

**Privacy:** code execution can remain entirely on the laptop, with no Sofort cloud account or sandbox upload. Fully zero-cloud use additionally requires a local model and local tool providers. A cloud model can still receive the prompt, source, tool results, or final answer; an authorized host tool can still send data off-machine. “No guest network” describes the guest boundary, not the whole agent workflow.

### The five-minute onboarding to build

This is a proposed product flow, not a claim that today's source build takes five minutes:

1. **Minute 0–1:** download a signed/notarized Apple Silicon package containing the runtime, tested image, and launcher. A diagnostic confirms HVF access and prints the supported platform. No Rust toolchain or Docker should be required for the first run.
2. **Minute 1–2:** choose an MCP client and generate its local stdio configuration, showing the exact change. Start with two warm VMs and a deliberately small tool grant. Offer a no-model smoke test first.
3. **Minute 2–3:** run an included invoice/issue-data fixture. Ask the agent to join records, find duplicates, and return a short explanation. Read only the explicitly selected fixture through a bundled provider; show the few tools available to the guest.
4. **Minute 3–4:** attempt an unauthorized read and a direct network request. Show a clear denied/unsupported result and a concise host-side tool trace. Run another snippet to show that guest globals do not persist.
5. **Minute 4–5:** connect one real read-only data source, repeat a useful task, and save the recipe. State plainly which output will be sent to the model. Keep write actions out of this first-run demo until approval is implemented properly.

The delight is “it worked locally and I understand its permissions.” Kernel LOC and boot-time graphs are supporting details.

**Missing features:** binary distribution and updates; dependable client-specific setup; packaged useful providers; generated tool typings; understandable errors; per-run permission display; a trace viewer; approval UX; a modest recipe library; and a more representative workload suite. The current MCP server has demo math/KV providers and no approver: approval-required calls fail closed. Its HTTP mode is loopback-only and unauthenticated; stdio is the right initial delivery surface. See [MCP README](../../jitk/mcp/README.md).

**Willingness to pay:** likely **$0 for the local core**, perhaps **$10–20/month** for a convenient desktop experience, managed connectors, team policy sync, or support. Treat this as a distribution wedge first. Local execution by itself is unlikely to command a large subscription from indies who already have a terminal.

## 2. Startup building an agent product

**Job to be done:** accept model-generated tool programs from end users and execute them with bounded resources, predictable permissions, and low orchestration overhead.

**Value proposition:** “Add isolated code-mode execution to your product without running a full Linux workspace for every short tool program.”

The good fit is an assistant that combines CRM/search/database tools, transforms JSON, evaluates rules, or runs user-defined business logic. Sofort can live beside the application's tool gateway, keeping credentials and bulk data close to their owner. The existing Cloudflare Code Mode `Executor` and TanStack `IsolateDriver` integration provide a concrete starting point, not a completed commercial SDK.

### When it can replace a sandbox provider

Replace **the short stateless JS glue-code slice** of E2B/Daytona usage when the application already owns useful host tools. Keep a full sandbox for Python data science, pip/npm installs, git/build/test, writable workspaces, browsers, long-lived sessions, or arbitrary native binaries. A hybrid router can send known supported recipes to Sofort and other tasks to a general sandbox; fallback must preserve the intended permission contract and never silently widen authority.

E2B documents JS/TS and Python SDKs plus resumable Linux environments. Daytona documents broad language support and complete sandbox environments. Their convenience and compatibility are part of what customers buy. [E2B documentation](https://docs.e2b.dev/), [Daytona documentation](https://www.daytona.io/docs/).

Cloudflare is a closer competitor for JS glue: Dynamic Workers accept code at runtime with explicit bindings and egress control. Sofort's opportunities are local/on-prem placement, a hardware VM boundary, and a different commercial model. No-network-by-default and capability-style APIs alone are not exclusive advantages. [Dynamic Workers overview](https://developers.cloudflare.com/dynamic-workers/).

### Cost and latency in the buying decision

E2B currently lists **$0.000014/vCPU-second + $0.0000045/GiB-second**, with Pro at **$150/month plus usage**. Daytona lists the equivalent **$0.0504/vCPU-hour + $0.0162/GiB-hour**, with storage separately priced. The runtime-duration examples in the economics section show why very short snippets may be overserved by a whole reserved sandbox. These are billing models, not evidence that every provider consumes a full core continuously. [E2B pricing](https://e2b.dev/pricing), [Daytona pricing](https://www.daytona.io/pricing).

For startup-facing latency, quote Sofort's approximately **2.1 ms local warm MCP** and **9–10 ms local cold executor** measurements with their platform. E2B's March 2025 Hugging Face case reports **150–170 ms session starts**; Daytona currently advertises **under 90 ms** sandbox creation. These are vendor results with different hardware, network placement, runtime state, and lifecycle semantics; Daytona's headline is not proof of its VM-tier boot latency. They establish an interesting hypothesis to test, not a trustworthy “X times faster” claim. [E2B customer case](https://e2b.dev/customers/how-hugging-face-is-using-e2b-to-replicate-deepseek-r1), [Daytona overview](https://www.daytona.io/docs/).

The product metric is end-to-end agent task latency and cost. If a model call takes seconds, saving tens of milliseconds on one execution may have little visible effect. If every task runs dozens of short programs or waits on many tool round trips, placement and orchestration become more valuable.

**Missing features:** stable TypeScript and Python *client* SDKs; versioned execution API; authenticated hosted endpoint; request/tenant identity; quotas; cancellable async tool gateway; logs and billing; robust overload handling; runtime version pinning; production Linux support; an escape hatch to a larger sandbox; and clear compatibility documentation. Python-in-guest needs an explicit separate feasibility program, larger image/heap class, package policy, and representative tests. It is not “a few more syscalls” until demonstrated.

**Willingness to pay:** test **$100–1,000/month** for hosted execution and support, increasing with committed capacity or valuable integrations. A very early startup with low volume may rationally prefer an existing provider's free credits. Sell avoided infrastructure work and capability control before selling a small per-call compute saving.

## 3. Mid-size SaaS: customer automations and plugins

**Job to be done:** let each customer create custom transformations, formulas, enrichment workflows, and agent-written plugins without running them in the main application's trust domain.

**Value proposition:** “Turn customer-specific feature requests into small, permissioned automations that run next to your SaaS.”

Examples include a CRM customer defining lead scoring, a support product routing tickets, a table product normalizing records, a reporting product adding a custom metric, or an internal-tools product running a short approval workflow. These are Zapier/Retool/Notion/Airtable-style product categories, not claims that those companies need Sofort or are prospective customers.

The host grants business operations such as `records.query` for one workspace and `drafts.create` for one output collection, instead of exposing broad API credentials. Each invocation gets a fresh VM; durable state stays in the SaaS's database. The shared value is new customization revenue, fewer one-off integrations, and reduced engineering/security work.

A critical distinction is **tenant authorization versus sandbox isolation**. The trusted executor must derive workspace/customer identity from an authenticated context. A tool named `records.read` is not scoped if it accepts an arbitrary tenant ID from the guest. Put authorization inside every host capability and treat schema validation as only one layer.

Repeated automations may be better served by cached runtime images and stable recipes than unique per-request images. Small request pools can handle many sequential executions; one million installed customer automations does not imply one million resident VMs.

**Missing features:** tenant-bound grants; quotas and spend controls; authorization-aware tooling; timers/webhooks and a job queue; retry and idempotency contracts; secret vault integration; durable audit export; versioning and rollback; a customer editor/test runner; approval/simulation UX; retention/redaction policy; resource attribution; and deployment support. These belong around the execution engine. Side effects require explicit semantics: killing a VM cannot undo a completed payment or email. An execution retry must not duplicate external actions.

The current run-local taint policy does not automatically govern data moved through host state into later runs. Cross-run confidentiality and approval must be enforced by the SaaS/tool gateway. This is especially relevant because the demo suggests separate runs for operations that cannot be approved within the current MCP server. [Policy README](../../jitk/executor/policy/README.md), [code-mode resource](../../jitk/mcp/resources/code-mode.md).

Cloudflare Workers for Platforms is a credible baseline for this tier: **$25/month**, including **20M requests, 60M CPU-ms, and 1,000 scripts**, with request/CPU/script overages. This is evidence that basic JS hosting is already cheap; Sofort needs to win on placement, the VM boundary, local-to-production consistency, or an unusually easy embedding experience. [Workers for Platforms pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/).

**Willingness to pay:** test **$1,000–10,000/month** for a supported embedded/BYOC deployment, policy tooling, and operational responsibility. A **$5,000–25,000 paid pilot** can validate one production workflow and integration cost. Budget ownership is likely the product/platform team, with security as an approver. These ranges should be anchored to customization revenue or engineering time saved, not microVM counts.

## 4. AI labs, cloud providers, and very large agent platforms

**Job to be done:** execute huge numbers of short untrusted programs or tool policies with bounded cross-tenant effects and controllable fleet economics.

**Value proposition:** “Buy a fresh hardware boundary for each short agent program while spending only a few CPU milliseconds on its lifecycle.”

Potential workloads include tool-use policy evaluation, small reward/verifier programs, synthetic environment steps, MCP tool composition, and transformation stages in agent pipelines. For RL, the kernel is an execution substrate, not a training environment by itself: the buyer still needs task data, reward integrity, reproducibility, scheduling, and runtime coverage. E2B's Hugging Face case establishes that sandboxed generated-code verification is a real workload. It does not establish demand for a restricted QuickJS kernel.

Competitive-programming rollouts frequently require languages, compilers, subprocesses, libraries, and CPU throughput beyond the present guest. Browser/desktop RL is outside the current fit. The best first lab experiment is a **held-out short-JS/tool-use workload**, with a separate trusted verifier and identical capability APIs across backends.

The buyer will ask for total useful throughput, p99 under overload, host memory at live concurrency, noisy-neighbor behavior, attack containment, and resource billing. A headline boot number does not answer these questions. Nor does a small kernel guarantee superior economics: the local strict Hyperlight adapter already reports approximately **3.5 CPU-ms and 1.8 MiB**, better than Sofort on those measures, albeit with different engine/ABI/concurrency behavior. Sofort must prove a useful workload or deployment advantage. [Local comparison](../../FINAL.md).

**Missing features:** Linux bare-metal evidence; a full memory ledger; sustained fleet tests; snapshot/reset correctness; immutable page sharing; non-pinning tool waits; fair scheduling/backpressure; resource accounts that include the host; independent hostile-input/security review; attested versioned artifacts; operational telemetry; and an ABI/runtime compatibility commitment. Broader x86 support should follow buyer evidence, not be implied by libkrun's general capabilities.

**Willingness to pay:** propose a **$25,000–100,000 integration/benchmark pilot**, followed by a negotiated support/embedding agreement in the **$100,000–1M/year** range only if a valuable workload and ownership boundary are proven. This is a hypothesis with long procurement and high support expectations. Hyperscalers can build or fork; a tiny engine without adoption, maintained integration, or compelling measurements has weak standalone pricing power.

## 5. Regulated enterprise and on-prem deployment

**Job to be done:** allow agent-written logic near sensitive systems while making authority, data movement, and execution history reviewable.

**Value proposition:** “Keep agent execution in your environment and make every external effect pass through your own permissioned tools.”

The architecture has useful ingredients: no guest network stack, a small custom kernel surface, single-use VMs, confined VMM processes, host-side policy decisions, and per-call credentials that do not need to enter the guest. A host gateway can expose a narrow patient-record query, document classification function, or payment-draft operation. A one-run trace can identify code/image hashes, granted scope, tool calls, approval decisions, and outputs.

**“Tiny TCB” needs qualification.** The custom kernel is small; the total trusted system includes libkrun/device emulation, the host OS and hypervisor, confinement, protocol handling, the TypeScript executor and dependencies, providers, identity, and deployment/update mechanisms. Treating the guest interpreter as hostile makes hardware isolation useful, but it does not remove host tools from the security argument. Small source size makes some review more tractable; it is not an assurance level.

Similarly, no guest network does not prevent exfiltration through an authorized egress capability, logs, or the model itself. Hardware virtualization does not settle side channels, host bugs, malicious providers, or denial of service. The existing confinement and hostile suites are bounded evidence with named gaps, not a complete security proof. [Security integration](../../07-security-sandbox/R3.md), [sandbox contract](../../jitk/vmm/sandbox/README.md).

### Compliance angles that can be substantiated

- **Least privilege and access evidence:** scoped, short-lived capability grants can support resource-centered access controls. On-prem network location alone is insufficient; authorization still matters. This aligns with principles in [NIST SP 800-207](https://www.nist.gov/publications/zero-trust-architecture) and [NIST SP 1800-35](https://csrc.nist.gov/pubs/sp/1800/35/final); it does not make Sofort a certified zero-trust product.
- **Data minimization and security by design:** only admitting necessary inputs/tools and avoiding unnecessary sandbox uploads can support a controller's GDPR Articles 25/32 measures. Logs, model providers, retention, resilience, and international transfers still need evaluation. On-prem execution does not itself establish GDPR compliance. [GDPR text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679).
- **Healthcare deployments:** a small local runtime may reduce an external processing dependency. If a hosted service processes ePHI on a covered entity's behalf, a VM boundary does not eliminate applicable BAA and risk-analysis obligations. [HHS cloud guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html).
- **SOC 2 / ISO 27001 procurement:** supply evidence about access, logging, change control, incident response, patching, and vendor responsibility. Do not advertise that a kernel or sandbox architecture confers an organizational attestation/certification.

**Missing features:** signed releases and SBOMs; reproducible artifacts where feasible; vulnerability response and patch SLAs; independent review; SSO/RBAC and workload identity; tamper-evident audit export; redaction/retention; tenant/region controls; disaster recovery and availability design; an enterprise deployment guide; and an explicit shared-responsibility model. Offline upgrades and local-model/local-tool operation are valuable on-prem options, not demonstrated enterprise packaging today.

**Willingness to pay:** test **$25,000–100,000 for a scoped pilot** and **$50,000–250,000/year** for supported on-prem deployment, private releases, and agreed response times. This is a later market: procurement and assurance work can exceed the effort of the current runtime implementation.

## Economics: cost per one million executions

### A. Establish a public cloud unit price

Use **AWS c7g.metal in us-east-1, Linux On-Demand: $2.32/hour, 64 vCPUs, 128 GiB**, a plausible ARM64 metal host class for a future KVM deployment. AWS documents the hardware shape; its public pricing feed returned the exact rate below. This is a costing reference, not a deployed or validated Sofort host. [AWS C7g specifications](https://aws.amazon.com/ec2/instance-types/c7g/), [AWS public regional price feed](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/US%20East%20%28N.%20Virginia%29/Linux/index.json).

Retrieved feed metadata: `hawkFilePublicationDate = 2026-10-23T22:13:55Z`; matching `Instance Type = c7g.metal`, `Location = US East (N. Virginia)`, `Operating System = Linux`, `price = 2.3200000000`; rate code `X8WMCBBQRGYPG6JY.JRTCKXETXF.6YS6EN2CT7`. The feed was fetched and gzip-decoded directly during research; no AWS credentials or instance were used.

The host costs **$0.03625 per provisioned vCPU-hour**, including its bundled RAM capacity. Do not add a second independent RAM bill to that same host; instead check whether memory forces more hosts.

### B. Sofort's 4.8 CPU-ms napkin math

For one million tiny executions:

```text
1,000,000 × 4.8 ms = 4,800 CPU-seconds = 1.333 CPU-hours
1.333 × ($2.32 / 64) = $0.0483 per million

CPU-capacity allocation at useful utilization u:
C = N × (CPU-ms / 1,000) / 3,600 × ($2.32 / 64) / u
```

At **70% useful utilization**, this is approximately **$0.069/M**; at **10%**, **$0.483/M**. These are **hypothetical CPU-capacity allocations**, not a service quote or all-in COGS. The 4.8 figure is a rounded local tiny-workload median, not the fleet's average. A proper volume cost estimate needs mean CPU across successes, failures, cancellations, teardown, unused warm-VM expiry/refill, and real workloads.

The largest unproven assumption is transplanting M4 Pro/HVF CPU time onto Graviton/KVM. Host executor CPU, watchdog, HVF/KVM kernel costs, payload work, pool wastage, and ops are not captured by multiplying this single figure. The native benchmark's structured-JSON findings also show that some useful payloads cost substantially more than a trivial lifecycle.

### C. Compare execution architectures without inventing benchmarks

| Execution strategy | Assumed/measured CPU per fresh tiny run | Ideal host CPU-capacity cost/M | At 70% useful utilization | Evidence status |
| --- | ---: | ---: | ---: | --- |
| Sofort raw lifecycle | 4.8 ms | $0.048 | $0.069 | Mac observation applied to a hypothetical AWS host |
| Full Linux/Firecracker lifecycle scenario | 20 ms | $0.201 | $0.288 | Sensitivity assumption, not a measured Firecracker result |
| Full Linux/Firecracker lifecycle scenario | 50 ms | $0.503 | $0.719 | Sensitivity assumption |
| Full Linux/Firecracker lifecycle scenario | 100 ms | $1.007 | $1.438 | Sensitivity assumption |
| Self-hosted V8 isolate scenario | 1 ms | $0.010 | $0.014 | Assumption, not a measured Sofort comparison |
| Self-hosted V8 isolate scenario | 5 ms | $0.050 | $0.072 | Assumption |

This table answers “what would the CPU bill be *if* measured lifecycle CPU were X?” It does not rank products. Firecracker publishes a **≤125 ms wall-clock** boot-to-init specification and **≤5 MiB VMM-thread overhead** for a declared guest configuration. Neither is total CPU per execution or total guest memory. Snapshot restores, tuned kernels, and pooled/session reuse can make its lifecycle very different from a fresh Linux boot. [Firecracker specification](https://github.com/firecracker-microvm/firecracker/blob/main/SPECIFICATION.md).

V8 isolates may be cheaper and faster for the same JS task. Cloudflare documents shared-process isolates plus additional process isolation and sandboxing. Sofort offers a different boundary and deployment model, not a demonstrated universal security or cost advantage. QuickJS's local 3–5× glue-code throughput disadvantage to V8 matters once useful computation dominates lifecycle overhead. [Cloudflare security model](https://developers.cloudflare.com/workers/reference/security-model/), [local QuickJS verdict](../quickjs-verdict.md).

### D. Compare public managed-service bills

These are **normalized billing examples**, not common-hardware benchmarks. One execution is one short snippet; a provider may reuse one sandbox across many snippets. “One billed second” is an explicit scenario, not a claim about a mandatory one-second minimum.

| Managed service / configuration | Assumed billed workload per execution | Approximate variable charge/M | Important qualification |
| --- | --- | ---: | --- |
| E2B, 1 vCPU + 1 GiB | 1 sandbox-second | $18.50 | Shape availability depends on plan; plan fee excluded |
| E2B, 1 vCPU + 1 GiB | 10 sandbox-seconds | $185.00 | Includes time waiting while allocated |
| E2B, listed default 2 vCPU + 4 GiB | 1 sandbox-second | $46.00 | Full Linux environment, not equivalent scope |
| Daytona, 1 vCPU + 1 GiB | 1 sandbox-second | $18.50 | Extra billable storage excluded |
| Daytona, 1 vCPU + 1 GiB | 10 sandbox-seconds | $185.00 | Confirm chosen sandbox class and billing details |
| Standard Cloudflare Worker | 1 ms CPU/request | $0.32 | Marginal rate after included quotas; deployment model differs |
| Standard Cloudflare Worker | 4.8 ms CPU/request | $0.396 | Same nominal CPU duration, not the same workload speed |
| Dynamic Worker, fresh unique code/ID every execution | 1 worker creation + 4.8 ms CPU | $2,000.396 | Marginal exhausted-quota rates; alternatives/caching change this drastically |

E2B arithmetic is `1M × seconds × (vCPU × 0.000014 + GiB × 0.0000045)`. Daytona's listed hourly rates convert to the same compute/memory unit prices. Cloudflare's request/CPU arithmetic is `$0.30 + CPU-ms-per-request × $0.02` per million requests at marginal overage rates. Base plans, included quotas, and credits can dominate small accounts. [E2B rates](https://e2b.dev/pricing), [Daytona rates](https://www.daytona.io/pricing), [Workers rates](https://developers.cloudflare.com/workers/platform/pricing/).

**The Dynamic Worker fee is specifically relevant to fresh agent code.** Current pricing adds **$0.002 per unique worker per day**, with **1,000 included per month**. Code/ID changes count; no ID or `.load(code)` counts per invocation. A million one-off workers in an otherwise unused billing month would therefore cost about **$1,998 in creation fees plus the paid plan**, with those request/CPU amounts still within Standard's included quotas at this workload. The table instead shows the *marginal exhausted-quota* case. Reusing stable code/IDs or an allowed fixed interpreter architecture changes the economics; assess that alternative before making a competitive claim. [Dynamic Workers pricing and counting rules](https://developers.cloudflare.com/dynamic-workers/pricing/).

For a SaaS with stable customer scripts, Workers for Platforms may be the more appropriate product and can be very inexpensive. It is misleading to use the fresh-Dynamic-Worker case as “the price of V8.” Likewise, it is misleading to compare Sofort's raw hardware allocation to E2B's retail bill and label the ratio a measured efficiency gain.

### E. Utilization and host minimums change the answer

A c7g.metal costs **$55.68/day**, approximately **$1,693.60 for 730 hours**, whether it runs one snippet or millions.

- At **1M executions/day**, arrival rate is only **11.6/s**. The 4.8-ms assumption requires approximately **0.056 CPU cores on average**. Renting a dedicated 64-core metal host for that customer allocates **$55.68/M**, not five cents. Sharing capacity, an existing on-prem server, or a local laptop changes this completely.
- At **100M/day**, the CPU-only average is **5.56 cores**. One whole host still allocates approximately **$0.557/M**, before availability replicas or overhead. CPU is not yet the reason to buy a second host, but memory, latency, regional placement, or isolation policy might be.
- At **1B/day**, average arrival rate is approximately **11,574/s**, requiring **55.6 ideal CPU cores**. At a 70% target, approximately **79.4 provisioned cores** are needed before extra payload/host costs; whole 64-core hosts imply at least two hosts, approximately **$111.36/day**. This is a model, not demonstrated throughput or an HA design.

The measured eight-worker refill rate is lower than what a naive 1/CPU-time conversion suggests, illustrating that host scheduling and launch bottlenecks matter. Do not extrapolate it linearly from Apple hardware to a Graviton fleet. Measure sustained completed useful runs, not just READY events.

**Concurrency follows waiting time, not request count alone.** At 1B executions/day and a one-second average run lifetime, Little's law gives approximately **11,574 live VMs**. Multiplying by the historical 10.7 MiB proxy gives approximately **121 GiB**, before host/kernel/pool overhead. At ten seconds, it is approximately **1.18 TiB**. These are arithmetic illustrations using a Mac process-memory observation, not Linux capacity forecasts. Tool waits currently pin host threads; no CPU busy-spin is required for thread stacks and scheduling to become bottlenecks.

For short ten-millisecond lifetimes the same arrival rate gives only approximately 116 live VMs. This is why the “many short executions” opportunity is different from “thousands of idle agent workspaces.” Shared images and WAIT/resume could improve the latter, but have not earned production numbers yet. [Scale blockers](../next/SYNTHESIS.md).

### F. What the buyer should measure

Use `max(CPU-required hosts, memory-required hosts, throughput-required hosts, minimum availability hosts) × host price`, then add control-plane, logs, image delivery, tools, support, and development costs. CPU and memory prices bundled in one EC2 host should not be double-counted.

Benchmark identical task/result/capability semantics across Sofort, a fresh Firecracker snapshot, a deliberately reused Linux session, and a fresh V8 isolate. Record complete lifecycle CPU, private/total host memory, dirty pages, failures, pool churn, tool-wait lifetime, and p50/p99 under sustained arrival load. Include cold images, malformed programs, cancellations, and realistic JSON. Compare isolated execution contracts explicitly: fresh JS state inside a reused VM is not a fresh hardware boundary.

At a **1M/day** workload, moving from an assumed 50-ms lifecycle to 4.8 ms saves approximately **$0.46/day of ideal CPU allocation** at this reference rate. At **1B/day**, it saves approximately **$455/day**, roughly **$166k/year** before utilization effects. The first is not a business case by itself; the second can matter, but requires evidence at that scale. Avoid suggesting that every startup has hyperscaler economics.

## Business model choices

### Open-source core + hosted service: strongest long-term default

Release an embeddable, testable local runtime. Sell an authenticated managed API, shared fleet capacity, observability, durable audit export, policy administration, connectors, and support. This aligns discovery on a laptop with production adoption.

A testable starting price is **$29/month for an individual hosted tier**, **$199/month for a team tier**, and metered execution beyond included budgets. Meter CPU and live memory/time for larger workloads; attach a clearly defined minimum/request fee for scheduling and control-plane work. Tiny-run pricing such as **$1–5/M** is a hypothesis to test after all-in COGS measurement, not a margin promise. Long tool waits and CPU-heavy programs need a separate resource class; otherwise the cheapest-looking tier subsidizes the most expensive behavior.

The hosted offer should justify itself through reliability and convenience even if a customer knows how to self-host. Raw compute markup is vulnerable to a mature isolate provider's pricing.

### Embedded/BYOC support and enterprise subscription: best first paid path

Package the runtime and tool gateway for the customer's infrastructure. Charge for supported releases, integration, policy/audit features, and an explicit support boundary. Start with a paid SaaS design partner before operating a large public service. Sell annual support/capacity commitments rather than a royalty on every laptop execution.

A narrow, stable JS runtime for customer automations is a more manageable commitment than promising arbitrary Linux compatibility. Make it possible to export recipes and traces so trust and adoption do not depend on data lock-in.

### License or OEM integration to clouds and agent platforms: later option

Clouds may buy integration work, an embedding contract, maintained optimizations, or a commercially licensed optional component. A permissively released core cannot later be sold as an exclusive right that users already have. Preserve clear ownership and contributor terms if dual licensing is contemplated; review transitive licenses before making a commercial distribution offer.

The best leverage would be proven Linux density, an execution contract with adoption, and a supported capability gateway. A custom kernel alone is comparatively easy for a well-funded buyer to replace or fork. Keep the commercial argument grounded in maintained value.

### Paid local devtool: useful complement, weaker standalone company

A desktop app can monetize easy MCP setup, permission inspection, connector management, repeatable recipes, and team policy. Test the $10–20/month range with active users. Pure local execution has low hosting COGS but must overcome users' existing tooling and subscription fatigue. The core should remain usable without the paid UI.

### Acqui-hire: possible outcome, not a customer proposition

The combination of a small execution substrate, measured tool orchestration, confinement fixes, and offline ABI growth could interest an agent or infrastructure team. Demonstrated adoption and independent Linux results are stronger assets than a speculative kernel-generation story. Do not build the product around an assumed acquisition or imply buyer interest without evidence.

## What to open source

Open the **kernel, VMM adapter and libkrun fixes, protocol, executor, local MCP server, core capability enforcement, watchdog, reproducible build inputs, benchmark harness, hostile tests, and Linux differential-growth contracts**. Publish the supported ABI and workload limits. Keep the reset contract and enforcement visible if snapshots ship. Security-relevant basics should not be hidden behind a paid plan.

Use a familiar permissive license such as Apache-2.0 for code the project can license that way, after auditing ownership, bundled third-party code, and notices. This is a recommendation, not a statement about the current repository's license. Separate upstream attribution and redistribution obligations from the project's own licensing choice.

Charge for running fleets and delivering organizational features: managed scheduling, regional/BYOC deployment, team administration, enterprise identity, signed supported releases, audit retention/export, premium connectors, and support SLAs. The defensible assets are distribution, workload coverage, policy integrations, operations, and trust. A four-thousand-line runtime by itself is not a durable proprietary moat.

Publish only claims tied to artifact versions and complete evidence. Opening code is not the same as declaring the prototype safe for hostile production exposure. The older exposure criteria and newer fixes should be reconciled in one current release checklist before a public binary launch; do not gate a research announcement on invented commercial readiness.

## The single best initial wedge

**Developer-first local MCP code mode for people building agents with real tools.** Narrow the first audience to TypeScript agent/MCP developers on Apple Silicon who want to execute short tool programs with no sandbox cloud account. They can supply tool APIs today and do not require pandas, npm, or browser compatibility to get value.

The first artifact should be a signed local package, an excellent permissions demo, and one useful read-only provider. The first user action should produce a result from their own selected data in five minutes. The first paid expansion should be a SaaS team embedding those same recipes and grants in customer automations.

This wedge has a credible sequence: **local usefulness → published integration examples → one paid embedded deployment → Linux metal evidence → hosted scale**. It does not require winning all five tiers at once. Local MCP users are a distribution hypothesis; SaaS teams are the nearer revenue hypothesis.

### A concrete validation plan

1. Recruit ten agent/MCP builders; observe installation without live help. Target at least eight reaching a useful result in five minutes. Record why the others fail.
2. Ask users to return with one real workflow, not a toy benchmark. Track weekly reuse, recipe count, permission-denial confusion, and whether they still need a general sandbox.
3. Seek three SaaS design partners with a specific customer-automation backlog; ask for a paid pilot tied to an actual production workflow. Measure integration time and support burden.
4. Run identical local short-JS tasks against V8 and the current Hyperlight baseline. Continue investing in the custom kernel only where its ABI, capabilities, deployment, or orchestration provide useful differentiation.
5. Before cloud price/performance marketing, run metal end-to-end benchmarks and reconcile total CPU, memory, idle reserve, and failure costs. Price the service from that evidence.

If developers like the demonstration but do not reuse it, or SaaS teams need full Python/Linux before they can integrate, revisit the wedge. Stars and fast `return 2` results are not evidence of a recurring job.

## Twitter/X positioning

Lead with the user outcome, then the concrete boundary, then one measured number. Explain “purpose-built computer” with a useful example. Keep the kernel-growth story as a follow-up engineering post; otherwise readers may imagine an LLM modifying the running kernel or infer arbitrary Linux support.

Suggested lead post, a draft only:

> I built Sofort: a disposable computer for agent-written tool programs.
>
> It runs locally on a Mac, in a fresh microVM, with only the tools you grant it.
>
> The MCP demo runs in ~2 ms warm on my machine. No sandbox cloud account needed.
>
> Looking for agent builders with a real workflow to try.

Suggested supporting post:

> The useful part: write a loop, call tools in parallel, return only the result you need.
>
> Credentials stay in the host executor. Each program gets a single-use VM.
>
> Today: JS tool glue and a restricted static ABI. Python and Linux fleet economics are still work ahead.

Use a laptop recording that performs a useful read-only task, shows the available grants, and rejects an unauthorized operation. If the binary is not packaged and the exposure gates remain open, label it a research prototype and invite design partners rather than imply production readiness.

Safe supporting facts: approximately **2.1 ms warm one-tool MCP p50 on the tested Mac**, **0.285 ms on the raw parked VM path**, a **small custom kernel**, and **offline differential-tested growth**. Avoid “0.29 ms end-to-end,” “five cents per million all-in,” “cheaper than isolates,” “1.7k-line total TCB,” “runs any Linux program,” and “compliance built in.”

## Executive summary

1. Sofort's best current job is short agent-written JS that composes permissioned tools.
2. A local Apple Silicon MCP package is the strongest initial distribution wedge.
3. The useful local user-facing number is approximately 2.1 ms warm MCP, not 0.29 ms raw.
4. Five-minute onboarding requires packaged binaries, real providers, and clear permissions.
5. Zero-cloud execution is possible; fully private workflows also need local models/tools.
6. Startups can replace their glue-code slice, not their general Linux workspaces.
7. SaaS customer automations are the most plausible first paid deployment.
8. Python client support is straightforward product work; Python guest support is separate research.
9. At AWS's reference rate, 4.8 CPU-ms implies approximately $0.048/M ideal CPU allocation.
10. Dedicated hosts, host CPU, memory, idle reserve, tools, and operations raise actual COGS.
11. Fresh Dynamic Worker creation fees materially change one-off code economics; stable Workers remain cheap.
12. Firecracker CPU-cost comparisons require matched measurements; wall boot time is insufficient.
13. Linux metal, total memory, snapshots, and non-pinning waits gate hyperscale claims.
14. Open the core and enforcement; sell managed operations, embedding, governance, and support.
15. Pitch a disposable computer with explicit tools; earn broader claims through users and evidence.
