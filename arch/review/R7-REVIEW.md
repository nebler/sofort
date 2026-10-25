# R7 code review: consolidated (2026-10-26)

Reviewed commit `bb95bf2` (R7 waves 1–3 merged). Four independent GPT-6.1-Sol reviews, each
read-only, plus the lead's notes from merging R7:

| Report | Angle | Findings |
|---|---|---|
| [R7-REVIEW-perf.md](R7-REVIEW-perf.md) | Performance, memory footprint (prototypes + fault counts, nested KVM) | 12 (P01–P12) |
| [R7-REVIEW-architecture.md](R7-REVIEW-architecture.md) | Simplicity, architecture, right primitives | 14 (A01–A14) |
| [R7-REVIEW-deadcode.md](R7-REVIEW-deadcode.md) | Dead code and dead weight | 12 now + 9 after cutover + archive list |
| [R7-REVIEW-rust.md](R7-REVIEW-rust.md) | Idiomatic, readable Rust (fmt/clippy run) | 20 (R01–R20) |

**Verified by the lead** (✓): read against the code at `bb95bf2`; the reviewer's reproduction
or measurement was not re-run unless stated. Lead notes are marked **L**.

## Answers to the four questions

1. **Are we building the right primitives? Mostly yes.** Keep: file-backed CoW restore
   (MAP_PRIVATE + MADV_DONTNEED), the control page + byte rings + MMIO doorbell, fixed owner
   threads, the stage-2 writable arena via memslots, per-profile prepared snapshots, the sealed
   memfd + eventfd IPC with a narrow N-API addon, and the grow loop's semantic/mutation gates.
   Change: **lease authority** (the shard arms/clears its own watchdog leases, A02), the
   **hand-written Rust JSON validator** (disagrees with Node's, A10), **reset scope** (discard only
   writable extents, P01), **per-run JS helper injection** (prepare helpers before the checkpoint,
   P02), and **native execution as a separate lifecycle** (A04/R07). No transport or VMM rewrite.
2. **Simplicity / architecture:** the biggest costs are three diverging execution lifecycles
   (libkrun, shard JS, shard native), ABI/layout constants duplicated across kernel/shard/C
   (A06), harness structure used as runtime module boundary (`#[path]` includes, two shard
   binaries; A13/R11), and test infrastructure that only works with hand-set env vars, `/tmp`
   builds and hand-prepared VM files (A07, **L**).
3. **Dead code: little real dead source, a lot of dead weight.** ~155 lines of dead source
   (unused `park` wrappers ✓, `kernel/bootstrap.js` ✓, stale `delegate.py` fallbacks, unused TS
   imports). But **27.5 MiB of generated test scratch is committed** under
   `kernel/test-work/` and rewritten by every test run ✓ (**L**: it also leaves read-only dirs that
   block `git checkout`). ~1,200 lines become removable after cutover (assembly-fixture shard,
   QEMU nested path). 202 MiB of evidence should move to an archive, not be deleted.
4. **Idiomatic Rust: not yet portfolio grade.** Grades kernel **C**, shard **C+**, VMM **B−**.
   Main issues: safe functions that hand out `&'static mut` to global state (R01), safe APIs
   that alias guest RAM (R05), `unsafe` without safety contracts (R06), `assert!`/`unwrap` on
   guest-controlled data (R03), hand-written FFI and magic numbers (R09), `#[path]` modules
   (R11). `cargo fmt --check` fails for kernel and VMM; clippy passes with 12–17 warnings per
   crate. The newer decoders (`streams.rs`) are the good model to copy.

## Ranked findings

### Tier 1: correctness/safety bugs, fix first (small effort)
| # | Finding | Sources | ✓ | Effort |
|---|---|---|---|---|
| 1 | **One malformed guest ring record aborts the whole shard** (all 64 slots): `assert!`/`unwrap`/`panic!` in the guest-record decoder with `panic = "abort"`. Convert to a per-run `GuestProtocol` error + slot reset. Also the bootstrap consumes a call ID before the size check, poisoning later calls. | A05, R03 | ✓ `real_kvm.rs:468–515`, `Cargo.toml:12` | M |
| 2 | **Seal check accepts unsealed files**: `fcntl(F_GET_SEALS)` returns −1 and `-1 & 7 == 7`. Peer could truncate the mapping → SIGBUS. | R02 | ✓ `ipc.rs:120` | <1 h |
| 3 | **Valid one-line `slots.json` silently drops syscalls**: `build.rs` parses JSON line by line; build still succeeds. Generate dispatch from the same parsed data as the manifest. | R04, A14 | ✓ `build.rs:40–42` | S |
| 4 | **Admission charges 2 MiB while a 4 MiB snapshot loads.** Reject non-glue-2m snapshots at startup; then derive the charge from the verified snapshot class. | A03 | ✓ `ipc_service.rs:44–48` | S |
| 5 | **Aliasing UB in safe APIs**: `fs::get` returns `&'static mut Open` (two calls alias); shard exposes `&[u8]` over guest RAM while writes happen. | R01, R05 | | M |

