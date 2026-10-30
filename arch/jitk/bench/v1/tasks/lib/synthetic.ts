// Helpers for synthetic tasks: a seeded generator (CPython-compatible MT, from
// tslib) and deterministic per-call latencies, so generated recordings are
// byte-identical on every run.
import { PythonRandom } from '../../../../tslib/random.ts';
import { sha256 } from './tasks.ts';

export { PythonRandom };

export function pick<T>(rng: PythonRandom, items: readonly T[]): T {
  return items[rng.randrange(items.length)];
}

// Standard normal from two uniforms (Box-Muller).
function normal(rng: PythonRandom): number {
  const u = 1 - rng.random();
  const v = rng.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// A latency drawn from a log-normal around medianMs (sigma 0.35, about
// p90/p50 = 1.6, typical of SaaS API tails), seeded by the call key so the same
// call always gets the same latency regardless of call order.
export function latencyFor(key: string, medianMs: number, extraMs = 0): number {
  const rng = new PythonRandom(Number.parseInt(sha256(key).slice(0, 12), 16));
  const ms = medianMs * Math.exp(0.35 * normal(rng)) + extraMs;
  return Math.round(ms * 10) / 10;
}
