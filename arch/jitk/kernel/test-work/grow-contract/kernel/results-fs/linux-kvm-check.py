"""kvm-dev (nested, Linux 7.0 KVM): native-Linux chroot oracle on a ro bind mount,
jitk images under the patched and stock Linux VMMs, bootstrap path, and PSS."""
import json, os, select, subprocess, sys, time, statistics
from pathlib import Path
B = Path(__file__).resolve().parent
PATCHED, STOCK = sys.argv[1], sys.argv[2]
N = 10
out = {'uname': os.uname().release, 'load_start': os.getloadavg()}
# 1. Native oracle: chroot into a read-only bind mount of the same tree.
root = Path('/tmp/jitk-fsroot')
subprocess.run(['sudo', 'sh', '-c', f'umount {root} 2>/dev/null; rm -rf {root}; mkdir -p {root}; cp -a {B}/tree/. {root}/; '
                f'cp {B}/probe {B}/lua {B}/qjs {root}/; find {root} -type f -exec chmod 444 {{}} +; find {root} -type d -exec chmod 555 {{}} +; '
                f'chmod 555 {root}/probe {root}/lua {root}/qjs; mount --bind {root} {root}; mount -o remount,bind,ro {root}'], check=True)
try:
    for name in ('probe', 'lua', 'qjs'):
        argv = json.loads((B / f'{name}.argv.json').read_text())
        r = subprocess.run(['sudo', 'sh', '-c', 'set -o pipefail; ulimit -n 64; chroot "$0" "$@" | cat', str(root), f'/{name}', *argv[1:]],
                           capture_output=True, timeout=60)
        expected = (B / f'{name}.docker.out').read_bytes()
        out[f'native_{name}'] = {'identical_to_docker': r.stdout == expected, 'rc': r.returncode, 'stderr': r.stderr.decode()[:200]}
        if r.stdout != expected: (B / f'{name}.native.out').write_bytes(r.stdout)
finally:
    subprocess.run(['sudo', 'umount', str(root)])
# 2. jitk under KVM (grow-trace images): stdout must equal the oracle.
def run(vmm, img):
    r = subprocess.run([vmm, '--image', str(img)], stdin=subprocess.DEVNULL, capture_output=True, timeout=30)
    app = b''.join(l + b'\n' for l in r.stdout.split(b'\n') if l and not l.startswith(b'\x1e'))
    missing = [l for l in r.stdout.split(b'\n') if b'"missing"' in l]
    return r.returncode, app, missing
for name in ('probe', 'lua', 'qjs'):
    expected = (B / f'{name}.docker.out').read_bytes()
    for label, vmm, n in (('patched', PATCHED, N), ('stock', STOCK, 2)):
        ok = 0
        for _ in range(n):
            rc, app, missing = run(vmm, B / f'img/{name}.bin')
            ok += rc == 0 and app == expected and not missing
            if app != expected: (B / f'{name}.{label}.jitk.out').write_bytes(app)
        out[f'jitk_{name}_{label}'] = f'{ok}/{n}'
# 3. Bootstrap path + 4. parked PSS.
class VM:
    def __init__(self, vmm, img):
        self.p = subprocess.Popen([vmm, '--image', str(img)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.buf = b''
    def recv(self, t=10):
        end = time.monotonic() + t
        while b'\n' not in self.buf:
            r, _, _ = select.select([self.p.stdout], [], [], max(0, end - time.monotonic()))
            if not r: raise TimeoutError(self.buf)
            b = os.read(self.p.stdout.fileno(), 65536)
            if not b: raise RuntimeError(self.buf)
            self.buf += b
        line, self.buf = self.buf.split(b'\n', 1)
        return self.recv(t) if line.startswith(b'\x1e') else json.loads(line)
    def close(self): self.p.kill(); self.p.wait()
v = VM(PATCHED, B / 'img/bootstrap.bin')
try:
    assert v.recv() == {'t': 'ready', 'v': 1}
    v.p.stdin.write(b'{"t":"run","code":"return std.loadFile(\\"/skills/readme.md\\");","ns":{}}\n'); v.p.stdin.flush()
    out['bootstrap_loadFile'] = v.recv()
finally: v.close()
def pss(pid):
    d = {}
    for line in subprocess.check_output(['sudo', 'cat', f'/proc/{pid}/smaps_rollup'], text=True).splitlines():
        k, *rest = line.split()
        if k in ('Rss:', 'Pss:', 'Private_Dirty:'): d[k[:-1]] = int(rest[0]) / 1024
    return d
out['parked_mib'] = {}
for label, vmm in (('patched', PATCHED), ('stock', STOCK)):
    for img in ('orig', 'r0', 'r8'):
        samples = []
        for _ in range(5):
            v = VM(vmm, B / f'img/{img}.bin')
            try:
                assert v.recv() == {'t': 'ready', 'v': 1}; time.sleep(.05); samples.append(pss(v.p.pid))
            finally: v.close()
        out['parked_mib'][f'{label}/{img}'] = {k: round(statistics.median(s[k] for s in samples), 2) for k in samples[0]}
out['load_end'] = os.getloadavg()
print(json.dumps(out, indent=2))
