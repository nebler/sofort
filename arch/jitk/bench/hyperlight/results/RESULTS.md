# Canonical benchmark results

Run: 2026-10-24T01:08:48.953733+00:00 → 2026-10-24T01:14:08.535748+00:00. Platform: macOS-26.6.1-arm64-arm-64bit.
Start: `3:08  up  4:22, 2 users, load averages: 149.12 116.80 91.55`. End: `3:14  up  4:27, 2 users, load averages: 31.06 78.69 83.39`.

Gate: load1 < 6; 0.1 s budget/sample. Randomized complete blocks; seed 39009.
Cold = spawn → validated done; parked = RUN → validated done after READY and 5 ms idle. Tools return asynchronously after 0 or 5 ms as named. JSON case parses/stringifies exactly 1 MiB internally, returns its length (not a 1 MiB protocol frame).
Executor = execute() → validated result; Node startup/pool preparation excluded. Refill = READY + kill/reap, 4 waves per sample. CPU = child user+system through reap; watchdog/supervisor excluded. Parked memory = process RSS/physical footprint, excludes HVF kernel allocations. Sandbox on/off = precompiled sandbox_apply versus clock-only baseline, no VM; not an end-to-end subtraction.
Cached binary/image/signature runs; first validation excluded. Single-use hardware VM except explicitly shared-HW Hyperlight logical clones. No nested-KVM performance.

Values and brackets: estimate [95% bootstrap CI], 2,000 IID resamples. Quantiles interpolate order statistics. n=30 p99 is poorly resolved; CI does not remove contention or serial dependence.
**Quiet credibility requires ≥30 gate-passed samples per row. A timed-out gate remains a contended sample; no idle-host conclusion follows.**

