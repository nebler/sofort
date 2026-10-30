# Canonical TypeScript executor (owner 04)

`MicroVMExecutor` implements Cloudflare codemode's Executor and TanStack's
IsolateDriver. Every execute acquires a fresh, single-use microVM. Tool calls
run concurrently on the trusted host; the guest receives only JSON results.

Every backend is an `Engine` (`engine.ts`): `park()` yields a `Session` that
runs one `Job` (`start`, `next` -> typed `GuestEvent`s, `reply`), and
`release()` kills its process or resets its slot; `released` resolves when the
capacity is free. `Engine.limits` reports what a session admits (memory class,
concurrent sessions and starts, deadline horizon, and per JS job the tool
calls, call/reply/completion bytes, logs, source size, timers, arena): the
jitk-abi ring limits (`abi.ts`) for the shard and the HVF engine, protocol v1
(`LIMIT`) for the process backends. The executor, the pool and the MCP server read these instead
of hard-coding them or branching on the backend kind.

A job is `js` (tenant code and tool names, run by `MicroVMExecutor`) or
`native` (a prepared static program, its args and input files, run by
`NativeExecutor`). `native-backend.ts` is the persistent arm64 ring worker
(`real native-worker` on Linux KVM, `hvf native-worker` on macOS HVF,
`../shard/ABI-R7.md`) as an Engine with one session: a
native session yields `stdout`, `stderr` and `done {exitCode, outputLimited}`,
and its `limits.native` carries the profiles and the JNR8 request/output bounds.
Each request carries its budget, which the worker enforces itself; the backend
restarts a worker it had to stop (missed deadline, broken frame) within
`NATIVE_RESTARTS` (5 per 60 s). A cancel mid-run drains instead: the caller's
run ends at once and the worker finishes it within its budget, spending no
restart.
`native-check.ts` runs it on a stand-in worker (`fixtures/native-worker.mjs`).

## Build, test, demo

Use a real **absolute Node >=24** executable. PATH `node` on this machine may
be a Vite+ shim. Set `JITK_NODE=/absolute/path/to/node`. No command invokes PATH node.
The independent watchdog and IPC tooling use scriptc native executables. Run
`make tools` (scriptc 0.4.5 is pinned in `../docs/`), with the kernel/VMM build
prerequisites documented in those subtrees.

```
cd arch/jitk/executor
# Install exact package-lock dependencies with your npm installation first.
# .npmrc selects legacy peer resolution: codemode's optional TanStack peer
# excludes 1.0, whose driver is covered by the conformance suite below.
# npm ci --ignore-scripts (esbuild's platform binary is a pinned dependency)
export JITK_NODE=/absolute/path/to/node
./run.sh build
./run.sh test
./run.sh demo
./run.sh bench
./run.sh hvf-parking-gate   # macOS: the HVF engine's G1 receipt (make hvf-parking-gate: only when stale)
```

`package.json` exposes the same build/test/demo/bench scripts. `build` checks
strict TypeScript and creates Node ESM bundles in `build/`. Production entry:
`build/executor.js`. Bundles import the canonical protocol source at build time;
there is no maintained decoder/bootstrap copy here. Build protocol before this
subtree when using the top-level Makefile. MIT codemode helpers live in vendor/;
package-private upstream exports are never loaded. `examples/demo.ts` replays an
agent-produced code snippet, runs two tools concurrently and prints result,
maximum active tools, phase timings and uptime; no model credentials are needed.

## Artifact selection and confinement

`selectBackend()` picks the ring engine for this host: the HVF engine on
macOS arm64 (the default there, `JITK_BACKEND=hvf`) and the KVM shard on
Linux arm64 (the default there, `JITK_BACKEND=shard`), from
`JITK_SHARD_BINARY` (the signed `hvf` / `real` binary) and
`JITK_SHARD_SNAPSHOT` (a prepared snapshot base; `run.sh` and the delegate
take both from the jitk cache: `make -C .. deps`, `make -C ../shard
snapshot`). `JITK_SHARD_CLASS` picks the memory class (`glue-2m`, the
default; `glue-4m` for values past about 64 KiB; `glue-8m` or `glue-16m` for
real code-mode tasks and tool replies over 1 MiB; `../shard/README.md`
"Limits"): `deps env` then names that class's snapshot, and the backend
refuses a snapshot of another class. It reads no `.READY` marker. The selection, the engine's and the
snapshot identity's hashes and the parking gate are written to
`integration-selection.json` (`.work/`, `JITK_RECORD=1`: here). Missing
artifacts fail with build instructions.

