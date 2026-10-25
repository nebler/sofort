# Sofort demo research: participation, distribution, and the cost of inviting the internet

Research date: **2026-10-25**. Angle: virality mechanics and interactive/participatory demos. Research and proposals only; no deployment, posting, outreach, commits, or changes to existing files. Build estimates assume one engineer familiar with the project and exclude waiting for external review, platform approval, or hardware access.

## Recommendation

**Launch a useful agent workflow with a visible disposable-computer lifecycle. Follow it with “one click, one computer”: a public, bounded toy where participants receive a verifiable execution receipt and contribute to a shared counter/mural. Save “escape the VM” for a separately prepared security event.**

Participation should give people something of their own to show: a result, a tiny program, a surprising failure, or a contribution to a shared object. “We spawned 100,000 VMs” is weak on its own. “Your program ran on computer #100,000; here is its result, image hash, and retirement receipt” makes the infrastructure tangible.

The best first hook is **“Every click gets a new computer.”** The technically stronger supporting sentence is **“A fresh single-use microVM for each agent-written program; its only external interface is the host's granted tools.”** Neither requires claiming that a kernel is synthesized during the click.

Do not make an always-on X reply bot the launch dependency. Current X rules and API prices make the web-to-share loop materially easier and cheaper. Do not expose today's local unauthenticated MCP HTTP server directly to the internet.

## 1. Evidence, limits, and the non-negotiable project facts

Mandatory reading completed: [01-value-audit](01-value-audit.md), [02-hosting-landscape](02-hosting-landscape.md), [03-agentic-coding](03-agentic-coding.md), [04-scale-and-economics](04-scale-and-economics.md), and [05-twitter-pitch](05-twitter-pitch.md). I also inspected the current [MCP README](../../jitk/mcp/README.md), [MCP configuration/runner](../../jitk/mcp/jitk.mjs), [executor](../../jitk/executor/executor.ts), [pool](../../jitk/executor/pool.ts), [policy README](../../jitk/executor/policy/README.md), and [VMM confinement README](../../jitk/vmm/sandbox/README.md). Existing executor changes were already present in this shared checkout; these observations are not a release audit or fresh benchmark.

Keep these boundaries visible in every demo:

- **0.29 ms is the raw parked one-tool path**, from RUN to validated completion in a prepared, single-use VM. It is not a cold boot, MCP request, public web request, or total computer lifetime.
- **Warm local MCP is approximately 2.1 ms p50** in its separate measured harness. **Cold executor is approximately 9–10 ms**, with the executor process already running. Internet RTT, queueing, model generation, image building, and retirement are different intervals.
- The kernel has **24 syscall slots**, including aliases and explicit ENOSYS behavior. This is not 24 complete Linux syscall implementations or arbitrary Linux compatibility. QuickJS is JavaScript, not Node/npm.
- Growth is **offline**. The currently demonstrated loop includes bounded poll behavior and two ENOSYS fallback stubs. Lua already ran with missing-slot defaults. Do not narrate signal-stub regrowth as “AI implemented signals and made Lua work.” Label LIVE versus REPLAY and compressed elapsed time.
- Snapshots, per-request general computer assembly, broad binary support, and Linux bare-metal price/performance remain unproved/planned. A prepared pool is not snapshot restore.
- A small guest kernel is not the entire TCB. Host tools, protocol handling, executor, VMM/libkrun, confinement, hypervisor, and host OS matter. A fresh VM does not make an authorized dangerous host tool safe.

**Research standard:** the examples below are a purposive sample, with survivorship and existing-audience bias. Launch articles establish what shipped; they do not establish X reach. Author archives and social trackers are labeled rather than treated as independently audited analytics. No causal claim about the X ranking algorithm, optimal hook length, or video uplift is supported by this sample. Some original X pages returned access errors, including a 403 for Zed. I did not invent missing reply/quote graphs.

## 2. What relevant 2025–2026 demos actually teach

### Playable artifacts and agent spectacle

