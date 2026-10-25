#!/usr/bin/env python3
"""45-second, explicitly labeled receipt playback plus a fresh real VM boot."""
import argparse,json,pathlib,subprocess,time
R=pathlib.Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('pane',choices=['vm','agent']);a=ap.parse_args()
d=R/'results/ppoll-accepted';report=json.loads((d/'report.json').read_text());t=time.monotonic()
def at(s,text):
    time.sleep(max(0,t+s-time.monotonic()));print(text,flush=True)
if a.pane=='vm':
    at(0,'REAL KERNEL / EL0 QuickJS — recorded missing replay, live final boot')
    at(2,(R/'results/qjs-before/missing.json').read_text())
    at(7,'Before: qjs os.setReadHandler hits missing ppoll; discovery VM stopped.\nThe ABI probe fails with ENOSYS (-38), exit 1. CLI grew from that probe.')
    at(30,'After: launching a FRESH libkrun VM with the accepted image (10 s watchdog):')
    p=subprocess.run(['/tmp/jitk-08/r2/host',str(R/'results/qjs-smoke/async-stdin.bin')],input=b'ping\n',capture_output=True,timeout=10)
    # Display the actual on-wire RS marker visibly without hiding any output.
    print(p.stdout.replace(b'\x1e',b'<RS>').decode(),flush=True)
    assert p.returncode==0 and b'reply:ping\n' in p.stdout and b'"kind":"missing"' not in p.stdout
    at(43,'Fresh VM exited; no VM is reused.')
else:
    at(0,'RECORDED AGENT OUTPUT — playback timing is not implementation latency')
    at(9,'codex exec --ephemeral --ignore-user-config --sandbox read-only --output-schema ...')
    patch=json.loads((d/'agent.json').read_text())
    at(12,patch['path']+'\n'+patch['source'])
    at(23,'ACTUAL STAGE TIMES (seconds):\n'+json.dumps({k:round(v['seconds'],3) for k,v in report['stages'].items()},indent=2))
    at(27,'PASS: native Linux vs fresh VM — complete ordered probe trace + buffers + stdout + exit\nPASS: 30 fresh VMs; accepted commit '+report['commit'])
    at(37,(d/'manifest.diff').read_text())
    at(43,f"Actual transaction {report['total_seconds']:.3f} s. Traced VM p50 {report['benchmark']['median']:.3f} ms; build time is separate.")
time.sleep(max(0,t+45-time.monotonic()))
