# No-hypervisor Linux backend for the jitk ABI

Research date: 2026-10-25. Researcher: `usermode`.

Labels: **F** = source-verified fact; **M** = measured prototype; **I** = inference/design judgment; **E** = engineering or performance estimate. Numbers are local experiments, not vendor benchmarks. A prototype running QuickJS is not certification of the entire jitk contract.

## Decision

**I:** A no-hypervisor backend is feasible and useful. Execute the existing static ELF natively, keep authority in an external broker, expose only the tool stream, and use seccomp plus OS confinement. The practical first backend is a **hybrid**: tightly constrained host memory/lifecycle operations, ordinary pipe/socket I/O to the trusted protocol endpoint, and user notification for virtual archive/time/ABI semantics that differ from Linux. A plain 24-number allowlist is a fast compatibility profile, not the existing jitk contract. An in-process SIGSYS handler alone is not an isolation boundary.

**M:** The byte-identical repository QuickJS ran `return 2` through both allowlist and hybrid-notification launchers. A stopped, initialized QuickJS was cloned with CoW using injected `clone(SIGCHLD, NULL, ...)`; 50 children independently produced `{"t":"done","ok":2}` in a sequential shared-channel experiment. Unmodified archive code plus 12 Rust syscall modules compiled and passed functional assertions in userspace.

