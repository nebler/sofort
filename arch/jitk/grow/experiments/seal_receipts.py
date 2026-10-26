"""Hash trusted inputs from pinned Git objects, then index local raw artifacts."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
TRUSTED=('arch/jitk/grow/heldout-probe.c','arch/jitk/grow/profiles.py',
         'arch/jitk/grow/sqlite_profile.py','arch/jitk/grow/sqlite-corpus.json',
         'arch/jitk/kernel/tests/test_fs.py','arch/jitk/grow/fs-probe.c',
         'arch/jitk/grow/probe.ld','arch/jitk/grow/oracle/run_profile.py')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--artifacts',action='store_true');args=ap.parse_args()
    repo=Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],text=True).strip())
    indexed=0
    for phase in ('E1-pilot','E1'):
        meta_path=ROOT/'experiments'/(phase+'.json')
        if not meta_path.exists():continue
        meta=json.loads(meta_path.read_text());commit=meta['source_commit']
        sources={path:digest(subprocess.check_output(['git','show',f'{commit}:{path}'])) for path in TRUSTED}
        # Postprocessing is explicit: Git objects pin the contemporaneous bytes,
        # and they must still match the files used by every recorded oracle run.
        assert all(digest((repo/path).read_bytes())==value for path,value in sources.items())
        for cell in meta['design']:
            out=ROOT/'results'/cell[0]
            if not (out/'experiment.json').exists():continue
            inventory=out/'sealed-inputs.json'
            if not inventory.exists() or json.loads(inventory.read_text())['trusted_sources_sha256']!=sources:
                for path in out.glob('tx-*/attempt-*/heldout/sealed.json'):
                    assert json.loads(path.read_text())['source_sha256']==sources[TRUSTED[0]]
                images={json.loads(p.read_text())['Id'] for p in out.rglob('oracle-image.json')}
                assert images=={meta['oracle_image']}
                inventory.write_text(json.dumps({'recorded_at':datetime.datetime.now().astimezone().isoformat(),
                    'method':'postprocessed from pinned source_commit Git blobs; verified against unchanged input files and held-out receipts',
                    'source_commit':commit,'trusted_sources_sha256':sources,'oracle_images':sorted(images)},indent=2)+'\n')
            if args.artifacts:
                files={str(p.relative_to(out)):{'sha256':digest(p.read_bytes()),'bytes':p.stat().st_size}
                       for p in out.rglob('*') if p.is_file() and p.name!='artifacts.json'}
                (out/'artifacts.json').write_text(json.dumps(files,indent=2)+'\n')
            indexed+=1
    print('Sealed input inventories:',indexed)


if __name__=='__main__':
    main()
