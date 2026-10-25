# 04 — TypeScript executor / SDK

## 1. Concrete design

**Decision:** one `MicroVMExecutor` implements Cloudflare `Executor` and TanStack
`IsolateDriver`; both use one bounded, host-owned dispatcher and single-use pool.
The local native QuickJS implementation works. `jitk` and Hyperlight process
adapters typecheck; their actual VM execution remains **UNVERIFIED**.
Security boundary: the production microVM + sandboxed VMM, never the local backend.

### Versions and primary sources

Registry checked 2026-10-24; exact direct dependencies in `package.json` and
`package-lock.json`. Runtime measured with Node **24.22.1**, Darwin arm64.

| Package / engine | Exact version | Source inspected |
|---|---|---|
| `@cloudflare/codemode` | **0.5.5** (npm latest) | `node_modules/@cloudflare/codemode/dist/executor-xSJFaECq.d.ts`, `dist/index.js:273–432` |
| `@tanstack/ai-code-mode` | **1.0.0** (npm latest) | `node_modules/@tanstack/ai-code-mode/dist/esm/types.d.ts`, `create-code-mode-tool.js`, `code-wrapper.js` |
| `@tanstack/ai` | **1.0.0** | installed package; actual tool integration in `verify.ts` |
| `zod` | **4.6.7** | installed package; input/output validation in `providers.ts` |
| `ai` | **7.0.152** | installed for Cloudflare's optional AI SDK types; not used by dispatcher |
| `@hyperlight-dev/js-host-api` | **0.4.0** | installed `package.json`, `index.d.ts`, `README.md` |
| native / static musl QuickJS | **2026-06-04** | `qjs --help`; native built from Bellard source in `/tmp/jitk-04` |
| TypeScript / Node types / tsx | **7.0.2 / 26.6.5 / 4.23.15** | pinned dev dependencies; final checks compile then run plain Node |

