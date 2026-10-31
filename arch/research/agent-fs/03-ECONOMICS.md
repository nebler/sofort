# Economics of a filesystem workstation with a fresh VM per command

Research date and price observation date: **2026-10-31**. USD, before tax. Desk research only: repository documents and public web sources; no builds, benchmarks, Docker, VMs, Linux execution, provisioning, or dependency installation. This is the sole new report written for this assignment. Existing files were not edited.

## Headline

- **The model can win substantially against a VM left running through model and human waits, but a universal win for real coding sessions is not established.** Under the explicit central assumptions below, compute COGS falls **1.82–1.86× at 50% idle, 4.55–4.65× at 80% idle, and 18.20–18.61× at 95% idle** versus a continuously allocated 2-vCPU/4-GiB VM on the same host.
- **Against an ideal, instantly paused full VM, the same hybrid is 7.5–9.9% more expensive.** A one-second full-VM startup for every heavy command overwhelms the savings from many short commands. This is an assumed startup penalty, not a Sofort measurement.
- **Command share is not compute share.** With 90% 50-ms light commands and 10% 10-second heavy commands, heavy commands occupy **95.7% of useful tool time**. TraceLab independently reports that approximately 4% of calls longer than a minute consume approximately 85% of tool time. [TL-blog]
- **Compute-only cost per 10,000 commands is $3.1045 / $1.7784 / $0.4523 at 30% / 60% / 90% light share**, with a fresh full-VM fallback for the rest. All-light 50-ms execution costs **$0.01031**. These are calculations, not observed production costs.
- **Idle-free compute is already sold.** E2B, Daytona, Blaxel, Fly, Morph, Runloop and Prime support stopping compute charges through lifecycle controls; Vercel, Cloudflare, Deno and Modal already offer variants of active-resource billing. Memory, storage, minimums and transition costs determine the remaining opportunity. [E2-price]–[PI-pause]
- **A nickel per 10,000 commands is plausible for a bounded light tier, not an unqualified coding-workstation tariff.** At the central host utilisation and durations, the heavy share must be **below 0.898% merely to keep compute COGS below $0.05**, or **below 0.332% for 50% compute gross margin**. At 80% margin, 50-ms all-light execution alone slightly exceeds the allowable COGS.
- **The strongest measured evidence supports small QuickJS jobs, not arbitrary shell commands.** The 34–40 µs number is a small-job HVF reset; real-task reset p50 reaches 208 µs. The approximately 0.5-MiB Linux slope is an older small-job nested-KVM result, not the complete active workstation footprint. [L1] [L3]
- **Market pressure is real:** Prime's promotional 2-vCPU/4-GiB compute is $0.09/hour before disk; Fly lists a 2-vCPU/4-GB performance Machine at $0.0917/hour. Our assumed 50%-utilised host costs $0.145/hour for that reserved shape before storage and operations. [PI-price] [FL-price]
- **Evidence gap:** the requested `2026-10-31-promote-payoff.md` is absent from this checkout. The supplied 7–560-ms QuickJS and 4–107-ms native ranges are treated as brief-supplied context, not independently verified measurements. No public trace found jointly establishes command compatibility, actual CPU, memory working sets, filesystem deltas and idle gaps needed to prove the end-to-end unit economics.

## Evidence labels and comparison rules

**M** = measured in an existing repository report, read without rerunning. **P** = published by a provider, research author or dataset maintainer, including unverified marketing latency claims. **A** = explicit modelling assumption. **D** = arithmetic derived from identified inputs. **NR** = not verified in the inspected primary sources; it does not mean free, unsupported or nonexistent.

All live pricing below was inspected on **2026-10-31**; unless a publication date is given, it is an undated current page. Conversions from seconds to hours are D. Preserve vendors' GB/GiB units; do not silently equate a shared vCPU, a physical core and a Graviton core. Free credits and subscriptions are excluded from marginal scenario costs and disclosed separately. Advertised boot, resume, command dispatch and pristine-reset times measure different operations.

## Current pricing and lifecycle table

Rates describe the named current products, rather than assuming every sandbox bills provisioned CPU for session wall time. A resource minimum and a billing-duration minimum are different constraints.

