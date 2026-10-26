import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { check, detail, dump, equal, parseJSON, readJSON, signed, stringify } from './io.ts';
import { ASSETS, CANONICAL, SAFE_ENV, build, capture, cleanup, copyKernel, killChild, run, scratch, treeHashes } from './runtime.ts';
import { compare, guest, linux, type Differential } from './adapters.ts';
import { discover, installationPatch, parseArgs, validateSource } from './loop.ts';
import { proposal, validateProposal } from './agent.ts';
import { observe, records, requireResult, type TraceRecord } from './observations.ts';
import { PROFILES, mutations } from './profiles.ts';
import { normalize } from './normalize.ts';

const FIXTURES = join(ASSETS, 'tests/fixtures');
interface Test {
  name: string;
  body: () => Promise<void>;
}
const tests: Test[] = [];
function test(name: string, body: () => Promise<void>): void {
  tests.push({ name, body });
}
async function temporary(body: (path: string) => Promise<void>): Promise<void> {
  const path = scratch('jitk-grow-test-');
  try {
    await body(path);
  } finally {
    cleanup(path);
  }
}
function fixture(name: string, file = 'guest.stdout'): Buffer {
  return readFileSync(join(FIXTURES, name, file));
}
function reference(name: string): Differential {
  return readJSON<Differential>(join(FIXTURES, name, 'linux.json'));
}

test('discovery retains fatal output-protocol records', async () => {
  await temporary(async (path) => {
    const dest = join(path, 'fatal');
    await assert.rejects(() => discover('/image', dest, ['/bin/sh', '-c', 'read x; printf "\\036fatal control byte\\n"; printf \'{"sandbox":"ok"}\\n\' >&2']), /no missing record/);
    const observed = readJSON<{ fatal_protocol: unknown[] }>(dest + '.observations.json');
    assert.ok(observed.fatal_protocol.length > 0);
  });
});

test('application prefixes are retained', async () => {
  const raw = Buffer.from('exit=application-output\nhello jitk fdt=application-output\n');
  assert.equal(observe(raw).stdout_hex, raw.toString('hex'));
});

test('registered ENOSYS and argument errors retain raw arguments', async () => {
  const value = observe(fixture('rt_sigaction'));
  assert.ok(value.trace_complete);
  assert.equal(value.missing.length, 0);
  assert.equal(value.registered_enosys[0].nr, 134);
  assert.ok(value.registered_enosys[0].ret === -38);
  assert.equal(value.registered_enosys[0].args.length, 6);
  assert.ok(value.registered_enosys[0].pc === 4194504);
  assert.ok(equal(value.argument_errors, value.registered_enosys));
});

test('fatal and truncated output fail closed', async () => {
  for (const raw of [Buffer.from('\x1efatal control byte\n'), Buffer.from('\x1e{"v":2,"kind":"fatal"}\n'), fixture('ppoll').subarray(0, -20)]) {
    const value = observe(raw);
    assert.ok(!value.trace_complete);
    assert.throws(() => requireResult(value, { stdout_hex: '', stderr_hex: '', exit: 0 }));
  }
});

test('fd2 bytes and guest exit are independently compared', async () => {
  const value = observe(Buffer.concat([Buffer.from('\x1e{"v":2,"kind":"log","hex":"00ff0a"}\n'), fixture('rt_sigaction')]));
  assert.equal(value.stderr_hex, '00ff0a');
  assert.throws(() => requireResult(value, { ...value, exit: 1 }));
  assert.throws(() => requireResult(value, { ...value, stderr_hex: '' }));
});

test('every profile has semantic/error/state cases and distinct mutants', async () => {
  for (const name of Object.keys(PROFILES)) {
    const profile = PROFILES[name];
    assert.ok(profile.cases.semantic.length && profile.cases.error.length && profile.cases.state.length);
    const variants = Object.values(mutations(name, readFileSync(join(CANONICAL, `src/syscalls/${name}.rs`), 'utf8')));
    assert.ok(variants.length >= 2);
    assert.equal(variants.length, new Set(variants).size);
  }
});

