# Sofort: narrative demos that earn the “future arrived” reaction

Design research, 2026-10-25. This report proposes five videos; it does not claim they have been produced. Only this new report was written. Existing source was read, copies were built in automatically deleted temporary directories, and bounded local VM/Linux feasibility checks were run. No source handlers were changed, no commits were made, and nobody was contacted.

## Decision

**Winner: “The agent taught its computer to read a database.”** Use the pinned static SQLite shell against a real, packed, read-only SQLite database. This investigation found a genuine failure on the current kernel, without deleting a working handler. The missing `fstat` stops the workload; native Linux also requires `pread64` further along. The video should follow that causal chain, show the proposed handlers surviving independent tests, and end with the unchanged SQLite binary answering the unchanged query.

**The after-state is work to build, not an achieved result.** Budget 28–44 focused hours, with a stop/go checkpoint after 6 hours. If the target proves broader than this contract, publish concept 2, the already-supported QuickJS/`ppoll` regrowth story, accurately labeled as regrowth from a deliberately reduced seed. Do not substitute SQLite’s existing in-memory/time-random examples: both already work on this kernel.

The strongest sentence for someone to repeat is: **“The AI proposed the OS change. Linux was the oracle. Fresh VMs checked it.”** The surprise is the development loop becoming concrete, not that the project invented unikernels or replaced Linux.

## What I checked, and the discovery that changes the brief

Read the five prior pitch reports [01](01-value-audit.md), [02](02-hosting-landscape.md), [03](03-agentic-coding.md), [04](04-scale-and-economics.md), [05](05-twitter-pitch.md); [FINAL](../../FINAL.md); active [grow README](../../jitk/grow/README.md), [DEMO](../../jitk/grow/DEMO.md), controller/runtime/agent/adapters and selected receipts; the [historical proposal](../../08-grow-loop/PROPOSAL.md) and R2–R4 reports; the [jitk Makefile](../../jitk/Makefile); and the supplied [podcast transcript](../next-token-ep07-transcript.txt), particularly 00:53–00:55. Historical proposals describe earlier stages, not present implementation guarantees.

The Makefile’s `demo` target runs executor demo, grow regrowth, then grow presentation. The default is REPLAY. `--live` generates proposals through the CLI; it is an offline operation. `loop.py` also creates commits in its private development repository and writes release pointers by default. I therefore did **not** run `make demo`, `grow`, or the live generation loop under the instruction not to commit/change existing files. I used copied builds and direct bounded VMM invocations instead.

### Fresh feasibility observations, n=1 per case

Host: Darwin arm64. Current checkout HEAD: `70f6d8cf19942e7317d7958233ea18d58b245cc5`, with pre-existing uncommitted executor/protocol work. These checks concern copied kernel source and the named VMM, not certification of those unrelated changes. All started VMMs were waited/reaped; temporary builds and Docker containers were removed. These are functional checks, not benchmarks or a new 30-VM acceptance run.

1. **The exact existing SQLite binary fits the loader.** `/tmp/jitk-10/r2/sqlite3-static`, SQLite 3.50.4, static AArch64 musl, SHA256 `005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff`. Calling the current packer’s pure `pack()` function succeeds. Flat payload: 1,466,368 bytes; loaded ranges `0x400000–0x54bb10` and `0x55c730–0x565628`. No relinking is required for this artifact. The `/tmp` binary is a local prerequisite, not a distributable release artifact; preserve its provenance/build recipe from [the R2 experiment](../../10-minimalist-critic/r2/EXPERIMENTS.md).

2. **SQLite in-memory aggregate already succeeds.** Current copied kernel, no additions: `{"count":5,"sum":23,"max":9}\n`, guest exit 0, while reporting missing nr48 (`faccessat`). That miss is tolerated by the application.

3. **SQLite time/random already succeeds too.** `SELECT length(randomblob(32))=32 AND unixepoch('now')>1700000000;` returns `1\n`, guest exit 0, with missing nr48 and nr172 (`getpid`). This is weaker than it sounds: it checks output length and a coarse time predicate. SQLite can fall back when `/dev/urandom` is absent; this success does not establish a kernel random device, strong entropy, or complete Linux randomness semantics. The old “+5 syscalls” counts names relative to an earlier 17-name workload union. It is not today’s mandatory implementation delta. Current `fcntl` and the two explicit ENOSYS signal slots already exist.

4. **SQLite against an actual database genuinely fails today.** Create an 8,192-byte database with `CREATE TABLE n(v); INSERT INTO n VALUES(9),(1),(5),(3),(5);`. Pack it as `/demo.db`; pack an empty regular file at `/dev/null` for the shell’s init-file read. Run:

   ```text
   sqlite3 -batch -init /dev/null 'file:/demo.db?mode=ro&immutable=1' \
     "SELECT json_object('count',count(*),'sum',sum(v),'max',max(v)) FROM n;"
   ```

   Actual guest result: no application stdout, terminal record `{"kind":"done","seq":30,"code":1}`. Missing syscall numbers: **48, 172, 80**. The trace reaches open of the database and `fcntl(F_SETFD)` successfully, then `fstat(3, ...) → -38`. The VMM itself returns process status 0: distinguish a successful VM shutdown from a failed guest program. Do not turn the host status into a green workload badge.

