// sofort-bench v1 contract (SPEC-V1.md §1, §3): what an adapter exports, what
// a task directory holds, and how hosted executors call tools back.
//
// Conventions for every file under bench/v1 (harness, adapters, tasks):
// - ESM TypeScript run directly by the pinned Node (`eval "$(arch/jitk/tools/
//   .work/bin/deps env)"`, then `$JITK_NODE`, Node 24) through type stripping:
//   erasable syntax only (no enums, namespaces or constructor parameter
//   properties), `import type` for types, relative imports with `.ts`.
// - Types only from this file; nothing here imports a package at run time.
//   contract-check.ts proves Executor/ResolvedProvider/ExecuteResult below are
//   @cloudflare/codemode 0.5.5's (executor/node_modules), both directions.

// ---- @cloudflare/codemode's executor contract (dist/executor-*.d.ts) ----
export interface ExecuteResult {
  result: unknown;
  error?: string;
  logs?: string[];
}
export interface ResolvedProvider {
  name: string;
  fns: Record<string, (...args: unknown[]) => Promise<unknown>>;
  prelude?: string;
}
export interface ExecuteOptions {
  connectors?: { name: string; binding: { callTool(method: string, args: unknown): Promise<unknown> } }[];
}
/** Implementations never throw: errors are returned in ExecuteResult.error. */
export interface Executor {
  execute(
    code: string,
    providersOrFns: ResolvedProvider[] | Record<string, (...args: unknown[]) => Promise<unknown>>,
    options?: ExecuteOptions,
  ): Promise<ExecuteResult>;
}

// ---- Adapters (bench/v1/adapters/<name>.ts, default export) ----
export type Isolation = 'microvm' | 'v8-isolate' | 'wasm' | 'process' | 'none' | 'hosted-microvm';
export type Where = 'local' | 'hosted';

/** Why an attempt failed. Adapters may set BenchResult.errorClass; otherwise
 *  the harness classifies ExecuteResult.error text (run.ts classify()). */
export type ErrorClass =
  | 'timeout'     // the run's deadline passed (infinite loop, slow guest)
  | 'oom'         // guest heap/memory limit
  | 'limit'       // another engine limit: code size, call budget, output size
  | 'unsupported' // the engine lacks a JS feature the program uses
  | 'guest'       // the program threw
  | 'tool'        // a (replayed) tool returned an error to the program
  | 'unmatched'   // a tool call had no recorded response (replay.ts)
  | 'overloaded'  // the adapter refused admission (queue full)
  | 'sandbox'     // the executor itself failed (engine crash, protocol)
  | 'oracle'      // ran to completion, answer wrong
  | 'harness';    // the harness failed (adapter threw from execute, etc.)

export interface BenchResult extends ExecuteResult {
  errorClass?: ErrorClass;
}

/** A replay endpoint for executors that cannot call `fns` in-process
 *  (hosted, or a separate runtime without its own callback server).
 *  Adapters that run their own callback server should call the passed fns
 *  directly instead: all accounting (latency, bytes, matching) lives inside
 *  the fns, so either path measures the same thing.
 *
 *  Wire shape (replay.ts serves it; an adapter's own server should use it too):
 *    POST {url}/call
 *    authorization: Bearer {token}
 *    content-type: application/json
 *    {"executionId": string, "namespace": string, "tool": string, "args": unknown[]}
 *  → 200 {"result": unknown}     the fn resolved (undefined → null)
 *  → 200 {"error": string}       the fn rejected (the guest's call should throw this message)
 *  → 4xx {"error": string}       bad token, unknown executionId/namespace/tool, bad body
 *  Plain JSON both ways; recorded tool data is JSON, so no binary codec.
 *  `args` is the positional array the guest passed (codemode tools take one
 *  object: `[{...}]`). */
export interface ToolEndpoint {
  url: string;   // e.g. http://127.0.0.1:PORT (no trailing slash)
  token: string;
  /** Register one execute()'s providers; the id goes to the guest/remote side.
   *  release() after the execute settles (later calls get 4xx). */
  register(providers: ResolvedProvider[]): { executionId: string; release(): void };
}

export interface OpenOptions {
  /** Sizing hint: the harness's intended in-flight executes (pool size).
   *  S2/S5 may issue more; the adapter queues FIFO or returns errorClass
   *  'overloaded'. Never blocks open() on traffic. */
  concurrency: number;
  /** Adapter-specific memory class, e.g. 'glue-2m' / 'glue-4m'. */
  memoryClass?: string;
  /** Per-execute deadline. The adapter must return (error, errorClass
   *  'timeout') by about this time, and keep serving later executes. */
  timeoutMs: number;
  /** Present when the harness started the replay HTTP server. */
  toolEndpoint?: ToolEndpoint;
}

