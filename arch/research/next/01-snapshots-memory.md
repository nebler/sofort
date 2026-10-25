# VM snapshot/restore and memory density

Research date: 2026-10-25. Scope: jitk's path from 10.7 MiB parked footprint to ≤2 MiB marginal physical memory and ≤1 ms restore. **[M]** denotes existing project measurements, **[S]** verified published/source evidence, **[D]** arithmetic derived from source, and **[E]** an unmeasured estimate or proposed acceptance threshold. No new benchmarks were run. Only this report was written.

## Assessment

**The credible design is a tenant-free snapshot of booted QuickJS, shared immutable backing, private writes, and precreated execution slots.** Snapshotting removes repeated initialization; sharing removes repeated image/runtime pages; keeping the VMM and VM objects alive removes creation work. These are separate savings. Firecracker demonstrates the backing mechanism; Hyperlight demonstrates a smaller, guest-assisted implementation. Neither establishes jitk's target without measuring its private dirty working set. [S: Firecracker snapshot documentation][FC-SNAP], [S: Hyperlight paging][HL-PAGING].

**≤2 MiB is plausible for parked or small glue-code instances, not a universal peak-memory bound.** The local QuickJS study needs an 8 MiB heap limit for one structured 1 MiB JSON parse/stringify. On Linux, multiple hardware VMs per VMM process is feasible. On Apple silicon HVF, it is not the same architecture: one process has one hardware VM, so preserve separate worker processes or serialize logical sandboxes. [M: QuickJS study][L-QJS], [S: Apple Hypervisor][HVF].

The earlier [third-option report][L-THIRD] needs three corrections: the 256→39 MiB sharing result was a process-mapping experiment, not KVM; SEUSS did not benchmark one KVM VM per function; fresh kernel entropy alone does not repair an already-snapshotted userspace PRNG.

## 1. What 10.7 MiB measures, and where it goes

### Measured comparison

The quiet October 24 canonical run used an Apple M-series host, macOS 26.6.1 arm64, libkrun/HVF, cached artifacts, 30 successful samples per row, load1 3.28–4.13. The related native engine study identifies the developer machine as M4 Pro; the canonical table itself does not record its CPU model, so that association is contextual rather than benchmark metadata. [M][L-QUIET], [L-QJS].

| Quantity | jitk | Hyperlight strict | Meaning |
|---|---:|---:|---|
| Parked process footprint | 10.657 MiB | 1.813 MiB | Before sending RUN |
| Parked RSS | 15.328 MiB | 7.047 MiB | Includes shared resident mappings |
| Cold `return2`, p50 | 5.904 ms | 4.767 ms | Spawn through validated result |
| Cold child CPU | 4.859 ms | 3.537 ms | Through reap; excludes supervisor/watchdog |
| Parked `one_tool`, p50 | 0.285 ms | 0.647 ms | Already initialized VM |

All figures above are [M][L-QUIET]. The later native-watchdog run reports 10.672/1.813 MiB parked footprints and 9.241 ms cold executor `return2`; it does not change the memory diagnosis. [M][L-WATCHDOG].

Crucially, `bench/run.py:279–289` takes five `proc_pid_rusage` readings **before** `w.run(case)`. The row's `one_tool` label does not mean peak or post-tool memory. The report explicitly excludes HVF kernel allocations. A valid density result must add shared-cache amortization, host page tables, hypervisor allocations, and supervisor/executor buffers; RSS sums alone overcount shared pages. [S][L-HARNESS].

### A defensible ledger, rather than an invented breakdown

| Component | Evidence today | Interpretation |
|---|---|---|
| Guest RAM address range | 32 MiB default, accepts 32/64 MiB | Reservation, not 32 MiB resident memory |
| Raw guest image | Current `kernel.bin`: 2,924,584 B = 2.7891 MiB | Includes packed ELF and layout padding; loaded into anonymous guest RAM |
| Static qjs ELF | 2,394,360 B = 2.2834 MiB | **Inside** that image; do not add again |
| Kernel stage-1 tables | 51 × 4 KiB = 204 KiB | Static storage; nested inside guest memory accounting |
| Kernel stack | 64 KiB address reservation | Residency depends on touched pages |
| Virtio guest queues | Four page-aligned queue objects = 16 KiB, plus 2 KiB control buffers | Guest-side cost is tens of KiB, not several MiB |
| QuickJS initialized heap | Native fresh context: 65 KiB used / 151 KiB malloc | Lower-bound context; not a measurement of the guest with `--std` and bootstrap |
| Remaining footprint | 10.657 − 2.7891 = **7.8679 MiB** | Unattributed: other guest writes, host heap/stacks/devices, allocator retention, etc. |
| HVF kernel state / stage-2 tables | Excluded, unmeasured | Cannot close the total-memory ledger |

Source/arithmetic [S/D]: [VMM main][L-VMM], [linker layout][L-LINK], [MMU arrays][L-MMU], [console][L-CONSOLE], [packing][L-PREPARE], [QuickJS measurements][L-QJS]. File sizes were inspected read-only during this research. Subtracting image bytes is a coarse accounting aid, **not** a demonstrated exclusive attribution of the footprint ledger; memory categories need mapping-level inspection.

`mmu.rs` has ROOT/LOW/RAM plus 32 identity-map tables and 16 user tables: `(3+32+16)×4096`. It builds a **64 MiB** identity window even for a 32 MiB configured VM. `boot.S` zeroes BSS, then MMU setup writes tables, so table storage is touched during boot. Snapshotting after initialization can share table pages until modified. [S/D][L-MMU], [L-BOOT].

