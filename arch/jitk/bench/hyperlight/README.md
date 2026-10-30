# Hyperlight baseline (owner 09)

Benchmark-only adapter; the product backend remains jitk. `backend.ts` uses
`executor/build/backend.js` for its lifecycle, canonical protocol dispatcher and
independent per-run watchdog. Build the executor before enabling adapter tests.
`bootstrap.js` is glue for Hyperlight's synchronous host bridge. Panic=abort.

## External inputs and build

Set `HYPERLIGHT_JS_SRC` to a Hyperlight JS checkout at commit
`8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7` (repository:
https://github.com/hyperlight-dev/hyperlight-js). Its `src/hyperlight-js` and
`src/hyperlight-js-common` crates are external inputs; nothing is downloaded by
this adapter. The lockfile pins Hyperlight host 0.18.0. This HVF baseline needs
macOS/arm64, the source checkout's build prerequisites and cached Cargo crates.

Set `CARGO` and `RUSTC` to verified absolute executables from Rust nightly
2026-10-20, and make the checkout's required LLVM tools available. Never select
an unverified PATH launcher. `make build` compiles `build.ts` with the bench
package's pinned scriptc 0.4.5, then runs the native `../build/hyperlight-build`.
It stages the adapter crate beside a
symlink to `HYPERLIGHT_JS_SRC`, builds offline/locked, signs with canonical
`../../shard/hypervisor.entitlements`, then creates a tenant-free snapshot.

`HYPERLIGHT_BUILD_DIR` defaults to this directory's `build/`; output overrides
`HYPERLIGHT_WORKER` and `HYPERLIGHT_SNAPSHOT` select the worker and snapshot.
Choose a fresh snapshot destination when rebuilding. The build generates
`adapter.json` with the selected absolute paths for consumers. The shipped
unbuilt descriptor uses paths relative to its own directory.

`make -C ../.. deps` does all of the above into the jitk cache
(`../../README.md#clean-clone`): it fetches the pinned commit, runs this
builder with `HYPERLIGHT_FETCH=1` (`cargo fetch --locked` for the adapter
crate and the checkout's workspace before the offline build) and
`HYPERLIGHT_DESCRIPTOR` (the generated descriptor stays beside the cache
outputs instead of rewriting the tracked `adapter.json`). Unset
`HYPERLIGHT_JS_SRC`, `HYPERLIGHT_WORKER`, `HYPERLIGHT_SNAPSHOT` and `JITK_NODE`
select those cache entries (`HYPERLIGHT_BUILD_DIR`, when set, still selects
its own outputs). `make test` runs the adapter's checks with TypeScript
transformation enabled; missing or invalid inputs fail with setup
instructions naming `make -C arch/jitk deps`, and the test must pass all 13
checks. The only skip is on non-macOS hosts (HVF only). Existing built
artifacts can be supplied with the worker and snapshot overrides above.

## Fair configuration (2026-10-30)

Hyperlight-JS completed 0 of 100 bench v1 fit-matrix runs
(`../v1/results/2026-10-30-fit-matrix.md`). The causes were our worker and
bootstrap, not Hyperlight. After the four changes below, it completes 88/100
with the guest heap still at **16 MiB**. Every change is in `worker.rs` or
`bootstrap.js`. Hyperlight, the executor and the protocol are unchanged.

1. **Transport.** The worker left Hyperlight-JS's virtqueue transport at its
   16 KiB-per-message default. A guest reserves a host-function reply from
   the G2H pool left beside its request, so every tool reply over about
   16 KiB failed with *Host response exceeds virtqueue capacity*
   (`hyperlight-host` `sandbox/outb.rs`). The worker now sizes the transport
   through Hyperlight-JS's own `SandboxBuilder` setters for one 1 MiB v1
   frame each way (`MAX`, the limit Sofort's ring also accepts):

   | Setter | Value | Why |
   | --- | --- | --- |
   | `with_input_transport_buffer_size` / `with_output_transport_buffer_size` | 64 KiB | Fewer descriptors per message than 16 KiB |
   | `with_input_transport_pool_pages` (H2G) | 288 pages (18 × 64 KiB) | Run frame: 1 MiB + one buffer of framing slack, plus Hyperlight-JS's control spare |
   | `with_output_transport_pool_pages` (G2H) | 1057 pages (1 + 66 × 64 KiB) | Small-buffer page, then request and reply side by side, each a frame as a JSON string (change 2): at most 2 MiB + slack |

   Hyperlight-JS derives the descriptor counts from these. Through the bench
   adapter, a 1,040,000-byte host reply, guest call argument and guest result
   all pass. Run code stops at the protocol's 64 KiB code limit, as it does
   for Sofort.
2. **Bridge encoding.** Each frame now crosses `jitk.exchange` as one JSON
   string, and `bootstrap.js` `JSON.parse`s replies. Hyperlight-JS converts
   any other host-function value node by node through serde and rquickjs.
   A 318 KB reply of 7000 objects took 309–517 ms that way and 27–42 ms as
   a string, measured with the worker driven directly.
3. **Scratch.** A restored guest takes a scratch page for every heap page it
   writes (copy-on-write and zero-init faults in `hyperlight-guest-bin`). So
   the old 16 MiB scratch could never back the whole 16 MiB heap, and the
   pools above would have shrunk it further: the guest aborted with *Out of
   physical memory*. Scratch is now heap + pools + the earlier 16 MiB for
   stack, page tables and runtime, rounded up to a MiB because the macOS host
   maps 16 KiB pages: **38 MiB**.
4. **JSON reviver.** The executor's embedded codec revives every tool result
   with `JSON.parse(text, reviver)` (`executor/codec.mjs`; Sofort's prepared
   helpers revive in place instead). In Hyperlight-JS's QuickJS that path is
   quadratic: 7000 objects took 20.4 s against 49 ms without a reviver.
   `bootstrap.js` gives tenant code a `JSON` whose `parse` walks in the
   spec's order (InternalizeJSONProperty), 118 ms for the same input. The
   global `JSON` is untouched.

Two reporting fixes go with these. A guest abort (Hyperlight-JS aborts on
allocation failure where QuickJS would throw) now ends the run with a `done`
error instead of exiting the worker. Allocation failures are named *out of
memory*, so the harness classifies them as `oom` and not as `protocol EOF`.
The bench adapter also reports a thrown error's message (`boom`) as the other
adapters do (`../v1/adapters/README.md`).

Fit matrix, S1, 20 runs per task, timeout 30 s
(`../v1/.work/runs/hl-fit*`, local):

| Worker | T1 | T2 | T3 | T4 | T5 | Total |
| --- | --: | --: | --: | --: | --: | --: |
| Before (`../v1/results/2026-10-30-fit-matrix.md`) | 0 | 0 | 0 | 0 | 0 | 0 |
| Change 1 only | 20 | 16 | 20 | 0 | 20 | 76 |
| Changes 1 and 3, abort reporting | 20 | 16 | 20 | 0 | 20 | 76 |
| All (current) | 20 | 20 | 20 | 8 | 20 | 88 |

Change 3 converted scratch exhaustion into honest heap OOMs at the same
count. The 12 remaining failures are the 16 MiB heap (T4 programs 2 and 5:
8× `oom`, as `../v1/tasks/README.md` predicts) and the 1 MiB protocol frame
(T4 program 3, a 1.28 MiB reply: 4× `FRAME_LIMIT`, the same for every
protocol executor). A diagnostic 64 MiB-heap build passed the T2 program that
ran out of memory, which confirms the heap as that cause; it was not kept.
`provenance.json` `transport_rebuild` records the inputs, worker and snapshot
of the current build (`make -C arch/jitk deps`; the snapshot carries the
layout, so it is rebuilt with the worker). Its older blocks remain the round-2
receipt for the earlier worker.

## Benchmark

`/usr/bin/lockf -k /tmp/sofort-bench.lock ../build/hyperlight-bench 30 --output PATH` imports `../controller.ts` for load gates,
workers, result validation, aggregate watchdog and reports. It adds strict
prespawned Hyperlight and the exact Date.now 50 ms case. `Suite.sample` and
`memory_sample` remain reusable. Gate defaults: load1 <6, budget 0.1 s/sample;
timeouts are recorded as contention. This round makes no new timing claim.

Jitk uses the HVF engine (`JITK_SHARD_BINARY`, deps cache) and
`../../kernel/dist/kernel.bin` (or `JITK_KERNEL_IMAGE` / owner 06's
`JITK_IMAGE`): the raw rows run the console kernel under `hvf console --image`
(32 MiB, jitk.sb for the image directory, host sandbox acknowledgement), the
executor rows the ring engine (`JITK_SHARD_SNAPSHOT`), the executor's
default. The recorded results predate both and are libkrun's. The adapter (`backend.ts`) shares the executor's process backend,
whose watchdog is the engine binary's `process-watchdog` mode.

Cold begins before process spawn; parked begins before RUN after READY +5 ms.
Each strict unit is consumed once, killed and reaped. Refill/snapshot restore
stay outside parked latency. Logical clones share a hardware VM and include
clone creation in request latency. Memory uses macOS process footprint/RSS at
READY, excluding HVF kernel allocations. See `INTEGRATION.md` and the historical
`results/` receipts for measured selections and their load limits.

The benchmark and analysis controllers are compiled with `make -C .. build`; see
[the canonical harness](../README.md#typescript-implementation) for entrypoints
and parity evidence. Run collection under `/usr/bin/lockf -k /tmp/sofort-bench.lock`.
