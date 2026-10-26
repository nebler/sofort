import { join } from 'node:path';
import { ROOT, VM, quant, uptime } from './measure.ts';
import { check, dump, realtimeMs, same } from '../lib.ts';
const result: Record<string, unknown> = { load: uptime() };
async function one(code: string): Promise<{ frame: Awaited<ReturnType<VM['recv']>>; lo: number; hi: number }> {
  const vm = new VM();
  try {
    await vm.ready();
    const lo = realtimeMs();
    vm.run(code);
    const frame = await vm.recv();
    const hi = realtimeMs();
    check(frame.t === 'done', JSON.stringify(frame));
    return { frame, lo, hi };
  } finally {
    await vm.close();
  }
}
const churn = await one('let sum=0;for(let i=0;i<128;i++){let a=new Uint8Array(1048576);a[0]=i;a[a.length-1]=i;sum+=a[0];a=null;std.gc();}return sum;');
check(same(churn.frame, { t: 'done', ok: 8128 }));
result.churn = { cumulative_bytes: 128 * 1048576, ram_mib: 32, result: churn.frame };
const clocks: number[] = [];
let bounded = 0;
for (let i = 0; i < 30; i += 1) {
  const { frame, lo, hi } = await one('return Date.now();');
  const guest = Number(frame.ok);
  if (lo - 1 <= guest && guest <= hi + 1) {
    bounded += 1;
  }
  clocks.push(guest - (lo + hi) / 2);
}
check(bounded === 30, JSON.stringify(clocks));
result.clock = { host_interval_plus_1ms: bounded, n: 30, midpoint_delta_ms: quant(clocks) };
const latency: number[] = [];
for (let i = 0; i < 30; i += 1) {
  const start = performance.now();
  const { frame } = await one('await new Promise(resolve=>setTimeout(resolve,5));return 2;');
  check(same(frame, { t: 'done', ok: 2 }));
  latency.push(performance.now() - start);
}
result.finite_timer_e2e_ms = quant(latency);
let vm = new VM();
try {
  await vm.ready();
  vm.p.stdin!.end();
  let terminated = false;
  try {
    await vm.recv();
  } catch {
    terminated = true;
  }
  check(terminated, 'EOF returned a success frame');
  result.eof = 'PASS: clean input EOF terminates without a success frame';
} finally {
  await vm.close();
}
vm = new VM();
try {
  await vm.ready();
  const frame = Buffer.from(JSON.stringify({ t: 'run', code: 'return await test.echo(1);', ns: { test: ['echo'] } }) + '\n');
  for (const byte of frame) {
    vm.p.stdin!.write(Buffer.from([byte]));
  }
  check((await vm.recv()).t === 'call');
  vm.send({ t: 'ret', id: 1, ok: 'x'.repeat(32768) });
  check(same(await vm.recv(), { t: 'done', ok: 'x'.repeat(32768) }));
  result.partial_rx = 'PASS: 1-byte run fragments + 32KiB ret';
} finally {
  await vm.close();
}
async function rejected(code: string): Promise<string[]> {
  const child = new VM();
  try {
    await child.ready();
    child.run(code);
    let failed = false;
    try {
      await child.recv();
    } catch {
      failed = true;
    }
    check(failed && child.records.some(record => record.includes('fatal control byte')), 'control prefix escaped');
    return child.records;
  } finally {
    await child.close();
  }
}
result.control_forgery = await rejected('os.write(1,new Uint8Array([30,10]).buffer,0,2);return 2;');
const atomic: { byte: number; prefix_callbacks: number; status: string }[] = [];
for (const bad of [0, 30, 127, 128, 255]) {
  await rejected('let p=\'{"t":"call","id":1,"ns":"test","fn":"echo","args":[]}\\n\';let a=new Uint8Array(p.length+1);for(let i=0;i<p.length;i++)a[i]=p.charCodeAt(i);a[p.length]=' + bad + ';os.write(1,a.buffer,0,a.length);return 2;');
  atomic.push({ byte: bad, prefix_callbacks: 0, status: 'PASS' });
}
result.atomic_ascii = atomic;
result.status = 'PASS';
dump(join(ROOT, 'checks.json'), result);
console.log(JSON.stringify(result, null, 2));
