import { VM, type Frame } from './measure.ts';
import { check, same, sleep } from '../lib.ts';
const vm = new VM();
try {
  const boot = await vm.ready();
  await sleep(10);
  const start = performance.now();
  vm.run('return await Promise.all(Array.from({length:64},(_,i)=>test.echo(i)));');
  const calls: Frame[] = [];
  for (let i = 0; i < 64; i += 1) {
    const frame = await vm.recv();
    check(frame.id === i + 1 && frame.t === 'call' && same(frame.args, [i]));
    calls.push(frame);
  }
  for (const frame of calls.reverse()) {
    vm.send({ t: 'ret', id: frame.id, ok: frame.args![0] });
  }
  const done = await vm.recv();
  check(same(done, { t: 'done', ok: Array.from({ length: 64 }, (_, i) => i) }));
  const elapsed = performance.now() - start;
  console.log(JSON.stringify({ status: 'PASS', transport: 'real virtio-console', calls: 64, reply_order: '64..1', result: done.ok, warm_ms: elapsed, calls_s: 64000 / elapsed, ready_ms: boot }, null, 2));
} finally {
  await vm.close();
}
