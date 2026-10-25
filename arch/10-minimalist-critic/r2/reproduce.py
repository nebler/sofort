#!/usr/bin/env python3
"""Rebuild and reproduce in owned directories; needs Docker, Python, existing oracle image."""
import argparse, os, pathlib, shutil, subprocess, sys
p = argparse.ArgumentParser(); p.add_argument('--boot', action='store_true'); args = p.parse_args()
root = pathlib.Path(__file__).resolve().parent
tmp = pathlib.Path('/tmp/jitk-10/r2'); tmp.mkdir(parents=True, exist_ok=True)
results = root/'results'; results.mkdir(exist_ok=True)
def run(cmd, log):
    with (root/log).open('w') as out:
        subprocess.run(cmd, stdout=out, stderr=subprocess.STDOUT, check=True, timeout=600)
def stamp(path):
    (root/path).write_text(subprocess.check_output(['uptime'],text=True))
def oracle(script, name, log, env=()):
    cmd = ['docker','run','--rm','--name',name,'--platform','linux/arm64','--network','none',
        '--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
        '--pids-limit','16','--memory','512m','--cpus','1','--ulimit','fsize=33554432:33554432',
        '--user','65534:65534','--tmpfs','/tmp:rw,noexec,nosuid,size=16m',
        '--entrypoint','python3','-e','PYTHONDONTWRITEBYTECODE=1']
    for item in env: cmd += ['-e', item]
    cmd += ['-v',f'{tmp}:/bin-input:ro','-v',f'{root}:/review:ro',
            '-v',f'{root}/fixtures:/case:ro','-v',f'{results}:/out:rw',
            'jitk-oracle:08','/review/'+script]
    stamp(name+'-load-before.txt')
    try: run(cmd, log)
    finally:
        subprocess.run(['docker','rm','-f',name],capture_output=True)
        stamp(name+'-load-after.txt')
run([sys.executable,'-B',str(root/'prepare.py')], 'prepare.log')
name='jitk-10-r2-build'
try:
    run(['docker','run','--rm','--name',name,'--platform','linux/arm64','--network','none',
         '--cpus','2','--entrypoint','/bin/sh','-v',f'{tmp}:/work:rw',
         '-v',f'{root}:/review:ro','jitk-oracle:08','/review/build.sh'], 'build.log')
finally: subprocess.run(['docker','rm','-f',name],capture_output=True)
oracle('measure_runtimes.py','jitk-10-r2-oracle','runtime-run.log')
oracle('measure_runtimes.py','jitk-10-r2-extra','extra-run.log',
       ['ORACLE_CASES=sqlite-time-random','ORACLE_SUMMARY=runtime-summary-extra.json'])
oracle('fallback_probes.py','jitk-10-r2-fallback','fallback-run.log',
       ['ORACLE_PROFILES=guard-denied,signals-enosys,combined'])
run([sys.executable,'-B',str(root/'oracle/test_normalize.py')], 'normalizer-tests.log')
run([sys.executable,'-B',str(root/'audit_probes.py')], 'audit-run.log')
for file in ['lua-elf.txt','sqlite-elf.txt']: shutil.copy2(tmp/file,root/file)
if args.boot: run([sys.executable,'-B',str(root/'bench_boot.py')], 'boot-run.log')
