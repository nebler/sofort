# Read-only resources: results (2026-10-24)

Raw data: `results-fs/`. Contended developer Mac (HVF), not a quiet-host claim.
The Linux numbers are nested (QEMU HVF → Linux 7.0 KVM): use them for function and memory only.

## Correctness
- `tests/fs_diff.py`: Linux oracle (Docker `jitk-oracle:08`, ro bind mount)
  versus 30 fresh jitk VMs each: raw-syscall probe 148 lines, Lua 13 lines,
  QuickJS 14 lines. Stdout was byte-identical 30/30 in each case, with no `missing`
  records. The bootstrap path (`std.loadFile`, `os.readdir`, write → EROFS) passed 3/3.
- kvm-dev (Ubuntu, Linux 7.0, KVM): a native chroot on an ext4 ro bind mount gave
  output identical to Docker for all three. Under the Linux VMM, jitk was 10/10 identical
  (patched) and 2/2 (stock). See `results-fs/linux-kvm-check.json`.
- Isolation probes `fs-user-read` (EL0 translation fault) and `fs-alias-write`
  (EL1 permission fault) pass. `tests/test_fs.py` ran 8 values × every index word of the
  archive. Every case returned an errno, with no panics.

Syscalls actually used (grow-trace sys.enter, archive-relevant):
| workload | syscalls |
|---|---|
| Lua (`io.open/read/lines/seek`, `dofile`, `loadfile`, `require`) | openat, read, readv, lseek, close |
| QuickJS (`std.loadFile/open`, `os.stat/lstat/readdir/open/read/seek/readlink`) | openat, read, readv, lseek, close, newfstatat, fcntl(F_SETFD), getdents64, readlinkat |

## Cost (canonical qjs+bootstrap image; n=30 per row, rows interleaved; load1 2.9)
Image bytes: pre-feature 2,924,544 B; no resources +40 B (header + root entry).
1 MiB of resources adds +1,048,769 B and 8 MiB adds +8,389,669 B (raw, uncompressed).

The spawn→READY and footprint columns show p50 / p90. Footprint is `proc_pid_rusage` phys_footprint, parked after READY.

| VMM | resources | spawn→READY ms | footprint MiB | guest read 1 MiB µs |
|---|---|---|---|---|
| stock | pre-feature | 22.32 / 23.14 | 13.36 / 13.48 | - |
| stock | 0 | 21.96 / 23.41 | 13.34 / 13.41 | - |
| stock | 1 MiB | 22.14 / 23.34 | 15.36 / 15.39 | 194 / 204 |
| stock | 8 MiB | 24.18 / 25.28 | 29.36 / 29.44 | 199 / 207 |
| direct-load | pre-feature | 21.80 / 22.74 | 10.52 / 10.67 | - |
| direct-load | 0 | 21.57 / 23.07 | 10.53 / 10.66 | - |
| direct-load | 1 MiB | 21.82 / 22.97 | 11.55 / 11.67 | 194 / 208 |
| direct-load | 8 MiB | 22.73 / 24.08 | 18.56 / 18.69 | 194 / 207 |

- Boot: there is no measurable cost without resources. Resources cost about 0.15 ms/MiB with direct load
  and about 0.28 ms/MiB with stock libkrun. The cost is the host copying the image into guest RAM.
  The guest does not parse anything at boot.
- Memory: macOS stock libkrun `std::fs::read`s the RAW image into a heap `Vec`. libmalloc keeps it
  dirty (`footprint`: an 11 MB `MALLOC_LARGE` for the 8 MiB image), so every VM paid 2× the
  image size. `vmm/patches/raw-direct-load.diff` (6 lines) reads the file directly into
  guest RAM. That makes resources cost 1.0 MiB of footprint per MiB, and saves 2.8 MiB per VM for every image.
  On Linux (glibc unmaps the buffer), PSS is the same with and without the patch: 10.06 MiB
  with no resources and 18.04 MiB with 8 MiB (+0.997 MiB per MiB).
- Reads: one copy from the read-only archive alias into the user buffer, about 5.4 GB/s in the guest
  (4 × 256 KiB `os.read`).
- Separate host payload (libkrun initrd): the same `std::fs::read` + `guest_mem.write`
  path (builder.rs `load_external_kernel`), so it has the same per-byte cost. It would add a VMM flag,
  a sandbox path and FDT parsing. It was not adopted.
- Guest RAM: resources take 32 MiB guest RAM 1:1. 8 MiB of resources leaves a 14.2 MiB mmap arena
  (from 22 MiB), below qjs's 16 MiB `--memory-limit`.
