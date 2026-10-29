V1 — independent reproduction and evidence audit, 2026-10-29

All requested headline counts reproduced after deleting `build/`: **460 native/V8 comparisons, 11 Pulley checks, eight workerd endpoint comparisons, six linked-body certificates, five rejected byte corruptions, and rejection of the bounds-check compiler mutant**. Independent LLVM extraction agrees with every certificate byte array. The accepted proofs have only the claimed standard axioms. The README generally describes its restricted assurance boundary accurately.

I found one concrete weak test: two Pulley result assertions also accept empty or nonnumeric output because of JavaScript coercion. Their real outputs were valid in this run. A smaller documentation defect is that the advertised “source hashes” in `build-report.json` cover Wasm inputs, not the Lean/JS/C implementation sources. Neither finding overturns the reproduced native execution or byte certificates.

The original spike was read only. All building, probes and mutations took place in `/tmp/lemma-verify-v1-reproduce-20261029` (macOS resolves it to `/private/tmp/...`). This report is the only repository file I wrote. No Python, commits, external APIs or delegated agents were used. Unless otherwise specified, evidence paths below are relative to that scratch copy; the raw artifacts remain there.

The environment was Darwin arm64, macOS 26.6.1 (25G76), Node v23.10.0, Bun 1.2.5, Lean 4.35.0 (`eb6cafb7290e8bd5f2937522d8d804f58f02bafc`), Apple clang/LLVM 21.0.0, Wasmtime 49.0.3 (`f96eabaa1`), and project-local workerd 2026-09-18, matching the package pin `1.20260918.1`. These are observations of the installed tools, not a fresh toolchain installation.

I copied the directory as required, removed its copied `build/`, and followed the README commands:

```sh
cp -R /Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/lemma-spike /tmp/lemma-verify-v1-reproduce-20261029
cd /tmp/lemma-verify-v1-reproduce-20261029
node --input-type=module -e 'import fs from "node:fs"; fs.rmSync("build", {recursive:true, force:true}); console.log(fs.existsSync("build"));'
bun install
export LEMMA_LEAN=/Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/lean-oneshot/elan/toolchains/leanprover--lean4---v4.35.0/bin/lean
npm run build
npm test
npm run demo
```

The clean check printed `false`. `bun install` exited 0 and printed `Checked 2 installs across 7 packages (no changes)`: dependencies were reused from the copy. My initial `npm run build`, before setting the override, exited 1 with `spawnSync lean ENOENT`. Copying to `/tmp` breaks the sibling-toolchain lookup, and Lean is absent from PATH. Setting `LEMMA_LEAN` is explicitly documented by the README; no source fix was needed. With that override, build, test and demo each exited **0**. See `audit/install.log`, `audit/build.log` (initial failure), `audit/build-with-lean.log`, `audit/test.log`, and `audit/demo.log`.

The build invokes Lean on `CheckedModel.lean`, `NativeBridge.lean` and `Export.lean`, explicitly producing new `.olean` files, before processing fixtures. Thus the copied project `.olean` files were not simply accepted as cached proof results. Standard-library/toolchain artifacts and npm dependencies remain installed prerequisites. All six objects, the executable, certificates and reports were regenerated under the initially absent `build/`.

Build output included:

```text
fill: proof checked, 33 model instructions; 236 native bytes match LLVM assembler
fill_unopt: proof checked, 40 model instructions; 264 native bytes match LLVM assembler
load: proof checked, 6 model instructions; 128 native bytes match LLVM assembler
load_unopt: proof checked, 8 model instructions; 136 native bytes match LLVM assembler
shift: proof checked, 4 model instructions; 120 native bytes match LLVM assembler
shift_unopt: proof checked, 4 model instructions; 120 native bytes match LLVM assembler
```

It subsequently printed `linked machine-code bytes pass Lean preservation certificate` for each of those six names. The regenerated runner SHA-256 is `37ad68193ae69e5bd5758287c4966148ce666ea62f4c8fb6071ab912f4e6328e`.

