import { mkdirSync, readFileSync, writeFileSync, chmodSync, symlinkSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { run, capture, check, dump, readJSON, sha, environment } from './lib.ts';

interface Status { exit: number | null; timeout?: boolean; error?: string | null }
const root = resolve(import.meta.dirname);
const work = join(root, '.work');
const source = join(work, 'source');
const job = join(work, 'allocator-fallback');
const image = 'sha256:88f8f82bb1850e61c04fd9e47813cd054f5e18eaf6143c4cebeb3d3667818d0a';
const nodeImage = 'sha256:14078204b6bb268c107ceff6d3c43f45a888105e5c2b18b14c32b3409d93a1b0';
async function main(): Promise<void> {
  check(existsSync(join(source, 'package.json')), 'run census first to prepare the pinned source snapshot');
  rmSync(job, { recursive: true, force: true });
  mkdirSync(join(job, 'cwd'), { recursive: true });
  chmodSync(job, 0o777);
  chmodSync(join(job, 'cwd'), 0o777);
  const elf = join(job, 'program');
  const buildEnv = environment();
  buildEnv.PATH = dirname(process.env.ZIG || '/Users/noah/.local/share/zig-0.16.0/zig') + ':' + buildEnv.PATH;
  buildEnv.SCRIPTC_TARGET = 'aarch64-linux-musl';
  buildEnv.SCRIPTC_RUNTIME_PACK = join(root, 'node_modules/@scriptc/runtime-linux-arm64-musl');
  await run([join(root, 'node_modules/.bin/scriptc'), 'build', join(root, 'allocator-probe.ts'), '-o', elf], { env: buildEnv, timeout: 45 });
  // Both containers are sequential and named for unconditional timeout cleanup.
  const name = 'jitk-corpus-fallback-' + process.pid;
  const common = ['--rm', '--init', '-i', '--name', name, '--platform', 'linux/arm64', '--network', 'none',
    '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '64',
    '--memory', '512m', '--user', '65534:65534', '--tmpfs', '/tmp:rw,nosuid,size=32m',
    '-v', work + ':' + work + ':rw', '-v', source + ':' + source + ':ro'];
  try {
    await run(['docker', 'run', ...common, '-v', root + ':' + root + ':ro',
      '-v', (process.env.SCRIPTC_REPO || '/Users/noah/scriptc') + ':' + (process.env.SCRIPTC_REPO || '/Users/noah/scriptc') + ':ro',
      '--entrypoint', 'node', nodeImage, join(root, 'node-reference.ts'), source, join(root, 'allocator-probe.ts'), job], { timeout: 25 });
    const expected = readJSON<Status>(join(job, 'node.json'));
    const out = join(job, 'linux');
    mkdirSync(out, { recursive: true });
    chmodSync(out, 0o777);
    const slots = readJSON<Record<string, string>>(resolve(root, '../kernel/slots.json'));
    dump(join(out, 'config.json'), { elf, cwd: join(job, 'cwd'), source, supported: [...Object.values(slots), 'exit_group'], timeout: 12,
      expectedExit: expected.exit, referenceValid: expected.exit === 0 && !expected.error,
      expectedOut: sha(readFileSync(join(job, 'node.stdout'))), expectedErr: sha(readFileSync(join(job, 'node.stderr'))) });
    await run(['docker', 'run', ...common, '-v', join(work, 'bin/oracle') + ':/driver:ro',
      '--entrypoint', '/driver', image, out], { timeout: 180 });
    const normal = readJSON<Status>(join(out, 'status.json'));
    const trace = readFileSync(join(out, 'trace'), 'utf8');
    const hasClone = /\bclone\(/.test(trace);
    const cloneDir = join(out, 'clone');
    let injected = false, survives = false;
    if (existsSync(join(cloneDir, 'status.json'))) {
      const failure = readJSON<Status>(join(cloneDir, 'status.json'));
      injected = readFileSync(join(cloneDir, 'trace'), 'utf8').includes('(INJECTED)');
      survives = injected && !normal.timeout && !failure.timeout && normal.exit === failure.exit &&
        readFileSync(join(out, 'stdout')).equals(readFileSync(join(cloneDir, 'stdout'))) &&
        readFileSync(join(out, 'stderr')).equals(readFileSync(join(cloneDir, 'stderr')));
    }
    const summary = { diagnostic: 'allocator-prefault', corpusProgram: false, compiler: '0.4.5', target: 'aarch64-linux-musl',
      source: sha(readFileSync(join(root, 'allocator-probe.ts'))), elf: sha(readFileSync(elf)),
      trace: sha(Buffer.from(trace)), cloneObserved: hasClone, cloneENOSYSInjected: injected, survives,
      nodeMatch: expected.exit === normal.exit && readFileSync(join(job, 'node.stdout')).equals(readFileSync(join(out, 'stdout'))) &&
        readFileSync(join(job, 'node.stderr')).equals(readFileSync(join(out, 'stderr'))),
      stdoutHash: sha(readFileSync(join(out, 'stdout'))), stderrHash: sha(readFileSync(join(out, 'stderr'))), exit: normal.exit };
    dump(join(root, 'fallback-summary.json'), summary);
    console.log(JSON.stringify(summary));
    check(summary.nodeMatch && hasClone && injected && survives, 'allocator helper fallback was not established');
  } finally {
    await capture(['docker', 'rm', '-f', name], { timeout: 5 });
    rmSync(job, { recursive: true, force: true });
  }
}
main().catch((e: unknown) => { console.error(String(e)); process.exitCode = 1; });
