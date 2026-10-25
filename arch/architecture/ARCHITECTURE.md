# Sofort architecture — merged decision (2026-10-25)

Merged by the lead from three independent designs: [A — density-first](A-density-first.md),
[B — fewest moving parts](B-fewest-parts.md), [C — data path first](C-data-path.md), against the
requirements in [SYNTHESIS](../research/next/SYNTHESIS.md). All numbers for the new system are
**targets/allocations to falsify**, not measurements. Measured baselines are marked **[M]**.

## 0. One sentence

**A shared, immutable, pre-initialized computer image, mapped copy-on-write into thousands of
hardware-isolated KVM slots per host; each run gets a tiny private delta, a fresh identity,
late-bound capabilities, and waits for tools without holding a thread.**

## 1. Where the three designs agree (adopted as-is)

| Decision | A | B | C |
|---|:-:|:-:|:-:|
| Own narrow Rust VMM ("runner"); libkrun leaves the production path after parity | ✓ | ✓ (gated) | ✓ |
| Linux: many independent KVM VMs per **shard process**, fixed owner threads, 1 vCPU/VM, no thread per waiting VM | ✓ | ✓ | ✓ |
| macOS/HVF: persistent worker process per VM, same guest ABI; no Linux density claims transfer | ✓ | ✓ | ✓ |
| Snapshot = file-backed `MAP_PRIVATE` per slot; reset = `MADV_DONTNEED` on stopped slot, memslots stable; HVF = unmap/remap | ✓ | ✓ | ✓ |
| No UFFD, KSM, compression, guest-assisted CoW until fault traces demand it | ✓ | ✓ | ✓ |
| Snapshot at a dedicated checkpoint after QuickJS + codec/bootstrap init, before any tenant data | ✓ | ✓ | ✓ |
| Trusted after-restore repair hook (reseed existing QuickJS RNG, clocks, generation) — needs a small Bellard embedder | ✓ | ✓ | ✓ |
| Transport: per-slot 16 KiB control + 2×32 KiB rings = **80 KiB/slot**, bounded records, SUBMIT / WAIT / FINISH (+ PREPARED/CHECKPOINT offline) | ✓ | ✓ | ✓ |
| Delete virtio console, GIC, guest timer, WFI parking from the production guest | ✓ | ✓ | ✓ |
| Kernel-side reply demux (so `read(/cap/...)` works while QuickJS is suspended) | ✓ | ✓ | ✓ |
| One **superset kernel per runtime ABI**, per-recipe *policy* (syscalls/files/caps), not per-recipe binaries | ✓ | ✓ | ✓ |
| Three cache keys: recipe hash → image/content hash → prepared key → snapshot; grants bound late, never in snapshots | ✓ | ✓ | ✓ |
| `/mcp/` + `/cap/` files and JS stubs share one capability dispatcher; `/cap/<slot>/call` commits exactly one effect | ✓ | ✓ | ✓ |
| Cap'n Web = optional prepared profile, admitted only if ≤10 µs/call extra and fits the memory class | ✓ | ✓ | ✓ |
| No automatic replay; unknown outcome → reconcile, never blind retry | ✓ | ✓ | ✓ |
| Native tools: wider static ET_EXEC loader, byte stdout/stderr records, snapshot before entering the binary | ✓ | ✓ | ✓ |
| Grow loop offline; acceptance = semantic cases + mutation tests, not repetition | ✓ | ✓ | ✓ |
| Independent watchdog stays; leases become (shard, slot, generation, deadline); kill shard if owner fails to stop | ✓ | ✓ | ✓ |

This convergence from three independent stances is the strongest signal in the round.

## 2. Where they disagree — lead decisions

### 2.1 Where policy/broker lives (the big one)

- **B:** keep TS/Node as the single policy authority; Rust shards are untrusted; IPC hop per call (echo budget 120 µs).
- **A:** native Rust trusted broker process, shards hold no credentials (echo 30 µs).
- **C:** VMM + dispatch in one native trusted shard process (echo 28 µs) — larger blast radius.

