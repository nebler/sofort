// Static arm64 driver mounted into the immutable Alpine oracle. Payload stdio
// are three pipes; strace's output has its own file and never pollutes stderr.
import { readFileSync, writeFileSync, mkdirSync, chmodSync, rmSync, symlinkSync } from 'node:fs';
import { capture, dump, sha } from './lib.ts';
import { join } from 'node:path';

interface Config { elf: string; cwd: string; source: string; supported: string[]; timeout: number;
  expectedExit: number | null; expectedOut: string; expectedErr: string; referenceValid: boolean }
async function leg(cfg: Config, out: string, inject: string): Promise<void> {
  mkdirSync(out, { recursive: true });
  rmSync(cfg.cwd, { recursive: true, force: true });
  mkdirSync(cfg.cwd, { recursive: true });
  chmodSync(cfg.cwd, 0o777);
  symlinkSync(join(cfg.source, 'tests'), join(cfg.cwd, 'tests'));
  symlinkSync(join(cfg.source, 'node_modules'), join(cfg.cwd, 'node_modules'));
  writeFileSync(join(cfg.cwd, 'package.json'), readFileSync(join(cfg.source, 'package.json')));
  const args = ['strace', '-f', '-qq', '-v', '-s', '4096', '-o', join(out, 'trace')];
  if (inject) args.push('-e', 'inject=' + inject + ':error=ENOSYS' + (inject === 'execve' ? ':when=2+' : ''));
  args.push('--', cfg.elf);
  const result = await capture(args, { cwd: cfg.cwd, timeout: cfg.timeout,
    env: { PATH: '/bin:/usr/bin', HOME: '/tmp', LC_ALL: 'C', LANG: 'C', TZ: 'UTC', SCRIPTC_TEST_ENV: 'from-harness' } });
  writeFileSync(join(out, 'stdout'), result.stdout);
  writeFileSync(join(out, 'stderr'), result.stderr);
  dump(join(out, 'status.json'), { exit: result.returncode, timeout: result.timeout });
}
async function main(): Promise<void> {
  const out = process.argv[2] || '/out';
  const cfg = JSON.parse(readFileSync(join(out, 'config.json'), 'utf8')) as Config;
  await leg(cfg, out, '');
  const status = JSON.parse(readFileSync(join(out, 'status.json'), 'utf8')) as { timeout: boolean; exit: number };
  if (status.timeout) return;
  const calls = new Set<string>();
  let initial = true;
  for (const line of readFileSync(join(out, 'trace'), 'utf8').split('\n')) {
    const m = /^\s*(?:\d+\s+)?([a-zA-Z_][a-zA-Z_0-9]*)\(/.exec(line);
    if (!m) continue;
    if (initial && m[1] === 'execve') { initial = false; continue; }
    if (!cfg.supported.includes(m[1])) calls.add(m[1]);
  }
  const missing = Array.from(calls).sort();
  if (!missing.length) return;
  if (!cfg.referenceValid || status.exit !== cfg.expectedExit || sha(readFileSync(join(out, 'stdout'))) !== cfg.expectedOut ||
    (status.exit === 0 && sha(readFileSync(join(out, 'stderr'))) !== cfg.expectedErr)) return;
  await leg(cfg, join(out, 'repeat'), '');
  const repeatStatus = readFileSync(join(out, 'repeat/status.json'), 'utf8');
  if (repeatStatus !== readFileSync(join(out, 'status.json'), 'utf8') ||
    !readFileSync(join(out, 'stdout')).equals(readFileSync(join(out, 'repeat/stdout'))) ||
    !readFileSync(join(out, 'stderr')).equals(readFileSync(join(out, 'repeat/stderr')))) return;
  for (const syscall of missing) await leg(cfg, join(out, syscall), syscall);
}
main().catch((e: unknown) => { console.error(String(e)); process.exitCode = 1; });
