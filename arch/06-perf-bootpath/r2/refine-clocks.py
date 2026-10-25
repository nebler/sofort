"""Tighten the constant RAW/absolute clock-origin offset with all brackets.
Each original per-process clock read is retained. Intersecting the intervals
bounds a single constant offset, rejecting any run where that model fails.
Fresh-boot guest CNTVCT has offset 0 in libkrun; no live pause or system sleep.
"""
from pathlib import Path
import json
from bench import stats
p=Path(__file__).resolve().parent/'r2-integrated.json';r=json.loads(p.read_text())
cals=[x['clock_bridge'] for rows in r['rows'].values() for x in rows]
lo=max(c['offset_ns']-c['uncertainty_ns'] for c in cals);hi=min(c['offset_ns']+c['uncertainty_ns'] for c in cals)
assert lo<=hi,(lo,hi)
offset=(lo+hi)//2;uncertainty=(hi-lo+1)//2
r['clock_calibration']=dict(method='intersection of 800 bracketed RAW/mach_absolute_time pairs; constant origins, no suspend',offset_ns=offset,lower_ns=lo,upper_ns=hi,uncertainty_ns=uncertainty)
for rows in r['rows'].values():
 for row in rows:
  e=row['events'];g=row['guest'];m=row['ms']
  if not g:continue
  mapped={k:t*1_000_000_000//g['hz']+offset for k,t in g.items() if k!='hz' and t};row['guest_host_ns']=mapped
  if 'vcpu_run_begin' in e:
   assert mapped['entry']>=e['vcpu_run_begin']-uncertainty
   m['vcpu_kernel_entry']=(mapped['entry']-e['vcpu_run_begin'])/1e6
  assert mapped['ready']<=e['ready_line']+uncertainty
  m['guest_ready_receipt']=(e['ready_line']-mapped['ready'])/1e6
  if 'rx' in mapped:
   assert e['submit']-uncertainty<=mapped['rx']<=e['call_line']+uncertainty
   m['wake_rx']=(mapped['rx']-e['submit'])/1e6
r['summary']={k:{m:stats([x['ms'][m] for x in rows]) for m in rows[0]['ms']} for k,rows in r['rows'].items()}
p.write_text(json.dumps(r,indent=2));print(r['clock_calibration'])
