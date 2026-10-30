# scriptc on the bench v1 programs (2026-10-30)

Question: is scriptc fast enough to compile agent-written code per run, or only
for tools registered once? Also: do the real task programs compile, and do they
give the right answer natively?

Method: each of the 25 JS programs (T1–T5, 5 each) is wrapped in a standalone
entry that defines the task's providers as replays of the recorded
`responses.jsonl`, using the same canonical call key as the harness. Each entry
is built with scriptc 0.4.5 (`tools/` pin) for macOS arm64, run, and its answer
checked with the task's oracle. Node 24.22 runs the same wrapper as a reference.
Host: M4 Pro, load 12–15, so timings are rough. Not in a jitk guest: this is
compile time and language coverage only. Scripts and raw rows:
`~/sofort-local-evidence/scriptc-compile-2026-10-30/` (not in git).

## Results

| | Result |
|---|---|
| Build succeeds | 25/25 |
| Correct answer, same bytes as Node | **18/25** |
| Build, program never seen before | **1.4–2.9 s** (3 fresh T3 rebuilds: 2.2–2.7 s; `--emit obj` alone is the same, so linking is negligible) |
| Build, same source again (cache hit) | 0.1–0.2 s |
| Executable size | 660–970 KiB |
| Run, after the first launch | 7–18 ms (T1, T3, T5), 32–44 ms (T2), 190–265 ms (T4); Node: 47–110, 96–141, 255–330 ms |
| First launch of each new binary | 0.2–0.7 s, macOS checking a new executable; the empty program shows it too (0.41 s, then 0.00 s) |

Run times include loading the replay file (T4: 22 MB of responses), so they
measure the wrapper as much as the program. Node's include its ~40 ms startup.

## The 7 failures

All 7 build without error and then stop at runtime with exit 2. Node runs the
same files correctly.

| Program | Runtime error | Reported by `scriptc coverage`? |
|---|---|---|
| t1-p1, t1-p4, t4-p2 | `localeCompare is not a function` on untyped values | **No**: 100% static, 0 deferred sites |
| t2-p2 | `Promise.all` over a tuple of promises (SC2020), and `.map`/`.filter` on the result | Yes, 5 deferred sites |
| t2-p4 | `PromiseFulfilledResult.value` (`Promise.allSettled`) (SC2020) | Yes |
| t4-p1 | `.sort()` with no comparator (SC2020) | Yes |
| t5-p4 | tuple vs array shape mismatch (SC2002) | Yes |

`coverage --fail-on blockers` exits 0 for all of them: deferred sites are not
blockers. A gate would have to fail on any deferred site, and would still miss
the `localeCompare` case.

## What it means for a scriptc tier

- **Not for one-off agent code.** A 1.4–2.9 s build per new program is far
  slower than a QuickJS run (0.15–0.28 ms on HVF), and the cache only helps
  when the same source comes back.
- **Fits registered tools.** Built once, the programs run 1.1–7× faster than
  Node end to end here.
- **"Builds" does not mean "runs".** 28% of real model-written programs fail at
  runtime. Each one would need a Node differential check before it is accepted,
  which is what GrowOS qualification already does for kernel handlers.

## scriptc 0.4.6

0.4.6 (published 2026-10-29; the pin is still 0.4.5) was tried in a scratch
install on the 7 failures. It fixes t2-p2 (`Promise.all` over a tuple; its
output now matches Node). The other 6 fail exactly as on 0.4.5.
