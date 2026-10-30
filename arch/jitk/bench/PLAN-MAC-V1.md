# sofort-bench v1 on the Mac: plan

Status: planned (2026-10-30). Nothing below has been measured yet unless it is
listed under "Numbers that may be quoted today".

## Where and why the Mac

The first full benchmark runs on the development Mac (Apple M4 Pro,
Hypervisor.framework). HVF runs guests on the hardware, not nested, so these
are real measurements of the macOS engine. They say nothing about Linux/KVM
performance: every row carries `virt: hvf`, and Linux claims wait for one
bare-metal ARM64 run (an AWS Graviton `.metal` spot instance, billed per
second, roughly $2–5 for one pass). Nested kvm-dev numbers are used only for
counts (faults, exits, pages restored) and memory slopes.

The Mac is shared and often loaded. Every sample records load1; the existing
gate (`bench/gate.ts`, load1 < 6) marks contended samples, which are reported
separately and never as headline numbers.

## What is measured

Sofort's public path: `MicroVMExecutor` (the `@cloudflare/codemode` Executor
and TanStack `IsolateDriver`) on the HVF engine, through the host policy, and
the same workloads through the MCP server (stdio).

## What it is compared against (same Mac, same workloads)

| Baseline | What it is | Why it is in the table |
| --- | --- | --- |
| **Hyperlight-JS** on HVF | QuickJS in a Hyperlight micro-VM (Microsoft) | Closest peer: hardware VM per run, same interpreter. Adapter exists (`bench/hyperlight/`). |
| **workerd** with the Worker Loader (fresh Dynamic Worker per run), running `@cloudflare/codemode` | V8 isolate, Cloudflare's runtime | Same Executor interface, no hardware boundary. If the loader is cloud-only, a plain fresh workerd isolate. |
| **TanStack drivers**: isolated-vm and QuickJS (Wasm) | What a TanStack AI user would pick today | Same `IsolateDriver` interface; the realistic alternatives outside Workers. |
| **QuickJS in Wasmtime** | Software isolation, same interpreter | Separates "VM boundary cost" from "interpreter cost". |
| **Native QuickJS**, new runtime per run | No isolation | Interpreter floor. |
| **Node** (plain async function, `node:vm`) | No isolation | Absolute floor; shows the cost of any boundary. |

Not on the Mac (Linux only, in the metal run): Firecracker with snapshot
restore, gVisor (`runsc`). Hosted sandboxes (E2B, Vercel Sandbox, Daytona,
Modal, Cloudflare Containers) measure a different span (API to first command
over the network); their published numbers are cited as context only, never
in the same table.

## Workloads

| Id | Workload | Checked by |
| --- | --- | --- |
| W0 | `return 2` | exact result |
| W1 | one tool call (echo) | exact result |
| W2 | ten tool calls in `Promise.all`, each answered after 5 ms | result + observed overlap |
| W3 | payload sweep: 1 / 8 / 60 KB source, 50 KB result; 512 KB on the larger heap class | exact result; OOM reported, not dropped |
| W4 | CPU-bound JS loop (Sofort is expected to lose to V8) | checksum |
| W5 | CI triage over fixtures (24 repos, one seeded regression, read-only tools, one gated write) | exact diagnosis + evidence ids; 0 forbidden tool invocations |
| W6 | read-only SQLite incident query (native profile) | exact rows; write refused; input hash unchanged |
| W7 | hostile run then canary on the same slot (spin, OOM, arena attack, engine kill) | 0 leaks over ≥ 10,000 pairs; recovery time |
| W8 | policy: private read then egress / untrusted read then write | host invocation counter = 0; approval counts |
| W9 | W1 and W5 through MCP stdio | as above |

## Metrics (per workload × baseline)

- Latency p50/p95/p99 end to end, and by phase: queue, start, first tool call,
  done, release/reset. "Answer returned" and "capacity reusable" are separate.
- Throughput at concurrency 1/8/32/64, plus an open-loop ramp (highest arrival
  rate with p99 under target and no failures).
- CPU per run (Node + engine + zygote/watchdog), memory fixed vs per run.
- Failures counted, never dropped.

Method: warm, cold-slot and cold-service cells kept apart; 50 warmups excluded;
≥ 10,000 samples × 3 repetitions for headline cells; randomized interleaved
order; raw JSONL plus a reducer that regenerates the tables; environment and
artifact hashes in every bundle.

## Prerequisites

- Policy fixes: done (`c934a045`).
- Larger JS heap class and bulk guest codec: in progress (W3, W5 depend on them).
- Harness: one driver (`executor/bench-v1.ts`), reducer, environment capture,
  reusing `onTiming` phase marks, `ShardMetrics`, the hostile fixtures and the
  existing gate/statistics code.

## Numbers that may be quoted today

- HVF engine on the M4 Pro (shared host, load 6–7): `return 2` 0.15 ms p50,
  one tool call 0.28 ms p50, 0.44 CPU-ms per run (`engine-bench.ts`,
  shard README).
- Linux, nested KVM, 4 KiB pages: per-VM memory ≈ Hyperlight
  (0.515 vs 0.495 MiB, Hyperlight ~4% lower)
  ([RESULTS-LINUX-MEMORY-2026-10-27.md](RESULTS-LINUX-MEMORY-2026-10-27.md)).

Not to be quoted: [RESULTS.md](RESULTS.md) (libkrun era), nested-KVM latency
or throughput (including the 1.6 ms and 1.5 MiB/slot ShardSet figures), and
the 81% corpus figure without "research kernel, console profile, not merged".
