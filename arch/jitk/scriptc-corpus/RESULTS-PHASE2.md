# scriptc 0.4.5 corpus on the phase-2 grown kernel

Measured 2026-10-27 on macOS arm64/HVF, same corpus, compiler, Linux and Node
references as [`RESULTS.md`](RESULTS.md) (the "before" column below). The
grown kernel is the canonical kernel tree at this commit plus eight handlers
grown by the loop (mmap, getrandom, uname, getpid, getppid, faccessat,
getpriority, sysinfo; [`../grow/phase2-grown/`](../grow/phase2-grown/)).
The canonical kernel tree includes the human placement change; its built
image is still byte-identical to the READY image. How the handlers were
grown: [`../grow/EXPERIMENTS-PHASE2-2026-10-27.md`](../grow/EXPERIMENTS-PHASE2-2026-10-27.md).

Method: `census rerun --from full --kernel <grown> --selection visible|heldout`
re-evaluates every compiled program on jitk only. It rebuilds each ELF and
compares jitk's stdout, stderr and exit with the stored Linux result of the
census. Under the jitk link layout the rebuilt ELF must hash to the census
ELF. **180 programs (148 visible, 32 held-out) fail that check:** they embed
their absolute source path (`__filename`, `import.meta.url`, dynamic
self-imports), and the census ran in another checkout. They are excluded from
the like-for-like rates; lower bounds count them as not passing. 2 of them
passed before.

## Headline

**3,198 of 3,947 comparable compiled programs (81.0%) now run byte-identical
to Linux on the grown kernel, up from 159 (4.0%). T1+T2: 3,163 of 3,645
(86.8%), up from 158 (4.3%).** Lower bound over all 4,127 compiled programs:
3,198 (77.5%), up from 161 (3.9%). 3,176 of the passes also match Node.
There are no regressions among comparable programs.

| Split | Comparable compiled | Pass before | Pass after | T1+T2 before | T1+T2 after |
|---|---:|---:|---:|---:|---:|
| visible | 3,155 | 125 (4.0%) | 2,554 (81.0%) | 124 / 2,910 (4.3%) | 2,523 / 2,910 (86.7%) |
| held-out (trusted gate) | 792 | 34 (4.3%) | 644 (81.3%) | 34 / 735 (4.6%) | 640 / 735 (87.1%) |

Visible and held-out agree within 0.4 points, so the grown handlers are not
fitted to visible programs. The proposer never saw corpus programs or
results; integration gates saw visible results only as pass/fail counts,
held-out results never.

### Per tier

| Tier | Visible before | Visible after | Held-out before | Held-out after |
|---|---:|---:|---:|---:|
| T1 | 119 / 2,608 (4.6%) | 2,321 (89.0%) | 33 / 653 (5.1%) | 586 (89.7%) |
| T2 | 5 / 302 (1.7%) | 202 (66.9%) | 1 / 82 (1.2%) | 54 (65.9%) |
| T3 | 0 / 75 | 16 (21.3%) | 0 / 24 | 3 (12.5%) |
| T4 | 1 / 170 (0.6%) | 15 (8.8%) | 0 / 33 | 1 (3.0%) |

## Which change unlocked how many programs

Each newly passing program is attributed to the changes it exercised: the
placement fix (it was a loader refusal), the grown mmap (the old kernel gave
its allocator EINVAL for a hint), and each grown syscall its Linux run used
that the old kernel lacked.

| Change | Kind | Visible: exercised / alone | Held-out: exercised / alone |
|---|---|---:|---:|
| mmap hint semantics | grown (74 lines) on 55 human helper lines | 2,393 / 2,342 | 590 / 582 |
| image placement bound | human (packer) | 33 / 33 | 17 / 17 |
| getrandom | grown (43) | 48 / 2 | 11 / 3 |
| faccessat | grown (24) | 5 / 0 | 0 / 0 |
| uname | grown (24) | 1 / 0 | 0 / 0 |
| sysinfo | grown (26) | 1 / 0 | 0 / 0 |
| getpid, getppid, getpriority | grown (4, 4, 19) | 0 | 0 |

