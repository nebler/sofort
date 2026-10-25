# Investment and exposure kill criteria

Statuses describe the integrated R3 artifact. An old passing experiment does
not waive a current gate; UNMEASURED prevents the associated claim or promotion.
These are review thresholds from [area10 R2](../../10-minimalist-critic/R2.md),
not observed performance promises. [Current integration](../../10-minimalist-critic/R3-INTEGRATION.md).

| Criterion | Current status | Exact evidence / interpretation |
|---|---|---|
| H1 clean-copy build and every subtree test | FAIL; build PASS | [Source-stable poll-04 receipt](../../10-minimalist-critic/r3/h1-poll-04.json), [log](../../10-minimalist-critic/r3/h1-poll-04.log): kernel test reads missing sibling R2 fixture; dependency orchestration fixed |
| H2 real deleted-handler regrowth, then unchanged static Lua | PASS functional | [Independent top-level receipt](../../10-minimalist-critic/r3/h2-01.json): executor result first, fresh90 probe +30 Lua passes, live qjs/Lua; native development host limitation explicit |
| H3 full integrated nested-KVM functional suite | PASS owner evidence; top-level replay pending | [Gate table](../linux/out/report.md), [raw receipt](../linux/out/report.json): 100 boots,30 tool,720 seccomp,180 fault;30 bad-sysreg watchdog kills. Nested SMP1, no timing transfer |
| H4 canonical integrated n≥30 load-aware distributions | PASS E6 interleaved/flagged table; quiet UNMEASURED | [Canonical table](../bench/RESULTS.md), [audit](../../10-minimalist-critic/r3/h4-audit.json):2460 validated,41 cases×60;0 gate passes. Frozen v1 candidate only; flagged samples cannot pass a quiet gate |
| H5 no host effect for forged frames, floods, control bytes, CPU/memory exhaustion, HVC/PSCI, console abuse | PASS named macOS cases; broader containment UNMEASURED | [07 v2 table](../../07-security-sandbox/R3.md), independent [protocol570](../../10-minimalist-critic/r3/h5-protocol-replay.json), [memory/stack60](../../10-minimalist-critic/r3/h5-resource-probe.json), [CPU30](../../10-minimalist-critic/r3/h5-cpu-probe.json); Linux escape and EOF-mid-call unverified |
| Parked idle <2% core/VM AND no stall in 1000 exchanges | UNMEASURED | Historical R2 passed; require integrated source/artifact receipt before pool admission |
| Aggregate parked + tool-wait CPU ≤10% host capacity | UNMEASURED | Per-VM CPU alone is insufficient at fleet scale |
| No policy or isolation bypass | UNMEASURED | Finite tests establish tested cases only; any observed bypass stops exposure |
| Deadline overshoot ≤50 ms at admitted load | FAIL | [Blocking callback receipt](../../10-minimalist-critic/r3/h5-resource-probe.json):29/29 admitted blocks exceed bound, API elapsed median221.824/p90235.307/p99264.945ms for30ms timeout; all reaped. [CPU30](../../10-minimalist-critic/r3/h5-cpu-probe.json) also overshoots50ms in10/30 at load41.66–49.09 |
| M4 Linux overhead p99 ≤10 ms at c32 | UNMEASURED | Need arm64 metal n≥30 distributions, workload baseline and timing boundary |
| M4 Linux attributable cost ≤5 CPU-ms/invocation | UNMEASURED | Mac child-only CPU cannot pass/fail Linux criterion; include supervisor/watchdog scope |
| M4 Linux attributable memory ≤32 MiB/invocation | UNMEASURED | Requires concurrent PSS/cgroup/system attribution; configured RAM is not measured memory |
| Keep JS-only investment only if equivalent Hyperlight is >20% behind in density/throughput | UNMEASURED | Equal HW-isolation and sustained workloads required; clone latency is not strict density |
| Lua adds ≤350 incremental kernel LOC and no actual signal delivery/threads/general filesystem | PASS for canonical baseline/profile | [08 source diff and receipts](../grow/results/canonical-r3/report.json): +6 handler LOC; canonical baseline already supplies ELF/argv helpers. No general ABI claim |
| Owned code stays reviewable; investigate growth beyond 5750 LOC planning cap incl tests | FAIL planning alarm | [02:21 inventory](../../10-minimalist-critic/r3/loc-final.json):10,658 physical lines incl tests/build/config and copied fallbacks; upstream patch delta+174/−93 separate. This is not evidence of insecurity |

On a failed exposure criterion, keep the artifact private until fixed and replay
the exact failed test. On an unmeasured investment criterion, defer its decision
until matching evidence exists. On a failed Linux M4 cost criterion, stop further
custom-kernel investment and compare an equivalent baseline. No cloud resources
are provisioned by this review.
