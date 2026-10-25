# 02 — Guest kernel: retain EL0/EL1; cold boot works, parking does not yet

Read `../BRIEF.md` in full. This directory contains an executable spike, not a
production security claim. No external Rust crates. All experiment outputs are
local files; `/tmp/jitk-spike` was only read. Temporary builds use `/tmp/jitk-02`.

## 1. Concrete design

**Decision: one EL0 process, one EL1 kernel, one vCPU, fixed RAM, no scheduler.**
The implementation already boots under libkrun/HVF, loads embedded static musl
qjs, runs `print("hi")`, takes Linux AArch64 syscalls, and powers off. It also
completes the brief's simulated two-call code-mode exchange over the same console.

### Components and interfaces

- `boot.S` preserves FDT x0, masks exceptions, enables FP/SIMD, clears BSS,
  establishes a 64 KiB EL1 stack, and calls `kernel_main(fdt: usize) -> !`.
  Kernel link/entry is `0x80000000`. A conditional EL2-to-EL1 path is present;
  **UNVERIFIED** with nested virtualization enabled. Tested hosts use default
  nested virtualization disabled. See `src/boot.S:3`, `link.ld:3`.
- `mmu.rs`: 4 KiB pages, 39-bit TTBR0 address space, TTBR1 walks disabled;
  Normal WB RAM and Device-nGnRE MMIO. Kernel identity mapping covers 64 MiB:
  text RO/X, rodata RO/NX, writable data NX, all EL0-inaccessible. The kernel
  stack has an unmapped lower guard. Low user text is EL0 RX and EL1 PXN;
  user data/stack/heap are RW/NX. After ELF loading, the kernel's physical alias
  of user text also becomes RO/NX: no writable alias of executable user memory.
  PAN is enabled on entry to EL0; syscall copies use checked physical aliases,
  never raw user virtual pointers. See `src/mmu.rs:23`, `:53`, `:95` and
  `src/user.rs:139`. Require FEAT_PAN hardware (Armv8.1+); runtime capability
  detection remains **UNVERIFIED/not implemented**.
- Memory contract: kernel PA `0x80000000`; user VA `[0x400000,0x2400000)` maps
  to PA `0x81000000 + VA - 0x400000`. qjs PT_LOAD addresses are unchanged.
  `brk` is `[0x680000,0x800000]` (1.5 MiB); anonymous mmap arena is
  `[0x800000,0x1e00000)` (22 MiB); user stack is 128 KiB ending at `0x2000000`.
  FDT is `0x83e00000` in the tested 64 MiB libkrun configuration. Production
  density at a smaller RAM limit is **UNVERIFIED**; do not treat 64 MiB as RSS.
- ELF loader accepts the **trusted, embedded** ELF64 little-endian AArch64
  ET_EXEC, checks PT_LOAD bounds/flags, zeroes BSS, copies segments, and rejects
  W+X. No dynamic linker, ET_DYN, relocator, initrd or filesystem. Program header
  VA is derived from the load segment containing the header table, not assumed
  equal to a file offset. Entry `0x400b90`; 5 headers, 56 bytes each, two LOADs.
  Source: `src/user.rs:27`; reproduce with `llvm-readelf -hl qjs-stripped`.
- Initial SP is 16-byte aligned and contains argc/argv/envp plus `AT_PHDR`,
  `AT_PHENT`, `AT_PHNUM`, `AT_PAGESZ=4096`, `AT_ENTRY`, UID/EUID/GID/EGID,
  `AT_SECURE=0`, `AT_RANDOM`, `AT_NULL`. No vDSO. The test argv is
  `qjs --std -e <code>`; env is `PATH=/`. Host `arc4random_buf` generates 16 fresh
  bytes per VM, passed as `jitk.seed=<hex>` in FDT bootargs, copied to the user
  stack. QEMU's seed is deliberately fixed for debugging. `host.c:14`,
  `src/fdt.rs:2`, `src/user.rs:75`.
- `vectors.S`: 2 KiB-aligned 16-entry vector table; one common fatal/SVC entry.
  The 800-byte trap frame saves x0–x30, ELR/SPSR, q0–q31, FPCR/FPSR. Restore and
  `eret` preserve user state. IRQ/FIQ remain masked. A non-SVC exception logs
  ESR/FAR/PC and exits; no signals or fault recovery. `src/vectors.S:1`.
