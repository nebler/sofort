# Linux functional suite

**NESTED — non-performance data. Status: PASS.**

Outer host: ` 5:02  up  6:16, 2 users, load averages: 87.51 71.79 60.68`

| Gate | Result | Count | p50 / p90 / p99 ms | Load |
|---|---|---:|---|---|
| parking | PASS | 1000 exchanges | — | inner: uptime_seconds=7.01 0.02 loadavg=0.24 0.05 0.02 1/49 132; outer: [114.79296875, 82.25390625, 65.34423828125] |
| smoke | PASS | 1/1 | 309.044 / 309.044 / 309.044 | inner: uptime_seconds=28.26 10.04 loadavg=0.48 0.11 0.04 1/50 140; outer: [120.56201171875, 85.76123046875, 66.99951171875] |
| tool_smoke | PASS | 1/1 | 268.392 / 268.392 / 268.392 | inner: uptime_seconds=28.64 10.04 loadavg=0.48 0.11 0.04 1/50 148; outer: [120.56201171875, 85.76123046875, 66.99951171875] |
| boot | PASS | 100/100 | 214.569 / 550.574 / 770.727 | inner: uptime_seconds=29.00 10.04 loadavg=0.48 0.11 0.04 1/50 156; outer: [120.56201171875, 85.76123046875, 66.99951171875] |
| one_tool | PASS | 30/30 | 144.701 / 415.874 / 484.923 | inner: uptime_seconds=55.64 10.48 loadavg=1.54 0.41 0.14 3/51 660; outer: [134.8505859375, 92.04443359375, 69.81494140625] |
| concurrency_1 | PASS | 100/100 | 197.388 / 531.390 / 755.993 | inner: uptime_seconds=61.71 10.65 loadavg=1.58 0.43 0.15 3/52 813; outer: [137.96728515625, 94.11767578125, 70.81005859375] |
| concurrency_2 | PASS | 100/100 | 437.639 / 926.727 / 1382.281 | inner: uptime_seconds=85.48 11.34 loadavg=1.54 0.51 0.18 4/52 1316; outer: [134.9130859375, 96.26171875, 72.12060546875] |
| concurrency_3 | PASS | 100/100 | 632.334 / 1443.318 / 1825.208 | inner: uptime_seconds=111.48 11.36 loadavg=2.35 0.78 0.28 2/51 1820; outer: [140.80908203125, 100.7373046875, 74.43212890625] |
| concurrency_4 | PASS | 100/100 | 722.884 / 1502.424 / 2511.956 | inner: uptime_seconds=136.31 11.39 loadavg=3.32 1.14 0.41 2/51 2325; outer: [136.23193359375, 102.68359375, 75.88330078125] |
| concurrency_5 | PASS | 100/100 | 455.883 / 922.683 / 1215.464 | inner: uptime_seconds=157.52 11.51 loadavg=4.25 1.48 0.54 4/53 2833; outer: [129.28466796875, 103.77783203125, 77.0546875] |
| concurrency_6 | PASS | 100/100 | 327.979 / 574.973 / 738.545 | inner: uptime_seconds=167.69 11.51 loadavg=4.82 1.70 0.62 3/54 3340; outer: [116.38037109375, 101.8837890625, 76.6962890625] |
| concurrency_7 | PASS | 100/100 | 299.206 / 618.716 / 1194.533 | inner: uptime_seconds=173.55 11.51 loadavg=5.32 1.85 0.68 3/54 3848; outer: [112.5859375, 101.33740234375, 76.65087890625] |
| concurrency_8 | PASS | 100/100 | 322.144 / 600.100 / 842.930 | inner: uptime_seconds=178.72 11.53 loadavg=5.93 2.04 0.75 4/54 4357; outer: [105.89208984375, 100.13623046875, 76.37158203125] |
| density | PASS | 256 | — | inner: uptime_seconds=183.27 11.56 loadavg=6.42 2.20 0.81 3/54 4867; outer: [77.51611328125, 93.509765625, 74.90283203125] |
| cpu_controls | PASS | — | — | inner: uptime_seconds=216.53 27.55 loadavg=4.08 2.07 0.81 2/53 6157; outer: [74.671875, 92.654296875, 74.7099609375] |
| seccomp_kill | PASS | 720/720 | — | inner: uptime_seconds=218.87 27.96 loadavg=4.08 2.07 0.81 2/53 6661; outer: [74.671875, 92.654296875, 74.7099609375] |
| fault_guests | PASS | 180/180 | — | inner: uptime_seconds=220.88 28.30 loadavg=3.83 2.06 0.82 2/53 7405; outer: [45.20361328125, 76.49853515625, 70.439453125] |

