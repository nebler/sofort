# Sofort demo concepts: visual spectacle with receipts

Date: **2026-10-25**. Role: design sub-agent; angle: the first three silent seconds.

**Winner: “A computer for every program.”** A wall of disposable computers becomes a close-up of one actual JS program, its host-tool calls, its validated result, and its destruction. Then the camera pulls back into the wall. Make the counter real; make the picture beautiful. This communicates the working product without requiring a new compatibility breakthrough or an unfair sandbox race.

This is a production proposal, not a recording or a new benchmark. Shareability judgments and hour estimates are editorial/engineering estimates, not predicted engagement. All five concepts are alternatives; produce the winner first, then the offline-growth follow-up. Nothing was posted, scheduled, committed, or sent to anyone. Only this report was written; existing project files were not changed.

## Evidence and feasibility

Mandatory reading completed: [value audit](01-value-audit.md), [hosting landscape](02-hosting-landscape.md), [agentic coding](03-agentic-coding.md), [scale and economics](04-scale-and-economics.md), and [Twitter pitch](05-twitter-pitch.md). Their verified claims are the starting point, not numbers independently reproduced here.

I also inspected [idea.html](../../viz/idea.html), [demo.html](../../viz/demo.html), both scene files, [engine.js](../../viz/engine.js), [build.py](../../viz/build.py), the [top-level Makefile](../../jitk/Makefile), the grow controller/demo and stored receipts, executor example, pool/backend/executor interfaces, MCP core/providers, and benchmark definitions. The shared checkout already has implementation changes from other work; source observations describe this inspection, and historical measurements retain their original artifact boundaries. I did not run `make demo`: it builds/writes artifacts, and the growth path creates temporary Git commits and updates release pointers. Read-only inspection was sufficient for this design brief.

### What can supply real pictures today

| Existing asset | What is actually there | What the video still needs |
| --- | --- | --- |
| `arch/viz/engine.js` + scene sources | SVG boxes, grids, labels, arrows, flowing dots; scene navigation; staggered reveals; debug layout mode | Event-driven lifecycle rendering, a trace clock, camera/zoom framing, mobile composition, controlled video cue timing |
| `arch/viz/build.py` | Inlines shell, engine and scene source into standalone HTML | A new output/scene in a production copy; never overwrite the existing explainers for this brief |
| `executor/examples/demo.ts` | One snippet calls two **synthetic** `github.listIssues` callbacks concurrently; each callback waits 5 ms; result validation, maximum-active count and timing hooks | Visually legible trace; repeated execution driver; lifecycle identities; clearly labeled fixture data |
| `executor/pool.ts` | Fresh allocation, bounded refill, snapshots of pool counts, `kill`/`reaped` callbacks, `drain()`/`close()` | Complete birth→use→result→reap trace and cross-event correlation; counts must distinguish unused warm VMs |
| `executor.ts` / `backend.ts` | Timing events include acquired, RUN sent, first call/return, done and resolve; sandbox `exited` promise | A demo adapter that maps events to a unique host-assigned VM identity; no public PID accessor is promised |
| `mcp/` | Official SDK stdio client/server, `execute`, tool resources, warm pool; demo math and host-memory KV tools | A recorded MCP interaction; useful read-only fixture provider if going beyond math/KV; tracing into the server pool |
| `grow/loop.py` and `demo.py` | Deliberately delete handlers in a disposable kernel copy; discover real misses; REPLAY or actual model generation; bounded Linux differential checks; manifests; fresh QuickJS/Lua executions | A concise visual translation of the receipts; one persistent mode/time label; live generation only if actually captured |
| `bench/` | Validated raw/executor cases, explicit lifecycle definitions, strict Hyperlight adapter and stored measurements | A paired comparison presentation with all boundaries visible; fresh measurements if making present-tense speed claims |

The viz engine is an **explainer**, not telemetry. Its dots move at illustrative speeds, its Play button advances every 8.5 seconds, and the source grid merely highlights chosen indices. None of those motions currently proves execution, latency or VM count.

`make -C arch/jitk demo` delegates, in order, to executor demo, grow controller, and grow presentation. The grow default is REPLAY. `grow/demo.py --live` does fresh preparation **before** its paced presentation; `--fast` removes presentation pauses, not generation time. The current controller explicitly removes `ppoll` and both signal-handler modules from a temporary copy. This is regrowth, not discovery of an unprecedented workload.

Read-only tool inventory on this Darwin/arm64 host: Node, Docker CLI, Codex CLI, Cargo and Clang are on PATH. **FFmpeg, ffprobe and asciinema are not on PATH.** That does not establish that Docker is running, the oracle image exists, virtualization is available, model authentication works, or all build dependencies are ready. No installation or VM test was performed here.

### Numeric vocabulary for every concept

