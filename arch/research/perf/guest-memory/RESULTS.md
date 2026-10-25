# Guest memory census — a1-guest-mem, 2026-10-25

**Measured result:** the current QuickJS bootstrap dirties **491,520 B (480 KiB)** of 16 KiB physical-page groups between READY and completion for both `return2` and `one_tool` (10 fresh VMs per fixture). This is a guest CPU-write census projected onto host pages, **not a measured host private-dirty/PSS figure**. It excludes the EL1 stack and writes performed by the host's virtio implementation. A deliberately unsafe no-memset experiment lowers that projection by only **16,384 B/run**. The 204 KiB of stage-1 tables is predominantly a boot/snapshot-sharing issue: only two table pages are modified by these runs.

The guest findings support investigating the small class; they do not establish the 2 MiB all-in VM target. A concrete 80-page writable layout appears below. All new source/artifacts are in this scope or `/tmp/sofort-a1/`; the shared kernel and libkrun builds were not edited. No commits were made.

## Environment, method, and boundaries

Read the work brief, merged architecture, synthesis, FINAL, jitk README and CONTRACTS, then every requested `link.ld`, `prepare.py`, `build.rs`, `src/*.rs`, and `src/syscalls/*.rs`, plus the assembly startup/vectors and VMM loader. Source hashes and starting Git HEAD are in [experiment/source-provenance.json](experiment/source-provenance.json).

Environment: Apple M4 Pro / 24 GiB, arm64 macOS Darwin 25.6.0, libkrun/HVF, one vCPU, 32 MiB RAM. Rust 1.95.0, `aarch64-unknown-none`, release/LTO/size optimization. Copied `/tmp/jitk-01/r3/darwin/jitk-vmm` into `/tmp/sofort-a1/bin/`; VMM SHA-256 `276463d01ac6956a095814ed77053989d21bb52a7ef702f5c2698eb98daba20e`. Its existing build receipt identifies libkrun revision `a1d8616765da03980f3be1bb8714bfdd3842f33c`. No VMM/libkrun rebuild was performed.

Final samples were run under `/usr/bin/lockf -k /tmp/sofort-bench.lock sh /tmp/sofort-a1/final-runs.sh`. Load averages were **36.78/36.16/23.92** at census start, **37.95/36.42/24.16** at census end/nozero start, and **38.20/36.50/24.26** at nozero end/control start. Every sample records `uptime`. These are memory/function experiments; instrumented elapsed times in metadata are diagnostic only and are not latency/CPU results. Earlier unlocked prototype runs were used for debugging only and are not this report's dataset. No KVM experiment was needed or performed.

Instrumentation ([patch](experiment/first-write.patch)):

1. Immediately before first EL0 entry, make original writable stage-1 PTEs read-only, with software bit 55 recording original write permission. Preserve that logical permission in `valid()` so syscall pointer checks behave as before.
2. On EL0 or EL1 stage-1 write-permission fault, record the physical 4 KiB page, restore its original writable aliases, invalidate TLBs, and retry the faulting instruction. This catches zero-over-zero stores, unlike checksums. New `mmap`/`brk` PTEs participate too.
3. Record real `map`/`unmap` table-page writes explicitly. Page-table pages themselves must be exempt from fault protection; otherwise the recorder recursively faults. Instrumentation's own PTE modifications are not counted.
4. Use a separate 16 KiB-aligned `.audit` region for counters/bitmaps, outside the census. Exempt EL1 stack pages to let exception entry save registers. Pattern the EL1 stack at boot to measure cumulative high-water use; exclude that artificial fill from all dirty estimates.
5. Stop/rearm at the first `ppoll` after the READY output (before processing host input), after the DONE line, and before `exit`/`exit_group`. Disarm tracing permissions while emitting each census record so the measurement output is excluded. The saved page lists identify every recorded page, not just totals.