export interface BenchExecutor extends Executor {
  execute(
    code: string,
    providersOrFns: ResolvedProvider[] | Record<string, (...args: unknown[]) => Promise<unknown>>,
    options?: ExecuteOptions,
  ): Promise<BenchResult>;
  /** Stop every process/VM/isolate the adapter started. */
  close(): Promise<void>;
  /** Optional: child process ids whose CPU the harness should count (S1/S5
   *  CPU per task). The harness also counts its own process. */
  pids?(): number[];
}

export interface Adapter {
  name: string;
  isolation: Isolation;
  where: Where;
  /** Optional: undefined when runnable on this host, else why not (missing
   *  credentials, wrong OS). The driver records a 'skipped' row instead. */
  available?(): Promise<string | undefined> | string | undefined;
  open(opts: OpenOptions): Promise<BenchExecutor>;
  /** Versions and hashes of everything it ran (package versions, binary
   *  sha256s, snapshot ids). Called after open(). */
  provenance(): Record<string, string>;
}

// ---- Tasks (bench/v1/tasks/<id>/) ----
/** task.json. Paths are relative to the task directory. */
export interface TaskSpec {
  id: string;            // directory name, e.g. 't1-issue-triage'
  name: string;
  description: string;
  /** 'js' (default): codemode programs. 'sql': native-profile task (programs
   *  are .sql, `database` names the fixture); JS adapters skip it. */
  kind?: 'js' | 'sql';
  database?: string;
  /** One entry per namespace the programs call (`codemode.x(...)`, `github.x(...)`). */
  providers?: {
    name: string;        // namespace, e.g. 'codemode'
    /** JSON Schema per tool, as codemode's generateTypesFromJsonSchema takes them. */
    tools: Record<string, { description?: string; inputSchema: unknown; outputSchema?: unknown }>;
  }[];
  responses: string;     // 'responses.jsonl' (may be generated: tasks/materialize.ts)
  oracle: string;        // 'oracle.ts'
  programs: string[];    // ['programs/claude-1.js', ...]
  /** Replay matching fallback (replay.ts): 'strict' (default) or 'nearest'. */
  match?: 'strict' | 'nearest';
  /** Optional free-form provenance: where data came from, which model wrote which program. */
  source?: Record<string, string>;
}

/** One line of responses.jsonl: one recorded tool call. */
export interface RecordedCall {
  namespace: string;     // provider name
  tool: string;
  args: unknown[];       // positional, as the guest passed them (usually [{...}])
  response?: unknown;    // the value the tool resolved with (absent when error is set)
  error?: string;        // the tool rejected with this message
  latencyMs: number;     // recorded wall time of the real call
  bytes: number;         // UTF-8 length of JSON.stringify(response) (recorded size)
}

/** programs/*.js: one codemode program, an async arrow function expression
 *  exactly as a model writes it for codemode, e.g.
 *    async () => { const r = await codemode.listIssues({repo: 'x/y'}); return r.length; }
 *  It calls tools as `<namespace>.<tool>(arg)` and returns a JSON value. */

/** oracle.ts default export (or named `check`): checks the program's
 *  returned value independently of how it was computed. */
export interface OracleVerdict { ok: boolean; reason: string }
export type Oracle = (result: unknown) => OracleVerdict;

// ---- Per-attempt raw row (results JSONL, one line per attempt) ----
export type Scenario = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
export interface AttemptRow {
  kind: 'attempt';
  run: string;            // run id
  rep: number;            // repetition index
  adapter: string;
  task: string;
  program: string;        // program file, or 'hostile/<name>'
  scenario: Scenario;
  cell: string;           // scenario-specific cell: 'seq', 'rate=20', 'conc=8', 'cold'
  warmup: boolean;        // excluded from tables, kept in raw
  hostile: boolean;
  seq: number;            // attempt index within the cell
  intendedStartMs: number;  // scheduled start (epoch ms; open loop: from the schedule)
  actualStartMs: number;    // when execute() was called
  endMs: number;
  e2eMs: number;          // end - intended start (includes harness queueing in S2)
  serviceMs: number;      // end - actual start
  toolMs: number;         // replayed tool time: union of in-flight call intervals
  toolSumMs: number;      // plain sum of call durations (> toolMs when calls overlap)
  overheadMs: number;     // serviceMs - toolMs, clamped at 0 only in tables
  toolCalls: number;
  toolBytes: number;      // response bytes returned to the guest
  unmatched: number;      // tool calls without a recorded response
  fallbacks: number;      // calls answered by the 'nearest' policy
  forbidden: number;      // undeclared-tool calls that reached the HTTP tool server (must be 0)
  ok: boolean;
  reason: string;         // oracle reason or error text (truncated)
  errorClass?: ErrorClass;
  cpu?: { harnessUs: number; childrenUs?: number }; // process CPU deltas over the attempt
  load1: number;
  /** S4: child-process phases (ms from child start): import, open, first result. */
  phases?: Record<string, number>;
}
