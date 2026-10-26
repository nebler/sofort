# Linux/KVM fleet kit (owner 05)

Functional run on the M4 Mac, using the existing **kvm-dev** VM over SSH
(HVF → Ubuntu 7.0 → KVM; NESTED, non-performance):

```sh
arch/jitk/linux/run.sh --nested
```

Builds **01's canonical `vmm/build.py` and source**, pinned libkrun
`a1d8616765da03980f3be1bb8714bfdd3842f33c`, all patches in its series,
minimal native rlib, panic=abort. Uses 07's integrated sandbox module; the build
fails closed until its `.READY` exists. Builds 02's integrated kernel in an
area-05 work copy with 03's integrated bootstrap. No second VMM implementation.
The compiler/toolchain, extracted guest, overlays and binaries live under
`linux/.work` by default; `JITK_WORK` selects another absolute work directory.
No global toolchain installation. For a verified existing canonical Linux build,
set `JITK_CANONICAL_VMM` to its absolute binary path; the adjacent `build.json`
must match the binary and current patch hashes. This uses Zig to cross-build
the small C helpers. Fault assembly is read from `../vmm/tests/fixtures/`;
Linux keeps no copies. Paths derive from the script location, so a complete
kit copy works regardless of its directory name.
Requires a running approved kvm-dev VM with passwordless sudo, cgroup v2
memory+cpu controllers, Python and flock; Docker for a fresh VMM build; existing
Rust 1.95.0 + aarch64-unknown-none, clang, ld.lld, llvm-objcopy and Python on
the Mac. The runner finds `kvm-dev/ssh.sh` in the main Git checkout, including
from worktrees. `JITK_NESTED_SSH=/absolute/path/to/ssh-wrapper` selects another
existing equivalent VM; the wrapper accepts one remote shell command.
It only creates a unique directory under `/home/dev/jitk-suite/`, runs under
`flock -w 600 /home/dev/bench.lock`, and removes that run directory after success.
It never starts, stops, restarts or configures a VM. Failed-run scratch is retained
for diagnosis. No files are copied into another agent's checkout.

The former second-QEMU backend remains explicit:
`JITK_NESTED_BACKEND=qemu arch/jitk/linux/run.sh --nested`. It additionally needs
QEMU HVF and cpio. R7 reproduces an Apple Hypervisor assertion spin after 60 VM
creations in that path, with either Debian 6.12 or Ubuntu 7.0 as outer kernel;
see [RESULTS-R7-suite.md](RESULTS-R7-suite.md). Its host-side watchdog fails fast.
Set `JITK_NESTED_BASE` to an existing directory containing `vmlinuz` and
`base.cpio.gz` to reuse a Debian nested harness read-only; an invalid directory
fails explicitly. Otherwise `prepare-nested.sh` creates one in the workdir.
Its minimal Python base is augmented with Debian’s full standard-library
package for the measurement harness.

The nested suite first tests parking on the same freshly built current kernel
as all other gates: READY → 10 s idle VMM user+sys → 1000 sequential real tool
exchanges, every 100th reply delayed 3 ms. It records vCPU wait state, stalls,
process and high-resolution cgroup CPU, and all outer/inner load readings.
The SSH backend uses the existing VM's CPU/memory configuration without changing
it (R7: 6 vCPU / 9 GiB). The optional second-QEMU backend uses **one vCPU**
by default (`JITK_NESTED_VCPUS` overrides); increasing it did not fix the R7
assertion spin. A four-vCPU R3 repeat also hit an outer Linux hard lockup.

The remaining nested suite runs 100 qjs boots, 30 real tool calls, n=100 at each
concurrency 1..8, density 1/32/64/128/256, 100 setup-only and bare-VM CPU controls,
30 repetitions per seccomp vector and per hostile guest. Unknown privileged sysreg access on KVM is terminated by the 3 s external watchdog; its SIGKILL is explicit in the report. Every number is
**NESTED, non-performance**, with both outer Mac uptime and inner Linux uptime.
06's canonical benchmark is macOS-oriented; this is the separate E7 functional
suite, with no claim to pass its quiet-host performance gate.

