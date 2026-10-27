# How to demo capsules

Research date: **2026-10-27**. Scope: demo research only; no product implementation, benchmarks, commits, or publication.

**Labels:** **F** = sourced fact, including measurements attributed to the Oct 25 spike; **M** = observation/measurement made during this research; **I** = interpretation or design recommendation; **E** = engineering estimate. Storyboards are **I**, not descriptions of a working product. All estimates assume one engineer familiar with the spike, eight-hour days, existing recording equipment, and a deliberately narrow prototype.

## Recommendation

**I — Flagship: “Close the laptop. The function finishes elsewhere.”** Make a **75-second prepared browser-to-server handoff**, observed from a phone. Show a closure, a cyclic object, and a typed-array checksum survive; show that the original browser Worker stopped; show that the program entry was evaluated only once. Say **“parked at a tool call”**, not arbitrary mid-instruction migration. The phone controls and observes the server; it does not execute the capsule in this version.

**I — Cheap teaser: “This file is a paused function.”** A **30-second export → close source → open in a fresh browser → supply reply → finish** recording. Use the spike's actual `42`/`cycle: true` workload. A local file is the first release; a hosted link is an optional wrapper. This is the smallest piece of evidence that carries the main idea.

**E — Both fit a week as a demo harness:** roughly **4–6 engineer-days combined**, including recording, with explicit day-one gates below. This does **not** include a production Wasm Backend, arbitrary programs, a distributed scheduler, transparent crash recovery, or a public untrusted-code service. The portability report estimates substantially more work for those contracts.

## What the Oct 25 spike actually buys us

**F — Primary local evidence:** [Oct 25 Wasm report](../portability/02-wasm.md), especially §§1–4; read-only raw archive at `/Users/noah/sofort-local-evidence/portability-wasm-2026-10-25/`. I inspected `bridge.c`, `snapshot.py`, `snapshot.json`, `restore.mjs`, `browser-test.html`, `replay.py`, and the restore/replay/Dynamic Worker result files. I did not rerun those measurements; they remain attributed facts here, not new **M** results.

| F: already demonstrated in the spike | Consequence for the demo |
|---|---|
| QuickJS 2026-06-04 compiled to a 966,584-byte Wasm reactor; minimal bridge exports include `init`, `eval_code`, `pump`, `reply`, memory and `__stack_pointer`. | Reuse the reactor and thin host adapters; do not rebuild the whole executor to shoot a prototype. |
| A Wasmtime-origin parked continuation resumed in Node, Chromium, local workerd, and a local Dynamic Worker. Two forks returned `42` and `100`, both with `cycle: true` and zero newly emitted requests on restore. | Cross-runtime restoration and branch divergence are evidence-backed. Browser-origin capture and actual remote/phone execution still need qualification. |
| Image: 2,097,152 raw memory bytes; 99,854 bytes gzipped; module SHA-256 `d239715db73722fecd733e0fa111626f47eafcb8067cfe189f596c42f0159df5`. Metadata also carries the stack pointer and pending request. | “About 100 KB compressed for this fixture” is honest. The module, envelope, journal and transport add bytes; “the whole product is 100 KB” is not. |
| Node restore-copy observations were 0.27–0.44 ms; copying was timed separately from compile, compression, network, persistence and policy. | Display freshly measured end-to-end handoff time. Never use 0.3 ms as the video’s transfer latency. |
| A controlled two-tool replay produced the identical result with zero external stub invocations. | A small replay demo has a foundation; a general time-travel debugger does not exist. |
| Only the small fixture was measured, at up to 128 retained instances in the density samples. Roughly 0.32–0.38 MiB incremental RSS per instance, plus runtime baseline. | Start a live pool at 32–128. Neither a million concurrent instances nor mobile density has been demonstrated. |

**F — Important code-level constraints:** the existing `reply(id, value)` bridge accepts an **integer**, and the toy bootstrap emits `test.echo`; arbitrary JSON tool replies need a bridge change. `browser-test.html` restores a pre-existing snapshot and prints JSON; it is not a browser capture/export UI and runs on the page rather than an isolated owner Worker. `snapshot.py` and `restore.mjs` have hard-coded `/tmp/portability-wasm` paths. The module hash in metadata is not itself proof that every host verifies it. These are small, specific demo tasks, not capabilities to mark “already done.” [Raw archive files above; report §1 and §3.1](../portability/02-wasm.md).

**F — The safe point is the key restriction:** the tool import returns synchronously, QuickJS's async continuation lives in its heap, and all Wasm frames must have returned before capture. Memory alone does not serialize an active Wasm stack, a network socket, host promise, or arbitrary V8 state. The exact module/build, relevant mutable globals and host protocol state must match. This design does not require JSPI. [Report §3.1–3.3](../portability/02-wasm.md).

