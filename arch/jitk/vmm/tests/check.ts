import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { platform } from 'node:os';
import { argument, capture, check, defaultBinary, defaultImages, defaultProfile, dump, output, run, Session, sha, sleep } from '../lib.ts';
const root = process.env.JITK_VMM_ROOT || resolve(import.meta.dirname, '..');
const binary = argument('binary', defaultBinary());
const images = resolve(argument('images', defaultImages()));
const profile = argument('profile', defaultProfile());
let kernel = argument('kernel');
if (!kernel) {
  kernel = join(images, 'kernel.bin');
  writeFileSync(kernel, readFileSync(resolve(root, '../kernel/dist/kernel.bin')));
}
const destination = argument('output', join(root, process.env.JITK_RECORD === '1' ? 'evidence' : '.work', 'checks-' + platform() + '.json'));
const repeats = Number(argument('repeats', '30'));
const mac = platform() === 'darwin';
const extra = mac ? ['--sandbox-profile', profile] : [];
function uptime(): string {
  try {
    return output(['uptime']).trim();
  } catch {
    return 'uptime_s=' + readFileSync('/proc/uptime', 'utf8').trim() + ' loadavg=' + readFileSync('/proc/loadavg', 'utf8').trim();
  }
}
const checks: Record<string, boolean> = {};
interface Fault { rc: number; watchdog: boolean; ms: number; uptime: string; stderr: string }
const faults: Record<string, Fault[]> = {};
const result: Record<string, unknown> = { uptime: uptime(), checks, faults, samples: [] };
async function guest(argv: string[], data = Buffer.alloc(0), watchdog = false): Promise<Awaited<ReturnType<typeof capture>>> {
  const result = await capture([binary, ...argv, ...extra], { input: data, timeout: watchdog ? 0.5 : 30 });
  check(watchdog || !result.timeout, 'TIMEOUT ' + JSON.stringify(argv));
  return result;
}
function mark(name: string, valid: unknown): void {
  check(valid, name);
  checks[name] = true;
  console.log('PASS ' + name);
}
for (const [name, argv] of [
  ['no-image', []],
  ['bad-mem', ['--image', join(images, 'first.bin'), '--mem-mib', '33']],
  ['bad-seed', ['--image', join(images, 'first.bin'), '--seed', 'ab']],
  ['unknown', ['--whatever']]
] as [string, string[]][]) {
  const result = await guest(argv);
  mark(name, result.returncode === 70 && result.stdout.length === 0);
}
const seed = '00112233445566778899AABBCCDDEEFF';
const epoch = '1792800000000000000';
let child = await guest(['--image', join(images, 'first.bin'), '--seed', seed, '--epoch-ns', epoch]);
const probe = child.stdout.toString();
mark('seed-epoch-counter-single-console', child.returncode === 0 && probe.includes('jitk.seed=' + seed.toLowerCase()) && probe.includes('jitk.epoch_ns=' + epoch) && probe.includes('jitk.counter=') && probe.split('node virtio_mmio@').length - 1 === 1 && probe.includes('virtio-count=0000000000000001'));
result.probe_stdout = probe;
const payload = Buffer.from(Array.from({ length: 1000 }, (_, i) => 33 + i % 90));
child = await guest(['--image', join(images, 'first.bin'), '--wait-go']);
mark('eof-before-go', child.returncode === 70 && child.stdout.length === 0 && child.stderr.toString().includes('EOF before go byte'));
const session = new Session([binary, '--image', kernel, ...extra]);
try {
  let ready = false;
  let called = false;
  let done = false;
  while (!done) {
    const line = await session.line();
    if (line.startsWith('\x1e')) {
      continue;
    }
    const frame = JSON.parse(line) as { t: string; v?: number; id?: number; ns?: string; fn?: string; args?: number[]; ok?: number };
    if (frame.t === 'ready') {
      check(!ready && frame.v === 1);
      ready = true;
      const deadline = performance.now() + 30000;
      while (!session.stderr.includes('{"sandbox":"ok"}\n')) {
        check(performance.now() < deadline, 'missing confinement ack');
        await sleep(1);
      }
      session.send({ t: 'run', code: 'return (await test.echo(41)) + 1;', ns: { test: ['echo'] } });
    } else if (frame.t === 'call') {
      check(ready && JSON.stringify(frame) === '{"t":"call","id":1,"ns":"test","fn":"echo","args":[41]}', JSON.stringify(frame));
      called = true;
      session.send({ t: 'ret', id: 1, ok: 41 });
    } else if (frame.t === 'done') {
      check(called && JSON.stringify(frame) === '{"t":"done","ok":42}');
      done = true;
    } else {
      throw new Error(line);
    }
  }
  mark('real-qjs-ready-and-one-tool', ready && called && done);
} finally {
  await session.close();
}
child = await guest(['--image', join(images, mac ? 'parking.bin' : 'byteecho.bin'), '--wait-go'], Buffer.concat([Buffer.from('g'), payload]));
mark('wait-go-preserves-1000-following-bytes', child.returncode === 0 && child.stdout.subarray(-payload.length).equals(payload) && child.stderr.toString().includes('WAIT_GO'));
const guests = ['unknown-hvc', 'unknown-smc', 'mmio-halfword', 'bad-sysreg', 'console_avail_oob', 'rtc_oob_read'];
if (!mac) {
  guests.push('bad-sysreg-handled');
}
for (const name of guests) {
  console.log('GUEST ' + name);
  const records: Fault[] = [];
  for (let i = 0; i < repeats; i += 1) {
    const load = uptime();
    const start = performance.now();
    const watchdog = !mac && name === 'bad-sysreg';
    const sample = await guest(['--image', join(images, name + '.bin')], Buffer.alloc(0), watchdog);
    const expected = mac && name === 'bad-sysreg' ? [75] : watchdog ? [0, 1, -9] : [0];
    check(expected.includes(sample.returncode), name + ': ' + sample.returncode + sample.stderr.toString());
    if (sample.returncode === -9) {
      check(sample.stderr.toString().includes('{"sandbox":"ok"}\n'), 'watchdog fired before confinement');
    }
    records.push({ rc: sample.returncode, watchdog: sample.timeout, ms: performance.now() - start, uptime: load, stderr: sample.stderr.toString() });
  }
  faults[name] = records;
}
mark('invalid-hvc-clean-exit', faults['unknown-hvc'].every(row => row.rc === 0));
const source = readFileSync(join(root, 'src/main.rs'), 'utf8');
mark('one-console-native-cli', !source.includes('add_default_console') && source.split('add_inout_port(').length - 1 === 1);
mark('no-libkrun-dylib', !output([mac ? 'otool' : 'ldd', ...(mac ? ['-L'] : []), binary]).includes('libkrun'));
if (mac) {
  await run(['codesign', '--verify', '--strict', binary]);
  mark('signature', true);
} else {
  mark('linux-aarch64', output(['uname', '-m']).includes('aarch64'));
}
result.binary_sha256 = sha(readFileSync(binary));
result.uptime_end = uptime();
mkdirSync(dirname(destination), { recursive: true });
dump(destination, result);
console.log(JSON.stringify({ checks, fault_runs: Object.values(faults).reduce((sum, rows) => sum + rows.length, 0) }, null, 2));
