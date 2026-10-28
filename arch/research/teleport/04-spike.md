# Local teleport hop chain and 100 forks

Research date: **2026-10-28**. **F** = primary-source fact; **M** = measured in this spike; **I** = inference; **E** = estimate. All timings are local wall time, not production SLOs. Only this report was written in the repository.

## Result and scope

**M — The actual chain works:** one QuickJS/Wasm continuation moved **Node → local workerd → headless Chrome → Node**, then the returned checkpoint produced **100 divergent copies**. All 18 heap/entropy chain trials, a separate fork-chain trial, and all 100 fork outputs were byte-identical to their corresponding uninterrupted Node executions. Each destination advanced the existing awaited promise; it did not rerun the program from source.

**M — Environment:** Apple M4 Pro, 24 GiB RAM, Darwin 25.6.0 arm64; Node 24.22.1, V8 13.6.233.17-node.58; local workerd 2026-10-25 from the Oct 25 archive; installed Google Chrome 156.0.8078.48 using `--headless` and a disposable profile. The browser reports `HeadlessChrome/156.0.0.0`. No accounts, npm downloads, cloud deployment, Docker action, or VM action were needed. Browser runs used the explicitly requested headless Chrome CLI, not an interactive tab.

**M — Reuse and necessary change:** read [the Oct 25 report](../portability/02-wasm.md) and the read-only archive at `~/sofort-local-evidence/portability-wasm-2026-10-25/`. Original reactor SHA-256:
`d239715db73722fecd733e0fa111626f47eafcb8067cfe189f596c42f0159df5`.
The original fails the 50 MiB allocation with `ERROR:InternalError: out of memory`. Raising only the Wasm maximum from 32 to 128 MiB still fails. Therefore I rebuilt a **copied** bridge with `JS_SetMemoryLimit(rt,128*1024*1024)` and `--max-memory=134217728`, using the archived compiler, QuickJS sources, adaptations, and other build flags. The final reactor hash is:
`980a38bfd0b1fdea70a0865c9a15fa70b46c44a3629552d3ec3711c6944e97cf`.
Every final table and the final 100-fork test uses this same rebuilt module. The earlier diagnostic trials are excluded. This establishes that the old 16 MiB setting blocks this large allocation; it does not qualify allocator accounting as a reliable hard budget.

## What state actually moved

**M — Guest program:** a counter initially 7; a mutable `results` array; a closure `add(v)` capturing the counter; a cyclic object; a live `Uint8Array` of exactly 1, 10, or 50 MiB; and an unresolved QuickJS promise whose resolver lives inside the heap. The program fills and checksums **every data byte**, then awaits four tool replies. At each reply it calls the closure, appends a result, and mutates one byte on a distinct 64 KiB data page. It finally checksums all data again and emits JSON. Patterned bytes are `i & 255`; the entropy control uses deterministic xorshift32 bytes, seed 123456789. These are actual guest allocations, not padding added to a snapshot.

**M — Chain:** initial Node execution parks on request 1; workerd replies 11 and parks on request 2; Chrome replies 22 and parks on request 3; destination Node replies 33 and parks on request 4. A comparison branch receives 44 and finishes. Forks all start from the returned Node checkpoint at request 4 and receive values 0…99. The uninterrupted comparator initializes once, supplies the same four replies, and never serializes or restores. Each fork is compared against a separately initialized, uninterrupted execution with its own final reply.

**M — Capsule:** little-endian 32-bit JSON-header length, JSON `{format, stack, pending}`, then all linear-memory bytes. The header is 98 bytes initially and 99 subsequently, including its four-byte prefix. It carries the exported `__stack_pointer` value and pending request envelope; QuickJS state and resolver objects are in memory. The identical module reconstructs its static function table and imports. Restore calls Wasm `_initialize`, grows memory, overwrites it, restores the stack global, and **does not call QuickJS `init`**. Checkpoints occur only after `eval_code`/`reply` and job draining have returned to the host. The immutable Wasm binary is preloaded at each destination and is not transferred per hop.

