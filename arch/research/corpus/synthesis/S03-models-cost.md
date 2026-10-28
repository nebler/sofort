# S03 — Models, inference and cost

Research date: **2026-10-28**. Scope: the supplied corpus and Cloudflare Connect 2026, with new public prior-art checks.

**I — Finding:** rising inference prices strengthen the case for avoiding wasted inference and reclaiming scarce serving capacity. They do **not** reverse the earlier arithmetic against saving a small amount of agent-host infrastructure underneath an expensive frontier-model workload. The most interesting operator problem is retiring a model people still want so its GPUs can serve something else. The most concrete user wish is useful classification that keeps private data on a desktop or phone. Both now face much closer prior art than the extraction ledgers found.

**I — Recommendations:** investigate an operator-side model-retirement rehearsal; contribute a private-data-safe offline classifier parity corpus; investigate GPU telemetry upgrade fixtures upstream. Keep the other fifteen projects below, including weak and ambiguous ones. No broad router, classifier service, inference autotuner, GPU-kernel agent, agent host, or cache engine is presented as new.

## Evidence, reading and limits

- **Q** = a caption quotation or attributed speaker claim. **F** = an independently checked source or local documentary fact. **I** = interpretation, proposal or status assessment. **E** = illustrative arithmetic, effort or subjective score.
- **F — Reading:** read the brief, the background kill list/rules and stack/Connect summaries; read every per-video digest, recurring-theme/disagreement section, prior-art triage and final candidate section in [E01](/Users/noah/code/sofort/arch/research/corpus/extract/E01.md), [E02](/Users/noah/code/sofort/arch/research/corpus/extract/E02.md), [E03](/Users/noah/code/sofort/arch/research/corpus/extract/E03.md), [E04](/Users/noah/code/sofort/arch/research/corpus/extract/E04.md), [E05](/Users/noah/code/sofort/arch/research/corpus/extract/E05.md), [E06](/Users/noah/code/sofort/arch/research/corpus/extract/E06.md), [E07](/Users/noah/code/sofort/arch/research/corpus/extract/E07.md), [E08](/Users/noah/code/sofort/arch/research/corpus/extract/E08.md), [E09](/Users/noah/code/sofort/arch/research/corpus/extract/E09.md), [E10](/Users/noah/code/sofort/arch/research/corpus/extract/E10.md), and [E11](/Users/noah/code/sofort/arch/research/corpus/extract/E11.md). Read the checked-signal, convergence, candidate, score and concluding sections of all five [Connect ledgers](/Users/noah/code/sofort/arch/research/connect26/SUMMARY.md). Connect has three final candidates per ledger, rather than five.
- **F — Search:** searched signal rows across all sixteen ledgers and both transcript directories for tokens, spend/pricing, subsidies/subscriptions, inference, models/routing, classification, open weights, local/on-device, post-training/distillation, retirement, KV/cache, speculative decoding, vLLM/SGLang, GPUs/TPUs/NPUs, silicon and Homa. Read matching signal rows, including negative results, jokes, corrections and occupied territory. Returned to original caption spans for the material claims below. This is selective transcript verification, not a claim to have reread all 98 complete recordings.
- **I — Independence:** counts below are conservative counts of the explicitly listed anchor speakers and upload channels. They are not customer counts or prevalence estimates. Repeated appearances of Theo, Ben Davis, Armin, Amp, Cloudflare and Baseten are collapsed within a cluster. An uncertain team turn is not split into invented individual speakers. Different speakers at one company are not independent organizations; cross-company convergence carries more weight.
- **I — Time:** recording chronology is not file-number order. Video 62 is an older Karpathy recording, identifiable from its discussion of Claude 3.7 appearing during recording; it is historical evidence, not a current capability inventory. Captions use minute buckets and sometimes garble model names and numbers. Model labels such as Gemini 4, Opus 5.5 and Grok 4.7 below are the corpus labels, not independently certified release identities.
- **F/I — Public research:** primary repositories, model cards, npm registry metadata, papers, product docs and dated changelogs were checked on this date. HN and indexed X searches were discovery and practitioner-context checks. An absent result is never an absence proof. No software was installed, no GPU benchmark was run, and no operator/customer was interviewed for this report.

Video references below link to local source captions using reference definitions at the end. `C04`, for example, means Connect talk 04, not corpus video 04. The ledger/video families in the coverage register preserve additional signals without pretending every occurrence of “model” concerns inference economics.

## 1. Does the inference-price shock revive infrastructure savings?

### 1.1 Three different questions were previously conflated

**I:** distinguish (a) the cash a subscription user pays, (b) the API-list-price equivalent of the same retained usage, and (c) the provider's actual serving cost. None reveals either of the others. List-price equivalent is useful exposure analysis, not an audited subsidy or a measurement of provider losses. Likewise, token price, cost per completed task and total monthly spending can move in different directions.

**Q:** Michelle predicts disappearing or tighter subscriptions in six to twelve months ([12, 42:00–43:00][v12]). Mario independently worries about the same horizon ([05, 59:00][v05]). Armin's $20 hardware experiment would have represented approximately $15,000 at his notional token valuation, and he says he would not have done it at that price ([80, 1:23:00–1:24:00][v80]). These establish exposure and elastic demand, not financial statements proving that every subscription loses money.

**Q — Counterpositions:** Theo expects fixed-capability intelligence to become much cheaper and execution machines eventually to dominate ([85, 11:00–16:00, 25:00][v85]); Ben hopes for much better and cheaper models ([31, 23:00][v31]); Dax offers scarcity and eventual overbuilding scenarios, and explicitly declines to predict that token prices will double ([13, 34:00–36:00, 54:00–55:00][v13]). The corpus does not establish one inevitable price trajectory.

### 1.2 The arithmetic runs against the proposed reversal

**E/I:** let `f` be execution infrastructure's original fraction of the total bill, `a` the inference-price multiplier, and `s` the fraction of execution cost eliminated. Hold useful workload, model behavior and execution prices fixed:

`new execution share = f / (f + a × (1 − f))`

`new total-bill saving = s × f / (f + a × (1 − f))`

Using the earlier report's **scenario inputs**, not newly measured fleet shares:

| E — original execution share | Inference multiplier | New execution share | Saving if execution cost is halved |
|---|---:|---:|---:|
| 2–15%, frontier scenario | 1× | 2–15% | 1–7.5% |
| 2–15%, frontier scenario | 2× | 1.01–8.11% | 0.51–4.05% |
| 2–15%, frontier scenario | 5× | 0.41–3.41% | 0.20–1.70% |
| 2–15%, frontier scenario | 0.1× | 16.95–63.83% | 8.47–31.91% |
| 75%, cheap-model scenario | 2× | 60% | 30% |

**I — Verdict:** a rise in API inference prices alone makes a cheap agent VM less financially consequential. It makes fewer failed turns, fewer repeated context reads, better model allocation and provider-side GPU efficiency more consequential. Falling fixed-capability prices, successful substitution to small/local models, unusually expensive compilation/browser verification, or independently rising execution prices can make execution infrastructure important. Those are separate hypotheses to measure.

**Q — Relevant counterexamples:** Theo reports compute exceeding tokens under subscriptions ([01, 01:00][v01]); Amp wants cheaper sandboxes ([51, 26:00–27:00][v51]); TELUS says hosting is pocket change and primarily bills AI usage ([C12, 27:00][c12]). These workloads differ. They do not establish a universal execution/inference split.

### 1.3 A real 2026 production counterexample to “output always dominates”

