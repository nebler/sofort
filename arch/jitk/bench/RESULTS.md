# Canonical benchmark results

Run: 2026-10-24T01:40:05.128705+00:00 → 2026-10-24T02:40:41.977828+00:00. Platform: macOS-26.6.1-arm64-arm-64bit-Mach-O.
Start: `3:40  up  4:53, 2 users, load averages: 58.09 51.44 58.79`. End: `4:40  up  5:54, 2 users, load averages: 38.53 62.02 68.42`.

Completed: **41 cases × 60 = 2,460 validated samples; zero failures**. **0/2,460 passed the load gate**; sample-start load1 ranged **14.40–145.55**. **Quiet-host H4 performance remains UNVERIFIED.**

Gate: load1 < 6; 1.0 s budget/sample. Randomized complete blocks; seed 603.
Cold = spawn → validated done; parked = RUN → validated done after READY and 5 ms idle. Tools return asynchronously after 0 or 5 ms as named. JSON case parses/stringifies exactly 1 MiB internally, returns its length (not a 1 MiB protocol frame).
Executor = execute() → validated result; Node startup/pool preparation excluded. Refill = READY + kill/reap, 4 waves per sample. CPU = child user+system through reap; watchdog/supervisor excluded. Parked memory = process RSS/physical footprint, excludes HVF kernel allocations. Sandbox on/off = precompiled sandbox_apply versus clock-only baseline, no VM; not an end-to-end subtraction.
Cached binary/image/signature runs; first validation excluded. Single-use hardware VM except explicitly shared-HW Hyperlight logical clones. No nested-KVM performance.

Values and brackets: estimate [95% bootstrap CI], 2,000 IID resamples. Quantiles interpolate order statistics. n=30 p99 is poorly resolved; CI does not remove contention or serial dependence.
**Quiet credibility requires ≥30 gate-passed samples per row. A timed-out gate remains a contended sample; no idle-host conclusion follows. Latency percentiles are conditional on validated results; failures are counted separately and never treated as zero-latency successes.**

