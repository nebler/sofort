# Roadblocks to Node with JIT, in the order they bite

Research date: 2026-10-31. Read-only code and primary-source research; no builds, tests, benchmarks, Docker, Linux guests, or VMs were run. This report is the only new file written.

Baseline: root checkout `main`, `7a4be6a51a83acba5567342f032b8066f4eb575a`. I also read the Stage-0 worktree at `/Users/noah/.t3/worktrees/sofort/growos-stage0`, branch `growos/stage0-merge`, HEAD `61a0b4eb3a1f8beb60dbe71cb6d17f8a9f2286ee`. Its two additional commits merge console handlers and strengthen held-out tree/corpus gates. **Stage-0 pointers below explicitly name that worktree; all other local pointers refer to the root baseline.** File:line references describe these revisions, not future merges.

Evidence labels: **Verified—code** means inspected implementation; **Verified—source** means checked upstream documentation/source; **Reported** means a repository report's result, not independently rerun here; **Inferred** means engineering judgment, estimate, calculation, or proposed experiment. All effort and kill-risk assessments are inferred. Estimates assume an engineer familiar with this code, include focused verification, overlap substantially, and are not delivery commitments. A narrow demonstration and a supported hostile-workload runtime have different costs.

## Ranked summary

Rank primarily follows the first milestone affected, then the depth of the missing machinery. Economic and hardware gates should be investigated ahead of their implementation order.

1. **Stage 0: acceptance still does not mean supported semantics.** The 81% corpus is a console/compiler workload result; the merge preserves success-without-cwd and non-enforcing memory protections. Strengthen promotion before trusting more complex handlers.
2. **Stage 1: cwd and writable scratch require a real state model.** The archive, descriptors, lookup, writes, quotas, and reset must agree; writable SQLite adds locking and journal/rename/truncate semantics beyond immutable queries.
3. **Stage 2 entrance: the loader and image geometry reject ordinary Node.** Static AArch64 ET_EXEC only, a small flat image window, 64 KiB writable image-data allowance, and a fixed stack are earlier barriers than V8 JIT.
4. **Stage 2 entrance: memory reservations need sparse VMAs and wider page tables.** A 160 MiB mmap window and less than 15 MiB writable backing cannot support the proposed 50 MiB heap. Reserve/commit/protect must be distinct. A 4 GiB cage or 1 TiB sandbox is build-dependent, not an unconditional Node requirement.
5. **Stage 2: threads/futex/scheduling are the largest functional step.** Both engines run one vCPU per VM; the kernel has no task scheduler. Node's single JS event loop does not make its native runtime single-threaded. One-vCPU threads are feasible; SMP can wait.
6. **Stage 2: epoll, eventfd/pipe wakeups, and clock semantics are a subsystem.** Existing ppoll handles only 16 descriptors and a small device set. The JS engine has a 1 ms host-refreshed clock, but that is neither guest timer preemption nor a vDSO, and native workers lack that clock registration.
7. **Stage 2: real signals need safe frames and interruptible waits.** Signal handlers return ENOSYS today; faults terminate the VM. Fake success will break masks, pthread interactions, and fault recovery.
8. **Stage 2 JIT: W^X crosses both translation stages and cache state.** Guest mprotect alone cannot make HVF's NX arena executable. The existing RWX test-fixture hook is not a production JIT protocol.
9. **Stage 2–3: the dirty working set can erase the economic advantage.** Fully writing 50 MiB implies about 3,200 HVF granules and roughly 19 ms of first-write exits at the reported rate. Large resets remap, so this cost can recur every run.
10. **Stage 2 warmed Node: snapshot placement, entropy, and complete state become harder.** Current native snapshots stop before EL0 startup. A post-initialization Node snapshot adds multiple threads, synchronization objects, cached randomness, and runtime clocks to restore obligations.
11. **Stage 2 HTTP/product: choose host-brokered HTTP or a socket ABI explicitly.** Host tools can provide useful HTTP quickly. Unmodified `http`/`fetch` needs networking descriptors, readiness, DNS and HTTPS support; there is no guest socket stack today.
12. **Stage 3, investigate now: bare-metal arm64 and platform capability gaps remain unqualified.** Nested KVM does not settle coherency, density, or tails. HVF supports more than this engine uses, but has OS/hardware-specific GIC, timer, granule, and register-coverage constraints.
13. **Stage 0 onward: security/review capacity is a release constraint.** Several October 29 defects are now addressed in source; unresolved semantic gates, shared-process failure domains, noncooperative host work, and reset certification get more consequential with threads, JIT and networking.

## Decision table

“Kill” means a reason to stop or narrow the Node/custom-kernel plan, not necessarily abandon Sofort's existing QuickJS/static-program product.

| # / Roadblock | First stage | Rough size | Kill risk | Earliest useful de-risk step |
|---|---|---|---|---|
| 1. Semantic gates / promotion | 0 | 3–5 days initial audit; 2–4 weeks stronger evaluator | High for autonomous-growth premise | Require cwd/protection/lost-wakeup mutants to fail; certify exact ring artifact |
| 2. cwd + scratch FS | 1 | 2–4 weeks narrow tmpfs; 1–2 months credible SQLite writes | Medium, mostly scope | Independent cwd/open/rename/truncate/lock/reset histories on real workflows |
| 3. Node ELF and image layout | 2 entrance | 1–3 days inventory; 1–3 weeks narrow static-loader/layout changes | Medium; high for stock binary/addon compatibility | Pin one Node artifact; inspect program headers, TLS, BSS, sizes and startup syscall trace on separate Linux infrastructure |
| 4. Sparse VM / address space | 2 entrance | 3–6 weeks | High if solved by physically backing reservations | Reserve GiB/TiB virtually, commit 50 MiB, verify guards and bounded backing |
| 5. One-vCPU threads, futex, preemption; optional SMP | 2 | 6–12 weeks one-vCPU foundation; another 1–3 months SMP | High engineering/maintenance risk | Two pthreads with TLS, timed waits, joins and CPU-bound preemption; then Node bootstrap |
| 6. epoll / wakeups / clocks | 2 jitless | 2–4 weeks, shared with scheduler | Medium | libuv loop + eventfd + worker wake + timeout under CPU load on both engines |
| 7. Signals / fault delivery | 2 jitless | 3–6 weeks narrow ABI | Medium–high correctness risk | Signal/mask/wait races and malicious sigreturn frames; no “install succeeded” stubs |
| 8. JIT W^X / I-cache | 2 JIT | 2–4 weeks single-vCPU spike and hardening; more for SMP | High if coherency/reset cannot be certified | Emit/flip/execute/rewrite/reuse AArch64 code across resets and 4 KiB/16 KiB boundaries |
| 9. Dirty-set cost / density | 2–3 | 2–5 days initial remote sweep; 2–4 weeks decision-quality comparison | High for economic premise | 1/10/50/100 MiB dirty-set sweep, including next-run faults and process totals |
| 10. Warm Node snapshot / uniqueness | 2–3 | 1–2 weeks checkpoint investigation; 3–6+ weeks runtime-specific repair | High for secure warm cloning | Quiescent checkpoint; independent entropy/time/TLS/lock audit over clones |
| 11. HTTP / sockets | 2 or 4, workload-dependent | 3–5 days bounded host HTTP pilot; 3–6 weeks narrow socket proxy; months full stack | Low with host tools; high for unrestricted compatibility | Pick API contract; one bounded HTTPS request with DNS, cancellation and reset |
| 12. Platform / bare metal | 3, spike now | 2–5 lab days first evidence; 2–4 weeks qualification | High if reset leaks or Linux economics fail | External arm64 host; hostile cache-off + reset suite, then matched Firecracker test |
| 13. Security and maintained test surface | 0 onward / release at 4 | 1–2 weeks refresh audit; ongoing months | High for hostile multi-tenant release | Track current findings; targeted LTP/gVisor suites, resource limits, exact-image certificates |

