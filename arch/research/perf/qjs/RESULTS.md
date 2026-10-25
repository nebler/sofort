# QuickJS snapshot dirty-page census — gate 3

Measured 2026-10-25 by `w3-qjs-mem`, natively on Linux arm64 in `kvm-dev`.

**Verdict: the tiny fixtures support the 655,360–786,432 B QuickJS allocation, but it is not a defensible bound for a class admitting 64 KiB of serialized structured JSON, or the canonical 8 KiB source-ingress path at equivalent 16 KiB granularity.** The 64 KiB case writes at least **946,176 B across the run** at 4 KiB granularity, or **1,081,344 B** after grouping the observed pages into aligned 16 KiB blocks. Canonical 8 KiB source ingress writes **757,760 / 868,352 B**. The 1 MiB case writes at least **9,363,456 / 9,535,488 B**. Gate 3's *all-in ≤2 MiB* condition remains unproven: this is a runtime proxy, without KVM, guest page tables, rings, or broker charges.

Tiny code remains promising: one codec/tool call writes **270,336 / 393,216 B**, and 10 concurrent-shaped calls **299,008 / 425,984 B**, at 4 KiB / equivalent 16 KiB granularity. The exact canonical raw-frame comparison below quantifies the additional ingress work.

## What was built and run

- Host: Apple M4 Pro, 12 cores, 24 GiB; Ubuntu 26.04.1 arm64 `kvm-dev`, kernel `7.0.0-38-generic`, 6 vCPU, 9 GiB, **4,096 B pages**. Native processes inside the VM; no additional guest/KVM run in this experiment. All timings are virtualized/nested-host indications, not Linux metal or guest restore claims.
- Engine: pinned Bellard **2026-06-04**, source SHA-256 `b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a`. GCC 15.2.0, static aarch64 ET_EXEC, `-O2 -g -fwrapv -fno-strict-aliasing`, local **musl 1.2.5 mallocng**. See `all-hashes.txt`, build scripts, and ELF metadata in the evidence. These are rebuilt C embedders, not bit-identical copies of the stripped guest executable.
- The actual `kernel/payload/qjs` was copied unchanged, SHA-256 `ea2367e9dfc7484b6ad6d551b0bbc25d0247e2781f49ad822fa04c2753f80341`; its banner confirms the pinned version. Native `--std --memory-limit 16777216 -e <canonical bootstrap>` passes `ready → run(return 2) → done(2)` (n=1). Parked RSS/PSS/Private_Dirty: **1,769,472 / 1,761,280 / 356,352 B** (`shipped-calibration.json`). That standalone process owns its clean executable pages; its PSS is not a per-slot snapshot delta.
- Same runtime/context initialization, std/os modules, helpers, module loader and rejection tracker as `qjs --std`; exact canonical bootstrap input hash `60f121f1e3fb24ee971851f162c511188ca6a7256e91e7af47974b1f75afb280`. The observer changes only `std.exit(status)` into a completion hook and adds a success-status hook to `finish`; the latter checks JS error frames because protocol errors can exit status 0.
- Executor codec input hash `731af9e407afbaf004de467ec7eb802036cb70e420818f8c155cad7f39a48b7e`. It is wrapped in an IIFE and installed **before fork**, the intended prepared-state design. The current executor reparses it per run; that comparison is measured separately below. Memory limit remains 16 MiB; reference counting stays enabled in every experiment.

All writes are confined to this report's scope, `/home/dev/w3-qjs-mem/`, and `/tmp/sofort-w3/`. No commits or shipping-code edits were made. Timing commands use `flock /home/dev/bench.lock`; the non-timed memory-only census can run while other agents own that lock, and its incidental clocks are not used for CPU conclusions. Every batch records `/proc/uptime`, load averages, input/options and binary hash. The main memory matrix had load1 approximately **4.04–16.21**, and the initial locked timing matrix **0.96–1.94**; exact supplemental/interleaved batch values are retained.

## Method and accounting