| Provider | Published compute and running-idle treatment | Granularity, minimums and plan floor | Pause, standby, snapshots and resume charges | Published start/resume claim and date |
|---|---|---|---|---|
| **E2B** | $0.000014/vCPU-s + $0.0000045/GiB-s = **$0.0504/vCPU-h + $0.0162/GiB-h**. Allocated resources while running, including idle. 2 vCPU/4 GiB = **$0.1656/h**. [E2-price] | Per second; additional per-start minimum NR. Hobby $0 + $100 one-time credit; Pro **$150/month plus usage**, without extra compute credit. Pricing page labels 2 vCPU/4 GiB default; billing docs separately say 2 vCPU/512 MiB default: specify the template rather than rely on “default.” [E2-price] [E2-bill] | Paused compute not billed; paused retention unlimited. Inspected pricing lists free disk allowances of 10 GiB Hobby / 20 GiB Pro; separate pause/resume operation tariff NR. Auto-pause is opt-in; timeout otherwise kills. [E2-bill] [E2-persist] | Pause approximately **4 s/GiB RAM**, resume approximately **1 s**, current persistence docs. A 4-GiB pause therefore implies approximately 16 s, not a µs reset. [E2-persist] |
| **Daytona** | **$0.0504/vCPU-h + $0.0162/GiB-h**, disk **$0.000108/GiB-h** after first 5 free GiB. Reserved resources while running; 2/4 compute **$0.1656/h**. [DT-price] | Current stable pricing says per second; per-start duration minimum NR. PAYG; $200 initial compute credit. Do not apply these terms automatically to a different v2/alpha agreement. [DT-price] | Started and creating/starting/stopping/pausing reserve CPU, RAM and disk. Stopped/paused charge disk only; preserved VM memory is not billed. Archived containers are unbilled; retained snapshots still incur storage. Separate resume-operation tariff NR. [DT-bill] | Current pricing page says starts/stops in **milliseconds**, without a percentile or numeric resume distribution. [DT-price] |
| **Modal Sandboxes** | **$0.00003942/physical-core-s + $0.00000667/GiB-s** = **$0.141912/core-h + $0.024012/GiB-h**. Modal calls one physical core 2-vCPU equivalent. Bills **max(request, actual)** for CPU and memory. [MO-price] [MO-res] | Per second. Minimum/default request **0.125 physical core + 128 MiB**; requests bill throughout lifetime. Starter $0 plus compute, $30/month compute credit. A live idle Sandbox is not automatically cost-free. [MO-res] [MO-price] | Filesystem and directory snapshots default to 30-day retention; memory snapshots to 7 days. Terminate after saving to avoid running-resource charges. Separate snapshot storage and restore-operation rates NR in inspected pricing/snapshot pages; no zero-cost assumption. [MO-snap] | Starts **under 1 s**, current product claim; no matched fresh-Node reset distribution. [MO-product] |
| **Vercel Sandbox** | `iad1`: **$0.128/active-vCPU-h + $0.0212/provisioned-GB-h**. CPU excludes I/O/model waits; memory continues while running. Default 2 vCPU/4 GB means **$0.0848/h memory alone**. [VE-price] | CPU millisecond granularity in vendor comparison; memory **1-minute minimum increments** in pricing docs. Creation **$0.60/million**. Pro $20/month usage credit; Hobby quotas include 5 active-CPU h and 420 GB-h/month. [VE-price] [VE-billing] | Snapshot storage **$0.08/GB-month**. Stop/recreate saves filesystem rather than a live process heap. No additional restore-operation fee itemised in inspected tariff; a new creation and its memory minimum still apply. [VE-price] [VE-snap] | **Filesystem restore p75 <1 s**, published **2026-04-02**; disk restore, not a full-memory resume. [VE-snap] |
| **Cloudflare Sandbox / Containers** | **$0.000020/active-vCPU-s + $0.0000025/provisioned-GiB-s + $0.00000007/provisioned-disk-GB-s**, or **$0.072 + $0.009 + $0.000252** per corresponding resource-hour. Live idle still incurs memory/disk. [CF-price] | **10-ms** billing; Workers Paid **$5/month**. Included monthly: 375 vCPU-min, 25 GiB-h memory, 200 GB-h disk. Also account for Workers/Durable Objects. Small `lite`: 1/16 vCPU, 256 MiB RAM, 2 GB disk. [CF-price] | Compute/memory/disk charges stop on sleep. Current native snapshots preserve filesystem, not RAM/processes; 30-day TTL refreshed on restore. Separate native snapshot operation/storage rate NR in inspected tariff; R2-based backups have their own costs. [CF-price] [CF-snap] | No exact current start/resume percentile verified in inspected primary docs: **NR**, not a zero-latency assumption. |
| **Fly Machines** | Current landing page: shared-cpu-1x/256 MB **$0.0030/h**; performance-2x/4 GB **$0.0917/h**. Started Machines bill provisioned shape, including idle. Shared CPU is not equivalent to two dedicated Graviton cores. [FL-price] | Per second while started; additional duration minimum NR. PAYG resource pricing; no subscription floor shown for these rates. Use current landing-page rates rather than mixing older regional docs. [FL-price] [FL-bill] | Stopped/suspended rootfs **$0.15/GB-month**. Persistent volumes **$0.15/GB-month**, snapshots **$0.08/GB-month**, first 10 GB snapshot allowance. No extra per-resume fee itemised. Volumes continue billing while stopped. [FL-price] [FL-bill] | Vendor **2024-07-02** post: ready after resume in a **few hundred ms**; typical Rails cold readiness can take **2 s**. Historical claim, still not a 2026 percentile guarantee. [FL-resume] |
| **AWS Lambda MicroVMs** | Dedicated current MicroVM product, not ordinary Lambda invocation pricing. US East/Arm published example: **$0.0000276944/vCPU-s + $0.0000036667/GB-s** = **$0.09969984/vCPU-h + $0.01320012/GB-h**. Baseline running resources plus active excess, up to 4× baseline. [AW-price] | Per second; default baseline **1 vCPU/2 GB**, smallest documented baseline **0.25 vCPU/0.5 GB**. Further per-run minimum NR. Do not substitute ordinary Lambda's 1-ms duration or request tariff. [AW-price] [AW-image] | Suspended compute free, up to **8 h**. Snapshot **write $0.0038/GB**, **read $0.00155/GB**, storage **$0.08/GB-month**; image storage has **1-week minimum**. Network extra. [AW-price] | “Near-instant” snapshot-based launch/resume; numeric p50/p99 NR. Announced **2026-06-22**; explanatory compute blog **2026-07-10**. [AW-launch] [AW-blog] |
| **Blaxel** | Sandbox running time priced by **allocated RAM**: **$0.0000115/GB-s = $0.0414/GB-h**, CPU bundled. Thus 4 GB active = **$0.1656/h**. “Active CPU” wording is not a separately metered CPU-cycle tariff. [BL-price] | Per-second metering documented **2025-12-03**; additional per-start minimum NR. PAYG $0 base, up to $200 credits. Higher-quota tiers require top-ups, e.g. $20/month for Tier 1. [BL-meter] [BL-price] | Auto-suspends after approximately **5 s** inactivity; suspended compute $0, snapshot storage **$0.20/GB-month**, images **$0.045/GB-month**. No separate per-resume fee itemised in the inspected tariff. [BL-price] | Approximately **25 ms standby resume**, current price page. Full memory state survives. This is resuming a tenant, not pristine reset between tenants. [BL-price] |
| **Runloop** | **$0.108/CPU-h + $0.0252/GB-h**; 2 CPU/4 GB = **$0.3168/h**, before disk. Devbox disk **$0.00034236/GB-h**. Ordinary running idle incurs resources. [RL-price] | Per-second rate table; “no minimums.” Basic $0 plus usage; **Pro $250/month plus usage**, including suspend/resume. Basic 100 GB storage allowance; Pro 1 TB. [RL-price] | Suspended state uses no active compute. Snapshot storage **$0.000072/GB-h**; blueprint build **$0.252/h**. Exact additional resume-operation fee NR. Idle action defaults to none; configure it. [RL-price] [RL-state] [RL-life] | Current home: **<2 s** startup for a 10-GB image; **100 ms command execution/dispatch** claim. **2024-11-12** lifecycle post says resume in seconds. These are different timings. [RL-home] [RL-resume] |
| **Morph Cloud** | Standard **$0.05/MCU**. One MCU-hour covers **1 vCPU-h + 4 GB RAM-h + 16 GB disk-h**. Devbox MCUs/h = `max(vCPU, ceil(RAM/4 GiB), ceil(disk/16 GiB))`. Thus 2/4/16 costs **$0.10/h**. [MF-price] | Terms say per-second compute; duration floor NR. Developer $0/month, purchase compute credits; Team $40/month for $50 value; Scale $250/month for $375 value. [MF-price] [MF-terms] | Paused instances charge storage only. One MCU also buys **5 TB snapshot-hours**; published example 8-vCPU/8-GB-RAM/8-GB-disk snapshot **$0.12/month**. Terms mention per-operation charges, but amounts NR: do not assert free snapshot/restore. [MF-price] [MF-terms] | Snapshot, branch and restore **<250 ms**, current Infinibranch docs, without a benchmark percentile. [MF-docs] |
| **Deno Sandbox** | Current **$0.10/active-CPU-h + $0.025/GiB-h memory**, volumes **$0.20/GiB-month**. Active CPU excludes waits; memory remains a time meter. Use current rates, not the lower launch-blog rates. [DE-product] [DE-price] | Memory described per second; CPU rounding and per-create duration minimum NR. Sandbox available on **Pro $20/month**, not Free; current Pro includes 50 CPU-h and 750 GiB-h across its meters, 5 GiB volume storage. [DE-price] | Volumes and read-only snapshots persist filesystem state. Specific live-RAM standby/resume tariff and separate snapshot operation charge NR in inspected pages. Do not transfer Deploy-app autosleep promises to a persistent sandbox without verification. [DE-vol] | Current product: starts **<200 ms**, default **2 vCPU/1.2 GiB**; launch blog **2026-02-03** said <1 s. [DE-product] [DE-launch] |
| **Prime Sandboxes** | Promotional rates through **2026-12-22**: **$0.02/vCPU-h + $0.0125/GiB-h + $0.0002/disk-GiB-h**. Running resources reserved. 2/4/5 GiB disk = **$0.091/h**. [PI-docs] | No subscription/minimum spend. Minimum shape **1 vCPU/128 MiB/2 GiB disk**. Exact compute rounding/per-start minimum **NR in inspected primary pages**; third-party “per second” claims were not promoted to verified fact. Minimum configurable timeout of 1 min is not evidence of a billing minimum. [PI-price] [PI-docs] | Paused: disk only, CPU/RAM released. Images/checkpoints **$0.10/GiB-month**, metered hourly, plus upload charge equal to **one day of storage** per durable image/checkpoint. Pause also creates a disk checkpoint. [PI-docs] [PI-pause] | Current docs: thousands start concurrently in seconds; pause/resume reaches state a **few seconds** after acceptance. No exact per-VM startup percentile. GA **2026-09-23**. [PI-docs] [PI-pause] [PI-launch] |

