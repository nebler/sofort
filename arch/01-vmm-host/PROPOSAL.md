# 01 — jitk-vmm host proposal

## 1. Concrete design

**Use one exec'd, sandboxed worker process per single-use VM on both platforms.**
macOS/HVF cannot create two live VMs in one process; this libkrun also cannot
recycle a process after guest shutdown. A warm pool therefore contains *processes
with already booted guests*, not multiple VM objects in a service process.
All measurements below are from this machine, not the brief's earlier run.

### Components and interfaces

- Trusted executor/pool supervisor: Node **24.22.1** built-ins `child_process`,
  `perf_hooks`; no npm dependencies. It owns policy, credentials, timers and a
  bounded admission queue. It never executes guest JS itself.
- `jitk-vmm`: Rust **1.95.0**, edition 2024, native Rust `krun` library target from
  package `libkrun` **2.0.0-dev**, exact Git revision
  **a1d8616765da03980f3be1bb8714bfdd3842f33c**. `panic=abort` in the final binary.
  `Cargo.toml` proposes `default-features=false`, no optional features.
- The **measured build** links the supplied native `libkrun.rlib` directly with
  `rustc`; it does not rebuild a minimal-feature libkrun. This distinction matters:
  the supplied build contains more compiled device implementations, although only
  the explicitly supplied console is attached. A fresh minimal-feature Cargo build
  is **UNVERIFIED**. Source pins alone do not lock transitive dependencies; preserve
  an application Cargo.lock before shipping. `upstream-versions.json` records the
  supplied build's complete upstream lock inventory; `build-hashes.json` fingerprints
  the supplied rlib/dylib and source sketches.
- Relevant resolved library versions: `krun-hvf` **0.1.0-2.0.0-dev**,
  `libc` **0.2.186**, `vm-memory` **0.18.0**, `vmm-sys-util` **0.15.0**,
  `crossbeam-channel` **0.5.15**, `nix` **0.30.1**, `log` **0.4.29**,
  `env_logger` **0.11.9**, `libloading` **0.8.9**. See upstream lock inventory for
  other versions/duplicate packages. No bindgen or handwritten C FFI is necessary.
  The native builder is public Rust [S1]; the weak dynamic Rust binding also exists
  but its manifest uses older ffier tags than the native crate. Avoid that path.

### Creation and pinned devices

Worker calls `ConsoleDevice::builder().add_inout_port("jitk", stdin, stdout)`
once; asserts returned index **0**. It adds that single `ConsoleDevice` to a new,
empty `MmioDeviceManager`. Then `Payload::load_external(path, Raw, None, "")`,
`VmmBuilder::new().vcpus(1).ram_mib(64).payload(...).devices(...)`,
`nested_virt(false)`, `shutdown_support(false)`, `build()`, `run()`.
64 MiB is the tested configuration, **not a measured minimum for QuickJS**.

There is no fs root, NullFs, TSI, vsock, net, RNG, balloon, serial or GPIO attached.
Do **not** call `add_default_console`: in non-TTY mode it creates additional
redirect ports [S2]. One port still requires the libkrun console's **four queues**:
port RX/TX plus control RX/TX. Negotiate VERSION_1 and MULTIPORT and perform the
control handshake; the guest probe demonstrates this. One console *device* is
not synonymous with two queues in this implementation [S3].

The MMIO manager starts empty and attaches only its vector [S2]. However libkrun
unconditionally attaches **PL031 RTC and GIC** on macOS [S4]. Thus “exactly one
virtio device” is verified; “no other emulated peripheral” is false. GPIO is
optional and disabled. Keep RTC for the first prototype, or require a small
upstream/fork change before interpreting “only I/O” as excluding RTC too. The RTC
initializes from host realtime [S5]; it is not a credential/network channel.

Actual FDT: RTC **0x0a001000**, console **0x0a002000**, virtio DeviceID **3**.
Allocation stride is **0x1000**, not 0x200 [S6]. Guest must discover the console
from x0's FDT and check magic/version/DeviceID rather than hardcode this address.
The test scans 128 offsets at 0x200 spacing, a 64 KiB window; the complete FDT
and source attachment path supply the evidence beyond that bounded scan.

