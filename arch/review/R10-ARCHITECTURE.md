# R10 review: target architecture for jitk (2026-10-28)

Reviewed `main` at `08732694` in a read-only worktree. The only files written are this report
and `raw-r10-arch/`. Question: which **architecture** changes (not local fixes) most improve
size, clarity, maintainability and testability, and ease the planned work (bare-metal
million-VM demo, x86_64, pause/resume/fork at a tool call, product), and in what order.

Treated as done (landed on main, or in flight elsewhere): slot-scoped guest payload errors with
`ipc_json.rs` deleted; bounded admission queue; Rust pin via `tools/deps.json`; `make -C shard
snapshot` plus Linux deps; copy-restore reset with one reset per lifecycle; zig in the deps cache,
`make doctor` and personal-path cleanup; Linux VMM build off Docker; `shard/abi.c` and
`grow/oracle-root.c` ported to Rust.

**What I ran** (Mac, env vars unset): `make -C arch/jitk deps build` (EXIT 0, 45 s wall);
`delegate protocol|executor|mcp|executor/policy test` (all EXIT 0: mcp 27 checks, policy 32/32
hostile, executor including 6/6 Hyperlight through the canonical executor). The inventory scripts
are in `raw-r10-arch/`. Two read-only sweep agents covered duplication and the dependency graph;
I re-checked every claim cited below. I did **not** run the full `make test`, the Linux VM or any
KVM suite.

---

## 1. Summary

jitk is a ~13k-line runtime wrapped in ~30k lines of tooling and ~200 MiB of tracked evidence.
Its two execution paths (Mac: libkrun + virtio-console + JSON-lines v1; Linux: shard + ring
ABI) share almost nothing below the executor. The Linux path is then forced back into the Mac
path's shape: `ShardSandbox` turns binary ring messages into fake v1 frames and feeds them through
a v1 `Dispatcher` (`executor/shard-backend.ts:112-168`).

Every planned item (x86, fork, million VMs, product parity) is a shard feature. So the
architecture should converge on **one VM engine (the shard library) behind a typed host
interface, one guest ABI defined once**, and stop investing in the second path.

### Ranked top changes

| # | Change | Effort | Deletes (approx.) | Unlocks | First |
|---|---|---|---|---|---|
| 1 | **Typed `Engine`/`Session` host interface.** v1 frames survive only inside the libkrun adapter; native programs become a job kind, not a second lifecycle | M | v1 re-encode in `shard-backend.ts` (~60 lines), the backend-kind branch in the executor (`executor.ts:79`), the Hyperlight re-export cycle (`executor.ts:14`); later the MCP native-worker lifecycle (`mcp/native.mjs`, ~90) | Explicit run state for pause/fork; one parity corpus runner; a multi-shard pool for the demo; fewer Node CPU-µs per call | – |
| 2 | **`jitk-abi` crate as the single source** for ring layout, record kinds, doorbell ops, fds, IPC geometry, guest-visible limits and the ABI version. TS, C and bootstrap constants are generated from it | M | ~200 hand-mirrored lines across 10 files (§2.3). Two record-header decoders in the shard become one | x86 GPAs in one place; versioned fork snapshots; HVF engine; limits parity by construction | – |
| 3 | **Evidence out of git** into a content-addressed store plus an in-tree manifest. Summaries stay; raw files >64 KiB are refused by the existing git-state guard | S | 6,485 of 7,289 tracked files; 135 MiB evidence + 71 MiB binaries from every checkout and worktree | Faster review/grep and less agent context; worktrees no longer cost 213 MiB each; CI can use a shallow clone | – |
| 4 | **One trusted core (Node).** Delete `native/` and `native-spike/`, the synthetic shard and `local-qjs`; add a layering lint | S | ~2.8k code lines, ~115 files (native 1,412; native-spike 228 + 2.3k lockfile; synthetic 1,129; local-qjs ~25) | One policy surface; no ungated fork of the trusted core | – |
| 5 | **Engine split:** `hv::{Vm, Vcpu, ArchState}` under hypervisor-neutral `ring` and `slot`; production binary separate from the harness | L | `Slot` stops mixing 5 concerns (`shard/src/kvm/mod.rs:76-108`). `synthetic/vm.rs`'s KVM copy goes. The fixture modes leave the prod binary | x86 shard, an HVF engine, checkpoint/fork; ~2k lines of slot/ring logic testable on the Mac with a fake `Vcpu` | 2 |
| 6 | **Shard is the only Linux backend.** Delete the libkrun-on-Linux kit; move Linux seccomp/Landlock from `vmm/sandbox` into the engine | M | `linux/` (2,954 lines, 129 files, 5.5 MiB), the Linux branches of the VMM build, the QEMU nested path. The ~400-line Linux confinement is *reused*, not deleted | Shard containment (PRODUCT-GAPS); "Linux green" then means the shipping target | 7, shard fault suite |
| 7 | **Test architecture:** one parity corpus run against every `Engine`, `make test-linux`, a CI box | M | Ad-hoc shard checks over SSH (`executor/ipc/run-ssh.ts`, the `shard-*-check.ts` family, ~500) are folded into corpus cases | Cutover precondition; documented Mac/Linux differences become test data | 1 |
| 8 | **Kernel build = f(arch, transport).** Payload, argv, class and grow overlays become runtime or build *inputs* through one entrypoint; no kernel-tree copies | M–L | 3 tree-copy paths (`grow/runtime.ts:57-81`, `linux/build.ts:118-127`, `scriptc-corpus/guest.ts`); 8 build invocation sites; `ring_glue_4m` cfg; most of 85 `cfg(feature)` sites in 16 files | x86 build matrix of 1–2 images; grow on the ring kernel; cheaper grow transactions | 2 |
| 9 | **Supervisor-owned deadlines:** `jitk-vmm --watchdog` gains a lease mode; the shard only acknowledges | M | The shard's self-exec watchdog and board authority (~350 lines of `lease.rs:245-460`) | R7#7 security fix; a paused slot holds no deadline the shard can forge | 2 |
| 10 | **HVF engine on the Mac, then delete libkrun, the console transport and v1.** Decision point; go/no-go after a 2-day spike | L | ~3.5k lines (vmm launcher/build/tests ~1.5k, kernel console-only 886, `protocol/` v1 ~730 + 3.7 MiB vectors, executor `ProcessBackend`/`Watchdog` ~240) + 705 patch lines + the libkrun cache; adds ~1k | One kernel, one bootstrap, one engine; fork/pause on the dev box; Mac per-run cost without process creation (supersedes the zygote) | 5, 7 |

