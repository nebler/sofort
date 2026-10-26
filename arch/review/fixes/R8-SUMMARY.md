# R8 fix wave: summary (2026-10-26)

Scope, approved by the user after the R7 review: Tier 1 bugs (#1–5), items 13 and 14 (reset
scope, per-run helpers), the dead-code list and the Rust idiom/hygiene findings (Tier 4).
Tier 2 (sandboxing, lease authority, native lifecycle, ABI generation) was **not** in scope.
Brief: `arch/work/R8-FIX-BRIEF.md`. Per-agent reports are in this directory.

## Status of the R7 findings

| R7 item | Finding | Status | Where |
|---|---|---|---|
| 1 | Malformed guest record aborts the whole shard (A05, R03) | **fixed**: per-run `GuestProtocol` error + slot reset; bootstrap call-ID ordering fixed | R8-shard, lead `00184fc` |
| 2 | Seal check accepts −1 (R02) | **fixed** | R8-shard |
| 3 | One-line `slots.json` drops syscalls (R04, A14) | **fixed**: one strict parse feeds dispatch and manifest | R8-kernel |
| 4 | Admission charges 2 MiB for any snapshot (A03) | **fixed**: charge from verified class; unsupported classes rejected | R8-shard |
| 5 | Aliasing `&'static mut` / RAM slices (R01, R05) | **fixed**: `with_open` exclusive borrow; RAM copied out | R8-kernel, R8-shard |
| 13 | Reset discards all 32 MiB (P01) | **fixed**: writable extents only; reset p50/p99 1.72/2.78 → 0.72/1.00 ms, faults 372 → 207/run (nested, indicative) | R8-shard |
| 14 | Helpers re-sent and compiled per run (P02) | **fixed**, target **not** met: shard+kernel 0.58 MiB/slot; incl. Node 0.63–0.66 MiB/slot (≤0.6 target) | R8-helpers |
| T4 | fmt/clippy, SAFETY contracts, named constants, `#[path]` modules, JS fixtures in Rust strings | **fixed** for kernel, VMM and shard: fmt clean, clippy 0 warnings incl. `undocumented_unsafe_blocks`; shard is a library crate | R8-kernel, R8-hygiene, R8-shardlib |
| T4 | Dead code D01–D12, committed test scratch | **fixed**: 173 files / 28.8 MB removed; suites run in place and fail if they change tracked files (`JITK_RECORD=1` to refresh evidence) | R8-hygiene, R8-receipts, lead `9fb6081` |
| T4 | Evidence archive (~212 MB) | **open**: inventory only, decision with the user | ARCHIVE-PLAN.md |
| R13, R15, R08, R18, R16, R17 | Snapshot/profile parse panics, unbounded reads, fallible Drop, FDT bounds, fd ownership, stage ordering | **fixed** | R8-shard, R8-kernel, R8-hygiene |
| 6–12 | Tier 2 | **open** (not in scope) | R7-REVIEW.md |
| 15–16 | Node frame round trips (P04), reply batching etc. | **open**; P04 needs an object-frame dispatcher | R8-helpers |

Rust grades after R8 are not re-reviewed; the measurable changes are: kernel and VMM `cargo fmt`
clean and clippy 0 warnings; shard `unsafe` sites 111 → 99, undocumented 87 → 0, largest function
255 → 120 lines (R8-shardlib).

## Changed artifacts
- Default kernel image `75b2abe2…` → `e3d774eb844f2cca9f1ba2b28c5b732c7ebc659e01dbafb0505d0d0f1d08b1f6` (`.READY`, executor certification PASS).
- VMM binary (Mac) `23ffc411…` → `af5ccbb3…` (certification PASS).
- Prepared QuickJS snapshot identity now binds helpers **and** `ring-bootstrap.js` (helper SHA `5711b5e3…`).
- `kvm-dev/start.sh`: `discard=unmap`, QEMU monitor socket, 6 vCPU / 9 GiB defaults.

## Final verification on main (lead)
- All 11 Mac suites PASS in place on `418fbd5` (kernel, vmm, vmm/sandbox, protocol, executor, executor/policy, mcp, grow, bench, bench/hyperlight, linux); `git status` clean afterwards.
- kvm-dev: `make -C arch/jitk/shard test` (29 Rust tests, 41/41 native cases exact twice, fd/region
  probes), `test-kvm` 5/5, 10,000 mixed restores (0 canary leaks, 0 cross-talk, 10,000 fresh
  entropy), IPC SSH test 121 assertions; paired reset/run timings and guest faults of the shard
  refactor equal to the pre-refactor build (3 alternating pairs, nested).
- Not measured after the shard refactor: per-slot private dirty (layout, snapshot and fault
  counts are identical, so no change is expected).

## Incidents
- **Mac disk full** (51 GiB → 118 MiB free) mid-round: Docker volumes/images (mostly other
  projects), 17 agent worktrees, the growing kvm-dev image. It killed one agent run, paused
  kvm-dev (QEMU stops the guest on ENOSPC) and wedged Docker. Recovered to ~90 GiB free; the
  restarted kvm-dev now trims and can be resumed via its monitor socket.
- The Docker image prune removed the locally built `jitk-oracle:08`; rebuilt from
  `arch/08-grow-loop/oracle` (new image ID `88f8f82b…`, strace 6.13; old `458a19a1…`).
- Lead error: wrapping shard `make test` in an outer `flock /home/dev/bench.lock` deadlocks (the
  harness takes the same lock).
