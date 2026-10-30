import { readFileSync } from 'node:fs';
import type { OracleVerdict } from '../../contract.ts';
const expected = readFileSync(new URL('./expected.json', import.meta.url), 'utf8');
export function check(result: unknown): OracleVerdict {
  const got = JSON.stringify(result);
  return got === JSON.stringify(JSON.parse(expected)) ? { ok: true, reason: 'top 3 match' } : { ok: false, reason: 'got ' + String(got).slice(0, 200) };
}
export default check;
