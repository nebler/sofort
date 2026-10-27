# Native Sofort core — opt-in macOS HVF

A TypeScript executable compiled by **scriptc 0.4.5**, with no runtime npm
dependencies. The only package dependency is the exactly pinned compiler and
its platform package, shared by arch/jitk in `../tools/package-lock.json`.
Node is used to drive builds, canonical test clients and benchmarks; it is
not spawned by the product.

The Node product in `../executor` and `../mcp` remains canonical and unchanged.
This directory does not make native the default. Linux shard/ring execution
and the Hyperlight native-addon backend are out of scope. MCP `run` advertises
the existing schema and returns UNSUPPORTED on Mac.

## Build and run

```sh
cd arch/jitk/native
npm ci --prefix ../tools   # the arch/jitk scriptc pin (../tools/package-lock.json)
# If your npm disabled the compiler's postinstall, explicitly install its binary:
npm rebuild --prefix ../tools scriptc
../tools/node_modules/.bin/scriptc --version  # 0.4.5
node build.mjs
export JITK_VMM_BINARY=/tmp/jitk-r8/vmm-mac/jitk-vmm
export JITK_KERNEL_IMAGE=/absolute/path/to/arch/jitk/kernel/dist/kernel.bin
./dist/server                         # MCP JSON-RPC over stdio
./dist/server --http 45678            # stateless JSON Streamable HTTP, /mcp
```

The worktree does not contain a built kernel. Measurements used the identical
kernel from `/Users/noah/code/sofort/arch/jitk/kernel/dist/kernel.bin`; see
RESULTS for hashes. The default kernel path is this checkout's
`../kernel/dist/kernel.bin`. Set `JITK_MCP_CONFIG` for a config override. Default
config and resources are the canonical MCP assets, located relative to the
compiled source tree through `import.meta.url`; the binary is not yet a
relocatable standalone distribution. Preserve that tree when running it.