An important saving is **already implemented**. Stock libkrun read the image into a heap `Vec`, then copied it into guest RAM; macOS retained that freed allocation. The direct-load patch reads into guest memory. Existing experiments report 13.36→10.52 MiB with the old image, and resource growth drops from approximately 2× to 1× resource bytes. Linux PSS stayed approximately 10.06 MiB because its allocator released the temporary buffer. Do not subtract another 2.8 MiB from today's 10.7. [M/S][L-FS], [L-DIRECT].

The fleet's 32-process experiment touched an 8 MiB mapping per process, then dirtied 1 MiB each: anonymous mappings used 256 MiB aggregate PSS versus 39 MiB with one shared file or sealed memfd. That is `7 MiB shared + 32×1 MiB private`, excluding process overhead. The experiment explicitly did **not** test KVM stage-2 behavior. [M][L-FLEET].

### Why Hyperlight's 1.8 MiB is relevant, but insufficient

The local adapter loads an initialized snapshot before READY. It explicitly configures **16 MiB heap and 16 MiB scratch**, so 1.813 MiB is not evidence of a 1.8 MiB allocation cap. Its initialized pages can remain shared/demand-backed. It also runs quickjs-ng 0.15.1 through rquickjs, while jitk uses Bellard QuickJS; these are whole-stack comparisons. [S/M][L-HL-WORKER], [L-QJS].

Upstream Hyperlight at verified commit `8a7e6b8794fea050ce287eed614088f0beb6b973` uses a hypervisor-read-only snapshot plus writable scratch. Guest faults copy pages into scratch and update guest PTEs; snapshot page-table pages may themselves need copying. This avoids host-managed CoW for those writes. Default scratch is 400 KiB and default heap 128 KiB, but those defaults do not describe our JS adapter. [S][HL-PAGING], [HL-CONFIG]. Its KVM scratch reset uses `MADV_DONTNEED`; other backends have different zeroing/replacement paths. Borrow the mechanism, then measure jitk's real dirty pages. [S][HL-SHARED].

This is not a drop-in kernel optimization: jitk currently shuts down on non-SVC exceptions. Guest-assisted CoW needs a page-fault handler, private writable PTEs and scratch allocation, including safe handling of kernel aliases. Host `MAP_PRIVATE` is the smaller first experiment because it preserves guest physical addresses without adding that machinery. [S/E][L-USER], [L-MMU].

## 2. Published systems: what their numbers actually establish

### Firecracker, NSDI 2020, and subsequent snapshots

Agache et al., NSDI'20 §§5.1–5.2, evaluate EC2 m5d.metal: dual Xeon Platinum 8175M, 48 physical cores with SMT disabled, 384 GB RAM, local NVMe, Ubuntu 18.04.2/Linux 4.15. They report approximately **3 MB VMM memory overhead**, compared with 13 MB Cloud Hypervisor and 131 MB QEMU; the overhead excludes configured guest memory and is based on non-shared process mappings. Headline boot is <125 ms, with up to 150 microVM creations/s/host. **These are neither total per-function memory nor snapshot-restore results.** The paper does not describe snapshotting. [S][FC20].

Later Firecracker snapshots serialize guest memory separately from vCPU/device state. The file backend maps memory `MAP_PRIVATE`: clean pages share the file's cache; writes become private. State restoration still constructs the target VM and emulation state. Snapshot compatibility depends on hardware/software configuration; disks and external connections require separate handling. [S][FC-SNAP]. For jitk, this validates sharing immutable backing, not replacing its tiny guest with Linux/Firecracker.

### REAP, ASPLOS 2021

Ustiugov et al. study vHive/Firecracker on dual Xeon E5-2680 v3, 48 hardware threads, 256 GB RAM, Intel 200 GB SATA SSD, Ubuntu 18.04/Linux 4.15, fixed 2.5 GHz. Their baseline hello-world snapshot costs **232 ms: 50 ms VMM/emulation restore plus 182 ms invocation**, versus approximately 1 ms warm invocation. The stable infrastructure working set alone is up to 8 MB. [S: §§4,6][REAP].

REAP records faulted guest pages through userfaultfd, packs a working-set file, then reads/prefetches it efficiently and installs pages. Figure 7 reaches **60 ms**; speedup across functions averages **3.7×**, range 1.04–9.7×. Measured SSD use improves to 533 MB/s versus an 850 MB/s peak. Recording adds 28% latency on average. The evaluation disables inter-instance sharing. [S][REAP].

**jitk implication [E]:** record startup pages and prewarm their backing if faults dominate. Do not assume an SSD-prefetch speedup applies to a few MiB already in page cache; REAP also shows that memory restore alone cannot remove VMM/orchestration setup.

### FaaSnap, EuroSys 2022

Ao, Porter and Voelker use EC2 c5d.metal, a 96-vCPU Xeon Platinum 8275CL host at 3 GHz, 192 GB RAM, Linux 5.4. Guests have one vCPU and 2 GB RAM; the NVMe measures 1,589 MB/s and 285,000 IOPS. They report up to **3.5×** improvement over prior snapshot execution and mean performance **3.5% slower than memory-cached snapshots**. These are application invocation comparisons, not sub-ms restore or 2 MiB VM results. [S: §§3,6][FAASNAP].

