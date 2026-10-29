# jitk MCP server

An MCP server (official SDK) with two tools. `execute` runs code-mode
JavaScript in a fresh, pre-booted, single-use microVM through the executor's
`MicroVMExecutor`, `SandboxPool` and policy layer (`../executor`); limits,
deadlines and policy are the executor's. `run` runs a whole static program
from a prepared native profile (below). Sources: `server.mjs`, `jitk.mjs`,
`native.mjs`.

- **Tool `execute` `{code}`**: an async function body. Returns `{result, logs}` as
  `structuredContent` plus the same JSON as text. Failures set `isError` and return
  `{error: {code, message}, logs}`; code is `TIMEOUT`, `POLICY`, `LIMIT`, `SANDBOX`,
  `CANCELLED` (client cancelled the request) or `GUEST_ERROR`.
- **Guest tools**: `jitk-mcp.json` lists provider modules. Each default-exports
  `{namespace: {fn: Tool}}` in the canonical policy format (args validator, declared
  reads/egress/writes, host-only `invoke`, output validator). `providers/demo.mjs`
  ships `math.add` and an in-memory `kv.get`/`kv.set`. No approver exists over MCP,
  so calls that policy routes to approval fail closed as `POLICY`.
- **Resources**: every file under `resources/` (config `resources`) is listed and
  readable as `jitk://resources/<path relative to root>`; `..` and symlink escapes
  are rejected. The root is a plain directory, so it can be packed into the guest as is.
- **Engine**: the executor's default, the ring engine: the HVF engine on macOS
  arm64, the KVM shard on Linux (`../executor/select-backend.ts`; set
  `JITK_SHARD_BINARY` and `JITK_SHARD_SNAPSHOT`, which `make` takes from the
  jitk cache). Its limits (`Engine.limits`, ABI v11: 4,096 calls with 64 open, 1 MiB
  calls and replies, 64 KiB of tenant code, 1,024 log lines, guest timers;
  `../shard/README.md` "Limits") are what the server describes.
- **Warm pool**: `warm` sessions (default 2) are parked at startup and refilled
  whenever one is released. An `execute` therefore takes the parked path. One
  throwaway run at startup JIT-compiles the executor path; this cut the first
  client call from ~9 ms to ~5 ms. Warm parking needs the engine's G1 parking
  gate: on the HVF engine `../executor/hvf-parking-gate.ts`'s receipt for this
  engine binary and snapshot (`make -C ../executor hvf-parking-gate`; `make
  test` refreshes it); the Linux shard has none yet, so use `"warm": 0` there.
- **Transports**: stdio by default. `server.mjs --http PORT` serves stateless
  Streamable HTTP on 127.0.0.1 only, with Host checking against DNS rebinding.
  It has no authentication.

```sh
make -C arch/jitk build             # includes mcp/build: npm ci --ignore-scripts (locked SDK 1.32.2)
cd arch/jitk/mcp
$JITK_NODE server.mjs               # stdio; JITK_MCP_CONFIG=/path/config.json to override
make test                           # SDK client over stdio + raw bytes + HTTP; 26 checks
make bench                          # n=30 parked latency, MCP vs in-process
```

Measured overhead ([2026-10-24 report](../docs/results/mcp-latency-2026-10-24.md), libkrun era, n=30 parked, load1 ~4.8): MCP stdio adds 0.36–0.41 ms
p50 over the same in-process core. The full path is 1.9 / 2.1 ms p50 for return2 / one_tool.
That overhead is about 0.25 ms of pipe wake-ups plus about 0.1 ms of SDK zod validation.
The VM path costs the same inside the server. At load1 ~12.5 the overhead rose to 0.7–0.8 ms.

**Tool `run` `{tool, args?, files?}`** accepts a configured native profile,
up to 31 arguments (argv[0] is the profile name; 8192 bytes including NULs), and
up to 64 read-only files. `files` maps relative guest paths to canonical base64
strings. The total archive, including directories/index/names, is bounded to
4 MiB. Files are bound after snapshot preparation and exposed through the
existing kernel filesystem. No host path or shell command is accepted.

