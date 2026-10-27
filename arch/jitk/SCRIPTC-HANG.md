# scriptc 0.4.5: lost child-exit wakeup (hang in `scr_children_wait`)

Local finding; nothing filed upstream. Measured on the Mac (macOS 26.6.1,
M-series 8P+4E, scriptc 0.4.5 from `tools/package-lock.json`).

## Symptom

A scriptc executable stops in its event loop while its child is already a
zombie:

```
main → scr_loop_run+2884 → scr_children_wait+204 → kevent
```

Three field cases: `docs/.work/bin/test_receipts` (stuck on its first spawn,
`node build.mjs`), `kernel/.work/bin/build-checks` (rustc / test binary) and a
grow phase-2 profile-prep `docker image inspect`. The stall lasts until the
next timer deadline: the old `lib.ts` `capture` kill timer, 1800 s for the
first two and 180 s for grow (which then reported rc=0, complete stdout
**and** `timeout: true`). Field samples are local only, in
`~/sofort-local-evidence/scriptc-child-wait-hang-2026-10-26/`.

## Mechanism

Runtime source: `packages/runtime/src/scr_child.c` (`scr_child_watch`,
`scr_children_wait`, `scr_children_poll`) and the loop in `scr_async.c`, tag
v0.4.5.

- Every spawned child gets a kqueue `EVFILT_PROC` / `NOTE_EXIT` filter with
  `EV_ONESHOT`. When children are the only pending work, the loop sleeps in
  `kevent` with the timeout set to the next timer deadline, or to
  `SCR_IO_POLL_MS` (1000 ms) when no timer exists.
- Returned events are discarded: they are wakeups only. The `waitpid(pid,
  WNOHANG)` sweep on the next loop turn is the only reaper.
- XNU posts `NOTE_EXIT` from `proc_exit` slightly before it marks the child
  `SZOMB`. If the parent wakes and sweeps inside that window, `waitpid`
  returns 0. The one-shot filter is gone and nothing else is pending, so
  the next `kevent` sleeps until the next deadline.

So a lost wakeup costs "time to the next timer deadline". The starting
hypothesis, unbounded sleep with no timer, is not what 0.4.5 does: with no
timer pending the idle wait is capped at 1 s, and the lost wakeup is a ~1 s
stall that heals itself. The hang needs a far-off timer. The old `capture`
helpers created exactly that: a 1800 s (or 180 s, 600 s) kill timer per
child.

A throwaway C probe (outside Git) checked the kernel side: `posix_spawn`,
wait for `NOTE_EXIT`, then immediately `waitpid(WNOHANG)`. The sweep missed
in 1/20,000 for `/usr/bin/true`, 3/10,000 with `POSIX_SPAWN_SETSID` (scriptc's
`detached: true`), 2/2,000 for a child that leaves a live grandchild, and
0/10,000 under 24-way CPU load. An idle core lets the parent wake inside
the window.

## Repro

`tslib/stress/child-wait.ts` spawns children one at a time and awaits each
`close`. `tslib/stress/driver.ts` reruns it and treats a progress file that
stops moving for 5 s as a hang. It records `ps` state (subject `Ss`, child
`Z`), takes a `sample`, then kills the subject. Modes:

| mode | per child | a lost wakeup costs |
| --- | --- | --- |
| `raw` | spawn + await close, no timer | ~1 s (idle cap) |
| `far` | plus an 1800 s kill timer (old `capture`) | 1800 s: a hang |
| `track` | `far` with the timer replaced by `tslib` `track()` | ≤ 50 ms |
| `tslib` | `tslib/process.ts` `spawnCapture` end to end | ≤ 50 ms |

Settings: sequential, `detached: true` (own session, like every helper),
piped stdio, `/usr/bin/true`, no added load, 5000 spawns per subject run.

```sh
make -C arch/jitk/tslib stress \
  STRESS_ARGS='--modes far,track --runs 20 --count 5000 --concurrency 1 --load 0 --extra "--detached 1"'
```

Results (2026-10-27; three driver runs, sequential, no added load):

