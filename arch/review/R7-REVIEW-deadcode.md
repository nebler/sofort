- Reviewed 2026-10-26 at `bb95bf2c3960128a794a76355b6258daec4199e0`; architecture, current entry points, compiler diagnostics, and tracked-file inventory checked.
- Delete now: **173 whole files, 13,760 text lines, 28,798,478 bytes (27.46 MiB)**, plus edits in six retained files; only **155** of those lines are outside generated scratch/results.
- Delete after cutover: **9 whole files, 1,196 lines, 43,648 bytes**, plus edits in three retained files, **conditional** on retiring the still-callable assembly/QEMU experiments; these are not dead today.
- Preserve, then archive outside the active source tree: **7,145 files, 1,323,987 text lines, 211,710,821 bytes (201.90 MiB)** of evidence/frozen inputs; excluded from deletion totals.
- Keep Mac libkrun, the shared pool, R6 QuickJS ABI, live R7 IPC/native paths and regression fixtures; scratch builds/tests passed as detailed below, and no implementation changes are committed.

## Findings

Paths are relative to the repository root. Line references are to the reviewed commit. “Files” counts complete files removable, not files edited. Lines include comments/blanks; files containing NUL have zero text lines but their full byte size is included. Conditional retirement counts are gross removals before replacement dispatch/documentation edits. Archive rows mean **keep until a durable, hash-verified archive and working links/materialization exist**, not permission to discard evidence.

