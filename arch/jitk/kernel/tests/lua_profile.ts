import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, quant, loadGate, HOST, uptime } from './measure.ts';
import { capture, check, dump, environment, run, sha, workspace } from '../lib.ts';
const kernel = resolve(import.meta.dirname, '..');
const grow = resolve(kernel, '../grow');
const work = workspace('JITK_LUA_PROFILE_WORK', 'lua-profile');
const payload = join(grow, 'payload/lua-static');
check(sha(readFileSync(payload)) === '6d825f225d7beff5a9707ec10db63cf3347524dc3ba183b16d0f6d809d2f0929');
const env = environment();
env.JITK_ELF = payload;
env.JITK_ARGV_JSON = JSON.stringify(['lua', '-e', readFileSync(join(grow, 'fixtures.lua'), 'utf8')]);
env.CARGO_TARGET_DIR = join(work, 'target');
env.JITK_OUT_DIR = join(work, 'out');
env.JITK_TOOLS_DIR = join(kernel, '.work/bin');
await run(['sh', join(kernel, 'build.sh'), '--features', 'grow-trace'], { env, inherit: true });
const image = join(work, 'out/kernel.bin');
const oracle = readFileSync(process.env.JITK_LUA_ORACLE || join(grow, 'results/canonical-r3/lua-linux-normal/linux-00.stdout'));
check(oracle.toString() === '{"count":5,"sum":23,"max":9}\n');
interface Event { kind: string; seq: number; nr?: number; ret?: number; code?: number }
const samples: unknown[] = [];
const times: number[] = [];
for (let i = 0; i < 30; i += 1) {
  const gate = await loadGate();
  const before = uptime();
  const started = performance.now();
  const result = await capture([HOST, image], { timeout: 10 });
  const elapsed = performance.now() - started;
  check(result.returncode === 0 && result.stderr.length === 0);
  const records: Event[] = [];
  let stdout = '';
  for (const line of result.stdout.toString().split('\n')) {
    if (line.startsWith('\x1e')) {
      records.push(JSON.parse(line.slice(1)) as Event);
    } else if (line) {
      stdout += line + '\n';
    }
  }
  check(stdout === oracle.toString());
  check(!records.some(record => record.kind === 'missing'));
  const signals = new Set(records.filter(record => record.kind === 'sys.enter' && (record.nr === 134 || record.nr === 135)).map(record => record.seq));
  const numbers = new Set(records.filter(record => record.kind === 'sys.enter' && signals.has(record.seq)).map(record => record.nr));
  check(numbers.size === 2 && numbers.has(134) && numbers.has(135));
  check(records.filter(record => record.kind === 'sys.exit' && signals.has(record.seq)).every(record => record.ret === -38));
  check(records[records.length - 1].kind === 'done' && records[records.length - 1].code === 0);
  times.push(elapsed);
  samples.push({ gate, uptime: before, ms: elapsed, signals_enosys: signals.size, status: 'PASS' });
}
const summary = { status: 'PASS', profile: 'always ENOSYS, no signal state or user-pointer access', n: 30, image_sha256: sha(readFileSync(image)), stdout: oracle.toString(), whole_process_ms: quant(times) };
dump(join(ROOT, 'lua-profile.json'), { ...summary, samples });
console.log(JSON.stringify(summary, null, 2));