**F:** Cloudflare's October 19 account reports a code-review cost reduction from $2.43 to $0.77 after changes to context handling, code, model selection and effort. Before that work, output represented 23% of spending, cache writes 43%, and reads 34%. Cache hit rate had risen from 85.7% to 97% while token volume per review more than tripled. This is a documented workload in which a high hit rate did not prevent a growing bill. Its quality analysis also found that lowering effort could remove useful findings. These are the operator's measurements, not a reproduction here. [Cloudflare optimization report](https://blog.cloudflare.com/obsessive-inference-optimization/)

**I:** the background's approximately 80% output-share claim for one cached-call calculation cannot be generalized to long agent sessions. This new evidence revives **workload-specific context economics**, not the killed “reasoning CDN,” agent JIT or generic cache proxy.

A useful comparison must record uncached input, cache creation by TTL, cache reads, output including billed reasoning, tool charges, failed attempts, speed/context surcharges, subscription cash and separately priced execution. It must also record accepted output, human setup/review/rework and task scope. Reasoning tokens must not be charged twice if already included in output. Repricing a trace holds its behavior fixed; changing model, routing or compaction requires a fresh experiment.

## 2. Signal clusters and independent convergence

### C1 — Subscription cliffs, heavy tails and spending without outcomes

**I — Anchor count: 6 distinct speakers / 6 upload channels**, with only one operator directly discussing the whole Workers AI fleet. The shared evidence concerns exposure; the forecast of universal subscription collapse remains disputed.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [01, 19:00–20:00][v01] | Theo | “Don't do this over API prices” | Experimental feasibility depends on procurement mode. |
| [12, 42:00–43:00][v12] | Michelle Chen | “do subscriptions exist in six to 12 months?” | Model-dependent products need a downside scenario. |
| [05, 59:00][v05] | Mario | “subsidies ... end within the next 6 to 12 months” | Independent concern, not confirmation of a date. |
| [80, 1:24:00][v80] | Armin Ronacher | “I would not have paid $15,000 in tokens” | Much hobby demand may vanish rather than migrate at list prices. |
| [38, 02:00–04:00][v38] | Thorsten Ball | “they had to switch to API pricing”; “€50 a week” | Reported consultancy experience includes interrupted work and a forced downgrade; secondhand policy detail is uncertain. |
| [C04, 09:00][c04] | Greg, Sentry | “If I 100x, I'm still fired” | A 3× unit saving does not pay for 100× coverage. |

**Additional Q:** Ree/Sunil can consume a large allowance in days (11 01:00–02:00); Theo reports an unattended goal consuming paid credits after a plan change (16 1:46:00–1:48:00); Uber deploys session cost coaching and spend tiers (19 24:00–29:00); TELUS learned metering after repeated morning OCR jobs (C12 08:00); Armin reports token spend growing faster than team productivity (82 1:37:00–1:40:00). These support P04/P16/P17, not another spend dashboard.

### C2 — Token price is a poor proxy for accepted-task cost

**I — Anchor count: 6 speakers / 6 channels.** This has the strongest broad convergence, but the speakers disagree about which work is predictable enough to downgrade.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [30, 08:00–09:00][v30] | Ben Davis | “actual price ... is not the sticker price” | Same request can require a connector, code or computer use. |
| [16, 1:01:00][v16] | Theo | “$150 ... $146”; “20 minutes ... 4.6 minutes” | His router trial did not beat the fixed strong model; the numbers are his unreplicated account. |
| [65, 14:00–15:00][v65] | Alex, OpenRouter | “small models may actually increase your cost” | Escalation and thrashing matter. His Opus/Haiku magnitude is also unreplicated. |
| [74, 10:00–11:00][v74] | Mikhail Parakhin | “barbell strategy” | Frontier development and tuned production are different optimization problems. |
| [37, 07:00–08:00][v37] | Thorsten Ball | “cheapest model that matches your evals”; “spent more tokens, cheaper tokens” | Known production tasks and open-ended building need separate baselines. |
| [24, 1:20:00][v24] | Chris Lattner | “a gajillion tokens later ... it doesn't work” | Failed runs and human alternatives belong in the denominator. |

**Q — Keep the disagreement:** Scott Wu predicts about 2% frontier workloads and predominantly commodity execution (10 11:00), while Harvey's Gabe expects consistently frontier coding but repeatable specialist legal work (34 09:00–10:00). Amp fears the hidden repair cost of rationing frontier access (36 11:00; 38 03:00–14:00). Dax reports marketing teams selecting Opus/high effort for everything (13 52:00). No universal routing rule follows.

### C3 — Cheap classifiers and useful offline decisions

**I — Anchor count: 5 speakers / 4 channels.** Sunil and Ree share one conversation; their two statements do not constitute two independent product deployments.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [11, 12:00–16:00][v11] | Sunil Pai | “eat the market from the bottom”; “run ... on my phone” | Both a market forecast and an explicit device wish. |
| [11, 15:00–18:00][v11] | Ree, Executor | “data needs to stay on the users's machine”; “all of this intent information” | Private tool search provides a concrete corpus and training signal. His “70% improvement” has no published metric here. |
| [30, 05:00–09:00][v30] | Ben Davis | “not as smart as a normal LLM”; “doesn't have the actual context” | Structured answers do not solve reasoning or missing environmental information. |
| [58, 12:00–14:00][v58] | CJ Reynolds | “chatbot that does not use an LLM at all” | His tool-selection demo avoids generative prose; it still uses a learned classifier. |
| [65, 30:00][v65] | Carter, NVIDIA | “I'm not at 100% utilization” | Idle local hardware and privacy motivate hybrid execution independently of API prices. |

**Additional Q:** Jev supports short bounded questions and probabilities, with mostly synthetic training claimed (11 04:00–11:00); Armin uses issue-delta classification through Code Mode (80 1:12:00); Scott patched GPUI accessibility testing around Jev (57 28:00–30:00); Ben's weak dictation client cannot hold a 5 GB model (32 08:00). The “local” requirement includes memory, startup, input length, calibration, abstention and no hidden cloud fallback, not merely weight availability.

### C4 — Classifier cascades have a coverage bill and a labeling problem

**I — Anchor count: 3 speakers / 3 channels**, but the rare-event production pain has **one named independent operator: Sentry**.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [C04, 05:00–10:00][c04] | Greg, Sentry | “Opus is slow ... expensive”; “issues that aren't actually malicious” | Cheap screening can pass too much benign traffic to an expensive reviewer. |
| [C04, 11:00–18:00][c04] | Greg | “traditional ML is a reverse of good developer experience”; “cases we don't know” | Data collection, edge-case labels and unknown attacks dominate the transition to specialists. |
| [16, 47:00–49:00][v16] | Theo | “over 0.1 ... another thing look at it” | A useful cascade requires a measured escalation boundary. |
| [58, 09:00–12:00][v58] | CJ | “entire turn router” | Replacing a routing prompt is already a proposed integration, not a new classifier business. |

**Q:** Sentry already runs an LLM/decision-model pipeline, is experimenting with encoders, and bears GCP L4 hosting work. A roughly 4M-parameter distilled student with sub-millisecond synchronous service is explicitly hypothetical (C04 12:00–18:00). Captioned $12K, $700/day and “seven bucks” do not share a trustworthy denominator. Do not derive a unit price from them.

**E:** at one billion events/day, prevalence `10^-6`, recall `0.99` and benign false-positive rate `0.001`, escalations are approximately **1,000,989/day**. These are invented illustrative inputs. The cheap screen can be economically swamped by benign escalation. With zero observed benign errors, the approximate 95% upper bound `3/n` needs roughly three million representative independent examples to support a `10^-6` bound. A balanced toy dataset cannot certify that rate.

### C5 — Open weights are neither free serving nor endpoint equivalence

**I — Anchor count: 4 speakers / 4 channels.** Different constraints converge: quality, protocol, licensing and hardware access.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [13, 17:00, 48:00–50:00][v13] | Dax, OpenCode | “Australian data center”; “doesn't really serve the model correctly” | Region/configuration failures masquerade as agent or model incompetence. |
| [12, 15:00–16:00][v12] | Michelle | “open weight doesn't mean it's open to serve” | Keep the actual license and deployment conditions attached to the artifact; no legal eligibility conclusion is inferred here. |
| [36, 19:00][v36] | Quinn Slack | “Every BYOK API endpoint is different” | A compatible-looking API is not behavioral compatibility. |
| [24, 54:00][v24] | Lattner | “quality problems that then users can feel in your product” | Cross-backend implementation differences reach users. |

**Additional Q:** Dax predicts eventual open-model volume dominance while acknowledging frontier utility, concentrated compute and supplier survival risks (13 28:00–36:00, 51:00–55:00). Michelle recalls technically runnable models that were uneconomic at market prices (12 13:00–14:00). Armin says unsubsidized open models can be too expensive relative to a subscription (82 32:00–33:00). Ben needed a long multi-model quantization effort to run a large model on four Sparks, and explicitly distinguishes usefulness from economy (14 1:18:00; 16 2:07:00–2:08:00).

### C6 — Cache economics constrain routing, compaction and architecture

**I — Anchor count: 5 speakers / 4 channels.** API prompt caching, server KV memory, recurrent checkpoints and application data caches are distinct resources.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [15, 13:00–16:00, 57:00][v15] | Theo | “fail to use cache when it compacts”; “50 to 60% of my cost is in cache reads” | Transition regressions can dominate a long session. |
| [80, 1:13:00–1:15:00][v80] | Armin | “KV cache ... locks you heavily into ... an ecosystem” | Switching also has a state/continuity cost, not just a cheaper price. |
| [64, 06:00–08:00][v64] | Lu Zhang | “feedback loop sometimes creates bad oscillations” | Moving traffic away and back can damage locality and stability. |
| [65, 18:00–19:00, 37:00][v65] | Walden, Cognition | “continually has a running context”; “storage in S3” | Persistent sidekicks and longer-lived cache tiers are already being explored. |
| [33, 55:00–57:00][v33] | Bryce, Baseten | “checkpointing frequency”; “all of the active requests” | Prefix reuse requires correctly positioned recurrent state and live-state capacity. |

**Q — Boundaries and corrections:** OpenRouter cannot inspect provider KV internals (65 25:00); varying models can repeatedly destroy cache (16 53:00); textual history pruning can break caching and remove tool evidence (30 06:00–07:00; 16 52:00–55:00). Theo withdraws his cache-fanout explanation in 15 1:53:00. Do not repeat that proposed cause. A provider's advertised TTL is also not an experimentally established cache lifetime on every access route.

### C7 — Trillion-parameter serving is a workload/topology problem

**I — Anchor count: 5 speakers / 3 channels**, with Ali, Bryce and host Philip representing one Baseten program.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [33, 02:00–03:00][v33] | Ali / Bryce, Baseten | “one of your GPUs is going to straggle behind”; “traffic under prod load” | Training balance does not establish MoE serving balance. |
| [33, 06:00–08:00, 43:00–54:00][v33] | Bryce | “two active requests”; “isn't going to fit in a single node of B200” | Weights, replicated/sharded KV, graphs, recurrent state and context constrain concurrency together. |
| [44, 01:00–04:00][v44] | Chris Vela, Runpod | “the knobs to ... touch”; “centralizes everything” | BenchPod already addresses configuration experiments and cold restart friction. |
| [12, 36:00–37:00][v12] | Michelle | “16 GPUs to run it”; “I think we've optimized it” | Large minimum replicas matter; the RPS anecdote is historical and explicitly corrected. |
| [33, 1:00:00–1:01:00][v33] | Bryce / Philip | “4,000 or 8,000 tokens”; “code ... literature” | Speculation needs domain/length coverage and measured net speedup. |

**Q:** disaggregated prefill/decode ratios vary with traffic and agent context shape (33 59:00–1:00:00). A fixed MLA/KDA split can strand usable memory; recurrent state is fixed per checkpoint, not free per request. Only active experts participate in one token's MoE computation, but broad batches can need every expert resident. A runnable day-zero engine, a model fitting in memory and an economical service are three different milestones.

### C8 — Multi-silicon needs semantics and usable tooling

**I — Anchor count: 4 speakers / 2 channels**, from the Pragmatic Engineer interview and Modular panel. These are vendor/practitioner claims, not independently reproduced chip comparisons.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [24, 54:00][v24] | Lattner | “writing the same models three times over and over again” | Maintenance and parity work grow with backends. |
| [26, 07:00][v26] | Rashid, Qualcomm | “tooling that will work across a broader diversity of hardware” | NPU users need more than GPU-oriented dashboards. |
| [26, 11:00–12:00][v26] | d-Matrix panelist | “tensor ... allocated in a unified memory”; “None of the frameworks do that” | A specific distributed-memory requirement needs an executable example; the universal claim is unverified. |
| [26, 38:00–41:00][v26] | AWS panelist | “extremely expensive and extremely hard to get compute”; “reduce the number of tokens” | Scarcity and reasoning verbosity matter even after model usefulness is established. |

**Q:** model architecture changes faster than hardware lead times; keep flexibility in software (26 12:00–20:00). Lattner expects stranger hardware, six-vendor support is claimed in the later talk, and Snapdragon/native Windows are named expansion work (25 03:00–08:00). The broad kernel-to-cloud stack belongs to Modular/Qualcomm and other hardware vendors.

### C9 — GPU “utilization” is not useful-work accounting

**I — Anchor count: 4 speakers / 2 channels**: Utekar, Gupta and Jelveh at CNCF; Rashid at Modular. Only Jelveh directly reports metric breakage on operator upgrades.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [76, 04:00–10:00][v76] | Oshi Gupta / Sagar Utekar | “Long context queries starve short prompts”; “per request traces can't see the batch dynamics” | Request-local traces miss changing co-batches and shared scheduling. |
| [76, 12:00–14:00][v76] | Utekar | “97% can still mostly idle”; “host CPU is busy” | Active time is not useful compute intensity; CPU can starve a healthy GPU. |
| [77, 07:00–10:00][v77] | Reza Jelveh, HAMi | “reserved ... not the same as consume memory”; “stuff breaks” | Allocation, actual use, driver versions and semantics need separate evidence. |
| [77, 12:00–16:00][v77] | Jelveh | “metrics do not exist in all ... modes”; “reports unknown” | Missing support cannot be relabeled zero. DRA/plugin parity and version mapping are active work. |
| [26, 07:00][v26] | Rashid | “broader diversity of hardware” | Cross-vendor tools face real demand, but support needs actual devices. |

**Q:** Utekar/Gupta already built a disturbance generator and dashboard; their remedies trade TTFT, streaming latency, fairness, CPU packing and answer completeness (76 15:00–22:00). HAMi already normalizes and joins workload identities, is standardizing metrics, and asks for AMD/Intel support (77 10:00–19:00). Do not propose another generic GPU dashboard.

### C10 — Small-message tails can waste expensive GPU time

**I — Anchor count: 3 speakers / 2 channels**: Ousterhout at AI Engineer, d-Matrix and Lattner at Modular. This is genuine cross-organization convergence on communication overhead, not independent reproduction of one transport's speedup.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [67, 03:00–05:00][v67] | John Ousterhout | “whole process stalls”; “significant fraction of your GPU's resources” | Small RPC/barrier tails can idle large synchronized jobs. |
| [67, 06:00–10:00][v67] | Ousterhout | “short message gets stuck behind the long ones”; “constantly oscillating” | Mixed-size incast and delayed control deserve workload-specific tests. |
| [26, 32:00][v26] | d-Matrix panelist | “six microsconds are too much”; “1.5 instead of six” | Jetstream is an existing response for attention/expert disaggregation, with vendor-reported figures. |
| [26, 26:00][v26] | Lattner | “bottlenecked on the host”; “asynchrony” | Host mediation is another communication boundary. |

**Q:** Homa and its Linux module already exist; Ousterhout seeks adopters, asking whether short-message latency actually limits their throughput (67 11:00–18:00). A reported 13× short-RPC P99 gain is not a 13× application speedup. Neither Homa nor the d-Matrix interconnect claim is a prescription for internet-wide Workers traffic.

### C11 — Post-training, trust and the model/harness joint release

**I — Anchor count: 5 speakers / 3 channels**: Theo/Ben on Nerd Snipe, Jiang/Lesse on Latent Space and Fuad Ali at AI Engineer. Theo/Ben's repeated model opinions remain one conversational community.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [14, 09:00–11:00][v14] | Theo | “hallucinated tables and columns”; “Every PR ... close” | Claimed intelligence can coexist with unusable behavior on his actual repos. His architecture-audit counts are a small self-reported sample. |
| [16, 25:00–29:00, 1:07:00–1:22:00][v16] | Ben / Theo | “two to 2.5x more tokens”; “started merging the code” | Grok request pricing and Opus release impressions need whole-task and delayed integration checks. |
| [50, 31:00–40:00][v50] | Angela Jiang / Katelyn Lesse | “negative”; “put it back in the oven”; “not quite there” | External harness feedback can change a candidate model; personalization/proactivity remain difficult. |
| [45, 08:00–09:00][v45] | Fuad Ali, Arize | “announce a step in one turn”; “every single model” | A turn-ending heuristic can fail across models; explicit completion is already Arize's remedy. |

**Q:** retained thinking, compaction and safeguards introduce model-specific integration changes (50 08:00–13:00, 40:00–41:00). Harvey's case retrieval and training failed to reproduce familiar-case reasoning; Gabe suspects missing surrounding analysis (34 18:00–20:00). Baseten is exploring traces-to-model workflows, continual specialists and KV-to-LoRA (34 23:00–32:00). These are active post-training directions. The recordings do not prove a causal account of Gemini/Grok/Opus differences or that one model is universally trustworthy.

### C12 — Model churn, retirement and instructions that outlive their purpose

**I — Anchor count: 5 speakers / 5 channels**: Michelle, Theo, Geoff Huntley, Jediah Katz and Ben Davis. The GPU-residency/user-attachment problem itself has **one direct operator source**, Michelle.

| Source / time | Speaker | Q — signal | I — implication |
|---|---|---|---|
| [12, 27:00][v12] | Michelle | “people still get attached”; “eating up GPU space” | User preference obstructs freeing capacity, even when newer models exist. |
| [85, 16:00][v85] | Theo, reading a claim and disputing its economic conclusion | “Old models get retired” | Historical cost/quality comparisons lose a live control. |
| [80, 40:00][v80] | Geoff Huntley | “skills ... deleted after every model release” | This is a proposed discipline to test, not a mandate to delete useful instructions. |
| [66, 16:00][v66] | Jediah Katz | “whenever a shim stops firing ... a PR” | Centralized shim telemetry and deletion proposals already exist internally. |
| [29, 02:00–07:00][v29] | Ben Davis | “split between the models”; “don't actually know ... costs” | Variant identity, access route and allowance can confound release evaluation. |

**Additional Q:** unscheduled drops strain Amp ownership (35 10:00); Factory revisits its harness monthly (72 08:00–09:00); Anthropic removed 80% of a system prompt (70 06:00); VSCO keeps business checks stable while changing models/prompts/actions (C08 08:00–12:00). Theo reports crash recovery lowering effort to medium (88 42:00). Model retirement, shim retirement and app-feature retirement are different transitions; P01, P12 and P13 keep them separate.

## 3. Deep prior-art audit: occupied ground and narrow residuals

**I — Status convention:** **Shipped** means public code or documented availability, not independently tested effectiveness. **Being built** means named ongoing implementation/research. **Roadmap** reserves explicitly claimed work. **Open, conditional** means a particular residual was not located in this bounded search; operator-internal tools may already cover it. Every status is scoped to 2026-10-28.

### A1 — Cost, subscriptions and outcomes: Shipped; historical replay is a small extension

**F:** [ccusage](https://github.com/ccusage/ccusage) already reads many coding-agent formats with separate cache categories. Its [Codex accounting documentation](https://github.com/ccusage/ccusage/blob/main/docs/guide/codex/index.md) explicitly distinguishes API-equivalent estimates, recorded speed tiers, fallbacks and missing usage. [token-burn](https://github.com/durandom/token-burn) already monitors quotas, windows, forecasts and multiple providers. [Langfuse's cost workflow](https://langfuse.com/academy/experiments/cost-optimization) joins traces, representative experiments and a quality floor. These kill a generic monitor, calculator or “cost plus evals” pitch.

**F:** direct npm metadata returned `ccusage` **20.0.45**, published **2026-10-26**, and `promptfoo` **0.125.1**, published **2026-10-25**. [ccusage registry](https://registry.npmjs.org/ccusage), [promptfoo registry](https://registry.npmjs.org/promptfoo). Package publication does not establish all scenario-replay features.

**I — Residual:** replay real temporal demand against explicit allowance/overflow policies and project stopping boundaries; distinguish cash, allocation and list-price exposure. This is P04, likely an upstream mode. Explicit human scope/intervention accounting is P16, primarily a study. Existing spend limits, AI Gateway and Uber's internal coaching remain taken.

### A2 — Routing: Shipped / Being built; the ledger's apparent gap shrinks materially

**F:** [TwinRouterBench](https://arxiv.org/abs/2605.18859), submitted May 14 and revised October 24, provides intermediate agent prefixes and a live SWE-bench track measured by task resolution and actual API spend. [LLMRouterBench](https://arxiv.org/abs/2601.07206) supplies a broad routing framework/benchmark. [llm-router-bench](https://github.com/Arakiss/llm-router-bench) includes a fixed expensive-model baseline and carefully labels its September simulation as projections without measured answer quality. [Gin's RouteBench](https://trygin.ai/routebench/) publishes its own app-task results; that is a vendor benchmark, not neutral proof that routing wins everywhere.

**I — Closest residual:** P05 adds paired environments to the same user request, including tool availability and cache-switch costs. Step-level agent routing itself is no longer an open benchmark proposal. Cognition Fusion, OpenRouter, vLLM Semantic Router and Runway's media router already own product ground. A useful contribution must demonstrate an uncovered environmental intervention, not repeat a prompt-only cost table.

### A3 — Offline classifiers: Shipped, including closer 2026 implementations than E02 found

**F:** [GLiClass Edge v3](https://huggingface.co/knowledgator/gliclass-edge-v3.0) lists 32.7M parameters and approximately 131 MB. [GLiClass.js](https://github.com/Knowledgator/GLiClass.js) already supplies ONNX-backed browser/JavaScript execution. [Verdict/OpenJev](https://huggingface.co/heman10x/rlcd-modernbert-151m) releases a 151M decision model with an explicit abstention slot and 25-slot limit. [FluidInference's Core ML conversion](https://huggingface.co/FluidInference/verdict-coreml) targets iOS/macOS with fixed input buckets and documents calibration/renderer requirements. Its published checks are Mac smoke/parity tests, not broad iPhone/Executor validation.

**F:** npm registry checks found `@huggingface/transformers` **4.3.2** on **October 27** and `onnxruntime-web` **1.31.1** on **October 26**. These are runtime availability evidence, not a claim that any arbitrary checkpoint loads unchanged. [Transformers registry](https://registry.npmjs.org/@huggingface%2ftransformers), [ONNX registry](https://registry.npmjs.org/onnxruntime-web)

**I — Residual:** P02 is a task/device parity and calibration corpus, not “build local Jev.” Existing native conversion substantially lowers its novelty score. Do not pass a 10,000-tool catalogue as 10,000 simultaneous labels, and do not compare unlike prompt lengths or silently truncate a request into a smaller export bucket.

### A4 — Decision APIs and distillation: Shipped / Being built / Roadmap

**F:** TypeSafe's [September 15 launch](https://typesafe.ai/blog/introducing-system-one-models-and-jev) already claims the typed-decision primitive and RLCD. Its [October 14 update](https://typesafe.ai/blog/jev-1-14) exposes experimental images and longer context and describes forthcoming alias/deprecation changes. The transcript's “no vision yet” is therefore date-sensitive. [Cloudflare's October 1 Clef release](https://developers.cloudflare.com/changelog/post/2026-10-01-clef-workers-ai/) ships Apache-licensed 27B/9B decision models and announces an RL tuning service seeking design partners. Open weights do not make those sizes phone-sized.

**F:** [PINT](https://github.com/CheckPointSW/pint-benchmark), [buried-injections](https://github.com/rudratoshs/buried-injections) and [SetFit distillation](https://huggingface.co/docs/setfit/how_to/knowledge_distillation) already cover detection evaluation, fixed false-alarm evaluation or teacher/student training. Sentry's own specialist effort is **Being built (Q)**. The distil-labs workflow page did not load in this pass; its ledger description is not upgraded to newly verified availability.

**I — Residual:** P11 audits excluded traffic and escalation economics. No general classifier platform, prompt-injection detector or distillation loop survives as an unoccupied project. Schema-valid output and a probability field do not establish correct or calibrated decisions.

### A5 — Provider conformance: Shipped; contribute exact failures

**F:** [Vals Inference Provider Index](https://www.vals-ai.com/benchmarks/inference_provider), updated October 20, compares the same open models on multi-step tasks across providers. [Moonshot's Kimi Vendor Verifier](https://github.com/MoonshotAI/Kimi-Vendor-Verifier) includes parameter, streaming/schema, feature and prompt-token checks alongside workload benchmarks. This is direct prior art for provider quality and API conformance, beyond a simple uptime checker.

**I — Residual:** region/cache/client reproductions and P13's resumed-settings evidence belong in those suites or their harness adapters. Dax's account establishes why the work matters, not that nobody supplies it. Do not infer malicious provider behavior or weight identity solely from a low task score.

### A6 — Prompt-cache continuity and load routing: Shipped / Being built

**F:** [claude-code-cache-fix](https://github.com/cnighswonger/claude-code-cache-fix), created April 6 with public updates through September 5, already targets resumed-session cache regressions. [BLIS](https://arxiv.org/abs/2610.14255) models routing, batching, cache management and preemption; [llm-d's sticky-until-saturated policy](https://llm-d.ai/blog/sticky-until-saturated-token-aware-routing) addresses cache affinity versus overload. NVIDIA Dynamo is direct prior art for longer-lived KV tiers. These kill a new generic cache proxy or routing simulator.

**I — Residual:** P06 is a cross-transition fixture contribution binding cost to retained behavior, including SDK upgrades, compaction and resume. A replay that merely reprices a previously cached call cannot prove the new transition really hits cache. A hosted API may not expose enough state to attribute a miss beyond its usage counters.

### A7 — Serving configuration and hybrid state: Shipped, with direct validation research

**F:** [vLLM autotuning](https://github.com/vllm-project/vllm/blob/main/benchmarks/auto_tune/README.md) sweeps concurrency and batched tokens under latency constraints. [AIConfigurator](https://github.com/ai-dynamo/aiconfigurator) models parallelism and aggregated/disaggregated deployments and generates configurations for vLLM, SGLang and TensorRT-LLM. Its public repository was updated October 20; some supported systems are explicitly estimate-only. Runpod's BenchPod is an existing implementation **Q**, rather than a missing feature inferred from its talk.

**F:** [vLLM's hybrid cache design](https://github.com/vllm-project/vllm/blob/main/docs/design/hybrid_kv_cache_manager.md) and [SGLang Unified Memory](https://www.sglang.io/blog/unified-memory) already address mixed cache allocation. More directly, the [September 14 hybrid-state recovery study](https://arxiv.org/abs/2609.15030) demonstrates a checkpoint/prefix-alignment repair in vLLM/LMCache and carefully bounds its serial, one-model evidence. This weakens E06 P01 as a standalone “independent hybrid cache check” idea.

**I — Residual:** P07 covers concurrent cancellation, eviction and live-state retention only if absent from current engine tests. P14 records a tested hardware-fit/quantization recipe, not an optimizer. Writing a new autotuner is killed by this deeper search.

### A8 — Speculative decoding: Being built; even the “cliff” premise needs testing

**F:** [SPEED-Bench](https://arxiv.org/abs/2604.09557) and [Speculative Decoding: Performance or Illusion?](https://arxiv.org/abs/2601.11580) examine diverse workloads and production-engine speedups. A [new October 22 positional study](https://arxiv.org/abs/2610.30644) reports no decay with output position for its independent draft/target configurations after separating a repetition pathology. Its supported lengths and small model family do not establish behavior for Kimi K3 or every trained drafter.

**I — Residual:** P08 must report whether a cliff exists, with input length and output position separated, and measure draft/verification overhead and net latency/throughput. It must not assume “longer always collapses” or promote acceptance rate to a speedup guarantee. This is a benchmark contribution, not a new speculative decoder.

### A9 — Multi-silicon: Shipped / Roadmap, with an obvious platform owner

**F:** Modular's [August 18 Qualcomm integration account](https://www.modular.com/blog/modcon-qualcomm) documents its unified stack, a four-chip serving path and remaining communication/bring-up work. [ModCon announcements](https://www.modular.com/blog/modcon-announcements) reserve the broad platform. [PyTorch DTensor](https://docs.pytorch.org/docs/stable/distributed.tensor.html) already provides explicit sharding/placement primitives, so the panel's “none of the frameworks” cannot stand as a verified universal claim.

**I — Residual:** P10 contributes product/numerical parity cases or one concrete placement counterexample. A new portable compiler, tensor system or kernel-writing agent duplicates named owners. Matching a few outputs within tolerance does not prove quality parity for every workload, and exact token identity is often the wrong oracle.

### A10 — GPU observability: Being built; semantic fixtures are the bounded contribution

**F:** [HAMi's per-Pod utilization design](https://project-hami.io/docs/developers/gpu-utilization-metrics) documents both a test plan and a non-NVIDIA non-goal for that design. [Dynamic MIG](https://project-hami.io/docs/developers/dynamic-mig) covers identity/metric compatibility work. [OpenTelemetry GPU conventions](https://opentelemetry.io/docs/specs/semconv/hardware/gpu/) already name metrics and units, but their status is Development. [vLLM per-request metrics](https://github.com/vllm-project/vllm/blob/main/docs/features/per_request_metrics.md) already expose request timing.

**F:** a [June 2026 vLLM-Ascend report](https://github.com/vllm-project/vllm-ascend/issues/10245) describes dummy-batch/connector state corruption, while a [September mixed-prefill report](https://github.com/vllm-project/vllm/issues/54919) describes streaming stalls without HTTP failure. These are public operator reports, not independently reproduced defects or evidence that all current versions remain affected.

**I — Residual:** P03 checks that meaning, workload identity and unknown states survive an upgrade; generic normalization is already being built. Per-batch causal interference remains uncertain, so P03 avoids promising causal attribution from correlated metrics alone.

### A11 — Networking: Homa Shipped; adoption and measurement still have work

**F:** [HomaModule](https://github.com/PlatformLab/HomaModule) supplies a Linux implementation, mixed-workload comparison tools and metrics. Its changelog records January 2026 TCP/Homa coexistence work and a September grant-protocol change. The [protocol documentation](https://github.com/PlatformLab/HomaModule/blob/main/protocol.md) describes recovery and application-visible RPC semantics. Pin the actual revision: a static old protocol explanation may differ from a later implementation.

**F/Q:** the [October HN discussion](https://news.ycombinator.com/item?id=49957117) includes Ousterhout correcting loss-recovery claims and debating comparable benchmarks. Treat technical conclusions as requiring implementation/paper evidence; the thread is useful evidence that deployment assumptions and benchmark denominators are disputed.

**I — Residual:** P09 attributes application coordination waits before choosing transport. Compare tuned TCP and suitable alternatives with matched encryption, CPU, offered load and hardware conditions. A tiny Linux/network contribution may be achievable; a portable cross-stack GPU/RPC causal profiler is the larger, uncertain version.

### A12 — Trust, churn and retirement: broad migration and evaluation are Shipped

**F:** [ModelShift](https://github.com/Arthur031221/ModelShift) scans retiring IDs and replays prompts, including user assertions. [Driftline](https://github.com/AI-Driftline/driftline) similarly scans and checks replacements. [EvalShift](https://github.com/evalshift/evalshift-cli) compares tool names, arguments/order and owner-written invariants; its documented all-round mode is teacher-forced replay, not unrestricted re-execution of the new agent's divergent future. [Promptfoo assertions](https://www.promptfoo.dev/docs/configuration/expected-outputs/) already support deterministic and custom checks. A broad retirement calendar, migration PR bot or model-regression runner is taken.

**F:** Cloudflare's [May 8 deprecation notice](https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/) explicitly makes room in the catalog and includes an automatic alias to a higher-priced replacement. The [September 25 retirement study](https://arxiv.org/abs/2609.31288) reports that most matched open-source migrations occurred after shutdown; it is observational and its dataset-release wording remains prospective. It is not a measured result from this report.

**I — Residual:** P01 connects acceptable user migration to **actually reclaimable GPU residency and displaced new-model admission**. That operator-side decision differs from swapping a model ID. P12 adds evidence that an inactive shim was exercised before retirement, building on Katz's already-built bot and [Alibaba skill-up](https://github.com/alibaba/skill-up). Product-specific taste/behavior checks are fixtures for existing evaluators, not a new universal trust score.

### A13 — Representation efficiency: Shipped; isolate token counts from semantics and latency

**Q — Additional C2/C6 signal, one speaker / one channel:** Jacky Koh says Google Docs MCP costs about 21× as many tokens as MDX, form formats at least 9×, and leaner inputs improve small-model outcomes ([C03, 08:00–10:00][c03]). His annual $1,200 extrapolation is a workload scenario, not a universal saving.

**F:** Arg's [August 17 format study](https://arg.ai/research/file-benchmark-document-formats-part-1-token-efficiency) and [benchmark page](https://arg.ai/benchmark) already compare representations, expressive capabilities and adjustable input-cost assumptions. Their rich-document example reports 647 versus 13,464 tokens with `o200k_base`; that is specimen-specific. The article explicitly warns that its latency illustration uses output throughput rather than measured input processing. Google's [October 5 native Markdown announcement](https://workspaceupdates.googleblog.com/2026/10/preview-edit-and-collaborate-on-Markdown-files-natively-across-Drive-and-Docs.html) further closes the generic Markdown-collaboration pitch.

**I — Residual:** a real application's uncovered read/edit task may supply a P16 fixture, holding required footnotes, references, comments and edit semantics constant. A generic format benchmark, converter or cheaper document workspace is already occupied. Token savings do not imply the same ratio of end-to-end task savings, and stripping needed semantics is not a valid improvement.

### Search record and coverage boundaries

**F:** discovery queries included `2026 inference model retirement GPU legacy models migration`, `2026 LLM routing environment benchmark agent cost success`, `GLiClass ONNX mobile`, `model deprecation replay 2026`, `vLLM configuration autotuner`, `hybrid cache checkpoint tests`, `speculative decoding long context acceptance`, `GPU operator metrics semantic`, `Homa coordination GPU idle`, `Modular Qualcomm 2026`, and provider/cost-cache equivalents. Follow-ups named each close competitor and inspected its actual claimed scope rather than relying on directories.

**F:** GitHub repository metadata and npm registry JSON were read directly without installation. Additional useful 2026 HN discovery included [a proxy-accounting discussion](https://news.ycombinator.com/item?id=50145507), [a router builder's announcement](https://news.ycombinator.com/item?id=48688700), and [local serving configuration discussion](https://news.ycombinator.com/item?id=47863217). They expose accounting confusion, claimed router savings and workload-specific tuning; they are not independent certifications of pricing or speed.

**I:** X-targeted searches covered classifier releases, retirement/EvalShift, Homa, hybrid caches, HAMi and Modular/Qualcomm. They did not produce a consistently inspectable primary stream. A mirrored EvalShift account led to its primary repository, which was checked; the mirror was not used to establish shipment. No gap depends on social-search silence. Per-cluster primary evidence above carries the technical conclusions. Unreadable pages and proposed architectures were not counted as deployed implementations.

## 4. Additional signals retained and boundaries

**I:** these are retained evidence, including small or awkward directions, rather than extra claims of market whitespace. Predictions are expanded in §6. “Taken” means the broad mechanism is occupied; a useful reproduction, data contribution or adapter can still be worthwhile.

| Ledger / video family | Q/F — additional signal, with source | I — disposition |
|---|---|---|
| E01 / 01, 03–05, 08 | Theo's goal can spend hundreds without useful progress (01 00:00, 17:00–20:00). dbt says better models alone do not establish analytical trust (03 06:00). Michael wants model/harness independence and expects smaller models and fewer capability skills (04 01:00, 40:00–46:00). Mario perceives a plateau (05 57:00–59:00). Jane Street's speakers disagree about hallucinations in copying versus explanations (08 52:00, 1:24:00). | P04/P12/P16; task-specific acceptance fixtures, not a universal model-confidence number. Preserve plateau versus rapid-progress disagreement. |
| E02 / 09–13 | Steve cannot see net rather than gross lab revenue and doubts classifier moats (09 53:00, 1:21:00). Scott predicts a commodity/frontier split (10 11:00). Ree wants image classification for a robotaxi camera census (11 22:00); Michelle describes custom-weight admission and a throughput tier (12 03:00, 18:00). Dax needs smaller inference vendors to survive (13 32:00, 51:00). | Financial uncertainty is not proof of insolvency. Camera census is a concrete optional P02 dataset once a suitable local vision model is chosen; text checkpoint reuse would be invalid. Catalog admission, archival access and provider-exit drills fit P01/P04/P15. |
| E03 / 14–16 | Four-Spark quantization required substantial work (14 1:18:00). Skill dependencies can consume expensive model buckets (15 46:00–47:00); Dots' launch allowance may tighten (15 1:19:00); background work trades latency against cost (15 1:26:00). Intermediate model tiers may lose their niche (16 09:00–13:00). | P04/P12/P14; do not infer API savings from a cheaper nominal model or a promotional access window. Multimodal decision requests require a capability contract, now partly addressed by A4. |
| E04 / 17–19 | Uber has a gateway, usage tiers, session summaries and cost coaching; routing is an intended gateway use (19 24:00–29:00). Review models need risk context (19 58:00). WorkOS advertises policy/model escalation (17 36:00). | Generic gateway, coaching, risk router and authorization are taken. Contribute workload fixtures rather than a new platform. |
| E05 / 20–23 | Newman doubts current guardrail approaches as a long-run answer (20 1:37:00). Dima's cloud preference avoids local contention (21 24:00). Linear advertises routing/spend controls (22 39:00–40:00). | No concrete new model architecture follows. P14 can measure local contention; existing cloud agents and controls remain taken. |
| E06 / 24–33 | Architecture changes outpace hardware planning; investors forecast both thousands of specialists and concentrated token volume (26 12:00–20:00; 28 15:00–30:00). A quoted 400M/day configuration-saving anecdote has no reproducible accounting (28 24:00). Model access in Davis's review varies across API, plan, effort and region (29). | P10/P13/P14/P16. No standalone investment thesis from the promotional saving or token-volume forecast. BenchPod, MAX, day-zero engines and generic autotuning already have owners. |
| E07 / 34–43 | Harvey wants firm expertise rather than confidential client data encoded in weights (34 13:00). Familiar legal cases outperform novel ones despite surface access to the case text (34 18:00–20:00). Amp reports quota-driven downgrade harm and subscription-reset experimentation (35 13:00; 38 02:00–14:00). | Specialization is Being built. Keep surrounding-analysis data as a hypothesis, not a proven explanation; use domain-held-out acceptance examples in existing evaluators. P04/P16 include human repair and access effects. |
| E08 / 44–52 | Runpod and Arize explore routers (44 12:00; 45 14:00). Arize solves turn-ending ambiguity explicitly (45 08:00–09:00). Anthropic removed much of old prompt scaffolding, while retaining some examples/constraints (50); Exo expects expensive frontier models and architectures made obsolete by upgrades (52 03:00, 10:00). Amp wants cheaper sandboxes (51 26:00–27:00). | P12/P16, plus a model-specific stop-semantics fixture for existing evaluators. No generic router, harness optimizer or cheap sandbox is revived. |
| E09 / 53–62 | Adam reports prospective decision-API competition without verification (55 08:00–09:00). GPUI testing and file automation already use classification (57 24:00–30:00). CJ's authorship/copyright classifier demo does not prove authorship or infringement (58 07:00–08:00). Karpathy's model/tool zoo and reasoning-latency account are historical (62). | P02/P11 accept domain-specific calibration/false-positive cases; avoid a detector product based on semantic labels. Historical capability claims must retain observation dates. |
| E10 / 63–78 | Cognition trains orchestrator/executor collaboration and wants user-override learning (65 19:00, 41:00–42:00). NVIDIA proposes privacy-aware hybrid execution and concurrency on idle local compute (65 30:00–31:00, 43:00). Katz and Factory repeatedly remove model scaffolding (66 03:00–06:00; 72 08:00–09:00). Cherny distinguishes capable from economical enough (71 12:00). Fleet failure probability compounds with machine count (78 05:00). | P05/P12/P14/P18. Collaboration learning, hybrid routing and fleet operations already have owners. A tiny held-out collaboration-role fixture is a valid contribution, but not an additional generic agent optimizer. |
| E11 / 79–88 | Armin persists customizations as code and sees edit-tool use displaced by generated programs (80 50:00, 59:00–1:00:00). Reserved capacity creates pre-winner lock-in (80 1:14:00–1:15:00). Paid demand reportedly collapsed after an open-model launch (82 29:00). Recursive reviewers can multiply spend; diverse training may find different defects (86 06:00, 10:00–11:00). Git workload grows when bottlenecks disappear (87 04:00–05:00). Effort can reset during restart (88 42:00). | P04/P12/P13/P16/P17. Code persistence is not a revival of agent JIT. Diverse review yield must subtract false findings and duplicated review effort. New checkout/hosting infrastructure stays killed. |
| Connect 01 / C01, C02, C08 | “75 times cheaper” is a benchmark-based token-price comparison (C02 04:00–05:00). VSCO keeps its mutation-verification checks stable while changing models and plans Clef routing; it summarizes large context without an exact saving (C08 08:00–18:00). Clairic is a named extraction model and open-weight roadmap. | P01/P05/P16; no cost proof from a family name or summary strategy. Extraction and cheap decision routing are taken. |
| Connect 02 / C03, C05, C13 | Jacky claims Google Docs MCP uses about 21× MDX tokens, form representations differ by at least 9×, and lean formats improve small-model outcomes (C03 08:00–10:00). Basin/Git infrastructure economics are mostly execution/data concerns; three engineers used extensive inference on Git infrastructure, and duplicated local/remote CI is questioned (C13 16:00–18:00). | Serialization belongs in P16 scope/quality accounting and A13 below; no generic converter or new inference serving project follows. |
| Connect 03 / C09, C11 | Isolates are claimed 100× more efficient without a matched workload (C09 11:00–12:00). DO-to-Workers AI latency is expressly untested (C09 25:00–26:00). Tiny tasks can fit tiny models, but turn limits remain important (C11 05:00–07:00). | No measured edge/GPU-colocation win. P04/P05 can include bounded workloads; do not multiply unrelated 100× claims. |
| Connect 04 / C04, C10 | Sentry already has its cascade and seeks billion-event coverage, with spam/other tasks to amortize training/hosting (C04 07:00–18:00). Ramp's cold-path parsing/data caches concern application execution, not model KV. | P11; keep cost denominators and cache types distinct. |
| Connect 05 / C06, C07, C12 | Runway says improved frontier planners improve its media agent and lower production cost creates new demand (C07 04:00, 06:00, 09:00); generated interactive interfaces are active development (15:00). TELUS learned AI metering from repeated OCR and says AI dominates hosting (C12 08:00, 27:00). | P04/P16/P17; media routing, generated interfaces and enterprise agent catalogs are occupied. |

## 5. Projects, including small and uncertain contributions

**E — Scoring order throughout:** cool / Cloudflare–Vercel–TypeScript adjacency / real gap / value / survives better models / not GrowOS. Scores are subjective 1–5, higher is better; they are not measured demand. Effort assumes access to the stated device/operator and excludes that access delay. Ranking weighs evidence, owner fit and feasibility, rather than mechanically sorting sums. Every demo below describes a proposed demonstration, not software built for this research.

### P01 — Operator-side model-retirement rehearsal

**I — Big, weeks; Open, conditional.** Show which acceptable user migrations would actually free enough resident GPU capacity to admit a new model.

- **Q — Sources:** Michelle: “people still get attached to it” and “it just sits there eating up GPU space” ([12, 27:00–28:00][v12]); Theo: “it wouldn't make sense for them to keep hosting” ([85, 16:00][v85]).
- **30-second demo:** load an anonymized demand/capacity snapshot; retiring model A moves most traffic but frees zero GPUs because one protected tenant keeps its minimum replica resident. An approved replacement plus a dated fallback changes the answer to a concrete number of reclaimable GPUs and a newly feasible admission. Unsupported capacity assumptions remain visible.
- **Closest:** [ModelShift](https://github.com/Arthur031221/ModelShift), [EvalShift](https://github.com/evalshift/evalshift-cli) and [AIConfigurator](https://github.com/ai-dynamo/aiconfigurator). They cover migration behavior or serving plans; the residual joins user acceptance, minimum residency, shared replicas, fallback demand and admission opportunity cost.
- **Beneficiaries / owner:** smaller multi-model hosts and platform engineers. Cloudflare can simply build this internally and has better fleet data. An outsider earns a place only through an operator partnership and reusable input/schema examples; otherwise this is an internal/upstream tool.
- **Starting action:** obtain one operator's real deprecation decision and model its constraints in a small TS report before automating any migration.
- **Kill test:** stop if retirements are dominated by contracts or one-off decisions, existing fleet planning already answers the question, or the operator cannot share enough data to validate reclaimed capacity. No generic migration SaaS fallback.
- **E — Scores:** **4 / 4 / 3 / 4 / 5 / 5 = 25**.

### P02 — Offline typed-classifier parity and calibration corpus

**I — Small, weekend for a desktop slice; Tiny contributions for device fixtures; Open, conditional.** Publish reproducible decisions across JS/ONNX and native-device exports, including abstention, long inputs and tool-catalog retrieval.

- **Q — Sources:** Ree: “data needs to stay on the users's machine”; Sunil: “run ... on my phone” ([11, 15:00–16:00][v11]); Ben: “doesn't have the actual context” ([30, 08:00][v30]).
- **30-second demo:** disconnect networking; classify a private tool-search request in a browser and on a real device. Show latency/memory including tokenization and startup, candidate recall, calibrated coverage, abstentions and a long-input rejection rather than hidden truncation. Compare against the pinned model's native reference implementation.
- **Closest:** [GLiClass.js](https://github.com/Knowledgator/GLiClass.js), [Verdict](https://huggingface.co/heman10x/rlcd-modernbert-151m), [Core ML export](https://huggingface.co/FluidInference/verdict-coreml). Runtime, model and conversion are already supplied. The gap is real application/device evidence, not missing open weights.
- **Beneficiaries / owner:** Executor-like desktop tools and private mobile apps. Model/runtime owners should own numerical parity; contribute there. Cross-model user-owned acceptance cases may be maintained independently.
- **Starting action:** pin weights, renderer, calibration and input buckets; create 50 public synthetic intents with misleading labels, missing context and explicit unknowns; add private cases locally without uploading them.
- **Kill test:** stop the wrapper if existing packages already meet task/device budgets. Retain only genuinely new failing fixtures. A desktop success cannot establish a phone success.
- **E — Scores:** **4 / 5 / 2 / 4 / 4 / 5 = 24**.

### P03 — GPU telemetry upgrade semantic fixtures

**I — Tiny upstream contribution, several focused days; Being built by HAMi/OTel, residual conditional.** Verify that GPU metric units, denominators, workload identity and unavailable states keep their meaning across one supported upgrade.

- **Q — Sources:** Jelveh: “stuff breaks”; “reports unknown” ([77, 10:00–15:00][v77]); Utekar: “97% can still mostly idle” ([76, 13:00][v76]).
- **30-second demo:** run a pinned memory-reservation/compute workload before and after an operator upgrade. Show reserved bytes, measured usage, active-time denominator and Pod identity separately; an unsupported sharing mode yields `unknown`, and an intentionally changed metric mapping fails the fixture.
- **Closest:** [HAMi utilization design](https://project-hami.io/docs/developers/gpu-utilization-metrics), [dynamic MIG](https://project-hami.io/docs/developers/dynamic-mig), [OTel GPU conventions](https://opentelemetry.io/docs/specs/semconv/hardware/gpu/). They already own metrics and test plans. Add a missing executable version transition, not another dashboard.
- **Beneficiaries / owner:** cluster operators and observability maintainers. HAMi/GPU operator owners should do it; upstream contribution is the intended delivery.
- **Starting action:** ask maintainers which observed upgrade failure lacks a fixture; reproduce one supported NVIDIA/sharing-mode pair with a pinned metric manifest.
- **Kill test:** stop if current CI covers the transition or available hardware cannot establish the asserted meaning. Cross-vendor support is not promised from NVIDIA-only data.
- **E — Scores:** **4 / 3 / 3 / 4 / 5 / 5 = 24**.

### P04 — Subsidy-exit replay of temporal usage tails

**I — Small weekend extension; Open, conditional.** Replay a person's dated usage against explicit subscription/credit/overflow scenarios without mistaking list-price exposure for provider loss.

- **Q — Sources:** Michelle: “do subscriptions exist in six to 12 months?” ([12, 42:00–43:00][v12]); Armin: “I would not have paid $15,000” ([80, 1:24:00][v80]); Mario: “subsidies ... end” ([05, 59:00][v05]).
- **30-second demo:** import logs locally; compare subscription cash, retained-usage API equivalent and two allowance-change scenarios. Highlight when a burst exhausts a rolling window and which project would stop, rather than assuming infinite overflow purchasing or identical behavior after a model change.
- **Closest:** [ccusage](https://github.com/ccusage/ccusage), [token-burn](https://github.com/durandom/token-burn), [Langfuse](https://langfuse.com/academy/experiments/cost-optimization). Dashboards, forecasting and quality-linked costs are shipped; the extension is dated policy replay over demand tails.
- **Beneficiaries / owner:** heavy individual users and small teams. Providers can expose their own scenarios; a local cross-harness mode fits an existing OSS accounting tool.
- **Starting action:** add one ccusage JSON importer and owner-authored policy file with unknown/missing usage flags.
- **Kill test:** stop if current tools already replay the needed policy or the result is merely total tokens times a new rate. No claim of future quota access or subscription sustainability.
- **E — Scores:** **3 / 5 / 2 / 4 / 5 / 5 = 24**.

### P05 — Same request, different environment routing benchmark

**I — Tiny benchmark contribution; Open, conditional on an uncovered intervention.** Test whether a router selects a cheaper successful path when identical user wording meets different available tools, state and cache history.

- **Q — Sources:** Ben: “actual price ... is not the sticker price” ([30, 08:00–09:00][v30]); Theo: “$150 ... $146” ([16, 1:01:00][v16]); Alex: “small models may actually increase your cost” ([65, 14:00–15:00][v65]).
- **30-second demo:** “email this” succeeds cheaply with a configured connector, requires code with SMTP tooling, and needs browser interaction in another environment. Compare prompt-only and environment-aware selection with a constant strong baseline, full path cost and accepted outcome.
- **Closest:** [TwinRouterBench](https://arxiv.org/abs/2605.18859), [LLMRouterBench](https://arxiv.org/abs/2601.07206), [RouteBench](https://trygin.ai/routebench/). Step-level and application routing benchmarks already exist; add paired environmental interventions only if missing.
- **Beneficiaries / owner:** harness/router authors. Benchmark maintainers can add this directly; contribute fixtures and live-run protocol upstream.
- **Starting action:** inspect existing live tasks for the proposed paired conditions; construct five new public pairs only after confirming the gap.
- **Kill test:** stop if the existing environment track covers it, or any saving disappears against the constant strong baseline after errors, escalation, cache loss and latency are counted.
- **E — Scores:** **4 / 5 / 2 / 4 / 4 / 5 = 24**.

### P06 — Compaction/resume cache-continuity fixtures

**I — Tiny upstream contribution; Open, conditional.** Turn one costly SDK/session transition into a repeatable fixture that checks cache accounting and retained task evidence together.

- **Q — Sources:** Theo: “fail to use cache when it compacts”; “50 to 60% of my cost is in cache reads” ([15, 15:00, 57:00][v15]); Armin: “KV cache ... locks you heavily” ([80, 1:13:00][v80]).
- **30-second demo:** compare identical pinned sessions through uninterrupted, resume and compaction paths; surface a changed prefix/TTL and an omitted tool-result fact, then verify a narrowly scoped repair through fresh calls.
- **Closest:** [claude-code-cache-fix](https://github.com/cnighswonger/claude-code-cache-fix), [Kimi Vendor Verifier](https://github.com/MoonshotAI/Kimi-Vendor-Verifier), [llm-d](https://llm-d.ai/blog/sticky-until-saturated-token-aware-routing). A fix and conformance checks already exist; the residual is a missing versioned transition fixture.
- **Beneficiaries / owner:** SDK/harness maintainers and long-session users. They should own the fix; contribute a public minimal reproducer and usage-counter expectations.
- **Starting action:** reproduce one captioned failure with current pinned versions, cache-eligible timing and a cold control.
- **Kill test:** stop if it is fixed or fully tested. Provider counters alone cannot prove an internal KV cause; do not revive Theo's withdrawn fanout theory.
- **E — Scores:** **3 / 5 / 2 / 4 / 4 / 5 = 23**.

### P07 — Concurrent hybrid-cache lifecycle corpus

**I — Tiny engine contribution, GPU-dependent; Open, conditional.** Extend strict prefix/checkpoint recovery tests to cancellation, eviction and concurrent active requests for one hybrid model.

- **Q — Sources:** Bryce: “checkpointing frequency”; “all of the active requests” ([33, 55:00–57:00][v33]).
- **30-second demo:** two requests share a prefix, one cancels and another triggers eviction; compare resumed logits/output with an uncached reference and show which live state is protected. Separate correctness from memory/throughput.
- **Closest:** [September recovery study](https://arxiv.org/abs/2609.15030), [vLLM hybrid cache](https://github.com/vllm-project/vllm/blob/main/docs/design/hybrid_kv_cache_manager.md), [SGLang Unified Memory](https://www.sglang.io/blog/unified-memory). Serial recovery, allocation and eviction already have direct implementations/research.
- **Beneficiaries / owner:** vLLM/LMCache/SGLang maintainers and hosts. Their test suites are the right destination; there is no reason to invent another cache engine.
- **Starting action:** inspect current cancellation/concurrency tests and select one missing lifecycle edge with maintainers.
- **Kill test:** stop if existing tests cover it or a mismatch is sampling variation. Use deterministic/reference tolerances and actual supported checkpoint semantics.
- **E — Scores:** **4 / 2 / 2 / 4 / 5 / 5 = 22**.

### P08 — Speculative decoding length/domain diagnosis

**I — Tiny benchmark or blog with data; Open, conditional.** Determine whether a claimed 4K/8K acceptance cliff is domain shift, output position, repetition or serving overhead.

- **Q — Sources:** Bryce/Philip: “4,000 or 8,000 tokens”; “code ... literature” ([33, 1:00:00–1:01:00][v33]); Rashid: “multi-token prediction and diffusion LLM seem interesting” ([26, 35:00–36:00][v26]).
- **30-second demo:** plot pinned code/prose runs with independently varied prompt length and generation position; show acceptance, draft/verify milliseconds and end-to-end speedup. A high acceptance run can still lose throughput.
- **Closest:** [SPEED-Bench](https://arxiv.org/abs/2604.09557), [performance analysis](https://arxiv.org/abs/2601.11580), [October positional study](https://arxiv.org/abs/2610.30644). The latter already weakens a universal positional-collapse story.
- **Beneficiaries / owner:** drafter/engine authors and workload owners. Contribute the uncovered model/domain split upstream; no decoder startup.
- **Starting action:** request the Baseten workload/configuration behind the anecdote; otherwise label the study a different configuration rather than a reproduction.
- **Kill test:** stop novelty claims if the benchmark already contains it; publish a null result if no cliff appears. Never infer net speed from acceptance alone.
- **E — Scores:** **4 / 3 / 2 / 3 / 4 / 5 = 21**.

### P09 — Application coordination-tax diagnosis before a transport change

**I — Big, weeks; Ambiguous without cluster access.** Attribute synchronized GPU waiting to small-RPC tails and test whether changing transport improves useful application throughput.

- **Q — Sources:** Ousterhout: “whole process stalls”; “significant fraction of your GPU's resources” ([67, 03:00–05:00][v67]); d-Matrix: “six microsconds are too much” ([26, 32:00][v26]).
- **30-second demo:** a matched mixed-message replay shows RPC tail, barrier wait and GPU useful-work timeline; compare tuned TCP and Homa under the same load, CPU budget and protection requirements. Display application gain separately from RPC gain.
- **Closest:** [HomaModule](https://github.com/PlatformLab/HomaModule) already has the transport, cpbench and metrics; [Dynamo](https://github.com/ai-dynamo/dynamo) owns serving orchestration. A portable causal join across application/barrier/network traces is uncertain, not an established missing product.
- **Beneficiaries / owner:** cluster researchers/operators. Transport maintainers can supply adoption fixtures; application owners must expose synchronization evidence. An upstream Linux test/report may be the entire useful outcome.
- **Starting action:** find one willing operator with a measured short-RPC bottleneck and use existing Homa tools before writing a profiler.
- **Kill test / resolution:** stop if kernels, memory, encryption or host scheduling dominate, or if gains vanish against a tuned baseline. Without operator/hardware access, leave this as a documented experiment plan.
- **E — Scores:** **5 / 2 / 2 / 4 / 5 / 5 = 23**.

### P10 — Cross-silicon product parity fixtures

**I — Tiny upstream corpus; Open, conditional.** Capture one user-visible model/backend discrepancy with numerical tolerances, operation provenance and a product-level acceptance check.

- **Q — Sources:** Lattner: “writing the same models three times”; “quality problems ... users can feel” ([24, 54:00][v24]); Rashid: “broader diversity of hardware” ([26, 07:00][v26]).
- **30-second demo:** run the same pinned checkpoint and preprocessing on two available backends; show an operation's tolerated drift and whether the tool decision/accepted result changes, rather than demanding identical sampled prose.
- **Closest:** [Modular/Qualcomm](https://www.modular.com/blog/modcon-qualcomm), [ModCon stack](https://www.modular.com/blog/modcon-announcements), [PyTorch DTensor](https://docs.pytorch.org/docs/stable/distributed.tensor.html). Portability and placement are owned; a concrete counterexample is a useful contribution.
- **Beneficiaries / owner:** compiler/runtime maintainers and deployed application owners. Modular/PyTorch/hardware vendors should own fixes; publish a minimal cross-project fixture if licensing allows.
- **Starting action:** obtain one genuine reported backend failure and define a stable semantic oracle before choosing devices.
- **Kill test:** stop if current conformance tests already cover it or the drift is irrelevant to the task. No new compiler, universal tensor abstraction or kernel agent.
- **E — Scores:** **4 / 2 / 2 / 4 / 5 / 5 = 22**.

### P11 — Rare-event cascade coverage and escalation-budget audit

**I — Small weekend report over an existing detector; Open, conditional.** Estimate the cost and missed-coverage consequences of a cascade using representative excluded traffic, rather than only a balanced detector leaderboard.

- **Q — Sources:** Greg: “If I 100x, I'm still fired”; “cases we don't know”; “traditional ML is a reverse of good developer experience” ([C04, 09:00–18:00][c04]); Theo: “over 0.1” ([16, 47:00–49:00][v16]).
- **30-second demo:** a threshold lowers benchmark cost but lets benign escalation dominate at production prevalence. Display prevalence assumptions, uncertainty, sampled versus excluded populations, expected paid escalations and a ceiling on defensible coverage claims.
- **Closest:** [PINT](https://github.com/CheckPointSW/pint-benchmark), [buried-injections](https://github.com/rudratoshs/buried-injections), [SetFit](https://huggingface.co/docs/setfit/how_to/knowledge_distillation), and Sentry's existing pipeline. False-alarm evaluation and distillation are shipped; the residual is joining real sampling provenance and workload economics.
- **Beneficiaries / owner:** telemetry operators and detector maintainers. Sentry could build this internally; a dataset/report format shared by several operators would justify independent maintenance.
- **Starting action:** obtain one redacted sampling policy, observed confusion matrix and defensible prevalence range; make unavailable populations explicit.
- **Kill test:** stop if the existing evaluation already answers the budget question or representative labels are unavailable. Abstention and sampled unknowns cannot certify detection of unknown attacks.
- **E — Scores:** **3 / 4 / 2 / 4 / 4 / 5 = 22**.

### P12 — Exposure-aware retirement of model shims and instructions

**I — Small weekend extension; Open, conditional.** Add evidence that a compensating instruction was actually exercised before suggesting its removal after a model upgrade.

- **Q — Sources:** Geoff: “skills ... should be deleted after every model release” ([80, 40:00][v80]); Katz: “removed all these guardrails” and a shim retirement bot ([66, 03:00–04:00, 16:00][v66]); Factory: “every month we need to rethink” ([72, 08:00–09:00][v72]).
- **30-second demo:** an ablation passes, but the report says the relevant failure branch was never exercised; adding a known trigger shows the old shim still matters. Another shim has repeated exposed successes without it and is proposed for owner review.
- **Closest:** [skill-up](https://github.com/alibaba/skill-up) already compares with/without skills across engines; Katz already has a bot; [Promptfoo](https://www.promptfoo.dev/docs/configuration/expected-outputs/) supports custom outcome checks. Generic ablation is taken.
- **Beneficiaries / owner:** harness and skill maintainers. They can own removal logic; an upstream exposure annotation/report is the appropriate contribution.
- **Starting action:** select one historical failure, its compensating instruction and an owner-authored trigger/outcome fixture; compare pinned old/new models.
- **Kill test:** stop if the existing suite tracks exposure or the effect cannot be separated from other prompt changes. Never infer redundancy from non-use in unrepresentative tasks.
- **E — Scores:** **3 / 5 / 2 / 3 / 3 / 5 = 21**.

### P13 — Restart model/effort/access receipt

**I — Tiny adapter/conformance contribution; Open, conditional.** Preserve intended, displayed, submitted and observable effective settings across a crash/resume without treating them as identical evidence.

- **Q — Sources:** Theo: “bumping me down to medium when it crashed” ([88, 42:00][v88]); Quinn: “Every BYOK API endpoint is different” ([36, 19:00][v36]); Davis's model comparison varies by access surface ([29][v29]).
- **30-second demo:** restart a harness; highlight a difference between owner intent and submitted effort/model/transport, while marking server-effective settings unobservable if no provider acknowledgement exists. Allow a deliberate override rather than automatically fighting it.
- **Closest:** [Codex September effort-picker report](https://github.com/openai/codex/issues/44769), [September resume-baseline report](https://github.com/openai/codex/issues/48802), and [Kimi Vendor Verifier](https://github.com/MoonshotAI/Kimi-Vendor-Verifier). The two issues are adjacent reports, not reproductions of Theo's crash; a cache-preserving request baseline can intentionally differ from effective effort.
- **Beneficiaries / owner:** harness maintainers and benchmark authors. Providers should fix their own persistence bugs; contribute one adapter/fixture rather than a new orchestrator.
- **Starting action:** capture public synthetic request metadata around one current resume path and document what each layer can establish.
- **Kill test:** stop if the receipt already exists or only an irrelevant UI default changes. No assertion about effective effort from a screenshot or a top-level request field alone.
- **E — Scores:** **3 / 5 / 2 / 3 / 5 / 5 = 23**.

### P14 — Workload-fit quantization and local ownership recipe

**I — Tiny dataset/blog with data; Open, conditional.** Publish one reproducible hardware/model recipe that reports accepted-task quality, usable concurrency and full ownership cost alongside memory fit.

- **Q — Sources:** Ben's four-Spark quantization work ([14, 1:18:00][v14]); Michelle: “margin efficient” ([12, 34:00–35:00][v12]); Carter: “I'm not at 100% utilization” ([65, 30:00][v65]).
- **30-second demo:** a model fits but loses the task-quality floor or interactive responsiveness under concurrent use. Compare a verified local recipe and rented service with startup, power, amortized hardware, idle time and human setup separately reported.
- **Closest:** [AIConfigurator](https://github.com/ai-dynamo/aiconfigurator), [vLLM autotuning](https://github.com/vllm-project/vllm/blob/main/benchmarks/auto_tune/README.md), and existing model-specific quantization recipes. The residual is one uncovered workload/consumer-hardware combination, not configuration search.
- **Beneficiaries / owner:** local users considering costly hardware and runtime maintainers. Model/hardware communities already own recipes; contribute reproducible failures and outcomes there.
- **Starting action:** choose hardware already available; pin artifacts and an owner's actual acceptance cases before spending money.
- **Kill test:** stop if a matching reproducible recipe already exists. No ownership break-even claim from tokens/second with depreciation, idle capacity or quality omitted.
- **E — Scores:** **3 / 3 / 2 / 3 / 4 / 5 = 20**.

### P15 — Exact artifact/license provenance change receipt

**I — Tiny contribution; Open, weak and conditional.** Tie a deployment's exact weight/adapter/license revision to changed license documents or owner-supplied entity assumptions for review.

- **Q — Source:** Michelle: “open weight doesn't mean it's open to serve” ([12, 15:00–16:00][v12]); the proposed corporate spinout in that conversation is a joke, not a workaround recommendation.
- **30-second demo:** a deployment manifest pins a quantized derivative and adapter; a changed license hash or owner-entered revenue band generates a review packet linking the original terms and provenance, without announcing legal eligibility.
- **Closest:** [OpenWeights](https://openweights.com/) already provides organization-size/region checks, license matching and change alerts; the October check materially weakens the ledger's monitor idea. [Hugging Face model-card metadata](https://huggingface.co/docs/hub/model-cards) supplies artifact/license fields. The residual is exact deployed-artifact lineage and a reproducible change receipt.
- **Beneficiaries / owner:** small open-model hosts and maintainers of derived checkpoints. Registries/compliance tools can simply add it; prefer a manifest adapter rather than a new license business.
- **Starting action:** inspect one deployed derivative whose upstream/license lineage is not preserved by existing tooling; request owner confirmation of the missing record.
- **Kill test:** stop if current registry/compliance exports already contain it. Do not automate a legal conclusion or infer contract rights from a marketing label.
- **E — Scores:** **2 / 4 / 2 / 3 / 5 / 5 = 21**.

### P16 — Constant-scope versus expanded-scope accepted-outcome cost study

**I — Tiny public study/dataset; Open, conditional.** Separate cheaper completion of a held workload from money spent attempting more ambitious work, including human setup, review and repair.

- **Q — Sources:** Armin: team spend grew faster than productivity ([82, 1:37:00–1:40:00][v82]); Theo: “we're chasing the dragon ... smartest” ([85, 30:00–31:00][v85]); Ben/Theo revise their model judgment after merging the work ([16, 1:07:00–1:22:00, 1:42:00–1:46:00][v16]).
- **30-second demo:** the same team shows lower cost per accepted fixed task but a higher monthly bill because it attempted harder tasks. A cheaper model saves tokens while shifting more repair work to a human; both results stay visible.
- **Closest:** [Langfuse](https://langfuse.com/academy/experiments/cost-optimization), [TwinRouterBench](https://arxiv.org/abs/2605.18859), [ccusage](https://github.com/ccusage/ccusage). Costs plus task scores are already supported; the contribution is a carefully scoped, consented longitudinal dataset and explicit human/scope accounting. A13 supplies an optional representation-cost slice only where existing Arg studies lack the actual task/semantic requirements.
- **Beneficiaries / owner:** individual builders and small engineering teams. Existing analytics can host the data; no platform owner can supply a neutral user's entire counterfactual, but a new dashboard adds little.
- **Starting action:** predefine ten real repeatable tasks, acceptance and a human-effort diary; separately tag exploratory work and review outcomes after integration.
- **Kill test:** stop causal ROI claims if selection, learning, scope or intervention changes cannot be controlled; publish a descriptive study instead. No productivity inference from generated lines or tokens alone.
- **E — Scores:** **4 / 4 / 2 / 4 / 4 / 5 = 23**.

### P17 — Ambient heartbeat and wakeup cost census

**I — Tiny trace study/upstream report; Open, conditional.** Identify recurring paid activations that produce no accepted outcome or lack an owner-defined stopping horizon.

- **Q — Sources:** Alex: “it sends heartbeats every like 10 minutes” ([65, 27:00][v65]); Armin/Ben discuss “proactive burning tokens” ([82, 50:00–51:00][v82]); Theo's unattended goal continues spending ([16, 1:46:00–1:48:00][v16]).
- **30-second demo:** a week of locally imported jobs shows spend by trigger, retained useful artifact and escalation; a no-op heartbeat is visible next to one that prevented a missed event. Compare deterministic screening with the existing model route, without assuming every quiet interval was worthless.
- **Closest:** [ccusage](https://github.com/ccusage/ccusage), [Langfuse](https://langfuse.com/academy/experiments/cost-optimization), and OpenRouter's already shipped router discussed in video 65. Routing and scheduled-agent infrastructure are taken; trace-level outcome classification is the small contribution.
- **Beneficiaries / owner:** ambient-agent users and scheduler maintainers. Their providers should expose activation cost; contribute a report/fixture upstream.
- **Starting action:** obtain a week's consented local activation log and agree what “useful” and “must keep checking” mean with the owner.
- **Kill test:** stop if current reports already join triggers and outcomes, or quiet checks cannot be evaluated without hindsight. No new wakeup engine or enforcement proxy.
- **E — Scores:** **2 / 5 / 2 / 3 / 5 / 5 = 22**.

### P18 — Portable latent-state and model-switch contract

**I — Ambiguous research direction; no implementation commitment.** Determine which parts of a long-lived agent session can be exported across providers/models without falsely promising portable KV state.

- **Q — Sources:** Armin: “KV cache ... locks you heavily” ([80, 1:13:00–1:15:00][v80]); Walden wants persistent context and “storage in S3” ([65, 18:00–19:00, 37:00][v65]); Baseten discusses “KV cache to LoRA adapters” ([34, 25:00][v34]).
- **30-second demo:** an evidence matrix marks text/tool history portable, one same-checkpoint cache transfer verified, and a cross-checkpoint transfer unsupported. Show restart cost and retained task facts rather than a universal session file.
- **Closest:** [Dynamo](https://github.com/ai-dynamo/dynamo) documents KV-aware routing and GPU/CPU/SSD/remote tiers; [LMCache](https://github.com/LMCache/LMCache) and the [hybrid recovery study](https://arxiv.org/abs/2609.15030) already handle cache movement/recovery. Storage offload is not model-independent semantic portability; KV-to-LoRA is active research.
- **Beneficiaries / owner:** long-session hosts and teams with provider-exit risk. Engines/providers control the relevant tensors and should own compatible transfers; hosted opaque APIs may make the desired contract impossible for an outsider.
- **Starting action / resolution:** ask one application owner which exact continuity loss blocks switching and one engine maintainer which state contract is exposed; specify model/checkpoint/architecture/hardware boundaries.
- **Kill test:** stop if ordinary history export suffices, no exposed state exists, or the request reduces to existing offload. Do not build a universal cache serialization format on assumed compatibility.
- **E — Scores:** **5 / 3 / 1 / 3 / 3 / 5 = 20**.

## 6. Predictions board

**Q/I:** the middle column paraphrases attributed forward-looking claims, questions or roadmap statements; it does not endorse them. Closely repeated claims are grouped, with contrary forecasts kept beside them. “Build if true” is a conditional response, including contributions to existing tools. A request for a capability is retained even when the timing or commercial form is unresolved. Product shipment checked in §3 supersedes an older “not available yet” statement.

### Economics, subsidies and demand

| ID / source, speaker | Attributed forecast or unresolved future claim | I — What would have to be built or measured if true |
|---|---|---|
| B01 — [05 57:00–59:00][v05], Mario | Recent models feel plateaued; subsidies could end in 6–12 months. | P04 downside replay; P16 holds tasks fixed to test plateau rather than compare launch impressions. |
| B02 — [05 59:00][v05], hosts | Do equivalent-task token costs fall faster than subsidies disappear? Unresolved. | Separate price, policy, behavior and demand scenarios; do not bake in either outcome. |
| B03 — [12 37:00–43:00][v12], Michelle | Subscription economics tighten; prices rise, permitted uses shrink or subscriptions disappear within 6–12 months. | P04 with dated policies and stopping boundaries; no inference from list-price equivalence to actual losses. |
| B04 — [12 34:00–35:00, 41:00][v12], Michelle | Hardware can become less margin-efficient while still useful; scarce older GPU rental prices can rise. | P01/P14 include opportunity cost and actual quotes, not hardware age as a cost oracle. |
| B05 — [12 45:00–46:00][v12], Michelle | Compute becomes a strategic currency; Cloudflare invests early. | Supplier/commitment exposure scenarios; capacity acquisition is Cloudflare's roadmap, not a side-project gap. |
| B06 — [13 34:00–36:00, 54:00–55:00][v13], Dax / investor claim | Token demand may outrun capacity; shortages may eventually produce a glut. Dax does not predict a definite doubling. | P04 sensitivity ranges with both scarcity and overcapacity; no single extrapolated price curve. |
| B07 — [01 36:00][v01]; [85 11:00–16:00, 25:00][v85]; [88 23:00–26:00][v88], Theo | Fixed-capability inference becomes much cheaper; a current high-use workload might reach roughly $1K/year, and VM cost may dominate. | P16/P14 measure the fixed-workload crossover; existing hosting is taken. This is the condition that could revive execution savings, unlike rising inference prices. |
| B08 — [85 29:00–31:00][v85], Theo | Inference-provider margins approach the floor as competition lowers prices. | Provider-exit drills, portable acceptance cases and reservation-versus-flexibility analysis. Conflicts with pricing-power forecasts below. |
| B09 — [31 23:00][v31], Ben | Hopes for models 10× better and 10× cheaper. | P16 distinguishes the quality and price dimensions; a hope is not a delivery date. |
| B10 — [52 03:00][v52], Krentsel | Frontier models keep becoming more expensive. | P04/P16 track actual accepted-task cost by version; conflicts with fixed-capability optimism. |
| B11 — [11 08:00–09:00][v11], Sunil; [16 58:00][v16], Theo; [28 20:00–22:00][v28], Liz/Sam | Cheap inference/classification creates more uses and volume; an investor attributes an 80% price cut and 5× use to this effect. | P16/P17 measure elasticity and new work; investor magnitudes remain unverified, not a calibrated demand model. |
| B12 — [15 1:20:00–1:21:00][v15]; [85 30:00–31:00][v85], Theo/hosts | More affordable usage increases ambition rather than reducing the total bill. | Tag fixed versus new scope, failed exploration and eventual accepted value in P16. |
| B13 — [15 49:00–57:00, 1:09:00–1:11:00][v15], hosts | Reseller margins tighten; scarce capacity may favor large contracts over self-serve users. | Access-class observations and scenarios; no claim to know providers' internal incentives. |
| B14 — [15 1:19:00, 1:34:00–1:36:00][v15], hosts | Launch-time unlimited allowances tighten and policy normalization continues. | P04 distinguishes promotional and steady policies; retain effective dates rather than retroactively repricing history. |
| B15 — [15 1:26:00][v15], hosts | For background work a two-versus-ten-minute difference may matter less than cost. | Existing schedulers need measured interactive/background acceptance budgets; P05 reports both latency and money. |
| B16 — [38 10:00–14:00][v38], Ball | Frontier access stratifies software creation for several years; token austerity slowly damages growth. | P16 includes delayed human repair and delivery outcomes, not just immediate budget savings. |
| B17 — [09 53:00–56:00][v09], Steve / Demetri | Net lab revenues are unknown; local labor markets may change AI replacement economics. | Explicit uncertainty and region-specific human alternatives in P16, not a supplier-solvency forecast. |
| B18 — [28 27:00–30:00][v28], Michelle / Sam / Dave | CFO pressure forces better allocation; routing grows; competitive inference cost could approach energy cost. | Workload allocation studies with fixed quality and total-cost decomposition; generic routers already shipped. Energy-only asymptotes omit capital/idle/operations assumptions. |
| B19 — [80 1:14:00–1:15:00, 1:30:00–1:31:00][v80], Geoff / Armin | Capacity commitments create premature lock-in; supplier financial viability remains disputed; open weights are a resilience fallback. | P01/P04/P18 test practical fallback and commitment exposure with owner acceptance, not just API compatibility. |
| B20 — [82 29:00][v82], Armin | Reported open-model demand collapsed once free access became paid; free use may not predict durable demand. | Subsidy-removal cohort evidence and demand bounds in P04/P16; do not assume retained volume at the new price. |
| B21 — [88 26:00][v88], Theo | Free cloud-agent VMs will not remain free. | P04 adds execution-credit expiry as a separate scenario. A new host is not implied. |
| B22 — [C02 04:00–05:00][c02], Cloudflare | Same benchmark-level outcome is much cheaper; longer tasks and better models make software replacement more feasible. | P16 full-lifecycle outcome accounting, including cutover/data/human work; the claimed 75× is not a matched app migration measurement. |
| B23 — [C07 04:00–09:00][c07], Runway | Lower creation cost permits content that would never have been produced; better frontier planners improve the agent. | Expanded-scope media outcomes in P16; do not count every generated clip as pre-existing labor saved. |
| B24 — [87 04:00–05:00, 31:00–32:00, 45:00–46:00][v87], Anthropic article / Theo | Removing bottlenecks creates more code; small teams may replace infrastructure cheaply and often. | Capacity/outcome accounting and full migration lifecycle costs. Existing git infrastructure and checkout caches remain occupied. |

### Model markets, adequacy and local execution

| ID / source, speaker | Attributed forecast or unresolved future claim | I — What would have to be built or measured if true |
|---|---|---|
| B25 — [04 40:00–46:00][v04], Michael | Routers grow, routine work moves downmarket, fewer capability skills are needed, and open weights reduce dependence. | P05/P12 plus a real fallback corpus; router and local host are not new products. |
| B26 — [10 11:00–12:00][v10], Scott Wu | Around 2% of work needs frontier models while commodity models do most volume; frontier vendors may still earn 98% gross margin. | A volume-versus-spend scenario study and blind adequacy trials, not a measured market-share forecast. Conflicts with both frontier-coding and margin-floor views. |
| B27 — [10 12:00][v10], Scott | Model replacement is increasingly unnoticed. | Blind model-switch acceptance fixtures in existing evaluators; distinguish user taste, protocol and task success. |
| B28 — [09 1:21:00][v09], Steve | Frontier labs may acquire or reproduce the cheap classifier primitive. | Prefer P02/P11 data/runtime contributions over a generic hosted classifier moat. |
| B29 — [11 12:00–16:00][v11], Sunil / Ree | Small classifiers eat the market from below; useful open local/phone decision models should emerge. | P02 tests task/device parity and privacy. Close implementations now exist, weakening the original missing-model thesis. |
| B30 — [11 17:00–18:00][v11], Ree / Sunil | Real tool-search intent can train a tiny specialist. | A held-out intent/candidate-retrieval corpus and calibrated unknown cases; SetFit/model training pipelines are existing mechanisms. |
| B31 — [11 22:00][v11]; [16 44:00][v16], hosts | Image decisions are the next Jev capability; Ree wants robotaxi detection. | A distinct local vision fixture/adapter if wanted. TypeSafe's October experimental image support changes the older availability claim. |
| B32 — [55 08:00–09:00][v55], Adam | A competing OpenAI decisions API is reportedly forthcoming. | Capability/conformance tests, not a new decision API. This report did not independently verify that announcement. |
| B33 — [12 17:00–19:00][v12], Michelle | Cloudflare's original small/near-user architecture bet met increasing large-model demand; the throughput tier responds. | Capacity/admission scenarios in P01; do not assume all useful models converge toward smaller devices. |
| B34 — [12 25:00–30:00][v12]; [13 45:00–46:00][v13], Michelle / Sunil / Dax | Publicly useful open models have caught up or their apparent 6–12-month lag is shrinking; private lab capability is unknown. | Task-specific release/availability history, not a single benchmark lag number. P14 records usefulness within hardware constraints. |
| B35 — [12 26:00, 29:00–30:00][v12], Sunil | A community/local model archive could preserve independent access; the USB/backyard commune story is humorous. | A checked offline recipe/archive contribution if an actual user needs it; no inferred distributed-inference business. |
| B36 — [13 28:00–32:00, 42:00–44:00][v13], Dax | Open stacks at every layer gain support from countries/customers/vendors; more geographically diverse producers may emerge and many hosts compete. | P10/P15 and provider conformance; capacity, license and endpoint differences limit frictionless substitution. |
| B37 — [13 51:00–55:00][v13], Dax | Open models eventually dominate inference volume, proprietary frontiers retain a role, and an adequate runner-up can win under budget pressure. | P05/P16 compare volume, spending and accepted outcomes separately; no universal downgrade policy. |
| B38 — [14 1:19:00, 1:51:00–1:56:00][v14], Ben / Theo | Countries may specialize in large versus efficient models; one model family may approach its efficiency ceiling, but a comeback is disputed; slightly cheaper/slightly worse can fail to attract users. | Longitudinal task frontier and differentiated-capability examples. Treat national/model-ceiling accounts as speculative opinions. |
| B39 — [16 09:00–13:00][v16], hosts | Intermediate models lose a clear market niche between tiny and frontier. | Include middle tiers in P05/P16 rather than assuming a two-model optimum. |
| B40 — [16 31:00–35:00, 1:12:00][v16], Theo / Ben | Independent teams can select rival labs' best models; model access constraints may shape winners; a release may fit wider enterprise constraints. | P13 captures access/plan/surface; real consumer-to-workplace acceptance tests, not ranking by unrestricted consumer demos. |
| B41 — [16 1:05:00–1:06:00][v16], hosts | They want a refreshed small Anthropic model. | Capture the observed release before testing; a request is not proof of a commitment or of task adequacy. |
| B42 — [28 15:00–16:00][v28], Dave / moderator | Enterprises deploy hundreds/thousands of fine-tunes, may own hardware, and combine specialized silicon. | P10/P14 workload-specific recipes/provenance and ownership scenarios. Do not build a generic enterprise model registry from this prediction alone. |
| B43 — [28 21:00–26:00][v28], Sam / Dave | Open alternatives do not necessarily cannibalize frontier growth; most users may accept near-frontier utility at a fraction of cost; token volume could still concentrate in a few vendors. | Blind adequacy trials and distinct token-volume/value/concentration measures. These forecasts can coexist only with explicit denominators. |
| B44 — [28 18:00–19:00, 23:00–29:00][v28], Michelle / Quentin / Dave | Easier harnesses and financial feedback improve model/resource allocation. | P05 environment-aware tests and P16 longitudinal allocation outcomes; existing routing products remain taken. |
| B45 — [29 00:00–01:00, 14:00][v29], Davis | A new lab can be useful yet behind the frontier; current differentiation may vanish quickly. | P13 version/access receipts and repeated real-task evaluations, including failures rather than launch demos alone. |
| B46 — [31 16:00–17:00][v31]; [37 01:00–03:00][v37], Davis / Ball | Scarce orchestration capabilities become commonplace in months; waiting may make a project cheaper; outcome prompting supersedes detailed implementation instructions. | P12 checks obsolete scaffolding; acceptance fixtures should survive changing implementation methods. |
| B47 — [34 07:00–13:00][v34], Baseten / Gabe | Open models create value without closing the absolute frontier; coding keeps expanding into frontier capability while recurring legal work specializes. | P16 compares matched task families; Harvey's diligence and firm-expertise models are Being built, not open gaps. |
| B48 — [38 06:00–08:00][v38], Ball / Slack | Frontier capability changes workflow categories rather than only speeding existing snippets. | P16 records newly possible work separately from fixed-workload efficiency. |
| B49 — [80 1:05:00–1:06:00, 1:21:00–1:22:00][v80], Geoff | Useful local frontier-like work currently requires expensive hardware, but that can change; many tasks do not need frontier intelligence. | P14 tests actual budgets and task floors. His stated multimillion-dollar threshold is not a universal hardware requirement. |
| B50 — [80 1:17:00–1:19:00, 1:28:00–1:30:00][v80], Armin / Ben / Geoff | Novelty waves may exhaust or move into new media; general agents plus tools may absorb vertical media products. | Durable-use and complete-workflow cost/control studies. A generative model category alone is not a product moat. |
| B51 — [C11 05:00–07:00][c11], customer | Tiny models fit tiny tasks; better models plus MCP do not automatically eliminate custom harnesses, and business loops need finite bounds. | P05 includes bounded tasks; P04 counts runaway turns. This is a competing architectural view, not proof all harnesses persist. |

### Cache, routing and post-training

| ID / source, speaker | Attributed forecast or unresolved future claim | I — What would have to be built or measured if true |
|---|---|---|
| B52 — [34 02:00–03:00, 22:00–25:00][v34], Baseten | Latent KV compression, context-to-weights and model-selected compaction can replace text-only persistence. | P07/P18 retention/freshness and lifecycle tests. KV-to-LoRA and continual specialists are explicitly Being built; no claim of empty mechanism space. |
| B53 — [34 13:00, 24:00][v34], Gabe / Baseten | Firm expertise can be encoded without client data; deployed specialists improve continually. | Domain-held-out acceptance/data-provenance fixtures; these are Harvey/Baseten roadmaps, not a new training platform. |
| B54 — [65 03:00–05:00, 12:00–13:00][v65], Walden | Frontier planning plus cheap implementation lowers cost; today's routing techniques may look legacy in a year. | P05 tests complete task outcomes with a strong constant baseline and upgrade-resistant fixtures. The cited 40% is Cognition's claim. |
| B55 — [65 16:00, 26:00, 28:00][v65], Alex | Domain-aware fusion, tunable routing and cache-versus-switch controls improve allocation. | Existing OpenRouter roadmap; contribute environment/cache evidence rather than another router. |
| B56 — [65 18:00–19:00, 37:00][v65], Walden | Persistent sidekicks need long-lived context and storage-backed KV. | P06/P18 examine retention, cost and supported state boundaries; Dynamo/LMCache already own offload. |
| B57 — [65 19:00, 41:00–42:00][v65], Walden | Train orchestrators/executors to collaborate; learn routes from user upgrade/downgrade corrections. | Held-out collaboration-role and override-provenance cases in P05. Cognition is already working toward this. |
| B58 — [65 30:00–31:00, 43:00][v65], Carter / panel | Hybrid local/cloud processing detects sensitive inputs; concurrency can use otherwise-idle local compute. | P02/P14 verify data flows, contention, memory and useful concurrency on actual devices; hybrid routing already has owners. |
| B59 — [65 34:00–36:00][v65], NVIDIA researcher | Short cache TTLs are operational policy rather than a fundamental physical duration. | P06 measures exposed policy/access-path behavior; P18 checks longer tiers. Do not infer unlimited retention is cheap or available. |
| B60 — [65 43:00–47:00][v65], panel / Alex | Router ownership may be product or plumbing; one large model could dominate, while memory/cache and model differences still motivate collaboration. | P05 includes dominance and cache-loss controls; no assumption routing always saves money or always disappears. |
| B61 — [65 47:00][v65], Alex | Classification spending still reaches expensive models and more may move downmarket. | P02/P11/P16 quantify accepted decisions, uncertainty and total escalation cost, not just a nominal per-token saving. |
| B62 — [44 12:00][v44]; [45 14:00][v45]; [19 24:00][v19], Vela / Ali / Uday | Runpod, Arize and Uber explore smart or per-task routing and small post-trained models. | These are named Being built/Roadmap owners. Offer public workload fixtures to their existing systems. |
| B63 — [33 1:00:00–1:01:00][v33], Bryce / Philip | Domain-trained/diffusion speculators promise speed, while acceptances can collapse outside their training horizon/domain. | P08 tests domain and position separately with net speed/throughput; October evidence disputes a universal position cliff. |
| B64 — [33 42:00–43:00, 55:00–1:00:00][v33], Baseten | Day-zero engine support and smarter mixed-state reuse enable new large models; optimal prefill/decode resources shift with traffic. | P07 lifecycle tests and existing AIConfigurator/engine configuration work. A static tuning recipe cannot cover arbitrary traffic. |
| B65 — [C08 08:00–18:00][c08], VSCO | Keep evaluating new models; use Clef decisions to manage spend and compact large context. | Stable acceptance fixtures in P01/P05/P06; no exact savings asserted by the talk. |
| B66 — [C04 13:00–18:00][c04], Greg | A roughly 4M student might give sub-ms synchronous decisions; specialists become attractive at scale and hosting can serve other telemetry tasks. | P11 representative coverage/economic audit before training. Small size and low latency are hypotheses, not achieved results here. |

### Silicon, serving and networking

| ID / source, speaker | Attributed forecast or unresolved future claim | I — What would have to be built or measured if true |
|---|---|---|
| B67 — [24 1:16:00–1:18:00][v24]; [25 03:00–08:00][v25], Lattner | More hardware vendors, Apple/local-PC and Snapdragon/native-Windows support expand; six architectures are claimed in the later talk. | P10 concrete supported-version parity fixtures. MAX/Mojo and hardware support are owned platform work. |
| B68 — [25 05:00–06:00][v25]; [28 14:00–16:00][v28], Lattner / Dave | AI hardware grows stranger and compatibility/coordination gets harder across generations. | P03/P10 explicit capability/semantic matrices; never equate a GPU metric with an NPU measurement automatically. |
| B69 — [26 02:00–03:00, 19:00–20:00][v26], Rashid | Memory-centric hardware may change models; diffusion may matter for language. | P08/P10/P14 compare supported workload requirements; no new hardware platform proposed. |
| B70 — [26 10:00–14:00, 38:00–41:00][v26], panel | Buyers are more willing to use non-GPUs; current models improve in efficiency; world/physical/scientific AI expands architecture needs. | Actual non-GPU task trials and modality-specific workload evidence. Therapeutics is a vendor research direction, not validated medical benefit. |
| B71 — [26 23:00–26:00][v26], d-Matrix / Lattner | Mixed model/tool/database paths and asynchronous devices matter more as host handoffs become bottlenecks. | P09 separates host/transport/application waits. Kernel throughput alone is an inadequate app denominator. |
| B72 — [26 35:00–39:00][v26], Rashid / AWS panelist | Memory-bound low batches can exploit multi-token/diffusion compute; less reasoning verbosity could yield the same answer for less scarce compute. | P08/P16 quality-held-constant token/latency experiments; do not assume fewer reasoning tokens preserve acceptance. |
| B73 — [28 00:00–02:00, 07:00, 12:00–13:00][v28], investors | Inference becomes the investment focus; vertical integration can create walled gardens. | Switching-cost and artifact/behavior evidence in P10/P15/P18. Kernel-agent category stays killed. |
| B74 — [28 30:00][v28], Sam / Quentin | A robotics breakthrough may be near; world-model inference might eventually exceed language-model compute. | Modality demand scenarios and real workload acquisition. Too speculative for a new generic inference platform. |
| B75 — [67 05:00, 11:00–18:00][v67], Ousterhout | Coordination can waste major GPU resources; Homa adoption and Linux integration can improve small-message tails. | P09 reproduce useful-work gains and provide adoption bug reports with current revisions. Kernel transport already exists. |
| B76 — [77 16:00–19:00][v77], Jelveh | Version mapping, standardized metrics and AMD/Intel coverage improve heterogeneous operations; small/quantized/vision workloads make fine-grained sharing more interesting. | P03 upstream semantic fixtures and real-device cases; no cross-vendor claim without devices. |
| B77 — [78 05:00][v78], Ben | Rare per-machine failures become routine in a large fleet. | Failure/replica assumptions in P01/P14 and existing fleet tools. No new distributed-training operations product. |
| B78 — [C09 11:00–12:00, 25:00–26:00][c09], Cloudflare / audience | Isolate efficiency is presented as large; colocation could reduce model-call latency but is untested. | Matched workloads and measured access paths before any cost/latency claim; no inferred DO/GPU affinity guarantee. |

### Trust, harness change and model retirement

| ID / source, speaker | Attributed forecast or unresolved future claim | I — What would have to be built or measured if true |
|---|---|---|
| B79 — [03 06:00][v03], dbt presenter; [08 52:00, 1:24:00][v08], Jane Street speakers | Better models alone do not establish analytical trust; hallucination is perceived as solved in one setting and persistent in another. | Task-specific grounding/acceptance fixtures; P16 separates copying, explanation and consequential decisions. |
| B80 — [11 04:00–11:00][v11]; [58 00:00–02:00, 07:00–08:00][v58], Sunil / CJ | Typed decisions enable deterministic applications; classifier-based stylistic/provenance checks are contemplated. | P02/P11 calibration and false-positive evidence; a well-typed decision does not establish truth, authorship or rights. |
| B81 — [50 31:00–40:00][v50], Jiang / Lesse | External harness feedback changes models before release; proactive/personalized behavior remains unfinished. | End-to-end model/harness release fixtures in existing evaluators; no causal post-training claim from launch impressions. |
| B82 — [50 1:18:00–1:19:00][v50], Jiang | Continuous effort within a consistent model is preferable; intelligence is saturated on some tasks, making delivery cost more important. | P13 records effective configuration; P16 tests saturation and quality floors instead of swapping personas blindly. |
| B83 — [50 1:45:00–1:46:00][v50]; [52 09:00–10:00][v52]; [63 00:00, 12:00][v63], Jiang / Krentsel / hosts | Models may select/split their own architectures and improve all connective logic; current overspecialized harnesses may expire. | P12 ablation/exposure evidence. Exo/self-learning harnesses are active work, not an empty category. |
| B84 — [15 44:00–46:00][v15]; [66 03:00–06:00, 16:00][v66]; [72 08:00–09:00][v72]; [80 40:00][v80], Theo / Katz / Factory / Geoff | Model upgrades absorb old guardrails and skills; remove/rethink scaffolding frequently. | P12 distinguishes genuinely unnecessary shims from unexercised ones; Katz already built a bot and generic ablation exists. |
| B85 — [04 44:00–45:00][v04], Peter / Michael | Personal taste/preferences outlast capability-gap instructions. | Owner-authored acceptance examples in P01/P12; no universal model taste score. |
| B86 — [71 12:00, 20:00, 27:00–28:00][v71], Cherny / Sumner | Models become economical enough for routine use, remain underused for metric-driven loops, and cheap proposals reduce sunk-cost pressure. | P16 includes rejected proposals and honest acceptance oracles; generic optimization loops remain killed. |
| B87 — [80 50:00, 59:00–1:00:00][v80], Armin | Learned customizations can persist as code; models may replace harness edit tools with synthesized programs. | P12 tool-use/exposure drift and inspectable code artifacts. This does not establish a novel trace compiler or agent JIT. |
| B88 — [80 1:09:00–1:10:00][v80], Armin | Action/code and explanatory commentary might become separate output streams. | Measure operation latency, evidence retention and cost independently; a protocol fixture in existing harnesses before a new product. |
| B89 — [82 17:00–21:00][v82], Armin / Ben | Provider conflicts and access removals can couple model availability to tool choice. | P13/P18 provider-access-loss drills; the news histories themselves were not independently verified here. |
| B90 — [82 50:00–51:00][v82], Ben | Ambient coworkers proactively infer work from chat. | P17 activation/outcome/stop-horizon census; existing coworkers own the product direction. |
| B91 — [86 10:00–11:00][v86], Theo | Reviewers with different training may find distinct defects. | P16 fixed-PR review-yield slice counting unique verified findings, false alarms, duplication and human review time. |
| B92 — [12 27:00–28:00, 35:00][v12], Michelle; [85 16:00][v85], Theo | Faster releases increase catalog churn; users cling to old models while operators need room, and old bargain models may vanish. | P01 rehearses user migration plus GPU reclamation; generic model-ID migration already exists. |
| B93 — [62 16:00–21:00, 45:00, 2:00:00–2:04:00][v62], Karpathy, historical | More reasoning trades latency for accuracy; product capabilities rapidly change, and models/tools/clients become a zoo. | Timestamped capability/configuration receipts and real task/latency fixtures. The recording's no-thinking-Claude forecast aged during the same recording. |
| B94 — [C01 26:00][c01], Cloudflare | Hosted structured extraction is launched and open weights are planned. | Existing extraction owners and a future offline artifact check; no generic extraction API. |
| B95 — [C07 15:00][c07], Runway | A video model can power a clickable software interface. | Interaction acceptance/latency/outcome fixtures if access exists; Runway is already building the capability. |
| B96 — [C13 16:00–21:00][c13], Dillon / Cloudflare | Small AI-native teams and less manual coding become common; more inference should raise software quality expectations. | P16 complete delivered-quality/cost studies and existing black-box acceptance tooling. Generation volume alone cannot establish a quality increase. |

### Representation and context demand

| ID / source, speaker | Attributed forecast or unresolved future claim | I — What would have to be built or measured if true |
|---|---|---|
| B97 — [C03 01:00, 08:00–10:00, 15:00][c03], Jacky Koh | Agents consume more work infrastructure; shared files improve memory; lean representations enable cheaper small-model tasks; work shifts toward systems that prompt recurring agents. | A13/P16 compare task-equivalent serialization and actual accepted outcomes; P17 accounts for recurring activation. Arg already supplies the workspace and format research. |

**I — Possible hidden seed:** no unsupported universal model/router/serving layer emerges from these forecasts. The bounded seed is **economic continuity during change**: models change, access changes, cached state changes and bills change, but the operator still needs an accepted outcome and an honest capacity/budget decision. P01 and the smaller fixtures address observable parts of this. A general system that claims to handle all those changes would duplicate providers and become much larger than the evidence warrants.

## Caption source index

**F:** these links locate the cited source files. Times in the tables identify the exact minute buckets; a link opens near the earliest citation in this report. Caption spellings and attributions remain subject to the limits above.

[c01]: /Users/noah/code/sofort/arch/research/connect26/transcripts/01-building-an-open-agentic-internet-discoverable-callable-and-.txt:30
[c02]: /Users/noah/code/sofort/arch/research/connect26/transcripts/02-it-s-time-to-build-not-buy.txt:8
[c03]: /Users/noah/code/sofort/arch/research/connect26/transcripts/03-break-the-ceiling-of-internal-productivity-with-a-fast-globa.txt:12
[c04]: /Users/noah/code/sofort/arch/research/connect26/transcripts/04-sentry-at-cloudflare-connect-the-prompt-is-lava.txt:13
[c07]: /Users/noah/code/sofort/arch/research/connect26/transcripts/07-generative-media-s-breakthrough-moment-insights-from-runway.txt:8
[c08]: /Users/noah/code/sofort/arch/research/connect26/transcripts/08-an-agent-that-onboards-a-photography-studio-on-workers-ai.txt:12
[c09]: /Users/noah/code/sofort/arch/research/connect26/transcripts/09-why-modern-software-engineering-needs-durable-objects.txt:15
[c11]: /Users/noah/code/sofort/arch/research/connect26/transcripts/11-building-durable-agents-with-durable-objects.txt:9
[c12]: /Users/noah/code/sofort/arch/research/connect26/transcripts/12-12-mistakes-telus-made-building-an-agent-platform-for-100-00.txt:31
[c13]: /Users/noah/code/sofort/arch/research/connect26/transcripts/13-artifacts-git-compatible-versioned-storage-from-zero-to-beta.txt:20
[v01]: /Users/noah/code/sofort/arch/research/corpus/transcripts/01-theo-t3-gg-how-to-give-claude-unlimited-usage.txt:5
[v03]: /Users/noah/code/sofort/arch/research/corpus/transcripts/03-dbt-labs-the-semantic-layer-is-dead-long-live-the-semantic-layer.txt:10
[v04]: /Users/noah/code/sofort/arch/research/corpus/transcripts/04-peter-yang-the-4-step-agentic-engineering-workflow-i-use-to-ship-real-.txt:44
[v05]: /Users/noah/code/sofort/arch/research/corpus/transcripts/05-fragmented-ai-developer-podcast-312-understanding-pi-durable-with-mari.txt:1
[v08]: /Users/noah/code/sofort/arch/research/corpus/transcripts/08-jane-street-how-ai-is-changing-programming.txt:1
[v09]: /Users/noah/code/sofort/arch/research/corpus/transcripts/09-a-life-engineered-what-senior-engineers-are-actually-doing-about-ai.txt:1
[v10]: /Users/noah/code/sofort/arch/research/corpus/transcripts/10-modal-it-s-time-to-be-ambitious-scott-wu-co-founder-ceo-at-cognition-r.txt:15
[v11]: /Users/noah/code/sofort/arch/research/corpus/transcripts/11-next-token-ep-06-the-senior-engineer-death-spiral.txt:1
[v12]: /Users/noah/code/sofort/arch/research/corpus/transcripts/12-next-token-ep-05-i-m-the-arbiter-of-tokens-and-gpus.txt:46
[v13]: /Users/noah/code/sofort/arch/research/corpus/transcripts/13-baseten-opencode-creator-why-open-source-ai-models-dominate.txt:1
[v14]: /Users/noah/code/sofort/arch/research/corpus/transcripts/14-nerd-snipe-we-can-t-trust-gemini-4.txt:1
[v15]: /Users/noah/code/sofort/arch/research/corpus/transcripts/15-nerd-snipe-openai-s-dev-day-was-a-disappointment.txt:1
[v16]: /Users/noah/code/sofort/arch/research/corpus/transcripts/16-nerd-snipe-opus-5-5-grok-4-7-are-exactly-why-post-training-matters.txt:65
[v19]: /Users/noah/code/sofort/arch/research/corpus/transcripts/19-the-pragmatic-engineer-uber-s-ai-infra-from-the-inside.txt:1
[v24]: /Users/noah/code/sofort/arch/research/corpus/transcripts/24-the-pragmatic-engineer-from-swift-to-mojo-and-high-performance-ai-engi.txt:84
[v25]: /Users/noah/code/sofort/arch/research/corpus/transcripts/25-modular-chris-lattner-at-qualcomm-s-snapdragon-summit-one-software-sta.txt:7
[v26]: /Users/noah/code/sofort/arch/research/corpus/transcripts/26-modular-modcon-panel-the-multi-silicon-stack.txt:11
[v28]: /Users/noah/code/sofort/arch/research/corpus/transcripts/28-modular-funding-the-ai-stack-modcon-2026-panel.txt:24
[v29]: /Users/noah/code/sofort/arch/research/corpus/transcripts/29-ben-davis-it-s-actually-good.txt:6
[v30]: /Users/noah/code/sofort/arch/research/corpus/transcripts/30-ben-davis-jev-is-the-coolest-new-model-that-everyone-s-using-wrong.txt:12
[v31]: /Users/noah/code/sofort/arch/research/corpus/transcripts/31-ben-davis-how-i-m-actually-using-ai-these-days.txt:27
[v33]: /Users/noah/code/sofort/arch/research/corpus/transcripts/33-baseten-how-trillion-parameter-ai-models-work-and-how-to-serve-them.txt:1
[v34]: /Users/noah/code/sofort/arch/research/corpus/transcripts/34-baseten-why-smarter-models-aren-t-enough.txt:29
[v36]: /Users/noah/code/sofort/arch/research/corpus/transcripts/36-amp-inc-how-amp-builds-amp-quinn-slack-at-paradigm-frontiers-2026.txt:23
[v37]: /Users/noah/code/sofort/arch/research/corpus/transcripts/37-amp-inc-how-thorsten-ball-uses-amp-october-2026.txt:11
[v38]: /Users/noah/code/sofort/arch/research/corpus/transcripts/38-amp-inc-raising-an-agent-stop-boxing-in-your-agent-season-2-episode-5.txt:6
[v44]: /Users/noah/code/sofort/arch/research/corpus/transcripts/44-ai-engineer-stop-guessing-your-vllm-config-benchmarking-llms-on-runpod.txt:5
[v45]: /Users/noah/code/sofort/arch/research/corpus/transcripts/45-ai-engineer-we-kept-rebuilding-our-ai-agent-here-s-what-survived-fuad-.txt:12
[v50]: /Users/noah/code/sofort/arch/research/corpus/transcripts/50-latent-space-how-anthropic-ships-the-1-llm-in-the-world-with-katelyn-l.txt:1
[v51]: /Users/noah/code/sofort/arch/research/corpus/transcripts/51-latent-space-orbs-shifting-coding-to-cloud-quinn-slack-amp-code.txt:30
[v52]: /Users/noah/code/sofort/arch/research/corpus/transcripts/52-latent-space-exo-harnesses-should-see-their-own-code-and-logs-alex-kre.txt:7
[v55]: /Users/noah/code/sofort/arch/research/corpus/transcripts/55-syntax-wtf-is-a-software-factory.txt:12
[v58]: /Users/noah/code/sofort/arch/research/corpus/transcripts/58-syntax-jev-explained-demos-and-use-cases.txt:16
[v62]: /Users/noah/code/sofort/arch/research/corpus/transcripts/62-hyperfixation-on-ai-beamnxw-andrej-karpathy-99-use-ai-llms-wrong-here-.txt:1
[v63]: /Users/noah/code/sofort/arch/research/corpus/transcripts/63-fragmented-ai-developer-podcast-311-self-learning-harnesses-are-here-a.txt:4
[v64]: /Users/noah/code/sofort/arch/research/corpus/transcripts/64-ai-engineer-routing-llm-inference-in-production-from-engine-signals-to.txt:10
[v65]: /Users/noah/code/sofort/arch/research/corpus/transcripts/65-ai-engineer-the-state-of-model-routing-nvidia-cognition-openrouter.txt:18
[v66]: /Users/noah/code/sofort/arch/research/corpus/transcripts/66-ai-engineer-is-the-agent-harness-dead-jediah-katz-spacexai.txt:20
[v67]: /Users/noah/code/sofort/arch/research/corpus/transcripts/67-ai-engineer-homa-the-end-of-tcp-for-ai-clusters-john-ousterhout-stanfo.txt:7
[v71]: /Users/noah/code/sofort/arch/research/corpus/transcripts/71-claude-live-coding-session-with-boris-cherny-and-jarred-sumner.txt:15
[v72]: /Users/noah/code/sofort/arch/research/corpus/transcripts/72-claude-how-factory-is-building-autonomous-software-with-claude.txt:12
[v74]: /Users/noah/code/sofort/arch/research/corpus/transcripts/74-claude-inside-shopify-s-ai-strategy-with-cto-mikhail-parakhin.txt:14
[v76]: /Users/noah/code/sofort/arch/research/corpus/transcripts/76-cncf-cloud-native-computing-foundation-the-noisy-neighbour-inside-your.txt:8
[v77]: /Users/noah/code/sofort/arch/research/corpus/transcripts/77-cncf-cloud-native-computing-foundation-vendor-neutral-gpu-observabilit.txt:11
[v78]: /Users/noah/code/sofort/arch/research/corpus/transcripts/78-ai-engineer-move-fast-and-don-t-break-things-scaling-databases-for-the.txt:9
[v80]: /Users/noah/code/sofort/arch/research/corpus/transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt:87
[v82]: /Users/noah/code/sofort/arch/research/corpus/transcripts/82-armin-ronacher-state-of-agentic-coding-10-with-armin-and-ben.txt:101
[v85]: /Users/noah/code/sofort/arch/research/corpus/transcripts/85-theo-t3-gg-the-hard-truth-about-token-spend.txt:15
[v86]: /Users/noah/code/sofort/arch/research/corpus/transcripts/86-theo-t3-gg-these-3-skills-changed-my-life.txt:14
[v87]: /Users/noah/code/sofort/arch/research/corpus/transcripts/87-theo-t3-gg-anthropic-rebuilt-git-yes-really.txt:8
[v88]: /Users/noah/code/sofort/arch/research/corpus/transcripts/88-theo-t3-gg-you-can-rewrite-typescript-in-rust-for-420k.txt:46

## 7. Ranked project table

**E/I:** score vectors use the six criteria in §5. “Conditional” is a bounded opening after close prior art, not a claim that nobody has built it. A low gap score can still justify a useful upstream contribution. Hardware/operator access and a credible maintainer destination break ties.

| Rank | Project | Size / delivery | I — residual status | E — six scores | Total / 30 | Decisive next gate |
|---:|---|---|---|---|---:|---|
| 1 | **P01 Operator model-retirement rehearsal** | Big / weeks with an operator | Open, conditional; broad migration Shipped | 4 / 4 / 3 / 4 / 5 / 5 | 25 | One real catalog decision and capacity/demand snapshot. |
| 2 | **P02 Offline classifier parity corpus** | Small desktop slice / Tiny device fixtures | Open, conditional; models/runtimes Shipped | 4 / 5 / 2 / 4 / 4 / 5 | 24 | One actual private task plus a pinned real-device export. |
| 3 | **P03 GPU telemetry upgrade fixtures** | Tiny upstream contribution | Being built by owners; uncovered transition conditional | 4 / 3 / 3 / 4 / 5 / 5 | 24 | Maintainer names a missing supported upgrade case. |
| 4 | P04 Subsidy-exit temporal usage replay | Small / existing accounting mode | Open, conditional; monitors Shipped | 3 / 5 / 2 / 4 / 5 / 5 | 24 | Existing tools cannot replay the owner's dated policy scenario. |
| 5 | P05 Paired-environment routing benchmark | Tiny / benchmark contribution | Open, conditional; live routing benchmarks Shipped | 4 / 5 / 2 / 4 / 4 / 5 | 24 | Confirm environment intervention absent from TwinRouterBench. |
| 6 | P06 Compaction/resume cache fixtures | Tiny / SDK-harness contribution | Open, conditional; close fix Shipped | 3 / 5 / 2 / 4 / 4 / 5 | 23 | Reproduce an unfixed transition with current versions. |
| 7 | P13 Restart settings receipt | Tiny / adapter and conformance fixture | Open, conditional; related reports active | 3 / 5 / 2 / 3 / 5 / 5 | 23 | Demonstrate an observable meaningful discrepancy. |
| 8 | P16 Fixed/expanded-scope outcome-cost study | Tiny / dataset and blog | Open, conditional; analytics/evals Shipped | 4 / 4 / 2 / 4 / 4 / 5 | 23 | Tasks, scope tags and human effort can be recorded honestly. |
| 9 | P07 Concurrent hybrid-cache corpus | Tiny / engine contribution | Open, conditional; direct serial recovery research exists | 4 / 2 / 2 / 4 / 5 / 5 | 22 | Maintainer identifies an uncovered lifecycle edge and GPU access. |
| 10 | P11 Rare-event coverage/escalation audit | Small / report over an existing detector | Open, conditional; detection/distillation Shipped | 3 / 4 / 2 / 4 / 4 / 5 | 22 | Representative sampled/excluded traffic and labels exist. |
| 11 | P10 Cross-silicon product parity fixtures | Tiny / runtime contribution | Open, conditional; broad stack Shipped/Roadmap | 4 / 2 / 2 / 4 / 5 / 5 | 22 | A real backend discrepancy with a semantic oracle. |
| 12 | P08 Speculative length/domain diagnosis | Tiny / benchmark or null-result study | Open, conditional; close studies already published | 4 / 3 / 2 / 3 / 4 / 5 | 21 | Access to the claimed cliff configuration or a clearly distinct one. |
| 13 | P09 Application coordination-tax diagnosis | Big / cluster study; Ambiguous without access | Transport Shipped; application attribution conditional | 5 / 2 / 2 / 4 / 5 / 5 | 23 | A measured short-RPC application bottleneck and matched baseline. |
| 14 | P17 Ambient heartbeat cost census | Tiny / trace report | Open, conditional; routing/scheduling Shipped | 2 / 5 / 2 / 3 / 5 / 5 | 22 | Owner can distinguish useful quiet checks from avoidable work. |
| 15 | P14 Workload-fit local quantization recipe | Tiny / reproducible recipe and data | Open, conditional; autotuners/recipes Shipped | 3 / 3 / 2 / 3 / 4 / 5 | 20 | An uncovered combination on hardware already available. |
| 16 | P12 Shim-retirement exposure report | Small / existing ablation extension | Open, conditional; ablation and retirement bot exist | 3 / 5 / 2 / 3 / 3 / 5 | 21 | Historical trigger exposes a real difference missed by current suites. |
| 17 | P15 Artifact/license change receipt | Tiny / manifest adapter | Open, weak; checks and alerts Shipped | 2 / 4 / 2 / 3 / 5 / 5 | 21 | Exact deployed lineage is missing in existing exports. |
| 18 | P18 Latent-state switching contract | Ambiguous / contract investigation | Offload Shipped; semantic portability unresolved | 5 / 3 / 1 / 3 / 3 / 5 | 20 | Exposed engine state and a user need beyond text-history export. |

### Top 3

1. **P01 — Operator model-retirement rehearsal.** The unusual direct signal is a serving operator trapped between user attachment and GPU residency. ModelShift/EvalShift address the client's model replacement; AIConfigurator addresses deployment choices. Their joint residual is whether an acceptable migration actually frees a deployable unit of capacity. It has the best conceptual gap, but only one direct operator source. Obtain the operator case before spending weeks.
2. **P02 — Offline classifier parity corpus.** This has the clearest individual-builder fit and explicit private-machine/phone demand. Deep research kills the missing-open-model thesis: JS and Core ML paths now exist. A useful outcome may be ten good fixtures or one mobile export correction, which is enough. Begin with desktop hardware already owned; expand only with a real device/user.
3. **P03 — GPU telemetry upgrade fixtures.** This directly matches an operator complaint and survives better models. The intended outcome is a maintainer-accepted test that preserves meaning through one upgrade, rather than a product competing with HAMi/OTel. It needs hardware/maintainer access; if that gate fails, P04 is the strongest software-only alternate.

### Most surprising signal

**Q:** Michelle says users get attached to a model and it “just sits there eating up GPU space” ([12, 27:00][v12]). **I:** model preference can create a physical capacity-retirement problem even when newer models are more efficient. Keeping the old endpoint available is not always a near-zero-cost compatibility promise. That makes P01 more interesting than another migration calendar, while its single-operator evidence keeps the recommendation conditional.

**F/I — Surprising economic cross-check:** the October Cloudflare cache report in §1.3 also overturns an easy shortcut: excellent cache-hit percentage does not establish a small context bill. Workload shape can matter more than the top-line cache percentage.

### TL;DR

1. **I:** higher inference prices strengthen waste-reduction and serving-efficiency work; alone they make small agent-VM savings less material.
2. **I:** model retirement tied to genuinely reclaimable GPU capacity is the strongest conditional larger project; verify one operator case.
3. **I:** offline classifier demand is concrete, but open models/JS/native exports already exist; contribute task/device parity evidence.
4. **I:** GPU metric upgrade fixtures, cache transitions and environment-aware router cases fit upstream work; generic platforms are taken.
5. **I:** keep all 18 projects and 97 grouped forecasts, but spend only after their access/prior-art gates pass; no universal price trajectory or model winner is established.
