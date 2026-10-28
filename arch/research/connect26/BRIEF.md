# Brief: mining Cloudflare Connect 2026 talks for openings (2026-10-28)

## Why this method
GrowOS, the builder's one original idea, came from a podcast, not from a web search. In Next Token Ep 07 (12 Oct 2026) a
practitioner said: "we are working our way through things that otherwise would take too much time or required expertise,
and I think the next one that's going to fall is unikernels… a kernel and a computer that's built for purpose, almost just in
time". Nobody was building it, so the builder did. Ten rounds of desk research since then mostly found ideas that were
already taken: the web shows what is *built*, while talks reveal what practitioners *predict, want, and struggle with*
before anyone ships it.

Your job is to mine talk transcripts for those signals, then check each one against what exists.

## Inputs
Transcripts in `arch/research/connect26/transcripts/` (index: `arch/research/connect26/README.md`). They are YouTube
auto-captions grouped per minute (`[mm:00]`): expect garbled names and jargon. Fix obvious caption errors in your quotes and
mark corrections with [brackets]. Read your assigned transcripts **in full**, every line.

Background (skim, do not re-pitch killed ideas): `arch/research/RESEARCH-SUMMARY.md` §0, §11 (kill list), §12 (rules),
and `arch/research/stack/SUMMARY.md` §1.

## Step 1 — Extract every signal
For each talk, list every instance of:
- **Prediction**: "the next thing will be…", "in a year…", "eventually everyone will…".
- **Wish / gap**: "I wish…", "nobody has…", "we still don't have…", "the missing piece is…".
- **Pain**: a complaint, failure, outage, cost, limit or mistake (TELUS literally lists 12 mistakes).
- **Hand-rolled**: "we had to build X ourselves", "we wrote our own…", a workaround or internal tool. These are the
  strongest signals: a company paid to build something that does not exist as a product.
- **Limit**: a platform limit or a "you can't do X yet" (Workers, DOs, D1, R2, Containers, Workers AI, etc.).
- **Roadmap**: Cloudflare saying what it is building or will ship. **This marks the area as taken for an outsider.**

For each: talk #, timestamp, speaker role (Cloudflare employee or customer, and which company), the quote (short,
verbatim from the captions), and one line of what it means. Be exhaustive; a long list is expected.

## Step 2 — Check each signal that could become a project
Search GitHub, npm, product docs and changelogs, Cloudflare's blog and changelog, HN and X for whether someone ships it or
is building it. Classify each as **Open**, **Being built** (name who), **Shipped** (name who) or **Cloudflare roadmap**.
Note when several talks independently raise the same pain; that convergence is the most valuable signal.

## Step 3 — Candidates
Turn the Open signals into 3–6 project candidates. For each:
- the source quote(s) with timestamps;
- one sentence;
- a 30-second demo;
- the closest prior art, with links;
- who benefits, and evidence beyond the talk;
- why Cloudflare would not simply build it, or would happily adopt it;
- a 2–3-week first version;
- a 1–2-day kill test.

Score each 1–5 on the builder's criteria:
1. cool;
2. Cloudflare/Vercel/TypeScript adjacent;
3. fills a real gap;
4. value;
5. survives better models;
6. not GrowOS.

## Output
Write ONLY your assigned file, `arch/research/connect26/NN-<name>.md`, with:
1. per-talk signal tables;
2. checked signals with classification and links;
3. the candidates;
4. your ONE pick;
5. a 5-line TL;DR.

Label claims **Q** (quoted from the talk), **F** (sourced), **I** (inference), **E** (estimate). No other edits, no commits,
no push. Scratch work goes in `/tmp/connect26-<name>/`; delete it at the end. Use neutral wording for isolation/security
topics. Never write "first" or "unhackable".