## 1. Stage-0 semantics and growth gates

**Verified—code.** The root generator emits ENOSYS for absent modules; names in `slots.json` are not implemented functionality (`arch/jitk/kernel/generate.ts:53–73`). Stage-0's `kernel/src/syscalls/chdir.rs:10–17` checks that a path is a directory and returns zero without storing cwd. Both branches' `kernel/src/fs.rs:320–330` start AT_FDCWD lookup at inode zero; `kernel/src/syscalls/getcwd.rs:2–8` always returns `/`. Stage-0's `kernel/src/syscalls/mmap.rs:8–10,40–53` explicitly maps PROT_NONE/PROT_READ requests RW in the console profile; it rejects executable requests and overlapping MAP_FIXED replacement (`:82–89`). Ring policy remains RW-only, no hints or MAP_FIXED (`:25–36`). These are declared restrictions, not general Linux semantics.

**Reported.** The reviewed corpus is 3,198/3,947 comparable compiled programs (81.0%), 77.5% over all compiled programs, and 73.2% for comparable stock-layout ELFs. mmap accounts for 2,924/3,039 new passes. These are compiled-program output comparisons, not Node, all JavaScript, or all Linux syscalls (`arch/review/2026-10-29-SECURITY-CORRECTNESS-REVIEW.md:144–172`; `arch/research/growos-fit/04-CRITICAL-REVIEW.md:39–51`).

**Verified—code, current corrections.** The old F3 whitespace bypass should not be described as still present: `grow/loop.ts:97–117` now tokenizes Rust, forbids compiler-input macros and disallowed forms, and permits named macros/attributes. This is stronger than substring matching, although not a proof of a hermetic compiler boundary. The root phase-2 evaluator repeats the visible fixture 30 times, then checks held-out output and two constant-return mutants (`grow/phase2.ts:235–271`). Stage-0 improves the hidden tree: `grow/phase2.ts:107–110,132–159` defaults to `variant`, still allows `same`, and describes one variant's limits. Thus the October 29 “tree audit outside batch acceptance” finding is partly superseded on the merge branch. It has not become a general stateful evaluator.

**Why this blocks / inferred.** A no-op cwd can inflate Stage-0 compatibility yet fail the first real Stage-1 history. A similarly accepted futex could miss one wakeup and hang Node. Two calibrations cannot discover the set of legal thread schedules. `grow/auto-observe.ts:6–20,47–60` relaxes varying 8-byte words and positive identities while requiring fixed observation shape: this can either erase important content or reject legitimate variable output ordering. Linux return-byte equality is useful for deterministic handlers; it is insufficient for concurrent histories, time, asynchronous signal delivery, readiness and fairness.

**De-risk / size / kill.** Spend 3–5 days designing counterexamples before more growth, then 2–4 weeks building sequence-based evaluation. Keep agents proposing handler policy over reviewed primitives; task creation, futex enqueue/recheck/wake atomicity, signal-frame validation and page-table mutation need deliberate human design and independent review. Require a final test set outside generator feedback. If acceptance keeps admitting planted semantic defects, stop the autonomous-concurrency claim; manual kernel work or a Linux fallback remains possible. “Safe Rust proposal” does not establish a sound concurrent helper contract.

## 2. Stage-1 cwd and scratch storage

**Verified—code.** `kernel/src/fs.rs:1–3` describes an immutable archive; `:13–16` has only File/Directory extents, `:43` caps FDs at 64, and `:57–65` distinguishes only console/archive descriptors. `syscalls/openat.rs:24–44` refuses writes with EROFS; `syscalls/write.rs:13–16` accepts only stdout/stderr. There are no symlinks (`syscalls/readlinkat.rs:1–9`). `fs.rs:97–108` uses an atomic exclusive callback guard that returns EBUSY on contention; this is not a sleeping filesystem lock suitable for arbitrary multi-threaded use.

**Why this blocks / inferred.** cwd needs process state shared consistently with directory-FD lookup. Scratch needs mutable inode/open-description lifetime, independent file positions versus dup sharing, create/unlink/rename/truncate, quotas, timestamps and clean reset. SQLite's immutable read-only mode deliberately avoids the writes/locks/journaling required for normal databases (`grow/README.md:57–68,162–164`). A transient filesystem need not promise persistence across VM reset, but fsync, locks and journal operations must implement a coherent per-run contract. WAL adds shared-memory and locking interactions; start with rollback-journal mode if that meets the selected workload. jq output redirection supplied by a host is a smaller workload than arbitrary Node filesystem use.

**De-risk / size / kill.** First implement and independently test `chdir → relative open → getcwd`, directory-FD-relative paths, dup/close positions, unlink-open-file lifetime, quota exhaustion, SQLite rollback/commit and cross-run cleanup. Back scratch state in reset-covered arena memory or explicit per-generation host objects that are destroyed before release. Estimate 2–4 weeks for bounded scratch; 1–2 months including credible SQLite write semantics. This need not kill the plan, but a general POSIX filesystem, permissions, links and arbitrary process model could overwhelm the intended scope.

## 3. Node cannot simply be substituted for QuickJS in the loader