| ID | Path:line or path | What / dependency check | Evidence | Confidence | Action | Lines | Files / bytes |
|---|---|---|---|---|---|---:|---:|
| D01 | `arch/jitk/kernel/test-work/fs/` | Generated filesystem trees, probes and images, including duplicate `kernel.bin`/hash-named images. Fixtures live separately in `tests/fixtures/fs/`. | E1: `fs_diff.py:10,19–36,49–54` creates/replaces these before use; directory absent in scratch verification. | certain | delete now | 3,063 | 25 / 15,960,828 |
| D02 | `arch/jitk/kernel/test-work/grow-contract/` | Generated copied kernel, payload, probe objects and images. The copied handlers are an old test state, not canonical source. | E1: `tests/grow_contract.py:6–8` recopies canonical kernel; `build()` generates probes/images. `grow/runtime.py:3` excludes `test-work` from canonical copies. | certain | delete now | 8,205 | 109 / 9,103,413 |
| D03 | `arch/jitk/kernel/test-work/probes/` | Generated `.bin`, `.o`, `.elf` probes and probe kernel. Keep the generator and security cases. | E1: `tests/run-probes.py:5,17–27` creates every artifact before invocation. No checked-in artifact is needed as input. | certain | delete now | 0 | 34 / 3,658,076 |
| D04 | `arch/jitk/kernel/bootstrap.js` | Obsolete local bootstrap, superseded by `protocol/bootstrap.js`; not the ring bootstrap. | E2: `kernel/build.rs:19–25` reads the sibling protocol bootstrap; `protocol/import-check.mjs` enforces that choice. No executable reference to `kernel/bootstrap.js`. Default/ring builds passed without it. | certain | delete now | 123 | 1 / 5,515 |
| D05 | `arch/jitk/kernel/src/syscalls.rs:35` | Unused `park(Option<u64>)` wrapper and its suppression. `park_poll` stays. | E3: forced warning `function park is never used` at line 36 in both builds; no callers. | certain | delete now | 2 | 0 / 86 |
| D06 | `arch/jitk/kernel/src/arch/aarch64/wait.rs:6` | Unused ring-only `park(u64)` wrapper. Do **not** remove the default `src/wait.rs:73` function. | E3: ring warning at line 6; only `wait::park` caller is in default `console.rs:242`, which the ring build replaces. Ring callers use `park_for`. | certain | delete now | 3 | 0 / 78 |
| D07 | `arch/jitk/bench/run.py:146` | Old `.READY` artifact-discovery helper `marker_path`. `choose()` now resolves artifacts itself. | E4: one definition, zero callers in executable current sources; no string lookup. Hyperlight's imported controller uses `choose`, not this helper. Benchmark unit suite passed without it. | certain | delete now | 14 | 0 / 584 |
| D08 | `arch/jitk/docs/delegate.py:84` | Four obsolete owner-specific fallbacks after the generic Makefile/script dispatch. | E5: every named owner has a tracked Makefile, selected at line 72 first. Seven dispatcher command comparisons were identical after removing lines 84–95. Keep generic shell-script support and missing-entrypoint errors. | certain | delete now | 12 | 0 / 767 |
| D09 | `arch/jitk/executor/wrapper-conformance.ts:4`; `policy-check.ts:6` | Unused `dirname,join` import and unused `rules` import binding. Preserve the other policy imports/module evaluation. | E6: TypeScript TS6192 and TS6133 respectively; no references. Strict unused checks pass after cleanup. | certain | delete now | 1 full line + binding | 0 / 46 |
| D10 | `arch/jitk/executor/transitional-r2-breakdown-results.json` | Superseded transitional executor result. No current build/test/demo or documented evidence link reads it. | E7: zero name references in current executable sources or Markdown. Current writer/certifier uses `breakdown-results.json` instead (`breakdown.ts:37`, `certify.mjs:21`). | certain | delete now | 2,176 | 1 / 62,592 |
| D11 | `arch/jitk/executor/cloudflare-{binary,github}.generated.mjs` | Generated wrapper dumps, not fixture inputs. Keep `wrapper-conformance.ts`. | E7: that test generates source in memory at lines 23–27, writes dumps at 28, executes the in-memory string at 33–35. No reader of the dumps. Executor build/typecheck passed without them. | certain | delete now | 158 | 2 / 6,410 |
| D12 | `arch/jitk/grow/demo-release.json` | Stale pointer to the old recorded presentation. Current demo neither reads nor writes it. | E7: zero executable references. `demo.py:16–19` starts a fresh controller run and reads that run's report. The only current-subtree prose reference is stale `DEMO.md:22`; correct it with this deletion. Keep historical reports. | certain | delete now | 3 | 1 / 83 |
| C01 | `arch/jitk/shard/{src/main.rs,src/kvm.rs,guest/stub.S,run.sh,summarize.py}`; `build.rs:18` | Separate v0 assembly shard, superseded for product execution by `real`. **Still live** via its own benchmark CLI/driver. | E8: default Cargo autobin, `run.sh:8–13`, `kvm.rs:22`, build script. `real.rs` has a separate module graph and never imports `kvm.rs`. Retire only with gates below. | likely retirement; certainly live now | delete after cutover | 1,118 | 5 / 40,187 |
| C02 | `arch/jitk/linux/{prepare-nested.sh,nested/run-qemu.py,nested/init,nested/prepare-stdlib.sh}`; `nested.sh:10`; `run.sh:11` | Second-QEMU backend superseded as default by SSH, but still explicitly selectable. | E9: `JITK_NESTED_BACKEND=qemu` reaches it. SSH shares `suite.py` and watchdog; current R7 report documents the QEMU assertion spin. Retire the option and its branch together after replacement coverage is accepted. | likely retirement; certainly reachable now | delete after cutover | 78 | 4 / 3,461 |
| K01 | `arch/jitk/{executor/backend.ts,executor/pool.ts,vmm/,kernel/src/{console.rs,fdt.rs,wait.rs,mmu.rs}}` | Default/libkrun path and physical pool. Mac v1 needs these; Linux currently defaults to them too. Pool/process abstractions also serve shard and Hyperlight integration. | E10: `select-backend.ts:23,55`, `executor.ts`, `mcp/jitk.mjs`; V1 §3 and cutover plan §1–3. | certain | keep | — | shared live code |
| K02 | `arch/jitk/shard/ABI-R6.md`; `kernel/src/ring.rs`; `shard/src/real_kvm.rs` | ABI-R7 extends native byte handling; it does not replace the QuickJS R6 major=2/minor=0 contract. | E10: `ABI-R7.md:3–18` explicitly retains it. Ring/real sources implement it; no separate retired R6 Rust backend was found. | certain | keep | 146 for ABI-R6 doc | not removable |
| K03 | `arch/jitk/shard/{src/bin/real.rs,src/ipc*.rs}`; `executor/shard-*.ts`; `mcp/native.mjs` | Current experimental IPC and native-worker paths. Commands are string-dispatched, including the self-spawned watchdog. | E10: `real.rs:47–79`, `lease.rs:226`, `select-backend.ts:28–34`, `native.mjs:45`; hostile source/IPC checks call these paths. | certain | keep | — | live R7 code |
| K04 | `arch/jitk/shard/harness/*-r6.*`, `*-r7.*` | Round suffixes alone do not imply dead code. `ledger-r6.py` is reused by R7 runners; old reducers preserve reproducibility. | E11: R7 shard runner line 34 and integration-classes runner line 21 invoke `ledger-r6.py`; results docs invoke round-specific reducers/drivers. | certain | keep | — | archive old-only tools with evidence if desired |
| K05 | `arch/jitk/grow/{loop.py,adapters.py,runtime.py,profiles.py}` | Discovery, explicit `--target`, REPLAY and LIVE share the current acceptance controller. Original signal/ppoll flow remains a demo/test contract. | E11: Makefile/delegate demo invokes loop; `loop.py:224–233` selects discovery or explicit targets then calls the same transaction; `test.py` exercises adapters and discovery. | certain | keep | — | no second current grow loop found |
| K06 | `arch/jitk/executor/generated-tools.d.ts`; `codec.mjs`; `fixtures/` | Apparently unimported types/code/stand-ins with real compile-time, string or test consumers. | E12: removing types gives TS2304 in `type-proof.ts:4,6`; `code.ts:6,12` reads/injects codec source and calls `installBase64`; sandbox/transport/watchdog/shard checks invoke peers. | certain | keep | 33 for generated types | not removable |
| K07 | `arch/jitk/vmm/sandbox/mod.rs:24`; `shard/src/{kvm.rs:12,real_kvm.rs:20}`; `kernel/build.rs:37` | Broad warning suppressions require configuration-aware interpretation. Most forced warnings are platform/test-only/generated scaffolding. | E3/E13: Mac BPF/netns warnings have Linux/test callers; shared generated ABI constants are used by `real`; generated syscall imports vary by handler. | certain | keep | — | narrow cfg/suppressions separately |
| K08 | `arch/jitk/kernel/{Cargo.toml,src/main.rs:66}` | `--no-default-features` is broken, not a working unused CLI mode proven safe to remove. | E13: 17 compile errors, including unresolved `user`/`fs`. No current caller requests it. Keep `qjs` feature naming because live scripts explicitly request it; decide whether to repair or formally remove the non-qjs configuration. | likely obsolete intent | keep | 2-line branch, excluded from totals | no deletion claim |
| K09 | `arch/jitk/bench/hyperlight/`; `protocol/{vm.mjs,vm-test.mjs,hostile/}` | Hyperlight remains a v1 comparator. R2 positional protocol fallback remains an explicit/default harness setting, not unreachable code. | E14: bench controller loads Hyperlight descriptor; adapter uses shared ProcessBackend; protocol CLI exposes `JITK_VMM_CLI=02-r2` and default fallback. | certain | keep | — | migrate fallback separately |
| K10 | `arch/jitk/vmm/tests/nested-kvm.py` | Separate older VMM-focused QEMU harness. It is not automatically removed with C02. | `vmm/Makefile:18–19` and README explicitly expose it; it runs CLI, console-abuse and seccomp checks. No proof SSH suite covers every assertion. | certain | keep | 87 | not in cutover total |
| K11 | `arch/jitk/docs/{ARCHITECTURE.md,CLAIMS.md,KILL-CRITERIA.md,ARTIFACTS-R4.json}` | Frozen R4 docs, not duplicate current architecture. Root README presents them as current, causing misleading status. | E15: docs link immutable R4 manifest/failures; newer root architecture/V1 and R7 receipts describe later work. | certain stale presentation | keep | 181 | 4 / 23,811; relabel/link current status |
| K12 | `arch/jitk/{README.md,shard/README.md,grow/DEMO.md}` | Stale prose: MCP one-tool claim; IPC “unimplemented”; old presentation/pause/pointer behavior. | E15: current server exposes `execute` and `run`; real/selector implement IPC; current demo has fresh transactions and `--fast` is a compatibility no-op. | certain | keep | — | update, do not delete whole READMEs |
| A01 | `arch/jitk/grow/results/` | Receipts, copied sources, accepted bundles and repeated kernel images. No shipping input; historical report/READY pointers exist. | E16: current `demo.py` makes new runs; `loop.py` writes receipts. `RESULTS-R7-grow.md` links four evidence runs. | certain evidence | keep | 224,839 | 3,350 / 74,157,001; archive |
| A02 | `arch/jitk/bench/ledger/raw/` | Large raw vmmap/footprint/process diagnostics. Not runtime code; verification explicitly needs retained files. | E16: `ledger/verify.py:20–26` checks paths from receipts; ledger README explains retention. | certain evidence input | keep | 323,415 | 880 / 49,936,799; archive with materializer |
| A03 | `arch/jitk/bench/ledger/artifacts/` | Frozen built executor and benchmark input metadata, deliberately different from current executor. | E16: `ledger.mjs:11–13` dynamically imports frozen `executor/build/executor.js`; `MANIFEST.json` hashes it. | certain live benchmark input | keep | 18,199 | 56 / 2,815,108; archive, restore for reproductions |
| A04 | `arch/jitk/shard/raw-*/` and `shard/results/` | Historical/pilot/final measurements, copied source/receipt trees and compressed evidence. | E16: R6/R7 result docs and harness reducers reference these; their contents are not in Cargo's source graph. | certain evidence | keep | 251,329 | 1,951 / 63,074,062; archive |
| A05 | `arch/jitk/linux/out/` | Generated reports, logs and R7 suite evidence. Current runners overwrite output, while result docs cite old runs. | E16: `nested.sh:5–6,29+`, `summarize.py`, `RESULTS-R7-suite.md`. Keep small current summaries/READY provenance or redirect them to archived originals. | certain evidence/output | keep | 33,598 | 99 / 5,759,691; archive |
| A06 | `arch/research/**/{raw,raw-*}/**` | Raw research evidence, not a bulk-delete opportunity. Native census inputs and perf findings support v1 work. | E16: native corpus/preparer use pinned `/home/dev/r6-census` artifacts; research reducers and result docs explain raw evidence. | certain evidence | keep | 472,607 | 809 / 15,968,160; archive |
| K14 | `arch/research/` outside A06; `arch/viz/`; `spike/` | Coarse inventory: research totals 962 files/22,967,439 B; viz 8/99,718 B; spike 19/205,770 B. Viz HTML is a distributable generated from scene/engine sources; spike is historical. | E17: root README links viz/spike; viz builder emits standalone HTML; spike scripts operate on their local fixtures. No shipping caller found, but history/demo use is explicit. | certain role; likely archive candidates | keep | viz 1,106; spike 164 | archive spike; retain published explainers/source |

