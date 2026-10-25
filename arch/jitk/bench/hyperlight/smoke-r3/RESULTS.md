# Canonical benchmark results

Run: 2026-10-24T01:07:35.641603+00:00 → 2026-10-24T01:07:53.883680+00:00. Platform: macOS-26.6.1-arm64-arm-64bit.
Start: `3:07  up  4:21, 2 users, load averages: 156.64 108.51 86.55`. End: `3:07  up  4:21, 2 users, load averages: 151.84 110.76 87.88`.

Gate: load1 < 6; 0.1 s budget/sample. Randomized complete blocks; seed 39009.
Cold = spawn → validated done; parked = RUN → validated done after READY and 5 ms idle. Tools return asynchronously after 0 or 5 ms as named. JSON case parses/stringifies exactly 1 MiB internally, returns its length (not a 1 MiB protocol frame).
Executor = execute() → validated result; Node startup/pool preparation excluded. Refill = READY + kill/reap, 4 waves per sample. CPU = child user+system through reap; watchdog/supervisor excluded. Parked memory = process RSS/physical footprint, excludes HVF kernel allocations.
Cached binary/image/signature runs; first validation excluded. Single-use hardware VM except explicitly shared-HW Hyperlight logical clones. No nested-KVM performance.

Values and brackets: estimate [95% bootstrap CI], 2,000 IID resamples. Quantiles interpolate order statistics. n=30 p99 is poorly resolved; CI does not remove contention or serial dependence.
**Quiet credibility requires ≥30 gate-passed samples per row. A timed-out gate remains a contended sample; no idle-host conclusion follows.**