Its complementary mechanisms are concurrent prefetch, time-grouped working sets, compact loading files, and different backing for zero/nonzero regions. Zero regions use anonymous mappings, avoiding unnecessary file reads. Guest freed pages are sanitized before snapshotting. Mapping coalescing reduces hello-world's >1,000 loading regions to <100 for about 5% additional data. [S: §4][FAASNAP].

**jitk implication [E]:** separate initialized nonzero state from unused RAM, but keep few mappings. Treating every 4 KiB page as an individual VMA would import the overhead FaaSnap explicitly fixes.

### Catalyzer, ASPLOS 2020

Du et al. implement initialization-less restore and `sfork` in **gVisor's virtualization-based platform**, not a generic KVM VM-clone ioctl. They lazily recover application/system state and rebuild execution machinery around a template. Their microbenchmarks use i7-7700, 32 GB RAM, Samsung 512 GB SSD, Ubuntu 16.04/Linux 4.17.3; industrial experiments use an unnamed 96-core, 2.5 GHz, 256 GB server. [S: §§4–6][CATALYZER].

The paper reports **<1 ms for C hello-world in the best case and <2 ms for Java SPECjbb** with its optimized startup. A Java runtime-template experiment gives 29.3 ms versus 659.1 ms baseline gVisor. It does not establish ≤2 MiB hardware microVMs. [S][CATALYZER].

**jitk implication [E]:** pool or reconstruct the control machinery cheaply; don't confuse forking a VMM process with cloning a VM. KVM explicitly does not guarantee using inherited VM fds after `fork`; construct separate VM objects in the owning process. [S][KVM-API].

### SEUSS, EuroSys 2020

Cadden et al. snapshot the entire initialized stack and share pages across base/runtime/function layers. On dual E5-2660 machines, the compute-node comparison runs inside a 16-vCPU, **88 GB** QEMU/KVM VM. Table 1 reports cold/warm/hot **7.5/3.5/0.8 ms**, with **2.05/1.53/0.05 MB** incremental footprints. Table 3 fits **54,000** idle Node.js contexts versus 3,000 containers. Anticipatory execution reduces the NOP function snapshot from 4.8 to 2.0 MB. [S][SEUSS].

**Critical isolation qualification:** contexts execute at **ring 3**, with trusted SEUSS OS at ring 0; they are not 54,000 individually stage-2-isolated KVM VMs. The authors describe VM isolation as a compatible alternative. [S: §§5–6][SEUSS].

**jitk implication [E]:** warming tool/Promise paths before snapshotting may move first-use writes into shared state. Its density is evidence for computational caching, not a measured KVM metadata budget.

### Fireworks, EuroSys 2022

Shin et al. combine Firecracker v0.24 snapshots with **post-JIT** Node.js/V8 state. The Xeon Platinum 8180 server has 128 GB RAM and 2 TB SSD; guests have one vCPU, **512 MB RAM**, 2 GB disk. Across FaaSdom/ServerlessBench they report up to **20.6× performance improvement and 7.3× memory efficiency**, workload/baseline dependent. These factors do not imply 7.3× smaller arbitrary guest heaps. [S: §§4–5][FIREWORKS].

Snapshots use private mapping/CoW, sharing OS, libraries, runtime and generated code. Arguments arrive after restore via Kafka, with instance identity through MMDS. [S: §3][FIREWORKS].

**jitk implication [E]:** preinitialize the bootstrap and common immutable resources; inject each invocation afterward. QuickJS has no corresponding native JIT compilation phase to amortize. Snapshotting a common interpreter is useful; snapshotting every unique agent snippet before executing it is unlikely to amortize its creation cost.

### Sabre, OSDI 2024: compression is a different axis

Lazarev et al. integrate Intel IAA DEFLATE acceleration with Firecracker page prefetch. Main production testbed: Xeon Gold 6438Y+, two NUMA nodes, 32 cores/64 threads as tabulated, **250 GB DDR5**, Intel SSDSC2KG960G8 SSD, two IAA devices. They report snapshot compression **up to 4.5×** and memory-restoration speed improvement **up to 55%**. [S: Table 2, §§3–5][SABRE].

This reduces stored/transferred snapshot bytes. Decompressed active pages and their private writes still consume RAM; ordinary compressed files cannot directly provide the same page-cache-backed random CoW mapping. **No equivalent IAA-backed result was verified for M-series or arm64 KVM.** [S/E][SABRE].

For jitk [E], compression is appropriate for a cold image tier, after sharing works. Benchmark decompression once into one shared cache object, rather than decompressing a private copy per VM. It is unlikely to close today's steady-state footprint gap alone.

### AWS Lambda SnapStart: the useful design boundary

AWS initializes a version, captures encrypted memory/disk snapshots, and resumes separate environments from cached state. It requires applications to refresh unique values, credentials, timestamps, and connections where necessary. Hardware-specific per-VM RAM and bare restore distributions are not published in the cited product guide. [S][AWS-GUIDE].

The engineering description uses **512 KB chunks**, S3 plus distributed L2 and worker-local L1 caches, and learned chunk-access working sets. It quotes hundreds of milliseconds from S3, single-digit milliseconds from L2, and typically **1 ms per chunk from L1**. These are retrieval figures, not full function restore. [S][AWS-HOOD]. Thus a hard ≤1 ms jitk restore requires the hot working set already resident, not remote snapshot retrieval. [E]

### Unikraft and LightVM: guest size is not full density