**Verified—code.** `kernel/packer.ts:132–155` admits AArch64 ELF64 ET_EXEC, forbids PT_DYNAMIC/PT_INTERP, limits program headers to 16, rejects W+X and constrains load addresses. `IMAGE_END` is `0x1880000` (24.5 MiB), from `packer.ts:5–13`; with BASE 4 MiB, the admitted flat VA span is at most 20.5 MiB before resource/headroom checks. `prepare.ts:12–19` appends the archive to the flat payload and insists on more mmap headroom. This span is not a measured Node binary size.

The ring layout also has `DATA_BYTES=64 KiB`, a 128 KiB stack carve-out (`abi/src/lib.rs:355–359`), and `mmu_ring.rs:221–235` asserts that writable image pages fit the data-copy range. User stack VA is `0x1fe0000..0x2000000` (`memory.rs:11–12`); argv strings consume some of it (`user.rs:52–110`). The aux vector supplies PHDR/PHNUM/page size/entry/identity/AT_RANDOM, but no AT_SYSINFO_EHDR, interpreter base or CPU HWCAP entries (`user.rs:74–102`). PT_TLS initialization is not performed by this loader; a static libc may initialize its main-thread TLS itself, which must be checked for the chosen artifact.

**Verified—source.** Node's build supports `--fully-static`, but the v24 platform table's Tier-1 arm64 Linux target is glibc, not this kernel or an arm64-musl support promise. Static linking removes the interpreter/shared-lib startup path; it does not remove pthread/libuv/syscall requirements. [Node build instructions][S1], [Node configure][S2].

**De-risk / size / kill—inferred.** Pin a guest Node version, compiler/libc, feature flags and build identity separately from the host Node. On a separate Linux machine, inspect headers, load spans, writable data/BSS, PT_TLS, stack assumptions and startup syscalls before porting. Do not claim that the repo's host Node tarball is a runnable guest. A small static musl ET_EXEC is the sensible initial profile, with no dlopen/native addons or child processes. Static musl's dlopen limitations are an explicit product tradeoff to verify for that toolchain. Allowing stock dynamic Node means ET_DYN/load bias, file-backed mmap, relocations, interpreter/libc resources, RELRO and broader auxv semantics; budget additional weeks. Likely 1–3 weeks to revise a narrow static layout after a 1–3 day inventory; exact fit is unmeasured. If “ordinary Node” includes arbitrary native addons and distro binaries, the compatibility project is much larger.

## 4. Sparse reservations and address translation, before JIT

**Verified—code.** The ring mmap VA range is `[0x2000000,0xc000000)`, exactly 160 MiB (`memory.rs:7–12`, `mmu_ring.rs:74–79`). Console USER_END is 36 MiB and its mmap end 30 MiB (`memory.rs:4–14`). `heap.rs:213–232` allocates and zeroes physical pages immediately; there is no unbacked reservation/VMA layer. The physical pool also supplies page tables (`heap.rs:3–14,38–68`). The largest class's writable arena is **15,466,496 bytes = 14.75 MiB**, not 16 MiB; 16 MiB is the admission charge (`abi/src/lib.rs:388–409`). Heap is smaller still after kernel, tables, data, stack and reserve. The total ring RAM mapping is fixed at 32 MiB (`abi/src/lib.rs:78–87`).

Page tables use one LOW L2 table with direct `va/2 MiB` indexing (`mmu_ring.rs:37–47,149–180`), with kernel physical aliases in another root entry (`:98–118`). TCR sets T0SZ=25 (`:141–144`), a 39-bit/512 GiB address-space size even before the smaller implemented mapping geometry. Increasing USER_END alone will index outside these tables. Existing kernel identity aliases must not collide with new user reservations.

**Verified—source.** V8 pointer compression uses a 4 GiB cage; the V8 sandbox normally reserves about 1 TiB plus guards. But **Node v24.22.1's configure logic makes pointer compression opt-in and enables the sandbox with the experimental shared cage**. Do not import Chrome's defaults into a Node requirement. A non-compressed build still needs truthful protection, heap/stack reservations and possibly substantial code-space reservations; pin and trace the selected build. [Node configuration][S2], [V8 pointer compression][S3], [V8 sandbox][S4], [Node-bundled code range][S5].

**Required design—inferred.** Add range metadata for reserve/commit/protect/decommit/unmap, an allocator that respects alignment/hints, PROT_NONE enforcement and safe MAP_FIXED behavior. Widen to a sparse multi-level stage-1 walker, probably a larger VA size if supporting the full sandbox; relocate kernel aliases if necessary. Allocate tables only for committed pages, with reservation metadata independent of valid PTEs. A 50 MiB dense mapping needs roughly 25 L3 tables/100 KiB plus upper levels; eagerly populating L3 tables for 1 TiB would cost about 2 GiB in tables alone. Empty address-space reservation should cost neither that nor 1 TiB of RAM.

Stage 2 should map a bounded larger **physical** arena, not the sandbox's entire VA reservation. Multiple guest virtual mappings can translate into the same small GPA span; stage-2 IPA width and guest VA width are different constraints. Current class enum/layout matching, fixed RAM/archive/control offsets, linker image/arena placement, snapshot length checks and generated host limits all change together (`abi/src/lib.rs:371–478`; `snapshot.rs:225–240`; `slot/mod.rs:236–268`; `kernel/src/arch/aarch64/link.ld:7–15`). GrowOS's 32 MiB oracle address-space cap must also change: making Linux reject a useful large reservation does not validate supporting it (`grow/README.md:244–245`; Stage-0 `grow/phase2.ts:148–155`).

**De-risk / size / kill.** A 3–6 week memory project, preceded by a small external-machine probe: reserve a large aligned range without backing it; protect/commit 50 MiB; check guard faults, holes, partial unmaps, zeroing on reuse, bounds and high-address copyin/out. Compare compressed and uncompressed pinned Node builds. Kill the low-memory approach if reservation consumes proportional RAM, or if ordinary committed working sets defeat the density objective; the mere 1 TiB virtual number is not itself a kill reason.

## 5. Threads on one vCPU first; SMP is absent and separable

**Verified—code.** A slot has one `V::Vcpu` (`shard/src/slot/mod.rs:145–148,267–269`); KVM always creates vCPU ID zero, enables only PSCI 0.2 and explicitly creates no in-kernel irqchip (`kvm/mod.rs:100–115`). HVF's slot creates one vCPU (`hvf.rs:700–720`). HVF's one-VM-per-process rule is **not** a one-vCPU hardware limit. The kernel explicitly enters on the sole masked-IRQ vCPU (`main.rs:49–55`); boot uses one EL1 stack and BSS initialization (`boot-ring.S:24–33`). There is no task table/run queue/context-switch implementation, and clone/futex/gettid/robust-list syscalls are absent from the dispatch surface. `set_tid_address.rs:1–3` returns constant 1; `exit` and `exit_group` share a terminal VM-exit handler (`slots.json:6–7`, `syscalls/exit.rs:3–19`).