Initialize runtime, context, std/os, bootstrap and codec; keep the initialized JS state unchanged in the parent; fork one child per run. Native parent control-stack/libc activity is covered by the empty-child control. No JS heap teardown occurs in the child before its final sample. External Python is an offline observer, not a per-call runtime component.

The child stops at initial restore, after issuing pending calls, while structured objects and the serialized result are live, before any ≥16 KiB host-allocator free/realloc, and after completion. The allocation observers use the stock Linux QuickJS malloc callbacks with the same mallocng backend; separate timing runs use uninstrumented allocation callbacks and no stops. The large-buffer hooks catch transient memory that disappears before the live/final checkpoints.

At each stop read `smaps_rollup`, `/proc/PID/stat` (minor/major faults), maps and pagemap. Enumerate present, anonymous, exclusively owned pages in private writable VMAs. Soft-dirty bits remained zero on this arm64 kernel; **pagemap bit 56 (exclusive), with present/anonymous bits, is the working fallback**. At **6,200 non-template sampled points**, this page census reconciles with `Private_Dirty` with **zero mismatches**; write-site instrumentation lives in a separately prefaulted shared mapping. The final archive/summary contains **253 complete measurement cells**, verified against expected child/init counts.

Two quantities matter:

1. **Peak resident private bytes**: maximum instantaneous `Private_Dirty`.
2. **Observed dirty-address union**: union of private page addresses across all checkpoints, including addresses later unmapped. This is a **measured lower bound on all pages written**, not a proof that no shorter-lived allocation escaped observation. Read/code faults and remapping make minor faults an upper-envelope diagnostic, not an exact CoW count. The raw data retain every sampled address and the larger `start_private + 4096 × minflt` envelope.

The union is the more relevant proxy for a VM snapshot delta. Current `kernel/src/syscalls/munmap.rs` clears stage-1 PTEs, and `mmu.rs:unmap` only zeroes a PTE; neither informs the host to discard dirty stage-2 backing. `mmap.rs` also eagerly zeroes complete mappings, while native Linux can leave untouched pages nonresident. Therefore final native RSS/Private_Dirty can **understate guest snapshot writes**. Guest first-fit mapping, address placement and kernel writes still need a real stage-2 dirty log. Native address reuse can also differ from guest address reuse.

16 KiB figures are calculated as `16384 × count(unique(page_address >> 14))`, not by multiplying 4 KiB bytes by four. They group this exact 4 KiB layout, including alignment/fragmentation. They are **not measurements on Asahi/macOS 16 KiB pages**; a real 16 KiB allocator/layout can differ.

## Per-workload dirty-byte census

Medians of **30 children from three independently initialized templates**, 10 children each. Three templates are the independent layout samples; 30 children are not 30 independent heap layouts. Bytes below include native stack, libc and observer control state as a conservative runtime envelope; do not add those stack bytes again when combining guest budget rows. Empty-child control overhead is retained, not subtracted.

| Workload | 4 KiB pages in observed union | Dirty bytes, 4 KiB | 16 KiB blocks in observed union | Dirty bytes, 16 KiB equivalent | Peak `Private_Dirty` (4 KiB) | PSS at peak | Minor faults |
|---|---:|---:|---:|---:|---:|---:|---:|
| Empty child (no JS) | 3 | 12,288 | 2 | 32,768 | 12,288 | 323,584 | 1 |
| `return 2` | 61 | 249,856 | 25 | 409,600 | 249,856 | 813,056 | 131 |
| One tool + binary codec | 66 | 270,336 | 24 | 393,216 | 270,336 | 823,296 | 143 |
| `Promise.all(10)` | 73 | 299,008 | 26 | 425,984 | 299,008 | 845,824 | 148 |
| 8 KiB source parse/run | 89 | 364,544 | 30 | 491,520 | 356,352 | 911,360 | 194 |
| 64 KiB structured JSON | 231 | 946,176 | 66 | 1,081,344 | 786,432 | 1,386,496 | 357 |
| 1 MiB structured JSON | 2286 | 9,363,456 | 582 | 9,535,488 | 8,048,640 | 9,633,792 | 2340 |

