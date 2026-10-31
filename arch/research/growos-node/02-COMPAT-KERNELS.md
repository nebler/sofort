# Linux-compatible kernels and syscall layers: what GrowOS can reuse

Research date: **2026-10-31**. Local source baseline: `7a4be6a51a83acba5567342f032b8066f4eb575a`. Desk research only: repository reads and primary upstream documentation/source inspection; no builds, workloads, benchmarks, containers, or VMs were run. This report is the only new file written.

**Evidence notation:** **V** = verified in the cited source, including an explicitly attributed upstream claim; **I** = inference or recommendation; **U** = not established by the inspected public evidence. “Runs Node” means the particular demonstration/configuration described, not a complete Node test pass, ARM64 certification, or strict W^X. Missing evidence is not evidence of impossibility. Links to branch tips are moving references; sampled Git tree object IDs are recorded at the end.

## Summary

- **I — Best overall combination:** gVisor for Linux semantics and differential syscall tests; Nanos for the one-program-per-VM architecture; StarryOS, Moss, and selected Occlum modules for readable Rust implementations. None is a drop-in Linux personality for Sofort.
- **V — Asterinas is technically close but mostly MPL-2.0.** Its syscall, VFS, VM, futex, and signal code cannot simply become Apache/MIT code. An MPL component can coexist in a larger work if its obligations are retained; a permissive-only kernel should independently implement the design. Its small permissive exceptions do not include the main syscall layer. [A1, A2, L1]
- **V — ARM64 information has changed recently:** Asterinas 0.19.0, released October 13, 2026, introduces Tier 2 AArch64 support with a BusyBox shell and CI; this does not establish ARM64 Node support. Moss is AArch64-first; StarryOS has an AArch64 test lane. [A3, M1, S3]
- **V — Strongest explicit Node evidence:** gVisor's Node **22.2.0** regression image; Nanos examples using **20.5.0**; Unikraft's open catalog listing **18/20/21**; OSv release evidence for **6.10.3/8.11.2**; Gramine's system-installed Node example; Rumprun's patched **4.3.0** port. Versions, architectures, and application modifications differ substantially. [G3, N3, U2, O2, Q3, R2]
- **V/I — Do not credit every contemporary Unikraft Cloud demo to the non-Linux kernel.** The current commercial website explicitly describes a trimmed Linux kernel. Keep the open-source Unikraft/elfloader evidence separate from current Cloud Node 26 examples. [U1–U4]
- **I — Stage 1 should introduce one coherent filesystem model:** stable node identity, directory entries, open-file descriptions, fd references, cwd/root, and bounded file storage. Keep the archive immutable and mount separate scratch trees at `/tmp` and `/work`; avoid root overlay/whiteout complexity initially.
- **V/I — Stage 2 first needs a scheduler and Linux sharing/lifetime rules.** `clone`, TLS, `clear_child_tid`, futex wait/wake, signal delivery, and interruptible waits are a connected subsystem. Returning success from isolated handlers cannot provide those semantics. [G4, S2, F2; local sources below]
- **V/I — Reserve virtual addresses separately from physical pages.** V8 uses `PROT_NONE`, `MAP_NORESERVE`, fixed remapping, and protection changes. `--jitless` does not make Node a tiny single-thread program or remove its allocator/VM requirements. Sofort's current eager RW-only mmap is insufficient. [J1, J2; local `mmap.rs`]
- **I — Adopt gVisor tests first, then a curated LTP subset and musl libc-test.** Execute the same compiled ARM64 probe on pinned Linux and the actual ring/native GrowOS image; retain exact observations and expected unsupported cases. gVisor itself recommends establishing tests on Linux first. [G2]
- **V — Test licensing differs from kernel licensing.** gVisor tests are Apache-2.0; Asterinas-owned tests generally MPL; LTP generally GPL-2.0-family; libc-test generally MIT with BSD/GPL math-data exceptions. Separate guest test programs can be used without copying their implementations into the kernel. [G1, A2, T1, T3]
- **V — Useful 2025–2026 newcomers:** Moss publishes a syscall-status table and host-testable kernel utilities; FTL 0.2.0 (October 28, 2026) adds a container-like Zone and more VFS/epoll support after 0.1.0's thread/futex/signal work. FTL still describes Node as a future goal in its launch article. [M1, M2, F1–F3]
- **V — Several requested projects are boundary cases:** Hermit-rs and Theseus are not established Linux binary personalities; relibc is a libc; rump is NetBSD component reuse; LKL actually embeds Linux; WSL1's lxcore remains proprietary despite WSL's 2025 open-sourcing. [H1, H2, D1, R1, K1, W2]
- **I — Preserve Sofort's advantage while borrowing:** all per-run objects, wait queues, timers, and VM metadata must reset with the guest; use sparse/lazy allocation and compact tables to avoid dirtying an entire filesystem, page table, or scheduler arena on every run.

## Comparison table

“Copy” below means usable in a larger Apache/MIT project **with the upstream license, notices, and any applicable patent/NOTICE terms preserved**. It does not mean relicensing someone else's code as MIT. Architecture lists describe upstream support, not readiness of every subsystem on that architecture.

| Project | Language; architecture evidence | License / copying into Sofort | Linux ABI and runtime evidence | Most useful material |
|---|---|---|---|---|
| **Asterinas** | Rust `no_std`; x86-64, RISC-V64, LoongArch64, new Tier 2 AArch64 | Mostly **MPL-2.0**: mixed-license reuse possible; **no permissive-only transplant** | 240+ x86-64 syscalls, flag-level tables; Node and Python documented in Asterinas NixOS; exact versions/JIT/ARM64 pairing U | VFS/cwd model, safe user access, futex/signal/VM architecture; LTP/gVisor integration [A] |
| **gVisor / Sentry** | Go; amd64 and arm64; C++ guest tests | **Apache-2.0**, yes; Go runtime is a porting obstacle | Broad Linux ABI; runtime regression images include Node 22.2.0 and Python 3.12.3, inspected images x86-64 | Best semantic reference and immediately relevant test corpus [G] |
| **Unikraft / app-elfloader** | C/assembly; core supports ARM64, inspected upstream bincompat docs specify x86-64 | Core primarily **BSD-3-Clause**, library/file exceptions; inspected elfloader `main.c` BSD-3-Clause | Static/dynamic PIE Linux ELFs; catalog Node 18/20/21 and Python 3.10/3.12/3.13; not an ARM64 proof | Modular syscall shim, futex/poll/eventfd, VM reservation; distinguish Cloud backend [U] |
| **Nanos / OPS** | Kernel C/assembly, OPS Go; x86-64 and ARM64, limited RISC-V | Nanos **Apache-2.0**; OPS **MIT**, yes with dependency checks | Single application, multiple threads, Linux ELF ABI; Node 20.5.0 example, Python 3.6.7 e2e fixture | Closest deployment shape; block queues, futex, mmap, tmpfs, runtime tests [N] |
| **OSv** | C++; x86-64 and AArch64 | Core **BSD-3-Clause**, yes for selected files; OpenSolaris/CDDL and other imports need separate audit | Linux/POSIX ABI with single-address-space deviations; historical Node 6.10.3/8.11.2 PIE ports; Python 2/3 | Epoll design, ramfs, memory management; signal-deviation caution [O] |
| **StarryOS / ArceOS** | Rust `no_std`; RISC-V64, LoongArch64, AArch64, x86-64 CI (README still calls x86 WIP) | Current StarryOS **Apache-2.0**; ArceOS offers **GPL-3.0-or-later OR Apache-2.0 OR MulanPSL-2.0**: choose Apache for eligible code | Starry adds Linux personality to ArceOS; current Node/Python versioned execution U; ArceOS alone leaves Linux apps unchecked | Most attractive small Rust syscall/task/futex/epoll modules; modular crates [S] |
| **Kerla** | Rust; x86-64 | **MIT OR Apache-2.0**, yes | Static musl-oriented Linux subset; glibc/dynamic-link support documented as incomplete; Node roadmap, not a verified milestone; unmaintained | Small tmpfs, descriptor/path/user-buffer implementation [E] |
| **Hermit-rs** | Rust `no_std`; x86-64, AArch64, RISC-V64 | **MIT OR Apache-2.0**, yes | Applications link against Hermit's own ABI; no verified unmodified Linux Node/Python path | Scheduler/futex, fd objects, memory allocation; not a Linux syscall table [H] |
| **Theseus** | Rust; x86-64, partial AArch64 | **MIT**, yes with per-crate checks | Native intralingual OS; unmodified Linux Node/Python and Linux ABI coverage U | Typed ownership/lifetime boundaries and fault recovery [Y] |
| **Redox / relibc** | Rust plus C/assembly; i586, x86-64, AArch64, RISC-V | relibc **MIT**, yes; dependencies/submodules separately | POSIX libc on Redox/Linux, not a Linux guest kernel personality; Linux backend calls Linux | pthread/TLS/signal ABI consumer behavior; libc tests [D] |
| **Fuchsia Starnix** | Rust userspace personality on Zircon; arm64/x64 source, also a RISC-V directory | Inspected core **BSD-2-Clause-style** + PATENTS; external code separately | Unmodified glibc/bionic Linux binaries, Android-oriented; exact Linux Node/Python/JIT milestone U | Excellent Rust VFS, futex, signals, mm; Linux-vs-Starnix syscall tests [Z] |
| **WSL1 / lxcore** | Native Windows kernel code; closed implementation; x86-64 historical baseline | **Proprietary lxcore**, no copy grant; open WSL repository license does not cover it | Linux ELF translation; official Linux Node demo; no versioned ARM64/JIT certification established here | Clean-room semantic translation, instance-owned Linux global state [W] |
| **Linux Kernel Library** | Primarily C; `ARCH=lkl`, host-dependent code generation | **GPL-2.0 Linux kernel**, not permissive transplant | Actual Linux subsystems exposed as library calls; not a complete independent ELF/JIT process environment | Reference behavior and host-operations seam; deliberately outside “without Linux” category [K] |
| **NetBSD rump / Rumprun** | C; Rumprun x86-32/x86-64/ARM, inspected Node recipe only x86 | Rumprun **BSD-2-Clause**; NetBSD components mixed BSD-style, inspect imports | NetBSD/POSIX recompile/relink model; patched Node 4.3.0, Python package; not unmodified Linux ABI | Reusable filesystem components, explicit host boundary, NetBSD tests [R] |
| **Graphene / Gramine** | C/assembly; inspected implementation x86-64 Linux/SGX | **LGPL-3.0-or-later**, not permissive-only kernel code; selected examples BSD-3 | Linux LibOS; official Node/system-version example, Python examples; SGX/JIT memory caveats | Feature/quirk documentation, fd/VMA accounting, mature regression approach [Q] |
| **Occlum** | Rust using SGX `std`, C/assembly; Intel x86-64 SGX | **BSD-3-Clause**, yes for own code; imported crates separately | musl/glibc-oriented LibOS; Python **3.8.10** demo recipe; Node/JIT milestone U | Rust `FsView`, fd/open-file distinction, futex, signal, poll/epoll/event/timer abstractions [C] |
| **Moss** (2025–2026) | Rust/AArch64 assembly; AArch64-first | **MIT**, yes | Dynamically linked Arch ARM64 userspace; README says 109 calls; futex/mprotect supported, epoll partial, eventfd/timerfd absent in table; Node/Python U | Small ARM64 ABI reference, async waits, tmpfs/procfs, host-testable utilities [M] |
| **FTL** (2026; Starina successor) | Rust `no_std` Linux personality; x86-64 demonstrated | **MIT OR Apache-2.0**, yes | Musl Linux programs and multithread Tokio; 0.2.0 Zones/VFS; Node still a stated future objective in launch article | Explicit resource seam, lazy VM, small futex/signal/epoll code; TS e2e tests [F] |
| **smoltcp** | Rust `no_std`, optional alloc; architecture-neutral | Current main **0BSD**, yes; pin version | TCP/IP building block, no Linux socket or process ABI | Device/Interface/SocketSet, bounded buffers and readiness integration [B1] |
| **rustls** | Rust TLS library; backend-dependent target support | **Apache-2.0 OR ISC OR MIT**, yes | No Linux ABI. Pin a verified freestanding-capable release: 0.23.35 supports no-std; inspected 0.24-dev main unconditionally imports `std` | TLS state machine, explicit crypto/time providers; not needed for Node's bundled TLS [B2] |

