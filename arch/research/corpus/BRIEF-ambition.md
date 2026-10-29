# Brief, the ambition filter: think 100–1000× bigger (2026-10-28)

## The builder's framing (verbatim intent)
> Founder mode is a bit of a trap right now. Agents made the building part so easy that everyone feels they could start
> a company, but it's 90% likely you aren't thinking big enough to actually make it now. I was considering going
> founder mode, then realised every idea I thought of would probably be one-shottable by the next wave of SOTA models
> (they were, when Fable came out). My priors were still tuned too hard to a pre-AGI world. Whatever you're working
> on, it will probably be 2–5× less exciting when the next model drops (at least). So work on things with
> 100–1000× the ambition: the potentially batshit-crazy, impossible ideas.

Evidence from the corpus that this is real: in Cloudflare Connect talk 13, Dillon Mulroy tried agents weekly for months
on a migration that "none of them could get… done"; then "fable 51 came out and basically one shot it".

## What this changes
Ten earlier rounds converged on small, checkable tools: "witnesses", rehearsals and conformance fixtures. They are
honest, but most of them fail this filter. Their code is exactly what the next model writes in an afternoon.

**Every idea must now pass two tests.**

### Test 1: the one-shot test
"If a model one or two generations better than Claude Fable 5.1 / GPT-6.1 were given this idea in one prompt, could it
build a working version?" If yes, the code is not the value. The idea survives only if its value lies in something a
model cannot produce from a prompt:
- data or observations that do not exist yet;
- the physical world;
- trust, adoption or a network of participants;
- scarce compute or capital;
- new science or mathematics;
- a long-running process that accumulates;
- authority, permission or coordination between parties;
- taste that only shows up through use.

Say which one, and why a better model does not dissolve it.

### Test 2: the ambition test
Is this a 100–1000× idea? Would a sober engineer call it impossible, crazy or "not for one person", but not physically
impossible? Use the scale ladder: tool → product → category → infrastructure for a field → changes what a field can
do at all. Aim for the top two rungs. Then shrink it to the smallest first step one person can take in weeks. That
step must already show something nobody has seen.

## Re-tune the priors
Assume these, then ask what becomes possible:
- writing code is nearly free and superhumanly fast;
- models are much better every 6–12 months;
- agents run for days, in the millions.

Questions to ask:
- What was impossible only because it needed too many engineer-years? Examples: rewrite or verify an entire
  ecosystem, port all of science's software, formalise a field's mathematics, build a world model of a city.
- What becomes the bottleneck instead: physical data, compute, energy, verification, trust, human attention,
  coordination, law?
- What would someone with 10,000 tireless senior engineers attempt? What would they attempt with 1,000,000?
- Which "science fiction" from these videos is one model generation away? Sunil Pai asked builders to "build science
  fiction" and "be original" (Latent Space #49).

## Ground it in the corpus
Use the transcripts and phase-1/2 outputs as evidence and inspiration:
- `arch/research/corpus/`, `arch/research/connect26/`;
- `arch/research/corpus/synthesis/` when present.

Every idea must cite at least one practitioner signal: a prediction, wish or pain. An idea that no practitioner
gestures at is a desk idea, and those failed in ten rounds. Still run prior-art searches: big ideas also get taken.
Name the closest attempt and how far it got.