Final resident private bytes are **311,296 B** for 8 KiB source, **385,024 B** for 64 KiB JSON, and **1,372,160 B** for 1 MiB JSON. Reporting only those final numbers would miss much of the dirty working set. The JSON peaks occur at a large-buffer realloc checkpoint. Baseline major faults are zero.

Layout variation: 64 KiB JSON union is **942,080–946,176 B / 1,081,344–1,097,728 B** (4/16 KiB); 1 MiB JSON union is **9,359,360–9,363,456 B / 9,535,488–9,601,024 B**. Tiny-fixture 4 KiB variation is at most one page; 16 KiB variation is at most one block. Full distributions are in `summary.json`.

Fixtures (`prepare.py` retains exact generators): empty runs no JS; `return2` compiles a fresh AsyncFunction; one-tool encodes typed-array arguments with the codemode codec, serializes a real call frame, parses a reply frame, decodes its binary value and checks it; Promise.all issues 10 calls before any replies and checks their sum; source is exactly 8,192 B, 500 arithmetic statements plus padding. Structured JSON is exactly 65,536 B with 400 objects, or 1,048,576 B with 7,000 objects, mixed scalar fields, nested objects/arrays and padding. Each JSON run creates its input JS string **after fork**, parses, stringifies, validates object count/byte length and samples the live graph. It is not the historical single-string `json1m` benchmark. Read-only fixture mappings are test input storage outside the JS snapshot delta.

Primary census calls the canonical JS `receive(parse(frame))` path directly and injects already prepared input bytes; this isolates the runtime from OS input scheduling. A supplementary build drives the **unchanged bootstrap read handler** through a real pipe and `js_std_loop`:

| Exact raw frame ingress, n=10 | Observed dirty union, 4 KiB bytes | 16 KiB equivalent |
|---|---:|---:|
| `return 2` | 258,048 | 393,216 |
| One tool + binary codec | 290,816 | 425,984 |
| `Promise.all(10)` | 303,104 | 442,368 |
| 8 KiB source parse/run | 757,760 | 868,352 |
| 64 KiB structured JSON | 954,368 | 1,081,344 |
| 1 MiB structured JSON | 9,371,648 | 9,535,488 |

Replies are immediately available; this checks protocol memory, not external tool latency. This raw-ingress comparison has one template per fixture, so small page/alignment differences are not causal estimates. The broad census still excludes guest kernel/transport memory.

**The 8 KiB source result is material:** direct parse/run writes 364,544 / 491,520 B, but the actual canonical handler raises it to **757,760 / 868,352 B**. Its ASCII validation/line construction and `String.fromCharCode(...bytes.subarray(...))` path creates additional temporary allocations; the measured address union attributes their aggregate cost, not an exclusive cost per JS expression. It fits the 786,432 B upper allocation narrowly at 4 KiB, and exceeds it by **81,920 B** at equivalent 16 KiB. Thus parser-only memory is not the full ingress budget. Canonical raw ingress changes 64 KiB JSON to **954,368 / 1,081,344 B** and 1 MiB JSON to **9,371,648 / 9,535,488 B** in this fixture.

## What dirties the snapshot

First baseline template, n=10 per column, bytes at each child's private peak. The range classifier knows initialized QuickJS runtime, atom tables/strings, GC headers and allocator arenas. New allocations have no pre-snapshot range tag, so `anonymous_other` includes newly expanded JS heap as well as libc/TLS mappings; it does not mean unexplained non-JS memory.

| Peak attribution, disjoint address classes | `return2` | One tool | 64 KiB JSON | 1 MiB JSON |
|---|---:|---:|---:|---:|
| qjs_heap | 217,088 | 229,376 | 249,856 | 249,856 |
| anonymous_other | 12,288 | 16,384 | 512,000 | 7,774,208 |
| heap_other | 4,096 | 4,096 | 4,096 | 8,192 |
| image_data | 4,096 | 4,096 | 4,096 | 4,096 |
| stack | 16,384 | 20,480 | 16,384 | 12,288 |

