// T4 dataset, synthetic and seeded: two hours (12:00-14:00 UTC, 2026-10-30)
// of OpenTelemetry http.server.request.duration delta histograms, one data
// point per minute per (service, instance, method+route, status code), in
// OTLP/JSON encoding (64-bit integers as strings, enums as numbers). Request
// latencies are sampled per request from per-route log-normals and bucketed
// with the semantic-convention default bounds. Two incidents are seeded in
// the scored hour (13:00-14:00): payments-api slows down from 13:35, and
// search-api returns 5xx bursts between 13:10 and 13:20.
import { PythonRandom } from '../lib/synthetic.ts';

export const SEED = 20261030;
export const DAY_START = Date.parse('2026-10-30T12:00:00Z');
export const MINUTES = 120;
export const BOUNDS = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10];

interface Route {
  method: string;
  route: string;
  rpm: number; // mean requests per minute per instance
  medianMs: number;
  sigma: number;
}
interface Service {
  name: string;
  region: string;
  routes: Route[];
}

const SERVICES: Service[] = [
  {
    name: 'checkout-api',
    region: 'eu-west-1',
    routes: [
      r('POST', '/v1/checkout', 40, 180, 0.45),
      r('GET', '/v1/checkout/{id}', 90, 35, 0.4),
      r('POST', '/v1/checkout/{id}/confirm', 25, 260, 0.5),
    ],
  },
  {
    name: 'payments-api',
    region: 'eu-west-1',
    routes: [
      r('POST', '/v2/payments', 30, 210, 0.4),
      r('GET', '/v2/payments/{id}', 70, 28, 0.35),
      r('POST', '/v2/refunds', 6, 320, 0.45),
    ],
  },
  {
    name: 'search-api',
    region: 'eu-central-1',
    routes: [r('GET', '/search', 260, 60, 0.6), r('GET', '/suggest', 400, 12, 0.5)],
  },
  {
    name: 'catalog-api',
    region: 'eu-central-1',
    routes: [
      r('GET', '/products/{sku}', 300, 18, 0.4),
      r('GET', '/categories/{id}', 80, 25, 0.4),
      r('PUT', '/products/{sku}', 4, 90, 0.5),
    ],
  },
  {
    name: 'cart-api',
    region: 'eu-west-1',
    routes: [
      r('GET', '/cart', 150, 22, 0.35),
      r('POST', '/cart/items', 60, 45, 0.4),
      r('DELETE', '/cart/items/{id}', 15, 40, 0.4),
    ],
  },
  {
    name: 'identity-api',
    region: 'eu-west-1',
    routes: [r('POST', '/oauth/token', 120, 75, 0.35), r('GET', '/userinfo', 200, 9, 0.3)],
  },
  {
    name: 'inventory-api',
    region: 'eu-central-1',
    routes: [r('GET', '/stock/{sku}', 180, 14, 0.4), r('POST', '/reservations', 35, 95, 0.5)],
  },
  {
    name: 'shipping-api',
    region: 'eu-west-1',
    routes: [r('POST', '/quotes', 45, 340, 0.4), r('GET', '/tracking/{id}', 50, 120, 0.45)],
  },
  { name: 'notifications-worker', region: 'eu-central-1', routes: [r('POST', '/internal/notify', 70, 55, 0.6)] },
  {
    name: 'recommendations-api',
    region: 'eu-central-1',
    routes: [r('GET', '/recs/{user}', 110, 140, 0.55), r('GET', '/recs/similar/{sku}', 60, 95, 0.5)],
  },
];

function r(method: string, route: string, rpm: number, medianMs: number, sigma: number): Route {
  return { method, route, rpm, medianMs, sigma };
}

export type Attr = { key: string; value: { stringValue?: string; intValue?: string } };
export interface DataPoint {
  attributes: Attr[];
  startTimeUnixNano: string;
  timeUnixNano: string;
  count: string;
  sum: number;
  bucketCounts: string[];
  explicitBounds: number[];
  min: number;
  max: number;
}
export interface Resource {
  attributes: Attr[];
}
// One point with the resource it belongs to (pages regroup them in OTLP form).
export interface Row {
  service: string;
  resourceKey: string;
  resource: Resource;
  point: DataPoint;
  endMs: number;
}

const str = (key: string, value: string): Attr => ({ key, value: { stringValue: value } });

function normal(rng: PythonRandom): number {
  const u = 1 - rng.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.random());
}

// Poisson by inversion for small means, normal approximation for large.
function poisson(rng: PythonRandom, mean: number): number {
  if (mean > 50) return Math.max(0, Math.round(mean + Math.sqrt(mean) * normal(rng)));
  const limit = Math.exp(-mean);
  let k = 0;
  let p = rng.random();
  while (p > limit) {
    k++;
    p *= rng.random();
  }
  return k;
}

const ns = (ms: number) => String(BigInt(ms) * 1_000_000n);