### Tier 2: boundary and lifecycle, before Linux cutover
| # | Finding | Sources | ✓ | Effort |
|---|---|---|---|---|
| 6 | **The shard has no OS sandbox** (only PDEATHSIG; no seccomp/Landlock/namespaces); the native worker inherits Node's full environment. Reuse the VMM's fail-closed confinement contract with shard-specific rules. | A01 | ✓ `ipc_service.rs:79–83`, `native.mjs:45` | L |
| 7 | **Watchdog authority sits with the watched shard**: the shard maps the lease board RW and arms/completes its own leases. Move registration to the trusted supervisor. | A02 | ✓ `lease.rs:62,145–188` | M |
| 8 | **Native is a second lifecycle**: own KVM_RUN loop, one slot per tool, serial admission, Node-timer-only deadline, restart on timeout. Run native jobs on the common owner pool with leases. | A04, R07, P06, P10 | | L |
| 9 | **Head-of-line blocking**: a busy guest blocks all slots and cancellation on its owner (a tiny job waited 319 ms behind a 300 ms lease). Add a bounded ready queue + quantum. | P03, A09 | | M |
| 10 | **One source of truth for ABIs/layouts + IPC version handshake**: arena GPA `0x81800000` in 3 places ✓, ring offsets as bare numbers in kernel/shard/C. Generate from one definition. | A06, R09, **L** | ✓ | M |
| 11 | **`make test` green ≠ shard certified, and not clean-clone runnable**: requires `JITK_VMM_BINARY` etc. pointing into `/tmp`, kvm-dev running, a hand-prepared snapshot in `/home/dev/r7-ipc/`; shard and native suites are not in the aggregate. | A07, **L** ✓ | ✓ | M |
| 12 | **Snapshot identity**: `.mem/.regs/.layout` are checked but not bound atomically to one verified identity. | A08, R13 | | S |

### Tier 3: performance and memory (measured, nested)
| # | Finding | Evidence | ✓ | Effort |
|---|---|---|---|---|
| 13 | **Reset discards all 32 MiB**, including immutable pages: discarding only the 1.36 MiB writable extents cut reset p50 2.54 → 1.12 ms and avoided 165 KVM fault events per run (prototype). | P01 | ✓ `real_kvm.rs:310` | S |
| 14 | **The 0.5 MiB/VM claim holds only for raw fixtures.** Real `execute` re-sends and compiles 2.3 KiB of codec/adapters per run: +172 KiB private dirty per slot, est. **~0.68 MiB/slot** on the integrated path (above the 0.6 target). Prepare helpers before CHECKPOINT. | P02 | | M |
| 15 | Node path: one-tool run = 13 stringify + 50 parse + 2 structured clones; IPC copies max-size slots (115 KB per one-call lifecycle). | P04, P07, A10 | | M |
| 16 | Ten replies → eleven guest exits (no batching); READY before slots exist (+266 ioctls on first use); double reset at re-admission. | P05, P08, P09 | | S–M |

### Tier 4: readability and hygiene
- `cargo fmt` for kernel and VMM; fix clippy warnings; `// SAFETY:` contracts on unsafe (R06).
- Replace `#[path]` includes with a shard library crate + thin binaries (R11, A13).
- Named constants for syscall numbers, ESR codes, offsets, GPAs (R09, R14, R19).
- Move JS fixtures out of Rust string literals (R20).
- Fold ring-only `#[cfg]` fd special cases into one fd table (A11, **L**: same console-fd check is copied into 4 handlers).
- Delete the dead-code "delete now" list; stop committing `kernel/test-work/`; archive evidence.

## Lead notes not raised by the reviewers
- **L1**: Live stack-guard (SSP) swap at the checkpoint needs every spanning frame built with
  `-fno-stack-protector` (`kernel/payload/ring-rng/`). Correct today, fragile to toolchain changes.
- **L2**: The second-QEMU HVF assertion spin behind the old nested suite is unexplained; Mac
  `make test` now depends on `kvm-dev` running.
- **L3**: The SQLite correctness corpus uses a 5-row, 8 KiB database: correctness, not scale.
- **L4**: `json64k` (structured 64 KiB JSON) needs glue-4m; v1 docs still describe one 2 MiB class.

## Recommended fix order
1. Tier 1 items 1–4 (about 3–4 days in total), with a regression test each.
2. Items 13 and 14: they change the v1 numbers we can claim, so do them before the metal runs.
3. Tier 2 (items 6–12) as the cutover-readiness work; fold into `arch/work/CUTOVER-PLAN.md` §2.
4. Tier 4 and the dead-code deletions alongside, in small commits.
