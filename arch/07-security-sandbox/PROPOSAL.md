# 07 — Security sandbox (round 2)

**Bottom line.** All five blockers have been run as experiments. One finding reaches beyond
this area: **Linux KVM works on this Mac.** QEMU 11.1.2 with `-accel hvf -M
virt,virtualization=on` runs a Debian 6.12 arm64 guest that has `/dev/kvm`, and stock
libkrun a1d8616 boots VMs inside it. That removes the "no KVM locally" blocker for
functional and security tests on Linux, for every area. Nested-virt timings are **not**
production numbers.

| Area | Result |
|---|---|
| macOS Seatbelt | A precompiled 4-rule profile, applied in-process before `build()`, adds **63 µs** (p90 81 µs). For comparison, compiling SBPL in-process adds 5.4 ms and `sandbox-exec` adds 7.6 ms. Boot works. Denied: reads outside the allowlist, write, connect, exec, fork, sysctl. |
| libkrun audit | **~30** guest-reachable panic sites. All are DoS-self; no memory-unsafety escape found. The patch is +130/−79. **5/5** fault guests that SIGABRT stock libkrun stop cleanly with the patch (exit 0 or 75). |
| Linux seccomp + Landlock | Verified on real KVM, both as a union TSYNC filter and as per-thread role filters. Boot, console TX/RX and thread spawn all work. **10/10** attack syscalls get SIGSYS, including ones made from the vCPU and console threads. Setup cost is 0.12–0.45 ms. |
| Policy | `policy.mjs` is 90 LOC; 22 assertions pass. It covers frame cap before accumulation, strict envelope, budgets, deadline, kill-on-violation, per-call credentials and two taint rules. |
| EL0/EL1 | **Keep the split.** All three CVE IDs are verified; details and corrections are in §3e. |

## 1. Threat model and layered design

**Attacker.** The attacker controls the JS source. Assume a QuickJS bug gives native code
execution at guest EL0. One more bug in jitk's ~16 syscalls gives guest EL1, meaning
arbitrary MMIO, virtqueue descriptors, hvc/smc and sysregs. One more bug in the VMM gives
code execution in the jitk-vmm host process.

**What we protect:**
- Host files, network and credentials.
- Other tenants' VMs.
- Host availability: a VM may only hurt itself.
- Tool side effects: only policy-approved calls happen.

**Trust timeline.** The guest is trusted until the RUN frame arrives. The guest image,
kernel, qjs and bootstrap are immutable and chosen by the host. So the rule is:

> The supervisor sends code only after it has seen **both** the VMM's sandbox ack (`S\n`
> on fd 2) **and** the guest READY frame.

That one rule makes "sandbox after `build()`" safe on Linux, which matters because the
vCPU starts inside `build()`. On macOS the sandbox is already applied before `build()`.

| Layer | Mechanism | Owner | Stops |
|---|---|---|---|
| L1 policy | Strict schema, budgets, deadline, taint→approve/deny; per-call scoped creds minted on host | 07 (`policy.mjs`) + 04 | Confused-deputy and exfiltration through tools |
| L2 wire | 1 MiB frame cap *before* buffering, ASCII JSON, depth/structure caps, kill on violation | 03 decoder + `LineReader` | Parser and memory DoS against the host |
| L3 guest | qjs at **EL0**, jitk at EL1; no fs/net syscalls exist; MMIO mapped EL1-only | 02 | JS-engine RCE becoming device access |
| L4 devices | 1 virtio-console + PL031 (+ in-kernel GIC), all patched to fail closed | 01 + `patches/` | Guest-triggered VMM panic or hang |
| L5 process | macOS: in-process Seatbelt. Linux: rlimits+NNP, Landlock(image,/dev/kvm), seccomp per role, cgroup, opt. netns | 07 | VMM RCE becoming host access |
| L6 lifecycle | One VM per process, single use; deadline SIGKILL; `PDEATHSIG`; never reuse | 01/04 | Persistence, cross-run leaks |

## 2. Real files (all compiled and run)

