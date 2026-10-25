# Round-3 review notes (lead)

## 03 protocol R3 — DONE, protocol/.READY
+ Canonical protocol in arch/jitk/protocol; DEL + UTF-8 log budget drift fixed; executor/hyperlight/kernel import canonical (verified).
+ Host: 142/142 corpus, 25k mutations. REAL VM n=30/case: 300/300 guest conformance + 570/570 hostile (19 cases: forged authority/prototype/kernel record, dup id, 65 outstanding, 4097 calls, log floods, oversized frames, os.write control bytes 0x0/0x9/0xd/0x1e/0x1f/0x7f/0x80, fd2 forgery dropped). Zero tool side effects.
! Load 63–107 during runs → timings meaningless; functional result solid.
! "4097 total calls" takes 2.4 s median and "Unicode log budget" 1.3 s: fine functionally, but per-call VM overhead at that load. Check under 06 load-gated bench.

## 01 vmm R3 — interim (pre-sandbox/.READY)
+ Pinned libkrun a1d8616 + 4 patches (robustness, thread-hook, control-RX, +1) builds on macOS; Linux patched lib compiles.
+ Integration candidate with 07's sandbox/mod.rs (unchanged, API matches): 12/12 CLI PASS; canonical kernel tool call → 42; 6 fault guests × 30 = 180/180 clean exits (bad-sysreg → 75, others 0), no SIGABRT/hang. Robustness patch confirmed.
+ Seatbelt apply 0.029 ms p50; prepare+apply 0.056 ms (load ~26.5). 06's "10 ms sandbox" bottleneck eliminated (~170×).

