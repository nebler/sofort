# Sofort

Just-in-time, purpose-built computers that agents talk to (over MCP).

Agent-written code runs in single-use microVMs on **jitk**, a tiny no_std Rust
kernel for aarch64 that **grows itself**: a missing syscall is recorded, an
agent writes the handler, and the handler is accepted only if it matches real
Linux under sealed held-out tests and mutants, and breaks nothing that worked
before.

## The idea: a sandbox that learns from its own traffic

```
real agent traffic ──► census: what do agents actually run?
        ▲                        │
        │                        ▼
 more traffic routed      routable test: what runs byte-exact today?
        ▲                        │ misses, each named and sized
        │                        ▼
  promote, 0 regressions ◄── grow: an agent writes a handler, Linux decides
```

Every stage exists. Closing the loop so that it runs without a person is the
next milestone: [the roadmap](arch/jitk/docs/ROADMAP.md).

## Where it stands (measured, 2026-10-31)

| | Result |
|---|---|
| Run latency (HVF, through the executor) | **0.13 ms** p50 for `return 2`, 0.20 ms with one tool call, ~21k runs/s |
| Reset | copy-restore of written pages only: 65× less CPU than the first design |
| Memory per VM | ~0.5 MiB after a small run, on par with Hyperlight (the hypervisor's floor) |
| Real agent tasks (bench v1, 5 task families) | 100/100 on the default 16 MiB class |
| Grown kernel on a held-out program corpus | **4% → 81%** byte-exact against Linux, 0 regressions when merged |
| Cost of growing one syscall | ~113k input tokens, ~2 model calls, ~2 minutes |
| Real agent shell commands that run byte-exact today | **19.7%** of 106k commands from real sessions |

Linux references are recorded on GitHub's Linux arm64 runners and replayed
locally, so the comparison never depends on a developer machine.

## What the research says

About 15 research rounds and 60+ reports (GPT-6.1-Sol and Opus agents) tested
where this goes. The short version:

- **Generating things is taken everywhere.** "An agent builds a kernel"
  (Ginux), one VM per agent command (Medeloop), Node in a microVM with
  snapshots (Hyperlight-Unikraft), millisecond VM forks (Morph and others).
- **Checks an agent can't game are what survive.** Real Linux as the
  reference, sealed held-out tests, receipts. The sealed differential
  acceptance method has no public match.
- **Sandbox cost isn't the bottleneck for general coding agents.**
  Auto-pausing providers remove idle cost, and only about half of coding
  commands could ever route to a light kernel. The edge is short, recurring,
  bounded runs (CI and ops triage, data jobs) with isolation and a receipt per
  run, at about a cent per 10,000 light runs.
- **Memory per VM is a floor, not a design gap.** The way past it is several
  runs per VM in their own address spaces: the Cloudflare Workers model, with
  hardware page tables instead of software isolation, for native binaries.

| Round | Question | Summary |
|---|---|---|
| All rounds to 28 Oct | capsules, moonshots, teleport, flip, split, stack, Connect, video corpus | [RESEARCH-SUMMARY.md](arch/research/RESEARCH-SUMMARY.md), [catalogue](arch/research/catalogue/README.md) (1,109 ideas) |
| GrowOS → Node | can the kernel grow until it runs Node? | [growos-node](arch/research/growos-node/SUMMARY.md) |
| Novelty | is GrowOS new? | [growos-novelty](arch/research/growos-novelty/SUMMARY.md) |
| Everything is a file | an agent workstation of per-command VMs? | [agent-fs](arch/research/agent-fs/SUMMARY.md) |

All experiment reports: [arch/jitk/docs/results/](arch/jitk/docs/results/README.md).

## Roadmap

| Score | Milestone | Rough time |
|---|---|---|
| 6 | The loop runs by itself; signals grown; ripgrep works | 1–2 weeks |
| 7 | Bounded agent jobs run entirely in the guest: writable scratch FS, processes and pipes | +3–6 weeks |
| 8 | Several runs per VM, denser than Firecracker and Hyperlight; one partner's recurring workload | +3–6 weeks |
| 9–10 | General sandbox: dynamic binaries, threads, Node, networking | months |

Demos, pass marks and kill criteria for each step: [ROADMAP.md](arch/jitk/docs/ROADMAP.md).

## Layout

| Path | What |
|---|---|
| `arch/jitk/` | The product: kernel, HVF/KVM engines, executor (TS), MCP server, grow loop, protocol, bench |
| `arch/jitk/docs/` | Roadmap and dated results |
| `arch/review/` | Review rounds; `R11-REVIEW.md` has the current performance numbers |
| `arch/research/` | All research rounds, each with a summary |
| `arch/01-…10-*/`, `arch/REVIEW-*`, `arch/DECISIONS-*` | Architecture review rounds R1–R4 (history) |
| `arch/viz/` | Animated explainers |
| `kvm-dev/` | Ubuntu nested-KVM dev VM on Apple Silicon (images git-ignored) |
| `spike/` | First boot spike |

Start with `arch/jitk/README.md`, then `make -C arch/jitk build test`.