**Verified—source.** Node's platform worker startup creates a delayed-task scheduler thread and worker threads, with at least one worker selected by its ordinary sizing logic. libuv also uses a threadpool for filesystem and name-resolution work; default size four, with 8 MiB stacks that can grow lazily. V8's `--single-threaded` disables background tasks; it does not promise elimination of all Node/libuv native threads. [Node platform][S6], [libuv threadpool][S7], [V8 flags][S8].

**Threads on one vCPU—inferred requirements.** Save/restore x0–x30, SP/PC/PSTATE, SIMD/FP, FPCR/FPSR and **TPIDR_EL0 per task**, plus kernel stacks and syscall continuations. Implement a bounded clone(CLONE_VM/THREAD/SETTLS/CHILD_CLEARTID profile), TIDs, joins/clear-child-tid wake, task exit versus group exit, and blocked/runnable states. Futex WAIT must atomically compare and enqueue relative to WAKE, handle EAGAIN/timeouts/EINTR, and key addresses consistently across mapping changes; add WAIT_BITSET/requeue/robust behavior only as libc/runtime requirements establish them. Even on one CPU, interruption between compare/enqueue creates lost-wakeup bugs. Allocate thread stack **reservations** lazily rather than eagerly backing every 8 MiB.

Cooperative switching at blocking syscalls can demonstrate pthread startup. It cannot guarantee progress when a thread spins on an atomic or runs CPU-bound JS while another thread must complete a GC/safepoint task. Preempt EL0 with a timer and separate IRQ entry. `vectors.S:4–35` points every exception class at the synchronous trap; `trap.rs:25–39` handles only SVC and otherwise shuts down. Preserve masked, non-reentrant kernel critical sections initially; schedule at safe points instead of introducing arbitrary kernel preemption. Re-audit singleton assumptions in `heap.rs:19–26`, `syscalls.rs:6–21`, ring cursors and filesystem guards before enabling parallel execution.

**HVF / KVM preemption.** Production HVF treats a virtual-timer exit as unexpected (`hvf.rs:950–954`), with no GIC. Its console runner emulates timer-bounded WFI while the vtimer remains masked (`hvf/console.rs:15–21`). Console kernel GIC/PPI-27 setup exists (`kernel/.../wait.rs:54–81`), but DAIF stays masked and interrupts only wake WFI (`:118–143`); that is not preemption. Add an HVF GIC or reviewed interrupt-injection scheme and follow vtimer mask/ack rules. On KVM create/configure a VGIC, its timer PPI and real guest IRQ delivery. Existing `hv_vcpus_exit`/`immediate_exit` kicks stop host execution; KVM owner round-robin scheduling shares a host thread **among VMs**, not among guest pthreads (`owner.rs:5–12`). [Apple vtimer][S9], [Apple GIC][S10], [KVM VGIC][S11].

**SMP—inferred additional work.** Distinct vCPU IDs/MPIDRs, secondary boot/PSCI CPU_ON, per-CPU stacks and state, spinlocks/atomics, IPIs, remote TLB invalidation, code publication and stop-all-vCPU barriers before reset. Snapshot formats must hold every CPU and interrupt controller state. Host worker concurrency does not supply guest SMP. Start with two threads on one vCPU; add two vCPUs only when an agreed workload needs parallel execution.

**De-risk / size / kill.** Budget 6–12 weeks for a reviewed one-vCPU threading base, with overlapping signal/event work; another 1–3 months for SMP. Prove TLS isolation, joins, timed futex waits, wake-before-wait races, preemption of pure EL0 spin loops and all-tasks shutdown before Node. Run both hypervisors. This is the strongest functional reason the plan could exceed its budget; SMP itself is not a prerequisite for initial Node with JIT.

## 6. Event loop, clocks and timers

**Verified—code.** ppoll rejects signal masks, caps `nfds` at 16, and polls archive/console descriptors (`syscalls/ppoll.rs:7–12,64–88`; `syscalls.rs:89–120`). There are no guest epoll/eventfd/pipe/socket implementations. Ring waits publish one deadline and WAIT doorbell (`wait_ring.rs:11–23`). `clock_gettime` supports only realtime and monotonic (`syscalls/clock_gettime.rs:3–16`). There is no vDSO auxv entry (`user.rs:74–102`).

**Important correction to a stale comment.** `wait_ring.rs:1–2` says time freezes during CPU work. For the **JS IPC engines**, current code instead refreshes the guest control word every nominal 1 ms while the vCPU runs (`shard/src/clock.rs:4–13,49–50,76–87`), registered by HVF child `:141–142` and KVM owner `:811`. `slot/mod.rs:458–470` guards stores against reset. Native worker implementations do not call `set_clock`; absent registration, their time refreshes on engine entry/doorbells. Neither behavior delivers guest scheduling interrupts. Refresh cadence is also subject to host scheduling, not a guaranteed precision bound.

**Verified—source / implication.** Linux libuv uses epoll and nonblocking descriptor readiness; its async wakeup path creates eventfd. Supporting names without readable/writable transitions, close semantics and wake ordering will hang the loop. [libuv design][S12], [Node-bundled async][S13].

**De-risk / size / kill—inferred.** Build one bounded readiness object model shared by epoll, eventfd/pipes, futex timeout and scheduler queues. Correct one-shot/edge behavior, descriptor reuse, EINTR, timeout conversion and close races matter more than a large maximum FD number. Use a monotonically progressing counter-backed clock or an equally specified host clock protocol for both native and JS paths; audit access permissions, frequency and restore offsets. vDSO is an optimization after correct syscall fallback, not an initial requirement. Test a libuv worker waking an idle loop, a timer while another thread spins, and repeated restore after long host pauses. Roughly 2–4 weeks, overlapping scheduler work; medium kill risk if scope is bounded.

## 7. Signals and fault delivery

**Verified—code.** `rt_sigaction.rs:1–5` and `rt_sigprocmask.rs:1–5` explicitly return ENOSYS. Grow's signal oracle deliberately injects ENOSYS (`grow/loop.ts:157–158`); this establishes fallback behavior, not Linux signal implementation. Unexpected EL0 exceptions are terminal (`trap.rs:29–39`). There is no rt_sigreturn path, alternate signal stack, pending queue or per-task mask.