**Limits:** this is CPU stores, not reads/accessed bits, host DMA logging, stage-2 dirty logging, or actual file-backed CoW. Host console DMA bypasses stage-1 permissions. Console activity from measurement can influence device/control scheduling. Added code moves kernel globals/tables by 4 KiB, so kernel 16 KiB group counts are for the instrumented layout; user physical addresses stay unchanged. EL1 stack high-water includes recorder frames. Thus exact write counts are reported separately from projected/private-memory estimates. The nozero variant skips all anonymous-map memset, including remapped pages: it is an upper-bound experiment, **not a correct mmap implementation**, even in a fresh VM.

## Static inventory: every byte of the current layout

All addresses/ranges are half-open. Exact build inventory comes from [raw/baseline-readelf.txt](raw/baseline-readelf.txt), [raw/baseline-symbols.txt](raw/baseline-symbols.txt), and the retained baseline ELF. Guest user address translation is `PA = 0x80080000 + VA - 0x400000`.

### The 512 KiB kernel slot

| Range | Purpose | Bytes | Guest writes |
|---|---|---:|---|
| `80000000–80005668` | Kernel text/vectors | 22,120 | None |
| `80005668–80006000` | Text alignment | 2,456 | None |
| `80006000–80007a88` | rodata, including embedded bootstrap source | 6,792 | None |
| `80007a88–80008000` | rodata alignment | 1,400 | None |
| `80008000–80008609` | `.data` | 1,545 | BRK and console line-state updates |
| `80008609–80009000` | BSS alignment | 2,551 | None explicitly |
| `80009000–80046830` | `.bss` | 251,952 | **All explicitly zeroed at boot** |
| `80046830–80047000` | Guard alignment | 2,000 | None explicitly |
| `80047000–80048000` | Unmapped EL1 stack guard | 4,096 | None |
| `80048000–80058000` | EL1 stack reservation | 65,536 | Used portion, not an eager stack clear in baseline |
| `80058000–80080000` | Unused fixed slot padding | 163,840 | None |
| **Total** | | **524,288** | |

`.data` = fd table **1,536 B** (`64 × 24 B` `Option<Open>`), BRK **8 B**, `USER_LINE_START` **1 B**. The fd array is in initialized data, not BSS. These fixtures never open an archive fd; colocating it with BRK/console state still makes its containing page private.

BSS contains:

| Object | Bytes | Baseline PA | Lifecycle |
|---|---:|---|---|
| ROOT + LOW + RAM | 12,288 | `80010000`, `8000e000`, `8000f000` | Boot initialization; LOW rewritten for every user map |
| PAGES `[32]` | 131,072 | `80021000` | 32 full L3 tables identity-map **64 MiB**; all filled at boot |
| USER `[16]` | 65,536 | `80011000` | All zeroed at boot; only **four** L3 tables are populated by these fixtures |
| **All stage-1 tables** | **208,896 (204 KiB)** | | Already included in BSS |
| Virtio queues `QS[4]` | 16,384 | `80042000` | Each 4 KiB object holds descriptors/avail/used/1 KiB buffer; CPU + DMA writes |
| Delayed development trace `RECORDS` | 16,384 | `80009810` | Zeroed at boot, retained even without trace features |
| Syscall trace BUFFER | 2,048 | `80009010` | Zeroed at boot; normal registered syscalls do not fill it |
| Console CONTROL `[8][256]` | 2,048 | `80046020` | Control RX buffers; host DMA + guest reads |
| Other BSS scalar bytes | 86 | Scattered | Seed 16 B; epoch/tick; trace lengths/seq; console indexes/flags |
| BSS alignment/padding | 6,106 | | Included in boot clear |
| **Total BSS** | **251,952** | | |

`boot.S` stores zero through the entire BSS, including the unused USER tables and inactive trace buffers. `mmu::init` then writes **131,368 B** of descriptor stores (131,072 B PAGES + 256 B RAM + 16 B ROOT + 16 B LOW + 8 B guard), mostly overwriting pages just cleared. This is source-derived store volume, not additional unique dirty memory. Initial user mapping/protection subsequently writes those tables again. Neither AF nor hardware dirty-bit management creates hidden guest PTE writes here: descriptors start with AF=1, and the existing TCR does not enable hardware AF/dirty updates.

### All 32 MiB of guest physical RAM