| Number allowed in an evidence card | Required nearby label | Source |
| --- | --- | --- |
| 0.285 ms, rounded 0.29 ms | Historical p50, raw parked one-tool, already READY, Mac arm64, n=30; RUN→validated done; boot/refill/TS/MCP excluded | [quiet benchmark](../../jitk/bench/RESULTS-quiet-2026-10-24.md) |
| 2.106 ms, rounded 2.1 ms | Historical p50, warm local stdio MCP one-tool, Mac arm64, n=30; SDK call→validated result; prepared pools and running server | [MCP measurements](../../jitk/mcp/RESULTS.md) |
| 9.241 ms return-only / 9.597 ms one-tool | Historical p50, cold executor, Mac arm64, n=30; running executor, prebuilt cached artifacts; no Node startup or image build | [watchdog rerun](../../jitk/bench/RESULTS-native-watchdog-2026-10-24.md) |
| 6.544 vs 63.209 ms | Historical p50, raw parked synthetic 10×5-ms tool fixture, Mac arm64, n=30 per arm; whole tested integrations, Bellard QuickJS vs quickjs-ng | [quiet benchmark](../../jitk/bench/RESULTS-quiet-2026-10-24.md) |
| 683.721 VM/s | Historical p50 **READY + kill/reap refill**, eight concurrent builders, Mac arm64; not useful executions/s, core count, live concurrency or fleet capacity | [quiet benchmark](../../jitk/bench/RESULTS-quiet-2026-10-24.md), `bench/run.py:refill` |
| 24 syscall slots | Numbered dispatch slots, restricted contracts, aliases and ENOSYS stubs included; not 24 full Linux implementations | [slots.json](../../jitk/kernel/slots.json) |
| 30/30 growth checks | Repetitions of a named bounded probe in fresh VMs; not thirty different semantic cases or a security proof | [growth controller](../../jitk/grow/loop.py) |

All historical cards must say **2026-10-24 measurement**, identify their run/artifact in companion receipts, and remain visually separate from a new take's measurements. Never add independently measured medians into a synthetic total. A current recording's counters must be derived from that take, not from this table. No Linux bare-metal number exists here. Snapshots, per-task image assembly, Cap'n Web and tool-backed files remain planned.

## Ranking

Rank reflects this brief's priority: silent visual impact, clarity of working behavior, evidence quality, and production feasibility. It is not a quantified virality model.

| Rank | Concept / duration | Why this position | New engineering + production, working toolchain |
| --- | --- | --- | --- |
| **1** | **A computer for every program — 32 s** | Dense motion, an intelligible object, a useful close-up, and verifiable disposal; strong broad launch | **14–20 h** |
| **2** | **One red syscall — 40 s** | Most distinctive research reveal; excellent systems follow-up; regrowth/mode caveats take screen time | **8–13 h replay; 11–19 h fresh live capture** |
| **3** | **Ten doors open at once — 28 s** | A readily understood concurrency picture; good agent-builder teaching; less unique | **7–11 h** |
| **4** | **The computer that forgets — 26 s** | Clear before/after and authority boundary; less visually dense, easy to overclaim security | **6–10 h** |
| **5** | **The race with the fine print in the picture — 36 s** | Highly quoteable; comparative framing can swallow the product and requires careful methodology | **10–16 h using existing receipts** |

These are separate estimates for one experienced builder/editor, including their own capture/edit/QA. Do not add them together to estimate a shared campaign. Allow **2–6 additional hours** to provision/validate missing production tools and runtime prerequisites; growth/oracle failures can exceed that. A new fair Docker/Firecracker/E2B performance campaign is a separate **1–3+ engineer-day** investigation, not included in concept 5.

## 1. A computer for every program — winner

**Three-second hook frame.** A near-black field fills with crisp cyan squares; each becomes a green receipt mark and falls into a dim history grid. A huge counter climbs under **“Computers used for this video.”** Under it, always readable: **“Each tile: one completed program. History, not simultaneous VMs.”** Open with actual events from the start of the take; no invented starting count, synthetic particle multiplier, or promised rate. Even a modest measured rate can look dense through cumulative history and good composition.

**Visual identity.** An industrial instrument, with warm-white condensed display type, restrained monospace receipts, cyan for live guests, lime for validated completion and a fading outline for confirmed reap. Completed history remains quiet enough to make the active band legible. Failures use a separate red mark and a visible failure count. No audio is necessary to understand the transformation.

