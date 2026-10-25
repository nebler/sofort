import os,pathlib,shutil,subprocess
root=pathlib.Path('/home/dev/r7-shard')
source=root/'arch/jitk/kernel'
pilot=root/'pilot-kernel'
shutil.copytree(source,pilot,ignore=shutil.ignore_patterns('target*','dist','test-work','test-results','results-*','__pycache__','._*'))
page=pilot/'src/arch/aarch64/page_tables.rs'
original=page.read_text()
ledger=(root/'arch/jitk/shard/harness/ledger-r6.py').read_text().replace('[1,16,64,256]','[1,64]')
(root/'pilot-ledger.py').write_text(ledger)
for kb in [128,256]:
    page.write_text(original.replace('const BRK_BYTES: usize = 0x10000;',f'const BRK_BYTES: usize = {kb*1024};'))
    out=root/f'raw-pilot-brk{kb}';out.mkdir()
    env=dict(os.environ,PATH='/home/dev/.cargo/bin:'+os.environ['PATH'],RUSTUP_TOOLCHAIN='stable')
    with (out/'kernel-build.log').open('w') as log:
        subprocess.run(['sh','build-ring.sh'],cwd=pilot,env=env,stdout=log,stderr=log,check=True)
    binary=root/'arch/jitk/shard/target/release/real'
    snap=f'pilot-brk{kb}'
    with (out/'prepare.jsonl').open('w') as log:
        subprocess.run([str(binary),'prepare',str(pilot/'dist/kernel-ring.bin'),snap],cwd=root,stdout=log,check=True)
    for fixture in ['return2','one_tool','promise10','canary']:
        with (out/f'bench-{fixture}.jsonl').open('w') as log:
            subprocess.run([str(binary),'bench',snap,fixture,'3'],cwd=root,stdout=log,check=True)
    subprocess.run(['sudo','-n','env','JITK_SHARD_THREADS=4',f'JITK_LEDGER_ROOT={root}',f'JITK_LEDGER_CGROUP=/sys/fs/cgroup/r7-shard-pilot{kb}',f'JITK_LEDGER_SNAPSHOT={snap}',f'JITK_LEDGER_OUTPUT={out}','JITK_LEDGER_FIXTURES=return2 one_tool promise10','python3',str(root/'pilot-ledger.py')],cwd=root,check=True)
    subprocess.run(['sudo','-n','rmdir',f'/sys/fs/cgroup/r7-shard-pilot{kb}'],check=True)
