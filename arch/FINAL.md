# jitk: final status after 4 review rounds (2026-10-24)

## What exists (`arch/jitk/`, `make build test demo`)
A runtime for code-mode agents. Each JS snippet runs in a **fresh single-use microVM**: libkrun on HVF (macOS) or KVM (Linux). Inside the VM, a **1.4k-LOC Rust no_std kernel** runs **unmodified static QuickJS at EL0**. The guest's only I/O is a JSON-lines tool channel to a trusted TypeScript executor. The executor implements Cloudflare codemode's `Executor` and TanStack's `IsolateDriver`. The kernel's 17-syscall surface is **grown by an agent**: ENOSYS → Linux strace oracle → agent writes the handler → differential test in fresh VMs → versioned manifest.

| Component | Impl LOC |
|---|---|
| Kernel (`kernel/`), incl. build tooling | 1,740 |
| VMM (`vmm/`) + confinement (`vmm/sandbox/`) | 243 + 411 |
| Protocol (`protocol/`) | 661 |
| Executor (`executor/`) + policy (`executor/policy/`) | 807 + 146 |
| **Runtime total** | **~4.0k** |
| Owned total, incl. tests / bench / grow / Linux kit / docs | 9,409 |

Upstream libkrun patches (+174/−93) are counted separately.

## Gates
| Gate | Result |
|---|---|
| H1 clean-copy `make build test` | **PASS** (lead re-run after a 1-line import-guard fix; external inputs documented) |
| H2 `make demo`: executor → grow regrowth → Lua | PASS. Demo labels **REPLAY** by default; `--live` calls the agent CLI for real (3 calls, 90/90 differentials) |
| H3 Linux under nested KVM on this Mac | PASS: boot 100, tool 30, parking 1000, seccomp 720, faults 180 |
| H4 canonical bench | PASS, **contended only**: load 12–146 throughout because of a foreign job; no quiet sample |
| H5 hostile guest | Every attack run was contained with no host effect: protocol 570, VMM escape 12, policy 32, console abuse 270+270, faults 180+210. Deadline: the VM is killed ≤50 ms in 29/30 and 28/30 under load 64–113. API return during a *blocking host callback* is a host-contract issue (tools must be async). |

## Measured, same harness, interleaved, contended
| Median | jitk parked | Hyperlight parked (snapshot) | Hyperlight clone (shared VM) |
|---|---|---|---|
| return 2 | **1.07 ms** | 1.86 | 1.22 |
| one tool | **1.13 ms** | 2.78 | 1.70 |
| Promise.all(10), 5 ms tools | **9.5 ms** | 102 | 108 |
| 1 MiB JSON | **16.7 ms** | 30.9 | 23.3 |

Hyperlight wins on three counts:
- Cold `return 2`: 18 vs 25 ms.
- CPU per VM: ~9 vs ~14 ms.
- Memory: 1.8 vs 10.7 MiB footprint.

Hyperlight also cannot run static Lua; jitk runs Lua byte-identical to Linux.

## Open, ranked
1. **Linux bare-metal numbers.** CPU-ms/VM must be measured against the 5 CPU-ms kill line. The kit is one command; a c7g.metal spot run costs under $1. Needs user approval.
2. **Quiet-machine benchmark.** Every number so far comes from load 12–146.
3. **Memory gap vs Hyperlight (6×).** Options: share image pages across VMs with file-backed `MAP_PRIVATE` (measured 256 → 39 MiB PSS on 32 VMs; needs a libkrun loader patch), or a smaller guest.
4. **H5 gaps.** The Linux escape suite, EOF mid-call, and the full matrix on the final executor have not run.
5. **Reproducibility and size.** The Linux VMM build is not bit-reproducible. 9.4k owned LOC is over the 5.75k planning cap; the runtime alone is ~4k.
6. **Story honesty.** Lua already runs with ENOSYS defaults, so the growth for Lua is a verified contract, not "dead → alive". SQLite with time/random (+5 syscalls) is a stronger second-binary demo.

## Upstreamable to libkrun
- **Robustness patch.** It fixes ~30 guest-reachable panics plus the console spin and zero-length-RX bugs. This is the "v2" patch.
- **Console control-RX kick one-liner.**
- **HVF MMIO decode on ISV=0** (writeback loads).

Evidence: `REVIEW-R1..R4.md`, `DECISIONS-R1..R3.md`, `jitk/docs/CLAIMS.md`, `jitk/bench/RESULTS.md`, `10-minimalist-critic/r4/frozen/manifest.json`.

