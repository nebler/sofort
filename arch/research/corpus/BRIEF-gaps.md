# Brief, round 14: filling the gaps (2026-10-29)

## Why
This round fills holes in the research's coverage. It is not about developing the existing top ideas; other threads do
that. A gap audit found the following:
- **Sources:** 165 transcripts, nearly all from one community (AI tooling, web, TypeScript). There are no papers, no
  issue trackers, and almost no PL-research, systems, security, hardware, graphics or games talks.
- **Areas:** none of the earlier rounds covered defensive security, networking and protocols, or graphics/GPU.
- **Methods:** the research never searched "inverse" from existing oracles, and never re-ran the ideas killed in rounds
  1–10 through the final filter.

## The filter (from round 13, unchanged)
Read `BRIEF-tailwind.md` for the full version. In short:
1. **Model tailwind:** the idea gets better with each model release, and the next model doesn't eat it.
2. **One-shot test:** a model 1–2 generations ahead can't produce the value from a single prompt.
3. **About 10× ambition.**
4. **Solo-buildable.**
5. **Clear value; no users needed.**
6. **No Python.**
7. **Not taken, not GrowOS.**

The shape that worked:

> missing capability → an agent grows it → an oracle the agent cannot edit checks it → a ratchet keeps it, and it runs
> without a model.

GrowOS is a kernel grown one syscall at a time.

## Don't re-pitch
- The round-13 ideas in `tailwind/` (T01–T08, listed in `tailwind/SUMMARY.md`).
- The rejected list in `BRIEF-tailwind.md`.
- The kill list in `../RESEARCH-SUMMARY.md` §11.

If you find new evidence about any of these, note it in one line and move on.

## Rules for every agent
- **Write ONLY your assigned file** under `arch/research/corpus/gaps/`. No other edits, no commits.
- **Sources:** cite every claim with a URL, or with a transcript file and timestamp. Run real prior-art searches dated 2026.
- **Labels:**
  - **Q**: quoted;
  - **F**: sourced;
  - **I**: inference;
  - **E**: estimate.
- **Wording:**
  - never write "first" or "unhackable";
  - for security, isolation and malware topics, use neutral, defensive wording;
  - no exploit development, only defence, detection, verification and hardening.
- **Write for the builder.** He watches a lot of YouTube and has never read papers. When citing a paper, explain in
  2–3 plain sentences what it did and why it matters.
- **Format:** end with a ranked table and a 3-line TL;DR. Quality over volume.

For idea-producing tasks, give each idea:
1. **Name and one sentence.**
2. **The seed:** a quote, paper or issue, with its source.
3. **What grows, and its oracle.**
4. **Tailwind**, and why the next model doesn't eat it.
5. **The 6-week version and its demo.**
6. **Prior art, and what's left.**
7. **The kill test.**

Rate each idea 1–5 on:
- **Tail:** model tailwind;
- **Cool;**
- **Value;**
- **Open:** how untaken it is;
- **Solo:** feasibility for one person;
- **Demo.**
