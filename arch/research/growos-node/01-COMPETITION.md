# Competition: isolated Linux execution for agents and serverless

Research cutoff: **2026-10-31**. Desk research only; no builds, benchmarks, Docker, VMs, deployments, paid accounts, or customer contact. The only file written for this assignment is this report. Prices are USD, before tax, as displayed at access; undated live documentation is identified as such. This is a broad map of the serious alternatives found, not a claim to have enumerated every sandbox startup.

## Summary

- **The decisive comparator is optimized Firecracker restoring the same initialized Node workload on the same bare-metal Linux host.** Its 125 ms cold-boot headline is the wrong denominator for a microsecond reset claim. Firecracker already shares snapshot pages with `MAP_PRIVATE` and copies on write. [FC-snapshot]
- **The closest feature competitor is Hyperlight–Unikraft.** It already documents ordinary Node.js, warmed snapshots, host callbacks, default-deny filesystem/network access, Linux/KVM and Apple Silicon/HVF. “Tiny guest plus Linux compatibility plus host tools” is occupied territory. Node is a tested tier-2 runtime, not a full conformance guarantee. [HLUK] [HLUK-tiers]
- **Unikraft Cloud is a substantial competitive threat, not just a research unikernel.** Current marketing claims ~10 ms live forks and <10 ms starts/resumes; current cloud material also describes a trimmed Linux kernel. Do not assume its commercial cloud is identical to the BSD LibOS. [UK-cloud] [UK-how]
- **Density claims need state qualifiers.** Unikraft's May 18 demonstration was a million **scaled-to-zero** VMs on one server; Modal's July 16 demonstration was a million concurrent sandboxes **across a fleet**. Neither means a million simultaneously executing Node heaps per box. [UK-million] [Modal-million]
- **Sofort already has counterevidence to an easy memory win.** Its October 25 nested-KVM ledger measured a minimal restored Firecracker/Linux fixture at **1.432 MiB marginal charged memory/VM**, and shared Hyperlight/QuickJS-NG at **0.371 MiB plus fixed shared costs**. Neither fixture is the Stage 3 Node baseline. [Local-ledger]
- **The 34–40 µs reset and ~2.4–2.5 MiB idle slot results are real local QuickJS/HVF measurements, not Node or bare-metal Linux results.** Real-task reset medians reached 208 µs on glue-16m; its reported p90 was 490 µs. [Local-memory]
- **“Fork a running computer in milliseconds” is already taken:** Morph full-state branching, Freestyle live forks, microsandbox live forks, Unikraft forks, and AGX/Substrate's advertised 7 ms fork. Disk-only branching is separately available from Runloop, Vercel and Cloudflare. [Morph] [Freestyle-guide] [MSB] [UK-cloud] [AGX] [Runloop-snap] [Vercel-persistence] [CF-snapshot]
- **Managed full-Linux supply expanded materially during 2026:** Deno Sandbox launched February 3; Modal added VM Sandboxes in June; AWS Lambda MicroVMs launched June 22; Prime Sandboxes went GA September 23. [Deno-launch] [Modal-vm-launch] [AWS-micro-launch] [Prime-launch]
- **Blaxel's ~25 ms standby resume is a relevant service target**, but no matched Node p50/p99 reset distribution or physical MiB/VM was verified. Similar missing methodology affects Daytona's <90 ms and E2B's older 150–170 ms session-start claims. [Blaxel-docs] [Daytona-docs] [E2B-HF]
- **Do not repeat stale licensing claims.** Daytona closed its production codebase on June 11, 2026; the old public repository remains but is unmaintained. OSS SDKs are not an OSS hosted backend. [Daytona-source]
- **Pricing pressure is already strong.** Prime's promotional compute is $0.02/vCPU-hour + $0.0125/GiB-hour through December 22; Fly offers a 256 MB shared-CPU Machine at about $0.003/hour. Sofort must show useful-job economics, not infer selling prices from kernel memory alone. [Prime-launch] [Fly-price]
- **Candidate open gap, not established exclusivity:** reproducible, sub-millisecond pristine reset of an initialized, unmodified Node/V8 JIT runtime, with low unique resident memory, bounded p99 under churn, and host-brokered effects. The entire contract must include files, threads, entropy, clocks and abandoned I/O. (I.) [Local-architecture] [FC-snapshot]
- **Keep the ≥10× Stage 3 gate.** Require the gain against the best matched Firecracker configuration on reset latency, unique MiB/VM, or useful VMs/box; disclose regressions on the other axes. No public number found establishes a universal Node reset or memory floor. (I.)

## Evidence and comparison rules

**F** = verified that a primary source documents a mechanism, feature, rate, or deployment. **P** = a provider/project author's performance claim or measurement; not independently reproduced here. **R** = published research with disclosed method; still author-measured unless a separate reproduction exists. **L** = existing local report, read but not rerun. **I** = inference/recommendation. **NR** = not reported in the inspected primary sources, or not verified. NR is not zero and is not proof of absence.

A feature can be F while its speed is only P. Customer quotes on a vendor site are **vendor-published adoption evidence**, not independent performance tests. Stars, investment, integration examples, and logo walls do not prove production adoption.

Operation vocabulary used throughout:

| Operation | What the timer must include |
|---|---|
| Cold boot | New VM/VMM, guest boot and runtime initialization; specify whether image pull, scheduling and network are included. |
| Restore/resume | Recreate or wake a saved machine; specify memory vs filesystem, cached vs uncached pages, and first useful response. |
| Fork | Produce an independent child from a live parent's state; specify whether memory/processes survive and whether copy-on-write is used. |
| Pristine reset | After hostile work, restore a trusted baseline and prove the next job cannot observe previous tenant state. This differs from resuming the same tenant. |
| Warm exec | Execute a command/function inside an already running environment; not a new isolation boundary by itself. |

**Memory:** configured guest RAM, billing reservation, image/snapshot size, VMM RSS, unique PSS/memcg charge and total capacity are different quantities. Unless explicitly marked measured, the RAM figures below are **allocations**, not physical overhead. Platform concurrency quotas are not per-host density. All raw boot/restore claims exclude an unspecified component unless the source explicitly includes it.

**Scope:** full Linux products run a Linux guest or present a Linux ABI. Wasm/WASI and JavaScript isolates are substitutes for smaller workloads, not full-Linux equivalents. Hyperlight's Wasm branch is included because it competes directly with today's code-mode executor. A custom kernel supporting 81% of a selected static corpus is not yet general Linux compatibility or proof that dynamic Node, npm, native addons, browsers or containers work. The roadmap stages in the assignment are treated as proposed work, not shipped capabilities.

The required five local context documents were read first. The architecture's engine table contains stale HVF full-copy wording; the dated October 31 memory report describes dirty reset and takes precedence for that measurement. Likewise, the earlier GrowOS-fit recommendation favors bounded workloads; this report evaluates the broader Node roadmap requested here without treating it as already validated. [Local-readme] [Local-architecture] [Local-fit] [Local-memory] [Local-hosted]

## Comparison table

Rates are CPU-hour + RAM GiB-hour unless another unit is written. **No row's advertised startup is an independently established pristine Node reset time.** Details, source status, adoption and qualifications follow.

