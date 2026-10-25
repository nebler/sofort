# Canonical benchmark results

Run: 2026-10-24T10:13:09.926749+00:00 → 2026-10-24T10:14:14.753714+00:00. Platform: macOS-26.6.1-arm64-arm-64bit-Mach-O.
Start: `12:13  up 13:26, 2 users, load averages: 3.46 3.35 3.55`. End: `12:14  up 13:27, 2 users, load averages: 4.11 3.54 3.61`.

Gate: load1 < 6; 10 s budget/sample. Randomized complete blocks; seed 603.
Cold = spawn → validated done; parked = RUN → validated done after READY and 5 ms idle. Tools return asynchronously after 0 or 5 ms as named. JSON case parses/stringifies exactly 1 MiB internally, returns its length (not a 1 MiB protocol frame).
Executor = execute() → validated result; Node startup/pool preparation excluded. Refill = READY + kill/reap, 4 waves per sample. CPU = child user+system through reap; watchdog/supervisor excluded. Parked memory = process RSS/physical footprint, excludes HVF kernel allocations. Sandbox on/off = precompiled sandbox_apply versus clock-only baseline, no VM; not an end-to-end subtraction.
Cached binary/image/signature runs; first validation excluded. Single-use hardware VM except explicitly shared-HW Hyperlight logical clones. No nested-KVM performance.

Values and brackets: estimate [95% bootstrap CI], 2,000 IID resamples. Quantiles interpolate order statistics. n=30 p99 is poorly resolved; CI does not remove contention or serial dependence.
**Quiet credibility requires ≥30 gate-passed samples per row. A timed-out gate remains a contended sample; no idle-host conclusion follows. Latency percentiles are conditional on validated results; failures are counted separately and never treated as zero-latency successes.**

