import { join } from 'node:path';
import { check, equal, stats, quant, now } from './lib.ts';
import { gate, Worker, ACTIVE, HERE } from './controller.ts';
import { start, write, close, wait, sleep } from './native.ts';

export function test(): void {
  check(quant([1, 2, 3, 4], 0.5) === 2.5);
  check(equal(stats(Array(30).fill(2), 50).p99, { value: 2, ci95: [2, 2] }));
  let clock = 0;
  const readings = [[10, 9, 8], [5, 8, 7]];
  const g = gate(6, 2, 1, () => readings.shift()!, () => clock, seconds => { clock += seconds; });
  check(g.passed && g.wait_s === 1);
  check(gate(6, 0, 1, () => [9, 8, 7]).timed_out);
  for (const eof of [false, true]) {
    const child = start(['/bin/sleep', '30']);
    const watcher = start([join(HERE, 'build/watchdog')]);
    write(watcher.stdin, Buffer.from('+' + child.pid + (eof ? ' 60\n' : ' .03\n')));
    if (eof) {
      close(watcher.stdin);
    }
    const end = now() + 3;
    let reaped = wait(child.pid, true);
    while (!reaped && now() < end) {
      sleep(0.01);
      reaped = wait(child.pid, true);
    }
    if (!eof) {
      close(watcher.stdin);
    }
    check(reaped?.status === -9, 'watchdog failed deadline/EOF');
    wait(watcher.pid);
    for (const fd of [child.stdin, child.stdout, child.stderr, watcher.stdout, watcher.stderr]) {
      close(fd);
    }
  }
  const malformed = new Worker(['/bin/sh', '-c', 'printf "invalid-json\\n"; exec /bin/sleep 30']);
  let refused = false;
  try {
    malformed.ready();
  } catch {
    refused = true;
  } finally {
    malformed.close();
  }
  check(refused && malformed.returncode === -9 && !ACTIVE.has(malformed.pid));
  // A detached grandchild must be killed even though it has its own session.
  const wrapper = new Worker([join(HERE, 'build/test-child')]);
  wrapper.treeCleanup = true;
  const pid = Number(wrapper.recv().pid);
  wrapper.close();
  let alive = true;
  try {
    process.kill(pid, 0);
  } catch {
    alive = false;
  }
  check(!alive, 'detached descendant survived wrapper cleanup');
  const parent = new Worker([join(HERE, 'build/test-child')]);
  const detached = Number(parent.recv().pid);
  const watcher = start([join(HERE, 'build/watchdog')]);
  write(watcher.stdin, Buffer.from('+' + parent.pid + ' 60\n'));
  close(watcher.stdin);
  wait(watcher.pid);
  parent.close();
  alive = true;
  try {
    process.kill(detached, 0);
  } catch {
    alive = false;
  }
  check(!alive, 'detached descendant survived external watchdog EOF');
  close(watcher.stdout);
  close(watcher.stderr);
  console.log('PASS statistics, gate pass/timeout, watchdog deadline/EOF, malformed output, detached descendants');
}
