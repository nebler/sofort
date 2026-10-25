#!/usr/bin/env python3
"""Validate full-profile receipts and derive R7 timing/load tables."""
import collections
import hashlib
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parent
expected = ['parking', 'smoke', 'tool_smoke', 'boot', 'one_tool',
            *(f'concurrency_{n}' for n in range(1, 9)), 'density',
            'cpu_controls', 'seccomp_kill', 'fault_guests']
runs = {}
for name in ['final-1', 'final-2']:
    directory = root / name
    report = json.loads((directory / 'report.json').read_text())
    timing = json.loads((directory / 'run-timing.json').read_text())
    staged = json.loads((directory / 'nested-command.json').read_text())
    ready = json.loads((directory / 'READY.json').read_text())
    gates = report['gates']
    assert report['status'] == 'PASS' and report['children_remaining'] == 0
    assert not report['performance_claim'] and report['label'] == 'NESTED'
    assert list(gates) == expected and all(g['pass'] for g in gates.values())
    assert ready['report_sha256'] == hashlib.sha256((directory / 'report.json').read_bytes()).hexdigest()
    assert gates['smoke']['completed'] == gates['tool_smoke']['completed'] == 1
    assert gates['boot']['completed'] == 100 and gates['one_tool']['completed'] == 30
    assert all(gates[f'concurrency_{n}']['completed'] == 100 for n in range(1, 9))
    assert gates['parking']['exchanges'] == 1000 and gates['parking']['delayed_replies'] == 10
    assert gates['parking']['stalls'] == 0
    assert [r['parked'] for r in gates['density']['rows']] == [1, 32, 64, 128, 256]
    assert gates['density']['completed_after_park'] == 256
    assert {r['mode']: r['n'] for r in gates['cpu_controls']['rows']} == {'setup_only': 100, 'bare_vm': 100}
    seccomp = gates['seccomp_kill']['samples']
    assert len(seccomp) == 720 and all(r['pass'] for r in seccomp)
    assert set(collections.Counter((r['role'], r['action']) for r in seccomp).values()) == {30}
    assert {(r['role'],r['action']) for r in seccomp} == {(role,action) for role in ['main','vcpu','console'] for action in ['exit','openat','socket','execve','kvm-create-vm','kvm-run','mmap-exec','kill']}
    faults = gates['fault_guests']['samples']
    assert len(faults) == 180 and all(r['pass'] for r in faults)
    assert set(collections.Counter(r['case'] for r in faults).values()) == {30}
    assert {r['case'] for r in faults} == {'unknown-hvc','unknown-smc','mmio-halfword','bad-sysreg','console_avail_oob','rtc_oob_read'}
    assert sum(r.get('watchdog_killed', False) for r in faults) == 30
    start = next(e['observer_elapsed_s'] for e in timing['events'] if e['gate'] == 'suite_startup')
    loads = json.loads((directory / 'host-load.json').read_text())
    runs[name] = {
        'status': report['status'], 'implementation': '1714909' if name == 'final-1' else 'bb668af',
        'observer_wall_s': timing['wall_s'], 'queue_s': start,
        'suite_after_lock_s': timing['wall_s'] - start,
        'gate_wall_s': {k: v['elapsed_s'] for k, v in gates.items()},
        'mac_load_1_min_max': max(r['loadavg'][0] for r in loads),
        'mac_load_1_min_min': min(r['loadavg'][0] for r in loads),
        'inner_uptime_before': report['uptime_start'], 'inner_uptime_after': report['uptime_end'],
        'vm_hashes': report['hashes'], 'staged_sha256': staged['source_sha256'],
        'watchdog_kills': 30, 'children_remaining': 0,
    }
for name, run in runs.items():
    assert run['vm_hashes'] == runs['final-1']['vm_hashes']
changed = [name for name in runs['final-1']['staged_sha256']
           if runs['final-1']['staged_sha256'][name] != runs['final-2']['staged_sha256'][name]]
assert changed == ['watch.py', 'seccomp-probe'], changed
comparison=json.loads((root/'probe-binary-comparison.json').read_text())
assert comparison['allocated_sections_identical']
assert comparison['binaries'][0]['allocated_sections']==comparison['binaries'][1]['allocated_sections']
# The late change is only the forced-timeout cleanup fallback; all suite,
# filter, VMM, kernel, and hostile-guest bytes are identical. Probe SHF_ALLOC
# sections match; its debug source path differs between the two build roots.
result = {'status': 'PASS', 'n_full_post_probe_fix_runs': 2, 'runs': runs,
          'changed_staged_files': changed}
for key, path in [('aggregate_command_wall_s', root / 'aggregate-command.log'),
                  ('direct_command_wall_s', root / 'final-2-command.log')]:
    result[key] = float(re.findall(r'^real ([0-9.]+)$', path.read_text(), re.M)[-1])
(root / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'runs'}, indent=2))
for gate in expected:
    print(f"| {gate} | {runs['final-1']['gate_wall_s'][gate]:.3f} | {runs['final-2']['gate_wall_s'][gate]:.3f} |")
