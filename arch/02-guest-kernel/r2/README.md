# Round-2 kernel interoperability artifact

Build from the workspace root:

```sh
sh arch/02-guest-kernel/r2/build.sh --features qjs
python3 arch/02-guest-kernel/r2/demo.py
```

Stable files are `/tmp/jitk-02/r2/kernel.bin`, `/tmp/jitk-02/r2/host`, and
`/tmp/jitk-02/r2/launch`. The launcher adds an external 30-second SIGKILL watchdog:

```sh
/tmp/jitk-02/r2/launch
```

The host takes an optional RAW image argument. It uses one vCPU, **32 MiB**, exactly
one inout console port (fd0/fd1), and the native Rust builder. `JITK_TICK_US=0`
selects IRQ-only WFI (default); 50/200/1000 select the measured CNTV fallbacks.
`JITK_TIMEOUT_SECONDS` changes the launcher's watchdog. fd2 is host diagnostics.
`host --wait-go` after the image argument waits for one host-only byte before
building/booting; this is the pre-spawned-process alternative, not a guest frame.

The host is statically linked to area 01's **panic=abort** libkrun rlib at
`/tmp/jitk-01/r2/libkrun/target/release`. Set `JITK_KRUN_BUILD` to an equivalent
build directory when rebuilding. Once linked, the executable needs no libkrun
file at runtime. Toolchain: Rust 1.95.0, aarch64-unknown-none, LLVM 22 objcopy,
Apple hypervisor entitlement. `build-host.sh` signs the executable. The C host
is retained only to reproduce the initial dylib measurements; it is not shipped
as the selected launcher. Host sandbox/policy integration belongs to 01/07.

## Stream protocol

Follow [protocol v1](../../03-channel-protocol/PROTOCOL-v1.md). ASCII JSON lines;
1 MiB maximum frame; IDs 1..4096, at most 64 outstanding. The built-in **source
bootstrap** parks on fd0; application code is supplied only in `run`:

```json
{"t":"ready","v":1}
{"t":"run","code":"return await test.echo(1);","ns":{"test":["echo"]}}
{"t":"call","id":1,"ns":"test","fn":"echo","args":[1]}
{"t":"ret","id":1,"ok":2}
{"t":"done","ok":2}
```

Directions alternate G→H/H→G as shown. Replies may arrive out of order. Error
responses use `ret.err={code,message}`; completion errors use `done.err={name,message}`.
Kernel records begin with byte **0x1E**, are ASCII text through LF, and never
establish success. The host must recognize them before JSON parsing. EL0 fd2 is
dropped. Control bytes in stdout kill the guest; whole writev calls are validated
before output. If a guest line is partial, termination adds no kernel record.
EOF/process exit is not success: require a valid `done` and enforce host policy.

Bootargs: `jitk.seed=<32 hex> jitk.epoch_ns=<Unix ns> jitk.counter=<counter ticks>
jitk.tick_us=<n>`. Epoch and counter are a bracketed pair; on macOS the counter
is mach_absolute_time in the guest CNTVCT domain. Epoch-only launchers use kernel
entry as their origin and cannot claim sub-ms host accuracy. Keep this pairing
when integrating another launcher. qjs heap is capped at **16 MiB**.

## Verification

```sh
python3 arch/02-guest-kernel/r2/measure.py park 0
python3 arch/02-guest-kernel/r2/measure.py integration
python3 arch/02-guest-kernel/r2/checks.py
python3 arch/02-guest-kernel/r2/run-probes.py
```

`READY` is created only after G1 and G2 pass. Probe builds use a separate output
and preserve the stable image. Results and load averages are in
this directory; the <=300-line review response is `../R2.md`. `r1` source and
artifacts in the parent directory are unchanged.
