# When does a live heap pay for itself?

Research date: **2026-10-28**. **F** = primary-source fact; **M-prior** = measurement reported in round one, not a new measurement here; **I** = inference or mathematical deduction; **E** = assumed workload, forecast, price hypothesis, or calculated scenario using assumptions. Web sources were accessed **2026-10-28**; document dates are included where available. No customer workload, willingness to pay, remote-network latency, or new runtime performance was measured for this report.

Read: [BRIEF-2](BRIEF-2.md), [original brief](BRIEF.md), the TL;DRs and verdicts of [01](01-compute.md), [02](02-history.md), [03](03-contract.md), [04](04-spike.md), and [05](05-product.md). Only this report was written; no experiments, installs, builds, accounts, deployments, or commits were needed.

## The answer

**I — A live heap wins when a small, compatible execution state is reused often, its computational prefix is costly to reconstruct, and an equally effective explicit state representation is expensive to maintain.** Long wall-clock duration and expensive LLM inputs alone do not establish that case. Correct journal replay already reuses those inputs. The relevant resource is **avoidable reconstruction**, not the original cost of acquiring everything the program has seen.

**I/E — Ranked opportunities:** (1) seeded-state testing of opaque/generated sandbox programs, (2) generated agent programs with costly local prefixes and repeated forks or genuine host changes, (3) reproduction and branching of faults inside an already embedded sandbox. These are conditional winners over entry replay, with engineering or investigation value over JSON. None is yet a demonstrated customer win over its strongest baseline. Prove **seeded-state testing** next: its benefit is measurable without real external writes, production migration, or an inference-savings story.

## 1. What round one actually calibrates

All observations in this table are **M-prior**, from [04-spike.md](04-spike.md). MB below means decimal bytes; MiB means 1,048,576 bytes.

| Observation | Model input | What it does not establish |
| --- | --- | --- |
| A 1 MiB guest data allocation produced a 2,097,250-byte capsule. | Raw heap image `H ≈ 2 MiB`, including interpreter/runtime allocation. | Heap size equals application payload size. |
| Patterned data compressed to 96,834 bytes with zstd-3. | A favorable small-image anchor: `S ≈ 97 KB`. | Arbitrary application heaps compress this well. |
| Pseudorandom 1 MiB data compressed to 1,145,411 bytes. | An entropy control, about 11.8 times the favorable compressed size. | Compression can eliminate already compressed/encrypted data. |
| Pseudorandom 50 MiB data required 52,530,187 compressed bytes. | Large-state sensitivity must include approximately 52.5 MB, not 100 KB. | A fixed capsule-size bound. |
| Small warm restore-to-next-useful-boundary was about 0.4 ms in Chrome/Node; Node restore alone was about 0.3 ms. | `R_H ≈ 0.4 ms` as a favorable local anchor. | Remote handoff, durable storage, decompression, compilation, broker admission, or a tail-latency SLO. |
| Small serialization was about 0.14–0.20 ms; patterned source zstd compression took 0.86 ms. | Capture/codec CPU matters even when restoring is cheap. | Browser/workerd compression performance; decompression was not separately benchmarked. |
| 22 changed 4 KiB blocks produced 90,200 raw delta bytes; zstd deltas were roughly 19–23 KB. | `Δ ≈ 20 KB` for sparse changes, including engine churn. | Delta transmission/application correctness or latency; those were not implemented. |
| 100 divergent copies matched uninterrupted runs, with 200 MiB total logical linear memory. | Fork correctness in the tested subset; each copy still needs uncompressed memory. | Parallel throughput, copy-on-write, or a density result. |

**M-prior/I — The measured capture point is cooperative:** the host call has returned, the Wasm execution stack is quiescent, and a small header carries required non-memory state. The exact module is already present. A running browser, DOM, database transaction, operating-system process, model weights, and GPU KV cache are not inside this heap. Round-one raw loopback HTTP hop medians were 3.20–8.40 ms for the favorable small case, but other browser trials stalled for seconds. A 0.4 ms restore must never be relabeled a 0.4 ms migration.

**M-prior — Execution overhead is material:** [01-compute.md](01-compute.md), citing the earlier local fixtures, reports QuickJS/Wasm at 5.2–11.5 times V8 for two glue tasks and 31.1 times for a scalar recurrence. These are workload-specific ratios. The model therefore has separate cases for an application **already using QuickJS** and an application **moved into QuickJS to obtain snapshots**.

## 2. Define the same service before comparing implementations

**I — Equivalence means the same next observable behavior from the same observed inputs.** For branching, preserve the common prefix and vary only the intended future inputs. For migration, require current ownership and the same effect ledger. Otherwise “restart” can silently mean a different answer, repeated writes, different model output, or a lost resource.

