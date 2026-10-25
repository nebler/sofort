# Canonical benchmark results

Run: 2026-10-24T10:57:10.933877+00:00 → 2026-10-24T10:58:02.616103+00:00. Platform: macOS-26.6.1-arm64-arm-64bit-Mach-O.
Start: `12:57  up 14:10, 2 users, load averages: 5.24 3.62 3.14`. End: `12:58  up 14:11, 2 users, load averages: 4.00 3.52 3.13`.

Gate: load1 < 6; 10 s budget/sample. Randomized complete blocks; seed 603.
Cold = spawn → validated done; parked = RUN → validated done after READY and 5 ms idle. Tools return asynchronously after 0 or 5 ms as named. JSON case parses/stringifies exactly 1 MiB internally, returns its length (not a 1 MiB protocol frame).
Executor = execute() → validated result; Node startup/pool preparation excluded. Refill = READY + kill/reap, 4 waves per sample. CPU = child user+system through reap; watchdog/supervisor excluded. Parked memory = process RSS/physical footprint, excludes HVF kernel allocations. Sandbox on/off = precompiled sandbox_apply versus clock-only baseline, no VM; not an end-to-end subtraction.
Cached binary/image/signature runs; first validation excluded. Single-use hardware VM except explicitly shared-HW Hyperlight logical clones. No nested-KVM performance.

Values and brackets: estimate [95% bootstrap CI], 2,000 IID resamples. Quantiles interpolate order statistics. n=30 p99 is poorly resolved; CI does not remove contention or serial dependence.
**Quiet credibility requires ≥30 gate-passed samples per row. A timed-out gate remains a contended sample; no idle-host conclusion follows. Latency percentiles are conditional on validated results; failures are counted separately and never treated as zero-latency successes.**

