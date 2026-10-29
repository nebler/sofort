# T03 — Creative, games, worlds and media: what models can grow inside a world

**2026-10-29. Read against [BRIEF-tailwind](../BRIEF-tailwind.md).**
**Labels:** **Q** = transcript quotation, checked against the transcript line; **F** = externally sourced fact (linked);
**I** = inference or proposal; **E** = estimate. Timestamps are caption minute buckets. Nothing below has been built.
No Python anywhere: Rust, TypeScript and Wasm.

**I — Recommendation:** build **GrowWorld**, a simulated world whose laws are grown by agents when play reaches something the
world doesn't handle. A law is promoted only if every session ever recorded still replays, and each new model can
compress the laws without changing that history.
- **What's taken:** generating game content on demand (Infinite Craft, Princeton's AI Alchemy, Meshy, Roblox 4D, Moonlake).
- **What's open:** *keeping* what gets generated under a check the generator can't pass by itself.
- **Runners-up:** **Lockstep**, clean-room clones of classic game mechanics verified frame for frame, and **Glitch Frontier**,
  machines that find new tricks in old games, each proven by a replay file.

**What I read.**
- **Corpus:** every game, world, media and toy row in E01–E19, the S05 board, S06, A01 and A09; the kill list
  (`../../RESEARCH-SUMMARY.md` §11) and `../SUMMARY.md`.
- **Transcripts:** a keyword scan of all 165 transcripts for game, world and media terms and for "would fall", "just in
  time", "on the fly" and "imagine if"; then the full passages around every hit worth using (16 videos, keyed below).
- **Prior art:** searches dated 2026-10-29 (GitHub, arXiv, product pages, press, blogs).
- **Checks:** 52 quoted strings were checked by a script against their transcript lines. One spans a minute boundary and
  is cited as a range.

**Transcript key.** Captions don't tag speakers. Where a turn is ambiguous, I say so.

| ID | File | Speakers |
|---|---|---|
| V01 | [`01-theo-t3-gg-how-to-give-claude-unlimited-usage.txt`](../transcripts/01-theo-t3-gg-how-to-give-claude-unlimited-usage.txt) | Theo Browne |
| V05 | [`05-fragmented-…-understanding-pi-durable-with-mari.txt`](../transcripts/05-fragmented-ai-developer-podcast-312-understanding-pi-durable-with-mari.txt) | Mario Zechner and Armin Ronacher (Pi), host; turns untagged |
| V09 | [`09-a-life-engineered-what-senior-engineers-are-actually-doing-about-ai.txt`](../transcripts/09-a-life-engineered-what-senior-engineers-are-actually-doing-about-ai.txt) | Steve (host), Demetri Spanos |
| V14 | [`14-nerd-snipe-we-can-t-trust-gemini-4.txt`](../transcripts/14-nerd-snipe-we-can-t-trust-gemini-4.txt) | Theo Browne, Ben Davis |
| V16 | [`16-nerd-snipe-opus-5-5-grok-4-7-are-exactly-why-post-training-matters.txt`](../transcripts/16-nerd-snipe-opus-5-5-grok-4-7-are-exactly-why-post-training-matters.txt) | Theo Browne, Ben Davis |
| V28 | [`28-modular-funding-the-ai-stack-modcon-2026-panel.txt`](../transcripts/28-modular-funding-the-ai-stack-modcon-2026-panel.txt) | ModCon funding panel (E06: Quentin) |
| V52 | [`52-latent-space-exo-harnesses-should-see-their-own-code-and-logs-alex-kre.txt`](../transcripts/52-latent-space-exo-harnesses-should-see-their-own-code-and-logs-alex-kre.txt) | Alex Krentsel |
| V80 | [`80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt`](../transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt) | Armin Ronacher, Geoff, Ben |
| p3-01 | [`p3-01-core-memory-podcast-neal-stephenson-on-ai-swords-and-blue-origin.txt`](../transcripts/p3-01-core-memory-podcast-neal-stephenson-on-ai-swords-and-blue-origin.txt) | Neal Stephenson, Ashley Vance |
| p3-19 | [`p3-19-jane-street-trustworthy-human-ai-collaboration-in-a-live-type-theoreti.txt`](../transcripts/p3-19-jane-street-trustworthy-human-ai-collaboration-in-a-live-type-theoreti.txt) | Cyrus Omar |
| p3-21 | [`p3-21-software-should-work-put-state-in-the-right-place-delaney-gillilan-ssw.txt`](../transcripts/p3-21-software-should-work-put-state-in-the-right-place-delaney-gillilan-ssw.txt) | Delaney Gillilan |
| p3-32 | [`p3-32-ndc-conferences-keynote-after-the-ai-hype-what-s-real-and-what-s-next-.txt`](../transcripts/p3-32-ndc-conferences-keynote-after-the-ai-hype-what-s-real-and-what-s-next-.txt) | Richard Campbell |
| p3-37 | [`p3-37-software-unscripted-podcast-jonathan-blow-on-programming-language-desi.txt`](../transcripts/p3-37-software-unscripted-podcast-jonathan-blow-on-programming-language-desi.txt) | Jonathan Blow, Richard Feldman |
| p3-45 | [`p3-45-ryan-peterman-creator-of-lean-handwritten-math-will-change-dramaticall.txt`](../transcripts/p3-45-ryan-peterman-creator-of-lean-handwritten-math-will-change-dramaticall.txt) | Leonardo de Moura |
| p3-65 | [`p3-65-vercel-the-third-customer-a-fireside-with-tobi-l-tke-and-guillermo-rau.txt`](../transcripts/p3-65-vercel-the-third-customer-a-fireside-with-tobi-l-tke-and-guillermo-rau.txt) | Tobi Lütke, Guillermo Rauch |
| C07 | [`07-generative-media-s-breakthrough-moment-insights-from-runway.txt`](../../connect26/transcripts/07-generative-media-s-breakthrough-moment-insights-from-runway.txt) | Anthony, Runway's CPO |