5. **Same SQLite artifact/database/query succeeds on native arm64 Linux.** Local `jitk-oracle:08`, read-only bind mount: exit 0 and the expected JSON. Its trace includes `fstat` and three `pread64` reads: 100 bytes at offset 0, 4,096 at offset 0, and 4,096 at offset 4,096. These are real database-header and page reads, not an answer hardcoded in JS. Database SHA256 for this exact fixture: `4b36c3f75630adc250be0dc90f792379f20211cb0cb304e70354278c2c849c06`.

6. **Native Linux injections support the causal claim.** In separate single runs, injecting ENOSYS into `fstat` causes guest-process exit 1 and a disk-I/O error; injecting it into `pread64` does the same. Injecting ENOSYS into both `faccessat` and `getpid` preserves exit 0/output. Injecting ENOSYS into the two signal calls also preserves exit 0/output. These are native Linux sensitivity checks, not proof that a future jitk handler works. Combined profiles still need a complete acceptance run.

7. **QuickJS is a verified immediate fallback.** Re-executed the recorded `qjs-missing` image, which was deliberately built without `ppoll`: no application output, repeated nr73 misses, killed/reaped after a 300-ms bound. Same input `ping\n` with the recorded `qjs-after` image: `reply:ping\n`, guest exit 0, no missing records. Thus “the event loop cannot complete on this reduced seed” is true. “Today’s canonical kernel cannot run QuickJS” is false.

### Evidence anchors

- VMM used: `/private/tmp/jitk-fs-work/vmm/jitk-vmm`, SHA256 `2e3cfb02b0ab7cba9fc460694863ca45d6c2b0800f37dcf44d642c5a560e4e77`.
- `kernel/slots.json` SHA256 `c27fa37e40d631850c64800d9c149e7711b576df86929e1aab2888ce2e87c57d`: 24 numbered slots; **25 exists, 48/67/80/172 do not**.
- `kernel/prepare.py` SHA256 `7fa29da2d66238685fab8e7b365c730d3950d0cd9c0f91445b6e5c609aa4944a`.
- `kernel/src/fs.rs` SHA256 `c4368c60c311503f0e5f23a568945c2f611561d49b6edf4484897083c94df998`; current read-only resource backend supplies reusable lookup/descriptor/data helpers.
- `kernel/src/trace.rs` SHA256 `7a231757c245f11d6112bc4a5053411f25d37f5edcf151837bebbfc3b1e3c88a`: its current buffer capture and grow adapters do **not** already support a complete SQLite differential.
- Re-executed QuickJS before image SHA256 `49bed40d2c9a1cb2fe5761f81cae4a1f9c81bd3a747a1333fcd764c148c45e48`; after `8ed9df2f8168f6b503e0005e0c2ba24aa5dfb8252cabd36ae64225b512cbc1c0`.
- Existing [ppoll comparison](../../jitk/grow/results/run-20261024T141804/tx-ppoll/linux.canonical.json) matches its [guest comparison](../../jitk/grow/results/run-20261024T141804/tx-ppoll/guest.canonical.json): eleven events, including seven ppolls, one read, two writes and exit. Use the artifact actually filmed.
- Existing [live growth receipt](../../jitk/grow/results/live-demo-1792810727825896000/report.json): 3 actual CLI proposals, 30 fresh probe VMs per proposal, total preparation 402.229 s under contention. Two proposals are ENOSYS signal profiles. This is evidence that LIVE exists, not a timing promise for SQLite.

The new checks above were transient feasibility runs; their tool output is summarized here rather than saved as a release evidence bundle. The production plan below requires persistent raw receipts and an uncut recording.

## Narrative rules for every cut

Start with a task and an obstacle. Show the missing behavior before naming the architecture. Give the viewer one question to carry: **will the unchanged program work after the computer learns the missing operation?** Put the answer at the end.

Persistent captions: `OFFLINE DEVELOPMENT`, `LIVE GENERATION` or `RECORDED REPLAY`, and a visible compression factor/actual elapsed clock on accelerated sections. Record actual elapsed time rather than assuming it will match an old receipt. “Live generation” means sampled during that recorded run; viewing a recording does not make it a real-time livestream. Do not splice unrelated successful runs into one apparent causal chain.

Never use Lua’s signal registration as the dramatic failure. Both signal handlers return ENOSYS; Lua already runs. Never use a green “secure” seal for differential tests. Never animate a per-task image builder, snapshots, or Cap’n Web as implemented. “Fresh VM” is a new single-use guest/process, not a new physical computer.

These narrative videos do not need a latency number. If one is added in a follow-up, retain the audit’s boundaries: ~0.29 ms raw parked only; ~2.1 ms warm local MCP; ~9–10 ms cold executor with the executor already running. Image building/model time is additional. No generic fastest/cheapest/security ranking.

The copy below is draft launch copy. Any past-tense statement about the new SQLite after-state is **conditional on completing its gates**. `[REPO]`, `[RUN]`, and `[EPISODE]` are placeholders to replace with public verified links. No reach or endorsement is predicted.