Each gate’s inner uptime/load, samples, hashes and CPU accounting: `report.json`.
Owned children remaining: 0.

## CPU-ms/VM (NESTED)

| Case | VMM user including guest | VMM system | Guest estimate† | Total | Load |
|---|---:|---:|---:|---:|---|
| smoke | 166.532 | 138.776 | 20.000 | 305.308 | inner: uptime_seconds=28.26 10.04 loadavg=0.48 0.11 0.04 1/50 140; outer: [120.56201171875, 85.76123046875, 66.99951171875] |
| tool_smoke | 159.058 | 106.039 | 20.000 | 265.097 | inner: uptime_seconds=28.64 10.04 loadavg=0.48 0.11 0.04 1/50 148; outer: [120.56201171875, 85.76123046875, 66.99951171875] |
| boot | 88.361 | 128.346 | 20.500 | 216.706 | inner: uptime_seconds=29.00 10.04 loadavg=0.48 0.11 0.04 1/50 156; outer: [120.56201171875, 85.76123046875, 66.99951171875] |
| one_tool | 50.991 | 74.394 | 14.000 | 125.385 | inner: uptime_seconds=55.64 10.48 loadavg=1.54 0.41 0.14 3/51 660; outer: [134.8505859375, 92.04443359375, 69.81494140625] |
| concurrency_1 | 83.645 | 100.735 | 19.100 | 184.379 | inner: uptime_seconds=61.71 10.65 loadavg=1.58 0.43 0.15 3/52 813; outer: [137.96728515625, 94.11767578125, 70.81005859375] |
| concurrency_2 | 92.883 | 115.083 | 23.100 | 207.966 | inner: uptime_seconds=85.48 11.34 loadavg=1.54 0.51 0.18 4/52 1316; outer: [134.9130859375, 96.26171875, 72.12060546875] |
| concurrency_3 | 84.782 | 117.327 | 18.200 | 202.108 | inner: uptime_seconds=111.48 11.36 loadavg=2.35 0.78 0.28 2/51 1820; outer: [140.80908203125, 100.7373046875, 74.43212890625] |
| concurrency_4 | 72.278 | 94.517 | 17.200 | 166.795 | inner: uptime_seconds=136.31 11.39 loadavg=3.32 1.14 0.41 2/51 2325; outer: [136.23193359375, 102.68359375, 75.88330078125] |
| concurrency_5 | 34.308 | 39.765 | 12.300 | 74.074 | inner: uptime_seconds=157.52 11.51 loadavg=4.25 1.48 0.54 4/53 2833; outer: [129.28466796875, 103.77783203125, 77.0546875] |
| concurrency_6 | 19.601 | 28.292 | 11.600 | 47.893 | inner: uptime_seconds=167.69 11.51 loadavg=4.82 1.70 0.62 3/54 3340; outer: [116.38037109375, 101.8837890625, 76.6962890625] |
| concurrency_7 | 17.973 | 22.552 | 10.400 | 40.526 | inner: uptime_seconds=173.55 11.51 loadavg=5.32 1.85 0.68 3/54 3848; outer: [112.5859375, 101.33740234375, 76.65087890625] |
| concurrency_8 | 16.965 | 20.469 | 10.800 | 37.435 | inner: uptime_seconds=178.72 11.53 loadavg=5.93 2.04 0.75 4/54 4357; outer: [105.89208984375, 100.13623046875, 76.37158203125] |
| setup_only | 0.466 | 0.922 | 0.000 | 1.388 | inner: uptime_seconds=216.53 27.55 loadavg=4.08 2.07 0.81 2/53 6157; outer: UNVERIFIED |
| bare_vm | 1.882 | 7.147 | 0.500 | 9.029 | inner: uptime_seconds=217.41 27.82 loadavg=4.08 2.07 0.81 1/53 6359; outer: UNVERIFIED |

† Guest delta is Linux /proc/stat, tick-quantized. Some guest/host-user residuals are negative: the counters do not close exactly. Precise host-user/guest attribution is UNVERIFIED; see cpu-analysis.json. The guest estimate is already included in user, not added again.
CPU excludes supervisor, spawn wrapper, and L0 QEMU/HVF; this cannot decide the metal 5 CPU-ms kill line.

Parking image: `a7c39ab5679e75d3242f6f318cd5367ff866380e8f509085e974a49f1b6a6364`. Idle 10.019143 s, VMM process CPU 0.000000% core; high-resolution VMM cgroup CPU 0.011468% core. 1000/1000 exchanges, 10 delayed replies, 0 stalls. vCPU wait state: kvm_vcpu_block.
