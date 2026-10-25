# Kernels & low-level: reading and watching for Sofort

Curated 2026-10-25 after reading `demo.md` §0–1 and `arch/research/cloudflare-goose/SYNTHESIS.md`. **27 items; eight P1s.** Blog includes authored technical articles and tutorial chapters. Reading times prefixed with `~` are estimates, excluding implementation exercises; undated sources are identified rather than assigned invented publication years.

Read with three Sofort distinctions in mind: jitk runs unmodified programs at EL0 behind a small EL1 kernel, unlike the usual single-privilege unikernel; a Linux syscall number is only the entry point to a much larger behavioral contract; and a small hardware isolation boundary does not establish correctness of the code inside it. This material serves the native hardware tier; the current Capsule/QuickJS-Wasm plan keeps jitk off its critical path.

## Build the kernel mental model

- [P1] **A Freestanding Rust Binary** — Philipp Oppermann (Writing an OS in Rust), Blog, 2018, ~20 min — <https://os.phil-opp.com/freestanding-rust-binary/>
  Why for Sofort: explains what `no_std` removes and what jitk must supply itself: startup, panic behavior, linking and a bare-metal target; useful even though the worked target is x86. Concepts: `no_std`, `core`, runtime, entry point, panic, unwinding, linker.

- [P2] **A Minimal Rust Kernel** — Philipp Oppermann (Writing an OS in Rust), Blog, 2018, ~25 min — <https://os.phil-opp.com/minimal-rust-kernel/>
  Why for Sofort: connects a freestanding executable to a bootable machine and explains the bootloader/kernel boundary; its BIOS/UEFI sequence is x86 background, not jitk's KVM/HVF boot contract. Concepts: boot, firmware, bootloader, target specification, linker, QEMU.

- [P2] **Introduction to Paging** — Philipp Oppermann (Writing an OS in Rust), Blog, 2019, ~30 min — <https://os.phil-opp.com/paging-introduction/>
  Why for Sofort: the clearest conceptual introduction to page tables, faults and TLBs before tackling AArch64 registers; distinguish guest mappings from the host mappings used for CoW restore. Concepts: virtual memory, page tables, multilevel translation, permissions, TLB, page faults; x86 worked examples.

- [P1] **2.1: Processor initialization** — Sergey Matyukevich (raspberry-pi-os), Blog, undated, ~20 min — <https://s-matyukevich.github.io/raspberry-pi-os/docs/lesson02/rpi-os.html>
  Why for Sofort: makes EL0/EL1/EL2, saved processor state and `eret` concrete; use the Pi boot sequence as a teaching example, and establish jitk's actual entry state separately. Concepts: AArch64, exception levels, `CurrentEL`, `SCTLR_EL1`, `HCR_EL2`, `SPSR`, `ELR`, boot.

- [P2] **3.1: Interrupts** — Sergey Matyukevich (raspberry-pi-os), Blog, undated, ~25 min — <https://s-matyukevich.github.io/raspberry-pi-os/docs/lesson03/rpi-os.html>
  Why for Sofort: walks through vectors, saving registers and returning from IRQs; its Pi 3 interrupt controller and peripheral timer are board-specific, not a GIC or architectural-timer implementation. Concepts: synchronous exceptions, IRQ/FIQ/SError, vector slots, `VBAR_EL1`, exception frames, interrupt masking.

- [P1] **5.2: User processes and system calls: Linux** — Sergey Matyukevich (raspberry-pi-os), Blog, undated, ~25 min — <https://s-matyukevich.github.io/raspberry-pi-os/docs/lesson05/linux.html>
  Why for Sofort: follows the real AArch64 Linux path from `svc` through the syscall number in `w8`, register arguments, dispatch and return, giving jitk's Linux ABI implementation a concrete reference. Concepts: EL0→EL1, `svc`, `ESR_EL1`, `x0`–`x5`, `x8`, syscall table, `pt_regs`, return state.

