# Linux/KVM gate 0 ledger and comparators

Measured 2026-10-25 on **nested HVF → KVM**. Memory counters are useful for this Linux VM; all wall/CPU timings below are **indicative only**, with no Linux metal or production latency claim. No repository runtime code was changed.

**Main result:** current jitk has a 9.868 MiB/VM marginal batch charge. Setting only `GLIBC_TUNABLES=glibc.malloc.hugetlb=0` reduces it to 3.878 MiB/VM (−5.990 MiB/VM). The hardware VM floor is 0.217 MiB/VM. The allocation boundary and conservative kernel-inclusive bounds are quantified below.

## Environment and artifacts

Apple M4 Pro host; Ubuntu 26.04 arm64 guest, Linux `7.0.0-38-generic`, 6 vCPU, 9 GiB assigned (8,908 MiB MemTotal), 4 KiB host pages, no swap. The live configuration supersedes the older `kvm-dev/README.md` defaults. Exact uname, CPU model, THP settings, load, hashes and toolchain receipts are in `raw/environment.json` and `raw/host-environment.json`. Every measured point includes `uptime` and load in raw JSON.

Current jitk is a copy of `/home/dev/jitk-fs/build/jitk-vmm`, **post `raw-direct-load.diff`**, paired with the existing 2,924,544-byte QuickJS kernel image. `raw/build.json` identifies libkrun revision, all five patches, compiler and binary SHA-256. The older `jitk-work` VMM was found first and replaced before the accepted curves. Its metadata is retained as `raw/build-prior.json`.