### Kernel and QuickJS delivery

Build one immutable, content-addressed RAW guest image containing the EL1 kernel,
static-musl QuickJS ELF bytes in kernel `.rodata`, and bootstrap bytes. The guest
ELF loader maps QuickJS into EL0; the VMM never starts QuickJS as a host program.
The trusted supervisor chooses an image from an allowlist; agent input cannot set
kernel paths, RAM, devices, environment or executable arguments.

Use `Payload::load_external(image_path, Raw, None, "")`; no initrd, cpio, guest
filesystem, TSI command-line environment, or late code bytes in the image.
Host image reads are not a guest fs device. The current RAW loader reads the file
into a Vec and writes it into guest memory [S7]: **embedding is not zero-copy**.
A bare probe successfully loaded a **9,696,272-byte** image containing the complete
**9,688,056-byte** QuickJS ELF and printed its size and `0x7f454c46` header from
inside the VM. It did **not execute QuickJS**; the full kernel/EL0 loader remains
another area's work. No embedding speedup is claimed.

### File descriptors and lifecycle

Supervisor `spawn`s with `env: {}` and three independent pipes:
parent `child.stdin` → child fd **0** → console port 0 input;
console output → child fd **1** → parent `child.stdout`;
child fd **2** → bounded host diagnostic drain, never tool protocol.
No TTY, shell, inherited credential descriptors, PTY, socket listener or host
files are intentionally passed. libkrun duplicates console FDs and sets them
nonblocking [S8]; keep the originals alive until process death. The executor
handles partial reads/writes and backpressure; a pipe chunk is not a JSON frame.

State machine: `boot → park → run → destroy → reaped`.

1. Sandbox/limits are established **before** `build()`: it starts vCPUs itself
   [S4], so sandboxing after build leaves an execution window.
2. Preboot guest initializes its console, ELF loads qjs and bootstrap, and sends
   a bounded, validated READY frame. Only then publish the worker to the pool.
3. Guest waits for exactly one RUN frame; park should block with correctly
   configured GIC/virtio interrupt + WFI. **UNVERIFIED here:** the probe's PARK
   mode uses polling, not an idle-efficient WFI implementation. Do not use its
   CPU/memory behavior as production density evidence.
4. Remove worker atomically from the ready queue, arm an execution deadline,
   send one bounded code frame. Tagged logs/tool calls/results share this port.
   The trusted dispatcher checks schema, byte/call budgets and policy on every
   call; it checks the monotonic deadline again before granting capabilities.
5. On a validated terminal result, revoke execution capabilities, resolve the
   logical result, SIGKILL the worker if still alive. On timeout, cancellation,
   malformed frames, EOF or pipe error: revoke and SIGKILL immediately. Never
   return a used VM to the pool. PSCI SYSTEM_OFF is permitted for orderly exits.
6. Reap asynchronously through child `close`; keep the capacity slot charged
   until reaped. Drain/discard bounded diagnostics. Late tool responses are
   discarded by execution ID/generation. Refill the ready queue subject to the
   same process/memory admission cap.

Boot deadline, idle TTL and execution deadline are distinct. Execution deadline
includes tool wait time and is controlled by the host, not guest timers. Node's
external timer and SIGKILL are demonstrated; scheduling latency means **no hard
real-time bound** is claimed. A manager that can run blocking tool handlers must
put its watchdog on a separate event loop/process. Production pool size, idle
TTL, memory reservation and boot-concurrency limits require workload measurements;
there is no evidence for a fixed large prewarm target on this 24 GiB host.

### Exit semantics and confinement

- Native launcher setup/config/event-loop-return failure: worker exit **70**.
- PSCI SYSTEM_OFF: process exit **0**, via libkrun `_exit`, not a return to main
  [S9]. This proves shutdown, **not JS success**. Require a valid result frame.