| Case / metric | n / fail | p50 [CI95] | p90 [CI95] | p99 [CI95] | load1 range | gated / timed-out |
|---|---:|---:|---:|---:|---:|---:|
| jitk-cold/return2 · ms · all | 30 / 0 | 5.904 [5.852, 6.054] | 6.674 [6.125, 7.106] | 7.172 [6.569, 7.203] | 3.28–4.13 | 30 / 0 |
| jitk-cold/return2 · CPU-ms/VM · all | 30 / 0 | 4.859 [4.789, 4.956] | 5.321 [5.036, 5.719] | 5.928 [5.274, 6.027] | 3.28–4.13 | 30 / 0 |
| jitk-cold/one_tool · ms · all | 30 / 0 | 6.048 [5.833, 6.384] | 6.802 [6.562, 6.895] | 6.903 [6.750, 6.907] | 3.28–4.13 | 30 / 0 |
| jitk-cold/one_tool · CPU-ms/VM · all | 30 / 0 | 4.917 [4.825, 5.280] | 5.504 [5.350, 5.527] | 5.566 [5.489, 5.584] | 3.28–4.13 | 30 / 0 |
| jitk-cold/one_tool_5ms · ms · all | 30 / 0 | 12.084 [11.905, 12.277] | 12.857 [12.346, 13.768] | 13.838 [12.717, 13.871] | 3.28–4.13 | 30 / 0 |
| jitk-cold/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 4.852 [4.812, 5.023] | 5.435 [5.129, 5.761] | 5.953 [5.409, 6.044] | 3.28–4.13 | 30 / 0 |
| jitk-cold/promise10_5ms · ms · all | 30 / 0 | 12.266 [12.156, 12.391] | 12.871 [12.494, 14.045] | 14.280 [12.833, 14.392] | 3.28–4.13 | 30 / 0 |
| jitk-cold/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 5.272 [5.135, 5.399] | 5.904 [5.548, 6.816] | 7.139 [5.830, 7.293] | 3.28–4.13 | 30 / 0 |
| jitk-cold/json1m · ms · all | 30 / 0 | 10.153 [9.963, 10.476] | 11.101 [10.615, 11.382] | 11.523 [11.005, 11.590] | 3.28–4.13 | 30 / 0 |
| jitk-cold/json1m · CPU-ms/VM · all | 30 / 0 | 9.152 [8.902, 9.357] | 9.920 [9.416, 10.229] | 10.318 [9.878, 10.361] | 3.28–4.13 | 30 / 0 |
| jitk-parked-raw/return2 · ms · all | 30 / 0 | 0.183 [0.176, 0.189] | 0.206 [0.194, 0.220] | 0.222 [0.205, 0.222] | 3.28–4.13 | 30 / 0 |
| jitk-parked-raw/return2 · CPU-ms/VM · all | 30 / 0 | 4.801 [4.760, 4.861] | 5.209 [4.944, 5.953] | 5.986 [5.147, 6.002] | 3.28–4.13 | 30 / 0 |
| jitk-parked-raw/one_tool · ms · all | 30 / 0 | 0.285 [0.274, 0.302] | 0.340 [0.316, 0.349] | 0.360 [0.336, 0.365] | 3.28–4.13 | 30 / 0 |
| jitk-parked-raw/one_tool · CPU-ms/VM · all | 30 / 0 | 4.841 [4.784, 5.104] | 6.093 [5.234, 6.666] | 6.780 [5.889, 6.834] | 3.28–4.13 | 30 / 0 |
| jitk-parked-raw/one_tool_5ms · ms · all | 30 / 0 | 6.530 [6.508, 6.536] | 6.573 [6.554, 6.608] | 6.687 [6.568, 6.725] | 3.28–4.13 | 30 / 0 |
| jitk-parked-raw/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 4.984 [4.806, 5.015] | 5.175 [5.056, 5.506] | 5.578 [5.127, 5.613] | 3.28–4.13 | 30 / 0 |
| jitk-parked-raw/promise10_5ms · ms · all | 30 / 0 | 6.544 [6.529, 6.553] | 6.644 [6.560, 6.667] | 6.668 [6.630, 6.668] | 3.28–4.13 | 30 / 0 |
| jitk-parked-raw/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 5.307 [5.213, 5.504] | 5.866 [5.531, 6.298] | 6.406 [5.809, 6.457] | 3.28–4.13 | 30 / 0 |
| jitk-parked-raw/json1m · ms · all | 30 / 0 | 4.474 [4.316, 4.561] | 5.109 [4.606, 5.500] | 5.698 [4.967, 5.791] | 3.28–4.13 | 30 / 0 |
| jitk-parked-raw/json1m · CPU-ms/VM · all | 30 / 0 | 9.083 [8.940, 9.326] | 10.540 [9.403, 11.121] | 11.175 [10.361, 11.201] | 3.28–4.13 | 30 / 0 |
| jitk-refill/4 · VM/s · all | 30 / 0 | 512.571 [509.104, 521.513] | 529.856 [523.103, 535.834] | 550.116 [529.064, 556.906] | 3.28–4.13 | 30 / 0 |
| jitk-refill/4 · CPU-ms/VM · all | 30 / 0 | 4.623 [4.585, 4.678] | 4.733 [4.687, 4.865] | 5.032 [4.718, 5.111] | 3.28–4.13 | 30 / 0 |
| jitk-refill/8 · VM/s · all | 30 / 0 | 683.721 [668.401, 703.414] | 736.243 [709.659, 747.369] | 751.267 [734.547, 753.121] | 3.28–4.13 | 30 / 0 |
| jitk-refill/8 · CPU-ms/VM · all | 30 / 0 | 4.792 [4.752, 4.849] | 4.889 [4.859, 5.106] | 5.109 [4.884, 5.111] | 3.28–4.13 | 30 / 0 |
| jitk-parked-memory/one_tool · ms · all | 30 / 0 | 0.304 [0.285, 0.320] | 0.356 [0.344, 0.414] | 0.456 [0.354, 0.476] | 3.28–4.13 | 30 / 0 |
| jitk-parked-memory/one_tool · CPU-ms/VM · all | 30 / 0 | 4.982 [4.889, 5.199] | 5.786 [5.406, 6.755] | 6.806 [5.696, 6.830] | 3.28–4.13 | 30 / 0 |
| jitk-parked-memory/one_tool · MiB RSS · all | 30 / 0 | 15.328 [15.312, 15.344] | 15.345 [15.344, 15.359] | 15.359 [15.344, 15.359] | 3.28–4.13 | 30 / 0 |
| jitk-parked-memory/one_tool · MiB footprint · all | 30 / 0 | 10.657 [10.657, 10.672] | 10.688 [10.672, 10.688] | 10.688 [10.688, 10.688] | 3.28–4.13 | 30 / 0 |
| sandbox-apply/on · ms sandbox_apply · all | 30 / 0 | 0.021 [0.020, 0.022] | 0.023 [0.022, 0.030] | 0.040 [0.023, 0.045] | 3.28–4.13 | 30 / 0 |
| sandbox-apply/on · ms profile-read+apply · all | 30 / 0 | 0.038 [0.037, 0.041] | 0.044 [0.042, 0.053] | 0.078 [0.044, 0.090] | 3.28–4.13 | 30 / 0 |
| sandbox-apply/off · ms sandbox_apply · all | 30 / 0 | 0.000 [0.000, 0.000] | 0.000 [0.000, 0.000] | 0.001 [0.000, 0.001] | 3.28–4.13 | 30 / 0 |
| sandbox-apply/off · ms profile-read+apply · all | 30 / 0 | 0.017 [0.016, 0.018] | 0.019 [0.018, 0.021] | 0.022 [0.019, 0.022] | 3.28–4.13 | 30 / 0 |
| hl-strict/return2 · ms · all | 30 / 0 | 4.767 [4.581, 4.910] | 5.416 [4.980, 5.546] | 5.800 [5.331, 5.920] | 3.28–4.13 | 30 / 0 |
| hl-strict/return2 · CPU-ms/VM · all | 30 / 0 | 3.537 [3.392, 3.639] | 3.882 [3.660, 4.348] | 4.408 [3.855, 4.437] | 3.28–4.13 | 30 / 0 |
| hl-strict/one_tool · ms · all | 30 / 0 | 4.942 [4.774, 5.078] | 5.338 [5.228, 5.475] | 5.561 [5.328, 5.601] | 3.28–4.13 | 30 / 0 |
| hl-strict/one_tool · CPU-ms/VM · all | 30 / 0 | 3.674 [3.559, 3.734] | 3.937 [3.773, 4.057] | 4.213 [3.913, 4.287] | 3.28–4.13 | 30 / 0 |
| hl-strict/one_tool_5ms · ms · all | 30 / 0 | 11.270 [11.122, 11.387] | 11.714 [11.503, 11.978] | 12.092 [11.684, 12.146] | 3.28–4.13 | 30 / 0 |
| hl-strict/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 3.710 [3.574, 3.810] | 4.114 [3.841, 4.152] | 4.203 [4.052, 4.227] | 3.28–4.13 | 30 / 0 |
| hl-strict/promise10_5ms · ms · all | 30 / 0 | 67.180 [66.679, 67.800] | 68.441 [68.196, 68.655] | 69.013 [68.416, 69.183] | 3.28–4.13 | 30 / 0 |
| hl-strict/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 4.134 [4.055, 4.271] | 4.712 [4.391, 4.973] | 5.012 [4.625, 5.030] | 3.28–4.13 | 30 / 0 |
| hl-strict/json1m · ms · all | 30 / 0 | 12.379 [12.081, 12.747] | 13.075 [12.850, 13.423] | 14.914 [13.066, 15.623] | 3.28–4.13 | 30 / 0 |
| hl-strict/json1m · CPU-ms/VM · all | 30 / 0 | 11.139 [10.950, 11.426] | 11.803 [11.545, 12.319] | 13.439 [11.802, 13.971] | 3.28–4.13 | 30 / 0 |
| hl-strict-parked/return2 · ms · all | 30 / 0 | 0.537 [0.521, 0.569] | 0.608 [0.586, 0.673] | 0.769 [0.605, 0.815] | 3.28–4.13 | 30 / 0 |
| hl-strict-parked/return2 · CPU-ms/VM · all | 30 / 0 | 3.587 [3.478, 3.707] | 4.261 [3.809, 4.447] | 5.070 [4.153, 5.366] | 3.28–4.13 | 30 / 0 |
| hl-strict-parked/one_tool · ms · all | 30 / 0 | 0.647 [0.632, 0.661] | 0.709 [0.668, 0.731] | 0.745 [0.708, 0.752] | 3.28–4.13 | 30 / 0 |
| hl-strict-parked/one_tool · CPU-ms/VM · all | 30 / 0 | 3.672 [3.576, 3.859] | 4.101 [3.909, 4.206] | 4.217 [4.079, 4.223] | 3.28–4.13 | 30 / 0 |
| hl-strict-parked/one_tool_5ms · ms · all | 30 / 0 | 6.902 [6.862, 6.941] | 7.015 [6.943, 7.033] | 7.045 [7.000, 7.050] | 3.28–4.13 | 30 / 0 |
| hl-strict-parked/one_tool_5ms · CPU-ms/VM · all | 30 / 0 | 3.675 [3.589, 3.800] | 4.223 [3.876, 4.351] | 4.366 [4.133, 4.373] | 3.28–4.13 | 30 / 0 |
| hl-strict-parked/promise10_5ms · ms · all | 30 / 0 | 63.209 [62.656, 63.892] | 64.015 [63.933, 64.169] | 64.294 [63.998, 64.353] | 3.28–4.13 | 30 / 0 |
| hl-strict-parked/promise10_5ms · CPU-ms/VM · all | 30 / 0 | 4.178 [4.141, 4.280] | 4.551 [4.357, 4.700] | 5.197 [4.534, 5.434] | 3.28–4.13 | 30 / 0 |
| hl-strict-parked/json1m · ms · all | 30 / 0 | 8.078 [7.990, 8.243] | 8.618 [8.303, 9.368] | 10.119 [8.556, 10.476] | 3.28–4.13 | 30 / 0 |
| hl-strict-parked/json1m · CPU-ms/VM · all | 30 / 0 | 11.158 [10.971, 11.389] | 11.845 [11.480, 12.660] | 13.846 [11.734, 14.410] | 3.28–4.13 | 30 / 0 |
| hl-clone/return2 · ms · all | 30 / 0 | 0.521 [0.495, 0.547] | 0.573 [0.560, 0.629] | 0.649 [0.569, 0.658] | 3.28–4.13 | 30 / 0 |
| hl-clone/one_tool · ms · all | 30 / 0 | 0.573 [0.557, 0.601] | 0.679 [0.627, 0.727] | 0.828 [0.676, 0.876] | 3.28–4.13 | 30 / 0 |
| hl-clone/one_tool_5ms · ms · all | 30 / 0 | 6.871 [6.840, 6.887] | 6.948 [6.892, 7.012] | 7.033 [6.941, 7.043] | 3.28–4.13 | 30 / 0 |
| hl-clone/promise10_5ms · ms · all | 30 / 0 | 62.818 [61.772, 63.223] | 63.791 [63.713, 63.855] | 63.994 [63.786, 64.060] | 3.28–4.13 | 30 / 0 |
| hl-clone/json1m · ms · all | 30 / 0 | 8.367 [8.035, 8.520] | 9.316 [8.624, 9.658] | 9.808 [9.227, 9.880] | 3.28–4.13 | 30 / 0 |
| hl-parked-memory/one_tool · ms · all | 30 / 0 | 0.694 [0.661, 0.725] | 0.770 [0.741, 0.802] | 0.862 [0.765, 0.890] | 3.28–4.13 | 30 / 0 |
| hl-parked-memory/one_tool · CPU-ms/VM · all | 30 / 0 | 3.716 [3.607, 3.840] | 4.240 [3.945, 4.457] | 4.669 [4.213, 4.770] | 3.28–4.13 | 30 / 0 |
| hl-parked-memory/one_tool · MiB RSS · all | 30 / 0 | 7.047 [7.047, 7.047] | 7.047 [7.047, 7.062] | 7.062 [7.047, 7.062] | 3.28–4.13 | 30 / 0 |
| hl-parked-memory/one_tool · MiB footprint · all | 30 / 0 | 1.813 [1.813, 1.813] | 1.829 [1.814, 1.830] | 1.840 [1.829, 1.844] | 3.28–4.13 | 30 / 0 |
| executor-cold/return2 · ms · all | 30 / 0 | 56.334 [56.071, 56.524] | 57.185 [56.575, 60.960] | 74.785 [57.101, 81.358] | 3.28–4.13 | 30 / 0 |
| executor-cold/return2 · ms done→resolve · all | 30 / 0 | 0.100 [0.092, 0.107] | 0.116 [0.108, 0.139] | 0.155 [0.114, 0.163] | 3.28–4.13 | 30 / 0 |
| executor-cold/one_tool · ms · all | 30 / 0 | 56.914 [56.501, 57.149] | 58.742 [57.259, 59.752] | 61.905 [58.576, 62.928] | 3.28–4.13 | 30 / 0 |
| executor-cold/one_tool · ms done→resolve · all | 30 / 0 | 0.060 [0.054, 0.062] | 0.069 [0.064, 0.072] | 0.073 [0.069, 0.073] | 3.28–4.13 | 30 / 0 |
| executor-cold/one_tool_5ms · ms · all | 30 / 0 | 62.548 [61.989, 62.847] | 63.950 [63.028, 65.014] | 65.190 [63.894, 65.273] | 3.28–4.13 | 30 / 0 |
| executor-cold/one_tool_5ms · ms done→resolve · all | 30 / 0 | 0.064 [0.058, 0.069] | 0.072 [0.069, 0.075] | 0.076 [0.072, 0.076] | 3.28–4.13 | 30 / 0 |
| executor-cold/promise10_5ms · ms · all | 30 / 0 | 63.029 [62.645, 63.395] | 64.155 [63.603, 65.273] | 66.453 [64.108, 67.015] | 3.28–4.13 | 30 / 0 |
| executor-cold/promise10_5ms · ms done→resolve · all | 30 / 0 | 0.060 [0.057, 0.068] | 0.074 [0.071, 0.086] | 0.086 [0.074, 0.086] | 3.28–4.13 | 30 / 0 |
| executor-cold/json1m · ms · all | 30 / 0 | 61.401 [61.118, 61.684] | 63.885 [61.959, 64.933] | 65.654 [63.606, 65.997] | 3.28–4.13 | 30 / 0 |
| executor-cold/json1m · ms done→resolve · all | 30 / 0 | 0.088 [0.085, 0.095] | 0.104 [0.098, 0.121] | 0.127 [0.104, 0.130] | 3.28–4.13 | 30 / 0 |
| executor-parked/return2 · ms · all | 30 / 0 | 2.495 [2.475, 2.582] | 2.707 [2.606, 2.829] | 2.922 [2.703, 2.966] | 3.28–4.13 | 30 / 0 |
| executor-parked/return2 · ms done→resolve · all | 30 / 0 | 0.079 [0.073, 0.091] | 0.098 [0.093, 0.102] | 0.103 [0.097, 0.103] | 3.28–4.13 | 30 / 0 |
| executor-parked/one_tool · ms · all | 30 / 0 | 2.983 [2.963, 3.028] | 3.164 [3.098, 3.391] | 3.554 [3.155, 3.632] | 3.28–4.13 | 30 / 0 |
| executor-parked/one_tool · ms done→resolve · all | 30 / 0 | 0.055 [0.051, 0.058] | 0.073 [0.059, 0.074] | 0.075 [0.072, 0.076] | 3.28–4.13 | 30 / 0 |
| executor-parked/one_tool_5ms · ms · all | 30 / 0 | 8.668 [8.633, 8.746] | 8.935 [8.818, 9.230] | 9.281 [8.925, 9.305] | 3.28–4.13 | 30 / 0 |
| executor-parked/one_tool_5ms · ms done→resolve · all | 30 / 0 | 0.057 [0.055, 0.060] | 0.072 [0.063, 0.083] | 0.111 [0.071, 0.124] | 3.28–4.13 | 30 / 0 |
| executor-parked/promise10_5ms · ms · all | 30 / 0 | 9.401 [8.716, 9.508] | 9.696 [9.552, 9.947] | 10.104 [9.691, 10.179] | 3.28–4.13 | 30 / 0 |
| executor-parked/promise10_5ms · ms done→resolve · all | 30 / 0 | 0.057 [0.052, 0.063] | 0.079 [0.067, 0.087] | 0.090 [0.078, 0.091] | 3.28–4.13 | 30 / 0 |
| executor-parked/json1m · ms · all | 30 / 0 | 7.456 [7.369, 7.516] | 7.746 [7.626, 7.840] | 7.847 [7.740, 7.850] | 3.28–4.13 | 30 / 0 |
| executor-parked/json1m · ms done→resolve · all | 30 / 0 | 0.089 [0.081, 0.096] | 0.104 [0.099, 0.116] | 0.168 [0.103, 0.193] | 3.28–4.13 | 30 / 0 |

