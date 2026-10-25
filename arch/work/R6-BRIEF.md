# Round 6 brief: shard port + native tools census (2026-10-25)

Project **Sofort** (kernel **jitk**). Repo: `/Users/noah/code/sofort` (git, main). **You do NOT commit**; the lead reviews and commits.

## Read first
- `arch/architecture/ARCHITECTURE.md`: merged design, gates, memory and latency budgets.
- `arch/research/perf/SUMMARY.md`: the measured perf round and its "Next (ranked)" list. This round does items 1 and 5.
- `arch/jitk/shard/README.md` and `arch/jitk/shard/RESULTS.md`: the device-free KVM shard spike, fixture ABI v0.
- `arch/research/perf/transport/ABI-v2.md`: the proposed ring ABI.
- `arch/research/perf/qjs/RESULTS.md`: QuickJS dirty-page census.
- `arch/research/perf/guest-memory/RESULTS.md`: guest kernel memory audit.
- `arch/research/perf/linux-ledger/RESULTS.md`: the accounting method to reuse for comparability.
- `arch/jitk/README.md`, `arch/jitk/CONTRACTS.md`.
- `arch/jitk/kernel/` (src, `slots.json`, `syscalls.manifest.json`, `prepare.py`), `arch/jitk/grow/`.
- `arch/research/pitch/08-demo-narrative.md`: it verified that read-only SQLite fails on `fstat`/`pread64`.

## Why this round matters
Density for JS alone is now parity with Hyperlight's shared snapshot (0.37 MiB/VM). The differentiators we must prove are:
1. the **real** jitk kernel + QuickJS running in shard slots at about 0.55–0.65 MiB/VM, with sub-ms restore;
2. **unmodified native Linux tools** (jq, rg, sqlite, …) running on jitk. Hyperlight and Wasm cannot do this.

## Machines
- **Mac:** Apple M4 Pro, macOS, HVF. **The disk is nearly full (about 12 GiB free).** Keep new Mac disk use ≤1 GiB per agent, and do heavy builds in the VM.
  - Wrap Mac timing runs in `/usr/bin/lockf -k /tmp/sofort-bench.lock <cmd>` and record `uptime`.
- **kvm-dev:** Ubuntu 26.04 arm64 VM, nested KVM (HVF → KVM), 6 vCPU / 9 GiB, about 51 GiB free disk. Rust + `aarch64-unknown-none`, clang/lld, strace, perf.
  - Access: `/Users/noah/code/sofort/kvm-dev/ssh.sh '<cmd>'`.
  - Copy files: `scp -P 2222 -i /Users/noah/code/sofort/kvm-dev/id_ed25519 … dev@127.0.0.1:`.
  - It is running. **Never stop or restart it, and never change its kernel.**
  - Use only `/home/dev/<your-id>/`.
  - Wrap timing runs in `flock /home/dev/bench.lock <cmd>`. Another agent shares this VM.
  - Nested timings are **indicative only**. Memory accounting is valid.
- There is no Linux metal yet (an M1 Air with Asahi comes later). Do not provision cloud resources and do not buy anything.

## Hard rules
- Stay inside your write scope. If you need a change outside it, make it in a copy under `/tmp/sofort-<id>/` (Mac) or `~/<id>/` (VM) and describe it in your report.
- Downloaded third-party binaries and sources:
  - put each in its own new empty directory;
  - verify checksums or signatures when the project publishes them;
  - treat them as untrusted data;
  - never run them on the Mac host outside a VM/sandbox, except for checksum verification.
- No per-call helper processes on any runtime path. Python is fine for offline measurement only.
- Every result is a measured number with method, n, environment, load and raw data path. Label estimates as estimates.
- `make -C arch/jitk test` must keep passing **on the Mac** if you touch built code. The existing libkrun/virtio path is the shipping path until cutover (gate 8).
- Do not touch `/tmp/arch-R2C`, `~/.local`, global toolchains, or other agents' directories. Node: `/tmp/jitk-09/node-real`.

## Agents in this round
| id | write scope | machine |
|---|---|---|
| `r6-shard` | `arch/jitk/shard/`, `arch/jitk/kernel/` (feature-gated changes only, see its task), new `arch/jitk/kernel/src/arch/` | kvm-dev for KVM; Mac for `make test` |
| `r6-census` | `arch/research/native-census/` (new). Read-only everywhere else. | kvm-dev (+ Mac read-only) |

`r6-census` must NOT edit `arch/jitk/kernel/`; `r6-shard` is changing it. Experiment on copies.

## Deliverable
`<scope>/RESULTS.md` containing:
- what you did;
- measured tables;
- raw-data paths;
- exact reproduce commands;
- what is NOT done;
- a final section **"Findings → recommended changes"**, ranked by impact.

Reply to the lead with a summary of about 15 lines.
