# jitk MCP server

MCP clients talk directly to jitk: each `execute` call runs code-mode JavaScript in a
fresh, pre-booted, single-use microVM through the canonical `MicroVMExecutor`,
`SandboxPool` and 07 policy layer (`../executor`). No limit, deadline or policy
logic lives here; this subtree only maps MCP to the executor (`jitk.mjs`, `server.mjs`).

- **Tool `execute` `{code}`**: an async function body. Returns `{result, logs}` as
  `structuredContent` plus the same JSON as text. Failures set `isError` and return
  `{error: {code, message}, logs}`; code is `TIMEOUT`, `POLICY`, `LIMIT`, `SANDBOX`,
  `CANCELLED` (client cancelled the request) or `GUEST_ERROR`.
- **Guest tools**: `jitk-mcp.json` lists provider modules. Each default-exports
  `{namespace: {fn: Tool}}` in the canonical policy format (args validator, declared
  reads/egress/writes, host-only `invoke`, output validator). `providers/demo.mjs`
  ships `math.add` and an in-memory `kv.get`/`kv.set`. No approver exists over MCP,
  so calls that 07 routes to approval fail closed as `POLICY`.
- **Resources**: every file under `resources/` (config `resources`) is listed and
  readable as `jitk://resources/<path relative to root>`; `..` and symlink escapes
  are rejected. The root is a plain directory, so it can be packed into the guest as is.
- **Warm pool**: `warm` VMs (default 2) are parked at startup and refilled whenever
  any VM exits, including idle VMs reaped at the watchdog's 60 s lifetime bound. An
  `execute` therefore takes the parked path. One throwaway run at startup JIT-compiles
  the executor path; this cut the first client call from ~9 ms to ~5 ms. Warm parking needs the executor's G1
  evidence. The current `kernel/.READY` G1 wording is accepted here as 0% idle.
- **Transports**: stdio by default. `server.mjs --http PORT` serves stateless
  Streamable HTTP on 127.0.0.1 only, with Host checking against DNS rebinding.
  It has no authentication.

```sh
make -C arch/jitk build             # includes mcp/build: npm ci --ignore-scripts (locked SDK 1.32.2)
cd arch/jitk/mcp
$JITK_NODE server.mjs               # stdio; JITK_MCP_CONFIG=/path/config.json to override
make test                           # SDK client over stdio + raw bytes + HTTP; 26 checks
make bench                          # n=30 parked latency, MCP vs in-process; see RESULTS.md
```

Measured overhead (RESULTS.md, n=30 parked, load1 ~4.8): MCP stdio adds 0.36–0.41 ms
p50 over the same in-process core. The full path is 1.9 / 2.1 ms p50 for return2 / one_tool.
That overhead is about 0.25 ms of pipe wake-ups plus about 0.1 ms of SDK zod validation.
The VM path costs the same inside the server. At load1 ~12.5 the overhead rose to 0.7–0.8 ms.
