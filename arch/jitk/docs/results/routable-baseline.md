# Routable-command kill test: baseline (2026-10-31)

Question: how much of real agent shell traffic runs unchanged on the promoted
kernel today, byte for byte against Linux, and what would growing it buy?

## Method

- **Workloads.** `grow/routable/workloads.json` has 75 workloads, which
  instantiate 53 argument shapes on a fixed fixture tree
  (`grow/routable/fixture/`). The shapes are the most common ones in the
  agent shell census (`arch/research/agent-fs/scripts/routable_census.py
  shapes`, 106,369 commands from local Claude Code and Codex sessions).
  - Tools: BusyBox 1.37.0 (Alpine `busybox-static`) for grep, head, sed, cat,
    tail, ls, wc, cut, sort, uniq, awk, tr, diff and find, plus ripgrep 15.2.0.
  - Both binaries are fetched from pinned upstream URLs by sha256.
  - Git is not in the set: no static build yet.
- **Linux side.** Recorded and then re-verified (twice reproducible) on
  GitHub's arm64 runner, workflow `routable-record`, run 41230752523.
  - The payload runs as uid 65534 with stdin closed after the data.
  - The fixture's mtimes are pinned.
- **Guest side.** Kernel `.READY` 8957bc35 on HVF on the Mac, with the
  recordings replayed (`JITK_ORACLE=replay`).
- **Grading.** A workload matches when stdout, stderr and exit are equal and
  the trace is complete. A shape is proven when all of its workloads match.
  - Stdout is decoded byte-exactly with the corpus decoder (`guest-output.ts`).
    Grow's probe observer drops blank lines by design.
- **Routable share.** A command counts when census stage 0 routes it with
  host-side cwd and every tool invocation has a proven shape. Host-side means
  `cd`, assignments and builtins such as echo, printf, true and pwd.

## Result

| | Shapes | Share of all commands | Share of stage-0 potential (43.8%) |
|---|---:|---:|---:|
| **Proven on the kernel today** | 39/53 | **19.7%** | 45.1% |
| Ceiling of this workload set | 53/53 | 25.3% | 57.8% |

59 of 75 workloads match. The census's earlier "demonstrated profile" figure
was 2.3%. Most of the gap was unmeasured, not missing.

## The 16 mismatches, by cause

| Cause | Workloads | Adds (points) | Kind of work |
|---|---|---:|---|
| ripgrep aborts: `signal(SIGPIPE)` fails (rt_sigaction is registered but returns ENOSYS); also sched_getaffinity, madvise, tkill | rg ×6 | +3.4 | **growth**: syscalls with Linux references |
| Directory order: Linux returns getdents (hash) order, the guest returns sorted order | grep -rn ×2, find ×2 | +1.2 | grading policy: the order is unspecified by POSIX and differs between Linux file systems |
| Console stdout framing: the guest stops on control bytes (a tab from `cat -n`) or on output without a final newline (`head -c`) | head -c ×2, cat -n | +0.5 | transport: the strict stdout rule (decided 2026-10-27) |
| File metadata: mode 444 vs 644, owner 0 vs the host's 1001, mtime 0, directory sizes | ls -l, ls -la | +0.3 | archive metadata and stat fidelity; the Linux side also needs a fixed owner |
| `awk -F, '{s+=$2} END {print s}'` prints 0, Linux 1550 | awk ×1 | +0.0 | unexplained; investigate (number parsing or FP) |

All BusyBox runs also hit setgid, setuid, getuid and getgid as missing
syscalls, and rt_sigprocmask returns ENOSYS. Output is unaffected.

## Next

1. **Grow rg's syscalls** (rt_sigaction for real, sched_getaffinity, madvise)
   through the grow loop. Record each transaction's agent cost (wall time,
   CLI calls, usage receipts). That is the cost-per-syscall number this test
   exists for.
2. Decide grading for unspecified order: compare lines as a multiset for the
   directory-walk shapes, documented per workload.
3. The stdout framing is the strict-rule decision of 2026-10-27. Tabs and
   partial lines are common in real tool output, so this test argues for
   revisiting it.
