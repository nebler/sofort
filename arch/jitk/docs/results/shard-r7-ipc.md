# R7 — Node policy over bounded shared-memory shard IPC

Agent `r7-ipc`, 2026-10-25–26. Worktree
`/Users/noah/.t3/worktrees/sofort/t3-60f3ed89`, branch `t3/r7-ipc`.
Base: `d8ef82b`.

`JITK_BACKEND=shard` selects the Linux arm64 QuickJS shard; `jitk`/libkrun
remains the default everywhere. Real guest calls now reach the existing Node
executor policy and host providers. Rust contains no provider registry, grant
rules, credential issuer or credentials. The focused SSH test passes **119
assertions**; all **18 Rust tests** and all **ten Mac subtree suites** pass.
This is cutover-plan step 1, not gate 8 or full feature parity.

## Implementation and commits

- `49c227f` — Bounded shared-memory reactor, strict admission/reply schemas,
  owner policy mode and stopped-reset acknowledgements.
- `e25d268` — Selectable Node backend, N-API mmap/eventfd bridge, existing policy
  dispatch and codec, guest adapters, hostile tests and SSH test hook.
- `593cf2a` — Owner-observed policy round-trip receipts, CPU/deadline harness,
  stricter JSON validation and final functional/MCP checks.
- `19b5a1e` — Abort stalled startup/admission writes, force persistent backend
  shutdown before waiting on slots, fix zero-slot owner queues and add hostile
  credit-withholding coverage.
- Final evidence/report commit: the commit containing this file.

Node has no built-in mmap. A small, dependency-free C11 N-API addon maps one
**2,105,344-byte sealed memfd** containing two **64-record SPSC queues**. Each
fixed slot is 16,416 bytes: 32-byte header plus <=16,384 payload bytes. Two
eventfds are doorbells/credit notifications, watched by Node's existing libuv
loop and the Rust reactor. There is no per-call process, pipe payload, helper
thread or libuv worker-pool job. The execute path has Node, one shard with four
owners plus its reactor, and one independent watchdog process.

The addon is necessary only on the selected Linux shard path; Mac/default
libkrun builds do not acquire new native build requirements. It uses matching
Node headers and the installed C compiler, with no new npm or Cargo dependency.
See [executor IPC ABI](../../executor/ipc/ABI.md) for exact layout and bounds.

Both endpoints shadow cursors privately. A receiver copies an entire fixed slot
before interpreting hostile fields. Neither a peer cursor nor a message length
can supply an address or an unbounded allocation. Size seals prevent truncation
and SIGBUS. Node receives copied Buffers and never exposes the mmap to JS.
Both sides validate direction, bounds, slot, generation, identity and state;
Node additionally uses the canonical protocol dispatcher before canonical policy.
The writer/outbound queues cap at 2,241 messages, owner command queues at
`34 * owned_slots + 1`, owner events at slots+owners, and Node protocol staging at
34 frames/run. Node accepts at most 35 shard records/generation. Physical slots
cannot be reused before the matching RELEASED reset acknowledgement.

Admission carries absolute CLOCK_MONOTONIC deadline ns, source length, 32-call /
1,024-byte-call caps and the 2-MiB reservation. The existing independent lease
watchdog enforces the deadline without Node event-loop progress. Rust runs with
only `PATH=/usr/bin:/bin` and three explicit IPC descriptors; Node death kills
it through PDEATHSIG. Policy credentials are issued, used and revoked only by
Node's existing `executor/policy/`. Successful completion resolves before the
pool's deferred stopped reset, and capacity remains charged until reset ack.

The prepared guest's raw echo function is now only a transport carrier. It sends
`["call",namespace,function,args]`; Node dispatches the actual declared provider
and returns an explicit `{ok}`/`{err}` envelope. Host replies replace synthetic
values. A private logical-to-physical ID map permits console log acknowledgements
without corrupting the canonical policy call sequence. Source is encoded as a
JSON string and compiled in the guest, preserving Unicode raw-template syntax.

## Nested measurements

Ubuntu 26.04 arm64, Linux 7.0.0-38-generic, 6 vCPUs / 9 GiB, 4-KiB pages,
Rust 1.99.1, Node 24.13.0; outer Apple M4 Pro/macOS. Load1 is **0.24** at start,
**0.41** after tiny runs and **0.45** after deadlines. These are **nested,
indicative measurements**, not metal results. Raw: `bench-final.jsonl`.

