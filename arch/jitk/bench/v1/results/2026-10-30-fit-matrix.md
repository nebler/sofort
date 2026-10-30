# Which executors complete the real tasks (2026-10-30)

Run `fit-matrix2`: S1, 100 samples per adapter drawn over 25 task programs (20 per task), tool latency replayed at 0, 30 s timeout. Host: Apple M4 Pro, macOS 26.6.1, Node v24.22.1, load 21 (correctness does not depend on load; no timings here). Raw data: `v1/.work/runs/fit-matrix2/` (not in git).

| adapter | T1 | T2 | T3 | T4 | T5 |
|---|---:|---:|---:|---:|---:|
| sofort-hvf-2m | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 |
| sofort-hvf-4m | 20/20 | 4/20 | 16/20 | 0/20 | 16/20 |
| hyperlight-js | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 |
| cf-dynamic-worker | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 |
| ai-sdk-code-mode | 16/20 | 20/20 | 20/20 | 20/20 | 20/20 |
| tanstack-isolated-vm | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 |
| tanstack-quickjs | 20/20 | 20/20 | 20/20 | 19/20 | 20/20 |
| node-vm | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 |

T1 issue triage, T2 CI triage, T3 CRM join, T4 OTLP rollup, T5 OpenAPI search + execute. Cells: correct / attempts.

## Why runs failed

- **ai-sdk-code-mode / t1-issue-triage**: 4× `JavaScript runtime exceeded the 32 in-flight bridge request limit.`
- **hyperlight-js / t1-issue-triage**: 20× `Error: InternalError: Host function error: Calling binary host functio`
- **hyperlight-js / t2-ci-triage**: 20× `Error: InternalError: Host function error: Calling binary host functio`
- **hyperlight-js / t3-crm-join**: 20× `Error: InternalError: Host function error: Calling binary host functio`
- **hyperlight-js / t4-otel-rollup**: 16× `Error: protocol STRUCTURE`; 4× `Error: protocol FRAME_LIMIT`
- **hyperlight-js / t5-openapi**: 20× `Error: InternalError: Host function error: Calling binary host functio`
- **sofort-hvf-2m / t1-issue-triage**: 20× `Error: InternalError: out of memory`
- **sofort-hvf-2m / t2-ci-triage**: 16× `Error: InternalError: out of memory`; 4× `Error: guest_fatal: guest stopped without a completion`
- **sofort-hvf-2m / t3-crm-join**: 20× `Error: InternalError: out of memory`
- **sofort-hvf-2m / t4-otel-rollup**: 16× `Error: protocol STRUCTURE`; 4× `Error: protocol FRAME_LIMIT`
- **sofort-hvf-2m / t5-openapi**: 20× `Error: InternalError: out of memory`
- **sofort-hvf-4m / t2-ci-triage**: 16× `Error: protocol STRUCTURE`
- **sofort-hvf-4m / t3-crm-join**: 4× `Error: InternalError: out of memory`
- **sofort-hvf-4m / t4-otel-rollup**: 16× `Error: protocol STRUCTURE`; 4× `Error: protocol FRAME_LIMIT`
- **sofort-hvf-4m / t5-openapi**: 4× `Error: InternalError: out of memory`
- **tanstack-quickjs / t4-otel-rollup**: 1× `Execution timed out`

## Causes on Sofort and Hyperlight-JS (both use the protocol dispatcher)

- `protocol STRUCTURE`: a message may hold at most 32,768 JSON values (`protocol/dispatcher.ts` LIMIT.structure). A real GitHub workflow-runs page has 38,746; an OTLP metrics page up to 212,119. This blocks T2 and T4 on every heap class.
- `protocol FRAME_LIMIT`: one reply is at most 1 MiB; one T4 page is 1.28 MiB.
- `out of memory`: glue-2m (368 KiB heap) fails every real task; glue-4m fails programs that keep several large replies in flight.
- Hyperlight-JS: its host bridge refuses replies over its virtqueue capacity (`exchange` host function error), plus the same protocol limits.

Software sandboxes (V8 isolates, QuickJS in Wasm, node:vm) completed nearly everything; Vercel's AI SDK code mode stops programs with more than 32 tool calls in flight.

## After the structure fix (`11737397`), same run settings (`fit-matrix3`)

The structure budget no longer applies to trusted host replies. Remaining failures by class:

| adapter | T1 | T2 | T3 | T4 | T5 |
|---|---:|---:|---:|---:|---:|
| sofort-hvf-2m | 0/20 (oom 20) | 0/20 (oom 16, guest 4) | 0/20 (oom 20) | 0/20 (oom 16, sandbox 4) | 0/20 (oom 20) |
| sofort-hvf-4m | 20/20 | 4/20 (oom 16) | 16/20 (oom 4) | 0/20 (oom 12, sandbox 4, guest 4) | 16/20 (oom 4) |
| hyperlight-js | 0/20 (guest 20) | 0/20 (guest 20) | 0/20 (guest 20) | 0/20 (guest 20) | 0/20 (guest 20) |

Sofort is now bound by its heap (oom) and, for one T4 page, the 1 MiB reply frame; Hyperlight-JS by the virtqueue buffer sizes of our own worker (`bench/hyperlight/worker.rs` leaves Hyperlight's defaults), which is a fairness problem in the baseline, not a Hyperlight limit.

## Hyperlight-JS with a fair configuration (`aabce2f3`)

Our worker had left Hyperlight's virtqueue transport at its defaults; with
buffers sized for 1 MiB frames, scratch able to back the full 16 MiB heap,
and a linear JSON reviver (run `hl-fit`, same settings):

| adapter | T1 | T2 | T3 | T4 | T5 |
|---|---:|---:|---:|---:|---:|
| hyperlight-js (before) | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 |
| hyperlight-js (fair) | 20/20 | 20/20 | 20/20 | 8/20 | 20/20 |

The 12 remaining failures: 8 out of memory at its 16 MiB heap (T4 programs 2
and 5), 4 the 1 MiB protocol frame (one T4 page is 1.28 MiB), which applies to
every executor using this protocol.
