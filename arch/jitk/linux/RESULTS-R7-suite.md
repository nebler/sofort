# R7 suite: replace the stalled second-QEMU path

> Raw evidence linked here moved out of git (R10 W0.1): restore it with `arch/jitk/tools/.work/bin/evidence fetch <path>`; see [evidence/README.md](../../../evidence/README.md).

Agent: `r7-suite`. Worktree: `/Users/noah/.t3/worktrees/sofort/t3-c7592349`.
Branch: `t3/diagnose-nested-test-stall`. Date: 2026-10-25.

## Result

**PASS:** the direct `python3 arch/jitk/docs/delegate.py linux test` completes
in **240.18 s** command wall time. The full aggregate `make ... test` passes in
**672.98 s**, including **348.744 s** waiting for another agent's benchmark lock.
Its nested suite takes **244.422 s after lock acquisition**; the direct repeat
takes **231.084 s**. Both post-probe-fix runs pass all **17 gates** with zero
owned children remaining. An earlier pilot also passed in **343.65 s**.
Work item 7 / exit criterion 9 is covered by this documented equivalent.

All Linux measurements here are **NESTED, functional, non-performance**.
Mac: M4 Pro, macOS 26.6.1 (25G76), QEMU 11.1.2; Mac timing commands use
`/usr/bin/lockf -k /tmp/sofort-bench.lock` and record uptime/load.
Existing kvm-dev: Ubuntu 26.04, Linux 7.0.0-38-generic, 6 vCPU / 9 GiB;
timed suites use `/home/dev/bench.lock`. The VM was never stopped, restarted,
reconfigured or given a different kernel. Other agents' RNG, memory-ledger
and mutation jobs shared it; their benchmark-lock contention is recorded,
not bypassed. Source code outside `arch/jitk/linux/` was not edited.

## Cause: a hypervisor assertion spin, not slow tests

The original serial log hides individual boot completions. Instrumenting a
private initramfs shows boot iterations completing in milliseconds, followed
by a permanent loss of progress inside the **additional QEMU/HVF instance**.
The outer guest heartbeat and Python faulthandler also stop with one vCPU.
Two macOS `sample` captures, 14 s apart, put every sampled CPU 0/HVF stack in:

```text
Hv::Vcpu::run
  Hv::Vcpu::handle_exception_exit
    HvCore::Hypervisor::VcpuStateManager::handle_exception_exit
      HvCore::Hypervisor::VcpuStateManager::set_pstate
        Base::assertion_trap
```

QEMU consumes a core in that trap; HMP `info registers` cannot synchronize the
vCPU. It does not recover by waiting. The observed test failure is the outer
hypervisor's assertion loop, rather than Python waiting for 100 slow boots.

| Experiment (one attempt each) | Result |
|---|---|
| Original suite, private Debian 6.12 QEMU, 1 vCPU | Parking/smokes pass; boot iteration 56 stalls |
| Minimal sequential ready/run/close loop, same artifacts and Debian, 1 vCPU | Iterations 0–58 finish; iteration 59 stalls |
| Same minimal loop; only outer kernel changed to Ubuntu 7.0 | Same iteration-59 stall and sampled assertion |
| Same minimal loop, Debian, 2 outer vCPUs | Same iteration-59 stall; the other CPU still emits heartbeats |
| Identical VMM/kernel/helper and minimal loop over SSH into existing kvm-dev | All 200 iterations complete |

The minimal loop has no thread pool, density test, parking sequence or concurrent
VMMs. It is retained as [out/r7/reproduce.py](out/r7/reproduce.py); import the
original `suite.py`, set `JITK_BIN` to the hashed artifacts, and run it as root.
Artifact SHA-256 values: [diagnostic-inputs.json](out/r7/diagnostic-inputs.json).
Raw serial logs and macOS thread samples: `out/r7/{baseline,minimal-*}*`.
[diagnosis.md](out/r7/diagnosis.md) records the investigation checkpoint.

**Causal limit:** kvm-dev stayed running in every experiment, as required.
This establishes an unusable second-QEMU path in the current configuration;
it does **not** prove that coexistence with kvm-dev causes the Apple assertion.
The specific internal invalid-state predicate in Apple's Hypervisor framework
is not identified. No claim is made that a different outer kernel, more CPUs,
or an increased timeout fixes it.

## Implementation

* Mac `linux test`/`linux nested` now build the same canonical artifacts and run
  the same `suite.py` in the existing VM over SSH. The default wrapper comes
  from the main Git checkout, including when called in a worktree;
  `JITK_NESTED_SSH` is an explicit alternative. A unique run directory under
  `/home/dev/r7-suite/` holds only this suite's files. Successful runs remove it.
