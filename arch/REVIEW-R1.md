# Round-1 review notes (lead reviewer)

## 10 minimalist critic
+ Chooses B (EL0 qjs, Rust EL1) — agrees with consensus. Strong: build-time ELF packing (pack_elf.py) → flat 2.40 MB image (vs 9.69 MB file) — removes guest ELF parser AND most of payload cost.
+ A (QuickJS linked into kernel) needs 52 libc fns (51 live after gc-sections) vs 15 syscalls; freestanding compile needs CONFIG_ATOMICS patch. Good numbers.
+ Kill criteria + M0..M4 concrete. M2 "45-second growth video" = right demo.
! Boot reproduction 27 ms vs brief 3.3 ms — measured while 9 other agents were compiling/docker-ing (uncontrolled contention). MUST re-measure on a quiet machine before believing either number. Lead to re-run.
! Disagrees with "bump allocator": keep musl malloc, implement mmap/munmap honestly — valid (realloc churn exhausts bump arena). Need reuse of munmapped regions or a simple free-list in kernel mmap.
! Disagrees with eager warm pool: start cold, measure qjs-ready first. Reasonable sequencing.
! Wants to cut pluggable backend abstraction — conflicts with 04/09; resolve: one interface (Executor) is free; don't build a framework.
? "one outstanding call initially" — conflicts with Promise.all goal; see 03.

## 05 scale fleet
+ HVF one VM per process CONFIRMED (2nd hv_vm_create → HV_BUSY). Pool on macOS = pool of processes. Settled.
+ macOS density: 127 parked VMs max (VM 128 fails), 7.2 MiB RSS/process, 64 MiB guest only 16 KiB resident (sparse). 127 ceiling possibly system-wide HVF limit incl Docker's VM — UNVERIFIED; dev-only concern.
+ Baseline full spawn→SYSTEM_OFF 5.9 ms median under contention (vs 3.3 quiet; 10 says 27 ms). Conflict → lead re-measures.
+ Linux page sharing: file MAP_PRIVATE / sealed memfd 39 MiB vs 256 MiB anon PSS (32 procs). But libkrun uses anonymous GuestMemoryMmap (builder.rs:2081) → sharing needs a libkrun patch. Defer; correct.
+ QuickJS RAM: bootstrap 1.2 MiB peak RSS; 1 MiB JSON 4.4 MiB; 4 MiB JSON needs 16 MiB heap (13.5 MiB peak). → guest RAM 32 MiB default viable; 64 MiB safe start.
+ No /dev/kvm in Docker Desktop (LinuxKit 6.10, no kvm modules). Linux perf needs Graviton metal (c7g.metal spot). BLOCKER for all Linux claims.
+ Cost model: jitk ~$0.64/M vs Dynamic Workers unique code $2,000/M (!) vs reused $0.50/M, Lambda $1.87/M, E2B $18.5/M. Big pitch number — but $2.32/h host price UNVERIFIED and CPU 10ms assumption.
! Sequential creation 47 VMs/s (median 15 ms, contended, includes 358 ms outlier) — this is the refill bottleneck number; must be re-measured quiet and in parallel.
! 1000 exec/s/host target unverified; fine as goal.
! Recommends per-host daemon jitkd with SOCK_SEQPACKET API — conflicts with 04 (TS executor spawns VMM directly). Resolve: library-first (executor spawns jitk-vmm), daemon later for fleet. 

## 01 VMM host  (strongest so far)
+ One process per VM: HVF HV_BUSY AND libkrun _exit()s the process on shutdown → also forces 1 proc/VM on Linux. SETTLED.
+ Native Rust builder API works, no bindgen. Rust 6.73 vs C 6.81 ms median (load avg ~21). Single inout port 6.61.
+ Device dump from FDT: exactly one virtio-mmio (console, DeviceID 3) at 0x0a002000; stride 0x1000; PL031 RTC at 0x0a001000 + GIC implicit (no toggle). Don't call add_default_console (adds redirect ports). One port still = 4 queues + MULTIPORT control handshake. → 02 must parse FDT, not scan 0x200.
+ Embedded 9.7 MB qjs in RAW image boots; but RAW loader reads file into Vec + copies (builder.rs:1521) → embedding is NOT zero-copy. Combine with 10's pack_elf (2.4 MB) to cut copy.
+ Kill/reap: 30 ms deadline → closed at median 31.5 ms. Invalid hvc → vCPU thread panics, process HANGS (unwind) → panic=abort gives SIGABRT in 9 ms. MUST: panic=abort + external watchdog.
+ Seatbelt deny-default + HVF boots; file read/write/connect/fork → EPERM. Sandbox blocker ELIMINATED on macOS (pending 07 for minimal profile).
+ Sandbox must be applied BEFORE build() (vCPUs start in build).
! Parking uses polling; WFI + interrupt park UNVERIFIED — needs GIC setup in guest (adds kernel LOC!). Alternative: park by blocking in a virtio read with WFI after enabling virtio IRQ... or simply poll with WFE/yield? Polling burns host CPU for parked pool → density killer. ROUND-2 Q for 01/02.
! Latency numbers measured under load avg 21–45. Lead re-measures quiet.

