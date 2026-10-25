# VMM and host-side design for many tiny VMs

2026-10-25. Research only; no jitk changes or new performance measurements. **[P]** published measurement, **[S]** inspected source/API, **[I]** inference or proposed budget, **[U]** unverified. Read the shared brief and all ten requested project documents. Source checkouts and paper copies are under `research/repos/`.

## Decision

**Build a small Linux/KVM spike, with separate KVM VMs, a bounded pool of owner threads, fixed memory slots, and explicit yield-to-host exits.** The architecture has strong precedent. Its value is fitting jitk's static Linux binaries, EL0 execution, async tool protocol, and single-use semantics into that architecture. The VMM mechanisms themselves are largely established by LightVM, Solo5, Virtines, Firecracker, and Hyperlight. ([LightVM]; [Solo5]; [Virtines]; [H-run])

The targets require narrower definitions. **2 MiB is a plausible experimental budget for an idle/lightweight instance's incremental physical memory, not a universal peak-memory guarantee.** A 1 MiB structured JSON operation already needs roughly 8 MiB of QuickJS heap in the project's native tests. Likewise, sub-millisecond restore is different from sub-millisecond CPU for an entire invocation. The current quiet numbers are 4.8 child CPU-ms/run, 0.285 ms parked one-tool latency, and 10.7 MiB process footprint; the CPU figure excludes supervisor/watchdog, and the memory figure excludes HVF kernel allocations. [Project measurements](../../jitk/bench/RESULTS-quiet-2026-10-24.md), [QuickJS evidence](../quickjs-verdict.md).

**macOS needs a different topology.** HVF exposes one VM per process and one vCPU per owning thread. Hyperlight accommodates many logical sandboxes by serially replacing the process-wide guest address space. This does not provide concurrent independent stage-2 isolation within one process. Use several persistent worker processes, with logical sandboxes multiplexed inside each, rather than promising Linux's many-VM topology on HVF. ([Apple VM]; [Apple CPU]; [H-HVF])

## 1. What the published systems establish

### LightVM: density is a control-plane problem too

Manco et al., **“My VM is Lighter (and Safer) than your Container,” SOSP 2017**, measured Xen 4.8 on a four-core Xeon E5-1630 v3, 3.7 GHz, 128 GB DDR4, and a 64-core machine comprising four Opteron 6376s, 2.3 GHz, 128 GB DDR3. Their daytime unikernel used a 480 KB image and 3.6 MB guest RAM. (P, [LightVM] §§3,6)

XenStore imposed message/acknowledgement crossings, linear name checks, and transaction retries. LightVM replaced it with hypervisor-provided device pages and event channels (`noxs`), added the lean `chaos` toolstack, pre-created VM shells, and replaced hotplug scripts with `xendevd`. At 1,000 guests, stock creation approached one second; the combined design achieved 4–4.1 ms for daytime, and 2.3 ms for device-free noop. The 64-core test reached 8,000 noop guests. Tiny Linux guests suffered background-task contention that idle unikernels avoided. (P, [LightVM] §§4–6, figs.9–11)

**jitk implication [I]:** retain the idea of single-use executions while reusing prepared *hardware shells*. Precompile confinement, parse images once, share immutable pages, and replenish clean shells asynchronously. Otherwise a faster kernel merely exposes launch, registration, bookkeeping, and cleanup costs. The existing native-watchdog change is consistent with this lesson: it removed per-invocation process startup from the runtime path. [Current implementation](../../FINAL.md)

Do not implement a new centralized “sandbox store” traversed on each call. Keep a direct instance table, per-worker runnable queues, and generation-tagged completions. LightVM's lesson applies to metadata coordination, not just to XenStore as a particular product. Nor does its noop density demonstrate 8,000 simultaneously useful QuickJS heaps. [I]

### Firecracker, Cloud Hypervisor, crosvm, libkrun

| System | Verified result/design | Relevance to jitk |
|---|---|---|
| Firecracker, NSDI'20 | Approximately **3 MB VMM overhead**, versus Cloud Hypervisor **13 MB**, QEMU **131 MB**, excluding binary sharing and configured guest RAM. Hardware: EC2 m5d.metal, two Xeon Platinum 8175M CPUs, 48 physical cores, 384 GB; Ubuntu 18.04.2/kernel 4.15. (P, [FC-paper] §5.2) | These are historical VMM overhead figures, not total instance footprints or current arm64 results. |
| Firecracker current specification | **≤5 MiB VMM-thread overhead**, **≤125 ms** InstanceStart-to-Linux-init, for the specified one-vCPU/128 MiB setup on m5d.metal/m6g.metal. API startup has a separate **8 CPU-ms** bound. [FC-spec] | Its Linux/device lifecycle is a different workload from a prepared jitk call. |
| Cloud Hypervisor | Current `Vmm` owns a `VmOwnership`; `CpuManager` spawns a thread per vCPU. (S, [CH-vmm]; [CH-cpu]) | Reusable Rust hypervisor/device abstractions, but no inspected many-tiny-VM scheduler or current tiny-instance benchmark. |
| crosvm | Spawns dedicated vCPU threads; device implementations normally use separate minijail sandboxes. (S, [Crosvm-cpu]; [Crosvm-intro]) | Strong reference for device containment. Its general-device architecture is unnecessary for jitk's single channel. No verified comparable per-VM memory number found. |
| libkrun | Linux and macOS backends spawn one thread per vCPU. jitk configures one vCPU, console, and 32/64 MiB RAM through its builder. (S, [Krun-linux]; [Krun-mac]; local [VMM](../../jitk/vmm/src/main.rs)) | Embeddability does not itself remove thread, event-loop, GIC, console, or process-lifecycle overhead. |