**What the 460 comparisons establish.** `src/test.mjs:31` increments its counter only after each native result passes `assert.deepEqual` against an actual V8 execution. I also wrapped `spawnSync` and `WebAssembly.Instance` without changing their returned results, then explicitly invoked `tests()`. That independent instrumentation observed **460 runner subprocess calls and 230 V8 instances**, with this distribution (`audit/count-native.mjs`, `audit/invocation-counts.json`):

| Fixture, per optimization variant | Native calls | Distinct inputs | Successful calls | Trapping calls |
|---|---:|---:|---:|---:|
| fill | 59 | 59 | 55 | 4 |
| load | 109 | 109 | 54 | 55 |
| shift | 62 | 62 | 62 | 0 |

Both optimized and unoptimized variants have the same counts. Thus `(59 + 109 + 62) × 2 = 460`. There are 230 fixture/input cases, each checked against both native variants; this is not 460 different Wasm programs. The seeded random inputs are deterministic (`face1234`), supplemented by the explicit boundary cases. The six parser/encoder negative checks also execute; `negativeChecks: 6` is a literal report field, but corresponds to six actual rejection assertions in `src/test.mjs:46–54`.

The compared values are exactly `{trap, result, memoryHash}`. Both implementations initialize all 65,536 memory bytes with `(i*37+11)&255`; both hash every byte using **32-bit FNV-1a** (initial value 2166136261, multiplier 16777619). This is neither a cryptographic memory hash nor a byte-for-byte memory comparison. Collisions can conceal differences. On a trap the compared result is normalized to zero, and memory hashing still observes preceding writes. `fill(16385)` therefore exercises the memory left after filling the entire page and then trapping. The README explicitly disclaims bytewise equality, and its description holds. No bytes outside the linear memory or guard regions are compared.

**What the 11 Pulley checks establish, and their weakness.** The script really launches `wasmtime run --target pulley64 --invoke run ...` eleven times. The cases are four fill, three load and four shift cases, including three expected traps. It compares Pulley with a hard-coded expected result/trap table, not with a fresh native/V8 execution. It does not compare memory. The single successful load case expects zero because Pulley's CLI memory starts at zero; the README correctly explains that difference.

The actual success outputs were `0`, `1024`, `16384`, `0`, `-1`, `1`, `-1`, and `2147483647`, in case order; the signed `-1` outputs are normalized to unsigned `0xffffffff`. The three trap runs exited 134 and emitted the required `wasm trap: out of bounds memory access` diagnostic. These were real CLI runs, not skipped cases. See `audit/pulley-stdout-probe.json` for raw stdout/stderr and exit codes from an additional instrumented run.

However, `src/interpreter-check.mjs:13` uses:

```js
assert.equal(Number(run.stdout.trim()) >>> 0, result);
```

`Number('') >>> 0` and `Number('not a number') >>> 0` both equal zero. I demonstrated the weakness by calling the real Wasmtime subprocesses, then replacing only `fill(0)` stdout with `''` and successful `load(65529)` stdout with `'not a number\n'` before their existing assertions ran. The entire script still exited 0 and printed `11 Wasmtime Pulley result/trap checks pass.` (`audit/probe-pulley-output.mjs`, `audit/pulley-stdout-probe.log`). The original interpreter report was restored afterward. **Those two assertions can pass without a valid result representation.** This is a checker defect, not evidence that the actual Pulley run returned a wrong result. Strict validation of one signed i32 result before conversion would close it.

**What the eight workerd checks establish.** `npm run demo` started the project-local workerd and a loopback Node native service, then fetched both `/run/...` and `/v8/...` for eight cases: fill 1024/16384/16385, load 65529/65530/4294967295, and shift 32/33. All eight pairs matched `{trap,result,memoryHash}`; three cases trapped. The script checks HTTP 200 and the native response's `x-lemma-front-end: workerd` header. The native route uses the external service binding and a separate runner process; the V8 route instantiates the same fixture inside workerd. This supports the README's integration claim, with its explicit qualification that standard workerd Wasm compilation remains V8.

