# D1: Grow-install, GAPS (prior art)

Round 14 deep dive, 2026-10-29. Brief: [../BRIEF-deepdive.md](../BRIEF-deepdive.md). The idea under test is from
[T01 §3](../tailwind/T01-seed-hunter.md) (Grow-install) and [T08 §1](../tailwind/T08-self-extending.md) (Unfinished
Library).

**Labels.**
- **Q**: quoted from the linked paper, page or repository.
- **F**: sourced, with a link.
- **I**: inference.
- **E**: estimate.

All dates are 2026 unless stated otherwise. "Checked" means I opened the repository, paper or page myself on
2026-10-29.

## Verdict up front: a narrow opening

**I.** The core idea is no longer open. "An agent regenerates only the part of a dependency that your code actually
uses" is a published ESEM 2026 paper (Purdue: 180 repository–dependency pairs, Claude Opus 4.6). The oracle idea is
also taken. "Record the original's input/output in isolation, then regenerate it clean-room with an LLM" is a Brown/MIT
preprint, Lexo.

Curated replacement catalogues are owned by others:
- swapped-in replacements: Socket, e18e and es-toolkit;
- trusted copies of the original: Aikido (patched) and Chainguard (rebuilt).

What nobody has shown:
1. Dissolving the whole dependency tree of real apps, with each piece accepted on differential evidence against the
   isolated original rather than on the repository's own tests.
2. A catalogue, reused across repositories, of grown function-level units, keyed by version and re-verified when the
   upstream package changes.
3. A public dissolution benchmark that is re-run for every model release.

Singla & Davis name item 1 as their next step, and Lexo's authors already hold the oracle half, so the window is
months, not years (E).

---

## 1. The claim, split into checkable parts

T01's Grow-install bundles ten parts. Section 4 maps each part to prior art.

| # | Part | Source |
|---|---|---|
| P1 | Regenerate only the surface of each dependency that a repository uses | T01 §3, T08 §1 |
| P2 | A tracer at the package boundary that records calls, results and the "used projection" (only the fields the app reads) | T01 |
| P3 | Small function-level units, grown in parallel | T01 |
| P4 | The original package, run in isolation (it may be malicious), as the oracle | T01 |
| P5 | Clean-room mode: the grower never sees the original source | T01, "The kill" |
| P6 | A promotion gate: replay, differential fuzzing, held-out calls, a mutation score, a lint and a performance budget | T01 |
| P7 | Provenance and the licence notice on each grown unit | T01 |
| P8 | A catalogue reused across repositories, keyed by package, version range and behaviour hash, pre-grown from public usage | T01 |
| P9 | Growth on demand: a new call fires a "grow signal", the ENOSYS moment for libraries | T01 demo |
| P10 | Whole runtime trees as the target, scored as the share dissolved and re-run every model release | T01 tailwind |

## 2. What I searched, and the limits

- **F, sources opened.** I read:
  - the two closest papers in full: Singla & Davis, and Lexo;
  - Singla's Purdue MS thesis, which gives the method in detail;
  - the Zenodo artifact README;
  - the repositories of nirdep, socket-registry, e18e (six repositories), es-toolkit, LavaMoat, aube, Lya, Commit0 and
    difftest;
  - the ATLAS group's bibliography file;
  - the primary posts from Deno, Aikido and Effect.
- **F, search volume:**
  - about 27 GitHub repository searches;
  - about 20 npm registry searches;
  - 5 crates.io searches;
  - 12 Hacker News (Algolia) story searches since 2025;
  - about 25 arXiv API queries;
  - about 25 web searches;
  - the Semantic Scholar citation graph of Harp and Lexo, to find 2026 work that cites them.
- **Limits:**
  - X is poorly indexed: `site:x.com` queries returned nothing, so this is not evidence of absence.
  - The ACM Digital Library blocked fetches, so the Harp and exoskeleton abstracts come from Semantic Scholar.
  - I ran no code.
  - Unannounced roadmaps can't be excluded.
  - Every verdict below rests on what is publicly visible on 2026-10-29.

---

## 3. The neighbours, one by one

Each entry gives:
- **Does**: what it does;
- **Got to**: how far it got;
- **Active?**: whether it is still moving;
- **Left**: what it leaves for Grow-install.

### 3.1 Singla & Davis, "Software Supply Chains Are Dead: Use-Case-Oriented Regeneration" (the closest neighbour)