| Physical range | Purpose | Bytes |
|---|---|---:|
| `80000000–80080000` | Kernel slot above | 524,288 |
| `80080000–802ca000` | Flattened QuickJS payload, including segment holes/BSS/padding | 2,400,256 |
| `802ca000–802ca028` | Empty resource archive: 16 B header + 24 B root | 40 |
| `802ca028–80300000` | Gap before fixed minimum HEAP | 221,144 |
| `80300000–80480000` | brk arena, VA `680000–800000` | 1,572,864 |
| `80480000–81a80000` | mmap arena, VA `800000–1e00000` | 23,068,672 |
| `81a80000–81c60000` | Unmapped user gap | 1,966,080 |
| `81c60000–81c80000` | User stack, VA `1fe0000–2000000` | 131,072 |
| `81c80000–81e00000` | Unused RAM before FDT | 1,572,864 |
| `81e00000–82000000` | libkrun FDT placement reservation | 2,097,152 |
| **Total** | | **33,554,432** |

The default FDT actually contains **1,464 B** (`0x5b8`, measured from its guest header); libkrun places it at RAM-end minus 2 MiB. Guest FDT parsing is read-only and uses stack locals. Its seed/clock/counter bytes are written by the **host**, not the guest. The FDT reservation is not a 2 MiB guest memset. There is no initrd in these runs.

Payload arena acceptance is VA `400000–680000` (**2,621,440 B**), not the full file size. The particular QuickJS ELF has:

| Piece | Bytes |
|---|---:|
| RX segment, file = memory | 2,068,996 |
| Gap between PT_LOAD byte extents | 57,964 |
| RW segment file bytes | 266,384 |
| RW segment BSS | 5,088 |
| Flat tail page alignment | 1,824 |
| **Packed executable flat** | **2,400,256** |

RW PT_LOAD VA is `607470–6498e0` (271,472 B, 67 rounded 4 KiB pages). **232,336 B** of it is GNU_RELRO (`607470–640000`); the remaining genuinely mutable tail is **39,136 B**, fitting three aligned 16 KiB pages. The present packer reads only PT_LOAD flags, so RELRO stays writable. The census sees no writes to that RELRO prefix in either bootstrap or run. An offline seal of that span is justified for this exact static QuickJS image; it is not a blanket rule for other native binaries.

Raw `kernel.bin` = **2,924,584 B** = 524,288 B fixed slot + 2,400,256 B flat + 40 B archive. `objcopy` materializes gaps before `.packed` in the raw file, including initially zero kernel storage. Host direct loading therefore copies those raw bytes into private RAM today even if the guest never writes them. This census does not measure that host copy cost.

Resources are appended at VA `400000 + flat_bytes`. HEAP is `max(680000, align_up(FS_end,4096))`; MMAP = HEAP + 1.5 MiB. The archive is only kernel-alias mapped and protected read-only. `fs::read` copies requested file bytes into the caller's existing user buffer and advances a 24 B fd entry; there is **no eager boot copy of resources into the heap**. A caller such as `std.loadFile` can of course allocate a second user copy. The current host load of resource bytes into anonymous RAM is the major per-resource copy and belongs in the VMM ledger.

## Which pages are written at each boundary?

Before the recorder starts, source inspection proves BSS's **251,952 B / 62 intersected 4 KiB pages** are written. MMU initialization touches all 51 stage-1 pages within that set. Console setup initializes all four queue pages and control state. Boot also writes seed/epoch and the EL1 stack.

`user::run` maps payload segments and all **32 user-stack pages**, but does not clear the whole stack or payload in the guest. It copies argument strings, PATH, auxv/initial SP, and 16 seed bytes to user-stack backing pages. This build has argc=6, **6,013 B** of NUL-spaced argument strings and a **272 B** initial SP vector; string copies, SP vector, and AT_RANDOM intersect four 4 KiB pages. Of these, the initial SP page is subsequently written by EL0. Boot-to-READY EL0 writes another four stack pages, for a seven-page union with the initial boot copies. Eager BSS zeroing and these initial copies are **not** included again in the next table.