## Non-obvious dependencies and retirement gates

### Generated scratch accounts for most immediate removals

D01–D03 account for **168 files / 11,268 text lines / 28,722,317 bytes**. The generators recreate these paths before reading their outputs. Keep `kernel/tests/fixtures/`, `payload/qjs`, `payload/qjs-ring`, `grow/payload/lua-static`, build scripts and resource packer. The tracked `test-work/grow-contract/kernel` is a test copy with intentionally altered/deleted handlers, so treating it as a second maintained kernel would be particularly misleading.

Add `kernel/test-work/` to the appropriate ignore rules when implementing this cleanup; currently kernel `.gitignore` covers `dist/` and `target/`, not this scratch tree. That preventive edit is not counted as a removal. Do not infer a deletion of default images/payloads from the fact that build outputs elsewhere are redundant.

D10–D12 are outputs/pointers with no current input consumer. Other files ending in `*-results.json` are **not** automatically included: for example, `executor/certify.mjs:21` reads `breakdown-results.json`, `select-backend.ts` reads parking receipts, and ledger verification reads diagnostic paths.

### C01: a superseded executable with real users inside the repository

The assembly crate graph is `src/main.rs → src/kvm.rs → OUT_DIR/stub.bin`, with `run.sh` invoking `selftest`, `density`, `reset`, and `wait`, followed by `summarize.py`. The current real-kernel graph starts at `src/bin/real.rs`; its KVM module is `real_kvm.rs`, not `kvm.rs`. Searches for `jitk-shard`, `guest/stub.S`, and `stub.bin` in executable current code find the old driver/build/module plus a visual-explainer label, not executor/MCP launches of the old binary.

