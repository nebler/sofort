# 10 — Minimalist critic: choose B, remove its runtime loader

2026-10-24. Read `../BRIEF.md` completely before experimentation.
Evidence labels: **MEASURED** here; **BRIEF** inherited, not independently established;
**PUBLISHED** source result; **UNVERIFIED** hypothesis/estimate/target.

## 1. Concrete design

**Choose B: unmodified static musl qjs at EL0, a fixed-layout Rust kernel at EL1.**
Cut the guest ELF parser: resolve ELF segments at build time and generate a trusted flat
image, permissions, entry point, and auxv metadata. No filesystem image, ELF discovery,
process model, guest scheduler, or general-purpose runtime abstraction.
This is the smallest credible *auditable grow-loop demo using the available artifacts*;
it is not proof that B has fewer eventual lines than a well-built A.

### Decision matrix

Ratings below are engineering judgments, not benchmark scores. Security and the actual
agent-grown-kernel requirement are gates; good latency cannot compensate for failing them.

| Option | Scale | Performance | Simplicity / owned LOC estimate | Security | Growth story | Time to demo |
|---|---|---|---|---|---|---|
| A: embedded engine at EL1 | Potential best; density UNVERIFIED | No syscall crossings; end-to-end UNVERIFIED | Fewest architectural pieces; ~3–6k whole system, plus libc port maintenance | Hardware boundary remains; JS exploit immediately controls guest EL1 | Grow libc ABI/environment support; different oracle | Engine builds; freestanding link/VM execution unfinished |
| **B: fixed-image qjs EL0** | One process/request, bounded RAM; Linux density UNVERIFIED | Brief bare boot 3.3 ms; this run 27.29 ms; qjs-ready unknown | ~4–6k whole system; unmodified engine/libc, no ELF parser in guest | Stage-1 EL0 barrier plus hypervisor and host sandbox | Direct ENOSYS → Linux oracle → kernel change | Shortest path to the specific growth demo; existing qjs works |
| C: Linux/init=qjs + Firecracker snapshots | Mature fleet design; guest Linux memory cost | Published boot ≤125 ms; snapshot workload results below | ~2–4k owned integration; huge maintained dependency | Strong established boundary when jailed correctly | Pruning Linux config is not growing a custom kernel | Fast Linux demo if a KVM host exists; not available here |
| D: in-process qjs / gVisor on macOS | Cheap local tests; says nothing about Linux VM density | Likely cheap invocation, UNVERIFIED here | ~1–2k adapter; second execution/security environment | In-process fails hardware isolation; gVisor needs Linux | Only production would exercise the kernel | Fastest mock, fails complete demonstration |

**Why B despite A's attractive architecture:** removing EL0 does remove real complexity;
it also moves allocation, formatting, time, and ABI maintenance into our port and gives
an engine exploit direct access to every guest device/hypercall. B already has a working
unmodified runtime and an independently enforceable, very small guest privilege boundary.
We should not discard that evidence to obtain a shorter boot diagram. Pure libc functions
can be reused in A; **52 imports versus 15 syscalls does not prove B is simpler or safer**.
A remains the strongest alternative, not a straw man. Switch if an equally hardened A
actually halves total memory or materially beats B on lifecycle throughput.

C is the honest fallback if the product matters more than a custom kernel. It can retain
an agent-minimized *Linux configuration* story, but that does not satisfy this brief's
agent-written kernel story. D is suitable only for trusted fixture tests, explicitly
marked unsandboxed. gVisor is not a native macOS escape hatch: its installation docs
require Linux 5.6+ [S7]. Docker Desktop would introduce a shared Linux VM, not the required
fresh hardware boundary per snippet.

### One invocation, end to end

1. A supervisor opens two inherited pipe ends for one VMM, sets a deadline, and launches
   one sandboxed process. That process has 1 vCPU, fixed RAM, no credentials, no network,
   no host filesystem passthrough, no implicit vsock/TSI, and only the pinned console device.