Every gate emits start/end times and completed-work counters. The external
watchdog runs on the Mac and, for SSH, independently inside the existing VM.
Defaults: **90 s startup, 60 s without progress per gate, 300 s absolute per
gate, 900 s entire suite**. SSH separately allows up to **600 s** for the shared
bench lock (`JITK_LOCK_TIMEOUT_S`), reporting lock exhaustion explicitly; this
queue allowance is added only to the Mac observer's startup/total limits.
Once the remote monitor starts, normal gate deadlines apply. `JITK_STARTUP_TIMEOUT_S`, `JITK_GATE_TIMEOUT_S`,
`JITK_GATE_DEADLINE_S`, and `JITK_NESTED_TIMEOUT` override those limits.
The SSH observer allows 15 s extra for remote timeout diagnostics. Heartbeats
and duplicate counters do not reset deadlines. Timeout messages name the gate,
last completion count, limit and log. Only suite-owned process groups are killed;
the tested VMMs retain their separate 30 s I/O and 3 s hostile-guest watchdogs.
The remote watchdog also empties/removes the suite-PID cgroup subtree after a
forced supervisor kill, covering helpers that deliberately use separate sessions.
`out/run-timing.json` records the limits, gate events and observed suite wall time.
Run watchdog failure-injection checks with `./tool.sh test-watch`.

Coverage is identical on both backends (certification rejects reduced runs):

| Gate/check | Before | SSH replacement |
|---|---|---|
| KVM API version/create and cgroup controllers | required | required |
| Exact sandbox ack + guest READY, cgroup at birth, correct result/exit, reap | every normal VM | every normal VM |
| Parking on the same current image | 10 s idle <2% process and cgroup CPU; 1,000 exchanges; 10 delayed 3 ms replies; wait state | same |
| Smoke / tool smoke | 1 / 1 | same |
| Sequential boots / real tool calls | 100 / 30 | same |
| Concurrency 1,2,3,4,5,6,7,8 | 100 each | same; marker now requires 100, previously only 30 |
| Density; idle CPU <2% per VM; PSS/cgroup memory; validate all parked results | 1,32,64,128,256; 3 s idle each; 256 results | same |
| CPU controls | 100 setup-only (exit 70), 100 bare-VM (exit 0) | same |
| Seccomp | 3 roles × 8 actions × 30 = 720 | same |
| Hostile guests | 6 fixtures × 30 = 180; external 3 s kill explicit | same |
| Cleanup / identity / load | zero owned children, artifact hashes, inner/outer load | same; source hashes and per-gate deadlines added |

Seccomp roles: main, vCPU, console. Actions: exit, openat, socket, execve,
KVM_CREATE_VM, KVM_RUN, executable mmap, kill. Only exit and vCPU KVM_RUN
(with an invalid fd) are permitted; the other vectors must SIGSYS.
Hostile fixtures: unknown-hvc, unknown-smc, mmio-halfword, bad-sysreg,
console_avail_oob, rtc_oob_read. No fixture or repetition was removed.

`spawn-cg.c` adapts 07's supervisor helper. Every VMM is born inside its own
cgroup via `clone3(CLONE_INTO_CGROUP)`; placement is checked in `/proc/PID/cgroup`
before RUN. **No `cgroup.procs` writes.** The wrapper reports VMM-only wait4
user/system CPU (excluding wrapper CPU). Readiness requires the exact host
stderr ack `{"sandbox":"ok"}` AND guest stdout `{"t":"ready","v":1}`.
Each I/O/reap has an external deadline; timeout kills the process group and
cgroup, then reaps owned children. Parent death kills the VMM. One port, one
vCPU, 32 MiB. Each parked guest must return the right result after density.

`seccomp-probe.c` is 07's standalone syscall probe, extended with exec/mmap/kill.
`./tool.sh build-probes` compiles filters from the **exact canonical sandbox BPF module**,
not a second allowlist. It validates main/vCPU/console roles and KVM_RUN allowance
with an invalid fd. It does not inject native host syscalls into the production
VMM. The canonical VMM itself is used for every boot/tool/density/fault test.

