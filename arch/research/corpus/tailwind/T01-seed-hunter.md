# T01 — Seed hunter (any area): the dependency tree is the next thing to fall

Round 13 (tailwind), 2026-10-29. Assignment: ignore area boundaries, hunt the practitioners' own prediction sentences,
and turn the best ones into GrowOS-shaped ideas. **Pick: Grow-install (§3). Ranking, pick and TL;DR: §6.**

**Labels.**
- **Q**: quoted and checked against the transcript line. Caption spelling is kept; my corrections are in [brackets];
  "…" omits words without reordering them.
- **F**: sourced; the link is in the text or in the source list at the end.
- **I**: inference.
- **E**: estimate.

Timestamps are caption minute buckets. File keys: `14` means `corpus/transcripts/14-…txt`, `p3-19` means
`corpus/transcripts/p3-19-…txt`, `C02` means `connect26/transcripts/02-…txt`, and `Ep07` means
`next-token-ep07-transcript.txt`. Full file names are in Appendix B.

---

## 1. What I read, and what I did not

- **F, the S05 board.** It has 1,928 source-indexed rows. I read all 1,190 rows typed Prediction, Wish/gap or Roadmap
  (alone or mixed), quote and interpretation cells. I did **not** re-read the 738 rows typed only Open question,
  Disagreement, Pain, Practice or Limit.
- **F, playlist 3.** S05 does not cover the `p3-*` videos, so I read all 695 Prediction, Wish and Ambition rows of
  E12–E19.
- **F, raw transcripts.** I ran keyword-in-context greps over all 152 + 13 transcripts and `Ep07`. Patterns: *fall /
  would fall / next to fall*, *just in time*, *on demand*, *imagine*, *someday / eventually / N years from now*, *grow /
  self-improving / writes itself*, *nobody has built / someone should*, *decompile / reverse engineer / emulate*,
  *rewrite / port the entire*, *bespoke / purpose-built / own compiler, database or file system*, *fake / in-memory /
  twin*, *dependency / supply chain / vendor*, *Excel / spreadsheet*, *you can just build*. I then read about 30
  passages in full. Every quote below was re-read at its timestamp.
- **F, background.** RESEARCH-SUMMARY §0 and §11–13, corpus SUMMARY, the A03 outline, the A09 rows on GrowOS scope, and
  the catalogue rows on decompilation and superoptimisation.
