import { launchVm } from './supervisor.mjs';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
const binary = '/tmp/jitk-01/jitk-vmm';
const result = { timeout: [], parkRoundtrip: null, concurrency: null };
const pct = (xs,p) => [...xs].sort((a,b)=>a-b)[Math.ceil(xs.length*p)-1];
// Guest reports FDT, waits on the same input port, then shuts down after one byte.
let report = '', sent = false;
const worker = launchVm({ binary, argv: ['/tmp/jitk-01/park.bin'], onData(bytes) {
  report += bytes.toString();
  if (!sent && report.includes('virtio-count=')) {
    sent = true; worker.ready();
    if (!worker.run(Buffer.from('x'), 1000)) throw Error('unexpected backpressure');
  }
}});
result.parkRoundtrip = await worker.reaped;
if (!sent || result.parkRoundtrip.code !== 0) throw Error('console roundtrip failed');
// A real hung guest, external wall-clock kill, awaited asynchronously via child close.
for(let i=0;i<30;i++) {
  const w = launchVm({ binary, argv: ['/tmp/jitk-spike/boot/kk_hang.bin'], bootMs: 30 });
  const start = performance.now();
  const state = await w.reaped;
  if(state.signal !== 'SIGKILL' || state.reason !== 'boot-deadline') throw Error(JSON.stringify(state));
  result.timeout.push(performance.now()-start);
}
// Confirm separate processes can own concurrent HVF VMs and be reaped together.
let workers = [], readyCount = 0;
for(let i=0;i<16;i++) {
  let text = '', marked = false;
  const w = launchVm({binary,argv:['/tmp/jitk-01/park.bin'],bootMs:3000,onData(bytes) {
    text += bytes.toString();
    if(!marked && text.includes('virtio-count=')) { marked=true;readyCount++;w.ready(); }
  }});
  workers.push(w);
}
const readyDeadline=performance.now()+3000;
while(readyCount<16 && performance.now()<readyDeadline) await new Promise(r=>setTimeout(r,5));
const live = workers.filter(w=>w.phase === 'park').length;
if(live!==16) { workers.forEach(w=>w.kill('test-failed'));throw Error(`only ${live} guest-reported ready`); }
const killStart = performance.now();
workers.forEach(w=>w.kill('test-end'));
const statuses = await Promise.all(workers.map(w=>w.reaped));
result.concurrency = { live, reaped: statuses.length, killToLastReapMs: performance.now()-killStart, statuses };
await writeFile(new URL('./lifecycle-results.json',import.meta.url), JSON.stringify(result,null,2)+'\n');
console.log({parkRoundtrip:result.parkRoundtrip,timeoutN:30,timeoutFromSpawnMedianMs:pct(result.timeout,0.5),timeoutFromSpawnP90Ms:pct(result.timeout,0.9),concurrency:result.concurrency});
