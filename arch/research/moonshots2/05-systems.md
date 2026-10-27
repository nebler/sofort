# Systems, hardware, and the physics of compute

Research date: **2026-10-27**. Lens: **SYSTEMS, HARDWARE AND THE PHYSICS OF COMPUTE**. Eight ideas, followed by a ranking and one bet.

**Labels:** **F** = sourced fact, including an attributed paper/vendor result; **M** = measurement; **I** = inference; **E** = estimate, calculation, scenario, or proposed target. **M-prior** identifies existing repository measurements, not experiments reproduced here. All external sources linked below were inspected on **2026-10-27**; publication years and relevant version dates accompany the citations. No new runtime, GPU, power, or network measurements were made. Arithmetic was checked locally. Decimal GB/TB and binary MiB/GiB are distinguished.

## The position

**I — Build a scheduler for where and when intelligence touches the physical world.** The useful unit is a bounded continuation plus its next required data and capabilities. Move it toward data; run ordinary transformations without repeatedly consulting a model; release scarce execution resources during waits; resume near the next bottleneck. The moonshot is a compute fabric whose placement and resource allocation follow the dependency graph of work.

**I — The strongest bet is visiting computation at data owners.** It can remove 100–1000× of a particular transfer without requiring models to make mistakes. Accelerator scheduling is the largest adjacent budget, but its obvious techniques are already occupied. A tiny kernel or a forkable file is an enabling mechanism, not the product.

**F — The worsening problem is observable, but infinite Jevons growth is not a physical law.** The IEA's **2026** update reports data-centre electricity demand growing **17% in 2025**, and AI-focused demand **50%**. Its central projection is **485 TWh in 2025 → 950 TWh in 2030**, with AI-focused demand tripling. It also identifies HBM supply constraints extending through at least 2027. These are sector estimates/projections, not agent-specific demand measurements. [IEA, *Key Questions on Energy and AI*, 2026][iea26]. The older **415 → 945 TWh** figures belong to the **2025** report and different baseline years. [IEA, 2025][iea25].

**I — Model-proof does not mean demand-proof.** A model 100× more capable may use fewer calls and finish individual jobs sooner. Every idea below must survive that possibility. The durable opportunity is in work requiring fresh external data, memory capacity, movement, deadlines, or physical power. If improved models eliminate a workload's external work entirely, that workload is not the wedge.

**F/I — Reading round one changes the criterion.** Its top bets were occupied-software upgrades, immune repair, failure-search gates, notarised computation, temporary swarms, fault-grown Node, and Oracle Foundry. This report does not require defective models or verification scarcity. It also incorporates the [capsule landscape](../v8/02-landscape.md): Vercel quickjs-wasi/Workflow, LangChain quickjs-rs, XS Sandbox, Golem, and VM providers already cover substantial pause/fork/recovery territory. The incremental claim must be a useful reduction in physical work against those mechanisms and ordinary state/replay baselines.

## The numerical constraints every idea must respect

### Memory movement, energy, and the roofline

**F — Horowitz's original ISSCC slides give rough costs at 45 nm, not universal contemporary constants.** Slide 32 uses **64-bit memory accesses**; mixing its table with later 32-bit reproductions creates misleading ratios. [Horowitz, ISSCC 2014, slide 32][horowitz-slides]; [paper, Figure 1.1.9][horowitz-paper].

| Primitive | F: rough energy in the original slide |
|---|---:|
| 32-bit integer add | 0.1 pJ |
| 32-bit floating-point add | 0.9 pJ |
| 32-bit floating-point multiply | 4 pJ |
| 64-bit access to an 8 KB cache | 10 pJ |
| 64-bit access to a 1 MB cache | 100 pJ |
| 64-bit DRAM access | 1.3–2.6 nJ |

**E/I — Interpretation:** the DRAM access costs about **325–650** of those FP multiplies. Normalizing the low DRAM figure to half a word gives about **650 pJ/32 bits**, close to the often reproduced **640 pJ** table entry; this is a normalization, not an independently measured modern value. The lesson is reuse and fewer transfers. The table does **not** establish joules per Internet byte, H100 token, or R2 request. Dennard's original constant-field scaling relationships [1974][dennard] and Horowitz's later account of voltage/leakage limits explain why adding transistors does not grant proportional free power.

**F — The memory wall is older than AI.** Wulf and McKee described the widening processor/memory speed gap in their December 1994 report, published March 1995. [Original report][memory-wall]. Williams, Waterman, and Patterson's Roofline model bounds attained arithmetic throughput by `min(peak FLOP/s, memory bandwidth × operational intensity)`. [2008 technical report; CACM publication 2009][roofline].

**F/E — A concrete accelerator:** NVIDIA lists H100 SXM at **80 GB HBM, 3.35 TB/s, up to 700 W**, and **1,979 TFLOP/s BF16 with sparsity**. Halving that advertised sparse peak gives approximately **989.5 TFLOP/s dense**, hence a dense ridge around **295 FLOP/byte**. [NVIDIA specifications, current][h100]. An illustrative **8-billion-parameter BF16** decoder streams roughly **16 GB** of weights per unbatched step: a **4.78 ms bandwidth-only floor**, before KV reads, kernels, communication, and other work. Its weight-only intensity is roughly **1 FLOP/byte** at batch one; batch 32 raises that idealized number toward 32, still below the ridge. These are analytical bounds, not promised token speeds. A small OS cannot raise HBM bandwidth.

**F/E — Joules need a system boundary.** Google's production study reports **0.24 Wh = 864 J** for the median Gemini Apps text prompt in **May 2025**, using a full-stack accounting methodology. It is not a conversion factor for arbitrary agent turns. [Google authors, August 2025][google-energy]. A 2026 primary measurement study covers **46 models, seven tasks, 1,858 configurations** and reports **3–5× energy differences associated with utilization**. [Chung et al., January 2026][joules]. Measure complete successful jobs, including unsuccessful speculation and idle infrastructure; TDP × time is only an explicitly assumed envelope, not measured savings.

### Latency, concurrency, and prices

