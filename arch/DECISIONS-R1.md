# Round-1 decisions (lead reviewer) — binding for round 2

All ten round-1 proposals were read in full; the per-proposal review is in `REVIEW-R1.md`.
These decisions settle the conflicts between proposals. Anyone who disagrees must bring
**new measured evidence** in round 2, not more argument.

## Settled facts (measured in round 1)
| Fact | Evidence |
|---|---|
| **One VMM process per VM, everywhere.** HVF returns HV_BUSY for a second VM, and libkrun calls `_exit()`s on guest shutdown. | 01, 05 |
| **The jitk kernel works end to end.** It is 901 lines of Rust no_std; static qjs runs at EL0 under libkrun. Whole process takes **8.7–9.0 ms** (lead re-measure: bare 5.75 ms, qjs 8.70 ms, machine still loaded at load average ~17). | 02 |
| **9/9 isolation probes pass**: PAN, W^X (including kernel aliases), privileged instructions, EL0 hvc, EFAULT on bad pointers. | 02 |
| On HVF, MMIO must use plain `ldr`/`str` (no writeback addressing), or libkrun misdecodes the access. | 02 |
| **One virtio device.** The console is at 0x0a002000 with 0x1000 stride. PL031 RTC and GIC are always attached. Use one `add_inout_port`, never `add_default_console`. | 01, 02 |
| **Cold cost is process exec + dyld** (~9 ms under load). VM create is ~40 µs; builder→vCPU run is ~1.5 ms. | 06 |
| **Strip qjs**: 9.69→2.39 MB, and payload copy drops 3.07→0.67 ms. initrd vs embedded makes no difference; libkrun copies either way. | 06, 10 |
| **Syscalls for the v0 workload set: 17.** That is the 02 set plus `ppoll` (async stdin, 03/04) and `mremap` (may return ENOSYS; musl falls back). | 03, 04, 08 |
| **A bump allocator that never frees is rejected.** 128 MiB of cumulative mmap against a 2.2 MiB peak means `munmap` must recycle pages. | 06, 08, 10 |
| **Stock qjs cannot load a bytecode file.** v0 uses a source bootstrap; precompilation saved only ~83 µs anyway. | 03, 06 |
| **Promise.all with 64 concurrent calls works**, resolved out of order. | 03 |
| The **grow loop works without the kernel**: strace fault injection → oracle → Codex patch → tests → exact trace → commit. | 08 |
| **Hyperlight comparison.** Hyperlight builds on macOS. Restoring a sandbox from a snapshot takes 12 µs in-process and 1.87 ms in a fresh worker. Its host calls are synchronous, so `Promise.all` gets no concurrency. It has no Linux ABI and no EL0. | 09 |
| A deny-default **Seatbelt profile + HVF** boots, and file/net/fork are denied. Apply it **before** `build()`. | 01 |
| An invalid hvc **hangs** the VMM unless built with `panic=abort` (then SIGABRT in ~9 ms). | 01 |
| **No /dev/kvm in Docker Desktop.** Linux numbers need arm64 bare metal. | 05 |
| **Page sharing across VMs** (file `MAP_PRIVATE`) cuts PSS 256→39 MiB, but needs a libkrun loader patch, so it is deferred. | 05 |