Unikraft's EuroSys'21 experiments use i7-9700K/32 GB. The paper reports application images around 1 MB, **2–6 MB minimum guest RAM**, approximately 1 ms guest boot, and **3–40 ms total** including VMM; Figure 10 gives approximately 3.1 ms with Firecracker/Solo5. These are minimum guest configurations, not all-inclusive host charges. [S: §5.1, artifact appendix][UNIKRAFT].

LightVM, SOSP'17, redesigns Xen's toolstack. Tests use Xeon E5-1630 v3/128 GB and four Opteron 6376/128 GB hosts. It reports **2.3 ms creation+boot**, minimum running footprint approximately **3.6 MB**, and up to **8,000 VMs**; the 8 MB ClickOS firewall example boots in approximately 10 ms. [S: §§1,6][LIGHTVM].

**jitk implication [E]:** specializing the guest helps, but the toolstack and host object lifecycle remain independent bottlenecks. Neither system proves the requested ≤2 MiB/≤1 ms combination with QuickJS and jitk's isolation contract.

## 3. Restore mechanisms and their real costs

### Baseline: one immutable file, private mappings

Use a page-aligned snapshot file or sealed memfd shared by all clones. Every clone gets a **separate** `MAP_PRIVATE` mapping; registering the same writable host address with multiple KVM VMs would share writes. Keep guest physical addresses and EL0 virtual addresses stable so initialized QuickJS pointers remain valid. Seal/version the artifact, retain its lifetime, and never rewrite its inode under live clones. [S: file-backed restore][FC-SNAP]; [E: jitk design].

For a pool slot, stop execution, discard its private modifications, reset CPU/host protocol state, inject fresh invocation data, then resume. Linux `MADV_DONTNEED` on a private file mapping discards private changes and makes later accesses observe the backing file again. KVM must invalidate stale stage-2 mappings through its MMU-notifier path. This is materially different from writing snapshot bytes over a dirty heap: byte copying leaves private resident pages. [S][MADVISE], [KVM-MMU].

Do not presume reusing a memslot eliminates all reset cost. Fault resolution, invalidations, TLB work and vCPU state restoration remain. Stop every actor that could access guest RAM before discard/remap. Avoid deleting/recreating memslots on each run when stable mappings suffice; benchmark both rather than assigning an unverified universal ioctl latency. [E, grounded in][KVM-MMU], [KVM-HOST].

### userfaultfd: useful when selective paging earns its machinery

UFFD turns missing-page events into messages for a handler. It can batch/preload required ranges, resolve zero pages cheaply, and retrieve/decompress cold pages. `UFFDIO_COPY` generally creates destination pages; it does **not automatically preserve cross-VM physical sharing** merely because its source is shared. More advanced remap/minor-fault strategies require their own backing/feature design. [S][UFFD], [FC-UFFD].

KVM accesses guest memory from the host kernel, so a design using only `UFFD_USER_MODE_ONLY` can fail on kernel-originated faults. Arrange an appropriate `/dev/userfaultfd` permission boundary or the documented privileged mechanism before confinement. A blocked handler blocks the vCPU: include its CPU, queues, buffers and failure handling in accounting. [S][UFFD-ACCESS].

**Recommendation [E]:** begin with warm `MAP_PRIVATE`. Add UFFD only if measured first-touch tails or cold-tier fetches justify it. REAP's disk wins are not evidence that an extra pager thread/context switch is worthwhile for every hot 4 KiB page.

### KSM and deduplication at scale

KSM scans eligible **anonymous** pages and merges equal content after the fact; file-page sharing already follows backing identity. It consumes scan CPU, reverse-map metadata and time before convergence. `max_page_sharing` caps sharing fanout to bound expensive walks; increasing it trades memory savings against latency. Smart scanning helps avoid repeated failed comparisons. [S][KSM].

An illustrative configured rate of 100 pages per 20 ms scans at most 5,000 pages/s before processing overhead. Scanning 10,000 fully touched 32 MiB guests would take **4.55 hours**, derived at 4 KiB/page. That is incompatible with deduplicating single-use millisecond VMs after launch. [D] Seed/clock differences also prevent equality in otherwise similar pages. [E]

Use explicit sharing from birth. KSM could recover residual long-lived anonymous duplication within a suitable trust domain, but it is not the primary density plan. Shared **public code** still permits data-dependent access-pattern leakage: FLUSH+RELOAD demonstrated secret-key recovery across VMs from shared executable pages. A secret-free base prevents copied secrets; it does not eliminate side channels. The cited attack is x86, not proof of the exact same primitive on arm64. [S][FLUSHRELOAD].

## 4. What is unavoidable per hardware VM?

Separate **architectural register bytes**, **allocated host objects**, **translation metadata**, and **private workload state**. There is no architecture-independent “KVM costs 300 KiB” constant.