### License handling decisions

**V:** Asterinas's `.licenserc.yaml` marks Rust/C/assembly/shell files MPL by default; its explicit Apache/MIT exception is `kernel/libs/comp-sys/cargo-component`. Do not assume OSTD, its syscall tests, or the rest of the workspace is Apache/MIT because Rust projects often are. Mozilla explicitly permits MPL files in larger differently licensed works, while requiring covered source and modifications to remain available under MPL. [A2, L1]

**I:** For a kernel intended to remain permissive-only, classify proposed reuse as: **(a)** copy/adapt a checked permissive file with provenance; **(b)** retain an explicitly approved MPL component as MPL; **(c)** independently implement a behavior/design from documentation and Linux observations. A language translation of implementation code is not automatically an independent implementation. GPL LKL and LGPL Gramine are not shortcuts to a permissive-only kernel. Keep LTP and other separately licensed test executables outside the kernel implementation.

**V/I:** Apache-2.0 code can be part of an Apache/MIT repository, but keep its Apache license and relevant notices, mark modifications, and preserve applicable NOTICE material. BSD/MIT files retain their own notices. A top-level license is only the starting point: Unikraft and OSv expressly include files with different licenses; Fuchsia has third-party metadata; Rust crates and submodules need their own inventory. This research verifies project notices and selected files, not every transitive dependency. [G1, U5, O1, Z1]

## Per-project notes

### 1. Asterinas: the closest full Rust kernel reference, with a copyleft boundary

**V — Compatibility and architecture.** The project publishes Linux syscall and argument/flag coverage, with 240+ calls on x86-64. Its 0.19.0 release adds minimal usable AArch64, with a shell, GICv3, vDSO, and Tier 2 testing. The popular-applications book gives Node and Python invocation recipes through NixOS packages, without pinning runtime versions on that page. **U:** an ARM64 Node/JIT run or full Node regression pass was not established. [A3–A5]

**V — Subsystem map.** Current code is under `kernel/core/src/`, not just the older `kernel/src/` paths in papers:

- `fs/thread_info.rs` holds a path resolver and umask; `fs/vfs/path/resolver.rs`, `dentry.rs`, and `mount.rs` distinguish namespace location from inode identity. `fs/fs_impls/ramfs/`, `tmpfs/`, and `procfs/` cover mutable and synthetic filesystems.
- `process/posix_thread/futex.rs` separates private and shared identities, checks the word while coordinating with the wait queue, and removes interrupted/timed-out waiters. Its comments explicitly connect missing waiter cleanup to attacker-driven kernel memory exhaustion.
- `process/signal/` and `arch/arm/signal.rs` separate dispositions, masks, pending queues, and architecture signal frames. `syscall/mprotect.rs` fronts VM machinery; `events/epoll/`, `time/timerfd.rs`, and syscall wrappers implement fd-driven waits. These are MPL code references. [A6–A8]

**V — Tests and published caveats.** The conformance tree contains LTP, gVisor, kselftest, and xfstests; the inspected LTP recipe pins `20260529` and Kirk `v4.1.0`. The flag documentation distinguishes ignored/unsupported options and even reports `MAP_FIXED_NOREPLACE` treated as `MAP_FIXED`. The `madvise` page contains overlapping ignored/unsupported lists, another reason to check behavior against Linux rather than treating a table as an executable specification. [A9, A10]

**I — Yoink:** the safe user-memory/VM policy separation and documented flag-level contracts. Avoid importing the whole framekernel framework merely to obtain a filesystem or futex table. The ATC 2025 Asterinas paper and Converos are especially useful design reading; Converos reports 20 bugs in 12 Rust concurrency modules, demonstrating that memory-safe Rust still needs concurrency validation. [P1, P2]

### 2. gVisor: semantic reference and first-choice test suite

**V — Compatibility evidence.** Sentry implements Linux in Go, rather than forwarding arbitrary guest syscalls to the host. The generated ARM64 table inspected on this date reports **255 fully/partly implemented out of its 295 listed calls**. That is the table's denominator, not a claim that modern ARM64 Linux has only 295 calls. The application guide describes regression testing Python, Java, Node, PHP, and Go. The inspected runtime image pins Node `v22.2.0`; it builds ordinary Node with `./configure`, adds timeout adjustments, and uses `dumb-init` for subprocess tests. It is named `Dockerfile.x86_64`; do not silently promote that evidence to ARM64. [G3, G5, G6]

**V — Subsystem map.** `pkg/sentry/kernel/` models tasks, thread groups, signal state, clone/sharing, and exit; `kernel/futex/futex.go` plus `task_futex.go` separate futex-key and wait mechanics. `pkg/sentry/mm/` owns mappings and protection, with syscall decoding in `syscalls/linux/`. VFS resolution and fd lifetimes are under `pkg/sentry/vfs/`; writable RAM files are `fsimpl/tmpfs/`, synthetic process information `fsimpl/proc/`; `vfs/epoll.go`, `fsimpl/eventfd/`, and `fsimpl/timerfd/` share file/readiness machinery. [G4]

**V — Tests.** `test/syscalls/linux/*.cc` are Linux guest programs, unlike Sentry's Go unit tests. They run natively and under gVisor; the README explicitly says to verify new tests on Linux and notes man-page errors. Guest tests use gTest and `test/util/`. Current CI documentation covers ARM64 and 64 KiB-page Linux lanes. Save/restore markers such as `MaybeSave` are documented as ineffective in the open-source runner: they do not supply Sofort reset coverage automatically. [G2]

**I — Yoink:** syscall tests, precise partial-support notes, VMA/OFD/event abstractions, futex race cases. Translate selected architecture-independent algorithms, not an entire Go application kernel and garbage collector. Preserve the Apache provenance of derived code/tests. [G1]

### 3. Unikraft: modular compatibility components, with backend/version ambiguity

**V:** `app-elfloader` loads static and dynamic PIE Linux binaries and uses the syscall shim. The inspected open-source docs still specify x86-64 bincompat with AArch64 work ongoing, although the core supports ARM64. The catalog lists Node 18/20/21, Python 3.10/3.12/3.13, and a Node HTTP example. These are useful runtime milestones, but a catalog entry alone does not establish an exhaustive test pass, exact Node patch version, or W^X behavior. [U1, U2]

**V — Subsystem map.** In `unikraft/unikraft`: `lib/syscall_shim/` handles Linux syscall routing; `lib/posix-process/` supplies clone/process/signal machinery, including ARM64 signal assembly; `lib/posix-futex/futex.c` and its tests supply wait/wake support; `lib/posix-mmap/` and `lib/ukvmem/` split POSIX mapping semantics from VM machinery; `lib/posix-poll/epoll.c`, `posix-eventfd/`, and `posix-timerfd/` build event APIs. Both older `lib/ramfs/`/`vfscore` and newer `lib/ukfs-ramfs/` exist, so choose one coherent generation. A procfs-completeness contract was not established here. [U6]

**V — Licensing and testing.** Core policy is BSD-3-Clause with explicit per-library/file overrides; inspected elfloader `main.c` has its own BSD-3-Clause header. `lib/posix-futex/tests/` and `unikraft/lib-libc-test` are concrete test references; app testing/catalog demonstrations are a separate compatibility layer of evidence. [U5, U7]

**V/I — Critical qualification:** 2026 Cloud guides use `base-compat:latest` and ordinary Alpine Node images; current commercial descriptions now explicitly refer to a Linux-based image and trimmed Linux kernel. Do not infer that a current Cloud Node 26 demo certifies the public non-Linux `staging` kernel. Ask for/pin the actual kernel/runtime artifact when comparing Stage 3. [U3, U4]

### 4. Nanos and OPS: nearest architectural match to Sofort

**V:** Nanos runs one application in a VM, with a kernel/user boundary and preemptive threads; OPS packages/deploys it. It supports ARM64 as well as x86-64. Official examples invoke `eyberg/node:20.5.0` for hello-world and Express; the kernel tree has a `python_3.6.7` e2e fixture. **I:** absence of `--jitless` is evidence for an ordinary JIT-enabled configuration, not proof of each permission transition or of ARM64 parity. [N1–N3]

**V — Subsystem map.** `src/unix/thread.c`, `futex.c`, `signal.c`, `mmap.c`, `poll.c`, `eventfd.c`, and `timer.c` expose the relevant pieces. Futex entries are process-owned and use block queues/locks; `blockq.c` provides common blocking/wakeup mechanics. `klib/tmpfs.c` supplies RAM storage; `klib/special_files.c` is a useful place to inspect synthetic Linux files. `test/runtime/` contains futex, robust-futex, signal, epoll, eventfd, mapping, and filesystem tests, alongside application e2e tests. [N4, N5]

**V — Pitfalls.** The Nanos book describes an optional executable-mapping restriction that breaks many JITs and is not enabled by default. Its FAQ also emphasizes that shelling out to another process is outside the ordinary single-program model. Successful Node therefore does not imply working Node `child_process`/cluster, nor strict W^X. [N1, N2]

**I — Yoink:** the single-process simplification, a common cancellable block queue, and bounded objects rather than Linux-wide machinery. Adapt concepts from C while keeping Sofort's host policy boundary. Nanos is Apache-2.0; OPS is separately MIT, and is not where syscall compatibility lives. [N6]

### 5. OSv: valuable epoll/ramfs lessons; important ABI deviations

