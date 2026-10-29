# Brief, phase 1: extract every gap from the transcripts (2026-10-28)

## Why
GrowOS, the builder's one original idea, came from a podcast. In Next Token Ep 07 a host said: "the next one that's going
to fall is unikernels… a kernel and a computer that's built for purpose, almost just in time". Nobody was building it.
Ten desk-research rounds since then mostly found ideas that were already taken. Long-form conversations reveal what
practitioners predict, want and struggle with *before* anyone ships it.

The corpus is 98 videos: podcasts (Next Token, Latent Space, Pragmatic Engineer, Syntax, Nerd Snipe, Fragmented, Amp's
Raising an Agent, State of Agentic Coding), conference talks (AI Engineer, Cloudflare Connect, ModCon, CNCF) and
creator videos (Theo, Ben Davis). Your share is listed in your task.

**The builder's instruction: find gaps and projects no matter how small or ambiguous.** Do not prune in this phase.
A half-sentence complaint, a joke, a passing "someone should build…" or an unanswered question all count.

## Inputs
- Your transcripts are in `arch/research/corpus/transcripts/`. They are YouTube auto-captions grouped per minute
  (`[mm:00]`; long videos use `[hh:mm:00]`), so expect garbled names. Fix obvious caption errors in brackets.
- **Read every line of every assigned transcript.** Skimming defeats the purpose.
- Background, to skim:
  - `arch/research/RESEARCH-SUMMARY.md` §0, §11 (kill list) and §12 (rules);
  - `arch/research/stack/SUMMARY.md`;
  - `arch/research/connect26/SUMMARY.md`.

## What to extract (one row each, exhaustive)
| Type | Examples |
|---|---|
| **Prediction** | "next thing to fall", "in a year", "eventually everyone" |
| **Wish / gap** | "I wish", "nobody has", "the missing piece", "someone should build" |
| **Pain** | complaint, failure, cost, incident, frustration, a workflow they hate |
| **Hand-rolled** | "we built our own", internal tool, script, workaround. **Strongest signal.** |
| **Limit** | "you can't do X yet", model/tool/platform limits |
| **Open question** | something the speakers debate and do not resolve |
| **Disagreement** | two speakers or two videos contradict each other |
| **Roadmap** | a company saying what it will ship (marks that ground as taken) |
| **Practice** | a concrete technique they use daily that could be packaged as a tool |

Columns:
1. video #;
2. timestamp;
3. speaker and their role or company;
4. type;
5. a short verbatim quote;
6. one line on what it implies;
7. **a candidate project**, however small, or "—".

## Then, per video
- **3-line digest:** who is speaking, the thesis, and the most surprising claim.

## Then, for your whole share
- **Recurring themes:** pains or wishes raised in two or more of your videos, with citations.
- **Quick prior-art check on your top 15 candidate projects:** one search each. Mark each as Open, Being built (who),
  Shipped (who), or Unclear. Phase 2 does the deep checks; here you are triaging.
- **Your 5 most interesting candidates.** "Interesting" means surprising, voiced by a practitioner, and not in the kill
  list. Give one paragraph each.

## Output
Write ONLY `arch/research/corpus/extract/EXX.md` (the exact name is in your task). No other edits, no commits, no push.
Labels:
- **Q**: quoted from a transcript;
- **F**: sourced fact;
- **I**: inference.

Use neutral wording for isolation/security topics. Long output is expected; aim for completeness over polish.

## Addendum for playlist 3 (2026-10-28): the ambition lens
Also read `arch/research/corpus/BRIEF-ambition.md`. In addition to the types above, tag:
- **Ambition**: any statement of a very large, crazy or "impossible" possibility. This includes "imagine if…", "one day
  we could…", "nobody would attempt…", "this used to take 100 engineer-years", and science-fiction framing.
- **Bottleneck**: what a speaker says remains hard when code is free. Examples: data, the physical world, trust,
  verification, compute, coordination, taste.

For each of your top 5 candidates, add one line for the one-shot test ("could a next-generation model build this from
one prompt? If yes, where is the non-code value?") and one line for the ambition rung (tool, product, category,
field infrastructure, or field-changing).