| Time | Shot / action | Exact principal on-screen text |
| --- | --- | --- |
| 0–3 s | Real lifecycle events create and retire tiles. Counter derives from RUN-sent events of distinct consumed VMs. Thin separate legend explains the history wall. | **A computer for every program.** / `Computers used for this video: {observed}` / `Recorded local execution · real-time trace` |
| 3–7 s | Pick one actual tile. Enlarge it while its neighboring history recedes. Reveal a compact `Promise.all` snippet using the existing two-repository issue fixture. | **One program. Multiple tool calls.** / `Synthetic issue data · QuickJS in guest` |
| 7–12 s | Split view: guest on left, trusted host on right. Two actual callback intervals overlap; returned fixture records collapse to `{total: 2}` only if validated. | **Tools execute on the host.** / `2 concurrent fixture calls` only if the observed maximum is two |
| 12–17 s | Hold the selected VM's real receipt: result, disposal request, confirmed exit/reap. No spark extinguishes before the corresponding event. | **Result returned. VM discarded.** / `Result validated → kill requested → reaped` |
| 17–22 s | Show a short actual MCP `execute` call/result as an access-path insert. Freeze the wall count during the insert; identify this as a separate take. | **An agent reaches it over MCP.** / `Separate MCP take · local stdio · same execution model` |
| 22–28 s | Return to the first take's continuous timeline, continuing exactly where it paused. Pull out to the cumulative receipt wall; show consumed, validated, reaped, failed and actual peak live separately. | **Every completed tile has a receipt.** / `History ≠ resident machines` / `trace replay · original timing` |
| 28–32 s | Stop admission, drain and close. Match the used-VM and reaped-used-VM counters, or show the discrepancy. End on the actual recorded totals and a verified repo/demo URL when one exists. | **Throwaway computers for agent tool code.** / `Experimental macOS prototype` / `Trace + exact workload + uncut take` |

The elapsed wall clock pauses with the timeline during zoom/hold inserts. During the MCP insert it is explicitly a different take. Never portray the final number as all VMs created in 32 seconds of uninterrupted footage: the receipt states the original run duration and edit map. A simpler first cut may omit the separate MCP insert and spend those seconds on the existing executor snippet; the tweet can still describe the implemented MCP interface accurately.

**Tweet copy**

> Every bright tile ran a JS program in its own throwaway microVM. Then that VM was discarded. I built Sofort for agent tool code: tiny Rust kernel, host-controlled tools, MCP. This is a recording of real local runs; the grid shows history.

**Why people might share it.** The wall creates scale as a visible texture; the close-up answers “does each square do anything?” before a skeptic asks. Agent builders can explain the per-program execution unit; visualization/tooling people can appreciate the instrument; VM engineers can inspect the receipt model. Topical readers include the Next Token/code-mode audience and practical runtime explainers such as Simon Willison or Armin Ronacher, as identified in report 05. This is a relevance hypothesis, not an endorsement or an outreach plan.

**Honesty risk → defusing it.** A grid naturally implies simultaneous density, “born now,” or a benchmark. Call it **execution history** in the hook, distinguish READY from RUN, show peak actual live count, and describe the take as instrumented demonstration rather than a quiet performance test. If screenshots linger for readability, add “visual hold; actual duration in receipt.” The large counter counts consumed program VMs, not unused pool refill, failed startup attempts, host-tool calls, or warmup executions. Replace “computers created for this tweet” with the more defensible “computers used for this video.” Never derive a thousands/s claim from 0.29 ms or the refill result.

**Effort.** Existing: VM lifecycle, timing hooks, two-call fixture, pool disposal callbacks, SVG design language, MCP path. New: correlated JSONL trace/driver **4–5 h**; event wall, close-up and cue controller **4–6 h**; readable fixture/MCP capture **1–2 h**; recording/edit **3–4 h**; count/reap/mobile QA **2–3 h**. Total **14–20 h**, plus prerequisites. No kernel feature work is required.

## 2. One red syscall

**Three-second hook frame.** A compact syscall board surrounds an oversized red `ppoll` tile. Next to it a real missing record pulses: `ENOSYS`. A white `reply:ping` output outline stays empty. The caption is explicit from frame one: **“We removed this handler. Watch it grow back.”** A second line says **“Offline regrowth · REPLAY”** or **“Offline regrowth · recorded LIVE generation.”** This deliberately trades a bigger fantasy for a stranger, defensible research demonstration.

| Time | Shot / action | On-screen text |
| --- | --- | --- |
| 0–3 s | Board + actual missing record. Display only real slot names/statuses from the chosen seed image. | **One missing syscall.** / `ppoll deliberately removed in a disposable copy` |
| 3–8 s | Cut to the missing-handler discovery output and frozen relevant probe behavior; retain the mode label. | **The workload asks for behavior the seed lacks.** |
| 8–14 s | Linux strace output aligns beside its normalized probe result. Visually connect the matching fields. | **Linux is the oracle for this bounded probe.** |
| 14–22 s | One-file proposal arrives. Show an actual source diff, not typewriter-generated imaginary Rust. Build stage completes at its real receipt time. | **An agent proposes a handler offline.** / `REPLAY: recorded proposal` or `LIVE generation recorded · elapsed time compressed` |
| 22–29 s | A strip of fresh-VM checks becomes green from actual acceptance entries. | **30 fresh VMs. Same bounded probe.** / `Not full Linux conformance` |
| 29–35 s | `reply:ping` appears from the actual post-regrowth QuickJS run. Replace the red tile with a checked restricted-contract tile; manifest/hash appears. | **The behavior returns. A versioned image records it.** |
| 35–40 s | Zoom out to show fixed deployed image on one side and offline development loop on the other. | **Grow offline. Execute a fixed image.** / `Lua already ran with ENOSYS defaults` / `Prototype · exact probe + receipts` |

