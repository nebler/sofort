# Sofort: findings, positioning and demo pitches

Compiled 2026-10-25. This file collects everything from the research rounds:
- 5 GPT-6.1 research agents
- 4 demo agents
- 4 primitive agents
- 3 portability agents, still running when this was written

It also records the decisions from the discussion that followed.

Source reports:
- `arch/research/pitch/01–09`
- `arch/research/primitive/01–04`
- `arch/research/portability/01–03`
- **The perf work round (8 agents, commits `70f6d8c..ad61c72`): `arch/research/perf/SUMMARY.md`, plus `arch/architecture/ARCHITECTURE.md`. Section 0.1 summarizes it and supersedes older numbers where they conflict.**

Labels used below:
- **[built]**: exists and is measured today.
- **[planned]**: designed but not built.
- **[est]**: my estimate, not measured.

---

## 0. TL;DR

1. **What Sofort is today [built]:** a fresh, hardware-isolated microVM for each agent-written program.
   - The VM runs on jitk, a tiny Rust kernel with 24 syscall slots.
   - The guest's *only* I/O is one tool channel to a trusted host.
   - It is real and fast, but as a "fast sandbox" it sits in a crowded market: Cloudflare Dynamic Workers, Vercel, AWS Lambda MicroVMs, Hyperlight, E2B and Daytona.
2. **The idea that changes the story [planned]:** all I/O goes through one channel, so a program blocked on a tool call has no host state to untangle.
   - That means the whole computer could be paused to a file of about 1 MiB.
   - The file can then be forked, moved to another machine, replayed exactly, and resumed mid-function.
   - **Pitch: "Computers small enough to pause, fork and ship like a file."**
3. **What is new:** none of the individual pieces. E2B, Golem, Modal, Daytona and Cloudflare Code Mode each do part of it. The new part is the *combination*:
   - hardware isolation;
   - a complete effects boundary;
   - native static binaries;
   - MB-scale continuations.
