# Sofort on Twitter/X: positioning, launch research, and draft campaign

Research date: **2026-10-25**. Scope: research and drafts only. No posting, outreach, commits, or changes to existing project files.

## Recommendation

Launch Sofort as an **experimental runtime for code-mode agents**, with a working demo and an unusually inspectable mechanism: a tiny Rust kernel whose restricted syscall surface grows offline against a Linux oracle. Lead with the useful execution boundary; reveal the kernel-growth loop next. Ask for workload reproductions and technical criticism.

**Recommended one-liner:** “Sofort runs agent-written code in throwaway microVMs, on a tiny Rust kernel grown offline against Linux.”

**Public category:** “Purpose-built computers for agent code.” **Technical descriptor:** “Single-use microVM runtime with a restricted Linux ABI.” Keep “just-in-time computers” as the direction, with explicit separation between the runtime that exists and per-request profile assembly that is planned.

The attention opportunity is real, but “computers for agents” is already crowded. Fly, Daytona, and Modal explicitly occupy that language. Sofort's interesting difference is the combination of a restricted guest kernel, ordinary static binaries in user mode, host-mediated tools, single-use VMs, and an offline agent-assisted growth/test loop. None of these ingredients alone is a first-in-history claim.

Use **thread B below** as the default launch. Thread A is better if the author's existing audience is mostly systems programmers. Thread C is best as a later origin-story post, or as the primary launch only if a polished, correctly labeled growth recording is ready. Publish one version, not all three.

## 1. Evidence quality and what “working on X” means here

This is a purposive sample of relevant launches, not an experiment on the X algorithm. Evidence includes primary launch articles, official documentation, original X URLs, search-indexed post text, and third-party social mirrors. Some original X pages returned HTTP 403; a mirror returned 429. Exact complete launch threads and quote-tweet graphs were not recoverable for every example. **I do not reconstruct missing tweets, infer quote-tweet counts from repost counts, or attribute success causally to a hook.**

Two useful cautions from the research:

- Daytona's Oct 20 launch tracker search result showed 222K views; opening the same tracker returned 29K. Another tracker showed 248K. These snapshots cannot be reconciled from available evidence. Do not use them as a reach benchmark. [Launch tracker](https://www.launchvideo.com/directory/daytona), [second tracker](https://doomers.ai/launches/daytona).
- Zed's 1.0 video has a dated third-party snapshot of roughly 479K X views on Sep 14, 2026, and the primary release article confirms the Apr 29 launch. This is credible evidence of broad circulation, not proof that its tagline or video caused that circulation. [Video record](https://whatships.com/videos/zed-1-0/), [primary release](https://zed.dev/blog/zed-1-0).

The recommendations below are editorial inferences from these examples. Timing and cadence are proposed experiments, not claims about a secret ranking formula. No evidence here establishes that X suppresses all outbound links or that 8–12 tweets outperform a single demo post.

## 2. Launch patterns worth copying

### Cloudflare Code Mode: name the change in behavior

