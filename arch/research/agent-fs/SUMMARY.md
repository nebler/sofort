# "Everything is a file" for agents: what the research says (2026-10-31)

Five reports (GPT-6.1-Sol): [01 prior art](01-PRIOR-ART.md),
[02 command census](02-COMMAND-CENSUS.md), [03 economics](03-ECONOMICS.md),
[04 design](04-DESIGN.md), [05 demand](05-DEMAND.md). Seed: Next Token
ep. 6, ~0:18–0:20 ("one CLI contains hundreds of tools").

## Verdict

**As a general workstation for coding agents: no-go.**

- Half the commands can't be served even after Stage 2.
- The cost edge disappears against auto-pause.
- The core split (persistent workspace, disposable VM per command) is
  already published.

**As a narrow product: go, if a design partner confirms it.** The product
is recurring, bounded agent workloads (CI/ops triage, data jobs):

- code mode;
- MCP-as-files mediated by the kernel, with receipts;
- one hardware VM per run;
- a copy-on-write workspace.

## Evidence

**Prior art (01).**
- mcpfs already mounts MCP reads as files.
- BranchFS gives copy-on-write branches with atomic commits.
- Turso's AgentFS is the closest storage substrate.
- just-bash is a bash interpreter, not isolation.
- **Medeloop (July 2026) runs every agent bash command in a disposable
  Firecracker VM with a persistent `/workspace`.** That takes the split.
- **Open:** versioned, transactional per-command commits; kernel-mediated
  MCP files with policies and receipts; tool support grown by GrowOS.
- **Fastest follower:** Vercel.

**Command census (02).** 104,276 commands from 2,031 local Claude Code and
Codex sessions, Oct 6–31.

| Scenario | Routable to a µs VM |
|---|---:|
| Read-only tools, today | 25% |
| Plus host-resolved `cd` | 44% |
| After Stage 1 (writable scratch) | 48% |
| After Stage 2 (offline Node) | 50% |

- The rest is runtimes, builds, tests, network and package installs.
- 87% of commands are pipelines or compound commands; 11% use complex shell
  syntax.
- Shell calls take about 10% of a session's span; about 90% is other time
  (thinking, waiting).
- One user's development-heavy history.

**Economics (03).**
- Against continuously reserved session VMs, the hybrid is 1.8–18.6×
  cheaper.
- **Against ideal instant auto-pause, it is 7.5–9.9% more expensive.**
- Heavy commands dominate the bill.
- Mixed workloads cost $0.45–3.10 per 10,000 commands; all-light 50 ms
  commands about $0.01 per 10,000.
- "A nickel" holds only with tight limits, rare fallback, and storage billed
  separately.

**Design (04).** A prototype is 5–8 weeks:
- explicit `/mcp` semantics: request submission, results, errors, policies
  and receipts as separate files, not read-equals-call;
- immutable workspace trees with atomic branch publication;
- guest scratch copy-up and export;
- host-orchestrated pipelines.

Gaps today: native programs can't call tools, and there is no live
streaming between VMs. Workspace rollback can't undo external tool effects.

**Demand (05).**
- Best prospects are platform builders and multi-tenant agent SaaS, starting
  with short, repeated, bounded workloads.
- Cost and security pain is documented; willingness to switch is not (Amp
  reports little sandbox pain).
- OpenCode is the clearest bash-tool replacement surface. An MCP server alone
  doesn't force routing.
- A fresh VM doesn't help against a poisoned file that persists in the
  workspace.

## What holds up as our edge

- **Security:** isolation per run, kernel-mediated tools with receipts, and
  privilege separation in the guest.
- **Cost:** for light, recurring runs (about a cent per 10,000).
- **Forks:** nearly free.
- **Not an edge:** cost for general coding sessions, or "the first per-command
  VM".

## Next steps

1. One paid design partner with a recurring, bounded workload (CI or alert
   triage).
2. The Graviton run, to measure cost per run for real.
3. The `/mcp` file semantics and the native tool-call path (04), as the
   prototype's first slice.
