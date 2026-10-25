# Linux functional suite

**NESTED — non-performance data. Status: PASS.**

Outer host: `14:15  up 15:28, 2 users, load averages: 3.80 3.87 4.50`

| Gate | Result | Count | p50 / p90 / p99 ms | Load |
|---|---|---:|---|---|
| parking | PASS | 1000 exchanges | — | inner: uptime_seconds=0.92 0.01 loadavg=0.00 0.00 0.00 1/49 132; outer: [3.7978515625, 3.87255859375, 4.50341796875] |
| smoke | PASS | 1/1 | 16.246 / 16.246 / 16.246 | inner: uptime_seconds=11.67 10.03 loadavg=0.00 0.00 0.00 1/51 141; outer: [3.3740234375, 3.77783203125, 4.4619140625] |
| tool_smoke | PASS | 1/1 | 14.102 / 14.102 / 14.102 | inner: uptime_seconds=11.69 10.03 loadavg=0.00 0.00 0.00 1/51 149; outer: [3.3740234375, 3.77783203125, 4.4619140625] |
| boot | PASS | 100/100 | 16.386 / 33.222 / 37.144 | inner: uptime_seconds=11.71 10.03 loadavg=0.00 0.00 0.00 1/51 157; outer: [3.3740234375, 3.77783203125, 4.4619140625] |
| one_tool | PASS | 30/30 | 14.474 / 33.399 / 34.363 | inner: uptime_seconds=13.90 10.86 loadavg=0.00 0.00 0.00 1/51 660; outer: [3.583984375, 3.814453125, 4.470703125] |
| concurrency_1 | PASS | 100/100 | 16.894 / 33.292 / 34.004 | inner: uptime_seconds=14.45 10.98 loadavg=0.00 0.00 0.00 1/51 813; outer: [3.583984375, 3.814453125, 4.470703125] |
| concurrency_2 | PASS | 100/100 | 24.857 / 45.182 / 54.125 | inner: uptime_seconds=16.77 11.98 loadavg=0.16 0.03 0.01 2/51 1316; outer: [3.583984375, 3.814453125, 4.470703125] |
| concurrency_3 | PASS | 100/100 | 41.314 / 61.222 / 71.333 | inner: uptime_seconds=18.17 12.03 loadavg=0.16 0.03 0.01 2/51 1820; outer: [3.583984375, 3.814453125, 4.470703125] |
| concurrency_4 | PASS | 100/100 | 53.168 / 71.804 / 90.773 | inner: uptime_seconds=19.64 12.06 loadavg=0.16 0.03 0.01 3/51 2325; outer: [3.537109375, 3.80078125, 4.4619140625] |
| concurrency_5 | PASS | 100/100 | 67.403 / 89.454 / 101.364 | inner: uptime_seconds=21.04 12.06 loadavg=0.71 0.15 0.05 2/51 2831; outer: [3.537109375, 3.80078125, 4.4619140625] |
| concurrency_6 | PASS | 100/100 | 86.434 / 107.198 / 116.091 | inner: uptime_seconds=22.47 12.08 loadavg=0.71 0.15 0.05 4/51 3338; outer: [3.537109375, 3.80078125, 4.4619140625] |
| concurrency_7 | PASS | 100/100 | 95.225 / 120.947 / 142.367 | inner: uptime_seconds=23.98 12.10 loadavg=0.71 0.15 0.05 2/51 3846; outer: [3.81396484375, 3.853515625, 4.4765625] |
| concurrency_8 | PASS | 100/100 | 116.656 / 148.708 / 167.366 | inner: uptime_seconds=25.41 12.13 loadavg=1.53 0.33 0.11 4/53 4357; outer: [3.81396484375, 3.853515625, 4.4765625] |
| density | PASS | 256 | — | inner: uptime_seconds=26.93 12.13 loadavg=1.53 0.33 0.11 2/53 4867; outer: [3.70458984375, 3.8173828125, 4.4443359375] |
| cpu_controls | PASS | — | — | inner: uptime_seconds=49.00 28.08 loadavg=1.22 0.34 0.11 2/53 6157; outer: [3.70458984375, 3.8173828125, 4.4443359375] |
| seccomp_kill | PASS | 720/720 | — | inner: uptime_seconds=49.35 28.15 loadavg=1.22 0.34 0.11 1/53 6661; outer: [3.70458984375, 3.8173828125, 4.4443359375] |
| fault_guests | PASS | 180/180 | — | inner: uptime_seconds=49.51 28.16 loadavg=1.22 0.34 0.11 1/53 7405; outer: [4.95556640625, 4.177734375, 4.5146484375] |

