# Research round "next" — lead review and synthesis (2026-10-25)

Inputs: `01-snapshots-memory.md`, `02-vmm-density.md`, `03-compat-grow.md`, `04-runtimes-platforms.md`,
`05-io-caps-images.md` (five independent GPT-6.1-Sol reports, ~27k words total). This file is the
lead's merged verdict; the architecture round must treat it as the requirements input.

## Spot-checks against our code (lead-verified)

| Claim | Verdict |
|---|---|
| Loader accepts only static `ET_EXEC` AArch64, no interpreter, payload arena 0x400000–0x680000 (2.5 MiB) | **Confirmed** — `kernel/prepare.py:5,39,46,49` |
| Resources cost ~1 MiB host footprint per MiB (+0.997 MiB/MiB) | **Confirmed** — `kernel/RESULTS-fs.md:47-49` |
| "ASCII-only stdout" | **Partly**: the *frame protocol* is ASCII-escaped JSON (`protocol/bootstrap.js`), so JS output is fine; raw native-binary stdout (rg, sqlite3) has no byte channel yet |
| ~7.87 MiB of the 10.7 MiB/VM is unattributed | **Plausible arithmetic** (10.657 − 2.789 image copy); note the 10.7 figure predates the raw-direct-load patch, so the real current baseline is unmeasured |
| HVF: one VM per process | **Consistent with Apple docs** (`hv_vm_create` is per process); macOS needs a process-pool backend, not many-VMs-per-process |
| Graviton/Ampere exit costs | **Unverified** in all reports — needs metal |

## Where all five agree (high confidence)

1. **We cannot claim ≤2 MiB yet — we don't have a ledger.** Nobody can say where today's memory goes.
   Define the target as **marginal private memory per additional VM, for a declared small-request class**,
   reported alongside shared bytes, kernel/hypervisor charges and peak. (01, 02, 04, 05)
2. **The big memory win is sharing, not shrinking.** Share the kernel + runtime + resources as one
   immutable, file-backed, CoW-mapped snapshot; only dirtied pages are private. The image copy alone is
   ~2.8 MiB/VM, and resources add 1 MiB per MiB today. (01, 02, 05)
3. **The big latency/CPU win is restore, not boot.** Snapshot *after* QuickJS + bootstrap init at a
   device-free boundary; reuse pre-created VM slots. Hypothesis 0.1–0.8 ms restore, 1–2 CPU-ms per tiny
   run — unmeasured. (01, 02, 04)
4. **Snapshot reuse brings a reset contract.** Fresh entropy into userspace PRNG/hash seeds, clocks,
   registers, TLB/caches, ring state, no prior-tenant bytes. Must be a test gate, not a convention. (01, 02, 04)
5. **Thread pooling needs a real yield.** A VM blocked on a tool call pins a host thread unless the
   guest exits with WAIT and is resumed later. Required for thousands of mostly-idle VMs. (02, 05)
6. **Linux/KVM and macOS/HVF are two different backends.** KVM: many VMs per process (shard). HVF:
   persistent worker processes, one VM each, restored in place. (01, 02)
7. **Grants must bind late.** Recipe hash → immutable bytes; prepared-state key → snapshot; live
   capability table per run. Never bake authority into a snapshot. (05)

## Disagreements / open questions

- **Per-recipe kernels:** 03 estimates only 32–128 KiB / 5–19 µs upside and warns separate kernels break
  page sharing. Default: **one superset kernel per runtime image, per-recipe *policy* (allowed syscalls/
  files/caps), not per-recipe binaries** — until measured otherwise. This changes the pitch from
  "a kernel per task" to "a computer per task assembled from shared, grown parts".
- **Engine choice:** 04 says snapshots reopen V8/Hermes/JSC (2.5–5× faster JSON) at a memory cost.
  Keep Bellard QuickJS until a snapshot-aware shootout shows ≥20% end-to-end CPU win within budget.
- **Dirty working set may kill density** for JSON-heavy runs (8 MiB heap, 21 ms parse). Mitigation:
  keep big data outside the VM (blob handles, host-side projection), split request classes.

## Gaps and blockers (merged, ranked by threat to SCALE)

| # | Blocker | Threatens | Source |
|---|---|---|---|
| B1 | No memory ledger / dirty-page measurement | the ≤2 MiB claim itself | 01 02 04 05 |
| B2 | Process-per-VM VMM, image + resources copied per VM | memory | 01 02 05 |
| B3 | No snapshot/restore + reset contract | latency, CPU, correctness | 01 02 04 |
| B4 | Synchronous tool wait pins a thread | density of idle VMs | 02 05 |
| B5 | No Linux metal numbers (exits, restore, CPU) | every Linux claim | 02 04 |
| B6 | Loader: static ET_EXEC, 2.5 MiB arena, anon-RW mmap only, no byte stdout | rg/sqlite3/Go use cases | 03 |
| B7 | Grow loop proven only on 3 re-grown handlers; differential test = repetition | the "agent-grown" thesis | 03 |
| B8 | Threads/futex/signals absent and structural | Go/Node/parallel tools | 03 |
| B9 | No transport contract for `/mcp/` `/cap/` files; Cap'n Web unbounded; replay vs side effects | the Cloudflare demo | 05 |
| B10 | Competition: Cloudflare Python/Dynamic Workers, OpenAI V8 PTC, Hyperlight-Wasm | the niche | 04 |

## Experiments to run first (each < 1 day, all local or the dev KVM VM)

1. **Memory ledger** on current build (post raw-direct-load): PSS/private-dirty per VM, HVF/KVM charges, at N=1/16/64/256.
2. **Dirty-page census** of a snapshot-of-booted-QuickJS across empty / one_tool / 64 KiB JSON / 1 MiB JSON.
3. **Minimal KVM shard** (in `kvm-dev`, nested): many VMs, fixed owner threads, empty-instance marginal cost. Kill line: if empty VM > 1 MiB marginal, rethink.
4. **CoW restore loop** ×1000: p50/p99 restore + first-fault + refill CPU; uniqueness canaries.
5. **WAIT/resume** hypercall prototype: thread released during tool call, Promise.all behaviour preserved.
6. **ARM64 recipe census** of real jq/rg/sqlite/Go/Rust/Python binaries doing real work (not `--version`).
7. **Semantic differential tests** from gVisor/LTP + mutation of handlers.

## Strategy shift implied

The defensible core is: **shared immutable snapshot + tiny private delta + late-bound capabilities +
thread-free waiting**, on a kernel small enough that the delta stays tiny. The agent-grown kernel is
how coverage grows *offline*; it is not on the request path and should not be sold as per-request
kernel generation. Density/latency claims stay "target" until experiments 1–5 report.