The demo does **not** wait for this plan. It needs #1 (to put an `Engine` over S shards) plus
what has landed. Waves 2–3 run beside it.

**Biggest disagreement with R9:** R9 keeps two transports indefinitely and designs the kernel
around both (§5: a `transport` trait with `ring` and `console` impls; N2 "decision needed, L").
I would **decide now for one transport**. Don't abstract the transport that is going away.
Get the Mac onto the ring through an HVF implementation of the same `hv` trait that x86 needs
anyway. That makes the HVF engine a ~1-week increment on #5, not a separate L project, and it
also replaces R9-PERF's macOS fork-server (#2) and file-backed-image (#7) work.

---

## 2. Measurements

### 2.1 Size (git-tracked, `arch/jitk`, physical lines)

`make loc` (`docs/count-loc.ts`) undercounts:
- It skips the `shard`, `native`, `native-spike`, `scriptc-corpus`, `tools` and `tslib` subtrees (`count-loc.ts:8`).
- It skips every `results/ evidence/ out/ payload/ build/ dist/` directory, and every file named `*generated*` or with a `Generated by`/`DO NOT EDIT` header (`:6,40,57`).
- It counts no `.json`/`.md`.

My inventory (`raw-r10-arch/inventory.py`) classifies all 7,289 tracked files. Summary in
`inventory-summary.txt`, per file in `code-files.tsv`.

| Kind | Lines | Files | MiB |
|---|---:|---:|---:|
| code (rs/S/c/ts/mjs/js/sh/ld/mk/Makefile) | 34,102 | 320 | 1.4 |
| test (tests/, fixtures, `*check*`, `*test*`, harness) | 8,893 | 146 | 0.4 |
| config/data json | 11,614 | 46 | 4.0 |
| docs (md) | 6,180 (11.7k incl. RESULTS) | 89 | 0.4 |
| **evidence** (results/raw/ledger/out/experiments, logs, jsonl, csv) | 1,424,170 | **6,485** | **135.3** |
| binaries (kernel.bin copies, payload ELFs, bundles) | – | 156 | **71.4** |

**Shipping runtime** (`raw-r10-arch/runtime-summary.txt`) is the code on the `execute()` path:

| Component | Lines | of which inline `#[cfg(test)]` |
|---|---:|---:|
| Kernel image (`kernel/src`, excl. `*_checks`) | 3,908 | – |
| ↳ console-only (console, wait, fdt, mmu, boot.S) | 886 | |
| ↳ ring-only (ring, ring_abi, wait_ring, mmu_ring, boot-ring.S) | 855 | |
| Shard library + IPC service (excl. synthetic, harness) | 5,840 | 1,936 |
| `vmm/src` (libkrun launcher + watchdog) | 557 | – |
| `vmm/sandbox/mod.rs` | 791 | 133 |
| Executor runtime + `policy.mjs` + `bridge.c` | 1,311 | – |
| Protocol (`dispatcher.ts` + 2 bootstraps) | 424 | – |
| MCP server | 299 | – |
| **Total** | **13,130** | 2,069 |

That is ~11.1k non-test runtime lines, against "~4.0k" in `arch/FINAL.md:12` and 9,409 *total*
in `docs/ARCHITECTURE.md:51-65`. Tooling outside the runtime is ~21k code lines: grow 4.1k,
shard TS tooling 2.7k, bench 2.7k, linux 2.2k, scriptc-corpus 1.4k, tslib 1.2k, kernel build/test
TS ~1.5k and others. The biggest files are `shard/src/kvm/mod.rs` 1,145; `linux/suite.ts` 975;
`shard/src/owner.rs` 927; `shard/native.ts` 824; `grow/test.ts` 802; `vmm/sandbox/mod.rs` 791.

### 2.2 Dependency structure

Edges with evidence are in the sweep notes; these are the ones that matter.

- **Cycles (8):**
  - docs ↔ kernel: `kernel/Makefile:10-13` runs the docs tests.
  - kernel ↔ bench: `kernel/Makefile:39`, `tests/measure.ts:21`.
  - kernel ↔ grow: `kernel/tests/fs_diff.ts:46,92` reads grow payloads.
  - executor ↔ bench/hyperlight: `executor/executor.ts:14` re-exports `HyperlightBackend`; `bench/hyperlight/backend.ts:1` imports `executor/build/backend.js`.
  - executor ↔ mcp: `executor/shard-check.ts:104`.
  - shard ↔ executor: `shard/snapshot.ts:28` imports `executor/prepared-helpers.mjs`.
  - tools ↔ tslib.
  - There is no layering rule.
- **Reach-ins instead of artifacts.**
  - grow copies the whole kernel source tree after checking `kernel/.READY` (`grow/runtime.ts:76-81`) and rewrites `src/syscalls/*.rs` and the manifest in the copy (`grow/loop.ts`).
  - `linux/build.ts:118-127` and `scriptc-corpus/guest.ts` do the same.
  - `executor/certify.mjs:14` reads `vmm/src/watchdog.rs`.
  - `select-backend.ts:31` defaults to `shard/target/release/real`, a cargo output, not the deps cache.
