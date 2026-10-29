# Brief: verify the Lemma spike (2026-10-29)

The spike is at `/Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/lemma-spike/`. Its `README.md`
is the claim sheet. It says that real `.wasm` fixtures:
- compile through a Lean-checked model compiler to AArch64 bytes;
- run natively on Apple silicon;
- are called from unmodified workerd.

It reports these numbers:
- 460 native-vs-V8 comparisons, 11 Pulley interpreter checks and 8 workerd endpoint checks all pass;
- a mutant bounds check is rejected by the model proof;
- a Lean byte bridge certifies six linked bodies and rejects five corruptions;
- theorems depend only on `propext`, `Classical.choice` and `Quot.sound`;
- native execution is about 2–3× slower than V8.

Context for why this matters:
- `../deepdive/SUMMARY.md`;
- `../deepdive/D3-lemma-gaps.md`, which covers clifv, Cajal's Tau and LNSym;
- `../deepdive/D4-lemma-value.md`.

## Rules
- **Do not edit the original spike directory.** First copy it into your own scratch directory:
  `cp -R …/lemma-spike /tmp/lemma-verify-<your id>/`. Then build, run and mutate only inside the copy. Other agents are
  working in parallel.
- Be adversarial. The goal is to find where the claims are overstated, vacuous or wrong, not to confirm them. If a
  claim holds, say so plainly, with the command and output that show it.
- No Python. Use Lean, TypeScript/JS, C, shell or Rust.
- Write ONLY your report, `/Users/noah/code/sofort/arch/research/corpus/lemma-verify/<file>.md`. No commits. Do not
  touch other files in the repo.
- End with a verdict table, one row per claim you checked, marked **Holds / Overstated / Wrong / Unverified**, with the
  evidence for each. Then give a 5-line TL;DR.