```
macos/jitk.sb          production Seatbelt profile (4 rules incl. version/deny)
macos/main.rs          jitk-vmm + sandbox_apply(precompiled) before build(); --compile-profile
macos/bench.py         n=30 latency; macos/latency-r2.json, macos/probe-r2.json
linux/confine.rs       rlimits/prctl, Landlock, dependency-free seccomp-BPF compiler + role tables
linux/main.rs          Linux jitk-vmm: limits→Landlock→build→seccomp→ack→run (+ JITK_* test knobs)
linux/spawn-cg.c       clone3(CLONE_INTO_CGROUP) spawner (supervisor side)
linux/nested-kvm/      mkbase.sh, boot.sh, mkwork.sh, init, bench.py, run-roles.sh (KVM-on-Mac harness)
linux/evidence/        per-thread strace of libkrun on KVM, functional logs, bench JSON
patches/libkrun-robustness.diff   guest-reachable panics → clean stop (applies to a1d8616)
patches/thread-hook.diff          16-line per-thread confinement hook (Firecracker-style roles)
guest/*.S, run-faults.py, fault-results-r2.json   hostile bare-metal guests, stock vs patched
policy.mjs, policy-test.mjs       host policy/dispatcher v0 (node policy-test.mjs → 22 pass)
r1/                    superseded round-1 experiments (kept for provenance)
```

### 2a. macOS profile (`macos/jitk.sb`). This is the whole policy.

```scheme
(version 1)
(deny default)
(allow file-read-data (subpath (param "IMAGES")))          ; immutable image dir, read-only
(allow sysctl-read (sysctl-name "hw.pagesize_compat"))     ; arch/aarch64/mod.rs:56 unwraps it
```

Compared with 01's `dev-sandbox.sb`, this profile drops:
- `process-exec` and `file-map-executable`;
- `/System` and `/usr/lib` reads, and the `/` literal;
- all `file-read-metadata`;
- all sysctls but one;
- `iokit-open AppleHVClient`.

None of these are needed when the sandbox is applied **in-process after dyld**. HVF calls
are not mediated by these operations; the experiment confirms boot with all of them denied.

How it is applied:
1. The trusted supervisor runs `jitk-vmm --compile-profile out.sbbin` once at startup
   (`sandbox_compile_string`).
2. Each VM process calls `sandbox_apply` on that blob (`main.rs::confine("compiled")`).
3. If the blob is rejected, the process fails closed with exit 70.

One option was tried and does not work: the built-in `pure-computation` named profile
(26 µs). It cannot be used because libkrun opens the image itself inside `build()`, and
re-opening `/dev/fd/N` is mediated too (tested: `RawOpenKernel EPERM`). A small
`Payload::from_bytes` libkrun patch would allow zero custom SBPL. That is deferred.

### 2b. Linux seccomp allowlist (`linux/confine.rs`)

**How it was derived.**
1. Ran `strace -ff` of libkrun a1d8616 on KVM (`linux/evidence/tr-park.*`, 4 threads).
2. Took steady state to start after the first vCPU kick (`tgkill SIGRT_2`).
3. Extracted every syscall and its arguments per thread role.
4. Reviewed each by hand; no automatic union.

Default action is `KILL_PROCESS`, and a wrong architecture also kills.

Observations from the trace:
- After boot, the only ioctl is `KVM_RUN`. ioeventfd/irqfd do queue kicks and IRQs in the kernel.
- Console workers are spawned **after** boot, at the guest's PORT_OPEN, with `clone3`.
  `clone3` therefore returns `ENOSYS`. glibc then falls back to `clone`, whose flags *are*
  checkable, and only the exact pthread flag set `0x3d0f00` is allowed.

| Role (thread) | Allowed in steady state (plus COMMON) |
|---|---|
| COMMON (all) | futex{WAIT,WAKE,WAIT_BITSET,WAKE_BITSET}, rt_sigprocmask, rt_sigreturn, sigaltstack, munmap, madvise(DONTNEED), exit, exit_group, gettid, sched_yield, rseq, set_robust_list, sched_getaffinity, prctl(PR_SET_NAME), mmap(prot∌EXEC, MAP_ANONYMOUS), mprotect(prot∌EXEC) |
| vCPU `fc_vcpu 0` | ioctl(*, **KVM_RUN** only), write(count==8: eventfd kicks only) |
| console rx/tx | read, write, ppoll, close |
| main/event loop | epoll_pwait, epoll_ctl, read, write, eventfd2, close, fcntl(F_DUPFD_CLOEXEC), clone(flags==0x3d0f00), clone3→ENOSYS, seccomp(SET_MODE_FILTER, flags=0) (v1 only: children narrow) |