- JS success or exception: result frame carries typed outcome and guest exit
  value; never infer them from an OS exit status. Terminal result followed by
  SIGKILL is expected cleanup, not retroactively an execution failure.
- SIGKILL with supervisor reason `execution-deadline`: timeout; with `cancelled`:
  cancellation; with `protocol`: protocol failure. Raw signal alone is insufficient.
- Other signal/nonzero exit/missing terminal result: VMM/guest failure. Preserve
  raw `(exitCode, signal, supervisorReason)` for diagnostics. Do not reserve guest
  PSCl calls as a way to manufacture host process exit codes.

Linux deployment requires a dedicated UID, empty network namespace, read-only
image-only filesystem view, cgroup memory/CPU/pids limits, and a tested seccomp
policy for this device set; cgroup/process-supervisor cleanup must kill orphaned
workers. These are release gates, not protections supplied by this sketch.
macOS uses the hypervisor entitlement plus a deny-default Seatbelt profile before
exec; tested profile is `dev-sandbox.sb`. It allows system library reads, the
private test directory, file metadata and sysctl reads, and the AppleHVClient user
client. Production must replace the writable development subtree with immutable
image/binary paths and remove the sandbox-probe executable allowance. No network,
file writes or fork are permitted in the tested profile. Four denial probes pass,
but a full escape-resistance review is **UNVERIFIED**.

## 2. Code sketches and reproduction

Real, compiled files: `src/main.rs` (native Rust launcher), `supervisor.mjs`
(transport, state, deadline, asynchronous reap), `two-vms.c`, `hvf-two.c`,
`guest-probe.c` + `probe-start.S`/`probe.ld`, `embed-qjs.S`, `fault.S`,
`sandbox-probe.c`, entitlement and sandbox profiles. `host-baseline.c` is a copy
of the supplied host, unchanged. `Cargo.toml` records the intended source pin.
The transport sketch intentionally delegates hostile JSON/policy enforcement to
the executor and is not a standalone production sandbox.

Run from this directory; outputs go only into this directory or `/tmp/jitk-01`:

```sh
./build-spike.sh
python3 run-process-tests.py
/tmp/jitk-01/jitk-vmm /tmp/jitk-01/probe.bin > device-dump.txt
/tmp/jitk-01/jitk-vmm /tmp/jitk-01/embed-probe.bin > embedded-device-dump.txt
python3 bench.py
node lifecycle-test.mjs
python3 run-sandbox-tests.py
python3 run-fault-tests.py
```

Build script reuses supplied Rust dependencies, links C tests against a private
copy of the dylib, fixes its non-rpath install name in our binaries, and signs
only our executables. No system installs, toolchain changes or writes to the
source spike. The Cargo application build itself has not been exercised.

## 3. BLOCKERS — experiments and outcomes

**(a) Process architecture — ELIMINATED as a decision.**
`python3 run-process-tests.py`; raw commands recorded in that script.
`two-vms concurrent kk_hang.bin`: first build succeeds, second fails
`Internal(Vm(VmSetup(VmCreate)))`, harness rc **72**.
`two-vms drop kk_hang.bin`: destroy first handle, second still fails, rc **73**.
`two-vms sequential kk.bin`: rc **0**, no `FIRST_RETURNED` marker, no second build.
`hvf-two`: create1 **0**, create2 **0xfae94002**, destroy **0**, create3 **0**.
Evidence: `process-results.json`; library stop path [S9]. Framework sequential
reuse is possible, but this libkrun lifecycle does not provide it.
`node lifecycle-test.mjs`: **16/16 separate workers actually emitted guest
readiness**, stayed live together, then **16/16** reaped; batch kill-to-last-reap
**3.660 ms**. This verifies concurrency, not sustained fleet capacity.