- **Coordination markers as build and runtime inputs.**
  - 12 tracked `.READY` files are read by 22 code files: `executor/select-backend.ts`, `vmm/build.ts`, `tslib/deps.ts`, `grow/{runtime,loop,lib,e2,experiment-run}.ts`, `bench/controller.ts`, `linux/build.ts` and others.
  - `select-backend.ts:48-52` regex-parses free text from gate `G1` to enable parking.
  - The README calls `.READY` "a coordination signal, not proof". The code uses it as a typed manifest.
- **Process scaffolding in the tree.** 10 `SCRIPTC-GAPS.md`, 7 `PORT-PARITY.md`, 23 `RESULTS*.md`, and "owner 0N/area 0N" comments in the runtime. Subtree boundaries follow the original ten research areas, not the runtime's components. For example, `protocol/` owns both the v1 dispatcher and the guest bootstrap, and the Hyperlight comparison sits under `bench/` but is part of the executor's public exports.

### 2.3 Same concept, more than once (verified)

| Concept | Copies | Status |
|---|---|---|
| Ring/control layout | `kernel/src/ring_abi.rs:1-51` (GPAs); `shard/src/constants.rs:3-58` (offsets); literals in `kernel/build-ring.sh:24`, `shard/snapshot.ts:32`, `shard/src/arena.rs:82`, `shard/guest/*.S`; spec `shard/ABI-R7.md` | hand-mirrored; each side has fields the other lacks |
| Host↔Node IPC geometry/kinds | `constants.rs:66-88`, `executor/ipc/bridge.c:16-20`, `executor/shard-ipc.ts:3` | 3 hand copies, no version |
| START header (24 B) | `executor/shard-backend.ts:228`, `executor/shard-check.ts:181`, `shard/src/ipc_service.rs:355` | 3 sites |
| Ring record header decode | `shard/src/kvm/mod.rs:470-480` and `shard/src/streams.rs:56-70` | near-identical, same crate |
| Guest limits (calls 32 / reply 1 KiB / source 8 KiB / done 16 KiB vs 4096 / 1 MiB) | `ring-bootstrap.js:21-25`, `kernel/src/ring.rs:11`, `shard-backend.ts:170-174,227-234`, `ipc_service.rs`, `protocol/bootstrap.js:5`, `protocol/dispatcher.ts:2-4`, `bench/hyperlight/bootstrap.js` | the product-parity gap is spread over 7 files |
| Protocol v1 dispatcher | `protocol/dispatcher.ts` (canonical) → `dispatcher.js` (generated + checked); `native/protocol.ts` (hand fork, 17 differing lines) | fork ungated |
| Guest bootstraps | `protocol/bootstrap.js` (134), `kernel/ring-bootstrap.js` (58), `bench/hyperlight/bootstrap.js` (47) | three guest runtimes |
| Executor core | `executor/{backend,pool,executor,select-backend,code,policy-adapter,receipt-path}.ts` vs `native/*` (~540 lines; `pool.ts` lacks the admission queue) | drifted |
| Binary codec | `executor/codec.mjs` = `native/guest-codec.js` (byte-identical) + `native/guest-source.ts` string copy | – |
| JNR7 native run archive encoder | `mcp/native.mjs:6-35`, `shard/native.ts:153-171` | two encoders; decoder `shard/src/inputs.rs:38` |
| KVM platform setup | `shard/src/kvm/platform.rs` vs `shard/src/synthetic/vm.rs:31-150` | synthetic is dead |
| Watchdogs | `vmm/src/watchdog.rs` (Node-spawned), `shard/src/lease.rs` (shard self-exec), `protocol/watchdog.ts`, `bench/watchdog.ts` | 4 designs, 2 in production |
| Kernel builds | 8 invocation sites; 3 source-tree copies | R9 N8 |
| `spawn-cg.c` | `linux/` = `shard/harness/` (byte-identical) | – |
| Small helpers | ~9 percentile helpers, 2 record-accessor sets (`shard/evidence.ts:12-29` = `linux/lib.ts:37-55`) | tooling only |

### 2.4 Leaky interfaces

- **`Sandbox` is the v1 wire format.**
  - `read(): unknown` / `send(frame: unknown)` (`executor/backend.ts:9-16`).
  - The shard adapter fabricates v1 frames (`shard-backend.ts:138,153-156,164-166`), keeps its own run-state counters (`nextWire`, `nextCall`, `pending`, `wirePending`) and a `Dispatcher` per slot.
  - It enforces shard limits inline (`:170-174,227-234`), and the executor branches on `backend.kind==='shard'` to build different guest code (`executor.ts:79`, `code.ts:8-12`).
- **`Slot` is everything.**
  - The KVM vCPU/run mapping, ring cursors and the record decoder, the deadline lease, reset policy, canary and quarantine all live in one struct (`shard/src/kvm/mod.rs:76-108`).
  - `try_exit` mixes the `KVM_RUN` call, lease checks and ring decoding (`:401-470`).
  - Ring and slot logic therefore cannot be tested without Linux arm64 KVM: every such module is `cfg(all(target_os="linux", target_arch="aarch64"))` (`shard/src/lib.rs:7-22`).
- **The production shard binary is the harness binary** (R9 N17, still true).
- **The kernel's structure is shaped by an image-identity oracle.**
  - `kernel/ARCH.md:67-85` keeps `syscall_entry!` as a macro, keeps crate-root `#[path]` mounts and avoids accessor methods, all so that refactors produce byte-identical images.
  - That was a good proof for a no-behaviour-change refactor. As a standing rule it blocks every interface change listed below.

### 2.5 Dead or off-path (verified)