4. **Product priorities:**
   - Own **L0** (the machine) and **L1** (pause, resume, fork, replay) as an open-source runtime.
   - Keep the capability layer thin and adopt existing designs for it (Cap'n Web, Cloudflare OS gatekeepers).
   - Don't build a Durable Objects-style platform.
5. **Build order:**
   1. Deterministic replay spike.
   2. Memory: largely done (section 0.1). Next is porting the real kernel onto the shard ABI, projected at about 0.55–0.65 MiB per small run.
   3. Pause and resume at a tool call.
   4. Effects journal plus fork.
   5. Portability backends.
6. **Flagship demo: "Pull the plug."**
   - 10,000 sleeping agents run on a Raspberry Pi, or another cheap box.
   - The public wakes them from a web page.
   - On camera, the box is unplugged, and the agents continue mid-line on another machine.
7. **Demo possible today:** "A million computers for a nickel," a live counter of fresh VMs. It needs a Linux bare-metal benchmark first.
8. **New, from the Wasm portability report:** a QuickJS-in-Wasm computer parked on a tool call was snapshotted and resumed in Node, a Chromium tab, workerd and a Dynamic Worker. All runs were local.
   - About 100 KB gzipped, about 0.35 MiB of RAM per instance.
   - Forks gave correct divergent answers.
   - **Pause, fork and move work today on a portable, software-isolated tier.** jitk remains the hardware tier.
9. **Portability conclusion: three tiers, one programming model** (section 8.0).
   - **Wasm runs everywhere**, days to weeks of work.
   - **jitk runs where virtualization is exposed:**
     - ARM today;
     - Pi with 3–5 days of GICv2 work;
     - x86 clouds and $5 nested-KVM VPSes after a 31–50-day x86 port.
   - **A user-mode native backend is possible but costly** (5–9 engineer-months). Defer it.

---

## 0.1 Update: performance and memory round (2026-10-25, measured)
Sources:
- `arch/research/perf/SUMMARY.md`, which merges reports a1, a2, a4, a5, w0, w2 and w3;
- `arch/research/perf/linux-ledger/RESULTS.md`;
- `arch/jitk/shard/RESULTS.md`;
- `arch/architecture/ARCHITECTURE.md`.

Environment: the Mac was heavily loaded (load 14–47), and the Linux runs were in nested HVF → KVM. **Memory numbers are valid. Timings are indicative only. There are no metal numbers yet.**

### Memory per VM: measured marginal cost (Linux/KVM, N = 1/16/64/256, cgroup `memory.current` slope)

| System | MiB/VM | Notes |
|---|---:|---|
| jitk today, Linux | 9.87 | |
| **jitk today, Linux, glibc malloc huge pages off** | **3.88** | **Applied** in `executor/backend.ts` (commit `ad61c72`), −5.99 MiB/VM |
| jitk today, macOS/HVF | 7.87 at READY | macOS **caps at about 61 concurrent VMs** on this host (HVF address-space limit). **macOS is a dev backend only; scale is Linux.** |
| Firecracker, tiny Linux guest, booted | 8.80 | 222 ms cold (nested) |
| **Firecracker, tiny Linux guest, snapshot-restored** | **1.43** | 27.6 ms cold (nested) |
| Hyperlight (QuickJS-NG), process per VM | 7.35 | |
| **Hyperlight, shared snapshot in one process** | **0.37** | |
| Bare KVM floor, many VMs per process | 0.22 | |
| **jitk shard spike: empty test guest, all-in including kernel charges** | **0.13–0.16** | 4,096 VMs, 4 threads |

**Projected small run on the new shard design** (estimate from parts measured separately):

| Run | Projection |
|---|---|
| return 2 / one tool / `Promise.all(10)` | **about 0.55–0.65 MiB** (the 2 MiB target is beaten) |
| 64 KiB JSON | about 1.2–1.3 MiB |
| 1 MiB JSON | about 9.5 MiB, so it needs a larger class or blob handles |

**Gates:**

| Gate | Result |
|---|---|
| Empty VM ≤0.5–1 MiB | **PASS** |
| QuickJS dirty pages, small runs | **PASS** |
| Reset correctness (44,000 runs, 0 leaks) | **PASS** |
| Reset latency | not yet: about 140 µs at p50, but nested p99 is above 1 ms |
| WAIT (1,024 VMs, 33,792 calls, 4 threads, zero lost or duplicate wakeups) | **PASS** |

### CPU and latency
- **Today every run still pays for a whole VM process:** about 8–13 ms of VM CPU plus 2.3–2.8 ms of Node CPU, contended.
- **RUN → DONE alone:** 316 µs for `return 2`, 470 µs for one tool.
- **One tool call today:** 8 VM exits and 6 encodes / 19 parses. ABI-v2 targets 1 WAIT exit and 2 encodes / 2 decodes.
- **QuickJS restore:** fork-restore takes 0.39 ms against 1.38 ms for a fresh init (nested).
- **Reset cost scales with the pages a run dirtied:** about 140 µs at ≤4 KiB, up to 2.8 ms at 1 MiB. The small private delta is also the latency lever.
- **Architecture targets** (ARCHITECTURE §5): execute → result ≤1 ms p50 (≤250 µs stretch); ≤2 CPU-ms per tiny run; ≤30 µs per extra tool call.
- **Capacity math on targets** (64 GiB, 64-core host): about 28,600 concurrent runs at 2 MiB peak, and about 39,000 runs/s at 1 CPU-ms.

### What this changes in this document
1. **Memory is close to solved on paper.** The "about 1 MiB per VM" assumption is now conservative: a measured 0.13–0.16 MiB shell plus a projected 0.55–0.65 MiB small run. It still needs the real kernel ported onto the shard ABI.
2. **Competitor numbers in the older sections are wrong where they use Hyperlight's 1.8 MiB.** That was a parked *process* footprint. With a shared snapshot, Hyperlight is **0.37 MiB/VM**.
   - **JS-only density is parity with Hyperlight, not a moat.** The Wasm tier (0.32–0.38 MiB) is also parity.
3. **Comparing against configured sandbox RAM (E2B's 4 GiB, a "512 MiB Linux microVM") is invalid as a physical density claim.**
   - A snapshot-restored tiny Firecracker Linux guest costs **1.43 MiB marginal**.
   - Configured RAM is only fair as a *billing* comparison ("what you are charged for"), and must be labeled that way.
4. **Differentiation shifts** (SUMMARY §4) to:
   - **unmodified native Linux tools** (jq, rg, sqlite; the part Hyperlight can't do);
   - **thread-free WAIT** (thousands of waiting runs without threads);
   - **tool-backed files and capabilities**;
   - **the offline-grown kernel**;
   - **pause, fork and move at the tool boundary.**
5. **Pitch correction** (ARCHITECTURE §8): not "a kernel generated per task", but **"a computer per task, assembled in microseconds from shared, pre-initialized parts that grow offline. The per-task part is policy, capabilities and a few hundred KiB of private pages."**
6. **The 10,000-agent demos must run on Linux.** macOS caps at about 61 concurrent VMs. The planned metal box is the **M1 Air with Asahi**, which is also the natural fallback for the Pi in "Pull the plug".
7. **Next steps (SUMMARY §5):**
   1. Port the real jitk kernel onto the shard ABI and snapshot after READY, to get the first real all-in MiB/VM and restore numbers.
   2. Run gates 2–5 on the M1 Air (Asahi).
   3. ABI-v2 byte ingress (saves about 370 KiB on 8 KiB sources).
   4. Re-measure the `w1-executor-prep` branch quietly.
   5. A native tools census (jq, rg, sqlite).

---

## 0.2 Round 6: shard port + native tools census (2026-10-25, measured, nested KVM)
Reports:
- `arch/jitk/shard/RESULTS-R6.md` (with `ABI-R6.md`);
- `arch/research/native-census/RESULTS.md`.

Brief: `arch/work/R6-BRIEF.md`. Nothing is committed yet.

### Shard port: the real kernel + QuickJS on the device-free KVM shard
- **What was built:**
  - a new `transport-ring` kernel build (`dist/kernel-ring.bin`): rings + MMIO doorbell (SUBMIT/WAIT/FINISH), kernel-side reply demux, no virtio/GIC/timer/WFI;
  - the AArch64 code it touched, moved behind `kernel/src/arch/aarch64/`;
  - `shard/src/bin/real.rs`, which boots once to a CHECKPOINT before tenant input, snapshots RAM + 257 registers, and restores each slot copy-on-write.
- **The default kernel image is byte-identical** (SHA-256 `6c00a278…`).
- **Measured all-in memory (cgroup slope, the same method as the Linux ledger):**

  | State | MiB/VM |
  |---|---:|
  | READY | **0.232** |
  | return2 | **0.484** |
  | one tool | **0.503** |
  | `Promise.all(10)` | **0.549** |
  | 64 KiB structured JSON | 1.422 |

  - This **confirms the 0.55–0.65 projection with the real guest**, in the same range as Hyperlight's 0.37.
  - 1,024 READY VMs used 238 MiB, on one thread, with no measured idle CPU.
- **Correctness:**
  - 10,000/10,000 restore cycles with zero canary leaks, and fresh generation and entropy every run.
  - WAIT held 1,024 parked guests on 1 thread, all correct.
- **Gaps and failures:**
  - **QuickJS `Math.random` repeats after restore** (1 distinct value across 10,000 runs). It needs an embedder reseed hook. **This blocks gate 4.**
  - **Nested latency and CPU are far off target:**
    - reset p50 2.5–5 ms (p99 2.8–6 ms);
    - RUN → DONE 31–55 ms;
    - 34–61 CPU-ms per run;
    - about 385–440 hardware exits per run, mostly first-touch page faults.

    This looks like a nested-virtualization artifact; metal (the M1 Air with Asahi) must confirm it. Reducing first-touch faults is the lever.
  - Not built yet: watchdog leases, Node policy IPC, the writable-arena bound, and an exact tool round-trip measurement.
- **Mac `make test`:** all suites pass **except the nested Linux suite**. It times out (QEMU, 1,800 s). **The lead re-ran it on a quiet machine and it timed out again**, with the byte-identical default kernel. So the problem is independent of R6's changes. One untested hypothesis is that it conflicts with the concurrently running `kvm-dev` nested VM.

### Native tools census: 29 tools, 32 artifact/workload rows
- **9 of 15 runnable profiles pass on today's jitk unchanged:** musl jq, Lua, MicroPython, and BusyBox sed/awk/grep/sort/wc/tar-list.
- **Blockers by class:**

  | Blocker | Tools / need |
  |---|---|
  | **Easy** | SQLite (immutable, read-only) needs only `fstat` + `pread64`; the official glibc jq fails at `mprotect` |
  | **Medium** | ripgrep and sd need a wider ELF loader, real signal registration, and `mprotect` guard pages (a loader change alone isn't enough); xz needs a self-pipe, fcntl and signals |
  | **Byte protocol** | gzip and zstd produce output but hit the ASCII-only protocol, so they need native byte streams |
  | **Hard** (Linux tier) | Every Go tool (gojq, yq, miller, dasel, gron, esbuild), fd, qsv, pandoc: threads even with `GOMAXPROCS=1`, plus futex, epoll and signals. DuckDB and FFmpeg builds: dynamic loaders and threads. git (fork/exec), curl (network). |

- **Recommended growth order:** **jq → immutable SQLite → constrained ripgrep (`-j1 --no-mmap`)**, plus native byte streams and exit status as an ABI feature. BusyBox, Lua and MicroPython ship alongside.
- **The grow loop needs work** before it can grow SQLite or rg:
  - today it is fixed to ppoll and the signal syscalls;
  - acceptance must use semantic and mutation cases, not missing-name discovery.

### What this means
- **Memory: proven with the real guest** (about 0.5 MiB per small run).
- **Native-tool differentiator: real but narrower than hoped.**
  - C/musl tools (jq, SQLite, BusyBox, Lua, MicroPython, compression) are close.
  - Rust tools need signals and `mprotect`.
  - **Go tools need threads.** That is the biggest strategic decision ahead: either add single-vCPU cooperative threading (clone/futex/epoll) or route Go tools to a Linux tier.
- **Latency: unproven until metal.** The M1 Air with Asahi is now the critical path.

---

## 1. What exists today [built]

| Component | Facts |
|---|---|
| Kernel | jitk: no_std Rust, about 1.7k LOC, **aarch64 only**, 24 syscall slots (including aliases and ENOSYS stubs). Runs unmodified static QuickJS and Lua at EL0. |
| VMM | libkrun: HVF on macOS, KVM on Linux. Includes a sandbox and a native watchdog that kills a VM about 1–2 ms after its deadline. |
| I/O | One JSON-lines tool channel to a trusted TypeScript executor. The executor implements Cloudflare codemode's `Executor` and TanStack's `IsolateDriver`. |
| MCP | MCP server with an `execute` tool. 26/26 checks pass. MCP stdio adds about 0.4–0.5 ms. |
| Resource FS | Read-only packed archive, 9 syscalls, byte-identical to Linux in 30/30 VMs. |
| Growth loop | Offline loop: ENOSYS → Linux strace oracle → agent writes the handler → differential test against Linux in fresh VMs → versioned manifest. |
| Security | Hostile-guest suites all contained: protocol 570, VMM escape 12, policy 32, console abuse 540, faults 390. |

### Measurements (macOS, quiet machine)

| What | Value | Honesty note |
|---|---|---|
| Cold `return 2`, raw | 5.9 ms | |
| Cold `execute()` through the executor | about 9–10 ms | Use this as the public "cold" number |
| Warm one-tool call through MCP | about 2.1 ms | Use this as the public "warm" number |
| Parked one-tool call, raw | 0.29 ms | **Raw parked path only. Never call it "cold" or "boot".** |
| `Promise.all` of 10 tools at 5 ms each | 6.5 ms (Hyperlight: 63 ms) | Compared with Hyperlight-JS's *synchronous* bridge. Whole-stack comparison; the engines differ (Bellard QuickJS vs quickjs-ng). |
| CPU per VM | 4.8 CPU-ms | Under the 5 CPU-ms kill line, on macOS only |
| Memory per VM | 10.7 MiB footprint (Hyperlight process: 1.8) | **Superseded by 0.1:** Linux marginal 9.87, now **3.88 MiB** with the malloc fix. Hyperlight's shared snapshot is **0.37**. The shard spike is 0.13–0.16 for an empty VM. |
| Refill rate | 684 VMs/s on 8 cores | |

### Not yet proven
- Linux bare-metal numbers (all Linux runs so far are nested).
- Fleet economics.
- Snapshots, pause and resume.
- Threads, writable filesystem, network.
- Python.

### Claims we must never make
- 0.29 ms as a cold start.
- "26 syscalls".
- Lua went "dead → alive" through growth. It already ran with ENOSYS defaults; growth produced a verified contract.
- The two signal handlers in the growth demo "implement signals". They return ENOSYS.
- "QuickJS is fast". It is 3–5× slower than V8 JIT on glue code and about 13× slower on numeric kernels.
- "Tiny kernel means tiny TCB" or "proven secure".
- Anything about snapshots or per-task assembly as if it were shipped.

---

## 2. Round 1: value, landscape and Twitter positioning
Reports: `arch/research/pitch/01–05`.

### 2.1 Value audit (01)
- **Real value, narrow niche:** short, restricted programs that orchestrate tools.
- **Strongest behavior:** concurrent host-tool calls inside disposable hardware VMs.
- **Closest prior art:**
  - Hyperlight-Unikraft documents Linux runtimes, snapshots and MCP.
  - Cloudflare Dynamic Workers runs Python, JS and Wasm.
- **Gaps:** Linux bare metal, memory density, no Python or Node, no network or writable FS. The idea that "the agent writes kernel code" needs a careful trust story.
- **Minimum work to be pitch-ready:** 1–2 days of truthful evidence packaging plus one useful demo.

### 2.2 Hosting landscape (02)
- Agent execution is a real market, but general sandbox hosting is crowded.

| Vendor | Isolation | Start | Default size |
|---|---|---|---|
| Firecracker (OSS) | KVM VMM | <125 ms boot | <5 MiB VMM overhead, excluding the guest |
| AWS Lambda MicroVMs (launched 2026-06-22) | Managed Firecracker, snapshot launch | "near-instant" | 1 vCPU / 2 GB baseline |
| E2B | Firecracker plus a snapshot layer | about 150 ms template start | 2 vCPU / 4 GiB |
| Deno Sandbox (beta 2026-02-03) | Firecracker | <200 ms | 2 vCPU / 1.2 GiB |
| Fly Sprites | Firecracker; disk-only checkpoints | <1 s cold wake | 256 MB+ |
| Daytona | Containers or VMs, with pause and fork | <90 ms (containers) | varies |
| Cloudflare Dynamic Workers | V8 isolates | ms | a few MB |
| Hyperlight | Micro-VM, no OS | ms | 1.8 MiB parked process; **0.37 MiB/VM with a shared snapshot** (measured, section 0.1) |
| Google Cloud Run | gVisor sandboxes inside instances | — | — |

- Vercel covers both QuickJS code mode (Run SDK) and Firecracker sandboxes.
- "boat.dev" exists and is not Bolt.new.
- Vendors would mostly **build or partner, not acquire**.

### 2.3 Agentic coding players (03)
- **Code mode is mainstream:**
  - OpenAI ships a fresh, restricted V8 runtime for it.
  - Anthropic's programmatic tool calling uses Python.
  - Cloudflare and TanStack have the clearest integration interfaces.
- **Full coding-agent workspaces need real Linux.** Sofort fits short tool programs, not workspaces.
- **Likely first users:** enterprise agent builders, plus Factory and Amp as design partners.
- **Anthropic** is a plausible strategic prospect through custom JS tools.

### 2.4 Scale and economics (04)
- **Best initial wedge:** local MCP execution on Apple Silicon. Needs packaged binaries and useful tools.
- **Clearest first revenue:** letting SaaS customers run automations safely.
- **CPU-only estimate:** about $0.05 per 1M executions. This excludes host overhead, capacity and operations.
- **Model:** open-source core; sell managed hosting, embedding, governance and support.

### 2.5 Twitter positioning (05)
- **One-liner:** "Throwaway microVMs on a tiny Rust kernel grown offline against Linux."
- **Differentiator:** the growth loop.
- **Recommended thread:** the practical one for agent builders.
- **Contents:** three full 10-tweet threads, ten skeptical replies with answers, and a priority list of accounts to engage.
- **Before reuse:** fix the overclaims in the `arch/viz` animations.

---

## 3. Round 2: demo concepts
Reports: `arch/research/pitch/06–09`.

| Report | Winner | Effort | Notes |
|---|---|---|---|
| 06 Spectacle | **"A computer for every program"**: a wall of VMs being created and destroyed, with a real counter, zooming into one run (32 s) | 14–20 h | The grid shows history, not simultaneous density. Runner-up: "One red syscall". |
| 07 Practical | **"Can I ship? Twenty checks. One agent call."**: 20 CI, telemetry and issue checks across 6 services in one code-mode call, returning a HOLD report | 19–29 h | A test program already passes: 20 host calls, 2 blockers found. Runner-up: a poisoned issue that is visibly contained. |
| 08 Narrative | **"The agent taught its computer to read a database"**: read-only SQLite fails today on missing `fstat` and `pread64`, the agent grows them, and output matches Linux | 28–44 h (6 h scope gate) | Verified that it fails today. SQLite in-memory and time/random cases already work. Fallback: QuickJS `ppoll` regrowth, 7–11 h. |
| 09 Virality | Launch sequence: teaser → useful demo → **"Every click gets a new computer"** (preset programs plus shareable receipts) → published findings | — | No arbitrary public JS without dedicated hosts and budgets. An escape challenge is a separate security event. Prefer web sharing over an X bot. |

Earlier recommendation: teaser 06, main launch 07, follow-up 09, big swing 08.
**This was later superseded:** the user wants a performance and memory angle, not "checking".

---

## 4. Discussion: performance, memory and fit

### 4.1 Performance and memory as the headline
- **Against Linux sandboxes we already win by a wide margin:** 6–9 ms against 100–200 ms, and 10.7 MiB against 1–4 GiB defaults.
  - **Correction (0.1):** 1–4 GiB is *configured* RAM. A snapshot-restored tiny Firecracker guest measures 1.43 MiB marginal, so compare physical density only against measured marginals.
- **Against Hyperlight we lose on memory today.** It shares its initialized snapshot pages and we don't yet.
  - Measured: 0.37 MiB/VM against jitk's 3.88 (with the malloc fix). The shard design projects 0.55–0.65 for a small run.

### 4.2 Getting to about 1–2 MiB [planned]
Breakdown of today's 10.7 MiB (`arch/research/next/01-snapshots-memory.md`):

| Part | Today | Fix | Target |
|---|---|---|---|
| Kernel + QuickJS image copied into every VM | 2.8 MiB | One shared copy-on-write file mapped into all VMs | about 0 per VM |
| Host side: libkrun process, device threads, allocator (not yet broken down) | about 7.9 MiB | Measure first, then strip libkrun or run many VMs per process (Hyperlight's approach) | 0.25–0.75 MiB |
| QuickJS heap, stacks, page tables actually written | (included above) | Boot once, snapshot, clone | 0.35–1.1 MiB |
| **Total extra per VM** | **10.7 MiB** | | **0.6–2 MiB [est]** |

- **Precedent:** SEUSS (OSDI '20) reached 0.05 MB per hot clone and 54,000 Node contexts on one host.
- **Caveats:**
  - Linux only: macOS HVF allows one VM per process.
  - Small runs only: a structured 1 MiB JSON parse needs an 8 MiB+ heap.
- **Effort:** 2–4 h to measure where the memory goes, plus 4–6 h for a shared-snapshot spike on KVM.

### 4.3 Why it doesn't fit coding-agent workspaces
Coding agents need things Sofort doesn't have:
- `fork`/`exec` of many tools (git, node, tsc, pytest);
- threads;
- dynamic linking;
- a writable filesystem with real semantics;
- network access (npm, git, TLS);
- terminals, signals and `/proc`;
- sessions lasting hours.

Even a static Go binary needs about 65 `rt_sigaction` calls, `clone` threads, `futex`, `epoll`, and signal-based preemption.

**Growing jitk into all that means rewriting Linux.** gVisor did exactly that over many years and still has compatibility gaps and overhead.

**Is it still cheaper if we only implement what we need?** Only for small work, because kernel overhead is roughly fixed while workload memory scales:

| Workload | Linux overhead | Sofort result |
|---|---|---|
| QuickJS snippet (about 2 MiB) | tens of MiB and about 100 ms boot dominate | 10–100× cheaper |
| Coding workspace (1–4 GB: Node, tsserver, node_modules) | the kernel is under 5% | at most about 5% saved |

**Where it does fit coding agents:** a hybrid. The workspace stays on Linux, and small, many, disposable runs go to Sofort, with Linux as the fallback:
- agent-written snippets;
- isolated test runs;
- static tools (jq, sqlite, ripgrep).

### 4.4 JavaScript or language-agnostic?
- **Product: JS first.** Models write TypeScript well, and the code-mode ecosystem (codemode, TanStack, `.d.ts` tool types) is TS.
- **Architecture: language-agnostic.** V8 isolates are JS and Wasm only; the growth loop exists to run any static binary.
- **Python is the second act.**

---

## 5. The pivot in framing: computers that pause, fork and ship like a file

### 5.1 Why it's structurally possible here
- The guest's only I/O is the tool channel: no sockets, no host files, no extra kernel state referencing the host.
- So a VM blocked on an awaited tool call is a **clean cut point** for a snapshot.
- That is hard on Linux (sockets, clocks, entropy) and impossible in V8 isolates.
- The kernel also owns time and randomness, so **snapshot + journal of tool results = exact replay** for any language.

### 5.2 What it makes possible

| Capability | Example |
|---|---|
| Wait for a person | A script pauses on `await approve(...)` for 3 days at 0 CPU and resumes mid-line |
| Survive slow work | A 20-minute CI tool doesn't hold a VM open |
| Survive crashes and deploys | Running scripts don't die when the host restarts |
| Search and RL | Fork a mid-run state N ways; RL environment resets become a memory copy |
| Debugging and audit | Exact replay of what an agent did |
| Locality | Move the 1 MiB computer next to the data |

### 5.3 Does it exist elsewhere? Yes, partially

| Approach | Examples | Catch |
|---|---|---|
| Linux VM snapshots | E2B pause and snapshots, Morph branching, Daytona fork, Lambda MicroVMs suspend (up to 8 h), Modal VM memory snapshots (alpha) | Hundreds of MiB to GB; sockets, clocks and entropy are hard to restore |
| Process checkpointing | CRIU | Fragile, needs privileges |
| Replay engines | Temporal, Restate, DBOS, Inngest, Pi Durable | Code must be deterministic or written as explicit steps |
| Durable Wasm | [Golem](https://learn.golem.cloud/docs/why-golem): automatic durability and `fork()` | Wasm only, software isolation. The closest competitor. |
| Cloudflare | Code Mode durable approval replay; Dynamic Workflows; Agents fibers (JSON checkpoints) | [DO memory lost on eviction](https://developers.cloudflare.com/durable-objects/examples/durable-object-in-memory-state/); [an awaited fetch blocks hibernation](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/); container snapshots exclude memory and processes |

**Correction to an earlier claim of mine:** "nobody ties pause to machine state" was wrong. What's new is the combination.

**A Durable Object for any language?**
- Not yet; pause and resume aren't built.
- It's the right destination, but Golem is close, and **if the state is ten JSON fields, a database workflow is simpler and cheaper.**
- Pitch it only where running state is genuinely costly or fragile to rebuild: closures, partial computations, native binaries.

### 5.4 Economics at 1 MiB [est]
Assumes about $0.0067/GiB-hour for AWS memory (r7g) and S3 at $0.023/GB-month. Memory only; excludes host overhead and vCPU limits.

| | 1M computers in RAM | 1M paused on disk |
|---|---|---|
| jitk at 1 MiB | about 1 TiB, about $7/h | about 1 TB, about $24/month |
| Linux microVM at 512 MiB *configured* (billing view, not physical) | about 512 TiB, about $3,500/h | hundreds of TB |
| Firecracker tiny Linux, snapshot-restored (measured marginal, 0.1) | about 1.4 TiB, about $10/h | depends on the guest |
| jitk shard, small run (projected 0.6 MiB, 0.1) | about 0.6 TiB, about $4/h | |

**Correction (0.1):** at the physical level, a minimal snapshot-restored Linux microVM is in the same order of magnitude as jitk. The big gap is against what sandbox products *allocate and bill* for full Linux environments, not against what a minimal Linux guest needs.

This moves the product from "a fast sandbox" (a crowded latency race) to **"keep a computer per user, per agent, per conversation, indefinitely"**: the Durable Objects business model.

Caveat from the primitive reports: 100,000 resident computers at 1 MiB is still about 98 GiB, and big heaps make big snapshots.

### 5.5 Combining with the Next Token Ep 07 ideas
The podcast ("What's after Code Mode", Cloudflare speakers) maps onto Sofort like this:

| Podcast idea | On Sofort |
|---|---|
| The model just writes code (code mode) | [built] The executor implements codemode's `Executor` |
| "Everything is a file"; tools as resources with an executable MIME type | A paused computer *is* a file at a URI like `sofort://computers/<hash>` |
| "A kernel built for purpose, almost just in time, reached over MCP" (~54:00) | Content-addressed computers: hash(kernel profile + binaries + resources + permissions) → cached image, booted in ms. The growth loop produces the profile. |
| Cap'n Web stubs and promise pipelining (~58–63:00) | Tools enter the VM as stubs; the guest never holds credentials. Chains pipeline into one round trip. |
| Compute locality and waterfalls | Small enough to move the computer next to the data |
| Durable execution and approvals | Pause on an awaited stub call. Gatekeepers become "snapshot, ask, resume". |
| Triggers and events | A paused computer subscribes to an event; a webhook wakes it |
| Reusable scripts as memory (Kody) | Save a warmed computer and call it later as a tool. Every computer can be an MCP server. |

### 5.6 Layers: separating what we're building

```
L3  Products     (a) Code-mode executor            (b) Durable computers
                     stateless: run once, die          address, alarms, one writer
                     [built: MCP execute]              [don't build as a platform]
L2  Capability   tool protocol · permissions · effects journal · approvals
    channel      (JSON lines today → Cap'n Web stubs) — adopt existing designs, keep thin
L1  Lifecycle    pause · resume · fork · move · replay        ← the new primitive [planned]
L0  Machine      jitk kernel + VMM + images [built]
                   tooling: growth loop, just-in-time image builds
```

- **L1 depends on L0's single channel.** That's what makes pausing cheap and clean, so **L0 + L1 is the defensible core.**
- **L2 is mostly adoptable** (Cap'n Web, Cloudflare OS gatekeepers). L0 makes the policy complete, because there is no other way out.
- **L3a and L3b are the same stack used two ways.**
- **L3b as a platform is an entire company** (routing, consistency, storage, placement). Use Durable Objects or a database for addressing, and R2 or S3 for paused computers.

**Pivot?** No. Same project, new headline, reordered roadmap:

| | Before | After |
|---|---|---|
| Headline | Fast single-use sandbox for code mode | Computers small enough to pause, fork and ship like a file |
| What we own | L0 + L3a | **L0 + L1** (open source), with L3a as the first use |
| Next priority | More syscalls, Python, benchmarks | 1 MiB → pause/resume → fork and replay |
| L2 | Build our own | Adopt and keep thin |
| Deferred | — | L3b platform, a hosted service, broad Linux compatibility |

### 5.7 How the rating changes (my judgment)

| Dimension | Fast sandbox | Pausable computers |
|---|---|---|
| Novelty | 2/5 | 4/5 |
| Competition | Crowded | Thin at MB scale with hardware isolation |
| Defensibility | Low (a latency race) | Medium (the single channel is structural and hard to retrofit) |
| Market | Glue-code execution slice | Long-running agents, approvals, RL forks, per-user computers; billed on idle memory |
| Demo potential | 3/5 | 5/5 |
| **Technical risk** | **Low (built)** | **High (core unbuilt)** |

The upgrade is a hypothesis until about 1 MiB and pause/resume actually work.

---

## 6. Round 3: what to build on the primitive
Reports: `arch/research/primitive/01–04`.

### 6.1 Better X (01)
**Finding:** an execution layer for untrusted, tool-using programs that wait, recover and branch. Don't replace whole platforms.

**Key objections to answer:**
- A continuation is not a distributed transaction. The broker can charge a card and crash before recording it, so calls must be tracked as prepared, dispatched, completed and delivered, with idempotency keys.
- Exact replay is a contract: pinned binaries, controlled clock and entropy, journaled delivery order, same ISA.
- 1 MiB is not a cost model.
- Saved capability stubs must be re-authorized on restore.

**Sellable before snapshots exist:**
- a tool-only interpreter SDK;
- an automation code-node backend;
- a plugin and user-defined function runner.

**Weak:** generic Lambda, CI runners and smart contracts. Section 7 revisits Lambda.

**Top three:**
1. **Tool-only interpreter SDK** (demo 5, business 4).
   - **The pain:** companies run LLM-written code in-process (unsafe), in V8 (JS only, and hard to operate securely), or in E2B/Firecracker sandboxes (100+ ms, cost, full Linux with network, credentials at risk).
   - **The offer:** `execute(code, tools)`. Hardware isolation, milliseconds, and the code can only act through the tools you pass in. Runs locally, on-prem or in the cloud.
   - **Risk:** Hyperlight or Wasm may be "good enough".
2. **Automation backend for n8n, Zapier and Retool code steps** (demo 5, business 5 as an embedded product).
   - **The pain:** these platforms run user- and AI-written code steps. In-process sandboxes have a poor record; vm2 was deprecated after repeated escapes.
   - **The offer:** each step gets its own VM with connectors as tools, and credentials never enter user code. Later, approval steps cost nothing while waiting.
   - **Buyer:** the platform, through an embedding licence.
3. **Durable private actors for tenant agents and bots** (demo 5, business 4).
   - Each customer's bot is its own long-lived, sleeping computer.
   - Customer A's agent can't read B's memory, and the code keeps ordinary variables.
   - **Risk:** Golem and Durable Objects offer similar semantics, with weaker isolation.

### 6.2 Agent space (02)
**Finding:** make a running agent-written program a cheap durable object. The unit of agent infrastructure shifts from "conversation + rebuilt workspace" to "conversation + executable continuation".

- **Direct substitutes:** E2B pause and snapshots, Golem `fork()`, Cloudflare durable Code Mode.
- **It matters only when state is expensive or fragile to rebuild.**
- **Harness survey:** Claude Code, Codex, Cursor, Devin, the OpenAI and Anthropic SDKs, LangGraph, Letta and CrewAI all rebuild workspaces or replay transcripts. None keeps an executable continuation.
- **Gains value as models improve:** long continuations, isolation, replay for evals, handoff. **Weak-model crutches:** brute-force fork search, saved prompt scaffolding.

**Top three:**
1. **Durable agent-written tool programs with approval and event waits** (demo 4, business 4). *Value: medium.*
   - Example: "for 200 vendors: fetch the contract; if the renewal is over +10%, ask procurement; then email".
   - Today that times out inside one agent turn or gets rewritten into workflow steps. With Sofort the script just awaits.
   - Edge over Code Mode replay and Dynamic Workflows: no determinism rules, native binaries, hardware isolation.
2. **Reproducible incidents and eval branches** (demo 5, business 4). *Value: highest, and buildable earliest.*
   - A capsule holds the exact program plus every recorded tool response.
   - You can rerun it offline, step to where it went wrong, and branch from that state to test a fix.
   - Uses: debugging, compliance, evals, RL data.
   - Partner idea: a "replay" button in LangSmith or Braintrust.
   - Replay from the start needs no snapshots.
3. **Reusable warmed computers as tools** (demo 4, business 4). *Value: low to medium.* A package plus serialized data often does the same job.

**Main caveat:** forking can't undo external effects. Effects must be journaled and held at the tool boundary.

### 6.3 Old research (03)
**Finding:** the best revival is a branchable continuation with broker-controlled effects. Worlds, persistent processes, speculation and replay debugging all become operations on one object.

- **History check:** KeyKOS, rr, Firecracker and Catalyzer worked. "Old ideas finally possible" is too broad. The change is restricting the environment until both state and effects are manageable.
- **One capsule format:**
  - image identity and compatibility envelope;
  - sparse memory at a defined safe point;
  - parent snapshot hash;
  - journal prefix;
  - clock and random state;
  - pending call IDs.

  Credentials, quotas and the request ledger stay on the host.
- **A safe point is a protocol step, not any `await`.** Start with one registered pending call and an acknowledged checkpoint.
- **Three broker modes:**
  - replay: recorded results only;
  - exploration: simulated, no live effects;
  - live: permissions rechecked on every call.

  MCP annotations are hints and can't be trusted.
- **Six experiments that could disprove the thesis:**
  1. density with 1,000 continuations;
  2. restore under crashes at every point around a call;
  3. replay closure;
  4. branch economics against JSON cloning and Golem;
  5. permissions not reappearing after restore;
  6. head-to-head with Hyperlight-Unikraft. If Hyperlight does it more cheaply, adopt it as the substrate.

**Top three:**
1. **Branchable worlds** (§9): most distinctive.
2. **Executable incident capsules** (§7): the first engineering milestone.
3. **Persistent approval continuations** (§2): the product wedge.

**Order:** capsules → worlds as the demo → approvals as the product.

### 6.4 Cloudflare signal (04)
**Finding:** Cloudflare validates the direction strongly and already owns most of the obvious product. The opening is **a small, hardware-isolated continuation that survives losing its host while waiting on a tool**, without becoming a workflow or replaying from the start.

**2026 timeline:**

| Date | Release |
|---|---|
| Mar 24 | Dynamic Workers |
| Apr | Agents Week: Sandboxes GA, facets, Think |
| May 1 | **Dynamic Workflows** |
| Aug 3 | **Cloudflare Computer** (`@cloudflare/computer`): a persistent workspace on isolates or containers, separate from Cloudflare OS |
| Aug 5 | Cloudflare OS open-sourced |
| Sep 28 – Oct 2 | Birthday Week: container filesystem snapshots (explicitly not memory or processes), Artifacts open beta |
| Oct 9 | **Deno joins Cloudflare** |
| Oct 22–25 | workerd startup-snapshot PR #7880 |

**Gaps:**
- running state is lost when a host is lost;
- an awaited call blocks hibernation;
- no native binaries outside Wasm;
- no fork of a running program.

**Not a gap:** short deterministic JS. Dynamic Workers plus Code Mode replay are good enough there.

**Deployment:**
- Workers or Computer as the front door;
- a Durable Object as the address and ledger;
- R2 for snapshots;
- an external Sofort KVM fleet for execution.

Nested KVM inside Cloudflare Containers is unverified.

**Kill scenario:** a Cloudflare API that parks a running program at a capability call and restores it on another host at comparable economics. The report rates this medium-low likelihood within 12 months. A tiny microVM tier from Cloudflare is the closest kill.

**Partnership:** credible as "a small continuation backend between Dynamic Workers and full Linux sandboxes". An acquisition is possible but isn't a strategy.

**Audience fit:**
- Kenton: capability lifetimes.
- Matt: one narrow Executor surface.
- Sunil: purpose-built computers with real pause and resume.
- Dillon: branch and fork visuals.
- Rita: an adoption path and a cost curve.

**Top three:**
1. **Resumable Code Mode executor, as a narrow Computer backend** (demo 5, business 4).
2. **Native tool coprocessor for Workers agents** (demo 4, business 3).
3. **Forkable computation for testing agent policies** (demo 5, business 3).

### 6.5 What the four agree on
1. **Durable, resumable tool programs** are the product.
2. **Replay and incident capsules** come first, because they prove the machinery.
3. **Forking with fenced effects** is the most distinctive demo, after replay.
4. **The broker and effects journal is the hard part.** Exactly-once needs idempotency keys and reconciliation, not snapshots.
5. **Sellable now:** an interpreter SDK, an automation code-node backend, and a native coprocessor.

---

## 7. Infrastructure layer: Lambda, VMs and "Workers for native code"

### 7.1 The Lambda leak
- Lambda bills **wall-clock time × memory**, so you pay while your function waits.
- Agent workloads mostly wait on LLMs, tools and people.

Same agent tool call (10 ms CPU, 10 s waiting on an LLM), run a million times:

| | Billing | Cost per 1M calls |
|---|---|---|
| Lambda ARM, 512 MB | 10 s × 0.5 GB × $0.0000133/GB-s + $0.20/M | **about $67** |
| Cloudflare Workers | $0.30/M requests + $0.02/M CPU-ms | **about $0.50** |
| Sofort, parked during the wait [planned] | about 10 ms CPU, plus negligible 1 MiB parked memory | **about $0.10 of CPU [est]** (excludes host overhead and operations) |

- **About 600× cheaper than Lambda** for waiting-heavy work.
- **Same cost class as Workers**, because Cloudflare already solved wall-clock billing for JS.
- **Honest pitch:** *Workers-style economics for things Workers can't run.* Hardware isolation, any static binary, and programs that pause, move and fork.
- **Generalization:** make outbound network a host tool (like Workers' `fetch`). Every I/O `await` becomes a park point: **a Lambda that only bills CPU and never holds memory while waiting.**
- **Blocker:** typical Lambda code is Node or Python with npm or pip packages and DB drivers. Node needs threads, epoll and a large syscall surface.

### 7.2 VMs in general
The tiny kernel wins wherever VM overhead dwarfs the work: small, many, mostly-idle, long-lived things.
- a bot per customer;
- a SQLite database per user (the Turso pattern);
- a webhook handler per integration;
- an agent per conversation.

Today these share one weakly isolated process, or each pays for a container.

### 7.3 Workers for native code
- **The shape:** a Workers-like platform (per request, CPU-billed, scale to zero) where each request gets a microVM running a **native binary**.
- **Rust:** yes. Static musl Rust runs at full native speed, with no interpreter or Wasm tax (Wasm is typically 1.5–2× slower).
- **Catches:**
  - single-threaded for now (threads need `clone` and `futex`);
  - I/O goes through a `sofort` crate instead of sockets;
  - aarch64 only today.
- **GPUs:** not inside the VM. They need a huge kernel driver and passthrough, one GPU per VM, seconds to set up, no sharing.
  - libkrun's virtio-gpu (Venus/Vulkan) works only with a full Linux guest and Mesa.
  - **Fit: the GPU as a tool.** The guest calls `infer(...)` or `run_kernel(...)`, the host schedules GPUs, and the GPU is billed per call. Workers AI works the same way.
- **What it could run:**
  - untrusted file processing (PDFs, images, zips, office documents; the Dangerzone pattern);
  - SQLite per request or per user;
  - native agent tools (tree-sitter, compression, crypto, media transforms);
  - Rust, C or Zig plugins and user-defined functions for SaaS;
  - small CPU models (embeddings, classifiers), limited until threads exist.
- **Blockers:** threads and a writable filesystem.

**Does it enable scale and performance?** Yes, by removing per-task overhead, not by making compute faster:

| Task | Container or VM per task | Sofort | Winner |
|---|---|---|---|
| 5 ms task | 100–1,000 ms overhead (95–99% waste) | about 6 ms | Sofort, 10–100× throughput |
| 30 s task | 0.3–1 s (about 2%) | about 6 ms | Roughly a tie |

That enables isolation as fine-grained as one VM per file, request, user or tool call, at a scale currently too expensive.

### 7.4 Are people actually worried about agent code security?
Yes, and it's escalating:

- **2026-04:** "Comment and Control". Claude Code Security Review, Gemini CLI Action and GitHub Copilot were steered by malicious PR and issue text into leaking secrets ([CSA](https://labs.cloudsecurityalliance.org/research/csa-research-note-comment-control-github-prompt-injection-20/)).
- **2026-07:** Codex non-interactive mode runs attacker instructions hidden in `AGENTS.md` ([Backslash](https://backslash.security/blog/openai-codex-injection-in-agents-md-exfiltrating-credentials)).
- **2026-08:** CVE-2026-75130, a poisoned MCP server exfiltrating `.env` credentials ([record](https://fieldguide.lutrasecurity.com/CVE-2026-75130/)).
- Claude Code permission bypasses, and an Amazon Q CVE triggered by malicious MCP config files ([VentureBeat](https://venturebeat.com/security/six-exploits-broke-ai-coding-agents-iam-never-saw-them)).

The structural argument is Simon Willison's "lethal trifecta": private data plus untrusted content plus external communication equals a leak. **Sofort removes the third leg by construction.** There is no network, and every effect is a host-checked tool call.

**Caveats:**
- Worry isn't buying. Most incidents happened in full-Linux coding agents, where Sofort doesn't fit.
- Paying buyers: regulated industries, multi-tenant platforms, and anyone running other people's code.
- No confirmed mass theft yet; mostly researcher disclosures.

---

## 8. Portability: making it work without KVM
Reports (all done):
- `arch/research/portability/01-usermode.md` (8.3)
- `arch/research/portability/02-wasm.md` (8.1)
- `arch/research/portability/03-hardware-reach.md` (8.4)

### 8.0 Conclusion: three tiers, one programming model

| Tier | Runs on | Isolation | Pause/fork/move | Status | Effort to production [est] |
|---|---|---|---|---|---|
| **Portable (Wasm)** | Anywhere: browser, Workers, Node, phones, any VPS, a Pi | Wasm runtime (software) | **Proven in a prototype** across Wasmtime, Node, Chromium, workerd and Dynamic Workers | prototype measured | days to weeks |
| **Native process (user-mode)** | Any Linux without KVM | Host Linux kernel behind seccomp + namespaces; or gVisor systrap for a stronger no-KVM boundary | Parked CoW clones measured; durable restore not built | spike measured | **5–9 engineer-months** for the exact jitk ABI + forks; 2–4 for a looser "native compatibility profile" |
| **Hardware (jitk)** | Macs; ARM Linux with KVM + GICv3; Asahi M1/M2 (1–3 days to certify); Pi 4/5 (**3–5 days** of GICv2 work); x86 clouds and VPSes with nested virtualization (**31–50 engineer-days** for the x86 port) | Hardware VM + 24 syscalls | Good basis (KVM/HVF state APIs); not built | ARM built | see 8.4 |

**What this means:**
- **Wasm is the cheap way to be everywhere.**
- **jitk is the strong tier where virtualization is exposed.**
- **The user-mode backend is the expensive middle option.** Defer it unless native binaries without KVM become a real requirement. gVisor is the established alternative for that case.
- **Programs and the tool channel stay the same across tiers.** A paused computer moves *within* a tier: Wasm to Wasm, or same-ISA jitk to jitk. Moving *across* tiers needs replay.

### 8.1 Wasm backend: pause, fork and move already work in a prototype
Measured on this Mac; local runtimes only, nothing deployed to Cloudflare.

**What was built:** the repo's QuickJS release compiled to wasm32-wasi.

**Size:**

| | Size |
|---|---|
| Module | 944 KiB (324 KiB gzipped) |
| With Asyncify | +57% |
| Wizer pre-initialized | 1,021 KiB |

**Speed:**

| Step | Time |
|---|---|
| Instantiate a precompiled module | about 0.025 ms |
| Initialize QuickJS | about 0.13–0.16 ms |
| Warm `return 2` | about 10–11 µs |
| One tool round trip | about 45–77 µs (noisy, under contention) |
| Cold in a fresh Node process: compile + instantiate + init + first run | 36 ms median (21 ms with Wizer) |

**Memory:**
- About **0.32–0.38 MiB of extra resident memory per small instance** in a shared runtime process.
  - **Correction (0.1):** this is parity with Hyperlight's shared snapshot (0.37 MiB), not better.
  - It beats today's jitk (3.88 MiB on Linux), but the shard design projects 0.55–0.65 MiB with hardware isolation.
- Runtime baseline: 69–99 MiB per process, shared across all its instances.

**Compute:** **1.4× slower** than native QuickJS in V8, and **2.2–2.3×** in Wasmtime. This is one integer benchmark.

**The key result: pause, fork and move work.**
- A QuickJS program was parked on an unresolved tool promise, holding:
  - a closure;
  - a cyclic object;
  - a typed array;
  - a Map.
- It was snapshotted in Wasmtime and **resumed in Node/V8, a Chromium browser tab, local workerd and a local Dynamic Worker** (with outbound access disabled).
- **Two forks** received different tool replies and returned different correct answers.
- **No request was sent twice.**
- The snapshot is **about 100 KB gzipped** (2 MiB of memory, mostly zero).
- Restoring took about 0.3–0.5 ms in a few samples. That is not a full benchmark.

**Why it works:** a JS `await` stores its continuation *inside the QuickJS heap*.
- The checkpoint is taken after control returns to the host, when no Wasm frames are active.
- At that point the state is just linear memory plus one global (`__stack_pointer`).
- This needs no Asyncify or JSPI.
- Asyncify was tested separately: it can move a suspended C stack (Node to Wasmtime), at +57% module size.

**What it can't do:**
- **A native jitk RAM snapshot cannot be resumed as Wasm, or across ISAs.** The pointers, value layouts and frames differ. Cross-backend moves need deterministic replay.
- The alternative is to run the same Wasm computer *inside* the hardware VM. That isn't built.
- Wasm here is software isolation. workerd itself warns it is "not a hardened sandbox" on its own.
- It runs only programs compiled to Wasm: no arbitrary native binaries, no threads.

**Recommendation:**
1. Ship a portable QuickJS/Wasm backend with checkpoints at tool calls.
2. Keep jitk as the native, hardware-isolated tier, selected by the isolation level required.
3. Build the host-side operation log into the capsule format from day one.
4. Use compile caches, pools of initialized instances, and Wizer for startup.
5. Keep Asyncify opt-in.

One capsule envelope holds several state types: `wasm-quiescent-v1`, `wasm-asyncify-v1`, `jitk-native-v1` and `replay-v1`.

**What this changes for the plan:**
- **Pause, fork and move become demoable now on Wasm**, before the KVM snapshot work.
- **"10,000 agents on a $5 VPS" becomes realistic without KVM:**
  - in RAM: 10,000 × about 0.35 MiB is about 3.5 GB;
  - on disk: 10,000 × about 100 KB is about 1 GB.
- The honest framing is two tiers: **portable tier (Wasm) anywhere; hardware tier (jitk) where KVM or HVF exists.**

### 8.3 User-mode backend, no hypervisor (01-usermode)
Measured inside the shared, contended Linux VM, as plain processes without KVM. Treat ranges as noisy.

**What was shown:**
- The repo's unmodified static QuickJS ran under:
  - a 24-number seccomp allowlist;
  - a hybrid user-notification supervisor.
- The jitk kernel's archive code and 12 syscall modules compiled unchanged as a userspace library and passed functional tests.

**Cost of intercepting a syscall** (µs per call, median):

| Method | µs per call |
|---|---|
| Native | 1.19 |
| Seccomp allow | 1.69 |
| In-process SIGSYS trap | 9.5 |
| User-notification supervisor | 16–64 |
| ptrace | 120–230 |

**Startup:**
- Static QuickJS `return 2` via fork/exec: about 4.2 ms.
- Full bootstrap with the protocol: about 54–78 ms, a noisy prototype.
- **Clone of a parked, initialized QuickJS: about 0.48 ms; clone + run + exit: about 1.22 ms.**

**Memory:**
- About 410 KiB PSS per independently launched guest.
- About 0.5 MiB with the supervisor.
- **About 61 KiB PSS per parked CoW clone.** The children shared one heap and weren't individually confined, so this is not a production number.
- Planning estimate: 0.6–1.5 MiB per hardened instance.

**Compute:** native speed between syscalls (1.05–1.19×, within noise).

**Isolation caveats:**
- **A 24-number allowlist is NOT the jitk contract.** The prototype could still read `/etc/passwd`, because allowing `openat` by number isn't confinement.
- An in-process SIGSYS handler is not a security boundary.
- The boundary becomes the host Linux kernel's filtered surface, a different tier from KVM.

**Recommendation:**
- An external broker, with user notification only for semantics that differ from Linux, and normal pipes for the tool channel.
- Use **gVisor systrap** if a no-KVM deployment must resist host-kernel exploits.
- Keep ptrace as a reference and checkpoint tool.

### 8.4 Hardware reach (03-hardware-reach)

**x86-64 port: 31–50 engineer-days** (a file-by-file breakdown is in the report). A narrow boot-to-QuickJS prototype is plausibly 10–15 days. It unlocks nested KVM on:
- AWS: Intel C8i/M8i/R8i since Feb 2026, and seventh-generation Intel since Jun 2026. Not virtual Graviton.
- GCP, Azure, OCI.
- Vultr VX1 and OVH Public Cloud.
- Cheap VPSes: **RamNode documents nested KVM on a $5/1 GB plan.**

**Not usable:** Hetzner Cloud (no nesting, including CAX ARM), Linode, and virtual ARM VMs on the big clouds. Hetzner RX ARM dedicated servers are currently unavailable.

**Raspberry Pi 4/5:**
- Uses GIC-400 (GICv2) and has KVM.
- **libkrun already falls back to GICv2. The blocker is jitk's `fdt.rs` and `wait.rs`, which assume GICv3.** Fix: 3–5 days, including board tests.
- Estimated performance (no board was measured):
  - Pi 5: 20–80 ms cold, 0.3–3 ms for a parked tool call.
  - Pi 4: 40–150 ms cold, 0.5–5 ms for a parked tool call.
- RK3588 boards have GICv3 and are likely usable after certification.

**Asahi M1/M2:** KVM works, and libkrun is already used there (muvm). 1–3 days to certify; estimated 5–20 ms cold.

**Nested performance warning:**
- The local double-nested path (HVF → KVM) is very slow:
  - **about 1 ms per nested exit** against 1.5 µs on direct HVF;
  - 2.07 s cold;
  - 202 ms for a parked tool call.
- This is not representative of single-level cloud nesting. **Benchmark a real nested x86 cloud before promising any latency.**

**Other hypervisors:**
- Windows (WHP): libkrun has upcoming WHP code; Hyperlight already has tested backends. Either way it needs the x86 guest plus 2–4 weeks.
- MSHV: specialized hosts only.
- Android AVF: no access for ordinary apps.
- ChromeOS and bhyve: build them on demand.

**Cheapest hardware-tier boxes:**

| Box | Cost |
|---|---|
| An owned Pi 5 | $45 board, $60–100 set up, about €1–2/month power |
| An existing Mac with Asahi | electricity only |
| Scaleway x86 Elastic Metal | €27.99/month (after the x86 port) |
| RamNode | $5/month (after the x86 port + nesting activation) |
| phoenixNAP Ampere Altra metal | $420/month |

**Recommendation:**
1. x86 KVM port, 6–10 weeks.
2. GICv2 for Pi 5/4, 3–5 days.
3. Certify Asahi and one generic GICv3 ARM host.
4. Benchmark real nested x86 before promising latency.
5. For Windows, choose between libkrun WHP and Hyperlight's backend layer.
6. AVF, ChromeOS and bhyve only on demand.

### 8.5 Original backend sketch (before the reports)

Brief: `arch/research/portability/BRIEF.md`.

The key idea: **the real contract is small and portable** (24 syscalls plus one tool channel). KVM is just the strongest backend.

| Backend | Runs on | Isolation | Pause/fork | Effort [est] |
|---|---|---|---|---|
| KVM / HVF [built] | Linux with `/dev/kvm`, Macs | Hardware | VM snapshot | built |
| Nested KVM | AWS nested virtualization on Intel C8i/M8i/R8i (Feb 2026) and C7i/M7i/R7i (Jun 2026) ([AWS](https://aws.amazon.com/about-aws/whats-new/2026/06/nested-virtualization-intel-us-gov-cloud/), [The Register](https://theregister.com/2026/02/17/nested_virtualization_aws_ec2)); Azure and GCP for years | Hardware | Same | **x86-64 port** of boot, vectors, MMU and syscall ABI: about 1–2 weeks |
| User-mode jitk | Any Linux, including a $5 VPS | seccomp + namespaces (gVisor class) | ptrace memory dump of one static process with one channel | a few days to prototype |
| Wasm **[prototype measured]** | Browsers, Workers, phones, any OS | Wasm runtime (software) | **Shown working:** checkpoint at a tool call, resumed across Wasmtime, Node, Chromium, workerd and Dynamic Workers, plus forks | prototype exists; productizing it is days to weeks [est] |

**Ideas:**
- One API with three strength levels; same programs, same tool channel, same capsule format.
- The Wasm backend could be viral: a paused computer becomes a link that resumes in your browser tab. Caveat: no arbitrary native binaries, and Golem is already in Wasm territory.
- Cheap ARM boxes with KVM: Asahi Linux on an M1/M2 Mac mini, Hetzner dedicated ARM, AWS Graviton metal.
- **Raspberry Pi 5 is aarch64, which matches our kernel.** Open question: it uses a GIC-400 (GICv2) interrupt controller; does libkrun support GICv2 hosts? Agent C is checking.

---

## 9. Demo pitches (current ranking)

### 9.1 Flagship: "Pull the plug" [needs about 1 MiB + pause/resume + snapshots on disk]

**Setup:** a Raspberry Pi (or another $5–80 box with KVM) on the desk, holding **10,000 sleeping agents**. Each is a hardware-isolated computer paused mid-function on an approval or event.

**Script:**
1. Show the box and the counter: "10,000 computers. Each one is paused on a line of code."
2. A public page lists the sleepers. Anyone can click one to wake it. It resumes in milliseconds, finishes, and returns a **receipt**: agent ID, the line it paused on, how long it slept, resume time, output hash. The programs are preset, so the public can't inject code.
3. **On camera, mid-run, unplug the box.**
4. Plug in a second box, or point the page at a laptop. Every agent continues from the exact line it was on. The receipts prove there was no restart.
5. Closing card: *"10,000 computers. One $80 board. We unplugged it. They didn't notice."*
   - Next to it: 10,000 × E2B's 4 GiB default is about 40 TB of RAM *allocated and billed*, and Lambda can't park mid-function.
   - Sofort: about 10 GB on disk and about 0 GB of RAM while sleeping.
   - **Correction (0.1):** label the E2B figure as configured/billed RAM, not physical need. A snapshot-restored minimal Firecracker guest is 1.43 MiB marginal.
   - The honest contrast is: **mid-function continuation + hardware isolation + native tools**, at about 0.6 MiB awake and ~0 asleep.
   - Run it on Linux (the M1 Air with Asahi); macOS caps at about 61 VMs.

**Why it lands:**
- The unplug is visceral; nobody has to understand snapshots.
- The board makes the price absurd.
- The click-to-wake page makes it participatory, with shareable receipts.
- One video proves density, mid-function durability and machine portability.

**The dunk to prepare for:** "A sleeping agent is just a DB row; Temporal does this in a few KB."
- **Answer:** make the state visibly *non-serializable*: closures, a half-built data structure, partway through a loop. Show "paused on line 37 for 3 days".
- Name Golem up front.

**Keep it honest:**
- Don't run 10,000 real LLM loops; that's over 1,000 LLM calls/s, thousands of dollars an hour. Waiting on approvals and events is real and cheap.
- Every number on screen is measured, never borrowed from a target.

**Bonus ending:** send one paused agent to *your browser* as a link, and it finishes in your tab.
- Cross-runtime resume from Wasmtime into a Chromium tab is **measured in the Wasm prototype**; the snapshot is about 100 KB gzipped.
- It works for Wasm-tier computers, not native jitk RAM snapshots.

**Shortcut, based on 8.1:**
- Run "Pull the plug" first on the **Wasm tier**, on a $5 VPS or any laptop, with no KVM and no pause/resume work in jitk.
  - 10,000 sleepers is about 3.5 GB of RAM, or about 1 GB on disk.
- Then repeat it on the hardware tier once jitk snapshots exist.
- Label the isolation tier on screen.

**Fallbacks if the Pi doesn't work:** an M1 Mac mini running Asahi Linux, a second-hand mini PC, or a Hetzner dedicated server (about €40/month).

**Pi feasibility (portability reports, 8.3–8.4):**
- **Wasm tier on a Pi works without any port.** Wasmtime runs on aarch64 Linux, so the Pi demo can happen as soon as the Wasm backend is productized.
- **Hardware tier on a Pi needs about 3–5 days of GICv2 work** in `fdt.rs` and `wait.rs` (libkrun already falls back to GICv2), plus jitk snapshots.
- Expected Pi 5 hardware-tier latency: 20–80 ms cold [est, unmeasured].
- **Honest "$5 VPS, hardware-isolated":** possible on RamNode ($5/1 GB, nested KVM) **after the x86 port** (31–50 engineer-days). Without that, the $5 VPS version is the Wasm tier, and the on-screen label must say so.

### 9.2 Possible today: "A million computers for a nickel" [needs a Linux bare-metal run]
- **The numbers:** 4.8 CPU-ms per fresh VM, so 1M VMs is about 1.3 CPU-hours, about $0.05 of CPU. At 684 VMs/s on 8 cores, that's about 24 minutes.
  - **Caveat (0.1):** the contended perf round measured 8–13 ms of VM CPU per run on today's process-per-VM path.
  - Re-measure quietly on metal before quoting any figure.
  - The shard design targets ≤2 CPU-ms (≤1 ms stretch), and its capacity math is about 39,000 runs/s on a 64-core host. **This demo is much stronger after the shard port.**
- **The video:** a live counter climbing to 1,000,000 computers, each booted, run and destroyed, beside the CPU bill.
- **Comparison:** Lambda's request fees alone are $0.20 per 1M; a Linux sandbox takes 100+ ms to boot each.
- **Needs:** a c7g.metal spot run (under $1, **needs user approval**) so the numbers are real Linux bare metal.

### 9.3 Performance: "1,000 untrusted files, 1,000 computers" [needs one native parser that fits today's syscalls]
- **Setup:** a folder of 1,000 PDFs and images, some deliberately malicious (zip bombs, crafted files).
- **The video:**
  - A grid where each file gets a fresh VM, is parsed by a native Rust or C parser, and the VM is destroyed.
  - Tiles go green; hostile ones go red, contained.
  - All finish in seconds on a laptop, while a `docker run` per file is still loading alongside.
- **Caption:** *"Every file got its own computer. Total cost: less than one container."*

### 9.4 "Same function, three bills"
A side-by-side of the waiting-heavy agent tool:
- Lambda: about $67 per 1M.
- Workers: about $0.50.
- Sofort: about $0.10, plus hardware isolation and native binaries.

It's honest because it shows Workers is close.

### 9.5 "Git for running programs" [needs snapshots + replay]
- **The idea:** snapshots carry a parent hash, so they form a Merkle DAG like git.
  - Commit = snapshot.
  - Branch = fork.
  - Checkout = resume.
  - `bisect` = replay to find the step where an agent went wrong.
- **Storage:** capsules live in Cloudflare Artifacts or R2.
- **The video:** `git log` of an agent's *execution*, `checkout` into the middle of a running function, then branch it.
- **Why:** it uses vocabulary developers know and fits Cloudflare's Artifacts push.

### 9.6 For Cloudflare's audience: "Cloudflare routes the computer. R2 stores it. The computer remembers where it stopped." [needs pause/resume]
1. Start a run through a Worker; a Durable Object shows the address. The QuickJS program has local variables, a closure and a checksum.
2. It reaches a real approval call. Park it and show the measured checkpoint bytes.
3. Kill the executor host *and* the Durable Object.
4. Approve. It restores on a second KVM host and continues inside the function with the checksum intact. The already-completed write does not run twice; show the idempotency key.
5. Optionally, fork ten read-only branches with different tool responses.
6. Give an honest comparison: Dynamic Workers for fresh JS, Workflows and Code Mode replay for ordinary scripts, Sofort for the "running machine" case.

### 9.7 Kernel growth: "The agent taught its computer to read a database" [28–44 h]
- Read-only SQLite fails today on `fstat` and `pread64`. The agent grows them, they're differentially tested against Linux, and the output matches.
- Strong for systems-nerd Twitter and the "purpose-built kernels" narrative.

### 9.8 Earlier concepts, still valid as secondary content
- "A computer for every program" (spectacle wall, 06).
- "Can I ship? Twenty checks. One agent call." (practical, 07).
- Poisoned-issue containment (07 runner-up).
- "Every click gets a new computer" (participatory, 09).

### 9.9 Suggested sequence
1. **Teaser:** "A million computers for a nickel" (9.2), possible today after the Linux run.
2. **Main:** "Pull the plug" (9.1), once pause/resume works.
3. **Follow-ups:**
   - Cloudflare version (9.6) to engage their developer relations;
   - "1,000 untrusted files" (9.3);
   - "Git for running programs" (9.5);
   - the SQLite growth story (9.7);
   - published findings and benchmarks.

---

## 10. Pitch lines

| Line | Audience | Risk |
|---|---|---|
| **"Computers small enough to pause, fork and ship like a file."** | Everyone; main headline | Needs pause/resume to be real first |
| "The podcast asked what's after code mode. Here it is." | Cloudflare and Next Token audience | Don't imply endorsement |
| "Workers-style economics for things Workers can't run." | Infrastructure engineers | Must show Workers is close on cost |
| "A Lambda that never bills while it waits." | Cost-sensitive builders | Needs outbound-as-tool plus parking |
| "Every file, request, user and tool call gets its own computer." | Security and platform teams | Throughput claims need the Linux run |
| "10,000 computers. One $80 board. We unplugged it. They didn't notice." | Viral and general dev audience | Only after it works end to end |
| "Throwaway microVMs on a tiny Rust kernel grown offline against Linux." | Systems nerds (from 05) | Safe today |

**Phrases to avoid:**
- "first";
- "unhackable" or "proven secure";
- "faster than V8";
- "replaces Linux";
- "Durable Objects for any language" (Golem is close; use carefully).

---

## 11. Build plan

| # | Work | Effort [est] | Unlocks |
|---|---|---|---|
| 1 | **Deterministic replay spike:** journal tool responses, clock and random; rerun; check byte-identical output. Verify every QuickJS time and random source goes through kernel-controlled syscalls. | hours to 1 day | Incident capsules; proves determinism |
| 2 | **Linux bare-metal benchmark** (c7g.metal spot, under $1, **needs approval**) | hours | Demo 9.2; real CPU-ms per VM |
| 3 | **Memory sprint.** Largely **done** in the perf round:<br>• memory fully accounted on Linux;<br>• malloc fix applied (9.87 → 3.88 MiB);<br>• shard spike at 0.13–0.16 MiB for an empty VM;<br>• QuickJS dirty census done.<br>**Next:** port the real jitk kernel onto the shard ABI and snapshot after READY, then run the gates on the M1 Air (Asahi). | days [est] | First real all-in MiB/VM and restore numbers; small runs projected at 0.55–0.65 MiB |
| 4 | **Pause/resume at a tool call:** snapshot, write to disk, restore in a new process or host, continue | 1–2 days | Demos 9.1, 9.6 |
| 5 | **Effects journal:** prepared/dispatched/completed/delivered, idempotency keys, fencing | days to weeks | Safe resume and fork |
| 6 | **Fork with fenced effects** (replay, exploration and live modes) | days | Branchable worlds, 9.5 |
| 7a | **Wasm tier.** Productize the prototype in the TS executor (`JITK_BACKEND=wasm`) with the capsule envelope and operation log. | days to 2 weeks | $5 VPS, browser, Workers, Pi; **an early "Pull the plug" on the Wasm tier** |
| 7b | **GICv2 for Pi 4/5**, plus certifying Asahi and a GICv3 ARM host | 3–5 days + 1–3 days each | Hardware-tier Pi demo |
| 7c | **x86-64 port of jitk** | 31–50 engineer-days | Nested KVM on AWS, GCP, Azure, OCI, Vultr; RamNode $5 VPS; Windows later |
| 7d | User-mode native backend (or adopt gVisor systrap) | 5–9 engineer-months exact ABI; 2–4 for a compatibility profile | Native binaries on Linux without KVM. **Defer.** |
| 8 | Cap'n Web stubs on the tool channel | days | Pipelining, capability story |
| 9 | Threads (`clone`/`futex`) and a writable filesystem | weeks | Native platform breadth |

### Falsification tests to run before claiming anything big (from primitive/03)
1. Density with 1,000 distinct continuations, after realistic JSON input.
2. Restore under crashes at every point around a tool call.
3. Replay closure with randomness, time, errors and multiple pending promises.
4. Branch economics against JSON cloning and Golem forks.
5. Permissions and budgets not reappearing after restore or fork.
6. Head-to-head with Hyperlight-Unikraft. If it does the same more cheaply, adopt it as the substrate.

---

## 12. Open questions
- ~~Does libkrun or KVM work on the Raspberry Pi 5 (GICv2)?~~ KVM works and libkrun falls back to GICv2. jitk needs about 3–5 days of GICv2 guest work. Unmeasured on a real board.
- ~~What does user-mode jitk cost per syscall and per tool call, and can it pause?~~ 1.7–64 µs per syscall depending on the mechanism; 0.48 ms to clone a parked QuickJS. Durable restore is unbuilt; the exact ABI is 5–9 engineer-months (8.3).
- What does single-level nested x86 KVM actually cost? The local double-nested numbers (2 s cold) are not representative. Benchmark on AWS C7i/C8i, RamNode or Vultr after the x86 port.
- ~~Can a QuickJS-in-Wasm computer pause on an awaited tool call and resume in another runtime?~~ **Yes, measured locally (agent B, section 8.1).** Still open: cross-ISA Wasm moves, and running the same Wasm computer inside jitk.
- Will Cloudflare ship running-continuation snapshots or a microVM tier within 12 months? Watch workerd PR #7880, Computer interruption APIs, and container docs changing "not memory or running processes".
- Is there a buyer who needs *hardware* isolation or *native* continuations enough to choose this over Wasm, isolates or replay? Validate with 3–5 design partners: automation platforms, agent platforms, observability vendors.

---

## 13. Report index
- `arch/research/pitch/01-value-audit.md`
- `02-hosting-landscape.md`
- `03-agentic-coding.md`
- `04-scale-and-economics.md`
- `05-twitter-pitch.md`
- `06-demo-spectacle.md`
- `07-demo-practical.md`
- `08-demo-narrative.md`
- `09-demo-virality.md`
- `arch/research/primitive/BRIEF.md`
- `01-better-x.md`
- `02-agent-space.md`
- `03-old-research.md`
- `04-cloudflare-signal.md`
- `arch/research/portability/BRIEF.md`
- `01-usermode.md`
- `02-wasm.md`
- `03-hardware-reach.md`
- Background:
  - `arch/FINAL.md`
  - `arch/PLAN-R5.md`
  - `arch/research/next/01-snapshots-memory.md`
  - `arch/research/podcast/*.md`
  - `arch/research/next-token-ep07-transcript.txt`
