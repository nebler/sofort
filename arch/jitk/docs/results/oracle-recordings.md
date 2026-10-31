# Recorded Linux oracle runs: what CI found (2026-10-31)

Kernel promotion replays recorded Linux runs on the Mac (`JITK_ORACLE=replay`,
`grow/oracle-store.ts`), and CI's `oracle` job reruns them on GitHub's
ubuntu-24.04-arm runner (`make ci-oracle`).

## Result of the first CI runs

| recordings | outcome on GitHub Linux |
|---|---|
| fs_diff probe, Lua, QuickJS | **identical** (a8322c, e1cfb1, 3c454d) |
| grow pread64 probe | **identical** |
| grow fstat probe | one line differs: `semantic.unreadable-metadata` 0 recorded, -9 (EBADF) on Linux |
| grow SQLite integration and sqlite-checks (13) | exit 8 recorded vs exit 1, and some Docker errors |

## Why

The recordings were made by `jitk-oracle:08` under **Docker Desktop on the
Mac**. Bind-mounted files there keep the Mac's ownership mapping, and
Docker Desktop's runc accepted a tree `dev/` mounted over `/dev`. On a Linux
Docker host the payload user (65534) sees the runner's ownership, and runc
refuses a `/dev/null` that is not a device (fixed: the oracle no longer mounts
a tree's `dev/`).

So the reference was "Linux as Docker Desktop presents it", not Linux on a
real file system. The accepted fstat handler returns 0 for
`unreadable-metadata`, which matches Docker Desktop, not a Linux host: an
overfit to the reference environment that the gates could not see.

## Status and next step

- `oracle recordings (fs_diff)` is a hard CI step and passes.
- `oracle recordings (grow)` is report-only until the grow recordings are
  re-recorded on Linux (`JITK_ORACLE=record` in CI), committed, and the kernel
  is re-promoted against them. Handlers that only matched Docker Desktop then
  fail promotion and get fixed.