2. Kernel boots the *trusted prepacked* static qjs, constructs argv/envp/auxv/TLS-compatible
   startup state, enables MMU and EL0 permissions, then enters its original entry point.
   Include program headers needed by musl startup; removing the ELF parser does not remove
   the ELF startup ABI. Code RX, writable memory NX, EL1/device pages inaccessible to EL0.
3. qjs runs `qjs --std /bootstrap.js`. `openat` exposes only exact embedded paths and
   read-only bytes. No directory tree. Bootstrap reads one source message from stdin,
   exposes the generated tool API, drains Promise jobs, emits one result, and exits.
   Tool promises can resolve through a synchronous request/reply primitive; no guest
   scheduler is required. Timer/deadline semantics remain a compatibility test gate.
4. One bounded channel carries tagged source/call/reply/log/result JSON lines. Never
   interpret raw console output as a shell command. Cap frames **before accumulation**,
   source size, call count, response bytes, log bytes, and total wall time. One outstanding
   call initially. A compromised guest may forge any message; the host still validates
   the parsed request against tool schema, invocation identity, allowed resources, and
   policy. Types are developer ergonomics; runtime schema and authorization are the boundary.
5. The credential-bearing broker is outside the VMM sandbox. It derives identity from the
   bound pipe, never a guest-supplied tenant ID. It supplies scoped credentials internally.
   On result, malformed message, quota, exit, or timeout: close channel, destroy VM,
   release process/cgroup resources. Never return it to a reuse pool. Host deadline wins
   even if QuickJS's interrupt handler or the kernel is compromised.

Start without a warm pool. Add a small bounded pool of **never-used** blocked VMs only
if measured cold latency misses the target. Replenishment consumes real CPU and memory:
ready inventory is roughly arrival rate × refill wall time plus a measured burst margin;
maximum throughput also depends on CPU-ms per complete lifecycle. Pool-hit latency alone
is not a scale result. Report misses, refill cost, reaping, and idle memory.

### Keep the actual grow story, remove unsafe theater

A developer supplies a new supported workload fixture; an *offline* build runs it and
records missing syscall number and bounded argument metadata. An agent produces a patch
against a declared support contract. Run Linux oracle cases plus adversarial boundary
cases, rebuild, sign/content-address the image, rerun in a fresh VM. Cache by runtime,
bootstrap, kernel, tool-manifest, and test-suite hashes. Never compile on the user request's
latency path; never let hostile code request an expansion of its authority. Unknown calls
fail closed in production. Build policy constrains the guest; host policy still controls tools.

For A the equivalent loop grows missing **libc/environment services**, diagnosed by link
errors or a deliberate unsupported-service trap, and compares against native musl results.
Pure memcpy/libm should be imported from maintained implementations, not agent-reinvented.
Time, allocator semantics, alignment, errno, locale and FP edge cases need explicit contracts.
The libc-growth narrative is legitimate if described accurately, but it is not ENOSYS/Loupe.

### M0..M4: exact gates and smallest shareable demo

- **M0 — establish the baseline.** Pin sources and reproduce symbols/image layout; run
  qjs code-mode fixture under Linux; measure empty-process, VM shutdown, qjs-ready, and
  result separately. The symbol/image experiments below are done; qjs-ready is not.
- **M1 — one real invocation.** EL0 qjs evaluates `1+1`, then invokes a single typed fake
  `inventory.lookup({sku})` through the host. Destroy VM. Show its unique invocation ID,
  exit, and zero host credentials in guest input. No pool, snapshots, UI framework, or npm SDK.
- **M2 — the 45-second growth video.** Start with `writev` genuinely absent. A real workload
  stops at ENOSYS; the agent writes its implementation, oracle/bounds tests pass, rebuilt
  VM runs the *same* script, combines two tool replies, returns a result, dies. Display actual
  code diff, elapsed **build time**, request time, and image size separately. Do not imply
  the LLM rebuild takes milliseconds. This is the smallest compelling public demo.