The four additional rejection checks are three invalid numeric inputs returning 400 and one unknown fixture returning 404. The 12 subsequent HTTP timing pairs are requests, but are not additional equality assertions; the “eight” count correctly describes the earlier comparisons. No runner/workerd process from this copy remained after the demo. Evidence: `build/demo-report.json`, `build/workerd.capnp`, `build/workerd.log`, and `src/demo.mjs:66–101`.

**Independent proof and escape-hatch audit.** I created `audit/Axioms.lean`, imported the rebuilt `NativeBridge`, and ran the same Lean 4.35.0 executable with `LEAN_PATH="$PWD/lean"`. Its independent `#print axioms` output was:

```text
'Compiler.compile_correct_straight' depends on axioms: [propext, Classical.choice, Quot.sound]
'Compiler.compile_correct' depends on axioms: [propext, Classical.choice, Quot.sound]
'Native.check_sound' depends on axioms: [propext, Quot.sound]
'Native.step_eq' depends on axioms: [propext, Quot.sound]
'Native.reach_of_model' depends on axioms: [propext, Quot.sound]
'Native.trap_of_model' depends on axioms: [propext, Quot.sound]
'Native.compiler_to_bytes' depends on axioms: [propext, Classical.choice, Quot.sound]
```

See `audit/axioms.log`. In all six freshly executed `build/*.native.proof.log` files, `preservation` and `preservation_unoptimized` have the same three standard axioms; `body_checked` and `compiler_eq` have `[propext, Quot.sound]`; `preservation_to_bytes` has `[propext, Classical.choice, Quot.sound]`. The positive decoder-coverage certificate also prints only `[propext, Quot.sound]`. None of the accepted proof logs includes `sorryAx`.

I scanned **all 21 `.lean` files** in the copy, including generated positive/negative certificates, the mutant, and my axiom-check file, with:

```sh
rg --files --hidden --no-ignore -g '*.lean' .
rg -n -i 'sorry|admit|native_decide|implemented_by|extern|unsafe|axiom' \
  --glob '*.lean' --hidden --no-ignore .
```

The only matches were `#print axioms` commands. There were no literal `sorry`, `admit`, `native_decide`, `implemented_by`, `extern`, `unsafe`, or axiom declarations in those files. The failed corruption **logs** do print `sorryAx` after error recovery; their Lean processes exit nonzero and the negative test expects rejection. Those recovered declarations are not accepted proofs. The text scan and the accepted-theorem dependency checks agree; relying on the scan alone would miss error recovery.

**Independent executable-byte extraction.** I did not reuse `src/arm.mjs` or its Mach-O parser for this check. I ran:

```sh
xcrun llvm-objdump --macho --section=__text --full-contents build/runner
xcrun llvm-objdump --syms build/runner
xcrun llvm-objdump --disassemble --symbolize-operands build/runner
node audit/reextract.mjs
```

The audit script parses LLVM's section-byte output and symbol addresses, locates each `_lemma_*` function, and starts its body after the **17 actual wrapper instructions**, confirmed in the independent disassembly (68 bytes). It parses each `.native.lean` file's literal `bodyBytes` list, writes both byte arrays, and invokes `diff` on them. Every diff exits **0**, and each LLVM-extracted body also equals its saved `*.native-body.bin`. It independently compares each full linked function's text with LLVM-dumped object text, and the raw-encoder object's text with its separately assembled mnemonic object's text. All comparisons pass.

