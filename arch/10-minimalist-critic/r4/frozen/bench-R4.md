# 06 R4 — v2 recertification and portable harness

## FIXED
- F1: executor parking evidence now names the shipped kernel marker.
- Controller derives the product root from its own file; removed legacy input
  fallbacks, sibling-policy copy, fixed scratch path and fixed Node path.
- Canonical artifacts/env/CLI overrides, temporary output and relative Hyperlight
  descriptors work after renaming. Missing prerequisites fail with instructions.
- Exact R3 source moved to `r3-measured-source/` here; immutable raw observations
  retain historical provenance. R3 numerical table is unchanged.
- Executable-source audit: zero external-area path references in bench/
  (Hyperlight source cleanup belongs to owner09).

## I3 numbers
- Copied using `cp -R arch/jitk /tmp/jitk-06/r4/anyname`.
- Same R3 controller sampling, assertions, confinement ack, watchdog and load
  gate (<6; 1 s budget; 1 s poll); seed604 case/build randomization.
- 60 adjacent randomized pairs/case; 480/480 validated, zero failures.
- Median(v2_i − baseline_i), paired bootstrap CI95, 2000 draws, seed601.
- Both marginal medians and auxiliary CPU/memory timing are in the canonical
  [v2 section](../jitk/bench/RESULTS.md#v2-recertification).

| Case / metric | R3 median | v2 median | paired delta [CI95] | load1 |
|---|---:|---:|---:|---:|
| jitk-cold/return2 / latency_ms | 29.7899 | 34.4639 | +1.3101 [-5.0979, +5.4496] | 12.60–106.46 |
| jitk-parked-raw/one_tool / latency_ms | 2.0551 | 3.4529 | +0.4130 [-0.2629, +2.0062] | 12.48–112.85 |
| jitk-parked-raw/promise10_5ms / latency_ms | 9.4862 | 9.8666 | -0.1625 [-1.0840, +0.8928] | 12.48–109.98 |
| jitk-parked-memory/one_tool / footprint_mib | 10.7036 | 10.7505 | +0.0625 [+0.0469, +0.0625] | 12.48–109.98 |
| jitk-parked-memory/one_tool / rss_mib | 15.3828 | 15.4219 | +0.0469 [+0.0312, +0.0547] | 12.48–109.98 |

- Window: 2026-10-24T02:53:02.468262+00:00 to 2026-10-24T03:03:35.683081+00:00.
- Continuous load1 monitor: 12.48–112.85; 0/480 quiet gates.
- **No quiet pass was possible: load1 never dropped below 6.**
- **No R3 headline change established.** Latency CIs span zero; the small
  memory increase does not materially change the ~6x density gap. Hyperlight
  and omitted workloads were not rerun; no new all-workload/quiet claim.

## Artifacts and verification
- v2 VMM: `276463d01ac6956a095814ed77053989d21bb52a7ef702f5c2698eb98daba20e`.
- baseline VMM: `73df1ad31afa79274feda85cf386185141e5a08860b513891dc681ad6b91338e`.
- Shared kernel: `a7c39ab5679e75d3242f6f318cd5367ff866380e8f509085e974a49f1b6a6364`.
- Source hashes: [done marker](../jitk/bench/.R4).
- `make -C arch/jitk/bench build test` and renamed-copy checks PASS.
- Normal-controller renamed-copy smoke: 8/8 PASS, load1 47.37; independent
  paired-analysis fixed-shift check passes (synthetic statistics fixture).
- Raw: [r4-raw.json](../jitk/bench/r4-raw.json); hashes, source scan, smoke and
  no surviving owned VMs: [verification](../jitk/bench/r4-verification.json).
- Peak own VM concurrency ≤2 (paired run1 + independent smoke1); all killed/reaped.
- Foreign job, global toolchains and other owner subtrees untouched.

## Still open
- Quiet H4 / absolute latency and Linux metal performance remain UNVERIFIED.
- This regression subset does not repeat the full R3 Hyperlight comparison.