**V:** OSv supports AArch64 and x86-64 and publishes historical runtime support for Node 6.10.3/8.11.2 and Python 2.7, with its website also listing Python 3. Its release artifacts describe Node 8.11.2 built as a PIE shared library. The old `osv-apps/node` recipe is a source-built `libnode.so` integration, not proof that today's ordinary static Node ELF boots unchanged. [O2–O4]

**V — Subsystem map.** `core/epoll.cc` is explicitly BSD-licensed; `core/` scheduling and `libc/` implement threads/POSIX synchronization and futex-facing behavior. `libc/signal.cc`, architecture signal code, `core/mmu*`, libc mapping functions, `libc/eventfd.cc`, `libc/timerfd.cc`, `fs/ramfs/`, and `fs/procfs/` are useful references. Tests include `tst-epoll`, eventfd, timerfd, signal, and mmap-oriented cases. [O5]

**V — Pitfall:** the Linux ABI wiki explicitly describes signals delivered on a new thread rather than interrupting an existing one, single-address-space/process restrictions, and incomplete `/proc`. It is an old page with admitted stale sections, so it establishes a documented deviation, not every current limitation. **I:** do not copy that signal shortcut into a Linux-conformance target; it can change TLS, masks, interruption, and handler-thread identity. [O3]

**V/I — License:** OSv's top level is BSD-3-Clause but explicitly includes FreeBSD, OpenSolaris, Prex, and musl material. A CDDL-derived memory/filesystem file cannot be assumed BSD because neighboring `epoll.cc` is. Audit selected files individually. [O1]

### 6. StarryOS and ArceOS: strong permissive Rust candidates

**V:** ArceOS supplies modular Rust kernel facilities and multiple schedulers, but its own checklist leaves Linux application compatibility unchecked. StarryOS builds a monolithic Linux-style OS on top. Starry's kernel is `#![no_std]` with `alloc`; current dependencies include `axtask`, `axmm`, `axfs`, `axpoll`, `starry-process`, and `starry-signal`. Current licensing is Apache-2.0 with NOTICE; ArceOS's multi-license expression permits choosing Apache-2.0 for eligible source. [S1, S4]

**V — Subsystem map.** `kernel/src/task/` has per-thread state, `Arc<ProcessData>`, futex tables, signal integration, and timers. `task/futex.rs` distinguishes process-private and shared backing identities and supports wait bitsets/requeue. `file/fs.rs` resolves paths relative to `FsContext`/dirfds and supports no-follow/empty-path options. `file/epoll.rs` has interests, a ready queue, weak references, edge/one-shot modes, and rechecking around waker registration. `file/event.rs`, `pseudofs/tmp.rs`, `pseudofs/proc.rs`, `mm/aspace/`, and syscall families complete the reference map. [S2]

**V/U — Tests and runtime evidence.** GitHub workflows build and run rootfs/`ci-test` on four architectures including AArch64; that is stronger than a build-only platform list. This inspection did not establish a maintained syscall-argument coverage matrix, LTP pass denominator, or versioned Node/Python/JIT demonstration for this current repository. Avoid conflating historical Starry forks or OS-competition scores with the present tree. [S3]

**I — Yoink:** first inspect the fd/event/futex/process crates and path adapter as a unit. Rust and license fit are good, but their allocation, locks, task futures, and address spaces are ArceOS-specific. Porting one file without its ownership/lock assumptions is unsafe design reuse.

### 7. Kerla: small, comprehensible, and no longer maintained

**V:** Kerla is an x86-64 Rust Linux-ABI kernel with initramfs, tmpfs/devfs, fork/exec/signals, mmap/poll, and smoltcp networking. The README now declares it unmaintained and points to FTL. Its Node web-app page is explicitly a roadmap. The compatibility document describes musl support and incomplete glibc/dynamic support, and lists clone/mprotect and many calls unimplemented; because that table can lag source, use it as evidence of scope rather than a fresh completeness audit. [E1, E2]

**V — Pointers:** `kernel/fs/`, `kernel/process/`, `kernel/mm/`, `kernel/syscalls/`, `kernel/user_buffer.rs`, `kernel/poll.rs`, and `testing/`. Its checked user-buffer and small in-memory filesystem code are more useful for Stage 1 than a speculative Node port. **U:** complete Linux threads/futex/epoll/procfs behavior and a versioned Python/JIT milestone were not established. **I:** choose it as a readable comparison, not the maintained base for Stage 2. License is MIT/Apache-2.0. [E3]

### 8. Hermit-rs: reusable primitives, different application ABI

**V:** Hermit applications link `libhermit.a` and call its interfaces through their language runtime. It supports x86-64, AArch64, and RISC-V. Even its experimental `common-os` address-space mode does not imply Linux ABI: the inspected table has `exit=0`, `write=1`, `read=2`, and 32 slots. That differs from Linux numbers and contracts. [H1, H2]

**V — Pointers:** `src/scheduler/`, `src/synch/futex.rs`, `src/syscalls/futex.rs`, `src/fd/`, `src/fs/`, `src/mm/`, and optional `syscalls/mman.rs`. These supply native threads, synchronization, memory, fd/poll-like abstractions, and smoltcp integration. **U:** Linux signal-frame/clone/epoll/procfs conformance, a Linux syscall coverage table, or ordinary Node/Python binary compatibility was not established. Its Rust application demonstrations/tests are not Linux oracles. **I:** borrow small allocation/scheduler ideas under MIT/Apache, not its ABI numbering or assume that Hermit equals HermiTux. [H3]

### 9. Theseus: ownership research, not a Linux personality

**V:** Theseus is a Rust OS built around intralingual resource/state management, with MIT source, x86-64 support, and an incomplete AArch64 port. Its README warns a full AArch64 build does not cover every crate. Its published testing is native crate/build/QEMU testing. [Y1, Y2]

**U:** no verified Linux syscall-coverage contract or unmodified Linux Node/Python/JIT demonstration was found. Native task synchronization, signals/events, virtual memory, and files should not be counted as Linux `clone`/futex/`rt_sigreturn`/epoll/procfs support without an ABI layer. **I:** study typed ownership, task/file lifetime, and recovery to help structure reset-safe kernel objects; it is a lower-priority source for the particular Stage 1/2 syscall work.

### 10. Redox relibc: inspect the caller side of the ABI

**V:** relibc is an MIT Rust C library with Linux and Redox backends and ARM64 support. `src/platform/linux/` invokes Linux; `src/platform/redox/` uses Redox facilities and `redox-rt`. Therefore its Linux backend is not a Linux syscall implementation that can replace GrowOS handlers. [D1, D2]

**V — Pointers:** `src/pthread/`, `src/sync/`, `src/header/`, the dynamic loader, and `redox-rt` illustrate libc-level threading, TLS, synchronization, and signal adaptation. Its tests support host Linux and several target architectures. **I:** use this as a source for what a libc expects, and for selected C tests; retain musl as the first Node libc to avoid changing two compatibility layers at once. **U:** no unmodified Linux Node/Python/JIT milestone follows from relibc's Linux backend. `/proc`, epoll, and mmap calls in a libc are requests to a kernel, not implementations of kernel state. [D1]

### 11. Fuchsia Starnix: excellent Rust semantic reference, substantial platform coupling

**V:** Starnix runs unmodified Linux binaries by implementing Linux UAPI in a Fuchsia userspace component, rather than a Linux VM. The implementation README identifies tested glibc and bionic binaries. Current core has `arch/arm64`, `arch/x64`, and an additional RISC-V directory; directory presence alone is not a maturity claim. **U:** a version-pinned Linux Node/Python/JIT demonstration was not established. [Z2, Z3]

**V — Subsystem map.** The current root is `src/starnix/kernel/core/`: `task/{task,thread_group,current_task}.rs`, `mm/{futex_table,memory_manager,mapping,protection_flags}.rs`, `signals/`, architecture signal code, `vfs/{fs_context,namespace,fd_table,file_object,epoll,eventfd,timer}.rs`, and `fs/tmpfs.rs`. Procfs now lives among Starnix modules rather than requiring the old flat kernel path. These model Linux state over Zircon threads/VMOs/VMARs and Fuchsia services, not a freestanding MMU. [Z4]

**V — Tests:** `src/starnix/tests/` contains gVisor, LTP, kselftest, and its own C++/Rust syscall suites. Fuchsia documents running the same syscall tests against Linux through Machina, with kernel/environment details recorded. **I:** copy/adapt selected BSD-owned tests and state-machine designs; do not port the Fuchsia test framework or VM runtime into Sofort. Starnix-owned files use Fuchsia's BSD-style license; the inspected root license is two-clause, with a separate PATENTS grant and third-party exceptions. [Z1, Z5]

### 12. WSL1: clean-room translation and a warning about compatibility cost

**V:** WSL1 routes Linux ELF syscalls through lxcore/lxss kernel drivers. Microsoft describes translating to NT where semantics match and implementing Linux-specific behavior where they do not; fork requires special process-copy work. An LX instance owns processes, threads, and runtime state. Official 2017 material demonstrates Linux Node under WSL, but the inspected article does not fix an exact Node version or certify ARM64/W^X. [W1, W3]

**V:** Microsoft explicitly excluded `lxcore.sys` from its May 2025 WSL open-source release. Consequently the open WSL repository is not a source of copyable WSL1 futex, signal, mmap, epoll, or procfs internals. Release notes supply behavioral history, not implementation source or a current complete flag-coverage table. [W2, W4]

**I — Yoink:** own Linux state explicitly and emulate only the semantics that cannot be delegated. The move to actual Linux in WSL2 is evidence of the long-tail maintenance burden, not evidence that a small qualified single-program profile is useless. Treat WSL1 as design history, not a code donation.

### 13. Linux Kernel Library: actual Linux, not an independent implementation

**V:** LKL compiles Linux into a linkable object using an `arch/lkl` port and a host-operations interface. `tools/lkl/lib/` provides host integration; `liblkl-hijack.so` uses `LD_PRELOAD` to override selected calls. The documented use cases are Linux filesystems/networking embedded in other environments. This is not equivalent to independently executing all instructions and syscalls of an arbitrary Linux process. Host architecture support and `ARCH=lkl` must not be confused with an ARM64 guest ELF loader. [K1]

**V/I:** threads/timers/allocators are supplied by host operations; included Linux subsystems supply their own VFS/epoll/procfs behavior where configured, but userspace memory management, process/TLS/signals, and JIT execution still need a surrounding execution environment. `node-lkl`-style bindings mean Node uses LKL for filesystems, not that LKL runs Node. Tests under `tools/lkl/tests/` validate the library API. [K1, K2]

**V — License:** Linux is GPL-2.0 with a syscall exception; the exception permits normal userspace API use, not copying arbitrary kernel implementation into Apache/MIT. **I:** use real Linux as the oracle as GrowOS already plans; LKL is mainly an alternative research backend/reference, not a shortcut for Stage 2. [K3]

### 14. NetBSD rump and Rumprun: BSD/POSIX component reuse, not Linux ABI

