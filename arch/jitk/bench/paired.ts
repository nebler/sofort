import { median, stats } from './lib.ts';
import { type Frame, type Spec } from './controller.ts';

export const SPECS: Spec[] = [['jitk-cold', 'return2'], ['jitk-parked-raw', 'one_tool'], ['jitk-parked-raw', 'promise10_5ms'], ['jitk-parked-memory', 'one_tool']].map(([mode, caseName]) => ({ name: mode + '/' + caseName, mode, case: caseName }));
export function pairedSummary(rows: Frame[]): Frame[] {
  const result: Frame[] = [];
  for (const spec of SPECS) {
    const a = rows.filter(r => r.name === spec.name);
    for (const metric of ['latency_ms', 'footprint_mib', 'rss_mib', 'cpu_ms_vm']) {
      const pairs: number[][] = [];
      const blocks = Array.from(new Set<number>(a.map(r => Number(r.block)))).sort((x, y) => x - y);
      for (const block of blocks) {
        const pair = new Map<string, number>();
        for (const r of a.filter(r => r.block === block && r.status === 'PASS' && metric in r)) {
          pair.set(r.build, r[metric]);
        }
        if (pair.size === 2) {
          pairs.push([Number(pair.get('baseline')), Number(pair.get('v2'))]);
        }
      }
      if (!pairs.length) {
        continue;
      }
      const estimate = stats(pairs.map(p => p[1] - p[0])).p50;
      const loads = a.map(r => Number(r.load_before[0]));
      result.push({ case: spec.name, metric, pairs: pairs.length, baseline_median: median(pairs.map(p => p[0])), v2_median: median(pairs.map(p => p[1])), paired_median_difference: estimate.value, paired_ci95: estimate.ci95, load1_range: [Math.min(...loads), Math.max(...loads)], gate_passed: a.filter(r => r.gate.passed).length, samples: a.length, failures: a.filter(r => r.status !== 'PASS').length });
    }
  }
  return result;
}