**Why this blocks / inferred.** Node/libuv initialization and signal watchers use real signal facilities; exact fatality at startup needs tracing the selected binary. Pthread implementations also use signal-related coordination. A supported implementation needs dispositions, per-thread masks/pending state, delivery to the intended thread, a Linux-compatible arm64 frame/restorer, SA_RESTART/EINTR behavior and safe sigreturn restoration. Validate restored PC/SP/PSTATE, pointers, SIMD extensions and privilege bits as hostile input. SIGSEGV delivery must distinguish permission/mapping faults from guest-kernel failure. A Node profile may initially exclude user signal APIs, but must fail honestly and qualify the runtime under that profile. [Node-bundled signal code][S14].

**De-risk / size / kill.** In 3–6 weeks, implement a declared subset with independent arm64 ABI probes: blocked/unblocked delivery, signal during futex/epoll wait, nested/alternate-stack handlers, timeout races, malformed frames, SIGKILL/group exit and reset with signals pending. Full Linux signal compatibility is larger. Fake-success sigaction is an immediate rejection criterion. This is a substantial security/correctness cost but not evidence that JIT requires every Linux signal feature or Wasm trap-handler mode.

## 8. W^X and instruction coherency for JIT

**Verified—code.** Current mmap accepts only prot=RW (`syscalls/mmap.rs:5–7`); pool mappings are RW, PXN+UXN (`mmu_ring.rs:197–205,244–256`), and mprotect is absent. HVF stage 2 maps writable extents READ|WRITE without EXEC (`hvf.rs:629–634`). KVM's memory-region interface here sets read-only flags for immutable extents but does not impose an execute ban on writable slots (`kvm/mod.rs:81–96`). Thus a new stage-1 executable mapping would still fault on HVF.

`hvf.rs:817–838` has an **offline fault-probe** hook that invalidates host I-cache and changes a range to READ|WRITE|EXEC until reset. It neither implements Linux mprotect nor safely defines production JIT permissions. Normal dirty write faults set READ|WRITE unconditionally (`:509–529`); reset remaps a large arena READ-only (`:735–770`). JIT execute state must be integrated with both paths.

**Verified—source.** Node-bundled V8 changes page permissions through mprotect and flushes Linux arm64 I-cache through `__builtin___clear_cache`. Arm documents data-clean/instruction-invalidate/barrier ordering and that an ISB on one core does not synchronize every other core. [V8 POSIX platform][S15], [V8 arm64 cache code][S16], [Arm publication rules][S17].

**Required design—inferred.** Implement real PROT_NONE/R/RW/RX transitions; reject or deliberately negotiate RWX, with exact selected V8 behavior measured rather than assumed. Track physical-page aliases so no EL0 RW mapping aliases executable code. Separate immutable kernel/payload GPAs from writable JIT backing. Decide whether stage 2 enforces W^X through a bounded generation-checked permission doorbell, or allows executable arena backing while relying on stage 1 for guest-process W^X; document the weaker invariant in the latter design. The host must retain immutable extent protections regardless of an arbitrary compromised EL1 guest.

HVF currently tracks 16 KiB granules while the guest maps 4 KiB pages. Mixed data/code within a granule makes exact stage-2 W^X awkward: a data write fault can remove execute permission from neighboring code under the current tracker. A separate aligned JIT pool or explicit per-granule permission state is preferable to broad RWX. No new stage-2 mapping per guest VMA is inherently required.

`arch/aarch64/mod.rs:131–150` already provides boot/local-cache maintenance, and `ring.rs:357–364,499–511` flushes TLB/I-cache after restore. Reuse those concepts, but audit cache-line sizes, user DC/IC permission bits/traps, aliases, PoU versus PoC, TLB ordering and rewritten physical pages. The current generic trap would kill trapped cache-maintenance instructions. For SMP, all executing cores require correct synchronization and remote TLB/cache publication, not only local `ic iallu` and `tlbi vmalle1`.

**De-risk / size / kill.** A 2–4 week single-vCPU JIT spike/hardening effort: write machine code in RW, flip RX, execute, flip back, rewrite, execute, unmap/reuse, and repeat across snapshots and mixed granules. Negative probes must fail writing RX, executing RW and accessing revoked pages. Run with cache-off hostile predecessors and on CPUs without convenient coherency features. If correctness requires making all tenant-writable memory permanently RWX or cannot eliminate stale instructions across tenants, stop release of this JIT design.

## 9. Dirty-set cost and VM density at Node scale

**Reported, not rerun.** `bench/v1/results/2026-10-31-memory.md:220–231,281–288` records about 6 µs per first-write fault on a 16 KiB HVF granule, a sticky set capped at 128 granules/2 MiB, decay every 16 resets, and remapping from the snapshot for larger sets. The code agrees (`hvf.rs:480–552,735–770`). Small-job reset figures around 34–40 µs and idle child footprint around 2.4 MiB are for the measured QuickJS classes, not Node.

**Calculated / inferred, not a performance forecast.** For **50 MiB actually written across distinct granules**, `50 × 1024 × 1024 / 16384 = 3200` first-write faults; `3200 × 6 µs = 19.2 ms`. For decimal 50 MB, about 3,052 granules/~18.3 ms. These omit host CoW faults, allocation/zeroing, V8 work, guest page-table dirties, transport and scheduling. Scattered 4 KiB writes can dirty up to four times their byte count in 16 KiB granules. A 50 MiB resident heap is not necessarily rewritten each job; GC or startup may touch much of it. Measure distinct writes, not heap capacity.

Because 3,200 exceeds 128, current HVF reset remaps rather than retaining a 50 MiB writable hot set; the next similar run can pay first-write exits again. Remap reduces reset copying, but does not make **reset plus next useful run** cheap. Raising STICKY trades faults for persistent private RAM and per-reset copy/clean. A preinitialized shared Node heap is shared only until each tenant writes it.

**Verified—code.** KVM scans `/proc/self/pagemap` over writable extents and restores **private CoW pages**, not only pages changed in the last job (`kvm/reset.rs:189–208`). Copying snapshot bytes back does not turn a private page into a shared file page. Default copy limit is None and idle trim 2 s (`slot/reset.rs:32–71`), so the retained private set can accumulate to a run's high-water and be copied/cleaned each reset (`kvm/reset.rs:155–177`). A 50 MiB private set entails 12,800 4 KiB copies, 50 MiB copied, and cache maintenance; elapsed time/bandwidth cannot be inferred from the Mac or nested timings.