**V:** rump extracts NetBSD kernel components behind a host interface; Rumprun adds a unikernel/toolchain environment. Its README advertises Node and Python among supported languages, but the mechanism is recompile/relink against the Rumprun/NetBSD environment. The Node recipe is explicit: **4.3.0**, NetBSD pkgsrc patches plus Rumprun patches, x86/x86-64 build selection, and `--without-snapshot`. That flag disables V8's build-time startup snapshot, not the JIT. [R1–R3]

**V — Pitfall:** that port could not support V8's `mmap(MAP_NORESERVE)` followed by `mmap(MAP_FIXED)` code-range allocation. It used a default fixed 16 MiB code range, configurable by `--code-range-size`. This is unusually concrete evidence of what a “runs Node” port had to change. [R2]

**V/I — Subsystems:** rump supplies BSD filesystem/network components; the surrounding Rumprun layer supplies scheduling, pthread/LWP support, memory, and signal/POSIX integration. NetBSD uses kqueue/poll concepts rather than making Linux epoll/futex/procfs completeness automatic. Existing NetBSD component tests are useful for a borrowed filesystem, not a Linux ABI oracle. Rumprun is BSD-2-Clause; its license explicitly warns about different licenses in imported NetBSD components. **U:** no modern ARM64 Node JIT certification follows from the old port. [R1, R4]

### 15. Graphene / Gramine: detailed LibOS semantics, but LGPL and SGX caveats

**V:** Gramine is Graphene's successor, primarily C, with Linux-direct and Intel SGX backends. Its feature guide documents roughly 170/360 calls, partial functionality, and pseudo-files; it also warns its last major guide update corresponds to November 2023/v1.6, so these are not a fresh 2026 count. The official Node example uses the system Node rather than pinning a version. Its manifest reserves a 2 GiB enclave address range, describes Node's large initial heap expectations, configures thread limits, and discusses `MAP_NORESERVE`/EDMM faults. [Q1, Q3]

**V — Pointers:** `libos/src/sys/libos_{clone,futex,mmap,epoll,eventfd,sigaction,getcwd}.c`, `libos/src/bookkeep/`, `libos/src/fs/`, and PAL host operations. Threads and Linux state are virtualized over PAL facilities; epoll and signals must coordinate with that state. The feature guide documents private-process-only futex semantics and several unimplemented operations. `libos/test/` and application examples provide regression tests; do not read its claimed Linux goal as universal compatibility. [Q2, Q4]

**V — JIT pitfall:** the guide explicitly says that without SGX EDMM, enclave pages have RWX permissions and `mprotect` is ignored; with EDMM, protections can be applied. An SGX Node demonstration therefore does not certify GrowOS's W^X requirement. **I:** adopt the documentation discipline and VMA/accounting concepts, not that protection shortcut. Main code is LGPL-3.0-or-later; selected examples are BSD-3-Clause and imported files differ. [Q1, Q5]

### 16. Occlum: reusable Rust LibOS algorithms with SGX dependencies

**V:** Occlum is a Rust multi-process SGX LibOS with C/assembly boundary code, targeting Intel x86-64. It uses SGX's Rust `std` environment rather than being a standalone `no_std` kernel. Own code is BSD-3-Clause. A glibc Python demo pins **3.8.10** with scientific libraries; the inspected demo index lists Python/Java/Go/Rust but no maintained Node recipe. **U:** versioned Node/V8 JIT evidence was not established. [C1–C3]

**V — Subsystem map.** `src/libos/src/fs/fs_view.rs` owns filesystem view/cwd; `file_table.rs`, `file.rs`, `inode_file.rs`, `file_ops/fspath.rs`, and `procfs/` separate fd, open-file, inode, and namespace concerns. `process/do_futex.rs` decodes operations/flags and models clock/relative-versus-absolute timeouts; `process/`, `signal/`, `vm/`, `events/`, `fs/events.rs`, `event_file.rs`, and `timer_file.rs` provide thread, VM, signal, readiness, eventfd, and timerfd machinery. Many pieces depend on host/SGX behavior and imported rcore filesystem traits. [C4]

**V — Tests:** focused C directories include `test/{file,open,mkdir,rename,link,symlink,truncate,pthread,signal,mmap,epoll,eventfd,timerfd,procfs}`. **I:** its pathname/fd/time representation and small test programs are attractive permissive candidates. Adapt data structures to `alloc`/bounded storage and Sofort scheduling; inspect dependencies rather than treating SGX `std` code as directly linkable bare-metal Rust. [C5]

### 17. Moss: especially relevant AArch64 newcomer

**V:** introduced publicly in late 2025, Moss is an MIT Rust/AArch64 kernel with dynamically linked Arch Linux userspace, bash/BusyBox/coreutils/strace, writable tmpfs, and procfs. Current raw README says **109 syscalls**, while older indexed descriptions say 105. Its current table marks futex, clone, mmap, and mprotect implemented, epoll partial, and eventfd/timerfd unimplemented. **U:** Node/Python/JIT runs were not established. [M1–M3]

**V — Pointers:** `src/process/{clone,epoll,fd_table}.rs`, thread/signal modules, `src/memory/`, `src/fs/`, filesystem drivers, and `libkernel/src/{memory,fs,sync}/`. Its async syscall design uses an interruptible-future combinator and lock discipline intended to prevent sleeping with a spinlock. The host-testable `libkernel` advertises 230+ unit tests; `usertest/` exercises runtime syscall behavior. These are project claims, not tests rerun here. [M1, M4]

**I — Yoink:** ARM64 ABI handling, VMA and user-address types, signal/wait cancellation structure, and compact tmpfs/procfs models. Validate table claims independently: a boolean “implemented” is not a documented argument/flag contract. Avoid committing to an async-kernel rewrite solely to reuse its filesystem.

### 18. FTL and Starina: fresh, small compatibility code to watch

**V:** FTL launched September 2026 as a Rust system with a Linux userspace-OS personality over a small kernel interface. Starina's repository now redirects to it. Unlike Starina's earlier Linux-VM experiment, current FTL implements a Linux personality itself. Version 0.1.0 added Linux threads, futex, epoll, signals, eventfd, and lazy anonymous pages; current changelog says waits are interruptible. Version **0.2.0, October 28**, adds Zones, VFS calls, improved epoll, quotas, and userspace page faults. The 0.1 blog and current changelog differ in the wording about interruptible syscalls; favor pinned current code/observations over the old sentence. [F1–F3]

**V — Pointers:** `lx/src/{process,thread,futex,signal,vm,wait_queue,fd_table,open_file}.rs`, `lx/src/vfs/`, `lx/src/syscall/`, and `tests/`. The personality is `no_std` with `alloc` and uses explicit kernel handles/VMOs/quotas. The September article documents musl HTTP-server execution on x86-64, with multithread Tokio working by October; Node is a stated target, not a demonstrated milestone in those sources. **U:** Python and AArch64 compatibility were not established. [F2, F4]

**I — Yoink:** small module boundaries and explicit allocation/wait interfaces under MIT/Apache. Do not copy its same-container trust assumptions: the author notes applications can interfere with their userspace OS. Its current LX entry point reserves a 128 MiB heap; a tiny kernel-core size does not establish a tiny total Linux personality. [F3, F4]

### 19. Networking building blocks: smoltcp and rustls

**V — smoltcp:** current main is version 0.14.0 with **0BSD**, optional `alloc`, and optional `std`; bare-metal consumers must disable unsuitable defaults. `src/phy/`, `iface/`, `socket/`, and `wire/` are the main seams. TCP exposes send/receive wakers, but each socket direction accepts only one registered waker at a time. Unit/fuzz-oriented protocol tests do not certify Linux sockets. **I:** put a kernel-owned readiness fan-out above these wakers; otherwise multiple pollers can overwrite each other's registrations. Implement Linux socket errors, nonblocking connect/accept, options, half-close, buffer accounting, and fd lifetime separately. [B1, B3]

**V — rustls:** licenses permit Apache/MIT/ISC use. A verified example of freestanding support is tag **0.23.35**: optional `std`, a no-std-capable unbuffered API, explicit crypto provider, and `TimeProvider`. Importantly, inspected **0.24.0-dev.2 main unconditionally imports `std`** despite a `#![no_std]` attribute used to control its prelude. Do not select main by keyword alone. Crypto providers, C/assembly dependencies, RNG, certificate trust, and wall time still require a target audit. [B2, B4]

**I:** Node normally supplies its own TLS library; running Node HTTPS needs socket/entropy/time compatibility, not replacing it with rustls inside EL1. For Sofort's existing trusted host-tool network path, guest networking is optional. Add smoltcp only for a workload requiring direct guest sockets; keep credentials/authorization in the established trusted host design.

### 20. Two additional references worth keeping distinct

**V — FreeBSD Linuxulator:** unlike rump, this is an actual Linux binary layer. The FreeBSD handbook lists x86 and AArch64, explains the `/compat/linux` userland and expected proc/sys/dev mounts, and notes gaps in system-management features. **I:** inspect `sys/compat/linux/` and ARM64 signal/ABI code when two clean reimplementations disagree; check individual source licenses before adapting BSD code. A native FreeBSD Node port is not Linuxulator Node evidence. No versioned Node/JIT milestone was established in this inspection. [X1]

**V — HermiTux:** separate from Hermit-rs, an older binary-compatible C unikernel with syscall trapping and optional call rewriting. Its kernel is BSD-3-Clause; the current README says it is no longer actively maintained and refers users to Unikraft. Main instructions are x86-64 with basic ARM64-board support. The VEE 2019 paper reports C/C++/Fortran/Python workloads, not a verified modern Node milestone. **I:** useful historical comparison for syscall-versus-library boundaries; not a maintained ARM64 Rust shortcut. [X2]

## What to yoink for Stage 1 / Stage 2

The following is a proposed implementation direction (**I**), grounded in the inspected sources, not work performed by this research task.

### Stage 1: real cwd plus disposable scratch RAM filesystems

**Local starting point (V).** `kernel/src/fs.rs` already separates fds from shared open descriptions, which is worth preserving. It currently has 64 fds, archive-only nodes/data, root-based `AT_FDCWD` resolution, and no mutable file data. `getcwd.rs` returns `/`. The retained grown `chdir` experiment can return success without changing cwd; its own report explains the missing state history. The path census's 50 visible + 16 held-out programs with only filesystem-write calls are an upper bound, not a promised unlock. [Local: `../../jitk/kernel/src/fs.rs`, `../../jitk/kernel/src/syscalls/getcwd.rs`, `../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md`]