| Linked body | Function address | Body address | Instructions | Certified bytes | Body SHA-256 prefix |
|---|---|---|---:|---:|---|
| fill | `0x1000007e4` | `0x100000828` | 33 | 132 | `bc74c4c72fb59012` |
| fill_unopt | `0x1000008d0` | `0x100000914` | 40 | 160 | `edc44d5cab61e3dc` |
| load | `0x1000009d8` | `0x100000a1c` | 6 | 24 | `825171f6b21662c8` |
| load_unopt | `0x100000a58` | `0x100000a9c` | 8 | 32 | `6fc794b4d56cbb6e` |
| shift | `0x100000ae0` | `0x100000b24` | 4 | 16 | `830a2878386ec3f9` |
| shift_unopt | `0x100000b58` | `0x100000b9c` | 4 | 16 | `830a2878386ec3f9` |

There are six nonempty, separately located linked bodies, totaling 95 instruction positions and 380 certified bytes. The two shift bodies are identical, so this is five distinct body byte sequences for three source fixtures, not six distinct source programs. Evidence: `audit/reextract.mjs`, `audit/independent-byte-report.json` (full hashes), `audit/objdump-*.txt`, and `audit/*.objdump-body.bin` versus `audit/*.certificate-body.bin`.

The correspondence is not simply an expected byte array agreeing with itself: `Native.check` checks exact length and decode equality at every body PC, and each certificate proves `compiler_eq` against the actual Lean compiler before composing `preservation_to_bytes`. The bodies are nonempty, so the finite checks do not pass through an empty `.all`. This validates each artifact against the custom model, while the LLVM comparison is separate conformance evidence.

I also tested the pre-execution integrity gate: flipping a byte in the copied runner causes `node src/test.mjs` to exit 1 with `Executable changed since byte certification`; changing one saved certified-body byte also causes exit 1 before native comparisons. Both files were restored in `finally` blocks, followed by successful independent byte extraction and runner-hash verification. See `audit/gate-check.json` and `audit/gate-*.log`.

**The five corruptions and the compiler mutant genuinely fail, within their stated scope.** The byte test builds a 43-instruction coverage artifact, checks the decoder in Lean, and compares the encoder output with LLVM. It then tests five separate corruptions of the optimized fill body: wrong register, wrong trap-branch displacement, `0xffffffff` unknown opcode, reversed bytes in every instruction, and truncation by one byte. Every rejection log contains:

```text
error: Tactic `decide` proved that the proposition
  Native.check code bodyBytes = true
is false
```

Thus these are not failures caused by missing imports or unavailable tools. Each failed `body_checked` print includes error-recovery `sorryAx`, as expected for rejected certificates. See `build/byte-proof-report.json`, `build/DecoderCoverage.log`, and all five `build/Rejected*.log` files. These five examples and 43 coverage instructions do not prove rejection of every possible corruption or comprehensive ISA coverage; the README correctly limits that claim.

For the compiler mutant, `src/mutant-check.mjs` changes one occurrence in `Compiler.boundsCheck`: `.addXi t1 t0 4` becomes `.addXi t1 t0 0`. Comparing the generated mutant with its input confirms that the source and target semantics and the proof text remain unchanged. Lean exits **1** at `Mutant.lean:562`, inside the bounds-check lemma, with `Tactic rewrite failed`; the displayed goal contains the mutated `+ 0` target against the unchanged `effective-address + 4` specification. This is genuine proof-recheck rejection, although it is not automated counterexample discovery. The test's broad error-message acceptance is weaker than checking that particular semantic mismatch; I inspected the actual failure.

The direct `boundsCheckOpt` fast path still contains its separate `+ 4`; the script changes the unoptimized/shared fallback definition only. It does not build or execute a mutant runner. The evidence therefore supports exactly the README's **model-level mutant rejection**, not a mutation experiment on all native paths. See `build/Mutant.lean`, `build/mutant-report.json`, `build/mutant-rejection.log`, and `src/mutant-check.mjs:7–17`.

**Performance reproduced.** The fresh demo's medians of five samples, 500 calls per sample, were:

| fill argument | V8 median ns | Optimized native ns | Unoptimized native ns | Optimized native / V8 |
|---:|---:|---:|---:|---:|
| 1,024 | 190,000 | 511,000 | 540,000 | 2.689× |
| 16,384 | 2,740,166 | 8,183,000 | 8,540,000 | 2.986× |

These are totals per 500-call sample, not per-call times. The optimizer improves the native medians by approximately 5.37% and 4.18%, respectively; fill's static modeled instruction count is 40 → 33. Initialization and memory hashing sit outside the measured kernel loops, as does native process creation, but the timings still compare a JS/V8 call loop with a C/native call loop. They are synthetic measurements with fixed execution order and no uncertainty estimate. The observed optimized slowdown supports “about 2–3× slower”; it establishes no broader performance result. HTTP medians were approximately 2.632 ms native service and 0.957 ms V8-in-Worker; the README correctly warns that process creation and different setup/hash paths prevent isolating compiler speed or RPC overhead.

**Skipped, cached, hard-coded, conditional, or incompletely recorded evidence.** No suite stage was skipped in the successful reproduction. The limits that matter are:

- `writeFixtures()` synthesizes and overwrites the same three `.wasm` fixtures from hard-coded JS instruction arrays on every build. These are real Wasm binaries validated by V8, but not imported third-party workloads or an official Wasm conformance suite. “From scratch” here means a clean generated build using installed tools and dependencies.
- The 460 and eight counts arise after actual assertions; the 11 count arises from the fixed case list. Pulley expected values, the six negative-check count and four invalid-endpoint count are hard-coded. Boolean flags such as `checked: true` and `coverageProofChecked: true` are written after actual successful checks; they are not independent proof objects.
- `npm test` trusts freshly generated manifest/log/body files and does not rerun all six Lean certificates. The full clean build did run them. `demo`, `native()` and the standalone service do not themselves invoke `tests()` or repeat its runner/certificate integrity gate before every launch. The documentation specifically promises the gate in tests; it should not be read as a tamper-resistant loader guarantee for standalone serving.
- The theorem's `timeout` case is literally `True`. The certificates supply validation and byte-check premises, but leave the initial source/target states, `Compiler.Match`, empty source stack and fuel universally quantified. They do not prove the C wrapper establishes that relation, prove termination, or give a runtime bound. The README acknowledges this; clean axiom lists do not strengthen the statement.
- Byte execution reuses `Arm.step`. It is not a separate authoritative hardware semantics. The 68-byte entry wrapper, normal exit jump, trap handler, register restoration and return convention are outside the certified body. Real-Wasm parsing, ISA conformance, host ABI/loader, and execution/extraction trust remain unverified formally. Native/V8 agreement and LLVM agreement are finite empirical evidence for parts of that boundary.
- `build-report.json` contains `platform`, `node`, `lean`, `artifacts`, and `executableSha256`. Artifact hashes cover Wasm inputs and native text/body bytes. **It does not contain hashes of the current Lean, JS, C or README sources**, contrary to a broad reading of its advertised “source hashes”; nor does it inventory every tool version. `PROVENANCE.json` separately hashes the historical model source, which I verified as `9d8c8314107d6db7ef1faf6657714b08f48575af7ae605bfb2cda38bfadb160d`. I recorded current source hashes in `audit/input-sha256.txt`; `audit/provenance-check.json` confirms that 20 audited implementation/documentation inputs still match the original spike. Generated `Program.lean` is intentionally rewritten by the build.

