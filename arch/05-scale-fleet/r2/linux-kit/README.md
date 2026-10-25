# arm64 Ubuntu 24.04 KVM kit (G6)

Copy this entire directory to a **disposable arm64 Ubuntu 24.04 bare-metal host**, then:

```sh
./run.sh
```

No cloud API is called and nothing is provisioned. The script uses sudo for apt
when needed; it installs dependencies and a private Rust 1.95.0 toolchain beneath
`.work/`, fetches **libkrun a1d8616765da03980f3be1bb8714bfdd3842f33c**, builds its
minimal C ABI with **panic=abort**, compiles the Linux variant of 02's launcher,
and builds the bundled 02 R2 no_std kernel with the bundled stripped static qjs.
The kernel snapshot includes 02's R2 READY marker (macOS G1/G2 passed): source hashes and qjs digest
are in `sources.json`. No build depends on another agent's /tmp files or checkout.
`kernel/src/packed.rs` is regenerated from the pinned qjs ELF by `prepare.py`.

Results: **out/report.json**, **out/report.md**; build output: out/build.log.
On failure, reports preserve successful earlier measurements and label the
unfinished KVM-dependent stages **UNVERIFIED**. There is no TCG substitution.

Default workload: 1,000 sequential completed qjs VMs, then every spawn concurrency
**1 through 64**, **512 completions per concurrency**; each boots, emits protocol
v1 ready, computes `return 1+1`, emits done=2, shuts down and is reaped. Throughput
counts validated results and successful process exits, never Popen/READY counts.
Per-run nearest-rank latency p50/p90/p99, ready latency, getrusage children CPU-ms,
uptime before/after, failures and raw samples are retained. CPU accounting excludes
Python/the tool broker and host kernel work not charged to child threads.

The density sweep holds actual qjs guests at **1/32/64/128/256/512/1024/1536/2048**.
Stdin stays open without submitting code. Each VM joins its own cgroup before
libkrun starts (32 MiB guest; 128 MiB cgroup memory.max, swap disabled).
The parent needs writable cgroup v2 cpu+memory controllers: run as root or set
`JITK_CGROUP_ROOT` to a delegated empty subtree with those controllers available.
The kit enables those controllers on its selected parent, creates only its own
`jitk-05-PID` subtree, and removes it on exit. It reads every process's
smaps_rollup PSS and cgroup memory.current; records quantiles, sums and the parent
total (including charged kernel memory). It measures 3 s idle CPU from cpu.stat.
At >=2% core/VM it stops growing the pool (D4). All held guests must still return
2 and exit at the end; failures fail the run. 8 GiB MemAvailable is kept as a
safety floor. PSS and memory.current are measurements, not capacity reservations.

All VM operations have a 10 s external watchdog. SIGINT/SIGTERM, exceptions,
protocol failures and normal exit kill/reap every owned child, then remove its
cgroup. This benchmark launcher is not a production sandbox; security work
remains owned by 07. One console, one vCPU, no added disk/network devices.

Local no-KVM build validation:

```sh
JITK_BUILD_ONLY=1 ./run.sh
python3 selftest.py
python3 bench.py # intentionally fails cleanly when /dev/kvm is missing
```

`./run.sh --skip-deps` reuses already-installed OS packages. Every other default
is unchanged. Environment overrides are for short debugging runs, not gate runs:
JITK_BOOT_N, JITK_SWEEP_N, JITK_MAX_CONCURRENCY, JITK_DENSITY, JITK_IDLE_S,
JITK_BUILD_JOBS (default 4), JITK_TIMEOUT_S, JITK_TICK_US (default 0: IRQ-only WFI; finite ppoll arms CNTV).
Nondefault counts are captured by actual result rows; record overrides in the
report. A 2,048-VM production claim also needs full-RAM reservation, hostile
allocation and workload tests; these parked measurements do not establish it.

One fresh run time budget: **20–40 minutes UNVERIFIED** (downloads/build dominate;
33,768 normal completions plus 2,048 density guests and >=27 s idle sampling).
2026-10-24 retrieval of AWS's public [regional Spot price feed](https://spot-price.s3.amazonaws.com/spot.js)
reported c7g.metal Linux **us-east-1 $1.0222/h**, us-west-2 $0.3536/h,
eu-central-1 $0.5240/h. At the us-east-1 indicative rate, 20–40 min is
**$0.341–$0.681** compute, excluding EBS/egress and interruptions. The feed lacks
an AZ timestamp and is not a bookable quote; current AZ price/capacity remains
UNVERIFIED. Before renting, query [DescribeSpotPriceHistory](https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-spot-price-history.html)
for the chosen type/AZ; no credentials or cloud access are needed by this kit.
The retrieved regional values/provenance are preserved in `../results/spot-price.json`.