- Dispatch is a numeric `match` whitelist, not arbitrary function-pointer indexing.
  x8 selects the syscall; x0–x5 are arguments, x0 is result or negative errno.
  `access()` checks overflow, range and every page's permissions before any copy;
  unaligned iovec/timespec accesses use unaligned operations. One vCPU and no
  user execution during a syscall avoid user mutation during validation/copy.
  Production differential/fuzz validation is still **UNVERIFIED**.
- Implemented/restricted syscall IDs: getcwd 17, ioctl 29, openat 56, close 57,
  lseek 62, read 63, write 64, readv 65, writev 66, readlinkat 78, exit 93,
  exit_group 94, set_tid_address 96, clock_gettime 113, brk 214, munmap 215,
  mmap 222. Unknown calls print `ENOSYS nr=...` and return -38. `execve` is
  unnecessary: the kernel directly creates the initial process. openat always
  returns ENOENT; readlinkat EINVAL; ioctl ENOTTY; lseek ESPIPE. No path reaches
  a host filesystem. These are workload-specific semantics, not complete Linux.
- mmap only accepts anonymous RW mappings with no requested address or MAP_FIXED;
  no executable allocation. It bumps and zeroes pages. munmap revokes PTEs but
  does not recycle physical memory. brk tracks a bounded arena. Repeated
  allocation/free can exhaust the arena; production peak coverage **UNVERIFIED**.
- `console.rs`: probes `0x0a000000+n*0x200`, n=0..31, for magic and DeviceID 3.
  Tested libkrun console base is `0x0a002000`; QEMU's is `0x0a003e00`.
  Modern virtio VERSION_1 + MULTIPORT, four split queues, queue size 8,
  kernel-owned 1 KiB bounce buffers, one outstanding descriptor per queue,
  barriers and volatile ring accesses. Data RX/TX are polled, no IRQ controller.
  One explicitly configured bidirectional host port avoids tty-dependent device
  layout. `host.c:12`, `src/console.rs:48`, `:89`, `:144`.
- **HVF-specific critical rule:** MMIO accessors must emit simple non-writeback
  `ldr wN,[xM]` / `str wN,[xM]`. Rust volatile alone permitted a pre-indexed
  load and failed here. `src/console.rs:22` and `:27` pin the instruction form.
- Shutdown is `hvc #0` with x0 `0x84000008` (PSCI SYSTEM_OFF), issued only at
  EL1. User HVC traps into the kernel. Faults currently exit the VMM with status
  0 too: production must distinguish structured completion from fatal records.
  `src/main.rs:41`; libkrun `src/hvf/src/lib.rs:639`.

