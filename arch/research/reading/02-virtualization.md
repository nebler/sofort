# Virtualization & microVMs: the reading/watch list for Sofort

Researched and links verified **2026-10-25** against the reading brief, `demo.md` §§0–1 (including the newer measurements), and the Cloudflare/Goose synthesis. **30 items; eight P1s.** P1 = must; P2 = should; P3 = specialist follow-up. Blog reading times marked `~` are estimates, including code/diagrams; video lengths come from YouTube metadata.

Read with Sofort's actual questions in mind: what KVM/HVF supplies versus what the VMM implements; how much private memory a restored run dirties; why a resumed vCPU can still incur hundreds of first-touch faults; and what must change after cloning. The local ~0.5 MiB small-run results are marginal physical-memory measurements, not configured guest RAM, and the nested latency results still need bare-metal validation.

All listed URLs were fetched and their content/identity checked. Every YouTube entry also passed the required YouTube oEmbed title/channel check; channels are recorded below. One explicitly marked paper-PDF fallback is retained for SEUSS because the verified primary article is only an abstract and no suitable author recording was verified. The Catalyzer entry is its authors' short project article, not a paper link. Historical talks explain mechanisms, not current hardware support matrices.

## 1. The mechanism: KVM, HVF, and ARM

- [P1] **Using the KVM API** — Josh Triplett (LWN contributor), Blog, 2015, ~25 min — <https://lwn.net/Articles/658511/>
  Why for Sofort: The essential small example: `/dev/kvm`, VM/vCPU file descriptors, memory slots, `mmap(kvm_run)`, register setup, `KVM_RUN`, and I/O/HLT handling; establishes that neither Linux nor a full device model is required inside a VM. Concepts: KVM API, vCPU run loop, userspace exits, memory slots, minimal VMM.

- [P1] **A minimal VMM in Rust with Apple Hypervisor** — Himanshu / GigaPotential (independent; UpVPN creator), Blog, 2026, ~20 min — <https://gigapotential.dev/blog/minimal-vmm-in-rust-with-apple-hypervisor/>
  Why for Sofort: The closest backend-level companion to Triplett: Rust FFI, the hypervisor entitlement, host-memory mapping, ARM registers and `hv_vcpu_run`; compare the implementation responsibilities with KVM rather than assuming identical APIs. Concepts: Hypervisor.framework, HVF, Apple Silicon, ARM64, VM lifecycle, exit handling.

- [P2] **Introducing Kernel Data Protection, a new platform security technology for preventing data corruption** — Microsoft Security Team (Microsoft), Blog, 2020, 13 min; focus on “The second-level address translation” — <https://www.microsoft.com/en-us/security/blog/2020/07/08/introducing-kernel-data-protection-a-new-platform-security-technology-for-preventing-data-corruption/>
  Why for Sofort: Its worked address-translation diagrams explain guest virtual → guest physical → host physical, EPT/NPT ownership, and permissions; transfer that model to ARM stage-2 rather than confusing guest page tables with host isolation. Concepts: EPT, NPT, SLAT, stage-1/stage-2 translation, TLB, memory protection.

- [P2] **[2017] To EL2, and Beyond! by Christoffer Dall** — Christoffer Dall (Linaro; KVM/ARM co-maintainer), YouTube, 2017, 34:18 — <https://www.youtube.com/watch?v=j0bp4fnO98w>
  Why for Sofort: Explains EL1/EL2 state multiplexing, why the original split-mode ARM KVM paid extra transitions, and how VHE lets the host kernel run at EL2; makes ARM virtualization costs concrete. Concepts: EL0/EL1/EL2, VHE, nVHE, trap cost, host/guest transitions. Verified channel: KVM Forum.

- [P2] **[2017] Nested Virtualization on ARM by Christoffer Dall** — Christoffer Dall (Linaro), YouTube, 2017, 40:03 — <https://www.youtube.com/watch?v=cuXyGkZRUKU>
  Why for Sofort: Builds the L0/L1/L2 model and exposes the MMU, timer and interrupt-controller work behind nested virtualization; use it to explain why HVF → Linux/KVM → jitk timing cannot be extrapolated to metal with a fixed multiplier. Concepts: nested virtualization, ARMv8.3, nested stage-2, GIC, timers, exit amplification. Verified channel: KVM Forum.

## 2. Production VMMs and reusable Rust components

