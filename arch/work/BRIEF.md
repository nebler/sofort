# Local work round — shared brief (2026-10-25)

Project **Sofort** (kernel **jitk**). Repo: `/Users/noah/code/sofort` (git, main; the lead commits — you do NOT commit).
Read first: `arch/architecture/ARCHITECTURE.md` (the merged design + gates), then `arch/research/next/SYNTHESIS.md`,
`arch/FINAL.md`, `arch/jitk/README.md`, `arch/jitk/CONTRACTS.md`. The two metrics that decide everything:
**memory per VM and performance (latency + CPU per run)**. Every result must be a measured number with
method, n, environment and raw data; label estimates as estimates.

## Machines
- **Host Mac:** Apple M4 Pro, 12 cores, 24 GiB, macOS, HVF. Runs libkrun/HVF jitk today. Shared and busy:
  wrap every timing-sensitive run in
  `/usr/bin/lockf -k /tmp/sofort-bench.lock <cmd>`, and record `uptime` load with each result.
- **kvm-dev:** nested-KVM Ubuntu 26.04 arm64 VM (6 vCPU, 9 GiB) — already running. `/Users/noah/code/sofort/kvm-dev/ssh.sh <cmd>`
  (user `dev`, passwordless sudo, Rust + aarch64-unknown-none, clang/lld, strace, perf). Timings there are
  NESTED (HVF→KVM): valid for function and memory accounting, **not** latency claims. Use only your own
  directory `/home/dev/<your-id>/`. Wrap timing runs in `flock /home/dev/bench.lock <cmd>`.
  Do not stop/restart the VM or change its kernel. Copy files with `scp -P 2222 -i kvm-dev/id_ed25519 ... dev@127.0.0.1:`.
- Real Linux metal is NOT available yet (an M1 Air with Asahi is coming later). Do not provision cloud resources.

## Hard rules
- **Disk is nearly full (~11 GiB free).** Your total new disk use must stay ≤ 1.5 GiB; delete your own build
  output when done (keep binaries you report on). Prefer reusing existing builds. Check `df -h ~` before big builds.
- Stay inside your file scope (below). Do not edit other paths. Anything outside your scope you need to change:
  make the change in a copy under `/tmp/sofort-<your-id>/` and describe it in your report.
- Never touch `/tmp/arch-R2C`, `~/.local`, global/default toolchains, or other agents' dirs. Node: `/tmp/jitk-09/node-real`.
- The existing build uses `/tmp/jitk-01/r3/` (libkrun build) and `/tmp/jitk-mcp-work/` (running MCP server). Read, don't modify.
- No per-call helper processes or convenience scripts on any runtime path; Python is fine for offline measurement only.
- Downloaded third-party binaries/sources go in their own empty directory and are treated as untrusted data.
- Keep `make -C arch/jitk test` passing if your scope touches built code.

## Deliverable
Write `<your scope>/RESULTS.md` (or the report path given) with: what you did, measured tables, raw-data paths,
how to reproduce, and a final section **"Findings → recommended changes"** ranked by expected memory/latency impact.

## Scopes (agents run in parallel)
| id | scope (write access) | machine |
|---|---|---|
| w0-ledger-mac | `arch/jitk/bench/ledger/` | Mac |
| w1-executor | `arch/jitk/executor/` (+ `arch/jitk/protocol/bootstrap.js` only if required, coordinated in report) | Mac |
| w2-shard | `arch/jitk/shard/` (new Rust crate) | kvm-dev |
| w3-qjs-mem | `arch/research/perf/qjs/` | kvm-dev |
| a1-guest-mem | `arch/research/perf/guest-memory/` | Mac (+kvm-dev read-only) |
| a2-cpu | `arch/research/perf/cpu/` | Mac |
| a4-transport | `arch/research/perf/transport/` | Mac |
| a5-linux-ledger | `arch/research/perf/linux-ledger/` | kvm-dev |
