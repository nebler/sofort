"""Classify controller-side diagnostics without changing scores or feedback."""
import ast
from collections import Counter
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def category(value):
    gate=value['gate'];detail=value['detail']
    if gate=='build_candidate':
        if 'start of generic arguments' in detail:return 'Rust cast/comparison syntax'
        if any(s in detail for s in ('unresolved import','cannot find module','cannot find `fs`','cannot find function')):
            return 'Rust module/helper import'
        return 'Other Rust build error'
    if gate=='headless_cli':
        if 'max_output_tokens' in detail:return 'CLI response output-token limit'
        if 'timed out' in detail:return 'CLI timeout'
        return 'Other CLI response/transport error'
    if 'fatal/incomplete' in detail:return 'Guest fatal/incomplete output protocol'
    if gate.startswith(('heldout','semantic_error_state')):
        try:
            outcomes=ast.literal_eval(detail)
            linux=bytes.fromhex(outcomes['linux']['stdout_hex']).decode().splitlines()
            guest=bytes.fromhex(outcomes['jitk']['stdout_hex']).decode().splitlines()
            differences=[a.split('=',1)[0] for a,b in zip(linux,guest) if a!=b]
            if any('fd-truncation' in s for s in differences):return 'Held-out fd argument narrowing'
            if any('readonly-time' in s or 'count-boundary' in s for s in differences):return 'Held-out validation/errno precedence'
            if any(s.startswith('error.') for s in differences):return 'Visible errno/pointer/count behavior'
            if any('position' in s or s.startswith('state.') for s in differences):return 'Read/seek state behavior'
        except (ValueError,KeyError,UnicodeError,TypeError):pass
        return 'Held-out differential mismatch' if gate.startswith('heldout') else 'Visible differential mismatch'
    return gate


def main():
    result={}
    for phase,prefix in [('pilot','e1-pilot-v2-'),('main','e1-main-v2-')]:
        failures=[]
        for path in sorted((ROOT/'results').glob(prefix+'*/tx-*/attempt-*/rejection.json')):
            value=json.loads(path.read_text())
            failures.append({'run_id':path.parts[-4],'attempt':value['attempt'],'gate':value['gate'],
                             'category':category(value)})
        result[phase]={'counts':dict(Counter(f['category'] for f in failures)),'failures':failures}
    (ROOT/'experiments/failure-analysis.json').write_text(json.dumps(result,indent=2)+'\n')
    print({k:v['counts'] for k,v in result.items()})


if __name__=='__main__':
    main()
