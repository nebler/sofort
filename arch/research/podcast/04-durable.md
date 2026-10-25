# 04 - Durable execution: pause and resume for code mode and agents

Facts are marked (F), inference (I). Sources are linked inline. Fern refs are `/Users/noah/code/ai/fern/docs/architecture.md` (§n).

## Landscape (F)

- **Callscript (Vercel)**: the only description I have is the podcast at 43:00: a serializable JS subset where each step is checkpointable, like a workflow. My web search found NO official Vercel page for it, so treat it as unverified and possibly very new. Related and real: Vercel's Run SDK (QuickJS, announced Aug 2026) is reported to have no pause mechanism for approvals ([createwith summary](https://www.createwith.com/tool/vercel/updates/vercel-run-sdk-isolates-untrusted-code-from-ai-agents)). Vercel Workflow DevKit gives durable functions with hooks that wait for external input ([docs](https://vercel.com/docs/workflow)).
- **Codex yield (F)**: `exec` runs JS in a V8 isolate. A long script returns "Script running with cell ID N". The model later calls `wait(cell_id, yield_time_ms, terminate)` to collect output, or terminates the cell ([nanocodex spec copy](https://docs.rs/crate/nanocodex-tools/0.3.0/source/src/code_mode/spec.rs), [DeepWiki](https://deepwiki.com/openai/codex/5.8-code-mode-and-javascript-repl)). (I) This is *liveness*, not durability: the cell lives in the process, so a restart loses it.
- **Pi Durable (F, read source in `/tmp/ref-repos/pi/packages/durable`)**: experimental. Every entry, model turn and tool call is committed to SQLite or JSONL before display. Tasks checkpoint per phase, with `runtime.sleepUntil` storing a sleep. The host (e.g. a Durable Object) arms its own alarm via `onWake`/`resume()`. Its code mode is **replay-based**: a deterministic sandbox (virtual clock, seeded RNG) journals each tool result, and on restart re-runs the script feeding journaled results, failing if the path diverges. Crash-loop parking after 5 restarts.
- **Cloudflare OS (F)**: Gatekeepers *simulate* gated effects so the agent keeps going, then the user approves in bulk later (README L75-77). `plans/step-transactionality.md`: one model step is one transaction, and effects are buffered until the step barrier, so a crash loses the whole step and the model re-runs it. `plans/spawner-with-persistence.md`: calls are durable jobs recorded before acknowledgement, and in-memory return paths were the bug.
- **Engines**: Temporal (Go SDK, heavy: server cluster). Restate (Go SDK exists, API was pre-stable in 2024 and I could not verify current status or server license, so check BSL terms before relying on it; [sdk-go](https://github.com/restatedev/sdk-go)). DBOS Transact Go: library only, Postgres as the sole dependency, no orchestrator ([docs](https://docs.dbos.dev/golang/programming-guide)). Inngest and Cloudflare Workflows are hosted or DO-bound, so out for self-hosted k3s.

## Idea 1: Pause an agent run on approval or timer, and sleep the box while waiting (43:00, 44:00)

1. Approvals can arrive days later; the model can yield instead of blocking on a 2-minute wait.
2. **Exists**: above. Nobody ties the pause to *machine* state. Pi/Callscript make the *script* resumable by replay or serialization, which needs determinism and a restricted language.
3. **Fern fit (I)**: Fern pauses the whole process instead of making the program serializable. A parked run is: turn snapshot (§7.2) + a row `waits(env, kind, key, due_at, resume_cmd)` beside the existing `timers` table (§4, which already survives restart "like DO alarms"). With no exec open, the idle rule (§6.3) sleeps the box. Wake sources already exist: front door `/hooks` (§11) for an approval click, and the timer for a delay. On wake, the next exec restarts the CLI, which resumes from its session files (§12 "crash mid-turn"). Gaps: (a) a run is a *process*, so only state in `live/` survives, not in-memory stack; resume means "start a new turn saying approval granted", which is how LLM agents work anyway; (b) need an MCP tool `env_wait({until|hook})` that ends the turn cleanly. The actor mailbox (§6.1) serializes it. No determinism requirement, so any language works, and gVisor box state is disk only (§10 "a box holds no state").
4. **Verdict**: BUILD, about 1 week. `env_wait` + `waits` table + `/hooks/resume/<id>` + a wake path that sends the resume prompt to T3. Existing engines replay *code*; Fern needs to resume a *conversation on a disk*, so none fits.
5. **Trend**: grows. Cheaper inference means many more concurrent parked agents, and idle cost (a sleeping btrfs dir) is near zero.
6. **Signal**: Twitter 4 ("agent waits 3 days for approval, box uses 0 CPU"), CV 4.

## Idea 2: Delayed and undoable effects (undo-send window) (50:30-52:30)

1. Executor v2 delays a Gmail send by 5 minutes so it can be cancelled; 51:00 notes undo was lost in the move to agents.
2. **Exists**: Cloudflare Gatekeepers (simulate, then deferred batch approval), Temporal/Restate delayed calls and signals, Gmail's native scheduled send. Cloudflare OS is the strongest design reference.
3. **Fern fit (I)**: an *effect outbox* in the daemon SQLite: `effects(id, env, snapshot, target, payload, release_at, state)`. Agent calls `env_effect` (or a proxy in the box's egress allowlist, §10 Network) which records the call and returns "queued, undo until T". A timer (§4) fires it, which is a credentialed call made by the identity component (§3), so the box never holds the secret. Undo = row delete. Bonus unique to Fern: **effects are tied to snapshots**. `env_restore` (§7.3) cancels pending effects born after the target snapshot, and fork does not inherit them. That gives "revert also un-sends", which no other system offers because it needs disk rewind plus an effect log. This matches step-transactionality: effects release only when their turn is durable (snapshot taken).
4. **Verdict**: BUILD, 1-2 weeks, on the §4 timers table. The effect execution itself should reuse the existing identity broker. Don't adopt an engine for this; it is one table and a timer.
5. **Trend**: grows. More agent volume means more irreversible-action risk, and undo windows plus snapshot-bound release scale with it. (Risk: models good enough to be trusted lessen the need for approvals, but the volume argument dominates.)
6. **Signal**: Twitter 5 (a demo: agent sends email, you rewind the thread, the email never leaves), CV 4.

## Idea 3: Engine integration vs minimal scheduler

- **Verdict**: SKIP an external engine for v1; BUILD a minimal scheduler (about 3-5 days: generalize `timers` into due-work with kinds `idle|ttl|retention|wait|effect`, polled and re-armed at startup in `Reconcile`, §12). Fern's state is already a SQLite log plus reconciliation, and operations already follow log-then-act with crash-safe markers (§7.3). Temporal and Restate add a server cluster to a single-node k3s product. DBOS Go is the only fit that is not a server, but it needs Postgres and Fern's source of truth is deliberately SQLite plus disk. (I) If Fern ever runs multi-node with shared state, DBOS Go is the one to revisit. Effort for adoption would be 1-2 weeks and a second store to reconcile with btrfs, which is the actual hard part.
- **Trend**: neutral. **Signal**: Twitter 1, CV 3 (a hand-rolled scheduler reads as understanding; an engine import reads as plumbing).

## Idea 4: Does durability belong in Fern or in the harness?

Split by what is being made durable (I):
- **Machine and wait/timer/effect state**: Fern. It owns disk, sleep, wake, the front door and credentials.
- **Conversation/transcript durability and replay of code-mode scripts**: the harness (Claude/Codex CLIs, T3, or Pi Durable). Fern deliberately does not own agent loops and cannot make a closed-source CLI deterministic. It also keeps Claude's transcripts outside `live/` (§10), so a restore doesn't rewind them.
- **Callscript/Pi-style replay**: skip in Fern. It forces a deterministic JS subset, which is a crutch for the case where the process cannot be kept; snapshot-and-sleep removes that need. jitk could later offer a faster microVM snapshot for the same pause; one line, not researched.

## Top 3 recommendations

1. **Idea 2: snapshot-bound delayed effects** (outbox + undo window + "restore cancels unsent effects"). Best demo, uniquely Fern, about 1-2 weeks.
2. **Idea 1: `env_wait` park/resume** with approval hooks and sleeping boxes, about 1 week. Pairs with Idea 2: the approval queue is the same table.
3. **Generalized timer/wait scheduler** (Idea 3, 3-5 days) as the shared base for both. No external engine.

## Open risks

Callscript is unverified (no primary source found), so don't cite it publicly. Restate's current Go SDK stability and licensing were not confirmed, and I did not read Temporal or Inngest docs this pass. Resume-by-prompt relies on the agent CLI reloading from session files, so a stuck-mid-tool-call transcript is a real failure mode (§12 mentions restoring to the last turn snapshot). Effects whose payload depends on state read at queue time may be stale at release (e.g. email draft changed), so the outbox must store immutable payloads. The "restore cancels effects" semantic needs a decision about effects already released: those can't be recalled, and the UI must say so. Wait timers fire while the daemon is down, so catch-up on start (Reconcile) has to be idempotent.