**I:** This trades the hypervisor boundary for the host Linux kernel's filtered process surface. That is a different security tier from KVM. If resistance to host kernel exploitation is a requirement, existing gVisor systrap is the stronger no-KVM starting point than inventing a small in-process emulator. gVisor's own security documentation describes reducing exposure to the host System API; it also documents limits around the System ABI and side channels. [gVisor security model](https://gvisor.dev/docs/architecture_guide/security/)

## 1. Environment, artifacts, and scope

**M:** The actual shared test VM was **Ubuntu 26.04.1 LTS, Linux 7.0.0-38-generic, aarch64, 6 online vCPUs, about 8.7 GiB RAM, GCC 15.2**. This differs from the Debian/4-vCPU description in the brief. It is QEMU/HVF on Apple Silicon. No experiment in this report opened `/dev/kvm`: the measurements are Linux processes under HVF, not HVF→KVM nested guest measurements. They still include VM scheduling, Apple host effects, and concurrent researchers. `/proc/loadavg` varied materially during runs. No other agent's process, settings, or files were changed.

**M:** Payload copied within the VM from `~/jitk/kernel/payload/qjs`, checked against the Mac repository:

```text
ELF64 aarch64, statically linked, stripped
SHA-256 ea2367e9dfc7484b6ad6d551b0bbc25d0247e2781f49ad822fa04c2753f80341
```

All prototypes, source, logs, and JSON results are in **`/home/dev/portability/usermode/`** on the VM; staging copies are in **`/tmp/portability-usermode/`** on the Mac. Important artifacts:

- `bench.c`, `bench-new`: raw-syscall microbenchmarks and two QuickJS launchers.
- `run.py`, `micro.json`, `qjs.json`, `tools.json`, `memory.json`, `throughput.json`: repeated measurements.
- `extra.py`, `spawn.json`, `compute.json`, `micro-cpu.json`: extra spawn/compute/accounted-CPU repeats.
- `zygote.py`, `zygote.json`, `zygote-memory.py`, `zygote-memory.json`: actual static QuickJS fork/copy experiments.
- `qjs-native.strace`: native payload startup trace.
- `reuse/`: unchanged Rust source copies and a host-memory adapter harness.

**M, limitations:** The microbench filters intercept `getpid`, returning constant 123, so they measure transport without memory copies or real jitk handler work. `getpid` is deliberately a test syscall, not an added jitk slot. Their other syscalls remain allowed for benchmark machinery. The QuickJS launchers use the actual 24 slot numbers, return ENOSYS for other numbers, and permit one supervisor-authorized initial `execve`. They contain a bootstrap-only `sendmsg` exemption for handing off the notification fd. They do **not** implement namespaces, FD argument restrictions, the complete archive ABI, exact memory layout, or final confinement. The negative test `std.loadFile('/etc/passwd') !== null` returned `true` under the prototype allowlist, without printing file contents: permitting `openat` by number is demonstrably insufficient isolation.

An early benchmark launch used a stale executable after a compile failure. Those data were moved to `discarded-old-micro.*`; only the subsequently compiled, successful runs are used here. An initial Python 3.14 throughput driver needed explicit multiprocessing `fork` context; its failed run is not used.

## 2. What “same jitk ABI” actually requires

**F, repository:** [slots.json](../../jitk/kernel/slots.json) has 24 **numbers**, with `exit` sharing a handler at 93/94: `getcwd`, `fcntl`, `ioctl`, `openat`, `close`, `getdents64`, `lseek`, `read`, `write`, `readv`, `writev`, `ppoll`, `readlinkat`, `newfstatat`, both exits, `set_tid_address`, `clock_gettime`, `rt_sigaction`, `rt_sigprocmask`, `brk`, `munmap`, `mremap`, `mmap`. [syscalls.manifest.json](../../jitk/kernel/syscalls.manifest.json) explicitly describes restricted profiles and does not claim full Linux ABI equivalence.

**F, repository:** Relevant differences from Linux are substantive:

- `rt_sigaction`, `rt_sigprocmask`, and `mremap` return ENOSYS; `set_tid_address` returns 1.
- Files live in the read-only packed archive, virtual FDs 3–63; closing 0–2 is a no-op. Directory ordering, `stat` layout/metadata, error precedence, and `fcntl` operations are specified by the handlers.
- `mmap` accepts a narrow anonymous RW profile, no nonzero requested address or MAP_FIXED, in a fixed guest arena. `brk` has a fixed region and page bookkeeping. These are not unrestricted host Linux allocation calls.
- stdout has byte validation and size bounds; the TS dispatcher remains authoritative for JSON messages and tool authorization. stderr has special logging behavior. `ppoll` has bounded arrays and restricted signals.

Sources: [handlers](../../jitk/kernel/src/syscalls/), [fs.rs](../../jitk/kernel/src/fs.rs), [user.rs](../../jitk/kernel/src/user.rs), [canonical bootstrap](../../jitk/protocol/bootstrap.js), [build.rs](../../jitk/kernel/build.rs).

**M:** Linux startup of the same musl-linked qjs first does `set_tid_address`, `brk`, and **`mmap(nonzero, 4096, PROT_NONE, MAP_PRIVATE|MAP_FIXED|MAP_ANONYMOUS, ...)`**, then anonymous allocations. jitk rejects that guard mapping, and musl follows a working fallback. Native Linux handles it successfully instead. Thus byte-identical ELF compatibility does not establish equal syscall results or address layouts.

**I:** Define two explicit backend contracts: (a) native Linux compatibility under restrictive policy, or (b) exact current jitk profile including errors, virtual FDs, time, memory layout, and pointer validation. Calling (a) a drop-in implementation of (b) would hide the central engineering work. Native execution also requires an ISA-compatible host: the current aarch64 ELF does not run natively on an x86 $5 VPS. Build an equivalent x86-64 static payload for that tier; preserving the exact ARM binary there needs emulation, outside this backend.

## 3. Measurements

### Per-syscall transport

**M:** Seven repetitions, randomized mode order, supervisor and guest pinned to logical CPU 2. Direct arm64 `svc #0` prevents libc/vDSO caching. Native/allow/ERRNO: 500,000 calls per repetition; local TRAP: 100,000; other modes: 1,000. Clock timing is in the child around the loop, excluding initial filter installation/process launch. Each emulated-success mode checks the returned sum. Values below are **total wall time per attempted call**, not all incremental seccomp cost. Parent/guest memory transfer and semantic handlers are absent except the benchmark result transfer.

| Mechanism | µs/call: median (minimum–maximum of repetitions) |
|---|---:|
| Native raw syscall | 1.191 (0.457–1.843) |
| Seccomp ALLOW | 1.689 (1.113–2.173) |
| Seccomp ERRNO / ENOSYS | 1.594 (1.149–2.440) |
| TRAP, local SIGSYS handler | 9.470 (5.326–14.915) |
| TRAP + external socket supervisor | 136.140 (17.763–252.510) |
| USER_NOTIF + external supervisor | 64.382 (15.549–226.560) |
| PTRACE_SYSEMU, actual arm64 implementation | 232.876 (23.203–417.053) |
| PTRACE_SYSCALL, two-stop fallback | 183.910 (40.766–356.977) |

**M/I:** The difference between separate native/ALLOW medians is about 0.50 µs here; it is not a stable intrinsic filter tax. Initial short smoke runs saw raw calls around 0.15–0.22 µs, while the repeated run above was substantially slower. A separate five-repetition phase (`micro-cpu.json`) again showed large swings: USER_NOTIF wall medians fell to 16.52 µs and SYSEMU to 119.00 µs. Those repetitions also recorded Linux-accounted CPU for the entire supervisor+child lifecycle, including setup/exit; they must not be confused with the timed child-loop interval or bare-metal CPU cycles. Scheduling noise is sufficient to reverse the apparent SYSEMU/two-stop ordering. The reliable conclusion is qualitative: native allowance avoids transport; a local signal is cheaper than a round trip in this harness; external stop/wakeup traffic is consequential. A quiet target-host rerun is required before choosing transport solely on a latency difference.

### Actual static QuickJS startup and channel latency

**M:** The C launcher benchmark executes the same static qjs with `-e '(function(){return 2})()'`, then waits for exit; 5 repetitions of 100 launches each, pinned to CPU 2. This simple expression checks engine startup, without bootstrap/JSON overhead.

| Launch method | ms/job: median (min–max of batch means) |
|---|---:|
| fork + exec + wait | 4.173 (2.518–7.903) |
| posix_spawn + wait | 4.043 (1.868–5.760) |

**I:** posix_spawn did not establish a meaningful universal advantage here; its ranges overlap fork+exec. Neither method reuses an initialized QuickJS heap. The zygote results below test that separate optimization.

**M:** Fifteen repetitions per mode for the complete canonical bootstrap (`qjs --std --memory-limit 16777216 -e <source>`), then the real run/done JSON protocol with `return 2;`. A Python supervisor supplies input and validates the done value. “Cold” is Popen entry to receipt of done, **not** Python import/startup, TS executor work, or final process reap. “Warm” is READY to done. The filtered modes execute an extra C launcher and child, while native Popen directly executes qjs; this is a whole-prototype comparison, not an isolated BPF comparison.

| Profile | Cold ms, median (min–max) | READY→done µs, median (min–max) |
|---|---:|---:|
| native | 24.472 (2.167–179.921) | 184.210 (145.251–33188.065) |
| allow | 53.788 (7.787–361.445) | 164.542 (138.543–27506.533) |
| notif | 77.554 (4.918–715.921) | 188.126 (141.668–25144.686) |

**M:** Five repetitions of a run doing **1,000 sequential awaited echo tools**, with the same JSON protocol, pipes, and Python responder. Divide READY→done by 1,000: this amortizes initial run/done frames but includes JSON, Promise/event-loop work, readiness wait, request/response I/O and Python processing. It excludes any real tool and TS policy validation.

| Profile | µs per tool, median (min–max of run averages) |
|---|---:|
| native | 201.685 (35.450–324.224) |
| allow | 164.117 (80.163–410.208) |
| notif | 355.109 (231.995–479.218) |

**I:** In these two filtered prototypes, tool bytes travel over native read/write pipes, not a syscall notifier for every byte. These are the applicable per-tool measurements for the hybrid/allowlist designs. A fully intercepted TRAP/SYSEMU/notification tool path would add its writev/poll/read emulation and copying; its end-to-end latency was **not** measured. The `traprpc` scalar timing is only a transport comparison.

### Compute speed and 1/4-core throughput

**M:** Five runs per profile of `let x=0; for(let i=0;i<2000000;i++) x=(x+i)|0; return x;` after READY; identical result −1455759936. Warm elapsed time:

| Profile | Compute-loop ms, median (min–max) |
|---|---:|
| native | 222.979 (104.729–456.683) |
| allow | 235.115 (133.639–495.030) |
| notif | 264.418 (96.222–792.500) |

**I:** Medians are 1.05× and 1.19× native for allow/notif, but the overlapping, very wide ranges prevent assigning that difference to the filter. Between syscalls all four designs execute native instructions, without ISA interpretation. Syscall density and scheduler contention determine slowdown; a compute-only loop does not justify a claim about syscall-heavy programs. No full QuickJS systrap or ptrace backend was built to measure its compute-loop ratio.

**M:** For each transport, three bulk repetitions with 1 or 4 simultaneous instances; one supervisor/guest pair shares each assigned CPU, CPUs 0–3 for four-core runs. Rates below count **synthetic attempted/emulated syscalls per second**, including benchmark process setup/teardown and driver time. Per worker: 200k native/ALLOW calls, 20k TRAP calls, 1k for external transports. These are distinct from the child-loop latencies above.

| Transport | 1-core calls/s, median (min–max) | 4-core calls/s, median (min–max) |
|---|---:|---:|
| native | 878805 (592719–1326052) | 1765955 (1143639–2735784) |
| allow | 480887 (433183–689759) | 1975818 (1857395–1997954) |
| trap | 103784 (90454–111554) | 195371 (158746–409761) |
| traprpc | 5464 (4637–6879) | 8066 (6946–12375) |
| notif | 8520 (8360–11982) | 13989 (13484–21287) |
| sysemu | 4370 (4052–35715) | 16826 (10462–17971) |
| ptrace | 5711 (4033–6700) | 7579 (6577–11544) |

**M:** Full cold bootstrap/run/done/**exit+reap** throughput: three repetitions, 100 jobs per core, 1 or 4 independent Python workers. The filtered profiles include the per-job C supervisor process. No pooling, namespaces, cgroups, or TS executor in this spike. Thus these rates include additional process-lifecycle costs absent from cold-to-done latency.

| Profile | 1-core jobs/s, median (min–max) | 4-core jobs/s, median (min–max) |
|---|---:|---:|
| native | 43.5 (36.9–79.5) | 147.9 (71.5–166.0) |
| allow | 10.3 (4.1–17.2) | 28.0 (11.5–41.4) |
| notif | 10.3 (4.6–12.5) | 26.9 (25.3–27.6) |

**I:** Do not extrapolate the shared-HVF numbers to a quiet $5 VPS, or compare them as speedups against the brief's quiet macOS KVM/HVF figures. ALLOW even exceeds native four-core call throughput in one phase; conversely, filtered cold lifecycle rates are very poor here. These contradictions and ranges are evidence of unstable scheduling/prototype topology, not proof of an intrinsic 10× seccomp startup penalty. Production should use a persistent broker shard rather than exec a separate C supervisor for each run, and measure setup, faulting, scheduling and reap separately on the actual provider.

### Memory, parked clone, and copy/rewind

**M:** 32 independently launched canonical-READY instances, `/proc/pid/smaps_rollup` after the fleet is initialized; medians in KiB. Executable sharing is reflected in PSS. The parent Python driver/TS executor is excluded.

| Object | RSS | PSS | Private dirty | VmPTE (kernel page tables, not in RSS/PSS) |
|---|---:|---:|---:|---:|
| Independently exec'd qjs, all three profiles | 1,720 | 410 | 368 | 44 |
| Additional C supervisor, allow/notif profile | 1,116 | 107 | 92 | 40 |
| CoW-cloned parked qjs, 32 children plus one template | 1,920 | 61 | 4 | 44 |

**I:** Native exec is already about **0.40 MiB PSS per guest** at this workload; the prototype hybrid is about **0.50 MiB guest+supervisor PSS**, plus **84 KiB VmPTE** and unmeasured kernel task/stack/FD/seccomp/cgroup objects. These are not total cgroup charges, peak memory, or large-program footprints. The clone fleet's tiny PSS depends on sharing one warm heap/template; children were parked, shared a channel, and were not independently confined. Dirty user heaps will grow. For planning, **0.6–1.5 MiB marginal per small hardened instance** is plausible (E), but must be verified with a real cgroup memory ledger. Do not claim 61 KiB production instances. A custom external systrap additionally needs signal stacks/shared queues and its trusted service; ptrace needs tracer bookkeeping. Neither full implementation's total memory was measured.

**M:** 50 sequential clones from an initialized static qjs, on one CPU. Each clone completed `return 2`; the original stayed parked. Median clone setup to detached/resumable child was **484.5 µs**; clone+run+observed exit was **1224.6 µs**. A separate three-repetition 1/4-core run includes Python/controller startup, template initialization, writable-memory copy probe, 50 clones per worker, and cleanup:

| Parked-zygote prototype | 1-core jobs/s, median (min–max) | 4-core jobs/s, median (min–max) |
|---|---:|---:|
| clone + run + exit | 220.8 (148.3–269.0) | 306.0 (214.8–436.5) |

**M:** Copying 786,432 writable bytes from 9 VMAs in the stopped parent took median 111.1 µs; writing those bytes back and resetting GPRs took 107.9 µs. These were 20 in-place repetitions, with warm memory. Fresh-process restore, durable storage, complete CPU/OS state, and independent-channel confinement were not measured.

**I:** For a complete secure TRAP/ptrace backend, startup and memory remain unmeasured: add loader/stub/tracer setup and the actual startup-syscall count to the native base, then benchmark it. This report supplies working transport/fork/reuse primitives rather than inventing full-backend figures.


## 4. Interception designs

### A. SECCOMP_RET_TRAP with SIGSYS

**F:** TRAP suppresses the syscall and delivers SIGSYS with syscall/architecture information; the handler must set a sensible return register. [Kernel seccomp documentation](https://docs.kernel.org/userspace-api/seccomp_filter.html)

**M:** Implemented a SA_SIGINFO handler that changes saved arm64 `x0` to 123. Also implemented a handler that sends a request to another process over an inherited socket and waits for its response (`traprpc`). The local-handler result is a lower bound for transport, not a gVisor measurement. It excludes external dispatch, argument copying, validation, memory management, and fault handling. `traprpc` includes ordinary socket scheduling but no gVisor optimizations.

**I:** Do not put a privileged Rust syscall library, tool capabilities, archive FD state, or policy secrets in the guest address space. Arbitrary native guest code can read/write that process's writable supervisor state, forge signal frames, jump to handler/stub instructions, and invoke any host syscall that the same filter permits. Read-only code and an alternate stack do not create a privilege boundary. An instruction-pointer check is not authentication: hostile code can jump to the allowed instruction with chosen arguments.

**F:** Actual gVisor systrap uses a small signal stub, shared state, and a separate Sentry; signals cover faults and exceptions as well as syscalls. Its release describes shared-memory communication and further optimizations. [systrap README](https://github.com/google/gvisor/blob/master/pkg/sentry/platform/systrap/README.md), [systrap release](https://gvisor.dev/blog/2023/04/28/systrap-release/)

**I:** A secure derivative needs the same kind of separation: keep semantic state in a different address space, validate all shared state as attacker-controlled, constrain stub memory-management operations, and prevent replacement/unmapping of required machinery. `execve` discards installed signal handlers, so an unchanged static ELF needs a userspace ELF loader or ptrace-driven post-exec setup before executing its first instruction. A pre-exec SIGSYS handler does not survive into qjs. [execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html)

**E:** Local compute remains native between traps. Full external systrap may outperform notification after careful shared-memory batching/spinning or syscall-site patching, but the trivial local handler's number is not a forecast of that result. Extra signal stacks/shared queues are small; the separate Sentry/shard and its scheduling dominate incremental engineering and some footprint.

### B. SECCOMP_RET_USER_NOTIF

**F:** NEW_LISTENER creates a supervisor notification fd. The supervisor receives register arguments and responds with a value/error; it can also inject an fd using ADDFD. Kernel UAPI expressly warns that CONTINUE of pointer-bearing syscalls has TOCTOU hazards. [seccomp UAPI](https://raw.githubusercontent.com/torvalds/linux/master/include/uapi/linux/seccomp.h), [notification API](https://man7.org/linux/man-pages/man2/seccomp_unotify.2.html)

**M:** Implemented an external listener returning 123 for raw `getpid`. The QuickJS hybrid additionally intercepts `clock_gettime` (copies a fixed timespec into the child), `rt_sigaction`/`rt_sigprocmask` (ENOSYS), `set_tid_address` (1), and `ioctl` (ENOTTY). Memory operations and channel I/O go to Linux. `return 2`, a compute loop, and 1,000 sequential JSON tool round trips succeeded. This is not an all-24-slot emulator or full conformance result.

**I:** Best initial mechanism for semantic virtualization: it survives ordinary exec, requires no guest signal stub, and keeps authority external. Default-deny independently in BPF; do not use a notifier as a pathname-check-then-CONTINUE permission oracle. Copy the entire pathname/iovec/message into private supervisor memory first and execute the virtual operation on that copy. Keep virtual archive FDs in the broker rather than injecting real host FDs if exact archive behavior is needed. Check notification validity and account for cancellation before committing effects. Enforce one guest thread/no shared writable mappings; still treat shared memory and signal/cancellation races defensively.

**I:** Notification cannot directly implement target-address-space `mmap` by performing mmap in the supervisor: that maps the wrong process. Options are scalar-checked CONTINUE to host mmap, a fixed guest arena with existing mappings, or a constrained injected/helper syscall path. Exact jitk brk/mmap semantics require that address-space design, not just 24 match arms. Large copies add length-dependent costs absent from the scalar microbench. [Remote memory-copy API](https://man7.org/linux/man-pages/man2/process_vm_readv.2.html)

**F/I:** Seccomp notification requires Linux support (introduced in 5.0); ADDFD and optional flags have later feature requirements. Probe capabilities at startup. Outer container seccomp filters can reject setup or take precedence over the requested action. No `/dev/kvm` is needed; this does not mean every hosted CI runtime permits it. [seccomp(2)](https://man7.org/linux/man-pages/man2/seccomp.2.html)

### C. ptrace PTRACE_SYSEMU

**F:** Contrary to outdated x86-only descriptions, **arm64 has PTRACE_SYSEMU since Linux 5.3**. Both the current arm64 UAPI and Arm's kernel history confirm it. [arm64 UAPI](https://raw.githubusercontent.com/torvalds/linux/master/arch/arm64/include/uapi/asm/ptrace.h), [Arm kernel history](https://developer.arm.com/Tools%20and%20Software/Linux%20Kernel)

**M:** Measured actual PTRACE_SYSEMU on this arm64 VM: one syscall-entry stop, read registers, write the return register, resume. Also measured a conventional PTRACE_SYSCALL fallback: entry and exit stops, set `NT_ARM_SYSTEM_CALL=-1`, then set x0=123. Both validate the emulated sum before returning a timing result. The SYSEMU harness emulates its final result write and terminates the child from the tracer.

**I:** Useful as the correctness reference, loader, debugger, checkpoint controller, and initially a slower exact-ABI implementation. It has a clean external authority boundary, but every event needs kernel stops/waiting/register operations. A tracer must handle faults, cancellation, exec, clones, syscall restarts, and guest death reliably; use EXITKILL and fail closed. A supporting seccomp policy should also deny unnecessary host calls rather than depending on a fallible tracing state machine alone. A child must not gain ptrace authority over its supervisor or siblings. [ptrace API](https://man7.org/linux/man-pages/man2/ptrace.2.html)

**F:** gVisor's platform guide favors systrap and describes its ptrace platform as unsupported and slated for removal. That is evidence about an established implementation's direction, not a reason to extrapolate gVisor latency from this harness. [gVisor platform guide](https://gvisor.dev/docs/architecture_guide/platforms/)

### D. Plain seccomp allowlist and a tool pipe

**I:** Fastest and simplest architecture: native guest instructions and ordinary Linux calls for the explicitly safe cases; the trusted executor reads/writes a bounded pipe or precreated socket endpoint. Reading a tool response and writing a tool request do not each need an extra notifier round trip. The broker still validates every JSON byte and grants no authority on the basis of guest-supplied namespace/function names alone.

**M:** The allowlist launcher runs the identical qjs and canonical bootstrap. Only the initial exec is notified. Its successful host-file-read negative test demonstrates why the measured prototype is not a secure sandbox.

**I:** A hardened implementation must constrain arguments as well as numbers: channel read only on stdin, write/writev only to output/log endpoints, no arbitrary ioctl/fcntl operations, bounded memory sizes, anonymous private non-executable mappings only, no guest-controlled MAP_FIXED replacement of infrastructure, and no host filesystem path resolution. Open resources through a virtual archive broker or arrange a minimal read-only root with no proc/sys/dev escape resources. Passing through Linux `openat`, `getdents64`, `newfstatat`, signal handlers, clocks, and brk silently changes jitk semantics even if the filesystem is isolated.

**E:** This is attractive as an explicitly named Linux-native profile for trusted interpreter workloads. It cannot meet exact existing jitk semantics with BPF alone: BPF cannot dereference arbitrary guest pointers or implement an archive, virtual clock, or full process state.

## 5. Isolation: what remains trusted

**I:** The TCB is the host Linux kernel paths reachable through the filter **plus** the broker/loader, protocol/executor policy, artifact supply chain, and host containment setup. A seccomp filter narrows kernel entry points; it does not make Linux a small kernel. Memory faults, reclaim, scheduler, ELF loading, process teardown, signal delivery where enabled, and relevant filesystem/pipe code remain involved even if most syscalls return ENOSYS. CPU instructions and hardware side channels remain another surface.

| Guest operation | Recommended treatment | Host-kernel exposure that remains |
|---|---|---|
| brk/mmap/munmap | bounded reserved arena or tightly checked anonymous host mappings | Linux VMAs, page tables, faults, reclaim/CoW; exact jitk mapping policy needs emulation |
| mremap | ENOSYS, matching current handler | none from this entry point |
| exit/exit_group | allow real termination after accounting | task teardown and file release; syscall cannot simply return normally |
| set_tid_address | emulate 1 for the profile | no need to register guest pointer with Linux; native bootstrap may otherwise use it |
| read/write/readv/writev | fixed channel endpoints or virtual archive broker | copy-to/from-user, pipe/socket implementation for passed-through channel |
| ppoll | broker event wait for exact contract, or constrained Linux poll in native profile | wait queues/timers when passed through; pointer data cannot be inspected by BPF |
| archive open/stat/directory/seek/close/fcntl | emulate virtual descriptors | broker state and remote-memory copying; no arbitrary guest pathname reaching host VFS |
| ioctl | ENOTTY/ENOSYS/EBADF per handler | no general device ioctl surface is required |
| clock_gettime | synthesize profile clocks | supervisor may read real time for deadlines; guest need not directly call host clock syscall |
| rt_sigaction/rt_sigprocmask | ENOSYS for exact profile | systrap additionally requires private host signal infrastructure, outside guest-visible semantics |
| unknown syscall | return specified error or fail closed | filter/entry path only; never host networking, mount, bpf, perf, ptrace, io_uring, module loading, etc. |

**I:** No syscall number is intrinsically required just to compute once code/memory are installed. Dynamic allocation and final termination need host mechanisms eventually. Pre-reserving a 32 MiB arena lets many guest allocations be metadata operations without a new host mmap, but physical page faults still reach Linux; real unmap/protection needs a target memory operation. A broker can substitute values for clocks and thread IDs. This is why “all 24 syscalls emulated” still does not remove host kernel dependence.

**I:** Defense in depth should be installed during trusted setup: a dedicated unprivileged UID, carefully configured user-namespace mappings, and dropped capabilities; user/mount/PID/network/IPC namespaces where available; a private minimal root with no sensitive proc/sys/dev mounts; read-only artifacts; Landlock restrictions on filesystem access; close unrelated inherited FDs; no-new-privs; a strict final seccomp filter; and cgroup v2 memory/pids/CPU limits plus an external wall-time watchdog. Never give arbitrary guest code a helpful host directory fd, notification listener, pidfd for another tenant, or access to the broker's `/proc` memory. Precreated channel endpoints are capabilities and must be the only communication route. [Namespaces](https://man7.org/linux/man-pages/man7/namespaces.7.html), [Landlock](https://docs.kernel.org/userspace-api/landlock.html), [cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)

**M:** This VM allowed unprivileged seccomp; Landlock ABI query returned **8**; `userfaultfd(UFFD_USER_MODE_ONLY|O_CLOEXEC|O_NONBLOCK)` succeeded. Yet `unshare -Urnm true` failed with `write failed /proc/self/uid_map: Operation not permitted`; cgroup root was not writable by `dev`; `ptrace_scope=1`, `unprivileged_userfaultfd=0`. Thus a successful seccomp spike is not proof that an ordinary account can install every containment layer. Do not change shared global sysctls to make a benchmark pass. Use an administrator-provisioned launcher/delegated cgroup or clearly report missing features.

**I:** Notification possession does not itself grant permission to read/write the target address space. Plan ptrace-style access checks, dumpability, UIDs, user namespaces and Yama explicitly. Changing the guest to a different host UID can break a previously working parent-only `process_vm_*` or `/proc/pid/mem` prototype. Prefer a narrowly privileged setup/access helper or a reviewed same-UID containment design; do not grant the guest ptrace/proc access to fix broker permissions.

**I:** Namespaces restrict visibility/authority, Landlock restricts ambient resource access, and cgroups constrain resource use; none is a second kernel or a substitute for the missing hypervisor boundary. Avoid opening namespace creation to the final guest, which adds unnecessary kernel surface. Containers and cheap VPSs are feasible deployment targets only after capability probing and resource delegation checks.

**I:** Comparison: a native allowlist lets a guest target allowed Linux operations directly. An external emulation broker reduces that controllable interface, but a small custom implementation has not earned gVisor's isolation claims merely by using its interception primitive. gVisor provides a separate application kernel with its own constrained host interaction. KVM instead places jitk's guest execution/memory behind hardware virtualization and exposes KVM/VMM/device behavior to a compromised guest; it still trusts host kernel/hypervisor implementation and configuration. User-mode removes `/dev/kvm` dependencies, not the need for host patching and independent security review. KVM VM fd inheritance is not a supported VM-cloning contract, whereas ordinary process CoW is precisely Linux's normal process model. [KVM API](https://docs.kernel.org/virt/kvm/api.html)

## 6. Pause, fork, snapshots, and replay

### Pause and same-host CoW fork

**I:** Pause at a **supervisor-owned protocol boundary** after a complete request is accepted, before consuming its response. Save framing buffers, pending IDs, scheduler/virtual-clock state, virtual archive FD positions, and tool authority state along with the process. A signal stop or ptrace interrupt is available without guest cooperation; ordinary channel blocking is not proof that no partially processed bytes or signals exist. An external timeout must still kill a runaway guest.

**M:** The prototype waited for canonical READY and confirmed qjs was blocked in `ppoll`. It used PTRACE_SEIZE/INTERRUPT, saved registers, patched a temporary `svc; brk`, injected raw `clone` with **only SIGCHLD** and no CLONE_VM/CLONE_FILES, observed PTRACE_EVENT_FORK, restored code/registers, and replayed the interrupted ppoll in the clone. The original template stayed stopped. Each of 50 clones consumed one run message and returned 2. It uses Linux CoW and the original static binary, with no recompiled interpreter and no hypervisor. [clone API](https://man7.org/linux/man-pages/man2/clone.2.html)

**I, important limits:** The test deliberately reused one channel sequentially and did not install a final guest seccomp filter. Linux fork duplicates descriptor references to the **same underlying stream**, not independent tool sessions. Production forks must rebind endpoints or virtualize all channel syscalls and associate each task with independent broker queues. Archive file offsets, pending notifications, timers, in-flight tools, stdout framing, virtual RNG state, and budgets must be branched too. Never use CLONE_VM for isolated instances.

**I:** A permanently filtered guest cannot simply call a denied clone: seccomp filters cannot be removed for snapshot convenience. For the simplest READY zygote, fork the trusted, secret-free initialized template **before** final confinement, then install the final child policy before accepting guest input. Arbitrary mid-execution fork needs an audited supervisor-controlled clone/helper path in the final policy, or a serialized address-space restore into a new child. Do not permit guest-requested fork merely to make the prototype work. A retained zygote must contain no previous tenant's secrets.

### Durable checkpoint and CRIU-lite

**I:** One static thread, no network except one tool endpoint, and a known archive make checkpointing much easier than general Linux. A complete image still needs mappings/backings/protections, writable pages, GPR/PC/SP, FPSIMD and any enabled extended CPU state, TLS and libc PID/TID bookkeeping, relevant signal/altstack state, syscall restart status, virtual brk/mmap metadata, virtual FD offsets, and broker/protocol state. Save artifact/ABI versions and CPU feature requirements. Registers plus `/proc/pid/mem` alone are incomplete.

**F:** CRIU similarly freezes tasks via ptrace, enumerates memory/resources from proc, and uses a small injected/restorer context to rebuild process state. Reconstructing maps in a fresh process is real additional work. [CRIU design](https://criu.org/Checkpoint/Restore)

**M:** The copy benchmark dumped **786,432 bytes across 9 writable VMAs** from parked qjs through `/proc/pid/mem`, rewrote the same bytes into the same stopped process, and reset GPRs. Timings appear above. **That is an in-place copy/rewind lower bound, not a fresh-process restore, successful durable checkpoint, migration, or full CPU-state save.** Immutable executable pages can instead be referenced by content hash/backing file.

**E:** With resident artifacts and a specialized loader, budget **0.2–2 ms** for a compact local process restore as a target to validate, and potentially **1–10+ ms** including process creation, confinement, mappings, endpoint setup and faulting. These are planning ranges, not measured results; the shared VM's cold-launch tails exceeded them. Disk/network fetch and large heaps add their own costs. Cross-machine restore requires the same ISA and a compatible feature set; it does not make an ARM snapshot portable to x86.

### userfaultfd

**F:** userfaultfd can delegate missing-page/write-protection handling. UFFD_USER_MODE_ONLY is available without the broader privilege needed for kernel-originated faults; access may also be controlled by an outer sandbox. [userfaultfd documentation](https://docs.kernel.org/admin-guide/mm/userfaultfd.html)

**I:** It is a paging/dirty-tracking mechanism, not a register/FD checkpoint format. Prefer ordinary fork CoW for same-host branching and warm MAP_PRIVATE artifact mappings for restore. Lazy paging only helps if avoided copying/faults outweigh pager queues and extra scheduling. A guest syscall accessing a missing user buffer is a kernel-originated access: a user-mode-only UFFD design must prepopulate broker/kernel I/O buffers or handle the documented restriction. A fixed pre-reserved arena also simplifies dirty tracking.

### Determinism and external effects

**I:** Return controlled time from the broker, virtualize ppoll deadlines/event order, seed QuickJS deterministically, and persist PRNG position. Initial Linux exec supplies AT_RANDOM and a vDSO mapping; seccomp does not intercept values already placed on the stack or clock reads through vDSO. A loader or pre-exec/exec-stop stack preparation must supply the intended auxv/seed and remove/replace undesired vDSO access. [vDSO documentation](https://man7.org/linux/man-pages/man7/vdso.7.html)

**I:** For the specified QuickJS workload, deterministic JS-level time/random is achievable. Universal determinism for arbitrary native binaries is a stronger claim: CPU timing/random instructions, scheduling and hardware differences are not syscall interception. x86 has PR_SET_TSC for TSC trapping, but that is not a portable solution for every instruction or ARM counter. [PR_SET_TSC](https://man7.org/linux/man-pages/man2/pr_set_tsc.2const.html)

**I:** Forking a pending tool call must not execute an external effect twice accidentally. Snapshot the accepted request separately from delivery of its result, assign branch identities, and make replay/idempotency policy explicit in the trusted executor. Restoring process bytes cannot roll back an email, database write, or network response. No such external tools were called in these experiments.

## 7. Reusing the Rust handlers

**M:** Copied `fs.rs` and these **12 unmodified modules** into a temp harness: `openat`, `close`, `lseek`, `newfstatat`, `getdents64`, `fcntl`, `readlinkat`, `ioctl`, `rt_sigaction`, `rt_sigprocmask`, `set_tid_address`, `mremap`. Built with `rustc --edition=2021 -O` inside the VM. Adapted only the surrounding host interfaces: identity/archive backing, bounded guest-memory copyin/copyout, and a synthetic archive. Assertions verified open/read/seek/close, fd flags, stat size, directory output, read-only errors, and constant handlers. Output: `PASS: unmodified fs.rs + 12 syscall modules compiled; archive, fd, stat, directory and constant-handler assertions passed`. This proves a reusable subset, not a production library extraction or a Linux security proof.

**F/I:** [syscalls.rs](../../jitk/kernel/src/syscalls.rs) already provides useful seams (`copyin`, `copyout`, `writable`, `now_ns`, `poll_fd`, `park_poll`). However [fs.rs](../../jitk/kernel/src/fs.rs) has global mutable FD state and obtains archive bytes through `mmu::physical`; several older handlers directly dereference translated guest pointers. `mmap`, `munmap`, `brk` directly manipulate guest page tables and flushes; `exit` powers down the kernel; console I/O and wait paths depend on the jitk environment. Compiling the whole no_std kernel as a Linux library is not a drop-in reuse plan.

**I:** Extract a shared semantic crate parameterized over `GuestMemory`, `AddressSpace`, `Archive`, `Clock`, `Wait`, `Console`, and `Lifecycle`. Move mutable globals into per-instance state; retain exact errno and serialization logic. On Linux, copy guest pointers through checked remote-memory operations or a validated memory abstraction; never cast a guest numeric pointer to a broker pointer. Refactor the direct-pointer readv/writev/clock/getcwd paths before sharing them. Keep arm64 struct layouts explicit, and add an x86 ABI adapter rather than relying on host libc structs. Maintain one canonical slot/manifest generator.

**I:** Reuse the existing differential contract fixtures as the acceptance gate for both kernel and userspace implementations. Extend them to every inherited handler, bad pointers/overflow, huge lengths, fd reuse, syscall cancellation, malicious shared state, and fork/replay. Returning ENOSYS from unknown calls is straightforward; reproducing all the specified argument/error ordering and memory behaviors is the real compatibility work.

## 8. Engineering effort and deployment boundaries

**E:** These are experienced systems/security engineer **person-weeks**, not elapsed time promises. They include implementation, meaningful conformance testing, failure handling and documentation, but an independent security review is separately budgeted. Parallel staffing does not eliminate integration work.

| Deliverable | Effort | What it buys / what remains |
|---|---:|---|
| Runnable native allowlist spike | 1–2 weeks | Payload/protocol demo, measurements; substantially achieved here as research code, not hardened |
| Production Linux-native profile | 8–16 person-weeks | namespaces/UIDs/FD hygiene/Landlock/cgroups, immutable artifacts, syscall argument policy, watchdog, supported-kernel matrix, protocol limits, CI, telemetry; semantics explicitly differ from jitk |
| Exact-profile hybrid broker | 16–28 person-weeks total | shared Rust semantics, virtual archive/time/FDs, secure loader/target mappings, arm64 conformance; depends on chosen memory design |
| READY zygote with independent channels | +4–8 person-weeks | fork controller, per-child confinement, endpoint rebinding, leak/reset tests and accounting |
| General pending-tool fork + durable restore/replay | +8–16 person-weeks | CPU/TLS/mapping format, filter-compatible restore, broker transactions, versioning, cancellation, migration tests |
| Custom external systrap backend | 24–48 person-weeks before broad hardening | ELF/stub/fault/signal machinery, restricted helper operations, shared-state validation and optimization; no reason to choose it solely from local SIGSYS latency |
| ptrace reference/diagnostic backend | 6–10 person-weeks for narrow profile | reasonable first correctness tool; making it production-safe with the full lifecycle/snapshot story takes additional work |
| Independent review/fuzzing/remediation | +4–8 person-weeks minimum | separate reviewer, adversarial native probes, broker/loader/filter review; ongoing patching still required |

**E:** A realistic exact-ABI backend with usable READY forks is roughly **5–9 engineer-months**, and adding durable arbitrary pending-call restore/replay and review brings the program to roughly **8–14+ engineer-months**. An explicit native compatibility profile is a smaller **2–4 engineer-month** project. Cross-ISA payload builds, x86 ABI/layout support and testing are additional; do not call the current ARM-only payload a universal VPS binary.

**I:** Deployment matrix: Linux bare metal/VPS and nested cloud VMs need no virtualization extension; containers/CI require permission to install the needed filters, trace their own children where applicable, and obtain resource limits. A locked-down outer policy can deny user notification, ptrace, unshare, or userfaultfd. Basic native seccomp may still work when the richer variant cannot. macOS, Windows, and browser execution require different operating-system or emulation backends; this report does not solve those targets.

## 9. Reproduction and remaining gates

**M:** All commands below run inside the VM, in the researcher-owned directory. They modify only its own artifacts and spawn test processes. `bench.c` is the final source; `bench-new` is its measured executable.

```sh
cd ~/portability/usermode
cc -O2 bench.c -o bench-new
python3 run.py micro
python3 run.py qjs
python3 run.py memory
python3 run.py throughput
python3 extra.py
python3 scaling.py
python3 zygote.py
python3 zygote-memory.py
(cd reuse && rustc --edition=2021 -O main.rs -o reuse-check && ./reuse-check)
```

**I:** Remaining production gates: all-24-slot differential conformance; malicious native probes proving filesystem/FD/argument confinement; install-once policy across exec and fork; independent fork channels; complete CPU/OS-state fresh restore; cancellation and tool-effect replay tests; cgroup-inclusive peak/marginal memory; and quiet x86/ARM provider benchmarks. The experiments intentionally leave these unclaimed.

## 10. Ranked recommendation

1. **Build a constrained native-process backend with an external broker, using USER_NOTIF for semantic differences and ordinary fixed-endpoint channel I/O.** Preserve the existing static payload on matching ISA; extract shared Rust semantics; make host memory operations a small, explicit, audited subset. Add a READY zygote only after independent channel and confinement tests pass. This is the best engineering/performance balance for no-KVM Linux. **I**
2. **Use existing gVisor systrap when a no-hypervisor deployment must substantially reduce exposure to host Linux kernel APIs.** Integrate jitk's narrow tool policy above it; do not claim this report measured runsc or its startup/memory. It is a larger runtime dependency but an established security architecture. **I**
3. **Offer a separately named native Linux compatibility profile with a hardened allowlist** if exact jitk errno/address/time behavior is unnecessary. It is the simplest fast path, but the unconfined 24-number prototype must never ship. **I**
4. **Keep ptrace/SYSEMU as a reference and checkpoint/loader tool.** It is available on arm64 as well as x86 and demonstrated working here; the measured stop traffic and variance make it an unattractive default syscall path. **I/M**
5. **Defer a custom external systrap implementation until a realistic exact-ABI workload shows notification is the bottleneck. Reject an all-in-process privileged SIGSYS emulator as the isolation design.** The signal mechanism is useful; the missing trust boundary is decisive. **I**

**I:** The main opportunity is density and portability: process-native execution plus Linux's existing executable sharing/CoW. The main cost is a weaker/different isolation boundary and significant exact-ABI/checkpoint engineering. This research establishes feasibility and measured primitives; it does not establish a production security boundary or a quiet-VPS latency SLA.
