# Brief: flip round 2 — the gritty parts of AI compute, and old compiler ideas that work again (2026-10-28)

## Read first
`arch/research/flip/BRIEF.md` (the method and the per-idea template — use the SAME template and labels), and skim the
TL;DR + ONE bet + rejected list of `arch/research/flip/01–06`. Also `arch/research/moonshots2/02-compilers.md` (agent JIT /
incremental agents — already covered, do not repeat). Lessons from round 1:
- The pattern is real: an old, technically right idea + a cheap automatic check (oracle) + agents absorbing the labour.
  GrowOS is the calibration (agent grows kernel syscalls, checked against Linux).
- **Most obvious combinations are already taken** by labs and big companies. Prior-art search decides everything; be thorough,
  name who does it, and say so plainly when an idea is occupied.
- The best round-1 finding (post-merge integration at agent scale) won because the pain was verified in primary sources,
  the fix was old and proven, no product existed, and better models made it better. Use that as the bar.

## This round's directions
1. **The gritty parts of AI:** GPU kernels, ML compilers, distributed training, inference serving, collective communication,
   numerics/precision, data pipelines, cluster scheduling, failures at 10k–100k-GPU scale. Where can an AGENT be hooked into
   the loop (writing, tuning, diagnosing, repairing), and what is the oracle (reference op, numerics bound, loss curve,
   throughput)? Which OLD ideas (HPC, autotuning, dataflow, BSP, systolic arrays, checkpoint/restart, …) help here?
2. **Old compiler/PL ideas that work again because models write code** (Code Mode: the model writes a program instead of
   individual tool calls) — both directions: compiler techniques applied TO agent-written programs, and LLMs used as a
   component INSIDE old compiler/verification machinery (LLM proposes, old machinery checks).
3. **Everything else in CS** that earlier rounds missed.

Be very ambitious in generation and ruthless in evaluation. For ideas where an agent is hooked in, state what the agent does,
what checks it, and how it could cheat the check (reward hacking — e.g. a kernel that passes tests by exploiting the harness).

## Rules (same as flip round 1)
- Write ONLY your own report `arch/research/flip2/NN-<topic>.md` (named in your task). No other edits, no commits, no push.
- Web research expected; cite primary sources with links and dates (today 2026-10-28). Label **F/M/I/E**. Never "first"/"unhackable".
- Pure research by default; tiny experiments only if decisive: scratch in `/tmp/flip2-<topic>/`, under 200 MB, deleted at end.
  No Docker, don't touch the kvm-dev VM, no accounts/deploys, no GPU rental.
- End with: ranked top 3, the ONE bet, 5-line TL;DR, rejected ideas with one-line reasons.
