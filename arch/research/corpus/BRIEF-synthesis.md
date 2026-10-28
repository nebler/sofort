# Brief, phase 2: cross-corpus synthesis and deep prior-art research (2026-10-28)

## Context
Phase 1 agents read all 98 videos (85 in `arch/research/corpus/transcripts/`, 13 Cloudflare Connect talks in
`arch/research/connect26/transcripts/`). They wrote exhaustive ledgers of predictions, wishes, pain, hand-rolled tools,
limits, open questions, disagreements, roadmap statements and practices: `arch/research/corpus/extract/E*.md`.
The Connect talks were already mined in `arch/research/connect26/0[1-5]-*.md`; treat those as five more ledgers.

**The builder's instruction: find gaps and projects no matter how small or ambiguous.** The builder wants breadth.
Keep small, weird and uncertain ideas, and rank them honestly instead of discarding them.

Background:
- `arch/research/RESEARCH-SUMMARY.md` (§11 kill list, §12 rules);
- `arch/research/stack/SUMMARY.md`;
- `arch/research/connect26/SUMMARY.md`.

Do not re-pitch killed ideas as new. Where a transcript gives new evidence that a killed idea is alive again, say so
explicitly.

The builder's criteria (score 1–5 each):
1. cool;
2. Cloudflare/Vercel/TypeScript adjacent;
3. fills a real gap;
4. value;
5. survives better models;
6. not GrowOS.

The builder is an individual doing an open-source side project. Small is fine.

## Your task (your theme is in your task message)
1. **Read every ledger** (`extract/E*.md` and `connect26/0[1-5]-*.md`) and collect *every* signal related to your theme.
   Go back to the transcript lines when a ledger row is thin.
2. **Cluster them.** For each cluster, list the signals, with video #, timestamp, speaker and quote. Count how many
   *independent* speakers and channels raised it. **Convergence across unrelated speakers is the strongest evidence.**
3. **Deep prior-art research per cluster:** GitHub, npm, product changelogs, blogs, HN and X, dated 2026. Classify each
   as Open, Being built (who), Shipped (who) or Roadmap (who). Name the closest thing and what it lacks.
4. **Projects, every size:**
   - **Big:** a side project worth weeks.
   - **Small:** a weekend tool, a CLI, a skill, a library.
   - **Tiny:** an upstream PR, a benchmark, a blog post with data, a dataset.
   - **Ambiguous:** a direction with no clear shape yet. Say what would resolve it.

   For each project give:
   - the source quotes;
   - one sentence;
   - a 30-second demo;
   - the closest prior art (links);
   - who benefits;
   - why the platform owner wouldn't simply do it;
   - the first step;
   - a kill test;
   - the 6 scores.
5. **Predictions board:** every forward-looking claim in your theme, by whom, and what would have to be built if it
   came true. This is where a GrowOS-like seed would hide: someone predicts X will fall, and nobody is building X.
6. **End with:** a ranked table of all your projects, your top 3, the most surprising signal, and a 5-line TL;DR.

## Output
Write ONLY `arch/research/corpus/synthesis/SXX-<theme>.md` (the name is in your task). No other edits, no commits.
Labels:
- **Q**: quoted;
- **F**: sourced;
- **I**: inference;
- **E**: estimate.

Never write "first" or "unhackable". Use neutral wording for isolation/security topics.
