import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, detail, dump, equal, readJSON } from './lib.ts';
import { ROOT, ASSETS, build, checkHost, cleanup, copyKernel, hostCommand, load, processGuest, run, scratch, selectHost, sha, treeHashes } from './runtime.ts';
import { parseArgs, type Manifest } from './loop.ts';
import { oracle } from './oracle.ts';
import { observe, outcome } from './observations.ts';
import { SQLITE_SHA, DB_SHA } from './sqlite-profile.ts';

async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const elf = args.sqliteElf;
  const database = args.database;
  check(args.validateOnly && elf && database, 'sqlite-checks requires --validate-only --sqlite-elf --database');
  check(sha(elf) === SQLITE_SHA && sha(database) === DB_SHA, 'pinned census inputs required');
  const out = join(ROOT, 'results', args.runId);
  mkdirSync(out);
  selectHost();
  const resources = join(out, 'resources');
  mkdirSync(join(resources, 'dev'), { recursive: true });
  writeFileSync(join(resources, 'demo.db'), readFileSync(database));
  writeFileSync(join(resources, 'dev/null'), Buffer.alloc(0));
  const command = ['sqlite3', '-batch', '-init', '/dev/null', 'file:/demo.db?mode=ro&immutable=1', "SELECT json_object('count',count(*),'sum',sum(v),'max',max(v)) FROM n;"];
  const report: Record<string, unknown> = { uptime: load(), binary_sha256: sha(elf), database_sha256: sha(database) };
  const temporary = scratch();
  try {
    const work = join(temporary, 'kernel');
    const copied = copyKernel(work);
    const manifest = readJSON<Manifest>(join(work, 'syscalls.manifest.json'));
    manifest.contracts = manifest.contracts.filter((contract) => !['fstat', 'pread64'].includes(contract.name));
    dump(join(work, 'syscalls.manifest.json'), manifest);
    for (const name of ['fstat', 'pread64']) {
      unlinkSync(join(work, 'src/syscalls', name + '.rs'));
    }
    for (const label of ['without-both', 'without-pread64']) {
      const missing = label === 'without-both' ? 80 : 67;
      if (missing === 67) {
        writeFileSync(join(work, 'src/syscalls/fstat.rs'), readFileSync(join(copied.source, 'src/syscalls/fstat.rs')));
      }
      const image = await build(work, join(out, label), elf, command, resources);
      const result = await processGuest(hostCommand(image), join(out, label + '-run'), Buffer.alloc(0));
      checkHost(result.info, result.err);
      const value = observe(result.raw);
      dump(join(out, label + '.observations.json'), value);
      check(value.trace_complete && value.exit === 1 && value.stdout_hex === '', 'before-state output');
      check(value.missing.some((record) => record.nr === missing), 'before-state missing syscall');
      report[label] = { ...outcome(value), missing: [...new Set(value.missing.map((record) => record.nr))].sort((a, b) => a - b) };
    }
    const normal = (await oracle(elf, command, join(out, 'linux-normal'), null, { resources, data: Buffer.alloc(0) }))[0];
    for (const name of ['fstat', 'pread64']) {
      const value = (await oracle(elf, command, join(out, 'linux-' + name), null, { injections: [name + ':error=ENOSYS'], resources, data: Buffer.alloc(0) }))[0];
      check(value.exit === 1 && value.stdout_hex === '', 'injected failure output');
      report['injected-' + name] = outcome(value);
    }
    const combined = (await oracle(elf, command, join(out, 'linux-combined'), null, { injections: ['faccessat', 'getpid', 'rt_sigaction', 'rt_sigprocmask'].map((name) => name + ':error=ENOSYS'), resources, data: Buffer.alloc(0) }))[0];
    check(equal(outcome(combined), outcome(normal)), 'combined ENOSYS changed output');
    report['combined-enosys'] = { status: 'PASS', ...outcome(combined) };
    const bad = join(out, 'dynamic.elf');
    const data = readFileSync(elf);
    data.writeUInt16LE(3, 16);
    writeFileSync(bad, data);
    let rejected = false;
    try {
      await build(work, join(out, 'loader-rejection'), bad, command, resources);
    } catch {
      const failure = readJSON<{ class: string; detail: string }>(join(out, 'loader-rejection/failure.json'));
      check(failure.detail.includes('static ET_EXEC'), 'unexpected loader failure');
      report['loader-rejection'] = failure.class;
      rejected = true;
    }
    check(rejected, 'loader accepted ET_DYN');
    const source = join(out, 'fatal.S');
    writeFileSync(source, '.global _start\n.text\n_start:\n mov x0,1\n adr x1,byte\n mov x2,1\n mov x8,64\n svc 0\n mov x0,0\n mov x8,94\n svc 0\n.section .rodata\nbyte: .byte 9\n');
    const obj = join(out, 'fatal.o');
    const fatalElf = join(out, 'fatal.elf');
    await run(['clang', '--target=aarch64-none-elf', '-c', source, '-o', obj]);
    await run(['/opt/homebrew/bin/ld.lld', '-T', join(ASSETS, 'probe.ld'), obj, '-o', fatalElf]);
    const image = await build(work, join(out, 'fatal-output'), fatalElf, ['fatal']);
    const result = await processGuest(hostCommand(image), join(out, 'fatal-run'), Buffer.alloc(0));
    checkHost(result.info, result.err);
    const value = observe(result.raw);
    dump(join(out, 'fatal.observations.json'), value);
    check(value.fatal_protocol.length > 0 && !value.trace_complete, 'fatal output accepted');
    report['fatal-output'] = 'recorded and rejected';
    check(equal(treeHashes(copied.source), copied.hashes), 'canonical changed');
  } finally {
    cleanup(temporary);
  }
  report.status = 'PASS';
  dump(join(out, 'report.json'), report);
}
main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(detail(error));
  process.exitCode = 1;
});
