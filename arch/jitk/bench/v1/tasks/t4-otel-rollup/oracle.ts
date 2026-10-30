// T4 oracle: collects every recorded OTLP data point (deduplicated by
// instance, method, route, status and interval end, since pages of different
// programs overlap), keeps the scored hour, and recomputes requests, 5xx rate
// and the histogram_quantile p95 per service. p95Ms may be rounded to 0.1 ms
// and errorRate to 4 decimals.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const START = BigInt(Date.parse('2026-10-30T13:00:00Z')) * 1_000_000n;
const END = BigInt(Date.parse('2026-10-30T14:00:00Z')) * 1_000_000n;

interface Want {
  service: string;
  requests: number;
  errorRate: number;
  p95Ms: number;
}
let cached: { services: Want[]; breaching: string[] } | undefined;

function attr(list: { key: string; value: Record<string, string> }[], key: string): string | undefined {
  const found = list.find(a => a.key === key);
  return found ? (found.value.stringValue ?? found.value.intValue) : undefined;
}

function expected() {
  if (cached) return cached;
  const seen = new Set<string>();
  const agg = new Map<string, { requests: number; errors: number; buckets: number[]; bounds: number[] }>();
  for (const line of readFileSync(join(HERE, 'responses.jsonl'), 'utf8').split('\n')) {
    if (!line) continue;
    const call = JSON.parse(line);
    if (call.tool !== 'queryRange' || call.error !== undefined) continue;
    for (const rm of call.response.resourceMetrics) {
      const service = attr(rm.resource.attributes, 'service.name')!;
      const instance = attr(rm.resource.attributes, 'service.instance.id');
      for (const sm of rm.scopeMetrics) {
        for (const metric of sm.metrics) {
          for (const dp of metric.histogram.dataPoints) {
            const end = BigInt(dp.timeUnixNano);
            if (end <= START || end > END) continue;
            const status = Number(attr(dp.attributes, 'http.response.status_code'));
            const id = [
              instance,
              attr(dp.attributes, 'http.request.method'),
              attr(dp.attributes, 'http.route'),
              status,
              dp.timeUnixNano,
            ].join('|');
            if (seen.has(id)) continue;
            seen.add(id);
            let a = agg.get(service);
            if (!a) {
              a = {
                requests: 0,
                errors: 0,
                buckets: new Array(dp.bucketCounts.length).fill(0),
                bounds: dp.explicitBounds,
              };
              agg.set(service, a);
            }
            const count = Number(dp.count);
            a.requests += count;
            if (status >= 500) a.errors += count;
            dp.bucketCounts.forEach((c: string, i: number) => {
              a.buckets[i] += Number(c);
            });
          }
        }
      }
    }
  }
  const services: Want[] = [];
  for (const [service, a] of agg) {
    // Prometheus histogram_quantile over cumulative counts.
    const cumulative: number[] = [];
    a.buckets.reduce((sum, c, i) => (cumulative[i] = sum + c), 0);
    const rank = 0.95 * a.requests;
    const b = cumulative.findIndex(c => c >= rank);
    let p95: number;
    if (b === a.bounds.length) p95 = a.bounds[a.bounds.length - 1];
    else {
      const lower = b === 0 ? 0 : a.bounds[b - 1];
      const below = b === 0 ? 0 : cumulative[b - 1];
      p95 = lower + ((a.bounds[b] - lower) * (rank - below)) / a.buckets[b];
    }
    services.push({ service, requests: a.requests, errorRate: a.errors / a.requests, p95Ms: p95 * 1000 });
  }
  services.sort((x, y) => y.p95Ms - x.p95Ms);
  const breaching = services
    .filter(s => s.p95Ms > 500 || s.errorRate > 0.01)
    .map(s => s.service)
    .sort();
  cached = { services, breaching };
  return cached;
}

export function check(result: unknown): { ok: boolean; reason: string } {
  const want = expected();
  const got = result as {
    window?: { start?: string; end?: string };
    services?: Record<string, unknown>[];
    breaching?: unknown;
  };
  if (!got || typeof got !== 'object' || !Array.isArray(got.services)) return { ok: false, reason: 'no services list' };
  if (
    !got.window ||
    Date.parse(got.window.start ?? '') !== Date.parse('2026-10-30T13:00:00Z') ||
    Date.parse(got.window.end ?? '') !== Date.parse('2026-10-30T14:00:00Z')
  ) {
    return { ok: false, reason: 'wrong window ' + JSON.stringify(got.window) };
  }
  if (got.services.length !== want.services.length) {
    return { ok: false, reason: `expected ${want.services.length} services, got ${got.services.length}` };
  }
  for (let i = 0; i < want.services.length; i++) {
    const w = want.services[i];
    const h = got.services[i];
    if (h.service !== w.service)
      return { ok: false, reason: `services[${i}] is ${h.service}, expected ${w.service} (order by p95)` };
    if (h.requests !== w.requests) return { ok: false, reason: `${w.service} requests ${h.requests} != ${w.requests}` };
    if (typeof h.errorRate !== 'number' || Math.abs(h.errorRate - w.errorRate) > 5e-5) {
      return { ok: false, reason: `${w.service} errorRate ${h.errorRate} != ${w.errorRate}` };
    }
    if (typeof h.p95Ms !== 'number' || Math.abs(h.p95Ms - w.p95Ms) > 0.05 + 1e-9) {
      return { ok: false, reason: `${w.service} p95Ms ${h.p95Ms} != ${w.p95Ms}` };
    }
  }
  if (!Array.isArray(got.breaching) || JSON.stringify(got.breaching) !== JSON.stringify(want.breaching)) {
    return {
      ok: false,
      reason: 'breaching ' + JSON.stringify(got.breaching) + ' != ' + JSON.stringify(want.breaching),
    };
  }
  return { ok: true, reason: `${want.services.length} services; breaching ${want.breaching.join(', ')}` };
}

export default check;