| Constraint | F: source or E: explicit calculation | Consequence |
|---|---|---|
| Serial work | **E:** with 90% of a job in external waits, infinitely fast local compute gives at most **1.11×** end-to-end speedup. | Apply Amdahl to the actual critical path. |
| Larger work | **F/I:** Gustafson scales problem size with parallel capacity; he does not remove dependencies. | Stronger agents may explore more work, but that is a demand hypothesis. |
| Distance | **E:** at an assumed optical propagation speed of `2×10^8 m/s`, a 2,000 km path has a **20 ms RTT floor**, before route stretch and switching. | No global microsecond tool channel. |
| Transfer | **E:** 1 GiB over 1 Gbit/s takes **8.59 s**; 1 MiB over 10 Gbit/s takes **0.839 ms**, excluding RTT/processing. | A sub-ms local wake is not a sub-ms migrated wake. |
| Tail amplification | **E:** independent 1% slow events give `1−0.99^100 = 63.4%` probability of at least one slow event over 100 calls. | More fan-out or more steps makes tails a first-order issue. |
| GPU rent | **F:** Lambda lists a single H100 SXM instance at **$4.29/GPU-hour**; configuration and taxes matter. **E:** ten seconds of exclusive reservation costs **$0.0119**. [Current listing][lambda] | Reusing existing capacity saves money only if it displaces paid capacity or serves useful demand. |
| Workers glue | **F:** incremental Standard prices are **$0.30/million requests** and **$0.02/million CPU-ms**, with no duration charge. [Current pricing][workers-pricing] | **E:** eliminating 1 ms on a million calls saves only **$0.02 of CPU charges**. Sell bigger bottlenecks. |
| Dormant state | **F:** R2 Standard is **$0.015/GB-month**, **$4.50/million writes**, **$0.36/million reads**, no Internet egress charge. [Current pricing][r2] | **E:** one million 1 MiB images cost **$15.73/month** in storage; one billion park+load pairs cost **$4,860** in operations before allowances, retries, and history. |

**F — Primary lineage for the first two rows:** [Amdahl, 1967][amdahl]; [Gustafson, May 1988][gustafson]. **I:** parallel independent tool calls help; a decision depending on a fresh previous answer remains serial. Prefetching needs predictable future reads, not merely more cores.

**M-prior — Builder limits matter.** The [October 27 Linux memory comparison](../../jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md) reports **0.535 MiB/VM** for jitk-shard's one-tool slope and **0.527 MiB** for the strong in-process Hyperlight configuration. jitk-node adds about **35 MiB fixed** and has a **0.665 MiB/VM** slope in its smaller sweep. These are small-program nested-KVM measurements, not generic populated-agent footprints. The [frozen integration benchmark](../../10-minimalist-critic/r4/frozen/bench/RESULTS.md) has a contended raw parked one-tool p50 of **1.133 ms** and poorly resolved p99 of **127 ms**. The builder's sub-ms parking direction is useful; it is not evidence of a production sub-ms tail or of a unique density advantage.

**I — Keep four masses separate:** the guest continuation, its external datasets, the model weights, and the KV cache. A 1 MiB capsule does not contain or transport all four. Native jitk images and portable interpreter/Wasm images are also different artifacts; scriptc compilation does not make a native stack portable across CPUs.

## Eight ideas

### 1. Visiting compute: bring the agent's next operation to the data

**I — One sentence:** data owners accept bounded TypeScript/Wasm continuations and return small answers instead of exporting bulk datasets to remote agents. **E — 100× version:** make executable queries the standard inter-company agent interface, removing **100–1000× cross-boundary bytes** on selective workloads, rather than selling a faster remote desktop.

**F/E — Worsening problem and payer:** the IEA growth above means more capacity competing for physical infrastructure; the narrower agent-byte multiplier is a scenario, not measured market growth. If an enterprise goes from 10,000 to one million daily jobs, each reading 1 GiB centrally, it goes from roughly **10 TiB to 1 PiB/day** of transferred input. A job with a **0.5 MiB continuation and 0.5 MiB result** moves **1024× fewer WAN bytes** than a 1 GiB export, assuming a warm shared engine and unchanged local input scan. At 1 Gbit/s that removes up to 8.59 s of bulk transmission, but adds remote execution and handoff. Data owners, warehouses, SaaS operators, and agent vendors pay for reduced export load and shorter completion time. R2's zero egress charge means bytes saved there are not automatically dollars saved.

**F/I — Lineage and what changed:** Active Disks already shipped code toward storage to filter before the interconnect. [Riedel et al., VLDB 1998][active-disks]. Biscuit provided programmable near-data processing on actual NVMe SSDs. [Gu et al., ISCA 2016][biscuit]. **I:** constrained device compute, application integration, competing database engines, and deployment control limited the generality of that approach. Today's difference is small sandboxable programs, generated adapters, and a common tool ABI; this is **software near-data processing**, not a claim that Workers execute inside R2's SSD controllers. Better models can generate useful specialized programs, while jitk limits their I/O to owner-controlled tools.

**F/I — A useful historical failure:** Biscuit's authors say they could not reproduce earlier advantages of **software** in-storage scans on their faster SSD; their reported **>15× average speedup for five TPC-H queries used hardware filtering**. [Original paper, introduction/abstract][biscuit]. Putting computation on a weaker nearby CPU can lose when its processing rate falls below the fast transfer path. Proximity is a hypothesis to benchmark, not a sufficient argument.

**I — Superhuman-model test:** matters more if models perform more fresh-data work. Perfect reasoning cannot inspect a private table without some owner-authorized execution or transfer. It matters less if one existing SQL query returns all required information; the product must then use that query rather than wrap it in a capsule.

**E — Placement break-even:** migration pays only when checkpoint + state transfer + handoff + restore time is less than the critical-path transfer/round-trip/rebuild time it removes. For example, an assumed **10 ms** handoff/restore plus **1 MiB over 1 Gbit/s (8.39 ms)** costs about **18.4 ms before propagation**: plausible against several avoided 20 ms crossings, unattractive against one 1 ms regional call. Charge shared engine/cache misses and use the measured dependency path; overlapping transfers cannot all be counted as saved wall time.

**E — Around 2030:** storage and SaaS providers host a visiting-compute endpoint; an enterprise's million daily jobs traverse a few owner domains, retaining unfinished local algorithm state and returning aggregate results. Native jitk hosts serve private/on-prem installations; interpreter/Wasm capsules serve compatible Workers/browser hosts. Ownership of placement/export policy stays with each host. Billing is for useful local CPU, scanned bytes, and reduced network demand—not opaque “agent lives.”

**E — First proof, 1–2 weeks:** two owner-controlled datasets, one stateful multi-stage analysis, a streamed 1 GiB fixture, and a small capsule adapter. Compare (a) central download, (b) SQL/query pushdown plus a stateless prepared service, (c) Cloudflare Placement, and (d) moving the continuation between the two data domains. Record full engine/capsule/result bytes, CPU, p50/p95 completion, and resume failures. Start with read-only tools. Cloudflare already places Workers near upstreams, including explicit region/host hints; “near the database” alone is occupied. [Placement docs, updated October 12, 2026][placement].