**F/I — Keep the two tiers visibly separate.** This demo is QuickJS-in-Wasm with software isolation. It does not move a native jitk RAM image into V8, transfer Claude Code's Linux workspace, or snapshot a model provider's inference. Current [Backend](../../jitk/executor/backend.ts), [pool](../../jitk/executor/pool.ts), [executor](../../jitk/executor/executor.ts), and [selection](../../jitk/executor/select-backend.ts) are useful future seams, but do not expose a Wasm lifecycle backend today; they also import Node-specific facilities. [FINAL](../../FINAL.md) and the [Oct 27 Linux comparison](../../jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md) do not support a memory-win claim over Hyperlight. The older ambitions in [demo.md §9](../../../demo.md) are positioning inputs, not acceptance evidence.

## Recent demo examples: what to borrow, and what the evidence establishes

**F/M — Research method and limits.** Sources checked on 2026-10-27. I opened the official YouTube pages through the collaborative browser and inspected player metadata, visible caption snippets and chapters. Web fetching YouTube was throttled; browser screenshots timed out, so this is **not a frame-by-frame visual audit**. Durations below distinguish player media from rounded UI labels; an ad appeared on the Dagger page, so its content duration comes from the actual video's `videoDetails`, not the ad element. Performance counts are snapshots, not proof that editing caused engagement. No retention, conversion, or private X video-play analytics were available.

### Browserbase platform launch — April 7, 2026