Thus this is a **retirement candidate**, not zero-caller dead code. After Linux cutover, preserve its sources/results together in the reproducibility archive, move any still-required v0 conformance assertion into real-kernel tests, remove its documented CLI/driver, and remove only `build.rs:18–25,41` (9 lines). Keep `abi.c` and the arena-attack build: `real_kvm.rs` uses both. C01 counts 1,109 lines in five complete files plus those 9 build lines. Do not delete the entire shard directory or build script.

### C02: SSH default does not make `qemu` unreachable

`linux/run.sh` defaults to SSH; the explicit `qemu` setting still prepares a Debian initrd and reaches `nested/run-qemu.py`. This review did not launch it. The R7 suite report documents a reproducible additional-QEMU/HVF assertion spin and successful SSH runs, making retirement reasonable, but explicit CLI compatibility remains until it is intentionally removed.

The four QEMU-only files total 63 lines. C02 adds the 14-line staging/launch body at `nested.sh:10–23` and one `run.sh` case arm. Preserve shared `nested/watch.py`, `test-watch.py`, `parking-check.py`, `suite.py`, SSH runner, Linux builders and probes. Rewrite the surrounding conditional and update README/error text when removing the option. Do not conflate this with the distinct VMM harness K10. **Cutover alone does not satisfy these coverage/CLI-retirement conditions.**