## 04 executor TS  (working e2e)
+ Contracts confirmed: codemode 0.5.5 Executor.execute(code, providers|fnMap, options?) — never throws; TanStack IsolateDriver lives in @tanstack/ai-code-mode 1.0.0 (not core). Binding keys like external_listIssues; driver receives function BODY.
+ E2E demo works (local qjs backend), 20/20 checks, strict TS. warm-pool one-tool 3.73 ms median, cold 8.78 (process spawn of native qjs, loaded host).
+ Unmodified Cloudflare wrapper runs in QuickJS only with shims (cloudflare:workers module stub, setTimeout, atob/btoa). → use our own bootstrap; keep CF wrapper as compat test.
+ Async stdin via os.setReadHandler → adds **ppoll** syscall. Kernel must implement ppoll on fd0 (blocking until console RX). This is ALSO the natural park primitive (ppoll → WFI until virtio IRQ). Links to 01's parking question.
+ Policy hook `(call, ctx) => allow|deny|requireApproval`, no implicit allow; whole-run provenance taint.
+ Limits: 64 KiB code, 1 MiB frame, 32 outstanding, 1000 calls.
! Hyperlight npm: no darwin-arm64 binding (as expected) — see 09.
! Kill latency with 30 ms deadline: ~35–38 ms. OK.
! Uses private hashed dist exports of codemode for type generation → must vendor (MIT) for prod.
! Protocol mismatch to resolve with 03: args array vs object; {t:"run",code} message; ready frame version.

## 06 perf boot path
+ Phase breakdown (loaded, load avg 25–35): process exec+dyld → main 9.4 ms median (!!) dominates; builder→first vcpu_run 1.5 ms (hv_vcpu_create 0.2, residual devices/FDT/thread 1.2); guest run 10 µs; _exit→wait 0.85. hv_vm_create only 40 µs. → cold path = process spawn cost; pool hides all of it.
+ Strip qjs 9.69→2.39 MB; payload copy 3.07→0.67 ms. Embedding vs initrd: no difference (20 µs). Both copy (builder.rs:1521, 1644). → strip, keep one RAW image for packaging simplicity.
+ QuickJS native: first stmt 323 µs src / 242 bytecode; READY 362 µs; parked call→result 172–177 µs. NG smaller (1.38 MB) but slower startup.
+ CRITICAL: churn test 128 MiB cumulative mmap vs 2.2 MiB peak RSS → bump allocator WILL exhaust. Need real munmap reuse (free-list/range allocator ~100–180 LOC). Confirms 10's objection. Consensus item OVERTURNED.
+ Budget: warm 0.60 ms + T, cold 4.91 ms (projected idle); loaded host cold ≥14 ms.
! Process exec 9.4 ms median under load is suspicious (dyld of libkrun dylib + Rust std init?). Static link libkrun into jitk-vmm (01 linked rlib) may cut this. Quiet re-measure needed. Lead.
! precompile: only ~83 µs; drop from v0. Agree.

## 03 channel protocol
+ Async Promise.all via os.setReadHandler: 64 concurrent calls, reverse-order resolution PASS. Delta syscall = ppoll ONLY (+clock_gettime). Kernel union = 17 syscalls (15 − getcwd + ppoll + clock_gettime ...).
+ Pipes: 15k calls/s pipelined (window 64), seq ~0.8 ms/call in Docker (141 µs native mac). 
+ Strict Rust decoder: dup keys, depth 32, ASCII-only wire (\u escapes → no guest UTF-8 dep), 1 MiB frame, 64 outstanding, poisoned-on-error. 7 tests incl 20k mutations.
+ Bytecode: stock qjs CANNOT load bytecode file (SyntaxError) — needs qjsc-generated exe. → v0 = source bootstrap. Consensus item DROPPED.
! fd2 / kernel text on the protocol port corrupts framing → kernel must route fd2 to sink (or tag frames); kernel debug output must be tagged frames or go nowhere.
! CONFLICT with 04: args object vs array; message names (code vs run, result/err vs ok/err, done ok:bool). Must unify → single protocol spec v1.
! CONFLICT with 04: dispatcher language Rust vs TS. 

