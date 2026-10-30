// Writes T6's incident.sqlite (committed) and schema.sql: one day
// (2026-10-29 UTC) of 5-minute request counters for 10 services in 3 regions,
// the day's deploys, and service ownership history. Seeded; run it to rebuild
// the file (materialize.ts checks the committed file's sha256).
//
// The incident: payments-api 2026.10.29-3 rolled out region by region; only
// eu-central-1 regressed (5xx 0.2% -> ~4%) until a rollback at 15:20.
// Distractors:
// - the same deploy in the two other regions, with no regression
// - a search-api 5xx spike at 09:10-09:45 with no deploy before it
// - a catalog-api deploy whose rate triples but stays under 1%
// - an inventory-api deploy with status 'failed' just before a spike
// - payments-api changed owner at 17:00, so a join on the current owner
//   names the wrong team
// Timestamps are ISO-8601 text with a 'T' and 'Z', as many exporters write
// them. SQLite's datetime() returns 'YYYY-MM-DD HH:MM:SS', so a naive
// comparison silently selects the wrong rows.
//
//   node bench/v1/tasks/t6-sql-incident/generate.ts
import { rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { PythonRandom } from '../lib/synthetic.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, 'incident.sqlite');
const DAY = Date.parse('2026-10-29T00:00:00Z');
const BUCKETS = 288;
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');
const at = (hhmm: string) => Date.parse(`2026-10-29T${hhmm}:00Z`);

const SERVICES: [string, string, number][] = [
  ['checkout-api', 'tier-1', 900],
  ['payments-api', 'tier-1', 600],
  ['search-api', 'tier-1', 2400],
  ['catalog-api', 'tier-2', 1800],
  ['cart-api', 'tier-1', 1200],
  ['identity-api', 'tier-0', 1500],
  ['inventory-api', 'tier-2', 800],
  ['shipping-api', 'tier-2', 300],
  ['notifications-worker', 'tier-3', 500],
  ['recommendations-api', 'tier-3', 1000],
];
const REGIONS = ['eu-west-1', 'eu-central-1', 'us-east-1'];

const DEPLOYS: { service: string; region: string; version: string; at: string; by: string; status: string }[] = [
  {
    service: 'identity-api',
    region: 'eu-west-1',
    version: '2026.10.29-1',
    at: '07:42',
    by: 'deploy-bot',
    status: 'succeeded',
  },
  {
    service: 'identity-api',
    region: 'eu-central-1',
    version: '2026.10.29-1',
    at: '07:58',
    by: 'deploy-bot',
    status: 'succeeded',
  },
  {
    service: 'identity-api',
    region: 'us-east-1',
    version: '2026.10.29-1',
    at: '08:13',
    by: 'deploy-bot',
    status: 'succeeded',
  },
  { service: 'cart-api', region: 'eu-west-1', version: '5.18.0', at: '08:31', by: 'mkowalski', status: 'succeeded' },
  { service: 'cart-api', region: 'eu-central-1', version: '5.18.0', at: '08:47', by: 'mkowalski', status: 'succeeded' },
  { service: 'cart-api', region: 'us-east-1', version: '5.18.0', at: '09:02', by: 'mkowalski', status: 'succeeded' },
  {
    service: 'catalog-api',
    region: 'eu-central-1',
    version: 'v412',
    at: '10:26',
    by: 'deploy-bot',
    status: 'succeeded',
  },
  { service: 'catalog-api', region: 'eu-west-1', version: 'v412', at: '10:44', by: 'deploy-bot', status: 'succeeded' },
  {
    service: 'recommendations-api',
    region: 'us-east-1',
    version: 'r-2026-10-29a',
    at: '11:08',
    by: 'aokafor',
    status: 'succeeded',
  },
  {
    service: 'payments-api',
    region: 'eu-west-1',
    version: '2026.10.29-3',
    at: '13:37',
    by: 'deploy-bot',
    status: 'succeeded',
  },
  {
    service: 'payments-api',
    region: 'eu-central-1',
    version: '2026.10.29-3',
    at: '14:06',
    by: 'deploy-bot',
    status: 'succeeded',
  },
  {
    service: 'payments-api',
    region: 'us-east-1',
    version: '2026.10.29-3',
    at: '14:34',
    by: 'deploy-bot',
    status: 'succeeded',
  },
  { service: 'inventory-api', region: 'eu-west-1', version: '3.9.2', at: '14:51', by: 'tlindgren', status: 'failed' },
  {
    service: 'payments-api',
    region: 'eu-central-1',
    version: '2026.10.29-2',
    at: '15:20',
    by: 'jdoyle',
    status: 'succeeded',
  },
  {
    service: 'checkout-api',
    region: 'eu-west-1',
    version: 'c-8812',
    at: '16:03',
    by: 'deploy-bot',
    status: 'succeeded',
  },
  {
    service: 'checkout-api',
    region: 'eu-central-1',
    version: 'c-8812',
    at: '16:19',
    by: 'deploy-bot',
    status: 'succeeded',
  },
  {
    service: 'checkout-api',
    region: 'us-east-1',
    version: 'c-8812',
    at: '16:36',
    by: 'deploy-bot',
    status: 'succeeded',
  },
  { service: 'shipping-api', region: 'us-east-1', version: '1.44.0', at: '18:12', by: 'rjimenez', status: 'succeeded' },
  {
    service: 'notifications-worker',
    region: 'eu-central-1',
    version: 'nw-311',
    at: '19:40',
    by: 'deploy-bot',
    status: 'succeeded',
  },
  {
    service: 'inventory-api',
    region: 'eu-west-1',
    version: '3.9.2',
    at: '20:05',
    by: 'tlindgren',
    status: 'succeeded',
  },
];

// Error rate per bucket as a function of service, region and time.
function errorRate(service: string, region: string, t: number): number {
  let rate = 0.002;
  if (service === 'payments-api' && region === 'eu-central-1' && t >= at('14:06') && t < at('15:20')) rate = 0.041;
  if (service === 'search-api' && region === 'eu-west-1' && t >= at('09:10') && t < at('09:45')) rate = 0.067;
  if (service === 'catalog-api' && region === 'eu-central-1' && t >= at('10:26') && t < at('12:00')) rate = 0.0068;
  if (service === 'inventory-api' && region === 'eu-west-1' && t >= at('14:55') && t < at('15:30')) rate = 0.024;
  return rate;
}

function normal(rng: PythonRandom): number {
  const u = 1 - rng.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.random());
}

