# Brief: making Sofort/jitk portable beyond KVM/HVF (2026-10-25)

## Goal
The user wants Sofort "as portable as possible" (e.g. a $5 VPS without /dev/kvm, browsers, Windows, Raspberry Pi,
cloud VMs) and wants to know what each backend costs in PERFORMANCE, ISOLATION and PAUSE/FORK ability.

## What exists
- jitk: aarch64-only no_std Rust kernel (arch/jitk/kernel/src: boot.S, vectors.S, mmu.rs, syscalls/, user.rs, fs.rs),
  24 syscall slots (arch/jitk/kernel/slots.json, syscalls.manifest.json). Runs unmodified static QuickJS/Lua at EL0.
- VMM: libkrun (HVF on macOS, KVM on Linux) + sandbox + native watchdog (arch/jitk/vmm).
- Guest's ONLY I/O: a JSON-lines tool channel to a trusted TS executor (arch/jitk/protocol, arch/jitk/executor).
- Measured (macOS, quiet): cold return ~5.9 ms raw / ~9 ms via executor, parked one_tool 0.29 ms raw, ~2.1 ms warm via MCP,
  4.8 CPU-ms/VM, 10.7 MiB/VM, refill 684 VM/s on 8 cores. See arch/FINAL.md, arch/jitk/bench/RESULTS*.md.
- Planned: ~1 MiB/VM via shared CoW snapshots; pause at a pending tool call -> snapshot -> resume/fork/move;
  deterministic replay (kernel owns time/random). See arch/research/next/01-snapshots-memory.md, arch/research/primitive/*.md.
- Neighbors: gVisor (systrap/ptrace/KVM platforms), Hyperlight (KVM/MSHV/WHP), Golem (durable Wasm), Unikraft, LKL/UML.

## Linux test machine
/Users/noah/code/sofort/kvm-dev: Debian 13 arm64 VM (nested KVM under HVF), 4 vCPU / 8 GiB, Rust + clang + strace + perf.
  `./ssh.sh true` to check it is up; ONLY if it is down run `./start.sh` (other agents share it; never stop it).
  `./ssh.sh '<cmd>'` runs commands. Work ONLY under ~/portability/<your-name>/ inside the VM. Numbers there are nested
  (HVF->KVM) for KVM paths; userspace (non-KVM) numbers inside it are closer to real but still label the environment.
  Other agents run benchmarks concurrently: repeat runs, report medians and note contention.
On the Mac you may use temp dirs under /tmp/portability-<your-name>/ for downloads/builds.

## Rules
- Do NOT modify existing repo files, commit, post, or contact anyone. Write only your own report file in
  /Users/noah/code/sofort/arch/research/portability/.
- Measure where feasible (prototype spikes are encouraged in temp dirs); otherwise cite sources (URLs) and label
  Fact (F) / Measured (M) / Inference (I) / Estimate (E).
- For every backend: isolation strength (what the TCB is), startup, per-syscall/per-tool-call overhead, compute speed vs native,
  memory per instance, pause/snapshot/fork feasibility, where it runs, engineering effort to support the jitk ABI.
- End with a ranked recommendation and a ~12-line summary reply.