## Concept 1 — The agent taught its computer to read a database

**Three-second hook:** Split screen: `Linux: {"count":5,"sum":23,"max":9}` / `jitk: fstat → ENOSYS; exit 1`. Large caption: **“Same SQLite. Missing OS.”**

**Stakes/reveal:** A familiar program has a concrete problem. The agent changes the computer underneath it, with Linux and independent tests determining acceptance. The final query is unchanged. A native DB page appears as evidence of actual work.

**75-second storyboard**

- **00–03:** Show the actual failure/working-Linux pair, database/binary short hashes fixed on both sides. VO: “SQLite works on Linux. This tiny computer cannot read the database yet.”
- **03–10:** Show the exact query and 5 source rows; highlight guest exit 1. On screen: `8 KiB DB • READ ONLY • immutable=1`. VO: “No writes, no server. Just read these five numbers.”
- **10–18:** Zoom actual guest trace: `fstat(3, …) → -38`. Then native trace: `fstat → 0`, followed by `pread64`. VO: “It needs file metadata, then reads at an offset.”
- **18–31:** Agent proposes `fstat`, then `pread64`, with helper/spec context visible; show allowed file paths and controller-installed patch. Persistent real elapsed clock and `OFFLINE • sped up ×N`. VO: “The agent proposes the missing handlers. The controller owns the tests.”
- **31–42:** One Linux probe beside one VM probe, exact read bytes/return value/FD-position assertions. Caption: `same probe ELF • declared contract`. VO: “Do they return the right bytes, and leave the file position alone?”
- **42–51:** Intentionally wrong offset candidate goes red; corrected candidate enters the 30-run gate. Caption: `deliberate mutation • rejected`. VO: “Returning success is not enough. The test catches the wrong page.”
- **51–61:** Thirty sequential fresh-VM receipts fill the display only as completed. Show one run’s raw trace and reap receipt. VO: “Thirty fresh VMs check the contract. That proves these tests, not all of Linux.”
- **61–69:** Real-time rerun unchanged SQLite/query/database. Result JSON appears. Hard cut to binary/database hashes unchanged, kernel image hash changed. VO: “Same binary. Same database. Now it can answer.”
- **69–75:** `Sofort • a computer whose OS contract can grow offline` plus `[RUN]`/`[REPO]`; small `experimental • read-only SQLite fixture`. VO: “This is a working piece of purpose-built computers for agents.”

**Root tweet**

> Same SQLite binary. Same database. A tiny OS that couldn't read it—then could. An agent proposed the missing handlers; Linux supplied the oracle; fresh VMs checked the contract. Sofort, an offline kernel-growth experiment. Full run below.

**Follow-up thread**

1. “The workload is deliberately small: static ARM64 SQLite reading an immutable database packed into the image. No DB writes, extensions, threads, or persistence claim. The before-run exits 1. The after-run must return the exact expected JSON.”
2. “The essential new behavior is fstat + pread64. faccessat/getpid are separate compatibility probes; we record their declared profile too. The two signal slots still return ENOSYS. This is a bounded read-only contract.”
3. “Each candidate gets independent argument/byte/state checks against Linux. The video also shows an intentionally broken handler being rejected. Thirty fresh VMs add repeatability evidence; they are not thirty different implementations or a security proof.”
4. “Growth happens offline. The running tenant cannot rewrite its kernel. Per-request computer assembly and snapshots are future work. Uncut recording, raw traces, hashes, exact supported contract: [RUN] [REPO]”

**Who might share it, and why:** OS/Rust/virtualization builders because the unchanged binary is recognizable; database engineers because actual page reads and failure injection make the claim inspectable; agent-evaluation builders because a test rejects a plausible patch. These are audience hypotheses, not promised shares. A code-mode interpreter can explain the idea in one quote post without endorsing production security.

**Honesty risk and defusal:** The after-state is unbuilt; withhold this cut until it exists. Never say “SQLite support” without “this read-only fixture.” This is an alternate packed-image/native-binary VM demo; today's MCP `execute` API accepts JavaScript, not arbitrary binaries. Keep that boundary visible if the video also mentions MCP. Show which calls are implemented versus tolerated ENOSYS. Pack `/dev/null` as an explicitly declared empty resource, not a fake kernel device. Do not call a native-Linux success a jitk success. Include guest exit status; VMM exit status alone is insufficient.

**Effort:** **28–44 hours** total. Existing: loader accepts exact ELF; read-only archive/FD helpers; real failure; native Linux oracle; controller pattern. New: missing-slot registration/controller scope, handlers, independent probes, byte/state adapters, durable receipts, acceptance, live capture and edit. No need for a random device, writable DB filesystem, or snapshot implementation. Detailed budget below.

## Concept 2 — The program taught its computer how to wait

**Three-second hook:** Frozen `reply:` terminal, live missing nr73, caption **“I removed one syscall. The event loop stopped.”** The removal disclosure is in frame zero.

**Stakes/reveal:** Waiting sounds simple until an OS does not know how. One bounded `ppoll` handler turns a stalled QuickJS event loop into a completed response. This is the strongest immediately filmable growth concept.

**55-second storyboard**