**E — Demo + draft tweet:** show one unfinished analysis visiting two datasets, with byte counters and every baseline visible. “We sent this program to two data owners instead of downloading their tables. It returned the same answer; here's the measured traffic, runtime, and SQL-pushdown comparison.” Publish a numerical improvement only after measurement.

**E/I — Kill test / failed physics:** kill the capsule-specific pitch if query pushdown or source+small JSON state achieves within **10%** of its useful latency/cost. Kill mobility on workloads whose retained state approaches the data avoided, whose scan CPU is the bottleneck, or whose owner will not host foreign computation. A continuation containing raw sensitive data may itself be an export. No placement algorithm can co-locate simultaneously with mutually distant mutable datasets.

### 2. Accelerator valet: suspend the agent, lease its KV, admit ready work

**I — One sentence:** expose tool waits and expected resumptions to inference serving so GPU compute slots are reused immediately and KV state is retained, offloaded, or recomputed by an explicit cost policy. **E — 100× version:** support **100× more tool-waiting sessions per scarce hot allocation** on a 1%-duty-cycle workload; this is a concurrency ambition, not 100× more model FLOPs or guaranteed throughput.

**E — Worsening problem and payer:** an illustrative GQA model with 32 layers, eight KV heads, 128 dimensions/head, and BF16 K and V uses `2×32×8×128×2 = 128 KiB/token`: **1 GiB at 8,192 tokens**, **4 GiB at 32,768**. These are explicit model-shape assumptions, not universal LLM properties. Ten thousand such waiting sessions mean about **10 TiB of 8K KV**, regardless of how small their TS heaps are. At a hypothetical 0.1 s inference burst followed by a 10 s tool wait, dedicated occupancy is only **0.99%** useful time. Inference providers and self-hosted agent fleets pay to reclaim HBM and reduce recomputation and queueing.

**F — This territory is already occupied.** Orca introduced iteration-level scheduling [OSDI 2022][orca]; vLLM/PagedAttention addresses cache fragmentation and sharing [SOSP 2023][vllm]. **Continuum v7, September 8, 2026**, explicitly pins KV with a tool-aware TTL and coordinates program scheduling. [Paper][continuum]. **TokenCake v5, September 28**, proactively offloads idle agent KV and predicts reloads. [Paper][tokencake]. **EfficientAgent, September 27**, reports that offload benefit depends on the host tier holding the reuse working set. [Paper][efficientagent]. NVIDIA Dynamo already has CPU/disk KV offloading and describes agent lifecycle-aware cache management. [Docs][dynamo]; [2026 vendor analysis][dynamo-agent]. These are baselines, not footnotes to an invention claim.

**I — Lineage and changed conditions:** revive dataflow readiness scheduling and memory hierarchy management across the **entire agent program**, not just one model request. Historically the application scheduler and accelerator engine saw different lifetimes. A single tool channel gives the runtime a precise wait boundary; capsules make the cheap CPU side easy to evict. The proposed wedge is a framework-neutral lifecycle adapter and accounting contract. It needs a provider partner or self-hosted engine; a public token API usually does not grant cache eviction control.

**I — Superhuman-model test:** more valuable when total concurrent external work grows; still relevant to perfect models waiting on builds, browsing, or transactions. If model improvements collapse tool waits or context size, the pool shrinks. Never keep a GPU execution thread blocked on a tool. **Do not interpret that as “always evict its KV”:** very short tools can make retention optimal.

**E — Batching versus latency:** ready continuations enter model/prefix-compatible queues, with per-job deadlines and maximum batch wait. Forming a fresh batch of 32 from a Poisson stream at 1,000 arrivals/s takes **31 ms in expectation from first to last arrival**, about **15.5 ms average waiting within that filled batch**. Continuous batching often avoids that crude policy. Pooling helps throughput; arbitrary waiting for a full batch can destroy interactive latency. Reuse stable prefixes before inventing a new scheduler.

**E — Around 2030 / value:** an inference operator manages a million mostly sleeping sessions across regional GPU pools; each resumption carries context identity, compatible cache handle, wait class, deadline, and resource budget. The agent continuation and KV are separately tiered. Sell more completed jobs within SLO per GPU-hour and per joule, with a share of independently measured savings.

**E — First proof, 1–2 weeks:** instrument TS agents' `WAIT/READY` boundaries and a self-hosted vLLM/Dynamo adapter on existing authorized hardware, if available; otherwise implement the Cloudflare-facing adapter and a trace-driven simulator, explicitly without a GPU-performance claim. Compare ordinary continuous batching/prefix caching, fixed retention, TTL, and offload/recompute policies at matched arrivals and task success. Sweep tool durations from **1 ms to 30 s**, context size, and host-tier capacity. Workers AI already supports session affinity and cached-token accounting. [Prompt caching, current][prompt-cache].

**E — Demo + draft tweet:** show HBM occupancy falling during long waits while another job advances; include end-to-end latency and total GPU work. “A parked JS heap isn't a parked KV cache. This experiment passes tool lifecycle events to the serving engine; here are the wins and the short-wait cases where retaining KV wins.”

**E/I — Kill test / failed physics:** a 1 GiB cache copied out and back at an **assumed effective 32 GiB/s per direction** occupies at least **62.5 ms** of transfer time; short waits can lose immediately. Offloading a working set too large for host memory just creates churn. Kill the adapter business if an ordinary async service with existing engine policies gets within **10%** of goodput and cost; small CPU heaps alone cannot repair GPU scheduling. Do not book $0.0119 saved for every ten-second wait on a shared GPU that was already serving others.

### 3. Inference-adjacent tool appliances: make local tool loops actually local

**I — One sentence:** place a small isolated tool execution plane beside inference, with scriptc-native fast paths and capsule parking when work leaves the machine. **E — 100× version:** reduce **the local orchestration/transport portion** of a tool cycle from milliseconds to tens of microseconds, while exposing remote calls as remote.

**E — Worsening problem and payer:** 100 serial crossings at an assumed **20 ms** each add **2 s** even if local inference becomes arbitrarily fast. A same-host path at a proposed **50 µs** adds **5 ms**, a **400× reduction in that transport term**. Repeated model decoding, external API time, and tool execution remain. More capable models that can collapse 100 calls into one erase much of this example; start with genuinely dependent reads against changing local state. Inference hosts and private-data operators pay for latency and CPU capacity; tiny Workers CPU bills alone do not support the business.