These observations supersede older repository competition notes where current docs have changed: Prime now documents pause/resume and checkpoints. Some pricing pages conflict with their own older examples or defaults; the explicit current rate table, configured shape and API contract should determine a quote.

### Billing granularity can outweigh a fast kernel

**D, using current tariffs:** at Vercel's minimum 1-vCPU/2-GB shape, a new sub-minute sandbox incurs at least `2 × 0.0212 / 60 = $0.0007067` memory charge. **10,000 such creations imply at least $7.0667 memory plus $0.006 creation charges**, before CPU. Keeping one Sandbox alive and executing 10,000 commands inside it has a completely different bill. This is a lifecycle/granularity effect, not a measured cost of Firecracker. [VE-price]

For a running 2-vCPU/4-GB sandbox whose **total CPU utilization across allocated capacity is 5%**, the D running-hour bills before storage/plans are approximately:

| Metering contract | Calculated running-hour compute bill | What survives when CPU is mostly idle |
|---|---:|---|
| E2B / Daytona reserved 2/4 | $0.1656 | Full allocated CPU and memory; pause can remove them. [E2-price] [DT-price] |
| Vercel 2/4, `iad1` | $0.0976 = 0.1 CPU-h × 0.128 + 4 GB-h × 0.0212 | Provisioned memory. [VE-price] |
| Deno configured 2/4 | $0.1100 = 0.1 CPU-h × 0.10 + 4 GiB-h × 0.025 | Memory time. [DE-product] |
| Modal, request 1 physical core/4 GiB | $0.23796 | Request floor, even if actual CPU falls below it. With smaller requests and lower actual memory the bill changes. [MO-price] [MO-res] |
| Cloudflare configured 2 CPU/4 GiB/8 GB disk | $0.045216 = 0.1 CPU-h × 0.072 + 4 × 0.009 + 8 × 0.000252 | Provisioned memory and disk; Workers/DO extra. Named shapes differ; this is an arithmetic configuration example. [CF-price] |
| AWS MicroVM 1/2 baseline, no excess | $0.126100 | Baseline resources while running. [AW-price] |
| Blaxel 4 GB, still running | $0.1656 | Entire active-size meter until it actually suspends. [BL-price] |

**A/D:** The 5% utilization here is separate from the idle-time scenarios below. A tool waiting on a network can be “executing” for billing purposes while consuming very little CPU; an idle agent can still have a CPU-hungry background server.

## Session-shape evidence

### What is actually published

| Evidence and publication boundary | Commands/steps/session evidence | Timing evidence | What it does and does not establish |
|---|---|---|---|
| **TraceLab v1**, UW authors, paper **2026-06-29**, Sep 2025–Jun 2026 daily Claude Code/Codex usage. [TL-paper] | **4,265 sessions, 432,510 tool calls**; D **101.4 calls/session**. Across the same release, blog reports **76% shell calls**, implying roughly **77 shell-tool calls/session**, not 77 independent process creations. [TL-paper] [TL-blog] | Paper: mean session **8.2 h**, median **5.1 min**; aggregate human wait **92.3%**, generation **3.3%**, tool execution **4.8%**. With each human gap capped at 1 h: **64.3% / 14.5% / 21.2%**. Request response mean **4.3 min**, median **38.3 s**; approximately **41% generation / 60% tools**. [TL-paper] | Long reopened-session gaps dominate the uncapped mean. Reported components involve attribution/overlap and rounding; do not force their rounded percentages to sum exactly. Tool wall time is not CPU time. |
| **TraceLab blog**, **2026-06-25**, same initial release. [TL-blog] | Per user request: **8.8 model steps, 10.8 tool calls** on average. **61% of calls <1 s**, but approximately **1% of total tool time**; approximately **4% >60 s** account for **85%**. | Mean generation **~13 s**, tool call **~18 s**. Human inter-request median **~1.4 min**, mean **46.7 min**. | Academic-lab convenience sample, not representative vendor telemetry. Parallel tools and asynchronous waits make sums of durations differ from critical-path time. |
| **TraceLab live v2 dashboard**, observed **2026-10-31**, collection through **2026-07-24**. [TL-live] | **52 users, 8,058 sessions, 743,819 tools**; D **92.3 calls/session**. Provider totals: Claude **305,005 / 5,319 = 57.3**, Codex **438,814 / 2,739 = 160.2** calls/session. | Displayed human thinking **91.6%**; request generation/tool split **38% / 61%**. Tool latency p50 **115 ms Claude / 921 ms Codex**. | Later, larger pool; keep its denominators separate from v1. Large provider differences warn against one “typical session.” No CPU/memory trace accompanies these summary ratios. |
| **Anthropic autonomy telemetry**, published **2026-02-18**. [AN-auto] | No command-count mean supplied in inspected article. | Median autonomous **turn ~45 s**, varying **40–55 s**. Turn p99.9 grew from **<25 min to >45 min** between Oct 2025 and Jan 2026. | A turn is a user request through stopping, not a whole persistent workstation session. The tail is not an average session length. |
| **Terminal-Bench 2.0 trajectory export**, dataset-maintainer card, current **2026-10-31** observation. [TB-data] | **52,104 trials**, 89 tasks, 26 scaffolds; **34,462** trials have steps. Reported median **21**, mean **47.1 steps/trajectory**. Includes Claude Code, Codex, OpenHands and mini-SWE-agent. | Schema has `duration_seconds` and start/end timestamps, sometimes null; inspected card does not report a duration distribution or inference/execution split. | A step can contain multiple commands, tools, or no tool. Do not relabel all steps as shell commands. Export is a primary dataset release, not an official benchmark population estimate. No large dataset was downloaded. |
| **Nebius OpenHands trajectory release**, current dataset card. [OH-data] | **67,074** trajectories, mean **64.3 turns**, cap **100**; its comparison lists SWE-smith/SWE-agent **30.2** and SWE-Gym/OpenHands **18.9** mean turns. | No joint execution/inference/idle wall-time distribution verified in inspected card. | Task/model/scaffold and training-sampling effects matter; trajectory turns are not billed commands. Useful replay sources, not resource-utilization measurements. |