- **00–03:** Show missing `ppoll` from a deliberately reduced seed. VO: “I removed the computer’s ability to wait for input.”
- **03–10:** Show untouched static QuickJS and the `os.setReadHandler` script, host sends `ping`; bounded run has no reply. Caption: `seed experiment • canonical kernel already has ppoll`.
- **10–18:** Native Linux probe highlights pollfd readiness and return value. VO: “Linux shows the contract: when input arrives, mark it readable.”
- **18–30:** Record actual agent proposal/build, accelerated with elapsed time. On screen: `one proposed module • uses existing checked memory/wait helpers`. VO: “The agent fills this restricted handler, using the kernel’s existing helpers.”
- **30–41:** Compare one complete probe; highlight negative FD ignore, invalid FD, bad pointer, invalid timespec, zero timeout. Then the 30 sequential receipt counter. VO: “We compare the contract, including errors, in fresh VMs.”
- **41–49:** Real-time fresh VM prints `reply:ping`; show reap. VO: “Same QuickJS. Same script. The event loop can complete.”
- **49–55:** Manifest diff and scope `bounded ppoll • not full Linux ABI`. End `Sofort • offline kernel regrowth • [RUN]`.

**Root tweet**

> I removed ppoll from a tiny kernel. QuickJS's event loop stopped completing. Then an agent regrew the restricted handler, Linux became the oracle, and fresh VMs checked the result. Same JS: reply:ping. This is offline OS development, on camera.

**Follow-up thread**

1. “This is deliberate regrowth: today's canonical jitk already contains ppoll. The before-image removes it in a disposable source copy. The real QuickJS ELF and script stay unchanged. Missing nr73 produces ENOSYS; the harness bounds and reaps the stalled run.”
2. “Linux and jitk run the same small static ABI probe. It checks readiness, read bytes, error returns and pollfd output. Thirty fresh VM runs repeat that probe; they don't establish the whole Linux poll ABI.”
3. “The agent receives a narrow spec and trusted helper API. This is not discovering an OS from scratch. The final handler uses an existing wait helper rather than spinning. LIVE generation and recorded replay are labeled separately.”
4. “Lua also runs, but adding ENOSYS signal slots didn't bring it back from the dead. That's why this video uses the genuinely blocked event loop. Full raw evidence, limits, and commands: [RUN] [REPO]”

**Who might share it:** Runtime/event-loop engineers; Rust/OS educators; code-mode builders who want an understandable kernel-growth demonstration. It is less immediately recognizable than SQLite, but easier to reproduce today.

**Honesty risk and defusal:** Frame-zero disclosure prevents manufactured-breakthrough framing. Do not describe `ppoll` as missing from the canonical release or suggest this independently implements the entire scheduler. The present `park_poll`/copy helpers are supplied. New proposed wait-related cases must be measured, not inferred from seven existing fixture calls.

**Effort:** **7–11 hours**: 2–3 for a clean scoped live capture and durable receipts; 1–2 for one intentional rejection and trace explanation; 4–6 for edit/captions/QA. Existing: both images, same-script before/after, live controller, Linux adapters, 30-run gate. No new runtime support needed. A current live sample remains necessary to headline new live generation.

## Concept 3 — They predicted it. Here is the working piece.

**Three-second hook:** Credit card `The Next Token, Ep 07 • published Oct 19` and short excerpt **“a computer that's built for purpose, almost just in time”**. Immediate cut to a real kernel missing-record. Do not cold-open with a logo or an unverified speaker attribution.

