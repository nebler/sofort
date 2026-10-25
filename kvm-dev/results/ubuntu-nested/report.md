# Linux functional suite

**NESTED — non-performance data. Status: PASS.**

Outer host: `11:45  up 12:59, 2 users, load averages: 4.99 5.09 4.16`

| Gate | Result | Count | p50 / p90 / p99 ms | Load |
|---|---|---:|---|---|
| parking | PASS | 1000 exchanges | — | inner: 09:46:08 up 9 min,  1 user,  load average: 4.10, 3.13, 1.33; outer: UNVERIFIED |
| smoke | PASS | 1/1 | 67.631 / 67.631 / 67.631 | inner: 09:46:18 up 9 min,  1 user,  load average: 3.47, 3.03, 1.31; outer: UNVERIFIED |
| tool_smoke | PASS | 1/1 | 68.737 / 68.737 / 68.737 | inner: 09:46:18 up 9 min,  1 user,  load average: 3.47, 3.03, 1.31; outer: UNVERIFIED |
| boot | PASS | 300/300 | 69.039 / 87.825 / 92.268 | inner: 09:46:18 up 9 min,  1 user,  load average: 3.47, 3.03, 1.31; outer: UNVERIFIED |
| one_tool | PASS | 30/30 | 71.224 / 92.484 / 99.696 | inner: 09:46:41 up 9 min,  1 user,  load average: 2.77, 2.89, 1.30; outer: UNVERIFIED |
| concurrency_1 | PASS | 200/200 | 68.025 / 88.943 / 110.387 | inner: 09:46:43 up 9 min,  1 user,  load average: 2.62, 2.86, 1.30; outer: UNVERIFIED |
| concurrency_2 | PASS | 200/200 | 98.586 / 107.238 / 116.490 | inner: 09:46:58 up 9 min,  1 user,  load average: 2.26, 2.77, 1.30; outer: UNVERIFIED |
| concurrency_3 | PASS | 200/200 | 121.026 / 134.118 / 139.496 | inner: 09:47:08 up 10 min,  1 user,  load average: 2.53, 2.81, 1.33; outer: UNVERIFIED |
| concurrency_4 | PASS | 200/200 | 159.134 / 174.524 / 189.632 | inner: 09:47:16 up 10 min,  1 user,  load average: 2.57, 2.81, 1.33; outer: UNVERIFIED |
| concurrency_5 | PASS | 200/200 | 190.698 / 232.414 / 296.942 | inner: 09:47:24 up 10 min,  1 user,  load average: 2.94, 2.89, 1.37; outer: UNVERIFIED |
| concurrency_6 | PASS | 200/200 | 220.746 / 298.562 / 371.463 | inner: 09:47:32 up 10 min,  1 user,  load average: 3.10, 2.92, 1.39; outer: UNVERIFIED |
| concurrency_7 | PASS | 200/200 | 273.898 / 373.333 / 448.398 | inner: 09:47:40 up 10 min,  1 user,  load average: 3.93, 3.11, 1.47; outer: UNVERIFIED |
| concurrency_8 | PASS | 200/200 | 353.617 / 475.219 / 729.547 | inner: 09:47:48 up 10 min,  1 user,  load average: 4.49, 3.25, 1.54; outer: UNVERIFIED |
| concurrency_9 | PASS | 200/200 | 374.087 / 537.685 / 615.408 | inner: 09:47:57 up 10 min,  1 user,  load average: 4.77, 3.33, 1.57; outer: UNVERIFIED |
| concurrency_10 | PASS | 200/200 | 437.896 / 593.322 / 668.832 | inner: 09:48:05 up 11 min,  1 user,  load average: 5.58, 3.55, 1.66; outer: UNVERIFIED |
| concurrency_11 | PASS | 200/200 | 491.653 / 639.917 / 737.104 | inner: 09:48:14 up 11 min,  1 user,  load average: 6.42, 3.80, 1.76; outer: UNVERIFIED |
| concurrency_12 | PASS | 200/200 | 559.240 / 664.202 / 727.273 | inner: 09:48:23 up 11 min,  1 user,  load average: 7.12, 4.03, 1.86; outer: UNVERIFIED |
| concurrency_13 | PASS | 200/200 | 575.389 / 733.512 / 829.731 | inner: 09:48:31 up 11 min,  1 user,  load average: 7.51, 4.17, 1.92; outer: UNVERIFIED |
| concurrency_14 | PASS | 200/200 | 640.295 / 777.246 / 843.314 | inner: 09:48:40 up 11 min,  1 user,  load average: 8.43, 4.47, 2.04; outer: UNVERIFIED |
| concurrency_15 | PASS | 200/200 | 674.585 / 815.472 / 929.916 | inner: 09:48:49 up 11 min,  1 user,  load average: 9.82, 4.90, 2.21; outer: UNVERIFIED |
| concurrency_16 | PASS | 200/200 | 712.687 / 886.652 / 1002.027 | inner: 09:48:57 up 11 min,  1 user,  load average: 10.47, 5.20, 2.33; outer: UNVERIFIED |
| density | PASS | 256 | — | inner: 09:49:06 up 12 min,  1 user,  load average: 10.91, 5.38, 2.41; outer: UNVERIFIED |
| cpu_controls | PASS | — | — | inner: 09:49:40 up 12 min,  1 user,  load average: 6.28, 4.83, 2.33; outer: UNVERIFIED |
| seccomp_kill | PASS | 720/720 | — | inner: 09:49:41 up 12 min,  1 user,  load average: 6.28, 4.83, 2.33; outer: UNVERIFIED |
| fault_guests | PASS | 180/180 | — | inner: 09:50:14 up 13 min,  1 user,  load average: 3.94, 4.41, 2.28; outer: UNVERIFIED |