| Case / metric | n / fail | p50 [CI95] | p90 [CI95] | p99 [CI95] | load1 range | gated / timed-out |
|---|---:|---:|---:|---:|---:|---:|
| jitk-cold/return2 · ms · all | 30 / 0 | 6.285 [6.058, 6.511] | 7.002 [6.702, 7.298] | 7.473 [6.970, 7.556] | 4.00–5.24 | 30 / 0 |
| jitk-cold/return2 · CPU-ms/VM · all | 30 / 0 | 5.041 [4.980, 5.201] | 5.625 [5.357, 5.655] | 5.670 [5.612, 5.677] | 4.00–5.24 | 30 / 0 |
| jitk-cold/one_tool · ms · all | 30 / 0 | 6.280 [6.103, 6.597] | 7.071 [6.688, 7.349] | 7.563 [7.052, 7.665] | 4.00–5.24 | 30 / 0 |
| jitk-cold/one_tool · CPU-ms/VM · all | 30 / 0 | 5.135 [5.032, 5.245] | 5.503 [5.357, 5.765] | 6.193 [5.497, 6.396] | 4.00–5.24 | 30 / 0 |
| jitk-cold/one_tool_5ms · ms · all | 30 / 0 | 12.381 [12.214, 12.572] | 12.976 [12.663, 13.642] | 13.900 [12.971, 14.023] | 4.00–5.24 | 30 / 0 |
| jitk-cold/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 5.017 [4.909, 5.171] | 5.448 [5.184, 5.809] | 6.140 [5.415, 6.297] | 4.00–5.24 | 30 / 0 |
| jitk-cold/promise10_5ms · ms · all | 30 / 0 | 12.567 [12.317, 12.886] | 13.338 [13.055, 14.433] | 15.158 [13.230, 15.503] | 4.00–5.24 | 30 / 0 |
| jitk-cold/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 5.393 [5.274, 5.649] | 6.420 [5.981, 7.108] | 7.818 [6.337, 8.156] | 4.00–5.24 | 30 / 0 |
| jitk-cold/json1m · ms · all | 30 / 0 | 10.456 [10.312, 10.668] | 11.373 [10.787, 11.563] | 11.719 [11.340, 11.793] | 4.00–5.24 | 30 / 0 |
| jitk-cold/json1m · CPU-ms/VM · all | 30 / 0 | 9.308 [9.178, 9.387] | 9.865 [9.466, 10.168] | 10.360 [9.826, 10.451] | 4.00–5.24 | 30 / 0 |
| jitk-parked-raw/return2 · ms · all | 30 / 0 | 0.195 [0.179, 0.215] | 0.260 [0.237, 0.286] | 0.304 [0.256, 0.313] | 4.00–5.24 | 30 / 0 |
| jitk-parked-raw/return2 · CPU-ms/VM · all | 30 / 0 | 5.061 [4.920, 5.287] | 5.690 [5.424, 5.907] | 5.921 [5.666, 5.927] | 4.00–5.24 | 30 / 0 |
| jitk-parked-raw/one_tool · ms · all | 30 / 0 | 0.261 [0.245, 0.302] | 0.381 [0.314, 0.393] | 0.397 [0.376, 0.399] | 4.00–5.24 | 30 / 0 |
| jitk-parked-raw/one_tool · CPU-ms/VM · all | 30 / 0 | 5.159 [5.077, 5.339] | 6.131 [5.443, 6.188] | 6.279 [6.001, 6.323] | 4.00–5.24 | 30 / 0 |
| jitk-parked-raw/one_tool_5ms · ms · all | 30 / 0 | 6.502 [6.479, 6.518] | 6.649 [6.533, 6.727] | 6.881 [6.634, 6.954] | 4.00–5.24 | 30 / 0 |
| jitk-parked-raw/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 5.151 [4.990, 5.283] | 5.766 [5.510, 6.204] | 6.221 [5.749, 6.229] | 4.00–5.24 | 30 / 0 |
| jitk-parked-raw/promise10_5ms · ms · all | 30 / 0 | 6.517 [6.500, 6.553] | 6.642 [6.602, 6.698] | 6.720 [6.636, 6.731] | 4.00–5.24 | 30 / 0 |
| jitk-parked-raw/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 5.468 [5.407, 5.744] | 6.287 [5.836, 6.366] | 6.428 [6.208, 6.458] | 4.00–5.24 | 30 / 0 |
| jitk-parked-raw/json1m · ms · all | 30 / 0 | 4.655 [4.584, 4.753] | 4.923 [4.787, 5.095] | 5.476 [4.893, 5.657] | 4.00–5.24 | 30 / 0 |
| jitk-parked-raw/json1m · CPU-ms/VM · all | 30 / 0 | 9.537 [9.363, 9.669] | 10.292 [9.726, 11.138] | 11.385 [10.250, 11.502] | 4.00–5.24 | 30 / 0 |
| jitk-refill/4 · VM/s · all | 30 / 0 | 502.749 [493.693, 509.880] | 518.449 [511.047, 532.095] | 532.274 [518.181, 532.360] | 4.00–5.24 | 30 / 0 |
| jitk-refill/4 · CPU-ms/VM · all | 30 / 0 | 4.682 [4.633, 4.768] | 5.149 [4.839, 5.640] | 6.305 [5.082, 6.621] | 4.00–5.24 | 30 / 0 |
| jitk-refill/8 · VM/s · all | 30 / 0 | 666.531 [648.030, 691.380] | 719.267 [700.747, 724.385] | 728.191 [717.559, 730.001] | 4.00–5.24 | 30 / 0 |
| jitk-refill/8 · CPU-ms/VM · all | 30 / 0 | 4.899 [4.844, 4.982] | 5.245 [5.030, 5.496] | 5.699 [5.206, 5.796] | 4.00–5.24 | 30 / 0 |
| jitk-parked-memory/one_tool · ms · all | 30 / 0 | 0.298 [0.283, 0.313] | 0.369 [0.335, 0.409] | 0.422 [0.367, 0.428] | 4.00–5.24 | 30 / 0 |
| jitk-parked-memory/one_tool · CPU-ms/VM · all | 30 / 0 | 5.215 [5.061, 5.276] | 5.856 [5.465, 6.321] | 6.419 [5.804, 6.465] | 4.00–5.24 | 30 / 0 |
| jitk-parked-memory/one_tool · MiB RSS · all | 30 / 0 | 15.344 [15.344, 15.359] | 15.375 [15.359, 15.380] | 15.408 [15.375, 15.422] | 4.00–5.24 | 30 / 0 |
| jitk-parked-memory/one_tool · MiB footprint · all | 30 / 0 | 10.672 [10.657, 10.672] | 10.688 [10.674, 10.707] | 10.726 [10.688, 10.735] | 4.00–5.24 | 30 / 0 |
| sandbox-apply/on · ms sandbox_apply · all | 30 / 0 | 0.022 [0.020, 0.023] | 0.025 [0.024, 0.031] | 0.031 [0.025, 0.031] | 4.00–5.24 | 30 / 0 |
| sandbox-apply/on · ms profile-read+apply · all | 30 / 0 | 0.040 [0.038, 0.041] | 0.045 [0.042, 0.050] | 0.060 [0.045, 0.065] | 4.00–5.24 | 30 / 0 |
| sandbox-apply/off · ms sandbox_apply · all | 30 / 0 | 0.000 [0.000, 0.000] | 0.000 [0.000, 0.000] | 0.000 [0.000, 0.000] | 4.00–5.24 | 30 / 0 |
| sandbox-apply/off · ms profile-read+apply · all | 30 / 0 | 0.018 [0.017, 0.019] | 0.021 [0.020, 0.023] | 0.026 [0.021, 0.027] | 4.00–5.24 | 30 / 0 |
| hl-strict/return2 · ms · all | 30 / 0 | 5.084 [4.978, 5.261] | 5.831 [5.664, 5.885] | 6.139 [5.807, 6.260] | 4.00–5.24 | 30 / 0 |
| hl-strict/return2 · CPU-ms/VM · all | 30 / 0 | 3.651 [3.543, 3.760] | 4.085 [3.860, 4.139] | 4.246 [4.082, 4.297] | 4.00–5.24 | 30 / 0 |
| hl-strict/one_tool · ms · all | 30 / 0 | 5.127 [4.897, 5.253] | 6.153 [5.324, 6.286] | 6.479 [6.051, 6.571] | 4.00–5.24 | 30 / 0 |
| hl-strict/one_tool · CPU-ms/VM · all | 30 / 0 | 3.718 [3.641, 3.789] | 4.226 [3.858, 4.598] | 4.632 [4.204, 4.649] | 4.00–5.24 | 30 / 0 |
| hl-strict/one_tool_5ms · ms · all | 30 / 0 | 11.431 [11.144, 11.702] | 12.435 [11.816, 15.831] | 17.391 [12.322, 18.133] | 4.00–5.24 | 30 / 0 |
| hl-strict/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 3.784 [3.702, 3.896] | 4.254 [3.938, 5.867] | 6.721 [4.173, 7.127] | 4.00–5.24 | 30 / 0 |
| hl-strict/promise10_5ms · ms · all | 30 / 0 | 67.043 [66.548, 67.519] | 67.829 [67.604, 68.061] | 68.504 [67.820, 68.714] | 4.00–5.24 | 30 / 0 |
| hl-strict/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 4.127 [4.036, 4.363] | 4.946 [4.452, 5.423] | 5.645 [4.932, 5.750] | 4.00–5.24 | 30 / 0 |
| hl-strict/json1m · ms · all | 30 / 0 | 12.925 [12.618, 13.163] | 13.722 [13.211, 14.399] | 15.112 [13.616, 15.451] | 4.00–5.24 | 30 / 0 |
| hl-strict/json1m · CPU-ms/VM · all | 30 / 0 | 11.495 [11.275, 11.730] | 11.906 [11.770, 12.624] | 13.585 [11.893, 14.041] | 4.00–5.24 | 30 / 0 |
| hl-strict-parked/return2 · ms · all | 30 / 0 | 0.569 [0.555, 0.586] | 0.624 [0.595, 0.705] | 0.743 [0.620, 0.762] | 4.00–5.24 | 30 / 0 |
| hl-strict-parked/return2 · CPU-ms/VM · all | 30 / 0 | 3.716 [3.622, 3.801] | 4.244 [3.889, 4.617] | 4.640 [4.185, 4.651] | 4.00–5.24 | 30 / 0 |
| hl-strict-parked/one_tool · ms · all | 30 / 0 | 0.654 [0.625, 0.686] | 0.772 [0.712, 0.884] | 0.886 [0.764, 0.887] | 4.00–5.24 | 30 / 0 |
| hl-strict-parked/one_tool · CPU-ms/VM · all | 30 / 0 | 3.740 [3.697, 3.879] | 4.115 [3.941, 4.528] | 4.723 [4.082, 4.816] | 4.00–5.24 | 30 / 0 |
| hl-strict-parked/one_tool_5ms · ms · all | 30 / 0 | 6.903 [6.865, 6.936] | 6.960 [6.948, 7.072] | 7.133 [6.955, 7.162] | 4.00–5.24 | 30 / 0 |
| hl-strict-parked/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 3.784 [3.682, 3.891] | 4.155 [3.936, 4.260] | 4.473 [4.124, 4.574] | 4.00–5.24 | 30 / 0 |
| hl-strict-parked/promise10_5ms · ms · all | 30 / 0 | 62.307 [61.644, 63.127] | 63.847 [63.232, 64.090] | 64.108 [63.779, 64.116] | 4.00–5.24 | 30 / 0 |
| hl-strict-parked/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 4.230 [4.118, 4.607] | 4.963 [4.787, 5.087] | 5.465 [4.958, 5.645] | 4.00–5.24 | 30 / 0 |
| hl-strict-parked/json1m · ms · all | 30 / 0 | 8.458 [8.389, 8.603] | 8.713 [8.660, 8.758] | 8.846 [8.701, 8.888] | 4.00–5.24 | 30 / 0 |
| hl-strict-parked/json1m · CPU-ms/VM · all | 30 / 0 | 11.558 [11.437, 11.740] | 11.859 [11.784, 12.130] | 12.156 [11.841, 12.168] | 4.00–5.24 | 30 / 0 |
| hl-clone/return2 · ms · all | 30 / 0 | 0.531 [0.512, 0.551] | 0.628 [0.575, 0.678] | 0.764 [0.620, 0.806] | 4.00–5.24 | 30 / 0 |
| hl-clone/one_tool · ms · all | 30 / 0 | 0.592 [0.578, 0.624] | 0.709 [0.654, 0.816] | 1.257 [0.706, 1.467] | 4.00–5.24 | 30 / 0 |
| hl-clone/one_tool_5ms · ms · all | 30 / 0 | 6.880 [6.857, 6.896] | 6.972 [6.921, 6.991] | 7.038 [6.960, 7.060] | 4.00–5.24 | 30 / 0 |
| hl-clone/promise10_5ms · ms · all | 30 / 0 | 62.397 [62.205, 62.932] | 63.592 [63.342, 63.859] | 64.042 [63.576, 64.129] | 4.00–5.24 | 30 / 0 |
| hl-clone/json1m · ms · all | 30 / 0 | 8.420 [8.271, 8.559] | 8.789 [8.595, 9.563] | 9.848 [8.759, 9.983] | 4.00–5.24 | 30 / 0 |
| hl-parked-memory/one_tool · ms · all | 30 / 0 | 0.695 [0.666, 0.721] | 0.816 [0.741, 0.891] | 1.126 [0.808, 1.238] | 4.00–5.24 | 30 / 0 |
| hl-parked-memory/one_tool · CPU-ms/VM · all | 30 / 0 | 3.768 [3.684, 3.899] | 4.282 [3.948, 4.517] | 4.793 [4.261, 4.924] | 4.00–5.24 | 30 / 0 |
| hl-parked-memory/one_tool · MiB RSS · all | 30 / 0 | 7.047 [7.047, 7.047] | 7.064 [7.047, 7.078] | 7.078 [7.062, 7.078] | 4.00–5.24 | 30 / 0 |
| hl-parked-memory/one_tool · MiB footprint · all | 30 / 0 | 1.813 [1.813, 1.813] | 1.830 [1.828, 1.844] | 1.844 [1.829, 1.844] | 4.00–5.24 | 30 / 0 |
| executor-cold/return2 · ms · all | 30 / 0 | 9.241 [9.074, 9.399] | 10.160 [9.521, 10.716] | 10.952 [10.009, 11.064] | 4.00–5.24 | 30 / 0 |
| executor-cold/return2 · ms done→resolve · all | 30 / 0 | 0.079 [0.075, 0.084] | 0.100 [0.092, 0.120] | 0.128 [0.099, 0.132] | 4.00–5.24 | 30 / 0 |
| executor-cold/one_tool · ms · all | 30 / 0 | 9.597 [9.472, 9.733] | 10.364 [9.817, 11.143] | 11.316 [10.288, 11.398] | 4.00–5.24 | 30 / 0 |
| executor-cold/one_tool · ms done→resolve · all | 30 / 0 | 0.049 [0.046, 0.055] | 0.063 [0.058, 0.076] | 0.110 [0.062, 0.126] | 4.00–5.24 | 30 / 0 |
| executor-cold/one_tool_5ms · ms · all | 30 / 0 | 15.288 [15.087, 15.421] | 15.922 [15.550, 16.182] | 16.529 [15.861, 16.695] | 4.00–5.24 | 30 / 0 |
| executor-cold/one_tool_5ms · ms done→resolve · all | 30 / 0 | 0.050 [0.045, 0.057] | 0.072 [0.060, 0.075] | 0.079 [0.069, 0.081] | 4.00–5.24 | 30 / 0 |
| executor-cold/promise10_5ms · ms · all | 30 / 0 | 16.186 [15.889, 16.391] | 16.809 [16.504, 16.926] | 17.123 [16.755, 17.216] | 4.00–5.24 | 30 / 0 |
| executor-cold/promise10_5ms · ms done→resolve · all | 30 / 0 | 0.064 [0.055, 0.071] | 0.081 [0.073, 0.111] | 0.124 [0.079, 0.130] | 4.00–5.24 | 30 / 0 |
| executor-cold/json1m · ms · all | 30 / 0 | 14.638 [14.432, 14.764] | 15.644 [14.841, 16.166] | 17.368 [15.577, 17.940] | 4.00–5.24 | 30 / 0 |
| executor-cold/json1m · ms done→resolve · all | 30 / 0 | 0.100 [0.091, 0.117] | 0.146 [0.126, 0.177] | 0.282 [0.144, 0.333] | 4.00–5.24 | 30 / 0 |
| executor-parked/return2 · ms · all | 30 / 0 | 2.385 [2.344, 2.451] | 2.580 [2.487, 2.729] | 2.815 [2.570, 2.856] | 4.00–5.24 | 30 / 0 |
| executor-parked/return2 · ms done→resolve · all | 30 / 0 | 0.071 [0.066, 0.075] | 0.082 [0.078, 0.087] | 0.091 [0.082, 0.093] | 4.00–5.24 | 30 / 0 |
| executor-parked/one_tool · ms · all | 30 / 0 | 2.882 [2.849, 2.945] | 3.204 [2.988, 3.394] | 3.403 [3.164, 3.407] | 4.00–5.24 | 30 / 0 |
| executor-parked/one_tool · ms done→resolve · all | 30 / 0 | 0.047 [0.045, 0.052] | 0.066 [0.057, 0.067] | 0.069 [0.066, 0.070] | 4.00–5.24 | 30 / 0 |
| executor-parked/one_tool_5ms · ms · all | 30 / 0 | 8.609 [8.512, 8.779] | 8.862 [8.814, 9.347] | 10.401 [8.847, 10.902] | 4.00–5.24 | 30 / 0 |
| executor-parked/one_tool_5ms · ms done→resolve · all | 30 / 0 | 0.048 [0.047, 0.057] | 0.070 [0.059, 0.076] | 0.079 [0.067, 0.081] | 4.00–5.24 | 30 / 0 |
| executor-parked/promise10_5ms · ms · all | 30 / 0 | 9.262 [8.479, 9.448] | 9.631 [9.547, 9.826] | 10.274 [9.623, 10.487] | 4.00–5.24 | 30 / 0 |
| executor-parked/promise10_5ms · ms done→resolve · all | 30 / 0 | 0.059 [0.054, 0.066] | 0.083 [0.070, 0.110] | 0.165 [0.081, 0.191] | 4.00–5.24 | 30 / 0 |
| executor-parked/json1m · ms · all | 30 / 0 | 7.821 [7.699, 7.901] | 8.103 [7.923, 8.259] | 8.397 [8.074, 8.463] | 4.00–5.24 | 30 / 0 |
| executor-parked/json1m · ms done→resolve · all | 30 / 0 | 0.078 [0.072, 0.087] | 0.108 [0.096, 0.113] | 0.127 [0.106, 0.134] | 4.00–5.24 | 30 / 0 |