The supplied transcript places the prediction around 00:53–00:54. [Official episode/show notes](https://podcasts.apple.com/au/podcast/whats-after-code-mode-ep-07/id6784829318?i=1000797105720) confirm recording Oct 12 and publication Oct 19, 2026. They were checked during this investigation. The transcript is not fully speaker-diarized; verify exact audiovisual timing/voice before naming the speaker. Use a text attribution if footage reuse is not cleared. Nothing here authorizes outreach or clip publication.

**60-second storyboard**

- **00–03:** Excerpt/credit above, then actual missing trace. VO: “This prediction made me want to show the part I can run.”
- **03–10:** Split title `TODAY: disposable VM + offline growth` / `NEXT: per-task assembly + snapshots`. VO: “The whole prediction is bigger. These two pieces work.”
- **10–21:** Actual local MCP client sends a tiny JS tool program; host transcript and result appear. Caption: `guest code → host tools • credentials remain in provider`.
- **21–28:** Show single-use VM consumed/reaped, a second execution gets a new VM ID. VO: “A throwaway computer for each program.”
- **28–43:** Explicitly separated `OFFLINE DEVELOPMENT` segment: concept 2’s missing-poll, proposal, Linux comparison and receipt. Caption `regrowth experiment • time compressed`.
- **43–52:** Same QuickJS program replies; image manifest is readable. VO: “The computer’s contract is a versioned artifact you can inspect.”
- **52–60:** Return to the prediction and `A WORKING PIECE, NOT THE FINISHED VISION`. Repo + episode links. VO: “Purpose-built computers over MCP. Here is the piece you can try, and what still needs building.”

**Root tweet**

> The Next Token imagined purpose-built computers reached over MCP. I've been building a working piece: Sofort. Disposable VMs for agent JS, plus a tiny kernel that grows offline against a Linux oracle. Per-task assembly is still next. Here's the real demo.

**Follow-up thread**

1. “Credit: ‘What's after Code Mode,’ recorded Oct 12, published Oct 19. The purpose-built-computer discussion is around 54 minutes. [EPISODE] This prototype is my response to the idea, not a host endorsement or a claim to have invented unikernels.”
2. “Built: JS through MCP; a fresh single-use hardware VM; a host-controlled tool channel; packed read-only resources; offline kernel proposal/test receipts. The tool provider executes external effects. The guest never becomes the trusted broker.”
3. “The growth shot regrows ppoll in a deliberately reduced development copy. Its spec and helpers are supplied. LIVE/REPLAY and elapsed time are visible. Full syscall compatibility and production security are not claimed.”
4. “Still planned: assembling profiles for arbitrary tasks, snapshots, and the broader computer factory. The result today is smaller and runnable. Reproduction and limits: [RUN] [REPO]”

**Who might share it:** The podcast audience and code-mode/MCP builders. The show’s official notes link Sunil Pai, Dillon Mulroy, Rhys Sullivan and Matt Carey; attribution gives that community a reason to recognize the connection, without assuming any will share it. Use one source credit, not a wall of tags.

**Honesty risk and defusal:** “Prediction fulfilled” overstates built scope. Keep “working piece” in root/video. Do not say “built in six days”; dates alone do not establish start date or development time. Do not combine Fern/Postgres/effect-journal features with Sofort. An old transcript is not permission to republish audiovisual material.

**Effort:** **9–14 hours**, assuming concept 2’s evidence capture is available: 1–2 verification/credit; 2–4 MCP/lifecycle capture; 2–3 growth excerpt; 4–5 edit/caption/QA. No new kernel capability. If footage rights require unresolved outreach, use the text card and own narration.

## Concept 4 — The AI’s kernel patch was plausible. The test said no.

**Three-second hook:** Rust `return 0` beside `BUILD PASSED`, then `REJECTED: wrong bytes / wrong FD state`. Caption: **“Compiles ≠ works.”**

**Stakes/reveal:** The hero is the independent acceptance gate. This addresses the obvious “an agent writes privileged code?” objection through a concrete counterexample, without claiming tests prove safety.

**65-second storyboard**

- **00–03:** Candidate compiles, byte comparison rejects. VO: “This kernel patch builds. It is wrong.”
- **03–12:** Unchanged SQLite read-only task from concept 1. Highlight `pread64` offset. VO: “The database asks for page two.”
- **12–22:** Intentional mutant reads offset zero instead. Label `DELIBERATE MUTATION • test demonstration`. Hex starts with the wrong page header. VO: “This version returns page one and says success.”
- **22–33:** Linux side expected bytes, guest actual bytes, first mismatch offset, red receipt. VO: “The verifier compares bytes and state. The candidate is rejected.”
- **33–44:** Correct proposal uses offset and preserves descriptor position; independent canary/read-after-pread test passes. Caption `agent proposes • controller decides`.
- **44–55:** Fresh-VM gate and full SQLite query output. VO: “Only the accepted artifact gets used by the next development run.”
- **55–65:** Manifest with exact domain and `full_linux_abi_equivalence:false`. VO: “Bounded evidence, a small reviewable patch, and a receipt. That is the interesting loop.”

**Root tweet**

> An AI-written kernel patch compiling is the least interesting part. Can the test reject a plausible wrong one? This demo sends the wrong database page and gets caught. Agent proposes. Linux supplies the oracle. Fresh VMs test a stated contract.

**Follow-up thread**

1. “The bad candidate is a deliberate mutation, labeled in the video. It is not a fabricated spontaneous model mistake. It proves the test can detect this bug; it doesn't measure the model's error rate.”
2. “For pread64 we check returned bytes, length, errors and the unchanged descriptor offset. A correct final SELECT is useful integration evidence, but insufficient by itself.”
3. “The verifier and fixtures stay outside the agent's edit allowance. Failures retain traces and reject the candidate. Production requests execute fixed images; they do not invoke a compiler or accept new handlers.”
4. “This is finite differential evidence, not formal verification, a security audit, or broad Linux compatibility. Exact cases, rejected patch, accepted patch, raw run: [RUN] [REPO]”

**Who might share it:** Testing/evals/formal-methods-adjacent readers, skeptical kernel developers, security practitioners. They get a falsifiable acceptance claim rather than “trust the AI.”

**Honesty risk and defusal:** Never pretend a scripted mutant was a naturally sampled failure. Never imply one mutation test establishes verifier completeness. No green “safe to deploy” moment. This concept depends on concept 1’s new adapters and accepted workload; it is not filmable from the current ppoll adapter as SQLite footage.

**Effort:** **5–8 additional hours after concept 1**, or **9–14 standalone hours** using the existing ppoll probe instead. Existing: mutation-rejection tests in grow, build/compare pattern. New: a captured deliberately wrong candidate, clear state/byte visual, independent rejected/accepted receipts and edit. SQLite version shares the winner’s implementation cost; do not double-count it as a cheap standalone build.

## Concept 5 — A computer with a birth certificate and a death certificate

**Three-second hook:** A useful JSON answer appears; immediately below: `VM 41: REAPED`. Caption: **“This computer existed for one answer.”** Use a real lifecycle identifier/receipt, not a pretend fleet animation.

**Stakes/reveal:** The “computer” becomes a tangible, short-lived object with a declared kernel contract and tools. Its birth certificate comes from offline growth; its death is observable. This is the best product-adjacent narrative without pretending per-task kernel assembly already ships.

**45-second storyboard**

- **00–03:** Answer and real reap receipt. VO: “The answer stays. This computer is gone.”
- **03–10:** Rewind label; show JS snippet joining two declared synthetic host-tool results. Caption `one program • several tool calls`.
- **10–18:** MCP execute; show VM identity, fixed image/profile hash and granted tools. VO: “It gets a prebuilt kernel and a narrow tool grant.”
- **18–28:** Cut marked `EARLIER • OFFLINE DEVELOPMENT`: a missing-poll record becomes one accepted manifest contract. VO: “Before deployment, an agent helped extend this kernel against Linux.”
- **28–36:** Return to execution; host tool calls overlap; compact result arrives. VO: “The guest coordinates. Trusted providers do the outside work.”
- **36–42:** VM reaped; next invocation has another VM identity and no prior JS global. VO: “Next program, fresh execution state.”
- **42–45:** Repo and `Sofort • built profiles today • task-specific assembly planned`.

**Root tweet**

> This computer existed for one answer. Sofort runs an agent's JS in a single-use microVM, with a fixed kernel profile and host-granted tools. Its kernel contract can grow offline; the execution gets discarded. Watch the answer, the receipt, and the VM disappear.

**Follow-up thread**

1. “The birth certificate is an existing image/profile hash plus this run's grants. It is not a new kernel generated for this request. Recipe-driven per-task assembly and snapshots are planned.”
2. “The guest runs JS and coordinates calls. Trusted host providers perform the external I/O and retain credentials. A granted tool can still be misused; a VM boundary doesn't decide business authorization.”
3. “After completion the VM is retired and reaped; another program gets a fresh VM. Host-side KV or real external state may persist. Killing a VM does not undo a completed host-tool effect.”
4. “The growth excerpt is a separate offline regrowth run with Linux-oracle evidence. Full command, run identity, trace, and supported contract: [RUN] [REPO]”

**Who might share it:** Agent-product builders and MCP educators; the first three seconds explain the unit of isolation without knowing a syscall. Kernel-growth readers have the linked evidence to follow.

**Honesty risk and defusal:** “Gone” applies to guest execution state, not logs, model context, provider state, or completed effects. Keep prebuilt-profile language visible. The syscall manifest is evidence about a contract; host policy separately enforces tool grants. Do not imply the manifest automatically enforces the whole ABI or authorizes tools. Do not claim the OS was minimized automatically for this task or equate slot count with total computer size/TCB. Label synthetic tools/data.

**Effort:** **8–12 hours**. Existing: MCP, async host tools, single-use pool lifecycle, image manifests, regrowth evidence. New: one useful two-tool fixture, readable lifecycle receipts/trace presentation, capture/edit. A film-only wrapper may expose existing facts; it must not manufacture lifecycle events.

## Ranking

1. **SQLite learns to read — winner, 28–44 h.** Strongest familiar object, genuine new-workload failure, causal missing behavior, and an observable changed computer. Highest implementation uncertainty, explicitly gated.
2. **QuickJS learns to wait — immediate fallback, 7–11 h.** Strong evidence and low production risk; deliberate regrowth reduces novelty. Pick this if publishing today matters more than a genuinely new compatibility win.
3. **The AI patch fails the test — 5–8 h incremental.** Best technical follow-up to winner; the rejection makes the overall story credible. Narrower audience for the root video.
4. **Prediction → working piece — 9–14 h.** Best connection to the Next Token audience; less legible without the substantive growth reveal. Use as an alternate opening or a later origin-story cut, not a “prediction solved” victory lap.
5. **Birth/death certificates — 8–12 h.** Clearest user-facing object and easiest repeatable product story; kernel growth is a supporting reveal rather than the whole plot.

This ranking is editorial judgment about clarity, novelty, credible evidence and build risk. It is not a prediction of view counts. Concepts 1 and 4 share engineering; hours are not additive across every concept.

## Winner: detailed production plan

### Exact binary and workload contract

Pin the SQLite 3.50.4 artifact/hash above, built by the retained [recipe](../../10-minimalist-critic/r2/build.sh). Preserve the source and license notices. This demo requires no patched SQLite source or feature-omission defines. Pin its compiler/musl provenance and verify the binary hash on both Linux and jitk. This is a selected static binary, not arbitrary Linux binary support.

For the teaser and primary acceptance use the exact 5-row, 8-KiB database already checked. Its simple result is instantly legible. For a stronger last shot, create a separate declared synthetic invoice database and a duplicate/refund query; qualify that as a second fixture and run the same gates. Do not swap a business-looking database in only for the final cinematic shot. The 5-row case is sufficient for launch if the richer fixture increases scope.

Use `mode=ro&immutable=1`: a static read-only archive is compatible with the actual storage contract; no lock manager, WAL, journal, disk-write or persistence claim is needed. The database has multiple pages, making the offset assertion meaningful. The host packs it as a resource; it is not served by a hidden host SQL tool. The trusted host must never compute the final SELECT result for the guest.

### Precisely what must grow

**Essential new semantics:**

- **AArch64 nr80, `fstat`:** metadata for an already-open read-only archive FD; valid `struct stat` layout, size/type/mode and consistent identity; checked output copy; invalid-FD/bad-memory behavior. The first genuine workload blocker observed in jitk. Reuse or carefully factor existing archive metadata logic from `newfstatat`; no success stub.
- **AArch64 nr67, `pread64`:** read immutable file bytes at a signed offset without changing descriptor position. Check offset, EOF/short-read semantics, length/overflow, FD access and destination memory. Native sensitivity check proves the query fails when it is unavailable. The current jitk run has not reached it because `fstat` stops first; call it the **next requirement from the successful Linux path**, not an observed jitk miss yet.

**Other missing names on this workload:**

- **nr48, `faccessat`:** shell startup probes the literal URI as a filename. ENOSYS is tolerated, but an explicit, documented archive-path access contract is preferable to a silent unregistered miss. Define modes and error ordering; do not hardcode this one URI.
- **nr172, `getpid`:** stable positive identity inside a single-process guest. The application tolerates ENOSYS here, so adding it is contract cleanup rather than the causal fix. A fixed guest PID is a virtual identity, not the host VMM PID.

For a clean “no unexpected misses” release, plan four new registered slots, taking 24 to 28 **if the current list is otherwise unchanged**. Only two are essential to the demonstrated DB read. Alternatively leave nr48/172 explicitly profile-ENOSYS and call that out in both manifest and video. Never imply four mandatory Linux subsystems were required. Existing nr25 supports the observed `F_SETFD`; current signal slots remain explicit ENOSYS, with Linux profile checks where appropriate. No new `getrandom`/clock/random device is needed for this database-read fixture.

Current growth machinery only selects nr73/134/135 and one-file proposals; it cannot already discover/register these new numbers. Extending trusted slot selection/controller dispatch is part of the work. Keep that controller change human-reviewed and separate from the agent’s handler proposal. Do not say the kernel agent independently edited the whole OS.

### Six-hour stop/go spike

1. Freeze a source copy and hashes. Reproduce the failure in a retained run directory, checking guest `done.code`, not only host exit.
2. Capture native Linux complete untruncated trace (`-xx -v -X raw -s 1048576`), version/image identity, exact argv, resources and environment. The n=1 exploratory `-s 256` trace above is not acceptance input: its long page strings are visibly truncated.
3. Confirm the post-`fstat` miss and narrow `pread64` contract in a development copy. Keep any implementation experiment out of the canonical release until reviewed. Record every additional syscall/semantic surprise.
4. If writable filesystem, locks, threads, broad mmap changes, or unsupported binary output become necessary, stop expanding this demo. Move to concept 2 and publish the useful failure analysis separately. Missing another small read-only call is an explicit scope decision, not reason to quietly edit the claim.

This task only designs that work; no handler implementation was performed for this report.

### Show differential testing in a way skeptics can inspect

There are **two distinct gates**: small same-ELF ABI probe comparisons, and unchanged SQLite integration output/exit checks. Do not title the video “all SQLite syscalls match Linux.” Linux has working signals and different memory/metadata identities; jitk intentionally does not match its entire startup trace.

Build new verifier-owned static probes for the added contracts. For each accepted handler run **30 fresh VMs**, cycling a documented set of argument cases; show both number of cases and number of independent launches. Run the final SQLite fixture in **30 additional fresh VMs**. If four handler gates are shown, that means at least 120 probe launches plus 30 workload launches, rather than a vague “30 tests.” If only two essential handlers are grown, say two. Prefer one probe ELF with multiple explicit cases per launch where that makes full trace comparisons clear.

Cases that earn the key shots:

- `pread64`: offset 0, second-page offset, an unaligned nonzero offset, short read across EOF, exact EOF, negative offset, invalid FD, write-only/non-readable FD if in declared scope, zero length, destination across a valid page boundary, inaccessible/read-only destination, and overflow. Read at offset 17, then ordinary read: assert the descriptor cursor has not moved. Distinct data at each offset defeats a “return first bytes” fake.
- `fstat`: valid file size/type, directory behavior if included, valid FD after close → EBADF, inaccessible output → EFAULT, cross-page output and untouched canaries. Check agreement with existing `newfstatat` for the same archive node.
- `faccessat`: existing/missing file, file-as-directory, flags/mode validation and inaccessible path. Keep the supported identity/permission model declared rather than pretending to implement all credential semantics.
- `getpid`: repeated positive stable value within the single-process guest. Map logical process identity across Linux/jitk; don't compare it to host PID. Do not claim this supports processes or signals.

Metadata has deliberate virtual values (archive device/inode/time/ownership). Publish a field-level comparison contract: which values are mapped identities, which have fixed profile values, which ordinary Linux semantics are compared. Compare file bytes, lengths, error values and observable state exactly within that contract. Never silently discard `stat` fields until a candidate passes. If a field needs a separate expected-profile assertion rather than Linux equality, show it as such. Use an equivalent read-only native fixture for permissions; the initial exploratory DB had mode 0644 on Linux versus archive 0444, so do not replay that comparison as a strict mode-equivalence pass.

The current tracer captures bounded read/write/poll data, not arbitrary SQLite iovecs, paths, metadata or 4-KiB `pread64` buffers. The current adapter rejects unknown syscall numbers. **New capture/adapter support is mandatory**, not an assumed existing feature. Prefer explicit chunked capture or guest-probe verification with a documented complete result format; reject missing/truncated data. A guest “OK” string alone is not equivalent to comparing the syscall’s bytes and errors. Verify that adapter mutations of return values, bytes, lengths and state cause rejection.

Use three deliberate negative controls, labeled exactly that:

1. `fstat` returns success without populating the struct → reject.
2. `pread64` reads from offset zero regardless of argument → reject on second-page bytes.
3. `pread64` changes the descriptor cursor → reject on following read.

Keep the independent cases outside the handler agent’s edit authority. A fresh agent proposal round sees the public specification and Linux examples; held-out argument cases remain controller-owned. If a candidate fails, retain and show that real failure. A model is not required to make a natural mistake for the demo to have stakes.

For each launch retain run ID, PID/lifecycle identity, image/ELF/resource hashes, raw stdout/stderr/trace, canonical comparison, guest exit, timeout result and reap status. Thirty receipts should be driven by completed processes, not a timed animation. They are normally sequential in this controller: do not visualize thirty machines simultaneously running unless that actually happened. Explain “30 fresh runs” versus “30 distinct cases” separately.

### Recording and edit

One desktop recording session should capture the entire causal run: unchanged binary/database → current-kernel failure → Linux reference → generation → build → negative controls → acceptance → final query. Use a fixed camera inset only if it helps the narration; terminal text and the result are the proof.

Keep a source/run identity strip visible. Build/generation/test intervals can be accelerated, with actual elapsed time and speed factor. The first failure and final answer should play at real speed. The after-image must contain the accepted handler hashes from that same run. Keep the uncut source recording accessible alongside the raw receipts; edit out secrets before recording, not by silently replacing meaningful evidence after the fact. Use only declared synthetic data. Avoid showing model thought streams; prompt/spec, proposal source, test results and actions are sufficient.

Use one evidence pane at a time at mobile size. Highlight `fstat → ENOSYS`, then “read at offset 4096,” then one actual byte mismatch. The 30-run view is a short supporting shot; do not turn the entire video into a matrix too small to read. No fake “OS is thinking” chat bubbles. Plain factual text can translate the trace: “metadata missing,” “page read missing,” “candidate rejected,” “query matched.”

Deliver a 75-second captioned master, a 30-second teaser that retains `offline`/`read-only`/time-compression labels, and the uncut technical run. Suggested feed master 1080×1350 with large safe-area captions; capture original desktop at high resolution for the repo version. These are production choices, not claims about X’s algorithm. Sound should be optional; the hook and outcome must work muted.

### Labor budget and handoff

- **0–6 h:** retained reproducible failure, complete oracle and scope spike; stop/go.
- **6–14 h:** handler proposals, trusted slot/controller extensions, source review. Two essential handlers first; separate optional-profile cleanup.
- **14–24 h:** independent probe corpus, new tracer/adapter support, mutation rejections, durable manifest and lifecycle receipts. This is the main uncertainty; do not squeeze it to preserve a launch date.
- **24–30 h:** complete fresh-VM gates and unchanged SQLite integration; fix and rerun only failed/changed evidence. Allow up to **8 extra hours** here or in adapter work for discovered semantics.
- **30–36 h:** capture, narration, caption edit and artifact/link checks. With overlap/reuse, optimistic total is **28 h**; practical range is **28–44 h** for one person familiar with the system. No guarantee for an unfamiliar machine/toolchain.

The deliverable for the implementing team is a versioned development artifact plus evidence. Human source review/promotion should be distinct from automatic probe acceptance in the narrative. The current loop’s Git commit is a development receipt, not proof an artifact was securely deployed or signed.

### Launch gate and fallback

Publish concept 1 only when the exact current-kernel failure and exact accepted after-state can be reproduced from preserved inputs; the changed image’s handlers match the manifest; negative controls reject; independent fresh-VM probe and final workload gates pass; and the uncut run is linked. Recheck the precise slot count and scope on that version. No extra cloud performance study is required to tell this bounded engineering story.

If that gate is not reached within the scope budget, publish concept 2 honestly: **“I removed one syscall, then watched an agent regrow its tested contract.”** Pair it with a candid follow-up: “Our tempting SQLite time/random demo already worked. The real blocker was reading an actual DB file.” That discovery is a better technical story than a manufactured failure.

The only call to action is to reproduce the run or supply a small failing static-binary workload. No endorsement solicitation, posts, outreach, scheduling, or publishing was performed as part of this report.