- [P1] **6.1: Virtual memory management** — Sergey Matyukevich (raspberry-pi-os), Blog, undated, ~55 min — <https://s-matyukevich.github.io/raspberry-pi-os/docs/lesson06/rpi-os.html>
  Why for Sofort: translates paging concepts into AArch64 table descriptors and MMU initialization, essential for reviewing user-pointer checks, executable permissions and fault handling. Concepts: MMU, `TTBR0_EL1`/`TTBR1_EL1`, `TCR_EL1`, `MAIR_EL1`, page/block mappings, memory attributes, faults.

- [P1] **Programmable Interrupt Controllers: A New Architecture** — Eoin McCann (Arm), Blog, 2015, 7 min — <https://developer.arm.com/community/arm-community-blogs/b/architectures-and-processors-blog/posts/programmable-interrupt-controllers-a-new-architecture>
  Why for Sofort: explains why GICv3 adds redistributors and a system-register CPU interface instead of GICv2's memory-mapped interface, so a Pi/GICv2 port is more than changing addresses. Concepts: GICv2 vs GICv3, distributor, redistributor, CPU interface, affinity routing, security groups.

- [P2] **AArch64 Exceptions & Interrupts: Teaching Your Kernel to Listen** — Nathan (BIOSConfessions), Blog, 2026, 18 min — <https://www.biosconfessions.com/posts/from-silicon-to-shell/7-exceptions-and-interrupts/>
  Why for Sofort: a compact QEMU/GICv2/ARM Generic Timer walkthrough for connecting counter, timer PPI, IRQ acknowledgement and rearming; review the code critically—its blanket claim that every synchronous exception's `ELR_EL1` points to the triggering instruction is wrong for `svc`. Concepts: GICv2, `CNTP_*`, `CNTFRQ_EL0`, timer IRQ, acknowledge/EOI, vectors.

- [P2] **Writing an Embedded Operating System in Rust** — Alistair Francis (Western Digital), YouTube, 2022, 34:07 — <https://www.youtube.com/watch?v=yT0cRctyZOE>
  Why for Sofort: Tock's implementer explains how Rust abstractions and hardware protection cooperate; Cortex-M/RISC-V hardware differs from jitk, but the distinction between language safety and isolation transfers directly. Concepts: embedded Rust, safe abstractions, isolation, kernel design, hardware protection, Tock.

## Reimplementing the Linux boundary

- [P1] **Releasing Systrap – A high-performance gVisor platform** — Konstantin Bogomolov (Google/gVisor), Blog, 2023, ~12 min — <https://gvisor.dev/blog/2023/04/28/systrap-release/>
  Why for Sofort: shows how an application kernel separates Linux syscall semantics from interception, comparing KVM, ptrace and seccomp/SIGSYS; the post's syscall-instruction patching example is x86-specific. Concepts: Linux ABI, Sentry, KVM, `PTRACE_SYSEMU`, `SECCOMP_RET_TRAP`, shared memory, interception cost.

- [P3] **Optimizing seccomp usage in gVisor** — Etienne Perot (Google/gVisor), Blog, 2024, ~45 min — <https://gvisor.dev/blog/2024/02/01/seccomp/>
  Why for Sofort: separates filtering the application from filtering the Sentry's own host syscalls, then measures the cost of that second boundary; useful when defending host-side containment and interpreting syscall microbenchmarks. Concepts: seccomp-BPF, defense in depth, host syscall allowlists, profiling, filter optimization.

- [P2] **The Seccomp Notifier – New Frontiers in Unprivileged Container Development** — Christian Brauner (Linux kernel/LXC), Blog, 2020, ~25 min — <https://brauner.io/2020/07/23/seccomp-notify.html>
  Why for Sofort: the feature's developer explains userspace syscall brokering and its limits; compare a host-mediated operation with jitk's explicit tool channel, paying attention to mutable pointer arguments and races. Concepts: `SECCOMP_RET_USER_NOTIF`, supervisor, namespaces, capabilities, file-descriptor injection, TOCTOU.

