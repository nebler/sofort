# Linux functional suite

**NESTED — non-performance data. Status: PASS.**

Outer host: `22:08  up 2 days, 22 mins, 1 user, load averages: 7.86 7.49 9.20`

| Gate | Result | Count | Wall s | p50 / p90 / p99 ms | Load |
|---|---|---:|---:|---|---|
| parking | PASS | 1000 exchanges | 10.854 | — | inner: 21:08:32 up 11:21,  1 user,  load average: 0.13, 0.27, 0.64; outer: [7.85595703125, 7.486328125, 9.2001953125] |
| smoke | PASS | 1/1 | 0.145 | 138.239 / 138.239 / 138.239 | inner: 21:08:43 up 11:21,  1 user,  load average: 0.40, 0.32, 0.66; outer: [7.35546875, 7.38818359375, 9.14501953125] |
| tool_smoke | PASS | 1/1 | 0.123 | 119.113 / 119.113 / 119.113 | inner: 21:08:43 up 11:21,  1 user,  load average: 0.40, 0.32, 0.66; outer: [7.35546875, 7.38818359375, 9.14501953125] |
| boot | PASS | 100/100 | 11.153 | 108.999 / 124.375 / 132.484 | inner: 21:08:43 up 11:21,  1 user,  load average: 0.40, 0.32, 0.66; outer: [7.35546875, 7.38818359375, 9.14501953125] |
| one_tool | PASS | 30/30 | 3.800 | 119.571 / 138.247 / 256.819 | inner: 21:08:54 up 11:21,  1 user,  load average: 0.50, 0.35, 0.66; outer: [7.08544921875, 7.326171875, 9.10205078125] |
| concurrency_1 | PASS | 100/100 | 11.707 | 110.507 / 129.914 / 175.090 | inner: 21:08:58 up 11:21,  1 user,  load average: 0.54, 0.36, 0.66; outer: [6.7578125, 7.25390625, 9.06591796875] |
| concurrency_2 | PASS | 100/100 | 7.143 | 138.461 / 158.209 / 170.997 | inner: 21:09:10 up 11:22,  2 users,  load average: 0.61, 0.38, 0.67; outer: [6.35546875, 7.142578125, 8.994140625] |
| concurrency_3 | PASS | 100/100 | 6.513 | 190.712 / 217.941 / 274.856 | inner: 21:09:17 up 11:22,  2 users,  load average: 0.75, 0.42, 0.68; outer: [6.08642578125, 7.07373046875, 8.958984375] |
| concurrency_4 | PASS | 100/100 | 6.323 | 251.888 / 274.463 / 288.276 | inner: 21:09:23 up 11:22,  2 users,  load average: 1.01, 0.48, 0.70; outer: [6.1591796875, 7.072265625, 8.947265625] |
| concurrency_5 | PASS | 100/100 | 6.478 | 321.639 / 352.012 / 380.075 | inner: 21:09:30 up 11:22,  1 user,  load average: 1.25, 0.53, 0.71; outer: [6.54736328125, 7.1201171875, 8.94140625] |
| concurrency_6 | PASS | 100/100 | 6.487 | 384.595 / 422.410 / 465.030 | inner: 21:09:36 up 11:22,  3 users,  load average: 1.91, 0.70, 0.77; outer: [6.42333984375, 7.08447265625, 8.91796875] |
| concurrency_7 | PASS | 100/100 | 7.399 | 473.572 / 692.936 / 927.324 | inner: 21:09:43 up 11:22,  3 users,  load average: 2.15, 0.77, 0.79; outer: [6.62939453125, 7.1162109375, 8.91796875] |
| concurrency_8 | PASS | 100/100 | 9.566 | 730.144 / 1089.339 / 1336.786 | inner: 21:09:50 up 11:22,  3 users,  load average: 2.54, 0.87, 0.82; outer: [8.38330078125, 7.474609375, 9.0234375] |
| density | PASS | 256 | 45.674 | — | inner: 21:10:00 up 11:22,  3 users,  load average: 3.38, 1.11, 0.90; outer: [9.55419921875, 7.7548828125, 9.1044921875] |
| cpu_controls | PASS | — | 0.756 | — | inner: 21:10:45 up 11:23,  3 users,  load average: 2.00, 1.06, 0.90; outer: [8.30126953125, 7.70263671875, 9.01611328125] |
| seccomp_kill | PASS | 720/720 | 1.123 | — | inner: 21:10:46 up 11:23,  3 users,  load average: 1.92, 1.06, 0.90; outer: [8.30126953125, 7.70263671875, 9.01611328125] |
| fault_guests | PASS | 180/180 | 92.781 | — | inner: 21:10:47 up 11:23,  3 users,  load average: 1.92, 1.06, 0.90; outer: [8.30126953125, 7.70263671875, 9.01611328125] |

