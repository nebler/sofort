import { join } from 'node:path';
import { VM, ROOT, quant, uptime } from './measure.ts';
import { check, counterMs, realtimeMs, dump } from '../lib.ts';
function hostOffset(): number {
  let width = Infinity;
  let offset = 0;
  for (let i = 0; i < 16; i += 1) {
    const a = counterMs();
    const r = realtimeMs();
    const b = counterMs();
    if (b - a < width) {
      width = b - a;
      offset = r - (a + b) / 2;
    }
  }
  return offset;
}
const samples: number[] = [];
const widths: number[] = [];
const bounds: number[] = [];
const load = uptime();
for (let i = 0; i < 30; i += 1) {
  const vm = new VM();
  try {
    await vm.ready();
    const offset = hostOffset();
    vm.run('let best=null;for(let i=0;i<64;i++){let a=os.now(),r=Date.now(),b=os.now();if(!best||b-a<best[2]-best[0])best=[a,r,b];}return best;');
    const frame = await vm.recv();
    check(frame.t === 'done');
    const [a, r, b] = frame.ok as number[];
    const delta = r - (a + b) / 2 - offset;
    samples.push(delta);
    widths.push(b - a);
    bounds.push(Math.abs(delta) + (b - a) / 2);
  } finally {
    await vm.close();
  }
}
check(Math.max(...bounds) < 1, JSON.stringify({ samples, widths, bounds }));
const result = { load, status: 'PASS', n: 30, method: 'Realtime minus guest counter compared with host realtime minus same-domain mach counter; 64 bracketed guest samples, narrowest retained. Date.now is millisecond quantized.', origin_error_ms: quant(samples), guest_bracket_width_ms: quant(widths), worst_abs_error_bound_ms: Math.max(...bounds), samples_ms: samples };
dump(join(ROOT, 'clock-check.json'), result);
console.log(JSON.stringify(result, null, 2));