[TanStack's official driver documentation](https://tanstack.com/ai/latest/docs/code-mode/code-mode-isolates)
corroborates the package contract; installed package source governs this proposal.
Native QuickJS source: https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz
SHA256 `b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a`.
Copied static guest SHA256
`d87997d1e249c8dd15e6b7a2f9a8c4932612a023a17b8b2d21e8359739a580e9`.

### Exact upstream contracts

Cloudflare's actual executor accepts **three** arguments and two provider forms:

```ts
interface Executor {
  execute(code: string,
    providersOrFns: ResolvedProvider[] |
      Record<string, (...args: unknown[]) => Promise<unknown>>,
    options?: ExecuteOptions): Promise<ExecuteResult>;
}
interface ResolvedProvider {
  name: string;
  fns: Record<string, (...args: unknown[]) => Promise<unknown>>;
  prelude?: string;
}
// ExecuteResult = { result: unknown; error?: string; logs?: string[] }
// ExecuteOptions = { connectors?: ConnectorBinding[] }
```

Its documentation says executors should never throw: execution, policy, launch,
protocol and timeout failures become `error`. Raw maps use `codemode.*`.
The sketch returns an explicit error for connector RPC options; adapt a connector
to ordinary `ResolvedProvider.fns` so every call traverses policy.

TanStack's interface exists, exported by **`@tanstack/ai-code-mode`**, not core AI:

```ts
interface IsolateDriver {
  createContext(config: {
    bindings: Record<string, ToolBinding>;
    timeout?: number; memoryLimit?: number; // ms; MB
  }): Promise<IsolateContext>;
}
interface IsolateContext {
  execute<T = unknown>(code: string): Promise<{
    success: boolean; value?: T; logs?: string[];
    error?: {name: string; message: string; stack?: string; code?: string};
  }>;
  dispose(): Promise<void>;
}
// ToolBinding: name, description, inputSchema, outputSchema?,
// execute(args: unknown, context?: ToolExecutionContext): Promise<unknown>
```

Binding **record keys** are injected unchanged, usually `external_listIssues`.
`createCodeModeTool` strips TS then passes a function **body** to the driver.
The stock QuickJS driver's `execute` applies `wrapCode` itself and parses its
JSON-string result. Our adapter directly wraps the body and returns the decoded
value. Each invocation gets a fresh sandbox even when a context is reused.
`dispose()` aborts its active run and waits for reap. Concurrent context execution
is rejected; callers can create another context. Memory-limit mismatch fails
explicitly: use a pool with the requested cap, never silently ignore it.

### Backend and pool

Actual interfaces are in `executor.ts`:

```ts
interface Backend {
  kind: 'jitk' | 'hyperlight-js' | 'local-process-qjs';
  memoryLimitMB: number;
  park(signal?: AbortSignal): Promise<Sandbox>;
}
interface Sandbox {
  exited: Promise<void>;
  read(): Promise<unknown>;
  send(frame: unknown): Promise<void>;
  kill(): void;
}
// new SandboxPool(backend, warmCount, maxLive)
// warm(); acquire(signal?); release(sandbox); close()
```

`park` resolves after a versioned ready frame. Parked instances contain bootstrap
only: no previous code, result, tool response, credentials, or tenant state.
`release` always SIGKILLs/reaps and requests an asynchronous replacement.
Pool accounts for launches plus live instances; saturation immediately sheds
load. No unbounded acquire queue. `close` also aborts launches. The sketch warms
serially; production may add a measured small launch-concurrency limit.
Partition pools by backend, image/protocol version, memory cap and trust domain.
A global fleet admission cap must include parked plus executing instances.

- **jitk:** spawn `jitk-vmm --channel stdio --memory-mib N`; proposed CLI, not an
  observed existing interface. Parent pipes map to the VM tool-console channel;
  VMM diagnostics use stderr. The VMM applies the brief's process containment.
- **hyperlight-js:** spawn a credential-free Node helper, load
  `SandboxBuilder → ProtoJSSandbox → JSSandbox → LoadedJSSandbox`, register only
  `host:jitk.call`, then park a generic handler. Host callbacks serialize tool
  messages to the same dispatcher; they cannot directly execute credentials.
  Killing the helper kills the native addon and its VM. Full runtime **UNVERIFIED**.
- **local-process-qjs:** spawn native qjs with `--memory-limit N*1048576`, empty
  inherited environment except a fixed PATH, and `guest.mjs`. No Docker or VM
  needed after compilation. This backend deliberately exposes QuickJS std/os and
  filesystem imports and is **development-only**. QJS heap cap is not OS RSS cap.

### Channel, cancellation and logs

One UTF-8 JSON object per line, with these startup and terminal extensions:

```json
{"t":"ready","version":1}
{"t":"run","code":"(async()=>{...})()","providers":[{"name":"github"}]}
{"t":"call","id":0,"ns":"github","fn":"listIssues","args":[{"repo":"x"}]}
{"id":0,"ok":[{"id":1},{"id":2}]}
{"id":1,"err":"policy denied"}
{"t":"log","level":"warn","message":"example"}
{"t":"done","result":2}
{"t":"error","message":"failed"}
```

Arguments are an array, preserving variadic functions; replies complete promises
by ID. Guest stdin is read using `os.read`/`os.setReadHandler`, so Promise.all can
have concurrent host calls. Mixing std.getline buffering with fd readiness would
miss already-buffered replies. The smoke test handles Unicode and async fanout.

Current limits: 64 KiB code; 1 MiB serialized frame; 128 queued frames; 1,000 calls
per execution; 32 outstanding calls; 256 logs / 64 KiB log text; 64 KiB VMM stderr.
Checks precede host function lookup/invocation. Lookup uses own properties on
null-prototype registries; sanitized-name collisions fail closed. Version 1
binary values use Cloudflare's `__codemode_binary_v1__` base64 envelope.
Undefined final result is an omitted result property, not null. Cycles/BigInt
fail serialization; no implicit lossy conversion is promised.

One wall-clock deadline spans launch, execution, tool calls and approvals.
External AbortSignal, context disposal or deadline triggers process-group
**SIGKILL**, then await `close`. A guest Promise.race cannot stop a CPU loop.
The host stops admitting/answering calls when the run ends. Already-started
external side effects cannot be undone by killing a VM. Integrators must bind
request cancellation into their host tools and use idempotency keys where needed.
Production bounds each provider's network operation independently as well.

### Typed tools, prelude and policy

`providers.ts` accepts Zod-backed typed host functions, validates input/output on
the host, converts schemas with `z.toJSONSchema`, and invokes codemode's actual
JSON-Schema-to-TypeScript generator. `generated-tools.d.ts` proves the output:
`github.listIssues(input: {repo:string}) → Promise<{id:number}[]>`.
Per-provider ambient namespaces scope duplicate type aliases. `type-proof.ts`
checks both valid calls and expected errors using the generated declarations.

Cloudflare `/ai` uses `generateTypes(tools, namespace)` and schema-validating
`resolveProvider`; main `resolveProvider` does not validate. `/ai` transitively
imports `cloudflare:workers`, so this Node SDK uses its own small Zod resolver.
`upstream.ts` accesses pinned private dist exports only for the spike. Production
must vendor the small MIT normalizer/type generator with license attribution or
obtain a Workers-free public upstream export. Private hashed filenames are not
an acceptable semver API.

Type declarations go to the model prompt / optional typecheck environment;
QuickJS executes JavaScript only. `ResolvedProvider.prelude` is a separate trusted
JS string injected after namespace proxies, for local wrappers/closures. Its own
properties override RPC methods. Prelude code and schema text come from trusted
host configuration; guest code cannot modify the host capability registry.

```ts
type Decision = 'allow' | 'deny' | 'requireApproval';
type Call = Readonly<{id:number; ns:string; fn:string; args:unknown[]}>;
type Label = 'user' | 'model' | 'tool-untrusted' | 'host-trusted';
type Context = Readonly<{
  executionId:string; signal:AbortSignal; provenance:readonly Label[];
}>;
type Policy = (call:Call, ctx:Context) => Decision | Promise<Decision>;
// RunOptions.approve?: (call:Call,ctx:Context)=>Promise<boolean>
```

Policy runs on every host call, including forged guest messages. Arguments are
copied for the policy snapshot; JSON objects are deeply frozen. Missing approval
callback denies. Approval must bind to execution ID and exact call snapshot;
production adds tenant/principal, credential scopes, request hash, expiry and
host audit sink. Credentials remain in trusted provider closures. The interface
requires a policy callback; there is no implicit allow default.

Labels are host-owned. The sketch conservatively labels the whole run
`tool-untrusted` when a tool executes; subsequent calls inherit it. It does not
claim per-value CaMeL/FIDES taint tracking or safe declassification. Binary views
are copied but cannot be Object.freeze'd by Node; policy callbacks are trusted.
A real approval UI/authentication and replay-resistant grant store remain
integration work, not a guest-controlled `approved:true` field.

## 2. Code sketches and validation

Executable files: `executor.ts`, `guest.mjs`, `codec.mjs`, `providers.ts`,
`upstream.ts`; Hyperlight helper sketch: `hyperlight-helper.ts`.
`demo.ts` runs the exact requested snippet; `verify.ts` has 20 passing checks.
`inspect-wrapper.ts` captures the actual published DynamicWorkerExecutor wrapper
using a fake WorkerLoader (only host RPC classes are stubbed); its emitted source
is preserved as `cloudflare-wrapper.generated.mjs` without rewriting it.
`backend-wrapper-demo.ts` runs that unchanged module **through our local backend**
and forwards its tool dispatchers to the real JSON-lines channel.

From this directory:

```sh
sh setup-qjs.sh
npm ci --legacy-peer-deps
npm run typecheck
npm test
npm run wrapper
npm run wrapper-backend
npm run demo
sh trace-static.sh
```

Final validation/benchmark used Node 24.22.1 selected on PATH; ordinary npm scripts
also passed under this machine's Node 23.10.0. Compilation avoids a tsx resolution
failure in transitive `fast-json-patch@3.1.1` (`./src/core` absent). No dependency
files were patched. `skipLibCheck` skips third-party declarations; our strict
source and generated type proof are checked.

Measured local-process execute latency, **ms**, n=100 per case after 10 discarded
warmups; wall time includes acquire, one execution, SIGKILL/reap and refill
initiation. Warm=4 is refilled before each timed call. Tool is an in-memory host
stub returning two issues; no remote API/network latency is included.

| Pool | Program | Median | p90 |
|---|---|---:|---:|
| cold | return 2 | 10.514 | 18.685 |
| cold | requested one-tool snippet | 8.781 | 16.174 |
| warm 4 | return 2 | 2.814 | 6.986 |
| warm 4 | requested one-tool snippet | 3.732 | 9.494 |

Raw samples: `bench-results.json`; commands: `final-benchmark.log`. This shared
host has uncontrolled concurrent work; different case medians are noisy and must
not be subtracted to estimate RPC cost. These are local-process measurements,
not microVM boot/latency, sustained fleet throughput, or CPU-isolated benchmarks.

## 3. BLOCKERS — experiments and elimination attempts

**A. Published Cloudflare wrapper / real qjs compatibility — ELIMINATED for tested
paths; literal zero-shim compatibility disproved.**
`npm view @cloudflare/codemode version` → 0.5.5; local install succeeded using
`--legacy-peer-deps` after npm's peer resolver crashed (`edgesOut`).
`sh setup-qjs.sh` built QuickJS 2026-06-04 with local clang, no Homebrew install.
`npm run wrapper` → literal wrapper exits 1: `could not load module filename
'cloudflare:workers'`. A separate file exporting WorkerEntrypoint plus
`setTimeout=os.setTimeout` makes the unchanged wrapper return result 2 / count 2
logs in **both** native qjs and Docker arm64 with copied static musl qjs.
Binary test without base64 globals returns `'btoa' is not defined`; supplying
our `atob`/`btoa` shims returns `[0,127,255]` in both engines.
`npm run wrapper-backend` → `{"result":{"result":2,"logs":["count 2"]},"logs":[]}`.
Evidence: `wrapper-results.json`, `backend-wrapper-result.json`.

The sandbox therefore needs ES modules / WorkerEntrypoint compatibility only if
running that literal Worker wrapper, plus promises, proxy, console, timers and
base64 globals for binary data. QJS provides Promise/Proxy/console; plain qjs has
no global setTimeout/atob/btoa/fetch/TextEncoder. Our smaller transport bootstrap
avoids Workers RPC and injects its own namespace proxies. Extra Workers modules,
ServiceStub connectors and durable-runtime pause/replay are not validated.

**B. Actual TanStack driver contract — ELIMINATED.**
`npm view @tanstack/ai-code-mode version` → 1.0.0. Read actual `types.d.ts` and
packed `@tanstack/ai-isolate-quickjs@1.0.0` source in
`/tmp/jitk-04/tanstack-driver/package/src/isolate-context.ts`.
`npm test` checks both `createContext.execute` on actual stripped TS and actual
`createCodeModeTool` with a real server tool. Both pass. Cloudflare's optional
`@tanstack/ai` peer range is `<1.0.0`; its `/tanstack-ai` adapter is not used here.

**C. End-to-end executor / timing / cancellation — ELIMINATED locally.**
`npm run demo` → requested snippet returns `{result:2,logs:[]}` in cold/warm pools.
`npm test` → 20/20; `npm run typecheck` → exit 0. With a 30 ms deadline, infinite
loop finished/reaped in 37.742 ms; hung tool wait in 36.302 ms; external abort
case in 35.073 ms. These are observations, not hard real-time upper bounds.
Evidence: `verification-results.json`, `final-validation.log`.

**D. Async guest syscall support — FOUND, kernel integration remains OPEN.**
`sh trace-static.sh` ran the full bootstrap + request/reply through strace in
arm64 Alpine: ready → call → done(result 2), 15 observed unique syscalls.
`guest.strace:91` contains `ppoll`; unlike the brief's synchronous script, getcwd
was absent. Need the union of workloads, not the original 15-call set.
Actual jitk `ppoll` behavior is **UNVERIFIED** until its kernel runs this script.

**E. Hyperlight platform — NOT ELIMINATED on this host.**
`npm pack @hyperlight-dev/js-host-api@0.4.0`, inspect/install, then
`node build/hyperlight-helper.js --memory-mib 128` → `Cannot find native binding`.
Installed manifest lists only linux-x64-gnu/linux-x64-musl/win32-x64-msvc binaries.
Helper typechecks, but native callback semantics, generic-handler evaluation,
timers, cancellation, memory limits and latency remain **UNVERIFIED**. Run the
same suite on supported Linux x64 with hypervisor access. Evidence:
`hyperlight-attempt.log`; installed package manifest, not its generic error's
suggestion to reinstall, establishes the platform limitation.

**F. Actual jitk process / security integration — NOT ELIMINATED.**
`rg --files /tmp/jitk-spike arch -g '*jitk-vmm*'` found no matching executable;
`new JitkBackend('/tmp/jitk-04/jitk-vmm').park()` → spawn ENOENT,
recorded in `jitk-attempt.log`. No implemented VMM channel exists in this spike.
Run the same protocol/cancellation suite once it does. VM containment, OS
resource caps, adversarial protocol fuzzing, approval grant integration and
full tenant isolation remain **UNVERIFIED**; the dev process is not production
security evidence. Supervisor crash cleanup also needs Linux parent-death/cgroup
ownership and a macOS lifecycle owner so orphaned helpers cannot persist.

## 4. What I'd cut

Cut snapshot/restore, shared-memory rings, reconnect/retry of execution, durable
replay, direct connector bypass, arbitrary additional modules, dynamic tenant
prelude caching, and default raw internet access. Never replay side-effectful
code to simulate an async tool bridge. Keep bounded Promise.all; defer an
explicit batch RPC until measurements justify it. Cut global TS typechecking
from the latency path; upstream TanStack already strips TS. Minimize shipped
dependencies: `ai`, tsx and the reference drivers are inspection/integration
fixtures here, not dispatcher requirements. Keep local backend opt-in only.

## 5. Open disagreements with the brief's consensus

1. **The observed syscall set is workload-dependent.** Async transport exercises
   ppoll (`guest.strace:91`); synchronous getline artificially serializes fanout.
   Implement one-channel readiness rather than claiming the existing 15 suffice.
2. **Plain QuickJS does not run the Workers wrapper out of the box.** Actual
   import/base64 failures above disprove it. Prefer our tiny bootstrap in jitk;
   preserve literal-wrapper tests as a compatibility oracle.
3. **Do not precompile tenant code into parked VMs.** Only immutable bootstrap
   belongs there; send code/provider manifest once after acquire. Performance
   benefit from bytecode bootstrap is **UNVERIFIED**; native source execution
   already works and bytecode pinning adds another engine-version coupling.
4. **An Executor type is not a complete policy bridge.** Actual `ResolvedProvider`
   has no schema or provenance, and main `resolveProvider` skips validation.
   Carry host validation/policy metadata separately. Coarse whole-run provenance
   is useful but does not establish CaMeL/FIDES information-flow guarantees.
5. **One Node dispatcher must not contain a native fallback VM addon.** SIGKILL
   would kill the trusted dispatcher too. Put Hyperlight in its own helper;
   actual package offers `interruptHandle.kill()`, but independent process kill
   remains the common enforcement boundary across backends.

## 6. Estimated LOC

Measured runtime sketch: **438 physical lines** across executor (254), guest (54),
codec (33), provider adapter (25), upstream adapter (11), Hyperlight helper (61).
Fixtures/tests/generated wrapper add roughly 250 physical lines, excluded from
runtime. Estimated production TS/JS **700–1,000 LOC** including strict protocol
schema/depth validation, launch retry health, context metadata, audit sink,
cooperative host cancellation and supervisor lifecycle handling; **UNVERIFIED
estimate**, excludes VMM/kernel, dependencies and actual approval UI.
