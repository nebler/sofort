# sofort-bench v1 competitor adapters

Each competitor default-exports SPEC-V1 §1's `{name,isolation,where,open,provenance}`.
Tools are always the harness's passed `ResolvedProvider.fns`. `types.ts` imports
`Executor` and `ResolvedProvider` from the pinned codemode package; those types
also structurally match `harness/contract.ts`. `sofort.ts` belongs to the harness
agent and is intentionally excluded from this package's standalone typecheck.

| Adapter | Pins | Isolation / execution model | Mac smoke |
| --- | --- | --- | --- |
| node-vm | Node 24.22.1 | Fresh `node:vm` context per execute, **none** | 10/10 |
| ai-sdk-code-mode | @ai-sdk/code-mode 1.0.115; ai 7.0.158; run 2.1.11 | QuickJS WASI in Node worker threads, fresh context, **wasm** | 10/10 |
| tanstack-isolated-vm | @tanstack/ai-code-mode and @tanstack/ai-isolate-node 1.0.0; isolated-vm 6.2.0 | Fresh native V8 isolate, **v8-isolate** | 10/10 |
| tanstack-quickjs | @tanstack/ai-code-mode and @tanstack/ai-isolate-quickjs 1.0.0; quickjs-emscripten 0.31.0 | Fresh QuickJS Wasm runtime/context, **wasm** | 10/10 |
| hyperlight-js | Hyperlight host 0.18.0; Hyperlight-JS 8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7 | Existing strict single-use HVF backend, **microvm** | 8/10 |
| cf-dynamic-worker | @cloudflare/codemode 0.5.5; miniflare 4.20260730.0; workerd 1.20260730.1 | Fresh Worker Loader Worker per execute, **v8-isolate** | 10/10 |

`package-lock.json` pins transitive packages and integrity hashes. Provenance
records the host, package versions, lock/source hashes, timeout and selected
Hyperlight binary/snapshot/watchdog identities. All adapters are local.

## Run on the Mac

From the repo root, after the repo's dependency setup has prepared its cached
Node and Hyperlight artifacts:

```sh
eval "$(arch/jitk/tools/.work/bin/deps env)"
cd arch/jitk/bench/v1/adapters
PATH="$(dirname "$JITK_NODE"):$PATH" "$JITK_NODE" "$JITK_NPM_CLI" ci
"$JITK_NODE" node_modules/typescript/bin/tsc --noEmit
"$JITK_NODE" conformance.ts
```

If the deps helper is not built, use an absolute Node 24 path; this Mac's was
`~/.cache/jitk/node/v24.22.1-darwin-arm64/bin/node`. The `.npmrc` uses legacy
peer resolution because codemode's optional TanStack peer excludes 1.0 while
the published TanStack drivers require 1.0; the drivers are invoked directly.
The native driver and `isolated-vm` are optional npm dependencies, so native
build failure does not prevent installing the other competitors. Conformance
reports an unavailable native adapter explicitly. Build it with the same Node
that will execute it (`npm rebuild isolated-vm` after changing Node ABI).
The native build **succeeded on this Mac with Node 24.22.1**, Xcode's C++
compiler and isolated-vm 6.2.0; it was not skipped. Upstream's Node driver also
probes the addon in a child process before use.

`open({concurrency,timeoutMs?})` accepts the harness's timeout option; absent
that, `SOFORT_BENCH_TIMEOUT_MS` defaults to 30,000 ms. `memoryClass` is accepted
for contract compatibility; the non-Hyperlight isolating competitors use
128 MiB, and the existing Hyperlight backend uses 16 MiB. `node-vm` has no heap
limit. Admission is FIFO; each admitted run receives a fresh context. `close()`
drains executions and disposes runtime resources. No hosted resources exist.

## Local Worker Loader: verified, no fallback

The local probe used `new Miniflare({workerLoaders:{LOADER:{}}})` and called
`env.LOADER.get()` with a generated module. The returned Worker's fetch
produced `{"answer":42}`. The actual adapter then used codemode's
`DynamicWorkerExecutor` and its `loader.load()` path, passing all ten checks,
including native ToolDispatcher RPC → supervisor HTTP callback → harness fns.
No deployment, account, remote binding or Cloudflare token was involved.

Sources checked on 2026-10-30:

