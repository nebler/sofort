# Gate 0 — current jitk macOS memory + CPU ledger

2026-10-25 · owner `w0-ledger-mac` · writes restricted to this directory · no commits.

**Gate 0 remains OPEN.** The current precompiled-sandbox, RAW-direct-load build costs **7.86694 MiB marginal process footprint per READY VM**, **7.89986 MiB during one_tool wait**, **Page tables (0.35026 MiB/VM) are already inside footprint.** `tkm_private` reports 0.31855 MiB/VM but overlaps page-table accounting and is not additive. Resource cost is **1.00107 MiB per added MiB**. The apparent missing ~3 MiB is reproducible with guest writes invisible to host mapping summaries; it must not be labeled a fixed libkrun heap or fixed HVF VM allocation.

Two required pieces cannot be certified on this host: N=64/256 are unreachable, and system-wide HVF/kernel allocation attribution is below the background-noise floor. Exact limitations are below; no density claim follows.

## Inputs, environment, and method

Apple M4 Pro (`Mac16,8`), 12 cores, 24 GiB; macOS 26.6.1 / 25G76, HVF, 16 KiB host pages. Node `/tmp/jitk-09/node-real` v24.22.1, Python 3.15. Every measurement batch ran inside `/usr/bin/lockf -k /tmp/sofort-bench.lock`; supplemental N=60 cells released the lock individually for other agents. Memory-cell load1 ranged **14.86–48.02**; CPU load1 **32.73–34.41**. These are **contended measurements**, not a rerun of the quiet table. UTC times, uptime, load, commands and their output are retained.

Frozen inputs are retained under [`artifacts/`](artifacts/), with sources, sizes and SHA-256 in [`selection.json`](artifacts/selection.json):

| input | source / SHA-256 |
| --- | --- |
| VMM | `/tmp/jitk-fs-work/vmm/jitk-vmm`; `2e3cfb02b0ab7cba9fc460694863ca45d6c2b0800f37dcf44d642c5a560e4e77` |
| current image, 2,924,584 B | `kernel/dist/kernel.bin`; `6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6` |
| resource images | existing `/tmp/jitk-fs-work/fsb/img-{0,1,8}/kernel.bin`, 2,924,613 / 3,973,313 / 11,314,213 B |
| executor | frozen existing build, before the concurrent executor optimization; `build/code.js` = `8542ca147509d9bce0f330b857a2565377b488f3ae37b1e3db00bf2674b5d7c6` |

[`build.json`](artifacts/build.json) confirms `raw-direct-load.diff` plus the existing robustness, thread hook, control RX and native-build patches. This is the existing filesystem benchmark's direct-load artifact, with the canonical benchmark's **precompiled Seatbelt profile** and native watchdog. `/tmp/jitk-01/r3/` and `/tmp/jitk-mcp-work/` were read only; their recorded builds predate RAW direct loading. The older quiet table is historical comparison, not an interchangeable binary provenance claim.

Memory: three independent cells per image/count, both READY and in-flight one_tool states. Requested counts 0/1/16/64/256; supplemental count 60. Every VM must produce READY and the host sandbox acknowledgement. Every successful VM then receives the canonical `return await test.echo(2);`, emits one validated call, waits while measurements run, receives `ret(2)`, and returns validated `done(2)`. The held reply makes a measurable **tool-wait** state; an immediate run's transient maximum is sampled separately by libproc lifetime peaks in CPU raw data. This is not a claim of continuous peak sampling.

All PIDs have libproc RSS/footprint/peak and all read-only task ledger balances. First-pass `footprint` JSON contains every PID's categories. vmmap summaries, malloc-zone tables, full address maps and `--vmObjectDirty` diagnostics sample first/middle/last PIDs across every repeated cell. `--details all` collects every individual vmmap. Counters are saved before diagnostics and again after; residency can change during collection. Every cell has full `vm_stat`, non-stressing `memory_pressure -Q`, and `sysctl vm` before/at both states/after teardown. System deltas use state minus the midpoint of the before/after snapshots.

