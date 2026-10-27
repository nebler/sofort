import { isDeepStrictEqual } from 'node:util';

export function check(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function equal(a: unknown, b: unknown): boolean {
  return isDeepStrictEqual(a, b);
}

// Deep equality through a JSON round trip: scriptc can report false between a
// parsed frame projected into an optional-field interface and an identical
// literal (kernel/SCRIPTC-GAPS.md).
export function same(a: unknown, b: unknown): boolean {
  return isDeepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
}