| mode | spawns | hangs | lost wakeups seen | slowest batch | ms/spawn |
| --- | ---: | ---: | --- | ---: | ---: |
| raw | 50,000 | 0 | 4 stalls of ~1 s | 1004 ms | 1.42 |
| far (before) | 124,923 | **7** (all `Ss` + zombie child) | 7 hangs | ∞ (killed at 5 s) | 1.40 |
| track (after) | 100,000 | **0** | 12 batches 20–52 ms | 52 ms | 1.39 |
| tslib (after) | 200,000 | **0** | 24 batches 20–52 ms | 52 ms | 1.43 |

Before: 7 hangs in 124,923 spawns, about 1 in 18,000 (5.6e-5). After:
0 in 300,000 (95% upper bound 1e-5); the 20–52 ms batches are the same
lost wakeups, healed by the next keepalive tick. Each `far` hang matched the
field signature: subject state `Ss`, a `Z` child, and `sample` showing
`main+236 → scr_loop_run+2884 → scr_children_wait+204 → kevent`. Raw's 1 s
stalls (8e-5) show the same race without a far timer.


## Workaround

`tslib/process.ts` `track(child, timeout)`, used by every spawn in arch/jitk
tooling: `spawnCapture` (behind each component's `capture`/`run`),
`StreamProcess`, vmm's `Session`, and the long-lived children in kernel,
executor, shard and grow tests.

- While any tracked child runs, a single `setInterval(() => {}, 50)`
  exists. The last child's `close` clears it, and a spawn that failed
  without a pid also releases it.
- Every tracked child has an overall deadline. At expiry its process group
  is killed (SIGKILL), after the caller's `onTimeout` hook (scriptc-corpus
  samples the child first).

## Why it works

The interval is a pending timer, so `scr_children_wait` is always called
with a timeout of at most 50 ms. A lost `NOTE_EXIT` is no longer followed by
a sleep to a far deadline. The next 50 ms tick returns from `kevent`, and
the loop turn after it runs the `WNOHANG` sweep, which reaps the child. By
then it is long past `SZOMB`. The wakeup is still lost; it now costs at most
one tick. Clearing the interval with the last child keeps the loop's
liveness unchanged: an idle program still exits, and a program waiting only
on children never runs an empty timer after they settle. The overall
deadline covers a child that really hangs.

## Overhead

- Short children: `track` 1.39 ms/spawn vs `far` 1.40 ms/spawn over
  100,000 spawns each, no measurable difference. `tslib` (`spawnCapture`,
  buffers and promises included) is 1.43 ms.
- Long children: 20 extra loop wakeups per second while a child runs. With
  `/bin/sleep 5` ×2 (10 s), `/usr/bin/time -l` shows CPU time 0.00 s for
  both, about 210 more involuntary context switches, 3–4 M more instructions
  and ~5 M more cycles: about 0.02% of one core.
- None while no child runs: the interval exists only between the first spawn
  and the last close.


## Upstream-ready summary

**macOS: a child's exit can be missed until the next timer deadline (hang in
`scr_children_wait`)**

- scriptc 0.4.5, macOS 26.6.1 arm64.
- Repro: spawn `/usr/bin/true` (`detached: true`, piped stdio) sequentially
  while a far-off timer (e.g. 30 min) is pending, awaiting each `close`.
  About 1 in 18,000 spawns (7 in 124,923), the process sleeps in
  `scr_loop_run → scr_children_wait → kevent` with the child a zombie until
  the timer fires. With no timer the same miss is a 1 s stall
  (`SCR_IO_POLL_MS`). Corpus test 8401-style programs (300 children, one far
  timer) fail in only ~2% of runs at this rate.
- Cause: `NOTE_EXIT` is `EV_ONESHOT` and is drained and discarded by
  `scr_children_wait`. XNU posts it before the child is reapable, so the
  following `waitpid(WNOHANG)` sweep can miss, and nothing re-arms the wakeup.
- Expected: `close` within milliseconds of the exit, as in Node.
- Suggested fix: when a drained `NOTE_EXIT` names a child the next sweep does
  not reap, keep that child on the ~1 ms polling cap until it is reaped
  (treat it as unwatched), or retry `waitpid` briefly after the event.
- Application workaround: a ≤ 50 ms repeating timer while children run.
