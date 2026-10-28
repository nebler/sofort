[← Catalogue index](README.md) · [Research summary](../RESEARCH-SUMMARY.md)

**214 entries.** Reports in this round:

- [01-pi: Pi and the observed time profile of agent sessions](#01-pi-pi-and-the-observed-time-profile-of-agent-sessions)
- [02-compat: Node compatibility on workerd — the useful remainder is adapters, not a second Node](#02-compat-node-compatibility-on-workerd--the-useful-remainder-is-adapters-not-a-second-node)
- [03-brain: Workers + Durable Objects as the agent's brain and home](#03-brain-workers--durable-objects-as-the-agents-brain-and-home)
- [04-hands: The hands: command execution on demand](#04-hands-the-hands-command-execution-on-demand)
- [05-workspace: Workspace data plane](#05-workspace-workspace-data-plane)
- [06-economics: Economics, competition, and whether the 10× matters](#06-economics-economics-competition-and-whether-the-10-matters)

---

## Round 8 — the split agent — `split/`
The round tested the hypothesis that a cloud coding agent should be split: an unmodified Node agent (Pi) as the "brain" in a Cloudflare Worker + Durable Object that hibernates while idle, a Node-compat layer grown by an agent loop, and "hands" (Containers/Sandbox, a TypeScript shell, or jitk) started only per command, claiming 10–50× lower infrastructure cost per session. Six reports each took one layer apart (Pi, Node compat, brain, hands, workspace, economics), ranked blockers by probability × damage, and attached cheap verification experiments with pass/fail thresholds. Every layer came back **go-with-changes** and the generic product is **no-go**. The broad split already ships: Cloudflare Computer and the PiHarness/pi-durable DO harness, Vercel HarnessAgent + Sandbox + just-bash, Modal/Daytona/E2B with Anthropic Managed Agents, and Pi's own Gondolin extension. A DO keeps billing wall-clock time while it awaits a model stream. Workspace/runner coherence, not VM boot or edit bytes, is the top blocker. The literal split costs about $0.0196 per session-hour: 8.5× cheaper than a live E2B sandbox, but only 1.9× against a paused Sprite, and it loses to a 1 GB Sprite. End-to-end savings are 2.7%, 12.8% and 67% with Astra, Sol and Luna respectively. jitk is a no-go as the general shell/build runner. What survives is a bounded compatibility/measurement demo: a pinned Pi in workerd whose state survives eviction, with tools remote and an honest billing comparison.

### 01-pi: Pi and the observed time profile of agent sessions
Lens: the brain layer — what Pi actually is today, which of its interfaces belongs in a Worker/DO, its Node/native surface, and a census of 516 local Claude Code/Codex session files to test the "80–95% of wall time is model wait / commands are short" premise. Headline: Pi has moved to `earendil-works/pi` and already ships an experimental Cloudflare-oriented durable harness (`pi-durable`) plus remote-execution seams (`pi-env`); a fake durable turn and a configured SDK session/edit both ran under local workerd, and text editing needs no shell. But 80–95% weighted model wait is not established, and an awaited live model stream prevents DO hibernation. Bet: pi-durable + one selected pi-ai provider + DO SQLite with explicit execution/file capabilities and replay-safe runner jobs; verdict **go-with-changes** (not "unmodified full CLI" and not "hibernates while awaiting inference").

#### Finding: Pi has been renamed and moved
- **What:** The brief's `badlogic/pi-mono` / `@mariozechner/pi-coding-agent` is historically correct but now redirects to `earendil-works/pi`; the old npm package is deprecated in favour of `@earendil-works/pi-coding-agent`.
- **How it would work:** Target the current package; source findings pinned to commit `c3d8ce44d3231c7e46071d2d859f41ca7d39d21b` (2026-10-28 11:56:31 UTC); legacy marked separately.
- **Evidence / numbers:** F/M: legacy latest = 0.73.1 (Node >=20.6.0); current = 1.4.0 (Node >=22.19.0); both ESM. [repo](https://github.com/badlogic/pi-mono), [legacy metadata](https://registry.npmjs.org/@mariozechner/pi-coding-agent/0.73.1), [current metadata](https://registry.npmjs.org/@earendil-works/pi-coding-agent/1.4.0).
- **Prior art / who has it:** Pi (Mario Zechner, now Earendil Works).
- **Verdict:** FINDING — corrects the brief's package identity; all later work targets 1.4.0.
- **Kill test / first proof:** None given.

#### Finding: the split already partly exists upstream (pi-durable, pi-env)
- **What:** `@earendil-works/pi-durable` provides persisted conversations, generation/tool tasks, checkpointed sleeps, recovery and a Cloudflare DO SQLite adapter (README shows DO constructor/alarm/`onWake` integration); `@earendil-works/pi-env` supplies remote file ops and execution through a Rust daemon, normally over SSH.
- **How it would work:** Use pi-durable as the brain harness with DO storage and pi-env-style ExecutionEnv for hands, instead of a hypothetical Node-compat project.
- **Evidence / numbers:** F: pi-durable is explicitly experimental, a distinct harness rather than a CLI mode, and its extension API is not the CLI extension API; the CLI still uses `AgentSession`/`SessionManager`. [durable README](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/durable/README.md), [env README](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/env/README.md), [sdk.ts](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/src/core/sdk.ts).
- **Prior art / who has it:** Pi itself (pi-durable, pi-env).
- **Verdict:** FINDING — substantial in-project prior art; undercuts "grow Node until the unmodified CLI works" as the starting point.
- **Kill test / first proof:** None given.

#### Pi package anatomy (eleven packages)
- **What:** The monorepo has `ai`, `agent`, `coding-agent`, `tui`, `durable`, `env`, `chord`, `codemode`, `mcp`, `telemetry`, `evals`.
- **How it would work:** `pi-agent-core` holds the model/tool loop with no direct Node builtin imports in `src`; `pi-ai` holds providers; `coding-agent` holds CLI/SDK/tools/sessions/extensions; `codemode` has QuickJS-WASM with Node and Cloudflare paths; `env`'s SSH connection uses Node processes; `chord` has typed document/plugin/RPC/host contracts and storage; `evals` is developer infrastructure, not a required runtime.
- **Evidence / numbers:** F: loop streams assistant events, validates tool args, runs tools sequentially or in parallel (per-path queue for file mutations), repeats until settled; compaction/branch summaries make separate model calls; usage includes input/output/cache tokens and cost. [loop](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/agent/src/agent-loop.ts), [package map](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/README.md).
- **Prior art / who has it:** Pi.
- **Verdict:** FINDING — the agent loop is already separable from CLI/TUI.
- **Kill test / first proof:** None given.

#### Finding: provider selection controls the Node surface
- **What:** `pi-ai` provides OpenAI/Anthropic/Google/Bedrock etc. through provider-specific streaming; `ModelRuntime.streamSimple()` resolves credentials/routing/transforms.
- **How it would work:** Browser-safe fetch/API-key provider paths avoid OAuth, AWS credential files, local HTTP callback servers and proxy machinery; `pi-agent-core` accepts a supplied stream function, so portable code registers only its required provider.
- **Evidence / numbers:** F: native SDKs include `openai`, `@anthropic-ai/sdk`, `@google/genai`, AWS Bedrock/Smithy, proxy agents. [model-runtime](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/src/core/model-runtime.ts), [browser smoke check](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/scripts/check-browser-smoke.mjs).
- **Prior art / who has it:** Pi's selective-provider browser smoke check.
- **Verdict:** FINDING — part of the recommended design (one selected provider).
- **Kill test / first proof:** None given.

#### Built-in tools and their replacement seams
- **What:** Default tools `read`, `bash`, `edit`, `write`; extra built-ins `grep`, `find`, `ls`, `powershell` (Windows-local); read-only set read/grep/find/ls; MCP, tool search and codemode are CLI built-in extensions the SDK does not auto-install.
- **How it would work:** Each tool has an operations seam (`ReadOperations`, `WriteOperations`, `EditOperations`, `BashOperations.exec` + spawn hook, `LsOperations`, `GrepOperations`, `FindOperations`, PowerShell ops) that a Worker host can replace.
- **Evidence / numbers:** F: default grep/find spawn or download native `rg`/`fd`; bash output above thresholds spills to a local temp file even when exec is replaced, so a remote `exec` adapter alone does not remove all filesystem dependencies; `pi.exec`, user bash, package management, MCP stdio and OAuth helpers are further process paths. [tools index](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/src/core/tools/index.ts), [bash.ts](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/src/core/tools/bash.ts), [output-accumulator](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/src/core/tools/output-accumulator.ts).
- **Prior art / who has it:** Pi.
- **Verdict:** FINDING — seams exist; spill files and other process paths still need explicit treatment.
- **Kill test / first proof:** None given.

#### Finding: the edit tool needs no shell
- **What:** Pi's text `edit` tool works purely through injected file operations.
- **How it would work:** `createEditTool` with operations-backed `access → read → write` on a virtual file.
- **Evidence / numbers:** M: passed in both Node and local workerd; no shell invoked. Does not establish POSIX filesystem parity or large-file behaviour.
- **Prior art / who has it:** Pi `EditOperations`.
- **Verdict:** FINDING — falsifies a hard shell dependency for editing.
- **Kill test / first proof:** None given (this is itself the proof).

#### Finding: CLI sessions are file-backed JSONL; in-memory seams are partial
- **What:** CLI sessions are append-oriented JSONL v3 under `~/.pi/agent/sessions/<encoded-cwd>/`, a branchable tree of records (IDs/parent IDs, model/thinking changes, messages, compaction, extension entries).
- **How it would work:** `SessionManager.inMemory()`, in-memory settings and credential/storage seams exist, but settings, auth, models, resources and temp output each need separate treatment.
- **Evidence / numbers:** F: persistence uses synchronous mkdir/open/read/append/write plus async discovery. [session-manager](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/src/core/session-manager.ts), [SDK storage contract](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/docs/sdk.md#sessionmanager-api).
- **Prior art / who has it:** Pi.
- **Verdict:** FINDING — replacing the session manager does not replace all file-backed services.
- **Kill test / first proof:** None given.

#### Finding: CLI extension compatibility is unbounded
- **What:** CLI extensions are arbitrary JS/TS factories (discovered from paths or inline) that can register tools, commands, shortcuts, providers and hooks, and import any npm dependency/Node API.
- **How it would work:** Loading uses jiti, filesystem resolution, `createRequire` and Node loader hooks; a Worker host should bundle a deliberate extension set or use the durable registry.
- **Evidence / numbers:** F: no finite builtin list can prove arbitrary extension compatibility. [loader](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/src/core/extensions/loader.ts), [extensions doc](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/docs/extensions.md).
- **Prior art / who has it:** Pi.
- **Verdict:** FINDING — "every API Pi plus every extension uses" is not a closable target.
- **Kill test / first proof:** See blocker 4.

#### Embedding option: interactive TUI
- **What:** Run Pi's terminal UI as the Worker brain.
- **How it would work:** Needs `process.stdin/stdout`, raw mode, resize/signals, terminal protocols, optional native clipboard.
- **Evidence / numbers:** F: [CLI mode contract](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/docs/cli.md).
- **Prior art / who has it:** Pi.
- **Verdict:** KILLED as Worker brain — keep in the client or execution host.
- **Kill test / first proof:** None given.

#### Embedding option: print/text or JSON headless CLI
- **What:** One-shot CLI emitting stdout text or JSONL events.
- **How it would work:** Process startup/exit plus ordinary CLI services.
- **Evidence / numbers:** F: mode contract as above.
- **Prior art / who has it:** Pi.
- **Verdict:** KILLED as Worker lifecycle — useful only as an execution-host command.
- **Kill test / first proof:** None given.

#### Embedding option: RPC mode
- **What:** Long-lived JSONL stdin/stdout control protocol; the RPC client launches a child process.
- **How it would work:** External-process integration over stdio.
- **Evidence / numbers:** F: not HTTP/Workers RPC; still a process/stdio lifecycle. [rpc-mode](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/src/modes/rpc/rpc-mode.ts), [rpc-client](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/src/modes/rpc/rpc-client.ts).
- **Prior art / who has it:** Pi.
- **Verdict:** KILLED as Worker embedding — good for external processes only.
- **Kill test / first proof:** None given.

#### Embedding option: coding-agent SDK (`createAgentSession`)
- **What:** In-process session with event subscriptions and injectable services/tools.
- **How it would work:** Preserves much CLI behaviour with deliberate resource/storage/tool adapters (memory settings/session, credential stub, `modelsPath:null`, supplied resource loader).
- **Evidence / numbers:** M: minimal in-memory session/edit path passed under workerd (see SDK experiment).
- **Prior art / who has it:** Pi SDK.
- **Verdict:** RUNNER-UP — correct choice among CLI modes; viable alternate if preserving CLI session/extension behaviour is essential.
- **Kill test / first proof:** Blocker 4 profile test.

#### Embedding option: `pi-agent-core` + selected `pi-ai` providers
- **What:** Smallest brain: the bare agent loop with supplied model stream and tools.
- **How it would work:** Host implements persistence, recovery and CLI conveniences itself.
- **Evidence / numbers:** F: `pi-agent-core` src has no direct Node builtin imports.
- **Prior art / who has it:** Pi.
- **Verdict:** RUNNER-UP — smallest, but pushes persistence/recovery onto the host.
- **Kill test / first proof:** None given.

#### Embedding option: pi-durable + Cloudflare storage + ExecutionEnv
- **What:** Durable tasks/conversations, commits, explicit alarms and environment capabilities.
- **How it would work:** DO SQLite stores session/task metadata; a file-capability adapter owns workspace versions; supplied tools issue durable runner jobs with persistent job/call IDs; runner completion arrives as an event and is committed before the next turn (I).
- **Evidence / numbers:** F/I: pi-env's Node SSH transport is not a Worker transport — needs a runner HTTP/service-binding adapter and a workspace sync policy; pi-durable's conversation SQLite adapter does not store workspace files. [durable sleep/wake](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/durable/README.md#sleeping-and-waking-up).
- **Prior art / who has it:** Pi (pi-durable, pi-env).
- **Verdict:** KEPT (#1, preferred upstream starting point) — if its experimental API and different extensions are acceptable.
- **Kill test / first proof:** Blockers 1–3 experiments.

#### Experiment: portable durable harness under workerd
- **What:** Bundled `pi-durable` + `pi-ai` faux provider + Chord context + MemoryStorage in local workerd 2026-10-25 (compat date 2026-10-25, loopback HTTP, no account/model API).
- **How it would work:** A request created a conversation, submitted input, completed a fake model turn, read the committed assistant entry, closed the harness.
- **Evidence / numbers:** M: PASS — HTTP 200, settlement `done`; unminified bundle 911,879 bytes; no external Node builtin imports in bundle metadata. Not a deployed DO, SQLite restart, real provider or hibernation test.
- **Prior art / who has it:** Pi pi-durable.
- **Verdict:** FINDING (PASS).
- **Kill test / first proof:** None given.

#### Experiment: coding-agent SDK import/session/edit under workerd
- **What:** Load the ordinary SDK root in workerd and create/dispose an `AgentSession`.
- **How it would work:** Bundler CJS `require`/`import.meta.url` failures fixed with a `createRequire` banner and fixed bundle file URL; memory settings/session, credential stub, `modelsPath:null`, no catalog refresh, supplied resource loader, `noTools:'all'`.
- **Evidence / numbers:** M: PASS with host wiring, no package source change; operations-backed edit passed; unminified bundle 13,327,471 bytes (broad root export, not optimized); no model prompt or real shell exercised.
- **Prior art / who has it:** Pi SDK.
- **Verdict:** FINDING (PASS with wiring).
- **Kill test / first proof:** None given.

#### Experiment: native artifact inspection
- **What:** Inventory of native/WASM artifacts in installed runtime packages.
- **How it would work:** Inspect `.node`, `.wasm`, `.so` files.
- **Evidence / numbers:** M: six TUI `.node` platform builds, Photon WASM, QuickJS WASM; QuickJS's five `.so` files are WASM (magic bytes), not host ELF/Mach-O; no mandatory `.node` addon needed by either passing probe.
- **Prior art / who has it:** —
- **Verdict:** FINDING — argues against a general "grow Node until unmodified CLI works" campaign; also against declaring the SDK impossible from a `child_process` grep (I).
- **Kill test / first proof:** None given.

#### Finding: first-party and transitive Node builtin inventory
- **What:** AST-based inventory of runtime Node imports/members across `packages/*/src`, plus external builtins in the resolved SDK probe graph.
- **How it would work:** Distinguish runtime vs type-only imports; per-builtin API lists (fs sync/stream/watch/glob, fs/promises incl. `statfs` (evaluator only), child_process spawn/spawnSync/execFile/execSync/fork, many `process` members, TTY via process, readline, os, worker_threads, module `createRequire`/`registerHooks`, path, url, crypto, events, stream, string_decoder, timers/promises with `unref`, http createServer for OAuth/MCP, net in Chord Node host, `sqlite` DatabaseSync in Chord Node adapter, zlib, Buffer, perf_hooks/util, assert/strict in telemetry conformance only).
- **Evidence / numbers:** M/F: resolved SDK graph additionally exposes assert, async_hooks, console, constants, diagnostics_channel, dns, http2, querystring, stream/web, timers, tls, tty, util/types, v8, vm (via undici, proxy/auth/HTTP SDKs, cross-spawn, proper-lockfile/graceful-fs, jiti). Import inventory, not proof every branch executed. [coding-agent manifest](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/package.json).
- **Prior art / who has it:** —
- **Verdict:** FINDING — not exhaustive for provider SDKs or future extensions.
- **Kill test / first proof:** None given.

#### Finding: Cloudflare marks key modules as non-functional stubs; Workers fs is not a project disk
- **What:** child_process, readline, tty, worker_threads, sqlite, vm and v8 are non-functional compatibility stubs; Workers `fs` is a VFS with read-only bundled modules and temporary in-memory files.
- **How it would work:** Imports may succeed while operations do not; watch/glob/permissions semantics incomplete.
- **Evidence / numbers:** F: [stub list](https://developers.cloudflare.com/workers/runtime-apis/nodejs/#non-functional-stub-modules), [VFS semantics](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/).
- **Prior art / who has it:** Cloudflare Workers.
- **Verdict:** FINDING — shimming path/Buffer is a different problem from a durable filesystem, processes or native addons.
- **Kill test / first proof:** None given.

#### Finding: native code, WASM and external programs
- **What:** TUI N-API `.node` helpers (Darwin/Windows/Linux X11, lazy, fallback on failure); `@silvia-odwyer/photon-node@0.3.4` WASM (1,881,634 bytes) via fs/CJS wrapper with worker-thread resizer falling back in-process; pi-durable `images/cloudflare` adapter using `@silvia-odwyer/photon@0.3.3` (1,880,773 bytes); `quickjs-wasi@3.6.2` (637,405-byte core WASM + extensions) with Node worker-thread, portable, Cloudflare and separate-isolate paths; external programs (shell, `rg`/`fd`, git/npm, clipboard/open, SSH, Rust pi-env daemon).
- **How it would work:** External programs belong on an execution host or need explicit replacements; QuickJS is not a reason to emulate worker_threads in the DO.
- **Evidence / numbers:** F/M: no mandatory sharp/node-pty; legacy 0.73.1 differs (optional `@mariozechner/clipboard@^0.3.5` with platform natives). Durable docs warn about decoded-image and retained WASM memory in small hosts. [native-platform loader](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/tui/src/native-platform.ts), [codemode cloudflare](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/codemode/src/cloudflare.ts), [durable images](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/durable/README.md#images).
- **Prior art / who has it:** Pi (Cloudflare codemode and image adapters).
- **Verdict:** FINDING — no native addon blocks the core loop; external programs cannot be supplied by making imports succeed.
- **Kill test / first proof:** None given.

#### Measurement: local session census method
- **What:** Local-only aggregate analysis of real Claude Code and Codex session logs (one machine/user; not Pi telemetry).
- **How it would work:** Claude: `~/.claude/projects/*/*.jsonl`, 212 of 219 stable files, subagent logs excluded, `forkedFrom` excluded, UUID dedupe, `api-request`→final assistant timestamps; Codex: `~/.codex/sessions/`, 304 of 319 files, 310 turns, `task_started/complete/turn_aborted` and item timings. Per-session interval unions summed.
- **Evidence / numbers:** M: 516 session files, 24,396 shell invocations; Claude 2026-10-06–28, Codex 2026-10-23–28; cutoff mtime before 2026-10-28 11:16:58 UTC; 12,402/14,583 Claude model messages (85.0%) had matching request starts (rest attributed, I); 1,596 human/SDK inputs and 1,072 system wake inputs; zero malformed lines. Wall-clock traces, not CPU/network/syscall traces.
- **Prior art / who has it:** —
- **Verdict:** FINDING (method).
- **Kill test / first proof:** None given.

#### Finding: 80–95% model wait is not established for weighted active wall time
- **What:** Disjoint active-wall partition does not show model wait dominating.
- **How it would work:** Compare model-interval and tool-interval unions within active episodes/turns.
- **Evidence / numbers:** M: Claude span 1,783.48 h, active 164.87 h, idle 90.76% of span; model 53.11% of active, tools 45.38%, overlap 0.25%, neither 1.75% (model-only 52.86%, tools-only 45.14%). Codex span 116.40 h, active 114.33 h, idle 1.78%; model 50.32%, tools 51.54%, overlap 27.44%, neither 25.58%. M/I: explicit-request-only Claude model time 39.53 h = 23.98% of active; dropping gaps >300 s leaves 69.65 h with model 67.61%. Codex controller-awaiting-tool 17.39 h (15.21%) gives a tempting 84.79% residual that is not measured model wait; physical command-event union 55.84 h. Median per-file Claude model share 78.8% vs weighted 53.1%; median Codex residual 91.9%.
- **Prior art / who has it:** —
- **Verdict:** FINDING — undercuts the economic premise; the quoted range fits selected medians or a controller-only convention only.
- **Kill test / first proof:** See blocker 5.

#### Finding: model waiting is not DO hibernation
- **What:** A DO awaiting a live provider stream stays active and billable.
- **How it would work:** Pending outbound I/O/connections, unfinished events and timers prevent hibernation; in-memory state is discarded on hibernation. It can release an execution host meanwhile; callback/deferred model execution would be a different protocol. Pi Durable's stored sleeps/wake alarms help only between runnable phases, not a live JS continuation.
- **Evidence / numbers:** F/I: [DO lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/), [upstream wake tests](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/durable/test-workers/wake.test.ts).
- **Prior art / who has it:** Cloudflare DO lifecycle; pi-durable wake/recovery.
- **Verdict:** FINDING — kills the hibernation-during-inference justification (see blocker 2).
- **Kill test / first proof:** See blocker 2.

#### Finding: shell commands are short by count, with a long tail
- **What:** Shell invocation frequency and duration distribution.
- **How it would work:** Count Bash tool invocations / Codex CommandExecution items (incl. failures, sleeps, pollers, servers).
- **Evidence / numbers:** M (Claude / Codex): invocations 9,862 / 14,534; per span-hour 5.53 / 124.86; per active hour 59.82 / 127.13; p50 0.265 s / 0.088 s; p90 12.897 s / 9.623 s; p99 250.475 s / 602.818 s; <1 s 64.90% / 73.91%; <5 s 82.51% / 86.68%; <30 s 93.72% / 94.08%; >300 s 89 (0.90%) / 254 (1.75%); max 60,826 s / 60,023 s. 6,167 Codex durations (42.4%) below 1 ms — harness metric, not OS spawn cost.
- **Prior art / who has it:** —
- **Verdict:** FINDING — "mostly short" holds by count; p90/p99 require long-lived jobs and reconnect/poll semantics.
- **Kill test / first proof:** None given.

#### Finding: what commands are (lexical classification)
- **What:** Share of commands in a strict simple file/text subset vs build/test/install.
- **How it would work:** Accept only if every command head is in `ls cat grep rg sed find head wc` (+ `cd pwd true echo printf`); reject heredocs, substitutions, loops, opaque scripts.
- **Evidence / numbers:** M (Claude / Codex): strict simple 2,417 (24.51%) / 2,800 (19.27%); build/check 2.23% / 3.28%; tests 0.62% / 0.46%; installs 0.78% / 0.39%; other package ops 2.59% / 0.85%; other/mixed 69.28% / 75.75%; build/check/test/install subtotal 3.63% / 4.14%. Strict-simple p50/p90/p99 Claude 0.046/0.219/1.331 s, Codex 0.000009/0.060/1.892 s; summed strict-simple 595 / 1,060 s = 0.299% / 0.204% of summed command durations.
- **Prior art / who has it:** —
- **Verdict:** FINDING — simple subset is a minority by count and negligible by time.
- **Kill test / first proof:** None given.

#### Hands option: TypeScript shell for the simple subset
- **What:** Run `ls/cat/grep/...` commands in a TS shell inside the brain instead of waking a runner.
- **How it would work:** Intercept strict-simple commands and serve them from the workspace adapter.
- **Evidence / numbers:** I: could remove many wakes and reduce navigation tail latency; M: subset is ~19–25% of invocations and ~0.2–0.3% of command-seconds.
- **Prior art / who has it:** —
- **Verdict:** NARROWED — useful for latency/wake count, but does not remove most execution-host occupancy; predicting proportional infra savings from counts would mislead.
- **Kill test / first proof:** None given.

#### Finding: file bytes touched are not recoverable from transcripts
- **What:** Native file-tool payloads are observable; shell/build/install I/O is not.
- **How it would work:** Sum UTF-8 payloads of native tool records.
- **Evidence / numbers:** M: Claude Read result text 4,619,006 B (not bytes read); Claude Write content 3,804,853 B over 412 calls; Claude Edit old/new 52,290 / 200,634 B over 269 calls; Codex file-change content 5,788,080 B; Codex diff added/removed 804,492 / 238,277 B; Codex 543 adds / 954 updates / 3 deletes; 584 Claude / 754 Codex distinct native-tool paths per session summed. I: shell I/O, builds, installs, mmap, caches are non-identifiable.
- **Prior art / who has it:** —
- **Verdict:** FINDING — insufficient to size DO workspace storage, sync bandwidth or dirty-set volume; requires a live trace (blocker 1).
- **Kill test / first proof:** See blocker 1.

#### Blocker 1: durable workspace and runner coherence
- **What:** CLI JSONL/temp/auth files assume Node FS semantics; Worker VFS is temporary and pi-durable's conversation storage is not a workspace FS. A shell must see exactly the files local read/edit/write just committed, and its dirty files must return before the next turn; shell I/O volume is unknown.
- **How it would work:** Needs an authoritative versioned workspace plus dirty-set protocol between DO and runner.
- **Evidence / numbers:** F/M/I as above.
- **Prior art / who has it:** —
- **Verdict:** Rank 1, score 25 (5×5) — open, highest.
- **Kill test / first proof:** E 4 h: instrument a local execution host's file ops and process tree; run 20 representative build/edit/install scripts plus 100 deterministic read→edit→shell→read cases (rename/symlink, binary, BOM/CRLF, large file, concurrent writes), recording bytes and dirty sets. **Pass:** zero hash mismatches/lost updates across 100 round trips and restart, bounded dirty-set transfer with measured p95 latency. **Fail:** correctness needs an always-mounted writable Node FS, or no authoritative version/dirty-set protocol exists.

#### Blocker 2: hibernation cannot cover an awaited provider stream
- **What:** Cloudflare lifecycle conditions contradict treating normal model wait as sleeping DO time; CLI retry/cache-warming timers add obstacles.
- **How it would work:** Only idle/callback-wait phases with no open I/O/timers can hibernate; the runner/brain split can still work.
- **Evidence / numbers:** F: DO lifecycle docs.
- **Prior art / who has it:** —
- **Verdict:** Rank 2, score 20 (5×4) — confirmed mismatch; kills the specific hibernation justification.
- **Kill test / first proof:** E 1–2 h: local DO + delayed fake SSE endpoint (60 s stream, then finish) vs stored task awaiting a later completion event then 60 s idle; inspect pending events/timers, test eviction/reconstruction. **Pass:** idle/callback-wait phases have no open I/O/timers, survive fresh-instance reconstruction, resume once. **Fail:** design requires retaining the awaited continuation while calling the DO hibernated. (Production billing needs later account-backed check.)

#### Blocker 3: replay of external side effects
- **What:** Upstream durable recovery deliberately retries interrupted model requests and task phases; shell commands are not idempotent, so a crash after execution but before result commit can duplicate a mutation.
- **How it would work:** Needs runner jobs keyed by tool-call/job ID with stored results.
- **Evidence / numbers:** F/I: [recovery semantics](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/durable/README.md#persist-and-resume) — not exactly-once for an external runner.
- **Prior art / who has it:** pi-durable recovery.
- **Verdict:** Rank 3, score 20 (4×5) — open.
- **Kill test / first proof:** E 2–4 h: fake runner increments a durable counter keyed by job ID; kill/reopen brain before dispatch, after dispatch, after execution, before and after result commit; 100 repeats with fake model. **Pass:** each admitted job mutates once, every conversation gets the same stored result, no stranded tasks. **Fail:** duplicate mutation or unresolved job.

#### Blocker 4: full CLI/extension compatibility exceeds the portable core
- **What:** jiti/dynamic modules, process APIs, stdio MCP, OAuth callbacks, package downloads and native TUI helpers lie outside the passing minimal probes; arbitrary extensions grow the graph without bound.
- **How it would work:** Declare an explicit supported profile instead.
- **Evidence / numbers:** F/M as above.
- **Prior art / who has it:** —
- **Verdict:** Rank 4, score 16 (4×4) — open.
- **Kill test / first proof:** E 3 h: bundle one provider via fake HTTP, read/write/edit/bash adapter, truncation spill, compaction, one inline extension, one HTTP MCP tool; 100 fake model/tool turns under workerd with process/TTY APIs set to throw. **Pass:** zero process/TTY calls in brain, working abort/timeouts, bounded bundle/memory, explicit profile. **Fail:** product requires arbitrary file-loaded Node extensions unchanged.

#### Blocker 5: economic premise may use the wrong denominator
- **What:** Weighted model wait is not shown at 80–95%; background jobs overlap generation; simple reads are tiny in summed time; wake/sync overhead may dominate tiny commands.
- **How it would work:** Model infra cost from measured workload mix with realistic wake delays.
- **Evidence / numbers:** M/I: census above.
- **Prior art / who has it:** —
- **Verdict:** Rank 5, score 12 (3×4) — open.
- **Kill test / first proof:** E 2 h: replay synthetic equivalents of command timing/category aggregates through stub runners with 1/10/100/1,000 ms wake delays; track job-active union, controller wait, sync and simultaneous live runners. **Pass:** modelled total infra is lower at measured mix and desired latency, counting hibernation only in eligible phases. **Fail:** savings require excluding background lifetime, idle double-counting, or assuming all non-tool time is model wait.

#### Blocker 6: image/codemode resource envelope
- **What:** CLI image resizing uses worker_threads and FS-loaded WASM; native clipboard addons cannot run in a Worker; decoded Photon memory can be large.
- **How it would work:** Use existing Cloudflare/portable adapters with deterministic reject/offload for oversized inputs.
- **Evidence / numbers:** F/M as above; optional for a text-only MVP.
- **Prior art / who has it:** Pi Cloudflare image/codemode adapters.
- **Verdict:** Rank 6, score 9 (3×3) — open, deferrable.
- **Kill test / first proof:** E 1–2 h: repeated small/large synthetic images and 100 codemode calls, recording peak/retained memory. **Pass:** under a chosen 96 MiB application budget with deterministic reject/offload and no Node thread/addon calls. **Fail:** required image workload exceeds budget without an offload path.

#### First three verifications (report's order)
- **What:** (1) workspace/runner coherence + actual I/O trace (blocker 1); (2) DO wake/recovery with fake model and runner, incl. crash-after-side-effect, request-ID dedupe, no-I/O idle phases (blockers 2–3, extending upstream tests); (3) one deliberately supported end-to-end Worker profile, 100 fake turns, compaction/abort/spill, process/TTY forbidden (blocker 4), feeding blocker 5's cost model.
- **How it would work:** Run in that order before designing a compatibility filesystem or general Node shims.
- **Evidence / numbers:** Scratch artifacts: `/tmp/split-pi/session-aggregates.json`, `shell-package-aggregates.json`, `node-inventory-ast.json`, `native-inventory.json`, `probe-summary.json`.
- **Prior art / who has it:** pi-durable wake/recovery tests.
- **Verdict:** KEPT — go-with-changes plan for the brain layer.
- **Kill test / first proof:** Thresholds as in blockers 1–4.

### 02-compat: Node compatibility on workerd — the useful remainder is adapters, not a second Node
Lens: the Node-compatibility layer — what workerd/Wrangler/unenv already provide in October 2026, a local import-and-smoke census (Pi closures, 44 popular packages, 12 adapted Node upstream tests), and whether an agent "grow loop" adds value. Headline: current Pi 1.4.0 imports at 115/116 dependency roots and its text tools work, but the default bash tool and CLI exit are operations an isolate cannot provide, request-local FS is not durable (while DO synchronous SQLite/KV is), and Deno already publishes nearly the proposed agent grow loop. Bet: a headless Pi SDK in a DO with a project-owned `pi-workerd-adapters` layer (DO-backed workspace, explicit remote command operations); verdict **go-with-changes**, **no-go** if a complete unmodified CLI with default OS behaviour is mandatory.

#### Finding: `nodejs_compat` (v1+v2) is default from 2026-08-04
- **What:** Node compatibility is now date-controlled and on by default for recent compatibility dates.
- **How it would work:** Dates 2026-08-04+ enable `nodejs_compat` and v2 by default; 2024-09-23–2026-08-03 need `nodejs_compat`; earlier dates also need the v2 flag; disabling at current dates needs both negative flags.
- **Evidence / numbers:** F: further gates — `nodejs_compat_populate_process_env` (2025-04-01), `enable_nodejs_http_modules` (2025-08-15), `enable_nodejs_http_server_modules` (2025-09-01), process/OS/FS gates (2025-09-15 in runtime source; FS docs say 2025-09-01), `enable_nodejs_global_timers` (2026-02-10), child_process/readline/tty/repl/v8/worker_threads stub gates (2026-03-17), `new_module_registry` explicit. [announcement](https://developers.cloudflare.com/changelog/post/2026-08-04-nodejs-compat-default/), [flag reference](https://developers.cloudflare.com/workers/configuration/compatibility-flags/), [runtime schema](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/workerd/io/compatibility-date.capnp).
- **Prior art / who has it:** Cloudflare Workers.
- **Verdict:** FINDING — a switch, not a way to make an arbitrary Node process portable; pin a recent date and verify behaviour.
- **Kill test / first proof:** None given.

#### Finding: the new module registry fixes metadata/resolution failures
- **What:** The `new_module_registry` flag (September 2026) improves `import.meta.url`, `resolve`, CJS/ESM interop and Wasm loading.
- **How it would work:** Enable the flag explicitly; the umbrella does not enable it.
- **Evidence / numbers:** M: fixed both tested yargs versions and Pi TUI imports without generated code. [registry announcement](https://blog.cloudflare.com/workers-module-registry-nodejs/).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING — configuration, not growth, closes several gaps.
- **Kill test / first proof:** None given.

#### Finding: workerd's Node layer is a substantial implementation with an explicit partial-equivalence policy
- **What:** `src/node/` holds a TS/JS layer with upstream Node JS ports in `internal/`, native bindings in `src/workerd/api/node/`, and adapted Node tests.
- **How it would work:** The compatibility policy declines complete Node equivalence, prioritizes platform behaviour, allows incremental flagged implementations.
- **Evidence / numbers:** F: [src/node](https://github.com/cloudflare/workerd/tree/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node), [policy README](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node/README.md).
- **Prior art / who has it:** Cloudflare workerd.
- **Verdict:** FINDING — not merely Wrangler mocks.
- **Kill test / first proof:** None given.

#### Finding: Wrangler hybrid plugin + unenv mix real polyfills and mocks
- **What:** Wrangler calls `unenv.defineEnv()` with `@cloudflare/unenv-preset`, choosing aliases, globals, externals and polyfills by date/flags.
- **How it would work:** unenv supplies working pure-JS implementations and importable mocks (an available function may throw or no-op); keep native implementations rather than replacing the stdlib.
- **Evidence / numbers:** M: Wrangler 4.154.0, preset 2.16.2; browser package mappings can select the wrong implementation even when native builtins work. [hybrid plugin](https://github.com/cloudflare/workers-sdk/blob/fc57bc0e03b096cff58e949e67ccfb9f7832a3c2/packages/wrangler/src/deployment-bundle/esbuild-plugins/hybrid-nodejs-compat.ts), [unenv](https://github.com/unjs/unenv).
- **Prior art / who has it:** unjs/unenv, Cloudflare workers-sdk.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Finding: Cloudflare's module-level support labels
- **What:** Supported: assert, async context, Buffer, crypto, diagnostics channel, errors, events, fs, globals, HTTP/HTTPS, net, path, process, punycode, querystring, streams, string decoder, timers, URL, util, Web Crypto/Streams, zlib (debugger via DevTools). Partial: console, DNS, module, OS, perf hooks, test runner, TLS. Non-functional stubs: http2, vm, cluster, domain, trace_events, wasi, _stream_wrap, dgram, inspector, sqlite, child_process, readline, repl, tty, v8, worker_threads.
- **How it would work:** Treat labels as module-level only, not per-export or OS-semantics guarantees.
- **Evidence / numbers:** F: [compatibility index](https://developers.cloudflare.com/workers/runtime-apis/nodejs/).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Finding: Workers fs is a request-local memory VFS
- **What:** Read-only `/bundle`, writable request-local `/tmp`, some `/dev` devices; sync/callback/promise APIs over synchronous operations; `/tmp` counts against isolate memory.
- **How it would work:** Usable for scratch within one request; not a persistent workspace. Docs list missing watching, permissions, ownership; timestamps fixed at epoch.
- **Evidence / numbers:** M: sync write/read worked; two successive requests each saw the session file absent; mtime `0`; `fs.watch` threw `ERR_UNSUPPORTED_OPERATION`; `globSync` exists despite stale docs — relative npm globbing worked but absolute `/tmp/*` incorrectly returned `[]`. [FS docs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/), [glob impl](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node/internal/internal_fs_glob.ts).
- **Prior art / who has it:** Cloudflare workerd.
- **Verdict:** FINDING — ephemeral; see blocker 2.
- **Kill test / first proof:** None given.

#### Finding: DO synchronous SQLite and KV make a sync file adapter plausible
- **What:** SQLite-backed DOs expose synchronous SQL and synchronous KV via `ctx.storage.kv`.
- **How it would work:** Back Pi's synchronous file operations (sessions, settings) with DO-local sync storage.
- **Evidence / numbers:** M: SQL and KV calls returned non-Promises; data survived a second request and a full Miniflare/workerd restart with persistence enabled. Tests the primitive, not a POSIX FS. [DO storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).
- **Prior art / who has it:** Cloudflare Durable Objects.
- **Verdict:** FINDING — "all sync I/O is impossible" is wrong; basis for the DO workspace adapter.
- **Kill test / first proof:** See blocker 2.

#### Finding: TCP/TLS and virtual `net.Server`
- **What:** Outbound `net.Socket`/`tls.connect` wrap `cloudflare:sockets.connect()`; no TLS server.
- **How it would work:** `createServer().listen(0)` works via a virtual port table routed by `cloudflare:node.connectHandler`.
- **Evidence / numbers:** M/F: net docs say `net.Server` unsupported, but the October binary accepts it; does not open a public TCP port. [net](https://developers.cloudflare.com/workers/runtime-apis/nodejs/net/), [internal_net.ts](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node/internal/internal_net.ts), [node.ts](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/cloudflare/node.ts).
- **Prior art / who has it:** Cloudflare workerd.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Finding: hosted network boundary
- **What:** Service-binding inbound `connect()` handlers became production-usable August 2026; direct public inbound TCP unsupported.
- **How it would work:** Outgoing sockets restrict loopback/private/Cloudflare addresses and port 25.
- **Evidence / numbers:** F: localhost tests do not extrapolate to hosted networking. [connect handler](https://developers.cloudflare.com/changelog/post/2026-08-18-connect-handler/), [sockets](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Finding: child processes cannot run; sync remote exec is impossible
- **What:** workerd's `child_process.ts` validates some arguments then throws for spawn/exec.
- **How it would work:** Async command RPC to an execution host is possible but is a tool/backend substitution; `execSync` against a remote host cannot block the isolate for a network response.
- **Evidence / numbers:** M: `spawn`, `spawnSync` and both Pi versions' default bash tool threw `ERR_METHOD_NOT_IMPLEMENTED`. [child_process.ts](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node/child_process.ts).
- **Prior art / who has it:** —
- **Verdict:** FINDING — X boundary; see blocker 1.
- **Kill test / first proof:** See blocker 1.

#### Finding: HTTP server is a real adapter
- **What:** `createServer()` adapts to Workers via `httpServerHandler(server)` or `handleAsNodeRequest`; `listen(port)` is a routing key. Client ops wrap fetch; Agent pooling/keepalive restricted.
- **How it would work:** Node HTTP servers can serve Worker requests.
- **Evidence / numbers:** M: server on port 8080 returned `node-http-ok` through the adapter. [HTTP docs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Finding: process/env semantics
- **What:** Bindings/secrets can populate `process.env` (shared mutable isolate state, not per-session credentials); stdin empty, stdout/stderr are logs; `nextTick` via microtasks; hrtime not faithful.
- **How it would work:** Per-session credentials must not live in `process.env`.
- **Evidence / numbers:** M: cwd `/bundle`, argv `["workerd"]`, execPath empty, platform `linux` on macOS host; test variable visible; Pi CLI `--help` reached `process.exit(0)`, which canceled the request. [process docs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Finding: timers work but don't make JS durable
- **What:** `node:timers` provides timeout objects, immediates and promise variants; global-timer override gate supersedes old note.
- **How it would work:** Use stored state plus alarms/events for resumable work.
- **Evidence / numbers:** M: global handles had `refresh`; `unref` changed `hasRef`; nextTick/promise order probe passed. I: no libuv phase equivalence, no timer restore after eviction, no durable in-flight stack. [timers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/timers/).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Finding: no Cloudflare-published npm compatibility percentage
- **What:** No defensible Cloudflare figure for top-N npm packages passing a specified test.
- **How it would work:** Searched the compatibility index, 2025 retrospective, 2026 registry announcement and targeted queries.
- **Evidence / numbers:** F: [2025 retrospective](https://blog.cloudflare.com/nodejs-workers-2025/) says hundreds/thousands work, without a denominator.
- **Prior art / who has it:** —
- **Verdict:** FINDING — do not claim "95% npm compatibility"; this report's numbers are a selected corpus.
- **Kill test / first proof:** None given.

#### Finding: Pi renamed; both versions tested
- **What:** `@mariozechner/pi-coding-agent` 0.73.1 is deprecated in favour of `@earendil-works/pi-coding-agent` 1.4.0; GitHub redirects to `earendil-works/pi`.
- **How it would work:** Test legacy and current rather than silently testing an obsolete release.
- **Evidence / numbers:** F/M: [v1.4.0 manifest](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/package.json); current package is easier to import.
- **Prior art / who has it:** Pi.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Census: Pi dependency-closure imports under workerd
- **What:** Import every root of each Pi version's full installed closure under workerd (date 2026-10-25, `nodejs_compat`, Miniflare + supplied binary SHA-256 `a3056da8…7bf6`, Node 24.22.1 oracle, scratch peak ~501 MiB, install scripts/optional deps disabled).
- **How it would work:** Resolve with Node's resolver, attempt each root import in a request with separate build/import/smoke outcomes; exclude Node-root failures and harness mistakes.
- **Evidence / numbers:** M: legacy 0.73.1 base 166/182 = 91.2%; + missing optional build deps 174/182 = 95.6%; + new registry 176/182 = 96.7%; current 1.4.0 + new registry 115/116 = 99.1% (120 distinct name/version pairs; 21 vs 22 direct deps). Shallow: lazy paths, native extensions, subpaths and model streaming not certified.
- **Prior art / who has it:** —
- **Verdict:** FINDING — imports nearly all pass; import success is not execution success (blocker 4).
- **Kill test / first proof:** None given.

#### Finding: every legacy import failure was plausibly P (package/build fix)
- **What:** All 16 Node-importable legacy failures, grouped.
- **How it would work:** Optional `@opentelemetry/api` peer (pi-coding-agent/agent-core/ai, mistralai) → install peer; optional `source-map` (proxy-agent, pac-proxy-agent, pac-resolver, degenerator, escodegen) → install 0.6.1; `createRequire` undefined metadata (pi-tui, yargs 16.2.2) → new registry; `ENOENT /bundle/out/package.json` → register package metadata as bundle data module (SDK then imported, 127 exports); photon-node `__dirname` → CJS/asset wiring then precompiled Wasm import instead of runtime `new WebAssembly.Module(bytes)`; `mz`/`any-promise`/`thenify(-all)` `window is not defined` → correct entry/alias or scoped globalThis shim (not fixed).
- **Evidence / numbers:** M: seven excluded Node-root failures (`@types/mime-types`, `@tokenizer/token`, `@babel/runtime`, `@types/retry`, `@types/node`, `undici-types`, `ts-algebra`) are not compatibility gaps. Current 1.4.0: only photon failed.
- **Prior art / who has it:** —
- **Verdict:** FINDING — no Pi source edit needed for import.
- **Kill test / first proof:** None given.

#### Finding: Pi entry/tool smoke — text tools pass, bash and CLI exit fail
- **What:** Run Pi SDK roots, default text tools, bash tool and CLI `--help` under workerd.
- **How it would work:** Direct smoke per version.
- **Evidence / numbers:** M: both SDK roots imported (current: 157 exports, v1.4.0); default write/read wrote and read `hello` within one request via `/tmp`; both default bash tools failed at `child_process.spawn` `ERR_METHOD_NOT_IMPLEMENTED`; CLI `--help` worked on Node but `process.exit(0)` canceled the Worker request — no terminal or resident CLI process.
- **Prior art / who has it:** —
- **Verdict:** FINDING — literal "unmodified CLI with default tools" already failed.
- **Kill test / first proof:** See blocker 1.

#### Finding: default codemode fails; Pi's Cloudflare codemode adapter passes
- **What:** `CodemodeSandbox.execute('return 1+1')` vs `@earendil-works/pi-codemode/cloudflare` `createInlineCodemodeSandbox`.
- **How it would work:** Use the existing Cloudflare adapter; do not grow worker_threads (E/X).
- **Evidence / numbers:** M: default passed on Node, failed on workerd with `Failed to load QuickJS: createRequire(...).resolve is not a function` and would then need worker threads; Cloudflare adapter returned `2` once Wrangler's emitted `.wasm` was registered explicitly as `CompiledWasm` (harness packaging, not a platform failure).
- **Prior art / who has it:** Pi codemode Cloudflare adapter.
- **Verdict:** FINDING — reuse adapter.
- **Kill test / first proof:** None given.

#### Census: 44 popular packages, import plus a small real use
- **What:** Hand-picked mix of common and OS-facing libraries (not download-weighted), each with a smoke use; all pass on Node 24.
- **How it would work:** Per-package tiny Worker via `census.cjs`, Node baseline, one Miniflare request.
- **Evidence / numbers:** M: 37/44 = 84.1% stock; 38/44 = 86.4% with new registry (yargs); 39/44 = 88.6% adding ws Node-entry selection. Failures: yargs 18.2.0, ajv 8.20.0, ws 8.22.0, undici 8.12.3, execa 10.2.1, chokidar 6.0.0, typescript 5.9.3. I/E: 4/7 failures P (57.1%), 2/7 E (28.6%), 1/7 X (14.3%) — engineering judgments, two P repairs demonstrated; not an effort forecast.
- **Prior art / who has it:** —
- **Verdict:** FINDING — gains came from wiring, not new runtime code.
- **Kill test / first proof:** None given.

#### Repair: yargs via new module registry
- **What:** `createRequire` received undefined `import.meta.url`.
- **How it would work:** Enable `new_module_registry`.
- **Evidence / numbers:** M: verified fixed.
- **Prior art / who has it:** Cloudflare registry.
- **Verdict:** P — verified fixed.
- **Kill test / first proof:** None given.

#### Repair: ajv via interpreter or deploy-time standalone validators
- **What:** `Code generation from strings disallowed for this context`.
- **How it would work:** Use an interpreter or deployment-time standalone validator generation — a package/compiler change, not an `eval` polyfill.
- **Evidence / numbers:** M/I: arbitrary runtime code generation stays unavailable; unrestricted runtime schemas need separate validation.
- **Prior art / who has it:** —
- **Verdict:** P for tested validation semantics — not repaired here.
- **Kill test / first proof:** None given.

#### Repair: ws via its Node entry
- **What:** `m.WebSocketServer is not a constructor` (browser entry selected).
- **How it would work:** Select ws's Node `index.js`, handle CJS default exports.
- **Evidence / numbers:** M: virtual listen/close passed; public TCP, OS socket handles, arbitrary upgrades out of scope.
- **Prior art / who has it:** —
- **Verdict:** P — verified fixed.
- **Kill test / first proof:** None given.

#### Repair: undici via Workers fetch or precompiled llhttp Wasm
- **What:** `fetch failed`; cause `Wasm code generation disallowed by embedder` in lazy llhttp loading.
- **How it would work:** Use Workers fetch for HTTP, or repackage llhttp Wasm as a compiled module; no need to grow TCP or an HTTP parser for provider calls.
- **Evidence / numbers:** M/I: dispatcher/proxy details need contract tests.
- **Prior art / who has it:** —
- **Verdict:** E — not repaired here.
- **Kill test / first proof:** None given.

#### Repair: execa — packaging P, spawning X
- **What:** Build failure: missing `toPath`/`traversePathUp` from browser-selected `unicorn-magic/default.js`.
- **How it would work:** Fix packaging; actual command spawning cannot happen in the Worker — a tool-level async execution-host RPC is a changed backend, not a child_process polyfill.
- **Evidence / numbers:** M: spawn limit independently measured with builtins and Pi.
- **Prior art / who has it:** —
- **Verdict:** X for intended use.
- **Kill test / first proof:** None given.

#### Repair: chokidar via DO workspace mutation stream
- **What:** Native `fs.watch` throws `ERR_UNSUPPORTED_OPERATION`.
- **How it would work:** Emit watch events from a DO-backed workspace's mutation stream; cannot observe an execution host's OS FS without forwarding its events; request-local in-memory watching would be a smaller P.
- **Evidence / numbers:** M.
- **Prior art / who has it:** —
- **Verdict:** E — not repaired here.
- **Kill test / first proof:** None given.

#### Repair: TypeScript via CJS filename/asset wiring
- **What:** `__filename is not defined`.
- **How it would work:** CJS filename/dirname and asset wiring; transpilation is pure code, external builds/toolchains belong on the execution host.
- **Evidence / numbers:** M.
- **Prior art / who has it:** —
- **Verdict:** P — not repaired here.
- **Kill test / first proof:** None given.

#### Kill test result: "make all imports work, then grow the rest" rejected
- **What:** Package-count coverage cannot weight away one indispensable unsupported operation.
- **How it would work:** Legacy import failures were all plausibly P, current Pi has one; yet the required default bash operation is X.
- **Evidence / numbers:** M/I as above.
- **Prior art / who has it:** —
- **Verdict:** KILLED (import-count decision rule) — supports a small headless SDK port with explicit execution and storage adapters.
- **Kill test / first proof:** This was the report's first kill test.

#### Experiment: adapted Node v24 upstream tests
- **What:** Twelve synchronous assertion-body tests from Node v24.22.1 (`ce7aaf1c…`) under Node and workerd.
- **How it would work:** Replace `../common` with a minimal helper (`isWindows: false`), supply CJS `__filename`/`__dirname`, keep assertions.
- **Evidence / numbers:** M: Node 12/12; workerd 8/12. Pass: path basename/dirname/extname/isabsolute/relative, buffer-ascii, buffer-badhex, querystring-escape. Fail: `test-path-join.js` (Win32 device/drive normalization), `test-path-normalize.js` (Win32 device trailing separator), `test-buffer-compare.js` (error field/message `buf2` vs `b`), `test-buffer-copy.js` (missing exception) — four P failures. [test dir](https://github.com/nodejs/node/tree/v24.22.1/test/parallel).
- **Prior art / who has it:** Node upstream tests.
- **Verdict:** FINDING — real growable pure-code gaps exist; Win32 cases lower priority than Linux-style workspace ops.
- **Kill test / first proof:** None given.

#### Design: explicit upstream-test runner (not a loader shim)
- **What:** Node's `test/common/index.js` loads process/build config, worker_threads, test dirs and lifecycle checks, so a shim does not make it portable.
- **How it would work:** Small explicit runner preserving assertion logic and must-call accounting, awaiting completion, checking async errors, naming every adaptation; never no-op assertions or equate "imported" with "completed".
- **Evidence / numbers:** F/I: [test/common](https://github.com/nodejs/node/blob/v24.22.1/test/common/index.js).
- **Prior art / who has it:** —
- **Verdict:** KEPT (part of grow-loop design).
- **Kill test / first proof:** None given.

#### Design: next Node test families to port
- **What:** `test-buffer-*`, `test-assert-*`, `test-querystring-*`, `test-path-*`, `test-string-decoder-*`, pure `test-util-*`, in-memory stream/EventEmitter tests; FS tests on a declared subset on `/tmp` or a DO adapter.
- **How it would work:** Inspect each file; e.g. `test-buffer-bytelength.js` and `test-querystring.js` use `vm`, `test-path-resolve.js` uses subprocess/fixtures, promise timers use `node:test` — extract assertions. Host permission, mount, process, native addon, signals, public listener, CLI flags and blocking remote-I/O tests go to documented exclusions or execution-host tests.
- **Evidence / numbers:** I.
- **Prior art / who has it:** —
- **Verdict:** KEPT (suggested scope).
- **Kill test / first proof:** None given.

#### Design: reuse Cloudflare's adapted Node tests
- **What:** workerd already maintains adapted Node tests (Buffer, FS, v24 stream regressions).
- **How it would work:** Reuse instead of building an incompatible second harness.
- **Evidence / numbers:** F: [buffer tests](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/workerd/api/node/tests/buffer-nodejs-test.js), [fs tests](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/workerd/api/node/tests/fs-nodejs-test.js), [streams v24](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/workerd/api/node/tests/streams-v24-nodejs-test.js).
- **Prior art / who has it:** Cloudflare workerd.
- **Verdict:** KEPT.
- **Kill test / first proof:** None given.

#### Design: bounded operation-level grow-loop iteration
- **What:** One iteration = one operation-level compatibility repair from a real failing Pi call.
- **How it would work:** (1) capture the call (input, error/cause, package integrity/version, runtime date/flags, semantics), reduce to fixture, check date/registry/package conditions/existing adapters first; (2) assign P/E/X before code — P gets a patch + bounded upstream tests, E an adapter contract, X routed to execution host or out of scope; changing skip lists don't count; (3) run on Node 24 (pinned oracle) and workerd, distinguishing deliberate version differences; (4) compare canonicalized observations (bytes, types, results, error name/code; exact messages when required; stream bytes + event ordering/backpressure/cancellation, not chunk boundaries); (5) control nondeterminism (seeded inputs, injected clock/RNG, property checks for crypto randomness, happens-before for timers, multiple legal schedules, replayable seeds, bounded reruns for flakes; never normalize away missing events/exceptions/lost writes); (6) accept only real regression improvement with unchanged assertions; deterministic stub model stream for end-to-end tests.
- **Evidence / numbers:** I; a green import census alone never accepts a patch.
- **Prior art / who has it:** Deno node-compat skill (near-identical workflow).
- **Verdict:** KEPT as bounded experiment — not the project's prerequisite or novelty.
- **Kill test / first proof:** See blocker 5 (five-case loop).

#### Design: project-owned `pi-workerd-adapters` package (not a workerd fork)
- **What:** Versioned build/adapter layer for grown code.
- **How it would work:** Scoped package/loader fixes, precompiled Wasm imports, explicit bundle assets; no blanket global `window` shim.
- **Evidence / numbers:** I.
- **Prior art / who has it:** —
- **Verdict:** KEPT (#1 placement).
- **Kill test / first proof:** None given.

#### Design: DO-local workspace adapter on synchronous SQLite/KV
- **What:** Back required sync file operations with DO SQLite/KV and expose async interfaces for tools.
- **How it would work:** Track files/inodes, bytes and offsets, stat data, directories and rename invariants explicitly; scope session/DO through explicit parameters or async context, not an isolate-global map.
- **Evidence / numbers:** M: DO sync primitive survived restart.
- **Prior art / who has it:** Cloudflare DO SQLite/KV.
- **Verdict:** KEPT — tested by blocker 2.
- **Kill test / first proof:** See blocker 2.

#### Design: replace Pi tool operations rather than reimplement child_process
- **What:** Use Pi's `operations` injection for bash/read/write/edit/grep/find and storage/service factories.
- **How it would work:** Route bash to an execution host through `BashOperations`; replace session storage through `SessionManager` boundaries.
- **Evidence / numbers:** F: [bash.ts v1.4.0](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/core/tools/bash.ts), [session-manager v1.4.0](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/core/session-manager.ts).
- **Prior art / who has it:** Pi.
- **Verdict:** KEPT.
- **Kill test / first proof:** See blocker 1.

#### Design: upstream pure built-in fixes to workerd/unenv/npm packages
- **What:** Generally useful fixes to existing native built-ins (Buffer validation, path behaviour) go to a workerd PR with adapted Node tests.
- **How it would work:** Implementations in `src/node/internal`, wrappers in `src/node`, native in `src/workerd/api/node`; a shipped Worker cannot patch `node-internal:*`, so package solutions must alias/inject at build time; cross-runtime fixes go to unenv or the npm package. DO storage and execution-host policy stay application adapters.
- **Evidence / numbers:** I.
- **Prior art / who has it:** Cloudflare workerd, unenv.
- **Verdict:** KEPT (routing rule).
- **Kill test / first proof:** None given.

#### Finding: hibernation does not snapshot a pending agent loop
- **What:** Hibernation does not preserve a pending Node agent loop, open stream, subprocess handle or JS continuation.
- **How it would work:** Persist session entries, tool intentions/results, workspace changes and retry IDs at event boundaries; reconstruct SDK state on a new request. A sync DO file adapter keeps file API shape but neither recovers continuations nor makes network `execSync` synchronous.
- **Evidence / numbers:** I.
- **Prior art / who has it:** —
- **Verdict:** FINDING — architectural consequence; see blocker 3.
- **Kill test / first proof:** See blocker 3.

#### Prior art: Cloudflare/workerd
- **What:** Incremental Node compatibility with upstream-test reuse; repository `AGENTS.md` explicitly supports coding agents.
- **How it would work:** —
- **Evidence / numbers:** F: [policy](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/src/node/README.md), [AGENTS.md](https://github.com/cloudflare/workerd/blob/7d31f97096d01b15eaec14a3e66fd15cbd43466e/AGENTS.md). I: evidence of agent-assisted work, not of a documented unattended oracle→patch→accept loop.
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Prior art: Deno's official node-compat agent skill
- **What:** Skill instructs an agent to run a Node test, diagnose, classify implementable vs inherent limits, patch `ext/node`, rebuild, rerun and update a reasoned test manifest.
- **How it would work:** Agent loop over Deno's Node compatibility runner; also permits skips, so pass counts need auditing.
- **Evidence / numbers:** F: [SKILL.md](https://github.com/denoland/deno/blob/main/.claude/skills/node-compat/SKILL.md), [node_compat runner](https://github.com/denoland/deno/tree/main/tests/node_compat).
- **Prior art / who has it:** Deno.
- **Verdict:** FINDING — direct prior art substantially overlapping the proposed grow loop.
- **Kill test / first proof:** None given.

#### Prior art: Bun
- **What:** Bun runs thousands of Node tests per release and reports substantial bot-authored bug-fix contributions (Claude Code).
- **How it would work:** —
- **Evidence / numbers:** F: [compat tests](https://bun.sh/docs/runtime/nodejs-compat), [Bun joins Anthropic](https://bun.sh/blog/bun-joins-anthropic). I: not proof that every patch is autonomously generated/accepted.
- **Prior art / who has it:** Bun.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Prior art: unenv / Cloudflare preset
- **What:** Extensible implementation/alias/mock layers.
- **How it would work:** —
- **Evidence / numbers:** F: no primary evidence of a dedicated autonomous Node-oracle growth service in unenv.
- **Prior art / who has it:** unjs/unenv, Cloudflare.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Prior art: Pi's own Cloudflare codemode
- **What:** Pi ships compiled-Wasm Workers execution and a portable remote codemode interface backed by a DO in a separate Worker; docs discuss session DO, per-session/per-execution naming, caller-thread blocking, interrupts and memory.
- **How it would work:** —
- **Evidence / numbers:** F/M: inline Cloudflare adapter passed locally; not a full shell/workspace/session deployment. [codemode README](https://github.com/earendil-works/pi/blob/v1.4.0/packages/codemode/README.md), [cloudflare.ts](https://github.com/earendil-works/pi/blob/v1.4.0/packages/codemode/src/cloudflare.ts), [host.ts](https://github.com/earendil-works/pi/blob/v1.4.0/packages/codemode/src/runtime/host.ts).
- **Prior art / who has it:** Pi.
- **Verdict:** FINDING — much closer prior art than a new compatibility runtime.
- **Kill test / first proof:** None given.

#### Finding: Deno joins Cloudflare (2026-10-09)
- **What:** Deno team announced joining Cloudflare, combining effort with Workers/DOs.
- **How it would work:** —
- **Evidence / numbers:** F: [Deno](https://deno.com/blog/cloudflare), [Cloudflare](https://blog.cloudflare.com/deno-joins-cloudflare/). I: runtime compatibility is funded by the owners of the primitives and test infra.
- **Prior art / who has it:** Deno, Cloudflare.
- **Verdict:** FINDING — differentiator must be a verified session/execution/storage split, not an agent that edits polyfills.
- **Kill test / first proof:** None given.

#### Blocker 1: required default process behaviour cannot run in a hosted isolate
- **What:** Pi bash throws; CLI exit cancels the request; subprocesses, OS signals/handles and blocking execution-host I/O cannot be synthesized in JS.
- **How it would work:** Explicit remote bash operations to an execution service.
- **Evidence / numbers:** M.
- **Prior art / who has it:** —
- **Verdict:** Rank 1, score 25 — literal claim already failed.
- **Kill test / first proof:** E 2–4 h: deterministic Pi conversation read→edit→bash→read with explicit remote bash ops and a local fake execution service. **Pass:** output/status/streaming/cancellation match Node and no subprocess API on the DO path. **Fail:** "unmodified CLI/default tools" remains non-negotiable.

#### Blocker 2: ephemeral FS masquerades as a durable workspace
- **What:** Files vanished across requests; session/auth/settings/workspace need real persistence and scope.
- **How it would work:** DO SQLite/KV-backed required file operations.
- **Evidence / numbers:** M: DO sync primitive survived restart.
- **Prior art / who has it:** —
- **Verdict:** Rank 2, score 20 — open.
- **Kill test / first proof:** E 4–6 h: implement required ops on DO SQLite/KV; exercise append/rename/offset reads and interrupted write; destroy runtime between turns; two DO IDs. **Pass:** exact bytes/session reconstruction, no cross-session leakage, no acknowledged lost writes in 100 restart/interleave trials. **Fail:** ordinary ops need blocking async network reads or a full workspace mirror over the declared budget.

#### Blocker 3: hibernation is not continuation persistence
- **What:** Storage survives eviction but JS state can vanish; waiting on a model/tool stream is a live operation; Node compat does not create a durable event machine.
- **How it would work:** Event-boundary persistence and reconstruction.
- **Evidence / numbers:** F/I: [storage/lifecycle guidance](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/).
- **Prior art / who has it:** —
- **Verdict:** Rank 3, score 20 — open.
- **Kill test / first proof:** E 4 h: fake model streams a tool call; disconnect/restart at each session boundary; resume. **Pass:** exactly one committed tool effect per ID, no duplicate model/tool transcript entries, correct cancellation and final state across 100 replay points. **Fail:** correctness or the idle claim requires preserving an in-memory loop/pending promise.

#### Blocker 4: import success conceals execution-specific loaders/threads
- **What:** Current Pi closure imports at 99.1%, but default codemode execution fails; photon and undici have loader constraints.
- **How it would work:** Existing Cloudflare codemode adapter covers part of this.
- **Evidence / numbers:** M/F.
- **Prior art / who has it:** Pi Cloudflare codemode adapter.
- **Verdict:** Rank 4, score 16 — open.
- **Kill test / first proof:** E 2–3 h: existing portable/Cloudflare codemode adapter, text-only/image tool fixtures, local provider SSE fixture. **Pass:** execution, abort, timeout, malformed stream and image processing complete without runtime JS/Wasm compilation or Node worker threads. **Fail:** a required extension/plugin loads only through arbitrary Node-native code or runtime module compilation.

#### Blocker 5: generic compatibility growth has a weak value proposition
- **What:** Many failures are flags/bundler wiring; only a small frozen test subset exercised; Deno already publishes nearly this workflow.
- **How it would work:** Bounded five-case grow experiment: five real Pi-relevant P failures, ≤30 min per repair, config-only fixes counted separately; stop if success needs weakened assertions or reclassified operations.
- **Evidence / numbers:** M/F.
- **Prior art / who has it:** Deno node-compat skill.
- **Verdict:** Rank 5, score 9 — open, lowest.
- **Kill test / first proof:** E 3 h. **Pass:** ≥4 meaningful P fixes with unchanged assertions, zero required X cases misclassified, no regression. **Fail:** most "growth" is disabling tests, copying existing adapters or chasing unneeded OS semantics.

#### First three verifications (report's order)
- **What:** (1) headless full turn, 2–4 h — deterministic model fixture, explicit bash backend, read/edit/write + streamed command output and abort, all effects matching the Node oracle; (2) durability/replay, 4–6 h — DO-backed file/session ops, restart/interleave across 100 checkpoints and two sessions, zero lost acknowledged writes or duplicated tool effects; (3) required feature corpus, 2–3 h — Cloudflare codemode adapter, provider SSE fixture, image/extension cases, each passing or with an explicit adapter and no hidden process/worker-thread/blocking-network dependency.
- **How it would work:** Short integration spike for headless SDK + persistent scoped workspace + explicitly remote command tools.
- **Evidence / numbers:** Scratch results in `/tmp/split-compat/` (`popular-final-results.json`, `pi-closure-corrected-results.json`, `pi-active-all-results.json`, `do-persistence-probe.json`, `node24-test-cases-results.json`, `codemode-cloudflare-explicit-wasm.json`, etc.).
- **Prior art / who has it:** —
- **Verdict:** KEPT — GO-WITH-CHANGES; NO-GO if complete unmodified CLI/default OS behaviour is mandatory.
- **Kill test / first proof:** Thresholds as in blockers 1–4.

### 03-brain: Workers + Durable Objects as the agent's brain and home
This report examines the brain layer: running the agent loop and workspace inside a Worker + Durable Object, covering billing, limits, persistence, the filesystem, and existing implementations. Headline finding: a DO cannot stop billing while its unchanged loop awaits an LLM stream. Duration alone costs about $0.00096–$0.00576 per agent hour, roughly 24×–4× cheaper than a $0.023/h VM, not 10–50× (I/E). Cloudflare also already ships a Pi Durable harness, a SQLite filesystem (Computer), and swappable isolate/container execution backends (F). Verdict: **go-with-changes**. Reuse the existing durable harness and workspace, put bounds on memory and recovery semantics, and prove the total economics before promising 10×.

#### DO duration billing: waiting on the model is charged
- **What:** The brief assumed a DO stops billing while it waits for a model response. That premise is false.
- **How it would work:** Workers Standard bills CPU only, at $0.02/million CPU-ms and $0.30/million requests. DO duration is wall-clock time while active or unable to hibernate, at $12.50/million GB-s, with every object charged as 128 MB whatever it actually uses. Hibernation needs no outstanding I/O, `waitUntil`, outbound connection or timer. So an awaited fetch, a live response stream or an awaited RPC blocks it. Moving the fetch into another Worker and awaiting it, or switching to an outbound WebSocket, does not help. The DO has to persist a continuation and finish its current operation.
- **Evidence / numbers:** F: $12.50/million GB-s; billed at 0.128 GB; 400,000 GB-s and 1M requests included per month; excess requests $0.15/million; overage rounded up to whole million-GB-s units. F: pending operations protect against eviction for up to 15 min each and accrue duration the whole time. F: the WebSocket Hibernation API keeps *accepted inbound* sockets only; it does not checkpoint outbound HTTP. [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [DO lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
- **Prior art / who has it:** Cloudflare Workers / Durable Objects billing model.
- **Verdict:** KEY FINDING. "Free model waiting" is confirmed false; this becomes blocker #1.
- **Kill test / first proof:** See blocker #1 (price a replayed 120-turn trace).

#### One agent hour of DO duration: 24×–4× versus a $0.023/h VM
- **What:** Auditable arithmetic for 120 sequential model turns of 5, 15 or 30 s each, compared with an AWS `t2.small`.
- **How it would work:** DO duration cost = active_seconds × 0.128 GB × $12.50/1M GB-s = active_seconds × $0.0000016. Active time is the union of the intervals in which the object cannot hibernate. Tool execution is ignored here to isolate the disputed claim.
- **Evidence / numbers:** E: at 5 s per turn, 600 s → 76.8 GB-s → $0.000960 (24.0×). At 15 s, 1,800 s → $0.002880 (8.0×). At 30 s, 3,600 s → $0.005760 (4.0×). F: the baseline is AWS t2.small (1 vCPU / 2 GiB, burstable, 12 CPU credits/h) at $0.023/h ([AWS T2](https://aws.amazon.com/ec2/instance-types/t2/)). E: per-request extras (120 DO submissions, 120 Worker requests, 1 ms ingress CPU each) add about $0.0000564; 100 ms of extra DO CPU per turn adds $0.0000192. E: 10× requires total split infra below $0.0023/h, which allows 1,437.5 active s, or 11.98 s per turn at 120 turns. 50× requires under 287.5 active s, below even the 5 s case. I: if infra is 2–5% of the bill, cutting it 10× reduces the total bill only 1.8–4.5%.
- **Prior art / who has it:** AWS EC2 t2.small as the reference VM.
- **Verdict:** KEY FINDING. One DO per agent already fails the 10× threshold at 15–30 s per turn, before the execution host is even counted.
- **Kill test / first proof:** Blocker #1 replay; pass if total infra ≤ $0.0023/hour.

#### Inclusions, rounding and invoice shape
- **What:** How monthly inclusions and slab rounding distort any per-session price.
- **How it would work:** DO duration on an invoice = $12.50 × ceil(max(0, 0.128 × A − 400,000) / 1,000,000), where A is aggregate active seconds per month. The $5/month subscription is separate.
- **Evidence / numbers:** E: the inclusions cover about 868 continuously active DO-hours per month. The first overage can add a full $12.50 for a tiny excess. Neither zero marginal cost nor that first slab is the per-session price.
- **Prior art / who has it:** Cloudflare DO pricing.
- **Verdict:** FINDING. Price aggregate monthly usage, not single sessions.
- **Kill test / first proof:** Folded into blocker #1 (price aggregate monthly usage including rounding).

#### SQLite storage writes and reads can exceed the model-wait cost
- **What:** Storage meters, not duration, may dominate the brain's bill.
- **How it would work:** Excess SQLite rates are $1/million rows written, $0.001/million rows read and $0.20/GB-month. Inclusions are 50M writes, 25B reads and 5 GB-month per month. Alarms and deletes count as writes. Pi Durable publishes partial progress at most every 100 ms and defers persistence to within about 1 s, so the write count lies somewhere between "one per turn" and "one per token".
- **Evidence / numbers:** M/E: in the local Computer test, 1,000 overwrites produced 9,000 row writes, so 120 small-file overwrites ≈ $0.00108 at excess rates. M/E: a cold path-resolution test read 4.033M rows for 1,000 stats ≈ $0.004033. I/E: 3,600 progress checkpoints per hour × 5 rows each would cost $0.018, but 5 rows per checkpoint is an unverified sensitivity assumption. E: a 100 MB workspace retained for a month ≈ $0.02. [SQLite pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/#sqlite-storage-backend), [Pi Durable events](https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/durable/README.md#events).
- **Prior art / who has it:** Pi Durable (Earendil), Cloudflare Computer.
- **Verdict:** FINDING. Cheap compute can still come with a material storage bill; this becomes blocker #5.
- **Kill test / first proof:** Blocker #5 (instrument real Pi storage and Computer SQL).

#### Competing containers already bill active CPU only
- **What:** The baseline argument that every competing container bills a full CPU during model waits is too broad.
- **How it would work:** Cloudflare Containers now bill CPU by active use. Provisioned memory and disk still accrue while the container runs.
- **Evidence / numbers:** F: $0.000020/vCPU-s and $0.0000025/GiB-s ([Container pricing](https://developers.cloudflare.com/containers/platform/pricing/), [active CPU change 2025-11-21](https://developers.cloudflare.com/changelog/post/2025-11-21-new-cpu-pricing/)). I: a full comparison must add execution-host start/stop tails, workspace sync, ingress, R2, retries and retention. No whole-system 10× result is established.
- **Prior art / who has it:** Cloudflare Containers.
- **Verdict:** FINDING. It weakens the cost premise.
- **Kill test / first proof:** —

#### Agents SDK fibers, keepAlive and PiHarness wake jobs
- **What:** Existing SDK mechanisms for long model calls preserve and recover work; they do not make waits hibernatable.
- **How it would work:** Fibers persist task/checkpoint data and recover interrupted work. `keepAlive()` runs a 30 s alarm heartbeat, and `AIChatAgent` keeps model streaming alive automatically. PiHarness uses durable wake jobs (`onWake`), can sleep through retry backoffs, heartbeats every 30 s while running, and hands alarm work off after 10 min. A single stream longer than the 15 min alarm limit can be interrupted.
- **Evidence / numbers:** F: an interrupted upstream HTTP connection is lost. F: Agents 0.30.0 added Pi 1.4 support and better sleeping-task recovery; 0.30.1 fixed another wake case. [Fibers](https://developers.cloudflare.com/agents/runtime/execution/durable-execution/), [Pi limitations](https://developers.cloudflare.com/agents/harnesses/pi/#limitations), [Agents releases](https://github.com/cloudflare/agents/releases).
- **Prior art / who has it:** Cloudflare Agents SDK, PiHarness.
- **Verdict:** FINDING. A running session keeps work in flight by design.
- **Kill test / first proof:** —

#### AI Gateway timeouts and background requests
- **What:** Two Gateway features: transport handling for streams, and fire-and-forget model jobs.
- **How it would work:** `cf-aig-request-timeout` measures time to the first response, so a stream can continue after it. Gateway retries can stretch total elapsed time. `/ai/run` with `options.background: true` and a `webhookUrl` returns before generation finishes.
- **Evidence / numbers:** F: webhook delivery is best-effort with no retry. F: the documented example is image generation; support for every frontier text/reasoning model and Pi provider path is not established. [Request handling](https://developers.cloudflare.com/ai-gateway/configuration/request-handling/), [Background API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/#background-requests-and-webhooks).
- **Prior art / who has it:** Cloudflare AI Gateway.
- **Verdict:** FINDING. Transport handling, not a DO billing exemption. Background mode is the basis of design option 3.
- **Kill test / first proof:** Verify selected-model support for background mode first.

#### Design option 1: keep the existing DO loop
- **What:** Accept wall-clock billing during model waits and keep the agent loop unchanged inside the DO.
- **How it would work:** The loop holds its outbound model stream. It pays $0.00576 per fully active hour plus other meters.
- **Evidence / numbers:** E: $0.00576 per fully active hour at the listed rates.
- **Prior art / who has it:** Cloudflare's Pi and OpenCode harness examples.
- **Verdict:** OPTION. Least integration work, and it can still be economical.
- **Kill test / first proof:** Blocker #1 pricing replay.

#### Design option 2: DO as mailbox, Worker/Workflow as model-call executor
- **What:** Move model waiting out of the DO so the DO can hibernate between short events.
- **How it would work:** The DO commits a request ID and continuation, then returns. The model call runs elsewhere and delivers persisted results/chunks back in short DO events. No DO RPC or `waitUntil` is held open, and progress is batched so tokens don't each wake the object and write. This changes the loop/provider contract and needs deduplication plus reconnection recovery.
- **Evidence / numbers:** F/E: Workflows bill CPU, requests, storage and steps, with no CPU charge while awaiting API I/O. Excess steps cost $0.80/100,000, so 120 steps = $0.00096 before CPU/storage, which does not automatically beat the 5 s DO case. Streaming and step-result persistence need their own design. [Workflows pricing](https://developers.cloudflare.com/workflows/reference/pricing/).
- **Prior art / who has it:** Cloudflare Workflows.
- **Verdict:** OPTION. It can eliminate DO waiting charges, but needs contract changes.
- **Kill test / first proof:** —

#### Design option 3: background model jobs
- **What:** Submit the model call as a background job and sleep until it completes.
- **How it would work:** The DO wakes on a callback, or on an alarm that checks stored job status. Missed callbacks must be recovered.
- **Evidence / numbers:** F: Gateway webhook delivery is best-effort with no retry (see the AI Gateway entry).
- **Prior art / who has it:** Cloudflare AI Gateway background requests.
- **Verdict:** OPTION. It loses ordinary live streaming unless another service owns the stream.
- **Kill test / first proof:** First verify that the selected model supports background mode and that missed callbacks are recovered.

#### Workers / DO platform limits for a coding agent
- **What:** The current documented limits (Workers Paid, SQLite-backed DOs) that bound the brain.
- **How it would work:** The isolate has 128 MB, shared across concurrent work and including the JS heap and Wasm. Global startup gets 1 s, and the bundle can be 64 MiB uncompressed. Subrequests: 10,000 by default, configurable to 10M (Free: 50). Six connections may wait for headers at once. HTTP and DO RPC have no hard wall-clock limit while the caller stays connected. Alarms run up to 15 min, and `waitUntil` extends 30 s. A DO gets 30 s of CPU per request by default, configurable to 300,000 ms. SQLite holds 10 GB per object (Free: 1 GB). KV entries max out at 2 MB and SQL rows/BLOBs at 2 MB. Statements cap at 100 KB, with 100 parameters and 100 columns. LIKE/GLOB patterns cap at 50 B, and incoming WebSocket messages at 32 MiB. The Hibernation API allows 32,768 accepted WebSockets per object.
- **Evidence / numbers:** F: as listed. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [DO State API](https://developers.cloudflare.com/durable-objects/api/state/#acceptwebsocket). I: a CPU allowance is not wall time. The six-connection rule is not a cap of six streaming models. Separate DOs suit independent agents when clean state matters more than sharing duration.
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING.
- **Kill test / first proof:** —

#### Hibernation erases the process; persist a recoverable agent instead
- **What:** A stock Node process that happens to run is not a recoverable agent.
- **How it would work:** Idle eligible objects hibernate after about 10 s; eligibility already stops duration charges. Ineligible idle objects evict after 70–140 s. Constructors rerun, and there is no durable heap, fd table, timer or closure. Persist accepted inputs, turn IDs, intended tool calls, results and committed workspace revisions. After a failure, distinguish an external command whose response was lost from one that never started. CPU limits must also cover parsing, prompt assembly, JSON repair, search, hashing and compaction.
- **Evidence / numbers:** F: lifecycle docs ([Lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)).
- **Prior art / who has it:** Cloudflare DO lifecycle; Agents SDK fibers.
- **Verdict:** DESIGN RECOMMENDATION (I). Feeds blocker #3.
- **Kill test / first proof:** Blocker #3.

#### Pi memory profile inside a DO
- **What:** Whether the agent fits the 128 MB isolate.
- **How it would work:** Measure heap and ArrayBuffer/external memory, startup and streaming peaks, repeated compaction, and concurrent sessions. Never load `node_modules` or the repository into JS memory. Token count is not a reliable heap budget.
- **Evidence / numbers:** F (maintainer workload measurements, not M here): Cloudflare's Oct 27 issue reports 25.0 MB of heap after the first DO workload; proposed fixes cut it to 10.5 MB, or 8.8 MB without Git ([#2735](https://github.com/cloudflare/agents/issues/2735)). F: a companion issue reports quadratic streaming-JSON work and heavy partial-generation copying in Pi, plus about 0.6 MB of schema-conversion allocation per workspace tool set ([#2736](https://github.com/cloudflare/agents/issues/2736)). I: 128 MB is plausible for a bounded text agent, but unproven for the unchanged CLI with long context, extensions, Git, large tool output and a workspace cache.
- **Prior art / who has it:** Cloudflare Agents maintainers.
- **Verdict:** FINDING. This becomes blocker #4.
- **Kill test / first proof:** Blocker #4 (peak < 96 MB).

#### Large SQLite databases and cold start
- **What:** Whether a DO with a large SQLite workspace activates quickly.
- **How it would work:** The SQLite APIs are synchronous queries/cursors. No documented rule requires loading the whole database on activation.
- **Evidence / numbers:** F/M: a 136 MB database reopened locally without reading all its contents ([SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)). I: relocation/cold-storage locality, schema migrations and application rehydration are separate costs. No Cloudflare doc guarantees a cold-start percentile as a function of SQLite size.
- **Prior art / who has it:** Cloudflare DO SQLite.
- **Verdict:** FINDING. This is evidence of feasibility, not a latency guarantee.
- **Kill test / first proof:** Blocker #6.

#### workerd native `node:fs` is memory-backed, not durable
- **What:** workerd's built-in `node:fs` is not the DO's SQLite store.
- **How it would work:** It provides a read-only `/bundle`, a writable temporary `/tmp` and selected `/dev` devices. All operations run synchronously, even the promise and callback variants. The docs describe `/tmp` as request-scoped.
- **Evidence / numbers:** F: [Workers fs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/). M: `/tmp/probe` survived two requests to the same live DO but disappeared on process restart.
- **Prior art / who has it:** workerd.
- **Verdict:** FINDING. Native `/tmp` is not durable storage; do not rely on it surviving across requests.
- **Kill test / first proof:** —

#### Cloudflare Computer Workspace (DO SQLite filesystem)
- **What:** Cloudflare already ships a durable agent filesystem inside a DO.
- **How it would work:** `@cloudflare/computer` provides `Workspace({ storage: ctx.storage })`, durable file tools, a node-shaped provider, Git support and execution backends. Its SQL schema holds inodes, directory entries, content-addressed blobs and ordered chunks. Content is chunked at 512 KiB with staged streaming writes and atomic metadata install, which sidesteps the 2 MB row limit. The blob cache is capped at 16 entries (about 8 MiB). The public API is promise-based, and the Dynamic Worker JS backend exposes a Workspace-backed subset of `node:fs/promises`.
- **Evidence / numbers:** F: the status table marks the filesystem and JS backend stable; shell, container/FUSE sync and interrupted-run replay are partly experimental. Design docs are forward-looking. F: an unchanged package importing native `node:fs` is not shown to see this filesystem. [Package status](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/computer/README.md#status), [Schema](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/dofs/src/schema/core.ts), [Agent filesystem docs](https://developers.cloudflare.com/agents/tools/filesystem/).
- **Prior art / who has it:** Cloudflare (`@cloudflare/computer`, `dofs`).
- **Verdict:** PRIOR ART. Reuse it, then test its contract.
- **Kill test / first proof:** Blocker #3 differential filesystem probes.

#### Design: one authoritative workspace per agent; the execution host projects a revision
- **What:** The recommended ownership model if adaptation is needed.
- **How it would work:** Keep one authoritative mutable filesystem per agent in the DO, using the existing inode/chunk model and transaction boundaries. The execution host works on a projection of a named workspace revision and returns changes against that revision. With parallel writers, reject a stale base or merge explicitly. Single-threaded JS does not prevent interleaving across `await`, and does not protect against a disconnected host finishing late.
- **Evidence / numbers:** I.
- **Prior art / who has it:** Computer's inode/chunk model.
- **Verdict:** DESIGN RECOMMENDATION.
- **Kill test / first proof:** Blocker #6 correctness pass (stale-revision updates rejected or merged).

#### Design: intercept `fs` imports for an "unmodified" Node package
- **What:** How to show an unchanged package the durable filesystem.
- **How it would work:** Prefer injected filesystem/tool interfaces. Otherwise intercept `fs`, `node:fs`, `fs/promises` and `node:fs/promises` at the bundle/module-loader boundary, including inside dependencies, and validate import styles and dynamic imports. A provider object alone does not mount into workerd's native VFS. Bind the shim to the current DO, not a global session pointer. A synchronous `readFileSync` can query local DO SQLite, but it cannot await a missing R2 blob or another DO. So offer async hydration, eagerly pin the files sync callers need, or change those callers.
- **Evidence / numbers:** I: "A promise hidden inside a sync shim is not Node compatibility."
- **Prior art / who has it:** —
- **Verdict:** DESIGN RECOMMENDATION.
- **Kill test / first proof:** —

#### Design: R2 for large immutable content, manifests in SQLite
- **What:** Bulk bytes go to R2, with SQLite keeping the metadata.
- **How it would work:** Key R2 objects by content hash. Upload the blob, verify it, then atomically publish the manifest; a crash before publication leaves garbage, not a broken visible file. Garbage-collect only after a grace period and reference checks. Whole-file rename stays a metadata transaction, but cross-DO moves and SQLite+R2 writes are not atomic. Don't store one mutable R2 object per tiny source edit without measuring.
- **Evidence / numbers:** F/E: R2 Standard costs $0.015/GB-month, $4.50/M Class A and $0.36/M Class B requests, with free egress. 120 separate writes cost $0.00054 at excess rates, before reads. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- **Prior art / who has it:** Cloudflare R2.
- **Verdict:** DESIGN RECOMMENDATION. Cheaper for retained bulk bytes; not for frequent small edits.
- **Kill test / first proof:** Blocker #6 (interrupted publication leaves the old or new file complete).

#### Computer provider POSIX/Node semantics gaps (measured)
- **What:** Probes of `workspace.provider()` in published Computer 0.8.0 against POSIX/Node semantics.
- **How it would work:** Run the same filesystem operations and compare the results with real Node/POSIX behaviour.
- **Evidence / numbers:** M: open a file, rename the path, then read from the old fd → `ENOENT` (a real fd keeps naming the inode). M: `realpathSync` on a valid symlink returned the symlink's own path, not the target. M: `accessSync(path, R_OK)` on a mode-`000` file was allowed. M: a symlink whose target was renamed away gave `ENOENT`, which is correct dangling-link behaviour. F/I: the source stores fd state by path, canonicalizes `realpathSync` output and ignores the `accessSync` mode. Other operations such as `internalModuleStat` are unsupported. [Provider](https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/dofs/src/provider.ts). I: still to test are append/exclusive flags, short and positional reads, truncate, hard links, open-unlink, symlink loops, cross-directory rename, directory order, error codes, UTF-8/binary paths, timestamps and watcher cleanup. A timer-based JS watcher also changes hibernation economics.
- **Prior art / who has it:** Cloudflare Computer.
- **Verdict:** KEY FINDING. A node-shaped method list is not full compatibility.
- **Kill test / first proof:** Blocker #3.

#### Local experiment: published Computer on workerd DO SQLite (timings)
- **What:** Benchmarked the real `@cloudflare/computer@0.8.0` Workspace inside a local workerd DO.
- **How it would work:** On macOS 26.6.1 arm64 with workerd 2026-10-25 and esbuild 0.25.12, a `Brain extends DurableObject` built a `Workspace({storage: ctx.storage})` with SQL persisted to local disk. Python `perf_counter` timed localhost HTTP batches: 7 samples on 1,000 files of 4 KiB, using 251 reused byte patterns, so dedup and warm caches help.
- **Evidence / numbers:** M (median batch): no-op request 0.757 ms; 1,000 warm `stat`s 6.599 ms (6.6 µs each); 1,000 streamed 4 KiB reads 33.921 ms (33.9 µs); 1,000 overwrites 47.745 ms (47.7 µs); 100 rename pairs 14.995 ms (150.0 µs/pair). These include HTTP overhead but no production replication or geographic latency. Results are kept at `/tmp/split-brain/results.json`.
- **Prior art / who has it:** Cloudflare Computer.
- **Verdict:** KEY FINDING. Durable files bigger than isolate memory work locally without building a filesystem. This says nothing yet on whether the unchanged Pi CLI fits in 128 MB, or whether production rehydration takes milliseconds.
- **Kill test / first proof:** —

#### Local experiment: 128 MiB file persistence and restart
- **What:** Checked large-file persistence, streaming and reopen after restart.
- **How it would work:** A 128 MiB file was written incrementally in 512 KiB chunks, each with 64 KiB of random bytes to defeat dedup. workerd was restarted, and the file was streamed back.
- **Evidence / numbers:** M: the write took 792.4 ms, and SQLite reported 136,114,176 bytes total. After restart, the stream read exactly 134,217,728 bytes in 256 chunks in 149.3 ms. M: over 5 clean restarts, the first DO request (Workspace construction) took 1.69–14.07 ms, median 1.84 ms, and the first 1,000-path stat batch took 149.8–173.2 ms. The OS page cache was not cleared, so this is not a production relocation/cold-disk benchmark, and no complete hash comparison was done.
- **Prior art / who has it:** —
- **Verdict:** KEY FINDING. Opening the database is fast; rewarming the filesystem costs about 150 ms per 1,000 paths.
- **Kill test / first proof:** Blocker #6.

#### Local experiment: SQL row amplification
- **What:** SQL cursor counters exposed a hidden row cost behind fast warm benchmarks.
- **How it would work:** A separate instrumented run after the timing runs.
- **Evidence / numbers:** M: 1,000 overwrites → 9,000 writes / 11,000 reads. 100 rename pairs → 2,200 writes / 4,400 reads. 1,000 warmed content reads → 4,000 reads. 1,000 uncached path stats → 4,033,000 rows read via the recursive path-resolution CTE; repeating the batch read 1,000 rows.
- **Prior art / who has it:** Cloudflare Computer (`dofs`).
- **Verdict:** KEY FINDING. Fast warm timings hide very different SQL cost. How the cold query pattern scales on large trees still needs verifying (blocker #5).
- **Kill test / first proof:** Blocker #5.

#### Pi identity has moved (Earendil)
- **What:** The brief's Pi package names are historical.
- **How it would work:** —
- **Evidence / numbers:** F: npm marks `@mariozechner/pi-coding-agent` 0.73.1 deprecated in favour of `@earendil-works/pi-coding-agent`, currently 1.4.0. `badlogic/pi-mono` resolves to the current Earendil Pi project. The family also includes `@earendil-works/pi-durable`. [Pi repo](https://github.com/earendil-works/pi), [legacy npm](https://registry.npmjs.org/@mariozechner%2Fpi-coding-agent/latest).
- **Prior art / who has it:** Earendil Works (Pi), Mario Zechner.
- **Verdict:** FINDING. Pi already has a durable variant.
- **Kill test / first proof:** —

#### Cloudflare Pi harness example (PiHarness in a plain DO)
- **What:** A complete Pi model/tool loop already running inside a DO.
- **How it would work:** The example builds a plain DO with PiHarness/Lifecycle, a SQLite Workspace, Workspace tools, WebSocket sessions, a Workers AI provider and a Dynamic Worker JS backend, plus Git host operations.
- **Evidence / numbers:** F: it uses Pi Durable and adapted tools, not the unchanged historical CLI. [Example server](https://github.com/cloudflare/agents/blob/d69277b51d073065e037fe9072dadaa2555d0037/examples/next/harnesses/pi/src/server.ts), [tool adapter](https://github.com/cloudflare/agents/blob/d69277b51d073065e037fe9072dadaa2555d0037/examples/next/harnesses/pi/src/workspace.ts), [Pi overview](https://developers.cloudflare.com/agents/harnesses/pi/).
- **Prior art / who has it:** Cloudflare Agents.
- **Verdict:** PRIOR ART. This brain already exists; it becomes blocker #2.
- **Kill test / first proof:** Blocker #2.

#### OpenCode Workerd SDK harness in a DO
- **What:** A second agent loop hosted inside a plain DO.
- **How it would work:** SQLite sessions, agent-loop recovery, models and bundled plugins.
- **Evidence / numbers:** F: [OpenCode harness](https://developers.cloudflare.com/agents/harnesses/opencode/).
- **Prior art / who has it:** Cloudflare / OpenCode.
- **Verdict:** PRIOR ART. A direct counterexample to "a full agent loop needs a persistent VM", though it is an adapted embedded API.
- **Kill test / first proof:** —

#### Project Think and Flue integration
- **What:** More Cloudflare agent platforms built on DOs.
- **How it would work:** Project Think (April 2026) offers persistent sessions, subagents, recoverable execution and code execution. In Flue, each agent becomes a DO with a SQLite workspace and optional execution.
- **Evidence / numbers:** F: [Project Think](https://blog.cloudflare.com/project-think/), [Flue](https://blog.cloudflare.com/agents-platform-flue-sdk/).
- **Prior art / who has it:** Cloudflare, Flue.
- **Verdict:** PRIOR ART.
- **Kill test / first proof:** —

#### Cloudflare container redesign: agent loop in a DO, Linux on demand
- **What:** Cloudflare's September redesign is essentially the proposed brain/hands split.
- **How it would work:** The agent loop runs in a DO and starts a Linux workspace only for shell, compiler or dev-server work. Image and instance can be chosen per task, and workspace snapshots are supported.
- **Evidence / numbers:** F: [Container architecture](https://blog.cloudflare.com/faster-agent-sandboxes/), [Computer announcement](https://blog.cloudflare.com/cloudflare-computer/).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** PRIOR ART. The split itself is not novel.
- **Kill test / first proof:** —

#### Cloudflare Artifacts (Git-compatible versioned trees)
- **What:** Git-compatible versioned storage for history, forks and exchange.
- **How it would work:** Stores versioned trees. Artifacts supplies history/forks/exchange, while Computer supplies the mutable agent workspace.
- **Evidence / numbers:** F: open beta for Workers Paid since Oct 1, with billing from Oct 14. New repos are limited to 1 GB (pre-Sept-29 repos: 10 GB). Excess costs $0.15/1,000 operations and $0.50/GB-month. [Changelog](https://developers.cloudflare.com/changelog/post/2026-10-01-artifacts-open-beta/), [limits](https://developers.cloudflare.com/artifacts/platform/limits/), [pricing](https://developers.cloudflare.com/artifacts/platform/pricing/).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** PRIOR ART.
- **Kill test / first proof:** —

#### ArtifactFS (lazy FUSE hydration on the execution host)
- **What:** Hands large repos to the execution host lazily.
- **How it would work:** Blobless clone plus FUSE to lazily hydrate a working tree on the host.
- **Evidence / numbers:** F/I: [ArtifactFS](https://developers.cloudflare.com/artifacts/guides/artifact-fs/). Not a persistent `node:fs` mount inside workerd.
- **Prior art / who has it:** Cloudflare.
- **Verdict:** PRIOR ART. Useful for the hands, not for the brain's filesystem.
- **Kill test / first proof:** —

#### Blocker #1: free model waiting is false
- **What:** DO wall-clock billing during model waits defeats the 10× claim.
- **How it would work:** In the direct 15–30 s per turn case, duration alone misses 10× before any other cost.
- **Evidence / numbers:** E score 5×5=25 (a confirmed invalid assumption gets probability 5). Sections 1–2.
- **Prior art / who has it:** —
- **Verdict:** RANK 1 (25). Confirmed.
- **Kill test / first proof:** 2–4 h. Replay 120 recorded or synthetic turns, logging active intervals, SQL cursor rows, alarms and execution-host time, then price aggregate monthly usage including rounding. **Pass:** total infra ≤ $0.0023/hour against the $0.023 baseline over representative sessions. Otherwise withdraw the blanket 10× claim or change the architecture. Local traces estimate usage; they are not a billed invoice.

#### Blocker #2: the proposed brain/home has already shipped
- **What:** PiHarness + Computer + on-demand execution is direct prior art.
- **How it would work:** —
- **Evidence / numbers:** E score 5×4=20. Section 4.
- **Prior art / who has it:** Cloudflare Agents/Computer, Pi Durable.
- **Verdict:** RANK 2 (20). Confirmed prior art.
- **Kill test / first proof:** 2–4 h. Run the Cloudflare Pi example locally with a scripted provider on the intended edit/tool task. **Pass:** a measured unmet requirement worth building is found. **Fail:** the proposed product is mainly a duplicate of the SDK example.

#### Blocker #3: the unchanged CLI/process lifecycle is not durable
- **What:** Hibernation erases the heap, the fd probe fails after rename, and native fs is not SQLite.
- **How it would work:** —
- **Evidence / numbers:** E score 4×5=20. M: fd/realpath probe failures.
- **Prior art / who has it:** —
- **Verdict:** RANK 3 (20). Open.
- **Kill test / first proof:** 3–4 h. Run Node and workerd against the same filesystem corpus, then kill the process between input acceptance, tool intent and result commit. **Pass:** no acknowledged edit lost; deterministic file/error parity for the APIs Pi actually calls; no duplicate external command when a response was lost. **Fail:** the wrapper must silently change core semantics, or it cannot resume.

#### Blocker #4: the 128 MB / CPU budget fails on real context
- **What:** The isolate memory and CPU caps may not survive real long-context coding sessions.
- **How it would work:** —
- **Evidence / numbers:** E score 3×5=15. F: the existing Pi example fits one workload; open issues #2735/#2736 expose allocation and streaming costs.
- **Prior art / who has it:** —
- **Verdict:** RANK 4 (15). Open.
- **Kill test / first proof:** 3–6 h. Scripted 120-turn run at the chosen model's maximum supported context, with 1/8/32 MiB tool outputs, a 128 MiB streamed file and compaction. **Pass:** peak total accounted memory < 96 MB (25% headroom), no leaks across repeated runs, no CPU-limit failures, usable cancellation. Test extra concurrent sessions separately.

#### Blocker #5: SQL amplification/retention defeats the savings
- **What:** Row-write and row-read amplification plus storage retention may eat the cost advantage.
- **How it would work:** —
- **Evidence / numbers:** E score 4×3=12. M: 9 writes per overwrite and 4.033M cold-read rows per 1,000 stats; model checkpoints add an unknown number of writes.
- **Prior art / who has it:** —
- **Verdict:** RANK 5 (12). Open.
- **Kill test / first proof:** 2–4 h. Instrument actual Pi storage and Computer SQL across warm/cold 1k/10k/100k-file trees. **Pass:** the fully priced trace stays inside the rank-1 target. **Fail:** optimize the query plan or batch writes, or stop claiming the target. Do not rely only on generous monthly inclusions.

#### Blocker #6: workspace rehydration/synchronization becomes the latency bottleneck
- **What:** Cold path costs and large execution-host projections may dominate latency.
- **How it would work:** —
- **Evidence / numbers:** E score 3×4=12. M: the local DB opens fast but cold paths cost more; large execution-host projection is untested.
- **Prior art / who has it:** —
- **Verdict:** RANK 6 (12). Open.
- **Kill test / first proof:** 3–6 h. Persist 256 MiB with distinct chunks, restart without scanning, and read one small file; repeat with 100k paths plus an execution-host edit return. **Local pass:** first useful read < 250 ms p95 after runtime readiness, with no whole-workspace allocation. **Correctness pass:** stale-revision updates are rejected or merged, and an interrupted publication leaves either the old or the new file complete. Production geography/replication is a separate, later measurement.

#### First three verifications (report's run order)
- **What:** The report's ordered gate before growing any Node compatibility layer.
- **How it would work:** (1) Replay and price the complete 120-turn trace, including SQL and execution-host tails. (2) Run the existing PiHarness/Computer example against the 96 MB peak-memory threshold with large context and compaction. (3) Run Node differential filesystem probes plus forced restarts at tool/commit boundaries.
- **Evidence / numbers:** —
- **Prior art / who has it:** —
- **Verdict:** These decide the cost, capacity and correctness claims.
- **Kill test / first proof:** Thresholds as in blockers #1, #4 and #3.

### 04-hands: The hands: command execution on demand
This report examines the hands layer: how a Worker/DO agent runs shell, build and test commands on demand. It compares managed Linux runners (Cloudflare Containers, Vercel, E2B, Daytona, Modal, Fly Machines/Sprites) with self-hosted Firecracker, a TypeScript shell (just-bash) and jitk. Headline finding: the project killer in this layer is moving the workspace and preserving command semantics, not VM boot. Cloudflare's `@cloudflare/computer` already implements much of the split, and pause/resume incumbents already stop billing idle compute. Verdict: **go-with-changes**. Use a small tested TypeScript command subset plus a normal Linux runner, kept warm across a burst and stopped between bursts. jitk is a **no-go** as the general shell/build/test runner.

#### Prior art: Cloudflare Computer already implements the hands split
- **What:** `@cloudflare/computer` combines a DO SQLite filesystem with just-bash/Dynamic Worker and Container execution backends, and ships Pi tools.
- **How it would work:** The agent sees one workspace. Commands run either in an in-isolate shell (just-bash) or in a container backend, with a synchronization protocol between them.
- **Evidence / numbers:** F: the core filesystem is stable; the container backend, shell backend and sync protocol are explicitly experimental. Its docs warn against large workspaces and dependency trees. [overview](https://github.com/cloudflare/computer/blob/main/docs/README.md), [component status](https://github.com/cloudflare/computer/blob/main/packages/computer/README.md).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** KEY FINDING. Unusually close prior art; read its code and benchmark it before building equivalent plumbing.
- **Kill test / first proof:** —

#### Cloudflare Containers / Sandbox SDK (new `ctx.container` path)
- **What:** The first-candidate Linux runner when the brain is already on Cloudflare.
- **How it would work:** Address the session DO with `env.RUNNERS.getByName(sessionId)`. The DO calls `ctx.container.start({image, instance, ...})` and then the native `container.exec(["bash","-lc",script])`, with output streams, status and cancellation. Either keep the command request alive while streaming, or implement a durable job with alarms and output files. Internet access must be configured for Git and npm. With the new API, `@cloudflare/sandbox` 1.x supplies utilities (`Files`, `S3Mount`, `DirectoryBackup`) rather than a required base class. Its file helpers need the matching `sandbox-shim` in an amd64 image. Do not mix in the legacy `Sandbox`/`Container` classes (`getSandbox()/exec()`); they are maintained only through Dec 31, 2026.
- **Evidence / numbers:** F: the new `durable_object` scheduling path benchmarks at 648 ms p50 / 910 ms p95 / 1,129 ms p99 TTI (100 concurrent sandboxes). ComputeSDK measured 682/950/989 ms on Oct 23 with 100% success. Older docs still say 1–3 s cold starts. F: metering is in 10 ms quanta: active CPU $0.000020/vCPU-s, memory $0.0000025/GiB-s, disk $0.00000007/GB-s; no minute floor is documented. Charges span the whole running instance, including idle time. NA/EU egress is $0.025/GB, on top of the $5/month Workers Paid plan. F sizes: lite 1/16 vCPU/256 MiB/2 GB; basic 1/4/1 GiB/4 GB; standard-1 1/2/4 GiB/8 GB; standard-2 1/6 GiB/12 GB; standard-3 2/8 GiB/16 GB; standard-4 4/12 GiB/20 GB. Custom sizes are 1–4 vCPU, up to 12 GiB/20 GB, with at least 3 GiB per vCPU. Account caps are 1,500 vCPU, 6 TiB RAM and 30 TB disk. [announcement](https://blog.cloudflare.com/faster-agent-sandboxes/), [pricing](https://developers.cloudflare.com/containers/platform/pricing/), [limits](https://developers.cloudflare.com/containers/platform/limits/).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** OPTION, first candidate (I). Small instance CPU fractions are a real build-time constraint; compare actual build duration.
- **Kill test / first proof:** Blockers #4/#5 (staging TTI/capacity).

#### Cloudflare container lifetime, snapshots and persistence
- **What:** How a Cloudflare runner stays warm and keeps state between bursts.
- **How it would work:** A live instance keeps its processes and files, and the session DO survives independently of it. `setInactivityTimeout()` (up to 6 h) must be reapplied after DO restarts. A background build alone does not keep the instance alive, while an accepted non-hibernating WebSocket, stream or polling alarm keeps it active and billable. Stopping loses the ephemeral disk. Native filesystem snapshots (public beta) preserve the writable root, excluding mounts, RAM and processes. Save files and the snapshot ID before stopping, and serialize saves with mutations. R2 directory backup is an alternative.
- **Evidence / numbers:** F: snapshots are limited to 20 GB, retained 30 days and refreshed by restore. No universal warm-command p50 is published. Snapshot storage pricing is not established; don't assume it's free. [lifetime](https://developers.cloudflare.com/sandbox/concepts/lifetime/), [snapshot guide](https://developers.cloudflare.com/sandbox/files/save-and-restore-a-workspace/).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING. A bucket mount should not be treated as a local npm filesystem.
- **Kill test / first proof:** Blocker #7.

#### Cloudflare container placement
- **What:** Containers are placed by regional capacity, not at every PoP.
- **How it would work:** The new path tries local capacity and image caches first. General docs still disclaim DO/container co-location.
- **Evidence / numbers:** F: regions ENAM, WNAM, EEUR, WEUR, APAC, SAM, ME, OC and AFR. ME/OC/AFR have limited capacity and can't be used as exclusive constraints. EU/US jurisdiction constraints exist. [placement](https://developers.cloudflare.com/containers/concepts/placement/).
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING. Feeds blocker #4.
- **Kill test / first proof:** Blocker #4.

#### Vercel Sandbox
- **What:** A full Linux Firecracker runner via `@vercel/sandbox` or authenticated APIs, usable from outside Vercel.
- **How it would work:** Create the sandbox and run commands. Stopping snapshots the filesystem by default (persistent sandboxes), and a later SDK command resumes in a new VM session; processes don't survive. Drives are another persistence option.
- **Evidence / numbers:** F (iad1): $0.128/active CPU-hour, $0.0212/allocated GB-hour, $0.60/million creations. Memory bills in one-minute minimum increments; CPU excludes I/O wait. Default is 2 vCPU/4 GB; 1 vCPU is allowed, at 2 GB per vCPU. Max size is 4/8/32 vCPU and 8/16/64 GB on Hobby/Pro/Enterprise, with 64 GB ephemeral disk. Default timeout is 5 min; max session 45 min on Hobby, 24 h on paid plans. Snapshots cost $0.08/GB-month and Drives $0.05/GB-month. 20 compute regions since Sept 10. [pricing](https://vercel.com/docs/sandbox/pricing), [persistence](https://vercel.com/docs/sandbox/concepts/persistent-sandboxes), [regions](https://vercel.com/changelog/vercel-sandbox-is-now-available-in-all-regions).
- **Prior art / who has it:** Vercel.
- **Verdict:** OPTION. Mature managed hands with an explicit memory billing floor; keep short related commands in one session.
- **Kill test / first proof:** —

#### E2B
- **What:** Firecracker-based Linux environments with command/file SDKs, templates and pause/resume.
- **How it would work:** Full pause keeps files and memory indefinitely and stops compute charges. Filesystem-only pause reboots the runner. A snapshot backlog can refuse a pause and leave the runner running.
- **Evidence / numbers:** F: $0.000014/vCPU-s + $0.0000045/GiB-s, billed per second. The 2 vCPU/4 GiB default = $0.000046/s = $0.1656/h. Pro adds $150/month. Hobby/Pro: runtime limits 1/24 h, concurrency 20/100, creation rates 1/5 per second. Pause takes about 4 s per GiB of RAM and resume about 1 s. The older ~150 ms startup claim covers initialization only. Regions are separate projects (us-west-1 default; us-west-2, eu-west-1, ap-southeast-1 via support), templates are built per region, and state doesn't migrate. [pricing](https://e2b.dev/pricing), [billing/limits](https://docs.e2b.dev/billing), [persistence](https://docs.e2b.dev/sandbox/persistence).
- **Prior art / who has it:** E2B.
- **Verdict:** OPTION. A straightforward remote runner. The long full-memory pause discourages pausing after every command, and the subscription can dominate a prototype's bill.
- **Kill test / first proof:** —

#### Daytona
- **What:** Container sandboxes by default, plus dedicated Linux/Windows VM classes.
- **How it would work:** Choose the execution class explicitly. VM pause preserves memory; container stop does not. Container archive stops charges, but restoring from it is another lifecycle path.
- **Evidence / numbers:** F: the <90 ms provisioning claim applies to the default container only. Default container is 1 vCPU/1 GiB/3 GiB; the default ceiling is 4 vCPU/8 GiB/10 GiB. Targets are `us` and `eu`. Rates: $0.0504/vCPU-hour, $0.0162/GiB-hour, $0.000108/GiB-hour of disk beyond 5 free, per-second billing. Starting, stopping and pausing states still charge; stopped and VM-paused states charge disk only. Creation quotas are 300–600/min. The limits docs conflict on Tier 1 RAM (10 vs 20 GiB). [sandboxes](https://www.daytona.io/docs/en/sandboxes/), [pricing](https://www.daytona.io/pricing), [limits](https://www.daytona.io/docs/limits).
- **Prior art / who has it:** Daytona.
- **Verdict:** OPTION. A credible ordinary Linux runner, particularly for US/EU; include stop/archive/restart latency in any comparison.
- **Kill test / first proof:** —

#### Modal Sandboxes
- **What:** Configurable isolated Linux containers with exec, images, volumes and filesystem snapshots.
- **How it would work:** Billed at `max(request, actual)` per resource, per second, with no minimum increment. A live idle sandbox still holds its requested resources. Filesystem snapshots can seed a new runner; full-memory snapshots are alpha.
- **Evidence / numbers:** F: $0.00003942/physical-core-s and $0.00000667/GiB-s, about 3× the standard Function rates. One physical core = 2 vCPU. The default request is 0.125 core/128 MiB, with 512 GiB of ephemeral disk; big disk requests raise the memory floor at a 20:1 ratio. Region selection costs 1.15× (broad) or 1.75× (narrow), and default Function ingress routes through Virginia. Boot takes "seconds". [pricing](https://modal.com/pricing), [sandbox billing](https://modal.com/docs/guide/sandbox-resources), [regions](https://modal.com/docs/guide/region-selection).
- **Prior art / who has it:** Modal.
- **Verdict:** OPTION. Strong image/build pipeline; put the Sandbox premium and region multiplier into the cost model.
- **Kill test / first proof:** —

#### Fly Machines
- **What:** Firecracker VMs controlled over REST, with selectable regions.
- **How it would work:** A Worker needs a command service or Machines exec adapter, a lifecycle controller and a storage policy. Machines alone is not a complete agent command API.
- **Evidence / numbers:** F: about 300 ms boot, excluding image preparation and app readiness. Prices: shared-1×/256 MB $0.0030/h, shared-2×/512 MB $0.0061/h, performance-1×/2 GB $0.0458/h, performance-2×/4 GB $0.0917/h, up to performance-16×/32 GB (RAM up to 128 GB). Billed per second. Stopped rootfs and volumes cost $0.15/GB-month, snapshots $0.08/GB-month. Older docs show different prices; use a live regional quote. [runner guide](https://fly.io/docs/machines/guides-examples/functions-with-machines/), [pricing](https://fly.io/pricing/).
- **Prior art / who has it:** Fly.io.
- **Verdict:** OPTION. More placement control, but more orchestration to own.
- **Kill test / first proof:** —

#### Fly Sprites
- **What:** Higher-level persistent Linux machines with exec APIs, automatic idle/wake and checkpoints.
- **How it would work:** A 100 GB persistent filesystem, idle suspension and disk checkpoints. Checkpoints restore files, not a paused instruction stream.
- **Evidence / numbers:** F: up to 8 CPU/16 GB, typically <1 s cold (vendor claims). Central pricing: $0.0385/CPU-hour, $0.021875/actual RAM GB-hour, hot disk $0.000683/GB-hour while awake, cold disk $0.000027/GB-hour (~$0.02/GB-month); warm/cold compute is free. There is a documentation conflict: the pricing page says hourly billing with no tiers, the overview says per-second, older pages quote $0.07 CPU / $0.04375 RAM. No reliable minimum billed duration exists. Fly support (Sept 11) says users can't select regions; an unresolved Oct 26 report has APAC creations landing in LA. [pricing](https://fly.io/pricing/), [overview](https://docs.fly.io/sprites/), [support statement](https://community.fly.io/t/wheres-my-sprite-in-the-world/28621).
- **Prior art / who has it:** Fly.io.
- **Verdict:** OPTION / BASELINE. A direct baseline for persistent hands that stop billing idle compute; test it before claiming the split uniquely saves that cost. Get written clarification on billing minimums.
- **Kill test / first proof:** Blocker #3 (ask Sprites for exact minimums).

#### Self-hosted Firecracker runners
- **What:** Run your own Firecracker hosts as the hands.
- **How it would work:** Requires a host scheduler, image/snapshot distribution, writable block devices, a guest agent over vsock, command streaming/cancellation, host failover and Linux/KVM. Cost = host lease / useful utilization + storage/network/ops. A ready host doesn't scale to zero when the DO hibernates.
- **Evidence / numbers:** F: <125 ms boot, <5 MiB VMM overhead, up to 150 VM creations/s per host. These exclude guest RAM, cache misses, scheduling, restore, network and command runtime ([Firecracker](https://firecracker-microvm.github.io/)). E: a $60/month host at 20% useful utilization with 8 slots ≈ $0.0000145 per useful slot-second; neither figure is a quote.
- **Prior art / who has it:** Firecracker; managed versions from Cloudflare, Vercel, E2B, Fly.
- **Verdict:** OPTION. Utilization decides whether self-hosting wins.
- **Kill test / first proof:** —

#### ComputeSDK 100-way burst TTI benchmark
- **What:** Cross-provider comparison of time from the create call to the first successful command.
- **How it would work:** Run from GitHub Actions on Oct 16.
- **Evidence / numbers:** F: p50/p95/success: Vercel 0.49/0.60 s/100%; Daytona 0.72/0.93 s/100%; Cloudflare 0.83/1.15 s/97%; Modal 0.94/1.75 s/100%; E2B 1.25/1.48 s/100%. Not our region, image or dependency restore; no warm `exec()` measured. Cloudflare's newer Oct 23 run is better but is not part of this table. [methodology](https://www.computesdk.com/benchmarks/sandboxes/burst-tti/).
- **Prior art / who has it:** ComputeSDK.
- **Verdict:** FINDING. Cold TTI is roughly 0.5–1.3 s across providers.
- **Kill test / first proof:** Blocker #5.

#### just-bash (TypeScript shell interpreter)
- **What:** `vercel-labs/just-bash`: a shell parser/interpreter over a virtual filesystem.
- **How it would work:** Implements file/text utilities, `grep`/`rg`/`sed`/`awk`, `jq`, pipelines, redirects, substitutions, control flow and functions. `curl` is opt-in. Optional runtimes use QuickJS (`js-exec`), WASM CPython and sql.js; these need Node facilities and are not part of the browser core. Shell state resets per `exec()` while files persist. No arbitrary npm packages or Linux executables.
- **Evidence / numbers:** F: the README documents ripgrep smart-case divergence. [README](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/README.md).
- **Prior art / who has it:** Vercel Labs; embedded by Cloudflare in the experimental WorkerShellBackend.
- **Verdict:** OPTION. See the TS tool-language design below.
- **Kill test / first proof:** Blocker #6.

#### Local probe: just-bash vs /bin/bash
- **What:** Differential probe of pinned `just-bash@3.6.0` on Node v24.22.1 (macOS, Oct 28).
- **How it would work:** Tiny scripts run in both just-bash and local `/bin/bash`; stdout and exit status compared.
- **Evidence / numbers:** M: pipelines, jq, substitution, loops, arrays, process substitution and `pipefail` matched (not a GNU conformance suite). `git`/`node`/`npm --version` all returned 127. Files persisted across calls; exported variables and cwd reset. M: `printf 'UPPER\nupper\n' | rg upper` gave `1:UPPER\n2:upper\n` in just-bash but `upper\n` in native rg.
- **Prior art / who has it:** —
- **Verdict:** KEY FINDING. Substituting a parser without defining command defaults silently changes matching and output; pin and test the deployed package.
- **Kill test / first proof:** Blocker #6.

#### Local probe: just-bash speed and workerd run
- **What:** Timings, plus a check that the just-bash core runs in workerd.
- **How it would work:** A warmed 100-iteration `cat | grep | wc` loop on in-memory files. Then `just-bash/browser` bundled with esbuild and served by local workerd 2026-10-25.
- **Evidence / numbers:** M: 0.36 ms p50 / 1.21 ms p95 warmed; the first new pipeline cost ~50 ms for init/lazy loading. Local wall time, not Worker CPU. M: bundling first failed on `node:zlib`; externalizing it with `nodejs_compat` gave a ~1.7 MB unminified bundle, and workerd returned `stdout="1\n"`, exit 0. Receipts are in `/tmp/split-hands/probe-results.json`. The optional runtimes, DO adapter and deploy limits are unverified.
- **Prior art / who has it:** —
- **Verdict:** FINDING. A basic shell path works in workerd.
- **Kill test / first proof:** —

#### Design: TypeScript as a specified tool language
- **What:** Use the TS shell only for a defined, tested command subset.
- **How it would work:** Pure file inspections and bounded edits avoid a remote runner. Never present it to the agent as full bash/GNU userspace. Prefer direct typed filesystem/search tools, whose semantics are easier to fix. Cloudflare adds isomorphic-git through a separate interface; that does not make native Git hooks, LFS or every Git option portable.
- **Evidence / numbers:** F: [computer backends/Git](https://github.com/cloudflare/computer/blob/main/docs/README.md); I: the compatibility boundary.
- **Prior art / who has it:** Cloudflare Computer (just-bash + isomorphic-git).
- **Verdict:** KEPT (part of the go-with-changes design).
- **Kill test / first proof:** Blocker #6.

#### jitk's existing numbers: what "~1 ms / ~0.5 MiB" actually means
- **What:** Puts the brief's jitk figures back in their original measurement conditions.
- **How it would work:** —
- **Evidence / numbers:** F: the Oct 28 copy-restore report gives a one-tool Node executor 1.10 ms p50 / 1.86 ms p99 and 1.72 total CPU-ms per run, on nested KVM; multislot performance is bimodal. Older `arch/FINAL.md` has 9.2 ms cold executor and 2.4–2.9 ms parked figures on another path. F: 0.515 MiB (return2) and 0.535 MiB (one tool) are the incremental footprint in a shared Linux shard, excluding fixed infrastructure, roughly equal to same-host Hyperlight. Not a Node/npm memory budget. [reset results](../../jitk/bench/RESULTS-copy-restore-2026-10-28.md), [memory comparison](../../jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md).
- **Prior art / who has it:** jitk; Hyperlight.
- **Verdict:** FINDING. Credible for the warmed executor workload, not for a new Linux machine.
- **Kill test / first proof:** —

#### Worker/DO → own jitk host (gateway + Tunnel)
- **What:** A proposed network path from a session DO to a self-hosted jitk shard pool.
- **How it would work:** The DO persists a command ID, expected workspace revision and host lease. It sends authenticated HTTPS, or opens a WebSocket for a command burst, to a host gateway that holds the warm shard pool and enforces CPU/memory/deadline bounds. The host returns sequenced stdout/stderr/status, queryable by command ID after disconnection, so retries look up an existing job instead of running it again. Tool callbacks stay on the host. For hosts without inbound access, `cloudflared` Tunnel with service auth: DO → Cloudflare → connector → gateway → jitk. After hibernation, reconnect and use command IDs/leases; don't hold a socket open just to keep a 1 ms launch.
- **Evidence / numbers:** F: [Tunnel model](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/). I: Tunnel does not put KVM in a Worker or remove distance.
- **Prior art / who has it:** Cloudflare Tunnel.
- **Verdict:** DESIGN (I). Only for jitk's narrow role.
- **Kill test / first proof:** Blocker #5.

#### Transport latency budget DO → host
- **What:** Estimated RTTs that sit on top of any remote execution.
- **How it would work:** For a minimal warm execution, T ≈ RTT + host queue + 1.1 ms + payload transfer.
- **Evidence / numbers:** E (hypotheses to measure): same-metro 2–10 ms; nearby European metros 10–40 ms; Europe–US East 70–110 ms; Europe–US West 130–180 ms; Europe–Singapore 150–220 ms. A new connection adds roughly 1–3 RTTs, plus DNS. E: a 20 ms path means ≥21 ms before useful work, and 100 sequential callbacks cost ~2 s. Connection reuse saves handshakes, not per-exchange RTTs.
- **Prior art / who has it:** —
- **Verdict:** FINDING (E/I). Submit whole scripts/builds/tests as one job; never remote every `read/stat/write`.
- **Kill test / first proof:** Blocker #5.

#### Does network latency erase jitk's advantage?
- **What:** Is jitk's start-time win still meaningful once network latency is added?
- **How it would work:** —
- **Evidence / numbers:** I/E: latency erases the user-visible 1 ms story and most of the advantage over an already-warm runner. With 20 ms of network, 1 ms jitk vs a 650 ms cold Linux would still differ by ~649 ms, *if they did the same task*, which today they don't. For a 30 s test the saving is ~2%. For a 1 ms inspection, TS in the DO beats both.
- **Prior art / who has it:** —
- **Verdict:** FINDING.
- **Kill test / first proof:** —

#### Why the jitk guest is not development Linux (GrowOS gap)
- **What:** The default jitk guest cannot run bash, Git, Node or npm.
- **How it would work:** A small `no_std` kernel running unmodified static QuickJS. Outward I/O is a JSON tool channel, the resource filesystem is a read-only packed archive, and the SQLite evidence covers immutable, read-only queries.
- **Evidence / numbers:** F: GrowOS Phase 2 mmap/leaf-syscall growth unlocked programs; four accepted path handlers were excluded after review as overfits. F: the corrected shared-tree run reached 2,554/3,154 visible (81.0%) and 644/792 held-out (81.3%). Path fixes added one visible program and zero held-out. These are scriptc corpus programs, not Node/npm compatibility. The main blocker was the lack of a writable `/tmp`/cwd; 261 programs are blocked by the printable-output rule. The proposed scratch FS is not implemented and would be per-run and nonpersistent; other programs need `clone/execve/pipe2/mprotect`. [FINAL](../../FINAL.md), [Phase 2](../../jitk/grow/EXPERIMENTS-PHASE2-2026-10-27.md), [path-FS results](../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md).
- **Prior art / who has it:** jitk / GrowOS.
- **Verdict:** FINDING. GrowOS is real evidence of adding bounded syscall behaviour, but it does not bridge this gap.
- **Kill test / first proof:** Blocker #2.

#### Capabilities jitk would need for bash, Git and Node/npm
- **What:** An engineering dependency list of what general hands would require.
- **How it would work:** **bash:** process creation/exec, wait/reap, pipes, descriptors/redirects, signals/job control, executable loading, cwd semantics (a static BusyBox subset reduces scope but still needs process/file behaviour). **Git:** writable POSIX FS, traversal, rename/link/symlink, permissions, locking, timestamps, fsync, arbitrary-byte streams, plus networking/TLS/DNS or a host transport. **Node/npm/test:** a dynamic ELF loader/libc or static build, pthreads/clone/futex, event polling/timers, sockets, VM protection for the V8 JIT, subprocesses/shebangs, native addons and the tests' own tools. Memory then scales to the workload, often hundreds of MiB to GB. One JSON channel would also need a byte-safe protocol for stdio, backpressure, cancellation, files and workspace deltas.
- **Evidence / numbers:** I.
- **Prior art / who has it:** A standard Linux kernel in Firecracker/libkrun.
- **Verdict:** FINDING. Forwarding `bash` as a host tool just moves Linux execution to another runner, leaving jitk as the glue evaluator.
- **Kill test / first proof:** Blocker #2 ABI audit.

#### Grow jitk into general development Linux
- **What:** Make jitk the shell/build/test runner by growing its kernel.
- **How it would work:** Implement the general semantics listed above.
- **Evidence / numbers:** I: hours can identify the missing capabilities; implementing them is an OS/runtime project of unknown duration. Standard Linux in Firecracker/libkrun gives the compatibility immediately, at the cost of the tiny footprint.
- **Prior art / who has it:** —
- **Verdict:** KILLED (no-go). jitk stays an optional accelerator for existing static tools with explicit inputs/outputs, outside the critical shell route.
- **Kill test / first proof:** Blocker #2.

#### Routing contract (which work goes where)
- **What:** A default destination for each class of command.
- **How it would work:** Read/list/search and bounded text/JSON transforms → typed TS tool or pinned just-bash, over source already in the DO/VFS, with byte/output/time limits. `cat/head/wc/sort/jq`, simple `find`, known `sed/awk` → TS after an AST/capability check of the whole script. Small edits → TS transaction under a workspace revision. Network fetch → typed fetch or explicitly configured curl. Arbitrary `git`/hooks/LFS/submodules and `bash script.sh` → Linux runner. `node`, `npm/pnpm/yarn`, `npx`, builds, tests and native binaries → Linux runner. Watch mode, dev server, browser, PTY, database → session Linux runner with a lease covering its lifetime. Known static jitk program → optional jitk host, only under a separately verified ABI/tool contract.
- **Evidence / numbers:** I.
- **Prior art / who has it:** —
- **Verdict:** KEPT (core of go-with-changes).
- **Kill test / first proof:** Blocker #6.

#### No "try TS, fall back to Linux" routing
- **What:** Rejects running a script in TS and re-running it in Linux on command-not-found.
- **How it would work:** `edit-file; npm test` may already have mutated the workspace. Classify the whole script before execution; route uncertain syntax or indirect commands whole-script to Linux. Alternatively, run TS in a disposable transactional overlay and commit only after a complete locally supported run. A matching binary name is not enough.
- **Evidence / numbers:** I.
- **Prior art / who has it:** —
- **Verdict:** KILLED (partial fallback), replaced by whole-script classification or a transactional overlay.
- **Kill test / first proof:** Blocker #6 (zero double-applied edits).

#### Warm pooling: one exclusive runner lease per session/branch
- **What:** Hold one runner per session/branch for the duration of a burst.
- **How it would work:** Persist `{provider, region, runnerId, imageDigest, workspaceRevision, checkpointId, dependencyCacheKey}` in the DO. Serialize mutations and terminal commands per branch. Parallel tests may share read-only inputs, but parallel editing agents get separate branches and runners. A waiting job doesn't acquire compute until its dependencies are ready.
- **Evidence / numbers:** I.
- **Prior art / who has it:** —
- **Verdict:** KEPT.
- **Kill test / first proof:** —

#### Cross-session clean-base pool and idle grace period
- **What:** Pool prepared base images across sessions, and keep runners briefly warm after a burst.
- **How it would work:** Never hand another tenant an old writable workspace; a session resumes its own checkpoint/cache. Cap the global pool, measure its hit rate and refill asynchronously (somebody pays for its idle allocation). Hold process-bearing sessions warm explicitly; otherwise start with a 10–30 s grace period after a burst, tuned by measured idle gaps and restore costs.
- **Evidence / numbers:** I/E: the 10–30 s figure is a trial policy, not a universal optimum.
- **Prior art / who has it:** —
- **Verdict:** KEPT (trial policy).
- **Kill test / first proof:** Blocker #3 replay (10/30/60 s grace).

#### Workspace ownership: runner authoritative during a command; dependencies stay on the runner
- **What:** Who owns the source tree while a command runs, and what syncs back to the DO.
- **How it would work:** During a command the runner is the sole writer for that revision; the DO must not edit the same tree. Afterwards: flush a change manifest (paths, deletes, bytes, modes, symlinks, base revision), commit the source revision, checkpoint cache/state, then release the lease. `node_modules`, package stores, `.git` bulk objects, build output and test caches stay on native runner disk or in provider snapshots; only selected source/artifacts go to the DO/R2. The brain reads dependency files through a batched runner tool.
- **Evidence / numbers:** I: this gives up the premise that *all* workspace files live in the DO; document that change explicitly.
- **Prior art / who has it:** —
- **Verdict:** KEPT. It changes the brief's premise.
- **Kill test / first proof:** Blocker #1.

#### Evidence against syncing everything (Cloudflare Computer benchmark)
- **What:** Cloudflare's own benchmark shows the cost of full-tree workspace sync.
- **How it would work:** Install 854 packages / 36,675 files on different workspace backends.
- **Evidence / numbers:** F: 124.7 s on the FUSE workspace, 63.9 s on ext4, 34.3 s on tmpfs, excluding the later pull into the DO. The doc reports a partial-tree pull taking further minutes plus a storage-timeout failure, and recommends local-only paths. [benchmark and caveats](https://github.com/cloudflare/computer/blob/main/docs/19_performance.md).
- **Prior art / who has it:** Cloudflare Computer.
- **Verdict:** KEY FINDING. Dependency placement is a first-day gate; saving a second of boot while adding a minute of filesystem overhead is a loss.
- **Kill test / first proof:** Blocker #1.

#### Per-command compute cost comparison
- **What:** Illustrative compute-only cost of a 2 s inspection, a 30 s test and a 120 s build at one full vCPU-equivalent.
- **How it would work:** Excludes startup, snapshot/restore, idle tail, storage, egress, control plane, plan fees and credits. Formulas: Cloudflare = 0.000020·cpu_s + (6·0.0000025 + 12·0.00000007)·running_s. Vercel = (0.128/3600)·cpu_s + (2·0.0212/3600)·60·ceil(running_s/60) + 0.0000006·creates. E2B = (0.000014 + 2·0.0000045)·running_s.
- **Evidence / numbers:** E (2 s / 30 s / 120 s): Cloudflare standard-2 $0.0000717 / $0.001075 / $0.004301. Vercel 1 vCPU/2 GB fresh session $0.000778 / $0.001774 / $0.005681. E2B 1 vCPU/2 GiB $0.0000460 / $0.000690 / $0.002760. Daytona 1 vCPU/2 GiB/8 GiB $0.0000462 / $0.000693 / $0.002771. Modal 0.5 core/2 GiB $0.0000661 / $0.000992 / $0.003966. Fly performance-1× $0.0000254 / $0.000382 / $0.001527. Vercel's minute floor applies per lifecycle, not per command on a warm runner.
- **Prior art / who has it:** The listed vendors.
- **Verdict:** FINDING. These rank invoice components, not throughput.
- **Kill test / first proof:** —

#### Sprites short-command cost (conditional)
- **What:** What a short command would cost on Sprites, if fractional-hour metering has no hour floor.
- **How it would work:** —
- **Evidence / numbers:** E: 1 CPU + 2 GB RAM + 5 GB hot disk ≈ $0.0000238/s, or $0.000714 per 30 s, plus retained cold disk. Explicitly conditional.
- **Prior art / who has it:** Fly Sprites.
- **Verdict:** UNRESOLVED. Do not publish until the billing-minimum conflict is resolved.
- **Kill test / first proof:** Ask Sprites for exact minimums, or run metered micro-runs.

#### TypeScript operation cost in the Worker
- **What:** The cost of running a 1–10 ms operation locally in TS instead of on a runner.
- **How it would work:** No separate runner bill.
- **Evidence / numbers:** F/E: at $0.02/million CPU-ms, $0.00000002–$0.0000002 for the CPU alone, plus Worker requests, DO/storage and any Dynamic Worker charges. [Workers price](https://www.cloudflare.com/plans/).
- **Prior art / who has it:** Cloudflare Workers.
- **Verdict:** FINDING. Small work belongs in TS.
- **Kill test / first proof:** —

#### Warm-tail cost dominates command compute
- **What:** Idle-but-running time costs more than the commands themselves.
- **How it would work:** —
- **Evidence / numbers:** E: Cloudflare standard-2 at zero CPU = $0.00001584/s in RAM/disk, i.e. $0.000475 per 30 s gap and $0.00950 per 10 min idle. The legacy 10-minute idle timeout can therefore cost ~9× a full-CPU 30 s test after every burst. Staying warm across a 30 s model response costs under 1/20 of a cent and avoids ~1 s of restart. E2B 1 vCPU/2 GiB: $0.00069 per 30 s gap, while full-memory pause of 2 GiB takes ~8 s. Vercel 1 vCPU/2 GB: the memory minimum alone is $0.000707 per fresh 1-minute lifecycle.
- **Prior art / who has it:** —
- **Verdict:** FINDING. Stop/start per short command can cost more than grouping commands.
- **Kill test / first proof:** Blocker #3.

#### Break-even: duty fraction required for 10×/50×
- **What:** How low the paid duty must be for the claimed savings.
- **How it would work:** Saving ≈ 1 / (busy duty fraction + billed warm tails + save/restore overhead as a fraction), for the same runner shape, excluding retained-state/control costs.
- **Evidence / numbers:** E/I: 10× needs ≤10% effective paid duty; 50× needs ≤2%. Against an already idle-suspending system the ratio can be much smaller. Persisting an extra 10 s of model-wait memory is often cheaper than rebuilding dependencies.
- **Prior art / who has it:** —
- **Verdict:** FINDING. No evidence here establishes the 10–50× session saving.
- **Kill test / first proof:** Blocker #3.

#### Blocker #1: workspace/cache materialization
- **What:** A mandatory whole-tree sync can erase all the savings and lose edits.
- **How it would work:** —
- **Evidence / numbers:** E score 5×5=25. F: the published FUSE install is ~2× ext4, before the DO pull.
- **Prior art / who has it:** —
- **Verdict:** RANK 1 (25). Open.
- **Kill test / first proof:** 2–4 h on an existing disposable Linux host. Compare native workspace, full sync and source-only sync on a small TS repo plus a ~30k-file dependency tree. Repeat edit → test → checkpoint → restore, injecting a restart during each transition. **Pass:** exact source bytes/modes/symlinks/deletes, zero lost acknowledged edits, warm overhead <10% of native test time, p95 rehydrate ≤2 s excluding initial install. **Fail:** full sync adds >20% or source recovery is ambiguous. Then adopt native dependency caches with a source-only mirror, or stop the split.

#### Blocker #2: jitk required to provide general Linux
- **What:** Making jitk mandatory as the hands turns the project into OS development.
- **How it would work:** —
- **Evidence / numbers:** E score 5×5=25 if mandatory. F: read-only archive, static workloads, a single channel; GrowOS path fixes added one corpus success.
- **Prior art / who has it:** —
- **Verdict:** RANK 2 (25 if mandatory). Resolved by choosing ordinary Linux now; do not fund kernel growth as a prerequisite.
- **Kill test / first proof:** 1–2 h static ABI audit against `bash -c 'echo x > f; cat f'`, `git init`, `node -e` and a minimal npm test trace captured on a normal host (not kvm-dev). **Pass to reopen the jitk route:** the writable file cycle, pipes/child execution, Node and the test all run unmodified with byte-correct output. The current documented design fails before execution.

#### Blocker #3: savings versus pause/resume incumbents
- **What:** Active-CPU pricing and persistent/paused runners already exist, which may shrink the claimed saving.
- **How it would work:** —
- **Evidence / numbers:** E score 5×4=20. F: active-CPU pricing, the Vercel minute floor, the Sprites pricing conflict.
- **Prior art / who has it:** Cloudflare, Vercel, E2B, Daytona, Fly Sprites.
- **Verdict:** RANK 3 (20). Open.
- **Kill test / first proof:** 2 h offline replay of ≥100 real command/idle intervals with the same dependency-cache policy. Compare always-live, 10/30/60 s grace, provider pause and a brain-in-runner baseline, including subscriptions, memory floors, snapshots and data transfer. **Pass for the 10× claim:** ≥10× reduction in full hands cost with <5% added session time. **Fail:** <2×, or state overhead dominates; keep the split only for other measured benefits. Ask Sprites for exact minimums.

#### Blocker #4: region/capacity/fan-out
- **What:** Capacity placement and creation-rate limits may break fan-out and geography.
- **How it would work:** —
- **Evidence / numbers:** E score 4×4=16. F: Cloudflare capacity constraints; E2B regional projects and creation rate; no Sprites region selector; Vercel's 20 regions don't promise capacity.
- **Prior art / who has it:** —
- **Verdict:** RANK 4 (16). Open.
- **Kill test / first proof:** 2–3 h from the intended DO regions, in an already authorized staging environment. Run 100 sequential creates/resumes, then bursts of 20/100 with bounded retries, recording placement, queueing, failures and image-cache state. **Pass:** ≥99% command readiness within 5 s, p95 ≤2 s, no forbidden-region fallback. **Fail:** route to another allowed provider/region, or constrain supported geography/concurrency. Cannot be proven from a laptop.

#### Blocker #5: short-command start/transport latency
- **What:** Cold TTI and network RTT may dominate short commands.
- **How it would work:** —
- **Evidence / numbers:** E score 4×3=12. F: TTI ~0.5–1.3 s in the common benchmark; jitk's local ≈1 ms is not a PoP RTT.
- **Prior art / who has it:** —
- **Verdict:** RANK 5 (12). Open.
- **Kill test / first proof:** 1–2 h on existing endpoints. Compare new vs reused HTTPS and streaming WebSocket, direct vs Tunnel, zero-work vs 30 s tasks, and same-metro vs distant clients, recording client, DO and host spans separately. **Pass:** warm command overhead p95 ≤50 ms regional, cold p95 ≤2 s. For jitk's separate glue use case, require a meaningful win over a warm Linux service, not just over a cold create. **Fail:** batch commands, place the brain near the runner, or keep small work local.

#### Blocker #6: TS command equivalence and route replay
- **What:** The TS shell may diverge from bash/GNU, and partially executed scripts may mutate state before a fallback.
- **How it would work:** —
- **Evidence / numbers:** E score 4×3=12. M: rg differs; native runtimes are absent.
- **Prior art / who has it:** —
- **Verdict:** RANK 6 (12). Open; the local probe proves feasibility, not this gate.
- **Kill test / first proof:** 2–3 h differential replay of 100 actual agent scripts against pinned just-bash and Linux bash/GNU tools, plus dynamic command names, substitutions and redirects. **Pass:** 100% bytes/exit/filesystem agreement for admitted scripts, 100% pre-execution rejection of unsupported scripts, zero double-applied edits. **Fail:** shrink the local subset and route whole scripts to Linux.

#### Blocker #7: long jobs stopped by lifecycle policy
- **What:** Runner lifecycle policy may kill or orphan long-running jobs.
- **How it would work:** —
- **Evidence / numbers:** E score 3×4=12. F: background CPU on Cloudflare doesn't keep the instance alive; snapshots exclude processes.
- **Prior art / who has it:** —
- **Verdict:** RANK 7 (12). Open.
- **Kill test / first proof:** 1–2 h fault-injection harness: disconnect the stream, restart the DO, expire the inactivity timer, cancel and reconnect. **Pass:** every job reaches a known terminal or lost state; no acknowledged job silently disappears; no duplicate npm lifecycle action; completed source is recovered. **Fail:** hold an explicit job lease/alarm or use provider-managed jobs. A resumable filesystem is not resumable process execution.

#### First three verifications (report's run order)
- **What:** The report's ordered gate.
- **How it would work:** (1) Source-only checkpoint/restore correctness and dependency-cache overhead. (2) Routing conformance on real command traces, with no partial fallback. (3) Replay those traces through realistic provider lifecycle/billing models, and validate the chosen region's TTI/capacity in staging.
- **Evidence / numbers:** —
- **Prior art / who has it:** —
- **Verdict:** Run these first. Making general jitk Linux support a dependency of these tests is a no-go.
- **Kill test / first proof:** Thresholds as in blockers #1, #6, #3 and #4.

### 05-workspace: Workspace data plane
Lens: where the agent's files, Git state, dependencies and caches live when the brain sleeps in a DO and the runner exists only per command. Headline: edit deltas are tiny (0.3–3 KiB) and not the blocker; the literal plan of putting the whole dev environment in a DO and rebuilding a disposable runner per command is what kills the 10×, and Cloudflare's `@cloudflare/computer` already implements most of this split. The bet is design C + F (DO-coordinated versioned source manifest and edit journal over content-addressed storage, plus a reusable native runner snapshot/base with a private writable overlay). Verdict: **go-with-changes**.

#### Finding: Pi naming correction
- **What:** `badlogic/pi-mono` now resolves to `earendil-works/pi`; the coding-agent package is `@earendil-works/pi-coding-agent` 1.4.0, not the `@mariozechner` name.
- **How it would work:** Pin revision `c3d8ce44…` before doing compatibility work.
- **Evidence / numbers:** [F, M] pinned manifest: https://github.com/earendil-works/pi/blob/c3d8ce44d3231c7e46071d2d859f41ca7d39d21b/packages/coding-agent/package.json
- **Prior art / who has it:** Pi (earendil-works).
- **Verdict:** FINDING — brief's package names are stale.
- **Kill test / first proof:** None given.

#### Finding: Workspace size envelope (planning assumptions)
- **What:** Sizing assumptions per workload class for tracked files, `.git`, installed deps and build caches; no defensible public distribution of agent-customer workspaces was found.
- **How it would work:** Used as a test envelope, not statistics: small service 1–20 MiB source / 50–500 MiB deps; medium TS monorepo 20–200 MiB / 300 MiB–3 GiB deps / 100 MiB–5 GiB caches; large monorepo 0.2–10+ GiB source, 1–100+ GiB `.git`.
- **Evidence / numbers:** [E] table; [F] Cloudflare's Artifacts launch example: a 2.4 GB framework repo taking nearly two minutes to clone; Git docs address >100 GiB full clones. https://blog.cloudflare.com/artifacts-git-for-agents-beta/, https://git-scm.com/docs/partial-clone
- **Prior art / who has it:** Cloudflare Artifacts, Git partial clone.
- **Verdict:** FINDING — dependencies and caches, not source, dominate state.
- **Kill test / first proof:** None given.

#### Finding: Local measurements of Pi and Fastify
- **What:** Measured sizes of two real repos.
- **How it would work:** Fetched into `/tmp/split-workspace/`, measured logical bytes, ran `npm ci --ignore-scripts`, streamed gzip-tar sizes.
- **Evidence / numbers:** [M] Pi: 2,397 tracked files, 29.26 MiB tracked, 10.28 MiB shallow `.git`, **481.42 MiB deps** (21,830 files), 7.31 MiB partial build; Fastify: 397 files, 2.90 MiB, 11.33 MiB `.git` (4,917 commits). `npm ci` added 303 packages in 12 s; npm cache 136.36 MiB. Gzip: 9.43 MiB source, 10.11 MiB `.git`, 132.97 MiB `node_modules` (archive time 2.39 s / 0.20 s / 28.97 s). Full `build:offline` stopped after five packages; `packages/tui` build 0.379 s.
- **Prior art / who has it:** —
- **Verdict:** FINDING — deps are ~16× the source; compression time can exceed delta transfer.
- **Kill test / first proof:** None given.

#### Finding: How much changes during an edit
- **What:** Three distinct quantities: text inserted (tens of bytes–KiB), complete changed source files (1–100 KiB/file, 1–10 files/turn), and command-produced writes (zero to GiB).
- **How it would work:** Formatters, lockfile updates, generators, installs, Git maintenance and builds dominate the tail.
- **Evidence / numbers:** [E] assumptions; [M] a deliberate small code/test/doc sequence produced 88–9,715 B changed-file contents per boundary, 327–2,905 B gzip bundles.
- **Prior art / who has it:** —
- **Verdict:** FINDING — ordinary edits are small; command writes are the tail risk.
- **Kill test / first proof:** None given.

#### Finding: Transfer time and money
- **What:** Transfer time/cost table for the measured payloads at 100 Mbit/s and 1 Gbit/s, plus storage rates.
- **How it would work:** `bytes × 8 / bps` plus latency, metadata, decompression, install, disk writes.
- **Evidence / numbers:** [E] 2,905 B bundle 0.23 ms; Pi deps 481 MiB 40.38 s @100 Mbit/s ($0.01262 egress at $0.025/GB); 5 GiB cache 429.5 s. [F] Container egress $0.025/GB; R2 no egress fee; 1 GB-month: R2 $0.015, DO SQLite $0.20, Artifacts $0.50; 10k R2 GETs $0.0036, PUTs $0.045. https://developers.cloudflare.com/containers/platform/pricing/, https://developers.cloudflare.com/r2/pricing/
- **Prior art / who has it:** —
- **Verdict:** FINDING — pack small files into bounded bundles; per-file object PUTs are an operations problem.
- **Kill test / first proof:** None given.

#### Finding: The DO is not already a durable Node filesystem
- **What:** Workers `node:fs` is an in-memory VFS (`/bundle` read-only, `/tmp` request-scoped and counted against memory); `ctx.storage`/R2 are not the FS an unmodified Node program sees.
- **How it would work:** Pi's `read`/`write`/`edit` (and Bash) expose async operation overrides, so a first version supplies custom operations instead of solving every `fs` syscall. Invariant: every acknowledged agent operation observes one durable workspace version.
- **Evidence / numbers:** [F] SQLite DO 10 GB limit, 2 MB max row/BLOB, 128 MB isolate memory; a 481 MiB dep tree cannot load into `/tmp`. https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/, https://developers.cloudflare.com/durable-objects/platform/limits/
- **Prior art / who has it:** Pi tool operation interfaces.
- **Verdict:** FINDING — a configured harness with adapters, not evidence arbitrary extensions/sync `fs` work.
- **Kill test / first proof:** None given.

#### Design A: Copy on command, using rsync-style deltas
- **What:** Keep a materialized runner tree; push pending brain edits before execution and pull command changes after.
- **How it would work:** Exclude rebuildable directories; a mutation journal plus hashes beats rescanning after every read-only command. Requires the receiver's base to survive across invocations (shared cached base or restored snapshot).
- **Evidence / numbers:** [I] fresh empty runners have nothing to delta against; `git diff` misses untracked/ignored files and index/rebase state; shortcomings: recursive scans, size/mtime heuristics, deletes/renames, writers still running.
- **Prior art / who has it:** rsync.
- **Verdict:** NARROWED — good first prototype if a reusable base exists; destroys 10× if it reinstalls deps or needs a continuously running receiver.
- **Kill test / first proof:** None given.

#### Design B: Runner owns the workspace; DO caches files
- **What:** Durable edits commit to the runner's persistent volume/snapshot; the DO caches text reads and records pending edits, invalidated after every writing command.
- **How it would work:** Cleanest Linux/Git semantics, but cache misses, `grep` and config discovery wake the runner; editing while it sleeps needs an authoritative overlay (converges on C) or a provider snapshot/object API.
- **Evidence / numbers:** [I] only.
- **Prior art / who has it:** —
- **Verdict:** NARROWED — good only if "runner owns it" means durable disk independent of allocated compute; bad if the only copy is on a live runner.
- **Kill test / first proof:** None given.

#### Design C: Content-addressed workspace snapshots with lazy fetch
- **What:** Immutable file/tree manifests reference Git blobs or CAS objects; the DO owns current root/version and a small pending overlay; the host presents a normal FS and fetches misses in batches.
- **How it would work:** Whole-file hashes first, chunks for large blobs; separate native Git-state/environment snapshot for staging, untracked files, LFS, submodules, modes, symlinks, in-progress ops. Batch metadata, cache negative lookups, prefetch hot sets.
- **Evidence / numbers:** [F] `--filter=blob:none` checkout still bulk-fetches blobs; Computer uses SHA-256 512 KiB fixed chunks, revision watermarks, last-writer-wins conflict cases. [M] fixed chunking amplifies: 32 B middle overwrite → 512 KiB, 32 B prepend → 8 MiB + 32 B. https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/docs/02_sync_protocol.md, https://developers.cloudflare.com/artifacts/guides/artifact-fs/
- **Prior art / who has it:** Cloudflare Computer, ArtifactFS, EdenFS.
- **Verdict:** KEPT (part of the pick, C + F) — strongest candidate with env snapshots and a host-shared cache; a substantial FS/cache product if built from scratch.
- **Kill test / first proof:** See blockers 5 and 6.

#### Design D: Network filesystem (9P/FUSE/NFS over a DO/WebSocket/R2 bridge)
- **What:** A filesystem client on the Linux runner turns FS calls into remote requests.
- **How it would work:** Only viable by serving metadata and hot data locally and uploading a write journal — effectively C. R2 via `s3fs` is poor as main checkout.
- **Evidence / numbers:** [E] 10,000 serialized misses × 5 ms = 50 s, × 50 ms = 500 s. [F] Computer benchmark: 854-package/36,675-file install **124.7 s on computerd FUSE vs 63.9 s on ext4**, excluding the pull into the DO. https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/docs/19_performance.md, https://developers.cloudflare.com/sandbox/files/mount-an-r2-bucket/
- **Prior art / who has it:** Cloudflare Computer computerd, s3fs R2 mounts.
- **Verdict:** KILLED as naive per-syscall design — poor if every syscall touches the DO or the connection blocks hibernation.
- **Kill test / first proof:** None given.

#### Design E: Keep a warm runner pinned; only hibernate the brain
- **What:** Working tree, index, deps, caches and processes stay together on a live runner.
- **How it would work:** Correct and fast, but saves no runner memory/disk; a pause-to-disk VM that releases resources is a snapshot design instead.
- **Evidence / numbers:** [I]; cost table: pinned runner = 1.0×, pinned + nonhibernating DO = 0.91×.
- **Prior art / who has it:** —
- **Verdict:** KILLED for the 10× claim — acceptable only as an explicitly priced mode for dev servers, browsers, databases, watchers.
- **Kill test / first proof:** None given.

#### Design F: Cached base plus writable overlay
- **What:** Shared immutable toolchain/dependency/base-repo image plus a private writable source/environment delta.
- **How it would work:** Cache keys include lockfile, OS/arch/libc, runtime ABI, setup script; OverlayFS lower/upper layers with whiteouts (copy-up of whole files); preserve upper layer or use a block/snapshot system beneath. Keep deps/caches on native paths; explicit durability classes (ignored ≠ disposable).
- **Evidence / numbers:** [F] kernel OverlayFS docs https://docs.kernel.org/filesystems/overlayfs.html; [I] otherwise.
- **Prior art / who has it:** Linux OverlayFS.
- **Verdict:** KEPT (part of the pick, C + F) — preserves 10× when bases are shared and runners stop; loses it if every host re-downloads bases or overlays grow without compaction.
- **Kill test / first proof:** See blocker 1.

#### Finding: Local experiment — small edits versus discovery overhead
- **What:** rsync of a Pi source tree across four constructed edit boundaries plus no-change rounds and chunking tests.
- **How it would work:** `rsync -a --no-whole-file --delete --stats` on macOS arm64, comparing hashes/modes after each boundary; no network/FUSE/DO.
- **Evidence / numbers:** [M] boundaries: 9,517 B changed → 962 B unmatched, ~185 KB sent+received, 185 ms; 88 B doc → 170 ms; rename+delete 220 ms. Initial hydration 0.820 s (30.68 MB). Warm no-change rounds 161 ms median, ~184 KB/round; checksums 353 ms. Metadata walk 25,293 files, 194 ms. A 5-byte same-size rewrite with restored mtime was **missed by rsync quick-check**. Tests passed (2, 0.523 s).
- **Prior art / who has it:** —
- **Verdict:** FINDING — source deltas are small; a mutation journal removes more overhead than block diffing. Does not decide persistence, R2/DO latency, mount semantics, Git-index consistency, or 10×.
- **Kill test / first proof:** None given.

#### Prior art: Cloudflare Computer
- **What:** SQLite VFS in a DO, local computerd/FUSE mirror, incremental push/pull, optional disk-backed mirror and local-only native paths.
- **How it would work:** Closest implementation of the brief; container/sync components experimental. Its WebSocket backend uses ordinary acceptance — **DO hibernation is not shipped for that connection**; it can restore a supplied container snapshot.
- **Evidence / numbers:** [F] Issue #179: Computer 0.3.1, ~400-file TS monorepo, install timeout at 120 s, ~3 more minutes, then DO storage timeouts (closed; local-only paths address it). https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/packages/computer/README.md#status, https://github.com/cloudflare/computer/blob/b681446f0eaed8ad010bcd2f5e61b3680a6c02c4/docs/11_lifecycle.md, https://github.com/cloudflare/computer/issues/179
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING — evaluate rather than reimplement.
- **Kill test / first proof:** None given.

#### Prior art: Cloudflare Artifacts + ArtifactFS
- **What:** Git-compatible versioned tree storage; ArtifactFS does blobless preparation and hydrates a FUSE worktree on demand.
- **How it would work:** Lazy Git-backed checkout; dirty files are not auto-persisted (commit/push is writeback); deps/Git-local state need another layer.
- **Evidence / numbers:** [F] https://developers.cloudflare.com/artifacts/guides/artifact-fs/
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING — lazy checkout already exists.
- **Kill test / first proof:** None given.

#### Prior art: Cloudflare Sandbox / Containers snapshots
- **What:** Explicit root-filesystem snapshots, directory backups, R2 mounts.
- **How it would work:** Snapshot API public beta; filesystem only (no RAM/processes); image-version constraint; 30-day TTL refreshed by restore; requires `durable_object` scheduling.
- **Evidence / numbers:** [F] snapshot latency and incremental transfer not established publicly. https://developers.cloudflare.com/containers/guides/snapshots/
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Prior art: Vercel Sandbox and Drives
- **What:** Filesystem snapshots, persistent sandbox resume, separate persistent Drives.
- **How it would work:** Compute lifetime independent of workspace storage; Drives GA **2026-10-15** with independent writable forks.
- **Evidence / numbers:** [F] https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence, https://vercel.com/changelog/vercel-drives-is-now-generally-available
- **Prior art / who has it:** Vercel.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Prior art: E2B pause/resume
- **What:** Pause/resume saves filesystem and memory; filesystem-only mode exists.
- **How it would work:** Pausing removes running-compute billing; an unmodified whole-agent VM can be paused, so it is the necessary competing baseline.
- **Evidence / numbers:** [F] docs quote ~4 s/GiB RAM to pause, ~1 s resume; a snapshotting node can refuse a pause. https://docs.e2b.dev/sandbox/persistence
- **Prior art / who has it:** E2B.
- **Verdict:** FINDING — the split must beat a pausing whole-agent VM.
- **Kill test / first proof:** None given.

#### Prior art: Codex Cloud, OpenAI Agents API, Cursor Cloud agents
- **What:** Codex Cloud: prepared environments, per-task saved state incl. uncommitted changes, cache-preserving refresh. OpenAI Agents API: harness on OpenAI, executor in an attached environment over an outbound connection. Cursor: dedicated dev VM, prepared Builds, encrypted VM-disk snapshots (30-day retention).
- **How it would work:** The control/execution split is already a product pattern; none publish a per-command VM lifetime or CAS internals.
- **Evidence / numbers:** [F] https://developers.openai.com/api/docs/guides/agents-api/architecture, https://learn.chatgpt.com/docs/environments/cloud-environments, https://prod.cursor.com/docs/cloud-agent/setup
- **Prior art / who has it:** OpenAI, Cursor.
- **Verdict:** FINDING.
- **Kill test / first proof:** None given.

#### Prior art: Replit snapshot engine, BuildBuddy, Meta EdenFS, Google Piper/CitC
- **What:** Replit: GCS-backed virtual block devices, lazily fetched, immutable 16 MiB chunks, CoW forks. BuildBuddy: chunked disk/RAM snapshots, lazy download, FUSE, `userfaultfd`. EdenFS: virtualized source tree with on-demand data. Piper/CitC: historical precedent (ACM full text returned 403, details not used).
- **How it would work:** Together establish lazy workspaces and warm build state without a pinned VM — but need execution-host machinery.
- **Evidence / numbers:** [F] https://replit.com/blog/inside-replits-snapshot-engine, https://www.buildbuddy.io/blog/fast-runners-at-scale/, https://github.com/facebook/sapling/blob/main/eden/fs/docs/Overview.md
- **Prior art / who has it:** Replit, BuildBuddy, Meta, Google.
- **Verdict:** FINDING — mechanisms already exist.
- **Kill test / first proof:** None given.

#### Finding: Which versions of the cost/density claim survive
- **What:** Density model `gain ≈ runner_RAM / (d × runner_RAM + b × brain_RAM)`; 10× needs `d < 10%`, 50× needs `d < 2%`. Container CPU is billed for active usage only, so hibernation mainly removes idle memory/disk.
- **How it would work:** One-hour standard-2 session (6 GiB, 12 GB disk, 180 active vCPU-s) baseline $0.060624.
- **Evidence / numbers:** [E] ideal 5% duty → $0.006547 (**9.3×**); +30 resumes × 2 s → 8.1×; runner stops but DO resident all hour → **5.0×**; pinned runner → 1.0×; pinned + nonhibernating DO → 0.91×. A 30 s gap with 60 s keepalive never stops; re-fetching 133 MiB deps on 30 commands = 4.18 GB, ≥335 s at 100 Mbit/s, ~$0.105 egress (above the whole baseline). [F] pending I/O retains a DO and incurs duration. https://developers.cloudflare.com/durable-objects/platform/pricing/
- **Prior art / who has it:** E2B (pausing whole-VM baseline).
- **Verdict:** FINDING — 20× less runner time ≠ 20× less money; jitk latency/VM-size claims are not workspace measurements.
- **Kill test / first proof:** None given.

#### Blocker 1: Runner destruction loses the expensive state
- **What:** Reinstalling/rehydrating deps and caches every command erases latency and cost savings.
- **How it would work:** Pi has 481 MiB deps vs 29 MiB source [M]; Cloudflare disk is ephemeral absent restore [F].
- **Evidence / numbers:** score 5×5 = 25 [E].
- **Prior art / who has it:** —
- **Verdict:** Rank 1 (25) — open.
- **Kill test / first proof:** Replay 30 command bursts with real runner termination between them, preserving source/deps/Git/caches via snapshot/base, warm and forced-miss cases. **Pass:** no reinstall on unchanged lockfile; all overhead in `d`; correctness survives; to claim 10×, measured end-to-end marginal cost ≤10% of baseline.

#### Blocker 2: Lost or stale edits from two writers and incomplete checkpoints
- **What:** rsync quick-check missed a same-size/mtime edit [M]; Computer documents conflict cases [F]; untracked/ignored files and `.git/index` not captured by source diffs.
- **How it would work:** —
- **Evidence / numbers:** score 4×5 = 20 [E].
- **Prior art / who has it:** —
- **Verdict:** Rank 2 (20) — open.
- **Kill test / first proof:** Seeded 10,000-op trace (overwrite, rename-replace, delete/recreate, chmod, symlink, hardlink, Git staging, untracked files) vs native FS, with termination before/after publish/ack and delayed replies from an old runner. **Pass:** zero acknowledged-write loss, zero stale-writer publication, matching bytes/modes/links and Git status/index; ambiguous completion surfaced, not rerun.

#### Blocker 3: The filesystem connection or background jobs pin both halves
- **What:** Computer's WebSocket backend does not hibernate [F]; watchers/dev servers/databases keep writing after the parent exits [I].
- **How it would work:** —
- **Evidence / numbers:** score 4×5 = 20 [E].
- **Prior art / who has it:** —
- **Verdict:** Rank 3 (20) — open.
- **Kill test / first proof:** Close/detach transport after durable publication; evict and reconstruct the local workerd DO; record allocated intervals, socket/timer lifetimes and pending jobs over 30 simulated model waits. **Pass:** ordinary waits retain no runner allocation and no brain connection preventing eligibility; ongoing jobs explicitly select a priced persistent mode.

#### Blocker 4: DO memory/storage limits become a hard ceiling
- **What:** 128 MB isolate, 10 GB SQLite, 2 MB rows [F]; materializing checkout/deps in Worker `/tmp` fails [I].
- **How it would work:** —
- **Evidence / numbers:** score 4×4 = 16 [E].
- **Prior art / who has it:** —
- **Verdict:** Rank 4 (16) — open.
- **Kill test / first proof:** Local workerd with a >128 MiB virtual source corpus and large blobs outside the isolate; exercise read/edit/search and crash recovery. **Pass:** peak working memory <96 MiB, bounded streaming, no row above limits, deps never duplicated into DO storage by default.

#### Blocker 5: Lazy loading becomes a metadata/working-set tax
- **What:** Recursive searches and compilers hydrate broad sets; remote metadata can dominate bytes [I]; Computer's full install ~2× ext4 before pull [F].
- **How it would work:** —
- **Evidence / numbers:** score 4×4 = 16 [E].
- **Prior art / who has it:** —
- **Verdict:** Rank 5 (16) — open.
- **Kill test / first proof:** Run `git status`, `rg`, a focused test and an incremental build on native disk vs the mount at 5/20/50 ms RTT, 100 Mbit/s, then an empty host cache. **Pass:** warm p95 added latency ≤1 s; cold recovery-to-first-useful-command p95 ≤3 s; incremental build ≤1.2× native — else narrow the target or abandon per-command teardown.

#### Blocker 6: Write amplification and storage/operation overhead consume the margin
- **What:** Fixed chunks amplify tiny edits [M]; Git pack replacement, large renames and thousands of PUTs are expensive [I].
- **How it would work:** —
- **Evidence / numbers:** score 3×4 = 12 [E].
- **Prior art / who has it:** —
- **Verdict:** Rank 6 (12) — open.
- **Kill test / first proof:** Replay a source edit, lockfile change, large prepend, directory rename and Git repack; count manifest records, bytes, operations, CPU, retained versions. **Pass:** ordinary boundaries upload ≤1 MiB with no whole-tree listings; large jobs handled as large jobs; aggregate still meets target cost ratio; retention/GC before extrapolating monthly cost.

#### The pick: manifest + journal + cached native snapshot/overlay (C + F)
- **What:** A versioned source manifest and edit journal coordinated by the DO, backed by content-addressed storage, plus a reusable native runner environment snapshot/base and private writable overlay.
- **How it would work:** (1) one durable root + one writer lease `(workspaceVersion, manifestRoot, environmentSnapshot, leaseEpoch)`; (2) Pi file adapters edit the canonical version and publish before ack while hands sleep; (3) dispatch at a version fence, applying only changes since the snapshot's root, `.git` local state kept with the env snapshot; (4) collect command writes, upload blobs, then transactionally advance the manifest fenced by lease epoch; (5) deps/caches outside source sync on native paths; (6) stop execution after checkpoint, no runner kept to receive patches. No exactly-once shell promise; report ambiguous completion.
- **Evidence / numbers:** [I]; small repos can eagerly materialize the 9 MiB compressed source once per cold start.
- **Prior art / who has it:** Cloudflare Computer (start from its source and local-only paths).
- **Verdict:** KEPT (#1) — go-with-changes.
- **Kill test / first proof:** Three verifications: (1) lifecycle-and-cost replay — 30 edit→command→wait cycles on Pi and one app, comparing pinned runner, whole-agent pause/snapshot and split-destroyed runner, 1-in-5 forced cache miss, 100 Mbit/s and 20 ms RTT; **pass:** total cost ≤10% of best comparable baseline plus §7 latency thresholds; (2) crash-and-Git differential test with two stale-lease runners — zero acknowledged loss or stale versions; (3) real adapter and mount check of Pi startup/extensions/file tools under local workerd plus a Linux runner FS benchmark.

#### Rejected in this report
- **Pinned session runners** — remove the intended density gain.
- **Whole dependency syncs per command** — transfer time and egress exceed the baseline's whole runner cost.
- **Per-syscall remote filesystems** — metadata latency products of 50–500 s per 10k misses.

### 06-economics: Economics, competition, and whether the 10× matters
Lens: price a reproducible one-hour, 20-turn session across live, paused and split architectures, add inference, map competitors and buyers. Headline: the literal split costs ~$0.0196/session-hour — 8.5× below live E2B/Daytona but only 4× below paused E2B, 1.9× below a 4 GB Sprite, and *more* than a Sprite using 1 GB; end-to-end savings are 2.7% (Astra), 12.8% (Sol), 67% (Luna); the broad split already ships (Cloudflare PiHarness runs Pi Durable in a DO). The bet: a bounded "pinned Pi CLI in workerd, state survives eviction, tools remote, real billing comparison" demo. Verdict: **go-with-changes for the compatibility/measurement demo; no-go for the generic "serverless agent brain + sandbox" product**.

#### Finding: Reproducible workload and accounting boundary
- **What:** An explicit estimated workload (no Pi trace was available): 1 h session, 20 turns, 50k input + 2k output tokens/turn, 80% cache reads, 60 s model latency/turn, 60 commands × 2 s, 2,280 s waiting, 20 runner bursts with 2 s transition each, 1 GB workspace kept 24 h.
- **How it would work:** `H_live`, `H_pause`, `H_split` formulas; Total/session = H + inference I + tools X; common control-plane budget K ≈ $0.00114/session; DO brain budgeted a full hour because pending model I/O prevents hibernation.
- **Evidence / numbers:** [E] all inputs; [I] formulas.
- **Prior art / who has it:** —
- **Verdict:** FINDING — service-consumption costs only; engineering/support/margin excluded.
- **Kill test / first proof:** None given.

#### Finding: Verified rate card and premise corrections
- **What:** Public tariffs for E2B, Daytona, Modal, Fly, Sprites, Cloudflare Containers/Workers/DO, R2.
- **How it would work:** E2B 2/4 = $0.1656/h; Daytona 2/4 = $0.1656/h; Modal Sandbox 1 core/4 GiB = $0.23796/h; Fly shared-2x/4 GB = $0.035264/h; Sprites $0.0385/CPU-h + $0.021875/GB-h; Cloudflare $0.000020/vCPU-s active, $0.0000025/GiB-s RAM, standard-3 = 2 vCPU/8 GiB/16 GB (2/4 unavailable); DO $12.50/M GB-s at 128 MB/object.
- **Evidence / numbers:** [F] E2B stops billing when paused (unlimited retention); Daytona charges only disk when stopped/paused; Modal charges max(request, actual); DO duration is wall time including pending I/O — full-hour brain = $0.00576; hibernation does not restore an arbitrary Node stack. https://e2b.dev/pricing, https://docs.e2b.dev/billing, https://developers.cloudflare.com/durable-objects/platform/pricing/
- **Prior art / who has it:** E2B, Daytona (pausing already incumbent).
- **Verdict:** FINDING — pausing is not unique to the split.
- **Kill test / first proof:** None given.

#### Scenario A: VM/container remains alive for the hour
- **What:** Each provider kept alive for the full hour with workspace + K.
- **How it would work:** Cloudflare's ephemeral disk needs an external R2 workspace copy and an active controller DO.
- **Evidence / numbers:** [E/I] E2B $0.16674; Daytona $0.16674 (or $0.17452 with 8 GiB disk); Modal $0.24210; Fly shared $0.04140; Fly performance $0.09781; Cloudflare standard-3 $0.08588 (CPU only $0.0024, RAM $0.072). Right-sized Modal (0.125 core, 1 GiB actual) ≈ $0.049, only ~2.5× the split. E2B 2-vCPU/512-MiB default $0.1089/h.
- **Prior art / who has it:** E2B, Daytona, Modal, Fly, Cloudflare.
- **Verdict:** FINDING — right-sizing defeats impressive ratios.
- **Kill test / first proof:** None given.

#### Scenario B: Paused/snapshotted between turns
- **What:** Whole VM paused between turns but alive through inference (a streaming HTTPS model call keeps the VM alive).
- **How it would work:** Retains 1,200 s inference + 120 s commands plus transitions (E2B ~17 s × 20 cycles = 1,660 billed s; Sprites/Modal 2 s → 1,360 s).
- **Evidence / numbers:** [E/I] E2B pause $0.07750; Sprite 4 GB $0.03641; Modal ≥$0.09404 + S (unpriced snapshot cost). Modal memory snapshots are alpha (7-day expiry, close TCP, can't snapshot a running exec). Sprites cannot sleep through an open model connection. A Sprite using 1 GB ≈ **$0.01161 — cheaper than the literal split**. https://modal.com/docs/guide/sandbox-snapshots, https://fly.io/sprites/
- **Prior art / who has it:** E2B, Fly Sprites, Modal.
- **Verdict:** FINDING — the paused baseline is the one to beat.
- **Kill test / first proof:** None given.

#### Scenario C: Workers/DO brain plus on-demand runner (the literal split)
- **What:** Full-hour DO brain, 20 runner bursts totalling 160 s alive, 120 active CPU-s, controller DO, 1 GB DO workspace for a day.
- **How it would work:** Literal H = $0.00576 brain + $0.0057792 runner + $0.000256 controller + $0.0066667 workspace + $0.00114 K = **$0.0196019**; R2 workspace variant **$0.0134852**.
- **Evidence / numbers:** [E/I] DO+E2B runner $0.03473; DO+Fly $0.02013; DO+Modal $0.02714. If the brain hibernates for all 2,280 between-turn seconds, split ≈ $0.01595 (just over 10× below live E2B). Each extra alive runner second ≈ $0.00002272; at 160/640/1,200/3,600 s → $0.0196/$0.0305/$0.0432/$0.0978. Fixed floor ≈ $0.0160 permits only ~31 alive runner seconds for 10× vs E2B; **50× cannot fit even the floor**. Cross-layer: 03-brain's 9,000 rows per 1,000 overwrites would add ~$0.008. [F] Cloudflare disk ephemeral across sleep. jitk has no purchasable tariff; pricing it at ~zero would be invented.
- **Prior art / who has it:** Cloudflare Agents/Containers.
- **Verdict:** NARROWED — 10× is baseline-dependent; 50× impossible in the literal design.
- **Kill test / first proof:** See blocker 2.

#### Finding: Fleet invoices, limits and missing line items
- **What:** Plan fees, allowances, concurrency and egress beyond list rates.
- **How it would work:** E2B Pro $150/month, concurrency add-ons, $3,000/month enterprise minimum; Modal Starter/Team; Cloudflare invoices after allowances ≈ $28.29 / $1,908.98 / $19,544.56 at 1k/100k/1M sessions; Daytona disk-allowance ambiguity.
- **Evidence / numbers:** [F/I/E] 1M one-hour sessions/month ≈ 1,389 live sessions avg vs ~62 runners; 5× peak = 6,944 brains or 309 runners; Cloudflare default limit 6 TiB RAM/1,500 vCPU — always-on standard-3 exceeds RAM limit even on average, split fits. Egress: 1 GB/session = $20k–$150k/month per million sessions (Cloudflare $0.025, Fly $0.02, Modal $0.04, Vercel Sandbox $0.15/GB; R2 free).
- **Prior art / who has it:** —
- **Verdict:** FINDING — concurrency headroom is real capacity leverage; egress can exceed split compute.
- **Kill test / first proof:** None given.

#### Finding: Inference share and the 2–5% premise
- **What:** Model dollars per estimated session-hour under standard API tariffs with caching.
- **How it would work:** `I = 0.8 × cached + 0.2 × cache_write + 0.04 × output`.
- **Evidence / numbers:** [F/I] cached $/h: GPT-6 Astra $5.30; Claude Opus 5.5 $1.96; GPT-6.1 Sol / Sonnet 5.5 $0.98; GPT-6 Luna / Haiku 5.5 $0.053; Workers AI Qwen3 30B $0.0644, Granite 4.0 H Micro $0.02148, GPT-OSS 120B $0.380, Qwen2.5 Coder 32B $0.700. E2B infra share: 3.1% Astra, 7.8% Opus, 14.5% Sol, 75.9% Luna, 72.1% Qwen3; split share 0.37%, 0.99%, 1.96%, 27.0%, 23.3%; Granite split 47.7%. https://platform.claude.com/docs/en/about-claude/pricing, https://developers.cloudflare.com/workers-ai/platform/pricing/
- **Prior art / who has it:** —
- **Verdict:** FINDING — "infra is 2–5%" is conditional on the model tier; compare cost per verified task.
- **Kill test / first proof:** None given.

#### Finding: End-to-end fleet bills including inference
- **What:** Total per-session cost by architecture and model.
- **How it would work:** Add I × N to any architecture.
- **Evidence / numbers:** [I/E] Live E2B + Sol $1.14674; paused E2B + Sol $1.05750; paused Sprite + Sol $1.01641; split + Sol $0.99960; live E2B + Luna $0.21974; split + Luna $0.07260. Split cuts live-E2B total 12.8% (Sol), 2.7% (Astra), 67.0% (Luna); vs paused 4 GB Sprite only **1.7%** (Sol) or 18.8% (Luna).
- **Prior art / who has it:** Fly Sprites.
- **Verdict:** FINDING — the commercially relevant comparison is small.
- **Kill test / first proof:** None given.

#### Finding: Exact 25% threshold and price trends
- **What:** Infra share > 25% exactly when I < 3H; workload-weighted $/M thresholds per baseline.
- **How it would work:** Inference must fall below $0.5002/h vs live E2B ($0.4810/M), $0.2325 vs paused E2B, $0.1092 vs 4 GB Sprite, **$0.0588 for the literal split ($0.0565/M)**, $0.0405 for R2 split.
- **Evidence / numbers:** [F/I] 2023 gpt-4-0314 $30/$60 (basket $32.40); 2024 GPT-4o mini $0.15/$0.60 ($0.174, 186× lower across tiers); 2025 Opus 4.5 $5/$25 vs $15/$75 (3×); 2026 Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Sol $2/$10, Astra $10/$50; Anthropic tokenizer ~30% more tokens. [E] Sol needs further 1.96× / 4.22× / 8.97× / 16.67× declines vs live E2B / paused E2B / paused Sprite / split; under a halving-every-6–12-months scenario ≈ 2027 / late 2027–2028 / 2028–early 2030 / late 2028–2030; Astra vs split needs 90× (~3.2–6.5 years). https://developers.openai.com/api/docs/deprecations, https://www.anthropic.com/news/claude-opus-4-5
- **Prior art / who has it:** —
- **Verdict:** FINDING — no universal crossover date; already reached for cached Luna/Haiku on the split.
- **Kill test / first proof:** None given.

#### Prior art: Cloudflare Agents + Sandbox (PiHarness)
- **What:** PiHarness runs Pi Durable in a DO with SQLite state, wake-up, retries/recovery, plus a durable FS/code-execution example; Sandbox guides run Claude Code, Codex, OpenCode and Pi in Linux Containers.
- **How it would work:** —
- **Evidence / numbers:** [F] https://developers.cloudflare.com/agents/harnesses/pi/, https://developers.cloudflare.com/sandbox/coding-agents/
- **Prior art / who has it:** Cloudflare.
- **Verdict:** FINDING — the broad brain/state-on-DO idea, even with Pi, is occupied; not evidence the full original CLI runs unmodified in workerd.
- **Kill test / first proof:** None given.

#### Prior art: Vercel AI SDK HarnessAgent + Sandbox + just-bash
- **What:** HarnessAgent adapters for Claude Code/Codex/Pi with sessions; the real harness inside a Sandbox; just-bash in-process TS shell/VFS; Managed Agents with Vercel execution.
- **How it would work:** CLI-in-Sandbox still pays sandbox memory during inference.
- **Evidence / numbers:** [F] https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk, https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/README.md
- **Prior art / who has it:** Vercel.
- **Verdict:** FINDING — cheap local shell + real runner already exists.
- **Kill test / first proof:** None given.

#### Prior art: Modal, E2B, Daytona
- **What:** Modal's Managed Agents integration separates Anthropic's hosted loop from Modal tool execution; E2B supports external harnesses and an AI SDK adapter running Claude Code/Codex; Daytona documents Claude Code in-sandbox, Agent SDK and Managed Agents.
- **How it would work:** —
- **Evidence / numbers:** [F] https://modal.com/blog/introducing-claude-managed-agents-with-modal-sandboxes, https://github.com/e2b-dev/ai-sdk-sandbox, https://www.daytona.io/docs/en/claude/
- **Prior art / who has it:** Modal, E2B, Daytona.
- **Verdict:** FINDING — external orchestration + sandbox is standard.
- **Kill test / first proof:** None given.

#### Prior art: Replit, Codex cloud, Cursor, Devin
- **What:** Finished managed-agent competitors: Replit (checkpoints, background tasks), Codex cloud (per-task prepared workspace; Agents SDK keeps the loop in the app and uses sandbox as a tool), Cursor (isolated VMs, self-hosted machines, infra bundled into model pricing), Devin (cloud agents with model quotas).
- **How it would work:** None publicly shows a CLI brain executing in workerd.
- **Evidence / numbers:** [F] https://learn.chatgpt.com/docs/cloud, https://cursor.com/docs/cloud-agent, https://devin.ai/pricing
- **Prior art / who has it:** Replit, OpenAI, Cursor, Cognition.
- **Verdict:** FINDING — bundling makes "save a few infra cents" a weak end-user proposition.
- **Kill test / first proof:** None given.

#### Prior art: Anthropic Managed Agents
- **What:** Charges $0.08 per active session-hour plus tokens, excluding idle/rescheduling time; integrations with Modal, Vercel, Daytona.
- **How it would work:** —
- **Evidence / numbers:** [F] https://platform.claude.com/docs/en/about-claude/pricing
- **Prior art / who has it:** Anthropic.
- **Verdict:** FINDING — the broad split is already a paid managed category.
- **Kill test / first proof:** None given.

#### Prior art: Pi's Gondolin extension
- **What:** Pi documents an extension that leaves Pi on the host and routes built-in tools and `!` commands into a microVM; `badlogic/pi-mono` redirects to `earendil-works/pi`.
- **How it would work:** Other extensions still run on the host unless they delegate.
- **Evidence / numbers:** [F] https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/containerization.md
- **Prior art / who has it:** Pi.
- **Verdict:** FINDING — tool transport separation is not new even within Pi.
- **Kill test / first proof:** None given.

#### What might remain unclaimed: pinned-CLI compatibility boundary in workerd
- **What:** A tested boundary that runs a pinned existing CLI/package unchanged in workerd, supports a useful extension corpus, preserves FS/process/session behavior across eviction, and swaps execution providers without rewriting tools.
- **How it would work:** A compatibility suite plus upgrade maintenance; no evidence found that the full Pi CLI, arbitrary extensions, Claude Code and Codex run unmodified in workerd with only subprocesses remote.
- **Evidence / numbers:** [I].
- **Prior art / who has it:** Cloudflare Pi Durable (adjacent).
- **Verdict:** NARROWED — demo/CV piece go-with-changes; product "not yet"; "neither" if it only reproduces the PiHarness example or a microbenchmark that omits inference/snapshots/storage. "GrowOS writes more Node shims", a fast command transport, or a sample Pi DO app are not durable differentiation.
- **Kill test / first proof:** See blockers 1 and 4.

#### Finding: Who pays, and how much room is there
- **What:** Candidate buyers: platforms hosting many persistent agents, cheap-model agents, massive fan-out/evals, background/waiting agents, interactive frontier subscribers (low willingness).
- **How it would work:** Each needs a qualification (avoidable bill after incumbent pause/right-sizing; small models complete tasks; peak runner concurrency; existing DO/Workflow/E2B-pause must fail a requirement).
- **Evidence / numbers:** [F/I/E] 1M agents × 1 GB retained all month = $200k/month DO storage (R2 $15k). Savings: $0.147/session vs live E2B ($147k/month at 1M), $0.0579 vs paused E2B, $0.0168 vs 4 GB Sprite; loses vs 1 GB Sprite. Capturing 30% of Sprite savings ≈ $0.005/session = $5k/month at 1M; one $180k/year engineer needs ~3M sessions/month. A 2% extra inference-retry rate at 1M Sol sessions ≈ $19.6k/month, above the entire saving vs paused Sprite.
- **Prior art / who has it:** —
- **Verdict:** FINDING — thin commercial ceiling.
- **Kill test / first proof:** None given.

#### Blocker 1: Incumbent already meets the need
- **What:** Cloudflare PiHarness + durable files; Vercel/Modal/Anthropic external-loop designs.
- **How it would work:** A port can be technically novel without solving a commercial gap.
- **Evidence / numbers:** [E] 0.95 × 5 = 4.75.
- **Prior art / who has it:** Cloudflare, Vercel, Modal, Anthropic.
- **Verdict:** Rank 1 (4.75) — open.
- **Kill test / first proof:** 3–4 h: pin Pi, run Cloudflare's PiHarness example with a fake model, replay ten essential CLI/extension behaviors against both. **Pass:** ≥2 buyer-critical behaviors only the unchanged-CLI approach preserves, recorded as failing incumbent tests. **Fail:** existing harness + small adapters meet all essentials.

#### Blocker 2: Workspace/start/idle costs erase the ratio
- **What:** Ephemeral Cloudflare disk, provider transition time, reserved RAM; fixed DO workspace/brain floor already prevents 10× in the literal design.
- **How it would work:** —
- **Evidence / numbers:** [E] 0.80 × 5 = 4.00.
- **Prior art / who has it:** —
- **Verdict:** Rank 2 (4.00) — open.
- **Kill test / first proof:** 3–4 h: replay a 1 GB representative repo with local Node/mock runner across 20 bursts, record bytes copied, CPU, durations, save/restore latency, price with the rate card. **Pass for 10×:** total H ≤ $0.01667 vs E2B with no omitted service; **commercial pass:** ≥30% below the cheapest viable right-sized/paused baseline; else drop the claim or stop.

#### Blocker 3: No buyer margin after migration/reliability cost
- **What:** Favorable 4 GB Sprite case saves only $0.0168/session; 1 GB Sprite wins; a 2% retry penalty erases the gap.
- **How it would work:** —
- **Evidence / numbers:** [E] 0.80 × 4 = 3.20.
- **Prior art / who has it:** Fly Sprites.
- **Verdict:** Rank 3 (3.20) — open.
- **Kill test / first proof:** 2–3 h per candidate platform using existing invoices/traces (no outreach). **Pass:** a named owner identifies ≥$10k/month avoidable cost or a hard admission constraint plus integration budget; gates ≥30% net savings and retry overhead <0.5%. **Fail:** only hypothetical scale or comparison to needlessly idle VMs.

#### Blocker 4: "Unmodified" cannot be made durable affordably
- **What:** DO reconstruction is not VM process continuation; Pi Durable solves it with a dedicated durable runtime; network streams and extension-owned state complicate recovery.
- **How it would work:** —
- **Evidence / numbers:** [E] 0.70 × 4 = 2.80.
- **Prior art / who has it:** Pi Durable.
- **Verdict:** Rank 4 (2.80) — open.
- **Kill test / first proof:** 4 h: fake-model session, force eviction/restart between model/tool/commit boundaries 100 times with a non-idempotent mock command and workspace byte hashes. **Pass:** zero lost accepted turns, zero duplicated committed effects, exact file state, <0.5% extra model-token work. **Fail:** forbidden source changes, silent loss, or expensive replay.

#### Blocker 5: Cheap model needs much more work
- **What:** Token prices are sourced; matched task success is not; cheaper models can increase turns, retries and wall time.
- **How it would work:** —
- **Evidence / numbers:** [E] 0.60 × 3 = 1.80.
- **Prior art / who has it:** —
- **Verdict:** Rank 5 (1.80) — open.
- **Kill test / first proof:** 2–4 h: audit recorded eval traces for ≥30 comparable tasks (no new API calls). **Pass:** price complete verified outcomes incl. failures/retries and keep the commercial gate. **Fail:** only a token-basket comparison exists.

#### Blocker 6: Billed density differs from physical density
- **What:** DO bills 128 MB/object despite shared isolates; runner fleet still peaks; jitk VM overhead excludes guest workload and operations.
- **How it would work:** —
- **Evidence / numbers:** [E] 0.75 × 2 = 1.50.
- **Prior art / who has it:** —
- **Verdict:** Rank 6 (1.50) — open.
- **Kill test / first proof:** 2 h spreadsheet/Python replay of arrival times and correlated fan-out against published limits. **Pass:** intended peak within confirmed quota with ≥20% margin or a documented quota path. **Fail:** average concurrency presented as fan-out capacity, or unpriced host fleet.

#### Rejected in this report
- **Generic "serverless agent brain + sandbox" product** — already shipped by Cloudflare, Vercel, OpenAI Agents SDK, Anthropic Managed Agents with Modal/Vercel/Daytona; no-go.
- **Blanket 10–50× infrastructure claim** — baseline-dependent; 50× cannot fit the DO brain-plus-workspace floor.
- **Tiny command microbenchmark vs an always-on sandbox** — "neither" demo nor product; omits inference, snapshots and storage.
- **Storing dormant agent identities/files in DO SQL** — $200k/month for 1M × 1 GB vs R2 $15k or E2B's included paused retention.