- `native-spike/`: a negative result; nothing references it.
- `native/`: opt-in, and nothing references it.
- Synthetic shard: `src/main.rs`, `src/synthetic/`, `guest/stub.S`, `run.sh`; 0 tests, no caller.
- `protocol/bench-dispatcher.mjs` and `protocol/report.ts`.
- `protocol/vm.mjs` + `watchdog.ts`: hard-coded `/tmp/jitk-02`; reads a non-existent `kernel/artifact.json`.
- `kernel/tests/scratch.ts`.
- `local-qjs` backend (`select-backend.ts:25-28`).
- Kernel feature `trace`.
- `bench/ledger/artifacts/executor/build/*.js`: 14 tracked esbuild bundles.
- `shard/raw-r6/.../kernel/`: a stale copy of the kernel source.
- The rest of R9 N18's list is still present.

---

## 3. Target architecture (2–4 weeks)

```text
                         TRUSTED HOST (Node, one source)
  MCP server ─┐
  codemode    ├─> MicroVMExecutor ──> policy (effects engine + Policy callback)
  TanStack  ──┘        │ Session API (typed events; no wire frames)
                       v
              Engine ──┬── ShardEngine   (Linux: S shard processes, admission queue)
                       ├── HvfEngine     (Mac: N engine processes x 1 slot)        [wave 3]
                       └── LibkrunEngine (frozen; v1 Dispatcher lives only here)   [deleted after HVF]
                       │ host/abi.ts + bridge.node (abi.h)  <── generated from jitk-abi
                       │ memfd/eventfd ring (Linux) | same records over a pipe (Mac)
  ─────────────────────┼──────────────────────────────────────────── process boundary
                       v
  jitk-engine (Rust lib + `jitk-engine` bin: ipc | native-worker)
    service   reactor, owners, slot->owner scheduling
    slot      bind / step / reply / reset / checkpoint   (generic over Vcpu; cargo test with FakeVcpu)
    ring      record codec over GuestMemory               (pure; uses jitk-abi)
    snapshot  versioned header + per-arch ArchState + identity (kernel, payload, abi)
    hv        trait Vm/Vcpu: kvm_arm64 | hvf_arm64 | (kvm_x86_64 next)
    confine   seccomp + Landlock (moved from vmm/sandbox) | Seatbelt
  jitk-supervisor (today's jitk-vmm --watchdog + lease mode): owns every deadline, pidfd/kqueue
  ───────────────────────────────────────────────────────────── guest boundary (hostile)
  guest: kernel core + arch/aarch64 (+x86_64) + ring transport
         payload extent (qjs | lua | native archive) + ONE bootstrap.js (constants from jitk-abi)
  jitk-abi (no_std crate): layout per arch, record kinds, doorbell ops, fds, IPC geometry, LIMITS, ABI_VERSION

  DEV ONLY (research/, never imported by host/engine/guest):
    grow (kernel build API + engine runner + oracle), bench, hyperlight comparison, scriptc-corpus
    evidence: external content-addressed store; in-tree manifest + RESULTS summaries
```

Layering rule, enforced by a lint (an import/path scan like `arch-lint`): `jitk-abi` ← `guest`,
`engine` ← `host` ← `research`. Nothing points the other way, and no runtime code reads `.READY`.

### 3.1 Key interfaces

Host (TypeScript): the executor talks only to these types.

```ts
// host/engine.ts
import type {Limits} from './abi.js';                 // generated from jitk-abi
export type Job =
  | {kind: 'js'; source: string; tools: Record<string, string[]>; deadline: number}
  | {kind: 'native'; profile: string; argv: string[]; files: Record<string, Uint8Array>; deadline: number};
export type GuestEvent =
  | {kind: 'call'; id: number; ns: string; fn: string; args: unknown[]}
  | {kind: 'log'; level: 'log' | 'warn' | 'error'; msg: string}
  | {kind: 'stdout'; bytes: Uint8Array}                 // native jobs
  | {kind: 'done'; ok: unknown}
  | {kind: 'fail'; cause: 'guest' | 'limit' | 'deadline' | 'engine'; message: string};
export type Reply = {ok: unknown} | {err: {code: 'DENIED' | 'TOOL_ERROR' | 'LIMIT'; message: string}};
export interface Session {
  start(job: Job): Promise<void>;
  next(): Promise<GuestEvent>;   // validated by the engine adapter; bad guest content => 'fail' for this session only
  reply(id: number, r: Reply): Promise<void>;
  release(): void;               // idempotent kill/reset
  readonly released: Promise<{deadlineMissed: boolean; metrics?: Record<string, bigint>}>; // capacity held until then
  checkpoint?(): Promise<Checkpoint>;   // wave 4: pause/fork with a pending call (after CALL, before RET)
}
export interface Engine {
  readonly kind: 'shard' | 'hvf' | 'libkrun';
  readonly limits: Limits;        // the executor never hard-codes guest limits
  acquire(signal: AbortSignal, deadline: number): Promise<Session>;
  close(): Promise<void>;
}
```

The executor's `while(true){ s.read() ... }` loop (`executor.ts:105-122`) becomes a loop over
`GuestEvent`. `executionBody`'s `prepared` branch moves into the engine as
`ShardEngine.compile(source, tools)`. Hyperlight implements `Engine` from `research/` and is no
longer re-exported by the executor.

Engine (Rust): `slot` and `ring` are hypervisor-neutral; only `hv` touches ioctls or Hypervisor.framework.