| Item | Derived size / planning treatment |
|---|---|
| Basic arm64 GPR+SIMD state | 31×8 + SP/PC/PSTATE×8 + 32×16 + FPCR/FPSR ≈792 B, before privileged/timer/debug state [D] |
| VM/vCPU kernel objects | `struct kvm`, `kvm_vcpu`, architecture fields, allocations/caches; build/config dependent, unmeasured here [S] |
| `kvm_run` mapping | Query `KVM_GET_VCPU_MMAP_SIZE`; don't assume a fixed cross-platform count [S] |
| Host page tables, 32 MiB @4 KiB | 16 leaf-table pages =64 KiB, plus required parents; roots amortize within a process [D] |
| x86 four-level EPT, same dense span | 16 leaves +3 ancestors =76 KiB for an aligned single span; extra mappings/roots/features add costs [D] |
| arm64 stage-2 @4 KiB | Similar leaf arithmetic; root/start level depends on IPA width and configuration [D] |
| Dirty bitmap, if enabled | 32 MiB /4 KiB /8 =1 KiB per bitmap, rounded/duplicated as implementation requires [D] |
| Guest stage-1 tables | jitk currently reserves/touches 204 KiB; snapshot can share unchanged pages [S/D] |
| Guest private state | Active heap, allocator metadata, stacks, rings, writable globals and copied PTEs; workload dependent [S/E] |

Register arithmetic excludes optional SVE/SME, whose enabled state can be much larger. Source basis: [arm64 vCPU structures][KVM-ARM], [generic objects][KVM-HOST], [KVM API][KVM-API], [translation definitions][ARM-PGTABLE], [local tables][L-MMU]. The EPT example is illustrative, not a measured arm64 allocation. Host and stage-2 page tables are separate costs; snapshot sharing does not automatically share independent VMs' stage-2 trees.

**Budget 0.25–0.75 MiB for combined per-slot VMM/thread/translation/hypervisor bookkeeping only as an experiment hypothesis [E].** It could be wrong; verify VM/vCPU slab allocations, worker stack residency and page-table caches at scale. Debug builds, large thread stacks, optional virtual devices and nested virtualization can invalidate it. Use `pahole`/BTF for build-specific struct sizes and allocation tracing or aggregate host-memory deltas for separately allocated state. [E based on][KVM-ARM], [KVM-HOST].

### 4 KiB, 16 KiB and huge pages

jitk's stage-1 pages are 4 KiB. This research host reports `getconf PAGESIZE = 16384`; that is the **host** granule, not a reason to change the static Linux ELF ABI. One modified 4 KiB guest page can dirty a 16 KiB host CoW unit, so pack mutable state together and keep immutable code/resources outside those units. Four modifications in four different 16 KiB units can therefore cost 64 KiB rather than 16 KiB. [S/D][L-MMU], [HL-CONFIG], [HVF-MAP].

With 8-byte descriptors, a 4 KiB leaf table covers 2 MiB; a 16 KiB leaf covers 32 MiB. For an aligned 32 MiB span that is 64 KiB versus 16 KiB of leaf-table storage, before parents. Parent tables are themselves 16 KiB on that configuration; fewer leaves do not establish a universal lower total for tiny/sparse maps. Guest stage-1, host stage-1 and stage-2 granules must be accounted separately. [D][ARM-PGTABLE].

THP reduces faults/TLB pressure and can reduce stage-2 leaf tables, but sparse writes can cause costly splitting or larger CoW allocations. Multi-size THP changes the tradeoff; a 2 MiB CoW allocation is already the entire per-VM target. Do not assume every THP write copies 2 MiB, since splitting is possible. Start with `MADV_NOHUGEPAGE` for mutable snapshot mappings and compare against measured mTHP/hugepage policies; consider large pages for immutable shared extents separately. [S/E][THP]. Firecracker's explicit 2 MiB hugetlb snapshot restore requires its UFFD backend, and dirty-page tracking reduces hugepage benefits; that is a backend constraint, not an argument to add hugepages to jitk immediately. [S][FC-SNAP].

## 5. A snapshot-of-booted-QuickJS design and budget

### Capture point

Boot jitk, initialize qjs/`--std`, compile the common bootstrap, exercise a tenant-free dummy Promise/tool serialization path, and stop at a dedicated host-visible checkpoint **before accepting any tenant input**. Ensure the dummy path leaves no pending jobs or stale responses. Capture guest RAM plus complete CPU state at stable addresses. [E, applying][SEUSS], [FIREWORKS].

Avoid snapshotting an arbitrary libkrun WFI/virtio transaction: that captures in-flight queue/device state. A device-free shared ring plus explicit wait/exit checkpoint makes the boundary much smaller. On arm64 KVM, custom HVC handling requires the documented SMCCC filter/forwarding interface where available; an arbitrary HVC is not automatically a VMM callback. Probe `KVM_ARM_VM_SMCCC_FILTER`; use a known MMIO doorbell fallback if needed. Hyperlight's arm64 KVM backend demonstrates operation without creating a vGIC. [S][KVM-SMCCC], [HL-KVM]; [E: proposed jitk interface].

**Private bytes are the pages dirtied after this checkpoint, not QuickJS's total initialized heap.** Refcount updates, allocator free-list manipulation, new atoms/strings, JSON temporaries, protocol input, kernel stack, syscall metadata and PTE changes all matter. `mmap.rs` currently zero-fills every allocated range; `munmap.rs` removes guest mappings without returning host pages. A malloc limit alone therefore does not bound all physical dirty pages or reclaim freed guest mappings. [S][L-MMAP], [L-MUNMAP].

### Planning ledger, explicitly not a measurement

| Marginal component, small request | Hypothesis [E] |
|---|---:|
| Private QuickJS heap/allocator deltas | 0.25–0.90 MiB |
| Private guest stacks, globals and PTE changes | 0.08–0.25 MiB |
| Small ring/control/input allowance | 0.03–0.12 MiB |
| Host/hypervisor/thread/translation bookkeeping | 0.25–0.75 MiB |
| **Total excluding shared base amortization** | **0.61–2.02 MiB** |

