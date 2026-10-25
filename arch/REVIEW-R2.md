# Round-2 review notes (lead)

## 01 VMM host R2 — G1 host side PASSED
+ PARKING SOLVED: native HvfGicV3 + guest GIC init + WFI, IRQ masked, IAR/EOI, recheck-before-sleep: 1000/1000 exchanges, idle 0.0001% core, echo p50 0.144 ms. No libkrun patch. Apple handles sleep/wake inside hv_vcpu_run (zero userspace wait_for_event). My hypothesis (channel never signaled → stall) was half right: true for channel, irrelevant for native WFI. WFE fails CPU gate (3.2%). Timer 1 ms fallback works (0.5%).
+ jitk-vmm CLI: 103 LOC, static minimal rlib + LTO + strip, 750 KiB, panic=abort, sandbox before build, seed/epoch/counter bootargs, --wait-go. 12/12 checks.
+ Static vs dylib: spawn→main 5.35 vs 6.19 ms; spawn→first guest instr 12.7 vs 14.6 ms (load ~19). Modest win.
+ First launch after (re)signing: ~750 ms (syspolicyd/XProtect scan). Deployment concern: warm the binary once after install. Important ops note.
+ Option C (pre-spawned, unbooted): go→first guest instr 1.3 ms; go→r1 qjs READY 10.7 ms (r1 ELF copy). Idle 0%.
! r1 kernel needs 64 MiB (hangs at 32) — 02 r2 must fix for D5.
! Spawn→first guest instruction 12.7 ms vs spawn→main 5.3 → ~7 ms in builder/sandbox/vCPU setup under load; worth a breakdown (06).

## 03 protocol R2 — FIXED (spec + bootstrap + TS dispatcher)
+ PROTOCOL-v1.md 162 lines (single normative spec), bootstrap.js 128 lines (stock static qjs, source), dispatcher.ts 229 lines (no deps). Total 519.
+ 71 conformance vectors × 2 chunkings, 25k mutations; duplicate keys rejected via structural pre-scan + JSON.parse (one parser). Rust decoder retired (D9 confirmed).
+ 64 concurrent reverse-order calls pass on native + static qjs, 30 runs each. 10/10 terminal-error cases.
+ Dispatcher 53k frames/s @1 KiB (load ~94).
! Latency numbers (RTT 16–36 ms p50) are worthless: load avg 94–153 during runs. The machine is oversubscribed by 9 agents + Docker. ALL R2 latency numbers need a quiet re-run → lead does a final quiet benchmark pass after R2 completes.

## 10 critic R2
+ Withdrew 27 ms claim; re-measured 11.5/13.95 ms bare/qjs at load 15 (lead: 5.75/8.70 at load 17 — variance itself is a finding: cold path is noisy under load; pool matters).
+ Real bugs caught: (1) r1 packer accepts RX/RW segments sharing a page → W^X hole; must validate. (2) r1 stack at PA 0x82c00000 > 32 MiB RAM end 0x82000000 → explains 01's "hangs at 32 MiB". Forward to 02 (R3 if not fixed).
+ D14 measured: Lua 5.4.8 = 14 syscalls (+2: rt_sigaction/rt_sigprocmask), SQLite 3.50.4 in-mem = 13 (+3 incl faccessat), SQLite time/random = 16 (+5). Signals can be ENOSYS'd (30/30 pass). → Lua as 2nd-binary demo, est 200–350 kernel LOC. Credible.
+ Total owned LOC cap 5,750 incl tests (guest 1.7k). Reasonable.
+ Kill criteria refined: idle ≥2%/VM, deadline overshoot >50 ms, M4 p99 >10 ms @c32, >5 CPU-ms, >32 MiB; drop JS-only pitch if Hyperlight within 20%; stop ABI growth if Lua >350 LOC or needs signals/threads.
+ Amendments: kernel framing only between complete guest lines (D8) — good catch: kernel record mid-line would corrupt. Accept.

