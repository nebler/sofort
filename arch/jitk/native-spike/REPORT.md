# Native product feasibility spike — scriptc 0.4.5

**Verdict: the current product cannot migrate to scriptc by changing its build
and entry points. Neither the MCP server nor the executor test suite has a
working native product path.** Several binaries emit successfully and then fail
at startup or first use. Replacing zod alone would leave independent compiler,
dependency, object-representation, and native-addon blockers.

There is useful positive evidence: ordinary async executables, pipe I/O,
basic Node streams, separate signal handlers, simple zod 4 parsing/schema
conversion, and all 13 existing portable MCP native-framing checks work.

## Scope and provenance

- Branch: `spike/native-product`; source checkout started at
  `05f8720e2a761b1a8f44b80fe73b4766eefad785`.
- Mac: Apple M4 Pro, arm64, macOS 26.6.1 (25G76), 2026-10-26.
- Compiler: native npm `scriptc` **0.4.5**, pinned without a version range in
  [package.json](package.json) and [package-lock.json](package-lock.json).
- Product versions match the request. Relevant transitive versions are Ajv
  8.20.0, Sucrase 3.35.1, fast-json-patch 3.1.1, and
  `@jridgewell/gen-mapping` 0.3.13. Hono 4.13.13 and ip-address 10.7.4 are pinned
  explicitly to match the existing MCP lockfile. A version comparison against
  both product lockfiles found no differing installed transitive versions.
- Read the executor README, MCP README/RESULTS, component SCRIPTC-GAPS and parity
  notes, and the local scriptc CLI/dependency/limitation docs under
  `~/scriptc/docs/content/`. The process-option workaround below follows the
  already-established tooling pattern.
- All authored files, copied sources, build artifacts, receipts, and raw samples
  are under this directory. Product files were not edited. Source copies are
  recreated in ignored `.work/`; source hashes are recorded locally by
  `prepare.mjs`. No upstream issues were filed; no push, kvm-dev, Docker operation,
  Linux guest deployment, or production cutover was performed.
- Disk checks: 45 GiB available initially and at the final check; the compile
  harness stops below 15 GiB. No raw diagnostic/benchmark output, binary, or file
  over 1 MiB is committed.

The final commit SHA is supplied in the handoff message (`git rev-parse HEAD`),
so the report does not attempt to embed its own commit hash.

## Compile and execution matrix

“Emits” means an executable was produced; it does **not** mean the dependency or
product works. These are representative local APIs, not exhaustive package
conformance results.