The ranges are target allocations to falsify, grounded only in the source components and small native heap measurements above. They are **not inferred dirty-page measurements**. The upper sum already misses 2 MiB, before large messages or shared-base amortization. At 4 KiB granularity, 1 MiB allows 256 private pages; at 16 KiB it allows 64 units. With 0.5 MiB host cost and 0.125 MiB rings/control, only **1.375 MiB** remains under a 2 MiB target. [D]

For `N` clones, account `shared resident base + N×marginal cost + shared executor/cache cost`. Example [E/D]: a 6 MiB resident base plus 1,000×1.25 MiB private/bookkeeping costs 1,256 MiB before other shared services. This illustrates amortization, not a measured host capacity. Reserve/admit against a higher tier for structured JSON, 1 MiB frames, resource copies, or allocation churn; the current native study demonstrates that large private heaps can overwhelm this budget. [M][L-QJS].

### What ≤1 ms restore must include

Define restore as **idle reusable slot → reset to tenant-free snapshot → first guest instruction accepting new invocation**, including memory reset, CPU state, ring reset and mandatory first-touch work. Also publish time through first result; returning from `mmap` or a restore API alone can hide demand faults. Keep separately measured fresh-VM creation and subsequent slot refill/reset CPU. [E: benchmark definition].

For an already created slot and resident backing, a useful hypothesis is **0.1–0.8 ms** restore [E], with no verified hardware-specific breakdown yet. This is a spike target, not a literature-derived prediction. Existing 0.183 ms parked `return2` shows the post-ready path is small, but says nothing about reset. Recreating the process/VM cannot be silently charged to a background pool: today's child CPU is approximately 4.8 ms even for parked calls because it includes initialization/reap. [M][L-QUIET].

The host execution path also remains: parked executor `one_tool` takes 2.983 ms versus 0.285 ms raw in the same run. A guest snapshot does not remove per-request host parsing/prelude/policy work. Measure that CPU separately before extending a ≤1 ms VMM-restore claim to the complete executor. [M/E][L-QUIET].

Copying a tiny known dirty set back into existing private RAM may beat remapping for latency but retain its RAM cost. Compare dirty-only copy, private-mapping discard, and Hyperlight-style guest scratch CoW. A reset design is successful only if both CPU/run and steady-state physical density improve. [E]

## 6. Linux/KVM versus macOS/HVF

**Linux:** separate VM fds provide distinct guest-physical address spaces inside one process. Retain one VM/vCPU per active slot, a small number of memslots, and separate private host mappings. Threads need not be one permanently resident host thread per parked VM; pool execution threads subject to the KVM API's ownership rules. Multiple VMs per process amortize allocator/runtime/event-loop overhead, but enlarge the blast radius of a VMM memory-safety defect. [S][KVM-API]; [E: operational tradeoff].

**macOS:** Apple documents one VM per process. A local fleet probe already observed second `hv_vm_create` returning **HV_BUSY**. Hyperlight's HVF code consequently serializes loaded address spaces and uses map/unmap plus a guest TLBI stub; this is logical multiplexing, not concurrent hardware isolation between EL1 kernels. [S/M][HVF], [L-FLEET], [HL-HVF]. Multiple vCPUs sharing one HVF VM do not create independent stage-2 protection domains. [D]

Use a process pool for independently concurrent workers. With async tools, a worker holding a waiting guest cannot simply overwrite it: either retain its logical context for safe serial swapping, or keep that VM/process occupied. Measure waiting concurrency separately from CPU concurrency. [E]

Do not assume host `MAP_PRIVATE` reset has Linux-equivalent behavior behind HVF mappings. The API maps process virtual memory into guest physical space; confirm fault/pinning behavior, safe discard, and required unmap/remap ordering. Hyperlight supplies a concrete safe-switch implementation, not published jitk restore timings. Include 16 KiB alignment, instruction-cache coherence, and stale stage-1/stage-2 translations in the spike. [S][HVF-MAP], [HL-HVF]; [E].

## 7. Uniqueness and complete reset are part of restore

Brooker et al., *Restoring Uniqueness in MicroVM Snapshots* (2021), distinguish entropy reseeding, high-value copied secrets, and application uniqueness. They propose `MADV_WIPEONSUSPEND` and VmGenID interfaces; these should not be described as a universally deployed Linux ABI. Firecracker documents a race between resumed vCPUs and Linux handling VMGenID reseeding. [S][UNIQUENESS], [FC-RANDOM].

jitk currently passes 16 random bytes and clock calibration through the boot command line, then copies seed bytes into `AT_RANDOM`. A booted snapshot freezes those values and any derived userspace state. Change the contract so a trusted post-restore hook injects new seed/time/generation **before tenant code** and refreshes all state that must vary. Updating `AT_RANDOM` afterward does not retroactively change libc guards or an initialized JS PRNG. For QuickJS, explicitly reseed its existing PRNG or arrange initialization after the restore gate; audit the exact vendored implementation. [S: existing path][L-VMM], [L-USER], [L-MAIN]; [E: required change].

Reset GPR/SIMD/system registers, translation controls, timers/counter offsets, exceptions/debug state and any enabled optional features; also reset host-side ring indices, budgets, callbacks, buffers, ownership and pending tool state. No tenant credentials, captured tokens, tool responses or run-specific resource contents belong in a globally shared base. Hash/version snapshots by kernel, runtime, bootstrap, resources, architecture and CPU-feature contract. [E, motivated by][UNIQUENESS], [AWS-UNIQUE], [KVM-ARM].

