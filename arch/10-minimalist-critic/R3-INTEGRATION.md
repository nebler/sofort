# R3 integration — live report (area 10)

Started 2026-10-24 01:03 UTC. Owns only `jitk/docs/`, its top-level Makefile and
README, and this area. Poll budget is 150 minutes per direct task instruction;
R3-COMMON's shorter 120-minute default is superseded. Poll cadence ~10 minutes.

## Current owner actions (final02:42 UTC; history below)

| Owner | Current integration blocker / action |
|---|---|
| **02** | Source-stable H1 still fails **FileNotFoundError `/private/tmp/jitk-10/08-grow-loop/r2/ioctl.S`**. A concrete [portable-fixture patch](r3/kernel-fixture-portability.patch) supplies both tiny fixtures under kernel/tests and a temp override; apply relative to kernel/. Only reviewer's disposable copy was patched for supplemental diagnosis. |
| **04** | Compiled selector assumes checkout basename `jitk`; clean copy actually selects R2 ([proof](r3/selector-clean.json), no VM started). Honor actual root + `JITK_VMM_BINARY`. Also recertify after VMM rebuild: executor certificate expects `73df1ad3…`, v2 binary is now `276463d0…` (the earlier audit saw `17c0516a…`) ([29-input audit](r3/certificate-audit-0138.json)). |
| **04/07** | Per-execution deadline bound FAIL: 29/29 admitted 200ms blocking callbacks exceed configured 30ms timeout by >50ms; no late success, all reaped. [Raw receipt](r3/h5-resource-probe.json). Signal-only cancellation also leaves a noncooperative tool outstanding ([policy receipt](r3/policy-timeout-canonical.json)). |
| **05** | Linux test delegation FIXED by10: use the README's full nested suite for `make test` and `make linux-nested`. CPU/PID/netns boundaries remain unverified in current suite. |
| **08** | Saved-receipt verifier's no-op-patch case still depends on original absolute `/tmp/jitk-08/.../repository`; make it portable in a standalone copied tree. |
| **01/07** | Empty VMM marker is NOT a blocker: current selector supports the conventional external `/tmp/jitk-01/r3/darwin/jitk-vmm` path. Earlier suspected metadata block is withdrawn after successful H2. Keep underlying HVF code visible and freeze exact artifact hashes for final H4/H5; marker existence alone does not bind provenance. |

Top-level dependency preparation and output isolation are fixed by 10. Current
H1 **build passes**, test does not. Do not substitute old/fallback success for
the exact standalone-copy failure above.

## Owner entrypoints / immediate coordination

**01/02/05/07 HIGH PRIORITY, 01:34:** minimal signed C HVF probe reproduced
**`HV_NO_RESOURCES (0xfae94005)` on a non-null VM config**, both
default IPA36 and max IPA40; all config query/set calls return0.
The earlier NULL-config empty probes succeeded. **At 01:34:42 a new bracketed
NULL/default-config/NULL control all succeeds: transient failure, not a proven
config-specific bug.** This follows libkrun's
`hv_vm_config_create → set_ipa_size → hv_vm_create(config)` path and likely
explains generic `VmCreate` (inference; exact resource origin still unknown).
[Source](r3/hvf-probe.c), [config receipt](r3/hvf-config.json),
[bracket control](r3/hvf-bracket.json). Please preserve the underlying HVF code
in diagnostics; do not call it a kernel ABI regression or infer the occupied
resource's owner. No other process was touched, no guest/vCPU/RAM was allocated.

**01 HEADS-UP, 01:14:** VMM Makefile appeared during integration and overrides
`JITK_VMM_BUILD` with its `BUILD_DIR` default. The clean-copy run therefore
rebuilt `/tmp/jitk-01/r3/darwin/jitk-vmm` from its pre-sandbox-ready snapshot
(`sandbox_ready:false`, SHA `9da61bc3…`, fail-closed). **Please rebuild canonical
VMM after 07's marker before using that binary.** Integrator wrapper now forwards
explicit Make `BUILD_DIR/JITK_VMM/IMAGES/PROFILE` variables when an isolated
`JITK_VMM_BUILD` override is supplied, preventing another cross-owner output write.

Top-level Makefile is present. Preferred delegation is your subtree Makefile;
otherwise a same-named `.sh` script. Required actions:

| Owner | Actions consumed by integrator |
|---|---|
| 02 kernel | build, test |
| 01 VMM (including 07 sandbox) | build, test |
| 03 protocol | test |
| 04 executor (including 07 policy) | build, test, demo |
| 08 grow | test, grow (fresh transaction), demo (receipt playback + live Lua) |
| 06 bench (including 09 baseline) | test, bench |
| 05 Linux | test / nested (full owner H3 suite) |

