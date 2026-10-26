import { join } from 'node:path';
import { options, dump, check } from '../lib.ts';
import { HERE, system, proc } from './runtime.ts';
import { memory, controls } from './collect.ts';
import { analyze, analyzeCPU } from './analysis.ts';

const action = process.argv[2];
const argv = process.argv.slice(3);
if (action === 'memory') {
  const args = options(argv, { artifacts: join(HERE, 'artifacts'), output: join(HERE, 'memory-raw.json'), variants: 'current,0,1,8', counts: '1,16,64,256', repeats: 3, details: 'sampled', inline_sandbox: false });
  check(['sampled', 'all'].includes(args.details));
  memory(args);
} else if (action === 'controls') {
  controls(options(argv, { artifacts: join(HERE, 'artifacts'), count: 16, repeats: 3, output: join(HERE, 'controls-raw.json') }));
} else if (action === 'analyze' || action === 'analyze-cpu') {
  const args = options(argv, { output: join(HERE, action === 'analyze' ? 'summary.json' : 'cpu-summary.json') }, ['input']);
  if (!args.input) {
    console.error('input is required');
    process.exit(2);
  }
  if (action === 'analyze') {
    analyze(args.input, args.output);
  } else {
    analyzeCPU(args.input, args.output);
  }
} else if (action === 'snapshot') {
  console.log(JSON.stringify({ host: system(), processes: argv.map(value => proc(Number(value))) }, null, 2));
} else {
  console.error('usage: ledger {memory,analyze,analyze-cpu,controls,snapshot} ...');
  process.exit(2);
}
