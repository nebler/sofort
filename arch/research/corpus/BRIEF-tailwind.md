# Brief, round 13: the tailwind round (2026-10-29)

## Why this round exists
Twelve rounds, about 130 reports and 165 transcribed videos produced **no idea the builder finds cool and valuable**.
The cause was the filters, not the corpus:
- "Not one-shottable" was read as "the value must be non-code: data, people, institutions";
- "100× ambition" killed every tool and product;
- "solo" then killed the institutions that survived.

The last round's survivors were evidence commons, community stewardship, repair networks and scientific registries.
The builder rejected all of them. Also rejected as uninteresting: a package-behaviour atlas, Fil-C extended to all LLVM
languages, a browser-divergence map or executable web spec, an agent-era Jepsen, a cross-GPU numerical atlas, driver
translation with hardware traces, an executable scientific record, a rebuild-and-run preservation archive, a 3D-print fit
atlas, and a judgment compiler. **Do not re-pitch any of these, even reworded.**

## The one idea the builder did like: GrowOS (excluded, but study its shape)
GrowOS is an operating-system kernel that agents grow: when a program needs a missing syscall, an agent implements it
inside a structure the builder designed (checked, promoted, kept). The seed was one sentence in a podcast, Next Token
Ep 07: "the next one that's going to fall is unikernels… a kernel and a computer that's built for purpose, almost just
in time". Nobody was building it.

**What made it good, in the builder's words:** "it doesn't have users but it has a clear value proposition that holds
up and even gets better when the models get stronger."

**GrowOS itself and anything kernel/OS-growing is excluded.** Find other ideas with the same shape.

## The filter (all must pass)
1. **Model tailwind, the core test.** The idea gets *more* valuable each time a better model ships: better models make
   it grow faster, reach further or become more correct. It must not be something the next model eats or makes
   obsolete. Ask: "When Fable 6 / GPT-7 drops, does this project get better for free, or does it become a prompt?"
2. **One-shot test.** A model one or two generations ahead, given the idea in one prompt, cannot just produce the finished
   value. The human contribution (the structure, the check, the direction, the accumulated grown artifact) is what the
   models work *inside*. Say concretely what that is.
3. **About 10× ambition.** A sober engineer says "very ambitious for one person", not "impossible". Not a weekend tool,
   not a planet-scale institution.
4. **Solo.** One very ambitious, hard-working person can build it. No community, partners, volunteers, governance,
   private data from companies or participants required for the core value.
5. **Clear value proposition. No users needed.** It's fine if nobody uses it at first; it must be obviously valuable if
   it works.
6. **No Python.** Any other language is fine.
7. **Not taken.** Do a real prior-art search (GitHub, HN, X, arXiv, product pages, dated 2026). If a funded team is doing
   it, say so and drop it, or say precisely what is left.

## Sources (the transcripts are the main source)
GrowOS came from a practitioner's prediction. Hunt for sentences like that.
1. **`synthesis/S05-seeds.md`**: the 1,917-row predictions board. Re-read it with one question: "if this comes true,
   what structure could models grow inside, getting better with every model release?"
2. **`extract/E01–E19.md`** and **`../connect26/0[1-5]-*.md`**: about 6,500 ledger rows of predictions, wishes, pain,
   hand-rolled tools and ambition statements.
3. **The raw transcripts**: `transcripts/` (152 files) and `../connect26/transcripts/` (13 files). Grep for "next thing
   to fall", "will fall", "eventually", "just in time", "grow", "on demand", "the model writes", "imagine", "someday",
   "nobody has built". **Every idea must cite a speaker, video file and timestamp, checked against the transcript line.**
   Ideas with no practitioner seed are desk ideas; cut them.
4. Background on what's dead: `../RESEARCH-SUMMARY.md` §11 (kill list), `SUMMARY.md` and `ambition/A09-critic.md`.

## Your output
Write ONLY `arch/research/corpus/tailwind/T0N-<area>.md` (the name is in your task). No other edits, no commits.

1. **Produce 3–6 ideas in your area.** For each:
   - **Name and one sentence.**
   - **The seed:** quote(s), video file, timestamp, speaker.
   - **What grows:** what the models build, inside what structure that you design, and how it's checked.
   - **Tailwind:** why the next model makes it better, not obsolete. Be concrete.
   - **The one-shot test:** what the next model cannot produce from one prompt.
   - **The value proposition**, in one line a stranger would understand.
   - **The 6-week first version:** what exists at the end, and the demo that makes someone say "wait, what?".
   - **Prior art:** the closest attempts and what's left.
   - **The kill:** the strongest objection and the cheapest test of it.
2. **Rank them**, then give your ONE pick and a 3-line TL;DR.

Labels:
- **Q**: quoted;
- **F**: sourced;
- **I**: inference;
- **E**: estimate.

Never write "first" or "unhackable". Use neutral wording for isolation/security topics. Quality over quantity: three
ideas the builder would get excited about beat six safe ones.