## Requested scale and the observed allocation limit

| requested concurrent READY VMs | observations per image | result |
| --- | --- | --- |
| 1 | 3 | all passed |
| 16 | 3 | all passed |
| 64 | 3 | all failed at the 62nd additional worker; 61 had reached READY |
| 256 | 3 | all failed at the 62nd additional worker; 61 had reached READY |
| 60, supplemental | 3 | all passed |

The failure is exactly `jitk-vmm: boot error: Internal(Vm(VmSetup(VmCreate)))` after sandbox acknowledgement. There are **24 retained failed attempts** across four image variants; every attempt had 61 READY VMs and the next process exited. This establishes this session's available HVF allocation limit, not a measured N=64/256 memory point or a proven universal OS limit. Other VMs, the MCP server and kvm-dev were left running. `kern.hv.max_address_spaces=128` is recorded; it was not treated as permission or proof that 256 VM instances were available.

## Memory totals, slopes, and shared/fixed cost

Memory totals, median over three independent cells; MiB. Footprint includes logical compressed memory.

| image | N | READY footprint sum | READY RSS sum | READY compressed sum | tool-wait footprint sum | tool-wait RSS sum | tool-wait compressed sum |
| --- | --- | --- | --- | --- | --- | --- | --- |
| current | 1 | 7.860 | 12.547 | 0.000 | 7.891 | 7.266 | 5.312 |
| current | 16 | 125.961 | 192.500 | 8.312 | 126.492 | 115.594 | 85.938 |
| current | 60 | 472.028 | 487.578 | 265.375 | 474.044 | 433.719 | 321.094 |
| 0 | 1 | 7.844 | 12.547 | 0.000 | 7.875 | 7.234 | 5.344 |
| 0 | 16 | 125.945 | 200.859 | 0.000 | 126.445 | 115.812 | 85.562 |
| 0 | 60 | 471.997 | 751.875 | 0.000 | 473.888 | 446.922 | 306.891 |
| 1 | 1 | 8.860 | 13.547 | 0.000 | 8.891 | 7.281 | 6.297 |
| 1 | 16 | 142.054 | 209.047 | 8.156 | 142.554 | 116.219 | 101.266 |
| 1 | 60 | 533.106 | 544.547 | 269.734 | 535.028 | 436.016 | 380.188 |
| 8 | 1 | 15.922 | 20.594 | 0.000 | 15.954 | 7.281 | 13.312 |
| 8 | 16 | 254.242 | 253.766 | 75.422 | 254.726 | 116.734 | 212.938 |
| 8 | 60 | 952.903 | 864.094 | 369.406 | 954.825 | 437.547 | 798.141 |

OLS total = intercept + N × marginal, across N=0/1/16/60 and all repeats; MiB.

| image/state | footprint marginal | footprint intercept | RSS marginal | page-table marginal | tkm_private marginal (overlaps) |
| --- | --- | --- | --- | --- | --- |
| 0/ready | 7.86253 | 0.03945 | 11.34914 | 0.35098 | 0.31927 |
| 0/one_tool_wait | 7.89449 | 0.03754 | 7.44691 | 0.35098 | 0.31927 |
| 1/ready | 8.88224 | -0.01579 | 9.35459 | 0.35040 | 0.31868 |
| 1/one_tool_wait | 8.91429 | -0.01956 | 7.59401 | 0.35040 | 0.31868 |
| 8/ready | 15.87855 | 0.05780 | 14.00471 | 0.35169 | 0.31997 |
| 8/one_tool_wait | 15.91042 | 0.05631 | 7.28391 | 0.35169 | 0.31997 |
| current/ready | 7.86694 | 0.01831 | 8.24450 | 0.35026 | 0.31855 |
| current/one_tool_wait | 7.89986 | 0.01612 | 7.27561 | 0.35026 | 0.31855 |

System bracket deltas at N=60, per VM: median [min,max] over three cells; MiB.