**Never allowed after boot:** open*, socket*, connect, exec*, fork/vfork, kill/tgkill,
ptrace, bpf, io_uring, dup2/3, `KVM_CREATE_*`, any other ioctl, PROT_EXEC mappings,
namespace and credential calls.

**Two deployment modes, both verified:**
- **v0, no libkrun patch.** One union filter installed with TSYNC after `build()` and
  before `run()`, then the ack. Safe by the trust-timeline rule above.
- **v1, `patches/thread-hook.diff`.** libkrun calls `thread_hook::enter(role)` first thing
  in the vCPU thread and in each console thread. Each thread installs its own role filter.
  The vCPU is filtered **before its first KVM_RUN**, so only the vCPU can ioctl. Main
  installs MAIN+CONSOLE without TSYNC, and console children inherit it, then narrow.

**Landlock (before `build()`):**
- Requires ABI ≥4; the test kernel has 6.
- Handles **all** filesystem rights, including IOCTL_DEV.
- Allows only `READ_FILE` on the image and `READ|WRITE|IOCTL_DEV` on `/dev/kvm`.
- Handles TCP bind/connect with zero allows.
- Scopes abstract-UNIX and signals (ABI 6).

**prctl/rlimit:** NO_NEW_PRIVS, DUMPABLE=0, PDEATHSIG=SIGKILL; CORE=0, FSIZE=0, NOFILE=64.

**cgroup v2 leaf per slot:** memory.max=128M, swap.max=0, pids.max=16, cpu.max=1 CPU. Do
**not** use cgroup.procs migration; see §3c.

### 2c. Policy rules (`policy.mjs`, v0)

1. **Frame cap before accumulation.** `LineReader` throws once buffered bytes without an
   LF would exceed the cap. The test shows it never buffers past 1 MiB. 03 owns the real
   decoder; this is the rule plus a reference implementation.
