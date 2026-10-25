# jitk — shared design brief (read fully before working)

## What we're building
A runtime for **code-mode agents**: an LLM writes a JS snippet against a typed tool API
(Cloudflare `@cloudflare/codemode` style); we run that snippet in a **fresh, single-use,
hardware-isolated microVM** whose ONLY I/O is a tool-call channel to a trusted host. The host
holds credentials and checks policy on every call. "The build is the policy."

The guest is a **tiny custom kernel (Rust, no_std, aarch64 first)** that runs an unmodified
**static musl QuickJS** (`qjs`). The kernel implements only the Linux syscalls QuickJS actually
uses. Story/differentiator: the kernel is **grown just-in-time by an agent** — run program,
hit ENOSYS, agent implements that syscall, verified differentially against a Linux strace
oracle (Docker), rebuild. Prior art for this loop: Loupe (ASPLOS'24).

## Priorities (in order)
1. **Scale** — many concurrent executions per host, fleet-friendly (Linux/KVM in prod, macOS/HVF dev).
2. **Performance** — cold-to-result latency, density (MB/VM), throughput.
3. **Simplicity** — smallest correct thing; every line must justify itself. Target guest kernel ~1–1.5k LOC.
Security is a hard requirement, not a priority to trade away.

## Verified facts (spikes we ran, 2026-10-24, M4 Pro, macOS 26.6.1)
- QuickJS (bellard, static musl aarch64) code-mode script = **15 unique syscalls**:
  brk close execve exit_group getcwd ioctl lseek mmap munmap openat read readlinkat readv
  set_tid_address writev (+ clock_gettime, hidden by vDSO under strace). Stubs OK:
  ioctl(TIOCGWINSZ)->ENOTTY, readlinkat->EINVAL, getcwd->"/".
- **libkrun + HVF boot**: whole process (create VM → boot → PSCI SYSTEM_OFF → exit), n=30:
  bare kernel median **3.3 ms** (p90 3.8); with 9.6 MB qjs initrd **5.9 ms**. QEMU+HVF 18.5 ms.
- libkrun (main @ a1d8616) builds on macOS with Rust 1.95.0 (`RUSTUP_TOOLCHAIN=1.95.0`), needs
  rustfmt. Host binary needs `com.apple.security.hypervisor` entitlement (ad-hoc codesign with
  `$L/examples/chroot_vm.entitlements`).
- libkrun aarch64 guest: RAM + kernel load at **0x80000000**, **no PL011**, guest I/O =
  **virtio-console over virtio-mmio @ 0x0a000000+**, FDT address passed in **x0** (verified
  src/hvf/src/lib.rs:555). PSCI SYSTEM_OFF (0x84000008 via hvc) handled; **unknown PSCI → panic!
  in VMM** (guest can crash its own VMM). Kernel formats ELF/RAW/Image. New builder API:
  KrunVmmBuilder, krun_payload_load_external, console builder add_default_console / add_inout_port.
- `zig cc -target aarch64-linux-musl -static` builds guests on macOS. `clang --target=aarch64-none-elf`
  + ld.lld builds bare-metal. Docker Desktop is running (linux/arm64 containers work).
- `@cloudflare/codemode` 0.5.5 (MIT): `Executor.execute(code, ResolvedProvider[]) -> Promise<{result, error?, logs?}>`,
  `ResolvedProvider = {name, fns, prelude?}`. Sandbox side needs console.*, setTimeout, Promise, Proxy.
  TanStack AI `IsolateDriver.createContext({bindings,timeout,memoryLimit}) -> {execute, dispose}`.
- Competitor/fallback: Microsoft **Hyperlight** supports macOS aarch64 (v0.17.0); **hyperlight-js**
  (QuickJS-in-Hyperlight, ~1–2 ms claimed) npm `@hyperlight-dev/js-host-api` 0.4.0 published only for
  linux-x64/win32-x64. **hyperlight-sandbox** lists a "Code Mode" use case.

## Prior review consensus (to challenge or build on)
- Perf: pool of **pre-booted single-use VMs** (boot+init qjs, block waiting for code, run once, destroy);
  strip qjs + embed (`include_bytes!`) instead of initrd copy (initrd ≈ 2.6 ms of 5.9); async reap;
  precompile bootstrap to QuickJS bytecode; batch tool calls. Defer snapshots/shared-mem rings.
  On macOS HVF likely **one VM per process** (UNVERIFIED — blocker).
- Security: libkrun has **no seccomp** → sandbox the VMM (Linux: seccomp/Landlock/empty netns/UID/cgroups;
  macOS: sandbox profile — UNVERIFIED that it coexists with hypervisor entitlement). Pin devices, disable
  implicit TSI/vsock. Hostile-input JSON dispatcher (caps, strict schema, budgets, kill on violation).
  Per-call host policy + provenance labels (CaMeL/FIDES); scoped short-lived creds. Wall-clock SIGKILL,
  1 vCPU, RAM cap. Keep EL0/EL1 split (QuickJS CVEs + hypervisor escapes need guest EL1).
- Simplicity: no initrd/cpio, one console port (tagged JSON lines), no scheduler/threads/signals/fs,
  bump allocator for brk/mmap, stub per Loupe. Pluggable executor backend: hyperlight-js | jitk.

## Proposed shape (v0, to be attacked)
```
HOST  harness → MicroVMExecutor (TS) ── pool ──> jitk-vmm (Rust + libkrun), sandboxed
        strict JSON-lines dispatcher, per-call policy, scoped creds, trace
GUEST EL0: qjs (stripped, embedded) + bootstrap bytecode
      EL1: jitk (Rust no_std): boot, MMU, traps, ELF loader, ~16 syscalls, virtio-console
DEV   grow loop: ENOSYS → strace oracle (Docker) → agent implements → differential test → rebuild
```

## Artifacts on disk (READ-ONLY; copy if you need to modify)
- `/tmp/jitk-spike/libkrun` — built libkrun (target/release/libkrun.2.0.0.dylib, include/)
- `/tmp/jitk-spike/boot/` — host.c (minimal libkrun host), kk.S/linkk.ld (bare kernel @0x80000000), signed `host`
- `/tmp/jitk-spike/sc/qjs-static` — static aarch64 musl qjs; codemode.js protocol sim
- `<scratch>/spike/RESULTS.md` — spike summary
