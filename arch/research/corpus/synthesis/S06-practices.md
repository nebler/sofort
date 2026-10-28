# S06 — Practices into tools

Research cut: **2026-10-28**. Scope: all 98 supplied recordings, all 11 E ledgers and all five Connect ledgers. **Q** = supplied quotation or attributed report; **F** = externally sourced fact; **I** = interpretation/proposal; **E** = estimate. A demonstrated internal tool is evidence of implementation, not of a public package, reliable general performance, demand, or willingness to pay.

**I — Result:** The most repeated practices are proving actual behavior, converting corrections into reusable checks, and simplifying instructions as models change. All three already have public implementations. The strongest remaining opportunities are narrower: **skill invocation/composition fixtures; environment-mismatch diagnostic recipes; and temporal interaction assertions**. These fit an upstream contribution or weekend tool better than another agent platform. Repeated manual work is a discovery signal; it does not establish that existing tools are inadequate.

## Coverage, reading method, and counting

**F — Local evidence:** Read the per-video digests, recurring themes, prior-art triage and top-five sections across E01–E11 and Connect 01–05. Extracted every row whose type contains Practice or Hand-rolled, including lowercase/mixed types, Connect's Hand-built, and Connect 04's H/lesson notation. There are **2,182 retained rows**. Appendix A preserves all of them with ledger location, source-caption location, quotation, interpretation, and packaging disposition. Rows are observations, not 2,182 distinct techniques or opportunities. Historical compiler, database, infrastructure, creator and language-learning techniques remain in the inventory; they were not discarded for being small or outside coding-agent fashion.

**F/I — Transcript method:** Resolve every retained row to its supplied transcript and timestamp buckets; consult the corresponding caption text for technique details. The central practitioner cases receive closer treatment below. Caption timestamps identify minute buckets, not exact utterance offsets. The row appendix provides the audit trail rather than reproducing entire transcripts. Appendix B also retains all ledger rows explicitly typed Prediction/Roadmap/Pr, including adjacent technical predictions, so the theme-specific board does not silently erase contrary or awkward forecasts.

**F — Background used:** [kill list and research rules](/Users/noah/code/sofort/arch/research/RESEARCH-SUMMARY.md), [stack synthesis](/Users/noah/code/sofort/arch/research/stack/SUMMARY.md), [Connect synthesis](/Users/noah/code/sofort/arch/research/connect26/SUMMARY.md). Generic hosting/durability, orchestration loops, agent JIT/skill compilation, Code Mode, classifiers, broad review/test generation, type-check acceleration, installation platforms, migrations/proofs, and agent-scale Git remain occupied/killed categories. No new evidence here revives those broad pitches. A fixture for an existing mechanism is a different, much smaller deliverable.

**I/E — Independence:** The convergence counts below are conservative, named lower bounds of distinct reporting practitioners, with publishing channels counted separately. The same person across several recordings counts once. Amp's many videos count as one implementation team; Thorsten Ball and Quinn Slack are distinct speakers but are not two independent implementations. Theo on t3.gg and Nerd Snipe counts once. Matt explicitly credits Thariq for the interview idea: two adopters, one acknowledged lineage. Eric Tech's Pstack account is secondary reporting, not Lauren Tan's direct testimony. Ben Davis and Ben Vinegar are different people. Michael Shimeles/Ras Mic describes the four-step workflow on Peter Yang's channel; Peter is not credited as its author. Provider speakers and their customers are not automatically independent confirmations of the same implementation. A source used in two clusters does not become two customers.

**I — Public-availability vocabulary:** **Shipped** means inspectable public implementation/documentation, or explicitly qualified *internal implementation reported by a speaker*. **Being built** means active work reported by a named owner. **Roadmap** means intent, not availability. **Open** means a bounded residual was not established in inspected prior art; it is not a claim that nobody has built it. Exact row-level distribution is marked unverified where family-level research cannot establish it. No repositories were installed or executed during this research.

## Convergence, ranked by independent manual practice

Counts are **independent reporting practitioners / publishing channels**, restricted to the roster in each row. They are lower bounds, not a census, and measure the practice family rather than demand for the proposed residual. The evidence roster following the table supplies quotations and timestamps. Ties are not meaningful.

| Rank | Family | Count | Named roster and important qualification | Current packaging verdict |
|---|---|---:|---|---|
| 1 | K01 Prove the actual changed behavior | 10 / 9 | Michael, Theo, Thorsten, Matt Pocock, Peter Mattis, Jarred Sumner, Ben Vinegar, Adam Jacob, Karpathy, Raphaël Beamonte | **Shipped:** rstack, tstack, Pstack, ordinary testing/profiling. Residual: concrete missing fixtures, not another proof framework. |
| 2 | K02 Turn repeated correction into durable instructions/checks | 9 / 7 | Theo, Matt Pocock, Ben Davis, Wes Bos, Jarred Sumner, Andrew Qu, Every's Dan Shipper, Uber's Uday, Arg/Relevance AI's Jackie | **Shipped:** public skills, Pstack correct, Matt retro, Code Insights. Residual: worked examples and invocation coverage. |
| 3 | K03 Reassess/delete scaffolding after upgrades | 7 / 6 | Michael, Theo, Matt Pocock, Geoff Huntley, Jediah Katz, Thariq, Fuad/Arize | **Shipped:** skill-up comparisons, existing skill maintenance. Residual: realistic ablation fixtures and outcome data. |
| 4 | K04 Keep work/task state separate | 7 / 7 | Michael, Matt Pocock, Theo, Ben Vinegar, Scott Tolinski, Thorsten, Jane Street's John | **Shipped:** worktree managers, isolated services, agent workspaces. Residual: lifetime and cross-machine resource evidence. |
| 5 | K05 Match environment to the failure | 4 / 4 | Theo's OS-specific reproduction, Sumner's stale debug binary, Ball's immutable Git config, Dax's regional cache failure | **Shipped** mechanisms and diagnostics; **Open (I)** a curated cross-harness mismatch recipe pack. |
| 6 | K06 Establish completion beyond code generation | 6 / 6 | Theo, Michael, Thorsten, Scott Tolinski, Uday, VSCO's Andreas Salme | **Shipped:** shipping/babysitting skills and business-outcome tools. Residual: customer-specific release/readback predicates. |
| 7 | K07 Elicit domain decisions before implementation | 6 / 5, five lineages | Matt, Thariq, Michael, Ree, Patrick Collison, Zach Lloyd | **Shipped:** grill-me/grill-with-docs, Wayfinder, Pstack interrogate. Residual: contradictory decisions from multiple people. |
| 8 | K08 Human comprehension and focused review | 6 / 6 | Matt, Ben Davis, Thorsten, Armin, Thariq, Jane Street's John | **Shipped:** teach/how/why, quizzes, explanatory diffs, context products. Residual: repo-specific exercises and invariant checks. |
| 9 | K09 Operational cleanup and orphan discovery | 4 / 3 | Michael, Peter Yang, Scott Tolinski, Matt Carey | **Shipped:** worktree cleanup, lifecycle hooks, cron tooling. Michael/Peter share an interview but describe separate environments. |
| 10 | K10 Share/version reusable skills | 5 / 4 | Jane Street's John, Uday, Theo, Matt, Thorsten | **Shipped:** skill distribution and fleet sync. **Open (I):** changed shared skill → known consumers → selected real smoke tests. |
| 11 | K11 Multiple reviewers with bounded work | 6 / 4 | Theo, Michael, Sumner, Peter Mattis, Matt, Jane Street's John | **Shipped:** review loops, machine verdicts, escalation/disposition tools. Residual: adapter/fixture, not consensus product. |
| 12 | K12 Native/target-machine handoff | 5 / 5 | Ben Davis, Thorsten, Theo, Ben Vinegar, Michael | **Shipped:** remote runners, native automation, media parsers. Residual: target-specific manifests/acceptance examples. |
| 13 | K13 Derive reusable domain material from repeated work | 5 / 4 | Andrew Qu, Every/Dan, Uday, Lovable/Fabian, Arg/Jackie | **Shipped internally (Q)** and public skill tooling. **Open (I):** detecting changed assumptions in selected learned skills. |
| 14 | K14 Check time-dependent UI behavior | 3 / 3 | Amp team, Michael, Wes Bos | **Shipped:** recordings and scenario tests. **Open (I):** small reusable temporal assertions with violating-frame evidence. |
| 15 | K15 Fresh-context workflow rehearsal | 2 / 2 | Ben Davis, Amp team | **Shipped:** skill-up and Pstack's blind eval playbook. Residual: native-workflow fixture/provenance contribution. |
| 16 | K16 Private/public repository projection | 1 / 1 | Ree; Ryan Dahl is credited secondhand, not counted again | **Shipped:** Copybara. Residual: explicit projection-policy fixture only. |
| 17 | K17 Single-practitioner specialist recipes | 1 per recipe | Karpathy's Anki format, Ben's playtest-state capture, Mattis's emitted-code check, Jane Street's internal bidding, etc. | Retain individually. Unrelated one-person niches do not combine into a multi-customer market. |
| 18 | K18 Other domain engineering and infrastructure | No combined count | Titus, Newman, Mattis, Modular, GPU engineers, Ramp, Basin, Durable Objects, TELUS, Runway, Lovable, Artifacts, and others | Many established packages/internal products. Full inventory retained; no blanket unmet-market claim. |

### Evidence roster and technique distinctions