Virtio protocol reference: [OASIS Virtio 1.2, console §5.3](https://docs.oasis-open.org/virtio/virtio/v1.2/virtio-v1.2.html).
The fixed-port spike sends READY/OPEN directly and does not fully drain/repost
control RX. A compliant control state machine and EOF handling remain required.

### Exact dependencies / reproducibility

- Rust **1.95.0**, rustc `59807616e`; target `aarch64-unknown-none`; compiler's
  matching `core`/compiler_builtins only. `Cargo.lock` has only jitk-02 0.1.0.
  No allocator crate, libc crate, ELF crate, virtio crate, runtime or scheduler.
- libkrun **a1d8616765da03980f3be1bb8714bfdd3842f33c**, dylib **2.0.0**;
  copy/adapted `boot/host.c`, linked against the existing build, ad-hoc signed
  with `examples/chroot_vm.entitlements`. No original spike files modified.
- QuickJS **2026-06-04**, verified by running the supplied binary's `--help` in
  Alpine 3.22. Original static ELF: **9,688,056 bytes**; stripped: **2,394,360**.
  Exact musl build version **UNVERIFIED**; pin artifact SHA rather than invent it.
  Original SHA256 `d87997d1e249c8dd15e6b7a2f9a8c4932612a023a17b8b2d21e8359739a580e9`;
  stripped SHA256 `ea2367e9dfc7484b6ad6d551b0bbc25d0247e2781f49ad822fa04c2753f80341`.
- Apple clang **21.0.0**, Homebrew LLVM **22.1.8** tools, QEMU **11.1.2**. No Zig
  or Docker packages were needed to build the kernel; Docker only ran the oracle.

## 2. Code sketches — compiled executable files

`src/{boot.S,main.rs,mmu.rs,vectors.S,user.rs,console.rs,fdt.rs}`, `link.ld`,
`Cargo.toml`, `Cargo.lock`, `host.c`, `build.sh`, `qemu.sh`, `qemu-shim.S`.
All paths below are relative to this directory:

```sh
rustup +1.95.0 target add aarch64-unknown-none
sh build.sh                              # hello-only guest
sh build.sh --features qjs               # embedded qjs prints hi
/tmp/jitk-02/host /tmp/jitk-02/kernel.bin
sh build.sh --features qjs,trace         # log every syscall number
python3 exchange.py                     # sequential JSON requests/replies + idle CPU
python3 run-probes.py                   # hostile EL0 / kernel-alias probes
sh build.sh --features qjs               # restore default payload after experiments
sh qemu.sh setup                        # generated DTB + 12-byte handoff shim
sh qemu.sh                              # TCG; same kernel.bin
QEMU_ACCEL=hvf QEMU_CPU=host sh qemu.sh
sh qemu.sh -S -gdb tcp:127.0.0.1:12355
```

`JITK_SCRIPT` is a compile-time test expression, not a production code-delivery
interface. The runtime protocol should load code from fd0 into an immutable
bootstrap once the host supplies it. That complete bootstrap is **UNVERIFIED**.

## 3. BLOCKERS — experiments, results, and remaining work

### A. Rust + libkrun boot + virtio hello: ELIMINATED

Command: `sh build.sh; python3 bench.py hello-only > bench-hello.json`.
**PASS**, n=30: whole spawn→hello→PSCI→reap median **6.488 ms**, p90 **6.819 ms**;
time to a complete hello line median **5.889 ms**, p90 **6.214 ms**.
All 30 printed `hello jitk fdt=0000000083e00000` and exited 0.

Initial experiment **FAIL**: a `read_volatile::<u32>` probe compiled to
`ldr w12,[x11,#-8]!`; HVF logged ESR **2449473542 = 0x92000006**, ISV=0,
SAS=0, len=1, and `invalid virtio mmio read: 0x0:0x1` at `0x0a002000`.
Changing only to explicit non-writeback MMIO instructions eliminated the failure.
Backend evidence: libkrun `src/hvf/src/lib.rs:718` computes SAS and register
unconditionally despite ISV=0. The architectural exclusion of writeback loads
from valid syndromes is documented in [Arm's ESR_EL2 correction](https://documentation-service.arm.com/static/69aac74fe79f9a1d642aa91f?token=), §2.20.

### B. Embedded qjs + EL0 + syscalls: ELIMINATED for tested workloads

Commands: `sh build.sh --features qjs,trace`; run host; `python3 exchange.py`.
**PASS** `hi` and exit 0. The hello trace reaches syscall numbers
96, 214, 222, **113** (no vDSO), 215, 29, 66, 94; no ENOSYS.
`codemode.log` preserves the longer trace, including getcwd/readlinkat/read.
**PASS** actual sequential exchanges: only after each outbound JSON call does
`exchange.py` write its reply; two requests end with `{"count":1}` (`exchange.log`).
The script only removes its `import std` declaration because `--std` supplies it.
No external service was contacted; these are simulated tool replies.

Command: `sh build.sh --features qjs; python3 bench.py > bench-libkrun.json`.
**PASS**, n=30, tracing disabled: whole process median **8.958 ms**, p90 **9.742 ms**;
hello-line median **6.950 ms**, p90 **7.501 ms**. Raw samples retain all outliers:
max whole-process **194.912 ms**. Other engineers were concurrently benchmarking;
no idle-machine claim and no warmup/outlier exclusion. This includes spawn,
libkrun, ELF copy, qjs initialization, output, shutdown and reaping—not only boot.

### C. Same kernel in QEMU + debugger: ELIMINATED; faster wall time: REJECTED

Commands: `sh qemu.sh setup; python3 bench.py sh qemu.sh`; repeat with
`QEMU_ACCEL=hvf QEMU_CPU=host`. **PASS**, n=30 each: TCG whole-process median
**80.873 ms**, p90 **88.434 ms**; HVF median **46.062 ms**, p90 **49.019 ms**.
QEMU is useful for debugging, but slower than libkrun in this experiment.

Direct `-kernel <ELF>` initially printed hello with x0=0; it bypassed a normal
Linux/FDT handoff. The checked-in 12-byte shim supplies x0 and jumps to the
**same raw kernel**. QEMU RAM starts at `0x40000000`; use 1152 MiB so the
libkrun-linked kernel and its 64 MiB window at `0x80000000` lie in RAM. The
shim is at `0x41000000`, DTB at `0x83e00000`. No kernel relocation or PL011 path.
The large QEMU RAM reservation is a dev accommodation, not a production target.

**PASS GDB remote:** `lldb -b /tmp/jitk-02/target/aarch64-unknown-none/release/jitk-02`
with `gdb-remote 127.0.0.1:12355`, `breakpoint set -n kernel_main`, `continue`.
PC stopped at the shim then at `kernel_main` (`gdb.log`). A GNU gdb executable
was absent; LLDB successfully used QEMU's GDB protocol. Source stepping quality
with optimized code/debug info is **UNVERIFIED**.

### D. EL0 boundary and physical W^X: tested, not a security proof

Command: `python3 run-probes.py`; expected ESR/FAR/exit assertions are in the
runner, actual outputs in `probe-results.json`. **PASS**: user kernel write,
user text write, heap execution, privileged SCTLR write, EL0 HVC, kernel-pointer
write syscall, PAN read, privileged writable-alias attempt, unknown syscall.
Fault evidence includes `0x9200004f` (user permission), `0x8200000f` (execute),
`0x9600000f` (PAN); bad syscall pointer returns EFAULT, unknown syscall ENOSYS.
Faulting tests stop through PSCI and therefore have VMM status 0; the assertion
checks the fault record, not just that status. Production isolation/audit remains
**UNVERIFIED** beyond these focused tests.

### E. Cheap prebooted waiting: REMAINS; attempted elimination failed

Command: `python3 exchange.py`; after READY, withhold stdin for one second.
**FAIL scale**, `idle-cpu.json`: **1.013143 CPU-s** for **1.007361 s** idle,
about **1.006 cores per VM** including small startup/teardown costs.

Experiment: build with `--features qjs,wfe`, replacing only RX spin with WFE.
One delayed response **PASS**: **0.151924 CPU-s / 1.057875 s** total
(`wfe-result.json`). This is not enough: a subsequent 100-exchange stress
**FAIL**, stalled after **1 reply**, 3 s timeout (`wfe-stress.json`).
Do not enable this feature in production. Need a race-free wake/parking design
and GIC/timer support or a coordinated VMM wait primitive. No unsupported PSCI
call was attempted. libkrun wait logic: `src/hvf/src/lib.rs:808` and
`src/libkrun/src/vmm/macos/vstate.rs:531`. Cold-boot operation is available now.

### F. Linux semantics, clocks, EOF and exhaustion: REMAIN / bounded spike

- `clock_gettime(REALTIME)` currently returns a counter-derived duration, not
  Unix epoch; Date.now therefore has the wrong origin. Experiment and numeric
  comparison: `clock-oom.json`: guest **8,710,917 ms** versus host
  **1,792,800,508,846–1,792,800,509,823 ms**. **FAIL correctness**. Proposed fix: explicit host
  wall-clock/counter calibration in the boot contract; portable implementation
  and error bound **UNVERIFIED**. Monotonic counter reads do run (113 in trace).
- `clock-oom.json` also attempts a **64 MiB ArrayBuffer** against the 22 MiB
  mmap arena: **PASS**, caught `InternalError: out of memory`, then exit 0.
  Memory recycling is deliberately absent;
  broad peak-memory and fragmentation tests remain **UNVERIFIED**.
- RX has no EOF notification and control RX is not drained/reposted. Inspection
  `src/console.rs:81`, `:144` exposes the missing state; all exercised input was
  nonempty. **FAIL completeness**; add a small fixed-port control state machine
  and differential EOF/partial-read tests before shipping.
- close does not track descriptor state, brk shrink is simplified, clock IDs and
  mmap flags are restricted. These are explicit oracle targets. This spike does
  not establish full coverage of the brief's 15-syscall workload set, adversarial
  argument combinations, malformed embedded ELFs, or arbitrary JS programs.

## 4. What I would cut

Cut EL1-only execution; generic Linux compatibility; execve; dynamic ELF/PIE;
initrd/cpio; real files; multiple processes; signals; threads; hotplug; general
port discovery; async console; IRQ infrastructure until measured parking needs
it; memory recycling until measured workloads require it; snapshotting.
Keep fresh AT_RANDOM, checked copies, W^X **including aliases**, PAN, bounds,
privilege separation, fatal-exception records, and the host execution watchdog.

## 5. Open disagreements with the brief's consensus

1. **Do not scale a prebooted pool with a purely polled input path.** The idle
   CPU measurement and WFE lost-wakeup test contradict the assumption that
   waiting initialized VMs are cheap. Propose cold boots or a strictly bounded
   warm pool until a measured parking implementation exists.
2. **A stripped embed still occupies two copies when loaded this way.** Strip
   alone cuts **7,293,696 bytes (75.29%)** from the original file; our loader then
   copies PT_LOAD data into user RAM. Claiming initrd removal eliminates all
   guest copies is false for this code (`src/user.rs:55`). Mapping embedded ELF
   pages directly could reduce copies but segment alignment/lifetime/W^X proof
   is **UNVERIFIED**; defer it until density measurements justify it.
3. **The 15 strace names are not an exact kernel ABI specification.** execve is
   host/oracle startup here; clock_gettime is required without a vDSO. The -e
   and two-call paths succeeded with a smaller observed subset. Grow from exact
   argv/input traces and argument semantics, not merely a syscall name count.
4. **Use an explicit port, not add_default_console.** In this revision non-tty
   stdin/out/err create extra named ports (libkrun
   `src/libkrun/src/api/device_builders.rs:941`), while one generic port gives
   exactly four queues. libkrun MMIO device allocation uses **0x1000** slots,
   not QEMU's 0x200 stride (`src/libkrun/src/vmm/device_manager/kvm/mmio.rs:78`);
   probing every 0x200 still finds both. Prefer FDT discovery if topology grows.
5. **Keep EL0/EL1 despite the LOC target.** The whole formatted guest is about
   900 physical lines, including vectors, copying, FDT, allocator and driver.
   All user-map helpers occupy only **57 lines** (`mmu.rs:52` through EOF), with
   range validation another **16 lines** (`user.rs:139`). These are measured
   code regions, not a claim that deleting them yields a working EL1 kernel.
   Even deleting the entire 108-line MMU module saves little against losing
   privilege containment. EL1 qjs could disable MMU/PAN or issue HVC directly;
   the SCTLR/HVC probes demonstrate precisely what EL0 now prevents. A working
   EL1-only LOC/performance comparison was **UNVERIFIED/not built**.

## 6. Estimated LOC

Measured formatted source: **901 physical guest lines** (`wc -l src/*`), including
35 boot assembly, 120 vector assembly, 108 MMU, 359 loader/syscalls, 169 console,
62 FDT, 48 entry/panic. Host C is 29 lines; linker script 14. Physical counts
include blanks and comments, not generated binary payloads. Final raw image:
**2,408,464 bytes**; ELF text/data/BSS are recorded in `size.json`.
Timing samples preceded the final eight FPCR/FPSR save/restore instructions and
probe-only alias test; `size.json` retains both benchmark and final image hashes.

**UNVERIFIED production estimate: 1,250–1,550 guest LOC**, allowing ~150 for
console control/EOF, ~100 for accurate clock/boot-contract handling and ABI
repairs, ~100–200 for reliable parking/GIC support. Differential tests and host
policy are additional. Keep the 1–1.5k target as a constraint to measure, not a
reason to drop EL0 or call the prototype production-safe.