| Component / entry | Emits native executable? | Execution / first blocker |
|---|---|---|
| Copied MCP `server.mjs`, unchanged | No | Default package selection refuses SDK declarations; explicit selection reaches Ajv SC2001/SC1090 and zod cycle SC1016 |
| MCP with literal provider/executor imports | No | Adds executor declaration failures; still cannot build the server |
| SDK 1.32.2 `Server` only | No | Ajv meta-schema/CommonJS inheritance plus zod `CONSTANT_CATCH` cycle |
| SDK `InitializeRequestSchema` only | Yes | Startup fails in zod `normalizeParams`: required-field deletion SC1090 |
| SDK stdio transport only | Yes | Same schema startup failure, before reading an initialize request |
| SDK Streamable HTTP transport only | No | zod cycle SC1016; fully bundled variant also hits Node HTTP constructor declarations |
| Existing `mcp/native-test.mjs` | Yes | **13/13 portable framing/validation cases pass**; macOS unsupported-run branch only, not a Linux worker test |
| Executor fake-suite TypeScript executable entry | No | ChildProcessWithoutNullStreams and browser/Workers declaration gaps |
| Executor fake-suite combined esbuild entry | No | SC9001 internal errors in lazy Fake.park / callback-containing records |
| Existing `pool-check`, esbuild JS | Yes | Runtime SC2020 calling native-class `park` through untyped backend |
| Existing `resolve-check`, esbuild JS | Yes | Startup URL[].find refusal; removing unused shard export then exposes backend-record conversion SC1101 |
| Existing `prepared-check`, esbuild JS | Yes | Startup URL[].find refusal; also relies on runtime Function construction later |
| Existing `watchdog-check`, esbuild JS | Yes | Not run unadapted: its process.execPath peer launch would run the test binary recursively |
| Executor real-backend selector entry, esbuild JS | No | SC3004 internal union-representation failure, independent of AI SDK |
| `@cloudflare/codemode` 0.5.5 public runtime import | No | `cloudflare:workers` is unsupported; canonical executor already uses vendored helpers and type-only package imports |
| `ai` 7.0.152, even a bare side-effect import | No | SC3004: `{ className: string; kind: string }` not representable in target union |
| `@tanstack/ai` 1.0.0 | No | fast-json-patch's selected TypeScript namespace import, SC1013/SC2013 |
| `@tanstack/ai-code-mode` 1.0.0 | No | Sucrase require cycle, gen-mapping interop escape, plus TanStack dependency above |
| zod 4.6.7 root/v4/v3/mini simple parse | Yes | **Pass** for the checked object/string input and invalid input control |
| zod 4.6.7 `toJSONSchema` | Yes | **Pass** for `{code:string}` |
| zod 4.6.7 `iso.datetime({offset:true})` | Yes | Runtime SC1090; optional-message parameter-shape workaround passes |
| Acorn 8.19.0 | Yes | Identifier parse passes; parsing `const x = 2` fails SC2001 in readInt's undefined initializer |
| Hyperlight addon backend | Excluded | Not installed, imported, built, or run; scriptc cannot load Node-API addons |
| Linux shard bridge | Not a supported native target | Existing local `shard-ipc.node` is another N-API dependency; no Linux integration claim |

### Existing executor suite, not substitute tests

The copied suite was bundled with the existing esbuild approach (local code
bundled, npm packages external), with only the Hyperlight export removed and the
policy import made literal. **All ten Node entries passed** against fake peers
or the real Mac jitk VM, with no network/model credentials or kvm-dev:

| Existing entry | Node control | Native esbuild entry |
|---|---|---|
| prepared-check | 14 checks pass | Emits; URL[].find startup failure |
| pool-check | All five recorded rows pass | Emits; untyped native-class method call fails |
| resolve-check | Resolve-before-kill/reap passes | Emits; URL[].find, then SC1101 in Mac-only variant |
| sandbox-check | All four ack modes pass | SC3004 compile failure |
| transport-check | All six hostile modes pass | SC3004 compile failure |
| watchdog-check | Independent deadline/reap passes | Emits; requires native peer-launch adaptation before runtime testing |
| verify | 20 checks pass, including TanStack integration | Sucrase/TanStack dependency compile failures |
| wrapper-conformance | Both Cloudflare wrappers pass | node:vm unsupported (a host-side test-fixture requirement) |
| api-check | 30 × 64 reversed calls and four edge cases pass | SC3004 compile failure |
| policy-check | 22 owner + 22 executor assertions pass | SC3004 compile failure; also has computed data-URL import |

The attempted combined executable is generated at
`.work/adapted/executor/local-tests.ts`: it sequentially imports the existing
pool, resolve, and prepared tests. It is an executable entry, not library mode.
`local-suite.mjs compile` also builds all ten entries individually to avoid one
blocker concealing the others. Assertions were not replaced or weakened.

The Node control resolves/reads the same canonical protocol/policy sources
through local copies. The copied original MCP server dynamically loads the
copied executor bundles. The literal-provider workaround is **not** used by the
measured Node server.

## Blockers and upstream-ready repros

Run the following from this directory after `npm ci --ignore-scripts` and
checking `./node_modules/.bin/scriptc --version` prints `0.4.5`:

```sh
export JITK_NODE=/tmp/jitk-09/node-real
"$JITK_NODE" probe.mjs NAME repros/FILE.ts
# For successfully emitted probes, always run separately:
"$JITK_NODE" smoke.mjs NAME
```

