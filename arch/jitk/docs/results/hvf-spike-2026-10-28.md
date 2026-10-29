# HVF engine spike: GO (2026-10-28)

Question (R10 change #10, W3.0): can the ring kernel run on macOS through Hypervisor.framework
directly, without libkrun, with the same slot/reset model as the Linux KVM shard?

**Answer: GO.** Corpus `return 2` and `one_tool` pass end to end, repeatedly, in one process, with a
reset between runs. One correctness item stays open before production: reset against a guest kernel
that runs with its caches off (risk 1). The spike is isolated research code; no production path uses it.

## What was built
- `src/hv.rs`: the `Vm` / `Vcpu` / `ArchState` / `Exit` interface from R10 #5, cut down to the spike's needs.
- `src/hvf.rs`: the Hypervisor.framework backend.
  - The doorbell store arrives as a data-abort exit (ISV=1); the engine reads the source register and
    advances the PC past the store, so saved state is always resumable.
  - PSCI CPU_OFF / SYSTEM_OFF arrive as HVC exits.
  - Physical-timer (CNTP) accesses trap without a GIC and are treated as RAZ/WI.
  - Any thread can stop a running vCPU with `hv_vcpus_exit`.
- `src/slot.rs`: hypervisor-neutral slot logic ported from `shard/src/kvm/mod.rs`. It uses the shard
  crate's ring constants, arena classes and payload check, maps the same regions (immutable parts
  read-only on both sides), and resets by copying the writable parts back and restoring registers,
  with an optional byte-and-register verify.
- Snapshot prepared on the Mac by HVF itself, as `prepare.rs` does on Linux. `.mem` has KVM's format;
  the register file is HVF-specific. Kernel built from `payload/qjs-ring` with plain
  `ring-bootstrap.js` (no executor-helper splice).
- `build.sh` builds kernel + engine and signs ad hoc with the hypervisor entitlement. `src/main.rs`
  has `prepare`, `bench`, `mix`, `kick`, `once`, `cold`, `fork`.

## What passed
- Verified benches: after every reset, a byte compare of both writable regions and a full register
  compare against the snapshot.
- `mix`, 180 runs: `return 2`, a tenant that leaves a global, a canary checking for it, `one_tool`, an
  out-of-memory tenant, promise10, json64k. No state leaked across resets. json64k OOM on glue-2m
  matches the KVM driver.
- `kick`, 20 runs: a spinning guest is stopped from another thread in a median 7 µs; the slot then
  resets and serves again.
- No timer or GIC needed: boot to CHECKPOINT is one exit; no run produced a timer exit.

## Numbers (M4 Pro, shared, load 5–11; medians)
| | HVF spike | libkrun (R9 §1c) |
|---|---:|---:|
| warm run, `return 2` / `one_tool` | **33 / 36 µs** CPU | – |
| reset, copy mode (1.39 MiB memcpy 18 µs + ~180 regs 2.2 µs) | **20.5 µs** | – |
| reset, compare mode (copies changed pages only) | 29 µs | – |
| per run in a persistent engine (run + reset) | **~55 µs** | 6.5–7.2 CPU-ms (cold VM per run) |
| cold VM via posix_spawn | 3.1 CPU-ms, 3.9 ms wall | 6.5–7.2 CPU-ms |
| cold VM via fork from a parent holding the snapshot | 0.77 + 0.15 CPU-ms, 1.2 ms wall | – |
| first boot to CHECKPOINT | 2.35 ms wall / 1.28 ms CPU | 1.49 ms to READY |
| memory: base → after 1 run → after 1000 runs | 1.5 → 2.3 → 3.0 MiB (compare) / 4.0 MiB (copy) | 7.97 MiB |
| memory, forked one-VM child | 1.23 MiB | – |

- 29 × 16-KiB pages change per run, about the same bytes as KVM's 75–80 × 4-KiB pages.
- macOS has no `pagemap`; copy-mode reset is cheap enough that dirty tracking isn't needed.
- p99 tails (100–185 µs) are mostly shared-machine noise.

## Mac engine shape
HVF allows one VM per process and runs a vCPU only on its creating thread. So the Mac engine is N
long-lived one-slot processes forked from a single-threaded zygote that has mapped the snapshot but
never created a VM. A fork costs ~0.9 CPU-ms and ~1.2 MiB per engine; process creation leaves the
per-run path.

