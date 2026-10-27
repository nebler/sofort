import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check, detail } from './lib.ts';
import { ROOT } from './runtime.ts';
import { requireArtifact } from '../tslib/deps.ts';
import { runE0, runE1, type RunOptions } from './experiment-run.ts';
import { failureAnalysis, renderSummary, sealReceipts, summarize, verifyReceipts } from './experiment-audit.ts';

async function main(argv: string[]): Promise<void> {
  if (!argv.length || argv.includes('--help')) {
    console.log('experiments run-e0|run-e1|summarize|render-summary|failure-analysis|seal-receipts|verify-receipts\nOptions: --meta PATH (repeatable), --output PATH, --require-complete, --artifacts\nRunner: --phase pilot|main --workers N --prefix ID --vmm PATH --sqlite-elf PATH --database PATH\nAll runner transactions are validate-only. Outputs default to ignored results/.');
    return;
  }
  const command = argv[0];
  const options: Record<string, string> = {};
  const meta: string[] = [];
  let complete = false;
  let artifacts = false;
  for (let i = 1; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--require-complete') {
      complete = true;
    } else if (flag === '--artifacts') {
      artifacts = true;
    } else {
      check(['--meta', '--output', '--phase', '--workers', '--prefix', '--vmm', '--sqlite-elf', '--database'].includes(flag), 'unknown option: ' + flag);
      check(i + 1 < argv.length, 'missing option value');
      const value = argv[++i];
      if (flag === '--meta') {
        meta.push(resolve(value));
      } else {
        options[flag] = value;
      }
    }
  }
  const defaults = join(ROOT, 'results', 'experiment-tools');
  mkdirSync(defaults, { recursive: true });
  if (command === 'run-e0' || command === 'run-e1') {
    const prefix = options['--prefix'] || command + '-' + Date.now();
    check(/^[a-zA-Z0-9_-]+$/.test(prefix), 'invalid prefix');
    const runOptions: RunOptions = { phase: options['--phase'] || 'pilot', workers: Number(options['--workers'] || 3), prefix, vmm: resolve(options['--vmm'] || requireArtifact('JITK_VMM_BINARY')), sqlite: resolve(options['--sqlite-elf'] || '/tmp/growos-inputs-20261026/sqlite3-static'), database: resolve(options['--database'] || join(ROOT, 'results/r7-grow/demo.db')) };
    if (command === 'run-e0') {
      await runE0(runOptions);
    } else {
      await runE1(runOptions);
    }
    return;
  }
  if (command === 'render-summary') {
    renderSummary(meta[0] || join(ROOT, 'experiments/summary.json'), resolve(options['--output'] || join(defaults, 'summary.html')));
    return;
  }
  const paths = meta.length ? meta : ['E1-pilot', 'E1'].map((name) => join(ROOT, 'experiments', name + '.json'));
  if (command === 'summarize') {
    summarize(paths, resolve(options['--output'] || join(defaults, 'summary.json')));
  } else if (command === 'failure-analysis') {
    failureAnalysis(paths, resolve(options['--output'] || join(defaults, 'failure-analysis.json')));
  } else if (command === 'seal-receipts') {
    for (const path of paths) {
      await sealReceipts(path, artifacts);
    }
  } else if (command === 'verify-receipts') {
    for (const path of paths) {
      console.log(path, JSON.stringify(verifyReceipts(path, complete)));
    }
  } else {
    throw new Error('unknown experiment command: ' + command);
  }
}
main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(detail(error));
  process.exitCode = 1;
});