| Competitor | Boundary / Linux strategy | Published lifecycle number, with boundary | Memory / density evidence | Price / source status |
|---|---|---|---|---|
| **E2B** | Firecracker microVM; actual Linux | P: 150–170 ms new session, March 2025 case; current pause/fork features | Default allocation 2 vCPU/4 GiB; physical slope NR | $0.0504/vCPU-h + $0.0162/GiB-h; Pro $150/mo; Apache runtime [E2B-price] [E2B-HF] [E2B-home] |
| **Daytona** | Current dedicated-kernel sandboxes; v2 alpha explicitly Firecracker; older container mode also documented | P: <90 ms code-to-execution; P: 2,000 ready in 27.4 s on Vera, October 2026 | Hardware fleet experiment, no verified unique MiB/VM | $0.0504 + $0.0162; production closed since June 11 [Daytona-docs] [Daytona-arch] [Daytona-density] [Daytona-price] [Daytona-source] |
| **Vercel Sandbox** | Container within Firecracker/Linux | P: April disk restore p75 <1 s, p95 ~5 s; October create timing changed | RAM 2 GB/vCPU; physical cost NR | From $0.128 active vCPU-h + $0.0212/GB-h; regional/minimum/storage charges; hosted backend closed [Vercel-perf] [Vercel-create] [Vercel-product] [Vercel-price] |
| **Modal** | gVisor Linux ABI or VM with real Linux kernel | P: older torch restore p50 1.05 s; million sandboxes <1 min fleet-wide | Default requests 0.125 physical core/128 MiB, burstable; not overhead | $0.141912/physical-core-h + $0.024012/GiB-h sandbox rates; closed service [Modal-mem] [Modal-million] [Modal-resources] [Modal-price] |
| **Fly Machines** | Firecracker, actual Linux from OCI images | P: a few hundred ms resume; 100–250 ms user anecdote, not benchmark | Smallest displayed preset 256 MB; physical slope NR | ~ $0.003/h shared-cpu-1x/256 MB; backend closed [Fly-resume] [Fly-variation] [Fly-price] |
| **Cloudflare Containers / Sandbox** | Per-instance microVM/Linux; distinct from Dynamic Workers | Exact current cold/restore percentile NR; snapshots preserve filesystem only | lite 256 MiB; 6 TiB account quota is not box density | $0.072 active vCPU-h + $0.009/GiB-h + disk; $5 Workers plan; SDK open, service closed [CF-overview] [CF-snapshot] [CF-limits] [CF-price] |
| **Blaxel** | Forked Firecracker/Linux with custom network/control plane | P: <25 ms standby resume; no reproduced distribution | RAM-linked CPU sizes; physical slope NR; advertised 50K+ concurrency is fleet scale | $0.0000115/allocated GB-s active mode, $0.20/GB-mo snapshots; backend closed [Blaxel-docs] [Blaxel-price] [Blaxel-engine] |
| **Morph Cloud** | Full-state VM; Infinibranch engine, exact VMM NR | P: snapshot/branch/restore <250 ms; no percentile/hardware method | Example allocation 4 GiB; “near-zero” branch overhead unquantified | Standard $0.05/MCU; one MCU covers 1 vCPU-h + 4 GB-h +16 GB disk-h; proprietary [Morph] [Morph-price] [Morph-terms] |
| **Runloop** | MicroVM + container on custom bare-metal hypervisor; Linux | P: <2 s 10 GB image startup; ~100 ms command execution; disk-only branch | Size reservations available, unique density NR | $0.108/CPU-h + $0.0252/GB-h; Pro $250/mo; closed service [Runloop-home] [Runloop-price] [Runloop-snap] |
| **microsandbox** | libkrun, real Linux; KVM/HVF/WHP | P: <100 ms average **guest boot on M1**; live forks and full snapshots documented | Configurable RAM; `--cow-mem`; physical slope NR | Apache-2.0, self-host hardware cost; beta [MSB] |
| **Firecracker** | KVM VMM + Linux guest, x86-64/arm64 | P/spec: ≤125 ms InstanceStart→init; historical 5 ms restore slide | ≤5 MiB **VMM-thread** overhead on specified fixture; not total guest cost | Apache-2.0; infrastructure cost only [FC-spec] [FC-2019] |
| **Cloud Hypervisor** | Rust KVM/MSHV VMM + Linux/Windows | P: <100 ms direct boot to userspace; modern CoW/lazy restore documented, timing NR | “Minimal” overhead; matched MiB/VM NR | Apache-2.0/BSD components, self-host [CH-home] [CH-license] [CH-snapshot] |
| **Kata Containers** | VM per sandbox/pod; real Linux; QEMU/CH/FC | No universal current startup/reset number verified | Guest + shim + VMM + I/O helpers; no universal physical slope | Apache-2.0; self-host/distributor pricing [Kata] [Kata-overhead] |
| **gVisor** | Userspace Go Linux-ABI Sentry; systrap or KVM platform | Checkpoint/background restore exists; current matched Node timing NR | Workload-dependent Sentry + application; no fixed per-instance MiB verified | Apache-2.0 runtime; hosted products extra [gV-intro] [gV-compat] [gV-cr] |
| **Unikraft / kraft.cloud** | OSS LibOS Linux API/ABI; current cloud describes specialized Linux images and Firecracker fork | P: <10 ms resume/checkpoint, ~10 ms live fork | P: million scaled-to-zero VMs/384 GB box; not resident live Node density | OSS core BSD-3-Clause; commercial cloud plans $0/$39/$199/custom [UK-oss] [UK-cloud] [UK-million] [UK-price] |
| **Nanos / NanoVMs** | Single-process Linux-compatible unikernel; VM boundary | P: “tens of ms” boot depending on app; no reset/fork percentile | Per-Node physical overhead NR | Open kernel; hardware + commercial support; C2 $7/user-mo [Nanos] [Nanos-boot] [Nanos-C2] |
| **Hyperlight family** | Device-free microVM; custom guest, Wasmtime/WASI, or Unikraft Linux ABI | P: 1–2 ms spawn; ~0.9 ms **warm HTTP demo**; not Linux reset | Shared-snapshot local QuickJS experiment 0.371 MiB/VM + fixed memory, nested KVM | Apache family; self-host; no standalone hosted rate [HL-intro] [HL-demo] [HL-wasm] [HLUK] [Local-ledger] |
| **libkrun / krunvm** | Library VMM + bundled Linux; OCI process execution | “Fast boot” documented; transferable numeric restore/reset result NR | Minimal-device design; matched physical slope NR | Apache-2.0 library/CLI; Linux firmware licensing separate [Krun] [Krun-license] [Krunvm] |
| **AWS Lambda SnapStart** | Firecracker memory/disk snapshot of initialized function | P: historical Java demo <200 ms total cold invoke; not per-invocation reset | 128 MB–10,240 MB function allocation, not footprint | Normal Lambda + cache/restore fees (Java exception); managed service [SnapStart] [SnapStart-2022] [AWS-price] [Lambda-limits] |
| **AWS Lambda MicroVMs** | Managed Firecracker/Linux; preinitialized full-state image | June 22, 2026 launch; “near-instant”, numeric p50/p99 NR | Default baseline 1 vCPU/2 GB, up to 4× burst; physical slope NR | Baseline + active excess + snapshot operations/storage + transfer; closed [AWS-micro-launch] [AWS-micro-compute] [AWS-price] |
| **Deno Sandbox** | Firecracker/Linux; arbitrary Linux binaries | Feb. launch <1 s; current landing <200 ms, method NR | Default ~1.2 GiB; 768–4096 MB configurable in docs | Landing $0.10 CPU-h + $0.025/GiB-h; plan rates vary; backend closed [Deno-launch] [Deno-product] [Deno-create] [Deno-price] |
| **Fly Sprites** | Persistent hardware-isolated Linux microVM | P: ~1 s **filesystem checkpoint**; warm vs cold wake differentiated | Elastic actual memory billing; 100 GB disk capacity is not RAM | $0.0385 CPU-h + $0.021875/GB-h + storage; closed backend [Sprites] [Sprites-docs] [Fly-price] |
| **Freestyle** | Full Linux microVM; CoW live fork | P: <100 ms resume in engineering guide; live fork API, exact fork time NR | VM allocation limits, unique memory slope NR | $0.04032/vCPU-h + $0.0129/GiB-h; $0/$50/$500 plans with allowances [Freestyle-guide] [Freestyle-branch] [Freestyle-price] |
| **Prime Sandboxes** | Full Linux microVM; OCI images | Sept. 23 GA; numerical start/resume/reset NR; snapshots were roadmap at GA | Tens of thousands concurrent fleet-wide; unique MiB NR | Promo $0.02 + $0.0125 through Dec. 22; no subscription; backend status not established as OSS [Prime-launch] [Prime] |
| **Tensorlake** | Firecracker/Linux; snapshot/resume | Reproducible current reset/start percentiles NR | Free shape 1 vCPU/1 GB; unique physical cost NR | Usage credits $0.07/core-h + $0.015/GB-h; Pro $0.042 + $0.009 with $250/mo credit commitment [Tensorlake-price] |
| **Northflank Sandboxes** | Kata/Cloud Hypervisor or gVisor; OCI/Kubernetes | Per-node reset/restore percentiles NR | Account/fleet scale claims; physical slope NR | Second-based resource plans/BYOC; exact matched tariff NR; service proprietary [NF] [NF-changelog] |
| **AGX / Substrate** | Linux microVM substrate; proprietary hosted boundary details incomplete | P: 7 ms fork; 5.4 ms warm /12.7 ms cold restore to first response, amd64 | Boot comparison configured at 2 GiB; unique memory NR | Early-access/waitlist page; price and production adoption NR [AGX] |
| **Microsoft NVX** | OpenVMM + actual Linux guest, KVM/MSHV/WHP | Benchmark machinery published; accepted numerical result NR in this pass | Usage docs give 128 MiB Alpine/256 MiB Ubuntu defaults; not footprint | MIT orchestration plus upstream component licenses; self-host [NVX] [NVX-usage] [NVX-license] |
| **Edera** | Xen-derived type-1 zones, dedicated Linux kernel | Vendor runc comparison exists; pristine reset/fork NR | Full guest/resource configuration dependent; unique MiB NR | Commercial platform with OSS components; quote required [Edera] [Edera-bench] |
| **CodeSandbox / Together** | Firecracker-class microVM development environments | P: create/clone/restore within 2 s | Allocated VM sizes; host density NR | Current direct pricing fetch 403; historical third-party rate not adopted [CS] [CS-price] [BuildBuddy-blog] |

## Per-competitor notes

### 1. E2B

**F:** A full Linux microVM per session with commands, files, terminal, pause/resume and now fork exposed on the product page. E2B publishes an Apache-2.0 runtime/self-host story; that does not imply every commercial deployment component is covered by the same license. [E2B-home]

**P / method:** The March 31, 2025 Hugging Face case says new sessions take about 150–170 ms. It supplies integration code but not sample count, host specification, percentile distribution or a precise network timer. Its example runs multiple evaluations inside one sandbox: do not interpret it as a fresh VM for every test. **Adoption:** Hugging Face Open R1 reward execution is named evidence, published by E2B. [E2B-HF]

**F / economics:** $0.000014/vCPU-second and $0.0000045/GiB-second; default 2 vCPU/4 GiB. Pro is $150/month plus usage. No independently verified per-host Node density or dirty reset figure found. **I:** Sofort could compete for very short isolated evaluations if it retains compatibility while cutting clean-turn cost; E2B's SDK, templates and operations remain separate advantages. [E2B-price]

### 2. Daytona

**F:** Current docs promise dedicated kernels. V2 **alpha** architecture explicitly identifies Firecracker and starting most sandboxes from memory snapshots; do not silently apply alpha architecture to every legacy deployment. Stable billing docs still distinguish container, VM and GPU sandboxes. The often-repeated “Daytona = Docker” characterization is incomplete as of the cutoff. [Daytona-docs] [Daytona-arch] [Daytona-billing]

**P / method:** <90 ms code-to-execution is a headline without a percentile/method. October 7's hardware comparison is more concrete: same image and commands, measured until ready, 1,000 sandboxes in 10.8 s and 2,000 in 27.4 s on NVIDIA Vera; no unique memory slope or matched Node reset. “One CPU” here means a processor/system, not one execution core. [Daytona-docs] [Daytona-density]

**F:** Public compute tariff $0.0504/vCPU-h, $0.0162/GiB-h, disk $0.000108/GiB-h after allowance, per-second billing. V2 alpha separately documents minute billing with reservations as a floor; quote version when comparing. Production closed source June 11; old OSS repo frozen. **Adoption:** coding agents, evals and computer use are documented markets; a named customer's production use was not independently verified. **I:** beat measured clean Node turns, not the <90 ms slogan. [Daytona-price] [Daytona-v2-billing] [Daytona-source]

### 3. Vercel Sandbox

**F:** A container runs inside a Firecracker VM with its own Linux kernel. The current product supports ordinary Linux images, Docker/FUSE and sudo; the current default is Ubuntu. SDK openness does not make the hosted backend open source. Its product page quotes Xata and identifies Cua desktop integration; distinguish a planned-use testimonial from deployment volume. [Vercel-product]

**P / method:** April 2, 2026 engineering account: filesystem restore p75 fell from >40 s to <1 s and p95 from ~50 s to ~5 s, using parallel transfer/decompression and a ~95% local snapshot-cache hit rate. This is a disk pipeline, **not a live Node heap restore**. October 8 changed create to wait for restoration, adding ~50 ms to create p50 while total through first operation stayed unchanged. [Vercel-perf] [Vercel-create]

**F / economics:** Starting rates $0.128 active CPU-hour and $0.0212 provisioned GB-hour; creation $0.60/million, snapshot storage from $0.08/GB-month, with regional and plan variation. Provisioned memory has a one-minute minimum; stopped persistence saves filesystem, not process memory. **I:** deterministic sub-ms pristine turns could be a useful gap, but secret brokering, lifecycle and full-OS usability are already product features here. [Vercel-price] [Vercel-persistence]

### 4. Modal

**F:** Do not describe 2026 Modal as exclusively gVisor. The SDK now selects `runtime="gvisor"` or `runtime="vm"`; VM mode runs a real Linux kernel for Docker, FUSE and nested cgroups. GPU Sandboxes use gVisor. VM memory snapshots remain alpha and enabled for selected customers in the inspected documentation. [Modal-runtime] [Modal-vm-snapshot]

**P:** The older memory-snapshot article gives a torch initialization example at ~1.05 s p50 versus ~5 s cold; it is an initialization-heavy Python workload, not an engine reset test. July 16's new control plane demonstrated one million concurrent sandboxes created in <1 minute over many nodes; no per-box million-VM implication. [Modal-mem] [Modal-million]

**F:** Default resource requests are 0.125 core/128 MiB with bursting and billing on `max(request, actual)`. Sandboxes cost 3× Function list rates: $0.00003942/physical-core-second (two-vCPU equivalent) plus $0.00000667/GiB-second before region effects. The service is closed; SDKs and upstream gVisor are separate. Customer page lists sandboxed code/coding agents, but do not transfer inference customer adoption to VM Sandboxes. **I:** Sofort might win clean-turn density; Modal already competes hard on elastic packing and fleet throughput. [Modal-resources] [Modal-price] [Modal-users]

### 5. Fly Machines

**F:** Linux Firecracker VMs with a managed image/network/storage API. The 2024 suspend release describes preserving memory/VM state and serving again in a few hundred milliseconds. Resume can fall back to cold boot after placement changes; the original release explicitly did not guarantee snapshot survival. Read current contracts before relying on historical size limits. [Fly-resume]