test('loader/build errors write failure receipt', async () => {
  await temporary(async (path) => {
    const work = join(path, 'kernel');
    mkdirSync(work);
    writeFileSync(join(work, 'build.sh'), 'echo "ELF rejected: PT_INTERP" >&2\nexit 1\n');
    const out = join(path, 'out');
    await assert.rejects(() => build(work, out, '/payload', ['probe']), /PT_INTERP/);
    assert.equal(readJSON<{ class: string }>(join(out, 'failure.json')).class, 'loader-or-build-failure');
    assert.match(readFileSync(join(out, 'build.log'), 'utf8'), /PT_INTERP/);
  });
});

test('all three complete Linux/guest differentials', async () => {
  for (const name of ['ppoll', 'rt_sigaction', 'rt_sigprocmask']) {
    const expected = reference(name);
    compare(expected, guest(fixture(name)));
    compare(expected, linux(fixture(name, 'linux.strace').toString(), Buffer.from(expected.stdout_hex, 'hex'), Buffer.alloc(0), 0));
  }
});

test('missing syscall rejected by complete adapter', async () => {
  const raw = Buffer.from(fixture('ppoll').toString().replace('"kind":"sys.enter"', '"kind":"missing"'));
  assert.throws(() => guest(raw), /unregistered syscall/);
});

test('truncation rejected by complete adapter', async () => {
  const raw = fixture('ppoll');
  assert.throws(() => guest(raw.subarray(0, raw.indexOf('"kind":"done"') - 20)));
});

test('buffer differences rejected', async () => {
  const a = reference('ppoll');
  const b = parseJSON(stringify(a)) as Differential;
  b.events[0].output![0][2] = 0;
  assert.throws(() => compare(a, b));
});

test('unknown syscall rejected', async () => {
  const raw = Buffer.from(fixture('ppoll').toString().replace('"nr":73', '"nr":999'));
  assert.throws(() => guest(raw));
});

test('ENOSYS profile remains explicit', async () => {
  for (const name of ['rt_sigaction', 'rt_sigprocmask']) {
    const a = reference(name);
    const b = parseJSON(stringify(a)) as Differential;
    assert.ok(a.events[0].ret === -38);
    b.events[0].ret = 0;
    assert.throws(() => compare(a, b));
  }
});

test('canonical source and aliases cannot be built', async () => {
  await temporary(async (path) => {
    await assert.rejects(() => build(CANONICAL, join(path, 'out'), '/payload', ['lua']));
    symlinkSync(CANONICAL, join(path, 'alias'));
    await assert.rejects(() => build(join(path, 'alias'), join(path, 'out'), '/payload', ['lua']));
  });
});

test('candidate escape tokens rejected', async () => {
  for (const escape of ['unsafe {}', 'include!("x");', 'extern "C" {}', 'asm!("hvc 0");']) {
    assert.throws(() => validateSource('rt_sigaction', 'pub fn call(_: &[usize])->isize { ' + escape + ' -38 }'));
  }
});

test('denied group signal falls back to child kill and reaps', async () => {
  await new Promise<void>((resolveTest, reject) => {
    const child = spawn('/bin/sleep', ['30'], { detached: true, env: SAFE_ENV });
    child.on('error', reject);
    child.on('close', (code: number | null, signal: string | null) => {
      try {
        assert.ok(code === null && signal === 'SIGKILL');
        resolveTest();
      } catch (error) {
        reject(error);
      }
    });
    killChild(child, () => { throw new Error('forced group denial'); });
  });
});

test('installation patch applies; already applied is a no-op', async () => {
  await temporary(async (path) => {
    const base = join(path, 'base');
    const updated = join(path, 'updated');
    mkdirSync(base);
    mkdirSync(updated);
    writeFileSync(join(base, 'handler.rs'), 'fixture original\n');
    await run(['git', 'init', '-q'], { cwd: base });
    writeFileSync(join(updated, 'handler.rs'), 'fixture changed\n');
    writeFileSync(join(updated, 'new.rs'), 'fixture added\n');
    const names = ['handler.rs', 'new.rs'];
    const patch = await installationPatch(base, updated, names);
    assert.ok(patch.length > 0);
    await run(['git', 'apply', '--check', '-'], { cwd: base, input: Buffer.from(patch) });
    await run(['git', 'apply', '-'], { cwd: base, input: Buffer.from(patch) });
    assert.equal(await installationPatch(base, updated, names), '');
  });
});

