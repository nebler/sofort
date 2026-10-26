import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

export function check(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export async function trace(command: string[], env: Record<string, string>): Promise<number> {
  writeFileSync('/out/stdout.bin', '');
  writeFileSync('/out/stderr.bin', '');
  return await new Promise<number>((resolve, reject) => {
    const child = spawn('strace', command, { env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' }, cwd: '/case', detached: true, stdio: ['inherit', 'pipe', 'pipe'] });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, 20000);
    child.stdout!.on('data', (data: Buffer) => appendFileSync('/out/stdout.bin', data));
    child.stderr!.on('data', (data: Buffer) => appendFileSync('/out/stderr.bin', data));
    child.on('error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code: number | null, signal: string | null) => {
      clearTimeout(timer);
      if (timedOut || signal || code === null) {
        reject(new Error(timedOut ? 'oracle timeout: trace rejected' : 'inconsistent or signaled exit: trace rejected'));
      } else {
        resolve(code);
      }
    });
  });
}