| Claim checked | Verdict | Evidence and qualification |
|---|---|---|
| Clean build/test/demo reproduction using the documented prerequisites | **Holds** | Removed `build/`; all three npm commands exit 0 with documented `LEMMA_LEAN` override. Initial no-override failure retained. Dependencies/toolchain reused. |
| 460 optimized/unoptimized native comparisons against V8 | **Holds** | Independent instrumentation counts 460 runner calls and 230 V8 instances; 118 fill + 218 load + 124 shift comparisons, with success and trap paths. |
| Tests compare result, trap and a hash of the entire 64 KiB memory | **Holds** | Both loops hash all bytes with 32-bit FNV-1a; comparator selects precisely those three fields. No bytewise equality or outside-memory check. |
| 11 Pulley result/trap cases pass | **Holds** | Eleven actual CLI invocations; observed valid success numbers and three matching OOB diagnostics. Fixed expectations, no native/memory comparison. |
| A passing Pulley check necessarily validated each result representation | **Wrong** | Probe substitutes empty/nonnumeric output in two zero-result cases and all 11 checks still pass (`audit/pulley-stdout-probe.log`). This stronger assurance is not explicitly claimed by the README. |
| Eight real workerd endpoint comparisons plus four invalid-input/path checks | **Holds** | Fresh demo compares eight native/V8 HTTP pairs; three 400s and one 404; project-local pinned workerd, external native service. |
| Six linked bodies have accepted Lean byte certificates | **Holds** | Six fresh proof runs; six nonempty body arrays, 95 instruction positions; `compiler_eq` and composed preservation checked. Two shift arrays are identical. |
| Certificate arrays really are the linked executable's body bytes | **Holds** | Independent `llvm-objdump` extraction and `diff` exit 0 for all six; full linked/object and LLVM-mnemonic comparisons also pass. |
| Tests recheck executable hash and saved certified body bytes before native comparisons | **Holds** | Source inspection plus separate runner/body mutation probes reject before execution. Standalone serving/demo do not repeat this gate. |
| 43-instruction decoder/encoder coverage artifact matches LLVM and Lean | **Holds** | Fresh coverage proof accepted with standard axioms; actual raw/mnemonic object comparison succeeds. Finite form coverage only. |
| Five concrete byte corruptions are rejected | **Holds** | All five fail `body_checked` because `Native.check ... = true` is false, with nonzero Lean exits. |
| Removing access width from the compiler bounds check is rejected by the unchanged proof | **Holds** | Only compiler definition changed; Lean exits 1 at the corresponding bounds-check proof. No mutant native executable tested. |
| Accepted key theorems use only propext/Classical.choice/Quot.sound | **Holds** | Independent generic theorem prints plus all six fresh certificate logs; some helper theorems use the smaller two-axiom subset. |
| No forbidden proof escapes in project/generated Lean files | **Holds** | Scan of all 21 files finds only `#print axioms`; no forbidden declarations or literals. Accepted dependencies contain no `sorryAx`. |
| Optimized native loop is about 2–3× slower than V8 | **Holds** | Fresh ratios 2.689× and 2.986×; five-sample medians, 500 calls, two fill sizes. |
| Fill optimizer reduces 40 modeled instructions to 33 and modestly improves native time | **Holds** | Build counts and approximately 5.37%/4.18% median improvement in this run. |
| Build report records implementation source hashes | **Overstated** | Wasm/native hashes exist; current Lean/JS/C source hashes are absent. Historical model provenance hash is separate and valid. |
| The artifact closes the real-Wasm → authoritative hardware → runtime proof chain | **Unverified** | Parser, authoritative ISA refinement, wrapper/ABI/loader and execution/extraction assumptions remain outside the theorems, explicitly acknowledged by README. |

TL;DR

1. Clean reproduction succeeds with the README's Lean override: all 460 / 11 / 8 checks and six certificates reproduce.
2. Independent LLVM extraction matches every certificate array; all five corruptions and the bounds-check mutant are rejected.
3. Accepted theorem dependencies are clean; memory tests use 32-bit full-memory hashes, while Pulley checks only fixed results/traps.
4. Pulley's two zero-result checks also accept malformed stdout; the build report omits current implementation source hashes.
5. Native is 2.69–2.99× slower than V8 here; the README's stated external proof gaps remain real and unclosed.