The runtime census starts just before EL0. `ready` means EL0 startup/bootstrap through the first ppoll after READY; `done` means that boundary through emitting the result. `exit` is cleanup after DONE. READY→exit is the **union**, not the sum of `done` and `exit` rows.

### Measured write sets, n=10 per fixture/variant

| Variant / phase | Fixture | 4 KiB-page bytes min / median / max | 16 KiB-group bytes min = median = max |
|---|---|---:|---:|
| Current / EL0 entry→READY | Both, separately n=10 | 417,792 / 417,792 / 417,792 | 540,672 |
| Current / READY→DONE | return2 | 331,776 / 335,872 / 335,872 | **491,520** |
| Current / READY→DONE | one_tool | 339,968 / 344,064 / 344,064 | **491,520** |
| Current / DONE→exit | Both, separately n=10 | 102,400 / 102,400 / 102,400 | 262,144 |
| Current / READY→exit union | return2 | 331,776 / 335,872 / 335,872 | **491,520** |
| Current / READY→exit union | one_tool | 339,968 / 344,064 / 344,064 | **491,520** |
| Nozero / EL0 entry→READY | Both, separately n=10 | 372,736 / 372,736 / 372,736 | 540,672 |
| Nozero / READY→exit union | return2 | 307,200 / 307,200 / 307,200 | **475,136** |
| Nozero / READY→exit union | one_tool | 315,392 / 315,392 / 315,392 | **475,136** |

The 16 KiB quantity is `count(distinct floor(PA/16384)) × 16384`, without assuming the current HVF mapping is file-backed. It is the potential CoW footprint for a page-aligned file-backed image on this Mac. The 4 KiB result is useful for a 4 KiB-page Linux host; it does not assert that kvm-dev/production Linux uses that page size.

Breakdown for the current variant, 16 KiB projections (component ranges do not overlap host pages):

| Region | EL0 entry→READY | READY→DONE, both fixtures |
|---|---:|---:|
| Kernel globals + explicitly recorded page-table edits | 98,304 | 81,920 |
| QuickJS payload data | 32,768 | 16,384 |
| brk data | 16,384 | 16,384 |
| mmap allocations | 360,448 | 360,448 |
| User stack | 32,768 | 16,384 |
| **Census total** | **540,672** | **491,520** |

Exact run pages are in [raw/samples.json](raw/samples.json) and each saved stdout. Useful stable extents:

- Payload data: bootstrap writes `802c0000`, `802c8000`, `802c9000`; runs write `802c8000`, `802c9000`. RX, RELRO prefix and archive have no observed guest writes.
- brk: `80301000` is written; break reaches VA **`682000`** (8 KiB above HEAP), without changing during either run.
- mmap: boot's union is `80480000–804d8000` (88 pages). READY live mappings occupy **356,352 B / 87 pages**. During a run, a temporary allocation reaches `804d8000–804e0000`, is freed, and live mappings return to 87 pages. Run writes are scattered over the prepared heap; they are not limited to the new 32 KiB.
- User stack: boot-to-READY first-write set is `81c73000`, `81c75000–81c78000`. After READY, return2 writes `81c75000–81c78000`; one_tool additionally writes `81c74000`. No run writes to the argument-source pages at `81c78000+` were observed.
- Actual table edits: boot-to-READY modifies LOW plus USER[1] and USER[2]; after READY modifies **LOW + USER[2]**. In the final instrumented ELF the latter are `8000f000` and `80014000`. The underlying user mappings are 4 KiB; each table is 4 KiB, but those edits span **32 KiB** of host groups. ROOT, RAM, PAGES and other USER tables are unchanged after READY.

Successful mmap volume through READY is **47 calls / 413,696 B**, with two brk calls and **103 page-map operations**. The entering syscall count in the prototype was 48 because one 4 KiB mmap request was rejected; final counters count only successful calls. Each run makes **one successful 32,768 B mmap / eight page-map operations**, no brk call, and no mmap after DONE. Cleanup touches no page or 16 KiB group absent from READY→DONE.