## 08 grow loop R2 — G4 PASSED on real kernel
+ Two real transactions with VM as system-under-test: (1) deleted ioctl → regrown (agent also FIXED a latent bug: r1 returned ENOTTY for bad fds; Linux says EBADF), 39.5 s; (2) genuinely NEW ppoll (nr 73) grown from scratch, 21.9 s. Each: EL1 0x1E missing record → Linux strace oracle → headless Codex (read-only, one-file schema) → rebuild → fresh-VM differential (6 / 11 events, bytes+errno) → 30/30 fresh VMs → atomic commit (handler + manifest 0.0.0→0.1.0→0.2.0 + receipt).
+ Real qjs with os.setReadHandler: before = nr73 missing; after = reply works. This IS the demo.
+ Per-syscall file + build.rs fixed dispatch slots: deleting handler needs no other edits. Good structure → 02 should adopt for r3 kernel.
+ DEMO.md rehearsed.
! Agent-written ppoll busy-polls (parking is 02's). Merge: 02's WFI primitive + 08's ppoll module.
! Builder not OS-isolated against malicious generated build-time code (rejects unsafe/asm/include patterns only). Acceptable for dev loop; note in security.
! Stage timings n=1; VM latency numbers at load 24–105 — ignore.

## 09 head-to-head R2 — G5 PASSED (600 results, paired bootstrap CIs)
Strict single-use cold (fresh process + HW VM each), medians ms, load 24–71:
| return 2: jitk 9.9 vs HL 8.1 (HL 1.22×) | 1 tool 5ms: 16.8 vs 14.2 (HL 1.18×) | Promise.all(10) 5ms: **15.5 vs 61.4 (jitk 3.95×)** | 1 MiB JSON: **16.2 vs 19.9 (jitk 1.23×)** | 50 ms loop: tie |
+ jitk 10 outstanding calls vs HL 1. HL logical clone (shared VM) 0.85 ms return2 but 53.5 ms on 10 tools.
+ Memory: jitk 10.6 MiB footprint vs HL strict 2.3 MiB (HL snapshot file-backed pages). HVF kernel mem unattributed. HL fresh-source worker grew to ~2 GiB resident after 150 inits (retention).
+ Hyperlight cannot init static Lua (3/3 stalls); Linux runs it. Differentiator holds.
+ Adapter 11/11, 6/6 on 04's executor. Needs 04 to add 'hyperlight-js' kind.
+ R1 "jitk not justified" REVISED: jitk wins concurrency-heavy and JSON; HL wins trivial latency + memory.
! jitk cold is 1.8 ms behind HL strict on return2 — jitk has NO snapshot; its cold includes qjs init. With parking (warm pool), jitk should be ≪ HL strict; need parked comparison (R3).
! jitk memory 4.7× HL strict: jitk copies qjs into anon RAM; HL maps snapshot file. Page sharing (05 D) would close it → R3 candidate after Linux.

## 02 guest kernel R2 — G1 + G2 PASSED. Artifact /tmp/jitk-02/r2/kernel.bin (sha 3d64c3dd…, 2.92 MB), 1,218 guest LOC (+317), 32 MiB, qjs heap 16 MiB.
+ Parking A (native GIC+WFI, IRQ masked, IAR/EOI, recheck used ring AFTER EOI before WFI): 0.00% idle, 1000/1000. Lost-wakeup root cause = cached readiness racing IRQ ack. Timer B 1 ms = 1.2% (fallback). C prespawn 0%.
+ Parked → 1-tool result: 0.342 ms p50 (one window) vs 14.3 ms (another window) — contention dominates; QUIET RE-RUN REQUIRED.
+ G2: 64 calls reversed, 30 VMs; 2.09 ms batch (30k calls/s) in one window, 29 ms in another.
+ ppoll with HUP/NVAL/finite timeouts via CNTV; mremap ENOSYS; munmap recycling via invalid-PTE free set (no metadata!) — 128 MiB churn in 32 MiB passes; REALTIME error <0.963 ms via epoch+counter bracket; console FDT discovery, 8 control buffers, EOF, partial reads; D8 enforced incl writev pre-validation; fd2 dropped.
+ Packed image at PA 0x80080000, no ELF parser/copy: −38 LOC, −2.5 ms paired median to READY.
+ Found libkrun bug: console event_handler.rs:139 control-RX kick doesn't call process_control_rx → worked around with 8 buffers. Upstream-able one-liner.
! 10's bugs: stack PA beyond 32 MiB (fixed implicitly — runs at 32 MiB); RX/RW shared page in packer — verify prepare.py rejects (R3 check).
! Should adopt 08's per-syscall-file layout + build.rs slots for the grow loop (R3 merge).

## 04 executor R2 — G3 PASSED
+ MicroVMExecutor.execute() on real jitk backend (02 r2 kernel): return 2 / one tool / Promise.all(10). Cold p50 19–23 ms, warm pool(4) p50 6.8–12.9 ms at load ~36. 20/20 checks, Cloudflare wrapper + TanStack conformance, 30×64 concurrency all pass through the real VM.
+ Protocol v1 adopted (03's dispatcher copied), codemode helpers vendored MIT, pool: bounded, refill concurrency 2, capacity token held through VMM+watchdog reap, warmCount>0 requires G1 evidence <2%.
+ Found DEL (0x7F) acceptance in upstream ASCII checks (fixed locally; 09 also). Guest Unicode log budget drift vs host — doc'd.
! Warm 6.8 ms vs 02's parked 0.34 ms: warm sample includes SIGKILL/reap + async refill initiation + Node dispatcher at load 36. Need R3 breakdown: what's on the critical path between result and resolve? Kill/reap must be OFF the critical path (resolve on validated done first).

## 05 scale R2 — G6 kit built; refill + ceiling FIXED
+ Refill with real r2 guest: 2,400/2,400; c4 232/s, c8 247/s, c12 229/s → knee 4–8 concurrent builders on 12-core Mac. CPU 12.9 ms/VM (c4). (R1's 47/s was sequential+contended — 5× understated.)
+ macOS ceiling = kern.hv.max_address_spaces=128 (system-wide HVF; 117 available because others hold some e.g. Docker). Not a jitk limit; dev-only concern.
+ Linux kit: one-command run.sh, builds pinned libkrun + Linux host + 02 kernel, boot n=1000, concurrency sweep, density 1..2048, PSS/memory.current, CPU-ms; dry-run tested in arm64 Ubuntu Docker (non-KVM parts PASS).
+ Spot: c7g.metal us-west-2 $0.35/h, us-east-1 $1.02/h → full run 20–40 min ≈ $0.15–0.70.
+ Capacity: Mac ~78 exec/s (address-space bound); Linux 1,834/s conditional ceiling (CPU-bound with Mac CPU-ms transferred) — UNVERIFIED until kit runs.
! 12.9 CPU-ms/VM > 10's kill criterion of 5 CPU-ms/invocation. Mostly process spawn+dyld+builder (macOS). Must measure on Linux before applying the kill criterion; flag.

## 06 perf R2 — real phase table (load 35–118, distributions only)
+ Guest boot is NOT the problem: first vCPU run→kernel 8 µs; kernel→MMU 64 µs; MMU→EL0 ~1 ms (console/GIC/mapping); EL0→first syscall 2 µs; qjs first stmt ~0.3–0.8 ms; →READY 0.2 ms. Guest total ≈ 2 ms.
+ NEW BOTTLENECK: **sandbox application ≈ 10 ms p50** (Seatbelt profile compile/apply in main→build) — bigger than exec. Hidden by parking/prespawn, but it's refill CPU. → R3 for security owner: precompile profile / cheaper confinement.
+ Exec controls: plain C posix_spawn→main 1.6 ms min; +Hypervisor.framework +1.3; +libkrun dylib ~+0.8; static VMM 3.4 ms min. Static vs dynamic not robustly different under load. R1 "9.4 ms dyld" REJECTED as contention artifact.
+ First exec after re-sign: ~280–330 ms even for trivial C (AMFI/policy). Deployment: pre-exec once.
+ Parked A submit→1-tool result: 2.7 ms p50 (exact) / 1.3 (instrumented) at load ~45; wake+RX delivery 0.17 ms p50. Warm budget p90≤1.5 ms NOT met under load.
+ Clock domain: guest CNTVCT = host mach_absolute_time (offset 0) → cross-clock ±2.5 µs. Nice.
! All cold numbers ≥27 ms here are contention. Quiet re-run by lead.

## 07 security (Claude, R1-equivalent, delivered after R2)
+ GAME CHANGER: nested KVM on this M4 Mac — QEMU -accel hvf -M virt,virtualization=on → Debian 6.12 guest has /dev/kvm; stock libkrun boots inside. Linux functional/security tests local; only Linux perf needs metal. (Contradicts 05's "Docker has no KVM ⇒ need metal" for functional work.)
+ macOS: 4-rule precompiled Seatbelt profile applied in-process before build(): +0.063 ms (vs 5.4 ms compile-per-VM, 7.6 ms sandbox-exec). → SOLVES 06's "sandbox ≈10 ms" bottleneck. Caveat: private libsandbox API for precompiled form; supervisor compiles once at startup.
+ libkrun audit: ~30 guest-reachable panic/hang sites, all DoS-self, 1 unbounded host memory growth (macOS), 1 UB. Patch +130/−79; 5/5 fault guests abort stock → clean exit patched. panic=abort alone insufficient (stock built with unwind; 30 sites).
+ Linux: per-thread seccomp (KVM_RUN only ioctl post-boot; clone3→ENOSYS trick), Landlock ABI 6, 10/10 forbidden syscalls SIGSYS. Per-VM setup 0.12–0.45 ms. TRAP: cgroup.procs write = 36–50 ms! Use CLONE_INTO_CGROUP (≈0) or favordynmods.
+ Policy.mjs 90 lines, 22 asserts; per-call minted creds; taint: private-read → exfil-capable needs approval; disagrees with 04's whole-run taint (too coarse → approval fatigue). Accept 07's rule.
+ EL0/EL1 keep. CVE corrections: CVE-2026-1144 is quickjs-ng (not bellard); ITScape needs ITS (libkrun creates none) + multi-vCPU → not reachable.
+ Linux "sandbox before build()" impossible w/o patch; instead: supervisor sends code only after sandbox-ack AND READY. Accept.