**F/I — Lineage and stall:** exokernels separated secure resource multiplexing from application abstractions [Engler et al., 1995; MIT project][exokernel]. MirageOS compiled an OCaml application and libraries into a single-address-space appliance [ASPLOS 2013][mirage]. Unikraft's published artifact reports approximately **1 MB images**, **<10 MB RAM**, and **~1 ms guest boot plus VMM time**, with **3–40 ms total boots** on its evaluated setups. [EuroSys 2021 artifact][unikraft]. **I:** compatibility, tooling, debugging, and operational control limited wider adoption; the Unikraft authors describe those barriers directly. [Authors, July 2021][unikraft-barriers]. The new restriction is unusually favorable: generated TS plus **one tool channel**, rather than the whole POSIX/network/device surface. The host keeps GPU drivers and external sockets; jitk need not become a GPU OS.

**F/I — What already exists:** Cloudflare advertises embedded function calling in the same execution environment. [Docs, updated April 21, 2026][embedded]. That is relevant competition, not proof of an exposed same-host GPU placement guarantee or a 50 µs callback. Barroso et al.'s *Killer Microseconds* identifies the gap between nanosecond hardware and millisecond OS techniques [2017][killer-us]; Shenango reallocates CPU cores every **5 µs** in its research environment [NSDI 2019][shenango]. Achieving microseconds often requires careful queues and CPU allocation, not just a smaller guest image.

**I — Superhuman-model test:** greater importance if inference time falls and unavoidable tool time dominates. It vanishes for jobs answerable entirely inside the model. Same-host execution helps only for tools actually available there; a remote CRM or browser on a user's laptop remains remote.

**E — Around 2030 / value:** inference racks expose tenant-isolated CPU tool slots with local read-only indexes, parsers, and domain runtimes. A session uses the shared CPU plane for milliseconds, parks its capsule, and reacquires a slot after external results arrive. Cloudflare is a distribution/hosting partner; a standalone builder cannot command Workers AI's physical host placement through an ordinary binding. Sell a hosting integration with a measured completion-time SLO.

**E — First proof, 1–2 weeks:** a TS harness compares warm Node, workerd/Wasm, scriptc-native, and an already built jitk path for the same small local tools. Use actual tools—indexed lookup, parsing, and a stateful dependency chain—with payload sizes from **64 B to 1 MiB**. Count queue time, tool time, guest entry/exit, CPU, and p99 at matched open-loop arrivals. Demonstrate the public Workers AI embedded baseline separately; if no physical co-location control exists, make no same-host claim for it. No kvm-dev changes are needed.

**E — Demo + draft tweet:** display identical local chains and a deliberately remote call. “Putting the tool runtime next to inference removed these measured orchestration hops. It did not accelerate the remote API. Full Node, embedded-Workers, and microVM baselines included.”

**E/I — Kill test / failed physics:** stop if optimized warm processes achieve equivalent useful latency/density or if the model/tool itself dominates. Busy polling that reserves whole cores can consume the savings; measure idle CPU too. Native jitk is not a Worker deployment format. The conditional **50 µs** target needs measurement and should not be inferred from a sub-ms parked VM result.

### 4. A tail budget for agent chains: hedge, prefetch, and cancel at continuations

**I — One sentence:** a tool broker spends a bounded redundancy budget on the critical path, using delayed hedges for equivalent reads and speculative prefetch for predictable future reads. **E — 100× version:** prevent large agent workflows' tail waiting from growing with every unreliable dependency, targeting **100× reduction in avoidable outlier exposure** on workloads with independent replica stalls—not a universal 100× latency guarantee.

**F/E — Worsening problem and payer:** *The Tail at Scale* explains why a rare slow leaf becomes common with fan-out. Its Bigtable experiment reduced **p99.9 from 1,800 ms to 74 ms** with a **10 ms hedge delay and 2% more requests**. [Dean and Barroso, February 2013][tail]. In the independent 1%-tail model, going from 100 calls to 1,000 raises the chance of at least one slow call from **63.4% to 99.996%**. That is arithmetic, not evidence that modern agent latencies follow this distribution. Workflow operators and API owners pay for deadline completion and fewer timeout retries; the API owner must have spare capacity.

**F/I — Lineage and changed conditions:** delayed hedging, tied requests, CPU speculation, and storage prefetch already exist. They stalled as a general agent mechanism because effects, costs, stale observations, and shared-provider congestion make casual duplication dangerous. The proposed advantage is a forkable continuation and one broker that knows branch identity, remaining deadline, cancellation, and effect class. Stronger models improve which future read is likely, while ordinary critical-path analysis decides where spending can matter. Duplicating a whole agent and choosing a plausible answer is not a correctness-preserving hedge.

**E — Break-even:** for prefetch hit probability `p`, latency saved `L`, and total speculative cost `C`, continue only if `pL` is worth `C` under the customer's deadline/price objective. At **p = 0.8** and a **200 ms** read, the ideal expected latency benefit is **160 ms**, with all unused work charged. For a delayed hedge at `h`, the independent tail after `t>h` is `P(X>t)P(Y>t−h)`, **not** generally `P(X>t)^2`. Shared congestion can invalidate the multiplication entirely.

**I — Superhuman-model test:** perfect choice of next read does not eliminate random queueing or replica failure. Better prediction increases prefetch usefulness. But a perfect model may shrink the dependency graph, and deterministic expensive requests do not become faster because duplicated.

**E — Around 2030 / value:** an agent ingress fabric controls millions of daily read chains. Every endpoint declares cancellability, consistency, cost, and whether replicas share a failure domain. Read speculation is admitted under a global budget; writes require a single authoritative owner or a backend-enforced idempotency protocol. Sell a p99 completion objective subject to an explicit extra-load cap.

**E — First proof, 1–2 weeks:** TS tool broker, forkable Wasm guest, controlled read replicas, and recorded service traces. Compare deadlines/retries, replica selection without forks, delayed hedges, and prefetch. Run both independent stalls and a shared bottleneck at **50%, 80%, and 95% offered utilization**. Aim for **≥3× p99 improvement at ≤5% extra upstream work** on a disclosed trace; report when it reverses. Confirm loser cancellation and zero speculative writes. Replay/JSON must be included as a capsule baseline.

**E — Demo + draft tweet:** show a stalled replica, one delayed duplicate, and cancellation counters. “Hedged agent reads cut this workload's measured p99 at this extra request cost. The same policy lost under shared congestion; here's the switch that disables it.”

