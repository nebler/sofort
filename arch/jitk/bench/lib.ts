import { execFileSync } from 'node:child_process';
import { check, detail } from '../tslib/assert.ts';
import { PythonRandom } from '../tslib/random.ts';
import { spawnCapture, startDirect } from '../tslib/process.ts';

// Shared helpers live in ../tslib; bench keeps its option parser, statistics
// and CPython number formatting.
export { check, equal, detail } from '../tslib/assert.ts';
export { readJSON, dumpJSON as dump } from '../tslib/json.ts';
export { shaFile as sha, hashJSON } from '../tslib/hash.ts';
// CPython integer-seeded MT19937, including getrandbits rejection sampling.
export { PythonRandom as Random } from '../tslib/random.ts';

export function utc(): string {
  return new Date().toISOString().replace(/(\.\d{3})Z$/, '$1000+00:00');
}
export function now(): number {
  return Number(process.hrtime.bigint()) / 1e9;
}
export function command(argv: string[], timeout = 5): string {
  try {
    return execFileSync(argv[0], argv.slice(1), { encoding: 'utf8', timeout: timeout * 1000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return detail(error);
  }
}
export interface SpawnResult {
  stdout: Buffer;
  stderr: Buffer;
  status: number;
  timedOut: boolean;
}
export async function capture(argv: string[], options: { cwd?: string; env?: Record<string, string>; timeout?: number } = {}): Promise<SpawnResult> {
  const exit = await spawnCapture(argv, { cwd: options.cwd, env: options.env, stdio: 'ignore-stdin', timeout: options.timeout ?? 30 }, startDirect);
  return { stdout: exit.stdout, stderr: exit.stderr, status: exit.code ?? -9, timedOut: exit.timedOut };
}

export function quant(xs: number[], q: number): number {
  check(xs.length > 0, 'empty quantile');
  const a = [...xs].sort((a, b) => a - b);
  const p = (a.length - 1) * q;
  const i = Math.floor(p);
  return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * (p - i);
}
export function median(xs: number[]): number {
  const a = [...xs].sort((a, b) => a - b);
  check(a.length > 0, 'empty median');
  const i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
}
export interface Estimate {
  value: number;
  ci95: number[];
}
export interface Stats {
  n: number;
  min: number;
  max: number;
  p50: Estimate;
  p90: Estimate;
  p99: Estimate;
}
export function stats(xs: number[], boot = 2000): Stats {
  const rng = new PythonRandom(601);
  const replicas: number[][] = [];
  for (let i = 0; i < boot; i += 1) {
    replicas.push(xs.map(() => xs[rng.randrange(xs.length)]));
  }
  const estimate = (q: number): Estimate => {
    const values = replicas.map(a => quant(a, q));
    return { value: quant(xs, q), ci95: [quant(values, 0.025), quant(values, 0.975)] };
  };
  return { n: xs.length, min: Math.min(...xs), max: Math.max(...xs), p50: estimate(0.5), p90: estimate(0.9), p99: estimate(0.99) };
}

export function options(argv: string[], defaults: Record<string, any>, positional: string[] = []): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(defaults)) {
    result[key] = defaults[key];
  }
  let position = 0;
  try {
    for (let i = 0; i < argv.length; i += 1) {
      const arg = argv[i];
      if (arg === '--help' || arg === '-h') {
        console.log('options: ' + Object.keys(defaults).map(k => '--' + k.replace(/_/g, '-')).join(' ') + ' ' + positional.join(' '));
        process.exit(0);
      }
      if (!arg.startsWith('--')) {
        check(position < positional.length, 'unrecognized argument ' + arg);
        result[positional[position]] = arg;
        position += 1;
        continue;
      }
      const parts = arg.slice(2).split('=');
      const key = parts[0].replace(/-/g, '_');
      check(key in defaults, 'unrecognized argument ' + arg);
      if (typeof defaults[key] === 'boolean') {
        check(parts.length === 1, 'flag takes no value ' + arg);
        result[key] = true;
      } else {
        const value = parts.length > 1 ? parts.slice(1).join('=') : argv[++i];
        check(value !== undefined, 'missing value ' + arg);
        result[key] = typeof defaults[key] === 'number' ? Number(value) : value;
        if (typeof defaults[key] === 'number') {
          check(Number.isFinite(result[key]), 'invalid number ' + arg);
        }
      }
    }
    return result;
  } catch (error) {
    console.error(detail(error));
    process.exit(2);
  }
}

// Python's fixed-point formatting uses ties-to-even on the exact binary float.
// Number.toFixed chooses the other neighbor for exact halfway values.
export function fixed(value: number, digits: number): string {
  check(Number.isFinite(value), 'non-finite fixed point value');
  const bytes = Buffer.alloc(8);
  bytes.writeDoubleLE(value, 0);
  const bits = bytes.readBigUInt64LE(0);
  const negative = (bits >> 63n) !== 0n;
  const exponent = Number((bits >> 52n) & 2047n);
  const fraction = bits & 0xfffffffffffffn;
  const mantissa = exponent ? fraction | 0x10000000000000n : fraction;
  const shift = exponent ? exponent - 1075 : -1074;
  let numerator = mantissa * (10n ** BigInt(digits));
  let denominator = 1n;
  if (shift >= 0) {
    numerator <<= BigInt(shift);
  } else {
    denominator <<= BigInt(-shift);
  }
  let rounded = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n > denominator || (remainder * 2n === denominator && (rounded & 1n) !== 0n)) {
    rounded += 1n;
  }
  let text = rounded.toString().padStart(digits + 1, '0');
  if (digits) {
    text = text.slice(0, -digits) + '.' + text.slice(-digits);
  }
  return (negative ? '-' : '') + text;
}

// CPython 3.12+ float sum: compensated running sum, with ordinary ordered terms.
export function sum(values: number[]): number {
  let high = 0;
  let low = 0;
  for (const value of values) {
    const next = high + value;
    if (Math.abs(high) >= Math.abs(value)) {
      low += (high - next) + value;
    } else {
      low += (value - next) + high;
    }
    high = next;
  }
  return low !== 0 && Number.isFinite(low) ? high + low : high;
}

export class Interrupted extends Error {
  code: number;
  constructor(code: number) {
    super('interrupted');
    this.code = code;
  }
}
export function propagate(error: unknown): void {
  if (error instanceof Interrupted) {
    throw error;
  }
}

export function clockNS(): bigint {
  return process.hrtime.bigint();
}