### How these data constrain the cost claim

**I:** The requested idle scenarios are reasonable sensitivity points, but none is an established universal CPU-idle fraction. Interactive workstation lifetime can be overwhelmingly human wait; **within autonomous requests**, the published time split is much closer to **40% model / 60% tools**, rather than “95% thinking.” Human waiting, model inference, permission latency, subprocess I/O and actual CPU execution must remain separate.

**D/A:** If fast calls represent only `f = 0.01` of existing tool resource-seconds, accelerating their execution by `k` changes active execution cost by `1 − f + f/k`, before extra overhead. Even infinite improvement saves at most **1% of active tool cost** under that assumed time-to-resource mapping. A large savings claim must therefore come from releasing reserved memory/compute during gaps, moving substantial resource time onto the light tier, improving packing, or reducing overhead outside the short calls themselves. The published timing histogram alone does not establish which of these applies.

For a real replay, count actual shell/process executions after expanding compound commands, record peak and integral CPU/RAM, identify commands supported unchanged by Sofort, and retain the heavy tail and all failed/retried commands. An `exec` that launches a server is not economically equivalent to a short file read. This is a proposed future evidence requirement, not work executed for this desk study.

## Local measurements and limits

| Input | Evidence status and scope | Economic use here |
|---|---|---|
| Small-job reset **34–40 µs**; glue-16m real-task reset p50 **208 µs**, p90 **490 µs** | **M**, M4 Pro/HVF, **2026-10-31**. Reset only; `return 2` reset + run p50 about **83 µs** on glue-16m. [L1] | Use **208 µs reset** in the central overhead assumption, not 40 µs as the entire cost of a real command. |
| All **25/25 recorded v1 programs** fit final glue-16m; QuickJS reference needs **0.6–13.1 MiB** | **M**, final memory report. Earlier capacity report achieved **24/25** and is superseded for fit. Tool-reply/data transformations, not a full shell/Node/npm workload. [L1] [L2] | **A:** 16 MiB light guest memory, with host fixed costs/headroom covered by utilisation budget. It is a profile charge, not a new physical-memory measurement. |
| Linux small-job marginal memory **0.515 MiB return2 / 0.535 MiB one_tool**, shard fixed **1.6–1.9 MiB** | **M**, **2026-10-27**, nested KVM, small glue-2m jobs. Node executor sweep about **0.657–0.665 MiB/VM** plus roughly 35 MiB fixed. Hyperlight is similar/slightly lower. [L3] | Density evidence only; cannot assign this idle slope to every active 16-MiB job or multiply 128 GiB by its inverse to promise usable production capacity. |
| Final Linux one-slot RSS after real tasks **39.4 MiB on glue-16m**, versus **12.9 MiB** after a tiny job | **M**, **2026-10-31**, nested KVM, includes shared/fixed components; not a marginal density slope. [L1] | Real work grows resident footprint. Sensitivity must include control plane, dirty pages, shared images and buffers. |
| Brief-supplied real-program ranges **7–560 ms QuickJS / 4–107 ms native** | Context supplied by assignment; requested promote-payoff file **not present**. No independent attribution to an available measurement. | Runtime sensitivity only. The central **50 ms** is A. The available Oct 30 scriptc report instead measured **7–265 ms native wrapper runtime**, **18/25** correct, **1.4–2.9 s** fresh compile, outside a jitk guest. Do not conflate these. [L4] |
| Broad Linux/Node capability | Repository competition/goals distinguish current QuickJS execution from proposed unmodified Node/JIT, filesystem and shell compatibility. [L5] [L6] | **A:** light shares 30/60/90% are potential compatibility mix scenarios, not measured current shell-command coverage. |

## Cost model and formulas

### Host basis and achievable utilisation

**P:** AWS current US East (N. Virginia) Linux price feed was read directly on **2026-10-31**: `c7g.metal`, **64 vCPU, 128 GiB, $2.3200000000/hour, EBS-only**. [HOST-price] [HOST-spec]

**A:** Start with **u = 50% productive capacity** on both CPU and RAM budgets, including fleet slack, operating-system/VMM/control-plane capacity and capacity held for acceptable latency. This is **fleet utilisation**, separate from the idle fraction of an individual agent. A multiplexed fleet can have 95%-idle agents and still fill its host; a small or correlated fleet may not. No metal performance or scheduling capacity was measured here.

A host pays for CPU and memory together. **Charging the full host price once to CPU and again to RAM would double-count it; allocating half to each without a packing correction would undercount a CPU-only fleet.** Use the dominant resource requirement as the compute COGS floor:

```text
H = $2.32 / host-hour; V = 64 CPU; R = 128 GiB; S = 3600 s/hour
pC = H / (S V u) = $0.0000201388889 / CPU-second at u = 0.5
pM = H / (S R u) = $0.0000100694444 / GiB-second at u = 0.5

C_host(CPU_s, GiB_s) = max(pC × CPU_s, pM × GiB_s)
```

This fluid packing model is optimistic about divisibility and scheduling: use host-count rounding at small scale and additional fragmentation/headroom if needed. CPU seconds include guest work **and** host-side execution overhead. Memory seconds include memory residency during I/O, not just CPU-active intervals. Aggregate resources over the accounting window before taking `max`; do not sum independent per-job maxima if complementary jobs share a fleet. The central jobs are all CPU-bound or balanced, so the simpler per-command sum below equals the aggregate maximum.

**Billing is separate from COGS.** A customer bill can be `B = rC × actual CPU_s + rM × resident GiB_s + filesystem storage/I/O + operations`. To make this viable, its aggregate revenue must cover the dominant-resource COGS plus other costs and margin. A 50/50 host-cost allocation is an accounting convention, not proof that both halves can be sold. Do not advertise a µs-level cost while rounding every command's charge up to a second.

### Central workload assumptions

Every item in this table is **A** unless explicitly cross-referenced as M/P.

