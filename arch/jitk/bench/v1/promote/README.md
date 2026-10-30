# Promotion gate (prototype)

A program runs first on QuickJS. If it comes back, scriptc compiles it in the
background, and the native binary is promoted only if, replayed against every
recorded first-tier run, it makes the same tool calls and returns the same
bytes. Anything else keeps the program on QuickJS. Background:
`results/2026-10-30-scriptc-compile.md`.

```sh
node bench/v1/tasks/materialize.ts
node bench/v1/promote/record.ts                # one recorded run per task program
node bench/v1/promote/gate.ts --selftest       # build, replay, verdicts.json
```

`SCRIPTC` overrides the pinned compiler (`arch/jitk/tools`), for worktrees
without their own install. Work files go to `bench/v1/.work/promote/`:
recordings, binaries keyed by entry source and scriptc version (a repeat
program is a cache hit; a compiler bump rebuilds), and `verdicts.json`.

## What the gate checks

- **Calls**: the same multiset of canonical call keys as the recording. Calls
  a program starts together may be issued in a different order.
- **Result**: `JSON.stringify(result ?? null)` byte for byte.
- **Replies**: only those the recorded run received. An extra call fails as
  unrecorded, so a promoted binary can't reach a tool the first run didn't.
- **Version**: recordings of a different program text (sha256) don't count.
- `--selftest` checks that a tampered result, a missing reply and an extra
  recorded call are all rejected.

## First result (2026-10-30, scriptc 0.4.5)

18/25 promoted. The 7 kept on the first tier are the 7 runtime failures in
`results/2026-10-30-scriptc-compile.md`, including the 3 `localeCompare` ones
that `scriptc coverage` doesn't report. Self-test passed.

## What this prototype doesn't do yet

- **The first tier is Node**, not QuickJS: `record.ts` replays the task data
  through `tasks/lib/tasks.ts` `runProgram`. Real recordings would come from the
  executor's dispatcher, after the protocol work on large host replies lands.
- **One recording per program.** Every bench task has one dataset, so
  `--min-runs` above 1 can't be met by distinct runs yet.
- **Native on the host**, not in a jitk guest; that needs the scriptc runtime
  pack for jitk.
- **No payoff measurement**: guest CPU per program on QuickJS vs native.
