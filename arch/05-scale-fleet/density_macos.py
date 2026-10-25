#!/usr/bin/env python3
"""Uses copied, signed spike host only. Parked RAM is sparse; not a qjs benchmark."""
import json, os, pathlib, statistics, subprocess, time, signal
ROOT = pathlib.Path(__file__).resolve().parent
TMP = pathlib.Path('/tmp/jitk-05')
OUT = ROOT / 'results'
OUT.mkdir(exist_ok=True)
procs, logs, rows = [], [], []
def pct(xs, p):
    return sorted(xs)[min(len(xs)-1, int((len(xs)-1)*p))]
def probe(n):
    xs, errors = [], []
    for _ in range(n):
        t = time.perf_counter()
        r = subprocess.run([str(TMP/'host'), str(TMP/'kk.bin')], cwd=TMP,
                           stdin=subprocess.DEVNULL, capture_output=True, timeout=5)
        xs.append(1000*(time.perf_counter()-t))
        if r.returncode: errors.append([r.returncode, r.stderr.decode(errors='replace')[:300]])
    return dict(n=n, median_ms=statistics.median(xs), p90_ms=pct(xs,.9), max_ms=max(xs), errors=errors)
try:
    base = probe(30)
    print('baseline', json.dumps(base), flush=True)
    for target in [1,10,25,50,100,150,200]:
        start, lat = time.perf_counter(), []
        while len(procs) < target:
            log = open(OUT / ('vm-%03d.log' % len(procs)), 'wb'); logs.append(log)
            t = time.perf_counter()
            procs.append(subprocess.Popen([str(TMP/'host'), str(TMP/'kk_hang.bin')], cwd=TMP,
                          stdin=subprocess.DEVNULL, stdout=log, stderr=log))
            lat.append(1000*(time.perf_counter()-t))
        spawn_seconds = time.perf_counter()-start
        time.sleep(.5)
        live = [p for p in procs if p.poll() is None]
        ps = subprocess.check_output(['ps','-o','pid=,rss=,%cpu=', '-p', ','.join(str(p.pid) for p in live)], text=True) if live else ''
        rss = [int(line.split()[1]) for line in ps.splitlines()]
        row = dict(target=target, live=len(live), batch_count=len(lat), spawn_seconds=spawn_seconds,
                   spawn_processes_sec=len(lat)/spawn_seconds, popen_p50_ms=statistics.median(lat),
                   rss_sum_mib=sum(rss)/1024, rss_median_mib=statistics.median(rss)/1024 if rss else 0,
                   rss_max_mib=max(rss)/1024 if rss else 0, ps=ps, probe=probe(15))
        rows.append(row)
        print(json.dumps({k:v for k,v in row.items() if k!='ps'}), flush=True)
        if live and target in [1,50,200]:
            r = subprocess.run(['vmmap','-summary',str(live[0].pid)],capture_output=True,text=True)
            (OUT/f'vmmap-{target}.txt').write_text(r.stdout+r.stderr)
        if len(live) != target or row['probe']['median_ms'] > base['median_ms']*2:
            print('STOP: failed VM or probe median exceeds 2x baseline', flush=True); break
finally:
    for p in procs:
        if p.poll() is None: p.terminate()
    for p in procs:
        try: p.wait(timeout=3)
        except subprocess.TimeoutExpired: p.kill(); p.wait()
    for log in logs: log.close()
    (OUT/'density.json').write_text(json.dumps(dict(baseline=base, stages=rows,
        cleanup_live=sum(p.poll() is None for p in procs), created=len(procs)),indent=2)+'\n')
    print('cleanup_live',sum(p.poll() is None for p in procs),flush=True)
