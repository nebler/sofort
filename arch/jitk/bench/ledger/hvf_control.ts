import { join } from 'node:path';
import { check, dump } from '../lib.ts';
import { write } from '../native.ts';
import { type Frame } from '../controller.ts';
import { HERE, host, Worker, proc, system, diagnostics } from './runtime.ts';

const out = join(HERE, 'hvf-control-raw.json');
const repeats: Frame[] = [];
const data: Frame = { start: host(), repeats };
for (let repeat = 0; repeat < 3; repeat += 1) {
  const worker = new Worker([join(HERE, 'artifacts/hvf-control'), join(HERE, 'artifacts/image.bin')]);
  const stages: Frame[] = [];
  const row: Frame = { repeat, stages };
  repeats.push(row);
  try {
    for (let i = 0; i < 7; i += 1) {
      const frame = worker.recv();
      check(!frame.hv_result, JSON.stringify(frame));
      const stage: Frame = {};
      Object.assign(stage, frame);
      stage.process = proc(worker.pid);
      stage.system = system();
      stage.diagnostics = diagnostics(worker.pid, join(HERE, 'raw/hvf-control', 'r' + repeat, frame.stage), true);
      stages.push(stage);
      dump(out, data);
      write(worker.worker.p.stdin, Buffer.from('x'));
    }
    row.status = 'ok';
  } finally {
    row.reap = worker.close();
    dump(out, data);
  }
}
data.end = host();
dump(out, data);