### Linux cutover is not permission to remove Mac infrastructure

The current selector defaults to `jitk`, has an experimental Linux `shard` branch, and labels it `integrated:false`. The cutover plan predates parts of the present implementation. `pool.ts` is a shared executor interface, not an exclusively Linux libkrun module. Hyperlight also reuses ProcessBackend and the native watchdog. Consequently there is **no verified whole-file removal of backend.ts, pool.ts, vmm/, or the default kernel after Linux-only cutover**. Delete Linux-specific launch branches only after the shadow corpus, metal gates and rollback release required by the plan; re-audit surviving benchmark/test callers then. Gate 7 is separately required before considering Mac removal.

ABI-R7 explicitly retains R6 QuickJS control/ring semantics and changes the native negotiated feature bundle. Its documentation is layered, not two competing removable ABIs. Similarly, `ledger-r6.py` has live R7 callers. Keep the original grow discovery demonstration: no-target and explicit-target requests converge on the same semantic/mutation acceptance transaction.

### Warning suppressions and dynamic dependencies

Forced warnings found one real unused syscall wrapper, one ring wrapper, two TypeScript import cleanups, and many scaffolding/platform warnings. Mac VMM compilation emits 60 warnings under forced unused checking; examples are `netns_fd`, `VCPU_CONFINED`, and the BPF policy module. These have Linux/test consumers. `bpf::eval` is called by tests at `sandbox/mod.rs:356,361`; deleting it because the production Mac binary does not call it would destroy conformance coverage.

The assembly shard warns about `KVM_MEM_READONLY`, `KVM_GET_REG_LIST`, and `REG_SCTLR` in generated `abi.rs`. The real-kernel shard uses them at `real_kvm.rs:216,272,410`. The shared `abi.c` definitions must stay. Kernel's generated per-handler imports/unsafe wrappers are suppressed centrally; their forced unused warnings are not independent dead syscall implementations. Syscall numbers are generated from `slots.json` and handler file existence in `build.rs:27–49`, so a handler needs no ordinary Rust function-name caller to be live.

The deletion rehearsal rejected `generated-tools.d.ts`: `tsconfig.json` includes ambient declarations, and `type-proof.ts` refers to `github`/`gitlab` without an import. Removing it yielded TS2304 at lines 4 and 6 (and broke the intended compile-only proof); restoring it made strict unused checks pass. The apparently unused `installBase64` export is invoked inside a template string after `code.ts` reads the complete codec file. Test peers are launched by filename. The watchdog command is self-spawned through `current_exe`, not a separate statically imported program. These are verified keeps.

The non-qjs feature configuration produced 17 compilation errors, including unresolved `user` and `fs`. This establishes a broken declared configuration, not sufficient evidence to count its removal. `probe` is live in `run-probes.py`; it builds successfully when `JITK_PROBE` is supplied. `trace`/`grow-trace` also built successfully in that configured probe build. No working feature is declared dead merely because the default does not enable it.

### Evidence and documentation weight

Archive A01–A06 as content-addressed experiment bundles with manifests, compact result summaries and explicit restoration commands. Keep raw observations rather than replacing them with selected success summaries: these contain failed runs, pilot corrections, counterexamples and provenance. Move frozen built executors together with their matching measurements; substituting the current executor changes the experiment. `ledger/verify.py` is a concrete constraint: archived diagnostics must be materialized at the recorded relative paths before verification.