**Tweet copy**

> We removed ppoll from a tiny Rust kernel. An agent proposed the handler offline; fresh VMs checked a bounded probe against Linux. Then QuickJS replied again. Sofort's kernel-growth experiment, with the mode and real elapsed time shown.

**Why people might share it.** A red OS primitive turning into source, evidence and a working response is a compact causal story. Rust/OS developers, testing researchers and AI coding evaluators can quote it to discuss where generation should stop and validation should start. The likely valuable reaction is an argument about oracle/test scope, supported by inspectable artifacts. Prior-art-aware systems writers in report 05 are a stronger audience than generic “AI built an OS” accounts.

**Honesty risk → defusing it.** The controller deliberately deletes existing handlers; do not say “a tool this kernel has never run.” The main before/after is `ppoll`, not Lua. Both signal profiles return ENOSYS and compare against ENOSYS-injected Linux. Do not light up three tiles as three new full implementations. Thirty repeated fresh-VM checks do not equal thirty semantic cases or prove security. Persistent mode label survives every crop and cut.

There are usable archived receipts: `grow/results/run-20261024T141804/report.json` is **replay**, with approximately **16.627 s** total preparation in that recorded run. `grow/results/live-demo-1792810727825896000/report.json` is **live**, with approximately **402.229 s** total preparation under contention. These were read, not rerun. If using that live archive, say **“Archived live run · 402.229 s preparation · edited excerpt”**, and use its corresponding output/hash only. Do not combine its live badge with the faster replay receipt. An archival render should say “visualization of archived receipts”; show an actual terminal recording only if one exists.

**Effort.** Existing: the complete controlled regrowth, native oracle, accepted diffs, repetitions, manifests and archived live/replay data. New: structured timeline extraction **2–3 h**; syscall/source/oracle visualization **3–4 h**; capture/edit/QA **3–6 h**. **8–13 h** for honest replay/archive presentation; **11–19 h** for a newly captured live attempt, plus prerequisites and possible failed-generation/debug time. A genuinely new useful syscall that enables a previously unsupported workload is a separate research task, estimated **1–3+ days**, and is unnecessary for this concept.

## 3. Ten doors open at once

**Three-second hook frame.** Ten vertical cyan shutters open together while an amber staircase opens one shutter at a time. One big code change in the center: **`for…await` → `Promise.all`**. Both sides say **“Sofort / same host tools.”** This is a concurrency demonstration within the working runtime; it needs no competitor logo.

| Time | Shot / action | On-screen text |
| --- | --- | --- |
| 0–3 s | Preview the actual paired traces as shutters/staircase. If replayed slowly, label it immediately. | **One at a time. Or together.** / `Trace replay · uniformly slowed` |
| 3–7 s | Show ten independent read-only synthetic lookups with the declared delay. Use a deliberately visible delay, e.g. 200 ms configured per callback. | **Same synthetic tools. Same results.** / `Configured delay, not measured internet latency` |
| 7–13 s | Sequential guest snippet, one active host interval at a time. A receipt clock shows actual measured duration rather than a target. | **Sequential awaits** / `elapsed: {actual}` |
| 13–19 s | Same inputs in a fresh VM; `Promise.all` produces genuinely overlapping host intervals. | **Parallel awaits** / `max active: {observed}` / `elapsed: {actual}` |
| 19–24 s | Both outputs align. Zoom into the host/guest line to show where callbacks ran. | **The guest coordinates. The host performs I/O.** |
| 24–28 s | Both consumed VMs are confirmed reaped. Compact snippet/interface ending. | **Async tool calls across a hardware VM boundary.** / `Sofort · experimental runtime` |

The proposed 200-ms setting is a **fixture configuration**, not an existing measurement. It is chosen for visibility and has to appear on screen as synthetic. If using the repository's existing 5-ms fixture instead, replay both traces at the same declared scale; human-visible shutters must not be sold as real-time API durations. Derive any ratio from paired current results; do not print a theoretical “10×” or carry over the historical Hyperlight ratio.

**Tweet copy**

> This is the same Sofort VM runtime on both sides. Left: await each tool. Right: Promise.all. The generated JS runs in a disposable hardware VM; the host tools really overlap. Synthetic delays are labeled. No faster-agent claim hiding in the animation.

**Why people might share it.** A staircase versus a simultaneous curtain is readable without systems knowledge. Framework educators, TypeScript developers and code-mode builders can use it to explain useful agent-generated control flow. It connects most directly to the Cloudflare/TanStack/Rhys Sullivan audience described in report 05. The fact that this works across a VM boundary supplies the systems reveal.

**Honesty risk → defusing it.** `Promise.all` is established, not a Sofort invention. Same-runtime arms isolate a programming-model change, not a kernel advantage. Long synthetic waits can hide executor overhead; show actual total timing and call the experiment a concurrency demo. This does not measure avoided model turns, token savings or real API performance. Keep tool providers fixed and outputs identical.