2. **Kill-on-violation** for protocol or forgery signals:
   - extra envelope field, id not strictly next, bad name;
   - **unknown tool**: generated stubs never emit one, so it means forgery;
   - call budget (default 256; 03's 4,096 is the wire ceiling), outstanding > 64;
   - deadline, or more than 16 denials.

   Kill means SIGKILL the VM and fail the run.
3. **Deny without killing** for an args schema failure. The validator is strict: exact
   keys, types and lengths, and it returns a normalized copy.
4. **Credentials** are minted per call at dispatch (`issuer.issue({run,scope,ttl})`) and
   revoked in `finally`. The guest never receives them; the test asserts no token appears
   in results. Output goes through `tool.output()` (schema + redaction) before the guest
   sees it.
5. **Provenance v0** uses sticky, host-owned labels per run. Tools declare `reads`,
   `egress`, `writes` and `endorsable`.
   - Confidentiality: once a run has read private data, an egress tool goes to
     **approval** if it is endorsable and is otherwise **denied** (no `fetch(url+secret)`).
   - Integrity: after any tool output, a `writes` tool needs **approval**. Browsing
     continues freely.
   - Approval binds to sha256 of the canonical `{run,id,ns,fn,args}`, is single-use, and
     forged digests fail.
6. **Deadline.** Each call's timeout is the smaller of the tool's maximum and the time
   left, with an AbortSignal and an idempotency key `${run}:${id}`.
7. **Provenance v1, deliberately not per-value taint in the guest.** CaMeL and FIDES
   label values inside a *trusted* interpreter. Here the interpreter runs in the
   attacker's VM, so any label it carries is forgeable. The sound v1 is **host-side
   handles**: private-read tools return opaque handles (for example `h:9f..`) plus a
   redacted preview. Egress tools take handles, and the host resolves them and checks
   each flow exactly. The data never enters the VM.

## 3. Blockers: experiments and results

### (a) macOS minimal profile, in-process — ELIMINATED

Commands, from `07-security-sandbox/`:
```
rustc ... macos/main.rs -l sandbox --extern krun=<a1d8616 rlib> -o /tmp/jitk-07/r2/jitk-vmm
codesign -s - --entitlements chroot_vm.entitlements
jitk-vmm --compile-profile jitk.sbbin      # 545-byte blob
python3 macos/bench.py
```

Probes (`macos/probe-r2.json`) run inside the sandboxed VMM before `build()`, then the VM
boots kk.bin and exits **0**. All of these got **EPERM**:
- read `/etc/passwd`, `~/.ssh`, and a file next to the image dir;
- create a file in the image dir;
- TCP connect;
- exec `/bin/echo`;
- `fork()`;
- `sysctl kern.hostname`.

Only the image read succeeds. Latency, n=30 per mode, 5 warmups, randomized interleaving.
Load average was 15–19, so the paired deltas matter more than the absolute values.

| mode | wall median ms | p90 | paired added median | sandbox call itself |
|---|---:|---:|---:|---:|
| none | 7.09 | 7.43 | — | — |
| **precompiled `sandbox_apply`** | **7.05** | 7.69 | **+0.17** (noise) | **0.063 ms** (p90 0.081) |
| `sandbox_init_with_parameters` (SBPL) | 12.63 | 13.29 | +5.71 | 5.44 ms |
| `sandbox-exec` (deprecated) | 14.68 | 15.12 | +7.59 | — |

**UNVERIFIED:** `sandbox_compile_string` and `sandbox_apply` are private libsandbox
exports. The blob format may change across macOS versions, so compile it at supervisor
start rather than at build time, and fail closed if the apply step is rejected. macOS is
the dev platform, so the risk is acceptable.

### (b) libkrun robustness audit at a1d8616 — ELIMINATED for our device set

Two independent read-throughs plus fault guests.

**Build facts:**
- libkrun's `Cargo.toml` leaves `panic="abort"` **commented out**. With the default
  unwind, a panic kills one thread and the VM **hangs**; 01 observed this.
- Overflow checks are off.
- `Queue::is_valid()` is **never called** in production, so every guest ring address is
  unchecked until it is used.

| Where (file:line @a1d8616) | Guest trigger | Class | Patched to |
|---|---|---|---|
| hvf/lib.rs:652 `panic!("Unexpected val")` | hvc/smc, unknown PSCI/SMCCC id | DoS-self | x0=−1 NOT_SUPPORTED (spec) |
| hvf/lib.rs:746 `unsupported mmio len` | `strh` to MMIO | DoS-self | len 2 supported |
| hvf/lib.rs:719–753 ISV unchecked | LDP/STP/SIMD/s1ptw to MMIO → wrong decode | mis-emulation | GuestFault stop |
| hvf/lib.rs:784, 800 sysreg rd/wr `panic!` | trapped unknown sysreg | DoS-self | GuestFault stop |
| hvf/lib.rs:839 `unexpected exception` | e.g. EC 0x20 (jump to unmapped) | DoS-self | GuestFault stop |
| hvf/lib.rs:678 `pc+4`, :831 `(cval-now)*k` | PC wrap; huge CNTV_CVAL | wrap (debug panic) | wrapping/saturating |
| macos/vstate.rs:489 `panic!("Error running HVF vCPU")` | any vCPU error | DoS-self | `exit(75)` via Vmm::stop |
| legacy/vcpu.rs:93,103,213,218 asserts | ICC_SGI1R / IROUTER affinity (userspace GIC) | DoS-self (poisons mutex) | ignored/dropped |
| legacy/vcpu.rs:34 `pending_irqs.push_back` | vtimer re-queued per exit | **host memory growth** | dedup (≤1020) |
| legacy/vcpu.rs:168–186 `&val as *const as *mut` | `mrs MDCCINT_EL1` | **UB** (in-bounds) | `&mut val` |
| gicv3.rs:184,225,255,283,295,338,359,386,425–468 | unknown offset/size, ITARGETSR | DoS-self | RAZ/WI |
| virtio/queue.rs:482 `avail_idx().unwrap()` | avail_ring outside RAM + notify | DoS-self (worker) | len()=0 |
| console/device.rs:215,227,264,268 OOB `ports[id]`/`queues[]` | control PORT_READY/OPEN id≥n | DoS-self | bounds check |
| console/device.rs:266,270 `.expect("queue should exist")` | PORT_OPEN twice | DoS-self | ignored |
| console/process_tx.rs:32 `assert_eq!(n, len)` | TX desc running past end of RAM | DoS-self | warn |

Class-2 findings (escape, host leak, write outside guest RAM): **none**.
- Every `unsafe` block in scope was reviewed. Guest-controlled values reach them only as
  register indexes masked to 0..30, or as vm-memory-validated slices.
- The guest cannot name host fds or create ports.
- Descriptor chains are bounded by a ttl equal to the queue size.
- Linux KVM vCPU loop: no guest-reachable panics. Unknown exits become an error and exit 1.
- On Linux, `SystemEvent` (any type) exits 0. The supervisor must still require the
  `done` frame, as 01 says.
- The GIC rows apply only to the userspace GIC fallback, which `builder.rs:1290` uses
  when `HvfGicV3::new` fails (before macOS 15). Which implementation ran here was not
  instrumented. On KVM, libkrun always uses the in-kernel KvmGicV3.

Fault-injection evidence. Run `python3 guest/run-faults.py`: the production launcher with
the compiled sandbox and `panic=abort`, stock vs patched rlib (`patches/libkrun-robustness.diff`
applied, built with `cargo build --release --features ffi`, 16 s incremental).

| guest | stock a1d8616 | patched |
|---|---|---|
| unknown-hvc (x0=0xdead) | **SIGABRT** lib.rs:652 | rc 0 (got −1, then SYSTEM_OFF) |
| unknown-smc | **SIGABRT** lib.rs:652 | rc 0 |
| mmio-halfword (`strh`) | **SIGABRT** lib.rs:746 | rc 0 |
| bad-sysreg (→EC 0x20) | **SIGABRT** lib.rs:839 | **rc 75** (GuestFault) |
| console_avail_oob (QueueSel 3, avail=2^48) | **SIGABRT** queue.rs:482 | rc 0 |
| rtc_oob_read (PL031 bad offsets) | rc 0 | rc 0 (PL031 is bounds-safe) |

**UNVERIFIED:**
- The patch was compiled and tested on macOS only. The virtio part is shared code; the
  Linux build is untested.
- The console OOB-port-id and double-PORT_OPEN fixes are code-reviewed but have no fault
  guest yet, because they need a real control virtqueue (~80 instructions).

### (c) Linux confinement — ELIMINATED functionally on real KVM; bare-metal cost UNVERIFIED

Environment (`linux/nested-kvm/`; one boot takes ~5 s):
```
qemu-system-aarch64 -M virt,virtualization=on,gic-version=3 -accel hvf -cpu host -smp 4 -m 3072 \
  -kernel vmlinuz(Debian 6.12.113 arm64, CONFIG_KVM=y) -initrd base+work.cpio.gz
```
The guest reports `/dev/kvm` and Landlock ABI **6**. libkrun Linux is built in
`rust:1.95-slim` from a1d8616, plus `thread-hook.diff` for the v1 runs.

Functional results (`linux/evidence/functional-*.log`), all under full confinement:
- kk.bin, probe.bin (console TX) and park.bin with host→guest input (console RX) all run
  to SYSTEM_OFF in both the union and role modes.
- The console worker threads are spawned **after** seccomp is installed. This confirms
  the clone3→ENOSYS→clone fallback works with glibc 2.41.

Landlock probe: `read /etc/passwd`=EACCES, `read image`=0, `create /tmp/x`=EACCES,
`connect 127.0.0.1:9`=EACCES.

Attack simulation: the `JITK_EVIL` knob runs a forbidden syscall after confinement.

| Attack | Result |
|---|---|
| openat, socket, execve, ioctl(TIOCGWINSZ), ioctl(KVM_CREATE_VM), mmap(PROT_EXEC), kill | **SIGSYS**, process status 159 |
| clone3 | ENOSYS, by design |
| *Inside the real vCPU thread* (hook): eventfd2 | **SIGSYS** |
| *Inside the real console TX thread* (hook): ioctl KVM_RUN | **SIGSYS** |

Per-VM cost (`linux/evidence/bench-steps*.json`; µs, median/p90 of 30, nested virt with
the host at load 15–20, so treat these as upper bounds):

| step | median | p90 | note |
|---|---:|---:|---|
| rlimits + 3×prctl | 3.4 | 4.4 | |
| Landlock (ABI probe, ruleset, 2 rules, restrict) | 11 | 16 | |
| empty netns via `setns` to precreated ns | 7.6 | 11.5 | vs `unshare(CLONE_NEWNET)` 237/390 |
| seccomp BPF compile (~100 insns) | 9 | 16 | could be const |
| seccomp install, JIT off | 83 | — | median of 11 |
| seccomp install, JIT on | 240–770 | up to 10,700 | JIT memory permission flips; nested TLB cost |
| cgroup join via `cgroup.procs` write | **36,000–50,000** | 89,000 | percpu-rwsem/RCU sync |
| cgroup join with `favordynmods` mount | 42 | 74 | |
| `CLONE_INTO_CGROUP` (`spawn-cg.c`) | ≈0 extra | | |

**Total: 0.12–0.45 ms, under the 1 ms target**, provided cgroup placement uses
`CLONE_INTO_CGROUP` or `favordynmods`. Naive migration is unacceptable.

Whole-process wall time is too noisy under nested virt to compare
(unconfined 7.1 ms vs confined 5.8–16.9 ms median). Do not quote it.

Test plan for bare metal (c7g.metal), **UNVERIFIED there**:
1. Run `mkbase.sh` steps on the host itself; build `linux/main.rs` with `--cfg feature_hook`.
2. Run `run-roles.sh` and the `bench.py` modes.
3. Add the fault guests on KVM: unknown exit, EPIPE on stdout, repeated PORT_OPEN, guest
   panic. They must show **no SIGSYS** on legitimate paths. Untested legitimate paths
   that might need a rule: the KVM guest-fault exit, `PORT_OPEN` repeat, output EPIPE.
4. Run 100 concurrent VMs per role mode.

Known interaction: with `KILL_PROCESS`, Rust's `abort()` shows up as SIGSYS (tgkill is not
allowed) instead of SIGABRT. The supervisor maps both to "VMM fault".