```rust
pub trait Vcpu {
    type State: ArchState;
    fn save(&self) -> io::Result<Self::State>;
    fn restore(&mut self, s: &Self::State, skip_invariant: bool) -> io::Result<()>;
    fn run(&mut self) -> io::Result<Exit>;        // KVM_RUN | hv_vcpu_run
    fn kicker(&self) -> Kicker;                    // immediate_exit | hv_vcpus_exit
}
pub enum Exit { Doorbell(abi::Doorbell), Shutdown, Fault { gpa: u64 }, Interrupted }
pub trait Vm {
    type Vcpu: Vcpu;
    fn map(&mut self, gpa: u64, region: &GuestRegion, writable: bool) -> io::Result<()>;
    fn vcpu(&mut self) -> io::Result<Self::Vcpu>;  // HVF: must stay on the creating thread
}
pub trait ArchState: Sized { const ARCH: abi::Arch; fn encode(&self) -> Vec<u8>; fn decode(b: &[u8]) -> Result<Self, SnapshotError>; }

pub struct Ring<'m> { mem: &'m GuestMemory, layout: &'static abi::Layout, tx: usize, rx: usize }
impl Ring<'_> { pub fn drain(&mut self) -> Result<Vec<Record>, GuestError>; pub fn reply(&mut self, id: u32, bytes: &[u8]) -> Result<(), GuestError>; }

pub struct Slot<V: Vcpu> { vcpu: V, mem: GuestMemory, ring: RingCursors, state: SlotState, reset: ResetPolicy }
impl<V: Vcpu> Slot<V> {
    pub fn bind(&mut self, job: &Job, entropy: &mut impl Read) -> Result<(), SlotError>;
    pub fn step(&mut self) -> Result<Step, SlotError>;   // Step::{Records(Vec<Record>), Parked, Finished}
    pub fn reply(&mut self, id: u32, bytes: &[u8]) -> Result<(), SlotError>;
    pub fn reset(&mut self) -> Result<ResetReport, Quarantined>;
    pub fn checkpoint(&self) -> Result<Delta, SlotError>;  // writable extents only (arena + rings)
}
```

