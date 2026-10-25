#!/usr/bin/env python3
"""Interpret CPU counters without hiding inconsistent guest attribution."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent;r=json.loads((root/'out/report.json').read_text());rows=[]
for name,g in r['gates'].items():
 if 'cpu_ms_vm' not in g or g.get('n',0)<30:continue
 c=g['cpu_ms_vm'];raw_user=c['total']-c['vmm_system'];residual=raw_user-c['guest']
 rows.append({'case':name,'n':g['n'],'label':'NESTED','vmm_user_including_guest_ms':raw_user,'vmm_system_ms':c['vmm_system'],'vmm_total_ms':c['total'],'guest_estimate_ms':c['guest'],'host_user_residual_ms':residual,'residual_is_exact':False,'guest_counter_resolution_ms_vm':c['guest_resolution_ms_vm'],'negative_residual':residual<0,'outer_load':g.get('outer_host_started_unix')})
negative=[x['case'] for x in rows if x['negative_residual']]
d={'label':'NESTED','performance':False,'raw_report_sha256':hashlib.sha256((root/'out/report.json').read_bytes()).hexdigest(),'status':'TOTAL_USER_SYSTEM_MEASURED; PRECISE_HOST_USER_GUEST_SPLIT_UNVERIFIED','warning':'Linux global guest ticks and wait4 adjusted task user do not close exactly in this nested run. Negative residuals are preserved in raw data, never treated as physical negative CPU. Guest estimates and host-user residuals are approximate, not an additive high-resolution profile. Tick resolution alone is not a sufficient error bound.','negative_residual_cases':negative,'rows':rows}
(root/'out/cpu-analysis.json').write_text(json.dumps(d,indent=2)+'\n');print(json.dumps(d,indent=2))