**De-risk / size / kill.** Move this gate left. On external machines, spend 2–5 days sweeping 1/10/50/100 MiB committed and dirtied sets, dense/scattered/random/repeated, with copy/remap/discard policies. Include response time, reset time, next-run faults, p50/p99 CPU/wall time and saturation. A later 2–4 week comparison must include snapshot-shared pages, per-slot private bytes, page tables, host process/zygote/watchdog/Node costs, and strict process-isolation configuration. Compare matched warmed Linux/Firecracker restores on the same bare-metal host and Node workload; no cross-report timing ratios. If realistic successful Node jobs have no material end-to-end density/latency benefit over warmed Linux, stop the Node-specific custom-kernel investment.

## 10. Snapshot placement, quiescence and cryptographic uniqueness

**Verified—code.** Native checkpointing happens before constructing/running the user program (`user.rs:43–46`, `ring.rs:499–516`). Native support therefore does not already supply a post-bootstrap Node snapshot. Snapshot state contains one register file plus memory/class (`snapshot.rs:51–57,225–246`). The existing QuickJS payload has a dedicated runtime repair hook for Math.random, libc PRNG/stack guards/mallocng metadata; its docs explicitly say native code needs an independently designed cryptographic entropy API (`kernel/README.md:105–124`). Stage-0 `getrandom.rs:14–17` still returns ENOSYS on ring; console generation is keyed from the per-run seed and is explicitly not a secret from an application that can read AT_RANDOM (`:1–8,39–55`). No `/dev/urandom` character device is implemented by the archive filesystem.

**Why this blocks / inferred.** Staying before Node startup avoids cloning initialized locks/random state but repeats initialization and its dirty writes. Warming after initialization is valuable only if Node can reach a known quiescent point: no thread executing an inconsistent operation, no lock permanently owned by an absent task, no outstanding host object or socket, and a defined wakeup/clock reset for all tasks. TLS, native stacks and synchronization state must be captured consistently; SMP also requires a stop-all barrier. A warm OpenSSL/user-space PRNG can retain duplicated randomness despite fresh guest-kernel seed bytes. Node/V8 hash seeds, cached UUID/random data and application credentials deserve a separate inventory, not assumptions inherited from the QuickJS patch.

**Verified—source.** Firecracker's snapshot documentation warns that cloned userspace identifiers, cached random values and tokens can remain duplicated even when a mechanism reseeds the guest kernel. [Firecracker uniqueness guidance][S18].

**De-risk / size / kill.** Start a bounded cryptographic host-entropy service or correctly reset/reseed a guest entropy source; avoid storing tenant secrets in the shared baseline. Compare pre-start versus post-init checkpoints. Audit random/UUID output, timers, pending waits, TLS, lock ownership and external handles over independently restored clones. Initial checkpoint investigation 1–2 weeks; runtime-specific repairs 3–6+ weeks. If no secure, maintainable warm checkpoint exists, revert to pre-start snapshots and reassess economics; never accept duplicate crypto state to preserve startup numbers.

## 11. `/proc`, `/dev`, networking and the first HTTP client

**Verified—code.** There is no socket/connect/send/recv network syscall surface, NIC or socket descriptor kind. Files are regular archive entries/directories; an entry named `/dev/null` is still a regular file (`grow/README.md:63–64`, `fs.rs:13–16,57–65,272–289`). Paths under `/proc` can be packed as bytes but cannot provide live descriptor links, memory maps or changing process statistics. `readlinkat` rejects existing paths. The trusted host already brokers policy-checked tools (`docs/ARCHITECTURE.md:29–38`), and engine confinement intentionally removes network access (`shard/src/confine/mod.rs:5–18`; HVF `jitk.sb:6–12`).

**Verified—source.** Node-bundled libuv consults procfs for memory/CPU/process information and implements fallbacks for some reads. Absence of every procfs file is not automatically a startup blocker; classify actual fatal calls versus optional diagnostics for the pinned build. [Node-bundled Linux platform code][S19].

**Smallest useful path—inferred.** Expose a bounded asynchronous host HTTP tool over the ring, with host DNS/TLS, URL/redirect and credential policy, response byte caps, cancellation and generation fencing. A Node wrapper can call it, but that is an explicit API adaptation, not proof that unmodified Node `http`, Undici `fetch`, or arbitrary networking works. The native profile currently has output/argv/input plumbing rather than the QuickJS tool bootstrap; extending it for a Node binding is real work.

For unmodified HTTP APIs without an in-guest TCP/IP stack, implement a narrow socket proxy: guest socket-like descriptors map to broker handles in a separate network-enabled host component, not ambient networking in the confined VMM. Implement nonblocking connect/EINPROGRESS, SO_ERROR, recv/send partial progress, EOF/shutdown, EAGAIN, readiness and close/reset. DNS may use getaddrinfo's pthread path or c-ares behavior depending on API/build; HTTPS also needs trust roots, correct wall time and entropy if TLS stays in the guest. A host TCP proxy leaves those guest TLS obligations intact. A virtio-net device plus an in-kernel network stack is a much larger route.

**De-risk / size / kill.** First one bounded HTTPS tool request (3–5 days) with cancellation, oversized reply and redirect-policy tests. Next, only if unmodified APIs are required, a 3–6 week socket-proxy profile; a robust general TCP/IP stack is months. Add truthful `/proc/self/exe`, selected memory/CPU files and `/dev/null`/entropy devices only as declared runtime contracts require; do not bake host-specific fake values into “compatibility.” Host tools avoid a networking kill condition. General network/process compatibility could kill the small-kernel scope, and bypassing host egress policy would invalidate the product's authority model.

## 12. Platform limits and the bare-metal gate

**Verified—code / reported.** Guest implementation is AArch64 only (`kernel/src/arch/mod.rs:14–17`; `packer.ts:134`; MCP native platform guard `mcp/native.mjs:31–33`). `kvm/reset.rs:21–26` explicitly calls out unverified cache/coherency reasoning on bare metal without FEAT_S2FWB, recommending hostile cached-write/uncached-read probes on e.g. Neoverse N1. The October 31 memory report labels KVM observations nested and non-transferable as performance claims (`:181–183,237–245`). The frozen `docs/KILL-CRITERIA.md:14–24` is historical R4 evidence, not a current live pass/fail ledger; it nevertheless correctly separates nested function from metal density and tails.