**F — Primary examples:** [official launch](https://www.browserbase.com/blog/platform), [official film](https://www.youtube.com/watch?v=WJVtptcUoIQ), [original X post](https://x.com/pk_iv/status/2041518621290266632), and [launch contributor Kyle Jeong's account of making/distributing it](https://kylejeong.com/launches/browserbase-platform-launch-rebrand). The contributor records **1.7M X post views**, 741 likes and 861 bookmarks as observed October 13; he explicitly distinguishes post views from video plays. **M — YouTube player media duration: 66.081 seconds**, published April 7; visible opening captions introduce the product immediately. YouTube showed about **1.2K views** when inspected, demonstrating why X exposure must not be reported as YouTube audience.

**I — What works:** one short film tied to a specific developer problem, with one user journey carried through the launch assets. Borrow the roughly one-minute scope and clear opening promise. For capsules, make the first three seconds the closed laptop plus a still-live destination, rather than starting with compiler architecture. Captions must communicate that contrast without audio. The primary material does not establish that 66 seconds is universally optimal.

### Fly Sprites — video January 8; launch post January 9, 2026

**F — Primary examples:** [Chris McCord's official demo](https://www.youtube.com/watch?v=7BfTLlwO4hw), [Fly's launch post](https://fly.io/blog/code-and-let-live/), and [HN discussion](https://news.ycombinator.com/item?id=46557825). **M — Player media duration: 315.521 seconds**, UI `5:15`; published January 8. Chapters expose creation/configuration at **0:51**, deploying a web service at **1:44**, checkpoint/restore at **3:10**. The official page showed about **308K views** on inspection; HN showed **508 points / 189 comments**. Chris links his five-minute demo from the HN thread; a respondent specifically praises it.

**I — What works:** familiar terminal actions, a tangible running service, and checkpoint/restore demonstrated as an ordinary operation. Borrow the inspectable before/after, then put our distinctive restore much earlier. A technical five-minute walkthrough can accompany the short cut. The existence of a successful longer video is evidence against pretending every devtool demo must be 30 seconds. Its introductory handoff is appropriate to a walkthrough; it is not the opening to copy for our short feed clip. We must distinguish continuation migration from Sprites' filesystem restoration rather than imply Sprites invented nothing or cannot preserve useful state.

### Dagger Container Use — presented June 5; standalone upload June 28, 2025

**F — Primary examples:** [AI Engineer recording](https://www.youtube.com/watch?v=bUBF5V6oDKw), [Solomon Hykes' launch comment and HN discussion](https://news.ycombinator.com/item?id=44193933), and [Dagger's own narrated comparison demo](https://www.linkedin.com/posts/dagger-io_ever-had-an-ai-agent-overwrite-your-code-activity-7341240001726136320-vNnt). **M — Standalone content metadata: 1,427 seconds (23:47)**, about **12K YouTube views**; chapter “Live demo” begins **10:42**. HN's launch had **82 points / 17 comments**. The company demo transcript explicitly asks for two website themes in separate environments, opens the resulting URLs, examines changes, and merges a chosen version.

**I — What works:** parallel work becomes legible when you can compare results and choose one. This is the useful pattern for the fork candidate: a common parent, divergent outputs, an explicit selection criterion. Ten terminals spewing tokens are a weaker demonstration. The long conference introduction should be cut from a social version. Container Use is also a warning about differentiation: ordinary worktrees/containers can produce parallel results; capsules must prove that a shared *running continuation* was cloned after a costly prefix.

### Supplementary split-screen reference: Convex Chef, April 2025

**F — [Convex's own launch announcement](https://www.linkedin.com/posts/convex-dev_meet-convex-chef-activity-7316226511726858241-PsPu) explicitly describes split previews for testing multiplayer behavior and an embedded database dashboard.** This is a source for the product presentation mechanism, not evidence about that film's exact first three seconds, duration, or audience performance; I did not verify those. **I — Borrow split screens when the relationship itself is the proof:** two hosts sharing one checkpoint hash, or two copies receiving different replies. Avoid splitting into ten unreadable miniature terminals.

### Format decisions for our shoot

**I — Proposed production rules, not measured laws of virality:**

1. **Lengths:** 30-second teaser; 75-second flagship; optional uncut 3–5-minute evidence walkthrough. One transformation per short clip. No install sequence in the feed cut.
2. **First three seconds:** show the contradiction and name it in 6–9 words: “Laptop off. Same function. Still finishing.” Mark it **“Result preview”** if it is a cold-open excerpt from later in the same take. This prevents a teaser edit from masquerading as live chronology.
3. **Captions:** burned-in, high contrast, at most two short lines. Preserve `Wasm prototype` and `fixture tools` as readable badges. Put the important restriction next to the action, not in a tiny closing disclaimer.
4. **Split screens:** at most two large panes during the critical transfer. Keep a stable run ID and checkpoint hash suffix in both. An overhead phone/laptop view supplies physical evidence; the screen recording supplies readable details.
5. **Counters:** use host lifecycle/ledger events, never elapsed-time animation. Label `completed total`, `alive now`, `entry evaluations`, `external calls`, and `replay deliveries` separately. Publish the event log that drives them. I found no primary evidence here that a live counter itself caused launch success; it is a proof instrument for this product.
6. **Timing:** keep capture, durable acknowledgement, source destruction, destination restore and reply delivery continuous at **1×**. Any shortened setup or wait gets an on-screen `Cut: …` or `8× · … real elapsed` label. A screen recording of real software is still recorded footage; call it `Recorded run`, not a live broadcast.
7. **Delivery:** record a 1920×1080 master, compose large type for a separate 4:5 feed export, and inspect that crop on a phone. A forced vertical crop of desktop code will lose the proof. Put source/evidence links in the post and accessible receipt, not six closing QR codes.

## Five candidates, ranked

**I — Ranking considers clarity of the distinctive primitive, resistance to misreading, and credibility within one week.** It is not a benchmark-derived score. Standalone estimates overlap; do not sum them to price the shared week.

| Rank | Candidate / exact cut | Main proof | E: standalone build + shoot | Decision |
|---|---|---|---|---|
| 1 | **Pull the plug / 75 s** | Browser-origin continuation moves to a separate server; source is stopped before reply | 3.5–5 days | Flagship, gated on a real second host |
| 2 | **Share a paused function / 30 s** | A file transfers closure state into a fresh recipient instance | 0.75–1.5 days; about 0.5 extra day once shared harness exists | Cheap teaser; file first |
| 3 | **Fork at the decision / 60 s** | Ten children share one checkpoint and independently diverge | 2–3 days fixture; 4–6 with real model proposals | Best developer follow-up |
| 4 | **Replay the incident / 75 s** | Replay reproduces the failure with no external calls; one changed response creates a branch | 3–5 days for boundary-based viewer | Useful, easier to mistake for a trace UI |
| 5 | **A fresh capsule per item / 60 s** | Bounded pool runs many independently initialized items | 2–3 days at honest 10K scale; 3–5 with million-run evidence/time-lapse | Do not headline “a million computers in a tab” |

### 1. Pull the plug — 75-second candidate

**I — Exact storyboard:**

| Time | Shot / action / caption |
|---|---|
| 00–03 | Result-preview cold open: laptop shut, phone shows result. “Laptop off. Same function. Still finishing.” |
| 03–11 | `Earlier in this run`: laptop browser, six-line program and prepared task; `browser Worker` badge. Input nonce entered by presenter. |
| 11–20 | State panel shows closure capture, cycle identity, byte checksum; highlight `await tool(...)`. `Waiting for approval · no active Wasm frames`. |
| 20–29 | Click `Move to server`; actual capture/compression/upload; display bytes and matching hash at the server. Wait for durable ACK. |
| 29–38 | Source Worker termination acknowledged; source `alive now: 0`. Presenter closes laptop in an overhead shot. |
| 38–48 | Phone opens destination receiver. `Node server [host] · phone is controller`. Same run/hash and pending call ID; no guest program entry restart. |
| 48–60 | Presenter supplies approval reply on phone. Destination delivers it to restored guest; continuation computes its result. |
| 60–69 | Result nonce, closure result, cycle and checksum match. Counters: `entry evaluations: 1`, `approval requests: 1`, `reply deliveries: 1`. |
| 69–75 | “A running function, shipped as a file.” `Prepared handoff at a tool call · Wasm prototype · fixture tools`. Receipt/source link. |

**F → I — Existing/build:** portable heap restoration, exact module, integer reply and non-JSON object state already exist in the spike. Build browser capture inside a terminable Worker, envelope validation, receiver persistence + ACK, explicit ownership handoff, a host event ledger, a tiny mobile control page and the camera view. This uses the spike bridge, not the full production executor.

**I — Honest versus simplified:** actual Wasm continuation bytes cross hosts. The task and external tool are deterministic fixtures; no live model is necessary. Persistently label **`Agent tool program · synthetic data · fixture approval`**. The explicit handoff happens before the lid closes: **`Prepared handoff; not sudden-loss recovery`** at that action. A phone status page is not evidence of on-phone execution. Never say “unplugged in the middle of any instruction.”

**I — Wow:** source runtime is gone, yet an ordinary async function's closure and object identities continue after a supplied reply. **Failure/misread:** “It's just a remote job/status page” or “you serialized a workflow row.” Answer with browser execution before handoff, a fresh receiver that never evaluates the original entry, non-JSON state, a matching capsule hash, and inspection evidence. These are audit aids, not cryptographic proof that no dishonest implementation exists.

**E — Time:** 3.5–5 days including a recorded second-host run. If this cannot use an independent destination by day two, publish the file teaser and call the larger cut a portability experiment; do not stage an “unplug” where the supposed server is on the same sleeping laptop.

### 2. Share a capsule — 30-second candidate

**I — Exact storyboard:**

| Time | Shot / action / caption |
|---|---|
| 00–03 | A `.capsule` download beside highlighted `await`. “This file is a paused function.” |
| 03–08 | Sender's browser shows closure, cycle, typed array; click `Export`. Real compressed byte count, with `Runtime module cached separately`. |
| 08–13 | Source Worker terminated; close source tab. Recipient opens clean receiver in a different browser profile/window. |
| 13–18 | Drag actual file into receiver; inspect exact-build match and pending request. `Local execution in recipient Worker`. |
| 18–24 | Recipient types reply `19`; output becomes `42`, `cycle: true`. `Original entry evaluated here: 0`. |
| 24–30 | Open receipt: sender ran entry once; recipient restored bytes. “Send the state. Resume a copy.” `Prototype · fixture tool · exact runtime build required`. |

**F → I — Existing/build:** the archive already has `snapshot.bin` + `snapshot.json`, browser restore and the `19 → 42` result. Build browser-origin export, a compact versioned wrapper, file picker/drop target, local Worker restore, request inspection and a receipt. Optional hosted-link mode needs a small blob store/receiver; keep that off the critical path.

**I — Honest versus simplified:** real local computation, no server pretending to be a browser. A profile on the same machine is labelled **`Two browser profiles · same laptop`**; do not present it as a teammate on a different machine. Exporting a file creates a **copy**; it does not transfer global single-writer ownership. Label **`Copy/fork; original file remains resumable`**. Only a shipped module hash is accepted; this is not an arbitrary file execution service. There is no real business tool authorization in this fixture.

**I — Wow:** a downloadable object contains a suspended closure, rather than only code or chat history. **Failure/misread:** “It's a zip of JSON variables” or “it's a saved conversation.” Show function capture and cyclic identity on both ends, then link the format and fresh-instance loader. **E — Time:** 0.75–1.5 days standalone; about 0.5 incremental day on the flagship harness. Recipient-side mobile execution is a later, separately tested variant.

### 3. Fork a running agent ten ways — 60-second candidate

**I — Exact storyboard:**

| Time | Shot / action / caption |
|---|---|
| 00–03 | One parent becomes ten labelled children. “One running state. Ten possible next steps.” |
| 03–12 | One tool program preprocesses a synthetic route graph; `prefix executions: 1`; a closure holds its scoring function. Park at a decision tool. |
| 12–20 | Capture once; show one parent hash; click `Fork ×10`. Ten child IDs all reference that parent. |
| 20–34 | Supply ten fixed numeric route-choice replies. Two enlarged child panes reveal different local state/results; small grid is just overview. |
| 34–45 | Actual evaluator ranks feasible routes by displayed travel cost; show invalid candidates too. `Fixed candidate set · deterministic evaluator · simulated routes`. |
| 45–54 | Select the best-scoring child, stop the other nine, resume the winner to produce a draft route. `No external writes`. |
| 54–60 | Receipt: prefix ran once, ten independent restores, different outputs. “Branch the continuation, not just the prompt.” |

**F → I — Existing/build:** two forks with different integer replies and preserved closures are proven. Build a ten-child runner, per-child request/branch identity, independent limits, route fixture/evaluator, visible cancellation and output comparison. Ten-way density is small, but ten full agent harnesses have not been shown.

**I — Honest versus simplified:** label **`Agent search fixture · 10 fixed replies · no live model inference`**. This does not fork model KV caches or create ten different model thoughts automatically: cloned PRNG states also begin identical unless the host explicitly supplies different inputs. An optional real-model version obtains ten proposals through host tools and shows model latency/cost separately; no claim that it improves success rates from one cherry-picked run. All exploration is read-only/simulated; selecting a winner cannot undo writes already made by other children.

**I — Wow:** expensive prefix and live closure are reused without restart, and only the next input changes. **Failure/misread:** “Promise.all/worktrees can already do this” or “ten tries cost ten times the tokens.” Show `prefix executions: 1`, the parent checkpoint, and the real cost ledger. If the prefix is only 1 ms of toy work, the utility is visually weak; use real deterministic preprocessing and report its duration without inventing a performance comparison.

**E — Time:** 2–3 days for fixture + recording; 4–6 days with real proposal calls, response validation and a reliable evaluator. “Keep best” means best under the displayed metric, not generally the best agent.

### 4. Time-travel via replay journal — 75-second candidate

**I — Exact storyboard:**

| Time | Shot / action / caption |
|---|---|
| 00–03 | A red result becomes reproducibly red again. “Replay the failure. Call nothing twice.” |
| 03–13 | Run a three-call synthetic quote program; a malformed numeric quote selects the wrong route. Host records requests, replies and ordering. |
| 13–23 | Turn off the fixture service; enter `Replay`. Counters split: `recorded deliveries`, `external invocations`. |
| 23–36 | Fresh guest replays to the same bad result; external count stays zero. Show matching request/result digest and virtual time/PRNG state. |
| 36–46 | Scrub back to the preceding tool boundary; viewer reconstructs state by replaying from genesis or a qualified earlier checkpoint. |
| 46–59 | Click `Branch`; replace only the bad numeric response with a clearly labelled hypothetical value. Correct branch result appears beside original failure. |
| 59–69 | Journal diff shows one changed reply, parent/child branch IDs; external tools remain disabled. |
| 69–75 | `Replay at tool boundaries · hypothetical branch · no external effects reversed`. “An incident you can resume.” |

**F → I — Existing/build:** the controlled two-call deterministic replay already works. Build a persisted journal, strict request matching, recorded delivery ordering, a timeline viewer, checkpoint index or explicitly replay-from-start stepping, branch provenance and a deliberately faulty fixture. Virtual time and random source control must follow the actual QuickJS build; the spike found that its `Math.random` seed came through the clock.

**I — Honest versus simplified:** this is **tool-boundary replay**, not reverse single-stepping of arbitrary JavaScript. A highlight is a source annotation, not a captured debugger program counter. If stepping replays from genesis, show **`Re-executing against recorded inputs`**. A changed response starts a counterfactual branch; mark **`Hypothetical tool response`**, never silently rewrite the recorded incident. No transaction, email, payment or external fact is undone.

**I — Wow:** reproduce a failure offline, inspect its turning point, test a different world without touching live systems. **Failure/misread:** “It's a normal tracing dashboard” or “replay means effects are exactly-once.” Show a fresh instance completing from journal inputs while the external service is unavailable. Do not claim replay solves the effect-before-recording crash window. **E — Time:** 3–5 days for this controlled boundary-based viewer; a useful general debugger is a multiweek project, not the same estimate.

### 5. A fresh capsule per item — 60-second candidate

**I — Exact storyboard:**

| Time | Shot / action / caption |
|---|---|
| 00–03 | Live grid and large count. “10,000 inputs. A fresh runtime for each.” |
| 03–10 | Select a fixed synthetic dataset; click `Run`; `alive now ≤128`, `completed total`, `errors` are visible. |
| 10–22 | Completed total rises from actual verified receipts; grid cells represent recent completions, labelled `history`. |
| 22–34 | Zoom one item: fresh Wasm instance ID, QuickJS initialization, input digest and a result checked against an oracle. |
| 34–46 | Zoom out; show actual elapsed time and throughput. If unfinished, do not speed the counter to reach 10K. Use an explicitly labelled wait cut, or finish on the real current count. |
| 46–54 | Destroy all instances. `alive now: 0`; show main page still responsive. Do not interpret browser JS heap size as process RSS. |
| 54–60 | Download run receipts; `Cumulative executions · max 128 live · shared compiled module`. |

**F → I — Existing/build:** shared compiled module, small-instance measurements and fresh initialization exist in Node/Wasmtime; a benchmark retaining 128 instances is not this browser throughput demo. Build bounded scheduling in Workers, fresh instance/init for every item, independent state checks, an oracle, event-derived counters and result export. Reusing the compiled module is fine; reusing a dirty QuickJS heap is not a fresh capsule.

**I — Honest versus simplified:** label synthetic/trivial workload, host, runtime version, warm module cache and actual concurrency. **Reject the literal million-concurrent headline.** At the spike's small-instance RSS, a linear extrapolation alone would be roughly 330–375 GiB for a million resident instances, before other budgets; this is **E**, not a measured browser capacity. At the rough Node component sum of 0.3 ms/fresh instance, a million sequential creations would already take about **300 seconds before useful work** (**E**, not a throughput prediction). A 60-second million-run cut therefore needs a measured faster configuration or explicit time-lapse, not a fake live timer.

**I — Million variant:** if later measured, replace the title with **`1,000,000 executions · 128 max live`** and label every sped interval, real elapsed duration, failures and thermal/host conditions. Include the full uncut run and receipts. These are computers *over time*, not a million executing simultaneously, and certainly not a million LLM agents. No hardware-isolation badge or “nickel” claim.

**I — Wow:** visible creation/disposal with independent state at scale. **Failure/misread:** “This is just a JavaScript for-loop with a counter.” A tiny fixture actually makes that criticism reasonable; without a clear isolation/lifecycle need, it is a benchmark footnote. **E — Time:** 2–3 days at 10K scale; 3–5 for reliable million-run evidence, full recording and time-lapse. Rank last because the count distracts from portable continuations.

## Flagship production brief: the exact 75-second shoot

**I — Title:** “Close the laptop. Keep the function.” **Audience:** developers who assume browser execution disappears with the tab. **Single claim:** this exact QuickJS/Wasm program can park at a registered tool call, move its continuation bytes to a separate host, and finish without evaluating its entry again.

### Workload and proof plan

**I — Use one auditable agent tool program, not a complete agent product.** It reads a fixed synthetic quote dataset embedded in the program, builds a `Map`, a closure over the selected quote, a cyclic object and a typed-array checksum. It then makes **one** pending approval request through the bridge. Approval is integer `1`/`0`, keeping the existing reply ABI. After resumption it returns the retained computed draft and proof values, without making a business write. Keep dataset/preprocessing small enough not to obscure the handoff; do not deliberately add a slow loop to inflate the value of avoiding restart.

**I — Schematic guest shape** (a proposed fixture, not code implemented by this report):

```js
const quotes = buildSyntheticQuotes(presenterNonce);
const best = chooseQuote(quotes);
const retained = { best, nonce: presenterNonce };
retained.self = retained;
const finish = () => formatDraft(retained.best, retained.nonce);
const bytes = makeProofBytes(quotes);
const approved = await tool({ type: 'approval', draft: finish() });
return { draft: approved ? finish() : null,
         cycle: retained.self === retained, checksum: checksum(bytes) };
```

**I — Proof UI:** show only three big counters during the critical action: `source alive`, `entry evaluations`, `approval requests`. Put detailed checks in the expandable receipt: run/branch ID, module hash, checkpoint hash, memory size, compressed envelope bytes, pending request ID/digest, source and destination host, lifecycle timestamps, reply ID/delivery and output digest. The nonce is presenter-chosen at recording time and appears in both the parked request and final result. A hash establishes artifact identity, not absence of cheating; publish the thin capture/restore code and an uncut take.

**I — “Same line” wording:** the UI may highlight the known `await` source line using a fixture annotation. Caption **`Parked at this tool boundary`**. After reply, highlight the next statement only when its actual completion event arrives. Do not animate a pretend instruction pointer or claim an IDE debugger has attached to QuickJS.

### Shot list, narration, sound-off text and acceptance evidence

| Time | Framing / action | Voiceover or sound-off caption | Evidence / recording constraint |
|---|---|---|---|
| 00–03 | Overhead excerpt of closed laptop and phone's completed draft | “Close the laptop. Keep the function.” | Small `Result preview` label; from the later real take, not a different run. |
| 03–07 | Full browser screen, large run ID and `browser Worker`; type nonce | “It starts here, in the browser.” | `Earlier in this run` marks the cold-open return. No remote executor is started yet. |
| 07–12 | Run fixture; small code panel, state panel appears | “Ordinary JavaScript. A closure. A cycle.” | Host entry count increments exactly once. `Synthetic quotes · fixture tool`. |
| 12–19 | Approval request and source line held onscreen | “It pauses while waiting for a tool.” | Pump returned, no live Wasm frames; exactly one pending request. Do not snapshot just on receipt of `emit`. |
| 19–24 | Click `Move`; capture and transfer indicators derived from events | “Save its state. Send it to another host.” | Show actual envelope byte count and wall elapsed; no prerecorded progress estimate. |
| 24–29 | Server ACK and checkpoint/hash match | “The other host has the checkpoint.” | Receiver has validated module/ABI, durably stored bytes and ledger, but has not delivered a reply. |
| 29–34 | Source Worker termination, server ownership granted | “Now stop the original.” | Source termination acknowledged; receiver cannot run before that acknowledgement. One manual, supervised transfer only. |
| 34–38 | Physical camera: lid closes | “Prepared handoff. Original is stopped.” | No edit between server ACK, source stop and closure. Server/recorder must be independent of laptop. |
| 38–44 | Phone receiver page, explicit host badge | “The phone controls a Node server.” | Remote Node host identity visible; phone screen does not claim local guest computation. |
| 44–49 | Pending request and same checkpoint/hash visible | “No restart of the function.” | Destination loads pinned module, restores memory/global; QuickJS `init()` and original entry evaluation skipped. |
| 49–55 | Tap `Approve`, integer `1` sent | “Give the waiting call its answer.” | One ledger delivery for this request; reply uses restored promise resolver. |
| 55–61 | Draft appears; closure/cycle/checksum/nonce proof | “It continues with the state it had.” | Compare actual returned proof values to pre-capture values; do not substitute expected values in UI. |
| 61–69 | Two-pane receipt: original stopped / receiver completed | “One entry. One request. A different host.” | Same run lineage, source zero alive, one pending approval request, one reply delivered. No time compression in 19–61. |
| 69–75 | Freeze result plus concise final card | “A function small enough to ship as a file.” | `QuickJS/Wasm prototype · parked tool boundary · fixture tools`; link receipt and uncut run. |

**I — No hidden “wow” helpers:** a preloaded runtime is permitted and labelled `Runtime module cached`; model generation may happen before filming only if called `Recorded model-authored program`. Prefer `Fixed demo program` so the clip makes no model-authorship claim. The prototype must really compute both pre/post state. There is no reason to fake the migration, hide a receiver on the source laptop, or silently edit out failed transfers.

### Minimal handoff protocol for this demo

**I — Deliberately narrow and reviewable:**

1. Source Worker evaluates entry once and reaches exactly one registered pending call; host pumps all jobs and confirms quiescence.
2. Capture memory, exported mutable globals, exact module/ABI identity and the pending request. Freeze source; copy host queue/counter state consistently. Do not carry credentials.
3. Receiver validates the envelope, persists it and the pending-call ledger, then ACKs. Original remains frozen; receiver has no execution permission yet.
4. Source terminates its Worker and, only after acknowledgement of termination, grants the receiver the manual handoff token. Receiver instantiates the pinned module and restores bytes/global without QuickJS reinitialization. It waits for the phone's approval reply.
5. Receiver accepts a single reply under its run ID, rejects duplicate phone submissions, resumes and publishes result/receipt. Restore/format errors stop visibly; there is no automatic restart-from-source fallback.

**I — This proves a supervised move, not a fault-tolerant distributed ownership protocol.** If the source dies between termination and granting ownership, the demo stops for manual recovery. If the laptop dies before persistence ACK, the not-yet-saved work is lost. Keep these out of the claim by labelling prepared handoff, not by hiding them. A later real crash-recovery version needs lease/fencing semantics, crash-window tests and pending-effect ownership.

### Gates and week plan

**E — Shared implementation plan, 4–6 engineer-days total:**

| Day / effort | Concrete output and decision |
|---|---|
| Day 1 / 1 day | Run known archive restoration in a clean scratch harness; implement browser Worker capture and restore; verify a **new browser-origin** checkpoint restores into a **real separate destination host** with exact module and numeric approval. Test sender termination before reply. Record actual browser/server versions and CPU architectures. |
| Day 2 / 1 day | Envelope bounds/hash/build validation, receiver persistence + ACK, explicit freeze/terminate/grant flow and minimal ledger. Duplicate approval and malformed/wrong-build files fail visibly. No blanket claim of secure arbitrary upload support. |
| Day 3 / 0.75–1 day | Proof fixture, simple two-pane UI, phone control and receipts; verify checksum, cycle, closure and nonce. Expose no credentials or external writes. |
| Day 4 / 0.75–1 day | Shoot teaser with file path first; end-to-end latency and byte counts use current fixture values. Rehearse flagship on independent recording device and network. |
| Day 5–6 / 0.5–2 days | Ten consecutive handoff rehearsals with state/counter assertions; at least three physical laptop closures; record continuous take, captions and feed crop; publishable evidence bundle ready. A clean cut is packaging, not an excuse to skip failed-run accounting. |

**I — Day-one stop rule:** if browser-origin capture is unreliable, file a precise finding and use **`Wasmtime-created checkpoint → browser restore`** as the teaser, visibly labelled. That still exercises the proven direction. If remote cross-ISA restoration fails, use a genuinely separate same-ISA host and label both architectures, or drop the unplug claim. Local workerd is never relabelled “Cloudflare edge.” Actual mobile execution can replace the server later only after that phone/browser is tested.

**I — Delivery gate:** all ten rehearsals must preserve proof state, avoid entry restart and duplicate request dispatch, and correctly stop the source. A failure means fix and repeat the set; report the earlier failure in engineering notes. No p99 latency claim from ten runs. Record cold-cache behavior separately, or explicitly say the module was cached.

## Teaser production brief: the exact 30-second shoot

**I — Title:** “This file is a paused function.” Use **the original small spike workload**, not the new quote fixture, so the teaser is inexpensive and unmistakably narrow. A closure adds 7, a typed array contributes 5, a `Map` contributes 11, and a user reply of 19 produces 42; the cyclic object still points to itself. [Original workload and results](../portability/02-wasm.md#31-preferred-path-quickjs-heap-continuation-empty-wasm-stack).

| Time | Exact image/action | Caption / proof |
|---|---|---|
| 00–03 | Two large panes: sender parked at `await`, actual downloaded capsule file beside it | “This file is a paused function.” `QuickJS/Wasm prototype`. |
| 03–06 | Click `Export`; real size badge from created bytes | “Closure + heap + pending call.” `Compressed state; module separate`. Do not hard-code 99,854 for a new browser capture. |
| 06–10 | Terminate source Worker; close sender tab | “Original stopped.” Host event confirms termination, rather than relying on tab disappearance. |
| 10–14 | Open receiver in clean profile, drop the exported file | “Fresh instance. Local browser execution.” Show `same laptop / separate profile` if so. |
| 14–18 | Module/ABI and checkpoint identity accepted; pending request displayed | “Resume a copy at the waiting call.” `Exact runtime build required`. |
| 18–23 | Type `19`, click `Reply`; actual result arrives | `answer: 42` / `cycle: true`. Receiver has not evaluated original program entry. |
| 23–27 | Receipt expands: closure/cycle tests, module hash, receiver entry count `0` | “The function wasn't restarted.” Host loader/entry events supply the counter. |
| 27–30 | Both panes freeze, file and source/evidence link remain | “Send the state. Resume a copy.” `Fixture tool · copies can both resume`. |

**I — Recording:** one continuous 1× screen recording; no cold open and no cut needed. Cached module labelled for all 30 seconds. Use 28–32 px equivalent text in the 1080p master and check the mobile crop. No narration required; a single spoken sentence can mirror each caption. Keep exact bytes and hashes in the receipt, not as five competing headline statistics.

**I — File versus link:** ship the local file version within the week. A hosted link simply retrieves this same envelope and restores it locally; show a destination execution-host badge, and, if rehearsed, demonstrate it can finish after the file/module have loaded with networking disabled. A link to an already-running server job is a different demo and must be called that. The file may contain data from guest memory; this fixture includes only synthetic data. No claim that sharing it grants access to the sender's tools. Resume binds fresh fixture-only capabilities.

**I — Acceptance:** source is stopped; recipient instance is new; module/ABI checked; imported file bytes hash matches export; guest entry evaluations on recipient remain zero; integer 19 produces actual 42 and `cycle: true`; no original request is emitted again. Include a second uncut evidence run with reply 77 producing 100 to establish branching rather than a hard-coded answer. Byte sizes may differ from the Wasmtime-origin archived image.

**E — Incremental effort:** about half a day after browser capture/restore and receipt work; up to 1.5 days standalone. If polished file sharing starts exceeding that, remove link hosting and keep download/drop. The file itself is the compelling object.

## Claim boundaries to keep in the edit

**I — These exact on-screen labels resolve the likely objections:**

| Potential claim | Required wording / visible evidence |
|---|---|
| “An agent survived my laptop dying.” | `Prepared handoff at a tool boundary`; source terminates after durable ACK. Sudden-loss recovery is a later demo. |
| “It runs on my phone.” | `Phone controls Node server` for flagship. Only say `Executes on phone` after that device/browser actually restores and runs it. |
| “Same line.” | `Parked at this tool call`; source line is annotated. No arbitrary Wasm PC/stack capture implied. |
| “Whole computer, 100 KB.” | `Compressed state for this fixture`; show runtime module separately and measure total envelope/network bytes. No Linux or full V8 snapshot implied. |
| “10 agents.” | `10 forks of one tool program`; model requests and costs separate. Fixed candidates/fixtures labelled. |
| “Time travel.” | `Replay at tool boundaries`; recorded inputs versus hypothetical branch distinct. No reversal of external effects. |
| “A million computers.” | `1,000,000 cumulative executions; max N alive`; real elapsed time and time-lapse factor. Never simultaneous capacity. |
| “Secure/hardware isolated.” | `QuickJS/Wasm software isolation · prototype`; no badge borrowed from jitk's hardware tier. |
| “No re-execution.” | `Original entry not re-evaluated during snapshot restore`; deterministic replay, if used elsewhere, explicitly does re-execute guest computation. |

## Five-line TL;DR

1. **I:** Lead with a 75-second prepared browser-to-server handoff: close the laptop only after checkpoint ACK and source termination.
2. **I:** Release a 30-second file-resume teaser first; a preserved closure/cycle is more distinctive than a giant live counter.
3. **F:** Oct 25 proves parked-state restore/forks and a small replay fixture; browser-origin capture, remote ownership and sharing UI remain to build.
4. **E:** A thin, labelled demo harness plus both recordings is 4–6 engineer-days; production durability and a general agent runtime are outside that estimate.
5. **I:** Borrow inspectable before/after and result comparison from Browserbase, Sprites and Dagger; separate observed engagement from guesses about why a video worked.

**Verdict — GO-WITH-CHANGES:** strong demo angle, provided “pull the plug” becomes an honestly labelled prepared handoff and the million-concurrent implication is removed. The week buys a convincing research prototype, not production crash recovery.

**The three things I would do next:**

1. **I:** Qualify browser-origin capture → separate Node host on day one, with exact-build checks, preserved closure/cycle/checksum and source termination before reply.
2. **I:** Build the shared envelope/ledger and local file receiver; record the 30-second teaser and two reply variants with downloadable receipts.
3. **I:** Shoot the 75-second physical-laptop handoff only after repeated clean rehearsals; publish an uncut evidence run alongside the captioned cut.
