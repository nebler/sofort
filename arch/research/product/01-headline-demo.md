# Hardware and the million-VM headline

Research date: **2026-10-28**. Scope: the **Hardware** gap and order item 1 in [PRODUCT-GAPS](../../PRODUCT-GAPS.md). Source checkout: `08732694e2e00dc00a7e15db0f3db413a6fa1bb5`. This is research, not a new benchmark: no VM was started, no account created, and no purchase, deployment or outreach performed.

**F — Workspace freshness:** unrelated implementation edits and merge conflicts appeared in the shared checkout during research, including the jitk root Makefile/README and nested runner. This report changed only this file. Code observations describe the inspected revision/files; the proposed reproduction procedure needs a resolved, pinned checkout before execution. No clean-build claim is made here.

Labels throughout: **F** = sourced fact, including inspected source code; **M** = existing repo measurement, attributed to its original run; **I** = inference or recommendation; **E** = estimate or arithmetic, not a measurement. All quoted cloud rates are **USD, excluding tax**, unless explicitly marked EUR. Price/offer observations are dated **2026-10-28**; their publication timestamps are given where available. A published price is not a capacity reservation.

## Decision

**I — Fill the bare-metal gap before promising a million resident VMs.** Spend 1–2 engineer-days making the existing Linux ledger portable, then book one short Ampere run and one Graviton confirmation. An Amsterdam or Singapore **phoenixNAP `a1.c5.large`, 80 cores / 256 GB, costs $0.99/hour**; six billed hours are **$5.94** before IP/tax. A two-hour **AWS `c7g.metal` us-east-1** confirmation is **$4.64** compute. Budget **$15–25 total**, including incidental storage/IP and a little rerun time. These prices were checked today against the providers' own data; setup and account approval can cost more time than the servers. Sources: [phoenixNAP pricing](https://phoenixnap.com/bare-metal-cloud/instances), [its public pricing JSON](https://phoenixnap.com/wp-content/themes/bootscore-child/cache/api-data.json), [AWS regional feed](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/US%20East%20%28N.%20Virginia%29/Linux/index.json).

**I — The attainable headline has three separate stages:**

1. **Now, after a small receipt/counter harness:** “One million isolated executions, using at most N resident VM slots.” If using the shard, say the slots are reset and reused. This is a cumulative execution claim.
2. **Next, after a metal density/wake test:** “10,000 distinct KVM guests parked on tool calls on one server; here is a challenge answered by each.” This tests the interesting thread-free waiting behavior without requiring a giant machine.
3. **Conditional stretch:** “1,000,000 distinct KVM guests simultaneously retained in RAM on one ARM server, with X verified at WAIT and Y successful wakes.” This needs new orchestration, OS-limit work, and direct evidence at the actual count. A 768 GiB–1 TiB host is a plausible experiment, not a demonstrated capacity result.

**F/I — “A million VMs” is already occupied territory.** Unikraft published a **scaled-to-zero**, single-server million-instance demonstration on **2026-05-18**, and Modal published a **fleet-wide concurrent million-sandbox** demonstration on **2026-07-16**. Sofort's useful distinction would be a reproducible **resident KVM-object count, tiny touched working set, and thread-free tool wait**, on a named host, rather than the round number alone. [Unikraft](https://unikraft.com/blog/1m-vms-single-box), [Modal](https://modal.com/blog/scaling-to-1-million-concurrent-sandboxes-in-seconds).

## 1. What the current tree can actually run

### Evidence order and stale context

**F — Context read:** [demo.md](../../../demo.md), the value/hosting/agentic/economics/pitch and four demo reports in [pitch/01–09](../pitch/), [landscape](../landscape.md), [Cloudflare](../cloudflare.md), the relevant systems/distributed and propose/check TL;DRs in [flip](../flip/) and [flip2](../flip2/), [perf/SUMMARY](../perf/SUMMARY.md), [R9 architecture review](../../review/R9-ARCH-QUALITY.md), the current benchmark code and ledgers, and [kernel/ARCH.md](../../jitk/kernel/ARCH.md). This report adds hardware procurement, claim definitions, scaling limits and a protocol; it does not redo the product pitch.

**F/M — Several earlier documents are stale in ways that affect this headline:**

| Earlier framing | What replaces it on 2026-10-28 |
|---|---|
| `perf/SUMMARY.md` next step: port the real kernel to the shard; 0.55–0.65 MiB projected | The port exists. The newer same-host ledger measures **0.515 MiB `return2`, 0.535 MiB one-tool** for the shard; full Node executor **0.657/0.665 MiB**. |
| Old pitch/economics: 10.7 MiB process footprint; all snapshots/thread-free wait are planned | Those describe the old Mac process layout. The Linux shard has shared prepared snapshots, reset, and thread-free WAIT. Arbitrary mid-tool persistent snapshots, cross-host migration and “pull the plug” are still separate work. |
| “Fresh VM per invocation” applied uniformly | The libkrun pool retires VM processes. The shard reuses a **KVM VM/vCPU object** after restoring guest state and changing generation/entropy. Count new KVM objects separately from reset executions. |
| Hyperlight 1.8 MiB versus jitk ~0.5 MiB | Cross-platform/process-layout comparison. On matched nested Linux, Hyperlight is **0.495/0.527 MiB**, slightly lower than jitk. No density moat is established. |
| `demo.md` “a million computers for a nickel” | Old ideal CPU allocation, not a million-resident run or an actual server invoice. Retire it as a purchase-price slogan. |
| Old hosting suggestions: Hetzner RX and Equinix Metal | RX is currently unavailable; Metal sunset **2026-06-30**. See §2. |
| R9 review's rotted snapshot paths and double reset | Current `shard/snapshot.ts` and `Makefile` provide cache snapshots; copy-restore work removed the duplicate reset. The review remains useful for remaining containment/parity debt, not as a verbatim current status list. |

Sources for the new measurements: [same-host memory, 2026-10-27](../../jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md), [copy-restore, 2026-10-28](../../jitk/bench/RESULTS-copy-restore-2026-10-28.md). Source for current snapshot setup: [snapshot.ts](../../jitk/shard/snapshot.ts). The public-provider status is sourced below.

### Runnable surfaces and their limits

**F — This is aarch64 software today.** The real shard binary explicitly requires **Linux arm64**. `kernel/ARCH.md` describes a completed architecture boundary, not an x86 backend. Its estimate for x86 with the shard is **33–52 engineer-days**. Renting cheap x86 bare metal does not unblock this week's experiment. [real.rs](../../jitk/shard/src/bin/real.rs), [ARCH.md](../../jitk/kernel/ARCH.md).

**F — The existing measurement entry points are useful:**

- `real bench BASE return2|one_tool|promise10 N`: sequential reset/bind/run on one slot, with phase statistics.
- `real hold BASE ready|return2|one_tool|wait N SECONDS`: N distinct KVM guests; retained READY, completed, or WAIT state depends on the fixture. `wait` subsequently resumes each guest and checks the result.
- `real stress ...`: reset/canary/entropy/cross-talk tests; this mode uses at most **64 slots**, regardless of a larger run count.
- `real idle ...`: released-slot memory before/after trimming, a different state from a guest still blocked on its tool call.
- `bench/linux-memory`: cgroup ledger over real holders plus matched Hyperlight configurations.
- `executor/shard-bench.ts`: actual one-tool `execute()` timing and Node/shard/watchdog CPU; 5 warmups, sequential calls, and drain between calls.

Sources: [CLI](../../jitk/shard/src/bin/harness/mod.rs), [driver](../../jitk/shard/src/bin/harness/driver.rs), [ledger plan](../../jitk/bench/linux-memory/plan.json), [executor benchmark](../../jitk/executor/shard-bench.ts).

**F — A million cannot be passed to the current production interface.** Both [ShardBackend](../../jitk/executor/shard-backend.ts) and [IPC service](../../jitk/shard/src/ipc_service.rs) cap slots at **64** and owners at **4**. The lower [owner pool](../../jitk/shard/src/owner.rs) asserts **slots ≤16,384**. [raise_fds](../../jitk/shard/src/kvm/platform.rs) sets **both** soft and hard `RLIMIT_NOFILE` to **65,536**, so a shell setting alone cannot give that process two million fds. These are software choices, not KVM architectural limits.

**M — The baseline that a public claim may quote today:**

| Measurement | Existing result | Boundary |
|---|---:|---|
| Shard, `return2` / one-tool memory slope | **0.515 / 0.535 MiB/VM** | Nested Linux, 4 KiB pages; N≤256; excludes shared files warmed outside the cell, includes charged kernel memory. |
| Full executor memory slope, same workloads | **0.657 / 0.665 MiB/VM**, plus ~35 MiB fixed | Nested Linux; N≤64; Node included. |
| One-tool `execute()` p50 / p99 | **1.10 / 1.86 ms** | 3×300-run nested measurements; result resolution, not full cold process creation. |
| One-tool CPU, Node + shard + watchdog | **1.72 CPU-ms/run** | Same nested study; phase/lifecycle details in its receipt. |
| Sequential one-slot throughput | **691 runs/s** median | Nested, already-created/reset slot; not 691 new KVM objects/s. |
| Multi-slot throughput | **Bimodal; ~220–245 or ~1,700–4,700 runs/s** in reported cells | Unresolved nesting/MMU-notifier behavior. Do not select the fast repetition as the headline. |

**I — The missing measurement is not merely “run the same command on AWS.”** The current driver and `shard-bench.ts` hard-code `nested:true` in emitted environment/summary records. A metal harness must correct the environment declaration, preserve the original output, and record the real host independently. Fresh snapshots must be prepared **on the target machine**: current snapshot register coverage is checked against the actual vCPU, and the copied nested-host state is not a portable boot artifact.

**I — Minimal work estimate:** 0.5–1 day for portable paths, pinned build/snapshot instructions and environment receipts; 0.5–1 day for a quiet metal sweep and reduction. This is the cheapest credible way to close **Hardware: no bare-metal numbers**, and it unlocks the CV/talk/post immediately. It does not require packaging a public multi-tenant service.

## 2. Where to obtain ARM bare metal briefly

### 2.1 AWS: dated hourly rates and a sensible booking

