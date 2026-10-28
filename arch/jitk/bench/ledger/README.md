# Offline current-build ledger

`../build/ledger` collects process + host memory, validates READY / one_tool / done,
keeps every process counter and every diagnostic output, and computes count slopes.
On macOS it reads libproc and read-only `ledger(2)` entries; on Linux/Asahi it
reads `/proc` (PSS/private dirty/swap, with no macOS footprint equivalence implied).
No collector is installed into the shipping runtime.

`ledger.mjs` imports the frozen executor and instruments CPU using `ledger_native.c`,
a tiny Node-API measurement addon. The VMM code is unchanged. It uses getrusage
for Node and reaped-child totals and libproc for live macOS phase boundaries.
Linux uses proc stat for live phase CPU (limited by CLK_TCK), and getrusage for
lifecycle totals. Rebuild the addon for the target machine.

Build the measurement addon on macOS:

```sh
clang -O2 -shared -undefined dynamic_lookup -I/opt/homebrew/include/node ledger_native.c -o ledger_native.node
```

On Linux/Asahi, use `cc -O2 -shared -fPIC -I/usr/include/node ledger_native.c -o ledger_native.node`.
Select local Node headers matching an installed Node-API runtime.

Frozen production inputs are in `artifacts/`; `selection.json` records sources,
hashes, and the pre-change executor build. The measured VMM has the RAW direct
load patch and native watchdog. A Seatbelt profile contains an absolute directory;
regenerate it if moving these inputs:

```sh
artifacts/jitk-vmm --compile-profile "$PWD/artifacts/jitk.sbbin" --images "$PWD/artifacts"
```

First run `make -C .. build`. Run from this directory, with Node `/tmp/jitk-09/node-real` on this host:

```sh
/usr/bin/lockf -k /tmp/sofort-bench.lock ../build/ledger memory --counts 0,1,16,64,256 --repeats 3
/usr/bin/lockf -k /tmp/sofort-bench.lock /tmp/jitk-09/node-real ledger.mjs "$PWD/artifacts" "$PWD/cpu-raw.json" 30
/usr/bin/lockf -k /tmp/sofort-bench.lock ../build/ledger controls
/usr/bin/lockf -k /tmp/sofort-bench.lock ../build/ledger memory --variants current --counts 1,16 --repeats 3 --inline-sandbox --output inline-raw.json
../build/ledger analyze memory-raw.json
../build/ledger analyze-cpu cpu-raw.json
../build/ledger-waves # supplemental N=60 cells, releasing the lock after each cell
clang -O2 -framework Hypervisor hvf_control.c -o artifacts/hvf-control
codesign --force --sign - --entitlements ../../shard/hypervisor.entitlements artifacts/hvf-control
/usr/bin/lockf -k /tmp/sofort-bench.lock ../build/hvf-control
../build/ledger-report
../build/ledger-verify
```

The memory experiment freezes all N VMs after READY, then all N after emitting
the single tool call. The host holds the reply during collection, then sends
`ret(2)` and validates `done(2)` for every VM. This measures a reproducible
in-flight tool-wait state; it does not claim an instantaneous execution peak.
Memory phases have immediate all-PID counters before slow diagnostics and again
afterwards. Compression can change residency while the diagnostics run.

The first repeat uses footprint JSON for **every PID**. vmmap summaries, full
maps, malloc zones and VM-object-dirty diagnostics sample first/middle/last PIDs
in every count/repeat (use `--details all` for every vmmap). `raw/` keeps the
actual diagnostics rather than only parsed rounded numbers. `snapshot PID...`
can independently collect memory on an already-running Linux or macOS service.

The CPU experiment runs 30 complete rotating blocks of cold/parked ×
return2/one_tool × raw/executor. Boot is charged even for a parked single-use
VM. Automatic pool refill is disabled after preparation so every child total
belongs to exactly one sample; explicitly add boot cost to execution when
estimating sustained service CPU. Native watchdog startup/exit is shared and
reported separately. Node import/startup is outside per-run CPU, as in the
canonical benchmark. Each run records the host load; no latency filtering is
performed. The CPU adapter is instrumented, so consult RESULTS.md for observer
cost and any missing phase boundaries.

`tkm_private` is an overlapping kernel accounting view: XNU credits some page
table pages to both this ledger and footprint/page_table. Do not add it to the
process footprint. `RESULTS.md` includes the source check and the unclosed
system/HVF attribution gaps.

The macOS allocation control additionally executes a six-instruction guest that
zeros exactly 3 MiB, validates the end register, and measures its footprint
effect. It is independent experimental evidence, not a replacement for the
production VMM or a production runtime helper. Its first six allocation stages
are retained separately in `hvf-control-initial.json`; final seven-stage results
are in `hvf-control-raw.json`.
