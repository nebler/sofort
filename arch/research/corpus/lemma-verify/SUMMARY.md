# Lemma spike verification: summary (2026-10-29)

The spike was `~/.t3/scratch/…/lemma-spike/`, verified by four adversarial GPT-6.1-Sol agents. Each worked on its own
copy, so the original is unchanged. Brief: [BRIEF.md](BRIEF.md).

| Claim | Verdict | Evidence |
|---|---|---|
| 460 native-vs-V8, 11 Pulley and 8 workerd checks pass | **Holds** | V1: clean rebuild reproduces all of them. The Pulley zero-result checks also accept malformed output, and memory is compared by a 32-bit hash |
| 6 linked bodies certified; 5 corruptions and the bounds mutant rejected | **Holds** | V1: re-extracting with LLVM matches every certificate |
| Only the 3 standard axioms | **Holds** | V1 and V2 |
| Proof hypotheses are satisfiable (not vacuous) | **Holds** | V2: `matching_fixture_states` gives an inhabited `Match` for every i32 argument |
| The proof covers execution | **Overstated** | V2: it is conditional preservation for runs that terminate or trap within bounded fuel. There is no timeout guarantee and no guarantee about memory outside the frame |
| The theorem starts at Wasm | **Overstated** | V2: it starts at the spike's own model language, with no link to the official Wasm spec. V8 and the parser are trusted |
| The specs are fixed and the tests guard against drift | **Wrong** | V2: a joint modulo-16 shift mutant in the source and Arm models passes Lean, the build and every test, while disagreeing with the native code. There is no enforced hash lock on the specs |
| The Arm model matches hardware (for the emitted forms) | **Holds** | V3: 695,680 comparisons on an M4 Pro, 23 instruction forms, 0 divergences |
| The Arm memory model is realistic | **Wrong** | V3: 5 fault cases return `.ok` in the model, and tagged addresses break aliasing. This is the sandbox boundary |
| Coverage is a realistic Wasm backend | **Overstated** | V3: i32 subset only. No i64, signed operations, floating point, calls or ABI |
| About 2–3× slower than V8 | **Holds** | V1: 2.7–3.0×. V4: about 3× behind V8 and 3.8× behind Cranelift, with host overhead controlled for |
| Spills or harness overhead cause the gap | **Wrong** | V4: locals stay in registers. The cause is 32 instructions per loop iteration versus Cranelift's 8 (3.91 vs about 1.0 cycles per iteration) |
| Parity is reachable | **Plausible, unproved** | V4: unproved scalar fixes (immediates, fused branches, reuse, loop invariants) come close to parity. Proving them is about 4–8 person-weeks, or 6–14 including a scoped ABI proof (E) |

## What it would take to close the gaps (estimates)
- **Lock the specs:** enforce source/Arm/decoder hashes in the build. This takes days.
- **Arm model to authoritative semantics:**
  - LNSym bridge: about 6–10 weeks, Apache-2.0;
  - Sail/ASL route: about 3–6 months. The released Sail models are BSD; Sail has a Lean generator whose `sorry` fallback
    needs auditing.
- **Memory and fault semantics:** model mapping and permissions so guard-page and bounds behaviour is inside the proof.
- **Performance:** proved optimisations, about 4–8 weeks for the fixture bodies.
- **Still outside everything:** a link to the official Wasm spec (e.g. via SpecTec or WasmCert), the host ABI and the
  loader.

## Net
The spike is honest and reproducible. Its central artefact is real: a proof checked down to the bytes on a model that
matches the CPU for the emitted forms. There are three serious qualifications:
- the specifications are not locked, so a correlated spec bug passes everything;
- the memory model ignores faults;
- the "Wasm" side is a model language, not Wasm.

Speed is a code-quality problem, not an architecture problem.

## Fixes applied (2026-10-29, spike at `~/.t3/scratch/…/lemma-spike`, git-tracked)
- **Spec lock (fix 1, done):**
  - The Lean model is split into locked `lean/Spec/` and an untrusted `Compiler.lean`.
  - Artifacts must prove `Spec.Accepts program bodyBytes`, which mentions no compiler.
  - The build refuses edits to locked files without `npm run lock -- "<reason>"`, and refuses untrusted Lean that could add axioms or elaborators.
  - Conformance evaluates the locked semantics against V8 and the CPU.
  - The V2 joint modulo-16 mutant is now refused by the lock and, if re-locked, rejected by conformance at `shift(16)` (`npm run check:drift`).