**Effort.** Existing: actual overlapping callbacks, `Promise.all`, validated fixture, timing hooks and host-only tool channel. New: paired ten-call driver/provider **2–3 h**; interval/shutter visual **2–3 h**; capture/edit/QA **3–5 h**. **7–11 h**, plus prerequisites. A useful real read-only provider is optional follow-up work rather than an implied supported integration.

## 4. The computer that forgets

**Three-second hook frame.** A giant guest variable `globalThis.note = "HELLO"` appears inside a cyan machine. The whole machine is stamped **REAPED** and collapses. A second machine reads **`typeof globalThis.note → "undefined"`**. A small persistent caption says **“Guest globals reset; host tools may retain state.”** Use a harmless marker, not an actual password or credential.

| Time | Shot / action | On-screen text |
| --- | --- | --- |
| 0–3 s | Condensed preview of real write/destroy/read receipts. Give the two consumed VMs distinct host-assigned identities. | **This computer forgets after one run.** |
| 3–8 s | Execute a real snippet that sets a guest global and returns its value; show validation. | `globalThis.note = "HELLO"` / **Guest-local state** |
| 8–12 s | Actual reap acknowledgment extinguishes VM A; allocate/acquire another never-consumed VM. | **That VM is gone.** |
| 12–17 s | Read the global in VM B and validate the returned type string. | `return typeof globalThis.note` / `"undefined"` |
| 17–22 s | Show an allowed read-only fixture call and a deliberately ungranted operation. Hold the host denial receipt. | **External effects pass through host policy.** / `Denied call · provider invocation count: 0` only if observed |
| 22–26 s | Frame the host store outside the VM boundary; keep it visible while guest boxes disappear. | **Disposable guest. Explicit tools.** / `Host state can persist · finite demonstration, not a security proof` |

**Tweet copy**

> Write a guest global. Finish. Discard the VM. The next program gets a fresh computer and can't read that global. Sofort runs agent JS with host-controlled tools. Host providers can retain state; this demonstrates guest freshness, not proof against every escape.

**Why people might share it.** This turns an abstract lifecycle guarantee into a recognizable magic trick. Security educators and agent-platform engineers can explain the trust unit with one GIF-sized sequence. Sandbox skeptics may quote it to distinguish guest state from host state; the diagram already acknowledges that distinction.

**Honesty risk → defusing it.** `undefined` alone proves little—fresh JS contexts can also do that. Pair it with actual distinct sandbox identities and confirmed destruction; do not claim superiority over isolates. The `kv` provider explicitly retains state in the server process, so avoid “the entire system forgets,” “secure erasure,” or “no cross-run leakage possible.” An omitted/unknown tool may produce an ordinary missing-binding error, rather than a host-policy denial. For the denial shot, register a demo binding whose host grant is intentionally denied and verify the provider was never invoked; show the actual error taxonomy. The current MCP layer has no approval UI; approval-required calls fail closed. Do not animate an approval flow it lacks.

**Effort.** Existing: disposable VMs, policy checks, guest globals, MCP error mapping and host KV as an explicit counterexample. New: paired freshness/denial driver with receipts **2–3 h**; dramatic box/text transitions **2–3 h**; capture/edit/QA **2–4 h**. **6–10 h**, plus prerequisites. Host-identity tracing can be reused from the winner.

## 5. The race with the fine print in the picture

**Three-second hook frame.** Two lanes begin together: one splits into ten overlapping host-call bars, the other becomes a staircase. A huge result reads **“6.5 ms / 63.2 ms”**, but equally legible directly below it: **“Historical raw parked tool fixture · whole-stack comparison.”** The full tested lane names appear in the first frame: **Sofort / jitk** and **tested synchronous Hyperlight-JS bridge**. No generic Hyperlight ecosystem verdict.

| Time | Shot / action | On-screen text |
| --- | --- | --- |
| 0–3 s | A measured-duration lane animation from the existing receipt values. Do not fabricate call-interval telemetry if the artifact only contains totals. | **When ten host tools can overlap.** / `Oct 24 benchmark visualization · not live` |
| 3–9 s | Show the shared synthetic task and exact warm/parked lifecycle. If intervals are illustrative, identify them as schematic. | `Promise.all(10 × 5-ms host tools)` / `Schematic call overlap; measured totals` |
| 9–16 s | Readable finish markers: 6.544 / 63.209 ms p50, n=30 each, Mac arm64; explain bridge behavior. Replay both at a common stated time scale. | **Whole integrations. Different QuickJS builds.** |
| 16–23 s | Flip the race board to two measures where the same historical report favors the comparator. | **Hyperlight wins these rows.** / `Cold return2: jitk 5.904 ms; Hyperlight 4.767 ms` / `Process footprint: 10.657 vs 1.813 MiB` |
| 23–30 s | Stack an executor/MCP boundary label over the raw label to explain why the viral raw number is not the user-facing number. Use separate cards, not additive bars. | **Raw ≠ MCP.** / `Separate MCP run: 2.106 ms warm one-tool p50` |
| 30–36 s | End with the narrow demonstrated behavior and evidence invitation. | **Async host I/O is the result.** / `Artifacts, exclusions and versions attached` / `No Docker / E2B speed claim` |

