#!/usr/bin/env python3
"""CLI + patched fault guests, with a bounded real qjs tool call."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import selectors
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--binary", default=f"/tmp/jitk-01/r3/{platform.system().lower()}/jitk-vmm")
parser.add_argument("--images", default="/tmp/jitk-01/r3/images")
parser.add_argument("--profile", default="/tmp/jitk-01/r3/jitk.sbbin")
parser.add_argument("--kernel")
parser.add_argument("--output", default=str(ROOT / "evidence" / f"checks-{platform.system().lower()}.json"))
parser.add_argument("--repeats", type=int, default=30)
args = parser.parse_args()
images = Path(args.images).resolve()
if args.kernel is None:
    (images / "kernel.bin").write_bytes((ROOT.parent / "kernel/dist/kernel.bin").read_bytes())
    args.kernel = str(images / "kernel.bin")
mac = platform.system() == "Darwin"
extra = ["--sandbox-profile", args.profile] if mac else []
def uptime():
    try:
        return subprocess.check_output(["uptime"], text=True).strip()
    except FileNotFoundError:
        return f"uptime_s={Path('/proc/uptime').read_text().strip()} loadavg={Path('/proc/loadavg').read_text().strip()}"
result = {"uptime": uptime(), "checks": {}, "faults": {}, "samples": []}
def run(argv, data=None, watchdog=False):
    try:
        return subprocess.run([args.binary, *argv, *extra], input=data, capture_output=True, timeout=.5 if watchdog else 30)
    except subprocess.TimeoutExpired as e:
        if watchdog:
            # subprocess.run kills and reaps before raising; classify this explicitly.
            p = subprocess.CompletedProcess(argv, -9, e.stdout or b"", e.stderr or b"")
            p.watchdog = True
            return p
        print("TIMEOUT", argv, "stdout:", repr(e.stdout), "stderr:", repr(e.stderr), flush=True)
        raise
def mark(name, valid):
    assert valid, name
    result["checks"][name] = True
    print("PASS", name, flush=True)

for name, argv in [("no-image", []), ("bad-mem", ["--image", str(images / "first.bin"), "--mem-mib", "33"]),
                   ("bad-seed", ["--image", str(images / "first.bin"), "--seed", "ab"]), ("unknown", ["--whatever"])]:
    p = run(argv)
    mark(name, p.returncode == 70 and not p.stdout)
seed, epoch = "00112233445566778899AABBCCDDEEFF", "1792800000000000000"
p = run(["--image", str(images / "first.bin"), "--seed", seed, "--epoch-ns", epoch])
mark("seed-epoch-counter-single-console", p.returncode == 0 and b"jitk.seed=" + seed.lower().encode() in p.stdout
     and b"jitk.epoch_ns=" + epoch.encode() in p.stdout and b"jitk.counter=" in p.stdout
     and p.stdout.count(b"node virtio_mmio@") == 1 and b"virtio-count=0000000000000001" in p.stdout)
result["probe_stdout"] = p.stdout.decode()
payload = bytes(33 + i % 90 for i in range(1000))
p = run(["--image", str(images / "first.bin"), "--wait-go"], b"")
mark("eof-before-go", p.returncode == 70 and not p.stdout and b"EOF before go byte" in p.stderr)

def tool_call():
    p = subprocess.Popen([args.binary, "--image", args.kernel, *extra], stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
    sel = selectors.DefaultSelector()
    for stream in [p.stdout, p.stderr]:
        sel.register(stream, selectors.EVENT_READ)
    buffers = {p.stdout: b"", p.stderr: b""}
    ack = ready = sent = called = done = False
    deadline = time.monotonic() + 30
    errors = b""
    try:
        while time.monotonic() < deadline and not done:
            for key, _ in sel.select(min(1, max(0, deadline - time.monotonic()))):
                data = os.read(key.fd, 65536)
                if not data:
                    sel.unregister(key.fileobj)
                    continue
                if key.fileobj is p.stderr:
                    errors += data
                buffers[key.fileobj] += data
                while b"\n" in buffers[key.fileobj]:
                    line, buffers[key.fileobj] = buffers[key.fileobj].split(b"\n", 1)
                    if key.fileobj is p.stderr:
                        ack |= line == b'{"sandbox":"ok"}'
                        continue
                    if line.startswith(b"\x1e"):
                        continue
                    frame = json.loads(line)
                    if frame.get("t") == "ready":
                        ready = frame.get("v") == 1
                    elif frame.get("t") == "call":
                        assert sent and frame == {"t": "call", "id": 1, "ns": "test", "fn": "echo", "args": [41]}, frame
                        called = True
                        p.stdin.write(b'{"t":"ret","id":1,"ok":41}\n')
                    elif frame.get("t") == "done":
                        assert called and frame == {"t": "done", "ok": 42}, frame
                        done = True
                    else:
                        raise AssertionError(frame)
                if ack and ready and not sent:
                    p.stdin.write(b'{"t":"run","code":"return (await test.echo(41)) + 1;","ns":{"test":["echo"]}}\n')
                    sent = True
            if not sel.get_map() and not done:
                break
        assert ack and ready and sent and called and done, (ack, ready, sent, called, done, p.poll(), errors)
    finally:
        # A validated done is sufficient; shutdown/reap is deliberately off the result path.
        if p.poll() is None:
            p.kill()
        p.wait(timeout=5)
        sel.close()
        for stream in [p.stdin, p.stdout, p.stderr]:
            stream.close()
    return True

mark("real-qjs-ready-and-one-tool", tool_call())
p = run(["--image", str(images / ("parking.bin" if mac else "byteecho.bin")), "--wait-go"], b"g" + payload)
mark("wait-go-preserves-1000-following-bytes", p.returncode == 0 and p.stdout.endswith(payload) and b"WAIT_GO" in p.stderr)
guests = ["unknown-hvc", "unknown-smc", "mmio-halfword", "bad-sysreg", "console_avail_oob", "rtc_oob_read"]
if not mac:
    guests.append("bad-sysreg-handled")
for guest in guests:
    print("GUEST", guest, flush=True)
    records = []
    for _ in range(args.repeats):
        load = uptime()
        t = time.perf_counter_ns()
        watchdog = not mac and guest == "bad-sysreg"
        p = run(["--image", str(images / f"{guest}.bin")], watchdog=watchdog)
        elapsed = (time.perf_counter_ns() - t) / 1e6
        expected = {75} if mac and guest == "bad-sysreg" else ({0, 1, -9} if watchdog else {0})
        assert p.returncode in expected, (guest, p.returncode, p.stderr)
        if p.returncode == -9:
            assert b'{"sandbox":"ok"}\n' in p.stderr, "watchdog fired before confinement"
        records.append({"rc": p.returncode, "watchdog": getattr(p, "watchdog", False), "ms": elapsed, "uptime": load, "stderr": p.stderr.decode(errors="replace")})
    result["faults"][guest] = records
mark("invalid-hvc-clean-exit", all(x["rc"] == 0 for x in result["faults"]["unknown-hvc"]))
mark("one-console-native-cli", "add_default_console" not in (ROOT / "src/main.rs").read_text()
     and (ROOT / "src/main.rs").read_text().count("add_inout_port(") == 1)
if mac:
    deps = subprocess.check_output(["otool", "-L", args.binary], text=True)
    mark("no-libkrun-dylib", "libkrun" not in deps)
    subprocess.run(["codesign", "--verify", "--strict", args.binary], check=True, capture_output=True)
    mark("signature", True)
else:
    deps = subprocess.check_output(["ldd", args.binary], text=True)
    mark("no-libkrun-dylib", "libkrun" not in deps)
    mark("linux-aarch64", "aarch64" in platform.machine())
result["binary_sha256"] = hashlib.sha256(Path(args.binary).read_bytes()).hexdigest()
result["uptime_end"] = uptime()
Path(args.output).write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"checks": result["checks"], "fault_runs": sum(map(len, result["faults"].values()))}, indent=2))
