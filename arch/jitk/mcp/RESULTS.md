# MCP layer latency (parked path)

2026-10-24, macOS arm64 (this dev machine; other agents active), `make bench`
(`bench.mjs`): n=30 per row after 5 warmups. Rows are interleaved in shuffled
blocks. Before every sample, the in-process pools finish refilling and a 50 ms
gap lets the server's pool refill too. Latency runs from the call until the
validated result. Raw samples are in `bench-results.json`.

- **executor**: `MicroVMExecutor.execute` in-process with legacy fns. This is
  the shape of `bench/` executor-parked.
- **core**: `jitk.mjs` `run()` in-process with the 07-declared demo tools. This
  is exactly what the server executes.
- **mcp**: the official SDK `Client.callTool` → stdio → `server.mjs` → core.

Guest code: `return 2;` (return2) and `return await math.add(1, 1);` (one_tool).

| arm/case | n | p50 ms | p90 ms | load1 |
|---|---:|---:|---:|---:|
| executor/return2 | 30 | 1.410 | 1.688 | 4.66–4.85 |
| executor/one_tool | 30 | 1.588 | 1.955 | 4.66–4.85 |
| core/return2 | 30 | 1.506 | 1.734 | 4.66–4.85 |
| core/one_tool | 30 | 1.749 | 1.961 | 4.66–4.85 |
| mcp/return2 | 30 | 1.912 | 2.189 | 4.66–4.85 |
| mcp/one_tool | 30 | 2.106 | 2.374 | 4.66–4.85 |

**MCP − core p50: 0.41 ms (return2), 0.36 ms (one_tool).** MCP − executor: 0.50 / 0.52 ms.
Load averages: 4.96 6.45 5.67 at the start, 4.85 6.35 5.64 at the end.

The same benchmark at load1 12.3–12.8 measured MCP − core of 0.80 / 0.72 ms
(mcp p50 2.78 / 3.18 ms, p90 3.43 / 3.95 ms). Overhead grows with load because it
is mostly process wake-ups.

## Where the ~0.4 ms goes

Measured with throwaway probes, n=40, at load ~4.6. Each probe ran after a 50 ms
idle gap ("cold"), the same gap as above:

| component | cold p50 | hot p50 |
|---|---:|---:|
| SDK tools/call round trip, InMemoryTransport, no-op handler (all zod parsing, client+server) | 0.10 ms | 0.02 ms |
| same over stdio to a second Node process (adds 2 pipe hops / wake-ups) | 0.34 ms | 0.12 ms |
| raw Node↔Node pipe echo, no SDK | 0.23 ms | — |
| server-side `jitk.run` time inside the MCP handler vs in-process core | 1.51 vs 1.49 (return2), 1.76 vs 1.74 (one_tool) | — |

The VM path costs the same inside the server as in-process. The overhead is about
0.25 ms of IPC wake-ups, plus about 0.1 ms of SDK zod validation on a cold cache.
The SDK parses each tools/call request three times and each result twice. That
is internal to the SDK and is the only part a custom JSON-RPC loop could remove.
We kept the official SDK.

`bench/`'s quiet executor-parked baseline was ~2.4 / 2.9 ms. Its executor rows
are lower here because `bench/` starts a fresh adapter process per sample, and
here one long-lived process is measured.

First call: without warm-up, the first `execute` in a fresh server took 7.5–10.6 ms
because the executor path was not yet JIT-compiled. `createJitk` now runs one
throwaway `return 0` at startup. After that, the first client call takes 5.1–5.7 ms;
the rest is the SDK's own first use.
