# D2: Grow-install — VALUE (does it matter?)

Round 14 deep dive, 2026-10-29. Completed from the existing research and experiment artifacts using GPT-6.1.
Briefs: [deep dive](../BRIEF-deepdive.md), [tailwind](../BRIEF-tailwind.md). Proposals:
[T01 §3](../tailwind/T01-seed-hunter.md), [T08 §1](../tailwind/T08-self-extending.md).
Prior-art analysis: [D1](D1-growinstall-gaps.md).

**Labels:** **Q** = quotation; **F** = sourced fact or local measurement; **I** = inference; **E** = estimate or proposed
threshold. Transcript timestamps identify caption minute buckets. Proposed products, schedules and demos are not
completed experiment results.

## The answer in one paragraph

**I — Real but narrow.** Owning a small dependency slice can remove an upstream update channel and unnecessary code,
but trades those risks for responsibility for a new implementation. The strongest demonstrated value is a
version-pinned acceptance tool for people already rewriting pure-ish parsers, formatters and validators. In the
completed oracle-guided Haiku run, qs divergence fell below 0.01% on both held-out distributions, yet the replacement
still threw on ordinary-shaped query inputs, missed 38/40,000 minimatch cases and timed out on five of six minimatch
probes. Better generation therefore helps, while checks beyond the generator's chosen tests still matter. This is
not proof that an independent gate is a durable moat: the timing-aware B2 arm is incomplete. Nor did this experiment
build a package manager, trace a real application's demand, demonstrate malicious-original isolation or remove a
runtime tree. A benchmark has zero-user research value; it cannot quietly replace the self-growing functional
artifact the builder asked for.

## 1. Who would care, and how much?

### 1.1 Real pain, with evidence proportionate to the claim

**F — Dependency compromise is a real problem, but incident reach is not measured loss or adoption demand.** Two
primary incident analyses establish different relevant failure modes:

| Incident | What the primary analysis establishes | Implication for Grow-install (I) |
|---|---|---|
| event-stream / flatmap-stream, 2018 | Malicious flatmap-stream 0.1.1 appeared October 5; public suspicion arose November 19–20; npm removal was November 26. The payload targeted Copay. [Snyk post-mortem](https://snyk.io/blog/a-post-mortem-of-the-malicious-event-stream-backdoor/) | A long-lived conditional payload challenges short release delays. Regeneration might omit hidden side effects, subject to its threat model. |
| axios, March 31, 2026 | Compromised 1.14.1 and 0.30.4 added a dependency delivering a cross-platform RAT at install time. Datadog gives an effective window of **00:21–03:25 UTC**, roughly three hours. [Datadog investigation](https://securitylabs.datadoghq.com/articles/axios-npm-supply-chain-compromise/) | A release delay or refusal of the new install script is a much cheaper first defence than replacing axios. |

**F — AI does not remove dependency-selection risk.** A preliminary seven-ecosystem study of **117,062 dependency
changes** reports selection of PR-time known-vulnerable versions in 2.46% of agent changes versus 1.64% of human
changes. This is observational evidence about dependency decisions, not proof that regeneration is safer.
[Singla et al., DepDec-Bench](https://arxiv.org/abs/2601.00205v2).

**Q — Practitioners describe both the demand and the competing baseline:**

- **Ben Davis**, [transcript](../transcripts/32-ben-davis-programming-feels-very-different.txt), **10:00**:
  “especially if it's something that's like under a thousand lines of code, I would rather have Astro just throw
  together a quick implementation for it, dump it in the lib directory, and then that's it.” At **11:00**: “I want
  to keep my dependencies minimal.” Caption spelling retained. This is direct evidence that some developers already
  rewrite small dependencies; it is not a controlled correctness result.
- **Joran Greef**, [transcript](../transcripts/p3-35-software-unscripted-podcast-tigerbeetle-s-spectacular-jepsen-report-wi.txt),
  **0:13:00**: “supply chain attacks are going to be the next swing of the pendulum and how do we solve those?”
- **James Garbutt, e18e lead**, [transcript](../transcripts/p3-64-viteconf-viteconf-2026-5th-edition-we-are-vite.txt),
  **5:36:00**: “the thing that I spend too much time on is uh reducing supply chain footprint”. At **5:38:00**:
  “if you had zero dependencies then great”.
- **Jonathan Blow**, [transcript](../transcripts/p3-37-software-unscripted-podcast-jonathan-blow-on-programming-language-desi.txt),
  **1:06:00**: “it's a workflow that does not encourage active criticism of dependencies”; **1:10:00**: “I want my
  software to compile 10 years from now on an island when I have no internet.” Vendoring also addresses this goal.

**F — There is money in the surrounding problem.** Socket announced a **$60M Series C at a $1B valuation** in May
2026. HeroDevs announced a **$125M investment** in July 2025 and reported over **800 companies** using its services
for deprecated software. These are company-reported figures.
[Socket announcement](https://socket.dev/blog/socket-raises-60m-series-c-press-release),
[HeroDevs announcement](https://www.herodevs.com/press-releases/herodevs-announces-125-million-strategic-growth-investment-from-psg).

**I.** This establishes a market for dependency security and supported legacy originals. It does **not** establish
willingness to pay for regenerated code. HeroDevs customers buy continued expert maintenance, not freedom from
maintenance. Funding valuations are not a revenue forecast for Grow-install.

### 1.2 The cheaper baseline is already substantial

**F — Package-manager controls materially change the comparison.** pnpm's current documentation gives a one-day
`minimumReleaseAge` default and requires allowed dependency build scripts, with `strictDepBuilds` enabled by default.
GitHub documents a three-day default Dependabot cooldown and an exception for security updates. Defaults are
version-specific; they should not be projected onto every installed npm or pnpm version.
[pnpm](https://pnpm.io/supply-chain-security),
[GitHub](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#cooldown).

**I.** Release delays would have avoided the cited short axios window if configured and enforced. Historical attack
windows do not establish a general prevention rate: patient attackers can wait, and delays can also postpone fixes.
The earlier draft's retrospective cooldown examples are motivation for a baseline, not a universal safety result.

**F — Script blocking is insufficient by itself.** Semgrep's July 2026 AsyncAPI investigation found a dropper that
ran on `require()`, with no lifecycle install scripts, and packages published with valid GitHub OIDC provenance.
[Primary investigation](https://semgrep.dev/blog/2026/miasma-v3-asyncapi-npm-hardening/).

**I.** Runtime replacement can remove that particular code from a shipped application, but build tooling can also
execute imports. Neither “all worms are install-time” nor “turning off scripts solves supply-chain compromise” holds.
Lockfiles, provenance, cooldowns, capability restrictions and retained originals are complementary baselines.

**F — Three selected app manifests, resolved in the original study, have the following lockfile counts.** The
saved manifests and lockfiles are in `d2exp/apps/` under the evidence root in §3.1; counts were rechecked from their
`packages` entries, excluding the root. “Runtime” means entries not marked `dev`, not measured execution.

| Selected manifest | Total entries | Runtime entries | Dev/build entries |
|---|---|---|---|
| Vite + React + TypeScript | 224 | 3 (1.3%) | 221 |
| Next.js 16 + Tailwind | 444 | 54 (12.2%) | 390 |
| Express 5 API, including axios, lodash, zod, pg and jsonwebtoken | 319 | 119 (37.3%) | 200 |

**I.** These are synthetic selected manifests, not a representative ecosystem census, deployed application or risk
measurement. They show why deleting runtime utility dependencies alone leaves much of a development install tree.
They do not show that front-end security value is zero, that build dependencies cannot eventually be regenerated,
or that 37% of risk is removable in Node services. A compromised reference also still has to be obtained and run
somewhere: the build-safety claim requires a separate, effective isolation design.

### 1.3 Other value, and the size of the possible middle tier

**I — Useful potential benefits survive the security critique:**

- **Local ownership:** retain the used behavior of a sticky or abandoned dependency without maintaining its entire
  public API. The owner still inherits patching, review and incident response.
- **Consumer-side removal:** replacing a direct dependency's used slice can eliminate its private subtree without
  waiting for upstream maintainers. Shared dependencies and other consumers can prevent removal.
- **Availability and inspection:** source kept in the application is readable and available offline. Ordinary
  vendoring already supplies these benefits; regeneration must earn its extra risk through a smaller useful slice.
- **Footprint:** less installed or executed code may help. Compare with production installs, bundler tree shaking,
  built-ins and curated e18e/Socket substitutions. Package counts alone do not establish bytes, latency or safety.

**I, classification of F lockfile data — preserve as a hypothesis, not measured growability.** The earlier study
classified the Express manifest's 119 runtime entries as follows:

| Tier | Entries | Examples |
|---|---|---|
| Intrinsics, polyfills and small helpers | 45 (38%) | get-intrinsic/side-channel families, safe-buffer, inherits, lodash shims |
| Pure-ish non-trivial operations | 51 (43%) | qs, semver, cookie, negotiator, mime-types, validators, date/type conversions |
| Frameworks, I/O, streams and protocols | 23 (19%) | express, router, body-parser, axios, pg and protocol helpers |

**I.** The middle tier is not obviously empty in this selected tree, but boundaries are subjective. The original
classification also included jws/jwa: cryptographic functionality is not an attractive early regeneration target.
Fifty-one entries are not 51 proven opportunities, nor 43% of code, trust or attack surface. Removing qs from an
Express tree requires replacing the behavior Express needs, not merely the app's direct imports. Whole-tree
replacement requires package-to-package compatibility, shared state and compositions as well as app call tracing.

### 1.4 Who would care?

**I/E — Judgments grounded in the evidence above, not customer interviews.**

| Audience | Likely value | Adoption obstacle |
|---|---|---|
| Authors who deliberately minimize dependencies | Reviewable local slices with reproducible acceptance evidence | Often satisfied with hand rewrites or ordinary agents; limited demonstrated budget |
| Developers already asking agents to inline utilities | Catch semantic drift and expensive hostile inputs before merging | An equally instructed stock agent may provide the same checks |
| Owners of a small EOL dependency surface | Retain needed behavior without a large fork | Must maintain the replacement; supported original may be cheaper overall |
| AppSec teams | Evidence and upstream advisory linkage for rewrites happening anyway | Rewrites create code with no automatic package-CVE identity; no measured net risk reduction |
| Agent/tool vendors and researchers | A reusable test integration and reproducible comparison | Incumbents own distribution; publication interest does not establish product demand |

## 2. Does the next model help, or make it obsolete?

### 2.1 Steelman: there is a technical tailwind

1. **I — More difficult slices become affordable.** Better models could implement more parser semantics and handle
   larger compositions inside a fixed acceptance structure. Accepted code then runs without inference. This is the
   strongest version of the original idea, but the present small study does not measure a trend across generations.
2. **F/I — Reference feedback adds information that memory-only generation lacks.** Lexo reports **86/147** benign
   components passing its I/O pairs and developer tests, averaging roughly **30 minutes and under $0.10** per
   component in its setup. Its ten attack examples support a restricted threat model, not universal payload removal.
   It limits effects and generally small components; its Python implementation is prior-art evidence, not the
   proposed implementation path. [Lexo v3](https://arxiv.org/html/2510.14522v3).
3. **I — Upstream change supplies continuing work.** A pinned implementation can be checked when a new reference
   appears; the measured qs and minimatch drift in §3.3 makes this concrete. Stronger models may repair changes faster.
4. **F/I — Tests selected for functionality can miss security behavior.** Checkmarx reports **83–95% functional**
   versus **24–36% secure-and-functional** success on selected SusViBes tasks; 65–75% of working outputs retained
   the target vulnerability. The post explicitly warns that tasks were chosen around vulnerable features. These are
   benchmark-conditioned rates, not rates for all generated code. Its threat-modeling and review interventions
   improved results, so it also supports trying better agent instructions.
   [Checkmarx's commissioned study summary](https://checkmarx.com/blog/zombie-cves-put-to-rest-by-humans-dug-back-up-by-ai-agents/).
5. **F/I — Models can improve the checks too.** ProbeGen found counterexamples for **18%** of samples accepted by a
   synthesis benchmark's tests. That supports execution-backed evaluation, including model-generated evaluation;
   it does not establish that a human-written gate always wins.
   [Allamanis and Yin](https://arxiv.org/abs/2502.18473).

### 2.2 Attack: technical progress is not durable project value

1. **I — The easy replacement becomes an ordinary agent task.** Ben Davis already describes the workflow. e18e
   supplies curated replacements and agent tooling; Socket supplies replacement packages and delivery through
   overrides. A future model can absorb more of this work. [D1 §§3.5–3.6](D1-growinstall-gaps.md).
2. **I — The agent can run the original too.** The B-Haiku workflow demonstrates useful oracle-guided repair from a
   task brief. It used a delegated minimatch worker and admitted unresolved self-test disagreements. It weakens the
   claim that designing a basic differential loop is itself a large barrier; it does not demonstrate the complete
   Grow-install system or even the isolated-oracle part.
3. **I — Cheap recomputation weakens a code-only catalogue.** Reuse still saves latency, testing and review, especially
   for hard cases. But a catalogue's value cannot be justified merely by counting functions that another agent can
   regenerate cheaply. Version contracts and costly executed validation matter more than generated LOC.
4. **I — Better prompting might absorb the gate.** “Measure timing on adversarial patterns” may close much of the
   apparent advantage. **B2 did not finish, so this central objection is unanswered.** Protected tests avoid direct
   training on the evaluation cases; they do not prove that generator and evaluator must be different models or
   organizations. Fresh contexts, different test distributions, tools and models can all improve self-review.
5. **F/I — Existing research occupies the broad mechanism.** Singla and Davis preserved **64,477/64,634** repository
   checks across 180 dependency/consumer pairs, with 166 pairs preserving all baseline checks. They explicitly call
   for stronger differential and coverage-guided validation. This is a strong baseline with stated limits, not a
   claim of complete equivalence. [Primary paper](https://arxiv.org/html/2607.13021v1).

**I — Net:** better models should improve the grower, and probably the evaluator. Neither direction automatically
increases the value of this particular package manager. The residual hypothesis is an acceptance and maintenance
system that remains useful when generation is supplied by an ordinary agent. Its value must be measured against
that agent with equally good instructions, not against an intentionally uninformed rewrite.

## 3. The concrete one-shot test

### 3.1 Evidence, scope and completion status

**F — Exact absolute evidence root:**

`/Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/d2exp/`

The local evidence is not committed to the repository. Under that root:

- `harness/`: `gen.mjs`, `run.mjs`, `worker.mjs`, `redos.mjs`, `harvest.mjs`, summary and inspection helpers.
- `corpus/`: saved npm versions/ranges and repository paths used by the generators.
- `originals/`: pinned `semver@7.8.5`, `minimatch@11.0.3`, `qs@6.17.1`, with a lockfile.
- `runs/`: saved generated implementations and reference/self wrappers.
- `results/`: JSON checks, timing logs and version-comparison results. The main completed model rows are
  [A-haiku](</Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/d2exp/results/A-haiku.json>),
  [A-fable](</Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/d2exp/results/A-fable.json>) and
  [B-haiku](</Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/d2exp/results/B-haiku.json>).

**F — Completion audit:**

| Arm/artifact | Evidence available | Treatment |
|---|---|---|
| A-Haiku 5.5, A-Fable 5.1 | Finished implementations, final full functional results and timing logs | Main comparison |
| B-Haiku 5.5 | Finished workflow/output, final full results and timing logs; unresolved self-test disagreements admitted | Main comparison, not claimed converged |
| A-Opus 5.5 | Generation reported finished; saved official evaluation is preview-only | Supplementary preview, not pooled with full rows |
| A-Sonnet 5.5 | Interrupted/rate-limited; preview covers semver and minimatch; saved qs is partial | Incomplete; no capability-failure inference |
| B-Fable 5.1 | Interrupted/rate-limited; saved implementations exist but no final experiment result | Incomplete; no capability-failure inference |
| B2-Haiku, explicit timing requirements | Partial work; no `minimatch-lite.mjs` and no final result | **Unanswered**; cannot test whether timing instructions remove the gate advantage |
| REF-2025, REF-2026H1, SELF | Handwritten wrappers loading actual packages | Controls, not model runs |

**F/I.** Completion used saved artifacts; it did not restart model-generation arms. Additional execution of saved
files does not turn an interrupted generation into a completed experimental arm. The separate older `oneshot/`
experiment is excluded. Model names are historical run labels, not an independently established capability ranking.

### 3.2 Design and what the judge actually checks

**F — Task surface:**

- semver: `valid`, `satisfies`, `gt`, `compare`, `coerce` (only `.version`), `maxSatisfying`, `inc`, `validRange`;
- minimatch: POSIX `minimatch(path, pattern, {dot, nocase, matchBase})`;
- qs: default `parse(str)` and `stringify(obj)`.

**F — Instructions:** A asked for a from-memory implementation without original source/network/npm. B made installed
originals available as black boxes and asked for a differential tester and iteration. Budgets were approximately
20 and 45 minutes respectively; recorded runs sometimes exceeded the nominal A budget. These were agentic tasks
with tools and iterations, not one model response. B-Haiku delegated its minimatch work. The earlier draft recorded
roughly 28 minutes and 379k tokens for B; these are operational run context, not an independently audited bill or a
reproducible cost estimate for future models.

**F — Inputs:** the corpus includes 62,565 versions and 105,906 range specifications from 156 npm packages, plus
3,619 repository/installed-package paths. “Realistic” distributions combine these with generated ranges, patterns
and API-style query strings. The adversarial distributions are grammar fuzz: invalid versions/ranges, globs,
braces/extglobs, prototype keys, malformed encodings and surrogate cases. These are constructed distributions, not
observed production request frequencies.

**F — Measurement:** each full row checks **560,000 inputs**: semver 8 functions × 20,000 × 2 distributions;
minimatch 40,000 × 2; qs 2 functions × 40,000 × 2. The harness deduplicates inputs within each function/distribution.
Package rates pool functions with equal sample allocations. They are not traffic-weighted or independent trials.
`SELF.json` checks **84,000** inputs and reports zero divergences.

**F — Comparison limits:** the harness canonicalizes object key order and output values; a throw on both sides counts
as matching even if error types differ. The semver `coerce` comparison intentionally ignores fields other than
`.version`. It checks some `Object.prototype` changes, not all mutation, effects or ambient state. All completed main
functional rows have full checked counts, no watchdog hang/crash and no recorded pollution.

**F — Crucial isolation correction:** `worker.mjs` loads the reference and candidate in the **same worker**, with
ordinary Node privileges. The watchdog can terminate slow work; it does not deny filesystem/network access or safely
contain a malicious original. Shared globals can also affect comparison. This is a benign-reference functional
test harness, **not T01's isolated oracle**. Production-grade isolation remains unimplemented and untested here.

### 3.3 The reference packages themselves move

**F — Older-release comparisons, from `results/drift-*.json`.** These used the smaller drift-run sample, generally
20,000 inputs per minimatch/qs function/distribution; their percentages need not exactly equal the full-row rates.
Release dates were checked against the primary npm registry `time` metadata.

| Earlier release | Pinned comparison | Realistic differences | Adversarial differences |
|---|---|---|---|
| semver 7.7.2, May 2025 | 7.8.5, June 2026 | 0 | One `maxSatisfying` case in the 10k function sample |
| minimatch 10.0.3, June 2025, through 10.2.6, July 2026 | 11.0.3, October 28, 2026 | About 0.09% | About 0.33% |
| qs 6.14.1, December 2025 | 6.17.1, October 28, 2026 | 214/20k `parse` (1.07%) | 56.8% `parse`; 15.2% `stringify` |
| qs 6.15.0, February 2026 | 6.17.1 | 0 | 51.4% `parse`; 15.2% `stringify` |
| qs 6.16.0, August 2026 | 6.17.1 | 0 | 5/20k `parse` (0.025%); 15.2% `stringify` |

**F — Examples and primary sources:** qs 6.15 changes object/scalar conflicts under default `strictMerge`; e.g.
`sort[limit]=x&sort=true` changes from `{sort:{limit:'x',true:true}}` to `{sort:[{limit:'x'},'true']}`. Later releases
include merge bounds, prototype-key handling and lone-surrogate encoding fixes. minimatch 11 changes matching
behavior; `!(*.test).nycrc` against `.nycrc` distinguishes the pinned and older behavior in the selected corpus.
[qs changelog](https://github.com/ljharb/qs/blob/v6.17.1/CHANGELOG.md),
[npm qs metadata](https://registry.npmjs.org/qs), [npm minimatch metadata](https://registry.npmjs.org/minimatch),
[npm semver metadata](https://registry.npmjs.org/semver).

**I.** Version fidelity matters independently of implementation quality. A valid replacement for one pinned version
may legitimately differ from another. Not every upstream change is a security fix, and not every difference matters
to a consumer. Recent publication is **not** evidence of a model's training cutoff or what information it could know.
These measurements establish drift and a reason to consult current references, not the contents of training data.

### 3.4 Completed results

**F — Functional divergence against the pinned originals.** “Real” means the constructed realistic distribution.
Timing is a separate test, not included in the functional denominator. LOC are saved file line counts, not semantic
size or quality. REF rows combine three real historical packages; they do not represent a model's training snapshot.

| Arm | semver real | semver adv | minimatch real | minimatch adv | qs real | qs adv | minimatch timing timeouts / 6 | LOC semver / minimatch / qs |
|---|---|---|---|---|---|---|---|---|
| REF-2025: 7.7.2 / 10.0.3 / 6.14.1 | 0 | <0.01% | 0.095% | 0.3225% | 0.49875% | 36.1725% | 5 | Original wrappers |
| REF-2026H1: 7.8.0 / 10.2.5 / 6.15.0 | 0 | 0 | 0.095% | 0.3225% | 0 | 33.58625% | 2 | Original wrappers |
| A-Haiku 5.5, memory | 0 | 1.5569% | 0.095% | 0.020% | 0.49875% | 36.2175% | **5** | 698 / 524 / 356 |
| A-Fable 5.1, memory | 0.115% | 0.0425% | 0.095% | 0.3225% | 0.49875% | 36.2175% | **5** | 575 / 859 / 285 |
| B-Haiku 5.5, oracle-guided | 0 | 0 | 0.095% | 0 | **0.00375%** | **0.00375%** | **5** | 587 / 562 / 358 |

**F — Concrete decomposition:**

- **The memory rewrites resemble older releases on this corpus.** Both A-Haiku and A-Fable have 0/80k realistic qs
  divergences against qs 6.14.1 and 130/80k adversarial divergences (0.1625%), much closer than against 6.17.1.
  A-Fable's minimatch has 0/80k functional divergences against 10.2.6, while still failing timing probes. This is
  behavioral resemblance on tested inputs, not proof of exact equivalence, memorization or a particular cutoff.
- **A-Fable has a concrete semver error beyond drift:**
  `satisfies('3.0.0-rc.6', '3.0.0-rc.2 - 3.0.0-rc.6')` is false in its output and true in the reference. Its full
  realistic row has 5 `satisfies` and 179 `maxSatisfying` divergences; its adversarial row has 67 `validRange` and
  one `maxSatisfying` divergence. The latter also occurs in semver 7.7.2. “One genuine error” would be too strong.
- **B-Haiku improved qs substantially**, to 3/80k divergences in each distribution. All six differences are in
  `parse`: **3/40k = 0.0075% per parse distribution**, versus **0.00375%** after pooling `parse` and `stringify`.
  Semver has 0/320k divergences; minimatch still differs on **38/40k realistic cases** and 0/40k adversarial cases.
- **The qs error is reachable, not a demonstrated process crash.** A reduced case is
  `parse('a[]=' + 'x'.repeat(21) + '&a[b]=y&a[0]=z')`: B-Haiku throws `TypeError`, while qs 6.17.1 returns
  `{a:{0:['xxxxxxxxxxxxxxxxxxxxx','z'],b:'y'}}`. Whether this becomes a 500 response, a caught error or a process
  failure depends on integration. Twenty `x` characters do not trigger this reduced case.
- **B did not actually reach zero in its own tests.** Its final run report admitted 1,747 qs parse mismatches
  (roughly 1%) in its self-test distribution and 42 minimatch disagreements. Its self-test and the independent
  judge used different inputs and denominators; both can be accurate. It is evidence of substantial repair,
  not a completed convergence result.

**F — Timing interpretation:** `results/*.redos` records a six-second worker budget. Every completed model arm
exceeded it on five of six minimatch probes, while the pinned original completed the probes in milliseconds
(roughly 1–2 ms; a fresh original-only audit found about 1 ms). The five timeouts comprise two globstar probes,
a repeated-star/literal pattern, a nested extglob and an overlapping-alternative extglob. They are not five CVEs.
Two reproduced families match the maintainer advisories:
[CVE-2026-27903](https://github.com/isaacs/minimatch/security/advisories/GHSA-7r86-cg39-jmmj) and
[CVE-2026-27904](https://github.com/isaacs/minimatch/security/advisories/GHSA-23c5-xmqv-rm74), patched in 10.2.3 on
that major line. The `stars k=30` probe did **not** reproduce CVE-2026-26996 and must not be counted as a third CVE.
Exploitation requires attacker influence over the relevant inputs; ordinary trusted configuration is a different
threat model. Six-second timeouts establish the measured lower bound, not infinite execution or a complexity proof.

**F — Supplementary previews, excluded from the main table:** saved A-Opus preview results contain 0/40k realistic
semver differences, 1/40k adversarial semver, 9/10k realistic and 25/10k adversarial minimatch, and 104/20k realistic
and 7,212/20k adversarial qs differences. A-Sonnet's saved preview contains the same semver/minimatch counts but no
qs evaluation. These are smaller and possibly intermediate snapshots; they cannot support a model ranking.

**I — Study limits:** one observed completed run per arm; only three packages and selected APIs/defaults; no random
package selection, deployment, mutation gate, formal proof or net-security comparison. Roughly 10% of the constructed
realistic qs inputs combine scalar and nested uses of a key, according to the earlier analysis: the distribution
intentionally exercises reachable edge cases and is not a traffic sample. The hand-selected timing probes and one
seed cannot establish general error rates. A zero result means no difference found by these checks. The study
shows that functional and timing checks can disagree; it does not show that the next model is inherently less safe.

### 3.5 What survives the one-shot objection?

| Claimed durable contribution | What this study establishes | Assessment (I) |
|---|---|---|
| Writing the used function | Substantial implementations are generated from a brief | Weak barrier; not the main asset |
| Running a differential repair loop | B-Haiku does useful repair, with delegation and admitted remaining differences | Basic loop is increasingly ordinary agent work |
| Isolating a possibly malicious reference | Not implemented here | **Untested**, not disproven as a contribution |
| Demand tracing and safe growth at unsupported boundaries | No live consumer tracing or T08 `NeedsGrowth` contract tested | **Untested** |
| Held-out inputs, timing and other acceptance criteria | Independent judge finds misses in completed outputs | Useful now; durable advantage over an equally instructed agent **unanswered** |
| Shared catalogue, compositions and release refresh | Old-release drift measured; no complete catalogue or refresh system | Need is plausible; cost and advantage unmeasured |

**I — One-shot verdict:** the broad resistance claim is **not established**. The experiment weakens the claim that
basic generation plus an oracle loop needs a bespoke platform, while preserving a concrete need for better
acceptance criteria. It does not prove that self-review can never work. Because **B2 is incomplete**, the experiment
cannot distinguish a durable checking substrate from an omitted timing requirement in the prompt. It also does not
resolve T08's stronger question: can an explicitly partial library detect unsupported inputs before returning a
plausible wrong answer, then grow while preserving compositions?

## 4. Realistic solo ceiling: one year and three years

**F — Calibration:** prior work ranges from Lexo's small-component study to Singla and Davis's 180
consumer/dependency pairs; D1 describes curated replacements and the whole-tree gap. Here only three selected API
surfaces were tested, and none of the generated minimatch versions clears the timing gate. Generation throughput
cannot be extrapolated directly into a count of hardened packages.

**E — One year, full-time solo, Rust/TypeScript/JavaScript implementation:**

- **A credible target:** about **20–50 deliberately scoped operation families**, drawn from perhaps **10–20 packages**,
  with explicit options/domains and real public consumers. This is a planning range, not a benchmark-derived forecast.
  At a week or more for each difficult contract/test family, it already consumes much of a year.
- **Engineering:** support ordinary CJS/ESM imports in a bounded Node environment; use an existing OS isolation
  mechanism for reference execution; implement immutable version contracts, reproducible promotion, advisory linkage
  and refresh. Full transparency across proxies, classes, callbacks, native add-ons and all package boundaries is a
  stretch, not a baseline promise.
- **Functional proof of usefulness:** several public consumers can run on retained slices with inference disabled,
  with actual imports removed and installation/byte measurements against the best mundane baseline. Report which
  dependencies remain rather than promise an Express tree of 119 → 25 packages.
- **Evidence:** repeatable functional, hostile-input and timing checks, a small mutation audit and known limitations.
  No plausible claim of universal equivalence or security certification.

**E — Three years, conditional on improved generation:** a coherent source-owned utility library spanning perhaps
**100–300 scoped operation families**, dozens of public consumers and repeated upstream refresh cycles is an
ambitious plausible ceiling. Cross-package compositions, effects and unsupported-domain detection could make this
substantially harder than the counts suggest. Robust general replacement of axios/Express or arbitrary dependency
trees remains speculative. A collection of narrowly scoped units is a more credible result than thousands of
fully hardened packages.

**I — Commercial ceiling:** likely a tool or integration for deliberate dependency ownership, possibly consumed by
e18e, a package manager or a security vendor. Existing actors have distribution and a natural route to add the
feature. There is no evidence here for a solo enterprise-security business, acquisition outcome, user count or
revenue estimate. A capable open-source artifact is plausible; financial defensibility is unproven.

**I — Fit to ambition:** the full retained-library system is technically ambitious enough, but an impressive hard
implementation is not sufficient. It must provide demonstrable ownership and footprint value that ordinary
vendoring plus a better agent does not already supply.

## 5. An honest six-week demo, and what would kill it

**E — Scope:** one real public Node consumer, two or three dependency families, and a Rust/TypeScript coordinator
using existing isolation. Keep production inference off. Exclude cryptography, framework identity and arbitrary
I/O replacement. The saved three-package study is a useful baseline, not the demo's finished implementation.

| Week | Reviewable result |
|---|---|
| 1 | Pin the consumer, versions, actual call surface and best baseline: production install, tree shaking/curated swaps, and ordinary vendoring plus an equally instructed agent. Freeze independent evaluation inputs. |
| 2 | Contain reference execution; record ordinary calls and preserve error/effect contracts for the chosen pure-ish surfaces. Document where tracing does not work. |
| 3 | Grow the first retained slices; reject functional, timing and capability failures. Keep the dependency if any required surface remains unsupported. |
| 4 | Remove actual imports and unnecessary installed packages. Measure bytes, install time and runtime overhead; run the consumer with inference disconnected. |
| 5 | Add a real unsupported requirement. Show an explicit growth request instead of silently guessing; extend support and replay accepted compositions. |
| 6 | Check a known upstream behavior change, publish minimal counterexamples and rerun the ordinary-agent baseline with the same requirements. Report failures alongside removals. |

**E — The compelling demonstration:** the consumer keeps working after selected dependency imports disappear;
newly supported behavior becomes deterministic local code. Show a superficially correct rewrite rejected by a
minimal semantic or timing counterexample, then show the repaired implementation accepted. Retain another
unsupported dependency so the demonstration visibly reports its boundary. This demonstrates both usable code and
the acceptance mechanism; a screen full of passing checks alone does not.

**I — What a skeptical expert should say:**

1. **“Your result argues for keeping the original.”** Correct for many consumers. Regeneration needs a separately
   demonstrated ownership/footprint benefit; finding bugs in rewrites is not a reason to start rewriting.
2. **“Just tell the agent to test timing.”** Unanswered by this study: B2 was interrupted. An acceptance product must
   beat this fair baseline before claiming prompt resistance.
3. **“You knew these CVEs.”** Correct. Scaling probes over input size can find more pathologies, but n/2n/4n timings
   are heuristic and noisy, not a general complexity proof. Resource budgets and restricted algorithms can help.
4. **“Your tests cannot prove safe behavior on unseen inputs.”** Correct. T08 requires narrower domains, proofs or
   exhaustive checking where a supported-domain claim is stronger than tested confidence.
5. **“The rewrite falls out of SCA coverage.”** Link every slice to the exact reference version and advisory feed;
   new advisories should trigger review and retesting. That linkage does not automatically transfer a fix or prove
   that the advisory's supplied example covers the replacement's exposure.
6. **“You have not removed the build supply chain.”** Correct. Measure remaining production and development trees
   separately. The reference acquisition/runner and the code generator themselves remain trusted infrastructure.

**E — Cheapest decisive next experiment, not performed in this completion:** spend **2–3 days** completing a fresh
timing-aware B2 comparison against the frozen independent judge, with the same API/version contract and repeated
seeds. Give ordinary vendoring plus a stock agent equally explicit requirements. Then integrate one real consumer
and measure actual removal, bytes and overhead. Do not count a package removed until its required domains,
latency and consumer checks pass.

**I — Stop conditions:** stop or shrink the product hypothesis if the equally instructed ordinary agent matches the
gate with comparable effort, if reductions merely duplicate built-ins/e18e/tree shaking, if unexpected inputs
cannot be recognized without retaining the original on the hot path, or if maintenance outweighs the ownership
benefit. Benchmark publication remains a valid research outcome, but it is not a rescue of a failed product thesis.

## 6. Value with zero users

| Artifact | Value without external adoption (I) | Limit |
|---|---|---|
| Retained slices running a real public consumer offline | Real: inspectable, smaller source-owned behavior and a reproducible functional demonstration | Must actually run and improve on mundane baselines; not yet demonstrated by these isolated function runs |
| Acceptance tool and regression suite | Real engineering utility for the builder's own dependency rewrites | Other agents may reproduce it; testing confidence is bounded |
| This benchmark and counterexamples | Real research value: reproducible facts about selected replacements and version drift | Not proof of market value, general model capability or a durable moat |
| Large unused code catalogue | Potential option value and saved review/recomputation | Size alone establishes neither trust nor demand; refresh costs continue |

**I.** No customers, private data or community are required to build and evaluate the narrow functional artifact.
That satisfies the operational “solo/no users needed” condition. Whether its utility is compelling enough for the
builder remains conditional on a real consumer and a fair agent baseline. The brief explicitly rejected
package-behavior atlases and evidence commons. Therefore “build a judge and publish a benchmark” cannot be presented
as though it satisfies the original preference for self-growing useful software. The benchmark supports the
decision; the retained, useful library would have to carry the project.

## 7. Source and interpretation corrections from the unfinished draft

**F/I — Corrections incorporated above:**

- **Outcome versus safety:** replace “functional equivalence is a prompt away” with measured low divergence on
  selected APIs. B-Haiku retained errors and admitted self-test mismatches. The same-worker runner is not malicious
  package isolation, and B used delegation.
- **Incomplete arms:** A-Sonnet, B-Fable and B2 cannot be scored as model capability failures. A-Opus's saved preview
  is supplementary. No model ranking or longitudinal capability/security trend follows from these runs.
- **Recall and freshness:** older-version resemblance is evidence about outputs, not proof of memorized source,
  training contents or cutoff. A release published yesterday does not establish model ignorance.
- **Timing:** two reproduced CVE families, not three. The maintainer advisories are the primary sources, replacing
  secondary CVE summaries. Passing a finite fuzz suite never proves safety; timing growth probes are also heuristic.
- **Dates:** npm metadata dates minimatch **10.0.3 to June 12, 2025**, not July 2024. Datadog's axios effective window
  ends **03:25**, not 03:15. event-stream's suspicious behavior was discussed November 19–20, but npm removal was
  November 26; those are different endpoints.
- **Defences:** current pnpm/GitHub documentation replaces secondhand default claims. Semgrep's import-time attack
  prevents a blanket “install scripts off solves it” conclusion. A selected manifest's runtime share is not its
  removable risk share.
- **Security benchmarks:** Checkmarx's 65–75% figure is conditional on working outputs in vulnerability-selected
  tasks. Its positive prompting/review interventions also matter. It is not evidence that generators can never
  evaluate themselves successfully.
- **Dropped unsupported number:** the earlier “34% of agent-imported versions hallucinated” attribution is not
  supported by the currently accessible [Endor page](https://www.endorlabs.com/learn/when-ai-imports-vulnerable-dependencies-securing-ai-generated-code).
  That page discusses hallucinated names and separately reports a vulnerability statistic; neither substantiates
  the draft's 34% claim.
- **Prior art:** D1's corrections stand: Lexo/Harp already cover important oracle/regeneration mechanisms;
  Singla/Davis already study used-slice regeneration. Effect's zero external runtime dependencies do not by
  themselves verify the transcript's attribution of that result to AI. No clean-room or licensing guarantee is
  inferred from behavioral testing.

**F — Rechecking the saved main rows:** from the evidence root,
`node harness/summary.mjs A-haiku A-fable B-haiku REF-2025 REF-2026H1 SELF` summarizes raw JSON. Read the separate
`results/*.redos` logs for timing; the functional summary's zero hangs does not include those probes.
`harness/table.mjs` provides rounded package rates. Exact numerators and checked counts are in the JSON, and the
source files explain what is compared. Evidence remains at the absolute scratch path in §3.1 and is not a portable
published benchmark artifact.

## 8. Verdict: Real but narrow

**I — Main reason:** a version-pinned acceptance tool has concrete utility for people already replacing bounded
utility slices. Oracle feedback produced a large measured qs improvement, and independent inputs plus timing found
important residual problems. Those are real findings, not evidence for safely replacing an arbitrary dependency
tree or eliminating supply-chain risk.

**I — Against the original filter:** technical model tailwind is plausible; durable resistance to an ordinary agent
is unproven. The isolated oracle, demand-driven partial domains, whole-tree integration and economically useful
retained artifact were not demonstrated. **B2 remains unanswered**, so the strongest objection—one explicit timing
requirement removes the apparent gate advantage—remains live. The broad package-manager/security pitch is weak on
the current evidence. Continue only with the bounded functional demo and a fair prompt baseline, not a large
catalogue build. If only the benchmark succeeds, call it useful research and stop claiming the original idea passed.

## TL;DR

1. **I — Real but narrow:** useful acceptance tooling for deliberate utility rewrites; broad package-manager/security value is unproven.
2. **F — Each completed model row checks 560,000 inputs; B-Haiku qs has 3/80k differences per distribution, but minimatch still differs on 38/40k realistic inputs.**
3. **F/I — All three completed model arms time out on five of six minimatch probes; two CVE families reproduce, and finite tests confer no safety proof.**
4. **I — Better models help generation and may absorb the checks; B2 is incomplete, so prompt resistance and a durable moat remain unanswered.**
5. **E/I — Build one real consumer demo with retained offline slices and an equally instructed agent baseline; benchmark-only value does not satisfy the builder's functional-artifact goal.**
