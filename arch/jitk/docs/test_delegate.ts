import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { delegate } from './dispatch.ts';
import { check, output } from './lib.ts';

process.env.MAKEFLAGS = '';
for (let test = 0; test < 6; test += 1) {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'jitk-delegate-')));
  const root = join(temporary, 'jitk');
  const owner = join(root, 'kernel');
  try {
    mkdirSync(owner, { recursive: true });
    writeFileSync(join(root, '.gitignore'), '.work/\n');
    writeFileSync(join(owner, 'README.md'), 'fixture owner');
    writeFileSync(join(owner, 'receipt.json'), 'recorded');
    writeFileSync(join(owner, 'Makefile'), 'test:\n\tmkdir -p .work; pwd > .work/cwd\n');
    const git = (args: string[]): string => output(['git', '-C', root, ...args]);
    git(['init', '-q']);
    git(['add', '.']);
    git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture']);
    if (test === 0 || test === 2) {
      writeFileSync(join(owner, 'receipt.json'), 'local edit');
    }
    const recipes = ['mkdir -p .work; pwd > .work/cwd', 'printf rewritten > receipt.json', 'printf rewritten > receipt.json', 'printf unexpected > unexpected.json', 'exit 7', 'printf rewritten > receipt.json; exit 7'];
    if (test > 0) {
      writeFileSync(join(owner, 'Makefile'), 'test:\n\t' + recipes[test] + '\n');
    }
    const before = git(['status', '--porcelain']);
    const status = await delegate('kernel', 'test', root);
    if (test === 0) {
      check(status === 0);
      check(readFileSync(join(owner, '.work/cwd'), 'utf8').trim() === owner);
      check(git(['status', '--porcelain']) === before);
      check(readFileSync(join(owner, 'receipt.json'), 'utf8') === 'local edit');
    } else if (test === 4) {
      check(status === 2, 'failed suite exit code changed');
    } else {
      check(status !== 0, 'mutation passed guard');
      if (test !== 3) {
        check(readFileSync(join(owner, 'receipt.json'), 'utf8') === 'rewritten');
      }
      if (test === 2) {
        check(git(['status', '--porcelain']) === before);
      }
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
// The evidence guard: tracked evidence above 64 KiB under arch/ refuses the
// suite until it is moved or listed as kept in evidence/manifest.json.
{
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'jitk-delegate-')));
  const root = join(temporary, 'arch/jitk');
  const owner = join(root, 'kernel');
  try {
    mkdirSync(join(owner, 'results'), { recursive: true });
    writeFileSync(join(owner, 'README.md'), 'fixture owner');
    writeFileSync(join(owner, 'Makefile'), 'test:\n\tmkdir -p .work; touch .work/ran\n');
    writeFileSync(join(owner, 'results/small.json'), '{}');
    writeFileSync(join(temporary, '.gitignore'), '.work/\n');
    const git = (args: string[]): string => output(['git', '-C', temporary, ...args]);
    git(['init', '-q']);
    git(['add', '.']);
    check(await delegate('kernel', 'test', root) === 0, 'small evidence refused');
    writeFileSync(join(owner, 'results/raw.json'), 'x'.repeat(65 * 1024));
    git(['add', '.']);
    rmSync(join(owner, '.work'), { recursive: true, force: true });
    check(await delegate('kernel', 'test', root) === 1, 'oversized evidence passed the guard');
    check(!existsSync(join(owner, '.work/ran')), 'suite ran despite the guard');
    mkdirSync(join(temporary, 'evidence'));
    writeFileSync(join(temporary, 'evidence/manifest.json'), JSON.stringify({ schema: 1, store: '', rule: '', files: [], kept: [{ path: 'arch/jitk/kernel/results/raw.json', bytes: 66560, reason: 'fixture' }] }));
    check(await delegate('kernel', 'test', root) === 0, 'kept evidence refused');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
console.log('7 delegate tests passed');