Each gate’s inner uptime/load, samples, hashes and CPU accounting: `report.json`.
Owned children remaining: 0.

## CPU-ms/VM (NESTED)

| Case | VMM user including guest | VMM system | Guest estimate† | Total | Load |
|---|---:|---:|---:|---:|---|
| smoke | 30.684 | 37.612 | 30.000 | 68.296 | inner: 09:46:18 up 9 min,  1 user,  load average: 3.47, 3.03, 1.31; outer: UNVERIFIED |
| tool_smoke | 37.158 | 32.136 | 40.000 | 69.294 | inner: 09:46:18 up 9 min,  1 user,  load average: 3.47, 3.03, 1.31; outer: UNVERIFIED |
| boot | 39.422 | 27.932 | 39.033 | 67.355 | inner: 09:46:18 up 9 min,  1 user,  load average: 3.47, 3.03, 1.31; outer: UNVERIFIED |
| one_tool | 40.819 | 30.063 | 40.333 | 70.882 | inner: 09:46:41 up 9 min,  1 user,  load average: 2.77, 2.89, 1.30; outer: UNVERIFIED |
| concurrency_1 | 39.266 | 28.738 | 38.750 | 68.004 | inner: 09:46:43 up 9 min,  1 user,  load average: 2.62, 2.86, 1.30; outer: UNVERIFIED |
| concurrency_2 | 49.078 | 33.276 | 48.850 | 82.354 | inner: 09:46:58 up 9 min,  1 user,  load average: 2.26, 2.77, 1.30; outer: UNVERIFIED |
| concurrency_3 | 66.435 | 37.924 | 66.250 | 104.359 | inner: 09:47:08 up 10 min,  1 user,  load average: 2.53, 2.81, 1.33; outer: UNVERIFIED |
| concurrency_4 | 93.120 | 44.149 | 93.150 | 137.269 | inner: 09:47:16 up 10 min,  1 user,  load average: 2.57, 2.81, 1.33; outer: UNVERIFIED |
| concurrency_5 | 103.894 | 46.250 | 104.400 | 150.144 | inner: 09:47:24 up 10 min,  1 user,  load average: 2.94, 2.89, 1.37; outer: UNVERIFIED |
| concurrency_6 | 104.160 | 46.755 | 104.900 | 150.916 | inner: 09:47:32 up 10 min,  1 user,  load average: 3.10, 2.92, 1.39; outer: UNVERIFIED |
| concurrency_7 | 108.609 | 48.384 | 109.350 | 156.993 | inner: 09:47:40 up 10 min,  1 user,  load average: 3.93, 3.11, 1.47; outer: UNVERIFIED |
| concurrency_8 | 118.018 | 54.766 | 118.250 | 172.784 | inner: 09:47:48 up 10 min,  1 user,  load average: 4.49, 3.25, 1.54; outer: UNVERIFIED |
| concurrency_9 | 115.953 | 52.000 | 116.750 | 167.953 | inner: 09:47:57 up 10 min,  1 user,  load average: 4.77, 3.33, 1.57; outer: UNVERIFIED |
| concurrency_10 | 118.340 | 51.411 | 119.000 | 169.751 | inner: 09:48:05 up 11 min,  1 user,  load average: 5.58, 3.55, 1.66; outer: UNVERIFIED |
| concurrency_11 | 120.526 | 52.955 | 121.250 | 173.481 | inner: 09:48:14 up 11 min,  1 user,  load average: 6.42, 3.80, 1.76; outer: UNVERIFIED |
| concurrency_12 | 115.277 | 50.957 | 116.100 | 166.234 | inner: 09:48:23 up 11 min,  1 user,  load average: 7.12, 4.03, 1.86; outer: UNVERIFIED |
| concurrency_13 | 115.869 | 50.820 | 116.600 | 166.689 | inner: 09:48:31 up 11 min,  1 user,  load average: 7.51, 4.17, 1.92; outer: UNVERIFIED |
| concurrency_14 | 119.372 | 50.277 | 120.150 | 169.649 | inner: 09:48:40 up 11 min,  1 user,  load average: 8.43, 4.47, 2.04; outer: UNVERIFIED |
| concurrency_15 | 114.911 | 49.552 | 115.650 | 164.463 | inner: 09:48:49 up 11 min,  1 user,  load average: 9.82, 4.90, 2.21; outer: UNVERIFIED |
| concurrency_16 | 118.684 | 50.040 | 119.450 | 168.725 | inner: 09:48:57 up 11 min,  1 user,  load average: 10.47, 5.20, 2.33; outer: UNVERIFIED |
| setup_only | 0.203 | 0.089 | 0.000 | 0.292 | inner: 09:49:40 up 12 min,  1 user,  load average: 6.28, 4.83, 2.33; outer: UNVERIFIED |
| bare_vm | 0.062 | 1.132 | 0.000 | 1.195 | inner: 09:49:40 up 12 min,  1 user,  load average: 6.28, 4.83, 2.33; outer: UNVERIFIED |

† Guest delta is Linux /proc/stat, tick-quantized. Some guest/host-user residuals are negative: the counters do not close exactly. Precise host-user/guest attribution is UNVERIFIED; see cpu-analysis.json. The guest estimate is already included in user, not added again.
CPU excludes supervisor, spawn wrapper, and L0 QEMU/HVF; this cannot decide the metal 5 CPU-ms kill line.

Parking image: `1069385910d00d47cb83de04785713719c60d9b74d97183a0b36a5b74aca72f1`. Idle 10.005147 s, VMM process CPU 0.000000% core; high-resolution VMM cgroup CPU 0.006996% core. 1000/1000 exchanges, 10 delayed replies, 0 stalls. vCPU wait state: kvm_vcpu_block.
