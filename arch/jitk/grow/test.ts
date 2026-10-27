import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { check, detail, dump, equal, parseJSON, readJSON, signed, stringify, csvDecode, csvEncode, sha, track } from './lib.ts';
import { ASSETS, CANONICAL, ROOT, SAFE_ENV, build, capture, cleanup, copyKernel, killChild, run, scratch, treeHashes } from './runtime.ts';
import { compare, guest, linux, type Differential } from './adapters.ts';
import { discover, installationPatch, parseArgs, validateSource } from './loop.ts';
import { hostHandlerTests } from './host-tests.ts';
import { feedback, retryTransaction } from './retries.ts';
import { proposal, specification, auditResponse, validateProposal } from './agent.ts';
import { observe, records, requireResult, type TraceRecord } from './observations.ts';
import { PROFILES, mutations } from './profiles.ts';
import { design, attemptRows, markers, type Metadata } from './experiment-run.ts';
import { category, renderSummary, phase, verifyReceipts, sealReceipts } from './experiment-audit.ts';
import { canonical, normalizeReceipt } from './parity.ts';
import { normalize } from './normalize.ts';
import { lintProbeConstants, rustTokens } from './probe-lint.ts';
import { collectCalls, generate as autoGenerate, source as autoSource, shape } from './autoprofile.ts';
import { learn, normalizeAuto, varyingIdentities } from './auto-observe.ts';
import { imageTree, requireSameTree, shareTree, treeHash } from './oracle.ts';
import { splitLauncher } from './oracle-trace.ts';
import { removeUnpacked } from '../kernel/packer.ts';

const FIXTURES = join(ASSETS, 'tests/fixtures');
interface Test {
  name: string;
  body: () => Promise<void>;
}
const tests: Test[] = [];

test('probe lint rejects fd, offset, size, bytes and constant aliases', async () => {
  for (const condition of ['fd == 999', 'a[0] == 3', 'a[3] == 4091', 'a[2] == 23', 'a[2] == 16', 'a[1] == 1', 'buf == b"AAAAA"', 'offset == 0x2328usize']) {
    assert.ok(lintProbeConstants('pread64', 'pub fn call(a: &[usize])->isize { if ' + condition + ' { 0 } else { -9 } }').length, condition);
  }
  assert.ok(lintProbeConstants('pread64', 'const LEN: usize = 9000; let n = LEN; if size == n { return 0; }').length);
  assert.ok(lintProbeConstants('ppoll', 'match fd { 9_99 => 1, _ => 0 }').length);
});

test('probe lint permits ABI limits, layout indexing, comments and canonical handlers', async () => {
  assert.equal(lintProbeConstants('pread64', '// if fd == 999 {}\n/* nested /* if n == 9000 {} */ */\nif n == 0 { 0 } else { buf[17] as isize }').length, 0);
  assert.equal(lintProbeConstants('ppoll', 'if nfds > 16 || nsec >= 1_000_000_000 { return -22; }').length, 0);
  assert.equal(lintProbeConstants('ppoll', 'let nfds = a[1]; if nfds > 1024 { return -22; }').length, 0);
  assert.equal(lintProbeConstants('pread64', 'let count = a[2]; if count > 0x7ffff000 { return -14; }').length, 0);
  for (const name of ['ppoll', 'fstat', 'pread64']) assert.ok(lintProbeConstants(name, readFileSync(join(CANONICAL, 'src/syscalls/' + name + '.rs'), 'utf8')).length === 0);
  assert.throws(() => rustTokens('/* unclosed'), /unterminated/);
});

test('E2 overfit controls evade the lint and narrow one canonical handler each', async () => {
  const controls = readdirSync(join(ASSETS, 'e2-controls')).sort();
  assert.deepEqual(controls, ['fstat-constant-size.rs', 'ppoll-narrow-nfds.rs', 'pread64-constant-length.rs']);
  for (const file of controls) {
    const name = file.split('-')[0];
    const source = readFileSync(join(ASSETS, 'e2-controls', file), 'utf8');
    assert.equal(lintProbeConstants(name, source).length, 0, file);
    assert.notEqual(source, readFileSync(join(CANONICAL, 'src/syscalls/' + name + '.rs'), 'utf8'));
  }
});

