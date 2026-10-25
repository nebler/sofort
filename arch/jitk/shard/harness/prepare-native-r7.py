#!/usr/bin/env python3
"""Offline Linux build/prepare from checksum-pinned, existing census artifacts.
Run in an agent-owned source checkout under /home/dev/r7-bytes. Existing immutable
snapshot files are never replaced. No third-party binary is run by this script.
"""
import hashlib, json, os, pathlib, subprocess
ROOT = pathlib.Path(os.environ.get('JITK_NATIVE_ROOT', '/home/dev/r7-bytes')).resolve()
CENSUS = pathlib.Path('/home/dev/r6-census/raw')
PINS = {
    'jq-musl': ('jq-musl','8d689ba1c53a9aed4311a2f4406a33e8c7bbb4d7a54f50a7c8e1d393807e3ff7'),
    'sqlite3': ('sqlite3','005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff'),
    'lua': ('lua','6d825f225d7beff5a9707ec10db63cf3347524dc3ba183b16d0f6d809d2f0929'),
    'micropython': ('micropython','4626bf11458cb18785515ddc8a26246a12aafa602fa197346327602489c4ca62'),
    'busybox': ('bb-gzip','e6e0d9874eef980f1bf6ce107494bbaed97f37449815acb991f4dd0ed4eb5ec8'),
    'zstd': ('zstd','5a52c331442b8939469c1337d2526167f4f17bf16fe976b37d8b8c1246b3002c'),
}
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(65536),b''):h.update(b)
    return h.hexdigest()
def main():
    raw=ROOT/'raw';raw.mkdir(exist_ok=True)
    images=ROOT/'images';images.mkdir(exist_ok=True)
    env=dict(os.environ,PATH='/home/dev/.cargo/bin:'+os.environ['PATH'],RUSTUP_TOOLCHAIN='stable')
    with (raw/'shard-build.log').open('wb') as log:
        subprocess.run(['cargo','build','--release','--locked','--offline'],cwd=ROOT/'arch/jitk/shard',env=env,stdout=log,stderr=log,check=True)
    profiles={};prepared={}
    for name,(original,pin) in PINS.items():
        metadata=json.loads((CENSUS/original/'metadata.json').read_text())
        binary=pathlib.Path(metadata['binary'])
        assert sha(binary)==metadata['sha256']==pin, f'census checksum mismatch: {name}'
        profiles[name]=dict(binary=str(binary),sha256=pin,bytes=binary.stat().st_size)
        base=images/f'{name}-r7'
        assert not base.with_suffix('.mem').exists() and not base.with_suffix('.regs').exists(), f'snapshot already exists: {base}'
        buildenv=dict(env,JITK_ELF=str(binary),JITK_RING_NATIVE='1',JITK_RING_OUT=str(base.with_suffix('.bin')))
        with (raw/f'build-{name}.log').open('wb') as log:
            subprocess.run(['sh','build-ring.sh'],cwd=ROOT/'arch/jitk/kernel',env=buildenv,stdout=log,stderr=log,check=True)
        with (raw/f'prepare-{name}.jsonl').open('wb') as out, (raw/f'prepare-{name}.stderr').open('wb') as err:
            subprocess.run(['flock','-w','600','/home/dev/bench.lock',str(ROOT/'arch/jitk/shard/target/release/real'),
                            'prepare',str(base.with_suffix('.bin')),str(base)],stdout=out,stderr=err,check=True)
        prepared[name]={ext:dict(sha256=sha(base.with_suffix('.'+ext)),bytes=base.with_suffix('.'+ext).stat().st_size) for ext in ['bin','mem','regs']}
        print(name,'prepared',flush=True)
    (ROOT/'profiles.json').write_text(json.dumps(profiles,indent=2)+'\n')
    (raw/'prepared.json').write_text(json.dumps(prepared,indent=2)+'\n')
if __name__=='__main__':main()