| Measurement | n / method | Nested result | Architecture / v1 budget |
|---|---|---:|---|
| Owner CALL→Node policy→owner RET | 200 immediate echoes, nearest-rank p50 / p99 | **816.962 / 3993.560 us** | 120-us echo allocation missed; extra-call 30/60-us allocation also missed |
| Execute→result | 200 one-tool runs, p50 / p99 | **50.367 / 81.165 ms** | §5 <=1-ms p50 and v1 <=2-ms p50 missed |
| Node service CPU | process CPU mean, 200 runs | **2.130 ms/run** | **>100 us/run** broker-replacement trigger crossed in this instrumented nested run |
| Shard service CPU | /proc process CPU mean, 200 runs | **56.400 ms/run** | Includes owners, reactor and deferred reset |
| Watchdog service CPU | /proc process CPU mean, 200 runs | **0.100 ms/run** | Separate process; included below |
| Total service CPU | Node + shard + watchdog | **58.630 ms/run** | <=2-ms gate missed |
| Node share of service CPU | CPU ratio | **3.634%** | Below 20%; the **OR 100-us** rule still triggers |
| Owner thread CPU diagnostic | 200 runs, mean | **52.133 ms/run** | Subset of shard CPU; not added again |
| Deadline→owner stop | 20 expiries, p50 / p99=max | **0.771 / 9.796 ms** | Responsive-owner stop below 50 ms |
| Deadline→reset receipt | 20 expiries, p50 / p99=max | **3.509 / 16.136 ms** | Responsive-owner reset below 50 ms |

The earlier R7-shard one-tool fixture reported 44.667 ms of owner CPU with a
short synthetic-echo body. This integration parses the codec/adapters and
services actual Node policy; its 52.133-ms owner diagnostic and 58.630-ms total
are **not a speedup**, and the differing bodies, kernel builds and process accounting do not
isolate an IPC-only CPU tax. Re-evaluate both implementations on reference metal.
The 100-us rule is exceeded here; confirm with an uninstrumented
metal run before choosing the replacement broker work.

Method: 200 sequential one-tool runs after five excluded warmups in one reusable
physical slot, Node's ordinary `MicroVMExecutor` and canonical policy, immediate
credential-free echo provider. Execute→result is measured at the caller before
deferred reset; service CPU includes `pool.drain()` and therefore stopped reset.
CPU is Node `process.cpuUsage()` plus shard and watchdog `/proc/PID/stat` deltas;
owner thread CPU is a diagnostic subset, never added again. Node CPU includes
per-run timing/assertions, metrics retention and the bounded STATS receipt;
startup, warmups and bulk JSONL printing are outside the measured CPU interval. At CLK_TCK=100,
per-process CPU resolution is 50 us/run for n=200. Round trip starts when the
owner accepts a CALL batch and ends after that owner publishes its Node reply;
it includes owner/reactor handoffs, both shared-memory hops and Node policy,
but excludes guest execution before CALL and after RET.

Deadline measurements use 20 fresh generations with a 100-ms Node-set admission
deadline while Node deliberately busy-waits 200 ms. Rust's stop/reset timestamps
are compared to the actual admitted monotonic deadline, not the delayed Node
Promise settlement. The artificial Node busy-wait is excluded from tiny-run CPU.
All timed runs hold `/home/dev/bench.lock`. Nested HVF→KVM timings are indicative
only; they establish no metal latency/CPU gate.

## Ring-profile parity against libkrun