## 02 kernel R3 — DONE, kernel/.READY (sha 5dcfd905…, 2.92 MB, 1,449 guest LOC, 32 MiB)
+ 08's per-syscall files + build.rs slots adopted; ioctl EBADF merged; ppoll WFI/CNTV (no busy-poll); grow-trace v2; packer rejects RX/RW page overlap + W+X (10's bug fixed); atomic ASCII validation.
+ G1 0.00%/1000, G2 30×64, isolation 9/9 re-pass on new layout. Parked call p50 0.91 ms at load ~67–94.
+ Signal slots 134/135 intentionally absent → 08 grows them for Lua (demo).
! 1,449 LOC: within 1.5k target but close; Lua profile must stay ≤350 (10's kill line) → ~1.8k ceiling.

## 09 hyperlight fair bench R3 — 900/900, paired CIs, load 31–159 (0/900 under quiet gate)
PARKED (fair: jitk pre-booted single-use VM vs HL prespawned worker with snapshot loaded), medians ms:
  return2 1.81 vs 7.40 (jitk 4.1×) | 1 tool 12.8 vs 13.7 (tie) | Promise.all(10) 18.6 vs 92.7 (jitk 5.0×) | 1 MiB JSON 12.1 vs 24.1 (jitk 2.0×) | loop tie
  vs HL shared-VM logical clone: return2 tie (1.81 vs 1.56), all(10) jitk 4.4×, JSON jitk 1.6×.
COLD: HL wins return2 (14.5 vs 27.3); jitk wins all(10) (38 vs 129); rest inconclusive.
MEMORY parked: jitk 10.7 MiB footprint vs HL strict 1.8 (6×); HL 33 logical units in one process 7.3 MiB total.
=> Verdict: jitk parked ≥ Hyperlight on latency everywhere measured (wins or ties); Hyperlight wins memory density 6× and cold trivial. Memory is jitk's #1 gap → page sharing / smaller guest (R4).
! Used r2 raw fallback (executor .READY absent). Load still awful; numbers are relative (interleaved, paired), not absolute.

## 01 vmm R3 — macOS PRODUCTION PASS, vmm/.READY
+ /tmp/jitk-01/r3/darwin/jitk-vmm (sha 73df1ad3…), sandbox_ready=true, kernel 5dcfd905 verified. 12/12 CLI (incl. 1000-byte wait-go, real tool → 42); 180/180 fault runs clean. Seatbelt apply 0.043 ms p50, prepare+apply 0.094 ms.
+ Linux: nested candidate passes boot/qjs/SIGSYS; production relink running; old bare echo fixture's KVM interrupt wake being fixed before full fault suite.
! Watch: guest parking on KVM (GIC/WFI semantics differ from HVF) — the "echo fixture wake" issue may also affect the real kernel on Linux. Must be verified in 05's nested suite.

## 04 executor R3 — DONE, executor/.READY
+ E4: resolve-before-reap verified (every SIGKILL/reap after caller resolution). Warm execute() p50 2.96 ms (was 6.8 in R2) at load ~82. 
+ E5: 07 policy canonical (22+22 asserts); canonical protocol import; sandbox ack + profile gating; Hyperlight kind (6 checks); 20 checks + CF/TanStack conformance + 30×64 on integrated artifacts. Demo: 2 concurrent tools → total=2.
+ Warm breakdown p50 (ms): acquire 0.09 | sendRun 0.28 | firstCall 1.97 (wake + qjs compile of AsyncFunction body + first call) | ret 0.19 | done 0.31 | resolve 0.03 → execute 2.96. Kill 0.075 ms AFTER resolve; reap 3.2 ms after (off path). 
! Next lever = firstCall 1.97 ms: guest-side compile of the run body at load 83; quiet run will tell. Candidates: none needed for v0.

## 08 grow + Lua R3 — DONE, grow/.READY
+ Copy-only growth against canonical kernel; owner.patch handed to 02 (02 applied). 3 transactions: regrow ppoll (11 events), NEW rt_sigprocmask(135), NEW rt_sigaction(134); each 30/30 fresh VMs; manifest 0→3. Whole run 90.9 s. Demo rehearsed 45.0 s with 2 live VM boots.
+ Static musl Lua 5.4.8 packed via 02's generalized ELF+argv: 30/30 byte-identical stdout vs Linux. +6 kernel LOC (signals = explicit ENOSYS profile, 3 lines each, verified vs strace-injected-ENOSYS Linux).
! HONESTY FLAG 1: R3 transactions used pre-authored proposal files (no live model call in controller timing); live headless-Codex generation evidence is from R2 only. Demo must either do live generation or say "replay". → Demo must run LIVE for the public video.
! HONESTY FLAG 2: Lua already computes on the un-grown kernel (default missing slot returns ENOSYS too) — growth "makes the fallback explicit + verified", it doesn't bring Lua from dead to alive. Story must say "kernel grows a verified contract for Lua", not "Lua couldn't run". A stronger D14 demo needs a binary that genuinely fails without a syscall (e.g. SQLite time/random needs fcntl/getpid real semantics, 10 measured +5).

## 07 security R3 (Claude) — sandbox/.READY + policy/.READY; H5 PARTIAL
+ sandbox/mod.rs matches 01 contract exactly (no change); 9 decision tests; integrated macOS tool call with single sandbox ack.
+ policy hardened: dispatch only accepts calls granted by decide/approve, each once; violation kills run. 22 + 04's 22 pass.
+ Patch series robustness→thread-hook→control-rx→native-build applies in order.
+ H5 macOS integrated: 03 protocol hostile 19×30 pass; VMM escape attempts 12/12 blocked (10 unconfined controls escape → test validity); policy bypass 32/32; console abuse 5/6.
- NEW BUG: guest can spin a host VMM thread at 100% CPU forever (TX descriptor outside RAM / zero-length, or unusable RX descriptor with pending input → endless requeue). Stock + v1 patch affected. libkrun-robustness-v2.diff written, builds; NOT yet re-run (macOS VmCreate refusals at 03:29 — 128 address-space limit from parallel agents).
- Not done: JS runaway CPU, memory/stack exhaustion, host EOF, n=30 bare guests on integrated build, console guests 7–9, Linux H5.
+ KVM: bad-sysreg = "contained by external watchdog (expected)"; vbar-sysreg.S clean-exit variant.

## 05 linux R3 — H3 PASS (nested), linux/.READY
+ Nested KVM: 100 boots, 30 tool calls, 800 concurrency completions, 256 parked VMs, 720 seccomp checks, 180 contained fault guests.
+ KVM PARKING PASS on canonical kernel: 1000/1000, zero stalls, idle 0.004% core. (Legacy fixture stall ≠ canonical defect; KvmGicV3 injects via irqfd.) My escalated risk retired.
! Nested 4-vCPU outer guest hard-locked once under boot stress (nested-HVF SMP issue); final run used 1 outer vCPU. Nested-only artifact; note for future harness users.
! CPU 12.9 ms/VM at c4 (same as macOS); attribution unresolved. Metal run needed to evaluate 10's 5 CPU-ms kill line.

## 07 (took over vmm/) — v2 integrated, vmm/.READY restored
+ v2 replaces v1 in series; extra bug fixed: zero-length RX buffer misread as host EOF (closed guest console input).
+ macOS: 12/12 CLI, 180/180 faults, console abuse 9×30 = 270/270 (mode 7 host-closes-stdin → watchdog 3 s, ≤0.035 CPU-s). Guest-4 spin: 0.01 CPU-s on v2 vs 5.8 CPU-s/3 s stock. FIXED.
+ Linux nested: CHECKS/CONSOLE/SECCOMP/INIT PASS; 210 fault runs (bad-sysreg watchdog-contained 30/30 as expected; vbar variant clean 30/30); console abuse 270/270; SIGSYS on forbidden socket.
+ H5 so far: protocol hostile 570/570, VMM escape 12/12, policy 32/32, JS runaway + never-settling tool killed at 217 ms (n=1 each). No host effect anywhere.
- Open H5: JS memory exhaustion, stack exhaustion, host-EOF-mid-call harnesses; Linux escape suite; n for JS runaway only 1.

## 10 integrator R3 — gates
- H1 FAIL (build PASS): kernel grow-contract test depends on unshipped /tmp/jitk-08/.../r2/ioctl.S; executor selector derives root from checkout basename (breaks when dir isn't named "jitk"); 08 verifier depends on /tmp repo path. → portability fixes (02, 04, 08).
+ H2 PASS functional (independent make demo: executor result, 90/90 regrowth gates, 30/30 Lua, all reaped).
+ H3 PASS (05 evidence; v1 VMM build — 07 has v2 device tests separately).
~ H4: 06 table 2,460/2,460 validated, 0 load gates passed (load 14–146). Contended only. 06 still finishing.
~ H5: macOS hostile classes pass (protocol 570, memory 30, stack 30, CPU 30, no host effect). **Exposure criterion FAIL**: a tool callback that blocks the Node event loop 200 ms with a 30 ms deadline overshoots >50 ms 29/29 — the deadline timer lives in the same event loop. CPU-only timeout overshoots 10/30 under heavy load. Policy abort doesn't force-cancel noncooperative tool.
- LOC 10,658 owned (incl tests/build) vs 5,750 planning cap — duplication (watchdog copies, test copies, fallback kernel fragments, dead bootstrap). Runtime kernel 1,455.
- Artifact drift: 04 cert + 06 bench used VMM 73df1ad3 (pre-v2); H2/H5 used v2 276463d0. Must recertify on one frozen set.
LEAD VERDICT: Real, valuable red-team. The deadline finding is a genuine design bug: watchdog must be OUT of the executor's event loop (separate process or worker thread with its own timer that SIGKILLs the VMM regardless of main-loop state) — 05/02 already have an external watchdog process per VM (`launch`); executor must use it with the run's deadline, not a fixed 5 s.

## 06 bench R3 — canonical table (n=60/case, interleaved, bootstrap CI; load 14–146, 0 quiet gates)
PARKED p50 ms (jitk-raw | HL strict-parked | HL clone[shared VM]):
  return2 1.07 | 1.86 | 1.22 ;  one_tool 1.13 | 2.78 | 1.70 ;  one_tool_5ms 9.58 | 10.58 | 10.49
  promise10_5ms **9.52 | 102.3 | 108.5 (jitk ~10.7×)** ; json1m 16.7 | 30.9 | 23.3
COLD p50 ms (jitk | HL strict): return2 25.5 | 18.4 ; one_tool 26.5 | 19.4 ; promise10 34.1 | 176.8 ; json1m 39.5 | 44.6
CPU-ms/VM: jitk ~14 (json 23–25) vs HL ~9 (json ~24). Refill 100 (c4) / 145 (c8) VM/s per-sample median under load. Parked footprint 10.7 MiB / RSS 15.3 MiB. Sandbox apply 0.038 ms.
=> Under identical contention: jitk parked is fastest on every workload; ~10× on concurrent tools. HL wins cold trivial (~1.4×), CPU/VM (~1.5×) and memory (~6×).
! Bench used VMM 73df1ad3 (pre-v2) — recert needed.
