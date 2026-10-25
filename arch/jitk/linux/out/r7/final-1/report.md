# Linux functional suite

**NESTED — non-performance data. Status: PASS.**

Outer host: `21:44  up 1 day, 23:58, 1 user, load averages: 14.22 11.83 11.00`

| Gate | Result | Count | Wall s | p50 / p90 / p99 ms | Load |
|---|---|---:|---:|---|---|
| parking | PASS | 1000 exchanges | 10.888 | — | inner: 20:50:30 up 11:03,  1 user,  load average: 0.48, 0.79, 0.78; outer: [8.7216796875, 10.541015625, 10.74365234375] |
| smoke | PASS | 1/1 | 0.151 | 140.666 / 140.666 / 140.666 | inner: 20:50:41 up 11:03,  1 user,  load average: 0.54, 0.79, 0.78; outer: [8.943359375, 10.52392578125, 10.73486328125] |
| tool_smoke | PASS | 1/1 | 0.128 | 123.461 / 123.461 / 123.461 | inner: 20:50:41 up 11:03,  1 user,  load average: 0.54, 0.79, 0.78; outer: [8.943359375, 10.52392578125, 10.73486328125] |
| boot | PASS | 100/100 | 12.629 | 118.814 / 143.683 / 182.700 | inner: 20:50:41 up 11:03,  1 user,  load average: 0.54, 0.79, 0.78; outer: [8.943359375, 10.52392578125, 10.73486328125] |
| one_tool | PASS | 30/30 | 4.774 | 157.096 / 182.631 / 193.445 | inner: 20:50:54 up 11:03,  1 user,  load average: 0.61, 0.79, 0.78; outer: [11.12158203125, 10.89697265625, 10.8623046875] |
| concurrency_1 | PASS | 100/100 | 14.004 | 120.841 / 182.713 / 298.929 | inner: 20:50:59 up 11:03,  1 user,  load average: 0.64, 0.80, 0.78; outer: [11.12158203125, 10.89697265625, 10.8623046875] |
| concurrency_2 | PASS | 100/100 | 8.194 | 159.791 / 191.773 / 242.681 | inner: 20:51:13 up 11:04,  1 user,  load average: 0.72, 0.81, 0.79; outer: [11.8310546875, 11.07763671875, 10.927734375] |
| concurrency_3 | PASS | 100/100 | 7.109 | 206.188 / 238.424 / 315.237 | inner: 20:51:21 up 11:04,  1 user,  load average: 0.92, 0.85, 0.80; outer: [12.689453125, 11.27490234375, 10.99853515625] |
| concurrency_4 | PASS | 100/100 | 7.180 | 278.906 / 325.038 / 415.695 | inner: 20:51:28 up 11:04,  1 user,  load average: 1.08, 0.88, 0.81; outer: [12.3134765625, 11.22021484375, 10.98095703125] |
| concurrency_5 | PASS | 100/100 | 6.532 | 321.365 / 358.645 / 388.179 | inner: 20:51:35 up 11:04,  1 user,  load average: 1.32, 0.94, 0.83; outer: [14.4814453125, 11.708984375, 11.15625] |
| concurrency_6 | PASS | 100/100 | 6.707 | 398.772 / 441.901 / 487.347 | inner: 20:51:42 up 11:04,  1 user,  load average: 1.88, 1.07, 0.87; outer: [14.12255859375, 11.68017578125, 11.1494140625] |
| concurrency_7 | PASS | 100/100 | 7.413 | 504.627 / 590.273 / 727.630 | inner: 20:51:48 up 11:04,  1 user,  load average: 2.21, 1.15, 0.90; outer: [13.3115234375, 11.55224609375, 11.107421875] |
| concurrency_8 | PASS | 100/100 | 8.809 | 683.670 / 871.250 / 957.908 | inner: 20:51:56 up 11:04,  1 user,  load average: 2.95, 1.34, 0.97; outer: [12.708984375, 11.4833984375, 11.087890625] |
| density | PASS | 256 | 53.474 | — | inner: 20:52:05 up 11:04,  1 user,  load average: 3.52, 1.49, 1.02; outer: [12.14453125, 11.4013671875, 11.06298828125] |
| cpu_controls | PASS | — | 1.633 | — | inner: 20:52:58 up 11:05,  1 user,  load average: 2.02, 1.39, 1.01; outer: [21.3603515625, 13.408203125, 11.78955078125] |
| seccomp_kill | PASS | 720/720 | 1.553 | — | inner: 20:53:00 up 11:05,  1 user,  load average: 2.02, 1.39, 1.01; outer: [21.5712890625, 13.583984375, 11.86083984375] |
| fault_guests | PASS | 180/180 | 93.047 | — | inner: 20:53:01 up 11:05,  1 user,  load average: 2.10, 1.42, 1.02; outer: [21.5712890625, 13.583984375, 11.86083984375] |

