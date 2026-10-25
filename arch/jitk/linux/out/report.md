# Linux functional suite

**NESTED — non-performance data. Status: PASS.**

Outer host: `21:54  up 2 days, 8 mins, 1 user, load averages: 12.71 12.94 11.82`

| Gate | Result | Count | Wall s | p50 / p90 / p99 ms | Load |
|---|---|---:|---:|---|---|
| parking | PASS | 1000 exchanges | 10.923 | — | inner: 20:54:53 up 11:07,  1 user,  load average: 0.91, 1.23, 0.99; outer: [12.71044921875, 12.9404296875, 11.81982421875] |
| smoke | PASS | 1/1 | 0.162 | 142.813 / 142.813 / 142.813 | inner: 20:55:04 up 11:07,  1 user,  load average: 0.77, 1.19, 0.98; outer: [12.01513671875, 12.77880859375, 11.78173828125] |
| tool_smoke | PASS | 1/1 | 0.126 | 122.125 / 122.125 / 122.125 | inner: 20:55:05 up 11:07,  1 user,  load average: 0.77, 1.19, 0.98; outer: [12.01513671875, 12.77880859375, 11.78173828125] |
| boot | PASS | 100/100 | 11.754 | 112.874 / 127.985 / 174.596 | inner: 20:55:05 up 11:07,  1 user,  load average: 0.77, 1.19, 0.98; outer: [12.01513671875, 12.77880859375, 11.78173828125] |
| one_tool | PASS | 30/30 | 3.711 | 119.213 / 132.376 / 161.416 | inner: 20:55:16 up 11:08,  1 user,  load average: 0.82, 1.18, 0.99; outer: [10.5615234375, 12.4404296875, 11.6728515625] |
| concurrency_1 | PASS | 100/100 | 11.557 | 112.306 / 122.735 / 151.159 | inner: 20:55:20 up 11:08,  1 user,  load average: 0.82, 1.18, 0.99; outer: [10.35595703125, 12.36669921875, 11.65087890625] |
| concurrency_2 | PASS | 100/100 | 8.002 | 153.783 / 176.822 / 258.394 | inner: 20:55:32 up 11:08,  1 user,  load average: 0.86, 1.17, 0.99; outer: [9.365234375, 12.09033203125, 11.56103515625] |
| concurrency_3 | PASS | 100/100 | 7.163 | 210.851 / 239.565 / 355.575 | inner: 20:55:40 up 11:08,  1 user,  load average: 1.03, 1.20, 1.00; outer: [8.98828125, 11.92138671875, 11.50732421875] |
| concurrency_4 | PASS | 100/100 | 7.268 | 287.837 / 323.572 / 385.378 | inner: 20:55:47 up 11:08,  1 user,  load average: 1.33, 1.26, 1.02; outer: [9.06884765625, 11.88916015625, 11.498046875] |
| concurrency_5 | PASS | 100/100 | 7.033 | 337.936 / 391.738 / 418.393 | inner: 20:55:54 up 11:08,  1 user,  load average: 1.55, 1.31, 1.04; outer: [9.28515625, 11.8427734375, 11.486328125] |
| concurrency_6 | PASS | 100/100 | 7.218 | 429.279 / 477.952 / 520.878 | inner: 20:56:01 up 11:08,  1 user,  load average: 2.08, 1.43, 1.08; outer: [9.18212890625, 11.77880859375, 11.4658203125] |
| concurrency_7 | PASS | 100/100 | 7.334 | 495.865 / 588.367 / 685.051 | inner: 20:56:08 up 11:09,  1 user,  load average: 2.39, 1.51, 1.11; outer: [8.92724609375, 11.6826171875, 11.43359375] |
| concurrency_8 | PASS | 100/100 | 8.393 | 627.343 / 934.102 / 1215.206 | inner: 20:56:16 up 11:09,  1 user,  load average: 3.10, 1.69, 1.17; outer: [8.716796875, 11.544921875, 11.38720703125] |
| density | PASS | 256 | 45.925 | — | inner: 20:56:24 up 11:09,  1 user,  load average: 3.65, 1.83, 1.22; outer: [10.0205078125, 11.76806640625, 11.466796875] |
| cpu_controls | PASS | — | 0.744 | — | inner: 20:57:10 up 11:10,  1 user,  load average: 2.12, 1.68, 1.19; outer: [8.15625, 11.04736328125, 11.21875] |
| seccomp_kill | PASS | 720/720 | 0.951 | — | inner: 20:57:11 up 11:10,  1 user,  load average: 2.03, 1.67, 1.19; outer: [8.15625, 11.04736328125, 11.21875] |
| fault_guests | PASS | 180/180 | 92.603 | — | inner: 20:57:12 up 11:10,  1 user,  load average: 2.03, 1.67, 1.19; outer: [8.15625, 11.04736328125, 11.21875] |