- **M3 — prove containment.** Hostile EL0 payload tries EL1 memory, forbidden syscalls,
  malformed iovecs, runaway CPU, log flood, forged tool IDs and denied resource arguments.
  Host and sibling survive; policy blocks before side effects; all VMs are killed/reaped.
  Sandbox the VMM before accepting untrusted public scripts. Validate macOS sandbox + HVF.
- **M4 — Linux go/no-go.** On a named bare-metal KVM host, compare B against jailed
  Linux/qjs snapshots: 10k fresh invocations, concurrency 1/32/256, cold and pool-hit/miss
  paths, equal workload/quotas. Record CPU-ms/invocation, p50/p95/p99 result latency,
  total and incremental PSS, dirty pages, launch/reap rates, and sustained throughput.
  Publish raw samples/configs and the losing backend's result too.

**Proposed kill criteria (targets, not measurements):** stop public exposure on any host
escape/policy bypass or failure to kill a guest within 50 ms of deadline under the tested
load. Stop custom-kernel investment if, after M4 tuning, lifecycle overhead excluding tool
service time has p99 >10 ms at concurrency 32, total incremental memory >32 MiB/invocation,
or lifecycle CPU cost >5 CPU-ms for the tiny fixture on the reference server. These are
product choices to ratify, not physical limits. Stop B specifically if it requires Linux
threads/signals/general filesystem semantics just to support the selected code-mode API.
If C meets the same SLOs within 20% on density and throughput, its maintained Linux guest
wins unless customers demonstrably value custom kernels. If the only visible growth is
replaying prewritten patches, kill the growth claim. No result here establishes these gates.

## 2. Code sketches (real files)

- [`symbols_probe.py`](symbols_probe.py): downloads pinned Bellard release, four object-build
  variants, `llvm-nm` union minus definitions, JSON and full command logs. Does not mistake
  QuickJS cross-object references for libc imports.
- [`embed_probe.c`](embed_probe.c), [`embed_build.py`](embed_build.py): real evaluator using
  Proxy/JSON, no qjs shell or `quickjs-libc`; Linux-musl smoke test and bare link failure.
  This is an A portability probe, not a freestanding runtime implementation.
- [`pack_elf.py`](pack_elf.py): build-time ELF64/AArch64 segment materializer, BSS zeroing,
  static-entry and W^X checks. Produces flat payload and manifest. Sketch: add page-granular
  overlap/permission validation and generated auxv/Rust constants before production use.
- [`broker.mjs`](broker.mjs): bounded single-tool schema/policy/replay/budget gate, credentials
  closed over by host callback; executable adversarial checks. Transport, result schema,
  supervisor/deadline, global quotas, and isolation are intentionally not implemented here.

## 3. BLOCKERS: experiment, command, result

### (a) Can latest Bellard QuickJS compile freestanding? PARTLY ELIMINATED

Latest release linked by Bellard's site when checked: **2026-06-04** [S1], not QuickJS-NG
and not an assertion about unreleased git HEAD. Archive SHA256:
`b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a`.

Command: `python3 arch/10-minimalist-critic/symbols_probe.py`.
Full commands/output: [`symbols-build.log`](symbols-build.log), counts: [`symbols.json`](symbols.json).
Common flags: `-O2 -DNDEBUG -ffreestanding -ffunction-sections -fdata-sections -fno-stack-protector`.

- `zig cc -target aarch64-freestanding -c quickjs.c ...`: **FAIL**, missing `stdlib.h`.
- `zig cc -target aarch64-linux-musl -c ...`: **PASS**, all five engine translation units.
- Copy `quickjs.c`, remove **only** its `CONFIG_ATOMICS` definition. Keep stack checking.
  This is a source patch: pretending it is unmodified QuickJS would be false.
