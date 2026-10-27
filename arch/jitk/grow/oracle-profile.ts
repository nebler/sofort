import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { capture, check, detail, dump, hexBytes, readJSON } from './lib.ts';
import { splitLauncher } from './oracle-trace.ts';

interface Config {
  argv: string[];
  samples: number;
  stdin_hex: string;
  expected_hex: string | null;
  stderr_hex?: string;
  exit?: number;
  injections?: string[];
  // Seed-trace collection only: strace -y annotates descriptors with their paths.
  annotate?: boolean;
  // Address-space limit in KiB (guest capacity), inherited by the payload.
  memory_kib?: number;
  // Shared tree (oracle.ts): run the payload chrooted into this in-container root.
  root?: string | null;
}
export async function runProfile(out: string): Promise<void> {
  const cfg = readJSON<Config>(join(out, 'oracle-config.json'));
  check(Number.isInteger(cfg.samples) && cfg.samples > 0, 'positive sample count required');
  const results: unknown[] = [];
  for (let i = 0; i < cfg.samples; i += 1) {
    const stem = join(out, 'linux-' + String(i).padStart(2, '0'));
    const trace = stem + '.strace';
    const command = ['strace', '-f', '-qq', '-v', '-X', 'raw', '-xx', '-s', '1048576', '-o', trace];
    if (cfg.annotate) command.splice(1, 0, '-y');
    for (const injection of cfg.injections || []) {
      command.push('-e', 'inject=' + injection);
    }
    if (cfg.root) command.push('--', '/oracle-root', cfg.root, '/payload', '/payload', ...cfg.argv.slice(1));
    else command.push('--', '/payload', ...cfg.argv.slice(1));
    if (cfg.memory_kib) command.unshift('/bin/sh', '-c', 'ulimit -v ' + String(Math.floor(cfg.memory_kib)) + ' && exec "$@"', 'sh');
    const started = performance.now();
    const result = await capture(command, { env: { PATH: '/bin:/usr/bin', LC_ALL: 'C', LANG: 'C', TZ: 'UTC' }, input: hexBytes(cfg.stdin_hex), holdStdin: true, timeout: 10 });
    writeFileSync(stem + '.stdout', result.stdout);
    writeFileSync(stem + '.stderr', result.stderr);
    check(!result.timeout, 'Linux oracle timeout');
    if (cfg.expected_hex !== null) {
      check(result.returncode === (cfg.exit ?? 0) && result.stdout.toString('hex') === cfg.expected_hex && result.stderr.toString('hex') === (cfg.stderr_hex || ''), 'Linux oracle output mismatch');
    }
    let text = readFileSync(trace, 'utf8');
    if (cfg.root) {
      const parts = splitLauncher(text);
      writeFileSync(stem + '.launcher.strace', parts.launcher);
      writeFileSync(trace, parts.payload);
      text = parts.payload;
    }
    for (const injection of cfg.injections || []) {
      const name = injection.split(':')[0];
      check(text.split('\n').some((line) => line.includes(name + '(') && line.includes('(INJECTED)')), name);
    }
    results.push({ returncode: result.returncode, exit: result.returncode, seconds: (performance.now() - started) / 1000, stdout_hex: result.stdout.toString('hex'), stderr_hex: result.stderr.toString('hex'), injected_count: text.split('(INJECTED)').length - 1 });
  }
  dump(join(out, 'linux-summary.json'), results);
}
runProfile('/out').catch((error: unknown) => {
  console.error(detail(error));
  process.exitCode = 1;
});