- [Cloudflare local development](https://developers.cloudflare.com/workers/local-development/): Miniflare runs local workerd.
- [Cloudflare code mode example](https://developers.cloudflare.com/dynamic-workers/examples/codemode/): DynamicWorkerExecutor, Worker Loader and the RPC tool pattern.
- [Cloudflare codemode implementation](https://github.com/cloudflare/agents/tree/main/packages/codemode): the installed 0.5.5 implementation calls `loader.load()` and supplies ToolDispatcher RPC targets.
- [Workers SDK local RPC issue #13263](https://github.com/cloudflare/workers-sdk/issues/13263): earlier local-tool result problem; it did **not** reproduce at these pins.
- Installed `miniflare/dist/src/index.d.ts` exposes `workerLoaders: Record<string, {}>` and installs a real Worker Loader binding. The local execution checks are the evidence for this exact version; the docs alone were not treated as proof.

`cf-worker.mjs` is the supervisor bundled once by esbuild at `open()` time.
Generated Workers have `globalOutbound:null`. Only the supervisor's host-tool
closures can fetch the adapter's authenticated loopback `/call` listener.
`http-client.ts` implements the agreed harness request/response shape, with
the codemode binary codec as a compatible extension. See [HOSTED.md](HOSTED.md).
The optional harness `toolEndpoint` is not needed: the local adapter calls the
passed fns, where replay accounting is performed.

One workerd process is kept per concurrency lane. Upstream's guest timer
cannot preempt a synchronous CPU loop, so the host watchdog disposes that
lane's Miniflare runtime at the deadline plus 50 ms, waits for shutdown, and
recreates it for the next execution. Other lanes use separate processes.
This costs more resident process memory than multiplexing all Workers through
one workerd; include that in density results. Timeout/recovery wall time
includes teardown and subsequent runtime recreation. Workerd default heap
limits apply; this adapter does not claim a configured 128 MiB hard cap.
Miniflare is a local development runtime: the isolation label identifies the
V8 mechanism, not equivalence with production Cloudflare hardening.

## Contract shims and known differences

- Namespaces and variadic args are reconstructed over each runtime's native
  single-input host binding. The JSON-only AI SDK/TanStack/VM bridges reuse
  `executor/codec.mjs` exactly (base64-tagged binary). They do not ship or run
  tool implementations in the guest. Encoding costs remain in measured work.
- The value-only `runCodeMode` API does not expose console logs. A small guest
  envelope captures log/warn/error/info/debug with `String(arg)` formatting;
  the same shim is used in VM/TanStack. CF and Hyperlight use native logs.
  Engine-level termination can lose logs buffered in the envelope.
- JS normalization mirrors codemode 0.5.5 (MIT attribution in
  `LICENSE.cloudflare`); the public codemode module imports
  `cloudflare:workers` and cannot be imported by a Node host at runtime.
- Hyperlight reuses `bench/hyperlight/backend.ts`, `MicroVMExecutor`, the pool,
  process protocol and native watchdog. Only TS glue is bundled under
  `.cache/`; no Rust build, VM rebuild or shared executor file is changed.
  The local bundler redirects the backend's built JS import to the same
  source TS and preserves source-relative resource locations. Cached binary
  selection follows `tslib/deps.ts` with environment overrides.
- Hyperlight returns `Error: Error: boom` for the thrown-error check and fails
  the 100 KB host result with **Host response exceeds virtqueue capacity**.
  Both are retained as differences, with actual output in `CONFORMANCE.json`.
- `Promise.all` returns correct values everywhere, but measured simultaneous
  host calls were **1** for TanStack isolated-vm (`applySyncPromise`) and
  Hyperlight's synchronous host bridge, versus **3** elsewhere. Matching
  answers do not imply equal fan-out behavior.
- `node:vm` is the explicitly unisolated floor. Host functions are references
  into Node. Its synchronous VM timeout handles the tested initial CPU loop;
  hostile continuations after `await` can block the host event loop. A host
  timer is not an isolation boundary. Use process containment for S3 studies.
- Timeouts stop guest execution/accepting new Cloudflare callbacks. Already
  started trusted host tools cannot be force-cancelled through this Executor
  interface; their own cleanup/cancellation must be handled by the harness.

See [CONFORMANCE.md](CONFORMANCE.md) for the exact matrix and run conditions.
`conformance.ts` runs one adapter child at a time, each with a 25 s outer
process watchdog, and uses a 500 ms per-execution budget. It writes every
actual result and mismatch. `--strict` exits nonzero on any difference;
default runs retain differences as data. Select adapters by name to run a
subset. These are smoke checks, not p99/performance measurements.

**Optional, not implemented:** `wasmtime-quickjs` would run a pinned QuickJS
WASI module in Wasmtime with epoch interruption and host imports/stdio RPC.
This is distinct from the AI SDK's QuickJS-WASI in Node worker threads; do
not label those results Wasmtime. Hosted adapters remain design-only.