**Pieter Levels' browser flight simulator, February 2025.** His own retrospective dates the build to February 22, links the original X post, and displays approximately **1.58M views**. It describes building publicly and a game that loads quickly enough to play immediately. Those metrics are author-published snapshots; the much larger saga-wide reach anecdote is not a verified aggregate. The lesson is an immediately understandable object, a playable destination, and a series of visible additions. His existing audience is a major confounder. Do not borrow the “$1M ARR” framing as evidence of durable recurring revenue or a repeatable launch formula. [Author's account and original-post link](https://levels.io/fly-pieter-com-vibecoded-flight-simulator).

**Windows XP inside a tweet, October 13, 2026.** The same author's archive displays approximately **1.25M X views**, with a direct invitation to tap and interact and an explicit pointer-lock limitation. This is an unusually close example: a familiar computer in an unexpected place, a short invitation, and an action readers can take themselves. It supports trying an absurdly tangible computer interaction; it does not establish that Sofort can embed arbitrary interactive applications inside X. The artifact is emulation, not evidence about hardware VM startup. [Author archive](https://levels.io/windows-xp-inside-a-tweet).

**Manus/Browser Use, March 2025.** TechCrunch reported that an X post about Manus using Browser Use reached **2.4M views**. [Reporting](https://techcrunch.com/2025/03/12/browser-use-one-of-the-tools-powering-manus-is-also-going-viral/). Editorial inference: the visible agent outcome can distribute the underlying infrastructure. Sofort should show the work first, then reveal the little computer enabling it. Avoid promising autonomous general work from a narrow runtime.

**Claude Plays Pokémon, February–March 2025.** A March 4 interview with its creator documents the live stream and agent architecture. A recognizable game gives viewers an intuitive progress meter and recurring moments, including mistakes. This is useful evidence for a spectator format; I did not recover an attributable X reach figure. A live shared display becomes participatory only when viewers can affect something. Sofort's audience should submit a program or choose a constrained task, rather than only watch the author's agent. [Creator interview and stream link](https://www.latent.space/p/how-claude-plays-pokemon-was-made).

### Shared toys and challenges

**Nolen Royalty's Global Caps Lock, February 5, 2025, and One Million Chessboards, June 2025.** The former makes a single global switch into a joke; the latter makes a giant shared board into a place people can act. The chess post explains state distribution, batching, rollback, bandwidth, and server costs. These are primary evidence of the mechanics and operating tradeoffs, not verified X impression totals. Sofort can copy the shared-object simplicity and publish the engineering afterward. A cumulative counter needs a personal action and visible consequence; otherwise it is a dashboard. [Global Caps Lock](https://eieio.games/blog/the-global-capslock-key/), [One Million Chessboards implementation](https://eieio.games/blog/a-million-realtime-chess-boards-in-a-single-process/).

**Anthropic's Constitutional Classifiers public challenge, February 2025.** The published follow-up reports **13,960 users and more than 800,000 chats** overall; its more experienced subset was 339 jailbreakers with more than 300,000 interactions. It also reports a successful universal jailbreak. This is unusually useful participation evidence: a concrete objective, levels, rewards, and a follow-up acknowledging the break. These are company-reported challenge figures, not X views. A model jailbreak is also a different security boundary from a native-code or VM escape. Copy the bounded objective and disclosure discipline, not a claim that “nobody broke it” certifies safety. [Challenge, rewards, and results](https://www.anthropic.com/research/constitutional-classifiers).

**Gandalf Agent Breaker, documented by participants in April 2026.** Firsthand write-ups describe scored agent-tool challenges and increasing difficulty; the current official game URL resolves to Lakera's play site. This supports the score → retry → write-up loop. The launch date and audience size were not independently established from the current primary page, so this report does not use them as viral evidence. [Participant write-up](https://bytebreach.com/writeups/gandalf-agent-breaker/), [official game](https://play.lakera.ai/agent-breaker).

### Infrastructure launch packaging

**Cloudflare Code Mode, September 26, 2025, and February 20, 2026.** The first launch names a change in behavior; the later launch makes API breadth legible through the “1,000 tokens” headline. A March 24 Dynamic Workers launch couples its speed proposition to a starter and playground. These are primary launch examples, not independently measured X viral successes. The transferable device is a precise before/after plus something runnable. Sofort should use its own workload and timing boundaries rather than adopt Cloudflare's percentage claims. [Original Code Mode](https://blog.cloudflare.com/code-mode/), [API-in-1,000-tokens launch](https://blog.cloudflare.com/code-mode-mcp/), [Dynamic Workers launch and playground](https://developers.cloudflare.com/changelog/post/2026-03-24-dynamic-workers-open-beta/).

**Bun 1.2, January 22, 2025.** The release combines a video, familiar code, a sharply scoped Express performance claim, compatibility evidence, and immediate installation. The post establishes packaging, not X reach. Copy the short path from claim to executable example and the specificity of the benchmark. An impressive number without that path is weaker. [Primary release](https://bun.sh/blog/bun-v1.2).

**Vercel's v0.app, August 11, 2025.** It sells a small input becoming a complete artifact and invites users to create their own. The output gives users material for their own posts. That is the useful participation pattern for Sofort: task → code + result + execution receipt. The primary announcement supplies no comparable X reach figure. Do not imply that jitk supplies v0's full app-building environment. [Primary announcement](https://vercel.com/blog/v0-app).

**Zed 1.0, April 29, 2026.** A third-party video archive records a **2:12** launch film and **479,045 X views as of September 14**; the primary release confirms the milestone. This is a counterexample to “a demo must be under 30 seconds.” Brand recognition can let a very short slogan introduce a longer film. Sofort needs a clearer explanation because the name and object are unfamiliar. The tracker is a secondary snapshot, not current native analytics. [Video record](https://whatships.com/videos/zed-1-0/), [primary release](https://zed.dev/blog/zed-1-0), [original X post, access blocked during research](https://x.com/zeddotdev/status/2049548043012177963).

## 3. Mechanisms to use, and what not to infer

**Hook:** aim for one concrete sentence of roughly 6–12 words as an editorial constraint, not an algorithm rule. “Every click gets a new computer” is seven. Explain the agent/tool use in the next sentence. Show the first successful result within about three seconds of the video. The viewer should understand the action before meeting libkrun, QuickJS, HVF, or ENOSYS.

**Media:** use a captioned native MP4, about 35–50 seconds, for the main reveal. It can show causality: submit → tool activity → result → VM retirement. A 6–10-second silent loop is useful for a teaser; export it as video so text remains readable. A still is best for a receipt or precise timing boundary. A GIF alone is poor evidence for clocks, preparation state, and teardown. No controlled comparison here establishes which format gets more reach.

**Numbers:** use one surprising, correctly scoped number in the root package. The public toy should show a measured run, not paste 0.29 ms on every card. Put platform, path, warm state, and image hash next to it. Cumulative completed runs and independently reproduced results are more meaningful than fake “active VM” animations.

**Quote-post incentive:** give someone a result they can explain, dispute, or improve: “my 12-line program,” “my capability denial,” “my counterexample.” A result card should carry the participant's artifact and the reproduction link. Do not ask for quote tweets or make reposting a condition of access. Identity and curiosity are stronger reasons to share than promoting the author's launch.

**Controversy:** invite a bounded falsifiable challenge: “Find a capability this code can use without a grant.” Avoid “Linux is obsolete,” “unhackable,” “0.29-ms cold boot,” or “AI wrote a secure OS in a weekend.” Those invite corrections that overwhelm the real work. An origin-story time claim belongs only if actual development history supports it; no evidence here supports a weekend claim for Sofort.

**Participation loop:** view demo → run with one click → receive personal result → optionally share → another reader remixes. Minimize required account setup for the preset mode. Put quotas before submit. Do not require OAuth, a tweet, a follow, or a waitlist to discover what the thing does.

**Failure can be content:** unsupported JS, a timeout, or a real accepted security report can yield an interesting follow-up. A broken page, invisible queue, fabricated counter, or dismissive response to a legitimate break yields distrust. Define which failures are normal and expose them honestly.

## 4. Four participatory concepts

Ratings below are comparative editorial judgments, **not probabilities or impression forecasts**. Five means the highest relative potential in this set. Cost assumptions are detailed in §6.

### A. “One click, one computer”: the disposable-computer mural — recommended first

**Hook:** “Every click gets a new computer. Leave one pixel behind.”

**Mechanics:** visitors choose a seed/color or one of three small programs. A fresh VM computes a bounded result; the trusted service validates it and contributes one tile to a shared mural. Show their code, output, unique execution ID, image hash, and explicit completed/reaped states. Let people download a receipt card or share its URL. The host keeps the mural; guest state dies. A host-assigned tile and a fixed palette prevent arbitrary text/images on the public canvas.

The first public version runs **server-selected, audited programs with bounded numeric input**. Arbitrary editor submissions remain disabled until the hostile-code gate in §5 passes. A “remix locally” link can ship alongside the preset version. Later, enable short JS submissions in the same UI, with the exact same narrow grant set.

Make the communal objective “fill this canvas together,” not “waste a million computers.” Count submitted, completed, failed, and reaped separately. One million historical executions does not imply one million simultaneous machines. Do not count retries, bots, idle-pool expiry, or internal health checks as visitor contributions. If the UI stretches a millisecond lifecycle for visibility, label that animation; retain actual timestamps in the receipt.

**Hardening and abuse:** all public execution gates apply. No guest network; no fetch/shell/package tool; no user URLs; no host secrets. The mural-append capability is restricted to one assigned cell and one valid value. Rate-limit executions and subscriptions independently. Batch public updates; do not broadcast every receipt to every visitor. Keep the editor and receipt renderer from interpreting arbitrary HTML/SVG. A server-authoritative counter prevents visitors from inventing runs, although the service's signature is not independent hardware attestation.

**Cost:** illustrative **$58–98 per 1M runs over one day**, using one assumed $2/hour runner and $10–50 web/log allowance. This is a budget scenario, not observed COGS or a throughput promise. A million page visitors or high live fan-out can add much more bandwidth than a million runs. There are no model or X API charges in the base path.

**Effort:** **16–24 hours** for a preset web demo and receipt loop, plus **24–48 shared hardening hours** if the public gateway/host is not already prepared: roughly **40–72 hours total**. Enabling arbitrary JS adds **12–24 hours** of product/adversarial work after the gate, not an assurance guarantee.

**Virality:** **4/5 general reach, 3/5 qualified agent interest**. Low participation friction; clear communal artifact; easy screenshots. Its main weakness is that any execution runtime could make a mural. The main video and receipt must show why this one is a hardware VM and how it relates to agent tool code.

**Failure modes:** “You built an expensive counter”; empty canvas; bot-filled canvas; mobile illegibility; counter running while requests fail; millions of animated boxes mistaken for a measured fleet. Mitigate with an immediately satisfying individual result, explicit real-event semantics, and a downloadable tiny reproduction. Do not claim it proves need for the kernel.

### B. “Steal the host flag”: a scoped break-the-boundary event — later, not launch day

**Hook:** “Your code gets a computer. Can it reach the host?”

**Mechanics:** a timed challenge with separately named outcomes: (1) unauthorized broker capability, (2) another run's synthetic canary, (3) a host-only random marker outside the guest/image and outside the VMM's allowed files. Distinguish these in adjudication. Crashing QuickJS or timing out is neither a VM escape nor automatically a bounty. A printed guessed flag is not proof; use unpredictable per-event markers and server-side validation.

Public JS submissions exercise only the reachable JS/runtime/broker path. **They do not constitute a full malicious-guest/VMM audit.** Experienced invitees can use a local harness with a controlled hostile guest image on separate sacrificial infrastructure. Do not add arbitrary ELF/kernel uploads to the public web endpoint just to make the challenge sound comprehensive.

Run for 72 hours with a published target revision, attack scope, duplicate handling, private reporting route, operator availability, and a fixed prospective reward pool. A **$5,000 total reserve** is a planning assumption, not a bounty announcement or promise made here. Approve the actual program and reporting terms before advertising it. Anthropic's May 2025 invite-only program explicitly limited participation to provide timely feedback—a useful operational precedent. [Primary program description](https://www.anthropic.com/news/testing-our-safety-defenses-with-a-new-bug-bounty-program).

**Hardening and abuse:** use separate sacrificial hosts/accounts with no production data, cloud instance identity, SSH agent, Docker socket, laptop home directory, or reusable privileged credentials. Network denial must survive a runner compromise: enforce it upstream, not only in guest configuration or a local firewall. Restrict runner-to-control traffic and treat all returned bytes as malicious. Do not place the adjudicator's winning secret in an allowed tool response or logs. Prepare host destruction/reimage and artifact preservation. Never colocate a compromised target with other tenants. Independent review of the final libkrun/confinement path precedes a broad invitation; finite tests are insufficient.

**Cost:** a hypothetical 72-hour event with **two $2/hour runners is $288 fixed compute**, plus $30–100 web/log allowance, giving **$318–388 for a 1M-attempt event** if a measured aggregate admission rate of at least 3.86 attempts/s is sustained. That rate is a requirement, not an existing result. Add the proposed **$5,000 reserve** and substantial human triage. Long attacker workloads, forensic retention, or host replacement can raise costs. Do not offer an unbounded bounty or unlimited attempts.

**Effort:** **80–140 engineer-hours total**, including the shared public gate, isolated deployment, adjudication, challenge fixtures, abuse controls, and an incident drill. External review and remediation have no reliable hour ceiling; the estimate cannot promise readiness on a particular date.

**Virality:** **5/5 potential within security/systems X, 2/5 broad accessibility**. Adversarial competition supplies status and follow-up material. The downside is largest: the result may be an actual compromise, public exploit race, or evidence that the advertised challenge never tested the real boundary.

**Failure modes:** getting pwned on day one; arbitrary native guests reaching a VMM bug; a broker/website bug marketed as a hypervisor escape; disputes over exclusions; no submissions; refusal to pay; “nobody escaped” falsely advertised as an audit. The correct success condition is useful valid findings handled well, not a clean leaderboard. A valid report should stop the affected path, preserve evidence, and receive acknowledgment; publication follows remediation and the agreed process.

### C. “Give it a task; choose its tools”: a constrained agent workbench — best qualified participation

**Hook:** “Give an agent a task. Decide what its computer can touch.”

**Mechanics:** offer a synthetic shop/issue-tracker world with a few read-only tools. Visitors ask for a useful join/filter/fan-out task and explicitly choose grants. The model emits JS; the host executes it in a fresh VM and returns a compact result alongside the code, tool transcript, grant list, and pinned image. One task can involve several executions; count them separately. A shareable receipt allows another visitor to change a condition and try again.

An effective example is “find items from three suppliers that meet this budget and delivery constraint,” using declared synthetic fixtures. The demonstration shows overlapping calls and a denied attempt to invoke an ungranted function. Call this **configuring a task's capabilities on a prebuilt computer**, not “the agent writes a new kernel for your reply.” Unsupported tasks return a clear limit or join an offline workload-request queue. No live kernel compilation/promotion occurs in the public request path.

**Hardening and abuse:** treat the model's text and code as untrusted; grant selection is authoritative host state, never a model-generated permission. Only fixed provider modules can load; no visitor-chosen MCP endpoints, filesystem paths, callback code, URLs, package names, or external credentials. Use fixture-only data and enforced call/result budgets. Cap model tokens, retries, task wall time, and daily spend independently of VM limits. An injection can produce bad code; it must not widen the grants or reach a build shell. Human review precedes any public gallery inclusion.

**Cost:** with an explicit **assumed $0.01–0.10 total model budget per task**, 1M tasks imply **$10,000–100,000 model spend**, not cents. At 1–5 VM runs/task, the one-day infrastructure scenario might require 1–5 runner allocations, or **$58–290 including one shared $10–50 web allowance**, before heavier tool-wait/capacity effects. The per-1M-VM-run equivalent of model spend is approximately **$2,000–100,000**, depending on tasks per run and actual generation cost. These are budget sensitivities, not vendor token-price quotes or measured task costs. Start with 100–500 generated tasks/day; preset/no-model replays can remain available when the generation budget is exhausted.

**Effort:** **56–96 hours total**, including the shared public gate, fixture tools, task UI, generation budget, result verifier, and receipt view. A manually curated “submit a task; I demonstrate three tomorrow” version can take **8–16 hours** and avoids public generation infrastructure.

**Virality:** **4/5 developer sharing, 5/5 qualified agent-builder interest**. People can see their own task working and understand the authority boundary. Lower immediate spectacle than a million blinking computers; much stronger path to useful workload submissions.

**Failure modes:** the agent solves the wrong task; everyone requests npm/browser/Python workflows; model latency overwhelms the millisecond reveal; a synthetic fixture feels staged; model costs dwarf runtime costs; the UI implies generated code is correct because it ran in a VM. Show a fixture label, independent result checks, failures, and separate model versus execution timing. Safety of execution and correctness of the answer are separate questions.

### D. “Reply with JS”: an opt-in execution receipt bot — optional distribution adapter

**Hook:** “Reply with a tiny JS program. I'll show its computer's receipt.”

**Mechanics:** users explicitly submit to a dedicated command/mention or the announced launch thread. The bot runs only bounded JS against credential-free fixture tools and returns one sanitized result per interaction. Deduplicate by post ID; do not execute an edited post twice automatically. Prefer web submissions first and an optional human-triggered share. Start with manual selection of a few interesting programs, not an unsolicited reply-guy that searches keywords and inserts itself into discussions.

**Platform gate:** X currently prohibits unsolicited automated replies based on keyword searches, requires clear opt-in, an opt-out, and one automated reply per interaction. Its rules also require **prior written explicit approval for AI reply bots**, and address approval for brand auto-response campaigns. Do not assume a templated execution wrapper avoids classification. Establish the applicable approval before launching automation; human-operated replies and web receipts are the immediate fallback. [X automation rules](https://help.x.com/en/rules-and-policies/x-automation).

**Hardening and abuse:** every arbitrary-JS gate applies. Keep the X token in a separate publisher service unreachable from runners; never offer a `post` tool to guest code. Do not fetch linked source files, interpolate submissions into a shell, auto-mention output handles, or render output HTML. Public output needs length limits and abuse handling: someone will submit slurs, private-looking data, malicious links, and fake host-compromise messages. Keep original participant input separate from official claims. A receipt should link to host-recorded status rather than assert that the guest's printed string is true.

**Cost:** standard current rate-card arithmetic is brutal: 1M post reads at $0.005 plus 1M ordinary creates at $0.015 gives **$20,000/M interactions**; URL-bearing creates at $0.20 make it **$205,000/M**. A qualifying summoned-create rate is $0.010, and qualifying owned reads can be cheaper; do not assume eligibility or combine discounted meters without checking the selected endpoints. Media, extra reads, model generation, and infrastructure are additional. These are tariff examples, not a million-interaction permission or capacity guarantee. [Official X pricing](https://docs.x.com/x-api/getting-started/pricing).

**Effort:** **24–40 incremental hours after an approved web executor exists**, roughly **64–112 hours total** when added to A's public foundation; external approval wait is excluded. A manual curated reply session takes **4–8 hours** of tooling plus active moderation time. Proposed pilot caps: 100 replies/day, a separate $25/day API cutoff, and no automatic top-up; keep execution and publishing budgets distinct.

**Virality:** **4/5 potential if people submit clever snippets, 2/5 as a launch dependency**. Native thread participation is attractive, but approvals, quotas, reputation, output moderation, and paid writes make it a poor primary product. The website should continue to work when the bot is stopped.

**Failure modes:** account/app suspension; a URL reply bill surprise; spam complaints; public output abuse; copy-paste JS damaged by smart quotes; a false “computer lived 9 ms” claim on thousands of replies. State supported syntax and return stable errors. Say “run completed in X ms; teardown confirmed” only when those are measured; never manufacture a fixed lifetime slogan.

## 5. What must be hardened before public execution

These are prerequisites for the proposed exposure, **not assertions that the current tree lacks every listed mechanism**. The repo already has confinement, a native watchdog, protocol budgets, policy, and bounded pooling. The unresolved job is validating the final artifact and adding a public service around a local component.

1. **Pin and reconcile the artifact.** Bind kernel/runtime/VMM/executor hashes and patched libkrun version to a current status sheet. Re-run the relevant hostile matrix on the actual chosen host. Mac results and nested Linux functionality are not a Linux bare-metal security/performance report. Disable a public arbitrary-code mode if that host cannot be validated; a recorded/local demo can still launch.
2. **Use a dedicated compatible runner.** The current guest is restricted AArch64 static ELF; do not assume an arbitrary x86 cloud instance or serverless function can run it. Use an independently prepared Apple Silicon HVF machine or validated ARM64 KVM host. Never use the developer's logged-in laptop as the public target. Preserve confinement acknowledgments and fail closed when host requirements are unavailable.
3. **Keep the local MCP server local.** Its HTTP transport is loopback-only and has no authentication; a reverse proxy alone does not supply tenant authorization, quotas, or isolation. Use a purpose-built HTTPS admission gateway with short-lived scoped job tokens, strict origins/CSRF controls where cookies are involved, bounded body/read time, and no arbitrary provider/resource configuration. The gateway must not forward client identity/grants from unsigned guest fields.
4. **Deny egress at both boundaries.** No guest NIC/disk device does not mean the executor cannot make requests. Remove network-capable tools for A/B/D; block runner internet, private ranges, cloud metadata, and unintended IPv6/DNS paths outside the runner as well. For any future fetch tool, use a broker with explicit destination policy, redirect and DNS-rebinding checks, response/time/byte limits, and no general URL-to-private-network bridge. It is simpler to omit fetch for the launch.
5. **Enforce budgets before allocation.** Proposed starting limits, to verify rather than merely document: 8 KiB source, 16 KiB aggregate result/log output, 16 MiB QuickJS heap, 16 tool calls, 4 outstanding calls, 250 ms execution deadline for no-network snippets, 8 charged live/creating/reaping slots, 128 queued jobs, and 20 accepted runs/s globally only after a soak test demonstrates headroom. Return 429/503 when full. Queue expiry and refill must be bounded; capacity stays charged until reap. For longer fixture tools, use a separate class, e.g. 2 seconds and lower admission/concurrency, rather than silently relaxing every run.
6. **Rate-limit humans and machines fairly.** For arbitrary JS start around 5 runs/minute and 30/hour per session/account, with IP/network limits as an additional signal. Permit a small unauthenticated preset budget, then challenge or authenticate. IP-only limits punish shared networks and are trivial to evade with botnets. A global spend/concurrency cap is the ultimate backstop; do not make “free forever” an availability promise.
7. **Bound the host, not only the VM.** Current MCP defaults include a 10-second timeout; those defaults are unsuitable as the only public abuse budget. A guest can cause protocol parsing, schema validation, tool output construction, or synchronous host callback work. Host callbacks need enforceable execution/byte limits and a separately killable worker/process where needed. Killing the guest cannot interrupt blocked Node code or undo a remote mutation. Launch fixtures should have no irreversible side effects.
8. **Test protocol and lifecycle attacks.** Exercise malformed/oversize/partial frames; Unicode/control characters; nested JSON; duplicate/out-of-order IDs; unknown namespaces/prototype names; call storms; giant tool returns; endless loops; heap pressure; disconnect/cancel; and done-before-pending-tool-completion. Confirm no late result or callback updates another run, no token leak, and no orphan/refill storm after load or client cancellation. Test with both trusted JS and hostile guest/device cases appropriate to the exposure.
9. **Isolate control, credentials, and development.** No public per-request compiler or kernel growth. Fixed immutable images, allowlisted providers, synthetic read-only data, and no shared KV namespace that lets visitors read each other's values. Separate publishing credentials, control-plane access, and reward adjudication from the runner. No production secrets in environment variables, images, crash dumps, or debug logging.
10. **Treat UI/receipts as another attack surface.** Escape source/output, reject active HTML/SVG/URLs in public cards, cap websocket clients/fan-out, use a trusted renderer, and limit stored artifacts. Share source only with explicit participant opt-in; do not silently publish private submissions. Sign canonical receipt fields host-side, with a receipt service separate from execution. Such a signature authenticates the service's record, not a proof against a compromised service or hypervisor.
11. **Separate clocks and states.** Record admitted, acquired, RUN sent, result received, resolved, and reaped with the appropriate host monotonic clock; include boot time if available. Guest time and `console.log` cannot attest to lifecycle. A parked VM can have existed for seconds before dispatch. If birth-to-reap was not recorded, do not display “this computer lived X ms.” Do not subtract unrelated historical medians or cross-host unsynchronized timestamps.
12. **Prepare the stop button and response.** Track timeout/reap failures, host health, queue depth, launch failures, parser errors, and spend outside the runner. An unreaped guest beyond a defined grace period removes its host from service; a suspected escape stops that target and triggers evidence preservation/reimage. Budget exhaustion should leave a clear read-only explanation and existing receipts, not a fake live counter. Agree who can stop the event and who handles reports before opening it.

For A's preset-only launch, many hostile-source paths are closed by the fixed program choice, but the gateway, parser, host, output, resource limits, and load handling still need validation. For B, assume the runner will be compromised and design the blast radius accordingly. No test checklist turns this prototype into a security certification.

## 6. Cost model: tiny runtime CPU is not the launch bill

All dollar amounts below are **planning arithmetic**, not measurements of this deployment. The cost-per-million denominator is completed visitor runs unless a row explicitly says tasks or attempts. Count failed and abandoned attempts in actual operating cost, even when they do not increment a public completion counter.

The mandatory economics note models roughly 4.8 CPU-ms from a Mac result; its AWS reference yields roughly $0.048/M in ideal CPU capacity allocation. That is not a Linux result or all-in service cost. It excludes actual guest work, executor/watchdog CPU, pool churn, idle hosts, memory, network, tools, logs, and humans. See [04's full assumptions](04-scale-and-economics.md). The launch must not quote “five cents per million computers.”

For demo budgeting, use an intentionally explicit **assumed $2/runner-hour** with memory bundled, **not a verified offer**. Assume one runner can sustain the proposed workload at **20 completed runs/s**, subject to validation on the actual supported hardware. A million runs at that rate take **13.9 hours**; spreading them over a day costs $48 for one reserved runner even though tiny-run CPU allocation is far smaller. One million per day averages 11.6 runs/s. An arrival burst of 1,000/s still queues or rejects; the daily average does not solve it.

| Scenario | Modeled charge | What changes the answer |
| --- | ---: | --- |
| A: one runner reserved for 24h | $48 + $10–50 web/log allowance = **$58–98/M runs** if 1M finish | Lower volume leaves the same reserved bill; UI viewers and streaming fan-out are separate load |
| A: 100K runs in the same reserved day | Still $58–98 total; **$580–980/M equivalent** | Utilization, not VM CPU, dominates |
| B: two runners for 72h | **$318–388** for a 1M-attempt event, before reward/triage | Minimum aggregate 3.86 attempts/s; hostile timeouts, reimages, and review can dominate |
| C: 1M generated tasks | **$10K–100K model budget** + illustrative $58–290 infrastructure | Assumes $0.01–0.10/task, 1–5 runs/task; long waits may need more capacity |
| D: 1M ordinary read/reply interactions | **$20K X API**, or **$205K with URL-bearing creates**, before compute | Meter eligibility, extra reads, media, endpoint limits, and approval |

The $10–50 allowance is an assigned budget placeholder, not a vendor quote. Budget egress separately: **50 KiB output × 1M is about 47.7 GiB**; **200 KiB cards × 1M is about 190.7 GiB**. Page assets and spectators add more. Do not turn a per-run result into a global firehose; publish aggregate counters in batches and let clients fetch selected receipts. Keep raw logs short, redact them, sample routine successes, and retain security failures under a separate controlled policy.

Historical **10.7 MiB process footprint** is neither current total memory nor a validated capacity limit. Eight such processes multiply to roughly 86 MiB only for that old proxy; guest reservation, VMM/host allocations, Node, callbacks, queue buffers, and image caches remain. Do not size the public host from that multiplication. Long host-tool waits also pin resources; snapshots/thread-free waiting must not be silently assumed.

Set explicit event budgets instead of relying on the per-million figure: one runner-day initially; at most 100–500 model-generated tasks/day; a separate hard X publishing allowance; and a reward reserve only for an approved event. Reserved-host minimums and model/API spend are more likely launch costs than the tiny VM's marginal CPU.

## 7. Critic's comparison with the other likely demo styles

| Style | What earns the first share | What it proves when done honestly | Main weakness | Best role |
| --- | --- | --- | --- | --- |
| Pure spectacle: VM rain, million-box display, familiar game | Scale, motion, an absurd familiar object | A specific workload/lifecycle if real events drive it | A generic animation can fake the same effect; unsupported game/runtime choices are expensive distractions | First 3 seconds or teaser |
| Practical agent workflow | A useful task, visible parallel tools, compact answer | Real integration and grant-scoped execution | Looks like many existing agent demos unless lifecycle/boundary is visible | Main launch backbone |
| Kernel grows itself | Missing behavior becomes code and passing tests | The stated offline proposal/test/manifest workflow | Currently limited examples; replay and signal stubs can be misrepresented; long live generation | Technical reveal and deep follow-up |
| A: communal toy + receipt | “My click/program made this” | Fresh runs, observable retirement, shareable outputs | Weak evidence that this runtime is necessary | First public follow-up |
| B: scoped escape event | A challenge, researcher status, possible bounty | Findings within a stated attack scope | Highest operational/security downside; lack of escape proves little | Later security research event |
| C: user task + explicit tools | “It solved my example with these permissions” | Workload fit, grants, useful execution | Model latency/cost and task accuracy can obscure the runtime | Design-partner funnel and second wave |
| D: opt-in receipt bot | A clever public snippet and reply | Easy remote use of the existing web executor | Platform dependency, moderation, API bill | Optional adapter after demand |

**My disagreement with a pure “kernel grows itself” lead:** it is the most unusual mechanism but currently the easiest to oversell. The canonical regrowth demonstration is not the story most viewers will infer from “AI writes an OS.” A useful agent program plus an honest short growth reveal wins more trust than a dramatic false before/after. If another team produces a genuinely new nontrivial workload enabled by a newly implemented contract, promote that footage—but only after the receipts exist.

**My disagreement with pure spectacle:** “a million computers” is not defensible unless the count and its meaning are observable. Sequential starts, simultaneously runnable guests, sleeping instances, and animation particles are different. The strongest hybrid gives every visible event a real completed-run ID and then lets the viewer create one. Do not delay launch to port DOOM, Pokémon, a browser, or a database that the current ABI cannot run.

**Overall selection:** practical workflow for the main video, A for the participation loop, C for qualified follow-up, bounded offline growth as the systems reveal. B and D are optional later experiments. This preserves the surprising systems story while giving people something understandable to do.

## 8. Launch sequence and timing

Timing below is a proposed editorial schedule, not an optimal-X-time claim or a deployment commitment. Dates assume readiness; move them if the real demo or gates are unfinished. Today is Sunday October 25. Europe is on standard time; the US remains on daylight time until November 1.

**Monday October 26, 17:00 Berlin / 16:00 UTC / noon New York / 09:00 San Francisco — teaser.** Publish a 6–10-second actual capture: click, result, a distinct execution ID, teardown confirmation. Draft: “Every click gets a new computer. This one runs agent tool code.” Include one concrete thing that works and that it is experimental. A preset local capture is enough; do not promise a public escape service tomorrow. No empty countdown, fake fleet, or fabricated 9-ms lifetime.

**Tuesday October 27, 16:00 Berlin / 15:00 UTC / 11:00 New York / 08:00 San Francisco — main demonstration.** A 35–50-second native video: the result and execution boundary in 0–3 s; a useful fixture task and tool grants in 3–15 s; overlapping host calls and compact output in 15–25 s; disposal/fresh next run in 25–32 s; a correctly labeled offline growth receipt in 32–42 s; reproduction/limits in the closing seconds. If that is too dense for a phone, keep growth in a separate clip linked immediately. Do not hide key caveats at the end of a long thread.

Root draft: **“Agents write little programs to use tools. I built a throwaway computer for each one. Fresh microVM, tiny Rust kernel, only the tools the host grants. Here's the working demo.”** An early reply supplies repo/setup, the exact release/image hashes, measured local timing boundaries, and the uncut recording. Public links and clean-machine reproduction must exist before publication; the existing notes report no configured public remote, so do not invent a repo URL.

**Launch day +0–2 hours:** the author stays available for technical questions and reproductions. Explain actual denials and failures. Do not auto-reply to everyone. Correct material errors visibly. If the public gateway is unready, launch the honest local/recorded demo and defer the web link; prototype visibility does not require public hostile exposure.

**Wednesday October 28:** publish one substantive engineering follow-up if it adds evidence: a timing decomposition, a rejected syscall proposal, or a reproducible lifecycle failure/fix. Label replay and the tested contract. Ask for a small useful workload that does not fit, rather than a generic “thoughts?”

**Thursday October 29, 16:00 Berlin / 15:00 UTC / 11:00 New York / 08:00 San Francisco — participatory follow-up.** Open A's preset mode only after its gates pass. Draft: “You saw the demo. Now make one: each click runs this program in a fresh VM and adds one tile. Your receipt includes the result and teardown.” Keep the first session to an observed 1–2-hour window with a spend cap; expand only after real queue/timeout/reap behavior looks healthy. Mark arbitrary-JS editor availability explicitly. The primary CTA is run/remix, not repost.

**Days +4–7:** publish actual participant results and the count of valid completions, distinct participants, timeouts, rejected requests, and independent reproductions. Feature 3–5 interesting opt-in snippets or tasks, including an honest failure. Open a small C pilot if useful tasks arrive. Do not run the model for every visitor merely to say the experience is AI-powered.

**Day +7 review:** prefer five independent attempts, three successful reproductions, and several real workload requests over raw view totals. These are internal targets, not forecasts. Measure page view → valid submission → successful run → receipt viewed → share clicked → downstream run, with privacy-conscious aggregate instrumentation. Also track queue abandonment, p95 service latency, timeouts, budget consumption, and human support time. A share-button click is not a verified post; bot submissions are not people.

**Day +14 or later:** consider B only after dedicated-host validation, external review, clear scope, funded reserve, and an incident rehearsal. Consider D only after required X approval, endpoint/billing verification, and evidence that users want native replies. Neither date should be announced before its prerequisites are met. After November 1, recompute US time conversions rather than reuse launch-week offsets.

Stop or simplify a concept if people share only the animation and cannot explain the execution contract; if almost all task requests need full Linux; if the public budget is spent on bots; or if operators cannot confidently retire/reap hostile runs. Those are useful findings. The credible launch story is a working constrained computer with receipts—not a promise that every computer, syscall, security claim, and cloud economic model has already been solved.

## Decision in twelve lines

1. Lead with a useful agent task; make the disposable VM visible.
2. Use “Every click gets a new computer” as the participatory hook.
3. Launch a preset mural/receipt toy before accepting arbitrary JS.
4. Let people share their own result, code, and reproduction receipt.
5. Count completed/reaped runs, not invented live machines.
6. Keep 0.29 ms raw parked, 2.1 ms warm MCP, and 9–10 ms cold executor separate.
7. Do not call executor latency a computer's lifetime.
8. Keep kernel growth offline and snapshots visibly planned.
9. Prepare dedicated hosts, denied egress, enforced budgets, and a real stop button.
10. Treat an escape challenge as security work with possible real compromise.
11. Prefer web sharing: X approvals and API writes can dominate cost.
12. Tease, prove, invite participation, then publish what people actually found.