- [P2] **WSL System Calls** — Stephen Hufnagel (Microsoft WSL team), Blog, 2016, ~15 min — <https://learn.microsoft.com/en-us/archive/blogs/wsl/wsl-system-calls>
  Why for Sofort: the original WSL1 article shows clean-room Linux ABI dispatch into NT, including why pipes need their own semantics and why `fork` needs special work; this is historical WSL1, not WSL2. Concepts: syscall ABI vs function ABI, pico processes, register preservation, translation, pipes, `fork`, errno.

- [P2] **Announcing WSL 2** — Craig Loewen (Microsoft), Blog, 2019, ~8 min — <https://devblogs.microsoft.com/commandline/announcing-wsl-2/>
  Why for Sofort: Microsoft's explanation for moving from a syscall translation layer to a real Linux kernel is a direct challenge to adding clone/futex/epoll indefinitely; use it when deciding which tools belong on a Linux tier. Concepts: WSL1 compatibility ceiling, Linux kernel reuse, utility VM, application compatibility, maintenance cost.

- [P2] **Update on FreeBSD Foundation Investment in Linuxulator** — FreeBSD Foundation, with Edward Tomasz Napierała (Linuxulator developer), Blog, 2021, ~10 min — <https://freebsdfoundation.org/blog/update-on-freebsd-foundation-investment-in-linuxulator/>
  Why for Sofort: gives a second long-lived example of native Linux ABI compatibility on another kernel, emphasizing diagnostics and actual application fixes rather than treating a supported-syscall count as sufficient. Concepts: Linuxulator, binary compatibility, FreeBSD, compatibility maintenance, application-driven development.

## Specialization: what to remove, what to preserve

- [P1] **Unikraft and the Coming of Age of Unikernels** — Hugo Lefeuvre, Gaulthier Gain, Daniel Dinca, Alexander Jung, Simon Kuenzer, Vlad Bădoiu, Răzvan Deaconescu, Laurent Mathy, Costin Raiciu, Pierre Olivier & Felipe Huici (Unikraft project), Blog, 2021, ~25 min — <https://www.usenix.org/publications/loginonline/unikraft-and-coming-age-unikernels>
  Why for Sofort: the builders connect modular kernel specialization, musl/syscall shims and Loupe's syscall experiments, while acknowledging compatibility, tooling and security shortcomings; this is the closest conceptual predecessor to jitk's offline growth loop. Concepts: Unikraft, micro-libraries, Kconfig, syscall shim, autoporting, binary compatibility, Loupe, specialization.

- [P2] **Expanding Binary Compatibility Mode (Part 1)** — Tianyi Liu (Unikraft GSoC/Nanjing University), Blog, 2023, ~8 min — <https://unikraft.org/blog/2023-06-23-unikraft-gsoc-app-compat-1>
  Why for Sofort: a hands-on account of ELF loading, libc wrappers, vDSO and the TLS complications behind a Linux-compatible unikernel; its removal of the user/kernel transition is a design choice that jitk need not copy. Concepts: ELF loader, static/dynamic linking, syscall shim, `LD_PRELOAD`, vDSO, TLS, regression testing.

- [P2] **Loupe: Dynamic Analysis for OS Feature Usage** — Hugo Lefeuvre & Pierre Olivier (University of Manchester/Unikraft), Blog (project article), undated; project news through 2024, ~5 min — <https://unikraft.github.io/loupe/>
  Why for Sofort: introduces a reproducible syscall census and application database that can inform the growth order; read alongside the preceding USENIX article's experiments, and validate on multiple workloads before declaring a syscall unnecessary. Concepts: Loupe, dynamic vs static analysis, syscall requirements, reproducibility, application corpus, specialization.