Existing documented scripts will be delegated directly if names differ; please
document the exact commands in README. No other owner's implementation is edited.
Tests must terminate/reap all children and fail explicitly when prerequisites
are missing. The clean copy is `/tmp/jitk-10/clean` (no sibling area dirs).

## Polls and exact failures

- Initial scan: no `.READY` markers; only partial executor/VMM/kernel/baseline
  sources. No R3 gate claimed. R2 artifacts will not substitute for integrated H1.
- 01:05 UTC: first copy overlapped owner writes: `cp: arch/jitk/bench/smoke.tmp:
  No such file or directory`, copy exit **1**. A mistakenly early make also
  failed on `clean/docs/delegate.py` not copied yet; [h1-initial.log](r3/h1-initial.log).
  **INVALID H1 attempt**; corrected runner waits for a successful complete
  copy before running make, and records copy exit independently. Earlier
  in-place probe failed on missing `kernel/README.md` (not a clean H1 result).
- 01:05 UTC: `bench/.READY` appears. Marker explicitly covers harness tests,
  with integrated selection and n>=30 canonical suite still pending.
- 01:07 UTC: completed successful copy, then H1 **FAIL**, make exit **2**.
  Kernel builds from the clean source (image `a0854791…`, 2,924,544 bytes).
  Exact first failure: `jitk: no build entrypoint in vmm; see
  /private/tmp/jitk-10/clean/vmm/README.md; expected Makefile target 'build' or
  build.sh`. [Log](r3/h1-bench-ready.log), [receipt incl loads](r3/h1-bench-ready.json).
  **Integrator FIXED:** delegate VMM build to documented `python3 build.py`,
  executor actions to `run.sh ACTION`, and bench to `run.py --test/--samples 30`.
  VMM still needs a documented aggregate test entrypoint that prepares profiles
  and calls its existing tests; no profile setup is reimplemented at top level.
- 01:09 UTC observed (next full poll due ~01:15): protocol and Hyperlight
  baseline markers now present. Protocol marker is host corpus/build only, not
  real-VM G2/H5. No promotion from marker alone. Second H1 run is cloning the
  pinned VMM dependency; it remains in progress, not failed.
- 01:12:52 UTC: [second H1 receipt](r3/h1-entrypoints-fixed.json),
  [exact log](r3/h1-entrypoints-fixed.log), make exit **2**. Dependency compiled,
  then `cp: target/release/libkrun.dylib: No such file or directory`.
  **Integrator error, FIXED:** global `CARGO_TARGET_DIR` isolation override
  redirected libkrun away from 01's expected internal target path. It is now
  scoped to kernel delegation only via `JITK_KERNEL_CARGO_TARGET_DIR`; VMM
  isolation uses documented `JITK_VMM_BUILD`. This is not an owner build defect.
  Next snapshot also supplies `JITK_VMM_BINARY` to kernel's new host adapter.
- 01:14 UTC: protocol owner completion verified against
  [03 R3](../03-channel-protocol/R3.md), `protocol/test-results.json`,
  `vm-results.json`, `hostile/results.json`: 142 corpus +25k mutations,
  300/300 guest +570/570 hostile fresh real VMs (n30/case). Kernel
  `4a40ab97…`, 02 R2 native host `b9e470a0…`; **protocol subset PASS**, broader
  canonical-confinement H5 still UNMEASURED. Native `protocol/Makefile` now
  handles build/test/import audit; top-level delegates it automatically.
- 01:14 UTC H1 [poll-01 receipt](r3/h1-poll-01.json),
  [exact log](r3/h1-poll-01.log): **FAIL**, exit 2. Kernel + VMM + canonical
  protocol build passed, then executor build fails exactly:
  `Error: Cannot find module '/private/tmp/jitk-10/clean/executor/node_modules/typescript/bin/tsc'`
  (`MODULE_NOT_FOUND`). Confirms dangling dependency symlink finding. Tests
  have not run; VMM snapshot was explicitly `sandbox_ready:false`.
  Also fixed isolation forwarding after VMM Makefile appeared (notice above).
- 01:14 UTC: `kernel/.READY` observed. Next regular marker scan ~01:24 UTC;
  will rerun H1 after the next marker scan or a concrete owner fix.