Each gate’s inner uptime/load, samples, hashes and CPU accounting: `report.json`.
Owned children remaining: 0.

## CPU-ms/VM (NESTED)

| Case | VMM user including guest | VMM system | Guest estimate† | Total | Load |
|---|---:|---:|---:|---:|---|
| smoke | 64.257 | 54.371 | 60.000 | 118.628 | inner: 21:08:43 up 11:21,  1 user,  load average: 0.40, 0.32, 0.66; outer: [7.35546875, 7.38818359375, 9.14501953125] |
| tool_smoke | 69.949 | 49.964 | 70.000 | 119.913 | inner: 21:08:43 up 11:21,  1 user,  load average: 0.40, 0.32, 0.66; outer: [7.35546875, 7.38818359375, 9.14501953125] |
| boot | 62.122 | 46.059 | 61.800 | 108.180 | inner: 21:08:43 up 11:21,  1 user,  load average: 0.40, 0.32, 0.66; outer: [7.35546875, 7.38818359375, 9.14501953125] |
| one_tool | 71.660 | 49.668 | 70.000 | 121.328 | inner: 21:08:54 up 11:21,  1 user,  load average: 0.50, 0.35, 0.66; outer: [7.08544921875, 7.326171875, 9.10205078125] |
| concurrency_1 | 65.219 | 47.894 | 64.300 | 113.113 | inner: 21:08:58 up 11:21,  1 user,  load average: 0.54, 0.36, 0.66; outer: [6.7578125, 7.25390625, 9.06591796875] |
| concurrency_2 | 84.108 | 54.415 | 83.300 | 138.523 | inner: 21:09:10 up 11:22,  2 users,  load average: 0.61, 0.38, 0.67; outer: [6.35546875, 7.142578125, 8.994140625] |
| concurrency_3 | 121.963 | 62.604 | 120.000 | 184.567 | inner: 21:09:17 up 11:22,  2 users,  load average: 0.75, 0.42, 0.68; outer: [6.08642578125, 7.07373046875, 8.958984375] |
| concurrency_4 | 163.762 | 72.862 | 162.500 | 236.624 | inner: 21:09:23 up 11:22,  2 users,  load average: 1.01, 0.48, 0.70; outer: [6.1591796875, 7.072265625, 8.947265625] |
| concurrency_5 | 216.239 | 83.842 | 215.100 | 300.081 | inner: 21:09:30 up 11:22,  1 user,  load average: 1.25, 0.53, 0.71; outer: [6.54736328125, 7.1201171875, 8.94140625] |
| concurrency_6 | 268.435 | 90.468 | 267.400 | 358.902 | inner: 21:09:36 up 11:22,  3 users,  load average: 1.91, 0.70, 0.77; outer: [6.42333984375, 7.08447265625, 8.91796875] |
| concurrency_7 | 307.659 | 115.365 | 298.600 | 423.024 | inner: 21:09:43 up 11:22,  3 users,  load average: 2.15, 0.77, 0.79; outer: [6.62939453125, 7.1162109375, 8.91796875] |
| concurrency_8 | 400.430 | 148.610 | 382.700 | 549.040 | inner: 21:09:50 up 11:22,  3 users,  load average: 2.54, 0.87, 0.82; outer: [8.38330078125, 7.474609375, 9.0234375] |
| setup_only | 0.289 | 0.182 | 0.000 | 0.470 | inner: 21:10:45 up 11:23,  3 users,  load average: 2.00, 1.06, 0.90; outer: UNVERIFIED |
| bare_vm | 0.221 | 1.792 | 0.100 | 2.012 | inner: 21:10:45 up 11:23,  3 users,  load average: 1.92, 1.06, 0.90; outer: UNVERIFIED |

† Guest delta is Linux /proc/stat, tick-quantized and potentially includes foreign KVM workloads in the shared VM. Some guest/host-user residuals are negative: the counters do not close exactly. Precise host-user/guest attribution is UNVERIFIED; see cpu-analysis.json. The guest estimate is already included in user, not added again.
CPU excludes supervisor, spawn wrapper, and L0 QEMU/HVF; this cannot decide the metal 5 CPU-ms kill line.

Parking image: `75b2abe26021d9d0624b0555a64ed589d251cb7d30aa2965754974f3716d1732`. Idle 10.004826 s, VMM process CPU 0.000000% core; high-resolution VMM cgroup CPU 0.015902% core. 1000/1000 exchanges, 10 delayed replies, 0 stalls. vCPU wait state: kvm_vcpu_block.
