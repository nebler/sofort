import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { arch, release } from 'node:os';
import { check, sha256, trace } from './lib.ts';
import { normalize } from './normalize.ts';

mkdirSync('/out', { recursive: true });
const command = ['-f', '-qq', '-v', '-X', 'raw', '-xx', '-s', '1048576', '-o', '/out/raw.strace'];
if (process.env.INJECT_ERRNO) {
  const name = process.env.INJECT_SYSCALL || 'ioctl';
  check(name === 'ioctl' || name === 'mremap', 'invalid injection syscall');
  command.push('-e', 'inject=' + name + ':error=' + process.env.INJECT_ERRNO);
}
command.push('--', '/case/qjs-static', ...process.argv.slice(2));
const env = { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' };
const started = performance.now();
const code = await trace(command, env);
const events = normalize(readFileSync('/out/raw.strace', 'utf8'), true);
check(Number(events[events.length - 1].args[0]) === code, 'inconsistent or signaled exit: trace rejected');
writeFileSync('/out/trace.jsonl', events.map(event => JSON.stringify(event) + '\n').join(''));
const meta = {
  arch: arch() === 'arm64' ? 'aarch64' : arch(),
  kernel: release(),
  exit: code,
  seconds: Math.round((performance.now() - started) * 1000) / 1000000,
  events: events.length,
  syscalls: [...new Set(events.map(event => event.name))].sort(),
  binary_sha256: sha256('/case/qjs-static'),
  strace: execFileSync('strace', ['-V'], { encoding: 'utf8' }).split('\n')[0]
};
writeFileSync('/out/meta.json', JSON.stringify(meta, null, 2) + '\n');
console.log(JSON.stringify(meta));
