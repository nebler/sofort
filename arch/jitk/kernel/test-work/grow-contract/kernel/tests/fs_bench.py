"""Resource-archive cost: image bytes, spawn->READY, parked footprint, and a
guest 1 MiB read, for 0 / 1 / 8 MiB of resources (canonical qjs + bootstrap).
Samples are interleaved round-robin; every sample records the load average.
Optional JITK_FS_BASELINE=/path/kernel.bin adds a pre-feature image."""
from pathlib import Path
import os, sys, json, time, random, statistics, subprocess, importlib.util
sys.path.insert(0, str(Path(__file__).resolve().parent))
from measure import ROOT, VM, quant, load_gate
kernel = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('bench06', kernel.parent / 'bench/run.py')
bench = importlib.util.module_from_spec(spec); spec.loader.exec_module(bench)
work = Path(os.environ.get('JITK_FS_BENCH_WORK', str(kernel / 'test-work/fs-bench'))).resolve()
N = int(os.environ.get('JITK_FS_SAMPLES', '30'))
images = {}
for mib in (0, 1, 8):
    tree = work / f'res-{mib}'
    if not tree.exists():
        rng = random.Random(mib)
        (tree / 'blobs').mkdir(parents=True)
        for i in range(mib * 4):  # 256 KiB incompressible files
            (tree / 'blobs' / f'{i:03}.bin').write_bytes(rng.randbytes(262144))
    env = {**os.environ, 'CARGO_TARGET_DIR': str(work / 'target'), 'JITK_OUT_DIR': str(work / f'img-{mib}')}
    for key in ('JITK_ELF', 'JITK_ARGV_JSON', 'JITK_SCRIPT'): env.pop(key, None)
    subprocess.run(['sh', str(kernel / 'build.sh'), '--resources', str(tree)], env=env, check=True, stdout=subprocess.DEVNULL)
    images[f'{mib}MiB'] = work / f'img-{mib}/kernel.bin'
if os.environ.get('JITK_FS_BASELINE'): images['baseline(pre-fs)'] = Path(os.environ['JITK_FS_BASELINE'])
READ = ('const fd=os.open("/blobs/000.bin",os.O_RDONLY),b=new ArrayBuffer(262144),t=os.now();'
        'for(let i=0;i<4;i++){os.seek(fd,0,std.SEEK_SET);if(os.read(fd,b,0,262144)!==262144)throw 1;}'
        'os.close(fd);return os.now()-t;')
result = {'n': N, 'uptime_start': subprocess.check_output(['uptime'], text=True).strip()}
data = {k: {'ready_ms': [], 'footprint_mib': [], 'rss_mib': [], 'read_1mib_us': [], 'load1': []} for k in images}
for i in range(N):
    for name, img in images.items():
        gate = load_gate()
        v = VM(kernel=str(img))
        try:
            data[name]['ready_ms'].append(v.ready()); time.sleep(.005)
            u = bench.usage(v.p.pid)
            if u: data[name]['footprint_mib'].append(u['footprint'] / 1048576); data[name]['rss_mib'].append(u['rss'] / 1048576)
            if not name.startswith('baseline') and name != '0MiB':
                v.run(READ); m = v.recv(); assert m['t'] == 'done', m; data[name]['read_1mib_us'].append(m['ok'] * 1000)  # os.now() is ms
            data[name]['load1'].append(os.getloadavg()[0])
        finally: v.close()
result['variants'] = {}
for name, img in images.items():
    d = data[name]
    result['variants'][name] = {'image_bytes': img.stat().st_size, 'ready_ms': quant(d['ready_ms']),
        'footprint_mib': quant(d['footprint_mib']) if d['footprint_mib'] else None,
        'rss_mib': quant(d['rss_mib']) if d['rss_mib'] else None,
        'guest_read_1mib_us': quant(d['read_1mib_us']) if d['read_1mib_us'] else None,
        'load1': {'min': min(d['load1']), 'median': statistics.median(d['load1']), 'max': max(d['load1'])}}
result['uptime_end'] = subprocess.check_output(['uptime'], text=True).strip()
(ROOT / 'fs-bench.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