Results: `out/run-timing.json` (gate deadlines/events/wall time), `out/report.json` (raw samples, hashes, all gates), `out/nested.log`
(serial transcript), `out/build.log`, `out/kernel-build.log`.
`.READY` exists only after the full nested suite passes; its hashes identify
the tested artifacts. A new source snapshot needs a new run.

## Metal: one command, no provisioning

On an **already approved/provisioned** aarch64 Ubuntu 24.04+ c7g.metal host:

```sh
arch/jitk/linux/run.sh
```

Installs OS build dependencies and a **private** Rust 1.95.0 toolchain, builds the
same canonical VMM/kernel, then boot n=1000, c=1..64 n=512, density through 2048,
and containment/CPU controls. Root or sudo and cgroup v2 with memory+cpu are
required. The kit contains no cloud provisioning code. It preserves 8 GiB
MemAvailable headroom on metal; nested tests use 128 MiB headroom in the 6 GiB
outer VM. CPU, guest RAM and cgroup charges are reported separately; 32 MiB
configured RAM is not a measured 32 MiB total host-footprint claim.

Budget **20–45 minutes UNVERIFIED**, mostly downloads/builds; warm rerun
**3–10 minutes UNVERIFIED**. 2026-10-24 AWS public regional Spot feed:
us-west-2 $0.3536/h → $0.118–0.265 compute; us-east-1 $1.0222/h → $0.341–0.767;
eu-central-1 $0.5240/h → $0.175–0.393. Excludes EBS, egress, interruption,
capacity and AZ-specific quote. Feed evidence: `out/cost.json` and `out/spot.js`.
Before rental use the current AZ quote via
[DescribeSpotPriceHistory](https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-spot-price-history.html).
No instance has been provisioned.

## CPU accounting

Linux wait4 user includes guest CPU. Each batch samples L1 `/proc/stat` guest
before/after and reports the residual after subtracting it from VMM user.
**The shared SSH VM can contain foreign KVM workloads**, so this guest delta and
the derived host-user residual are UNVERIFIED; only the VMM-specific wait4
user+system totals are measured. Do not interpret these counters as an exact
additive decomposition. The isolated legacy backend had closure problems too.
Guest accounting is tick-quantized; the report includes a conservative
CPU-count × tick/n resolution bound. The zombie's per-process guest ticks are
retained as an audit, not used to pretend sub-tick individual accuracy.
The VMM-only columns exclude Python, clone wrapper and L0 QEMU/HVF. Additional batch columns report Python supervisor CPU and VMM+clone-wrapper CPU, so host orchestration costs stay visible.
Thus nested CPU-ms cannot decide the 5 CPU-ms/VM **metal** kill line. On metal,
ensure no foreign KVM guests before using the aggregate guest delta; otherwise
use per-cgroup/per-task high-resolution profiling and label unresolved guest
attribution UNVERIFIED.

The final CPU validation found that global guest ticks and adjusted task user
CPU do not close exactly (some derived host-user residuals are negative).
`out/cpu-analysis.json` preserves and flags this. User/system totals are the
measured VMM counters; guest figures are estimates and precise additive
host-user/guest attribution remains **UNVERIFIED**. Nominal tick resolution is
not a complete error bound. See area 05's R3.md for the measured cost buckets,
proposed fixes and transfer limits. The metal 5 CPU-ms criterion is unpassed.

## Native TypeScript tools

`make build build-linux` installs the locked scriptc 0.4.5 compiler and builds
native Mac and static aarch64 Linux musl tools. Set `ZIG` if zig is elsewhere.
`./tool.sh NAME [ARGS...]` replaces `python3 NAME.py [ARGS...]`; nested and
historical commands use their original basename (for example `run-ssh`,
`parking-check`, `analyze-r7`). The Linux artifact needs no Node or Python.
The SSH runner uploads it with the canonical VMM, images and BPF filters.
`make test` runs the full nested profile from Mac; on Linux it uses the prebuilt
artifact with `JITK_BIN` pointing at the staged VM inputs (run as root for cgroups).
Evidence still defaults to `.work/out/`; `JITK_RECORD=1` retains its original
explicit recording behavior. See `PORT-PARITY.md` and `SCRIPTC-GAPS.md`.
