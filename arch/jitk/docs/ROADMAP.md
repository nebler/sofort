# Roadmap: a sandbox that learns from its own traffic (2026-10-31)

**The idea.** The loop is what Sofort has and others don't:
1. Watch what agents actually run.
2. Measure exactly how much of it runs byte-exact on the kernel.
3. Grow the kernel to cover the misses, where every change must match real
   Linux under sealed tests and break nothing that worked before.
4. Promote, and give every run a receipt.

Every stage exists today (`grow/routable.ts`, the grow loop, the CI oracle,
`kernel/promote.ts`). A person still connects them. This roadmap closes the
loop, then widens what it can grow.

## Where we are

| | Today | Source |
|---|---|---|
| Run latency (HVF, executor) | 0.13 ms p50 `return 2`, 0.20 ms with one tool | `arch/review/R11-REVIEW.md` |
| Memory per VM | ~0.5 MiB after a small run, about the same as Hyperlight | `results/shard-r7-shard.md` |
| Real agent tasks (bench v1) | 100/100 on the 16 MiB class | `bench/v1/results/2026-10-31-memory.md` |
| Grown kernel, held-out corpus | 4% → 81% byte-exact against Linux | `results/grow-phase2-2026-10-27.md` |
| Cost of growth | ~113k input tokens, ~2 model calls, ~2 min per accepted syscall | phase 2 receipts |
| Real agent shell commands that run byte-exact | **19.7%** (ceiling of the current tool set 25.3%) | `results/routable-baseline.md` |

Rating as of today: a strong research method (8/10), a weak product on its
own (4–5/10).

## The ladder to a product (an 8)

An 8 means one workload where Sofort is far better than the alternatives,
someone who uses it, and room to grow. It does not mean "runs everything".

| Score | What has to be true | Stages | Rough time |
|---|---|---|---|
| 4–5 (today) | Fast engine, verified growth, 19.7% of real commands | done | — |
| **6** | The loop runs by itself; rg works; the coverage curve climbs without a person | S0 + loop automation | 1–2 weeks |
| **7** | Bounded agent jobs (CI and log triage, jq/SQLite data jobs, pipelines) run entirely in the guest, no fallback | S1, S2 | +3–6 weeks |
| **8** | Several runs per VM in their own address spaces, clearly denser than Firecracker or Hyperlight, and one partner's recurring workload running on it | density + partner | +3–6 weeks, in parallel |
| 9–10 | General sandbox replacement: dynamic binaries, threads, Node, networking | S3–S7 | months |

Technology alone tops out at about 7. The step to 8 is demand evidence.

### Step to 6: signals and the automated loop

- **Demo:** "the kernel teaches itself rg". rg fails, a growth task appears,
  CI records Linux, an agent writes the handler, the promotion passes, rg
  turns green, with a receipt behind each step.
- **Pass:** rg 6/6 byte-exact; routable share ≥23%; 0 human edits in a loop
  turn; 0 regressions; ≥90% of a gVisor signal-test subset.
- **Kill:** the signal handler can't be accepted under the existing gates,
  or humans have to change core kernel code.
- **Learn early:** tokens per accepted signal handler (kill line ~1M); wall
  time of one loop turn including the CI round trip (target under 1 h).
- **First probe:** one live grow transaction on `rt_sigaction`
  (~100–250k tokens).

### Step to 7: writable scratch file system and processes

- **Demo:** "an agent job, fully inside". A CI-triage job runs end to end in
  one guest: rg and grep over logs, jq, sqlite3 with writes, sed edits in a
  scratch copy, a shell pipeline. Then a reset, and proof the next run sees
  none of it.
- **Pass:** 100/100 jq and SQLite write workflows; 0 leaks across 10,000
  A → reset → B sequences; BusyBox `sh` runs ≥90% of the census pipeline
  shapes; routable share ≥40%; the triage job at p50 under 50 ms.
- **Kill:** leaks that can't be closed; process semantics need a rewrite
  instead of growth; routable share stuck below 30%.
- **Learn early:** whether fork/exec grows (grow `wait4` or `pipe2` first);
  reset cost against dirty set (1/10/50 MiB sweep on HVF).

### Step to 8: density and one partner

- **Demo:** "10,000 isolated agent runs on one box". One Graviton metal host
  runs a partner's recurring job 10,000 times, each run in its own address
  space with a receipt, with cost per run next to Firecracker, Hyperlight and
  E2B prices.
- **Design:** several runs per VM, each in its own address space set up by
  the kernel, one VM per customer. Like Cloudflare Workers' isolates, but
  separated by hardware page tables and running native Linux binaries.
- **Pass:** ≤100 KiB per run; ≥5× runs per GB against tuned Firecracker on
  the same metal; a hostile probe suite can't read or affect another run;
  bounded p99 at 1,000 concurrent runs on metal; the partner runs it weekly.
- **Kill:** not clearly below Hyperlight's ~0.5 MiB; under 2× against
  Firecracker; any cross-run read; nobody uses it after the trial.
- **Learn early:** a two-address-spaces-in-one-VM prototype (~1 week);
  `c7g.metal` at ~$2.32/h, ~$10–30 per round; one partner conversation.

## Beyond 8: full Linux compatibility

| Stage | Capability | Pass test | Kill if |
|---|---|---|---|
| S3 | Dynamic loading: ld.so, /proc/self, vDSO | unmodified git, python, qpdf | the loader and /proc surface explodes |
| **S4** | **Threads:** clone(CLONE_VM), futex, TLS, preemption | gVisor futex/clone tests; Go binaries; multithreaded rg | no oracle design for concurrency keeps sealed acceptance |
| S5 | epoll, eventfd, timerfd, clocks | Go netpoll, libuv basics | — |
| S6 | Sparse memory, mprotect, RWX policy | `node --jitless`, then Node with the JIT | the RWX policy breaks the security claim |
| S7 | Brokered networking | `npm install`, `git fetch` through policy, with receipts | — |
| S8 | Heavy-work economics on metal | ≥10× density or cost per run against tuned Firecracker | not reached for real workloads |
| S9 | Compatibility certification | LTP and gVisor syscall suites next to gVisor | far below gVisor |

S4 is the bet. Concurrency breaks byte-for-byte comparison (interleavings
differ legitimately), so it needs a new oracle: deterministic guest
scheduling, sets of allowed outcomes, or property checks.

## Checks at every stage

1. Cost per accepted handler stays flat as the kernel grows.
2. Zero regressions at every promotion.
3. Overfit rate: accepted handlers that later fail a new held-out test.
4. Human lines against agent lines, so "grown" stays honest.
5. Routable share over real traffic: the coverage curve.

## Next four probes, cheapest first

1. One `rt_sigaction` grow transaction: does the method survive signals?
2. The HVF reset sweep (1/10/50 MiB): do real jobs keep the speed?
3. Two address spaces in one VM: is density beyond Hyperlight real?
4. One partner conversation: is there an 8 at all?
