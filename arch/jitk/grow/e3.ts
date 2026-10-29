import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check, csvEncode, detail, diskSpace, dump, equal, load, readJSON, sha, treeHashes } from './lib.ts';
import { ROOT, CANONICAL, build, slotNumber, checkHost, cleanup, copyKernel, hostCommand, processGuest, scratch, selectHost } from './runtime.ts';
import { emit, generate } from './autoprofile.ts';
import { mutations } from './profiles.ts';
import { oracle } from './oracle.ts';
import { probe, QJS_ARGV } from './loop.ts';
import { observe, requireResult, type Outcome } from './observations.ts';
import { FIELDS, markers, controllerHashes, textCommand } from './experiment-run.ts';

interface Grade { target: string; mutant: string; visible: string; heldout: string; rejected: boolean; source_sha256: string }

export async function runE3(argv: string[]): Promise<void> {
  check(argv.includes('--validate-only'), '--validate-only required');
  function arg(flag: string): string { const i = argv.indexOf(flag); check(i >= 0 && argv[i + 1], 'missing ' + flag); return argv[i + 1]; }
  const id = arg('--run-id'); check(/^[\w-]+$/.test(id), 'run id');
  const out = join(ROOT, 'results', id); check(!existsSync(out), 'batch exists'); mkdirSync(out, { recursive: true });
  const before = markers(), kernelBefore = treeHashes(CANONICAL);
  selectHost();
  const pins = { date: new Date().toISOString(), disk_before: await diskSpace(), uptime_before: load(), oracle_image: await textCommand(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{.Id}}']), source: controllerHashes(), kernel: kernelBefore, vmm_sha256: sha(process.env.JITK_SHARD_BINARY!), protected_before: before, cli_calls: 0, seed_policy: 'census sqlite3 + qsv + fresh unchanged QuickJS and SQLite oracle traces; all generated profiles frozen before mutant execution', layout_policy: 'pollfd and timespec ABI layouts only; opaque structs use generic touched/repeat relations, not manually selected stat fields' };
  dump(join(out, 'pins.json'), pins);
  const traces: string[] = [resolve(ROOT, '../../research/native-census/raw/sqlite3/full.strace'), resolve(ROOT, '../../research/native-census/raw/qsv/full.strace')];
  const fresh = join(out, 'fresh'); mkdirSync(fresh);
  await diskSpace();
  await oracle(join(CANONICAL, 'payload/qjs'), QJS_ARGV, join(fresh, 'qjs'), Buffer.from('reply:ping\n'), { annotate: true });
  traces.push(join(fresh, 'qjs/linux-00.strace'));
  const resourceRoot = join(fresh, 'resources'); mkdirSync(join(resourceRoot, 'dev'), { recursive: true });
  copyFileSync(arg('--database'), join(resourceRoot, 'demo.db')); writeFileSync(join(resourceRoot, 'dev/null'), '');
  await oracle(arg('--sqlite-elf'), ['sqlite3', '-batch', '-init', '/dev/null', 'file:/demo.db?mode=ro&immutable=1', 'select sum(v) from n;'], join(fresh, 'sqlite'), Buffer.from('23\n'), { resources: resourceRoot, data: Buffer.alloc(0), annotate: true });
  traces.push(join(fresh, 'sqlite/linux-00.strace'));
  // Freeze every generated test and Linux expectation before opening mutants.
  const fixtures: Record<string, { elf: string; reference: Outcome; resources: string }[]> = {};
  const frozen: Record<string, unknown> = {};
  for (const target of ['ppoll', 'fstat', 'pread64']) {
    await diskSpace();
    const dest = join(out, target); mkdirSync(dest);
    const nr = Number(slotNumber(target));
    const profile = generate(target, nr, traces); emit(profile, dest);
    fixtures[target] = [];
    for (const split of ['visible', 'heldout']) {
      const d = join(dest, split); mkdirSync(d);
      const resource = join(d, 'resources'); mkdirSync(resource); copyFileSync(arg('--database'), join(resource, 'data.bin'));
      const elf = await probe(target, d, join(dest, split + '.c'));
      const reference = (await oracle(elf, [target], join(d, 'oracle'), null, { resources: resource }))[0];
      check(reference.exit === 0, 'generated Linux probe must complete normally');
      fixtures[target].push({ elf, reference, resources: resource });
    }
    frozen[target] = { profile_sha256: sha(join(dest, 'profile.json')), visible_sha256: sha(join(dest, 'visible.c')), heldout_sha256: sha(join(dest, 'heldout.c')), expected_visible_sha256: sha(join(dest, 'visible/oracle/linux-summary.json')), expected_heldout_sha256: sha(join(dest, 'heldout/oracle/linux-summary.json')), semantic: profile.visible.concat(profile.heldout).filter((c) => c.category === 'semantic').length, error: profile.visible.concat(profile.heldout).filter((c) => c.category === 'error').length, state: profile.visible.concat(profile.heldout).filter((c) => c.category === 'state').length, seeds: profile.calls.length };
  }
  dump(join(out, 'frozen.json'), frozen);
  const grades: Grade[] = [], rows: Record<string, unknown>[] = [];
  for (const target of ['ppoll', 'fstat', 'pread64']) {
    await diskSpace();
    const tmp = scratch('jitk-auto-grade-');
    try {
      const work = join(tmp, 'kernel'); copyKernel(work);
      const manifest = readJSON<{ contracts: { name: string }[] }>(join(work, 'syscalls.manifest.json'));
      manifest.contracts = manifest.contracts.filter((c) => c.name !== target); dump(join(work, 'syscalls.manifest.json'), manifest);
      const handler = join(work, 'src/syscalls', target + '.rs'), good = readFileSync(handler, 'utf8');
      const variants: Record<string, string> = { canonical: good };
      const broken = mutations(target, good); for (const label of Object.keys(broken)) variants[label] = broken[label];
      for (const label of Object.keys(variants)) {
        const started = performance.now();
        writeFileSync(handler, variants[label]);
        const dest = join(out, target, 'grade-' + label); mkdirSync(dest);
        const decisions: string[] = [];
        for (let i = 0; i < fixtures[target].length; i += 1) {
          const split = i === 0 ? 'visible' : 'heldout', f = fixtures[target][i];
          const image = await build(work, join(dest, split), f.elf, [target], f.resources);
          const result = await processGuest(hostCommand(image), join(dest, split + '-vm'));
          checkHost(result.info, result.err);
          const observed = observe(result.raw); dump(join(dest, split + '.observations.json'), observed);
          check(!result.info.timeout && observed.trace_complete, 'crash/timeout cannot count as a mutant rejection');
          try { requireResult(observed, f.reference); decisions.push('PASS'); }
          catch (error) { decisions.push('REJECT'); writeFileSync(join(dest, split + '-difference.txt'), detail(error)); }
        }
        const grade = { target, mutant: label, visible: decisions[0], heldout: decisions[1], rejected: decisions.includes('REJECT'), source_sha256: sha(handler) };
        grades.push(grade); dump(join(out, 'grades.json'), grades);
        rows.push({ run_id: id + '-' + target + '-' + label, date: pins.date, host: 'macOS/HVF', model: 'none-mutant-grade', cli: 'none', spec_level: 'none', target, attempt: 0, accepted: label === 'canonical' ? Number(!grade.rejected) : 0, rejecting_gate: grade.rejected ? 'generated_profile_differential' : 'survived_generated_profile', visible_pass: Number(decisions[0] === 'PASS'), heldout_pass: Number(decisions[1] === 'PASS'), mutants_rejected: label === 'canonical' ? '' : Number(grade.rejected), integration_pass: 'not_applicable_mutant_grade', wall_s: (performance.now() - started) / 1000, cli_calls: 0, human_minutes: 0, handler_lines: variants[label].trimEnd().split('\n').length, human_lines: 0 });
        writeFileSync(join(out, 'E3.csv'), csvEncode(rows, FIELDS));
        console.log(target, label, decisions.join('/'));
        if (label === 'canonical') check(!grade.rejected, 'generated profile rejects the canonical control; invalid grade');
      }
    } finally { cleanup(tmp); }
  }
  const mutants = grades.filter((g) => g.mutant !== 'canonical'), misses = mutants.filter((g) => !g.rejected);
  dump(join(out, 'summary.json'), { generated_profiles_valid: true, mutants: mutants.length, rejected: mutants.length - misses.length, misses, status: misses.length ? 'KILL: generated profiles miss known mutants; growth matrix not run' : 'MUTANT_PREREQUISITE_PASS', disk_after: await diskSpace(), protected_after: markers(), uptime_after: load() });
  check(equal(markers(), before) && equal(treeHashes(CANONICAL), kernelBefore), 'canonical or release markers changed');
}

runE3(process.argv.slice(2)).catch((error: unknown) => { console.error(detail(error)); process.exitCode = 1; });
