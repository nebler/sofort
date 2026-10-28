# Canonical TypeScript executor (owner 04)

`MicroVMExecutor` implements Cloudflare codemode's Executor and TanStack's
IsolateDriver. Every execute acquires a fresh, single-use microVM. Tool calls
run concurrently on the trusted host; the guest receives only JSON results.

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
./run.sh certify  # final integrated gate; emits .READY only on success
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

`selectBackend()` independently adopts `vmm/.READY` and `kernel/.READY`.
The root is derived from the emitted module's location, so renamed checkouts
work. Local conventional build outputs and relative JSON marker paths are used.
Set `JITK_VMM_BINARY=/absolute/path/to/jitk-vmm` and/or
`JITK_KERNEL_IMAGE=/absolute/path/to/kernel.bin` to select built artifacts.
Overrides are hashed and recorded; automatic selections verify marker hashes.
Missing artifacts fail with build/override instructions. Selection, hashes and
parking evidence are written to `integration-selection.json`.

The canonical JitkBackend requires both the exact stderr host acknowledgement
`{"sandbox":"ok"}\n` and validated guest READY before it exposes a parked
sandbox. fd2 is always a pipe (Linux FSIZE=0). A guest cannot supply the ack.
For macOS the supervisor compiles 07's profile once per VMM/image-directory
combination on the current OS, then passes `--sandbox-profile` to every worker.
An explicit profile may be supplied. Legacy R2 launchers must explicitly set `requireSandboxAck:false`.
The CLI keeps --image/--mem-mib, and the VMM supplies random seed and epoch by
default. Deadlines are enforced by one shared native watchdog per executor, the
`--watchdog` mode of `jitk-vmm` (`vmm/src/watchdog.rs`; set `watchdog`, `JITK_WATCHDOG` or
`JITK_VMM_BINARY` for non-jitk backends). It is a separate process, so it fires while a tool
blocks Node, but it is spawned once instead of per VM (the former per-VM Python script cost
~20–40 ms per cold start). It tracks exits via pidfd/kqueue, waits for its acknowledgement
before a run is sent, and SIGKILLs every tracked VM on malformed input or EOF.

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
way (`ShardOptions.maxWaiting`). `refillConcurrency` defaults to maxLive for the
shard backend and to 2 VMM boots for process backends. Warm pools require supplied
G1 evidence strictly below 2% idle core. The shipped parking receipt binds
the measured VMM/kernel hashes; different artifacts need fresh G1 evidence. Lifecycle hooks observe kill/reaped;
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
the executor cannot infer side effects from function code. The older provenance
array remains observational compatibility metadata and does not drive admission.
Opaque host handles remain v1, per E5.

`policy-check.ts` imports the canonical `policy/policy-test.mjs` assertions
against the imported module,
then 22 assertions through real executor VMs: private read/egress, public
browsing, write approval, exact call, schemas, denial/call budgets, credential
scope/revocation and redaction. This suite supplies explicit host effects.

## Evidence

`test.log` and JSON results record loads and artifact selection. Tests cover the
20 R2 cases, Cloudflare generated wrappers and TanStack, 30×64 reverse-order
concurrent calls, hostile transport, host ack, independent watchdog and pool
lifecycle. The backend-parity corpus (`parity/README.md`, `./run.sh parity`)
runs one case list on every available Engine: `jitk` and 09's Hyperlight
adapter (kind `hyperlight-js`, the benchmark baseline) on the Mac, `jitk` and
the shard on Linux (`make -C arch/jitk test-linux`).

`breakdown-results.json` is an E4 diagnostic (50 samples, 5 excluded warmups),
with phase p50/p90/p99, every uptime, 06's load gate result per sample, and
kill/reap offsets **after** caller resolution. The gate uses 06's function with
a zero wait budget and flags contended samples; it makes no quiet-host claim.
Phases: acquire=start→acquired, sendRun=acquired→write callback,
firstCall=runSent→first call, ret=first call→first ret write,
done=ret→validated done, resolve=done→caller continuation. Refill is excluded
and recorded separately. Published performance comparisons belong only to
`../bench/RESULTS.md`, the canonical load-aware table.

`.READY` is written only after final tests and the demo pass with canonical
VMM/kernel markers, shared protocol and 07 policy. Production Linux timing and
sustained capacity are not established by macOS functional executor tests.

## Experimental Linux shard backend (R7)

`jitk` remains the default on every platform. On Linux arm64, select the new
backend explicitly:

```sh
make -C .. deps                # pinned Node + shard binary (JITK_NODE, JITK_SHARD_BINARY)
make -C ../shard snapshot      # prepared helper snapshot (JITK_SHARD_SNAPSHOT)
JITK_BACKEND=shard ./run.sh build
```

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
No image or libkrun default changes. MCP reads the same `JITK_BACKEND` selection;
use `"warm":0` for this experimental backend (a new parking receipt is not yet
certified). Call `pool.close()` to reap the one shard and its independent watchdog.

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
tests under the bench lock (`JITK_BENCH_LOCK`, default `/home/dev/bench.lock`).
On a Linux host, `sh ipc/shard-host.sh` is the same check without SSH. It never
manages the VM lifecycle. Mac `make test` without this opt-in stays unchanged.

The ring profile has smaller source, call, reply and live-memory bounds than
libkrun. Small codec values, Unicode, concurrent tools, structured tool errors
and console logs are supported through adapters. Clocks during uninterrupted
CPU work, timers, `/cap`, large values, cancellation of a busy vCPU and broad
shadow parity remain cutover blockers. The exact test/parity table and nested
measurements are in [RESULTS-R7-ipc.md](../shard/RESULTS-R7-ipc.md).
