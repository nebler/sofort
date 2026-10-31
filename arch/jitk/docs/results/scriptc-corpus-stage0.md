# Stage 0: the grown kernel merged into the console profile (2026-10-31)

`growos/stage0-merge` (c465d991) against the phase-2 grown kernel it came
from (`verify81`, 2026-10-30), on the scriptc corpus, jitk layout.

## Result

**No regressions. All 1,848 programs that passed before still pass,
including 386/386 held-out.**

| | programs | old grown kernel (`verify81`) | merged kernel (`stage0-*`) |
|---|---:|---:|---:|
| comparable (old run not elf-drift) | 2,313 | 1,848 pass (79.9%) | 1,848 pass (79.9%) |
| of which held-out | 479 | 386 | 386 |
| old run elf-drift | 87 | not comparable | 38 pass |

- **Pass → fail: 0.** The de-overfitted handlers (uname, sysinfo, statfs,
  pids, getpriority), ChaCha20 getrandom and the PROT_EXEC refusal cost no
  passing program.
- **missing-syscall → mismatch/crash: 13.** They used to stop at
  `sched_getaffinity`, `prlimit64`, `getrlimit` or `nanosleep` and now get
  further, then differ. They failed before and still fail.

## Coverage caveat

The comparison covers the 2,400 compiled programs in `full-r2`, the census
re-recorded after the ELF-drift fix (d8614899). That re-recording was never
completed: `full` has 4,127 compiled programs. Against `full`, every rebuilt
ELF now drifts, so the remaining 1,727 programs can't be rerun like for like
until `full-r2` is completed, which needs the Linux side of the census. The
phase-2 headline (3,198/3,947, 81%) is therefore not re-measured here; this
run shows no change on the 2,400 that can be compared.

## How it ran

`census rerun --from full-r2 --kernel <worktree kernel> --selection
visible|heldout --workers 2` on the Mac (HVF), with no oracle (rerun reuses the
journal's Linux results, 61a0b4eb). Rows: `scriptc-corpus/.work/stage0-*.jsonl`
(not in git); program-level comparison against `verify81-*.jsonl` by name.