Before producing the cold-return text, read the exact row from the same quiet report; never round an audit's approximate “4.8” into an invented exact figure. The report's source row is the authority if it differs from the production script. All memory figures must retain **process footprint; excludes HVF kernel allocations**. Those exclusions belong in readable on-screen text when that card is visible.

**Tweet copy**

> Our raw parked 10×5-ms tool fixture measured 6.5 ms in jitk vs 63.2 ms in the tested synchronous Hyperlight-JS bridge. Whole stacks, different QuickJS builds. Hyperlight won cold return and footprint. Here's the comparison with its boundaries visible.

**Why people might share it.** Races attract attention, and acknowledging the other stack's wins creates a more useful technical discussion than a victory slide. Runtime/virtualization engineers and benchmarking writers have a concrete claim to reproduce. It may reach QuickJS/Bun performance audiences and Hyperlight maintainers; that is a topic map, not a plan to bait or tag them.

**Honesty risk → defusing it.** An old fixture result must not impersonate an up-to-date upstream shootout. The tested adapter's synchronous bridge is central; the engines and full stacks differ. Hyperlight-Unikraft already exists, so the animation must never imply that Hyperlight cannot run native Linux runtimes. Actual screenshots cannot resolve a few milliseconds; measured traces/total-duration plots are the evidence, and slowed playback is labeled.

**Why no Docker/Firecracker/E2B race yet.** There is no matched local completed-workload result against them. A Mac local VM versus a remote sandbox API mixes network, preparation, authentication, package environment and lifecycle. Firecracker requires KVM; an HVF Mac is not a same-host comparison. A future race needs the same Linux bare-metal host where possible, same useful task/tool responses, explicit fresh/warm/snapshot contracts, all startup/teardown endpoints, versions and failures. A remote product trial can be useful if labeled **“user-perceived local-versus-remote setup, not VMM speed”**. Do not substitute vendor marketing times or an artificial sleep for the other lane. Cost and provisioning are outside this brief.

**Effort.** Existing: adapter, raw samples/reports, workload and alternative-metric rows. New: precise artifact extraction and provenance card **2–3 h**; honest race/metric flips **3–5 h**; capture/edit/methodology QA **5–8 h**. **10–16 h** for a historical-result video. A fresh competitive run is additional work and may reverse the picture; publish that result if so.

## Winner production plan

### Deliverable and scope

Produce a **32-second silent-first MP4**, a clean hook still, an uncut local recording, and a small evidence bundle. This report does not create those deliverables; it specifies them for implementation. The only large numerical headline in the primary video is a current take's actual VM-use count. Speed medians can live in a separate evidence post instead of competing with the lifecycle story.

Use one visibly synthetic but coherent task: join the two fixture repository issue lists and count them. The existing demo already returns two records; keep their fixture nature visible. If a genuinely useful read-only local data task is added, label its provider and inputs and validate its output before filming. No write tools, live customer accounts or real API credentials are needed for this production.

Agent authorship is separate from VM execution. The existing example contains a saved “agent code” snippet and makes no model call during replay. Caption it **“Recorded agent-written snippet”** only if its provenance can be supplied; otherwise say **“Demo JS snippet.”** Do not fabricate an LLM typing sequence or include model generation in the VM's stopwatch.

### 1. Freeze the evidence before designing the count — 1 h

In a separately authorized production checkout/copy, pin the actual source state and hashes for image, VMM, protocol, executor and tool provider. A bare HEAD hash is insufficient while local changes exist. Record host/OS/chip, loaded backend, pool configuration, workload text/hash, provider fixture, and receipt schema. Explicitly require `jitk`/libkrun: the development local-QuickJS fallback must not silently power the video.

Perform the existing two-tool demo and stdio MCP smoke test there, with normal output validation. Preserve failures. Do not run the entire `make demo` for the lifecycle recording: the growth/build stages are a different story and would muddy the wall's counters. Separate setup/compilation/warmup from the take and retain their receipts.

### 2. Add a trace adapter and a bounded driver — 4–5 h

Prefer new demo-only orchestration around existing interfaces over a kernel change. A backend decorator can assign a monotonic host ID when `park()` starts; successful `inner.park()` indicates the backend's READY/host-confinement checks have completed. Decorate the returned sandbox's `send`, `read`, `kill` and `exited` promise. Preserve their exact behavior and correlate the object with a WeakMap. Use the executor's timing hooks and pool's existing disposal hooks; deduplicate events that appear through both paths. A PID, if needed, requires a deliberately exposed diagnostic identity; do not reach into an invented public `.pid` field.