**E/I — Kill test / failed physics:** kill default-on hedging if extra traffic worsens origin queues or cannot be cancelled/billed accurately. Independent 1% stalls could ideally become 0.01% with simultaneous replicas, a **100× probability change**, but independence, timing, and capacity are conditions to demonstrate. Kill capsule-specific investment if a standard HTTP proxy captures the benefit; a small file does not make redundancy free.

### 5. A compiler for tool traffic: fuse the bytes before they become model context

**I — One sentence:** compile generated TS tool pipelines into streamed, fused native/Wasm operators that retain intermediate objects locally and send only decision-relevant outputs through the tool channel. **E — 100× version:** make an agent's “read, filter, join, summarize” program use **100× fewer materialized/interchange bytes**, with a per-job traffic budget enforced by the runtime.

**E — Worsening problem and payer:** twenty boundaries each writing and reading a **100 MB** intermediate imply **4 GB** of materialization traffic, before JSON/string/object inflation. Ten million such daily jobs imply **40 PB/day** of that traffic. These are scenarios, not measured agent trends. On a hypothetical **50 GB/s sustained memory path**, 4 GB alone imposes **80 ms** of traffic time; parsing/GC may add much more. Separately, reducing an uncached 100,000-token input to 1,000 tokens saves **$0.004455/job** at Workers AI's listed **$0.045/million input tokens** for `llama-3.1-8b-instruct-fp8-fast`: **$4,455 per million jobs**, if the omitted input was truly unnecessary. [Current model pricing][ai-pricing]. Application operators pay for inference input, origin CPU, memory capacity, and throughput.

**F/I — Lineage and stalled promise:** Dennis/Misunas dataflow machines represented computations as readiness-driven graphs [original architecture, 1974–1975][dataflow]; Kung's systolic arrays reused values through regular local processing elements [January 1982][systolic]. Hardware generality and irregular computation are hard; a TS pipeline compiler can instead specialize the regular pieces and retain ordinary control flow. FlashAttention is the important modern analogy: it improves exact computation by reducing HBM/SRAM traffic through tiling. [Dao et al., 2022][flashattention]. **I:** copying its principle does not copy its speedup. Classic fusion, databases, vector engines, and generated tool-composition code already remove much of this work.

**I — What changes with the builder:** scriptc can lower hot, well-understood TS operations; the tool-only ABI makes output boundaries inspectable; a capsule can retain incremental indexes and join state across waits. Introduce typed byte/record handles instead of serializing the same values between each tool. Native host calls that escape the guest's control must be explicitly bounded. Do not claim scriptc already performs the proposed fusion or supports every arbitrary npm program.

**I — Superhuman-model test:** improves: a stronger model can emit a correct complete data program and ask for fewer expensive reasoning turns. The compiler remains useful even if every generated program is perfect, because it lowers data traffic. If the model already emits optimal SQL or native programs, this becomes an adapter/compiler feature rather than an independent agent platform.

**E — Around 2030 / value:** APIs accept an executable data plan as well as individual tool calls. Shared engines run millions of tenant-specific stream/join/index plans near their data, while the model sees compact results and handles. The commercial product is measured completed analytics/integration work within CPU, byte, and latency budgets. It can ship inside idea 1 rather than demand another platform adoption.

**E — First proof, 1–2 weeks:** three TS pipelines—log selection, incremental reconciliation, and join/aggregation—compiled with the existing scriptc subset and a Wasm alternative. Compare JSON tool chaining, hand-written streamed JS, and an optimized SQL/vectorized implementation. Record actual allocated/copied bytes, peak RSS, CPU, result equivalence, and model input tokens. Force a wait halfway through one pipeline to test whether preserved state saves useful rebuild work. Target **≥100× interchange-byte reduction**, but require a separate useful cost/latency win against the strongest baseline.

**E — Demo + draft tweet:** display one program, the same result, and boundary counters. “This generated tool plan kept its intermediates next to the data. Here's the measured bytes, CPU, and input-token reduction versus streamed JS and SQL—not just versus chatty JSON.”

**E/I — Kill test / failed physics:** stop if ordinary streaming/query pushdown gets within **10%** of performance with less complexity. No legal optimization may omit information the requested decision actually requires. Once traffic is removed, CPU work, sorting, and cache misses remain. Horowitz's old pJ table is not a defensible way to invoice energy savings from this prototype.

### 6. A single-address-space internet of capsules—explicitly non-coherent

**I — One sentence:** give parked program state and immutable data blocks stable global identities, with local access inside a host and explicit asynchronous fetch across hosts. **E — 100× version:** one addressable computation namespace with **100× less replicated state/restore traffic** for read-mostly fork populations, and a billion mostly dormant agents stored as shared bases plus deltas.

**E — Worsening problem and payer:** one million 1 MiB full states occupy **1.05 TB** and cost about **$15.73/month** on R2 before history/operations; one billion occupy **1.05 PB** and cost about **$15,729/month**. A hypothetical **100× reduction in stored bytes** lowers storage accordingly, but one billion park+load pairs still incur about **$4,860 in R2 operations**. Fleet operators pay for less retained RAM, checkpoint bandwidth, and faster restoration, not a new URL syntax.

**F/I — Lineage and the honest boundary:** Opal explored globally meaningful addresses with protection independent of naming [1992–1995 project/papers][opal]. Singularity used software-isolated processes inside one kernel address space [Microsoft research project][singularity]. FaRM exposes a cluster's memory as a shared address space and uses RDMA, transactions, and function shipping; its paper reports **160 million lookups/s across 20 machines at 31 µs latency**. [NSDI 2014][farm]. Infiniswap lends unused remote RAM through RDMA rather than disk paging. [NSDI 2017][infiniswap]. **I:** none establishes coherent global mutable RAM at LAN latency. Pointer identity, permissions, distributed coherence, failures, heterogeneous heaps, and reclamation make the unbounded version fail. Keep the namespace; discard transparent Internet dereference.

**I — What changes:** forkable bounded heaps allow immutable engine/base sharing and per-branch dirty state. The single tool channel is where a missing block can cause an explicit park/fetch/resume, avoiding a secretly blocking pointer load. Region-local native hosts might use RDMA; Workers expose managed APIs, not an RDMA NIC API. Browser/Wasm hosts need a compatible interpreter artifact and object handles, not exported native pointers.

**I — Superhuman-model test:** the naming/state-capacity problem survives perfect reasoning and can grow with useful long-lived programs. Better models may replace many retained heaps with compact source+state; that is a direct threat to the capsule-specific mechanism.