| image/state | wired | compressor physical | anonymous resident | file-backed resident |
| --- | --- | --- | --- | --- |
| current/ready | 0.509 [0.400,1.108] | 6.010 [-1.370,9.416] | -7.723 [-9.268,1.075] | -0.334 [-0.483,1.877] |
| current/one_tool_wait | 0.447 [0.139,1.093] | 4.921 [3.165,8.247] | -8.732 [-9.574,-2.120] | 0.069 [-2.815,5.850] |
| 0/ready | 0.114 [-0.761,1.085] | 5.846 [-3.926,12.471] | -3.717 [-11.529,6.326] | -0.929 [-3.259,1.434] |
| 0/one_tool_wait | 1.316 [1.184,1.717] | 6.977 [0.284,9.231] | -8.121 [-9.349,3.017] | -1.528 [-2.914,1.153] |
| 1/ready | -1.075 [-1.590,2.262] | 5.871 [5.257,8.933] | -4.798 [-9.021,-4.697] | 0.853 [-0.481,2.441] |
| 1/one_tool_wait | 2.533 [-0.088,3.472] | 1.862 [-1.916,4.871] | -3.886 [-7.288,1.639] | -0.315 [-0.695,0.673] |
| 8/ready | 1.149 [-0.656,2.112] | 8.876 [1.182,10.805] | -5.803 [-8.099,5.962] | -1.110 [-1.762,-0.942] |
| 8/one_tool_wait | 3.298 [0.578,4.750] | 5.397 [3.634,6.927] | -4.871 [-9.004,-1.869] | 0.657 [-0.634,2.684] |


