import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadavg, release } from 'node:os';
import { capture, check, output, run, same, sleep } from '../lib.ts';
import { VM, quant } from '../tests/measure.ts';
const root = import.meta.dirname;
const patched = process.argv[2];
const stock = process.argv[3];
const result: Record<string, unknown> = { uname: release(), load_start: loadavg() };
const fsroot = '/tmp/jitk-fsroot';
function quote(value: string): string {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
await run(['sudo', 'sh', '-c', `umount ${fsroot} 2>/dev/null; rm -rf ${fsroot}; mkdir -p ${fsroot}; cp -a ${quote(root)}/tree/. ${fsroot}/; cp ${quote(root)}/probe ${quote(root)}/lua ${quote(root)}/qjs ${fsroot}/; find ${fsroot} -type f -exec chmod 444 {} +; find ${fsroot} -type d -exec chmod 555 {} +; chmod 555 ${fsroot}/probe ${fsroot}/lua ${fsroot}/qjs; mount --bind ${fsroot} ${fsroot}; mount -o remount,bind,ro ${fsroot}`]);
try {
  for (const name of ['probe', 'lua', 'qjs']) {
    const argv = JSON.parse(readFileSync(join(root, name + '.argv.json'), 'utf8')) as string[];
    const child = await capture(['sudo', 'sh', '-c', 'set -o pipefail; ulimit -n 64; chroot "$0" "$@" | cat', fsroot, '/' + name, ...argv.slice(1)], { timeout: 60 });
    const expected = readFileSync(join(root, name + '.docker.out'));
    result['native_' + name] = { identical_to_docker: child.stdout.equals(expected), rc: child.returncode, stderr: child.stderr.toString().slice(0, 200) };
    if (!child.stdout.equals(expected)) {
      writeFileSync(join(root, name + '.native.out'), child.stdout);
    }
  }
} finally {
  await capture(['sudo', 'umount', fsroot]);
}
for (const name of ['probe', 'lua', 'qjs']) {
  const expected = readFileSync(join(root, name + '.docker.out'));
  for (const [label, binary, count] of [['patched', patched, 10], ['stock', stock, 2]] as [string, string, number][]) {
    let valid = 0;
    for (let i = 0; i < count; i += 1) {
      const child = await capture([binary, '--image', join(root, 'img', name + '.bin')], { timeout: 30 });
      const lines = child.stdout.toString().split('\n');
      const app = lines.filter(line => line && !line.startsWith('\x1e')).map(line => line + '\n').join('');
      if (child.returncode === 0 && app === expected.toString() && !lines.some(line => line.includes('"missing"'))) {
        valid += 1;
      }
      if (app !== expected.toString()) {
        writeFileSync(join(root, name + '.' + label + '.jitk.out'), app);
      }
    }
    result['jitk_' + name + '_' + label] = valid + '/' + count;
  }
}
function vm(binary: string, image: string): VM {
  return new VM(0, image, false, binary, ['--image']);
}
let child = vm(patched, join(root, 'img/bootstrap.bin'));
try {
  await child.ready();
  child.send({ t: 'run', code: 'return std.loadFile("/skills/readme.md");', ns: {} });
  result.bootstrap_loadFile = await child.recv(10);
} finally {
  await child.close();
}
function pss(pid: number): Record<string, number> {
  const values: Record<string, number> = {};
  for (const line of output(['sudo', 'cat', '/proc/' + pid + '/smaps_rollup']).split('\n')) {
    const fields = line.trim().split(/\s+/);
    if (['Rss:', 'Pss:', 'Private_Dirty:'].includes(fields[0])) {
      values[fields[0].slice(0, -1)] = Number(fields[1]) / 1024;
    }
  }
  return values;
}
const parked: Record<string, unknown> = {};
for (const [label, binary] of [['patched', patched], ['stock', stock]]) {
  for (const image of ['orig', 'r0', 'r8']) {
    const samples: Record<string, number>[] = [];
    for (let i = 0; i < 5; i += 1) {
      child = vm(binary, join(root, 'img', image + '.bin'));
      try {
        await child.ready();
        await sleep(50);
        samples.push(pss(child.p.pid!));
      } finally {
        await child.close();
      }
    }
    const medians: Record<string, number> = {};
    for (const key of Object.keys(samples[0])) {
      medians[key] = Math.round(quant(samples.map(sample => sample[key])).p50 * 100) / 100;
    }
    parked[label + '/' + image] = medians;
  }
}
result.parked_mib = parked;
result.load_end = loadavg();
console.log(JSON.stringify(result, null, 2));