- `clang --target=aarch64-none-elf -nostdinc ... -include malloc.h -c ...`: **PASS** for
  all five engine files, using Zig's musl headers and compiler builtin headers as declarations.
  First attempt without the malloc declaration failed; retained in `symbols-first-attempt.log`.
  This supplies headers, **not a working libc**. Picolibc was not tried.

**MEASURED static import counts** (not a dynamic execution trace):

| Build | External symbols | libc/libm/POSIX functions | Other |
|---|---:|---:|---|
| Stock engine | 62 | 61 | 1 compiler helper, `__udivti3` |
| Single-thread engine, musl target | 53 | **52** | 1 compiler helper |
| Same engine, none-elf target | 53 | **52** | 1 compiler helper |
| Stock qjs shell + quickjs-libc + engine | 151 | 144 | 1 helper + 4 libc data + 2 generated REPL data |
| B code-mode workload (BRIEF) | — | **15 unique Linux syscalls** | plus hidden clock calls |

The 52 functions for A are:
```
abort abs acos acosh asin asinh atan atan2 atanh cbrt ceil cos cosh exp expm1
fabs floor fmax fmin fmod fprintf free gettimeofday hypot localtime_r log log10
log1p log2 lrint malloc malloc_usable_size memchr memcmp memcpy memmove memset
pow realloc round sin sinh snprintf sqrt strchr strcmp strlen strrchr tan tanh
trunc vsnprintf
```
All names and variants have dedicated `*-symbols.txt` files. Many are pure computations,
so 52 is an upper bound on service implementations, not 52 new kernel subsystems.

Command: `python3 arch/10-minimalist-critic/embed_build.py`.
**MEASURED:** none-elf evaluator compiles; `ld.lld --gc-sections -e jitk_eval_probe ...`
fails with **51 live missing symbols: 50 C-library functions + 1 compiler helper**.
`fprintf` and `round` disappear after section GC; a hand shim must still supply real math,
formatting, allocator and time semantics. Full log: [`embed-build.log`](embed-build.log).
The same evaluator linked to Linux musl is **889,336 bytes**, exits **0** inside
`docker run --rm --network=none -v /tmp/jitk-10:/probe:ro alpine:3.22 /probe/embed-musl`.
Thus engine embedding works; **a runnable tiny-libc A guest remains UNVERIFIED**. Microsoft's
Hyperlight example confirms the general approach, but uses modified musl and a QuickJS
patch, not zero libc work or proof of this aarch64 port [S2].

B's “15” is also not a completeness proof: `execve` in strace launches qjs from Linux,
whereas our boot enters qjs directly. vDSO hides time calls; fallback must work without it.
Probe Date, regex, Unicode, BigInt, OOM, recursion, timers, async tool errors and imports.
Unsupported calls must not silently succeed; stub contracts need argument-specific tests.

### (b) Does Linux/snapshot C already solve latency? RESEARCH ELIMINATED; local perf remains open

**PUBLISHED**, not locally measured:
- Firecracker NSDI'20 §5.1: boot measured from VMM fork to init, minimal Linux 4.14.94,
  1 vCPU/256 MB; 500 serial samples. Parallel preconfigured p99 was **146 ms** at 50
  concurrent boots, **153 ms** at 100. Serial logging alone can add up to 70 ms [S3].
- Current specification: **≤125 ms InstanceStart→init**, VMM memory overhead **≤5 MiB**
  for a 1-vCPU/128-MiB tuned guest. That is **VMM overhead**, not total guest footprint.
  API-ready startup is ≤8 **CPU-ms**, typical wall time ~12 ms, range 6–60 ms [S4].
- REAP Fig.7: hello-world snapshot path **232→60 ms total**; working-set fetch **15 ms**.
  The function itself is ~1 ms warm. Average cold-delay improvement **3.7×** [S5].
- FaaSnap Fig.7: hello-world **189 ms Firecracker, 70 ms REAP, 70 ms FaaSnap, 67 ms
  cached**. Includes VM setup + invocation, **cold page cache**, 2-vCPU/2-GB Debian guest
  on c5d.metal. Average 1.4× improvement over REAP; not a qjs microbenchmark [S6].