| Design to adopt | Concrete reference | Sofort adaptation and acceptance history |
|---|---|---|
| **Separate inode, directory entry, open-file description, and fd** | gVisor `vfs/` and `fsimpl/tmpfs/`; Occlum `file_table.rs` / `inode_file.rs`; Moss `src/fs/open_file.rs` [G4, C4, M4] | Stable node ID/generation; fd has per-descriptor flags, shared description has offset/status flags. `dup` shares offset; independently opened fds do not. `unlink` removes a name while open handles retain the object. Test close/reuse and unlink-open-read histories. |
| **Cwd/root as namespace locations, not cached path strings** | Asterinas `fs/vfs/path/resolver.rs` and `thread_info.rs` (design only under MPL); Starry `file/fs.rs`; Occlum `fs_view.rs` [A6, S2, C4] | `chdir`/`fchdir` change state; `getcwd` reconstructs visible ancestry with Linux failure behavior. Resolve absolute paths independently of dirfd; relative paths through cwd or a directory fd. Test rename/unlink of cwd, `..`, repeated slashes, trailing slash, empty path, and invalid dirfd. |
| **One authoritative path walker** | Asterinas path resolver; gVisor VFS resolving paths; Occlum `file_ops/fspath.rs` [A6, G4, C4] | Share component, symlink, final-component, follow/no-follow, creation, and mount-crossing behavior across every `*at` call. Preserve byte paths; Linux names need not be UTF-8. Grow operation families over this primitive. |
| **Separate immutable archive and scratch mounts** | Nanos `klib/tmpfs.c`; Starry `pseudofs/tmp.rs`; gVisor tmpfs; MIT `rcore-fs` RAM filesystem [N4, S2, G4, B5] | Keep archive `/` read-only; add scratch `/tmp` and `/work`, initially cwd `/work`. Explicit node/data/fd quotas; page-chunked sparse file storage; zero holes and newly allocated bytes. Avoid full root overlay and archive whiteouts initially. |
| **Lifetime-aware mutable metadata** | gVisor tmpfs regular/directory/symlink files; Occlum file-op tests [G4, C5] | Correct `O_CREAT/O_EXCL/O_TRUNC/O_APPEND`, modes/umask, seek/pread/pwrite/truncate, link counts, rename replacement, directory cookies, and `stat` views for supported operations. Add links/rename coherently when promised; explicit unsupported results before that. |
| **Snapshot-owned state and compact allocation** | Sofort `heap.rs` lowest-free-page allocation; gVisor tmpfs checkpoint files as conceptual reference [Local, G4] | All mutable nodes, free lists, OFDs, cwd, and counters live in reset memory. Add canary A→B→A runs proving file names/data/offsets/quotas disappear on reset. Avoid clearing whole maximum-size arrays per operation. |

The existing `copyin`/`copyout` boundary is a good interface for generated handlers. A human-owned primitive layer should manage node allocation, fd sharing, path traversal, user access, and mutation rollback. Proposals then implement operations over that layer. Do not use `fsync=success` to imply durability: scratch has a deliberately nonpersistent contract. Quota errors should follow the declared scratch allocation model; Linux tmpfs's accounting includes different metadata costs, so byte-perfect ENOSPC thresholds need their own model rather than blind host matching.

### Stage 2a: enough Linux semantics for static musl Node `--jitless`

**Local starting point (V).** Canonical `rt_sigaction` and `rt_sigprocmask` return ENOSYS; `set_tid_address` returns 1 rather than tracking a clear-on-exit address. `mmap.rs` accepts only a narrow anonymous RW form, rejects nonzero hints/fixed mappings, and eagerly backs memory. `syscalls.rs`, `user.rs`, and `heap.rs` rely on the sole masked-IRQ kernel context and stopped EL0. These assumptions require redesign before concurrent threads. Ring heap pages and page tables already share a lowest-first physical pool, useful for minimizing reset dirties. [Local kernel files]

1. **Introduce task state before adding syscall names.** Preserve each thread's registers, SP, PC, TLS (`TPIDR_EL0` on ARM64), signal mask/pending state, clear-child-tid, and scheduler state; share address space, fd table, filesystem context, and dispositions according to supported clone flags. Start with pthread-style same-process clones. Reject unsupported process/namespace combinations explicitly. Reference gVisor kernel task/clone ownership and Starry `task/`/`starry-process`; consult Starnix's `task/` and ARM64 ABI. A single vCPU can schedule multiple guest threads; SMP is not required for the first milestone. [G4, S2, Z4]
2. **Make futex compare-and-park atomic relative to wake.** Key private futexes by address-space identity + aligned address; include backing-object/offset identity if shared mappings become supported. Recheck the user word under the queue protocol; handle mismatch, timeout, interruption, requeue, and cleanup exactly. Start with operations actually issued by pinned musl/Node, then expand. Clear-child-tid must zero the word and wake joiners on thread exit. Reference gVisor futex, Starry `task/futex.rs`, Occlum `do_futex.rs`, and Asterinas's waiter-cleanup explanation. [G4, S2, C4, A7]
3. **Use one interruptible wait mechanism.** Model ready, blocked, timed out, signaled, and exiting states explicitly. Futex, pipe, poll/epoll, and timers must coordinate so a wake cannot be lost between readiness testing and parking, and cancellation removes registrations. Nanos `blockq.c`, Moss interruptible futures, and FTL `wait_queue.rs` are good comparisons. A one-vCPU cooperative kernel still needs to yield on blocking calls and handle time/signal events. [N4, M1, F4]
4. **Implement real signals and ARM64 signal frames.** Separate process dispositions, thread masks, process/thread pending queues, altstack, delivery selection, syscall interruption/restart, `rt_sigreturn`, and register/FPSIMD restoration. `SA_RESTART` is syscall-dependent; `epoll_pwait` needs an atomic temporary mask change. Refer to Asterinas `arch/arm/signal.rs`, Starnix `arch/arm64`/`signals`, gVisor ARM64 signal code, and Starry's signal crate. Never adopt OSv's documented new-thread signal shortcut for a claim of Linux equivalence. [A8, Z4, G4, S2, O3]
5. **Add a VMA layer over physical allocation.** Track virtual reservation, permissions, anonymous/file backing, offsets, and resident pages separately. Support useful `PROT_NONE` reservations, hints/alignment, partial `mprotect`/unmap with VMA split/merge, `MAP_FIXED` replacement, `MAP_FIXED_NOREPLACE` collision behavior, zero-fill, and bounded physical allocation. Reservation must not eagerly dirty every page. Check pinned runtime needs for `madvise`, `mremap`, stack guards, and file-backed mmap. Study gVisor mm, Moss VMA utilities, Starnix mm, and FTL lazy VM. [G4, M4, Z4, F2, J1]
6. **Unify fd readiness, then implement epoll/eventfd/timerfd.** Use an interest registry and ready queue, subscribe/recheck to prevent missed wakeups, and preserve open-file lifetime across fd reuse/dup/close. Implement level, edge, one-shot, error/hangup, and timeout semantics within the promised contract. eventfd needs 64-bit counter/overflow/semaphore behavior; timerfd needs expiration counts and clock distinctions. Start from Starry `file/epoll.rs` and gVisor `vfs/epoll.go`; validate using gVisor tests. libuv's Linux backend uses epoll and has edge-triggered eventfd integration, so these are concrete Node requirements, not arbitrary syscall inventory expansion. [S2, G4, G7, J2]
7. **Build coherent minimal `/proc` and environment data.** Start with paths actually observed for the pinned runtime: candidates include `/proc/self/{maps,stat,statm,status,fd,exe}`, `/proc/{cpuinfo,meminfo}`, and selected `/sys` CPU files. Generate them from the same VM/fd/task state; expose guest budgets, not host machine claims. Support `/dev/null`, `/dev/zero`, random/getrandom, clocks, uname, resource limits, and affinity as demanded. Start from gVisor, Starnix, Nanos special files, and Starry/Moss procfs. Do not hardcode a host `statfs` structure just because a probe sees “written”. [G4, Z4, N4, S2, M1; local path report]

**I — Runtime acceptance ladder:** pin one static musl ARM64 Node binary and all build flags; first verify ELF/auxv/TLS startup and `node --jitless -e`, then real file/cwd operations, timers, libuv worker-pool tasks, signal interruption, and worker-thread creation/join/exit. Exercise GC/allocation pressure, OOM, timeout, and reset between jobs. Add selected Node/libuv tests only after the needed prerequisites exist. Distinguish a same-process Node worker from `child_process`/cluster, which need process creation/exec semantics beyond the first thread milestone. `--jitless` disables generated executable code in that runtime mode; it does not remove pthreads, GC, large address reservations, or ordinary libc/platform calls. [J1, J2]

### Stage 2b: JIT with writable↔executable transitions, never both

**I — Required design:** treat permissions as enforced mapping state, not a handler-return convention. For every transition, validate range/alignment and existing mappings, split VMAs as necessary, update ARM64 page tables and aliases, perform the required TLB/barrier/cache protocol, and make instruction/data visibility correct before another thread executes. Audit the userland cache-maintenance path used by the pinned Linux V8 build as well as `mprotect`; Sofort currently synchronizes I-cache at initial load, which is not itself a complete runtime-JIT contract.

Test RW→RX→RW→RX code changes, attempted writes while RX, attempted execution while RW, protected holes, remapping, and cross-thread publication. Cover writable aliases of executable backing, user/kernel aliases, and concurrent access/protection changes. Snapshot/reset must restore permission/VMA/page-table state as well as bytes and allocator counters. Instruction-cache state must agree with restored code pages before execution resumes.

**V/I — Evidence limits:** Nanos's optional execution restriction can break JITs; Gramine without EDMM documents RWX pages and ignored `mprotect`; Rumprun patched code-range allocation. Their Node success is not a W^X certificate. Ordinary V8 Linux platform code exposes `MAP_NORESERVE`, `PROT_NONE`, fixed remapping, and `mprotect`, but the exact Node version/build must be checked for RWX requests, dual mappings, code-cage alignment, and optional sandbox reservations. If that unmodified build requires RWX, report the incompatibility and qualify an explicit supported build/configuration rather than silently weakening W^X. [N2, Q1, R2, J1]

**I — Stage 3 implication:** compare complete, pinned runtime profiles against a matched warmed Firecracker/Linux baseline only after the above functionality works. A guest reset of small QuickJS jobs is not a Node/JIT reset-cost measurement. Linux-backed commercial snapshots also belong in the comparison, clearly labeled by backend.

## Test suites to adopt

Tests are executable specifications and bug detectors; **pinned Linux remains the reference implementation**, not gVisor/Asterinas/another reimplementation. No test suite was run in this task.