`ProcessBackend` remains for engines that speak protocol v1 on stdio (09's
Hyperlight adapter, kind `hyperlight-js`, and test peers). Deadlines are
enforced by one shared native watchdog per executor, the `process-watchdog` mode of
the engine binary (`../shard/src/watchdog.rs`;
set `watchdog` or `JITK_WATCHDOG` to override `JITK_SHARD_BINARY`). It is a
separate process, so it fires while a tool blocks Node, but it is spawned
once instead of per process (the former per-VM Python script cost ~20–40 ms
per cold start). It tracks exits via pidfd/kqueue, waits for its
acknowledgement before a run is sent, and SIGKILLs every tracked process on
malformed input or EOF.

Host callbacks still run on Node. Blocking them delays Promise settlement and
AbortSignal delivery until Node resumes; killing the VM cannot unblock a host
callback. A 200 ms blocking callback therefore cannot satisfy an 80 ms API-return
bound. Explicit `Tool.invoke(args, credential, {signal,idempotencyKey})` receives
the cancellation signal. Compatibility provider functions receive the same
signal as `this.signal` (use a regular function); positional guest arguments stay
unchanged. Signals are cooperative and cannot interrupt synchronous JS.

## Resolve before reap (E4)

A validated done resolves execute. The successful path only clears its timer,
detaches abort listeners, marks the run dead and schedules disposal with
setImmediate. SIGKILL, tool cancellation, both child reaps, and bounded refill
run after the caller's promise continuation. Capacity stays charged until
**both the VMM and watchdog close**. Single-use sandboxes never return to the
parked reserve. `resolve-check.ts` proves this with independently delayed reaps;
`breakdown.ts` asserts the real SIGKILL follows caller resolution in every sample.

`pool.drain()` explicitly waits for deferred disposals when a caller needs to
pace cold sequential work without exhausting its capacity. `pool.close()`
awaits startups, both child reaps and deferred disposals. When no VM is parked
and no capacity is free (tokens stay charged through reap or shard reset),
`acquire` waits in a bounded FIFO queue (`maxWaiting`, default max(64, 4 × maxLive)).
Freed capacity goes to the head waiter, and abort or deadline removes a waiter.
Closing the pool or a backend death rejects them. Only a full queue sheds, with
`OverloadedError` (`code: 'OVERLOADED'`). `ShardBackend.park` queues the same
way (`ShardOptions.maxWaiting`). `refillConcurrency` defaults to the engine's
`limits.parallelStarts` capped at maxLive: every slot for the shard, 2 VMM boots
for process backends. The pool has no backend-specific branch. Warm pools require supplied
G1 evidence strictly below 2% idle core. The shipped parking receipt binds
the measured VMM/kernel hashes; different artifacts need fresh G1 evidence. Lifecycle hooks observe release/released (`Session.release()`, `Session.released`);
RunOptions.onTiming observes start/acquired/runSent/firstCall/firstRet/done/resolve.
Hooks are diagnostic and exceptions cannot affect admission or results.

## Host policy (E5)

`policy-adapter.ts` loads the canonical `policy/policy.mjs`. No rules are copied.
Pass `{tools,issuer,limits}` as the fourth constructor argument. Each declared
Tool has args/output validators; reads=none/public/private, egress, writes,
endorsable, optional always-approval, timeoutMs, and a host-only invoke function.
When a tools registry is supplied, every provider capability must be declared.
Credentials are minted for that exact call and revoked by 07's dispatch; tokens
never become guest arguments. Invoke receives the credential, AbortSignal and
run:id idempotency key. The second constructor callback can further restrict
calls and cannot override a denial/approval from 07.

