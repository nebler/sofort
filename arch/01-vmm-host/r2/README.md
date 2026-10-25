# jitk-vmm CLI v1 (area 04 integration)

Binary: `/tmp/jitk-01/r2/jitk-vmm`. Native Rust builder API, rlib linked;
no libkrun dylib needed. `main.rs` is under 200 physical lines. Rust 1.95.0,
release, panic=abort (library and executable), no libkrun optional features,
fat LTO and strip. macOS hypervisor entitlement is ad-hoc signed.

```
/tmp/jitk-01/r2/jitk-vmm --image /absolute/kernel.bin --mem-mib 32 \
  --seed 00112233445566778899aabbccddeeff --epoch-ns 1792800000000000000
```

- `--image` required; RAW image, canonicalized before confinement.
- `--mem-mib` defaults to 32, accepts 32 or 64. The **r1** qjs kernel requires 64;
  its physical stack exceeds 32 MiB. The packed r2 kernel is the 32 MiB target.
- `--seed` optional, exactly 32 hex digits (16 bytes); normalized lowercase.
  Default: fresh arc4random_buf entropy before sandboxing.
- `--epoch-ns` optional u64; default host UNIX nanoseconds. Bootargs include
  `jitk.seed`, `jitk.epoch_ns`, and the paired `jitk.counter` (host mach ticks).
  02's r2 kernel adds counter delta, including any pre-spawn wait.
- `--wait-go` prepares console, payload specification, builder and Seatbelt, then
  writes `jitk-vmm: WAIT_GO\n` on **stderr** and blocks on fd0. The first byte
  releases build+boot; its value is ignored. Exactly one byte is consumed with
  unbuffered read; subsequent bytes remain for the guest console. EOF exits 70.
  WAIT_GO means ready to build, not guest READY. Wait for guest READY separately.
- fd0/fd1 are input/output of console **port 0**; fd2 is host diagnostics.
  Only one virtio-console device, four queues for MULTIPORT, no default ports.
  GIC and PL031 RTC remain libkrun implicit devices. One vCPU; nested virt off;
  shutdown device support off. These are fixed, not caller-configurable.
- Setup failures exit 70. Guest SYSTEM_OFF makes libkrun `_exit(0)`; exit 0 is
  not a result. Parent must enforce deadlines, kill on malformed protocol, and
  reap. Invalid host hypercalls abort. No in-process watchdog is added.
- Compatibility Seatbelt profile is compiled into main.rs and applied before
  build, allowing immutable image reads, system frameworks, sysctl, AppleHVClient.
  Security owner supplies the production profile in round 3; no new confinement
  claims beyond the r1 compatibility result.

## Reproduce

All generated files stay in area 01 or `/tmp/jitk-01`. `build.sh` expects the
private source tree `/tmp/jitk-01/r2/libkrun`; it copies the supplied source
there if absent (excluding `.git`, `target`, `examples`). Source is a1d8616.
It scopes the private Makefile release recipe to select `cargo build --release -p libkrun`
and omits the unrelated init-blob build/copy; FFI=0 selects the native minimal
crate. This is build scope only, not a runtime patch. `build.sh` runs make,
compiles main, strips and signs the final binary.

`build-guests.sh` builds the tiny guests with strict alignment and integer-only
code. `build-variants.sh` recreates the five cold variants from measured-main.rs
and the supplied/full versus private/minimal libraries. Copy the supplied dylib
to `/tmp/jitk-01/r2/libkrun.2.dylib` and symlink `libkrun.dylib` first.
The dynamic variant uses benchmark-only dynkrun.rs, an adapter to the supplied
C ABI; the product is the native Rust API. FFI overhead after main is a small
comparison confounder; spawn→main directly measures the link/load difference.

```
python3 cold-bench.py                         # 100 per build, randomized interleave
python3 resign-bench.py                       # 30 fresh CDHash + next-launch pairs
python3 go-bench.py                           # 100 bare + 100 r1 qjs, interleaved
python3 parking-test.py static-trace parking.bin
python3 parking-test.py static-trace parking.bin forced
python3 parking-test.py static-trace timer.bin
python3 parking-test.py static-trace wfe.bin
```

`diagnostic-gic.patch` is an **experiment only**, applied to a private source copy
for static-trace. It logs the selected constructor, logs wait_for_event entry,
and allows JITK_USERSPACE_GIC to force the fallback. Product sources are restored
to upstream, without this patch or environment override. Native GIC+WFI passed;
no production libkrun change is necessary. See PARKING.md.

The private r1 guest copy only adds first-instruction timing and changes the
embedded script to `print("READY")`. It resides in `/tmp/jitk-01/r2/guest-r1`.
Its includes use `/tmp/jitk-02/qjs-stripped` read-only. Build with `JITK_SCRIPT`,
`RUSTFLAGS=-C link-arg=-T.../link.ld`, a private CARGO_TARGET_DIR, target
`aarch64-unknown-none`, and `--features qjs`; objcopy the ELF to qjs-r1.bin.
This measures actual unmodified static qjs initialization, not the protocol-v1
bootstrap or area 04's complete executor. G1 tool→JS result remains 02/04-owned.

Final verification: cli-tests.py passes **12/12** checks, including actual r1 qjs
READY, raw wait-go preserving 1000 subsequent console bytes, exact seed/epoch/
counter FDT values, one device, EOF/error exits, invalid hvc→SIGABRT, signing,
103 LOC, and no libkrun dylib dependency. See cli-results.json and
build-metadata.json for final binary/source hashes and empty feature list.