test('autoprofile treats a foreign absolute address as an output buffer, not a scalar', async () => {
  await temporary(async (path) => {
    const trace = join(path, 'trace');
    writeFileSync(trace, '10 statfs("\\x2f\\x6d", 0xffffd51e4b40) = -1 ENOENT (No such file or directory)\n10 statfs("\\x2f", {f_type=0x6a656a63}) = 0\n10 mmap(NULL, 4096, 0x3, 0x22, -1, 0) = 0x7e1000\n');
    const calls = collectCalls('statfs', [trace]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].args[1].kind, 'opaque-output');
    const profile = autoGenerate('statfs', 43, [trace]);
    assert.equal(autoSource(profile, profile.visible.concat(profile.heldout)).includes('0xffffd51e4b40'), false);
    // Small scalars and mmap lengths stay scalars.
    assert.equal(collectCalls('mmap', [trace])[0].args[1].kind, 'scalar');
  });
});

test('autoprofile parses nested trace shapes and ignores incomplete calls', async () => {
  assert.equal(shape('3</data/file>').kind, 'fd');
  assert.equal(shape('{st_size=8192, st_mode=0100444}').kind, 'opaque-output');
  assert.equal(shape('"\\x00\\xff"').kind, 'bytes');
  await temporary(async (path) => {
    const trace = join(path, 'trace');
    writeFileSync(trace, '15 ppoll([{fd=0<pipe:[7]>, events=0}, {fd=1<pipe:[8]>, events=4}], 2, {tv_sec=0, tv_nsec=0}, NULL, 8) = 1 ([{fd=1, revents=4}])\n15 ppoll( <unfinished ...>\n');
    const calls = collectCalls('ppoll', [trace]);
    assert.equal(calls.length, 1); assert.equal(calls[0].args.length, 5);
    assert.equal(calls[0].args[0].kind, 'fd-array');
    const profile = autoGenerate('ppoll', 73, [trace]);
    assert.ok(profile.visible.length && profile.heldout.length);
    const ids = profile.visible.concat(profile.heldout).map((c) => c.id);
    assert.equal(ids.length, new Set(ids).size);
    assert.ok(profile.visible.concat(profile.heldout).some((c) => c.category === 'state'));
  });
});

test('autoprofile emits freestanding boundary/error/state probes without human expected values', async () => {
  await temporary(async (path) => {
    const trace = join(path, 'trace');
    writeFileSync(trace, '7 unknown_leaf(3</file>, "abc", 3, 0) = 3\n');
    const profile = autoGenerate('unknown_leaf', 999, [trace]);
    const cases = profile.visible.concat(profile.heldout);
    assert.ok(cases.some((c) => c.closed));
    assert.ok(cases.some((c) => c.args.includes('-16L')));
    assert.ok(cases.some((c) => c.args.includes('2147483647')));
    assert.ok(cases.some((c) => c.category === 'semantic') && cases.some((c) => c.category === 'error'));
    const code = autoSource(profile, cases);
    assert.ok(code.includes('repeat-return') && code.includes('position'));
    const c = join(path, 'generated.c'); writeFileSync(c, code);
    await run(['clang', '--target=aarch64-none-elf', '-ffreestanding', '-fno-builtin', '-c', c, '-o', join(path, 'probe.o')]);
    await assert.rejects(async () => autoGenerate('missing', 1, [trace]), /no supported/);
  });
});