Duplicate hashes confirm repeated storage, not interchangeable experiments. Examples checked with SHA-256: `bench/raw.json` and `arch/10-minimalist-critic/r4/frozen/bench/r3-raw.json` are identical **4,132,242-byte** files; one old missing-handler image appears eight times across old grow runs (**2,924,544 bytes** each). The latter includes four copies in current `grow/results`. Preserve one content-addressed object and experiment-specific manifests/pointers. These savings are **not added** to totals because they overlap archive/scratch categories.

Older `arch/01-*` through `arch/10-*` contain **4,941 tracked files / 1,191,854 text lines / 113,838,447 bytes**. They were inventoried coarsely, not audited as current source; some are explicitly linked frozen claims evidence. Do not count them as verified dead code or bulk-delete them under this report.

The two architecture documents describe different eras: `arch/architecture/ARCHITECTURE.md` is the merged forward design; `arch/jitk/docs/ARCHITECTURE.md` is R4 “as built.” Keep historical claims, label their date/scope visibly, and link current status from the active README. Concrete stale prose includes:

- `jitk/README.md:20`: “one execute tool”; current `mcp/server.mjs` registers execute and native run.
- `shard/README.md:68`: Node policy IPC “unimplemented”; `real.rs`, `ipc_service.rs`, `shard-backend.ts` and selector now implement an experimental path.
- `grow/DEMO.md:3–11,22`: recorded presentation, timed pauses and `demo-release.json`; current demo runs a fresh acceptance transaction, and `--fast` is a documented compatibility no-op in `demo.py:11`.

No mass deletion of READMEs, architecture alternatives, viz output, research notes or bench adapters is supported by this review.

## Verification evidence and commands

All builds/mutations were in `/tmp/sofort-r7-review-dead` on Mac or `/home/dev/r7-review-dead` in kvm-dev. The working tree was read-only apart from this report. The Linux VM was not stopped. Scratch directories were removed after review.

**E1–E2 — generated paths/bootstrap.** Read `kernel/tests/{fs_diff.py,grow_contract.py,run-probes.py}`, `grow/runtime.py`, and `kernel/build.rs`; ran:

```sh
rg -n 'test-work|copytree|JITK_PROBE|probe-kernel' arch/jitk/kernel/tests arch/jitk/grow/runtime.py
rg -n 'bootstrap' arch/jitk/kernel/build.rs arch/jitk/kernel/README.md arch/jitk/protocol/import-check.mjs
```

Also searched current executable sources for `kernel/bootstrap.js`: zero matches. Deleted D01–D04 only in the scratch archive; default/ring kernel builds and host tests below passed. The probe build with a supplied probe input was checked before removing generated probes; their generator writes them before use. Full VM filesystem/probe differentials were not rerun.

**E3 — Rust diagnostics/callers.** Mac kernel Rust 1.95.0; Linux shard stable Rust/cargo 1.99.1. Commands, run inside the appropriate scratch crate:

```sh
RUSTFLAGS='--force-warn dead_code --force-warn unused' \
  cargo +1.95.0 build --locked --offline --release --target aarch64-unknown-none
RUSTFLAGS='--force-warn dead_code --force-warn unused --check-cfg=cfg(ring_glue_4m) -C link-arg=--defsym=__ring_arena=0x81800000' \
  JITK_ELF="$PWD/payload/qjs-ring" \
  cargo +1.95.0 build --locked --offline --release --target aarch64-unknown-none --features transport-ring
rg -n '\bpark\b' arch/jitk/kernel/src arch/jitk/kernel/tests arch/jitk/grow --glob '*.{rs,py}' --glob '!**/results/**'
```

Both kernel builds passed, originally 32 warnings each. The default has the unused `syscalls.rs:36` helper warning; ring also warns for `arch/aarch64/wait.rs:6`. Both helper warnings disappear with D05–D06 removed in scratch. The default `wait.rs:73` remains called by `console.rs:242`.