* Both the Mac and remote VM independently watch actual completed-work counters.
  Default bounds are 90 s startup, 60 s without gate progress, 300 s absolute
  per gate, and 900 s total suite time. SSH has a separately reported, bounded
  600 s benchmark-lock queue allowance. Heartbeats/duplicate counters cannot
  extend a gate. Limits and gate events are retained in `run-timing.json`.
* Each gate records wall time. Batch failure cancels queued jobs instead of
  running the rest of a failing batch. A failed run removes prior PASS reports
  and its `.READY` marker. Certification now requires 100 completions at every
  concurrency, all five density points, both 100-sample CPU controls, all 720
  seccomp vectors and all 180 hostile runs.
* The direct backend remains available with `JITK_NESTED_BACKEND=qemu`.
  Injecting a 15 s progress limit into the real stall fails in **36.08 s** command
  wall time, including initramfs packing/boot and a 5 s SIGTERM→SIGKILL escalation:
  `gate boot: no completed-work progress for 15s (last completed=50)`.
  Raw: [qemu-deadline-command.log](out/r7/qemu-deadline-command.log) and
  [qemu-deadline/](out/r7/qemu-deadline/). Only the test-created QEMU was killed.
* The seccomp probe disables dumpability before installing the unchanged BPF.
  On Ubuntu, core size zero still invokes the piped Apport crash handler for
  expected SIGSYS deaths; the initial full run spent **97.134 s** in that gate.
  The fix preserves expected exit/signal results while avoiding hundreds of
  crash-reporter launches. All 24 role/action vectors pass a direct check with
  no matching crash files: [non-dumpable-probe-check.json](out/r7/non-dumpable-probe-check.json).
* Shared-VM global guest ticks can include foreign KVM work. Reports explicitly
  mark guest/host-user decomposition UNVERIFIED; VMM-specific wait4 user/system
  totals and per-VMM cgroup memory remain measured. No metal performance claim
  follows from these functional runs.

## Coverage before and after

No gate, vector, sample, assertion or hostile fixture was removed.

| Gate/check | Before | After |
|---|---|---|
| KVM preflight | API version 12 and create VM | Same |
| Normal VM admission | Exact stderr sandbox ack AND guest READY; cgroup checked before RUN; clone3 at birth | Same |
| Per-VM containment/cleanup | 128 MiB cgroup cap; no swap; I/O/reap deadlines; process-group/cgroup kill; parent-death kill | Same |
| Parking | Same current image; 10 s idle; process and cgroup CPU <2%; wait-state capture; 1,000 exact exchanges; every 100th reply delayed 3 ms; done/exit validated | Same |
| Smoke / tool smoke | 1 / 1; exact results and tool call/reply | Same |
| Boot / one tool | 100 / 30 fresh VMMs; sandbox/READY/result/exit checks | Same |
| Concurrency | c=1,2,3,4,5,6,7,8; n=100 each | Same; marker minimum raised 30→100 |
| Density | 1,32,64,128,256; 3 s idle per point; <2% CPU/core/VM; process PSS and cgroup memory; all 256 results after park | Same |
| CPU controls | 100 setup-only, exit 70; 100 bare VM, exit 0; VMM wait4 usage required | Same |
| Seccomp | main/vCPU/console × exit,openat,socket,execve,KVM_CREATE_VM,KVM_RUN,mmap-exec,kill × 30 = 720 | Same BPF, same outcomes; probe is non-dumpable |
| Hostile guests | unknown-hvc, unknown-smc, mmio-halfword, bad-sysreg, console_avail_oob, rtc_oob_read × 30 = 180 | Same; 3 s external kills explicitly reported |
| Final certification | PASS; zero live owned children; artifact hashes; load; minimum counts | Same plus stricter full-profile checks, source hashes and gate deadlines |

The two backends differ in outer Linux environment and CPU accounting context,
not test coverage. The old initramfs provided isolation from foreign KVM CPU
accounting but could not finish. The replacement labels that attribution limit.

## Timings and raw data

Two complete post-probe-fix runs, **n=1 per column**, wall seconds measured
with monotonic clocks around each gate. Command time uses `/usr/bin/time -p`;
observer/queue times use `nested/watch.py` events. These are nested functional
completion times under the recorded load, not benchmark performance claims.