## Re-run 2026-10-24 (after the 4 rounds)
- **Mac `make build test`** in a fresh renamed copy passes every suite. Its last step, nested Linux, hit its 30-min timeout while a second 12 GiB VM was competing for memory. `make linux-nested` rerun alone: **PASS** (2:19). `make demo`: **PASS**.
- **Linux on Ubuntu 26.04 / kernel 7.0 / glibc 2.43**, nested KVM, `kvm-dev/`:
  - First run: the seccomp filter killed the VMM. glibc 2.42+ calls `madvise(MADV_GUARD_INSTALL/HUGEPAGE)`.
  - Fixed in `vmm/sandbox/mod.rs`, with a unit test.
  - `tests/run-unit.sh` never compiled on Linux; fixed with the VMM build's rlibs.
  - Then **full suite PASS**: parking 1000, boot 300, concurrency 1–16 ×200, density 256, seccomp 720, faults 180, 0 children.
  - Nested numbers only, at ~68 CPU-ms/VM. Results: `kvm-dev/results/ubuntu-nested/`.
- **Quiet canonical bench** (load 3.3–4.1, all 30/30 gated): `jitk/bench/RESULTS-quiet-2026-10-24.md`.

  | p50 | jitk | Hyperlight strict | HL clone |
  |---|---|---|---|
  | cold return2 | 5.9 ms | 4.8 ms | – |
  | CPU-ms/VM | **4.8** | 3.5 | – |
  | parked one_tool | **0.29 ms** | 0.65 | 0.57 |
  | parked Promise.all(10×5ms) | **6.5 ms** | 63 | 63 |
  | parked 1 MiB JSON | **4.5 ms** | 8.1 | 8.4 |
  | footprint | 10.7 MiB | 1.8 MiB | – |
  | refill | 684 VM/s @8 | | |

  On macOS, jitk is under the 5 CPU-ms/VM kill line.
- **New hot spot: the executor adds overhead.**
  - Cold `execute()`: 56 ms vs 6 ms raw.
  - Parked: 2.5–3 ms vs 0.2–0.3 ms raw.

## Python watchdog removed (2026-10-24)
- The executor used to spawn a Python watchdog for every VM. That cost ~50 ms on each cold `execute()`. It is replaced by one shared native watchdog per executor: `jitk-vmm --watchdog`, in `vmm/src/watchdog.rs`.
  - It stays a separate process, so it fires even when Node's thread is blocked.
  - It tracks VM exits via kqueue on macOS and pidfd on Linux, so it never signals a reused pid. The Python version had that race.
  - Malformed input or EOF kills every tracked VM.
- Verification:
  - Full `make build test` and `make bench`: EXIT 0, run from a fresh copy.
  - Deadline check: kill overshoot 1.75 ms on macOS (previous worst 143 ms under load). Linux pidfd test: 0.8 ms overshoot; watchdog startup 0.6 ms.
- Executor results, p50 (`bench/RESULTS-native-watchdog-2026-10-24.md`):

  | Case | Before | After |
  |---|---|---|
  | cold `return2` | 56.3 ms | **9.2 ms** |
  | cold `one_tool` | 56.9 ms | **9.6 ms** |
  | cold `Promise.all(10)` | 63.0 ms | **16.2 ms** |
  | parked | 2.4–2.9 ms | unchanged; the next target is the prelude/acorn path |
- The protocol test harness (`protocol/vm.mjs`) and the bench harness still use their Python watchdogs. Both are dev tooling, not the runtime path.

## Corrections (2026-10-24, from research/quickjs-verdict.md, verified by lead)
- **Hyperlight-js runs quickjs-ng 0.15.1, not Bellard QuickJS.** It pulls in rquickjs-sys 0.12.1, whose bundled header defines `QJS_VERSION_MAJOR 0`, `MINOR 15`, `PATCH 1`. That makes our jitk-vs-Hyperlight latency rows a whole-stack comparison, including two different engines. They do not compare engines.
- **`json1m` is a single 1 MiB string inside one JSON object** (bench/cases.json). It says nothing about structured JSON.
  - Structured JSON (7000 objects): Bellard takes 21 ms, about 3.2x slower than Node.
  - One parse+stringify of 1 MiB of structured JSON needs at least 8 MiB of JS heap. Our cap is 16 MiB.
- **Verdict:** keep QuickJS for glue-code workloads. The reasons are lowest RSS (2.1 MiB), 5 ms process start, and 47 µs per runtime+context.
- **Do not claim it is "fast":** 3–5x slower than V8 JIT on glue code, and about 13x slower on a first-run numeric kernel.