**E — Around 2030 / value:** enterprises operate regional capsule caches over R2-like cold storage. Billions of identities are dormant, a small fraction are warm, and fewer still execute. A versioned handle identifies engine, base blocks, delta, pending operations, and ownership epoch. Immutable blocks can be shared; mutable state belongs to a branch. Cross-tenant deduplication is not assumed. Sell a snapshot/cache SDK and recovery SLO, initially to existing runtime vendors.

**E — First proof, 1–2 weeks:** TS manifest service, R2-compatible object store, two Wasm hosts, content-addressed chunks, and inherited bases. Fork one populated read-mostly state into **1,000 branches**, then vary the fraction dirtied and number of restored pages. Compare full compressed images, delta checkpoints, application JSON, and replay. Measure total stored/transferred bytes, hashes/metadata, first-use latency, and garbage collection. Test old-owner resumes and incompatible engine versions.

**E — Demo + draft tweet:** restore the same branch in two compatible hosts, then mutate them independently while showing what was actually fetched. “These capsules share immutable state and fetch missing blocks explicitly. Local references are cheap; a remote miss is a network operation. Full-image and JSON-state baselines included.”

**E/I — Kill test / failed physics:** a chain of **100 uncached remote faults at an assumed 20 ms RTT** costs **2 s** before useful work. Prefer bulk prefetch or moving execution. Kill the 100× claim when dirty entropy/base size prevents that compression ratio, or content hashing and tiny-object operations cost more than full snapshots. The prior capsule landscape already shows delta implementations; format export alone is occupied. This is not a coherent shared heap or a global RDMA system.

### 7. Power-following continuations: defer flexible agents, not their users

**I — One sentence:** park deadline-flexible agent work and admit its next compute burst when power, capacity, and data locality make execution cheapest. **E — 100× version:** make a large population of agents a controllable load that can shed **99% of its flexible instantaneous demand** during a grid/capacity event; this is time shifting, not 100× less total energy.

**F/E — Worsening problem and payer:** the IEA 2026 report's **485 → 950 TWh** outlook makes regional power constraints material. For a simple device-only calculation, **1,000 accelerators at an assumed 700 W each = 700 kW**, or **700 kWh per hour**. At hypothetical electricity prices of **$0.05 versus $0.20/kWh**, shifting that hour changes device electricity cost by **$105**, before server power, cooling, contracts, and transfer. At the illustrative $4.29/hour GPU rent, those same 1,000 GPU-hours cost **$4,290**. A renter who merely runs longer may lose far more on rent than saved power. Owners of power-constrained capacity, not ordinary token-API customers, are the plausible buyers.

**F/I — Lineage and changed conditions:** Google's Carbon-Intelligent Compute Management already delays flexible jobs using carbon forecasts and virtual capacity curves. [Radovanović et al., 2021 preprint; 2023 journal][carbon]. Zeus optimizes job configurations and GPU power limits, reporting **15.3–75.8% training energy-efficiency improvement** in its evaluation. [NSDI 2023][zeus]. These are established scheduling ideas; the Zeus training range is not an inference promise. **I:** long-lived agent sessions make interruptible boundaries frequent and explicit. Capsule parking might reduce the cost of deferral and simplify moving the CPU-side continuation, but an ordinary queue/checkpoint often suffices.

**I — Superhuman-model test:** perfect models doing overnight research, maintenance, or indexing can still accept deadlines rather than immediate service. Better models generating enough useful work could increase flexible demand. A foreground assistant with no slack is outside this product.

**E — Around 2030 / value:** a provider pools millions of background tasks with deadlines of minutes to days. It retains model weights in a few equipped sites, moves small continuations only when beneficial, and packs runnable bursts into already powered capacity. Sell cheaper completed jobs or paid capacity flexibility; report absolute kWh and deadline misses separately from carbon estimates. Cloudflare is a possible fleet partner; current Workers/Workers AI APIs do not give a small builder direct control over facility power or GPU clocks.

**E — First proof, 1–2 weeks:** TS scheduler, resumable Wasm jobs, supplied price/carbon traces, and explicit deadlines. Compare FIFO, ordinary delayed queues, and capsule deferral with migration charged. Report trace replay as a simulation. Measure local CPU time and checkpoint bytes; use GPU energy only if an authorized metered host is actually available. A useful initial target is **≥20% modeled energy-cost reduction with ≥99% deadline completion**, not a claimed physical power saving from unmeasured GPU hardware.

**E — Demo + draft tweet:** one work queue visibly parks during an expensive interval, resumes within deadlines, and shows the queue baseline. “These background agents met their deadlines on this disclosed power-price trace. This is a scheduling result; no carbon or joule savings are claimed without the matching measurements.”

**E/I — Kill test / failed physics:** weights and KV can dwarf the continuation: **1 GiB over 100 Gbit/s still needs ≥85.9 ms**, and moving **16 GB** needs at least **1.28 s**, before RTT/protocol overhead. Prefer warm weights, deferral, and consolidation to repeatedly shipping a model. Kill migration when state transfer/recomputation exceeds its benefit; kill power capping when runtime grows enough to increase joules or rented GPU-hours. Changing carbon intensity is not reducing joules, and shifting jobs does not guarantee machines actually turn off.

### 8. A precision and placement ladder: device → edge → central, by work class

**I — One sentence:** keep a task's state portable while selecting the smallest suitable resident model and execution site, with explicit quality, memory, power, and latency budgets. **E — 100× version:** reduce central GPU/API demand by **99% for qualified narrow workload classes** through local exact code, compact models, and batching—not by asserting that a tiny model replaces every frontier task.

**F/E — Worsening problem and payer:** a billion background classifications or extractions become expensive if each invokes a general central model. At current Workers AI list prices, a scenario with **2,000 input and 200 output tokens/job** costs about **$0.0001668** with `llama-3.1-8b-instruct-fp8-fast`, versus **$0.0010366** with `llama-3.1-70b-instruct-fp8-fast`: **$166,800 versus $1,036,600 per billion jobs**, excluding caching, plans, and other components. [Current pricing][ai-pricing]. This is about **6.2×**, not 100×; most of a 100× target must come from eliminating central calls or reducing work. Device owners pay battery and memory instead of receiving physically free compute.