The harness saves complete diagnostics and run status in ignored `.work/logs/`.
Expect failing commands: these are issue repros. A build alone can conceal
deferred runtime failures. The files below are small enough to attach upstream;
dependency-level cases require the supplied lockfile. None has been filed.

| ID | Repro / command detail | Observed result and affected path |
|---|---|---|
| B1 | `repros/zod-offset.ts` | Emits, then SC1090 at zod/v4/core/util.js:350 deleting `params.message` for `{offset:boolean}`. Reproduces SDK types/stdio startup failure without MCP. |
| B2 | `repros/mcp-http.ts`, add `--npm-static=@modelcontextprotocol/sdk` | SC1016 at zod/v4/core/util.js:871, `fn[CONSTANT_CATCH]`. Transport-only dependency-level repro; basic zod `.catch` alone passes, so it is graph-sensitive. |
| B3 | `repros/ajv.ts`, add `--npm-static=ajv...` | SC2001 on draft-07 meta-schema import; SC1090 on `class Ajv extends core_1.default`. Reproduces SDK Server blocker without MCP. Small generic inheritance control passes, so this is not a blanket ban on CommonJS inheritance. |
| B4 | `repros/ai-import.ts` | One-line side-effect import reproduces SC3004 internal union failure. The compiler supplies entry location, not an offending SDK construct; no more specific internal root cause established. |
| B5 | `repros/fast-json-patch.ts` | SC2013 wrapping SC1013 at installed index.ts:15 namespace import. Reproduces TanStack failure without TanStack. |
| B6 | `repros/sucrase.ts` | SC1016 require cycle through tokenizer/readWord; SC2013 gen-mapping bundler-interop escape. Reproduces stripTypeScript failure without ai-code-mode. |
| B7 | `repros/undefined-initializer.mjs` | Emits, then SC2001 on `value=(void 0)` before a numeric assignment. Six-line reduction of Acorn readInt; `repros/acorn.ts` is the package-level confirmation. |
| B8 | `repros/set-promise.ts` | SC2009/SC1090 for Set<Promise<void>>, used by pool disposal/startup and executor dispatch tracking. |
| B9 | `repros/method-parameter.mjs` | Emits, then SC2020 calling `park` on a native class through an untyped constructor field. Reproduces esbuild pool failure. Direct simpler method control in `untyped-method.ts` passes. |
| B10 | `repros/promise-record.mjs` | Emits, then SC1101 converting backend record with a promise/callback-bearing sandbox into unknown at constructor call. Six-line reduction of resolve-check's Mac-only failure. |
| B11 | `repros/lazy-fake.mjs` | SC9001 internal errors (`dynObjLit ... func`, `dynCall ... record`) in a lazily defined fake backend with callback-bearing sandbox. Reproduces combined-suite bundling failure. |
| B12 | `repros/url-find.ts` | SC2020 for URL[].find, reached at executor prepared-helper module startup even if the shard is unused. |
| B13 | `repros/spawn-options.ts` | Emits, then `undefined is not representable in the target union` when optional cwd is passed explicitly. Existing ProcessBackend has this shape. |
| B14 | `repros/child-type.ts` | SC0001: bundled node:child_process declarations omit ChildProcessWithoutNullStreams. Product has additional absent signalCode/browser/Workers declaration surfaces. |
| B15 | `repros/signals-chained.ts` | SC0001: process.once returns void in bundled declarations. Exact chained registration used by server.mjs. Separate registrations pass. |
| B16 | `repros/dynamic-import.ts` | SC1090 for computed import specifier. Affects policy, config-selected providers, executor loading, and the policy-test data URL. Static source graph must replace discovery. |
| B17 | `repros/addon.ts` | SC2020 for createRequire of a local .node addon. Confirms unsupported native-addon boundary; actual addons explicitly excluded from execution. |
| B18 | `repros/async-library.json` with `scriptc build --lib --profile ...` | SC4004 for async ABI export. `async-executable.ts` emits and prints 42. Executable mode removes this particular blocker. |
| B19 | `repros/dynamic-function.ts` | SC2020 for runtime Function construction. This and node:vm affect host-side conformance/prepared test generation; guest JS evaluation remains in jitk and does not need a host interpreter. |

