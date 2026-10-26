// Static arm64 driver mounted into the immutable Alpine oracle. Payload stdio
// are three pipes; strace's output has its own file and never pollutes stderr.
import { readFileSync, writeFileSync } from 'node:fs';
import { capture, dump } from './lib.ts';
import { join } from 'node:path';

interface Config { elf: string; cwd: string; inject: string; timeout: number }
async function main(): Promise<void> {
  const out = process.argv[2] || '/out';
  const cfg = JSON.parse(readFileSync(join(out, 'config.json'), 'utf8')) as Config;
  const args = ['strace', '-f', '-qq', '-v', '-s', '4096', '-o', join(out, 'trace')];
  if (cfg.inject) args.push('-e', 'inject=' + cfg.inject + ':error=ENOSYS');
  args.push('--', cfg.elf);
  const result = await capture(args, { cwd: cfg.cwd, timeout: cfg.timeout,
    env: { PATH: '/bin:/usr/bin', HOME: '/tmp', LC_ALL: 'C', LANG: 'C', TZ: 'UTC', SCRIPTC_TEST_ENV: 'from-harness' } });
  writeFileSync(join(out, 'stdout'), result.stdout);
  writeFileSync(join(out, 'stderr'), result.stderr);
  dump(join(out, 'status.json'), { exit: result.returncode, timeout: result.timeout });
}
main().catch((e: unknown) => { console.error(String(e)); process.exitCode = 1; });
