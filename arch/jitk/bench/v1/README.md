# sofort-bench v1

Same recorded programs, same recorded tools, every executor. The
specification is [../SPEC-V1.md](../SPEC-V1.md), and the Mac plan is
[../PLAN-MAC-V1.md](../PLAN-MAC-V1.md).

```
harness/    driver (run.ts), tool replay (replay.ts), env capture (env.ts),
            reducer (reduce.ts), the contract (contract.ts), hostile programs,
            fixtures (example task, node-vm-fixture floor)
adapters/   one file per competitor; sofort.ts = sofort-{hvf,kvm}-{2m,4m}
tasks/      T1–T6 (tasks/README.md); responses.jsonl are generated
specs/      run specs (smoke-mac.json, full-mac.json)
.work/runs/ raw.jsonl + summary.{json,md} per run (not in git)
```

## Running

```sh
make -C arch/jitk deps                       # pinned Node, HVF engine, snapshots
make -C arch/jitk/executor build             # executor/build (sofort adapter)
$JITK_NODE arch/jitk/bench/v1/tasks/materialize.ts   # task responses (once)

make -C arch/jitk/bench v1-check             # typecheck bench/v1
make -C arch/jitk/bench v1 ARGS='--spec v1/specs/smoke-mac.json'
make -C arch/jitk/bench v1 ARGS='--adapters sofort-hvf-2m,node-vm-fixture --scenarios S1 --samples 200'
make -C arch/jitk/bench v1-verify RUN=v1/.work/runs/<id>
```

`make v1` runs `harness/run.ts` with the pinned Node under the bench lock
(`/tmp/sofort-bench.lock`, as `make bench` does). In a worktree without
built tools, pass `JITK_DEPS=/path/to/tools/.work/bin/deps`. Paths in specs
and in `--out` are relative to `bench/v1` (specs) or the current directory
(`--out`). `run.ts --help` lists the overrides. Each one replaces its spec field:

- `--adapters`, `--tasks`, `--scenarios`, `--reps`, `--seed`;
- `--samples`, `--warmups` (S1);
- `--rates`, `--duration` (S2/S3);
- `--hostile-fraction` (S3);
- `--cold` (S4);
- `--levels`, `--per-level` (S5);
- `--timeout-ms`, `--slo-ms`, `--latency-scale`, `--tool-server`, `--out`.

The Mac is shared. Every attempt records load1, and the tables count
samples with load1 ≥ 6 as *contended*. Don't quote contended cells as headline numbers.

## Contract (harness/contract.ts)

**Adapter** (`adapters/<name>.ts` default export: one `Adapter` or an array):

```ts
{ name, isolation: 'microvm'|'v8-isolate'|'wasm'|'process'|'none'|'hosted-microvm',
  where: 'local'|'hosted',
  available?(): string|undefined,              // why not runnable here (→ skipped row)
  open({concurrency, memoryClass?, timeoutMs, toolEndpoint?}): Promise<BenchExecutor>,
  provenance(): Record<string,string> }        // after open()
BenchExecutor = codemode Executor & { close(); pids?(): number[] }
execute(code, providers) → {result, error?, logs?, errorClass?}   // never throws
```

`contract.ts` declares the `@cloudflare/codemode` 0.5.5 executor types
structurally, and `contract-check.ts` proves at typecheck time that they are the package's own.

- **Name resolution.** `run.ts` resolves a name `a-b-c` from `adapters/a-b-c.ts`, then
  `adapters/a-b.ts`, then `adapters/a.ts` (then `harness/fixtures/`). It takes
  the first module that exports an adapter of that name. `file.ts#name` also works.
- **Queueing.** `concurrency` is a sizing hint. S2 and S3 issue arrivals regardless, so an
  adapter queues them FIFO or returns `errorClass: 'overloaded'`.
- **Error classes.** `timeout`, `oom`, `limit`, `unsupported`, `guest`, `tool`, `unmatched`,
  `overloaded`, `sandbox`, `oracle` and `harness`. An adapter may set the class itself;
  otherwise `run.ts classifyError()` derives it from the error text.

**Tools stay in the harness process.** The harness passes `ResolvedProvider[]`
whose fns are the replay (per attempt). Adapters that need a callback route it to those
fns, either with their own listener or with `toolEndpoint`, which `--tool-server` starts.

The `toolEndpoint` wire format:

```
POST {url}/call   authorization: Bearer {token}   content-type: application/json
{"executionId": string, "namespace": string, "tool": string, "args": unknown[]}
→ 200 {"result": …} | 200 {"error": "message"} | 4xx {"error": …}
```

`toolEndpoint.register(providers)` returns `{executionId, release()}`. A call to
an undeclared tool gets a 404 and counts as `forbidden`, which must be 0.

**Task** (`tasks/<id>/`):

- `task.json` holds `id`, `name`, `description`, `kind?` (`'js'` default, or `'sql'`, which JS
  runs skip), `providers[{name, tools{tool: {description, inputSchema, outputSchema?}}}]`,
  `responses`, `oracle`, `programs[]`, `match?` and `source?`.
