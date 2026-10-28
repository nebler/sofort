# 05 — Lens B: the software-production pipeline at agent scale

2026-10-28 · research sub-agent · brief: `arch/research/flip/BRIEF.md`

Scope: version control, code review, CI/build, package ecosystems, issue tracking, monorepos, release
engineering. The question is which human-scale assumptions break when agents produce 10–100× more commits,
branches, PRs, CI runs and packages; which old ideas fix the break; who is already fixing it; and where the gap is.

Labels: **F** sourced · **M** measured or computed here · **I** inference · **E** estimate.
"F (2nd)" means the figure is sourced, but only through secondary coverage of a primary source I could not open.

---

## 1. The scale shock in numbers (2024–2026)

| What | Number | Source |
|---|---|---|
| GitHub commits, Octoverse 2025 (Sep 2024–Aug 2025) | "nearly 1 billion" pushed (986M, +25% YoY); record ~100M in Aug 2025 | **F** [Octoverse 2025](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/) |
| GitHub PRs merged, same period | 518.7M (+29%); 43.2M/month average | **F** same |
| Copilot coding agent PRs | 1M+ created May–Sep 2025 | **F** same |
| Actions, public repos | 11.5B CPU-minutes (+35%) | **F** same |
| GitHub commits, Apr 2026 | 275M/week, "on pace for 14 billion this year" | **F** Kyle Daigle (GitHub COO), [via Simon Willison, 2026-04-04](https://simonwillison.net/2026/Apr/4/kyle-daigle/) |
| Actions minutes | 500M/week (2023) → 1B/week (2025) → 2.1B "so far this week" (Apr 2026) | **F** same |
| GitHub commits, Aug 2026 | "Since April, monthly commits have grown from 1.4 billion to 2.9 billion." GitHub added >3M CPU cores and 120 PB of storage; Azure now carries ~58% of load, up from 12% in May; a 7 h 47 min outage on Aug 17 | **F** [GitHub, "The August 17 outage, and the work ahead", 2026-08-20](https://github.blog/news-insights/company-news/the-august-17-outage-and-the-work-ahead/) |
| Implied growth | 2025 averaged ~82M commits/month; Aug 2026 ran at 2.9B/month, **~35×** in about a year. The two numbers may count different scopes, so treat the multiple as ±2× | **E** |
| Agent-opened PRs | ~4M (Sep 2025) → 17M+ (Mar 2026) | **F (2nd)** The Information, via [danilchenko.dev](https://danilchenko.dev/posts/2026-04-11-github-ai-agents-pull-requests/) |
| Claude Code share of public commits | ~0.7% (week of 2025-09-29) → ~4% (early Feb 2026, ~135k/day) | **F (2nd)** SemiAnalysis, 2026-02-05, via [it-connect](https://www.it-connect.fr/github-submerge-par-ia-microsoft-contraint-de-faire-appel-a-aws/) |
| Microsoft renting AWS capacity for GitHub overflow | reported 2026-06-16 | **F (2nd)** Business Insider, via [letsdatascience](https://letsdatascience.com/news/github-capacity-surge-pushes-microsoft-to-aws-13a2ffa4) |
| Anthropic monorepo | 2,500 merges/day (May 2026) → **30,000+/day** (Sep 2026); ~25M CI checkouts/day (>600 PB/day if fetched naively); ~100 GB history; >25 GB working copy | **F** [Anthropic, "Redesigning source control", 2026-10-13](https://www.anthropic.com/engineering/redesigning-source-control) |
| Agents per engineer at Anthropic | ~10–15 parallel Claude agents | **F (2nd)** [Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/the-pulse-anthropic-builds-its-own) |
| Google baseline, Jan 2015 | ~16,000 human + ~24,000 automated changes per workday | **F (2nd)** Potvin & Levenberg, [CACM 59(7), 2016](https://research.google/pubs/why-google-stores-billions-of-lines-of-code-in-a-single-repository/) (full text paywalled; figures via [CACM full text mirror](https://cacmb4.acm.org/magazines/2016/7/204032-why-google-stores-billions-of-lines-of-code-in-a-single-repository/fulltext)) |
| Google TAP, 2016 | per average day: 13K projects, 800K builds, 150M test runs; "a code commit every second"; per-commit testing cost "growing quadratically" | **F** Memon et al., [ICSE-SEIP 2017](https://research.google/pubs/taming-google-scale-continuous-testing/) (read in full) |
| Review load | heavy AI users merged +98% PRs, review time +91% (Faros 2025); median review time 5×, 31% more PRs merged with no review (Faros 2026) | **F (2nd)** via [getunblocked](https://getunblocked.com/blog/ai-productivity-paradox/) |
| OSS maintainers | GitHub lets repos turn off PRs or limit them to collaborators (2026-02-13), caps open PRs per non-collaborator (Jun 17), restricts issue creation (Jun 30) | **F** [changelog 2026-02-13](https://github.blog/changelog/2026-02-13-new-repository-settings-for-configuring-pull-request-access/); [VS Magazine](https://visualstudiomagazine.com/articles/2026/06/30/github-extends-contribution-controls-from-prs-to-issues.aspx) |
| CI pricing | $0.002/min platform fee on self-hosted runners announced Dec 2025, then postponed | **F** [GitHub changelog 2025-12-16](https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/); [The Register](https://www.theregister.com/2025/12/17/github_charge_dev_own_hardware/) |
| PyPI 2025 | 3.9M new files; 130K new projects; >2,000 malware reports; 20% of uploads via trusted publishing | **F** [PyPI 2025 in review](https://blog.pypi.org/posts/2025-12-31-pypi-2025-in-review) |
| Registries overall | 9.8T downloads in 2025; 454,600 new malicious packages (vendor count) | **F (2nd)** Sonatype 2026, via [opensourcesecurity.io](https://opensourcesecurity.io/2026/2026-03-SOTSSC-Brian-Fox/) |
| npm worms | Shai-Hulud: 500+ packages (Sep 2025); "2.0": ~796 (Nov/Dec 2025); TanStack wave (May 2026) shipped with **valid SLSA L3 provenance** after Actions-cache poisoning | **F** [GitHub npm plan, 2025-12-15](https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/); [Aikido](https://www.aikido.dev/blog/shai-hulud-trusted-publishing); [Endor Labs](https://www.endorlabs.com/learn/shai-hulud-compromises-the-tanstack-ecosystem-80-packages-compromised) |
| Agent PR concurrency | 79.4% of agent PRs belong to co-active pairs. Replayed three-way merges show a 41.7% textual-conflict rate for cross-agent pairs and 19.8% within one agent; 84% of conflicted files are source code | **F** Xu et al., [arXiv:2607.04697](https://arxiv.org/abs/2607.04697) (33,596 PRs) |
| Semantic ("passes alone, fails together") interference | Mined Django PR pairs: 1 of 834 runs; constructed tasks: 97% | **F** Xia, Wu, Park, [arXiv:2609.25396](https://arxiv.org/abs/2609.25396) |

The point: GitHub-wide commit volume grew about 35× in a year. Anthropic's merge rate grew 12× in four months.
Google needed Piper, CitC, TAP and post-submit culprit finding to absorb **40,000 changes per workday in
2015, 60% of them automated**. Agents are bringing Google-2015 churn to every organisation that runs a fleet,
without Google's infrastructure. **I**

---

## 2. Where the toolchain is actually breaking, layer by layer

| Layer | Human-scale assumption | Evidence it broke | Old idea that fits | Who is fixing it (2025–26) | Gap? |
|---|---|---|---|---|---|
| **Storage and serving** (git protocol, packfiles, mirrors) | Few, mostly-offline clients; clone once | GitHub outage and capacity crunch, 2.9B commits/month; Anthropic: hundreds of mirrors, 25M checkouts/day | Piper (central, server-side ops), CitC/EdenFS (virtual working copies), Mononoke/Bonsai (content-addressed changesets), VFS for Git/Scalar | **Crowded.** Anthropic Scion (internal), Cursor Continuity/Origin, GitHub read scaling, Entire ($60M seed), Pierre Code Storage ($23M), Cloudflare Artifacts, ERSC (jj's author as CTO), Shopify CEO's `walgit` | No. Prior art plus 8+ funded efforts |
| **Integration** (merge queue, "main is green") | Serial queue under a global lock; a human waits | Anthropic: "What does CI even mean when hundreds or even thousands of changes can merge while tests are running?" They dropped the global lock for post-merge testing plus Claude-fixed conflicts. A serial queue caps at 144 merges/day with 10-min CI (§3) | Not-Rocket-Science rule/bors (2014), Zuul speculative gating (2012+), Uber SubmitQueue (2019), **Google TAP milestones + culprit finding** (2017), FACF (2023), SafeRevert (2024) | Pre-merge queues: GitHub, Graphite (now Cursor), Mergify, Aviator, Trunk. Graph partitioning needs Bazel/Nx. Post-merge plus culprit finding plus auto-revert exists only in-house (Google, Chromium LUCI, Anthropic) | **Yes.** No product does post-merge integration with flake-aware culprit finding (§5 idea 1) |
| **CI compute** | Commits are scarce; run everything per PR | Actions 1B → 2.1B min/week; TAP: per-commit cost grows as commits × tests | Content-addressed caching (Vesta, Nix, Bazel), regression test selection (Rothermel–Harrold 1997, Ekstazi 2015), predictive selection (Meta 2019) | BuildBuddy, EngFlow, NativeLink, Nx/Turbo caches; Develocity PTS; CloudBees Smart Tests (Launchable, acquired Aug 2024); Datadog TIA | Small. Anchorage measured affected-test selection saving 1.6 s/PR on their repo |
| **Build definitions** | Humans hand-maintain BUILD graphs, so only big companies do | Anchorage rejected Bazel in 2022 because of the upkeep, then adopted it in 2026 because agents maintain it | Vesta → Blaze/Bazel; Nix | EngFlow any2bazel (Sep 2026), Fuchsia BEADS, Bazel's AI Bzlmod migration, Flox | Being done (Lens A flip in progress) |
| **Review** | One human reads every line | Review time +91% to 5×; 31% merged unreviewed; GitHub lets maintainers shut off PRs | Change-based review (Mondrian → Rietveld → Gerrit), Phabricator stacked diffs, OWNERS/Herald rules, semantic diff (1994), early cutoff | GitHub stacked PRs (preview 2026-07-30), Graphite → Cursor, AI reviewers (Bugbot, CodeRabbit…), Anthropic Antique ("semantic constraints on approvals") | Partly. Machine-checked evidence of "no behaviour change" is missing (§4, idea 7) |
| **Packages** | Maintainers are humans; provenance = who uploaded | Worm waves; malicious-package counts rising; PyPI's safety team is ~1 person; valid provenance on malicious builds | Reproducible builds (Thompson 1984 → Debian 2013), diverse double-compiling (Wheeler 2005/2009), Nix | Google OSS Rebuild (Jul 2025, top packages; README goal "AI-driven rebuilds"), Chainguard Libraries (commercial rebuild-from-source), trusted publishing | **Yes, long tail.** Independent rebuild verification beyond the top ~10K packages (idea 2) |
| **Merge semantics** | Humans resolve the occasional conflict | Cross-agent conflict rate 41.7% | Darcs/Pijul patch theory, semistructured merge (Apel 2011), Mergiraf, jj first-class conflicts | LLMs: ~55–59% match vs 36.7% for the best structured tool (2nd-hand); Anthropic says Claude fixes conflicts "faster than humans can even identify them" | No. Models absorb it |
| **Issues** | Humans file issues | GitHub restricts issue creation (Jun 2026) | Duplicate-report detection (Runeson et al., ICSE 2007) | LLM triage everywhere | No |

---

## 3. Computed: why serial and batched merge queues collapse at agent rates (M)

Script: `/tmp/flip-scale-code/queue.py` (deleted after the run; the formulas are below).

- A serial queue merges at most 1440/T changes a day. With T = 10 min CI that is **144/day**, far below Anthropic's 30,000.
- A batched queue (bors/GitHub/Mergify batching) tests B = λ·T changes together. Let p be the residual
  rate: the chance that a change which passed its own presubmit still breaks trunk in combination. Then
  P(batch clean) = (1−p)^B, and the queue must bisect whenever a batch fails.

| merges/day λ | batch B (T=10m) | p_resid | P(batch clean) | expected culprits/batch | independent partitions K needed for P(clean) ≥ 0.9 |
|---:|---:|---:|---:|---:|---:|
| 2,500 | 17 | 0.5% | 0.92 | 0.09 | 1 |
| 30,000 | 208 | 0.1% | 0.81 | 0.21 | 2 |
| 30,000 | 208 | 0.5% | 0.35 | 1.04 | 10 |
| 30,000 | 208 | 1% | 0.12 | 2.08 | 20 |
| 300,000 | 2,083 | 0.1% | 0.12 | 2.08 | 20 |
| 300,000 | 2,083 | 1% | ≈0 | 20.8 | 199 |

Post-merge milestone testing with adaptive binary splitting (TAP-style) costs about 1 + c·⌈log₂B⌉ suite runs
per milestone, where c = p·B culprits:

| λ | p_resid | suite runs per change (post-merge) | vs. per-change on tip |
|---:|---:|---:|---:|
| 30,000 | 0.1% | 0.013 | 1.0 |
| 30,000 | 1% | 0.085 | 1.0 |
| 30,000 | 5% | 0.41 | 1.0 |
| 300,000 | 1% | 0.12 | 1.0 |

What this shows (**I**, from **M**):

1. Above ~10³ merges/day, **pre-merge integration on one queue stops working** unless p_resid is under 0.1% or the
   repo splits into 10–200 independent partitions. Partitioning needs a precise dependency graph, and most repos
   don't have one.
2. Post-merge plus bisection costs **8–75× fewer integration runs** at p_resid between 0.1% and 1%. The price is
   a red-trunk window and dependence on flake-aware bisection. Google's TAP made this trade in 2016 for the
   same reason; Anthropic reached it again in 2026.
3. **Better models lower p_resid, which makes post-merge cheaper still.** The approach gets stronger as models
   improve, which is the superhuman-model test.

The model leaves out flakiness. Real bisection under flakes needs repeated runs, which is exactly what Google's
flake-aware culprit finding (Bayesian noisy binary search) solves. Expect the true costs to be 2–3× the table. **E**

---

## 4. Measured: how many commits leave the shipped binary byte-identical? (M)

Question for idea 7: can a reproducible content-addressed build ("early cutoff") take a meaningful share of
changes off the human review queue? Experiment: the last 151 first-parent commits of
[junegunn/fzf](https://github.com/junegunn/fzf) (a Go CLI, a human-written repo, as of 2026-10-25). For each
commit I built a stripped, VCS-free binary
(`go build -trimpath -buildvcs=false -ldflags='-s -w -buildid='`) and compared its SHA-256 with the previous
commit's. Scratch lived in `/tmp/flip-scale-code`, under 200 MB, and was deleted at the end.

To compare, I also classified each commit with a typical "safe path" filter. A commit counted as
non-shipping if it touched only `*_test.go`, `*.md`, `test/`, `.github/`, `man/`, `shell/`, install scripts and similar.

| | binary changed | binary byte-identical | total |
|---|---:|---:|---:|
| path filter says "touches source" | 75 | **9** | 84 |
| path filter says "docs/tests/scripts only" | **22** | 45 | 67 |
| total | 97 | 54 | 151 |

All 151 commits built (0 failures). Each build took a few seconds on an M4 Pro.

Findings (**M**, one repo, darwin/arm64 only, human-written history):

- **36% (54/151) of commits left the shipped binary byte-identical.** Those changes could not have altered the
  shipped program's behaviour on that platform.
- **The path filter was wrong in 31/151 commits (21%):**
  - **22 commits (15%)** it would have waved through as "docs/scripts" actually changed the binary. fzf
    `go:embed`s its `shell/*.{bash,zsh,fish,nu}` scripts and `man/man1/fzf.1`, so a man-page edit is a
    shipped-artifact change. This is the dangerous direction.
  - **9 commits (11% of source-touching commits)** it flagged as source changed nothing: comment and test
    cleanups, Windows-only files on a darwin build, Ruby test dependencies, `make tag`.
- Caveats: build tags mean every target platform has to be built (`f273de1e` "Detect terminal resize on Windows" is
  identical on darwin, and correctly so). A real gate hashes all release artifacts. Agent-written histories probably have more
  mechanical churn than this one (**I**, not measured).

Verdict for idea 3: it passes its own kill test (more than 5% of source-touching commits were artifact-identical), but only
modestly. The sharper result is the converse. **"Did the shipped artifact change?" is a cheap, strong oracle that
beats path-based routing in both directions.** Path-based routing ("docs-only PRs skip review or CI") is common and
was wrong for 15% of commits here, in the unsafe direction.

---

## 5. The ideas (12), with the per-idea template

Ranked order is in §6. Each idea follows the brief's nine points: (1) idea, who, when · (2) why it died or stayed
niche · (3) what flipped · (4) oracle · (5) superhuman-model test · (6) who is doing it in 2025–26 · (7) value ·
(8) 2-week proof · (9) demo, tweet, killer reply, kill test.

### Idea 1 — Post-submit integration for everyone: milestone testing + flake-aware culprit finding + evidence-carrying auto-revert

1. **Idea:** Let changes land after their own presubmit. Test trunk *snapshots* ("milestones") continuously,
   find culprits by bisection that accounts for flakes, and revert or fix-forward automatically with evidence attached. Google TAP (described in
   [Memon et al. 2017](https://research.google/pubs/taming-google-scale-continuous-testing/)); git bisect (2005); Chromium Findit →
   [LUCI Bisection](https://chromium.googlesource.com/infra/luci/luci-go/); [Flake-Aware Culprit Finding, ICST 2023](https://research.google/pubs/flake-aware-culprit-finding/);
   [SafeRevert, ICST 2024](https://research.google/pubs/saferevert-when-can-breaking-changes-be-automatically-reverted/).
   The opposing tradition is pre-merge gating: Graydon Hoare's "Not Rocket Science Rule" ([2014 essay](https://graydon2.dreamwidth.org/1597.html), bors),
   Zuul speculative gating ([OpenStack, 2013 talk](https://docs.openstack.org/infra/publications/2013-linuxcon_na-zuul/)),
   Uber SubmitQueue (EuroSys 2019, "Keeping Master Green at Scale"; conflict analysis described in [Uber, "Slashing CI costs at Uber"](https://www.uber.com/us/en/blog/slashing-ci-costs-at-uber/)). **F**
2. **Why niche:** Only Google-class churn ("a commit every second") forces it. Below that, presubmit plus a
   serial or batched queue is simpler and keeps main green by construction. Culprit finding also needs flake
   history and a revert culture. Dropbox's Athena (2019) deliberately did *not* auto-revert. **F/I**
3. **What flipped:** merge rates. Anthropic went from 2.5k to 30k/day in four months and dropped the global queue
   lock. GitHub went from 1.4B to 2.9B commits/month in four months. A serial queue tops out at 144/day (§3). Batch queues
   fail more than 50% of the time at λ = 30k unless p_resid ≤ 0.3% (§3). Agents also make *fix-forward* cheap: the culprit
   finder hands an agent a minimal repro instead of just reverting. **F/M**
4. **Oracle: strong.** Tests on snapshots; re-runs to separate flakes; confirmation by revert-then-green; the
   culprit's own presubmit history.
5. **Superhuman test:** gets **more valuable**. More changes per hour. Better models lower p_resid, which makes
   post-merge cheaper. Nothing a model does makes a 10-minute integration test free. **I**
6. **Who does it:** Google (internal), Chromium LUCI (open source, tied to LUCI/Buildbucket), Anthropic
   (internal, on Scion), Meta (internal). Vendors (GitHub merge queue, Graphite/Cursor, Mergify, Aviator, Trunk)
   sell **pre-merge** queues, plus flaky-test quarantine (Mergify, 2026-07-24). Searches on 2026-10-28 found no product
   combining post-merge milestones, flake-aware culprit finding and auto-revert for GitHub repos. That is
   absence of evidence, not proof. **F/I**
7. **Value:** orgs whose merge rate passes ~10³/day. An org of 300 engineers × 10 agents × 5 PRs/day is
   15k/day, which is plausible for agent-heavy orgs in 2026–27 given Anthropic's curve. **E** CI saving: about 12× fewer
   integration runs at p_resid = 1% (§3, **M**), on a bill measured in billions of minutes a week platform-wide. Price
   anchor: Graphite (stacked review plus merge queue) sold to Cursor reportedly above its $290M valuation. **F (2nd)**
8. **2-week proof (TypeScript):** (a) a replay simulator: take a real repo's last 5,000 commits and its CI
   outcome history (GitHub API), inject breaking changes at p ∈ {0.1, 1, 5}% and per-test flake rates measured
   from that history; (b) a re-implementation of FACF's Bayesian bisection (~300 LOC); (c) a GitHub App that runs milestones on
   `main`, files a revert PR carrying its posterior ("P(culprit)=0.97, 6 runs") and offers an agent fix-forward.
   Compare against a serial queue, a batched queue and a partitioned queue on: red-trunk minutes/day, CI runs per change,
   false-revert rate, merge latency p95.
9. **Demo:** a live dashboard on a demo repo absorbing 10k agent PRs/day. Queue latency stays flat; red-trunk minutes
   and auto-reverts each come with a posterior.
   **Tweet:** "Your merge queue caps at 144 merges/day with 10-min CI. Anthropic merges 30,000. Google solved this in 2016:
   land first, test snapshots, bisect with Bayes, revert with evidence. Here it is for GitHub: 12× fewer CI runs."
   **Killer reply:** "Post-merge means main is red for everyone during bisection. Agents branch from red main and
   cascade, and SafeRevert exists because auto-revert on flaky signals reverts innocent changes."
   **Kill test:** on replayed real history with measured flake rates, kill if false reverts exceed 1% of reverts, or
   red-trunk time exceeds 10% of the day at p_resid = 1%. Also kill if GitHub or a queue vendor ships post-merge
   bisect-and-revert before the proof.

### Idea 2 — Agent-grown independent rebuilds for the package long tail ("reproducible builds, finally at registry scale")

1. **Idea:** Rebuild every published package from its tagged source in an independent environment and compare it with
   the published artifact (bit-for-bit, or with an explained diff). Mismatches are evidence of tampering. Ken Thompson,
   ["Reflections on Trusting Trust", CACM 1984](https://dl.acm.org/doi/10.1145/358198.358210); David A. Wheeler,
   [diverse double-compiling (2005; PhD 2009)](https://dwheeler.com/trusting-trust/); Debian Reproducible Builds (2013→,
   [reproducible-builds.org](https://reproducible-builds.org/)); Nix (Dolstra, [PhD 2006](https://edolstra.github.io/pubs/phd-thesis.pdf)). **F**
2. **Why niche:** labour. Every package needs a build recipe and its own nondeterminism fixes, done by volunteers,
   one package at a time. Registries ship whatever the maintainer uploads. Debian-scale effort never reached npm or PyPI scale. **F/I**
3. **What flipped:** (a) volume and attacks. PyPI added 130K new projects in 2025, and npm worm waves keep coming.
   The May 2026 TanStack wave carried *valid SLSA L3 provenance*, so provenance alone was not enough. Shai-Hulud
   injected payloads into tarballs that were not in the git repos. **F** (b) Agents can write build recipes:
   BuildBench (NeurIPS 2025) reports 64% strict success for a Claude-3.7-based agent on diverse OSS, against 10%
   for prior tooling. **F** [arXiv:2509.25248](https://arxiv.org/abs/2509.25248)
4. **Oracle: strong.** The published artifact itself. Bit-identical, or a diffoscope-explained diff, is
   GrowOS-shaped: fault (no recipe or mismatch) → agent writes recipe → diff against the published tarball → accept.
5. **Superhuman test:** gets **more valuable**. Attackers also get better models, and package volume grows. Rebuild
   verification checks the *build path*, which no model capability makes trustworthy. It says nothing about
   malicious source, so the scope is narrower than "supply-chain security". **I**
6. **Who does it:** [Google OSS Rebuild](https://github.com/google/oss-rebuild) (Jul 2025; npm, PyPI, crates; ~9.5K packages at launch
   per [Willison](https://simonwillison.net/2025/Jul/23/oss-rebuild/); the README lists "AI-driven rebuilds" as a goal).
   Chainguard Libraries (commercial rebuild-from-source; claims 88% of npm's top 500 and 94% of customers' Python deps).
   Reproducible Central (Maven), rebuilderd (Arch/Debian). **F** Gap: the long tail and *multi-party*
   attestations. Today one vendor's rebuild is its own product, not evidence that a third party accepts. **I**
7. **Value:** security budgets (Socket, Chainguard, Endor, Snyk buyers). The payoff is "evidence another party
   accepts", the scarcity that survived the earlier moonshot rounds. The proposition is narrower than malware
   scanning. **I**
8. **2-week proof:** the top 5,000 npm packages that ship *built* artifacts (TS→JS, bundles) and are not in OSS
   Rebuild. An agent infers a recipe in a sandbox, rebuilds from the git tag, normalises the tarball, and diffs.
   Report the coverage gained and the cost per package, plus how many replayed Shai-Hulud/TanStack-compromised
   versions are flagged.
9. **Demo:** "We rebuilt 5,000 npm packages from git with agents. 4,1xx match byte-for-byte. Here are the N that don't, and why."
   **Killer reply:** "Google already does this and says AI rebuilds are next. Chainguard sells it. Your long tail is
   unused packages." **Kill test:** agent rebuild success below 30% on the long tail, or OSS Rebuild announcing
   agent-inferred recipes at scale.

### Idea 3 — Review early-cutoff: route changes whose shipped artifact did not change away from humans

1. **Idea:** Treat review like a build with early cutoff. If a change leaves every shipped artifact byte-identical
   under a reproducible build, its behaviour cannot have changed, so human attention goes elsewhere. Humans review
   only the changes whose output hash moved, ranked by which artifacts moved. Sources: early cutoff (Mokhov, Mitchell, Peyton Jones,
   [Build Systems à la Carte, ICFP 2018](https://dl.acm.org/doi/10.1145/3236774)); Yocto Hash Equivalence (2019); Jackson & Ladd,
   "Semantic Diff" (ICSM 1994); Godlin & Strichman, "Regression verification" (DAC 2009). **F**
2. **Why niche:** review was cheap relative to writing code, and reproducible builds were rare. **I**
3. **What flipped:** review is now the bottleneck (+91% to 5× review time). Anthropic's Antique already encodes
   "comment-only vs sensitive logical" approval constraints by hand. **F**
4. **Oracle: strong** for compiled artifacts (a byte-identical binary). Weak for dynamic languages, which need normalised
   bytecode or AST.
5. **Superhuman test:** more valuable, because review attention stays scarce. But it only clears the *boring*
   share. The risky changes are exactly the ones whose output moves. **I**
6. **Who does it:** Antique (internal, rule-based); a `refactor-verifier` agent skill (per-definition body hashes);
   Bazel/target-determinator compute affected targets but don't gate review. No product found. **F/I**
7. **Value:** measured in §4 on one repo. 36% of commits were artifact-identical, and 11% of source-touching ones. A path filter misrouted 15% of commits in the unsafe direction. The defensible product is a CI/review check that answers "did any shipped artifact change, and which?", not auto-approval. **M/I**
8. **2-week proof:** the §4 experiment across 20 repos in Go, Rust and TS, plus a GitHub check that labels "artifact-identical" PRs.
9. **Kill test:** the §4 share of *source-touching* commits that leave the artifact identical. If it is under ~5%, a
   path filter (docs/tests/CI) gets almost all the value and the idea is dead.

### Idea 4 — Agent-maintained hermetic, content-addressed builds (Vesta → Blaze/Bazel, Nix)

1. Vesta, DEC/Compaq SRC (Heydon, Levin, Mann, Yu: [SRC-RR-168, 2001](https://vesta.sourceforge.net/doc/pubs/src-rr-168/); book 2006).
   It recorded all build dependencies automatically and cached results that were provably correct to reuse. Nix (Dolstra 2004/2006);
   Blaze (Google, ~2006) → Bazel (2015). **F**
2. Died outside giants because of BUILD-graph upkeep. Anchorage rejected Bazel in 2022 because keeping
   the dependency map current was too costly for a small team. **F** [Anchorage, 2026-09-03](https://www.anchorage.com/research/when-agents-write-the-code-the-tooling-trade-offs-flip)
3. Flipped: agents do the upkeep. Anchorage adopted Bazel in 2026 and kept CI at ~3 min while Go packages doubled (188→366). **F**
4. Oracle strong: the same outputs and tests pass before and after migration.
5. Superhuman test: more valuable (more changes per hour, and caching saves compute). **I**
6. **Already being done:** EngFlow [any2bazel](https://blog.engflow.com/2026/09/09/introducing-any2bazel-oss-bazel-migration-tool/) (Sep 2026),
   Fuchsia BEADS agent skills, Bazel's AI-driven Bzlmod migration, Flox "deterministic agents". **F**
7. Value: consulting and remote-execution vendors (EngFlow, BuildBuddy, Aspect) capture it.
8. Proof: not worth it, since the flip is already happening.
9. Kill reason: someone already does this.

### Idea 5 — Traced (inferred) dependency graphs for repos without BUILD files

1. Vesta's automatic dependency recording; Ekstazi (Gligoric, Eloussi, Marinov,
   [ISSTA 2015](https://dl.acm.org/doi/10.1145/2771783.2771784)); forward/tracing build systems (Rattle, OOPSLA 2020; Microsoft BuildXL); safe
   regression test selection (Rothermel & Harrold, [TOSEM 1997](https://dl.acm.org/doi/10.1145/248233.248262)). **F**
2. Niche because per-language instrumentation is fiddly, and full runs were affordable. **I**
3. Flipped: CI minutes doubled in a year. Graph-partitioned merge queues (Trunk, Aviator, Mergify) *require* a graph. **F**
4. Oracle strong: full-suite results must equal selected-suite results (a safety check).
5. Superhuman test: neutral to positive.
6. **Already done** by pytest-testmon, Jest `--findRelatedTests`, Datadog TIA (per-test coverage), Develocity PTS,
   CloudBees Smart Tests, Nx affected. Counter-evidence: Anchorage measured affected-test selection at **1.6 s per PR**
   and rejected it. **F**
7. Value is small for repos with small suites. The big-suite cases are covered by vendors.
8–9. Kill reason: mostly done; it is a feature, not a bet.

### Idea 6 — Build-graph-partitioned speculative merge queue (Zuul, SubmitQueue)

1. Zuul (OpenStack, James Blair, ~2012) tests the speculative future state of the queue in parallel. Uber SubmitQueue (EuroSys 2019)
   added a conflict analyzer over the build graph. **F**
2. Niche until monorepos plus Bazel existed.
3. Flipped: agent concurrency (§1, §3).
4. Oracle strong.
5. Superhuman test: neutral. It helps only when p_resid is high.
6. **Done:** Trunk (Bazel parallel queues), Aviator (affected targets from Bazel/Nx/Turbo), Mergify
   [Parallel Scopes, 2026-04-13](https://docs.mergify.com/changelog/2026-04-13-parallel-scopes.md), Graphite. **F**
7–9. Not a gap. Idea 1 is the complement for repos without a graph or above the partition ceiling (§3).

### Idea 7 — Central, server-side version control with virtual working copies (Piper/CitC, Mononoke/EdenFS, VFS for Git)

1. Google Piper/CitC (Potvin & Levenberg, CACM 2016); Meta Sapling/Mononoke/EdenFS (open-sourced 2022); Microsoft
   VFS for Git (2017) → Scalar (in git since 2.38). **F**
2. Stayed in-house: only giants needed it, and git's offline model won the market. **F/I**
3. Flipped: always-online agents. Anthropic: git's offline-first design "was actively undermining" scaling. **F**
4. Oracle strong (git compatibility and round-trip of history).
5. Superhuman test: more valuable. **I**
6. **Crowded:** Anthropic Scion (seven engineers, five months, 200× smaller infrastructure; credits Mononoke/Bonsai after an
   attribution dispute), Cursor Continuity/Origin (S3 WAL + CAS), GitHub, Entire (570k clones/hour claimed),
   Pierre Code Storage, [Cloudflare Artifacts](https://blog.cloudflare.com/artifacts-git-for-agents-beta/) (git on Durable Objects, $0.15/1k ops),
   [ERSC](https://ersc.io) (jj creator as CTO, "scale beyond git" storage beta), Shopify CEO's walgit. **F**
7–9. Not a single-engineer gap. Kill reason: someone (eight someones) already does this.

### Idea 8 — Change-based review with stacked diffs (Mondrian → Rietveld → Gerrit; Phabricator)

1. Google Mondrian (~2006) → Rietveld (2008) → Gerrit (2008/09, Android); Facebook Phabricator/Differential
   (~2007, open-sourced 2011; Phacility wound down 2021). **F**
2. Stayed niche because GitHub's branch-PR model won by default. **I**
3. Flipped: smaller, dependent agent changes; review queues. **I**
4. Oracle: weak (human acceptance).
5. Superhuman test: stacked diffs matter *less* if review shifts to intent; still useful for ordering. **I**
6. **Done:** [GitHub stacked PRs](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests) (`gh stack`, preview 2026-07-30),
   Graphite → Cursor (Dec 2025), Sapling ReviewStack, Devin stacked PRs. **F**
7–9. Not a gap.

### Idea 9 — Patch theory and structural merge (Darcs, Pijul, semistructured merge, Mergiraf, jj)

1. Darcs (David Roundy, 2002–03); Pijul (Meunier & Becker) on Mimram & Di Giusto's
   [categorical theory of patches (2013)](https://arxiv.org/abs/1311.3903); semistructured merge (Apel et al., FSE 2011);
   Mergiraf (2024); jj first-class conflicts. **F**
2. Died on Darcs' exponential merge cases, git's network effect, and per-language grammar labour. **F/I**
3. Flipped: cross-agent conflict rate of 41.7%. **F**
4. Oracle: medium (tests after the merge, plus agreement with the developer's resolution).
5. Superhuman test: **obsolescing.** LLMs already match human resolutions more often than structured tools
   (55–59% vs 36.7%, **F (2nd)**). Anthropic: Claude fixes conflicts "faster than humans can even identify them". The real risk is
   semantic interference, which is rare in mined pairs (1/834) and caught by tests. **F/I**
6. Pijul is still in 1.0 beta (beta.22, Aug 2026); Mergiraf, LastMerge and jj are active. **F**
7–9. At most a zero-token pre-filter before the LLM. Not a bet.

### Idea 10 — Operation-based / CRDT version control (OT 1989, CRDTs 2011)

1. Ellis & Gibbs, "Concurrency control in groupware systems" (SIGMOD 1989); Shapiro et al., CRDTs (2011). **F**
2. Niche in VCS: snapshots and commits matched how humans work. **I**
3. Flipped: agents edit continuously, and edit-level provenance becomes useful. **I**
4. Oracle: weak.
5. Superhuman test: neutral.
6. **Done:** Zed DeltaDB/Delta ([2025 announcement](https://zed.dev/blog/introducing-deltadb), waitlist 2026). **F**
7–9. Not a gap.

### Idea 11 — Universal content-addressed source archive and intrinsic IDs (Software Heritage, SWHID)

1. Software Heritage (Di Cosmo & Zacchiroli, launched 2016, [iPRES 2017](https://hal.science/hal-01590958));
   [SWHID became ISO/IEC 18670 in Apr 2025](https://openchainproject.org/news/2025/04/29/from-heritage-to-hash-swhid-becomes-a-global-iso-iec-standard). Archive: >22B unique files (Dec 2024). **F**
2. Works, but stays academic and archival. **I**
3. Flipped: provenance and licence questions for generated code. **I**
4. Oracle strong (hashes).
5. Superhuman test: neutral.
6. Done by SWH itself.
7. Weak buyer. Rejected.

### Idea 12 — Issue de-duplication and triage (Runeson et al., ICSE 2007)

LLM triage subsumes it, and GitHub chose to *gate* issues rather than triage them. Rejected. **I**

---

## 6. Ranking

| # | Idea | Lens | Oracle | Superhuman test | Prior-art risk | Gap is real? |
|---|---|---|---|---|---|---|
| 1 | Post-submit integration + flake-aware culprit finding + evidence auto-revert | B | strong | more valuable | medium (in-house at Google/Anthropic/Chromium; no product found) | **yes** |
| 2 | Agent-grown independent rebuilds for the package long tail | A+B | strongest | more valuable (narrow scope) | high (OSS Rebuild says "AI-driven rebuilds"; Chainguard) | long tail only |
| 3 | Review early-cutoff (artifact-identical changes skip humans) | B | strong (compiled) | more valuable, but only the boring share | low | modest: 11% of source commits; path filters wrong 21% (§4) |
| 4 | Agent-maintained Bazel/Nix | A | strong | more valuable | done (any2bazel, BEADS) | no |
| 5 | Traced deps / test selection | B | strong | neutral | done | no |
| 6 | Graph-partitioned speculative queues | B | strong | neutral | done | no |
| 7 | Server-side VCS + virtual workspaces | B | strong | more valuable | crowded (8+) | no |
| 8 | Stacked diffs | B | weak | less valuable | done | no |
| 9 | Patch theory / structural merge | B | medium | obsolescing | LLMs | no |
| 10 | CRDT VCS | B | weak | neutral | Zed | no |
| 11 | Software Heritage / SWHID | B | strong | neutral | SWH | no buyer |
| 12 | Issue dedup | B | weak | obsolete | LLMs | no |

**Top 3:** (1) post-submit integration for everyone, (2) agent-grown independent rebuilds, (3) review early-cutoff.

**The ONE bet: idea 1, post-submit integration for GitHub repos.** It is the only break where:

- the owner of the problem said in public that the human-scale design failed ("What does CI even mean…");
- the arithmetic shows pre-merge queues collapsing at agent rates (§3);
- the old fix is documented in detail (TAP 2017, FACF 2023, SafeRevert 2024);
- the oracle is strong;
- better models make it *cheaper*, not obsolete;
- no product does it today.

The risk is that it becomes a feature of GitHub or the merge-queue vendors rather than a company. The 2-week proof
(replay simulator + Bayesian bisection + GitHub App) settles whether false reverts and red-trunk time are acceptable
before anyone builds more.

**TL;DR**
1. Agent scale is real and measured: GitHub commits went 1.4B → 2.9B/month (Apr → Aug 2026), Actions passed 2B min/week, and Anthropic went from 2.5k to 30k merges/day in four months.
2. Storage, serving and virtual workspaces (Piper/CitC/Mononoke ideas) broke first and are already being rebuilt by Anthropic, Cursor, GitHub, Entire, Pierre, Cloudflare and ERSC. That layer has no gap left.
3. The unsolved break is integration. Serial or batched merge queues collapse above ~10³ merges/day (computed), and Anthropic abandoned the global lock.
4. The fitting old idea is Google's TAP model (land, test snapshots, flake-aware Bayesian bisection, safe auto-revert): ~12× fewer integration runs at 1% residual breakage. Only Google, Chromium and Anthropic run it, in-house.
5. Runners-up: agent-grown reproducible rebuilds for the package long tail (strongest oracle, but Google and Chainguard are close), and review early-cutoff. On fzf, 36% of commits left the binary byte-identical, and path-based "docs-only" routing was wrong for 15% of commits in the unsafe direction.

**Rejected (one line each)**
- Server-side VCS / virtual FS (Piper, CitC, EdenFS, Scalar): eight or more teams are already rebuilding it, two with fresh funding.
- Agent-maintained Bazel/Nix: the flip is already happening (Anchorage, any2bazel, Fuchsia BEADS).
- Traced deps / regression test selection: vendors cover it, and Anchorage measured 1.6 s/PR savings.
- Graph-partitioned speculative queues (Zuul/SubmitQueue): shipped by Trunk, Aviator and Mergify.
- Stacked diffs (Gerrit/Phabricator): GitHub and Graphite/Cursor shipped it in 2025–26.
- Patch theory / structural merge (Darcs/Pijul/Mergiraf): LLMs resolve conflicts better, and semantic interference is rare in practice.
- CRDT/operation VCS: Zed DeltaDB is doing it, with an unclear buyer.
- Software Heritage / SWHID for agent provenance: done by SWH, no buyer.
- Issue dedup: LLM triage and GitHub's gating took it.

---

## Verification notes

- **Read in full or fetched directly (2026-10-28):** Anthropic "Redesigning source control"; GitHub's Aug 17 outage
  post; Octoverse 2025; Memon et al. 2017 (TAP, full PDF); arXiv 2607.04697 and 2609.25396 abstracts; Anchorage's
  tooling post; the OSS Rebuild README; the ERSC homepage.
- **Secondary only:** The Information's agent-PR counts; SemiAnalysis' Claude Code share; Business Insider on AWS; Faros
  review numbers; Cursor's Continuity numbers; Entire's clone rate; the LLM-vs-structured merge-resolution rates; the Potvin & Levenberg
  16k/24k split (CACM full text paywalled; consistent across mirrors).
- **From memory, not re-fetched today (dates are well established but not re-checked):** Mondrian/Rietveld/Gerrit
  lineage; Phabricator dates; Darcs 2002–03; VFS for Git 2017 and Scalar's merge into git 2.38; Blaze ~2006; Rattle (OOPSLA
  2020); Ellis & Gibbs 1989; Jackson & Ladd 1994; Godlin & Strichman 2009. Graydon Hoare's NRSR essay URL returned 404 to
  the fetcher. It is the URL bors cites; I did not confirm it another way.
- **Absence claims** ("no product does post-merge + flake-aware culprit finding + auto-revert for GitHub") rest on
  searches run on 2026-10-28. Treat them as the kill test for idea 1's first day, not as established fact.
- **Scratch:** `/tmp/flip-scale-code` (queue arithmetic, fzf clone, Go caches; peak ~250 MB briefly, trimmed to under 200 MB,
  then deleted). No Docker, no VM, no accounts.
