from pathlib import Path
import os,sys,hashlib,json,subprocess
elf,out=map(Path,sys.argv[1:])
# The executable's dependency file identifies the exact OUT_DIR (feature-specific).
dep=elf.with_suffix('.d').read_text()
import re
packed=Path(re.search(r'(/[^\s]+/out/packed\.rs)',dep)[1]).parent
b=(out/'kernel.bin').read_bytes();sha=hashlib.sha256(b).hexdigest()
manifest=dict(version=3,sha256=sha,image=f'kernel-{sha}.bin',bytes=len(b),ram_mib=32,
    features=json.loads((packed/'features.json').read_text()),syscalls=json.loads((packed/'syscalls.json').read_text()),packed=json.loads((packed/'packed.json').read_text()),
    argv=json.loads((packed/'argv.json').read_text()))
verification=Path(__file__).resolve().parent/'syscalls.manifest.json'
if verification.exists():
    raw=verification.read_bytes(); contracts=json.loads(raw)
    for contract in contracts['contracts']:
        source=verification.parent/'src/syscalls'/f"{contract['name']}.rs"
        # Deleted handlers are intentionally supported by the grow exercise.
        if source.exists():
            assert hashlib.sha256(source.read_bytes()).hexdigest()==contract['source_sha256'], 'stale verification: '+contract['name']
    manifest['verification']=contracts
    manifest['verification_sha256']=hashlib.sha256(raw).hexdigest()
# dist/*.json are recorded evidence. Refresh them only by explicit recording.
if out.resolve() == (Path(__file__).resolve().parent/'dist') and os.getenv('JITK_RECORD') != '1':
    out = out.parent/'.work/dist'
out.mkdir(parents=True, exist_ok=True)
(out/manifest['image']).write_bytes(b)
(out/f'kernel-{sha}.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(dict(image=str(out/manifest['image']),sha256=sha,bytes=len(b))))