## 8. Cheap experiments with explicit rejection conditions

Each experiment is scoped to less than one engineering day; none was executed for this report. Use the existing Mac and local KVM setup, with no cloud provisioning. Nested KVM can validate correctness, not bare-metal latency.

1. **Close the memory ledger, 2–4 h.** Capture mapping categories and resident/private/dirty bytes at READY, peak `one_tool`, Promise fanout, 1 MiB single-string JSON, structured JSON and churn. Compare 1/32/256 instances; measure aggregate PSS plus page tables/slab/cgroup memory on Linux, and process footprint plus aggregate system/HVF changes on macOS. Pin identical artifacts. **Reject** an all-workload ≤2 MiB claim immediately if private working sets exceed it; retain a small-request tier if supported. Expected impact: measurement, no saving yet.

2. **Register a shared snapshot with real KVM, 4–6 h.** Start with two tiny guests using distinct private mappings of one file; force guest writes, host discard and reentry, checking sibling isolation and original-file hashes. Extend to 32/256 VMs and qjs READY if time allows. **Reject** the backing plan if writes cross clones, discard fails to evict private pages, or metadata alone approaches 2 MiB. Expected saving: share the 2.79 MiB image plus initialized clean state; quantify, don't extrapolate the process-only 39 MiB test.

3. **Capture READY and census dirty pages, 4–8 h.** Snapshot tenant-free booted QuickJS; track pages from checkpoint through each workload using KVM dirty logging and host private accounting. Repeat on 4 KiB and 16 KiB units. Compare cold initialization, initialized base and dummy-path-warmed base. **Reject** the small-tier target if private bytes plus measured host overhead exceed 2 MiB. Expected gain: eliminate boot/runtime initialization and perhaps several MiB duplicated state; magnitude unverified.

4. **Reset latency, CPU and HVF safety, 4–8 h.** Compare dirty-only copy, Linux mapping discard and HVF explicit unmap/remap; measure p50/p99/max, first result, total host CPU and memory after 10,000 cycles. Vary dirty set 64 KiB/256 KiB/1 MiB/8 MiB, with THP off initially. Include poisoned-run discard, stale-translation canaries, and new seed/time checks. **Reject** ≤1 ms if representative p99 restore exceeds it, or if apparent savings merely move >1 ms CPU into refill.

5. **Zeroing/layout/prefault ablation, 4–8 h.** Count pages dirtied by `mmap` zeroing and table setup, then evaluate a narrowly scoped prototype with clean zero backing, grouped mutable pages, selective prefaulting and fewer mapped tables. Preserve zero-after-reallocation semantics and rerun relevant syscall differentials. **Reject** any optimization that leaks previous contents or only improves READY while worsening peak dirty memory. Expected saving: up to portions of 204 KiB table storage, zeroed unused allocations, and 16 KiB false sharing; workload dependent. Add UFFD/compression only if the fault trace identifies a remaining problem.

## Source index

Links below are primary papers, upstream source/docs, or local project evidence. Live upstream docs were checked on the research date; Hyperlight source links are commit-pinned. Paper section/table references accompany numerical claims. No vendor-wide ≤2 MiB/≤1 ms claim, HVF kernel-memory measurement, or jitk dirty-page result was verified.