| Measurement | Aggregate run | Direct delegate repeat |
|---|---:|---:|
| Entire command (aggregate includes the ten preceding Mac subtrees) | 672.980 | 240.180 |
| Linux observer including shared-lock queue | 593.166 | 231.264 |
| Queue to first remote-monitor event | 348.744 | 0.180 |
| Nested execution after that event | 244.422 | 231.084 |

| Gate | Aggregate wall s | Direct wall s |
|---|---:|---:|
| parking | 10.888 | 10.923 |
| smoke | 0.151 | 0.162 |
| tool_smoke | 0.128 | 0.126 |
| boot | 12.629 | 11.754 |
| one_tool | 4.774 | 3.711 |
| concurrency_1 | 14.004 | 11.557 |
| concurrency_2 | 8.194 | 8.002 |
| concurrency_3 | 7.109 | 7.163 |
| concurrency_4 | 7.180 | 7.268 |
| concurrency_5 | 6.532 | 7.033 |
| concurrency_6 | 6.707 | 7.218 |
| concurrency_7 | 7.413 | 7.334 |
| concurrency_8 | 8.809 | 8.393 |
| density | 53.474 | 45.925 |
| cpu_controls | 1.633 | 0.744 |
| seccomp_kill | 1.553 | 0.951 |
| fault_guests | 93.047 | 92.603 |

The aggregate uses implementation `1714909`; the direct repeat includes
`bb668af`'s additional forced-timeout cleanup. The analyzer verifies identical
`suite.py`, VMM, kernel, cgroup helper, BPF and six hostile-guest artifacts across
both runs. The probe ELF hashes differ because their debug source paths differ
between build roots; **all allocated ELF sections match byte-for-byte**, including
text/data. Raw comparison: [probe-binary-comparison.json](out/r7/probe-binary-comparison.json).
The only other staged difference is the watchdog cleanup fallback.

Mac load1 ranges during the two observers are **8.320–21.571** and
**8.063–12.713**. Inner load1 at start/end is **0.48 / 1.27** and **0.91 / 1.23**.
Every gate retains inner uptime/load; the observer records outer load each second.
Long shared-lock waits and the other agent's canary/ledger/mutation work are
preserved in `shared-lock-*.txt` and `aggregate-load-during-lock.txt`.

Raw final reports, samples, serial logs, limits/events and markers:
[final-1/](out/r7/final-1/), [final-2/](out/r7/final-2/).
[aggregate-command.log](out/r7/aggregate-command.log),
[final-2-command.log](out/r7/final-2-command.log),
[summary.json](out/r7/summary.json), [completion.json](out/r7/completion.json).
Recompute and validate all counts/identities with
`python3 arch/jitk/linux/out/r7/analyze.py`.
Initial pilot raw data: [pilot/](out/r7/pilot/) and
[full-1-command.log](out/r7/full-1-command.log).
All individual committed logs/reports are below 1 MiB.

Five watchdog failure-injection scenarios pass: silent startup, repeated
heartbeats/duplicate progress, progressing work past an absolute gate deadline,
a total deadline across gate transitions, and success/nonzero exit propagation.
Recorded test run: **5/5 in 2.825 s**, [watch-tests.log](out/r7/watch-tests.log).
An additional real-Linux injection ignores SIGTERM and leaves a helper in a
separate session. The external watchdog escalates to SIGKILL and empties the
owned cgroup in **5.705 s**, leaving zero processes/cgroups:
[watch-cleanup-result.json](out/r7/watch-cleanup-result.json). Its child fixture
is [watch-cleanup-child.py](out/r7/watch-cleanup-child.py).
A final diagnostic-only change was separately checked by injecting a **0.2 s**
parking progress limit through the real SSH runner: the caller receives the
gate name, limit, local log path and exit **124**, with no remaining task processes
or scratch. Raw: [ssh-timeout-command.log](out/r7/ssh-timeout-command.log),
[ssh-timeout/cleanup.json](out/r7/ssh-timeout/cleanup.json).

The first post-fix attempt encountered another agent's benchmark lock and failed
before any test gate after **65.39 s** command time with the original 60 s lock
limit. This motivated the distinct queue allowance and explicit lock-busy
message. Raw: `out/r7/lock-busy-*`, `shared-lock-*.txt`, `shared-work-progress.txt`.

## Reproduce