Leases leave `Slot`: the supervisor kicks the owner, and the slot only sees `Exit::Interrupted`.
Owners keep scheduling; HOL blocking (R7#9) is a `service` concern, now isolated.

ABI crate (sketch; values from `ring_abi.rs` and `constants.rs`):

```rust
#![no_std]
pub const ABI_VERSION: u32 = 8;                        // R7 + this consolidation
pub enum Arch { Aarch64, X86_64 }
pub struct Layout { pub control_gpa: u64, pub doorbell_gpa: u64, pub archive_gpa: u64, pub arena_gpa: u64,
                    pub control_bytes: usize, pub ring_bytes: usize }
pub const AARCH64: Layout = Layout { control_gpa: 0x81d0_0000, doorbell_gpa: 0x1000_0000, archive_gpa: 0x8200_0000,
                                     arena_gpa: 0x8180_0000, control_bytes: 0x4000, ring_bytes: 0x8000 };
pub mod ctrl { pub const GENERATION: usize = 0x8; pub const TX_PRODUCER: usize = 0x40; /* ... */ }
#[repr(u16)] pub enum Record { Call = 1, Ret, Err, Log, Done, Stdout, NativeExit = 8 }
#[repr(u32)] pub enum Doorbell { Submit = 1, Wait, Finish, Checkpoint, RepairedReady }
#[repr(C)] pub struct RecordHeader { pub len: u32, pub kind: u16, pub flags: u16, pub generation: u64,
                                     pub id: u64, pub n: u32, pub cap: u32 }   // one decoder
pub struct Limits { pub calls: u32, pub call_bytes: u32, pub reply_bytes: u32, pub source_bytes: u32,
                    pub done_bytes: u32, pub json_depth: u32, pub reserve_bytes: u32 }
pub const LIMITS: Limits = /* the single product limit table */;
pub mod ipc { pub const CAPACITY: usize = 64; pub const PAYLOAD: usize = 16384; #[repr(u32)] pub enum Kind { /* start=1 ... stats=22 */ } }
```

A small host binary emits `host/abi.ts`, `host/ipc/abi.h` and a `const ABI={...}` prelude that
`prepare` prepends to `bootstrap.js`. A test fails if a generated file is stale, which is the
same model as `protocol/dispatcher.js` today. `ABI_VERSION` goes into the snapshot identity and
the IPC READY message.

Kernel: keep `ARCH.md`'s arch interface. No transport trait: until HVF lands, the existing
`cfg(feature="transport-ring")` split stays frozen, and afterwards it is deleted. Build inputs
become `(arch, transport)`, later `arch` only. The payload ELF and bootstrap move to a read-only
extent beside the native archive (`ARCHIVE_GPA`), and the class is read from the layout record
(R9 N8). `grow-trace` stays a build flag; it is one extra image, not a profile axis.

### 3.2 Big decisions

| Decision | Recommendation | For | Against / risk |
|---|---|---|---|
| **One guest transport vs keeping libkrun on the Mac** | One transport (ring), reached through an `HvfEngine` on the shared `hv` trait. libkrun stays frozen until HVF passes the parity corpus | Parity by construction (the 1 KiB / no-timer / 8 KiB gaps become one `LIMITS` table); deletes ~3.5k lines, 705 patch lines and the libkrun cache. Pause/fork works on the dev box. The Mac engine process persists across runs with a reset, so the 3.3 of 6.5 CPU-ms/VM spent on process creation and HVF load (R9-PERF headline) leaves the per-run path. R9-PERF #7 shows `hv_vm_map` on file-backed private memory works | HVF allows one VM per process and runs a vCPU only on its creating thread, so the Mac engine is N processes × 1 slot. macOS has no `pagemap`, so the reset memcpys the writable extents (~1.4 MiB/run; fine for dev, unverified cost). The libkrun robustness work stops mattering to jitk (still upstreamable). Grow loses its libkrun loop until it runs on the engine. **Kill criterion:** a 2-day spike must run `return 2` and one tool call on HVF through `hv`+`slot`; otherwise keep libkrun as the Mac engine and accept two transports |
| **Node vs native as the trusted core** | Node. Delete `native/`; revisit only when scriptc compiles `host/` unmodified, so native would be a second *build*, not a fork | codemode `Executor`/TanStack `IsolateDriver` are in-process JS APIs, so a Node library must exist anyway. The N-API bridge is Node. Node's per-run CPU is ~80% kernel wakeups, not JS (R9-PERF §1b), so native would not remove it. scriptc cannot compile the canonical sources (`native-spike/REPORT.md:3`) | Loses a single-binary MCP server that passes 27/27 (`native/RESULTS.md`). Keep the branch/tag |
| **Shard as the only Linux backend** | Yes | The shard is the shipping target; `linux/` tests libkrun on Linux (R9 N20.4). This also removes Docker and QEMU from the Linux story | The libkrun Linux suite is today's only Linux H5 escape/fault matrix (`linux/suite.ts`: seccomp 720, faults 180). Port its fault classes to shard fixtures (`shard/guest/*.S` already has reset/arena attacks) **before** deleting |
| **Shared ABI crate + codegen** | A Rust `no_std` crate is the source; TS/C/JS are generated and checked | Kernel and shard are the primary consumers and need consts and `repr(C)`. One record-header decoder | A JSON spec would be language-neutral but needs a Rust generator too and loses const expressions; not worth the indirection with two Rust consumers |
| **Kernel build inputs** | Per (arch, transport) now, per arch after HVF; payload/argv/class at runtime; one `kernel build --arch --overlay DIR --trace` entrypoint used by grow/corpus/engine | Ends 3 tree copies and 8 build sites. The x86 matrix is 1–2 images. Prepared snapshot key = (image, payload, bootstrap, class, ABI) | Changes the image, so it **retires the byte-identity rule** (`ARCH.md:67-85`). The parity corpus plus the grow differential become the no-behaviour-change proof. Contracted handler hashes (`syscalls.manifest.json`) are unaffected |
| **Where evidence lives** | Outside git: `~/sofort-local-evidence/` (already used) or a separate evidence repo, content-addressed. In-tree `evidence/manifest.json` (path, sha256, bytes, run, claim) + RESULTS summaries. No history rewrite | 89% of files and ~206 MiB leave every checkout; tooling stops writing into the tree; the delegate's git-state guard (`docs/dispatch.ts:97-113`) already enforces "tests write to `.work/`" | Claims must cite hashes, not paths. Old commits still carry the 552 MiB pack: use shallow clones in CI and rewrite history only if outside users clone it |
| **Test architecture** | Per-language unit tests (cargo test for kernel core and engine with `FakeVcpu`; TS checks); one **parity corpus** (JS + native cases, expected `(result, logs, error class)`, allowlist of documented differences) run per `Engine`; `make test` (Mac) and `make test-linux` (KVM host) run the same corpus; CI on a second machine (Linux arm64 with `/dev/kvm`) | One question, "do the backends agree?", with one answer. Replaces ~12 bespoke executor/shard checks | Needs an arm64 KVM CI host (self-hosted or cloud metal; GitHub-hosted arm64 KVM availability not verified). The Mac stays manual |

---

## 4. Change plan in waves

Dependencies are shown as `A → B` (A first). Effort: S <1 day, M 1–3 days, L >3 days.

### Wave 0: cut to the product (days 1–2, all S, parallel)
- **W0.1 Evidence out (#3).**
  - Move `*/results/`, `raw-*/`, `bench/ledger/{raw,artifacts}`, `linux/out`, `grow/experiments`, `grow/results`, the tracked kernel.bin copies and the payload ELFs to the external store. Write the manifest.
  - Make `kernel/payload/*` a built or fetched dep (deps cache) with pinned sha256.
  - Extend the delegate's git-state guard to refuse new tracked files >64 KiB outside `docs/`.
  - The rule from memory ("raw >1 MiB stays local") becomes mechanical.
- **W0.2 One trusted core (#4).** Delete `native/`, `native-spike/`, the synthetic shard, `local-qjs`, `protocol/{vm.mjs,watchdog.ts,bench-dispatcher.mjs,report.ts}`, `kernel/tests/scratch.ts`, the kernel `trace` feature and the duplicate `spawn-cg.c`. Tag the commit before the delete.
- **W0.3 Layering lint.** Path/import scan with the rule from §3. It fails on the 8 cycles; fix the cheap ones:
  - Move the Hyperlight re-export out of `executor.ts:14`.
  - Run the docs tests from `docs test`, not `kernel test`.
  - Move `prepared-helpers.mjs` into shard tooling or the engine.
- **W0.4 Generated truth.** Generate the LOC table in `docs/ARCHITECTURE.md` from `inventory.py` (or fix `count-loc.ts` to cover all subtrees and kinds), and rewrite ARCHITECTURE.md to the as-built two-path picture. R9 N21's drift list is fixed as a side effect.

### Wave 1: one interface, one ABI (week 1)
- **W1.1 `jitk-abi` + codegen (#2), M.** Kernel `ring_abi.rs` and shard `constants.rs` become re-exports; then `bridge.c`, `shard-ipc.ts`, the bootstrap and `build-ring.sh` (the `--defsym` comes from the crate). Merge the two record-header decoders. Add `ABI_VERSION` to READY and the snapshot identity.
- **W1.2 `Engine`/`Session` (#1), M.** `ShardEngine` decodes IPC records straight into `GuestEvent`s with one `parseJson` under `LIMITS`, and drops the per-slot `Dispatcher` and the fake frames. `LibkrunEngine` wraps today's `ProcessBackend` + v1 `Dispatcher`. The native-worker path becomes `Job{kind:'native'}` on the same session, which fixes R7#8's serial worker (`mcp/native.mjs:73-81`). W1.1 → W1.2 for the generated `abi.ts`.
- **W1.3 Parity corpus + `make test-linux` (#7), M.** Corpus cases from `executor/verify.ts`, `mcp/test.mjs` and `bench/cases.json`, run per `Engine`, with an allowlist of documented differences (today: limits and timers). W1.2 → W1.3.
- **Demo track (parallel, after W1.2).**
  - `ShardEngine` over S shard processes per Node, and K Node processes per host (R9 N13 remainder).
  - Arithmetic, nested and indicative only: ~1.55 CPU-ms/run on the executor path ⇒ 1M runs ≈ 1,550 CPU-s ≈ 25 s on 64 cores.
  - The compute cost is plausibly well under 5¢ on one metal host; price not verified.
  - The demo does not need waves 2–3.

### Wave 2: one engine, one Linux path (weeks 2–3)
- **W2.1 Engine split (#5), L.** `hv` trait with `kvm_arm64`, `ring` and `slot` generic over `Vcpu`, and a `FakeVcpu` that replays guest record scripts so the slot/ring/reset state machines run under `cargo test` on the Mac. Split out the `jitk-engine` binary (`ipc | native-worker`) and move the harness to `[[example]]` or `cfg(feature="harness")`. W1.1 → W2.1.
- **W2.2 Supervisor-owned deadlines (#9), M.**
  - Move `vmm/src/watchdog.rs` to `supervisor/` and give it a lease mode: Node writes (engine pid, slot, generation, deadline) at START, and the supervisor kicks the engine's owner tid and then pidfd-kills.
  - Delete the shard's watchdog child and board creation (`lease.rs:245-460`).
  - W2.1 → W2.2, because `Exit::Interrupted` replaces the in-slot lease.
- **W2.3 Shard only on Linux (#6), M.**
  - Port the libkrun Linux fault/escape classes to shard fixtures and move the seccomp/Landlock half of `vmm/sandbox/mod.rs:266-660` into `engine::confine` (PRODUCT-GAPS "shard containment").
  - Then delete `linux/` and the Linux branches of the VMM build.
  - Make the shard the default backend on Linux in `select-backend.ts`.
  - W1.3 + W2.1 → W2.3.
- **W2.4 Kernel build inputs (#8), M–L.** A single `kernel build` entrypoint keyed by (arch, transport, overlay, trace) into the cache, and a payload extent. grow, scriptc-corpus and the engine prepare step call it; the three tree copies are deleted. Grow differentials also run on the ring kernel through `native-worker` (R9 N25). W1.1 → W2.4; W2.4 is independent of W2.1–W2.3.

### Wave 3: one transport (weeks 3–4, decision gate)
- **W3.0 HVF spike, 2 days.** `hv::hvf_arm64` boots the ring kernel to CHECKPOINT, takes a snapshot, resets by memcpy, decodes the doorbell (STR → data abort, ISV=1) and handles PSCI off (HVC exit). Go criterion: corpus `return 2` and `one_tool` pass. W2.1 → W3.0.
- **W3.1 `HvfEngine` (#10), L.** Engine processes × 1 slot; the same IPC records over a pipe or POSIX shm; Seatbelt from `vmm/sandbox` (macOS half); grow's Mac loop moves onto it.
- **W3.2 Delete libkrun:** `vmm/` except the sandbox and supervisor, the patches, the console kernel files (886 lines), `protocol/` v1 (`bootstrap.js`, `make-vectors.ts`, `vectors.json`, the hostile v1 wire suite; keep the JSON-acceptance vectors as ring tests), `ProcessBackend`/`Watchdog` in the executor, and the libkrun deps-cache entries.

### After the window, now cheap
- **x86_64.** `hv::kvm_x86_64` + `abi::X86_64` + `kernel/src/arch/x86_64`. One kernel image per arch; no libkrun work at all.
- **Pause/fork.** `Session.checkpoint()` → `Slot::checkpoint() -> Delta` (writable extents only); a `PAUSED` slot state that releases its owner; a supervisor lease per branch; clock rebase plus repair on resume (R9 N12).
- **Product.** Packaging `host/` + `jitk-engine` + `jitk-supervisor` + the kernel image is three artifacts, not today's subtree graph.

---

## 5. Reconciliation with R9

### R9-ARCH-QUALITY

| R9 item | Status now | My view |
|---|---|---|
| N1 slot-scoped guest errors, drop `ipc_json.rs` | **Fixed** (`shard/src` has no `ipc_json.rs`; `ShardSandbox.guest()`/`abandon()`, `shard-backend.ts:148-150`) | – |
| N4 Rust pin | **Fixed** (`tools/deps.json:19`, `tools/pin.mk:10`) | – |
| N5 Linux deps + `make -C shard snapshot` | **Fixed** for deps/snapshot; `make test-linux` is still missing | Folded into W1.3 |
| N13 queueing/prewarm/double reset | Admission queue and the single reset have **landed** (`owner.rs:315-323`). Still one `ShardBackend` per executor, labelled "experimental" (`select-backend.ts:29-35`) | Demo track |
| N7 typed Sandbox events | Open | **Agree; rank #1** (R9 had #5). It is the hinge for N6, N12, N13 and R7#8 |
| N19 ABI crate | Open | **Agree; rank #2.** Add `LIMITS` to it: the product-parity gap is a limits table spread over 7 files |
| N2 two transports | Open, "decision needed" | **Disagree on the shape:** decide now; no kernel transport trait; HVF via the shared `hv` trait (§3.2) |
| §5 kernel `transport` trait (ring + console impls) | Proposal | **Not worth it** if HVF is go; freeze the cfg split instead |
| N8/N9/N10 kernel build inputs, arch split, name-keyed syscalls | N9 is largely done by the arch refactor (`kernel/ARCH.md`); N10 is done (name-keyed `slots.json`, per-arch `syscalls.json`, ARCH.md "Linux ABI data"); N8 is open | Agree with N8, plus the tree-copy deletion R9 missed; retire the byte-identity rule |
| N11 Vcpu trait | Partly in flight (`abi.c` → Rust) | **Agree; rank higher** (R9 #10 → my #5) because HVF, x86 and fork all depend on it |
| N12 pause/fork | Open | Agree on the order (N7 → checkpoint → leases); after the window |
| N14 watchdog lease mode | Open | Agree (#9) |
| N15 fd-passed snapshot identity | Open | Agree; fold `ABI_VERSION` + kernel sha into the identity in W1.1 (S) |
| N16 `native/` | Open, "pick one" | **Pick: delete** (§3.2) |
| N17 prod binary = harness | Open | In W2.1 |
| N18 dead code | Open (all items re-verified present) | W0.2 |
| N20 test shape | Partly (deps-first ordering unchanged) | W1.3; also make `test` depend on `build` (S) |
| N3 bridge build | Open | Agree, keep C; generated `abi.h` in W1.1 |
| N21/N23/N24 docs, paths, toolchains | Paths/zig/doctor in flight; docs open | W0.4 |
| T4 evidence archive | Open; R9 had it as a carry-over, not ranked | **Rank much higher (#3):** 89% of tracked files, the cheapest large structural win |
| N22 `.READY` drives runtime | Open | **Broader than R9 says:** 22 code files read markers as build or runtime inputs; replace them with typed `dist/manifest.json` artifacts |

### R9-PERF-MEMORY

| R9-PERF item | Status | My view |
|---|---|---|
| #1 copy-restore reset | **Landed** | – |
| #3 admission queue | **Landed** | – |
| #4 one reset per lifecycle + skip ID regs | **Landed** ("skip ID regs" per main log `473b69f1`) | – |
| #2 macOS fork-server | Open | **Superseded** by `HvfEngine` (persistent process + reset), if wave 3 is go; otherwise it is the right Mac fix |
| #7 file-backed `MAP_PRIVATE` image on the Mac | Open | Same: free with HVF (`hv_vm_map` of the snapshot); a libkrun loader patch otherwise |
| #5 fewer Node wakeups, #6 reply batching | Open | Easier after N7: `GuestEvent` batches map 1:1 onto IPC batches |
| #8 run-phase bump allocator, #9 reactor pidfd, #10 hygiene | Open | Local; outside this review |

### What R9 missed or under-weighted
1. The runtime is ~11.1k non-test lines, not ~4k. R9 corrected the total (~40k) but not the runtime figure.
2. 22 code files read `.READY`, so coordination markers are build and runtime inputs.
3. The kernel-tree copy pattern in grow, linux and scriptc-corpus.
4. The byte-identity rule (`ARCH.md:67-85`) is now an architectural constraint.
5. 8 dependency cycles and no layering rule, including the product API exporting a benchmark backend.
6. `vmm/sandbox`'s Linux confinement is the shard's missing containment: move it, don't delete it.
7. Two JNR7 encoders (`mcp/native.mjs`, `shard/native.ts`) and two record-header decoders inside the shard.
8. An HVF engine is incremental once `hv` exists, and it supersedes two R9-PERF Mac items.

---

## 6. Not worth doing

- **A kernel transport trait for console + ring.** It abstracts the path being deleted (see §5). Only worth it if the HVF spike fails.
- **A mass directory rename into guest/engine/host/research now.** It breaks every evidence path and doc for clarity alone. Let the moves fall out of the deletions (`supervisor/`, `engine/` from `shard/`) and mark the research subtrees in the layering lint.
- **Interim "same message protocol over virtio-console"** (making libkrun speak ring semantics). It is double work if HVF is go. Use the parity corpus allowlist meanwhile.
- **A native (scriptc) trusted core now**, or keeping `native/` "in sync". The case is in §3.2.
- **Rewriting git history** to purge the 552 MiB pack. Shallow-clone CI instead; revisit only for external users.
- **Replacing the C N-API bridge with Rust.** It is small and right (R9 N3 agrees).
- **ArceOS `axcpu`/`page_table_multiarch`.** They bring more than they replace (`kernel/ARCH.md` crate table). `linux-raw-sys` as a data source for per-arch numbers is still worth a look in the x86 port.
- **Unifying the ~10 evidence/report generators** into a framework. Most die with W0.1; share a percentile helper in `tslib` and stop there.
- **Multi-tenant, metering or plugin-registry abstractions** before a user exists (PRODUCT-GAPS order 5).
- **Splitting `owner.rs` for size alone.** It becomes thinner by itself once leases (W2.2) and fixture modes (W2.1) leave.

---

## 7. Not verified

- **HVF feasibility details.** One VM per process, vCPU-thread affinity, doorbell decode, PSCI via HVC and the memcpy reset cost are from API knowledge plus R9-PERF's `hv_vm_map` result, not run. W3.0 exists to verify them.
- **GitHub-hosted arm64 runners with `/dev/kvm`, and metal instance prices.** Not checked.
- **The demo cost arithmetic.** It uses R9-PERF's nested 1.55 CPU-ms/run; bare-metal numbers do not exist yet.
- **Whether the two JNR7 encoders produce different archives.** Their argc code differs textually (`mcp/native.mjs:16` writes `args.length + 1` including the tool; `shard/native.ts:158` writes `args.length`), but I did not check whether the callers pass different `args`.
- **Not run:** the kernel, vmm, grow, bench and linux suites; any shard or KVM test; `native/` tests. Only `deps build` and the protocol, executor, mcp and policy suites ran (`raw-r10-arch/suites-mac.txt`).
- **Deletion estimates.** These are physical lines from the inventory. The libkrun/v1 total (~3.5k) assumes the JSON-acceptance vectors and the macOS Seatbelt half of the sandbox are kept.
- **In-flight branches** (Linux VMM off Docker, `abi.c` → Rust, zig/doctor/paths) were treated as done without reading them. Note that W2.3 deletes the Linux VMM build those branches just moved.
