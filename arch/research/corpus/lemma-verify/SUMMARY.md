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
