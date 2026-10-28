# Node compatibility on workerd: the useful remainder is adapters, not a second Node

Research date: **2026-10-28**. **F** = sourced fact; **M** = measured locally; **I** = inference; **E** = estimate or proposed acceptance criterion. Primary sources are linked inline. No account, deployment, paid inference, Docker, or execution host was used.

**Verdict: go-with-changes for a headless Pi SDK in a Durable Object; no-go for the literal promise of an unmodified Node CLI with all its default tools.** The current Pi SDK already imports, and ordinary text tools already work. Growing compatibility can fix real pure-code differences, but cannot grow an operating-system process into an isolate. Persist files through DO storage and route command execution through explicit tool operations. Do not make general Node compatibility the project's prerequisite or claimed novelty.

## 1. What exists in October 2026

### Configuration and implementation

**F.** Cloudflare now enables both `nodejs_compat` and v2 by default for dates **2026-08-04 onward**. Earlier dates **2024-09-23–2026-08-03** require `nodejs_compat` to opt into both; still earlier dates need the explicit v2 flag as well. Turning compatibility off at current dates needs both negative flags. This is date-controlled behavior, not a switch that makes an arbitrary Node process portable. [August 2026 announcement](https://developers.cloudflare.com/changelog/post/2026-08-04-nodejs-compat-default/), [flag reference](https://developers.cloudflare.com/workers/configuration/compatibility-flags/).

**F.** Important dates/flags beyond that umbrella:

| Feature | Relevant gate |
|---|---|
| Populate `process.env` from bindings | `nodejs_compat_populate_process_env`, default 2025-04-01 |
| HTTP/HTTPS client | `enable_nodejs_http_modules`, 2025-08-15 |
| HTTP server adapter | `enable_nodejs_http_server_modules`, 2025-09-01 |
| Extended process and OS; filesystem | Process/OS/FS gates, 2025-09-15 in runtime source |
| Node-style global timer handles | `enable_nodejs_global_timers`, 2026-02-10 |
| Child process, readline, tty, repl, v8, worker threads stubs | Their `enable_nodejs_*_module` gates, 2026-03-17 |
| Improved module metadata/resolution | Explicit `new_module_registry`; do not assume the umbrella enables it |

The FS documentation still says 2025-09-01, whereas the flag reference and [runtime schema](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/workerd/io/compatibility-date.capnp) say September 15. Pin a recent date and verify behavior rather than relying on that discrepancy. The [September 2026 registry announcement](https://blog.cloudflare.com/workers-module-registry-nodejs/) explains `import.meta.url`, `resolve`, CommonJS/ESM interoperability and Wasm loading improvements. **M:** enabling that flag fixed both tested yargs versions and Pi TUI imports without generated code.

**F.** The implementation is already a substantial TypeScript/JavaScript layer in [`src/node/`](https://github.com/cloudflare/workerd/tree/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node), with upstream Node JavaScript ports in `internal/`, native bindings under [`src/workerd/api/node/`](https://github.com/cloudflare/workerd/tree/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/workerd/api/node), and tests adapted from Node. It is not merely a set of Wrangler mocks. The [compatibility policy](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node/README.md) explicitly declines complete Node equivalence, prioritizes platform behavior, and allows incremental implementations behind flags.

**F.** Wrangler's [hybrid compatibility plugin](https://github.com/cloudflare/workers-sdk/blob/fc57bc0e03b096cff58e949e67ccfb9f7832a3c2/packages/wrangler/src/deployment-bundle/esbuild-plugins/hybrid-nodejs-compat.ts) calls `unenv.defineEnv()` with `@cloudflare/unenv-preset`, selecting aliases, globals, external built-ins and polyfills using the compatibility date/flags. [`unenv`](https://github.com/unjs/unenv) supplies both working pure-JS implementations and importable mocks; an available function can still throw or do nothing. Preserve the native implementations instead of replacing the whole standard library. **M:** the installed toolchain was Wrangler 4.154.0, preset 2.16.2. Browser package mappings can also select the wrong package implementation even when native built-ins work.

### Cloudflare's module labels, with the qualifications that matter

**F.** The [current compatibility index](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) labels the following supported: assert, async context, Buffer, crypto, diagnostics channel, errors, events, fs, globals, HTTP/HTTPS, net, path, process, punycode, query strings, streams, string decoder, timers, URL, utilities, Web Crypto/Streams and zlib; debugger support comes through DevTools. Partial: console, DNS, module, OS, performance hooks, test runner and TLS. Non-functional stub modules include http2, vm, cluster, domain, trace_events, wasi, _stream_wrap, dgram, inspector, sqlite, child_process, readline, repl, tty, v8 and worker_threads. These are module-level labels, not a guarantee about every export or Node's OS semantics.

| Area | What actually exists and its consequence |
|---|---|
| Files | **F:** Memory VFS: read-only `/bundle`, writable request-local `/tmp`, several `/dev` devices. Sync, callbacks and promises operate on that VFS; all underlying operations are synchronous. `/tmp` counts against isolate memory and is not a persistent workspace. Docs list missing watching, permissions, ownership and timestamps fixed at epoch. [FS documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/). **M:** sync write/read worked; two successive requests each saw the session file absent; mtime was `0`; `fs.watch` threw `ERR_UNSUPPORTED_OPERATION`. Contrary to stale docs, `globSync` exists in the binary/source: relative npm globbing worked, but the direct absolute `/tmp/*` probe incorrectly returned `[]`. [Current glob implementation](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node/internal/internal_fs_glob.ts). |
| Durable sync files | **F:** SQLite-backed DOs expose synchronous SQL **and synchronous KV through `ctx.storage.kv`**. This makes a DO-local sync file adapter plausible; “all sync I/O is impossible” would be wrong. [DO storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/). **M:** SQL and KV calls returned non-Promises, data survived a second request and a complete Miniflare/workerd restart with persistence enabled. This tests the primitive, not a completed POSIX filesystem. |
| TCP/TLS | **F:** Outbound `net.Socket` and `tls.connect` wrap `cloudflare:sockets.connect()`. TLS server functionality is absent. [Net](https://developers.cloudflare.com/workers/runtime-apis/nodejs/net/), [TLS](https://developers.cloudflare.com/workers/runtime-apis/nodejs/tls/). **M/F:** The net page says `net.Server` is unsupported, but the October binary accepts `createServer().listen(0)`, and [source](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node/internal/internal_net.ts) implements a virtual port table routed by [`cloudflare:node.connectHandler`](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/cloudflare/node.ts). This does **not** open an arbitrary public TCP port. |
| Hosted network boundary | **F:** Service-binding inbound `connect()` handlers became production-usable in August 2026; direct public inbound TCP remains unsupported. [Announcement](https://developers.cloudflare.com/changelog/post/2026-08-18-connect-handler/). Ordinary outgoing sockets restrict loopback/private/Cloudflare addresses and port 25; do not extrapolate successful localhost tests to the hosted network. [Sockets documentation](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/). |
| Child processes | **F:** [`child_process.ts`](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node/child_process.ts) validates some arguments but throws for spawning/execution. **M:** `spawn`, `spawnSync` and both Pi versions' default bash tool threw `ERR_METHOD_NOT_IMPLEMENTED`. Async command RPC to an execution host is possible, but is a tool/backend substitution. `execSync` against a remote host cannot transparently block the isolate until a network response arrives. |
| HTTP server | **F:** `createServer()` is real HTTP adaptation. Export `httpServerHandler(server)` or call `handleAsNodeRequest`; `listen(port)` supplies a routing key, not a kernel listener. Client operations wrap fetch; Agent connection pooling/keepalive behavior is restricted. [HTTP documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/). **M:** A server using port 8080 returned `node-http-ok` through the adapter. |
| Process/env | **F:** Bindings/secrets can populate `process.env`; it is shared mutable isolate state, not per-session credentials. `NODE_ENV` can be replaced at bundle time. Stdin is empty; stdout/stderr are log streams. `nextTick` uses microtasks; hrtime is not a faithful high-resolution Node clock. [Process documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/). **M:** cwd `/bundle`, argv `["workerd"]`, execPath empty, platform `linux` even on this macOS host; a configured test variable was visible. Pi CLI `--help` reached `process.exit(0)`, which canceled the Worker request. |
| Timers/lifecycle | **F:** `node:timers` provides timeout objects, immediate callbacks and promise variants. The old global-timers note is superseded for recent dates by the global override gate above. [Timers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/timers/). **M:** global handles had `refresh`, `unref` changed `hasRef`, and a simple nextTick/promise order probe passed. **I:** This does not prove libuv phase equivalence, restore a timer after eviction, or make an in-flight JS stack durable. Use stored state and alarms/events for resumable work. |

**F.** I found **no defensible Cloudflare-published percentage of top-N npm packages passing a specified compatibility test** in the compatibility index, 2025 retrospective, 2026 registry announcement, or targeted searches for top packages/percentages. The [2025 retrospective](https://blog.cloudflare.com/nodejs-workers-2025/) describes hundreds or thousands of packages working, without a reproducible denominator. Do not turn that into “95% npm compatibility”; the measurements below are our selected corpus, not Cloudflare's statistic.

## 2. Local census and the first kill test

### Reproducible boundary

**M.** macOS ARM64, oracle **Node 24.22.1**, supplied binary **workerd 2026-10-25**, SHA-256 `a3056da8e2565bb7b99f7a39e18a76ba0dce28cc9d0721cc4db76f4fc7b07bf6`. Inspected workerd source snapshot: `7d31f97096d01b15eaec14a3e66fd15cbd43466e`; that October 28 source snapshot is not asserted to be the October 25 binary's exact commit.

Scratch was `/tmp/split-compat/`, peaking at about **501 MiB** before cleanup. Install scripts and optional dependencies were disabled. Wrangler only bundled locally using `deploy --dry-run`; Miniflare launched the supplied binary via `MINIFLARE_WORKERD_PATH`. No Cloudflare account was needed. Workers used date `2026-10-25` and `nodejs_compat`; the improved-registry runs additionally used `new_module_registry`. Each import ran inside a request with separate build/import/smoke outcomes. Network smoke tests used an independent local HTTP fixture, never a model provider.

The corrected results exclude harness mistakes: initial cookie API mismatch, the moving TypeScript latest export surface (pinned to 5.9.3), a blocked Node fixture server, package entry resolution mistakes, and CJS filename declarations in the upstream-test wrapper. These are recorded in scratch history, not counted as runtime incompatibilities. Full dependency-root imports are shallow: lazy paths, native extensions, all subpath exports and actual model streaming are **not** thereby certified.

### Pi names changed; test both rather than silently testing an obsolete release

**F/M.** The requested `@mariozechner/pi-coding-agent` exists at **0.73.1**, but npm marks it deprecated in favor of **`@earendil-works/pi-coding-agent`**, currently **1.4.0**. GitHub redirects `badlogic/pi-mono` to [`earendil-works/pi`](https://github.com/earendil-works/pi). The active [package manifest at v1.4.0](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/package.json) confirms the name. This is material: the current package is easier to import than the legacy package.

| Measured corpus/configuration | Node-importable package instances | Successful workerd imports |
|---|---:|---:|
| Requested legacy Pi 0.73.1 full installed closure, base flags | 182 of 189 | **166/182 = 91.2%** |
| Same closure, install missing optional build dependencies | 182 | **174/182 = 95.6%** |
| Same, also new module registry | 182 | **176/182 = 96.7%** |
| Current Pi 1.4.0 full installed closure, new registry | 116 of 122 | **115/116 = 99.1%** |

Counts are installed package instances, including multiple versions/copies, not independent npm projects. The active closure contains 120 distinct name/version pairs. Legacy Pi has 21 direct dependencies; active Pi has 22. The full closures were traversed, resolved with Node's import resolver, and each root import attempted. Type-only/subpath-only/broken root entries were attempted and reported separately, not treated as Workers failures.

**M. Every legacy import failure, grouped without hiding cascades:**

| Affected package(s) | Observed failure; classification and retest |
|---|---|
| `pi-coding-agent`, `pi-agent-core`, `pi-ai` 0.73.1; `@mistralai/mistralai` 2.7.0 | Build could not resolve optional `@opentelemetry/api`. **P:** install/bundle the peer. All but coding-agent then imported; coding-agent advanced to the metadata failure below. |
| `proxy-agent` 6.5.0, `pac-proxy-agent` 7.2.0, `pac-resolver` 7.0.1, `degenerator` 5.0.1, `escodegen` 2.1.0 | Build could not resolve optional `source-map`. **P:** installed 0.6.1; all five imported afterward. Their actual PAC evaluation was not exercised. |
| `pi-tui` 0.73.1; `yargs` 16.2.2 | `createRequire`/path received undefined module metadata. **P:** both passed with `new_module_registry`. |
| Coding-agent SDK/CLI after the preceding fixes | `ENOENT` reading `/bundle/out/package.json`. **P:** register package metadata as a bundle data module; SDK import then succeeded, 127 exports/version 0.73.1. This was asset wiring, no Pi source edit. |
| `@silvia-odwyer/photon-node` 0.3.4 | `__dirname is not defined`. **P** for CJS/asset wiring, followed by its source's runtime `new WebAssembly.Module(bytes)`, which requires changing to a precompiled module import. The latter is a known next blocker from source, not a measured second exception. |
| `mz` 2.7.0, `any-promise` 1.3.0, `thenify-all` 1.6.0, `thenify` 3.3.1 | `window is not defined`: browser mapping assumes a Window. **P:** correct the entry/alias or use a scoped globalThis-based shim. Not fixed in this experiment. |

These account for **all 16 Node-importable legacy failures**. The seven excluded Node-root failures were `@types/mime-types`, `@tokenizer/token`, `@babel/runtime`, `@types/retry`, `@types/node`, `undici-types` (no executable root) and `ts-algebra` (directory import rejected by Node). Workerd happened to bundle/import ts-algebra. Those are not seven additional compatibility gaps.

**M. Every active 1.4.0 closure failure:** only photon above failed among the 116 valid Node roots. Six other attempted roots were excluded by the same Node baseline: `@babel/runtime`, `@aws-sdk/nested-clients`, `@types/retry`, `@types/node`, `undici-types`, and `ts-algebra`. A closure import pass is especially misleading here: the default codemode package imports successfully but executing it fails; see below.

**M. Actual Pi entry/tool smoke:**

- Legacy and current SDK roots imported with the wiring described above; active Pi needed no legacy metadata repair for its plain import. Current SDK exposed 157 exports/version 1.4.0.
- Both versions' default text write/read tool definitions wrote `hello` and read it back **within one request**, using native `/tmp`.
- Both default bash tools failed at `child_process.spawn`, `ERR_METHOD_NOT_IMPLEMENTED`.
- Both CLI `--help` commands worked on Node. Inside workerd, after reaching help handling, `process.exit(0)` canceled the request. One initial wrapper run reported a non-Response promise; the corrected help probe isolated the process-exit cancellation. There was no terminal or usable resident CLI process.
- Active `CodemodeSandbox.execute('return 1+1')` passed on Node, failed on workerd with `Failed to load QuickJS: createRequire(...).resolve is not a function`. Beyond that loader, its default implementation needs worker threads. **E/X:** use the existing Cloudflare adapter; do not grow worker threads.
- **Existing adapter smoke passed:** `@earendil-works/pi-codemode/cloudflare` + `createInlineCodemodeSandbox` executed the same expression and checked result `2`. The first local wrapper failed to register Wrangler's emitted `.wasm` module; explicitly registering it as `CompiledWasm` fixed the wrapper. This is packaging evidence, not a platform Wasm failure.

### 44 popular packages: import plus a real, small use

**M.** A deliberately chosen mix of common libraries and OS-facing packages, **not a download-weighted random sample**. All final smoke cases passed on Node 24. **37/44 = 84.1%** passed stock workerd bundling; the new module registry fixed yargs, giving **38/44 = 86.4%**. Explicitly selecting ws's Node entry also passed its virtual-server lifecycle test, giving **39/44 = 88.6%** with that additional packaging adaptation. “Pass” certifies only the listed use.

| Package | Version | Smoke use | Base result |
|---|---|---|---|
| lodash | 4.18.1 | sum | Pass |
| express | 5.3.0 | register route | Pass |
| axios | 1.21.0 | GET local fixture | Pass |
| zod | 4.6.7 | parse object | Pass |
| chalk | 6.0.1 | format text | Pass |
| debug | 4.4.3 | emit log | Pass |
| commander | 15.0.0 | parse option | Pass |
| yargs | 18.2.0 | parse option | Fail (details below) |
| minimist | 1.2.8 | parse option | Pass |
| semver | 7.8.5 | satisfies range | Pass |
| uuid | 14.0.3 | v4 + validate | Pass |
| nanoid | 5.1.16 | generate ID | Pass |
| ms | 2.1.3 | parse duration | Pass |
| dayjs | 1.11.23 | format date | Pass |
| date-fns | 4.4.0 | add day | Pass |
| dotenv | 18.0.9 | parse env text | Pass |
| ajv | 8.20.0 | compile + validate schema | Fail (details below) |
| yaml | 2.9.1 | parse YAML | Pass |
| toml | 5.0.1 | parse TOML | Pass |
| qs | 6.17.0 | nested query parse | Pass |
| mime-types | 3.0.2 | lookup MIME | Pass |
| cookie | 2.0.1 | parse cookie | Pass |
| jsonwebtoken | 9.0.3 | sign + verify JWT | Pass |
| jose | 6.2.13 | HS256 sign + verify | Pass |
| bcryptjs | 3.0.3 | hash + compare | Pass |
| cheerio | 1.2.0 | parse HTML | Pass |
| marked | 18.1.2 | render Markdown | Pass |
| ws | 8.22.0 | server listen/close | Fail (details below) |
| undici | 8.12.3 | fetch local fixture | Fail (details below) |
| node-fetch | 3.3.2 | fetch local fixture | Pass |
| glob | 14.0.3 | glob fixture | Pass |
| fast-glob | 3.3.3 | glob fixture | Pass |
| fs-extra | 11.4.1 | write/read JSON | Pass |
| graceful-fs | 4.2.11 | sync read | Pass |
| proper-lockfile | 4.1.2 | lock + unlock | Pass |
| execa | 10.2.1 | spawn Node command | Fail (details below) |
| chokidar | 6.0.0 | watch ready/close | Fail (details below) |
| pino | 10.4.0 | emit log | Pass |
| winston | 3.19.0 | emit log | Pass |
| lru-cache | 11.5.3 | cache set/get | Pass |
| tar | 7.5.22 | stream gzip archive | Pass |
| typescript | 5.9.3 | transpile TS | Fail (details below) |
| react | 19.3.1 | create element | Pass |
| react-dom | 19.3.1 | server render | Pass |

**M/I. Every popular-package failure and its repair boundary:** **P** = implementable with code/build/package changes and existing runtime capabilities; **E** = emulate through a platform primitive; **X** = cannot preserve the required OS behavior inside a hosted Worker. Classifications describe the tested operation, not every API in the package.

| Package | Exact immediate failure | Classification; concrete route |
|---|---|---|
| yargs 18.2.0 | `createRequire` received undefined `import.meta.url` | **P, verified fixed:** new registry flag. |
| ajv 8.20.0 | `Code generation from strings disallowed for this context` | **P for the tested validation semantics**, through an interpreter or deployment-time standalone validator generation. This is a package/compiler change, not an `eval` polyfill; arbitrary runtime code generation remains unavailable. Unrestricted runtime schemas need separate validation of this approach. |
| ws 8.22.0 | `m.WebSocketServer is not a constructor` | **P, verified fixed:** choose its Node `index.js` rather than the browser entry, account for CJS default exports. Virtual listen/close passed. Public TCP binding, OS socket handles and arbitrary upgrade behavior remain outside this smoke's claim. |
| undici 8.12.3 | `fetch failed`; cause `WebAssembly.Module(): Wasm code generation disallowed by embedder` in lazy llhttp loading | **E:** use Workers fetch for HTTP, or repackage the fixed llhttp Wasm as a compiled module. No need to grow TCP or an HTTP parser merely to make provider HTTP calls. Dispatcher/proxy details require contract tests. |
| execa 10.2.1 | Build: missing `toPath` and `traversePathUp` exports from browser-selected `unicorn-magic/default.js` | Immediate **P** packaging issue; intended command spawning is **X** inside the Worker. A tool-level async execution-host RPC is a changed backend, not a complete child_process polyfill. The spawn limit was independently measured with built-ins and Pi. |
| chokidar 6.0.0 | Native fs watch throws `ERR_UNSUPPORTED_OPERATION` | **E:** emit watch events from a DO-backed workspace's mutation stream. Cannot observe an execution host's OS filesystem without forwarding its events. Request-local in-memory watching alone would be a smaller P implementation. |
| TypeScript 5.9.3 | `__filename is not defined` | **P:** CJS filename/dirname and asset wiring. Transpilation is a pure-code operation; external builds/toolchains belong on the execution host. Not repaired here. |

**I/E. Answer to “what share is implementable?”** On this operation-specific classification, **4/7 failed popular smokes (57.1%) are P**, **2/7 (28.6%) are E**, **1/7 (14.3%) needs an OS capability (X)**. These are engineering judgments, not seven completed repairs; two P repairs were demonstrated. The P/E boundary depends on the promised semantics: statically bundling undici's parser might avoid the fetch substitution; a watcher restricted to an in-memory replacement FS could be pure code. Do not present this seven-case denominator as a forecast of engineering effort.

Legacy Pi's **import-only** failures were all plausibly P, and current Pi had just one such failure. Nevertheless, a **required default bash operation is X**. Thus the kill test rejects “make all imports work, then grow the rest automatically” as the decision rule. It supports a small headless SDK port with explicit execution and storage adapters. Package-count coverage cannot weight away a single indispensable unsupported operation.

## 3. A concrete, bounded grow loop

### Oracle and upstream tests: what was actually run

**M.** Downloaded Node **v24.22.1** test sources, pinned to tag/commit `ce7aaf1cee78b8cf0ce17364260535c418d3ed26`. Twelve synchronous assertion-body tests were run under both Node and workerd. **12/12 Node passed; 8/12 workerd passed.** The runner replaced `../common` with a minimal helper exposing `isWindows: false` and supplied CJS `__filename`/`__dirname` metadata; the test assertions were retained. This is an **adapted assertion-body test run**, not a claim that workerd runs upstream's entire unmodified test harness.

| Exact file under `test/parallel/` | workerd result |
|---|---|
| `test-path-basename.js` | Pass |
| `test-path-dirname.js` | Pass |
| `test-path-extname.js` | Pass |
| `test-path-isabsolute.js` | Pass |
| `test-path-relative.js` | Pass |
| `test-buffer-ascii.js` | Pass |
| `test-buffer-badhex.js` | Pass |
| `test-querystring-escape.js` | Pass |
| `test-path-join.js` | Fail: several Win32 device/drive path cases produce different normalized paths |
| `test-path-normalize.js` | Fail: Win32 device-path trailing separator differs |
| `test-buffer-compare.js` | Fail: expected Node 24 error field/message `buf2` versus runtime `b`, including different interpolated input |
| `test-buffer-copy.js` | Fail: missing expected exception |

These are **four P failures**: path normalization and argument validation/error construction, not absent host capabilities. The Win32 cases matter if exact Node cross-platform path functions are promised; they are lower priority than actual Linux-style Pi workspace operations. Upstream sources: [path join](https://github.com/nodejs/node/blob/v24.22.1/test/parallel/test-path-join.js), [path normalize](https://github.com/nodejs/node/blob/v24.22.1/test/parallel/test-path-normalize.js), [buffer compare](https://github.com/nodejs/node/blob/v24.22.1/test/parallel/test-buffer-compare.js), [buffer copy](https://github.com/nodejs/node/blob/v24.22.1/test/parallel/test-buffer-copy.js), [test directory](https://github.com/nodejs/node/tree/v24.22.1/test/parallel).

**F/I.** The upstream [`test/common/index.js`](https://github.com/nodejs/node/blob/v24.22.1/test/common/index.js) itself loads process/build configuration, worker_threads and test directories and installs process lifecycle checks. A loader shim does not automatically make it portable. Build a small explicit runner that preserves assertion logic and must-call accounting, awaits completion, checks asynchronous errors, and names every adaptation. Never replace assertions with no-ops or equate “test imported” with “test completed.”

**I. Next test families worth porting:** `test-buffer-*`, `test-assert-*`, `test-querystring-*`, `test-path-*`, `test-string-decoder-*`, pure `test-util-*`, and in-memory stream/EventEmitter tests. Inspect each file: family names do not guarantee suitability. `test-buffer-bytelength.js` and `test-querystring.js` include `vm`; `test-path-resolve.js` includes subprocess/fixture logic; promise timers use `node:test`. These need explicit extracted assertions or supported harness work, not blind inclusion. FS tests can target a declared subset of sync/callback/promise, descriptors, directories, rename and symlink behavior on `/tmp` or a DO adapter. Host permission, mount, process, native addon, signals, public listener, CLI flags and blocking remote-I/O tests belong in documented exclusions or execution-host tests.

Cloudflare already maintains adapted Node tests, for example [Buffer tests](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/workerd/api/node/tests/buffer-nodejs-test.js), [FS tests](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/workerd/api/node/tests/fs-nodejs-test.js) and [v24 stream regression tests](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/workerd/api/node/tests/streams-v24-nodejs-test.js). Reuse their work instead of creating an incompatible second harness.

### What an iteration would do

**I.** One iteration should be an operation-level compatibility repair:

1. **Capture the real failing Pi call.** Store input, error/cause, package integrity/version, runtime version/date/flags, and required semantics. Reduce it to a fixture. First check current date, module registry, package conditions and existing adapters. The yargs, ws and metadata repairs show why this comes before synthesis.
2. **Assign P/E/X before generating code.** P gets a patch task and a bounded upstream-test list. E gets an explicit adapter contract. X gets routed to the execution host or removed from scope. A changing skip list must not count as growth.
3. **Run the same fixture on Node 24 and workerd.** Node 24 is the project's pinned oracle; Cloudflare aims at Node's Current release, so distinguish genuine bugs from deliberate version differences. Run the patch's upstream assertions on Node too, ensuring the harness has not changed their meaning.
4. **Compare observations, not whole console transcripts.** Canonicalize bytes, typed arrays, object types, results and error name/code; retain exact messages when the contract/test requires them. Normalize only named host artifacts such as temporary root prefixes and stack locations. Sort only order-unspecified results. Compare stream chunks as byte sequences plus meaningful event ordering/backpressure/cancellation, not identical chunk boundaries.
5. **Control nondeterminism explicitly.** Seed generated inputs; inject clocks/RNG in test fixtures where supported. For crypto randomness assert format, length, uniqueness/verification properties instead of byte equality. Compare timer/event happens-before requirements rather than milliseconds. Exercise multiple legal schedules with a fake peer and delayed reads; replay the seed on failure. Keep first failures and use bounded repeated runs to identify flakes. Do not “normalize away” a missing event, timeout, exception or lost write.
6. **Accept only a real regression improvement.** Both oracle and target must finish, relevant previously passing fixtures must still pass, and fixture assertions must remain unchanged. Store new failures separately from accepted exclusions. Use a deterministic stub model stream for end-to-end Pi tests; this requires no paid inference. A green import census alone never accepts a patch.

**E.** First loop budget: five real Pi-relevant P failures, at most 30 minutes per attempted repair, at least four fixes passing the frozen fixtures plus regressions. Count configuration-only fixes separately. Stop if success depends on weakening assertions or reclassifying the required operation. This cheaply tests whether the proposed growth method has value beyond ordinary compatibility maintenance.

### Where grown code should live

**I.** Begin with a versioned project-owned `pi-workerd-adapters` package/build layer, not a workerd fork. It should contain:

- Scoped package/loader fixes, precompiled Wasm imports and explicit bundle assets; no blanket global `window` shim for every dependency.
- A DO-local workspace adapter using synchronous SQLite/KV for the required sync operations and async interfaces for tools. Track files/inodes, bytes and offsets, stat data, directories and rename invariants explicitly. Scope the active session/DO through explicit parameters or async context; an isolate-global map is not durable storage or tenant scoping.
- Pi's existing `operations` injection for bash/read/write/edit/grep/find and storage/service factories where available. The [current bash tool](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/core/tools/bash.ts) and [session manager](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/core/session-manager.ts) show the relevant boundaries. Prefer replacing those operations to reimplementing all of `child_process`.

Pure, generally useful fixes to **existing native built-ins**, such as Buffer argument validation or path behavior, belong in a workerd PR with its adapted Node tests and compatibility review. Implementations live in `src/node/internal`, public wrappers in `src/node`, and native changes in `src/workerd/api/node`. A shipped Worker cannot patch `node-internal:*`; a package solution must explicitly alias/inject its own module at build time. General cross-runtime package fixes can go upstream to unenv or the affected npm package. DO storage and execution-host policy are application adapters, not plausible general Node-core PRs.

**I. Architectural consequence:** hibernation does not snapshot a pending Node agent loop, open stream, subprocess handle or JS continuation. Persist session entries, tool intentions/results, workspace changes and retry identifiers at event boundaries, then reconstruct the SDK state on a new request. A synchronous DO file adapter can preserve file API shape; it does not solve continuation recovery or let network `execSync` run synchronously.

## 4. Prior art: the broad idea is already being implemented

| Project | Primary evidence | What it proves, and what it does not |
|---|---|---|
| Cloudflare/workerd | [Compatibility policy](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node/README.md), adapted Node tests linked above, [repository agent instructions](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/AGENTS.md) | **F:** Incremental Node compatibility and upstream-test reuse already exist; the repository explicitly supports coding agents. **I:** This is evidence of agent-assisted work, not proof of a publicly documented unattended oracle→patch→accept loop. I found no such Cloudflare guarantee. |
| Deno | [Official node-compat agent skill](https://github.com/denoland/deno/blob/main/.claude/skills/node-compat/SKILL.md), [Node compatibility runner](https://github.com/denoland/deno/tree/main/tests/node_compat) | **F:** Direct prior art: the skill instructs an agent to run a Node test, diagnose it, classify implementable versus inherent limitations, patch `ext/node`, rebuild, rerun and update a reasoned test manifest. It also permits skips, so passing counts require auditing. This substantially overlaps the proposed grow loop. |
| Bun | [Compatibility tests](https://bun.sh/docs/runtime/nodejs-compat), [Bun's own account of Claude Code use](https://bun.sh/blog/bun-joins-anthropic) | **F:** Bun runs thousands of Node tests per release and reports substantial bot-authored bug-fix contributions. **I:** This establishes agents + compatibility infrastructure, not that every compatibility patch is generated/accepted autonomously. |
| unenv/Cloudflare preset | [unenv](https://github.com/unjs/unenv), [Wrangler hybrid plugin](https://github.com/cloudflare/workers-sdk/blob/fc57bc0e03b096cff58e949e67ccfb9f7832a3c2/packages/wrangler/src/deployment-bundle/esbuild-plugins/hybrid-nodejs-compat.ts) | **F:** Existing extensible implementation/alias/mock layers. I found no primary evidence of a dedicated autonomous Node-oracle growth service maintained by unenv. A generic agent instruction file would not establish one. |
| **Pi itself** | [v1.4.0 codemode documentation](https://github.com/earendil-works/pi/blob/v1.4.0/packages/codemode/README.md), [Cloudflare adapter source](https://github.com/earendil-works/pi/blob/v1.4.0/packages/codemode/src/cloudflare.ts), [default Node host](https://github.com/earendil-works/pi/blob/v1.4.0/packages/codemode/src/runtime/host.ts) | **F:** Pi already ships compiled-Wasm Workers execution and a portable remote codemode interface backed by a DO in a separate Worker. Its documentation explicitly discusses a session DO, per-session/per-execution object naming, caller-thread blocking, interrupts and memory. **M:** Its inline Cloudflare adapter passed locally. This is not a full shell/workspace/Pi-session deployment, but is much closer prior art than a hypothetical new compatibility runtime. |

**F. Current competitive context:** the Deno team announced joining Cloudflare on October 9, 2026 and combining its effort with Workers/DOs rather than developing a separate runtime indefinitely. [Deno announcement](https://deno.com/blog/cloudflare), [Cloudflare announcement](https://blog.cloudflare.com/deno-joins-cloudflare/). **I:** General runtime compatibility is receiving investment from the teams already owning both the primitives and the test infrastructure. The project's differentiator must be a verified session/execution/storage split, not possession of an agent that edits polyfills.

## 5. Blockers ranked by probability × damage

Scores are **E**, 1–5 likelihood × 1–5 damage to the stated hypothesis. “Damage” refers to the literal requirement, not the usefulness of a revised product.

| Rank / score | Blocker, evidence, consequence | Cheap verification and threshold |
|---|---|---|
| 1 / **25** | **Required default process behavior cannot run in a hosted isolate.** **M:** Pi bash throws; CLI exit cancels the request. Native subprocesses, OS signals/handles and blocking execution-host I/O cannot be synthesized with a JS library. | **E, 2–4 h:** run a deterministic Pi conversation with read→edit→bash→read, using explicit remote bash operations and a local fake execution service. **Pass:** output/status/streaming/cancellation match Node and no subprocess API remains on the DO path. **Fail:** “unmodified CLI/default tools” remains non-negotiable. The literal claim has already failed. |
| 2 / **20** | **Ephemeral FS masquerades as a durable workspace.** **M:** files vanished across requests; the DO sync primitive survived restart. Session/auth/settings/workspace semantics need actual persistence and scope. | **E, 4–6 h:** implement only required file operations on DO SQLite/KV, exercise append/rename/offset reads and an interrupted write. Destroy the runtime between turns; test two DO IDs. **Pass:** exact bytes/session reconstruction, no cross-session leakage, no acknowledged lost writes in 100 deterministic restart/interleave trials. **Fail:** ordinary operations require blocking async network reads or a full workspace mirror exceeding the declared budget. |
| 3 / **20** | **Hibernation is not continuation persistence.** **F/I:** storage survives eviction; JS state can disappear. Waiting on a model/tool stream is still a live operation. Node compatibility does not create a durable event machine. [Storage/lifecycle guidance](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/). | **E, 4 h:** fake model streams a tool call, disconnect/restart at each session boundary, then resume. **Pass:** exactly one committed tool effect per ID, no duplicate model/tool transcript entries, correct cancellation and final state across 100 replay points. **Fail:** preserving an in-memory loop/pending promise is required for correctness or the claimed idle behavior. |
| 4 / **16** | **Import success conceals execution-specific code loaders/threads.** **M:** current Pi closure imports at 99.1%, while default codemode execution fails; photon and undici have loader constraints. **F/M:** existing Cloudflare codemode adapter addresses part of this. | **E, 2–3 h:** use the existing portable/Cloudflare codemode adapter, text-only/image tool fixtures and a local provider SSE fixture. **Pass:** execution, abort, timeout, malformed stream and image processing all complete without runtime JS/Wasm compilation or Node worker threads. **Fail:** a required extension/plugin can only be loaded through arbitrary Node-native code or runtime module compilation. |
| 5 / **9** | **Generic compatibility growth has a weak value proposition.** **M:** many failures are flags/bundler wiring; only a small frozen test subset was exercised. **F:** Deno already publishes nearly this workflow. | **E, 3 h:** the five-case bounded grow experiment above. **Pass:** ≥4 meaningful P fixes with unchanged assertions, zero required X cases misclassified, no regression. **Fail:** most “growth” is disabling tests, copying existing adapters, or chasing unneeded OS semantics. |

No-go conclusions should be conditional and precise. Requiring a completely faithful Node process kills this layer. Requiring a headless SDK, persistent scoped workspace and explicitly remote command tools does not: the measurements and existing Pi adapters justify a short integration spike.

## Evidence retained and reproduction notes

**M.** Small results, exact smoke definitions, lockfile and scripts remain in `/tmp/split-compat/`. Key files: `popular-final-results.json`, `pi-closure-corrected-results.json`, `pi-active-all-results.json`, `pi-remediate-results.json`, `registry-cases-results.json`, `pi-assets-result.json`, `pi-active-tools-result.json`, `builtin-probes.json`, `do-persistence-probe.json`, `node24-test-cases-results.json`, `codemode-smoke-results.json`, `codemode-cloudflare-explicit-wasm.json`, `ws-node-entry-results.json`. These preserve individual errors, including causal errors and build failures. The initial codemode adapter startup failure is a harness module-registration error; the explicit-Wasm result is the corrected outcome.

`census.cjs` rebuilds a tiny Worker for each case, runs the Node baseline and dispatches one request through Miniflare. `cases.json`/`make-cases.py` define the popular smokes; dependency closure manifests and case lists define Pi imports. After reinstalling the pinned scratch lockfile with scripts/optional dependencies disabled, install the host esbuild binary explicitly, point the workerd package resolution at the supplied binary package, and set `MINIFLARE_WORKERD_PATH` to its executable. The experiments clean up their runtimes and local fixture servers. Large installed/build/source-tree artifacts were removed at the end; only this report was written to the repository.

## Five-line TL;DR

1. **M:** 37/44 popular package smokes pass; registry + ws entry wiring raises that to 39/44, with no new runtime implementation.
2. **M:** Current Pi is `@earendil-works/pi-coding-agent` 1.4.0: 115/116 valid dependency-root imports pass; default text tools work in one request.
3. **M/F:** Default bash/process execution fails; request-local FS is not durable, but DO synchronous SQLite/KV can back a scoped persistent adapter.
4. **M/F:** Node's pure-code tests expose growable gaps; Deno already has the agent/test loop, and Pi already ships a working Cloudflare codemode adapter.
5. **I:** Build the headless SDK/session/storage/execution adapters; do not promise that agent-grown polyfills can reproduce an unmodified Node CLI.

**Layer decision: GO-WITH-CHANGES. NO-GO if complete unmodified CLI/default OS behavior is mandatory.**

**Run these three verifications first:**

1. **Headless full turn, 2–4 h:** deterministic model fixture, explicit bash backend, read/edit/write + streamed command output and abort; all transcript/tool effects must match the Node oracle.
2. **Durability/replay, 4–6 h:** DO-backed required file/session operations, restart/interleave across 100 checkpoints and two sessions; zero lost acknowledged writes or duplicated tool effects.
3. **Required feature corpus, 2–3 h:** existing Cloudflare codemode adapter, provider SSE fixture and image/extension cases; every required path must either pass or have an explicit adapter—no hidden process/worker-thread/blocking-network dependency.