Static libc and observer globals overlap a page: `__stdout_FILE` at `0x510258`, `__malloc_context` at `0x5107a0`, and observer flags at `0x5103xx`. Thus the **4,096 B image-data row cannot be divided honestly into libc versus observer bytes**. Musl's `[heap]` and anonymous allocator metadata are also included in the disjoint rows. Stack costs are explicit and small. Fine-grained labels within a heap page must overlap because QuickJS mixes allocator headers and live objects.

A separate **-O1 write-site instrumentation build, n=2**, marks addresses immediately before selected refcount, atom, allocator-header and GC writes. It keeps the trace bitmap in shared pages and is excluded from CPU comparisons. These are **lower bounds from covered write sites**, with page overlap allowed; do not sum the following columns/categories as disjoint costs:

| Source-level write sites, pre-existing pages only (overlap allowed) | `return2` | One tool | 10 calls | 64 KiB JSON | 1 MiB JSON |
|---|---:|---:|---:|---:|---:|
| JSValue/internal refcounts | 102,400 | 126,976 | 122,880 | 102,400 | 106,496 |
| Atom refcounts | 40,960 | 45,056 | 40,960 | 45,056 | 45,056 |
| QuickJS arena/block metadata | 94,208 | 143,360 | 135,168 | 131,072 | 131,072 |
| Cycle collector header writes | 0 | 0 | 167,936 | 167,936 | 167,936 |
| Automatic cycle collections | 0 | 0 | 1 | 2 | 5 |

This confirms CoW is not just new payload storage: one tool touches roughly 124 KiB of pre-existing refcount pages and 140 KiB of pre-existing allocator-header pages, plus atoms, with substantial overlap. Disabling automatic cycle collection removes GC traversal writes but leaves refcount and allocator traffic. For 10 calls, 64 KiB JSON and 1 MiB JSON, traced automatic GC counts go from **1 / 2 / 5 to 0 / 0 / 0**. The small net memory savings below are consistent with pages already dirtied for other reasons.

## Shrinking experiments

Each variant: one fresh template, **n=10 memory children and n=100 initial unobserved timed children**. CPU effects were checked with **three seeded, shuffled rounds of 20 fresh children per variant/workload (n=60)** for one-tool/64 KiB/1 MiB JSON; the table uses those pooled medians. Positive bytes mean saved relative to the first `-O2` baseline template; negative means increased memory. 16 KiB changes of one block, and 4 KiB changes of one page, can be layout noise (the baseline three-template range above quantifies it). Peak is useful for allocator demand; union is useful for retained snapshot-page accounting. CPU percentages are indicative on this virtualized host; per-round medians expose order/scheduling variation.

| Experiment | One-tool peak bytes saved, 4 KiB / 16 KiB | 64 KiB JSON peak bytes saved, 4 KiB / 16 KiB | 64 KiB JSON union bytes saved, 4 KiB / 16 KiB | One-tool CPU change | JSON CPU change (64 KiB / 1 MiB) |
|---|---:|---:|---:|---:|---:|
| GC before snapshot | -4,096 / +0 | +0 / +0 | +0 / +0 | -13.9% | +36.3% / +8.6% |
| Automatic cycle GC disabled | +0 / -16,384 | +12,288 / +0 | +12,288 / +0 | -8.5% | +15.7% / +3.0% |
| Both GC changes | -4,096 / -16,384 | +8,192 / -16,384 | +8,192 / -16,384 | -17.5% | -2.1% / +17.7% |
| Simple bump backend | -12,288 / -49,152 | -376,832 / -360,448 | -217,088 / -212,992 | +28.7% | -4.8% / -2.8% |
| Bump + detached free arenas | -380,928 / -425,984 | -2,138,112 / -2,146,304 | -1,978,368 / -1,998,848 | +17.9% | +28.6% / +30.3% |
| Reload bootstrap/codec bytecode | +8,192 / +16,384 | +8,192 / +16,384 | +8,192 / +16,384 | -15.0% | +5.8% / -0.3% |
| `-Os` instead of `-O2` | +4,096 / +0 | +4,096 / +0 | +4,096 / +0 | +4.8% | +43.3% / +61.3% |
| Remove std/os; narrow stubs | +16,384 / +49,152 | +45,056 / +32,768 | +45,056 / +32,768 | -28.1% | +5.0% / +22.5% |