| Priority | Suite and concrete locations | Reuse/license | Initial selection and prerequisite limits |
|---|---|---|---|
| **1** | **gVisor syscall tests**, `test/syscalls/linux/`, `test/util/` [G2, G7] | Apache-2.0; C++/gTest; retain notices | Stage 1: `open.cc`, `open_create.cc`, `stat.cc`, `rename.cc`, `unlink.cc` and related dir/cwd/fd cases. Stage 2: `futex.cc`, `processes.cc`, `mmap.cc`, `rtsignal.cc`, `sigprocmask.cc`, `epoll.cc`, `eventfd.cc`, `timerfd.cc`, `proc.cc`. Select individual cases: many full binaries assume fork, signals, sockets, dynamic loading, or extensive `/proc`. Port the guest harness, not Sentry. |
| **2** | **LTP**, `testcases/kernel/syscalls/`, `runtest/syscalls`; `testcases/open_posix_testsuite/` for pthread/signal interfaces [T1, T2] | Generally GPL-2.0-family; check individual headers/data. Keep as separate guest tests | File/cwd/openat/rename/unlink/truncate first; then futex/clone/mprotect/epoll/eventfd/timerfd/signal. Root/mount/namespace/multiprocess/stress tests need classification, not a fabricated pass. Use single executables and a small manifest before trying Kirk or the whole suite. Asterinas's `20260529` pin is a useful common comparison point, not necessarily the best latest release. |
| **3** | **musl libc-test**, `src/functional/`, `src/regression/`, `src/common/`; the official musl wiki points to upstream [T3, T4] | Generally MIT; `COPYRIGHT` explicitly identifies BSD/GPL-derived math vectors | Small static C executables expose pthread, TLS, condition variable, semaphore, signal, mmap, file, and libc fallback behavior. Good fit for the first static-musl profile. Math/API-header tests mostly test libc/compiler rather than the kernel. Pin upstream; mirrors used for license inspection must not silently replace it. |
| **4** | **Asterinas-owned regression tests**, `test/initramfs/src/regression/{fs,io,memory,process,ipc,time}/`; conformance adapters under `src/conformance/` [A9] | Own tests generally MPL-2.0; imported gVisor/LTP/kselftest retain their licenses | Useful small C regression cases, feature-selected conformance manifests, and distinction between kernel unit tests and guest tests. Preserve upstream conditions/expected failures; do not count the same imported LTP test twice as independent evidence. |
| **5** | **Starnix syscall tests**, `src/starnix/tests/syscalls/{cpp,rust}/`, plus gVisor/LTP/kselftest adapters [Z5] | Starnix-owned files BSD-style; imported suites separately licensed | Fuchsia's Machina guide directly models dual execution on Linux and the compatibility layer. Extract guest tests and fixtures; avoid depending on Fuchsia's component framework. Verify per-file ABI architecture assumptions. |
| **6** | **Nanos `test/runtime/`**, **Occlum `test/`**, **Moss `usertest/`**, **Starry CI/rootfs** [N5, C5, M4, S3] | Nanos Apache-2.0; Occlum BSD-3; Moss MIT; Starry Apache-2, dependencies separately | Smaller implementation-regression cases and alternative histories. Recheck on Linux: tests can encode intentional unikernel/SGX deviations. Starry's current workflow alone does not establish a particular LTP denominator. |
| **7** | **Node and libuv upstream suites**, plus gVisor's pinned runtime image recipe [G3, J2] | Node MIT with bundled third-party notices; libuv MIT-style; inspect tests/fixtures | Start with selected fs/path/timer/worker/async tests and explicit JIT permission tests, then broaden. Process spawning, networking, inspectors, and native addons require separate profiles. gVisor uses longer timeouts and `dumb-init`; these environmental choices are part of a meaningful comparison. |
| Later | **Linux kselftest**, xfstests, syzkaller; **Converos/model checking** [A9, Z5, P2] | Mixed GPL-compatible kernel tests; syzkaller Apache-2.0; model artifacts need own license check | Selected VM/futex tests and minimized reproducers once primitives exist. xfstests needs a substantial filesystem/tool environment. syzkaller finds crashes/races, not Linux semantic equivalence by itself; host/model checking of wait-state machines complements differential execution. No broad stress campaign on the shared laptop. |

### Proposed oracle protocol

1. **Pin artifacts and environment:** guest binary hash, source revision, compiler/libc, Linux release/config/architecture/page size, uid/gid, limits, clocks, filesystem tree/mounts, cwd, environment, and kernel/snapshot hashes. Test on ARM64 Linux; x86-64 ABI success does not validate ARM64 layouts or signal frames.
2. **Run identical guest binaries:** capture syscall return/errno, exact output-buffer fields/bytes, file contents/metadata, offsets, task-exit behavior, and intermediate state. Some libc wrappers transform raw Linux returns; keep raw-syscall and libc-interface tests distinct. Decode architecture-specific structures explicitly.
3. **Hold back histories and environments:** independently generate directory topology, names, open/rename/unlink sequences, descriptor reuse, mapping/protection sequences, and deterministic scheduler interleavings. Merely changing constants in the same single-call template repeats GrowOS's cwd blind spot.
4. **For concurrency, compare allowed behavior rather than one observed schedule:** stable invariants, happens-before relationships, wake counts, completed joins, and controlled timeout windows. Inject schedules at compare/enqueue/park/wake boundaries. Timing tolerances must not erase deadlocks or missed wakeups.
5. **Classify every result:** PASS, semantic FAIL, unsupported prerequisite/configuration, timeout, crash, build failure. Publish supported-operation denominators and exclusions. Unsupported tests are not passes; deliberate product restrictions need an explicit contract.
6. **Add semantic mutants:** unchanged cwd; copied rather than shared fd offset; reclaimed unlinked open node; reused fd mistaken for old epoll interest; missed clear-child-tid wake; signal mask not restored; futex waiter leaked after timeout; `mprotect` returning success without changing permissions; stale code after reset. Known-wrong candidates must fail the relevant histories before a passing generated handler is trusted.
7. **Qualify the deployed path:** console growth tests and ring/native execution differ. Run accepted tests on the exact ring image, memory class, backend, and snapshot. Add A→B→A reset histories including threads, waiters, timers, RNG reseeding, scratch, and executable-page permissions. gVisor `MaybeSave` annotations do not do this for us.

## Pitfalls

### Documented upstream

- **Compatibility counts hide flag gaps.** gVisor marks partial support; Asterinas now documents flags; Gramine explicitly lists ignored options. A high syscall count says little about atomicity, byte layouts, error precedence, or persistent state. Asterinas's published `MAP_FIXED_NOREPLACE` shortcut is specifically unsuitable for faithful Linux behavior. [G5, A10, Q1]
- **JIT demonstrations can bypass the hard part.** Rumprun changed V8 code-range reservation; older OSv Node was rebuilt as PIE; Gramine's non-EDMM protection behavior is RWX; Nanos warns its optional execution restriction breaks JITs. Keep application portability, binary compatibility, and strict W^X as separate claims. [R2, O2, Q1, N2]
- **Memory size claims mix incompatible quantities.** Gramine's Node example requests a large enclave VA range; FTL's tiny kernel-core claim coexists with a 128 MiB LX heap reservation. Reserved virtual space, committed pages, peak RSS, copied dirty pages, and full system footprint are different metrics. [Q3, F3, F4]
- **Signals and waits are expensive semantic work.** OSv documented a different delivery-thread model; Asterinas explicitly cleans canceled futex waiters to avoid exhaustion; Converos found concurrency defects despite Rust. A completed single-thread hello-world is weak evidence for Node worker/GC behavior. [O3, A7, P2]
- **Platform support is not runtime support.** Asterinas ARM64 entered at Tier 2 this month; Unikraft bincompat docs are narrower than its core architecture list; a Rumprun ARM platform does not make its x86-only Node recipe ARM64-capable. [A3, U1, R3]
- **Project names/backends change.** Kerla is unmaintained; Starina moved to FTL; FTL differs from Starina's earlier Linux-VM route; Graphene became Gramine; Hermit-rs differs from HermiTux; current Unikraft Cloud descriptions include Linux. Pin implementations rather than inheriting a brand's historical compatibility claims. [E1, F1, Q2, X2, U4]
- **Open-source announcements do not cover everything.** Microsoft's WSL release expressly excludes lxcore. Asterinas remains MPL; Gramine remains LGPL; OSv/Unikraft have imported-license exceptions; libc-test's MIT umbrella has math exceptions. [W2, A2, Q5, O1, U5, T3]

### Specific consequences for GrowOS (inference unless marked local)

- **Local V:** path-honest read-only handlers added only one visible corpus pass; `chdir` remained state-incomplete. Make stateful scratch operations the unit of growth and acceptance rather than celebrating registered handlers.
- **Local V/I:** `copyin`/`copyout` assume stopped EL0; current fd guards reject reentry with EBUSY. Multiple threads invalidate simple user-pointer validation followed by later access. Define syscall scheduling, mapping locks/pinning, atomic user-memory access, and lock ordering before permitting interleaving; do not hold mutable references or unrelated locks across waits.
- **I:** host Linux and guest must see the same filesystem and limits, but not necessarily identical allocator accounting. The existing shared-tree oracle corrected a writable-`/tmp` mismatch; mutable trees now need matched mount topology plus independent quota semantics and observed post-state.
- **I:** never turn optional syscall probing into fake success. Correct ENOSYS/EINVAL/EPERM distinctions affect libc/libuv fallbacks; support newer alternatives only when their behavior is implemented. Log which fallback the pinned runtime actually selects.
- **I:** prevent reset amplification. Eagerly zeroing a huge scratch area, scanning/writing all VMA metadata, or touching every page of a reserved V8 region can erase the current dirty-page-reset advantage without increasing useful guest work.
- **I:** after threads/JIT, reset includes runnable/blocked tasks, signal queues, TLS, timer deadlines, readiness subscriptions, cache/TLB state, permission changes, and guest/host registrations. Restore bytes alone is not a complete reset if any host-owned thread/timer/reference survives.
- **I:** a single-process profile can run useful Node while explicitly excluding process spawning. State that restriction; do not call it general Node compatibility. Likewise `--jitless` and JIT-enabled profiles need separate qualification and memory budgets.

## Sources and reproducibility notes

Primary project repositories, first-party documentation, and authors' papers/posts are used below. Runtime demonstrations were inspected, not reproduced. “U” claims above mean the inspected sources did not establish the requested property, not an exhaustive proof that no demonstration exists. The GitHub API hit a read rate limit during tree inspection; public repository pages/raw files were used for the remaining checks. libc-test's canonical hosts were unavailable/challenge-protected, so its license text was cross-checked in two source mirrors and its identity against the official musl wiki.

### Local context read

- [jitk README](../../jitk/README.md) and [architecture](../../jitk/docs/ARCHITECTURE.md).
- [syscall helpers](../../jitk/kernel/src/syscalls.rs), [handlers](../../jitk/kernel/src/syscalls/), [heap](../../jitk/kernel/src/heap.rs), [filesystem](../../jitk/kernel/src/fs.rs), [user setup/access](../../jitk/kernel/src/user.rs).
- [GrowOS controller README](../../jitk/grow/README.md), [path-filesystem experiment](../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md).
- [GrowOS fit summary](../growos-fit/SUMMARY.md), [growth method and oracles](../growos-fit/03-GROWTH-METHOD-AND-ORACLES.md).

### Asterinas, architecture papers, licenses