For a true **peak live VM-process** count, add a small explicit diagnostic hook at the backend's actual child spawn/close boundary in the production copy. A decorator around `park()` alone sees launch attempts and READY, and cannot prove the process was alive for the entire intervening interval. If that hook is omitted, show `pool.snapshot().tokens` as **occupied lifecycle slots, including creation/reaping**, not actual live machines. Do not relabel `snapshot().live` as all live VMs: that set is populated after successful parking. Count watchdog/supervisor processes separately from VM processes. The mockup's actual-live label is contingent on this instrumentation.

Proposed JSONL event schema, **not an existing output contract**:

```text
take_id, seq, mono_ns, vm_id, invocation_id?, event,
workload_hash?, tool_call_id?, result_digest?, status?
```

Events: `boot_start` (attempt), `process_spawned` (if instrumented), `ready`, `run_sent`, `tool_start`, `tool_end`, `result_validated`, `kill_requested`, `reaped`, `failed`. An observed raw DONE frame is not sufficient for `result_validated`; validate the expected response in the driver. Record an actual callback start/end on the host, rather than infer ten overlaps from a `Promise.all` source string. Tie reaping to `exited`, not to requesting a kill. Keep a separate monotonic event sequence to resolve equal timestamps and an edit map for zoom/hold inserts.

Expose these distinct totals:

| Counter | Increments only when | Why it exists |
| --- | --- | --- |
| **Program VMs used** | The first RUN frame is successfully sent to a never-consumed, identified VM for a counted invocation | Large hook counter; one counted program per VM |
| Validated results | The driver verifies the expected output for that invocation | Rejects pretty-but-empty tiles |
| Used VMs reaped | `exited` completes for a counted consumed VM | Proves disposal, separately from result delivery |
| READY VMs created | A new VM passes READY/confinement checks | Includes pool work, so it cannot replace the used counter |
| Failed / shed requests | A request fails validation, times out, fails startup or is rejected | No success-only denominator trick |
| Actual live / peak live | Observed process spawns and confirmed reaps, including booting and unused warm VMs, with a declared accounting boundary; otherwise show occupied lifecycle slots instead | Prevents a cumulative wall from becoming a density claim |

Exclude setup/warmup invocations from the take's large counter and identify them separately. Include all VM births inside the take in the READY/attempt diagnostics, even unused refill. Give failed startup attempts their own status. A partially completed take cannot assert “all reaped” until `close()` settles and recorded identities reconcile.

Start with the repository's small bounded pool and two-call task. Use a fixed, declared worker count and a declared admission schedule; record both. Run a calibration take to find stable, readable event volume. It is acceptable to intentionally pace requests to avoid saturation if the video says **paced demonstration**. Do not use the fastest warm request median as sustainable throughput. Do not increase concurrency to achieve a prewritten “thousands” headline.

The driver must keep a bounded number of in-flight requests; no unbounded Promise-all of VM launches. At take end, stop admission, await request settlement, drain retired guests, close the pool and await all reaps. Failed requests remain in the evidence. Write one final reconciled summary, including original duration, warmup exclusion, completed outputs and peak actual live.

### 3. Build the instrument and its close-up — 4–6 h

Reuse the existing palette and SVG vocabulary in a new production scene/copy. Keep the existing `idea.html` and `demo.html` intact. Use SVG for the small close-up/labels and Canvas for dense history if SVG node count becomes a recording bottleneck. There is no reason to animate thousands of DOM elements just to imply scale.

The wall should represent **completed-and-reaped invocations** as permanent receipt marks. A narrow separate live strip shows boot/READY/running/result/kill stages. This cleanly allows fast jobs to be visible after completion without exaggerating their lifetime. If a stage gets a minimum visual dwell for comprehension, mark that close-up “state sequence, not duration to scale.” Use original event time for all numerical clocks.

Do not use `flow()` dots as evidence of real tool packets: those run on the engine's arbitrary animation clock. Event motion must consume JSONL. Add a controlled cue timeline rather than relying on the engine's 8.5-second Play interval. Disable stagger delays for the opening's principal sentence so the complete hook is readable immediately. The wall can accumulate below it.

For a live dashboard, sample counters from the event reducer each browser frame and batch updates; never let display rendering backpressure the VM/tool path. The preferred final artifact is **trace replay at original timing** from an actual captured run, explicitly labeled. That permits crisp recording and layout changes without rerunning the VM workload, while preserving verifiable totals. It is not a live benchmark.

Composition at the chosen portrait master: headline and principal count in the upper band, history/active band in the middle, one enlarged code/receipt card in the lower band. Use 60–80 px main type and 34–40 px supporting labels at a 1080-pixel-wide master, then inspect at phone scale. Those are design sizes, not project measurements. Labels that matter must survive a paused screenshot. Give color meanings text or shape equivalents; avoid rapid full-screen flashes.

### 4. Record the take and assemble the short — 3–4 h