- [P3] **A Linux in Unikernel Clothing** — Hsuan-Chi Kuo, Dan Williams, Ricardo Koller & Sibin Mohan (UIUC/IBM Research), Paper PDF (fallback), 2020, 15 pages / ~45 min — <https://sibin.github.io/papers/2020_EUROSYS_Lupine_HsuanChiKuo.pdf>
  Why for Sofort: Lupine tests the counterproposal of specializing Linux through configuration and removing syscall transition overhead, preserving an escape route to generality; compare its deployment and isolation assumptions before comparing footprints. Concepts: Lupine, Linux debloating, Kconfig, kernel-mode Linux, syscall overhead, compatibility, graceful degradation.
  Fallback reason: no sufficiently substantive, verified author blog or YouTube talk was found for Lupine; this is the sole research-paper exception in this lane. Start with §§1–3 and the discussion rather than the evaluation tables.

- [P2] **Announcing MirageOS 4.0.0** — Thomas Gazagnaire (MirageOS team), Blog, 2022, ~12 min — <https://mirage.io/blog/announcing-mirage-40>
  Why for Sofort: illustrates a different specialization route: compile an application and selected OCaml OS libraries into a standalone unikernel, with reproducible builds and Solo5 targets, rather than reproduce Linux for arbitrary ELF programs. Concepts: MirageOS, library OS, OCaml, Solo5, cross-compilation, reproducible builds, specialization.

- [P2] **Unikernels are unfit for production** — Bryan Cantrill (Joyent, at publication), Blog, 2016, ~15 min — <https://bcantrill.dtrace.org/2016/01/22/unikernels-are-unfit-for-production/>
  Why for Sofort: the essential skeptical companion to Unikraft: assess production debugging, observability and performance claims; its single-privilege definition and categorical conclusion are arguments to evaluate against jitk's EL0/EL1 design. Concepts: operational debuggability, observability, privilege separation, virtualization overhead, production failure analysis.

## Verify behavior, especially when agents write the code

- [P1] **Detecting semantic bugs in the Linux kernel using differential fuzzing** — Mara Mihali, Marco Elver & Dmitry Vyukov (syzkaller/Google), YouTube, 2021, ~27 min segment, 07:51–35:13 — <https://www.youtube.com/watch?v=_H8848Ggo3w&t=471s>
  Why for Sofort: directly motivates comparing the same syscall programs across kernels to find wrong behavior without a crash; borrow the method for jitk versus Linux, explicitly controlling nondeterminism and comparing more than process stdout. Concepts: Linux oracle, differential fuzzing, syz-verifier, semantic bugs, errno, nondeterminism, false positives.
  Verification note: YouTube's verified title is **Testing and Fuzzing MC**, channel **Linux Plumbers Conference**; this talk is the timestamped segment, not a separately titled upload. The conference's session summary identifies the segment. Treat the 2021 presentation as methodology, not a promise that today's syz-verifier tool is ready to use.

- [P2] **Syzbot and the Tale of Thousand Kernel Bugs** — Dmitry Vyukov (Google), YouTube, 2018, 43:12 — <https://www.youtube.com/watch?v=qrBVXxZDVQY>
  Why for Sofort: the fuzzer's creator explains continuous kernel testing and making failures actionable; complements differential tests with hostile input generation, reproducible reports and crash triage. Concepts: syzkaller, syzbot, coverage-guided fuzzing, sanitizers, minimized reproducers, continuous testing.

- [P2] **On the use of LLM assistants for kernel development** — Jonathan Corbet (LWN/Linux kernel maintainer), Blog (article), 2025, ~15 min — <https://lwn.net/Articles/1032612/>
  Why for Sofort: captures kernel developers' concerns about disclosure, responsibility and review of generated patches; use it to explain why an agent-authored handler still needs an independently specified acceptance test and accountable review. Concepts: LLM-generated kernel code, provenance, maintainer trust, review burden, developer responsibility; historical discussion, not current policy.