Footgun found: with `RLIMIT_FSIZE=0`, if stderr is a *regular file* the VMM gets SIGXFSZ
(observed, status 153). Supervisors must use pipes; the existing design already does.

### (d) Policy and dispatcher — ELIMINATED as a v0 spec

`node policy-test.mjs` → **22 policy assertions passed**. The cases are listed in §2c.
Integration into 04's `executor.ts` and an approval UI remain **open**.

### (e) EL0/EL1 split vs EL1-only — DECIDED: keep the split

Facts were checked against MITRE/NVD records and vendor or researcher write-ups, gathered
by a research subagent. The record URLs were not re-opened for this summary.

**QuickJS CVEs:**
- **CVE-2025-62494**: bellard QuickJS, type confusion in string `+` (`JS_ConcatStringInPlace`).
  Leads to OOB access and "arbitrary code execution in the context of the QuickJS runtime".
  Affects 2025-04-26 up to before 2025-09-13; fixed in **2025-09-13**. 04 pins 2026-06-04, which is OK.
- **CVE-2026-1144**: **quickjs-ng** (not bellard), use-after-free in Atomics; fix ea3e9d7.
  The brief mis-attributes it.
- NVD keyword search finds ~24–25 engine CVEs, about two-thirds of them since 2025.
  Typed arrays, libregexp (62495), GC/async (2023-48184), promises (62491) and the
  bytecode reader all appear.