| Variable | Central value | Interpretation |
|---|---:|---|
| `l` | 0.30 / 0.60 / 0.90 | Light share by command count; heavy share `h = 1 − l`. |
| `i` | 0.50 / 0.80 / 0.95 | Fraction of reference workflow wall time with no useful tool executing. Includes model/human waits; assumes no persistent background process. |
| `tL` | 0.050 s | Useful light command; one busy CPU; no remote I/O wait. |
| `mL` | 16/1024 GiB | Guest memory while the light command runs. Host overhead/slack is covered by `u`; validate actual footprint before pricing. |
| `oL` | 0.001208 s | 1 ms assumed dispatch/FS/control overhead plus 208 µs existing real-task HVF reset. Charged as one CPU and resident light memory throughout. Not a Linux-metal result. |
| `tH` | 10 s | Useful heavy execution using **2 busy CPUs and 4 GiB**. Sensitivity extends to 1/60/300 s. |
| `bH` | 1 s per heavy command | Full-VM start/restore/initialisation and filesystem attach; charged at 2 CPU/4 GiB. New VM only for this command; no dependency-download or compile-cache rebuild beyond this budget. |
| Reference session VM | 2 CPU / 4 GiB | Same heavy capacity; reserves the full shape while running. |
| Initial session start | Excluded equally | Compare an already established workstation's steady usage. Repeated hybrid fallback starts are included. |
| Storage, network, I/O, model tokens | Excluded from tables | Added explicitly below; persistent filesystem is not assumed physically free. |

**D:** The reserved full-VM cost is:

```text
rF = max(2 pC, 4 pM) = $0.0000402777778 / running-second
RF = 3600 rF = $0.145 / reserved-VM-hour

L = max(pC × (tL+oL), pM × mL × (tL+oL))
  = $0.00000103127222 / light command
F = rF × (tH+bH) = $0.000443055556 / heavy command
A(l) = l L + (1-l) F                         # cost per mixed command
D(l) = l tL + (1-l) tH                       # useful seconds per command
```

For a reference agent-hour, keep useful work fixed:

```text
N(l,i) = 3600 (1-i) / D(l)                   # commands per reference hour
C_hybrid/hour = N × A(l)
C_reserved/hour = RF
C_ideal_pause/hour = RF × (1-i)              # immediate pause, free/instant resume
C_any/10k = C_any/hour × 10000 / N
```

“Agent-hour” therefore means **one hour of the reference workflow, including waits**, not an hour of CPU or a benchmark task. Hybrid overhead is charged in addition to its useful work. It can also lengthen completion: roughly `N[l oL + (1-l)bH]` extra seconds if all overhead is on the critical path. The model compares the same commands, not equal-latency completion or identical output when compatibility fails. At 90%-light/50%-idle, fallback/dispatch overhead adds about **174 s/reference hour**; this matters to latency-sensitive users.

For realistic auto-pause, use actual gaps `g_j`, timeout `τ`, resume-running overhead `bR` and operation fee `qR`:

```text
C_pause = rF × [sum(useful durations)
                + sum(min(g_j, τ))
                + bR × count(g_j > τ)]
          + qR × count(g_j > τ) + snapshot/storage charges
```

The ideal row deliberately gives the competitor the unattainably favourable `τ = bR = qR = 0`. The timeout example below assumes **evenly spaced gaps**, `g = 3600 i/N`, `τ = 5 s`, `bR = 1 s`, no operation fee/storage. It is a generic sensitivity case, **not a prediction of Blaxel's bill**; Blaxel's stated resume time is much shorter. Real bursty gap distributions can produce substantially different results even at the same aggregate idle share.

## Scenario tables

### Compute COGS per reference agent-hour

**All D from the preceding A/P inputs.** The continuously reserved VM costs **$0.145/hour in every row**. `Win` is that cost divided by hybrid COGS; it is not a market-wide price ratio.

| Light count share | Idle wall share | Commands/hour | Hybrid $/hour | Win vs always reserved | Ideal pause $/hour | 5-s timeout + 1-s resume $/hour |
|---:|---:|---:|---:|---:|---:|---:|
| 30% | 50% | 256.6 | 0.079659 | 1.82× | 0.07250 | 0.134510 |
| 30% | 80% | 102.6 | 0.031864 | 4.55× | 0.02900 | 0.053804 |
| 30% | 95% | 25.7 | 0.007966 | 18.20× | 0.00725 | 0.013451 |
| 60% | 50% | 446.7 | 0.079433 | 1.83× | 0.07250 | 0.145000 |
| 60% | 80% | 178.7 | 0.031773 | 4.56× | 0.02900 | 0.072176 |
| 60% | 95% | 44.7 | 0.007943 | 18.25× | 0.00725 | 0.018044 |
| 90% | 50% | 1,722.5 | 0.077915 | 1.86× | 0.07250 | 0.145000 |
| 90% | 80% | 689.0 | 0.031166 | 4.65× | 0.02900 | 0.145000 |
| 90% | 95% | 172.2 | 0.007791 | 18.61× | 0.00725 | 0.048877 |

Why increasing light count share barely changes cost per agent-hour: fixing idle share fixes useful execution time. Heavy jobs still consume approximately **99.8% / 99.3% / 95.7%** of it at 30/60/90% light count share. More short commands mainly increase throughput, not remove the cost of the heavy seconds.

At a **60-s** timeout, the 95%-idle 30/60/90%-light cases cost approximately **$0.07029 / $0.11699 / $0.14500 per reference hour** under the same evenly spaced-gap assumption. The last case never sleeps because its average gap is only approximately **19.9 s**. Aggregate idle share is insufficient to predict auto-pause savings.

### Compute COGS per 10,000 useful commands

| Light count share | Idle wall share | Hybrid $/10k | Always reserved $/10k | Ideal pause $/10k | 5-s timeout + 1-s resume $/10k |
|---:|---:|---:|---:|---:|---:|
| 30% | 50% | 3.1045 | 5.6510 | 2.8255 | 5.2422 |
| 30% | 80% | 3.1045 | 14.1274 | 2.8255 | 5.2422 |
| 30% | 95% | 3.1045 | 56.5097 | 2.8255 | 5.2422 |
| 60% | 50% | 1.7784 | 3.2464 | 1.6232 | 3.2464 |
| 60% | 80% | 1.7784 | 8.1160 | 1.6232 | 4.0399 |
| 60% | 95% | 1.7784 | 32.4639 | 1.6232 | 4.0399 |
| 90% | 50% | 0.4523 | 0.8418 | 0.4209 | 0.8418 |
| 90% | 80% | 0.4523 | 2.1045 | 0.4209 | 2.1045 |
| 90% | 95% | 0.4523 | 8.4181 | 0.4209 | 2.8376 |

Per-command hybrid cost is independent of inter-command idle only because the light VM and full-VM fallback are released, and the persistent filesystem/control plane is excluded here. Retaining a VM per inactive session invalidates that assumption.

### Sensitivity to the heavy tail

**D:** Same host, one-second fallback startup, 50-ms light commands. This table changes useful heavy duration; it does not reclassify all sub-second tools as compatible.

| Heavy useful duration | 30% light $/10k | 60% light $/10k | 90% light $/10k | 100% light $/10k |
|---:|---:|---:|---:|---:|
| 1 s | 0.5670 | 0.3284 | 0.08984 | 0.01031 |
| 10 s | 3.1045 | 1.7784 | 0.45234 | 0.01031 |
| 60 s | 17.2017 | 9.8340 | 2.46623 | 0.01031 |
| 300 s | 84.8684 | 48.5006 | 12.13289 | 0.01031 |