Use the native macOS screen recorder or OBS for the browser + terminal composition. Keep the uncut recording at original speed. Record the terminal locally with `asciinema rec take.cast` if installed, without idle compression in the evidence master; the cast records text/events, not the browser video. The official CLI supports recording commands and adjustable playback speed/idle limits. Compression is useful for the separate offline-growth edit only when visibly labeled. [asciinema CLI](https://docs.asciinema.org/manual/cli/), [quick start](https://docs.asciinema.org/manual/cli/quick-start/).

Build a **1080×1350 portrait master** for legible feed viewing and a **1920×1080 landscape adaptation** for repository/docs. These are production choices, not a claim about X's algorithm. Use 30 fps unless inspection shows a need for 60; individual microsecond/millisecond events will be batched into frames, so frames are never the timer. Do not make the principal meaning depend on single-frame flashes.

Export H.264 MP4 with burned-in scope labels, readable at phone size, and no required narration. An optional audio track can add rhythm, but every claim must remain understandable muted. Use FFmpeg or an editor for scaling, text and cuts; FFmpeg's documented `drawtext`, `fps` and `setpts` filters can support this, with `setpts` speed changes restricted to clearly labeled excerpts. [FFmpeg filter documentation](https://www.ffmpeg.org/ffmpeg-filters.html).

Keep the file comfortably below 512 MB. X's current ordinary-account help lists a 140-second/512-MB upload limit; this 32-second concept fits the duration limit. Its Media Studio guide specifies H.264 for video. Account/upload surfaces can differ, so the final human-owned upload should check the actual file acceptance without assuming Premium. No upload is authorized by this report. [X video help](https://help.x.com/en/using-x/x-videos), [Media Studio encoding](https://help.x.com/en/using-twitter/media-studio-faqs.html).

Never stretch the factory segment's playback and leave a “LIVE” badge or moving real-time stopwatch on it. Use a hard cut or freeze with **“trace paused”**, then continue the same trace timestamp. The final receipt supplies original elapsed duration and makes clear the edit is 32 seconds. The separate MCP insert uses its own take ID and cannot add to the factory count.

### 5. Reconcile and review — 2–3 h

At end of capture, run a small reducer over the saved trace. This is necessary evidence checking, not a broad new test suite. Assert that each used ID has exactly one RUN, successful records have the expected output, no reaped-used count precedes its exit event, the counter has no duplicate IDs, no warmup/unused-refill ID enters the used total, and all intended cleanup has finished. Confirm that final live count is zero after pool closure, or explain the failure without editing it away.

Then inspect the full video muted, the first three seconds alone, the hook still, and the clip at approximately phone width. Verify that a reader can answer: what does each tile mean, is this live or recorded, where do tools run, what is being counted, and is the grid history or concurrency? Scope text belongs near the claim rather than in an unreadable end card.

Save the MP4, hook PNG, raw cast/uncut capture, JSONL, reducer summary, actual workload/provider, source/artifact hashes and edit map together. Include the exact reproducible commands and any observed failures. Use a verified public repo URL only when one is available; do not display an invented URL, a private absolute path or a “try it now” instruction that has not passed a clean setup.

The detailed blocks sum to **14–19 h**; reserve another hour for the MCP insert or an edit revision to reach the headline **14–20 h** working-toolchain budget. Prerequisite recovery remains additional. Estimate confidence is moderate because the runtime is changing concurrently. A lean release can omit the MCP insert and use the already working two-tool fixture throughout.

### Acceptance gate for the winner

- The opening has an understandable sentence at frame zero and actual count movement by three seconds if the calibrated run produces it; otherwise use completed receipts with an explicit recorded-trace label, never fake events.
- Every permanent tile maps to one validated output and one confirmed consumed-VM reap in the downloadable trace.
- The take shows the current useful task and actual host-side overlap, rather than using only `return 2` or refill.
- Pool preparation, warmup, unused VMs, peak live, failures and original elapsed duration are accounted for.
- No latency claim is inferred from animation or capture FPS; no “thousands per second,” density, cloud price or Linux-metal claim is invented.
- Existing explainers supply visual primitives only. Their stale “26 syscalls,” isolate-language claims, container hardware-wall generalizations, cached per-task assembly, snapshot targets and rg/SQLite/Cap'n Web scenes do not enter the working-feature reel.
- The evidence bundle stands alone, and the MP4 is understandable without narration or tweet context.

If the lifecycle trace cannot be correlated reliably, ship concept 3 first using observed host-tool intervals and confirmed pool closure. Do not replace missing receipts with decorative computer births. If the primary take is visually sparse, tighten the camera and use accumulated history; the task does not require a new scale record.

## Editorial decision

Lead with **the life of one disposable computer, multiplied into a wall**. Use the offline kernel-growth sequence as a second release artifact where its real elapsed time, deliberate deletion and oracle scope can breathe. Keep comparative races as supporting engineering material until the methodology is as compelling as the picture.

The moment worth remembering is simple: **that bright square was a computer, it did useful tool orchestration, and now it is gone.**
