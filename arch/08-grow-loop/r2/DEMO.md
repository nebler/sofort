# 45-second grow-loop demo

Use two terminal panes, about 100 columns each. This is a **labeled playback of
actual receipts plus a live fresh VM**, not a claim that an arbitrary CLI/build
finishes within 45 seconds. Agent output and Linux tests were recorded. The qjs
missing-handler replay was captured after the ABI-probe growth transaction;
do not imply that it was the input used to prompt Codex.

All commands run from the workspace root. Prerequisites: the same installed
Rust/LLVM/libkrun/QuickJS from SOURCE.json and the brief; Docker and authenticated
Codex are needed only to repeat growth, not to play the completed demo.

Prepare the signed, one-console host (inspectable C source copied from 02):

```sh
sh arch/08-grow-loop/r2/build-host.sh
```

Start these in the two panes together. `script` records each terminal transcript;
use a screen recorder for the combined two-pane video. Both presenters end at
45 seconds; the fresh VMM has its own 10-second external watchdog.

Left pane:

```sh
script -q /tmp/jitk-08/r2/demo-vm.typescript python3 -B arch/08-grow-loop/r2/demo.py vm
```

Right pane:

```sh
script -q /tmp/jitk-08/r2/demo-agent.typescript python3 -B arch/08-grow-loop/r2/demo.py agent
```

| Time | Left: real-kernel evidence | Right: growth evidence |
| --- | --- | --- |
| 0–2 s | EL0 QuickJS label; actual nr73 `missing` record, visible RS prefix explained | “RECORDED AGENT OUTPUT” label |
| 2–9 s | `os.setReadHandler` miss; discovery VM stopped; native ABI probe exited 1 | Exact read-only headless CLI invocation |
| 12–23 s | Failure stays visible | Actual agent-returned `kernel/src/syscalls/ppoll.rs` |
| 23–30 s | Fresh VM launch announced | Measured CLI/build/oracle/validation seconds; passing tests and commit |
| 30–37 s | Live libkrun VM: kernel records (`<RS>`), ppoll readiness, `reply:ping`, done 0 | Full ordered **probe** trace/bytes matched Linux, 30 fresh VMs passed |
| 37–45 s | VM has exited; no reuse | Versioned manifest diff, actual transaction duration, separate VM latency |

The **same JS** is embedded in both qjs replay images, unmodified static qjs at EL0:

```js
os.setReadHandler(0,()=>{const s=std.in.getline();os.setReadHandler(0,null);print("reply:"+s)})
```

The actual accepted ioctl transaction was **39.544 s**; ppoll was **21.909 s**.
Candidate kernel builds alone took **5.048 s / 1.126 s**. These are single
observations under different host loads. With tracing, fresh probe process
spawn→completion→reap, n=30 each: ioctl **18.422/44.308/222.031 ms** and ppoll
**26.758/58.294/89.682 ms** (p50/p90/p99). These are not request-latency claims.
QuickJS smoke and demo VM timing are single observations, not benchmarks.

Repeat real growth, including headless CLI, native oracle, rebuilt kernel and
30 fresh VMs per syscall (can exceed 45 s; never hide compilation in latency):

```sh
python3 -B arch/08-grow-loop/r2/loop.py ioctl --run-id demo-repeat
python3 -B arch/08-grow-loop/r2/loop.py ppoll --run-id demo-repeat
python3 -B arch/08-grow-loop/r2/test_adapters.py
```

The controller refuses to overwrite run directories. Choose a new run ID on
another replay. The fixed `test_adapters.py` rechecks the delivered `accepted`
receipts; every new loop independently gates its new receipts before committing.
The agent has read-only access and returns JSON; only the controller writes the
selected handler. The CLI credential is copied privately for the call and removed
afterward. Builder/oracle/guest receive no API-key environment.

Full QuickJS trace equivalence, positive-timeout writeback, EOF/HUP, multi-process
tracing and broad copyin/copyout coverage are **UNVERIFIED**. The ppoll implementation
busy-polls; this demonstration makes no parking or idle-CPU claim.