**F/I — Lineage and what changed:** approximate computing exposes where reduced fidelity is allowed. EnerJ's authors explicitly corrected their original simulation results: energy savings are **7–38%**, not the larger numbers repeated in early coverage. [PLDI 2011 project and correction][enerj]. AWQ targets low-bit weight-only quantization and supplies a 4-bit inference engine. [2023 paper; MLSys 2024][awq]. Apple published a **~3B on-device model** using **2-bit quantization-aware training** in 2025; its June 2026 announcement continues a 3B on-device lineage. [2025 technical report][apple25]; [June 8, 2026 announcement][apple26]. **I:** old approximate hardware was difficult to target and bounded by quality/tooling; current quantized models and device APIs give a practical deployment route. None guarantees a task-quality floor automatically.

**E — Physical lower bounds:** 3B parameters at an idealized 4 bits weigh about **1.5 GB**, before scales, embeddings exceptions, KV, and runtime. At an assumed effective **50 GB/s** weight-read rate, a full per-token scan takes **30 ms**. A 16 GB central model over H100's nominal bandwidth has a **4.78 ms weight-only floor**. A nearby small model can therefore be slower than a remote batched large model despite avoiding WAN time. At an assumed **5 W for 2 s**, local execution spends **10 J**; that must be measured on the actual device, not compared directly with Google's differently scoped 864 J median prompt.

**I — Superhuman-model test:** better compact models expand the tasks eligible for local execution. If future central inference becomes sufficiently cheap/fast, privacy, offline operation, and bulk data locality may remain; otherwise routing can shrink to a feature. Do not require a weaker model to judge the correctness of an arbitrarily stronger one. Use task classes with explicit acceptance targets, prequalified variants, and escalation when the workload is outside the class.

**E — Around 2030 / value:** SaaS applications and browsers retain an unfinished task locally, run deterministic transforms and narrow inference nearby, and send only hard subtasks centrally. Weights stay resident; continuations and allowed result summaries move. Cloudflare handles compatible edge execution and inference routing; device-native frameworks need a bridge, and browsers have different model/device access. Sell a cost/latency/offline-quality contract for a specific application category.

**E — First proof, 1–2 weeks:** TS/browser capsule and Workers adapter, plus a locally available model if supported. Pick **1,000 held-out extraction/classification tasks**, a fixed quality target, and a device/edge/central policy. Compare exact rules, one strong model, one compact model, and a fixed routing policy. Count total central tokens, local CPU/energy where measurable, cold model loads, RAM, and p95 completion. The target is **≥90% fewer central calls at equal task-quality criteria** for a narrow class; 99% is a later hypothesis, not a result.

**E — Demo + draft tweet:** disconnect the network, finish qualified local tasks, then reconnect for a genuinely harder subtask. “This workload met the same disclosed quality threshold with these central calls and these local costs. Offline execution works for this class; it is not a general claim that a small model replaces a large one.”

**E/I — Kill test / failed physics:** stop if local cold loads, thermal throttling, retries, or quality loss dominate. Quantization alone is generally a few-fold storage improvement, not 100×. Models and KV do not fit inside a 100 KB capsule; moving its control state does not transfer proprietary model weights or device accelerator state. If a single static deployment policy performs as well, ship that simpler policy.

## What the old systems ideas actually contribute

**I — The synthesis is selective, not a claim to invent the lineage.** Dataflow supplies ready/waiting structure; systolic arrays supply local reuse; near-data processing supplies placement; exokernels and library OSes supply restricted resource interfaces; RDMA/disaggregation supply regional memory tiers; single-address systems separate identity from protection; tail tolerance supplies controlled redundancy; power-aware systems supply deferral; approximate computing supplies explicit fidelity tradeoffs. The common failure is pretending an abstraction removes a physical cost. The opportunity is making that cost visible enough to avoid it.

**I — Cloudflare fit is distribution plus adapters, not imaginary hardware control.** Use Workers/Wasm for bounded execution, R2 for cold artifacts, and owner-controlled brokers for capabilities. Use documented Placement and prompt affinity before building replacements. Dynamic Worker creation, checkpoint operations, data residency, and provider-specific inference queues all have costs or restrictions. Native jitk is an on-prem/hosted complement. No public API inspected here establishes arbitrary Worker ↔ chosen inference GPU same-host placement, a shared global pointer space, or HBM migration inside a JS image.

**E — Shared proof discipline:** use matched useful results and offered arrivals, strong conventional baselines, total bytes including shared bases/engines, complete job latency, upstream load, recomputation, and actual billable units. For power claims, include idle/host/facility boundaries or state their exclusion. A successful architecture-level prototype can justify 2× paid value without proving its 100× resource ambition; it cannot advertise that ambition as a measured product speedup.

## Source register

**F — Source dates:** historical sources use their publication dates, not the search engine's crawl date. Current documentation and prices were inspected **2026-10-27**. Contemporary paper revisions are pinned in the discussion where material. The two Horowitz PDFs are original authored material hosted in mirrors; all other research claims likewise point to papers, author/project pages, or official product documentation rather than secondary summaries.

