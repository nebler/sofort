import { propagate, Interrupted } from '../lib.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, basename, extname } from 'node:path';
import { platform, release, arch } from 'node:os';
import { readJSON, dump, Random, check, equal, detail, now } from '../lib.ts';
import { sleep, write } from '../native.ts';
import { type Frame } from '../controller.ts';
import { HERE, DARWIN, TEMPLATES, TIMEBASE, host, system, proc, command, Worker, diagnostics } from './runtime.ts';

export function memory(args: Frame): void {
  const out = String(args.output);
  const art = resolve(args.artifacts);
  mkdirSync(dirname(out), { recursive: true });
  const collected: Frame[] = [];
  const data: Frame = { schema: 1, kind: 'memory', start: host(), machine: { platform: `${platform()}-${release()}-${arch()}`, sysctl: DARWIN ? command(['sysctl', 'hw.model', 'hw.memsize', 'hw.ncpu', 'kern.hv.max_address_spaces']) : command(['uname', '-a']), runtime: 'scriptc 0.4.5', git: command(['git', 'rev-parse', 'HEAD']), timebase_ns_per_tick: TIMEBASE, ledger_templates: TEMPLATES }, selection: readJSON<Frame>(join(art, 'selection.json')), config: args, cells: collected };
  const save = (): void => dump(out, data);
  const variants = String(args.variants).split(',');
  const counts = String(args.counts).split(',').map(Number);
  const rng = new Random(601);
  const stem = basename(out, extname(out));
  for (let repeat = 0; repeat < args.repeats; repeat += 1) {
    const cells: { variant: string; n: number }[] = [];
    for (const variant of variants) {
      for (const n of counts) {
        cells.push({ variant, n });
      }
    }
    if (repeat) {
      rng.shuffle(cells);
    }
    for (const { variant, n } of cells) {
      const cleanupRows: Frame[] = [];
      const cell: Frame = { repeat, variant, n, start: host(), controller_before: proc(process.pid), before: system(), phases: {}, cleanup: cleanupRows };
      const workers: Worker[] = [];
      collected.push(cell);
      save();
      try {
        const image = join(art, variant === 'current' ? 'image.bin' : 'image-' + variant + '.bin');
        const argv = [join(art, 'jitk-vmm'), '--image', image, '--mem-mib', '32'];
        if (DARWIN && !args.inline_sandbox) {
          argv.push('--sandbox-profile', join(art, 'jitk.sbbin'));
        }
        cell.argv = argv;
        cell.ready_count = 0;
        for (let i = 0; i < n; i += 1) {
          const worker = new Worker(argv);
          workers.push(worker);
          worker.ready();
          cell.ready_count += 1;
        }
        sleep(0.1);
        for (const phase of ['ready', 'one_tool_wait']) {
          if (phase === 'one_tool_wait') {
            for (const worker of workers) {
              worker.send({ t: 'run', code: 'return await test.echo(2);', ns: { test: ['echo'] } });
            }
            for (const worker of workers) {
              check(equal(worker.recv(), { t: 'call', id: 1, ns: 'test', fn: 'echo', args: [2] }));
            }
          }
          const d: Frame = { start: host(), processes: workers.map(w => proc(w.pid)), controller: proc(process.pid), system: system(), diagnostics: {} };
          cell.phases[phase] = d;
          save();
          const folder = join(HERE, 'raw', stem, 'regions', `r${repeat}-${variant}-n${n}-${phase}`);
          if (DARWIN && workers.length && repeat === 0) {
            mkdirSync(folder, { recursive: true });
            const js = join(folder, 'footprint-all.json');
            const commandArgs = ['footprint'];
            for (const w of workers) {
              commandArgs.push('-p', String(w.pid));
            }
            commandArgs.push('-f', 'bytes', '-w', '-j', js);
            const r = command(commandArgs, 180);
            writeFileSync(join(folder, 'footprint-all.txt'), (r.stdout || '') + (r.stderr || ''));
            d.batch_footprint = { status: r.status ?? null, elapsed_s: r.elapsed_s, path: folder.slice(HERE.length + 1) };
            save();
          }
          const selected = n ? (args.details === 'all' ? Array.from({ length: n }, (_, i) => i) : Array.from(new Set([0, Math.floor(n / 2), n - 1])).sort((a, b) => a - b)) : [];
          for (const i of selected) {
            d.diagnostics[String(workers[i].pid)] = diagnostics(workers[i].pid, join(folder, String(workers[i].pid)), i === 0);
          }
          d.after_diagnostics = workers.map(w => proc(w.pid));
          save();
        }
        for (const w of workers) {
          w.send({ t: 'ret', id: 1, ok: 2 });
        }
        for (const w of workers) {
          check(equal(w.recv(), { t: 'done', ok: 2 }));
        }
        cell.status = 'ok';
      } catch (error) {
    propagate(error);
        cell.status = 'error';
        cell.error = detail(error);
        cell.partial_processes = workers.map(w => proc(w.pid));
        cell.partial_system = system();
      } finally {
        for (const w of workers) {
          const entry: Frame = { pid: w.pid };
          try {
            Object.assign(entry, w.close());
          } catch (error) {
    propagate(error);
            entry.error = detail(error);
          }
          cleanupRows.push(entry);
        }
        sleep(0.15);
        cell.after = system();
        cell.controller_after = proc(process.pid);
        cell.end = host();
        save();
      }
      console.log(JSON.stringify({ repeat, variant, n, status: cell.status, error: cell.error ?? null }));
    }
  }
  data.end = host();
  save();
}
export function controls(args: Frame): void {
  const art = resolve(args.artifacts);
  const out = String(args.output);
  const repeats: Frame[] = [];
  const data: Frame = { schema: 1, kind: 'prebuild-control', start: host(), repeats };
  const stem = basename(out, extname(out));
  for (let repeat = 0; repeat < args.repeats; repeat += 1) {
    const c: Frame = { repeat, before: system(), stages: {} };
    repeats.push(c);
    const workers: Worker[] = [];
    try {
      for (let i = 0; i < args.count; i += 1) {
        const w = new Worker([join(art, 'jitk-vmm'), '--image', join(art, 'image.bin'), '--mem-mib', '32', '--sandbox-profile', join(art, 'jitk.sbbin'), '--wait-go']);
        workers.push(w);
        const end = now() + 15;
        while (!w.worker.err.includes(Buffer.from('WAIT_GO'))) {
          check(now() <= end, w.worker.err.toString());
          w.worker.pump(0.01);
        }
      }
      for (const stage of ['prebuild', 'ready', 'one_tool_wait']) {
        if (stage === 'ready') {
          for (const w of workers) {
            write(w.worker.p.stdin, Buffer.from('x'));
          }
          for (const w of workers) {
            w.ready();
          }
        }
        if (stage === 'one_tool_wait') {
          for (const w of workers) {
            w.send({ t: 'run', code: 'return await test.echo(2);', ns: { test: ['echo'] } });
          }
          for (const w of workers) {
            check(w.recv().t === 'call');
          }
        }
        c.stages[stage] = { processes: workers.map(w => proc(w.pid)), system: system(), diagnostics: diagnostics(workers[0].pid, join(HERE, 'raw', stem, `r${repeat}-${stage}`), true) };
        dump(out, data);
      }
      c.status = 'ok';
    } catch (error) {
    propagate(error);
      c.status = 'error';
      c.error = detail(error);
    } finally {
      c.cleanup = workers.map(w => Object.assign({ pid: w.pid }, w.close()));
      c.after = system();
      dump(out, data);
    }
    console.log('control', repeat, c.status);
  }
  data.end = host();
  dump(out, data);
}