The shard source was copied through the authorized SSH wrapper to its exclusive scratch directory; debug/release `cargo build --locked --offline` passed for **both binaries** with the same forced-warning flags. `cargo test --locked --offline` passed **19 tests**, with zero failures. No full native corpus or KVM load/benchmark was run. Invocations used `/Users/noah/code/sofort/kvm-dev/ssh.sh '<command>'` and `cd /home/dev/r7-review-dead/arch/jitk/shard`.

**E4–E7 — Python/TypeScript/generation.** Caller scans inspected current code plus research/entry points, excluding generated observations/copies. Representative exact commands:

```sh
rg -n '\bmarker_path\b' arch/jitk/bench arch/jitk/grow --glob '*.{py,sh}' --glob '!**/artifacts/**'
rg -n 'Makefile|subtree ==|action ==|run.sh' arch/jitk/docs/delegate.py
rg -n 'cloudflare-|generated-tools|writeFileSync|linked=|rules' arch/jitk/executor/{wrapper-conformance.ts,verify.ts,policy-check.ts}
rg -n 'transitional-r2-breakdown-results|demo-release.json' arch/jitk \
  --glob '*.{py,ts,mjs,js,sh,md}' --glob '!**/raw*/**' --glob '!**/results/**' \
  --glob '!**/artifacts/**' --glob '!**/test-work/**' --glob '!**/out/**'
```

`marker_path`: one definition, zero calls in current executable code; the earlier historical source contains its old callers. Transitional result: no references; stale demo pointer: only its stale current Markdown reference. D11's filenames are dispatched by interpolation, so the generator was read rather than relying on literal zero matches. For D08, imported original/scratch `delegate.py` using `runpy.run_path`, patched `subprocess.call` to record argv, and compared `vmm/build`, `executor/build`, `protocol/build,test`, `bench/build,test,bench`; all seven commands chose the same Makefile entrypoints. The scratch pathname was normalized with `Path.resolve()` for `/tmp` versus `/private/tmp`.

With D01–D12 applied **only in scratch**, retaining ambient generated types, ran:

```sh
# executor/; existing dependency tree read through a symlink, no install
/tmp/jitk-09/node-real node_modules/typescript/bin/tsc -p tsconfig.json --noUnusedLocals --noUnusedParameters
/tmp/jitk-09/node-real build.mjs
/tmp/jitk-09/node-real build/shard-source-check.js
# protocol/
/tmp/jitk-09/node-real build.mjs
/tmp/jitk-09/node-real test.mjs
/tmp/jitk-09/node-real import-check.mjs
# kernel/
python3 -B tests/test_packer.py
python3 -B tests/test_handlers.py
python3 -B tests/test_fs.py
# grow/
python3 -B test.py
python3 -B -m unittest discover -s oracle -p 'test_*.py'
# bench/
python3 -B run.py --test
```

All passed: strict TS checking/bundling, six shard source checks, protocol 71 listed cases plus 25,000 mutations (622 accepted, 24,378 rejected), canonical imports, seven packer tests, Rust handler/filesystem host tests, 22 grow tests, four oracle tests, and benchmark statistics/watchdog/process-cleanup checks. Default/ring kernel builds also passed after the removals. This does not claim aggregate `make test`, macOS VM execution, MCP end-to-end parity or cutover readiness.

**E8–E12/E14 — dynamic entry points and keep decisions.** Read root/subtree Makefiles, `docs/delegate.py`, `executor/run.sh`, Linux runners and package scripts; ran:

```sh
rg -l 'jitk-shard|guest/stub.S|stub.bin' arch/jitk arch/research arch/viz kvm-dev \
  --glob '*.{sh,py,rs,ts,mjs,js}' --glob '!**/raw*/**' --glob '!**/results/**' \
  --glob '!**/out/**' --glob '!**/test-work/**' --glob '!**/artifacts/**'
rg -n 'JITK_NESTED_BACKEND|run-qemu.py|prepare-stdlib|nested-kvm.py' arch/jitk/linux arch/jitk/vmm --glob '*.{sh,py,md}' --glob '!**/out/**'
rg -n 'ledger-r6|analyze-r6|analyze-r7|run-r6' arch/jitk/shard/harness arch/jitk/shard/RESULTS*.md
rg -n '02-r2|launcher' arch/jitk/executor arch/jitk/protocol arch/jitk/bench/hyperlight --glob '*.{ts,mjs,py}'
rg -n 'current_exe|native-worker|watchdog' arch/jitk/shard/src arch/jitk/mcp/native.mjs
rg -n 'ABI-R6|major=2|minor=0' arch/jitk/shard/ABI-R7.md arch/jitk/kernel/src/ring.rs
rg -n 'shard-peer|ack-peer|protocol-peer' arch/jitk/executor/*.ts
```