| Case / metric | n / fail | p50 [CI95] | p90 [CI95] | p99 [CI95] | load1 range | gated / timed-out |
|---|---:|---:|---:|---:|---:|---:|
| jitk-cold/return2 · ms · all | 30 / 0 | 27.281 [14.633, 57.847] | 136.505 [76.101, 177.684] | 210.968 [130.177, 226.792] | 33.16–157.41 | 0 / 30 |
| jitk-cold/return2 · CPU-ms/VM · all | 30 / 0 | 14.160 [10.771, 19.080] | 26.663 [21.457, 29.637] | 30.704 [26.519, 31.212] | 33.16–157.41 | 0 / 30 |
| jitk-cold/one_tool_5ms · ms · all | 30 / 0 | 30.316 [26.893, 40.046] | 167.427 [48.123, 501.465] | 522.997 [142.899, 533.233] | 33.16–157.41 | 0 / 30 |
| jitk-cold/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 14.773 [11.280, 17.492] | 28.758 [18.415, 37.020] | 49.430 [27.496, 55.330] | 33.16–157.41 | 0 / 30 |
| jitk-cold/promise10_5ms · ms · all | 30 / 0 | 38.355 [22.759, 87.247] | 279.757 [123.238, 419.982] | 448.970 [261.752, 462.751] | 33.16–159.16 | 0 / 30 |
| jitk-cold/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 18.324 [12.849, 23.035] | 35.795 [24.746, 44.359] | 52.524 [35.624, 56.406] | 33.16–159.16 | 0 / 30 |
| jitk-cold/json1m · ms · all | 30 / 0 | 36.830 [29.112, 44.598] | 115.837 [53.886, 170.018] | 256.720 [111.373, 297.940] | 33.16–157.41 | 0 / 30 |
| jitk-cold/json1m · CPU-ms/VM · all | 30 / 0 | 23.825 [20.812, 27.065] | 30.242 [28.340, 32.997] | 35.185 [29.908, 36.226] | 33.16–157.41 | 0 / 30 |
| jitk-cold/cpu50ms · ms · all | 30 / 0 | 74.791 [65.159, 149.085] | 243.692 [164.824, 338.984] | 458.308 [233.632, 515.036] | 33.16–157.41 | 0 / 30 |
| jitk-cold/cpu50ms · CPU-ms/VM · all | 30 / 0 | 56.925 [49.128, 58.566] | 63.521 [59.083, 68.634] | 70.416 [62.609, 71.263] | 33.16–157.41 | 0 / 30 |
| hl-strict-cold/return2 · ms · all | 30 / 0 | 14.467 [10.725, 20.095] | 62.452 [32.512, 96.285] | 101.755 [56.556, 104.356] | 31.06–159.16 | 0 / 30 |
| hl-strict-cold/return2 · CPU-ms/VM · all | 30 / 0 | 7.899 [6.530, 9.126] | 10.160 [9.239, 11.397] | 11.654 [10.116, 11.776] | 31.06–159.16 | 0 / 30 |
| hl-strict-cold/one_tool_5ms · ms · all | 30 / 0 | 26.570 [20.468, 38.179] | 95.817 [43.803, 176.668] | 330.660 [84.595, 403.869] | 33.16–156.98 | 0 / 30 |
| hl-strict-cold/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 8.799 [7.497, 9.499] | 11.197 [10.014, 14.619] | 20.941 [11.094, 23.947] | 33.16–156.98 | 0 / 30 |
| hl-strict-cold/promise10_5ms · ms · all | 30 / 0 | 128.772 [97.919, 157.069] | 303.820 [180.651, 343.529] | 458.409 [295.365, 513.024] | 33.16–156.98 | 0 / 30 |
| hl-strict-cold/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 10.424 [9.672, 11.836] | 13.733 [12.407, 13.889] | 14.119 [13.567, 14.228] | 33.16–156.98 | 0 / 30 |
| hl-strict-cold/json1m · ms · all | 30 / 0 | 35.509 [29.764, 62.036] | 148.256 [74.739, 283.799] | 506.682 [137.429, 612.642] | 33.16–159.16 | 0 / 30 |
| hl-strict-cold/json1m · CPU-ms/VM · all | 30 / 0 | 23.549 [21.780, 24.587] | 26.264 [25.086, 29.205] | 38.819 [26.118, 43.390] | 33.16–159.16 | 0 / 30 |
| hl-strict-cold/cpu50ms · ms · all | 30 / 0 | 67.861 [62.733, 105.607] | 168.109 [118.491, 296.586] | 380.827 [163.380, 420.876] | 33.16–157.41 | 0 / 30 |
| hl-strict-cold/cpu50ms · CPU-ms/VM · all | 30 / 0 | 43.385 [29.582, 53.245] | 55.456 [54.775, 55.764] | 57.442 [55.431, 58.240] | 33.16–157.41 | 0 / 30 |
| jitk-parked/return2 · ms · all | 30 / 0 | 1.807 [0.511, 3.757] | 9.626 [5.867, 27.936] | 78.813 [9.429, 103.000] | 31.06–156.98 | 0 / 30 |
| jitk-parked/return2 · CPU-ms/VM · all | 30 / 0 | 13.875 [11.542, 18.099] | 24.094 [18.873, 25.367] | 29.770 [23.763, 31.864] | 31.06–156.98 | 0 / 30 |
| jitk-parked/one_tool_5ms · ms · all | 30 / 0 | 12.840 [8.533, 21.714] | 68.991 [26.481, 93.154] | 120.431 [61.868, 133.399] | 31.06–153.70 | 0 / 30 |
| jitk-parked/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 17.620 [12.433, 25.921] | 32.980 [27.582, 36.201] | 41.292 [32.482, 43.713] | 31.06–153.70 | 0 / 30 |
| jitk-parked/promise10_5ms · ms · all | 30 / 0 | 18.643 [9.259, 42.958] | 154.839 [85.853, 274.609] | 515.630 [139.854, 630.214] | 33.16–159.16 | 0 / 30 |
| jitk-parked/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 23.619 [17.246, 29.785] | 39.776 [32.869, 49.236] | 59.566 [39.050, 64.477] | 33.16–159.16 | 0 / 30 |
| jitk-parked/json1m · ms · all | 30 / 0 | 12.138 [10.836, 14.827] | 41.261 [16.486, 60.518] | 77.815 [34.763, 86.039] | 33.16–156.98 | 0 / 30 |
| jitk-parked/json1m · CPU-ms/VM · all | 30 / 0 | 22.992 [20.953, 28.204] | 33.348 [29.726, 38.980] | 40.549 [32.432, 41.295] | 33.16–156.98 | 0 / 30 |
| jitk-parked/cpu50ms · ms · all | 30 / 0 | 56.102 [52.459, 70.692] | 143.415 [90.065, 246.758] | 254.159 [140.233, 257.678] | 33.16–159.16 | 0 / 30 |
| jitk-parked/cpu50ms · CPU-ms/VM · all | 30 / 0 | 52.451 [43.034, 56.931] | 62.429 [57.478, 66.751] | 70.137 [61.687, 71.746] | 33.16–159.16 | 0 / 30 |
| hl-strict-prespawned/return2 · ms · all | 30 / 0 | 7.401 [3.781, 16.605] | 34.097 [17.841, 74.618] | 81.006 [29.329, 84.043] | 33.16–159.16 | 0 / 30 |
| hl-strict-prespawned/return2 · CPU-ms/VM · all | 30 / 0 | 8.791 [7.929, 9.258] | 11.951 [9.824, 12.585] | 12.707 [11.615, 12.765] | 33.16–159.16 | 0 / 30 |
| hl-strict-prespawned/one_tool_5ms · ms · all | 30 / 0 | 13.673 [9.909, 19.533] | 56.806 [24.235, 125.095] | 129.820 [51.747, 132.066] | 33.16–156.98 | 0 / 30 |
| hl-strict-prespawned/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 8.158 [7.382, 8.571] | 11.330 [9.980, 12.087] | 13.615 [11.230, 14.341] | 33.16–156.98 | 0 / 30 |
| hl-strict-prespawned/promise10_5ms · ms · all | 30 / 0 | 92.744 [77.837, 196.180] | 343.938 [206.890, 356.770] | 396.402 [331.524, 415.244] | 33.16–156.98 | 0 / 30 |
| hl-strict-prespawned/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 10.021 [9.212, 10.866] | 13.649 [11.561, 14.405] | 14.572 [13.340, 14.651] | 33.16–156.98 | 0 / 30 |
| hl-strict-prespawned/json1m · ms · all | 30 / 0 | 24.081 [17.876, 34.925] | 96.593 [47.079, 174.000] | 294.831 [91.096, 352.275] | 31.06–156.98 | 0 / 30 |
| hl-strict-prespawned/json1m · CPU-ms/VM · all | 30 / 0 | 22.807 [21.591, 24.844] | 27.853 [25.159, 29.771] | 29.903 [27.458, 29.965] | 31.06–156.98 | 0 / 30 |
| hl-strict-prespawned/cpu50ms · ms · all | 30 / 0 | 62.200 [52.520, 78.328] | 137.384 [86.412, 223.920] | 264.269 [123.537, 283.451] | 31.06–153.70 | 0 / 30 |
| hl-strict-prespawned/cpu50ms · CPU-ms/VM · all | 30 / 0 | 49.937 [30.807, 54.662] | 55.785 [55.303, 57.855] | 58.181 [55.667, 58.336] | 31.06–153.70 | 0 / 30 |
| hl-logical-clone/return2 · ms · all | 30 / 0 | 1.561 [1.147, 14.007] | 35.362 [16.514, 115.580] | 214.991 [33.847, 262.252] | 33.16–159.16 | 0 / 30 |
| hl-logical-clone/one_tool_5ms · ms · all | 30 / 0 | 10.656 [8.588, 12.601] | 28.177 [14.390, 40.751] | 47.126 [26.072, 50.157] | 33.16–156.98 | 0 / 30 |
| hl-logical-clone/promise10_5ms · ms · all | 30 / 0 | 81.496 [72.522, 112.246] | 240.981 [150.626, 307.197] | 350.474 [234.278, 371.049] | 31.06–159.16 | 0 / 30 |
| hl-logical-clone/json1m · ms · all | 30 / 0 | 19.022 [16.016, 45.403] | 116.997 [53.998, 203.002] | 230.113 [109.589, 243.002] | 31.06–154.01 | 0 / 30 |
| hl-logical-clone/cpu50ms · ms · all | 30 / 0 | 57.202 [51.544, 69.022] | 90.846 [79.776, 138.564] | 166.230 [90.467, 179.383] | 31.06–157.41 | 0 / 30 |
| memory/jitk/1 · MiB RSS · all | 30 / 0 | 15.414 [15.398, 15.438] | 15.500 [15.453, 15.505] | 15.533 [15.491, 15.547] | 33.16–156.98 | 0 / 30 |
| memory/jitk/1 · MiB footprint · all | 30 / 0 | 10.657 [10.625, 10.696] | 10.752 [10.719, 10.772] | 10.811 [10.751, 10.829] | 33.16–156.98 | 0 / 30 |
| memory/hl-strict/1 · MiB RSS · all | 30 / 0 | 6.961 [6.953, 6.969] | 6.984 [6.984, 6.986] | 6.995 [6.984, 7.000] | 33.16–153.70 | 0 / 30 |
| memory/hl-strict/1 · MiB footprint · all | 30 / 0 | 1.782 [1.766, 1.782] | 1.797 [1.797, 1.799] | 1.808 [1.797, 1.813] | 33.16–153.70 | 0 / 30 |
| memory/hl-logical/1 · MiB RSS · all | 30 / 0 | 6.953 [6.953, 6.969] | 6.984 [6.969, 6.984] | 6.984 [6.984, 6.984] | 33.16–159.16 | 0 / 30 |
| memory/hl-logical/1 · MiB footprint · all | 30 / 0 | 1.766 [1.766, 1.782] | 1.797 [1.797, 1.797] | 1.797 [1.797, 1.797] | 33.16–159.16 | 0 / 30 |
| memory/hl-logical/17 · MiB RSS · all | 30 / 0 | 9.625 [9.617, 9.641] | 9.672 [9.656, 9.673] | 9.683 [9.667, 9.688] | 33.16–157.41 | 0 / 30 |
| memory/hl-logical/17 · MiB footprint · all | 30 / 0 | 4.563 [4.563, 4.579] | 4.610 [4.594, 4.613] | 4.632 [4.605, 4.641] | 33.16–157.41 | 0 / 30 |
| memory/hl-logical/33 · MiB RSS · all | 30 / 0 | 12.203 [12.188, 12.211] | 12.250 [12.219, 12.281] | 12.281 [12.245, 12.281] | 31.06–157.41 | 0 / 30 |
| memory/hl-logical/33 · MiB footprint · all | 30 / 0 | 7.266 [7.251, 7.282] | 7.315 [7.285, 7.344] | 7.344 [7.309, 7.344] | 31.06–157.41 | 0 / 30 |

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
  "canonical_controller_sha256": "687099cdf7431436d39795d82293de1370aa8be583d08b48f2a2515b541fa82e",
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
  },
  "snapshot_evidence": {
    "recorded_after_run": true,
    "index": {
      "schemaVersion": 2,
      "mediaType": "application/vnd.oci.image.index.v1+json",
      "manifests": [
        {
          "mediaType": "application/vnd.oci.image.manifest.v1+json",
          "digest": "sha256:120ce90b0f14bc00f3f45817c3c61026c8467f7797c54753b626e754655a11d1",
          "size": 760,
          "annotations": {
            "dev.hyperlight.snapshot.hypervisor": "hvf",
            "org.opencontainers.image.ref.name": "base",
            "dev.hyperlight.snapshot.cpu.vendor": "0x61",
            "dev.hyperlight.snapshot.arch": "aarch64"
          }
        }
      ]
    },
    "index_sha256": "a5b7ccf1561aa452b6e0e1edd9ab2e499bbd58f085ae06b4203b2ba272e3fa09",
    "note": "No snapshot writes occurred during the run; tenant-free snapshot built before smoke and retained unchanged."
  }
}
```

Missing integrations: 04 integrated executor READY at start; authorized raw r2 channel used.
Raw observations, timestamps, gate histories, result assertions, machine state, hashes and failures: [raw.json](raw.json).
All external performance claims must cite this table. R2 tables are historical contended measurements.