| Case / metric | n / fail | p50 [CI95] | p90 [CI95] | p99 [CI95] | load1 range | gated / timed-out |
|---|---:|---:|---:|---:|---:|---:|
| jitk-cold/return2 · ms · all | 60 / 0 | 25.523 [20.521, 33.449] | 116.682 [68.788, 196.837] | 220.992 [146.326, 224.096] | 15.68–127.63 | 0 / 60 |
| jitk-cold/return2 · CPU-ms/VM · all | 60 / 0 | 14.250 [12.280, 15.420] | 21.345 [18.537, 23.897] | 24.025 [22.522, 24.056] | 15.68–127.63 | 0 / 60 |
| jitk-cold/one_tool · ms · all | 60 / 0 | 26.471 [20.636, 39.527] | 127.927 [88.622, 182.576] | 327.936 [160.557, 464.764] | 15.91–127.63 | 0 / 60 |
| jitk-cold/one_tool · CPU-ms/VM · all | 60 / 0 | 13.954 [12.721, 14.874] | 23.114 [17.684, 24.961] | 33.776 [23.806, 42.786] | 15.91–127.63 | 0 / 60 |
| jitk-cold/one_tool_5ms · ms · all | 60 / 0 | 36.311 [27.464, 60.778] | 208.334 [122.938, 241.082] | 289.479 [225.870, 324.660] | 14.73–134.47 | 0 / 60 |
| jitk-cold/one_tool_5ms · CPU-ms/VM · all | 60 / 0 | 14.538 [13.703, 17.749] | 29.619 [23.314, 34.571] | 36.043 [32.420, 36.113] | 14.73–134.47 | 0 / 60 |
| jitk-cold/promise10_5ms · ms · all | 60 / 0 | 34.103 [29.345, 54.556] | 150.689 [138.226, 254.889] | 642.465 [179.825, 887.400] | 15.84–135.93 | 0 / 60 |
| jitk-cold/promise10_5ms · CPU-ms/VM · all | 60 / 0 | 16.810 [15.137, 18.504] | 33.647 [25.310, 37.900] | 47.396 [35.352, 55.758] | 15.84–135.93 | 0 / 60 |
| jitk-cold/json1m · ms · all | 60 / 0 | 39.470 [33.840, 49.216] | 129.613 [74.303, 234.302] | 339.005 [157.493, 433.553] | 14.40–124.60 | 0 / 60 |
| jitk-cold/json1m · CPU-ms/VM · all | 60 / 0 | 22.939 [21.803, 24.561] | 30.016 [26.973, 34.665] | 37.903 [32.166, 38.479] | 14.40–124.60 | 0 / 60 |
| jitk-parked-raw/return2 · ms · all | 60 / 0 | 1.073 [0.806, 1.480] | 20.158 [12.274, 55.502] | 86.437 [37.748, 97.231] | 14.43–133.73 | 0 / 60 |
| jitk-parked-raw/return2 · CPU-ms/VM · all | 60 / 0 | 14.002 [12.901, 15.544] | 26.355 [19.342, 32.069] | 38.489 [29.813, 43.794] | 14.43–133.73 | 0 / 60 |
| jitk-parked-raw/one_tool · ms · all | 60 / 0 | 1.133 [0.858, 1.482] | 13.114 [4.489, 64.363] | 127.056 [23.360, 129.305] | 14.43–137.20 | 0 / 60 |
| jitk-parked-raw/one_tool · CPU-ms/VM · all | 60 / 0 | 14.267 [12.711, 16.597] | 22.223 [20.898, 24.495] | 27.701 [23.703, 30.533] | 14.43–137.20 | 0 / 60 |
| jitk-parked-raw/one_tool_5ms · ms · all | 60 / 0 | 9.583 [8.907, 10.863] | 65.681 [41.199, 105.218] | 120.808 [90.074, 133.730] | 14.73–131.11 | 0 / 60 |
| jitk-parked-raw/one_tool_5ms · CPU-ms/VM · all | 60 / 0 | 14.113 [12.738, 16.222] | 28.627 [25.437, 35.512] | 39.009 [33.401, 42.335] | 14.73–131.11 | 0 / 60 |
| jitk-parked-raw/promise10_5ms · ms · all | 60 / 0 | 9.524 [8.900, 11.541] | 58.716 [21.164, 98.120] | 189.199 [77.261, 297.514] | 14.53–120.31 | 0 / 60 |
| jitk-parked-raw/promise10_5ms · CPU-ms/VM · all | 60 / 0 | 15.715 [14.213, 16.995] | 28.903 [22.845, 39.894] | 45.096 [32.251, 46.334] | 14.53–120.31 | 0 / 60 |
| jitk-parked-raw/json1m · ms · all | 60 / 0 | 16.695 [12.005, 19.998] | 48.225 [30.019, 146.195] | 190.263 [96.570, 209.148] | 15.91–145.55 | 0 / 60 |
| jitk-parked-raw/json1m · CPU-ms/VM · all | 60 / 0 | 24.751 [22.307, 25.629] | 31.137 [27.865, 48.598] | 50.748 [35.952, 52.158] | 15.91–145.55 | 0 / 60 |
| jitk-refill/4 · VM/s · all | 60 / 0 | 100.061 [77.146, 113.136] | 217.075 [178.851, 372.715] | 379.529 [356.773, 388.787] | 15.22–133.95 | 0 / 60 |
| jitk-refill/4 · CPU-ms/VM · all | 60 / 0 | 13.134 [12.354, 13.925] | 16.862 [15.033, 18.569] | 19.582 [17.640, 19.713] | 15.22–133.95 | 0 / 60 |
| jitk-refill/8 · VM/s · all | 60 / 0 | 145.443 [118.868, 186.944] | 389.214 [268.899, 480.933] | 501.939 [436.505, 504.058] | 14.40–129.51 | 0 / 60 |
| jitk-refill/8 · CPU-ms/VM · all | 60 / 0 | 13.093 [12.241, 14.102] | 15.539 [14.879, 17.025] | 18.275 [16.183, 18.623] | 14.40–129.51 | 0 / 60 |
| jitk-parked-memory/one_tool · ms · all | 60 / 0 | 1.572 [1.285, 1.995] | 10.458 [4.987, 82.155] | 108.781 [45.995, 121.313] | 15.04–128.36 | 0 / 60 |
| jitk-parked-memory/one_tool · CPU-ms/VM · all | 60 / 0 | 14.725 [13.463, 16.265] | 24.962 [20.017, 30.702] | 33.414 [27.512, 33.626] | 15.04–128.36 | 0 / 60 |
| jitk-parked-memory/one_tool · MiB RSS · all | 60 / 0 | 15.312 [15.312, 15.328] | 15.344 [15.328, 15.359] | 15.366 [15.350, 15.375] | 15.04–128.36 | 0 / 60 |
| jitk-parked-memory/one_tool · MiB footprint · all | 60 / 0 | 10.665 [10.657, 10.672] | 10.704 [10.688, 10.704] | 10.716 [10.704, 10.735] | 15.04–128.36 | 0 / 60 |
| sandbox-apply/on · ms sandbox_apply · all | 60 / 0 | 0.038 [0.035, 0.048] | 0.118 [0.079, 0.215] | 5.550 [0.135, 13.009] | 15.75–134.94 | 0 / 60 |
| sandbox-apply/on · ms profile-read+apply · all | 60 / 0 | 0.099 [0.082, 0.143] | 0.477 [0.259, 0.843] | 6.312 [0.606, 14.073] | 15.75–134.94 | 0 / 60 |
| sandbox-apply/off · ms sandbox_apply · all | 60 / 0 | 0.000 [0.000, 0.000] | 0.000 [0.000, 0.001] | 0.001 [0.000, 0.001] | 15.68–135.10 | 0 / 60 |
| sandbox-apply/off · ms profile-read+apply · all | 60 / 0 | 0.058 [0.050, 0.074] | 0.337 [0.131, 1.003] | 4.869 [0.736, 10.222] | 15.68–135.10 | 0 / 60 |
| hl-strict/return2 · ms · all | 60 / 0 | 18.390 [14.424, 21.433] | 46.778 [29.565, 82.426] | 106.370 [62.781, 133.089] | 16.00–129.51 | 0 / 60 |
| hl-strict/return2 · CPU-ms/VM · all | 60 / 0 | 9.031 [8.555, 9.275] | 12.449 [10.360, 13.288] | 14.805 [12.923, 15.045] | 16.00–129.51 | 0 / 60 |
| hl-strict/one_tool · ms · all | 60 / 0 | 19.412 [15.080, 26.086] | 113.650 [50.302, 163.088] | 193.764 [125.416, 214.095] | 15.75–145.55 | 0 / 60 |
| hl-strict/one_tool · CPU-ms/VM · all | 60 / 0 | 8.720 [8.468, 9.428] | 11.611 [10.819, 13.393] | 15.728 [12.462, 18.591] | 15.75–145.55 | 0 / 60 |
| hl-strict/one_tool_5ms · ms · all | 60 / 0 | 30.300 [24.640, 40.660] | 111.180 [79.955, 161.204] | 285.732 [134.039, 453.280] | 14.43–135.10 | 0 / 60 |
| hl-strict/one_tool_5ms · CPU-ms/VM · all | 60 / 0 | 8.750 [8.356, 9.479] | 11.716 [11.378, 13.233] | 15.750 [12.649, 18.998] | 14.43–135.10 | 0 / 60 |
| hl-strict/promise10_5ms · ms · all | 60 / 0 | 176.820 [134.075, 196.543] | 394.269 [270.301, 563.346] | 569.818 [472.834, 571.817] | 15.84–133.30 | 0 / 60 |
| hl-strict/promise10_5ms · CPU-ms/VM · all | 60 / 0 | 10.998 [9.890, 12.325] | 14.529 [13.683, 15.793] | 16.485 [15.249, 16.997] | 15.84–133.30 | 0 / 60 |
| hl-strict/json1m · ms · all | 60 / 0 | 44.625 [37.789, 60.315] | 169.361 [129.933, 269.233] | 359.004 [228.815, 417.745] | 16.44–133.57 | 0 / 60 |
| hl-strict/json1m · CPU-ms/VM · all | 60 / 0 | 23.733 [22.218, 24.756] | 27.718 [26.529, 28.646] | 31.789 [27.914, 35.321] | 16.44–133.57 | 0 / 60 |
| hl-strict-parked/return2 · ms · all | 60 / 0 | 1.859 [1.575, 2.887] | 9.447 [4.039, 18.734] | 65.877 [15.222, 94.613] | 18.28–133.73 | 0 / 60 |
| hl-strict-parked/return2 · CPU-ms/VM · all | 60 / 0 | 9.371 [8.765, 10.326] | 12.260 [11.270, 12.873] | 13.387 [12.568, 13.739] | 18.28–133.73 | 0 / 60 |
| hl-strict-parked/one_tool · ms · all | 60 / 0 | 2.781 [2.201, 3.762] | 16.814 [10.547, 38.704] | 63.671 [25.634, 95.580] | 18.39–134.47 | 0 / 60 |
| hl-strict-parked/one_tool · CPU-ms/VM · all | 60 / 0 | 9.319 [8.136, 10.082] | 12.584 [11.203, 14.231] | 15.250 [13.021, 16.547] | 18.39–134.47 | 0 / 60 |
| hl-strict-parked/one_tool_5ms · ms · all | 60 / 0 | 10.578 [9.638, 11.138] | 46.823 [26.106, 89.741] | 109.609 [72.117, 137.700] | 15.04–132.32 | 0 / 60 |
| hl-strict-parked/one_tool_5ms · CPU-ms/VM · all | 60 / 0 | 9.333 [8.645, 9.852] | 12.585 [11.260, 13.241] | 15.713 [12.874, 18.020] | 15.04–132.32 | 0 / 60 |
| hl-strict-parked/promise10_5ms · ms · all | 60 / 0 | 102.347 [88.249, 133.765] | 246.740 [198.265, 382.968] | 470.448 [325.700, 543.805] | 15.91–145.55 | 0 / 60 |
| hl-strict-parked/promise10_5ms · CPU-ms/VM · all | 60 / 0 | 10.302 [9.947, 11.177] | 14.653 [13.529, 14.972] | 17.032 [14.808, 18.007] | 15.91–145.55 | 0 / 60 |
| hl-strict-parked/json1m · ms · all | 60 / 0 | 30.928 [24.886, 36.472] | 111.615 [76.144, 137.806] | 207.297 [122.253, 233.650] | 14.73–140.47 | 0 / 60 |
| hl-strict-parked/json1m · CPU-ms/VM · all | 60 / 0 | 23.646 [22.118, 25.349] | 31.403 [28.440, 32.667] | 34.463 [32.476, 34.496] | 14.73–140.47 | 0 / 60 |
| hl-clone/return2 · ms · all | 60 / 0 | 1.222 [1.010, 1.358] | 4.213 [2.870, 7.000] | 8.434 [5.570, 10.433] | 15.84–145.55 | 0 / 60 |
| hl-clone/one_tool · ms · all | 60 / 0 | 1.701 [1.427, 2.052] | 8.894 [5.499, 18.774] | 34.124 [11.155, 35.538] | 15.22–137.20 | 0 / 60 |
| hl-clone/one_tool_5ms · ms · all | 60 / 0 | 10.487 [9.074, 12.167] | 26.337 [18.142, 52.951] | 64.743 [29.665, 66.491] | 14.73–134.94 | 0 / 60 |
| hl-clone/promise10_5ms · ms · all | 60 / 0 | 108.471 [84.840, 132.927] | 207.566 [174.645, 267.684] | 295.780 [242.519, 309.360] | 14.40–137.20 | 0 / 60 |
| hl-clone/json1m · ms · all | 60 / 0 | 23.273 [19.285, 29.739] | 119.898 [72.440, 127.770] | 162.720 [123.218, 195.040] | 14.53–133.57 | 0 / 60 |
| hl-parked-memory/one_tool · ms · all | 60 / 0 | 3.292 [2.120, 4.534] | 17.319 [9.092, 71.710] | 120.838 [25.324, 122.603] | 14.73–128.66 | 0 / 60 |
| hl-parked-memory/one_tool · CPU-ms/VM · all | 60 / 0 | 8.789 [8.432, 9.601] | 12.012 [10.925, 13.123] | 13.288 [12.710, 13.364] | 14.73–128.66 | 0 / 60 |
| hl-parked-memory/one_tool · MiB RSS · all | 60 / 0 | 7.047 [7.047, 7.062] | 7.064 [7.062, 7.094] | 7.094 [7.085, 7.094] | 14.73–128.66 | 0 / 60 |
| hl-parked-memory/one_tool · MiB footprint · all | 60 / 0 | 1.860 [1.844, 1.860] | 1.875 [1.861, 1.891] | 1.904 [1.882, 1.922] | 14.73–128.66 | 0 / 60 |
| executor-cold/return2 · ms · all | 60 / 0 | 51.316 [40.800, 76.461] | 222.395 [124.385, 231.298] | 333.463 [226.519, 429.433] | 15.68–133.16 | 0 / 60 |
| executor-cold/return2 · ms done→resolve · all | 60 / 0 | 0.217 [0.181, 0.264] | 0.743 [0.431, 1.293] | 4.120 [1.033, 7.773] | 15.68–133.16 | 0 / 60 |
| executor-cold/one_tool · ms · all | 60 / 0 | 48.390 [40.367, 64.364] | 307.645 [155.546, 371.311] | 468.209 [358.252, 474.560] | 15.04–135.10 | 0 / 60 |
| executor-cold/one_tool · ms done→resolve · all | 60 / 0 | 0.128 [0.110, 0.144] | 0.383 [0.250, 0.622] | 2.685 [0.538, 5.440] | 15.04–135.10 | 0 / 60 |
| executor-cold/one_tool_5ms · ms · all | 60 / 0 | 59.573 [48.748, 90.138] | 291.443 [147.272, 427.845] | 557.495 [342.967, 722.694] | 15.75–129.51 | 0 / 60 |
| executor-cold/one_tool_5ms · ms done→resolve · all | 60 / 0 | 0.164 [0.120, 0.235] | 0.758 [0.443, 1.230] | 16.840 [1.052, 38.681] | 15.75–129.51 | 0 / 60 |
| executor-cold/promise10_5ms · ms · all | 60 / 0 | 76.622 [53.484, 107.084] | 228.597 [153.937, 337.536] | 542.307 [279.469, 575.634] | 14.43–135.93 | 0 / 60 |
| executor-cold/promise10_5ms · ms done→resolve · all | 60 / 0 | 0.193 [0.174, 0.245] | 0.613 [0.398, 0.764] | 1.106 [0.684, 1.254] | 14.43–135.93 | 0 / 60 |
| executor-cold/json1m · ms · all | 60 / 0 | 76.854 [61.084, 119.503] | 255.739 [155.831, 343.551] | 391.048 [268.267, 394.155] | 14.53–134.47 | 0 / 60 |
| executor-cold/json1m · ms done→resolve · all | 60 / 0 | 0.303 [0.216, 0.473] | 1.587 [0.871, 2.253] | 4.354 [1.948, 4.456] | 14.53–134.47 | 0 / 60 |
| executor-parked/return2 · ms · all | 60 / 0 | 11.518 [8.904, 14.935] | 137.016 [48.823, 214.748] | 319.670 [179.217, 366.208] | 16.86–128.36 | 0 / 60 |
| executor-parked/return2 · ms done→resolve · all | 60 / 0 | 0.239 [0.205, 0.319] | 0.816 [0.591, 2.063] | 15.531 [1.322, 15.560] | 16.86–128.36 | 0 / 60 |
| executor-parked/one_tool · ms · all | 60 / 0 | 13.654 [11.018, 18.586] | 125.567 [38.687, 317.266] | 371.052 [219.681, 379.258] | 14.40–134.94 | 0 / 60 |
| executor-parked/one_tool · ms done→resolve · all | 60 / 0 | 0.132 [0.110, 0.181] | 0.397 [0.267, 0.783] | 12.133 [0.555, 27.033] | 14.40–134.94 | 0 / 60 |
| executor-parked/one_tool_5ms · ms · all | 60 / 0 | 24.686 [20.830, 33.502] | 167.852 [88.829, 258.554] | 355.890 [213.902, 481.519] | 15.04–137.20 | 0 / 60 |
| executor-parked/one_tool_5ms · ms done→resolve · all | 60 / 0 | 0.174 [0.140, 0.212] | 0.806 [0.437, 1.785] | 58.569 [1.248, 93.797] | 15.04–137.20 | 0 / 60 |
| executor-parked/promise10_5ms · ms · all | 60 / 0 | 28.528 [20.205, 43.601] | 141.765 [103.521, 196.566] | 202.811 [175.482, 205.334] | 14.53–124.29 | 0 / 60 |
| executor-parked/promise10_5ms · ms done→resolve · all | 60 / 0 | 0.183 [0.152, 0.250] | 0.698 [0.433, 0.888] | 33.063 [0.790, 78.471] | 14.53–124.29 | 0 / 60 |
| executor-parked/json1m · ms · all | 60 / 0 | 32.822 [26.318, 50.427] | 158.062 [104.714, 225.322] | 249.537 [187.953, 277.962] | 15.04–132.32 | 0 / 60 |
| executor-parked/json1m · ms done→resolve · all | 60 / 0 | 0.230 [0.198, 0.339] | 1.071 [0.608, 1.757] | 23.776 [1.465, 55.065] | 15.04–132.32 | 0 / 60 |