## Productionization (~4–6 weeks, one engineer)
1. W2.1: split the shard behind the `hv` trait (1–1.5 weeks); KVM's pagemap reset stays KVM-only.
2. HVF backend in the shard crate (~3 days) plus macOS snapshot preparation in `shard/snapshot.ts`.
3. HvfEngine binary and zygote (1.5–2 weeks): IPC loop, leases and kicks, fork server, Seatbelt in the child.
4. Executor integration (3–5 days); then freeze the libkrun engine.
5. Parity corpus on HVF (3–5 days): glue-4m, native-worker images, the input archive.

Deletable afterwards (R10's counts roughly hold): libkrun patches 705 lines; `vmm` source and scripts
~1.2k; protocol v1 code ~1.1k (+4.1 MiB vectors); console-only kernel paths ~730; the 546 MB libkrun cache.

Status 2026-10-28 (HVF is the Mac default): `vmm/` (patches, launcher, sandbox, tests) and
`linux/` (the libkrun-on-Linux nested kit) are deleted. Kept, because they are not libkrun's:
`shard/src/hvf/jitk.sb` (the engine's Seatbelt profile, from `vmm/sandbox`),
`shard/src/watchdog.rs` (the process backends' watchdog, from `vmm/src`), and protocol v1:
`protocol/dispatcher.ts` is also the frame checker of the ring path (`shard-backend.ts`) and the
decoder of Hyperlight's adapter, `protocol/bootstrap.js` is compiled into the console kernel, and
the vectors test that decoder. The console kernel profile stays alive on HVF through
`hvf console` (`shard/src/hvf/console.rs`) for GrowOS, `scriptc-corpus`, the kernel suite and
the protocol VM tests, which need its stdin, path syscalls and inline `\x1e` trace.

Console-only kernel paths for the follow-up (lines today): `src/console.rs` 325,
`src/arch/aarch64/wait.rs` 139, `fdt.rs` 232 + `fdt_checks.rs` 102, `mmu.rs` 155, `boot.S` 35
(988 in files), plus about 120 lines of `not(feature = "transport-ring")` branches in `main.rs`,
`arch/aarch64/mod.rs` (the `mmio` module, `BootInfo`, `boot`, `irq_init`, `system_off`),
`user.rs`, `syscalls.rs`, `memory.rs`, `fs_checks.rs` and `syscalls/{brk,mmap,munmap}.rs`; then
`protocol/bootstrap.js` (134) with `kernel/generate.ts`'s console argv and `build.rs`'s
rerun line, `payload/qjs` (2.4 MB) and `hvf console` itself (~600). Deletable now, without
moving anything: the GIC half of `wait.rs` (`init`'s GICD/GICR programming, `ack`'s ICC loop,
the `TICK == 0` untimed-WFI branch; ~45 lines) and `fdt.rs`'s GIC node parse, since no
launcher runs the console kernel with `jitk.tick_us=0` any more (libkrun did); the FDT's GIC
node and `c.dist/c.redist != 0` check then go together with `console.rs`'s IRQ number.
What removes the rest: GrowOS's trace (`sys.enter/exit/missing` records) as an uncapped
host-visible ring channel instead of console stdout, a ring build with `grow-trace` and `probe`,
kernel regression/fs_diff/grow_contract rewritten against `hvf native-worker` /
`shard/native.ts` (as `check-native-hvf` already compares the native corpus with Linux), and
the protocol VM tests dropped (the ring path has `shard-check.ts`).

## Risks
1. **Reset vs a cache-off guest kernel (open).** In the hostile test, the host's view of guest memory
   missed stores the guest made with caches off. KVM's reset handles this with an explicit clean.
   On this Mac `sys_dcache_flush` over 1.39 MiB returns in ~40 ns, so it is not actually cleaning and
   is not a fix. Only a compromised guest kernel can turn caches off. Fix needs a documented Apple
   guarantee, a real cache-line sweep, or a reset that unmaps and remaps the writable memory. The
   `hostile` check in `main.rs` is unfinished and still fails.
2. **Register coverage is a hand-written list** (35 core, 32 SIMD, SME state, the 107 system registers
   this macOS accepts). HVF can't enumerate registers like KVM; production must refuse to start if
   the list changes.
3. **Stale guest TLB entries after reset** (KVM too). A `tlbi vmalle1` after the CHECKPOINT doorbell
   returns would close it on both; needs a kernel change.
4. **Seatbelt untested.** Ad-hoc signing with the entitlement works; the existing Seatbelt profile
   was not tried.
5. **Contended numbers** (load 5–11).
