import { propagate, Interrupted } from '../lib.ts';
import { join, resolve, dirname, isAbsolute } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadavg, cpus, platform, release, tmpdir } from 'node:os';
import { options, check, readJSON, dump, sha, utc, command, clockNS, now, median, Random, detail } from '../lib.ts';
import { sleep, usage } from '../native.ts';
import { Worker, CASES, HERE as CONTROLLER, ROOT as JITK, gate, startWatch, cleanup, type Frame } from '../controller.ts';
import { report } from '../report.ts';
import { artifactPath, requireArtifact } from '../../tslib/deps.ts';

const ROOT = import.meta.dirname;
// Explicit variables (or HYPERLIGHT_BUILD_DIR outputs), else the deps cache.
const NODE = artifactPath('JITK_NODE');
const BUILD = process.env.HYPERLIGHT_BUILD_DIR || '';
const WORKER = resolve(process.env.HYPERLIGHT_WORKER || (BUILD ? join(BUILD, 'target/release/r2-worker') : artifactPath('HYPERLIGHT_WORKER')));
const SNAPSHOT = resolve(process.env.HYPERLIGHT_SNAPSHOT || (BUILD ? join(BUILD, 'snapshot') : artifactPath('HYPERLIGHT_SNAPSHOT')));
const MODES = ['jitk-cold', 'hl-strict-cold', 'jitk-parked', 'hl-strict-prespawned', 'hl-logical-clone'];
const CONTRACTS: Record<string, string> = {};
for (const mode of MODES) {
  CONTRACTS[mode] = mode === 'hl-logical-clone' ? 'shared HW VM, fresh logical clone per request' : 'fresh process + single-use HW VM';
}
delete CASES.one_tool;
CASES.cpu50ms = { code: 'const end=Date.now()+50; let n=0; do {for(let i=0;i<1000;i++)n=(n+i)|0;} while(Date.now()<end); return 2;', expected: 2, tool_delay_ms: 0 };
interface JitkConfig {
  vmm: string;
  image: string;
  launcher: string;
  parkingEvidence: string;
  hyperlight: { worker: string; snapshot: string };
  sandboxProfile?: string;
}
function jitkConfig(): JitkConfig {
  const cfg: JitkConfig = { vmm: resolve(artifactPath('JITK_VMM_BINARY')), image: resolve(process.env.JITK_KERNEL_IMAGE || process.env.JITK_IMAGE || join(JITK, 'kernel/dist/kernel.bin')), launcher: '01-vmm', parkingEvidence: join(JITK, 'kernel/.READY'), hyperlight: { worker: WORKER, snapshot: SNAPSHOT } };
  for (const key of ['vmm', 'image']) {
    const path = key === 'vmm' ? cfg.vmm : cfg.image;
    check(existsSync(path), 'Missing canonical ' + key + ': ' + path + '; run make -C arch/jitk deps build, or set JITK_VMM_BINARY and JITK_KERNEL_IMAGE (or JITK_IMAGE)');
  }
  return cfg;
}
function jitkArgv(cfg: JitkConfig): string[] {
  const argv = [String(cfg.vmm), '--image', String(cfg.image), '--mem-mib', '32'];
  if (process.platform === 'darwin') {
    const folder = mkdtempSync(join(tmpdir(), 'jitk-hyperlight-'));
    const profile = join(folder, 'profile.sbbin');
    try {
      execFileSync(cfg.vmm, ['--compile-profile', profile, '--images', dirname(cfg.image)], { timeout: 30000, stdio: 'pipe' });
      cfg.sandboxProfile = profile;
    } catch (error) {
      propagate(error);
      rmSync(folder, { recursive: true, force: true });
      throw error;
    }
    argv.push('--sandbox-profile', profile);
  }
  return argv;
}
class Suite {
  executor = existsSync(join(JITK, 'executor/.READY'));
  cfg: JitkConfig;
  argv: string[];
  clone: Worker | null = null;
  constructor() {
    this.cfg = jitkConfig();
    this.argv = jitkArgv(this.cfg);
    try {
      this.clone = new Worker([WORKER, 'clone', SNAPSHOT], {}, 7200);
      this.clone.ready();
    } catch (error) {
      propagate(error);
      this.close();
      throw error;
    }
  }
  close(): void {
    if (this.clone) {
      this.clone.close();
    }
    if (this.cfg.sandboxProfile) {
      rmSync(this.cfg.sandboxProfile, { force: true });
    }
  }
  sample(mode: string, caseName: string): Frame {
    if (mode !== 'hl-logical-clone' && this.executor) {
      const c: Frame = {};
      Object.assign(c, CASES[caseName]);
      c.calls = caseName === 'promise10_5ms' ? 10 : caseName === 'one_tool_5ms' ? 1 : 0;
      const worker = new Worker([NODE, '--experimental-transform-types', join(ROOT, 'executor-runner.mjs'), join(JITK, 'executor/build'), mode, JSON.stringify(c), JSON.stringify(this.cfg)], {}, 40);
      try {
        const ready = worker.recv();
        check(ready.t === 'prepared', JSON.stringify(ready));
        const parked = ready.worker_pid ? usage(ready.worker_pid) : null;
        worker.send({ t: 'go' });
        const r = worker.recv(30);
        check(r.t === 'measurement' && !('error' in r), JSON.stringify(r));
        r.parked_memory_bytes = parked;
        r.jitk_path = mode.startsWith('jitk') ? '04 integrated executor' : null;
        r.host_path = '04 integrated executor';
        r.isolation = CONTRACTS[mode];
        const end = now() + 10;
        while (worker.hasFDs && now() < end) {
          worker.pump(0.05);
        }
        check(!worker.hasFDs, 'executor cleanup timeout');
        return r;
      } finally {
        worker.close();
      }
    }
    const cold = ['jitk-cold', 'hl-strict-cold'].includes(mode);
    const worker = mode === 'hl-logical-clone' ? this.clone : new Worker(mode.startsWith('jitk') ? this.argv : [WORKER, 'strict', SNAPSHOT]);
    check(worker, 'missing logical clone');
    let r: Frame = {};
    try {
      if (worker !== this.clone) {
        worker.ready(mode.startsWith('jitk'));
      }
      const readyMs = Number(clockNS() - worker.startNS) / 1e6;
      if (!cold) {
        sleep(0.005);
      }
      const parked = usage(worker.pid);
      r = worker.run(caseName, cold);
      r.parked_memory_bytes = parked;
      r.spawn_to_ready_ms = worker !== this.clone ? readyMs : null;
      r.isolation = CONTRACTS[mode];
      r.jitk_path = mode.startsWith('jitk') ? 'canonical VMM raw channel (executor not READY at run start)' : null;
      return r;
    } finally {
      if (worker !== this.clone) {
        worker.close();
        r.cpu_ms_vm = worker.cpu_ms;
        r.through_reap_ms = Number(clockNS() - worker.startNS) / 1e6;
      }
    }
  }
}
function memorySample(kind: string, count: number, cfg: JitkConfig): Frame {
  const argv = kind === 'jitk' ? [String(cfg.vmm), '--image', String(cfg.image), '--mem-mib', '32'] : kind === 'hl-strict' ? [WORKER, 'strict', SNAPSHOT] : [WORKER, 'hold', SNAPSHOT, String(count)];
  if (kind === 'jitk' && cfg.sandboxProfile) {
    argv.push('--sandbox-profile', cfg.sandboxProfile);
  }
  const worker = new Worker(argv);
  try {
    worker.ready(kind === 'jitk');
    const readings: Record<string, number>[] = [];
    for (let i = 0; i < 5; i += 1) {
      sleep(0.002);
      const value = usage(worker.pid);
      check(value, 'memory unavailable');
      readings.push(value);
    }
    return { footprint_mib: median(readings.map(x => x.footprint / 1048576)), rss_mib: median(readings.map(x => x.rss / 1048576)), memory_readings: readings, units: count };
  } finally {
    worker.close();
  }
}
function main(): void {
  const args = options(process.argv.slice(2), { n: 30, gate_budget: 0.1, load_threshold: 6, output: join(ROOT, 'results'), smoke: false }, ['n']);
  args.n = Number(args.n);
  if ((!args.smoke && args.n < 30) || !isAbsolute(NODE)) {
    console.error('n >=30 required and JITK_NODE must be an absolute Node executable; see README.md');
    process.exit(2);
  }
  try {
    for (const name of ['JITK_NODE', 'HYPERLIGHT_JS_SRC']) {
      requireArtifact(name);
    }
  } catch (error) {
    console.error(detail(error));
    process.exit(2);
  }
  const out = String(args.output);
  mkdirSync(out, { recursive: true });
  const config: Frame = {};
  Object.assign(config, args);
  config.seed = 39009;
  config.gate_poll = 0.1;
  const samples: Frame[] = [];
  const specs: Frame[] = [];
  const missing: string[] = [];
  const data: Frame = { schema: 1, started_at: utc(), config, selection: {}, specs, samples, raw_path: join(out, 'raw.json'), missing, machine: { platform: `${platform()}-${release()}`, uptime: command(['/usr/bin/uptime']), cpu_count: cpus().length } };
  for (const mode of MODES) {
    for (const caseName of Object.keys(CASES)) {
      specs.push({ mode, case: caseName, name: mode + '/' + caseName });
    }
  }
  for (const [kind, count] of [['jitk', 1], ['hl-strict', 1], ['hl-logical', 1], ['hl-logical', 17], ['hl-logical', 33]] as [string, number][]) {
    specs.push({ mode: 'memory', kind, count, name: `memory/${kind}/${count}` });
  }
  const save = (): void => {
    dump(join(out, 'raw.tmp'), data);
    renameSync(join(out, 'raw.tmp'), join(out, 'raw.json'));
  };
  startWatch();
  let suite: Suite | null = null;
  try {
    suite = new Suite();
    const source = join(CONTROLLER, 'controller.ts');
    const hl: Frame = readJSON<Frame>(join(ROOT, 'adapter.json'));
    hl.strict_argv = [WORKER, 'strict', SNAPSHOT];
    hl.clone_argv = [WORKER, 'clone', SNAPSHOT];
    data.selection = { jitk: suite.cfg, executor_ready_at_start: suite.executor, protocol: join(JITK, 'protocol/dispatcher.ts'), canonical_controller_sha256: sha(source), canonical_controller: source, bench_ready_at_start: existsSync(join(CONTROLLER, '.READY')), hyperlight: hl, contracts: CONTRACTS, hashes: {} };
    for (const path of [WORKER, String(suite.cfg.vmm), String(suite.cfg.image), join(ROOT, 'executor-runner.mjs')]) {
      data.selection.hashes[path] = sha(path);
    }
    if (!suite.executor) {
      missing.push('04 integrated executor not READY at start; canonical VMM raw channel used');
    }
    writeFileSync(join(out, 'controller-source.ts'), readFileSync(source));
    data.selection.controller_source_archive = 'controller-source.ts';
    data.selection.snapshot_index = readJSON<Frame>(join(SNAPSHOT, 'index.json'));
    for (const mode of MODES) {
      suite.sample(mode, 'return2');
    }
    for (let block = 0; block < args.n; block += 1) {
      const order = [...specs];
      new Random(39009 + block).shuffle(order);
      for (const spec of order) {
        const g = gate(args.load_threshold, args.gate_budget, 0.1);
        const row: Frame = { name: spec.name, block, mode: spec.mode, case: spec.case ?? null, started_at: utc(), gate: g, load_before: loadavg(), uptime: command(['/usr/bin/uptime']) };
        try {
          Object.assign(row, spec.mode === 'memory' ? memorySample(spec.kind, spec.count, suite.cfg) : suite.sample(spec.mode, spec.case));
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
        check(row.status === 'PASS', JSON.stringify(row));
      }
      console.log(JSON.stringify({ block, status: 'PASS', uptime: command(['/usr/bin/uptime']) }));
    }
  } finally {
    if (suite) {
      suite.close();
    }
    cleanup();
    data.finished_at = utc();
    data.uptime_end = command(['/usr/bin/uptime']);
    save();
    report(data, join(out, 'RESULTS.md'));
  }
}
main();