EL1 stack's measured cumulative high-water is **6,800 B** in every final instrumented sample, including nested trace faults and census formatting. This supports a **16 KiB stack experiment** for these fixtures, not a proof for all syscalls/native programs. Archive path walk has a 4 KiB stack buffer, ppoll 128 B, syscall vectors 800 B, and formatting/call-chain depth must fit too. Current 64 KiB EL1 and 128 KiB EL0 reservations do **not** mean all those bytes become private; shrinking them mainly improves the hard write bound. Keep guards and enforce an engine/native stack policy.

Allowing one 16 KiB EL1 stack group makes the current CPU-write projection approximately **507,904 B (496 KiB)**. This is an **estimate** because stack faults are exempt and kernel placement changed. For DMA, only existing queue/control backing pages are writable host targets: their whole upper envelope is 16,384 B QS + 2,048 B CONTROL, overlapping many already-counted CPU-written groups. Do not sum that envelope as though it were an independent measured delta. A stage-2 dirty log or stopped-slot host comparison is still required to close actual CoW accounting.

## Avoidable writes and false sharing

1. **Eager anonymous mmap zero:** `mmap.rs` zeroes every successful allocation immediately, including fresh zero host pages and repeatedly reused addresses. The nozero experiment removes **45,056 B of unique 4 KiB boot writes**, but saves **zero** 16 KiB groups at READY. After READY it removes **28,672 B** of user mmap write-page coverage and saves **one 16 KiB group**, for both fixtures. Preserve zero-fill semantics with fresh zero backing/zero-on-first-use per allocation generation, and clear reused pages before exposure. Simply deleting memset is incorrect and can expose prior allocation/tenant bytes. `brk.rs` already does **no zeroing**; it only maps pages and updates BRK. Shrink does not unmap/clear, so extending again cannot be used as a reset mechanism.
2. **Tables built for unused space:** half of PAGES identity-maps beyond the default 32 MiB RAM, and 12/16 USER tables remain unused. Merely trimming those arrays saves **114,688 B** of static/BSS capacity and boot zeroing (64 KiB identity + 48 KiB USER). A sparse 9–12 table layout is approximately **36–48 KiB** total, saving **159,744–172,032 B (156–168 KiB)** versus 204 KiB; this is a design estimate. Once prepared snapshots share immutable tables, only actually modified leaves cost private memory.
3. **Duplicate LOW stores:** `map()` writes LOW's same table pointer on every page map. Its topology can be fixed before checkpoint. Avoiding that store saves **one table page / one 16 KiB group per run** in this trace, without changing anonymous-map semantics. Pack all mutable leaf pages in one separately aligned 16 KiB group; do not let a hot entry privatize unrelated immutable tables.
4. **16 KiB false sharing:** at 4 KiB resolution, return2's mmap writes cover 278,528 B, but they occupy 360,448 B of 16 KiB groups: **81,920 B** of page-granularity amplification. One_tool's corresponding amplification is **77,824 B**. These figures describe existing allocation placement; they are **not guaranteed savings** from a linker edit. User data (`802c8000/9000`) costs 16 KiB for 8 KiB of write pages; brk costs 16 KiB for one 4 KiB write page. Current kernel globals span multiple host groups and colocate fd state, trace state, table tails, and queue objects. Keep all production hot kernel state together in one 16 KiB group; separate shared tables/RO bytes at 16 KiB boundaries.
5. **Unconditional debug storage:** removing production RECORDS + trace BUFFER saves **18,432 B** of BSS and boot stores. These buffers are mostly clean after READY already, so do not claim 18 KiB/run. Delete virtio in the adopted ring guest: QS + CONTROL are **18,432 B** plus indexes; replacing them adds the separately budgeted **81,920 B rings/control**, so it is not intrinsically a raw guest-byte reduction. Its benefit is fixed ownership, fewer host devices, and denser hot state.
6. **RELRO and resources:** seal the **232,336 B RELRO prefix** after preparation and put the remaining **39,136 B** ELF tail into a 49,152 B writable extent. This removes **233,472 B (228 KiB)** of currently writable 4 KiB-page coverage; a separately packed 16 KiB extent budget falls by approximately **224–240 KiB**, depending on alignment; observed per-run dirty reduction is **zero**, because this image's RELRO is already never written. Keep archive bytes shared/read-only and stream into bounded buffers. No nonexistent eager guest resource copy should be optimized.
7. **Snapshot boundary:** boot clears ~246 KiB BSS, constructs tables, writes argv, and initializes ~350 KiB mmap backing before READY. A prepared snapshot shares that initial state; shrinking boot initialization is secondary to ensuring it happens once per prepared image. A real device-free CHECKPOINT remains necessary; this instrumented `ppoll` boundary is not a serialized/restorable snapshot.