test('Lua output matches Linux', async () => {
  const value = records(readFileSync(join(FIXTURES, 'lua.stdout')));
  assert.ok(value.app.equals(readFileSync(join(FIXTURES, 'lua-linux.stdout'))));
  assert.ok(!value.records.some((r) => r.kind === 'missing'));
});

test('canonical copy/delete/replay preserves canonical hashes', async () => {
  await temporary(async (path) => {
    const work = join(path, 'kernel');
    const out = join(path, 'receipt');
    mkdirSync(out);
    const copied = copyKernel(work);
    const handler = join(work, 'src/syscalls/ppoll.rs');
    const expected = readFileSync(handler, 'utf8');
    unlinkSync(handler);
    writeFileSync(handler, validateProposal('ppoll', await proposal('ppoll', work, out, {})));
    assert.equal(readFileSync(handler, 'utf8'), expected);
    assert.ok(equal(treeHashes(copied.source), copied.hashes));
  });
});

test('exact one-file schema enforced', async () => {
  for (const value of [{ path: '../escape', source: 'x' }, { path: 'src/syscalls/ppoll.rs', source: 'x', extra: [] }, [{ path: 'src/syscalls/ppoll.rs', source: 'x' }]]) {
    assert.throws(() => validateProposal('ppoll', value));
  }
});

async function liveFixture(path: string, mode: string): Promise<void> {
  const work = join(path, 'work');
  mkdirSync(join(work, 'src'), { recursive: true });
  writeFileSync(join(work, 'src/syscalls.rs'), '// test helper API\n');
  const out = join(path, mode);
  mkdirSync(join(out, 'oracle'), { recursive: true });
  writeFileSync(join(out, 'oracle/linux-00.strace'), 'fixture\n');
  const auth = join(path, 'original-auth');
  mkdirSync(auth);
  writeFileSync(join(auth, 'auth.json'), '{"fixture":"private-test-value"}');
  const oldAuth = process.env.CODEX_HOME;
  const oldCli = process.env.JITK_GROW_CLI;
  process.env.CODEX_HOME = auth;
  process.env.JITK_GROW_CLI = resolve(String(process.argv[1]));
  try {
    if (mode === 'success') {
      validateProposal('rt_sigaction', await proposal('rt_sigaction', work, out, {}, true));
    } else {
      await assert.rejects(() => proposal('rt_sigaction', work, out, {}, true), mode === 'failure' ? /CLI failed/ : /mutated source/);
      if (mode === 'failure') {
        assert.ok(!existsSync(join(out, 'agent.json')));
      }
    }
    assert.ok(existsSync(join(auth, 'auth.json')));
    const privatePath = readFileSync(join(out, 'private-path.txt'), 'utf8');
    assert.ok(!existsSync(privatePath));
  } finally {
    if (oldAuth === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = oldAuth;
    }
    if (oldCli === undefined) {
      delete process.env.JITK_GROW_CLI;
    } else {
      process.env.JITK_GROW_CLI = oldCli;
    }
  }
}

test('live rails/private auth cleanup', async () => temporary((path) => liveFixture(path, 'success')));
test('live failure cleans auth with no replay', async () => temporary((path) => liveFixture(path, 'failure')));
test('live source mutation rejected', async () => temporary((path) => liveFixture(path, 'mutation')));

test('heap size is retained while base address is normalized', async () => {
  const a = '1 brk(NULL) = 0x10000\n1 brk(0x12000) = 0x12000';
  assert.notDeepEqual(normalize(a), normalize(a.replaceAll('0x12000', '0x13000')));
  assert.deepEqual(normalize(a), normalize(a.replaceAll('0x10000', '0x20000').replaceAll('0x12000', '0x22000')));
});

test('mapping offsets retained', async () => {
  const events = normalize('1 mmap(NULL, 8192, 3, 34, -1, 0) = 0x10000\n1 munmap(0x11000, 4096) = 0');
  assert.ok(events[1].args[0] === 'M0+4096');
});

test('normalizer fails closed on truncation, threads, signals, missing terminal event', async () => {
  for (const raw of ['1 read(3, "x"..., 200) = 100', '1 clone(0) = 2', '1 --- SIGSEGV ---', '1 read(3, <unfinished ...>']) {
    assert.throws(() => normalize(raw));
  }
  assert.throws(() => normalize('1 read(0, "", 1) = 0', true));
});