Source selection (frozen at run start):

```json
{
  "kernel_source": "canonical kernel",
  "vmm_source": "explicit override",
  "source_image": "/private/tmp/jitk-lead/full/relocated-full-89875/kernel/dist/kernel.bin",
  "image_sha256": "a7c39ab5679e75d3242f6f318cd5367ff866380e8f509085e974a49f1b6a6364",
  "image": "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/kernel.bin",
  "source_vmm": "/private/tmp/jitk-lead/full/relocated-full-89875-work/vmm/jitk-vmm",
  "vmm_sha256": "a931ed8d0e10732b1cba407f8b115c2d073f02df91d92f424da4c69680799fbe",
  "vmm": "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/jitk-vmm",
  "argv": [
    "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/jitk-vmm",
    "--image",
    "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/kernel.bin",
    "--mem-mib",
    "32",
    "--sandbox-profile",
    "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/jitk.sbbin"
  ],
  "require_sandbox_ack": true,
  "sandbox_profile": "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/jitk.sbbin",
  "sandbox_profile_sha256": "cad22b07520b3ce09b07dccc4586f2bdc438498013682b232072a19fd291a606",
  "sandbox_probe": {
    "binary": "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/sandbox-probe",
    "profile": "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/jitk.sbbin",
    "profile_sha256": "cad22b07520b3ce09b07dccc4586f2bdc438498013682b232072a19fd291a606",
    "source": "canonical precompiled profile; sandbox_apply call only, no VM"
  },
  "hyperlight": {
    "strict_argv": [
      "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/hyperlight-worker",
      "strict",
      "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/hyperlight-snapshot"
    ],
    "clone_argv": [
      "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/hyperlight-worker",
      "clone",
      "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/hyperlight-snapshot"
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
    "source": "/private/tmp/jitk-lead/full/relocated-full-89875/executor",
    "integrated": true,
    "build": "/private/tmp/jitk-lead/full/bench-scratch/jitk-bench-k33bmeva/executor/build",
    "node_modules": "/private/tmp/jitk-lead/full/relocated-full-89875/executor/node_modules",
    "runtime_sha256": {
      "cloudflare-github.generated.mjs": "bd8e51a8f4af8ece7e8e623f11292d73e3fb6c3acd2ab20d15807d86f1df9289",
      "watchdog.py": "206b9d37ef9a0dea0a9c45829101f3fa50b47df3fbaa84d1324e4cb44a93e014",
      "cloudflare-binary.generated.mjs": "f4480e16e698c82ae58b544dde477f126160b3c900e4b3e7d21047c35fe7d860",
      "certify.mjs": "4f6ccb76d117ebb60e82341ccae62aef42f6fb029d16c993c30852d35b101c64",
      "codec.mjs": "731af9e407afbaf004de467ec7eb802036cb70e420818f8c155cad7f39a48b7e",
      "build.mjs": "57d6024c41d02e99171c385c36c9d874412679c13cc7f3acf940b5ffc9c7092c",
      "fixtures/protocol-peer.mjs": "9e0ca4b0c0c2638af9d99d27bbd10b237d92fb852bc2e36cf8e63fd9c18c413c",
      "fixtures/ack-peer.mjs": "8696aaf17f2c4ed2159ccaf03a4ad86698a4f44437daa5743dffcf7d0ed992c0",
      "build/resolve-check.js": "a1fbd553299fe7505e817b52b4273fc75912545df39d799d5b60d4d7a87a0cb1",
      "build/sandbox-check.js": "3e06aa3e3265fb1cfa5f09e8e04f96cf6d78c4044d756fb7027b561e519a62eb",
      "build/code.js": "8542ca147509d9bce0f330b857a2565377b488f3ae37b1e3db00bf2674b5d7c6",
      "build/select-backend.js": "7de5ee0e87390a4ea3a2ead499120bca9bcf15813c82b01972d6997ec01d34cd",
      "build/pool-check.js": "10952f0aee6c9ef419f45112569fd671308d5fc60c15890ae01c45bbbf51048b",
      "build/breakdown.js": "b3f4c988d6fdc05d3e789d39f8ad25e36def52764dda0c7d400abafcd7e89372",
      "build/backend.js": "058dd0164f3633bc1cbbefc52ac65d17cf89b7e30d1e26b3e7c5d6a0aae34db3",
      "build/transport-check.js": "96a8db240a15bf875eddb0f3def0b3e667163676213b6cbc93dfca3ce7f5033c",
      "build/policy-check.js": "c39cd6211edf2e387479a42b440351f21df16d3228e8be3f618b4167f98b6808",
      "build/pool.js": "dfc0cd7974e0b3aa5ca6a0637dbed561d15ea5dea6699b5556ecf1ab2f7fdfce",
      "build/demo.js": "81925284cddf0ff1c949c8d158c4e53ce9c3e0228b781d70e74b0e0a82fbf207",
      "build/verify.js": "55333f39600eed233d1dbb6d140a86c25798881b31959e139c1b21f3fe1c1a76",
      "build/codec.mjs": "731af9e407afbaf004de467ec7eb802036cb70e420818f8c155cad7f39a48b7e",
      "build/api-check.js": "e258217f8d250b723c1094d724c786576f16c080319a25758bc89020a4b02b3a",
      "build/policy-adapter.js": "6a0c8660cf3fcb545db264db27560b671c1fede91a705b81e78e15c47b2834a8",
      "build/executor.js": "9a8552c76f79390f10ee2f8c278a5d9fb5dc287372cbb9ba50d15c04d94f53ed",
      "build/providers.js": "689f0ecb60589b2fb2ca6ab68a874a839a7dfc3fbfb19ee55afd242608366a28",
      "build/upstream.js": "2e1b114d980f334ff9d0aeb97fa26f3fa91e36004294c21ad87634970e9302fc",
      "build/watchdog-check.js": "cfb38d8ba2ee9ce898c4068c253c283a40269e377da179ffb8acbf8fc6389772",
      "build/hyperlight-check.js": "e6d07f75acd43e15e0fc6fee4bf0fd96df82e891f4e16f9d108f87fcfeda22df",
      "build/wrapper-conformance.js": "e8547fdbcb674fbbf8e2b4bf26ca826a7446404e618a646deedb7256799db9c8",
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