The Sept 26, 2025 article opens with a challenge to conventional MCP use, explains presenting tools as a TypeScript API, then demonstrates composition through code. Its strength is that a developer can repeat the conceptual change in one sentence. The March 24, 2026 Dynamic Workers follow-up adds an explicit performance headline and explains where generated code runs. [Original Code Mode launch](https://blog.cloudflare.com/code-mode/), [Dynamic Workers launch](https://blog.cloudflare.com/dynamic-workers/).

**Steal:** recognizable problem → surprising change → short code → mechanism → limitations → try it. Name a behavior the reader can adopt. **Avoid:** borrowing Cloudflare's token-reduction percentages as Sofort results, or claiming Sofort invented code mode. The thread should say it supplies an execution backend for that pattern.

### Fly Sprites: a memorable object, followed by a working product

The Jan 9, 2026 launch reframes sandboxes as disposable computers and immediately offers something usable. The subsequent implementation article uses a concrete everyday analogy and explains the engineering. This is an article-led launch package; a complete numbered X thread was not recovered. [Launch](https://www.fly.io/blog/code-and-let-live/), [implementation](https://www.fly.io/blog/design-and-implementation/).

Simon Willison independently wrote about the product on launch day, distinguishing developer sandboxes from API sandboxes. He disclosed Fly's sponsorship and said he had no preview access or request to write. That is observed editorial amplification, not an X quote-tweet count. [Launch-day analysis](https://feeds.simonwillison.net/2026/Jan/9/sprites-dev/).

**Steal:** put the object and use case before virtualization vocabulary; make trying it easy. **Avoid:** “the age of sandboxes is over” as Sofort's own thesis. Persistent developer machines and disposable execution snippets solve different problems; Sofort currently serves the latter.

### Daytona: repeat a category, ship a sequence, use customer proof

Daytona's Oct 20, 2026 founder launch leads with financing and “Agent Cloud”; the primary announcement connects that category to workload breadth and customers. The original post URL is identifiable, but its full replies/thread were inaccessible. [Original X post](https://x.com/ivanburazin/status/2112559682720055454), [primary announcement](https://www.daytona.io/dotfiles/daytona-raises-60m-series-b-to-build-the-agent-cloud).

Its earlier launch-week recap sequences concrete capabilities over multiple days instead of stretching one announcement indefinitely. [Launch-week recap](https://www.daytona.io/dotfiles/daytona-launch-week-recap).

**Steal:** one consistent description; each follow-up contains a real feature or receipt. **Avoid:** imitating funding announcements, investor tag walls, customer-logo borrowing, or weeklong daily launch claims when there is only one prototype release. A small project should compete on an interesting, reproducible artifact.

### E2B: sell the consequence of latency

A September 3, 2026 customer story connects sandbox/tool latency to idle GPU time during RL rollouts, with a customer-attributed “up to 3×” comparison. It describes snapshotting and consistent rollout state. The indexed X mirror shows founder-led case-study distribution with video, but this research does not verify the full original thread or its conversion. [Primary customer story](https://e2b.dev/customers/paperinstruments), [indexed social mirror](https://x.noodl3.net/e2b).

**Steal:** explain why a number matters to the workload owner. For Sofort, the credible initial consequence is fast, disposable glue-code execution and host-controlled tool access. **Avoid:** translating local Mac milliseconds into proven RL savings, fleet economics, or a faster full coding-agent environment.

### Modal: a tiny adoption step plus an engineering follow-up

The Oct 1, 2026 VM Sandbox launch offers a one-flag example, describes why agents need full Linux features, and provides customer use cases. An Oct 16 filesystem article supplies the deeper systems story. [VM launch](https://modal.com/blog/vm-sandboxes-agent-computers), [filesystem follow-up](https://frontend.modal.com/blog/vm-sandbox-filesystem).

Indexed social material shows a short Runtime announcement listing releases, a keynote, and a sandbox visualization; a maintainer explains that the visualization counted real HTTP greetings from launched sandboxes. That last detail is precisely the kind of receipt a systems audience can discuss. The mirror's relative timestamps are insufficient for precise attribution of every post to a calendar day. [Social mirror](https://zamantika.com/profile/modal).

**Steal:** show the integration and make every animated box correspond to something verifiable if it is presented as a live demo. **Avoid:** claiming Sofort's conceptual animation is a real fleet measurement. Sofort also cannot yet match Modal's full Linux workload breadth.

### Turso: ambition becomes shareable when paired with an odd demonstration

The July 16, 2026 announcement ties a Postgres-in-Rust effort to the “LLVM of databases” analogy and a DOOM demonstration on database bytecode. The indexed founder post is long-form, not evidence that short tweets always win. Social mirrors show Turso quoting the founder and Pekka Enberg sharing the demo. [Primary launch](https://turso.tech/blog/a-new-modern-version-of-postgres-in-rust), [founder mirror](https://nitter.rdrama.net/glcst), [brand mirror](https://teapawt.net/tursodatabase).

**Steal:** a difficult technical idea plus one surprising thing that visibly runs. For Sofort, unchanged static Lua and the missing-syscall probe are more credible than an imagined rg/SQLite pipeline. **Avoid:** inventing a “Linux rewritten in Rust” claim. Turso's visible reach also includes an established founder audience and brand distribution.

### Bun 1.0: collapse complexity into one understandable action

The Sept 8, 2023 launch packages a video, immediate install instructions, familiar code, compatibility explanations, and performance demonstrations. Its promise is comprehensible before the reader studies the implementation. The launch is historically useful, not evidence of what a new account can achieve in October 2026. An original announcement URL is indexed, but the X page returned 403. [Primary release](https://bun.com/blog/bun-v1.0), [indexed announcement URL](https://x.com/jarredsumner/status/1700815403717730415).

**Steal:** put the first successful command close to the pitch; answer compatibility concretely. **Avoid:** presenting building libkrun plus a custom kernel as a one-command install unless a clean-machine test proves it.

### Ghostty: craft, expectations, and respect for alternatives

Mitchell Hashimoto's prelaunch article distinguishes the immediate release goals from the longer vision and includes community screenshots. His launch-day HN comment explicitly acknowledges strong alternatives and different tradeoffs. The HN launch record shows substantial discussion, but that is not an X engagement measurement. [Prelaunch](https://mitchellh.com/writing/ghostty-is-coming), [launch discussion](https://news.ycombinator.com/item?id=42517447).

**Steal:** have a real point of view and be unusually specific about tradeoffs. **Avoid:** copying the long private beta or founder-fame strategy. Sofort has neither the same maturity nor an equivalent everyday end-user product.

### Zed 1.0: let a video carry the launch, use writing to establish substance

The Apr 29, 2026 X launch copy recorded by two video trackers is just “Zed 1.0: Your last next editor.” The video runs 2:12. The primary release supplies the missing substance: why the team built its own foundation, what the milestone means, and what remains. [Recorded X launch](https://www.launchvideo.com/directory/zed), [video record](https://whatships.com/videos/zed-1-0/), [primary article](https://zed.dev/blog/zed-1-0).

**Steal:** the root post need not carry the whole architecture if the video makes the product obvious. **Avoid:** an unexplained slogan with no visible result. A small infra project needs a clearer root description than an already recognizable editor.

### Hyperlight and Kerla: precision beats claiming no prior art

Microsoft's Nov 7, 2024 Hyperlight announcement already made the case for hardware-isolated functions with millisecond VM creation. It pairs numbers with a diagram and working Rust code. This is a primary launch article; no complete original X launch thread or quote-tweet graph was recovered. [Hyperlight launch](https://opensource.microsoft.com/blog/2024/11/07/introducing-hyperlight-virtual-machine-based-security-for-functions-at-scale/).

Kerla already demonstrates a Rust Linux-ABI kernel, including an SSH demo backed by per-connection Firecracker VMs; its README now says it is unmaintained. It is valuable prior art and a demonstration pattern, not a verified successful 2026 X launch. Unikraft also has a current ARM64/SDK release aimed partly at agent workloads. [Kerla](https://github.com/nuta/kerla), [Unikraft Sept 2, 2026 release](https://unikraft.com/blog/adrastea-13-release).

**Steal:** explain exactly what the kernel adds and what runs unchanged. **Avoid:** “first tiny Rust OS,” “first microVM per function,” and “Linux compatibility solved.” The distinctive contribution to investigate is the bounded, agent-assisted growth process and its integration into the agent runtime.

### What actually appears to earn amplification

Observed examples are a mix of quote posts, reposts, independent writing, and launch-video circulation; they are not interchangeable metrics:

1. **An expert can explain the mechanism to their own audience.** Turso's brand/founder/demo distribution is visible in mirrors. Pi's Mario Zechner recommended Armin Ronacher's Oct 6 code-mode explainer; the original URLs are indexed, although their metrics were not independently recovered. [Armin's post](https://x.com/mitsuhiko/status/2107464890180927782), [Mario's recommendation](https://x.com/badlogicgames/status/2107495556406738992), [primary explanation](https://lucumr.pocoo.org/2026/10/6/codemode/).
2. **A result is interesting enough for independent testing.** Willison's Sprites write-up is a concrete example. A Sofort reproduction by another machine owner would matter more than a generic supportive quote.
3. **A visual supplies evidence.** A terminal result, actual concurrency trace, hash, and Linux comparison give people something to interrogate. An animation supplies explanation; label it accordingly.
4. **A local number connects to a real job.** E2B's case study connects tool waiting to a customer's workload. Sofort needs a comparably narrow use case, not a universal speed ranking.

My inference: the most productive quote-worthy Sofort sentence is **“An agent added a missing syscall, then Linux became the test oracle.”** It creates a question that the repo can answer. The least productive is “I vibe-coded an OS that replaces Linux.”

## 3. Claim boundaries: what the pitch can withstand

Local sources read: [README](../../../README.md), [FINAL](../../FINAL.md), [R5 plan/results](../../PLAN-R5.md), [claims ledger](../../jitk/docs/CLAIMS.md), [podcast transcript](../next-token-ep07-transcript.txt), both existing explainers, the executor/MCP/grow READMEs, and the dated benchmark reports. This was document/source inspection, not an independent test run.

### Numbers to publish with their boundaries

| Observation | Defensible wording | Do not turn it into |
| --- | --- | --- |
| 0.285 ms p50, pre-booted raw one-tool case | “0.29 ms from RUN to validated completion in the parked VM harness; macOS arm64; n=30.” | Cold boot, public API latency, or an MCP round trip |
| 5.904 ms raw cold return2; 6.048 ms raw cold one-tool | “About 6 ms raw cold execution in this Mac harness.” | Entire application startup or image build included |
| 9.241 / 9.597 ms cold executor return2 / one-tool, after native watchdog | “About 9–10 ms cold execute(), with executor already running.” | Cold Node startup, image compilation, resource download, or remote network time |
| 6.544 vs 63.209 ms parked Promise.all(10×5 ms), jitk vs Hyperlight strict | “This concurrent asynchronous-tool fixture completed in 6.5 vs 63 ms in our whole-stack comparison.” | QuickJS engine speed, universal 10× VM superiority, or 10× faster agents |
| Later executor parked one-tool 2.882 ms | “The executor path has additional overhead.” | Mixing this with the raw 0.29 ms as the same interface |
| R5 MCP one-tool 2.106 ms; matched in-process core 1.749 ms | “In a separate R5 run, MCP stdio added about 0.36 ms p50.” | Subtracting rows from another run to construct a synthetic end-to-end number |
| Historical 10.657 vs 1.813 MiB process footprint | “Hyperlight used less measured process footprint in that report.” | Total physical memory, HVF-inclusive memory, or latest post-loader-patch memory |

Sources: [quiet benchmark and definitions](../../jitk/bench/RESULTS-quiet-2026-10-24.md), [native-watchdog rerun](../../jitk/bench/RESULTS-native-watchdog-2026-10-24.md), [MCP matched comparison](../../jitk/mcp/RESULTS.md). These results exclude specified preparation costs and contain only 30 samples per row; do not sell p99 reliability from them.

The 6.5 vs 63 ms result is mainly useful as evidence that this integration can overlap the fixture's asynchronous tool work. The systems under comparison also use different engines: Bellard QuickJS versus quickjs-ng. The timing does not isolate the kernel, VM manager, or engine. Publish the code and versions alongside any comparison.

### Mechanism and maturity

- **Exists:** fresh, single-use hardware VMs; static QuickJS in guest user mode; static Lua fixture; trusted host tools; native deadline watchdog; MCP execute/resources; packed read-only files; offline growth with replay and live modes.
- **Planned:** generic task-to-kernel/binaries/resources assembly cached by recipe; snapshot restoration; tool-backed capability files; Cap'n Web bridge/pipelining; arbitrary new binaries. Do not animate these in the same visual style as measured features.
- **Growth:** the default demo is explicitly REPLAY. The live mode calls the model and has reported successful bounded differential checks. It runs offline, before deploying a profile, not inside a user's request. The Linux oracle establishes fixture-level agreement, not arbitrary syscall correctness.
- **Lua:** already runs with missing-slot ENOSYS defaults. Showing regrowth establishes a checked contract; it does not establish that Lua was impossible before the agent patch. Use the probe's actual missing behavior for a before/after demonstration.
- **Size:** roughly 1.7k kernel lines is a scoped approximation, not the whole product. R4 counted 1,440 runtime kernel lines, 1,740 including tooling, about 4k runtime total, and 9,409 owned physical lines. R5 added filesystem code. Regenerate counts on the release revision; avoid an exact LOC headline until then.
- **Security:** small source size, Rust, hardware isolation, and finite hostile tests are useful engineering choices and observations. They do not prove absence of escapes. Do not offer public untrusted execution as though that exposure had been certified.
- **Deadlines:** killing a VM does not interrupt synchronous host JavaScript or guarantee immediate API settlement. The native watchdog measurements are improvements, not a universal latency SLO.
- **Economics:** the first quiet run measured about 4.86 CPU-ms for cold return2; the later run measured about 5.04. Therefore “under 5 CPU-ms” is not a stable launch promise. Linux results are nested functional evidence, not bare-metal cost/density results.

The frozen R4 ledger and older README passages retain failed aggregate/portability/deadline claims; FINAL appends later fixes and reruns, and R5 adds more results. Preserve history, but create a current release status with exact source/artifact hashes and explicit supersession. A reader should not need to decide whether an earlier failed gate has actually been resolved.

## 4. Positioning and five alternative hooks

Use **Sofort** as the product name. Explain once that **jitk** is its kernel/runtime implementation. Avoid alternating unexplained names in a thread. “Just in time” describes specialization/assembly ambition; QuickJS remains an interpreter, so it must not imply JIT compilation of guest JavaScript.

| Hook | Best audience | Risk and recommended use |
| --- | --- | --- |
| “A throwaway computer for each agent code execution.” | Agent builders and platform engineers | Low. Say execution, not every nested tool call. One snippet can call many host tools. Good primary hook. |
| “The kernel grows when a program needs another syscall.” | Rust, OS, virtualization, testing people | Medium. Immediately add “offline, with a Linux oracle.” Strong reveal after showing usefulness. |
| “Agents grow their own kernel.” | AI builders and systems crossover | High without a qualifier. Sounds like autonomous runtime mutation. Use “Agents help grow a restricted kernel offline” in the body. |
| “An OS that writes itself.” | Broad AI narrative audiences | Very high. Implies end-to-end autonomy, broad OS scope, and self-hosting. Likely security/OS dunk bait. Do not use as an unqualified root post. |
| “They predicted just-in-time computers over MCP. Here's a working piece of that.” | Next Token listeners, Cloudflare/code-mode audience | Medium. Good narrative opener if the podcast and exact implemented piece are shown. Do not say the prediction is fully solved. |

**Recommended pitch ladder:**

1. Useful: an execution backend for small agent-written programs.
2. Concrete: every execution gets a disposable microVM; external effects go through host tools.
3. Surprising: the tiny guest kernel grows offline using Linux as an oracle.
4. Evidence: real runnable code, one measured latency boundary, honest comparison.
5. Direction: purpose-built profiles assembled for tasks; mark it as next work.

Do not claim a new category requires everyone to abandon Linux, Firecracker, V8, WASM, or hosted sandboxes. Sofort's initial wedge is short, tool-heavy glue code whose restricted runtime is acceptable. Full repository coding, package installation, persistent servers, rich Python data science, and arbitrary POSIX programs are not established uses.

## 5. Accounts whose attention would matter

This is a relevance map, not a contact list or an expectation of endorsement. No one was contacted. Priority measures topical fit, not follower count. Profile and employment information changes; where only indexed mirrors were available, role descriptions below are deliberately broad. Do not bulk-tag this table in a launch.

### Highest fit: the code-mode and podcast conversation

The episode's own show notes verify the hosts, guest, handles, recording date **Oct 12**, and publication date **Oct 19, 2026**. The show is **@NextTokenShow**, not the unrelated nexttoken.tv podcast returned by some searches. [Episode and show notes](https://podcasts.apple.com/au/podcast/whats-after-code-mode-ep-07/id6784829318?i=1000797105720).

| Account | Why their engagement matters | Artifact most relevant to them |
| --- | --- | --- |
| [@threepointone](https://x.com/threepointone) — Sunil Pai | Code Mode coauthor and Next Token host; closest connection to the purpose-built-computer idea | Accurate prediction attribution plus working architecture/growth demo |
| [@KentonVarda](https://x.com/KentonVarda) | Code Mode, capability systems, Cap'n Web; likely to examine the trust boundary | Host/guest diagram and an explicit built/planned capability distinction |
| [@mattzcarey](https://x.com/mattzcarey) | Episode guest and Cloudflare API/code-mode implementer | MCP execute contract, structured outputs, integration limits |
| [@RhysSullivan](https://x.com/RhysSullivan) | Next Token host; Executor and practical code-mode composition | Concurrent tools, approvals, cancellation, nested-code-mode tradeoffs |
| [@dillon_mulroy](https://x.com/dillon_mulroy) | Next Token host and developer-facing demos | A short real demo with code and a visible result |
| [@NextTokenShow](https://x.com/NextTokenShow) | Direct source audience for the prediction | Timestamped credit and a narrow statement of what was built |

The original Code Mode article and episode are the primary basis for this group's relevance. Quote at most one short excerpt and link the episode; do not imply the hosts reviewed or endorsed Sofort. The local transcript is not speaker-diarized at every transition, so verify the voice/video before attaching the 53:42–54:xx prediction to one named speaker.

### Builders and technical interpreters

| Account | Why | Useful material |
| --- | --- | --- |
| [@simonw](https://x.com/simonw) | Practical agent execution and security analysis; demonstrably tests sandbox products | Runnable examples, threat model, exact measurement boundaries; [Sprites analysis](https://feeds.simonwillison.net/2026/Jan/9/sprites-dev/) |
| [@mitsuhiko](https://x.com/mitsuhiko) — Armin Ronacher | Current detailed writing on code-mode execution and trusted harness separation | Restricted runtime design and an honest WASM comparison; [Oct 6 article](https://lucumr.pocoo.org/2026/10/6/codemode/) |
| [@badlogicgames](https://x.com/badlogicgames) — Mario Zechner | Pi builder; bridges minimal harnesses and practical demonstrations | Small reproducible example rather than a sweeping manifesto; [profile/social evidence](https://nitter.rdrama.net/badlogicgames) |
| [@swyx](https://x.com/swyx) | AI Engineer and Latent Space distribution into the agent-builder audience | One clear execution primitive plus proof; [own biography](https://swyx.io/about) |
| [@mitchellh](https://x.com/mitchellh) | Systems/tooling craft and clear tradeoff explanations | Source walkthrough, reproducibility, correctly scoped size; [own release writing](https://mitchellh.com/writing/ghostty-is-coming) |
| [@tqbf](https://x.com/tqbf) — Thomas Ptacek | Security and VM/sandbox skepticism; useful adversarial scrutiny | Explicit TCB, VMM confinement, hostile-test gaps; [handle evidence](https://texxr.com/handle/tqbf) |
| [@mrkurt](https://x.com/mrkurt) — Kurt Mackey | Fly/Sprites product framing and disposable-computer experience | Why per-snippet compute differs from a persistent developer machine; [launch byline](https://www.fly.io/blog/code-and-let-live/) |
| [@glcst](https://x.com/glcst), [@penberg](https://x.com/penberg) | Rust/system software, compatibility, credible technical launch storytelling | Linux oracle and unchanged binaries; [Turso launch](https://turso.tech/blog/a-new-modern-version-of-postgres-in-rust), [social evidence](https://teapawt.net/tursodatabase) |
| [@jarredsumner](https://x.com/jarredsumner) | Runtime startup/engine performance audience | Exact raw-vs-executor phase trace, with QuickJS's CPU disadvantages; [Bun launch](https://bun.com/blog/bun-v1.0) |

### Developer-facing platform accounts and adjacent providers

| Account | Why | Suitable angle |
| --- | --- | --- |
| [@CloudflareDev](https://x.com/CloudflareDev) | Code Mode's immediate developer ecosystem | Executor interface implementation, with no endorsement claim |
| [@rauchg](https://x.com/rauchg), [@vercel](https://x.com/vercel) | Agent runtime/DX audience; Vercel leadership has a systems/open-source background | Runtime boundary and practical integration; [Rauch's own biography](https://rauchg.com/about) |
| [@alexalbert__](https://x.com/alexalbert__) | Developer-facing Claude work and agent demonstrations | Honest agent-generated-handler workflow and evaluation; [self-linked profile](https://www.linkedin.com/in/alex-albert) |
| [@OpenAIDevs](https://x.com/OpenAIDevs) | Agent/tool execution builders | Working integration and explicit sandbox constraints |
| [@craigsdennis](https://x.com/craigsdennis) | Developer education across Cloudflare and OpenAI audiences | Short reproducible demo; current indexed profile says OpenAI DX, so do not introduce him as current Cloudflare devrel; [profile](https://teapawt.net/craigsdennis) |
| [@mlejva](https://x.com/mlejva), [@e2b](https://x.com/e2b) | Sandbox workload experience and production execution concerns | Reproduction, workload boundaries, fleet questions; [customer case](https://e2b.dev/customers/paperinstruments) |
| [@ivanburazin](https://x.com/ivanburazin), [@daytonaio](https://x.com/daytonaio) | Agent infrastructure and computer-per-agent category | Different granularity and compatibility tradeoffs; [announcement](https://www.daytona.io/dotfiles/daytona-raises-60m-series-b-to-build-the-agent-cloud) |
| [@bernhardsson](https://x.com/bernhardsson), [@modal](https://x.com/modal) | Runtime economics and scalable execution audience | CPU cost, concurrency, and what remains unmeasured; [official VM launch](https://modal.com/blog/vm-sandboxes-agent-computers), [social context](https://www.sotwe.com/modal?lang=en) |

Prioritize substantive replies from the first two groups over broad influencer mentions. Competitor builders may be the best people to expose a flawed benchmark; that is useful feedback, not a reason to bait them. Attribution to the podcast is appropriate. Tagging people solely to obtain distribution is unlikely to strengthen the technical story.

## 6. Visual package: what to show and what to repair first

### Primary recording: 35–50 seconds

This is a proposed recording plan, not an existing new artifact or a claim that recording was performed.

- **0–3 s:** readable code, an `execute` call, and “fresh VM per execution.” Start with the result visible; no logo animation.
- **3–12 s:** submit a small JS snippet calling two declared demo tools; show the returned JSON and host-side overlap trace. Distinguish guest orchestration from host tool execution.
- **12–20 s:** show completion and VM disposal, then another execution with a distinct VM/process identity. Do not call this different physical hardware.
- **20–32 s:** show an actual missing-syscall probe and the offline growth/test receipt. Persistent label: “recorded offline growth; elapsed time compressed.” State LIVE or REPLAY throughout.
- **32–42 s:** show Linux/jitk probe agreement and the selected kernel/profile hash. Separately show static Lua's output; do not label it “Lua now works for the first time.”
- **42–50 s:** end on repo/demo instructions, “experimental,” and three boundaries: no arbitrary Linux compatibility; snapshot restore planned; local measurements.

Export a native MP4 at a mobile-readable resolution with captions and large text; proposed 1080×1350 for the feed plus a 1920×1080 version for the repo. Keep the root recording under a minute as a production choice, not as an asserted algorithm advantage. A separate uncut recording should contain full timestamps and exact commands. Avoid speeding up the execution segment while displaying a real-time stopwatch.

### Supporting stills

1. **Boundary diagram:** agent → MCP → trusted executor/policy → VM → user-mode QuickJS. Tool requests travel back to the trusted executor. Label the host tooling as part of the trusted system.
2. **Latency card:** raw cold and parked in separate panels; executor/MCP on another card. Every card includes platform, date, case, p50, n, and timing endpoints. If Hyperlight appears, include the cold/memory tradeoffs in the same visible image or an adjacent immediately linked image.
3. **Growth receipt:** missing behavior → proposed handler → Linux comparison → tested artifact hash. Highlight exact fixture coverage rather than a green “secure” badge.

### Audit of existing explainers

[idea.html](../../viz/idea.html) and [demo.html](../../viz/demo.html) already have useful colors for measured/built/planned/reported states. Preserve that distinction. They are conceptual animated explainers, not recordings of live execution.

Before using screenshots or recordings from them:

- Fix any grouping that implies containers inherently have a hardware boundary. A container by itself shares a host kernel; a VM-backed container deployment is a different configuration.
- Remove universal “VM/container = 100 ms to seconds” or “Linux brings every driver” comparisons. Present specific measured setups or explicitly named, sourced reported configurations.
- Avoid “hundreds to thousands of times faster than containers” based on a local raw VM number and someone else's container cold-start number.
- The `env.SOFORT.computer({grant, bins:["rg","sqlite3"]})`, Cap'n Web bridge, `/cap/logs` tool-backed files, and pipes/promise-pipelines story is **planned**. Add a persistent overlay across every relevant scene, not just a small tag in one frame.
- A hash-cached task recipe and ≤1 ms snapshot restore are planned; pre-booted raw execution is not snapshot restoration.
- “Unikernels just fell” reads as a completed breakthrough. Replace it in future launch assets with a precise implemented result or label it an aspiration.
- Do not equate full Linux binary compatibility with “some unmodified static binaries.” The latter is the supported statement.

No existing explainer was changed for this report.

## 7. Three complete alternative launch threads

Editorial notes: These are **alternative drafts**, each with 10 tweets, intended to fit ordinary 280-character posts. Labels and production directions are not tweet text. `[REPO]`, `[BENCH]`, and `[EPISODE]` are URL placeholders; no public git remote was configured in the inspected checkout. Substitute verified public URLs and check the final composer counts before publication. No tweet claims an open-source license: a root project license was not found during this inspection.

### A. Systems-nerd technical

**A1**

> I built a tiny Rust kernel for agent-written programs. Static QuickJS runs in user mode inside a fresh, single-use microVM. Missing syscalls can be added by an agent, offline, with Linux as the test oracle. It's called Sofort. Here's what works. 1/10

*Attach: actual 35–50 s recording, with the growth mode labeled.*

**A2**

> Each execution gets its own VM: libkrun on HVF/macOS or KVM/Linux. Inside: jitk, a no_std Rust kernel with a restricted Linux ABI. QuickJS is an ordinary static guest binary. This is a deliberately narrow runtime, not a general Linux replacement. 2/10

**A3**

> The guest's external I/O is a JSON-lines tool channel. A trusted TypeScript executor validates and dispatches tool calls. Provider credentials stay on the host in this design. The executor implements Cloudflare codemode's Executor interface. 3/10

*Attach: boundary diagram. Explain host tool implementations are trusted.*

**A4**

> The growth loop: observe a missing syscall → inspect Linux under strace → agent proposes a handler → build → compare fixture behavior against Linux in fresh VMs → record a versioned manifest. This happens offline, before a profile is used. 4/10

**A5**

> Demo honesty: the default growth demo is REPLAY; live mode calls the model. Lua already runs with ENOSYS defaults. Regrowth verifies a restricted contract—it doesn't make a previously impossible Lua program spring to life. Receipts are in the repo. 5/10

**A6**

> Local macOS arm64, n=30: one-tool raw execution was 0.29 ms p50 in a pre-booted VM and about 6 ms cold. Cold execute() through the running executor was about 9–10 ms. Different timing boundaries; Node startup and image building excluded. 6/10

*Attach: separate raw/executor timing panels; include dated benchmark link in the card.*

**A7**

> Our parked Promise.all(10 × 5 ms tools) fixture: 6.5 ms vs 63 ms for the tested Hyperlight stack. That's a whole-stack async-tool comparison, not an engine benchmark. Hyperlight won cold return2 and measured footprint in the same report. [BENCH] 7/10

**A8**

> QuickJS buys small size and startup, not V8-class compute speed. Our tests found it slower on glue and much slower on numeric code. The intended workload is short programs coordinating tools. Heavy computation belongs elsewhere. 8/10

**A9**

> Built: MCP execute/resources, packed read-only files, static QuickJS/Lua fixtures, offline growth. Next: snapshot restore and task-specific image assembly. Finite tests aren't a security proof, and arbitrary Linux compatibility isn't claimed. 9/10

**A10**

> Code, demo instructions, benchmark definitions, and known limits: [REPO] If you work on runtimes, I'd value a reproduction or a small static binary that exposes a missing contract. Sofort is an experimental execution backend; jitk is the kernel underneath. 10/10

### B. Agent-builder practical — recommended

**B1**

> Your agent writes 20 lines of JavaScript to call tools, filter results, and return an answer. Where should that code run? I built Sofort: a fresh, throwaway microVM for each execution, with a tiny Rust kernel underneath. Working prototype + demo: 1/10

*Attach: working execute/result/disposal recording; avoid leading with the grow terminal.*

**B2**

> The useful unit is one program, not one tool call. A snippet can call several tools concurrently and return a small result. It runs once; its VM is discarded. The model can compose the work without routing every intermediate value through context. 2/10

**B3**

> The guest calls declared tools through a trusted TypeScript executor. API credentials stay with host-side providers. The guest gets results. This keeps tool authorization outside generated code; the host tools and their policies still need to be correct. 3/10

*Attach: a small real snippet and output, copied from a verified demo.*

**B4**

> Integration today: Cloudflare codemode Executor, TanStack IsolateDriver, or MCP with an execute tool and readable resources. MCP stdio added about 0.4 ms p50 over the matched in-process core in our local Mac test. That's overhead, not total latency. 4/10

**B5**

> Timing matters: 0.29 ms is a raw, pre-booted one-tool harness result. Cold execute() measured about 9–10 ms with the executor already running. Separate MCP tests measured a parked one-tool call around 2.1 ms. Full boundaries and samples: [BENCH] 5/10

*Attach: timing-boundary card, not a single giant “0.29 ms” headline.*

**B6**

> This is for small tool-heavy programs. It isn't a full developer workstation: no npm-install-anything promise, no arbitrary Python stack, no general Linux compatibility. QuickJS favors size and startup; V8 is faster for substantial JS computation. 6/10

**B7**

> The unusual bit: the kernel can grow offline. When a program needs a missing syscall, an agent can propose the handler. Linux is the oracle for differential tests in fresh VMs. Accepted profiles get a manifest. No kernel editing while a user request waits. 7/10

*Attach: 15 s labeled growth excerpt, plus link to the uncut recording.*

**B8**

> What exists: disposable VMs, host-mediated tools, MCP, read-only guest resources, and a tested growth workflow. What comes next: assembling a computer profile for each task, plus snapshots. Those are roadmap items, not features hidden in this demo. 8/10

**B9**

> Still a prototype. Hardware isolation isn't a proof of safety. Killing a guest doesn't cancel blocking host JavaScript. Linux fleet cost/density is unmeasured. The docs separate what passed, what failed historically, and what needs another test. 9/10

**B10**

> Try the local demo: [REPO] I'd like feedback from people building code-mode agents: does this execution shape fit a real workload you have? A small reproducible example—especially one that breaks—is more useful than a star. 10/10

### C. Visionary/narrative

**C1**

> Last week on The Next Token, the conversation turned to computers built for a purpose, almost just in time, reached over MCP. I've been building a working piece of that idea: Sofort. A throwaway computer for agent code, with a kernel that can grow offline. 1/10

*Attach: working demo; credit the show in the next post. Do not splice podcast footage without checking reuse rights.*

**C2**

> The episode is “What's after Code Mode,” published Oct 19. Credit to the hosts and guest for the direction. The prediction is bigger than this prototype: today I can show disposable execution and a restricted kernel-growth workflow. [EPISODE] 2/10

*Replace [EPISODE] with the public episode URL above; use a timestamp after checking the public video.*

**C3**

> Agents can write a short program to combine tools. That program needs somewhere to run. Sofort gives it a fresh microVM, runs it once, and discards the machine. Tool requests leave through a channel to a trusted executor. That's the working starting point. 3/10

**C4**

> Inside is jitk: a small no_std Rust kernel exposing the subset of Linux syscalls our guest programs use. Static QuickJS runs in user mode. Static Lua runs too. Running these binaries is real; running every Linux program is not a claim. 4/10

**C5**

> Then comes the interesting loop. A missing syscall produces evidence. Linux shows the expected fixture behavior. An agent proposes a handler. Fresh VMs run differential tests. The accepted profile is recorded. All offline, before the next deployment. 5/10

*Attach: recorded missing-syscall probe; persistent LIVE/REPLAY and compressed-time labels.*

**C6**

> This isn't an OS autonomously rewriting itself in production. It's a narrow development loop with a useful oracle. The default demo replays recorded proposals; live mode calls the model. Both are labeled. The test scope is part of the result. 6/10

**C7**

> The local Mac measurements are encouraging: about 6 ms raw cold execution; about 9–10 ms cold execute() with the executor already running. A pre-booted one-tool harness measured 0.29 ms p50. These are different boundaries, not three names for boot time. 7/10

**C8**

> The next step is a recipe: kernel profile + binary + resources, assembled for a task and cached by hash. Snapshot restore and tool-backed files are part of that direction. They're planned. Today's packed read-only files and MCP endpoint are already built. 8/10

*Attach: roadmap still with built features solid and planned features dashed, explicitly labeled.*

**C9**

> A general computer remains the right tool for a huge range of jobs. I'm exploring the smaller case: a program with a short lifetime, a narrow set of tools, and a machine built around those constraints. The prototype makes that question concrete. 9/10

**C10**

> Sofort: purpose-built computers for agent code. Prototype, measurements, demo modes, and limits: [REPO] I'd love to see reproductions and counterexamples. What is the smallest static program that would teach this kernel something useful? 10/10

## 8. Ten skeptical replies, with answers worth standing behind

These answers are short enough for replies; link the relevant evidence when asked. Accept valid criticism instead of trying to win every exchange.

**1. “Just use Firecracker.”**

> Firecracker is a sensible choice for full Linux workloads. This prototype uses libkrun and explores a smaller guest plus a bounded growth loop. We haven't established that it beats a tuned Firecracker stack on your workload.

Firecracker is a VMM, so “why this kernel?” and “why this VMM?” are separate questions. Its primary project documentation is the appropriate baseline, not a generic slow-VM chart. [Firecracker](https://github.com/firecracker-microvm/firecracker).

**2. “Why not WASM/Wasmtime?”**

> WASM may be the better choice for pure JS glue. We're testing a hardware VM boundary and reuse of specific static Linux binaries. We haven't proven a general latency or security advantage over a well-designed WASM stack.

Pi's current code-mode runtime already uses QuickJS inside WASM; it is a real alternative, not a hypothetical objection. [Primary explanation](https://lucumr.pocoo.org/2026/10/6/codemode/).

**3. “QuickJS is slow.”**

> Yes for computation versus V8. Our own tests found that too. We chose it for startup and size for short glue programs. The 6.5 vs 63 ms tool fixture compares whole integrations, not JS engine speed.

**4. “Agent-written kernel code is a CVE factory.”**

> Generated handlers are proposals made offline. They go through builds and bounded Linux differential tests. That isn't a proof or a security audit. The runtime, host executor, VMM and hypervisor all remain part of the risk; public untrusted exposure isn't certified.

**5. “0.29 ms boot? You hid the warm pool.”**

> 0.29 ms is parked raw execution, not boot. Raw cold was about 6 ms; cold execute() about 9–10 ms with the executor running. Pool refill costs CPU and memory. The benchmark defines those boundaries separately.

**6. “Your Hyperlight comparison is apples to oranges.”**

> It's a whole-stack comparison, including different QuickJS variants. The async fixture is interesting, but not a kernel or engine shootout. Hyperlight also won cold return2 and measured footprint. Versions, cases, and raw samples are linked.

**7. “Tiny kernel, huge dependencies. This isn't a 1.7k-line computer.”**

> Correct. The kernel count excludes libkrun, QuickJS, the host OS and more. The R4 owned product tree was 9.4k lines and R5 added code. We should publish the current inventory, not describe the whole product as 1.7k lines.

**8. “Your agent didn't make Lua work. This is staged.”**

> Lua already ran with ENOSYS defaults. The demo regrows a restricted contract; it doesn't prove Lua was dead before. REPLAY and LIVE are labeled separately. The missing-syscall probe is the honest before/after to inspect.

**9. “Why put another code executor behind MCP?”**

> MCP is one access path; the in-process Executor interface also exists. Nested code mode can be awkward. We'd use the direct interface when it fits the harness better. The MCP layer is useful interoperability, not the core invention.

**10. “Is this safer/cheaper enough to use in production?”**

> We don't have that evidence yet. This is a prototype with local timing and bounded tests. Linux bare-metal economics and security gaps remain. Host tool policies still matter, and killing a VM doesn't stop noncooperative host callbacks.

For “this is just unikernels again,” answer plainly: “It builds on that lineage. The question here is whether agent-assisted, Linux-oracle growth makes a restricted runtime easier to extend. Here's the artifact and its limits.” Kerla/OSv/Unikraft are prior-art starting points, not projects to erase from the story.

## 9. Timing, cadence, and launch-day operating plan

### Proposed window

Today is Sunday Oct 25. If the readiness work is complete, target **Tuesday Oct 27, 2026 at 16:00 Berlin / 15:00 UTC / 11:00 New York / 08:00 San Francisco**. Europe has just returned to standard time; the US remains on daylight time that week. This is a convenient Europe/US overlap with time to answer, not an empirically optimal X slot. Verify the final calendar conversion when scheduling. If the release isn't reproducible by Monday evening, move the date rather than reclassifying planned work as built.

Do not create a launch-week countdown that implies a hosted service is ready. A single modest prelaunch post about a real engineering result is enough. If the author has analytics from an established audience, use those over generic advice.

### Schedule

| Time | Planned action | Purpose |
| --- | --- | --- |
| D−2 to D−1 | Finish release inventory, current status, runnable demo, docs and video; check public URLs logged out | Remove avoidable objections and broken links |
| D−1 | Optional one standalone engineering post: e.g. what a Linux differential test checks | Establish substance; no empty teaser |
| T−60 min | Human runs the exact demo; opens repo/video links on phone; confirms benchmark captions and release revision | Ensure the advertised path works |
| T | Publish chosen thread with native demo; put repo link in an early visible reply and the last tweet; pin root | Make the object understandable and usable |
| T to T+2 h | Author answers technical questions, accepts reproductions, fixes material inaccuracies publicly | The discussion is part of the release |
| T+2 to T+4 h | Consider one eligible HN submission; remain available there separately | Enable an independent technical discussion |
| T+6 h | One short receipt/correction reply if something new happened | Add information, not another “launching!” post |
| D+1 | Publish an engineering follow-up: raw vs executor timing or missing-handler acceptance gate | Give systems readers a distinct artifact |
| D+2 to D+3 | Share a compatible community-specific article if rules allow | Reach people with a relevant technical question |
| D+7 | Report reproductions, rejected ideas, actual failures, and next work | Turn launch attention into an accountable project |

This is a proposed plan only; nothing was scheduled. Do not automate replies, solicit quote tweets, buy engagement, or ask for upvotes. Do not delete and repost a disappointing launch. Correct errors in a clearly linked reply and update the canonical docs.

### Cadence and success measures

Publish the complete thread as a coherent batch instead of making readers wait hours for essential caveats. Keep one primary CTA: **run the demo or supply a small workload**. Use the early reply for the repo because it is discoverable, not because a link penalty was demonstrated. A root link is also reasonable when usability is better.

For the first week, aim for 2–3 substantive follow-ups total, each with new evidence. Do not publish the same 30-second clip repeatedly with different grandiose hooks. Reply selectively to good-faith technical questions; one canonical benchmark explanation can answer repeated objections.

Track at 24 h, 72 h, and 7 d: repo visits and clone attempts if available, successful independent runs, platform failures, useful issues, workload submissions, and substantive external analyses. Views/likes/bookmarks are secondary. A reasonable internal goal for a small launch is **five independent attempts, three usable reproductions, and one credible candidate integration**. These are proposed goals, not predicted conversion rates.

## 10. HN, Reddit, and Lobsters

### Hacker News

Show HN is appropriate only once someone can actually try the project. Link a runnable repo/demo, not a signup page or conceptual explainer. Current guidelines also prohibit generated text in submissions and generated/AI-edited comments; **the human author must write their own HN submission and discussion**. This report supplies facts and planning, not copy to paste into HN. Do not solicit votes, comments, or submissions. [Show HN rules](https://news.ycombinator.com/showhn.html), [general guidelines](https://news.ycombinator.com/newsguidelines.html).

Suggested factual title ingredients, for the author to choose and write: Sofort; agent-code microVM runtime; small Rust kernel; restricted Linux ABI. Keep startup numbers out of the title unless the timing boundary fits. The author comment should explain motivation, exact supported platform, what to run, the growth-mode distinction, comparisons, and unresolved limits.

HN is currently publishing a notice about temporary Show HN restrictions for unfamiliar/new participants. Account eligibility is not known here. Do not promise same-day placement or suggest circumventing restrictions. [Current notice](https://news.ycombinator.com/showlim).

### Reddit

- **r/rust:** a technical Rust article showing EL0/EL1, syscall implementation, unsafe boundaries, and differential testing is a better fit than an X launch screenshot. Current rules require Rust relevance and useful title context, discourage zealotry, and prohibit slop. Disclose authorship and write a community-specific explanation. [Rules](https://www.reddit.com/r/rust/about/rules.json).
- **r/osdev:** use an architecture/ABI question with code and tests, including the limits of ENOSYS behavior. Its rules endpoint returned no custom rules; that is not blanket permission for promotion. Read the current sidebar/stickies and recent moderation practice before submitting. [Rules endpoint](https://www.reddit.com/r/osdev/about/rules.json).
- **Agent-building communities:** only if the community currently allows project demos. Favor a real integration and setup instructions; verify its rules on the day. No claim was made here that any particular AI subreddit permits self-promotion.

Stagger these discussions because each deserves human attention, not because a delay manipulates ranking. Do not direct X followers into comment sections or post the same launch text into multiple communities.

### Lobsters

Submit an implementation article with durable technical value, not a funding/launch announcement. Likely relevant themes are virtualization, operating systems, Rust, and testing; choose only tags that actually exist in the submission UI. The author should disclose involvement and be prepared to discuss the design.

Current rules say new users in their first **70 days cannot submit self-promotion**, and self-promotion should be less than roughly a quarter of stories/comments over the past year. The community is invitation-based. If the author is ineligible, leave it alone; do not engineer a proxy submission. [Lobsters guidelines](https://lobste.rs/about).

## 11. Repo and demo readiness checklist

These are proposed follow-up changes, not edits performed by this researcher. “Required” here means necessary for the recommended credible launch, not proof of production safety.

### Before a public prototype launch

- [ ] Establish the public repo URL; `git remote -v` returned no configured remote during inspection. Replace every draft URL placeholder.
- [ ] Add/confirm a root project license and dependency/patch notices. Inspection found vendor/Lua notices, but no root project LICENSE or SECURITY file. Do not call the whole project open source until licensing is clear.
- [ ] Put “experimental prototype,” the exact supported host/guest architecture, and a first successful example near the top of the README.
- [ ] Supply clean-machine prerequisites and a documented path to build/use the patched libkrun. Explain virtualization permissions, Node, Rust/LLVM, oracle image requirements, and artifact downloads.
- [ ] Have one person outside the development checkout follow the exact instructions. Separate build/test prerequisites from the minimal demo path; a failed nested-Linux prerequisite must not be confused with a failed Mac demo.
- [ ] Produce a current dated status that reconciles FINAL, R5, stale README claims, and the frozen R4 ledger. Bind results to release source/artifact hashes.
- [ ] Recompute source-size/syscall counts on that revision; distinguish kernel runtime, tooling, owned product, vendored dependencies and upstream patches.
- [ ] Publish benchmark scripts, raw data, versions, host details, warm/cold endpoints, n, load gate, failure counts, excluded costs and comparator configuration. No unsupported p99 or Linux-metal claim.
- [ ] Make REPLAY/LIVE unmistakable in command output and video. Test what happens without model credentials. Do not substitute replay silently when live generation fails.
- [ ] Show a true missing-behavior probe. Label Lua's existing ENOSYS behavior accurately.
- [ ] Repair the planned/built and container/hardware claims in any launch visual. Keep the conceptual rg/SQLite/Cap'n Web demo off the working-feature reel.
- [ ] Document host-tool authority and cancellation. Include examples where denial works; clarify that noncooperative host effects can outlive guest termination.
- [ ] Document the MCP HTTP transport accurately: the README says loopback-only and **no authentication**. Use local stdio for the initial demo; this is not a hosted public endpoint.
- [ ] Provide a vulnerability-reporting route and a current explicit list of security gaps, including the Linux escape/full-final-matrix items that remain unverified.
- [ ] Verify demo output for accidental paths, credentials, provider data, and private tool output before recording/publication. Use declared synthetic demo tools/data.
- [ ] Add issue templates for reproduction details and small static-binary workload requests. Make it easy to report failure without joining a private chat.

### Useful soon after launch

- [ ] A task that benefits from the execution model, measured end to end against a realistic alternative; raw VM timing alone is not product value.
- [ ] A second native binary demonstrating a real newly required syscall contract, if available. Do not imply SQLite/rg support before verifying it.
- [ ] Independent Linux bare-metal measurements before a cost/density campaign.
- [ ] Updated footprint/RSS/PSS after loader changes, with hypervisor allocations distinguished.
- [ ] An explicit comparison matrix for capability, persistence, isolation, startup boundary, operational maturity and language compatibility; avoid a single winner score.
- [ ] Snapshot work only when measured; keep “≤1 ms” visibly a target until then.

## 12. Decision

The credible launch is a **working prototype with an unusual extension loop**, not a production sandbox service and not a finished just-in-time computer factory. The best asset is a short honest demonstration that links to an uncut run and inspectable tests. The best result is another builder reproducing it and supplying a workload.

Recommended root message: **“A throwaway computer for each agent code execution.”** Recommended reveal: **“The restricted kernel grows offline, with Linux as its oracle.”** Recommended ask: **“Run it, reproduce it, or show the smallest program that breaks the contract.”**
