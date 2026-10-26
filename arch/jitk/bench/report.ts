import { basename } from 'node:path';
import { writeFileSync } from 'node:fs';
import { stats, fixed, type Estimate } from './lib.ts';
import { type Frame } from './controller.ts';

export const UNITS: Record<string, string> = { latency_ms: 'ms', refill_vms_s: 'VM/s', cpu_ms_vm: 'CPU-ms/VM', rss_mib: 'MiB RSS', footprint_mib: 'MiB footprint', sandbox_apply_ms: 'ms sandbox_apply', sandbox_prepare_apply_ms: 'ms profile-read+apply', done_to_resolve_ms: 'ms done→resolve' };
export function report(data: Frame, out: string): void {
  const lines = ['# Canonical benchmark results', '',
    `Run: ${data.started_at} → ${data.finished_at || 'RUNNING'}. Platform: ${data.machine.platform}.`,
    `Start: \`${data.machine.uptime}\`. End: \`${data.uptime_end || 'RUNNING'}\`.`, '',
    `Gate: load1 < ${data.config.load_threshold}; ${data.config.gate_budget} s budget/sample. Randomized complete blocks; seed ${data.config.seed}.`,
    'Cold = spawn → validated done; parked = RUN → validated done after READY and 5 ms idle. Tools return asynchronously after 0 or 5 ms as named. JSON case parses/stringifies exactly 1 MiB internally, returns its length (not a 1 MiB protocol frame).',
    'Executor = execute() → validated result; Node startup/pool preparation excluded. Refill = READY + kill/reap, 4 waves per sample. CPU = child user+system through reap; watchdog/supervisor excluded. Parked memory = process RSS/physical footprint, excludes HVF kernel allocations. Sandbox on/off = precompiled sandbox_apply versus clock-only baseline, no VM; not an end-to-end subtraction.',
    'Cached binary/image/signature runs; first validation excluded. Single-use hardware VM except explicitly shared-HW Hyperlight logical clones. No nested-KVM performance.', '',
    'Values and brackets: estimate [95% bootstrap CI], 2,000 IID resamples. Quantiles interpolate order statistics. n=30 p99 is poorly resolved; CI does not remove contention or serial dependence.',
    '**Quiet credibility requires ≥30 gate-passed samples per row. A timed-out gate remains a contended sample; no idle-host conclusion follows. Latency percentiles are conditional on validated results; failures are counted separately and never treated as zero-latency successes.**', '',
    '| Case / metric | n / fail | p50 [CI95] | p90 [CI95] | p99 [CI95] | load1 range | gated / timed-out |',
    '|---|---:|---:|---:|---:|---:|---:|'];
  for (const spec of data.specs) {
    const all: Frame[] = data.samples.filter((r: Frame) => r.name === spec.name);
    const ok = all.filter(r => r.status === 'PASS');
    const failed = all.length - ok.length;
    if (!ok.length) {
      lines.push(`| ${spec.name} | 0 / ${failed} | UNVERIFIED | — | — | — | — |`);
      continue;
    }
    const quiet = ok.filter(r => r.gate.passed);
    const groups: { label: string; rows: Frame[] }[] = [{ label: 'all', rows: ok }];
    if (quiet.length && quiet.length < ok.length) {
      groups.push({ label: 'gate-passed only' + (quiet.length < 30 ? ' · UNVERIFIED n<30' : ''), rows: quiet });
    }
    for (const group of groups) {
      const loads = group.rows.map((r: Frame) => Number(r.load_before[0]));
      const passed = group.rows.filter(r => r.gate.passed).length;
      for (const key of Object.keys(UNITS)) {
        const values = group.rows.filter(r => key in r).map(r => Number(r[key]));
        if (!values.length) {
          continue;
        }
        const st = stats(values);
        const fmt = (estimate: Estimate): string => `${fixed(estimate.value, 3)} [${fixed(estimate.ci95[0], 3)}, ${fixed(estimate.ci95[1], 3)}]`;
        lines.push(`| ${spec.name} · ${UNITS[key]} · ${group.label} | ${values.length} / ${group.label === 'all' ? failed : 0} | ${fmt(st.p50)} | ${fmt(st.p90)} | ${fmt(st.p99)} | ${fixed(Math.min(...loads), 2)}–${fixed(Math.max(...loads), 2)} | ${passed} / ${group.rows.length - passed} |`);
      }
    }
  }
  lines.push('', 'Source selection (frozen at run start):', '', '```json', JSON.stringify(data.selection, null, 2), '```', '',
    'Missing integrations: ' + (data.missing || []).join(', ') + '.',
    `Raw observations, timestamps, gate histories, result assertions, machine state, hashes and failures: [${basename(data.raw_path)}](${basename(data.raw_path)}).`,
    'All external performance claims must cite this table. R2 tables are historical contended measurements.');
  writeFileSync(out, lines.join('\n') + '\n');
}
