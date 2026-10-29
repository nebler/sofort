# Protocol v1 (owner 03)

`PROTOCOL-v1.md` is normative. `dispatcher.ts` is the one trusted decoder;
`bootstrap.js` is the canonical stock QuickJS `--std` source embedded by the
kernel. Executor and Hyperlight adapters import this dispatcher; no private copy.
`dispatcher.js` is generated build output for TS consumers using `.js` imports.
Build before those consumers. No npm dependencies are needed here.

Use a verified absolute Node >=24 executable, e.g. `/tmp/jitk-09/node-real`:

```sh
NODE=/tmp/jitk-09/node-real
make -C arch/jitk/protocol .work/bin/make-vectors
arch/jitk/protocol/.work/bin/make-vectors
"$NODE" arch/jitk/protocol/build.mjs
"$NODE" arch/jitk/protocol/test.mjs
"$NODE" arch/jitk/protocol/import-check.mjs
"$NODE" arch/jitk/protocol/vm-test.mjs
"$NODE" arch/jitk/protocol/hostile/run.mjs
```

Host corpus: generated `vectors.json`, whole and fragmented reads, boundary
checks and deterministic mutations. `guestCases` in that same corpus drive
fresh real VMs. VM harness selects integrated `kernel/.READY` and its documented
image when available; otherwise `/tmp/jitk-02/r2/kernel.bin` and `/tmp/jitk-02/r2/host`.
Explicit `JITK_IMAGE` overrides the image; VMs run under the HVF engine's console runner (`$JITK_SHARD_BINARY console --image`, until 2026-10-28 the libkrun VMM).
`JITK_VM_N=30` is the default repetitions per case. Each result includes artifact
hashes, loads, raw samples and p50/p90/p99. These are functional tests under load,
not canonical performance claims (those belong to owner 06).

Bootstrap invocation is `qjs --std --memory-limit 16M bootstrap.js` or the same
source as `-e`. It is deliberately not an ES module: kernel argv embeds source,
and stock qjs `--std` provides std/os. The helper is an API convenience only;
malicious code can use std/os. Logs clip by scalar to 4096 decoded UTF-8 bytes,
replace lone surrogates with U+FFFD, and stop at the host's 262144-byte total.
Raw DEL is forbidden on both wire directions; escaped `\u007f` is valid data.

`hostile/` is the shared protocol subset for owner 07's broader H5 suite. It
never loads provider credentials or invokes external tools. All children have an
independent watchdog and are killed/reaped in `finally`. A watchdog firing is a
failure in this suite; rejection must come from the dispatcher or kernel/EL0.
`.READY` covers canonical build plus host conformance; VM evidence is separate.

Native tooling uses the arch/jitk scriptc 0.4.5 pin in `../tools/` and the
shared helpers in `../tslib/`; run `make tools` to compile it. See [`../docs/SCRIPTC-GAPS.md`](../docs/SCRIPTC-GAPS.md) and the [Python port parity report](../docs/results/port-parity-protocol-2026-10-26.md).
