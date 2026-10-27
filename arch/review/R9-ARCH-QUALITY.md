# R9 review: architecture and code quality (2026-10-27)

Reviewed `main` at `f3f14f0f`, read-only. The only files written are this report and `raw-r9-arch/`.
Scope: the status of the R7 findings that R8 left open, plus new architecture and quality
findings. Performance and memory belong to the parallel perf reviewer; perf items appear here only
where the cause is architectural. The kernel is reviewed at the design level because a parallel
agent is splitting it into `core` + `arch/aarch64` right now.

**What I ran** (all env vars unset):
- `make -C arch/jitk deps` (17 s) and `make build` (27 s).
- All 10 Mac suites through the delegate. Each passed (timings in `raw-r9-arch/mac-suite-timings.txt`): kernel 77 s, bench 43 s (15 s warm), grow 11 s, executor 9 s, vmm 9 s, protocol 4 s, mcp 4 s, the other three ≤1 s.
- executor, mcp, protocol and bench a second time: same results, no flakes.
- `git status` stayed clean after the suites.
- `make loc`, and `cargo +1.95.0 test` in `shard/` on the Mac (14 pure tests pass).
- A JSON-acceptance differential between the shard's Rust validator and Node `parseFrame` (`raw-r9-arch/json-divergence/`).
- Read-only `ls`/`du`/`cargo --version` on kvm-dev (`raw-r9-arch/kvm-dev-hand-state.txt`).

**Not run:** the `linux` suite (Docker build plus nested kvm-dev, ~minutes and Docker disk with ~15 GB free), shard `test-kvm`, and the executor shard-check over SSH. See §6.

Severity: **P1** is a correctness or isolation hole, or it blocks cutover or planned work.
**P2** is architecture debt with a concrete cost. **P3** is hygiene. Effort: S <1 day, M 1–3 days, L >3 days.

---

## 1. Top 10: do next (value per effort)

