import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { argument, check, defaultBinary, defaultImages, defaultProfile, dump, environment, median, output, run } from '../lib.ts';
const binary = argument('binary', defaultBinary());
const profile = argument('profile', defaultProfile());
const image = argument('image', join(defaultImages(), 'first.bin'));
const n = Number(argument('n', '30'));
const destination = argument('out', resolve(import.meta.dirname, '..', process.env.JITK_RECORD === '1' ? 'evidence' : '.work', 'sandbox-macos.json'));
interface Sample { apply_ns: number; prepare_and_apply_ns: number; wall_ns: number; uptime: string }
const records: Sample[] = [];
for (let i = 0; i < n + 5; i += 1) {
  const uptime = output(['uptime']).trim();
  const start = performance.now();
  const result = await run([binary, '--image', image, '--sandbox-profile', profile], { env: { ...environment(), JITK_VMM_TIMING: '1' }, timeout: 30 });
  const elapsed = (performance.now() - start) * 1000000;
  const match = /SANDBOX_NS (\d+) PREPARE_AND_APPLY_NS (\d+)/.exec(result.stderr.toString());
  check(match, result.stderr.toString());
  if (i >= 5) {
    records.push({ apply_ns: Number(match[1]), prepare_and_apply_ns: Number(match[2]), wall_ns: elapsed, uptime });
  }
}
function quant(values: number[]): { p50_ms: number; p90_ms: number; p99_ms: number } {
  const sorted = values.map(value => value / 1000000).sort((a, b) => a - b);
  return { p50_ms: median(sorted), p90_ms: sorted[Math.ceil(sorted.length * 0.9) - 1], p99_ms: sorted[Math.ceil(sorted.length * 0.99) - 1] };
}
const summary = { apply_ns: quant(records.map(row => row.apply_ns)), prepare_and_apply_ns: quant(records.map(row => row.prepare_and_apply_ns)), wall_ns: quant(records.map(row => row.wall_ns)) };
mkdirSync(dirname(destination), { recursive: true });
dump(destination, { n, warmups: 5, percentiles: 'median; p90/p99 nearest rank', summary, samples: records });
console.log(JSON.stringify(summary, null, 2));