Source selection (frozen at run start):

```json
{
  "kernel_source": "canonical kernel",
  "vmm_source": "explicit override",
  "source_image": "/private/tmp/jitk-lead/wd/tree-42706/kernel/dist/kernel.bin",
  "image_sha256": "a7c39ab5679e75d3242f6f318cd5367ff866380e8f509085e974a49f1b6a6364",
  "image": "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/kernel.bin",
  "source_vmm": "/private/tmp/jitk-lead/wd/tree-42706-work/vmm/jitk-vmm",
  "vmm_sha256": "b5eab5613e5e0830f7c625e1f62fb76c6518c862403b47cb17e5df92476f1da3",
  "vmm": "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/jitk-vmm",
  "argv": [
    "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/jitk-vmm",
    "--image",
    "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/kernel.bin",
    "--mem-mib",
    "32",
    "--sandbox-profile",
    "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/jitk.sbbin"
  ],
  "require_sandbox_ack": true,
  "sandbox_profile": "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/jitk.sbbin",
  "sandbox_profile_sha256": "5e4305fb5f964463a79a8696031bb5d47a541fdc99e22f3f8447e362d44ab169",
  "sandbox_probe": {
    "binary": "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/sandbox-probe",
    "profile": "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/jitk.sbbin",
    "profile_sha256": "5e4305fb5f964463a79a8696031bb5d47a541fdc99e22f3f8447e362d44ab169",
    "source": "canonical precompiled profile; sandbox_apply call only, no VM"
  },
  "hyperlight": {
    "strict_argv": [
      "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/hyperlight-worker",
      "strict",
      "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/hyperlight-snapshot"
    ],
    "clone_argv": [
      "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/hyperlight-worker",
      "clone",
      "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/hyperlight-snapshot"
    ],
    "env": {},
    "provenance": "Paths relative to this descriptor; build.sh generates absolute paths for the selected outputs. Hyperlight host 0.18.0; strict fresh single-use HW VM; clone shared HW VM; panic=abort",
    "files": [
      "worker.rs",
      "bootstrap.js",
      "Cargo.lock",
      "build/target/release/r2-worker",
      "build/snapshot/index.json"
    ],
    "descriptor_sha256": "5824a9daeebe19e3ae9958fddd40c42a9eff474ae1bce8c403b904f5eb88935b",
    "hashes": {},
    "source_argv": {
      "strict_argv": [
        "/tmp/jitk-10/r4/relocated-cb18d3d39ccd-work/external-inputs/HYPERLIGHT_WORKER/r2-worker",
        "strict",
        "/tmp/jitk-10/r4/relocated-cb18d3d39ccd-work/external-inputs/HYPERLIGHT_SNAPSHOT/r3-snapshot"
      ],
      "clone_argv": [
        "/tmp/jitk-10/r4/relocated-cb18d3d39ccd-work/external-inputs/HYPERLIGHT_WORKER/r2-worker",
        "clone",
        "/tmp/jitk-10/r4/relocated-cb18d3d39ccd-work/external-inputs/HYPERLIGHT_SNAPSHOT/r3-snapshot"
      ]
    },
    "frozen_snapshot_hashes": {
      "oci-layout": "18f0797eab35a4597c1e9624aa4f15fd91f6254e5538c1e0d193b2a95dd4acc6",
      "index.json": "a5b7ccf1561aa452b6e0e1edd9ab2e499bbd58f085ae06b4203b2ba272e3fa09",
      "blobs/sha256/622f0d2263988918d0676e9e668a89d957538f7bff7c15e7aaf67976416e737e": "622f0d2263988918d0676e9e668a89d957538f7bff7c15e7aaf67976416e737e",
      "blobs/sha256/88d5262ae7d3bfe1d7da551e336888787e9ac24ab20d19591d79c3d699d55c8b": "88d5262ae7d3bfe1d7da551e336888787e9ac24ab20d19591d79c3d699d55c8b",
      "blobs/sha256/120ce90b0f14bc00f3f45817c3c61026c8467f7797c54753b626e754655a11d1": "120ce90b0f14bc00f3f45817c3c61026c8467f7797c54753b626e754655a11d1",
      "blobs/sha256/2fd2c2bbd6d6e60f4e6f631dbc96c7b26b73270648c33fda7f9cf868509f82e7": "2fd2c2bbd6d6e60f4e6f631dbc96c7b26b73270648c33fda7f9cf868509f82e7"
    }
  },
  "executor": {
    "source": "/private/tmp/jitk-lead/wd/tree-42706/executor",
    "integrated": true,
    "build": "/private/tmp/jitk-lead/wd/bench-scratch/jitk-bench-o23gzlts/executor/build",
    "node_modules": "/private/tmp/jitk-lead/wd/tree-42706/executor/node_modules",
    "runtime_sha256": {
      "cloudflare-github.generated.mjs": "bd8e51a8f4af8ece7e8e623f11292d73e3fb6c3acd2ab20d15807d86f1df9289",
      "cloudflare-binary.generated.mjs": "f4480e16e698c82ae58b544dde477f126160b3c900e4b3e7d21047c35fe7d860",
      "certify.mjs": "cbf70a3352970c1e1321dff1043b2c954a764cfc4e58292d86b7787d8a6c3047",
      "codec.mjs": "731af9e407afbaf004de467ec7eb802036cb70e420818f8c155cad7f39a48b7e",
      "build.mjs": "57d6024c41d02e99171c385c36c9d874412679c13cc7f3acf940b5ffc9c7092c",
      "fixtures/protocol-peer.mjs": "9e0ca4b0c0c2638af9d99d27bbd10b237d92fb852bc2e36cf8e63fd9c18c413c",
      "fixtures/ack-peer.mjs": "8696aaf17f2c4ed2159ccaf03a4ad86698a4f44437daa5743dffcf7d0ed992c0",
      "build/resolve-check.js": "a1fbd553299fe7505e817b52b4273fc75912545df39d799d5b60d4d7a87a0cb1",
      "build/sandbox-check.js": "995ab3d8f19d5676fe779c44b58890b3a1a692f7ecccf34be4dcb6dfc09984b9",
      "build/code.js": "8542ca147509d9bce0f330b857a2565377b488f3ae37b1e3db00bf2674b5d7c6",
      "build/select-backend.js": "243e9116792d0272c2d887843fb254317752dfa6746308177c31a5d14127bb26",
      "build/pool-check.js": "10952f0aee6c9ef419f45112569fd671308d5fc60c15890ae01c45bbbf51048b",
      "build/breakdown.js": "9bffd8384901361b5d2da45f226ad90573f98d90e1dd5615bc884730370aba16",
      "build/backend.js": "804fd52ed049eb0c4c6afbd69d07a706b0e83953ea61dd862b51895c598e14a4",
      "build/transport-check.js": "4cea401fc4c772e47f8896698f61e084fad5b84a68db2c0b9019d143d4b6400e",
      "build/policy-check.js": "695eb4aae55888122f31f358c2342c2a13b2e49d90fb3954cc1b12c85ecf1019",
      "build/pool.js": "dfc0cd7974e0b3aa5ca6a0637dbed561d15ea5dea6699b5556ecf1ab2f7fdfce",
      "build/demo.js": "66b656a8de1706684a9033faf1229091f7303a6292da5ff554513cb9b51b91b7",
      "build/verify.js": "97fa108abdf0828ac7def9e1b3bd22358e49731fb5224041624c594ed91fa15d",
      "build/codec.mjs": "731af9e407afbaf004de467ec7eb802036cb70e420818f8c155cad7f39a48b7e",
      "build/api-check.js": "c46cd10a67c1002835a243437bd7a98b992ac8114aeda7d4b72886d813bf4099",
      "build/policy-adapter.js": "6a0c8660cf3fcb545db264db27560b671c1fede91a705b81e78e15c47b2834a8",
      "build/executor.js": "66a1f4f5f1d058aa835549ebc4ba7b9b8eb060d2a5568836accfb5c08bce3c81",
      "build/providers.js": "689f0ecb60589b2fb2ca6ab68a874a839a7dfc3fbfb19ee55afd242608366a28",
      "build/upstream.js": "2e1b114d980f334ff9d0aeb97fa26f3fa91e36004294c21ad87634970e9302fc",
      "build/watchdog-check.js": "674147fb6df0ae3c979e77304a2d99a3f96dab6bc875d16169285dfed41569e9",
      "build/hyperlight-check.js": "e6d07f75acd43e15e0fc6fee4bf0fd96df82e891f4e16f9d108f87fcfeda22df",
      "build/wrapper-conformance.js": "848ec440ea72d52ab03f4ba6d9144f71b8b9492259991264a323f338e685499b",
      "policy/policy.mjs": "ca082e55f8cc8f2ea6944e5d18d95fd39f0d3ecebf02a780bfc0b055bce168a0",
      "policy/policy-test.mjs": "29e341d449ad9e8a1ebe18eab186ddb52a1bc6af234bc8958d9646221671a09c",
      "policy/policy-hostile.mjs": "da3bda12a752d21073b01cdec53c94accbb8d8b9135c35b9cc9528c58ab88f99",
      "vendor/codemode.mjs": "79091b106e34cbf8fd972d43b7c46d3a3a0c5b732f1fbfbc6cab5191cdd241db"
    }
  },
  "node": "/tmp/jitk-09/node-real",
  "node_runtime": "{\"execPath\":\"/private/tmp/jitk-09/node-real\",\"version\":\"v24.22.1\"}",
  "harness_sha256": {
    "run.py": "406b2ea3fa3747cb8c4cafb9d5b1f3802313020e1a22cf8b15fd75c195925d9d",
    "cases.json": "c00e3f14ac67000f7645a930c487a02123ea63c697dd05cd71e4186fc0034b46",
    "executor.mjs": "afba25fa20eb329c6e9feacb969ea501fff0eb2e797fefb980fc9b48e4d00b73",
    "watchdog.py": "4ce65e5616cbc2372929f53521292d8f710026ee1aac414629d526d5efee96d6",
    "sandbox_probe.c": "4ed83ff4c0e19e320d062f8b4b2e70c6b2bbae99d473c25f5a0a13be95667fbb",
    "processes.py": "37768574c5b4b9029600569cff4c73b9c383e79b2db9736b6f04640669254328"
  }
}
```

Missing integrations: .
Raw observations, timestamps, gate histories, result assertions, machine state, hashes and failures: [raw.json](raw.json).
All external performance claims must cite this table. R2 tables are historical contended measurements.