| Case / metric | n / fail | p50 [CI95] | p90 [CI95] | p99 [CI95] | load1 range | gated / timed-out |
|---|---:|---:|---:|---:|---:|---:|
| jitk-cold/return2 · ms | 1 / 0 | 338.772 [338.772, 338.772] | 338.772 [338.772, 338.772] | 338.772 [338.772, 338.772] | 159.79–159.79 | 0 / 1 |
| jitk-cold/return2 · CPU-ms/VM | 1 / 0 | 19.047 [19.047, 19.047] | 19.047 [19.047, 19.047] | 19.047 [19.047, 19.047] | 159.79–159.79 | 0 / 1 |
| jitk-cold/one_tool_5ms · ms | 1 / 0 | 221.524 [221.524, 221.524] | 221.524 [221.524, 221.524] | 221.524 [221.524, 221.524] | 151.84–151.84 | 0 / 1 |
| jitk-cold/one_tool_5ms · CPU-ms/VM | 1 / 0 | 25.364 [25.364, 25.364] | 25.364 [25.364, 25.364] | 25.364 [25.364, 25.364] | 151.84–151.84 | 0 / 1 |
| jitk-cold/promise10_5ms · ms | 1 / 0 | 76.780 [76.780, 76.780] | 76.780 [76.780, 76.780] | 76.780 [76.780, 76.780] | 162.35–162.35 | 0 / 1 |
| jitk-cold/promise10_5ms · CPU-ms/VM | 1 / 0 | 27.858 [27.858, 27.858] | 27.858 [27.858, 27.858] | 27.858 [27.858, 27.858] | 162.35–162.35 | 0 / 1 |
| jitk-cold/json1m · ms | 1 / 0 | 109.016 [109.016, 109.016] | 109.016 [109.016, 109.016] | 109.016 [109.016, 109.016] | 162.35–162.35 | 0 / 1 |
| jitk-cold/json1m · CPU-ms/VM | 1 / 0 | 24.241 [24.241, 24.241] | 24.241 [24.241, 24.241] | 24.241 [24.241, 24.241] | 162.35–162.35 | 0 / 1 |
| jitk-cold/cpu50ms · ms | 1 / 0 | 130.021 [130.021, 130.021] | 130.021 [130.021, 130.021] | 130.021 [130.021, 130.021] | 151.84–151.84 | 0 / 1 |
| jitk-cold/cpu50ms · CPU-ms/VM | 1 / 0 | 31.818 [31.818, 31.818] | 31.818 [31.818, 31.818] | 31.818 [31.818, 31.818] | 151.84–151.84 | 0 / 1 |
| hl-strict-cold/return2 · ms | 1 / 0 | 19.074 [19.074, 19.074] | 19.074 [19.074, 19.074] | 19.074 [19.074, 19.074] | 162.35–162.35 | 0 / 1 |
| hl-strict-cold/return2 · CPU-ms/VM | 1 / 0 | 11.044 [11.044, 11.044] | 11.044 [11.044, 11.044] | 11.044 [11.044, 11.044] | 162.35–162.35 | 0 / 1 |
| hl-strict-cold/one_tool_5ms · ms | 1 / 0 | 216.279 [216.279, 216.279] | 216.279 [216.279, 216.279] | 216.279 [216.279, 216.279] | 162.35–162.35 | 0 / 1 |
| hl-strict-cold/one_tool_5ms · CPU-ms/VM | 1 / 0 | 10.801 [10.801, 10.801] | 10.801 [10.801, 10.801] | 10.801 [10.801, 10.801] | 162.35–162.35 | 0 / 1 |
| hl-strict-cold/promise10_5ms · ms | 1 / 0 | 380.589 [380.589, 380.589] | 380.589 [380.589, 380.589] | 380.589 [380.589, 380.589] | 158.21–158.21 | 0 / 1 |
| hl-strict-cold/promise10_5ms · CPU-ms/VM | 1 / 0 | 13.106 [13.106, 13.106] | 13.106 [13.106, 13.106] | 13.106 [13.106, 13.106] | 158.21–158.21 | 0 / 1 |
| hl-strict-cold/json1m · ms | 1 / 0 | 27.969 [27.969, 27.969] | 27.969 [27.969, 27.969] | 27.969 [27.969, 27.969] | 162.35–162.35 | 0 / 1 |
| hl-strict-cold/json1m · CPU-ms/VM | 1 / 0 | 20.909 [20.909, 20.909] | 20.909 [20.909, 20.909] | 20.909 [20.909, 20.909] | 162.35–162.35 | 0 / 1 |
| hl-strict-cold/cpu50ms · ms | 1 / 0 | 211.201 [211.201, 211.201] | 211.201 [211.201, 211.201] | 211.201 [211.201, 211.201] | 159.79–159.79 | 0 / 1 |
| hl-strict-cold/cpu50ms · CPU-ms/VM | 1 / 0 | 19.563 [19.563, 19.563] | 19.563 [19.563, 19.563] | 19.563 [19.563, 19.563] | 159.79–159.79 | 0 / 1 |
| jitk-parked/return2 · ms | 1 / 0 | 6.822 [6.822, 6.822] | 6.822 [6.822, 6.822] | 6.822 [6.822, 6.822] | 162.35–162.35 | 0 / 1 |
| jitk-parked/return2 · CPU-ms/VM | 1 / 0 | 34.153 [34.153, 34.153] | 34.153 [34.153, 34.153] | 34.153 [34.153, 34.153] | 162.35–162.35 | 0 / 1 |
| jitk-parked/one_tool_5ms · ms | 1 / 0 | 8.385 [8.385, 8.385] | 8.385 [8.385, 8.385] | 8.385 [8.385, 8.385] | 151.84–151.84 | 0 / 1 |
| jitk-parked/one_tool_5ms · CPU-ms/VM | 1 / 0 | 13.309 [13.309, 13.309] | 13.309 [13.309, 13.309] | 13.309 [13.309, 13.309] | 151.84–151.84 | 0 / 1 |
| jitk-parked/promise10_5ms · ms | 1 / 0 | 64.192 [64.192, 64.192] | 64.192 [64.192, 64.192] | 64.192 [64.192, 64.192] | 158.21–158.21 | 0 / 1 |
| jitk-parked/promise10_5ms · CPU-ms/VM | 1 / 0 | 23.810 [23.810, 23.810] | 23.810 [23.810, 23.810] | 23.810 [23.810, 23.810] | 158.21–158.21 | 0 / 1 |
| jitk-parked/json1m · ms | 1 / 0 | 278.652 [278.652, 278.652] | 278.652 [278.652, 278.652] | 278.652 [278.652, 278.652] | 158.21–158.21 | 0 / 1 |
| jitk-parked/json1m · CPU-ms/VM | 1 / 0 | 35.340 [35.340, 35.340] | 35.340 [35.340, 35.340] | 35.340 [35.340, 35.340] | 158.21–158.21 | 0 / 1 |
| jitk-parked/cpu50ms · ms | 1 / 0 | 184.420 [184.420, 184.420] | 184.420 [184.420, 184.420] | 184.420 [184.420, 184.420] | 158.21–158.21 | 0 / 1 |
| jitk-parked/cpu50ms · CPU-ms/VM | 1 / 0 | 33.066 [33.066, 33.066] | 33.066 [33.066, 33.066] | 33.066 [33.066, 33.066] | 158.21–158.21 | 0 / 1 |
| hl-strict-prespawned/return2 · ms | 1 / 0 | 35.204 [35.204, 35.204] | 35.204 [35.204, 35.204] | 35.204 [35.204, 35.204] | 158.21–158.21 | 0 / 1 |
| hl-strict-prespawned/return2 · CPU-ms/VM | 1 / 0 | 12.781 [12.781, 12.781] | 12.781 [12.781, 12.781] | 12.781 [12.781, 12.781] | 158.21–158.21 | 0 / 1 |
| hl-strict-prespawned/one_tool_5ms · ms | 1 / 0 | 63.211 [63.211, 63.211] | 63.211 [63.211, 63.211] | 63.211 [63.211, 63.211] | 159.79–159.79 | 0 / 1 |
| hl-strict-prespawned/one_tool_5ms · CPU-ms/VM | 1 / 0 | 10.256 [10.256, 10.256] | 10.256 [10.256, 10.256] | 10.256 [10.256, 10.256] | 159.79–159.79 | 0 / 1 |
| hl-strict-prespawned/promise10_5ms · ms | 1 / 0 | 455.138 [455.138, 455.138] | 455.138 [455.138, 455.138] | 455.138 [455.138, 455.138] | 159.79–159.79 | 0 / 1 |
| hl-strict-prespawned/promise10_5ms · CPU-ms/VM | 1 / 0 | 12.816 [12.816, 12.816] | 12.816 [12.816, 12.816] | 12.816 [12.816, 12.816] | 159.79–159.79 | 0 / 1 |
| hl-strict-prespawned/json1m · ms | 1 / 0 | 561.578 [561.578, 561.578] | 561.578 [561.578, 561.578] | 561.578 [561.578, 561.578] | 159.79–159.79 | 0 / 1 |
| hl-strict-prespawned/json1m · CPU-ms/VM | 1 / 0 | 27.422 [27.422, 27.422] | 27.422 [27.422, 27.422] | 27.422 [27.422, 27.422] | 159.79–159.79 | 0 / 1 |
| hl-strict-prespawned/cpu50ms · ms | 1 / 0 | 162.204 [162.204, 162.204] | 162.204 [162.204, 162.204] | 162.204 [162.204, 162.204] | 162.35–162.35 | 0 / 1 |
| hl-strict-prespawned/cpu50ms · CPU-ms/VM | 1 / 0 | 15.590 [15.590, 15.590] | 15.590 [15.590, 15.590] | 15.590 [15.590, 15.590] | 162.35–162.35 | 0 / 1 |
| hl-logical-clone/return2 · ms | 1 / 0 | 4.984 [4.984, 4.984] | 4.984 [4.984, 4.984] | 4.984 [4.984, 4.984] | 158.21–158.21 | 0 / 1 |
| hl-logical-clone/one_tool_5ms · ms | 1 / 0 | 8.641 [8.641, 8.641] | 8.641 [8.641, 8.641] | 8.641 [8.641, 8.641] | 151.84–151.84 | 0 / 1 |
| hl-logical-clone/promise10_5ms · ms | 1 / 0 | 148.030 [148.030, 148.030] | 148.030 [148.030, 148.030] | 148.030 [148.030, 148.030] | 158.21–158.21 | 0 / 1 |
| hl-logical-clone/json1m · ms | 1 / 0 | 34.837 [34.837, 34.837] | 34.837 [34.837, 34.837] | 34.837 [34.837, 34.837] | 162.35–162.35 | 0 / 1 |
| hl-logical-clone/cpu50ms · ms | 1 / 0 | 57.300 [57.300, 57.300] | 57.300 [57.300, 57.300] | 57.300 [57.300, 57.300] | 151.84–151.84 | 0 / 1 |
| memory/jitk/1 · MiB RSS | 1 / 0 | 15.422 [15.422, 15.422] | 15.422 [15.422, 15.422] | 15.422 [15.422, 15.422] | 162.35–162.35 | 0 / 1 |
| memory/jitk/1 · MiB footprint | 1 / 0 | 10.657 [10.657, 10.657] | 10.657 [10.657, 10.657] | 10.657 [10.657, 10.657] | 162.35–162.35 | 0 / 1 |
| memory/hl-strict/1 · MiB RSS | 1 / 0 | 6.938 [6.938, 6.938] | 6.938 [6.938, 6.938] | 6.938 [6.938, 6.938] | 158.21–158.21 | 0 / 1 |
| memory/hl-strict/1 · MiB footprint | 1 / 0 | 1.750 [1.750, 1.750] | 1.750 [1.750, 1.750] | 1.750 [1.750, 1.750] | 158.21–158.21 | 0 / 1 |
| memory/hl-logical/1 · MiB RSS | 1 / 0 | 6.953 [6.953, 6.953] | 6.953 [6.953, 6.953] | 6.953 [6.953, 6.953] | 162.35–162.35 | 0 / 1 |
| memory/hl-logical/1 · MiB footprint | 1 / 0 | 1.766 [1.766, 1.766] | 1.766 [1.766, 1.766] | 1.766 [1.766, 1.766] | 162.35–162.35 | 0 / 1 |
| memory/hl-logical/17 · MiB RSS | 1 / 0 | 9.578 [9.578, 9.578] | 9.578 [9.578, 9.578] | 9.578 [9.578, 9.578] | 158.21–158.21 | 0 / 1 |
| memory/hl-logical/17 · MiB footprint | 1 / 0 | 4.516 [4.516, 4.516] | 4.516 [4.516, 4.516] | 4.516 [4.516, 4.516] | 158.21–158.21 | 0 / 1 |
| memory/hl-logical/33 · MiB RSS | 1 / 0 | 12.234 [12.234, 12.234] | 12.234 [12.234, 12.234] | 12.234 [12.234, 12.234] | 159.79–159.79 | 0 / 1 |
| memory/hl-logical/33 · MiB footprint | 1 / 0 | 7.298 [7.298, 7.298] | 7.298 [7.298, 7.298] | 7.298 [7.298, 7.298] | 159.79–159.79 | 0 / 1 |