| Area | Shard status | Test / remaining gap |
|---|---|---|
| Host policy and real providers | Same canonical module; Node sole authority | SSH: real echo returns 42 instead of argument-array echo, deny code, private credential issuance/revocation; `policy-check.ts` remains green on libkrun |
| Small JSON results / undefined | Existing executor body and codec | SSH return2, concurrent results, `MicroVMExecutor` null normalization |
| Binary codec | Same `codec.mjs`; bounded small Uint8Array passes in both directions | SSH binary round trip; full large-value/wrapper corpus **not done** |
| Unicode values and source | Scalar Unicode and raw templates preserved | SSH `Grüße 😀`, `String.raw`; six pure source-adapter checks |
| Async overlap and reply demux | Independent Node providers, replies in arbitrary order | Ten reversed/delayed replies, eight concurrent generations |
| Tool errors / denials | `{code,message}` preserved, original guest name/message normalization | TOOL_ERROR, DENIED, primitive `throw null`; encoded tool reply still <=1024 bytes |
| Kernel / IPC failures | Bounded diagnostics; process exit fails the shard | Exact Rust memory/fatal/IPC error classification versus libkrun **not done**; no claim of identical MCP error codes for every hostile failure |
| Unawaited calls | Success denied; outstanding carrier calls settled before error FINISH | SSH unawaited-call assertion; a never-settling unawaited tool waits for the lease rather than libkrun's immediate cleanup — **not done** |
| Console | Ordinary lexical `console.log/warn` captured through bounded carrier records | SSH logs; large-log truncation/drop semantics, global console/print aliases, undefined/cyclic formatting parity **not done** |
| Calls / outstanding | Ring 32 **total** physical calls including logs, vs protocol 4096 total / 64 outstanding and policy 256 default | SSH 33-call rejection; **not parity** |
| Call / reply bytes | 1024 encoded bytes including transport envelopes, vs libkrun 1-MiB frames / 2-MiB inflight | SSH oversized provider reply becomes bounded LIMIT; larger replies/blobs **not done** |
| Source | <=8192 ASCII wire bytes **including** JSON escaping and trusted adapters, vs libkrun <=65536 body bytes | SSH source admission bound; full 8-KiB tenant source / large preludes **not done** |
| Live memory | glue-2m arena only; 2-MiB admission reservation, no larger automatic fallback | Existing arena suite; new IPC path memory ledger **not done**; `createContext` memory limit differs from 32-MiB libkrun RAM |
| FINISH / errors | <=16352 encoded bytes, vs 1-MiB libkrun frames | Completion envelope/identity hostile cases; large results and long escaped errors **not done** |
| Clocks | Fresh restore epoch, clock refreshed at KVM entry | Within uninterrupted CPU work clocks freeze; live clock parity **not done** |
| Timers / generated wrappers | No guest timer scheduler in this integration | setTimeout/clearTimeout and wrappers using timer races **not done** |
| `/cap` / general fd bridge | Prepared pseudo-fds only | `/cap` minimum **not done**; no kernel or fd changes in this task |
| Deadline | Absolute Node admission deadline; existing Rust leases | Blocked-Node functional check, 20-run measurement below; max admission timeout 60 s |
| Abort / early cancellation | Parked owner resets; busy CPU owner stops at its existing lease | Prompt per-slot busy-vCPU cancellation **not done**; pool.close terminates the whole shard |
| Fresh state / generations | Physical snapshot reset plus strict logical generation fence | Five distinct Math.random samples, tenant-global absence, concurrent runs, stale-generation hostile peers; existing R7 RNG certification remains separate |
| Warm reserve / readiness | Experimental selection, no certified new G1 receipt | MCP requires `warm:0`; warm parking certification **not done** |
| Confinement / supervision | Credentials excluded from IPC/env; protocol failure kills shard | Production seccomp/Landlock/cgroups, restart supervisor, watchdog/reactor stall supervision and Node-as-PID1/container support **not done** |
| Platform / native profiles | Linux arm64 JS execute only | Mac remains libkrun; MCP native worker unchanged; unified native shard IPC **not done** |

## Tests, artifacts and reproduction

`make -C arch/jitk/executor test-shard` runs the Linux test. On Mac,
`JITK_SHARD_TEST=ssh` uses the existing kvm-dev SSH backend; the same opt-in in
normal executor/top-level `make test` adds this focused suite. No Linux subtree
file or test driver was edited. With `JITK_SHARD_BENCH=1`, the same lock covers tests followed by the 200-run
benchmark and 20 expiry samples; the runner extracts `bench-final.jsonl`.
The remote runner builds Rust, performs the
locked JS install with scripts disabled and builds the addon; it requires an
already verified Node+headers and current prepared ring profile in its private
`/home/dev/r7-ipc/` root. This is **not a clean-copy install certification**.

The 119 assertions cover real providers, MCP environment selection, Unicode and
binary values, structured errors, limits, leases, clean reuse, credentials and
13 hostile shard modes: producer/consumer corruption, oversized length, reserved
bits, wrong slot/generation/kind/identity, duplicates, duplicate-key JSON,
non-ASCII JSON, premature completion and malicious stats counts. Additional
fixtures withhold READY and all TX credit: 32 completed fake runs fill the
64-record host queue; the next blocked admission returns timeout, and pool.close
kills the persistent peer without waiting on its missing reset acknowledgement.
The one-slot/four-owner benchmark also covers empty owner mailboxes without
an unsigned capacity underflow.
Eleven malformed
Node admissions/replies/cancels are rejected by the real Rust service. Ten
native checks prove fixed geometry, seals, local envelope/cursor rejection and
private copies. A 2,048-message 1-KiB echo fixture exercises wrap and pressure
beyond the 64-record capacity. Fixture processes are offline tests only.