After a private read, egress is denied or requires bound approval; after
untrusted output, writes require approval. Public browsing remains free.
Approvals bind the exact host-normalized call, use 07's single-use digest and
fail closed without the caller's authenticated approval callback. The guest
cannot alter host labels. Legacy ResolvedProvider functions without a registry
are a **trusted caller declaration of credential-free public computation**:
no egress and no writes. Supply explicit effects for every real external tool;
the executor cannot infer side effects from function code.

Taint follows the conversation, not only one run: the labels a run ends with come
back in `RunResult.provenance` (`'private-data'`, `'tool-untrusted'`), and a caller
that shows the result to a model passes them as `RunOptions.provenance` to that
model's next `execute()`, which starts tainted. A fresh conversation passes none.
Other provenance labels are metadata for the policy callback and do not drive admission.
Opaque host handles remain v1, per E5.

`policy-check.ts` imports the canonical `policy/policy-test.mjs` assertions
against the imported module,
then 22 assertions through real executor VMs: private read/egress, public
browsing, write approval, exact call, schemas, denial/call budgets, credential
scope/revocation and redaction. This suite supplies explicit host effects.

## Evidence

JSON results under `.work/` record loads and artifact selection. Tests cover the 20 R2 cases,
Cloudflare generated wrappers and TanStack, 30 reverse-order concurrent-call
fan-outs (64 calls, or the engine's call budget when smaller: 32 on the ring
profile today), hostile transport, independent watchdog and pool lifecycle,
on this host's default engine. Checks at a limit read `Engine.limits` (log
count, call budget; the Cloudflare wrapper gets a never-firing `setTimeout`
on an engine without timers), so they follow the ring profile as it is
lifted. The backend-parity corpus (`parity/README.md`, `./run.sh parity`)
runs one case list on every available Engine: 09's Hyperlight
adapter (kind `hyperlight-js`, the benchmark baseline) and the HVF engine
(kind `hvf`) on the Mac, the shard on Linux
(`make -C arch/jitk test-linux`).

`breakdown-results.json` is an E4 diagnostic (50 samples, 5 excluded warmups),
with phase p50/p90/p99, every uptime, 06's load gate result per sample, and
kill/reap offsets **after** caller resolution. The gate uses 06's function with
a zero wait budget and flags contended samples; it makes no quiet-host claim.
Phases: acquire=start→acquired, sendRun=acquired→write callback,
firstCall=runSent→first call, ret=first call→first ret write,
done=ret→validated done, resolve=done→caller continuation. Refill is excluded
and recorded separately. Published performance comparisons belong only to
`../bench/RESULTS.md`, the canonical load-aware table.

Production Linux
timing and sustained capacity are not established by macOS functional
executor tests.

## Linux shard backend (R7; the Linux default)

The KVM shard is the default engine on Linux arm64 (`JITK_BACKEND=shard`
names it):

```sh
make -C .. deps                # pinned Node + shard binary (JITK_NODE, JITK_SHARD_BINARY)
make -C ../shard snapshot      # prepared helper snapshot (JITK_SHARD_SNAPSHOT)
./run.sh build
```

