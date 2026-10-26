import { check } from './lib.ts';
import type { Outcome } from './observations.ts';

export interface Learned { rules: string[]; expected: Outcome }

// The oracle, not a syscall-name table, identifies nondeterministic fields.
// Only positive scalar identity (up to equality) and equal-length byte variability
// are relaxed.
// errno, zero, line count, write/no-write, and repeat/state relations stay exact.
export function normalizeAuto(hex: string, rules: string[]): string {
  const lines = Buffer.from(hex, 'hex').toString().split('\n');
  check(lines.length === rules.length, 'generated observation line count changed');
  // Positive identities are renamed by first appearance, so equality between
  // observations (a repeated getpid, for example) remains part of the result.
  const identities: string[] = [];
  return Buffer.from(lines.map((line, i) => {
    if (rules[i] === 'positive') {
      check(/^[\w-]+=[1-9]\d*$/.test(line), 'volatile identity must remain positive');
      const value = line.split('=')[1];
      if (!identities.includes(value)) identities.push(value);
      return line.split('=')[0] + '=POSITIVE' + identities.indexOf(value);
    }
    if (rules[i].startsWith('bytes:')) { check(/^[\da-f]+$/.test(line) && line.length === Number(rules[i].slice(6)), 'volatile byte extent changed'); return 'BYTES:' + line.length; }
    return line;
  }).join('\n')).toString('hex');
}

export function learn(refs: Outcome[]): Learned {
  check(refs.length === 2 && refs.every((r) => r.exit === 0 && r.stderr_hex === ''), 'two clean oracle calibrations required');
  const a = Buffer.from(refs[0].stdout_hex, 'hex').toString().split('\n'), b = Buffer.from(refs[1].stdout_hex, 'hex').toString().split('\n');
  check(a.length === b.length, 'unstable oracle observation shape');
  const rules = a.map((line, i) => {
    if (line === b[i]) return 'exact';
    if (/^[\w-]+=[1-9]\d*$/.test(line) && /^[\w-]+=[1-9]\d*$/.test(b[i]) && line.split('=')[0] === b[i].split('=')[0]) return 'positive';
    check(/^[\da-f]+$/.test(line) && /^[\da-f]+$/.test(b[i]) && line.length === b[i].length, 'unhandled nondeterminism');
    return 'bytes:' + line.length;
  });
  const expected = { stdout_hex: normalizeAuto(refs[0].stdout_hex, rules), stderr_hex: '', exit: 0 };
  check(normalizeAuto(refs[1].stdout_hex, rules) === expected.stdout_hex, 'calibration disagreement');
  return { rules, expected };
}
