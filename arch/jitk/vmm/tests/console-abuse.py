#!/usr/bin/env python3
"""07 console-abuse guests vs a jitk-vmm binary: outcome + host CPU consumed (reaped-children CPU).
A guest-triggered host spin shows up as CPU-seconds ~= wall-seconds until the deadline."""
import argparse, json, os, platform, signal, subprocess, time
from pathlib import Path
ap = argparse.ArgumentParser()
ap.add_argument("--binary", default=f"/tmp/jitk-01/r3/{platform.system().lower()}/jitk-vmm")
ap.add_argument("--images", default="/tmp/jitk-01/r3/images")
ap.add_argument("--profile", default="/tmp/jitk-01/r3/jitk.sbbin")
ap.add_argument("--repeats", type=int, default=30)
ap.add_argument("--modes", default="1,2,3,4,5,6,7,8,9")
ap.add_argument("--deadline", type=float, default=3.0)
ap.add_argument("--output", default=str(Path(__file__).resolve().parents[1] / "evidence" / f"console-abuse-{platform.system().lower()}.json"))
a = ap.parse_args()
extra = ["--sandbox-profile", a.profile] if platform.system() == "Darwin" else []
# Expected: every mode prints "ALIVE <mode>" and exits 0, except 7 (host EOF; guest waits for input
# forever by design) which must be stopped by the external deadline with negligible CPU.
def once(mode):
    t = time.perf_counter()
    p = subprocess.Popen([a.binary, "--image", f"{a.images}/console-abuse-{mode}.bin", "--mem-mib", "32", *extra],
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    if mode == 7: p.stdin.close()                       # host EOF
    elif mode in (8, 9): p.stdin.write(b"x"); p.stdin.flush()  # input pending while the bad RX chain is offered
    watchdog = False
    c0 = os.times()  # children CPU accumulates on reap (no `resource` module needed)
    while True:
        pid, status = os.waitpid(p.pid, os.WNOHANG)
        if pid: break
        if time.perf_counter() - t > a.deadline:
            os.killpg(p.pid, signal.SIGKILL); watchdog = True
            pid, status = os.waitpid(p.pid, 0); break
        time.sleep(0.005)
    c1 = os.times()
    out = p.stdout.read(); err = p.stderr.read()
    rc = os.waitstatus_to_exitcode(status)
    return {"rc": rc, "watchdog": watchdog, "wall_s": time.perf_counter() - t, "cpu_s": (c1.children_user - c0.children_user) + (c1.children_system - c0.children_system),
            "alive": f"ALIVE {mode}".encode() in out, "ack": b'{"sandbox":"ok"}\n' in err, "vmcreate_retry": b"VmCreate" in err}
def uptime():
    try: return subprocess.check_output(["uptime"], text=True).strip()
    except FileNotFoundError: return "loadavg=" + Path("/proc/loadavg").read_text().strip()
res = {"binary": a.binary, "uptime": uptime(), "modes": {}}
for mode in map(int, a.modes.split(",")):
    rows = []
    while len(rows) < a.repeats:
        r = once(mode)
        if r["vmcreate_retry"]: time.sleep(0.5); continue   # HVF address-space cap hit by other agents: retry
        rows.append(r)
    ok = [(r["watchdog"] and r["cpu_s"] < 0.5 * a.deadline) if mode == 7 else (r["rc"] == 0 and r["alive"]) for r in rows]
    cpu = sorted(r["cpu_s"] for r in rows); wall = sorted(r["wall_s"] for r in rows)
    res["modes"][mode] = {"pass": sum(ok), "n": len(rows), "cpu_s_p50": cpu[len(cpu)//2], "cpu_s_max": cpu[-1],
                          "wall_s_p50": wall[len(wall)//2], "rows": rows}
    print(f"mode {mode}: {sum(ok)}/{len(rows)} pass  cpu p50 {cpu[len(cpu)//2]:.3f}s max {cpu[-1]:.3f}s  wall p50 {wall[len(wall)//2]:.3f}s", flush=True)
res["uptime_end"] = uptime()
Path(a.output).write_text(json.dumps(res, indent=1) + "\n")
exit(0 if all(m["pass"] == m["n"] for m in res["modes"].values()) else 1)