**CPU confidence is limited.** The first ordered batch suggested a 23% 64 KiB JSON CPU gain with GC disabled; the shuffled repeats instead show a slower pooled median. Default 1 MiB JSON round medians were **49.24 / 28.46 / 29.87 ms**, versus **44.50 / 28.05 / 29.87 ms** without automatic GC. Thus this host does not establish a useful GC CPU win. `-Os` is the clearer cost: its 1 MiB medians were **57.18 / 48.72 / 44.96 ms**, slower than `-O2` in all three rounds. Do not apply the other table percentages as portable causal speedups.

- **Bump:** simple 128 MiB virtual reservation, 16-byte headers/alignment, memcpy-on-grow, no physical reclamation; QuickJS still reuses its own small arenas. It does not shrink the delta: 1 MiB JSON resident private peak becomes **14,712,832 B**, versus **8,048,640 B** baseline. Free-list detachment routes fresh small allocations into new arenas and grows it to **41,254,912 B**. QuickJS's logical 16 MiB malloc limit does not bound bump high-water physical consumption after logical frees; a production class must cap arena consumption itself. Both experiments are rejected.
- **GC:** `JS_SetGCThreshold(rt, (size_t)-1)` disables automatic cycle passes, not reference counting. `JS_RunGC` before snapshot performs the real cycle collector; it is not a moving compactor. It does not make tiny-run sharing materially better, and does not rescue the JSON class.
- **Heap packing/compaction:** this pinned public API has no moving-heap compaction operation. The measured substitute compiles bootstrap/codec, serializes their bytecode, frees the compilation runtime, then initializes a new runtime and loads that bytecode before snapshot. It rebuilds the live code state rather than moving an existing live heap, and shares read-only bytecode. It saves about **8 KiB of peak private bytes** on one tool and 64 KiB JSON, within a small-layout margin. Arbitrary live-object graph relocation was not implemented or claimed.
- **`-Os`:** text falls **1,009,372 → 739,116 B** (270,256 B shared image saving); initialized heap data layout is essentially unchanged, so per-run private savings are small. Shared text size is not multiplied by VM count.
- **Remove std/os:** the experimental narrow embedder supplies only the bootstrap's used std/os-shaped functions; output/timer/read-handler stubs are sufficient for these direct-input workloads, not production timer/I/O parity. Text/data/bss total drops **1,043,676 → 971,220 B**. It saves **16,384 B peak (one tool)** and **45,056 B peak (64 KiB JSON)** at 4 KiB granularity. Keep a real narrow transport API in production; these stubs are only the measurement bound.
- **Prepare the codec once:** current per-run codec parsing uses **299,008 / 303,104 / 323,584 B** peak private for return2 / one tool / Promise.all(10), versus **253,952 / 274,432 / 299,008 B** in the first prepared baseline: savings **45,056 / 28,672 / 24,576 B**. The exact injected adapter here is the codec plus equivalent workload, not the executor's entire provider/prelude pipeline. CPU comparisons are retained in the raw timing cells.