- [P1] **NSDI '20 – Firecracker: Lightweight Virtualization for Serverless Applications** — Alexandru Agache and the Firecracker authors (AWS), YouTube, 2020, 20:00 — <https://www.youtube.com/watch?v=cwruf1ERAKM>
  Why for Sofort: The canonical explanation of specializing a VMM for Lambda/Fargate: minimal devices, Rust, isolation, resource control and production rollout; the architecture is a stronger reference than treating the historical 125 ms boot figure as a present-day restore lower bound. Concepts: Firecracker, KVM, jailer, multitenancy, density, Lambda, Fargate. Verified channel: USENIX.

- [P2] **Announcing the Firecracker Open Source Technology: Secure and Fast microVM for Serverless Computing** — Arun Gupta and Linda Lian (AWS), Blog, 2018, ~10 min — <https://aws.amazon.com/blogs/opensource/firecracker-open-source-secure-fast-microvm-serverless/>
  Why for Sofort: Read the deployment sections: Lambda sandboxes and Fargate tasks use the VM boundary to combine untrusted tenants on bare-metal hosts; the article distinguishes container packaging from the isolation beneath it. Concepts: serverless isolation at scale, Lambda placement, Fargate task isolation, oversubscription, minimal device model.

- [P2] **Rust device backends for every hypervisor** — Erik Schilling (Linaro), Blog, 2023, 8 min — <https://www.linaro.org/blog/rust-device-backends-for-every-hypervisor/>
  Why for Sofort: Explains what rust-vmm actually shares across Firecracker, Cloud Hypervisor and crosvm, especially guest-memory and virtqueue handling; useful for deciding which dangerous parser/memory components jitk's VMM should reuse. Concepts: rust-vmm, vm-memory, virtio-queue, vhost-user, backend isolation, shared-memory I/O.

- [P2] **Cloud Hypervisor v53.0 Released!** — Cloud Hypervisor Team (Linux Foundation project), Blog, 2026, 6 min — <https://www.cloudhypervisor.org/blog/cloud-hypervisor-v53.0-released/>
  Why for Sofort: A concrete engineering checklist for “move a computer”: offloaded restore, UFFD postcopy, background prefaulting, clock repair, network announcements and ARM register fixes; shows how much state exists beyond RAM and a program counter. Concepts: Cloud Hypervisor, snapshots, live migration, userfaultfd, prefault, virtual clocks, device quiescence.

- [P2] **Paravirtualized Devices in crosvm – a Performance Panacea for Modern VMs** — Daniel Prilik (Google ChromeOS engineering intern at the time), Blog, 2019, 18 min — <https://prilik.com/blog/post/crosvm-paravirt/>
  Why for Sofort: Follows an implemented RNG device from synchronous MMIO exits to batched virtio queues; a practical reference for justifying one shared tool channel and counting the notifications it actually causes. Concepts: crosvm, VM exits, MMIO, virtio, shared rings, batching, guest-controlled descriptors.

- [P2] **Running Linux microVMs on macOS (M1/M2)** — Sergio López (Red Hat; libkrun/krunvm maintainer), Blog, 2022, 5 min — <https://sinrega.org/running-microvms-on-m1/>
  Why for Sofort: The maintainer's walkthrough separates libkrun, its Linux guest and the krunvm OCI frontend, with virtio-fs and port sharing; grounds Sofort's original backend in the stack it is specializing away. Concepts: libkrun, krunvm, libkrunfw, OCI, HVF, virtio-fs, host/guest filesystem boundary.

- [P3] **AAA gaming on Asahi Linux** — Alyssa Rosenzweig (Asahi Linux), Blog, 2024, ~7 min — <https://asahilinux.org/2024/10/aaa-gaming-on-asahi-linux/>
  Why for Sofort: Read “The stack”: muvm solves the real 16 KiB-host/4 KiB-guest page-size mismatch while FEX supplies x86 emulation; distinguishes hardware virtualization, ISA emulation and page granularity in Sofort's Apple/Asahi portability story. Concepts: muvm, ARM64, 4K/16K pages, FEX, GPU sharing, compatibility.

## 3. The closest alternative: Hyperlight, Wasm and Unikraft

- [P2] **Hyperlight: Achieving 0.0009-second micro-VM execution time** — Danilo Chiarlone (Microsoft), Blog, 2025, 4 min — <https://opensource.microsoft.com/blog/2025/02/11/hyperlight-creating-a-0-0009-second-micro-vm-execution-time/>
  Why for Sofort: Dissects a real host → guest → host callback → guest cycle and explicitly reveals that the headline demo used pre-created warm VMs; essential discipline for comparing RUN latency, restore latency and complete request latency. Concepts: Hyperlight, KVM/Hyper-V, warm pools, host functions, shared buffers, benchmark boundaries.

