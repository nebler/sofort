#!/usr/bin/env python3
"""Audit owner06 raw evidence without running or copying its benchmark table."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

AREA = Path(__file__).resolve().parent
BENCH = AREA.parents[1] / 'jitk/bench'
raw = BENCH / 'raw.json'
data = json.loads(raw.read_bytes())
names = {s['name'] for s in data['specs']}
rows = data['samples']
counts = Counter(r['name'] for r in rows)
passed = Counter(r['name'] for r in rows if r['status'] == 'PASS')
gated = Counter(r['name'] for r in rows if r['gate']['passed'])
blocks = {}
for row in rows:
    blocks.setdefault(row['block'], []).append(row['name'])
selection = data['selection']
artifacts = {}
for field in ['vmm', 'image']:
    path = Path(selection[field])
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    artifacts[field] = {'path': str(path), 'recorded': selection[field + '_sha256'],
                        'actual': actual, 'matches': actual == selection[field + '_sha256']}
result = {
    'audited_utc': datetime.now(timezone.utc).isoformat(),
    'scope': 'Read-only integrity/count audit of owner06 evidence, not an independent timing reproduction.',
    'raw_sha256': hashlib.sha256(raw.read_bytes()).hexdigest(),
    'table_sha256': hashlib.sha256((BENCH / 'RESULTS.md').read_bytes()).hexdigest(),
    'started_at': data.get('started_at'), 'finished_at': data.get('finished_at'),
    'sample_count': len(rows), 'case_count': len(names),
    'cases': {name: {'n': counts[name], 'pass': passed[name],
                     'fail': counts[name] - passed[name], 'gated': gated[name]}
              for name in sorted(names)},
    'complete_blocks': all(len(v) == len(names) and set(v) == names for v in blocks.values()),
    'all_expected_cases': set(counts) == names,
    'all_rows_have_load_evidence': all(all(k in row for k in ['load_before', 'load_after', 'uptime'])
                                       and row['gate'].get('observations') for row in rows),
    'status_counts': dict(Counter(r['status'] for r in rows)),
    'gate_passed': sum(gated.values()),
    'gate_timed_out': sum(bool(r['gate']['timed_out']) for r in rows),
    'load1_min': min(r['load_before'][0] for r in rows),
    'load1_max': max(r['load_before'][0] for r in rows),
    'artifacts': artifacts,
    'min_validated_per_case': min(passed[name] for name in names),
    'quiet_n30_all_cases': all(gated[name] >= 30 for name in names),
}
result['complete_contended_table'] = bool(result['finished_at']) and result['complete_blocks'] and result['all_expected_cases'] and result['all_rows_have_load_evidence'] and result['min_validated_per_case'] >= 30 and all(a['matches'] for a in artifacts.values())
(AREA / 'h4-audit.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k not in ['cases', 'artifacts']}, indent=2))
