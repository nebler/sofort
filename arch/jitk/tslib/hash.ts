import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Lowercase hex SHA-256.
export function digest(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function shaFile(path: string): string {
  return digest(readFileSync(path));
}

// Hash of the compact JSON.stringify text.
export function hashJSON(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