[iea26]: https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary
[iea25]: https://www.iea.org/reports/energy-and-ai/executive-summary%C2%A0
[horowitz-slides]: https://osmarks.net/assets/misc/2014-horowitz-2.pdf
[horowitz-paper]: https://gwern.net/doc/cs/hardware/2014-horowitz-2.pdf
[dennard]: https://stanford.edu/class/cs114/readings/dennard.pdf
[memory-wall]: https://libraopen.lib.virginia.edu/downloads/4b29b598d
[roofline]: https://www2.eecs.berkeley.edu/Pubs/TechRpts/2008/EECS-2008-134.html
[h100]: https://www.nvidia.com/en-in/data-center/h100/
[google-energy]: https://services.google.com/fh/files/misc/measuring_the_environmental_impact_of_delivering_ai_at_google_scale.pdf
[joules]: https://arxiv.org/abs/2601.22076
[amdahl]: https://www-inst.eecs.berkeley.edu/~n252/paper/Amdahl.pdf
[gustafson]: https://users.cs.utah.edu/~hari/teaching/paralg/Gustafson88.pdf
[lambda]: https://lambda.ai/instances
[workers-pricing]: https://developers.cloudflare.com/workers/platform/pricing/
[r2]: https://developers.cloudflare.com/r2/pricing/
[active-disks]: https://pdl.cmu.edu/ftp/Active/VLDB98.pdf
[biscuit]: https://class.ece.iastate.edu/tyagi/cpre581/papers/ISCA16Biscuit.pdf
[placement]: https://developers.cloudflare.com/workers/configuration/placement/
[orca]: https://www.usenix.org/conference/osdi22/presentation/yu
[vllm]: https://arxiv.org/abs/2309.06180
[continuum]: https://arxiv.org/abs/2511.02230v7
[tokencake]: https://arxiv.org/abs/2510.18586v5
[efficientagent]: https://arxiv.org/abs/2609.33762v1
[dynamo]: https://docs.dynamo.nvidia.com/dynamo/v1.4.1/kubernetes/kv-cache-offloading/overview
[dynamo-agent]: https://developer.nvidia.com/blog/full-stack-optimizations-for-agentic-inference-with-nvidia-dynamo
[prompt-cache]: https://developers.cloudflare.com/workers-ai/features/prompt-caching/
[exokernel]: https://pdos.csail.mit.edu/archive/exo/
[mirage]: https://anil.recoil.org/papers/2013-asplos-mirage
[unikraft]: https://github.com/unikraft/eurosys21-artifacts
[unikraft-barriers]: https://www.usenix.org/publications/loginonline/unikraft-and-coming-age-unikernels
[embedded]: https://developers.cloudflare.com/workers-ai/features/function-calling/embedded/
[killer-us]: https://research.google/pubs/attack-of-the-killer-microseconds/
[shenango]: https://www.usenix.org/conference/nsdi19/presentation/ousterhout
[tail]: https://barroso.org/publications/TheTailAtScale.pdf
[ai-pricing]: https://developers.cloudflare.com/workers-ai/platform/pricing/
[dataflow]: https://doi.org/10.1145/642089.642111
[systolic]: https://www.eecs.harvard.edu/~htk/publication/1982-kung-why-systolic-architecture.pdf
[flashattention]: https://arxiv.org/abs/2205.14135
[opal]: https://homes.cs.washington.edu/~levy/opal/
[singularity]: https://www.microsoft.com/en-us/research/project/singularity/
[farm]: https://www.microsoft.com/en-us/research/publication/farm-fast-remote-memory/
[infiniswap]: https://www.usenix.org/conference/nsdi17/technical-sessions/presentation/gu
[carbon]: https://arxiv.org/abs/2106.11750
[zeus]: https://www.usenix.org/conference/nsdi23/presentation/you
[enerj]: https://sampa.cs.washington.edu/research/approximation/enerj.html
[awq]: https://arxiv.org/abs/2306.00978
[apple25]: https://machinelearning.apple.com/research/apple-foundation-models-tech-report-2025
[apple26]: https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models

## Ranking all eight

**I — Ranking weighs physical leverage, survival of much better models, a reachable buyer, existing competition, and a decisive two-week proof. It is judgment, not a market-size measurement.**

| Rank | Idea | 100× claim belongs to | Decision |
|---:|---|---|---|
| 1 | **1. Visiting compute** | WAN bytes avoided on selective data workloads | Best physical wedge; must beat pushdown and Placement. |
| 2 | **5. Compiler for tool traffic** | Intermediate/context bytes avoided | Best builder-controlled implementation; likely the engine of #1. |
| 3 | **2. Accelerator valet** | Waiting-session density under low duty cycle | Largest adjacent budget; partner/integration opportunity in an occupied field. |
| 4 | **4. Tail budget** | Avoidable independent-outlier exposure | Strong measurable feature; watch correlated overload and commodity proxies. |
| 5 | **3. Inference-adjacent appliances** | Local orchestration component latency | Credible host partnership; no edge API can promise universal same-host tools. |
| 6 | **8. Precision/placement ladder** | Central calls avoided in qualified classes | Model improvements help, but routing and device integration are crowded. |
| 7 | **7. Power-following continuations** | Flexible instantaneous load shed | Valuable for a power owner; queueing often beats migration. |
| 8 | **6. Capsule address space** | Shared/delta state bytes | Useful substrate; global coherence pitch fails and product buyer is weakest. |

## Ranked top three

**1 — Visiting compute. I:** the constraint is indisputable: fresh private bytes must be processed somewhere. A program smaller than the data can eliminate a large transfer. The demanding comparison is against an owner-side query/program API, not against downloading everything into an LLM. If capsules make *multi-stage, multi-owner* computation cheaper to integrate or resume, there is a product. If not, the useful result may simply be a good executable-query SDK.

**2 — Compiler for tool traffic. I:** this is where scriptc and the narrow tool ABI can contribute without obtaining GPU-scheduler or cloud-facility privileges. Eliminating repeated materialization and unnecessary context is compatible with perfect generated code. It also provides the best implementation core for #1. The main threat is that databases, streamed JS, or ordinary native libraries already do all the valuable work; include them from day one.

**3 — Accelerator valet. I:** HBM and repeat prefill are expensive enough to support a real buyer. But Continuum, TokenCake, EfficientAgent, Dynamo, and existing asynchronous serving already establish the concept. The realistic opening is a common lifecycle contract between agent frameworks, portable execution hosts, and serving engines. Continue only with direct provider access or a self-hosted buyer; do not build a GPU scheduler behind an API that conceals the GPU.

## The ONE bet

**I — Bet on visiting compute, powered by the tool-traffic compiler, for a concrete two-owner data workflow.** Sell: **“Your agent runs its next bounded data program where the data already lives, and sends back only what the task needs.”** This survives faultless models, uses the builder's actual assets, and gives the 100–1000× ambition a physically meaningful denominator.

**E — Day-14 decision:** require equal results, **≥100× fewer cross-boundary bytes versus central export**, and a material **≥2× improvement in completion time or total paid work versus the strongest applicable placement/pushdown baseline** on at least one realistic stateful workflow. Require a separate comparison showing whether retained execution state beats source+JSON/replay. If SQL plus a normal queue wins, ship that simpler product or stop. If only the bad download baseline loses, the moonshot has not been established. No new kernel, cloud, GPU platform, or global address-space protocol is required for this proof.

## Five-line TL;DR

1. **F/I:** Better models do not repeal memory bandwidth, network distance, HBM capacity, queueing, or power limits; total demand growth is observed, future growth remains conditional.
2. **I/E:** Best bet: visiting computation plus compiled tool pipelines; pursue 100–1000× fewer moved bytes before promising faster intelligence.
3. **F/I:** GPU wait/KV scheduling has strong current prior art; park the agent cheaply, but price KV retention, offload, prefill, and batching separately.
4. **I:** Microsecond same-host tools are plausible; microsecond global tools, free speculation, and coherent Internet-wide RAM are not.
5. **E:** In two weeks, beat SQL/pushdown, streamed JS, Placement, and ordinary checkpoints—or drop the capsule-specific claim and keep only the useful simpler result.