**F/I — This is a restricted checkpoint contract.** The Wasm specification distinguishes memories, globals, tables, and the execution stack; a memory copy is not a generic serialization of arbitrary Wasm execution. This module's quiescent boundary and static table make the measured subset workable. [WebAssembly runtime structure, accessed 2026-10-28](https://webassembly.github.io/spec/core/exec/runtime.html). Cloudflare supports imported precompiled Wasm modules, which is how the local Worker is configured. [Workers Wasm documentation, accessed 2026-10-28](https://developers.cloudflare.com/workers/runtime-apis/webassembly/).

## Measurement definitions

**M — Serialization** includes allocating and copying the entire memory into the binary envelope and encoding its small header; compression is separate. **Restore** includes parsing the header, instantiating an already compiled module, `_initialize`, memory growth/copy, and restoring the stack global. It excludes HTTP body collection and module compilation. **Useful-after-restore** runs from restore completion through replying to the pending promise and reaching the next emitted tool request. This is an upper bound on time to the first useful guest instruction, measured at an observable boundary, not an instruction-level timestamp. It includes reply evaluation and QuickJS job execution. The main three hop timings stop at the next await, before the final full-data checksum.

**M — HTTP latency** uses actual raw binary transfer on loopback. Node→workerd is source serialization plus upload, restore, useful execution, next checkpoint serialization, and a small JSON acknowledgment. Workerd→Chrome is workerd serialization plus Chrome's GET/body collection and restore-to-useful time; it excludes intentional residence/polling time before the GET. Chrome→Node includes Chrome serialization, upload, restore/useful work, receiver's next snapshot, and JSON acknowledgment. Chrome sends a separate small metadata request before the timed upload. These are application hop measurements, not identical transport-only intervals or pure one-way network latency. Compression, delta scanning, final checksum, fork work, durable writes, and owner revocation are outside these intervals.

**M — Sampling:** patterned 1 MiB has seven trials, with the first engine-cold execution excluded from warm summaries (n=6); patterned 10 and 50 MiB have n=3 each; pseudorandom 1 MiB n=3, 10/50 MiB n=1 each. Compilation/process startup is outside the measurements, though first invocation still exposes lazy engine work. Patterned 1 MiB's excluded initial HTTP times were 22.22 / 31.70 / 5.60 ms. This is a small, sequential experiment on a shared development machine, not a latency distribution study.

