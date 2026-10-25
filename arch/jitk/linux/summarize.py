#!/usr/bin/env python3
"""Render the functional result table, preserving its non-performance label."""
import json,sys
from pathlib import Path
root=Path(__file__).resolve().parent
r=json.loads((root/'out/report.json').read_text())
def load(g):
 records=g.get('rows',g.get('samples',[]));first=records[0] if records else {}
 inner=g.get('uptime_before',first.get('uptime_before',first.get('uptime','UNVERIFIED')))
 outer=g.get('outer_host_started_unix',g.get('outer_host_ended_unix',first.get('outer_host',{}))).get('loadavg','UNVERIFIED')
 return f'inner: {inner}; outer: {outer}'
lines=['# Linux functional suite', '',f"**{r['label']} — non-performance data. Status: {r['status']}.**",'',f"Outer host: `{r['host_uptime']}`",'', '| Gate | Result | Count | Wall s | p50 / p90 / p99 ms | Load |','|---|---|---:|---:|---|---|']
for name,g in r['gates'].items():
 q=g.get('latency_ms');lat=' / '.join(f'{q[k]:.3f}' for k in ['p50','p90','p99']) if q else '—'
 count=f"{g['completed']}/{g['n']}" if 'completed' in g else (str(g['exchanges'])+' exchanges' if 'exchanges' in g else str(g.get('completed_after_park','—')))
 lines.append(f"| {name} | {'PASS' if g['pass'] else 'FAIL'} | {count} | {g['elapsed_s']:.3f} | {lat} | {load(g)} |")
lines+=['','Each gate’s inner uptime/load, samples, hashes and CPU accounting: `report.json`.',f"Owned children remaining: {r['children_remaining']}.",'','## CPU-ms/VM (NESTED)', '', '| Case | VMM user including guest | VMM system | Guest estimate† | Total | Load |','|---|---:|---:|---:|---:|---|']
for name,g in r['gates'].items():
 if 'cpu_ms_vm' in g:
  c=dict(g['cpu_ms_vm']);c['vmm_user_including_guest']=c['total']-c['vmm_system'];lines.append('| '+name+' | '+' | '.join(f'{c[k]:.3f}' for k in ['vmm_user_including_guest','vmm_system','guest','total'])+' | '+load(g)+' |')
for row in r['gates'].get('cpu_controls',{}).get('rows',[]):
 c=dict(row['cpu_ms_vm']);c['vmm_user_including_guest']=c['total']-c['vmm_system'];lines.append('| '+row['mode']+' | '+' | '.join(f'{c[k]:.3f}' for k in ['vmm_user_including_guest','vmm_system','guest','total'])+' | '+load(row)+' |')
lines+=['','† Guest delta is Linux /proc/stat, tick-quantized and potentially includes foreign KVM workloads in the shared VM. Some guest/host-user residuals are negative: the counters do not close exactly. Precise host-user/guest attribution is UNVERIFIED; see cpu-analysis.json. The guest estimate is already included in user, not added again.','CPU excludes supervisor, spawn wrapper, and L0 QEMU/HVF; this cannot decide the metal 5 CPU-ms kill line.']
(root/'out/report.md').write_text('\n'.join(lines)+'\n')

parking=r['gates'].get('parking')
if parking:
 with (root/'out/report.md').open('a') as f:
  f.write(f"\nParking image: `{parking['image_sha256']}`. Idle {parking['idle_seconds']:.6f} s, VMM process CPU {parking['idle_cpu_pct_core']:.6f}% core; high-resolution VMM cgroup CPU {parking['idle_cgroup_cpu_pct_core']:.6f}% core. {parking['exchanges']}/1000 exchanges, {parking['delayed_replies']} delayed replies, {parking['stalls']} stalls. vCPU wait state: kvm_vcpu_block.\n")
