# Economics, competition, and whether the 10× matters

Research date: **2026-10-28**. Scope: the hypothesis in [BRIEF.md](BRIEF.md). USD, public list prices, before tax and negotiated discounts. **F** = sourced fact; **M** = locally measured; **I** = inference/calculation; **E** = workload or commercial estimate. No paid calls, deployment, Docker, or execution-host experiments were performed. Arithmetic was independently recomputed in Python; that is not a measurement of agent performance.

## Verdict first

**Go-with-changes for a bounded compatibility/measurement project; no-go for a generic “serverless agent brain + sandbox” product pitch.** The architecture is already supplied by Cloudflare, Vercel, OpenAI's Agents SDK, and Anthropic Managed Agents with execution partners. Cloudflare now specifically hosts **Pi Durable in a Durable Object**. Running a complete established CLI in a Linux sandbox is also widely available. The remaining potentially useful distinction is preserving a specified, unmodified agent and its extension semantics while relocating its brain into workerd, with demonstrably cheaper durable operation. That is a narrower compatibility product, and demand is unproven. **[I]**

The modeled literal split costs **$0.0196 per one-hour session**, including a 1 GB workspace retained for a day. It saves **8.5× against E2B/Daytona left running, 12.4× against a reserved Modal Sandbox, 4× against E2B paused between turns, 2.1× against a shared Fly Machine, and 1.9× against a 4 GB Sprite that idles between turns**. A Sprite actually using 1 GB is cheaper than this split. Moving workspace bytes to R2 improves the split to **$0.0135**, but changes the brief's literal DO-filesystem design. None of these estimates establishes a blanket 10–50× advantage. **[E, I]**

## 1. Reproducible workload and accounting boundary

`01-pi.md` was absent during the research/model construction. It was still absent at final review; the workload below is an explicit estimate, not a Pi trace. In particular, a count of tool implementations or source-code calls is not a command-frequency measurement.

| Input | Base assumption [E] | Why it matters |
| --- | --- | --- |
| Session | One hour of elapsed lifetime; 20 serial model/tool turns | Monthly session count means this many one-hour sessions, not always-on agents |
| Model traffic | 50,000 input tokens and 2,000 billed output tokens per turn | 1 million input + 40,000 output/session; reasoning is included in output |
| Cache | 80% of input is cache reads; 20% newly written where explicit write tariffs apply | Also show no-cache costs; cache hit rate is not measured |
| Model latency | 60 seconds per turn, 1,200 seconds total | Must usually keep the process consuming the model stream alive |
| Commands | Three serial commands/turn, 60 total; two seconds each | 120 seconds useful runner wall time and approximately 120 metered CPU-seconds |
| Remaining time | 2,280 seconds between turns, waiting for users/events | Potentially removable by pausing; continuous autonomous jobs can have much less |
| Runner launches | 20 bursts, three commands/burst | Base generic startup + staging + shutdown budget: 2 seconds/burst, 40 seconds total |
| Runner capacity | 2 vCPU / 4 GiB except published provider shapes | Modal uses 1 physical core = 2 vCPU equivalent; Cloudflare table uses named standard-3, 2 vCPU / 8 GiB / 16 GB disk |
| Persistence | 1 GB billable workspace retained for 24 hours, plus about 10 MB transcript | Delete after a day; longer retention is a separate cost, not free |
| Event/state traffic | 1,000 SQL rows written, 10,000 rows read; 60 Worker calls; 2,000 Worker CPU-ms; approximately 80 DO requests | Common control-plane budget **K ≈ $0.00114/session**, including transcript storage |
| DO brain | Budget a full hour of duration, not just JavaScript CPU | Conservative: pending model I/O prevents hibernation; between-turn hibernation is an upside |
| Network | Base table assumes no material paid egress; add measured billable GB × tariff | Model text is small; package downloads, artifact uploads, and workspace synchronization may not be |

**Accounting formulas [I]:**

```text
H_live = reserved/billed session resources + retained workspace + common state K
H_pause = resources during model + command + transition time + retained state + K
H_split = DO brain duration + on-demand runner + runner-controller DO
          + persistent workspace + K + measured synchronization/egress extras
Total/session = H + model tokens I + optional third-party tools X
Fleet/month = N × (H + I + X) + plan fees − applicable included usage
```

These are service-consumption costs. Engineering, support, incident handling, retries, enterprise compliance, customer acquisition, and gross margin are not zero; they enter the commercial model later. Fleet tables first show the **gross marginal run-rate**, so one-time credits or included usage do not create a fictitious scaling advantage. The invoice adjustments are given separately.

### Verified rate card

All rows below are **F**, accessed on the research date. Numerical application to the estimated workload is **I/E**. Different CPU classes are not performance-normalized by measurement.