| # | Do | Effort | Unlocks | Ref |
|---|---|---|---|---|
| 1 | Make guest-originated payload errors in Node **slot-scoped** (kill that sandbox, not the channel), and drop the shard's general JSON parser for bounded opaque forwarding | S | One tenant can no longer kill all 64 slots with an 82-byte call | N1 |
| 2 | Pin the shard toolchain to `1.95.0` like every other crate; fix `shard/Makefile`, `run-ssh.ts`, `native.ts` and the README | S | Reproducible production binary; `make -C shard test` works on the Mac | N4 |
| 3 | `make -C shard snapshot`: prepare the helper snapshot into the jitk cache, keyed by kernel+helper hash, plus Linux `deps` entries (Node linux-arm64, shard binary). Delete the `/home/dev/r7-ipc` and `/home/dev/r6-census` defaults | M | Clean-clone shard tests (cutover step 5); fixes the rotted default snapshot | N5, R7#11 |
| 4 | One `jitk-abi` `no_std` crate for the ring and IPC layouts, used by kernel and shard; generate the TS/C constants from it and add an IPC version in READY | M | Removes ~40 hand-synced constants; prerequisite for x86 and for fork snapshots | N19, R7#10 |
| 5 | Replace the executor's internal "v1 wire frame" `Sandbox` interface with typed events; the v1 Dispatcher becomes the libkrun adapter's decoder | M | Removes per-message encode/parse round trips (R7#15); explicit run state for pause/fork; a native result mode | N7 |
| 6 | Move deadline authority to the Node-spawned `jitk-vmm --watchdog` (lease mode: shard pid, slot, generation, deadline); the shard only acknowledges | M | Fixes R7#7; deletes the shard's self-spawned watchdog (~400 lines) | N14, R7#7 |
| 7 | Backend-parity corpus: run the executor and MCP cases on `jitk` and `shard` and diff the results; make it part of a Linux `make test-linux` | M | Cutover precondition 5; documents the 1 KiB reply / no-timer / 8 KiB-source gaps as tests | N6, N20 |
| 8 | Delete dead code (synthetic shard, native-spike, local-qjs, unused fixtures/scripts; list in N18) and fix the doc drift list (N21) | S | ~1.5k fewer lines and ~60 fewer files; docs stop contradicting the code | N18, N21 |
| 9 | Kernel refactor target interface: `Arch` (trap/MMU/entry/counter/TLS/syscall numbers), `Transport` (console vs ring), host-testable `core` under `cargo test`; payload and memory class become runtime inputs, not build inputs | M (on top of the refactor) | x86_64 port; one kernel per (arch, transport); deletes the TS-generated `#[path]` test harnesses | N8, N9, N10 |
| 10 | Shard `Vcpu` backend trait (create, save/restore state, decode exits) with arm64 as the first impl; move the snapshot writer from the harness into the library | M–L | x86_64 shard; pause/resume/fork at a tool call; later an HVF runner (gate 7) | N11, N12 |

Counts of new findings: **P1: 3** (N1, N5, N6), **P2: 16**, **P3: 6**. Total 25.
R7/R8 carry-overs are counted separately in §2.

---

## 2. Status of R7 findings left open by R8

| R7 | Finding | Status 2026-10-27 | Evidence |
|---|---|---|---|
| 6 | Shard has no OS sandbox; native worker inherits Node's env | **Still open.** The JS shard environment is now `{PATH}` only, but there is still no seccomp, Landlock or namespaces. The native worker inherits Node's whole environment. | `shard/src/ipc_service.rs:83-91` (PDEATHSIG only; grep finds no seccomp/landlock in `shard/src`); `executor/shard-backend.ts:43`; `mcp/native.mjs:45` (no `env`) |
| 7 | Watchdog authority sits with the watched shard | **Still open** | `shard/src/lease.rs:245-296`: the shard creates the board memfd, maps it RW and self-execs its watchdog child. `lease.rs:177-190`: the shard writes deadline/tid/ARMED itself. Node's `armDeadline` only stores a number (`executor/shard-backend.ts:122`); its timeout calls `kill()`, which sends a cooperative IPC cancel (`executor.ts:39,75`) |
| 8 | Native execution is a second lifecycle | **Still open** | Own `KVM_RUN` loop at `shard/src/kvm/native.rs:165-171`, no lease. MCP has one serial worker: "Native worker is busy" at `mcp/native.mjs:75`. A timeout kills the worker for good: "restart the MCP server" at `mcp/native.mjs:73,81` |
| 9 | Head-of-line blocking on an owner | **Still open** | `owner.rs:556` calls `drive()` to completion or wait for each command. Static `slot % owners` mapping at `owner.rs:524`. No quantum or ready queue |
| 10 | One source of truth for ABIs/layouts; IPC version handshake | **Still open** | Hand-mirrored `kernel/src/ring_abi.rs:1-51` and `shard/src/constants.rs:1-91`; the shard file says generation "belongs to the separate ABI workstream" (`:1-2`). Offsets are hard-coded in C at `executor/ipc/bridge.c:16-20,58-73` and in TS at `executor/shard-ipc.ts:3`. No version field in READY. Full inventory: N19 |
| 11 | `make test` green ≠ shard certified; not clean-clone runnable | **Still open** | Root `Makefile` `test:` has no shard or native suite. `shard/Makefile:10` needs `JITK_SHARD_TEST_SNAPSHOT(S)`. `executor/run.sh:28-31` runs the shard only with `JITK_SHARD_TEST=ssh` or `JITK_SHARD_SNAPSHOT`. Defaults point at hand-made kvm-dev state that has since rotted (N5) |
| 12 | Snapshot identity not bound atomically | **Partly fixed.** Node now hashes `.mem/.regs/.layout` against `.identity` (`executor/prepared-helpers.mjs:18-26`). The shard re-opens the same paths afterwards (`shard/src/snapshot.rs:75-95`; TOCTOU) and never checks the identity itself | N15 |
| 15 | Node frame round trips (P04) | **Still open** | Every shard message is re-encoded as a v1 frame and fed through a Dispatcher: `shard-backend.ts:144` (`parseFrame('{"args":…}')`), `:149,151` (`feed(encode(…))`), `:164` (`'{"t":"done",'+text.slice(1)`). See N7 |
| 16 | No reply batching; READY before slots; double reset | **Still open** (code read; not measured). Each `Reply` command re-enters `drive()` (`owner.rs:397-420,556`). Slots are created lazily on first command (`owner.rs:526-541`). `begin()` resets again (`owner.rs:306`) after a `Reset` command already reset (`owner.rs:545-546`) | perf reviewer owns the numbers |
| T4 | Evidence archive | **Still open.** 9,217 tracked files / 222 MB under `raw*/`, `results/`, `out/` and `ledger/{raw,artifacts}` (of 345 MB in `arch/`). Includes >1 MiB duplicate pairs such as `grow/results/run-20261024T141804/qjs-{missing,after}/kernel{,-<sha>}.bin` (2.9 MB each). `ARCHIVE-PLAN.md` still cites `bench/ledger/verify.py`, which no longer exists | `git ls-tree -r -l HEAD arch` |
| T4/R11/A13 | `#[path]` modules; harness as runtime boundary | **Partly fixed.** The shard is now a library crate. But the kernel keeps `#[path="ring.rs"] mod console` and two `cfg_attr(path=…)` swaps (`kernel/src/main.rs:11,18,29`). The VMM keeps `#[path="../sandbox/mod.rs"]` (`vmm/src/confinement.rs:7`). The production shard binary is still the harness binary (N17) | |
| T4/R09/R19 | Named constants | **Partly fixed.** Literals remain: `0x324b544a` and version `2` at `kernel/src/ring.rs:75-76`; `NATIVE_FEATURES = 7` and `OUTPUT_LIMIT` redefined at `ring.rs:396-397`; header size `32` at `shard/src/streams.rs:69-72` | |
| R10/R14 (kernel) | Public mutable node structs; syscall argument slices | **Partly fixed, deferred to the kernel refactor.** Some handlers take `&[usize; 6]` (`syscalls/brk.rs:4`), others still take `&[usize]` (`syscalls/close.rs:1`) | not re-reviewed line by line |
| R12 | Long loops and bool combinations | **Partly fixed** (largest shard function is 120 lines per R8). `Mode` mixes production and fixture modes (`owner.rs:20-26`: `Run/Wait/Ready/Retain/Policy`) | |
| A10 | Two JSON validators disagree | **Still open, and worse than "P2":** reproduced, and it kills the whole shard. See N1 | `raw-r9-arch/json-divergence/` |
| A11 | fd table across transport flags | **Not re-verified** (kernel refactor in flight). Recommendation folded into §5 | |
| A12 | Host-scalar time, not a clock | **Still open** | `kernel/src/arch/aarch64/wait.rs:1-7` ("time is frozen while a CPU job runs") |
| A14 | Grow couples to the libkrun/console guest | **Still open.** Grow builds `build.sh --features qjs,grow-trace` (`grow/runtime.ts:97`), i.e. the console kernel, while the Linux shipping target is the ring kernel | N25 |
| C01 | Synthetic v0 shard | **Still present**: `shard/src/main.rs`, `src/synthetic/` (982 lines), `guest/stub.S`, `run.sh`. `cargo test` builds it, but it has 0 tests and no caller | N18 |
| C02 | QEMU nested backend | **Still present** (`linux/prepare-nested.sh`, `JITK_NESTED_BACKEND=qemu` at `linux/run.sh:12-15`) | keep until the SSH suite covers it |
| K11/K12 | Stale R4 docs presented as current; MCP "one tool" | **Still open** | N21 |
| L1 | SSP swap at checkpoint needs `-fno-stack-protector` | **Unchanged** (not re-verified) | |
| L2 | Mac `make test` depends on kvm-dev | **Unchanged.** `docs/dispatch.ts:98-100` defaults `JITK_NESTED_SSH` to `kvm-dev/ssh.sh` | |

Tier 1 items 1–5 and 13–14 were spot-checked and stay fixed. The seal check returns errors on
`<0` (`shard/src/ipc.rs:29-33`), and `kernel/build.rs:53` parses `slots.json` once. #1 is
undermined from the Node side, though: see N1.

---

## 3. New findings

### A. Boundaries and primitives

**N1 (P1). One guest call kills the whole shard via the Rust/Node JSON disagreement. Effort S.**
- *Evidence:* `raw-r9-arch/json-divergence/`. The real `ipc_json::{arguments,request}` and Node's `parseFrame` were compared on the same bytes. The 82-byte call `["call","ns","fn",[[[…31…0…]]]]` gets `args true / req true` from Rust and is rejected by Node with `DEPTH`.
- *Path:* Rust accepts it (`shard/src/kvm/mod.rs:463`, `owner.rs:357`) and forwards it. Node wraps it in `{"args":…}` (`executor/shard-backend.ts:144`) and `parseFrame` throws inside `SharedChannel.poll` (`executor/shard-ipc.ts:30,44`). That calls `fail()` → `ShardBackend.die()` → SIGKILL of the shard, and **every one of the 64 sandboxes fails**.
- *Reachability:* tenant JS reaches this with `tools.x.y(<30-deep array>)`. The ring bootstrap only checks `b.length>1024` (`kernel/ring-bootstrap.js:23-25`).
- R8's Tier-1 #1 made guest errors slot-scoped in Rust. Node still treats guest content errors as connection corruption.
- *Change:*
  1. In `ShardSandbox.receive`, catch schema errors on guest-originated payloads (CALL/DONE/LOG) and fail only that sandbox (`s.failed()` plus `IPC.cancel`). Keep `die()` for envelope, identity and state violations.
  2. Parse `m.bytes` directly; don't wrap it.
  3. Replace `ipc_json.rs` (312 lines) with length, ASCII and identity checks. Node is the policy authority and already parses everything. If Rust must keep a check, share one acceptance corpus (these vectors) between `protocol/` and shard tests.
- *Unlocks:* the shard as a safe shared failure domain, which the million-VM demo needs.
- *Not run end to end on KVM:* the chain is verified component by component.

**N2 (P2). Two guest wire protocols and two kernels stay indefinitely. Effort L. Decision needed.**
- The Mac keeps libkrun, virtio-console, JSON-lines v1 (`protocol/bootstrap.js`) and the console kernel. Gate 7 is deferred (`arch/V1.md:44,70`).
- Linux gets ring ABI-R7, `kernel/ring-bootstrap.js` and the ring kernel.
- The consequence is two of each: bootstraps (134 vs 58 lines), kernel builds (49 `transport-ring` cfg sites, `grep -rn transport-ring kernel/src | wc -l`), watchdogs (N14), executor lifecycles (process pool vs shard IPC), and test stacks.
- The planned cutover deletes libkrun on Linux only (`arch/work/CUTOVER-PLAN.md` §1).
- *Change:* treat "HVF runner on the shard's `Slot`/`Vcpu` abstraction" (N11) as the path that deletes the console transport everywhere. Until then, keep v1 at the edge: libkrun adapter only (N7).
- *Unlocks:* one guest ABI, one kernel per arch, and the deletion of `protocol/bootstrap.js`, `fdt.rs`, `console.rs` and `wait.rs` (WFI).

**N3 (P2). The C N-API bridge is the right primitive, but it is built and versioned outside every build. Effort S.**
- *Keep:* memfd + eventfd + an SPSC ring, with copies out of the hostile mapping (`executor/ipc/bridge.c:1,58-73`). This is narrow and standard; a Rust addon would not be simpler.
- *Problems:*
  - It is compiled ad hoc by `executor/ipc/build.sh` only on Linux and only when `JITK_BACKEND=shard` or `JITK_SHARD_SNAPSHOT` is set (`executor/run.sh:11-13`).
  - It needs `JITK_NODE` headers and a system `cc`.
  - Its geometry is hard-coded: `CAP`, `PAYLOAD`, and cursor offsets 64/128/192 at `bridge.c:16-20,58,65,73`.
  - There is no ABI or version check against the shard.
- *Change:* generate a `bridge_abi.h` from the N19 ABI crate, build the bridge in `make build` on Linux into `executor/build`, and add the IPC version to READY.

**N4 (P2). The production shard binary is built with a floating toolchain. Effort S.**
- `shard/Makefile:3,11-12` uses `cargo +stable`, and so do `executor/ipc/run-ssh.ts:64-65`, `shard/native.ts:82` and `shard/diagnostics.ts:192`. Every other crate pins 1.95.0.
- On kvm-dev `stable` is cargo 1.99.1. On the Mac it is 1.85.0, so `make -C shard test` fails ("jitk-shard@0.1.0 requires rustc 1.95"). With `+1.95.0`, 14 tests pass on the Mac. Evidence: `raw-r9-arch/kvm-dev-hand-state.txt`.
- `shard/README.md:11` documents `cargo +1.95.0`.
- `shard/harness/prepare-helpers.mjs:23` builds the ring kernel with bare `cargo`, i.e. whatever the default toolchain is.
- *Change:* pin `1.95.0` everywhere through `tools/deps.json` `vmm_toolchain` (rename it to `rust_toolchain`).

**N14 (P2). Three watchdogs, and the one with authority is in the wrong process. Effort M.**
- The three: `vmm/src/watchdog.rs` (315 lines, Node-spawned, pidfd/kqueue), `shard/src/lease.rs` (631 lines; the shard self-execs `real watchdog` as its own child, `lease.rs:268-291`), and `protocol/watchdog.ts` (dev).
- *Change:* extend `jitk-vmm --watchdog`, which Node already spawns for the libkrun path, with a lease mode:
  - Node writes (shard pid, slot, generation, deadline) when it sends START.
  - The watchdog kicks the owner tid via the shard pid (tid reported in an ack), then pidfd-kills.
  - The shard only acknowledges stop or reset.
- This fixes R7#7 and deletes the shard's watchdog-process code and its board-creation authority.

**N15 (P2). Snapshot verification has a time-of-check/time-of-use gap and a duplicated identity model. Effort S.**
- Node hashes three files (`executor/prepared-helpers.mjs:18-26`) and then passes a *path* to the shard (`shard-backend.ts:43`). The shard opens them again (`shard/src/snapshot.rs:75-95`).
- The shard checks the layout against the image but never the identity. The identity binds `helperSha256` and file hashes, but not the kernel image or the shard ABI version.
- *Change:* Node opens the files `O_RDONLY`, verifies them, and passes the fds. The shard already inherits fds (`Endpoint::inherited`, `ipc_service.rs:104`). Add `kernel_sha256` and `abi_version` to `.identity` and check them in Rust too.
- *Unlocks:* content-addressed prepared snapshots (cache keys in ARCHITECTURE §1) and fork snapshots (N12).

**N16 (P2). `native/` is a hand-maintained fork of the trusted core. Effort S to decide; L to adopt.**
- It holds parallel ports of `executor/*.ts`, `policy`, `protocol/dispatcher.ts` (4 lines differ, `native/README.md:63`) and a hand-written MCP server.
- It is outside `make test` and `make loc` (`docs/count-loc.ts:8`), and macOS only. Its README requires "differential tests here" for every future rule change (`native/README.md:66-70`); nothing enforces that.
- On Linux the trusted core needs the N-API bridge, which native does not have (`native-spike/REPORT.md:72`).
- *Change:* pick one. Either (a) Node stays the trusted core (ARCHITECTURE §2.1 decision B), so move `native/` and `native-spike/` out of `arch/jitk` as a frozen experiment. Or (b) native becomes the core, so generate `native/protocol.ts` from `protocol/dispatcher.ts`, add `native` to `make test` with the canonical suites, and plan memfd/eventfd FFI for Linux.
- Today it doubles the policy surface without a gate.

### B. Execution model: what blocks pause/resume/fork and a million fresh VMs

**N7 (P2). The executor's internal interface is the v1 wire format. Effort M.**
- `Sandbox.send(frame)/read(): frame` (`executor/backend.ts:18` family) carries JSON-lines v1 frames.
- The shard adapter therefore re-encodes binary IPC into frames and back:
  - `feed(encode({t:'call',…}))` at `shard-backend.ts:149`
  - `parseFrame('{"args":'+…+'}')` at `:144`
  - `parseFrame('{"t":"done",'+text.slice(1))` at `:164`
  - `ascii(JSON.stringify(…))` per reply at `:204`
- This is R7#15/P04 and also the cause of N1.
- *Change:* a typed `Sandbox` event API: `next(): Promise<{kind:'call',id,ns,fn,args} | {kind:'log',…} | {kind:'done',result} | {kind:'error',…}>` and `reply(id, Result)`. The libkrun backend keeps the v1 `Dispatcher` as its decoder. The shard backend decodes binary records directly.
- *Unlocks:*
  - Fewer Node CPU-µs per call (gate 6's 100 µs/run TS budget).
  - Run state that is explicit and serializable (pending ids, call counters), which pause/fork needs.
  - A natural `native` result mode for N-tier tools (R7#8).

**N12 (P2). Pause/resume/fork at a tool call: half of the primitives exist. Effort M–L.**
- *Exists:*
  - `Slot::capture()` gets the full register list (`shard/src/kvm/mod.rs:162-181`).
  - `Slot::bytes(0,RAM)` plus a snapshot writer, but only in the offline harness (`shard/src/bin/harness/prepare.rs:39-75`).
  - A MAP_PRIVATE CoW base with writable extents known per class (`kvm/mod.rs:215-229`).
  - A per-restore entropy/identity repair hook (`ring-bootstrap.js:46-53`).
  - Parked-at-WAIT slots that hold no thread (`owner.rs:1-3`).
- *Missing:*
  1. A library-level `Slot::checkpoint() -> Delta`. Only writable extents differ from the base (the 1.36 MiB class arena + 80 KiB rings), so a fork is base + delta, not 32 MiB.
  2. Run state lives in three unserialized places: Node `ShardSandbox` (`pending`, `nextWire`, `nextCall`, Dispatcher state, `shard-backend.ts:100-118`), Rust `Managed` (`pending`, `seen`/`replied` bits, `policy_sent`, cursors, `owner.rs:282-293`, `kvm/mod.rs:123-133`), and the guest ring.
  3. Guest time is a host-published scalar (A12). A resumed or forked run needs an explicit clock rebase.
  4. The resume path must re-run repair, so a fork gets fresh entropy and not the parent's.
- *Semantics:* fork after the CALL record is committed and before RET, so each branch gets its own reply. That fits "no automatic replay".
- *Change:* do N7 first (explicit host state), then `checkpoint/restore_delta` in the shard library and a `PAUSED` slot state that releases the owner.

**N13 (P2). Hard caps and missing queueing block a "million fresh VMs" throughput demo. Effort M.**
- *Caps and behavior:*
  - One `ShardBackend` per executor (`select-backend.ts:29-34`).
  - Hard caps of 64 slots and 4 owners on both sides (`shard-backend.ts:38`, `ipc_service.rs:10,74-81`).
  - `park()` throws `'shard pool saturated'` instead of queueing (`shard-backend.ts:77`), so a load generator sees errors, not backpressure.
  - Slots are built lazily on first command (`owner.rs:526-541`; R7#16).
  - There is a second full reset per admission (`owner.rs:306` after `:545`).
- *Architectural perf points* (perf reviewer to measure):
  - The reset restores *every* register with one `KVM_SET_ONE_REG` each (`kvm/mod.rs:180-184`; >68 registers by loader rule, `.regs` is 6,368 B).
  - Replies are copied to the guest one byte per `copy()` call (`kvm/mod.rs:534-536`).
- *Change:*
  1. A Node `ShardPool` over S shards with a bounded admission queue.
  2. Prewarm all slots before READY.
  3. Skip the reset in `begin()` when the slot is known pristine.
  4. Restore only the registers that are not invariant across runs.
  5. Bulk-copy replies.
- *Unlocks:* a throughput number limited by CPU, not by API errors.

**N6 (P1, cutover). The shard path is not feature-equal to the shipping path, and no test compares them. Effort M.**
- *Gaps vs libkrun:*
  - Tool replies are capped at **1,024 bytes**; a larger reply becomes a `LIMIT` error (`shard-backend.ts:205`, `ipc_service.rs:200`, `kernel/src/ring.rs:11`).
  - No timers, deliberately (`ring-bootstrap.js:2`, vs `protocol/bootstrap.js:85` `setTimeout`).
  - Tenant source is limited to 8 KiB *including* adapters (`shard-backend.ts:15`).
  - Admission reserves 2 MiB (`shard-backend.ts:21,199`).
  - Saturation throws (N13).
- These are documented in `executor/ipc/ABI.md:34-37,66-67`, but no test asserts them side by side.
- Cutover precondition 5 ("one suite covers both paths", `CUTOVER-PLAN.md` §2) has no implementation.
- *Change:* a corpus runner that executes the executor and MCP cases on both backends and diffs `(result, logs, error class)`, with an allowlist file for documented differences. Run it on kvm-dev from one entrypoint.

### C. Duplicated sources of truth

**N19 (P2). Inventory, verified by grep (the full list from the sweep is folded in). Effort M.**

| Fact | Definition sites (none generated from another unless noted) |
|---|---|
| Ring/control layout | `kernel/src/ring_abi.rs:2-51` and `shard/src/constants.rs:4-59`. The values match, but each side has fields the other lacks (kernel: `WAIT_EPOCH`/`WAIT_MASK`/`DEADLINE`; shard: `RING_LIMITS`/`CALL_LIMITS`/`REPLY_READY`). The kernel stores GPAs, the shard stores offsets (`ARENA_OFFSET=0x1800000`). RX is derived in the kernel but a literal `CONTROL+0xc000` in the shard |
| Arena GPA `0x81800000` | `ring_abi.rs:5`, `--defsym` in `kernel/build-ring.sh:22` **and** `shard/harness/prepare-helpers.mjs:25`, and the shard offset |
| Ring fds 100/101/102/128+id | `ring_abi.rs:46-51`; literals in `kernel/payload/ring-rng/checkpoint.h:20` and `kernel/ring-bootstrap.js:18,30,38` |
| Call budget 32 / 1024 B | `constants.rs:15-16`; `kernel/src/ring.rs:11,26,148`; `ring-bootstrap.js:23-25`; `ipc_service.rs:52-53`; `executor/shard-backend.ts:131,199`; `executor/shard-ipc.ts:3` |
| Host IPC geometry | `constants.rs:69-91`; `bridge.c:16-20,58-73`; `shard-ipc.ts:3` |
| Layout record | `kernel/src/arch/aarch64/page_tables.rs:24-34` and `shard/src/arena.rs:43-53`. **Checked**: the image scan at `bin/harness/prepare.rs:14` and the `.layout` check at `snapshot.rs:80`. This is the model to copy |
| Protocol v1 | `protocol/dispatcher.js` is generated from `.ts` and checked (`protocol/build.mjs`). `native/protocol.ts` is a hand fork. Limits are re-typed as literals in `protocol/bootstrap.js:5-79` and `bench/hyperlight/bootstrap.js:37` |
| Syscall numbers | `kernel/slots.json` (source, generates dispatch), `kernel/src/syscalls.rs:1-8`, `grow/normalize.ts:36`, `grow/adapters.ts:6` |
| Rust 1.95.0 | `tools/deps.json:19` (used only for a cache fingerprint), plus ~20 literal sites: `vmm/build.ts:20`, `kernel/build.sh:14`, `kernel/check.sh`, `kernel/Makefile:22`, `kernel/build-checks.ts`, `linux/run.sh:39-42`, `vmm/sandbox/tests/run-unit.sh:13`, grow host-tests… The shard uses `+stable` (N4) |
| Node | `tools/deps.json:4` (24.22.1) vs `executor/ipc/run-ssh.ts:13` and `measure-helpers.ts:13` (24.13.0 under `/home/dev/r7-ipc`) |
| zig | absolute `/Users/noah/.local/share/zig-0.16.0/zig` in `tools/pin.mk:9`, `kernel/zig-cc.sh:3`, `vmm/zig-cc.sh:3`, `executor/zig-cc.sh:3`, `grow/phase2.ts:71,173`, `scriptc-corpus/*` |
| libkrun commit `a1d8616` | `vmm/build.ts:7`, `vmm/relink.ts:38`, `linux/build.ts:247`. Not in `deps.json` |
| Artifact env resolution | `tslib/deps.ts` is canonical, but `JITK_VMM_BINARY` is re-resolved at `executor/backend.ts:89`, `executor/select-backend.ts:38`, `bench/controller.ts:291`, `kernel/tests/host.sh:5` (`vmm/dist`), `native*/benchmark.mjs`. The Hyperlight worker/snapshot fallback is written three times (`bench/hyperlight/bench.ts:15-17`, `config.ts:8-10`, `build.ts:46,64`). The kernel image default appears 5 times |

*Change:*
1. A `jitk-abi` `no_std` crate (layout, kinds, limits, fds, IPC geometry, version). The kernel and shard depend on it; a tiny `build.rs`/scriptc step emits `abi.ts` and `bridge_abi.h`; `ring-bootstrap.js` gets its constants injected at prepare time.
2. `tools/deps.json` becomes the only pin file (rust, nightly, node, zig, libkrun, hyperlight). All scripts read `deps env`.
3. Delete the parallel resolvers.

*Unlocks:* x86 (per-arch GPAs in one place), fork snapshots (versioned layout), and safe ABI evolution.

### D. Kernel (design level, for the in-flight refactor)

**N9 (P2). Today `arch/aarch64` means "ring transport", not "architecture". Effort M, within the refactor.**
- `kernel/src/main.rs:6-35` selects the ring variant by swapping modules: `#[path="ring.rs"] mod console`, `cfg_attr(path="arch/aarch64/wait.rs")`, `cfg_attr(path="arch/aarch64/page_tables.rs")`.
- `src/boot.S` and `src/arch/aarch64/boot.S` differ in one instruction (`wfi` vs `yield`, line 34).
- aarch64-specific code (asm/ESR/TTBR/barriers) sits in 9 files outside `arch/` (`grep -rcE 'asm!|msr |mrs |ESR|ttbr|tlbi|dsb |isb' kernel/src`).
- Host unit tests are TS-generated `#[path]` harnesses with stub modules, compiled by bare `rustc` (`kernel/build-checks.ts:50-90`), not `cargo test`.
- The proposed interface is in §5.

**N8 (P2). The kernel image bakes in payload, script, argv and memory class. Effort M–L.**
- `global_asm!(.incbin payload.flat)` (`main.rs:21-25`). `JITK_ELF`, `JITK_SCRIPT`, `JITK_ARGV_JSON` and `JITK_RESOURCES` are read by `build.rs:28-41`. The class is `--cfg ring_glue_4m` (`build-ring.sh:17-22`).
- Every profile is therefore a kernel rebuild. There are 8 separate kernel-build invocation sites (`kernel/build.sh`, `build-ring.sh`, `check.sh`, `tests/run-probes.ts`, `shard/harness/prepare-helpers.mjs`, `shard/native.ts`, `shard/harness/mutate-libc-r7-rng.sh`, `linux/run.sh`) with different toolchain selection.
- This contradicts ARCHITECTURE §1: "one superset kernel per runtime ABI, per-recipe policy".
- *Change:*
  - Kernel per (arch, transport).
  - The payload ELF and bootstrap become a separate read-only extent, like the native input archive at `0x82000000` (`ring_abi.rs:4`).
  - The class comes from the layout record at boot.
  - The prepared snapshot key = (kernel hash, payload hash, helper hash, class).
- *Unlocks:* an x86 build matrix of 2 images, not N; cheaper grow transactions; per-recipe profiles without kernel builds.

**N10 (P2, x86 blocker). The syscall registry is keyed by aarch64 numbers. Effort S–M.**
- `kernel/slots.json` maps `"63": "read"` etc. The same numbers are in `syscalls.rs:1-8`, `grow/normalize.ts:36` and `grow/adapters.ts:6`.
- x86_64 needs different numbers plus legacy entry points (`open`, `stat`, `access`, `pipe`, `arch_prctl` for TLS).
- *Change:* make the registry name-keyed (`read → handler`), with per-arch number tables generated in `build.rs`. Grow observes names (strace already gives names) and maps per arch.

**N25 (P2). GrowOS accepts syscalls on the transport that is being retired. Effort M.**
- Grow builds and runs the console kernel through libkrun (`grow/runtime.ts:87-112`). Grown handlers are never exercised in the ring kernel or the shard (A14).
- `grow/experiments-main.ts:41` hard-codes `/tmp/growos-inputs-20261026/sqlite3-static`.
- *Change:* after N8/N9, run grow differentials on the ring kernel through a `shard native-worker`-style runner on Linux (keep libkrun on the Mac for agent iteration). Add the ring build to grow's acceptance.

### E. The shard on x86 and the Vcpu boundary

**N11 (P2, x86 blocker). The shard is arm64 by construction. Effort M–L.**
- `shard/build.rs:12` asserts `aarch64`. It compiles and *runs* `abi.c` against host UAPI headers, so there is no cross-build. `abi.c` emits `KVM_ARM_*` and `ARM64_SYS_REG` constants.
- The snapshot format `JTKREGS2` is the arm64 `KVM_GET_REG_LIST` (`snapshot.rs:50`: `id >> 56 == 0x60`).
- vCPU init is `KVM_ARM_PREFERRED_TARGET`/`VCPU_INIT` (`kvm/mod.rs:116-119`).
- Every Linux module is `cfg(all(target_os="linux", target_arch="aarch64"))` (`lib.rs:7-22`).
- *Change:*
  - A `Vcpu` trait: `create`, `save() -> ArchState`, `restore(&ArchState)`, `run() -> Exit{Mmio, Shutdown, …}`. arm64 = ONE_REG; x86 = `KVM_{GET,SET}_{REGS,SREGS,FPU,MSRS,XSAVE}`.
  - Versioned per-arch snapshot headers.
  - Replace `abi.c` with checked-in generated constants per arch, or the rust-vmm `kvm-bindings` crate, if the libc-only rule can bend.
  - The MMIO doorbell and ring are arch-neutral already.
- *Unlocks:* x86_64, and the same trait for an HVF runner (gate 7, N2).

### F. Test architecture

**N5 (P1, cutover). Shard and native tests depend on hand-made kvm-dev state, and that state has rotted. Effort M.**
- `executor/ipc/run-ssh.ts:10-15` defaults to `/home/dev/r7-ipc/prepared` and Node `node-v24.13.0` there. That snapshot is from Oct 25, before R8, and has **no `.identity`**: `ls -la /home/dev/r7-ipc/` in `raw-r9-arch/kvm-dev-hand-state.txt`. `verifyPreparedSnapshot` therefore throws `stale shard snapshot` (`executor/prepared-helpers.mjs:19-22`). *Inferred from code + file listing; not executed.*
- Every later round prepared its own snapshot (`r8-lead`, `r8-shardlib`, `r9-shard-ts-port`, `perf-r9…`, `linux-mem…` each hold a `helpers.identity`).
- `make -C shard test` runs `check-native-r7`, which reads `/home/dev/r6-census/raw/*/metadata.json` and `/home/dev/r6-census/fixtures/data/demo.db` (`shard/native.ts:165,223`; 2.9 GB private state).
- `test-kvm` needs `JITK_SHARD_TEST_SNAPSHOT(S)` (`shard/Makefile:10`).
- `make deps` builds only darwin artifacts (`tools/deps.json`).
- *Change:*
  - Linux `deps` entries: Node linux-arm64 (sha already pinned), the shard binary, prepared snapshots per class in the cache keyed by N15's identity.
  - `make -C shard snapshot`.
  - Commit or fetch the native census fixtures with hashes (they are inputs, not evidence).
  - One `make test-linux` on kvm-dev in a fresh `/home/dev/<run>` dir.

**N20 (P2). The shape of `make test`. Effort S–M.**
- *What it does:* 10 Mac suites, ~2:40 total cold. Kernel is 77 s; bench 43 s cold, 15 s warm. Plus `linux` on kvm-dev. I saw no flakes (4 suites re-run) and the git-state guard works.
- *Gaps:*
  1. `test:` depends on `deps`, not `build`. In a fresh worktree `delegate mcp test` fails `ERR_MODULE_NOT_FOUND '@modelcontextprotocol/sdk'` and `bench/hyperlight` fails on a missing `executor/build/backend.js`. The README says `build test`, but the target allows the broken order.
  2. It excludes shard, native, tslib (which has its own `make test`), the ring kernel build (`make -C kernel ring` is never built in `test`; only clippy in `check.sh`) and scriptc-corpus.
  3. The kernel suite runs the docs tests (`kernel/Makefile:9-12`: `test_delegate`, `test_receipts`).
  4. The `linux` suite tests the **libkrun VMM** on Linux (`linux/run.sh:23-27` `docker-build.sh`), not the shard. "Linux green" says nothing about the Linux shipping target.
  5. `vmm/sandbox/tests/escape.rs` is manual only.
- *Change:* `test: build`; add `ring` to `kernel build`; move docs tests to `docs test`; add `tslib test`; a separate `test-linux` (N5, N6); label the libkrun-on-Linux suite as such.

### G. Dead code, docs, hygiene

**N17 (P3). The production shard binary is the harness. Effort S–M.**
- Node spawns `real ipc` (`select-backend.ts:31`). That same binary contains every JS fixture, the `arena-attack.S` guest (`bin/harness/mod.rs:82`), and the `prepare`/`bench`/`hold`/`hostile`/`stress`/`native-hold`/`ipc-probe` modes (`bin/harness/mod.rs:43-80`).
- `Mode::{Retain,Ready,Wait}` exist for fixtures (`owner.rs:20-26`).
- *Change:* a `jitk-shard` binary with `ipc | watchdog | native-worker` only; `shard-harness` as a separate bin or example; fixture modes behind `cfg(feature="harness")`.

**N18 (P3). Deletable now. Each verified by grep for consumers. Effort S.**
- `native-spike/` (~60 files). Only comments in `native/benchmark.mjs:1` and `native/prepare-node-control.mjs:24` mention it.
- The synthetic shard: `shard/src/main.rs`, `src/synthetic/` (982 lines), `guest/stub.S`, `run.sh`, `constants::synthetic` (`constants.rs:61-68`), and `shard/README.md:113-240`. 0 tests; `run.sh` has no caller.
- `shard/harness/check-chacha.c` (0 references).
- `shard/harness/spawn-cg.c`, byte-identical to `linux/spawn-cg.c` (`cmp`).
- `protocol/report.ts` (writes `../../03-channel-protocol/R3.md`) and `protocol/bench-dispatcher.mjs`.
- `executor/ipc/regression-helpers.mjs` and `bench/hyperlight/executor-test.mjs` (only a hash in `.R4`).
- `vmm/tests/fixtures/{psci-cpu-on,psci-reset,vbar-sysreg}.S`: assembled, but only `CONTRACTS.md` mentions them; `vmm/tests/check.ts:94` runs 6 other guests.
- Kernel feature `trace` (`kernel/Cargo.toml:9`; no build passes it).
- The `LocalProcessQjsBackend` / `JITK_BACKEND=local-qjs` "UNSAFE" host-QuickJS backend (`executor/backend.ts:113`, `select-backend.ts:25-28`). No test uses it, and it is a footgun.
- `vmm/src/confinement.rs:2-33` `cfg(not(sandbox_ready))` stub. It is only reachable without the committed marker.

**N21 (P3). Docs contradict code (each checked). Effort S.**
- `README.md:87`, `mcp/Makefile:1`: `docs/delegate.py` → now `docs/delegate.ts`/`dispatch.ts`.
- `README.md:69-70`, `docs/ARCHITECTURE.md:79-82`: "one `execute` tool". `mcp/server.mjs:49-63` registers `execute` and `run`.
- `README.md:96-99`, `docs/ARCHITECTURE.md:3-5`, `CLAIMS.md:16`, `KILL-CRITERIA.md`: the "H1 fails a stale protocol import guard" R4 status is presented as current.
- LOC:
  - `FINAL.md:4` and the brief say "1.4k-LOC kernel". `kernel/src` is 3,862 lines of Rust and asm (`wc -l`); `make loc` gives kernel 4,630 implementation lines.
  - `docs/ARCHITECTURE.md:51-65` says total 9,409. `make loc` gives 27,859 and *excludes* shard (~9.2k), native (~1.5k), tslib (~1.5k), tools and scriptc-corpus (`docs/count-loc.ts:8`). The real owned total is ~40k. Evidence: `raw-r9-arch/make-loc.txt`.
- `CONTRACTS.md:26,32`: `Option<i32>` → `Option<OwnedFd>` (`vmm/sandbox/mod.rs:61`); `build.py` → `vmm/build.ts`; `/tmp/jitk-02/r2` paths.
- `kernel/README.md:31`, `vmm/README.md:51`: "Python 3" is required. 0 tracked `.py` files remain. `vmm/Cargo.toml:1` and `linux/PORT-PARITY.md:59` cite `build.py`.
- `kernel/README.md:43`: the default VMM path is the deps cache, not `../vmm/dist/jitk-vmm`.
- `shard/README.md:11`: `+1.95.0` vs the Makefile's `+stable` (N4).
- `executor/README.md:12`: the scriptc pin is in `../tools/`, not `../docs/`.
- `mcp/README.md:34` (26 checks) vs `native/README.md:105` (27).
- `arch/review/fixes/ARCHIVE-PLAN.md`: `bench/ledger/verify.py` does not exist.

**N22 (P3). Runtime behavior depends on coordination markers. Effort S.**
- `executor/select-backend.ts:41-58` regex-parses the free-text `kernel/.READY` gate `G1` to enable parking, and fails on READY hash mismatches.
- The README says `.READY` is "an owner's coordination signal, not independent proof".
- *Change:* a typed `kernel/dist/manifest.json` field (it already exists, `kernel/dist/manifest.json:3-4`), or an explicit config value.

**N23 (P3). Personal and host paths in live code. Effort S.**
- 26 live source files contain `/Users/noah` or `/home/dev/` (grep excluding evidence dirs). Examples: `tools/pin.mk:9` (zig), `tslib/stream-process.ts:19-28` (`/home/dev/bench.lock`), `shard/native.ts:81,165,223`, `executor/ipc/run-ssh.ts:10-72`.
- They block any second machine or CI. Fold this into N19 and N5.

**N24 (P3). Toolchain count. Effort M to reduce.**
- A full `build test` needs:
  - rustup with 1.95.0, nightly-2026-10-20 and the floating stable
  - Node 24.22.1 from the cache plus a PATH Node for the one-time scriptc install
  - scriptc 0.4.5 with the child-wait workaround (`SCRIPTC-HANG.md`)
  - zig 0.16 at a personal path
  - Xcode clang, `ld.lld` and llvm-objcopy
  - Docker (Linux VMM build, the `jitk-oracle:08` grow oracle)
  - kvm-dev with its own Node 24.13.0 and cargo 1.99.1
  - a system `cc` on Linux for `abi.c` and `bridge.c`
- That is 5 languages (Rust, TS, C, asm, guest JS).
- *Cheapest reductions:*
  - Drop the floating stable (N4).
  - Make zig a deps cache entry.
  - Build the Linux VMM on kvm-dev instead of Docker on the Mac, which also removes Docker.raw growth (`feedback-disk-budget`).

---

## 4. Readiness for the planned work

| Planned | Blocking findings, in order |
|---|---|
| **x86_64 port** | N9 (arch vs transport split) → N10 (name-keyed syscalls) → N8 (payload out of the image) → N19 (per-arch layout in one crate) → N11 (Vcpu trait, per-arch snapshot format). The guest payloads (`kernel/payload/qjs`, `qjs-ring`) and the grow oracle are aarch64 too. libkrun/HVF has no x86 relevance, so x86 is shard-only, which raises the stakes of N2 |
| **Pause/resume/fork at a tool call** | N7 (explicit host run state) → N15 (fd-passed identity) → N12 (library checkpoint/delta, clock rebase, repair on resume) → N14 (leases owned by the supervisor, so a paused slot holds no deadline the shard can forge) |
| **Million fresh VMs demo** | N1 (one tenant can stop the demo) → N13 (multi-shard pool, queueing, prewarm, single reset) → N5/N20 (a reproducible Linux harness) → R7#9 (HOL blocking under mixed load) → perf reviewer's per-reset costs |

## 5. Proposed kernel interface (for the `core` + `arch/aarch64` refactor)

This is the shape the parallel refactor should converge on, so the work listed above lands without
another reshuffle:

- **`core` (no asm; builds and tests on the host with `cargo test`):**
  - syscall registry by name (N10)
  - fd table with explicit console/archive/closed variants (A11)
  - open descriptions; the `fs` image reader; ELF loader; brk/mmap over an `Arena` trait; trace
- **`arch` trait (`aarch64` now, `x86_64` next):**
  - `enter_user(entry, sp, tls)`
  - trap decode → `Syscall{nr,args}` / `Fault`; `set_return`
  - `PageTable::map(va, pa, len, flags)` plus `flush`
  - `counter_ns()`; `set_tls()` (TPIDR_EL0 vs FS base); `idle()` (WFI/yield)
  - `syscall_numbers()` table
  - boot stub and vectors stay per arch; one `boot.S` per arch, not per transport
- **`transport` trait:**
  - `send(record)`, `poll_reply(id)`, `wait(deadline)`, `now_ns()`, `checkpoint() -> repair`
  - impls `ring` (control page + MMIO doorbell) and `console` (virtio + FDT + GIC/WFI; Mac until gate 7)
  - no `#[path]` module swapping
- **Build inputs:** arch + transport only. The payload, script, argv and class arrive at runtime through the layout record and a read-only payload extent (N8). The ring ABI constants come from `jitk-abi` (N19).

## 6. What I could not verify

- **N1 end to end on KVM.** The Rust and Node halves were run; the shard-kill consequence is read from code (`shard-ipc.ts:30,44`, `shard-backend.ts:51-55`).
- **N5's default-snapshot failure.** Inferred from the missing `.identity` file plus `prepared-helpers.mjs:19-22`; `run-ssh` was not executed.
- **The `linux` aggregate suite, shard `test-kvm` and `check-native-r7`.** Not run (Docker disk budget and runtime). Their pass status is as reported by R8.
- **R7#16 and N13 costs** (register-restore ioctl count, byte-wise reply copy, double reset). Read from code, not measured. The perf reviewer owns them.
- **A11, R10, R14, R19 and L1 (kernel).** Not re-reviewed line by line because of the in-flight refactor.
- **R7 K08** (`--no-default-features` broken). Not re-checked.
- **`native/` test pass status.** Not run (manual, outside `make test`).