**D:** Even 90%-light by count does not approach five cents if its remaining tenth is ordinary 10-second build/test work. Batching adjacent heavy commands into one temporary Linux lease can amortise setup, but then its billing boundary becomes that lease or burst, not literally every shell command.

### Fleet utilisation and the host floor

**D:** With unchanged jobs, COGS scales as `0.5/u` relative to the central rows.

| Productive fleet utilisation | Reserved 2/4 VM $/h | 100%-light 50-ms $/10k | 90%-light mixed $/10k |
|---:|---:|---:|---:|
| 25% | 0.290000 | 0.02063 | 0.90467 |
| 50% | 0.145000 | 0.01031 | 0.45234 |
| 80% | 0.090625 | 0.00645 | 0.28271 |
| 100% theoretical | 0.072500 | 0.00516 | 0.22617 |

The 100% row leaves no operational headroom. A single lightly loaded host still costs **$2.32/hour**, regardless of how small its per-command marginal work is. Host-count rounding, burst reserves, availability zones and resource fragmentation can make actual utilisation much worse than 50%.

## Break-evens and situations where the model loses

### 1. Against a continuously reserved session

Let `A` and `D` be as above. Hybrid wins when:

```text
3600 (1-i) A / D < RF
or i > 1 - rF D/A
```

**D:** Central break-even idle fractions are **8.99% / 8.73% / 6.95%** for **30% / 60% / 90% light**. At zero idle these mixes lose, because repeated heavy startup adds overhead. These thresholds exclude filesystem costs and assume the reference reserves its full memory/CPU shape. Active-resource competitors with low actual RAM consumption have a lower denominator.

If the full fallback runs on a managed service instead of the modelled host, substitute its tariff and billing minimum. Cheap promotional Prime or a shared Fly machine may beat our full-VM COGS; they are alternatives for fallback supply, not evidence that Sofort creates cheaper physical heavy compute.

### 2. Against ideal instantaneous pause/resume

A light command saves `s = tL − L/rF = 0.024396` full-VM seconds in the central model. A fresh heavy command adds `bH` seconds. Therefore:

```text
l × s > (1-l) × bH
l > bH / (bH+s)
```

| Heavy startup budget | Light share needed to beat ideal pause |
|---:|---:|
| 10 ms | >29.1% |
| 100 ms | >80.4% |
| 1 s | >97.6% |
| 5 s | >99.5% |

All D, same CPU/memory assumptions. The result is sensitive to **full-VM startup plus useful readiness**, not the light reset alone. If light execution is slower than the corresponding Linux command, replace `s` with the actual resource saving; it can become zero or negative. Interpreter work, compilation, filesystem RPCs and semantic retries can erase the benefit before lifecycle savings are counted.

### 3. Snapshot economics can make frequent pause a bad baseline

**D using AWS tariff:** a **2-GB** snapshot written then read costs `2 × (0.0038+0.00155) = $0.0107` per cycle. At the default 1-vCPU/2-GB baseline, approximately **$0.1261/hour**, that equals roughly **305 s (5.1 min)** of running compute, before storage/transition time. If this much data is billed each time, pausing for shorter gaps costs more than staying live. Ten thousand cycles alone would be **$107**. Actual charged snapshot bytes may differ; this is a stated 2-GB assumption, not a universal snapshot size. [AW-price]

For any vendor, pause only when the avoided running charge exceeds transition compute, operation fees and state retention: `r_idle × max(g−τ,0) > q_cycle + r_transition × t_transition + storage_delta`. With active-CPU billing, `r_idle` may consist mostly of RAM rather than the entire CPU/RAM price.

### 4. Heavy work and persistent processes

| Workload | Why the strict per-command model can lose | Economic boundary that fits better |
|---|---|---|
| Builds/tests, package installs, browser automation | High CPU/RAM-seconds remain unavoidable; caches and package setup must survive. A fresh full VM repeatedly pays readiness and cache-warming costs. | A temporary full-Linux burst lease, prebuilt image and persistent caches; charge heavy work separately. |
| Development server + browser + database | One shell command can leave a process running for the rest of the session. Memory, sockets, watchers and database state cannot be represented solely by completed command files. | Explicit live-service lease billed for duration/actual resources; include its cost even while the model thinks. |
| GPU / CUDA / model inference | GPU time and device state dominate. CPU microVM reset does not make GPU allocations cheap or portable; GPU context/checkpoint support is a separate requirement. | GPU-specific active leases and a distinct rate card; no nickel promise. |
| Long I/O jobs | Waiting costs little CPU but retains guest/kernel/application state and RAM. Low CPU time is not zero memory cost. | Meter resident memory seconds and external storage/network; release only when state really can be restored. |
| Incompatible shell/Node/native tools | Failed light attempts, retry on Linux and output differences cost both execution and model tokens. Current QuickJS fit is not shell coverage. | Route confidently to fallback before execution; include false-positive routing and retry costs. |
| Sparse users or synchronised fleets | The host is billed while empty; correlated builds need spare capacity. The assumed packing utilisation may fail. | Price a minimum monthly/platform commitment or pool workloads across customers; measure actual utilisation. |

### 5. Persistent filesystem and control-plane costs

The complete formula must include costs that do not scale to zero with a command VM:

```text
K_total = C_host + C_fallback_external(if any, replacing its host term)
          + GB_month_retained × storage_rate
          + read/write operations + transferred_bytes × transfer_rate
          + metadata/indexing + logs + routing/auth/control-plane capacity
          + unrecovered failures/abuse + fixed-cost allocation
```

Do not add externally billed fallback on top of the same fallback's host COGS; choose one supply model.

**A/D example:** suppose the retained copy-on-write filesystem uses **5 GiB of unique billable data**, storage costs **$0.02/GiB-month** and a month is **720 hours**. One retained day costs **$0.00333**. At **100 commands/day**, retention alone is **$0.3333/10,000 commands**; at **10,000/day**, it is **$0.00333/10,000**. These are illustrative storage assumptions, not an AWS quote or measured dedup ratio. Indefinite workstation persistence needs a storage/retention charge or explicit allowance.

The EBS-only host price excludes persistent disks. Image sharing can make storage/reads cheap, but unique package installs, large repositories, branch churn, snapshot retention and artifacts must be charged once somewhere. Copy-on-write reduces duplicated bytes; it does not eliminate durability, I/O bandwidth or metadata work.

**D/A:** Keeping an inactive **0.5-MiB** slot costs about **$0.0000177/slot-hour** at the central memory-only capacity rate; 10,000 retained idle slots correspond to approximately **$0.177/hour** before fixed costs. This uses the older small-job measured slope as an illustrative reservation, not evidence that active glue-16m VMs have the same footprint. A pooled slot design avoids attaching one such slot to every persistent filesystem.