export function buildRows(): { rows: Row[]; services: { name: string; instances: string[]; region: string }[] } {
  const rng = new PythonRandom(SEED);
  const rows: Row[] = [];
  const catalog: { name: string; instances: string[]; region: string }[] = [];
  const resources = SERVICES.map(service => {
    const instances = [0, 1].map(
      i =>
        `${service.name}-${['7c9f4b6d8', '5d48c7f9b', '84b6d2c71'][i]}-${['x2kqp', 'm9tzr', 'h4vwn'][(i + service.name.length) % 3]}`,
    );
    catalog.push({ name: service.name, instances, region: service.region });
    return instances.map(instance => ({
      key: service.name + '/' + instance,
      resource: {
        attributes: [
          str('service.name', service.name),
          str('service.namespace', 'shop'),
          str('service.version', `2026.10.${20 + (service.name.length % 9)}`),
          str('service.instance.id', instance),
          str('deployment.environment.name', 'production'),
          str('cloud.region', service.region),
          str('telemetry.sdk.language', 'java'),
        ],
      },
    }));
  });
  for (let minute = 0; minute < MINUTES; minute++) {
    const startMs = DAY_START + minute * 60_000;
    const endMs = startMs + 60_000;
    const hhmm = new Date(startMs).toISOString().slice(11, 16);
    for (let s = 0; s < SERVICES.length; s++) {
      const service = SERVICES[s];
      for (const { key, resource } of resources[s]) {
        for (const route of service.routes) {
          // Traffic follows a gentle ramp over the two hours.
          const n = poisson(rng, route.rpm * (0.85 + 0.3 * (minute / MINUTES)));
          let slow = 1;
          let errorShare = 0.0015;
          if (service.name === 'payments-api' && hhmm >= '13:35' && route.route === '/v2/payments') slow = 3.4;
          if (service.name === 'checkout-api' && hhmm >= '13:35' && route.route.includes('confirm')) slow = 1.25;
          if (service.name === 'search-api' && hhmm >= '13:10' && hhmm < '13:20' && route.route === '/search')
            errorShare = 0.2;
          const byStatus = new Map<number, number[]>();
          for (let i = 0; i < n; i++) {
            let status = 200;
            const roll = rng.random();
            if (roll < errorShare) status = rng.random() < 0.8 ? 503 : 500;
            else if (roll < errorShare + 0.02) status = route.method === 'GET' ? 404 : 400;
            else if (route.method === 'POST' && roll < errorShare + 0.04) status = 201;
            let ms = route.medianMs * slow * Math.exp(route.sigma * normal(rng));
            if (status >= 500) ms = status === 503 ? 2 + rng.random() * 8 : 1000 + rng.random() * 4000;
            const list = byStatus.get(status) ?? [];
            list.push(ms / 1000);
            byStatus.set(status, list);
          }
          for (const status of [...byStatus.keys()].sort((a, b) => a - b)) {
            const samples = byStatus.get(status)!;
            const buckets = new Array(BOUNDS.length + 1).fill(0);
            let sum = 0;
            let min = Number.POSITIVE_INFINITY;
            let max = 0;
            for (const seconds of samples) {
              let b = BOUNDS.findIndex(bound => seconds <= bound);
              if (b < 0) b = BOUNDS.length;
              buckets[b]++;
              sum += seconds;
              min = Math.min(min, seconds);
              max = Math.max(max, seconds);
            }
            rows.push({
              service: service.name,
              resourceKey: key,
              resource,
              endMs,
              point: {
                attributes: [
                  str('http.request.method', route.method),
                  str('http.route', route.route),
                  { key: 'http.response.status_code', value: { intValue: String(status) } },
                ],
                startTimeUnixNano: ns(startMs),
                timeUnixNano: ns(endMs),
                count: String(samples.length),
                sum: Math.round(sum * 1e6) / 1e6,
                bucketCounts: buckets.map(String),
                explicitBounds: BOUNDS,
                min: Math.round(min * 1e6) / 1e6,
                max: Math.round(max * 1e6) / 1e6,
              },
            });
          }
        }
      }
    }
  }
  return { rows, services: catalog };
}

// One page in OTLP/JSON: points regrouped under their resource, in order.
export function toOtlp(rows: Row[]) {
  const resourceMetrics: unknown[] = [];
  let current: { key: string; points: DataPoint[] } | undefined;
  for (const row of rows) {
    if (!current || current.key !== row.resourceKey) {
      current = { key: row.resourceKey, points: [] };
      resourceMetrics.push({
        resource: row.resource,
        scopeMetrics: [
          {
            scope: { name: 'io.opentelemetry.tomcat-10.0', version: '2.13.0-alpha' },
            metrics: [
              {
                name: 'http.server.request.duration',
                description: 'Duration of HTTP server requests.',
                unit: 's',
                histogram: { aggregationTemporality: 1, dataPoints: current.points },
              },
            ],
          },
        ],
        schemaUrl: 'https://opentelemetry.io/schemas/1.29.0',
      });
    }
    current.points.push(row.point);
  }
  return resourceMetrics;
}
