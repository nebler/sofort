import { spawnSync, execFileSync, spawn } from 'node:child_process';
import { realpathSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

async function main(): Promise<void> {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'grow-scriptc-spike-')));
  try {
    mkdirSync(join(dir, 'child'));
    writeFileSync(join(dir, 'child', 'input'), 'abc');
    assert.equal(readFileSync(join(dir, 'child', 'input'), 'utf8'), 'abc');
    assert.deepEqual(readdirSync(dir), ['child']);
    assert.equal(createHash('sha256').update('abc').digest('hex'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const child = spawnSync('/bin/sh', ['-c', 'printf "%s:%s" "$PWD" "$SPIKE_VALUE"; printf err >&2; exit 7'], {
      env: { PATH: '/usr/bin:/bin', SPIKE_VALUE: 'yes' },
      encoding: 'utf8',
      timeout: 1000,
      killSignal: 'SIGKILL',
    });
    assert.ok(child.status === 7);
    assert.equal(child.stdout, process.cwd() + ':yes');
    assert.equal(child.stderr, 'err');
    const timed = spawnSync('/bin/sleep', ['5'], { timeout: 30, killSignal: 'SIGKILL' });
    assert.ok((timed.error as unknown as { code: string })?.code === 'ETIMEDOUT');
    assert.ok(timed.signal === 'SIGKILL');
    assert.equal(execFileSync('/bin/pwd', [], { cwd: dir, encoding: 'utf8' }).trim(), dir);
    await new Promise<void>((resolve, reject) => {
      const p = spawn('/bin/sh', ['-c', 'read x; printf "%s:%s" "$x" "$SPIKE_VALUE"; printf err >&2; sleep 5'], {
        cwd: dir,
        env: { PATH: '/usr/bin:/bin', SPIKE_VALUE: 'async' },
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      p.stdout!.on('data', (chunk: Buffer) => stdout.push(chunk));
      p.stderr!.on('data', (chunk: Buffer) => stderr.push(chunk));
      p.stdin!.write('ping\n');
      const timer = setTimeout(() => {
        try {
          process.kill(-p.pid!, 'SIGKILL');
        } catch {
          p.kill('SIGKILL');
        }
      }, 100);
      p.on('error', reject);
      p.on('close', (code: number | null, signal: string | null) => {
        clearTimeout(timer);
        assert.ok(code === null);
        assert.ok(signal === 'SIGKILL');
        assert.equal(Buffer.concat(stdout).toString(), 'ping:async');
        assert.equal(Buffer.concat(stderr).toString(), 'err');
        resolve();
      });
    });
    assert.deepEqual(JSON.parse(JSON.stringify({ argv: process.argv.slice(2) })), { argv: ['--probe', 'yes'] });
    console.log(JSON.stringify({ status: 'PASS', platform: process.platform, arch: process.arch, primitives: ['spawnSync env/timeout/status/stdout/stderr', 'execFileSync cwd', 'spawn cwd/env/pipes/detached/held-stdin/group-kill/reap', 'fs directories/mkdtemp/read/write/cleanup', 'sha256', 'JSON', 'argv'] }, null, 2));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
