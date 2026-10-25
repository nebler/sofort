#!/usr/bin/env python3
"""Each hostile guest x {stock libkrun a1d8616, patched}; prod config (compiled Seatbelt, panic=abort)."""
import json, os, subprocess, time
R = '/tmp/jitk-07/r2'; out = {}
for g in ['kk', 'unknown-hvc', 'unknown-smc', 'mmio-halfword', 'bad-sysreg', 'console_avail_oob', 'rtc_oob_read']:
    for b in ['jitk-vmm', 'jitk-vmm-patched']:
        t = time.perf_counter()
        try:
            p = subprocess.run([f'{R}/{b}', f'{g}.bin'], cwd=R, env={'JITK_SB': 'compiled'},
                               capture_output=True, timeout=3)
            rc, err = p.returncode, p.stderr.decode()[-200:]
        except subprocess.TimeoutExpired as e:
            rc, err = 'HANG(killed@3s)', (e.stderr or b'').decode()[-200:]
        out[f'{g}/{b}'] = {'rc': rc, 'ms': round(1000 * (time.perf_counter() - t), 1), 'stderr': err.strip()}
        print(f'{g:18} {b:17} rc={rc!s:16} {out[f"{g}/{b}"]["ms"]:7.1f}ms {err.strip()[:90]!r}')
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'fault-results-r2.json'), 'w'), indent=1)