**K01 — proof:** Michael records failure before editing and repeats the scenario afterward: “captures the before state while reproducing the issue” [[V04:11]]. Theo requires “evidence that you observed yourself in the session” [[V86:17]]. Ball asks for “irrefutable proof” and specifies real requests rather than mock previews [[V37:15]], [[V37:16]]. Matt asks for “TDD evidence” even when he did not begin with TDD [[V23:79]]. Sumner requires fail on the previous version/pass on the debug branch [[V71:02]]. Mattis inspects emitted instructions for a supposedly zero-overhead abstraction [[V22:88]]. Vinegar runs real pseudo-terminal interactions and gates releases on material performance regressions [[V82:69]]. Adam Jacob's factory relies on independently executable checks rather than judging code volume [[V55:20]]. Karpathy asks to “print this variable directly” after narrative and executed numbers disagree [[V62:60]]. Ramp compiles shared rules for one runtime, interprets them in another, tests parity and probes versioned canaries [[C10:21]], [[C10:36]]. **I:** these are different proof obligations; a screenshot is not a universal substitute.

**K02 — reusable learning:** Sumner's rule is “every time that you find yourself repeating something” write it down; he also puts informative errors earlier so log truncation does not hide them [[V71:09]]. Davis reviews a completed media-prep trace, revises the skill and checks persistence [[V31:13]], [[V31:15]]. Theo packages review/shipping/takeover routines [[V86:07]], [[V86:21]]. Matt's editor turns feedback into an issue, implementation, then review [[V23:74]]. Wes describes turning repeated troubleshooting into a skill rather than re-explaining [[V53:18]]. Qu distills recurring analyst questions into a filesystem/semantic layer and roughly 100 skills [[V68:08]]. Every extracts practices from tens of thousands of editorial changes and studies remaining human edits [[V73:29]]. Uday uses traces and corrections to refine RCA/skills [[V19:35]]. Arg's feedback becomes factory work rather than a detached report [[C03:20]]. **I:** error → repository constraint → regression case is more durable than endlessly appending prose.

**K03 — removal:** Michael starts a new model with no skills/AGENTS file, then adds back his workflow [[V04:44]]. Geoff says skills “should be deleted after every model release” [[V80:40]]. Matt abandons elaborate customization when defaults perform better [[V23:29]]. Katz adds temporary shims and wants deletion when evidence says they are unnecessary [[V66:16]]. Thariq reports removing most of an elaborate system prompt [[V70:05]]. Arize replaces specialist-agent complexity with a simpler skill-loading agent [[V45:15]]. Theo distinguishes his personal operating routine from brittle model-specific fixes [[V86:30]]. **I:** none implies deleting acceptance checks merely because a model got better.

**K04/K09 — isolation is not cleanup:** Michael's new-feature skill creates a worktree, but he later discovers “3,000 something work trees” plus dependencies/processes consuming memory [[V04:03]], [[V04:42]]. Peter separately cannot identify cron jobs spread across laptop, Mac Mini and cloud [[V04:42]]. Vinegar keeps six checkouts/providers and still gets five PRs conflicting [[V82:30]], [[V82:66]]. Matt separates day planning from smaller implementation sessions; Scott runs a Mac Mini plus remote-agent tools; Theo and Amp use different machines for different capabilities [[V23:48]], [[V56:04]], [[V01:23]], [[V37:22]]. Jane Street locks workspaces to features [[V08:70]]. Matt Carey's large API exploration/temporary artifacts illustrate task-owned leftovers [[V48:27]]. **I:** deleting a directory does not establish that its services, database, timer, or remote job ended; explicit ownership is the narrow additional datum.

**K05 — environment mismatch:** Sumner wraps build and execution together so the agent cannot test a stale debug binary [[V71:08]]. Ball's Nix/Home Manager case has a read-only global Git config; a per-clone helper and nonfatal handling address the actual environment [[V41:02]]. Theo uses a Windows VM for a PowerShell-specific problem [[V86:27]]. Dax describes an Australian Azure endpoint/cache parameter problem he cannot reproduce everywhere [[V13:17]]. **I:** preserve shell/OS, exact executable, effective settings, endpoint/region, and the failed operation; a generic doctor reporting green is insufficient. Better Stack's OpenShell report explicitly warns that its doctor can look green for an unsupported configuration [[V84:06]]. That is an additional reported diagnostic failure, not another independent implementation of the proposed pack.

**K06 — finish:** Ball waits for both served server commit and distributed CLI release before closing the customer loop [[V41:15]], [[V41:22]]. Theo distinguishes Full Stop's ready-for-human-merge boundary from Full Send's completion workflow [[V86:21]]. Michael still tests features himself and observes skipped review/unslop steps in some runs [[V04:16]], [[V04:25]]. Scott's support automation spans several apps [[V53:43]]. Uday keeps release accountability while considering a green lane [[V19:92]]. VSCO explicitly chooses execute, guide or upgrade and returns the appropriate UI destination [[C08:16]]. **I:** completion is a customer-defined predicate, not necessarily merge or successful tool invocation.

**K07/K08 — decisions and comprehension:** Matt's tiny interview skill “interview[s] you relentlessly”; he credits Thariq [[V23:34]]. Wayfinder tracks what parallel grilling sessions decided and what is still open [[V23:45]]. Michael uses a 5–10 minute voice conversation as the spec and defers account/setup facts into setup.md [[V04:28]], [[V04:31]]. Collison describes a strong-model plan followed by work across ten dev boxes [[V75:11]]. Lloyd's factory still begins with human-owned specs [[V69:09]]. Ree separates typed API intent from implementations and deliberately keeps a small understandable control surface [[V16:97]]. Davis reads load-bearing boundaries and removes excessive UI text [[V31:18]], [[V32:14]]. Ball reviews the load-bearing code [[V37:14]]. Armin's individually sensible plugin designs only worked together after a shim erased the intended architecture [[V82:86]], [[V82:87]]. Thariq's quiz and multiple contrasting designs keep the human involved [[V70:10]]. John calls agents “perpetual beginners” and describes explanatory diff chunks [[V08:67]], [[V08:85]]. **I:** more planning prose can worsen implementation; successful integration can still violate the owner's design.

**K10/K13 — distribution and semantics:** Jane Street warns that changing a shared skill can change behavior across the firm [[V08:67]]. Uday uses centralized platform context with corrections [[V19:35]]. Theo/Matt/Amp distribute repeatable local conventions [[V86:26]], [[V23:57]], [[V41:20]]. Qu's learned skills embed business semantics, Every's editorial skills encode preferences, Lovable turns migration experience into operational lessons, and Arg reuses accumulated work [[V68:09]], [[V73:29]], [[C06:19]], [[C03:19]]. **I:** common skill distribution is demonstrated; automated consumer impact or semantic staleness detection is an inference, not a stated purchasing request.

**K11 — review:** Theo caps rounds because scope “blows up”; three rounds can otherwise continue indefinitely [[V86:05]]. Michael uses a score/unresolved-comment gate and a ten-round cap [[V04:21]]. Sumner combines reviews but retains human merge judgment [[V71:15]]. Mattis uses different models adversarially; Matt includes implementation/review roles; Jane Street describes a review squad [[V22:74]], [[V23:74]], [[V08:83]]. **I:** a fresh reviewer can find things; agreement does not make a finding true, and unresolved dissent should not be averaged away.

**K12/K14/K15 — ordinary integration engineering reappears:** Amp hands genuine macOS file-watching tests to a MacBook runner [[V37:22]]. Theo uses Windows for Windows [[V86:27]]. Vinegar's install/update matrix exercises no install/old install and Homebrew/Nix in Firecracker VMs; it is a slow skill-plus-scripts lane, not an ordinary fast suite [[V82:70]]. Davis preps multicam/color/audio on an Ethernet-connected spare Mac, transfers assets, and needs the editor to receive an actually editable project [[V31:12]], [[V31:13]]. Amp checks animation “every single frame” [[V36:08]], Michael interrupts/refreshes streaming [[V04:12]], and Wes exposes a jittery border under fast pointer motion [[V59:11]]. Davis says “this thread is poison. This thread already knows too much” and has a fresh agent replay his original prompts; the replay includes steering [[V31:15]]. Amp launches fresh Orbs with ordinary wording and inspects the actual tool traces; its own evaluator notes missing revision/context evidence [[V39:01]], [[V39:05]]. **I:** distinguish unassisted success, assisted recovery and self-reported completion.

## Named-practitioner catalogue: what exactly is being done

The row appendix is exhaustive. This section preserves the important implementation details that broad cluster labels would otherwise flatten.

