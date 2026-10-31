export function format(value: number): string {
  return 'total=' + value.toFixed(2);
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

// TODO: remove once callers use clamp
export const legacyClamp = clamp;