Source selection (frozen at run start):

```json
{
  "jitk": {
    "vmm": "/tmp/jitk-02/r2/host",
    "image": "/tmp/jitk-02/r2/kernel.bin",
    "launcher": "02-r2"
  },
  "executor_ready_at_start": false,
  "protocol": "/Users/noah/.t3/scratch/2026-10-23-is-there-a-way-we-5a54f52b/arch/jitk/protocol/dispatcher.ts",
  "canonical_controller_sha256": "e80af1814f16e62b220517e02ca18b72b1052c7edc88363b09e99a99b1f70194",
  "canonical_controller": "/Users/noah/.t3/scratch/2026-10-23-is-there-a-way-we-5a54f52b/arch/jitk/bench/run.py",
  "bench_ready_at_start": true,
  "hyperlight": {
    "strict_argv": [
      "/tmp/jitk-09/adapter-target/release/r2-worker",
      "strict",
      "/tmp/jitk-09/r3-snapshot"
    ],
    "clone_argv": [
      "/tmp/jitk-09/adapter-target/release/r2-worker",
      "clone",
      "/tmp/jitk-09/r3-snapshot"
    ],
    "env": {},
    "provenance": "Round 3 owner-09 integrated source; Hyperlight host 0.18.0; strict fresh process and fresh HW VM with tenant-free snapshot restored before READY; clone shared HW VM; panic=abort",
    "files": [
      "/Users/noah/.t3/scratch/2026-10-23-is-there-a-way-we-5a54f52b/arch/jitk/bench/hyperlight/worker.rs",
      "/Users/noah/.t3/scratch/2026-10-23-is-there-a-way-we-5a54f52b/arch/jitk/bench/hyperlight/bootstrap.js",
      "/Users/noah/.t3/scratch/2026-10-23-is-there-a-way-we-5a54f52b/arch/jitk/bench/hyperlight/Cargo.lock",
      "/private/tmp/jitk-09/adapter-target/release/r2-worker",
      "/private/tmp/jitk-09/r3-snapshot/index.json"
    ]
  },
  "contracts": {
    "jitk-cold": "fresh process + single-use HW VM",
    "hl-strict-cold": "fresh process + single-use HW VM",
    "jitk-parked": "fresh process + single-use HW VM",
    "hl-strict-prespawned": "fresh process + single-use HW VM",
    "hl-logical-clone": "shared HW VM, fresh logical clone per request"
  },
  "hashes": {
    "/tmp/jitk-09/adapter-target/release/r2-worker": "60e83328a0ac6dd13aa21c60b76148a60adf94733e46331d54adaedeb9ed229c",
    "/tmp/jitk-02/r2/host": "b9e470a07795e1d350a90b9c8822c8f18713d595b4098bdb0dce10ff480feeed",
    "/tmp/jitk-02/r2/kernel.bin": "3d64c3dd05494f879cb2ffbe6c520730d2e6d14baea9b75961688d7a69d510b8",
    "/Users/noah/.t3/scratch/2026-10-23-is-there-a-way-we-5a54f52b/arch/jitk/bench/hyperlight/executor-runner.mjs": "f47f610e10c3a6620097204b44f28b036b5c5c556a165033daf44816988526d3"
  }
}
```

Missing integrations: 04 integrated executor READY at start; authorized raw r2 channel used.
Raw observations, timestamps, gate histories, result assertions, machine state, hashes and failures: [raw.json](raw.json).
All external performance claims must cite this table. R2 tables are historical contended measurements.