**P / independent status:** A user reported ~250 ms then ~100 ms resume; Fly attributed it to ordinary variation in network setup/cache state. This is an anecdote, not a distribution. December 11, 2025 interruptible suspend cancels a pending memory copy to resume the existing VM; that fast path is different from reconstructing one. [Fly-variation] [Fly-interrupt]

**F:** Current landing tariff lists shared-cpu-1x/256 MB at $0.0030/hour ($2.19/month), per-second while running; volumes $0.15/GB-month and snapshots $0.08/GB-month. An older docs price table is slightly lower, so this report uses the newer landing figure rather than merging them. **Adoption:** Fly's own Sprites product is relevant same-company agent infrastructure, not an independent customer benchmark. Backend closed; tools/upstream Firecracker have separate licenses. **I:** pristine per-job semantics and lower unique idle state could differentiate; persistent regional Linux compute is already served. [Fly-price] [Sprites]

### 6. Cloudflare Containers and Sandbox SDK

**F:** Containers are full Linux microVMs with their own kernel/network. Dynamic Workers are a different runtime choice and do not promise arbitrary Linux. Containers/Sandboxes became GA April 13, 2026; the September 30 docs introduce the newer SDK/environment structure, with Durable Object scheduling still public beta. [CF-overview] [CF-changelog]

**F:** Current `snapshotContainer()` captures the full **filesystem only**, is tied to the image version, and expires after 30 days without restore. It excludes RAM and running processes. February's directory-backup API should not be mislabeled VM checkpointing. No primary, current, reproducible Linux start/resume/reset percentile was verified. [CF-snapshot] [CF-changelog]

**F:** 256 MiB lite allocation; 6 TiB memory/1,500 vCPU account caps are quotas. CPU $0.000020/active vCPU-s, RAM $0.0000025/provisioned GiB-s and disk $0.00000007/GB-s; 10 ms units, $5 Workers plan and Workers/DO/log/network charges also apply. SDK source is public; hosted VMM backend not established as open. **Adoption:** coding-agent integrations are documented, not proof those vendors outsource all sandboxes to Cloudflare. **I:** Node memory reset could fill a technical gap, but remote network/tool latency may dominate the saved microseconds. [CF-limits] [CF-price] [CF-overview] [CF-sdk]

### 7. Blaxel

**F:** Blaxel describes a Firecracker fork with vector packet processing and a custom control plane. Ordinary Linux processes/files and memory-preserving standby are documented. Standby retains state but cannot preserve external connections indefinitely. Snapshot/fork is marked private preview in the inspected docs. [Blaxel-engine] [Blaxel-docs]

**P / method:** ~25 ms resume is prominent; docs also call it sub-25 ms cold start, although the detailed lifecycle discusses reconnecting to standby. No hardware, sample count, cache condition or p50/p99 distribution was found. Idle transition wording differs across pages (~5 s marketing vs ~15 s docs), so use the lifecycle version in any experiment. [Blaxel-docs] [Blaxel-code]

**F:** $0.0000115 per allocated GB RAM-second while active, CPU coupled to RAM; standby snapshots $0.20/GB-month, images $0.045/GB-month. “Active CPU” is a tariff label: docs say active mode is maintained by connections and bills allocated memory; do not model it as raw CPU-cycle metering. Physical footprint/density NR. **Adoption:** SpawnLabs is a named case. SDKs are public, proprietary hosted engine. **I:** 25 ms is an important service resume target; it is not the matched low-level reset floor. [Blaxel-price] [Blaxel-docs] [Blaxel-users]

### 8. Morph Cloud / Infinibranch

**F:** Full-state checkpointing includes RAM, CPU, kernel and filesystem; independent descendants can continue from a running computation. The inspected public docs do not establish the underlying VMM implementation, so this report does **not** label Morph Firecracker, QEMU or a unikernel. [Morph] [Morph-terms]

**P:** <250 ms snapshot/branch/restore and “near-zero” branching overhead lack enough hardware, workload, percentile and touched-page detail to establish a Node benchmark. This is nevertheless a direct product claim on Sofort's proposed branching territory. [Morph]

**F:** Standard MCU $0.05: one vCPU-hour plus 4 GB RAM-hours plus 16 GB disk-hours, or 5 TB snapshot-hours. Resource sizing uses the maximum of CPU, RAM/4 and disk/16 (with documented rounding); do not add all three MCU counts. Team $40/month, Scale $250/month with credit discounts. Infinibranch is proprietary; published terms restrict public benchmark publication without consent. **Adoption:** repository research previously identified an Open R1 Morph provider, but this pass did not verify a named production Morph customer. **I:** a locally reproducible, lower-level reset/memory result is more defensible than claiming invention of branching computers. [Morph-price] [Morph-terms] [Local-gaps]

### 9. Runloop

**F:** Two boundaries, VM plus container, on a custom bare-metal hypervisor; arm64/x86 and full Docker workflows. Do not infer Firecracker from “microVM”: the inspected product page does not name that implementation. **F:** public snapshot docs explicitly say **only disk snapshots**. Branches copy working filesystem state, not necessarily a paused V8 heap. [Runloop-home] [Runloop-snap]

**P:** Product page gives <2 s startup for a 10 GB image and ~100 ms command execution; the latter is warm command latency, not VM start/reset. November 12, 2024 suspend introduction says resume in seconds without a measured distribution. Unique MiB/VM and box density NR. [Runloop-home] [Runloop-launch]

**F:** CPU $0.108/hour and memory $0.0252/GB-hour, disk $0.00034236/GB-hour, snapshot storage $0.000072/GB-hour; Pro $250/month. Suspended compute stops billing, storage continues. Closed service with SDKs. **Adoption:** product describes agent/evaluation customers but named runtime use was not verified here. **I:** full-memory pristine reset would be more specific than its current disk-state branching, while its repo tooling/SSH/evals solve substantial higher-level work. [Runloop-price]

### 10. microsandbox

**F:** Current upstream has progressed beyond the old “<200 ms, server daemon” descriptions: embeddable/daemonless SDKs, OCI images, live `fork`, full snapshots and optional shared CoW memory on restore. It uses libkrun and a real guest Linux kernel. Linux/KVM, macOS Apple Silicon/HVF and Windows/WHP are listed; beta status remains explicit. [MSB] [MSB-sdk]

**P / method:** README now claims **average guest boot below 100 ms on an M1**. This does not include OCI pull or prove SDK-create-to-first-command timing. No published pristine Node reset distribution or physical per-instance slope was verified. [MSB]

**F:** Apache-2.0; self-hosted infrastructure costs, not a verified managed tariff. **Adoption:** ecosystem integrations and demos exist; no independently verified named production adopter found in this pass. **I:** direct local/embedded competitor and likely a simpler way to obtain broad Linux behavior today. Sofort must show the gain survives Node's working set, not merely compare tiny QuickJS with an untuned whole-Linux boot. [MSB] [Krun]

### 11. Firecracker

**F / P-spec:** KVM hardware isolation, minimal device model, real Linux, Apache-2.0. Pinned v1.16.1 specification measures ≤125 ms **InstanceStart to init**, tuned kernel/rootfs, specified M5D/M6G metal hosts; ≤5 MiB is **VMM-thread overhead for a 1-vCPU/128-MiB fixture**, excluding some features. This is not total physical RAM/VM. Startup of the VMM/API socket itself is separate. Historical AWS slides say 5 ms restore to snapshot point; they are not a current Node p99 guarantee. [FC-spec] [FC-2019]

**F:** Snapshot restore uses a private file mapping, on-demand page loading and CoW. Disk snapshot lifecycle is the integrator's responsibility; network/vsock reconnection and uniqueness require handling. Restore performance varies with memory/vCPUs/devices; current docs do not promise one universal number. [FC-snapshot]

**Adoption:** AWS Lambda is documented; E2B, Fly and Vercel independently describe using it in their own product sources. **L:** existing Sofort ledger measured 1.432 MiB/VM on a 10 MiB-configured tiny Linux restore fixture, not Node, on nested KVM. **I:** Stage 3 must compare shared restored Node snapshots and include host/KVM charge; defeating cold boot alone is insufficient. [FC-home] [Local-ledger]

### 12. Cloud Hypervisor

**F:** Rust VMM, KVM/MSHV, x86-64/aarch64, ordinary Linux/Windows guests, broader device and migration capabilities than a function-only VMM. Homepage says <100 ms direct-kernel boot to userspace, but does not give a matched application's distribution. Apache-2.0 plus BSD components. [CH-home] [CH-license]

**F:** Snapshot docs now expose eager-copy, `ondemand` UFFD, and `copyonwrite` memory restore; the latter shares the snapshot backing file and has feature restrictions. Thus “only Sofort resets/shares changed pages” is not credible. No comparable pristine Node reset, unique MiB/instance or per-host capacity number verified. [CH-snapshot]

**Adoption:** Kata integration is explicit; Northflank identifies Cloud Hypervisor as its microVM choice. Sponsor membership is not evidence of each sponsor's production deployment. No usage tariff for the OSS VMM: infrastructure and operations cost apply. **I:** Sofort may save devices/guest kernel state for restricted programs; CH wins compatibility, device flexibility and mature migration needs. [CH-home] [NF]

### 13. Kata Containers

**F:** OCI/CRI-compatible sandbox runtime, typically a VM per pod/sandbox containing a real Linux kernel and an agent. Multiple containers within the same sandbox share that kernel; “one container = one independent VM” is not universally true. QEMU, Cloud Hypervisor and Firecracker are supported choices, with different tradeoffs. Apache-2.0. [Kata]

**F / missing numbers:** Host shim, VMM and I/O helpers consume resources beyond the workload. The project documents that overhead and cgroup accounting; there is no defensible universal “Kata = X MiB, Y ms” across hypervisors, filesystems and Kubernetes setups. No matched Node reset/fork percentile verified. A VM template mechanism should also not be equated with a proven cross-tenant reset contract. [Kata-overhead]

**Adoption:** Baidu is named by the project; Northflank supports Kata microVMs including BYOC in its September 2026 update. Self-hosted, with distributor/service prices separate. **I:** good compatibility/control baseline for a real platform; less directly optimized for single-job dirty reset. Stage 3's engine comparison should exclude Kubernetes scheduler cost if Sofort also omits it. [Kata] [NF-changelog]

### 14. gVisor

**F:** A memory-safe Go Sentry reimplements the Linux ABI in userspace. It is neither ordinary runc isolation nor a full Linux guest kernel; systrap and KVM are platform choices. It supports Node/Python/Java regressions and many ordinary binaries, with explicit gaps such as incomplete/disabled-by-default io_uring and custom devices/filesystems. Apache-2.0. [gV-intro] [gV-compat] [gV-repo]

**F:** Sentry checkpoint/restore preserves execution state; current background restore runs application code after kernel state loads and fetches pages asynchronously. Low time-to-first-instruction does not imply the working set is warm. No contemporary, transferable matched Node reset or memory constant was established. Modal's Python figures are service-specific. [gV-cr] [Modal-mem]

**Adoption:** Google Cloud Run, DigitalOcean App Platform and Modal are documented examples, not evidence all modes of each product use the same platform. An older independent HotCloud 2019 case study analyzes startup, memory and syscall overhead; it cannot substitute for a current version measurement. **I:** this is a strong alternative kernel-compatibility strategy. Sofort's hardware boundary and tiny guest are useful only if they deliver measured economics without greater semantic gaps. [gV-compat] [gV-users] [gV-study]