## Decisions
- **D1 — Architecture B, built on 02's kernel.** Unmodified static Bellard qjs runs at EL0 on a Rust EL1 kernel. EL0/EL1 stays (02: the user-map code is only ~73 lines). 02 owns `kernel/`; others copy it.
- **D2 — Image.** The build-time packer (10's `pack_elf.py`) lays out a stripped qjs at its final physical address. The kernel maps those pages in place: **no guest ELF parser and no guest copy**. RW segments are copied once at boot, or are writable pages in the image. One RAW image per release, content-addressed.
- **D3 — jitk-vmm.** It is Rust, built on the native libkrun builder API, statically linked (rlib) if that measurably cuts exec time, with `panic=abort` and exactly one inout console port. The sandbox is applied before `build()`. An external watchdog does SIGKILL. Exit status is never trusted as the result.
- **D4 — Parking is the #1 blocker.** Polling burns one core per parked VM, so there is no pool until parking is fixed. Lead source reading of libkrun a1d8616:
  - When the guest executes WFI/WFE, the VMM handles the trap at `src/hvf/src/lib.rs:808`.
    - If CNTV is disabled or masked, the vCPU blocks until an IRQ arrives.
    - If CNTV is armed, the VMM sleeps until the deadline (`WaitForEventTimeout`).
  - Which interrupt controller wakes the vCPU depends on what libkrun picks:
    - The userspace `GicV3` wakes a parked vCPU through `vcpu.rs:29-47`.
    - On macOS libkrun prefers the in-kernel `HvfGicV3` (`builder.rs:1290`, `hv_gic_set_spi`). How that path wakes a vCPU blocked in libkrun's `wait_for_event` is **unknown**, and may explain the WFE stall.

  Options:
  - **(A)** Do proper GICv3 init, enable the virtio-console SPI, then WFI and EOI.
  - **(B)** Use a timer tick: arm CNTV, then WFI, so the VMM sleeps until the deadline and the guest re-polls. This needs no IRQ plumbing and adds ≤ tick latency.
  - **(C)** Don't pre-boot: pre-spawn the sandboxed process with libkrun loaded and build+boot on demand (~1.5 ms + qjs init ~0.4 ms).

  Measure all three. Whichever wins also implements `ppoll` timeouts.
- **D5 — Memory.** `brk` uses a bounded arena. mmap/munmap use a page free-list with real reuse. Guest RAM is **32 MiB** with a JS heap cap of 8–16 MiB (05/06 data). 64 MiB is the "large" tier.
- **D6 — Clock.** The host passes `jitk.epoch_ns=<n>` and the 16-byte seed via FDT bootargs. The kernel computes REALTIME as epoch + counter delta.
- **D7 — Console correctness.** Handle the control queue (drain/repost), EOF, and partial reads. Discover the console from the FDT.
- **D8 — Framing / forgery.** The wire is **ASCII-only** (03). The kernel prefixes its own records with byte `0x1E`. If an EL0 `write(1)` contains any byte < 0x20 other than `\n`, the kernel kills the process. fd2 is dropped in production and wrapped as a kernel log record in dev. Every guest frame is still untrusted intent; host policy decides.
- **D9 — Trusted host dispatcher in TypeScript (v0).** It lives in one trusted process with the tools, policy and credentials, so a second parser adds nothing. 03's limits and strictness rules are ported to TS. A Rust decoder only becomes relevant if a `jitkd` daemon appears (05) — **deferred**.
- **D10 — Protocol v1.** This is the single spec; 03 owns the document `03-channel-protocol/PROTOCOL-v1.md`.
  ```
  G→H {"t":"ready","v":1}
  H→G {"t":"run","code":"<async fn body>","ns":{"github":["listIssues"]}}
  G→H {"t":"call","id":1,"ns":"github","fn":"listIssues","args":[{"repo":"x"}]}   // args ARRAY (codemode fns are variadic)
  H→G {"t":"ret","id":1,"ok":<json>}  |  {"t":"ret","id":1,"err":{"code":"DENIED","message":"..."}}
  G→H {"t":"log","level":"info","msg":"..."}
  G→H {"t":"done","ok":<json>}        |  {"t":"done","err":{"name":"Error","message":"..."}}
  ```
  IDs are consecutive from 1. Limits come from 03: 1 MiB frame, 64 outstanding calls, 4096 calls total, depth 32. Any violation kills the VM.
- **D11 — Executor.** 04's `MicroVMExecutor` with the backends `jitk` and `local-qjs` (dev only, explicitly unsafe). Hyperlight is a **benchmark baseline** with an adapter (09); it is not the v0 product backend. The `Backend` interface stays tiny: `park/read/send/kill`.
- **D12 — Pool.** Single-use. Size = `ceil(λ·refill_p99) + burst`, capped. The pool is built only after D4 passes its idle-CPU gate.
- **D13 — Security** is being reworked by a separate agent; the macOS profile, libkrun panic patches, seccomp and policy will be merged in round 3. Do not duplicate it.
- **D14 — Story.** The public demo is the grow loop on the **real kernel**, plus a second static binary that Hyperlight can't run, to prove the Linux-ABI differentiator.

## Gates for round 2 (numbers to produce)
- **G1 Parking.** Idle CPU per parked VM below 2% of a core. 1,000 sequential exchanges with no stall. Parked→result for 1 tool call: p50/p90.
- **G2 Real virtio Promise.all.** 64 concurrent calls over virtio-console with the protocol v1 bootstrap.
- **G3 E2E executor.** `MicroVMExecutor.execute()` on the **jitk** backend returns 2 for the demo snippet. Report cold and warm latency.
- **G4 Grow loop on the real kernel.** Delete one syscall handler, and the loop regrows it with the VM as the system under test.
- **G5 Head-to-head.** jitk vs Hyperlight, same harness, same snippets.
- **G6 Linux kit.** A one-command benchmark kit ready for a Graviton metal host.