**Verified—source.** HVF supports multiple vCPUs through capability queries; one VM per process is its different constraint. Apple documents nested EL2 support and virtual GIC additions, and newer configurable IPA granules including 4 KiB. The local SDK declares `hv_vm_get_max_vcpu_count` (`.../Hypervisor.framework/Headers/hv_vm.h:20–25`), `hv_vm_config_get_el2_supported` and max/default IPA queries (`hv_vm_config.h:27–73`), and 4 KiB/16 KiB IPA configuration on macOS 26 (`:110–143`). This engine uses default VM configuration and hardcodes 16 KiB tracking (`hvf.rs:590–592,680`); newer framework support is not implemented support. Nested capability is host/OS dependent, not universally absent or universally available. [Apple updates][S20], [Apple GIC][S10].

**Region-limit qualification.** The current class uses five stable RAM extents plus a late-bound input archive (`abi/src/lib.rs:469–478`; `hvf.rs:606–610`). Guest VMAs must not be confused with hypervisor memory regions. I did **not** find an authoritative numeric HVF mapping-region ceiling in the checked public documentation/SDK; do not repeat a guessed “32/64 regions” limit as fact. Partial protect/map churn and new executable regions need an actual capability/stress experiment. KVM exposes `KVM_CAP_NR_MEMSLOTS`; its limit should be queried rather than inferred from the repo's archive slot number. [KVM API][S21]. A huge guest VA reservation alone need not create more stage-2 regions.

**De-risk / size / kill—inferred.** Use external bare-metal arm64 infrastructure now, never Linux on this shared laptop. In 2–5 lab days run existing hostile reset/coherency probes on representative CPUs, then qualify timer/GIC, feature/register coverage, and lifecycle behavior. Allow 2–4 weeks for meaningful density and matched Firecracker evidence. HVF's `SYS_REGISTERS` startup probe deliberately fails closed when an OS exposes a different register set (`hvf.rs:14–20,247–265`); GIC/EL2/extensions require additional reviewed snapshot coverage, not bypassing that check. An x86 port would require new MMU/traps, ELF/syscall ABI and reset backend qualification and is a separate months-scale project. Bare-metal state leakage is a release kill; poor matched economics can kill the Node investment. Mac-specific performance failures need not kill Linux production, but broken development parity has a maintenance cost.

## 13. Security findings that grow with the kernel

**Verified—code corrections to the dated reviews.** Do not carry F1–F8 forward wholesale from revision `b340ddfa`:

- Native Linux confinement, parent-death handling and independent watchdog budgets are now explicit (`kvm/native.rs:267–287,315–328`); HVF native has a supervisor (`hvf/native.rs:18–21,354–361,380–381`). This is source evidence, not a new runtime recertification here.
- Cancellation is checked before and after credential issuance, and listeners are removed (`executor/policy/policy.mjs:113–140`), addressing the cited F4/F8 mechanism.
- Release now arms a reset acknowledgement bound (`executor/shard-backend.ts:438–441`), addressing the cited F5 mechanism.
- Native input normalization charges cumulative decoded bytes before decoding (`mcp/native.mjs:14–24`), addressing the cited F6 mechanism.
- Generated-source validation is token-based now (§1). Stage-0 variant-tree gating is also newer than the reviews.

**Remaining concerns, verified basis plus inferred consequence.**

1. **Single-vCPU safety contracts cease to hold under SMP.** `syscalls.rs:6–21` validates pages then performs raw copies under the promise that EL0 cannot run concurrently. Another vCPU unmapping/protecting those pages creates a validation/use race and potential fault or memory reuse. Heap/global state uses unsynchronized `static mut`; the filesystem EBUSY guard prevents aliases but does not implement Linux contention semantics. Lock, pin or stage copies with reviewed lifetimes; never add SMP by merely increasing a count.
2. **Semantic blind spots become memory-safety and liveness problems.** Non-enforcing PROT_NONE on the merged console path undermines guard/cage assumptions; bad futexes and signal frames create hangs or privilege restoration errors. The hardware boundary still treats EL1 as hostile (`docs/ARCHITECTURE.md:108–126`); a guest-kernel defect is not automatically a host escape, but guest correctness and promised runtime isolation still fail.
3. **The host process remains a shared trust/failure domain.** Linux slots share one engine address space unless split (`docs/ARCHITECTURE.md:118–122`). Larger native allocations, mappings, queues, sockets and test code increase resource and parser surface. Apply host memory/CPU/task bounds at the actual process domain and measure their density cost.
4. **Noncooperative host work still outlives VM cancellation.** `executor.ts:155,169–176` launches asynchronous dispatch work and retires a VM independently; policy limits are per run (`policy.mjs:49–55`). Source contains no service-wide outstanding-provider permit mechanism in that path. AbortSignal is cooperative; across repeated cancelled runs, long-lived tasks require independent global accounting and, if required, separately terminable workers. Networking makes this more important.
5. **Certification must cover executed ring/native bytes.** Snapshot loading checks ABI, layout and register format (`snapshot.rs:211–241`), not a certificate of syscall semantics. Console growth passes do not certify ring behavior, whose memory, time, entropy and transport differ. The architecture review's exact-artifact concern (`:401–428`) remains relevant.
6. **JIT and more devices expand restored state.** Track executable permissions, all vCPUs, interrupts, virtual timers, pending wakeups, scratch inode/FD state, proxy connections, entropy and host-generation ownership. Complete byte reset alone does not reset external effects or runtime cached randomness.

**Test suites and evaluator work—inferred plan.** Port selected **LTP** syscall tests and **gVisor** syscall tests, not an unfiltered “suite passes” claim. Start with mmap/mprotect/munmap/mremap protections and aliases; clone/TLS/clear-child-tid/exit; futex WAIT/WAKE/bitset/timeouts/requeue; signal masks/frames/EINTR; epoll/eventfd/pipes/close; cwd/rename/truncate/fcntl/SQLite histories. Pin suite revisions and retain unsupported categories. LTP's `futex_wait02` itself uses fork, wait, shared mmap and process-state inspection; gVisor mmap/futex tests use gtest/Abseil and some procfs/process helpers. These dependencies require a launcher/static-toolchain port or extracting self-contained assertions without weakening their meaning. [LTP example][S22], [gVisor futex][S23], [gVisor mmap/protection][S24].

Supplement Linux differential runs with bounded schedule exploration and invariants: no lost wakes, no duplicate wake/response, no task left runnable after group exit, no stale FD/generation waking a new object, no user mapping to a table/kernel page, no RX/RW alias, and no cross-tenant bytes/instructions. Inject races around compare/enqueue, timeout/wake, unmap/copy and signal/return. A schedule-specific Linux output is not a universal oracle; compare legal outcomes and happens-before/linearization properties. Keep hostile HVF/KVM reset tests separate from ABI tests. Initial audit 1–2 weeks; maintained concurrency/security qualification is ongoing months. If that maintenance exceeds the budget, narrow the profile or use Linux rather than lowering the gate.

