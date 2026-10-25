# Performance & memory — merged results of the local work round (2026-10-25)

Eight GPT-6.1-Sol agents, one brief (`arch/work/BRIEF.md`). Mac = M4 Pro under heavy load (load 14–40);
kvm-dev = nested HVF→KVM (memory valid, timing indicative). **No metal numbers yet.**

| Report | Gate |
|---|---|
| [bench/ledger](../../jitk/bench/ledger/RESULTS.md) (w0) | 0 macOS |
| [linux-ledger](linux-ledger/RESULTS.md) (a5) | 0 Linux + comparators |
| [jitk/shard](../../jitk/shard/RESULTS.md) (w2) | 2, 4, 5 |
| [qjs](qjs/RESULTS.md) (w3) | 3 |
| [guest-memory](guest-memory/RESULTS.md) (a1) | guest layout |
| [cpu](cpu/RESULTS.md) (a2) | CPU/latency waterfall |
| [transport](transport/RESULTS.md) + [ABI-v2](transport/ABI-v2.md) (a4) | per-call cost, ring spec |
| branch `w1-executor-prep` (w1) | 1 (not merged, see below) |

## 1. Memory per VM — where we are and where it goes

| System (Linux/KVM unless noted) | Marginal MiB/VM | Source |
|---|---:|---|
| jitk today, macOS/HVF | 7.87 (READY) | w0 |
| jitk today, Linux | 9.87 | a5 |
| **jitk today, Linux, `GLIBC_TUNABLES=glibc.malloc.hugetlb=0`** | **3.88** | a5 — applied in `executor/backend.ts` |
| Firecracker booted / snapshot-restored | 8.80 / 1.43 | a5 |
| Hyperlight process-per-VM / **shared snapshot, one process** | 7.35 / **0.37** | a5 |
| Bare KVM floor, many VMs per process | 0.22 | a5 |
| **jitk-shard spike (empty test guest, all-in incl. kernel charges)** | **0.13–0.16** | w2 (4,096 VMs, 4 threads) |

Projected small run on the new design, from parts measured separately (**estimate**):

| Part | KiB | Source |
|---|---:|---|
| VM + shard overhead incl. 80 KiB rings | 130–160 | w2 |
| Guest writes after restore (kernel + QuickJS), 16 KiB pages | 400–480 | a1, w3 agree |
| **Total small run (return2 / one_tool / Promise.all(10))** | **~0.55–0.65 MiB** | vs 2 MiB target, 10 MiB today |
| 64 KiB JSON run | ~1.2–1.3 MiB | fits `glue-2m` |
| 1 MiB JSON run | ~9.5 MiB | **larger class / blob handles** |

Where today's ~8 MiB goes (w0, a5): ~2.8 MiB image copy per VM, ~3 MiB guest pages dirtied/zeroed at boot
(invisible to host vmmap), +1.0 MiB per MiB of resources, and on Linux ~6 MiB malloc huge pages.
All are removed by: malloc fix (done), shared CoW snapshot, restore-not-boot, resources as RO extents.

## 2. CPU / latency

- Today every "parked" run still pays a whole VM process: **~8–13 ms VM CPU + 2.3–2.8 ms Node CPU per run** (a2, contended).
  Cold: 5.7 ms before `main`, 0.46 ms image read, 0.61 ms GIC/FDT, 1.57 ms guest boot→READY (cache clean 0.36, bootstrap eval 0.50). All removed by snapshot restore.
- RUN→DONE itself: **316 µs return2 / 470 µs one_tool**.
- One tool call today: **8 exits, 6 encodes / 19 parses**, console worker wakeups; 64 KiB result 323 exits, 16 ms (a4).
  ABI-v2 target: 1 WAIT exit, 2 encodes / 2 decodes, batch for Promise.all.
- Shard (nested): reset p50 **~140 µs** (≤4 KiB dirtied) → **2.8 ms** (1 MiB dirtied) — reset cost scales with dirtied pages; p99 2–5 ms nested → **must re-measure on metal/Asahi**.
- WAIT: 1,024 VMs, 33,792 calls, 4 threads, zero lost/duplicate wakeups.
- QuickJS fork-restore 0.39 ms vs fresh init 1.38 ms (nested, indicative).

## 3. Gates

| Gate | Result |
|---|---|
| 0 ledger | macOS: attributed except ~3 MiB guest pages (needs root); Linux: closed (a5) |
| 1 executor prep | executor parked p50 −13% (5.81→5.03 / 7.11→6.13 ms) but MCP arm regressed under load, +48 KiB parked footprint → **kept on branch `w1-executor-prep`**, re-measure on a quiet host; needs kernel rebuild (bootstrap.js) |
| 2 empty VM ≤0.5–1 MiB | **PASS** (0.13–0.16 MiB) |
| 3 QuickJS dirty | **PASS for small runs**; 8 KiB source via today's ASCII ingress exceeds by 80 KiB → fix ingress in ABI-v2 |
| 4 reset | correctness **PASS** (44,000 runs, 0 leaks); latency **not yet** (nested p99 >1 ms) |
| 5 WAIT | **PASS** |

## 4. Things we learned that change plans

1. **macOS caps at ~61 concurrent VMs** on this host (HVF address-space limit). macOS = dev backend only; Linux = scale.
2. **Hyperlight already reaches 0.37 MiB/VM** with a shared snapshot. JS-only density is parity, not a moat.
   Our differentiation must be: unmodified native Linux tools, thread-free WAIT, tool-backed files/caps, offline-grown kernel.
3. Reset cost ∝ dirtied pages → the small private delta is also the latency lever.
4. Big JSON must not enter the 2 MiB class (blob handles / host projection).

## 5. Next (ranked)

1. Port the real jitk kernel onto the shard ABI (ring + SUBMIT/WAIT/FINISH, no virtio/GIC) and snapshot after READY → first *real* all-in MiB/VM and restore numbers.
2. Measure gates 2–5 on the M1 Air (Asahi, real KVM, 16 KiB pages).
3. ABI-v2 ingress (bytes, no ASCII line building) — saves ~370 KiB on 8 KiB sources.
4. Re-measure `w1-executor-prep` quietly; merge if MCP regression is noise.
5. Native tools census (jq/rg/sqlite) — the part Hyperlight cannot do.