**F — Exact names matter.** `c7g.metal` is 64 cores / 128 GiB. Graviton4 uses `c8g.metal-24xl` (96 / 192 GiB), `c8g.metal-48xl` (192 / 384 GiB), `m8g.metal-24xl` (96 / 384 GiB), and `m8g.metal-48xl` (192 / 768 GiB). There is no need to guess a type named merely `c8g.metal`. A dedicated-vCPU VM or a Dedicated Host containing VMs is not a replacement for a metal instance exposing EL2. [Compute specifications](https://docs.aws.amazon.com/ec2/latest/instancetypes/co.html), [general-purpose specifications](https://docs.aws.amazon.com/ec2/latest/instancetypes/gp.html), accessed 2026-10-28.

**F — Linux On-Demand / listed regional Spot, USD per hour, fetched 2026-10-28:**

| Instance | us-east-1 Virginia OD / Spot | eu-central-1 Frankfurt OD / Spot | eu-north-1 Stockholm OD / Spot | ap-southeast-1 Singapore OD / Spot |
|---|---:|---:|---:|---:|
| `c7g.metal`, 128 GiB | **2.32000 / 0.6328** | **2.63840 / 0.8376** | **2.47550 / 0.2825** | **2.66560 / 0.8090** |
| `c8g.metal-24xl`, 192 GiB | **3.82848 / 0.6310** | **4.35360 / 0.8259** | **4.08480 / 0.4085** | **4.39872 / 1.0992** |
| `c8g.metal-48xl`, 384 GiB | **7.65696 / 0.9262** | **8.70720 / 1.5446** | **8.16960 / 0.8170** | **8.79744 / 1.1202** |
| `m8g.metal-24xl`, 384 GiB | **4.30848 / 1.0867** | **5.16192 / 0.9469** | **4.57824 / 0.4578** | **5.38560 / 1.9157** |
| `m8g.metal-48xl`, 768 GiB | **8.61696 / 2.4226** | **10.32384 / 1.9216** | **9.15648 / 0.9156** | **10.77120 / 1.8424** |

Primary On-Demand feeds: [Virginia](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/US%20East%20%28N.%20Virginia%29/Linux/index.json), [Frankfurt](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/EU%20%28Frankfurt%29/Linux/index.json), [Stockholm](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/EU%20%28Stockholm%29/Linux/index.json), [Singapore](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/Asia%20Pacific%20%28Singapore%29/Linux/index.json). Their manifest publication time was **2026-10-27T19:30:04Z**. Each row was selected by exact `Instance Type`, Linux, no preinstalled software.

Primary Spot source: [AWS live regional `spot.json`](https://website.spot.ec2.aws.a2z.com/spot.json), HTTP `Last-Modified: Wed, 28 Oct 2026 12:01:44 GMT`. The numbers above are its Linux regional listing, **not a verified AZ-specific launch price or available capacity**. A useful search result is not enough here: the older `spot-price.s3.amazonaws.com/spot.js` endpoint still served a **2024-05-13** file during this research and must not be used as a current quote.

**I/E — Purchase choices:**

- **Repeatable first Graviton benchmark:** 2–4 hours c7g.metal On-Demand, Virginia: **$4.64–9.28 compute**. Frankfurt costs **$5.28–10.55** for the same block; location does not affect locally measured guest latency. Choose whichever has quota/capacity.
- **Cheapest listed AWS practice run:** Stockholm c7g.metal Spot, 4 hours **$1.13 compute** at today's listing. It is appropriate for interruption-tolerant rehearsal and raw-log collection. A cheaper listing is not grounds to wait days for stock.
- **Resident-million attempt:** 6 hours m8g.metal-48xl Virginia On-Demand **$51.70**; Stockholm Spot **$5.49** at today's listing, or Stockholm On-Demand **$54.94**. Prefer On-Demand for the final uninterrupted evidence run, or record a failed Spot attempt honestly and retry later.
- **Do not buy a c8g.metal-48xl for its 192 cores expecting one million 0.5 MiB residents.** Its 384 GiB is insufficient. The 768 GiB m8g is the relevant size. For density, paying for RAM is more useful than extra compute alone.

**F/I — Terms that change the “briefly” bill:** AWS Linux On-Demand is billed by the second with a **60-second minimum**. Provisioning, setup, and warmup still consume paid running time. EBS boot volumes, retained volumes, public IPv4 and exported logs/egress are separate; budget **$1–3** incidentals for a short run rather than pretending compute is the entire invoice. Delete/terminate temporary resources after evidence export. [AWS billing](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-on-demand-instances.html), accessed 2026-10-28; incidental amount is **E**, not a tariff quote.

**F — Quota can block every offer above.** AWS's current quota table lists **5 Standard vCPUs** by default for both On-Demand and Spot. Actual account quotas vary, and the two purchasing options are separate. c7g.metal needs 64, the largest m8g 192. Credits do not grant quota or capacity. [AWS quotas](https://docs.aws.amazon.com/ec2/latest/instancetypes/ec2-instance-quotas.html), accessed 2026-10-28.

**F/I — Spot is interruptible.** AWS normally issues a two-minute warning, on a best-effort basis. Stream compact receipts off-host, mark interruption as a failed/incomplete trial, and keep the final evidence capture locally playable. No assumption that Sofort can migrate a live guest is needed. [AWS interruption contract](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-instance-termination-notices.html), accessed 2026-10-28.

### 2.2 Other providers: genuine options and false bargains

| Provider / offer | Evidence and dated price/status | Fit and solo-engineer cost |
|---|---|---|
| **phoenixNAP BMC, `a1.c5.large`** | **F, 2026-10-28:** Ampere Altra Q80-30, 80 cores, 256 GB, 2×2 TB NVMe, **$0.99/hour**. Public JSON lists PHX, ASH, NLD, SGP, CHI, SEA; these are advertised locations, not stock confirmations. | **I:** Best stable low-cost short rental found for the baseline. Amsterdam for Germany; Singapore for a remote KL demo. **E:** 6 billed hours $5.94; allow 0.5–2 days for account/provisioning friction, then 1–2 engineering days. |
| **phoenixNAP `a1.c5.xlarge`** | **F, 2026-10-28:** same CPU/RAM, 2×4 TB, **$1.09/hour**. | More disk does not help a RAM-resident claim; use only if the cheaper type is unavailable. |
| **Oracle `BM.Standard.A1.160`** | **F:** 160 OCPUs/cores, 1024 GB advertised RAM, Altra Q80-30. **E:** list-rate compute **160×$0.01 +1024×$0.0015 = $3.136/hour**, before allowances. Rate SKUs checked 2026-10-28; see next subsection. | **I:** Most attractive large-memory alternative, especially with unused A1 allowance. Quota, paid-account access, region stock and a 4 KiB host kernel must be established. **E:** 2–4 days setup/measurement if access works; do not make it the only booked stage-demo host. |
| **Oracle A2** | **F, current shape list:** `VM.Standard.A2.Flex`, up to 78 OCPUs /946 GB; **no BM.Standard.A2 listed**. A2 OCPU is two physical cores. | A large ARM VM is not bare metal. Do not invent an A2 metal price or infer nested KVM from the CPU model. The current newer metal alternative is **A4**, below. |
| **Oracle `BM.Standard.A4.48`** | **F:** 48 OCPUs =96 cores, 768 GB, AmpereOne M. **E, 2026-10-28:** 48×$0.0138 +768×$0.0027 = **$2.736/hour**. | Plausible current large-memory substitute. Newer microarchitecture is useful diversity, but availability and snapshot/feature support are untested. No A1 allowance should be applied to A4. |
| **Hetzner RX170 / RX220** | **F, checked 2026-10-28:** RX page says no RX servers currently offered; documentation calls them former models. Historical launch **2022-07-19:** €169/€219 per month plus setup, 128/256 GB. | **I:** Not a present procurement route. Do not turn the historical monthly rate into a rentable hourly quote. CAX is virtualized cloud, not RX bare metal. |
| **OVHcloud** | **F, 2026-02-09 release and current catalog search:** new 2026 bare-metal range uses AMD Ryzen/EPYC. No orderable ARM bare-metal SKU with a primary price was found on 2026-10-28. | **I:** No usable ARM quote established. x86 value is irrelevant until the port; contact/quote work can wait. This is a bounded search finding, not a claim OVH can never supply ARM. |
| **Scaleway** | **F, checked 2026-10-28:** current Elastic Metal table lists Intel/AMD; e.g. **EM-A610R-NVMe is AMD Ryzen**, despite the “A”. Current Ampere products are Instances such as STANDARD2-A. No ARM Elastic Metal quote established. | **I:** Reject as a verified ARM-metal route. The old ARM bare-metal cloud and today's ARM VMs must not be conflated. “Dedicated vCPU” still does not prove EL2 access. |
| **Equinix Metal / Packet** | **F:** Metal sunset **2026-06-30**, according to Equinix docs and 2026 10-K. Arm's Works on Arm page still mentions it. | **I:** Remove from the actionable shortlist. A surviving web page or old GitHub issue template is not an allocation service. |
| **Latitude.sh, Cherry Servers and other Metal successors** | **F:** Latitude markets Metal migration; Cherry's advertised **Cloud ARM VDS** is explicitly virtual dedicated, AmpereOne. No suitable hourly ARM-metal quote was verified for these two. | **I:** General Equinix alternatives are not necessarily ARM alternatives. phoenixNAP and OCI are the concrete matches found. Do not book a VDS to produce bare-metal receipts. |
| **RedSwitches ARM** | **F, 2026-10-28:** made-to-order Q80-30 /128 GB Amsterdam advertised **$540.97/month**; Singapore **$642.68/month**. | Genuine ARM-dedicated option, poor short-run economics; no verified prorated-hour cancellation offer. Reject for this budget. |

Primary sources: [phoenixNAP pricing/data](https://phoenixnap.com/wp-content/themes/bootscore-child/cache/api-data.json), [Oracle shapes](https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm), [Hetzner RX status](https://www.hetzner.com/dedicated-rootserver/matrix-rx/), [former RX documentation, changed 2026-06-15](https://docs.hetzner.com/robot/dedicated-server/server-lines/apple-rx-server/), [Ampere/Hetzner historical launch](https://amperecomputing.com/en/press/hetzner-first-european-hoster-with-ampere-altra-based-dedicated-servers), [OVH release](https://corporate.ovhcloud.com/en/newsroom/news/ovhcloud-bare-metal-2026-amd/), [Scaleway metal pricing](https://www.scaleway.com/en/pricing/elastic-metal/), [Scaleway ARM instance specifications](https://www.scaleway.com/en/docs/instances/reference-content/instances-datasheet/), [Equinix sunset notice](https://docs.equinix.com/metal/libraries/cli/), [Equinix 2026 10-K](https://investor.equinix.com/sec-filings/current-reports/content/0001101239-26-000032/0001101239-26-000032.pdf), [Latitude's migration offer](https://www.latitude.sh/blog/best-equinix-metal-alternatives-you-should-know-about), [Cherry ARM VDS](https://www.cherryservers.com/virtual-servers/cloud-arm-vds), [RedSwitches](https://www.redswitches.com/arm-dedicated-servers/). All accessed 2026-10-28.

**F — phoenixNAP bills incomplete hours as complete hours, minimum one hour per deployment; powering off does not stop billing, deleting does.** Thus a 70-minute capture costs two server-hours, not 70/60 hours. Use the hourly plan, not a month reservation. [Billing policy](https://phoenixnap.com/kb/phoenixnap-bare-metal-cloud-billing-models), accessed 2026-10-28.

### 2.3 Oracle's particularly useful distinction: free A1 usage versus a free-tier VM

**F — The current Oracle price list states that each paid tenancy gets the first 3,000 A1 OCPU-hours and 18,000 GB-hours monthly free, shared across bare metal, VMs and container instances.** Its official rate API returned these SKUs on 2026-10-28 (`lastUpdated=2026-10-08T14:38:16.165Z`):

| SKU | Metric | USD rate after allowance |
|---|---|---:|
| `B93297` A1 | OCPU-hour | **0.0100** |
| `B93298` A1 memory | GB-hour | **0.0015** |
| `B109529` A2 | OCPU-hour | **0.0140** |
| `B109530` A2 memory | GB-hour | **0.0020** |
| `B112145` A4 | OCPU-hour | **0.0138** |
| `B112146` A4 memory | GB-hour | **0.0027** |

Sources: [Oracle price list and paid-tenancy footnote](https://www.oracle.com/cloud/price-list/), [official rate API](https://apexapps.oracle.com/pls/apex/cetools/api/v1/products/), accessed 2026-10-28. Oracle labels advertised memory “GB”; inspect `/proc/meminfo` and use bytes/GiB in the benchmark rather than silently treating the commercial label as measured usable RAM.

**E — If the full A1 allowance is unused and the BM shape is admitted**, it covers `min(3000/160, 18000/1024)` = **17.58 host-hours** of A1 compute/memory. A six-hour run consumes 960 OCPU-hours and 6,144 GB-hours, so its compute charge could be **$0**; this is an entitlement calculation, not a successful reservation. Boot volumes/IP/egress and already-used allowances remain separate. Without the allowance six hours are **$18.82** compute at the list rates above.

**F/I — Do not sell that as “Oracle gives everyone a free 1 TiB server.”** Always Free VM limits, paid-account allowances and bare-metal service limits are different. Oracle's current Free Tier document even gives a smaller post-trial A1 retention limit than many old 4-core/24-GB tutorials. A free ARM VM does not establish nested KVM access. Obtain the BM quota and capacity explicitly in the intended region; Frankfurt, Ashburn or Singapore are sensible regions to investigate, not capacity checked by this report. [Free Tier documentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm), [Arm compute documentation](https://docs.oracle.com/en-us/iaas/Content/Compute/References/arm.htm), accessed 2026-10-28.

**F — OCI bare metal has a one-hour minimum, then per-second billing.** That is still well suited to a six-hour experiment. [Oracle billing release note](https://docs.oracle.com/en-us/iaas/releasenotes/changes/20facdce-34bf-4648-a0a7-de5db73657ce/index.htm), release 2020-04-15, updated 2024-07-29, checked 2026-10-28.

### 2.4 Free hardware, developer and credit programs

**I — Apply opportunistically; do not make a $10 experiment wait for a grant.** These routes unlock second-machine reproduction and future CI more than they reduce the cost of one video. The following are application suggestions, not applications sent during this task.

| Route | Current primary offer / constraint, checked 2026-10-28 | Money and time estimate; next thing unlocked |
|---|---|---|
| **Ampere remote trial / developer program** | **F:** live remote-trial form asks duration (2, 3, 4+ weeks), platform and special configuration. It also has a university/organization physical-system request section. No guaranteed allocation, RAM size or approval SLA is published. | **E:** 30–60 min application; 1–3 weeks assumed waiting, explicitly not an SLA; request a no-fee 2-week remote loan. Ask for dedicated Altra/Altra Max, ≥256 GB, root/EL2, Ubuntu/Debian 4 KiB pages, permission to publish. This can provide the independent metal machine. |
| **Arm Works on Arm / Developer Program** | **F:** free cloud/CI access initiative; current page links AWS, GitHub and OSU, but also stale Equinix material. Developer Program membership itself supplies tools/labs/community, not a guaranteed bare-metal credit balance. | **E:** 0.5 day to prepare a specific reproduction brief; $0 hardware if accepted, uncertain turnaround. Ask for a timed metal slot, not generic “ARM access”. |
| **GitHub ARM hosted runners** | **F:** public-repository Linux/Windows ARM runners became GA 2025-08-07 and are free for the documented public-repo use. Current docs do not promise nested virtualization; general hosted-runner nested use is unsupported. | **I:** useful for compile/unit tests; **not a metal benchmark**. Probe `/dev/kvm` only for the narrower functional-CI question. Private repo billing/eligibility differs. No million-resident plan here. |
| **OSU Open Source Lab AArch64** | **F:** invites open-source projects; primary offering is an OpenStack/KVM VM cluster and explicitly says it is not ideal for performance tests. | **E:** 0.5 day request, unknown queue; $0 if accepted. Good independent build/functional CI. Dedicated-host access needs a separate explicit arrangement. |
| **AWS Activate Founders** | **F:** current startup page: start with **$1,000**, selected self-funded startups can reach **$5,000**; company website, <10 years, and eligibility required; published decision window **5–10 business days**. Portfolio now advertises up to **$200,000**, requires provider Org ID. | **E:** 1–2 h application; don't invent an eligible startup/company for a CV project. If eligible, $1,000 covers ~431 c7g.metal hours at today's Virginia OD compute rate. Separate quota/capacity still required. |
| **AWS free-tier credits** | **F:** current offer advertises **$100 at signup plus up to $100 earned**. This is not a commitment that the free plan admits a 64/192-vCPU metal instance. | **I:** an offset if already eligible; check paid-plan/service restrictions and quota. Do not substitute free T4g VMs for metal. |
| **Oracle trial / Arm Accelerator** | **F:** trial advertises **$300 for 30 days** on eligible services; Arm Accelerator has a live application for credits for A1 projects, without a fixed award amount on the form. | **E:** 1 h request and potentially days of account/quota work; amount beyond trial unknown. Ask specifically whether it can cover BM.A1, its boot volume and required shape limits. |
| **Oracle for Startups** | **F:** current European **Startup Growth Engine** selects validated products/pilots and tailors incentives. It does **not** promise the old global “$500 +70% off for two years” package on its current page. | **I:** low fit before users/pilots; don't plan this week's experiment against an old startup-perks listing. Future partner route after demand. |
| **University / research lab** | **F:** AWS Cloud Credits for Research accepts benchmark/proof-of-concept proposals; Chameleon has reservable bare metal including ARM; CloudLab documents ARM X-Gene machines with KVM known to work. PI/project eligibility and permission are required. | **E:** 0.5–1 day joint brief, 1–4 weeks institutional lead time; $0 cash if allocated. Useful co-reproduction, not personal entitlement to a university's machines. Chameleon advertises project decisions within one business day after eligible application; actual node availability is separate. |

Primary program sources: [Ampere trial](https://amperecomputing.com/en/where-to-try), [Ampere developer center](https://amperecomputing.com/developers), [Works on Arm](https://www.arm.com/markets/cloud-ai/works-on-arm), [Arm Developer Program](https://developer.arm.com/arm-developer-program), [GitHub announcement](https://github.blog/changelog/2025-08-07-arm64-hosted-runners-for-public-repositories-are-now-generally-available/), [GitHub runner limitations](https://docs.github.com/en/actions/concepts/runners/github-hosted-runners), [OSU AArch64](https://osuosl.org/services/aarch64/), [Activate current tiers](https://aws.amazon.com/startups/credits), [AWS credit application guide, 2026](https://aws.amazon.com/aws-startups/learn/applying-for-aws-activate-credits-a-step-by-step-guide/), [AWS free offers](https://aws.amazon.com/free/offers/), [Oracle trial](https://www.oracle.com/cloud/free/), [Arm Accelerator](https://go.oracle.com/armaccelerator-welcome), [Oracle Europe startup program](https://www.oracle.com/europe/artificial-intelligence/startup-growth-engine/), [AWS research program](https://aws.amazon.com/grants/), [Chameleon eligibility/allocations](https://dev.chameleoncloud.org/learn/frequently-asked-questions/), [current Chameleon hardware](https://discover.chameleoncloud.org/), [CloudLab hardware](https://www.cloudlab.us/hardware.php). Accessed 2026-10-28. Waiting times labeled E above are planning allowances, not provider promises.

**I — A focused hardware request worth drafting:** “I maintain an experimental aarch64 KVM runtime for small tool programs. I want to publish a reproducible density and wake-latency ledger, with kernel memory and failures included. Could I use one dedicated Altra/Altra Max host for two weeks, with root, hardware virtualization, a 4 KiB-page Linux kernel and ≥256 GB RAM? A 768 GB–1 TB slot for one day would enable a separately labeled resident-million experiment. I can provide scripts, immutable input hashes and raw results; no public arbitrary-code service is involved.” Do not imply an existing partnership or sponsor commitment.

**I — Owned laptop alternative:** an already-installed, compatible Linux/Asahi machine can cost **$0 incremental rental** and provide independent bare-metal results. However the current copy-restore fast path falls back on non-4-KiB pages, and 64-KiB hosts also need arena/memslot alignment checked. Installing Asahi merely to save $6 is poor economics; do not assume old Pi/GICv2 port estimates or an existing Mac HVF run are equivalent to validated Linux metal.

## 3. What a million-VM claim must mean

### 3.1 Publish the noun and denominator beside the number

**I — Use this claim vocabulary in the demo, report and title:**

| Label | Required evidence | What it does not establish |
|---|---|---|
| **New KVM VMs created/s** | Successful `KVM_CREATE_VM`, vCPU creation, target state reached, and destruction receipts over a declared wall interval. Include failed attempts and cleanup. | Resetting one existing slot a million times is not a million KVM creations. |
| **Isolated executions/s** | Correct completed programs with run generation/nonce, reset/admission contract, and observed resource retirement/reuse. | Neither cold boot throughput nor resident VM count. |
| **One million executions, cumulative** | One million successful unique run IDs, explicit elapsed time, peak resident count, failure/retry counts. | A million simultaneous machines, human users, or LLM agents. |
| **One million KVM guests resident concurrently** | A shared interval containing one million distinct live KVM objects/vCPUs and their touched guest working sets; no dropped guests or disk/swap-backed substitution. Evidence of actual guest entry and retained state. | A million cores executing simultaneously, full Linux compatibility, worst-case tenant capacity, or a latency SLO. |
| **One million tool-waiting guests** | Above, plus each guest reached its own outstanding host-tool WAIT with unique retained state. Challenge/wake all guests and account for every response. | Useful work occurring during the wait, real remote APIs, or a million physical execution contexts. |
| **One million snapshots / scaled-to-zero instances** | Durable distinct resumable records, total RAM/disk footprint, resume success/latency, maximum live KVM count. | One million live KVM VMs in RAM. This is a valid but different demo. |

**I — Strong resident wording, only after the experiment passes:** “We held 1,000,000 distinct one-vCPU KVM guests on one [exact ARM host] for 60 seconds. Every guest had executed [fixture] and was stopped at [state]; none was swapped or replaced with a snapshot record. X/Y answered a challenge afterward, with p99 wake-to-result Z at batch size B. Total runner charge A; source and raw receipts linked.” Use the actual count if it is 72,000 or 360,000. A bounded failure is a stronger engineering result than an inflated million.

**I — For the current reset backend, say:** “Each invocation gets restored guest state in a hardware VM; the underlying VM slots are reused.” Reset can be an excellent isolation mechanism, but a benchmark is not a security proof, and “new hardware boundary every call” would misdescribe its lifecycle.

### 3.2 Precedents and the scrutiny they imply

**F/I — The rows distinguish documented qualifications or challenges from my methodological objections.** I did not find an independent falsification for every vendor's number. Absence of such a paper is not validation; do not invent a controversy for rhetorical effect.

| System and source date | Actual claim / boundary | Scrutiny and implication for Sofort |
|---|---|---|
| **Firecracker, 2018 launch / NSDI 2020 / specification v1.16.1** | **F:** familiar ≤125 ms is `InstanceStart` API → Linux `/sbin/init`, with minimal tuned kernel/rootfs and serial console off. ≤5 MiB is **VMM-thread overhead** for a 1-vCPU, 128-MiB configured guest, workload dependent; excludes MMDS data. Older project headline: up to 150 creations/s/host. | **F:** the specification itself separates VMM startup and guest boot; multiple vsock connections can exceed its footprint number. **I:** neither 128 MiB configured RAM nor 5 MiB VMM overhead is a measured total physical guest cost. Compare same-host restored and booted workloads separately, including KVM charges. |
| **Hyperlight, Microsoft 2024-11-07 and 2025-02-11 demo** | **F:** initial claim 1–2 ms new VM creation. The later stage demo reported **0.0009 seconds average** and exposes distinct `/warm`, `/cold`, and VM-count routes. Purpose-built guests skip a conventional OS boot. | **I:** average function/demo time is not automatically cold API-to-result p99 or new VM throughput. **M:** the repo's own alleged ~3× memory win disappeared in matched Linux testing; Hyperlight was ~4% lower for `return2`. That is a real local correction, not evidence Microsoft's creation claim was disproved. |
| **Cloudflare Workers, “eliminating cold starts” 2020-07-30; current runtime docs** | **F:** zero-start messaging uses isolate preparation, including work during TLS connection establishment; Workers use shared-process V8 isolates. One isolate can handle multiple concurrent requests. | **F:** Cloudflare's own 2025-09-26 follow-up explains that larger applications began taking longer to start than TLS handshakes, motivating sharded routing to existing instances. **I:** distinguish request/isolate/VM counts, preparation overlap and warm code; 128 MB is a limit, not resident usage. |
| **Cloudflare security reassessment, 2026-08-19** | **F:** Cloudflare's own research reports a previously mitigated remote Spectre proof of concept against its production Workers environment and changes to process isolation/V8 defenses. | **I:** this challenges simplistic “small isolate = sufficient security” rhetoric, not the density arithmetic. It also does not make a KVM benchmark proof against microarchitectural attacks. Keep performance and assurance claims separate. |
| **LightVM, SOSP 2017-10-28** | **F:** specialized Xen toolstack, **2.3 ms** minimum for a device-free noop guest; up to **8,000** same-host guests in the large-scale experiment. Tinyx Linux and useful ClickOS examples have different boot/memory costs. | **F:** paper separates a ~480-KB image from ~3.6-MB running footprint; its ClickOS example uses 8 MB and ~10-ms boot. In 2026 the author explicitly recalled stability problems and highly optimized images. **I:** do not present the noop minimum, useful-firewall result and density maximum as one workload. |
| **Unikraft, EuroSys 2021** | **F:** ~1-ms guest boot **on top of VMM time**, total ~3–40 ms; ~1-MB images and <10 MB required RAM for tested apps. Open artifact includes VMM and guest phases. | **I:** “boots in microseconds” usually needs the timer's start point. Image bytes, configured/required RAM, touched resident pages and all-in host cost are four different measurements. |
| **Unikraft Cloud, 2026-05-18** | **F:** title explicitly says **scaled to zero**. 48 cores/384 GB/2×1.9-TB NVMe; Bun workload; compressed differential snapshots, sampled resumes; count eventually reached ~1.4M before NVMe space ran out. | **F:** author describes host networking limits around large counts and removing per-VM TAP networking. **I:** this is not a million simultaneously RAM-resident Bun working sets. Sofort must retain the state qualifier in the headline and count live KVM objects independently. |
| **Nanos, current “The Book”, accessed 2026-10-28; benchmark date unspecified** | **F:** ~195-ms MBR-bootloader → userspace-frame-return with an unstripped kernel, 72 ms stripped; minimum-memory examples range from 24 MB for C on Firecracker to 40 MB for Go on QEMU. | **F:** Nanos itself says provider and payload substantially affect boot. **I:** useful candor; the page is not a current same-host density ledger or a matched QuickJS comparison. Don't claim a universal ratio against it. |
| **Modal, 2026-07-16** | **F:** million concurrent sandboxes across a worker fleet, created in under a minute. Creation acknowledgment means assigned and beginning startup; separate time-to-run-code median <0.5 s. | **F:** author names longer-tail kernel/network contention. **I:** good model for separating scheduling from readiness. It is neither a single-host nor necessarily a per-sandbox KVM-object claim. |

Primary sources, all accessed 2026-10-28: [Firecracker specification, pinned v1.16.1](https://github.com/firecracker-microvm/firecracker/blob/v1.16.1/SPECIFICATION.md), [NSDI paper](https://www.usenix.org/system/files/nsdi20-paper-agache.pdf), [original reproducibility data](https://github.com/firecracker-microvm/nsdi2020-data), [Hyperlight introduction](https://opensource.microsoft.com/blog/2024/11/07/introducing-hyperlight-virtual-machine-based-security-for-functions-at-scale/), [Hyperlight demo explanation](https://opensource.microsoft.com/blog/2025/02/11/hyperlight-creating-a-0-0009-second-micro-vm-execution-time/), [Hyperlight snapshot sharing design](https://github.com/hyperlight-dev/hyperlight/blob/main/docs/paging-development-notes.md), [Cloudflare zero-start post](https://blog.cloudflare.com/eliminating-cold-starts-with-cloudflare-workers/), [Workers execution model](https://developers.cloudflare.com/workers/reference/how-workers-works/), [Workers memory limit](https://developers.cloudflare.com/workers/platform/limits/), [Cloudflare's 2026 Spectre study](https://blog.cloudflare.com/revisiting-spectre-attacks-on-workers/), [LightVM author-hosted paper, 2017](https://flosch.eu/papers/2017-sosp-lightvm.pdf), [Unikraft EuroSys artifact](https://github.com/unikraft/eurosys21-artifacts), [Unikraft current density account](https://unikraft.com/blog/1m-vms-single-box), [Nanos](https://nanos.org/thebook), [Modal](https://modal.com/blog/scaling-to-1-million-concurrent-sandboxes-in-seconds).

Additional primary sources: [Firecracker's current 150-creations/s headline](https://firecracker-microvm.github.io/), [Cloudflare's 2025 cold-start qualification](https://blog.cloudflare.com/eliminating-cold-starts-2-shard-and-conquer/), accessed 2026-10-28.

**F — There is also independent comparative work, rather than just marketing commentary.** The authors of **“Blending Containers and Virtual Machines: A Study of Firecracker and gVisor,” VEE 2020**, measured subsystem costs and found that moving guest functionality out of the host kernel did not imply less host-kernel code execution than native Linux. **I:** this is a reason to measure host CPU/kernel activity and useful workloads; it does not specifically refute the 125-ms specification. [Authors' conference abstract](https://conf.researchr.org/details/vee-2020/vee-2020-papers/1/Blending-Containers-and-Virtual-Machines-A-Study-of-Firecracker-and-gVisor), accessed 2026-10-28.

## 4. Capacity arithmetic and the limits that arrive before the headline

### 4.1 RAM: possible is not demonstrated

**E — Define the arithmetic:** let `H` be measured usable host GiB; `m` be measured marginal MiB per VM in the **claimed state**; `F` be fixed runner/shared-image costs in MiB; `R` be reserve for OS, buffers, foreground work and variance. Then:

```text
N_budget = floor((1024 × H − F − R) / m)
1,000,000 × 0.5 MiB = 500,000 MiB = 488.28125 GiB
```

**E — Illustrative ceilings, before additional fixed costs, using an intentionally conservative 20% host reserve:**

| Host RAM | Naive N at 0.5 MiB, no reserve | 80% RAM at 0.5 MiB | 80% RAM at 0.535 MiB shard one-tool slope | 80% RAM at 0.665 MiB full-executor slope |
|---|---:|---:|---:|---:|
| 256 GiB | 524,288 | 419,430 | 391,991 | 315,361 |
| 512 GiB | 1,048,576 | 838,860 | 783,982 | 630,722 |
| 768 GiB | 1,572,864 | 1,258,291 | 1,175,973 | 946,083 |
| 1024 GiB | 2,097,152 | 1,677,721 | 1,567,964 | 1,261,444 |

**I — Consequences:** 256 GiB cannot hold a million at 0.5 MiB; 512 GiB leaves only **23.72 GiB** after the ideal 488.28-GiB allocation, and at 0.535 MiB the guests alone need **522.46 GiB**. A 768-GiB m8g is plausible for a shard-only experiment; the full executor's **649.41 GiB** per million exceeds its 80%-RAM budget. A nominal 1-TB A1 is more forgiving, after checking actual usable bytes. These are linear extrapolations from N≤256/64, not confidence intervals on a million-guest system.

**I/E — Fixed costs must follow the chosen scaling architecture.** The full executor cannot simply grow past its 64-slot API check. If one reproduced it as **15,625 independent 64-slot Node holders**, ~35 MiB fixed each would add **~534 GiB**, on top of the ~649-GiB marginal calculation. Sharing one controller across many shards is a different, unmeasured architecture. The full-executor column is a slope sensitivity, not a deployable million-slot plan.

**M/I — The measured 0.535 MiB state is retained after a small completed one-tool run, not a proven million-way tool WAIT.** READY costs less (~0.242 MiB in that ledger), but claiming a million “agents waiting on useful work” from READY alone is wrong. Measure WAIT with per-guest distinct data. Copy-restore also changes released-slot behavior: hot reset slots retain private pages until idle trim; trim trades memory for faults on the next use. Show held, hot-reset and trimmed states separately.

**I — Re-measure the final source revision:** the 0.535/0.665-MiB figures come from the October 27 ledger, before the October 28 copy-restore merge. New per-slot buffers/policies and the actual metal kernel can change the slope. The capacity table is a sensitivity calculation using those dated measurements, not a certification of the final tree's footprint.

**E — A small-workload slope is not an admission guarantee.** The glue-2m writable arena is **1.25 MiB**, plus **80 KiB transport**. If every guest dirties those, private writable bytes alone approach **1,297 GiB per million**, before KVM/page-table/host costs. A “2 MiB admission class” would imply **1,953 GiB per million** before additional overhead. Thus a million residents on 768 GiB is a specific small-fixture demonstration, not support for a million arbitrary admitted programs at their maxima. [Arena contract](../../jitk/shard/src/arena.rs), [transport constants](../../jitk/shard/src/constants.rs).

**E — CPU is a separate denominator.** One million ×1.72 CPU-ms = **1,720 CPU-seconds =0.478 CPU-hours** for the measured nested workload. On 64 fully utilized comparable cores that is an ideal **26.9 seconds**, or **38.4 seconds at 70%**; the observed sequential slot instead delivers ~691 runs/s, about **24.1 minutes** per million. Neither predicts metal throughput. At today's c7g Virginia rate, ideal CPU allocation would be **$0.0173/M**, but actual host rental, build time, memory residency and utilization determine the bill. This is why substituting a new “two cents” slogan for the old nickel would repeat the same error.

### 4.2 Limits, in the order an experiment will encounter them

**I — There is no single universal first limit.** Current API use stops at 64. A direct offline holder reaches the owner limit or OS mappings/fds. A partitioned holder may encounter creation CPU, host-kernel metadata or TLB costs before RAM. The following is the concrete failure inventory to record; changing one sysctl is not a million-VM implementation.

**F/I — Maximum VMs per process:** the inspected Linux v6.12 `KVM_CREATE_VM` path dynamically creates VM objects and has no fixed per-process VM-count gate analogous to `KVM_CAP_MAX_VCPUS`. That is not a promise that any particular count succeeds: descriptors, mappings, kernel allocations and distribution policies determine the attainable count. The repo's 64/16,384 limits are earlier application-level gates. Source: [KVM creation implementation](https://github.com/torvalds/linux/blob/v6.12/virt/kvm/kvm_main.c), inspected 2026-10-28.

| Limit | Current value / mechanism | What fails and what the experiment needs |
|---|---|---|
| **Exposed virtualization / ISA** | **F:** Linux arm64, actual EL2/KVM, usable `/dev/kvm`, expected capability/register set. | VM/cloud products may not expose it at all. Fail preflight before renting a large size; “ARM CPU” is insufficient. Prepare the target-host snapshot. |
| **Production capacity checks** | **F:** 64 slots and 4 owners in TS and Rust IPC; owner pool 16,384. | Constructor error/assert before a million allocation. Use a clearly labeled research harness, or many bounded holders; do not quietly change “64 slots” to “one million” in marketing. |
| **Per-process fd limit** | **F:** current code clamps hard/soft limit to 65,536. Each Slot retains one VM fd and one vCPU fd, plus shared/control fds. | **E:** ~32K slots would consume that limit even if other checks were removed. Defaults of `fs.nr_open=1,048,576` would still be below the **>2M fds** needed by this one-process design. Record actual `RLIMIT_NOFILE`, `fs.nr_open`, `fs.file-max`, `file-nr`; systemd/distributions can change defaults. |
| **VMA count** | **F:** 32-MiB RAM mapping split into five alternating immutable/writable extents, plus mapped `kvm_run`; upstream default `vm.max_map_count=65,530`. | **E:** roughly six maps/VM → only **~10.9K** guests/process before baseline maps; count actual maps. A million in one process would need roughly **6M VMAs**, not merely six million guest pages. mmap/mprotect can return ENOMEM while RAM remains. |
| **User virtual address space / RLIMIT_AS** | **F:** every Slot maps 32 MiB RAM even when few pages are resident. arm64 Linux task size depends on configured/effective VA bits. | **E:** one million reservations = **30.52 TiB** of virtual address space, plus run mappings. A 39-bit user space is only 512 GiB (~16K such mappings before other use); a 48-bit space can accommodate the reservation in principle. Inspect VA configuration and `RLIMIT_AS`/`RLIMIT_DATA`; do not confuse VIRT with RAM. |
| **Overcommit / commitment accounting** | **F:** writable private mappings can be commitment-accounted even when untouched. | **I:** strict overcommit, `CommitLimit`, cgroup high/max or an address-space limit can reject allocation much earlier than RSS predicts. Read `Committed_AS`, overcommit policy and actual allocation errors. Never call swap/overcommit success a resident-memory result. |
| **KVM vCPU count** | **F:** `KVM_CAP_NR_VCPUS`, `MAX_VCPUS`, `MAX_VCPU_ID` are **per VM**, not a global host count. | Each guest here has one vCPU, so it is not a one-million-vCPU SMP guest. Query capabilities. There are only P physical cores executing at once; waiting guests must not require one host thread each. |
| **KVM memslots** | **F:** query `KVM_CAP_NR_MEMSLOTS`; memory slots are **per VM**. Current JS layout uses five; native inputs use another path, including slot ID 63. | Five million total regions do not violate a per-VM slot cap of 32/other host value. A native slot ID can be invalid even when few slots exist. Report actual cap/highest ID. Guest memory slots are not the same thing as VM slots in the executor. |
| **KVM/host metadata and RAM** | **M:** nested ledger ~232 KiB kernel cost per entered shard guest. **F:** VM/vCPU objects, stage-2 tables, file objects and optional debugfs/stat nodes scale with VM count. | **E:** 232 KiB×1M ≈221 GiB already, **included in** the measured total slope. Do not add it twice. Some host-global allocations may escape the selected memcg; whole-host residual accounting is essential at high N. Kernel allocation/fragmentation can fail before total MemAvailable reaches zero. |
| **Per-VM, per-host-CPU SRCU allocations** | **F:** pinned Linux v6.12 initializes two SRCU domains per KVM VM; tree SRCU allocates per-CPU `srcu_data` arrays. Its size/configuration and possible-CPU count matter. | **I/E:** overhead can scale roughly as **2×possible CPUs×sizeof(srcu_data) per VM**, plus other state. The six-vCPU nested floor is not transferable to a 192-core host. Measure a small-N slope and whole-host delta on the exact large host first; CPU affinity alone does not reduce possible CPUs. This can invalidate the optimistic RAM table before guest memory does. |
| **MMU-notifier fan-out** | **F:** KVM registers a notifier on the creator's address space per VM. **M:** current ledger explicitly notes process-wide notifier fan-out at only 64 slots. | **I:** mapping changes, allocator trimming, faults and reset/deletion can cause severe scaling costs in one giant process. Copy-restore removes one source of invalidation, not all. Measure setup slope and tail latency; partition processes before fighting a million-notifier mm. |
| **arm64 VMIDs / TLB capacity** | **F:** 8- or 16-bit VMIDs, runtime selected; generation rollover recycles them with invalidation. | **I:** performance cliff during broad/random wake and creation; **not a hard resident-VM cap**. See §4.3. More processes do not create more hardware VMID bits. |
| **Host ASIDs / process count** | **F:** host stage-1 ASIDs also have finite width and generation management; separate from guest stage-2 VMIDs. | **I:** one host ASID per relevant address space, not per VM in one process. Hundreds of holder processes are different from one million processes; guest ASID reuse is isolated by stage 2. |
| **Owner scheduling and watchdog scans** | **F:** static slot-to-owner assignment, run-until-completion-or-WAIT, per-slot lease entries and scans on changes; one watchdog process/holder. | **I:** bounded waiting is cheap; a wake-all/CPU-heavy workload can queue behind long runs. At large N, lease scans/commands/acknowledgments can dominate. Record wait-to-run, scan CPU, deadlines and no-progress intervals. |
| **Threads, process/pid/cgroup limits** | **F:** holders use a few owners plus watchdog, not a thread per parked VM. | **I:** a process-per-VM alternative reaches pids.max, RLIMIT_NPROC, kernel stacks and scheduling limits. Do not accidentally replace the winning design with a million Node processes or watchdogs. |
| **Network/tool/UI/log capacity** | **F:** current ring guest has no per-VM TAP/NIC. | **I:** keep synthetic tools in-process for density; one million sockets, real paid API calls, per-VM websocket streams or DOM nodes create a different bottleneck. Count callback buffers, pending promises and controller memory. Publish aggregate updates, with drill-down from receipts. |
| **Construction/cleanup time and provider lifetime** | **I:** creating, initializing and later closing a million VM objects is work, even if one steady-state reset is fast. | Trace allocate→first guest entry→WAIT→wake→drop; verify the whole count coexisted. Spot interruption, one-hour leases, disk-full logs or incomplete cleanup can invalidate the run before a photo of the counter is taken. |

Primary technical sources: [KVM API, v6.12, per-VM capabilities](https://docs.kernel.org/6.12/virt/kvm/api.html), [KVM creation/notifier source, v6.12](https://github.com/torvalds/linux/blob/v6.12/virt/kvm/kvm_main.c), [Linux map limit](https://www.kernel.org/doc/html/latest/admin-guide/sysctl/vm.html#max-map-count), [Linux file limits](https://docs.kernel.org/admin-guide/sysctl/fs.html#nr-open), [arm64 task-size definitions, v6.12](https://github.com/torvalds/linux/blob/v6.12/arch/arm64/include/asm/processor.h), [arm64 ASID allocator, v6.12](https://github.com/torvalds/linux/blob/v6.12/arch/arm64/mm/context.c). Source inspected 2026-10-28. v6.12 is a pinned explanatory implementation, **not** a claim about the kernel version installed on a future rental; inspect that kernel and its backports.

Additional accounting sources: [Linux overcommit rules](https://docs.kernel.org/5.15/vm/overcommit-accounting.html), [Linux `/proc` memory/residency definitions](https://www.kernel.org/doc/html/next/filesystems/proc.html), accessed 2026-10-28.

SRCU implementation sources, inspected 2026-10-28: [per-VM SRCU initialization](https://github.com/torvalds/linux/blob/v6.12/virt/kvm/kvm_main.c), [tree SRCU allocation](https://github.com/torvalds/linux/blob/v6.12/kernel/rcu/srcutree.c), [srcu_data definition](https://github.com/torvalds/linux/blob/v6.12/include/linux/srcutree.h). These justify a host-dependent overhead investigation, not an asserted byte size on an unmeasured provider kernel. Optional BTF/`pahole` inspection can explain the observed slope.

**I/E — Practical partitioning for the stretch run:** use **4,096–8,192 guests per holder**, initially one owner each, after a smaller sweep. At 8,192, the approximate six-VMAs/guest count is ~49K per process, below the upstream map default with some room; two fds/VM also fit the current 65,536 clamp. One million takes **123 holders**. Their additional fixed memory/watchdogs and a global collector must be measured. This avoids the current 16,384 check without removing it, and bounds notifier fan-out, but it **does not** prove the aggregate million or eliminate host-global KVM/VMID limits. This partitioned CLI supervisor is new work, estimated **3–7 days**, before a credible stretch capture.

### 4.3 VMIDs: 8/16 bits is crucial, and it is not a count ceiling

**F — Arm's architectural choice is 8 or 16 bits**, described by `ID_AA64MMFR1_EL1.VMIDBits`; `VTCR_EL2.VS` controls use of the upper bits where supported. Do not infer the selected width from “arm64,” “Graviton” or “Altra.” Record the sanitized host feature values and KVM's selected width, ideally its startup log or an auditable host probe. [Arm ARM, FEAT_VMID16](https://support.arm.com/documentation/ddi0487/mc/-Part-A-Arm-Architecture-Introduction-and-Overview/-Chapter-A2-A-profile-Architecture-Extensions/-A2-2-Armv8-A-architecture-extensions/-A2-2-2-The-Armv8-1-architecture-extension?lang=en), accessed 2026-10-28.

**F — Linux v6.12's allocator reserves VMID 0, tracks a larger software generation, and on exhaustion increments that generation and broadcasts a TLB/I-cache context invalidation.** It preserves relevant active/reserved CPU tags, then assigns new ones. It does not reject the 256th/65,536th resident KVM object. The implementation also expects more usable VMIDs than possible host CPUs. [Allocator](https://github.com/torvalds/linux/blob/v6.12/arch/arm64/kvm/vmid.c), [feature selection helper](https://github.com/torvalds/linux/blob/v6.12/arch/arm64/include/asm/kvm_mmu.h), inspected 2026-10-28.

**E/I — Scale implication:** a sweep entering one million distinct guests exceeds a 16-bit namespace roughly 15 times, or an 8-bit namespace roughly 3,900 times **even before** accounting for reserved tags; actual rollovers depend on scheduling and can be more frequent. An all-resident parked set can exist while most guests hold stale-generation tags; they pay reallocation/invalidation costs when run again. Repeatedly entering a small hot subset can look excellent while a shuffled all-guest wake has long tails. Splitting into 123 processes helps software limits, not this hardware namespace.

**I — Required experiment:** repeat wake tests at N=128, 256, 512, 4K, 16K, 64K, 128K, then the largest achieved count, with both round-robin and seeded-random order. Use a hot-subset control and an idle interval before another sweep. Record exact CPU affinity, possible/online CPUs, VMID-width evidence, relevant KVM/TLB trace counters if available, and uninstrumented latency runs to quantify tracing overhead. Compare a handful of active guests among a large parked population against waking the entire population; neither substitutes for the other.

## 5. A measurement protocol a skeptical reviewer can reproduce

**I — Deliverable:** one source commit plus a single entry script, a machine-readable plan, immutable input hashes, raw per-run events, raw host/cgroup samples, reduction code and an uncut capture. A video counter and a CSV of medians are not sufficient. Use the repo's cgroup method as the baseline, then add a separate residency/wake experiment; avoid making one benchmark do all jobs.

### 5.1 Freeze the machine and define each boundary

**I — Record before the run, after it, and at any configuration change:**

- Source commit and dirty diff, host OS/image identifier, full kernel version/config, microcode/firmware as observable, CPU model/revision/features, physical cores, online/possible CPUs, NUMA topology, CPU affinity/governor and frequency observations. State whether EL2 is physical or nested; keep provider type/region and a redacted instance identity as corroboration.
- Host page size and VA bits; KVM API/capabilities/register list, IPA limit, selected VMID width; relevant security mitigations. Use a normal supported host configuration first; any tuning needs its own before/after row.
- RAM bytes, swap/zram/zswap configuration, THP/KSM, malloc tunables, overcommit/CommitLimit, `vm.max_map_count`, fd/process limits, cgroup CPU/memory/pids policies. Record `/proc/meminfo`, `/proc/vmstat`, `/proc/stat`, load, PSI, `file-nr` and disk space.
- Compiler/Rust/Node/Hyperlight/QuickJS and other dependency versions; hashes of the kernel image, payload/bootstrap, prepared snapshot `.mem/.regs/.layout/.identity`, executable, plan and reduction script. Prepare a clean snapshot on this host before any tenant input. Record whether shared files were warm, cold, or explicitly prefaulted.
- Provider bill basis: quoted rate, price timestamp/source, rental start/end, provisioning/build/warmup/capture time, number of interrupted/failed bookings, boot volume/IP/egress and credit offsets. Show **list-rate resource cost and cash paid** separately if credits or a donated host were used.

**I — At least six distinct stopwatches:** (1) process spawn→API available; (2) new VM/vCPU create→guest READY; (3) fresh guest state restore/bind→RUN; (4) RUN→validated result; (5) caller `execute()`→result, including queueing where present; (6) admission→reset/release or VM destruction. Host-tool waiting and policy IPC are separately timed. All timestamps for subtraction use the same host monotonic clock.

**F/M — A current subtlety to preserve:** `shard-bench.ts` records `execute()` wall time before `pool.drain()`, but CPU over the whole loop includes the drain. Therefore 1.10 ms is result latency, while the CPU/throughput interval includes more lifecycle work. Do not label either as cold boot or birth-to-death. Its existing 300-run p99 is descriptive of that small sample; it cannot support a stable p99.9 claim.

### 5.2 Four separate experiments

**I — A. Small, matched bare-metal baseline, 0.5–1 day after setup:**

1. Re-run correctness/reset tests on the rental, including the hostile EL1 guest-view/cache tests, fresh entropy, timer/MP-state restoration and leak/cross-talk controls. This is particularly useful on Altra/N1 without the feature assumptions of the nested Mac host. A failed test is a stop for public isolation claims, not a datapoint to drop.
2. Measure `return2`, one-tool, `Promise.all(10)` and a declared bounded data-processing case. Keep fixture bytes/tool result sizes identical across systems. Include a larger/invalid workload to expose admission, memory and failure behavior; do not imply a tiny constant-return run measures arbitrary native tools.
3. Interleave at least three independent repetitions/configurations; include current copy-restore and forced discard, READY/WAIT/completed/hot-reset/trimmed states, and cold/new versus reset/reused KVM objects. Record both the actual API path and a raw-shard row. Add Hyperlight only when its pinned same-host artifact is runnable; lack of a comparator should not delay the first honest Sofort metal receipt.
4. Fit memory as `fixed + N×slope` per repetition, initially N=1,8,32,128,256, then higher only after the preceding count passes. Publish fit residuals/intervals and observed totals. At higher N, use local slopes or segmented curves if cost is nonlinear.

**I — B. Cumulative-million execution demo:** bounded pool, fixed workload contract, unique generation/run IDs, validated outputs, failed attempts recorded. If the underlying VM slots are reused, print their count and number of actual KVM creations. Require cleanup/reset before a run joins the completed-and-released counter. Run repeated short throughput cells plus the longer million-run soak; a one-shot million does not replace a latency/load curve.

**I — C. Resident-density and correctness:** instantiate in batches, stop at a declared memory/health budget, and retain every counted guest in the specified state. After all holders report the target, establish a **global barrier** and hold at least **60 seconds** with memory/CPU sampled at 1 Hz. The bar count is the **minimum verified resident count over that interval**, not a sum of per-holder peaks at different times. No failed/reaped/quarantined/unentered guest may count as a tool-waiting guest.

**I — Use a nonce challenge:** each guest retains its own run ID/nonce and a small private state value before WAIT. After the barrier, a human or separately seeded verifier chooses a challenge. The resumed guest computes a result from both the saved nonce and challenge; validate and record all results, with duplicate/missing IDs as failures. Fixed `return 42` and host-side echo alone are weak evidence of distinct retained execution state. The nonce fixture must still fit the same memory/source class and be included in its measured footprint.

**I — Corroborate count independently:** instrument successful `KVM_CREATE_VM`/`CREATE_VCPU` and final release, maintain (holder PID, lifetime ID, local slot, generation), and reconcile against `/proc` fd inventories and kernel tracing/debugfs/stat interfaces available on that host. A file-descriptor count alone is not unique object identity—dup'ed descriptors can inflate it. Do not open a fresh stats fd for every VM merely to measure it without budgeting those extra fds. Kernel tracepoints differ across releases; retain exact instrumentation and show its overhead. A separate observer/reproduction is stronger evidence than an author-controlled signed receipt.

**I — D. Wake/tail behavior:** after the density hold, measure a seeded-random 1% sample promptly, then **wake and validate the whole population** in bounded batches. Record hot-subset, random and sequential orders, batch sizes 1/physical-core-scale/large burst, and time-to-drain for the whole set. A 1% sample alone cannot support “all million were resumable.” One million sleeping guests may require many seconds/minutes to service; print the wake budget rather than pretending a broadcast yields simultaneous CPU execution.

### 5.3 Memory and CPU accounting without misleading totals

**F/I — Primary memory accounting is cgroup v2 `memory.current`/`memory.peak`, accompanied by `memory.stat` (anon, file, kernel, slab, pagetables, sec_pagetables, kernel_stack), `memory.events`, PSI and swap metrics.** `sec_pagetables` includes KVM secondary page tables on arm64. PSS/private-dirty/RSS are diagnostics, not replacement totals or extra quantities to add to the cgroup charge. [Kernel cgroup documentation](https://www.kernel.org/doc/html/v7.0/admin-guide/cgroup-v2.html), accessed 2026-10-28.

**M/I — The existing ledger warms snapshot files and binaries outside each measured cgroup.** This gives a useful **marginal** slope, but the shared image is still a real host cost. Publish two totals: the clean marginal experiment and a parent cgroup/whole-host deployment including all holders, watchdogs, controller, shared images/cache and instrumentation. Explain file-page ownership rather than adding an arbitrary “RSS overhead.” Record `/proc/meminfo`/slab and pre/post deltas to catch uncharged host-global growth; reconcile a material residual before saying “all in.”

**I — A resident claim requires private state to remain in RAM.** Disable swap for the measured group and record global swap activity; publish private-state residency/working-set probes and major faults during idle/wake. Shared read-only snapshot pages need only be charged once, but their cold faults must be visible. A mapped 32-MiB address range is not 32 MiB resident; conversely, zero-cost unmapped snapshot records are not live KVM guests. State KSM/compression explicitly; do not compare one system with dedup enabled to another without it.

**I — CPU:** use cgroup `cpu.stat` for the complete runner/controller/watchdog tree and separate Node, owner, reactor and tool-fixture CPU where possible. Preserve user/system and task-clock deltas, context switches, faults, exits, notifier activity and tracing availability. Guest on-CPU time is included in host thread CPU; do not add it again. Record idle CPU as a measured rate with sampling resolution, not “zero” after integer rounding. Distinguish allocating the population, keeping it parked, wake work and teardown.

### 5.4 Tail latency and load

**I — Publish p50/p90/p95/p99, maximum, histogram/ECDF, sample count, run duration, and errors/timeouts beside throughput and offered load.** Use ≥100K successes for an exploratory p99.9; prefer a million and show uncertainty across repetitions. Report p99 per repetition and the pooled distribution, not an average of percentile values presented as a new percentile. Preserve the slow repetitions and make the nested bimodality an explicit reason for doing metal.

**I — Avoid coordinated omission:** for a service/load result, schedule arrivals independently of responses and measure intended-arrival→result, including backlog. Record late/dropped admissions and caller timeouts; do not silently stop sending during stalls. Closed-loop one-slot tests remain valid when labeled as such, but cannot establish a service latency SLO. If a client deadline expires, show the failed fraction separately rather than treating only fast successes as the whole population. [wrk2's method](https://github.com/giltene/wrk2), [HdrHistogram](https://github.com/HdrHistogram/HdrHistogram), accessed 2026-10-28.

**I — Show the tradeoff directly:** plot resident count vs total memory, construction latency and random-wake p99; then show throughput vs offered load at a few resident counts. Put raw-shard, full-executor, new VM and reset-slot modes in distinct series. Label artificial tool delays (0/5/50 ms, for example), and keep model/API latency out of the isolation number.

### 5.5 Reproduction script and artifact contract

**F — Reusable pieces exist:** `linux-memory ledger PLAN OUT WORKDIR [FAMILIES]`, `linux-memory analyze`, snapshot preparation, holders and raw phase benchmarks. **I — Missing pieces:** portable plan generation, corrected metal metadata, full stderr/lifecycle retention, open-loop API samples, and multi-holder barrier/challenge collection. The following is the **proposed small-run capture script**, not a script executed by this research or a turnkey million test. The implementing change should check it into the future evidence artifact and provide one setup command for all asserted inputs.

```sh
#!/bin/sh
set -eu
# Run on the dedicated Linux ARM host, after pinned native setup and
# fresh target-host snapshot preparation. Use absolute paths.
: "${REPO:?source checkout}" "${W:?portable evidence workdir}"
: "${REAL:?pinned real shard binary}" "${SNAP:?fresh snapshot base}"
: "${LEDGER:?pinned linux-memory executable}" "${PLAN:?portable plan.json}"
: "${OUT:?new output directory}"
test "$(uname -s)" = Linux
test "$(uname -m)" = aarch64
test "$(getconf PAGESIZE)" = 4096
test -c /dev/kvm
test -x "$REAL"
test -x "$LEDGER"
test -x "$W/bin/spawn-cg"
test -r "$SNAP.mem"
test ! -e "$OUT"
mkdir -p "$OUT"
git -C "$REPO" rev-parse HEAD > "$OUT/commit.txt"
git -C "$REPO" diff --binary HEAD > "$OUT/source.diff"
uname -a > "$OUT/uname.txt"
lscpu > "$OUT/lscpu.txt"
cat /proc/meminfo > "$OUT/meminfo.before"
cat /proc/swaps > "$OUT/swaps.before"
cat /proc/self/limits > "$OUT/limits.txt"
sysctl vm.max_map_count vm.overcommit_memory vm.overcommit_ratio \
  fs.nr_open fs.file-max > "$OUT/sysctls.txt"
sha256sum "$REAL" "$LEDGER" "$PLAN" "$SNAP.mem" "$SNAP.regs" \
  "$SNAP.layout" "$SNAP.identity" > "$OUT/inputs.sha256"
# PLAN uses a unique task cgroup, memory.swap.max=0, declared counts/reps,
# and {W} paths. The existing ledger enters children at birth via spawn-cg.
"$LEDGER" ledger "$PLAN" "$OUT/memory" "$W" jitk-shard \
  > "$OUT/ledger.stdout" 2> "$OUT/ledger.stderr"
"$LEDGER" analyze "$OUT/memory/cells.jsonl" "$OUT/memory-summary.json"
for rep in 1 2 3; do
  for fixture in return2 one_tool promise10; do
    perf stat -x, -e task-clock,page-faults,context-switches \
      -o "$OUT/perf-$rep-$fixture.csv" \
      -- "$REAL" bench "$SNAP" "$fixture" 10000 \
      > "$OUT/runs-$rep-$fixture.jsonl" \
      2> "$OUT/runs-$rep-$fixture.stderr"
  done
done
cat /proc/meminfo > "$OUT/meminfo.after"
cat /proc/swaps > "$OUT/swaps.after"
# Separately capture KVM-capability/VMID probe, the full-executor path,
# runtime environment samples and provider billing timestamps as specified.
# Hash the complete bundle after every writer exits, then export it.
```

**I — Setup instructions must use current `make -C arch/jitk/shard snapshot` / `snapshot.ts`, not old `/home/dev/r7-ipc` paths.** Produce the plan from the checked-in template, retain its diff, and use a unique bench lock/cgroup. Correct or explicitly supersede the current hard-coded `nested:true` fields. Fail if any ledger `ok:false`, holder failure or missing receipt appears, even if the command itself exits successfully. Set a health/memory ceiling before higher-count cells; record the stopping criterion and best achieved count.

**F/I — Existing ledger limitations to fix for the stronger claim:** it SIGTERMs holders after memory sampling, so its `wait` cell does **not** prove the later all-guest resume phase; it stores a truncated stderr tail and, for multiple per-process holders, only the first holder's event list in the reduced cell record. Keep full raw output for every holder and let a separate wake experiment complete normally. Its aggregate sample totals still cover the cgroup, but a single representative holder receipt cannot attest to 123 holders.

**I — Evidence bundle layout:**

```text
manifest.json                 claim/state, source/input hashes, host, pricing
reproduce.sh + setup.md        exact pinned setup, execution and cleanup
plan.json + fixture sources    workload, seeds, bounds and stop conditions
host/                         environment, capabilities, sysctls, kernel logs
raw/holders/                  every creation/wait/wake/release, full stderr
raw/host-samples.jsonl         monotonic time, memory/CPU/PSI/fds/maps
raw/latency.jsonl + histograms intended arrival, phases, result/error, run ID
summary/ + reduce source      tables/plots derivable from raw input
recording/                    uncut take, captioned cut, timing/speed labels
billing/                      duration and redacted invoice/credit statement
```

**I — Release rule:** a peer should be able to rebuild, run a smaller validation count and derive the same categories/units without trusting the animation. Publish failed cells, exclusions, limitations and the single largest full-count trial; do not require somebody to rent a 1-TB box just to validate the measurement pipeline. Hashes detect accidental evidence drift; they do not independently prove hardware provenance or eliminate the need for outside reproduction.

## 6. Five concrete demo designs

All costs below are **E**, calculated on **2026-10-28** from §2's rates. They exclude personal labor and travel. Engineering-day ranges assume familiarity with this repo; provider approval delays are additional. “Live” refers to actual execution, while an animated display is always a view of measured events.

### A. “One million runs; count the actual computers” — lowest-risk headline

**First 10 seconds:** `0 → 1,000,000 completed + released executions`, beside `peak resident VM slots: 64`, `new KVM VM objects: [actual count]`, elapsed time and live server charge. Zoom into one run's JS, tool reply and generation. Make the distinction visually unavoidable.

**Real/staged:** real bounded executions of a declared fixture; the UI batches events and may replay the completed log for a short video, marked **recorded / accelerated** with the actual duration. No LLMs, internet tools or simulated VM particles counted as work. With the shard, the million counter is resets/executions, not VM creation.

**Number on screen:** validated completion count, failures/retries, actual KVM objects, p50/p99 and CPU/run measured in that take. At the existing nested one-slot rate, a million takes ~24 minutes; this is a planning illustration until metal measures it.

**Cost/effort:** **1–2 days** for the receipt/counter path after the metal harness; **1–3 billed phoenixNAP hours = $0.99–2.97** for a prepared run, with **$6–10** practical rehearsal/capture allowance. On c7g Virginia, 1–3 hours = **$2.32–6.96** compute. Count setup time separately.

**Failure modes:** reset/canary failure, growing CPU/memory from leaked callbacks, output counter incrementing before release, hidden retry loops, viewers interpreting a replay as live. Keep a pre-recorded evidence take for presentations; if the live run fails, show its failure and switch to the labeled take.

**Audience/value:** short post and hiring-manager opener. It demonstrates a working high-volume lifecycle and honest resource accounting. It does not by itself show that somebody needs a million parked guests.

### B. “10,000 waiting computers, one challenge” — best systems demo

**First 10 seconds:** a frozen grid labeled **10,000 distinct KVM guests at tool WAIT**, with host RAM and total owner-thread count. Audience picks a challenge; selected cells answer using their retained nonce. Expand a cell to show where its program stopped.

**Real/staged:** real guests on one ARM metal server, synthetic host tool held pending; host is not running ten thousand paid API calls. Complete the full population validation off the critical presentation path and keep its receipt visible. Existing `hold ... wait` provides a starting point, but per-guest nonces, the challenge and a durable multi-holder collector are new.

**Number on screen:** verified retained count, memory **total** and bytes/guest, idle CPU with resolution, owners/processes, lost/duplicate wakes, random-wake p99 at a declared batch size and all-guest drain time. **E:** 10K×0.535 MiB ≈5.22 GiB before fixed overhead, not a measured WAIT requirement.

**Cost/effort:** **2–4 days**, including the portable baseline; two 5K holders avoid the approximate default-map limit of one 10K holder. **4–6 phoenixNAP hours = $3.96–5.94** compute; **$10–20** practical total budget including rehearsals. A c7g 128-GiB host has plenty of nominal RAM for this experiment.

**Failure modes:** static-owner head-of-line blocking, VMID/TLB rollover, watchdog scans, excessive UI/log work, pending-state memory higher than completed-state slope, event loss on mass resume. A 1K/4K verified run is the fallback, with its actual count; the visual must not continue to show 10K.

**Audience/value:** Cloud Native/Rust/platform engineers, technical interview, deep blog. This directly tests the density and scheduling behavior that a small program waiting on a tool needs.

### C. “Ask eight throwaway computers” — laptop-sized KL/SEA talk

**First 10 seconds:** on an Apple Silicon laptop, type one number; **eight** visible programs request eight explicit host-tool operations, get distinct results, and retire. The display shows the actual backend (`macOS/HVF`, e.g. eight concurrent guests), the code, result and live-process lifecycle.

**Real/staged:** use the existing Mac executor/MCP integration with fixed local tools and a conservative pool of eight. No cloud or venue Wi-Fi required; no claim of 10K local HVF VMs. A second panel can replay the metal density log, plainly labeled **recorded on [server]**, and explain why the two backends have different memory/lifecycle numbers. A one-tool/short parallel fan-out example stays within the demonstrated workload contract.

**Number on screen:** **8 concurrent local guests** if corroborated by that take, completion latency and correct outputs. Do not apply the Linux ~0.5-MiB slope to macOS; the repo's HVF host encountered ~61 concurrent VMs, so eight leaves room. If process-lifecycle hooks are not added, label the display as **occupied lifecycle slots**, not independently observed live VM count.

**Cost/effort:** **0.5–1.5 days**, **$0 incremental infrastructure** with the existing laptop. Carry the source and an offline recorded fallback. An audience member can read/remix the tiny program on their own laptop; they need not install a kernel to participate in the demonstration.

**Failure modes:** signing/permissions, a stale prepared pool, host load, projection font size and an unsupported snippet. Use a pretested local fixture and large text; live editing changes arguments/data first. The fallback is the same locally recorded take, not a made-up counter.

**Venue and presentation:** **I:** propose a 12–15-minute talk to [Cloud Native Kuala Lumpur](https://www.meetup.com/cloud-native-kuala-lumpur/), then a 5-minute Q&A on the metal receipts. **F:** its own page invites speakers and documents recent 2026 meetups. The [2026 KCD Kuala Lumpur](https://events.humanitix.com/kcd-kuala-lumpur-2026) was **June 27**, already past; do not pitch it as an upcoming deadline or invent a 2027 acceptance. Both checked 2026-10-28. Show “what I built, measured, and found broke” rather than a hosted-service sales pitch. No outreach was sent.

### D. “One million guests actually retained” — conditional capstone

**First 10 seconds:** a held count of **1,000,000**, a one-host topology, real total RAM, `swap=0`, actual holder/vCPU count, and a challenge box. Overlay **small fixed workload; resident and stopped, not one million running cores**. Then choose a guest and get a response.

**Real/staged:** prepopulate while recording; show the actual construction time even when the short cut accelerates it. Hold the global barrier for 60 seconds; verify every wake after the capture. The interactive section can be live against the retained population, backed by a complete recording. A million snapshot files or rolled-up historical executions cannot supply this counter.

**Number on screen:** minimum verified count over the hold, actual peak total RAM, class/fixture, new KVM count, constructed/entered/WAIT/completed/reaped states, random-wake distribution and full sweep completion fraction. Require all claimed guests to have entered the workload, not just a successful ioctl.

**Cost/effort:** **5–10 engineer-days total**, including smaller-count gates, collector and failure analysis. **6–12 hours m8g.metal-48xl Virginia OD = $51.70–103.40** compute; add **$5–15** planning allowance for storage/logs/rehearsal incidentals. Stockholm Spot is **$5.49–10.99** compute at today's listing, with interruption/capacity risk. OCI A1 can be **$0 compute under the unused paid allowance**, or **$18.82–37.63** for 6–12 hours at list rates. Keep a **$100–150 maximum experiment budget**, not an open-ended server booking.

**Failure modes:** all of §4—particularly host-global metadata missing from small-N memcg slopes, setup/notifier costs, fd/map/commit limits, VMID wake tails, too-short leases, OOM or kernel failure. Stop at the declared limit and publish the largest passing count. If the million gate fails after the budget, the honest “why 180,000 worked and the next batch did not” report still serves the CV objective.

**Audience/value:** systems capstone, long-form engineering post and interview. It establishes a narrow density result if successful, not product readiness or a customer need. It should follow B, not block it.

### E. “Where the half-megabyte goes” — strongest technical hiring proof

**First 10 seconds:** a live count slider backed by measured cells, with stacked guest-private/KVM/host-fixed/shared-image bytes; alongside it, p99 wake latency rises as the population changes. Pick jitk or matched Hyperlight and inspect the same fixture/host.

**Real/staged:** new metal measurements, reduced offline from raw logs; a prerecorded chart is sufficient and labeled as analysis. A 256/1K live cell can demonstrate the pipeline. The animation must not interpolate a measured million from the small-N fit.

**Number on screen:** measured MiB/guest and total host usage, uncertainty/repetition count, exact workload and lifecycle. Today's nested comparison belongs in a separate panel: jitk **0.515/0.535**, Hyperlight **0.495/0.527 MiB**, not “3× denser.” Latency comparisons must be rerun after copy-restore with equivalently defined competitor lifecycle paths.

**Cost/effort:** **1–2 days** beyond the baseline for reduction/clear presentation; **4–8 phoenixNAP hours = $3.96–7.92** compute, **$10–20** practical total. Do not spend days repairing a competitor binding just to complete a launch chart; publish the unsupported cell explicitly.

**Failure modes:** counting the same shared/kernel bytes twice, a misleading never-entered READY comparison, choosing one favorable heap/engine, histogram pooling that hides slow runs, and stats collection distorting latency. Retain the strongest fair competitor configuration and print the memory accounting boundary.

**Audience/value:** platform/SRE hiring manager, low-level meetup, benchmark blog. A careful correction to one's own headline is stronger evidence of engineering judgment than a large but ambiguous number.

## 7. Value, audiences and a timeboxed sequence

**I — Which gaps block actual value:**

| Gap touched | User and job affected | Cheapest credible closure; place/cost/time | What it unlocks |
|---|---|---|---|
| **Hardware: no bare-metal numbers** | Platform engineer evaluating whether this component is worth integration; hiring manager checking whether results transfer beyond one nested developer setup. | Portable existing ledger on phoenixNAP Altra plus short AWS Graviton confirmation. **E:** 1–2 engineer-days, **$15–25** planned cash. | Honest hardware/performance section, a defensible talk/CV link, baseline for further changes. |
| **Headline/scale proof** | Systems audience asking whether cheap waiting guests are real; potential operator with many small pending runs. | First 1K→10K nonce WAIT/resume on one 128–256-GB host. **E:** 2–4 days total, **$10–20** block. | Demonstrates scheduling/memory behavior with an auditable state contract; reveals actual bottlenecks. |
| **Outside reproduction** | Maintainer/operator who cannot trust a one-machine internal receipt. | Smaller-count script and raw bundle; ask an accepted Ampere/Arm/university host or another engineer to reproduce. **E:** 0.5–1 day artifact effort, **$0 donated or $2–10 rented**. No request sent here. | Independent evidence and a second-machine CI candidate; not an external security audit. |
| **Million resident count** | Mostly visibility/CV today; customer need only if waiting population/SLO demands it. | 768-GiB/1-TB reserved block after all previous gates. **E:** 5–10 days total, **$100–150 cap**. | Strong narrow capstone if it passes; little additional user value over a clear 10K result until a real workload needs it. |
| **x86 reach / tenant operations** | Most cloud adopters; anyone exposing it to real tenants. | Not solved by a recorded ARM demo. Kernel port remains weeks; containment/parity need their own workstreams. | The headline is not a substitute for these product prerequisites. |

**I — Audience-specific claims:**

- **CV / interview, today:** “Built an aarch64 KVM runtime for short tool programs; implemented shared snapshot reset and thread-free waits. Existing nested benchmark: ~1.1-ms one-tool API p50, ~1.7 CPU-ms/run; shard ~0.5 MiB marginal under the stated fixture.” Link the limitations and current code. After metal, replace the timing row with the actual metal result and host; do not remove the historical evidence.
- **KL/SEA meetup:** show C live, B from a verified capture, then the failure/measurement lesson. The claim is concrete execution and honest scaling work, not one million local laptop VMs or a newly launched cloud.
- **Short post:** A's fully qualified cumulative counter, or B's guest-state challenge, with raw logs and a 30–60-second clip. Keep “cumulative”/“resident”/“recorded” visible in the image, not only in a reply.
- **Technical post/deck:** E's complete ledger, §4's limiting resource, and an independently repeatable smaller test. Only show D as achieved when the full-count evidence exists. No blanket faster/cheaper/more secure claim against a full Linux service follows from this fixture.

**I/E — Suggested sequence for one person:** day 1 portable baseline/evidence; day 2 Altra capture plus Graviton confirmation; days 3–4 nonce WAIT demo and laptop talk cut. Offer the reproduction bundle next. Give the resident-million attempt a separate maximum of one further working week and the stated server budget. Application/credit requests can happen alongside that work, without being a prerequisite for spending a few dollars on a verified machine.

## Ranked top 3 moves

1. **I — Produce one clean metal ledger, then confirm on a second CPU family.** **E:** 1–2 engineer-days; six Altra hours +two c7g hours **$10.58 compute**, budget **$15–25**. It closes the Hardware gap and resolves the current nested timing ambiguity at the lowest cost.
2. **I — Ship the 10K WAIT/challenge recording and the eight-guest offline laptop talk.** **E:** another 1–3 days, **$10–20** host/rehearsal budget. It makes the resource claim legible to KL/SEA engineers and interviews while exercising the real waiting architecture.
3. **I — Attempt a resident million only after measured 16K/64K/128K gates and a working multi-holder collector.** **E:** up to one further week, **$100–150 hard budget**; m8g 768 GiB or quota-approved OCI A1 1 TB. Otherwise publish the largest passing count and its first failing resource.

## The ONE move to do first

**I — Make the current small-N memory and full-executor latency ledger reproducible on a fresh 4-KiB-page ARM metal host, then run it for six hours on phoenixNAP Amsterdam (or Singapore if that is where stock is available).** Have c7g On-Demand as the short confirmation/fallback. The first output is a pinned receipt showing correct results, total and marginal memory, queue/result/release timings and every failure—not a million-counter UI. This is days and dollars, and every stronger demo depends on it.

## Five-line TL;DR

1. **F/I:** ARM bare metal can be brief and cheap: phoenixNAP **$0.99/h**, c7g Stockholm Spot listed **$0.2825/h**, and OCI A1 may use a paid tenancy's unused allowance; prices checked **2026-10-28**.
2. **M:** Today's ~0.5 MiB is a small-fixture shard slope; full executor is ~0.66 MiB, Hyperlight is slightly lower, and metal timings remain unmeasured.
3. **F/I:** Current 64/16,384-slot checks, fd/maps/commit/notifier costs and VMID rollover need explicit handling; **8/16-bit VMIDs are a performance constraint, not a hard resident-VM cap**.
4. **I:** Label a million cumulative executions, concurrent resident guests and scaled-to-zero snapshots as different achievements; prove count with a barrier, raw lifecycle records and a nonce wake test.
5. **I:** Do a **$15–25 metal ledger**, then **10K waiting guests plus an offline laptop talk**; treat the million-resident run as a separately gated **$100–150 capstone**.

## Rejected ideas

- **“A million VMs for a nickel.”** Ideal CPU allocation is not the measured rental invoice, new-VM count or residency cost.
- **A 256/512-GiB box sized solely by 0.5 MiB×1M.** The former cannot fit it; the latter has inadequate headroom and fails at the measured one-tool slope.
- **One million calls to the current `execute()` equals one million new VMs.** The shard resets persistent VM slots.
- **One giant holder with only a higher `ulimit`.** Owner checks, the in-code hard fd clamp, VMA/commit costs and notifier fan-out remain.
- **8-bit VMIDs mean at most 255 resident VMs.** Linux recycles tags across generations; wake performance, not that resident count, is the issue.
- **Hetzner RX/Equinix as immediately available rentals.** Primary status pages make the old recommendations stale.
- **Cheap ARM VMs / dedicated vCPUs as bare-metal proof.** They do not establish EL2 access or eliminate nesting.
- **Wait for startup/university credits before benchmarking.** Eligibility and allocation delay can exceed the value of the saved $10.
- **Buy a large ARM workstation or port x86 for this video.** Capital and engineering time exceed a short rented experiment.
- **Million fake pixels, snapshots or constant host-generated answers counted as resident guests.** They fail the stated object/state/liveness contract.
- **A million real LLM agents or internet tool calls.** Model/API costs and rate limits dominate; they answer a different question.
- **Live cross-host “pull the plug” as this round's headline.** Prepared reset snapshots are not arbitrary durable continuation/migration support.
- **Public arbitrary-code event as a prerequisite.** The Hardware gap can be closed with reproducible local/recorded fixtures; public-service prerequisites belong to separate work.
