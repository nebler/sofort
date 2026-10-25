#!/usr/bin/env python3
"""Read-only source audit; candidate findings require manual interpretation."""
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2] / 'jitk'
SKIP = {'node_modules', 'target', 'out', 'build', 'dist', '.git', '__pycache__', 'vendor', '.work', 'results', 'evidence'}
groups = defaultdict(list)
refs = []
patches = []
for path in sorted(ROOT.rglob('*')):
    rel = path.relative_to(ROOT)
    if not path.is_file() or path.is_symlink() or set(rel.parts) & SKIP:
        continue
    if path.suffix not in {'.rs', '.ts', '.mjs', '.js', '.py', '.sh', '.c', '.S', '.toml', '.diff'}:
        continue
    data = path.read_bytes()
    if len(data) > 1000000:
        continue
    text = data.decode('utf-8')
    groups[hashlib.sha256(data).hexdigest()].append(str(rel))
    if path.suffix == '.diff':
        patches.append({'path': str(rel), 'added': sum(l.startswith('+') and not l.startswith('+++') for l in text.splitlines()),
                        'removed': sum(l.startswith('-') and not l.startswith('---') for l in text.splitlines())})
        continue
    for nr, line in enumerate(text.splitlines(), 1):
        if re.search(r'/tmp/jitk-(?!10\b)|arch/[0-9]{2}-|\.\./\.\./[0-9]{2}-', line):
            refs.append({'path': str(rel), 'line': nr, 'text': line[:400]})
result = {'measured_utc': datetime.now(timezone.utc).isoformat(),
          'identical_source_groups': [v for v in groups.values() if len(v) > 1],
          'external_path_candidates': refs, 'patch_deltas': patches}
external = ROOT.parent / '02-guest-kernel/r3/regression-host.rs'
if external.is_file():
    data = external.read_bytes()
    result['external_owned_functional_host'] = {
        'path': str(external), 'lines': len(data.splitlines()),
        'sha256': hashlib.sha256(data).hexdigest(),
        'scope': '02 certificate-named native host used by grow; outside integrated product-tree LOC total'}
out = Path(sys.argv[1])
out.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'external_path_candidates'}, indent=2))
print(f'{len(refs)} external-path candidates; inspect input dependencies separately from output scratch defaults.')