### 15. Unikraft / kraft.cloud / Unikraft Cloud

**F:** Separate **open-source Unikraft LibOS** (BSD-3-Clause, Linux API compatibility) from **commercial cloud implementation**. The current cloud site describes Dockerfile conversion into specialized Linux-based images with a trimmed Linux kernel, a large Firecracker fork, templates/checkpoints and live forks. Treat old “must recompile every app” descriptions of the product cautiously. [UK-oss] [UK-cloud] [UK-million]

**P / method:** Current headline <10 ms start/resume/checkpoint, ~10 ms live fork. May 18's million-VM demonstration used a 48-core/384 GB server with two ~1.9 TB NVMe drives, a Bun workload and compressed differential snapshots; it reached roughly 1.4 million **standby/scaled-to-zero** environments before storage exhaustion. This is storage-backed density, not resident Node density. [UK-cloud] [UK-million]

**F / R:** The 2021 LibOS paper/artifact reports ~1 ms guest boot, ~3–40 ms total including VMM for tested apps; those are different artifacts from today's cloud. Plans now $0 Hobby, $39 Team, $199 Pro, custom Enterprise; no verified per-resource marginal cloud rate on inspected pricing page. **Adoption:** cloud site names Prisma, Netlify, Tinyfish and FlutterFlow; density/latency quotes remain vendor-published. **I:** the most direct commercial challenge to claiming both high density and fast full environments. [UK-paper] [UK-artifact] [UK-price] [UK-cloud]

### 16. Nanos / NanoVMs

**F:** Nanos is a kernel for **one process**, with threads, Linux-binary support and no general shell/user/SSH administration model. OPS packages/deploys applications into VM images; it does not make the guest a general multiprocess Linux development computer. Node packages are demonstrated, so “unmodified Node on a non-Linux kernel” is not new. [Nanos] [Nanos-node]

**P:** Vendor prose reports tens-of-milliseconds boot depending on application. Node/Go request-throughput benchmarks exist, but throughput is not boot/reset latency. No public pristine reset/fork distribution or complete per-Node host-memory measurement verified. [Nanos-boot] [Nanos]

**F:** Kernel source is public; component licensing should be checked per deployment. OPS C2 management is $7/user-month, not a per-sandbox compute rate; underlying cloud hardware and enterprise support cost extra. **Adoption:** PayWax CTO testimonial on NanoVMs site reports PCI DSS use; it is vendor-published. **I:** single-process execution is close to Sofort's design goal and removes some multiprocess cost, while agent shells/npm lifecycle/subprocess needs remain a compatibility differentiator. [Nanos-C2] [NanoVMs-home]

### 17. Hyperlight: base, Wasm, JS, Nanvix and Unikraft

**F / P:** Hyperlight embeds device-free hardware-protected guests. Original 2024 spawn claim was 1–2 ms. The February 11, 2025 **0.0009 s average** demo used a pre-warmed pool, `hey -n 1000 -c 5`, local HTTP hello-world with guest-host stdout and recycling; it was not a cold Linux VM or reset-only measurement. [HL-intro] [HL-demo]

**F / P:** `hyperlight-wasm` adds Wasmtime and WASI/component compatibility, not arbitrary Linux binaries; March 26, 2025 article gives ~1–2 ms creation. JS/QuickJS guests compete directly with current Sofort code mode. Azure Front Door Edge Actions was described as an intended service consumer; that article is not proof of general hosted Hyperlight availability/pricing. Apache project family; no standalone per-instance tariff verified. [HL-wasm] [HL-js]

**F:** January 28, 2026 Nanvix integration added 150+ POSIX calls, claimed double-digit-ms application cold starts and hundreds of instances/GiB; the article deferred reproducible benchmark details. Its integration repository now says **no longer actively maintained** and points to Wasm, JS and Unikraft. POSIX/source support is not automatically Linux ELF ABI compatibility. [HL-nanvix] [HL-nanvix-repo]

**F:** The maintained **Hyperlight–Unikraft** branch explicitly lists Node.js and warmed snapshots, KVM/MSHV/WHP/HVF, a default-deny boundary and guest/host calls. Node is tier 2 (integration-tested snapshot/capability support, no full upstream conformance suite). Host callbacks are synchronous; builder bindings are attached after restore. No matched current Node pristine reset/density figures were verified. **I:** compare this before investing deeply in a replacement kernel. Async tool waits and rigorous reset evidence may distinguish Sofort, but the feature combination itself does not. [HLUK] [HLUK-tiers] [HLUK-calls]

### 18. libkrun / krunvm

**F:** libkrun is an embeddable Rust/C API VMM for Linux KVM and Apple Silicon HVF, with a minimal device set and a bundled guest Linux through libkrunfw. It does not reimplement Linux syscalls. krunvm combines it with buildah to execute OCI userland; host resource sharing must be explicitly constrained. Main is a developing 2.0 API, so pin a stable branch for a comparator. [Krun] [Krunvm]

**F / unknowns:** Library/CLI Apache-2.0; Linux/firmware and dependencies retain their own licenses. No current universally applicable numeric cold-start, restore, pristine reset, unique footprint or density verified from upstream. Do not substitute microsandbox's M1 boot number for raw libkrun across hosts. **Adoption:** microsandbox explicitly uses it; krunvm itself is an integration, not proof of a hyperscale hosted customer. No hosted usage tariff. [Krun-license] [Krunvm] [MSB]

**I:** This is an engineering shortcut to full Linux on Sofort's two host platforms. The competition is whether a custom guest can beat a tuned Linux snapshot enough to justify long-term ABI maintenance, not whether Rust can call hardware virtualization.

### 19. AWS Lambda SnapStart

**F:** Captures initialized function memory/disk, restores new execution environments, then ordinary Lambda invocation reuse applies. It does **not** promise a pristine reset between every invocation, arbitrary interactive branching, or a dedicated new VM for each tool call. Published-version and uniqueness/network constraints matter. [SnapStart]

**F / temporal correction:** Current docs support managed Java ≥11, Python ≥3.12 and .NET ≥8 and corresponding container formats; other managed runtimes such as Node are excluded, **but custom/Node container images have a documented hook path**. Do not repeat the old categorical “no container images” limitation or misstate this as Node managed-runtime support. [SnapStart] [SnapStart-custom]

**P / pricing:** The November 28, 2022 Spring Boot Java demo reduced a >6 s initialization to <200 ms total cold invoke (restore plus handler); no sample count or percentile and no matched Node reset. Normal Lambda requests/duration remain; Java managed runtimes have no extra SnapStart charge, others have cache/restore charges. AWS's example uses $0.0000015046/GB-s cache (minimum 3 h) and $0.0001397998/GB restore. Allocation range is not physical density. Closed service; launch example is AWS-measured, not independent customer benchmarking. **I:** serious cold-start economics baseline, different session/reset semantics. [SnapStart-2022] [AWS-price] [Lambda-limits]

### 20. AWS Lambda MicroVMs — June 2026 entrant

**F:** June 22 launch adds explicit sandbox lifecycle, Dockerfile-based preinitialized images, HTTPS/WebSocket/gRPC access, retained memory/disk/processes and idle suspension. ARM64, up to 16 vCPU/32 GB RAM/32 GB disk in launch material; default baseline 1 vCPU/2 GB with automatic 4× burst. Eight-hour maximum lifespan includes running and suspended time in the developer guide. [AWS-micro-launch] [AWS-micro-compute] [AWS-micro-run]

**P / missing data:** “Near-instant” is not a numerical p50/p99. Snapshot-based initialization is verified; a dirty-page reset operation or arbitrary live fork API was not verified. No physical per-instance memory/density. Default API quotas (5 run/resume TPS, adjustable) are not engine throughput limits. [AWS-micro-compute] [AWS-micro-quotas]

**F / economics/adoption:** Baseline while running + measured excess resources + snapshot reads/writes/storage and data transfer; no compute while suspended. Detailed dollar compute tables did not render sufficiently to verify here; do not substitute Lambda function GB-s rates. Product page names Siemens, ClickHouse/chDB and Caylent; Snorkel's quotation is prospective. Service proprietary; Firecracker OSS. **I:** strong distribution/IAM/network incumbent; avoid assuming agent-native managed microVMs are a vacant market. [AWS-price] [AWS-micro-product]

### 21. Deno Sandbox — February 2026 entrant

**F:** Launched February 3 alongside Deno Deploy GA. These are real Firecracker Linux machines with arbitrary binaries, outbound policy and host-side credential substitution, not merely Deno isolates. The SDK can run from Node or Deno. [Deno-launch] [Deno-product]

**P:** Launch said <1 s, current landing <200 ms; neither supplies hardware/sample/percentiles. Disk volumes and read-only snapshots are documented, not verified arbitrary live-memory forks. Docs give 768–4096 MB, default 1280 MB, 2 vCPU. No unique physical density. [Deno-launch] [Deno-product] [Deno-create]

**F / pricing conflict:** Launch quoted $0.05 CPU-hour/$0.016 GB-hour; current landing shows $0.10/$0.025 while plan pricing varies. This report uses the current landing and flags the conflict instead of presenting February's rates as current. Backend closed, public SDKs separate. Named production customer use NR. **I:** Deno already combines full Linux and secret brokering; Sofort needs a measured local/embedded or unit-cost advantage. [Deno-launch] [Deno-product] [Deno-price]

### 22. Fly Sprites — persistent agent computers

**F:** Dedicated hardware-isolated Linux VMs; persistent ext4, warm/cold idle states, HTTP wake and credential connectors. Current docs say files/memory may persist between runs, while **checkpoint/restore specifically rewinds the filesystem, not process memory**. Do not call every checkpoint a live process fork. [Sprites] [Sprites-docs]

**P / F:** About one second for filesystem checkpoint; no verified wake p50/p99 or unique MiB/VM. 100 GB disk is a capacity ceiling, not an idle RAM footprint. Actual CPU/memory billing: $0.0385/CPU-hour and $0.021875/GB-hour plus storage; no compute while idle. Closed service, open client tooling. Named independent production adopter not verified. **I:** “a full Linux computer for every agent” is literally its positioning. Disposable repeatable turns could be a different workload, not a replacement for persistent workspaces. [Sprites] [Fly-price]

### 23. Freestyle — live VM forks

**F:** Full Linux VMs, long-lived interpreters, `snapshot()` and live `fork({count:N})`. Engineering docs explicitly describe a CoW split preserving running state, with independent subsequent writes. **P:** a research-agent guide says idle VMs resume in <100 ms, but no sample/hardware/percentile; “virtually free” fork cost is marketing, not zero unique RAM/CPU. [Freestyle-guide] [Freestyle-branch]

**F:** $0.04032/vCPU-hour, $0.0129/GiB-hour, disk $0.000086/GiB-hour, egress $0.02/GB beyond allowance. Free/Hobby $50/Pro $500 plans have allowances, with paid plan fee covering usage dollar-for-dollar; it is not necessarily base fee plus all compute again. Limits reach 32 vCPU/64 GiB on Pro; no physical density. Backend not established as OSS; public CLI/app projects are separate. Named production adopter NR. **I:** live fork is an existing product operation, so Sofort must compete on a measured reset contract or much lower per-branch resources. [Freestyle-price]

### 24. Prime Sandboxes — RL cost/scale competitor

