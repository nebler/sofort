# Hosting, tenancy, operations and x86_64: earn the cloud before operating it

Research date: **2026-10-28**. Scope: the **Multi-tenancy**, **Operations**, and **Hardware: x86_64** rows of [PRODUCT-GAPS](../../PRODUCT-GAPS.md), especially order items **5 and 6**. Research only; no infrastructure was provisioned, no accounts created, no purchases, deployments, outreach, commits or pushes. Only this report is written.

**Labels:** **F** = sourced fact or directly inspected code; **M** = an existing repository measurement, attributed to its original experiment, **not a measurement performed for this report**; **I** = inference/recommendation; **E** = estimate, proposed acceptance criterion or arithmetic scenario. All web sources were checked **2026-10-28**; a date beside an announcement is its publication/update date. Unless stated otherwise, prices are public USD list prices before tax, credits, commitments, storage, IPv4 and network charges. Monthly equivalents use **730 hours**; dividing a monthly price by 730 does **not** make a monthly contract hourly cancellable. No currency conversion is assumed.

## 1. Decision: a short hosted demonstration, yes; an unattended public service, no

**I — Preserve the gap document's sequence.** Obtain metal evidence and independent reproducibility, fix Linux parity and shard containment, and stabilize the public execution contract before inviting people to depend on a hosted executor. Then implement the small part of item 5 that actual tenants require. Do **not** spend six to ten weeks on x86 merely to avoid renting ARM metal for a demonstration.

Three different releases should not be called the same “beta”:

| Release | Worth doing before full item 5 / item 6? (**I**) | Minimum scope and incremental effort (**E**) | Money (**E**) / evidence it buys |
| --- | --- | --- | --- |
| **Scheduled public demo, fixed programs** | **Yes / yes**, after the metal/setup work. Can precede arbitrary-input containment work only if the public cannot supply code, binaries, tools, URLs or payloads | 2–4 days: server selects an allowlisted fixture, bounded admission, metrics receipt, global stop switch, predetermined rental window | One 8-hour ARM worker: **$18.12 Malaysia / $21.32 Singapore**, plus a **$5–15 allowance** for disk/network/cleanup. Shows real execution and operational judgment |
| **Invite-only editable playground, 3–5 builders** | **Yes before full billing; no before minimal tenancy/ops.** After items 3–4 | 3–5 days for the playground after the common runtime prerequisites; use the keys, limits and diagnostics below | A second 8-hour session costs the same worker rental; several sessions can remain **below $100 compute**. Tests whether anyone returns with a useful program |
| **Always-on hosted beta** | **Only with a named design partner and recurring workload**; after minimal item 5, usually before item 6 | **10–15 days** for a deliberately small shared control plane and operating procedure, excluding unresolved items 2–4 | Current ARM metal examples start around **$1,654/month** for a whole c7g.metal in Malaysia. A second failover host adds another host bill. A public URL alone does not justify this |

**I — “Before tenancy” must not mean unauthenticated arbitrary compute.** The first release can avoid a tenant product by offering only server-selected fixtures. Editable code needs keys, admission limits, bounded authority and the containment prerequisites even if nobody pays. Full billing, organizations, roles and a customer portal can wait.

**I — Define a stop rule before building the editable version:** after two demo sessions, continue only if at least two external builders return, one supplies a real integration/workload, and the work requires jitk's execution boundary or selected native binaries. These are proposed discovery criteria, not observed demand. A hiring manager's interest is valuable for the capstone, but is different evidence from willingness to operate or buy the runtime.

### What the new evidence changes in the earlier research

- **M — Current performance:** [copy-restore results, Oct 28](../../jitk/bench/RESULTS-copy-restore-2026-10-28.md) report one-tool `execute()` **1.10 ms p50 / 1.86 ms p99**, **1.72 total CPU-ms/run**, and **691 sequential runs/s** in the one-slot cell. These supersede the old Mac/process-per-VM economics in [pitch 02](../pitch/02-hosting-landscape.md), [03](../pitch/03-agentic-coding.md) and [04](../pitch/04-scale-and-economics.md). All are **nested HVF → KVM, indicative**, not a cloud throughput guarantee. Multi-slot results are explicitly bimodal; do not extrapolate a single fast repetition to a fleet.
- **M — Memory:** the [Oct 27 memory comparison](../../jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md) and [R7 real-guest ledger](../../jitk/shard/RESULTS-R7-shard.md) establish roughly **0.5 MiB marginal per small VM**. Hyperlight is roughly at parity, about 4% lower in the matched small configuration. [perf/SUMMARY](../perf/SUMMARY.md)'s “port the real guest” projection is historical now. Configured E2B/Modal memory is a billing allocation, not a measurement of their physical overhead.
- **F — Source state:** inspected the working checkout at HEAD `08732694`, including [kernel/ARCH.md](../../jitk/kernel/ARCH.md), ARM boot/trap/MMU/wait code, [ring ABI](../../jitk/kernel/src/ring_abi.rs), [KVM backend](../../jitk/shard/src/kvm/mod.rs), [reset](../../jitk/shard/src/kvm/reset.rs), [snapshot metadata](../../jitk/shard/src/snapshot.rs) and [owner metrics](../../jitk/shard/src/owner.rs). The architecture extraction exists; x86 implementations do not. No build, VM or benchmark was run here.
- **F/I — R9 is a dated review, not today's complete status:** [R9-ARCH-QUALITY](../../review/R9-ARCH-QUALITY.md) identifies channel-wide failure, snapshot/setup, ABI, containment and watchdog-authority problems. Oct 28 work fixes important reset/admission issues; it does not by itself certify all R9 findings closed. Hosting must recheck the actual release, especially guest-error blast radius and supervisor-owned deadlines. Do not repeat old “double reset still present” wording after the new reset work.
- **F — Hosting assumptions have moved:** AWS documents nested KVM on selected Intel virtual instances; GCP **C4A metal** exists even though **C4A VMs cannot nest**; Equinix Metal has ended service; Hetzner's old ARM RX line is no longer orderable on its website. Sources and qualifications follow.
- **I — Positioning survives:** [demo.md](../../../demo.md) and pitch 01–09 correctly favor the embeddable tool-program runtime and a tangible bounded demo over another general agent-computer cloud. This report adds the operating plan and actual host budget, rather than repeating their launch narratives. The relevant flip/flip2 conclusions also apply: an oracle or faster implementation loop does not remove integration, hardware access, capacity planning or recovery work.

## 2. Where jitk can actually run

### 2.1 The eligibility test