R3 frozen artifact set:

- VMM: `73df1ad31afa79274feda85cf386185141e5a08860b513891dc681ad6b91338e`.
- Kernel: `a7c39ab5679e75d3242f6f318cd5367ff866380e8f509085e974a49f1b6a6364`.
- Explicit production inputs, precompiled confinement, mandatory host sandbox ack.
- Complete source/runtime hashes and original paths remain in [raw.json](raw.json)
  as immutable historical provenance; these paths are not harness inputs.

Missing integrations: none in this pinned macOS run.
Raw observations, timestamps, gate histories, result assertions, machine state, hashes and failures: [raw.json](raw.json).
All external performance claims must cite this table. R2 tables are historical contended measurements.

Post-run verification: [verification.json](verification.json) records matching input hashes, 600 executor result-before-kill/capacity checks, and no surviving owned workers.

Exact measurement code is preserved with the area-06 R3 evidence, outside the portable product tree. After collection, interruption cleanup was fixed to include detached descendants; unit and real parked-executor interruption tests pass. Two leftovers from aborted setup runs were terminated, and the final all-run sweep found none. Numerical cells were not changed.

---

## v2 recertification

Run: 2026-10-24T02:53:02.468262+00:00 → 2026-10-24T03:03:35.683081+00:00. Same machine and harness boundaries as R3.
**480/480 validated, zero failures; n=60 per build/case/pass.**
Both builds run in adjacent randomized order within every case/block; cases are also randomized (seed 604).
Gate unchanged from canonical R3: load1 < 6, 1 s/sample budget, 1 s poll. Cold = spawn→validated done;
parked = READY + 5 ms idle, then RUN→validated done; memory = median of five libproc readings before one_tool.
Host sandbox ack and guest READY required for both builds. Each sample uses a fresh VM, killed and reaped.
CI95 is a 2,000-resample percentile bootstrap of complete paired differences (seed 601).
Δ = median(v2_i − baseline_i); positive values favor the R3 build. Marginal medians are shown separately.
Intervals describe this contended run; pairing/bootstrap do not eliminate contention or serial dependence.