**M/F — Clock precision:** local workerd with inspector enabled returned advancing but integer-millisecond `performance.now()` values; a million-iteration control measured 17 ms. Table cells `<1` represent zero-valued measurements at this resolution, not zero cost. A median of 0.5 from integer samples is shown as `0–1`. Browser readings are approximately 0.1 ms quantized; Node uses its higher-resolution monotonic clock. Cloudflare documents local timers advancing during CPU work, unlike deployed timers that advance after I/O. [Workers performance/timers, updated 2026-10-27, accessed 2026-10-28](https://developers.cloudflare.com/workers/runtime-apis/performance/).

## Snapshot sizes per outgoing hop

**M — Bytes, medians where repeated.** Gzip uses Node `gzipSync`, level 9; zstd uses Node `zstdCompressSync`, level 3. Both operate on the complete envelope after the hop experiment. The transferred form in the latency tables is **raw**. Data MiB means 1,048,576 bytes.

| Data MiB / contents | Outgoing hop | Raw bytes | gzip-9 bytes | zstd-3 bytes |
| --- | --- | ---: | ---: | ---: |
| 1 / pattern | Node → workerd | 2,097,250 | 105,746 | 96,834 |
| 1 / pattern | workerd → Chrome | 2,097,251 | 105,872 | 96,940 |
| 1 / pattern | Chrome → Node | 2,097,251 | 105,858 | 96,953 |
| 10 / pattern | Node → workerd | 11,403,362 | 142,045 | 97,656 |
| 10 / pattern | workerd → Chrome | 11,403,363 | 142,163 | 97,786 |
| 10 / pattern | Chrome → Node | 11,403,363 | 142,146 | 97,803 |
| 50 / pattern | Node → workerd | 53,346,402 | 304,754 | 101,509 |
| 50 / pattern | workerd → Chrome | 53,346,403 | 304,876 | 101,634 |
| 50 / pattern | Chrome → Node | 53,346,403 | 304,860 | 101,653 |
| 1 / random | Node → workerd | 2,097,250 | 1,150,245 | 1,145,411 |
| 1 / random | workerd → Chrome | 2,097,251 | 1,150,363 | 1,145,543 |
| 1 / random | Chrome → Node | 2,097,251 | 1,150,340 | 1,145,548 |
| 10 / random | Node → workerd | 11,403,362 | 10,589,942 | 10,585,216 |
| 10 / random | workerd → Chrome | 11,403,363 | 10,590,058 | 10,585,359 |
| 10 / random | Chrome → Node | 11,403,363 | 10,590,039 | 10,585,366 |
| 50 / random | Node → workerd | 53,346,402 | 52,545,793 | 52,530,187 |
| 50 / random | workerd → Chrome | 53,346,403 | 52,545,905 | 52,530,335 |
| 50 / random | Chrome → Node | 53,346,403 | 52,545,883 | 52,530,348 |

**M/I — Heap growth is real:** raw images are 2.00, 10.875, and 50.875 MiB plus header. Patterned 50 MiB compresses to about 99 KiB zstd, but pseudorandom 50 MiB takes about **50.10 MiB zstd**. The earlier “~100 KB” parked-computer result describes a small/compressible working set, not a fixed snapshot bound. Source snapshot compression times for patterned 1/10/50 MiB were gzip 26.71/41.48/123.20 ms versus zstd 0.86/1.77/5.51 ms; pseudorandom 50 MiB was gzip 808.33 ms versus zstd 58.36 ms (single sample). These codec times are Node measurements; browser/workerd compression was not benchmarked. No compressed-transfer latency was measured.

## Per-hop times

**M — Milliseconds; medians, with observed HTTP min–max in parentheses.** Serialization belongs to the source; restore/useful execution belongs to the destination. Individual column medians need not sum to the median of the combined interval.

| Data MiB / contents (n) | Hop | Serialize | Restore | Useful after restore | HTTP hop, median (range) |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 / pattern (6) | Node → workerd | 0.14 | <1 | 0–1 | 3.65 (2.81–4.84) |
| 1 / pattern (6) | workerd → Chrome | <1 | 0.30 | 0.10 | 8.40 (6.60–16.20) |
| 1 / pattern (6) | Chrome → Node | 0.20 | 0.33 | 0.09 | 3.20 (2.90–8.50) |
| 10 / pattern (3) | Node → workerd | 1.04 | 3.00 | <1 | 36.32 (12.84–43.44) |
| 10 / pattern (3) | workerd → Chrome | 2.00 | 2.50 | 0.10 | 58.10 (42.30–263.60) |
| 10 / pattern (3) | Chrome → Node | 1.80 | 1.21 | 0.14 | 18.20 (13.90–20.70) |
| 50 / pattern (3) | Node → workerd | 5.14 | 5.00 | 2.00 | 185.60 (113.91–189.75) |
| 50 / pattern (3) | workerd → Chrome | 6.00 | 19.10 | 1.20 | 1058.20 (223.20–2940.60) |
| 50 / pattern (3) | Chrome → Node | 18.50 | 4.89 | 0.50 | 158.80 (102.30–164.90) |
| 1 / random (3) | Node → workerd | 0.19 | 1.00 | 1.00 | 4.71 (3.06–6.26) |
| 1 / random (3) | workerd → Chrome | <1 | 0.50 | 0.10 | 856.90 (7.00–1692.80) |
| 1 / random (3) | Chrome → Node | 0.20 | 0.37 | 0.08 | 3.10 (3.00–7.40) |
| 10 / random (1) | Node → workerd | 1.03 | 1.00 | 1.00 | 15.51 (15.51–15.51) |
| 10 / random (1) | workerd → Chrome | 1.00 | 1.70 | 0.10 | 95.00 (95.00–95.00) |
| 10 / random (1) | Chrome → Node | 1.70 | 2.02 | 0.11 | 18.10 (18.10–18.10) |
| 50 / random (1) | Node → workerd | 9.17 | 20.00 | 2.00 | 167.00 (167.00–167.00) |
| 50 / random (1) | workerd → Chrome | 6.00 | 60.60 | 1.80 | 296.40 (296.40–296.40) |
| 50 / random (1) | Chrome → Node | 43.20 | 6.83 | 2.06 | 218.10 (218.10–218.10) |

**M — Restore start → next useful boundary**, which includes both restore and continuation execution, was 1.00 / 0.40 / 0.41 ms for warm patterned 1 MiB, and 8.00 / 20.30 / 5.65 ms for patterned 50 MiB (workerd / Chrome / Node respectively). The pseudorandom 50 MiB single sample was 22.00 / 62.40 / 8.89 ms.

**M/I — Transport dominates the large raw-hop path here.** Patterned 50 MiB workerd→Chrome ranged 223–2,941 ms while its median restore-to-useful was 20.3 ms. Even the 1 MiB pseudorandom control had browser-transfer outliers of 857 and 1,693 ms followed by a 7 ms trial. The cause was not isolated; browser scheduling, GC, HTTP buffering, and host contention remain candidates, not findings. There is insufficient evidence to attribute the stalls to snapshot entropy or QuickJS execution. Reporting only a fast restore-copy number would materially understate observed handoff latency.

## Consecutive snapshot deltas

**M — Diff construction:** strip each envelope header first; compare aligned **4 KiB** linear-memory blocks; encode each changed block as a four-byte page index plus full block bytes. This is a snapshot scan, not dirty-page tracking. The next header would be sent separately (99 bytes including its prefix). Comparing entire envelopes without alignment is wrong: the first pending envelope grows by one byte and shifts otherwise unchanged memory. Those initial diagnostic numbers are excluded. No delta transport or delta-based restore was used in the timing/correctness experiment.

| Data MiB / contents | Changed 4 KiB blocks per hop | Raw delta bytes per hop | zstd delta bytes: Node→workerd / workerd→Chrome / Chrome→Node |
| --- | ---: | ---: | ---: |
| 1 / pattern | 22 / 22 / 22 | 90,200 / 90,200 / 90,200 | 19,849 / 18,962 / 18,528 |
| 10 / pattern | 22 / 22 / 22 | 90,200 / 90,200 / 90,200 | 19,659 / 18,783 / 18,538 |
| 50 / pattern | 22 / 22 / 22 | 90,200 / 90,200 / 90,200 | 19,661 / 18,789 / 18,542 |
| 1 / random | 22 / 22 / 22 | 90,200 / 90,200 / 90,200 | 22,153 / 23,001 / 22,697 |
| 10 / random | 22 / 22 / 22 | 90,200 / 90,200 / 90,200 | 22,080 / 22,983 / 22,687 |
| 50 / random | 22 / 22 / 22 | 90,200 / 90,200 / 90,200 | 22,085 / 22,991 / 22,695 |

**M — Gzip delta sizes** were about 19–21 KiB for patterned data and 22–23 KiB for pseudorandom data. At **64 KiB Wasm-page granularity**, Node→workerd changed five pages: 327,700 raw bytes; zstd was 33,438 / 33,471 / 33,481 bytes for patterned 1/10/50 MiB and 35,732 / 35,711 / 35,721 bytes for pseudorandom 1/10/50 MiB.

**I — Small deltas are supported for this sparse-update workload.** A ~23 KB delta versus a ~52.5 MB pseudorandom full snapshot is promising. It reflects one data-byte write plus ordinary QuickJS allocator/stack/promise churn per hop. It does not establish small deltas for bulk mutation, GC-heavy workloads, or shuffled heaps. Diff discovery still scans the full image; its cost was not separately timed. Copy-on-write fork sharing and dirty-page detection were not implemented.

## Correctness and fork behavior

**M — Example exact output**, for the 1 MiB patterned branch receiving 11,22,33,44:

```json
{"counter":117,"results":[18,40,73,117],"closure":117,"cycle":true,"bytes":1048576,"before":133693440,"after":133693550,"marks":[11,22,33,44]}
```

**M — Output SHA-256:** `9da23da9c077945dba469466ff9c76e0dc35d002b554c2e1e74a78138d2f21de`. The 50 MiB patterned output hash is `53ced0442f6a338081cd26b7e2c3393a7b1441f4ed25f2833a3a0ac4c855f3bf`; pseudorandom 50 MiB is `61ab7846a627515f8c06ecf841d4d0525c9af084816d5afc99f641af84adf469`. All comparisons were direct string equality, not hash-only comparisons. Each restored hop emitted exactly one **next** request; the pending request was not emitted again. The host deliberately supplies deterministic integer replies; this is not a real external-effect deduplication test.

**M — Final-module forks:** 100 distinct Wasm instances copied the same returned 1 MiB-data checkpoint, received different final replies, and produced 100 unique outputs. All matched separate uninterrupted executions. Sequential create/restore/finish time was **5.025 s**; median restore **0.303 ms**, median completion after restore **46.49 ms**, median per-copy total **47.00 ms** (43.62–101.86 ms observed). Completion includes the guest's full 1 MiB checksum and JSON output, so it is not a “first instruction” microbenchmark. All 100 instances were retained through the timing loop; execution was sequential, not 100 parallel CPU workers. Their logical linear memories totalled 200 MiB. The program frees local data on completion, so the final process RSS is not a parked-copy density measurement.

**M — Fork output sequence hash** (100 JSON strings joined with newline): `150ad2f7c2fd5767be64de10aa41976cd0b3b21e7cee5ad3e2eea089913db02d`. Fork 0 ends with counter 73 and results `[18,40,73,73]`; fork 99 ends with counter 172 and results `[18,40,73,172]`. Prior result history and closure state remain intact while the last reply diverges.

## Boundaries and estimates

**M — All requested local runtimes ran**, so there are no estimated substitute hop measurements. Not tested: real remote networks, cross-ISA transfer, phone/browser eviction, engine-version changes, production Cloudflare limits, hostile snapshots, authenticated capsules, real tool effects, leased ownership, full heap equality, arbitrary JS programs, or interruption inside an active Wasm/C frame. Neither an HTTP acknowledgment nor a copied resolver proves a durable exactly-once handoff.

**E — Network-only illustration, not a benchmark:** at an ideal sustained 100 Mbit/s with no RTT/protocol cost, 52.53 MB needs roughly 4.20 s; a 23 KB delta needs roughly 1.84 ms. At 10 Mbit/s these become about 42 s and 18 ms. Add codec/scan, restore, policy, persistence, and handoff time. This estimate assumes the destination already has the exact module and the correct delta base.

**I — Compute-scarcity implication:** this experiment moves CPU interpreter state and tool orchestration. It neither migrates a GPU model nor relieves HBM/KV-cache pressure. It can help place CPU glue near data or on spare browser CPU if saved remote work exceeds interpreter, transport, and ownership costs. An idle browser is an execution destination; these measurements do not demonstrate trustworthy contributed compute or net energy savings.

## Exact reproduction and retained evidence

**M — Scratch:** `/tmp/teleport-spike/`. Small TypeScript/JS/Python/config source files and result JSON are retained there; they are ephemeral and should be copied elsewhere before a system temp cleanup if long-term reruns are wanted. `prepare.py` reconstructs the copied build inputs and module from the read-only archive. `core.ts` contains the adapter/guest, `harness.ts` owns Node/HTTP/process orchestration, and `browser.js`/`worker.js` are the two other adapters. No package install is required. Node 24 executes the erasable TypeScript directly; the browser and workerd share the stripped `core.js`.

**M — Exact commands** (the final recorded main measurement used `SKIP_FORKS=1`; forks were measured in the second command):

```sh
cd /tmp/teleport-spike
python3 /tmp/teleport-spike/prepare.py
node --input-type=module - <<'JS'
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
fs.writeFileSync('/tmp/teleport-spike/core.js',
  stripTypeScriptTypes(fs.readFileSync('/tmp/teleport-spike/core.ts','utf8')));
JS
SKIP_FORKS=1 node /tmp/teleport-spike/harness.ts
RESULT_FILE=fork-run.json CASES='[{"mb":1,"entropy":"pattern","reps":1}]' \
  node /tmp/teleport-spike/harness.ts
python3 /tmp/teleport-spike/summarize.py
sh /tmp/teleport-spike/environment.sh
cat /tmp/teleport-spike/build-command.txt
```

**M — The harness launches these exact runtime commands**, with stdout/stderr redirected to scratch logs; it terminates its Chrome and workerd children in `finally`:

```sh
"$HOME/sofort-local-evidence/portability-wasm-2026-10-25/workerd/node_modules/@cloudflare/workerd-darwin-arm64/bin/workerd" \
  serve /tmp/teleport-spike/worker.capnp --inspector-addr=127.0.0.1:18744
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --headless --disable-gpu --disable-background-networking --no-first-run \
  --no-default-browser-check --user-data-dir=/tmp/teleport-spike/chrome-profile \
  http://127.0.0.1:18743/
```

**M — Ports:** workerd HTTP 18742, Node HTTP 18743, workerd inspector 18744, all loopback. These must be free. The Worker configuration embeds `worker.js`, `core.js`, and the rebuilt `qjs.wasm`. Chrome compiles the same Wasm fetched from Node. [Chrome's documented headless flag, accessed 2026-10-28](https://developer.chrome.com/docs/automation-and-testing/headless); [QuickJS engine/C embedding documentation, version 2026-06-04, accessed 2026-10-28](https://bellard.org/quickjs/quickjs.html).

| Retained scratch file | Evidence |
| --- | --- |
| `results.json` | 18 final-module chains, per-hop samples, sizes, deltas, exact outputs/hashes |
| `fork-run.json` | Separate final-module chain and all 100 fork timing samples/assertions |
| `summary.json` | Medians/ranges used in the tables; first cold patterned 1 MiB sample excluded |
| `module.json`, `original-limit.json` | Original/final module hashes and original 50 MiB failure |
| `memory-max-only-results.json` | Excluded diagnostic build: changing only Wasm max still fails at 50 MiB |
| `prepare.py`, `build-command.txt` | Complete build invocation and copied-source preparation |
| `core.ts`, `harness.ts`, `core.js`, `worker.js`, `worker.capnp`, `browser.js` | Complete runnable harness |
| `environment.sh`, `summarize.py`, `SHA256SUMS.json`, `cleanup.json` | Environment, aggregation, retained-file hashes, cleanup receipt |

**M — Cleanup:** large copied sources, Wasm binary, temporary browser profile/cache, and logs were removed after measurement. Raw snapshots were only held in RAM and never persisted. Peak observed scratch usage was 127 MiB, well under 1 GB. Only small harness sources/configs and JSON/text evidence remain. Child-process cleanup was checked by matching the dedicated profile/config paths; no task-owned Chrome/workerd process remained. The archived Oct 25 evidence was never modified.

## Five-line TL;DR

**M:** Node → workerd → headless Chrome → Node completed with real pending async state.  
**M:** 100 returned-state forks diverged and matched 100 uninterrupted reference outputs.  
**M:** Warm 1 MiB raw HTTP hop medians were 3.65 / 8.40 / 3.20 ms; browser stalls reached seconds in other cases.  
**M:** 50 MiB pseudorandom data needed ~52.53 MB zstd; sparse per-hop deltas were ~22–23 KB.  
**I:** Portable cooperative checkpoints are viable; cheap arbitrary heap movement and durable effect handoff remain unproved.

**Verdict — go-with-changes** for cooperative QuickJS/Wasm teleportation: keep the exact-module/quiescent contract, make ownership durable, and use compression/deltas when state is large.

**Three next steps:**

1. **I — Implement and test the handoff protocol:** exact module/ABI hash, authenticated envelope, pending-effect ledger, destination acceptance, and source revocation; inject failures at every acknowledgment boundary.
2. **I — Transfer and apply real deltas:** validate the base checkpoint hash, reconstruct byte-identical memory, measure scan/codec/transfer/restore together, and add bulk-mutation/GC-heavy controls.
3. **I — Repeat on a separate machine and constrained browser:** isolate the observed HTTP stalls, use more trials, and measure browser cancellation/eviction and actual CPU work saved before making placement or capacity claims.
