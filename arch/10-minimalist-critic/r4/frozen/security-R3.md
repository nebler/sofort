# 07 — Round 3 (security integration, vmm v2 robustness, H5)

Load average during the runs was 55–158; the machine was shared with the foreign job and other agents. All timings are contended functional numbers.

## FIXED / delivered
- **`jitk/vmm/sandbox/` (.READY).**
  - `mod.rs` matches 01's adapter.
    - macOS: the precompiled Seatbelt profile.
    - Linux: rlimits, prctl, setns, Landlock, and per-role seccomp through the thread hook, with a union TSYNC filter as fallback.
  - 9 decision tests pass.
- **`jitk/executor/policy/` (.READY).**
  - `policy.mjs` is canonical, with `.d.ts` types and a README with the hook signature.
  - `dispatch` accepts only calls granted by `decide`/`approve`, single-use, and a violation makes the run dead.
  - 22/22 owner asserts pass, plus 04's policy-check (22+22).
- **`jitk/vmm/` (taken over from 01; .READY restored).**
  - **Patch:** robustness **v2** in `patches/series`.
  - **Production build** (`make build`): panic=abort, static rlib, fat LTO, strip, ad-hoc signed with the entitlement. macOS binary sha256 `276463d0…a20e`.
  - **Tests added:** console-abuse fixtures and runner, plus a console stage in the nested runner.
  - **Nested runner fixed:** progress output; and `console-abuse.py` uses portable CPU accounting, because the nested image has no `resource` module.
- **New bug found and fixed (v2).** Upstream libkrun `undo_pop()`s a console chain that yields 0 bytes, so a single bad descriptor makes a host thread re-pop that chain forever.
  - **Stock a1d8616, n=5, 3 s deadline:**

    | Mode | Bad descriptor | Host CPU |
    |---|---|---|
    | 4 | TX outside RAM | **5.8 CPU-s in 3 s wall** |
    | 8 | RX outside RAM, host input pending | 1.4 CPU-s |
    | 9 | zero-length RX | read as host EOF, so the port dies |

  - **v2:** all three modes stop cleanly with 0.01 s CPU.

## Gate H5 — integrated build (canonical `kernel/dist/kernel.bin`, production vmm)
Outcome classes:
- **CLEAN:** the VMM exits by itself: rc 0 (SYSTEM_OFF) or rc 75 (HVF guest fault).
- **WATCHDOG:** contained by the external watchdog, i.e. SIGKILL at the deadline after the sandbox ack.
- **KILL:** killed by the host dispatcher or policy.

All three count as contained when there is no host effect.

| Case | Platform | n | Expected | Observed | Host effect |
|---|---|---|---|---|---|
| CLI checks (bad args, seed/epoch, EOF-before-go, real qjs tool call, wait-go bytes, one console, signature) | macOS / nested KVM | 12 / 12 | pass | 12/12 / 12/12 | none |
| unknown-hvc, unknown-smc, mmio-halfword, console_avail_oob, rtc_oob_read | macOS + KVM | 30 each | CLEAN 0 | 150/150 + 150/150 | none |
| bad-sysreg (no vectors) | macOS | 30 | CLEAN 75 | 30/30 rc 75 | none |
| bad-sysreg (no vectors) | KVM | 30 | **WATCHDOG (expected on KVM)** | 30/30 SIGKILL @0.5 s, ack seen | none |
| bad-sysreg-handled (VBAR → SYSTEM_OFF) | KVM | 30 | CLEAN 0 | 30/30 | none |
| Console abuse 1–6, 8, 9: bad port ids, PORT_OPEN ×3, 20k control kicks, TX outside/straddling RAM, looping chain, bad RX + pending input, zero-length RX | macOS + KVM | 30 each | CLEAN 0 and device alive (`ALIVE n`) | 240/240 + 240/240; CPU p50 0.01 s (mode 3: 0.1 s macOS, 1.3 s KVM; 20k MMIO exits are guest-paid) | none |
| Console mode 7: host EOF, guest idles in WFI | macOS + KVM | 30 | WATCHDOG, ~0 host CPU | 30/30 + 30/30; CPU ≤0.035 s over 3 s | none |
| 03 protocol hostile suite: forged envelope/prototype/RS, duplicate id, 65 outstanding, 4097 calls, log floods, oversized frame, control bytes, fd2 injection | macOS | 19 × 30 | KILL, 0 tool effects | 570/570 | none |
| Forbidden syscall after confinement (seccomp probe) | KVM | 1 | SIGSYS | -31 | none |
| Sandbox escape from inside the VMM (12 attacks, with unconfined controls) | macOS | 12 | blocked | 12/12 EPERM | none |
| Policy bypass (forged ns/fn, approval forgery/replay/tamper, fabricated dispatch, budgets…) | host | 32 | KILL/deny/approve | 32/32, 0 unintended invocations | none |
| JS runaway CPU, never-settling tool, abort (04's `verify` on integrated jitk) | macOS | 1 each | WATCHDOG/KILL | pass (SIGKILL 217 ms) | none |

Evidence:
- vmm: `jitk/vmm/evidence/{checks-darwin,checks-linux,console-abuse-darwin,console-abuse-darwin-stock-control}.json` and `nested-kvm.log`.
- 07: `07-security-sandbox/h5/*`.

## Still open (UNVERIFIED)
- JS-level memory exhaustion, stack exhaustion and host EOF mid-call on the integrated VM. I did not build the harness for these.
- The Linux sandbox-escape suite (`sandbox/tests/escape.rs`) under nested KVM.
- One earlier nested run (by 01) hung with L1 soft lockups after the wait-go check. My 3 reruns passed (43–157 s). The cause is unknown; suspect nested-HVF starvation at host load ~75–120.
- Bare-metal Linux numbers.
