# 07 — Infrastructure and operations: check recovery, not ceremony

Date: 2026-10-28. Lens: declarative infrastructure, integration, releases, observability, on-call, supply chain, cost, and infrastructure that extends itself.

**I — Recommendation:** build **Alchemy Recovery Lab**, a small fault-and-recovery corpus contributed to Alchemy's existing provider test machinery. Its output is a replayable discrepancy between persisted deployment state and independently observed resource identity, ownership, generation, or data. Two conditional reserves are **Revert Rehearsal** and **Release Gate Witness**. These are components with explicit kill gates, not three claims of empty markets.

**F/I — Material revision to earlier research:** round 6's broad post-merge integration survivor is occupied. Graft implements landed-tip verification, a green reference, bisection, and automatic reverts; LUCI has production culprit/revert machinery; Mogplex has a narrower GitHub revert primitive. The named merge-queue vendors also make the old serial-queue cost comparison inadequate. A portable, calibrated, current-tip repair checker remains a possible contribution, but “nobody packages this” is no longer a defensible premise.

Evidence labels throughout: **F** = sourced fact, including clearly attributed vendor/issue-author claims; **M** = measured locally; **I** = inference or proposal; **E** = estimate or proposed acceptance threshold. Rolling documentation is undated unless stated; all web sources were checked on 2026-10-28. Reported bugs are distinguished from local reproductions. No vendor accounts, cloud deployments, paid APIs, Docker, or VMs were used.

## 1. What changed, and what did not

