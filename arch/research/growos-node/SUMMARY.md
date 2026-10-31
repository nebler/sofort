# GrowOS to Node: what the research says (2026-10-31)

Five desk-research reports (GPT-6.1-Sol, no experiments run):
[01 competition](01-COMPETITION.md), [02 Linux-compatible kernels](02-COMPAT-KERNELS.md),
[03 Node and V8 requirements](03-NODE-REQUIREMENTS.md), [04 roadblocks](04-ROADBLOCKS.md),
[05 benchmarks and goals](05-BENCHMARKS-AND-GOALS.md). This page is the synthesis.

## Verdict

**Don't commit to Node yet. Two cheap measurements decide whether the direction has an edge.**
The "small guest + Linux compatibility + host tools" position is already
taken, and the one remaining gap (sub-millisecond reset of an initialized Node)
is borderline on physics.

## Why

**The position is occupied.**
- Hyperlight-Unikraft already documents unmodified Node.js with warmed
  snapshots, host callbacks, default-deny files and network, on KVM and
  Apple HVF (01).
- Millisecond forks of running VMs are advertised by Morph, Freestyle,
  microsandbox, Unikraft Cloud (~10 ms) and AGX (7 ms) (01).
- AWS Lambda MicroVMs, Modal VM Sandboxes, Deno Sandbox and Prime Sandboxes all
  launched in 2026, with aggressive pricing (01).

**The remaining gap:** a reproducible sub-millisecond reset of an initialized,
unmodified Node/V8, with low unique memory per VM and a bounded p99 under
churn. Nobody publishes matched figures (01, 05).

**The physics against it.**
- The comparator is tuned Firecracker restoring the same initialized Node on
  the same host. If that takes ~3–5 ms, the ≥10× gate needs ≤0.3–0.5 ms (01, 05).
- Our reset cost scales with pages written. On HVF a write fault costs ~6 µs
  per 16 KiB, about 0.4 ms per MiB dirtied, so a run that dirties 50 MiB pays
  ~19 ms (04, extrapolated).
- To reach 0.3 ms, a Node run would have to dirty under ~1 MiB. V8's young
  generation and allocator make that unlikely for real work (inference; unmeasured).

**The effort is large** (04, rough):

| Work | Estimate |
|---|---|
| Static Node loader/layout | 1–3 weeks |
| Sparse virtual memory (reservations apart from physical pages) | 3–6 weeks |
| Threads, futex, preemption on one vCPU | 6–12 weeks |
| Signals | 3–6 weeks |
| epoll, eventfd, clocks | 2–4 weeks |
| Snapshotting multi-thread state | 3–6+ weeks |

That is several months before `node --jitless` prints `1`, and Node still
starts 3–7 OS threads with every reduction flag (03).

**The JIT needs RWX.** Stock Node 22/24 V8 on Linux requests RWX code pages,
and the flag that avoided it is gone. A writable↔executable flip doesn't
suffice. The choices are an RWX exception in the guest, a patched V8, or
`--jitless` (03). Each weakens a current claim: W^X, "unmodified", or speed.

## What still holds regardless

- **Stage 1 (cwd + per-run scratch file system, jq/SQLite unmodified)** is
  useful without Node. It is the "disposable diagnostics" workload
  `arch/research/growos-fit` recommended. Design: one coherent file system
  model with stable node IDs and open-file descriptions, the archive kept
  immutable, scratch at `/tmp` and `/work` (02). Goal: 100/100 file workflows
  Linux-exact, 0 cross-run leaks in 10,000 A→reset→B sequences (05).
- **Gate quality:** add semantic test suites as separate guest programs on
  pinned Linux and on our image: gVisor syscall tests (Apache-2.0) first,
  then curated LTP and musl libc-test (02, 05). Require mutants to fail: a
  cwd that doesn't change, a missing protection change, a lost wakeup (04).
- **Code to borrow:** StarryOS, Moss and selected Occlum modules are
  permissive Rust. Asterinas is MPL-2.0 (designs yes, code with its terms).
  Nanos is the closest architecture (02).

## The two measurements that decide (both cheap)

1. **Dirty-set reset sweep.** Reset and next-run cost after a run dirties
   1/10/50/100 MiB.
   - HVF on this Mac: Mac-only, today's engine. Engine and memory-reset code
     is the other thread's area, so coordinate.
   - Then KVM on one `c7g.metal` (~$2.32/h, a few hours), next to Firecracker
     restoring an initialized Node.
   - This also measures how much a realistic Node agent script actually
     dirties, using Linux Node under Firecracker.
   - **Kill criterion:** Firecracker's clean turn × 0.1 is below our cost for
     a realistic Node dirty set.
2. **Hyperlight-Unikraft on this Mac (HVF).** Run its documented Node with
   snapshots and measure reset and memory the same way. If it already meets
   the gap, GrowOS-to-Node has no edge to build.

If both pass, Stage 2 starts with the sparse-memory and one-vCPU-thread
spikes (04 #4, #5). If either fails, keep Stage 1 (diagnostics product) and
the code-mode tiering work, and drop Node from the roadmap.

## Stage goals (from 05, adapted)

| Stage | Primary goal | Guard |
|---|---|---|
| 0 merge | ≥3,198/3,947 Linux-exact (≥644 held-out) | no previously passing program fails, except deliberate de-overfits, each listed |
| 1 scratch FS | 100/100 jq + SQLite file workflows | 0 leaks in 10,000 reset sequences |
| 2 Node | ≥190/200 frozen offline Node tests (jitless and JIT reported separately) | 50-case thread/futex/signal/exec-memory suite at 100% |
| 3 metal gate | ≥10× on reset (p50 and p99), unique MiB/VM or VMs/box vs tuned Firecracker | no other axis worse |
| 4 product | ≥2× correct workflow replays per infrastructure dollar | 0 lost task successes vs Linux |