- Current snapshot docs describe file-backed `MAP_PRIVATE`, lazy page population/COW,
  identity/entropy duplication hazards, compatibility and lifecycle duties [S8]. Loading
  CPU state in milliseconds is not proof of milliseconds until first useful response.

Conclusion: C is technically credible and may do much better with a tiny qjs guest and
warm snapshot files. **Its ≤10-ms full lifecycle is UNVERIFIED**, not disproved by papers
using much larger guests. No FaaSnap/REAP fork or userfaultfd service in our v0.

### Other blockers and attempts

1. **Runtime ELF loader necessary? ELIMINATED for the sampled layout.** Command:
   `python3 arch/10-minimalist-critic/pack_elf.py /tmp/jitk-spike/sc/qjs-static /tmp/jitk-10/packed`.
   **MEASURED:** source 9,688,056 B; two load segments RX/RW; entry `0x400b90`;
   flat extent **2,398,432 B**, including zeroed BSS. Original instructions unchanged.
   This is not proof of working auxv, TLS, MMU or EL0 execution.
2. **Reproduce the 3.3-ms boot floor? NOT ELIMINATED.** Command:
   `python3 arch/10-minimalist-critic/boot_probe.py` (copies the signed host/library/kernel).
   Interleaved n=30/case, one discarded warm-up each, M4 Pro/macOS, concurrent development
   activity uncontrolled. Median/p90: bare **27.29/33.97 ms**; 9.69-MB payload
   **30.37/49.23 ms**; 2.40-MB payload **26.23/44.69 ms**.
   Raw samples: [`boot-measurements.json`](boot-measurements.json). Earlier timeout-enabled
   run is retained separately. Neither run executes qjs. Larger-than-brief wall time could
   involve host contention, process/library startup, instrumentation or another cause;
   **cause UNVERIFIED**. Do not subtract medians and call that a universal copy cost.
3. **Can typed dispatch enforce policy? NARROWLY ELIMINATED.** Command:
   `node arch/10-minimalist-critic/broker.mjs` → PASS for valid request, replay,
   fail-closed state, oversized frame, invalid UTF-8, null, unknown tool, path argument,
   denied policy, and call budget; denied/replayed calls produce no tool side effect.
   This tests the sketch, not a VMM transport or complete security proof.
4. **Linux density/full executor latency? REMAINS.** Command:
   `docker run --rm --network=none alpine:3.22 sh -c 'uname -m
   if test -c /dev/kvm; then echo KVM-present; else echo KVM-absent; fi'`.
   Environment probe reports **aarch64; KVM absent**. Docker is a Linux oracle here, not
   the production KVM benchmark host. M4 cannot be honestly completed on this setup.
5. **Host containment / EL0 isolation / full syscall coverage? REMAIN.** No complete
   executor was built in this critic spike. libkrun sandbox profile + HVF compatibility,
   Linux seccomp/device restriction, pointer validation and unknown-HVC behavior must
   be tested with a deliberately malicious guest. Paper/library reputation cannot waive this.

## 4. What I'd cut

- Guest ELF loader, initrd/cpio, rootfs, shell, general fd table, networking, writable files,
  scheduler, signals, workers, Atomics API promises, dynamic imports outside embedded files.
- Snapshot orchestration, shared rings, multi-VM-per-process and an eager warm pool before
  evidence demands them. Keep VMM failure scoped to one invocation.
- “Pluggable executor backend” framework. One production implementation and an external
  benchmark baseline suffice. A test-only native evaluator does not need a backend abstraction.
- Precompiled arbitrary agent bytecode: evaluate source; only trusted bootstrap may use
  version-pinned bytecode. No claim that bytecode is a safe portable input format.
- A full provenance/IFC research system in v0. Keep origin metadata and explicit resource
  policy; do not claim protection against all prompt injection. Add IFC for a defined policy.