Newly passing: 2,429 visible + 610 held-out = 3,039. The combinations are
mmap alone 2,924, mmap+getrandom 54, placement alone 50, getrandom alone 5,
mmap+faccessat 5, and uname+sysinfo 1. getpid, getppid and getpriority unlock
nothing on their own yet: programs that call them still stop at another
blocker, or tolerated the ENOSYS before.

## Unmodified (stock) link layout

With the new placement bound the packer admits scriptc's stock ELFs (base
0x1000000); before, it refused all 4,127. The same grown kernel, stock ELFs,
compared with the census's Linux result for the relinked ELF (the two differ
only in image base):

| Split | Comparable | Pass (stock link) | Pass (jitk link) |
|---|---:|---:|---:|
| visible | 3,155 | 2,312 (73.3%) | 2,554 (81.0%) |
| held-out | 792 | 576 (72.7%) | 644 (81.3%) |

Together: 2,888 of 3,947 comparable programs (73.2%) pass as unmodified stock ELFs (before: 0, all refused by the packer); T1+T2 2,857 of 3,645 (78.4%). No regressions.

The stock layout passes fewer programs because the 12 MiB of zero padding
below the image comes out of the 32 MiB guest's mmap arena (about 11 MiB
left instead of about 22 MiB). Held-out: 79 stock-layout programs abort after
mmap ENOMEM, and 67 of them pass with the relinked layout. Reclaiming the
padding for mmap needs munmap to refuse image and archive pages (a kernel
change, not made). The `zig-link.sh` relink (`-Wl,--image-base=0x400000`,
pinned by hash in every census manifest) remains the recommended build step.

## What still fails (comparable programs, grown kernel, jitk link)

| First cause | Visible | Held-out | Notes |
|---|---:|---:|---|
| stdout-control-byte | 211 | 50 | printable-ASCII stdout protocol (unchanged, by design); was 22 before mmap let these programs run |
| missing: epoll_create1 | 78 | 15 | T3/T4 event loops, Phase 3 |
| mismatch | 72 | 21 | complete runs with different bytes; not triaged in this round |
| missing: pipe2 | 68 | 16 | E4: needs an fd + buffer object |
| missing: mkdirat | 67 | 19 | programs expect a writable cwd; a read-only EROFS handler would not help |
| abort | 49 | 6 | all 55 saw an mmap ENOMEM before abort() (passing programs also get ENOMEM from the 40 GiB probe, so not proven causal) |
| missing: nanosleep | 7 | 0 | profile had no held-out case (generator gap) |
| missing: mprotect | 2 | 0 | E4 |

Ranked remaining missing syscalls among non-passing programs: epoll_create1,
pipe2, mkdirat, nanosleep, mprotect, socket, getuid/getgid. The 261
stdout-control-byte programs are the next largest single class. They need
byte-exact stdout framing in the transport, not a syscall.

## Reproduction

```sh
make -C arch/jitk/grow build build/phase2
arch/jitk/grow/build/phase2 assemble --accepted arch/jitk/grow/phase2-grown --out /tmp/grown-kernel
make -C arch/jitk/scriptc-corpus rerun ARGS="--from full --id grown-visible --kernel /tmp/grown-kernel --selection visible --workers 3"
make -C arch/jitk/scriptc-corpus rerun ARGS="--from full --id grown-heldout --kernel /tmp/grown-kernel --selection heldout --workers 3"
make -C arch/jitk/scriptc-corpus .work/bin/phase2-report
arch/jitk/scriptc-corpus/.work/bin/phase2-report --before full --run grown-visible=grown-visible --grown mmap,getrandom,uname,getpid,getppid,faccessat,getpriority,sysinfo
```

`assemble` ignores the GROWN.json file in that directory (it copies `*.rs`).
The rerun needs the local census journal (`.work/full.jsonl`) and source
snapshot; held-out runs need the private split seed. Per-program artifacts
are deleted after each row. Journals and summaries stay in ignored `.work/`.
Each full rerun took about 70 minutes with 3 workers next to other runs.