Each gate’s inner uptime/load, samples, hashes and CPU accounting: `report.json`.
Owned children remaining: 0.

## CPU-ms/VM (NESTED)

| Case | VMM user including guest | VMM system | Guest estimate† | Total | Load |
|---|---:|---:|---:|---:|---|
| smoke | 72.247 | 69.237 | 70.000 | 141.484 | inner: 20:50:41 up 11:03,  1 user,  load average: 0.54, 0.79, 0.78; outer: [8.943359375, 10.52392578125, 10.73486328125] |
| tool_smoke | 69.821 | 53.630 | 70.000 | 123.451 | inner: 20:50:41 up 11:03,  1 user,  load average: 0.54, 0.79, 0.78; outer: [8.943359375, 10.52392578125, 10.73486328125] |
| boot | 70.240 | 55.111 | 68.700 | 125.351 | inner: 20:50:41 up 11:03,  1 user,  load average: 0.54, 0.79, 0.78; outer: [8.943359375, 10.52392578125, 10.73486328125] |
| one_tool | 89.873 | 68.322 | 88.000 | 158.195 | inner: 20:50:54 up 11:03,  1 user,  load average: 0.61, 0.79, 0.78; outer: [11.12158203125, 10.89697265625, 10.8623046875] |
| concurrency_1 | 77.959 | 60.823 | 75.500 | 138.782 | inner: 20:50:59 up 11:03,  1 user,  load average: 0.64, 0.80, 0.78; outer: [11.12158203125, 10.89697265625, 10.8623046875] |
| concurrency_2 | 99.840 | 62.482 | 98.300 | 162.322 | inner: 20:51:13 up 11:04,  1 user,  load average: 0.72, 0.81, 0.79; outer: [11.8310546875, 11.07763671875, 10.927734375] |
| concurrency_3 | 134.256 | 72.864 | 131.400 | 207.120 | inner: 20:51:21 up 11:04,  1 user,  load average: 0.92, 0.85, 0.80; outer: [12.689453125, 11.27490234375, 10.99853515625] |
| concurrency_4 | 191.141 | 82.640 | 187.300 | 273.781 | inner: 20:51:28 up 11:04,  1 user,  load average: 1.08, 0.88, 0.81; outer: [12.3134765625, 11.22021484375, 10.98095703125] |
| concurrency_5 | 222.746 | 83.575 | 220.300 | 306.321 | inner: 20:51:35 up 11:04,  1 user,  load average: 1.32, 0.94, 0.83; outer: [14.4814453125, 11.708984375, 11.15625] |
| concurrency_6 | 275.962 | 95.380 | 272.600 | 371.342 | inner: 20:51:42 up 11:04,  1 user,  load average: 1.88, 1.07, 0.87; outer: [14.12255859375, 11.68017578125, 11.1494140625] |
| concurrency_7 | 310.604 | 115.461 | 307.400 | 426.065 | inner: 20:51:48 up 11:04,  1 user,  load average: 2.21, 1.15, 0.90; outer: [13.3115234375, 11.55224609375, 11.107421875] |
| concurrency_8 | 377.487 | 133.863 | 370.800 | 511.350 | inner: 20:51:56 up 11:04,  1 user,  load average: 2.95, 1.34, 0.97; outer: [12.708984375, 11.4833984375, 11.087890625] |
| setup_only | 0.253 | 1.206 | 0.000 | 1.459 | inner: 20:52:58 up 11:05,  1 user,  load average: 2.02, 1.39, 1.01; outer: UNVERIFIED |
| bare_vm | 0.412 | 5.863 | 0.100 | 6.274 | inner: 20:52:58 up 11:05,  1 user,  load average: 2.02, 1.39, 1.01; outer: UNVERIFIED |

† Guest delta is Linux /proc/stat, tick-quantized and potentially includes foreign KVM workloads in the shared VM. Some guest/host-user residuals are negative: the counters do not close exactly. Precise host-user/guest attribution is UNVERIFIED; see cpu-analysis.json. The guest estimate is already included in user, not added again.
CPU excludes supervisor, spawn wrapper, and L0 QEMU/HVF; this cannot decide the metal 5 CPU-ms kill line.

Parking image: `6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6`. Idle 10.008431 s, VMM process CPU 0.099916% core; high-resolution VMM cgroup CPU 0.010431% core. 1000/1000 exchanges, 10 delayed replies, 0 stalls. vCPU wait state: kvm_vcpu_block.
