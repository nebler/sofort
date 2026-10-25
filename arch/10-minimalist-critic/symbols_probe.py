#!/usr/bin/env python3
"""Reproduce ELF symbol footprint; all build/cache writes stay in /tmp/jitk-10."""
import hashlib, json, os, pathlib, shutil, subprocess, tarfile, urllib.request
ROOT = pathlib.Path('/tmp/jitk-10')
ROOT.mkdir(exist_ok=True)
os.environ.update(ZIG_GLOBAL_CACHE_DIR=str(ROOT/'zig-global'), ZIG_LOCAL_CACHE_DIR=str(ROOT/'zig-local'), TMPDIR=str(ROOT))
SRC = ROOT/'quickjs-2026-06-04'
URL = 'https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz'
if not SRC.exists():
    p = ROOT/'quickjs.tar.xz'; p.write_bytes(urllib.request.urlopen(URL).read())
    assert hashlib.sha256(p.read_bytes()).hexdigest() == 'b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a'
    with tarfile.open(p) as t: t.extractall(ROOT, filter='data')
OUT = pathlib.Path(__file__).resolve().parent
log = open(OUT/'symbols-build.log', 'w')
def run(args, check=True):
    log.write('$ '+__import__('shlex').join(map(str,args))+'\n'); log.flush()
    p = subprocess.run(list(map(str,args)), text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    log.write(p.stdout); log.flush()
    if check and p.returncode: raise RuntimeError(p.stdout)
    return p
flags = ['-DNDEBUG','-O2','-ffreestanding','-ffunction-sections','-fdata-sections','-fno-stack-protector','-D_GNU_SOURCE','-DCONFIG_VERSION="2026-06-04"','-I',str(SRC)]
core = ['quickjs','cutils','dtoa','libregexp','libunicode']
# Negative control: naked freestanding target has no libc headers.
p = run(['zig','cc','-target','aarch64-freestanding',*flags,'-c',SRC/'quickjs.c','-o',ROOT/'naked.o'], False)
print('naked freestanding return',p.returncode)
# Preserve stack checks; disable ONLY OS-backed Atomics in a copied translation unit.
patched = ROOT/'quickjs-noatomics.c'
text = (SRC/'quickjs.c').read_text()
needle = '#if !defined(__EMSCRIPTEN__)\n#define CONFIG_ATOMICS\n#endif'
assert text.count(needle) == 1
patched.write_text(text.replace(needle,'/* jitk: single vCPU, no Atomics.wait or shared memory */'))
zigroot = pathlib.Path(shutil.which('zig')).resolve().parent
headers = zigroot/'lib/libc/include'
noneflags = ['-include','malloc.h','-nostdinc','-isystem',str(zigroot/'lib/include'),'-isystem',str(headers/'aarch64-linux-musl'),'-isystem',str(headers/'generic-musl'),'-isystem',str(headers/'aarch64-linux-any'),'-isystem',str(headers/'any-linux-any')]
results = {}
for variant, names in [('core-stock',core),('core-noatomics',core),('shell-stock',core+['quickjs-libc','qjs']),('none-noatomics',core)]:
    dest=ROOT/variant; dest.mkdir(exist_ok=True)
    for name in names:
        source=patched if name=='quickjs' and 'noatomics' in variant else SRC/(name+'.c')
        cc = ['zig','cc','-target','aarch64-linux-musl'] if not variant.startswith('none') else ['clang','--target=aarch64-none-elf',*noneflags]
        run([*cc,*flags,'-c',source,'-o',dest/(name+'.o')])
    undefined,defined=set(),set()
    for obj in sorted(dest.glob('*.o')):
        p=run(['llvm-nm','--format=posix','--extern-only',obj])
        for line in p.stdout.splitlines():
            bits=line.split()
            if len(bits)<2:continue
            (undefined if bits[1] in ('U','w','v') else defined).add(bits[0])
    external=sorted(undefined-defined)
    (OUT/(variant+'-symbols.txt')).write_text('\n'.join(external)+'\n')
    results[variant]={'external_count':len(external),'symbols':external}
    print(variant,len(external), ' '.join(external))
(OUT/'symbols.json').write_text(json.dumps(results,indent=2)+'\n')