## Concrete proposal for ARCHITECTURE.md §2.3

**Proposed allocation; not implemented or measured:** an aligned, class-specific physical arena of **`0x140000 = 1,310,720 B`**, 80 host-size 16 KiB units. Preserve existing executable virtual addresses while changing their physical backing. Use e.g. PA **`80400000–80540000`** for the arena; the choice is illustrative and requires changing today's linear `physical()` helper to a region-based translation. Immutable content occupies separate 16 KiB-aligned physical extents. Guard pages are unmapped outside/between virtual stack regions and consume no writable backing.

| Arena offset | Purpose | Bytes | 16 KiB units |
|---|---|---:|---:|
| `000000–100000` | All QuickJS/musl heap backing: prepared heap + run allocations, shared brk/mmap pool | 1,048,576 | 64 |
| `100000–10c000` | Mutable ELF `.data/.bss` tail after RELRO | 49,152 | 3 |
| `10c000–11c000` | EL0 stack incl. bounded arguments/auxv | 65,536 | 4 |
| `11c000–120000` | EL1 stack | 16,384 | 1 |
| `120000–124000` | Hot kernel globals: fd table, allocation bitmap, ring demux, generation/clock/seed | 16,384 | 1 |
| `124000–128000` | Mutable stage-1 leaf-table group | 16,384 | 1 |
| `128000–130000` | Bounded scratch/file/cap buffers | 32,768 | 2 |
| `130000–140000` | Class headroom; initially unallocated/unmapped where possible | 65,536 | 4 |
| **Total** | | **1,310,720** | **80** |

Keep the **16 KiB control + 2×32 KiB rings = 81,920 B** in a separate five-page writable extent. At 16 KiB granularity, malicious writes can consume at most **1,392,640 B** of guest backing including rings. This leaves **704,512 B** of the 2 MiB reservation for host VM/vCPU/stage-2/state charges; whether that remainder suffices is the independent ledger/shard gate.

Place kernel RX/RO, QuickJS RX/RELRO, resource archive, immutable bootstrap/argv source, fixed policy descriptors, and immutable page-table topology into shared file-backed extents mapped stage-2 read-only. The preparation boot can temporarily write them before sealing, but runtime must map those host extents `KVM_MEM_READONLY` (HVF equivalent protection) or not map them. In particular, **no mutable alias or anonymous fallback may cover immutable pages**. Freeze the prepared FDT or remove it entirely in the adopted device-free guest; put live generation/entropy/clock values in control/kernel arena state, never a per-tenant mutable FDT outside the bound.

Stage-1 strategy:

- Prebuild/snapshot ROOT, parents, RX/RO mappings, fixed stack mappings, and MMIO doorbell mappings; mark AF=1. Use 2 MiB RO block mappings only for physically aligned homogeneous immutable extents; mixed edges use 4 KiB leaves. Prebuilding once is enough; generating tables at image-build time is optional.
- Keep fixed parent pointers out of `map()`. For this class, constrain allocator VA backing to the one 2 MiB user leaf range that already contains `0x680000` (existing VA `600000–800000`); 1 MiB heap fits. Redirect both brk and mmap into bounded, disjoint allocations within this pool instead of retaining today's 1.5 MiB + 22 MiB reservations. This needs allocator/syscall changes, not just a linker constant. Preserve their non-overlap and mmap/munmap behavior with allocation metadata.
- Put the few mutable L3 leaves in the arena's one 16 KiB group. A 4 KiB heap leaf is sufficient for the fixed class layout; the remaining group space allows additional leaves/metadata. Stack/static-data leaves can be immutable. Full stage-1 permission validity still applies to kernel copy helpers.
- An embedder with a fixed pre-mapped allocator could eventually freeze even the heap leaf; that saves one 16 KiB private group. Do not claim that saving for today's mmap/munmap ABI. Removing all table mutation while still promising munmap protection would change semantics.
- Stage-2 permissions enforce the hard bound even if compromised EL1 rewrites its own mutable PTEs or TTBRs. Reject stage-2 writes to RO extents and writes outside mapped arena/rings; never allocate more writable RAM on fault.