One shard engine process maps every guest it runs, so it is one trust
domain. `JITK_SHARD_SLOTS` (default 64) and `JITK_SHARD_PROCESS_SLOTS`
(default: all of them) choose how many engine processes share them; below
the total, `selectBackend()` returns a `ShardSet` (`shard-set.ts`), and `1`
runs every VM in its own process (costs: `../shard/README.md` "Trust
domains").

`run.sh` takes `JITK_NODE`, `JITK_SHARD_BINARY` and `JITK_SHARD_SNAPSHOT` from
the jitk cache (`../tools/.work/bin/deps env`) unless they are set. The shard
binary is built from `../shard` with the pinned toolchain; the snapshot step
([`../shard/snapshot.ts`](../shard/snapshot.ts)) uses the existing kernel
`JITK_SCRIPT` build input to evaluate the codec and carrier helpers before
CHECKPOINT, producing a separate ring image, and is idempotent.
Each run sends only user code, provider descriptors/preludes and a small binding.
The `.identity` sidecar binds the helper-source SHA-256, the ring kernel
SHA-256 and the `.mem/.regs/.layout` hashes. The executor checks it before spawning a shard; old snapshots or changed
helpers fail with a clear reprepare error. Never replace active snapshot files.
Helper objects and globals are guest memory restored on every generation.
MCP reads the same selection; use `"warm":0` on Linux (no parking receipt is
certified for the KVM shard). Call `pool.close()` to reap the one shard.

Node has no mmap API. `ipc/bridge.c` is a small Linux N-API addon, built only
when the shard is selected or its tests are requested. It needs a C11 compiler
and Node headers (`JITK_NODE_INCLUDE`, default `../include/node` beside Node).
It uses Node's existing libuv loop to watch eventfd doorbells. There are no
per-call helper processes, background polling threads, pipe payloads or external
npm native dependencies. A sealed memfd carries two 64-record SPSC queues;
records have a 32-byte header and <=16,384 payload bytes. The 2,105,344-byte
mapping is fixed per shard, shared by at most 64 slots. The shard receives only
those descriptors and `PATH=/usr/bin:/bin`; credentials stay in Node policy.
See [ipc/ABI.md](ipc/ABI.md) for bounds, ordering and generation validation.

```sh
# Linux, after building/preparing the artifacts above:
make test-shard
# Mac -> existing kvm-dev, following linux/nested/run-ssh.py's SSH pattern:
JITK_SHARD_TEST=ssh make test-shard
# Also collect 200 tiny runs + 20 blocked-Node deadline samples under the same lock:
JITK_SHARD_TEST=ssh JITK_SHARD_BENCH=1 make test-shard
# Include the focused SSH suite in the normal executor/top-level make test:
JITK_SHARD_TEST=ssh make test
```

SSH uses `JITK_NESTED_SSH` or the project's `kvm-dev/ssh.sh`. It needs nothing
prepared on the VM beyond rustup (`rustup toolchain install 1.95.0 --profile
minimal --target aarch64-unknown-none`, the `tools/deps.json` pin), `cc`,
`clang`, `llvm-objcopy`, `flock` and network access on first use. The runner
stages this tree's sources under `JITK_SHARD_REMOTE_ROOT` (default `jitk-ssh` in
the remote home; `JITK_SHARD_OUTPUT` for local receipts) and runs
[`ipc/shard-host.sh`](ipc/shard-host.sh) there: `make deps` and
`make -C shard snapshot` into the remote jitk cache, the shard binary's own
tests, the exact JS lockfile with scripts disabled, the addon, then the Linux
tests under the bench lock (`JITK_BENCH_LOCK`, default `~/bench.lock`).
On a Linux host, `sh ipc/shard-host.sh` is the same check without SSH. It never
manages the VM lifecycle. Mac `make test` without this opt-in stays unchanged.

The ring profile has protocol v1's source (LIMIT.code), call
(4,096 per run, 64 open, 2 MiB in flight), reply and completion (LIMIT.frame)
and log (1,024 lines, one-way) bounds and its timers (setTimeout,
setInterval and their clear functions); messages stream over the fixed rings
and IPC records (`../shard/ABI-R7.md`). What still differs is live memory: the
snapshot's arena class bounds a run's QuickJS heap. The default glue-2m
leaves about 370 KiB, so a reply past about 107 KiB, a completion past about
141 KiB or a call echoed back past about 72 KiB ends in a QuickJS
out-of-memory error (`LIMIT` through MCP), where the console profile has
16 MiB (parity: `b-json1m`, `t-memory-over-arena`). `JITK_SHARD_CLASS=glue-4m`
gives about four times that heap (a 512 KiB tool result is read, a 320 KiB
value round-trips) for twice the memory charge and reset copy; glue-8m and
glue-16m about 13 and 33 times, with tool replies to 2 and 4 MiB (sizes and
costs per class: `../shard/README.md` "Limits"; which real tasks each class
completes: `../bench/v1/results/2026-10-31-capacity.md`). The run's heap
high-water is `ShardMetrics.heapPeakBytes` (STATS). `/cap`, cancellation of a busy vCPU and broad shadow
parity remain cutover blockers. Older measurements are in
[the R7 IPC report](../docs/results/shard-r7-ipc.md).