Each gate’s inner uptime/load, samples, hashes and CPU accounting: `report.json`.
Owned children remaining: 0.

## CPU-ms/VM (NESTED)

| Case | VMM user including guest | VMM system | Guest estimate† | Total | Load |
|---|---:|---:|---:|---:|---|
| smoke | 3.616 | 10.849 | 10.000 | 14.465 | inner: uptime_seconds=11.67 10.03 loadavg=0.00 0.00 0.00 1/51 141; outer: [3.3740234375, 3.77783203125, 4.4619140625] |
| tool_smoke | 3.228 | 9.684 | 0.000 | 12.912 | inner: uptime_seconds=11.69 10.03 loadavg=0.00 0.00 0.00 1/51 149; outer: [3.3740234375, 3.77783203125, 4.4619140625] |
| boot | 4.343 | 7.760 | 4.300 | 12.104 | inner: uptime_seconds=11.71 10.03 loadavg=0.00 0.00 0.00 1/51 157; outer: [3.3740234375, 3.77783203125, 4.4619140625] |
| one_tool | 4.457 | 8.364 | 4.667 | 12.821 | inner: uptime_seconds=13.90 10.86 loadavg=0.00 0.00 0.00 1/51 660; outer: [3.583984375, 3.814453125, 4.470703125] |
| concurrency_1 | 4.143 | 7.635 | 4.200 | 11.777 | inner: uptime_seconds=14.45 10.98 loadavg=0.00 0.00 0.00 1/51 813; outer: [3.583984375, 3.814453125, 4.470703125] |
| concurrency_2 | 4.322 | 7.814 | 4.300 | 12.136 | inner: uptime_seconds=16.77 11.98 loadavg=0.16 0.03 0.01 2/51 1316; outer: [3.583984375, 3.814453125, 4.470703125] |
| concurrency_3 | 5.168 | 7.962 | 5.200 | 13.130 | inner: uptime_seconds=18.17 12.03 loadavg=0.16 0.03 0.01 2/51 1820; outer: [3.583984375, 3.814453125, 4.470703125] |
| concurrency_4 | 4.589 | 8.238 | 4.800 | 12.827 | inner: uptime_seconds=19.64 12.06 loadavg=0.16 0.03 0.01 3/51 2325; outer: [3.537109375, 3.80078125, 4.4619140625] |
| concurrency_5 | 4.585 | 8.235 | 4.500 | 12.821 | inner: uptime_seconds=21.04 12.06 loadavg=0.71 0.15 0.05 2/51 2831; outer: [3.537109375, 3.80078125, 4.4619140625] |
| concurrency_6 | 5.615 | 7.964 | 5.700 | 13.578 | inner: uptime_seconds=22.47 12.08 loadavg=0.71 0.15 0.05 4/51 3338; outer: [3.537109375, 3.80078125, 4.4619140625] |
| concurrency_7 | 4.663 | 7.903 | 4.900 | 12.566 | inner: uptime_seconds=23.98 12.10 loadavg=0.71 0.15 0.05 2/51 3846; outer: [3.81396484375, 3.853515625, 4.4765625] |
| concurrency_8 | 5.870 | 7.973 | 6.200 | 13.842 | inner: uptime_seconds=25.41 12.13 loadavg=1.53 0.33 0.11 4/53 4357; outer: [3.81396484375, 3.853515625, 4.4765625] |
| setup_only | 0.287 | 0.031 | 0.000 | 0.318 | inner: uptime_seconds=49.00 28.08 loadavg=1.22 0.34 0.11 2/53 6157; outer: UNVERIFIED |
| bare_vm | 0.718 | 0.513 | 0.200 | 1.232 | inner: uptime_seconds=49.11 28.11 loadavg=1.22 0.34 0.11 1/53 6359; outer: UNVERIFIED |

† Guest delta is Linux /proc/stat, tick-quantized. Some guest/host-user residuals are negative: the counters do not close exactly. Precise host-user/guest attribution is UNVERIFIED; see cpu-analysis.json. The guest estimate is already included in user, not added again.
CPU excludes supervisor, spawn wrapper, and L0 QEMU/HVF; this cannot decide the metal 5 CPU-ms kill line.

Parking image: `6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6`. Idle 10.003357 s, VMM process CPU 0.000000% core; high-resolution VMM cgroup CPU 0.004239% core. 1000/1000 exchanges, 10 delayed replies, 0 stalls. vCPU wait state: kvm_vcpu_block.
