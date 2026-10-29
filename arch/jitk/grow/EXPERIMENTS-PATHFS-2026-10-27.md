# GrowOS path syscalls on a shared file tree — 2026-10-27

In Phase 2 ([`EXPERIMENTS-PHASE2-2026-10-27.md`](../docs/results/grow-phase2-2026-10-27.md))
the grown chdir, unlinkat, mkdirat and statfs passed every gate but were left
out of the grown kernel as overfit. The Linux reference ran on the
`jitk-oracle:08` container's filesystem, not on the file tree jitk shows the
guest. This round makes the oracle run on the guest's tree, makes the
comparison fail closed on the tree hash, regrows those four syscalls with the
unchanged gates and reruns the corpus census.

All grow runs used `--validate-only`. `grow/release.json`, `grow/.READY` and
`kernel/.READY` were not written. `jitk-oracle:08`
(`sha256:88f8f82b…0d0a`) was not rebuilt, retagged or deleted, and no new
image was built. Nothing was pushed. Raw receipts:
`~/sofort-local-evidence/growos-pathfs-2026-10-27/`.

## Result

| | Visible | Held-out |
|---|---:|---:|
| Phase 2 grown kernel (baseline) | 2,554 / 3,155 (81.0%) | 644 / 792 (81.3%) |
| Path-FS grown kernel, same programs (3,154 / 792 comparable in both) | 2,554 / 3,154 (81.0%)¹ | 644 / 792 (81.3%) |
| Newly passing | 1 (statfs) | 0 |
| Regressions | 0¹ | 0 |
| T1+T2 | 2,523 / 2,909 (86.7%)¹ | 640 / 735 (87.1%) |

¹ The full rerun scored 2,553: `8165-rsa-keygen-lengths.cjs` (no path
syscalls) came out as a mismatch once and passed on a recheck on both the new
and the Phase 2 kernel, so it is flaky, not a regression.
`array-length-limits.ts` (a pass in Phase 2) now rebuilds to an ELF that differs
from the census ELF on either kernel. It is an `elf-drift` row and is left out
of both columns, which is why there are 3,154 programs, not 3,155.

The honest oracle unlocks **one** corpus program, and nothing in held-out. All
three path handlers in the new kernel are general. They resolve paths through
the archive's `fs::lookup` instead of matching names. The corpus gain is small
for a simple reason: the corpus programs that call these syscalls want to
**write** (`mkdir` under `/tmp` or the cwd). An exact read-only implementation
cannot help them (§5).

The 261 stdout-control-byte programs (211 visible, 50 held-out) are unchanged
and remain **blocked by the stdout rule (by design)**. The printable-ASCII
stdout rule in `protocol/PROTOCOL-v1.md` was not changed.

## 1. How each side sees the filesystem (measured)

**jitk guest.** `kernel/build.sh` packs `JITK_RESOURCES` (a directory) with
`packer.ts archive()` into a `JITKFS01` archive. `prepare.ts` places it after
the ELF and records `packed.resources.sha256`. It is the guest's whole `/`. It
is read-only (there is no write path, and the kernel alias is RO). Files report
mode 0444, directories 0555, uid/gid 0, times 0. `fs::lookup` resolves
`AT_FDCWD` and relative paths from `/` (cwd is always `/`; `getcwd` returns
`"/"`). `..` at `/` stays at `/`. With `create`, a missing final component maps
to EROFS. There is no `/tmp`, `/proc` or `/dev`. Grow probes pack
`resources/ = { data.bin }`, which is the 8192-byte census database. Corpus
guests (`scriptc-corpus/guest.ts`) pack **no** resources, so their tree is an
empty `/`.

