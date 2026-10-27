import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { check, capture, environment, run } from './lib.ts';
import { requireArtifact } from '../tslib/deps.ts';
const root = resolve(import.meta.dirname, '..');
const env = environment();
delete env.JITK_RECORD;
let count = 0;
let work = mkdtempSync(join(tmpdir(), 'jitk-receipts-'));
try {
  // Explicit JITK_NODE, else the deps cache; missing is an error, not a skip.
  const node = requireArtifact('JITK_NODE');
  if (node) {
    for (const name of ['build.mjs', 'dispatcher.ts', 'dispatcher.js', 'vectors.json']) {
      cpSync(join(root, 'protocol', name), join(work, name));
    }
    for (const row of [['build.mjs', node, 'dispatcher.js'], ['vectors', join(root, 'protocol/.work/bin/make-vectors'), 'vectors.json']]) {
      const path = join(work, row[2]);
      const before = readFileSync(path);
      const mtime = statSync(path).mtimeMs;
      const command = row[0] === 'vectors' ? [row[1]] : [row[1], join(work, row[0])];
      const settings = { ...env, JITK_VECTOR_ROOT: work };
      await run(command, { env: settings });
      check(readFileSync(path).equals(before) && statSync(path).mtimeMs === mtime);
      writeFileSync(path, 'stale evidence');
      check((await capture(command, { env: settings })).returncode !== 0);
      check(readFileSync(path, 'utf8') === 'stale evidence');
      await run(command, { env: { ...settings, JITK_RECORD: '1' } });
      check(readFileSync(path).equals(before));
    }
    count += 1;
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
work = mkdtempSync(join(tmpdir(), 'jitk-receipts-'));
try {
  const out = join(work, 'dist');
  const packed = join(work, 'out');
  mkdirSync(out);
  mkdirSync(packed);
  writeFileSync(join(out, 'kernel.bin'), 'fixture image');
  writeFileSync(join(out, 'manifest.json'), 'recorded');
  for (const name of ['features', 'syscalls', 'packed', 'argv']) {
    writeFileSync(join(packed, name + '.json'), '[]');
  }
  const elf = join(work, 'guest');
  writeFileSync(elf + '.d', join(packed, 'packed.rs'));
  const command = [join(root, 'kernel/.work/bin/artifact'), elf, out];
  const settings = { ...env, JITK_ARTIFACT_ROOT: work };
  await run(command, { env: settings });
  check(readFileSync(join(out, 'manifest.json'), 'utf8') === 'recorded');
  check(existsSync(join(work, '.work/dist/manifest.json')));
  await run(command, { env: { ...settings, JITK_RECORD: '1' } });
  check((JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')) as { bytes: number }).bytes === 13);
  count += 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
work = mkdtempSync(join(tmpdir(), 'jitk-receipts-'));
try {
  for (const name of ['nested.sh', 'output.sh']) {
    const source = join(root, 'linux', name);
    if (existsSync(source)) {
      cpSync(source, join(work, name));
    }
  }
  writeFileSync(join(work, '.READY'), 'recorded readiness');
  mkdirSync(join(work, 'out'));
  for (const name of ['report.json', 'report.md']) {
    writeFileSync(join(work, 'out', name), 'recorded report');
  }
  const settings = environment();
  for (const key of ['JITK_RECORD', 'JITK_WORK', 'JITK_LINUX_OUT', 'JITK_LINUX_READY']) {
    delete settings[key];
  }
  check((await capture(['/bin/bash', join(work, 'nested.sh')], { env: settings })).returncode !== 0);
  check(readFileSync(join(work, '.READY'), 'utf8') === 'recorded readiness');
  check(readFileSync(join(work, 'out/report.json'), 'utf8') === 'recorded report');
  check(readFileSync(join(work, 'out/report.md'), 'utf8') === 'recorded report');
  count += 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(count + ' receipt tests passed');
