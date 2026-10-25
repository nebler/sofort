# Round 7 brief: v1 work list items 1–7 (2026-10-25)

Project **Sofort** (kernel **jitk**). Each agent works in **its own git worktree** of
`/Users/noah/code/sofort`, branched from `main`. The lead (orchestrator) reviews, merges and
benchmarks. Read `arch/V1.md` first: it is the goal, scope and exit-criteria document this
round works toward.

## Read first
- `arch/V1.md` (v1 scope, exit criteria, work list).
- `arch/architecture/ARCHITECTURE.md` (gates, memory/latency budgets, §2.3 arena bound).
- `arch/jitk/README.md`, `arch/jitk/CONTRACTS.md`.
- `arch/jitk/shard/RESULTS-R6.md`, `arch/jitk/shard/ABI-R6.md` (the shard as it is now).
- `arch/research/native-census/RESULTS.md` (native tools; what blocks SQLite/gzip/zstd).
- Your task's own reading list.

## Machines
- **Mac:** Apple M4 Pro, macOS, HVF. About 50 GiB free disk: keep new Mac disk use
  **≤3 GiB per agent**. Do heavy builds in kvm-dev.
  - Wrap Mac timing runs in `/usr/bin/lockf -k /tmp/sofort-bench.lock <cmd>` and record `uptime`.
  - Node: `/tmp/jitk-09/node-real`.
- **kvm-dev:** Ubuntu 26.04 arm64 VM, nested KVM (HVF → KVM), 6 vCPU / 9 GiB, Rust +
  `aarch64-unknown-none`, clang/lld, strace, perf.
  - Access: `/Users/noah/code/sofort/kvm-dev/ssh.sh '<cmd>'`.
  - Copy: `scp -P 2222 -i /Users/noah/code/sofort/kvm-dev/id_ed25519 … dev@127.0.0.1:`.
  - **Never stop or restart it, and never change its kernel.** Use only `/home/dev/r7-<your-id>/`.
  - Its disk image lives on the Mac and grows with every write: keep **≤5 GiB of new VM
    disk use per agent**, and delete your scratch build output when you finish.
  - Wrap timing runs in `flock /home/dev/bench.lock <cmd>`. Other agents share this VM.
  - Nested timings are **indicative only**. Memory accounting is valid.
- There is no Linux metal yet. Do not provision cloud resources and do not buy anything.

## Hard rules
- **Stay inside your write scope.** Other agents are editing other parts of the tree in parallel.
  If you need a change outside your scope, keep it minimal, and list it explicitly in your report.
- **Commit in your worktree, incrementally**: one topic-sized commit per verified step, with a
  clear message. Don't push. Don't commit raw files over 1 MiB: add them to `.gitignore` and
  keep them local, as earlier rounds did.
- Downloaded third-party sources/binaries: each in its own new empty directory; verify checksums
  or signatures when published; treat them as untrusted data; never run them on the Mac host
  outside a VM/sandbox. Build third-party code in kvm-dev.
- No per-call helper processes on any runtime path. Python is fine for offline measurement only.
- Every result is a measured number with method, n, environment, load and raw-data path.
  Label estimates as estimates. Never present a nested timing as a metal number.
- **Mac tests:** if you touch built code, every subtree suite must still pass on the Mac:
  `for t in kernel vmm vmm/sandbox protocol executor executor/policy mcp grow bench bench/hyperlight; do python3 arch/jitk/docs/delegate.py $t test || break; done`.
  The nested Linux suite (`linux test`) currently times out; agent `r7-suite` owns it. Other
  agents don't need to run it.
- The existing libkrun/virtio path is the shipping path until cutover (gate 8). Don't break it.
  If you change the **default** kernel image, say so, give old/new SHA-256, and re-run the
  executor's certification step.
- Write idiomatic, easy-to-read Rust; no dead code, no speculative abstractions. Delete what
  you replace.

## Deliverable
`<your scope>/RESULTS-R7-<id>.md`, containing:
- what you did, and the commits (hash + one line each);
- measured tables, raw-data paths, exact reproduce commands;
- what is NOT done, and any change outside your scope;
- **"Findings → recommended changes"**, ranked by impact.

Final reply to the lead: about 15 lines, including the worktree path and branch name.