The 1 MiB allocator backing is a **class cap**, not today's 16 MiB QuickJS CLI limit. Admission/engine memory limits must include allocator overhead, prepared objects, request buffers, and peak temporary allocations. Set/enforce an engine stack limit compatible with the 64 KiB EL0 stack; larger native binaries, recursion, resource copies, and JSON belong in larger classes or must fail within the cap. The current fixtures' ~348 KiB live mmap and sparse ~352 KiB per-run heap projection fit, but 8 KiB source/64 KiB live-data admission is not proven by these two cases alone.

Expected per-run guest private backing under this layout (**estimates**, these two fixtures only):

| Item | Expected bytes |
|---|---:|
| Heap (current brk+mmap projection; nozero experiment lower end) | 360,448–376,832 |
| ELF mutable tail actually changed | 16,384 |
| EL0 stack actually changed | 16,384 |
| EL1 stack allowance | 16,384 |
| Packed hot kernel globals | 16,384 |
| Mutable stage-1 group | 16,384 |
| **Guest arena pages written** | **442,368–458,752** |
| Rings/control, budget all pages private | 81,920 |
| **Guest + transport expected private bytes/run** | **524,288–540,672 (512–528 KiB)** |

The upper end preserves current eager mmap zeroing. The lower end assumes zero-fill correctness can retain the nozero experiment's one-page benefit. Scratch/headroom pages must remain untouched in these fixtures for this estimate. Header/data, state repair, and dirty-trace overhead can move these counts. This does not include host page tables, KVM/HVF objects, runner allocations, or allocator caches, and is not a replacement for measured PSS/private-dirty of a real restored slot.

## Raw data, artifacts, and reproduction

Canonical data: [raw/summary.json](raw/summary.json), [raw/samples.json](raw/samples.json), [raw/verification.json](raw/verification.json), and the three `raw/final-{census,nozero,baseline}/` directories (all stdout/stderr plus per-run load/provenance). Verification: **20/20 census + 20/20 nozero + 20/20 uninstrumented control**, each returns 2, gets the sandbox ack and exits 0, with no fault, panic, or missing-syscall record. The nozero cases only prove these fixture outputs, not general zero-fill semantics.

Retained binaries/ELFs (temporary artifacts, hashes bind the exact runs):

| Path under `/tmp/sofort-a1/` | kernel.bin SHA-256 |
|---|---|
| `baseline/` | `6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6` |
| `instrumented-final/` | `63e873458abf38d64475df75b60423a9dbb6a91b097058c65f360a05ecb4bbc1` |
| `nozero-final/` | `ed72f2bd5b8d0e8ac7e508fb24df2d00b865306e8d1ccdee6598b9d1a9bc46ef` |

Reproduce in a new/private `/tmp/sofort-a1/` directory (preserve the retained artifacts first if reusing it):

