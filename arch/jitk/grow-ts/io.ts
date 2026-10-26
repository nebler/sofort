import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

export function check(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) {
    throw new GateError(message);
  }
}

export class GateError extends Error {}

export function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function equal(a: unknown, b: unknown): boolean {
  return isDeepStrictEqual(a, b);
}

// Preserve unsigned 64-bit register values through JavaScript's JSON parser.
// The marker is internal; dump restores number tokens rather than rounding them.
const INTEGER = '~grow-u64:';
export type Register = number | string;

export function parseJSON(text: string): unknown {
  let safe = '';
  let quoted = false;
  let escaped = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      safe += c;
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === '"') {
        quoted = false;
      }
      i += 1;
    } else if (c === '"') {
      quoted = true;
      safe += c;
      i += 1;
    } else if (c === '-' || /[0-9]/.test(c)) {
      const start = i;
      i += 1;
      while (i < text.length && /[0-9eE.+-]/.test(text[i])) {
        i += 1;
      }
      const token = text.slice(start, i);
      safe += /^-?\d{16,}$/.test(token) && !Number.isSafeInteger(Number(token))
        ? JSON.stringify(INTEGER + token)
        : token;
    } else {
      safe += c;
      i += 1;
    }
  }
  return JSON.parse(safe) as unknown;
}

export function stringify(value: unknown, indent = 2): string {
  return JSON.stringify(value, null, indent).replace(/"~grow-u64:(-?\d+)"/g, '$1');
}

export function readJSON<T>(path: string): T {
  return parseJSON(readFileSync(path, 'utf8')) as T;
}

export function dump(path: string, value: unknown): void {
  writeFileSync(path, stringify(value) + '\n');
}

export function signed(value: Register, bits = 64): number {
  const integer = typeof value === 'string' ? BigInt(value.replace(INTEGER, '')) : BigInt(value);
  return Number(BigInt.asIntN(bits, integer));
}

export function numeric(value: Register): number {
  return typeof value === 'number' ? value : Number(value.replace(INTEGER, ''));
}

export function hexBytes(hex: string): Buffer {
  check(/^(?:[0-9a-fA-F]{2})*$/.test(hex), 'invalid hex bytes');
  return Buffer.from(hex, 'hex');
}