## macOS HVF engine (the macOS default)

The same ring engine on Hypervisor.framework, the default on macOS arm64
(`JITK_BACKEND=hvf` names it):

```sh
make -C .. deps                # pinned Node + the signed `hvf` engine (JITK_SHARD_BINARY)
make -C ../shard snapshot      # darwin-arm64 prepared snapshots (JITK_SHARD_SNAPSHOT)
./run.sh build                 # JITK_HVF_SLOTS engine processes (default 8)
```

`ShardBackend` is the engine on both hosts (kind `shard` on Linux, `hvf` on
macOS): the same START/REPLY/CANCEL and CALL/STATS/DONE/ERROR/RELEASED/
QUARANTINED messages, generations, ABI version and `Engine.limits`
(`shardLimits`, the jitk-abi ring profile). Only the transport differs: on
macOS the 32-byte-header records travel back to back over the stream socket
Node's spawn creates for a `pipe` stdio entry (`PipeChannel`, `shard-ipc.ts`;
no native addon), and deadlines are on `process.hrtime`, which the engine
reads as CLOCK_MONOTONIC_RAW. HVF allows one VM per process, so the engine
(`../shard/src/hvf/zygote.rs`) is a single-threaded zygote that forks one
engine process per slot. The zygote enters the engine's Seatbelt profile (jitk.sb)
plus fork and signalling its children before its first fork; each engine
process inherits it and drops the fork grant before creating its VM
(`make -C ../shard test-hvf` runs `hvf confine`: files, writes, network and
exec denied to both, fork denied to engine processes, HVF allowed). The
zygote kills an engine process
whose run outlives its deadline by 100 ms; a dead engine process fails its run
and its slot is QUARANTINED, then re-forked and RESTORED (`onRestore`;
`capacity.lost` counts slots quarantined and not yet restored; a crash loop
fails the engine). `close()` closes the socket and the zygote reaps
every engine process.

`run.sh test` runs `shard-check.ts` on the HVF engine whenever
`JITK_SHARD_SNAPSHOT` is available (the Linux-only memfd and hostile-peer
sections are skipped; the macOS-only section kills, stops and reaps engine
processes), and the parity corpus includes `hvf` by default on the Mac. Per-run
cost: `node build/engine-bench.js` (offline; see
`../shard/README.md` "HVF engine").

Warm parking (G1 on HVF). A pool keeps sessions parked only with a parking
gate (`SandboxPool` `parkingGate`). `./run.sh hvf-parking-gate`
(`hvf-parking-gate.ts`, offline) measures the HVF engine the way kernel/.READY's G1
measures a console VM: every slot parked for 10 s (CPU of the zygote and all
engine processes by `ps`, below 2% of a core), then 1000 checked tool-call
exchanges through the executor (one run, within the 4,096-call budget) with a
3 s parked-in-WAIT pause every
100th. It writes `.work/hvf-parking-gate.json` (`JITK_RECORD=1`:
`hvf-parking-gate.json` here), binding the engine binary's sha256, the
snapshot's `.identity` sha256 and the slots. `select-backend` (so the MCP
server's `warm`) returns it as the gate for the HVF engine only when all
three match (`JITK_HVF_PARKING_GATE` names one explicitly); a rebuilt engine (`make -C arch/jitk test` measures one when stale, `make hvf-parking-gate`)
needs a new run. Measured 2026-10-28, M4 Pro, macOS 26.6.1, load 3.7–4.6:
8 slots, 0.00 CPU-s in 10.0 s for 9 processes (below `ps` resolution),
1000/1000 exchanges in 32 runs (p50 5.7 ms per 32-call run without a pause).
No `.READY` is involved or changed.
