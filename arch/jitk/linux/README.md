# Linux/KVM fleet kit (owner 05)

Functional run on the M4 Mac, using 07's QEMU HVF → Debian 6.12 → KVM harness:

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
Requires QEMU with HVF nested virtualization, Docker, existing Rust 1.95.0 +
aarch64-unknown-none, clang, ld.lld, llvm-objcopy, Python and cpio.
Set `JITK_NESTED_BASE` to an existing directory containing `vmlinuz` and
`base.cpio.gz` to reuse a Debian nested harness read-only; an invalid directory
fails explicitly. Otherwise `prepare-nested.sh` creates one in the workdir.
Its minimal Python base is augmented with Debian’s full standard-library
package for the measurement harness.

The nested suite first tests parking on the same freshly built current kernel
as all other gates: READY → 10 s idle VMM user+sys → 1000 sequential real tool
exchanges, every 100th reply delayed 3 ms. It records vCPU wait state, stalls,
process and high-resolution cgroup CPU, and all outer/inner load readings.
The outer Debian uses **one vCPU** by default (`JITK_NESTED_VCPUS` overrides).
A four-vCPU R3 repeat hit an outer Linux hard lockup (historical owner evidence).
This is an unresolved nested-harness SMP issue, not a claim of metal stability.

The remaining nested suite runs 100 qjs boots, 30 real tool calls, n=100 at each
concurrency 1..8, density 1/32/64/128/256, 100 setup-only and bare-VM CPU controls,
30 repetitions per seccomp vector and per hostile guest. Unknown privileged sysreg access on KVM is terminated by the 3 s external watchdog; its SIGKILL is explicit in the report. Every number is
**NESTED, non-performance**, with both outer Mac uptime and inner Linux uptime.
06's canonical benchmark is macOS-oriented; this is the separate E7 functional
suite, with no claim to pass its quiet-host performance gate.

`spawn-cg.c` adapts 07's supervisor helper. Every VMM is born inside its own
cgroup via `clone3(CLONE_INTO_CGROUP)`; placement is checked in `/proc/PID/cgroup`
before RUN. **No `cgroup.procs` writes.** The wrapper reports VMM-only wait4
user/system CPU (excluding wrapper CPU). Readiness requires the exact host
stderr ack `{"sandbox":"ok"}` AND guest stdout `{"t":"ready","v":1}`.
Each I/O/reap has an external deadline; timeout kills the process group and
cgroup, then reaps owned children. Parent death kills the VMM. One port, one
vCPU, 32 MiB. Each parked guest must return the right result after density.

`seccomp-probe.c` is 07's standalone syscall probe, extended with exec/mmap/kill.
`build-probes.py` compiles filters from the **exact canonical sandbox BPF module**,
not a second allowlist. It validates main/vCPU/console roles and KVM_RUN allowance
with an invalid fd. It does not inject native host syscalls into the production
VMM. The canonical VMM itself is used for every boot/tool/density/fault test.

Results: `out/report.json` (raw samples, hashes, all gates), `out/nested.log`
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
before/after (the outer Linux contains only this suite's KVM guests); subtract
this from VMM user, then report VMM user, VMM system, guest, and their total.
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
