import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { check, dump } from '../lib.ts';
const root = process.argv[2];
function median(values: number[]): number {
  const sorted = values.sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
}
interface Sample { memory_stat: string; memory_current: number; smaps: Record<string, string> }
interface Receipt { n: number; rep: number; events: { shard: number }[]; samples: Sample[] }
interface Row { n: number; rep: number; privateKiB: number; cgroupKiB: number; kernelKiB: number }
function slope(rows: Row[], key: string): number {
  const x = rows.reduce((sum, row) => sum + row.n, 0) / rows.length;
  const y = rows.reduce((sum, row) => sum + Number((row as unknown as Record<string, number>)[key]), 0) / rows.length;
  return rows.reduce((sum, row) => sum + (row.n - x) * (Number((row as unknown as Record<string, number>)[key]) - y), 0) / rows.reduce((sum, row) => sum + (row.n - x) ** 2, 0);
}
const output: Record<string, unknown> = {};
for (const phase of ['before', 'after']) {
  const directory = join(root, 'kvm', phase);
  const rows: Row[] = [];
  for (const name of readdirSync(directory).filter(name => /^[01]-.*\.json$/.test(name)).sort()) {
    const receipt = JSON.parse(readFileSync(join(directory, name), 'utf8')) as Receipt;
    const pid = String(receipt.events[0].shard);
    const privateValues: number[] = [];
    const cgroup: number[] = [];
    const kernel: number[] = [];
    for (const sample of receipt.samples) {
      const match = /Private_Dirty:\s+(\d+)/.exec(sample.smaps[pid]);
      check(match, 'missing Private_Dirty');
      privateValues.push(Number(match[1]));
      cgroup.push(sample.memory_current / 1024);
      const stat = sample.memory_stat.split('\n').map(line => line.trim().split(/\s+/)).find(fields => fields[0] === 'kernel');
      check(stat, 'missing kernel stat');
      kernel.push(Number(stat[1]) / 1024);
    }
    rows.push({ n: receipt.n, rep: receipt.rep, privateKiB: median(privateValues), cgroupKiB: median(cgroup), kernelKiB: median(kernel) });
  }
  const slopes: Record<string, unknown> = {};
  for (const rep of [0, 1]) {
    const selected = rows.filter(row => row.rep === rep);
    const privateKiB = slope(selected, 'privateKiB');
    const cgroupKiB = slope(selected, 'cgroupKiB');
    const kernelKiB = slope(selected, 'kernelKiB');
    slopes[String(rep)] = { privateKiB, cgroupKiB, kernelKiB, privatePlusKernelMiB: (privateKiB + kernelKiB) / 1024, allInMiB: cgroupKiB / 1024 };
  }
  const timing = JSON.parse(readFileSync(join(directory, 'timing.jsonl'), 'utf8').split('\n')[1]) as unknown;
  output[phase] = { rows, slopes, timing };
}
dump(join(root, 'summary.json'), output);