- **Memory model (fix 3, done):**
  - Loads and stores fault unless readable or writable; data addresses use TBI.
  - The contract requires mapped linear memory at an untagged base below 2^56, so the claims now exclude data aborts.
  - Ten hardware probes, including V3's 5 fault cases and tagged aliasing, agree with the M4 Pro.
- **Proved speedups (fix 2, first slice, GPT-6.1-Sol):**
  - New forms: ADD W #imm, LSL W #imm and B.cond, each locked separately and covered by 630 CPU comparisons.
  - Proved immediate selection, compare/branch fusion and direct local updates.
  - `fill(16384)`: 0.994 → 0.613 ns/iteration (1.62×), 32 → 24 instructions/iteration. That is about 1.8× behind V8, down from 3.0×. Rerun independently.
  - Remaining: constant hoisting, repeated checked-load elimination and copy propagation, each needing proofs.
- **LNSym bridge (fix 4, first slice, GPT-6.1-Sol, `lemma-lnsym/lnsym-bridge/`):**
  - 17/23 emitted forms are proved, with universal decode agreement and one-step refinement against unchanged LNSym `5c05220` (= current main). 87 theorems use only the standard axioms. Re-verified independently.
  - Blockers:
    - CSINC/CSET execution is unimplemented in LNSym.
    - The LDR/STR register-offset class is missing from LNSym's decoder.
    - **An upstream bug:** B, B.cond and CBNZ compute `signExtend 64 (immN <<< 2)` inside N bits, losing the top two displacement bits. Large forward branches go backwards. This is kernel-checked and visible in the source.
  - LNSym has no permissions or TBI, so the spike's full memory model cannot be derived from it unchanged.
  - Estimate: 6–10 weeks for a composed normal-memory result, 8–14 weeks including faults and TBI.

## Phase 2 complete (2026-10-30, spike HEAD `5b992b5`, lock root `aaea4081`)
- **ABI and wrapper:**
  - each of the six linked functions proves `Spec.FunctionAccepts` from its symbol to `RET`;
  - covered: return target, status/result in X0, X19–X29 and SP restored, linear memory, and memory outside linear memory and the frame unchanged;
  - V2's ABI mutant is rejected.
- **LNSym:**
  - 35 forms are refined;
  - body and whole-function proofs compose through `RET` to LNSym `stepi`, with one local LDR/STR patch;
  - branches use a checked small-displacement workaround, and CSET is lowered to CSEL;
  - CPU checks: 240 memory and 202 wrapper comparisons.
  - Remaining premise: `NormalDomain`. It is discharged only for the memory-free `shift` artifacts; the general case needs a prefix-safety invariant.
- **Official Wasm:**
  - tested, not proved: the official reference interpreter agrees with the locked model on 899 calls, with zero disagreements;
  - the parser agrees with the official decoder on 978 binaries;
  - a proof would take 8–16 weeks.
- **Validator:** now requires exactly one result, with regressions for empty and two-result bodies.
- **Re-verified independently:** build, test (932 conformance checks), drift, wasmspec and lnsym all pass.

## 2026-10-30: NormalDomain discharged, fill at V8 parity (lemma-spike 5dff9f0)

- NormalDomain: finite prefix-invariant checker (`DomainCheck.checkDomain`) proved sound once (`DomainCheck.sound`), evaluated per artifact. All 6 bodies + 6 whole functions now have LNSym-composed acceptance with no domain premise; `unchecked_load_rejected` for every certificate. Per-artifact, not a universal compileB theorem.
- Speed: direct local operands, checked-store/discarded-reload fusion, direct local loop comparisons, all inside gate_compiler; no new AArch64 forms, no Spec change. fill 24 → 13 instr/iter; Node 24 rerun 0.644 → 0.362 ns/iter vs V8 0.356 (1.86× → 1.02×). 7 of the 11 saved instructions come from the fusion, a pattern specific to the fixture.
- Independently rerun: build, test, drift, wasmspec, lnsym all pass; 452 concrete theorem audits, standard axioms only. Lock root unchanged (aaea4081…).