The hand-written MCP implementation negotiates the same versions as installed
SDK 1.32.2: 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05, 2024-10-07, with the
latest as the fallback. It implements initialize, ping, tools/list,
tools/call, resources/list, resources/read, initialized/cancelled notifications
and JSON-RPC errors. Stdio is UTF-8 newline framing; logs go to stderr. HTTP is
loopback-only with Host/Origin checks, JSON responses, notification 202,
unsupported GET/DELETE 405, header checks and a 1-MiB body bound. There are no
sessions, SSE streams or resumability. It is an unauthenticated local service.
See the [MCP transport specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
and [lifecycle](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle).

## Executor and policy

`backend.ts` launches the existing VMM with a compiled sandbox profile, a
minimal environment and separate pipes. Both validated guest READY and exact
stderr sandbox acknowledgement are required. The VMM's separate `--watchdog`
process acknowledges absolute deadlines before RUN and enforces parked
lifetimes independently of a blocked host event loop. One watchdog serves all
VMs of a backend; backend ownership is counted across pools and close awaits
watchdog reap. VM capacity remains charged through close/reap.

`pool.ts` keeps bounded parked/startup/live/disposal arrays, G1 admission below
2% idle core, bounded refill concurrency, single-use workers, background
refill on every exit, abortable acquisition, drain and close. Successful done
resolves before deferred kill, cancellation, reap and refill.

`protocol.ts` is the canonical dispatcher copied with only representation
changes: a checked-dynamic dictionary instead of a recursive Json union, and
brackets on nested error keys. Framing, duplicate keys, ASCII/scalar checks,
state/ID rules, budgets and limits are unchanged. `policy.ts` is an explicit
typed port of `executor/policy/policy.mjs`: strict envelopes and call budgets,
host validators, sticky private/untrusted labels, exact-call approval digests,
single-use grants, scoped credentials, redaction and revocation. The original
owner and VM policy assertions run against this port. The Node policy stays
the canonical owner; future rule changes need differential tests here.

MCP has a static compiled provider graph, currently only the exact canonical
`mcp/providers/demo.mjs` configuration path (math.add and kv.get/set). Other
provider modules fail explicitly rather than being substituted. The executor
itself accepts typed host callback registries and the full effects/issuer/
approval policy tested by `policy-check`. New deployed providers must be
compiled in as typed Tools; arbitrary runtime module loading is unsupported.

The guest still evaluates JavaScript in QuickJS inside jitk. Acorn in the Node
product only normalizes source forms; it is not a security gate. `code.ts`
accepts the documented async function body, optional fences and common whole
arrow functions. It does not reproduce Acorn's final-expression return,
export-default or named-function normalization. Guest binary values use the
canonical codec source embedded in `guest-source.ts`; the host uses typed
array/base64 handling. Sanitization derives from Cloudflare codemode 0.5.5;
see [LICENSE.cloudflare](LICENSE.cloudflare).

## Canonical test adapter

No product/test source outside `native/` is written. `adapt-tests.mjs` reads
canonical sources into ignored `.work/checks/`, preserving assertions. All
checks listed as native in RESULTS are compiled executables, not Node runs of
this TypeScript.

```sh
export JITK_NODE=/absolute/path/to/node   # tested v24.22.1
# The SDK is an existing test oracle, not a native package dependency:
export JITK_MCP_NODE_MODULES=/absolute/path/to/mcp/node_modules
node test.mjs
```

The MCP suite changes only its executable launcher and fixture-root location:
`process.execPath` becomes `native/dist/server`. The original `server.mjs`
argument is harmlessly ignored by the binary; --http is still recognized. All
27 checks and assertions are retained, including SDK HTTP and cleanup checks.

Executor adapter changes are explicit:

- Imports, receipts and fixture paths point into native scratch. Peer launchers
  use the real Node executable rather than recursively launching the test binary.
- Promise returns, row dictionaries, tools, providers and API tuples receive
  explicit types. Non-null annotations follow existing assertions.
- The pool Fake uses a plain record with the same lifecycle/counters instead of
  a native class through a dynamic interface (`fake-fixture.txt`).
- `assert.notEqual(s,next)` becomes `assert.ok(s!==next)`. The policy owner's
  throws helper checks the same exception class and that a throw occurred.
  Binary comparison first asserts Uint8Array, then uses the same deep equality.
- The watchdog test asserts armDeadline exists, calls it with optional chaining
  to retain its receiver, and explicitly closes the backend in finally. It still
  blocks the host event loop for 1500 ms and checks the independent 250-ms kill.
- The policy owner's data-URL import becomes a static import of the same
  assertions targeting native policy. No rule assertion is removed.
- `prepared-check` is not run: it verifies omitted Linux shard snapshot/helper/
  ring behavior. Mac executionBody behavior is exercised by VM/API/MCP checks.
- A separately identified **16/20 verify subset** excludes four unimplemented
  schema-generation/TanStack integration cases. It does not claim the full
  Node verify suite passed. `wrapper-conformance` is also not ported.

`wire-test.mjs` adds raw protocol version, ping, cancellation, exact schema and
HTTP guard checks. Tests have bounded spawns, preserve local diagnostics and
sample before killing a timeout. [SCRIPTC-GAPS.md](SCRIPTC-GAPS.md) records
failures and minimal repros. No upstream issues were filed.

## Benchmark and default cutover

```sh
export JITK_EXECUTOR_NODE_MODULES=/absolute/path/to/executor/node_modules
node prepare-node-control.mjs
/usr/bin/lockf -k /tmp/sofort-bench.lock "$JITK_NODE" benchmark.mjs
```

The Node control uses copied current source and existing installed dependencies;
only the unused Hyperlight export is excluded, exactly as in the spike. Both
arms use the same config/providers/resources, VMM, kernel, warm=2/maxLive=8.
See [RESULTS.md](RESULTS.md) for method and numbers. Native size includes its
runtime; Node size excludes JS and installed dependencies. RSS excludes VMMs,
watchdog and driver; initialize timing is not warm-pool readiness.

Before a default change: port or explicitly retire the four SDK-facing APIs and
wrapper tests; close source-normalization/provider-discovery/config parity
gaps; add broader MCP conformance and multi-client cancellation testing; package
relocatable assets and artifact identity/parking evidence; and establish
sustained capacity/long-running cleanup and quiet-host performance. The current
selector follows the Node G1 marker fallback; this is existing evidence, not a
new parking certification. `execute:false` currently still requires valid Mac
artifacts at server construction, unlike Node's disabled mode. Native rejects
extra execute properties according to the advertised schema, while Node's
handler currently ignores extras. These are remaining behavioral differences.
