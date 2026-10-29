# R11 deep review (main 61bfba5e, 2026-10-29)

Three independent reviews of `arch/jitk` after HVF became the Mac engine and libkrun was deleted:
performance (measured), engineering practice, and abstractions/primitives. No code was changed by the
reviews. Mac numbers: M4 Pro, load 5–9. Linux numbers: nested KVM on kvm-dev, indicative only.

## Verdict

The core design is right and should stay. That means:
- a hardware VM per snippet, reset from a snapshot;
- a small kernel that runs unmodified static ELFs and parks asynchronously on tool calls;
- one ABI crate with codegen;
- `Engine`/`Session`;
- the `hv` seam.

Most of R9/R10 landed. Three structural faults remain:

1. **The Linux production engine is the unconfined one.** It has no seccomp, Landlock, namespaces
   or no_new_privs. The libkrun confinement (`vmm/sandbox/mod.rs`, 791 lines) was deleted, not
   reused (R10 #6 said reuse it). The Mac dev engine is Seatbelt-confined and tested.
2. **Receipts prove the wrong artifact.** `kernel/.READY` pins and gates the *console* image, while
   the product runs *ring* images and snapshots. Receipts also drive runtime behaviour: warm pools
   are enabled by a G1 receipt lookup in `select-backend.ts`.
3. **Two kernel profiles and two engine topologies.** Every future port pays for both:
   - console vs ring kernel: 47 `cfg` sites, about 990 console-only lines;
   - KVM `owner`/`lease` vs HVF `zygote`/`child`, which means two deadline designs.

## Performance (measured)

Baseline on HVF through the executor:
- 325 CPU-µs per run;
- p50 0.13 ms (`return 2`) and 0.20 ms (one tool call);
- about 21k runs/s, capped by Node's main thread at about 55 µs per run.

| # | Finding | Evidence | Win | Effort |
|---|---|---|---|---|
| P1 | Guest JS decodes and encodes byte by byte, at about 90 ns per byte of source, argument or result | `ring-bootstrap.js.in:15-28,119`; 8 KB source 714 µs, 60 KB 4.9 ms, 50 KB result 3.1 ms | 10–50× on payload-bound runs; about 20% of a minimal run | S–M, kernel change → re-promote |
| P2 | On KVM, ABI v11's bigger payloads overflow `copy_limit: 128`, so the reset discards pages and the next run refaults | `slot/reset.rs:63`; 50 KB result 47.5 → 7.8 ms guest CPU with limit 400 | about 6× on large runs | XS |
| P3 | glibc's per-thread malloc heaps sit on huge pages, costing about 9.7 MiB fixed per shard | smaps `hg`; 1-slot shard 10.85 → 1.12 MiB with `MALLOC_ARENA_MAX=1` | about 40% of a 64-slot shard's private memory | XS (mallopt; shard env is only `PATH`) |
| P4 | HVF's sampled pristine check compares all 30 MiB of immutable RAM inside `admit()` | `hv.rs:145`, `slot/reset.rs:205-230`; 5–11 ms spike about every 500 runs | removes the tail spike | XS |
| P5 | HVF message path costs 40–60 µs per run: two hops via the zygote, STATS and DONE as separate writes, 64 KiB zeroed per read | `hvf/child.rs:399`, `hvf/conn.rs:59` | 10–15% CPU | S, then M (hand sockets to Node) |
| P6 | Node overhead: a `DOMException` built on every successful run (about 10% of Node busy time); acorn throws on bare bodies; STATS+DONE+RELEASED not coalesced | `executor.ts:128`, `vendor/codemode.mjs:18` | raises the throughput ceiling | XS / M |
| P7 | KVM makes about 300 syscalls per one-tool run: 17.5 `wait4` (R9 #9 open), about 197 register-write ioctls | bpftrace; `lease.rs:330` | about 30–60 µs per reset on metal (estimate) | S / M |
| P8 | An idle KVM shard wakes 10×/s (100 ms poll) | `ipc.rs:205`; about 150k wakeups/s across 15.6k shards | idle cost at scale | S (pidfd in poll) |
| P9 | The Mac tops out around 60 VMs (`HV_NO_RESOURCES`; `kern.hv.max_address_spaces`=128) | measured | n/a: the Mac stays a dev engine | — |
| P10 | Nested-KVM throughput is bimodal (9.1k vs 0.55k runs/s) | measured | needs metal | — |

Keep:
- one copy-restore reset per run (ABI v11 did not regress reset);
- persistent zygote children with 0 idle CPU;
- clock-thread parking;
- batched replies;
- the FIFO admission queue;
- lowest-free-slot selection;
- non-executable writable memory.

## Engineering practice

| Area | Grade | Why |
|---|---|---|
| Test strategy | B | Real VM tests, shared hostile corpora, a 96-case parity corpus. No fuzzing, `hvf/console.rs` (675 lines, parses guest descriptors) has 0 tests, skips exit 0, and some tests depend on timing. |
| Reproducibility | B+ | sha-pinned, content-keyed cache; a fresh clone goes green. But `make test` fails at `mcp test` without `mcp build` (R9 N20.1 still open). |
| CI coverage | C | GitHub boots zero VMs. The KVM part runs only by hand on kvm-dev, HVF has no CI, and kernel `check.sh` and Linux clippy never run automatically. |
| Failure semantics | B+ | Rust uses typed `RunError` and scopes failures to the slot. The TS product path has 151 `throw Error(string)` calls, and failures are classified by regex. |
| Security practice | B− (Mac A−, Linux D) | `deny(undocumented_unsafe_blocks)`, 222 SAFETY comments for 233 unsafe sites; Linux shard unconfined. |
| Code style | C+ | Rust is rustfmt-clean. TS has no formatter: 295 lines over 200 chars, longest 843; IPC bound checks written as one-liners. |
| Docs accuracy | D+ | `docs/ARCHITECTURE.md` still describes libkrun; ARCH.md/PORT-PARITY name `e3d774eb`; PRODUCT-GAPS lists limits ABI v11 removed; about 10 dangling links. |
| Dead code | B− | Live code is clean. Left over: `hvf-spike/`, stale logs, `executor/.READY` (libkrun-era, still read by `bench/hyperlight/bench.ts:48`), about 1.2 GB of untracked `linux/`/`native/` locally. |
| Repo hygiene | C+ | 9 `.READY` markers with mixed meanings, 110 tracked files under ignored `grow/results`, `.git` 743 MB. |
| Agent-written signs | C+ | 46 review-round references and 10 date stamps in source comments; READMEs read like changelogs. |

## Abstractions and primitives

| Abstraction | Verdict |
|---|---|
| Snapshot slot + reset as the unit | **Keep.** Hyperlight's model, right for sub-ms snippets. Firecracker is the session tier; isolates and Wasm give up the hardware boundary. |
| Custom no_std kernel | **Keep.** Memory is only at parity with Hyperlight. It buys the async parked WAIT (9.5 ms vs 176 ms for promise10), static Linux ELFs (41/41) and GrowOS. |
| Ring + doorbell + records | **Keep the shape; move the limits.** Limits come from transport/v1 values (1 MiB reply) while the real bound is the glue-2m arena, hence the 2 OOM allowlist entries. Derive `Limits` from the arena class. `protocol/dispatcher.ts` (v1) still validates ring JSON. |
| Engine/Session/pool | **Keep.** Leaks: regex failure classification, `includes('policy denied')`, and `kind==='hvf'` capacity branches (`shard-backend.ts:154,159`). These should become typed codes and a `limits.restores` capability. |
| Policy layer | **Keep its place; reshape it.** Three deciders inline in `execute()` plus a JSON round trip; extract a `RunGovernor` holding run state (needed for pause/fork later anyway). |
| Node ↔ engine IPC | **Keep.** It is the confinement and crash boundary. Node, not the VM, is most of the CPU; batching is the next 2–4×. |
| `hv` seam | **Keep; neutralise.** Aarch64 leaks in the trait: `set_entry`, `redirect(pc,x4,x5)`, `Shutdown(psci id)`. The bigger unshared axis sits above it: process topology and deadlines. |
| Mac zygote | **Keep, as a dev engine.** Don't let Mac-only semantics (RESTORED) become ABI requirements. |
| `jitk-abi` + codegen | **Keep.** |
| scriptc for tooling | **Keep for tooling only.** Neutral-to-costly for jitk (13 gap/parity docs, hang workaround); keep the product path on Node. |
| `.READY`/receipts/evidence | **Reshape.** The principle is right but the binding is wrong: key receipts on the shipped ring snapshot `.identity`, run G1/G2 through the engine, and take receipts out of runtime selection. |
| Two kernel profiles | **Converge on ring.** Add a host-visible trace channel for GrowOS, port the kernel suites to native-worker, then delete console paths, `hvf console` and `protocol/bootstrap.js`. x86_64 is about 28–45 days with one profile, plus 5–8 days if console stays. |

Don't change:
- the slot model, the kernel, or the out-of-process engine;
- the ABI crate (keep it Rust);
- the zygote's basic design.

Don't port the executor to scriptc, and don't build tenancy yet.

## Ranked fix list (all three reviews combined)

Effort: XS < 1 h, S < 1 day, M = days, L = a week or more.

| Rank | Change | Source | Effort |
|---|---|---|---|
| 1 | Linux shard confinement: port seccomp + Landlock + no_new_privs + namespaces from `git show 66407590^:arch/jitk/vmm/sandbox/mod.rs`, plus a `real confine` self-test mirroring `hvf confine` | eng, arch | M |
| 2 | Quick perf wins: copy limit = whole writable window (P2), `M_ARENA_MAX=1` (P3), no pristine check of immutable RAM in `admit()` (P4), pre-built abort reason (P6), STATS+DONE single write and no 64 KiB zeroing (P5) | perf | XS each |
| 3 | `make test` self-sufficient (`test: build` / mcp deps); skips fail unless listed in `JITK_ALLOW_SKIP`; kernel `check.sh` + Linux clippy in `ci.sh` | eng | S |
| 4 | Docs truth pass: `docs/ARCHITECTURE.md`, PRODUCT-GAPS, README R4 paragraph, ARCH/PORT-PARITY sha, CONTRACTS libkrun sections → history; link check in `docs test`; drop review-round/date narrative from source comments | eng | S |
| 5 | Delete leftovers: `hvf-spike/`, stale executor logs/json, `executor/.READY` + its reader, dead `test-linux` guard in `ci.sh`, `/home/dev` defaults; local untracked `linux/`, `native/` | eng, arch | S |
| 6 | Guest native encode/decode fast path (P1) | perf | S–M + re-promote |
| 7 | Receipts bound to ring snapshot identity; G1/G2 through the engine; warm pools by config, not receipt lookup | arch | S–M |
| 8 | Limits derived from the arena class; typed failure/decision codes in TS; `limits.restores` instead of `kind==='hvf'` | arch, eng | S–M |
| 9 | KVM: pidfd in poll instead of `wait4` and the 100 ms tick (P7, P8); one supervisor-owned deadline model for both topologies (R10 #9) | perf, arch, eng | M |
| 10 | CI that boots VMs: a self-hosted runner on kvm-dev (nightly or per PR), and Mac `make test` | eng | M |
| 11 | Fuzz the guest→host boundary (`streams::drain`, call decode, console descriptor walk, TS IPC decoder); tests for `hvf/console.rs`; replace sleeps in the timing-dependent grow tests (`grow/test.ts:455,529`, the likely cold-clone flake) | eng | M |
| 12 | TS formatter/linter for executor/mcp/protocol | eng | S |
| 13 | Multi-shard Engine (S shards × K Node processes), the prerequisite for the million-VM demo | arch | M |
| 14 | Converge the kernel on the ring profile; neutralise the `hv` trait (prerequisites for x86_64) | arch | M–L |
| 15 | Shrink `.git` history and move `grow/results` to the evidence store before any OSS release | eng | M |
