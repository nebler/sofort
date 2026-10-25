#!/usr/bin/env python3
"""Warm-cache fresh processes, interleaved; no qjs-ready/pool inference."""
import hashlib, json, math, os, pathlib, random, shutil, statistics, subprocess, time

out = pathlib.Path(__file__).resolve().parent
tmp = pathlib.Path('/tmp/jitk-10/r2/boot'); tmp.mkdir(exist_ok=True)
sources = {'r1-host':'/tmp/jitk-spike/boot/host', 'one-port-host':'/tmp/jitk-02/host',
           'bare.bin':'/tmp/jitk-spike/boot/kk.bin', 'qjs.bin':'/tmp/jitk-02/kernel.bin'}
hashes = {}
shutil.copy2('/tmp/jitk-spike/boot/libkrun.2.dylib', tmp/'libkrun.2.dylib')
env = dict(os.environ, DYLD_LIBRARY_PATH=str(tmp))
for name, source in sources.items():
    shutil.copy2(source, tmp/name)
    hashes[name] = hashlib.sha256((tmp/name).read_bytes()).hexdigest()
cases = {'r1-bare':['r1-host','bare.bin'], 'one-port-bare':['one-port-host','bare.bin'],
         'one-port-qjs':['one-port-host','qjs.bin']}
records = {name:[] for name in cases}
load_before = subprocess.check_output(['uptime'], text=True).strip()
def run(name, warmup):
    command = [str(tmp/p) for p in cases[name]]
    load = os.getloadavg()
    start = time.perf_counter_ns()
    p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True, env=env)
    try:
        stdout, stderr = p.communicate(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(p.pid, 9); p.communicate(); raise
    elapsed = (time.perf_counter_ns()-start)/1e6
    assert p.returncode == 0, stderr
    if 'qjs' in name:
        assert b'hi\n' in stdout, stdout
    if not warmup:
        records[name].append(dict(ms=elapsed, loadavg=load, exit=p.returncode, stdout=stdout.decode()))
for name in cases: run(name, True)
rng = random.Random(10)
for i in range(30):
    order = list(cases); rng.shuffle(order)
    for name in order: run(name, False)
summary = {}
for name, samples in records.items():
    xs = sorted(s['ms'] for s in samples)
    summary[name] = dict(n=len(xs), median_ms=statistics.median(xs), p90_ms=xs[math.ceil(.9*len(xs))-1],
                         p99_ms=xs[math.ceil(.99*len(xs))-1], min_ms=xs[0], max_ms=xs[-1])
result = dict(load_before=load_before, load_after=subprocess.check_output(['uptime'],text=True).strip(),
              methodology='30/case + one discarded warmup; randomized interleaving; whole spawn to reap; no timeout process on success',
              hashes=hashes, summary=summary, raw=records)
(out/'boot-results.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='raw'}, indent=2))
