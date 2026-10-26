import { readFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, copyFileSync, cpSync, readdirSync, statSync, symlinkSync, lstatSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute, basename, extname } from 'node:path';
import { loadavg, tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { check, equal, now, clockNS, readJSON, sha, command, median } from './lib.ts';
import { start, poll, read, write, close, wait, sleep, usage, childrenCPU, pollMany, type Child } from './native.ts';
import { kill, killDescendants } from './processes.ts';

// Paths are anchored to source, never the invocation directory or binary name.
export const HERE = resolve(import.meta.dirname);
export const ROOT = dirname(HERE);
export interface Case {
  code: string;
  expected: unknown;
  tool_delay_ms: number;
}
export const CASES = readJSON<Record<string, Case>>(join(HERE, 'cases.json'));
export const ACTIVE = new Set<number>();
let watchdog: Child | null = null;
export function startWatch(): void {
  watchdog = start([join(HERE, 'build/watchdog')]);
}
export function watch(line: string): void {
  if (watchdog) {
    write(watchdog.stdin, Buffer.from(line + '\n'));
  }
}
export function stopWatch(): void {
  if (watchdog) {
    close(watchdog.stdin);
    wait(watchdog.pid);
    close(watchdog.stdout);
    close(watchdog.stderr);
    watchdog = null;
  }
}
export function cleanup(): void {
  for (const pid of ACTIVE) {
    kill(pid);
    wait(pid);
    ACTIVE.delete(pid);
  }
  stopWatch();
}
export interface Gate {
  threshold: number;
  budget_s: number;
  wait_s: number;
  passed: boolean;
  timed_out: boolean;
  observations: { elapsed_s: number; load: number[] }[];
}
export function gate(threshold: number, budget: number, interval = 1, readLoad: () => number[] = loadavg, clock: () => number = now, pause: (seconds: number) => void = sleep): Gate {
  const start = clock();
  const observations: { elapsed_s: number; load: number[] }[] = [];
  while (true) {
    const load = readLoad();
    const elapsed = clock() - start;
    observations.push({ elapsed_s: elapsed, load });
    if (load[0] < threshold || elapsed >= budget) {
      return { threshold, budget_s: budget, wait_s: elapsed, passed: load[0] < threshold, timed_out: load[0] >= threshold, observations };
    }
    pause(Math.min(interval, Math.max(0, budget - elapsed)));
  }
}
export interface Frame {
  [key: string]: any;
}
export class Worker {
  startNS = clockNS();
  start = Number(this.startNS) / 1e9;
  p: Child;
  pid: number;
  treeCleanup: boolean;
  buf = Buffer.alloc(0);
  err = Buffer.alloc(0);
  frames: string[] = [];
  records: string[] = [];
  closed = false;
  strictProtocol = true;
  cpu_ms: number | null = null;
  returncode: number | null = null;
  constructor(argv: string[], env: Record<string, string> = {}, lifetime = 20) {
    const environment: Record<string, string> = { PATH: '/usr/bin:/bin' };
    for (const key of Object.keys(env)) {
      environment[key] = env[key];
    }
    this.p = start(argv, environment);
    this.pid = this.p.pid;
    ACTIVE.add(this.pid);
    watch('+' + this.pid + ' ' + lifetime);
    this.treeCleanup = ['node', 'node-real'].includes(basename(argv[0])) || argv.includes(join(HERE, 'executor.mjs'));
  }
  send(frame: Frame): void {
    const ascii = JSON.stringify(frame).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
    const wire = Buffer.from(ascii + '\n');
    check(wire.length <= 1048577, 'frame too large');
    write(this.p.stdin, wire);
  }
  pump(timeout: number): void {
    const readable = poll(this.p.stdout, this.p.stderr, timeout);
    for (const channel of [1, 2]) {
      if (!(readable & channel)) {
        continue;
      }
      const fd = channel === 1 ? this.p.stdout : this.p.stderr;
      const bytes = read(fd);
      if (!bytes.length) {
        close(fd);
        if (channel === 1) {
          this.p.stdout = -1;
        } else {
          this.p.stderr = -1;
        }
        continue;
      }
      if (channel === 2) {
        this.err = Buffer.concat([this.err, bytes]);
        check(!this.strictProtocol || this.err.length <= 65536, 'stderr cap');
      } else {
        this.buf = Buffer.concat([this.buf, bytes]);
        check(!this.strictProtocol || this.buf.length <= 2097152, 'stdout cap');
        while (this.buf.includes(10)) {
          const end = this.buf.indexOf(10);
          const line = this.buf.subarray(0, end);
          this.buf = this.buf.subarray(end + 1);
          if (line[0] === 30) {
            check(!this.strictProtocol || line.every(byte => byte < 128), 'non-ASCII record');
            this.records.push(line.toString('ascii'));
            continue;
          }
          check(!this.strictProtocol || line.every(byte => byte < 128), 'non-ASCII frame');
          JSON.parse(line.toString());
          this.frames.push(line.toString());
        }
      }
    }
  }
  get hasFDs(): boolean {
    return this.p.stdout >= 0 || this.p.stderr >= 0;
  }
  recv(timeout = 10): Frame {
    const end = now() + timeout;
    while (!this.frames.length) {
      check(this.hasFDs && now() < end, JSON.stringify({ stderr: this.err.toString(), partial: this.buf.subarray(0, 256).toString() }));
      this.pump(Math.min(0.1, end - now()));
    }
    return JSON.parse(this.frames.shift()!) as Frame;
  }
  ready(ack = false, timeout = 10): void {
    const frame = this.recv(timeout);
    check(equal(frame, { t: 'ready', v: 1 }), JSON.stringify(frame));
    if (ack) {
      const end = now() + 10;
      while (!this.err.includes(Buffer.from('{"sandbox":"ok"}\n'))) {
        check(this.hasFDs && now() < end, 'missing host sandbox ack');
        this.pump(Math.min(0.1, end - now()));
      }
    }
  }
  run(caseName: string, cold = false): Frame {
    const c = CASES[caseName];
    const before = clockNS();
    const loadStart = loadavg();
    this.send({ t: 'run', code: c.code, ns: { test: ['echo'] } });
    const due: { at: bigint; id: number; value: unknown }[] = [];
    let calls = 0;
    let maxPending = 0;
    const stamps: number[] = [];
    const end = now() + 10;
    while (true) {
      const current = clockNS();
      while (due.length && due[0].at <= current) {
        const item = due.shift()!;
        this.send({ t: 'ret', id: item.id, ok: item.value });
      }
      while (this.frames.length) {
        const m = JSON.parse(this.frames.shift()!) as Frame;
        if (m.t === 'done') {
          const done = clockNS();
          check(equal(m, { t: 'done', ok: c.expected }), JSON.stringify(m));
          check(due.length === 0, 'unawaited tool calls');
          const expectedCalls = caseName === 'promise10_5ms' ? 10 : caseName.startsWith('one_tool') ? 1 : 0;
          check(calls === expectedCalls, 'tool call count');
          return { latency_ms: Number(done - (cold ? this.startNS : before)) / 1e6, run_ms: Number(done - before) / 1e6, tool_calls: calls, max_pending: maxPending, call_stamps_ns: stamps, load_at_timing_start: loadStart, load_at_result: loadavg() };
        }
        if (m.t === 'log') {
          continue;
        }
        check(m.t === 'call' && m.id === calls + 1 && m.ns === 'test' && m.fn === 'echo' && m.args.length === 1, JSON.stringify(m));
        calls += 1;
        stamps.push(Number(clockNS()));
        due.push({ at: clockNS() + BigInt(Math.trunc(c.tool_delay_ms * 1e6)), id: m.id, value: m.args[0] });
        due.sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : a.id - b.id);
        maxPending = Math.max(maxPending, due.length);
      }
      check(now() <= end && this.hasFDs, this.err.toString());
      const timeout = due.length ? Math.max(0, Number(due[0].at - clockNS()) / 1e9) : 0.1;
      this.pump(Math.min(0.1, timeout));
    }
  }
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    let reaped = wait(this.pid, true);
    if (!reaped && this.treeCleanup) {
      killDescendants(this.pid);
      reaped = wait(this.pid, true);
    }
    if (!reaped) {
      try {
        process.kill(-this.pid, 'SIGKILL');
      } catch {
        try {
          process.kill(this.pid, 'SIGKILL');
        } catch {}
      }
      reaped = wait(this.pid);
    }
    check(reaped, 'missing reap');
    this.returncode = reaped.status;
    this.cpu_ms = reaped.cpu_ms;
    watch('-' + this.pid);
    ACTIVE.delete(this.pid);
    close(this.p.stdin);
    close(this.p.stdout);
    close(this.p.stderr);
  }
}
export interface Config {
  samples: number;
  load_threshold: number;
  gate_budget: number;
  gate_poll: number;
  max_extra_rounds: number;
  seed: number;
  only: string | null;
  vmm: string | null;
  image: string | null;
  sandbox_profile: string | null;
  scratch_dir: string | null;
  node: string | null;
  no_hyperlight: boolean;
  executor_root: string | null;
  hyperlight_adapter: string | null;
  smoke: boolean;
  test: boolean;
  report: string | null;
  output: string | null;
}
export function files(folder: string): string[] {
  if (!existsSync(folder)) {
    return [];
  }
  const result: string[] = [];
  for (const name of readdirSync(folder)) {
    if (name === 'node_modules') {
      continue;
    }
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      if (!lstatSync(path).isSymbolicLink()) {
        result.push(...files(path));
      }
    } else {
      result.push(path);
    }
  }
  return result;
}
function artifact(value: string | null, env: string, candidates: string[], label: string): string {
  const path = value || process.env[env] || candidates.find(p => existsSync(p) && statSync(p).isFile());
  check(path && existsSync(path) && statSync(path).isFile(), label + ' missing; build it inside ' + ROOT + ' or set ' + env + '/explicit CLI override');
  return realpathSync(path);
}
export interface SelectionConfig {
  vmm: string | null;
  image: string | null;
  sandbox_profile: string | null;
  scratch_dir: string | null;
  hyperlight_adapter: string | null;
  no_hyperlight: boolean;
  executor_root: string | null;
  node: string | null;
}
export function choose(args: SelectionConfig): Frame {
  const image = artifact(args.image, 'JITK_IMAGE', [join(ROOT, 'kernel/dist/kernel.bin'), join(ROOT, 'kernel/build/kernel.bin')], 'kernel image');
  const vmm = artifact(args.vmm, 'JITK_VMM_BINARY', [join(ROOT, 'vmm/build/jitk-vmm'), join(ROOT, 'vmm/target/release/jitk-vmm')], 'VMM');
  const selection: Frame = { kernel_source: args.image || process.env.JITK_IMAGE ? 'explicit override' : 'canonical kernel', vmm_source: args.vmm || process.env.JITK_VMM_BINARY ? 'explicit override' : 'canonical VMM' };
  const scratch = args.scratch_dir || process.env.JITK_BENCH_TMP || tmpdir();
  mkdirSync(scratch, { recursive: true });
  const frozen = realpathSync(mkdtempSync(join(scratch, 'jitk-bench-')));
  for (const [key, source, name] of [['image', image, 'kernel.bin'], ['vmm', vmm, 'jitk-vmm']]) {
    selection['source_' + key] = source;
    selection[key + '_sha256'] = sha(source);
    copyFileSync(source, join(frozen, name));
    selection[key] = join(frozen, name);
    check(sha(selection[key]) === selection[key + '_sha256'], 'artifact changed while copying');
  }
  selection.argv = [selection.vmm, '--image', selection.image, '--mem-mib', '32'];
  const profile = join(frozen, 'jitk.sbbin');
  if (args.sandbox_profile && args.sandbox_profile !== 'auto') {
    copyFileSync(args.sandbox_profile, profile);
  } else {
    execFileSync(selection.vmm, ['--compile-profile', profile, '--images', frozen], { timeout: 30000, stdio: 'pipe' });
  }
  selection.require_sandbox_ack = true;
  selection.sandbox_profile = profile;
  selection.sandbox_profile_sha256 = sha(profile);
  selection.argv.push('--sandbox-profile', profile);
  if (process.platform === 'darwin') {
    const probe = join(frozen, 'sandbox-probe');
    execFileSync('/usr/bin/clang', ['-O2', join(HERE, 'sandbox_probe.c'), '-lsandbox', '-o', probe]);
    selection.sandbox_probe = { binary: probe, profile, profile_sha256: sha(profile), source: 'canonical precompiled profile; sandbox_apply call only, no VM' };
  }
  const adapter = args.hyperlight_adapter || process.env.HYPERLIGHT_ADAPTER || join(HERE, 'hyperlight/adapter.json');
  if (existsSync(adapter) && !args.no_hyperlight) {
    const hl = readJSON<Frame>(adapter);
    hl.descriptor_sha256 = sha(adapter);
    for (const key of ['strict_argv', 'clone_argv']) {
      for (const i of [0, 2]) {
        if (!isAbsolute(hl[key][i])) {
          hl[key][i] = resolve(dirname(adapter), hl[key][i]);
        }
      }
    }
    hl.hashes = {};
    for (const f of hl.files || []) {
      if (existsSync(f) && statSync(f).isFile()) {
        hl.hashes[f] = sha(f);
      }
    }
    hl.source_argv = { strict_argv: [...hl.strict_argv], clone_argv: [...hl.clone_argv] };
    const binary = join(frozen, 'hyperlight-worker');
    copyFileSync(hl.strict_argv[0], binary);
    const snapshot = join(frozen, 'hyperlight-snapshot');
    cpSync(hl.strict_argv[2], snapshot, { recursive: true });
    hl.frozen_snapshot_hashes = {};
    for (const f of files(snapshot)) {
      hl.frozen_snapshot_hashes[relative(snapshot, f)] = sha(f);
    }
    for (const key of ['strict_argv', 'clone_argv']) {
      hl[key] = [binary, hl[key][1], snapshot];
    }
    selection.hyperlight = hl;
  }
  const base = args.executor_root ? resolve(args.executor_root) : join(ROOT, 'executor');
  const exe = join(frozen, 'executor');
  const integrated = existsSync(join(base, '.READY')) || Boolean(args.executor_root);
  let modules: string | null = null;
  if (integrated) {
    cpSync(base, exe, { recursive: true, filter: source => !['node_modules', '__pycache__'].includes(basename(source)) });
    let parent = base;
    while (true) {
      if (existsSync(join(parent, 'node_modules'))) {
        modules = join(parent, 'node_modules');
        symlinkSync(realpathSync(modules), join(exe, 'node_modules'), 'dir');
        break;
      }
      if (dirname(parent) === parent) {
        break;
      }
      parent = dirname(parent);
    }
  }
  const hashes: Record<string, string> = {};
  for (const f of files(exe)) {
    if (['.js', '.mjs', '.py'].includes(extname(f))) {
      hashes[relative(exe, f)] = sha(f);
    }
  }
  selection.executor = { source: base, integrated, build: join(exe, 'build'), node_modules: modules, runtime_sha256: hashes };
  selection.node = args.node || process.env.NODE || null;
  if (selection.node) {
    check(isAbsolute(selection.node), '--node/NODE must be an absolute Node executable path');
    selection.node_runtime = command([selection.node, '-p', 'JSON.stringify({execPath:process.execPath,version:process.version})']);
  }
  selection.harness_sha256 = {};
  for (const f of ['run.ts', 'controller.ts', 'lib.ts', 'native.ts', 'native.c', 'ffi.json', 'cases.json', 'executor.mjs', 'watchdog.ts', 'sandbox_probe.c', 'processes.ts']) {
    selection.harness_sha256[f] = sha(join(HERE, f));
  }
  return selection;
}
export interface Spec {
  name: string;
  mode: string;
  case: string;
  concurrency?: number;
}
export function makeSpecs(s: Frame): Spec[] {
  const specs: Spec[] = [];
  const add = (mode: string, caseName: string, concurrency?: number): void => {
    const spec: Spec = { name: mode + '/' + caseName, mode, case: caseName };
    if (concurrency !== undefined) {
      spec.concurrency = concurrency;
    }
    specs.push(spec);
  };
  for (const mode of ['jitk-cold', 'jitk-parked-raw']) {
    for (const caseName of Object.keys(CASES)) {
      add(mode, caseName);
    }
  }
  for (const c of [4, 8]) {
    add('jitk-refill', String(c), c);
  }
  add('jitk-parked-memory', 'one_tool');
  if (s.sandbox_probe) {
    for (const name of ['on', 'off']) {
      add('sandbox-apply', name);
    }
  }
  if (s.hyperlight) {
    for (const mode of ['hl-strict', 'hl-strict-parked', 'hl-clone']) {
      for (const name of Object.keys(CASES)) {
        add(mode, name);
      }
    }
    add('hl-parked-memory', 'one_tool');
  }
  if (s.node && existsSync(join(s.executor.build, 'executor.js'))) {
    for (const mode of ['executor-cold', 'executor-parked']) {
      for (const name of Object.keys(CASES)) {
        add(mode, name);
      }
    }
  }
  return specs;
}
function refill(s: Frame, concurrency: number): Frame {
  // Start c independent builders, replace each as it reaches READY and is reaped.
  const n = concurrency * 4;
  const before = clockNS();
  const cpu0 = childrenCPU();
  const ready: number[] = [];
  const workers: { worker: Worker; index: number }[] = [];
  let launched = 0;
  try {
    while (ready.filter(v => v !== undefined).length < n) {
      while (workers.length < concurrency && launched < n) {
        workers.push({ worker: new Worker(s.argv), index: launched });
        launched += 1;
      }
      for (let i = workers.length - 1; i >= 0; i -= 1) {
        const slot = workers[i];
        const w = slot.worker;
        w.pump(0);
        if (w.frames.length && (!s.require_sandbox_ack || w.err.includes(Buffer.from('{"sandbox":"ok"}\n')))) {
          w.ready(Boolean(s.require_sandbox_ack));
          ready[slot.index] = Number(clockNS() - w.startNS) / 1e6;
          w.close();
          workers.splice(i, 1);
        } else {
          check(w.hasFDs && now() - w.start < 10, 'refill READY timeout');
        }
      }
      if (workers.length) {
        const fds: number[] = [];
        for (const slot of workers) {
          fds.push(slot.worker.p.stdout, slot.worker.p.stderr);
        }
        pollMany(fds, 0.1);
      }
    }
  } finally {
    for (const slot of workers) {
      slot.worker.close();
    }
  }
  const elapsed = Number(clockNS() - before) / 1e9;
  return { refill_vms_s: n / elapsed, cpu_ms_vm: (childrenCPU() - cpu0) * 1000 / n, vms: n, wall_s: elapsed, ready_ms: ready };
}
export function sample(spec: Spec, s: Frame, clone: Worker | null): Frame {
  const mode = spec.mode;
  const caseName = spec.case;
  if (mode === 'sandbox-apply') {
    const cfg = s.sandbox_probe;
    const worker = new Worker([cfg.binary, cfg.profile, caseName]);
    try {
      return worker.recv();
    } finally {
      worker.close();
    }
  }
  if (mode === 'jitk-refill') {
    return refill(s, Number(spec.concurrency));
  }
  if (mode.startsWith('executor-')) {
    const worker = new Worker([s.node, join(HERE, 'executor.mjs'), s.executor.build, mode, caseName, JSON.stringify(s)], {}, 40);
    try {
      const prepared = worker.recv();
      check(equal(prepared, { t: 'prepared' }), JSON.stringify({ phase: 'executor preparation', response: prepared }));
      worker.send({ t: 'go' });
      const result = worker.recv(30);
      check(!result.error && result.t === 'measurement', JSON.stringify(result));
      return result;
    } finally {
      worker.close();
    }
  }
  if (mode === 'hl-clone') {
    check(clone, 'missing clone worker');
    return clone.run(caseName);
  }
  const cold = ['jitk-cold', 'hl-strict', 'jitk-sandbox-on', 'jitk-sandbox-off'].includes(mode);
  const hyperlight = ['hl-strict', 'hl-strict-parked', 'hl-parked-memory'].includes(mode);
  const worker = new Worker(hyperlight ? s.hyperlight.strict_argv : s.argv, hyperlight ? s.hyperlight.env || {} : {});
  let result: Frame = {};
  try {
    worker.ready(mode.startsWith('jitk-') && Boolean(s.require_sandbox_ack));
    if (!cold) {
      sleep(0.005);
    }
    if (['jitk-parked-memory', 'hl-parked-memory'].includes(mode)) {
      const readings: Record<string, number>[] = [];
      for (let i = 0; i < 5; i += 1) {
        const reading = usage(worker.pid);
        check(reading, 'libproc memory unavailable');
        readings.push(reading);
        sleep(0.002);
      }
      result = { rss_mib: median(readings.map(x => x.rss / 1048576)), footprint_mib: median(readings.map(x => x.footprint / 1048576)), memory_readings: readings };
      Object.assign(result, worker.run(caseName));
    } else {
      result = worker.run(caseName, cold);
    }
  } finally {
    worker.close();
  }
  result.cpu_ms_vm = worker.cpu_ms;
  result.through_reap_ms = Number(clockNS() - worker.startNS) / 1e6;
  return result;
}