## Gross margin and a defensible nickel claim

### Minimum price at a target gross margin

Gross margin `g` means `(revenue − COGS)/revenue`; it is not markup. Without a specified target, the mathematical floor is merely price ≥ full COGS. For any target:

```text
P_min = K_total / (1-g)
```

**D, compute-only lower bounds at central utilisation/durations:**

| Light count share | Compute COGS /10k | Price floor at 50% gross margin | Price floor at 80% gross margin |
|---:|---:|---:|---:|
| 30% | $3.10448 | $6.20897 | $15.52241 |
| 60% | $1.77841 | $3.55682 | $8.89205 |
| 90% | $0.45234 | $0.90467 | $2.26169 |
| 100% | $0.01031 | $0.02063 | $0.05156 |

Add filesystem, network, operations and failure costs **before** applying margin. If those add an assumed **$0.01/10k**, the all-light floor becomes **$0.04063 at 50% margin** or **$0.10156 at 80%**. These are proposed economics, not recommended launch prices independent of market testing.

A usable offer would separate a bounded light-command tier, metered full-Linux/GPU work, retained filesystem storage and a platform/minimum commitment where needed. Publishing one average price for an unbounded shell invites adverse selection toward expensive jobs.

### What “$0.05 per 10,000 commands” requires

For heavy fraction `h`, use `K_10k = 10000[(1-h)L + hF] + K_other`. The allowable heavy fraction at selling price `P` and margin `g` is:

```text
h_max = [P(1-g)/10000 − K_other/10000 − L] / (F−L)
```

A negative bound means even the all-light workload fails the target.

| Interpretation of a nickel claim | Maximum heavy share with 10-s work + 1-s startup | Maximum useful all-light runtime, one busy CPU |
|---|---:|---:|
| Compute cost ≤ $0.05; no margin, no other costs | **0.898%** | **247.1 ms** |
| Sell at $0.05, 50% gross margin; no other costs | **0.332%** | **122.9 ms** |
| Sell at $0.05, 80% gross margin; no other costs | **None at the central 50 ms light runtime** | **48.45 ms** |

All D at `u = 0.5`, with 1.208-ms light overhead. Runtime bounds assume the 16-MiB light job remains CPU-bound and consume the entire cost allowance; storage and service overhead lower them.

For the brief-supplied runtime ranges, without pretending they are representative CPU measurements:

| Assumed useful light CPU runtime | Compute COGS /10k, all light |
|---:|---:|
| 4 ms | $0.00105 |
| 7 ms | $0.00165 |
| 50 ms | $0.01031 |
| 107 ms | $0.02179 |
| 560 ms | $0.11302 |

A 560-ms all-light workload already exceeds a nickel in raw compute at the central utilisation. Native execution also requires compilation/preparation to be amortised or included; the available scriptc report's seconds-long fresh compilation cannot disappear from the bill. [L4]

A precise claim could be: **“$0.05 per 10,000 supported light commands within a declared CPU/memory budget; persistent storage and full-Linux/GPU execution billed separately.”** The CPU budget, payload and result sizes, memory residency, I/O limits, error/retry policy, retention allowance and utilisation basis must be disclosed. At 50 ms, that price has only **79.4% compute-only gross margin**, before other costs. An unrestricted “10,000 agent commands for a nickel” claim is unsupported.

## Risks and decision

**The likely product advantage is a filesystem that can wait cheaply, with short isolated execution charged when useful work happens.** It can cut the waste of a generously provisioned workstation that remains live during model or human gaps. The µs reset helps implement that boundary, but it is not by itself the source of all the cost saving, and managed competitors already offer pause/scale-to-zero.

The main unresolved risks are **command compatibility**, Linux-metal CPU cost and memory accounting, fallback readiness including cache/FS attach, correlated fleet utilisation, filesystem durability/I/O, hidden long-running processes, and whether users accept separate service leases. A read/search-heavy command count can coexist with a build/test-heavy cost distribution. Local QuickJS reset numbers cannot be extrapolated into a 10× production advantage against tuned Firecracker snapshots or current active-resource products.

The economic go/no-go should use paired real workflow resource accounting: compare an always-live VM, a sensibly paused VM, an active-CPU/memory service and the hybrid at identical outputs and latency requirements. Report COGS and customer bills separately, and preserve slow/failed trajectories. **On desk evidence alone: pursue a bounded light tier and cheap persistent filesystem; do not base the broad coding-session business case on a nickel tariff or assume 90% light commands means 90% cost saved.**

## Sources with URLs

All web sources accessed **2026-10-31**. “Current” means an undated live primary page observed that day; latency claims remain author/provider claims. Source dates identify publications where available. Only small pages and existing repository reports were read; no trajectory corpus was downloaded or executed.

### Local repository sources

- **[L1]** [Guest memory, heap pool and HVF dirty reset](../../jitk/bench/v1/results/2026-10-31-memory.md), measured report dated **2026-10-31**.
- **[L2]** [Capacity for real tasks](../../jitk/bench/v1/results/2026-10-31-capacity.md), **2026-10-31**; superseded on final fit/reset by L1.
- **[L3]** [Linux same-host memory: jitk vs Hyperlight](../../jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md), **2026-10-27**, nested KVM.
- **[L4]** [scriptc on bench v1 programs](../../jitk/bench/v1/results/2026-10-30-scriptc-compile.md), **2026-10-30**, native host wrappers, not guest execution.
- **[L5]** [GrowOS/Node competition](../growos-node/01-COMPETITION.md), **2026-10-31**, context and source discovery; current vendor pages checked separately.
- **[L6]** [Benchmarks and goals](../growos-node/05-BENCHMARKS-AND-GOALS.md), **2026-10-31**, proposed compatibility/metal gates.
- **Missing requested source:** `arch/jitk/bench/v1/results/2026-10-31-promote-payoff.md` did not exist in this checkout at inspection. All four Markdown files actually present in that results directory were read.

### Host pricing