**Old oracle (`grow/oracle.ts`).** `docker run --rm -i --platform linux/arm64
--network none --read-only --cap-drop ALL --security-opt no-new-privileges
--pids-limit 16 --memory 512m --cpus 1 --user 65534:65534 --tmpfs
/tmp:rw,noexec,nosuid,size=16m`, with `/payload`, `/oracle`, `/out` (rw) and
`/oracle-profile` bind-mounted, and each resource bind-mounted as `/<name>:ro`.
The entrypoint is `/oracle-profile`. It runs `strace -f -qq -v -X raw -xx -s
1048576 -- /payload` with cwd `/` (image WorkingDir), env `PATH LC_ALL LANG TZ`
and optionally `ulimit -v 32768`. So the payload saw the Alpine root, its own
`/payload`, a **writable `/tmp`** and `/out`. The census Linux reference
(`scriptc-corpus/oracle.ts`) is different again: a fresh **writable** cwd with
links to `tests/`, `node_modules/` and `package.json`, `HOME=/tmp`, and a 128 MiB
`/tmp` tmpfs.

## 2. Shared tree (method)

* `OracleOptions.tree = <resources dir>` makes `oracle.ts` pack that directory
  exactly as `prepare.ts` does. It then materialises the archive
  (`packer.ts unpack`: files 0444, directories 0555, unsafe names refused) and
  checks that the result **re-packs to the identical bytes**. It writes
  `tree.json` (archive SHA-256, entries, bytes, launcher hash).
* The tree is bind-mounted read-only at `/jitk-root` in the unchanged image,
  together with `oracle-root`, a static aarch64 musl C launcher, 31 lines, built
  by `make build`. strace runs `oracle-root /jitk-root /payload /payload …`. The
  launcher opens the payload, `chroot`s into the tree, sets cwd `/`, sets
  `setgroups(0)`, `setgid/setuid(65534)`, verifies the drop, then calls
  `execveat(fd, "", AT_EMPTY_PATH)`. The payload's view is exactly the archive:
  no `/payload`, `/tmp`, `/proc` or `/dev`, and writes fail with EROFS, as in
  jitk.
* To allow the chroot, that container runs as uid 0 with `--cap-drop ALL
  --cap-add SYS_CHROOT --cap-add SETUID --cap-add SETGID` and keeps
  `no-new-privileges`, `--read-only`, `--network none` and the pid/memory/CPU
  limits. The payload never holds a capability. `oracle-profile` splits the
  launcher prelude off the trace at the payload's `execveat` (kept as
  `linux-NN.launcher.strace`). If that exec did not succeed, the run fails, so
  a launcher failure is never read as a payload result.
* **Fail closed.** `phase2 prepare` calibrates both splits on the shared tree
  and requires both calibrations to report the same tree. It seals `tree.json`
  in `plan.hashes` and stores `fixture.tree` and `oracle_fs` in `plan.json`.
  `phase2 one` refuses a profile without them. Before every graded guest run
  (30 visible runs, held-out, both mutants) and in `replay`, it checks that the
  built image's `packed.resources.sha256` equals the fixture's tree hash. If
  not, it refuses to compare. `batch` pins `oracle_fs`, the launcher hash and
  every target's trees, and refuses resumes that change them. Here both splits
  of all four targets pinned
  `3e345678891be516906e2e0454887689116ac0fc391bf6c51dddd5cd9cda5a62`.
* Unchanged: seed-trace collection (shapes only), the SQLite 10/10
  integration, the corpus integration gates, the held-out split, the two
  wrong-return mutants and 30 visible runs.

Two further changes were needed. Neither touches a gate:

* **Generator** (`autoprofile.ts`): statfs seeds print a failed call's output
  buffer as the seed process's raw stack address (`0xffff…`). Copied verbatim,
  Linux sometimes found the probe's own stack at that address. One shared-tree
  calibration returned 0 and the other EFAULT, and `learn` correctly refused
  the profile as nondeterministic. In v5 both calibrations happened to give
  EFAULT. Scalars ≥ 2^40 that remain after the mmap rebinding are now treated
  as the output buffer they were, plus the usual invalid-address variants. Only
  the statfs profile changes: 36/18 → 15/7 cases. The other four profiles are
  byte-identical to Phase 2's v5.
