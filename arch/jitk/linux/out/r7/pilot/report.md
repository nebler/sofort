# Linux functional suite

**NESTED — non-performance data. Status: PASS.**

Outer host: `21:34  up 1 day, 23:47, 1 user, load averages: 12.58 11.39 10.25`

| Gate | Result | Count | Wall s | p50 / p90 / p99 ms | Load |
|---|---|---:|---:|---|---|
| parking | PASS | 1000 exchanges | 11.048 | — | inner: 20:34:08 up 10:47,  1 user,  load average: 0.86, 0.65, 0.27; outer: [12.5751953125, 11.390625, 10.25244140625] |
| smoke | PASS | 1/1 | 0.257 | 239.086 / 239.086 / 239.086 | inner: 20:34:19 up 10:47,  1 user,  load average: 0.73, 0.63, 0.26; outer: [11.130859375, 11.1259765625, 10.17724609375] |
| tool_smoke | PASS | 1/1 | 0.137 | 133.319 / 133.319 / 133.319 | inner: 20:34:20 up 10:47,  1 user,  load average: 0.73, 0.63, 0.26; outer: [11.130859375, 11.1259765625, 10.17724609375] |
| boot | PASS | 100/100 | 11.641 | 112.752 / 130.911 / 155.111 | inner: 20:34:20 up 10:47,  1 user,  load average: 0.73, 0.63, 0.26; outer: [11.130859375, 11.1259765625, 10.17724609375] |
| one_tool | PASS | 30/30 | 3.763 | 120.336 / 141.013 / 177.078 | inner: 20:34:32 up 10:47,  2 users,  load average: 0.79, 0.65, 0.28; outer: [10.1943359375, 10.923828125, 10.1162109375] |
| concurrency_1 | PASS | 100/100 | 14.366 | 137.970 / 168.210 / 251.153 | inner: 20:34:35 up 10:47,  2 users,  load average: 0.81, 0.66, 0.28; outer: [10.8193359375, 11.041015625, 10.162109375] |
| concurrency_2 | PASS | 100/100 | 8.407 | 155.660 / 198.341 / 303.287 | inner: 20:34:50 up 10:47,  2 users,  load average: 0.99, 0.70, 0.30; outer: [11.60205078125, 11.21484375, 10.23974609375] |
| concurrency_3 | PASS | 100/100 | 7.098 | 208.686 / 239.575 / 360.495 | inner: 20:34:58 up 10:47,  2 users,  load average: 1.15, 0.75, 0.32; outer: [11.0732421875, 11.111328125, 10.208984375] |
| concurrency_4 | PASS | 100/100 | 7.658 | 301.002 / 350.852 / 374.717 | inner: 20:35:05 up 10:47,  2 users,  load average: 1.51, 0.84, 0.35; outer: [11.46484375, 11.20361328125, 10.25244140625] |
| concurrency_5 | PASS | 100/100 | 7.244 | 348.297 / 432.884 / 469.046 | inner: 20:35:13 up 10:48,  2 users,  load average: 1.71, 0.89, 0.37; outer: [11.42724609375, 11.2001953125, 10.25634765625] |
| concurrency_6 | PASS | 100/100 | 7.292 | 422.336 / 509.833 / 580.298 | inner: 20:35:20 up 10:48,  2 users,  load average: 1.98, 0.97, 0.40; outer: [11.642578125, 11.2578125, 10.28759765625] |
| concurrency_7 | PASS | 100/100 | 8.090 | 535.232 / 684.156 / 832.920 | inner: 20:35:27 up 10:48,  2 users,  load average: 2.30, 1.06, 0.43; outer: [11.4306640625, 11.22021484375, 10.27978515625] |
| concurrency_8 | PASS | 100/100 | 7.354 | 564.205 / 728.000 / 791.509 | inner: 20:35:35 up 10:48,  2 users,  load average: 3.02, 1.25, 0.51; outer: [10.81005859375, 11.0966796875, 10.24658203125] |
| density | PASS | 256 | 47.339 | — | inner: 20:35:43 up 10:48,  2 users,  load average: 3.58, 1.40, 0.56; outer: [10.9853515625, 11.1279296875, 10.2626953125] |
| cpu_controls | PASS | — | 1.367 | — | inner: 20:36:30 up 10:49,  2 users,  load average: 2.35, 1.37, 0.59; outer: [10.060546875, 10.77197265625, 10.17333984375] |
| seccomp_kill | PASS | 720/720 | 97.134 | — | inner: 20:36:32 up 10:49,  2 users,  load average: 2.35, 1.37, 0.59; outer: [10.060546875, 10.77197265625, 10.17333984375] |
| fault_guests | PASS | 180/180 | 94.573 | — | inner: 20:38:09 up 10:51,  3 users,  load average: 1.33, 1.28, 0.64; outer: [13.7587890625, 12.326171875, 10.8642578125] |

