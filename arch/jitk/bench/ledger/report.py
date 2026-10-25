#!/usr/bin/env python3
"""Regenerate numeric ledger tables after collection; no measurement or runtime edits."""
import importlib.util
import json
from pathlib import Path
import statistics as st
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ledger',HERE/'ledger.py');ledger=importlib.util.module_from_spec(spec);spec.loader.exec_module(ledger)
M=1048576
main=json.loads((HERE/'memory-raw.json').read_text())
extra=json.loads((HERE/'memory-n60-raw.json').read_text())
merged={**main,'cells':main['cells']+extra['cells'],'component_files':['memory-raw.json','memory-n60-raw.json']}
(HERE/'memory-combined.json').write_text(json.dumps(merged,indent=2)+'\n')
class Args:pass
a=Args();a.input=str(HERE/'memory-combined.json');a.output=str(HERE/'summary.json');ledger.analyze(a)
a.input=str(HERE/'cpu-raw.json');a.output=str(HERE/'cpu-summary.json');ledger.analyze_cpu(a)
summary=json.loads((HERE/'summary.json').read_text());cpu=json.loads((HERE/'cpu-summary.json').read_text())
lines=[]
def write(s=''):lines.append(s)
def table(headers,rows):
    write('| '+' | '.join(headers)+' |');write('| '+' | '.join('---' for h in headers)+' |')
    for row in rows:write('| '+' | '.join(map(str,row))+' |')
    write()
def med(xs):return st.median(xs)
rows=summary['rows']
write('Memory totals, median over three independent cells; MiB. Footprint includes logical compressed memory.');write()
table(['image','N','READY footprint sum','READY RSS sum','READY compressed sum','tool-wait footprint sum','tool-wait RSS sum','tool-wait compressed sum'],[
 [v,n,*[f'{med([r[group][key]/M for r in rows if r["variant"]==v and r["n"]==n and r["phase"]==p]):.3f}' for p in ('ready','one_tool_wait') for group,key in [('sums','footprint'),('sums','rss'),('ledgers','internal_compressed')]]]
 for v in ('current','0','1','8') for n in (1,16,60) if any(r['variant']==v and r['n']==n for r in rows)])
write('OLS total = intercept + N × marginal, across N=0/1/16/60 and all repeats; MiB.');write()
table(['image/state','footprint marginal','footprint intercept','RSS marginal','page-table marginal','tkm_private marginal (overlaps)'],[
 [k,*[f'{f[q][metric]/M:.5f}' for q,metric in [('sums/footprint','slope'),('sums/footprint','intercept'),('sums/rss','slope'),('ledgers/page_table','slope'),('ledgers/tkm_private','slope')]]]
 for k,f in summary['fits'].items()])
write('System bracket deltas at N=60, per VM: median [min,max] over three cells; MiB.');write()
table(['image/state','wired','compressor physical','anonymous resident','file-backed resident'],[
 [v+'/'+p,*[f'{med(vals):.3f} [{min(vals):.3f},{max(vals):.3f}]' for key in ('Pages wired down','Pages occupied by compressor','Anonymous pages','File-backed pages') for vals in [[r['system_deltas'][key]/M/60 for r in rows if r['variant']==v and r['n']==60 and r['phase']==p]]]]
 for v in ('current','0','1','8') for p in ('ready','one_tool_wait')])
write('CPU medians, CPU-ms user / sys (total); each row n=30 unless a phase boundary was unavailable.');write()
def cp(v):return f'{v["user_ms"]["p50"]:.3f} / {v["system_ms"]["p50"]:.3f} ({v["total_ms"]["p50"]:.3f}; n={v["n"]})'
table(['path/mode/case','VMM boot','VMM execute','VMM teardown','VMM lifecycle','Node execute','Node lifecycle','watchdog per run'],[
 [key,*[cp(d[p]) if p in d else 'unavailable' for p in ('vmm_boot','vmm_execute','vmm_teardown','vmm_lifecycle','node_execute','node_lifecycle','watchdog_run')]] for key,d in cpu.items()])
(HERE/'TABLES.md').write_text('\n'.join(lines)+'\n')
