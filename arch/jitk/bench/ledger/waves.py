#!/usr/bin/env python3
"""Yield the shared benchmark lock between independent supplemental cells."""
import json
from pathlib import Path
import subprocess
import sys
HERE=Path(__file__).resolve().parent
all_data=None
for repeat in range(3):
    for variant in ('current','0','1','8'):
        output=HERE/f'n60-r{repeat}-{variant}.json'
        subprocess.run(['/usr/bin/lockf','-k','/tmp/sofort-bench.lock',sys.executable,
            str(HERE/'ledger.py'),'memory','--variants',variant,'--counts','60',
            '--repeats','1','--output',str(output)],check=True)
        part=json.loads(output.read_text())
        if all_data is None:all_data={**part,'cells':[],'component_files':[]}
        for c in part['cells']:c['repeat']=repeat
        all_data['cells']+=part['cells'];all_data['component_files'].append(output.name)
        all_data['end']=part['end']
        (HERE/'memory-n60-raw.json').write_text(json.dumps(all_data,indent=2)+'\n')
