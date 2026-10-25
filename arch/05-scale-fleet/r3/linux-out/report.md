# Linux functional suite

**NESTED — non-performance data. Status: PASS.**

Outer host: ` 3:35  up  4:48, 2 users, load averages: 25.32 48.05 61.71`

| Gate | Result | Count | p50 / p90 / p99 ms |
|---|---|---:|---|
| parking | PASS | 1000 exchanges | — |
| smoke | PASS | 1/1 | 18.190 / 18.190 / 18.190 |
| tool_smoke | PASS | 1/1 | 12.925 / 12.925 / 12.925 |
| boot | PASS | 100/100 | 13.080 / 33.309 / 35.856 |
| one_tool | PASS | 30/30 | 14.380 / 19.259 / 39.620 |
| concurrency_1 | PASS | 100/100 | 12.880 / 33.714 / 37.398 |
| concurrency_2 | PASS | 100/100 | 25.610 / 45.567 / 61.519 |
| concurrency_3 | PASS | 100/100 | 41.187 / 61.408 / 80.294 |
| concurrency_4 | PASS | 100/100 | 54.217 / 73.409 / 84.739 |
| concurrency_5 | PASS | 100/100 | 69.144 / 89.992 / 99.622 |
| concurrency_6 | PASS | 100/100 | 85.048 / 114.161 / 132.354 |
| concurrency_7 | PASS | 100/100 | 91.534 / 115.016 / 139.157 |
| concurrency_8 | PASS | 100/100 | 111.851 / 143.736 / 172.805 |
| density | PASS | 256 | — |
| cpu_controls | PASS | — | — |
| seccomp_kill | PASS | 720/720 | — |
| fault_guests | PASS | 180/180 | — |

Each gate’s inner uptime/load, samples, hashes and CPU accounting: `report.json`.
Owned children remaining: 0.

## CPU-ms/VM (NESTED)

| Case | VMM user including guest | VMM system | Guest estimate† | Total |
|---|---:|---:|---:|---:|
| smoke | 4.162 | 12.486 | 10.000 | 16.648 |
| tool_smoke | 7.679 | 3.839 | 0.000 | 11.518 |
| boot | 4.646 | 7.441 | 4.600 | 12.087 |
| one_tool | 5.110 | 8.561 | 5.333 | 13.672 |
| concurrency_1 | 4.433 | 7.642 | 4.400 | 12.075 |
| concurrency_2 | 3.320 | 8.717 | 3.400 | 12.037 |
| concurrency_3 | 4.854 | 8.349 | 4.800 | 13.203 |
| concurrency_4 | 3.755 | 9.164 | 3.700 | 12.919 |
| concurrency_5 | 4.212 | 8.869 | 4.200 | 13.081 |
| concurrency_6 | 5.323 | 8.305 | 5.200 | 13.628 |
| concurrency_7 | 4.171 | 8.279 | 4.300 | 12.450 |
| concurrency_8 | 4.439 | 8.994 | 4.800 | 13.434 |
| setup_only | 0.295 | 0.778 | 0.000 | 1.073 |
| bare_vm | 0.944 | 1.963 | 0.200 | 2.907 |

† Guest delta is Linux /proc/stat, tick-quantized. Some guest/host-user residuals are negative: the counters do not close exactly. Precise host-user/guest attribution is UNVERIFIED; see cpu-analysis.json. The guest estimate is already included in user, not added again.
CPU excludes supervisor, spawn wrapper, and L0 QEMU/HVF; this cannot decide the metal 5 CPU-ms kill line.

Parking image: `5dcfd9054667442aae47621ec78c4fde55646ed303b84e855a8935fc06fe1b36`. Idle 10.005373 s, VMM process CPU 0.000000% core; high-resolution VMM cgroup CPU 0.004018% core. 1000/1000 exchanges, 10 delayed replies, 0 stalls. vCPU wait state: kvm_vcpu_block.