**F:** September 23, 2026 GA: actual Linux microVMs, Docker Compose/background jobs, OCI images, verifiers/prime-rl integration. Launch reports ~30 million sandboxes already created and tens-of-thousands concurrent capacity, vendor counts rather than independent audit. **At GA, memory snapshots/fork and persistent workspaces were roadmap items**; not verified shipped by cutoff in this pass. [Prime-launch]

**F:** Promotional prices valid through December 22: $0.02/vCPU-hour + $0.0125/GiB-hour + $0.0002/GiB-hour disk, no subscription/minimum spend. The launch's 1 vCPU/1 GiB/5 GiB disk example is $0.0335/hour; current product calculator's 32 GiB disk yields $0.0389/hour. The difference is disk allocation, not necessarily a price increase. Numerical startup/reset percentiles and physical footprint NR. [Prime-launch] [Prime]

**Adoption:** Prime's own researchers and unnamed select customers; verifiers integration is concrete, not named external deployment proof. Hosted backend not established as OSS merely because RL tooling is open. **I:** a low-cost alternative for the likely eval/RL wedge; count tool compatibility and completed-rollout cost, including failures and CPU limits.

### 25. Tensorlake

**F:** Current pricing identifies Firecracker microVMs and snapshot/resume. Free shape 1 vCPU/1 GB/10 GB disk, one concurrent sandbox; usage credits to 100, Pro to 1,000 concurrent sandboxes. These are account/plan limits, not box density. Startup/reset/fork method and physical footprint NR. [Tensorlake-price]

**F:** Q3 2026 tariff: prepaid $0.01/CU; credit rates $0.07/core-hour, $0.015/GB-hour, disk $0.0002/GB-hour. Pro $250/month includes equal usage credit at $0.042/core-hour, $0.009/GB-hour and $0.0001/disk-GB-hour; suspended snapshot storage $0.07/GB-month. Active CPU metering falls back to allocated CPU if unavailable. Source status of the full backend and named production sandbox users were not verified. **I:** serious pricing and API alternative; a five-million-per-project ceiling in marketing is not five million resident VMs on one machine. [Tensorlake-price]

### 26. Northflank

**F:** Product offers microVM/Cloud Hypervisor or gVisor, OCI images and secrets/networking. September 24, 2026 changelog adds self-service BYOC sandbox security: Kata microVMs, gVisor or no sandboxing, and agent Harnesses. Always name the selected mode; a Northflank deployment is not automatically a VM. [NF] [NF-changelog]

**Unknown:** Exact matched start/resume/reset/fork distribution, unique host MiB/VM and per-node Node capacity not verified. Per-second resource billing and cloud/BYOC are explicit; a current matched all-in rate was not verified here. Hosted orchestration is proprietary, upstream runtimes open. Customer-style examples and supported agent names do not establish a specific agent company's production adoption. **I:** full deployment/network/storage operations and BYOC distribution are occupied; Sofort's kernel is a possible component below such a platform rather than a complete substitute. [NF] [NF-changelog]

### 27. AGX / Loophole Labs Substrate

**P:** Besides the restore/fork figures in the table, the page compares 2 GiB cold boot: Substrate 189 ms, Firecracker 210 ms, Cloud Hypervisor 260 ms. It names a commit, but host, samples, percentiles and raw results were not verified. [AGX]

**F / unknown:** Still labeled early access/waitlist at cutoff; price, license scope, physical footprint and production adopters NR. **I:** the advertised ~10× comparison concerns restore; the listed cold boots differ only ~1.1×. [AGX]

### 28. Microsoft NVX / OpenVMM

**F:** Another 2026-relevant direction beyond Hyperlight: an ultra-light microVM using **real Linux** on OpenVMM, with Alpine/Ubuntu/Azure Linux userlands and KVM/MSHV/WHP host options. Repository includes pinned versions, patches, guest tools and benchmark machinery. MIT for NVX code; Linux/OpenVMM components retain their licenses. [NVX] [NVX-license]

**F / unknown:** Usage documentation lists shell/restore profiling and 128 MiB Alpine /256 MiB Ubuntu defaults in the inspected version. These are allocations, not proof of physical overhead. No accepted p50/p99 Node reset, unique MiB/VM, public hosted tariff or production customer found in this pass. Benchmarks being present is not a verified result. **I:** Microsoft is pursuing small full-Linux VMs too; the competitive alternative to growing an ABI may be shrinking/tuning Linux and its VMM. [NVX-usage] [NVX-bench]

### 29. Edera

**F:** Xen-derived type-1 isolation with dedicated Linux-kernel zones and OCI/Kubernetes integration; Rust control-plane components and isolated device handling. Do not turn marketing shorthand into a claim that every byte of Xen is Rust. Commercial platform with separately released OSS projects such as Styrolite/OpenPaX; no public matched sandbox unit tariff verified. [Edera]

**P:** March 2026 vendor EKS/runc comparison discusses CPU, memory-throughput and startup tradeoffs. It is **competitor-authored**, not an independent benchmark of Kata/gVisor, and memory throughput is not footprint. No clean Node reset/fork percentile or per-zone physical slope found. Named production adoption not independently checked. **I:** security/control/GPU positioning is already strong elsewhere; small pristine-turn economics would be the more relevant Sofort axis. [Edera-bench]

### 30. CodeSandbox / Together AI and BuildBuddy

**F / P:** CodeSandbox's current page says create, clone and restore VMs within two seconds and names Blackbox AI and Superblocks as SDK users via testimonials. Together ownership is explicit. The full service backend is not established as OSS. A direct pricing fetch returned **403**, so this report does not treat a Vercel comparison's historical CodeSandbox rates as verified current prices. Physical density and matched Node reset NR. [CS] [CS-price]

**F / P:** BuildBuddy is a serious adjacent competitor for build/test agents: Firecracker/Linux remote runners keep warm Bazel servers, share chunked memory/disk snapshots via UFFD/FUSE and restore on different hosts. January 26, 2026 engineering article describes 20 GB RAM/80 GB disk workloads as motivating examples; they are not per-instance overhead measurements. Remote-runner docs describe startup in hundreds of milliseconds, not a matched clean Node reset. [BuildBuddy-blog] [BuildBuddy-docs]

**Source/pricing/adoption limits:** BuildBuddy has public code with differing open/commercial components; the full production snapshot deployment license and current comparable runner tariff were not verified. Product-specific named adoption was not researched to proof. **I:** “warm builds cloned from a snapshot” is occupied; Sofort's Stage 1 jq/SQLite and Stage 2 Node work should target small repeated jobs before claiming a full build-farm substitute.

### 31. Additional entrants and substitutes worth tracking

These are covered to avoid a false closed market map. Where the row says NR, this pass did not establish a comparable timing, density, price or named production adopter. They should not be promoted to fully benchmarked competitors on the strength of a README.

| Project/product | Verified approach / compatibility | Published numbers, pricing, source and adoption limits |
|---|---|---|
| **BoxLite** | Embeddable daemonless, OCI-native hardware-isolated Linux microVMs; libkrun ecosystem; local-to-cloud, async fleet control | Apache-2.0 repo; numerical current lifecycle/physical MiB/VM/host density NR; self-host hardware cost; named production adopter NR. Direct competitor to “local VM SDK.” [BoxLite] |
| **Gondolin** | TypeScript-controlled Linux microVM, QEMU default and experimental krun; host-side filesystem/network policy and credential substitution | Apache-2.0 experimental project; disk checkpoint/resume; ~200 MB+ guest assets are **download bytes**, not resident footprint. Numerical reset/density, hosted price and production adoption NR. [Gondolin] |
| **Matchlock** | Ephemeral Linux microVMs on Linux KVM and Apple Silicon; network allowlisting and host proxy secret injection | Project P: full environment boots <1 s, no timer method; experimental; no reset/fork distribution or physical density verified. Public repo; exact license not verified in this pass; self-host cost, production adopter NR. [Matchlock] |
| **smolvm** | Local OCI/Linux VMs using libkrun artifacts, KVM/HVF/WHP; portable `.smolmachine` packaging | P: sub-second cold start; no accepted reset/fork percentile or physical MiB. Public source, exact license not checked; no hosted rate/adopter verified. Portable state packaging does not prove CPU-architecture-independent live-memory migration. [smolvm] |
| **Kubernetes SIG Apps Agent Sandbox (Google-backed)** | Kubernetes API/controller for isolated agent workloads; configurable runtimes and warm allocation, not a new Linux kernel | Open repo; speed/density depend on runtime and pool; no matched Node result verified. Self-host/cloud resource cost, production adopter NR. [Google-AS] |
| **Alibaba OpenSandbox** | Open orchestration/API; Docker/Kubernetes, configurable runc/gVisor/Kata/Firecracker paths | Strong isolation is **configuration dependent**. February 2026 Fast Sandbox proposal removes K8s scheduling from hot create path but explicitly requires end-to-end benchmarks for cross-backend claims. No universal reset/footprint/rate. Public source; production adopter not verified. [OpenSandbox] [OpenSandbox-fast] |
| **AWS AgentCore Runtime / Code Interpreter** | Dedicated microVM/session, isolated CPU/memory/files; container/function/tool product above VMs | Code Interpreter up to 8 h; no numerical pristine reset/fork/physical density verified. Closed managed service; usage-based price requires selected tool/runtime tariff, not Lambda substitution. Customer use of the exact sandbox mode NR here. [AgentCore] [AgentCore-security] |
| **Alibaba AgentBay** | Managed code/browser/computer environments; precise VMM implementation/boundary not verified in this pass | June 25 tariff: Basic free + usage, Pro $149/mo, Ultra $225/mo; CPU $0.027/core-h, RAM $0.0113/GB-h. No verified reset/fork/unique MiB; service closed, SDK openness separate; named deployment NR. [AgentBay-price] |
| **exe.dev** | Managed persistent Linux VMs and shared-capacity VM pools for agent workspaces | Personal $15–155/mo capacity tiers; Work $75/mo, additional 2-vCPU/4-GiB unit $0.105/h; per-second standalone usage. Underlying VMM/reset/fork percentiles/physical density NR; closed service, named production customer NR. [exe-price] |
| **OSv** | Linux-compatible single-application library OS with Node/JVM ecosystem; different multiprocess contract | Public source; P: ~5 ms boot on Firecracker and as low as 11 MB configured memory; no method/current Node reset slope. README itself says up-to-date comparative metrics are unavailable. Hosted pricing/adoption NR. Prior art against “first Linux-compatible single-app kernel.” [OSv] |

**R / earlier technical prior art:** SEUSS (EuroSys 2020) combines Rumprun/Node snapshots, page sharing and anticipated warm paths. Its NOP JS experiment averaged 475 invocations: 7.5 ms cold, 3.5 ms warm, 0.8 ms hot; corresponding reported footprints 2.05/1.53/0.05 MB **incremental to a ~114.5 MB Node base**. The hot case reuses a context and is not equivalent to pristine reset. Its custom host OS is not today's KVM deployment contract. REAP/vHive (2021) measured Firecracker/containerd snapshots and improved cold-start delays ~3.7× with working-set prefetch. These are author-measured research, not current hosted services, but show why snapshot reuse/dirty-page sharing are established ideas. [SEUSS] [REAP]

## Numbers to beat

### The Stage 3 go/no-go calculation

**I:** Publish the ratio, its denominator and the resource/isolation contract. With the **same Node version, V8 mode, architecture, application, dependencies, input and success criteria**, define:

- `reset speedup = Firecracker clean-turn latency / Sofort clean-turn latency`.
- `memory gain = Firecracker incremental all-in MiB per resident VM / Sofort incremental all-in MiB per resident VM`.
- `capacity gain = Sofort useful VMs per box / Firecracker useful VMs per box`, at the same useful-job throughput/latency/error requirement.

Go only if **at least one is ≥10×**, as the proposed roadmap requires. For a latency-led decision, require the reported p50 **and p99** improvement to survive representative dirty-state jobs; do not pass by a tiny median while hiding a worse tail. A memory/capacity-led pass may have a different latency tradeoff, which must be explicit. A configured RAM reduction alone is not a memory gain. A paused record backed by disk is not a resident VM.

### Competitive thresholds and what they actually mean

| Comparator / evidence | Number to challenge | Fair Stage 3 interpretation |
|---|---|---|
| **Firecracker tuned restore** [FC-snapshot] [FC-2019] | Historical ~5 ms to snapshot point; actual same-Node metal distribution **must be measured** | If a matched baseline is 5 ms, ≥10× requires ≤0.5 ms at the equivalent percentile. Arithmetic illustration, not a promised baseline or measured Sofort result. Include cleanup, restore and first useful response on both sides. |
| **Hyperlight–Unikraft** [HLUK] [HLUK-tiers] | Ordinary Node + warmed snapshots already works; numerical clean-reset slope NR | Must compare maintained compatible implementation, not old “Hyperlight only runs custom functions” folklore. If adequate, replacing it must offer tangible savings. |
| **Unikraft Cloud** [UK-cloud] | P: ~10 ms live fork / <10 ms restore | A sub-ms local reset is a technically interesting factor, but reset and fork are different operations. To claim ≥10× fork advantage, measure independent child creation on both. |
| **AGX/Substrate** [AGX] | P: 5.4 ms warm /12.7 ms cold restore; 7 ms fork | Relevant emerging targets for first-response latency; no percentiles verified. Do not derive a p99 win from these point figures. |
| **Blaxel** [Blaxel-docs] | P: ~25 ms standby resume | ≤2.5 ms is a 10× arithmetic service target under matched end-to-end conditions. A 40 µs local copy does not establish it over an SDK/network path. |
| **Daytona/E2B/microsandbox/Deno** [Daytona-docs] [E2B-HF] [MSB] [Deno-product] | P: <90 ms /150–170 ms /<100 ms M1 guest boot /<200 ms | Different timer boundaries. Useful product-usability targets, **not** the primary kernel reset denominator. |
| **Vercel disk snapshots** [Vercel-perf] | P: p75 <1 s, p95 ~5 s in April | File restore with cache/network effects; not equivalent to warmed Node RAM reset. Include first command, especially after October create semantics change. |
| **Local restored Firecracker fixture** [Local-ledger] | L: **1.432 MiB/VM** marginal memcg charge, nested arm64 KVM, N=1/16/64/256 | Strong counterexample to assumed huge Linux overhead. This is tiny libc-free init, not Node. A literal 10× gain would be ~0.143 MiB, below the experiment's ~0.217 MiB shared bare-KVM floor: it exposes a mistaken workload comparison, not an achievable Node target. |
| **Local shared Hyperlight fixture** [Local-ledger] | L: **0.371 MiB/VM +17.450 MiB fixed** | QuickJS-NG, independent KVM VMs in one process; excludes/amortizes specified controller/cache costs. Tough small-runtime density baseline, not Node or process-per-tenant isolation equivalence. |
| **Unikraft million standby experiment** [UK-million] | P: ~1.4 million scaled-to-zero VMs on 48 cores/384 GB/2×NVMe | If Sofort chooses **standby storage density** as its axis, beat like-for-like saved states and resume SLO. Resident memory density is a separate result. |
| **Daytona useful fleet** [Daytona-density] | P: 2,000 environments ready in 27.4 s; peak 13.3 completed agent jobs/s on Vera | Better benchmark shape than empty idle count. Different hardware/workload; cannot transfer as a fixed VMs/box threshold. |
| **Price floor for likely RL users** [Prime-launch] | $0.0335/hour at 1 vCPU/1 GiB/5 GiB disk, promotional | Kernel savings must become lower all-in cost per correct rollout or better latency. This is not required to show ≥10× lower list price; platform and compatibility costs differ. |

**I:** The existing QuickJS headline cannot pass Stage 3. The October 31 HVF report's 34–40 µs reset is after small jobs on M4 Pro, with hot writable granules retained and periodic reprotection. It separately reports real-task reset medians of 83/137/155/208 µs by arena class, and warns large first-write sets can pay ~6 µs/fault. Node has threads, heaps, JIT code and more mutable OS state. Extrapolating its reset from QuickJS is ungrounded. Linux figures there are nested and explicitly not production timing claims. [Local-memory]

### Minimal fair experiment, proposed only — not run here

1. **Freeze the semantics.** Same unmodified ARM64 Node binary and npm workload, first `--jitless`, then default JIT. Include a tiny eval, jq/SQLite processing, async host-tool waits, npm module loads, a dirty-heap case, worker threads, cancellation and failure. Record outputs and unsupported features, not just successful cases.
2. **Use bare-metal Linux.** Same host, kernel settings, CPU governor/pinning, vCPU count, filesystem/cache conditions, network policy, effective memory limit and process trust domain. Warm snapshots and CoW sharing on both. Include current Firecracker stable with jailer/confinement and no unnecessary devices. Record versions and hashes.
3. **Measure two reset paths.** (a) pristine retained-slot reset and proof of next-run readiness; (b) fresh independent child from an initialized snapshot and proof of readiness. If Firecracker must recreate a VMM, include that cost and explain it; separately measure an optimized reusable-VMM design if available. Never compare pausing/resuming dirty tenant state with pristine restoration.
4. **Make the timer complete.** Count cancellation/quiescence, child/thread cleanup, scratch filesystem rollback, ring/device queues, register/MMU state restoration, randomness/identity/time repair and first useful Node result. Keep pure engine reset and SDK/tool roundtrip as separate panels. [FC-snapshot] [Local-hosted]
5. **Account all memory.** Fit total host charge versus N, report fixed + marginal, count memcg kernel/page tables/KVM/slab, unique private guest pages and proportional shared-image cost. Include host Node/controller, security helpers, parked waits and recovery reserves. Show resident-idle, waiting-on-tools, after representative jobs, sustained churn and peak/adversarial allocations. Do not sum RSS to count shared snapshots repeatedly. [Local-ledger]
6. **Find useful capacity.** Increase N until a declared p99/error/goodput target fails. Distinguish runnable VMs, parked KVM objects, stored snapshots, account quota and fleet concurrency. CPU saturation may bind before memory, especially for real Node jobs. Count successes per host-dollar, not just VM handles.
7. **Publish distributions and failures.** Cold vs warm cache, p50/p95/p99, enough samples to observe tails, offered load, dirty-byte counts, retries/timeouts, maximum and run duration. Include same-tenant warm Linux as an economic alternative but disclose its weaker clean-turn semantics. This is a proposed gate, not work performed in this research assignment.

## Which claims are marketing versus independent measurement?

| Evidence class | Examples in this report | Confidence / limit |
|---|---|---|
| Primary implementation/docs | Firecracker mapping model, gVisor ABI/restore, Kata topology, Hyperlight–Unikraft tier contract, Cloudflare disk-only snapshots | Strong for **what is documented**, not independent security certification or universal performance. |
| Provider benchmark with meaningful boundaries | Vercel April p75/p95, Daytona October fleet-ready test, Modal July fleet-scale demo, Unikraft May standby-scale account | More useful than a slogan; still provider-run, workload-specific, not a Sofort-style Node reset reproduction. |
| Provider/project headline | <90 ms Daytona, <25 ms Blaxel, <250 ms Morph, 10 ms Unikraft forks, 7 ms AGX, <200 ms Deno | Numeric claim verified as published; missing enough detail to treat as matched empirical truth. |
| Independent academic analysis | HotCloud 2019 gVisor case study; vHive/REAP's Firecracker-based stack analysis | Independent of selling the compared cloud service, but old versions and different workloads; not a current Node leaderboard. [gV-study] [REAP] |
| Author-measured academic system | SEUSS, Unikraft EuroSys paper/artifact | Reproducible research evidence, not independent reproduction of their own result and not automatically the current commercial implementation. [SEUSS] [UK-paper] [UK-artifact] |
| User anecdote | Fly 100–250 ms forum observation | Useful warning about variance; not controlled evidence. [Fly-variation] |
| Existing Sofort lab measurements | M4 HVF reset; nested-KVM memory ledger | Best local evidence available, with explicit workload/backend/accounting limits; not independent third-party validation. [Local-memory] [Local-ledger] |

**No current independent, same-host, same-Node, p50/p99 pristine-reset + unique-MiB comparison across this market was verified.** This is a research gap, not a claim none exists anywhere. Do not convert “uses Firecracker” into a security audit, copy a rival vendor's benchmark table as neutral evidence, or call marketing claims false merely because their methodology is incomplete.

## Positions already taken / open gaps

### Positions already taken

| Position | Existing claim or implementation | Implication for Sofort |
|---|---|---|
| Full Linux computer for an agent | E2B, Daytona, Sprites, Deno, AWS MicroVMs, Modal VM | Needs a specific economic or lifecycle advantage, not the category name. |
| Fork a running VM in milliseconds | Unikraft, Morph, Freestyle, AGX; microsandbox live fork | Not novel positioning. A materially better measured reset/fork contract could still matter. |
| Keep initialized runtime memory and skip startup | Firecracker snapshots, SnapStart, Hyperlight, Modal; older SEUSS | Snapshotting a warmed Node runtime is prior art. |
| Pay little/no compute while idle | Blaxel standby, Fly, Sprites, AWS MicroVMs, Unikraft; active-CPU tariffs elsewhere | A low idle engine footprint must compete with disk-backed suspension and wake SLOs. |
| High-density VM states | Unikraft standby million; Hyperlight shared snapshots; Firecracker CoW | Specify resident vs stored and total host memory. |
| Secret keys stay outside generated code | Deno, Vercel, Cloudflare, Blaxel, Sprites, Gondolin, Matchlock | Good product requirement, not exclusive kernel advantage. |
| Local embeddable hardware sandbox | Hyperlight, microsandbox, BoxLite, libkrun | “Runs on my Mac as a library” is occupied too. |
| Linux ABI in a smaller kernel | gVisor, Unikraft, Nanos, OSv, Hyperlight–Unikraft | Agent-assisted growth may change engineering cost; compatibility alone is not unique. |
| Warm build/test environment clones | CodeSandbox, BuildBuddy, Runloop, Freestyle | Need a smaller-job or measured density wedge before broad coding-workspace claims. |

Sources are the corresponding competitor sections above. These are overlap observations, not claims the products have identical guarantees.

### Open gaps that could support a defensible position — inference