Raw data: [executor/raw-r7-ipc/](../../executor/raw-r7-ipc/). SSH source hashes and
exact build/run command: `ssh-command.json`; complete suite: `ssh-test.log` and
`ssh-hook.log`; Rust final tests: `rust-final.log`; transport-only:
`ipc-native-check.log`; pure adapter: `source-check.log`; Linux versions/load:
`linux-environment.txt`; artifact identities: `artifacts-final.sha256`.
Mac logs: `mac-suites.log`, `mac-final-tail.log`, `mac-hyperlight.log`, plus
`mac-receipts/`. Initial Mac Hyperlight lookup needed the existing worker and
snapshot overrides; final standalone adapter test passes 13/13 with its pinned
source checkout supplied. No default kernel, READY marker or source was changed.
Default image SHA before/after remains
`75b2abe26021d9d0624b0555a64ed589d251cb7d30aa2965754974f3716d1732`.
Measured ring kernel SHA is
`9fb63e8584a10ba25d7a612cd5d2929e6ce494120b8e66d185d58a58971ff3d0`;
measured Rust host SHA is
`70c9fcb61976a1bfe6ad40b10e57d4e7d1eacb95845807bf3539da15581cab57`.
Build and prepare receipts are `kernel-build.log` and `prepare.jsonl`.
The pre-existing verified Linux Node distribution was copied from R7-bytes,
and `qjs-ring` from R7-shard, into this agent's private root; no third-party
binary was newly downloaded or executed on the Mac. npm integrity uses the
locked install in kvm-dev with scripts disabled.

Observed remote disk use before cleanup was **591.83 MiB**; final retained
runtime/source/evidence is **391.06 MiB**, below the 5-GiB allowance. Scratch
Cargo targets, caches and duplicate JS build/dependencies were removed; see
`cleanup.json`. The measured host is retained as
`/home/dev/r7-ipc/bin/real-r7-ipc` with the same SHA. Snapshot, Node, compiled
JS/addon and runtime dependencies remain for replay. Re-running the SSH test
recreates its removed Cargo build directory.

```sh
# From this worktree, Mac -> existing kvm-dev, no VM lifecycle changes:
JITK_NODE=/tmp/jitk-09/node-real JITK_SHARD_TEST=ssh JITK_SHARD_BENCH=1 \
  make -C arch/jitk/executor test-shard

# Timing on kvm-dev, after the SSH test built the same source:
cd /home/dev/r7-ipc/test-d457d3b7ac18/arch/jitk/executor
export JITK_SHARD_BINARY=/home/dev/r7-ipc/bin/real-r7-ipc
export JITK_SHARD_SNAPSHOT=/home/dev/r7-ipc/prepared
flock /home/dev/bench.lock /home/dev/r7-ipc/node/node-v24.13.0-linux-arm64/bin/node \
  build/shard-bench.js
```

Mac tests use the brief's ten-subtree `docs/delegate.py` loop under
`/usr/bin/lockf -k /tmp/sofort-bench.lock`, Node `/tmp/jitk-09/node-real`, the
existing `/tmp/jitk-01/r3/darwin/jitk-vmm`, this worktree's rebuilt identical
default image, Hyperlight worker `/tmp/jitk-09/adapter-target/release/r2-worker`,
snapshot `/tmp/jitk-09/r3-snapshot` and source `/tmp/jitk-09/hyperlight-js`.
Generated out-of-scope receipts were copied then restored; temporary dependency
links are removed before delivery. No push, cloud provisioning, VM lifecycle or
kernel changes. No edits to the integration agent's protected files.

## What is not done

The parity table is the remaining cutover list. This does not flip the Linux
default, port the policy broker, add a second authority, certify a new peak-memory
ledger, attest a compromised shard's results, or establish any metal performance
gate. Unexpected guest ring assertions can still terminate the shared shard;
Node fails its live runs closed and kills it, but does not restart it. Fresh
snapshot/cache identity and signed artifact management remain separate work.

## Findings → recommended changes

1. **Keep the default unchanged until parity and metal gates pass.** This bridge
   proves the Node policy path and bounded IPC, not the rest of gate 8.
2. **Attribute and confirm the Node CPU trigger on metal.** This run measures
   2.130 ms/run, over the 100-us OR threshold, despite only 3.634% of service CPU.
   Verify without diagnostic overhead on reference metal, then replace the sole
   authority if the rule still triggers; never add parallel Rust policy rules.
3. **Prepare codec/stubs once and widen the admitted source/value contracts.**
   Current per-run adapter injection consumes the small ring source bound and
   guest parsing CPU. Larger memory classes need explicit layout/ledger evidence.
4. **Add a per-slot cancel kick and timer/live-clock support.** These need owner
   and kernel integration; reuse fenced leases and never synthesize tool policy
   in Rust. Preserve independent watchdog enforcement when Node is blocked.
5. **Add confinement, supervision and full shared-corpus shadow comparisons.**
   Then certify warm parking and the new IPC memory overhead, and unify native
   profile admission with the integration agent's arena/native work. Reprepare
   against the merged kernel and rerun these checks before any cutover claim.