test('autoprofile detects writes with two fills and compares descriptor-independent outputs byte-wise', async () => {
  assert.equal(shape('PROT_READ|PROT_WRITE').value, '3');
  assert.equal(shape('MAP_PRIVATE|MAP_ANONYMOUS|MAP_NORESERVE').value, String(2 + 32 + 16384));
  assert.equal(shape('MAP_PRIVATE|MAP_UNKNOWN').kind, 'unsupported');
  await temporary(async (path) => {
    const trace = join(path, 'trace');
    writeFileSync(trace, '7 leaf_struct({sysname="Linux", nodename="x"}) = 0\n7 leaf_fd(3</file>, {st_mode=S_IFREG|0644}) = 0\n7 leaf_random("\\xa7", 1, 0) = 1\n');
    const independent = autoGenerate('leaf_struct', 160, [trace]);
    const seed = independent.visible.find((c) => c.id === 'seed-0')!;
    assert.ok(seed.observe.includes('if(extent0)bytes(first[0],extent0)'));
    assert.ok(seed.observe.includes('first[0][j]!=0xa7||memory[0][j]!=0x5c'));
    const code = autoSource(independent, [seed]);
    assert.ok(code.includes('memory[i][j]=0x5c') && code.includes('second-return'));
    // An invalid-pointer variant does not observe memory, so it calls once.
    const invalid = independent.visible.concat(independent.heldout).find((c) => c.args[0] === '(long)ro')!;
    assert.ok(!autoSource(independent, [invalid]).includes('second-return'));
    const described = autoGenerate('leaf_fd', 80, [trace]).visible.find((c) => c.id === 'seed-0')!;
    assert.ok(described.observe.includes('touched1') && !described.observe.includes('bytes(first'));
    // A one-byte random result equal to one fill is still "touched".
    const random = autoGenerate('leaf_random', 278, [trace]).visible.find((c) => c.id === 'seed-0')!;
    assert.ok(random.observe.includes('first[0][j]!=0xa7||memory[0][j]!=0x5c') && random.observe.includes('bytes(first[0],n)'));
    const c = join(path, 'generated.c'); writeFileSync(c, autoSource(independent, independent.visible));
    await run(['clang', '--target=aarch64-none-elf', '-ffreestanding', '-fno-builtin', '-c', c, '-o', join(path, 'probe.o')]);
  });
});

test('autoprofile rebinds addresses near an earlier mapping to the probe mapping', async () => {
  await temporary(async (path) => {
    const trace = join(path, 'trace');
    writeFileSync(trace, '7 mmap(NULL, 126976, 0x3, 0x22, -1, 0) = 0xffff82a76000\n7 mmap(0xffff82a61000, 126976, 0x3, 0x22, -1, 0) = 0xffff82a61000\n7 mmap(0x7000000000, 4096, 0x3, 0x22, -1, 0) = 0x7000000000\n');
    const calls = collectCalls('mmap', [trace]);
    assert.equal(calls[1].args[0].kind, 'mapped');
    assert.ok(calls[1].args[0].value === String(0xffff82a61000 - 0xffff82a76000));
    // Far from every earlier region: stays an absolute scalar.
    assert.equal(calls[2].args[0].kind, 'scalar');
    const seed = autoGenerate('mmap', 222, [trace]).visible.find((c) => c.id === 'seed-1')!;
    assert.ok(seed.args[0] === '(mapping+-86016)');
    // The allocator under test never provides the probe's own buffers.
    const code = autoSource(autoGenerate('mmap', 222, [trace]), [seed]);
    assert.ok(code.includes('memory[i]=arena+i*131072') && !code.includes('sys(222,0,786432'));
    const c = join(path, 'generated.c'); writeFileSync(c, code);
    await run(['clang', '--target=aarch64-none-elf', '-ffreestanding', '-fno-builtin', '-c', c, '-o', join(path, 'probe.o')]);
  });
});

test('identity labels that vary in one split are identities in the other', async () => {
  const out = (s: string) => ({ stdout_hex: Buffer.from(s).toString('hex'), stderr_hex: '', exit: 0 });
  const visible = [out('return=10\nrepeat-return=10\n'), out('return=9\nrepeat-return=9\n')];
  const heldout = [out('return=10\nrepeat-return=10\ncount=3\n'), out('return=10\nrepeat-return=10\ncount=3\n')];
  const first = [learn(visible), learn(heldout)];
  const labels = varyingIdentities(first, [visible[0], heldout[0]]);
  assert.ok(labels.join(',') === 'repeat-return,return');
  const relaxed = learn(heldout, labels);
  assert.ok(relaxed.rules.join(',') === 'positive,positive,exact,exact');
  // Any stable positive pid passes; the repeat must still equal the first call.
  assert.equal(normalizeAuto(Buffer.from('return=7\nrepeat-return=7\ncount=3\n').toString('hex'), relaxed.rules), relaxed.expected.stdout_hex);
  assert.notEqual(normalizeAuto(Buffer.from('return=7\nrepeat-return=8\ncount=3\n').toString('hex'), relaxed.rules), relaxed.expected.stdout_hex);
  assert.notEqual(normalizeAuto(Buffer.from('return=7\nrepeat-return=7\ncount=4\n').toString('hex'), relaxed.rules), relaxed.expected.stdout_hex);
});