- [P1] **Hyperlight Wasm: Fast, secure, and OS-free** — Yosh Wuyts and Lucy Menon (Microsoft), Blog, 2025, 10 min — <https://opensource.microsoft.com/blog/2025/03/26/hyperlight-wasm-fast-secure-and-os-free/>
  Why for Sofort: The direct architectural comparator: a CPU and memory, explicit host functions, and a `no_std` Wasmtime guest; carefully separates hardware isolation, WASI compatibility and software-sandbox defense in depth. Concepts: Hyperlight-Wasm, Wasmtime, micro-guests, WASI, Component Model, explicit effects boundary, compatibility cost.

- [P2] **GSoC'26: Add Hyperlight Platform in KraftKit** — Jaidev Singh (Unikraft GSoC contributor), Blog, 2026, ~8 min — <https://unikraft.org/blog/2026-06-19-unikraft-gsoc-hyperlight-platform>
  Why for Sofort: Shows Unikraft extending Hyperlight with application-facing OS services, filesystem/network host calls and lifecycle tooling; prevents assuming Hyperlight's original bare-function interface permanently excludes richer native workloads. Concepts: Hyperlight-Unikraft, unikernels, KraftKit, host functions, POSIX services, lifecycle, workload-specific benchmarks.

## 4. Containers with stronger boundaries: gVisor and Kata

- [P2] **Platform Portability** — Ian Lewis and Michael Pratt (Google/gVisor), Blog, 2020, ~8 min; includes a 2024 update — <https://gvisor.dev/blog/2020/10/22/platform-portability/>
  Why for Sofort: Explains an application kernel with interchangeable execution platforms, including KVM without a conventional hardware device model; a serious counterargument to requiring hardware virtualization everywhere. Concepts: gVisor, Sentry, Linux syscall ABI, KVM platform, software interception, portability, nested-virtualization cost.
  Historical caveat: ptrace is discussed because of the publication date; the article's update points to the later Systrap platform, so do not present ptrace as today's default.

- [P2] **Kata Containers — Northflank Case Study** — Cameron McDermott and Will Stewart, interviewed by Kata Containers (Northflank), Blog, 2022, ~7 min — <https://katacontainers.io/blog/kata-containers-northflank-case-study/>
  Why for Sofort: Production operators explain how OCI/containerd/RuntimeClass integrate VM isolation, why they used multiple VMMs, and the real costs of nested-cloud support, guest compatibility and patching. Concepts: Kata, Kubernetes, per-pod VM boundary, Cloud Hypervisor/QEMU/Firecracker, virtio-fs, operational security.

## 5. Snapshots, CoW, first-touch faults and fast restore

- [P1] **how to make firecracker fast(er) to start chromium in < 20ms** — Steven Miller (Kernel), Blog, 2026, ~10 min — <https://www.kernel.sh/blog/firecracker-faster>
  Why for Sofort: A production builder connects standby snapshots, CoW storage, UFFD paging and hot pools; read the ending carefully: the headline is the hot-pool path, while cold misses remain slower. Concepts: Firecracker snapshots, CoW forks, shared page cache, demand paging, burst restore, identity injection, warm/cold distinction.

- [P1] **ASPLOS'21 Benchmarking, Analysis, and Optimization of Serverless Function Snapshots** — Dmitrii Ustiugov and co-authors (Edinburgh, EPFL and Microsoft Research), YouTube, 2021, 18:02 — <https://www.youtube.com/watch?v=zfLd_MTGOA8>
  Why for Sofort: REAP directly explains the remaining first-touch bottleneck: record the invocation's working set, compact its pages and prefetch/install them; the obvious conceptual starting point for investigating jitk's many post-restore faults. Concepts: REAP, vHive, Firecracker, userfaultfd, working-set recording, page prefetch, cold cache. Verified channel: EASE Lab at University of Edinburgh.

- [P2] **Systems Gossip Operating Systems Meetup – FasSnap by Dr. Lixiang Ao** — Lixiang Ao (FaaSnap author; UC San Diego research, later Databricks), YouTube, 2022 talk / 2024 upload, 1:41:35 — <https://www.youtube.com/watch?v=fLcPzppwCSE>
  Why for Sofort: The author's extended FaaSnap presentation examines compact loading sets, per-region mappings and concurrent paging; complements REAP when changed inputs invalidate a previously observed working set. Concepts: FaaSnap, snapshot-based VMs, demand paging, prefetch overlap, memory regions, burst workloads. Verified channel: Systems Gossip Meetup. The uploader's title misspells FaaSnap as “FasSnap.”