**F, publication.**
- [arXiv 2607.13021](https://arxiv.org/abs/2607.13021), 14 July.
- Published in ESEM 2026: LIPIcs vol. 394, paper 64, 2026-10-05
  ([Dagstuhl](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ESEM.2026.64)).
- Authors: Tanmay Singla and James C. Davis, Purdue.
- The method in full is in Singla's MS thesis, May 2026. I read it from a
  [third-party mirror](https://gradcoach.com/files/dissertations/software-supply-chains-generative-systems.pdf); its
  title and committee pages match.

**Does (F, thesis §4.4.5):**
- The tool is Claude Code with Claude Opus 4.6, in the 1M-token configuration, using one fixed prompt.
- The agent receives the client repository, **the dependency's source** and the repository's tests.
- It finds the repository's imports of the dependency, writes local modules that implement only the used behaviour,
  rewires the imports, removes the dependency once nothing needs it, and iterates on failing tests.
- **Q:** "It was explicitly directed not to recreate the dependency broadly, but instead to implement only the subset
  of functionality that the repository actually required."

**Got to (F):**
- **Scale:** 9 npm dependencies (axios, chalk, change-case, express, lodash, nanoid, postcss, semver, zod) × 20 GitHub
  client repositories each = 180 pairs ([Zenodo README](https://zenodo.org/records/20370439)).
- **Results:**
  - 64,477 of 64,634 baseline checks still pass (99.8%);
  - 166 of 180 pairs preserve behaviour perfectly;
  - the exported API surface shrinks by 93%.
- **Failure modes:**
  - semver's prerelease logic;
  - lodash's deep cloning;
  - `instanceof` and class identity (zod, semver);
  - express middleware arity;
  - axios mock interceptors.

**F, the weak point, in their own data (thesis Table 4.10).** The client tests exercise only a small share of the
generated replacement code:

| Dependency | semver | zod | chalk | lodash | express | axios | postcss | nanoid | change-case |
|---|---|---|---|---|---|---|---|---|---|
| Average share of generated code covered by the client's tests | 25.5% | 28.5% | 35.3% | 40.8% | 44.1% | 54.0% | 72.6% | 85.7% | 92.5% |

**Q:** "some regeneration outcomes that pass repository validation may overestimate true behavioral equivalence."

**What they did not do (F):**
- no differential testing, fuzzing or mutation testing;
- no isolated original;
- no shared catalogue: replacements are specific to each repository. The artifact does keep a starting template per
  dependency (`_local-<dep>-template.*`), which is a seed of reuse.

**Q, their own agenda:**
- "future work must prioritize coverage-guided validation, differential testing, and AI-assisted risk assessment
  workflows";
- "regeneration provenance metadata";
- "an explicit refresh practice".

**Active?**
- **F:** the paper was published this month, and the replication package is on Zenodo (a 17 GB zip).
- **F:** the lab's GitHub organisation has no regeneration tool (checked).
- **I:** the lead author's MS ended in May, so continuation depends on the lab.
- **F, the idea is spreading.** A day after the preprint, a practitioner blog turned it into a Codex CLI workflow
  ([Vaughan, 07-15](https://codex.danielvaughan.com/2026/07/15/software-supply-chains-dead-use-case-regeneration-codex-cli-dependency-replacement-local-synthesis/)).
  The post proposes a hook for differential testing but ships no script.

**Left (I):**
- **Taken:** P1, used-slice regeneration, at small scale.
- **Still open:**
  - P4–P6: the oracle and acceptance beyond tests;
  - P8: the catalogue;
  - P9: growth on demand;
  - P10: tree scale;
  - refreshing when the upstream package changes.
- **Clean-room (P5) is not done here:** the agent read the original source.

### 3.2 Lexo (Brown and MIT), and its predecessor Harp (the oracle half)

**F, Lexo.**
- [arXiv 2510.14522](https://arxiv.org/abs/2510.14522), v1 16 Oct 2025, v3 16 Dec 2025.
- Authors: Lamprou, Dai, Ntousakis, Rinard and Vasilakis (Brown's ATLAS group, and MIT).

**Does (F, [v3 full text](https://arxiv.org/html/2510.14522v3)):**
1. An LLM writes test inputs from the component's source.
2. **Q:** "Interactions with the component happen in an isolated environment". Lexo runs the original there and records
   input/output pairs, over three rounds that raise coverage.
3. An LLM writes an algorithm sketch from the pairs.
4. An LLM writes new code from the pairs and the sketch. **Q:** "the LLM is not given the original potentially
   malicious code as input". Up to three repair rounds follow.

Guardrails:
- components that touch the clock, the filesystem or the network are rejected, monitored "using strace";
- function-valued returns are rejected.

**Got to (F):**
- It removed the malicious code in about ten real attacks, including event-stream/flatmap-stream, ctx and left-pad.
- With GPT-5 mini as the model, 86 of 147 benign components passed both the input/output pairs and the developers'
  tests.
- Each component took about 30 minutes and cost under $0.10.
- On Harp's 17 string-processing benchmarks, Lexo regenerated 5 and Harp 14.
- **Limits:**
  - components "typically around or below 150 lines of code";
  - "weak performance in higher-order functions";
  - side effects can't be expressed as input/output pairs;
  - no protection against malice that changes the returned results.

**Active? (F, checked):**
- The code was promised "at github.com/atlas-brown/lexo", which returns 404.
- The group's own [bibliography](https://github.com/atlas-brown/bib) still lists Lexo as a preprint.
- The group's 2026 papers are on shells and systems, for example sash, the SOSP'26 best paper.
- **I:** Lexo is dormant, or being held for a venue.

**F, Harp** (CCS 2021, [DOI](https://doi.org/10.1145/3460120.3484736); abstract via Semantic Scholar).
- "Active library learning and regeneration" for string-processing components in JavaScript and C/C++.
- It infers a program in a domain-specific language, mostly in under a minute.
- It removed the event-stream, left-pad and string-compare issues.
- **Q:** "inferring and regenerating the client-observable behavior of software components."
- **I:** "client-observable behavior" is T01's "used projection", five years earlier.

**F, related work by the same people:**
- *Component exoskeletons* (PACMI'25): partial specifications extracted automatically from the original component, to
  guard LLM transformations.
- *Caruca* ([arXiv 2510.14279](https://arxiv.org/abs/2510.14279)): specification mining for shell commands.
- [Lya](https://github.com/atlas-brown/lya): dynamic analysis at module boundaries for Node.

**Left (I):**
- **Taken, as research:** P4 and P5.
- **Still open:**
  - P1: regeneration per repository (Lexo works per component and ignores which slice a client uses);
  - acceptance gated on held-out calls and a mutation score;
  - P8, P10;
  - anything above about 150 lines, stateful or higher-order.

### 3.3 nirdep

**F, checked** ([repo](https://github.com/ewwhardik/nirdep),
[post](https://dev.to/ewwhardik/856168-differential-checks-later-what-it-actually-takes-to-delete-your-dependencies-4763)).
- The repository was created 2026-08-29; the last push was 2026-08-31. It has 2 stars and 0 forks.
- It was an entry to "Zero Dependency 2026: Build Real Software With No Packages. Prove It.", a 72-hour Hackathon
  Raptors event announced on 08-08 ([organiser](https://dev.to/raptorsdev)).
- **Q:** "Zero Dependency Hackathon, track A. Published by Nastik AI."

**Does:**
- Five hand-written modules that use only the Node standard library replace 11 packages: chalk, strip-ansi,
  supports-color, ansi-styles, semver, minimatch, glob, lodash, minimist, commander and yargs.
- A scope-aware codemod rewrites call sites, with the commands `scan`, `plan`, `apply`, `eject` and `guard`.
- Six of the eleven packages get advice only.
- The post never says an AI wrote the code.

**Got to (F):** 856,168 differential checks against the installed packages.

| Package | Checks | Disagreements |
|---|---|---|
| semver | 507,316 | 72; the post says semver "contradicts itself" |
| glob | 228,852 | 697 |
| lodash | 120,000 | 11 pinned divergences |

Two hazards were designed out:
- no regular expressions in semver or glob, against ReDoS, so `satisfies` runs at 0.26× the reference speed;
- deep writes never follow properties the object doesn't own, against prototype pollution.

**Active?** No: two days of commits (F).

**Left (I):** everything except the idea "used surface plus differential checks, for a fixed list". Its value to the
builder is evidence that differential checks find real divergences, some of them bugs in the reference itself.

### 3.4 zerodep (Python)

**F** ([arXiv 2605.21405](https://arxiv.org/abs/2605.21405), v1 20 May, v2 13 Oct; Peng Ding and Rick Stevens).
- 44 single-file Python modules using only the standard library, in 12 categories, each benchmarked against its
  reference library.
- The median install shrinks from 700 KB to 31 KB.
- 88 transitive dependencies, maintained by 128 PyPI accounts, are removed.
- **Q:** "specification completeness, not model capability, is a strong predictor of generation success."

**Left (I):**
- Everything for JavaScript: this is a study of whole modules, with no per-repository slice and no growth.
- Its key finding is a warning for the tailwind: small utilities are bound by the specification, not by the model.

### 3.5 e18e (module-replacements, CLI, MCP server, Claude skill, perfbot)

**F, checked.** [module-replacements](https://github.com/e18e/module-replacements) has 1,014 stars and was pushed on
10-26. Its three manifests contain:
- 154 micro-utility mappings, pointing to 109 inline snippets;
- 321 native-feature mappings;
- 481 preferred-package mappings.

That is my count of the `mappings` keys (I).

The tooling around the data:
- a CLI (0.7.x) and an ESLint plugin;
- an [MCP server](https://github.com/e18e/mcp) ("very early stages");
- a [Claude Code skills plugin](https://github.com/e18e/skills), since 06-16. Its `module-replacements` skill finds,
  confirms and applies four kinds of swap: documented, native, simple (an inline snippet) and removal. It then tells the
  agent to **Q** "run the project's typecheck/tests/build to confirm nothing broke";
- [perfbot](https://github.com/e18e/action-perfbot), created 01-25 and "unpublished": **Q** "dependabot but for
  modernization and performance improvements."

**F, in production.** [hashintel/hash#10095](https://github.com/hashintel/hash/pull/10095), merged 10-19, was authored by
the Claude app after an `@e18e/cli` 0.7.0 scan: "Remove or replace npm dependencies flagged by e18e".

**Left (I):**
- **What e18e doesn't do:** generate code beyond curated snippets, check differentially, or slice large packages.
- **What it owns:** the easy tier (unused packages, native swaps, micro-utilities), and it reaches agents directly.
- **Left for Grow-install:** the middle tier.

### 3.6 Socket (Optimize and socket-registry)

**F, checked** ([repo](https://github.com/SocketDev/socket-registry), [product](https://socket.dev/features/optimize)).
- Created September 2024, pushed 10-15.
- The recent commits are all by John-David Dalton, who is lodash's author ([npm metadata](https://registry.npmjs.org/lodash)).
- **Holdings:** 139 override packages, 133 of them in the published manifest. They are mostly polyfills and
  micro-utilities (safe-buffer, object-assign, function-bind, isarray); 125 of the 139 rank on npm-high-impact.
- **Q:** "Every override passes the original package's own test suite".
- **Delivery:** `socket optimize` writes overrides into npm, pnpm, Yarn and Bun lockfiles.
- **I:** its coverage-guided fuzz lane (vitiate) fuzzes the repository's own scripts; it is not differential against
  the originals (`scripts/repo/fuzz.mts`).

**Left (I):**
- The overrides are hand-made, about six a month since 2024 (E).
- They are whole packages, not per-repository slices, and carry no differential evidence.
- **The threat:** Socket has everything else:
  - the install channel;
  - intelligence on every npm package;
  - a test harness that runs the original packages' suites;
  - lodash's author.

  Automating override growth with agents is a short step for them.

### 3.7 Trusted copies of the original: Aikido (via Root), Chainguard, Google OSS Rebuild

**Aikido (F).** Aikido acquired Root on 06-30 ([Aikido blog](https://www.aikido.dev/blog/aikido-acquires-root)):
- Root's agents **Q** "generate precise CVE patches for the package versions teams actually run, at machine speed";
- the product is sold as Aikido Libraries, **Q** "vulnerability-free, drop-in replacement libraries";
- a count of 9,000+ libraries appears only in a LinkedIn post (unverified).

**Chainguard Libraries for JavaScript (F, vendor claims).**
[Chainguard](https://www.chainguard.dev/unchained/mitigating-malware-in-the-npm-ecosystem-with-chainguard-libraries)
says:
- packages are rebuilt from source in an isolated build environment;
- they cover 88% of npm's top-500 high-impact packages;
- about 99.7% of 8,783 known-malicious packages would be blocked, mainly because 91.3% have no trusted source to
  build from.

**Google OSS Rebuild (F, July 2025).** Reproducible rebuilds with SLSA provenance and equivalence attestations, for npm,
PyPI and crates ([repo](https://github.com/google/oss-rebuild)).

**Left (I):**
- All three make the *original* trustworthy; none regenerates code.
- They compete for the same budget and the same pitch. "Why not just use Chainguard and cooldowns?" is the opening
  question any buyer will ask.

### 3.8 The platform absorbs the easy tier: Deno/JSR, Bun, Node, Effect

- **Deno/JSR (F, [Deno blog, 10-09](https://deno.com/blog/cloudflare)):**
  - **Q:** "the entire Deno team is joining Cloudflare";
  - the runtime gets one more year of monthly bug-fix and security releases, after which development stops;
  - Deno Deploy shuts in six months;
  - **Q:** "JSR will continue operating, with its infrastructure moving to Cloudflare."
  - There is no regeneration feature.
  - **I:** Deno/JSR stood for the route of a trusted registry, a secure runtime and a standard library, and that route
    is winding down. Not a competitor.
- **Bun:** now part of Anthropic ([bun.com](https://bun.com/) banner). It keeps adding built-ins: SQL drivers, S3,
  Redis, HTTP and WebSocket servers.
- **Effect v4 (F, [Effect blog](https://effect.website/blog/effect-v4-rc-august-recap/)):**
  - **Q:** "The `effect` core package has no external dependencies." (RC on August 12.)
  - The post does not credit AI for this, so Ben Davis's seed ("they can do all of it with AI") is unconfirmed on
    that point.

**Left (I):**
- Polyfills and micro-utilities are disappearing through built-ins and curated swaps, even before any regeneration.
- Grow-install's real target is the middle tier.

### 3.9 "Vendoring with AI": a 2025–26 discourse with no tool

**F/Q, the posts:**
- Ronacher, [2025-01-24](https://lucumr.pocoo.org/2025/1/24/build-it-yourself/): "it's faster for me to have ChatGPT
  or Cursor whip up a dependency free implementation of these common functions".
- Danjou, [05-19](https://julien.danjou.info/blog/how-much-of-a-library-do-you-actually-use/). Of a usage-coverage
  dependency dashboard: "I haven't built this. I haven't found anyone who has".
- Paulund, [05-30](https://paulund.co.uk/notebook/ai/small-npm-packages-are-mostly-dead): "I stopped installing most
  small npm packages."
- Nesbitt, [01-30](https://nesbitt.io/2026/01/30/will-ai-make-package-managers-redundant), the sceptic:
  - "You can't prompt your way into a decade of production bug reports.";
  - "AI agents aren't going to stop using packages.";
  - he rebuts Marcelo Emmerich's "prompt registry" concept (I could not open the original post).
- [RiskyPlugins](https://riskyplugins.com/blog/the-dependency-model-is-dying): "Fewer entries in a lockfile do not
  establish lower risk by themselves."

**Left (I):** the idea is in the air, and the field is full of opinions but has no checked tooling.

### 3.10 Smaller neighbours and look-alikes

- **es-toolkit/compat ([F](https://es-toolkit.dev/compatibility.html)):**
  - **Q:** "passes Lodash's own test suite";
  - 290 of 295 listed functions are marked done (my count, I);
  - 64.5M weekly downloads against lodash's 171.1M, for 10-21 to 10-27 ([npm API](https://api.npmjs.org/downloads/point/last-week/es-toolkit)).
  - **I:** the most successful "replace this dependency" product of 2026 is a better human-built library, not
    regeneration.
- **Debloaters:** Stubbifier (2021), DepPrune (2024) and LEADER ([arXiv 2503.08969](https://arxiv.org/abs/2503.08969),
  2025) remove unused code, and bundler tree-shaking does the same at build time. The code you do use still comes from
  the third party.
- **Defences at the package-manager layer (F):**
  - npm, pnpm, Yarn and Bun all ship release-age cooldowns
    ([Nesbitt, 03-04](https://nesbitt.io/2026/03/04/package-managers-need-to-cool-down)); pnpm 11 reportedly waits 24
    hours by default;
  - [aube](https://github.com/aubepkg/aube), a Rust package manager for Node created 04-18 with 2,053 stars, checks
    release age and publishing trust and can jail builds;
  - [LavaMoat](https://github.com/LavaMoat/LavaMoat), still active, sandboxes the dependency graph.
  - **I:** each of these answers the npm worms without new code.
- **Equivalence checking:**
  - **F:** differential fuzzing finds 19–35% of LLM refactorings non-equivalent across six LLMs
    ([arXiv 2602.15761](https://arxiv.org/abs/2602.15761), February).
  - **F:** the [difftest](https://github.com/nalediym/difftest) CLI (March, 0 stars) has been dormant since April.
  - **I:** these are parts for the oracle, not competitors.
- **Tracer parts:** Lya, and Datadog's `import-in-the-middle` (used by OpenTelemetry). Boundary interposition is
  available off the shelf.
- **Look-alikes that are not the same thing:**
  - **F:** "Regenerative Software for Python Libraries" ([arXiv 2610.17197](https://arxiv.org/abs/2610.17197), 10-12)
    means re-creating *your own* library from stored knowledge bundles, using a tool called spotregen. It does not
    replace dependencies.
  - **F:** chardet 7.0.0 (March) was an AI "clean-room" rewrite that relicensed the library from LGPL to MIT. Its
    original author objected in issue #327, and commentators call the AI clean-room defence untested
    ([LWN](https://lwn.net/Articles/1061534/), [The Register](https://www.theregister.com/2026/03/06/ai_kills_software_licensing/)).
  - **I:** ports of whole libraries (vibe-porting, [Commit0](https://github.com/commit-0/commit0)) are ports, not
    slices pulled by demand.

---

## 4. Part-by-part map

| Part | Closest prior art (checked) | Status |
|---|---|---|
| **P1** Used slice, per repository | Singla & Davis: 180 pairs, agent plus repository tests | **Taken** (research, single dependency at a time) |
| **P2** Boundary tracer, used projection | Harp and Lexo's "client-observable behavior"; Lya; import-in-the-middle | **Taken** as parts |
| **P3** Function-level units | Lexo (pure functions of about 150 lines or fewer) | **Taken** small; open above that |
| **P4** Isolated original as the oracle | Lexo (isolated environment plus strace) | **Taken** (research; code unreleased) |
| **P5** Clean-room growth | Lexo (the generator never sees the source) | **Taken** (research); the licence question is legally open (chardet) |
| **P6** Promotion beyond tests | Lexo (input/output pairs plus the developers' tests); nirdep (differential, by hand); Eq@DFuzz (evaluation only) | **Partly open:** acceptance gated on held-out calls and a mutation score, with explained divergences, was not found |
| **P7** Provenance and licence | nirdep `eject` keeps the header; Socket keeps licences; Singla & Davis ask for "regeneration provenance metadata" | Open, but small |
| **P8** Catalogue of grown units | Socket registry (139), e18e (about 950 mappings), es-toolkit, Aikido Libraries: all curated whole-package swaps or patched originals | **Open** for grown units keyed by evidence; the incumbents own distribution |
| **P9** Growth on the new call | None found; agent-level self-extension exists (NOOA, Strands, per T08, not re-checked) | Open, but a demo feature rather than a moat |
| **P10** Whole trees, share dissolved, a per-release benchmark | None found: Singla & Davis run one dependency per experiment; Lexo one component | **Open** |
| Refresh when the upstream package changes | Singla & Davis call it necessary; Aikido and Root track CVEs, but for patched originals | **Open** |

---

## 5. What precisely is left: the narrow opening

**I, stated as a deliverable that does not exist yet:**

1. **Dissolving whole trees on evidence.**
   - Take real apps and regenerate the used slice of *every* runtime dependency.
   - Accept a unit only on differential evidence against the isolated original:
     - replay of recorded calls;
     - held-out calls;
     - differential fuzzing seeded from recorded argument shapes;
     - a floor on the mutation score;
     - every divergence explained.
   - Why: in the closest prior work, the repository's tests exercise 25–44% of the generated code for semver, zod,
     chalk, lodash and express (§3.1). Differential checks are known to bite: nirdep's 769 disagreements, and the
     19–35% non-equivalence found by Eq@DFuzz.
2. **A catalogue of grown units, with version keys and re-verification.**
   - Function-level, keyed by package@range, signature and behavioural evidence.
   - Pre-grown from public GitHub usage. Singla & Davis already mined GitHub code search to pick their client
     repositories, so the mining step is known to work.
   - Re-checked automatically when the upstream package publishes.
   - Neither research group proposes a catalogue, and the commercial catalogues are hand-curated whole packages.
3. **A public dissolution benchmark, re-run for every model release.** This is GrowOS's coverage number, transposed.
   Nobody publishes one.
4. **The middle tier.**
   - The easy tier (polyfills, micro-utilities, unused packages) is being absorbed by Node and Bun built-ins, by e18e
     swaps (now applied by agents in production) and by Socket overrides.
   - The hard tier is where Singla & Davis's agent fails: express middleware, axios interceptors, zod class identity.
   - The opening is pure-ish but non-trivial code: parsers, validators, glob and semver, argument parsing, formatting
     and dates.

**Not left:**
- the idea of an agent regenerating used slices;
- clean-room regeneration from input/output pairs;
- the isolated original as the oracle;
- curated drop-in catalogues;
- agent-driven swap PRs;
- trusted rebuilt or patched originals.

**E, who could close the opening within 12 months:**

| Actor | What they have | What they lack | Likelihood |
|---|---|---|---|
| Davis lab, Purdue | The paper, the 180-pair artifact, an explicit list of next steps | Differential and coverage-guided validation | Medium: it is their stated next step, but the lead author's MS ended in May |
| Vasilakis (Brown) and Rinard (MIT) | Lexo, Harp, exoskeletons, Lya | Per-repository slices, larger components, released code | Low to medium: their 2026 papers are on shells and systems |
| Socket | The install channel, intelligence on every npm package, lodash's author, a harness for the originals' tests | Agent generation and differential checks | Medium: technically a short step, but the registry has grown slowly by hand |
| e18e | Community data, a Claude skill, perfbot | Verification of generated snippets | Medium for the easy tier, low for the middle tier |
| Aikido/Root, Chainguard | Agents that write patches, build pipelines, enterprise sales | Any reason to stop shipping the original | Low |

---

## 6. Why the opening may be smaller than it looks (adversarial)

1. **Distribution beats correctness.** A solo catalogue has no install channel. Socket has `socket optimize`, and e18e
   reaches Claude Code directly (I).
2. **"The tests pass" may be good enough for most buyers.** 99.8% with no extra machinery is a strong baseline. The
   oracle has to show divergences that *matter* to the app, not raw counts. Some of nirdep's 72 semver disagreements
   were bugs in semver itself (F/I).
3. **The middle tier may be thin.** Many dependencies are either trivial (already absorbed) or framework-heavy
   (where regeneration fails today). How much of a real tree sits in between is unmeasured, and that share is the
   whole market (I).
4. **Trusted originals cut worm exposure without new code.** Chainguard's (vendor) claim of 99.7% of malicious
   packages blocked, plus cooldowns in every package manager, competes directly with the security pitch (F/I).
5. **The licence risk is live.** Clean-room growth from input/output pairs, Lexo-style, is the best defence, and the
   chardet fight shows it has not been tested in court (F/I).
6. **Release timing.** Lexo's code could appear any week and would cover P4–P5 with an existing citation trail (I).

---

## 7. A cheaper, sharper kill test that this search makes possible

**F.** The Singla & Davis replication package contains, for each of the 180 pairs, the client repository with its
regenerated `local-<dep>` wired in ([README](https://zenodo.org/records/20370439)).

**E, the test: 2–4 days of engineering, compute only, no model tokens.**
- For each of the 166 "passing" replacements, run differential fuzzing between the replacement and the original
  package inside an isolated runner.
- Seed the inputs from the repository's own call sites, then count divergences on inputs the app can actually produce.
- **Continue** if more than about 20% of the passing replacements diverge on reachable inputs. The oracle then has
  measured value over the tests, and §5 items 1–2 are real.
- **Kill, or shrink to a catalogue play,** if almost none diverge. The tests suffice, and the oracle is overhead.

T01's tree-scale test (three real CLIs) becomes round two.

---

## 8. Corrections to round 13

- **T01 missed Lexo.** Lexo covers P4 and P5, the isolated original and clean-room regeneration. T01's "what's left"
  list must drop both.
- **T01's nirdep date.** The repository dates from 2026-08-29 and was a 72-hour hackathon entry. It has been dormant
  since 2026-08-31 and has 2 stars.
- **T01's Effect claim** is verified: the core package has zero external dependencies as of the v4 RC in August. The
  Effect post does not credit AI.
- **T08's Singla & Davis** is now published (ESEM, 10-05). The thesis adds two facts:
  - the agent saw the dependency's source, so it was not clean-room;
  - the tests covered under half of the generated code for 6 of the 9 dependencies.
- **Deno/JSR:** the team joined Cloudflare on 10-09. It is not a competitor.

---

## 9. Verdict: Narrow opening

**Taken:**
- regenerating the used slice per repository with an agent (Singla & Davis, ESEM 2026);
- clean-room regeneration against an isolated original (Lexo, and Harp before it);
- curated replacement catalogues and agent-driven swaps (Socket, e18e, es-toolkit);
- trusted originals (Aikido/Root, Chainguard).

**Open, and only this:**
- dissolving the whole trees of real apps, accepted on differential, held-out and mutation-gated evidence against the
  isolated original rather than on the repository's own tests;
- a catalogue, reused across repositories, of grown function-level units, keyed by version range and re-verified when
  the upstream package changes;
- a dissolution benchmark re-run for every model release;
- aimed at the middle tier of pure-ish, non-trivial libraries.

The window is roughly 6–12 months (E): Singla & Davis have published this as their next step, and Lexo's code could
appear at any time.

---

## TL;DR

1. The core idea is taken: Purdue's ESEM 2026 paper regenerates used slices with Claude Opus 4.6 (180 pairs, 99.8% of checks pass), and Brown/MIT's Lexo regenerates clean-room against an isolated original (86 of 147).
2. Commercially, Socket (139 overrides), e18e (about 950 mappings plus a Claude skill; Claude-authored e18e swap PRs already merge), es-toolkit, Aikido/Root and Chainguard own catalogues and trusted originals. Deno is winding down; nirdep was a dormant hackathon entry.
3. The measured gap: the client tests cover only 25–44% of the generated code for semver, zod, chalk, lodash and express, and no one gates acceptance on differential evidence.
4. Verdict: **Narrow opening.** It covers tree-scale dissolution on differential evidence against the isolated original, a cross-repo catalogue of grown units keyed by version, and a per-release benchmark, for middle-tier libraries.
5. The cheapest decisive test is to fuzz Singla & Davis's 166 passing replacements against the originals from their public artifact (2–4 days, no tokens). If few diverge, kill the oracle story.

---

## Sources (all F, opened or checked on 2026-10-29 unless noted)

- **Regeneration research:**
  - Singla & Davis: [arXiv](https://arxiv.org/abs/2607.13021), [ESEM/LIPIcs](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ESEM.2026.64), [Zenodo artifact](https://zenodo.org/records/20370439), [MS thesis (mirror)](https://gradcoach.com/files/dissertations/software-supply-chains-generative-systems.pdf), [Vaughan's Codex post](https://codex.danielvaughan.com/2026/07/15/software-supply-chains-dead-use-case-regeneration-codex-cli-dependency-replacement-local-synthesis/)
  - Lexo: [arXiv](https://arxiv.org/abs/2510.14522), [v3 HTML](https://arxiv.org/html/2510.14522v3)
  - Harp: [DOI](https://doi.org/10.1145/3460120.3484736)
  - Exoskeletons: [DOI](https://doi.org/10.1145/3766882.3767171)
  - Caruca: [arXiv](https://arxiv.org/abs/2510.14279)
  - ATLAS: [bibliography](https://github.com/atlas-brown/bib), [Lya](https://github.com/atlas-brown/lya)
  - zerodep: [arXiv](https://arxiv.org/abs/2605.21405)
  - Eq@DFuzz: [arXiv](https://arxiv.org/abs/2602.15761)
  - Look-alike: [Regenerative Software for Python Libraries](https://arxiv.org/abs/2610.17197)
  - Debloating: [LEADER](https://arxiv.org/abs/2503.08969)
- **Tools and catalogues:**
  - nirdep: [repo](https://github.com/ewwhardik/nirdep), [post](https://dev.to/ewwhardik/856168-differential-checks-later-what-it-actually-takes-to-delete-your-dependencies-4763)
  - Hackathon Raptors: [organiser page](https://dev.to/raptorsdev)
  - e18e: [module-replacements](https://github.com/e18e/module-replacements), [skills](https://github.com/e18e/skills), [MCP](https://github.com/e18e/mcp), [perfbot](https://github.com/e18e/action-perfbot), [hashintel/hash#10095](https://github.com/hashintel/hash/pull/10095)
  - Socket: [socket-registry](https://github.com/SocketDev/socket-registry), [Optimize](https://socket.dev/features/optimize), [lodash npm metadata](https://registry.npmjs.org/lodash)
  - es-toolkit: [compatibility](https://es-toolkit.dev/compatibility.html), [downloads](https://api.npmjs.org/downloads/point/last-week/es-toolkit)
  - Others: [LavaMoat](https://github.com/LavaMoat/LavaMoat), [aube](https://github.com/aubepkg/aube), [difftest](https://github.com/nalediym/difftest), [Commit0](https://github.com/commit-0/commit0)
- **Vendors and platforms:**
  - [Aikido acquires Root](https://www.aikido.dev/blog/aikido-acquires-root)
  - [Chainguard on npm malware](https://www.chainguard.dev/unchained/mitigating-malware-in-the-npm-ecosystem-with-chainguard-libraries) (vendor claims, via search)
  - [Google OSS Rebuild](https://github.com/google/oss-rebuild) (via search)
  - [Deno joins Cloudflare](https://deno.com/blog/cloudflare)
  - [Bun](https://bun.com/) (banner, via search)
  - [Effect v4 RC recap](https://effect.website/blog/effect-v4-rc-august-recap/)
- **Discourse:**
  - [Ronacher](https://lucumr.pocoo.org/2025/1/24/build-it-yourself/)
  - [Danjou](https://julien.danjou.info/blog/how-much-of-a-library-do-you-actually-use/)
  - [Paulund](https://paulund.co.uk/notebook/ai/small-npm-packages-are-mostly-dead)
  - Nesbitt: [package managers](https://nesbitt.io/2026/01/30/will-ai-make-package-managers-redundant), [skill](https://nesbitt.io/2026/01/21/an-ai-skill-for-skeptical-dependency-management.html), [cooldowns](https://nesbitt.io/2026/03/04/package-managers-need-to-cool-down)
  - [RiskyPlugins](https://riskyplugins.com/blog/the-dependency-model-is-dying)
  - chardet: [LWN](https://lwn.net/Articles/1061534/), [The Register](https://www.theregister.com/2026/03/06/ai_kills_software_licensing/)