test('normalizer retains errno and binary bytes', async () => {
  const a = '1 writev(1, [{iov_base="\\x00\\xff", iov_len=2}], 1) = 2';
  assert.ok(normalize(a)[0].args[1].includes('\\xff'));
  const b = '1 ioctl(1, 0x5413, 0x10000) = -1 ENOTTY (Not a tty)';
  assert.notDeepEqual(normalize(b), normalize(b.replace('ENOTTY', 'ENOSYS')));
});

test('raw 64-bit register JSON round trips exactly', async () => {
  const raw = '{"args":[18446744073709551615,9223372036854775808,0],"quoted":"18446744073709551615"}';
  const value = parseJSON(raw) as { args: (number | string)[] };
  assert.equal(signed(value.args[0]), -1);
  assert.equal(stringify(parseJSON(raw), 0), raw);
});

test('trace observations preserve future raw record fields', async () => {
  const raw = Buffer.from(fixture('rt_sigaction').toString().replace('\"pc\":4194504', '\"future\":42,\"pc\":4194504'));
  assert.ok(observe(raw).events[0].future === 42);
});

test('bounded process capture drains both binary streams and reaps descendants', async () => {
  const result = await capture(['/bin/sh', '-c', 'printf "\\000\\377"; printf err >&2; sleep 30'], { timeout: 0.05 });
  assert.ok(result.timeout && result.returncode === -9);
  assert.equal(result.stdout.toString('hex'), '00ff');
  assert.equal(result.stderr.toString(), 'err');
});

test('CLI validates targets, samples and pinned integration arguments', async () => {
  const args = parseArgs(['--run-id', 'test', '--validate-only', '--fast']);
  assert.ok(args.validateOnly && args.samples === 30);
  for (const argv of [['--run-id', '../escape'], ['--run-id', 'x', '--target', 'unknown'], ['--run-id', 'x', '--samples', '0'], ['--run-id', 'x', '--target', 'fstat'], ['--run-id', 'x', '--target', 'ppoll', '--target', 'ppoll']]) {
    assert.throws(() => parseArgs(argv));
  }
});

function fakeCli(): void {
  const args = process.argv.slice(2);
  for (const flag of ['--ephemeral', '--ignore-user-config', '--skip-git-repo-check', '--output-schema']) {
    check(args.includes(flag), flag);
  }
  check(args[args.indexOf('--sandbox') + 1] === 'read-only', 'read-only');
  check(args[args.indexOf('-c') + 1] === 'approval_policy="never"', 'approval');
  check(process.env.OPENAI_API_KEY === undefined, 'credential leaked');
  const privatePath = process.env.CODEX_HOME!;
  check((statSync(privatePath).mode & 0o777) === 0o700, 'private directory mode');
  check((statSync(join(privatePath, 'auth.json')).mode & 0o777) === 0o600, 'private auth mode');
  check(!privatePath.startsWith(process.cwd()), 'auth entered repo');
  const output = args[args.indexOf('--output-last-message') + 1];
  const out = dirname(output);
  writeFileSync(join(out, 'private-path.txt'), privatePath);
  const schema = readJSON<{ additionalProperties: boolean; properties: { path: { enum: string[] } } }>(args[args.indexOf('--output-schema') + 1]);
  check(schema.additionalProperties === false && equal(schema.properties.path.enum, ['src/syscalls/rt_sigaction.rs']), 'schema');
  if (out.endsWith('/failure')) {
    console.error('CLI failed');
    process.exitCode = 17;
    return;
  }
  dump(output, { path: 'src/syscalls/rt_sigaction.rs', source: 'pub fn call(_: &[usize]) -> isize { -38 }' });
  if (out.endsWith('/mutation')) {
    writeFileSync(join(process.cwd(), 'src/syscalls.rs'), '// mutated\n');
  }
}

async function main(): Promise<void> {
  if (process.argv[2] === 'exec') {
    fakeCli();
    return;
  }
  let passed = 0;
  for (const entry of tests) {
    try {
      await entry.body();
      console.log('PASS', entry.name);
      passed += 1;
    } catch (error) {
      console.error('FAIL', entry.name, detail(error));
      process.exitCode = 1;
    }
  }
  console.log(`${passed}/${tests.length} passed`);
}

main().catch((error: unknown) => {
  console.error(detail(error));
  process.exitCode = 1;
});
