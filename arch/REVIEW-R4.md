# Round-4 review notes (lead)

## 02 kernel R4 — DONE (.R4)
+ Fixtures shipped in kernel/, /tmp + arch/NN refs removed, exit/exit_group share one handler. Arbitrary-path build+test PASS on VMM v2. G1 1000/1000, G2 30×64, isolation 9/9. Image a7c39ab5… (unchanged).

## 06 bench R4 — DONE (.R4)
+ Portable harness; paired v2 vs 73df1ad3 regression subset 480/480, n=60/build/case: latency CIs include zero (no regression); footprint slightly up. R3 headlines stand. No quiet pass possible (load 12–113).

## 04 executor R4 — DONE (.R4), F2 partially
+ Portability, per-run deadline forwarded to the single external watchdog (monotonic timer → SIGKILL VMM process group, independent of Node; EOF also kills), AbortSignal on this.signal, dedupe. v2 recert: 20/20, CF 2/2, 1,920 calls, 44 policy asserts, Hyperlight 6/6.
F2 probe (load 64–113):
  blocking 200 ms callback / 30 ms deadline: **VM killed ≤50 ms 29/30 (worst 143 ms)**; API return ≤50 ms 0/30 (median 214 ms).
  CPU loop / 30 ms: VM kill ≤50 ms 28/30 (worst 139 ms); API 28/30.
LEAD RULING: the criterion conflated two properties.
  (a) GUEST TERMINATION (the security property: untrusted code stops at deadline) — now enforced outside Node; 29/30 & 28/30 ≤50 ms at load 64–113, worst ~140 ms = host scheduler under extreme contention. ACCEPT with load caveat; re-test quiet/metal.
  (b) API RETURN while a host tool callback synchronously blocks the same Node thread — physically impossible to return early; not a containment issue. RESOLVE BY CONTRACT: host tool callbacks must be async/non-blocking; executor docs + optional v1 "tools in worker_threads" mode. Not an exposure blocker.

## 08 grow R4 — DONE (.R4)
+ Fallback kernel + duplicate proposals deleted; kernel/ is single source. Clean-copy 19/19 tests + demo pass.
+ HONESTY FIXED: --live mode really calls the headless CLI: 3 live agent calls → 90/90 differentials, 30/30 Lua. Demo labels replay vs live.

## 05 linux R4 — DONE (.R4)
+ Duplicate fixtures deleted (references vmm/tests/fixtures), fixed paths removed, renamed-copy build + full H3 nested PASS (1 outer vCPU). VMM b6361878 (rebuilt from vmm/ v2 series), kernel a7c39ab5.
! Linux VMM hash b6361878 ≠ 07's 4445e2cc for the same series → Linux build not bit-reproducible (or different flags). Note for release engineering.

## 09 bench/hyperlight R4 — DONE (.R4)
+ Machine paths removed (env vars), private watchdog deleted, uses canonical executor backend. Copied tree: 13 checks skip cleanly when unset; 13/13 pass when enabled.

## 10 final recert R4 + lead fix
- 10: I1/H1 FAIL only on a stale protocol import guard (bench/hyperlight now reuses executor's ProcessBackend → canonical dispatcher transitively). LOC 9,409 (−1,249), 15/15 dup groups resolved. Demo PASS (100 s). Path scan: 84 files incl. raw evidence JSON + docs; 13 owned-source files.
- LEAD FIX: protocol/import-check.mjs accepts hyperlight → executor backend reuse (1 line).
- LEAD RERUN: cp -R arch/jitk → /tmp/jitk-lead/i1/relocated-lead-17727; `make build test` with 10's recorded external inputs → **EXIT 0** (14 min, load 101→37). All subtree suites passed incl. 32/32 hostile policy, bench harness, hyperlight 13/13, grow 15+4, kernel. **H1 PASS** (with documented external inputs: libkrun source, Hyperlight sources/worker/snapshot, nested base, npm cli).
! Linux test step reports producer binary path /tmp/jitk-01/r3/linux/jitk-vmm in its manifest — provenance only, but a leftover path ref.