Firecracker's **file snapshot backend maps memory `MAP_PRIVATE`**, sharing clean file-backed pages and allocating anonymous CoW pages on writes. Dirty tracking supports incremental snapshot creation; it is not required merely to restore a file-backed snapshot. This is a concrete, simpler starting point than a custom userfaultfd pager for a small, warm image. (S, [FC-snapshot]; [FC-memory])

**Inference:** changing VMMs without changing lifecycle and memory backing is unlikely to close jitk's density gap. Copy the relevant mechanisms, not another full Linux-machine configuration. Measure process amortization separately from guest page sharing.

### Unikraft: guest boot can become the smaller term

Kuenzer et al., **EuroSys'21**, evaluated KVM on an **i7-9700K, 3.6 GHz/4.9 GHz turbo, eight cores, 32 GB**, with CPU isolation and performance governor. Hello-world guest initialization took tens of microseconds without a NIC, hundreds with one on QEMU/Solo5, and no more than 1 ms on Firecracker. **Total** boot was approximately 3 ms on Solo5/Firecracker, 10 ms on QEMU microVM, 40 ms on QEMU. The prose reports **2–6 MB minimum guest memory**, while fig.11 labels the four Unikraft bars **2/5/7/4 MB** (hello/nginx/Redis/SQLite); use **2–7 MB** when including Redis. These are guest allocations, not total host memory. Allocator selection changed nginx guest boot from **0.49 ms to 3.07 ms**. (P, [Unikraft] §§5–6, figs.10–11,14; figures visually checked)

**jitk implication [I]:** further trimming the small Rust kernel may help, but avoid optimizing boot instructions while copying the image, rebuilding memory mappings, spawning threads, or initializing QuickJS every time. EL0/EL1 separation and unmodified static binaries are intentional jitk differences from a conventional linked unikernel; Unikraft's values are feasibility evidence, not a transferable prediction.