**F — Strong replay already exists.** Temporal keeps workflow execution state in a worker cache and reconstructs it after eviction; ordinary cached progress does not replay the entire history on every message. Replay itself creates no additional billable Temporal Cloud Actions. [Temporal execution/cache](https://docs.temporal.io/workflow-execution), [replay billing](https://docs.temporal.io/evaluate/cloud/actions).

**F — Generated code need not become a handwritten state machine to survive approvals.** Cloudflare Code Mode aborts and reruns code on approval, returning recorded connector results; `codemode.step()` records other nondeterministic work. Call ordering and arguments must match. Restate likewise documents journaled LLM routing decisions and remote agent calls. [Code Mode, updated 2026-10-12](https://developers.cloudflare.com/agents/tools/codemode/how-it-works/), [Restate agent orchestration](https://docs.restate.dev/ai/patterns/multi-agent).

**F — Snapshotting is also an incumbent baseline.** Vercel documents experimental QuickJS snapshots, normally every 1,000 events, plus replay of the subsequent tail. Golem documents optional user-defined snapshots, generated JSON loading only when an explicit deserialization contract exists, and oplog recovery. These are existing alternatives to an independent runtime, not evidence of an empty market. [Vercel, updated 2026-09-16](https://vercel.com/docs/workflows/pricing), [Golem snapshotting](https://learn.golem.cloud/v1.6/develop/snapshotting).

### Variables

All definitions and equations in this section are **I**, unless explicitly marked otherwise. Use seconds for time and bytes for sizes in equations.

| Symbol | Meaning |
| --- | --- |
| `L` | Number of historical input/events needed to reconstruct the chosen cut. History age alone is insufficient. |
| `u_i`, `u` | CPU to re-execute local guest computation for event `i`, including dispatch and parsing; `u` is an appropriate average. It excludes externally performed work whose result is recorded. |
| `I_m` | Initialization needed by method `m`, after whatever startup/module cache that method really has. Distinguish CPU `I_m,c` and elapsed `I_m,w`. |
| `b_i`, `J` | Stored bytes of exact inputs/results and event metadata; `J = Σ b_i`. Use actual compressed transfer bytes for networking. Inputs can be content-addressed references; fetching the referenced payload still counts. |
| `p_i`, `ℓ_i` | Money and elapsed latency to obtain a new external input, such as an LLM/tool result. |
| `H`, `S`, `κ` | Allocated raw heap image, compressed capsule bytes, and compression factor `κ = S/H`. `H` can retain the allocation high-water mark and discarded data. |
| `μ`, `τ`, `g` | Rate of newly dirtied page bytes, interval since the base, and diff block size. `μ` includes page amplification, allocator activity, and GC, rather than merely user payload writes. |
| `Δ`, `β` | Compressed delta bytes; probability that the destination already holds the exact required base. A new destination normally has `β = 0`. |
| `λ`, `φ`, `q` | Resume/hop opportunities per hour, additional fork children per hour, and fraction of resume opportunities requiring reconstruction under the baseline. Relevant cold/branch rate is `n = qλ + φ`, not every awaited call. An actual move to a fresh executor usually has `q ≈ 1`. |
| `a_m` | Checkpoint writes/captures per hour, independently of restores/forks. One shared branch point may have one capture and many restores. |
| `B`, `r`, `o_m` | Effective bottleneck bandwidth in bytes/s, protocol/network delay, and method-specific broker, persistence, resource-rebinding, and admission latency. Multiple sequential transfers incur their own delays. |
| `Z`, `G` | Explicit relevant state bytes and the CPU/wall time to rebuild anything omitted from that state. JSON can also retain a worthwhile derived cache. |
| `C_m`, `R_m` | Capture CPU and restore CPU for method `m`; include compression/decompression, scanning, verification, copying, and delta application. |
| `α`, `U` | Actual guest/native execution ratio, and useful CPU after the cut. Apply `α` to CPU, never automatically to network/LLM wait time. |
| `D_m`, `V_m`, `A` | Developer hours, compatibility/maintenance cost, and number of restores/uses over which those investments are amortized. |
| `c`, `e`, `s`, `w`, `v` | Dollars per CPU-second, transferred byte, byte-month retained, write, and read; use each platform's actual meter. |

### Four reconstruction methods

`T_m` is elapsed time to useful continuation; CPU and money must be accounted for separately. Shared useful suffix work and shared original input acquisition are omitted from this comparison and added back for end-to-end results.

| Method | Reconstruction time | Additional spending and effort |
| --- | --- | --- |
| **A. Run from scratch** | `T_A = I_A,w + Σ(local execution elapsed + ℓ_i)` on the dependency path. Parallel calls contribute their critical path, not their simple sum. | CPU `I_A,c + Σu_i`; renewed external cost `Σp_i`; usually little persistence code. It is equivalent recovery only for immutable/reproducible inputs. |
| **B. Journal replay** | `T_R = r_R + o_R + I_R,w + J_fetch/B + Σu_i`, for serial replay with locally supplied recorded results. | Record exact results/order/clock/random/error outcomes; retain `J` or its blobs, pay for journal operations and replay CPU. Previously acquired LLM results cost **zero additional model calls** during correct replay. |
| **C. Explicit state/JSON** | `T_J = r_J + o_J + I_J,w + capture_J + Z/B + parse_J + G`. | Design a continuation/state representation, retain only relevant data, implement migrations, and validate rehydration. Functions/classes/closures may need identifiers and a program representation; richer binary formats and structured clone are legitimate baselines. |
| **D. Live heap** | `T_H = r_H + o_H + module_miss + C_H,w + W/B + R_H,w + tail_replay`. | `W = (1−β)S + βΔ` in the simple full-or-one-delta policy. Store bases/deltas, pin compatible builds, retain required effect/input records, authenticate images, rebind resources, and pay execution overhead if changing engines. |

**I — The journal qualification is essential.** If “replay” calls an LLM again, the attempt costs money and may diverge. That is fresh recomputation, not the strong replay baseline. A snapshot can retain an already consumed result in guest memory, but safe effects and nondeterministic delivery still need durable host records; it does not automatically eliminate the journal. New LLM calls in divergent suffixes cost the same under all methods. Prompt caching does not serialize a program continuation.

**I — A more complete hourly cost is:**

```text
K_m/hour = amortized engineering_m + compatibility/operations_m
         + c × (useful CPU_m + a_m × capture CPU_m + n × reconstruct CPU_m)
         + e × network bytes_m/hour
         + s × retained bytes_m
         + w × writes_m/hour + v × reads_m/hour
         + renewed external-input charges_m/hour
         + expected failure/reconciliation cost_m/hour.
```

Here `s` must be converted from byte-month to the desired accounting interval. Use actual operation counts: fetching a base and a delta can be two reads; a broker transaction is additional. Subtract costs common to both methods, but only after establishing they are actually shared. Price a deadline/SLO separately rather than arbitrarily treating every millisecond as a dollar benefit. Developer cost can dominate a workload whose CPU savings are worth cents.

## 3. Break-even equations and useful thresholds

### History length and repeated reconstruction

**I — Against journal replay**, approximate its fetched bytes/event as `b`, its initialization as `I`, and its other delay as `F_R`. Let `F_H` include capture, restore, broker/transport fixed delays and any tail work, but exclude payload transfer. Then:

```text
T_R = F_R + I + L × (u + b/B)
T_H = F_H + W/B

Heap beats replay when:
L > [F_H − F_R − I + W/B] / (u + b/B).
```

If inputs are already cached at the destination, use `b = 0`; if replay resumes from an existing checkpoint, replace `L` with the tail length. If useful state is still cached in a live worker, reconstruction is approximately zero: do not evict it merely to manufacture a snapshot benefit.

**E — Example:** with a 37.75 ms full-image move, cached journal inputs, replay initialization of 5 ms, and 50 microseconds of guest CPU/event, the crossover is approximately **655 events**. This deliberately favors replay by giving it no journal fetch or broker latency. A 10 Mbit/s full-image move at 107.47 ms instead needs approximately **2,050 events**. These are arithmetic scenarios, not measured Temporal/Code Mode event costs. If an explicit relevant-state restore takes 2 ms, both replay and heap can still lose to it.

**I — Frequency multiplies benefit, not per-use speed.** If savings per relevant reconstruction are `d` dollars and additional fixed operating/engineering amortization is `F` dollars/hour, require `n > F/d`, with `d > 0`. A workload that takes weeks but reconstructs once is usually less attractive than a one-second program branched thousands of times. With a sticky cache, `q = 0.01` cuts the alleged replay opportunity by 100 times.

### JSON and engineering amortization

**I — Runtime crossover:** heap beats explicit state only if

```text
(G + capture_J + parse_J + I_J + o_J)
  − (C_H + R_H + o_H + module_miss + tail_replay)
  > (W − Z)/B + (r_H − r_J).
```

JSON preserves only what matters. Its omitted data is a win unless recreating that data costs more than shipping it. Retaining derived caches in an explicit binary state is allowed; excluding that baseline would bias the result toward a heap.

**I — Total-value crossover:** let `k_H − k_J` be the per-use operational premium for heap snapshots and let `ΔD = D_J − D_H` be saved developer hours at loaded hourly rate `w_dev`. Ignoring other differences, heap wins if:

```text
w_dev × ΔD > A × (k_H − k_J) + extra compatibility/maintenance cost.
```

**E — Example:** saving 16 workload-specific engineering hours at an assumed $150/hour is $2,400. Across one million uses that supports a premium of **$0.0024/use**, before maintenance. At $0.02/million CPU-ms, even **one full extra CPU-second/use** costs only $20 across that million; maintaining two recovery implementations can overwhelm the compute bill. However, if JSON was already present, `ΔD` can be zero or negative. Do not assume a separate serializer is needed for each generated program: a reusable data-oriented program format may remove the entire effort advantage.

**I/E — Shared runtime effort is not free.** Per-workload integration estimates later assume a qualified reusable embedding. [03-contract.md](03-contract.md) estimated 15–20 engineer-days merely for a constrained local broker prototype, not a production runtime. At 8 hours/day and $150/hour that is **$18,000–$24,000** of shared effort before product hardening; five customers would absorb $3,600–$4,800 each if that were the only work amortized. A solo builder needs recurring value, not one saved serializer.

### Bandwidth, compression, deltas, and mutation

**I — Bandwidth crossover:** suppose replay has `P` more non-transfer time than heap and needs `J` bytes while heap needs `W`. Heap wins when `P > (W−J)/B`. If `W > J` and `P > 0`, this requires `B > (W−J)/P`. If `W <= J` and `P > 0`, heap wins this restricted time comparison at every positive bandwidth. A smaller journal plus cheap replay is the hostile case.

**I — Compression crossover:** compress if `t_compress + t_decompress < (H−S)/B`, including any extra copies. The measured 0.86 ms Node zstd encode is promising on ordinary networks; it does not justify omitting decode time or using the 26.71 ms gzip-9 encode as if it were free. Codec CPU must also pass the dollar test.

**I — Delta approximation:** at 4 KiB granularity,

```text
changed_raw ≈ min(H, engine_churn + μ × τ) + per-page metadata
Δ ≈ compress(changed_raw)
expected wire bytes W = (1−β)S + βΔ.
```

Repeated writes to one page need not grow a delta; GC that touches many pages can. The round-one implementation scans the entire heap to discover differences, so discovery is `O(H)` even when `Δ` is tiny. A fresh fork target has no base by default. With a 52.53 MB full image, 23 KB delta, and even **90%** base availability, expected payload is about **5.27 MB**, or **422 ms at 100 Mbit/s** before other work. With zero base availability it is 4.20 seconds of payload alone. Advertising the 1.84 ms delta payload for every new target would be wrong.

**I — Cache the base per destination, not per logical branch.** `K` children on `d` destinations can pay approximately `dS` for the shared base plus post-cut deltas, rather than `KS`, if caching is explicitly implemented. Every instantiated child still reconstructs/copies its raw `H` in this spike. Delta chains add reads, decompression/application, and dependency retention; periodically materialize a new full image. Retaining a base plus `k` deltas stores `S + ΣΔ_i`, not just `Δ_latest`.

**I — Throughput bound:** steady serial transport requires average bytes/s below `B`; for move rate `λ`, require `λW/3600 < B` with headroom for useful traffic. A continuously migrating design also needs effective dirty production slower than transfer to converge. A stop-and-copy design can pause instead, but then the pause is visible in latency. Sparse writes in the spike do not forecast bulk-array mutation workloads.

### Forking and the interpreter tax

**I — Already in the same guest engine:** for `K` total suffix branches, common-prefix CPU `P`, suffix CPU `U`, one capture `C`, and per-child reconstruction `R`, independent entry replay costs `K(P+U)`; snapshot branching costs `P+C+K(U+R)`. Heap saves CPU if `(K−1)P > C+KR`. A reusable JSON fixture or native `clone()` may share the prefix just as well.

**I — Moving a native workload into an interpreter:** if its CPU ratio is `α`, independent native runs cost `K(P+U)` while snapshot runs cost `αP+C+K(αU+R)`. Require:

```text
(K−α)P > (α−1)KU + C + KR.
```

For a CPU-only prefix, `K > α` is necessary but insufficient. **E:** at `α=6`, `K=100`, native `P=100 ms`, `U=2 ms`, and a conservative 5 ms checkpoint/reconstruction allowance per branch, independent native work is **10.2 seconds** and heap work is about **2.3 seconds**. With `U=100 ms` it becomes **20 seconds versus 61.1 seconds**: the same prefix-saving idea loses badly. These are CPU totals, not elapsed parallel completion times.

### A small calibrated latency table

**E — Model, not another benchmark.** Destination already has the exact compiled module; favorable path adds **20 ms network/protocol + 5 ms broker/storage + 5 ms small-image capture/codec/restore = 30 ms**. The 50 MiB row instead allocates **100 ms** fixed work, informed by the measured 58.36 ms random-data encode plus copies/restore and an unmeasured decode allowance. These fixed allowances are assumptions, not measured bounds or p95s. Real multi-round-trip persistence/admission can exceed them.

| Transfer form | Payload from round one | At 100 Mbit/s | At 10 Mbit/s | Implication |
| --- | ---: | ---: | ---: | --- |
| Small full image, raw | 2,097,250 B | 197.8 ms | 1,707.8 ms | Raw transfer can erase a sub-second replay advantage. |
| Small patterned full image, zstd | 96,834 B | 37.75 ms | 107.47 ms | Attractive against hundreds of ms of replay. |
| Sparse delta, hypothetical applied path | 20,000 B, rounded | 31.6 ms | 46.0 ms | Requires a correct base and an implemented delta path; fixed work dominates. |
| Small random-data full image, zstd | 1,145,411 B | 121.6 ms | 946.3 ms | Input entropy moves the crossover substantially. |
| 50 MiB random-data image, zstd | 52,530,187 B | 4,302 ms | 42,124 ms | Local clone, native checkpoint, cached data, or replay can win. |

**E/I — Bill crossover differs from latency crossover.** Workers lists a marginal **$0.02/million CPU-ms**; R2 Standard lists **$4.50/million writes**, **$0.36/million reads**, **$0.015/GB-month**, and free Internet egress. Ignore allowances/rounding only for the following gross marginal illustration. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [R2 pricing, updated 2026-10-26](https://developers.cloudflare.com/r2/pricing/).

- **E:** One million saved CPU-seconds are **$20**. One million extra R2 write/read pairs are **$4.86**. At 5 ms extra snapshot CPU, a one-write/one-read snapshot needs to avoid about **248 ms replay CPU/use** just to cover those extra operations and CPU, before retained bytes, broker work, and engineering.
- **E:** Capture once and restore 1,000 times: amortized write cost falls, but reads remain. With one read/use and 5 ms CPU/use, the comparable replay threshold is about **23.2 ms/use**. Cached local branching can remove these reads too. If JSON uses the same object operations, their common operation cost cancels.
- **E:** Retaining 100,000 favorable 96,834-byte images is 9.68 GB, about **$0.145/month** gross R2 storage. Retaining 100,000 random-data 52.53 MB images is 5,253 GB, about **$78.80/month**. Memory while running is much larger than compressed storage: 1,000 simultaneous 2 MiB copies require about **1.95 GiB** of logical linear memory before host overhead.

**I — Snapshot plus tail replay is often the optimum.** In a simplified system, taking a snapshot every `k` new events costs `C/k` CPU/event, while `q_e` reconstructions per newly committed event replay an average `k/2` events at cost `u` each. Minimize `C/k + q_e u k/2`, giving `k* = sqrt(2C/(q_e u))`. This ignores changing heap size/mutation, storage cost, and uneven replay; it explains why the strongest incumbent can be a checkpointed journal rather than either pure extreme.

### Compatibility and external state are economic terms

**I — For a byte image, compatibility is an admission constraint, not a small afterthought.** Pin module digest, ABI, imports, engine/build settings, format, host adapters, and the correct base. Refuse an incompatible image. Restore old images in retained old builds, or implement an explicit upgrade/export path. Replaying the old source with recorded inputs can be a fallback only if the journal/source/build are retained. JSON still needs semantic schema migrations; replay still needs deterministic code versioning, but neither generally depends on internal allocator layout.

**I/E — Expected restore latency:** if a fraction `p_bad` of images cannot be admitted and fallback adds `T_fallback`, expected time is `T_H + p_bad × T_fallback`, assuming the failed attempt is paid and fallback exists. At 38 ms, a 1% chance of an extra 10-second reconstruction adds 100 ms to the mean and may dominate an SLO. Without a valid fallback, this is failure probability, not a finite latency. Daily incompatible releases with 30-day parked sessions imply retaining roughly 30 runtime generations before deduplication; the exact operational cost is unmeasured.

**F/I — Existing infrastructure can preserve larger state at native speed.** Firecracker supports full VM snapshots, demand-paged memory and copy-on-write mappings, with explicit version compatibility and connection limitations. Node's startup snapshot API captures reusable startup state; AWS SnapStart captures an initialized execution environment. If the problem is only slow initialization on a compatible server, subtract that initialization benefit from the live-heap pitch. A live per-session continuation is a different cut, but native VM/container checkpointing remains a strong comparator when browsers/workerd are unnecessary. [Firecracker snapshot design](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md), [Node startup snapshots](https://nodejs.org/api/v8.html#startup-snapshot-api), [AWS SnapStart](https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html).

**I — A heap is neither the authority record nor a snapshot of the world.** As [03-contract.md](03-contract.md) specifies, keep secrets, grants, pending effects, budget, and ownership at a broker. Forks need distinct future entropy/authority. Untrusted returned heaps cannot be adopted as privileged authoritative state merely because a hash matches their uploaded bytes; trusted re-execution can consume the entire computational saving. An old heap also does not roll back a remote browser, physical actuator, or database. Charge rebinding and consistent fixtures to every candidate below.

## 4. Scan of 17 domains

### Scoring and scenario discipline

**E — Every workload size, duration, frequency, integration-hour estimate, price hypothesis, and business-size scenario below is an assumption to validate.** Linked primary sources establish the existing mechanism or pain, not these assumed customer volumes. No market survey or measured customer traces support the scoring. This is a ranking of experiments, not a list of proven businesses.

**I — Score five dimensions from 0 to 3, for a maximum of 15:**

- **R — Reconstruction benefit:** 3 = large repeated-prefix opportunity; 2 = meaningful but conditional; 1 = occasional or small; 0 = no useful saving against a competent baseline. Penalize existing cache/clone APIs.
- **J — Explicit-state friction:** 3 = opaque/generated execution state with no reusable schema established; 2 = changing custom state; 1 = manageable schema; 0 = established relevant-state format.
- **X — Execution-placement need:** 3 = an actual pre-existing continuation needs distinct supported hosts; 2 = browser/server or cross-machine artifact distribution matters; 1 = convenient; 0 = no demonstrated need. A portable task description still competes.
- **F — Fit:** 3 = already a small cooperative JS sandbox; 2 = bounded adaptation; 1 = substantial port/compatibility/performance burden; 0 = important state/runtime is outside the mechanism.
- **$ — Buyer value:** 3 = recurring engineering/investigation bottleneck; 2 = plausible product-team feature; 1 = limited standalone budget; 0 = no identified buyer. These are hypotheses, not purchase evidence.

**I — Hard gates outrank scores:** no safe capture point, an inadmissible runtime, required external state outside the heap, or a cheaper adequate JSON/native-clone solution means **reject** regardless of the sum. Broad domain names are not qualified customers. Top-ranked subsegments deliberately require an existing sandbox; applying their scores to arbitrary Node/Python workloads would be invalid.

### Numerical screening

**E — Screening convention:** `P` is avoidable CPU to reconstruct the selected prefix **after** caching recorded external results. `n` is relevant reconstructions/fork children per hour for one assumed installation. `H/S` are raw MiB / compressed decimal MB. `T_floor = 30 + 80S` ms uses 100 Mbit/s and the small-image fixed allowance; it is only an optimistic screening estimate for larger heaps, whose copies/codecs can add much more. For an unsupported runtime it is a hypothetical transport number, not a supported restore. Cached local forks avoid the network term. The model must still compare JSON rehydration, interpreter cost, and end-to-end useful work.

| Domain and qualified user | Assumed `P`; `H/S`; `n/hour` | `T_floor`; strongest alternative and why it can win | Score `R/J/X/F/$` |
| --- | --- | --- | --- |
| **1. Agent fleets:** platforms running generated async tool programs, rather than a graph whose state is already data. | 400 ms; `2/0.10`; 1,000 | 38 ms. Journal inputs and reuse a 20 KB explicit state/plan; the latter may need only about 2 ms local rehydration. Heap's edge is opaque local state and host-changing integration, not model fees. | `2/3/3/3/2 = 13` |
| **2. Long serverless jobs:** integration/ETL teams with repeated expensive local prefixes between waits. | 100 ms glue after step-result caching; `4/0.50`; 10 | 70 ms. Workflows/Temporal/Restate, or a JSON step row, already sleep cheaply. An unrecorded 60-second API call is not a 60-second replay opportunity. | `1/1/1/2/2 = 7` |
| **3. Production bug reproduction:** vendors already executing tenant logic inside the restricted sandbox. | 10,000 ms; `2/0.10`; 20 | 38 ms. Exact input journals plus a saved seed also reproduce many failures; mature record/replay tools can provide stronger inspection. Heap captures otherwise missed lexical state, but only at supported boundaries. | `2/3/2/2/3 = 12` |
| **4. Testing from seeded states:** sandbox/runtime teams exploring many future replies after one expensive setup. | 2,000 ms; `2/0.10`; 1,000 | 38 ms remotely; small local restore. JSON fixture + a reusable state schema can restore in an assumed 2 ms and beat heap CPU. Opaque generated fixtures are the qualifying friction. | `3/3/2/3/3 = 14` |
| **5. Game servers/multiplayer handoff:** room/quest-script owners. | 50 ms; `16/4`; 60 handoffs, excluding ticks | At least 350 ms. A 50 KB authoritative entity/room state with registered scripts may rehydrate in 5 ms locally. Schema deltas serve players; do not ship the whole server heap per tick. | `1/0/2/1/2 = 6` |
| **6. Simulation/Monte-Carlo branching:** event-driven policy simulators with a shared warm-up, not dense numeric kernels. | 5,000 ms; `16/8`; 1,000 | At least 670 ms remotely. Native `clone()`/OS copy-on-write or an explicit event queue/RNG state, assumed 2–10 ms locally, can share the prefix too. New QuickJS execution may dominate suffix cost. | `3/1/2/1/2 = 9` |
| **7. Notebooks/data exploration:** analysts wanting to keep a prepared kernel. | 60,000 ms if a transform is not cached; `1024/500`; 1 | Payload and fixed allowance already about 40 seconds. Persist a dataframe/Arrow/Parquet artifact and reload only needed partitions. Typical Python/native state is outside this QuickJS image. Small JS teaching notebooks are a different subsegment. | `2/1/1/0/2 = 6` |
| **8. Spreadsheets/live documents:** collaborative editor/formula-engine vendors. | 1,000 ms to rebuild a dependency cache; `16/4`; 60 | At least 350 ms. Document operations/CRDT updates plus incremental formula caches offer semantic merges and upgradeable persistence. Heap might accelerate a single-writer derived cache; it does not merge two edited heaps. | `2/0/1/1/2 = 6` |
| **9. Edge personalization:** application teams serving short requests. | 2 ms; `1/0.10`; 100,000 | 38 ms. A 200-byte profile/config reference or cached JSON is cheaper and survives deployments. Per-request state movement is slower than the reconstructed work. | `0/0/1/2/1 = 4` |
| **10. Offline-first apps:** field/collaboration vendors synchronizing devices. | 5 ms; `4/1`; 2 | 110 ms. SQLite/IndexedDB and an operation log/CRDT preserve the business data and reconcile concurrent devices; heap transport has no convergence semantics. | `0/0/2/1/1 = 4` |
| **11. Education/sandboxes:** JS playgrounds with expensive setup and resumable lessons. | 300 ms; `2/0.10`; 100 | 38 ms. A reusable startup image plus source/lesson JSON may already achieve the result. Heap helps arbitrary in-progress student code when save/branch is part of the lesson, but budgets are modest. | `1/2/2/3/1 = 9` |
| **12. Browser automation:** agent/testing orchestration vendors. | 30 ms orchestration, excluding 30 seconds of live page activity; `2/0.10`; 60 | 38 ms. Keep/reconnect the remote browser and persist task/session IDs or Playwright auth state. Restoring the JS orchestrator does not restore a browser tab or clone a logged-in session's remote effects. | `1/1/2/1/2 = 7` |
| **13. Financial backtesting:** strategy infrastructure teams branching after a warm-up. | 10,000 ms; `50/10`; 100 | At least 830 ms. Explicit indicators/positions/RNG state, assumed 0.5 MB plus 5 ms decode, can restore in about 75 ms on this network. Native engine cloning and suffix throughput are serious baselines. | `3/1/1/0/2 = 7` |
| **14. Scientific workflows:** pipeline/HPC platform teams. | 20 ms orchestration after task cache, even if tasks took hours; `8/1`; 5 | 110 ms. Cached file/object results plus pipeline resume avoid completed compute already. An in-progress native simulation needs native checkpointing, not its TypeScript dispatcher's heap. | `1/0/1/0/2 = 4` |
| **15. CI:** build/test infrastructure teams. | 40 ms dispatcher after build/dependency caches; `8/1`; 100 | 110 ms. Dependency/build artifacts and runner/VM snapshots can preserve the actual expensive work. A JS queue controller does not contain the compiler, filesystem, or test browser. | `1/0/1/0/2 = 4` |
| **16. Interactive fiction/AI NPCs:** narrative/game tooling vendors. | 5 ms story control; `2/0.10`; 30 | 38 ms. A 10 KB story/conversation/RNG save is smaller and intentionally durable across releases. Generated quest closures may qualify, but LLM dialogue results can be journaled under either design. | `0/1/2/2/1 = 6` |
| **17. Robotic/IoT controllers:** device-fleet/supervisory software teams. | 2 ms controller state rebuild; `2/0.10`; 60 | 38 ms already misses an assumed 5 ms control deadline. Device state, drivers, sensor freshness, and actuator ownership are outside the heap. Versioned commands/explicit state are preferable; detached planning simulations belong in row 6. | `0/1/1/0/1 = 3` |

### Primary evidence, payer, and rough business size for every candidate

**E — Business convention:** prices below are **monthly hypotheses for a team/application**, not observed willingness to pay or provider quotes. The ARR column is merely `100 hypothetical paying teams × monthly price × 12`; it is an attainable-wedge scenario to test, **not TAM or evidence that 100 qualified teams exist**. Rows marked “feature” should not be pursued as independent heap products on the present evidence. Developer time is valued at an assumed $150/hour consistently. For each row, the numerical pain/usage scenario is in the screening table; evidence gaps are explicit.

**I — These buyer populations overlap.** An agent platform might use seeded testing and bug reproduction in the same embedding. The ARR scenarios must not be added together or treated as independent markets.

| Domain | Sourced present behavior/pain and current baseline | Value hypothesis, payer, and 100-team scenario |
| --- | --- | --- |
| Agent fleets | **F:** Vercel warns that default-runtime histories beyond 2,000 events can replay more slowly and offers snapshots; LangGraph already checkpoints graph state. Neither establishes a need to snapshot ordinary message arrays. [Vercel](https://vercel.com/docs/workflows/pricing), [LangGraph persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence). | **E:** Runtime lead saves 4 engineering hours/month ($600), potentially paying **$250/month → $300K ARR**. CPU-only savings for the assumed trace are far smaller. Need evidence of non-data continuation state. |
| Long serverless jobs | **F:** Cloudflare Workflows charges no CPU while waiting; its documented paid CPU limit is configurable to five minutes per step. Long wall time is already supported. [Workflows pricing](https://developers.cloudflare.com/workflows/reference/pricing/), [limits](https://developers.cloudflare.com/workflows/reference/limits/). | **E:** Workflow team saves at most 1 integration hour/month on the assumed simple case; **$100/month feature → $120K ARR** only if incremental recovery work is demonstrated. Sleeping alone supports no premium. |
| Production bug repro | **F:** `rr` records exact execution for repeatable debugging; its authors report recording slowdowns as low as 1.2 times on Firefox test suites, with workload-dependent overhead. A heap cut is less capable than a complete record/replay debugger. [rr](https://rr-project.org/). | **E:** Sandbox support/runtime lead saves 10 investigation hours/month ($1,500), potentially paying **$500/month → $600K ARR**. Qualification requires bugs inside the guest and a useful inspection/branch workflow. |
| Seeded testing | **F:** Antithesis explores branching timelines and reports tens or hundreds of thousands of alternate universes in a run; it already sells this class of testing at a broader system level. This demonstrates the reuse pattern, not performance for this implementation. [Antithesis](https://antithesis.com/docs/introduction/how_antithesis_works/). | **E:** Test/runtime lead saves 8 engineering hours/month ($1,200), potentially paying **$500/month → $600K ARR**. The portable guest harness could be an embeddable feature rather than a new testing platform. |
| Games/multiplayer | **F:** Colyseus sends full room state on joining, tracks changed properties, and sends only encoded changes subsequently. Durable Objects can retain WebSocket connections while discarding/reconstructing in-memory state. [Colyseus](https://docs.colyseus.io/state), [DO hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/). | **E:** Multiplayer infrastructure lead might value 2 hours/month of avoided handoff bugs; **$200/month feature → $240K ARR**, conditional on beating the existing room schema. Generic rooms currently fail that gate. |
| Simulations/Monte-Carlo | **F:** OpenSpiel exposes state `Clone()` and serialization. Its default serialization can be an action history, and its source warns about sampled stochastic state; compare an actual clone, not merely that default replay path. [OpenSpiel source](https://github.com/google-deepmind/open_spiel/blob/master/open_spiel/spiel.h), [serialization example](https://github.com/google-deepmind/open_spiel/blob/master/docs/api_reference/game_serialize_game_and_state.md). | **E:** Simulation tools lead might save 4 porting hours/month; **$250/month feature → $300K ARR** for portable opaque JS models. Existing native clone users have little reason to switch. |
| Notebooks | **F:** Notebook JSON contains code cells, outputs, and execution counts; it does not specify a complete in-memory kernel continuation. Saving a notebook and preserving a process are different products. [Jupyter format](https://nbformat.readthedocs.io/en/latest/format_description.html). | **E:** Data-platform lead might value 2 saved setup hours/month; **$100/month feature → $120K ARR** for small supported JS notebooks. No credible Python-notebook market follows from this mechanism. |
| Spreadsheets/live docs | **F:** Yjs provides compressed state updates and missing-update synchronization, with commutative, associative, idempotent update application. That is semantic replication the heap does not provide. [Yjs updates](https://docs.yjs.dev/api/document-updates). **I:** Formula dependency caches are a separate derived-state optimization. | **E:** Editor engine lead might value 2 hours/month optimizing large derived caches; **$200/month feature → $240K ARR**. Require a single-writer cache benchmark; do not replace the document format. |
| Edge personalization | **F:** Workers bills active CPU without duration charges; its posted marginal CPU price makes tiny glue functions inexpensive. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/). **I:** Moving a heap for a small preference record adds overhead. | **E:** No incremental standalone budget identified; a speculative **$50/month feature → $60K ARR** is weaker than normal caching/config delivery. Reject pending a different workload. |
| Offline-first | **F:** Yjs state vectors allow peers to request only missing updates, including synchronization via encoded updates. [Yjs](https://docs.yjs.dev/api/document-updates). **I:** A moved heap cannot resolve independent business edits without a data-level protocol. | **E:** Local-first product lead might pay **$100/month feature → $120K ARR** for optional resumable scripting if it saves 1 hour/month; no value established for replacing the existing synchronization system. |
| Education/sandboxes | **F:** Node provides startup snapshot serialization/deserialization hooks. **I:** Shared initialized lessons are therefore a baseline distinct from student-specific live continuations. [Node startup snapshots](https://nodejs.org/api/v8.html#startup-snapshot-api). | **E:** Learning-platform lead saves 1 hour/month or ships a new save/branch interaction; **$50/month feature → $60K ARR**. Modest budgets and limited frequency weaken this wedge. |
| Browser automation | **F:** Playwright persists authentication state, including cookies/local storage/IndexedDB-based authentication, while documenting separate session-storage handling. That is useful reuse, not a full paused-browser capture. [Playwright auth](https://playwright.dev/docs/auth). | **E:** Automation lead saves 2 adapter hours/month only if live generated orchestration matters; **$200/month feature → $240K ARR**. Most browser setup cost remains unless the browser itself is reused. |
| Backtesting | **F:** QuantConnect's warm-up runs historical data through strategies/indicators; its docs warn that many assets/provider limits can make warm-up slow or time out. No 10-second average is claimed by that source. [QuantConnect warm-up](https://www.quantconnect.com/docs/v2/writing-algorithms/historical-data/warm-up-periods). | **E:** Research infrastructure lead might value 4 engineering hours/month; **$250/month feature → $300K ARR** if a supported JS model beats indicator serialization/native clone. This is infrastructure analysis, with no claim about investment returns. |
| Scientific workflows | **F:** Nextflow automatically caches task executions; resume combines cache metadata and retained work outputs. Its task hash includes code, inputs, and relevant environment information. [Nextflow/Seqera](https://docs.seqera.io/nextflow/cache-and-resume). | **E:** Pipeline lead has **$0 standalone heap value** for the assumed cached dispatcher; native in-task checkpointing may have value but is a separate product. No ARR assigned. |
| CI | **F:** GitHub Actions restores explicitly selected paths by cache keys and creates a cache after a successful miss. [GitHub dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching). **I:** Build caches and native runner snapshots preserve different state from this guest. | **E:** Build-platform lead has **$0 standalone heap value** for the assumed dispatcher. The seeded testing subsegment is already counted separately; do not double-count it as CI revenue. |
| Interactive fiction/NPCs | **F:** Ink already offers `Story.state.ToJson()` and `LoadJson()` for saved story state. [Ink runtime documentation](https://github.com/inkle/ink/blob/master/Documentation/RunningYourInk.md). **I:** An LLM NPC can likewise keep recorded dialogue/results as explicit state. | **E:** Narrative tools lead might pay **$50/month feature → $60K ARR** for arbitrary generated quest continuations if it saves an hour/month. Existing Ink save users are a poor target. |
| Robotic/IoT | **F:** ROS 2 managed nodes define explicit lifecycle states and supervisory transitions for configuring, activating, and replacing components. They do not claim that restoring memory restores the physical world. [ROS 2 lifecycle design, modified 2021-02](https://design.ros2.org/articles/node_lifecycle.html). | **E:** No incremental budget established for this heap in the assumed control loop; **$0 standalone value**. Slow supervisory JS jobs may fit the agent/workflow rows, not the real-time-controller claim. |

### A bounded proof, demo, tweet, and killing reply for each secondary candidate

**E — These are proposed 5–10 engineer-day investigations, not work performed.** Use the existing TypeScript/Wasm reactor with local Node/workerd and a browser Worker where relevant. No deployment or new account is required. Use recorded inputs and fixture services. The three leaders have fuller plans below. Each secondary proof must report useful-result equality, CPU, end-to-end latency, transfer bytes, peak raw memory, integration time, and limitations; stop early when the strong baseline wins. Tweets are draft copy, not published claims.

| Candidate | 1–2 week proof and strongest baseline | Demo / one-tweet draft / expert reply that kills it |
| --- | --- | --- |
| Long serverless jobs | Model 10,000 steps with recorded responses and several approval waits. Compare guest snapshot+tail with bounded replay and `{step, resultRefs}` JSON. Include a reusable startup image. | **Demo:** resume after killing the executor. **Tweet:** “The wait was free under both systems; we measured only reconstruction.” **Kill:** “Continue-As-New or a cached step result already removes your entire prefix.” |
| Games/multiplayer | Run a TS authoritative room with 100 entities and 60 Hz input fixtures; hand off at a tick boundary. Compare explicit entity/script state and dirty-field deltas. Keep network clients at a separate session broker. | **Demo:** continue one quest after a room move. **Tweet:** “We moved a quest continuation; player connections stayed brokered.” **Kill:** “Our existing 50 KB room save is faster, upgradeable, and reconnects clients already.” |
| Simulations/Monte-Carlo | Fork a TS discrete-event simulation after warm-up into 1,000 input streams. Compare entry replay, explicit event-queue/RNG clone, and native clone where available; run long-suffix controls. | **Demo:** branch policy decisions and compare distributions with independent runs. **Tweet:** “Shared warm-up helps only when state cloning and interpreter cost do not erase it.” **Kill:** “A native clone is faster and your suffix runs six times slower.” |
| Notebooks | Use a small JS notebook with one expensive derived index and a large-data control represented by external immutable artifacts. Compare rerun, saved index/data, and a heap. Do not claim Python compatibility. | **Demo:** close the runtime and inspect an existing closure afterward. **Tweet:** “A small JS notebook can retain live locals; large data stays in artifacts.” **Kill:** “Reloading my cached dataframe is cheaper, and this does not run my kernel.” |
| Spreadsheets/live docs | Build a TS formula DAG plus a separate document operation log. Compare rebuilding, saving the derived DAG/cache explicitly, and capturing the heap across 1,000 edits. Include concurrent edits as a rejection case. | **Demo:** resume a single-writer calculation. **Tweet:** “A continuation can cache calculation state; document merging still uses document operations.” **Kill:** “Incremental formulas plus semantic deltas already meet the latency target.” |
| Edge personalization | Replay a TS request trace with 200-byte profiles and 2 ms reconstruction; compare JSON cache lookup with full and warm-base heap movement. Sweep 10/100/1,000 Mbit/s. | **Demo:** show total request latency, including the losing heap path. **Tweet:** “Small edge profiles favor data over moved heaps in our stated workload.” **Kill:** “There is no expensive state to rebuild.” |
| Offline-first | Use two independent browser Workers editing a fixture record. Compare Yjs/operation-log synchronization with single-owner continuation handoff; explicitly test conflicting offline writes. | **Demo:** single-owner task resumes, concurrent edits still require merging. **Tweet:** “Resume and synchronization solve different problems; we tested both.” **Kill:** “You copied a task but did not solve my conflict or upgrade problem.” |
| Education | Preload one JS lesson, then pause arbitrary student code with closures; compare startup image + source/lesson JSON with student-specific heap. Measure 100 saved sessions and an update. | **Demo:** teacher branches an exercise at an awaited choice. **Tweet:** “Save the student's in-progress program, then explore two replies.” **Kill:** “The lesson state is already serializable and rebuilding takes only 10 ms.” |
| Browser automation | Run guest orchestration against a persistent fixture browser service keyed by session ID. Compare JSON task+reconnect with a guest heap; separately terminate the browser. No new browser profile is needed for the research report. | **Demo:** a moved controller reconnects to the same browser, then fails honestly if that browser is gone. **Tweet:** “The controller moved; the remote browser did not.” **Kill:** “Your claimed 30-second saving came from keeping the browser alive, which JSON does too.” |
| Backtesting | Use a small TS strategy/indicator engine with immutable recorded bars. Compare warm-up replay, explicit indicator/position/RNG state, and live heap. Sweep prefix/suffix ratios and trading-history size. | **Demo:** 100 post-warm-up strategy branches with equal outputs. **Tweet:** “We measured shared warm-up against explicit indicator saves, including suffix CPU.” **Kill:** “You forked after the changed parameter already affected the indicators, invalidating the comparison.” |
| Scientific workflows | Represent an immutable DAG and cached task-output references in TS. Compare Nextflow-style cached scheduling/JSON with heap recovery; keep a long native task outside the guest as a negative control. | **Demo:** completed tasks remain cached under both paths. **Tweet:** “We separated orchestration recovery from scientific task checkpointing.” **Kill:** “The expensive computation is outside the captured heap and was already cached.” |
| CI | Use a TS build scheduler with cached output refs. Compare JSON restart with guest capture; keep compilation/test subprocesses outside both. A runner/VM snapshot is the broader baseline, not an experiment to build in this week. | **Demo:** scheduler resumes without recompiling already cached tasks. **Tweet:** “Checkpointing a controller is not checkpointing the compiler.” **Kill:** “Your benchmark disabled the build cache or omitted subprocess state.” |
| Fiction/AI NPCs | Implement the same TS branching story as a data-oriented state machine and an async closure program. Journal all generated dialogue. Compare relevant saves with snapshots across 100 choices and a content update. | **Demo:** the same story state survives device handoff under both methods. **Tweet:** “We compared live quest code with an explicit story save, without re-buying dialogue.” **Kill:** “Ink's save format is smaller and survives our releases.” |
| Robotic/IoT | Use a virtual TS controller and recorded sensor timestamps; compare explicit supervisor state with heap restore under stale inputs and exclusive actuator claims. This tests admission/freshness, not real hardware control. | **Demo:** reject a stale controller continuation. **Tweet:** “Controller memory does not restore the physical world; we measured what must be revalidated.” **Kill:** “Reacquiring valid sensor/actuator state dominates the move and misses the deadline.” |

## 5. The top three, with numbers and falsifiable proofs

**E — Shared arithmetic assumptions:** these three illustrations use an application already in the same guest engine, a **2 MiB raw / 0.10 MB compressed** image, a 5 ms average checkpoint/reconstruction CPU allowance per branch, and immutable recorded host inputs. The size is a rounded target inspired by the favorable spike, not a measured application heap. `K` is the total suffix branches/attempts from one cut. Initial prefix construction is charged once to the snapshot path. The 5 ms allowance includes a conservative allocation for shared capture; it is an assumption rather than the 0.4 ms restore measurement. The useful suffix is charged to every branch under both methods.

| Rank and narrow domain | Assumed prefix `P`, suffix `U`, branches `K` | Entry replay CPU `K(P+U)` | Heap CPU `P+K(U+5 ms)` | Gain against entry replay | Gross CPU dollars saved/batch at Workers rate |
| --- | --- | ---: | ---: | ---: | ---: |
| **1. Seeded sandbox testing** | 2,000 ms; 20 ms; 1,000 | 2,020 s | 27.0 s | **74.8 times; 1,993 CPU-s** | **$0.03986** |
| **2. Generated agent program forks** | 400 ms; 20 ms; 100 | 42.0 s | 2.9 s | **14.5 times; 39.1 CPU-s** | **$0.000782** |
| **3. Sandbox bug reproduction/branching** | 10,000 ms; 100 ms; 20 | 202.0 s | 12.1 s | **16.7 times; 189.9 CPU-s** | **$0.003798** |

**I/E — Those ratios are aggregate CPU improvements against entry replay, not product speedups against the best alternative.** Parallel completion depends on worker/core count, memory, setup queues, and shared bottlenecks. A remote small-image handoff adds about 38 ms in the screening model, compared with the 5 ms CPU allowance; network elapsed time is not CPU time. Under serial remote branch execution and substituting 38 ms for reconstruction, the three totals would be about **60 s, 6.2 s, and 12.76 s** respectively. A 1.145 MB high-entropy image raises the 100 Mbit/s handoff model to about 122 ms; the agent replay advantage then shrinks substantially. A cached local fork avoids the payload transfer.

**I/E — Against a complete explicit fixture restoring in 2 ms**, the comparable aggregate CPU totals are **24.0 s, 2.6 s, and 12.04 s**. JSON wins CPU in all three. The business claim must therefore rest on the cost or inadequacy of producing/maintaining that complete fixture for opaque program state. Existing snapshot/fork runtimes may supply the same convenience. All three candidates fail as independent products if their state is already cheaply reified or their incumbent provides equivalent portable cuts.

### 1. Seeded-state testing of generated/opaque sandbox programs — 14/15

**I — Who hurts:** the engineer testing an embedded interpreter, generated tool program, or plugin SDK whose failure is reachable only after a long setup and many awaited replies. The same setup is needed for hundreds of future-input cases, and private lexical state is not represented in a stable public fixture. This is a smaller, credible segment than “all CI.” Antithesis's documented branching timelines validate the general testing pattern; they do not prove demand for this particular guest or its assumed two-second prefix.

**E — Value:** in the table, 1,000 branches avoid 1,993 CPU-seconds, but that is only about four cents at the quoted marginal CPU rate. At 1,000 such batches/month, gross avoided CPU is approximately **$39.86**, before storage/broker costs. Hypothesized value is instead **8 test/fixture engineering hours/month = $1,200**, plus shorter interactive iteration. A **$500/month** supported embedding has a plausible value budget if the hours are observed; 100 teams would be $600K ARR, and approximately 167 teams would be needed to reach $1M ARR at that price. Customer count and saved hours remain unvalidated.

**E — 5–10 day proof:**

1. Days 1–2: freeze a corpus of approximately 20 small programs containing closures, cycles, typed arrays, and pending awaits, with observable outputs and several naturally expensive prefixes. Include easy data-only programs where JSON should win. Use recorded inputs; measure the real prefix rather than inserting sleeps. Establish entry replay, bounded replay/explicit fixtures, and a reusable state-oriented rewrite. Record implementation time after agreeing the same behavior.
2. Days 3–5: capture each chosen await cut, restore/fork from it, vary subsequent replies, and compare outputs against uninterrupted executions. Reuse the existing reactor; keep raw buffers in memory and retained fixtures/results well below the brief's 200 MB scratch limit. Limit active fork concurrency rather than retaining 1,000 instances just to demonstrate fan-out.
3. Days 6–8: sweep history length, suffix length, random/patterned payloads, and dense/sparse mutation. Test `K = 1, 10, 100, 1,000`, local caches, and new destinations. Measure source capture, codec, host storage/broker work, full restore-to-result, and raw memory. Delta transport is an optional separately labeled experiment, not a dependency for the value proof.
4. Days 9–10: send one exact-version artifact from Node to local workerd/browser Worker, reproduce a failure after the source exits, and verify rejection of a wrong build/base. Compare the applicable incumbent snapshot mode rather than claiming novelty. This read-only fixture proof does not implement the complete production effect contract.

**I — Strongest baseline:** complete reusable JSON/binary fixtures with explicit continuation identifiers, plus an incumbent guest snapshot/fork mode where available. If testing a normal native program, include native process/VM clone rather than forcing the target into QuickJS.

**E — Go gates:** on a disclosed supported workload, obtain at least **10 times** less aggregate reconstruction CPU than recorded-input entry replay, and a material improvement against the strongest practical baseline: either **at least 4 measured integration/fixture-maintenance hours saved** across the corpus or coverage of necessary private execution state the fixture omits. Report useful suffix time and any new-engine tax. If a shared explicit schema is equally complete, quick to implement, and within 10% of relevant end-to-end performance, use it and abandon the independent heap-product claim. These thresholds are proposed decision rules.

**E — Demo:** a counter shows actual prefix executions. Seed once; choose 1,000 future replies; show divergent correct outputs and one reproducible failure at a saved cut. Next, run the same workload with complete JSON fixtures and display both integration effort and total runtime. A visible losing data-only control makes the result intelligible.

**E — One tweet, usable only after measurement:** “One expensive sandbox setup, 1,000 different futures. We compared live checkpoints with recorded-input replay and complete JSON fixtures, counting CPU, bytes, and fixture code. The win depends on opaque execution state; data-only programs use the simpler fixture.”

**I — Expert reply that kills it:** “Your complete fixture is faster, a state-oriented generator makes it automatic, and existing sandbox forks do the rest.” That is a valid kill unless the corpus and integration-time evidence show a remaining advantage.

### 2. Generated agent fleets with repeated computational prefixes — 13/15

**I — Who hurts:** a platform runtime lead whose agent emits arbitrary async programs with captured intermediate state, repeatedly branches them, or must resume an already built continuation on another supported executor. Ordinary graph agents with a message list, current node, and result references are poor candidates. Vercel's replay warning and Code Mode's ordering constraints identify real implementation tradeoffs, not proof that their users need another runtime.

**E — Numbers:** the table's 100 branches save **39.1 CPU-seconds**, worth **$0.000782** gross CPU. If obtaining the common model/tool prefix originally cost $0.10, strong journal replay, JSON, and heap branching can all acquire it once; **incremental avoided LLM spending is $0**. All still pay for new branch-specific model calls. Moving the source into a slower interpreter can erase the local CPU gain and must be tested using the native-fork inequality.

**E — Value:** assume **4 saved integration/recovery hours/month = $600** for a qualified team; test **$250/month**, giving $300K ARR at 100 teams and approximately 334 teams for $1M ARR. Do not price primarily as a percentage of inference savings. Vercel/Golem snapshots, Cloudflare Code Mode replay, and LangGraph explicit checkpoints sharply limit the incremental budget.

**E — 5–10 day proof:** take two representative generated programs with 100–10,000 recorded calls, a bounded 400 ms measured guest prefix near the chosen cut, and one real need to change supported executors. Implement the same semantics with Code Mode-style exact result replay and a data-oriented explicit plan/result state. Add live checkpoints, fork 100 future read-only replies, and perform a trusted Node→workerd handoff after source exit. Keep tool outputs and any LLM fixtures identical in every path. Measure what remains of the prefix after moving expensive transforms into recorded steps; that optimization is mandatory. Record hours for baseline and snapshot integration. Separate a local data tool RPC from moving the whole program, since RPC may capture all placement value.

**I — Strongest baseline:** recorded step outputs plus explicit current plan/state, and Vercel's existing snapshot+tail mode for server-only workflows. Safe sleeping, prior LLM calls, and simply dispatching a task near the data are not differentiators.

**E — Go gates:** at least one genuine stateful host-change requirement, a complete saved state below a declared size budget, and either a substantial measured replay-latency reduction after step caching or **4 measured engineering hours** less adapter/recovery work. If a 20 KB plan + result references is sufficient, the heap loses. Browser return requiring trusted replay must be included; do not claim saved trusted compute for a result that must be recomputed.

**E — Demo/tweet:** source exits at an approval cut; a supported destination supplies the next recorded/local reply; show unchanged paid-call count, exact prefix execution count, and total handoff latency. Draft: “The agent's tool program continued on another executor without rerunning its local prefix. Recorded model results were reused under every baseline; the comparison is recovery work and integration effort.”

**I — Killing reply:** “My journaled steps and 20 KB agent state already do this; your snapshot preserves cheap glue and adds a new compatibility matrix.” The correct response is a measured difficult trace, or rejection of this segment.

### 3. Reproduction/branching of sandbox production bugs — 12/15

**I — Who hurts:** a team already running tenant/generated code in this guest, receiving difficult guest-state failures that logs or application-level JSON missed. A saved pre-fault await cut, pinned source/module, and exact future inputs can make support cases executable. This does not reproduce arbitrary Node production bugs, races inside external dependencies, or an instruction before a trap unless there was a suitable prior capture. A cut is also not a history of how the bad value arose; input replay remains useful for that investigation.

**E — Numbers:** replaying a ten-second prefix for 20 investigations/alternative suffixes costs **202 CPU-seconds**, versus **12.1 seconds** with the assumed heap path, saving about **$0.0038** gross CPU. More plausibly valuable: **10 investigation hours/month = $1,500**, supporting a **$500/month** hypothesis and $600K ARR at 100 teams. Do not extrapolate an industry outage cost from this example.

**E — 5–10 day proof:** prepare three realistic guest-only fault fixtures involving closure mutation, aliasing/cycles, and an awaited reply ordering issue. Capture the last safe await cut and journal the following inputs. Send a pinned artifact to a separate local TS harness that can invoke bounded guest inspection helpers and branch future inputs without real effects. Compare time-to-reproduce and time-to-locate with input-only replay and the product's normal logs/state dump. Add redaction/retention constraints to the artifact format and test wrong-build rejection; omitting needed bytes must not silently produce a different continuation. Scope inspection to helpers supported by this guest; do not promise a complete source-level debugger in a week.

**I — Strongest baseline:** exact recorded-input replay and explicit diagnostic state for this guest; a mature record/replay tool such as rr for supported native workloads. An opaque blob without meaningful inspection is often less useful than a trace. Production fixes may need code changes incompatible with the saved heap, favoring replay or explicit fixtures for validating the fix.

**E — Go gates:** all three cases reproduce from the artifact without repeated external effects; a developer unfamiliar with each fixture reaches the fault materially faster than with the strongest baseline; and measured capture overhead on healthy traffic is acceptable. Account for capture frequency `a_H` on **all** sessions, not just the rare failures. Capturing for 5 ms after every 2 ms useful turn adds 250% CPU overhead; capture at suitable coarse boundaries or use sampling/checkpoint+tail. Existing QuickJS avoids a new-engine tax but does not make capture free.

**E — Demo/tweet:** load a saved customer-like fixture, inspect its captured lexical state through a helper, vary the next input, and reproduce the same failure with the source process absent. Draft: “An executable sandbox bug report: pinned program, live await-state, and recorded future inputs. We compared reproduction and investigation with exact input replay; the capsule does not capture the remote world.”

**I — Killing reply:** “A deterministic trace gives me causality, reverse stepping, and a way to test patched code; your image has no usable debugger and pins the buggy build.” A capsule deserves to survive only as a useful adjunct or a demonstrably simpler support workflow.

## 6. Where live state definitely loses under the stated conditions

These are **I** deductions from the model, rather than universal claims that an entire industry can never benefit.

1. **Relevant state is small and already explicit.** A 200-byte profile, `{step, resultRefs}`, or an established 10 KB story save takes little code to retain. If complete JSON/structured state restores in 2 ms and the heap needs 38 ms plus build pinning, heap loses runtime and simplicity. Preserve only relevant state; do not copy allocator slack and dead payloads.
2. **The expensive history consists of recorded external work.** A workflow with hours of LLM/network waits but 5 ms local replay has little reconstruction CPU to avoid. Store the model results and replay them. Re-buying them is an invalid baseline. Long pauses also do not earn idle-CPU savings against a hibernating workflow.
3. **A warm worker or bounded replay tail is already sufficient.** Cache hits have no prefix reconstruction; continue-as-new, cached step outputs, or periodic semantic checkpoints can bound the remaining work. The live image has to beat this optimized tail rather than the complete lifetime history.
4. **Raw data dominates and is incompressible or rapidly rewritten.** The measured 50 MiB random-data capsule takes about 42 seconds over 10 Mbit/s under the illustrative full-move model. If a local cached artifact plus pointer restores needed state in 200 ms, it wins decisively. New destinations cannot benefit from a delta base they do not possess; high mutation also destroys sparse-delta economics.
5. **The application needs native throughput or unsupported state.** At `α=6`, long CPU suffixes can outweigh any shared prefix. Python dataframes, native libraries, GPU state, browser DOM/renderer state, compiler subprocesses, and hardware drivers are not preserved by this QuickJS image. Native checkpoints/clones, file outputs, or an explicit task representation match the actual system boundary.
6. **Native/local cloning already shares the prefix.** A local simulation with a fast state clone or a VM with copy-on-write avoids both replay and extra cross-runtime interpretation. Shipping a Wasm heap adds no value unless a required destination cannot run that existing checkpoint.
7. **Independent writers, long-lived archives, and frequent upgrades are central.** CRDT/document operations, database records, and versioned business schemas offer intentional merge and migration semantics. Two modified heaps have no generic business merge. A years-old session that must run new code often needs an explicit migration/export representation anyway.
8. **Reconstruction is rare and checkpointing is continuous.** A monthly failure cannot justify snapshots every tiny turn unless their capture/retention/operations cost is below expected recovery savings or investigation value. Use `a_H` and `n` separately. At low `q` and no forks, journal replay is often the simpler decision.
9. **There is no compatible safe point or consistent external-state cut.** A memory copy from active unsupported frames is not this proven mechanism. An in-flight transaction, live page, or actuator cannot be rewound by restoring an async controller. Explicit resource identifiers, reconciliation, and fresh initialization can be the only equivalent implementation.
10. **Returned computation must be re-executed to trust it.** If a privileged server must rebuild a hostile browser's state from a trusted cut, bill that trusted replay. It removes the claimed saved authoritative CPU; keep speculative proposals as data with a cheap validator when the application has one.

## 7. The ONE bet and the decision the builder should make

**I — Prove seeded-state testing for an already embedded, opaque/generated JS sandbox next.** It concentrates all favorable model terms: repeated shared prefixes, many forks, small controlled state, fixed builds during a test, recorded effects, short suffixes, and no requirement to trust arbitrary returned production authority. It can fail quickly and honestly against a complete JSON fixture or an existing clone. That is a more useful result than a generic portability video.

**E — The decisive artifact:** a reproducible corpus and table showing **entry replay / optimized checkpointed replay / explicit relevant state / heap**, with equal outputs, source execution counts, capture+restore+suffix CPU, realistic transfer/cold-base cases, peak raw memory, and recorded integration hours. Include both “already QuickJS” and native V8 where the latter is a plausible deployment. Keep the promising result only if the complete strongest baseline is materially worse on a buyer-relevant dimension. No new account or production effect is needed to answer that question.

**I — Product implication:** sell a supported testing/reproduction capability inside an existing sandbox/agent platform if the proof survives. Add cross-host continuation only when a trace demonstrates that need. With the current primary evidence, the model supports a narrow embeddable capability, not a general-purpose compute-distribution business or an inference-cost reduction claim.

## Ranked top three

1. **I/E — Seeded-state sandbox testing: 14/15.** Illustrative 2-second prefix, 1,000 branches: **2,020 → 27 CPU-seconds**, but complete JSON fixtures can do **24 seconds**. The qualifying advantage is reduced fixture effort or preserved private execution state. **The bet to prove next.**
2. **I/E — Generated agent continuations: 13/15.** Illustrative 400 ms prefix, 100 branches: **42 → 2.9 CPU-seconds**, with **$0 incremental avoided historical LLM spend** against correct replay. Qualify actual opaque state and a necessary host change.
3. **I/E — Sandbox production repro: 12/15.** Illustrative 10-second prefix, 20 attempts: **202 → 12.1 CPU-seconds**. Value depends on investigation hours, useful inspection, and tolerable capture overhead; exact replay remains mandatory competition.

## Five-line TL;DR

1. **I:** Compare reconstruction cost with full capture/codec/transfer/restore, amortized engineering, execution overhead, and compatibility—not with the original paid input cost.
2. **M-prior/E:** The favorable anchor is about 0.4 ms local restore and 97 KB compressed; the modeled full remote handoff is about 38 ms at 100 Mbit/s, while high-entropy heaps can be orders of magnitude larger.
3. **I:** Correct replay journals LLM/tool results; JSON keeps only relevant state; either can remove most apparent live-heap savings.
4. **I/E:** Seeded sandbox testing, generated agent continuations, and sandbox repro lead the 17-domain scan, conditional on small opaque state and expensive repeated prefixes.
5. **I:** Prove seeded testing against complete JSON fixtures and existing snapshot/clone baselines; retain the idea only for measured runtime, integration, or investigation value.

**Verdict — GO-WITH-CHANGES for the cost/value angle.** **I:** the mechanism has a defensible conditional operating region. A generic “long-running agents save inference dollars by moving their heap” pitch fails the strong-baseline test. Customer traces and integration-time measurements are still missing.

**Three next steps:**

1. **I/E:** Build the bounded seeded-state comparison above; make the input journal, complete fixture baseline, exact module identity, and losing controls reviewable.
2. **I/E:** Measure `L`, replay CPU after step caching, `H`, compressed `S`, dirty-page rate, cold/base-cache rates, suffix CPU, and integration hours on two representative existing sandbox workloads; replace the scenario inputs and rerank.
3. **I/E:** If the proof survives, test the $500/month supported testing/repro hypothesis with qualified platform teams. Require an identified recurring bottleneck and willingness to pay before broadening domains or implementing the full production movement contract. This is a research recommendation, not authorization to contact anyone.
