import { readFileSync, writeFileSync } from 'node:fs';

export function readJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

// Python json.dumps(value, indent=indent) with the default ensure_ascii: every
// code unit from U+007F up is written as a lowercase \uXXXX escape.
export function asciiJSON(value: unknown, indent = 2): string {
  return JSON.stringify(value, null, indent).replace(/[\u007f-￿]/g, (c: string) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function dumpASCII(path: string, value: unknown): void {
  writeFileSync(path, asciiJSON(value) + '\n');
}

// JSON.stringify text plus a newline; indent 0 is compact.
export function dumpJSON(path: string, value: unknown, indent = 2): void {
  writeFileSync(path, JSON.stringify(value, null, indent) + '\n');
}

// JSON lines: one value per non-blank line.
export function jsonLines(path: string): any[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((s) => s.trim().length > 0)
    .map((s) => JSON.parse(s));
}
