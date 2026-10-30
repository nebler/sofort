# Mac conformance evidence

Run: `2026-10-30T20:08:27.696Z`. Node `v24.22.1`, `darwin/arm64`, Darwin `25.6.0`, 12 logical CPUs. Initial load averages: `[35.15576171875, 29.267578125, 22.7021484375]`.

One adapter process at a time; one execute at a time. Per-execution deadline 500 ms, outer adapter-process guard 25 seconds. Native addon built and loaded under Node 24.22.1. These timings are smoke diagnostics on a heavily loaded shared host; they are not benchmark latency estimates.

| Case | node-vm | ai-sdk-code-mode | tanstack-isolated-vm | tanstack-quickjs | hyperlight-js | cf-dynamic-worker |
| --- | --- | --- | --- | --- | --- | --- |
| plain | PASS | PASS | PASS | PASS | PASS | PASS |
| tool | PASS | PASS | PASS | PASS | PASS | PASS |
| parallel | PASS | PASS | PASS | PASS | PASS | PASS |
| error | PASS | PASS | PASS | PASS | **DIFF** | PASS |
| logs | PASS | PASS | PASS | PASS | PASS | PASS |
| 100kb | PASS | PASS | PASS | PASS | **DIFF** | PASS |
| binary | PASS | PASS | PASS | PASS | PASS | PASS |
| legacy | PASS | PASS | PASS | PASS | PASS | PASS |
| timeout | PASS | PASS | PASS | PASS | PASS | PASS |
| recovery | PASS | PASS | PASS | PASS | PASS | PASS |
| Total | 10/10 | 10/10 | 10/10 | 10/10 | 8/10 | 10/10 |

The checks compare the complete `{result, logs, error?}` shape with strict deep equality. Binary checks require a guest Uint8Array, byte preservation, guest-to-host binary arguments and a Uint8Array result. The `legacy` check uses the Executor's tool-record overload (`codemode.echo`). `recovery` follows the CPU-loop timeout in the same opened executor.

Differences are retained in [CONFORMANCE.json](CONFORMANCE.json):

- Hyperlight thrown error: actual `Error: Error: boom`; expected `boom`. Its native error text is preserved.
- Hyperlight 100 KB result: `Host response exceeds virtqueue capacity`, propagated by the existing host bridge. The failed row stays in the denominator.

Tool fan-out observed during the same `Promise.all` check:

| Adapter | Maximum simultaneous host tools |
| --- | --- |
| node-vm | 3 |
| ai-sdk-code-mode | 3 |
| tanstack-isolated-vm | 1 |
| tanstack-quickjs | 3 |
| hyperlight-js | 1 |
| cf-dynamic-worker | 3 |

TanStack isolated-vm uses upstream `applySyncPromise`; Hyperlight uses its existing synchronous bridge. Both return the right answers while serializing the host calls in this check.

Additional checks: standalone `tsc --noEmit` passed. A temporary type-assignment proof checked all six default exports against the harness agent's committed `harness/contract.ts` and passed. `node conformance.ts` runs through Node 24's native TS stripping; no runtime transpiler is required.

Local Worker Loader succeeded with `LOADER.get()`, then the actual `DynamicWorkerExecutor` `LOADER.load()` path passed all ten checks. See [README.md](README.md) for the version pins, source links, callback protocol and caveats.

The adapter source/lock hashes and selected Hyperlight artifacts are embedded per adapter in the JSON report.
