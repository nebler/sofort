// T6 oracle: reads the raw tables of incident.sqlite (plain SELECT *) and
// recomputes the regressions in JavaScript: windows on epoch milliseconds,
// rates from summed counters, the owner valid at the deploy time. Rates may be
// rounded to 6 decimals.
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const COLUMNS = ['service', 'region', 'version', 'deployed_at', 'team', 'error_rate_before', 'error_rate_after'];
type Row = Record<string, any>;
let cached: Row[] | undefined;

function expected(): Row[] {
  if (cached) return cached;
  const db = new DatabaseSync(join(HERE, 'incident.sqlite'), { readOnly: true });
  const deploys = db.prepare('SELECT * FROM deploys').all() as Row[];
  const owners = db.prepare('SELECT * FROM ownership').all() as Row[];
  const counters = db.prepare('SELECT * FROM request_counters').all() as Row[];
  db.close();
  const out: Row[] = [];
  for (const d of deploys) {
    if (d.status !== 'succeeded') continue;
    const t = Date.parse(d.deployed_at);
    let eb = 0;
    let rb = 0;
    let ea = 0;
    let ra = 0;
    for (const c of counters) {
      if (c.service !== d.service || c.region !== d.region) continue;
      const ts = Date.parse(c.ts);
      if (ts >= t - 3_600_000 && ts < t) {
        eb += c.errors_5xx;
        rb += c.requests;
      } else if (ts >= t && ts < t + 3_600_000) {
        ea += c.errors_5xx;
        ra += c.requests;
      }
    }
    const before = eb / rb;
    const after = ea / ra;
    if (!(after >= 0.01 && after >= 3 * before)) continue;
    const owner = owners.find(
      o =>
        o.service === d.service && Date.parse(o.valid_from) <= t && (o.valid_to === null || Date.parse(o.valid_to) > t),
    );
    out.push({
      service: d.service,
      region: d.region,
      version: d.version,
      deployed_at: d.deployed_at,
      team: owner?.team,
      error_rate_before: before,
      error_rate_after: after,
    });
  }
  out.sort((a, b) => Date.parse(a.deployed_at) - Date.parse(b.deployed_at));
  cached = out;
  return out;
}

export function check(result: unknown): { ok: boolean; reason: string } {
  const want = expected();
  if (!Array.isArray(result)) return { ok: false, reason: 'result is not a row list' };
  if (result.length !== want.length) return { ok: false, reason: `expected ${want.length} rows, got ${result.length}` };
  for (let i = 0; i < want.length; i++) {
    const have = result[i] as Row;
    const keys = Object.keys(have ?? {});
    if (COLUMNS.some(column => !keys.includes(column)))
      return { ok: false, reason: `row ${i} lacks columns: has ${keys.join(', ')}` };
    for (const column of COLUMNS.slice(0, 5)) {
      if (have[column] !== want[i][column])
        return { ok: false, reason: `row ${i} ${column} ${have[column]} != ${want[i][column]}` };
    }
    for (const column of COLUMNS.slice(5)) {
      if (typeof have[column] !== 'number' || Math.abs(have[column] - want[i][column]) > 5e-7) {
        return { ok: false, reason: `row ${i} ${column} ${have[column]} != ${want[i][column]}` };
      }
    }
  }
  return { ok: true, reason: want.map(r => `${r.service}/${r.region} ${r.version} (${r.team})`).join('; ') };
}

export default check;