An additional product selector failure is reproduced by `experiments.mjs`'s
`.work/reduced/select-main.ts`, bundled to
`.work/adapted/executor/build/select-main.js`: calling existing selectBackend
produces SC3004 internal union diagnostics. Constructing ProcessBackend alone
and a tiny subclass-union control both pass. This bisection is at product-module
level, not a claimed smallest standalone language construct; its exact cause
remains unresolved. Do not merge it with B4 merely because both say SC3004.

The older null-union panic in
[scriptc issue #1376](https://github.com/vercel-labs/scriptc/issues/1376) remains
open and describes 0.3.6. On this pinned 0.4.5 install, bare import, object parse,
v3/mini alternatives, `.catch`, and basic JSON schema generation pass. **The old
minimal panic was not reproduced; MCP/AI compatibility is still broken for
different observed reasons.**

## Workarounds tried and their limits

1. **Executable instead of library:** async top-level execution passes, async
   library ABI still fails SC4004. Correct packaging choice, insufficient alone.
2. **Explicit npm selection:** `--npm-static=@modelcontextprotocol/sdk` and the
   recursive `...` variant get past the misleading missing-declaration gate.
   Both still fail Server compilation. SDK subpath exports advertise types, so
   the initial error is a selection/declaration-resolution barrier, not proof
   the package contains no declarations.
3. **Literal imports:** copied policy/provider/executor imports made static.
   This bounds the native graph, but hard-codes the demo provider and does not
   preserve arbitrary runtime-loaded provider modules. It exposes further
   executor errors; no working server results.
4. **Existing esbuild route:** erases type-only SDK imports and TS declaration
   barriers. Several executor binaries emit, but runtime failures remain.
   Combining the fake tests additionally exposes B11. Full npm-dependency
   bundling/tree shaking of AI, TanStack and MCP also failed: inferred-JS type
   diagnostics, Sucrase browser declarations, Ajv method overrides, and HTTP
   constructor declarations. `bundle-deps.mjs` reproduces these trials.
5. **Exclude unused addon exports:** Hyperlight is excluded throughout. A
   second Mac-only variant removes the shard export. This clears the early
   prepared-helper failure in resolve-check and reaches B10, not a passing run.
   Moving backend interfaces into a separate local type-only file clears their
   declaration dependency but exposes typed Set<Promise> and other shape limits.
6. **Optional zod message shape:** `zod-offset-workaround.ts` declares
   `{offset:boolean; message?:string}`. It compiles and parses the date correctly.
   SDK call sites would need a compatible upstream change/build patch; this
   does not clear graph-sensitive B2 or Ajv. An npm-alias 4.4.3 trial hit package
   selection metadata refusal; no claim that a zod downgrade fixes the product.
7. **Process options and signals:** `spawn-options-workaround.ts` supplies real
   cwd and invokes `/usr/bin/env -i` with literal argv/env assignments; it prints
   hello. `child-process.ts` uses narrowed pipes, write then end; round trip
   passes. `signals.ts` handles an actual SIGTERM. `streams.ts` pipes a Readable
   to a Writable and verifies both chunks. These are supported primitives.
8. **Narrow validators:** `hand-validator.ts` accepts only `{code:string}` and
   rejects a numeric code. Native execution passes; `schema-json.ts` also emits
   schema data. These demonstrate a small replacement strategy, not an MCP
   implementation or a replacement for policy/tool validators.
9. **Acorn initializer reduction:** initializing a numeric temporary to zero
   instead of undefined passes in `undefined-initializer-workaround.mjs`. It is
   not a semantics-preserving general patch to Acorn; invalid-digit cases and
   the complete parser would need differential validation. No dependency source
   was patched in the tested product graph.

The passing `delete-field.mjs` and `ajv-inheritance.cjs` files are boundary
controls: generic deletion of an absent field and simple CommonJS inheritance
work. They should not be filed as failures.

## Mac measurements

No complete native server reaches `initialize`, and no native executor passes
the existing fake tests and a real jitk execution. **Native product size,
initialize latency, and RSS are unavailable. There is no Node/native speedup
or memory-saving claim.** The successful portable native-framing test is not an
MCP server or VM executor and cannot stand in for them.

The Node control was measured after final dependency pinning, with no compiler
run from this spike overlapping the final timing run:

```sh
JITK_NODE=/tmp/jitk-09/node-real \
JITK_VMM_BINARY=/tmp/jitk-r8/vmm-mac/jitk-vmm \
JITK_KERNEL_IMAGE=/Users/noah/code/sofort/arch/jitk/kernel/dist/kernel.bin \
/usr/bin/lockf -k /tmp/sofort-bench.lock \
  /tmp/jitk-09/node-real benchmark.mjs
```

| Metric | Node control | Native product |
|---|---:|---|
| Runtime executable size | 121,832,704 bytes (116.19 MiB), excluding JS/deps | Not built |
| Spawn → first validated initialize response, median of 50 fresh processes | **153.07 ms** | No response |
| Same 50 starts, min / max | 142.23 / 293.55 ms | Unavailable |
| Server parent RSS at idle | **85,440 KiB (83.44 MiB)** | Unavailable |
| Server parent RSS after one real VM execute and refill | **85,648 KiB (83.64 MiB)** | Unavailable |
| Real VM execute | `return await math.add(1, 1)` → `{result:2, logs:[]}` | Not reached |

Node version is v24.22.1. Shipped config uses warm=2/maxLive=8 with demo providers
and real resources. Timing starts immediately before spawn, sends initialize
without waiting for a readiness banner, and ends when its JSON-RPC response is
parsed and checked. No SDK client startup is included. “Cold” means a fresh
process, not flushed filesystem caches. The application starts its throwaway
warmup asynchronously; initialize completion is **not** warm-pool readiness.

RSS is one additional server process sampled via `ps -o rss`, after a 1 s idle
settle and 250 ms after the successful execute, respectively. It excludes VMM,
watchdog and driver RSS; this is not whole-system memory accounting. The 50
latencies use the ordinary two-middle-value median. Shared-host load1 was
7.84–8.70; these are functional/indicative numbers. An earlier exploratory run
overlapped compilation and is superseded by this final run.

Artifact identities:

- VMM `/tmp/jitk-r8/vmm-mac/jitk-vmm`, SHA-256
  `af5ccbb372e00d44215cfcc9e5ec4adc9eb4f09bd38db6e01c62c30bebaf20b8`.
- Kernel override SHA-256
  `e3d774eb844f2cca9f1ba2b28c5b732c7ebc659e01dbafb0505d0d0f1d08b1f6`;
  this matches the tracked kernel marker. No kernel was rebuilt or copied into git.
- Dependency lock SHA-256
  `350b3f7cf74400e584b05dc8fb557d04b8befc9d82179d8b895ab65c6b582509`.

For scale only, emitted partial artifacts were 7,681,128 bytes for the failing
SDK stdio probe, 6,494,208 bytes for the failing Mac-only resolve test,
1,914,688 bytes for the failing pool test, and 941,176 bytes for the passing
portable MCP framing test. These contain different code and functionality;
comparing their sizes to Node as product replacements would be misleading.

## Reproduce the product attempts

```sh
cd arch/jitk/native-spike
export JITK_NODE=/tmp/jitk-09/node-real
# Install with a real Node-backed npm, not the machine's PATH node shim.
npm ci --ignore-scripts
./node_modules/.bin/scriptc --version
"$JITK_NODE" prepare.mjs
"$JITK_NODE" bundle.mjs
"$JITK_NODE" experiments.mjs

"$JITK_NODE" probe.mjs mcp .work/original/mcp/server.mjs \
  --npm-static=@modelcontextprotocol/sdk
"$JITK_NODE" probe.mjs local-types .work/adapted/executor/local-tests.ts
"$JITK_NODE" probe.mjs local-bundle .work/adapted/executor/build/local-tests.js
"$JITK_NODE" local-suite.mjs compile

"$JITK_NODE" probe.mjs mcp-framing .work/original/mcp/native-test.mjs
"$JITK_NODE" smoke.mjs mcp-framing

export JITK_VMM_BINARY=/tmp/jitk-r8/vmm-mac/jitk-vmm
export JITK_KERNEL_IMAGE=/Users/noah/code/sofort/arch/jitk/kernel/dist/kernel.bin
"$JITK_NODE" local-suite.mjs node
# benchmark invocation above; do not compile concurrently with it.
```

Absolute artifact overrides are local machine inputs, not portable defaults.
`prepare.mjs` is source preparation; it does not install packages or build jitk.
Never execute an unadapted native watchdog/transport fixture entry that assumes
`process.execPath` is Node. Compile native peer executables and change the launch
entry/argv first, or deliberately retain Node peers as a labeled test dependency.

## Recommendation and migration estimate

Keep scriptc/TypeScript as the project's intended core, but **do not announce a
native product cutover on 0.4.5**. Retain the working Node product while the
compiler blockers are addressed. Keep this bounded corpus as an upstream
acceptance suite; prioritize the small B7–B11 compiler/runtime repros and the
SDK's B1/B2/B3/B4 package repros. Waiting for just #1376 is not sufficient.

Two realistic paths, estimated for one experienced engineer (judgment, not a
measured schedule):

| Path | Estimated engineering effort | Exit condition |
|---|---|---|
| Preserve current SDKs, cooperate with upstream | 2–4 engineer-weeks of adapter/type work and parity testing **after** fixes; upstream elapsed time unknown | Full copied local suite, MCP stdio/HTTP, policy and real VM path pass natively |
| Dependency-light native core, Node SDK compatibility edge | 5–10 days for a Mac stdio/real-VM vertical slice; roughly **3–6 engineer-weeks** for a supported migration | Explicit native API, supported record/collection layouts, bounded protocol implementation, hostile/cancellation/lifecycle parity and fresh measurements |

For the second path: isolate codemode/TanStack/AI integrations at a compatibility
edge; their type-only contracts should not pull cloud/browser declaration graphs
into native core. Replace generic schema machinery only for the fixed public MCP
request shapes, preserving strict bounds, cancellations, resource confinement,
and all host policy validation. Either use a future compatible SDK or budget the
maintenance cost of a deliberately limited, validated JSON-RPC/MCP implementation.
Hand validators alone do not replace SDK protocol/version/HTTP behavior.

Normalize the native core's explicit function-body contract instead of relying
on an unverified full Acorn replacement; otherwise port and differentially test
the exact parser/normalizer subset. Use literal provider registries selected at
build time. Refactor promise tracking and callback-bearing backend records to
representations proven by native tests, and use the established typed process
helpers for spawn/cwd/env/signals. Retain real jitk confinement, watchdog,
single-use VM and policy semantics throughout.

Hyperlight can remain a separate Node comparison executable. A full Linux shard
cutover additionally needs an FFI replacement for its N-API bridge and fresh
Linux integration/lease/IPC evidence; allow another 1–2 engineer-weeks beyond the
Mac slice, with uncertainty. This spike establishes no Linux parity.

The immediate next milestone is a dependency-light native executor passing
pool/resolve, hostile transport, deadline and policy cases through a real Mac
VM. Re-run the same locked 50-start comparison only once a native product reaches
that milestone; today the numbers cannot support a migration performance case.
