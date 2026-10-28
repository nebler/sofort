import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '../lib.ts';
import { pins } from '../../tslib/deps.ts';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(join(root, 'tests/fixtures/handlers-harness.rs'), 'utf8').replaceAll('IOCTL', join(root, 'src/syscalls/ioctl.rs')).replaceAll('PPOLL', join(root, 'src/syscalls/ppoll.rs'));
const work = mkdtempSync(join(tmpdir(), 'jitk-handlers-'));
try {
  writeFileSync(join(work, 'test.rs'), source);
  await run(['rustc', '+' + pins().rust_toolchain, '--edition=2021', '--test', '-A', 'static_mut_refs', join(work, 'test.rs'), '-o', join(work, 'test')], { inherit: true });
  await run([join(work, 'test')], { inherit: true });
} finally {
  rmSync(work, { recursive: true, force: true });
}
