import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { platform } from 'node:os';
import { argument, capture, defaultBinary, defaultImages, defaultProfile, dump, fixed3, median, output, sleep } from '../lib.ts';
declare function nativeChildrenCPU(): number;
const binary = argument('binary', defaultBinary());
const images = argument('images', defaultImages());
const profile = argument('profile', defaultProfile());
const repeats = Number(argument('repeats', '30'));
const modes = argument('modes', '1,2,3,4,5,6,7,8,9').split(',').map(Number);
const deadline = Number(argument('deadline', '3'));
const root = process.env.JITK_VMM_ROOT || resolve(import.meta.dirname, '..');
const destination = argument('output', join(root, process.env.JITK_RECORD === '1' ? 'evidence' : '.work', 'console-abuse-' + platform() + '.json'));
const extra = platform() === 'darwin' ? ['--sandbox-profile', profile] : [];
interface Row { rc: number; watchdog: boolean; wall_s: number; cpu_s: number; alive: boolean; ack: boolean; vmcreate_retry: boolean }
async function once(mode: number): Promise<Row> {
  const start = performance.now();
  const cpu = nativeChildrenCPU();
  const result = await capture([binary, '--image', join(images, 'console-abuse-' + mode + '.bin'), '--mem-mib', '32', ...extra], { input: Buffer.from(mode === 8 || mode === 9 ? 'x' : ''), holdStdin: mode !== 7, timeout: deadline });
  return { rc: result.returncode, watchdog: result.timeout, wall_s: (performance.now() - start) / 1000, cpu_s: nativeChildrenCPU() - cpu, alive: result.stdout.toString().includes('ALIVE ' + mode), ack: result.stderr.toString().includes('{"sandbox":"ok"}\n'), vmcreate_retry: result.stderr.toString().includes('VmCreate') };
}
function uptime(): string {
  try {
    return output(['uptime']).trim();
  } catch {
    return 'loadavg=' + readFileSync('/proc/loadavg', 'utf8').trim();
  }
}
const results: Record<string, unknown> = {};
const result = { binary, uptime: uptime(), modes: results, uptime_end: '' };
let passed = true;
for (const mode of modes) {
  const rows: Row[] = [];
  while (rows.length < repeats) {
    const row = await once(mode);
    if (row.vmcreate_retry) {
      await sleep(500);
      continue;
    }
    rows.push(row);
  }
  const valid = rows.filter(row => mode === 7 ? row.watchdog && row.cpu_s < 0.5 * deadline : row.rc === 0 && row.alive).length;
  passed = passed && valid === rows.length;
  const cpu = rows.map(row => row.cpu_s).sort((a, b) => a - b);
  const wall = rows.map(row => row.wall_s).sort((a, b) => a - b);
  results[String(mode)] = { pass: valid, n: rows.length, cpu_s_p50: cpu[Math.floor(cpu.length / 2)], cpu_s_max: cpu[cpu.length - 1], wall_s_p50: wall[Math.floor(wall.length / 2)], rows };
  console.log(`mode ${mode}: ${valid}/${rows.length} pass  cpu p50 ${fixed3(cpu[Math.floor(cpu.length / 2)])}s max ${fixed3(cpu[cpu.length - 1])}s  wall p50 ${fixed3(wall[Math.floor(wall.length / 2)])}s`);
}
result.uptime_end = uptime();
mkdirSync(dirname(destination), { recursive: true });
dump(destination, result);
process.exitCode = passed ? 0 : 1;