- [P3] **Catalyzer: Sub-millisecond Startup for Serverless Computing with Initialization-less Booting** — Dong Du, Tianyi Yu, Yubin Xia and collaborators (SJTU IPADS and Ant Financial), Blog (authors' project article), 2020, ~4 min — <https://ipads.sjtu.edu.cn/pub/projects/catalyzer>
  Why for Sofort: Distills two reusable ideas: restore application and system state on demand, and fork a prepared sandbox via `sfork`; the sub-millisecond result is explicitly a best case, not a general Linux cold-boot guarantee. Concepts: Catalyzer, initialization-less booting, on-demand restore, sandbox fork, checkpoint reuse.

- [P3] **SEUSS: Skip Redundant Paths to Make Serverless Fast** — James Cadden, Thomas Unger, Yara Awad, Han Dong, Orran Krieger and Jonathan Appavoo (Boston University/Red Hat collaboration), Paper PDF (fallback), 2020, 15 pages / ~40 min — <https://www.cs.bu.edu/~jappavoo/Resources/Papers/seuss.pdf>
  Why for Sofort: Read §§4–6 for immutable snapshot stacks, page sharing, anticipatory initialization and tiny private descendants; also inspect its isolation model—Unikernel Contexts are not one KVM VM each in this prototype. Concepts: SEUSS, unikernel contexts, snapshot lineage, CoW memory sharing, pre-initialization, density, isolation assumptions.

- [P1] **Under the hood: how AWS Lambda SnapStart optimizes function startup latency** — Ayush Kulkarni and Eric Heinz (AWS), Blog, 2025, ~12 min — <https://aws.amazon.com/blogs/compute/under-the-hood-how-aws-lambda-snapstart-optimizes-function-startup-latency/>
  Why for Sofort: The most useful production description of durable snapshot storage: S3, distributed/local caches, 512 KB chunks and learned access-order prefetch; separates a small local restore primitive from a fleet-scale distribution system. Concepts: Lambda SnapStart internals, Firecracker, chunking, cache hierarchy, working sets, prefetch, snapshot regeneration.

- [P2] **#snapsafe: restoring uniqueness in Virtual Machine clones** — Babis Chalios (AWS), YouTube, 2022, 41:23 — <https://www.youtube.com/watch?v=sHkgQE1UR-U>
  Why for Sofort: Directly relevant to the observed repeated QuickJS `Math.random`: VMGenID can refresh kernel entropy without automatically fixing user-space PRNGs, UUIDs or other cloned state; a restore contract needs explicit application participation. Concepts: VMGenID, generation counters, PRNG reseeding, snapshot hooks, uniqueness, clone correctness. Verified channel: Linux Plumbers Conference.

## 6. Competing implementations of pause, fork and move

- [P2] **Build an Agent Workbench on OpenAI's Agents API** — Alexandria Yip (E2B), Blog, 2026, 1 min — <https://e2b.dev/resources/build-an-agent-workbench-on-openais-agents-api>
  Why for Sofort: A concise product-level example of E2B template-based Firecracker sessions with pause/fork into a new sandbox and agent session; use as the API/workflow comparator, not evidence for physical-memory density or detailed snapshot implementation. Concepts: E2B, prepared templates, Firecracker, pause/fork, session ownership, sandbox lifecycle.

- [P2] **Infrastructure for the Singularity — Jesse Han, Morph** — Jesse Han (Morph Labs founder), YouTube, 2025, 19:30 — <https://www.youtube.com/watch?v=2goSS66XRBk>
  Why for Sofort: Morph's builder demonstrates Infinibranch's full-environment snapshot/branch/replicate workflow; compare the branching semantics with Sofort's proposal, while treating performance and future GPU claims as vendor claims at the date of the talk. Concepts: Morph, Infinibranch, VM memory state, branching environments, test-time search, state reuse. Verified channel: AI Engineer.

- [P2] **Memory snapshots: Checkpoint/restore for sub-second startup** — Jonathon Belotti (Modal), Blog, 2025, 10 min — <https://modal.com/blog/mem-snapshots>
  Why for Sofort: A particularly candid account of gVisor checkpoint/restore, background page loading, CPU-feature compatibility, entropy and failed restores; shows that memory snapshots are also possible without Firecracker. Concepts: Modal, gVisor, CRIU comparison, process-tree state, prefetch, CPU compatibility, network reconnection.

## 7. Density and a defensible security argument

- [P2] **Red Hat OpenShift Virtualization memory management overview** — Fabian Deutsch (Red Hat), Blog, 2026, ~15 min — <https://developers.redhat.com/articles/2026/10/15/red-hat-openshift-virtualization-memory-management-overview>
  Why for Sofort: Separates scheduler reservations from physical usage and explains ballooning, free-page reporting, KSM/zero-page sharing and hugepage tradeoffs; use it to defend marginal-memory measurements and discuss what happens when shared pages become private. Concepts: memory density, overcommit, balloon, FPR, KSM, CoW, hugepages, reclaim, OOM.

- [P1] **An EPYC escape: Case-study of a KVM breakout** — Felix Wilhelm (Google Project Zero), Blog, 2021, ~25 min — <https://projectzero.google/2021/06/an-epyc-escape-case-study-of-kvm.html>
  Why for Sofort: A demonstrated escape through KVM itself, involving nested-virtualization logic; directly refutes treating a Rust VMM or tiny guest kernel as proof that the host is safe. Concepts: guest-to-host escape, KVM TCB, nested SVM, threat model, defense in depth, host kernel patching.

- [P2] **Dynamic Process Isolation: Research by Cloudflare and TU Graz** — Kenton Varda (Cloudflare; joint research with TU Graz), Blog, 2021, 8 min — <https://blog.cloudflare.com/spectre-research-with-tu-graz/>
  Why for Sofort: The strongest primary counterpoint to a simple VM > container > isolate ranking: language restrictions, timing defenses and dynamic process isolation address a different attack surface, while Spectre remains relevant across VM boundaries too. Concepts: isolates, V8, Spectre, side channels, dynamic isolation, process boundaries, security/performance tradeoffs.

## Questions these sources should let you defend

- **Execution:** A hardware VM exit need not return from `KVM_RUN` to userspace; KVM handles many events internally. Keep hardware exits, userspace exit reasons, tool calls and syscalls as separate counters. A vCPU is execution state scheduled on host threads, not a physical core reserved forever. Start with Triplett, Dall and the crosvm device walkthrough.
- **Translation and restore:** Guest stage-1 tables do not give the guest authority over host physical mappings. EPT/ARM stage-2, host page faults, CoW faults and storage misses are separate layers. Restoring metadata quickly does not make the working set resident; REAP, FaaSnap and SnapStart are the important sequence here.
- **Density:** Shared immutable snapshot pages, KSM's content-based merging, ballooning and free-page reporting are distinct mechanisms. Sharing a deliberately public base is different from scanning arbitrary tenant pages for identical secrets, and shared physical pages can still introduce timing channels. Count private dirty pages, host/kernel metadata, page tables and cached bases; show burst memory pressure as well as idle density.
- **Security:** Native containers expose the host kernel syscall boundary; gVisor interposes an application kernel; Kata wraps container workloads in a VM; isolates depend on runtime and language restrictions; microVMs expose virtualization and host-call/device paths. None of these labels alone proves isolation. For Sofort, a malicious application must be assumed able to compromise jitk and present hostile inputs to the VMM/tool broker. A one-channel design reduces interface surface only if the host validates lengths, addresses, capabilities and effects.
- **Portability and effects:** A RAM/register snapshot has architecture, CPU-feature, VMM/ABI and device-state constraints. It is not automatically a cross-ISA continuation like Sofort's Wasm tier. Cloning also duplicates entropy, identities and cached credentials. Restoring a VM cannot undo an external write that already happened; Capsule still needs its effects journal, ownership/fencing and idempotency protocol.

These are synthesis/inferences for Sofort, not guarantees claimed by every source. In particular, the older VMM posts describe their publication-era architecture, the FaaSnap meetup was held in 2022 but uploaded in 2024, and the Hyperlight/Unikraft material documents continuing compatibility work rather than a permanent “cannot run native programs” limitation.

## If you only have 3 hours

1. **00:00–00:35:** Read **Using the KVM API**, then skim the HVF walkthrough alongside it; be able to sketch VM creation and the vCPU run/exit loop.
2. **00:35–01:15:** Watch **To EL2, and Beyond!** (34:18), then study the SLAT diagrams in the Microsoft KDP post; distinguish guest paging from stage-2 isolation.
3. **01:15–01:50:** Watch **Firecracker** (20:00), read **Hyperlight Wasm** (10 min), then skim the warm-demo explanation in the 0.0009-second post.
4. **01:50–02:30:** Watch **REAP** (18:02), read **SnapStart under the hood**, then skim Kernel's snapshot/UFFD/hot-pool sections; identify which faults jitk should measure on metal.
5. **02:30–03:00:** Read the architecture and conclusion of **An EPYC escape**, read **Dynamic Process Isolation**, and timebox the remainder to **#snapsafe**; write down Sofort's host trust boundary, clone-reseed contract and external-effects limitation.
