# Architecture boundary (core vs `src/arch/<arch>/`)

The kernel is an architecture-neutral core plus one directory per ISA. Today
there is one: `src/arch/aarch64/`. An x86_64 port is a new `src/arch/x86_64/`
that implements the items below. It also adds a few mount lines in `main.rs`/`fs.rs`
and one number table. No core file needs editing, with one exception noted under
"Linux ABI data". `arch-lint` (see the end of this file) keeps it that way.

This was a refactor with no behaviour change. All eight image variants
(default, grow-trace, trace, trace+grow-trace, ring glue-2m/4m, ring native
2m/4m) are byte-identical to `f3f14f0f`. The default image is still
`e3d774eb…` (`.READY`). The unused `trace` feature was deleted later (R12).

## What is core

- `syscalls.rs` (checked copyin/copyout, mmap arena helpers, poll/park
  wrappers), the generated dispatcher, and all `syscalls/*.rs` handlers.
- `fs.rs`: archive and descriptor table. `trace.rs`: grow-trace v2 records.
- `user.rs`: user image mapping, the Linux initial stack (argv, envp, auxv),
  the user pointer check `access`, stdout framing, and `syscall_entry!` (the
  core half of the syscall trap).
- `console.rs`: virtio-mmio console protocol. `ring.rs`, `abi` (the
  `../abi` crate's `src/lib.rs`, mounted by `#[path]` so the image stays
  byte-identical; `mmu_ring.rs` defines the linker's `__ring_arena` from it),
  `wait_ring.rs`: ring transport, its control-page clock, and the WAIT doorbell
  protocol.
- `memory.rs`: the user virtual layout. Physical placement is re-exported from arch.
- `main.rs`: boot order, panic, `off()`.

## The interface an arch implements

| Item | aarch64 implementation | Used by |
|---|---|---|
| `_start` → `kernel_main(boot_arg)` | `boot.S` / `boot-ring.S`: EL2→EL1 drop, FP enable, stack, BSS | `main.rs` |
| `link.ld` | `src/arch/aarch64/link.ld`. `build.rs` selects `src/arch/$CARGO_CFG_TARGET_ARCH/` | build |
| `arch::boot(arg, \|info\| …)` and `BootInfo::{seed, epoch_offset, console, console_irq}` | counter at entry, `mmu::init`, FDT parse; epoch from the paired counter | `kernel_main` (default build) |
| `arch::irq_init(&BootInfo)` | GICv3 distributor/redistributor plus the console SPI, or the timer-only fallback | `kernel_main` |
| `crate::mmu::{init, map, unmap, valid, physical, flush, readonly, protect_aliases}`, ring: `heap_limit, mmap_limit` | `mmu.rs` (default) and `mmu_ring.rs` (ring arena): 4 KiB stage-1, AP/UXN/PXN, TLBI | `user.rs`, `syscalls.rs`, brk/mmap/munmap, `fs.rs` |
| `crate::wait::{now_ns, park, park_for, init, ticks, ticks_ns}` (default build) | `wait.rs`: CNTVCT/CNTFRQ, CNTV one-shot plus WFI, GIC ack. The park policy (ack → `console::service` → recheck → sleep) is inside it | console, ppoll, `syscalls::now_ns` |
| `crate::fdt` | the boot-info parser for this platform (FDT) | `arch::boot` only |
| trap entry → `crate::user::syscall_entry!(frame)` and `arch::frame::{WORDS, NR, ARGS, RET, PC}` | `vectors.S` saves x0–x30, ELR, SPSR, SIMD; `trap.rs` checks ESR (SVC64), reports other faults, clears PAN on the ring path | `user.rs` |
| `arch::enter_user(sp, entry) -> !` | VBAR, SP_EL0, ELR, SPSR=EL0t, PAN set, `eret` | `user::run` |
| `arch::sync_icache(start, end)` | DC CVAU per line plus IC IALLU over the kernel alias | `user::run`, ring checkpoint |
| `arch::mmio::{read32, write32, barrier}` | LDR/STR to Device-nGnRE memory; DMB SY | `console.rs` |
| `arch::doorbell(op)` (ring) | DMB ISHST then STR to `DOORBELL_GPA` | `ring.rs`, `wait_ring.rs`, `off()` |
| `arch::system_off()` | PSCI SYSTEM_OFF (HVC) | `off()` |
| `arch::{RAM_GPA, PACKED_GPA}` | 0x80000000, 0x80080000 (libkrun aarch64 RAM map) | `memory.rs`, mmu |
| `src/arch/<arch>/syscalls.json` | Linux syscall name → number (`null` = absent on this arch) | generator → dispatch, `syscalls::nr`, manifest, GrowOS |
| `fs::stat_abi` (`src/arch/<arch>/stat.rs`) | asm-generic 128-byte `struct stat` | `fs::stat` → fstat/newfstatat |

The packed-payload `.incbin` lives in `arch/mod.rs`. It uses assembler syntax
but no ISA-specific code, so every architecture shares it.

### Crate-root mounts

`crate::mmu`, `crate::wait` and `crate::fdt` are arch files mounted at the crate
root by `cfg_attr(target_arch = …, path = "arch/<arch>/…")` in `main.rs`. They
are not mounted under `crate::arch::`. There are two reasons:

1. rustc lays out non-inlined functions in mangled-path order. Moving
   `mmu::init` or `fdt::read` under `arch::aarch64::` reorders `.text`. `.text`
   is only 0x20 bytes below a page boundary, so the image relinks.
2. Pinned host harnesses (`grow/host-tests.rs`, with its hash checked through
   `host-tests-origin.json`, `tests/fixtures/fs-harness.rs` and `build-checks.ts`)
   compile `fs.rs` against stub `crate::mmu`/`crate::user`/`crate::syscalls`.
   For the same reason the stat encoder is a child module of `fs.rs`
   (`#[path = "arch/aarch64/stat.rs"] mod stat_abi`) and not `crate::arch::abi`.

### Image identity

These choices keep the generated code unchanged. Change them only if relinking is acceptable:

- `user::syscall_entry!` is a macro, not a function. Any call boundary, and
  even accessor methods on a frame type, changes MIR inlining in the ring
  build's `trap`: three branch polarities flip. Expanding the macro inside the
  arch `trap`'s `unsafe` block reproduces the old code exactly.
- `arch::boot` takes an `#[inline(always)]` closure over a borrowed
  `BootInfo`. Returning the parsed FDT by value copied it into callee-saved
  registers and grew `kernel_main` by 36 bytes.
- `mmio::*` and `doorbell` carry no inline attributes, the same as the
  functions they replaced. The other primitives are `#[inline(always)]`
  because they replace inline `asm!` blocks.

To check identity, build every variant before and after a change and compare
SHA-256 values. The default image is pinned in `.READY`. Ring images are not
pinned; the shard prepares snapshots from whichever image it is given.

## Linux ABI data

- **Syscall numbers.** These live only in `src/arch/<arch>/syscalls.json`.
  `slots.json` is name-keyed (`"exit_group": "exit"`). `generate.ts` rejects a
  slot that is missing from the arch table, as well as duplicate names,
  duplicate numbers and non-integer numbers. It emits `crate::syscalls::nr::*`
  (`READ`, `WRITE`, `PPOLL`, `IOCTL`, `DUP3`, …) for the core. The manifest
  rows are unchanged (`nr`, handler `name`, `registered`, `sha256`). GrowOS
  resolves numbers through `grow/runtime.ts` `slotNumber()`.
- **`struct stat`.** This is `stat.rs`. On x86_64 it is 144 bytes:
  `st_nlink` u64 at 16, `st_mode` at 24, uid/gid at 28/32, `st_rdev` at 40,
  `st_blksize` i64 at 56, `st_blocks` at 64. The neutral `Stat` already carries
  u64 `nlink`/`blksize`.
- **Identical on arm64 and x86_64.** The following need no arch table:
  `pollfd` (8 bytes), `timespec`/`iovec` (16), `linux_dirent64`, `AT_*`,
  `F_GETFD`/`F_SETFD`, `O_CREAT`/`O_EXCL`/`O_TRUNC`/`O_CLOEXEC`/`O_PATH`/`O_TMPFILE`,
  `PROT_*`, `MAP_ANONYMOUS`/`MAP_FIXED`, `TCGETS`/`TIOCGWINSZ`, errno values,
  and auxv tags. These are asm-generic on both architectures.
- **Not moved: `O_DIRECTORY`.** It is 0x4000 on arm64 and 0x10000 on x86,
  where 0x4000 is `O_DIRECT`. It is a literal in `syscalls/openat.rs`, which is
  a contracted handler: `syscalls.manifest.json` pins its source hash.
  Changing the file requires `refresh-contracts`, and the new manifest digest
  is recorded in `.READY`. The refactor stopped short of that.
  The x86 port must make this change, together with
  `O_NOFOLLOW`/`O_DIRECT`/`O_LARGEFILE` if any handler starts to use them,
  under a contract refresh.

## What `src/arch/x86_64/` must provide, mapped to the 03-hardware-reach table

The rows are from `arch/research/portability/03-hardware-reach.md` §2. "Before"
is that table's estimate in days; "after" is the estimate with this layout.

| 03 row | x86_64 work under this layout | Before | After |
|---|---|---:|---:|
| `boot.S` | `arch/x86_64/boot.S`: long-mode entry, GDT/TSS, SSE setup, BSS, stack, `kernel_main(boot_params)` | 1–2 | 1–2 |
| `link.ld`, Cargo/build | `arch/x86_64/link.ld`. `build.rs` already selects by target arch; add the target spec/flags | 1–2 | 0.5–1 |
| `vectors.S` | IDT stubs, error codes, IST for #DF, SYSCALL entry with stack switch; save into a frame and define `frame::{NR=rax, ARGS (rdi,rsi,rdx,r10,r8,r9 stored contiguously), RET, PC=rcx/rip}` | 3–4 | 3–4 |
| `mmu.rs` | `arch/x86_64/mmu.rs` with the same `crate::mmu` API: PML4, NX/RW/US, CR3/INVLPG, CR0.WP, SMEP/SMAP | 3–4 | 3–4 |
| `user.rs` | only `enter_user` (IRETQ to ring 3), `sync_icache` (a no-op on x86) and `trap.rs`. The initial stack, auxv, copy helpers and dispatch are already core | 2–3 | 1–1.5 |
| `main.rs` | `system_off` (ACPI-less: an i8042/port write or libkrun's chosen exit), a mount line per subsystem | 0.5–1 | 0.25–0.5 |
| `fdt.rs` / boot info | a `crate::fdt`-slot parser for boot params/cmdline; `BootInfo` with the same four methods | 1–2 | 1–2 |
| `wait.rs` | TSC with a calibrated frequency, LAPIC deadline/one-shot timer, IOAPIC route for the console IRQ, `sti; hlt` without races; same `crate::wait` API | 2–3 | 2–3 |
| `console.rs` | `arch::mmio` (volatile accesses plus a compiler fence) and IRQ routing; the virtio protocol is unchanged | 1–2 | 0.5–1 |
| `syscalls.rs`, `build.rs`, `slots.json`, manifest | `arch/x86_64/syscalls.json` with x86-only names (`arch_prctl`, `open`, `stat`, `poll`, `access`, … as `null` on aarch64); per-arch manifest naming | 1–2 | 0.5–1 |
| handler audit | `stat.rs` (144 bytes), `O_DIRECTORY` (contract refresh), new handlers or aliases for legacy x86 calls and `arch_prctl(ARCH_SET_FS)`, retrace QuickJS/Lua | 3–4 | 2–3 |
| `fs.rs`, `trace.rs` | nothing: trace uses `syscalls::nr` and fs is neutral | 0.5–1 | 0–0.25 |
| `prepare/artifact`, payloads | EM_X86_64 in `packer.ts`, x86 musl QuickJS/Lua | 2–3 | 2–3 |
| `vmm/src/main.rs` | unchanged estimate | 1–2 | 1–2 |
| `vmm/sandbox`, confinement | unchanged | 2–3 | 2–3 |
| vmm build scripts | unchanged | 0.5–1 | 0.5–1 |
| libkrun patches | unchanged | 1–2 | 1–2 |
| tests/certification | unchanged | 4–6 | 4–6 |
| **Total (libkrun path)** | | **30.5–50** | **≈26–41** |

The 03 table does not include the **ring/shard path**:

| Shard x86 work | Days |
|---|---:|
| `arch/x86_64/mmu_ring.rs` (arena relocation, the same `LAYOUT` marker) plus x86 GPAs as a second `abi::layout::Layout` (the jitk-abi crate; `ABI-R7.md` documents the aarch64 one) | 1.5–2.5 |
| shard `src/kvm/mod.rs` (778 lines: `KVM_ARM_VCPU_INIT`/PSCI and ONE_REG restore become SREGS/REGS/MSRS/XSAVE/LAPIC plus CPUID2/TSC), `snapshot.rs` register format (arm64 ONE_REG IDs), `prepare` | 4–6 |
| ring payload rebuild for x86 (`payload/ring-rng`), shard KVM gates | 1.5–2.5 |
| **Shard subtotal** | **7–11** |

With the shard included, the estimate is about **33–52 days**. The savings
from the layout are 4.5–9 days. Most of that is time no longer spent finding
and untangling ARM-specific code from shared code. The hard parts (SYSCALL
entry, page tables, APIC timer, the test matrix) are unchanged.

## Crate research (not added; the kernel stays dependency-free)

Data from crates.io on 2026-10-27, latest stable versions:

| Crate | Version, licence | no_std | Runtime deps | Would replace |
|---|---|---|---|---|
| `x86_64` | 0.15.5, MIT/Apache-2.0 | yes | bit_field, bitflags, const_fn, rustversion, volatile | Hand-written CR0/CR3/CR4/EFER/MSR access, IDT/GDT/TSS structures, page-table entry types, `invlpg`/`hlt`/port I/O in `arch/x86_64/{boot,trap,mmu}` |
| `raw-cpuid` | 11.6.0, MIT | yes (libcore only) | bitflags | CPUID decoding for the TSC frequency (leaves 0x15/0x16), invariant TSC, x2APIC, SMEP/SMAP, XSAVE. This is the counterpart of reading CNTFRQ |
| `x2apic` | 0.5.1, MIT/Apache-2.0 | yes | bit, bitflags, paste, raw-cpuid, x86_64 | LAPIC/x2APIC timer (TSC-deadline/one-shot), EOI and IOAPIC routing. This is the counterpart of the GICv3 code in `wait.rs` |
| `linux-raw-sys` | 0.12.1, Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | yes (`default-features = false`, `general`) | none | Generated per-arch UAPI data: `__NR_*`, `struct stat`, `O_*`, `AT_*`. It could replace `arch/*/syscalls.json` and `stat.rs`, and remove the `O_DIRECTORY` hazard. GrowOS and the manifest still need the JSON form, so a host tool would generate the JSON from it |
| ArceOS `axcpu` | 0.3.1, GPL-3.0-or-later OR Apache-2.0 OR MulanPSL-2.0 | yes | 16, including linkme, percpu, lazyinit, log, tock-registers, x86, x86_64, aarch64-cpu, riscv, loongArch64 | Per-arch trap frames, user-mode entry/return, TLB/cache ops, i.e. `vectors.S`, `trap.rs`, `enter_user`. It brings linker-section and per-CPU machinery that jitk does not use |
| ArceOS `page_table_multiarch` | 0.6.2, same triple licence | yes | arrayvec, log, memory_addr, page_table_entry, riscv, x86 | Generic 4-level tables over x86_64/aarch64/riscv PTE formats, i.e. `mmu.rs`/`mmu_ring.rs` walking. It expects a frame-allocating `PagingHandler`; jitk uses fixed static tables and arena relocation |

Assessment: `linux-raw-sys` is pure data with no dependencies and the best
value per byte of trust. `x86_64` and `raw-cpuid` are small, widely used, and
permissively licensed. `axcpu` and `page_table_multiarch` would each pull in
more code than the arch layer they replace, and their licences need the Apache
option to be chosen explicitly.

## arch-lint

`arch-lint.ts` is compiled with scriptc to `.work/bin/arch-lint` and runs in
`make test` and `check.sh`. It scans every `.rs`/`.S` file under `src/` except
`src/arch/`, with comments and string literals removed. It fails on:

- assembly files and `asm!`/`global_asm!`/`naked_asm!`, and `core::arch`;
- `target_arch`/`aarch64`/`arm64`, except inside a `path = "arch/…"` mount attribute;
- AArch64 instructions, system registers, exception levels, GIC/PSCI/timer names, and x/w registers;
- raw syscall numbers in `dispatch(…)`, `nr ==` or `n ==`.

`--self-test` first checks fixed positive and negative samples. An optional
operand selects another `src/`; the `f3f14f0f` tree reports 44 violations.
The lint cannot see arch-specific *values* such as `O_DIRECTORY`; the "Linux ABI
data" section lists them.

## Size (lines in `src/`, `.rs` + `.S`)

"Code" means non-blank lines that are not `//` comments. The default-image
counts exclude ring-only files and host test modules (`*_checks.rs`).

| | f3f14f0f raw / code | after raw / code |
|---|---:|---:|
| all of `src/` | 3,799 / 3,302 | 3,980 / 3,401 |
| default image: total | 2,767 / 2,451 | 2,992 / 2,575 |
| default image: core | 2,767 / 2,451 | 2,053 / 1,798 |
| default image: `arch/aarch64` | 0 / 0 | 939 / 777 |
| `syscalls/` handlers (unchanged) | 677 / 624 | 677 / 624 |

The added lines are interface documentation and SAFETY comments (`arch/mod.rs`,
`trap.rs`, `stat.rs`, `mmio`). The "1.4k-LOC kernel" phrase in `FINAL.md`
matches neither count. The default image is 2,451 code lines before and 2,575
after. Its arch-neutral core is 1,798 code lines after, or 1,174 without the
syscall handlers.

## Verification of the refactor (2026-10-27)

**Images.** All eight variants built with Rust 1.95.0 on the Mac match
`f3f14f0f` byte for byte. Default and the four ring images also match when
built with kvm-dev's Rust 1.99.1, and the artifact manifest is unchanged. The
Phase 2 grown kernel (`grow/phase2-grown`) and the PathFS grown kernel
(`grow/pathfs-grown`) were assembled with `build/phase2 assemble`. Both
produce the same default and grow-trace images as the same handlers overlaid
on `f3f14f0f`.

**Suites.**
- `make -C arch/jitk build test`: every Mac suite passed.
- The nested Linux suite passed. Its guarded rerun on a clean tree also passed.
- `make demo` passed. It replay-regrew ppoll, rt_sigaction and rt_sigprocmask.
- `grow test`: 58/58.
- `scriptc-corpus test` passed.
- Shard on kvm-dev: `make test` passed, with 29 Rust tests, 41/41 native cases
  exact twice, and the fd and region probes.
- Shard `test-kvm`: 5/5 on snapshots freshly prepared from this tree's ring
  images. A 2,000-run mixed stress had 0 canary leaks and 0 cross-talk.

**Corpus spot-check.** The first 300 visible-split programs on the Phase 2
grown kernel gave the same per-program jitk status as the stored
`grown-visible` run: 300/300 matched (229 pass, 38 missing-syscall, 22 crash,
9 mismatch, 2 elf-drift).

Raw logs are in `~/sofort-local-evidence/kernel-arch-split-2026-10-27/`.