Firecracker is the **official aarch64 v1.17.0 release**, downloaded into its own empty directory and verified with its published SHA-256 file before execution. See `raw/firecracker-release.json`, checksum receipt, and [official release](https://github.com/firecracker-microvm/firecracker/releases/tag/v1.17.0). Its guest is a custom tiny Linux 6.1.128 Image with an embedded, libc-free AArch64 init: serial console only, no disks/network, 1 vCPU, tickless idle. The kernel source archive also passed kernel.org SHA-256 verification. Config, hashes, RAM search and source for init are retained. This is a deliberately reduced guest, not a general-purpose Linux environment.

Hyperlight host sources were copied unchanged from `/tmp/jitk-09/hyperlight` (commit recorded in host environment); an isolated KVM-only release adapter was built with Rust stable 1.99.1. The existing aarch64 Hyperlight-JS guest ELF was copied, not rebuilt or modified. The adapter initializes QuickJS-NG, registers a `return 2` handler and verifies its result. Heap reservation is 4 MiB and writable scratch 1 MiB. These are virtual/reservation sizes, not RSS. The one-process snapshot series creates independent KVM VMs from one initialized snapshot and verifies `return 2` in every clone.

Bare KVM extends `kvm-dev/smoke/kvm-smoke.c`: independent VM + one initialized vCPU, 64 KiB mapped RAM with one code page touched, verified MMIO store of 42, then the host blocks on a pipe at that exit. No VGIC, devices, guest OS, runtime or owner thread per waiting VM. Both process-per-VM and one-process-many-VM layouts are measured. This is a lower bound, not a runnable JS service.

## Method and accounting

For each family: two separate curves at **N=1,16,64,256**. Process-per-VM curves grow incrementally; shared-process curves rebuild the process at each N. After creation, wait 3 seconds for memcg rstat to settle, collect three samples 200 ms apart, then measure one second of parked CPU. Fit `bytes = fixed + N × marginal` separately to each curve using the median of the three samples per point; report the mean of the two fits. The two observed slope endpoints are a repeatability range, not a statistical confidence interval. Raw JSON retains every PID’s `smaps_rollup`, process status, aggregate memory, representative mappings, cgroup `memory.stat`, `memory.current`, CPU counters, `/proc/meminfo` and KVM-related slab caches.

All measurements hold `flock /home/dev/bench.lock`. Guest processes enter their batch cgroup at birth through `clone3(CLONE_INTO_CGROUP)`. The enclosing task cgroup has `memory.max=3.5 GiB`, swap disabled, and an extra headroom guard. Controller/wait-wrapper costs are excluded from the VM ledger; both stay inside the enclosing cap in the controller cgroup. VMs are killed/reaped and their batch cgroup removed after every curve. No host THP setting, system kernel, VM configuration or other agent directory was modified.

**Primary batch charge = the `memory.current` slope.** Its non-overlapping decomposition is `anon + file + kernel + sock`; kernel already includes host page tables, secondary page tables and slab. Do not add Slab/SUnreclaim, system deltas or kernel subfields to that total again. Process PSS includes shared executable/library pages proportionally; summed RSS counts those pages repeatedly. PSS plus cgroup kernel is a useful cross-check but can double-count the small `kvm_run` mapping. Kernel allocations made by the launcher before the child executes can remain charged to the enclosing controller cgroup even with CLONE_INTO_CGROUP; the bounds below explicitly cover that boundary.

Executable/kernel caches were warm and some shared file pages were already charged outside the measured batch. Their proportional resident share appears in PSS; batch memory.current therefore does not claim to be a complete once-per-host cache bill. Snapshot creation/readback warms the common snapshot file outside each restore batch. The fit intercept is reported, along with snapshot file size, rather than silently charging that file N times. An intercept can be noisy at sub-MiB scale because of charge stocks, reclaim and cache ownership; it is not a capacity reservation.

The first quick pilot used a 0.5-second settle and exposed stale/zero memory.stat for small bare probes. Those curves are retained under `raw/pilot/` and excluded from final fits. The final curves use the three-second settle. System-wide meminfo/slab deltas remain background-sensitive because the other agents and builds share this VM; cgroup-local counters carry the attribution.

## Marginal memory and cold boot/CPU

| Family | Charged MiB/VM | PSS MiB/VM | Private dirty MiB/VM | Kernel MiB/VM | Cold ready p50 ms | Mean CPU to ready ms |
|---|---|---|---|---|---|---|
| jitk / libkrun (current) | 9.868 | 9.403 | 9.401 | 0.471 | 104.307 | 110.142 |
| jitk / libkrun (THP disabled control) | 3.880 | 3.413 | 3.411 | 0.471 | 102.520 | 108.128 |
| jitk / libkrun (malloc THP off) | 3.878 | 3.412 | 3.411 | 0.471 | 102.088 | 105.588 |
| Firecracker / Linux, boot | 8.798 | 7.854 | 7.851 | 0.946 | 222.320 | 227.829 |
| Firecracker / Linux, snapshot restore | 1.432 | 0.492 | 0.488 | 0.943 | 27.630 | 24.626 |
| Hyperlight / QuickJS-NG, process per VM | 7.348 | 7.058 | 7.057 | 0.295 | 34.064 | 34.838 |
| Hyperlight / QuickJS-NG, shared snapshot in one process | 0.371 | 0.157 | 0.157 | 0.215 | 54.636 | 55.937 |
| Bare KVM, process per VM | 0.370 | 0.101 | 0.096 | 0.273 | 2.307 | 1.221 |
| Bare KVM, many VMs in one process | 0.217 | 0.008 | 0.004 | 0.212 | 2.045 | 1.314 |

Cold timing uses **30 fresh single-VM processes per family, randomized and interleaved across all nine variants** (seed 20261025), measured from spawn request to validated readiness. CPU is cgroup `cpu.stat usage_usec`, including guest execution charged to the VMM and excluding the Python supervisor/wait wrapper. Jitk stops at sandbox acknowledgement + QuickJS READY; Firecracker additionally passes a serial round-trip; Hyperlight includes runtime initialization and verified `return 2`; bare KVM includes its verified MMIO exit. Snapshot Firecracker includes process/API startup, state load/resume and guest proof. The Hyperlight shared timing at N=1 also includes seed preparation and snapshot creation, so the N=256 amortized preparation numbers below better describe cloning at scale. These are declared fixture differences, not matched application workloads. Earlier sequential timing samples are retained under `raw/pilot/boot-sequential-*.json`; they showed time drift, so the interleaved samples are used in the table.

### Fits and repeatability

| Family | Marginal B/VM | Two-fit range B/VM | Charged fixed MiB | PSS fixed MiB | Minimum R² |
|---|---|---|---|---|---|
| jitk / libkrun (current) | 10347619 | 10336182–10359056 | 1.492 | 1.593 | 0.999999 |
| jitk / libkrun (THP disabled control) | 4068330 | 4067801–4068858 | 0.320 | 0.833 | 1.000000 |
| jitk / libkrun (malloc THP off) | 4066573 | 4066069–4067078 | 0.649 | 0.863 | 1.000000 |
| Firecracker / Linux, boot | 9225710 | 9225455–9225965 | 0.446 | 2.034 | 1.000000 |
| Firecracker / Linux, snapshot restore | 1501913 | 1501829–1501996 | 0.486 | 6.397 | 0.999999 |
| Hyperlight / QuickJS-NG, process per VM | 7705132 | 7678127–7732136 | 0.253 | 0.840 | 0.999979 |
| Hyperlight / QuickJS-NG, shared snapshot in one process | 388985 | 388954–389016 | 17.450 | 18.228 | 0.998636 |
| Bare KVM, process per VM | 388384 | 383976–392793 | 0.152 | 0.113 | 0.999846 |
| Bare KVM, many VMs in one process | 227811 | 226443–229179 | 0.322 | 0.125 | 0.999941 |

### All requested N (mean of the two settled curves)

PSS/dirty/RSS are **amortized per VM** below. In process-per-VM cases the raw data also contains the individual processes; in shared-process cases these are the single process totals divided by N.

| Family | N | Total charged MiB | PSS MiB/VM | Dirty MiB/VM | RSS MiB/VM | Idle % core/VM |
|---|---|---|---|---|---|---|
| jitk / libkrun (current) | 1 | 10.484 | 10.039 | 9.383 | 11.367 | 0.00000 |
| jitk / libkrun (current) | 16 | 159.320 | 9.502 | 9.445 | 11.428 | 0.00000 |
| jitk / libkrun (current) | 64 | 634.305 | 9.447 | 9.430 | 11.412 | 0.00000 |
| jitk / libkrun (current) | 256 | 2527.463 | 9.408 | 9.403 | 11.384 | 0.00000 |
| jitk / libkrun (THP disabled control) | 1 | 3.877 | 4.065 | 3.410 | 5.393 | 0.00000 |
| jitk / libkrun (THP disabled control) | 16 | 62.617 | 3.468 | 3.411 | 5.392 | 0.00000 |
| jitk / libkrun (THP disabled control) | 64 | 248.787 | 3.428 | 3.411 | 5.392 | 0.00000 |
| jitk / libkrun (THP disabled control) | 256 | 993.514 | 3.416 | 3.411 | 5.392 | 0.00000 |
| jitk / libkrun (malloc THP off) | 1 | 4.482 | 4.072 | 3.410 | 5.383 | 0.00000 |
| jitk / libkrun (malloc THP off) | 16 | 62.494 | 3.469 | 3.411 | 5.391 | 0.00000 |
| jitk / libkrun (malloc THP off) | 64 | 249.168 | 3.429 | 3.411 | 5.392 | 0.00000 |
| jitk / libkrun (malloc THP off) | 256 | 993.398 | 3.416 | 3.411 | 5.391 | 0.00000 |
| Firecracker / Linux, boot | 1 | 9.195 | 9.895 | 7.844 | 9.906 | 0.03012 |
| Firecracker / Linux, boot | 16 | 141.213 | 7.985 | 7.853 | 9.916 | 0.04199 |
| Firecracker / Linux, boot | 64 | 563.611 | 7.885 | 7.850 | 9.912 | 0.03871 |
| Firecracker / Linux, boot | 256 | 2252.799 | 7.862 | 7.851 | 9.913 | 0.08889 |
| Firecracker / Linux, snapshot restore | 1 | 1.785 | 7.010 | 0.486 | 7.021 | 0.06968 |
| Firecracker / Linux, snapshot restore | 16 | 23.492 | 0.893 | 0.482 | 7.021 | 0.04680 |
| Firecracker / Linux, snapshot restore | 64 | 92.223 | 0.589 | 0.484 | 7.020 | 0.07094 |
| Firecracker / Linux, snapshot restore | 256 | 367.143 | 0.517 | 0.488 | 7.021 | 0.44450 |
| Hyperlight / QuickJS-NG, process per VM | 1 | 7.520 | 7.832 | 6.863 | 9.158 | 0.00000 |
| Hyperlight / QuickJS-NG, process per VM | 16 | 116.549 | 7.023 | 6.947 | 9.239 | 0.00000 |
| Hyperlight / QuickJS-NG, process per VM | 64 | 472.238 | 7.100 | 7.077 | 9.371 | 0.00000 |
| Hyperlight / QuickJS-NG, process per VM | 256 | 1881.043 | 7.060 | 7.054 | 9.348 | 0.00000 |
| Hyperlight / QuickJS-NG, shared snapshot in one process | 1 | 18.957 | 19.612 | 18.641 | 20.938 | 0.00000 |
| Hyperlight / QuickJS-NG, shared snapshot in one process | 16 | 21.875 | 1.200 | 1.139 | 1.283 | 0.00000 |
| Hyperlight / QuickJS-NG, shared snapshot in one process | 64 | 41.570 | 0.447 | 0.431 | 0.467 | 0.00000 |
| Hyperlight / QuickJS-NG, shared snapshot in one process | 256 | 112.412 | 0.228 | 0.225 | 0.234 | 0.00000 |
| Bare KVM, process per VM | 1 | 0.430 | 0.132 | 0.090 | 1.330 | 0.00000 |
| Bare KVM, process per VM | 16 | 6.553 | 0.114 | 0.092 | 1.334 | 0.00000 |
| Bare KVM, process per VM | 64 | 23.387 | 0.103 | 0.092 | 1.335 | 0.00000 |
| Bare KVM, process per VM | 256 | 95.061 | 0.101 | 0.096 | 1.338 | 0.00000 |
| Bare KVM, many VMs in one process | 1 | 0.428 | 0.134 | 0.090 | 1.336 | 0.00000 |
| Bare KVM, many VMs in one process | 16 | 3.717 | 0.016 | 0.009 | 0.091 | 0.00000 |
| Bare KVM, many VMs in one process | 64 | 14.475 | 0.010 | 0.005 | 0.029 | 0.00000 |
| Bare KVM, many VMs in one process | 256 | 55.883 | 0.008 | 0.004 | 0.013 | 0.00000 |

### Serial provisioning at the same N

Each cell is **wall / CPU ms per VM**, amortized over provisioning that population, averaged across the two curves. Shared-process numbers include one process/seed and all independent VMs; process-per-VM numbers average the individual creation intervals. These raw creation timings exclude the settling/sampling pauses. They are additional nested diagnostics, with the load at each point retained; use the interleaved table above for the cleaner cold comparison.

| Family | N=1 | N=16 | N=64 | N=256 |
|---|---|---|---|---|
| jitk / libkrun (current) | 302.374 / 319.471 | 277.288 / 295.075 | 257.799 / 273.018 | 206.308 / 215.891 |
| jitk / libkrun (THP disabled control) | 265.597 / 261.364 | 252.597 / 254.291 | 264.425 / 268.189 | 214.484 / 218.845 |
| jitk / libkrun (malloc THP off) | 290.049 / 286.365 | 277.639 / 297.327 | 206.180 / 219.740 | 150.068 / 154.560 |
| Firecracker / Linux, boot | 346.842 / 341.579 | 295.743 / 294.202 | 335.569 / 337.298 | 375.834 / 526.262 |
| Firecracker / Linux, snapshot restore | 56.753 / 49.645 | 36.392 / 35.243 | 45.649 / 48.527 | 44.392 / 57.220 |
| Hyperlight / QuickJS-NG, process per VM | 167.022 / 163.372 | 110.145 / 101.943 | 99.489 / 90.189 | 82.917 / 76.151 |
| Hyperlight / QuickJS-NG, shared snapshot in one process | 108.379 / 105.590 | 18.700 / 18.311 | 25.503 / 24.502 | 26.527 / 24.778 |
| Bare KVM, process per VM | 6.322 / 4.999 | 4.458 / 2.300 | 5.299 / 2.709 | 3.563 / 1.739 |
| Bare KVM, many VMs in one process | 2.531 / 1.276 | 2.715 / 2.134 | 0.910 / 0.780 | 1.462 / 1.322 |

## Kernel charges

Subcomponents are marginal KiB/VM from settled cgroup memory.stat. They are included in Kernel, and not additive with Slab’s reclaimable/unreclaimable subsets.

| Family | Kernel | KernelStack | PageTables | SecPageTables | Slab | SUnreclaim | percpu | vmalloc |
|---|---|---|---|---|---|---|---|---|
| jitk / libkrun (current) | 482.421 | 48.000 | 100.882 | 32.000 | 136.265 | 111.905 | 1.250 | 16.000 |
| jitk / libkrun (THP disabled control) | 482.771 | 48.000 | 101.031 | 32.000 | 136.484 | 112.117 | 1.250 | 16.000 |
| jitk / libkrun (malloc THP off) | 482.435 | 48.000 | 100.926 | 32.000 | 136.269 | 111.900 | 1.250 | 16.000 |
| Firecracker / Linux, boot | 969.176 | 32.000 | 76.394 | 28.000 | 667.823 | 642.380 | 0.969 | 12.000 |
| Firecracker / Linux, snapshot restore | 965.333 | 32.000 | 72.705 | 24.000 | 667.713 | 642.273 | 0.969 | 12.000 |
| Hyperlight / QuickJS-NG, process per VM | 301.842 | 0.000 | 67.373 | 32.000 | 54.337 | 33.329 | 0.125 | 0.000 |
| Hyperlight / QuickJS-NG, shared snapshot in one process | 220.054 | 0.000 | 2.028 | 28.000 | 42.017 | 22.766 | 0.000 | 0.000 |
| Bare KVM, process per VM | 279.919 | 0.000 | 50.450 | 16.000 | 49.338 | 30.084 | 0.125 | 0.000 |
| Bare KVM, many VMs in one process | 217.599 | 0.000 | 0.127 | 16.000 | 41.467 | 22.208 | 0.000 | 0.000 |

### Global deltas at N=256

These are measured before→N=256 deltas averaged across the two curves, in MiB, **not extra charges to add**. The raw baseline and each N retain all meminfo fields and KVM slab active/allocated object counts. Negative values can reflect background frees/cache changes.

| Family | PageTables | SecPageTables | Slab | SUnreclaim | KernelStack |
|---|---|---|---|---|---|
| jitk / libkrun (current) | 35.709 | 7.934 | 23.391 | 20.061 | 19.939 |
| jitk / libkrun (THP disabled control) | 35.752 | 7.891 | 28.684 | 25.119 | 19.904 |
| jitk / libkrun (malloc THP off) | 35.770 | 7.980 | 28.125 | 24.145 | 19.947 |
| Firecracker / Linux, boot | 30.168 | 6.799 | 165.639 | 155.463 | 15.918 |
| Firecracker / Linux, snapshot restore | 28.721 | 5.830 | 155.633 | 152.971 | 15.986 |
| Hyperlight / QuickJS-NG, process per VM | 28.084 | 7.760 | 6.607 | 4.086 | 8.029 |
| Hyperlight / QuickJS-NG, shared snapshot in one process | 0.402 | 6.047 | 1.691 | 0.268 | 0.029 |
| Bare KVM, process per VM | 23.604 | 3.922 | 7.723 | 4.928 | 8.020 |
| Bare KVM, many VMs in one process | 0.150 | 3.977 | -0.594 | 0.709 | 0.021 |

### Named KVM slab caches

Whole-system `/proc/slabinfo` at N=256, averaged across the two curves (KiB). The `kvm_vcpu` object size is 7,344 bytes on this host. Allocator cached objects and other agents can affect the active/allocated counts, so these named caches are cross-checks, not a replacement for cgroup slab charges. `kvm_gmem_inode_cache` did not grow with these anonymous/MAP_PRIVATE guests. Raw data retains exact active/object/slab counts and object/slab sizes for every N.

| Family | Baseline active KiB | N=256 active KiB | N=256 allocated-object KiB |
|---|---|---|---|
| jitk / libkrun (current) | 559.406 | 1936.406 | 1936.406 |
| jitk / libkrun (THP disabled control) | 573.750 | 1907.719 | 1907.719 |
| jitk / libkrun (malloc THP off) | 559.406 | 1936.406 | 1936.406 |
| Firecracker / Linux, boot | 573.750 | 1893.375 | 1893.375 |
| Firecracker / Linux, snapshot restore | 473.344 | 1907.719 | 1907.719 |
| Hyperlight / QuickJS-NG, process per VM | 588.094 | 1893.375 | 1893.375 |
| Hyperlight / QuickJS-NG, shared snapshot in one process | 1233.562 | 1907.719 | 1907.719 |
| Bare KVM, process per VM | 530.719 | 1879.031 | 1879.031 |
| Bare KVM, many VMs in one process | 1262.250 | 2008.125 | 2008.125 |

### Gate 0 closure and the launcher boundary

The current jitk curves meet the ≤10% within-batch residual criterion at every N. The residual at N=256 is much smaller. Small bare/snapshot/control N=1 charges sometimes retain tens or hundreds of KiB of counter-stock/aggregation residue even after settling; those rows are explicitly not claimed to have sub-10% closure. The absolute residual and every component are retained, and the N=256 residual plus fitted slopes constrain the marginal result.

There is also a real cgroup ownership boundary: the main VMM task is created by a launcher in the controller cgroup. In process-per-VM curves the enclosing cgroup gains about **32 KiB/VM more KernelStack** than the batch: one main VMM task plus one measurement wait task. The VMM’s own secondary threads are charged inside the batch. The enclosing-minus-batch kernel slope includes those birth allocations and all wait-helper kernel overhead. Adding all of it gives a conservative **measurement-inclusive upper estimate**, rather than omitting birth charges or pretending the helpers are production costs. For the one-process curves it is essentially fixed and vanishes from the marginal.

| Family | Max residual, all N | Max residual, N=256 | Extra enclosing kernel KiB/VM | Charged → inclusive upper MiB/VM |
|---|---|---|---|---|
| jitk / libkrun (current) | 6.07% | 0.033% | 128.044 | 9.868–9.993 |
| jitk / libkrun (THP disabled control) | 1.07% | 0.078% | 126.963 | 3.880–4.004 |
| jitk / libkrun (malloc THP off) | 13.59% | 0.079% | 128.242 | 3.878–4.003 |
| Firecracker / Linux, boot | 4.38% | 0.046% | 134.875 | 8.798–8.930 |
| Firecracker / Linux, snapshot restore | 25.10% | 0.286% | 135.575 | 1.432–1.565 |
| Hyperlight / QuickJS-NG, process per VM | 6.33% | 0.040% | 133.913 | 7.348–7.479 |
| Hyperlight / QuickJS-NG, shared snapshot in one process | 0.89% | 0.868% | 0.000 | 0.371–0.371 |
| Bare KVM, process per VM | 26.19% | 0.727% | 130.666 | 0.370–0.498 |
| Bare KVM, many VMs in one process | 25.40% | 1.181% | 0.031 | 0.217–0.217 |

These brackets concern measured parked marginal memory, with shared images reported separately. They are not adversarial peak bounds or density reservations. KernelStack appears both in system meminfo and the enclosing cgroup, so the missing main-task stack is observable rather than silently lost.

## Interpretation and limits

**Jitk’s largest avoidable cost is glibc heap THP, not KVM.** In the representative N=256 process the 32 MiB guest RAM mapping has 3,350,528 resident bytes (3.195 MiB), unchanged by the THP controls. Three separate 2 MiB anonymous mappings consume a further 6 MiB of AnonHugePages. The trace records one `MADV_HUGEPAGE` from each secondary thread; their addresses are heap-arena mappings, separate from the thread stacks. With THP disabled those three mappings have only 28,672 resident bytes total. `GLIBC_TUNABLES=glibc.malloc.hugetlb=0` reproduces the process-wide control, while retaining the same guest RAM residency. The fitted saving is 5.990 MiB/VM (60.7%). See `raw/stack-trace.txt`, `raw/stack-diagnostic.json`, and the two control curves. This agrees with the [glibc malloc tunable documentation](https://www.sourceware.org/glibc/manual/latest/html_node/Memory-Allocation-Tunables.html), which identifies malloc huge-page advice as an AArch64 default. The [kernel THP documentation](https://docs.kernel.org/admin-guide/mm/transhuge.html) documents the inherited process-wide PR_SET_THP_DISABLE control.

The guest RAM map includes the 2.789 MiB image and about 0.406 MiB beyond it; that subtraction identifies copied image bytes, not a proof that the remaining pages are all private under a future snapshot. The rest of the process accounts for allocator/console/VMM state, stacks and relocations. Current jitk kernel charges are about 0.471 MiB/VM, compared with 0.212 MiB/VM of kernel charge for the shared-process bare floor: devices, extra host threads, host page tables and slab explain much of that smaller gap. The kernel table quantifies each category; allocations inside the remaining generic kernel subtotal are not symbol-level attributed.

**Firecracker boot → snapshot:** the batch marginal falls from 8.798 to 1.432 MiB/VM. The original guest boots with 10 MiB RAM (three successes at 10 MiB; three panics at 9 MiB). The common memory snapshot is exactly 10,485,760 bytes; its 6,024-byte state file is recorded with SHA-256 in `raw/snapshot.json`. At N=256 the representative `rw-p .../fc-memory` mapping has 4,616,192 bytes Shared_Clean, 180,224 bytes Private_Dirty and 197,632 bytes PSS: direct evidence of same-file MAP_PRIVATE sharing plus private post-resume writes. Every restored VM completes the console proof. This matches [Firecracker’s snapshot mapping design](https://github.com/firecracker-microvm/firecracker/blob/v1.17.0/docs/snapshotting/snapshot-support.md). The full warmed snapshot file is a fixed shared-cache cost, not included N times.

Firecracker’s larger kernel cost persists after restore: about 0.943 MiB/VM, of which about 0.652 MiB/VM is slab. Thus snapshot sharing removes most guest private memory but does not remove the VMM/KVM/device/security kernel state. The additional slab is measured, but this experiment does not identify the individual allocation call sites; attributing it all to a particular device would be speculative. The tiny Linux guest also has a larger writable boot footprint than jitk’s guest.

**Hyperlight process → shared snapshot:** 7.348 → 0.371 MiB/VM, with 17.450 MiB fixed in the shared-process fit. The standalone process has a fully resident roughly 6 MiB initialized guest/heap mapping; clones share their prepared image and retain about 157 KiB/VM of process PSS delta plus about 220 KiB/VM kernel charge. Each clone has its own KVM VM/vCPU. Shared-process snapshot memory, per-process cold memory and the historic macOS 1.8 MiB Hyperlight footprint therefore describe different layouts.

The Hyperlight shared process also retains 10 MiB of AnonHugePages in its host heap plus a roughly 6 MiB prepared guest mapping in the representative N=256 sample. That helps explain its large fixed part; it is amortized across VMs. No Hyperlight allocator-tuning claim is made from the jitk control.

**Bare process → shared process:** 0.370 → 0.217 MiB/VM before the explicitly bounded launcher birth cost. The shared floor has about 4 KiB/VM anonymous guest code, 4 KiB/VM of kvm_run RSS, 16 KiB/VM secondary page tables, and amortized process mappings. It establishes that independent empty KVM VMs fit below the 0.5–1 MiB gate-2 threshold in this environment; it does not establish the full JS workload bound.

The Linux process-per-VM backend, historic macOS/HVF footprint and independent one-process snapshots use different accounting/backend/layouts. The historic **10.657 MiB/VM** macOS figure predates raw-direct-load; this report does not treat an arithmetic difference as a same-build platform speed/density comparison.

For the requested numerical comparison, Linux current PSS is 9.403 MiB/VM (11.8% below that historic macOS number). Its batch charge including in-batch kernel charges is 9.868 MiB/VM; the measurement-inclusive kernel upper estimate is 9.993 MiB/VM. The malloc control is a separate experimental configuration, not a shipped baseline.

The production comparison also needs equal application semantics: jitk runs Bellard QuickJS with its Linux-like guest ABI; this Hyperlight guest runs QuickJS-NG; Firecracker’s tiny init and bare KVM do not run JavaScript. All VM instances here are independent KVM VMs. Hyperlight sharing within a process does not mean sharing one VM. Snapshot restore is tested for functional resumption/sharing here, not tenant isolation, entropy repair or a production reset contract.

### Current jitk run CPU

The same interleaved 30 samples also send `return 2` after READY, validate `done(2)` and wait for exit 0. All 90/90 jitk/control runs passed. Lifecycle CPU is the VMM cgroup’s total through guest shutdown; it includes boot, the tiny run and teardown.

| Family | Parked return2 p50 ms | Cold return2+exit p50 ms | Mean lifecycle CPU ms |
|---|---|---|---|
| jitk / libkrun (current) | 7.149 | 116.504 | 121.593 |
| jitk / libkrun (THP disabled control) | 6.950 | 114.650 | 119.412 |
| jitk / libkrun (malloc THP off) | 6.885 | 112.940 | 117.154 |

The malloc control removes about 6 MiB while its interleaved cold median stays close to the current build. The spread and nested environment do not justify a throughput/speedup claim. These L1 CPU values are not comparable with the macOS/metal 5 CPU-ms kill line.

Firecracker’s parked idle CPU is nonzero in these nested samples, reaching about 0.44% of one core per restored VM at N=256; jitk, Hyperlight and the bare floor show zero sampled usage in their one-second windows. Tickless Linux does not make this fixture equivalent to a device-free WAIT exit. The source of the Firecracker idle wakeups was not isolated here, and this is not a metal utilization forecast.

## Raw data, validation, and resource cleanup

- [Reduced fits, per-N totals and boot quantiles](raw/summary.json).
- `raw/ledger-<family>-{0,1}.json`: all PIDs/smaps, memory.stat, meminfo, KVM caches and creation/idle CPU.
- `raw/boot-<family>.json`: 30 interleaved cold samples each, with randomized order and per-sample environment.
- [RAM search](raw/fc-ram-search.json), [snapshot identity](raw/snapshot.json), [environment and binary hashes](raw/environment.json), [current jitk build provenance](raw/build.json).
- [Mechanical validation receipt](raw/validation.json): 18 complete curves, all requested N, 270 interleaved boot samples, 90/90 jitk return2/exit-0 checks, no final curve errors.
- [Cleanup receipt](raw/cleanup.json): empty measurement cgroups, zero limit/OOM hits, unchanged snapshot hashes after all restores, and removed build outputs.

The enclosing cgroup peak was 2.680 GiB against the 3.5 GiB cap. Task-owned VM disk use before cleanup was 0.987 GiB, below 1.5 GiB; after deleting Linux source/build output, the Hyperlight target directory and isolated Cargo cache, 246.0 MiB remains, including reported binaries, snapshots, source archive and raw evidence. No VMs are retained.

## Reproduce

All owned VM files live in `/home/dev/a5-linux-ledger/`. Keep the shared benchmark lock and resource cap when reproducing. No commits were made. The harness directory contains the measurement controller, tiny init/kernel build, independent Hyperlight adapter, bare KVM floor, THP control, reducers and report generator. Reported binaries remain under `bin/` and `firecracker/release-v1.17.0-aarch64/` on kvm-dev. Build outputs are removed after measurement.

```sh
# From /Users/noah/code/sofort; existing VM must be running.
kvm-dev/ssh.sh 'cd /home/dev/a5-linux-ledger; bash harness/run-family.sh jitk'
kvm-dev/ssh.sh 'cd /home/dev/a5-linux-ledger; bash harness/run-family.sh jitk-no-thp'
# Firecracker RAM is the measured value in bin/fc-ram-mib.
kvm-dev/ssh.sh 'cd /home/dev/a5-linux-ledger; bash harness/run-family.sh fc-boot "$(cat bin/fc-ram-mib)"'
kvm-dev/ssh.sh 'cd /home/dev/a5-linux-ledger; bash harness/run-family.sh fc-snapshot "$(cat bin/fc-ram-mib)"'
kvm-dev/ssh.sh 'cd /home/dev/a5-linux-ledger; bash harness/run-family.sh hl-process'
kvm-dev/ssh.sh 'cd /home/dev/a5-linux-ledger; bash harness/run-family.sh hl-shared'
kvm-dev/ssh.sh 'cd /home/dev/a5-linux-ledger; bash harness/run-family.sh bare-process'
kvm-dev/ssh.sh 'cd /home/dev/a5-linux-ledger; bash harness/run-family.sh bare-shared'
python3 arch/research/perf/linux-ledger/harness/analyze.py
python3 arch/research/perf/linux-ledger/harness/write-report.py
```

For fresh setup, compile `harness/spawn-cg.c`, `bare-kvm.c`, and `no-thp.c` with `cc -O2`. Enable memory/cpu on a task-owned cgroup parent, set `memory.max=3758096384`, `memory.swap.max=0`, and create a `control` child. Run the Python controller inside `control` using `spawn-cg`, as in `run-family.sh`. Firecracker download URLs/checksum are in the release receipt. Kernel extraction/build require make, clang/lld/llvm, bison/flex/m4/bc; missing build tools were unpacked locally, not installed globally. The Hyperlight adapter’s Cargo manifest and source are in `harness/hl-*`; copy alongside the untouched Hyperlight checkout as `src/hl-ledger/{Cargo.toml,main.rs}`. See exact configs and build logs for the retained guest.

## Findings → recommended changes

1. **Disable glibc malloc THP for the current Linux worker**, initially via `GLIBC_TUNABLES=glibc.malloc.hugetlb=0` before exec: measured saving **5.990 MiB/VM**, about 60.7%, with the guest RAM residency unchanged. This is the largest directly demonstrated change. Prefer this targeted setting to changing global host THP; recheck CPU on metal.

2. **Share the initialized guest image and private-delta snapshot.** After the allocator fix, a 2.789 MiB image is still copied per VM. Sharing exactly those bytes would leave roughly 1.1 MiB/VM including current kernel charges **as an arithmetic estimate, not a measured jitk snapshot result**. Firecracker proves same-file MAP_PRIVATE savings; Hyperlight demonstrates a 0.371 MiB marginal initialized-JS snapshot layout with a fixed shared cost. Preserve late-bound grants/identity and reset gates before using this for tenants.

3. **Keep the independent-VM shard design and fixed owner threads.** The bare shared-process floor is below the 0.5–1 MiB gate-2 budget. Sharding removes process/page-table/stack overhead, but cannot by itself remove an anonymous guest image copied per VM.

4. **Use restore rather than reboot on the hot path.** Firecracker’s same-file snapshot series tests the mechanism directly. Carry the memory result forward; remeasure boot/restore CPU and tail latency on Linux metal.

5. **Retain cgroup + PSS + system/slab accounting in the benchmark.** Wait for memcg statistics to settle, publish fixed/shared costs and peak alongside marginal memory, and reserve hostile-guest peak rather than extrapolating idle averages.