test('Linux calibration relaxes varying 8-byte words and keeps the rest exact', async () => {
  const word = (s: string) => s.padEnd(16, '0');
  const a = 'return=0\n' + word('4c696e7578') + word('aaaa') + word('0102') + '\n';
  const b = 'return=0\n' + word('4c696e7578') + word('bbbb') + word('0102') + '\n';
  const learned = learn([a, b].map((s) => ({ stdout_hex: Buffer.from(s).toString('hex'), stderr_hex: '', exit: 0 })));
  assert.ok(learned.rules[1] === 'words:48:010');
  const other = 'return=0\n' + word('4c696e7578') + word('cccc') + word('0102') + '\n';
  assert.equal(normalizeAuto(Buffer.from(other).toString('hex'), learned.rules), learned.expected.stdout_hex);
  const wrongFixed = 'return=0\n' + word('4c696e7579') + word('cccc') + word('0102') + '\n';
  assert.notEqual(normalizeAuto(Buffer.from(wrongFixed).toString('hex'), learned.rules), learned.expected.stdout_hex);
  assert.throws(() => normalizeAuto(Buffer.from('return=0\n' + word('4c') + '\n').toString('hex'), learned.rules), /extent/);
});

test('Linux calibration relaxes only observed positive identity and byte variation', async () => {
  const refs = ['return=11\ntouched=1\na1ff\nrepeat-memory=0\n', 'return=15\ntouched=1\nb2ee\nrepeat-memory=0\n'].map((s) => ({ stdout_hex: Buffer.from(s).toString('hex'), stderr_hex: '', exit: 0 }));
  const learned = learn(refs);
  assert.ok(normalizeAuto(Buffer.from('return=1\ntouched=1\n0abc\nrepeat-memory=0\n').toString('hex'), learned.rules) === learned.expected.stdout_hex);
  assert.throws(() => normalizeAuto(Buffer.from('return=0\ntouched=1\n0abc\nrepeat-memory=0\n').toString('hex'), learned.rules), /positive/);
  assert.throws(() => normalizeAuto(Buffer.from('return=1\ntouched=1\n0a\nrepeat-memory=0\n').toString('hex'), learned.rules), /extent/);
  assert.throws(() => learn([refs[0], { stdout_hex: Buffer.from('changed\n').toString('hex'), stderr_hex: '', exit: 0 }]), /shape/);
  const identity = learn(['return=10\nrepeat-return=10\n', 'return=15\nrepeat-return=15\n'].map((s) => ({ stdout_hex: Buffer.from(s).toString('hex'), stderr_hex: '', exit: 0 })));
  assert.equal(normalizeAuto(Buffer.from('return=1\nrepeat-return=1\n').toString('hex'), identity.rules), identity.expected.stdout_hex);
  assert.notEqual(normalizeAuto(Buffer.from('return=1\nrepeat-return=2\n').toString('hex'), identity.rules), identity.expected.stdout_hex);
});
test('shared tree: the oracle tree re-packs to the guest archive and pins its hash', async () => {
  await temporary(async (path) => {
    const resources = join(path, 'resources'); mkdirSync(join(resources, 'd'), { recursive: true });
    writeFileSync(join(resources, 'data.bin'), 'abc'); writeFileSync(join(resources, 'd/x'), '');
    const shared = shareTree(resources, join(path, 'tree'));
    assert.equal(shared.entries, 4);
    assert.equal(shared.sha256, treeHash(resources));
    assert.equal(statSync(join(path, 'tree/data.bin')).mode & 0o777, 0o444);
    assert.equal(statSync(join(path, 'tree/d')).mode & 0o777, 0o555);
    // An empty archive (corpus guests) materialises as an empty root.
    assert.equal(shareTree(null, join(path, 'empty')).entries, 1);
    removeUnpacked(join(path, 'tree')); removeUnpacked(join(path, 'empty'));
    assert.equal(existsSync(join(path, 'tree')), false);
  });
});
test('shared tree: comparison fails closed on a missing or different tree hash', async () => {
  await temporary(async (path) => {
    const good = 'a'.repeat(64);
    dump(join(path, 'manifest.json'), { packed: { resources: { sha256: good } } });
    assert.equal(imageTree(path), good);
    requireSameTree(path, good);
    await assert.rejects(async () => requireSameTree(path, 'b'.repeat(64)), /shared tree mismatch/);
    await assert.rejects(async () => requireSameTree(path, undefined), /no shared-tree hash/);
    dump(join(path, 'manifest.json'), { packed: {} });
    await assert.rejects(async () => requireSameTree(path, good), /lacks the packed archive hash/);
  });
});
test('shared tree: launcher prelude is split off at the payload execveat', async () => {
  const text = '9 execve("/oracle-root", [], []) = 0\n9 chroot("/jitk-root") = 0\n9 execveat(3, "", [], [], AT_EMPTY_PATH) = 0\n9 chdir("/") = 0\n9 exit(0) = ?\n';
  const parts = splitLauncher(text);
  assert.equal(parts.payload, '9 chdir("/") = 0\n9 exit(0) = ?\n');
  assert.match(parts.launcher, /chroot/);
  assert.equal(parts.payload.includes('chroot'), false);
  await assert.rejects(async () => splitLauncher('9 execveat(3, "", [], [], AT_EMPTY_PATH) = -1 EACCES (Permission denied)\n'), /did not execute the payload/);
});
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
    const child = track(spawn('/bin/sleep', ['30'], { detached: true, env: SAFE_ENV }), 60);
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
  writeFileSync(join(auth, '.credentials.json'), '{"fixture":"private-test-value"}');
  const oldAuth = process.env.CODEX_HOME;
  const oldCli = process.env.JITK_GROW_CLI;
  const oldClaude = process.env.CLAUDE_CONFIG_DIR;
  process.env.CODEX_HOME = auth;
  process.env.JITK_GROW_CLI = resolve(String(process.argv[1]));
  if (mode === 'claude') {
    const cli = join(path, 'claude-fixture');
    symlinkSync(resolve(String(process.argv[1])), cli);
    process.env.JITK_GROW_CLI = cli;
    process.env.CLAUDE_CONFIG_DIR = auth;
  }
  try {
    if (mode === 'success' || mode === 'claude') {
      validateProposal('rt_sigaction', await proposal('rt_sigaction', work, out, {}, true, 'none'));
      const prompt = readFileSync(join(out, 'agent-prompt.txt'), 'utf8');
      assert.match(prompt, /Syscall: rt_sigaction/);
      assert.ok(!prompt.includes('always return -38'));
      assert.ok(!prompt.includes(readFileSync(join(ASSETS, 'heldout-probe.c'), 'utf8')));
    } else if (mode === 'timeout') {
      process.env.JITK_GROW_CLI_TIMEOUT = '0.1';
      await assert.rejects(() => proposal('rt_sigaction', work, out, {}, true), /timeout/);
      delete process.env.JITK_GROW_CLI_TIMEOUT;
      assert.match(readFileSync(join(out, 'agent.log'), 'utf8'), /partial progress/);
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
    if (oldClaude === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = oldClaude;
    }
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

async function fakeCli(): Promise<void> {
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
  if (out.endsWith('/timeout')) {
    console.log('partial progress');
    await new Promise<void>((done) => setTimeout(done, 30000));
  }
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


test('E1 spec ablation retains only the selected public specification', async () => {
  assert.equal(specification('ppoll', 'none'), 'Syscall: ppoll.');
  assert.equal(specification('fstat', 'terse'), 'Implement fstat for immutable archive files and console descriptors.');
  assert.match(specification('pread64'), /Negative signed offset/);
  assert.equal(parseArgs(['--run-id', 'e1', '--spec', 'none', '--attempts', '2']).attempts, 2);
  assert.throws(() => parseArgs(['--run-id', 'e1', '--spec', 'secret']));
  assert.throws(() => parseArgs(['--run-id', 'e1', '--attempts', '4']));
});
test('held-out gates sanitize diagnostics and mutants ignore candidate formatting', async () => {
  for (const gate of ['assemble_heldout', 'heldout_candidate', 'build_heldout_candidate', 'independent_full_stat_and_state', 'mutation_gate', 'unchanged_sqlite']) {
    assert.ok(!JSON.stringify(feedback(gate, new Error('SECRET'))).includes('SECRET'));
  }
  for (const name of ['ppoll', 'fstat', 'pread64']) {
    assert.ok(PROFILES[name].visible === (name === 'ppoll' ? join(CANONICAL, 'tests/fixtures/grow/ppoll.S') : join(ASSETS, 'fs-probe.c')));
    assert.ok(PROFILES[name].heldout === join(ASSETS, 'heldout-probe.c'));
  }
  assert.ok(equal(mutations('pread64', 'arbitrary formatting'), mutations('pread64', 'another formatting')));
});
test('retry restores state, retains diagnostics and only supplies public feedback', async () => {
  await temporary(async (path) => {
    const work = join(path, 'work');
    mkdirSync(join(work, 'src/syscalls'), { recursive: true });
    const manifest = { version: 0 };
    const out = join(path, 'out');
    const report = await retryTransaction('ppoll', work, out, manifest, 3, async (dest, history) => {
      mkdirSync(dest);
      if (!history.length) {
        dump(join(dest, 'stages.json'), { heldout_candidate: { passed: false } });
        dump(join(dest, 'proposal.json'), { source: 'previous public candidate' });
        manifest.version = 999;
        writeFileSync(join(work, 'src/syscalls/ppoll.rs'), 'candidate');
        throw new Error('SECRET_TEST_INPUT');
      }
      assert.equal(manifest.version, 0);
      assert.ok(!existsSync(join(work, 'src/syscalls/ppoll.rs')));
      assert.ok(!JSON.stringify(history).includes('SECRET'));
      assert.match(JSON.stringify(history), /previous public candidate/);
      return { name: 'ppoll', gate: 'PASS' };
    });
    assert.ok(report.accepted === true && report.acceptance_at_1 === false);
    assert.match(readFileSync(join(out, 'attempt-1/rejection.json'), 'utf8'), /SECRET_TEST/);
  });
});
test('three rejecting attempts persist and quota pauses immediately', async () => {
  await temporary(async (path) => {
    const work = join(path, 'work');
    mkdirSync(join(work, 'src/syscalls'), { recursive: true });
    for (const quota of [false, true]) {
      const out = join(path, quota ? 'quota' : 'three');
      let calls = 0;
      await assert.rejects(() => retryTransaction('ppoll', work, out, {}, 3, async (dest) => {
        calls += 1;
        mkdirSync(dest);
        dump(join(dest, 'stages.json'), { heldout_candidate: { passed: false } });
        if (quota) {
          writeFileSync(join(dest, 'agent.log'), 'rate limit');
        }
        throw new Error('SECRET');
      }));
      assert.equal(calls, quota ? 1 : 3);
      assert.ok(!readFileSync(join(out, 'report.json'), 'utf8').includes('SECRET'));
      assert.equal(existsSync(join(out, 'paused.json')), quota);
    }
  });
});
test('CLI usage is retained and tool events or bad Claude envelopes fail closed', async () => {
  await temporary(async (path) => {
    auditResponse('{"type":"turn.completed","usage":{"input_tokens":12}}\n', false, path);
    assert.match(readFileSync(join(path, 'agent-usage.json'), 'utf8'), /12/);
    assert.throws(() => auditResponse('{"item":{"type":"command_execution"}}', false, path));
    auditResponse('{"is_error":false,"structured_output":{"path":"p","source":"s"},"usage":{"output_tokens":9}}', true, path);
    assert.equal(readJSON<{ source: string }>(join(path, 'agent.json')).source, 's');
    assert.throws(() => auditResponse('{"is_error":true}', true, path));
    assert.throws(() => auditResponse('{"structured_output":{},"content":[{"type":"tool_use"}]}', true, path));
  });
});
test('Claude adapter isolates flags, credentials and structured output', async () => temporary((path) => liveFixture(path, 'claude')));
test('CLI timeout retains partial output and removes private auth', async () => temporary((path) => liveFixture(path, 'timeout')));
test('host harness accepts super imports without proposal-visible tests', async () => {
  await temporary(async (path) => {
    const work = join(path, 'kernel');
    const out = join(path, 'receipt');
    mkdirSync(out);
    copyKernel(work);
    rmSync(join(work, 'tests'), { recursive: true });
    const handler = join(work, 'src/syscalls/pread64.rs');
    writeFileSync(handler, readFileSync(handler, 'utf8').replace('use crate::{fs, syscalls::copyout};', 'use crate::fs; use super::{copyout,writable};'));
    assert.equal((await hostHandlerTests(work, out)).returncode, 0);
    assert.ok(!existsSync(join(work, 'tests')));
  });
});

test('seeded E1 design matches every historical Python cell in order', async () => {
  for (const phase of ['pilot', 'main']) {
    const n = phase === 'pilot' ? 2 : 10;
    const expected = readJSON<Metadata>(join(ASSETS, 'experiments', phase === 'pilot' ? 'E1-pilot.json' : 'E1.json')).design;
    assert.ok(equal(design(phase, n), expected));
  }
});
test('CSV quoting and diagnostic categories preserve failure accounting', async () => {
  const rows = [{ a: 'hello, "world"', b: 'multi\nline' }];
  assert.ok(equal(csvDecode(csvEncode(rows, ['a', 'b'])), rows));
  assert.equal(category('build_candidate', 'unresolved import super::fs'), 'Rust module/helper import');
  assert.equal(category('headless_cli', 'timeout'), 'CLI timeout');
  const linux = Buffer.from('pread.fd-truncation=3\n').toString('hex');
  const guest = Buffer.from('pread.fd-truncation=-9\n').toString('hex');
  assert.equal(category('heldout_candidate', "{'linux': {'stdout_hex': '" + linux + "'}, 'jitk': {'stdout_hex': '" + guest + "'}}"), 'Held-out fd argument narrowing');
  assert.equal(canonical(normalizeReceipt({ wall_s: 3, x: '/test/run/file' }, ['/test/run'], '/test')), '{"x":"<run>/file"}');
});
test('receipt audit detects changed CSV decisions and incomplete denominators', async () => {
  const runId = 'unit-e1-' + process.pid;
  const out = join(ROOT, 'results', runId);
  const tools = join(ROOT, 'results', runId + '-experiment');
  const cells = design('pilot', 1, runId + '-unused');
  const selected = cells.findIndex((cell) => cell[1] === 'ppoll' && cell[2] === 'none' && cell[3] === 'new');
  const first = cells[0];
  cells[0] = cells[selected];
  cells[selected] = first;
  cells[0] = [runId, 'ppoll', 'none', 'new', 1];
  const tx = join(out, 'tx-ppoll');
  const dest = join(tx, 'attempt-1');
  mkdirSync(dest, { recursive: true });
  mkdirSync(tools);
  try {
    const pins = markers();
    const meta: Metadata = { date: 'test', host: 'test', cli: 'test', source_commit: 'test', controller_sha256: {}, models: { old: 'gpt-6-sol', new: 'gpt-6.1-sol' }, protected_before: pins, oracle_image: 'test', vmm_sha256: 'test', design: cells, n_per_cell: 1 };
    dump(join(tools, 'E1-pilot.json'), meta);
    dump(join(out, 'source.json'), { files: treeHashes(CANONICAL) });
    dump(join(out, 'report.json'), { gate: 'PASS', host_sha256: 'test' });
    dump(join(out, 'experiment.json'), { wall_s: 1, returncode: 0, paused: false, accepted: true, command: ['grow', '--validate-only'], protected_after: pins, controller_sha256: {} });
    dump(join(tx, 'report.json'), { accepted: true, acceptance_at_1: true, acceptance_at_3: true, cli_calls: 1, attempts: [{ attempt: 1, accepted: true, gate: 'PASS', wall_s: 1 }] });
    const stages: Record<string, { passed: boolean }> = { heldout_candidate: { passed: true } };
    for (let i = 0; i < 30; i += 1) {
      stages['semantic_error_state_' + i] = { passed: true };
    }
    dump(join(dest, 'stages.json'), stages);
    dump(join(dest, 'proposal.json'), { source: 'pub fn call(_: &[usize]) -> isize { 0 }' });
    dump(join(dest, 'agent-mode.json'), { mode: 'live' });
    dump(join(dest, 'mutations.json'), [{}, {}]);
    dump(join(dest, 'acceptance.json'), { visible_pass: true, heldout_pass: true, mutations: [{ reasons: { visible: 'rejected', heldout: 'rejected' } }, { reasons: { visible: 'rejected', heldout: 'rejected' } }] });
    const rows = attemptRows(cells[0], meta);
    const columns = Object.keys(rows[0]);
    writeFileSync(join(tools, 'E1-pilot.csv'), csvEncode(rows, columns));
    assert.equal(verifyReceipts(join(tools, 'E1-pilot.json'), false).attempts, 1);
    assert.equal(phase(join(tools, 'E1-pilot.json')).length, 1);
    assert.throws(() => verifyReceipts(join(tools, 'E1-pilot.json'), true), /incomplete/);
    rows[0].accepted = 0;
    writeFileSync(join(tools, 'E1-pilot.csv'), csvEncode(rows, columns));
    assert.throws(() => verifyReceipts(join(tools, 'E1-pilot.json'), false), /decision/);
  } finally {
    cleanup(out);
    cleanup(tools);
  }
});
test('sealing pins trusted Git inputs and inventories artifact bytes', async () => {
  const runId = 'unit-seal-' + process.pid;
  const out = join(ROOT, 'results', runId);
  const tools = join(ROOT, 'results', runId + '-experiment');
  mkdirSync(join(out, 'tx-ppoll/attempt-1/heldout'), { recursive: true });
  mkdirSync(tools);
  try {
    const commit = (await run(['git', 'rev-parse', 'HEAD'], { cwd: ROOT })).stdout.toString().trim();
    dump(join(out, 'experiment.json'), {});
    dump(join(out, 'oracle-image.json'), { Id: 'fixture-image' });
    dump(join(out, 'tx-ppoll/attempt-1/heldout/sealed.json'), { source_sha256: sha(join(ROOT, 'heldout-probe.c')) });
    const meta: Metadata = { date: 'test', host: 'test', cli: 'test', source_commit: commit, controller_sha256: {}, models: {}, protected_before: markers(), oracle_image: 'fixture-image', vmm_sha256: 'test', design: [[runId, 'ppoll', 'none', 'new', 1]], n_per_cell: 1 };
    const path = join(tools, 'E1-pilot.json');
    dump(path, meta);
    await sealReceipts(path, true);
    const sealed = readJSON<{ trusted_sources_sha256: Record<string, string> }>(join(out, 'sealed-inputs.json'));
    assert.ok(Object.keys(sealed.trusted_sources_sha256).some((name) => name.endsWith('grow/host-tests.rs')));
    const artifacts = readJSON<Record<string, { sha256: string }>>(join(out, 'artifacts.json'));
    assert.equal(artifacts['experiment.json'].sha256, sha(join(out, 'experiment.json')));
    dump(join(out, 'oracle-image.json'), { Id: 'changed-image' });
    await assert.rejects(() => sealReceipts(path, false), /oracle image changed/);
  } finally {
    cleanup(out);
    cleanup(tools);
  }
});

test('summary renderer requires full measurements', async () => {
  await temporary(async (path) => {
    const source = join(ASSETS, 'experiments/summary.json');
    renderSummary(source, join(path, 'summary.html'));
    assert.match(readFileSync(join(path, 'summary.html'), 'utf8'), /27\/30/);
    dump(join(path, 'incomplete.json'), { pilot: [], main: [] });
    assert.throws(() => renderSummary(join(path, 'incomplete.json'), join(path, 'bad.html')), /incomplete/);
  });
});

async function main(): Promise<void> {
  if (process.argv[2] === '--print') {
    const args = process.argv.slice(2);
    for (const flag of ['--safe-mode', '--restricted', '--no-session-persistence', '--strict-mcp-config']) {
      check(args.includes(flag), flag);
    }
    check(args[args.indexOf('--tools') + 1] === '', 'tools disabled');
    check(!args.includes('exec') && !args.includes('--sandbox'), 'Claude own flags');
    const privatePath = String(process.env.CLAUDE_CONFIG_DIR);
    check(existsSync(join(privatePath, '.credentials.json')) && !existsSync(join(privatePath, 'auth.json')), 'Claude own auth');
    writeFileSync(join(dirname(process.cwd()), 'claude/private-path.txt'), privatePath);
    console.log(JSON.stringify({ is_error: false, structured_output: { path: 'src/syscalls/rt_sigaction.rs', source: 'pub fn call(_: &[usize]) -> isize { -38 }' }, usage: { output_tokens: 7 } }));
    return;
  }
  if (process.argv[2] === 'exec') {
    await fakeCli();
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