- 01:16 UTC independent checks in the already-copied tree: packer **5/5**
  [log](r3/packer-clean.log); protocol native build/test/import audit **PASS**
  [log](r3/protocol-clean.log); bench gate/statistics/external-watchdog checks
  **PASS** [log](r3/bench-harness-clean.log). No canonical VMM/SDK/hostile replay
  implied. Installing locked deps in this disposable copy only as a diagnostic
  can reveal later failures, but does not erase literal H1's dependency failure.
- 01:17 UTC dependency diagnostic: npm ci in the old copy first failed
  ERESOLVE (codemode's optional TanStack peer excludes installed 1.0). The
  owner's newly added `.npmrc` explicitly sets `legacy-peer-deps=true` with
  rationale. Copying that one config into the disposable diagnostic tree and
  rerunning **`npm ci --ignore-scripts` succeeds, 49 packages**; logs:
  [before](r3/npm-ci-diagnostic.log), [after](r3/npm-ci-with-config-diagnostic.log).
  No package files/global install/other area dependency cache were modified.
  Still requires documented automatic dependency preparation for literal H1,
  or an explicitly accepted prerequisite distinction in the final verdict.
- 01:18 UTC prepared-copy diagnostic executor build **PASS**
  ([log](r3/executor-prepared-build.log)); executor test reaches pool checks,
  then **FAIL** before VMs:
  `ERR_MODULE_NOT_FOUND: Cannot find module
  '/private/tmp/jitk-10/07-security-sandbox/policy.mjs' imported from
  /private/tmp/jitk-10/clean/executor/build/resolve-check.js`
  ([log](r3/executor-prepared-test.log)). Expected until 07 canonical policy
  exists; this confirms the fallback cannot support a standalone integrated tree.
- 01:22 UTC integrator **FIXED:** public top-level demo/bench preflight canonical
  input markers and fail with exact missing paths, instead of silently allowing
  owner scripts' R2 fallbacks to earn H2/H4. Build/test remain callable before
  markers; Linux nested requires kernel/sandbox source readiness and then builds
  its Linux VMM. Owner direct development commands remain available as documented.
- 01:24 UTC [poll-02](r3/poll-02.json): new VMM, sandbox and grow markers.
  Kernel/protocol/bench/baseline remain present; executor/Linux still missing.
  H1 copy/build/test run started with isolated Make output variables.
  VMM marker certifies macOS 12 CLI +180 fault runs, binary `73df1ad3…`;
  explicitly says Linux nested production verification pending.
- 01:24 UTC canonical policy timeout replay **confirms the limitation** on
  `executor/policy/policy.mjs` SHA `ca082e55…`: 5ms timeout, after 101.86ms
  abort is true, settled/revoked false, outstanding1. No credentials or VMs are
  used. [Canonical receipt](r3/policy-timeout-canonical.json). Restrict the
  security claim to cooperative cancellation/credential TTL until addressed.
- 01:24 UTC grow canonical-kernel component **PASS**: `canonical-r3/report.json`
  records 3×30 full probe matches, 30 Lua matches, +6 signal-profile LOC,
  90.872s transaction preparation (n1). Selected launcher remains native
  `host-no-tick`, SHA `c7515837…`; not canonical sandbox VMM. Owner explicitly
  scopes it as functional growth only. The new repeat path supports already
  applied signal profiles by removing them only in its disposable copy.
- 01:29 UTC integrator **FIXED H1 dependency orchestration:** top-level build
  now invokes the exact executor README prerequisite `npm ci --ignore-scripts`
  under the verified absolute Node, using a local cache. A copied dangling
  node_modules link is removed before install; valid development links are
  retained and never written through. No owner implementation was changed.
  This removes the manual-preparation gap in the next literal H1 snapshot.
- 01:31 UTC H1 [poll-02 receipt](r3/h1-poll-02.json),
  [full log](r3/h1-poll-02.log): **build PASS**, kernel image `a7c39ab5…`
  (signal-profile source is now included), sandbox-ready VMM `b850f72c…`,
  protocol and executor builds all succeed. Packer5/5 + handler semantics pass.
  **test FAIL** at first real kernel check: VMM exits70 after sandbox ack with
  `jitk-vmm: boot error: Internal(Vm(VmSetup(VmCreate)))`; no guest stdout.
  Owner08 reports the same new pre-guest failure on its native functional host;
  no root cause is assigned from the generic error.
- 01:32 UTC three fresh, unconfined **empty HVF** probes all create/destroy
  successfully (`HV_SUCCESS`, 0x0); no vCPU/RAM/guest. Configured cap remains128.
  [C source](r3/hvf-probe.c), [receipt](r3/hvf-create.json), load39.04/59.07/67.37.
  This does not establish that the full VMM config/sandbox works or exclude an
  earlier transient resource limit. It rules out a persistent inability to
  create *any* VM at probe time. All probe processes joined and VMs destroyed.
- 01:33 UTC same new image through 02 native host and canonical sandbox-ready
  VMM both fail before guest stdout with identical VmCreate class;
  [bounded one-pair receipt](r3/boot-pair-diagnostic.json). Canonical emitted
  sandbox ack. No submitted JS, tool call or credentials; both children reaped.
- 01:34 UTC configured HVF result above captures **HV_NO_RESOURCES** while a
  later bracket recovers. Persistent parameter-specific failure is NOT claimed;
  allocator/config semantics and
  which host resources remain occupied are UNVERIFIED. No retry flood or
  workaround modifying libkrun/kernel/sandbox was attempted by this reviewer.
- 01:35 UTC bounded retry in the same poll-02 copy after HVF recovery:
  build passes; kernel recycling/clock/isolation run, including9/9 probes.
  Exact next **H1 FAIL**, exit2:
  `FileNotFoundError: /private/tmp/jitk-10/08-grow-loop/r2/ioctl.S` in
  `kernel/tests/grow_contract.py`. [Retry log](r3/h1-poll-02-retry.log).
  This confirms the previously reported sibling-input dependency.
- 01:35 [poll-03 marker snapshot](r3/poll-03.json): executor and policy now
  ready. Executor certifies canonical VMM `73df1ad3…` + kernel `a7c39ab5…`,
  n50 E4 diagnostics; VMM marker is temporarily absent during owner work.
- 01:36 zero-VM standalone selector probe confirms **transitional VMM01R2 /
  kernel02R2**, `integrated:false`, despite real canonical markers in the clean
  tree. [Exact output](r3/selector-clean.json). This is a concrete relocation bug.
- 01:38 exact 29-input executor certificate audit finds one mismatch: VMM binary
  expected `73df1ad3…`, actual `17c0516a…`; source inputs and image match.
  [Audit](r3/certificate-audit-0138.json). Frozen original
  [certificate](r3/executor-certificate-0128.json) and
  [n50 phase receipt](r3/executor-breakdown-0128.json) preserve the valid earlier
  observation. Do not transfer compatibility/lifecycle certification to the new
  binary until rerun. Current VMM marker is correctly withheld during rebuild.
- 01:40 UTC Linux owner receipt is now **PASS (NESTED)** in
  `linux/out/report.json` + `report.md`: boot100/100, one-tool30/30,
  seccomp720/720, fault180/180, 256 parked guests, zero children. Linux VMM
  `a171694c…` is sandbox-ready; kernel `a7c39ab5…`. **H3 owner evidence PASS**,
  independent top-level `linux-nested` replay pending. `bad-sysreg` uses30
  bounded watchdog kills; report this rather than implying30 clean fault exits.
  Earlier SMP4 nested soft lockup is retained; current outer test uses SMP1.
  Nested durations/CPU/PSS are functional diagnostics, not Linux performance.
- 01:40 UTC canonical H4 table exists but full run just started (config n30,
  all observed rows gate-timeout at this point). The preceding rendered table
  has n1/row from validation, **not H4 PASS**. Read final raw.json completion,
  source hashes and counts before making claims; current frozen VMM `73df1ad3…`
  matches executor's earlier certificate, not the new rebuilt `17c0516a…`.
- 01:43 UTC independent delegated canonical policy tests **PASS**, 22 normal
  assertions +32 hostile cases ([log](r3/policy-unit-independent.log)). No real
  tool/provider/credentials or guest; finite rule coverage, not full H5.
  Top-level test now also invokes exact documented sandbox-unit, policy and
  baseline-adapter suites instead of relying only on parent-subtree smokes.
- 01:46 UTC integrator **FIXED Linux test mapping:** the owner README defines
  the full `run.sh --nested` functional suite, not a lightweight standalone unit
  target. Both top-level `make test` and `make linux-nested` now delegate that
  exact existing command. No owner05 action/new tests are required for this.
  H1 runner sets `JITK_WORK=/tmp/jitk-10/linux` to isolate its kit outputs.
- 01:52 UTC [poll-04 H1 receipt](r3/h1-poll-04.json),
  [log](r3/h1-poll-04.log): **copy_source_stable=true**, automatic local npm49
  install succeeds, all builds pass (kernel `a7c39ab5…`, VMM `49d937f0…`,
  robustness patch `3c6daab2…`). Recycling,30 clocks/timers, atomic ASCII5 and
  isolation9 pass; same missing R2 ioctl fixture stops H1 (exit2).
- 01:54 UTC concrete proposed kernel fixture patch is reviewable above; exact
  R2 assembly fixture contents are copied unchanged, no syscall implementation
  changes. The ioctl fixture is NOT currently in integrated grow/ (earlier
  suggestion to use ../grow for both was too broad); kernel-owned test fixtures
  keep this suite standalone. `git apply --check` succeeds in copied kernel.
  Applied only to `/tmp/jitk-10/clean` for **supplemental** deeper diagnostics;
  subsequent patched-copy results do not erase official unmodified H1 FAIL.
- 01:57 UTC supplemental copied-kernel portability fix **PASS**: four grow
  contract cases (ioctl,ppoll,registered ENOSYS,deleted ioctl) complete on the
  sandbox-ready copied VMM; [log](r3/kernel-fixture-diagnostic.log). Temp output
  override keeps this diagnostic under `/tmp/jitk-10`. Patch is then fully
  reversed before reusing the snapshot for any other official target.
- 01:57 [poll-05](r3/poll-05.json): all subtree markers now exist; new VMM marker
  is empty, not the earlier artifact JSON. Fresh untouched H1 poll-05 started.
  A separate unmodified runtime copy is moved to `/tmp/jitk-10/h2-01/jitk`
  (so the known basename bug does not mask a different failure), with only the
  current VMM coordination marker refreshed from the producer. Exact preparation
  is recorded in [h2-preparation.json](r3/h2-preparation.json).
- 02:01 UTC **H2 PASS**, `make demo` exit0 from the unmodified runtime copy:
  [command log](r3/h2-01.log), [summary + receipt hashes](r3/h2-01.json).
  Executor returns total2 with2 concurrent tools; canonical sandbox VMM
  `276463d0…`, kernel `a7c39ab5…`. Fresh grow transaction passes90 probe traces
  and30 Lua runs, then labeled demo boots fresh qjs (`reply:ping`) and Lua
  (`{"count":5,"sum":23,"max":9}`), all VMs reaped. Development grow/demo
  launcher remains native `c7515837…`; no H5 confinement claim follows.
  The test-only fixture patch was reversed before H2; no runtime implementation
  was edited. The `jitk` basename avoids, rather than fixes, H1's relocation bug.
- **Correction to suspected marker finding:** H2 actually succeeds with the
  empty VMM marker because `markerArtifact` now accepts absolute conventional
  output paths, including `/tmp/jitk-01/r3/${process.platform}/jitk-vmm`.
  The empty-marker handoff is therefore NOT an observed blocker; the earlier
  assertion was too strong. Frozen H2 selection records the actual host hash.

## Red-team findings

- **OPEN / all owners:** clean-copy portability forbids dependencies on sibling
  `arch/NN-*`, cached `/tmp/jitk-NN` artifacts or absolute source paths. External
  prerequisites must be documented and reproducibly acquired by owner scripts.
- **OPEN / 03+04+09+02:** R2 had copied protocol dispatchers and adapted bootstraps.
  E1 requires a single canonical protocol source, imported/transformed at build
  time. Independent copies can retain incompatible DEL/UTF-8 fixes.
  **01:09 FIXED in active build path:** executor/Hyperlight import canonical
  dispatcher; kernel build reads canonical bootstrap. Top-level build now
  explicitly rebuilds protocol JS before executor. `kernel/bootstrap.js` is an
  unused stale source to remove; generated bundles are not competing sources.
- **OPEN / 01+04+05+07:** use the lead-maintained `jitk/CONTRACTS.md` JSON stderr
  sandbox ack, not PROPOSAL's older `S\n`; RUN requires ack AND guest READY.
- **OPEN / 06:** one canonical H4 table must identify exact image/VMM hashes,
  boundary, mode, sample counts, per-sample load and exclusions. R2 tables are
  historical evidence only; nested KVM timing is never production performance.
- **OPEN / 07+01+04:** H5 must cover the integrated production launcher and
  watchdog, not only isolated old launchers or mock peers. Keep panic=abort,
  one console port and independent process deadline enforcement.
- **OPEN / 04:** `executor/policy-adapter.ts` currently resolves
  `../policy/policy.mjs` (outside executor) instead of owned
  `executor/policy/policy.mjs`; fallback reads sibling area07, unavailable in
  H1 clean copy. Please fix canonical URL and remove fallback before `.READY`.
  **Correction:** canonical URL `../policy/policy.mjs` is correct in the
  bundled `executor/build/*.js` runtime (not raw source). That part of the
  initial static-path finding is withdrawn. The fallback remains transitional
  and must not substitute for canonical policy in final integration evidence.
  A second concrete portability blocker: executor `node_modules` is a symlink
  to `../../04-executor-ts/node_modules`; `cp -R` preserves it, leaving a dangling
  symlink under `/tmp/jitk-10/clean`. Document/install locked deps in copied
  subtree (`npm ci` with a verified Node); H1 must not use another area checkout.
- **OPEN / 04+06, relocation:** `executor/select-backend.ts` constructs
  `arch = new URL('../../../', import.meta.url)` then `arch+'jitk/'`. In the
  requested clean path, compiled `clean/executor/build/*.js` therefore selects
  `/tmp/jitk-10/jitk/`, NOT `/tmp/jitk-10/clean/`. `bench/run.py` similarly
  constructs `ARCH/'jitk/...'`. Use a relative integrated root independent of
  checkout basename, or explicit injected artifact paths; never silently fall
  back to R2 when clean-copy markers are present at the actual root.
  Copied `.READY` may also point to an original external VMM binary. Clean-copy
  tests must select the VMM just built from that copy (e.g. honor
  `JITK_VMM_BINARY`), not a marker's stale external artifact. Kernel test
  adapter already supports that override. Bind and record actual runtime hashes.
- **OPEN / 08:** `grow/runtime.py` currently falls back to
  `/tmp/jitk-02/r2/host`; production H2 must select integrated VMM + sandbox.
  It also invokes `host image` unconditionally, but 01 requires `--image IMAGE`
  and a compiled profile. Its expected `vmm/artifact.json` does not match 01's
  `build.json` in external output dir. Use marker artifact contract, exact CLI,
  profile plus host-only ack. A source marker must not silently choose R2.
  **01:12 follow-up:** current `select_host(canonical)` explicitly chooses R2
  host even when canonical=True. Thus canonical kernel evidence is not full
  integrated runtime evidence. Top-level H2 now uses owner `grow` then `demo`
  targets so actual regrowth always precedes labeled replay/live Lua.
- **OPEN / 09:** Hyperlight Cargo path dependencies and entitlement still name
  `/tmp/jitk-09/hyperlight-js` and `/tmp/jitk-spike`; README must state/fetch
  exact pinned prerequisites. Baseline bench must not silently select R2 jitk.
- **OPEN / 06+09:** bench README expects `adapter.json` strict/clone argv, while
  baseline README offers Python `Suite.sample`; freeze one interface together.
  **01:07 follow-up:** `bench/hyperlight/adapter.json` now exists (interface
  mismatch FIXED); descriptor embeds absolute original checkout source paths,
  so clean-copy provenance must still be verified.
- **OPEN / 05+07:** `linux/build-linux.sh` currently compiles `linux/main.rs`
  and `linux/security/confine.rs`, not canonical `vmm/src/main.rs` and
  `vmm/sandbox/mod.rs`. This repeats the launcher, role policy and plain `S`
  ack. Passing that spike cannot pass E7/H3 for the integrated runtime. Consume
  canonical launcher/sandbox; keep fault injection in a separate probe binary.
  **01:12 source FIXED:** copied launcher/confine sources removed; build script
  now delegates canonical `../vmm/build.py`, probe BPF comes from canonical
  sandbox module. Nested functional evidence pending. Still need `linux/test`
  entrypoint; `linux-nested` will delegate documented `run.sh --nested` so its
  build/base/kernel prerequisites are prepared, rather than calling bare
  `nested.sh` on absent artifacts.
- **OPEN / 04+07:** tool return/SDK values are allocated and serialized before
  wire admission; frame caps do not bound trusted SDK allocation. Policy must
  document tool-result bounds and ignored AbortSignal behavior; a pending
  invocation/credential must not accumulate across runs after VM capacity is
  released. This is a host-resource audit requirement, not a demonstrated bypass.
  Read-only [probe](r3/policy-timeout-probe.mjs),
  [receipt](r3/policy-timeout-probe.json) against historical 07 rules: a tool
  ignoring AbortSignal remains unsettled/outstanding with credential unreclaimed
  after a 5ms timeout and 100ms wait. Signal fires, but `finally` never runs.
  Canonical policy was absent at this probe; replay when integrated. Claim only
  cooperative cancellation/credential TTL unless the host boundary is bounded.
- **OPEN / 05+07, resource boundaries:** `linux/suite.py` configures per-VM
  `memory.max` and `memory.swap.max`, but not `pids.max` or `cpu.max` at 01:19.
  One vCPU is not a host-thread/pid bound after VMM compromise; 07's proposed
  limits were pids16/one-core. Do not claim those limits were tested. The
  canonical VMM supports optional `--netns-fd`, but this suite never supplies
  one; E3 names netns whereas 07's proposal calls it optional. Record the actual
  mode and reconcile the requirement; no tested empty-netns claim yet.
  Functional harness `errors`/`frames` accumulation is not production dispatcher
  resource evidence. Test cumulative floods on canonical executor for H5.
- **OPEN / 01 nested harness:** at 01:19 the canonical VMM nested log contains
  `TimeoutExpired: /work/jitk-vmm --image /work/images/parking.bin --wait-go`
  after 30s, `CHECK-EXIT 1`; independent seccomp socket probe exits -31.
  This is an in-progress CLI harness failure, not an H3 pass or a demonstrated
  confinement bypass; full boot/tool/fault coverage still needs its receipt.
- **OPEN / 02, concrete H1 blocker:** kernel tests still depend on R2 CLI and
  sibling area write locations. `tests/measure.py` and `grow_contract.py` use
  `JITK_TEST_HOST` default `/tmp/jitk-02/r2/host` with positional IMAGE;
  `tests/run-probes.py` writes to `p.parents[1]/02-guest-kernel/r3`, absent in
  the clean snapshot, and hardcodes `/tmp/jitk-02/r3` outputs. These must use
  copied-tree evidence dirs, isolated temp override and canonical `--image`
  CLI/profile/ack. Otherwise H1 cannot establish integrated test coverage.
  **01:27 additional exact input:** `kernel/tests/grow_contract.py` reads
  `root.parents[1]/'08-grow-loop/r2'/{ioctl,ppoll}.S`; those files do not exist
  in the requested standalone clean copy. Canonical fixtures already exist in
  `../grow/`. Test output directories outside the clean tree but inside
  `/tmp/jitk-10` are acceptable; required sibling-area INPUTS are the blocker.
- **OPEN / 08, receipt portability:** `grow/test.py::test_already_applied_patch_is_noop`
  reads the absolute `report['repository']` and its sibling `apply-check`, from
  the original `/tmp/jitk-08/r3/runs/canonical-r3` transaction. H1 can accidentally
  pass only because those temp artifacts still exist on this shared machine.
  Reconstruct the input state from included receipts/patches into a disposable
  copied-tree temp, or verify a portable saved artifact without external temp
  repository dependency. The other saved-trace verification cases are portable.
- **OPEN / size:** 01:09 owned source snapshot totals **9354 physical LOC**,
  including tests/build/config; exclusions and file hashes in
  [loc-current.json](r3/loc-current.json). Above R2 5750 planning cap, partly
  because of copied fallback kernels and Linux launchers. Never repeat “1.5k
  product LOC.” [Source duplicate/path/patch audit](r3/source-audit-initial.json)
  counts copies rather than deduplicating them away. Counts are provisional.

## Gate snapshot

Current: H1 FAIL (build PASS); H2 PASS functional; H3 PASS owner nested evidence; H4 complete E6 contended table,0/2460 quiet gates; H5 named-class macOS coverage PASS, broader exposure blocked by deadline failure. See latest entries and final R3.md.


## 02:22 UTC — v2 hostile replay and resource/deadline findings

- Reused owner03's unmodified hostile suite on frozen production VMM
  `276463d01ac6956a095814ed77053989d21bb52a7ef702f5c2698eb98daba20e`
  + kernel `a7c39ab5679e75d3242f6f318cd5367ff866380e8f509085e974a49f1b6a6364`:
  **570/570 PASS,19×30**, no fixture tool effects and children0.
  [Wrapper receipt](r3/h5-protocol-replay.json),
  [exact per-case results](r3/h5-protocol-v2-results.json),
  [log](r3/h5-protocol-replay.log). Load1 57.96→84.80; functional only.
- Same frozen pair and reviewed SDK: **memory30/30, stack30/30,
  runaway CPU30/30 handled**; each stress followed by a fresh return2 recovery
  control, all90 pass. Memory raises guest out-of-memory; stack terminates guest;
  CPU times out. Pool tokens/live/creating all0 after close.
  [Resource receipt](r3/h5-resource-probe.json),
  [CPU receipt](r3/h5-cpu-probe.json), [probe source](r3/h5-resource-probe.mjs).
  Diagnostic elapsed median/p90/p99 ms: memory14.652/46.904/66.380,
  stack4.559/34.067/36.552, CPU61.771/116.107/153.781. These are loaded
  stress/recovery measurements, never canonical H4 latency or an SLO.
- **FAIL exposure criterion /04+07:** `RunOptions.timeout=30ms` with a permitted
  credential-free callback blocking its own Node event loop200ms.29/30 requests
  entered the callback; **29/29 admitted callbacks overshot by >50ms**.
  API elapsed median221.824,p90235.307,p99264.945ms; late successes0;
  all30 recovery controls pass; final pool0. The external watchdog caps fixed
  VM lifetime (5000ms here), but does not enforce the short execution deadline
  while Node is blocked. Even CPU-only30ms requests overshot50ms in10/30
  under load41.66–49.09. No credential TTL bypass is demonstrated.
- Owner07's [v2 H5 table](../07-security-sandbox/R3.md) supplies canonical
  hvc/smc/MMIO and console/device cases on macOS and nested KVM. Together with
  this replay and the memory/CPU tests, every H5 *named attack class* has a
  passing finite macOS observation. This is not an escape proof or release
  approval: deadline criterion FAIL; Linux escape and host-EOF-mid-call remain
  UNVERIFIED. Their console mode7 tests EOF followed by idle, a narrower case.
- Latest08 lifecycle fix and11 verifier checks retained; original successful
  canonical-r3 receipts remain selected. Additional replay VmCreate failures
  are not overwritten or called ABI failures. Our successful H2 receipt is
  independent and remains valid for its exact recorded artifacts.


## 02:21 UTC — readiness/source/size refresh

[Poll07](r3/poll-07.json): all markers present, unchanged from poll06; no removed
markers. No runtime/build source recorded in the latest stable H1 snapshot has
changed, so repeating unchanged H1 would add load without resolving its exact
missing-input failure. Latest original H1 remains FAIL.
[Owned physical inventory](r3/loc-final.json): **10,658 lines**, including tests,
build and config, excluding vendor/generated/data/output. Component table in
[architecture](../jitk/docs/ARCHITECTURE.md). Hand-written `policy.d.ts` is counted;
older snapshots accidentally excluded declarations. Separate upstream patch
delta+174/−93; external native grow host31 owned lines. Copies count in full.
[Duplicate/path audit](r3/source-audit-final.json) finds watchdog and policy-test
copies, six duplicated fault fixtures, and grow fallback-kernel fragments.
Active protocol consumers import canonical source; dead kernel bootstrap and
fallback source remain maintenance risks, not active competing wire decoders.


## Final02:42 UTC — H4 complete; readiness review closed

- 06's one [canonical table](../jitk/bench/RESULTS.md) is complete at02:40:41 UTC.
  **2460/2460 validated,41 cases×60 observations,0/2460 gates pass**.
  [Read-only audit](r3/h4-audit.json): complete randomized blocks, all samples
  retain load/gate/uptime, frozen VMM/image hashes match. Load1 range14.40–145.55;
  start58.09/51.44/58.79,end38.53/62.02/68.42. Cached local macOS measurements
  only; child CPU excludes watchdog/supervisor, memory excludes HVF kernel
  allocations. Frozen VMM73df1ad3…/kernel a7c39ab5…; do not transfer to v2.
  H4 evidence-table coverage passes E6's interleaved/load-labeled fallback;
  **quiet-host credibility remains UNVERIFIED**, not converted by extra samples.
- [Final poll](r3/poll-final.json): all markers present and unchanged. Runtime
  and build files recorded in latest stable H1 are unchanged. No reason to
  repeat the identical failing H1; exact fixture-path failure and proposed
  correction remain available to02. Poll window01:03–02:42, within150min max.
- [Final LOC recheck](r3/loc-close.json) confirms10,658 owned physical lines;
  same file/hash inventory as02:21 snapshot. Copies remain counted. Final
  [R3 gate verdicts, risks and next3 steps](R3.md); [claims](../jitk/docs/CLAIMS.md)
  and [kill criteria](../jitk/docs/KILL-CRITERIA.md) updated to bounded evidence.
- H1 FAIL/build PASS; H2 PASS functional; H3 PASS owner nested evidence;
  H4 complete contended E6 table/quiet UNVERIFIED; H5 named macOS classes PASS,
  **exposure blocked by deadline criterion FAIL**. No disagreement with R1/R2.