- [P2] **Google Antigravity built an OS (and more)** — The Antigravity Team (Google), Blog, 2026, 10 min — <https://antigravity.google/blog/google-antigravity-built-an-os>
  Why for Sofort: a primary account of agents building a bootable OS that runs FreeDoom, explicitly acknowledging missing sandboxing and other major features; distinguish a working demo from evidence that generated kernel code safely isolates hostile programs. Concepts: agent-written OS, multi-agent implementation, demos vs assurance, capability limits, sandboxing.

- [P3] **LLMs are making formal software verification feasible at a much larger scale** — Keane Lucas et al. (Anthropic Frontier Red Team, with Theorem), Blog (research article), 2026, ~30 min — <https://www.anthropic.com/research/formal-verification>
  Why for Sofort: shows how agents can assist stronger checking while exposing the trusted semantics, proof assumptions and reward-hacking risks; its scoped RISC-V userspace results do not prove AArch64 kernel or Linux-compatibility correctness. Concepts: formal verification, machine-checked proofs, specification risk, trusted computing base, agent-generated patches, limits of tests.

## Applying the list to jitk

The practical acceptance question is **which observable Linux behaviors does this exact artifact implement?** A syscall name alone omits flags, structure layout, error precedence, partial I/O, bad pointers, signals, TLS and interactions between calls. For the offline growth loop, specify adversarial and mutation cases before implementation; run the same static test binary on Linux and jitk; compare return values, errno, returned bytes and persistent state. Separate expected differences such as time, entropy and process identifiers from real mismatches. These are recommendations drawn from the ABI, compatibility and differential-testing material above, not a claim that the current growth loop already satisfies them.

For ARM review, explain the guest's stage-1 EL0/EL1 mappings separately from hypervisor-controlled stage-2 translation. EL2 is the hypervisor privilege level; the whole host OS need not run there. The older Pi tutorial simplifies that point, and neither its firmware entry assumptions nor its interrupt-controller addresses define a KVM/HVF guest contract. Likewise, distinguish a peripheral system timer from the ARM Generic Timer. The ring-transport shard described in `demo.md` deliberately omits guest GIC/timer/WFI; read the interrupt material for the original device path and portability work rather than assuming the shard needs those devices.

## Link verification

Every linked reading/watch item above was fetched and checked for matching content on 2026-10-25 using web fetch or an HTTP GET, following redirects. The WSL1 URL is Microsoft's archived original blog, and the Lupine link resolves to the authors' 15-page PDF. Some sites rejected a plain HTTP client but were readable through web fetch. No login, posting or subscription was used.

All three YouTube videos additionally returned successful `youtube.com/oembed` responses with matching titles and channels. The Rust and Syzbot talks are on **The Linux Foundation** channel; their durations, 2,047 and 2,592 seconds, came from YouTube watch-page metadata. The differential talk's full **Testing and Fuzzing MC** recording is 14,928 seconds; its chapter start and next-talk boundary came from the conference summary. Blog years are original publication years where shown; the living Matyukevich tutorials and Loupe explainer do not expose a reliable original date.

## If you only have 3 hours

1. **20 min:** read **A Freestanding Rust Binary**; be able to explain exactly what `no_std` does and who provides startup and panic handling.
2. **35 min:** read **Processor initialization**, skim **Interrupts**, then read Arm's **Programmable Interrupt Controllers**; draw EL0 → EL1 and identify EL2, the vector entry and the GIC version boundary.
3. **45 min:** read **User processes and system calls: Linux** and focus on translation/descriptors/MMU enablement in **Virtual memory management**; trace `svc` and one user-memory access end to end.
4. **45 min:** read **Unikraft and the Coming of Age of Unikernels**, the **Loupe** explainer and **Unikernels are unfit for production**; state the compatibility and debugging costs of removing a subsystem.
5. **35 min:** watch the **differential fuzzing** segment at 07:51–35:13, then skim **Releasing Systrap**; write an acceptance checklist for one new handler: results, errno, bytes, bad pointers, flags and state across calls.
