# Recorded Linux oracle runs: Docker Desktop vs Linux (2026-10-31)

Kernel promotion replays recorded Linux runs on the Mac (`JITK_ORACLE=replay`,
`grow/oracle-store.ts`, `kernel/tests/fixtures/fs/linux`); CI's `oracle` job
reruns them on GitHub's ubuntu-24.04-arm runner (`make ci-oracle`), and the
`oracle-record` workflow re-records them there.

## What changed when the references moved to a Linux host

The first recordings came from `jitk-oracle:08` under **Docker Desktop on the
Mac**, and fs_diff ran its container **as root**. Re-recorded on the Linux
runner (run 41201631336), with both oracles running the payload as uid 65534:

| reference | change |
|---|---|
| fs_diff Lua, QuickJS | none |
| fs_diff probe | `O_WRONLY`, `O_RDWR`, `O_ACCMODE 3` on 0444 files: EACCES (was EROFS; mode 3 had opened); `accmode 3 lseek` EBADF |
| grow fstat probe | `O_ACCMODE 3` open fails, so `unreadable-metadata` is EBADF (was 0) |
| grow pread64 probe, 13 SQLite runs | none |

Why: for a non-root caller Linux checks file permission before the
read-only mount, so writes to 0444 files are EACCES; only `O_TRUNC` (and
`O_CREAT`) reach the mount check (EROFS). `O_ACCMODE 3` asks for read and
write permission. Root skips the permission check, and Docker Desktop's file
sharing let mode 3 open: both had shaped the old references, and the kernel's
`openat` matched them.

## What was fixed

- The guest is unprivileged: `openat` returns EROFS for `O_TRUNC` and
  EACCES for any write access mode on archive files (kernel/src/syscalls/openat.rs),
  re-verified by `refresh-contracts`.
- The kernel harness and grow's trusted host tests expect the same
  (`grow/host-tests-origin.json` records the amendment).
- The oracle no longer mounts a tree's `dev/` over the container's `/dev`
  (runc on Linux refuses a non-device `/dev/null`).
- Two CI-side bugs found on the way: mount modes are not kept by git (now in
  `mounts.modes.json`), and a downloaded payload has no exec bit (oracle-verify
  runs an executable copy; record refuses runs where strace itself failed).

Both CI oracle steps (grow and fs_diff) are hard steps again. The two sealed
held-out recordings are still Docker Desktop recordings, checked locally only.
