import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { archive } from '../packer.ts';
import { run, environment } from '../lib.ts';
import { pins } from '../../tslib/deps.ts';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(join(root, 'tests/fixtures/fs-harness.rs'), 'utf8').replaceAll('FS"', join(root, 'src/fs.rs') + '"').replaceAll('SYS/', join(root, 'src/syscalls') + '/');
const work = mkdtempSync(join(tmpdir(), 'jitk-fs-'));
try {
  const tree = join(work, 'tree');
  mkdirSync(join(tree, 'b/c'), { recursive: true });
  writeFileSync(join(tree, 'a.txt'), 'hi');
  writeFileSync(join(tree, 'b/c/z'), 'zz');
  writeFileSync(join(tree, 'b/y'), '');
  writeFileSync(join(work, 'fs.bin'), archive(tree).bytes);
  writeFileSync(join(work, 'test.rs'), source);
  await run(['rustc', '+' + pins().rust_toolchain, '--edition=2024', '--test', '-A', 'static_mut_refs', join(work, 'test.rs'), '-o', join(work, 'test')], { inherit: true });
  await run([join(work, 'test')], { env: { ...environment(), ARCHIVE: join(work, 'fs.bin') }, inherit: true });
} finally {
  rmSync(work, { recursive: true, force: true });
}