**E13 — suppressed/platform warnings and tool limits.** Built/linked the Mac VMM frontend from the scratch `vmm/src/main.rs` with `rustc +1.95.0 --edition=2024 -O -C panic=abort --cfg sandbox_ready --force-warn dead_code --force-warn unused`, and `--extern krun`, `libc`, `utils`/`-L dependency` pointing to the existing `/tmp/jitk-01/r3/darwin/libkrun/target/release/deps` artifacts. It passed; this was not a clean libkrun rebuild. Checked definitions and Linux/test callers with:

```sh
rg -n 'allow\((dead_code|unused)' arch/jitk/kernel/src arch/jitk/kernel/build.rs arch/jitk/shard/src arch/jitk/vmm
rg -n '\b(REG_SCTLR|KVM_GET_REG_LIST|KVM_MEM_READONLY)\b' arch/jitk/shard/src
rg -n 'VCPU_CONFINED|netns_fd|bpf::|eval\(' arch/jitk/vmm/sandbox/mod.rs arch/jitk/vmm/sandbox/tests
```

`cargo +1.95.0 clippy` on Mac and `cargo clippy --all-targets` in Linux scratch were attempted: **cargo-clippy is not installed for those toolchains**. Mac stable Clippy was also attempted; it lacks the `aarch64-unknown-none` core target. No components were installed. Forced-warning compiler builds provide the diagnostic evidence above; there is no claim of a clean Clippy run. The configured `probe,trace,grow-trace` build passed with `JITK_PROBE` pointing at a generated probe; an initial invocation without that required variable failed as expected.

**E15–E17 — docs/data.** Read the V1/architecture/cutover documents first, then checked current README claims against sources. Used `git ls-files` for inventory (so ignored/local artifacts are not mistaken for committed weight), read relevant producers/consumers, and compared duplicate large-file SHA-256 hashes. `ledger/verify.py` and `ledger.mjs` are positive evidence that some seemingly generated artifacts remain inputs. No archive row is represented as zero-caller runtime code.

## Reproduce removal totals

Run at the reviewed commit. Prefix sets are disjoint; the new review document is outside them. Byte counts for partial edits count removed source bytes; `rules,` is a six-byte binding removal with zero whole lines. Lines are physical byte `splitlines()`, with NUL-containing files treated as binary.

```python
from pathlib import Path
import subprocess

tracked = subprocess.check_output(['git', 'ls-files'], text=True).splitlines()
prefixes = [
    'arch/jitk/kernel/test-work/fs/',
    'arch/jitk/kernel/test-work/grow-contract/',
    'arch/jitk/kernel/test-work/probes/',
]
whole = [p for p in tracked if p.startswith(tuple(prefixes))] + [
    'arch/jitk/kernel/bootstrap.js',
    'arch/jitk/executor/transitional-r2-breakdown-results.json',
    'arch/jitk/executor/cloudflare-binary.generated.mjs',
    'arch/jitk/executor/cloudflare-github.generated.mjs',
    'arch/jitk/grow/demo-release.json',
]
partial = [
    ('arch/jitk/kernel/src/syscalls.rs', 35, 36),
    ('arch/jitk/kernel/src/arch/aarch64/wait.rs', 6, 8),
    ('arch/jitk/bench/run.py', 146, 159),
    ('arch/jitk/docs/delegate.py', 84, 95),
    ('arch/jitk/executor/wrapper-conformance.ts', 4, 4),
]
chunks = [Path(p).read_bytes() for p in whole]
chunks += [b''.join(Path(p).read_bytes().splitlines(keepends=True)[a-1:z])
           for p, a, z in partial]
print(len(whole), sum(0 if b'\0' in b else len(b.splitlines()) for b in chunks),
      sum(map(len, chunks)) + len('rules,'))
# 173 13760 28798478
```

Archive totals cover exactly A01–A06, not all research, old rounds, docs, viz, spike, or overlapping duplicate-hash savings. C01–C02 are separately gated retirements, excluded from the immediately removable total. No claimed savings require removing Mac libkrun or the shared executor pool.