- `responses.jsonl` has one recorded call per line:
  `{namespace, tool, args: [...], response | error, latencyMs, bytes}`.
- `programs/*.js` are codemode programs, `async () => { … }`, that call `<namespace>.<tool>(arg)`.
- `oracle.ts` exports `check(result) → {ok, reason}` (or a default). It gets the
  program's value after a JSON round trip.

`harness/fixtures/example/` is a complete small task.

## Tool replay (harness/replay.ts)

- **Match.** A call matches by `namespace.tool` plus canonical args: JSON with keys sorted
  recursively and undefined members dropped.
- **Repeated keys.** When a key has several recordings, the k-th identical call in one
  attempt gets recording `k mod n`.
- **Unmatched.** With no recording, the default `strict` policy makes the call reject. It is
  counted as unmatched, and the attempt fails as `unmatched` whatever the oracle says.
- **`nearest`.** This per-task policy answers with the tool's recording that shares the
  most top-level argument values, with ties going to the earliest recorded. It counts as `fallbacks`.
- **Latency.** The replay waits the recorded `latencyMs × --latency-scale`; scale 0 means no timer.
- **Tool time.** `toolMs` is the union of in-flight call intervals, so parallel calls are not
  double-counted. `overheadMs = serviceMs − toolMs`.

## Scenarios

| | What runs | Cells |
|---|---|---|
| S1 | Sequential. All adapters open, interleaved per sample in a seeded order, (task, program) round-robin over a seeded shuffle. Warmups are excluded. | `seq` |
| S2 | Open-loop Poisson arrivals per rate. Each attempt is timed from its scheduled start (no coordinated omission). A rate passes with p99 ≤ SLO and 0 failures; the ramp stops at the first failing rate. Goodput is the highest passing rate. | `rate=N` |
| S3 | S2 at one rate with `harness/hostile/*.js` at a fraction, then each hostile program back to back, each followed by canaries: the leak canary plus every task program. Adapters with isolation `none` are skipped. | `rate=…,hostile=…`, `hostile`, `canary after …` |
| S4 | A fresh Node process imports the adapter, opens it and runs one program. Measured from spawn to the first result line, with child phases. | `cold` |
| S5 | Per level: a fresh open with that concurrency, then closed-loop workers on the real tasks. Peak RSS of the harness process tree is sampled every 250 ms. MiB per task comes from the slope over correct levels. | `conc=N` |

The hostile programs are:

- `spin`, an infinite loop;
- `spin-after-await`, the same after a microtask;
- `memory-bomb`;
- `giant-output`, a 64 MiB string;
- `undeclared-tool`;
- `pollute`, which writes to globals and prototypes and replaces `JSON.stringify`.

## Raw rows and the reducer

`raw.jsonl` starts with an `env` row:

- host, OS, CPU and load;
- the Node version;
- the git SHA and dirty flag;
- `virt` (`hvf`, `kvm-metal` or `kvm-nested`; override with `SOFORT_BENCH_VIRT`);
- the full spec.

After that come these rows:

- `open`: open time and adapter provenance.
- `attempt`: one per attempt (`AttemptRow` in contract.ts):
  - intended and actual start, e2e, service, tool and overhead ms;
  - calls, bytes, unmatched and forbidden counts;
  - ok/reason and errorClass;
  - harness CPU µs (sequential cells only);
  - load1.
- `cell`: wall time and CPU for the harness and the adapter's process tree (`pids()`, else the
  harness's children when only one adapter is open). RSS; S2 pass/fail; S5 peak RSS.
- `skipped`, `open-failed` and `end`.

`reduce.ts` writes `summary.json` and `summary.md`:

- p50/p95/p99 with n (p50/p99 bootstrap CIs from `bench/lib.ts`);
- correctness;
- overhead;
- goodput;
- CPU per task;
- S3 containment and canaries;
- S4 phases;
- S5 density.

Failed attempts stay in every denominator, and latency percentiles include them.
`--verify` re-derives both files from `raw.jsonl` and diffs them.

## Known gaps

- **CPU.** Per-attempt CPU covers the harness process only, and only in sequential cells.
  Child CPU is per cell, from `ps`: 10 ms resolution, and processes that exit during a cell
  are not seen. In-process adapters' work shows up as harness CPU, which also includes the
  tool replay every adapter shares.
- **RSS.** RSS is `ps` RSS of the harness process tree. On macOS, HVF guest memory may be
  under-counted there, so use phys_footprint later for memory claims.
- **S2 lateness.** The S2 scheduler uses timers. Its lateness counts as latency, which is
  the point of open-loop timing, but on a loaded host it inflates every adapter's
  p99 alike.
- **S3 metrics.** Recovery time after a hostile run is not yet a metric. The victim p99 is
  shown next to the S2 p99 at the same rate when both ran.
- **T6.** SQL needs a native-profile adapter. JS runs skip it.