**Hypervisor CVE:**
- **CVE-2026-46316 "ITScape"** is a KVM/arm64 vGIC-ITS use-after-free leading to host
  root. Its write-up says *"Driving GIC/ITS MMIO requires guest kernel (EL1) privilege."*
- Fixed in 6.12.93 / 6.18.35 / 7.0.12.
- Our configuration is **not exposed**: libkrun creates no ITS (`grep VGIC_ITS` finds
  nothing) and we run 1 vCPU while the race needs several. It is still the pattern: other
  confirmed escapes (Firecracker CVE-2026-5747, virtio-pci, "guest user with root";
  Kata CVE-2026-47243) also need guest kernel.

**Reasoning.** With EL0/EL1, a JS-engine RCE gets only syscalls into ~1–1.5k LOC of
Rust. That code has no fs or net, validates user pointers on copy, and maps MMIO
EL1-only. The attacker must chain a second (jitk) bug before touching any device. With
EL1-only, one QuickJS bug equals full device and hypercall access, and QuickJS has had
several code-exec-class bugs per year.

**Cost** is one trap per syscall (~16 types; rare in code-mode workloads) plus the
EL0 loader and MMU, which 02 needs anyway. Security wins clearly.

**Requirements for 02:**
- copy_from/to_user with range checks;
- W^X for the qjs mapping;
- MMIO and kernel pages not EL0-accessible;
- PSCI calls only from EL1;
- never trust EL0 pointers in the console path.