* **Prompt** (`agent.ts`): fstat, pread64 and faccessat already received
  `fs.rs` (the archive API). chdir, mkdirat, unlinkat and statfs did not, so the
  only way to answer was to special-case names. They now receive it too.

## 3. What the shared tree changes

Old vs new Linux expected outputs on identical probes:

| Target | Cases (vis/held) | Expected lines changed | Phase 2 handler, replayed on the new profile |
|---|---:|---:|---|
| mkdirat | 33/16 | 17 / 7 (e.g. `mkdir /tmp/…` 0 → ENOENT) | **REJECT/REJECT** (it faked a writable `/tmp`) |
| unlinkat | 23/11 | 0 | PASS/PASS |
| chdir | 6/2 | 0 | PASS/PASS |
| statfs | 15/7 (new) | — | PASS/PASS |
| faccessat (Phase 2 grown) | 22/10 | 0 | PASS/PASS |

The shared tree removes the container-filesystem gap, and it is what exposes
the overfit mkdirat. It is not enough on its own. Both splits still run on the
same `{ data.bin }` tree. The probes' path variants (`/`, `/data.bin`,
`data.bin`, a missing name, the seed's `/tmp/…` paths) are the same, so a
handler that hard-codes `data.bin` (Phase 2's chdir) still passes the sealed
held-out probe. For path outputs the generator compares written/not written,
not the bytes (fstat-like outputs describe a filesystem), so statfs constants
copied from the oracle host also pass.

**Tree-variant audit** (`prepare --heldout-tree variant`, used only with
`replay`, never as a batch gate). The held-out split is calibrated on a
different archive: `data.bin/` becomes a directory holding the database, with an
empty directory beside it. Expected values are still learned from Linux on that
tree. Results:

| Handler | Gates (batch) | Tree-variant audit (vis/held) |
|---|---|---|
| Phase 2 chdir (name literals) | accepted in Phase 2 | PASS/**REJECT** |
| Phase 2 mkdirat | accepted in Phase 2 | REJECT/REJECT |
| Phase 2 unlinkat (assumes a flat tree) | accepted in Phase 2 | PASS/PASS (still wrong under subdirectories; probes do not reach them) |
| Phase 2 statfs (host constants) | accepted in Phase 2 | PASS/PASS |
| new chdir, mkdirat, statfs | accepted | PASS/PASS |
| new unlinkat | accepted | PASS/**REJECT** |

## 4. Regrowth (unchanged gates)

`pathfs-20261027` ran `phase2 batch --validate-only` with `codex-cli 0.164.0`,
`gpt-6.1-sol`, spec `none`, ≤3 attempts and N = 1 per target, on top of the
eight Phase 2 handlers. Per-attempt rows:
[`experiments/PATHFS.csv`](experiments/PATHFS.csv). Handlers:
[`pathfs-grown/`](pathfs-grown/).

| Target | Result | Attempts | Gates | Corpus sample: visible new / held-out new | Lines | Tree audit | In kernel |
|---|---|---:|---|---:|---:|---|---|
| statfs | accepted | 2 | 30/30, held-out, 2/2 mutants, SQLite 10/10, 0 regressions | 1 / 4, 0 / 0 | 22 | PASS/PASS | yes |
| unlinkat | accepted | 1 | same | 0 / 92, 0 / 30 | 23 | PASS/REJECT | **no** |
| mkdirat | accepted | 1 | same | 0 / 78, 0 / 25 | 9 | PASS/PASS | yes |
| chdir | accepted | 1 | same | 0 / 17, 0 / 5 | 13 | PASS/PASS | yes (caveat) |

What was accepted, and why it is or is not right:

* **mkdirat** (9 lines): `fs::lookup(dirfd, path, create)`. An existing entry
  gives EEXIST. A missing final component gives EROFS. Otherwise the lookup
  error is returned (ENOENT/ENOTDIR/ENAMETOOLONG/EFAULT). This is Linux's order
  on a read-only mount (`filename_create`: parent lookup, then EEXIST, then
  EROFS). It is a correct read-only mkdirat.
* **statfs** (22 lines): resolves the path through `fs::lookup` (ENOENT/ENOTDIR/
  EFAULT exact), then copies out a fixed `struct statfs`. That struct holds the
  oracle bind mount's values (`f_type 0x6a656a63`, 1 MiB blocks, `ST_RDONLY`…).
  The gate checks only that it was written. Path semantics are real. The
  contents are environment emulation, like uname and sysinfo in Phase 2: there
  is no "true" statfs for a packed archive.
* **chdir** (13 lines): resolves the path (directory → 0, file → ENOTDIR,
  errors exact) but **cannot change the cwd**. `fs::lookup` always resolves
  relative paths from `/`, and a one-file handler cannot add cwd state to
  `fs.rs`. It is exact for any archive whose only directory is `/`, which
  includes every corpus guest (empty archive). It silently does the wrong thing
  after `chdir` into a subdirectory. Probes cannot see this, because they never
  observe a relative lookup after chdir. A real chdir needs an `fs.rs` change
  (E4, multi-file).
* **unlinkat** (23 lines): general lookup-based code, but it returns EISDIR for
  every directory with flags 0. Linux on a read-only mount returns EROFS for a
  non-root directory (`mnt_want_write` comes before the type check) and EISDIR
  only for `/`. The tree-variant audit caught this, so it is excluded. It is
  correct for corpus guests, and including it would change no corpus result:
  its gate sample showed 0 new passes.
* Phase 2's four excluded handlers stay excluded (§3).

Failure classes: statfs attempt 1 was refused by the CLI's content filter
(`"flagged for possible cybersecurity risk"`, rc 1). It counts as an attempt.
Attempt 2 was accepted. There were no model errors, controller bugs or
child-wait stalls.

Cost: 5 codex calls (one filtered), 369,678 input and 1,045 output tokens (280
reasoning), as reported by the CLI. Grown lines added to the kernel: 44
(statfs 22, mkdirat 9, chdir 13). Grown kernel total: 262 lines in 11 handlers.
Human/agent lines (all by this implementation agent) are controller/tooling
only, with no kernel Rust: `packer.ts` unpack 47, `oracle-root.c` 31, oracle,
phase2, autoprofile and agent changes, tests, and corpus `writes`.

## 5. Census rerun and per-syscall unlocks

`census rerun --from full` was run on the assembled kernel (`phase2-grown/*.rs`
+ `pathfs-grown/*.rs`), with `--selection visible` and `--selection heldout`,
3 workers each.

| Change | Visible: newly passing | Held-out: newly passing |
|---|---:|---:|
| statfs (grown, path-honest) | 1 (`node24-fs-statfs-options.cjs`, alone) | 0 (no held-out program uses it) |
| mkdirat (grown, read-only exact) | 0 | 0 |
| chdir (grown) | 0 | 0 |
| unlinkat (not included; gate sample) | 0 | 0 |

What changed for the mkdirat-blocked programs (Phase 2 first cause
`missing:mkdirat`, 73 visible / 23 held-out including combinations): they now
reach the call and fail on its correct read-only answer.
`divergent:mkdirat:-2` (60 / 16) is `mkdir /tmp/…` where the guest has no
`/tmp`. `divergent:mkdirat:-30` (7 / 3) is a mkdir in the cwd, giving EROFS.
6 / 4 now stop at `prlimit64`/`sched_getaffinity` instead. This matches the
Phase 2 note: these programs need a writable cwd or `/tmp`.

## 6. Writable cwd: what it would take (design note, not implemented)

Measured with `census writes` (new, Linux only). It reran, in the census
environment, every program the Phase 2 grown kernel failed whose census Linux
run used a mutating path call, and summarised each trace (`writes.ts`). There
were 93 visible and 31 held-out programs. No passing program uses one.

| | Visible (93) | Held-out (31) |
|---|---:|---:|
| first cause mkdirat | 73 | 23 |
| of these, nothing missing but filesystem-write calls² | 50 | 16 |
| create directories / files / remove | 75 / 86 / 89 | 24 / 30 / 29 |
| write only under `/tmp` / only cwd / both / elsewhere | 71 / 8 / 14 / 0 | 23 / 2 / 6 / 0 |
| bytes written through files: p50 / p90 / max | 10 B / 65 B / 1.03 MiB | 11 B / 47 B / 24 KiB |
| entries created: p50 / p90 / max | 3 / 11 / 308 | 4 / 11 / 1,609 |
| peak open files: p50 / max | 1 / 5 | 1 / 403 |
| leave entries behind at exit | 24 | 11 |

² The census-time absent set minus registered/tolerated calls and the
filesystem-write set. This is an upper bound on what a scratch filesystem alone
could unlock. The rest also need clone/execve/pipe2/mprotect and similar.

Calls these programs issue (programs per call, visible): `unlinkat` 89,
`openat(O_CREAT)` 86, `mkdirat` 75, `fchmodat` 10, `fchmod` 8, `ftruncate` 7,
`symlinkat` 7, `pwrite64` 5, `utimensat` 5, `linkat` 4, `renameat` 3, `fchown(at)`
3. Related reads: `lseek` 93, `openat` 93, `fcntl` 77, `newfstatat` 71,
`getdents64` 66, `fstat` 48, `faccessat` 34, `statx` 27, `getcwd` 17,
`readlinkat` 17, `chdir` 10, `statfs` 3, `fsync`/`fdatasync` 2. Errors they
expect from Linux include EEXIST (mkdir, link, symlink, open O_EXCL), ENOENT,
ENOTDIR and ENOTEMPTY.

Proposed semantics: a per-run **tmpfs-like scratch overlay** at `/tmp` and at a
writable cwd directory. It would be an in-guest RAM tree that starts empty on
every run, is never persisted and is never visible to the host. The read-only
archive stays where it is.

* **Layout**: archive stays `/` (read-only). Scratch is mounted at `/tmp` (85 of 93 visible
  programs write there, 71 only there) and at the cwd. That needs either the
  cwd to become a scratch directory (`/work`, with `getcwd` and relative
  `fs::lookup` following it, so real chdir state) or the archive root itself to
  get a writable overlay. Overlay-on-root is the larger change (whiteouts for
  unlink of archive files), and the measurements do not require it. Cwd writes
  occur in only 22/93 visible programs.
* **Limits**: a hard byte quota and entry count, failing with ENOSPC/EMFILE as
  Linux would. 1 MiB and 2,048 entries cover every measured program except one
  at 1.03 MiB. The quota must come out of the 32 MiB guest, whose mmap arena is
  ~22 MiB on the jitk link and ~11 MiB on the stock link, so a scratch heap
  competes with the grown mmap. The fd table needs to go beyond `MAX_FDS` = 64
  for one held-out program (403 open).
* **Syscalls**: mkdirat, unlinkat (+AT_REMOVEDIR), openat O_CREAT/O_EXCL/O_TRUNC
  and O_WRONLY/O_RDWR, write/pwrite64/ftruncate on scratch fds, renameat(2),
  linkat/symlinkat/readlinkat, fchmod(at)/fchown(at)/utimensat (metadata only),
  getdents64, newfstatat/statx/fstat with real sizes and modes, plus
  fsync/fdatasync as no-ops. A chdir that changes state is also needed.
* **Kernel shape**: this is not a one-file grow target. It needs a mutable node
  table, an allocator for file data and fd-entry kinds in `fs.rs`. That is E4
  (multi-file) work behind a human-written safe primitive, like the mmap helpers
  in Phase 2. Individual handlers could then be grown against the shared-tree
  oracle with a writable `/tmp` tmpfs mounted inside the chroot.
* **Oracle side**: the shared-tree launcher would mount nothing new. The
  container's tmpfs would be bind-mounted into the tree at `/tmp` (and the cwd)
  before the chroot, with the same size limit as the guest quota, so both sides
  still see one tree. The tree hash would then cover the read-only part only,
  plus the scratch mount points and size.
* **Expected gain**: at most 50 visible + 16 held-out programs. Some of these
  then hit other gaps (e.g. 72 mismatch programs were never triaged), so the
  real gain is lower.

## Limits

* The tree hash pins the archive bytes. It does not pin file ownership as the
  container sees it (a Docker Desktop bind mount shows host uid/gid), or the
  bind mount's `statfs`. Probes observe those only as written/not written.
* The batch gates still share one tree between visible and held-out. The
  tree-variant audit is a post-hoc check with a single variant. I applied it to
  decide what goes into the kernel; I did not add it as a gate. Passing it does
  not prove generality (Phase 2's unlinkat passes it).
* chdir is exact only while `/` is the only directory reachable (§4).
* Corpus guests run on an **empty** archive, while their Linux references ran
  with a writable cwd containing `tests/`, `node_modules/` and `package.json`.
  This round leaves that census measurement as it was. Programs that read
  fixtures or write files are measured as failing for this reason.
* N = 1 transaction per target. The faccessat grown in Phase 2 was replayed on
  the new profile (PASS/PASS) and on the audit (PASS/PASS), not regrown.
* Disk: 34 GiB free at start, 20 GiB at the lowest. Other work on the machine
  also used disk during this round. Every batch and rerun checks the 15 GiB
  floor. Corpus caches and kernel copies were pruned after the reruns. No
  Docker prune and no Docker restart. Containers are removed in `finally`.

## Reproduction

```sh
make -C arch/jitk/grow build build/phase2
grow=arch/jitk/grow/build E=/abs/evidence
$grow/phase2 prepare --profiles $E/profiles --traces $E/inputs/traces --fresh $E/inputs/fresh \
  --database /abs/demo.db --targets chdir,unlinkat,mkdirat,statfs,faccessat
$grow/phase2 prepare --heldout-tree variant --profiles $E/profiles-audit ...   # audit only
JITK_VMM_BINARY=/abs/jitk-vmm $grow/phase2 replay --target T --profiles $E/profiles-audit --out OUT --handler H.rs
# accepted/ pre-filled with phase2-grown/*.rs
$grow/phase2 batch --run-id pathfs-20261027 --validate-only --vmm /abs/jitk-vmm --profiles $E/profiles \
  --sqlite-elf /abs/sqlite3-static --database /abs/demo.db --targets statfs,unlinkat,mkdirat,chdir
mkdir K && cp arch/jitk/grow/phase2-grown/*.rs arch/jitk/grow/pathfs-grown/*.rs K/
$grow/phase2 assemble --accepted K --out /abs/grown-pathfs
make -C arch/jitk/scriptc-corpus rerun ARGS="--from full --id pathfs-visible --kernel /abs/grown-pathfs --selection visible --workers 3"
make -C arch/jitk/scriptc-corpus rerun ARGS="--from full --id pathfs-heldout --kernel /abs/grown-pathfs --selection heldout --workers 3"
arch/jitk/scriptc-corpus/.work/bin/census writes --from grown-visible --id writes-visible --workers 1
```

Seed traces are Phase 2's `p2-traces-20261027` (same content hashes, paths
rewritten). Comparisons against Phase 2 use its `grown-visible`/`grown-heldout`
journals. Held-out names and per-program results stay in the corpus `.work/`
and the local evidence directory.