| Practitioner/source | Daily technique or hand-built thing, including small details | Already packaged? Smallest useful remainder |
|---|---|---|
| Theo, V01/14–16/85–88 | Council; bounded cross-model review; ready-to-merge versus merge-and-watch; takeover with attribution; voice-composed skills; nightly/stable channels; personally inspect evidence; hidden benchmark cases; real controller inputs and reference comparison; visual judges; observer threads; diagnose build queues/memory; task-provisioned machines; restart/config repair. | **F Shipped:** [tstack](https://github.com/t3dotgg/tstack) has council, sol-loop, full-send/full-stop, takeover, file-pr, babysit-pr and related routines. **Q Being built:** Lust/TS Rust, personal benchmark and game work. **I:** fixtures for actual invocation, composed end states and correct platform evidence; controller/reference traces remain a niche fixture idea, not a new agent loop. |
| Michael/Ras Mic on Peter Yang, V04 | Isolate → build → prove → review/ship; worktree per feature; service/action/orchestration conventions; record before changing code; repeat streaming/refresh scenario; numbers for nonvisual changes; human acceptance; review score/cap; voice requirements; setup.md; daily audit; personal model benchmark; home-lab machines; reactive worktree cleanup. | **F Shipped:** [rstack](https://github.com/michaelshimeles/rstack), including his own three skills and borrowed before/after, greploop, unslop. Current docs include cross-platform recording helpers; the video's untested-Windows limitation is historical. No new four-step framework. Residual: specific regression fixtures/cleanup integration. |
| Matt Pocock, V23 | teach; grill-me; grill-with-docs; Wayfinder across sessions; domain glossary; familiar deep modules/tracer bullets; spec → tickets → small Ralph work; architecture scan → tickets; feedback → issue → implement/review; default-vs-custom comparison; baseline-failing TDD evidence; day planning/night execution; voice-coaching spectrogram; custom video editor. | **F Shipped:** [skills](https://github.com/mattpocock/skills); [changelog](https://github.com/mattpocock/skills/blob/main/CHANGELOG.md) also ships retro and documents invocation/frontmatter fixes. **Q** Wayfinder/custom editor already authored. **I:** multi-owner contradiction fixtures and concrete compiler/lint examples; do not sell another interview skill. |
| Karpathy, V62 | Manual multi-provider council; escalate hard questions; new chat for unrelated subject; search volatile facts and inspect citations; clarify research scope; execute arithmetic/read code; print the variable used in prose; transcribe label before interpretation; chapters → summaries/questions/Mermaid; voice/read-aloud; own tone; vocabulary dictionary forms → delimited Anki; OCR baked subtitles → translation/grammar; NotebookLM source curation. | **F Shipped categories:** council workflows, notebooks, calculators, Anki, readers and subtitle tutors. **Q** custom GPTs/templates are already his packaging. **I:** tiny sentence/inflection fixtures and executable-number teaching examples. Reposted older recording; its model menu, exclusivity and pricing are not current facts. Label/lab demos are extraction workflows, not medical recommendations. |
| Thorsten Ball/Quinn Slack/Amp, V35–43/51 | Production-operation plugins; TS health aggregation; snooze; variant galleries; focused code review; real-path end-to-end proof; macOS runner; anonymized production-thread canaries; agent-operable code/routes; fresh unhinted Orbs and trace inspection; setup/resume/services.yaml; dev-only login/logout; clean browser controls; observation-only logs before fixes; flags/cohorts; live server plus CLI release; customer diagnostics/credits with review; Nix/git case; actual terminal-output render; pnpm patch maintenance. | **Q Shipped/internal:** Amp/Orbs/runners, operational plugins and scripts. **F Shipped evaluation:** [Pstack eval](https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/playbooks/eval.md), [skill-up](https://github.com/alibaba/skill-up). **I:** contribute fixtures for temporal invariants, setup/resume preservation, and release-channel predicates; no fresh runner or generic deployment platform. |
| Boris Cherny and Jarred Sumner, V71 | RoboBun issues → reproduction → discriminating test → PR; build-and-run forwarding wrapper to avoid stale binary; repeat correction into CLAUDE.md; informative errors before log noise; let agent read CI/build logs; several reviewers; overnight tasks with human merge; measurable performance goals; long-running terminal rendering; reject PRs cheaply. | **Q Internal/Shipped:** RoboBun and Bun scripts, Claude Code features. **F Shipped neighbors:** [Archon release-test skill](https://github.com/coleam00/Archon/blob/main/.claude/skills/test-release/SKILL.md), [gbrain test receipts](https://github.com/garrytan/gbrain/blob/master/docs/TESTING.md). **I:** stale child-executable fixture and correction-to-check examples, not another issue agent. |
| Lauren Tan's Pstack, narrated by Eric Tech V61 | Explain/how/why/teach; architecture and design variants; TDD; unslop; verify actual app including setup/services; ship/babysit through CI/conflicts; correct recurring errors; current public evaluation playbook. | **F Shipped:** [official Cursor Pstack](https://github.com/cursor/plugins/tree/main/pstack). This corrects the uncertain repository identity in earlier triage. **I:** prove cross-skill invocation and actual entry-point loading rather than reproduce its workflow. Narration is not a direct Lauren interview. |
| Ben Davis, V29–32 | CLIProxyAPI fork/gateway UI; Tailscale spare host; retained request/tool traces; Executor multi-account bindings; agent draft → deep link → human source-app finish; research templates → skills; FCP prep/transfer; fresh simulated user; custom dictation/audio archive/microphone priorities; hosted artifact drive; screenshot research service; UI subtraction; inspect architectural boundaries; inline tiny dependencies; quota-delta recorder. | **Q Already built:** his tools/skills. **F Shipped neighbors:** Code Insights, skill-up, OpenFCPXMLKit, dictation tools, quota trackers, storage products. **I:** one native receiving-side acceptance fixture or archive/export example; no new gateway, dictation app or trace product. |
| Armin Ronacher, Ben Vinegar, Geoff Huntley, V05/80/82 | Pi deliberately avoids automatic feature growth; self-edited extensions; resample a failing prefix; inspect sentiment after model change; morning issue delta classifier; hardware reverse engineering; remove burdensome tests; Hunk six checkouts; PTY input suite; 18 performance metrics blocking release; installer matrix; complexity/dependency-cruiser rules; built-ins → real plugins; diagnose design-erasing integration shims; retire skills on upgrades; insist on actual effects beyond tool names. | **F/Q Shipped:** Pi/Hunk products, [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), FileCheck/assembly tools and install recipes. **I:** concrete slow-tier matrix, plugin invariants, or effect-trace fixtures. Ben here is Vinegar, not Davis. Armin's test deletion and Vinegar's test expansion are scope-dependent disagreement, not consensus for maximum testing. |
| Jane Street, V08 | JaneGPT; OCaml provider SDK; typed-tool SDK/JSON bridge; structured response as one retryable tool; editor Markdown chat; Aid CLI; Aidmint Slack launch on AI identity; feature workspace/build target; internal Hoogle/Webs; Diffractor compositional explanatory diffs; review squad; Perfetto/magictrace; Lucy Goosey scoped pseudocode; eval/metagraders; bwrap/pasta/syscall monitoring; capability observation; internal bid/preemption scheduler; shared skills; retain rejected alternatives. | **Q Internal implementations:** extensive existing platform, not public gap proof. **I:** shared-skill consumer smoke tests; a narrative-diff reconstruction test; a capped agent-bid adapter only if existing scheduler policy cannot do it. Code/cluster ownership and AI identity are already addressed internally. |
| Stripe, V75 | Claude preinstalled in dev boxes; Slack Minions fresh workspace → tests → PR; plans distribute work to ten boxes for days; invariant checks; semantic granular permissions; instrumentation and progressive rollout; assess incidents per time versus per PR. | **Q Shipped internally:** Minions/engineering infrastructure. **I:** reusable examples connecting a plan's acceptance obligations to actual release checks; never infer production quality from “one revert” alone or propose another Minions host. |
| Shopify, V74 | Complexity-normalized productivity measurement; strong models for exploration/development, cheaper fine-tuned production models; runaway circuit breakers despite broad token access; merchant action sequences/digital twins and counterfactual interventions; deadline-slip assistant. | **Q Existing internal products/practice:** not a wish for a new generic router or digital twin. **I:** small circuit-breaker/metric-denominator examples and counterfactual provenance fixture. Prediction is not established causal intervention effectiveness. |
| Titus Winters, Newman, Mattis, V17/20/22 | Deterministic rewrite recipes/codemods with ownership batches; review lessons into lints; database migrations in CI; observability over architecture diagrams; idempotency plus intent/fingerprint; retry budgets/cache warming; bootstrap dependencies; dev/ops/business contracts; held-out config matrix; property/metamorphic/DST checks; emitted production code and actual performance. | **F Shipped mechanisms:** OpenRewrite, DB migration tools, property/chaos testing, FileCheck. **I:** domain-specific example or fixture; no revival of broad migration, proof, type-check or test-generation categories. |
| Vercel, Every, Arize, Warp, Thariq, Katz | Mine recurring questions/editorial corrections; file-based domain semantics; inspect traces and turn failures into evals; short per-user memory; simplify specialist agents; factory status boards; explicitly owned plans; contrasting designs/quiz; model-specific shims with removal telemetry. | **Q/F Shipped or actively owned:** Eve, Every tools, Phoenix/Arize, Warp and public skills. **I:** domain-change cases and ablation data. Generic trace → skill → eval generation already has owners. |
| Connect builders: Cloudflare, Arg/Relevance AI, Basin, Durable Objects, Artifacts | Custom agent representations; shared versioned filesystem formats/mounts; feedback→PR factory; metrics semantics/lineage; partition coordination; SQL/alarm queues and watchdogs; real customer examples; Git/Wasm conformance; sharded indexes, token/alarm/commit state, mixed-version names migration; production health checks. | **Q Shipped/owned implementations**, with explicit roadmap items separately in Appendix B. **I:** contribute exact transition/failure fixtures to owners, not clone their platform. Passive hibernation checks and missing-at-source telemetry have distinct boundaries; generic durability is killed. |
| Connect customers/platforms: Ramp, Sentry, VSCO, TELUS, Lovable, Runway | Shared YAML interpreted/compiled parity; extraction-cost ordering and bounded prefix fallback; freshness distinct from expiry; versioned canaries; classifier cascades/shadow labels; capability/prerequisite/plan catalog; execute/guide/upgrade; connector/auth/metering; sampled analytics caused a sevenfold user-count misunderstanding; standalone status Worker; org picker and bindings; SSR bundle/config-hash invalidation; move large libraries to build stage; creative references and budgets. | **Q Already implemented** by named owners; Runway's Solaris direction remains reported work/roadmap. **I:** tiny fixtures around exact counts, capability matrices, fallback transitions, bundle budgets and release predicates. No new classifier, auth, platform, SSR host or model router. |

## Prior art: checked current state and what it actually removes

**F — Method/date:** Public repository READMEs, skills, issue histories, changelogs, product/docs pages, npm metadata, and practitioner discussion were inspected on 2026-10-28. “Shipped” here establishes published implementation or documentation, not an independent execution audit. GitHub `main` is mutable; the date is the snapshot boundary. Results below supersede tentative absence claims in phase-one ledgers.

| ID / clusters | Current classification and primary sources | Bounded remainder or reason to stop |
|---|---|---|
| A01 / K01–04,06,11 | **Shipped:** [tstack](https://github.com/t3dotgg/tstack) packages Theo's composable everyday workflows, including review, takeover, shipping and a stop-before-merge boundary. | Adopt it. A new generic council, full-send, takeover or review-loop bundle has no gap demonstrated here. The transcript says Soul Loop; repository name is sol-loop. |
| A02 / K01,04,14 | **Shipped:** [rstack](https://github.com/michaelshimeles/rstack) includes evidence capture scripts/doctor/manifests and workflow skills. Current documentation covers Linux, macOS and Windows and distinguishes screenshot/video/performance evidence. | Do not revive “Windows recording missing” from the older video. Support is documented, not independently tested here. A particular interaction assertion/fixture may still be useful. |
| A03 / K02,03,07,08,10 | **Shipped:** [Matt's skills](https://github.com/mattpocock/skills). [Changelog](https://github.com/mattpocock/skills/blob/main/CHANGELOG.md): retro handles environmental/navigation/tool-access friction; mechanical conventions should become checks; bad YAML hid six skills; implicit-invocation metadata hid another; explicit Skill-tool calls and correct target names repaired composition. | Kills generic retrospective → rules tooling. These historical defects support invocation fixtures, not a claim the known bugs remain unfixed. Renames/composition change workflow behavior: [discussion 333](https://github.com/mattpocock/skills/discussions/333). |
| A04 / K01–03,06–08,11,15 | **Shipped:** [Pstack guide](https://github.com/cursor/plugins/blob/main/pstack/docs/guide/README.md), [correct](https://github.com/cursor/plugins/blob/main/pstack/skills/correct/SKILL.md), [blind eval playbook](https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/playbooks/eval.md). Corrections prefer architecture/types/checks/tests before more prose; evals separate task prompt from hidden rubric. | Generic correction-to-enforcer and blind skill evaluation are already available. [Issue 527](https://github.com/cursor/plugins/issues/527) records hidden routed skills; closed by [PR 577](https://github.com/cursor/plugins/pull/577). A historical fixed regression can seed a conformance corpus. |
| A05 / K03,10,15 | **Shipped:** [Alibaba skill-up](https://github.com/alibaba/skill-up) supports baseline comparison, multiple engines, fixtures, deterministic/model judges, CI/JUnit, and multi-turn simulated users with separately assigned engines. [Custom engine interface](https://github.com/alibaba/skill-up/blob/main/docs/design/custom-engine.md). | This also covers Ben Davis's simulated-user shape. Do not build another fresh-context runner. Narrow contribution: realistic native task fixture, exposed invocation evidence, or a published comparison. |
| A06 / K02,05 | **Shipped:** [Code Insights](https://github.com/melagiri/code-insights), [product](https://www.code-insights.app/): imports several harness histories, classifies friction, provides weekly reflection and exports reusable knowledge/rules. [npm metadata](https://registry.npmjs.org/@code-insights%2fcli) records 4.11.0 published 2026-05-19. | Another multi-harness friction dashboard is occupied. Exact executable/region/immutable-config diagnostic fixtures are a possible extension; check current schemas before coding. |
| A07 / K03,10 | **Shipped:** [agent-utilities](https://github.com/novotnyllc/agent-utilities) includes fleet-chezmoi probes/plans and skill-cleaner usage/duplication/description auditing. | Generic fleet sync, drift display and duplicate/stale-description cleanup are not open. Consumer-specific semantic smoke tests are a narrower inference. |
| A08 / K04,09 | **Shipped:** [Agent Session Manager cleanup reference](https://agent-session-manager.justindfuller.com/documentation/reference/worktree-cleanup/) describes managed-tree cleanup with locks, active panes, dirty/unpushed/recent work checks; public v0/alpha. [ub-agents cleanup](https://agents.uberblick.ai/docs/configuration/cleanup) passes worktree/run context to an idempotent teardown hook and retains failed cleanup for retry. | Directory cleanup and resource hooks already exist. A dry-run owner manifest connecting process/database/timer/remote host is the only candidate here; test existing hooks before adding another manager. Neither Git status nor these checks prove ignored files/unsaved buffers are disposable. |
| A09 / K11 | **Shipped:** [multi-agent-review](https://github.com/salmanalibanani/multi-agent-review) publishes bounded rounds, finding dispositions, machine verdicts and failure exits. [devgeta ADR-0017](https://github.com/cjairm/devgeta/blob/main/docs/decisions/ADR-0017-review-loop-escalates-instead-of-seeking-consensus.md) documents escalation rather than voting away blockers. | A new dissent ledger/consensus loop is redundant. At most an adapter for a particular existing skill. |
| A10 / K01,05,12 | **Shipped:** [Archon test-release skill](https://github.com/coleam00/Archon/blob/main/.claude/skills/test-release/SKILL.md) rehearses brew/curl install paths, explicit binary identity and version/commit checks, CI-like build flags and temporary installs. [gbrain testing](https://github.com/garrytan/gbrain/blob/master/docs/TESTING.md) includes executed test receipts and check-discriminates requirements. | Kills generic installer-rehearsal and baseline-failing-test wrappers as novel mechanisms. A realistic old-version/package-manager or stale child-binary case can still be a useful contribution. |
| A11 / K01,17 | **Shipped:** [LLVM FileCheck](https://www.llvm.org/docs/CommandGuide/FileCheck.html), [cargo-show-asm](https://docs.rs/cargo-show-asm/latest/cargo_show_asm/). | Mattis's emitted-code check is a library-specific recipe/CI example, not a new compiler-proof system. |
| A12 / K14 | **Shipped:** [Playwright video](https://playwright.dev/docs/videos), [Jam](https://jam.dev/resolve), [Replay](https://docs.replay.io/basics/debugging/overview). Recordings, replay, context collection and visual testing are established. | **Open (I):** a very small temporal invariant helper with a specified moving/stationary subject and violating-frame output. No absence claim about all visual-testing vendors. |
| A13 / K12,15 | **Shipped:** [OpenFCPXMLKit](https://github.com/TheAcharya/OpenFCPXMLKit), [CLI](https://github.com/TheAcharya/OpenFCPXMLKit/blob/main/Sources/OpenFCPXMLKitCLI/README.md), [2026 changelog](https://github.com/TheAcharya/OpenFCPXMLKit/blob/main/CHANGELOG.md): validation, media summaries/copy, missing original/proxy reporting and multicam processing. | Strongly shrinks the media-preflight idea. Remaining task is a real recipient-side project/media check and workflow fixture; do not write another FCPXML parser. |
| A14 / K16 | **Shipped:** [Google Copybara](https://github.com/google/copybara), including repository transformations. [Private/public filtering discussion](https://github.com/google/copybara/issues/24) predates this corpus by years. | A projection-policy test over notes/metadata/attribution may be a tiny recipe. No new private/public mirror product justified. |
| A15 / K17 | **Shipped:** Unreal's [BugItGo](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UCheatManager/BugItGo?lang=en-US) restores position/rotation. | State capture/teleport is not new. Ben's particular JSON inventory/quest state and issue→repair adapter could be a weekend plugin, conditional on engine/tool overlap. |
| A16 / K06 | **Shipped:** [Postcept](https://postcept.com/), [MCP implementation](https://github.com/Postcept/mcp), [Stigg entitlements](https://www.stigg.io/product/entitlements). Business readback and capability/plan infrastructure have owners. | VSCO-style customer-specific execute/guide/upgrade or release-channel checks are application fixtures, not a new universal completion SDK. |
| A17 / K08,18 | **Shipped:** [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), [OpenRewrite](https://docs.openrewrite.org/), ordinary static architecture rules. | An integration shim can still erase intended runtime identity/state semantics. Only a concrete owner's semantic contract fixture is a residual; static dependency guards are not new. |
| A18 / K13,18 | **Shipped:** [MetricFlow](https://docs.getdbt.com/docs/build/about-metricflow), [OpenLineage specification](https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.md). Skills/evals have their own existing frameworks above. | A domain-skill change case linking glossary/query meaning to real evaluations is narrower than a semantic layer or lineage product. Automated semantic invalidation demand is unverified. |
| A19 / K17 | **Shipped:** [ccusage](https://github.com/ccusage/ccusage), [token-burn](https://github.com/durandom/token-burn), [Readwise AI policy/features](https://readwise.io/ai-policy), [FlixFluent Korean](https://flixfluent.com/en/learn/korean-with-netflix/), [Jev palette](https://github.com/amycardoso/jev-palette). | Quota accounting, highlighted reading, subtitle tutoring and semantic command palettes are occupied. Preserve custom fixtures/exports instead of claiming each individual workflow is a market gap. |

**F — Registry sanity check:** npm's [skills metadata](https://registry.npmjs.org/skills) reports 1.7.4 on 2026-10-19; [@playwright/test](https://registry.npmjs.org/@playwright%2ftest) reports 1.64.1 on 2026-10-14; [@postcept/mcp](https://registry.npmjs.org/@postcept%2fmcp) reports 0.3.3 on 2026-07-15. These are metadata checks, not claims every installed consumer uses these versions. The similarly named `@d1testflare/analytics-engine` points to an old Miniflare-era package; its 2022 publication is not evidence of a new maintained 2026 exact-count solution.

**F/I — Blogs, HN and X:** Primary changelogs/ADRs above are stronger capability evidence than directory listings. HN discussions of [grill-me adoption and harness differences](https://news.ycombinator.com/item?id=49840054), [teach used for hands-on Java concurrency](https://news.ycombinator.com/item?id=49234675), and [tests that remain green after reverting a fix](https://news.ycombinator.com/item?id=47243272) provide qualitative corroboration, not independent market counts or controlled outcomes. Targeted X discovery did not yield inspectable posts that improved primary-source verification; X absence is not evidence of an open gap. No project here depends on an unverified X assertion.

## Project cards

All concepts below are **I**. Source quotations are **Q**. Development time and scores are **E**. Scores are ordered **C / T / G / V / S / N**: cool; Cloudflare/Vercel/TypeScript adjacency; real gap; value; survives better models; distinct from GrowOS. Each is 1–5. High N does not mean a large market. “Owner reason” is a contribution strategy, not a claim the platform owner cannot implement it. Exact residual demand remains unproven. P01–P25 are the complete proposed-project set; appendix packaging hints are evidence dispositions, not thousands of additional endorsed projects.

### P01 — Concrete proof recipes, not a new proof runner

**Tiny; Shipped mechanism / Open content. Manual family N=10, 9 channels.**

- **Sources:** Michael “captures the before state” [[V04:11]]; Matt “fail without this change” [[V23:79]]; Sumner's previous/debug branch gate [[V71:02]]; Karpathy “print this variable directly” [[V62:60]].
- **One sentence:** Contribute a small pack of runnable, baseline-failing examples showing which evidence actually establishes each change type.
- **30-second demo:** A streaming fix has a green unit test; run the refresh/interruption recipe and see it fail on the baseline, pass on the fix, with both videos and exact revisions.
- **Closest:** [rstack](https://github.com/michaelshimeles/rstack), [gbrain](https://github.com/garrytan/gbrain/blob/master/docs/TESTING.md), [Pstack](https://github.com/cursor/plugins/tree/main/pstack). Reuse their runners/receipts.
- **Who / owner reason:** Maintainers writing acceptance recipes; project-specific examples are easier to contribute upstream than impose as generic defaults.
- **Start / kill:** Publish three actual regressions with existing tools; stop if no additional recipe is needed or maintainers cannot reuse any within a week.
- **Scores:** **3 / 5 / 2 / 4 / 5 / 5**. No generic verification product.

### P02 — Correction-to-check worked examples

**Tiny; Shipped workflow / Open dataset contribution. N=9, 7 channels.**

- **Sources:** Sumner “every time ... repeating something” [[V71:09]]; Davis “how can we improve this” [[V31:13]]; Matt's feedback pipeline [[V23:74]].
- **One sentence:** Publish ten real repeated corrections with the smallest architecture/type/lint/test change that prevents recurrence.
- **Demo:** Select “error hidden after noisy output”; replay the old failing command and show the new deterministic check catches the regression without adding an AGENTS paragraph.
- **Closest:** [Pstack correct](https://github.com/cursor/plugins/blob/main/pstack/skills/correct/SKILL.md), [Matt retro](https://github.com/mattpocock/skills/blob/main/CHANGELOG.md), [Code Insights](https://github.com/melagiri/code-insights).
- **Who / owner reason:** Skill authors; generic enforcement already exists, while examples cross repositories and languages.
- **Start / kill:** Ask three maintainers for a recurring correction and implement it with existing tools; stop if examples are obvious duplicates with no repeat-error reduction.
- **Scores:** **3 / 5 / 1 / 3 / 5 / 5**. A useful contribution, a poor standalone product.

### P03 — Skill invocation and composition conformance corpus

**Small → Tiny upstream; Open bounded contribution beside shipped eval tools. Two direct workflow-composition cases in video, two independent public-library defect histories; do not add those into four video practitioners.**

- **Sources:** Theo composes skills by voice [[V86:26]]; Michael observes skipped stages despite instructions [[V04:16]], [[V04:25]]. **F:** Matt's changelog and Pstack issue 527 supply concrete historical load/invocation failures.
- **One sentence:** Test that a named workflow's leaf skills are discoverable, actually invoked and available from the intended harness and working directory.
- **Demo:** Introduce invalid frontmatter or hide a leaf skill; a natural task still produces confident prose, but the smoke test fails on a missing invocation; repair it and show the loaded-file/tool trace.
- **Closest:** [skill-up](https://github.com/alibaba/skill-up), [Pstack fixed issue](https://github.com/cursor/plugins/issues/527), [Matt changelog](https://github.com/mattpocock/skills/blob/main/CHANGELOG.md). New value is portable fixtures and trace assertions, not a runner.
- **Who / owner reason:** Public skill maintainers with several supported harnesses; cross-project regressions fit a shared corpus and upstream adapters.
- **Start / kill:** Reproduce three historical failures with two pinned harness/skill versions; stop or upstream only if current tests already exercise actual leaf invocation, including cwd/metadata variants.
- **Scores:** **4 / 5 / 4 / 4 / 5 / 5**. Avoid inferring invocation solely from the final answer.

### P04 — Model-upgrade instruction ablation recipes

**Tiny; Shipped runner / Open comparative dataset. N=7, 6 channels.**

- **Sources:** Michael's clean baseline [[V04:44]]; Geoff “deleted after every model release” [[V80:40]]; Matt returns to defaults [[V23:29]].
- **One sentence:** Publish reproducible keep/remove results for old instructions against unchanged acceptance cases after a model upgrade.
- **Demo:** Compare no skill/current skill/minimal skill on the same held-out tasks; show failures, interventions, time and cost, rather than one aggregate judge score.
- **Closest:** [skill-up](https://github.com/alibaba/skill-up), [skill-cleaner/fleet tooling](https://github.com/novotnyllc/agent-utilities). Do not build their comparison engine again.
- **Who / owner reason:** Skill maintainers; useful model/task evidence is distributed and changes independently of one host.
- **Start / kill:** Three skills, two model versions, fixed cases and repeated runs; stop if results do not change any instruction decision or are dominated by ordinary sampling variance.
- **Scores:** **4 / 4 / 2 / 4 / 4 / 5**.

### P05 — Environment-mismatch diagnostic recipe pack

**Small; Open exact pack / Shipped diagnosis products. N=4, 4 channels.**

- **Sources:** Sumner's “debug build that's ... stale” [[V71:08]]; Ball “could not lock config file” [[V41:02]]; Theo Windows/PowerShell VM [[V86:27]]; Dax Australian Azure/cache case [[V13:17]].
- **One sentence:** Turn recurring environment mismatches into local, read-only probes with a reproduction command and a precise failure fingerprint.
- **Demo:** A test claims success against an old binary; the probe prints actual executable/build identity, reproduces the mismatch and suggests the existing build-and-run wrapper.
- **Closest:** [Code Insights](https://github.com/melagiri/code-insights), [Archon test-release](https://github.com/coleam00/Archon/blob/main/.claude/skills/test-release/SKILL.md), provider conformance tooling in the E02 triage. No general telemetry service.
- **Who / owner reason:** Maintainers debugging machine/provider-specific reports; a cross-repository case library complements owner-specific doctors.
- **Start / kill:** Implement four deterministic fixtures: stale binary, immutable global Git config, wrong target OS, endpoint-region cache parameter. Stop if existing diagnostics already isolate them with equivalent evidence or no cross-repo reuse appears.
- **Scores:** **4 / 5 / 3 / 4 / 5 / 5**. Collect only explicit diagnostic inputs; do not dump ambient credentials/configuration.

### P06 — Task-resource lifetime manifest and dry-run cleanup

**Small; Open integration / Shipped cleanup mechanisms. N=4 cleanup reporters, 3 channels; seven isolation practitioners are adjacent evidence.**

- **Sources:** Michael “3,000 something work trees”; Peter cannot locate spread-out cron jobs [[V04:42]]. Scott and Matt Carey supply additional task-artifact context [[V56:04]], [[V48:27]].
- **One sentence:** Associate a task's worktree with its explicitly registered services, database, timer and remote host, then preview what survives task closure.
- **Demo:** Remove a demo worktree; dry run identifies a still-running service and a timer on another host, with owners and existing cleanup commands; nothing is deleted automatically.
- **Closest:** [ub-agents lifecycle hook](https://agents.uberblick.ai/docs/configuration/cleanup), [Session Manager cleanup](https://agent-session-manager.justindfuller.com/documentation/reference/worktree-cleanup/). Reuse hooks; general cron inventory already exists.
- **Who / owner reason:** Multi-host solo builders; launchers know their own tasks but not arbitrary resources launched elsewhere.
- **Start / kill:** One JSON manifest format and two existing launcher adapters; stop if passing run context through existing hooks completely solves the cases or users will not register ownership.
- **Scores:** **3 / 5 / 3 / 4 / 5 / 5**. Worktree count is one anecdote, not a market-size estimate.

### P07 — Shared-skill consumer smoke-test manifest

**Big, weeks; Open (I) bounded integration. One explicit shared-change warning, five distribution practitioners/four channels.**

- **Sources:** Jane Street's “perpetual beginners” and broad effects of skill changes [[V08:67]]; Uday's corrected platform skills [[V19:35]].
- **One sentence:** A changed shared skill selects known consumer repositories and runs their owner-supplied smoke cases in existing CI/eval systems.
- **Demo:** Change a shared release skill; CI names three declared consumers, runs two relevant workflows and shows one invocation regression with exact skill/harness revisions.
- **Closest:** [skill-up](https://github.com/alibaba/skill-up), [fleet-chezmoi](https://github.com/novotnyllc/agent-utilities), ordinary dependency CI.
- **Who / owner reason:** Small organizations maintaining shared skills; one harness can ship this, but consumer-specific cases cross hosts and repos.
- **Start / kill:** Two organizations, three consumers each, one real skill upgrade; stop if consumers cannot be enumerated, evaluation costs dominate, or existing dependency CI suffices.
- **Scores:** **4 / 5 / 3 / 4 / 5 / 4**. Do not infer semantic impact from a file hash alone.

### P08 — Native-workflow fresh-context fixture

**Tiny; Shipped evaluation / Open fixture. N=2 teams, 2 channels.**

- **Sources:** Davis “this thread is poison” [[V31:15]]; Amp asks fresh Orbs ordinary unhinted questions [[V39:01]].
- **One sentence:** Package one native workflow with original prompts, persisted files only, actual revision/tool traces and separately reported user steering.
- **Demo:** Replay media prep without the authoring transcript; the missing transfer prerequisite fails; add the persisted prerequisite and replay, displaying interventions rather than concealing them.
- **Closest:** [skill-up multi-turn simulation](https://github.com/alibaba/skill-up), [Pstack blinded eval](https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/playbooks/eval.md). Both remove the generic runner opportunity.
- **Who / owner reason:** Native-app skill maintainers; application fixtures belong with the workflow rather than a generic engine.
- **Start / kill:** Contribute one reproducible case to an existing runner; stop if license/private media prevents sharing or if an existing example already covers it.
- **Scores:** **4 / 3 / 2 / 3 / 5 / 5**.

### P09 — Review-disposition adapter for an existing skill

**Tiny; Shipped general feature. One direct scope-inflation case; six review practitioners/four channels.**

- **Sources:** Theo's “scope blows up” and three-round cap [[V86:05]]; Michael's capped review loop [[V04:21]].
- **One sentence:** Translate one existing review skill's rounds into an existing disposition/verdict schema, retaining rejected findings and blockers.
- **Demo:** Reviewers disagree after the round cap; output an unresolved blocker with cited evidence and human escalation, not forced consensus.
- **Closest:** [multi-agent-review](https://github.com/salmanalibanani/multi-agent-review), [devgeta escalation ADR](https://github.com/cjairm/devgeta/blob/main/docs/decisions/ADR-0017-review-loop-escalates-instead-of-seeking-consensus.md), tstack.
- **Who / owner reason:** Existing skill users; upstream adapter work is more plausible than a new owner-resistant product.
- **Start / kill:** Convert one saved review trace and ask the maintainer to use it; stop if native output already preserves all actionable states.
- **Scores:** **2 / 5 / 1 / 3 / 4 / 5**.

### P10 — Composed workflow end-state fixtures

**Tiny; Open exact fixtures / Shipped workflows. Two direct composition/skipped-stage cases; six completion practitioners/six channels.**

- **Sources:** Theo composes “Full stop takeover soul loop” [[V86:26]]; Michael observes review/unslop omission [[V04:16]], [[V04:25]].
- **One sentence:** Encode whether a composed workflow stopped at the requested boundary and actually performed its required evidence/review stages.
- **Demo:** A ready-for-merge task finishes confidently but omits review; fixture fails on missing stage evidence, while a legitimate human-merge boundary passes.
- **Closest:** [tstack](https://github.com/t3dotgg/tstack), [rstack](https://github.com/michaelshimeles/rstack), [skill-up](https://github.com/alibaba/skill-up).
- **Who / owner reason:** Maintainers of composable skills; owner should accept the fixture directly, which is the intended outcome.
- **Start / kill:** Three compositions with an explicit final-state predicate; stop if P03's invocation assertions plus existing end-state tests cover everything.
- **Scores:** **3 / 5 / 2 / 4 / 5 / 5**. Likely fold into P03.

### P11 — Customer-specific fix-live receipt

**Small; Open application adapter / Shipped release and outcome products. Two support-loop implementations; six broad completion practitioners.**

- **Sources:** Ball “let me know once this is live,” server commit plus CLI release [[V37:28]], [[V41:22]]; Scott's cross-app support workflow [[V53:43]].
- **One sentence:** A small Worker verifies the specific release channels needed for one support issue and returns a reviewable closure packet.
- **Demo:** Server fix is live but CLI package is old; packet remains incomplete; publish matching CLI and display the evidence links and draft customer answer.
- **Closest:** [Postcept](https://postcept.com/), existing issue/deploy automations, Amp's implementation. Generic release notification is not new.
- **Who / owner reason:** Maintainers with server plus CLI/desktop distribution; their completion predicate spans vendors and belongs to the app owner.
- **Start / kill:** One repository and one real server/CLI issue; stop if the support/CI platform already joins the required predicates without custom code.
- **Scores:** **3 / 5 / 2 / 4 / 5 / 5**. Outbound messaging remains a separate user-controlled step.

### P12 — Target-machine reproduction bundle

**Small; Open recipe / Shipped runners. N=5 native/target-machine practitioners, 5 channels; Amp and Theo are the most direct target-OS cases.**

- **Sources:** Ball sends messages/files to a genuine macOS runner [[V37:22]]; Theo tests PowerShell in a Windows VM [[V86:27]].
- **One sentence:** A skill assembles revision, fixture, commands, declared capabilities and returned artifacts for an existing native runner.
- **Demo:** A file-watcher fix passes Linux but fails macOS; send the same small reproduction to the registered Mac and show actual OS/event evidence.
- **Closest:** Amp runners, existing CI/native labs and [Archon release-test](https://github.com/coleam00/Archon/blob/main/.claude/skills/test-release/SKILL.md).
- **Who / owner reason:** Cross-platform maintainers with hardware already available; project-specific manifests need not become another hosted runner service.
- **Start / kill:** One macOS watcher and one Windows shell case; stop if an ordinary CI job/artifact upload is equally usable or no handoff information is missing.
- **Scores:** **3 / 4 / 2 / 3 / 5 / 5**.

### P13 — Slow install/update matrix examples

**Tiny; Shipped mechanism / Open example contribution. One direct corpus implementation.**

- **Sources:** Vinegar “a skill and a bunch of scripts ... it's slow ... hardware” [[V82:70]].
- **One sentence:** Publish a minimal slow-tier installer matrix covering old/no install, package-manager routes and actual executed binary identity.
- **Demo:** A cached shell finds the old binary after an upgrade; the actual-path/version check fails only that matrix cell and preserves its log.
- **Closest:** [Archon release-test](https://github.com/coleam00/Archon/blob/main/.claude/skills/test-release/SKILL.md), standard VM/package-manager CI. Much of the exact idea is already shipped.
- **Who / owner reason:** Small CLI/TUI maintainers; reusable case content can be contributed without introducing a platform.
- **Start / kill:** Adapt one existing skill to two releases of a small CLI; stop if existing documented routes need no additions.
- **Scores:** **3 / 4 / 1 / 3 / 5 / 5**.

### P14 — Production-elimination CI example

**Tiny; Shipped mechanism. One direct practitioner.**

- **Sources:** Mattis “looks at the decompiled code ... only a few actual instructions” [[V22:88]].
- **One sentence:** Document a concrete test hook/abstraction that must disappear from a production build and check it with existing emitted-code tooling.
- **Demo:** Toggle a test hook's conditional compilation; ordinary behavior tests pass, but FileCheck detects the forbidden production call.
- **Closest:** [FileCheck](https://www.llvm.org/docs/CommandGuide/FileCheck.html), [cargo-show-asm](https://docs.rs/cargo-show-asm/latest/cargo_show_asm/).
- **Who / owner reason:** Performance-sensitive library maintainers; production obligations vary by symbol, optimization mode and target.
- **Start / kill:** One real library, one explicit obligation, pinned compiler/target; stop if a standard codegen test already covers it or assembly churn makes it unmaintainable.
- **Scores:** **4 / 2 / 1 / 3 / 5 / 5**. A recipe, not proof of semantic equivalence.

### P15 — Temporal interaction assertion helper

**Small; Open bounded helper beside shipped video/visual tools. N=3 reporting groups, 3 channels; only Amp demonstrates the frame-by-frame automation.**

- **Sources:** Amp “look at every single frame” [[V36:08]]; Michael's interrupted streaming case [[V04:12]]; Wes's jitter under rapid pointer motion [[V59:11]].
- **One sentence:** Add a few owner-specified temporal assertions to Playwright interactions, emitting movement/state traces and the frames that violate them.
- **Demo:** Sweep the same pointer path over a tooltip; screenshots look plausible, but a stationary icon exceeds a two-pixel movement tolerance; show before/after trace and offending frames.
- **Closest:** [Playwright recording](https://playwright.dev/docs/videos), [Replay](https://docs.replay.io/basics/debugging/overview), existing visual-testing tools. The candidate is the explicit temporal assertion, not recording or generic video judging.
- **Who / owner reason:** TS UI maintainers; reusable assertions can become an upstream helper, while acceptable movement/stream behavior remains app-specific.
- **Start / kill:** Reproduce one hover jitter and one streaming refresh defect; inspect existing visual-tool temporal APIs. Stop if these can be expressed cleanly already or capture noise cannot be separated from the defect.
- **Scores:** **4 / 5 / 3 / 4 / 5 / 5**. Do not treat all intended animation as jitter.

### P16 — Editor-side media handoff acceptance

**Small → Tiny integration; Open exact receiving workflow / Shipped parser and preflight. One direct practitioner.**

- **Sources:** Davis “preparation, delivery, and receiving” [[V31:14]]; editor needs a ready-to-edit project [[V31:12]].
- **One sentence:** Wrap existing FCPXML/media checks in a recipient-side checklist that verifies the copied project resolves its assets on the editor's machine.
- **Demo:** A preparation job reports done, but the receiving Mac lacks one original; show the missing item, copy it with existing tools, reopen the project and attach readback.
- **Closest:** [OpenFCPXMLKit](https://github.com/TheAcharya/OpenFCPXMLKit), [its CLI](https://github.com/TheAcharya/OpenFCPXMLKit/blob/main/Sources/OpenFCPXMLKitCLI/README.md), native editor relinking/import workflows.
- **Who / owner reason:** Small creator/editor teams; the destination machine, paths and human acceptance are workflow-specific.
- **Start / kill:** Replay one actual handoff with a deliberately absent original/proxy; stop if the current CLI report plus ordinary editor import fully solves it.
- **Scores:** **4 / 2 / 2 / 3 / 5 / 5**. Do not automate creative cuts merely because preparation works.

### P17 — Domain-skill assumption change gate

**Big, weeks; Open (I) exact integration. Five reusable-domain-material practitioners/four channels; zero explicit requests for this exact gate.**

- **Sources:** Qu mines repeated business queries into skills [[V68:08]]; Every encodes editorial corrections [[V73:29]]; Jane Street warns about shared changes [[V08:67]].
- **One sentence:** Tie selected learned skills to owner-declared business definitions and run relevant held-out cases when those definitions change.
- **Demo:** Change whether a metric includes refunded orders; display affected declared skills and a failing saved query, then rerun after the owner updates the definition.
- **Closest:** [MetricFlow](https://docs.getdbt.com/docs/build/about-metricflow), [OpenLineage](https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.md), [skill-up](https://github.com/alibaba/skill-up).
- **Who / owner reason:** Teams that already maintain domain skills; mappings bridge their semantic source and chosen harness.
- **Start / kill:** Obtain two real definition changes and a handful of skills; stop if ordinary lineage/tests cover them or skill owners cannot state a stable dependency contract.
- **Scores:** **4 / 5 / 2 / 4 / 5 / 3**. Larger and less validated than the small recommendations; no generic semantic layer.

### P18 — Repository projection policy fixture

**Tiny; Shipped transformation / Open project-specific check. One direct practitioner.**

- **Sources:** Ree keeps private internal notes and publishes a clean projection [[V16:113]]; Ryan Dahl is an attributed inspiration, not a separate observed implementation.
- **One sentence:** Add a projection fixture that checks an owner's allowlist, history/metadata expectations and attribution using an existing repository transformer.
- **Demo:** Change an allowed source file and a private note; transform into a disposable destination and show expected content plus an intentional policy failure.
- **Closest:** [Copybara](https://github.com/google/copybara).
- **Who / owner reason:** A small open-source maintainer with private project context; policy is local and owner-managed.
- **Start / kill:** Reproduce one real projection policy; stop if Copybara configuration/tests express everything already.
- **Scores:** **2 / 4 / 1 / 2 / 5 / 5**. Do not claim a complete confidentiality guarantee from a fixture.

### P19 — Game playtest state-to-repair adapter

**Small, niche; Open exact adapter / Shipped state restoration. One direct practitioner.**

- **Sources:** Davis's game/playtest workflow serializes the state needed to reproduce a defect [[V29:11]].
- **One sentence:** Turn an existing game's location/quest/inventory snapshot plus a playtest observation into a replayable issue attachment and repair task.
- **Demo:** Click a tester's snapshot; load the same quest/location state, reproduce the broken interaction and attach the observed result to the fix.
- **Closest:** Unreal [BugItGo](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/UCheatManager/BugItGo?lang=en-US), engine save-state/debug tools, existing bug-report systems.
- **Who / owner reason:** One game team; an engine cannot know its quest/inventory schema without an adapter.
- **Start / kill:** One supported game/engine and two real bugs; stop if engine tooling already captures and restores the needed state or users only need ordinary saves.
- **Scores:** **4 / 3 / 2 / 3 / 5 / 5**. Wider state restoration is not inferred from position/rotation support.

### P20 — Executable-number narrative example

**Tiny; Shipped components / Open teaching fixture. One direct analysis-report failure.**

- **Sources:** Karpathy catches prose versus execution disagreement and says “print this variable directly” [[V62:60]].
- **One sentence:** Publish a notebook example where every reported numerical claim names an executed variable, units and missing-value policy.
- **Demo:** A narrative silently converts NA into 0.1 and reports an inconsistent total; show the raw cell, explicit policy and actual runtime value side by side.
- **Closest:** Notebooks, typed data pipelines, data-quality tools, standard literate/report generation; Karpathy already demonstrates the basic fix.
- **Who / owner reason:** Educators and small research teams; domain-specific examples are a contribution, not a platform capability gap.
- **Start / kill:** One synthetic reproducible dataset modeled on the failure; stop if an existing tutorial covers both policy and output binding adequately.
- **Scores:** **3 / 3 / 1 / 3 / 5 / 5**. No new finance/forecasting advice.

### P21 — Contradictory multi-person interview fixture

**Small / Ambiguous; Open exact test / Shipped interview tools. Six interview adopters/five channels, five acknowledged lineages; no direct complaint proving demand for this residual.**

- **Sources:** Matt's parallel grilling decision state [[V23:45]]; Michael's conversational spec [[V04:28]]; Stripe's long parallel plan [[V75:11]].
- **One sentence:** Extend an existing interview workflow to retain conflicting answers, their owners and the unresolved decision before generating implementation tasks.
- **Demo:** Product says exact daily quota, engineering says approximate burst allowance; preserve both assumptions and block only the affected acceptance ticket pending a decision.
- **Closest:** [Matt's skills](https://github.com/mattpocock/skills), Wayfinder as reported, [Pstack interrogate](https://github.com/cursor/plugins/blob/main/pstack/skills/interrogate/SKILL.md), ordinary decision records.
- **Who / owner reason:** Small teams interviewing several stakeholders; owner-specific decision authority is outside a universal skill default.
- **Start / kill:** Try an existing workflow with two contradictory human inputs; stop if it already preserves and routes the conflict or teams do not find the output useful.
- **Scores:** **3 / 5 / 2 / 3 / 4 / 4**. Do not repackage grill-me as a new discovery.

### P22 — Load-bearing design exercise and runtime contract

**Tiny / Ambiguous; Open app-specific exercise / Shipped teaching/static guards. Six comprehension practitioners/six channels; one explicit design-erasing shim incident.**

- **Sources:** Armin's integration “got rid of ... the whole great design” [[V82:87]]; Ball reviews load-bearing code [[V37:14]]; Thariq quizzes the operator [[V70:10]].
- **One sentence:** Pair a repo-specific comprehension exercise with one executable runtime invariant that a plausible integration shim must preserve.
- **Demo:** Explain which component owns shared identity/state; two plugins pass individual tests but their shim violates that contract, and the focused integration case fails.
- **Closest:** [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), [Pstack teach](https://github.com/cursor/plugins/tree/main/pstack), existing contract tests. Static dependency graphs alone do not establish runtime semantics.
- **Who / owner reason:** Library/plugin maintainers; intended ownership semantics require local knowledge.
- **Start / kill:** Obtain one actual shim and have its author state the violated invariant; stop if no observable contract can be stated or normal integration tests already enforce it.
- **Scores:** **4 / 4 / 2 / 4 / 5 / 5**.

### P23 — Agent compute-bid guard adapter

**Small / Ambiguous; Open exact adapter / Shipped scheduling. One direct organization.**

- **Sources:** Jane Street agents “bid for time” and overvalue their jobs enough to preempt human work [[V08:35]], [[V08:36]].
- **One sentence:** Cap agent-originated bids/priority through the existing scheduler and report preemption decisions against a human-owned budget.
- **Demo:** An agent bids above its task budget; the existing scheduler adapter lowers/rejects it, records the requested/effective priority and leaves the human job running.
- **Closest:** Existing quota/priority/preemption schedulers and Jane Street's internal market; quota accounting tools above are adjacent, not scheduler replacements.
- **Who / owner reason:** Teams with an internal compute market; this likely belongs entirely in their existing scheduler configuration.
- **Start / kill:** Replay a recorded bad bid under ordinary quotas/priority classes; stop immediately if standard policy solves it or no team can share a real case.
- **Scores:** **4 / 2 / 1 / 3 / 5 / 5**. A memorable story is not multi-organization demand.

### P24 — Small personal workflow export/fixture collection

**Tiny; Shipped categories / Open examples. One practitioner per exact niche; do not sum unrelated niches into adoption.**

- **Sources:** Karpathy's dictionary-form Anki export and subtitle OCR [[V62:112]], [[V62:118]]; Davis retains raw audio/transcripts and microphone fallback [[V31:17]], [[V31:19]]; Matt's voice spectrogram [[V23:06]].
- **One sentence:** Publish reusable fixtures and format contracts for personal voice/language workflows rather than another general app.
- **Demo:** One Korean inflected sentence becomes an Anki row containing source sentence, dictionary form, meaning and evidence; round-trip the exact delimiter/escaping format.
- **Closest:** [FlixFluent](https://flixfluent.com/en/learn/korean-with-netflix/), Anki import, established dictation/audio and reader products. Existing tools may fully cover each example.
- **Who / owner reason:** Individual learners/creators; personal format/device preferences are reasonable local configuration.
- **Start / kill:** Release ten de-identified fixtures for one niche only; stop if ordinary settings/export do it or no independent user uses the fixtures.
- **Scores:** **3 / 3 / 1 / 2 / 4 / 5**. Audio export, vocabulary import and vocal teaching are separate tasks, not a proposed bundled product.

### P25 — Held-out human-reference study of product taste

**Ambiguous; evaluation experiment rather than a product. Theo and Amp show variant comparison; no clean independent demand count for this study.**

- **Sources:** Theo's judges prefer brighter skyboxes after costly iteration [[V01:17]]; Amp explores variants instead of deciding by prose [[V37:26]]; Davis repeatedly asks generated UI to do less [[V31:18]].
- **One sentence:** Test whether explicit held-out human comparisons improve useful UI decisions beyond the model's own repeated critique.
- **Demo:** Show three versions without author/model labels; compare the creator's held-out choice with an agent panel's ranking and expose disagreement, cost and changed requirements.
- **Closest:** Existing preference studies, visual-review tools and the demonstrated model panels; generic visual judges are taken.
- **Who / owner reason:** Researchers/builders trying to decide whether a taste benchmark is meaningful; owner-specific preferences cannot be inferred from panel consensus.
- **Start / kill:** Ten owner-defined decisions with stable acceptance questions and held-out examples; stop if preferences are unstable or no improvement over simple human choice appears.
- **Scores:** **4 / 4 / 2 / 2 / 3 / 4**. What resolves ambiguity: repeated out-of-sample agreement on decisions the owner actually cares about.

## Predictions board: what would need to exist if the claims hold

Claims are **Q**, including forecasts that conflict. Infrastructure consequences are **I**. The complete mechanically retained forward-claim inventory is Appendix B; this board groups the practice-related consequences and names existing owners. A prediction does not prove a missing product.

| Claim and source | What would have to be built/maintained | State and interpretation |
|---|---|---|
| Michael: models/harnesses absorb code structure, worktrees and loops; personal taste remains [[V04:43]], [[V04:44]]. | Model-upgrade baselines, removable instructions, durable personal preferences. | **Shipped:** existing harness features, skill-up. P04 content is plausible; broad workflow engine is occupied. |
| Geoff: delete skills after every model release [[V80:40]]. | Outcome-preserving ablation rather than assumed monotonic improvement. | **Shipped mechanism:** comparisons/evals. P04 dataset; do not delete all domain rules by default. |
| Katz: model-specific harness shims become unnecessary, new domains create new ones [[V66:16]]. | Usage/outcome telemetry and a deletion path. | **Shipped/owned:** Katz's harness and existing observability. Tiny data/report only. |
| Thariq/Factory: simpler prompts and stronger models reduce bespoke scaffolding [[V70:05]], [[V72:09]]. | Sparse context, direct feedback access, configurable harnesses. | **Shipped/being built by owners.** No generic prompt-compiler revival. |
| Jane Street: agents remain “perpetual beginners”; shared skills affect many people [[V08:67]]. | Strong onboarding, versioned conventions, known consumers and regression cases. | Internal tools already exist. P07's cross-consumer integration is an inferred narrow gap. |
| Matt: spend human time planning, let small implementations run asynchronously [[V23:48]], [[V23:68]]. | Persistent decisions, acceptance tasks and an actual completion predicate. | Skills/tickets/Wayfinder already authored; P21 only if multi-owner conflict is missing. |
| Stripe: plans coordinate ten boxes over days [[V75:11]]; Amp: planning artifacts may change almost completely [[V38:51]]. | Both explicit dependency plans and systems able to revise them as execution reveals facts. | Competing practice forecasts, not evidence planning vanishes. Generic orchestration occupied. |
| Cherny/Sumner: verification bottleneck shifts toward deciding what to merge; PRs become suggestions [[V71:25]]. | Cheap rejection, good evidence and scoped human ownership. | Review factories already owned; P09 adapter/content rather than another PR bot. |
| Orosz/Theo/Mattis: line-by-line code reading may recede [[V21:13]], [[V88:00]], [[V22:74]]. Armin/Lattner push back for code that matters [[V82:83]], [[V24:65]]. | Independent acceptance obligations and explicit risk/ownership boundaries; better human understanding for important changes. | Disagreement retained. No universal autonomous-merge conclusion. P01/P22 are small examples. |
| Ben Davis: orchestration/computer-use capability will be widespread within months [[V31:16]]. | Persistent workflow knowledge, real device integration and receiving-side acceptance. | **Shipped:** simulation/eval frameworks and native tools. P08/P16 are fixtures, not a future agent OS. |
| Armin/Pi/Exo: harnesses/software can edit their own extensions and workflows [[V63:05]], [[V52:12]], [[V82:84]]. | Inspectable logs, bounded history, concrete extension contracts and recovery. | **Shipped/being built by named owners.** Generic self-extension is killed. P22 only at a specific semantic boundary. |
| Ben/Geoff: tool names stop describing effects when models synthesize arbitrary programs [[V80:63]]. | Actual operation/effect visibility below named tools. | Existing trace/Code Mode tools partly serve this. Important adjacent research, not a new broad trace platform in S06. |
| Theo: inference gets cheap while compute/verification stays constrained [[V01:36]], [[V88:43]]. | Queue/setup/build/test measurements and resource admission policy. | Providers/schedulers already exist. An exact diagnostic recipe is smaller than another VM service. |
| Mario/Michelle/Armin: subsidy/quota economics can hide true cost [[V05:46]], [[V12:80]], [[V80:83]]. | Transparent assumptions, cost and useful-outcome accounting. | ccusage/token-burn and provider billing already serve broad accounting. Do not infer future prices. |
| Shopify: broad token access changes ambition, with circuit breakers [[V74:10]]. | Runaway detection and human-owned resource ceilings. | Already practiced internally. Quota/cost examples, not a generic inference router. |
| Qu/Every/Uday: accumulated work becomes skills/context [[V68:08]], [[V73:29]], [[V19:35]]. | Capture, curation, evaluation and maintenance when underlying definitions change. | Capture/learning already owned. P17 assumption gate is inference, not an explicit roadmap promise. |
| Amp: more operations/support can be delegated, team boundaries constrain it [[V35:56]], [[V38:03]], [[V37:27]]. | Callable real APIs, scoped authority, observed readback and human decisions where needed. | Existing operational tools. P11 only a customer-specific completion predicate. |
| Max/Adam/Cloudflare Ryan: cheap generated software makes more disposable/internal tools sensible [[V79:04]], [[V55:36]], [[C02:22]]. | Low-cost acceptance and explicit disposal/owner policy. | Existing factories and software products; P06/P24 are small content/integration candidates. |
| Titus/Will/Uday: software value and feature outcomes outrun PR-count productivity measures [[V17:66]], [[V18:69]], [[V19:84]]. | Feature/outcome lineage, denominators and later consequences, not just generated code metrics. | Many existing analytics systems; no causal productivity score claimed here. |
| Armin: five-year maintenance cost is not yet known; Nix may become easier via agents [[V82:56]], [[V82:94]]. | Longitudinal maintenance data and reproducible recovery cases. | Nix is shipped. Honest future follow-up beats a premature maintenance platform. |
| Karpathy: improved assistants become routine readers/tutors/voice/camera interfaces [[V62:64]], [[V62:84]], [[V62:122]]. | Grounded personal content, export, OCR alignment and device integration. | Much has shipped since the older recording. P24 examples only; old feature gaps are not current absence claims. |
| Theo: personally replacing everyday infrastructure becomes feasible, but broad compatibility is costly [[V01:34]], [[V01:36]], [[V88:31]]. | Workload-specific conformance cases and explicit unsupported behavior. | Generic compiler/Wasm ports and agent substrates are killed/owned categories. Contribute exact fixtures instead. |
| Connect/TELUS/VSCO: agent systems reach many users and more business actions [[C12:02]], [[C08:16]]. | Exact metering where required, prerequisites, authority, capability/plan distinctions and real application readback. | Already implemented lessons; application fixtures, not another agent platform. |
| Runway: richer real-time creative/world workflows [[C07:22]]. | Stable reference assets, reproducible creative state and application-specific quality feedback. | **Being built/Roadmap** by Runway as reported. A niche workflow adapter is possible; no broad world-agent pitch. |

**I — GrowOS test:** There is no well-supported broad “nobody is building it” seed here. The missing parts most supported by independent evidence are mundane integration boundaries: what got loaded, what actually ran, what machine it ran on, what changed over time, and whether the next person can use the output. They can survive better models because those facts are external to model capability. They also have obvious existing owners, so small upstream work is the default route.