rmSync(FILE, { force: true });
const db = new DatabaseSync(FILE);
const schema = `CREATE TABLE services (
  name TEXT PRIMARY KEY,
  tier TEXT NOT NULL
);
CREATE TABLE ownership (
  service TEXT NOT NULL REFERENCES services(name),
  team TEXT NOT NULL,
  oncall_channel TEXT NOT NULL,
  valid_from TEXT NOT NULL,          -- ISO-8601 UTC, e.g. 2026-10-29T17:00:00Z
  valid_to TEXT                      -- NULL while current
);
CREATE TABLE deploys (
  id INTEGER PRIMARY KEY,
  service TEXT NOT NULL REFERENCES services(name),
  region TEXT NOT NULL,
  version TEXT NOT NULL,
  deployed_at TEXT NOT NULL,         -- ISO-8601 UTC
  deployed_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed'))
);
CREATE TABLE request_counters (
  ts TEXT NOT NULL,                  -- start of the 5-minute bucket, ISO-8601 UTC
  service TEXT NOT NULL REFERENCES services(name),
  region TEXT NOT NULL,
  requests INTEGER NOT NULL,
  errors_5xx INTEGER NOT NULL,
  p50_ms REAL NOT NULL,
  p99_ms REAL NOT NULL,
  PRIMARY KEY (service, region, ts)
) WITHOUT ROWID;
CREATE INDEX deploys_by_time ON deploys (deployed_at);
`;
db.exec('PRAGMA page_size = 4096; PRAGMA journal_mode = DELETE;');
db.exec(schema);
const rng = new PythonRandom(20261029);

db.exec('BEGIN');
const insertService = db.prepare('INSERT INTO services VALUES (?, ?)');
for (const [name, tier] of SERVICES) insertService.run(name, tier);

const teams: Record<string, string> = {
  'checkout-api': 'checkout',
  'payments-api': 'payments-core',
  'search-api': 'discovery',
  'catalog-api': 'catalog',
  'cart-api': 'checkout',
  'identity-api': 'identity',
  'inventory-api': 'fulfilment',
  'shipping-api': 'fulfilment',
  'notifications-worker': 'platform-messaging',
  'recommendations-api': 'discovery',
};
const insertOwner = db.prepare('INSERT INTO ownership VALUES (?, ?, ?, ?, ?)');
for (const [service, team] of Object.entries(teams)) {
  if (service === 'payments-api') {
    insertOwner.run(service, 'payments-core', '#payments-core-oncall', '2025-03-01T00:00:00Z', '2026-10-29T17:00:00Z');
    insertOwner.run(service, 'payments-platform', '#payments-platform-oncall', '2026-10-29T17:00:00Z', null);
  } else if (service === 'search-api') {
    insertOwner.run(service, 'search', '#search-oncall', '2024-06-01T00:00:00Z', '2026-01-15T00:00:00Z');
    insertOwner.run(service, team, '#discovery-oncall', '2026-01-15T00:00:00Z', null);
  } else {
    insertOwner.run(service, team, `#${team}-oncall`, '2025-01-01T00:00:00Z', null);
  }
}

const insertDeploy = db.prepare('INSERT INTO deploys VALUES (?, ?, ?, ?, ?, ?, ?)');
DEPLOYS.forEach((d, i) => {
  insertDeploy.run(
    5101 + i * 3,
    d.service,
    d.region,
    d.version,
    iso(at(d.at) + (i % 4) * 7000 + 13000),
    d.by,
    d.status,
  );
});

const insertCounter = db.prepare('INSERT INTO request_counters VALUES (?, ?, ?, ?, ?, ?, ?)');
for (let b = 0; b < BUCKETS; b++) {
  const t = DAY + b * 300_000;
  const hour = b / 12;
  const diurnal = 0.45 + 0.55 * Math.sin(((hour - 6) / 24) * 2 * Math.PI) ** 2;
  for (const [service, , rpm] of SERVICES) {
    for (const region of REGIONS) {
      const scale = region === 'us-east-1' ? 0.7 : region === 'eu-west-1' ? 1.1 : 1;
      const mean = rpm * 5 * scale * diurnal;
      const requests = Math.max(0, Math.round(mean + Math.sqrt(mean) * normal(rng)));
      const p = errorRate(service, region, t);
      const mu = requests * p;
      const errors = Math.min(requests, Math.max(0, Math.round(mu + Math.sqrt(mu * (1 - p)) * normal(rng))));
      const slow = p > 0.01 ? 1.6 : 1;
      const p50 = Math.round((20 + 15 * rng.random()) * slow * 10) / 10;
      insertCounter.run(
        iso(t),
        service,
        region,
        requests,
        errors,
        p50,
        Math.round(p50 * (6 + 4 * rng.random()) * 10) / 10,
      );
    }
  }
}
db.exec('COMMIT');
db.exec('VACUUM');
db.close();
writeFileSync(join(HERE, 'schema.sql'), schema);
console.error('wrote', FILE);