## 08 grow loop  (story artifact works)
+ Oracle container: normalized canonical JSONL traces (ASLR→P tokens, fds by alloc order), no caps, no net, read-only. Works.
+ Corpus (JSON-heavy, time/random, loadFile+typed arrays): union 16 guest syscalls = prior 15 + mremap (+clock_gettime confirmed via no-vDSO auxv rewrite, nr 113). Plus ppoll from 03 → **17 for v0**. QuickJS-ng official = 19 (mimalloc probes), NG musl no-mimalloc = 16. Pin Bellard.
+ FULL LOOP PROVEN w/o kernel: strace fault-injection proxy (ENOSYS) → oracle → headless Codex CLI writes ioctl handler → rustc → 4 tests incl 10k fuzz → exact 70-event trace match → git commit of handler+manifest. 27–134 s/iteration. Broken candidate correctly rejected.
+ mremap: ENOSYS fallback works (musl falls back to mmap+copy) but changes trace → "strict" vs "declared profile" conformance. Good nuance (Loupe-style stubbing).
+ Key security point: EL0 can print forged JSON frames → EL1 must frame all EL0 writes (stdout payload wrapped by kernel). CONFLICTS with 03 (bootstrap writes JSON lines directly to fd1). RESOLVE in R2: who frames? Option: kernel wraps every write(1/2) as {"k":"out",...} — no, simpler: protocol frames come ONLY from fd1 (bootstrap); host treats ALL guest frames as untrusted intent anyway (03/04 agree). Forged "missing"/trace frames only matter in dev tracing mode → kernel trace frames use a distinct prefix byte that EL0 writes can't produce (kernel escapes/rejects that byte in EL0 writes). Decide in R2.

## 09 hyperlight backend  (the honest threat)
+ Built hyperlight-js on macOS/HVF from source (nightly-2026-10-20 + aarch64-unknown-none). npm platform gap is packaging only.
+ Numbers (loaded host): warm call 20 µs; host-call crossing ~9 µs; fresh in-process sandbox 3.7 ms; snapshot logical clone 11.7 µs / 295 µs to result / 0.156 MiB marginal; fresh PROCESS from persisted snapshot 1.87 ms in-worker, 9.3 ms incl process launch.
+ Logical clones share ONE Apple VM per process with global exec lock (CPU-serialized) — not one HW VM per job.
+ Guest host calls are SYNCHRONOUS → no Promise.all concurrency (jitk has it via ppoll). setTimeout undefined.
+ Cannot run unmodified static qjs (Linux ABI) — jitk's differentiator confirmed. Hyperlight guest runs at EL1t (no EL0/EL1 split).
! Verdict: "jitk not justified by JS-only perf". Fair. jitk's honest pitch: (1) Linux ABI → grow to run other static binaries (python? sqlite?), (2) EL0/EL1 defense-in-depth, (3) true concurrent async tool calls, (4) one HW VM per execution, (5) the grown-kernel story/manifest.
! Side effect: re-provisioned ~/.local/share/vite-plus (current → 1.2.0+force…, prev 1.2.0). Report to user.
! Fair comparison: both whole-process cold ~9 ms on this loaded box; Hyperlight in-worker 1.87 ms vs jitk parked projected 0.6 ms. Need same-harness bench.

## 02 guest kernel  (CRITICAL PATH — WORKS)
+ 901-line Rust no_std kernel, zero crates. Boots on libkrun, virtio-console hello 6.49 ms whole-process; embedded static qjs at EL0 runs print("hi") 8.96 ms whole-process (n=30, loaded). Lead re-measure (load ~17, Docker VM 98% CPU): bare 5.75 ms, jitk+qjs 8.70 ms median.
+ 9/9 isolation probes pass (PAN, W^X incl. kernel alias, SCTLR write, EL0 hvc, bad pointers → EFAULT).
+ HVF gotcha: MMIO must be plain ldr/str (no writeback) — rust volatile emitted pre-indexed load → ISV=0 → libkrun misdecodes. Pinned asm. Great find.
+ QEMU TCG/HVF with same kernel + LLDB gdb-remote works (dev loop), slower (46–81 ms).
- PARKING FAILS: polled RX = 1.0 core/VM idle. WFE variant: lost wakeup after 1 reply.
  Lead source check: libkrun macOS uses HvfGicV3 (in-kernel hv_gic, builder.rs:1290) when available; fallback userspace GicV3 wakes WFx-parked vCPU via wfe channel (vcpu.rs:29-47). WFx trap (lib.rs:808): if CNTV timer disabled/masked → WaitForEvent (block until IRQ); if armed → WaitForEventTimeout(deadline) → VMM sleeps until deadline. ⇒ Two fixes: (A) proper: GICv3 dist/redist/ICC init + enable virtio SPI + WFI + ack (EOI); verify which GIC path wakes. (B) cheap fallback w/o IRQ plumbing: arm CNTV timer (IMASK=0?) then WFI ⇒ VMM sleeps until deadline → tick-poll (e.g. 1 ms parked). Both also implement ppoll timeouts.
- clock_gettime REALTIME has wrong origin (no epoch) → pass host epoch via FDT bootargs (like seed).
- munmap doesn't recycle (06/08/10 all show this breaks) → page free-list.
- no EOF/control-queue handling.
- Console probe at 0x200 stride works but FDT discovery preferred.
- ELF copy into user RAM (double copy) → adopt 10's build-time packed image mapped in place.