```sh
# Copy kernel source/payload without shared target/dist/test outputs; preserve ../protocol location.
rsync -a --exclude target --exclude dist --exclude test-work --exclude test-results \
  /Users/noah/code/sofort/arch/jitk/kernel/ /tmp/sofort-a1/kernel/
mkdir -p /tmp/sofort-a1/protocol /tmp/sofort-a1/bin
cp /Users/noah/code/sofort/arch/jitk/protocol/bootstrap.js /tmp/sofort-a1/protocol/
cp /tmp/jitk-01/r3/darwin/jitk-vmm /tmp/sofort-a1/bin/
# Baseline before patch; save release ELF as baseline/kernel.elf as well.
CARGO_TARGET_DIR=/tmp/sofort-a1/target JITK_OUT_DIR=/tmp/sofort-a1/baseline \
  sh /tmp/sofort-a1/kernel/build.sh
patch -d /tmp/sofort-a1/kernel -p1 < experiment/first-write.patch
CARGO_TARGET_DIR=/tmp/sofort-a1/target JITK_OUT_DIR=/tmp/sofort-a1/instrumented-final \
  sh /tmp/sofort-a1/kernel/build.sh
# Duplicate patched kernel to kernel-nozero. Remove only write_bytes(...,0,len) in mmap.rs.
# Remove that copy's syscalls.manifest.json (its source hash is intentionally no longer valid).
# Build it into /tmp/sofort-a1/nozero-final with its own CARGO_TARGET_DIR.
cp experiment/run.py experiment/final-runs.sh /tmp/sofort-a1/
/usr/bin/lockf -k /tmp/sofort-bench.lock sh /tmp/sofort-a1/final-runs.sh
python3 experiment/analyze.py /tmp/sofort-a1/raw
```

The patch is a research recorder, not a production change. Its `.audit` section relies on fresh zero RAM; it is not a reset implementation. Build caches were removed after preserving reported ELF/bin artifacts. Retained disk usage is recorded in `raw/artifacts.json`; build caches and superseded prototype outputs were removed, and new disk use stayed below the 1.5 GiB allowance. Root `make test` was not run because no shared built code changed; the isolated images were validated by the 60-run functional census/control above.

## Findings → recommended changes

Ranked by expected memory/latency impact; estimates are explicitly separated from measurements:

1. **Enforce the 80-page arena and share sealed prepared bytes.** Highest memory impact and necessary hostile bound: constrain today's 32 MiB writable physical backing to **1,310,720 B + 81,920 B transport**; share the **2,924,584 B** image and boot-initialized state. Exact host savings need the VMM ledger. Snapshotting also removes repeated BSS/table/runtime initialization from the request path; no latency delta was measured here.
2. **Use one bounded physical/virtual allocator pool and pack kernel hot state/table leaves on 16 KiB boundaries.** Current post-READY write projection is **480 KiB**, before EL1-stack allowance/DMA closure. Estimated compact ring-guest cost is **512–528 KiB including all 80 KiB transport**, with the 1.25 MiB arena as the independent worst-case cap. Removing duplicate LOW writes alone avoids one measured **16 KiB** dirty group per fixture.
3. **Seal RELRO and reduce oversized stacks/arenas.** RELRO sealing removes **228 KiB** of currently writable 4 KiB-page coverage (approximately **224–240 KiB** in a 16 KiB extent budget), though measured normal-run dirty savings are zero. EL1 64→16 KiB and EL0 128→64 KiB reduce reserved writable capacity by **114,688 B** total, conditional on stack limits/native coverage. This buys hard-bound headroom rather than proportional normal-run dirty savings.
4. **Make page-table topology sparse and prepared.** Trim provably unused arrays for **114,688 B** immediately; target **36–48 KiB** total tables instead of 204 KiB. Share fixed parents/read-only mappings; reserve one 16 KiB mutable leaf group. Boot wins do not automatically become per-run private-memory wins.
5. **Implement correct deferred/conditional mmap zeroing only if broader traces justify it.** Measured upper bound here: **16 KiB/run**, zero host-page benefit at READY, despite 45 KiB fewer 4 KiB boot write pages. Never remove zero-fill for reused allocations or restore from a tenant-dirty image. `brk` is not an eager-zero culprit.
6. **Remove inactive trace buffers and keep resources immutable.** Debug storage saves **18,432 B** of static/BSS footprint; guest resource bytes already avoid eager heap duplication. The substantial resource-sharing change is in host mappings. Measure resource-reading/64 KiB-live-data fixtures and stopped-slot stage-2 dirty state before claiming the full small-class peak or all-in density gate.
