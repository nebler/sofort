#!/usr/bin/env python3
"""Measure confinement's in-process addition, not loaded-host process latency."""
import argparse
import json
import os
import math
from pathlib import Path
import re
import subprocess
import statistics
import time

p = argparse.ArgumentParser()
p.add_argument("--binary", default="/tmp/jitk-01/r3/darwin/jitk-vmm")
p.add_argument("--profile", default="/tmp/jitk-01/r3/jitk.sbbin")
p.add_argument("--image", default="/tmp/jitk-01/r3/images/first.bin")
p.add_argument("--n", type=int, default=30)
p.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "evidence/sandbox-macos.json"))
a = p.parse_args()
records = []
for i in range(a.n + 5):
    uptime = subprocess.check_output(["uptime"], text=True).strip()
    start = time.perf_counter_ns()
    r = subprocess.run([a.binary, "--image", a.image, "--sandbox-profile", a.profile],
                       capture_output=True, timeout=30, env=dict(os.environ, JITK_VMM_TIMING="1"))
    elapsed = time.perf_counter_ns() - start
    assert r.returncode == 0, (r.returncode, r.stderr)
    m = re.search(rb"SANDBOX_NS (\d+) PREPARE_AND_APPLY_NS (\d+)", r.stderr)
    assert m, r.stderr
    if i >= 5:
        records.append({"apply_ns": int(m[1]), "prepare_and_apply_ns": int(m[2]), "wall_ns": elapsed, "uptime": uptime})
def quantiles(values):
    values = sorted(v / 1e6 for v in values)
    return {"p50_ms": statistics.median(values), "p90_ms": values[math.ceil(len(values)*.9)-1], "p99_ms": values[math.ceil(len(values)*.99)-1]}
out = {"n": a.n, "warmups": 5, "percentiles": "median; p90/p99 nearest rank", "summary": {key: quantiles(r[key] for r in records) for key in ["apply_ns", "prepare_and_apply_ns", "wall_ns"]}, "samples": records}
Path(a.out).write_text(json.dumps(out, indent=2) + "\n")
print(json.dumps(out["summary"], indent=2))