## 4. Cuts

| Cut | Why it can go |
|---|---|
| `sandbox-exec` and SBPL compile per VM | Precompiled blob instead |
| dyld, `/System`, IOKit, exec and metadata grants | Not needed in-process |
| Per-slot UIDs | All VMMs run as one unprivileged `jitk` UID. Cross-VM signals and ptrace are already blocked by Landlock signal scope, seccomp (no kill/ptrace) and `DUMPABLE=0`. |
| Mandatory netns | seccomp allows no `socket` and Landlock denies TCP. Keep `setns` (8 µs) only if the supervisor already holds CAP_SYS_ADMIN. |
| Firecracker jailer, libseccomp, seccompiler/JSON | Replaced by a 153-line dependency-free `confine.rs` |
| Per-value taint/CaMeL in v0 | Host handles are v1 |
| Fixing userspace-GIC paths beyond the patch | macOS ≥15 uses the in-kernel HVF GIC |
| `pure-computation` named profile | Needs a libkrun `from_bytes` payload; later |

## 5. Disagreements (with evidence)

1. **Brief/R1: "Linux claims are blocked, no /dev/kvm."** False on this Mac. QEMU 11.1.2
   HVF nested virtualization (M4 Pro, macOS 26.6.1) runs KVM, and libkrun boots under it
   (`linux/evidence`). Only Linux **performance** still needs metal.
2. **01: production Seatbelt "before exec" (sandbox-exec).** In-process plus precompiled
   costs 0.063 ms against 7.6 ms. 01's profile also keeps grants that measurement shows
   are unneeded (AppleHVClient, /System, exec, metadata).
3. **01: "panic=abort + watchdog" is sufficient.** It turns hangs into SIGABRT but still
   lets any guest kill its VMM through ~30 sites, and stock libkrun builds with unwind.
   Ship `libkrun-robustness.diff` (distinct exit 75 = guest fault), plus panic=abort as a
   backstop. One finding is not DoS-self: unbounded `pending_irqs` growth on macOS is
   **host** memory pressure, because there is no cgroup there.
4. **Brief: "CVE-2026-1144 is QuickJS."** It is quickjs-ng. CVE-2025-62494 is the
   bellard one. ITScape is real but not reachable in our configuration. The EL0/EL1
   conclusion is unchanged.
5. **04: "label whole run tool-untrusted on any tool."** That makes every multi-tool run
   need approval, which breeds approval fatigue and then rubber-stamping. Split it into
   confidentiality (private read → egress: deny or approve) and integrity (any tool
   output → `writes`: approve). Browsing stays approval-free. Per-value labels inside the
   VM are unsound because the interpreter is attacker-controlled; use host handles.
6. **R1/04: a per-VM cgroup sounds free.** It is not. Writing to `cgroup.procs` cost 36–50
   ms per VM, roughly 5× the whole boot. The fix is `favordynmods`, or the supervisor
   spawning via `clone3(CLONE_INTO_CGROUP)`. Node's `spawn` cannot do the latter, so add
   the 23-line `spawn-cg.c` or a Rust spawner.
7. **Brief: "sandbox the VMM before the vCPU runs" taken literally on Linux.** That is
   impossible without patching libkrun, since `build()` both opens /dev/kvm and starts
   the vCPU. It is also unnecessary: the guest is trusted until the RUN frame, so gate RUN
   on the sandbox ack. v1's hook gives true pre-KVM_RUN vCPU filtering for 16 lines.

## 6. LOC

| Component | Lines |
|---|---|
| macOS launcher | 115 (incl. ~45 of probe/benchmark knobs; production ≈ 60) + 13-line profile |
| Linux launcher | `main.rs` 104 (≈ 55 without `JITK_*` test knobs) + `confine.rs` 153 + `spawn-cg.c` 23 |
| libkrun fork delta | robustness +130/−79 (8 files), thread hook +16/−1 |
| Policy | 90 (+50 tests) |

Production total for this area: **~400 LOC** of our code plus a **~150-line** libkrun
delta. That fits inside 01's 100–200 confinement budget plus 04's policy share.