The current-image READY slope is **8,249,083.9 bytes/VM (7.86694 MiB)**; use `summary.json` for unrounded bytes. Its three separate-repeat slopes are **7.86069 / 7.87270 / 7.86743 MiB/VM**. The intercept **0.01831 MiB** is an intercept of the *sum of task footprint charges*, not an estimate of all shared host memory. `tkm_shared` was zero in these VMM snapshots. **Do not add the 0.31855 MiB `tkm_private` slope to footprint:** [XNU pmap allocation](https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/arm/pmap/pmap.c#L3446) credits the same page-table allocation to both the footprint/page-table ledgers and `tkm_private`. This overlaps rather than establishing another 0.32 MiB of host memory. No disjoint all-in kernel subtotal is available.

The all-PID footprint graph at N=16 reports **655,360 B (0.625 MiB) of unique visible clean mappings**, shared among the workers: 557,056 B `__TEXT`, 81,920 B mapped files and 16,384 B `__LINKEDIT`. Global dyld shared-cache residency is not fully represented by that number. The image itself is read into anonymous guest RAM; resources have no independent file-backed shared mapping. Summed RSS includes shared pages repeatedly and is not unique host RAM. The fixed Node process in the CPU adapter measured **18.99 MiB at collection start / 38.24 MiB at end**; the production native watchdog ended at **1.625 MiB**. These are shared-service observations, not per-VM slopes or a production Node peak guarantee.

Immediate one_tool runs (same current image; libproc lifetime footprint peak at DONE, not an instantaneous RSS peak):

| path | n | p50 peak MiB | max peak MiB | p50 increase over READY KiB | max increase KiB |
| --- | --- | --- | --- | --- | --- |
| raw/cold | 30 | 7.859833 | 7.906731 | 32.0 | 64.0 |
| raw/parked | 30 | 7.852032 | 7.891106 | 32.0 | 96.0 |
| executor/cold | 30 | 7.922333 | 7.969231 | 48.0 | 80.0 |
| executor/parked | 30 | 7.922344 | 7.969231 | 48.0 | 64.0 |

Current-image per-process medians, with separate residency/dirty/swapped views (MiB):

| state | primary PIDs | libproc RSS | ledger internal resident charge | ledger compressed logical charge | sampled vmmap PIDs | vmmap total DIRTY | vmmap total SWAPPED |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ready | 228 | 8.390625 | 3.351562 | 4.164062 | 18 | 0.531250 | 4.320312 |
| one_tool_wait | 228 | 7.218750 | 2.187500 | 5.359375 | 18 | 0.531250 | 4.320312 |

The vmmap columns are captured later than the primary counters; they are rounded mapping totals and miss the guest-owned pages discussed below. Its SWAPPED means compressed-or-swapped mapping bytes, not physical swap-file occupancy. Per-process `wired` from libproc was zero; the separate charged page-table ledger is nonzero. Individual resident/dirty/swapped figures and malloc zones for every sampled map remain in `raw/`.

### Region and ownership ledger

For the current image, n=18 sampled VMMs per state (first/middle/last at N=16/60 across three repeats), median logical dirty+swapped mapping sizes:

| component | READY MiB | tool-wait MiB | attribution |
| --- | --- | --- | --- |
| 32 MiB guest RAM mapping, host-visible pages | 2.8125 | 2.8125 | image/raw-loader guest backing; full map identifies the exact 32 MiB range |
| other shared mappings | 0.046875 | 0.046875 | separate from guest RAM; do not call this guest heap |
| malloc zones, dirty+swapped | 0.671875 | 0.679688 | aggregate libkrun + launcher + system-library allocations; not all libkrun |
| malloc bytes actually allocated | 0.193359 | 0.193359 | subset of zone backing, not additive |
| thread stacks, six mappings | 0.125 | 0.125 | libkrun/device/vCPU/host threads; ~16.6 MiB virtual stack space, plus guards |
| page table in kernel | 0.359375 | 0.359375 | already charged to process footprint; count-specific marginal ~0.350 MiB |
| `__DATA` / `__DATA_DIRTY` | 0.136719 / 0.358398 | same | launcher/framework/system-library writable data |
| `__DATA_CONST` / `__TPRO_CONST` / `__AUTH` | 0.031250 / 0.046875 / 0.000412 | same | writable/private portions; dyld accounting applies |
| unused dirty shlib data | 0.122070 | 0.122070 | system-library mapping category |
| footprint auxiliary minus categorized footprint | **3.078125** | **3.109375** | owned anonymous charge missing from host mapping categories; see controlled reproduction |

Malloc subcategories at READY: SMALL 0.265625 MiB, TINY 0.109375, metadata 0.296875, NANO metadata 0.015625. Table medians are independent and should not be added as though they were one exact process. Raw per-PID categories are exact byte counts; vmmap labels and sizes can be rounded.

**All 1,848 primary VMM counter snapshots reconcile with zero bytes of error** using the OS task-ledger formula:

`internal - alternate_accounting + internal_compressed - alternate_accounting_compressed + iokit_mapped + purgeable_nonvolatile + purgeable_nonvolatile_compressed + page_table`.

The read-only ledger key for the last compressed purgeable field is truncated by the OS template. This accounting is documented by [Apple's task-ledger definitions](https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/kern/task.c#L1139); the formula was independently checked against this machine's actual libproc footprint. Compressed balances are logical bytes and may include paged-out compressed memory. They are not physical compressor storage and must not be added again to footprint.

### What the ~3 MiB gap means — controlled measurements

`--wait-go` stops this exact production VMM after confinement and launcher/device setup but before `builder.build()`. n=16 × three repeats:

| state | mean-per-cell footprint, median across repeats |
| --- | --- |
| prebuild | 1.53743 MiB |
| READY | 7.87546 MiB |
| one_tool wait | 7.90867 MiB |

The prebuild mapped-region gap is about one page of tool rounding/accounting; the ~3 MiB discrepancy appears after construction/boot. Kernel-private allocation rises from **224 KiB to about 320–336 KiB**, page tables from about **240 KiB to 352–368 KiB**. The launcher/console setup is therefore not the missing 3 MiB.

A separate, small **allocation control** calls HVF APIs directly, loads the same image but does not boot jitk, creates one vCPU, then runs six ARM64 instructions that zero exactly 3 MiB of previously host-untouched mapped RAM. X0 must reach the end address before the control accepts the run. n=3; code/binary/raw retained. Median step deltas:

| operation | process-footprint delta B | tkm_private delta B (overlaps) |
| --- | --- | --- |
| `hv_vm_create` | 98,328 | 16,384 |
| reserve 32 MiB anonymous RAM | 0 | 0 |
| read current image into RAM | 2,949,144 | 16,384 |
| `hv_vm_map` | 0 | 0 |
| `hv_vcpu_create` | 81,968 | 32,768 |
| guest zeros 3 MiB | **3,178,520** | 16,384 |

Guest-zeroing adds **3,162,112 B internal+compressed charge** (3 MiB plus one 16 KiB page of first-run effects), plus **16,408 B of page-table charge**. Host mapping summaries fail to expose most guest-touched pages. Thus a host vmmap dirty scan is not a guest physical-page census. The `tkm_private` column is a second accounting view and must not be added to footprint; page-table charges overlap. The control disproves treating the whole production gap as the minimum fixed process-footprint cost of `hv_vm_create`/vCPU creation. Its counters do **not** bound HVF allocations outside process/task accounting, and the bare control omits libkrun's GIC/devices.

**Inference, not an address-resolved measurement:** the production gap is predominantly guest-dirtied backing pages invisible in the host pmap. Visible guest mapping (2.8125 MiB) plus the missing 3.078125 MiB gives approximately **5.890625 MiB of guest backing at READY**, versus only 2.789 MiB of image bytes. The precise address/owner split of that 3.078125 MiB is still unavailable: it is **39.1% of current process footprint** if the inference is not accepted. `footprint --unmapped` returned **77, “Must run as root.”** [`footprint-detail-probe.txt`](footprint-detail-probe.txt) retains the failure. No root access or host settings were changed. This is a precise component-attribution gap, despite zero unexplained task-ledger bytes.

### Resource slope and launch-mode control

OLS on the three per-VM count slopes at resources 0/1/8 MiB gives **1.001071 MiB/MiB**, intercept 7.871227 MiB/VM, maximum point residual 0.009942 MiB/VM. The 8-vs-0 endpoint is **1.002003 MiB/MiB**. This corroborates the **one private copy per resource byte** result in `kernel/RESULTS-fs.md`; it does not certify the exact Linux +0.997 coefficient on macOS (difference about 0.4%). Counts beyond 60 could not be tested. Resource bytes were not read by the snippet; they were copied during image loading.

The filesystem benchmark's host adapter omits `--sandbox-profile`, so it compiles Seatbelt inside each VMM. Our explicit inline-compilation control (three repeats at N=1/16) measures median **10.4849 MiB/VM at N=1** and **10.5650 MiB/VM at N=16**, versus about 7.86–7.88 MiB precompiled. Difference at N=16: **~2.69 MiB/VM** (launch-mode comparison, not a paired causal estimator). This explains why its “direct-load” absolute footprint is ~10.5 MiB while this canonical precompiled-profile launch is ~7.9 MiB. The resource slope survives either launch mode. No new latency claim is made for this control.

### Exactly what remains unmeasured system-wide

At N=60, READY wired delta is 0.509 MiB/VM for the current image but ranges **0.400–1.108** across repeats. Other resource cells include negative wired deltas; null N=0 controls span **−199.10 to +193.88 MiB** of bracketed wired-memory noise. System compressor and anonymous-resident deltas can move in opposite directions as unrelated processes page in/out. The table above preserves these outcomes rather than calling a negative number “negative HVF cost.” Full `sysctl vm`, swap/compressor counters and `memory_pressure` output are retained in every cell.

Missing: address-resolved unmapped guest backing; HVF VM/vCPU/GIC/stage-2 allocations not charged to a process or `tkm_private`; separation of those from general kernel allocator/cache growth; unique global shared-cache residency; physically compressed versus swapped-out portions of each task's combined compressed ledger. vmmap's SWAPPED column includes compressed/swapped mappings and does not give that physical split. A privileged allocation/region census on a quiescent host is needed to close those items. **There is no defensible ≤10% all-system residual or all-in HVF memory number here.** Do not add the noisy wired delta to footprint: page tables overlap, and footprint includes logical nonresident charges.

## CPU per run, with boot, execution, teardown and watchdog

30 complete rotating blocks × raw/executor × cold/parked × return2/one_tool = **240 validated runs**. The frozen executor is the pre-optimization baseline. The production policy/executor path is used for executor rows; raw rows use the same protocol with a minimal Node adapter. Cold means fresh VMM; Node startup/import is shared and excluded, matching the existing benchmark. Parked VM boot is outside response latency but **charged here to lifecycle CPU**. Pool refill was disabled after preparation so no unmeasured replacement VM can contaminate a sample; lifecycle includes one boot and one cleanup per admitted single-use VM.

Live phase CPU uses libproc; total VMM CPU uses Node's native `getrusage(RUSAGE_CHILDREN)` difference through reap. Node CPU uses `getrusage(RUSAGE_SELF)`. **libproc CPU fields are Mach ticks on this host**, converted with **125/3 ns per tick**; they are not interpreted directly as nanoseconds. Boot = spawn→READY, execute = RUN→validated DONE, teardown = DONE→reap. The brief idle gap is retained separately in raw timestamps/counters. Node cold execute subtracts its measured boot wait/setup; teardown is result→pool close/reap. VMM teardown includes forced kill/reap where necessary. User/system columns below are separate medians; their sum need not equal the median of the total.

### VMM CPU

Each cell is **user / system (total) CPU-ms**, n=30.

| path/mode/case | boot CPU-ms | execute CPU-ms | teardown CPU-ms | lifecycle CPU-ms |
| --- | --- | --- | --- | --- |
| raw/cold/return2 | 5.902 / 4.505 (10.480) | 0.546 / 0.153 (0.754) | 0.074 / 0.757 (0.938) | 6.680 / 5.251 (11.886) |
| raw/cold/one_tool | 6.038 / 4.460 (10.657) | 0.842 / 0.248 (1.118) | 0.123 / 0.818 (1.040) | 7.099 / 5.154 (12.877) |
| raw/parked/return2 | 6.215 / 4.449 (11.002) | 0.684 / 0.186 (0.858) | 0.077 / 0.518 (0.698) | 7.038 / 5.283 (12.605) |
| raw/parked/one_tool | 5.924 / 4.504 (10.404) | 0.862 / 0.306 (1.170) | 0.086 / 0.785 (0.874) | 7.103 / 5.520 (12.833) |
| executor/cold/return2 | 6.161 / 5.013 (11.302) | 1.523 / 0.266 (1.828) | 0.249 / 0.794 (1.086) | 7.873 / 5.878 (14.110) |
| executor/cold/one_tool | 6.074 / 4.826 (11.151) | 2.160 / 0.396 (2.649) | 0.217 / 0.818 (0.987) | 8.907 / 6.026 (15.321) |
| executor/parked/return2 | 6.408 / 4.938 (11.510) | 1.587 / 0.285 (1.823) | 0.234 / 0.800 (1.001) | 8.543 / 5.886 (14.918) |
| executor/parked/one_tool | 6.299 / 4.752 (11.123) | 1.724 / 0.375 (2.126) | 0.268 / 0.329 (0.785) | 8.928 / 5.704 (14.736) |

### Executor / Node CPU

Each cell is **user / system (total) CPU-ms**, n=30. “Raw” is the measurement-side minimal Node adapter, not the production executor.

| path/mode/case | boot CPU-ms | execute CPU-ms | teardown CPU-ms | lifecycle CPU-ms |
| --- | --- | --- | --- | --- |
| raw/cold/return2 | 0.621 / 0.550 (1.192) | 0.237 / 0.050 (0.287) | 0.262 / 0.089 (0.355) | 1.211 / 0.710 (1.993) |
| raw/cold/one_tool | 0.590 / 0.528 (1.152) | 0.316 / 0.090 (0.410) | 0.297 / 0.092 (0.395) | 1.231 / 0.733 (2.025) |
| raw/parked/return2 | 0.611 / 0.574 (1.282) | 0.273 / 0.070 (0.342) | 0.257 / 0.089 (0.349) | 1.251 / 0.800 (2.045) |
| raw/parked/one_tool | 0.648 / 0.567 (1.243) | 0.391 / 0.104 (0.510) | 0.261 / 0.090 (0.347) | 1.507 / 0.813 (2.362) |
| executor/cold/return2 | 0.585 / 0.557 (1.139) | 0.615 / 0.098 (0.708) | 0.459 / 0.101 (0.565) | 1.730 / 0.791 (2.576) |
| executor/cold/one_tool | 0.591 / 0.548 (1.162) | 0.929 / 0.138 (1.071) | 0.483 / 0.108 (0.586) | 1.942 / 0.796 (2.819) |
| executor/parked/return2 | 0.534 / 0.525 (1.069) | 0.709 / 0.118 (0.832) | 0.459 / 0.108 (0.562) | 1.990 / 0.852 (2.928) |
| executor/parked/one_tool | 0.523 / 0.522 (1.079) | 0.999 / 0.161 (1.169) | 0.488 / 0.103 (0.597) | 2.299 / 0.841 (3.196) |

### Service CPU, including native watchdog

Native watchdog lifetime CPU (startup + all registrations/arms/exits + shutdown) was **13.926 CPU-ms for 120 raw runs**, and **13.899 CPU-ms for 120 executor runs**. Amortized cost is **0.11605 / 0.115825 CPU-ms per run**, respectively. Steady sampled watchdog deltas are about 0.042–0.057 CPU-ms/run; the first cold-executor steady delta is unavailable because its watchdog did not yet exist (n=29 for that one steady column in `cpu-summary.json`). The lifetime-amortized totals below include that startup and shutdown exactly once.

Service = per-sample VMM lifecycle + per-sample Node lifecycle + the corresponding full watchdog lifetime / 120; **no boot cost is omitted from parked rows**.

| path/mode/case | service p50 CPU-ms | mean CPU-ms | min–max CPU-ms |
| --- | --- | --- | --- |
| raw/cold/return2 | 14.074 | 14.878 | 11.921–22.954 |
| raw/cold/one_tool | 15.381 | 15.656 | 11.230–22.395 |
| raw/parked/return2 | 14.904 | 15.879 | 11.629–22.755 |
| raw/parked/one_tool | 15.575 | 16.107 | 12.651–25.167 |
| executor/cold/return2 | 16.719 | 18.167 | 14.890–28.026 |
| executor/cold/one_tool | 18.738 | 19.129 | 15.102–25.514 |
| executor/parked/return2 | 18.299 | 18.752 | 14.355–26.011 |
| executor/parked/one_tool | 18.935 | 19.507 | 14.961–28.167 |

Observer cost: 1,000 live libproc calls cost 3.565 CPU-ms and 3.770 wall-ms in this run (**~3.6 µs CPU/call**). Per-phase native snapshots and event hooks add small positive overhead; results are instrumented CPU accounting, not an uninstrumented latency benchmark. Node startup/import CPU was 135.6 CPU-ms at the collection-start snapshot, outside per-VM rows. Node filesystem serialization of raw evidence between blocks is also outside run boundaries.

CPU attribution limits: Node user/system and watchdog user/system are directly measured process accounts. VMM boot user/system jointly include our launcher, libkrun, Hypervisor.framework and guest boot; execution jointly includes guest JS/kernel, console/event handling and hypervisor transitions; system time includes host-kernel work. These aggregate counters **cannot** split guest instructions, libkrun instructions, our Rust instructions and HVF kernel work. The bare control bounds only its own process charges. There is no causal per-library CPU number in this ledger; use a sampled/traced profile for that split. The current contended 11–15 CPU-ms VMM lifecycle must not replace the quiet build's historical ~5 CPU-ms result without the environment/build qualifiers.

## Evidence, reproduction, verification

- Entry points: [`ledger.py`](ledger.py), [`ledger.mjs`](ledger.mjs), [`ledger_native.c`](ledger_native.c); Linux/Asahi support reads `/proc` and native getrusage, with Linux live phase resolution limited by CLK_TCK. macOS and Linux memory metrics are not equated.
- Exact commands and addon build: [`README.md`](README.md). `waves.py` releases the lock after every supplemental cell. `hvf_control.c` / `hvf_control.py` implement the independent allocation control, not a production runtime path.
- Raw index: [`raw.json`](raw.json). Primary raw: [`memory-raw.json`](memory-raw.json), [`memory-n60-raw.json`](memory-n60-raw.json), [`memory-combined.json`](memory-combined.json), [`cpu-raw.json`](cpu-raw.json), [`controls-raw.json`](controls-raw.json), [`inline-raw.json`](inline-raw.json), [`hvf-control-raw.json`](hvf-control-raw.json). `raw/` contains every footprint/vmmap diagnostic referenced by those JSON files.
- Derived results: [`summary.json`](summary.json), [`cpu-summary.json`](cpu-summary.json), [`TABLES.md`](TABLES.md). `python3 report.py` regenerates numeric tables; the interpretation in this report is reviewed prose.
- [`verification.json`](verification.json): **PASS**; 48 successful memory cells, 24 retained capacity failures, 1,848 exact primary footprint-ledger reconciliations, 240 successful CPU fixtures, three HVF controls, no owned worker processes remaining. Measurement-source syntax checks pass. No production code was edited, so no production rebuild or root test suite was necessary. Failed collector smoke attempts (serialization, sandbox-ack pipe ordering, and unreferenced-watchdog cleanup) were corrected before final collection; the failed ack JSON and smoke artifacts remain outside the final sample sets.
- Scope disk use at validation: **~138 MiB**, well below 1.5 GiB. No downloaded sources, toolchain changes, cloud work, commits, or modifications to other agents' paths.

## Findings → recommended changes

1. **Use a shared prepared image and eliminate per-run boot.** The current image is 2.789 MiB and each resource MiB costs another ~1.001 MiB per VM; READY guest backing is inferred near 5.89 MiB. VMM boot alone costs ~10.4–11.5 CPU-ms in this contended run. File-backed CoW + restore targets both dominant costs; these are savings opportunities, not measured performance of the new runner.
2. **Census guest pages ever dirtied, including pages whose contents are zero at checkpoint.** Known 3 MiB guest zeroing reproduced a +3.03 MiB footprint change invisible to host mapping categories. An all-zero or freed guest page still has private backing until reclaimed. Measure zero-page elision and discard/reset against footprint/ownership, not only nonzero-byte counts. Potential scale is ~3 MiB/VM here, but the exact production gap still needs address resolution.
3. **Preserve precompiled Seatbelt profiles.** Inline profile compilation retains ~2.7 MiB/VM in this control. This is already avoided by the canonical launch; new runner measurements must not silently reintroduce it or compare against the inline baseline.
4. **Remove executor per-run preparation costs with paired CPU gates.** Parked one_tool is 1.170 VMM execution CPU-ms + 0.510 Node CPU-ms on the raw path, versus 2.126 + 1.169 through the frozen executor. This descriptive gap supports the prelude/codec gate; it is not a causal estimate of one function. Include cleanup/refill CPU: response CPU alone understates sustained service cost.
5. **Keep independent watchdog accounting and admission.** Production watchdog full amortized CPU is ~0.116 ms/run and fixed footprint ~1.63 MiB. Deleting it cannot recover the ~11 ms boot cost. HVF creation failed at the 62nd available extra worker; the macOS worker pool needs explicit admission/failure handling, and this host cannot validate N=64/256.
6. **Close the remaining all-system ledger before density claims.** Retain ~0.35 MiB/VM of page tables already in footprint, cross-check the overlapping ~0.32 MiB `tkm_private` ledger, then measure disjoint privileged HVF/system charges on a quiet host. Do not transfer these macOS charges or the observed allocation limit to the Linux shard budget.