**Decision: B now, A as the gated endgame, reject C's merge.** Start with Node as the only policy
authority over a bounded *shared-memory* IPC to Rust shards (not pipes). Port the broker to Rust
(A) — as a replacement, never a second authority — when the measured TS share exceeds
**100 µs/run or 20% of service CPU** (B's own rule). Shards never hold credentials (A's argument: a VMM
bug then cannot use them). C's single-process merge is rejected for blast radius; its ≤70 µs native-MCP
ingress idea moves to the same gate as the Rust broker.

### 2.2 Doorbell
A/C: SMCCC-filtered HVC with MMIO fallback. B: one MMIO-store doorbell on both platforms first.
**Decision: MMIO only first** (one mechanism, works on KVM and HVF). Add HVC only if it measurably wins.

### 2.3 Hard memory bound (adopt A)
B and C note that a compromised EL1 can dirty every writable mapped page. **A's fix is adopted: map
only a class-sized writable arena** (stage-2), everything else read-only (`KVM_MEM_READONLY`) or
unmapped. For `glue-2m`: writable arena **1,310,720 B** + 80 KiB rings. Admission reserves the
class peak (2 MiB), not the mean — so density math is safe under hostile guests.

### 2.4 Shard size
Start **64 slots/shard** (B, C); raise only after scale gates; A's 16,384 is the end-state planning cap.

## 3. The wiring

```text
 agent / Cloudflare Worker ──MCP execute──▶ Node: MCP + executor + POLICY (sole authority, credentials)
                                                │  bounded shared-memory queues (no per-call pipe write)
                    ┌───────────────────────────┼───────────────────────────┐
                    ▼                                                       ▼
        jitk-shard 0 (Rust, confined, no creds)         …          jitk-shard S
          reactor + W owner threads (W ≤ cores)
          owner k: slots a,b,c… (1 vCPU each, own stage-2)
                    │ per-slot: MAP_PRIVATE(prepared snapshot) + RO extents + 80 KiB rings
                    ▼
          jitk EL1 (superset kernel, recipe policy mask, ring demux)
          EL0: QuickJS (embedder w/ checkpoint+repair) | Lua | static native ELF
                    ▲
 jitk-vmm --watchdog: (shard,slot,gen,deadline) leases → kick owner → pidfd-kill shard

 OFFLINE: recipe → builder → CAS image → prepare (boot, init, CHECKPOINT) → snapshot → verify-restore
          grow loop → semantic + mutation gates → new superset kernel → new keys
 macOS:   same guest + ABI; one persistent HVF worker process per slot
```

Runtime process kinds: **Node, shard(s), watchdog** — 3 kinds, S+2 processes on Linux (today: N+2).
Moving parts: 11 → 13 core (+ snapshot/reset, + cache identity), per B's count; `/cap` files and
Cap'n Web are +1 each and must earn their gates.

## 4. Memory budget per VM (`glue-2m` class: ≤8 KiB source, ≤8–32 outstanding small calls, ≤64 KiB live data)

Merged from A/B/C allocations (bytes, **targets**; the ledger experiment replaces every row):

| Component | Allocation |
|---|---:|
| QuickJS private heap/allocator/atoms delta | 655,360–786,432 |
| Guest stacks, kernel globals, modified stage-1 tables | 131,072–262,144 |
| Rings + control | 81,920 |
| KVM VM/vCPU objects, `kvm_run`, stage-2 + host page tables | 393,216–524,288 (**least certain**) |
| Host run state (bindings, pending calls, staging) | 98,304–196,608 |
| Slot metadata + amortized shard/watchdog | 81,920–196,608 |
| **Total target** | **≤ 2,097,152 (2 MiB) peak; ~1.25 MiB while waiting; ~0.5 MiB clean shell** |

Shared once per host: kernel + runtime image (~2.8 MiB [M]), initialized heap clean pages, resources.
Today [M]: 10.657 MiB/VM (pre-direct-load), +0.997 MiB per MiB of resources.

