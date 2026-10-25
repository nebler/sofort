"""Differential read-only filesystem gate: identical stdout from native Linux
(Docker linux/arm64 oracle, tree bind-mounted :ro, ulimit -n 64) and fresh jitk
VMs for a raw-syscall probe, Lua stdlib and QuickJS std/os, plus the protocol
bootstrap path. Records each workload's syscall set from grow-trace."""
from pathlib import Path
import os, sys, json, shutil, hashlib, subprocess
sys.path.insert(0, str(Path(__file__).resolve().parent))
from measure import ROOT, VM, quant
kernel = Path(__file__).resolve().parents[1]; fixtures = kernel / 'tests/fixtures/fs'
work = Path(os.environ.get('JITK_FS_WORK', str(kernel / 'test-work/fs'))).resolve(); work.mkdir(parents=True, exist_ok=True)
host = os.environ.get('JITK_TEST_HOST', str(Path(__file__).resolve().parent / 'host.sh'))
N = int(os.environ.get('JITK_FS_SAMPLES', '30'))
LUA = kernel.parent / 'grow/payload/lua-static'; QJS = kernel / 'payload/qjs'
NAMES = {25: 'fcntl', 56: 'openat', 57: 'close', 61: 'getdents64', 62: 'lseek', 63: 'read', 65: 'readv',
         78: 'readlinkat', 79: 'newfstatat'}
QJS_ARGV = ['qjs', '--std', '--memory-limit', '16777216', '-e']

def tree():
    root = work / 'tree'
    if root.exists():
        subprocess.run(['chmod', '-R', 'u+w', str(root)], check=True); shutil.rmtree(root)
    files = {'skills/readme.md': b'# Readme\nhello skills\n\tTab\n', 'skills/empty.txt': b'',
             'skills/sub/deep.txt': b'deep\n', 'scripts/x.lua': b'return 40+2\n',
             'modules/mymod.lua': b'local M={}\nfunction M.f() return "mod-ok" end\nreturn M\n',
             'modules/pkg/init.lua': b'return {name="pkg-init"}\n',
             'data/big.bin': bytes((i * 7 + i // 251) & 255 for i in range(70000))}
    for name, data in files.items():
        (root / name).parent.mkdir(parents=True, exist_ok=True); (root / name).write_bytes(data)
    for p in sorted(root.rglob('*'), reverse=True): p.chmod(0o555 if p.is_dir() else 0o444)
    root.chmod(0o555)
    return root

def probe():
    obj, elf = work / 'probe.o', work / 'probe'
    subprocess.run(['clang', '--target=aarch64-none-elf', '-ffreestanding', '-nostdlib', '-fno-builtin',
                    '-fno-stack-protector', '-O1', '-c', str(fixtures / 'probe.c'), '-o', str(obj)], check=True)
    subprocess.run(['/opt/homebrew/bin/ld.lld', '-T', str(kernel.parent / 'grow/probe.ld'), str(obj), '-o', str(elf)], check=True)
    return elf

def linux(root, elf, argv):
    mounts = sum((['-v', f'{p}:/{p.name}:ro'] for p in sorted(root.iterdir())), [])
    script = 'set -o pipefail; ulimit -n 64; "$@" | cat'
    r = subprocess.run(['docker', 'run', '--rm', '--platform', 'linux/arm64', '--network', 'none', '-w', '/',
                        '--entrypoint', 'sh', *mounts, '-v', f'{elf}:/payload:ro', 'jitk-oracle:08', '-c', script,
                        'sh', '/payload', *argv[1:]], capture_output=True, timeout=120)
    assert r.returncode == 0 and not r.stderr, (r.returncode, r.stderr)
    return r.stdout

def image(name, root, elf, argv):
    env = {**os.environ, 'JITK_ELF': str(elf), 'JITK_ARGV_JSON': json.dumps(argv),
           'CARGO_TARGET_DIR': str(work / 'target'), 'JITK_OUT_DIR': str(work / ('img-' + name))}
    subprocess.run(['sh', str(kernel / 'build.sh'), '--resources', str(root), '--features', 'grow-trace'],
                   env=env, check=True, stdout=subprocess.DEVNULL)
    return work / ('img-' + name) / 'kernel.bin'

def jitk(img):
    r = subprocess.run([host, str(img)], input=b'', capture_output=True, timeout=20)
    assert r.returncode == 0, (r.returncode, r.stderr)
    records, app = [], bytearray()
    for line in r.stdout.split(b'\n'):
        if line.startswith(b'\x1e'): records.append(json.loads(line[1:]))
        elif line: app += line + b'\n'
    assert not any(x['kind'] == 'missing' for x in records), [x for x in records if x['kind'] == 'missing']
    assert records[-1]['kind'] == 'done' and records[-1]['code'] == 0, records[-3:]
    return bytes(app), {x['nr'] for x in records if x['kind'] == 'sys.enter'}

root = tree(); elf = probe()
result = {'load': subprocess.check_output(['uptime'], text=True).strip(), 'samples': N,
          'tree_sha256': hashlib.sha256(b''.join(p.relative_to(root).as_posix().encode() + b'\0' + (p.read_bytes() if p.is_file() else b'')
                                                for p in sorted(root.rglob('*')))).hexdigest()}
cases = {'probe': (elf, ['probe']), 'lua': (LUA, ['lua', '-e', (fixtures / 'workload.lua').read_text()]),
         'qjs': (QJS, QJS_ARGV + [(fixtures / 'workload.js').read_text()])}
for name, (payload, argv) in cases.items():
    expected = linux(root, payload, argv)
    img = image(name, root, payload, argv); used = set()
    for i in range(N):
        got, nrs = jitk(img); used |= nrs
        assert got == expected, (name, i, got.decode(errors='replace'), expected.decode(errors='replace'))
    fs_calls = sorted(NAMES[n] for n in used if n in NAMES)
    result[name] = {'status': 'PASS', 'identical': f'{N}/{N}', 'linux_stdout_sha256': hashlib.sha256(expected).hexdigest(),
                    'lines': expected.count(b'\n'), 'fs_syscalls': fs_calls, 'all_syscalls': sorted(used)}
    print(name, result[name], flush=True)
# Protocol path: the canonical bootstrap already exposes std/os (qjs --std); no API is added.
env = {**os.environ, 'CARGO_TARGET_DIR': str(work / 'target'), 'JITK_OUT_DIR': str(work / 'bootstrap')}
for key in ('JITK_ELF', 'JITK_ARGV_JSON', 'JITK_SCRIPT'): env.pop(key, None)
subprocess.run(['sh', str(kernel / 'build.sh'), '--resources', str(root)], env=env, check=True, stdout=subprocess.DEVNULL)
checks = {'return std.loadFile("/skills/readme.md");': '# Readme\nhello skills\n\tTab\n',
          'return os.readdir("/modules")[0].sort();': ['.', '..', 'mymod.lua', 'pkg'],
          'const e={}; return [std.open("/skills/readme.md","w",e), e.errno];': [None, 30]}
for code, want in checks.items():
    v = VM(kernel=str(work / 'bootstrap/kernel.bin'))
    try:
        v.ready(); v.run(code); m = v.recv(); assert m == {'t': 'done', 'ok': want}, (code, m)
    finally: v.close()
result['bootstrap'] = {'status': 'PASS', 'checks': len(checks)}
result['status'] = 'PASS'
(ROOT / 'fs-diff.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items()}, indent=2))
