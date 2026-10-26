import { propagate, Interrupted } from './lib.ts';
import { join, resolve, dirname, parse } from 'node:path';
import { mkdirSync, renameSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { loadavg, cpus, platform, release } from 'node:os';
import { options, check, readJSON, dump, utc, command, Random, median, stats, detail } from './lib.ts';
import { start, close, wait } from './native.ts';
import { HERE, Worker, gate, choose, sample, startWatch, watch, cleanup, ACTIVE, type Frame, type Spec, type SelectionConfig } from './controller.ts';

import { SPECS, pairedSummary } from './paired.ts';

function main(): void {
  const args = options(process.argv.slice(2), { vmm: null, baseline: null, image: null, scratch_dir: null, output: null, samples: 60, gate_budget: 1, seed: 604 });
  if (!['vmm', 'baseline', 'image', 'scratch_dir', 'output'].every(k => args[k]) || args.samples < 60) {
    console.error('--vmm, --baseline, --image, --scratch-dir, --output required; recertification requires n>=60 per build/case');
    process.exit(2);
  }
  const raw = resolve(args.output);
  mkdirSync(dirname(raw), { recursive: true });
  const samples: Frame[] = [];
  const admissions: Frame[] = [];
  const monitorRows: Frame[] = [{ at: utc(), load: loadavg() }];
  const data: Frame = { schema: 1, started_at: utc(), config: args, samples, statistics: { estimator: 'median(v2_i - baseline_i), pairs are adjacent randomized builds in a case/block', bootstrap: '2000 paired IID resamples; percentile CI95; seed 601; no trimming' }, load_monitor: monitorRows, machine: { platform: `${platform()}-${release()}`, cpu_count: cpus().length, uptime: command(['/usr/bin/uptime']), sysctl: command(['/usr/sbin/sysctl', 'hw.model', 'hw.memsize', 'hw.ncpu', 'kern.hv.max_address_spaces']) } };
  const monitorPath = raw + '.load-monitor';
  rmSync(monitorPath, { force: true });
  rmSync(monitorPath + '.stop', { force: true });
  startWatch();
  const monitor = start([join(HERE, 'build/load-monitor'), monitorPath]);
  watch('+' + monitor.pid + ' 7200');
  // Include setup in the monitor interval, before artifact freezing starts.

  const updateMonitor = (): void => {
    if (existsSync(monitorPath)) {
      const text = readFileSync(monitorPath, 'utf8');
      const complete = text.slice(0, text.lastIndexOf('\n') + 1);
      if (complete) {
        data.load_monitor = complete.trim().split('\n').map(line => JSON.parse(line) as Frame);
      }
    }
  };
  const save = (): void => {
    updateMonitor();
    const path = parse(raw);
    const tmp = join(path.dir, path.name + '.tmp');
    dump(tmp, data);
    renameSync(tmp, raw);
  };
  const selections: Frame = {};
  try {
    for (const [label, vmm] of [['baseline', String(args.baseline)], ['v2', String(args.vmm)]]) {
      const cfg = { vmm, image: String(args.image), sandbox_profile: 'auto', scratch_dir: String(args.scratch_dir), hyperlight_adapter: null, no_hyperlight: true, executor_root: null, node: null } as SelectionConfig;
      selections[label] = choose(cfg);
    }
    data.selection = selections;
    for (const label of Object.keys(selections)) {
      let passed = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const entry: Frame = { build: label, attempt: attempt + 1, at: utc(), load: loadavg() };
        let w: Worker | null = null;
        try {
          w = new Worker(selections[label].argv);
          w.ready(true);
          w.run('one_tool');
          entry.status = 'PASS';
        } catch (error) {
          propagate(error);
          entry.status = 'FAIL';
          entry.error = detail(error);
        } finally {
          if (w) {
            w.close();
          }
          admissions.push(entry);
          data.admission = admissions;
          save();
        }
        if (entry.status === 'PASS') {
          passed = true;
          break;
        }
        gate(6, args.gate_budget);
      }
      check(passed, 'three admission failures; raw retained');
    }
    const collect = (passName: string): void => {
      for (let block = 0; block < args.samples; block += 1) {
        const order = [...SPECS];
        const rng = new Random(args.seed + block);
        rng.shuffle(order);
        for (const spec of order) {
          const builds = ['baseline', 'v2'];
          rng.shuffle(builds);
          for (const label of builds) {
            const g = gate(6, args.gate_budget);
            const row: Frame = { pass: passName, block, name: spec.name, build: label, started_at: utc(), gate: g, load_before: loadavg(), uptime: command(['/usr/bin/uptime']) };
            try {
              Object.assign(row, sample(spec, selections[label], null));
              row.status = 'PASS';
            } catch (error) {
              propagate(error);
              row.status = 'FAIL';
              row.error = detail(error);
            }
            row.finished_at = utc();
            row.load_after = loadavg();
            samples.push(row);
            save();
          }
          console.log(JSON.stringify({ pass: passName, block, case: spec.name, status: (data.samples as Frame[]).slice(-2).map(r => r.status), load: loadavg() }));
        }
      }
    };
    collect('paired');
    updateMonitor();
    if ((data.load_monitor as Frame[]).some(r => r.load[0] < 6)) {
      data.quiet_pass = 'triggered by observed load1 < 6; each sample retains the same gate; quiet claims require >=30 passes per row';
      collect('quiet-pass');
    } else {
      data.quiet_pass = 'No quiet pass was possible: load1 never dropped below 6 during monitored setup and collection.';
    }
    data.summary = {};
    const passes = Array.from(new Set<string>((data.samples as Frame[]).map(r => String(r.pass)))).sort();
    for (const name of passes) {
      data.summary[name] = pairedSummary((data.samples as Frame[]).filter(r => r.pass === name));
    }
  } finally {
    cleanup();
    writeFileSync(monitorPath + '.stop', 'stop\n');
    wait(monitor.pid);
    close(monitor.stdin);
    close(monitor.stdout);
    close(monitor.stderr);
    data.finished_at = utc();
    data.active_owned_pids = Array.from(ACTIVE);
    data.uptime_end = command(['/usr/bin/uptime']);
    updateMonitor();
    const loads = (data.load_monitor as Frame[]).map(r => Number(r.load[0]));
    data.load1_monitor_range = [Math.min(...loads), Math.max(...loads)];
    save();
  }
  console.log('RAW ' + raw);
}
main();