- **F, prior art.** About 25 web searches and page reads, mostly of sources dated 2026.
- **Gaps.** Five videos have no captions (#27 and #81 of playlist 2, #41–43 of playlist 3). Speaker names come from
  captions that mark turns but not names; where that is ambiguous, I say so.

## 2. The shape I was hunting for

**Q, the GrowOS seed**, `Ep07` [00:53–00:54]: "we are working our way through things that otherwise would take too
much time or required expertise, and I think the next one that's going to fall is unikernels… a kernel and a computer
that's built for purpose, almost just in time".

**I, the parts that made GrowOS work:**
1. **Demand:** a real program hits a missing piece (ENOSYS).
2. **A small unit:** one syscall handler.
3. **A runnable reference oracle:** Linux.
4. **Promotion that resists gaming:** held-out probes and mutants.
5. **Accumulation:** the handler is kept, and coverage is the metric (81%).

The same thesis appears all over the corpus in other words:
- **Q**, Theo Browne, `14` [1:37:00]: "These things were tedious to the point of not being worth it just months ago.
  Suddenly, we have the ultimate tedium machines that don't care that they're being forced to do that work."
- **Q**, a Nerd Snipe host in the turn after Theo (captions don't name him; Ben Davis, I), `14` [0:45:00]: "There's a
  lot of things that we just haven't thrown comput[e at] yet that if you threw compute at it probably would fall."
- **Q**, Theo, `87` [28:00]: "all software was built to be somewhat generalizable. Now, we can build software for our
  specific needs."

**I, where the "it will fall" sentences point:**

| What falls, per a practitioner | Seed | State in Oct 2026 |
|---|---|---|
| Bespoke compilers per app | Theo, `14` [1:35–1:36], `87` [28–29] | Crowded: lust, rustd, Relax, Astral's fork (§7) |
| Kernels, file systems, OSes | Theo, `14` [1:39]; Adam Jacob, S05 row V55 28:00 | Excluded by the brief |
| Games, "decompiled and rebuilt" | Nerd Snipe hosts, `14` [0:46] | Taken by agent decompilers (§7) |
| The Adobe suite | `14` [0:50]; `p3-02` [00:00]; `p3-48` [10:00] | ArtCraft, 43k stars (§7) |
| Fake versions of services | Ben Davis, `14` [1:32]; Max Kanat-Alexander, `79` [14:00] | StrongDM DTU, Pome, AgentTwin (§7) |
| Proven rewrites | de Moura, `p3-45` [0:06], [1:02–1:03] | Lean FRO's own path (§7) |
| Just-in-time hardware | Rauch and Lütke, `p3-65` [10:00–11:00] | Physical oracle (§7) |
| **Your dependencies** | Ben Davis `32` [12:00]; Latent Space host `49` [11:00]; JG `p3-35` [0:13]; e18e lead `p3-64` [5:21]; Theo `87` [28] | **Open → Idea 1** |
| **A new language's libraries** | Cyrus Omar, `p3-19` [1:02–1:03] | **Open → Idea 2** |
| **The SaaS slice you rent** | Ree, `11` [1:13–1:14]; Ryan Skidmore, `C02` [15–18] | **Partly open → Idea 3** |

**I, a calibration for the one-shot test that the corpus itself supplies.**
- An OXC core contributor (ViteConf, `p3-64` [2:21:00]) on porting the OXC printer against 50,000 tests: "to my surprise
  found that Fable had done it like completely oneshotted it." **Q**
- Theo, `88` [00:00]: "I burned $20,000 of Opus 5.5 and I got there in 2 weeks." **Q** (a complete TypeScript checker
  in Rust).
- So a single port against an existing test suite is now close to a prompt. The durable asset has to be what GrowOS
  had: demand that pulls growth, a runnable oracle, promotion rules and an accumulating artifact. The idea must not be a
  port.

---

## 3. Idea 1 — Grow-install: a package manager that grows your dependencies instead of downloading them

**One sentence.** When your code calls into lodash, semver or axios, Grow-install does not install them. It grows the
exact surface your code uses as small in-repo code, checks it against the original package running in isolation, and
keeps it in a catalog the next repo can reuse.

### The seed (Q)

- **Ben Davis**, `32` [12:00]: "I'm pretty sure I remember seeing a post from one of the effect guys that they had
  gotten effect down to zero dependencies. Everything was just custom and handwritten. … for the actual like shipped
  version of it, no dependencies because they can do all of it with AI and that's awesome."
- **Latent Space host**, interviewing Sunil Pai, `49` [11:00]: "you maybe want to encourage more slow forks because then
  you own the dependency. Right? So then you don't have the like LM issue, you don't have the Axios issue. You can just
  vendor Axios but in your own slow fork of Axios. And then now you own it."
- **Joran Dirk Greef (JG), TigerBeetle**, `p3-35` [0:13:00]: "supply chain attacks are going to be the next swing of the
  pendulum and how do we solve those?"
- **The e18e community lead** (self-introduced at [5:18:00]; James Garbutt, I), `p3-64` [5:21:00]: "one package gets
  breached, uh, they publish malware, uh, another package pulls that package and then that publishes malware and so on
  and you create a chain of this what's basically like a worm at that point." At [5:38:00]: "if you had zero
  dependencies then great".
- **Theo Browne**, `87` [28:00]: "Now, we can build software for our specific needs."
- **Jonathan Blow**, `p3-37` [1:10:00]: "I want my software to compile 10 years from now on an island when I have no
  internet." At [1:16:00]: "you can imagine a future in which there are just takedowns of these dependencies".

**F, why now.**
- Two axios versions (1.14.1 and 0.30.4) were published from a hijacked maintainer account on 2026-03-31, carrying a
  remote-access payload ([InfoQ](https://infoq.com/news/2026/04/axios-supply-chain),
  [CSA AD-2026-002](https://www.csa.gov.sg/alerts-and-advisories/advisories/ad-2026-002/)).
- The self-spreading Shai-Hulud family has been active since September 2025. Singapore's
  [CSA AD-2026-009](https://csa.gov.sg/alerts-and-advisories/advisories/ad-2026-009) (6 August 2026) covers a variant
  spreading through Keyv-related packages.
- The host's "the Axios issue" (`49` [11:00]) is the March incident (I).

### What grows, inside what structure, and how it's checked (I)

It is the GrowOS loop, one layer up:

| GrowOS | Grow-install |
|---|---|
| A program hits ENOSYS | Code calls an ungrown export: a **grow signal** carrying the call record |
| Unit: one syscall handler | Unit: one callable at the package boundary, plus the parts of its result the app actually reads |
| Oracle: Linux (`jitk-oracle`) | Oracle: the original package, run in an isolated sandbox with no network and no secrets |
| Held-out probes, mutants | Held-out recorded calls, mutants of the grown code |
| The kernel keeps the handler | The repo and the catalog keep the unit, with a behavior hash |
| 81% of programs pass | Share of the runtime dependency surface dissolved |

**The structure the builder designs:**
- **The tracer.** An ESM loader hook and a CommonJS `Module._load` wrapper put a Proxy on every export at the package
  boundary. It records calls, arguments, returns, throws and `this`. It also records which properties of returned values
  the app reads (the "used projection": if the app only reads `.version` of `semver.parse()`, only `.version` must
  match). Finally it records the builtins the package touches (fs, net, env, timers).
- **The unit model.** One boundary callable plus its used projection. Units are small and independent, so many agents can
  grow in parallel. That matters: Cyrus Omar reports a swarm building a verified JS→Wasm compiler without such units, and
  "They all just picked the lowest hanging fruit all the time… you ended up spending a lot of tokens with not a lot of
  output" (**Q**, `p3-19` [0:42:00]).
- **The grower.** An agent writes the unit in a restricted TypeScript subset: no `eval`, no `new Function`, no dynamic
  import, and fs or net only if the original surface used them. scriptc's static subset is a natural fit.
- **Promotion: six checks, all required.**
  1. Replay every recorded call.
  2. Fuzz differentially, seeded from recorded argument shapes, against the original running in an isolated VM. jitk fits
     here, because the original may itself be malicious.
  3. Pass held-out calls the agent never saw.
  4. Reach a mutation score: the checks must kill mutants of the grown code, or they are too weak to trust.
  5. Pass a static capability lint, plus regex-backtracking and prototype-write checks.
  6. Stay within a performance budget relative to the original.
- **What it keeps.** `grown/<pkg>/<unit>.ts` with provenance: package@version, the original license notice, the behavior
  hash and the check counts. A package leaves `package.json` once all its used units are grown. Otherwise it stays, so
  partial dissolution still pays, like GrowOS's 81%.
- **The catalog.** Promoted units are keyed by package, version range, unit signature and behavior hash, and reused
  across repos. It can be pre-grown from the public GitHub usage of popular packages, so it grows with no users.

### Tailwind: why the next model makes it better, not obsolete (I)

- **The frontier moves.** With today's models, utility packages dissolve: nirdep did five by hand (F, §3 prior art).
  Next come parsers, validators and HTTP clients, then framework surfaces. A fixed benchmark of real repos, scored as the
  share of runtime dependency surface grown to zero unexplained divergence within a budget, gets re-run on every model
  release. It is the same kind of number as GrowOS's pass rate.
- **The trusted base shrinks.** It is whatever cannot be dissolved yet: Node itself, native addons, TypeScript as a dev
  tool. It gets smaller each release, and the cost per unit falls.
- **Demand rises with model strength.** More AI-written code means more packages, more churn and more worm-style
  incidents (F above). More agents writing code also want a verified catalog to draw from instead of re-inventing
  unchecked helpers.
- **The next rungs need stronger models:**
  - units faster than the original (Jarred Sumner: "I was like make it faster than sharp and that's basically what I
    did", **Q**, `71` [19:00]);
  - Lean proofs of equivalence for pure units (de Moura: "It still computes the same thing. Here's the proof.", **Q**,
    `p3-45` [1:03:00]);
  - native targets through scriptc.
- **An honest caveat.** zerodep found that "specification completeness, not model capability" predicted success on
  small Python modules (F). For small utilities, then, the structure is the bottleneck, not the model. The tailwind is
  real only on the larger surfaces.

### The one-shot test (I)

A model two generations ahead writes `semver.satisfies` in one prompt. It cannot produce:
- the recorded demand of a specific repo;
- an isolated oracle that runs possibly-malicious originals;
- the held-out and mutant discipline that makes the output something you can trust;
- a catalog in which each unit has been checked against many repos' usage;
- re-checking when upstream versions change.

The rewrite is not the hard part. nirdep's 856,168 differential checks found 72 semver and 697 glob disagreements, and
some were inconsistencies inside the reference package itself (F).

### The value proposition

Delete `node_modules`: your code ships only the few hundred lines it uses from each dependency, regrown and checked
against the original, so a compromised package has no path into your build.

### The 6-week version (I/E)

| Week | What exists at the end |
|---|---|
| 1 | The tracer for Node (ESM and CommonJS), and the unit and used-projection model |
| 2 | The grow loop with the six checks; the isolated runner for originals |
| 3 | Dissolution of 3 real open-source Node CLIs with 150–400 transitive packages each (E) |
| 4 | The catalog, pre-grown from public usage of the 50 most-depended-on packages |
| 5 | Incident replay: the 2025–26 hijack and worm scenarios run against installed and grown versions of the same repos |
| 6 | Write-up and the public catalog |

- **Budget (E):** $1,000–3,000 of tokens, at $2–20 per unit.
- **Target (E):** at least 80% of runtime dependency call volume served by grown units, at least 60% of packages gone
  from `package.json`, and zero unexplained divergences on held-out calls.
- **The "wait, what?" demo:**
  1. Run `grow` on a real CLI. `node_modules` disappears.
  2. `/grown` holds a few thousand lines, each with provenance. The tests pass. More than a million differential checks
     ran, and every divergence is bucketed and explained. `npm install` has nothing to install.
  3. Add a call to a lodash function the code never used before. The grow signal fires, and a few minutes later the
     function is grown, checked and running. It is the ENOSYS moment, for libraries.

### Prior art: the closest attempts and what's left

- **F, nirdep** ([DEV post](https://dev.to/ewwhardik/856168-differential-checks-later-what-it-actually-takes-to-delete-your-dependencies-4763),
  [repo](https://github.com/ewwhardik/nirdep); the page shows "Sep 4" with no year).
  - Five hand-built dependency-free modules plus a codemod, covering 11 packages (chalk, semver, minimatch, glob,
    lodash, yargs and others). Five are rewritable; six get advice only.
  - Used surface only, with differential checks against the installed package.
  - The author hit ReDoS and prototype-pollution hazards along the way.
  - It is a fixed list with no growth on demand and no catalog, and the page doesn't say whether an LLM wrote the code.
- **F, zerodep** (Ding and Stevens, [arXiv 2605.21405](https://arxiv.org/abs/2605.21405), May 2026, revised Oct 2026):
  - 44 stdlib-only Python modules written with LLM help;
  - median install size from about 700 KB to 31 KB, removing 88 transitive packages;
  - whole modules, not one project's used surface, and Python.
- **F, e18e.** The [module-replacements](https://www.npmjs.com/package/module-replacements) manifest and codemods, and an
  agent PR that swaps e18e-flagged packages for built-ins
  ([hashintel/hash#10095](https://github.com/hashintel/hash/pull/10095)). These are curated swaps, not regrowth.
- **F, debloaters.** Stubbifier ([arXiv 2110.14162](https://arxiv.org/pdf/2110.14162)); DepPrune, which finds 50.6% of
  50,488 dependencies bloated ([arXiv 2405.17939](https://arxiv.org/pdf/2405.17939)); and LEADER, LLM-aided
  ([arXiv 2503.08969](https://arxiv.org/pdf/2503.08969)). They delete unused code, but the code you do use still comes
  from the third party.
- **F, Effect 4.0** reportedly ships zero runtime dependencies (an aggregator page; unverified).
- **F, not found:** an on-demand grower for arbitrary packages, with held-out and mutant promotion and a reusable catalog.
  Microsoft's APM is an agent-configuration package manager and unrelated.
- **I, what's left:** everything that makes it GrowOS-shaped. That is growth triggered by demand for any package, the
  isolated oracle, the promotion rules, the catalog, and whole trees as the target.

### The kill

- **The strongest objection (I).** You replace code that millions of users have exercised with agent-written code
  checked only on your inputs. Divergence on rare inputs and new bugs (nirdep hit ReDoS and prototype-pollution hazards)
  could outweigh the supply-chain exposure you removed.
- **The second objection (I): licensing.** MIT and ISC need their notices kept. Copyleft packages can't be absorbed into
  differently licensed code. The corpus has a warning about exactly this: of a Python rewrite of Claude Code, "this is a
  derivative work. Like it actually breaks copyright." (**Q**, `49` [10:00], unattributed turn.) The mitigation is a
  clean-room mode, where the implementing agent sees traces and docs but never the original source.
- **The cheapest test (E: 3 days, about $300).**
  - From 3 repos, take the 20 most-used units, grow them, and run a million differential checks each, plus a mutation
    score.
  - **Kill** if more than 25% of units still have unexplained divergences after 3 grow rounds, if the median cost is
    over $20 per unit, or if grown units fail the ReDoS or prototype checks.

### Filter check (I)

| Filter | Verdict |
|---|---|
| Tailwind | Strong, with the caveat above for small utilities |
| One-shot | Resists: demand, oracle, promotion and catalog |
| About 10× | Very ambitious solo: whole runtime trees and a public catalog. Not impossible: one person did 11 packages by hand, and the loop already exists in GrowOS |
| Solo | Yes. The catalog grows from public usage |
| Value without users | Yes |
| No Python | Yes: TypeScript, with Rust or jitk for isolation |
| Not taken | Precise gap, above |

---

## 4. Idea 2 — Transplant: a new language's libraries, grown at import time

**One sentence.** When a program in a young language imports a library that doesn't exist yet, Transplant grows the
imported surface from the best npm (or crates) original, checks it against that original through a bridge, and
publishes it to the language's registry.

### The seed (Q)

- **Cyrus Omar** (Hazel), `p3-19` [1:02:00]: "it used to be it was like so difficult to get a large set of libraries in
  your new language and now I just you know I can build a library for whatever I want in Hazel by just like leaving
  cloud [Claude] running overnight, right? Um I can port code from other languages very easily to Hazel." Later in the
  same minute: "instead of [clears throat] just like having to confront network effects and the billion dollars of
  software engineering effort is needed to build a standard library and blah blah blah, right?" At [1:03:00]: "I think
  we just have to be bold enough."
- **Ben Davis**, `32` [08:00]: "The languages are much more fungible. It's much easier to just take something in one
  language, use that as effectively a really big complex prompt and then port it into something else."
- **Dillon Mulroy** (Cloudflare), `C13` [11:00]: "The obvious conclusion is that language doesn't matter. Rewriting does."
- **Chris Lattner**, `p3-38` [0:48:00]: "open source 600,000 lines of Mojo code. >> Yeah. >> Well, now now you have lots of
  examples you can put in your context window and now the AI can learn your language very quickly."

### What grows, inside what structure, and how it's checked (I)

It is the same engine as Idea 1, with a different target. Units are the imported functions, not whole packages.

**The structure:**
- an **import resolver** that maps `import x` in language L to candidates in the source ecosystem, by API shape and
  usage;
- a **value bridge** that converts JS values to L values and back, and maps exceptions to L's error model;
- the **oracle**: the original run under Node on the same inputs, through the bridge;
- L's own **type checker** plus an idiom linter;
- Idea 1's **promotion pipeline**;
- **publication** to L's registry, with provenance.

### Tailwind (I)

- Bigger and more stateful libraries become portable, and translation becomes more idiomatic.
- The loop compounds. The growing corpus of verified L code is what Lattner says makes models good at a language, so
  each release makes L easier for the next model to write.

### The one-shot test (I)

A model ports one library per prompt. It can't produce an ecosystem pulled by real programs, checked unit by unit and
kept in sync with upstream releases.

### The value proposition

A new language starts with the libraries its programs import, grown on demand and checked against the originals.

### The 6-week version (I/E)

- **Test bed:** Gleam on the BEAM target, where npm can't be called, or native Zig.
- **Scope:** grow the 30 most-imported npm utility surfaces (dates, semver, markdown, validation, CSV).
- **Demo:** a Gleam program imports `grown/date_fns/format`, `grown/semver` and `grown/marked`. Each one grows in
  minutes, passes 100k differential checks against npm, and lands in Hex with provenance.

### Prior art (F, then I)

- "Vibe-porting": JustHTML ported from Python to JS to OCaml against html5lib-tests (Willison and Madhavapeddy,
  [Dec 2025](https://simonwillison.net/random/vibe-porting/)).
- Commit0, a benchmark of reimplementing libraries from specs.
- [difftest](https://awesome.ecosyste.ms/projects/github.com%2Fnalediym%2Fdifftest), a differential CLI for AI rewrites.
- DARPA's C→Rust translation programs.
- One search found no import-triggered grower (F).
- **What's left (I):** the registry that grows on demand, with an oracle bridge.

### The kill

- **The strongest objection (I).** Young languages call the source ecosystem through FFI (Gleam's JS target, Zig to C),
  and paradigm gaps make ports unidiomatic, so few people would want them.
- **The cheapest test (E: 2 days).** Grow 20 surfaces into Gleam on BEAM. Measure the differential pass rate and the
  idiom-lint results. Count how many Gleam or Zig projects on GitHub hand-reimplemented these surfaces: that is evidence
  of demand that needs no users. **Kill** if the pass rate is under 70% or no hand-reimplementations turn up.

**Filters (I).** Tailwind strong and compounding. Resists one-shot. Very ambitious solo. No Python. Open, per one
search. Weakest on "obviously valuable": the value lands only where the language has programs.

---

## 5. Idea 3 — Cutover: grow your own copy of the slice of a SaaS you use, then switch

**One sentence.** A proxy records your app's traffic to a vendor. Agents grow a self-hosted implementation of exactly
those endpoints (on Workers and Durable Objects, I). It runs in shadow mode against the vendor until it matches; then
you cut over and keep a route back.

### The seed (Q)

- **Ree** (Executor), `11` [1:13:00–1:14:00], on email and auth: "I kind of just made the decision that like I just want
  to in-house both of them … my buying purchases on software have changed to like what is extendable, what has the best
  security, what has the best reliability because all of the stuff that would have made up for that in the past has
  like gone away a little bit."
- **Ryan Skidmore** (Cloudflare), `C02`:
  - [15:00]: "I can build the replacement in 6 months with better models in probably half the time with 100% better
    features."
  - [16:00]: "buy it, but make sure that there is an exit from the vendor."
  - [18:00]: "building got cheap, but owning it is still kind of a problem for now, but that is changing."
- **Theo Browne**, `87` [29:00]: "I would expect more and more companies that have these types of big, painful scaling
  things to go reinvent the painful pieces that are slowing them down."
- **Ben Davis**, `14` [1:32:00], the test-time version of the same idea: "I just did a full onetoone port of a fake
  YouTube API that perfectly matches the spec that works perfectly and simulates real results."

### What grows, inside what structure, and how it's checked (I)

Endpoint handlers and per-resource state models grow, one endpoint at a time.

**The structure:**
- a **recording proxy**;
- a **shadow router**: live requests go to both the vendor and the replacement, and responses are compared on the fields
  the app reads;
- **promotion per endpoint** after N days of zero divergence, with held-out traffic windows and mutants;
- a **cutover gate** and a reverse route.

### Tailwind (I)

- More stateful and complex APIs become replaceable with each release.
- Skidmore's own reasoning: as building costs fall, the line between owning and renting keeps moving.
- The shadow evidence makes each cutover safe whatever wrote the code.

### The one-shot test (I)

The finished value is "this replacement matched the vendor on your traffic for 14 days". That needs your traffic and
the shadow period, and no prompt produces either.

### The value proposition

Stop renting the slice of a SaaS you actually use: grow your own copy from your traffic and switch when it matches.

### The 6-week version (I/E)

- **Scope:** pick 3 vendor APIs, used by open-source apps, whose responses depend only on the request plus your own
  stored state. Examples: feature-flag evaluation, link and redirect services, image-transform presets (I).
- **Run:** each app under scripted traffic.
- **Demo:** a dashboard where each endpoint turns from red to green as it reaches zero divergence, then a one-click
  cutover the app doesn't notice.

### Prior art (F, then I)

- [StrongDM's Digital Twin Universe](https://simonwillison.net/2026/Feb/7/software-factory): agent-built behavioral
  clones of Okta, Jira, Slack, Google Docs, Drive and Sheets, Feb 2026. They are for testing.
- [Pome digital-twins](https://github.com/pome-sh/digital-twins) (open source) and [AgentTwin](https://agenttwin.si/):
  test sandboxes.
- LocalStack and S3-compatible stores: hand-built API-compatible servers.
- Anthropic's Scion for git. Theo reads it at `87` [28:00]: "Their infrastructure footprint is 200x smaller" (**Q**).
- Replaygate, this repo's round 9, already used production traffic as an oracle.
- **What's left (I):** a production cutover with per-endpoint shadow evidence and growth on demand. Every clone above
  stops at tests.

### The kill

- **The strongest objection (I).** A vendor's value is mostly operational (deliverability, fraud models, uptime,
  compliance) or lives in vendor-side data, not in request-to-response behavior. It is also close to Replaygate, which
  did not excite the builder.
- **The cheapest test (E: 1 day, no cost).** Sample the vendor calls in 30 open-source apps with GitHub code search.
  Classify each endpoint as "a function of the request plus own state" or "vendor data and operations". **Kill** if the
  former is under 40% of calls.

**Filters (I).** Tailwind medium. Resists one-shot. Ambitious. Solo, though the traffic is scripted unless the builder
uses their own apps. No Python. Adjacent prior art is strong.

---

## 6. Ranking and the pick

| Rank | Idea | Tailwind | One-shot | Ambition | Not taken | Builder fit | Main risk |
|---|---|---|---|---|---|---|---|
| **1** | **Grow-install** | Strong: frontier and demand both rise | Resists: demand, oracle, promotion, catalog | Very high | Precise gap (nirdep, zerodep and e18e are fixed lists or studies) | GrowOS's promotion pipeline, jitk isolation, TypeScript, scriptc | Long-tail divergence |
| 2 | Transplant | Strong and compounding | Resists at ecosystem scale | High | Open, per one search | Compiler and PL background | Weak demand where FFI already exists |
| 3 | Cutover | Medium | Resists: needs traffic and a shadow period | Medium-high | Adjacent: DTU, Pome, Replaygate | Workers and Durable Objects | Vendor value is operational |

**I, how they relate:** the three are the same loop at three layers: library, language and service. Grow-install is the
engine, and the other two reuse it.

**ONE pick: Grow-install.** It is the closest GrowOS analogue that is neither a kernel nor taken:
- a missing piece triggers growth;
- a runnable original is the oracle;
- held-out calls and mutants guard promotion;
- the artifact is kept;
- the metric is coverage.

Its value proposition holds up and grows: every model release dissolves larger dependencies, while worm-style incidents
keep raising the stakes.

**TL;DR**
1. The best GrowOS-shaped seed outside the kernel is the dependency tree. Ben Davis: "no dependencies because they can do
   all of it with AI". A Latent Space host: "then you own the dependency". JG: "supply chain attacks are going to be the
   next swing of the pendulum".
2. Pick Grow-install: it grows the exact surface your code uses from each package, checks it against the isolated
   original (replay, differential fuzzing, held-out calls, mutants), and keeps it in a reusable catalog. Each model
   release dissolves bigger dependencies.
3. The closest prior art (nirdep's 11 hand-built packages, zerodep's 44 Python modules, e18e's swap lists) doesn't grow on
   demand. Kill test: 20 units × 1M differential checks, about $300 in 3 days.

---

## 7. Considered and dropped: GrowOS-shaped, but taken, excluded or unseeded

| Direction | Seed | Why dropped |
|---|---|---|
| A bespoke or fast Rust compiler grown against rustc | Theo, `14` [1:35:00–1:36:00]: "Why wouldn't you build the perfect compiler for your app?"; Lust, `87` [28:00] | **F:** Theo's [lust-lang](https://github.com/t3dotgg/lust-lang) (Rust subset to C to TCC; must match rustc; explicitly "not a general Rust replacement"), plus rustd, Relax and Astral's agent-patched rustc fork, all collated by [Charlie Marsh on 2026-10-21](https://x.com/charliermarsh/status/2112711387285758250). Four efforts; Astral is venture-backed (I). |
| Twins of the services agents call | Ben Davis, `14` [1:32:00]; Max Kanat-Alexander, `79` [14:00]: "everybody would provide in-memory fake versions of their services… Guess what? The coding agent can do that." | **F:** StrongDM DTU, Pome digital-twins, AgentTwin, LocalStack. Idea 3 keeps only the production-cutover remainder. |
| Byte-exact decompilation of games and binaries | Nerd Snipe hosts, `14` [0:46:00]; `p3-02` [00:00] | **F:** [momo5502](https://momo5502.com/posts/2026-10-09-game-decompilation/) (agents on an FPS, about 83% byte-exact claimed); [freeqaz](https://freeqaz.com/blog/llm-assisted-decompilation) (44,226 Xbox 360 functions); decomp.wtf (archived 2026-10-15); catalogue R7 §4 already narrowed this. |
| Workload-specific database engines | Mattis, `22` [0:32:00]; Theo, `87` [28:00] | **F:** Bespoke OLAP ([arXiv 2603.02001](https://arxiv.org/abs/2603.02001), VLDB'26, 11.8× over DuckDB on TPC-H), SpecDB, JetStream. "Database personality" is also GrowOS scope (A09). |
| Rewrites carrying proofs | de Moura, `p3-45` [0:06:00]: "now it's just asking to optimize the codes but you cannot break the proofs" | Lean FRO's own path (Kim Morrison's zlib); superoptimisation and translation validation are in catalogue R6/R7; "proofs" is on the kill list. Kept only as Idea 1's later rung. |
| Adobe-format fidelity grown against Adobe | `14` [0:50:00]; `p3-48` [10:00]; Wes, `54` [07:00] ("It's like $80 a month") | **F:** ArtCraft (Brandon Thomas, Oct 2026): seven Rust apps, about 43k stars, PhotoCraft claims 134 of 135 PSDs round-trip byte for byte ([Notebookcheck](https://notebookcheck.net/Photoshop-Premiere-more-Experienced-Rust-developer-recreates-Adobe-suite-with-AI-assistance-as-open-source.1419230.0.html)). Photopea also exists. The remainder (the binary .indd format) is narrow. |
| Lockstep game ports checked by replay | Theo, `14` [1:34:00–1:35:00] (Vampire Survivors ported line by line) | **F:** the Mazes of Menace contest ([Bau](https://davidbau.com/archives/2026/05/06/the_teleport_contest.html)), Rosebud's Wesnoth port, and Amber R&D's OpenMW port are all active. |
| Just-in-time hardware | Rauch and Lütke, `p3-65` [10:00–11:00] | The oracle is physical: this is the rejected 3D-print fit-atlas family. |
| An Excel-exact engine checked against the cached values in .xlsx files | Only Kim, `p3-09` [18:00]: "people will rely rarely, if ever, on Excel and PowerPoint to make financial models or pitch decks" | That quote is about the interface, not an engine, so this is a desk idea with no seed. Cut. |
| Kernels, file systems, an OS in a week, a slop-forked Android | Theo, `14` [1:39:00]; Adam Jacob, S05 row V55 28:00; Blow, `p3-37` [1:31:00] | Excluded by the brief. |

---

## Appendix A — the 15 most promising raw seed sentences (all Q, checked at the timestamp)

| # | Quote | File | Time | Speaker | Leads to (I) |
|---|---|---|---|---|---|
| 1 | "There's a lot of things that we just haven't thrown comput[e at] yet that if you threw compute at it probably would fall." | `14` | 0:45:00 | Nerd Snipe host (turn after Theo; Ben Davis, I) | The general thesis |
| 2 | "Why wouldn't you build the perfect compiler for your app?" | `14` | 1:36:00 | Theo Browne | Bespoke compilers (crowded) |
| 3 | "all software was built to be somewhat generalizable. Now, we can build software for our specific needs." | `87` | 28:00 | Theo Browne | Ideas 1 and 3 |
| 4 | "I'll probably be building my own kernels and file systems in the near future just because I have specific things that the ones that exist don't do." … ">> LLVM might be a target soon." | `14` | 1:39:00–1:40:00 | Theo Browne (S05 attribution), then a co-host | Excluded or crowded |
| 5 | "I just did a full onetoone port of a fake YouTube API that perfectly matches the spec that works perfectly and simulates real results." | `14` | 1:32:00 | Ben Davis (E03 attribution) | Twins, and Idea 3 |
| 6 | "one of the great dreams that I've always had as a test owner is that everybody would provide in-memory fake versions of their services … Guess what? The coding agent can do that." | `79` | 14:00 | Max Kanat-Alexander (Capital One) | Twins |
| 7 | "for the actual like shipped version of it, no dependencies because they can do all of it with AI and that's awesome." | `32` | 12:00 | Ben Davis | **Idea 1** |
| 8 | "you maybe want to encourage more slow forks because then you own the dependency." | `49` | 11:00 | Latent Space host | **Idea 1** |
| 9 | "I can build a library for whatever I want in Hazel by just like leaving cloud [Claude] running overnight" … "the billion dollars of software engineering effort is needed to build a standard library" | `p3-19` | 1:02:00 | Cyrus Omar | **Idea 2** |
| 10 | "after one week succeeded doing the whole thing and now it's just asking to optimize the codes but you cannot break the proofs" | `p3-45` | 0:06:00 | Leonardo de Moura | Proofs (Lean FRO) |
| 11 | "Do you foresee a world of just-in-time hardware, just-in-time shopping?" / "frameworks or substrates for making hardware essentially software" | `p3-65` | 10:00 / 11:00 | Guillermo Rauch / Tobi Lütke | Physical (dropped) |
| 12 | "the games world is really starting to go through this reckoning of everything getting decompiled and rebuilt and modded to insane degrees." | `14` | 0:46:00 | Nerd Snipe host | Decompilation (taken) |
| 13 | "nobody should even implement this anymore cuz nowadays we we have something else to implement this in all the optimizations" | `22` | 0:32:00 | Peter Mattis (on B-trees) | Specialized data structures |
| 14 | "every codebase is now the prompt for another codebase." | `75` | 10:00 | Patrick Collison (quoting a friend) | Rewrites in general |
| 15 | "if you give the model some sort of metric and then you give it a way to verify its result, you can just make it iterate and keep going … I think it's something really underutilized" | `71` | 20:00 | Boris Cherny | The tailwind mechanism |

**Also noted, not in the 15:**
- JG, `p3-35` [0:13:00] (supply chain, used in Idea 1).
- Skidmore, `C02` [15:00] ("the replacement in 6 months with better models", used in Idea 3).
- "Like mold. It just grows.", `05` [0:44:00], on self-modifying harnesses.
- Lattner, `p3-38` [0:50:00]: "you just say here's a list of requirements generate the machine code".
- Cloudflare Code Mode, `48` [34:00]: "brittle logic can now just be generated on demand".
- Kent C. Dodds, `p3-48` [04:00]: "the code is written on demand".

## Appendix B — file key

| Key | File |
|---|---|
| `Ep07` | `arch/research/next-token-ep07-transcript.txt` |
| `05` | `05-fragmented-ai-developer-podcast-312-understanding-pi-durable-with-mari.txt` |
| `11` | `11-next-token-ep-06-the-senior-engineer-death-spiral.txt` |
| `14` | `14-nerd-snipe-we-can-t-trust-gemini-4.txt` |
| `22` | `22-the-pragmatic-engineer-distributed-databases-with-peter-mattis.txt` |
| `32` | `32-ben-davis-programming-feels-very-different.txt` |
| `48` | `48-cloudflare-code-mode-giving-ai-agents-an-entire-api-in-1-000-tokens-wi.txt` |
| `49` | `49-latent-space-why-you-should-build-science-fiction-sunil-pai-cloudflare.txt` |
| `54` | `54-syntax-one-of-us-is-lying-to-you.txt` |
| `55` | `55-syntax-wtf-is-a-software-factory.txt` |
| `71` | `71-claude-live-coding-session-with-boris-cherny-and-jarred-sumner.txt` |
| `75` | `75-claude-patrick-collison-on-claude-code-at-stripe.txt` |
| `79` | `79-ai-engineer-does-code-quality-still-matter-it-depends-on-this-max-kana.txt` |
| `87` | `87-theo-t3-gg-anthropic-rebuilt-git-yes-really.txt` |
| `88` | `88-theo-t3-gg-you-can-rewrite-typescript-in-rust-for-420k.txt` |
| `p3-02` | `p3-02-frank-nillard-your-software-won-t-matter-in-5-years-here-s-what-to-do-.txt` |
| `p3-09` | `p3-09-ai-engineer-how-openai-built-chatgpt-for-bankers-and-analysts-joseph-k.txt` |
| `p3-19` | `p3-19-jane-street-trustworthy-human-ai-collaboration-in-a-live-type-theoreti.txt` |
| `p3-35` | `p3-35-software-unscripted-podcast-tigerbeetle-s-spectacular-jepsen-report-wi.txt` |
| `p3-37` | `p3-37-software-unscripted-podcast-jonathan-blow-on-programming-language-desi.txt` |
| `p3-38` | `p3-38-software-unscripted-podcast-gpu-programming-and-language-design-with-c.txt` |
| `p3-45` | `p3-45-ryan-peterman-creator-of-lean-handwritten-math-will-change-dramaticall.txt` |
| `p3-48` | `p3-48-kent-c-dodds-the-future-of-software-is-invisible.txt` |
| `p3-64` | `p3-64-viteconf-viteconf-2026-5th-edition-we-are-vite.txt` |
| `p3-65` | `p3-65-vercel-the-third-customer-a-fireside-with-tobi-l-tke-and-guillermo-rau.txt` |
| `C02` | `connect26/transcripts/02-it-s-time-to-build-not-buy.txt` |
| `C13` | `connect26/transcripts/13-artifacts-git-compatible-versioned-storage-from-zero-to-beta.txt` |

## Sources (web, F)

- Dependencies and supply chain:
  - nirdep: [DEV post](https://dev.to/ewwhardik/856168-differential-checks-later-what-it-actually-takes-to-delete-your-dependencies-4763), [repo](https://github.com/ewwhardik/nirdep)
  - zerodep: [arXiv 2605.21405](https://arxiv.org/abs/2605.21405)
  - e18e: [module-replacements](https://www.npmjs.com/package/module-replacements), [hashintel/hash#10095](https://github.com/hashintel/hash/pull/10095)
  - Debloaters: [Stubbifier](https://arxiv.org/pdf/2110.14162), [DepPrune](https://arxiv.org/pdf/2405.17939), [LEADER](https://arxiv.org/pdf/2503.08969)
  - Incidents: [InfoQ on axios](https://infoq.com/news/2026/04/axios-supply-chain), [CSA AD-2026-002](https://www.csa.gov.sg/alerts-and-advisories/advisories/ad-2026-002/), [CSA AD-2026-009](https://csa.gov.sg/alerts-and-advisories/advisories/ad-2026-009)
  - Unrelated but checked: [Microsoft APM](https://github.com/microsoft/apm)
- Compilers: [lust-lang](https://github.com/t3dotgg/lust-lang), [Charlie Marsh, 2026-10-21](https://x.com/charliermarsh/status/2112711387285758250), [mrustc](https://github.com/thepowersgang/mrustc), [gccrs March 2026 report](https://gcc.gnu.org/pipermail/gcc/2026-April/247925.html), [Anthropic's C compiler thread](https://users.rust-lang.org/t/anthropics-c-compiler-implemented-in-rust/138132)
- Twins: [Simon Willison on StrongDM](https://simonwillison.net/2026/Feb/7/software-factory), [factory.strongdm.ai](https://factory.strongdm.ai/), [Pome digital-twins](https://github.com/pome-sh/digital-twins), [AgentTwin](https://agenttwin.si/)
- Decompilation: [momo5502](https://momo5502.com/posts/2026-10-09-game-decompilation/), [freeqaz](https://freeqaz.com/blog/llm-assisted-decompilation), [decomp.wtf](https://github.com/i12bp8/decomp.wtf/wiki)
- Databases: [Bespoke OLAP](https://arxiv.org/abs/2603.02001), [SpecDB](https://arxiv.org/html/2605.31097v1), [JetStream](https://arxiv.org/html/2608.22476v1)
- Adobe formats: [Notebookcheck on ArtCraft](https://notebookcheck.net/Photoshop-Premiere-more-Experienced-Rust-developer-recreates-Adobe-suite-with-AI-assistance-as-open-source.1419230.0.html), [Creative Bloq](https://www.creativebloq.com/design/design-software/someone-just-rebuilt-adobe-creative-cloud-with-ai-then-gave-it-away-for-free)
- Game ports: [Mazes of Menace contest](https://davidbau.com/archives/2026/05/06/the_teleport_contest.html), [Rosebud on Wesnoth](https://rosebud.ai/engineering/porting-wesnoth-with-amnesiac-agents), [Amber R&D](https://amberstudio.com/612-commits-in-24-days)
- Porting and differential testing: [vibe-porting tag](https://simonwillison.net/random/vibe-porting/), [difftest](https://awesome.ecosyste.ms/projects/github.com%2Fnalediym%2Fdifftest)