**Capacity math (A, synthetic 64 GiB / 64-core host, 8 GiB reserved):** ~**28,600 concurrent runs at
2 MiB peak reservation**; 56 execution lanes → ~**39,000 runs/s at 1 CPU-ms** (19,600 at 2 ms).
vs today's 10.7 MiB → ~5,400. These are arithmetic on targets, valid only after gates 1–4 pass.

## 5. Latency/CPU budget (warm cache, slot available, one immediate tool)

| Step | Target µs |
|---|---:|
| MCP ingress + grant/prepared lookup | 60–250 (Node now; ≤70 native later) |
| Slot lease + deadline lease | 20–50 |
| Restore: discard private pages, CPU state, first faults | 100–375 |
| Uniqueness repair + late binding | 15–35 |
| Parse + run tiny JS | 40–200 |
| One tool round (ring → policy → reply) | 28–120 |
| FINISH validation + response | 70–160 |
| **Execute → result** | **≤1,000 p50 first gate; ≤250 stretch** |
| **Service CPU per tiny run (incl. reset/refill)** | **≤2 ms gate; ≤1 ms target** |
| **Per extra small tool call** | **≤30 µs p50 / ≤60 µs p99** (vs 102 µs implied today [M]) |

## 6. Build order and gates (each first spike < 1 day; no cloud)

| # | Step (synthesis exp.) | Pass | Kill |
|---|---|---|---|
| 0 | Memory + CPU ledger of current build, N=1/16/64/256 (E1) | ≤10% unattributed | — no density claims until closed |
| 1 | Remove per-run codec/prelude injection in `executor/code.ts` (cheap win, parked executor is ~2.5–3 ms vs raw 0.2–0.3 [M]) | ≥10% CPU or ≥100 µs p50 | revert |
| 2 | Minimal KVM shard in `kvm-dev`: empty VMs, owner threads, no devices (E3) | empty marginal VM ≤0.5–1 MiB | >1 MiB → rethink shard |
| 3 | Dirty census of snapshotted QuickJS: empty / one_tool / 64 KiB / 1 MiB JSON (E2) | small fixtures ≤2 MiB all-in | revise class |
| 4 | CoW restore ×1,000 → 10,000 with canaries + fresh entropy (E4) | p99 ≤1 ms, zero leaks | any leak blocks reuse |
| 5 | Ring + SUBMIT/WAIT, 1,000 held runs (E5) | fixed thread count, no lost wakeups, Promise.all overlap | WAIT pins threads → reject |
| 6 | Integrate Node policy + watchdog leases | tiny run ≤2 CPU-ms, echo gate, ≤50 ms kill | attribute; maybe Rust broker |
| 7 | HVF worker parity | own ledger published | keep as dev backend |
| 8 | Cutover: delete libkrun + TS physical pool from shipping path | clean-copy build/test | — |
| 9 | Native census + loader + byte stdout; semantic/mutation grow gates (E6, E7) | real jq/rg/sqlite work | unsupported → other tier |
| 10 | `/cap` files, blobs, Cap'n Web profile, Cloudflare demo | ≤10 µs extra/call, fits class | drop the feature |

**Metal:** gates 2–6 run functionally in nested KVM; no Linux performance claim until a metal Graviton
run (needs approval).

## 7. What would kill the architecture

- Empty KVM VM costs >1 MiB marginal, or small QuickJS runs dirty >~1 MiB → the 2 MiB class fails.
- Correct reset needs a reboot or >2 CPU-ms → snapshot reuse loses its point.
- WAIT cannot release threads → idle density fails.
- An equivalently isolated Hyperlight baseline matches density/throughput → keep jitk only for native Linux-ABI tools.

## 8. Pitch correction

Not "a kernel generated per task". It is **a computer per task, assembled in microseconds from shared,
pre-initialized parts that grow offline** — the per-task part is policy, capabilities and a few hundred
KiB of private pages.