```sh
cd /Users/noah/.t3/worktrees/sofort/t3-c7592349
# Reuse only a canonical build with matching adjacent build.json and patch hashes.
/usr/bin/lockf -k /tmp/sofort-bench.lock env \
  JITK_CANONICAL_VMM=/Users/noah/code/sofort/arch/jitk/linux/.work/jitk-vmm \
  /usr/bin/time -p python3 arch/jitk/docs/delegate.py linux test
python3 arch/jitk/linux/nested/test-watch.py

# Explicit legacy backend / real-stall watchdog regression (expected failure).
/usr/bin/lockf -k /tmp/sofort-bench.lock env \
  JITK_NESTED_BACKEND=qemu JITK_GATE_TIMEOUT_S=15 \
  JITK_GATE_DEADLINE_S=60 JITK_NESTED_TIMEOUT=90 \
  /usr/bin/time -p bash arch/jitk/linux/nested.sh
```

Without `JITK_CANONICAL_VMM`, the documented Docker build remains the cold-build
path. No new libkrun clone or global toolchain installation was needed here.
The aggregate environment is recorded in [aggregate-env.sh](out/r7/aggregate-env.sh).
It runs `make -C "$TASK_SUITE_COPY" test` in a private copy of the kit at
`1714909`, with existing verified dependency directories copied into that scratch area.
[aggregate-source-identity.json](out/r7/aggregate-source-identity.json) verifies
3,594 input files byte-for-byte; generated test artifacts/receipts are excluded.
That keeps all generated tests in this task's scope while exercising the same
source. The standalone adapter's documented 13-check SKIP when HYPERLIGHT_JS_SRC
is unset is retained explicitly; the executor's six Hyperlight integration
checks use the existing worker/snapshot and pass.

## Scope, limits, cleanup and commits

No changes to `docs/delegate.py`, the top-level Makefile, kernel, shard or grow
sources. No default kernel image was replaced; the Linux kit builds only its
private work copy. The tested nested image remains SHA-256
`6c00a278cff95058241967655810dcf0cc9cfa1158a38630d818f26c3b07cbc6`.
The canonical VMM remains
`f0483380bd55f75e5d57fda379d1e447501f3ae55fcda580c711a968dbeb204d`.
Mac scratch is currently about 1.0 GiB (`du -sh linux/.work`, an upper accounting
of cloned files), below the 3 GiB limit. The largest observed task-owned remote
scratch was **18 MiB** (`du -sh`,
rounded); no remote source builds/downloads were done. After successful runs
removed their own directories, the remaining **11,737,191 bytes** of diagnostic
scratch were deleted. Final remote task scratch, live task processes and owned
cgroups are all **zero**: [cleanup.json](out/r7/cleanup.json). The same original
kvm-dev PID remains running: [kvm-dev-still-running.txt](out/r7/kvm-dev-still-running.txt).
The pilot caused a small OS-managed Apport crash receipt outside the private
directory; it is recorded in `apport-observation.txt` and was left untouched.
The non-dumpable probe prevents further receipts. Mac ignored build scratch is
retained below budget for reproduction; no other agent cache was removed.

Commits:

* `0b58ceb` — isolate nested suite stall to an HVF assertion spin; raw diagnosis.
* `1714909` — existing-VM backend, progress watchdogs, full-profile certification,
  non-dumpable probes, documentation and watchdog/probe checks.
* `bb668af` — externally clean detached helpers after forced supervisor timeout;
  real Linux forced-kill/cgroup cleanup proof.
* `c45497d` — two full post-probe-fix runs, aggregate Mac PASS, raw timings and
  coverage/artifact validation.
* `5ddf506` — surface remote timeout reason and local log path to the caller;
  real SSH parking-timeout failure and cleanup proof.

Not done: Apple's internal assertion predicate or an upstream HVF fix; a test
with kvm-dev stopped; metal timing; exact shared-VM guest/host-user attribution;
a new cold network/toolchain download certification.

## Findings → recommended changes

1. **Use the existing-VM SSH backend for Mac integration.** It exercises the same
   canonical suite and artifacts without the demonstrated second-QEMU failure.
2. **Keep completed-work watchdogs and strict profile certification.** A spinning
   hypervisor or stuck gate must produce an attributable failure within the
   documented progress limit and cleanup margin, rather than consuming the entire old 1,800 s budget.
3. **Track the HVF assertion separately.** Attach the minimal reproducer and
   sampled stacks; do not present coexistence with kvm-dev as established cause.
4. **Keep crash reporters out of expected hostile-probe outcomes.** Non-dumpable
   probes preserve SIGSYS coverage without global crash-handler side effects.
5. **Treat shared nested timings as functional diagnostics.** Keep background
   load/lock time visible and use metal for latency/CPU claims.
