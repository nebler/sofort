#!/usr/bin/env python3
"""Read-only final receipt audit; never reruns benchmark measurements."""
from collections import Counter
from datetime import datetime,timezone
import argparse,hashlib,json,os
from pathlib import Path

HERE=Path(__file__).resolve().parent

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(name,d):
 d['audited_utc']=datetime.now(timezone.utc).isoformat();d['auditor_load']=list(os.getloadavg())
 (HERE/name).write_text(json.dumps(d,indent=2)+'\n');print(json.dumps(d,indent=2))
def deadline(p):
 d=json.loads(p.read_text());out={'source':str(p),'receipt_sha256':sha(p),'vmm_sha256':d.get('vmm_sha256'),
 'image_sha256':d.get('image_sha256'),'executor_sha256':d.get('executor_sha256'),'watchdog_sha256':d.get('watchdog_sha256'),
 'finished':d.get('finished_utc'),'harness_error':d.get('harness_error'),
 'pool_after_close':d.get('pool_after_close'),'cases':{}}
 for case in sorted({r['case'] for r in d['rows']}):
  rows=[r for r in d['rows'] if r['case']==case];loads=[r[k][0] for r in rows for k in ('load_before','load_after')]
  admitted=[r for r in rows if r.get('blocking_tool_invoked')]
  receipts=[r['watchdog_receipt'] for r in rows if r.get('watchdog_receipt')]
  out['cases'][case]={'n':len(rows),'controls_pass':sum(bool(r.get('control_ok')) for r in rows),
   'admitted_callbacks':len(admitted),'admitted_effective_kill_le50':sum(r.get('vm_enforcement_overshoot_ms',float('inf'))<=50 for r in admitted),
   'watchdog_receipts':len(receipts),
   'external_kill_le50':sum(0<=r['killAt']-r['deadline']<=50 for r in receipts),
   'effective_kill_le50':sum(r.get('vm_enforcement_overshoot_ms',float('inf'))<=50 for r in rows),
   'max_external_kill_overshoot_ms':max((r['killAt']-r['deadline'] for r in receipts),default=None),
   'api_le50':sum(r['overshoot_ms']<=50 for r in rows),'max_api_overshoot_ms':max(r['overshoot_ms'] for r in rows),
   'signals_received_aborted':sum(bool(r.get('callback_signal_received') and r.get('callback_signal_aborted')) for r in rows),
   'late_successes':sum(not r.get('error') and r['elapsed_ms']>r['timeout_ms'] for r in rows),
   'load1_range':[min(loads),max(loads)]}
 save(p.stem+'-audit.json',out)
def bench(p):
 d=json.loads(p.read_text());rows=d['samples'];keys=Counter((r.get('pass'),r['name'],r['build']) for r in rows)
 out={'source':str(p),'receipt_sha256':sha(p),'finished':d.get('finished_at'),'config':d['config'],
 'n':len(rows),'counts':[{'pass':a,'case':b,'build':c,'n':n} for (a,b,c),n in sorted(keys.items())],
 'statuses':dict(Counter(r['status'] for r in rows)),'gate_passed':sum(r['gate']['passed'] for r in rows),
 'load1_range':[min(r[k][0] for r in rows for k in ('load_before','load_after')),max(r[k][0] for r in rows for k in ('load_before','load_after'))],
 'all_load_evidence':all(all(k in r for k in ('load_before','load_after','uptime')) and r['gate'].get('observations') for r in rows),
 'no_duplicate_block_build_case':len({(r.get('pass'),r['block'],r['name'],r['build']) for r in rows})==len(rows),
 'active_owned_pids':d.get('active_owned_pids'),'quiet_pass':d.get('quiet_pass'),'artifacts':{},'summary':d.get('summary')}
 for label,s in d['selection'].items():
  out['artifacts'][label]={}
  for name in ('vmm','image'):
   pth=Path(s[name]);actual=sha(pth) if pth.is_file() else None
   out['artifacts'][label][name]={'recorded':s[name+'_sha256'],'actual':actual,'matches':actual==s[name+'_sha256']}
 save('i3-recertification-audit.json',out)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('kind',choices=['deadline','bench']);p.add_argument('receipt',type=Path)
 a=p.parse_args();globals()[a.kind](a.receipt)