Continuous setup/collection monitor (0.5 s): load1 **12.48–112.85**.
**No quiet pass was possible: load1 never dropped below 6 during monitored setup and collection.**

### Paired contended pass

| Case / metric | R3-build median | v2 median | Paired Δ [CI95] | pairs | load1 range | gated / timed-out |
|---|---:|---:|---:|---:|---:|---:|
| jitk-cold/return2 · ms | 29.790 | 34.464 | +1.310 [-5.098, +5.450] | 60 | 12.60–106.46 | 0 / 120 |
| jitk-cold/return2 · CPU-ms/VM | 15.738 | 14.729 | -1.147 [-2.762, +0.285] | 60 | 12.60–106.46 | 0 / 120 |
| jitk-parked-raw/one_tool · ms | 2.055 | 3.453 | +0.413 [-0.263, +2.006] | 60 | 12.48–112.85 | 0 / 120 |
| jitk-parked-raw/one_tool · CPU-ms/VM | 16.326 | 17.662 | +0.722 [-0.929, +2.161] | 60 | 12.48–112.85 | 0 / 120 |
| jitk-parked-raw/promise10_5ms · ms | 9.486 | 9.867 | -0.163 [-1.084, +0.893] | 60 | 12.48–109.98 | 0 / 120 |
| jitk-parked-raw/promise10_5ms · CPU-ms/VM | 19.221 | 19.689 | +0.839 [-0.328, +1.638] | 60 | 12.48–109.98 | 0 / 120 |
| jitk-parked-memory/one_tool · ms | 3.367 | 2.613 | -0.431 [-2.612, +0.664] | 60 | 12.48–109.98 | 0 / 120 |
| jitk-parked-memory/one_tool · MiB footprint | 10.704 | 10.751 | +0.062 [+0.047, +0.063] | 60 | 12.48–109.98 | 0 / 120 |
| jitk-parked-memory/one_tool · MiB RSS | 15.383 | 15.422 | +0.047 [+0.031, +0.055] | 60 | 12.48–109.98 | 0 / 120 |
| jitk-parked-memory/one_tool · CPU-ms/VM | 16.625 | 16.386 | -0.134 [-1.986, +1.182] | 60 | 12.48–109.98 | 0 / 120 |

Artifacts:

- v2 VMM: `276463d01ac6956a095814ed77053989d21bb52a7ef702f5c2698eb98daba20e`.
- R3 VMM: `73df1ad31afa79274feda85cf386185141e5a08860b513891dc681ad6b91338e`.
- Shared kernel: `a7c39ab5679e75d3242f6f318cd5367ff866380e8f509085e974a49f1b6a6364`.
- Harness/runtime/profile hashes, timestamps, load histories and all samples: [r4-raw.json](r4-raw.json).
- Renamed-copy smoke, unchanged hashes, source-path audit and zero surviving owned VMs: [r4-verification.json](r4-verification.json).

**R3 headline changes: none established by this regression subset.** The three
requested latency paired CIs all include zero; this is not proof of equivalence.
The small footprint increase (+0.0625 MiB paired median, CI95 +0.0469 to
+0.0625 MiB; load1 12.48–109.98) leaves the R3 ~6× memory-density gap materially
unchanged. The parked/concurrent-tool, cold-trivial and CPU comparisons against
Hyperlight remain the R3 head-to-head evidence above: Hyperlight and the omitted
workloads were not remeasured here, so this subset does not establish a new
all-workload ranking or a quiet-host SLO.
