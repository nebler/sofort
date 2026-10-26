import { join, basename, relative, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { readJSON, dump, stats, Random, check, sha, hashJSON } from './lib.ts';
import { UNITS, report } from './report.ts';
import { pairedSummary } from './paired.ts';
import { type Frame } from './controller.ts';

function replay(inputs: string[], out: string): Frame {
const orders: Frame[] = [];
const random: Frame[] = [];
const statistics: Frame[] = [];
const paired: Frame[] = [];
const result: Frame = { orders, random, statistics, paired };
for (const seed of [0, 1, 601, 603, 39009, 4294967297, -604]) {
  const rng = new Random(seed);
  const order = Array.from({ length: 37 }, (_, i) => i);
  rng.shuffle(order);
  orders.push({ seed, order });
  random.push({ seed, values: Array.from({ length: 100 }, () => rng.random()) });
}
for (const input of inputs) {
  const sourceLabel = relative(import.meta.dirname, resolve(input)).replace(/\//g, '-');
  const data = readJSON<Frame>(input);
  if (data.summary && !data.specs) {
    for (const passName of Array.from(new Set<string>((data.samples as Frame[]).map(r => String(r.pass)))).sort()) {
      paired.push({ pass: passName, summary: pairedSummary((data.samples as Frame[]).filter(r => r.pass === passName)) });
    }
    continue;
  }
  for (const name of Array.from(new Set<string>((data.samples as Frame[]).map(r => String(r.name)))).sort()) {
    const all = (data.samples as Frame[]).filter(r => r.name === name && r.status === 'PASS');
    for (const group of ['all', 'quiet']) {
      const rows = group === 'all' ? all : all.filter(r => r.gate.passed);
      for (const key of Object.keys(UNITS)) {
        const xs = rows.filter(r => key in r).map(r => Number(r[key]));
        if (xs.length) {
          statistics.push({ input: sourceLabel, name, group, key, stats: stats(xs) });
        }
      }
    }
  }
  report(data, join(out, sourceLabel + '.md'));
}
return result;
}

const HERE = import.meta.dirname;
if (process.argv[2] === '--test') {
  const fixture = readJSON<Frame>(join(HERE, 'parity-fixture.json'));
  const inputs: string[] = [];
  for (const source of fixture.sources) {
    const path = join(HERE, source.path);
    check(sha(path) === source.sha256, 'parity input changed: ' + source.path);
    inputs.push(path);
  }
  const out = join(HERE, 'build/parity-reports');
  mkdirSync(out, { recursive: true });
  const result = replay(inputs, out);
  check(hashJSON(result) === fixture.statistics_digest, 'statistics/order/bootstrap parity regression');
  for (const entry of fixture.reports) {
    check(sha(join(out, entry.path)) === entry.sha256, 'report parity regression: ' + entry.path);
  }
  console.log('PASS MT19937 orders/draws, 460 recorded statistic groups, paired recertification, exact report formatting');
} else {
  const out = String(process.argv[2]);
  dump(join(out, 'statistics.json'), replay(process.argv.slice(3), out));
}