**F — Change volume:** Anthropic reports going from approximately 2,500 merges/day in May to over 30,000 in September 2026, and describes automated bisect/revert pipelines. This is one unusually agent-intensive organization, not a population estimate for ordinary repositories. [Anthropic, 2026-10-13](https://www.anthropic.com/research/redesigning-source-control).

**F — Broader load:** GitHub reports monthly commits growing from 1.4 billion in April to 2.9 billion in August 2026. That measures GitHub activity, not successful deployments or an isolated causal effect of agents. DORA's 2025 research finds higher AI adoption associated with both higher delivery throughput and greater instability; this is an association. [GitHub, 2026-08-20](https://github.blog/news-insights/company-news/the-august-17-outage-and-the-work-ahead/); [DORA, 2026-03-10](https://dora.dev/insights/balancing-ai-tensions/).

**F — The thesis is already being implemented by Alchemy:** its July resource-generation account describes a three-person team using agents and live API tests to grow Cloudflare coverage from 22 to 230 resources, with roughly 700 tests and 720 SDK patches in that wave. Tests query the cloud outside deployment outputs and verify destruction. Its July runner article describes over 4,000 live tests and a custom Effect-based concurrent runner. These are maintainer-reported counts, not measurements in this report. [Resource factory, 2026-07-02](https://alchemy.run/blog/2026-07-02-cloudflare-resource-factory/); [Test runner, 2026-07-22](https://alchemy.run/blog/2026-07-22-a-test-runner-for-agents/).

**F — Operations does not become free:** Alchemy's September CI account still needed cancellation of superseded runs, affected-package selection, runner changes, and separate build/publish jobs for npm trusted publishing. It explicitly describes accidentally deleting stable preview Workers. Agent authorship increases the return on these practices; it does not eliminate resource costs or lifecycle mistakes. [Alchemy CI, 2026-09-24](https://alchemy.run/blog/2026-09-24-optimizing-ci/).

**F/I — Platform owners capture much of the obvious opportunity:** Cloudflare's response to its late-2025 outages included progressive, health-mediated configuration rollout through Snapstone, reported complete in May 2026. “Make configuration deployments behave like controlled software deployments” is valuable and already being shipped by the owner of the deployment path. [Fail Small plan, 2025-12-19](https://blog.cloudflare.com/fail-small-resilience-plan/); [completion, 2026-05-01](https://blog.cloudflare.com/code-orange-fail-small-complete/).

**I — The actual flip:** agents can afford to author the tedious per-provider failure schedules, per-service recovery fixtures, telemetry edge cases, and release evidence bindings that humans often omit. The scarce part becomes choosing and maintaining the independent acceptance condition. Execution, representative environments, causal attribution, and recovery of mutable data remain costly.

| Operational claim | Cheap check that is useful | What it does not establish |
| --- | --- | --- |
| “The deployment plan is acceptable” | Evaluate a pinned plan against protected resource, permission, and retention policy | That API writes will be atomic or that the plan still matches changing external state |
| “This deployment can recover” | Interrupt actual lifecycle boundaries; resume; inspect external identity, contents, ownership, and cleanup | Universal rollback of arbitrary irreversible writes |
| “The release passed its SLO gate” | Match the exact artifact, service, telemetry population, observation interval, active gate, and decision | That a green process exit means the intended gate actually ran |
| “The runbook worked” | Broken fixture → actions → independent recovery assertions → restart/replay | That an alert disappeared for the intended reason |
| “The culprit can be reverted” | Test the repair on the exact current tip with a fixed evaluator, then compare-and-swap | That a clean textual revert is a semantic repair |
| “The extension is affordable” | Enforce bounded admission, resource counts, leases, and available provider limits | A hard monthly spend cap derived from a cost estimate |

## 2. Alchemy v2 in depth

### 2.1 What is actually present

**F — Repository/version:** the active v2 repository is [alchemy-run/alchemy](https://github.com/alchemy-run/alchemy); the async implementation is maintained separately as [alchemy-async](https://github.com/alchemy-run/alchemy-async). Source inspection used main commit `2bfe597d9d3e8ecc60b95704476de74bca2995b7`. The local experiments used the published **2.0.0-beta.84**, not an unlabelled mixture of main and the release. The October 22 release split provider packages and expanded cross-cloud bindings. [beta.84 release, 2026-10-22](https://alchemy.run/blog/2026-10-22-beta-84/).

**F — Design:** infrastructure and application code form one Effect program. Plan-time construction and deployed runtime execution are distinct phases. Bindings connect a resource to a runtime and can jointly generate permissions, configuration, and a typed client. For example, an AWS table operation binding derives the table identity and corresponding IAM action together. This removes a class of inconsistent hand wiring; it does not prove that a permission set is appropriate for the application. [Overview](https://alchemy.run/what-is-alchemy/); [phases](https://alchemy.run/infrastructure-as-effects/phases/); [bindings](https://alchemy.run/infrastructure-as-effects/binding/).

**F — Lifecycle:** a plan classifies resources as create/update/replace/delete/no-op. The provider implements convergent, retryable `reconcile`; replacement normally creates a new generation, updates dependents, and removes the old generation. Retention intentionally leaves the cloud object while dropping its state row. A provider can require deletion before creation for identities that cannot coexist. [Lifecycle](https://alchemy.run/infrastructure-as-code/resource-lifecycle/); [provider contract](https://alchemy.run/infrastructure-as-code/provider/).

**F — Current main's ownership design:** providers can implement `read` and `observe`; `observe` can return partial attributes or an unresolved identity. The engine uses these hooks around resource admission and cyclic precreation. The contract explicitly requires retry safety after an external API succeeds but state persistence fails. These are meaningful operational semantics beyond TypeScript input shapes. They also create contracts worth testing across the engine/provider boundary. [Pinned Provider.ts](https://github.com/alchemy-run/alchemy/blob/2bfe597d9d3e8ecc60b95704476de74bca2995b7/packages/alchemy/src/Provider.ts#L260).

**F — Important limit:** `alchemy plan --detailed` reports declared inputs compared with persisted declarations; the docs explicitly distinguish this from a live-cloud drift read. Do not treat this CLI output as an immutable saved-plan execution protocol or a rollback certificate. [Plan command](https://alchemy.run/cli/plan/).

**F — Recovery is substantial existing work:** `test.provider` provides scratch stacks and state, lifecycle operations, and external SDK assertions. Main's large apply test suite already covers interrupted creates, replacement destruction, failed state checkpoints, ownership admission, migrations, and cleanup. The proposed project cannot honestly claim that Alchemy lacks lifecycle tests or external verification. [Provider testing](https://alchemy.run/testing/testing-providers/); [pinned apply tests](https://github.com/alchemy-run/alchemy/blob/2bfe597d9d3e8ecc60b95704476de74bca2995b7/packages/alchemy/test/apply.test.ts).

**F/I — Recovery is not general rollback:** the pinned apply implementation still contains a rollback TODO discussing failures during expansion and the difficulty of irreversible updates. Retrying forward to convergence, restoring an older deployment graph, switching traffic to an older artifact, and recovering user data are separate operations. [Pinned Apply.ts](https://github.com/alchemy-run/alchemy/blob/2bfe597d9d3e8ecc60b95704476de74bca2995b7/packages/alchemy/src/Apply.ts#L381).

### 2.2 Pain: concrete, but a small public sample

**F — Issue state and reactions were checked through GitHub's API on the research date.** These reports show real failure categories; low reaction counts do not establish a large unmet market.

| Report | Date; public signal | Claimed failure; qualification |
| --- | --- | --- |
| [#22: rollbacks](https://github.com/alchemy-run/alchemy/issues/22) | 2025-12-03; open, 4 reactions, 1 comment | Explicit request to restore an earlier state; too broad to define a deliverable by itself |
| [#1785: Container replacement](https://github.com/alchemy-run/alchemy/issues/1785) | 2026-09-23; open, 0 reactions/comments | Same-name replacement reuses an application identity, then old-generation cleanup removes it; subsequent plan reports no changes. Report concerns beta.79; not independently reproduced against Cloudflare here |
| [#1835: Kubernetes manifest identity](https://github.com/alchemy-run/alchemy/issues/1835) | 2026-09-25; open, 0 reactions/comments | Credential-only change can cause replacement against the same object followed by deletion. Includes a local HTTP-server reproduction; not executed here |
| [#2688: AWS drift coverage](https://github.com/alchemy-run/alchemy/issues/2688) | 2026-10-27; open, 0 reactions/comments | Missing/incomplete readers can hide changes to managed fields. The author describes source inspection; do not turn all listed cases into observed cloud failures |
| [#2731: partial observations](https://github.com/alchemy-run/alchemy/issues/2731) | 2026-10-28; open, 0 reactions/comments | Typed fake-provider probe: partial observation becomes complete cleanup identity; retry/destroy can select a foreign same-name object in another scope. Author explicitly has not demonstrated a built-in provider failure; not rerun here |

**I — Common denominator:** the useful invariant is not “the SDK call typechecked” or “the next plan is empty.” It is that the intended physical generation exists, its contents remain correct, unrelated owners remain untouched, and all non-retained resources eventually disappear. Ownership, resolved identity, external writes, and state checkpoints must agree under interruption.

### 2.3 Comparison with established declarative stacks

**F/I — None of the following is empty territory.** Each already supplies a substantial part of disciplined deployment. The remaining question is the strength and independence of its recovery check.

| Stack | Existing mechanism, checked in current docs | Remaining boundary |
| --- | --- | --- |
| **Pulumi** | Saved update plans constrain allowed operations; unit, property/policy, and cloud integration tests exist. Update-plan docs warn about unknowns and partial execution; the format is described as experimental. [Plans](https://www.pulumi.com/docs/iac/operations/stack-management/update-plans/), [testing](https://www.pulumi.com/docs/iac/guides/testing/) | A constrained plan is not an atomic transaction or a data restore. Provider lifecycle semantics remain relevant |
| **SST** | Current v4 continues on Pulumi; migration from v3 includes an AWS provider/state upgrade. Linking, state handling, refresh, and repair are existing features. [v4 migration](https://sst.dev/docs/migrate-from-v3/), [configuration](https://sst.dev/docs/reference/config), [CLI](https://sst.dev/docs/reference/cli) | Do not pitch another TS app/infra framework or assume changing app identity preserves existing resources |
| **Terraform / OpenTofu** | Saved plans, apply, mocked configuration tests, real-resource tests, and provider acceptance checks exist. [Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan), [mocking](https://developer.hashicorp.com/terraform/language/tests/mocking), [provider plan checks](https://developer.hashicorp.com/terraform/plugin/testing/acceptance-tests/plan-checks), [OpenTofu tests](https://opentofu.org/docs/cli/commands/test/) | A mocked provider checks the configuration's interpretation of the mock; it does not validate actual provider recovery or external API behavior |
| **CDK / CloudFormation** | Template assertions and deployed integration assertions; CloudFormation can monitor alarms during an update and a configured period and trigger rollback. [CDK tests](https://docs.aws.amazon.com/cdk/v2/guide/testing.html), [integration tests](https://docs.aws.amazon.com/cdk/api/v2/docs/@aws-cdk_integ-tests-alpha-readme.html), [rollback triggers](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-rollback-triggers.html) | Alarm semantics, missing-data handling, and recoverability of changed data still matter. The rollback-trigger docs explicitly exclude monitoring during rollback itself |
| **Nix / NixOS** | Declarative builds, generations, activation, and switching/rollback are established. [NixOS documentation](https://nixos.org/manual/nixos/stable/), [NixOS overview](https://wiki.nixos.org/wiki/NixOS) | Selecting an older system generation does not by itself restore external services or reverse a mutable database migration. This last distinction is an inference about scope |

**I — Implication:** Alchemy is attractive because TypeScript/Effect makes lifecycle contracts accessible to this builder, not because other stacks lack planning or testing. Its maintainers already own most of the check. A useful outsider contribution must plug into their machinery and reduce repeated adapter work.

## 3. Post-merge integration: competition audit and revised verdict

### 3.1 Definition and audit boundary

**I — Keep four capabilities separate:** (a) test a speculative future merge before landing; (b) batch already-landed revisions for comprehensive tests; (c) locate the responsible change despite noise; (d) demonstrate that a proposed repair restores the current branch. A product doing (a) is not automatically a product doing (b)–(d). Conversely, a request for low CI costs does not imply a preference for red trunk.

**F — Audit work:** examined each named vendor's own technical documentation, relevant changelogs, public post-merge products/repositories, the FACF/SafeRevert/TAP papers, and pinned implementation paths in Graft and Mogplex. No sales calls or authenticated product trials were made. “Not documented” below is bounded to those public materials, not a claim about private offerings. Competitive comparison pages were not used as the authority for competitors' missing features.

### 3.2 All named queue vendors

| Vendor | What the owner's documentation actually supports | Boundary versus the earlier survivor |
| --- | --- | --- |
| **GitHub** | Cumulative speculative `merge_group` branches; build concurrency 1–100. Disabling the non-failing-only option lets a passing cumulative group cover earlier failures. Merge limits explicitly **do not combine merge-group builds**. [Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) | Pre-landing integration and some flake tolerance already exist. Do not call its merge limits equivalent to a vendor's reduced-build batching. No complete landed-tip culprit/revert loop found in this page |
| **Graphite / Cursor** | Speculative parallel CI, stack-level checks, batching with subset isolation or bisection and automatic requeue of passing stacks. Current docs mark batching **private beta**. [Optimizations](https://graphite.com/docs/merge-queue-optimizations) | Bisection and batch cost reduction are already product features before landing. Cursor announced an acquisition agreement on 2025-12-19; this is a substantial adjacent owner, not an abandoned niche. [Announcement](https://cursor.com/blog/graphite) |
| **Mergify** | Cumulative speculative modes, parallel scopes, batches and splitting. `skip_intermediate_results` can use a later cumulative pass; its **2026-10-20** release extends that saving during bisection. [Modes](https://docs.mergify.com/merge-queue/queue-modes/), [batches](https://docs.mergify.com/merge-queue/batches/), [October update](https://docs.mergify.com/changelog/2026-10-20-skip-intermediate-results-during-bisection/) | “Mergify cannot cope with flakes/later passes” is stale. Its **2026-10-05** release also exposes CI runs per merged PR. [Cost metric](https://docs.mergify.com/changelog/2026-10-05-see-how-many-ci-runs-each-merged-pull-request-costs/) |
| **Aviator** | Cumulative parallel validation and exact tested-commit fast-forwarding. Optimistic validation waits for later passing batches; the current page says opt-in, default false. A beta classifies transient failures using deterministic evidence and, when needed, a model; it reruns CI rather than manufacturing a pass. [Optimistic validation](https://docs.aviator.co/mergequeue/concepts/managing-flaky-tests-in-mergequeue), [flake management](https://docs.aviator.co/mergequeue/concepts/flaky-test-management), [fast-forwarding](https://docs.aviator.co/mergequeue/concepts/fast-forwarding) | Flake triage itself is already being absorbed. The independent check is the rerun result, not the classifier's confidence. These pages concern pre-landing queue behavior |
| **Trunk** | Batching, bisection, parallel queues, optimistic merging, pending failure depth, and flaky-test management. [Owner's technical docs](https://github.com/trunk-io/docs/blob/main/merge-queue/optimizations/README.md), [batch failure handling](https://github.com/trunk-io/docs/blob/main/merge-queue/optimizations/batching.md) | Also not a serial queue. Its organization page reports validating 250+ PR/hour over 24 hours: vendor-reported, not a benchmark reproduced here. [Owner's profile](https://github.com/trunk-io) |

**F — Adjacent owners also ship the surrounding workflow:** [Graphite Agents](https://graphite.com/docs/agents) can update a PR to address failing CI through Cursor Cloud Agents. [Aviator Releases](https://docs.aviator.co/releases-beta/concepts/rollbacks) documents rollback using an earlier build, and [Aviator Runbooks](https://docs.aviator.co/runbooks/how-to-guides/editing-runbooks) supports agent-assisted workflow edits and versions. These are meaningful competition for generic fixes/runbooks; they are not evidence that a release rollback also identifies a bad source change.

**I — What survives this part:** post-merge integration can remove comprehensive testing from landing's critical path. What does not survive is using an unoptimized serial queue as the competitive baseline, or presenting batch isolation and flake handling as absent from queue products.

### 3.3 Direct post-merge and auto-revert counterexamples

**F — Graft is the decisive public counterexample.** The `feder-cr/git-ai` repository's Graft verifier watches landed branch tips, batches verification cycles, maintains `refs/graft/green/<branch>` at tested revisions, and offers opt-in bisection/automatic reverts with caps, dry runs, and notifications. It requires its own backend, so it is not a drop-in GitHub App. Repository naming is confusing: this is not the separate Git-AI authorship-attribution tool. Inspected commit: `099c7fbc51e44a28dbda8a40c1ecff0dad8ce123`, dated 2026-10-23. [Verifier design](https://github.com/feder-cr/git-ai/blob/099c7fbc51e44a28dbda8a40c1ecff0dad8ce123/doc/graft/VERIFY.md).

**F/I — Narrow implementation boundary in Graft:** the reviewed culprit finder assumes monotone failures along a parent chain and reruns a failing tip once to screen flakes. The reviewed `AutoReverter` reads today's tip, issues a revert guarded by the expected old revision, and retries when the branch moves. Its interface has no test-runner input or verified candidate-tree receipt. It does test certain scratch histories while accounting for older automatic reverts during bisection; that is a different point in the loop. I did not find a full test of the repaired current tip in that apply path. The regular watcher can subsequently test the landed revert; the possible gap is a repaired-tree check **before** the branch mutation. This is a source-inspection finding, not an end-to-end failure reproduction against a running service. [Culprit finder](https://github.com/feder-cr/git-ai/blob/099c7fbc51e44a28dbda8a40c1ecff0dad8ce123/internal/graft/verify/bisect.go); [auto-revert path](https://github.com/feder-cr/git-ai/blob/099c7fbc51e44a28dbda8a40c1ecff0dad8ce123/internal/graft/verify/revert.go); [transport](https://github.com/feder-cr/git-ai/blob/099c7fbc51e44a28dbda8a40c1ecff0dad8ce123/internal/graft/verify/revert_grpc.go).

**F — Mogplex is a genuine, narrower GitHub overlap.** Its workflow page advertises main-branch CI reproduction, bisection, fixes, and optional revert PRs. The open-source MVP actually contains an opt-in `createRevertPr` tool: it refuses if the failing revision is no longer branch head, refuses merge/root commits, and creates a PR restoring the parent tree. Tests cover branch movement and races. This proves a useful primitive; it does not by itself demonstrate the entire advertised flake-aware batch service. Inspected commit: `f2e29f98505cd5242886898c88220bb938269aaf`. [Workflows](https://mogplex.com/workflows); [implementation](https://github.com/Mogplex/mogplex/blob/f2e29f98505cd5242886898c88220bb938269aaf/lib/agents/ci-tools.ts); [race tests](https://github.com/Mogplex/mogplex/blob/f2e29f98505cd5242886898c88220bb938269aaf/tests/unit/ci-revert-tool-race.test.ts).

**F — LUCI is older, operational prior art:** Chromium's bisection machinery has culprit-action policies for creating/committing reverts, including cases requiring confirmed culprits before acting on generated suspicions. An August 17, 2026 Chromium commit records an actual automatic culprit revert. Adapting this is work; inventing culprit-driven automatic reversion is not the opportunity. [Revert policy implementation](https://chromium.googlesource.com/infra/luci/luci-go/+/0cbdd0f981a84011c0d9021b34cf5adb4703e5ac/bisection/culpritaction/revertculprit/revertculprit.go); [example revert](https://chromium.googlesource.com/chromium/src/+/381b74aa2e068c4ef2863019ef2078893d317156).

**F — A stale listing is not a live competitor:** the [Bisect.sh GitHub App](https://github.com/apps/bisect-sh) still advertises cloud bisection, and search results retain its old documentation. On this research date `bisect.sh/docs` returned 404 and the [root domain](https://bisect.sh/) displayed an unrelated debate site. Count it as hosted-bisection prior art with uncertain service availability, not a verified usable product today. Generic command-triggered [automatic-revert Actions](https://github.com/marketplace/actions/automatic-revert) are also real but do not supply culprit identification.

**F — Additional bounded counterexamples:** [HydraFlow's auto-revert ADR, 2026-04-23](https://t-rav.github.io/hydraflow/adr/0048-auto-revert-on-rc-red/) describes confirmed-red bisection, a revert PR through ordinary required checks, and a post-revert watchdog. Its ADR is marked proposed, while [the implementation path](https://github.com/T-rav/hydraflow/blob/main/src/staging_bisect_loop.py) exists; it was inspected, not run end to end. [Quirq](https://docs.quirq.dev/docs/after-it-lands) documents post-submit tree status and a last-known-green release path, but explicitly says its culprit/revert activation awaits a GitHub App that does not exist yet. Neither should be counted as a verified turnkey service; both further weaken the empty-category claim.

**F — Research is ahead of the simplistic pitch:** TAP milestone testing dates back years; FACF is a published Bayesian noisy-search approach; SafeRevert studies when culprit evidence justifies an automatic revert. Google's later paper explicitly notes that even its verifier is fallible and that independence assumptions fail in real builds. A nominal posterior is not an empirically calibrated false-revert rate. The 2025 paper also reports a real benefit from post-submit scheduling: median novel-breakage detection fell from 107 to 37 minutes in its evaluation. Its described rollback path could still take 30 minutes to several hours after detection. These are Google-specific results, not a GitHub-product benchmark. [TAP, ICSE 2017](https://research.google/pubs/taming-google-scale-continuous-testing/); [FACF, ICST 2023](https://research.google/pubs/flake-aware-culprit-finding/); [SafeRevert, ICST 2024](https://hackthology.com/pdfs/icst-2024.pdf); [speculative testing, ICST 2025](https://hackthology.com/pdfs/icst-2025.pdf).

### 3.4 Correct the arithmetic before retaining the idea

**M — Arithmetic, not a throughput benchmark:** with a ten-minute suite, a strictly serial per-change queue permits `1440 / 10 = 144` changes/day. But five concurrent batches of 50 changes have an ideal failure-free capacity of `5 × 50 × 144 = 36,000` changes/day. This is only an upper-bound model: cumulative speculation, failure invalidation, machine capacity, test selection, and API limits can reduce it. It is enough to invalidate “30,000/day proves pre-merge queues cannot work.”

**M — The earlier large batch was a design choice:** 30,000 arrivals/day over ten minutes is about 208 unvalidated changes. It does not force one indivisible 208-change batch. Under independent residual break probability `p`, a batch of size `B` is clean with probability `(1-p)^B`; at `B=50,p=.001`, about 95.1%; at `B=208,p=.005`, about 35.3%. A real comparison must choose batch size, concurrency, and invalidation policy for both approaches.

**I — Withdraw the claimed unique 8–75× integration saving:** the old calculation compared batched post-merge testing against one full run per change. Pre-merge batching can amortize the same suite. A valid experiment holds tests, runner budget, batching, and failure history constant, then measures cost, landing latency, and red-trunk exposure. Post-merge's distinctive trade is acceptance of an unvalidated interval, not a free batch-testing algorithm.

**F/I — Pain does not imply willingness to accept that trade:** Qwen Code issue #10254 documents independently green PR pairs producing a broken merged tree and a roughly 30-minute CI path. Its October 15 decision keeps the merge queue disabled and requires up-to-date PR checks. It had 0 reactions and 4 comments when inspected. This is evidence of integration pain and a cautious operational choice, not a customer request for land-before-test. [Issue, opened 2026-08-27](https://github.com/QwenLM/qwen-code/issues/10254). The [HN discussion of Anthropic's system](https://news.ycombinator.com/item?id=50073633) supplied qualitative build/bisection complaints, not a demand count.

**I — Revised verdict on round 6:** retain post-merge integration as a legitimate operating strategy, but retire the broad category claim and retain only a conditional component: externally evaluated, current-tip repair rehearsal with an auditable refusal path. Benchmark it against configured queues and existing culprit/revert systems. Do not build another queue, source-control backend, or generic AI CI fixer.

## 4. Operations, incident replay, supply chain, and self-extension

### 4.1 SLOs are executable contracts only when the signal and enforcement are checked

**F — The generic feature exists:** OpenSLO defines declarative service objectives; Argo Rollouts connects analysis outcomes to promotion, abortion, or pause; Datadog has deployment gates; Cloudflare's pint checks Prometheus rules; `promtool test rules` supports synthetic series including missing and stale samples. A new SLO YAML language or an agent generating ordinary alert rules has little gap. [OpenSLO](https://openslo.com/); [Argo analysis](https://argoproj.github.io/argo-rollouts/features/analysis/); [Datadog gates](https://docs.datadoghq.com/deployment_gates/); [pint](https://github.com/cloudflare/pint); [promtool rule tests](https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/).

**F — “Pass” has configuration-dependent meaning:** Argo documents dry-run analyses, empty-result handling, promotion timers, and an initial rollout that does not follow the normal transition strategy. Datadog documents that a dry-run gate always returns a passing overall API status even when its evaluated rules fail. These are documented operating modes, not newly discovered vulnerabilities. [Argo analysis semantics](https://argoproj.github.io/argo-rollouts/features/analysis/); [Argo FAQ](https://argoproj.github.io/argo-rollouts/FAQ/); [Datadog preconfigured gate modes](https://docs.datadoghq.com/deployment_gates/setup/preconfigured/).

**F — There is a concrete expectation mismatch:** Argo issue #4759, opened May 29, 2026, requests gating the initial blue/green promotion. It remained open with 1 reaction and 3 comments. The maintainer challenges the value of this for an isolated new service and points coupled-service users toward existing hooks/workflow choices. This is evidence for checking the intended process, and also a strong objection to building another general rollout controller. [Issue and maintainer response](https://github.com/argoproj/argo-rollouts/issues/4759).

**F — CI status has the same ambiguity:** Graft documents an exit-zero one-shot result for either passed or skipped verification. Graphite's CI optimizer warns that one Buildkite integration pattern can show overall green even when tests were skipped. A consumer must check the evaluated revision, actual outcomes, and required coverage. [Graft verifier outcomes](https://github.com/feder-cr/git-ai/blob/099c7fbc51e44a28dbda8a40c1ecff0dad8ce123/doc/graft/VERIFY.md); [Graphite CI optimizer](https://graphite.com/docs/stacking-and-ci).

**I — The useful contract spans:** artifact digest → deployment identity → cohort/traffic selector → freshness and minimum observations → explicitly active gate → resulting promotion decision. Missing data must have an owner-selected outcome; it cannot silently mean success. A PR that removes slow requests from its latency population or excludes failures from its denominator must not rewrite the protected acceptance policy. Even an impeccable gate can only test the observable objective it was given.

### 4.2 Runbooks as tested machines: useful, crowded, and bounded

**F — Executable runbooks are established:** StackStorm Orquesta has workflow transitions, forks/joins, retries, and engine tests. Rundeck supplies operational execution with logs and access controls. Runme executes Markdown and integrates with CI; FireHydrant provides runbook testing via game days. These are substantial prior art for “turn prose into a state machine.” [Orquesta](https://docs.stackstorm.com/orquesta/index.html); [Orquesta testing](https://docs.stackstorm.com/orquesta/development/get_started.html); [Rundeck](https://docs.rundeck.com/docs/about/introduction.html); [Runme](https://runme.dev/); [FireHydrant testing](https://docs.firehydrant.com/docs/runbook-testing).

**F — Incident replay is also occupied:** Replaybook publishes executable incident environments and `replaybook test`: break, assert broken, solve, assert solved. Its benchmark explicitly checks recovery across restart/reboot boundaries. The Rust crate provides concrete package prior art, not just a proposed website. No Replaybook container or VM was run in this research. [Replaybook](https://replaybook.dev/); [crate version 20260821.0.0](https://docs.rs/crate/replaybook/20260821.0.0); [benchmark procedure](https://replaybook.dev/benchmark-compare.html).

**I — What the rigor flip would look like here:** record typed incident Messages and proposed Commands; replay the recovery controller through timeouts, duplicate completions, restarts, and stale ownership epochs. Assert that a read-only customer probe actually recovers, unrelated resources/data remain intact, and only the current lease holder mutates state. A command diff such as “new runbook restarts both database primaries after one delayed health sample” is useful. It is a fixture/adaptor for existing engines, not evidence for inventing another workflow runtime.

**I — Why the effects-as-values extension is not a retained project here:** a Commands-out trace says what the controller requested, not what the external infrastructure did. To establish recovery it needs the same provider/environment oracle as the other proposals. This connects the brief's Foldkit/Effect trace idea to R7 incident minimization, but I found no separate operator demand sufficient to justify a fourth project. Generic incident replay is already covered by Replaybook; ordinary replay diff belongs with the existing workflow/replay candidates.

**F/I — Generic AI on-call is not the gap:** Sentry's Seer already supplies automated investigation and fixes, with integrations extended in 2026. A model writing a plausible diagnosis is increasingly substitutable. The durable work is a reusable incident fixture and independently checked repair outcome. [Seer GA, 2025-06-17](https://sentry.io/changelog/seer-sentrys-ai-debugger-is-generally-available/); [coding-agent integration, 2026-04-08](https://sentry.io/changelog/seer-can-now-trigger-claude-to-fix-bugs/).

### 4.3 Self-extension: what “bb” most plausibly means, and the infrastructure check

**F/I — Assumption:** in this context I interpret **bb as [get-bb/bb](https://github.com/get-bb/bb)**, whose own description is an agent IDE that builds itself. This is a stronger contextual match than babashka, although [babashka's executable is also `bb`](https://book.babashka.org/). The brief alone cannot prove which the builder meant.

**F — Relevant bb pattern:** plugin updates check engine/SDK compatibility, snapshot host-managed plugin state before activation, and restore that snapshot after failed activation. Its docs explicitly describe server plugins as full-trust code. Compatibility, successful activation, and restoration of host-managed state therefore cannot be read as proof that all extension behavior or external effects are acceptable. [bb configuration: plugin lifecycle and trust](https://github.com/get-bb/bb/blob/main/docs/configuration.md).

**I — Infrastructure analogue:** an agent adding a queue, bucket, database, schedule, or cloud permission is extending the program's authority and its future obligations. Adding a typed declaration is only the proposal.

**I — Necessary boundary:** an IaC program is executable code. A checked resource graph covers writes routed through that graph; it does not inherently constrain arbitrary SDK/network calls in the surrounding program or a newly generated provider. Give planning read-only authority where possible, pin the evaluator/providers, and enforce permitted mutations at the credential or broker boundary. Otherwise the agent can bypass the declared plan with the same credentials used to apply it. This is an assumption required for the proposed check, not a guarantee supplied by Effect types.

The check must sit outside the extension's editable acceptance path:

1. **Identify the exact proposal.** Bind source, dependency/provider digests, stack/stage, configuration identity, and relevant state version. Re-evaluate if these change; a saved textual preview is insufficient.
2. **Check authority and resource intent.** A protected evaluator inspects new resources, permission changes from bindings, retention/destruction policy, dependency ordering, and unknown identities. The agent cannot approve its own evaluator/policy changes in the same extension.
3. **Bound admission.** Enforce allowed resource classes/counts, concurrency, an owner, and an expiry/renewal obligation. Runtime code must not acquire unrestricted provisioning merely because it shares a source file with plan-time declarations. The credential boundary must implement this distinction.
4. **Test recovery obligations.** Include create-success/reply-loss, failed checkpoint, replacement cleanup, expired lease, retry, and destruction. Independently inspect external ownership, retained roots, sentinel data, and outstanding operations. An unenumerable API scope is unsupported, not green.
5. **Bind release evidence.** Only the exact tested artifact can advance the protected release reference. An app revision, infrastructure state, and mutable data schema can have different recovery procedures; record those boundaries explicitly.
6. **Observe the extension's actual use.** Monitor the new resource and its callers with an active gate and externally checked telemetry population. Renewal requires continuing ownership and budget admission; deletion needs inventory confirmation rather than only a successful DELETE response.

**F/I — Most individual primitives are already owned:** Pulumi combines policy enforcement with Neo, its infrastructure agent. TTL stack destruction is an existing Pulumi deployment feature; Cloud Custodian has scheduled cleanup actions. Do not build “an agent that adds infra with policies” or “TTL for previews” as the project. The proposed new work is validating interrupted lifecycle behavior within these paths. [Pulumi policy](https://www.pulumi.com/docs/discovery-governance/get-started/enforce-policy-as-code/); [Neo](https://www.pulumi.com/docs/ai/get-started/neo/); [Pulumi TTL](https://www.pulumi.com/docs/deployments/concepts/ttl/); [Cloud Custodian actions](https://cloudcustodian.io/docs/aws/resources/aws-common-actions.html).

### 4.4 Cost and supply chain are independent acceptance dimensions

**F — Estimated cost is already a product:** Infracost offers infrastructure cost estimates and policy guardrails. Do not assume every Alchemy/Cloudflare resource is supported merely because Terraform is supported. AWS Budgets data can lag 8–12 hours; alerts are not a real-time spend stop. Cloudflare's platform has per-invocation CPU/subrequest controls, which are useful but different from a conserved aggregate monthly budget. [Infracost FAQ](https://www.infracost.io/faq); [guardrails](https://www.infracost.io/docs/infracost_cloud/guardrails/); [AWS budget update timing](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html); [Cloudflare custom limits](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/custom-limits/).

**I — The check for self-growing cost:** resource creation consumes bounded admission; repeated traffic and child resources must remain bounded too. A preview lease must be enforced where new creates happen, or an expired agent can immediately recreate the resource being collected. Where the provider cannot impose a hard bound, disclose the weaker guarantee and stop calling a PR estimate a spending limit. This is the existing run-resource collector insight applied to declarative infrastructure, not a fresh budgeting algorithm.

**F — The supply-chain revival is also underway:** Google's OSS Rebuild derives declarative build recipes, rebuilds packages across npm/PyPI/crates, and emits attestations. EngFlow's any2bazel uses action-graph comparison to steer agent-authored build migrations. GitHub supplies artifact provenance attestations and verification. [OSS Rebuild announcement, 2025-07-21](https://blog.google/security/introducing-oss-rebuild-open-source/); [repository](https://github.com/google/oss-rebuild); [any2bazel, 2026-09-09](https://blog.engflow.com/2026/09/09/introducing-any2bazel-oss-bazel-migration-tool/); [GitHub attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations).

**I — Release engineering consequence:** record and verify the artifact digest and build identity in deployment evidence; do not rebuild an ostensibly identical branch later and call it the tested release. Reproducible builds establish agreement with a build recipe; provenance establishes origin. Neither establishes that the source is benign or that a stateful deployment is recoverable. Another generic Nix migration agent or provenance dashboard fails the gap test.

## 5. Idea generation and prior-art disposition

**I — Eighteen candidate ideas were considered.** Each row names the closest checked prior art; “keep” means a bounded OSS investigation, not a novelty claim. The main pick and two conditional reserves are expanded below.

| # | Candidate / rigor technique | Closest prior art and outcome |
| --- | --- | --- |
| 1 | **Alchemy Recovery Lab:** shared lifecycle interruption corpus with external identity/ownership/data oracles | **KEEP, narrow contribution.** Alchemy already tests lifecycles; [Sieve](https://github.com/sieve-project/sieve) already performs controller fault testing. [Faultline](https://github.com/aliqubit/faultline) already models retry faults. Gap to test: reusable Alchemy graph/checkpoint schedules beyond hand-authored cases |
| 2 | Packaged post-merge milestones + noisy culprit finding + auto-revert | **KILL broad novelty claim.** [Graft](https://github.com/feder-cr/git-ai/blob/099c7fbc51e44a28dbda8a40c1ecff0dad8ce123/doc/graft/VERIFY.md), [LUCI](https://chromium.googlesource.com/infra/luci/luci-go/+/0cbdd0f981a84011c0d9021b34cf5adb4703e5ac/bisection/culpritaction/revertculprit/revertculprit.go), and [Mogplex](https://mogplex.com/workflows) overlap materially; ordinary-GitHub packaging remains an implementation question |
| 3 | **Revert Rehearsal:** fixed-evaluator counterfactual repair on the current exact tip | **KEEP, conditional component.** [SafeRevert](https://hackthology.com/pdfs/icst-2024.pdf) covers evidential selection; [Graft's revert path](https://github.com/feder-cr/git-ai/blob/099c7fbc51e44a28dbda8a40c1ecff0dad8ce123/internal/graft/verify/revert.go) exposes a narrower possible integration gap |
| 4 | **Release Gate Witness:** show that the intended active gate authorized the deployed artifact | **KEEP, weakest reserve.** [Argo](https://argoproj.github.io/argo-rollouts/features/analysis/) and [Datadog](https://docs.datadoghq.com/deployment_gates/setup/preconfigured/) already own decisions; only cross-step evidence/edge-case fixtures remain plausible |
| 5 | SLO-as-code compiler with generated dashboards and release checks | **KILL.** [OpenSLO](https://openslo.com/), [Argo analysis](https://argoproj.github.io/argo-rollouts/features/analysis/), Datadog, pint, and promtool already cover the primitives |
| 6 | Convert prose runbooks into tested state machines | **KILL generic engine.** [Orquesta](https://docs.stackstorm.com/orquesta/index.html), [Rundeck](https://docs.rundeck.com/docs/about/introduction.html), [Runme](https://runme.dev/), and FireHydrant already execute/test runbooks |
| 7 | Agent-generated incident curriculum / POET incident foundry | **KILL generic platform.** [Replaybook](https://replaybook.dev/) and its [published crate](https://docs.rs/crate/replaybook/20260821.0.0) already supply executable recovery scenarios and checks |
| 8 | Diff Messages-in / Commands-out for an Effect runbook | **DO NOT RETAIN independently.** Related to the brief's effects trace idea and [Orquesta engine tests](https://docs.stackstorm.com/orquesta/development/get_started.html); command traces still need an external recovery oracle and no separate demand was verified |
| 9 | Autonomous on-call investigator that writes repairs | **KILL generic agent.** [Sentry Seer](https://sentry.io/changelog/seer-sentrys-ai-debugger-is-generally-available/) and its coding-agent integrations already occupy the feature |
| 10 | New all-TS app + infra + permissions framework | **KILL.** [Alchemy](https://alchemy.run/what-is-alchemy/), Pulumi, SST, and CDK already provide credible choices |
| 11 | Every deployment gets automatic universal rollback | **KILL premise.** [CloudFormation rollback triggers](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-rollback-triggers.html) and Nix generations exist; irreversible external/data effects cannot be undone by a generic plan inverse |
| 12 | Agent-maintained Nix/Bazel adoption factory | **KILL repitch.** R6 already rejected it; [any2bazel](https://blog.engflow.com/2026/09/09/introducing-any2bazel-oss-bazel-migration-tool/) now explicitly couples agent writing with deterministic graph checks |
| 13 | Independently rebuild every new agent-added dependency | **KILL generic service.** [OSS Rebuild](https://github.com/google/oss-rebuild) directly targets this; contribute missing recipes if useful |
| 14 | PR cost gate for infrastructure an agent adds | **KILL generic feature.** [Infracost guardrails](https://www.infracost.io/docs/infracost_cloud/guardrails/) and Pulumi policies; estimates still do not bound realized usage |
| 15 | Leased preview stacks that clean themselves up | **KILL generic TTL.** [Pulumi TTL](https://www.pulumi.com/docs/deployments/concepts/ttl/) and Cloud Custodian. Interrupted ownership/cleanup tests fold into #1 and the prior run-resource collector |
| 16 | Build-graph partitioned speculative merge queue | **KILL again.** GitHub, Graphite, Mergify, Aviator, and Trunk; R6 already rejected this variant |
| 17 | Progressive delivery for dangerous configuration changes | **KILL standalone primitive.** [Cloudflare Snapstone](https://blog.cloudflare.com/code-orange-fail-small-complete/) and established rollout controllers own the deployment boundary |
| 18 | Alchemy provider validation / truthful SDK generation factory | **KILL broad pitch.** The owner's [resource factory](https://alchemy.run/blog/2026-07-02-cloudflare-resource-factory/) already does this; [@aurelienbbn/conformance-alchemy](https://github.com/aurelienbobenrieth/harness/tree/main/packages/conformance-alchemy) also supplies static Alchemy configuration checks |

**F/I — Catalogue lineage, with changed verdicts:**

- **R6, `flip/05-scale-code.md`, catalogue `R6-flip.md`, “Post-submit integration for everyone”:** directly retested above; its empty-category and unique-cost-saving arguments are withdrawn. Revert Rehearsal is the smaller implementation question left over.
- **R6, `flip/03-scale-dist.md`, catalogue `R6-flip.md`, crash-safe run-resource collector:** its ownership epochs, ambiguous creates, retained roots, and deletion confirmation become explicit corpus invariants in Recovery Lab. This is reuse of an earlier survivor.
- **R6, same code report, hermetic builds and partitioned speculative queues:** remain rejected; no “agents make ceremony cheap” relabelling reverses that search result.
- **R2, `moonshots/02-biology`, POET for incidents and NonStop repair:** Replaybook and established repair agents make the generic revival weak. Keep incident fixtures as inputs to an existing harness.
- **R7, `flip2/02-distributed.md`, diagnosis → minimized executable reproducer:** apply the reduction idea to a lifecycle history, not another incident chatbot.
- **R9, `deep/03-language.md` replay diff and `deep/06-tooling.md` Replaygate:** the operations analogue needs infrastructure outcome checks. Do not claim ordinary production traffic replay is new.

## 6. Three retained investigations

### 6.1 Alchemy Recovery Lab — main pick; contribute upstream

**I — One sentence:** a shared Alchemy lifecycle fault corpus that compares uninterrupted execution with interrupted/retried execution using an external inventory and ownership/data oracle.

**I — Thirty-second demo:** an agent adds a fixed-name resource. The stack deploys successfully and its next plan says no-op, but the cloud inventory is empty: cleanup deleted the replacement. A second trace loses a create reply; retry succeeds, destroy succeeds, yet an old physical resource remains. The viewer displays external objects, state checkpoints, the exact call/failure schedule, and the invariant that failed. Both examples have passing controls in the local probe below; they are deliberately faulty synthetic providers.

**F/I — Gap and closest implementation:** Alchemy's own harness and apply tests are the primary baseline, including external assertions and interrupted lifecycles. Sieve is close conceptual prior art: fault injection and differential checking for Kubernetes controllers, not a general Alchemy provider adaptor. Its authors report 46 newly found bugs across ten controllers in their 2024 retrospective; that result is not reproduced here. The npm `conformance-alchemy` package checks four configuration practices—version pinning, state in Git, local state in CI, and preview cleanup—not interruption/recovery semantics. The possible gap is a **portable Alchemy-specific case corpus plus small adapter contract**, not a new testing algorithm. A further close TS prototype, Faultline, already simulates ambiguous writes, retries, reconciliation, and compensation against a modeled provider; it explicitly does not inject faults into a live client. Reuse that work where suitable. Recovery Lab must add Alchemy graph/generation/state-checkpoint coverage rather than reproduce a lost-acknowledgement demo. [Faultline, inspected commit `483728b`](https://github.com/aliqubit/faultline/tree/483728b85319a6c0b870241669f40a14fb02a70e). [Sieve repository](https://github.com/sieve-project/sieve); [authors' retrospective, 2024-11-14](https://www.usenix.org/publications/loginonline/sieve-chaos-testing-kubernetes-controllers); [package source](https://github.com/aurelienbobenrieth/harness/tree/main/packages/conformance-alchemy).

**F/I — Named beneficiary and pain:** Alchemy provider contributors and the maintainers of generated providers. Issues #1785, #1835, #2688, and #2731 identify identity, cleanup, and observation failures; the owner's factory demonstrates the volume of per-resource integration work. These signals support a contributor tool. They do not establish demand for a separate platform or a new service business.

**I — The independent check:** a maintainer-owned adapter declares physical identity, ownership, allowed retention roots, externally observable managed fields, and data sentinels. The harness schedules failure immediately before/after modeled API commits and state checkpoints, reconstructs the engine against surviving state, retries, then destroys. Compare observable resource sets with the uninterrupted reference and assert: declared objects exist; generations do not alias incorrectly; foreign objects/sentinels are unchanged; no unexpected non-retained objects remain. Explicitly allow unsupported/inconclusive results for APIs whose inventory or consistency bound is inadequate.

**I — How it can be gamed or be wrong:** the agent can weaken normalization, ignore a field, mark every resource retained, alter the fixture/checker, or teach a mock the same mistake as the provider. Keep adapter invariants, the inventory reader, and held-out histories outside the generated provider's writable acceptance path; separately qualify SDK changes that alter what that reader observes. A provider can special-case known fixture names, so vary identities and reserve whole fault families. This remains bounded testing, not a guarantee against arbitrary test-aware code. Model faults are not real cloud faults: a mock can demonstrate engine behavior but not undocumented API semantics. A bounded live adapter is needed before claiming provider qualification. Do not assume a returned error proves the API did not commit, or that a quiet interval proves no delayed operation can still finish.

**I — Better-model test:** 10–100× better generation still cannot make an eventually consistent API atomic, recover lost user data by assertion, or remove stale generation/credential races. More generated providers make a shared regression corpus more useful. Better models should lower the cost of writing adapters and reducing failing schedules; the resulting tests run without a model.

**I — Owner advantage:** Alchemy should adopt this. Its maintainers already own the engine, SDK patches, tests, and release path. Success is an accepted test/corpus contribution, not creating a rival framework. If the adapter is merely a wrapper around tests upstream already has, stop the package and contribute only the missing cases.

**E — Two-to-three-week version:** week 1: compare Alchemy's existing machinery with Faultline before writing any scheduler; work on one pinned v2 contract and extract six failure histories from existing issues/tests and implement an independent fake-cloud inventory with ownership and payload sentinels. Week 2: add scheduling around one shared SDK boundary and a state-store wrapper; reproduce on create/update/replace/delete/adoption/retain; minimize histories into normal upstream tests. Optional week 3: one maintainer-operated disposable live adapter, explicit consistency deadlines, and coverage reporting. No new deployment service, DSL, model, or general chaos engine.

**I — Expert reply that kills it:** “Our existing apply/provider suite already covers the same histories, and adding a real resource requires as much bespoke work in your adapter as writing the upstream test. Your mock cannot validate cloud behavior.” This objection is plausible and must be answered by measured reuse, not a larger feature list.

**E — One-to-two-day kill test:** choose two provider contracts and six previously reported failure histories; reserve two histories until after the generic adapter is written. Compare against existing tests plus an ordinary coding agent at the same work budget. Continue only if the adapter expresses both held-out histories without rewriting its engine and cuts case-authoring effort by roughly half, while rejecting deliberately bad ownership/cleanup variants and preserving the controls. Existing known bugs establish coverage, not new discovery. Kill the standalone package if upstream already offers the reusable abstraction or the held-out cases need bespoke engine patches.

### 6.2 Revert Rehearsal — conditional reserve; repair evidence, not another queue

**I — One sentence:** given a suspected culprit and a current branch tip, construct and independently test a bounded repair candidate, then bind its evidence to the exact candidate tree and expected branch revision.

**I — Thirty-second demo:** change A breaks a contract; later change B imports A's new symbol in a different file. Bisection correctly points to A. Reversing A applies cleanly, but the full current-tip check fails because B now has a missing import. Rehearsal refuses that repair and shows either a tested A+B rollback candidate or an explicit dependent-change/manual-repair outcome. No model narrative changes the result.

**F/I — Gap and closest implementation:** Graft already supplies most of the post-merge loop, but its reviewed revert apply path does not bind a repaired-tree test to the current-tip write. Mogplex's head-only rule avoids some moving-tip cases by refusing them. SafeRevert studies culprit selection confidence; checking a revert against later dependent changes is also longstanding practitioner advice. HydraFlow also routes revert PRs through ordinary required CI, and [Trunk's batching docs](https://github.com/trunk-io/docs/blob/main/merge-queue/optimizations/batching.md) explicitly tell users to retest a revert or submit it through the queue. The candidate therefore has to add independently pinned repair evidence beyond that normal path. It is an implementation adapter or upstream enhancement, not a new algorithm or an assertion that no internal system does this. [Graft apply path](https://github.com/feder-cr/git-ai/blob/099c7fbc51e44a28dbda8a40c1ecff0dad8ce123/internal/graft/verify/revert.go); [Mogplex primitive](https://github.com/Mogplex/mogplex/blob/f2e29f98505cd5242886898c88220bb938269aaf/lib/agents/ci-tools.ts); [practitioner account, 2016-02-15](https://paulhammant.com/2016/02/15/ci-breaking-builds-bisecting-and-reverting/).

**F/I — Named beneficiary and pain:** maintainers running post-submit CI on ordinary GitHub repositories, including projects with Qwen Code's integration problem. The public evidence confirms red-main and long-CI pain. It does not establish that these maintainers want automatic reverts, or that later-dependent repairs occur frequently enough to justify a new tool.

**I — The independent check:** keep the evaluator definition, environment/dependency identities, and essential assertions fixed outside the suspect changes. Record a known passing baseline, failing revision, culprit/parent contrast, today's tip, candidate tree, full repair checks, and skipped/inconclusive jobs. Any branch movement invalidates the current-tip receipt. Use compare-and-swap or let protected PR CI test the exact candidate revision. Keep a green release pointer separate from the newest landed tip. A green tip certifies the tested tree, not every intermediate historical revision.

**I — Games and limits:** an agent can delete a failing test, modify the CI command, return an empty test selection, reuse a cached success from another environment, or repair one target while breaking another. Pin evaluator lineage and coverage; run the full required repair set; count skips as missing evidence. Correlated flakes, flaky builds, multiple culprits, and non-monotone histories defeat simplistic binary search. Refuse when evidence is ambiguous. Searching arbitrary dependent rollback sets is exponential; bound candidate count and runtime. Reverting code does not roll back a database or external event already emitted.

**I — Better-model test:** stronger models make candidate generation and dependence suggestions cheaper. The release decision still needs exact-tree execution and concurrency control, and a repair still has observable consequences. The product cannot be “an agent that knows which commit to revert.”

**I — Owner advantage:** GitHub, queue vendors, Graft, and Mogplex can absorb this. An OSS component wins only if it is easy to embed across providers and useful to an existing maintainer. Prefer a patch to Graft or a small protected-workflow action over another GitHub App with credentials and a new dashboard.

**E — Two-to-three-week version:** a TS command accepts failing/current revisions and a caller-supplied protected evaluator. It creates patch/tree candidates in temporary directories, emits a machine-readable evidence manifest, and opens no mutation path by default. Add ordinary GitHub workflow integration that files a repair PR after verification; begin with deterministic code/build failures and a bounded dependent-change option. Ship refusal diagnostics and moving-tip tests before noisy statistical automation. Calibrated FACF-style support can wait for real histories.

**I — Expert reply that kills it:** “A protected revert PR already runs our full CI. Dependency handling is rare, so your adapter adds no useful behavior beyond waiting for checks.” Alternatively: “Your false-revert claim depends on an uncalibrated flake model.” Both are credible.

**E — One-to-two-day kill test:** replay at least 20 historical or supplied red-main episodes from two willing repositories, compare with ordinary revert-PR CI, and include held-out dependent, multi-culprit, evaluator-change, and moving-tip fixtures. Continue only if it prevents a demonstrated false repair or makes an otherwise manual repair reproducibly checkable without suppressing unrelated changes. If that corpus or user is unavailable, leave this as an upstream issue, not the builder's project. Zero mistakes in a tiny synthetic set is not production qualification: under independent trials, zero in 100 still permits roughly a 3% upper error rate at 95% confidence; demonstrating below 0.1% would need roughly 3,000 zero-error examples, with independence itself still an assumption.

### 6.3 Release Gate Witness — weakest reserve; a fixture pack for enforcement semantics

**I — One sentence:** an OSS contract-test pack that proves a deployment's required active gate evaluated the intended artifact and population before the pipeline promoted it.

**I — Thirty-second demo:** a generated pipeline displays a green gate, but it was dry-run, selected the wrong service, or was bypassed by a timer. The witness outputs the artifact, gate configuration, evaluation mode, observation identity, and actual promotion event. Inject missing/stale telemetry or a failing cohort and the promotion contract fails even though a component's overall status remains green.

**F/I — Gap and closest implementation:** Argo and Datadog already execute gates; promtool tests expressions and missing series; pint checks rule quality; Datadog already has gate audit events. The only plausible contribution is a reusable, independently specified test of the **composition**—configuration plus selected telemetry plus controller/pipeline decision. I found no complete cross-platform package in the reviewed sources, but this is weak negative evidence and could be a few policy rules rather than a project. [Prometheus tests](https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/); [pint configuration](https://github.com/cloudflare/pint/blob/main/docs/configuration.md); [Datadog audit events](https://docs.datadoghq.com/account_management/audit_trail/events/).

**F/I — Named beneficiary and pain:** release engineers composing Argo/CI/monitoring policies and teams expecting coupled preview services to be checked before exposure. Argo #4759 demonstrates a concrete expectation mismatch but has only one reaction and a strong maintainer counterargument. Documented dry-run behavior is a real footgun for consumers, not proof of widespread incidents. No customer interviews or live integration were performed.

**I — The independent check:** define a small owner-controlled contract: artifact identity; service/environment/cohort; minimum count and freshness; explicit missing-data result; active mode; required gate completion before promotion; and permitted override identity. Replay normal, no-data, stale-data, wrong-label, error, timeout, dry-run, and timer paths through the actual versioned adapter. Require healthy controls to promote and failing controls to stop or pause according to the owner's declared policy.

**I — Games and limits:** an agent can change selectors, mark a gate optional, shorten the observation window, drop timeouts, or edit its own test response. Protect the contract and fixture source. A log receipt is not enforcement unless the final promotion path requires it. If the application can fabricate every accepted metric, the gate is checking those fabrications; retain an independent probe or observation source for the critical objective. An adapter must follow controller behavior rather than approximate it with another hand-written state machine. Offline replay cannot prove live telemetry ingestion or actual traffic routing.

**I — Better-model test:** even perfect generated YAML cannot choose a business SLO or eliminate no-traffic ambiguity. The benefit is checking that an agreed policy is enforced when new services and pipelines are generated rapidly. The resulting check runs without a model.

**I — Owner advantage:** the controller and monitoring owners should ship this, and may already have most pieces internally. A contributor-owned scenario pack can cross CI/monitoring boundaries, but it has no strong independent moat. Keep only if one adopter needs the composition check and upstream accepts the fixtures.

**E — Two-to-three-week version:** one Argo adapter and an HTTP fixture server, a small TS witness validator, about a dozen contract scenarios, and an example protected promotion step. Avoid authenticated SaaS integration initially; Datadog's documented response shape can be a compatibility fixture, clearly labelled simulated. Add no new SLO language or rollout controller.

**I — Expert reply that kills it:** “promtool, a required active gate, and existing controller tests cover our actual mistakes; your receipts only restate logs.” If this is correct, write configuration guidance and stop.

**E — One-to-two-day kill test:** assemble ten representative pipeline configurations, including intentional dry-run, empty-series, wrong-service, missing-artifact, timed-promotion, and healthy controls. Compare against schema validation, promtool/pint, and a short static policy. Continue only if an actual versioned controller/workflow adapter catches a meaningful false promotion missed by that baseline. If static rules achieve the same coverage, contribute those rules instead. This has not passed its kill test and is ranked accordingly.

## 7. Local checks: what was actually measured

**M — Environment and scope:** macOS arm64; Bun **1.3.13** (`bf2e2cec`), `alchemy` **2.0.0-beta.84**, Effect **4.0.5**. Dependencies and test files lived under `/tmp/stack-infra/`; npm lifecycle scripts were disabled. The Alchemy engine and `alchemy/Test/Bun` harness were real. The cloud was an independent in-memory `Map` in each test. No built-in Cloudflare/Kubernetes provider was exercised, and no cloud credentials were used. Scratch remained below 500 MB and was removed after the report was completed.

### A. Successful replacement, empty external inventory, no-op next plan

**M — Setup:** a synthetic provider uses the desired fixed name as physical identity, marks revision changes as replacements, overwrites that name during reconcile, and deletes by physical identity. It therefore violates the coexistence requirement of create-before-delete replacement. The paired control uses the provider's documented `deleteFirst` option.

```text
create-before-delete:
  plan = [replace]
  calls = [ensure api@1, ensure api@2, delete api@1]
  returned output = { physicalId: api, revision: 2 }
  external objects = []
  next plan = [noop]
  independent assertion "api revision 2 exists" = FAIL

delete-before-create control:
  plan = [replace]
  calls = [ensure api@1, delete api@1, ensure api@2]
  external objects = [{ physicalId: api, revision: 2 }]
  next plan = [noop]
  independent assertion = PASS
```

**I — What this establishes:** output/state convergence alone is an insufficient acceptance oracle for an incorrect provider. It demonstrates the mechanism described by fixed-name replacement reports. It is **not** a newly discovered engine bug: the provider deliberately supplies the wrong lifecycle behavior, and upstream documents the correct option.

### B. External create commits, reply is lost, retry leaks a resource

**M — Setup:** another synthetic provider allocates a new physical ID, records it externally, then returns a one-shot injected failure before returning its output. With no recovery read/idempotency mechanism, the next deployment creates another object; destroy only removes the recorded object. The paired control adds a read that locates the earlier object and permits reconciliation to reuse it.

```text
without recovery read:
  initial deployment = Failure
  calls = [create resource-1, reply lost after commit,
           create resource-2, delete resource-2]
  objects remaining after successful retry + destroy = [resource-1]
  independent empty-inventory assertion = FAIL

with recovery read:
  initial deployment = Failure
  calls = [observe, create resource-1, reply lost after commit,
           observe, delete resource-1]
  objects remaining = []
  independent assertion = PASS
```

**I — What this establishes:** retry success and successful destruction do not prove absence of orphaned writes. Again, the bad provider deliberately fails the retry-safety contract; a recovery reader is one sufficient mechanism in this model, not a universal prescription. The control does not test foreign ownership, real API consistency, or delayed asynchronous completion.

**M — Combined result:** two deliberately bad variants failed their external-state assertions; two corresponding controls passed. These are mechanism probes, not a coverage benchmark or a claimed newly found cloud-provider vulnerability. Faultline already demonstrates the generic lost-reply/retry principle; the measured contribution here is running that class through the real Alchemy engine. Repeating them on the pinned Bun version removed an older-runtime confound; timing was not used as a performance result.

**M — Reproduction shape:** the following is the essential beta.84 provider/test construction for experiment A. Run in a disposable directory with the exact versions above; save as `lifecycle.test.ts` and run `bun test lifecycle.test.ts`. Both variants are intentional; one test should fail. Experiment B uses the same imports and registration pattern, with the complete provider/test body below.

```ts
import { expect } from "bun:test";
import * as Effect from "effect/Effect";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import * as Test from "alchemy/Test/Bun";

interface Probe extends Resource<
  "Research.FixedName",
  { name: string; revision: number },
  { physicalId: string; revision: number }
> {}
const Probe = Resource<Probe>("Research.FixedName");

for (const deleteFirst of [false, true]) {
  const cloud = new Map<string, Probe["Attributes"]>();
  const providers = Provider.succeed(Probe, {
    diff: Effect.fn(function* ({ olds, news }) {
      if (olds?.revision !== news.revision)
        return { action: "replace", deleteFirst };
    }),
    reconcile: Effect.fn(function* ({ news }) {
      const output = { physicalId: news.name, revision: news.revision };
      cloud.set(news.name, output);
      return output;
    }),
    delete: Effect.fn(function* ({ output }) {
      cloud.delete(output.physicalId);
    }),
  });
  const { test } = Test.make({ providers, stage: "research-local" });
  const program = (revision: number) => Effect.gen(function* () {
    return yield* Probe("Api", { name: "api", revision });
  });
  test.provider(`fixed-name replacement ${deleteFirst}`, (stack) =>
    Effect.gen(function* () {
      yield* stack.deploy(program(1));
      yield* stack.deploy(program(2));
      expect(cloud.get("api")?.revision).toBe(2);
      yield* stack.destroy();
    }),
  );
}
```

**M — Experiment B body:** save in a separate test file after the same five imports as experiment A; run it with the same pinned runtime/dependencies. One intentionally unsafe variant fails and the reader control passes.

```ts
interface Probe extends Resource<
  "Research.LostReply",
  { name: string },
  { physicalId: string; name: string }
> {}
const Probe = Resource<Probe>("Research.LostReply");

for (const recoveryRead of [false, true]) {
  const cloud = new Map<string, { physicalId: string; name: string }>();
  const events: string[] = [];
  let next = 0;
  let loseReply = true;
  const providers = Provider.succeed(Probe, {
    ...(recoveryRead ? {
      read: Effect.fn(function* ({ olds, output }: any) {
        events.push("observe");
        return output ? cloud.get(output.physicalId)
          : [...cloud.values()].find(x => x.name === olds.name);
      }),
    } : {}),
    reconcile: Effect.fn(function* ({ news, output }) {
      if (output && cloud.has(output.physicalId)) return cloud.get(output.physicalId)!;
      const physicalId = `resource-${++next}`;
      const result = { physicalId, name: news.name };
      cloud.set(physicalId, result);
      events.push(`create ${physicalId}`);
      if (loseReply) {
        loseReply = false;
        events.push("reply lost after commit");
        return yield* Effect.fail(new Error("local injected lost reply"));
      }
      return result;
    }),
    delete: Effect.fn(function* ({ output }) {
      events.push(`delete ${output.physicalId}`);
      cloud.delete(output.physicalId);
    }),
  });
  const { test } = Test.make({ providers, stage: "research-local" });
  const program = Effect.gen(function* () {
    return yield* Probe("Api", { name: "api" });
  });
  test.provider(`retry after lost reply recoveryRead=${recoveryRead}`, (stack) =>
    Effect.gen(function* () {
      const failed = yield* stack.deploy(program).pipe(Effect.exit);
      const result = yield* stack.deploy(program);
      yield* stack.destroy();
      console.log(JSON.stringify({ recoveryRead, initial: failed._tag, result, events, leaked: [...cloud.keys()] }));
      expect(cloud.size).toBe(0);
    }),
  );
}
```

### C. A clean textual revert is not a verified current-tip repair

**M — Setup:** baseline `api.py` exports `old_name()` returning `ok`. Change A replaces it with `new_name()` returning `bad`, violating a protected checker that requires the old contract. Later change B adds `plugin.py`, importing `new_name` in a different file. The checker, held outside the candidate files, also imports any present plugin.

**M — Result:** `git apply --reverse --check` and the reverse application of A's patch both succeeded without conflicts. The resulting candidate still failed with `ImportError` in the plugin. Removing B as well restored the passing baseline. No Git commits were created for this probe; it used patch files and Python subprocesses, with the same checker throughout.

```text
baseline                         PASS
current tip containing A + B     FAIL (old_name absent)
reverse patch for A applies      YES
current tip minus A              FAIL (plugin imports missing new_name)
current tip minus A and B        PASS
```

**I — Interpretation:** culprit identification and textual applicability are different from repair acceptance. This is a synthetic counterexample, not a measured frequency of dependent reverts and not an execution of Graft itself. The independent evaluator still only establishes the contracts it actually checks.

### D. What remains unmeasured

**I — No claim is made about:** live-cloud detection rate; incremental bugs beyond Alchemy's existing tests; the authoring effort saved by adapters; any vendor's real throughput, price, or false-revert rate; live gate enforcement; or operator demand for any reserve. Those are the kill tests, not accomplishments of this research.

**F/I — Search coverage and evidential limits:** GitHub code/issues and changelogs, npm (including the close Alchemy conformance name), crates (Replaybook), papers and arXiv searches, and HN were checked. The decisive sources were primary docs/code and named issue reports. A negative search result is only a bounded reason to investigate; no retained idea relies on “search returned nothing” as proof of novelty. The correction to Bisect.sh's current availability is a reminder to check the live source behind a stale result.

## 8. Ranked top three and decision

**I — Scores are judgments, 1–5, using the brief's six criteria.** Column 6 means no dependency on the excluded kernel project. Totals are a comparison aid, not measured success probabilities.

| Rank | Retained investigation | Cool | TS / Cloudflare adjacency | Verified gap | Value / named pain | Survives better models | Independent project | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | **Alchemy Recovery Lab** | 4 | 5 | 2 | 4 | 5 | 5 | **25/30** |
| 2 | **Revert Rehearsal** | 4 | 5 | 2 | 3 | 5 | 5 | **24/30** |
| 3 | **Release Gate Witness** | 3 | 4 | 2 | 2 | 5 | 5 | **21/30** |

**I — Why these scores:** Recovery Lab has the clearest named maintainer, multiple concrete failure categories, excellent stack fit, and an immediate external-state demo. Its gap is small because upstream already owns serious recovery tests, Sieve establishes the controller technique, and Faultline supplies a TS model of retry faults. Revert Rehearsal has a strong demonstration but little verified incremental value beyond protected repair-PR CI. Gate Witness's documented semantic mismatches are useful, but operator demand and advantage over short static policies are weakest. All three remain relevant with much stronger models because their acceptance boundary concerns external state, exact revisions, or enforcement semantics.

**ONE pick — Alchemy Recovery Lab.** Build a reusable interruption/ownership corpus inside the existing Alchemy test ecosystem. Aim for an upstream contribution and one adapter reused across genuinely different provider histories. If that reuse fails, submit the regression cases and stop; do not turn it into a general verifier, IaC framework, or operations agent.

### Five-line TL;DR

1. **F/I:** Agent-written infrastructure is already real; Alchemy's own live-test factory embodies much of the rigor thesis.
2. **F/I:** The broad post-merge survivor is occupied, and its unique batching-cost argument does not survive the vendor audit.
3. **M:** Synthetic Alchemy probes produced successful deployment/no-op with missing infrastructure, and successful retry/destroy with an orphan; paired controls passed.
4. **I:** Self-extension needs protected policy, bounded resource admission, external recovery checks, and exact artifact/gate evidence; types and green exits are insufficient.
5. **I:** Pick Alchemy Recovery Lab as an upstream corpus/adaptor contribution; keep current-tip revert rehearsal and gate witnesses only as conditional reserves.

### Rejected ideas — one line each, with the killer

- Broad post-merge CI product: Graft, LUCI, Mogplex, and published TAP/FACF/SafeRevert; the plain-GitHub integration wedge is narrower than the old pitch.
- Another speculative/partitioned merge queue: GitHub, Graphite/Cursor, Mergify, Aviator, and Trunk.
- SLO-as-code language or dashboard generator: OpenSLO, Argo analysis, Datadog, pint, and promtool.
- New executable-runbook/state-machine engine: Orquesta, Rundeck, Runme, and FireHydrant.
- Generic incident replay or POET foundry: Replaybook and existing benchmark/scenario machinery.
- Separate Effect runbook command-diff project: no independent pain verified; external outcomes still need the same recovery oracle.
- Generic AI on-call repair agent: Seer and established coding-agent integrations.
- New TS application/infrastructure framework: Alchemy, Pulumi, SST, and CDK.
- Universal automatic rollback: existing limited rollback tools plus irreversible external/data effects invalidate the unrestricted promise.
- Agent-maintained hermetic build migration: any2bazel and the prior R6 rejection.
- Generic independent package rebuilding/provenance: OSS Rebuild and GitHub attestations.
- Infrastructure PR cost gate: Infracost and policy platforms; estimates do not enforce realized spend.
- Preview-stack TTL as a new primitive: Pulumi TTL and Cloud Custodian; fault-tested ownership is the residual contribution.
- Progressive configuration deployment platform: Cloudflare Snapstone and established rollout owners.
- Generic Alchemy provider/SDK validation factory: Alchemy's own generated-resource/live-test loop and the existing static conformance package.