The allocation/GC behavior is consistent with the pinned source's **4,096 B QuickJS small-block arenas layered on musl mallocng**. Changing only libc does not remove writes to those arena headers. QuickJS's documented memory API and reference-count/cycle-collection model are described in the [upstream embedding documentation](https://bellard.org/quickjs/quickjs.html#Memory-handling).

## Initialization versus fork restore (indicative only)

Locked, unobserved batches; warm process executable/file caches, fresh runtime per init measurement, fresh child per restore measurement. Init includes preparation, excludes teardown. Fork wall time is from immediately before parent `fork` to first child clock read; it excludes exec, KVM, CPU-state restore, ring reset, identity repair, first JS execution and parent reap. Post-restore CPU excludes fork's parent CPU and the final reporting/exit/reap. It is not total service CPU.

| Operation | n | Median wall µs | Median process CPU µs |
|---|---:|---:|---:|
| Runtime + context only | 100 | 185.2 | 171.7 |
| Runtime + std/os + bootstrap + prepared codec | 100 | 1,381.4 | 1,363.6 |
| Prepared init + pre-snapshot GC | 100 | 1,488.1 | 1,457.1 |
| Prepared init, narrow std/os substitute | 100 | 1,500.0 | 1,462.1 |
| `fork()` to first child instruction | 100 | 394.4 | n/a |
| Empty child work after restore (excludes fork) | 100 | 2.9 | 7.4 |
| `return 2`, after restore | 100 | 404.2 | 421.9 |
| One tool + binary codec, after restore | 100 | 519.9 | 545.4 |
| `Promise.all(10)`, after restore | 100 | 720.8 | 736.6 |
| 8 KiB source parse/run, after restore | 100 | 2,183.4 | 2,210.6 |
| 64 KiB structured JSON, after restore | 100 | 3,189.1 | 3,191.2 |
| 1 MiB structured JSON, after restore | 100 | 41,634.1 | 41,534.4 |

Raw distributions include p90/p99, first-run outliers and per-batch load. CPU and wall clocks bracket slightly different clock-reading overhead; at microsecond scale CPU can exceed the reported wall interval. Do not turn this native fork comparison into the architecture's 100–375 µs real guest restore claim. The CPU matrix and init/fork figures answer only this host's relative cost question.

## Budget verdict and limits

**Keep the tiny-code tier, tighten source/data admission.** Return2, one tool and 10 calls are below the 786,432 B QuickJS allocation even with canonical raw ingress at equivalent 16 KiB granularity. Direct 8 KiB source parse fits, but canonical raw ingress raises its observed equivalent-16-KiB union to 868,352 B. Prepared runtime sharing is useful; allocations/refcounts do not destroy it wholesale.

**Do not claim the same allocation covers 64 KiB structured JSON.** Its observed union exceeds the allocation by **159,744 B (4 KiB)** or **294,912 B (16 KiB equivalent)** against the 786,432 B upper budget. This remains true after removing the small native stack/control overhead. If §4's “64 KiB live data” means JS heap bytes rather than serialized input, document that distinction explicitly: this fixture is 64 KiB encoded JSON, with a much larger live JS graph.

The other §4 upper allocations sum to **1,261,568 B**. Adding the observed JSON union yields **2,207,744 / 2,342,912 B**, already over 2 MiB, before a real combined ledger or native-to-guest corrections. Those are **estimates formed by adding allocations to a proxy measurement**, not an observed VM footprint; native stack/control overlap makes the sum slightly conservative, and guest eager zeroing can move it the other way. The 1 MiB structured case belongs in a larger tier or behind blob handles/host-side projection.

Residual limits: native fork is a proxy, not a measured jitk snapshot; rebuilt embedder is not proven bit-identical to shipped qjs; native allocator/mmap placement and guest first-fit/eager zeroing differ; observed unions can miss shorter-lived pages; actual 16 KiB behavior is unmeasured; entropy/clock repair and tenant reset correctness belong to gate 4. **No all-in gate-3 PASS is asserted.**

## Evidence and reproduction

Repository artifacts: `harness/` contains all C/Python/build sources; `inputs/` freezes the measured canonical bootstrap/codec; `summary.json` contains the full distributions, per-round CPU results and validation; `workloads.csv` is the compact table; **`raw-evidence.tar.gz` contains every raw memory/timing/interleaved cell**, including checkpoint addresses/maps/smaps and environment records. `all-hashes.txt`, ELF segments/sizes, environment, `verification.json` and shipped-binary calibration accompany them. Debug/smoke/validated-prefixed preliminary cells are retained for audit but excluded by `analyze.py`. Run `python3 harness/verify-evidence.py` in this report tree to check raw-cell completeness and summary/environment reconciliation without unpacking the archive.

Working directory and retained executables: `/home/dev/w3-qjs-mem/bin/{O2,Os,minimal,trace,wire}`; Mac staging `/tmp/sofort-w3/`. Pinned source inputs live in the VM's own directory/downloads. Third-party inputs were unpacked only in that agent directory. Build outputs are removed after evidence collection; report binaries are retained.

Reproduce on this same VM (copy `harness/*`, canonical bootstrap/codec and guest qjs into the root first):

```sh
cd /home/dev/w3-qjs-mem
mkdir -p downloads bin raw
curl -fL https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz -o quickjs-2026-06-04.tar.xz
curl -fL https://musl.libc.org/releases/musl-1.2.5.tar.gz -o downloads/musl-1.2.5.tar.gz
# Verify the two archive SHA-256 entries against all-hashes.txt before unpacking.
tar xf quickjs-2026-06-04.tar.xz
tar xf downloads/musl-1.2.5.tar.gz
cd musl-1.2.5
./configure --prefix=/home/dev/w3-qjs-mem/musl --disable-shared
make -j3
make install
cd ..
sh build.sh
# build-trace.sh also prepares trace-src and the supplementary raw-input binary.
sh build-trace.sh
flock /home/dev/bench.lock python3 measure.py
flock /home/dev/bench.lock python3 interleave.py
python3 analyze.py
python3 calibrate.py
```

For one memory cell: `python3 measure.py O2 census one_tool 10 default,peak-hooks custom-memory`. For one timing cell: `flock /home/dev/bench.lock python3 measure.py O2 cpu one_tool 100 default custom-cpu`. For raw ingress: select binary `wire` and options `default,wire,peak-hooks`. The primary routine is `measure.py`; fixture generation and source-only exports are in `prepare.py`. No production path gains a helper process.

## Findings → recommended changes

1. **Tighten `glue-2m` admission and replace allocation-heavy ASCII ingress in the future ring embedder.** The measured 64 KiB/1 MiB observed dirty unions are about **0.90/8.93 MiB at 4 KiB**, versus about 0.26 MiB for one small tool call. Blob handles, host projection or a separate class offer the largest memory/CPU benefit. Canonical ingress adds **393,216 B / 376,832 B** to the 8 KiB source observed union at 4/16 KiB granularity, pushing its equivalent-16-KiB total over the allocation; these are differences between complete paths, not an additive sum of individual operation costs. Exact source/data thresholds require a follow-up sweep, not interpolation from two fixtures.
2. **Measure stage-2 cumulative writes before signing off the class.** Preserve the distinction between live residency and retained dirty snapshot backing; current guest `munmap` is not host reclamation. Collect guest physical dirty addresses at 4/16 KiB with the exact guest allocator and canonical transport. This is the remaining measurement needed to turn the proxy result into a gate verdict.
3. **Prepare codec/bootstrap once and use a narrow embedder.** Measured codec preparation saves 24–44 KiB on these small runs; removing unused std/os state saves another roughly 16 KiB on one tool and 44 KiB on 64 KiB JSON in the isolated experiment. Savings are not assumed additive. Implement real transport/timer semantics and remeasure before shipping.
4. **Keep GC tuning secondary; no CPU win is established here.** Disabling automatic collection removes full-graph traversal, but saves only a few private pages and the CPU gain did not survive shuffled repeats. Keep the hard memory/arena cap and reset contract. Pre-snapshot GC alone is not a density win in these fixtures; revisit CPU policy on metal if cycle passes become material.
5. **Keep mallocng and arena reuse; reject the simple bump/detach designs.** Bump loses physical reclamation and detached arenas can consume tens of MiB despite QuickJS's logical heap limit. A future allocator must enforce consumed-page bounds and isolate metadata without forfeiting reuse; no measured win for such a design is claimed here.
6. **Treat bytecode packing and `-Os` as secondary image/startup choices.** Packing saves only about 8 KiB of per-run peak in the tested cells. `-Os` saves about 264 KiB of shared text, with CPU effects above; it does not fix the private-delta boundary. Neither is a substitute for class admission and a full dirty-page ledger.
