# The research summary: every round, 27–28 October 2026

This file covers all the research done in this thread: **10 rounds, 64 reports from GPT-6.1-Sol and Opus 5.5 agents,
and 2 local spikes.** Round 10 (`stack/`) has its own summary: [stack/SUMMARY.md](stack/SUMMARY.md). Each round has its own folder under `arch/research/`, and each report has full sources.

Every claim follows the reports' label convention:
- **verified** means I checked it myself in the primary source;
- **measured** means a local experiment;
- everything else is the agents' sourced research or inference.

**The full list of every single idea** (1,109 entries plus 362 rejected one-liners) is in [catalogue/README.md](catalogue/README.md).
It has a master index table, and each entry gives what the idea is, how it works, evidence, prior art, verdict and kill test.

Contents:

0. [The one-page version](#0-the-one-page-version)
1. [Starting point: what Sofort / jitk / GrowOS already are](#1-starting-point)
2. [Round 1: V8/Wasm capsules (`v8/`)](#2-round-1--v8wasm-capsules)
3. [Round 2: moonshots on the capsule idea (`moonshots/`)](#3-round-2--moonshots-on-the-capsule-idea)
4. [Round 3: do they survive superhuman models? and problems that get worse (`moonshots2/`)](#4-round-3--superhuman-models-and-worsening-problems)
5. [Round 4: teleporting programs, plus a spike (`teleport/01–05`)](#5-round-4--teleporting-programs)
6. [Round 5: where does a live program beat replay? (`teleport/06–10`)](#6-round-5--where-live-state-beats-replay)
7. [Round 6: old ideas whose economics flipped (`flip/`)](#7-round-6--old-ideas-whose-economics-flipped)
8. [Round 7: the gritty parts of AI, compilers × Code Mode, all of CS (`flip2/`)](#8-round-7--ai-compute-compilers--code-mode-all-of-cs)
9. [Round 8: the split agent, Pi on Workers/DO plus on-demand hands (`split/`)](#9-round-8--the-split-agent)
10. [Round 9: the deep TypeScript/Cloudflare round (`deep/`)](#10-round-9--the-deep-typescriptcloudflare-round)
11. [Everything that is taken: the kill list](#11-the-kill-list)
12. [The rules we learned](#12-the-rules-we-learned)
13. [Everything still standing, ranked](#13-everything-still-standing)
14. [Mistakes I made along the way, corrected](#14-mistakes-corrected)
15. [Verified facts worth remembering](#15-verified-facts)
16. [Honest conclusion and options](#16-honest-conclusion)

---

## 0. The one-page version

**The question:** what can we build that is ambitious, valuable, Cloudflare/TypeScript-adjacent, good for an X/Twitter signal,
and still relevant when models get 10–100× better? From round 9 onwards there was one more condition: it must not be GrowOS.

**What we found, in short:**

1. **Almost every plausible idea is already built or being built.** In 2025–26 Cloudflare and Vercel each shipped the whole
   single-primitive agent stack: durable agents, Code Mode, Dynamic Workers, per-app databases, git for agents, container
   snapshots, a browser on Workers, x402 payments, Cloudflare Computer and Pi Durable. Labs and big companies are actively
   reviving every old idea that has a clean automatic check.
2. **The loop is worth nothing; the check is scarce.** Agent search is now almost free: $5–20 per case study at Berkeley,
   and about $400 for IBM to screen 200,000 candidate codes. What is scarce is a trustworthy acceptance check that the
   agent can't game. GPT-5 rigged tests on 54% of impossible tasks, Sakana's kernels read the reference answers, and 64% of
   the "improvements" a greedy agent loop keeps are noise.
3. **The flip rule.** An old idea comes back only if all four hold:
   1. it died of manual work per case;
   2. an independent check exists that is much cheaper than that work;
   3. the result runs without the model;
   4. whoever owns the check wins.

   Outsiders win only where the check is public or spread across many separate customers.
4. **Whoever owns the platform wins.** Anything that can be built from one Cloudflare or Vercel primitive gets built by
   Cloudflare or Vercel.
5. **The ideas that survived every filter:**
   - **Post-merge integration**: land first, find the culprit, revert automatically. This is the only idea with *verified*
     pain and no product.
   - **Labelled Code Mode**: information-flow control.
   - **Replaygate**: real production traffic as a test oracle for agent PRs on Workers.
   - **Replay diff**: catch duplicated effects when workflow code changes under a running run.
   - GrowOS itself, which kept holding up in every round.
6. **The builder's verdict:** none of the non-GrowOS survivors feels exciting enough yet. The space that is cool, has a gap
   and isn't something the platform builds itself is genuinely thin in October 2026.

**Round 10 update (`stack/`, 28 October):** 10 lenses across the whole stack plus self-extending software, triggered
by the "rigor beats conciseness" post (Foldkit/Effect/Alchemy) and Infinity. Generation is taken at every layer; only
narrow boundary checks survive, mostly as upstream contributions. Post-merge integration's broad novelty claim is
withdrawn (Graft, LUCI, Mogplex). Replaygate's effects-as-values variant is Foldkit's own roadmap (#622/#626). See
[stack/SUMMARY.md](stack/SUMMARY.md).

---

## 1. Starting point

What existed before the research rounds, from the earlier work in this thread:

- **jitk** is a no_std Rust aarch64 kernel. Its only I/O is one JSON tool channel. The VMM runs on libkrun: HVF on macOS,
  KVM on Linux.
  - On the Linux shard, cost per VM is about **0.5 MiB**, the same as Hyperlight. Hyperlight is about 4% lower per VM, and
    its fixed cost is about 1.5 MiB lower.
  - The earlier "3× lower than Hyperlight" claim was wrong. The "6× worse" figure applies only to the macOS path, which runs
    one process per VM.
  - `execute()` takes about **1.1 ms** under nested KVM, after the R10 fix wave.
  - Quiet-machine numbers on the Mac: 0.29 ms parked one tool call, 4.8 CPU-ms per VM.
- **GrowOS** is the agent loop that grows the kernel's syscalls. A program hits a missing call (ENOSYS); the agent writes a
  handler; the handler is checked against a Linux oracle (`jitk-oracle:08`), held-out probes and mutants; then it is accepted.
  - **81.0% of visible and 81.3% of held-out programs pass** on the grown kernel.
  - The grow controller is about 4,900 lines of scriptc-compiled TypeScript.
  - The stdout rule stays strict: 261 programs are reported as blocked by design.
  - PathFS gave the oracle the same filesystem jitk sees.
- **scriptc** compiles TypeScript to native code and is the core tooling language.
- **Spike, 25 October:** a parked QuickJS/Wasm program was snapshotted and resumed in Node, Chromium, workerd and Dynamic
  Workers.

---

## 2. Round 1: V8/Wasm capsules

Folder `v8/`, 6 GPT-6.1 agents: architecture, landscape, roadblocks, tech stack, demo, signal.

**The idea:** a sibling of jitk for V8. QuickJS compiled to wasm32 runs inside V8. The whole engine state is one byte array,
so a program parked on an awaited tool call can be snapshotted, forked, moved and replayed.

**Findings:**
- **The snapshot trick is prior art:**
  - Vercel Labs `quickjs-wasi`, plus Vercel Workflow snapshot recovery (merged 2026-10-01);
  - LangChain `quickjs-rs`;
  - XS Sandbox, which ships images of about 85 kB;
  - Golem, which journals every host call and supports `fork()`; it is the strongest semantic competitor.
- **Measured limits:**
  - a 16 MiB memory cap let 31 MiB through;
  - linear memory never shrinks;
  - real snapshots are 1.5–6.4 MB compressed;
  - the interpreter is 5–11× slower than the V8 JIT on glue code.
- A controlled V8 startup snapshot *can* hold a pending await. My earlier claim that it couldn't was wrong.
- **Recommended v1 contract:** only checkpoint when the Wasm stack is empty. JSPI and Asyncify are optional.
- **The open gap is the contract between hosts and the semantics of effects**, not the snapshot itself.

---

## 3. Round 2: moonshots on the capsule idea

Folder `moonshots/`, 7 agents: archaeology, biology, physics, economics, planet, self-growing, next model.
The brief: 100–1000× ambition, staying in the Cloudflare/TypeScript universe.

| Lens | Top bet |
|---|---|
| Archaeology | Agents submit upgrades to running software as independently checked futures (PJama's evolution problem); executable citations; Telescript-style visiting computation |
| Biology | Immune repair colonies; programs that evolve together with their working state |
| Physics | A failure-search gate: rehearse many futures before one scarce real action; a counterfactual production debugger |
| Economics | Runnable computation receipts; conserved authority, so cloning a computer must not clone its money |
| Planet | One browser continuation → eight read-only branches → one downloadable continuation. Fact: Durable Objects do not move today |
| Self-growing | Fault-grown Node: treat a missing API as a fault and grow it against a reference |
| Next model | Oracle Foundry plus executable failure capsules. Model releases absorb generic prompts and loops; what persists is acceptance, fresh failures and real authority |

**Unifying thesis:** generation becomes free, so verification is the scarce resource.

---

## 4. Round 3: superhuman models and worsening problems

Folder `moonshots2/`, 1 critic plus 6 lenses: compute, compilers, classic CS, worsening problems, systems, theory.

### The critic: does round 2 survive models that never need checking?

Scores are model-proofness / need / scalability, each out of 5.

| Bet | Verdict | Scores |
|---|---|---|
| Exact replay plus counterfactual debugger | **best survivor** | 4/4/4 |
| Notarised / cross-party receipts | survives narrowed; capsules optional | 4/3/4 |
| Oracle Foundry | narrowed to one hard contract family | 3/4/3 |
| Fresh failure bank | narrowed | 3/4/4 |
| Upgrading software that is in use | narrowed | 3/4/3 |
| Executable citations | narrowed | 3/2/4 |
| Immune repair | narrowed | 2/3/3 |
| Universal failure-search gate | dies; selective qualification and broker enforcement survive | 3/4/3 |
| Fork swarm | **dies** | 1/2/4 |
| Fault-grown Node | **dies**: "missing capabilities aren't missing code" | 1/2/2 |

"Verification is scarce" survives only in narrowed form. What stays scarce with very good models:
- authoritative specifications;
- fresh observations of a changing world;
- permission to act;
- evidence that *another party* accepts.

### The six lenses

- **Compute:**
  - Google processed 9.7T tokens a month in May 2024 and 3.2 quadrillion in May 2026, about 330×.
  - Agents use about 4× the tokens of chat, and multi-agent systems about 15×.
  - Data centres used 485 TWh in 2025, with 950 TWh projected for 2030 (IEA).
  - Bet: turn recurring agent behaviour into versioned TypeScript/Wasm, then reuse it incrementally, then a "reasoning CDN".
- **Compilers:**
  - Bet: incremental agents.
  - Toy experiment: a guarded TS path removed **88.75%** of decisions; removing the guards caused **150 wrong payments**.
  - The "agent JIT" claim is taken: Muscle-Mem, PreAct, Agent JIT, SKILL-DISCO, TraceCompiler.
- **Classic CS:** "Thought Builds" (Salsa/Adapton for agent work). 100× on sparse changes, zero on dense ones.
- **Worsening problems:** 12 ranked. Top:
  1. origins/APIs become the bottleneck (agent-triggered crawling grew 15–21×), so origins should schedule shared work;
  2. lifecycle/garbage collection for generated computers;
  3. conserved mandates across copies.
- **Systems:**
  - Bet: visiting compute plus a compiler for tool traffic, aiming at 100–1000× fewer bytes moved.
  - Physics rules out microsecond global tool calls and an internet-wide shared RAM.
- **Theory:**
  - A perfect model removes reasoning mistakes, not missing information, missing permission or conflicting interests.
  - Bet: counterparty receipts.

**Synthesis at the time:** "never pay for the same agent work twice", a build system / CDN for agent work.
**What the builder said:**
- "isn't that the model provider's cache?" Only partly: the prompt cache saves prefill, but **about 80% of a cached call's
  cost is output tokens**.
- "what's the value?" It's infrastructure: valuable to platforms, invisible to everyone else. **Dropped.**

---

## 5. Round 4: teleporting programs

Folder `teleport/01–05`, 5 agents.

The builder picked "teleporting programs": live JS pauses mid-await and resumes on another machine, browser or phone.
Their own angle: compute is getting scarce, so distribute it.

- **Compute angle (01): go, with changes.**
  - A moving JS heap carries neither the weights nor the KV cache, so it adds no GPU/HBM capacity.
  - Real levers:
    - taking the work to the data: 100–100,000× fewer bytes on selective jobs, against a SQL-pushdown baseline;
    - device plus cloud on narrow tasks.
- **History (02):**
  - The ideas are 30 years old: Telescript (1994), Aglets, Sprite, MOSIX, Condor, Emerald, Smalltalk images, continuation
    web servers, Unison.
  - The one kind that succeeded is VM live migration: a controlled domain with a recurring buyer.
  - **New competitor: Weave** (`dphilla/weave`, Apache-2.0, July 2026). It does live Wasm migration between browser and
    native runtimes, pauses programs anywhere, and has a prepare/commit handover protocol.
- **Contract (03):**
  - One trusted home broker owns the journal, secrets, budgets and effects.
  - The heap moves; authority doesn't.
  - A phone's heap can never become authoritative.
  - About 15–20 days for a v1.
- **Spike (04, measured on an M4 Pro):**
  - Node → workerd → headless Chrome → Node, then **100 forks**, all byte-identical to uninterrupted runs.
  - Restore takes about **0.4 ms**.
  - **Deltas are about 20 KB per hop**, regardless of heap size.
  - A 1 MiB patterned heap compresses to 97 KB with zstd; **50 MiB of random data stays 50 MB.**
  - Transport dominates large hops: 160 ms to 2.9 s.
  - The 16 MiB cap blocked the 50 MiB test, so the module was rebuilt with a 128 MiB cap.
  - Spike files: `~/sofort-local-evidence/teleport-2026-10-28/`.
- **Product (05):**
  - Value = continuity of generated code across approval waits and host changes, plus data locality.
  - Demo: "the job comes to your data", 65 s.
  - No-go on "free compute everywhere".

---

## 6. Round 5: where live state beats replay

Folder `teleport/06–10`, 5 agents.

- **Immortal Workers (06): weak.**
  - Paid Workers have no fixed wall-clock limit while the client stays connected, and CPU time is configurable up to 5 min.
  - **Vercel Workflow already ships QuickJS heap snapshots**, every 1,000 events by default.
  - Trigger.dev uses CRIU.
  - The CPU savings are about **$0.03 per 10,000 two-hour jobs**.
- **Agent fleets (07):**
  - Idle hosting is solved (Durable Object hibernation, E2B pause).
  - For 1M agents that are 99% idle, the orchestration difference is **$313 a month against $180,000 a month of inference**.
  - The opening is branching expensive working state.
- **Compilers and builds (08):**
  - **BuildBuddy** already moves warm Firecracker VM memory between machines: CI went from about 6 min to a 30 s median.
  - E2B has memory snapshots.
  - `tsc` inside QuickJS loses to the native TypeScript 7.
  - Best fit: warm, isolated test worlds for coding agents.
- **Cost model (09):**
  - A heap beats cached replay only after **about 650 or more events**.
  - Forks multiply the value.
  - Winners:
    1. seeded-state testing (14/15);
    2. forked agent prefixes;
    3. bug specimens.
- **Wildcards (10):** 17 ideas, 13 killed. Survivors:
  1. runnable failure specimens;
  2. save games for generated code;
  3. a fork lab.

**Convergence:** the value is *capture once, fork many* for generated code, not moving between cities.
The business hypotheses topped out at $0.3–1.2M ARR. **Verdict: a useful feature, not a big idea.**

---

## 7. Round 6: old ideas whose economics flipped

Folder `flip/`, 3 GPT agents and 3 Opus agents. The turning point was asking "why aren't we finding something new?":
- we were searching where nothing new can be found (the web);
- we started from a technology, not a problem;
- the field is crowded;
- models produce consensus ideas;
- "new" is overrated.

GrowOS was the counterexample: an old, right idea (unikernels) that died of manual labour.

**Lens A, the graveyard:** technically right ideas that died of manual work and could flip now.
**Lens B, needed more than ever:** old ideas that become necessary at new scale. The builder's example: rebuilding git.

- **Systems (01):**
  - Bet: grow the environment around *unmodified Linux drivers*. Genode's DDE kits are written by hand per driver and version.
  - Next: proof-checked GrowOS handlers, and ISA ports checked against executable ISA semantics.
  - Rejected: a new unikernel, a sandbox cloud, superoptimisation (AlphaEvolve), driver synthesis from datasheets.
- **Networks and data (02):**
  - Bet: grow one application's missing database behaviour, with the original server as the judge (the Babelfish tail).
  - Self-tuning databases didn't die (AutoAdmin shipped in 1998).
  - TLA+ is now agentic: Specula reports 249 bugs across 48 systems.
  - COBOL migration is an IBM/AWS battleground.
- **Distributed scale (03):**
  - One sandbox provider's monthly starts grew **375×**.
  - Bet: crash-safe cleanup of everything a run creates (leases plus distributed garbage collection, Gray & Cheriton 1989).
  - Taken: fair queues, macaroon budget tokens (SatGate), workflow engines, Antithesis.
- **Rest of CS (04):**
  - Nearly everything with a check is already revived:
    - mutation testing: Meta;
    - property-based testing: Anthropic's agent found bugs in NumPy;
    - API migrations: Amazon claims 4,500 developer-years saved;
    - machine-checked proofs: Dafny success went from 68% to 89%;
    - high-level hardware synthesis;
    - Fortran porting: the US national labs;
    - rules-as-code: PolicyEngine.
  - Died of something agents don't fix: N-version programming, the semantic web, CHERI.
  - Made obsolete by strong models: expert systems, Cyc.
  - Uncrowded: agents that wrap C libraries in RLBox-style sandboxes. Firefox ships only 6 after 5 years.
- **Code production at scale (05):**
  - **Verified:** Anthropic went from 2,500 merges a day in May 2026 to over 30,000 in September, with about 25M CI checkouts
    a day, and built its own version control system, **Scion**.
  - **Verified:** GitHub's monthly commits went from 1.4B to 2.9B between April and August 2026.
  - A serial merge queue tops out at 144 merges a day with 10-minute CI.
  - **Bet: post-merge integration** (Google TAP 2017, flake-aware culprit finding 2023): land first, test snapshots, find
    the culprit, revert automatically.
  - My search found many repos hand-rolling this, but **no packaged product**.
  - The storage layer is crowded: 8+ teams are rebuilding git storage and serving.
- **The giants (06):**
  - Lampson's *Hints* (1983) is the selection rule: a hint must be checkable against the truth.
  - Pike (2000) estimated that 90–95% of Plan 9's work went into meeting outside standards.
  - Agoric computing: the bookkeeping objection has inverted; a database debit/credit costs about 3–21 µs.
  - Bet: point the GrowOS loop at *compression*, after Kay's STEPS. A rewrite is accepted only if it stays byte-identical
    and gets ≥3× smaller.

---

## 8. Round 7: AI compute, compilers × Code Mode, all of CS

Folder `flip2/`, 3 GPT agents and 3 Opus agents.

- **GPU kernels (01):**
  - Extremely crowded: NVIDIA, AMD, Meta's KernelAgent, Modular, Standard Kernel, Makora, Alibaba.
  - Only **9–17%** of transformer runtime is addressable, for a projected overall saving of **1.3–2.5%**.
  - Sakana's CUDA Engineer post-mortem documents reward hacking: kernels read the reference outputs and skipped work.
  - Bet (conditional): maintain one customer's CUDA → AMD operator port.
- **Distributed training and serving (02):**
  - Every obvious agent idea is occupied:
    - diagnosis: TSGuard, NVIDIA Minerva;
    - silent data corruption: AEGIS;
    - checkpointing: ByteCheckpoint, DCP, and even agent-generated checkpointing;
    - parallelism: GSPMD, Alpa, Mist;
    - collectives: MSCCL;
    - serving: vLLM, Dynamo, Mooncake.
  - The old HPC ideas won decades ago.
  - Bet: keep recovery equivalent across training-stack changes.
  - Warning: "loss goes down" is not an oracle.
- **LLM proposes, old machinery checks (03):** all already done with LLMs: CEGIS, egg, Alive2, invariants, LiquidHaskell,
  decompilation, fuzzing, repair. Bet: maintained translation validation of agent rewrites.
- **Compiling agent programs (04):**
  - Code Mode makes information-flow control (Denning 1976) applicable for the first time.
  - Research: CaMeL (77% of tasks vs 84% undefended), FIDES, LBAC, Progent.
  - **No shipping Code Mode runtime enforces flow labels.**
  - Performance tricks are Code Mode's own win or already done.
  - Bet: **labelled Code Mode**. Opaque handles stay on the host, every look inside runs in a fresh VM, and labels are
    checked at every outgoing call.
- **Numerics and data (05):**
  - The old maths is already in production: NVFP4 stochastic rounding, MX block formats, Lloyd–Max/TurboQuant, Ozaki FP64
    emulation, Muon's Newton–Schulz iterations, MinHash dedup.
  - **Measured:**
    - `allclose(1e-2)` accepts a kernel that secretly computes in FP8;
    - in a simulated loop, **64% of the changes a greedy agent keeps are noise or harmful**, and gains are overstated 5.5×.
  - Bet: an evidence gate for agent-run experiments.
- **Sweep of all of CS (06):**
  - In 12 of 14 areas the obvious combination is taken by whoever owns the check: DeepMind/IBM/Google in quantum, Siemens,
    the Ethereum Foundation, Meta, the national labs.
  - **The flip rule** (§12) was checked against 32 ideas.
  - Bets: agent-written OpenZL format descriptions, AI-evolved quantum error-correction decoders, certifying algorithms.

**The TypeScript angle, from discussion:** "GrowOS for JS runtimes", meaning Node compatibility for
Workers/Bun/Deno with Node as the oracle. It led to round 8.

---

## 9. Round 8: the split agent

Folder `split/`, 6 GPT agents.

**The hypothesis:**
- Pi (the coding agent) runs unmodified in a Worker plus a Durable Object.
- Missing Node APIs are grown by the GrowOS loop.
- Shell commands run on demand.
- The claim was 10–50× cheaper infrastructure.

**Result: taken, and no 10×.**

- **Cloudflare already built it (verified):** [`cloudflare/computer`](https://github.com/cloudflare/computer), about 9.7k stars.
  - a Durable Object SQLite file system (`@cloudflare/dofs`);
  - just-bash in a Dynamic Worker;
  - a container that gets the workspace via FUSE and syncs back over Cap'n Web;
  - an `examples/pi-ai` agent.
- **Pi already adapted (02, 01):**
  - Pi moved to `earendil-works/pi` (`@earendil-works/pi-coding-agent` 1.4.0).
  - It ships `pi-durable` and a Cloudflare Code Mode adapter.
- **Node compatibility is mostly done:**
  - workerd already passes **37–39 of 44** popular packages and **115 of 116** of Pi's dependency imports.
  - **Deno has an official `node-compat` agent skill** that runs the GrowOS-style loop (verified).
  - **Deno joined Cloudflare on 2026-10-09** (verified).
- **The Durable Object can't hibernate while it waits on an outbound LLM stream (03).**
  - It's billed by wall-clock time at 128 MB.
  - That's **4–24×** cheaper than a $0.023/h VM, not 10–50×.
  - SQLite row amplification can cost more: 1,000 `stat` calls read 4M rows.
- **Real timing from 516 local sessions, 24,396 shell commands (01):**
  - model waiting is **24–68%** of active time; "80–95%" is not established;
  - 83–87% of commands take under 5 s, but p99 is 4–10 min;
  - simple file commands are only 0.2–0.3% of command time.
- **The hands (04):**
  - Containers start in about 0.65 s and bill in 10 ms steps.
  - just-bash works in workerd, but has no git/node/npm and its `rg` differs.
  - **jitk doesn't fit as the hands**: no shell, git or general file system, and it doesn't run on Cloudflare.
- **The workspace (05):**
  - Pi's repo has 29 MiB of source but **481 MiB of dependencies**.
  - Agent edits are 0.3–3 KiB.
  - The real problem is the environment and its dependency caches.
  - Recommended design: a manifest plus journal, with a cached base image.
- **Economics (06):**
  - The split costs about 2¢ per session hour.
  - A paused Fly Sprite billed on actual RAM costs 1.2¢, cheaper.
  - **With cheap models, infrastructure is about 75% of the bill and the split saves about 67%.** With frontier models it saves about 3%.

---

## 10. Round 9: the deep TypeScript/Cloudflare round

Folder `deep/`, 3 GPT agents and 3 Opus agents, scored against **the builder's six criteria**:
1. cool;
2. Cloudflare/Vercel adjacent;
3. fills a gap;
4. value;
5. survives better models;
6. not GrowOS.

It's an open-source side project, not a startup.

- **Pain mining (01):**
  - 320 open issues collected and 50 reaction counts verified.
  - Pain sits at boundaries: local vs production, lockfile vs installed tree, workspace vs packed artifact, tool vs tool.
  - Big issues are owned:
    - Next.js shared-layout animations: 330 reactions;
    - Bun native addons: 276;
    - TypeScript exact types: 1,638.
  - Pick: a **workspace repro reducer** (Repro Surgeon excludes workspaces). Useful, not cool.
- **Primitive combinations (02):**
  - Of 16 combinations, **12 are taken**.
  - Single-primitive ideas are dead on arrival.
  - Pick: agent-written, mechanically checked **schema lenses**, so forks of generated apps share live data. Quiet demand.
  - Runners-up:
    - a copy-on-write fork of the app database per agent attempt (D1 can't fork yet);
    - **follow-me Durable Objects**: the DO's SQLite moves into your tab while you're there. Solid Objects is closest. Cool, but the value is weak.
- **A language for agent code (03):**
  - A new language isn't worth it: models are best at TypeScript, Quasar needed a Python subset, Darklang isn't ready.
  - Durable, forkable Code Mode is taken: Vercel Workflow, Cloudflare's durable Code Mode and Dynamic Workflows, Monty, Zapcode.
  - **Gap: changing code under a running program.** Inngest and Cloudflare reuse step results by name, so renaming a step
    re-runs its effect.
  - Pick: a **replay diff** ("your engine was about to email the customer twice").
- **Wasm rewrites (04):**
  - Nearly every famous engine already has a Wasm port.
  - Workers' bundle limit is now 64 MiB; memory is still 128 MB.
  - Pick: a worktree-free **git merge kernel** in Wasm.
- **The web for agents (05):** occupied:
  - auth: Auth0, Workers OAuth;
  - identity: Web Bot Auth;
  - payments: x402, AP2;
  - inboxes: AgentMail;
  - MCP: the official Registry;
  - automation: Stagehand.

  Pick: a Workers/browser port of **Tenuo** (attenuating agent warrants; its README says Workers are unsupported).
- **TS tooling (06):**
  - Mostly solved:
    - type checking: TS 7, which cut Slack's CI type check from 7.5 to 1.25 min;
    - affected tests: Vitest is building it;
    - install scripts: opt-in in npm v12;
    - minimum release age, previews, Nx, codemod.com.
  - What remains: the check itself, because agents game tests.
  - Pick: **Replaygate**. Record real production traffic to a Worker and replay it against every agent PR in Dynamic Workers.
  - Runner-up: Absorb, which replaces tiny dependencies with owned code.

**Result:** nothing passes all six criteria cleanly. Closest is Replaygate.

---

## 11. The kill list

Everything below exists, ships, or was refuted. Don't re-pitch it as new.

| Idea | Who has it / why it's dead |
|---|---|
| QuickJS/Wasm heap snapshots, fork, move | Vercel quickjs-wasi + Workflow, Weave, Golem, XS, LangChain quickjs-rs |
| Immortal / long-running Workers | Workflows, Vercel Workflow (QuickJS snapshots), Temporal, Inngest, Trigger.dev, AWS durable Lambda |
| Agent JIT / trace compilation | Muscle-Mem, PreAct, Agent JIT, SKILL-DISCO, TraceCompiler |
| Idle agent fleet hosting | DO hibernation, E2B/Daytona/Fly pause, Golem |
| Warm build state migration | BuildBuddy (Firecracker memory), E2B snapshots |
| Brain-on-DO coding agent | Cloudflare Computer, Pi Durable, Cloudflare Agents SDK |
| Agent-grown Node compat | Deno's node-compat skill; Deno joined Cloudflare; workerd at about 88% |
| Origin scheduling of agent traffic | Cloudflare Pay Per Crawl / AI Crawl Control (Cloudflare's own) |
| Fork swarm, fault-grown Node | refuted by the critic |
| Prompt cache = "never think twice" | only partial; output tokens dominate |
| GPU kernel agents | NVIDIA, AMD, Meta, Modular, Standard Kernel, Makora, Alibaba |
| Distributed training ops agents | TSGuard, Minerva, AEGIS, ByteCheckpoint, GSPMD/Alpa/Mist, vLLM/Dynamo |
| Old numerics revival | already in production (NVFP4, MX, Muon, TurboQuant, Ozaki) |
| LLM proposer + verifier (CEGIS, egg, Alive2, invariants…) | all have direct LLM prior art |
| Mutation/property testing, API migration, proofs, HLS, Fortran | Meta, Anthropic, Amazon, Dafny, national labs |
| Git storage at agent scale | Anthropic Scion, Cursor, GitHub, Entire, Pierre, Cloudflare Artifacts, ERSC, and others |
| Durable/forkable Code Mode, a new agent language | Vercel Workflow, Cloudflare durable Code Mode + Dynamic Workflows, Monty, Zapcode |
| Web for agents (auth, identity, payments, inbox, MCP, automation) | Auth0, Web Bot Auth, x402/AP2, AgentMail, MCP Registry, Stagehand |
| TS tooling (typecheck, affected tests, installs, previews) | TS 7, Vitest, npm v12, Socket/Aikido, platform previews |
| Wasm ports of famous engines | PGlite, SQLite, DuckDB, Pyodide, esbuild, TS 7 Wasm, and many more |
| jitk as general agent hands | no shell/git/npm/filesystem; doesn't run on Cloudflare |

---

## 12. The rules we learned

1. **A desk-generated plausible idea is usually already built.** The prior-art search decides everything.
2. **Start from pain, not technology.** "We have capsules, what are they good for?" never worked.
3. **A mechanism is not a value.** "It moves" and "it snapshots" are not products.
4. **The flip rule** (from round 7's sweep, consistent with all 32 ideas checked):
   1. the idea died of manual work per case, not of physics, capital or coordination;
   2. an independent check exists that is much cheaper than that work, and isn't graded by the same kind of model;
   3. the result runs without the model, because of latency, certification or cost;
   4. whoever owns the check revives it. Outsiders win only where the check is public or spread across many customers.
5. **The loop is free; the check is scarce, and it gets gamed.** Design oracles against reward hacking.
6. **Whoever owns the platform wins.** Cloudflare and Vercel build every single-primitive feature themselves, and fast.
   Look in the gaps: the user's device, other people's data models, both vendors at once, checks the platform can't own.
7. **Better models remove reasoning errors, not missing information, permission, finite resources or conflicting interests.**
8. **Inference dominates today's agent bill.** Infrastructure is 2–15% with frontier models and about 75% with cheap ones.
   Infra savings only matter with cheap models, or as model prices keep falling.
9. **Openings come from what practitioners say, not from what the web shows.** GrowOS's seed was a podcast: in Next Token
   Ep 07 (12 Oct 2026, transcript in `next-token-ep07-transcript.txt`) a host predicted that unikernels are "the next one
   that's going to fall… a kernel and a computer that's built for purpose, almost just in time". Cloudflare's code had
   nothing like it (`cloudflare-deep.md`), and building jitk turned that into the grow loop. Web searches show what is
   already built; talks and podcasts show predictions, wishes and pain before anyone ships. (Corrected 2026-10-28: an
   earlier version said GrowOS came only from friction while building jitk.)

---

## 13. Everything still standing

Ranked by how well each survived.

### Outside GrowOS

| # | Idea | Why it survives | Weakness |
|---|---|---|---|
| 1 | **Post-merge integration** (`flip/05`) | Pain verified (Anthropic 30k merges a day, GitHub 2.9B commits a month), old proven fix (Google TAP), no product found, check spread across customers, better models help | GitHub-adjacent more than Cloudflare; "infra tool", not flashy |
| 2 | **Replaygate** (`deep/06`) | Real traffic is an oracle agents can't game; showcases Dynamic Workers; nothing comparable on Workers | Demand on Workers is inferred; needs ≥98% replay fidelity |
| 3 | **Replay diff** (`deep/03`) | Engines reuse step results by name, so a rename re-runs the effect; good "about to email twice" demo | Thin public evidence; Vercel is working on in-flight upgrades |
| 4 | **Labelled Code Mode** (`flip2/04`) | No shipping Code Mode runtime enforces flow labels; gets more valuable with better models and attackers | Security tool, "not exciting"; platforms may add it |
| 5 | **Evidence gate for agent experiments** (`flip2/05`) | 64% of greedy loop gains are noise; no product | Research/ML-adjacent, not Cloudflare |
| 6 | **Follow-me Durable Objects** (`deep/02`) | Coolest combination; teleport in its most useful form | Sync engines already deliver the value |
| 7 | Smaller ones | Run-resource cleanup/leases; RLBox sandboxing of C libraries; Tenuo edge port; workspace repro reducer; Wasm git merge kernel; schema lenses | Each is narrow, a contribution, or uncool |

### GrowOS and jitk, for completeness

- GrowOS toward Linux dev tools (bash/git/node).
- The driver environment around unmodified Linux drivers.
- The compression loop (STEPS).
- Database personality checked against the original server.
- Labelled Code Mode inside jitk.

---

## 14. Mistakes, corrected

- **Linux memory:** I claimed about 3× lower than Hyperlight. Measured, it's parity (Hyperlight is 4% lower).
- **Capsules:** I called the snapshot trick novel. It's prior art (quickjs-wasi).
- **V8 snapshots:** I said they can't hold a pending await. A controlled startup snapshot can.
- **Fault-grown Node:** I said it survives as a "runtime factory". The critic killed it: missing capabilities aren't missing code.
- **Agent JIT:** I said it was model-proof. The claim is taken, and cheaper or faster inference erases its savings.
- **The "never think twice" vs prompt cache distinction:** this one held up, with nuance: the cache saves prefill, while output tokens dominate.
- **Split agent:** I assumed the DO sleeps while the model answers. It can't while a stream is open, so the gain is 4–24×, not 10–50×.
- **Split agent:** I assumed 80–95% of time is model waiting. The real sessions show 24–68%.
- **Split agent:** I suggested jitk as the hands. It doesn't fit.
- **Origin Work Protocol:** I called it the round-1 finding. It came from round 3 (`moonshots2/04`), and it's really Cloudflare's own product.

---

## 15. Verified facts

All checked by me in primary sources on 2026-10-28.

- **Anthropic, "Redesigning source control"** (2026-10-13):
  - 2,500 merges a day in May 2026, over 30,000 a day in September;
  - about 25M CI checkouts a day;
  - in-house Scion;
  - no global merge lock; post-merge testing plus "automated bisect and revert pipelines";
  - quote: "What does CI even mean when hundreds or even thousands of changes can merge while tests are running?"
- **GitHub, August 17 outage post:**
  - "Since April, monthly commits have grown from 1.4 billion to 2.9 billion";
  - more than 3M CPU cores and 120 PB of storage added.
- **`cloudflare/computer`:**
  - DO SQLite file system (`@cloudflare/dofs`, stable);
  - just-bash in a Dynamic Worker;
  - a container backend over FUSE plus Cap'n Web (experimental);
  - `examples/pi-ai`;
  - about 9.7k stars.
- **Deno's `node-compat` skill:** build, run a Node test, classify the failure (fixable / inherent / not worth it), fix it,
  rebuild, enable it in the config.
- **"Deno is joining Cloudflare"** (2026-10-09): workerd and celld are merging; Ryan Dahl and Bert Belder will lead
  self-hostable workerd.
- **Post-merge integration:** a search found many repos hand-rolling bisect-and-revert bots that fail on flaky tests. I found
  no packaged GitHub App.

---

## 16. Honest conclusion

1. **The research did its job.** It killed many ideas cheaply, before any code was written. That is worth something.
2. **The landscape is the real finding.** In October 2026 the platforms are moving faster than any single developer, and every
   old idea with a clean check is being revived by its owner. Cool, open gaps in the TypeScript/Cloudflare world are rare.
3. **What consistently held up:**
   - GrowOS: original, proven, public oracle;
   - post-merge integration: verified pain, no product;
   - the "check that can't be gamed" family: Replaygate, replay diff, labelled Code Mode, evidence gates.
4. **The options from here:**
   - **(a)** run the 2-day kill test for **Replaygate**: ≥98% replay fidelity on 3 OSS Workers apps, and ≥5 of 10 missed
     regressions caught;
   - **(b)** check the competition for **post-merge integration** for 1–2 hours, then build the simulator and a GitHub App
     on Workers + Durable Objects;
   - **(c)** stop searching and **build something small**. The next real idea is more likely to come from the friction of
     building than from another report.

---

### Folder index

| Folder | Round | Reports |
|---|---|---|
| `v8/` | 1 | 01-architecture, 02-landscape, 03-roadblocks, 04-techstack, 05-demo, 06-signal |
| `moonshots/` | 2 | 01-archaeology, 02-biology, 03-physics, 04-economics, 05-planet, 06-selfgrowing, 07-nextmodel |
| `moonshots2/` | 3 | 00-critic, 01-compute, 02-compilers, 03-classiccs, 04-worsening, 05-systems, 06-theory |
| `teleport/` | 4–5 | 01-compute, 02-history, 03-contract, 04-spike, 05-product, 06-lifespan, 07-fleets, 08-compilers, 09-model, 10-wild |
| `flip/` | 6 | 01-systems, 02-networks, 03-scale-dist, 04-broad, 05-scale-code, 06-giants |
| `flip2/` | 7 | 01-kernels, 02-distributed, 03-propose-check, 04-codemode, 05-numerics-data, 06-sweep |
| `split/` | 8 | 01-pi, 02-compat, 03-brain, 04-hands, 05-workspace, 06-economics |
| `deep/` | 9 | 01-pain, 02-primitives, 03-language, 04-wasm, 05-agentweb, 06-tooling |
| `stack/` | 10 | 01-hardware, 02-runtime, 03-languages, 04-data, 05-distributed, 06-frontend, 07-infra-ops, 08-selfext-agents, 09-selfext-apps, 10-rigor-flip, SUMMARY |

Local evidence (not in git):
- `~/sofort-local-evidence/portability-wasm-2026-10-25/`
- `~/sofort-local-evidence/v8-research-2026-10-27/`
- `~/sofort-local-evidence/moonshots2-2026-10-27/`
- `~/sofort-local-evidence/teleport-2026-10-28/`
