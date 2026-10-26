import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { argument, capture, check, run } from '../lib.ts';
const binary = argument('binary');
const image = argument('image');
check(binary && image, '--binary and --image required');
const work = mkdtempSync(join(tmpdir(), 'jitk-profile-bound-'));
let writer: ReturnType<typeof spawn> | null = null;
try {
  const fifo = join(work, 'profile');
  await run(['mkfifo', fifo]);
  writer = spawn('/bin/sh', ['-c', '{ dd if=/dev/zero bs=65537 count=1 2>/dev/null; sleep 10; } > "$1"', 'writer', fifo], { detached: true, stdio: 'ignore' });
  const result = await capture([binary, '--image', image, '--sandbox-profile', fifo], { timeout: 3 });
  check(!result.timeout && result.returncode === 70 && result.stderr.toString().includes('bad compiled profile'), result.stderr.toString());
} finally {
  if (writer && writer.pid) {
    try {
      process.kill(-writer.pid, 'SIGKILL');
    } catch {}
  }
  rmSync(work, { recursive: true, force: true });
}
console.log('PASS: oversized profile rejected before EOF (maximum read 65537 bytes)');