1. **Proven pristine reset for real Node with JIT at sub-ms latency.** A benchmarkable clean-state guarantee after malicious/failed jobs, at meaningful p99 and concurrency, could be stronger than vendor “resume instantly” language. It must reset scratch disk, threads, callbacks and kernel state, not just JS globals. This pass found no verified matched commercial figure that closes that exact gap.
2. **Low unique memory while a hardware VM remains immediately runnable.** Vendors often publish provisioned GB or disk-backed standby counts. A kernel-inclusive slope with a useful initialized Node runtime and bounded tool waits would be unusually clear evidence. The 1.432 MiB tiny-Linux counterexample and Hyperlight fixed/shared costs make this a hard experimental question, not an assumed win.
3. **Short jobs with expensive initialization and explicit host effects.** Repeated independent jq/SQLite/Node computations, verification/eval steps and speculative local branches may amortize prepared snapshots well. Long repository builds, browser memory or remote tool RTT can dominate the microsecond reset term; target workflows where that term affects throughput/cost.
4. **An honest portable resource contract.** Same qualified guest image/semantics across macOS development and Linux deployment, reproducible artifacts and public accounting could improve trust. Existing cross-platform competitors mean reproducibility and exact contract are the distinction, not platform support alone.
5. **A reusable kernel component below existing sandbox platforms.** If the ≥10× gate passes, offering the execution substrate/SDK to operators may be more credible than immediately replacing managed networking, persistence, billing, regions and customer integrations.
6. **Lower compatibility-engineering cost, separately evidenced.** Agent-written syscall handlers checked against Linux could help extend useful workloads, but established kernels also evolve. Measure developer/reviewer time and held-out semantic regressions; a higher corpus score does not establish operating-cost superiority or demand.

**Decision:** proceed to the matched Stage 3 gate only after Stage 2 runs the real Node/JIT workload and reset contract. If the ≥10× result disappears against tuned shared Firecracker snapshots, or depends on dropping capabilities the target workflow needs, retain Sofort for bounded jobs/growth research rather than market it as a uniquely fast full computer.

## Sources with URLs

All external sources below accessed **2026-10-31**. Dates attached are publication dates from the source where visible; otherwise the source is live/undated. GitHub `main`/`dev` links are mutable and describe the inspected documentation, not an immutable release certification. The pinned Firecracker specification and local reports have narrower artifact scope. Some older pages contain stale/default examples; conflicts are called out above.

### Local context and prior evidence

- [Local-readme] — jitk README, current checkout.
- [Local-architecture] — runtime architecture, current checkout; some summary-table wording trails newer implementation reports.
- [Local-fit] — GrowOS fit synthesis, 2026-10-29.
- [Local-memory] — guest memory/HVF dirty reset, 2026-10-31; exact workloads/method and limitations.
- [Local-hosted] — hosted comparison design, explicitly not executed.
- [Local-ledger] — nested Linux/KVM memory comparator ledger, 2026-10-25; earlier libkrun-era jitk, not today's full shard or Node gate.
- [Local-gaps] — earlier product-gap synthesis; pointers only, not independent verification of every linked service.

### Managed sandbox sources

- [E2B-home] — current product/open-runtime claims.
- [E2B-price] — current tariff and configuration.
- [E2B-HF] — Hugging Face Open R1 case, 2025-03-31.
- [Daytona-docs] — current introduction and <90 ms claim.
- [Daytona-arch] — **v2 alpha** architecture, Firecracker/prebuilt snapshots.
- [Daytona-price] — current rates/per-second statement.
- [Daytona-billing] — stable billing, container vs VM lifecycle.
- [Daytona-v2-billing] — alpha billing, reservations/minute units.
- [Daytona-source] — production code closure, 2026-06-11.
- [Daytona-density] — Vera/EPYC fleet experiment, 2026-10-07.
- [Vercel-product] — current Sandbox capabilities/customer testimony.
- [Vercel-perf] — snapshot pipeline performance, 2026-04-02.
- [Vercel-create] — create/readiness timing change, 2026-10-08.
- [Vercel-persistence] — memory minimum and filesystem persistence, October 2026.
- [Vercel-price] — current Sandbox usage rates.
- [Modal-runtime] — current gVisor/VM choice and GPU limitations.
- [Modal-vm-launch] — VM Sandbox alpha introduction, 2026-06-15.
- [Modal-vm-snapshot] — VM memory snapshots, alpha/selected customer contract.
- [Modal-mem] — older gVisor memory snapshot measurements (2025), not VM Node benchmark.
- [Modal-million] — fleet-scale control plane experiment, 2026-07-16.
- [Modal-resources] — requests/bursting/accounting.
- [Modal-price] — current sandbox physical-core and GiB rates.
- [Modal-users] — customer/use-case page; attribution limitations above.
- [Fly-resume] — suspend/resume launch, 2024-07-02, updated 2024-07-24.
- [Fly-variation] — user observation/provider explanation, 2024-07-26.
- [Fly-interrupt] — interruptible suspend, 2025-12-11.
- [Fly-price] — current Machines/Sprites landing tariff.
- [CF-overview] — current Sandboxes overview, last updated 2026-09-30.
- [CF-changelog] — Containers/Sandbox feature history, including GA 2026-04-13.
- [CF-snapshot] — filesystem snapshot contract, last updated 2026-09-30.
- [CF-price] — tariff, last updated 2026-10-05.
- [CF-limits] — allocation/account limits, last updated 2026-10-29.
- [CF-sdk] — SDK source repository.
- [Blaxel-docs] — lifecycle, memory, network limitations and preview labels.
- [Blaxel-price] — current GB-second/storage tariff.
- [Blaxel-engine] — Firecracker/networking changes, 2025 year-end account.
- [Blaxel-code] — code/app-builder lifecycle claims; inconsistent idle wording noted.
- [Blaxel-users] — SpawnLabs named customer case (2026).
- [Morph] — Infinibranch full-state branching documentation.
- [Morph-price] — current MCU definition and plans.
- [Morph-terms] — ownership/benchmark terms, last revised 2025-10-23.
- [Runloop-home] — boundary, image start and command latency claims.
- [Runloop-snap] — current disk-only snapshot contract.
- [Runloop-launch] — suspend/snapshot introduction, 2024-11-12.
- [Runloop-price] — current usage/plan tariff.
- [AWS-micro-launch] — launch, 2026-06-22.
- [AWS-micro-compute] — architecture/baseline/burst pricing model, 2026-07-10.
- [AWS-micro-run] — lifecycle and maximum duration.
- [AWS-micro-quotas] — current limits; account quotas distinct from density.
- [AWS-micro-product] — capabilities and attributed customer quotes.
- [SnapStart] — current managed-runtime/format limits and restore semantics.
- [SnapStart-custom] — custom/Node container hook path.
- [SnapStart-2022] — original Java restore example, 2022-11-28.
- [AWS-price] — current Lambda/SnapStart/MicroVM tariff and worked examples.
- [Lambda-limits] — function/MicroVM limits, not physical footprint.
- [Deno-launch] — Sandbox launch and then-current rates, 2026-02-03.
- [Deno-product] — current landing page, faster headline/current rate display.
- [Deno-create] — current SDK allocations and creation.
- [Deno-price] — plan-dependent current billing.
- [Sprites] — current product/checkpoint scope.
- [Sprites-docs] — warm/cold/persistence model.
- [Freestyle-guide] — code interpreter/live fork patterns, 2026.
- [Freestyle-branch] — CoW branching/resume claims, 2026.
- [Freestyle-price] — current plans/allowances/usage.
- [Prime-launch] — GA/roadmap/promotion, 2026-09-23.
- [Prime] — current product/tariff example.
- [Tensorlake-price] — Q3 2026 plans, resource rates and metering caveats.
- [NF] — current sandbox product.
- [NF-changelog] — BYOC/Harnesses update, 2026-09-24.
- [AGX] — early-access product/performance claims; not independently reproduced.
- [CS] — current product and SDK customer testimony.
- [CS-price] — direct access **403** in this research; no verified current rate extracted.
- [BuildBuddy-blog] — snapshot/chunk/clone design, 2026-01-26.
- [BuildBuddy-docs] — remote-runner lifecycle.

### Runtime, kernel, newcomer and research sources

- [MSB] — current upstream README with boot-time footnote and CoW/full snapshots.
- [MSB-sdk] — guest-kernel and platform contract.
- [FC-home] — official Firecracker overview.
- [FC-spec] — pinned v1.16.1 specification/method.
- [FC-snapshot] — current snapshot design and caveats.
- [FC-2019] — AWS re:Invent 2019 slide deck, historical 5 ms restore.
- [CH-home] — Cloud Hypervisor project, October 2026 releases/current capabilities.
- [CH-license] — license/platform policy.
- [CH-snapshot] — copy/UFFD/CoW restore documentation.
- [Kata] — runtime, hypervisors, license and Baidu adoption.
- [Kata-overhead] — accounting of sandbox host overhead.
- [gV-intro] — Sentry isolation/ABI mechanism.
- [gV-compat] — Node regression support and Linux gaps.
- [gV-cr] — checkpoint/restore/background loading.
- [gV-repo] — open-source repository/license.
- [gV-users] — deployments.
- [gV-study] — independent gVisor case study, HotCloud 2019.
- [UK-oss] — OSS LibOS documentation/license.
- [UK-cloud] — current cloud claims and customer testimony.
- [UK-how] — current image/runtime description.
- [UK-million] — standby density demonstration, 2026-05-18.
- [UK-price] — current cloud subscription plans.
- [UK-paper] — EuroSys 2021 paper.
- [UK-artifact] — paper's public artifact.
- [Nanos] — kernel README/limitations/benchmark links.
- [NanoVMs-home] — Node deployment/customer testimony.
- [Nanos-node] — Node deployment example, historical (2019–2020).
- [Nanos-boot] — application-dependent boot wording, undated vendor article.
- [Nanos-C2] — management price, not compute price.
- [HL-intro] — original Hyperlight timing claims, 2024-11-07.
- [HL-demo] — warm hello-world HTTP benchmark, 2025-02-11.
- [HL-wasm] — Wasm design/timing, 2025-03-26.
- [HL-js] — QuickJS custom guest example, 2025-03-10.
- [HL-nanvix] — POSIX integration/early performance, 2026-01-28.
- [HL-nanvix-repo] — maintenance status.
- [HLUK] — Linux runtimes, host platforms, warmed snapshots.
- [HLUK-tiers] — guarantees, Node tier 2.
- [HLUK-calls] — callback execution, snapshot binding and limits.
- [Krun] — library design/platforms and branch status.
- [Krun-license] — Apache license for library.
- [Krunvm] — OCI CLI, platforms, Apache license.
- [NVX] — OpenVMM/Linux design/source.
- [NVX-usage] — defaults/profiling CLI, mutable dev branch.
- [NVX-bench] — benchmark machinery, not a verified numerical result.
- [NVX-license] — MIT for NVX.
- [Edera] — zone architecture and separately OSS components.
- [Edera-bench] — vendor EKS comparison, March 2026.
- [BoxLite] — embedded OCI microVM source/license.
- [Gondolin] — local TypeScript/Linux sandbox.
- [Matchlock] — local ephemeral Linux microVM/proxy.
- [smolvm] — local portable OCI/Linux VM package.
- [Google-AS] — Kubernetes agent sandbox orchestration.
- [OpenSandbox] — secure-runtime choices.
- [OpenSandbox-fast] — fast runtime proposal, creation date 2026-02-08.
- [AgentCore] — per-session microVM Code Interpreter contract.
- [AgentCore-security] — dedicated runtime session boundary.
- [AgentBay-price] — plans/resource tariff, updated 2026-06-25.
- [exe-price] — persistent VM pool/subscription billing.
- [OSv] — library OS source and compatibility approach.
- [SEUSS] — author-hosted EuroSys 2020 paper; method and base/incremental footprints.
- [REAP] — snapshot analysis/prefetch, 2021 paper.