---

## 1. Two findings that shape everything below

### 1.1 The corpus's games prediction came true this month, and is now taken

- **Q — Nerd Snipe, V14 0:45:00–0:46:00 (turn untagged):** "There's a lot of things that we just haven't thrown comput yet
  that if you threw compute at it probably would fall." Then: "the games world is really starting to go through this
  reckoning of everything getting decompiled and rebuilt and modded to insane degrees."
- **Q — Theo Browne, V01 07:00–08:00,** on a project to rewrite Skate 3 "line by line from the decomp": "This type of thing
  is actually relatively easy to hill climb."
- **F — It happened, fast:**
  - **An unnamed FPS:** Maurice Heumann's agents decompiled it to 99% of functions present and 83% byte-exact, for an
    estimated 600–700B tokens. A byte-comparison script, hash-checked in CI so agents can't edit it, gated every change.
    The code won't be shared ([momo5502, 2026-10-09](https://momo5502.com/posts/2026-10-09-game-decompilation/)).
  - **A verified list as of 2026-10-11:** Melee is at 100% (19,828 functions) and Snowboard Kids 2 at 100% (3,013).
    SM64 DS is 99.9% matched but only 31.5% readable ([capitalandcompute](https://capitalandcompute.net/blog/which-games-has-ai-decompiled/)).
  - **Ports and takedowns:** press reports "hundreds" of AI-rebuilt browser ports in the two weeks after Opus 5.5
    (22 Sep). Then came an Activision DMCA, an alleged Bethesda cease-and-desist and a partial takedown of an SM64 browser
    port ([summary of Kotaku and others](https://pasqualepillitteri.it/en/news/22405/claude-opus-5-5-decompiles-games-browser-ports)).
    The model attribution is the press's, not a measurement.
  - **Community pushback:** decomp.wtf, a general agentic matching-decompilation tool, was archived on 2026-10-15
    because the community "is against AI decompiling like this" ([GitHub](https://github.com/i12bp8/decomp.wtf)).
    Zelda64Recomp and N64Recomp reject generative AI (capitalandcompute).
- **F — The tailwind mechanism, measured:** Snowboard Kids 2's matching decomp went from 20% to 25% between 3 Sep and
  17 Nov 2025. It then reached 45% by 2 Dec, after a switch to Opus 4.5 in headless Claude Code
  ([Willison](https://simonwillison.net/2025/Dec/6/one-shot-decompilation/)). Same oracle, newer model, faster growth.
- **I — So:** don't build an agentic decompiler. The sibling T02 report reaches the same verdict. The wave leaves two
  things open, which feed ideas 2 and 3:
  - rebuilding behaviour **without the code**: legally cleaner, and nobody does it frame-exact;
  - using the now-public source to **discover** things nobody knew.

### 1.2 Generating on demand is everywhere; keeping what's generated is nowhere

- **F:** On-demand generation in games is taken by many teams: Infinite Craft's cached combinations, Princeton's AI
  Alchemy (a missing reaction goes to the LLM and the outcome is cached), Meshy's weapons built from atomic mechanics,
  Roblox 4D schemas and Moonlake's prompt-to-world engine. Details and links are in idea 1.
- **F:** None of them describes a check that new content stays compatible with everything generated before. The July
  2026 survey of AI-native games lists "turning temporary generation into durable game state" as a direction, and says
  such games "should therefore test extended play sessions, adversarial player behavior, and changes across model
  versions" ([arXiv 2607.00527](https://arxiv.org/html/2607.00527v2)).
- **I:** That is the GrowOS gap in this area: grown just in time, then *checked and kept*. Idea 1 is built around it.

---

## 2. The ideas

### Idea 1 — GrowWorld: a world that grows its own physics on demand, and never forgets

**I — One sentence:** a 2D simulated world (falling sand plus creatures: Noita's physics with Dwarf Fortress's ambitions)
in which every interaction the world doesn't yet understand becomes a work item. An agent writes the missing law in a
small typed law language, and the law is kept only if every session ever recorded still replays.

#### The seed

- **Q — Ben Davis, V14 0:59:00:** "game design is a great bar for this … It's not capable of making something coherent and
  nice to actually experience. You still need that human in the loop to push it down the right paths".
- **Q — Ben Davis, V14 1:01:00:** "decisions that can't be verified with some hard verifier function. And you can put a
  lot of things into the shape of something with a verification function".
- **Q — Nerd Snipe host (turn untagged), V16 1:53:00:** "And now we have the magical wish machine that you can just tell to
  go make something. It'll just do it."
- **Q — Tobi Lütke, p3-65 12:00:** "I think it's just computers to fulfill our wishes."
- **Q — Guillermo Rauch, p3-65 10:00:** "Do you foresee a world of just-in-time hardware, just-in-time shopping?" Both
  speakers' context is physical goods.
- **Q — Steve (host) relaying Steve Yegge, V09 1:02:00–1:03:00:** Yegge triaged feature requests for the game he has worked
  on for 20 years by "whether he would get to them before he died or not". With agents, "we can have everything that I
  ever wanted for this game." The captions read "Wifren" for Wyvern and "Gathertown" for Gas Town.
- **Q — Cyrus Omar, p3-19 0:49:00:** "world models that are live programs, not just databases".
- **Q — Cyrus Omar, p3-19 0:47:00:** if an edit "causes a a syntax error or a type error, it doesn't bring down the
  entire commons".
- **I — Read together:**
  - the wish is "anything I try works";
  - the obstacle is that design has no verifier;
  - the GrowOS move is to give world-building a verifier's shape: a missing law is a missing syscall.
  GrowOS's own seed, as quoted in the brief, is "a kernel and a computer that's built for purpose, almost just in time".
  This is not an OS: the laws are a world's physics, not system services.

#### What grows, and what the builder designs

**I:** the models write laws. The builder designs five things the models work inside.

1. **A deterministic substrate.** Integer and fixed-point state, a seeded RNG, a fixed tick and a canonical iteration order.
   - **Q — Jonathan Blow, p3-37 0:32:00–0:33:00,** on hash tables keyed by "the value of the pointer like as the key":
     "I have problems in my games where I would like this to be deterministic but it isn't".
   - **Q — Delaney Gillilan, p3-21 24:00,** on rollback netcode: "it only works if you have a fully deterministic game
     loop. So you have to have a perfect system and perfect state and then be able to replay the events."
2. **A law language.** This is the most interesting design work, and it is compiler work.
   - **Shape:** a law is a local pattern → effect rule with declared reads, writes and radius.
   - **Conservation by type:** mass, heat and charge are *linear*. A law may move them, or convert them at ratios the
     constitution declares. The type checker rejects any law that creates or drops them. Sources and sinks (sun, void)
     exist only in the constitution, with budgets.
   - **Isolation:** no clock, no I/O and a fuel limit. Laws compile to Wasm and run in two independent runtimes.
   - **No overlap:** a new law's pattern must be disjoint from every existing law's pattern, checked statically.
3. **Demand: the world's ENOSYS.** The engine logs each *unhandled contact*, with a savestate. A contact is unhandled
   when two components meet and no law covers them, or when a creature tries a verb on a target nothing handles.
   - Pairwise contacts can be enumerated up front. The long tail (contexts, three-way contacts, verbs) only appears in play.
   - Explorer agents that play like curious players generate most demand; the builder's own play supplies the rest.
   - **Q — Ben Davis,** watching his agent test a dungeon it built, V16 1:39:00: "It would be hitting switches. It would be
     testing things, making sure all the mechanics worked".
4. **The gate,** kept outside the agents' write access. **F:** Heumann hash-checks his comparison script in CI for the same
   reason (§1.1). A candidate law must pass:
   - (a) the type and effect check, so conservation holds by construction;
   - (b) byte-identical results in both runtimes;
   - (c) **non-interference replay**: every recorded session that contains the law's pattern replays byte-identically up
     to the tick where the law begins to fire, and the law never fires on a contact another law already handles;
   - (d) invariants on fuzzed worlds: bounded populations and energy, no runaway loops;
   - (e) a per-tick cost budget;
   - (f) reachability: declared goals stay reachable from recorded savestates. This catches the failure in **Q — V14
     0:08:00:** "you'll end up in a broken state where you can't recover the game because all of the food is stuck on the
     ground and the fish can't eat it.";
   - (g) an acceptance scenario, written by a separate agent before the law exists and then frozen;
   - (h) taste: a daily digest of the most-fired new laws, which the builder can veto. Each veto becomes a precedent test.
5. **The canon: what's kept.**
   - **Contents:** laws with provenance (which contact, which session, which model), sessions (seed, inputs,
     checkpoints), precedents and the constitution.
   - **Amendments:** changing a law that already fires needs the builder's approval, and the gate shows exactly which
     sessions change.
   - **Compression:** a law that replaces k laws is accepted only if every affected session, and a fuzz battery, run
     identically under the old and new law sets.
   - **Why:** **Q — Theo Browne, V01 07:00:** "Some recent change screwed up the inward heel flip animation." The canon
     exists so that can't happen silently.

- **I — The gate stays laptop-sized.** A hole-filling law can only change sessions that hit its pattern, and the contact
  logs index exactly those sessions.
- **I — One law, sketched** (the syntax is illustrative):
  ```
  law ash_soaks_to_soil  radius 1
    when here.material == Ash && here.wetness >= 3
    convert here.mass: Ash -> Soil @ 1:1    // mass is linear: converted, never created
    move    here.heat -> above, 1           // heat is linear: moved, never lost
  ```

#### Tailwind

- **I — Rate:** the pass rate and the number of laws per dollar rise with every coding model, while the substrate stays the
  same. §1.1 shows this mechanism measured on decompilation.
- **I — Reach:** stronger models write laws weaker ones can't: pressure-driven fluids, circuits, ecologies, creatures with
  drives.
- **I — Compression:** stronger models find general laws that replace dozens of special cases while every recorded session
  still replays. The law set gets shorter and behaviour is preserved. That gives a number to measure at each model
  release: law code size per covered interaction.
- **I — Running it costs nothing:** grown laws run in a browser tab with no model.
  - **Q — Stephenson** made the same choice for his story-world project: "the generation of the pixels happens at the edge
    using um tried and true game engines" (p3-01 0:57:00).
  - Neural world models pay inference on every frame. **Q — Runway's CPO, C07 15:00:** "rather than coding you know, the
    front end of a software interface, you can have a live like interactive video".
  - **Q — V28 30:00:** "you're going to see more inference on world models than you are on language models."
- **I — World models help it rather than replace it.** A better video world model is a better *renderer* over a
  deterministic state; Moonlake already splits a logic model from a diffusion renderer (**F**, below). Genie 3 holds a
  scene for minutes (**F**, below); a canon holds it indefinitely.
- **I — When Fable 6 drops:** it gets better for free. A stronger model can make a better *snapshot* sandbox from one
  prompt. It can't produce this world's recorded history, and if it is better at worlds, it grows this one faster.

#### The one-shot test

- **I — What the next model can do:** a model two generations ahead can write the engine, the law language and a few
  hundred plausible laws in one go.
- **I — What it can't:**
  - laws for contacts nobody has listed, because the long tail only shows up in play;
  - evidence that thousands of laws coexist without changing any of thousands of recorded sessions;
  - the builder's precedents;
  - a compressed law set that still reproduces a recorded history.
- **I — The human contribution:** what conservation and locality mean in the law language, the gate, the constitution and
  its taste, and the canon that accumulates.

#### Value proposition

A sandbox where anything you try eventually works — and once it works, it works the same way forever.
- **I — No users needed:** explorer agents supply the demand. If it works, it is obviously valuable as a toy and as a
  substrate others can build on.
- **I — Ambition:** a typed language, a deterministic runtime in two implementations, a replay gate and a loop that runs
  for months. Very ambitious for one person, not impossible. Solo: no partners, community or private data.

#### The 6-week version

- **E — Weeks 1–2:** deterministic engine (Rust → Wasm, TypeScript UI), law language v0 with linear quantities, contact
  logging, a session recorder, gate v0, and 20 hand-written seed laws (gravity, sand, liquids, heat).
- **E — Weeks 3–4:** the grow loop (a scenario agent plus a law agent, headless Claude Code or Codex), explorer agents,
  nightly runs and a digest-and-veto UI.
- **E — Weeks 5–6:** a compression pass with the strongest model, an interaction-matrix map, and a "why did this happen?"
  view (every effect traces to its law and the session that demanded it). Then a write-up with numbers.
- **E — End state:**
  - 500–1,500 promoted laws, about 1,000 recorded sessions, and gate pass rates per model;
  - at least one compression;
  - about 100–300M tokens: $500–3,000 at API prices, or a pair of subscriptions;
  - the gate runs on a laptop.
- **The demo:**
  1. Drop something the world has never seen next to something else, such as a seed into warm ash after rain.
  2. A "?" appears where no law applies.
  3. About two minutes later the law exists, and a three-week-old session replays identically up to the moment it hit
     that gap.
  4. The "wait, what?": *these 40 heat laws became one, and all 1,000 recorded sessions still play out byte for byte.*

#### Prior art (F) and precisely what is left (I)

**F — Generation on demand: taken.**
- **Infinite Craft** (Neal Agarwal, 2024): an LLM decides each combination, and "by caching semantic combinations, it makes
  once-generated results stable for later play" ([survey](https://arxiv.org/html/2607.00527v2)).
- **AI Alchemy**, §3.4 of Princeton's [Web World Models](https://arxiv.org/html/2512.23676) (Dec 2025): when no reaction rule
  exists, the LLM returns a "schema-constrained reaction outcome" plus simulator parameters, which are cached. Validation
  is the schema and rate limits; the paper describes no tests and no cross-session guarantee.
- **[Sand Spoon](https://kiwijuice56.itch.io/sand-spoon)** (indie): type any element name and an OpenAI-backed server
  guesses its properties and its hot and cold reactions.
- **Meshy, [Black Box: Infinite Arsenal](https://app.cinevva.com/news/2026-03-09-meshy-labs-ai-runtime-gameplay)** (GDC 2026;
  Meshy reports $30M ARR): a "Designer Agent" "assembles atomic mechanics into playable weapons in real time", and
  "Every run produces unique gameplay". No persistence or validation is described.
- **Roblox 4D** ([open beta 2026-02-04](https://techcrunch.com/2026/02/04/robloxs-4d-creation-feature-is-now-available-in-open-beta/)):
  schemas (Car-5, Body-1) turn prompts into functional objects.
- **[Real-Time World Crafting](https://arxiv.org/abs/2510.16952)** (Wordplay at EMNLP 2025): natural language becomes a
  constrained DSL that configures an ECS at runtime, rated by an LLM judge.
- **Moonlake AI** ($28M seed;
  [open beta](https://www.enterpriseaiworld.com/Articles/News/News/Moonlake-AI-Launches-Open-Beta-for-Its-World-Modeling-Agent-173532.aspx)):
  a "Generative Game Engine" that pairs a reasoning model for causality, persistence and deterministic logic with a
  diffusion renderer. Each prompt makes a new world (secondary sources).
- **Latitude's Voyage** (press release, BusinessWire, 2026-04-21): an AI-native RPG that tracks state per world.
- **Genie 3** holds coherence for "a few minutes"
  ([bdtechtalks](https://bdtechtalks.com/2025/08/14/why-generative-world-models-arent-ready-for-real-world-applications/)).
- **Steve Yegge** (the seed's subject) runs agents on Wyvern, his 30-year-old MMO, through a closed harness (Wheelhouse):
  Fable designs, Opus implements, Fable reviews. The work so far is mostly bug fixes and quality-of-life from a designed
  backlog ([secondary](https://vanja.io/yegge-agent-city-four-claims/); his essays are at yegge.ai).

**F — The same shape in research.** Voyager (2023) kept a growing skill library, checked by game feedback
([arXiv](https://arxiv.org/abs/2305.16291)). OMNI-EPIC (ICLR 2025) keeps an archive of environments written as code
([arXiv](https://arxiv.org/abs/2405.15568)). Neither grows one shared world under a compatibility gate.

**F — Hand-built depth.** Breath of the Wild's chemistry engine is three rules over elements and materials
([GDC 2017 coverage](https://www.thumbsticks.com/gdc-17-breath-of-the-wild-science-lies)). Sandboxels has 500+ hand-authored
elements (per its GitHub topic page).

**I — What is left, precisely:**
1. laws as typed code with declared effects, not cached outputs or parameter rows;
2. a gate the generator can't pass on its own: conservation by type, two-runtime determinism, non-interference replay,
   fuzzed invariants and frozen scenarios;
3. compression under replay;
4. one world that compounds, instead of a new world per prompt.

I found (2)–(4) in no product or paper, and the survey treats durability as a direction, not a practice.

**I — Risk:** Moonlake, Meshy or Roblox add a compatibility gate. They serve creators who make many worlds; the solo asset
is one world plus its canon and gate.

#### The kill

- **Strongest objection: accretion isn't design.**
  - **Q — Ben Davis, V14 0:59:00:** "It's not capable of making something coherent and nice to actually experience."
  - **Q — Armin Ronacher, V80 1:17:00:** "what's the attention span of any one person individually to actually play any of
    these slop creations?"
  - **Q — Demetri Spanos, V09 1:03:00,** on Yegge's backlog: "Why were they in the backlog?"
  - **I:** thousands of locally sensible laws may add up to noise, and early laws may lock in bad physics.
- **Cheapest test (E — 2 weeks, $200–500):** grow 150 laws in a 64×64 world from explorer demand, then:
  - (a) measure the gate pass rate and replay stability;
  - (b) count emergent chains (causal chains of three or more laws that no scenario asked for) across 1,000 fuzz worlds;
  - (c) attempt one compression that preserves every session;
  - (d) have the strongest available model one-shot a 150-interaction sandbox, run it through the same battery, and have
    five people compare both blind.
- **Kill if:** there are no emergent chains; or the one-shot sandbox matches the grown one on both the battery and the
  blind test; or compression never preserves the canon.

---

### Idea 2 — Lockstep: clean-room clones of classic game feel, verified frame for frame

**I — One sentence:** agents watch a classic game run in an emulator (its RAM and frames, never its code) and write an
independent implementation of one mechanic. The implementation is kept only if it runs in lockstep with the original over
millions of fuzzed frames, and the kept mechanics form a library for building new games.

#### The seed

- **Q — Theo Browne, V01 16:00,** the oracle he wanted and skipped: "I was going to actually play skate one, record my
  controller inputs, and then give that as a replay value that my agents could use to rerun" … "compare how well my game
  behaves". He settled for screenshot judges.
- **Q — Theo Browne, V01 06:00,** on why feel is the hard part: "Everything is based on a flick it system".
- **Q — Theo Browne, V01 07:00–08:00:** he names a Skate 3 rewrite "line by line from the decomp to replicate all of the
  physics in Bevy" and adds: "Recreating things is quite trivial to hill climb."
- **Q — Theo Browne, V14 1:34:00–1:35:00:** Vampire Survivors' C++ port had to keep "the weird ways that JavaScript handles
  floatingoint math". New mechanics are still ported "very very tediously line by line to C++ to get as close to the
  exact same mechanics as possible".
- **Q — a Pi maintainer (Mario Zechner or Armin Ronacher; untagged), V05 0:50:00–0:51:00:** with LLMs "you can take these
  really old computers like a NES or like a Commodore 64 … you can hold it a thousand times in memory … snap through
  them at every frame".
- **Q — Alex Krentsel, V52 11:00:** while playing Pokémon, Exo "decided to try inspecting the like RAM of the game and then
  went and mapped the RAM", work that "people have reverse engineered this manually".

#### What grows, and what the builder designs

- **I — The models** map RAM, write behaviour specs and implement mechanics.
- **I — The builder designs:**
  - a deterministic emulator harness: savestate forking, RAM taps, headless runs far above real time;
  - **a clean-room wall** enforced by tool permissions. An observer agent sees RAM and frames and writes a behaviour-only
    spec with test vectors. An implementer agent sees only that spec and the divergence reports, never ROM bytes or
    disassembly;
  - an input fuzzer that reaches rare states (novelty search from savestates);
  - **the lockstep checker:** exact equality of the mapped state variables on every frame, outside the agents' reach;
  - a module interface (inputs, world queries such as collision, outputs) with the property "exact under embedding":
    rebuilt from the original level's geometry inside the new engine, the module reproduces the original trajectories.
- **I — What's kept:** a mechanic together with a certificate (frames × traces × savestates, zero divergence).

#### Tailwind

- **I:** inferring an exact update rule from observations is reasoning-bound. Each model release needs fewer
  counterexample rounds, handles longer chains (enemy AI, collision quirks) and costs less per verified mechanic. The
  output runs without a model.
- **I — Trajectory:** movement, then enemies, then whole clean-room engines.
- **I — When Fable 6 drops:** partly better for free, partly a prompt. A strong agent could clone one mechanic on demand;
  what stays is the harness, the interface and the certificate library.

#### The one-shot test

- **F — Thrust (BBC Micro, Feb 2026):** Claude's one-shot browser recreation "hadn't even got gravity working right".
  Matching needed the original's roughly 33 Hz update cadence, found by reading disassembly, and fidelity was checked
  side by side, by feel ([jamesdrandall.com](https://www.jamesdrandall.com/posts/thrust_ai_powered_software_archaeology/)).
- **I:** exact behaviour lives in observations of the original, not in model weights, especially for obscure games.
- **I — The human's part:** the observation protocol, the wall, the lockstep oracle and the interface.

#### Value proposition

The exact feel of classic games as open, reusable code, rebuilt by watching the games rather than copying them.

#### The 6-week version

- **E — Scope:** NES only; three games; 20–30 mechanics (movement, jump arcs, ladders, knockback, a few enemy patterns),
  each certified at ≥10⁷ frames.
- **E — Stack and cost:** a Rust harness, a small TypeScript "feel engine", $300–1,500 in tokens.
- **The demo:**
  1. Split screen: the original ROM and the clone, fed the same random inputs for ten minutes, with zero divergent frames.
  2. A new level where you switch between three games' movement mid-jump.
  3. The "wait, what?": nobody wrote this code from the game's code.

#### Prior art (F) and what is left (I)

- **F — The code route is crowded and contested** (§1.1). Disassembly-assisted rebuilds work: Thrust, and an SM64 movement
  port to the GBA reported as bit-exact ([list](https://reversedwithai.com/ai-game-decompilation)).
- **F — Rebuilding from behaviour works in general:** [MirrorCode](https://arxiv.org/abs/2606.30182) (Epoch AI, June 2026)
  has agents reimplement 25 programs from an execute-only binary plus documentation. Epoch reports AI "can already solve
  many" of the tasks.
- **F — Game world models built from traces are far from exact:**
  - [Mind-Studio](https://arxiv.org/abs/2606.16070) (June 2026) synthesises pygame world models of Atari games. On
    Montezuma's Revenge, next-state prediction reaches 48.7%.
  - Also VGDL rule induction ([arXiv 2602.00190](https://arxiv.org/html/2602.00190)) and Code World Models for board games
    ([arXiv 2510.04542](https://arxiv.org/abs/2510.04542)).
- **F — The human precedent:** the [Sonic Physics Guide](https://info.sonicretro.org/Sonic_Physics_Guide) documents classic
  Sonic's observable physics, engine-agnostic, built by a community over years.
- **F — The gap:** [awesome-rea](https://github.com/yibie/awesome-rea) lists 47 AI reverse-engineering projects; none
  rebuilds mechanics from black-box observation.
- **I — What is left:** frame-exact, behaviour-only, composable mechanics with certificates.

#### The kill

- **I — Strongest objection: mechanics may not be modular.** A jump depends on collision, frame rules and RNG, so a module
  may be exact only inside its original world.
- **I — Second objection:** where a decomp exists, an agent reading disassembly is faster, so the clean-room route wins
  only on legal cleanliness.
- **I — Third:** this is the rejected driver-translation shape (a reimplementation checked against traces). If that felt
  like plumbing, this may too.
- **Cheapest test (E — 1–2 weeks, under $300):** clone Super Mario Bros.' horizontal and vertical movement to lockstep.
  Then embed it in a level built from the original tile geometry plus one new tile type.
- **Kill if:** lockstep can't reach 10⁶ frames, or breaks under embedding.

---

### Idea 3 — Glitch Frontier: machines that find new tricks in old games, each proven by a replay file

**I — One sentence:** an emulator farm where agents read the now-public decompiled source and live RAM, fork savestates by
the thousand, and hunt for tricks nobody has found. Every claim is a replay file that a clean emulator checks, and the
catalog only grows.

#### The seed

- **Q — V05 0:50:00–0:51:00:** "you can hold it a thousand times in memory … snap through them at every frame".
- **Q — V52 11:00:** Exo mapped Pokémon's RAM on its own.
- **Q — V14 0:45:00:** "a lot of things that we just haven't thrown comput yet that if you threw compute at it probably
  would fall". At 0:46:00 comes the decompilation wave, which now supplies readable source.
- **Q — Richard Campbell, p3-32 45:00,** on DeepMind's Breakout agent: "it learned cut down cut out the side, and then get
  the ball in behind. Like, it was clever."
- **Q — Theo Browne, V01 04:00,** on contamination: "So, I had to privatize SkateBench so that the models couldn't climb
  against it during training."

#### What grows, and what the builder designs

- **I — A discovery** is a game build hash, a savestate, an input movie and a predicate over RAM (out of bounds, clip,
  duplication, RNG setup, sequence break), plus the time it saves inside a route.
- **I — The builder designs:**
  - a deterministic farm with savestate forking and RAM taps, in Rust or TypeScript;
  - hypothesis agents that read decomp source ("this index is never bounds-checked when…");
  - novelty-search explorers;
  - a sealed verifier that replays the movie on a clean build and checks the predicate and the frame count;
  - deduplication against the community's documented tricks;
  - a route optimizer that folds discoveries into full-run input files.

#### Tailwind

- **I:** discovery here is reasoning-bound and verification is free. Each release finds deeper tricks, and the catalog
  keeps all of them.
- **I:** undiscovered tricks can't be in training data, so the frontier doubles as an uncontaminated measure of model
  discovery: Theo's SkateBench problem, reversed.
- **I — When Fable 6 drops:** better for free. The harness is a prompt; the discoveries aren't.

#### The one-shot test

- **I:** no prompt yields a new skip in a 25-year-old game; it takes search and compute against the real binary.
- **F:** Cook et al. (EXAG at AIIDE 2025) call glitch discovery "a thorny problem for AI researchers"
  ([CEUR](https://ceur-ws.org/Vol-4090/paper1.pdf)).

#### Value proposition

Machines that find what decades of speedrunners missed, each find proven by a replay anyone can run.

#### The 6-week version

- **E — Scope:** 3–5 mid-popularity games with complete public decompilations and small speedrun communities. The October
  list has several N64 and DS titles. One machine and a public catalog; $500–2,000 in tokens.
- **The demo:** a trick missing from the game's community documentation, found overnight and packaged as a 20-second
  replay, shown next to the decompiled line that makes it possible.

#### Prior art (F) and what is left (I)

- **F — TAS is human work:** "TAS runs are not guided by AI search – they are made manually". The same paper's own
  prototypes target one PICO-8 Celeste technique (Cook et al.).
- **F — RL route-finding:** Linesight, an RL agent, reportedly found a faster route on a TrackMania track whose record had
  stood for six years ([2024 post](https://dakotamarshall.net/content/drafts/ai-the-death-of-human-discovery/); secondary).
- **F — Search finding exploits:** a 2018 evolution-strategies agent found a Q*bert scoring bug
  ([Slashdot](https://games.slashdot.org/story/18/03/01/0856216/ai-cheats-at-old-atari-games-by-finding-unknown-bugs-in-the-code)).
- **I — What is left:** LLM agents plus public decomp source plus savestate forking, producing verified, community-checkable
  discoveries. I found none.

#### The kill

- **Q — Campbell, p3-32 45:00:** "It was video games, so it wasn't important in any way."
- **I — The objection:** discoveries are fun facts more than a value proposition. A catalog of facts sits close to the
  atlases the builder rejected, and adversarial discovery is the agent-era-Jepsen shape in a playful domain.
- **F — The community may not want it:** "I do fear for speedrunning" (the 2024 post), and §1.1's rejection of AI decomps.
- **Cheapest test (E — 1 week, about $300):** one game with a complete decomp.
- **Kill if:** the farm finds nothing absent from community documentation.

---

## 3. Ranking and the pick

| # | Idea | Tailwind | One-shot | ~10× | Solo | Value | Not taken | Fit for this builder |
|---|---|---|---|---|---|---|---|---|
| 1 | **GrowWorld** | Strong: rate, reach, compression; zero runtime cost | Passes: canon, precedents, compressed history | Very ambitious, feasible | Yes | Clear to a stranger | Generation taken; keeping open | GrowOS's shape; a language and a runtime to build |
| 2 | **Lockstep** | Medium–strong; partly becomes a prompt | Passes on exactness; the library is partly a cache | Ambitious | Yes | Medium | Behaviour-only open; code route crowded | Emulators and oracles; driver-translation smell |
| 3 | **Glitch Frontier** | Strong | Passes: discoveries | Ambitious | Yes | Weak–medium | Open | Playful; atlas and Jepsen smell |

**I:** all three are Rust, TypeScript and Wasm. None needs Python, partners, private data or a community for its core
value.

**My pick: GrowWorld.** It is the only idea here where the thing that grows is a living system rather than a catalog,
and where the check is the builder's own design (a law language plus a replay gate). Every model release makes it better in
three measurable ways, and running it needs no model.

**TL;DR**
1. The corpus's games prediction ("decompiled and rebuilt and modded", V14 0:46) came true in October 2026 and is now crowded and contested: don't build there.
2. Everyone generates game content on demand; nobody *keeps* it under a check, so nothing compounds.
3. Build GrowWorld: a world whose laws are grown when play hits a gap, promoted only if every recorded session still replays, and compressed by each new model.

---

## 4. Considered and dropped

| Direction | Seed | Why dropped |
|---|---|---|
| Agentic decompilation, recompilation, ports | V14 0:46:00; V01 07:00–08:00 | Came true and is crowded; takedowns; the community rejects AI decomps (§1.1); T02 also drops it |
| New content for existing games | Ben Davis, V16 1:36:00 ("make a brand new area from scratch using existing assets"), 2:03:00 | Content, not capability; tied to someone else's IP; the next model makes better content directly |
| On-demand weapons, objects, reactions | — (prior-art driven) | Taken by Meshy, Roblox 4D, AI Alchemy, Sand Spoon and Infinite Craft; GrowWorld is the "kept" version |
| Neural world-model games | V28 30:00; C07 15:00 | Funded labs; the model is the product, so the next model replaces it |
| Participatory story worlds in public-domain settings | Stephenson, p3-01 0:55:00–1:00:00 (Dreamlands.ai at 0:58:00) | The speaker is building it; E12 marks it "Being built" |
| The Primer | Vance and Stephenson, p3-01 1:27:00 | Needs learners and teachers; Stephenson's own caution at 1:28:00 ("what teachers actually want") |
| Proof games that grow (Lean) | de Moura, p3-45 0:26:00 ("the class is more or less split"), 0:28:00 ("the AI is learning to play the game") | Perfect oracle, but this is the math and education lane (see T04); lean4game and Duke's Linear Algebra Game are hand-built |
| Malleable media tools; media agents | C07 06:00 (each frontier LLM release makes Runway's agent "better and better") | Taken (S05 P18–P20); the tailwind accrues to the vendor |
| Physical toys | Lütke, p3-65 12:00 | Close to the rejected 3D-print fit atlas |
| Playtest packets, controller-trace replay, save recaps | V16 1:37:00–1:39:00; V01 16:00 | Tool-sized and killed in earlier rounds (S05 P05/P19, S06 P19, A09); reused here as gate parts |
| Agents clearing a game's backlog | V09 1:02:00–1:03:00 | Yegge is doing it himself on Wyvern |

## 5. Evidence notes

- **Quotes:** checked by script against the transcript lines (52 strings). The Skate 3 sentence spans the 07:00/08:00
  boundary and is cited as a range. V05, V14 and V16 captions don't tag speakers; untagged turns are marked.
- **Secondary sources:** marked where used (the Kotaku-derived takedown reports, Moonlake, Yegge's Wyvern, Linesight).
  The press attributes the decompilation wave to Opus 5.5 without measuring it.
- **Estimates:** all costs, durations and law counts are estimates. Nothing has been built.