Guest `SVC` system calls enter jitk at guest EL1; they do not inherently make a userspace-VMM exit. Removing a guest syscall is therefore not equivalent to removing a hypervisor crossing. Count actual KVM exits rather than multiplying the Linux syscall count by an exit-cost estimate. (I; jitk's [exception handling](../../jitk/kernel/src))

### Solo5 hvt and Nabla: distinguish the two isolation models

Current **Solo5 hvt arm64** issues hypercalls via MMIO stores into a reserved address range. Its KVM loop validates the address and width, obtains a checked guest pointer, and dispatches a small handler set. No vGIC is created in the inspected KVM backend. `POLL` waits on host epoll/timerfd or kqueue, rather than requiring a guest interrupt controller. This is very close prior art for a device-free jitk ABI, although this implementation blocks its tender thread while polling. (S, [Solo5-arm]; [Solo5-core])

**Nabla is the process-based branch of this idea**, not a special high-density KVM mode. “Unikernels as Processes,” SoCC'18, compared nabla with ukvm. Its Python-server density experiment reached **900 versus 740 instances** on a machine limited to 8 GB; disabling nabla's mmap sharing reduced it to **760**. Throughput tests used i7-6820HQ laptops, 2.70 GHz, 32 GB; startup tests used eight Xeon E5520 cores, 2.27 GHz, 64 GB. The paper reports up to **73% lower startup time**. (P, [Nabla] §5)

**jitk implication [I]:** keep hardware isolation, but take the file-backed-sharing lesson. Nabla's gains cannot be cited as hardware-VM gains. Its narrow interface also shows why replacing virtio must preserve batching; a hypercall for each tiny I/O operation can lose to a more elaborate transport.

### Virtines/Wasp: pooled hardware contexts are established

Wanninger et al., **“Isolating Functions at the Hardware Limit with Virtines,” EuroSys'22**, built an embeddable runtime hosting many virtual contexts. Wasp caches clean VM shells and snapshots initialized execution state. Deferring cleanup brings provisioning to within **4% of bare `vmrun`** in its experiment; that excludes the deferred cleanup work. Main KVM hardware was **AMD EPYC 7281, 16 cores, 2.69 GHz, 32 GB, Linux 5.9.12**. (P, [Virtines] §§4–5)

**jitk implication [I]:** report both response latency and steady-state CPU/refill throughput. Moving reset after response can improve the former without improving the latter. “Reusable microVM as a function call” is already solved as a research mechanism; jitk must demonstrate its own async, ABI, containment, and density properties.

## 2. Hyperlight source deep dive

The requested `microsoft/hyperlight` URL did not clone; the current repository is **`hyperlight-dev/hyperlight`**. Inspected commit **`8a7e6b8794fe`**, which also matches the earlier third-option investigation. Treat website claims of “coming soon” support separately from this source tree.

### Memory and reset

The memory manager separates immutable snapshot memory from writable scratch. Defaults are **128 KiB heap**, **400 KiB scratch**. Snapshot restore retains the same read-only snapshot mapping when possible, resets scratch, restores queue/bookkeeping state and execution state, and arranges guest-side copy-on-write through guest page tables. Snapshot and scratch occupy separate hypervisor regions; immutable image size is not duplicated as writable scratch. (S, [H-config]; [H-memory]; [H-mappings])

On Linux/KVM, scratch zeroing uses **`madvise(MADV_DONTNEED)`**; on the inspected macOS path it falls back to **`fill(0)`**. The Windows branch replaces the allocation. Thus “Hyperlight restore is lazy zeroing” is platform-dependent. Guest CoW and host `MAP_PRIVATE` are also different mechanisms: the former changes guest mappings into scratch, the latter asks the host VM system to CoW guest RAM. (S, [H-shared])

The public restore deliberately refuses a no-op optimization merely because the logical snapshot is already current: physical scratch may contain another request's data. A poisoned sandbox can be recovered through restore unless marked unrecoverable. **Correction to the draft:** poisoning does not universally require destroying the Hyperlight VM, although destroying suspect jitk shells can be a conservative policy. (S, [H-restore])

**For jitk [I]:** initially prefer host CoW; QuickJS and the kernel need not adopt Hyperlight's guest allocator/page-table protocol. Preserve fixed GPAs and host virtual ranges, reset writable pages, and measure first-touch costs. Guest CoW could later reduce reset work, but it adds a new trusted memory-management mechanism.

### Calls and host threads

`HyperlightVm::run` calls the backend's `run_vcpu` directly in the calling host thread. `Halt` returns from the loop; ordinary I/O dispatch calls the host handler and then resumes the guest. Idle, uncalled sandboxes therefore do not each require a blocked vCPU thread. The HVF module explicitly records that an older universal dedicated-thread/RPC design caused unacceptable performance overhead. (S, [H-run]; [H-HVF])

This is **not evidence of asynchronous host callbacks**. The inspected run loop synchronously dispatches host calls. To support thousands of jitk instances waiting on tools, return a distinct `Waiting` state to the scheduler, retain the vCPU fd/state, and resume after completion. Releasing a thread between top-level calls is easier than releasing it halfway through a call stack. [I]

### Transport and arm64 exits

Hyperlight now uses two **virtio packed rings without a discoverable virtio device**. Defaults: 64 G2H descriptors, 32 H2G descriptors, 12+8 buffer pages, **21 pages total arena**. At its 4 KiB logical page size that is 84 KiB. Therefore “no virtio” should mean no device enumeration/configuration/interrupt machinery, not a claim that ring ownership rules are new. (S, [H-transport])

Its KVM arm64 backend creates VM/vCPU state **without creating a GIC**. Notifications are writes to an unmapped I/O page; the MMIO address selects the operation. Halt additionally executes `KVM_RUN` with `immediate_exit` to finish the pending MMIO operation before the caller can change PC/state. It also handles an arm64 NISV/cache-maintenance corner case for read-only pages. (S, [H-KVM])

**For jitk [I]:** this validates the no-GIC direction but also demonstrates the engineering underneath “a few ioctls.” Keep the narrow ABI, bounds checks, pending-exit completion, cancellation, and invalid-syndrome handling in the spike.

## 3. KVM scalability: which limits actually matter

### Many VMs, memory slots, and file descriptors

The KVM API creates distinct VM fds; it imposes no HVF-style one-VM-per-process rule. One vCPU requires another fd and a shared `kvm_run` mapping. VM operations belong to the creating address space. vCPU operations *should* stay on the creating thread for performance; this is not HVF's strict thread-ownership restriction. (S, [KVM-API] §§1–4)

For **N one-vCPU VMs**, budget roughly **2N fds**, plus images, event sources and `/dev/kvm`; do not confuse `KVM_CAP_MAX_VCPUS` (per VM) with a process-wide instance cap. A design with 10,000 VMs consequently needs roughly 20,000 VM/vCPU descriptors before extras. This is fd arithmetic, not a measured attainable density. [I]

**Memslots are per VM**, not per VMM process. A snapshot region plus scratch/ring can use a small fixed number for every VM. Never use a slot per page or tool message. Query `KVM_CAP_NR_MEMSLOTS`: familiar fixed limits such as 32 or 512 are not portable. In inspected Linux **v6.12**, generic `KVM_MEM_SLOTS_NUM` is **`SHRT_MAX`**, with internal slots subtracted for the user limit. (S, [KVM-slots])

Slot count is therefore unlikely to kill this particular layout. **Updating slots on every restore can still kill latency.** The kernel publishes slot generations, coordinates readers with SRCU, and invalidates relevant mappings; this is not just changing a userspace pointer. Use persistent slots, not a new registration per call. No universal microsecond bound for this operation was verified. (S, [KVM-main]; I)

The API explicitly permits ordinary file-backed memory and says changes to the host backing are reflected in the guest. Thus the draft's suspicion about stale KVM backing after host mapping changes must not be generalized from HVF. Stop the vCPU during reset and use supported host VM operations; verify CoW/reset behavior on the actual kernel. ([KVM-API] §4.35)

### Kernel memory, translation tables, VMIDs

A threadless idle VM still retains KVM VM/vCPU objects, per-VM translation tables, mappings and fd state. No trustworthy universal **“0.3 MiB overhead”** was found. Include slab/page-table/kernel-stack growth in the density measurement, not just process PSS. On a 4 KiB host, a fully populated **32 MiB** region needs **64 KiB of leaf stage-2 tables** alone at 4 KiB granularity, plus upper levels; a 16 KiB granule has different coverage and allocation rounding. This is page-table arithmetic, not an empirical KVM footprint. (I; architecture background: [KVM-arm-host])

VMIDs are also not a simple limit on the number of allocated VMs. Linux's arm64 allocator handles generation rollover and broadcasts translation/cache invalidation when required. A workload cycling across more active VMIDs than the hardware can retain can therefore incur flush pressure before hitting an allocation limit. Benchmark the working set of **recently running** VMs, not only allocated idle objects. (S, [KVM-VMID]; I)

### Dirty logging and restore

Do not enable dirty logging by default just because snapshots exist. Firecracker separately configures dirty tracking for differential snapshots. Hardware dirty support, write protection, bitmap scanning, and dirty-ring support vary by kernel/architecture; a dirty ring is a page-change log, not an application completion ring. ([FC-snapshot]; [KVM-API] dirty-log capabilities)

For scale, a one-bit-per-4-KiB-page dirty bitmap for 32 MiB is only **1 KiB**. The concern is tracking/reset work and write faults, not this bitmap alone. Conversely, hugepage backing can amplify private allocation for tiny writes; compare actual CoW granularity before enabling it. These are accounting considerations, not a claim that every kernel splits or copies hugepages identically. [I]

**Proposed first implementation [I]:** map a trusted immutable memory image privately, register it once, run until yield, then discard private modifications while stopped. For larger images compare dirty-page reset against whole-range discard. For jitk's small image, extra tracking may cost more than it saves. Restore must also reset host-visible ring indices, guest registers, timers, entropy/time injection and kernel allocator state; memory remapping alone does not restore an instance.

## 4. arm64 entry/exit costs: evidence and missing measurements

Three quantities must remain separate: guest↔hypervisor-kernel round trip; guest↔userspace-VMM round trip; and sleeping/waking a host thread. Published “hypercall latency” frequently measures only the first.

| Hardware/source | Operation | Published result and scope |
|---|---|---|
| AMD Seattle Cortex-A57, ATC'17 | Kernel-handled hypercall | **6,413 cycles** baseline; **752 cycles** optimized EL2 Linux. UART userspace I/O: **10,012 → 7,630 cycles**. These used el2Linux on hardware **without VHE**, not a measurement on modern VHE silicon. (P, [ARM-ATC] table2) |
| AMD Seattle A1100, **2 GHz**, 2017 follow-up slides | Kernel hypercall / userspace I/O | Non-VHE **3,181 / 6,665 cycles**; optimized EL2 **752 / 7,630 cycles**. Dividing by 2 GHz yields **1.59/3.33 µs** and **0.376/3.815 µs** respectively. Conversion is arithmetic; the later baseline differs from the paper. (P, [ARM-slides]) |
| Apple **M4**, macOS **26.5.1**, clang21 `-O2`, 16 KiB pages | HVC and MMIO to a minimal HVF userspace loop | **644–706 ns HVC**, **727–803 ns MMIO**, six runs, 200,000 iterations/run. Article includes guest instructions and host loop; MMIO adds PC get/set calls. Original author measurement, **not peer reviewed**, not reproduced here. (P, [Apple-exits] §6.2) |
| AWS Graviton2/3/4; Ampere Altra/One | KVM HVC/MMIO userspace exit, WFI wakeup | **[U] No directly comparable primary measurement verified in this investigation.** Do not fill these cells with Seattle results, generic ARM estimates, application latency, or inter-core cache latency. |

VHE lets the host kernel run at EL2, avoiding parts of the nVHE world switch. The ATC result also shows that moving the kernel alone is insufficient: implementation and state-save optimizations matter. It does **not** establish that an HVC forwarded to userspace costs 752 cycles on Graviton. Modern nVHE, protected KVM, nested virtualization and Apple's HVF are distinct paths. ([ARM-ATC]; I)

**WFI has no fixed “latency” relevant to this scheduler.** In the inspected arm64 handler it can call `kvm_vcpu_halt`, scheduling the host thread out until an event. The elapsed wait includes the event delay and host scheduling. No clean Apple/Graviton/Ampere WFI wakeup number was verified. (S, [KVM-WFI])

**Practical implication [I]:** an approximately microsecond empty exit does not explain jitk's entire approximately 285 µs one-tool path, much less milliseconds of CPU/run, unless exit counts are very large. Count exits and separate transport, host queueing, JSON/QuickJS, and executor time before optimizing an individual instruction.

## 5. No GIC, no guest timer, explicit host scheduling

### A wait “hypercall” is feasible on stock Linux

Since the Linux 6.4 merge, arm64 can forward selected SMCCC function ranges to userspace. Configure **`KVM_ARM_VM_SMCCC_CTRL` / `KVM_ARM_VM_SMCCC_FILTER`** with `KVM_SMCCC_FILTER_FWD_TO_USER`, before any vCPU runs. The exit is `KVM_EXIT_HYPERCALL`; PC already points after the trapping instruction. crosvm implements this configuration today. The API's descriptive link sometimes shortens the attribute name; use the actual UAPI symbols. (S, [SMCCC]; [SMCCC-merge]; [Crosvm-SMCCC])

Choose a permitted function range and put payload/arguments in the shared ring. Fetching many argument registers with individual `KVM_GET_ONE_REG` calls would undermine HVC's simplicity. Feature-probe the device attribute, and retain a single fixed-width MMIO-store fallback for older kernels. An arbitrary unconfigured `hvc #imm` is not automatically a userspace callback. [I]

**Do not use WFI as the pool-yield instruction.** A blocked `KVM_RUN` retains its calling thread. Instead, a WAIT exit returns to userspace, records the instance as waiting, and returns the worker to its queue. On completion, the host writes the ring and invokes `KVM_RUN` again. No virtual interrupt is required because the VM is not currently running. ([KVM-WFI]; I)

No GIC does not mean virtual timers vanish from KVM. `KVM_CAP_ARM_USER_IRQ` exposes timer/PMU output levels for userspace irqchip configurations. Hyperlight/Solo5 demonstrate operation without a GIC; keep timers masked/unarmed for cooperative waits, and let the host enforce deadlines. An EL1 attacker can still alter timer registers, so unexpected timer/IRQ exits must be bounded and handled, not assumed impossible. ([KVM-API] §8.9; [H-KVM]; [Solo5-arm]; I)

The host scheduler can preempt a running guest independently of guest IRQs. A timer-free guest therefore remains killable. However, a guest spinning without yielding still occupies one runner until cancellation; bound execution quanta and deadlines with a targeted kick/signal, then verify how quickly KVM returns. Reusing a shell after an unclean stop requires stronger reset evidence than a clean WAIT/FINISH exit. ([H-run]; I)

**What jitk already does:** `kernel/src/wait.rs` uses WFI with masked exception delivery, services/rechecks console queues before sleeping, and disables the virtual timer for indefinite waits on its GIC path. Finite waits cap a timer interval at 1 ms; a separate counter-based fallback also exists. Thus the next step is not merely eliminating a spin loop: it is replacing this interrupt/timer-backed parking contract with a userspace-returning WAIT and measuring any fallback wakeups at fleet scale. (S, local [wait implementation](../../jitk/kernel/src/wait.rs))

### Worker pooling versus one thread per VM

**Proposed ownership:** each worker creates and permanently owns many single-vCPU KVM VMs. Only that worker issues their synchronous vCPU ioctls. An event loop routes tool completions to the owner; each instance has at most one runner. This preserves affinity without one thread per parked VM. Workers can be pinned per core/NUMA node; avoid work stealing initially because migrating vCPU ownership can increase state-reload costs. (I, informed by [KVM-API]; [H-run])

Sleeping threads are not runnable CPU load by themselves, and a default multimegabyte user stack reservation is not fully resident memory. Nonetheless, per-thread kernel stacks, task structures, TLS, touched stack pages, wakeups and synchronization consume resources. Compare actual stack residency and kernel memory rather than multiplying virtual stack size by VM count. [I]

The relevant scale variables are **allocated instances, runnable instances, completion rate, and CPU-ms/run**. As an illustrative calculation, 10,000 guests waking at 100 Hz generate one million wakeups/second; the same number with no periodic wakeups and 100 actual completions/second is a different problem. LightVM's Linux-versus-unikernel result supports removing background activity. This is why increasing thread count is not a substitute for yielding tool waits. (I; [LightVM] fig.11)

Pooling does not create CPU capacity: at 4.8 CPU-ms/run, one fully occupied core has an ideal upper bound of approximately **208 runs/s**; at 1 ms it is 1,000. Scheduler fairness, resetting, completions and supervisor work reduce these arithmetic ceilings. Record total service CPU, including background refill, and p99 delay when many completions arrive together. (I, using [project baseline])

## 6. Shared rings and doorbells versus virtio/vsock

io_uring's useful pattern is shared producer/consumer queues, explicit ownership, batch submission/completion, and notifications only when needed. That does not imply the guest needs Linux io_uring, or that `KVM_RUN` becomes an asynchronous operation by putting work on a host ring. ([io_uring]; I)

For jitk, separate **SUBMIT**, **WAIT**, and **FINISH** semantics. Drain all available submissions on exit; execute tools asynchronously; resume the guest with batches of available completions. Keep one authoritative instance generation so late tool results cannot enter a recycled VM. A WAIT records the consumed completion sequence; the owner rechecks readiness before actually parking it. This closes the completion-versus-sleep race without polling every idle VM. (Proposed design, I)

Use bounded descriptor counts, bounded payload pools, checked offsets rather than host pointers, release/acquire publication, wraparound-safe counters, and explicit backpressure. Guest-owned descriptors are hostile and may change during validation: copy validated command metadata before dispatch and control ownership until consumption. Preserve the existing frame, outstanding-call and total-call limits. Sharing a page eliminates a transport copy only if the application can consume its representation directly; JSON encoding/decoding and guest `read`/`write` copies remain otherwise. (I; [H-transport]; [local protocol contracts])

Virtio already provides shared queues, batching and notification suppression; Hyperlight uses those parts. Vsock additionally brings socket and guest-kernel machinery. The expected jitk win is deleting console emulation, IRQ injection/acknowledgement, discovery and host pipe/event-loop hops. **No verified benchmark isolates the savings from these components in jitk.** A narrower ABI is reasonable, but “custom ring is faster than virtio” is still a hypothesis. (I; [H-transport]; [local console implementation])

`ioeventfd` can handle a notification without returning to the userspace VMM, which is useful for some devices. But WAIT must release the current `KVM_RUN` caller, so turning that exit into a kernel-only eventfd notification does not solve worker pooling. Start with an ordinary userspace HVC/MMIO exit; optimize notification count after measuring. ([KVM-API] ioeventfd; I)

## 7. HVF: the real portability blocker

Local SDK `hv_vm.h` describes the VM as associated with the process; `hv_vcpu.h` explicitly permits only one associated vCPU per thread and requires owner-thread operations. `hv_vm_get_max_vcpu_count` queries a platform limit; do not invent a portable constant. These headers do not describe Linux-style VM handles selecting independent address spaces. (S, [Apple VM]; [Apple CPU])

Hyperlight creates the process VM once. Its per-thread vCPU uses a **global loaded-memory-space lock**. Switching logical sandboxes unmaps old regions, executes a small EL1 `TLBI` stub, maps the new regions, and synchronizes registers. The source's introductory statement that multiple sandboxes are “not yet implemented” refers to independent nested guests; the actual code supports serial logical-memory-space switching. (S, [H-HVF])

**Correction to the draft [I]:** one persistent process per core is a promising macOS deployment, but a process cannot sit blocked on one tool while retaining exclusive use of its only worker. It must save the logical sandbox and switch to another waiting/runnable context. Putting tenant RAM at disjoint GPAs inside the same HVF VM does not protect those tenants from a compromised EL1: they share the stage-2 address space. Nested virtualization is a separate design and cannot inherit the proposed memory/latency estimates.

HVF switching/remapping costs for jitk-sized images remain **unmeasured**. The cited M4 create/exit loop is not a benchmark of Hyperlight's full remap/register/TLBI path. The draft's blanket “similar 1–2 MiB on macOS” projection is therefore premature. [U]

## 8. Assessing the third option and its budgets

| Planned component | Already established | What jitk must still establish |
|---|---|---|
| Minimal VMM, no devices/GIC | Solo5 hvt, Hyperlight arm64 | Correct exceptions, cancellation, unsupported exits and adversarial behavior for jitk's EL1 kernel. |
| Many VMs/process, no thread per idle VM | KVM object model; direct-call Hyperlight; Wasp contexts | Async WAIT/resume with bounded workers and stable affinity at thousands of instances. |
| Snapshot/CoW | Firecracker host CoW; Hyperlight guest CoW | Full reset, uniqueness and measured working-set sharing for static QuickJS/Lua. |
| Shared ring/doorbell | Virtio, io_uring pattern, Hyperlight | Fewer hops without losing parallel tools, bounds or backpressure. |
| Agent-grown Linux syscall kernel | Distinctive combination in this project | No novelty established for the VMM mechanisms themselves; novelty may lie in verified specialization and integration. |

The following is an **engineering allocation [I], not a literature-derived prediction** for the incremental resident cost of a light sandbox in a large Linux shard:

| Component | Initial allowance | Why it can fail |
|---|---:|---|
| Private guest working set, including QuickJS | 0.5–1.0 MiB | Larger code, JSON, allocator fragmentation, mutable resources. |
| Guest stacks/page tables/control | 0.125–0.25 MiB | Linker layout, snapshot state and page granule. |
| Rings and payload pools | 0.0625–0.125 MiB | Large outstanding frames must allocate additional bounded buffers. |
| KVM objects/stage-2/kernel charges | 0.125–0.5 MiB | Entirely unverified allowance; host/kernel dependent. |
| Shared image and runner/process overhead | Amortized | Must add shared-page and shard charges once, not omit them. |

This leaves little headroom under 2 MiB. A fresh 32 MiB virtual reservation need not cost 32 MiB physically, but eagerly zeroing it, loading multiple copies, or dirtying it during init can erase that advantage. The existing VMM only accepts 32/64 MiB; its size flag is not itself the density metric. (I; local [VMM](../../jitk/vmm/src/main.rs))

The existing project report measured file-backed sharing reducing **32-VM PSS from 256 to 39 MiB** in a loader experiment, while explicitly leaving a loader integration gap. That makes sharing a higher-confidence first optimization than predicting enormous gains from ring instructions. This was not an all-inclusive kernel-memory result. [Project evidence](../../FINAL.md)

A shared VMM also changes containment: an escape into its userspace can reach other guests in that process; process-wide kill, RLIMIT and memory/cgroup accounting no longer isolate individual VMs. Start with **bounded shards** and retain an external watchdog capable of killing a wedged shard. Per-instance cancellation must interrupt the right runner and reject its late completions. Hardware isolation between KVM VMs remains, but the prior separate-VMM-process blast radius does not. (I; [current confinement contracts])

### Cheap experiments, each under one engineering day

These are proposals only. Use an already-authorized local Linux/KVM host for timing; nested Linux is useful for functional tests but cannot certify bare-metal latency. No cloud resources were created.

| Priority | Experiment | Confirm/kill criterion and expected impact [I] |
|---|---|---|
| 1 | 1/64/512/2,048 empty one-vCPU VMs in one process; compare fixed owner pool with dedicated threads. Measure fd counts, process PSS, cgroup memory, slab/page tables and idle CPU. | Isolate unavoidable host cost. If empty-instance cost already approaches 2 MiB, kill the budget before porting QuickJS. |
| 2 | Same ready image, persistent slots, `MAP_PRIVATE`; dirty 64 KiB/1 MiB/8 MiB; discard/reset and verify canaries through guest reads. | Require complete reset plus ≤1 ms p99 restore for the claimed working set. Potentially remove duplicated image/private boot pages; savings not guaranteed. |
| 3 | HVC forwarding versus fixed-store MMIO, no GIC; 100,000 empty round trips, with register ioctls counted. Then async WAIT with 1,000 pending instances. | Prove actual userspace exits and worker release. Target no more runner threads than configured workers and no periodic idle exits. |
| 4 | Existing one-tool and Promise.all(10) protocol over the ring; trace exits, runnable delay, total CPU and refill. | Require preservation of parallel tools; use one-tool latency below current 285 µs and ≤1 CPU-ms/run as separate gates. |
| 5 | On macOS, alternate 1,000 logical contexts through persistent HVF workers; time map/unmap/TLBI/register reset, test hostile register/memory canaries. | Validate the distinct HVF topology; reject ≤1 ms restore claim if switching fails it or leaks state. |

For every experiment report cold creation, warm restore, first invocation, reset CPU, and steady-state refill separately. Sweep recent-runnable-VM count as well as total allocated count. Measure p50/p99 with and without completion bursts; declare hardware, page size, kernel, VHE/nVHE mode and CPU affinity. [I]

## Source register

Primary papers and documentation are linked below. Source links use the inspected revisions: Hyperlight `8a7e6b8794fe`, Solo5 `46b837ac8428`, Firecracker `dd7c24b0d165`, Cloud Hypervisor `0e11215161b5`, crosvm `a13fd7e9b770`, libkrun `a1d8616765da`. Linux source checks use v6.12; runtime limits must still be probed on the deployment host. No repository builds or upstream scripts were executed.

[LightVM]: https://flosch.eu/papers/2017-sosp-lightvm.pdf
[Unikraft]: https://arxiv.org/pdf/2104.12721
[FC-paper]: https://www.usenix.org/system/files/nsdi20-paper-agache.pdf
[FC-spec]: https://github.com/firecracker-microvm/firecracker/blob/dd7c24b0d165/SPECIFICATION.md
[FC-snapshot]: https://github.com/firecracker-microvm/firecracker/blob/dd7c24b0d165/docs/snapshotting/snapshot-support.md
[FC-memory]: https://github.com/firecracker-microvm/firecracker/blob/dd7c24b0d165/src/vmm/src/vstate/memory.rs
[CH-vmm]: https://github.com/cloud-hypervisor/cloud-hypervisor/blob/0e11215161b5/vmm/src/lib.rs
[CH-cpu]: https://github.com/cloud-hypervisor/cloud-hypervisor/blob/0e11215161b5/vmm/src/cpu.rs
[Crosvm-intro]: https://github.com/google/crosvm/blob/a13fd7e9b770/docs/book/src/introduction.md
[Crosvm-cpu]: https://github.com/google/crosvm/blob/a13fd7e9b770/src/crosvm/sys/linux/vcpu.rs
[Crosvm-SMCCC]: https://github.com/google/crosvm/blob/a13fd7e9b770/hypervisor/src/kvm/aarch64.rs#L146
[Krun-linux]: https://github.com/containers/libkrun/blob/a1d8616765da/src/libkrun/src/vmm/linux/vstate.rs
[Krun-mac]: https://github.com/containers/libkrun/blob/a1d8616765da/src/libkrun/src/vmm/macos/vstate.rs
[Solo5]: https://github.com/Solo5/solo5/tree/46b837ac8428/tenders/hvt
[Solo5-arm]: https://github.com/Solo5/solo5/blob/46b837ac8428/tenders/hvt/hvt_kvm_aarch64.c#L328
[Solo5-core]: https://github.com/Solo5/solo5/blob/46b837ac8428/tenders/hvt/hvt_core.c#L198
[Nabla]: https://archive.fosdem.org/2019/schedule/event/solo5_unikernels/attachments/paper/3283/export/events/attachments/solo5_unikernels/paper/3283/p199_Williams.pdf
[Virtines]: https://arxiv.org/pdf/2104.11324
[H-config]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fe/src/hyperlight_host/src/sandbox/config.rs#L107
[H-memory]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fe/src/hyperlight_host/src/mem/mgr.rs#L692
[H-shared]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fe/src/hyperlight_host/src/mem/shared_mem.rs#L1423
[H-restore]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fe/src/hyperlight_host/src/sandbox/initialized.rs#L573
[H-mappings]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fe/src/hyperlight_host/src/hypervisor/hyperlight_vm/mod.rs#L519
[H-run]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fe/src/hyperlight_host/src/hypervisor/hyperlight_vm/mod.rs#L585
[H-transport]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fe/docs/virtio-host-guest-communication.md
[H-KVM]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fe/src/hyperlight_host/src/hypervisor/virtual_machine/kvm/aarch64.rs#L49
[H-HVF]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fe/src/hyperlight_host/src/hypervisor/virtual_machine/hvf/mod.rs
[KVM-API]: https://docs.kernel.org/virt/kvm/api.html
[KVM-slots]: https://kernel.googlesource.com/pub/scm/linux/kernel/git/torvalds/linux/+/refs/tags/v6.12/include/linux/kvm_host.h#700
[KVM-main]: https://github.com/torvalds/linux/blob/v6.12/virt/kvm/kvm_main.c
[KVM-arm-host]: https://github.com/torvalds/linux/blob/v6.12/arch/arm64/include/asm/kvm_host.h
[KVM-VMID]: https://kernel.googlesource.com/pub/scm/linux/kernel/git/torvalds/linux/+/refs/tags/v6.12/arch/arm64/kvm/vmid.c
[KVM-WFI]: https://github.com/torvalds/linux/blob/v6.12/arch/arm64/kvm/handle_exit.c#L90
[SMCCC]: https://docs.kernel.org/virt/kvm/devices/vm.html#attribute-kvm-arm-vm-smccc-filter-w-o
[SMCCC-merge]: https://lkml.iu.edu/2305.0/00066.html
[ARM-ATC]: https://www.usenix.org/system/files/conference/atc17/atc17-dall.pdf
[ARM-slides]: https://static.linaro.org/connect/sfo17/Presentations/SFO17-403%20Optimizing%20the%20Design%20and%20Implementation%20of%20KVM_ARM.pdf
[Apple-exits]: https://knowsys.tech/topics/47-virtualization
[Apple VM]: https://developer.apple.com/documentation/hypervisor/hv_vm_create(_:)
[Apple CPU]: https://developer.apple.com/documentation/hypervisor/hv_vcpu_create(_:_:_:)
[io_uring]: https://kernel.dk/io_uring.pdf

[Project measurements]: ../../jitk/bench/RESULTS-quiet-2026-10-24.md
[project baseline]: ../../jitk/bench/RESULTS-quiet-2026-10-24.md
[local sharing evidence]: ../../FINAL.md
[current confinement contracts]: ../../jitk/CONTRACTS.md
[local protocol contracts]: ../../jitk/protocol/PROTOCOL-v1.md
[local console implementation]: ../../jitk/kernel/src/console.rs

## Top 5 gaps/blockers

1. **HVF cannot implement concurrent independent VMs per process through its normal API.** Serial logical-context switching or multiple processes is required; nested guests are separate work. The Linux and macOS targets must be stated independently. ([Apple VM]; [Apple CPU]; [H-HVF])
2. **The 2 MiB target has no complete accounting basis yet.** Current footprint excludes HVF kernel charges; KVM per-instance overhead is unmeasured, and real QuickJS workloads can exceed the whole budget in heap alone. Memslots are not the main limit. ([Project measurements]; [KVM-slots]; I)
3. **Thread pooling requires a real mid-invocation yield protocol.** WFI and a synchronous tool callback retain a worker. The VM/vCPU objects can remain idle without threads, but a blocked API call cannot. ([KVM-WFI]; [H-run])
4. **Reset completeness and containment change together.** Reusing physical state creates register, timer, ring and memory-reset obligations; sharing a VMM removes the former per-instance process blast radius and kill mechanism. ([H-restore]; [H-KVM]; I)
5. **The latency and CPU projections lack native Linux evidence.** Published Seattle kernel hypercalls are not Graviton/Ampere userspace-exit measurements; Apple exit microbenchmarks are not full restore or service-CPU measurements. ([ARM-ATC]; [Apple-exits]; U)

## Top 5 recommendations

1. **First measure a minimal many-VM KVM shard with fixed owner threads.** Expected benefit: amortize VMM/process and thread overhead, plausibly several MiB relative to today's process-per-VM design; exact gain unknown. Run experiment 1 before implementing the full replacement. Reject the density premise if unavoidable empty-instance cost consumes the budget. [I]
2. **Use persistent slots and file-backed CoW snapshots before custom paging or dirty tracking.** Expected benefit: share the approximately 3 MiB image and skip repeated boot/image work; pursue ≤1 ms restore only for a declared working set. Experiment 2 must include total kernel charges, first-write latency and cross-request canaries. ([FC-snapshot]; [local sharing evidence]; I)
3. **Implement bounded async WAIT/resume, using filtered HVC with MMIO fallback.** Expected benefit: runner count follows active CPU demand rather than outstanding tool waits; batch notifications to reduce transport CPU. Experiment 3 proves thread release; experiment 4 must preserve Promise.all behavior and separately pass latency/CPU gates. ([SMCCC]; [H-KVM]; I)
4. **Keep HVF as a separate persistent-process worker backend.** Expected benefit: amortize create/launch costs while retaining independent hardware address spaces across processes. Do not publish the Linux memory/restore estimates for macOS until experiment 5 measures logical-context switches. ([H-HVF]; I)
5. **Gate further investment on whole-service accounting and reset/escape tests.** Record PSS plus shared and kernel charges, total CPU including refill, p99 completion-burst delay, and all state reset. Expected benefit: prevents apparent density or latency gains caused by omitted charges/deferred work; identifies whether the remaining bottleneck is VMM, guest heap or executor. ([Virtines]; [project baseline]; I)