- **[HOST-price]** [AWS regional Linux on-demand price feed](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/US%20East%20%28N.%20Virginia%29/Linux/index.json), current; direct compressed JSON read verified `c7g.metal`, rate code `X8WMCBBQRGYPG6JY.JRTCKXETXF.6YS6EN2CT7`, **$2.3200000000**, 64 vCPU, 128 GiB, EBS-only.
- **[HOST-spec]** [AWS EC2 C7g instance specifications](https://aws.amazon.com/ec2/instance-types/c7g/), current.

### Vendor pricing, lifecycle and performance

- **[E2-price]** [E2B pricing](https://e2b.dev/pricing), current.
- **[E2-bill]** [E2B billing and limits](https://docs.e2b.dev/billing), current.
- **[E2-persist]** [E2B persistence, auto-pause and performance](https://docs.e2b.dev/sandbox/persistence), current.
- **[DT-price]** [Daytona pricing](https://www.daytona.io/pricing), current stable public tariff.
- **[DT-bill]** [Daytona billing by lifecycle state](https://www.daytona.io/docs/billing), current v0.226 docs. The older repository's v2 billing URL returned 404 during this research.
- **[MO-price]** [Modal pricing, Sandbox-specific section](https://modal.com/pricing), current; use Sandbox rates rather than cheaper preemptible Function headline rates.
- **[MO-res]** [Modal Sandbox resources and pricing](https://modal.com/docs/guide/sandbox-resources), current.
- **[MO-snap]** [Modal Sandbox snapshots](https://modal.com/docs/guide/sandbox-snapshots), current.
- **[MO-product]** [Modal Sandboxes product and startup FAQ](https://modal.com/products/sandboxes), current.
- **[VE-price]** [Vercel Sandbox pricing and quotas](https://vercel.com/docs/sandbox/pricing), current, default `iad1` rates.
- **[VE-billing]** [Vercel Sandbox vs CodeSandbox](https://vercel.com/kb/guide/vercel-sandbox-vs-codesandbox), vendor KB, **2026**, milliseconds statement; explicit memory minimum comes from VE-price.
- **[VE-snap]** [Optimizing Vercel Sandbox snapshots](https://vercel.com/blog/optimizing-vercel-sandbox-snapshots), **2026-04-02**, filesystem pipeline.
- **[CF-price]** [Cloudflare Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/), last updated **2026-10-05**. [Sandbox SDK pricing delegates to Containers](https://developers.cloudflare.com/sandbox/sdk/platform/pricing/), updated **2026-09-30**.
- **[CF-snap]** [Cloudflare native Container snapshots](https://developers.cloudflare.com/containers/guides/snapshots/), last updated **2026-09-30**.
- **[FL-price]** [Fly current pricing](https://fly.io/pricing/), current, landing-page selected configuration/region display; regional prices may vary.
- **[FL-bill]** [Fly Machine, volume and snapshot billing](https://docs.fly.io/about/billing), current.
- **[FL-resume]** [Fly suspend/resume introduction](https://community.fly.io/t/new-feature-in-preview-suspend-resume-for-machines/20672), provider staff, **2024-07-02**, updated availability **2024-07-24**; historical latency claim.
- **[AW-price]** [AWS Lambda pricing, MicroVMs section and examples](https://aws.amazon.com/lambda/pricing/), current; US East Arm example rates. Ordinary functions and SnapStart are distinct sections/products.
- **[AW-image]** [AWS MicroVM images and baseline sizes](https://docs.aws.amazon.com/lambda/latest/dg/microvms-images.html), current.
- **[AW-launch]** [AWS Lambda MicroVMs announcement](https://aws.amazon.com/about-aws/whats-new/2026/06/aws-lambda-microvms/), **2026-06-22**.
- **[AW-blog]** [Announcing Lambda MicroVMs](https://aws.amazon.com/blogs/compute/announcing-lambda-microvms-serverless-compute-environments-with-vm-level-isolation-and-near-instant-startup/), **2026-07-10**.
- **[BL-price]** [Blaxel pricing and lifecycle FAQ](https://blaxel.ai/pricing), current; standby, snapshots and allocated-memory active rate.
- **[BL-meter]** [Blaxel per-second metering](https://blaxel.ai/blog/stop-paying-for-idle-how-we-built-per-second-metering-for-blaxel-sandboxes), **2025-12-03**.
- **[RL-price]** [Runloop pricing](https://runloop.ai/pricing), current; calculations use unit rates rather than the page's approximate day-cost example.
- **[RL-state]** [Runloop SDK state definitions](https://runloopai.github.io/api-client-ts/stable/interfaces/types.DevboxView.StateTransition.html), current, suspended compute semantics.
- **[RL-life]** [Runloop devbox lifetime management](https://docs.runloop.ai/docs/devboxes/start-stop), current, idle-policy defaults.
- **[RL-home]** [Runloop product performance claims](https://runloop.ai/), current.
- **[RL-resume]** [Runloop suspend/resume and snapshots introduction](https://runloop.ai/blog/product-update-introducing-suspend-resume-and-snapshots), **2024-11-12**.
- **[MF-price]** [Morph Cloud subscription/MCU pricing](https://cloud.morph.so/web/subscribe), current; this is Morph Cloud, not Morph's code-editing model API.
- **[MF-terms]** [Morph Cloud terms, billing detail](https://cloud.morph.so/web/legal/terms-of-service), current.
- **[MF-docs]** [Morph Infinibranch overview](https://cloud.morph.so/docs/developers), current.
- **[DE-product]** [Deno Sandbox current pricing and startup FAQ](https://deno.com/deploy/sandbox), current.
- **[DE-price]** [Deno Deploy plan and Sandbox meters](https://deno.com/deploy/pricing), current; lower historic launch rates not adopted.
- **[DE-vol]** [Deno volumes and snapshots](https://docs.deno.com/sandbox/volumes/), current.
- **[DE-launch]** [Introducing Deno Sandbox](https://deno.com/blog/introducing-deno-sandbox), **2026-02-03**; historical launch figures.
- **[PI-price]** [Prime Sandboxes product/pricing](https://www.primeintellect.ai/sandboxes), current, promotional validity through **2026-12-22**.
- **[PI-docs]** [Prime overview, current billing and shape limits](https://docs.primeintellect.ai/sandboxes/overview), current.
- **[PI-pause]** [Prime pause/resume](https://docs.primeintellect.ai/sandboxes/pause-resume), current; RAM/process preservation, disk/checkpoint billing, node-local limitation.
- **[PI-launch]** [Prime Sandboxes GA](https://www.primeintellect.ai/blog/sandboxes), **2026-09-23**.

### Session and trajectory evidence

- **[TL-paper]** [TraceLab v1 paper, Tables 1 and 7](https://arxiv.org/html/2606.30560v1), **2026-06-29**, original 4,265-session dataset.
- **[TL-blog]** [UW SyFI TraceLab observations](https://syfi.cs.washington.edu/blog/2026-06-25-tracelab/), **2026-06-25**, shell share and latency-mass observations.
- **[TL-live]** [TraceLab live dashboard](https://tracelab.cs.washington.edu/), current snapshot observed **2026-10-31**, v2 pool ending **2026-07-24**.
- **[AN-auto]** [Anthropic: Measuring AI agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy), **2026-02-18**.
- **[TB-data]** [Terminal-Bench 2.0 trajectory dataset card](https://huggingface.co/datasets/yoonholee/terminalbench-trajectories/blob/main/README.md), current primary dataset-maintainer release; figures read from card, not independently recomputed.
- **[OH-data]** [Nebius SWE-rebench OpenHands trajectories](https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories), current primary dataset card, including cross-dataset turn comparison. [Author release explanation](https://nebius.com/blog/posts/openhands-trajectories-with-qwen3-coder-480b).

Reference keys above are source identifiers, not performance certification. Any A/D value without an external citation is intentionally a stated assumption or an arithmetic consequence of the model, not an additional published measurement.
