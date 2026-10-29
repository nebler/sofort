# Brief, phase 3: the ambition round (2026-10-28)

Read first, in this order:
1. **`BRIEF-ambition.md`**: the builder's framing, the one-shot test and the ambition test. These rules govern everything.
2. **The signals that survived phases 1–2:**
   - **Human attention and judgment are the scarce queue:** S07 §5, with 13+ practitioners across 7 channels.
   - **Capability erodes human visibility and steering:** S01 (Armin hiding tool output) and S02 (an agent shimmed two
     incompatible approved designs together).
   - **People may value finished tailoring over endless malleability:** S05 (Ben, "And I'm good").
   - **Evidence commons:** E12, E13, E14, E15, E16, E18 and E19 independently propose shared, accumulating bodies of
     real-world evidence. Richard Campbell on AlphaFold: "computed the 200 million most common protein fold sets…
     published them for free. And changed medicine fundamentally."
   - **Herculean rewrites:** "why is this Fil-C and not Fil-everything that targets LLVM IR?" (E14); de Moura: "AI
     synthesizing the codes and [a proof] that the code… meets your specification" (E17).
   - **Live computational commons:** Cyrus Omar (Jane Street talk, `transcripts/p3-19-*`, 47:00–48:00): "imagine
     something like Wikipedia where the whole system is a live program being edited by thousands of humans and AIs".
   - **Physical fulfilment:** Tobi Lütke, "computers to fulfill our wishes" (E18); Stephenson's tall tower (E12).
3. **The material:**
   - all ledgers: `extract/E01–E19.md` and `../connect26/0[1-5]-*.md`;
   - all syntheses: `synthesis/S01–S07.md`, including the 1,917-row predictions board in S05;
   - the transcripts.
4. **What is already dead:** `../RESEARCH-SUMMARY.md` §11, `../stack/SUMMARY.md` and `../connect26/SUMMARY.md`.

## Your output
For your lens, produce **3–5 ideas at the top two rungs of the ambition ladder**. For each one:
1. **The seed:** practitioner quotes with video and timestamp. At least one is required; prefer several independent ones.
2. **The vision at full scale:** what the world looks like if it works.
3. **Why it was impossible before and is possible now.** If it was never impossible, it is not ambitious.
4. **One-shot test:** name the non-code value precisely, and why a model two generations better does not dissolve it.
5. **Physics and economics check:** compute, energy, cost, data availability and law. Put rough numbers on it. Kill it
   if it's physically impossible; keep it if it's merely very hard.
6. **Closest attempts, from deep prior-art research:** who tried, how far they got, why they stalled. Treat a funded
   2026 effort as competition, and name it.
7. **The first 6 weeks for one person:** what exists at the end that nobody has seen before. It must be demoable and
   must point at the full vision. TypeScript, Cloudflare, Wasm, Rust and Lean are all fine.
8. **What would kill it:** the strongest objection, and the cheapest experiment that tests it.
9. **Builder fit:** the builder is a platform engineer, strong in systems (a Rust kernel, a VMM, a TypeScript compiler,
   Cloudflare, Wasm), working alone part-time, open source. It must not be GrowOS.

Then rank your ideas and give: a ONE pick; the most crazy-but-not-impossible idea, even if you don't rank it first; and
a 5-line TL;DR.

Labels:
- **Q**: quoted;
- **F**: sourced;
- **I**: inference;
- **E**: estimate.

Never write "first" or "unhackable". Write ONLY your assigned file `arch/research/corpus/ambition/AXX-<lens>.md`. No other
edits, commits or pushes.