Each gate’s inner uptime/load, samples, hashes and CPU accounting: `report.json`.
Owned children remaining: 0.

## CPU-ms/VM (NESTED)

| Case | VMM user including guest | VMM system | Guest estimate† | Total | Load |
|---|---:|---:|---:|---:|---|
| smoke | 69.483 | 73.511 | 70.000 | 142.994 | inner: 20:55:04 up 11:07,  1 user,  load average: 0.77, 1.19, 0.98; outer: [12.01513671875, 12.77880859375, 11.78173828125] |
| tool_smoke | 61.848 | 60.834 | 60.000 | 122.682 | inner: 20:55:05 up 11:07,  1 user,  load average: 0.77, 1.19, 0.98; outer: [12.01513671875, 12.77880859375, 11.78173828125] |
| boot | 65.654 | 51.240 | 64.500 | 116.894 | inner: 20:55:05 up 11:07,  1 user,  load average: 0.77, 1.19, 0.98; outer: [12.01513671875, 12.77880859375, 11.78173828125] |
| one_tool | 70.078 | 53.187 | 69.333 | 123.266 | inner: 20:55:16 up 11:08,  1 user,  load average: 0.82, 1.18, 0.99; outer: [10.5615234375, 12.4404296875, 11.6728515625] |
| concurrency_1 | 65.266 | 49.987 | 64.400 | 115.253 | inner: 20:55:20 up 11:08,  1 user,  load average: 0.82, 1.18, 0.99; outer: [10.35595703125, 12.36669921875, 11.65087890625] |
| concurrency_2 | 97.385 | 61.107 | 96.200 | 158.492 | inner: 20:55:32 up 11:08,  1 user,  load average: 0.86, 1.17, 0.99; outer: [9.365234375, 12.09033203125, 11.56103515625] |
| concurrency_3 | 132.225 | 73.748 | 131.200 | 205.973 | inner: 20:55:40 up 11:08,  1 user,  load average: 1.03, 1.20, 1.00; outer: [8.98828125, 11.92138671875, 11.50732421875] |
| concurrency_4 | 193.197 | 83.536 | 189.500 | 276.733 | inner: 20:55:47 up 11:08,  1 user,  load average: 1.33, 1.26, 1.02; outer: [9.06884765625, 11.88916015625, 11.498046875] |
| concurrency_5 | 239.313 | 91.366 | 237.500 | 330.680 | inner: 20:55:54 up 11:08,  1 user,  load average: 1.55, 1.31, 1.04; outer: [9.28515625, 11.8427734375, 11.486328125] |
| concurrency_6 | 298.698 | 104.743 | 296.500 | 403.442 | inner: 20:56:01 up 11:08,  1 user,  load average: 2.08, 1.43, 1.08; outer: [9.18212890625, 11.77880859375, 11.4658203125] |
| concurrency_7 | 307.977 | 112.109 | 302.500 | 420.086 | inner: 20:56:08 up 11:09,  1 user,  load average: 2.39, 1.51, 1.11; outer: [8.92724609375, 11.6826171875, 11.43359375] |
| concurrency_8 | 361.468 | 123.424 | 354.600 | 484.892 | inner: 20:56:16 up 11:09,  1 user,  load average: 3.10, 1.69, 1.17; outer: [8.716796875, 11.544921875, 11.38720703125] |
| setup_only | 0.267 | 0.301 | 0.000 | 0.568 | inner: 20:57:10 up 11:10,  1 user,  load average: 2.12, 1.68, 1.19; outer: UNVERIFIED |
| bare_vm | 0.191 | 1.936 | 0.100 | 2.127 | inner: 20:57:10 up 11:10,  1 user,  load average: 2.12, 1.68, 1.19; outer: UNVERIFIED |

† Guest delta is Linux /proc/stat, tick-quantized and potentially includes foreign KVM workloads in the shared VM. Some guest/host-user residuals are negative: the counters do not close exactly. Precise host-user/guest attribution is UNVERIFIED; see cpu-analysis.json. The guest estimate is already included in user, not added again.
CPU excludes supervisor, spawn wrapper, and L0 QEMU/HVF; this cannot decide the metal 5 CPU-ms kill line.

Parking image: `6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6`. Idle 10.003630 s, VMM process CPU 0.000000% core; high-resolution VMM cgroup CPU 0.015174% core. 1000/1000 exchanges, 10 delayed replies, 0 stalls. vCPU wait state: kvm_vcpu_block.