- **A1:** [Asterinas repository](https://github.com/asterinas/asterinas), [COPYRIGHT](https://github.com/asterinas/asterinas/blob/main/COPYRIGHT), [MPL text](https://github.com/asterinas/asterinas/blob/main/LICENSE-MPL).
- **A2:** [Per-file license configuration](https://github.com/asterinas/asterinas/blob/main/.licenserc.yaml).
- **A3:** [0.19.0 release announcement, 2026-10-13](https://asterinas.github.io/2026/10/13/announcing-asterinas-0.19.0.html), [release notes](https://github.com/asterinas/asterinas/blob/main/RELEASES.md).
- **A4:** [Linux ABI coverage](https://asterinas.github.io/book/kernel/linux-compatibility/), [source](https://github.com/asterinas/asterinas/blob/main/book/src/kernel/linux-compatibility/README.md).
- **A5:** [Node and Python application instructions](https://github.com/asterinas/asterinas/blob/main/book/src/distro/popular-applications/development-tools/README.md).
- **A6:** [Path/VFS sources](https://github.com/asterinas/asterinas/tree/main/kernel/core/src/fs/vfs/path), [thread filesystem context](https://github.com/asterinas/asterinas/blob/main/kernel/core/src/fs/thread_info.rs), [RAM filesystems](https://github.com/asterinas/asterinas/tree/main/kernel/core/src/fs/fs_impls).
- **A7:** [Futex implementation and cancellation comments](https://github.com/asterinas/asterinas/blob/main/kernel/core/src/process/posix_thread/futex.rs).
- **A8:** [Signal state](https://github.com/asterinas/asterinas/tree/main/kernel/core/src/process/signal), [ARM signal ABI](https://github.com/asterinas/asterinas/blob/main/kernel/core/src/arch/arm/signal.rs), [epoll](https://github.com/asterinas/asterinas/tree/main/kernel/core/src/events/epoll), [mprotect](https://github.com/asterinas/asterinas/blob/main/kernel/core/src/syscall/mprotect.rs).
- **A9:** [Regression tests](https://github.com/asterinas/asterinas/tree/main/test/initramfs/src/regression), [conformance suites](https://github.com/asterinas/asterinas/tree/main/test/initramfs/src/conformance), [LTP version recipe](https://github.com/asterinas/asterinas/blob/main/test/initramfs/nix/conformance/ltp.nix).
- **A10:** [Flag-coverage framework](https://github.com/asterinas/asterinas/tree/main/book/src/kernel/linux-compatibility/syscall-flag-coverage), [memory-management limitations](https://github.com/asterinas/asterinas/blob/main/book/src/kernel/linux-compatibility/syscall-flag-coverage/memory-management/README.md).
- **P1:** [Asterinas framekernel paper, 2025](https://arxiv.org/abs/2506.03876), [authors' USENIX overview](https://www.usenix.org/publications/loginonline/asterinas-rust-based-framekernel-reimagine-linux-2020s).
- **P2:** [Converos, ATC 2025](https://www.usenix.org/conference/atc25/presentation/tang), [paper](https://www.usenix.org/system/files/atc25-tang.pdf).
- **L1:** [Mozilla MPL 2.0 FAQ, particularly Q8–Q13](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).

### gVisor, Unikraft, Nanos, OSv

- **G1:** [gVisor Apache license](https://github.com/google/gvisor/blob/master/LICENSE).
- **G2:** [Syscall-test methodology and CI](https://github.com/google/gvisor/blob/master/test/syscalls/README.md).
- **G3:** [Node 22.2.0 runtime-test image](https://github.com/google/gvisor/blob/master/images/runtimes/nodejs22.2.0/Dockerfile.x86_64), [Python runtime image](https://github.com/google/gvisor/tree/master/images/runtimes/python3.12.3).
- **G4:** [Sentry kernel](https://github.com/google/gvisor/tree/master/pkg/sentry/kernel), [futex](https://github.com/google/gvisor/tree/master/pkg/sentry/kernel/futex), [memory](https://github.com/google/gvisor/tree/master/pkg/sentry/mm), [VFS](https://github.com/google/gvisor/tree/master/pkg/sentry/vfs), [filesystem implementations](https://github.com/google/gvisor/tree/master/pkg/sentry/fsimpl), [syscall wrappers](https://github.com/google/gvisor/tree/master/pkg/sentry/syscalls/linux).
- **G5:** [Generated ARM64 syscall coverage](https://gvisor.dev/docs/user_guide/compatibility/linux/arm64/).
- **G6:** [Application compatibility and runtime regression policy](https://gvisor.dev/docs/user_guide/compatibility/).
- **G7:** [Linux syscall guest tests](https://github.com/google/gvisor/tree/master/test/syscalls/linux), [test helpers](https://github.com/google/gvisor/tree/master/test/util).
- **U1:** [Open-source compatibility scope](https://unikraft.org/docs/concepts/compatibility), [app-elfloader](https://github.com/unikraft/app-elfloader).
- **U2:** [Application/runtime catalog](https://github.com/unikraft/catalog).
- **U3:** [2026 Node/Express Cloud guide](https://unikraft.com/docs/guides/httpserver-expressjs4.18-node21), [current Cloud examples](https://github.com/unikraft-cloud/examples).
- **U4:** [Current commercial backend description](https://unikraft.com/), [technical overview](https://unikraft.com/how-it-works).
- **U5:** [Core licensing policy](https://github.com/unikraft/unikraft/blob/staging/COPYING.md), [elfloader source license](https://github.com/unikraft/app-elfloader/blob/staging/main.c).
- **U6:** [Unikraft modular libraries](https://github.com/unikraft/unikraft/tree/staging/lib), [futex](https://github.com/unikraft/unikraft/tree/staging/lib/posix-futex), [signal implementation](https://github.com/unikraft/unikraft/tree/staging/lib/posix-process/signal).
- **U7:** [Unikraft libc-test integration](https://github.com/unikraft/lib-libc-test), [futex tests](https://github.com/unikraft/unikraft/tree/staging/lib/posix-futex/tests).
- **N1:** [Nanos FAQ](https://nanos.org/faq), [kernel README](https://github.com/nanovms/nanos).
- **N2:** [Nanos book: architecture, scheduling, executable restrictions](https://nanos.org/thebook).
- **N3:** [Node 20.5.0 hello-world](https://github.com/nanovms/ops-examples/blob/master/javascript/01-hello-world/README.md), [Express example](https://github.com/nanovms/ops-examples/blob/master/javascript/09-express/README.md).
- **N4:** [Unix compatibility sources](https://github.com/nanovms/nanos/tree/master/src/unix), [tmpfs](https://github.com/nanovms/nanos/blob/master/klib/tmpfs.c), [synthetic files](https://github.com/nanovms/nanos/blob/master/klib/special_files.c).
- **N5:** [Runtime tests](https://github.com/nanovms/nanos/tree/master/test/runtime), [e2e applications](https://github.com/nanovms/nanos/tree/master/test/e2e).
- **N6:** [Nanos license](https://github.com/nanovms/nanos/blob/master/LICENSE), [OPS license](https://github.com/nanovms/ops/blob/master/LICENSE).
- **O1:** [OSv license and imported projects](https://github.com/cloudius-systems/osv/blob/master/LICENSE), [individual license files](https://github.com/cloudius-systems/osv/tree/master/licenses).
- **O2:** [OSv releases and historical Node artifacts](https://github.com/cloudius-systems/osv/releases).
- **O3:** [OSv Linux ABI deviations](https://github.com/cloudius-systems/osv/wiki/OSv-Linux-ABI-Compatibility).
- **O4:** [AArch64 status](https://github.com/cloudius-systems/osv/wiki/AArch64), [Node source-port recipe](https://github.com/cloudius-systems/osv-apps/tree/master/node), [runtime list](https://osv.io/).
- **O5:** [BSD epoll implementation](https://github.com/cloudius-systems/osv/blob/master/core/epoll.cc), [filesystem sources](https://github.com/cloudius-systems/osv/tree/master/fs), [tests](https://github.com/cloudius-systems/osv/tree/master/tests).

### Rust kernels, Starnix, WSL, LibOSes, component libraries

- **S1:** [StarryOS](https://github.com/Starry-OS/StarryOS), [LICENSE](https://github.com/Starry-OS/StarryOS/blob/main/LICENSE), [NOTICE](https://github.com/Starry-OS/StarryOS/blob/main/NOTICE).
- **S2:** [Starry kernel source](https://github.com/Starry-OS/StarryOS/tree/main/kernel/src), [futex](https://github.com/Starry-OS/StarryOS/blob/main/kernel/src/task/futex.rs), [epoll](https://github.com/Starry-OS/StarryOS/blob/main/kernel/src/file/epoll.rs), [path adapter](https://github.com/Starry-OS/StarryOS/blob/main/kernel/src/file/fs.rs), [dependencies](https://github.com/Starry-OS/StarryOS/blob/main/kernel/Cargo.toml).
- **S3:** [Four-architecture CI](https://github.com/Starry-OS/StarryOS/blob/main/.github/workflows/test.yml), [runtime-test template](https://github.com/Starry-OS/StarryOS/blob/main/.github/workflows/test-template.yml).
- **S4:** [ArceOS scope](https://github.com/arceos-org/arceos), [license selection](https://github.com/arceos-org/arceos/blob/main/Cargo.toml).
- **E1:** [Kerla README/status](https://github.com/nuta/kerla).
- **E2:** [Kerla compatibility document](https://github.com/nuta/kerla/blob/main/Documentation/compatibility.md).
- **E3:** [Kerla source](https://github.com/nuta/kerla/tree/main/kernel), [license](https://github.com/nuta/kerla/blob/main/LICENSE.md).
- **H1:** [Hermit-rs application model](https://github.com/hermit-os/hermit-rs), [kernel/architectures/license](https://github.com/hermit-os/kernel).
- **H2:** [Experimental common-os configuration](https://github.com/hermit-os/kernel/blob/main/Cargo.toml), [non-Linux syscall table](https://github.com/hermit-os/kernel/blob/main/src/syscalls/table.rs).
- **H3:** [Hermit subsystem sources](https://github.com/hermit-os/kernel/tree/main/src), [syscalls](https://github.com/hermit-os/kernel/tree/main/src/syscalls).
- **Y1:** [Theseus design/ARM64 status](https://github.com/theseus-os/Theseus/blob/theseus_main/README.md), [papers](https://theseus-os.github.io/Theseus/book/misc/papers_presentations.html).
- **Y2:** [Theseus MIT license](https://github.com/theseus-os/Theseus/blob/theseus_main/LICENSE-MIT).
- **D1:** [relibc purpose, tests, architectures](https://github.com/redox-os/relibc/blob/master/README.md), [backends](https://github.com/redox-os/relibc/tree/master/src/platform).
- **D2:** [relibc MIT license](https://github.com/redox-os/relibc/blob/master/LICENSE).
- **Z1:** [Fuchsia licensing policy](https://fuchsia.dev/fuchsia-src/contribute/governance/policy/open-source-licensing-policies), [root BSD-style license](https://fuchsia.googlesource.com/fuchsia/+/refs/heads/main/LICENSE), [PATENTS](https://fuchsia.googlesource.com/fuchsia/+/refs/heads/main/PATENTS).
- **Z2:** [Starnix overview](https://fuchsia.dev/fuchsia-src/concepts/components/v2/starnix), [implementation README](https://fuchsia.googlesource.com/fuchsia/+/refs/heads/main/src/starnix/kernel/README.md).
- **Z3:** [RFC-0082 design](https://fuchsia.dev/fuchsia-src/contribute/governance/rfcs/0082_starnix).
- **Z4:** [Current Starnix core](https://fuchsia.googlesource.com/fuchsia/+/refs/heads/main/src/starnix/kernel/core/), [mm](https://fuchsia.googlesource.com/fuchsia/+/refs/heads/main/src/starnix/kernel/core/mm/), [VFS](https://fuchsia.googlesource.com/fuchsia/+/refs/heads/main/src/starnix/kernel/core/vfs/), [modules](https://fuchsia.googlesource.com/fuchsia/+/refs/heads/main/src/starnix/modules/).
- **Z5:** [Starnix tests](https://fuchsia.googlesource.com/fuchsia/+/refs/heads/main/src/starnix/tests/), [dual Linux/Machina testing guide](https://fuchsia.dev/fuchsia-src/development/starnix/machina_runtime_for_linux_testing), [syzkaller Starnix integration](https://github.com/google/syzkaller/blob/master/docs/starnix/README.md).
- **W1:** [Microsoft WSL1 architecture](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/cmdline/wsl-architectural-overview).
- **W2:** [Microsoft's 2025 open-source announcement and exclusions](https://blogs.windows.com/windowsdeveloper/2025/05/19/the-windows-subsystem-for-linux-is-now-open-source/).
- **W3:** [Official Linux Node-on-WSL demonstration](https://devblogs.microsoft.com/commandline/running-node-js-on-wsl-from-visual-studio-code/).
- **W4:** [WSL behavioral release notes](https://learn.microsoft.com/en-us/windows/wsl/release-notes).
- **K1:** [LKL design and host interface](https://github.com/lkl/linux/blob/master/Documentation/lkl/lkl.txt), [host operations](https://github.com/lkl/linux/blob/master/arch/lkl/include/uapi/asm/host_ops.h).
- **K2:** [LKL host library/tests](https://github.com/lkl/linux/tree/master/tools/lkl).
- **K3:** [Linux kernel licensing rules](https://www.kernel.org/doc/html/latest/process/license-rules.html), [LKL COPYING](https://github.com/lkl/linux/blob/master/COPYING).
- **R1:** [Rumprun model and platforms](https://github.com/rumpkernel/rumprun).
- **R2:** [Rumprun Node 4.3.0 port and code-range caveat](https://github.com/rumpkernel/rumprun-packages/blob/master/nodejs/README.md).
- **R3:** [Node build/architecture configuration](https://github.com/rumpkernel/rumprun-packages/blob/master/nodejs/Makefile).
- **R4:** [Rumprun license/import caveats](https://github.com/rumpkernel/rumprun/blob/master/LICENSE), [NetBSD rump tests](https://github.com/NetBSD/src/tree/trunk/tests/rump).
- **Q1:** [Gramine feature/quirk guide](https://gramine.readthedocs.io/en/stable/devel/features.html).
- **Q2:** [Gramine repository](https://github.com/gramineproject/gramine), [syscall implementations](https://github.com/gramineproject/gramine/tree/master/libos/src/sys).
- **Q3:** [Node example](https://github.com/gramineproject/examples/tree/master/nodejs), [memory/thread/EDMM manifest](https://github.com/gramineproject/examples/blob/master/nodejs/nodejs.manifest.template).
- **Q4:** [Gramine regression tests](https://github.com/gramineproject/gramine/tree/master/libos/test).
- **Q5:** [Gramine LGPL text](https://github.com/gramineproject/gramine/blob/master/LICENSE.txt), [licensing addendum/exceptions](https://github.com/gramineproject/gramine/blob/master/LICENSE.addendum.txt).
- **C1:** [Occlum overview](https://github.com/occlum/occlum), [BSD license](https://github.com/occlum/occlum/blob/master/LICENSE).
- **C2:** [Demo index](https://github.com/occlum/occlum/blob/master/demos/README.md).
- **C3:** [glibc Python demo](https://github.com/occlum/occlum/tree/master/demos/python/python_glibc), [3.8.10 environment recipe](https://github.com/occlum/occlum/blob/master/demos/python/python_glibc/install_python_with_conda.sh).
- **C4:** [Occlum LibOS](https://github.com/occlum/occlum/tree/master/src/libos/src), [filesystem view/fd/path modules](https://github.com/occlum/occlum/tree/master/src/libos/src/fs), [futex](https://github.com/occlum/occlum/blob/master/src/libos/src/process/do_futex.rs).
- **C5:** [Occlum guest C tests](https://github.com/occlum/occlum/tree/master/test).
- **M1:** [Moss current raw README](https://github.com/hexagonal-sun/moss-kernel/blob/master/README.md).
- **M2:** [Moss ARM64 syscall-status table](https://github.com/hexagonal-sun/moss-kernel/blob/master/etc/syscalls_linux_aarch64.md).
- **M3:** [Moss MIT license](https://github.com/hexagonal-sun/moss-kernel/blob/master/LICENSE).
- **M4:** [Moss kernel modules](https://github.com/hexagonal-sun/moss-kernel/tree/master/src), [libkernel](https://github.com/hexagonal-sun/moss-kernel/tree/master/libkernel), [usertest](https://github.com/hexagonal-sun/moss-kernel/tree/master/usertest).
- **F1:** [Starina redirect](https://github.com/starina-os/starina), [FTL repository/license](https://github.com/nuta/ftl).
- **F2:** [FTL current changelog, including 0.2.0](https://github.com/nuta/ftl/blob/main/CHANGELOG.md).
- **F3:** [Introducing FTL, 2026-09-14](https://seiya.me/blog/introducing-ftl), [0.1.0 article, 2026-10-03](https://seiya.me/blog/ftl-v0.1.0).
- **F4:** [FTL Linux personality](https://github.com/nuta/ftl/tree/main/lx/src), [LX allocation/entry point](https://github.com/nuta/ftl/blob/main/lx/src/main.rs), [tests](https://github.com/nuta/ftl/tree/main/tests).
- **B1:** [smoltcp](https://github.com/smoltcp-rs/smoltcp), [current features/license](https://github.com/smoltcp-rs/smoltcp/blob/main/Cargo.toml), [0BSD text](https://github.com/smoltcp-rs/smoltcp/blob/main/LICENSE-0BSD.txt).
- **B2:** [rustls license options](https://github.com/rustls/rustls/blob/main/LICENSE), [0.23.35 features](https://github.com/rustls/rustls/blob/v/0.23.35/rustls/Cargo.toml), [current 0.24-dev source](https://github.com/rustls/rustls/blob/main/rustls/src/lib.rs).
- **B3:** [smoltcp TCP readiness/waker API](https://github.com/smoltcp-rs/smoltcp/blob/main/src/socket/tcp.rs).
- **B4:** [rustls 0.23.35 no-std/unbuffered API](https://github.com/rustls/rustls/blob/v/0.23.35/rustls/src/lib.rs), [time provider](https://github.com/rustls/rustls/blob/v/0.23.35/rustls/src/time_provider.rs).
- **B5:** [rcore-fs](https://github.com/rcore-os/rcore-fs), [MIT license](https://github.com/rcore-os/rcore-fs/blob/master/LICENSE).
- **X1:** [FreeBSD Linuxulator handbook](https://docs.freebsd.org/en/books/handbook/linuxemu/), [Linux compatibility source](https://github.com/freebsd/freebsd-src/tree/main/sys/compat/linux).
- **X2:** [HermiTux status](https://github.com/ssrg-vt/hermitux), [kernel/license](https://github.com/ssrg-vt/hermitux-kernel), [authors' VEE 2019 paper](https://www.ssrg.ece.vt.edu/papers/vee2019.pdf).

### Tests and runtime requirements

- **T1:** [LTP project/scope](https://github.com/linux-test-project/ltp), [GPL license](https://github.com/linux-test-project/ltp/blob/master/COPYING).
- **T2:** [LTP single-test execution/prerequisites](https://github.com/linux-test-project/ltp/blob/master/doc/users/quick_start.rst), [syscall tests](https://github.com/linux-test-project/ltp/tree/master/testcases/kernel/syscalls).
- **T3:** [libc-test COPYRIGHT in source mirror](https://github.com/kraj/libc-test/blob/master/COPYRIGHT), [independent mirror copy](https://github.com/microsoft/checkedc-libc-test/blob/master/COPYRIGHT), [test organization/README](https://github.com/kraj/libc-test/blob/master/README). Mirrors were used for inspection; pin/verify against upstream before adoption.
- **T4:** [musl's official libc-test description](https://wiki.musl-libc.org/libc-test), [official testing guidance](https://wiki.musl-libc.org/writing-tests), [canonical repository landing page](https://repo.or.cz/w/libc-test.git).
- **J1:** [V8 POSIX mapping/protection code inside Node 22.2.0](https://github.com/nodejs/node/blob/v22.2.0/deps/v8/src/base/platform/platform-posix.cc), [V8 JIT-less design](https://v8.dev/blog/jitless).
- **J2:** [libuv Linux backend](https://github.com/libuv/libuv/blob/v1.x/src/unix/linux.c), [libuv threadpool source](https://github.com/libuv/libuv/blob/v1.x/src/threadpool.c), [Node upstream tests](https://github.com/nodejs/node/tree/main/test), [Node bundled licenses](https://github.com/nodejs/node/blob/main/LICENSE).

### Sampled upstream tree IDs

The following Git tree object IDs were returned during this read-only session; they identify sampled source-tree contents, not commit history or commit dates. Runtime examples and documentation can be in separate repositories and must be pinned separately before implementation. Later raw-file/page reads used branch tips, so these IDs are starting points, not a claim of an atomic multi-repository snapshot. Resolve and retain commit IDs separately when adopting code.

| Repository / branch | Sampled tree object ID |
|---|---|
| `asterinas/asterinas`, `main` | `7861bff17133b941cf89329917033541d14813ab` |
| `google/gvisor`, `master` | `25172e526f45929759a44e174e617c320df1ad58` |
| `unikraft/unikraft`, `staging` | `359307a2a4cc9c1feb22683d841650902b799e4d` |
| `unikraft/app-elfloader`, `staging` | `0cd7a2b2c4d5ece85647c0c9903b50426e849420` |
| `nanovms/nanos`, `master` | `7305c30689e1f3c6a5366ba9f5ec477ecfbaf8bd` |
| `cloudius-systems/osv`, `master` | `28c0f5a4b6687492387fca6b4f325faa4d891f93` |