Successful structuredContent is:
```json
{"stdout":{"encoding":"base64","data":"AP+A"},"stderr":{"encoding":"base64","data":""},"exitCode":0,"outputLimited":false}
```
stdout/stderr preserve arbitrary bytes. A nonzero guest exitCode is a successful
completed MCP call (`isError:false`), including partial output. Combined capture
is bounded to 1 MiB; outputLimited reports short writes/capture exhaustion.
Operational errors use `{error:{code,message}}`, with UNSUPPORTED, LIMIT,
SANDBOX, TIMEOUT or CANCELLED and `isError:true`.

Backend selection is explicit:

| Host | execute | run |
|---|---|---|
| macOS arm64 | the HVF engine (`hvf ipc`) | persistent HVF engine `hvf native-worker` (`../shard/src/hvf/native.rs`), the same ring ABI R7, profiles prepared by `hvf prepare`; UNSUPPORTED without native config |
| Linux arm64 | the KVM shard (`real ipc`) | persistent shard `real native-worker`, KVM ring ABI R7 |
| Other hosts / missing native config | existing execute selection rules | UNSUPPORTED |

A Linux native-only configuration needs no prepared JS snapshot:
```json
{
  "execute": false,
  "warm": 0,
  "timeoutMs": 10000,
  "providers": [],
  "resources": "./resources",
  "native": {
    "binary": "../shard/target/release/real",
    "profiles": {"lua": "./prepared/lua", "busybox": "./prepared/busybox"}
  }
}
```
Paths resolve relative to the config. Profiles name immutable prepared snapshot
bases (each has `.mem` and `.regs`); see [ABI-R7](../shard/ABI-R7.md) for build,
prepare, framing and bounds. `execute:false` still lists execute but returns
UNSUPPORTED. With execute enabled, its warm pool and policy behavior stay the
same. Native tools are separate whole-program runs and have no JS tool grants.

The native worker persists across calls, with one reusable VM per profile and
one owner thread. It is an executor Engine (`executor/native-backend.ts`,
`NativeBackend`) running `Job{kind:'native'}` sessions; `run` goes through a
one-session pool and `NativeExecutor`, so concurrent calls wait in FIFO order
(bounded; a full queue returns LIMIT) instead of failing while busy. The run
tool's bounds come from the engine's `limits.native`. Each call's remaining
time travels with the request and the worker stops the guest at that deadline
itself (Linux: the shard's lease watchdog; macOS: a supervisor thread), so a
TIMEOUT leaves the worker serving. The worker exits with the MCP server, even
mid-run. A client cancellation returns CANCELLED at once and leaves the worker
to finish that run within its budget (queued calls wait for it), so cancelling
never costs a restart. A worker silent 1 s past its deadline is killed and the
next call starts a new one; after 5 such restarts in 60 s native calls return
SANDBOX `native engine unavailable` until the window has passed. Failure messages name a failed job, a failed (restarting) engine
or an unavailable one. It does not add per-call helper processes.

Portable validation: `$JITK_NODE native-test.mjs` (MCP input decoding) and the
executor's `native-check.ts` (the native Engine on a stand-in worker speaking the
same frames). Real SDK validation (after `../executor/run.sh build`; on the Mac
JITK_NATIVE_BINARY is the signed `hvf` engine and the profiles are HVF-prepared):
```sh
JITK_NATIVE_BINARY=/absolute/path/to/shard/target/release/real \
JITK_NATIVE_PROFILES='{"lua":"/absolute/prepared/lua"}' \
node native-linux-test.mjs
```
The integration test runs ten native calls, including binary output, status,
late-bound files, rejection cases and a deadline the worker survives, then
SIGKILLs a second server mid-run and checks that its worker exits. [RESULTS-R7-bytes](../shard/RESULTS-R7-bytes.md)
records the complete per-case native corpus and the memory ledger.
