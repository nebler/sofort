import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, dump, readJSON } from './lib.ts';
import { ASSETS, build, checkHost, hostCommand, processGuest, sha } from './runtime.ts';
import { observe, outcome, requireResult, type Observations } from './observations.ts';
import { type Oracle } from './oracle.ts';

export const SQLITE_SHA = '005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff';
export const DB_SHA = 'f3d4180cd07ad9eed5a674c7ff4e5f6d817eb517029c185f66af862a30eac059';
export interface IntegrationResult {
  status: string;
  [key: string]: unknown;
}

function numbers(value: number[]): number[] {
  return [...new Set(value)].sort((a, b) => a - b);
}

export async function integration(work: string, out: string, elf: string, database: string, oracle: Oracle, samples = 1): Promise<IntegrationResult> {
  mkdirSync(out);
  check(sha(elf) === SQLITE_SHA, 'use the pinned unchanged census SQLite binary');
  check(sha(database) === DB_SHA, 'use the unchanged census database');
  const resources = join(out, 'resources');
  mkdirSync(join(resources, 'dev'), { recursive: true });
  writeFileSync(join(resources, 'demo.db'), readFileSync(database));
  writeFileSync(join(resources, 'dev/null'), Buffer.alloc(0));
  const rows: unknown[] = [];
  for (const testCase of readJSON<{ name: string; sql: string }[]>(join(ASSETS, 'sqlite-corpus.json'))) {
    check(testCase, 'missing SQLite corpus case');
    const dest = join(out, testCase.name);
    mkdirSync(dest);
    const argv = ['sqlite3', '-batch', '-init', '/dev/null', 'file:/demo.db?mode=ro&immutable=1', testCase.sql];
    const reference = (await oracle(elf, argv, join(dest, 'oracle'), null, { resources, data: Buffer.alloc(0) }))[0];
    const image = await build(work, join(dest, 'build'), elf, argv, resources);
    let value: Observations | undefined;
    for (let i = 0; i < samples; i += 1) {
      const stem = join(dest, `vm-${String(i).padStart(2, '0')}`);
      const result = await processGuest(hostCommand(image), stem, Buffer.alloc(0));
      checkHost(result.info, result.err);
      value = observe(result.raw);
      dump(stem + '.observations.json', value);
      requireResult(value, reference, [48, 172]);
    }
    check(value, 'integration requires samples');
    rows.push({ name: testCase.name, sql: testCase.sql, status: 'PASS', n: samples, ...outcome(reference), missing: numbers(value.missing.map((r) => r.nr)), registered_enosys: numbers(value.registered_enosys.map((r) => r.nr)), syscalls: numbers(value.events.map((r) => r.nr)) });
  }
  const result: IntegrationResult = { status: 'PASS', binary_sha256: sha(elf), database_sha256: sha(database), method: 'exact stdout bytes, reconstructed fd2 log bytes, guest done exit vs Linux pipes', transport: 'developer grow-trace on libkrun, printable stdout corpus; production fd2 remains dropped', cases: rows };
  dump(join(out, 'report.json'), result);
  return result;
}