**F — `/dev/kvm` is an API contract, not a CPU brand.** Linux KVM starts with opening that device, then `KVM_CREATE_VM` and `KVM_CREATE_VCPU`; a provider saying “KVM-backed”, “dedicated vCPU”, “ARM” or “Firecracker” does not promise those operations to a customer guest. [Linux KVM API](https://docs.kernel.org/virt/kvm/api.html).

**I — For each candidate, require a future release smoke test:** native Linux of the correct ISA; readable/writable `/dev/kvm`; create/run/reset a real jitk guest; supported host page size and snapshot format; hostile dirty/register reset tests; watchdog escalation; then the same one-tool and concurrency workload. Root access without virtualization extensions is insufficient. Provider documentation establishes eligibility; no host below has been tested by this research.

**F/I — Extra ARM portability trap:** [copy-reset source](../../jitk/shard/src/kvm/reset.rs) currently falls back to discard on a host page size other than **4 KiB**. Its cache-coherency reasoning explicitly calls for a metal test without FEAT_S2FWB, such as Neoverse N1. An Ampere host or a 16/64-KiB-page OS therefore needs its own correctness and performance receipt. “ARM works” is not an artifact-independent claim.

### 2.2 ARM options available without an x86 port

| Provider / shape | Documented access (**F** unless marked) | Price/hour and commitment | Geography / decision (**I** unless sourced) |
| --- | --- | --- | --- |
| **AWS `c7g.metal`, 64 cores, 128 GiB** | Bare metal permits running your hypervisor; the nested-virtualization announcement distinguishes this existing capability from virtual EC2. Graviton virtual instances are absent from the supported nested families | **$2.3200 us-east-1; $2.6656 Singapore; $2.6656 Jakarta; $2.2656 Malaysia**. Linux On-Demand shared-tenancy products, retrieved from AWS's price catalog, publication **Oct 27, 19:30:04Z** | **Best documented short ARM rental for this project.** Malaysia is a real, region-specific price candidate for the KL story, not a need to move the service there. A priced SKU is not a capacity reservation |
| **GCP Axion `c4a-highmem-96-metal`, 96 cores / 768 GiB** | C4A metal explicitly targets custom hypervisors; GA **May 27/28, 2026** according to release notes/blog. This is distinct from C4A VM nesting | Official general-purpose price table displays **$5.65824/hour in its default Iowa selection**; disk extra. `c4a-standard-96-metal` also exists, but no specific price is asserted here | Real ARM alternative, oversized for a solo demo. The current metal location matrix includes Frankfurt/Netherlands and selected US zones, **does not list C4A metal in Singapore or Jakarta**. An Axion VM's region dropdown does not establish metal availability |
| **Oracle `BM.Standard.A1.160`, 160 cores / 1,024 GB** | OCI documents the ARM bare-metal shape. Oracle's KVM requirements allow ARM bare-metal hosts. **I:** this makes it a credible candidate, still requiring the actual-image KVM test; it is not proof that the free A1 VM exposes KVM | A1 **$0.01/OCPU-hour + $0.0015/GB-hour**, same advertised rates across regions. **E:** 160 × .01 + 1,024 × .0015 = **$3.136/hour**, about **$2,289/month**, boot volume extra | Capacity/quota and specific shape availability need checking. Oracle has Singapore and Malaysian regions; a region's existence is not a BM.A1 stock promise. Do not substitute an A1 Free Tier VM for this metal budget |
| **Hetzner RX ARM dedicated** | Current docs describe RX170/RX220 as **former models, no longer available on the website** (updated **Jun 15, 2026**) | **No currently verified new-order hourly price**. Historical RX170 prices are not a hosting recommendation | Do not build the beta plan around getting one. Existing customer hardware or auction inventory is a separate, unverified opportunity |
| **Existing ARM Linux machine, e.g. owner's Asahi box** | Repository direction; access depends on the actual Linux installation and release tests | **E:** $0 incremental rental, plus existing power/connectivity; **1–2 days** to reproduce/reference if setup already works | Cheapest experiment and recording location. Home internet, physical power and one laptop are weak foundations for someone else's recurring jobs; do not label it a reliable hosted region |

Primary sources for this table: [AWS nested launch, Feb 16](https://aws.amazon.com/about-aws/whats-new/2026/02/amazon-ec2-nested-virtualization-on-virtual/), [current EC2 nested guide](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/amazon-ec2-nested-virtualization.html), [AWS public EC2 price data](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2.json), [EC2 On-Demand terms](https://aws.amazon.com/ec2/pricing/on-demand/); [Google C4A metal announcement, updated May 28](https://cloud.google.com/blog/products/compute/new-axion-c4a-metal-offers-bare-metal-performance-on-arm), [Google metal types/locations, updated Oct 26](https://docs.cloud.google.com/compute/docs/instances/bare-metal-instances), [GCP price table](https://cloud.google.com/products/compute/pricing/general-purpose); [OCI shapes](https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm), [A1 rates](https://www.oracle.com/europe/cloud/compute/arm/), [Oracle Linux KVM requirements](https://docs.oracle.com/en/operating-systems/oracle-linux/9/kvm-user/kvm-SystemRequirementsandRecommendations.html); [Hetzner former RX models](https://docs.hetzner.com/robot/dedicated-server/server-lines/apple-rx-server/).

**F — Price retrieval detail, for auditability:** no authenticated AWS API was used. The public [us-east-1 CSV](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/us-east-1/index.csv) and equivalent `ap-southeast-1`, `ap-southeast-3`, `ap-southeast-5` URLs identify the OnDemand/Linux/Shared/NA-software/**Used** products. Ignore zero-dollar **Reservation** capacity-status rows. The much smaller `ec2.json` maps the matching regionless rates across regions. Example c7g.metal SKUs: US **X8WMCBBQRGYPG6JY**, SG **ZZ2B9WR4K8AA68B7**, Jakarta **EH7W2QMT9RWRD6P3**, Malaysia **ANCH4W6B7RR4QZ4B**. Values were parsed in memory; no downloaded dataset is left in the checkout.

### 2.3 x86 options after the port, and misleading near-options

| Provider | Nested KVM / metal evidence | Representative price, checked Oct 28 | What it unlocks / limitation (**I**) |
| --- | --- | --- | --- |
| **AWS Intel VM** | Current guide lists C7i/C7i-flex, C8i/C8id/C8i-flex, M7i/M8i variants, R7i/R8i variants and selected storage families. KVM supported; launch with `NestedVirtualization=enabled`; no nesting surcharge. Feb launch named only C8i/M8i/R8i, so the current guide is broader | **c7i.large**, 2 vCPU / 4 GiB: **$0.08925 US, $0.10290 SG/Jakarta, $0.08747 MY**. **c8i.large:** **$0.09371 US, $0.10805 SG, $0.09184 MY**; no Jakarta rate was found in the inspected catalog | A roughly **$64–79/month worker** before disks/IP; use a documented regular instance rather than extrapolating support to every Nitro VM. AWS recommends metal for strict performance requirements |
| **AWS x86 metal** | Direct hardware rather than nested VM | **c7i.metal-24xl**, 96 logical vCPU: **$4.284 US, $4.9392 SG/Jakarta, $4.19856 MY** | Useful comparison/reference; expensive idle beta host. SMT threads are not 96 ARM-like physical cores |
| **GCP Intel N2 / supported newer x86 families** | Linux KVM nesting supported; enable nested virtualization and allow it in org policy. Docs exclude E2, memory-optimized VMs, ARM VMs, and AMD except **N4D**. Current blanket “Intel only” advice is therefore stale too | **n2-standard-2**, 2 vCPU / 8 GiB, **$0.097118/hour Iowa** in official table. Quote SG/Jakarta separately before ordering; this is not a SEA price | Affordable development/second-machine host after port. Google warns of **10% or greater** CPU-bound overhead; measure instead of applying a universal multiplier |
| **GCP Axion C4A / N4A / Tau T2A VMs** | ARM virtual instances are explicitly excluded from nesting | **Not eligible**, even where a small ARM VM is cheap | C4A metal is the exception described above. Neither Axion's CPU features nor a dedicated/sole-tenant VM removes this documented restriction |
| **Azure Dsv6 / Dasv6 x86** | Series feature tables explicitly support nested virtualization. Use a compatible Linux image/security configuration and validate KVM; do not infer support from every D-series name | Public Retail Prices API: **Standard_D2s_v6 Linux, East US $0.101/hour; Southeast Asia/Singapore $0.126/hour**. No ordinary matching Malaysia West D2s_v6 meter was returned by the filtered query | About **$92/month compute in Singapore**, after x86. Keep VM SKU availability distinct from the existence of Azure's Malaysia region |
| **Azure Cobalt Dpsv6 ARM** | Feature table says **nested virtualization not supported** | **Not eligible for today's jitk** | ARM hosting alone does not solve hardware access |
| **Hetzner Dedicated x86** | Dedicated-server virtualization documentation explicitly covers **Linux KVM / Proxmox**; full hardware access. Cloud dedicated-vCPU CCX is a different product | Current June price adjustment lists **AX42-1 €97.30/month, €49 setup, excluding IPv4/VAT** → **€0.1333/hour equivalent**. This specific listed configuration is not the old €35–50 headline; server auction and other SKUs need their own live quote | Credible low fixed monthly cost after x86, especially Germany/Finland. Do not present the monthly quotient as an 8-hour rental |
| **Hetzner Cloud, including ARM CAX and x86 CCX** | Cloud FAQ explicitly says nested virtualization is not possible | **No eligible jitk-worker price** | Singapore Cloud presence and “dedicated resources” do not expose `/dev/kvm`; an x86 port does not change this |
| **OVH Dedicated x86, Singapore** | Dedicated physical servers; **I:** KVM candidate subject to firmware/image smoke test | SG dedicated page advertises **Advance-1 from US$136/month + $136 installation** → **$0.1863/hour equivalent**, **$272 first-month starting bill** | Regional metal at a plausible small-service budget, after port. Confirm actual selected location/configuration, delivery and commitment; page has several offers and “from” prices |
| **OVH Public Cloud x86** | FAQ says VMX exposed and nested VMs work, **but live migration can cause a kernel panic** | SG b3-8 pricing **S$0.0768/hour**; from **Oct 1** local storage/IPv4 are separate | A disposable test host, not the default reliability recommendation. The documented migration caveat is material to an always-on service |
| **Latitude.sh x86 metal** | Bare-metal product; **I:** direct KVM candidate, not a claim about a nested VM product | Exact **Singapore f4.metal.medium** row: 16 cores / 128 GB, **$1.96/hour on demand**, **$715/month reserved**. Listing's “starting at” prices can be reserved rates; do not quote them as hourly on demand | API-driven SG metal after x86; more expensive than a small dedicated box. No orderable ARM CPU metal SKU was verified in its inspected catalog |
| **Vultr x86 metal** | Official Proxmox guide explicitly sends KVM users to Bare Metal and says Cloud Compute cannot use KVM | Public plans API: **vbm-4c-32gb**, 4 cores / 32 GB, **$0.164/hour, $120/month**, `sgp` in locations. Marketing overview says **from $0.179/hour**; report the discrepancy, recheck order screen | A small SG metal candidate after port. Plan location listing is not inventory confirmation. The API's invoice-type field is monthly; confirm actual hourly/cancellation treatment before promising a short rental |
| **Vultr Cloud Compute** | Same official guide explicitly excludes KVM nested guests | **No eligible jitk-worker price** | A cheap VPS in Singapore does not solve this problem |
| **Equinix Metal** | **Ended service June 30, 2026**; docs removed Oct 1 | **Unavailable** | Old ARM c3.large.arm64 recommendations are obsolete |
| **Equinix alternatives: phoenixNAP and Latitude/Vultr** | Independent suppliers, not an inherited Equinix service. phoenixNAP offers automated physical servers; Latitude/Vultr publish Metal migration material | phoenixNAP example **s2.c1.small**, 6 cores / 64 GB, **$0.17/hour or $97.31/month**. This is a catalog example, **not verified Singapore stock** | Compare actual site/SKU/network terms. “Equinix successor” does not preserve its ARM availability or prices |
| **Fly Machines / Sprites** | Fly operates Firecracker internally. Fly's published team response says **nested virtualization not supported** (Mar 28, 2023); no current customer KVM entitlement was verified | **N/A as a jitk KVM worker** | Good conceptual ops reference or HTTP front end; not evidence that jitk can run inside a Fly Machine. Firecracker underneath a product does not grant nested KVM |

Sources: [AWS current nested guide](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/amazon-ec2-nested-virtualization.html), [AWS price catalog](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2.json); [Google nesting restrictions, Oct 26](https://docs.cloud.google.com/compute/docs/instances/nested-virtualization/overview), [Google pricing](https://cloud.google.com/products/compute/pricing/general-purpose); [Azure Dsv6](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/dsv6-series), [Dasv6](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/dasv6-series), [Dpsv6 ARM](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/dpsv6-series), [public Retail API and filters](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices); [Hetzner dedicated-server KVM documentation](https://docs.hetzner.com/robot/dedicated-server/virtualization/general/), [June 2026 price list](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), [Cloud FAQ](https://docs.hetzner.com/cloud/servers/faq/); [OVH Singapore metal](https://www.ovhcloud.com/asia/bare-metal/dedicated-server-singapore/), [OVH nested caveat](https://docs.ovhcloud.com/en/guides/public-cloud/cross-functional/faq-pci), [SG Cloud prices](https://www.ovhcloud.com/en-sg/public-cloud/prices/); [Latitude exact regional price](https://www.latitude.sh/pricing/f4-metal-medium?metalCategory=memory-optimized); [Vultr KVM restriction](https://docs.vultr.com/how-to-install-proxmox-virtual-environment-on-debian-11), [public metal plans API](https://api.vultr.com/v2/plans-metal), [marketing price](https://docs.vultr.com/product-overviews/bare-metal); [Equinix shutdown](https://docs.equinix.com/goodbye-metal/), [phoenixNAP catalog](https://phoenixnap.com/bare-metal-cloud/instances), [Latitude migration positioning](https://www.latitude.sh/blog/equinix-metal-sunset-how-to-reduce-the-migration-burden); [Fly team answer](https://community.fly.io/t/nested-virtualization-on-fly-io/11778), [Fly's current Firecracker description, Sep 9](https://fly.io/learn/firecracker-vs-gvisor/).

**F — Azure price query boundary:** queried the unauthenticated Retail API for `serviceName eq 'Virtual Machines'`, `armSkuName eq 'Standard_D2s_v6'`, `priceType eq 'Consumption'`, and regions `eastus`, `southeastasia`, `malaysiawest`; excluded Windows, Spot and Low Priority. Returned Linux meters were $0.101/$0.126, effective **2024-10-01**. An absent meter is not proof of permanent regional unavailability.

### 2.4 SEA recommendation

**I — Pick one location, based on the audience and real callbacks.** For a KL-oriented public demonstration, **AWS Malaysia ARM metal for a scheduled session** is a defensible starting choice: named eligible shape, public region price, no x86 prerequisite. Singapore is a fallback with a broader set of post-port dedicated alternatives; Jakarta has the same quoted c7g price as Singapore. Do not build three regions for a portfolio demo.

**F/I — Regional caveats:** Google's current metal matrix distinguishes Singapore's x86 metal from its absent listed C4A metal and Jakarta's absent listed metal. OCI's published region lists include Singapore, Kulai and Batam; that is not a Jakarta ARM-metal claim or a promise of A1 capacity. Azure's Singapore price is verified above; Malaysia's selected SKU was not. [GCP locations](https://docs.cloud.google.com/compute/docs/instances/bare-metal-instances), [OCI regional identifiers](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm).

**E — Network sensitivity:** five sequential remote host-tool callbacks at an assumed **20 ms RTT** add about **100 ms**, even if local VM execution takes about 1 ms. Put the trusted tool gateway beside the shard, or make a tool round trip batch meaningful work. Show browser RTT and server execution separately; Germany↔SEA latency must not become a “jitk is slow” or a fake 1-ms internet result.

## 3. Economics: cheap CPU does not imply a cheap hosted service

### 3.1 What the measured number buys in a model

**M:** use **1.7 CPU-ms/run**, rounded from 1.72, for the repository's tiny one-tool workload only. It includes Node/shard/watchdog in the cited experiment, not a large user program, remote tools, hosted ingress, a durable event write, telemetry or idle fleet capacity.

**E — Reproducible model:**

```text
1,000,000 × 1.7 ms = 1,700 CPU-seconds = 0.472222 CPU-hours
compute dollars / million = (0.472222 × host dollars/hour) / (usable cores × utilization)
full-month allocated cost / million = (730 × host dollars/hour) / millions actually completed
```

Here utilization is the share of the chosen CPU capacity actually turned into completed workload CPU. It includes idle time/capacity slack; do not add the same slack again. CPU scaling, ISA equivalence and usable-core counts are hypotheses until measured on that host.

| Host model (**E**, using the sourced rates above) | CPU-only $/M at 100% modeled utilization | At 30% | Always-on compute/month; allocation if only **1M runs/month** |
| --- | ---: | ---: | ---: |
| c7g.metal Malaysia, 64 physical ARM cores | **$0.0167** | **$0.0557** | **$1,653.89 → $1,653.89/M** |
| c7g.metal Singapore/Jakarta, 64 cores | $0.0197 | $0.0656 | $1,945.89 → $1,945.89/M |
| c7g.metal US East, 64 cores | $0.0171 | $0.0571 | $1,693.60 → $1,693.60/M |
| GCP C4A highmem metal Iowa, 96 cores | $0.0278 | $0.0928 | $4,130.52 → $4,130.52/M |
| OCI A1 metal, 160 cores | $0.0093 | $0.0309 | $2,289.28 → $2,289.28/M |
| **Post-port hypothetical** c7i.large SG, conservatively **one usable physical-core equivalent**, not two fully productive SMT cores | $0.0486 | $0.1620 | $75.12 → $75.12/M |
| **Post-port hypothetical** Vultr 4 physical cores, using API hourly rate | $0.0194 | $0.0645 | $120 stated monthly cap → about $120/M |

**I — These are CPU arithmetic scenarios, not benchmark results or a proposed selling price.** The measured Node front end is not proven to feed all 64 cores; multiple independent executors/shards may be required. Nested multi-slot variance and the single-slot 691 runs/s make linear fleet extrapolation particularly unsafe. Different cores do not execute the same work in the same time. RAM, KVM object limits, file descriptors, ingress, tool budgets, reset failures and placement can bind first.

**E — The direction is still useful:** a six-day campaign with **8 rental hours/day in Malaysia costs about $109 compute**. Porting x86 to save that rental consumes **24–52 engineer-days**, depending on scope. Conversely, a genuinely needed always-on beta could save roughly **$1,500/month** by moving from an idle ARM metal host to a $120 x86 metal box. That is a reason to revisit the port **after evidence of recurring demand**, not evidence that hosting must wait for it.

### 3.2 Compare retail products without pretending to have run their benchmarks

**F — Current rates:** E2B charges **$0.000014/vCPU-second + $0.0000045/GiB-second**; its default 2-vCPU/4-GiB shape is **$0.000046/second**. Hobby has no subscription fee; Pro **$150/month** plus usage. Modal **Sandbox** CPU is **$0.00003942/physical-core-second**, memory **$0.00000667/GiB-second**; a physical core is two vCPU equivalents, requests floor billing, and Sandboxes use non-preemptible rates. Its ordinary Functions CPU/memory rates are lower, so using Function rates as Sandbox rates is incorrect. [E2B pricing](https://e2b.dev/pricing), [Modal pricing](https://modal.com/pricing), [Modal Sandbox resource accounting](https://modal.com/docs/guide/sandbox-resources).

| Product / clearly stated scenario | Retail cost per million (**E**, excludes free allowances and ancillary charges) | Interpretation |
| --- | ---: | --- |
| **E2B**, default 2-vCPU/4-GiB, **1 billable second per separate run** | **$46** | Scenario, **not a verified per-sandbox minimum**. At a purely hypothetical 1.7-ms billable lifetime the same rate gives **$0.0782**. Actual creation, execution and shutdown duration has not been measured here |
| **Modal Sandbox**, 1 physical core / 4 GiB, **1 billable second/run** | **$66.10** | Chosen to match E2B's 2-vCPU-equivalent/4-GiB allocation, **not Modal's smallest request**. Hypothetical 1.7-ms billable lifetime: **$0.1124**. Modal's max(request, actual) rule and actual lifetime determine the bill |
| **Lambda Event Function ARM**, 1,769 MiB (documented one-vCPU-equivalent allocation), **2-ms billed duration**, one small request/run | **about $0.2461**, including **$0.20/M requests** | Uses **$0.0000133334/GB-second**, 1-ms duration granularity. Assumes this workload completes within that duration; no Lambda workload was benchmarked. Fresh function invocation does not guarantee a newly created hardware VM |
| **Lambda MicroVM**, 1 vCPU / 2 GB baseline, **1 billable second/run** | **$35.0278 compute** | At **$0.0000276944/vCPU-second + $0.0000036667/GB-second**; snapshot reads/writes/storage and transfer extra. Hypothetical 1.7-ms lifetime: **$0.05955**, not a promised billable lifetime. Images have a one-week minimum storage retention |
| **Cloudflare Workers**, 1 request and **1.7 ms of Cloudflare-billable CPU/run** | **$0.334** | $0.30/M requests + $0.02/M CPU-ms. This **does not assert** that the JS work uses the same CPU time as jitk's complete system |
| **Dynamic Workers**, same CPU/request model, a **new `.load(code)` each run** | **$2,000.334** before included creations | $0.002 per creation dominates. A stable `.get(id)` reused for identical code amortizes creation over requests; changing ID or code changes creation accounting |

Sources: [AWS Lambda pricing, including current MicroVM examples](https://aws.amazon.com/lambda/pricing/), [Lambda CPU/memory allocation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-memory.html), [Cloudflare Workers rates](https://developers.cloudflare.com/workers/platform/pricing/), [Dynamic Workers creation/CPU rules, updated Jun 11](https://developers.cloudflare.com/dynamic-workers/pricing/).

**F/I — Credits and reuse matter:** Workers Paid starts at **$5/month**, with 10M requests and 30M CPU-ms included; the table is marginal-rate arithmetic, not a $0.334 minimum invoice. Dynamic Worker creations have been billed since **May 26, 2026**; the old [cloudflare.md](../cloudflare.md) “not yet charged” statement is stale. E2B's credits, Modal's Starter credits, and Lambda's free allowance can cover a small experiment. Reusing a larger sandbox for many snippets amortizes billing and startup, but changes the lifecycle/isolation comparison. Neither Lambda nor Cloudflare is a documented `/dev/kvm` host for today's jitk; these rows compare buying execution against operating it.

**I — Commercial implication:** do not compete on a nickel-per-million promise. A useful price can pay for the trusted capability service, compatibility, integration and operational responsibility. An intermittent independent builder is often better served by an incumbent's free/usage tier or by embedding jitk locally than by subsidizing an idle ARM host.

## 4. Minimal tenancy and metering: a small trusted gateway above the VM

### 4.1 What must be tenant-aware

**F — The existing VM boundary is not tenant administration.** The shard already has slots, generations, reset invariants, admission machinery and owner metrics. It does not supply the product's users, API credentials, balances, per-customer authority, invoices or a customer-visible usage ledger. [Owner lifecycle/metrics](../../jitk/shard/src/owner.rs), [reset invariant](../../jitk/shard/src/kvm/reset.rs), [gap table](../../PRODUCT-GAPS.md).

**I — Default implementation uses only open-source building blocks:** the existing trusted TypeScript gateway, PostgreSQL, systemd, Caddy/HAProxy, OpenTelemetry and Prometheus/Grafana OSS. Add **Valkey** only when more than one admission node needs shared fast counters. No Kubernetes, identity provider, Kafka or billing vendor is required for five invited users. Envoy's external rate-limit service is an alternative when Envoy is already in the deployment, not a reason to install it solely for this beta. [Valkey](https://github.com/valkey-io/valkey), [Envoy rate-limit filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/rate_limit_filter).

**I — Proposed request path:** HTTPS → authenticate key → resolve tenant/policy server-side → reserve quota and slot → execute through the existing executor → emit a durable completion/unknown-outcome record → release reservation → return receipt. Never accept `tenant_id`, tool permissions or a billable CPU amount merely because the client supplied them.

| Piece | Small credible design (**I**) | Effort (**E**) / value |
| --- | --- | --- |
| **Tenant + API keys** | `tenants`, `api_keys` tables. Generate 256-bit random bearer keys; show once; store a public key ID/prefix and HMAC/digest, never plaintext. Map to tenant, scopes, expiry, status. Operator CLI creates/revokes/rotates them; no signup UI | **0.5–1 day**. Revocation and attribution are useful before charging |
| **Policy/authority** | Resolve allowed artifact/profile, tools and output limits from tenant configuration. Tool credentials stay in the trusted broker; bind every call/result/cache entry to tenant + request + slot generation. Separate tenants' tool state and packed resources | **1–2 days**, excluding containment fixes. Prevents one API key borrowing another tenant's tools/data |
| **Rate and concurrency limits** | A per-tenant token bucket plus per-IP invalid-auth throttle. Initial illustrative limits: **2 runs/s, burst 5, 2 concurrent runs**, bounded queue and a global concurrency ceiling. Reject with 429 + Retry-After. Key rotation does not create a fresh tenant quota | **0.5–1 day** on one gateway. Multi-host counters/leases add **1–2 days** |
| **Hard quotas** | PostgreSQL atomic reservation for daily runs and CPU/work budget; concurrency leases expire after supervised termination. Reserve the maximum authorized work before starting, reconcile once on terminal state; fail closed on quota-store failure. Count waiting jobs against concurrency, not guest CPU | **1–2 days**. Prevents accidental loops and many-key bypass. Reconcile abandoned reservations after a crash |
| **Usage + read API** | Append-only events + transactional outbox; `GET /v1/usage` reads tenant-scoped aggregates. Account separately for admitted requests, completed runs, user errors, platform failures, cancellations and unknown outcomes | **1–2 days**. A trustable receipt and export matter before a pricing engine |
| **Invoice hook** | Export a monthly tenant summary/CSV initially. After a buyer agrees to a price, deliver events through an outbox adapter to one selected billing system | **0.5 day** CSV; **2–4 days** for an initial tested metering/billing adapter, excluding finance/tax/payment onboarding |

**E — Combined tenancy/usage core:** approximately **4–7 focused days**, with overlap among the rows, **$0 software license cost**. The tables/counters can share the rented worker for a short demo. Separate low-cost control-plane storage/monitoring for a recurring service: allow **$10–30/month** as an estimate, plus backup storage. This is additional to the worker, not a researched provider quote.

### 4.2 The usage contract should outlive the billing vendor

**I — Proposed immutable event:**

```json
{
  "id": "run:<server-run-id>:terminal:v1",
  "type": "jitk.run.terminal.v1",
  "subject": "tenant_<server-resolved-id>",
  "time": "2026-10-28T12:00:00Z",
  "data": {
    "request_id": "req_...",
    "attempt_id": "attempt_...",
    "region": "ap-southeast-5",
    "release_id": "sha256:...",
    "profile": "glue-2m",
    "outcome": "completed",
    "run_count": 1,
    "owner_cpu_us": 356,
    "elapsed_us": 1100,
    "tool_wait_us": 0,
    "output_bytes": 2,
    "meter_version": 1
  }
}
```

**E — Example values are illustrative**, not a newly observed run. Record timestamps at the trusted host; a guest can lie about its CPU/time/output. Use integers with explicit units. Keep source, tool payloads, secrets, output and raw customer identifiers out of routine metric/event fields.

**I — The failure cases decide credibility:**

1. Deduplicate at the local ledger with a unique event ID; retries through the outbox reuse that ID. Record `request_id` separately from attempt so a retry policy has an explicit billing meaning.
2. Durably record admission/reservation before dispatch. If the shard dies before completion, terminalize it as `platform_failure` or `outcome_unknown`; do not invent a successful run or a precise CPU charge. Initially credit platform failures and do not automatically replay effectful tools. A disconnected browser does not establish that no effect occurred.
3. A broker or database outage cannot silently grant unlimited work. Stop admitting when bounded durable recording capacity is exhausted. On recovery reconcile admissions, terminal events and quota reservations; retain an audit trail of corrections.
4. Measure **owner CPU** per run with existing per-owner thread accounting. Do **not** bill every overlapping tenant the entire process/cgroup CPU delta. Node/reactor/reset work overlaps and the current per-run number is not automatically complete. Choose either transparent run-count billing with declared budgets or a rigorously defined CPU meter; label estimates separately.
5. A Prometheus counter, sampled trace or Sentry event is **not a billing ledger**. Telemetry may be sampled, dropped, reset or expire after 14 days; billing events must be replayable and reconciled.

### 4.3 OpenMeter, Lago, Stripe, Orb, Metronome

**I — Implement one event contract; select at most one downstream initially.** Reading the named commercial services is useful research, but a proprietary service is not an open-source building block. The default proposal is self-hostable and has no required Stripe/Orb/Metronome account.

| Destination | Sourced capability (**F**) | Decision, effort and money (**I/E**) |
| --- | --- | --- |
| **PostgreSQL ledger + CSV** | Ordinary transactions, unique constraints and application outbox; an implementation design, not a ready billing product | **Use first.** Above core includes it. $0 license; no extra service fleet. Enough to explain a pilot's usage and manually invoice an agreed fixed allowance |
| **OpenMeter OSS** | Apache-2.0; Kong acquired the project in Sep 2025. Ingested usage, meters, entitlement/billing state. Current architecture uses **Kafka + ClickHouse + PostgreSQL**, with optional Redis/Svix paths; event dedupe is **disabled by default**, in-memory unless configured otherwise | Good when real-time usage dimensions/entitlements justify it. **2–4 days integration**, **$20–60/month extra resource allowance** if separately self-hosted (**E**). $0 license does not make its dependencies operationally free. Preserve local dedupe regardless |
| **Lago OSS** | AGPLv3 billing platform, billable metrics/aggregation and invoicing; COUNT events include a transaction ID and customer mapping | Useful when subscriptions, credits and invoice lifecycle are real work. **3–5 days integration**, **$20–60/month extra resources** (**E**). Check the chosen release's OSS vs paid feature boundary before depending on it; do not deploy both it and OpenMeter for a five-person pilot |
| **Stripe Billing meters** | Event name, customer, value and optional timestamp; identifiers/idempotency; **asynchronous** aggregation | Future adapter **1–3 days** once the commercial/payment model is settled. Proprietary service, fees additional; **excluded from the required OSS stack**. Its delayed aggregate cannot enforce a hard execution quota |
| **Orb** | Batch usage ingestion, primitive custom properties, per-event idempotency within the account's grace period, query-based metrics and event tracing | Consider for contract/pricing complexity at real revenue; **2–4 days initial adapter** (**E**), commercial price to be quoted. SDK openness does not make the backend OSS. Default ingestion quota in docs is finite; do not assume sending a separate event per VM can never bottleneck |
| **Metronome** | Vendor's own integration and public SDK show usage ingestion with `transaction_id`, customer, event type, timestamp and properties | Same future class as Orb: **2–4 days initial adapter** (**E**), **commercial price not verified**. Not required for a solo beta; an open-source client is not an open-source billing engine |

Sources: [OpenMeter licensing/deployment](https://openmeter.io/about), [OpenMeter architecture](https://openmeter.io/docs/open-source/architecture); [Lago license](https://github.com/getlago/lago/blob/main/README.md), [Lago COUNT metric/events](https://docs.getlago.com/guide/billable-metrics/aggregation-types/count); [Stripe meter ingestion](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api); [Orb ingestion](https://docs.withorb.com/events-and-metrics/event-ingestion), [Orb pricing/contact](https://www.withorb.com/pricing); [Metronome's usage integration](https://metronome.com/blog/how-we-use-metronome-at-metronome), [official Metronome SDK example](https://github.com/Metronome-Industries/metronome-go/blob/main/README.md).

**I — Delay the pricing-engine decision, not the event schema.** Do not send secrets or full tool transcripts to a billing product. Use tenant-scoped identifiers and dimensions that can support a later price change. The exact billing, rounding, failed-run and credit rules belong in a versioned customer contract before charging usage.

### 4.4 What customers already see elsewhere

| Platform | Exposed product surface (**F**) | Smallest useful thing to copy (**I**) |
| --- | --- | --- |
| **E2B** | API/SDK authentication, sandbox access tokens, lifecycle APIs, plan concurrency/session limits, resource billing; current product page exposes `sandbox.getMetrics()`, logs and signed webhooks | Return a run ID, result/error, timings and limits; provide a usage total and clear 429. E2B's sandbox access token is distinct from an account-management credential |
| **Modal** | Workspace-scoped API tokens/roles; workspace resource limits; logs/metrics; Sandbox resource requests/limits and max(request, actual) billing; readiness probes | Separate tenant identity from a run handle, show requested vs actual/budgeted resource use, surface readiness and capacity denial. Do not copy the workspace dashboard before someone needs a team |
| **Daytona current v0.226** | Organization-scoped permissioned API keys, managed child keys; verification-based resource/rate tiers and rate-limit headers; wallet/spending/resource breakdown and per-sandbox usage | A revocable key, quota dashboard/read endpoint and per-run receipt. Do not quietly import **v2 alpha**'s project-key or measured-resource billing rules as current v0 behavior |

Sources: [E2B product/metrics surface](https://e2b.dev/), [E2B pricing/limits](https://e2b.dev/pricing), [E2B access-token API example](https://e2b.dev/docs/api-reference/envd/get-the-environment-variables); [Modal workspaces/tokens](https://modal.com/docs/guide/workspaces), [Sandbox resource accounting](https://modal.com/docs/guide/sandbox-resources), [Modal workspace limits/readiness update](https://modal.com/blog/product-updates-vm-sandboxes-domain); [Daytona stable API keys](https://www.daytona.io/docs/en/api-keys/), [stable limits](https://www.daytona.io/docs/en/limits/), [stable billing](https://www.daytona.io/docs/en/billing/), contrasted with [v2 alpha billing](https://www.daytona.io/docs/en/v2/billing/).

## 5. Minimal operations: instrument the failure domains, then practice replacement

### 5.1 Observability with bounded cardinality

**I — Per-VM visibility should mean per-run traces/receipts plus aggregated metrics, not one permanent metric series per VM ID.** At a million short jobs, putting `run_id`, slot generation or customer ID in all Prometheus labels quickly consumes a free tier. Aggregate by release, region, host, shard, workload class and bounded outcome. Put the run correlation in traces/events and exemplars. Temporary VM/slot debugging can be an operator query rather than a persistent label.

**F — Existing useful hooks:** `owner::Metrics` contains reset/run/CPU/tool durations, calls, policy round trips, exits, and completion timestamps. New reset code also tracks copy/discard behavior, sampled verification and quarantine. These are promising instrumentation inputs, not an already deployed OTel endpoint. [Owner metrics](../../jitk/shard/src/owner.rs), [reset code](../../jitk/shard/src/kvm/reset.rs), [Oct 28 hardening receipts](../../jitk/bench/RESULTS-copy-restore-2026-10-28.md).

| Layer | Minimal signal (**I**) | Why it matters |
| --- | --- | --- |
| API/admission | admitted/rejected requests by reason; in-flight count, bounded queue length and queue-time histogram; auth errors; limit-store availability | Distinguishes demand, throttling and broken auth from VM slowness |
| Run/VM | server execute and queue histograms separately; owner CPU, tool wait, tool count, output bytes, timeout/OOM/fault/protocol error; reset time and copy/discard outcome | Makes the 1.1-ms claim inspectable and explains a slow real job |
| Shard/owner | ready/running/waiting/quarantined slots; owner loop lag; KVM exits; watchdog kicks/escalations; sampled-reset failures; shard restart count | One bad owner/shard can affect multiple runs. A reset mismatch is not ordinary tenant failure |
| Host | cgroup CPU/memory/current/peak/events; process RSS/PSS as diagnostics; kernel OOM, PSI, open fd count, disk free, KVM errors, boot ID | Detects actual resource exhaustion and explains why configured RAM is not resident overhead |
| Usage pipeline | oldest undelivered outbox age, pending count, duplicate count, unknown outcomes, reconciliation difference | Prevents a “working executor” from silently losing customers' usage records |
| Release | binary/kernel/helper/snapshot/ABI identity, rollout phase, synthetic fixture pass/fail, capacity by release | A graph without artifact identity cannot identify a bad rollout |

**I — Path:** OTel SDK/instrumentation → a local Collector with memory/batch limits → Prometheus-compatible metrics and sampled traces/logs. A scrape/export endpoint should not be reachable by tenants. Run a synthetic one-tool fixture from outside the worker every minute, including a result check; `/health` returning 200 is not evidence that KVM, reset, tool dispatch and the executor work. The [OTel Collector](https://opentelemetry.io/docs/collector/) is vendor-neutral; its own dropped/export-failure signals should be monitored too.

**F — Grafana Cloud Free:** **10,000 active metric series, 14-day metrics retention**, **50 GB logs/month with 14-day retention**, with a free traces allocation too. It is a hosted service, not a required OSS component; the same dashboard/export formats can be used with Prometheus and Grafana OSS. [Current pricing](https://grafana.com/pricing/).

**E — Operating budget:** a few hosts with bounded labels should fit comfortably below 10k series; target **under 3k** initially, reserve space for node/collector metrics, and inspect actual cardinality. At **1 KiB/event × 1M runs ≈ 1 GB raw**, traces and log duplication, not the basic receipt, can dominate volume. Sample successful traces, retain all bounded platform failures, and keep the durable usage ledger outside 14-day telemetry retention. Exact compression/retention cost is unmeasured.

### 5.2 Sentry, real host crashes and the OSS constraint

**F — Sentry's hosted Developer plan is $0, one user and 5k errors** on the current pricing page; its SDKs can report application failures. Current self-hosted Sentry uses **FSL**, which its own developer documentation explicitly says is **not OSI-approved**. Do not call that required backend an open-source dependency. [Sentry pricing](https://sentry.io/pricing/), [Sentry self-hosted licensing](https://github.com/getsentry/develop/blob/master/src/docs/self-hosted/index.mdx).

**I — Two valid choices:** use the open-source Sentry SDK with **GlitchTip**, or record structured failures/journal/core references initially. GlitchTip describes its software as **MIT, 100% open source**, and supports Sentry-compatible ingestion. Self-host only if the extra service is worth maintaining; budget **0.5–1 day** integration and **$5–15/month** additional resources if separated (**E**). Requested managed-Sentry research does not make it part of the mandatory stack. [GlitchTip licensing/update, Jun 22](https://glitchtip.com/blog/2026-06-22-glitchtip-6-2-released/), [SDK compatibility](https://glitchtip.com/blog/2020-07-15-glitchtip-1-0-is-now-available/).

**I — Crash boundaries matter:** Rust panic/Node exception reporting can fail during SIGKILL or a machine crash. Have **systemd/supervisor** record exit status, boot ID and release identity; use cgroup OOM events and `systemd-coredump` with bounded, access-controlled retention for process crashes. A kernel panic/power loss needs an **external heartbeat/synthetic failure alert** and persistent host logs. Sentry cannot send an event from a dead host. Guest exceptions and deliberately timed-out loops are expected outcomes; do not flood crash reporting with them.

**E — Alerts for a tiny beta:** page/notify the operator on external synthetic failure, repeated shard restart/OOM, reset verification failure/quarantine, or outbox age over a proposed **60 seconds**. Warn on capacity/queue saturation before paging. Initial SLOs are internal targets, not a customer SLA: e.g. successful valid synthetic runs >99% during the advertised demo window, bounded drain and rollback rehearsed before the session.

### 5.3 Upgrade and rollback a fleet of shards

**I — Use immutable releases and blue/green shard processes on each host.** The unit replaced is the **Node executor + shard + kernel/helper snapshot + broker policy configuration**, versioned as one compatible release. An HTTP process restart alone is not an upgrade design.

1. **Build elsewhere, pin everything.** Content-address the binaries, guest, payload, manifest, layout/ABI and snapshot; verify open read-only FDs rather than check-then-reopen paths. Snapshot register state is not a portable release package across arbitrary CPU features or KVM versions. Prepare/certify a base snapshot per supported ISA/CPU feature mask/host-kernel class. Keep the last good release and data schema readable by both versions.
2. **Start green with a separate Unix socket and cgroup.** Enforce host containment and supervisor-owned leases before it receives arbitrary code. Run real return/tool/timeout/reset/entropy probes. Green must announce usable ready capacity, not merely that its process exists. Retain enough CPU/memory for both versions; initially permit only a small green slot pool.
3. **Canary routing.** A bounded fraction of new, eligible requests goes to green. Existing runs and tool responses remain pinned to their original release/shard/slot/generation. Do not rebind a waiting program to a new shard halfway through a call.
4. **Drain blue.** Stop new admissions; allow existing runs/tool waits to finish up to the published maximum lifetime. At the limit cancel/fence through the supervisor, record the outcome, reap, and release reservations. No indefinite tool wait can hold deployment open. Do not transparently retry a tool with an unknown external effect.
5. **Rollback by routing new admissions back to blue.** Keep blue running through the canary window and retain old immutable assets. If green has partially failed, terminalize its outstanding work explicitly. “Instant rollback” means routing/restarting future executions, not undoing completed tools or restoring unknown side effects.
6. **Host upgrades are a different boundary.** For a Linux/KVM patch or physical host replacement, bring up a **second host**, validate it, route new work there, drain the old host, then reboot/replace. Two processes on the same host provide deployment flexibility, not host high availability. A one-host beta can instead publish a short maintenance window.

**E — Implementation/rehearsal:** **2–3 days** for per-host process deployment/drain/rollback and failure drills, after artifact/setup and containment work. A second 8-hour Malaysian c7g host adds **$18.12 compute** during a rehearsal; permanently doubling hosts doubles that part of the monthly bill. Test failed green readiness, broken image, killed shard, quota-store outage, duplicate usage delivery and operator rollback. These are proposed acceptance drills, not tests run in this research.

### 5.4 What Firecracker platforms publicly teach—and what they do not

| Platform / primary evidence | Public operational mechanism (**F**) | Applicable lesson for jitk (**I**) |
| --- | --- | --- |
| **Fly**: [Making Machines Move, 2024](https://fly.io/blog/machine-migrations/), [infra log](https://www.fly.io/infra-log/), [blue/green fixes, Apr 25, 2024](https://community.fly.io/t/improved-bluegreen-deployments/19472) | Per-host `flyd` state machines/event logs, tracked migration/recovery, host draining; API socket activation for graceful server restarts. The blue/green post reports leaked extra Machines, propagation downtime and failed rollback cases and the fixes | Durable state transitions, explicit leases, drain and rollback are the work. Copy the small version of those mechanisms; do not build Fly's storage migration system or claim its behavior transfers automatically to jitk |
| **AWS Lambda / Firecracker**: [production host recommendations](https://github.com/firecracker-microvm/firecracker/blob/main/docs/prod-host-setup.md), [Lambda MicroVM launch, Jun 22](https://aws.amazon.com/blogs/aws/run-isolated-sandboxes-with-full-lifecycle-control-aws-lambda-introduces-microvms/) | Firecracker's production guidance requires current host/guest kernels and microcode, restrictive seccomp, jailer-equivalent namespace/cgroup/privilege constraints. Lambda manages infrastructure and exposes lifecycle/suspend/resume rather than giving the customer a host | A hardware boundary is one layer. Patch/replacement and VMM process containment remain operator responsibilities when jitk self-hosts. Public Lambda docs do not reveal a complete internal host-rollout runbook; do not invent one |
| **Koyeb**: [platform architecture, 2023](https://www.koyeb.com/blog/building-a-global-deployment-platform-is-hard-here-is-why), [current health checks](https://www.koyeb.com/docs/run-and-scale/health-checks) | PostgreSQL/APIs and a Nomad custom Firecracker driver; new deployment must become healthy, previous healthy deployment keeps traffic on failure; startup/liveness probes | Readiness gates and keeping the known-good release are attainable without a global scheduler. The architecture post is historical, not a warranty of every current internal detail |
| **Northflank**: [runtime comparison, 2026](https://northflank.com/blog/firecracker-vs-cloud-hypervisor), [health checks](https://northflank.com/docs/v1/application/observe/configure-health-checks), [application management](https://northflank.com/features/application-layer) | Describes Kata-backed VMM choices and separate startup/readiness/liveness probes, health-gated rolling updates and rollback. Its platform supports multiple isolation technologies | Do not call every Northflank sandbox a Firecracker VM. The useful external contract is placement, health, observability and lifecycle, independent of backend. A tiny platform can expose the same basic contract without Kubernetes |

**I — Minimal ops total:** **4–6 days**, overlapping the rollout and error-reporting estimates. Combined with the tenancy core, **10–15 days including integration contingency** is a plausible invited-beta layer, not “production readiness in two weeks.” Existing security/parity, release packaging and independent-machine work are separate prerequisites. Before customers, a receipt plus one host dashboard and a practiced rollback tell more than an elaborate operations portal.

## 6. x86_64: a scoped port, not a compiler flag

### 6.1 What is already separated

**F — `kernel/ARCH.md` is useful preparation.** The core owns syscall dispatch, user stack/auxv construction, files and trace logic; ARM-specific boot, exception frame, page tables, stat ABI, syscall numbers, timer/IRQ and user entry have been separated. `build.rs` selects the architecture directory. `src/arch/mod.rs` still exports **only aarch64**. [Architecture contract](../../jitk/kernel/ARCH.md), [arch exports](../../jitk/kernel/src/arch/mod.rs), [build selection](../../jitk/kernel/build.rs).

**F — The shard remains ARM-specific:** KVM startup uses `KVM_ARM_PREFERRED_TARGET`, `KVM_ARM_VCPU_INIT` with PSCI, and ARM ONE_REG snapshots; metadata validates ARM register IDs. Ring GPAs and payload build assumptions are also ARM-shaped. The KVM module is now about **1,145 lines**, larger than the 778-line count in ARCH.md's earlier estimate; do not assume the host work disappeared during the kernel extraction. [KVM](../../jitk/shard/src/kvm/mod.rs), [snapshot](../../jitk/shard/src/snapshot.rs), [ring addresses](../../jitk/kernel/src/ring_abi.rs).

### 6.2 Minimum useful Linux/KVM ring/shard port

All effort below is **E**, one engineer already familiar with this code, including ordinary debugging but not a new general Linux ABI or a security audit. Work can overlap; the sum is a planning range, not a commitment.

| Work | Concrete scope | Days (**E**) |
| --- | --- | ---: |
| **Boot/build** | Direct KVM entry into a controlled long-mode state, linker/target setup, GDT/TSS, stack/BSS, SSE/FPU initialization. The shard may set initial sregs/registers directly; BIOS/UEFI/real-mode emulation is unnecessary for this narrowly defined boot contract | **1–2** |
| **Page tables and privilege boundary** | Four-level x86 mappings, NX/RW/user bits, CR0.WP, CR3/TLB invalidation, SMEP/SMAP or an explicitly constrained baseline, user-buffer checks and protected aliases; writable arena and immutable memslot layout retained | **3–4** |
| **Syscall/exception entry** | IDT, fault/error-code frames, double-fault IST, ring-3 entry, safe kernel stack switch for `SYSCALL`, RCX/R11 handling and validated return. Use a conservative `IRETQ` return until `SYSRET` corner cases are justified; preserve required SIMD/extended state | **3–4** |
| **x86 Linux ABI and payloads** | `rax` syscall number; rdi/rsi/rdx/r10/r8/r9 args; x86 syscall map, legacy-call aliases, TLS `arch_prctl(ARCH_SET_FS)`, 144-byte stat encoding, `O_DIRECTORY` and related flag audit; refresh pinned handler contracts; rebuild static musl QuickJS/Lua/helpers; admit EM_X86_64 ELF | **3–5** |
| **KVM x86 backend and reset coverage** | Supported CPUID mask; REGS/SREGS, required MSRs, FPU/XSAVE and XCRs, debug/event/MP state, TSC policy; restore all guest-writable enabled state. LAPIC/irqchip state only if instantiated. Decode MMIO/PIO/halt/shutdown/fault exits; preserve immediate-exit/watchdog behavior | **4–6** |
| **Ring/checkpoint/snapshot integration** | x86 `mmu_ring`, doorbell ordering, versioned layout/register format, cache/reset implementation, entropy repair and payload checkpoint path; immutable prepared identity; baseline host compatibility rejection | **2–3** |
| **Containment/build/release integration** | x86 syscall allowlist/ioctl audit and supervisor wiring, pinned Linux artifacts/build paths, second-host setup | **1–2** |
| **Independent validation** | Differential workload corpus, W^X/user/kernel protection probes, hostile register/RAM/TLS reset, entropy, timeout/owner death, cross-tenant canary, wait/concurrency, both Intel and AMD smoke, metal cost receipt | **5–7** |
| **Integration allowance** | Coupling among payload ABI, new snapshot state, layout and host CPU features | **2–4** |
| **Ring/shard total** | A shipping scope confined to the production Linux ring path | **24–37 days** |

**F/I — Timer scope is the important saving:** the current [ring wait implementation](../../jitk/kernel/src/wait_ring.rs) explicitly has **no guest counter read, timer device, IRQ, GIC or WFI**. It publishes a deadline to the host and parks via a doorbell; time is refreshed at boundaries. A minimal equivalent x86 ring port can retain that behavior with host monotonic time and supervisor deadlines. It does **not** need an APIC timer merely to return a result. But it also must not claim a continuously advancing guest clock or Linux timer parity.

**E — Full libkrun/console parity adds work:** legacy boot parameters instead of FDT, virtio-console interrupt routing, LAPIC/TSC-deadline or one-shot timer, IOAPIC, race-free `sti; hlt`, VMM/libkrun patches, build scripts and both transport matrices. ARCH.md estimates **26–41 days** for the libkrun path and **7–11 extra** for shard support, **33–52 days combined**. Those remain the best local planning envelope for both backends. The smaller 24–37-day ring scope is **this report's proposed estimate**, not a reduction already proven by implementation.

**F — State restoration deserves explicit x86 design:** the Linux KVM API documents different x86 ioctls for registers, special registers, MSRs, XSAVE, vCPU events, LAPIC and CPUID. A guest that can change control state must not contaminate the next run merely because RAM was reset. Some state is enabled/configured once; some must be reset each time; unsupported features must be masked or rejected. ARM `DC CIVAC` reset handling cannot simply be pasted into x86 code. [KVM API](https://docs.kernel.org/virt/kvm/api.html), [KVM x86 MSRs](https://docs.kernel.org/virt/kvm/x86/msr.html).

**I — Reduce scope by constraining the machine:** one vCPU per VM, a small declared CPUID baseline, no AVX/PMU/nested virtualization unless the payload actually needs them, no device/irqchip state unless required. Certify that contract on Intel and AMD separately. Do not treat this as free cross-host checkpoint portability; snapshots still bind to ISA, feature mask, layout, artifact and compatible host state.

**F/I — ABI traps are already documented:** x86 `struct stat` is **144 bytes**, ARM is 128; x86 `O_DIRECTORY` differs; `arch_prctl` and old x86 syscalls may appear even with the same C source. `packer.ts` and runtime artifact identities must carry ISA. [ARCH.md ABI inventory](../../jitk/kernel/ARCH.md), [packer](../../jitk/kernel/packer.ts). Adopting small permissively licensed x86 register/CPUID helpers may reduce coding mistakes, but does not remove syscall-entry, reset and conformance work. No dependency change is proposed in this report.

### 6.3 Demand and sequencing

**I — What x86 actually unlocks:** inexpensive dedicated Intel/AMD servers in Germany and Singapore; supported nested EC2/GCP/Azure workers; customer-owned x86 Linux/KVM fleets; cheaper independent CI/reference machines; native static x86 tool artifacts without an ARM rebuild. These are distribution and deployment benefits. It does not add threads, fork, sockets, dynamic linking or general Linux compatibility, and it does not make Hetzner Cloud/Fly/Cloudflare expose KVM.

**I — Demand is unproven.** A named platform team saying “we need this inside our x86 KVM fleet” is a stronger trigger than “most servers are x86.” A remote API consumer need not care which ISA serves the request; an embedding/self-hosting customer often does. For the latter, the x86 port may matter more than running a hosted service at all.

**I — Recommended sequence:**

1. Short ARM reference/demo, then finish parity/containment/API/setup gates.
2. A few invited builders with the minimal tenancy/ops subset, scheduled rather than 24/7 if possible.
3. Choose between **hosted recurring use** and **customer-embedded x86 deployment** using the returned workloads. Build the ring-only x86 port if deployment friction is the blocker; otherwise defer it behind useful compatibility/integration work.
4. Add the console backend only if a concrete user or testing workflow requires it.

**E — Port cash budget:** approximately **$20–80** for intermittent small nested x86 hosts, disks and short metal validation sessions, assuming no always-on test fleet and no paid audit. The dominant cost is **24–52 working days**. Reserve a larger, separately quoted budget if Intel/AMD metal inventory or dedicated security review is required. No account or rental was acquired here.

## 7. Demos enabled by this angle

All are **I proposals / E effort and budget**. Nothing here is a claim that the UI, hosted service, meter or rollout tool already exists.

| Demo | Viewer sees in first 10 seconds | Real vs staged; number on screen | Live failure / fallback; effort and cost |
| --- | --- | --- | --- |
| **“One click, one measured computer”** | Click a small JSON/tool transform; see result and a receipt with request ID, region, release, server execute time and browser RTT | Real current execution on the ARM worker; fixture data and selectable program are openly labeled. Show actual timing, not a prefilled **1.10 ms**. Memory badge says **prior measured marginal ~0.5 MiB**, not live per-run RSS. CPU badge distinguishes owner CPU from total-system estimate | Cold start/queue, source/output limits, regional capacity, unsupported timer behavior. Fixed-fixture selector before arbitrary input is certified; keep a clearly labeled recorded receipt as offline fallback. **2–4 days; ~$25–40 for an 8-hour session** |
| **“The tenant next door hits its limit”** | Two tenant panels; A floods its allowed fixture, gets 429; B still gets valid responses | Two genuine keys, separate tool state/quota rows and one shared worker. Show **A admitted/rejected count, B p95/queue time**, not a universal fairness guarantee. Traffic script is disclosed | Shared owner head-of-line blocking can still harm B. It is valuable to show that limit honestly; a tenant quota is not a fair scheduler. Move pilot tenants to separate shards if needed. **1–2 days after keys/limits; same host rental** |
| **“Replace a shard while jobs finish”** | Blue jobs complete; new jobs turn green; a deliberately unhealthy green release receives no production traffic | Actual two local processes/cgroups, real readiness fixture and routing. Defective version is a deliberate fault injection. Show **active-by-release, failed runs, rollout/drain seconds**, with no “zero downtime” claim until observed | A hung tool prevents drain, green consumes too much memory, wrong image/schema breaks rollback. Bound jobs and prepare the known-good assets. **1–2 days after rollout work**, no second physical host needed for the process demo |
| **“What does a million cost?”** | A counter advances with completed, validated runs; actual host meter and elapsed rental clock are visible | Real completed count and event export. Separate **allocated rental dollars / completed runs** from the **1.7-ms CPU model**. For example an 8-hour Malaysian reservation is **$18.12 compute**, regardless of how little its CPUs were used | Nested/metal scaling may miss the target. Do not animate submitted requests as completions or use a saturation model as the bill. **1–2 days instrumentation after benchmark reproducibility; $18.12–21.32 compute/8h** |

**I — Most valuable demo is the first with a single failure drill attached.** The second and third demonstrate platform engineering to hiring managers; neither is necessary for initial user discovery. Do not build four front ends. A short receipt/trace view can supply all of them. The million-run demonstration should show distinct execution/reset identities and counts; the reusable shard slot is not a newly allocated physical host process per run.

## 8. Value gaps: who is blocked, and which features can wait

| Gap | User/job actually blocked (**I**) | Needed before payment? | Cheapest credible response and what it unlocks |
| --- | --- | --- | --- |
| Tenant identity, tool-state isolation and revocation | Platform builder exposing untrusted programs to several customers; cannot attribute authority or contain a leaked key | **Yes**, before arbitrary external use, even free | 4–7-day tenant/usage core above; unlocks invited integrations |
| Quotas, concurrency, queue limits and supervisor enforcement | Owner paying the bill; neighbor whose latency is harmed by a runaway job | **Yes** | Bounded admission, hard reservations, cgroups and independent deadlines. Fair scheduling is additional work; separate small shards can bound blast radius |
| Per-run receipt and usage read/export | Builder debugging why a program failed or validating what resources it consumed | **Yes**, useful before commercial launch | Add existing owner metrics to a scoped receipt; durable ledger; **1–2 days** within core |
| Billing automation, credits, subscriptions, invoices, spend alerts | Paying tenant reconciling an invoice; operator processing recurring contracts | **Mostly after a buyer exists** | Agree on a pilot allowance, export usage, manually invoice first. Add one billing system when manual reconciliation becomes real work |
| Dashboards, external liveness and rollback | Solo operator unable to see or recover a broken advertised endpoint | **Yes** for an advertised live demo/service | 4–6-day minimal ops layer; receipt/dashboard and practiced replacement have capstone value as well |
| Multi-region failover, 24/7 response, sophisticated autoscaling | Tenant with an uptime/residency/latency requirement and recurring jobs | **Only once someone needs that contract** | State an honest single-region operating window; second host/region costs money and operating time. A second shard on one host is not failover |
| x86_64 | Team deploying into existing Intel/AMD KVM machines; cheaper long-running operator footprint | **Not for a remote ARM demo**; can be needed before an embedded customer's pilot | 24–37-day ring port or 33–52 days both backends, triggered by a real deployment blocker |
| Team/org UI, SSO, RBAC hierarchy, billing portal | Procurement/team administration | **Usually only with a paying organization asking for it** | Operator-managed keys and tenant config now. A nice dashboard is weak adoption evidence |

**I — Preserve the security distinction:** the isolation/reset/host-containment work does not become optional because a beta is free. Conversely, an enterprise billing portal does not improve the execution boundary. An early user can get value from a local or customer-hosted runtime without jitk owning any public fleet.

## 9. Presentations and hiring value

**I — Proposed 15–20 minute talk:** **“A millisecond VM still needs an operating plan.”** Target platform/SRE/backend engineers and hiring managers in KL/SEA. Start with one real receipt and the failure-domain diagram, explain why KVM access narrowed the cloud list, show allocated vs marginal cost, then replay a tenant-limit or shard-replacement drill. Finish with what is still unproven: metal scaling, independent containment review and real users.

**F — Concrete community venue:** [Cloud Native Kuala Lumpur](https://www.meetup.com/cloud-native-malaysia/) describes itself as the official CNCG KL chapter, meeting monthly on cloud computing, operations and architecture, and invites talk proposals through its Sessionize route. This is a relevant place to propose the talk, **not a verified future speaking slot**. **E:** 1–2 days to turn the receipt/dashboard/drill into a short talk/post, **$0 submission/materials assumption**; travel/venue fees require the actual event's terms. No organizer was contacted.

**I — Honest claim today:** “I built a small ARM VM executor and measured about 1.1 ms local execute latency / 1.7 CPU-ms in a nested environment; here is how I would make its failure domains and bill inspectable.” After the metal/demo work, replace the historical number with the dated host-specific receipt. After implementing a limit/rollback drill, say exactly what was exercised. Do not say a production multi-tenant platform already exists.

**I — Useful interview/deck assets, cheaper than a hosted company:** one annotated request trace, a two-column host eligibility/pricing page, a measured rental-cost receipt, and a 60-second rollback clip. These demonstrate architecture tradeoffs, incident handling and financial judgment to a hiring manager even if no tenant pays. Making a worldwide control plane solely for the CV is poor use of the same time.

## 10. Ranked top three moves

1. **Get one reference ARM metal receipt and turn it into a scheduled fixed-fixture playground.** **E:** 2–4 demo days after setup, **$25–40 for one 8-hour session**. Prefer existing local ARM Linux for rehearsal, then c7g.metal Malaysia or Singapore for the dated public result. Unlocks credible cloud numbers, a capstone artifact and a low-cost demand test.
2. **When an external builder wants editable code, finish prerequisite containment/parity/API gates and add the 10–15-day tenancy/ops slice.** **E:** $0 OSS license, worker rental plus $10–30/month estimated separate control-plane resources if needed. Use PostgreSQL events, revocable keys, bounded quotas, OTel and a rehearsed per-host blue/green procedure. Unlocks a controlled pilot; select a billing backend only after there is something to bill.
3. **Port the Linux ring/shard path to x86 only against a named deployment or recurring-host-cost blocker.** **E:** **24–37 working days**, **$20–80 intermittent test compute**; **33–52 days** for both transports. Unlocks inexpensive x86 metal and supported nested clouds, not universal VPS hosting or general Linux compatibility.

### The ONE move to do first

**I — Produce the artifact-bound c7g.metal reference receipt before building the service.** Record the exact host/OS/page size/CPU features/release, validate reset/timeout behavior, measure the same tiny and hostile workloads, and show actual allocated rental cost. Time-box the first rental to an 8-hour window with a **$30 compute/storage allowance in Malaysia**. If setup or correctness fails, stop and publish the blocker rather than extending the rental into an accidental monthly platform. This is the shortest bridge from the current research prototype to either a credible demo or a justified next engineering task.

### Five-line TL;DR

1. **I:** A scheduled, fixed-fixture hosted demo is worthwhile before full tenancy and x86; an unattended arbitrary-code service is not.
2. **F/E:** c7g.metal costs **$2.2656/hour Malaysia, $2.6656 Singapore/Jakarta**; an 8-hour demo is cheap, an idle month is not.
3. **I/E:** Keys, hard quotas, a durable usage ledger, OTel and practiced replacement form a **10–15-day** beta layer after the runtime prerequisites.
4. **I/E:** x86 is **24–37 days ring-only / 33–52 days both paths**; do it for a real deployment blocker, not a one-day rental saving.
5. **I:** First show a metal receipt, honest cost and one recovery drill; automate billing and expand regions when a tenant needs them.

### Rejected or deferred ideas

- **Always-on ARM metal for an empty public beta:** roughly $1.6k–$2.3k/month in the quoted entry examples buys idle capacity before demand.
- **“Use a $5 ARM/x86 VPS anywhere”:** ARM or a KVM-backed VPS is not customer access to hardware virtualization.
- **Hetzner Cloud or Fly as the KVM worker:** their documented restrictions do not disappear after an x86 port.
- **Equinix Metal / old Hetzner RX price as the plan:** the former shut down; the latter is no longer listed for new orders.
- **GCP C4A VM nesting:** explicitly unsupported; C4A metal is a different, larger and region-limited product.
- **Full x86 console/APIC port before the demo:** weeks of work for a deployment requirement the hosted API user may never have.
- **OpenMeter + Lago + Stripe + Orb + Metronome together:** duplicate state and operating work; one portable ledger and at most one downstream are enough.
- **Self-hosted Sentry as a required OSS dependency:** current FSL is not OSI-approved; GlitchTip/structured failures satisfy the proposed OSS path.
- **Prometheus as the invoice source or one series per VM:** counters are lossy/resettable and ephemeral VM labels explode cardinality.
- **Automatic replay after unknown tool outcome:** retries can duplicate real effects; generation fencing and explicit outcomes are needed.
- **Multi-region scheduler, Kubernetes fleet or live VM migration for the portfolio:** no demonstrated tenant requirement; bounded single-region replacement is sufficient.
- **A nickel-per-million retail promise:** high-utilization CPU math excludes idle hosts, integration, tools, operations and unmeasured scaling.