[Local-readme]: ../../jitk/README.md
[Local-architecture]: ../../jitk/docs/ARCHITECTURE.md
[Local-fit]: ../growos-fit/SUMMARY.md
[Local-memory]: ../../jitk/bench/v1/results/2026-10-31-memory.md
[Local-hosted]: ../../jitk/bench/v1/adapters/HOSTED.md
[Local-ledger]: ../perf/linux-ledger/RESULTS.md
[Local-gaps]: ../product/03-value-gaps.md
[E2B-home]: https://e2b.dev/
[E2B-price]: https://e2b.dev/pricing
[E2B-HF]: https://e2b.dev/customers/how-hugging-face-is-using-e2b-to-replicate-deepseek-r1
[Daytona-docs]: https://www.daytona.io/docs/
[Daytona-arch]: https://www.daytona.io/docs/en/v2/architecture/
[Daytona-price]: https://www.daytona.io/pricing
[Daytona-billing]: https://www.daytona.io/docs/billing
[Daytona-v2-billing]: https://www.daytona.io/docs/en/v2/billing/
[Daytona-source]: https://www.daytona.io/dotfiles/updates/daytona-is-going-closed-source
[Daytona-density]: https://www.daytona.io/dotfiles/when-2000-agents-share-one-cpu
[Vercel-product]: https://vercel.com/sandbox
[Vercel-perf]: https://vercel.com/blog/optimizing-vercel-sandbox-snapshots
[Vercel-create]: https://vercel.com/changelog/sandbox-create-waits-until-ready
[Vercel-persistence]: https://vercel.com/i/code-interpreter
[Vercel-price]: https://vercel.com/pricing
[Modal-runtime]: https://modal.com/docs/guide/sandboxes
[Modal-vm-launch]: https://modal.com/blog/product-updates-vm-sandboxes-domain
[Modal-vm-snapshot]: https://modal.com/docs/guide/vm-memory-snapshots
[Modal-mem]: https://modal.com/blog/mem-snapshots
[Modal-million]: https://modal.com/blog/scaling-to-1-million-concurrent-sandboxes-in-seconds
[Modal-resources]: https://modal.com/docs/guide/sandbox-resources
[Modal-price]: https://modal.com/pricing
[Modal-users]: https://modal.com/customers
[Fly-resume]: https://community.fly.io/t/new-feature-in-preview-suspend-resume-for-machines/20672
[Fly-variation]: https://community.fly.io/t/autosuspend-is-here-machine-suspension-is-enabled-everywhere/20942/9
[Fly-interrupt]: https://community.fly.io/t/machines-can-now-start-from-the-suspending-state/26623
[Fly-price]: https://fly.io/pricing/
[CF-overview]: https://developers.cloudflare.com/sandbox/
[CF-changelog]: https://developers.cloudflare.com/changelog/product/containers/
[CF-snapshot]: https://developers.cloudflare.com/containers/guides/snapshots/
[CF-price]: https://developers.cloudflare.com/containers/platform/pricing/
[CF-limits]: https://developers.cloudflare.com/containers/platform/limits/
[CF-sdk]: https://github.com/cloudflare/sandbox-sdk
[Blaxel-docs]: https://docs.blaxel.ai/Sandboxes/Overview
[Blaxel-price]: https://blaxel.ai/pricing
[Blaxel-engine]: https://blaxel.ai/blog/2025-blaxel-our-year-end-round-up
[Blaxel-code]: https://blaxel.ai/solutions/code-and-app-builders
[Blaxel-users]: https://blaxel.ai/blog/spawn-labs-enables-real-time-previews-for-coding-agents-using-blaxel
[Morph]: https://cloud.morph.so/docs/developers
[Morph-price]: https://cloud.morph.so/web/subscribe
[Morph-terms]: https://cloud.morph.so/web/legal/terms-of-service
[Runloop-home]: https://runloop.ai/
[Runloop-snap]: https://docs.runloop.ai/docs/devboxes/snapshots
[Runloop-launch]: https://runloop.ai/blog/product-update-introducing-suspend-resume-and-snapshots
[Runloop-price]: https://runloop.ai/pricing
[AWS-micro-launch]: https://aws.amazon.com/about-aws/whats-new/2026/06/aws-lambda-microvms/
[AWS-micro-compute]: https://aws.amazon.com/blogs/compute/announcing-lambda-microvms-serverless-compute-environments-with-vm-level-isolation-and-near-instant-startup/
[AWS-micro-run]: https://docs.aws.amazon.com/lambda/latest/dg/microvms-launching.html
[AWS-micro-quotas]: https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
[AWS-micro-product]: https://aws.amazon.com/lambda/lambda-microvms/
[SnapStart]: https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html
[SnapStart-custom]: https://docs.aws.amazon.com/lambda/latest/dg/snapstart-runtime-hooks-custom.html
[SnapStart-2022]: https://aws.amazon.com/blogs/aws/new-accelerate-your-lambda-functions-with-lambda-snapstart/
[AWS-price]: https://aws.amazon.com/lambda/pricing/
[Lambda-limits]: https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
[Deno-launch]: https://deno.com/blog/introducing-deno-sandbox
[Deno-product]: https://deno.com/deploy/sandbox
[Deno-create]: https://docs.deno.com/sandbox/create/
[Deno-price]: https://deno.com/deploy/pricing
[Sprites]: https://fly.io/sprites/
[Sprites-docs]: https://docs.fly.io/sprites
[Freestyle-guide]: https://www.freestyle.sh/blog/engineering/how-to-build-a-code-interpreter-on-freestyle
[Freestyle-branch]: https://www.freestyle.sh/blog/engineering/how-to-build-deep-research-agents-on-freestyle
[Freestyle-price]: https://www.freestyle.sh/pricing
[Prime-launch]: https://www.primeintellect.ai/blog/sandboxes
[Prime]: https://www.primeintellect.ai/sandboxes
[Tensorlake-price]: https://www.tensorlake.ai/pricing
[NF]: https://northflank.com/product/sandboxes
[NF-changelog]: https://northflank.com/changelog/august-and-september-2026
[AGX]: https://www.agx.so/
[CS]: https://codesandbox.io/
[CS-price]: https://codesandbox.io/pricing
[BuildBuddy-blog]: https://www.buildbuddy.io/blog/fast-runners-at-scale/
[BuildBuddy-docs]: https://www.buildbuddy.io/docs/remote-runner-introduction/
[MSB]: https://github.com/superradcompany/microsandbox
[MSB-sdk]: https://github.com/superradcompany/microsandbox/blob/main/sdk/go/README.md
[FC-home]: https://firecracker-microvm.github.io/
[FC-spec]: https://github.com/firecracker-microvm/firecracker/blob/v1.16.1/SPECIFICATION.md
[FC-snapshot]: https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md
[FC-2019]: https://d1.awsstatic.com/events/reinvent/2019/Firecracker_open-source_innovation_OPN402.pdf
[CH-home]: https://www.cloudhypervisor.org/
[CH-license]: https://github.com/cloud-hypervisor/cloud-hypervisor/blob/main/CONTRIBUTING.md
[CH-snapshot]: https://github.com/cloud-hypervisor/cloud-hypervisor/blob/main/docs/snapshot_restore.md
[Kata]: https://katacontainers.io/
[Kata-overhead]: https://github.com/kata-containers/kata-containers/blob/main/docs/design/host-cgroups.md
[gV-intro]: https://gvisor.dev/docs/architecture_guide/intro/
[gV-compat]: https://gvisor.dev/docs/user_guide/compatibility/
[gV-cr]: https://gvisor.dev/docs/user_guide/checkpoint_restore/
[gV-repo]: https://github.com/google/gvisor
[gV-users]: https://gvisor.dev/users/
[gV-study]: https://www.usenix.org/conference/hotcloud19/presentation/young
[UK-oss]: https://unikraft.org/docs/getting-started
[UK-cloud]: https://unikraft.com/
[UK-how]: https://unikraft.com/how-it-works
[UK-million]: https://unikraft.com/blog/1m-vms-single-box
[UK-price]: https://unikraft.com/pricing
[UK-paper]: https://arxiv.org/abs/2104.12721
[UK-artifact]: https://github.com/unikraft/eurosys21-artifacts
[Nanos]: https://github.com/nanovms/nanos
[NanoVMs-home]: https://nanovms.com/
[Nanos-node]: https://blog.nanovms.com/dev/tutorials/deploying-nanos-node-js-unikernels-to-aws
[Nanos-boot]: https://blog.nanovms.com/blog/creating-unikernel-clouds-within-clouds-nanovms-inception
[Nanos-C2]: https://nanovms.com/nanos-c2
[HL-intro]: https://opensource.microsoft.com/blog/2024/11/07/introducing-hyperlight-virtual-machine-based-security-for-functions-at-scale/
[HL-demo]: https://opensource.microsoft.com/blog/2025/02/11/hyperlight-creating-a-0-0009-second-micro-vm-execution-time/
[HL-wasm]: https://opensource.microsoft.com/blog/2025/03/26/hyperlight-wasm-fast-secure-and-os-free/
[HL-js]: https://opensource.microsoft.com/blog/2025/03/10/build-a-hyperlight-c-guest-to-securely-execute-javascript/
[HL-nanvix]: https://opensource.microsoft.com/blog/2026/01/28/hyperlight-nanvix-posix-support-for-hyperlight-micro-vms/
[HL-nanvix-repo]: https://github.com/hyperlight-dev/hyperlight-nanvix
[HLUK]: https://github.com/hyperlight-dev/hyperlight-unikraft
[HLUK-tiers]: https://github.com/hyperlight-dev/hyperlight-unikraft/blob/main/docs/guest-support-tiers.md
[HLUK-calls]: https://github.com/hyperlight-dev/hyperlight-unikraft/blob/main/docs/calls.md
[Krun]: https://github.com/libkrun/libkrun
[Krun-license]: https://raw.githubusercontent.com/containers/libkrun/main/LICENSE
[Krunvm]: https://github.com/libkrun/krunvm
[NVX]: https://github.com/microsoft/nvx
[NVX-usage]: https://github.com/microsoft/nvx/blob/dev/doc/usage.md
[NVX-bench]: https://github.com/microsoft/nvx/blob/dev/doc/benchmarks.md
[NVX-license]: https://github.com/microsoft/nvx/blob/dev/LICENSE
[Edera]: https://docs.edera.dev/overview/
[Edera-bench]: https://edera.dev/stories/faster-than-runc-benchmarking-edera-on-amazon-eks
[BoxLite]: https://github.com/boxlite-ai/boxlite
[Gondolin]: https://github.com/earendil-works/gondolin
[Matchlock]: https://github.com/jingkaihe/matchlock
[smolvm]: https://github.com/smol-machines/smolvm
[Google-AS]: https://github.com/kubernetes-sigs/agent-sandbox
[OpenSandbox]: https://github.com/opensandbox-group/OpenSandbox/blob/main/docs/guides/secure-container.md
[OpenSandbox-fast]: https://github.com/opensandbox-group/OpenSandbox/blob/main/oseps/0007-fast-sandbox-runtime-support.md
[AgentCore]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-session-characteristics.html
[AgentCore-security]: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-security-best-practices.html
[AgentBay-price]: https://www.alibabacloud.com/help/en/agentbay/product-overview/agentbay-billing-instructions
[exe-price]: https://hub.exe.dev/docs/billing/overview
[OSv]: https://github.com/cloudius-systems/osv
[SEUSS]: https://cs-web.bu.edu/~jappavoo/Resources/Papers/seuss.pdf
[REAP]: https://arxiv.org/abs/2101.09355
