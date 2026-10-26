"""Audit E1 denominators, acceptance, prompt isolation and immutable pins."""
import argparse
from collections import Counter
import csv
import hashlib
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from runtime import tree_hashes, CANONICAL


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(name, complete=False):
    meta_path=ROOT/'experiments'/(name+'.json')
    if not meta_path.exists():
        assert not complete, name+' missing'
        return
    meta=read(meta_path)
    cells=meta['design'];counts=Counter(tuple(c[1:4]) for c in cells)
    assert len(counts)==18 and set(counts.values())=={meta['n_per_cell']}
    csv_path=meta_path.with_suffix('.csv')
    rows=list(csv.DictReader(csv_path.open())) if csv_path.exists() else []
    expected=0;transactions=0
    canonical=tree_hashes(CANONICAL)
    e0=read(ROOT/'experiments/E0-environment.json')
    assert meta['vmm_sha256']==e0['vmm_sha256']
    assert meta['oracle_image']==e0['oracle_image']
    assert all(digest(ROOT/k)==v for k,v in e0['protected_before'].items())
    for run_id,target,spec,model,rep in cells:
        out=ROOT/'results'/run_id
        if not (out/'experiment.json').exists():
            continue
        transactions+=1
        assert read(out/'source.json')['files']==canonical
        tx=out/('tx-'+target);report=read(tx/'report.json');attempts=report['attempts']
        assert 1<=len(attempts)<=3
        assert report['accepted']==any(a['accepted'] for a in attempts)
        assert report['acceptance_at_1']==attempts[0]['accepted']
        assert report['acceptance_at_3']==report['accepted']
        run=read(out/'experiment.json')
        if report['accepted']:
            assert run['returncode']==0 and read(out/'report.json')['gate']=='PASS', 'final immutable-source/VMM gate failed'
        assert '--validate-only' in run['command']
        assert run['controller_sha256']==meta['controller_sha256']
        assert run['protected_after']==meta['protected_before']
        actual=[r for r in rows if r['run_id']==run_id]
        expected+=len(attempts)
        assert len(actual)==len(attempts)
        for item,row in zip(attempts,actual):
            assert int(row['attempt'])==item['attempt']
            assert bool(int(row['accepted']))==item['accepted']
            dest=tx/f"attempt-{item['attempt']}"
            prompt=dest/'agent-prompt.txt'
            if prompt.exists():
                text=prompt.read_text()
                assert (ROOT/'heldout-probe.c').read_text() not in text
                assert not any(marker in text for marker in ('poll.sixteen','stat.unaligned','pread.fd-truncation'))
                mode=read(dest/'agent-mode.json')
                assert mode['prompt_sha256']==digest(prompt)
                assert mode['model']==meta['models'][model]
                assert mode['spec_level']==spec
                assert mode['transport']=='codex'
            if item['accepted']:
                assert row['visible_pass']==row['heldout_pass']==row['integration_pass']=='1'
                accepted=read(dest/'acceptance.json')
                assert accepted['heldout_pass'] and accepted['visible_pass']
                assert len(accepted['mutations'])>=2
                assert all(set(m['reasons'])=={'visible','heldout'} for m in accepted['mutations'])
    assert len(rows)==expected, 'CSV has extra/missing attempts'
    if complete:assert transactions==len(cells) and not meta.get('paused')
    print(name,transactions,'transactions',expected,'attempt rows; pins and isolation PASS')


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--require-complete',action='store_true');args=ap.parse_args()
    for name in ('E1-pilot','E1'):verify(name,args.require_complete)