Each gate’s inner uptime/load, samples, hashes and CPU accounting: `report.json`.
Owned children remaining: 0.

## CPU-ms/VM (NESTED)

| Case | VMM user including guest | VMM system | Guest estimate† | Total | Load |
|---|---:|---:|---:|---:|---|
| smoke | 129.940 | 118.685 | 120.000 | 248.625 | inner: 20:34:19 up 10:47,  1 user,  load average: 0.73, 0.63, 0.26; outer: [11.130859375, 11.1259765625, 10.17724609375] |
| tool_smoke | 69.937 | 65.941 | 70.000 | 135.878 | inner: 20:34:20 up 10:47,  1 user,  load average: 0.73, 0.63, 0.26; outer: [11.130859375, 11.1259765625, 10.17724609375] |
| boot | 64.902 | 50.509 | 64.200 | 115.411 | inner: 20:34:20 up 10:47,  1 user,  load average: 0.73, 0.63, 0.26; outer: [11.130859375, 11.1259765625, 10.17724609375] |
| one_tool | 71.447 | 53.959 | 70.000 | 125.406 | inner: 20:34:32 up 10:47,  2 users,  load average: 0.79, 0.65, 0.28; outer: [10.1943359375, 10.923828125, 10.1162109375] |
| concurrency_1 | 80.234 | 62.500 | 78.300 | 142.734 | inner: 20:34:35 up 10:47,  2 users,  load average: 0.81, 0.66, 0.28; outer: [10.8193359375, 11.041015625, 10.162109375] |
| concurrency_2 | 103.116 | 63.388 | 101.400 | 166.504 | inner: 20:34:50 up 10:47,  2 users,  load average: 0.99, 0.70, 0.30; outer: [11.60205078125, 11.21484375, 10.23974609375] |
| concurrency_3 | 133.782 | 71.285 | 132.300 | 205.066 | inner: 20:34:58 up 10:47,  2 users,  load average: 1.15, 0.75, 0.32; outer: [11.0732421875, 11.111328125, 10.208984375] |
| concurrency_4 | 206.385 | 84.953 | 203.400 | 291.337 | inner: 20:35:05 up 10:47,  2 users,  load average: 1.51, 0.84, 0.35; outer: [11.46484375, 11.20361328125, 10.25244140625] |
| concurrency_5 | 246.364 | 94.091 | 243.100 | 340.455 | inner: 20:35:13 up 10:48,  2 users,  load average: 1.71, 0.89, 0.37; outer: [11.42724609375, 11.2001953125, 10.25634765625] |
| concurrency_6 | 295.652 | 108.484 | 289.300 | 404.136 | inner: 20:35:20 up 10:48,  2 users,  load average: 1.98, 0.97, 0.40; outer: [11.642578125, 11.2578125, 10.28759765625] |
| concurrency_7 | 339.447 | 126.288 | 335.300 | 465.735 | inner: 20:35:27 up 10:48,  2 users,  load average: 2.30, 1.06, 0.43; outer: [11.4306640625, 11.22021484375, 10.27978515625] |
| concurrency_8 | 310.961 | 112.939 | 310.800 | 423.900 | inner: 20:35:35 up 10:48,  2 users,  load average: 3.02, 1.25, 0.51; outer: [10.81005859375, 11.0966796875, 10.24658203125] |
| setup_only | 0.226 | 0.638 | 0.000 | 0.864 | inner: 20:36:30 up 10:49,  2 users,  load average: 2.35, 1.37, 0.59; outer: UNVERIFIED |
| bare_vm | 0.438 | 5.352 | 0.200 | 5.790 | inner: 20:36:30 up 10:49,  2 users,  load average: 2.35, 1.37, 0.59; outer: UNVERIFIED |

† Guest delta is Linux /proc/stat, tick-quantized and potentially includes foreign KVM workloads in the shared VM. Some guest/host-user residuals are negative: the counters do not close exactly. Precise host-user/guest attribution is UNVERIFIED; see cpu-analysis.json. The guest estimate is already included in user, not added again.
CPU excludes supervisor, spawn wrapper, and L0 QEMU/HVF; this cannot decide the metal 5 CPU-ms kill line.

Parking image: `6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6`. Idle 10.006687 s, VMM process CPU 0.000000% core; high-resolution VMM cgroup CPU 0.015100% core. 1000/1000 exchanges, 10 delayed replies, 0 stalls. vCPU wait state: kvm_vcpu_block.
