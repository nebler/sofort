# Executor round 2

Use an absolute signed Node executable. The supplied default is Node 24.22.1;
`node` on PATH can be a Vite+ shim. From this directory:

```sh
# Parent node_modules already contains the pinned dependencies. Alternatively
# install this directory's package-lock.json with npm ci --legacy-peer-deps.
JITK_NODE=/tmp/jitk-09/node-real JITK_BACKEND=jitk ./run.sh check
JITK_NODE=/tmp/jitk-09/node-real JITK_BACKEND=jitk ./run.sh idle
JITK_NODE=/tmp/jitk-09/node-real JITK_BACKEND=jitk BENCH_N=50 ./run.sh bench
```

`JITK_BACKEND=local-qjs` is an explicitly **unsafe** development fallback. Measure
its idle gate with `./run.sh idle` before any nonzero warm pool. It exposes std/os
and the host filesystem. `best` chooses the ready kernel, otherwise the fallback;
`jitk` fails explicitly if 02's READY marker is missing. Integration probes also
cover 01's documented `--image ... --mem-mib ...` launcher. The old R1 kernel is
only used by `./run.sh plumbing` to prove strict failure and process reap.

`select-backend.ts` reads 02's READY/README and G1 results. It copies the signed
Rust host and RAW image into content-addressed paths under `/tmp/jitk-04/r2/`.
The source hashes, READY text and parking choice are in
`integration-selection.json`. Default selection is native IRQ-only WFI (tick=0),
32 MiB guest RAM, 16 MiB guest QuickJS heap, stock source bootstrap. Both hosts
are statically linked to 01's panic=abort libkrun and use exactly one inout port.
02's selected integration host awaits production containment; 01's alternative
already applies the R1 compatibility Seatbelt profile before build. Security
owner supplies the final production profile; these are not new isolation claims.

The tiny backend interface stays `park/read/send/kill`, plus reap and metadata.
`MicroVMExecutor` implements the actual Cloudflare Executor and TanStack driver
contracts. Tool schemas are validated by `prepareProviders`; credentials remain
in host tool closures. Every admitted call uses copied/frozen host-owned policy
context. Unknown capabilities never reach host function lookup through prototypes.
Per-tool SDK allocation limits, cooperative network abort and side-effect
idempotency remain adapter responsibilities.

`dispatcher.ts`, `bootstrap.js`, `vectors.json`, and `protocol-test.mjs` are copied
from 03/R2. The dispatcher adds one integration correction: reject raw DEL
(0x7F), matching normative printable ASCII 0x20..0x7E; the copied implementation
used >127 instead of >126. A real transport fixture checks this rejection. `PROTOCOL-v1.adopted.md` records the adopted normative text. The stock
bootstrap needs no codemode runtime dependency. Optional binary values are encoded
as ordinary JSON base64 objects by a per-run application adapter; prelude and
TanStack binding aliases are compiled into `run.code`. The only wire fields are
protocol v1. Type generation/normalization is vendored with MIT attribution.

Transport has one writer, at most one encoded frame awaiting write completion,
up to 64 bounded response producers, and continuous input draining. Call credit
is released only on writer commit. The host suppresses late replies after done.
Same-chunk trailing invalid frames poison a result before exposing it to callers.

Every process launch has a separate Python watchdog (`/usr/bin/python3`), default
60-second maximum lifetime including parking, plus a 5-second startup watchdog.
The Executor's deadline includes acquisition and aborts/kills the VMM immediately;
its default execution timeout is 30 seconds. The independent lifetime watchdog
still works when a host tool blocks Node's event loop. `kill` targets the VMM
process group; `exited` waits for both VMM and watchdog close. Capacity is held
until that promise resolves. Pool close aborts pending starts and reaps all owned
processes. Watchdog lifecycle, Linux parent-death/cgroup ownership and final
containment should be integrated with the production supervisor in round 3.

Pool launch/refill concurrency defaults to 2; total live+starting+reaping cannot
exceed maxLive. There is no unbounded admission queue. Nonzero warmCount requires
an explicit measured G1 witness strictly below 2% core. Used VMs are killed,
never reused. `recommendedWarmCount` is `min(cap, ceil(lambda*refill_p99)+burst)`.
Callers must also budget executing/reaping VM slots and RAM in maxLive; the helper
is a ready-reserve formula, not a throughput or fleet-capacity promise.

Benchmarks use 5 excluded warmups then n=50 per program/pool, nearest-rank
p50/p90/p99 (n=50 p99 is the maximum). "Cold" means a newly spawned VMM per execute,
with normal OS file caches. Time includes policy, code preparation, acquisition,
execution, SIGKILL/reap of VM+watchdog and initiation of refill. Warm=4 is restored
before each timed call; refill wait is separately recorded and excluded from the
execute interval. Host stubs have no network delay. Every batch records uptime
before/after. These are shared-host macOS measurements, not sustained capacity,
Linux/KVM numbers, a quiet-machine baseline or a head-to-head Hyperlight result.

`jitk-bench-results.json` is the final VM API benchmark after the DEL correction;
`jitk-bench-pre-del-results.json` retains the earlier valid-ASCII run at lower
host load. Do not attribute that timing difference to the one-byte check. `local-bench-results.json`
is an earlier development baseline collected under much heavier host load. Do
not subtract/compare them as a backend A/B experiment. Raw samples and command
logs are retained. All check scripts close their pools in finally blocks.
