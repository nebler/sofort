#!/usr/bin/env python3
import json, os, pathlib, subprocess, shlex, shutil
ROOT=pathlib.Path('/tmp/jitk-10');OUT=pathlib.Path(__file__).resolve().parent
SRC=ROOT/'quickjs-2026-06-04'
env=dict(os.environ,ZIG_GLOBAL_CACHE_DIR=str(ROOT/'zig-global'),ZIG_LOCAL_CACHE_DIR=str(ROOT/'zig-local'),TMPDIR=str(ROOT))
zigroot=pathlib.Path(shutil.which('zig')).resolve().parent
headers=zigroot/'lib/libc/include'
noneflags=['-nostdinc','-isystem',str(zigroot/'lib/include')]
for h in ['aarch64-linux-musl','generic-musl','aarch64-linux-any','any-linux-any']: noneflags += ['-isystem',str(headers/h)]
commands=[
 ['clang','--target=aarch64-none-elf',*noneflags,'-O2','-ffreestanding','-ffunction-sections','-I',str(SRC),'-c',str(OUT/'embed_probe.c'),'-o',str(ROOT/'embed-none.o')],
 ['ld.lld','--gc-sections','--error-limit=0','-e','jitk_eval_probe','-o',str(ROOT/'embed-none.elf'),str(ROOT/'embed-none.o'),*[str(p) for p in sorted((ROOT/'none-noatomics').glob('*.o'))]],
 ['zig','cc','-target','aarch64-linux-musl','-static','-O2','-DPROBE_MAIN','-I',str(SRC),str(OUT/'embed_probe.c'),*[str(p) for p in sorted((ROOT/'core-noatomics').glob('*.o'))],'-Wl,--gc-sections','-lm','-s','-o',str(ROOT/'embed-musl')],
 ['docker','run','--rm','--network=none','-v',str(ROOT)+':/probe:ro','alpine:3.22','/probe/embed-musl']]
with open(OUT/'embed-build.log','w') as log:
 for cmd in commands:
    log.write('$ '+shlex.join(cmd)+'\n');log.flush()
    p=subprocess.run(cmd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    log.write(p.stdout+'exit='+str(p.returncode)+'\n');log.flush()
    print(cmd[0],cmd[1:3],'exit',p.returncode,flush=True)
    if cmd[0]=='ld.lld':
      import re
      symbols=sorted(set(re.findall('undefined symbol: (\\S+)',p.stdout)))
      (OUT/'live-link-symbols.txt').write_text('\n'.join(symbols)+'\n')
      print('live missing symbols',len(symbols),flush=True)
    elif p.returncode: raise SystemExit(p.stdout)
print('ELF bytes', (ROOT/'embed-musl').stat().st_size)
