# sofort-bench v1: specification

Status: specification (2026-10-30). Plan and quotable numbers:
[PLAN-MAC-V1.md](PLAN-MAC-V1.md).

Goal: measure what a team running agent-written code would actually see when
choosing an executor. The model writes a program against typed tools, the
executor runs it, and the tools return real-sized data with real latencies.
Every competitor runs **the same recorded programs against the same recorded
tools**, so differences come from the executor alone.

## 1. Contract: every executor is a codemode `Executor`

```ts
// @cloudflare/codemode: the interface Cloudflare, TanStack (via IsolateDriver)
// and Sofort (MicroVMExecutor) already implement.
interface Executor {
  execute(code: string, providers: ResolvedProvider[]): Promise<{result: unknown; logs: string[]; error?: string}>;
}
```

An adapter (`bench/v1/adapters/<name>.ts`) exports:

```ts
export default {
  name: 'sofort-hvf',
  isolation: 'microvm' | 'v8-isolate' | 'wasm' | 'process' | 'none' | 'hosted-microvm',
  where: 'local' | 'hosted',
  async open(opts: {concurrency: number; memoryClass?: string}): Promise<Executor & {close(): Promise<void>}>,
  provenance(): Record<string, string>, // versions and hashes of everything it ran
};
```

Tools always run in the harness process (the agent host), as they do in real
deployments; the executor calls back into them through its own mechanism.
Hosted executors call back over HTTPS to a harness endpoint, and that round trip
is part of their measured cost.

## 2. Competitors

| Adapter | What it is | Where |
| --- | --- | --- |
| `sofort-hvf` / `sofort-kvm` | Sofort `MicroVMExecutor`, glue-2m and glue-4m | Mac / Linux |
| `hyperlight-js` | QuickJS in a Hyperlight micro-VM (existing executor backend) | Mac / Linux |
| `cf-dynamic-worker` | Cloudflare's `DynamicWorkerExecutor` on local workerd (Worker Loader) | Mac / Linux |
| `ai-sdk-code-mode` | Vercel AI SDK `@ai-sdk/code-mode` (QuickJS in-process) | Mac / Linux |
| `tanstack-isolated-vm`, `tanstack-quickjs` | TanStack AI's isolate drivers | Mac / Linux |
| `node-vm` | `node:vm` context: no isolation, the floor | Mac / Linux |
| `vercel-sandbox`, `e2b`, `cf-dynamic-worker-hosted` | Hosted (needs accounts; optional) | hosted |
| `firecracker`, `gvisor` | Linux-only full-Linux baselines | Linux metal |

## 3. Tasks: recorded from real use

Each task has: typed tool schemas (TypeScript API generated the way codemode
generates it), recorded tool responses with their **real sizes and recorded
latencies**, 5 model-written programs (from at least two models, recorded once),
and an oracle that checks the answer independently.

| Id | Task | Tools and data | What it stresses |
| --- | --- | --- | --- |
| T1 | **Issue triage**: open issues older than 30 days with label X, with comment counts and last activity, for the top 20 | GitHub REST shapes (issues, comments, paginated), captured from public repos; 100–400 KB per run | pagination, fan-out, large replies reduced to small answers |
| T2 | **CI failure triage** across 24 repos: which started failing after a runner rollout, shared cause, evidence ids | Actions runs, jobs, log tails captured from public repos plus one seeded regression; ~1 MB per run | many parallel calls, log scanning, correctness |
| T3 | **Cross-tool join** (Anthropic's code-execution example): fetch a meeting transcript, extract action items, attach them to CRM records | doc store + CRM; transcript 50–200 KB never returned to the model | the canonical code-mode claim: big intermediates stay in the executor |
| T4 | **Observability rollup**: p95 latency and error rate per service over 1 h from paginated metrics | 1–4 MB of metric points | heap capacity, CPU on data, payload codec |
| T5 | **API search + execute** (Cloudflare's code-mode MCP pattern): find the right endpoint in a large OpenAPI spec, then call it | a public OpenAPI spec (several MB) behind `search`/`execute` tools | large spec handling, two-step programs |
| T6 | **Read-only SQL incident query** (native profile where supported) | SQLite fixture | native execution; immutable input |

Programs and responses are frozen, so runs are deterministic; a live mode
re-records programs with a current model for task-success measurement (§6).

## 4. Serving scenarios: how an agent platform loads an executor

| Id | Scenario | Measures |
| --- | --- | --- |
| S1 | One agent, tasks back to back | per-task latency, executor overhead (end to end minus tool time) |
| S2 | Open-loop Poisson arrivals of mixed T1–T5 at increasing rates | highest rate with p99 under SLO and no failures (goodput), queueing |
| S3 | S2 with 1% hostile runs (infinite loop, memory bomb, exfiltration attempt, giant output) | victim p99, failures caused to others, recovery time |
| S4 | Cold service: process start to first correct task | startup cost, first-use cost |
| S5 | Concurrency to the limit: how many tasks run at once in 1 GiB / per CPU | density with real working sets, not empty runs |

## 5. Metrics (every task × scenario × adapter)

- **Correct**: oracle pass rate; failures (out of memory, unsupported JS,
  timeouts) stay in the denominator.
- **Latency**: end to end p50/p95/p99, executor overhead (end to end minus
  replayed tool time), "capacity reusable" time.
- **Resources**: CPU per task (all processes), memory fixed + per concurrent task
  at the real working set.
- **Goodput** at a stated p99 SLO; **cost per 1,000 tasks** (local: CPU-seconds and
  memory at a stated host price; hosted: billed units).
- **Isolation evidence**: canary checks after hostile runs, forbidden host
  invocations (must be 0).

## 6. Agent-level benchmark (live model)

MCPMark Verified's filesystem and PostgreSQL tasks run locally. Three arms with
the same pinned model: direct tool calls, code mode on `cf-dynamic-worker`, code
mode on Sofort. Measures task success, tokens, model turns and wall time; the
executor swap should leave success and tokens unchanged.

## 7. Method

- Same host for every local adapter; labels `hvf`, `kvm-metal`, `kvm-nested`
  (nested: counts and memory only).
- Warm, cold-slot and cold-service cells separate; warmups excluded; randomized
  interleaved order; ≥ 1,000 samples per cell for p99; 3 repetitions.
- Load gate recorded per sample (the Mac is shared).
- Bundle: raw JSONL per attempt, environment and artifact hashes, a reducer that
  regenerates the tables, and every losing row kept.

## 8. Layout

```
bench/v1/harness/   driver, tool replay server, oracles runner, reducer, env capture
bench/v1/adapters/  one file per competitor (§2)
bench/v1/tasks/     T1–T6: schemas, recorded responses + latencies, programs, oracles
bench/v1/results/   generated tables (raw data in the evidence store)
```