| Service | Published tariff used | Billing qualification |
| --- | --- | --- |
| [E2B pricing](https://e2b.dev/pricing) | $0.000014/vCPU-s + $0.0000045/GiB-s; **2/4 = $0.1656/h** | Pro $150/month, usage additional; disk allowance 20 GiB. Custom 4 GiB configuration, not the lower-memory default. |
| [Daytona pricing](https://www.daytona.io/pricing) | $0.0504/vCPU-h + $0.0162/GiB-h; storage $0.000108/GiB-h after first 5 GiB | **2/4 = $0.1656/h**. Base model assumes a configuration within 5 GiB disk allowance. |
| [Modal pricing](https://modal.com/pricing) | **Sandbox** $0.00003942/physical-core-s + $0.00000667/GiB-s; **1 core/4 GiB = $0.23796/h** | Sandbox tariff is already non-preemptible, 3× ordinary Functions. Do not apply another 3×. Volumes $0.09/GiB-month, first 1 TiB included. |
| [Fly pricing](https://fly.io/pricing/), [current resource docs](https://docs.fly.io/about/pricing) | Lowest-price US region: shared-2x/512 MB $4.39/30 days; additional RAM $6/GB-month → **shared-2x/4 GB = $25.39/720 h = $0.035264/h**; performance-2x/4 GB $66/720 h = $0.091667/h | Shared CPU is not a dedicated core. Volumes $0.15/GB-month. Region and CPU choice materially alter comparison. |
| [Fly Sprites](https://fly.io/sprites/) | Actual CPU $0.0385/CPU-h; actual memory $0.021875/GB-h; hot storage $0.000683/GB-h; cold $0.000027/GB-h | Awake memory/hot storage and retained cold storage are distinct dimensions; no fixed per-Sprite fee. |
| [Cloudflare Containers](https://developers.cloudflare.com/containers/platform/pricing/) | Active CPU $0.000020/vCPU-s; provisioned RAM $0.0000025/GiB-s; disk $0.00000007/GB-s | 10 ms metering. Named standard-3 is **2 vCPU/8 GiB/16 GB**; custom types require at least 3 GiB/vCPU, so 2/4 is unavailable. Worker and controller DO charges are additional. |
| [Workers](https://developers.cloudflare.com/workers/platform/pricing/) | $5/month plan; marginal $0.30/million requests + $0.02/million CPU-ms | 10 million requests and 30 million CPU-ms included; waiting has no Worker duration charge. |
| [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/) | $12.50/million GB-s; **128 MB billed/object**, $0.15/million requests; SQL storage $0.20/GB-month, writes $1/million rows, reads $0.001/million | 400,000 GB-s, 1 million requests, 5 GB-month, 50 million written/25 billion read rows included. Duration overage rounded up to a million GB-s. |
| [R2](https://developers.cloudflare.com/r2/pricing/) | Standard $0.015/GB-month; Class A $4.50/million, B $0.36/million; no egress charge | An alternative to storing all workspace bytes in SQL; it still needs filesystem semantics and synchronization. |

**Important corrections to the premise [F/I]:**

- E2B's [billing docs](https://docs.e2b.dev/billing) explicitly stop billing when paused; paused state retention is unlimited. This is an incumbent baseline, not a future optimization.
- [Daytona billing](https://www.daytona.io/docs/billing) already charges only disk while stopped or paused; archived container sandboxes incur no resource billing. Pausing is therefore not unique to the split.
- [Modal resources](https://modal.com/docs/guide/sandbox-resources) charge `max(request, actual)`. An hourly sandbox is not necessarily billed for a whole busy CPU. A 1-core reservation is the expensive base scenario; use measured requests when comparing a real customer.
- [DO duration](https://developers.cloudflare.com/durable-objects/platform/pricing/) is wall time, including pending I/O, not Worker-style CPU-only billing. A full-hour brain costs `3,600 × 0.128 × 12.50/1e6 = $0.00576`. Hibernation does not freeze and later restore an arbitrary Node stack; sessions must recover from durable state. The [Pi harness](https://developers.cloudflare.com/agents/harnesses/pi/) says a running session keeps work in flight.

### A. VM/container remains alive for the hour

Workspace assumptions: E2B included persistence; Daytona within the stated free disk allowance; Modal 1 GiB Volume for a day = $0.003 gross; Fly 1 GB Volume for a day = $0.005. Cloudflare's ephemeral disk requires an external workspace copy: R2 storage plus approximately $0.00005 operations = $0.00055. Cloudflare additionally budgets an active controller DO for the whole hour. All rows include K.

| Architecture | Infra/session-hour H [E/I] | 1k/month | 100k/month | 1M/month |
| --- | ---: | ---: | ---: | ---: |
| E2B 2/4, alive | $0.16674 | $167 | $16,674 | $166,740 |
| Daytona 2/4, custom disk within free allowance | $0.16674 | $167 | $16,674 | $166,740 |
| Daytona 2/4, published medium 8-GiB disk, 3 GiB charged for 24 h | $0.17452 | $175 | $17,452 | $174,516 |
| Modal Sandbox 1 physical core/4 GiB reservation | $0.24210 | $242 | $24,210 | $242,100 |
| Fly shared-2x/4 GB | $0.04140 | $41 | $4,140 | $41,404 |
| Fly performance-2x/4 GB | $0.09781 | $98 | $9,781 | $97,807 |
| Cloudflare standard-3, 120 active CPU-s | $0.08588 | $86 | $8,588 | $85,882 |

Cloudflare [custom types](https://developers.cloudflare.com/containers/platform/limits/) can reduce the named-shape memory/disk reservation; the table deliberately uses the published standard-3, rather than asserting it is the minimum-priced sufficient configuration. A custom 2-vCPU instance needs at least 6 GiB RAM. **[F]** Cloudflare CPU is only `$0.0024` here; reserved memory is `$0.072` and disk `$0.004032`. Its always-on bill is already much less than charging two CPUs for an hour. Additional CPU used by the agent loop is assumed negligible in this estimate and must be measured.

**Right-sizing defeats some impressive ratios [E/I].** A live Modal Sandbox requesting 0.125 cores, using roughly 0.125 cores while waiting and 1 core for the 120 command seconds, and actually using 1 GiB RAM costs about **$0.049** with workspace/K. That is approximately 2.5× the literal split, not 12×. E2B's current documented 2-vCPU/512-MiB default is $0.1089/h before K, not the 2/4 price. Whether these smaller shapes can complete the same build is unmeasured.

### B. Paused/snapshotted between turns

**Do not remove inference wait from an unmodified process by assumption.** A VM making a streaming HTTPS model request normally must stay alive to consume it. Moving that request out of the VM and delivering the result after resume requires an external controller/transport adaptation: it already implements much of the split, without necessarily porting Node. Pausing also closes/disrupts network sessions. **[I]**

The achievable between-turn scenario retains **1,200 seconds inference + 120 commands**, then adds transitions. For E2B, [documented](https://docs.e2b.dev/sandbox/persistence) pause latency is approximately 4 seconds/GiB and resume approximately 1 second: conservatively budget 17 seconds × 20 cycles for a 4-GiB sandbox, **1,660 billed seconds**. This is not a measured invoice boundary; snapshot implementation can change it. For Sprites and Modal use the clearly estimated 2-second transition budget, **1,360 awake seconds**.

| Architecture | Infra/session-hour [E/I] | 1k/month | 100k/month | 1M/month |
| --- | ---: | ---: | ---: | ---: |
| E2B pause between turns | $0.07750 | $78 | $7,750 | $77,500 |
| Sprite, actual RAM 4 GB, actual CPU 122 s | $0.03641 | $36 | $3,641 | $36,406 |
| Modal snapshots, reserved 1 core/4 GiB | **≥ $0.09404 + S** | ≥ $94 + 1kS | ≥ $9,404 + 100kS | ≥ $94,036 + 1MS |

`S` is incremental snapshot storage/operation/transition cost per session not established by the public tariff. It must not silently become zero. The Modal row already includes a 1-GiB Volume retained for a day. [Modal Sandbox memory snapshots](https://modal.com/docs/guide/sandbox-snapshots) are alpha; they expire after seven days, close TCP connections, terminate the original sandbox, cannot snapshot a running exec, and do not properly restore background processes launched by an exec. Consequently this is a conditional cost floor for a compatible restart/resume design, **not proof that a live unmodified CLI can be transparently paused**. Filesystem snapshots and restarting with an agent transcript are a different implementation.

Sprites [idle rules](https://fly.io/sprites/) explicitly include open TCP connections, in-flight HTTP requests, output, and active tasks. They cannot automatically sleep through the agent's open model connection while preserving ongoing progress. With actual 1-GB resident memory the same modeled Sprite is about **$0.01161**, including persistent storage/K: **cheaper than the literal split**. This is a sensitivity, not a claim that every coding workload fits 1 GB.

### C. Workers/DO brain plus on-demand runner

The literal base case uses a full-hour brain, 20 runner bursts totaling **160 seconds alive**, and 120 active CPU-seconds. A distinct runner-controller DO costs another `$0.000256`. Workspace storage in the brain is `1 GB × 1/30 month × $0.20 = $0.006667`.

```text
Cloudflare runner = 120 × $0.000020
                  + 160 × (8 × $0.0000025 + 16 × $0.00000007)
                  = $0.0057792
Literal split H = $0.00576 + $0.0057792 + $0.000256
                + $0.0066667 + $0.00114 = $0.0196019
R2 workspace variant H = $0.0134852
```

| Split variant | Infra/session-hour [E/I] | 1k/month | 100k/month | 1M/month |
| --- | ---: | ---: | ---: | ---: |
| DO workspace + Cloudflare runner | $0.01960 | $20 | $1,960 | $19,602 |
| DO metadata + R2 workspace + Cloudflare runner | $0.01349 | $13 | $1,349 | $13,485 |
| DO workspace + E2B runner | $0.03473 | $35 | $3,473 | $34,727 |
| DO workspace + Fly shared runner | $0.02013 | $20 | $2,013 | $20,134 |
| DO workspace + Modal Sandbox runner | $0.02714 | $27 | $2,714 | $27,143 |

The E2B runner row budgets 120 + 340 transition seconds and uses E2B's included disk persistence; it is more conservative than pretending 20 resumes are free. Fly assumes the same 160 seconds plus a day of Volume persistence and deletes the stopped Machine/rootfs; retaining its image/rootfs adds `$0.15/GB-month`. Modal assumes persistent Volume workspace and process restart, not unpriced memory snapshots. These three variants keep the DO workspace too; eliminating that duplicate copy changes the literal design and lowers cost.

**The cheap runner is not established.** [Cloudflare disk is ephemeral across sleep](https://developers.cloudflare.com/containers/faq/). Each burst needs rehydration, snapshots, a remote filesystem, or incremental synchronization. The two-second transition/staging assumption is optimistic for a 1-GB repository with dependencies. If the brain can actually hibernate for all 2,280 estimated between-turn seconds, duration falls from $0.00576 to $0.002112 and the literal split falls to approximately **$0.01595/session**, just over 10× below live E2B. That is an implement-and-measure alternative, not free hibernation during model streams. A managed snapshot fee, if incurred, is extra. Full copying every burst means 20 GB/session of internal data movement even before useful commands. CPU spent unpacking and serial filesystem RPC latency must be included; “egress is free” does not make them disappear. **[F/I/E]**

For Cloudflare, with CPU useful work held fixed, every extra alive runner second adds about **$0.00002272**, including provisioned RAM/disk and controller DO. At 160/640/1,200/3,600 alive seconds, literal split infrastructure is approximately **$0.0196/$0.0305/$0.0432/$0.0978**. With a 1-GB DO workspace and full-hour brain, the fixed floor is already about **$0.0160** including useful CPU/K: 10× against E2B's $0.1667 permits only about 31 alive runner seconds, less than the assumed useful command work. 50× cannot fit even the brain-plus-workspace floor. **[I]**

**Cross-layer evidence available at final review:** [03-brain.md](03-brain.md) reports local Computer filesystem counters of 9,000 written rows for 1,000 overwrites and 4.033 million rows for a cold 1,000-path stat batch. Those measurements belong to that report, not to this investigation. If the write pattern applied to 1,000 logical writes/session, it would add roughly **$0.008** over this model's 1,000-row budget beyond allowances. [05-workspace.md](05-workspace.md) reports a roughly 29-MiB tracked Pi tree and 481-MiB dependency tree, supporting a smaller source-only persistence design. Neither supplies model-turn or command-frequency measurements; the 1-GB retained workspace remains a sensitivity assumption. **[M attributed / I]**

A TypeScript shell can avoid runner startup for supported operations, but costs local CPU and must pass behavioral checks. `jitk` needs its own execution-host fleet: price it as `host fleet + disk/object storage + network + idle capacity + operations`, divided by completed sessions. Its cited 1-ms execution and 0.5-MiB VM overhead are not a hosted price or the memory footprint of a build. No measured host utilization or current purchasable `jitk` service tariff exists in this research; assigning it a zero/millisecond-only cost would be invented. **[I]**

### Fleet invoices, limits, and missing line items

- **E2B:** add $150/month Pro where needed; custom resource configurations require the appropriate plan. Published concurrency add-ons reach 600 for +$500 and 1,100 for +$1,000; larger deployments need enterprise terms. The pricing estimator states a $3,000/month enterprise minimum. These are not all automatically additive to the same contract. The table is a list-rate consumption model, not an enterprise quote. **[F]** [Pricing](https://e2b.dev/pricing).
- **Modal:** Starter deducts up to $30/month compute and includes 100 containers; Team is $250 with $100 compute included and 5,000 containers. Volume allowance can subtract up to $92.16/month from gross storage. Region selection can increase rates. Use the Sandbox tariff, not the ordinary Function tariff, for a sandbox. **[F]** [Pricing](https://modal.com/pricing).
- **Cloudflare:** add $5 once per account, then subtract shared included usage before rounding DO duration. Applying the published allowances to the literal split gives approximate actual infrastructure invoices **$28.29 / $1,908.98 / $19,544.56** at 1k/100k/1M sessions. The 1k invoice can exceed gross marginal cost plus $5 because duration overage rounds to a million GB-s. For replication, gross DO-duration usage is `N × (3600+160) × 0.128` GB-s; charge `ceil(max(usage−400000,0)/1e6) × $12.50`. Subtract the other rate-card allowances separately, use 1.01 GB of retained workspace/transcript per session-day and 80 DO requests/session, and add the $5 plan. These estimates exclude unmeasured extra staging, snapshot, and network charges. **[I]**
- **Daytona:** if the real sandbox reserves 10 GiB rather than fitting the first 5 GiB, add `5 × $0.000108 × 24 = $0.01296/session` for a day's storage under that allowance interpretation. Confirm the allowance scope and lifecycle configuration before purchase; never multiply a free account allowance independently across every sandbox. The zero-storage line is a favorable within-allowance custom configuration; the second Daytona row uses the [published medium snapshot](https://www.daytona.io/docs/en/sandboxes/) with 8 GiB disk and charges the excess 3 GiB. If the free allocation is account-wide rather than per sandbox, add the relevant fleet disk charge instead; the fetched pricing text does not settle that scope. **[F/I]** [Pricing](https://www.daytona.io/pricing), [billing](https://www.daytona.io/docs/billing).
- **Concurrency:** 1M one-hour sessions in a 30-day month average **1,389 live sessions**, versus about **62 runners** at 160 runner seconds/session; an estimated 5× peak is 6,944 brains or 309 runners. Default published [Cloudflare limits](https://developers.cloudflare.com/changelog/post/2026-02-25-higher-container-resource-limits/) are 6 TiB RAM/1,500 vCPU across live containers: standard-3 always-on needs more than the RAM limit even on average; the split fits this illustrative peak. This is capacity leverage, not a benchmark or a guarantee of burst admission. **[F/I/E]**
- **Network/tool extras:** Cloudflare Containers NA/EU egress $0.025/GB; Fly NA/EU $0.02/GB; Modal $0.04/GiB with plan allowances; Vercel Sandbox $0.15/GB. At 1 GB paid egress/session that is another **$20k–$150k/month per million sessions**, comparable to or greater than split compute. R2 egress is free. E2B/Daytona network overages were not established from the fetched public tariff, so they remain contract variables rather than fabricated zero-priced commitments. Paid search, browsers, proxies, and artifact retention are `X` in the formula. **[F/I]** [Cloudflare](https://developers.cloudflare.com/containers/platform/pricing/), [Fly](https://fly.io/pricing/), [Modal](https://modal.com/pricing), [Vercel](https://vercel.com/docs/sandbox/pricing).

## 2. Inference share and the threshold where infrastructure matters

### Current model dollars per estimated session-hour

Use **standard short-context API tariffs**, not subscription cost divided by nominal unlimited hours. Prompts here are 50k, below cited long-context thresholds. Cache writes are explicitly charged for newly cached input: `I = 0.8 × cached_input + 0.2 × cache_write + 0.04 × output`, with prices per million tokens. No-cache uses `input + 0.04 × output`. This assumes all 20% new input is cached; applications that do not write it use base input rates instead. Provider-specific caching behavior and tokenizer changes can alter actual token counts. **[E/I]**

| Tier/model | Input / cached read / cache write / output, $/M [F] | No-cache $/h [I] | Base cache scenario $/h [I] |
| --- | --- | ---: | ---: |
| Frontier: [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) | 10 / 1 / 12.5 / 50 | $12.00 | **$5.30** |
| Frontier coding: [Claude Opus 5.5](https://platform.claude.com/docs/en/about-claude/pricing) | 4 / 0.20 / 5 / 20 | $4.80 | **$1.96** |
| Strong coding: [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) | 2 / 0.10 / 2.5 / 10 | $2.40 | **$0.98** |
| Mid: [Claude Sonnet 5.5](https://platform.claude.com/docs/en/about-claude/pricing) | 2 / 0.10 / 2.5 / 10 | $2.40 | **$0.98** |
| Small: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) | 0.10 / 0.01 / 0.125 / 0.50 | $0.120 | **$0.053** |
| Small: [Claude Haiku 5.5](https://platform.claude.com/docs/en/about-claude/pricing) | 0.10 / 0.01 / 0.125 / 0.50, prompts ≤100k | $0.120 | **$0.053** |
| Workers AI: Qwen3 30B A3B FP8 | 0.051 / no cache discount assumed / — / 0.335 | **$0.0644** | $0.0644 |
| Workers AI: Granite 4.0 H Micro | 0.017 / no cache discount assumed / — / 0.112 | **$0.02148** | $0.02148 |
| Workers AI: GPT-OSS 120B | 0.350 / no cache discount assumed / — / 0.750 | **$0.380** | $0.380 |
| Workers AI: Qwen2.5 Coder 32B | 0.660 / no cache discount assumed / — / 1.000 | **$0.700** | $0.700 |

Workers AI tariffs: [official pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/); exclude the daily free allocation from the scaling model. A small open model being cheap does **not** establish that it completes the same coding task, fits the same context, or needs the same turns/retries. Compare **cost per successfully verified task**, not just this controlled token basket. **[F/I]**

Thus “infrastructure is 2–5%” is conditional. E2B's modeled infrastructure share is **3.1% with Astra**, **7.8% with Opus**, **14.5% with Sol/Sonnet**, **75.9% with cached Luna/Haiku**, and **72.1% with Qwen3**. The split's corresponding shares are **0.37%, 0.99%, 1.96%, 27.0%, and 23.3%**. Granite's split infrastructure share is already **47.7%**. Bigger reasoning outputs increase inference share; longer gaps between requests decrease it. **[I]**

### End-to-end fleet bills, including inference

Add each model's `I × N` to **any** architecture above. For example, inference alone costs **$5,300/$530k/$5.3M** on Astra, **$980/$98k/$980k** on Sol, and **$53/$5,300/$53k** on cached Luna at 1k/100k/1M sessions. The following shows representative complete consumption totals; add plan/included-usage adjustments and `X` from above. **[I/E]**

| Architecture and model | Per session | 1k/month | 100k/month | 1M/month |
| --- | ---: | ---: | ---: | ---: |
| Live E2B + Sol | $1.14674 | $1,147 | $114,674 | $1,146,740 |
| Paused E2B + Sol | $1.05750 | $1,058 | $105,750 | $1,057,500 |
| Paused Sprite 4 GB + Sol | $1.01641 | $1,016 | $101,641 | $1,016,406 |
| Literal split + Sol | $0.99960 | $1,000 | $99,960 | $999,602 |
| Live E2B + Luna | $0.21974 | $220 | $21,974 | $219,740 |
| Paused E2B + Luna | $0.13050 | $131 | $13,050 | $130,500 |
| Paused Sprite 4 GB + Luna | $0.08941 | $89 | $8,941 | $89,406 |
| Literal split + Luna | $0.07260 | $73 | $7,260 | $72,602 |

The split cuts the live-E2B total about **12.8% with Sol**, **2.7% with Astra**, and **67.0% with Luna**. Against an already-paused 4-GB Sprite it saves only **1.7% of the Sol total**, or **18.8% with Luna**. That comparison is more commercially relevant than advertising an isolated 10× infrastructure ratio. **[I]**

### Exact 25% threshold

For infrastructure H and inference I, ignoring other paid tools:

```text
infra share = H / (H + I)
infra share > 25% exactly when I < 3H
```

For this workload, divide `3H` by **1.04 million total tokens** to express a workload-weighted effective $/million-token threshold, including caching. It is not an output-token list price.

| Baseline | Inference must fall below $/session-hour | Effective blended $/M |
| --- | ---: | ---: |
| Live E2B/Daytona | $0.5002 | $0.4810 |
| Fly shared, alive | $0.1242 | $0.1194 |
| E2B paused | $0.2325 | $0.2236 |
| Sprite 4 GB, paused | $0.1092 | $0.1050 |
| Literal split | **$0.0588** | **$0.0565** |
| R2 split | $0.0405 | $0.0389 |

If tools cost X, the condition is `I + X < 3H`. More infrastructure-efficient designs push the crossover farther out; there is no universal “inference will fall until this wins” date. **[I]**

### Price trends, 2023–2026: real declines, no guaranteed extrapolation

- **2023:** OpenAI's [deprecation history](https://developers.openai.com/api/docs/deprecations) records original `gpt-4-0314` at **$30/M input, $60/M output**. The controlled uncached token basket would cost **$32.40**. Its small context does not actually support this report's 50k per request; the basket is a price index, not an executable 2023 workload. **[F/I]**
- **2024:** [GPT-4o mini's dated model](https://developers.openai.com/api/docs/models/gpt-4o-mini), `2024-07-18`, is listed at **$0.15/$0.60**, or **$0.174** for that basket. That is a 186× lower token-basket price than original GPT-4, **across different capability tiers**, not a measured 186× fall in cost per successful hard coding task. **[F/I]**
- **2025:** Anthropic's [November 24 Opus 4.5 announcement](https://www.anthropic.com/news/claude-opus-4-5) prices it at **$5/$25**, versus the **$15/$75** older Opus tier preserved in its [price table](https://platform.claude.com/docs/en/about-claude/pricing): a concrete **3×** generation price reduction. **[F/I]**
- **2026:** Opus 5.5 is **$4/$20** and Sonnet 5.5 **$2/$10**; current Sol is **$2/$10**, while Astra remains **$10/$50**. Cheap-model tariffs already cross several infrastructure thresholds, yet the newest demanding-work tier retains a high price. Anthropic also reports approximately **30% more tokens for the same text with its newer tokenizer**; per-token reductions overstate the corresponding text-cost reduction if ignored. **[F/I]** [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra).

**When plausibly reached? [E]** It is already reached for cached Luna/Haiku on the literal split and for Qwen3/Granite on several VM baselines. For today's Sol basket, the crossover needs another **1.96×** inference reduction against live E2B, **4.22×** against paused E2B, **8.97×** against the paused Sprite, and **16.67×** against the literal split. If, purely as a scenario, fixed-task inference halves every 6–12 months, those occur around **2027; late 2027–2028; 2028–2029/early 2030; and late 2028–2030**, respectively. For Astra versus the literal split, the required **90×** decline takes roughly **3.2–6.5 years** under that same assumption. This is a sensitivity calculation, not evidence for a law or a launch date. More reasoning, longer contexts, retries, and users choosing stronger models can consume all price savings.

## 3. Competition: what is already claimed

The distinction is between **an external control plane**, **an external agent loop**, and **an unmodified CLI brain actually running inside workerd**. A serverless HTTP handler that starts a VM does not prove the third.

| Competitor | What primary evidence establishes [F] | Consequence [I] |
| --- | --- | --- |
| **Cloudflare Agents + Sandbox** | [PiHarness](https://developers.cloudflare.com/agents/harnesses/pi/) runs Pi Durable in a DO with SQLite state, wake-up, retries/recovery, and a complete example with durable filesystem/code execution. [Sandbox guides](https://developers.cloudflare.com/sandbox/coding-agents/) separately run Claude Code, Codex, OpenCode, and Pi inside Linux Containers. | The broad brain/state-on-DO proposition, even specifically using Pi, is already occupied. Pi Durable integration is not evidence the complete original CLI and arbitrary Node extensions run unmodified inside workerd. |
| **Vercel AI SDK + Sandbox + just-bash** | [AI SDK HarnessAgent](https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk) supplies Claude Code/Codex/Pi adapters and sessions. Its [implementation guide](https://vercel.com/kb/guide/sandboxed-coding-agent-with-harnessagent) puts the real harness inside a Sandbox. [just-bash](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/README.md) supplies an in-process TypeScript shell/virtual filesystem. [Managed Agents integration](https://vercel.com/changelog/run-claude-managed-agents-with-vercel-sandbox) combines an external managed loop with Vercel execution. | Both cheap local shell + real runner and hosted agent + external tools exist. The CLI-in-Sandbox mode still pays sandbox memory while that CLI waits for inference. |
| **Modal** | [Managed Agents integration](https://modal.com/blog/introducing-claude-managed-agents-with-modal-sandboxes) explicitly separates Anthropic's hosted loop/session state from Modal tool execution. Sandbox SDKs, custom images, and snapshots are available. | A direct commercial implementation of the broad split, not simply an unrelated VM provider. Its snapshot compatibility limits still matter. |
| **E2B** | [Product](https://e2b.dev/) supports external user-provided harnesses and a microVM execution surface. The [AI SDK adapter](https://github.com/e2b-dev/ai-sdk-sandbox) runs Claude Code/Codex through HarnessAgent inside E2B. Pause removes idle compute billing. | External serverless orchestration plus sandbox is standard; whole-CLI hosting is standard. Neither establishes an unmodified workerd brain. |
| **Daytona** | [Claude guides](https://www.daytona.io/docs/en/claude/) cover Claude Code inside a sandbox, Claude Agent SDK, and Claude Managed Agents with Daytona as the execution environment. | Both colocated and externally managed agent-loop patterns are sold. |
| **Replit** | [Agent billing/docs](https://docs.replit.com/billing/ai-billing) provide managed building, checkpoints, background tasks, model routing, and effort-based paid work. | Competes on completing and publishing applications. The fetched docs do not disclose whether its internal brain uses serverless isolates; do not invent that architecture. It is not an advertised arbitrary unmodified-CLI-in-workerd service. |
| **Codex cloud** | [Official docs](https://learn.chatgpt.com/docs/cloud) give each task a separate workspace in a prepared cloud environment. Separately, OpenAI's [Agents SDK migration guide](https://developers.openai.com/cookbook/examples/agents_sdk/migrate-from-claude-agent-sdk/readme) explicitly keeps the agent loop in the application runtime and uses sandbox compute as a tool. | Codex cloud is a finished workflow competitor; its public user docs do not establish DO-like internals. The developer SDK already promotes the general split. Do not infer CLI portability from a Node/npm installation interface; verify the pinned runtime artifact separately from the Agents SDK architecture. |
| **Cursor background/cloud agents** | [Cloud Agents](https://cursor.com/docs/cloud-agent) run in isolated VMs with full environments. [Self-hosted Machines](https://cursor.com/docs/cloud-agent/self-hosted) run Cursor CLI on customer workers; managed cloud execution infrastructure is included with selected-model pricing. | Competes on agent outcomes and ready environments; no fetched evidence of its CLI brain executing in workerd. Bundling makes “save user a few infrastructure cents” a weak end-user proposition. |
| **Devin** | [Current pricing](https://devin.ai/pricing) includes cloud agents, model quotas, and extra usage at API pricing. Current published offering is not adequately described by old $500/ACU summaries. | Managed agent competitor, not evidence of the proposed runtime internals or a general Node compatibility platform. Its private architecture and infra cost are unknown here. |
| **Anthropic Managed Agents** | [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) charges **$0.08 per active session-hour plus model tokens**, excluding idle/rescheduling time; Modal, Vercel, and Daytona integrations demonstrate external tool environments. | The broad split is already a paid managed category. Its premium buys managed lifecycle, not merely raw CPU. A cheaper replacement must preserve those capabilities. |

**Pi-specific reality check [F]:** the requested `badlogic/pi-mono` URL currently [redirects to `earendil-works/pi`](https://github.com/badlogic/pi-mono); upstream now documents `@earendil-works/pi-coding-agent`. Pin the exact historical/current package being targeted. Pi itself documents a [Gondolin extension](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/containerization.md) that leaves Pi on the host and routes built-in tools and `!` commands into a microVM. Other extensions still execute on the host unless they delegate. Tool transport separation is therefore not new, even within Pi's ecosystem.

**Does anyone run unmodified Node agents “this way”?**

- **Yes, if “this way” means a serverless frontend controlling a real CLI inside an isolated runner.** Cloudflare and Vercel document Pi/Claude Code/Codex; E2B and Daytona also document established harness hosting. This is not the hypothesized cost split during model calls. **[F/I]**
- **Yes to a Pi-derived durable agent loop in a DO:** Cloudflare's Pi Durable support is direct evidence. **No evidence found that the complete specified Pi CLI, arbitrary extensions, Claude Code, and Codex native runtime all execute unmodified inside workerd with only tool subprocesses remote.** Absence of evidence is not proof of exclusivity. **[F/I]**

**What might remain unclaimed [I]:** a tested compatibility boundary that runs a *pinned existing CLI/package* unchanged in workerd, supports a useful existing extension corpus, preserves filesystem/process/session behavior across eviction, and can swap execution providers without rewriting tools. The compatibility suite and upgrade maintenance may be valuable. “GrowOS writes more Node shims,” a fast command transport, or a sample Pi DO app alone are not durable differentiation against these incumbents. Also ask whether using Pi Durable and replacing a handful of tool adapters solves the customer's actual need more cheaply than preserving the complete original CLI.

## 4. Who pays, and how much room is there?

| Potential buyer | Why they might care [I] | Qualification required |
| --- | --- | --- |
| Platforms hosting many persistent agents | Low memory residency, resumable sessions, events, fleet admission, predictable storage | Actual avoidable bill or operations pain after enabling incumbent pause/right-sizing |
| Cheap-model agents | Infrastructure is already a large part of the total | Small models must complete the task with acceptable retries; no free equivalence assumption |
| Massive fan-out/evals | Admit many brains instantly; allocate runners only to the fraction executing | Peak runner concurrency, model rate limits, snapshot/image distribution, and tool burst correlation |
| Background/waiting agents | Long-lived identity and scheduled wake-up without permanent process reservation | Existing DO/Workflow/E2B-pause/Sprites behavior must fail a concrete requirement |
| Interactive frontier coding subscribers | Usually care more about correctness, setup, latency, and integration | Low willingness to replace a polished product solely for cents/hour; provider may bundle infra |

**Persistent does not mean constantly running.** One million agents that each work one hour/month and retain 1 GB all month imply **$200k/month DO workspace storage**, before compute, rather than the **$6,667** workspace line for one-day retention. R2 would be **$15k/month** before operations; E2B currently includes paused retention within published limits, which makes storing dormant identities/files in DO SQL a potentially bad economic choice. A session metadata record of 100 KB is entirely different from a 1-GB checkout. **[F/I]**

**Commercial ceiling [E/I]:** against live E2B, the literal split saves approximately **$0.147/session**, or **$147/$14.7k/$147k per month** at the requested fleet sizes. Against paused E2B it saves **$0.0579/session**; against the 4-GB Sprite, **$0.0168/session**. Against the 1-GB Sprite sensitivity, it loses. A supplier capturing 30% of the Sprite savings earns roughly **$0.005/session**, only **$5k/month at a million sessions**, before support and hosting margin. With an estimated fully loaded engineer cost of $180k/year, that single cost requires about **3M sessions/month at that capture rate**. These are willingness-to-pay ceilings from savings, not sales forecasts.

A high-volume platform could still care about $10k–$100k/month or concurrency headroom; a small developer rarely should build a compatibility runtime to save $100/month. Integration complexity and even a small extra failure rate can erase the savings: at 1M Sol sessions, an additional 2% full inference retries costs about **$19.6k/month**, already greater than the entire modeled saving versus the paused Sprite. **[I]**

**Product / demo / neither:**

- **Demo/CV piece: go-with-changes.** A rigorously tested “pinned Pi CLI in workerd, state survives eviction, tools remote, actual billing comparison” is an interesting systems result. Publish differential tests, a trace replay, and failure cases. A generic Agents SDK demo duplicates existing examples.
- **Product: not yet.** Proceed only if a real platform requires existing CLI/extension compatibility that Pi Durable or ordinary external tool adapters cannot provide, and net savings/capacity improvement pays for support and upgrades. Sell durable compatibility/reliability if proven, not the unqualified split idea.
- **Neither:** if the deliverable is merely porting enough of Pi to reproduce the existing Cloudflare PiHarness example, or comparing a tiny command microbenchmark against a large always-on sandbox while omitting inference, snapshots, and storage.

## 5. Early blockers ranked by estimated probability × damage

Scores are judgment, not measured probabilities. Damage is 1–5; rank is the product. Every experiment is local/read-only or a customer-evidence review, takes hours, and needs no paid model call or deployment.

| Rank | Blocker; probability × damage [E] | Current evidence and why it can kill this layer | Cheap verification and pass/fail |
| --- | --- | --- | --- |
| 1 | **Incumbent already meets the need**; 0.95 × 5 = 4.75 | Cloudflare PiHarness + durable files; Vercel/Modal/Anthropic external-loop designs. A port can be technically novel without solving a commercial gap. | **3–4 h:** pin the requested Pi version; inspect/run existing Cloudflare PiHarness example with a fake model, and replay ten essential CLI/extension behaviors against both. **Pass:** ≥2 buyer-critical behaviors only the proposed unchanged-CLI approach preserves, recorded as failing incumbent tests. **Fail:** existing harness + small adapters meets all essentials. |
| 2 | **Workspace/start/idle costs erase the ratio**; 0.80 × 5 = 4.00 | Cloudflare ephemeral disk, provider transition time, reserved RAM. Fixed DO workspace/brain floor already prevents 10× in the base literal design. | **3–4 h:** replay a 1-GB representative repo using local Node/mock runner, record bytes copied, CPU, command durations, and save/restore latency across 20 bursts. Price measured counters with this rate card. **Pass for 10× claim:** total H ≤ $0.01667 versus E2B and no omitted required service; **commercial pass:** ≥30% below the cheapest viable right-sized/paused baseline. Otherwise remove the claim or stop. Local results cannot establish cloud cold-start/billing latency. |
| 3 | **No buyer margin after migration/reliability cost**; 0.80 × 4 = 3.20 | Optimized competitor saves only $0.0168/session in the favorable 4-GB case; 1-GB Sprite wins. A 2% inference retry penalty can erase the gap. | **2–3 h per candidate platform:** use existing invoices/trace evidence and a walkthrough, without sending outreach in this task. **Pass:** named owner identifies ≥$10k/month avoidable cost or a hard admission constraint, and a concrete integration budget; use ≥30% net savings and retry overhead <0.5% as initial gates. **Fail:** only hypothetical scale or a comparison to needlessly idle VMs. Actual customer validation remains unperformed. |
| 4 | **“Unmodified” cannot be made durable affordably**; 0.70 × 4 = 2.80 | DO reconstruction is not VM process continuation; Pi Durable solves this through a dedicated durable runtime. Network streams and extension-owned state complicate recovery. | **4 h:** fake-model session, force eviction/restart between model/tool/commit boundaries 100 times, use a non-idempotent mock command and byte hashes of workspace state. **Pass:** zero lost accepted turns, zero duplicated committed effects, exact file state, <0.5% equivalent extra model-token work. **Fail:** requires forbidden source changes, silent loss, or expensive replay. |
| 5 | **Cheap model needs much more work**; 0.60 × 3 = 1.80 | Token prices are sourced; matched task success is not. Faster/cheaper models can increase turns, command retries, and wall time. | **2–4 h:** audit existing recorded evaluation traces for ≥30 comparable tasks; no new API calls. **Pass:** price complete verified outcomes, include failures/retries, and retain the commercial savings gate. **Fail:** only a token-basket comparison exists; keep the small-model case hypothetical. |
| 6 | **Billed density differs from physical density**; 0.75 × 2 = 1.50 | DO bills 128 MB/object despite shared isolates; runner fleet still peaks. Claimed jitk VM overhead excludes guest workload and operations. | **2 h:** spreadsheet/Python replay of observed arrival times and correlated fan-out, with published account limits and host headroom. **Pass:** intended peak within confirmed quota with ≥20% capacity margin, or a documented quota path. **Fail:** average concurrency presented as instant-fan-out capacity, or unpriced host fleet. |

## Five-line TL;DR

1. **F:** The broad split already ships; Cloudflare even documents Pi Durable running in Durable Objects.
2. **E/I:** Literal DO workspace + runner is about **$0.0196/session-hour**, versus **$0.0364** for a paused 4-GB Sprite and **$0.0116** at 1 GB actual RAM.
3. **I:** 10× infrastructure is baseline-dependent; end-to-end savings are **2.7% with Astra**, **12.8% with Sol**, and **67% with Luna** versus live E2B.
4. **I/E:** Cheap-model and high-volume platform workloads can care now; inference decline alone does not establish a differentiated business.
5. **Verdict:** **GO-WITH-CHANGES for the compatibility/measurement demo; NO-GO for the generic product claim until buyer and incumbent gaps are proven.**

**Run first:** (1) incumbent-versus-pinned-CLI behavior replay; (2) real trace/workspace/runner counter replay priced against right-sized paused alternatives; (3) eviction/recovery correctness with zero lost turns or duplicated committed effects.
