#!/usr/bin/env python3
"""Interleaved fresh-process latency; includes spawn, boot, shutdown and waitpid."""
import json, pathlib, random, statistics, subprocess, time
root = pathlib.Path(__file__).resolve().parent
kernel = '/tmp/jitk-spike/boot/kk.bin'
commands = {
    'c-default': ['/tmp/jitk-01/host-c', kernel],
    'rust-default': ['/tmp/jitk-01/jitk-vmm', kernel, 'default'],
    'rust-one-port': ['/tmp/jitk-01/jitk-vmm', kernel],
}
samples = {name: [] for name in commands}
for name, cmd in commands.items():
    for _ in range(5): subprocess.run(cmd, input=b'', capture_output=True, check=True, timeout=5)
order = list(commands) * 30
random.Random(1).shuffle(order)
for name in order:
    start = time.perf_counter_ns()
    subprocess.run(commands[name], input=b'', capture_output=True, check=True, timeout=5)
    samples[name].append((time.perf_counter_ns()-start)/1e6)
results = {name: {'n': len(xs), 'median_ms': statistics.median(xs),
                  'p90_ms': sorted(xs)[26], 'min_ms': min(xs), 'max_ms': max(xs),
                  'samples_ms': xs} for name, xs in samples.items()}
(root/'latency-results.json').write_text(json.dumps(results, indent=2)+'\n')
for name, result in results.items(): print(name,{k:v for k,v in result.items() if k!='samples_ms'})
