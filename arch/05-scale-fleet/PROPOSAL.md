# 05 — Scale: Linux/KVM fleet

Evidence collected 2026-10-24 on M4 Pro, 12 cores, 24 GiB, macOS 26.6.1.
Read `../BRIEF.md` completely. Only this directory and `/tmp/jitk-05` were written.
**MEASURED** means our experiment; **PUBLISHED** means the linked source's result;
**UNVERIFIED** includes proposed budgets, production targets, and cross-platform extrapolation.

## 1. Concrete design for this area

### Recommendation and capacity contract

Use **one sandboxed libkrun VMM process per single-use VM**, managed by one
`jitkd` daemon per Linux host. Recommend libkrun for this specific static aarch64
qjs + virtio-console workload: it already boots our bare guest, preserves the
macOS development transport, and supports queue-based console I/O. This is an
architectural recommendation, **not a production-readiness claim**: Linux
hardening, actual qjs guest execution, and KVM measurements are release gates.
Pin the tested revision a1d8616 plus audited patches; do not track main.
Upstream says the 2.0 API is unstable and recommends stable branches for
production; reconciling our builder API with a supported release is a gate.
[libkrun](https://github.com/libkrun/libkrun)

Initial acceptance target, **UNVERIFIED**: 1,000 completed executions/sec on a
64 physical-core / 128 GiB arm64 host for a defined workload: <=10 ms JS CPU,
<=1 s mean wall time including tools, <=256 KiB tool frames, one vCPU per VM.
Require measured total CPU <=15 ms/execution including spawn/init/reap/protocol,
and sustainable replacement >=1,000 VMs/sec with >=20% headroom. A warm pool
cannot compensate for slower replacement indefinitely. Do not sell this target
until a sustained mixed-workload test passes.

Start at 64 MiB guest RAM, 8 MiB estimated VMM/kernel overhead allowance,
1,536 total VMs hard cap. Desired tuned tier: **32 MiB RAM + 8 MiB allowance**,
2,048 total VMs, of which normally ~66 are pristine ready VMs. These allowances
are **UNVERIFIED Linux worst-case budgets**, not the measured parked Mac RSS.
For 32 MiB, reserve all 40 MiB/VM even if shared or currently untouched:
2,048 * 40 MiB = 80 GiB. Leave 16 GiB host reserve plus capacity for cache,
page tables, tool broker buffers, and transient creation/reaping. At 64 MiB,
1,536 * 72 MiB = 108 GiB; enforce the 112 GiB workload budget independently.

### Guest RAM and sharing

32 MiB candidate layout: 4 MiB image + loader/FDT allowance, 16 MiB QuickJS heap,
1 MiB stacks, 2 MiB kernel/page tables/queues, 9 MiB transient allocations and
headroom. Set qjs `--memory-limit 16M --stack-size 256k`; cap source 64 KiB,
frames 256 KiB, total admitted tool bytes 4 MiB. OOM terminates the invocation;
it never authorizes a larger host allocation. Validate this budget with the
actual guest allocator; native Linux qjs measurements do not validate jitk's
bump allocator, ELF duplication, syscall mmap accounting, or fragmentation.

**MEASURED** stripped qjs = 2,394,464 bytes; RX PT_LOAD = 2,068,996 bytes;
RW segment memory = 271,472 bytes (`results/qjs-image.txt`). Embedding alone
avoids initrd overhead but does not automatically share guest-resident pages.
Map the embedded ELF's RX load segments directly where possible; copying them
into another anonymous guest region defeats sharing and doubles storage.

Proposed Linux image path: a page-aligned, digest-checked, pre-laid-out public
kernel/qjs image, mapped from the **same inode** using file-backed MAP_PRIVATE;
private anonymous heap/stacks/queues; never rewrite image pages in the loader.
Expose the mappings through KVM memory slots, with KVM_MEM_READONLY only when
capability/arm64 semantics are verified. Private COW mappings preserve isolation
if a compromised EL1 writes image pages; charge such writes to its RAM budget.
Guest page permissions alone do not constrain malicious EL1.
[KVM API](https://docs.kernel.org/virt/kvm/api.html)

A sealed memfd, created **once** by jitkd and passed to VMMs before sandboxing,
is an equivalent backing alternative: seal WRITE/GROW/SHRINK/SEAL, MAP_PRIVATE
in each VM. One new memfd per VM shares nothing. A sealed memfd is not
KVM guest_memfd; the latter is unnecessary here. Prefer a read-only image file
for inspectability; use sealed memfd if deployment cannot enforce immutability.
Do not enable KSM: its scan has latency/CPU cost and content-based sharing can
reveal private data. Explicit image sharing is predictable and needs no scanner.
[KSM mechanism](https://docs.kernel.org/admin-guide/mm/ksm.html),
[security analysis by kernel contributors](https://lists.openwall.net/linux-kernel/2026/07/01/1567)

Default shared backing is **per trust domain**, not globally shared across
hostile tenants: even public executable pages permit cache-based control-flow
observation. Share no input, tool results, heap, RNG state, or credentials.
No SMT sibling across tenants; keep patched host/KVM and CPU mitigations.
Where the isolation contract includes stronger cache-channel resistance, assign
separate hosts to those tenants; do not claim page sharing solves side channels.
Measure cgroup memory.current, smaps PSS, kernel/slab growth and host MemAvailable;
RSS sums double-count shared pages, and PSS is not a hard admission limit.

Stock local libkrun builder uses anonymous GuestMemoryMmap in the normal path
(`src/libkrun/src/vmm/builder.rs:2081`). Its vhost-user path creates a new memfd
per region, not a fleet-shared immutable image. Sharing therefore needs an
explicit loader/memory patch; it is **not a libkrun configuration switch**.
Ship the anonymous path first; do not make capacity depend on speculative savings.

### Pool math and arrival model

Use Little's law **N_active = lambda * E[W]**, where W starts at VM lease and
ends at VM termination, including async tool waits. LLM reasoning before code
submission does not occupy a VM. For A agents that each submit k snippets over
an average think cycle T, lambda ~= A*k/T only when cycles are stable; measure
actual arrivals and synchronized bursts rather than assuming a Poisson process.
Example: 20,000 agents, one snippet/20 s => 1,000/sec; W=1 s => 1,000 active.
W=10 s instead requires 10,000 active and multiple hosts despite little CPU.

A starting refill policy is
`ready = max(64, ceil(lambda*H + 3*sqrt(lambda*H)) + B)`, H=20 ms refill/control
window, B=32 explicit burst reserve: at 1,000/sec => 66 ready.
This Poisson-inspired margin is a heuristic, **not a tail guarantee**; replace
it with the measured p99.9 arrivals in H, including correlated agent bursts.
If measured refill time exceeds H, increase H and recompute. Ten builders would
be needed at 10 ms creation time to replace 1,000/sec; those times are UNVERIFIED.

Capacity is the minimum of CPU, memory, replacement, broker limits:
`lambda <= min(0.7*C/cpu_seconds, (VM_cap-ready)/E[W], measured_refill_rate)`.
`capacity.py`: with C=60 execution/builder cores and 15 ms total CPU, CPU bound
2,800/sec; with cap 2,048 and 66 ready, wall/memory bound 1,982/sec at W=1 s,
198.2/sec at W=10 s. Both are scenario ceilings, not measurements. At W=10 s,
1,000/sec needs at least six such hosts before failover headroom.

Never reserve a VM for every active LLM session. Lease only on executable code.
A VM blocked on a tool sleeps via interrupt-driven console input, not polling.
After completion, timeout, or protocol error: RUNNING -> REAPING -> destroyed;
never reset it into READY. Keep only pre-input, pristine VMs in READY.
Count STARTING and REAPING in admission reservations as well as READY/RUNNING.

### Host daemon, scheduling, and horizontal scale

`jitkd` owns pool records, subprocess pidfds, bounded queues, deadlines, and
image generations. Local API: AF_UNIX SOCK_SEQPACKET, SO_PEERCRED, socket mode
0660; operations Execute(image_digest, code, limits, request_id), Cancel, Stats.
One authenticated harness stream carries bounded ToolCall/ToolResult events;
caller identity/policy comes from trusted session state, never guest JSON.
The credential-holding broker is a different process; VMMs inherit no credentials.
Do not expose the daemon's Unix socket inside the guest or VMM sandbox.

Small privileged launcher prepares namespaces, dedicated UID, read-only image,
cgroup, and preopened FDs; VMM then drops capabilities, sets no_new_privs,
seccomp allowlist, Landlock/empty mount namespace, empty network namespace.
Only the console and KVM/resources required for this VM remain open. Explicit
console-only device list: no implicit fs, TSI, vsock, RNG or network service.
Fail closed on any sandbox setup error. libkrun does not supply the complete
jailer we need. Verify ioctl argument restrictions and all threads' filters.

Use cgroup v2 per VM beneath tenant and host caps: memory.max from measured
RAM+VMM ceiling, memory.swap.max=0, memory.oom.group=1, pids.max=16 initially
(UNVERIFIED thread allowance), cpu.max=100000/100000 as a ceiling; also account
aggregate tenant CPU and total invocation CPU budget. A 100 ms quota is not a
short-job latency mechanism: use cpu.weight, bounded runnable admission and
wall timers; collect usage_usec on exits and terminate budget offenders.
Reserve four cores for host/broker, keep RAM and execution on one NUMA node,
use ordinary fair scheduling and no per-idle-VM dedicated CPU. No realtime policy.
Reap with pidfd, cgroup.kill and populated=0 before returning reserved capacity.

KVM permits multiple VMs/process; reject that layout here: a VMM escape or panic
would reach sibling tenants' memory, accounting and forced kill become harder,
and one crash drains the pool. File sharing works across separate processes.
Do not fork a process after creating its KVM VM: FD inheritance is not a
supported cloning interface. [KVM process ownership](https://docs.kernel.org/virt/kvm/api.html)

Fleet ingress chooses among two eligible hosts using ready depth, reserved RAM,
CPU pressure, image digest and trust domain. Bound local pending work to one
refill window; return retryable overload before accepting more. Autoscale on
arrival rate * wall time, free ready slots, replacement saturation and PSI,
not just CPU; scale ahead of predictable bursts. Hosts heartbeat; on loss mark
in-flight work uncertain, retry only with idempotent tool semantics. Exactly-once
tool side effects need broker deduplication keys, not transparent VM retries.
Drain hosts/image generations, destroy old pristine VMs; no live migration.
Start with a systemd daemon per bare-metal host, not a Kubernetes object per VM.

### VMM comparison for this workload

- **libkrun — recommended**: measured bare HVF boots and density below; Linux
  boot time/density UNVERIFIED. Fits static external kernel and virtio-console,
  minimal host API, same dev/prod transport. Optional broader device code and
  missing complete jailer add audit burden; verify compiled/instantiated surface.
  API instability is material. Small runtime integration; larger hardening work.
- **Firecracker**: strongest ready-made production isolation story: jailer,
  seccomp, cgroups/namespaces; published <=5 MiB VMM overhead and <=125 ms
  Linux-to-init on a specified 128 MiB configuration. These are **not** jitk
  measurements or minimum RAM. Public design documents 5 VM replacements/core/s
  for that Linux workload: pooling does not remove replacement work.
  [spec](https://github.com/firecracker-microvm/firecracker/blob/main/SPECIFICATION.md),
  [design](https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md).
  No equivalent virtio-console path in the documented minimal device set;
  arm serial is **ns16550a**, not PL011. MMIO byte I/O risks many exits for JSON;
  virtio-vsock would add a different guest driver. Relative jitk performance is
  UNVERIFIED. Best alternative if avoiding custom jailer outweighs transport cost.
  [arm FDT](https://raw.githubusercontent.com/firecracker-microvm/firecracker/main/src/vmm/src/arch/aarch64/fdt.rs)
- **Cloud Hypervisor**: arm64/KVM and seccomp by default, useful virtio devices,
  but PCI/hotplug/migration/modern Linux support solve problems we do not have.
  More integration surface to constrain; no defensible comparable jitk RAM/boot
  numbers available: **UNVERIFIED**, not assumed slower.
  [README](https://github.com/cloud-hypervisor/cloud-hypervisor/blob/main/README.md),
  [seccomp](https://github.com/cloud-hypervisor/cloud-hypervisor/blob/main/docs/seccomp.md)
- **Hyperlight**: purpose-built direct-entry guests and explicit calls are a
  compelling smaller interface; project advertises 1–2 ms, **PUBLISHED CLAIM**,
  not our static musl guest measurement. Needs Hyperlight guest integration
  instead of our Linux-syscall EL0/EL1 contract. macOS arm64 exists in v0.17.0;
  release notes qualify its single-address-space/single-executing-sandbox backend.
  Do not rely on older overview pages claiming macOS is merely forthcoming.
  Density and compatibility for jitk are UNVERIFIED.
  [docs](https://hyperlight.org/guides/getting-started/),
  [release](https://github.com/hyperlight-dev/hyperlight/releases/tag/v0.17.0)

### Cost per million executions

`costs.py` fixes 10 ms CPU, 1 s wall, no free allowances, egress, tool/LLM fees,
plan fees or operations staff. Comparisons are marginal compute examples, not
identical security/product contracts. Host price **$2.32/hour is an UNVERIFIED
scenario assumption**, not an obtained cloud quote; scale linearly with it.

- jitk or self-hosted Firecracker at 1,000/sec: **$0.644/M** host-only;
  +25% spare hosts => **$0.806/M**. At 100/sec: **$6.444/M**. Firecracker is
  software, not a priced execution service; its real cost depends on measured
  CPU/RAM/replacement efficiency. At 198.2/sec (10 s waits): **$3.252/M**.
- Cloudflare Dynamic Workers: $0.002 per unique worker/code/day, $0.30/M requests,
  $0.02/M CPU-ms including startup CPU. Unique snippets each execution cost
  **$2,000.50/M** at 10 ms *total billed CPU*. One reused code+ID that day costs
  **$0.502/M**. Passing snippets as data into a stable interpreter changes the
  architecture and may change isolation/CPU cost; it is not the unique-code case.
  [current official pricing](https://developers.cloudflare.com/dynamic-workers/pricing/)
- Lambda Functions arm64 at 128 MiB, 1 s billed duration, $0.0000133334/GB-s
  +$0.20/M requests => **$1.867/M**. 128 MiB has proportionally less CPU; this
  is billing arithmetic, not proof of equal execution speed or fresh-VM semantics.
  [Lambda pricing](https://aws.amazon.com/lambda/pricing/)
- E2B at 1 vCPU/1 GiB and one billed second: **$18.50/M**;
  published default 2 vCPU/4 GiB: **$46/M**. Rates $0.000014/vCPU-s and
  $0.0000045/GiB-s; excludes $150/month Pro fee and creation/rounding overhead.
  Full Linux sandboxes offer much more functionality.
  [E2B pricing](https://e2b.dev/pricing)

## 2. Code sketches / scripts (real files)

- `density_macos.py`: copied signed spike host, incremental parked pools, RSS,
  successful boot-and-exit probes under load, cleanup in finally.
- `host_ready.c`, `create_latency.py`: explicit builder-complete notification,
  sequential creation timing, failure capture, cleanup. Not guest READY timing.
- `hvf_two_vm.c`: directly checks two HVF VM creations in one process.
- `memory_linux.py`: Linux file-private/sealed-memfd/anonymous comparison;
  exact-region smaps accounting and immutable-source check.
- `qjs_linux.py`: QuickJS heap-limit and JSON workloads using BusyBox time -v.
- `linux_kvm_probe.py`: open KVM, API version, KVM_CREATE_VM latency on a real host.
- `capacity.py`, `costs.py`: executable scenario arithmetic with labeled inputs.
- `fleet_state.rs`: dependency-free single-use lease/reap state sketch; compiled
  with `rustc --edition 2021 --crate-type lib ... -o /tmp/jitk-05/libfleet_state.rlib`.
  Illustrates state ownership, not a complete launcher, broker, or security boundary.

## 3. BLOCKERS, experiments, and results

### A. Linux development path — resolved negative; production KVM remains blocked

Command requested: `docker run --rm --privileged --platform linux/arm64 alpine ls -l /dev/kvm`.
Result: exit **1**, `/dev/kvm: No such file or directory`. Follow-up privileged
container: LinuxKit **6.10.14**, aarch64; **zero** `/sys/module/kvm*` entries.
`linux_kvm_probe.py` inside Docker also returns errno **2** on open.
See `results/docker-kvm.txt`, `results/kvm-ioctl.json`. No container privilege
can manufacture nested virtualization absent from the outer Linux VM.
No Linux boot-latency number was measured; QEMU TCG would not answer KVM latency.

Cheapest practical path: borrow an existing arm64 KVM host; otherwise rent the
shortest available **Spot Graviton metal** lease (e.g. c6g.metal/c7g.metal),
terminate after the experiment. Absolute cheapest instance/region and Spot
availability/prices are **UNVERIFIED**; compare quotes before provisioning.
A 10-minute lease at the modeled $2.32/hour would be $0.387 excluding storage
and any minimum billing. Do not rent an ordinary Graviton VM assuming nested KVM.
AWS now documents nested KVM on selected **Intel** virtual instances, so a small
supported instance is an inexpensive x86 hardening/control-plane test, not an
arm64 guest validation. Hetzner CAX cloud explicitly disallows nesting.
[AWS nested virtualization](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/amazon-ec2-nested-virtualization.html),
[Hetzner](https://docs.hetzner.com/cloud/servers/faq/)

On arm metal: run `python3 linux_kvm_probe.py`; require API **12** and successful
CREATE_VM; build pinned libkrun via its Makefile; compile `host_ready.c` against
it; assemble copied kk.S/linkk.ld; measure **n>=1,000** bare boot-to-SYSTEM_OFF,
then qjs READY/result. Test pools 1/100/1,000/2,048, 32/64 MiB RAM, memory-current
and host slab deltas, CPU-seconds, sustained replacements, timeout/reap, hostile
PSCI/MMIO, seccomp denial, and COW writes from guest EL1. Firecracker comparison
needs its arm64 Image boot header/load convention; RAM base **0x80000000** is
confirmed, but blindly feeding the 24-byte RAW libkrun kernel is not validated.
[Firecracker layout](https://github.com/firecracker-microvm/firecracker/blob/main/src/vmm/src/arch/aarch64/layout.rs)

### B. macOS parked density — eliminated within requested bound

Copied signed `host`, dylib and bare images into `/tmp/jitk-05`; originals untouched.
Command: `python3 arch/05-scale-fleet/density_macos.py`.
M4 Pro, 64 MiB configured guest RAM, 8-byte WFI guest. Baseline n=30:
process spawn through bare shutdown/exit median **5.910 ms**, p90 **6.371 ms**.
At 1/10/25/50/100 parked VMs, median RSS **7.219–7.234 MiB**;
100 total RSS **723.875 MiB**, maximum per process **7.313 MiB**;
successful n=15 probe median **6.347 ms**, p90 **7.860 ms** at 100 parked.
At target 150, only **127** remained alive; **23** creation failures, **15/15**
extra probes failed. Stop before 200 as instructed. Lower latency of failed
probes is not a successful boot metric. **All children killed/reaped, zero live.**
One vmmap sample at 50 showed physical footprint **2,096 KiB** and configured
64 MiB guest region only **16 KiB resident**: sparse WFI density is not qjs density.

Original-host Popen batch rate ranged **405–850 process starts/sec**; this is
not completed VM startup throughput. Additional command:
`python3 arch/05-scale-fleet/create_latency.py` with signed `host_ready.c`:
**127** builder-complete VMs in **2.694 s** => **47.13 VMs/sec**, median
**15.493 ms**, p90 **31.643 ms** including a **358.143 ms** first-start outlier.
VM **128** fails (`code=8`, `result=72057598332895240`); again zero live afterwards.
This is sequential VMM construction, before vCPU entry, and includes process
launch; it does not establish parallel creation throughput or Linux limits.
Observed 127 ceiling may reflect system-wide HVF capacity plus Docker's VM;
that explanation is **UNVERIFIED**, so do not encode 127 as a universal limit.

### C. One VM/process on HVF — eliminated

Command: `clang arch/05-scale-fleet/hvf_two_vm.c -framework Hypervisor -o /tmp/jitk-05/hvf_two_vm`,
ad-hoc sign with copied-host entitlement source, then run.
Result: first create **0x0**, second **0xfae94002 = HV_BUSY**; destroy succeeds.
`results/hvf-two-vm.txt`. Confirms simultaneous two-VM failure in this process;
Linux multi-VM support is a different API, not constrained by this experiment.

### D. Does explicit page sharing save physical RAM? — Linux process part eliminated

Command: `docker run --rm --platform linux/arm64 -v "$PWD/arch/05-scale-fleet:/work" -w /work python:3.13-alpine python memory_linux.py`.
32 processes, 8 MiB touched mapping each, 1 MiB private writes each:
anonymous-copy aggregate PSS **256 MiB**; file MAP_PRIVATE **39 MiB**;
sealed memfd MAP_PRIVATE **39 MiB**. **84.77%** mapping-PSS reduction;
all RSS sums still **256 MiB**, **32 MiB** private dirty in each shared case;
source unchanged **3/3** modes. No KSM used. memfd shared pages appear
Shared_Dirty because shmem backing is dirty, not because COW failed.
This isolates mapping storage, excludes process overhead, and does **not**
prove KVM's stage-2 mapping/dirty/COW behavior: that blocker remains.

### E. Tiny QuickJS RAM — native lower bound measured; guest remains blocked

Command: `docker run --rm --platform linux/arm64 -v "$PWD/arch/05-scale-fleet:/work" -v /tmp/jitk-spike/sc/qjs-static:/qjs:ro -w /work python:3.13-alpine python qjs_linux.py`.
8 MiB heap: Proxy/Promise bootstrap **1,228 KiB** peak RSS; 256 KiB JSON
**2,080 KiB**; 1 MiB JSON **4,384 KiB**, all succeed. 4 MiB JSON fails OOM
(exit **1**, **9,120 KiB** peak). At 16 MiB heap, 4 MiB JSON succeeds at
**13,496 KiB** peak. Other 16 MiB cases: **1,288/2,080/4,384 KiB**.
BusyBox time measures qjs, avoiding Python pre-exec RSS contamination. Timing
is heavily scheduled by Docker; no cold-runtime latency inference from it.
Remaining: kernel+ELF+allocator peak, qjs READY, asynchronous console wait,
malicious allocation churn and host overhead under KVM. Keep 64 MiB initial tier.

## 4. What I would cut

Cut KSM, cross-tenant snapshots, per-agent idle VMs, multi-VM VMM processes,
Kubernetes per-VM objects, live migration, generic disk/network devices, and
an immediate memfd loader fork. Start with an immutable embedded image and
hard reservations; implement image mapping only when real PSS warrants it.
Keep direct console queues and single-use lifecycle; postpone snapshot restore.

## 5. Open disagreements with the brief's consensus, with evidence

1. Preboot is a latency optimization, not free scale: the observed replacement
   construction is **47.13/sec** sequentially and finite capacity is **127** here.
   Size spare inventory from arrivals/refill, never from number of LLM sessions.
2. `include_bytes!` does not imply guest page sharing. Stock anonymous mapping
   plus copying the ELF still duplicates it; explicit shared mappings measured
   **39 vs 256 MiB** at process level. Defer snapshots, not the memory accounting.
3. One-VM/process on macOS is now measured HV_BUSY, no longer UNVERIFIED locally.
   Pool refill must leave creation slots: at 127 parked all extra probes fail.
4. No universal “microVM costs less” claim: modeled jitk **$0.644/M** exceeds
   reused Dynamic Workers **$0.502/M**, but unique dynamic snippets **$2,000.50/M**
   have very different economics. Published rates and workload shape matter.
5. Research supports removing initialization/control-plane work, not transferring
   headline figures between guests: [LightVM, SOSP'17](https://orbi.uliege.be/handle/2268/238338)
   reports **2.3 ms** Xen VM boot; [Firecracker, NSDI'20](https://www.usenix.org/conference/nsdi20/presentation/agache)
   demonstrates production microVM isolation; [SEUSS, EuroSys'20](https://www.cs.bu.edu/~jappavoo/Resources/Papers/seuss.pdf)
   shares pristine snapshot ancestry; [Catalyzer, ASPLOS'20](https://ipads.se.sjtu.edu.cn/_media/publications/catalyzer-asplos20.pdf)
   reaches <1 ms in its best checkpoint/restore case;
   [FaaSnap, EuroSys'22](https://www.sysnet.ucsd.edu/~voelker/pubs/faasnap-eurosys22.pdf)
   improves snapshot loading using working-set/paging optimizations, up to 3.5x
   end-to-end improvement. Tiny qjs may not justify their machinery yet.

## 6. Estimated LOC

Production incremental fleet code, **UNVERIFIED estimates**, excluding upstream
VMM, guest kernel, generated bindings, broker policy engine and third-party libs:
~700 pool/reaper/admission; ~450 launcher/cgroup/seccomp integration;
~350 local API/protocol adapter; ~250 metrics/drain/image rollout; ~250 meaningful
integration/stress checks: **~2,000 LOC**. Optional immutable-image mapping patch
~200–400 LOC plus tests. OS sandbox correctness/audit is not priced by LOC.
The supplied experiment/model/state files total 268 source lines; they are
executable evidence/sketches, not a claim of a complete secure fleet implementation.
