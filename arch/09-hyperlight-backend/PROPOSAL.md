# 09 — Hyperlight backend and competitor baseline

**Recommendation:** ship a snapshot-backed Hyperlight backend first; keep jitk as
an explicitly measured Linux-ABI alternative. For JS-only agents, a new kernel
has not earned its scale/performance/complexity cost. Hyperlight already runs on
this Mac. Its shared-snapshot logical sandbox costs **11.7 µs to create,
294.6 µs through a JS→host→JS result, and ~0.156 MiB marginal private footprint**.
These are not fresh Apple hardware VMs. A fresh process/Apple VM restored from
an OCI snapshot reaches a result in **1.872 ms inside the worker**, or
**9.304 ms including process launch and exit** (all n=40, medians).

## 1. Concrete design for this area

### Isolation contract and backend selection

Expose the same `Backend.execute(body, providers, deadline)` for jitk and
Hyperlight. Require a machine-readable isolation mode:

- **strict-single-use** (brief's default): one signed worker process, one new
  Apple VM, one snippet, then destroy the process. Pre-start single-use workers
  and load the shared immutable OCI template before assignment. A worker never
  handles a second tenant. This preserves the brief's hardware identity rule.
- **logical-sandbox** (separate opt-in contract): create a fresh logical sandbox
  with `Sandbox::from_snapshot`; destroy it after one execution. On HVF these
  share one process-wide Apple VM. Do not describe this as one hardware VM/job.
  Per-job memory maps are installed under a global exclusive lock [H1].

For strict mode, an immutable, versioned snapshot contains the initialized
QuickJS runtime, fixed generic `bootstrap.js`, and the `jitk.call` host-module
manifest. Load it with `Snapshot::load`, supply freshly constructed host
callbacks, and create via `Sandbox::from_snapshot` [H2]. Never capture tenant
code, responses, credentials, or host mutable policy state into this template.
Validate the snapshot digest, Hyperlight version, guest architecture/CPU
compatibility and host-function signatures before accepting work [H3].

Snapshots share read-only file-backed pages; writes are private. The measured
6.0 MiB OCI layout is a real saved snapshot, not a guessed RAM allocation.
Filesystem-cache-cold loading and simultaneous multi-process density are
**UNVERIFIED**. Do not extrapolate the 32 logical-clone result to fleet capacity.

The proof adapter creates from source per job; the separate snapshot experiment
proves the optimized factory primitives. Wiring the generic bootstrap into the
persisted production factory remains implementation work, not a measured
end-to-end adapter result. The generic bootstrap itself was executed successfully.

### Tool boundary and async behavior

The Rust API registers an exact module key:
`proto.host_module("jitk").register_js("call", ...)`; guest imports `"jitk"`.
The Node API adds `host:` automatically: `hostModule("api").register("fn", cb)`
is imported as `"host:api"` [J1]. This is an API distinction, not a docs bug.
Registrations precede `load_runtime()`; names are sent to the guest and one
`CallHostJsFunction` host function dispatches them [J2]. JSON crosses the JS
boundary; Hyperlight transports it through typed FlatBuffers/shared-memory
queues, with a separate binary sidecar. Our adapter disables binary values.

Sidecar protocol, on stdin/stdout only:

```
worker -> supervisor: {"t":"call","id":0,"ns":"math","fn":"add","args":[20,22]}
supervisor -> worker: {"id":0,"ok":42}           // or {"id":0,"err":"..."}
worker -> supervisor: {"t":"done","result":42}
```

The trusted supervisor owns credentials, checks namespace/function membership
and per-call policy, enforces byte/call/deadline budgets, and returns only allowed
results. Workers get an empty environment and no credentials. Suppress the
upstream default HostPrint-to-stdout callback; otherwise guest logging can
corrupt the protocol [H4]. Do not install the optional host-filesystem module
loader. Time and printing are implicit upstream host functions [J2]; define
whether host clock access is allowed rather than claiming literally zero I/O.

`ns.fn` can be an async JS tool API. The NAPI bridge dispatches to Node's main
thread with a ThreadsafeFunction and awaits a Promise on a parked native worker
using a oneshot channel [J3]. Our sidecar does the equivalent by waiting for a
JSON reply while Node awaits I/O. **The guest host call is synchronous**: it
cannot issue another tool call while that call is pending. Wrapping it in an
async function permits `await` and resolved promises, but `Promise.all` does not
make independent host calls overlap. For overlap, expose one policy-checked
`batch` tool, or implement a real guest event loop; do not promise concurrency
from a Promise wrapper. Native thread cost under thousands of pending host
calls is **UNVERIFIED**.

### Lessons to copy and boundaries to retain

Copy the no-OS guest, embedded/preinitialized engine, explicit host-function
registry, template reuse, snapshot restore, and typed sandbox lifecycle.
Hyperlight 0.18 uses `UninitializedSandbox::evolve -> Sandbox`; the old
`devolve` name is absent. At the JS level `LoadedJSSandbox::unload` restores the
runtime baseline, while `snapshot`/`restore` capture/reset guest state [J4].
Prefer lifecycle transitions over rerunning initialization. Keep host policy
outside snapshots; host callback state does not roll back with guest memory.

Copy shared-memory request/response transport only when console overhead is
measured as a bottleneck. It saves per-host-call overhead here, but importing
Hyperlight's whole queue system into a 1–1.5k-LOC kernel would defeat simplicity.
The AArch64 notification mechanism uses MMIO stores to an unmapped I/O page,
not an OS syscall or a universal `hvc` host-call ABI [H5].

Hyperlight's custom guest is not a Linux ABI runtime. An unmodified static
musl qjs ELF loaded but did not complete initialization (3 s external kill).
It does not implement jitk's grown syscall surface. Its guest starts in EL1t;
it does not provide the brief's QuickJS EL0/custom-kernel EL1 separation [H6].
That is a security-model difference to review, not proof that either VMM is safe.
No devices are exposed by default; registered host functions remain the main
application attack surface [H7]. Full VMM confinement is still required.

## 2. Code sketches (real files)

- `src/main.rs`: executable benchmark plus working Rust JSON-lines sidecar;
  direct host calls, fresh creation, snapshots, RSS/footprint, CPU contention.
- `backend.ts`: TS adapter, async policy/tool dispatch, sequential IDs, reply and
  output budgets, empty worker environment, external SIGKILL deadline.
- `bootstrap.js`: fixed generic handler suitable for a pre-tenant snapshot;
  installs namespace functions, compiles/evaluates the submitted body in guest.
- `src/bin/snapshot_clone.rs`: **working unmodified public API** snapshot factory,
  counter-isolation checks, 32 resident COW clones, OCI save/load in fresh VMs.
- `src/bin/load_linux.rs`: bounded externally; demonstrates Linux ABI failure.
- `backend-smoke.ts`, `napi-bench.cjs`, `fresh.py`, `summarize.py`, `reproduce.sh`:
  validation and reproducible measurement harnesses. Raw `*.jsonl` retained.

These are design spikes, not a production supervisor. Missing production work:
complete message schema/depth limits, policy/provenance integration, cancellation
of outstanding external I/O, OS process sandbox, pool accounting and crash
recovery. In particular, the current reply-size check counts JS string code
units, not UTF-8 bytes; production limits must operate on encoded bytes.

## 3. BLOCKERS — experiments and results

Exact commands and failures are in `EXPERIMENTS.md`; summary statistics are
computed from retained raw nanoseconds using nearest-rank p90. Apple M4 Pro,
Mac16,8, 12 CPUs, 24 GiB, macOS 26.6.1. Other design experiments were running on
this host: load/frequency/cache were uncontrolled. Numbers are local evidence,
not portable SLA claims. No VM creation metric includes image download/build.

### (a) Build/run on macOS: ELIMINATED

Cloned both requested repos. Hyperlight host compiled with Rust 1.95 in 75 s.
The JS guest build on 1.95 failed exactly with `custom targets are unstable and
require -Zunstable-options`. Installed unpinned nightly was 1.87 and too old.
`nightly-2026-10-20` + `aarch64-unknown-none` + Homebrew LLVM succeeded: first
host/guest adapter build **174 s**, guest ELF **~2.3 MiB**. No default toolchain
changed. Compiled the native Node addon too (**59.27 s**, **5,043,040 bytes**).
Signing the actual host executable with `com.apple.security.hypervisor` was
necessary. A signed launcher alone failed with **HVF 0xfae94007**.

Command: `RUSTUP_TOOLCHAIN=nightly-2026-10-20 CARGO_TARGET_DIR=/tmp/jitk-09/adapter-target PATH=/opt/homebrew/opt/llvm/bin:$PATH cargo build --release --manifest-path arch/09-hyperlight-backend/Cargo.toml`.
Then signed binaries and executed JS; every successful numeric test returned 42.
Current main already has macOS/HVF support and a darwin-arm64 package directory;
the brief's older npm-platform limitation is not a source-build limitation.

### (b) Competitive measurements: ELIMINATED locally; Linux remains blocked

**Fresh initialization, Rust adapter, n=40, median / p90:**

- `SandboxBuilder::build` (not yet a VM): **1.294 / 1.390 ms**.
- Runtime evolve/init/register: **2.232 / 2.636 ms**.
- Handler load: **146.4 / 181.4 µs**.
- Full in-process initialized sandbox: **3.692 / 4.271 ms**.
- Create through first result: **3.754 / 4.352 ms**.
- First process's creation was **8.960 ms**; do not hide it as a warmup.
- Fresh process: internal create-to-result **5.536 / 5.902 ms**;
  whole process through exit **12.073 / 12.904 ms**.

**Warm execution, n=200 after 10 warmups, median / p90:**

- JS `20+22` + JSON API result, default GC: **20.062 / 20.958 µs**.
- Same-shaped handler with one Rust host addition: **29.041 / 30.417 µs**.
- Incremental crossing estimate: median difference **8.979 µs**; this is a
  subtraction of distributions, not a directly observed percentile.
- 100 host calls in one handler: **851.2 / 917.0 µs**, approximately
  **8.31 µs/call** after subtracting the plain-call median.
- Resolved Promise result: **20.480 / 21.792 µs**.
- Native Node addon, interleaved plain/async-host calls: **77.771 / 103.084 µs**
  plain; **108.604 / 149.709 µs** with Node callback. Do not advertise Rust
  crossing latency as the actual TS API latency.
- Native Node creation: **4.299 / 5.715 ms**; through result **4.575 / 6.727 ms**.

**Snapshots, n=40, median / p90:**

- Capture after a state mutation: **1.929 / 3.629 ms**.
- Restore captured state: **49.416 / 287.750 µs**; state checked after every reset.
- New logical sandbox from shared initialized snapshot: **11.708 / 19.541 µs**;
  through a JS host-call result: **294.583 / 361.375 µs**.
- Fresh process loading the persisted template: disk load **359.208 / 581.375 µs**;
  load + new sandbox **479.750 / 749.625 µs**; through JS host-call result
  **1.872 / 2.755 ms**; whole process **9.304 / 12.914 ms**.
  Warm filesystem cache. The snapshot contains a fixed test handler; generic
  per-request code compilation is not included in the clone timing.
- OCI save **37.768 ms**, **6.0 MiB** on disk (n=1; not a latency distribution).

**Memory measured with `proc_pid_rusage`, not configured heap sizes:**

- 32 independently initialized sandboxes: **669.096 MiB** process footprint;
  subsequent 31 increments median/p90 **20.438 / 20.516 MiB**.
- 32 shared-template logical clones, each executed and state-isolation checked:
  **40.502 MiB** total footprint including template/high-water allocator;
  marginal median/p90 **0.156 / 0.172 MiB** (31 increments).
- Fresh process from source, n=40: footprint delta **31.703 / 31.813 MiB**,
  median total **33.172 MiB**; median RSS **40.531 MiB**.
- Fresh process from persisted snapshot, n=40: footprint delta **0.750 / 0.766 MiB**,
  median total **2.266 MiB**; median RSS **8.656 MiB**. File-backed shared pages
  are not private footprint; kernel HVF allocations are not fully attributed by
  these process counters. This is not total system bytes per hardware VM.

HVF CPU contention test: 30 loop calls on one thread **1.348 s**, 120 on four
threads **5.456 s** → **22.25 versus 22.00 calls/s**. One aggregate trial/config;
source confirms the global lock [H1]. Logical residency is supported; simultaneous
CPU execution across those sandboxes is serialized. I/O-bound overlap across
sandboxes is not ruled out by this CPU test.

Linux production numbers: **BLOCKED/UNVERIFIED**. Actual attempt:
`docker run --rm --pull=never alpine:3.22 ... test -c /dev/kvm` returned exit 1
for that test; no `/dev/kvm` in the arm64 Docker environment. Need a real KVM host
for CPU scaling, process density and throughput. Do not transfer HVF results to KVM.

### (c) Async tools and protocol adapter: ELIMINATED for sequential calls

`node --experimental-transform-types .../backend-smoke.ts` exercised async host
I/O, rejection propagation and `Promise.all([add(1,2),add(3,4)])` → `[3,7]`.
A 100 ms supervisor deadline killed an infinite guest (~103 ms in the first run).
The generic bootstrap emitted the exact `{t:"call",id:0,ns:"math",fn:"add",args:[20,22]}`
and `{t:"done",result:42}` frames. Promise/Proxy/console exist; **setTimeout is
undefined**. Default global console only installs `.log` [J5]. Code-mode parity
therefore still needs timer/console shims or a tiny custom-runtime extension.

Guest-native concurrent async calls: **NOT SUPPORTED by this host-call design**
[J3]; use batch calls if required. This is a capability limit, not a pending
compiler fix. Strict supervisor confinement: **UNVERIFIED**; the actual
`sandbox-exec '(allow default)(deny network*)'` trial ran HVF successfully, proving
coexistence only. Full deny-by-default confinement needs a separate policy/test.

### (d) Unmodified Linux programs: confirmed differentiator, not eliminated

Executed `load_linux /tmp/jitk-spike/sc/qjs-static` with a 3 s external timeout.
ELF loading returned; `evolve` did not initialize the Linux binary, and it was
killed after **3.047 s**. No result. This is evidence for this binary/version,
not a claim that Hyperlight cannot load ELF containers. It needs a different
ABI/runtime; jitk deliberately implements that missing ABI.

## 4. What I'd cut

- Cut a new kernel from the critical path for JS-only execution. Deliver the
  Hyperlight adapter and a real code-mode workload corpus first.
- Cut NAPI from the initial trusted control plane: a Rust sidecar isolates
  native crashes and gives both backends the same protocol and deadline model.
  Retain NAPI benchmarks so this choice's IPC/process overhead stays visible.
- Cut cross-architecture/machine snapshot portability, disk snapshot writes per
  job, runtime hot-swapping, binary sidecars, filesystem loaders and real guest
  async scheduling from v0. Build/sign one template per supported CPU/version.
- Keep snapshot reuse in the competitor; cutting it manufactures a weak baseline.

## 5. Open disagreements with brief consensus

1. **“Defer snapshots” is wrong for the competitor.** Fresh initialization adds
   ~20.44 MiB/resident sandbox; shared templates add ~0.156 MiB in this test,
   about **131× less** marginal private footprint. The public API already exists.
   This does not establish jitk should implement snapshots before measuring it.
2. **“One VM per process on HVF” needs a contract distinction.** One Apple VM,
   many logical memory-isolated sandboxes, global execution lock. Pooling one
   process/job preserves fresh VM identity but misses the 0.3 ms logical path.
3. **Hyperlight's “1–2 ms” is attainable inside a fresh snapshot-backed worker**
   (1.872 ms here), not our whole-process startup (9.304 ms). Both numbers matter.
4. **jitk is not currently justified by JS-only scale/perf.** The brief's
   libkrun 5.9 ms result is boot + initrd, not evaluated JS; our 9.3 ms is a
   process plus evaluated host-call result. They are not an apples-to-apples
   victory for either side. jitk must compete against templates and equivalent
   snippets, GC, policy transport and single-use contract before claiming a win.
5. **Linux ABI growth is a real differentiator.** Preserve jitk if unmodified
   static programs or EL0/EL1 separation are product requirements. If the actual
   product is only JS calling tools, Hyperlight could make the kernel project
   pointless; the remaining production KVM comparison must decide that honestly.

## 6. Estimated LOC

Current sketches: ~300 Rust/TS/JS lines plus measurement scripts (see files).
Production backend estimate **350–600 handwritten LOC**: sidecar 100–150,
TS protocol/policy/deadline adapter 150–250, template factory/pool integration
100–200; excludes shared policy engine, generated bindings, and dependencies.
No guest-kernel LOC. Hyperlight/QuickJS and their dependencies remain a large
external TCB; “zero new kernel LOC” is not “zero complexity.” Estimates are
**UNVERIFIED**, not measured implementation counts.

### Pinned source references

`H` = hyperlight **8a7e6b8794fea050ce287eed614088f0beb6b973** (0.18.0).
The measured host dependency is crates.io hyperlight-host 0.18.0; relevant HVF
code agrees with this clone. `J` = hyperlight-js
**8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7** (0.4.0).
The spike's `Cargo.lock` pins Rust-benchmark dependencies (rquickjs 0.12.2);
NAPI used J's committed lock (rquickjs 0.12.1). Do not conflate their bridge costs.

- [H1](https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_host/src/hypervisor/virtual_machine/hvf/mod.rs#L713): one VM; memory-space lock at 998, exclusive installation at 1088.
- [H2](https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_host/src/sandbox/initialized.rs#L241): public snapshot constructor; snapshot capture at 392, restore at 569.
- [H3](https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_host/src/sandbox/snapshot/file/mod.rs#L726): persisted snapshot load; see also `docs/snapshot-versioning.md` and `docs/snapshot-oci-format.md`.
- [H4](https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_host/src/sandbox/host_funcs.rs#L83): default print; `uninitialized.rs:300` overrides it.
- [H5](https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_guest_bin/src/arch/aarch64/mod.rs#L6): I/O page, stores at 37/109; guest `transport.rs:4` initializes shared queues.
- [H6](https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/src/hyperlight_host/src/hypervisor/hyperlight_vm/aarch64.rs#L132): EL1t startup.
- [H7](https://github.com/hyperlight-dev/hyperlight/blob/8a7e6b8794fea050ce287eed614088f0beb6b973/docs/security.md#L8): threat model and host-function access.
- [J1](https://github.com/hyperlight-dev/hyperlight-js/blob/8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7/src/js-host-api/src/lib.rs#L738): Node module prefix; Rust `sandbox/host_fn.rs:174` records exact names.
- [J2](https://github.com/hyperlight-dev/hyperlight-js/blob/8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7/src/hyperlight-js/src/sandbox/proto_js_sandbox.rs#L135): registration bridge; clock at 65, optional loader at 78.
- [J3](https://github.com/hyperlight-dev/hyperlight-js/blob/8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7/src/js-host-api/src/lib.rs#L1516): oneshot/TSFN/Promise; guest completion `hyperlight-js-runtime/src/lib.rs:369`.
- [J4](https://github.com/hyperlight-dev/hyperlight-js/blob/8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7/src/hyperlight-js/src/sandbox/loaded_js_sandbox.rs#L175): unload, snapshot, restore.
- [J5](https://github.com/hyperlight-dev/hyperlight-js/blob/8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7/src/hyperlight-js-runtime/src/globals/console.rs#L21): default console setup.