[FC20]: https://www.usenix.org/system/files/nsdi20-paper-agache.pdf
[FC-SNAP]: https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md
[FC-UFFD]: https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/handling-page-faults-on-snapshot-resume.md
[FC-RANDOM]: https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/random-for-clones.md
[REAP]: https://marioskogias.github.io/docs/reap.pdf
[FAASNAP]: https://www.sysnet.ucsd.edu/~voelker/pubs/faasnap-eurosys22.pdf
[CATALYZER]: https://ipads.sjtu.edu.cn/_media/publications/duasplos20.pdf
[SEUSS]: https://cs-web.bu.edu/~jappavoo/Resources/Papers/seuss.pdf
[FIREWORKS]: https://multics69.github.io/pages/pubs/fireworks-shin-eurosys22.pdf
[SABRE]: https://www.usenix.org/system/files/osdi24-lazarev_1.pdf
[UNIQUENESS]: https://arxiv.org/abs/2102.12892
[UNIKRAFT]: https://arxiv.org/pdf/2104.12721
[LIGHTVM]: https://www.cs.utexas.edu/~witchel/S25-380L/papers/manco17sosp-lightvm.pdf
[AWS-GUIDE]: https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html
[AWS-HOOD]: https://aws.amazon.com/blogs/compute/under-the-hood-how-aws-lambda-snapstart-optimizes-function-startup-latency/
[AWS-UNIQUE]: https://docs.aws.amazon.com/lambda/latest/dg/snapstart-uniqueness.html
[HL-PAGING]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/docs/paging-development-notes.md
[HL-CONFIG]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_host/src/sandbox/config.rs
[HL-SHARED]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_host/src/mem/shared_mem.rs
[HL-HVF]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_host/src/hypervisor/virtual_machine/hvf/mod.rs
[HL-KVM]: https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_host/src/hypervisor/virtual_machine/kvm/aarch64.rs
[KVM-API]: https://docs.kernel.org/6.12/virt/kvm/api.html
[KVM-SMCCC]: https://docs.kernel.org/6.12/virt/kvm/devices/vm.html
[KVM-MMU]: https://github.com/torvalds/linux/blob/v6.12/arch/arm64/kvm/mmu.c
[KVM-ARM]: https://github.com/torvalds/linux/blob/v6.12/arch/arm64/include/asm/kvm_host.h
[KVM-HOST]: https://github.com/torvalds/linux/blob/v6.12/include/linux/kvm_host.h
[ARM-PGTABLE]: https://github.com/torvalds/linux/blob/v6.12/arch/arm64/include/asm/pgtable-hwdef.h
[MADVISE]: https://man7.org/linux/man-pages/man2/madvise.2.html
[UFFD]: https://docs.kernel.org/6.12/admin-guide/mm/userfaultfd.html
[UFFD-ACCESS]: https://docs.kernel.org/admin-guide/mm/userfaultfd.html
[KSM]: https://docs.kernel.org/admin-guide/mm/ksm.html
[THP]: https://docs.kernel.org/6.12/admin-guide/mm/transhuge.html
[HVF]: https://developer.apple.com/documentation/Hypervisor?language=objc
[HVF-MAP]: https://developer.apple.com/documentation/hypervisor/hv_vm_map(_:_:_:_:)
[FLUSHRELOAD]: https://www.usenix.org/conference/usenixsecurity14/technical-sessions/presentation/yarom
[L-QUIET]: ../../jitk/bench/RESULTS-quiet-2026-10-24.md
[L-WATCHDOG]: ../../jitk/bench/RESULTS-native-watchdog-2026-10-24.md
[L-HARNESS]: ../../jitk/bench/run.py
[L-QJS]: ../quickjs-verdict.md
[L-THIRD]: ../third-option.md
[L-FLEET]: ../../05-scale-fleet/PROPOSAL.md
[L-FS]: ../../jitk/kernel/RESULTS-fs.md
[L-DIRECT]: ../../jitk/vmm/patches/raw-direct-load.diff
[L-VMM]: ../../jitk/vmm/src/main.rs
[L-MMU]: ../../jitk/kernel/src/mmu.rs
[L-LINK]: ../../jitk/kernel/link.ld
[L-CONSOLE]: ../../jitk/kernel/src/console.rs
[L-BOOT]: ../../jitk/kernel/src/boot.S
[L-USER]: ../../jitk/kernel/src/user.rs
[L-MAIN]: ../../jitk/kernel/src/main.rs
[L-MMAP]: ../../jitk/kernel/src/syscalls/mmap.rs
[L-MUNMAP]: ../../jitk/kernel/src/syscalls/munmap.rs
[L-PREPARE]: ../../jitk/kernel/prepare.py
[L-HL-WORKER]: ../../jitk/bench/hyperlight/worker.rs

## Top 5 gaps/blockers

1. **Unknown total and marginal memory.** Today's 10.7/1.8 MiB figures are parked process ledgers, excluding HVF kernel state; approximately 7.87 MiB of jitk footprint remains unattributed after the raw-image allowance. No measured dirty-page budget supports ≤2 MiB. (§1)
2. **Private workload growth.** Structured JSON already needs an 8 MiB heap limit; eager guest `mmap` zeroing and absent host reclaim can add resident pages. A universal ≤2 MiB peak claim is untenable with the current workload contract. (§§1,5)
3. **HVF cannot supply many independent hardware VMs per process.** Serial logical multiplexing requires careful state switching and waiting-context accounting. Linux and macOS need separate deployment plans. (§6)
4. **Sub-ms reset and low CPU remain unmeasured.** Snapshot API return, hidden first faults and background refill can conceal costs; fresh-process initialization currently consumes approximately 4.8 CPU-ms. (§5)
5. **Snapshot correctness is not just RAM.** Userspace PRNG state, clocks, registers, stale translations, host callbacks and prior-tenant contents need a complete restore contract; shared public pages retain side-channel exposure. (§§3,7)

## Top 5 recommendations

1. **Measure the ledger and dirty working set first.** Run experiments 1 and 3; define ≤2 MiB as marginal total memory for an explicit small-request tier, with peak and shared costs reported separately. Expected impact: confirm or kill the target in under a day per experiment.
2. **Implement Linux shared snapshot backing with distinct private mappings.** Keep the 32 MiB virtual envelope while sharing initialized image/runtime pages and demand-backing unused RAM. Experiment 2 should establish the removable 2.79 MiB image duplication plus any clean runtime state; dirty pages remain private.
3. **Reuse precreated VM slots and checkpoint booted QuickJS at a device-free boundary.** Compare mapping discard with guest-assisted scratch CoW; include reset/refill CPU. Target 0.1–0.8 ms hot restore as an explicitly unverified hypothesis. Experiment 4 decides whether ≤1 ms survives tails and correctness.
4. **Reduce avoidable writes and preserve a separate HVF process-pool design.** Group mutable state on 16 KiB hosts, narrow table/zeroing costs, and validate safe HVF remapping. Experiment 5 quantifies savings; expect tens to hundreds of KiB from layout/tables, potentially more from avoiding eager zeroed allocations.
5. **Make uniqueness/reset gates mandatory; defer KSM, UFFD and compression until traces justify them.** Fresh per-run entropy must reach initialized userspace state before execution. Explicit sharing offers immediate density; disk paging/compression and after-the-fact dedup solve later or different bottlenecks. (§§3,7)
