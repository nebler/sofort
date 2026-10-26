import { renameSync } from 'node:fs';
import { join, parse } from 'node:path';
import { cpus, platform, release, arch, loadavg } from 'node:os';
import { check, detail, readJSON, dump, utc, command, Random, now } from './lib.ts';
import { HERE, gate, choose, makeSpecs, Worker, cleanup, startWatch, type Config, type Frame } from './controller.ts';
import { report } from './report.ts';
import { test } from './test-suite.ts';

export function defaults(): Config {
  return { samples: 30, load_threshold: 6, gate_budget: 10, gate_poll: 1, max_extra_rounds: 0, seed: 603, only: null, vmm: null, image: null, sandbox_profile: null, scratch_dir: null, node: null, no_hyperlight: false, executor_root: null, hyperlight_adapter: null, smoke: false, test: false, report: null, output: null };
}
function parseArgs(argv: string[]): Config {
  const args = defaults();
  const numbers = ['samples', 'load_threshold', 'gate_budget', 'gate_poll', 'max_extra_rounds', 'seed'];
  const booleans = ['no_hyperlight', 'smoke', 'test'];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('usage: run [--samples N] [--load-threshold N] [--gate-budget S] [--gate-poll S] [--max-extra-rounds N] [--seed N] [--only REGEX] [--vmm PATH] [--image PATH] [--sandbox-profile PATH] [--scratch-dir PATH] [--node PATH] [--no-hyperlight] [--executor-root PATH] [--hyperlight-adapter PATH] [--smoke] [--test] [--report JSON] [--output JSON]');
      process.exit(0);
    }
    const parts = argv[i].split('=');
    const key = parts[0].replace(/^--/, '').replace(/-/g, '_');
    check(argv[i].startsWith('--') && Object.keys(args).includes(key), 'unrecognized argument: ' + argv[i]);
    const record = args as unknown as Frame;
    if (booleans.includes(key)) {
      check(parts.length === 1, 'flag takes no value: ' + argv[i]);
      record[key] = true;
    } else {
      const value = parts.length > 1 ? parts.slice(1).join('=') : argv[++i];
      check(value !== undefined, 'missing value for ' + key);
      record[key] = numbers.includes(key) ? Number(value) : value;
      if (numbers.includes(key)) {
        check(Number.isFinite(record[key]), 'invalid number for ' + key);
      }
    }
  }
  for (const key of ['samples', 'max_extra_rounds', 'seed']) {
    check(Number.isSafeInteger((args as unknown as Frame)[key]), 'invalid integer for ' + key);
  }
  return args;
}
export function main(): void {
  let args: Config;
  try {
    args = parseArgs(process.argv.slice(2));
    check(args.smoke || args.test || args.report || args.samples >= 30, 'canonical run requires samples >= 30');
    check([args.gate_budget, args.gate_poll, args.load_threshold].every(Number.isFinite) && args.gate_budget >= 0 && args.gate_poll > 0 && args.load_threshold > 0 && args.max_extra_rounds >= 0, 'invalid gate configuration');
  } catch (error) {
    console.error(detail(error));
    process.exit(2);
  }
  if (args.test) {
    test();
    return;
  }
  if (args.report) {
    report(readJSON<Frame>(args.report), join(HERE, 'RESULTS.md'));
    return;
  }
  const selection = choose(args);
  let specs = makeSpecs(selection);
  if (args.only) {
    const pattern = new RegExp(args.only);
    specs = specs.filter(spec => pattern.test(spec.name));
  }
  if (!specs.length) {
    console.error('--only matched no cases');
    process.exit(2);
  }
  const raw = args.output || join(HERE, args.smoke ? 'smoke.json' : 'raw.json');
  const data: Frame = { schema: 1, started_at: utc(), config: args, selection, specs, samples: [], statistics: { method: 'percentile IID bootstrap', draws: 2000, seed: 601, quantile: 'linear order-statistic interpolation', confidence: 0.95 }, raw_path: raw,
    machine: { platform: `${platform()}-${release()}-${arch()}`, cpu_count: cpus().length, uptime: command(['/usr/bin/uptime']), sysctl: command(['/usr/sbin/sysctl', 'hw.model', 'hw.memsize', 'hw.ncpu', 'kern.hv.max_address_spaces']), vm_stat: command(['/usr/bin/vm_stat']), runtime: 'scriptc 0.4.5', timezone: [command(['/bin/date', '+%Z'])] }, missing: [] };
  if (!selection.executor.integrated) {
    data.missing.push('integrated executor READY');
  }
  if (!selection.sandbox_probe) {
    data.missing.push('precompiled sandbox on/off');
  }
  if (!selection.hyperlight) {
    data.missing.push('Hyperlight adapter');
  }
  const save = (): void => {
    const path = parse(raw);
    const temporary = join(path.dir, path.name + '.tmp');
    dump(temporary, data);
    renameSync(temporary, raw);
  };
  startWatch();
  let clone: Worker | null = null;
  try {
    const admissions: { label: string; argv: string[] }[] = [{ label: 'jitk', argv: selection.argv }];
    if (selection.hyperlight) {
      admissions.push({ label: 'hl-strict', argv: selection.hyperlight.strict_argv });
    }
    for (const admission of admissions) {
      let passed = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const entry: Frame = { label: admission.label, attempt: attempt + 1, at: utc(), load: loadavg(), uptime: command(['/usr/bin/uptime']) };
        let worker: Worker | null = null;
        try {
          worker = new Worker(admission.argv);
          worker.ready(admission.label === 'jitk' && Boolean(selection.require_sandbox_ack));
          worker.run('one_tool');
          entry.status = 'PASS';
          entry.ms = (now() - worker.start) * 1000;
        } catch (error) {
          entry.status = 'FAIL';
          entry.error = detail(error);
        } finally {
          if (worker) {
            worker.close();
          }
          if (!data.admission) {
            data.admission = [];
          }
          data.admission.push(entry);
          save();
        }
        if (entry.status === 'PASS') {
          passed = true;
          break;
        }
        gate(args.load_threshold, Math.min(args.gate_budget, 10), args.gate_poll);
      }
      check(passed, 'three admission failures; retained in raw JSON');
    }
    if (selection.hyperlight && specs.some(x => x.mode === 'hl-clone')) {
      clone = new Worker(selection.hyperlight.clone_argv, selection.hyperlight.env || {}, 7200);
      clone.ready();
    }
    const rounds = args.smoke ? 2 : args.samples + args.max_extra_rounds;
    for (let block = 0; block < rounds; block += 1) {
      const order = [...specs];
      new Random(args.seed + block).shuffle(order);
      for (const spec of order) {
        const g = gate(args.load_threshold, args.gate_budget, args.gate_poll);
        const row: Frame = { name: spec.name, block, started_at: utc(), gate: g, load_before: loadavg(), uptime: command(['/usr/bin/uptime']) };
        try {
          Object.assign(row, sample(spec, selection, clone));
          row.status = 'PASS';
        } catch (error) {
          row.status = 'FAIL';
          row.error = detail(error);
        }
        row.finished_at = utc();
        row.load_after = loadavg();
        data.samples.push(row);
        save();
        console.log(JSON.stringify({ name: row.name, block, status: row.status, load_before: row.load_before }));
      }
      if (!args.smoke && (block + 1) % 10 === 0) {
        report(data, join(HERE, 'RESULTS.md'));
      }
      if (!args.smoke && block + 1 >= args.samples && specs.every(spec => data.samples.filter((row: Frame) => row.name === spec.name && row.status === 'PASS' && row.gate.passed).length >= args.samples)) {
        break;
      }
    }
  } finally {
    if (clone) {
      clone.close();
    }
    cleanup();
    data.finished_at = utc();
    data.uptime_end = command(['/usr/bin/uptime']);
    data.vm_stat_end = command(['/usr/bin/vm_stat']);
    save();
    if (!args.smoke) {
      report(data, join(HERE, 'RESULTS.md'));
    }
  }
  console.log('RAW ' + raw);
}
import { sample } from './controller.ts';
try {
  main();
} catch (error) {
  console.error(detail(error));
  process.exit(1);
}