## Recommended early decision sequence

**Inferred.** Do the cheapest uncertainty-reducing work before implementing the entire chain:

1. Freeze the guest Node profile and inspect its binary/startup requirements remotely; decide static musl, pointer compression/sandbox, addons, workers and HTTP API scope.
2. Refresh the exact-branch findings ledger; make no-op cwd and guard-page mutants fail. Keep Stage-0 console-only scope explicit.
3. Run the large-dirty-set and bare-metal reset gate on external hardware. Agree a workload, matched baseline and required economic margin before optimizing.
4. Implement sparse reserve/commit/protect and bounded larger physical backing; prove 50 MiB committed work without GiB-scale physical reservation.
5. Establish one-vCPU pthread/futex/timer/epoll/signal foundations with independent tests; run `Node --jitless` under the declared profile. A trivial print is only bootstrap evidence.
6. Establish a secure checkpoint/entropy contract, then JIT permission/cache/reset correctness. Enable SMP only for demonstrated benefit.

The combined Stage-2 work is plausibly **several engineer-months (roughly 3–6 months for a narrow reviewed prototype), with broader compatibility/support taking longer**. This is a planning inference from missing subsystems, not a measured forecast or a sum of table rows. A Node-native-thread bootstrap trace, sparse-memory spike and matched dirty-set measurement can sharply revise it before most of that investment.

## Sources

Local evidence is referenced with file:line pointers above. Principal supplied context read: `arch/jitk/README.md`; `docs/ARCHITECTURE.md`; historical `docs/KILL-CRITERIA.md`; kernel main/syscalls/heap/user/memory/arch and filesystem sources; HVF/KVM/slot/snapshot/clock code; `grow/README.md` and evaluator sources; `arch/research/growos-fit/04-CRITICAL-REVIEW.md`; both 2026-10-29 security and architecture reviews; `bench/v1/results/2026-10-31-memory.md`. No historical raw benchmark evidence was fetched or rerun. The root architecture engine table at `docs/ARCHITECTURE.md:68–74` contains stale reset/confinement descriptions; current implementation and the dated October 31 memory report take precedence.

External primary sources were read on 2026-10-31. Exact Node v24.22.1 configuration/platform sources were checked; other `v24.x`, `main` and `master` URLs are moving sources and establish design/API evidence, not certification of a guest artifact. The final guest must pin its own complete dependency versions. No external benchmark is used as a Sofort performance claim.

- [S1 — Node v24 build/platform instructions][S1].
- [S2 — Node v24.22.1 configure options and V8 feature selection][S2] (`--fully-static`, pointer compression and sandbox configuration).
- [S3 — V8 pointer compression][S3].
- [S4 — V8 sandbox design and address-space requirement][S4].
- [S5 — Node-bundled V8 code-range reservations][S5].
- [S6 — Node v24.22.1 platform worker startup][S6].
- [S7 — libuv threadpool, sizing and lazy stacks][S7].
- [S8 — Node-bundled V8 threading flags][S8].
- [S9 — Apple virtual timer mask and interrupt handling][S9].
- [S10 — Apple GIC creation and topology][S10].
- [S11 — Linux KVM VGICv3 interface][S11].
- [S12 — libuv event-loop design][S12].
- [S13 — Node-bundled libuv eventfd async wakeups][S13].
- [S14 — Node-bundled libuv signals][S14].
- [S15 — Node-bundled V8 POSIX memory permissions][S15].
- [S16 — Node-bundled V8 arm64 cache synchronization][S16].
- [S17 — Arm on publishing self-modifying code across threads][S17].
- [S18 — Firecracker snapshot uniqueness and state][S18].
- [S19 — Node-bundled libuv Linux/procfs behavior][S19].
- [S20 — Apple Hypervisor platform updates][S20].
- [S21 — Linux KVM API, including memory-region capabilities][S21].
- [S22 — LTP futex wait/wake test and its harness dependencies][S22].
- [S23 — gVisor futex syscall tests][S23].
- [S24 — gVisor mmap/mprotect syscall tests][S24].

[S1]: https://github.com/nodejs/node/blob/v24.x/BUILDING.md
[S2]: https://github.com/nodejs/node/blob/v24.22.1/configure.py
[S3]: https://v8.dev/blog/pointer-compression
[S4]: https://v8.dev/blog/sandbox
[S5]: https://github.com/nodejs/node/blob/v24.x/deps/v8/src/heap/code-range.cc
[S6]: https://github.com/nodejs/node/blob/v24.22.1/src/node_platform.cc
[S7]: https://docs.libuv.org/en/v1.x/threadpool.html
[S8]: https://github.com/nodejs/node/blob/v24.x/deps/v8/src/flags/flag-definitions.h
[S9]: https://developer.apple.com/documentation/hypervisor/hv_vcpu_set_vtimer_mask(_:_:)
[S10]: https://developer.apple.com/documentation/hypervisor/hv_gic_create(_:)
[S11]: https://cdn.kernel.org/doc/html/latest/virt/kvm/devices/arm-vgic-v3.html
[S12]: https://docs.libuv.org/en/v1.x/design.html
[S13]: https://github.com/nodejs/node/blob/v24.x/deps/uv/src/unix/async.c
[S14]: https://github.com/nodejs/node/blob/v24.x/deps/uv/src/unix/signal.c
[S15]: https://github.com/nodejs/node/blob/v24.x/deps/v8/src/base/platform/platform-posix.cc
[S16]: https://github.com/nodejs/node/blob/v24.x/deps/v8/src/codegen/arm64/cpu-arm64.cc
[S17]: https://developer.arm.com/community/arm-community-blogs/b/architectures-and-processors-blog/posts/caches-self-modifying-code-working-with-threads
[S18]: https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md#snapshot-security-and-uniqueness
[S19]: https://github.com/nodejs/node/blob/v24.x/deps/uv/src/unix/linux.c
[S20]: https://developer.apple.com/documentation/updates/hypervisor
[S21]: https://www.kernel.org/doc/html/latest/virt/kvm/api.html
[S22]: https://github.com/linux-test-project/ltp/blob/master/testcases/kernel/syscalls/futex/futex_wait02.c
[S23]: https://github.com/google/gvisor/blob/master/test/syscalls/linux/futex.cc
[S24]: https://github.com/google/gvisor/blob/master/test/syscalls/linux/mmap.cc