**(b) Device pinning — ELIMINATED for the requested virtio/I/O transports.**
`jitk-vmm /tmp/jitk-01/probe.bin`: rc **0**, guest FDT size **1364 bytes**, one
virtio-mmio node, one scanned magic, DeviceID **3**, one configured port. No fs,
net or vsock node. `device-dump.txt`, attachment vector [S2], console [S3].
Bare guest output itself traverses the one console. `lifecycle-test.mjs` additionally
verifies one byte host→guest→shutdown on that same port (rc **0**).
**Remaining literal “all implicit devices” blocker:** RTC has no builder toggle;
source [S4] and boot agree. Do not claim it is disabled. If RTC is prohibited,
change libkrun and repeat the dump; an unbuilt patch would not resolve this.

**(c) Rust API and latency — ELIMINATED.**
`./build-spike.sh` compiles native Rust; `python3 bench.py` runs the supplied
`kk.bin` (24 bytes), five warmups/configuration, **n=30/configuration**,
interleaved randomized order, `perf_counter_ns` around fresh process spawn,
pipe communication, VM boot, shutdown and reap. p90 is the 27th sorted sample.

| launcher/device ports | median ms | p90 ms |
|---|---:|---:|
| unchanged C host / default ports | 6.809 | 7.833 |
| native Rust / same default ports | 6.731 | 7.817 |
| native Rust / one inout port | 6.614 | 10.092 |

All 90 executions exited **0**. `latency-results.json` retains every sample.
Native Rust vs C is essentially tied in this run; no FFI overhead is necessary.
This is warm-file-cache *fresh-process* latency, not cold-cache or QuickJS latency.
The shared host was heavily loaded: later uptime **21.41/25.00/14.83**, 12 logical
CPUs. An earlier retained run at load **45.25** produced medians 14.17/14.93/13.85
ms (`latency-loaded-unwind-results.json`). Neither reproduces the brief's 3.3 ms;
load/cache/signature/build differences are confounders, not proven causal estimates.

**(d) Kill/reap/hostile hypercall — substantially ELIMINATED.**
`node lifecycle-test.mjs`: 30 hung real VMs with **30 ms** host boot deadline;
launch-return-to-close median **31.540 ms**, p90 **31.916 ms**, all SIGKILL and
correct reason; raw samples in `lifecycle-results.json`. Spawn-call time itself
is outside that timer measurement. No OS-guaranteed maximum kill latency claimed.
An invalid `hvc` value **0x12345678** panics the supplied unwind vCPU thread [S10]
and leaves its process alive until killed after **200 ms**. Setting final binary
`panic=abort` produced **10/10 SIGABRT**, median **9.067 ms**, p90 **14.733 ms**
(`fault-results.json`). One first post-relink abort-build launch was itself killed
at 200 ms without stderr; cause **UNVERIFIED**. External watchdog remains mandatory.

**(e) Seatbelt/HVF coexistence — compatibility ELIMINATED; hardening remains.**
`python3 run-sandbox-tests.py`: deny-default sandboxed guest boots, dumps devices,
exits **0**; marker-content read, new temp write, outbound TCP connect, fork each
fail with **EPERM (1)**; probe rc **0**. Creating a socket alone is allowed, so the
network test exercises `connect`, not just `socket`. Early profile failed exec
and then startup: a sandbox log showed denied read of `/`; adding only a root
literal read fixed it. `sandbox-results.json` retains final evidence.

**(f) Production KVM, full-qjs density, efficient parking — REMAINING.**
`docker run --rm --network none --pull=never --entrypoint /bin/sh alpine:3.22 -c
'uname -m; if test -c /dev/kvm; then echo KVM_PRESENT; else echo KVM_ABSENT; fi'`:
**aarch64, KVM_ABSENT** (`linux-kvm-check.txt`). This container cannot run the
production KVM experiment. Linux confinement and performance remain **UNVERIFIED**.
The embedded payload probe boots successfully but does not execute qjs; the
PARK probe intentionally polls. Therefore initialized-qjs RSS/threads, WFI wakeup
correctness, idle CPU cost, pool sizing and end-to-end throughput remain
**UNVERIFIED**, requiring the actual guest kernel integration.

## 4. What I'd cut

