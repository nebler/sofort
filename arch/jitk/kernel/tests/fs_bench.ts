import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadavg } from 'node:os';
import { ROOT, VM, quant, loadGate, uptime } from './measure.ts';
import { check, dump, environment, PythonRandom, run, sleep, usage, workspace } from '../lib.ts';
const kernel = resolve(import.meta.dirname, '..');
const work = workspace('JITK_FS_BENCH_WORK', 'fs-bench');
const samples = Number(process.env.JITK_FS_SAMPLES || '30');
const images = new Map<string, string>();
for (const mib of [0, 1, 8]) {
  const tree = join(work, 'res-' + mib);
  if (!existsSync(tree)) {
    mkdirSync(join(tree, 'blobs'), { recursive: true });
    const rng = new PythonRandom(mib);
    for (let i = 0; i < mib * 4; i += 1) {
      writeFileSync(join(tree, 'blobs', String(i).padStart(3, '0') + '.bin'), rng.bytes(262144));
    }
  }
  const env = environment();
  env.CARGO_TARGET_DIR = join(work, 'target');
  env.JITK_OUT_DIR = join(work, 'img-' + mib);
  env.JITK_TOOLS_DIR = join(kernel, '.work/bin');
  for (const key of ['JITK_ELF', 'JITK_ARGV_JSON', 'JITK_SCRIPT']) {
    delete env[key];
  }
  await run(['sh', join(kernel, 'build.sh'), '--resources', tree], { env });
  images.set(mib + 'MiB', join(work, 'img-' + mib, 'kernel.bin'));
}
if (process.env.JITK_FS_BASELINE) {
  images.set('baseline(pre-fs)', String(process.env.JITK_FS_BASELINE));
}
const READ = 'const fd=os.open("/blobs/000.bin",os.O_RDONLY),b=new ArrayBuffer(262144),t=os.now();for(let i=0;i<4;i++){os.seek(fd,0,std.SEEK_SET);if(os.read(fd,b,0,262144)!==262144)throw 1;}os.close(fd);return os.now()-t;';
interface Data { ready_ms: number[]; footprint_mib: number[]; rss_mib: number[]; read_1mib_us: number[]; load1: number[] }
const data = new Map<string, Data>();
for (const name of images.keys()) {
  data.set(name, { ready_ms: [], footprint_mib: [], rss_mib: [], read_1mib_us: [], load1: [] });
}
const result: Record<string, unknown> = { n: samples, uptime_start: uptime() };
for (let i = 0; i < samples; i += 1) {
  for (const [name, image] of images) {
    await loadGate();
    const vm = new VM(0, image);
    const row = data.get(name)!;
    try {
      row.ready_ms.push(await vm.ready());
      await sleep(5);
      const u = usage(vm.p.pid!);
      if (u) {
        row.footprint_mib.push(u.footprint / 1048576);
        row.rss_mib.push(u.rss / 1048576);
      }
      if (!name.startsWith('baseline') && name !== '0MiB') {
        vm.run(READ);
        const frame = await vm.recv();
        check(frame.t === 'done');
        row.read_1mib_us.push(Number(frame.ok) * 1000);
      }
      row.load1.push(loadavg()[0]);
    } finally {
      await vm.close();
    }
  }
}
const variants: Record<string, unknown> = {};
for (const [name, image] of images) {
  const row = data.get(name)!;
  variants[name] = { image_bytes: statSync(image).size, ready_ms: quant(row.ready_ms), footprint_mib: row.footprint_mib.length ? quant(row.footprint_mib) : null, rss_mib: row.rss_mib.length ? quant(row.rss_mib) : null, guest_read_1mib_us: row.read_1mib_us.length ? quant(row.read_1mib_us) : null, load1: { min: Math.min(...row.load1), median: quant(row.load1).p50, max: Math.max(...row.load1) } };
}
result.variants = variants;
result.uptime_end = uptime();
dump(join(ROOT, 'fs-bench.json'), result);
console.log(JSON.stringify(result, null, 2));
