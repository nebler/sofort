// Stress subject for the scriptc 0.4.5 lost child-exit wakeup (SCRIPTC-HANG.md).
// Spawns short-lived children in batches and awaits each close. Modes:
//   raw    spawn + await close, no timer: the runtime bounds its idle child
//          wait at 1 s, so a lost wakeup is a ~1 s stall
//   far    raw plus a 1800 s kill timer per child (the old lib.ts capture
//          shape): a lost wakeup sleeps to that deadline, i.e. hangs
//   tslib  ../process.ts spawnCapture (keepalive + overall timeout)
// After each batch "done slow20 slow200 slow900 worst-ms" goes to --progress
// with a synchronous write, so a watchdog sees progress without loop activity.
import { spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { spawnCapture, startDirect } from '../process.ts';

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf('--' + name);
  return index < 0 ? fallback : String(process.argv[index + 1]);
}

const mode = option('mode', 'raw');
const count = Number(option('count', '200'));
const concurrency = Number(option('concurrency', '1'));
const progress = option('progress', '');
const pipes = option('stdio', 'pipe') === 'pipe';
const program = option('program', '/usr/bin/true');
const programArgs = option('args', '').split(',').filter(s => s.length > 0);
const detached = option('detached', '0') === '1';
const wrap = option('env', '0') === '1';

// scriptc wants literal stdio and detached options: one spawn per shape.
function start(): ChildProcess {
  const file = wrap ? '/usr/bin/env' : program;
  const args = wrap ? ['-i', 'PATH=/usr/bin:/bin', program, ...programArgs] : programArgs;
  if (detached) {
    return pipes
      ? spawn(file, args, { detached: true, stdio: ['pipe', 'pipe', 'pipe'] })
      : spawn(file, args, { detached: true, stdio: 'ignore' });
  }
  return pipes
    ? spawn(file, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    : spawn(file, args, { stdio: 'ignore' });
}

async function raw(far: boolean): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const child = start();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (far) {
      timer = setTimeout(() => child.kill('SIGKILL'), 1800 * 1000);
    }
    if (pipes) {
      child.stdout!.on('data', () => {});
      child.stderr!.on('data', () => {});
      child.stdin!.end();
    }
    child.on('error', reject);
    child.on('close', (code: number | null) => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      resolve(code ?? -1);
    });
  });
}

async function viaLib(): Promise<number> {
  const exit = await spawnCapture([program, ...programArgs], { stdio: 'pipe', timeout: 1800 }, startDirect);
  return exit.code ?? -1;
}

async function one(): Promise<number> {
  if (mode === 'tslib') {
    return await viaLib();
  }
  return await raw(mode === 'far');
}

// Batch latency buckets: a lost wakeup costs up to the loop's next deadline,
// about 1 s in raw mode (the runtime's idle poll cap), the far timer in far
// mode (a hang), and at most the keepalive period in tslib mode.
async function main(): Promise<void> {
  let done = 0;
  const slow = [0, 0, 0];
  let worst = 0;
  while (done < count) {
    const started = performance.now();
    const batch: Promise<number>[] = [];
    for (let i = 0; i < concurrency && done + i < count; i += 1) {
      batch.push(one());
    }
    const codes = await Promise.all(batch);
    for (const code of codes) {
      if (code !== 0) {
        throw new Error('child exit ' + code);
      }
    }
    const elapsed = performance.now() - started;
    worst = Math.max(worst, elapsed);
    slow[0] += elapsed > 20 ? 1 : 0;
    slow[1] += elapsed > 200 ? 1 : 0;
    slow[2] += elapsed > 900 ? 1 : 0;
    done += codes.length;
    if (progress) {
      writeFileSync(progress, [done, slow[0], slow[1], slow[2], Math.round(worst)].join(' ') + '\n');
    }
  }
}

await main();