- Bump-only *QuickJS* allocation: repeated reallocations can exhaust the arena despite a
  small live set. Keep musl's allocator; implement bounded virtual-memory behavior honestly.

## 5. Open disagreements with the brief's consensus, with evidence

- **1–1.5k guest LOC is a goal, not an estimate of the whole product.** MMU/EL0 isolation,
  bounds checks, syscall semantics, virtio and ABI startup remain after deleting ELF parsing.
  Excluding generated tables, tests and host enforcement from a headline hides work.
- **No-initrd is right; “9.6-MB QuickJS” is misleading.** Measured load extent is 2.40 MB.
  This supports stripping/build-time packing, not a proven 2.6-ms end-to-end improvement.
- **Do not begin with pooling.** The brief's measurements stop at SYSTEM_OFF, while this
  independent run misses its timing floor by a wide margin. First measure qjs-ready and
  sustainable full lifecycle under load; a pool masks cold cost but cannot eliminate it.
- **EL0/EL1 is useful defense, not the hardware-isolation definition.** A is not automatically
  insecure; Hyperlight demonstrates the library-OS model [S2]. Conversely, EL0 cannot
  repair a host broker that trusts guest tool names/tenant IDs. Both boundaries need tests.
- **ENOSYS coverage is discovery, not correctness.** Static engine footprint and a single
  workload's syscall footprint differ radically. Stubbing successful memory/time behavior
  until one trace passes is not a security or compatibility argument.
- **“The build is the policy” needs qualification.** Every variant still permits agent code
  to submit tool requests. Per-call host policy remains indispensable; generated kernels
  must never gain authority merely because hostile input discovers a missing operation.

## 6. Estimated LOC for the whole system

**UNVERIFIED implementation estimates**, nonblank owned source, excluding vendored code:
B guest boot/MMU/traps/startup 500–800; bounded memory/syscall shim 500–800;
virtio-console 250–450: **1,250–2,050 guest**. Host VMM launcher/sandbox/reaper
400–650; broker/quotas/protocol 350–600; JS bootstrap + typed adapter 200–350;
packer/growth runner/oracle tooling 350–550; meaningful tests/fuzz harnesses 900–1,500.
**Whole owned B system: ~3,450–5,700 LOC (budget 4–6k), not 1.5k.**
A deletes much of guest MMU/syscall code but adds libc-environment porting and its tests;
~3–6k owned overall. C ~2–4k owned; D ~1–2k test adapter, excluding a production backend.
These estimates are not results of implementing those systems.

**MEASURED dependency honesty:** five QuickJS engine `.c` files alone total **69,030
physical lines** in this release, excluding headers/tables. Both A and B inherit that C
attack surface; B also ships musl. Neither “Rust kernel” nor a tiny owned-LOC figure means
memory-safe end to end. Hypervisor/VMM, host OS and dependencies must appear in the SBOM;
no total TCB LOC number has been measured here.

Sources (accessed 2026-10-24):
- [S1: Bellard release/source](https://bellard.org/quickjs/).
- [S2: Microsoft QuickJS/Hyperlight C guest example](https://opensource.microsoft.com/blog/2025/03/10/build-a-hyperlight-c-guest-to-securely-execute-javascript/).
- [S3: Firecracker, NSDI'20, §5.1](https://www.usenix.org/system/files/nsdi20-paper-agache.pdf).
- [S4: current Firecracker specification](https://github.com/firecracker-microvm/firecracker/blob/main/SPECIFICATION.md).
- [S5: REAP, ASPLOS'21, §6.2/Fig.7](https://arxiv.org/pdf/2101.09355).
- [S6: FaaSnap, EuroSys'22, §6.2/Fig.7](https://faculty.washington.edu/wlloyd/courses/tcss591/papers/FaaSnap-FaaSMadeFastUsingSnapshot-basedVMs.pdf).
- [S7: gVisor installation requirements](https://gvisor.dev/docs/user_guide/install/).
- [S8: current Firecracker snapshot documentation](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md).