Cut dynamic Rust bindings, bindgen, C compatibility layer, default console ports,
PTYs, legacy context API, libkrunfw, guest rootfs/initrd, all optional devices,
snapshots, reuse/reset, shared-memory transport and host-side pause/resume from v0.
Keep one RAW image, one native Rust builder path, one framed console, one worker
process/job and a small measured prewarm target. Cut RTC only if the strict
peripheral policy requires a libkrun change; do not silently enlarge the fork.

## 5. Open disagreements with the brief's consensus

1. **“HVF likely one VM/process” is now proved for simultaneous VMs**, and libkrun
   prevents sequential reuse even though raw HVF permits it. This is not merely
   a macOS pool heuristic: libkrun `_exit` also dictates the process model on Linux.
2. **The suggested MMIO stride/address is wrong for this source.** Observed console
   is 0x0a002000; allocation is 4 KiB and RTC precedes console [S4,S6]. Parse FDT.
3. **One console is not “no implicit devices.”** PL031 RTC remains; no public
   builder switch disables it. And one port still needs four queues [S3].
4. **Embedding removes initrd machinery, not payload-copy cost.** RAW loader still
   allocates/reads/writes the image [S7]. The brief's 2.6 ms initrd delta is not a
   measured saving for an equally large embedded image; this work claims none.
5. **A guest panic need not terminate its VMM.** Unwind behavior hung in the tested
   invalid-PSCI case. Use final-binary panic=abort plus external kill; ordinary VM
   process exit 0 is not proof that an agent execution produced a valid result.
6. **Sandbox/HVF compatibility is no longer wholly unverified on this macOS build**:
   a deny-default profile works with specific tested denials. This is narrower
   evidence than a reviewed confinement policy; Linux protection is still a gate.

## 6. Estimated LOC

Current launcher **30 physical lines**, supervisor **64**, bare probe **85**;
these are deliberately incomplete production components. Budget **~100–150** Rust
lines for fixed configuration, manifest validation and diagnostics; **~180–250**
JS/TS lines for pool, admission, deadlines and asynchronous reap; **~100–200** for
platform confinement/limit setup plus **~20–40** policy lines. Total host area
**~400–650 production LOC**, excluding libkrun, hostile dispatcher, protocol
schema and guest kernel. Estimate, **UNVERIFIED** until integration; the ~1.4 MiB
native test executable is not a measurement of guest RAM or VMM resident memory.

### Source evidence (all libkrun links pinned to the tested revision)

- [S1 native API exports](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/libkrun/src/api/mod.rs#L76), `api/vmm_builder.rs:25,144,269`.
- [S2 explicit vector and console builder](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/libkrun/src/api/device_builders.rs#L349), `:398–420,810–843,858–950`.
- [S3 console queues/control](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/devices/src/virtio/console/port_queue_mapping.rs#L42), `console/device.rs:28–34,199–280,337`.
- [S4 implicit devices](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/libkrun/src/vmm/builder.rs#L2351), `:2369–2384`; vCPU start `:1491`; builder shutdown flag `api/vmm_builder.rs:134–141`.
- [S5 RTC clock](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/devices/src/legacy/rtc_pl031.rs#L71), `:75–76,89–92`.
- [S6 HVF MMIO allocation](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/libkrun/src/vmm/device_manager/hvf/mmio.rs#L66), `:79–85,107–119`.
- [S7 RAW loader](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/libkrun/src/vmm/builder.rs#L1506), `:1521–1528`; payload API `api/payload.rs:103–146`.
- [S8 FD duplication/nonblocking](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/devices/src/virtio/console/port_io/unix.rs#L23), `:54–57,164–173`.
- [S9 process exit](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/libkrun/src/vmm/mod.rs#L415), `:428`; run loop `api/vmm_builder.rs:269–280`.
- [S10 HVF creation/PSCI](https://github.com/libkrun/libkrun/blob/a1d8616765da03980f3be1bb8714bfdd3842f33c/src/hvf/src/lib.rs#L303), `:631–652`; local Apple sandbox rule `/System/Library/Sandbox/Profiles/application.sb:794–795`.
