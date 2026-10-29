// tslib checks. The PRNG digests were produced by the component copies this
// library replaced (bench Random, grow pythonShuffle, kernel PythonRandom).
import { mkdtempSync, mkdirSync, chmodSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, same } from './assert.ts';
import { digest, hashJSON } from './hash.ts';
import { asciiJSON, dumpJSON } from './json.ts';
import { files, removeTree, writable, canonical } from './fs.ts';
import { median, fit } from './stats.ts';
import { PythonRandom, pythonShuffle } from './random.ts';
import { spawnCapture, startDirect, startEnvArgv, trackedChildren, sleep, type Exit } from './process.ts';
import { capture, run } from './subprocess.ts';
import * as streams from './stream-process.ts';
import { skipOrFail } from './skip.ts';

let passed = 0;
async function test(name: string, body: () => Promise<void>): Promise<void> {
  await body();
  passed += 1;
  console.log('ok ' + name);
}

const golden: Record<string, string> = {
  'bench 0': '95310e402fe904c4f6531f5b83f32a77bddce44dbd98b4c91c622668a5f3b69d',
  'grow 0': 'bfdb25c5fc12c519bc92e8c2cd292e2172bf90ee7d0a5fe4386758c1db706776',
  'kernel 0': '93a29aae245775bb4a3dc28144acae52f9c22d194023b2b43b34b0b89ba7feac',
  'bench 1': '7ac6f29ac34c2d8b7a5dd27758d24fcaddfcee2e846885f5953bc3ad0998be43',
  'grow 1': '699416244c5fcd1b18cb756cc329e2fb68845a2f5a727d00c1329a94409af6e1',
  'kernel 1': 'e01acc13d83b5f3a0dd2a1264f7c8325ab9187f3a8c49dce49a1d6dd0c02a781',
  'bench 601': '1a5f95e69ee253e68f02854066ac54dc11ea90f7fd4d11a7333821b2afa87cd9',
  'grow 601': '175a47afd44979d14ed7525dcd4ffce15a57162f61daade85174a0660d2ec29b',
  'kernel 601': '1c4deeb0796cb4413e95f7867b0f09e31d6e061a8338ee5827f63daea875201c',
  'bench 20261026': '40c3c1f46323c2dac81ba9e5e87dd3c0c91dccdfa8bbbea8a4c9b2336b2216ff',
  'grow 20261026': 'b8d25fb2d5b4fa704a71242f2bc29965115d42e3fa91a818666509a54382ce32',
  'kernel 20261026': 'a8f630ab22dbf12972c4c2e1600d4fc58b0a7cc1b42ee5e286f8de1ca508495a',
  'bench 4294967295': '73ad26fab54c06cde59d20bb1e34b2574b67ad8defebbbd3e23f82935baa2078',
  'grow 4294967295': '4706b1bcd948af37133205d1fd8760afaea22cac894e80f445ca8b00c56e56ff',
  'kernel 4294967295': '6dd6ea6780203e4e86a736c96228b1353d203a17fc499f67764fa24a19df0ab0',
};

function h(text: string): string {
  return digest(Buffer.from(text));
}

await test('PythonRandom matches the replaced bench/grow/kernel generators', async () => {
  for (const seed of [0, 1, 601, 20261026, 4294967295]) {
    const r = new PythonRandom(seed);
    const words: number[] = [];
    for (let i = 0; i < 2000; i += 1) {
      words.push(r.uint32());
    }
    const floats: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      floats.push(r.random());
    }
    const ranges: number[] = [];
    for (let i = 1; i < 300; i += 1) {
      ranges.push(r.randrange(i));
    }
    const order: number[] = [];
    for (let i = 0; i < 97; i += 1) {
      order.push(i);
    }
    r.shuffle(order);
    check(h(JSON.stringify([words, floats, ranges, order])) === golden['bench ' + seed], 'bench sequence ' + seed);
    const items: number[] = [];
    for (let i = 0; i < 97; i += 1) {
      items.push(i);
    }
    pythonShuffle(items, seed);
    check(h(JSON.stringify(items)) === golden['grow ' + seed], 'grow shuffle ' + seed);
    const k = new PythonRandom(seed);
    const bytes = Buffer.concat([k.bytes(1), k.bytes(7), k.bytes(4096), k.bytes(3)]);
    check(digest(bytes) === golden['kernel ' + seed], 'kernel randbytes ' + seed);
  }
});

await test('JSON formatting', async () => {
  check(asciiJSON({ a: 'é€\u007f', b: [1, 2] }) === '{\n  "a": "\\u00e9\\u20ac\\u007f",\n  "b": [\n    1,\n    2\n  ]\n}', 'ensure_ascii escapes');
  check(asciiJSON({ a: 1 }, 0) === '{"a":1}', 'compact');
  const dir = mkdtempSync(join(tmpdir(), 'tslib-test-'));
  dumpJSON(join(dir, 'a.json'), { x: 'é' }, 0);
  check(readFileSync(join(dir, 'a.json'), 'utf8') === '{"x":"é"}\n', 'plain dump keeps UTF-8');
  rmSync(dir, { recursive: true, force: true });
  check(hashJSON({ a: 1 }) === h('{"a":1}'), 'hashJSON');
  check(same({ a: 1, b: undefined }, { a: 1 }), 'same drops undefined');
});

await test('stats', async () => {
  check(median([3, 1, 2]) === 2 && median([4, 1, 3, 2]) === 2.5, 'median');
  const line = fit([1, 2, 3], [5, 7, 9]);
  check(line.bytes_per_vm === 2 && line.fixed_bytes === 3 && line.r2 === 1, 'fit');
});

await test('read-only trees are removable', async () => {
  for (const remove of ['writable', 'removeTree']) {
    const root = mkdtempSync(join(tmpdir(), 'tslib-test-'));
    mkdirSync(join(root, 'a/b'), { recursive: true });
    writeFileSync(join(root, 'a/b/f'), 'x');
    chmodSync(join(root, 'a/b/f'), 0o444);
    chmodSync(join(root, 'a/b'), 0o555);
    chmodSync(join(root, 'a'), 0o555);
    check(files(root).length === 1, 'files walk');
    if (remove === 'writable') {
      writable(root);
      rmSync(root, { recursive: true, force: true });
    } else {
      removeTree(root);
    }
    check(!existsSync(root), remove + ' removed the tree');
  }
  check(canonical('/tmp/does-not-exist-tslib/x').endsWith('/does-not-exist-tslib/x'), 'canonical of a missing path');
});

await test('subprocess capture: exact env, codes, input, combined output', async () => {
  const result = await capture(['/bin/sh', '-c', 'printf "%s" "$ONLY"; printf e >&2; cat'], { env: { ONLY: 'v', PATH: '/usr/bin:/bin' }, input: Buffer.from('in') });
  check(result.stdout.toString() === 'vin' && result.stderr.toString() === 'e' && result.returncode === 0 && !result.timeout, 'capture');
  check(result.combined.length === 4, 'combined');
  const envOnly = await capture(['/usr/bin/env'], { env: { A: '1' } });
  check(envOnly.stdout.toString() === 'A=1\n', 'env -i passes exactly the given environment');
  check((await capture(['/bin/sh', '-c', 'exit 7'])).returncode === 7, 'exit code');
  check((await capture(['/bin/sh', '-c', 'kill -9 $$'])).returncode === -9, 'SIGKILL code');
  let failed = false;
  try {
    await run(['/bin/sh', '-c', 'exit 3']);
  } catch (error) {
    failed = String(error).includes(': 3');
  }
  check(failed, 'run rejects with the return code');
});

await test('deadline kills the process group and reports a timeout', async () => {
  const started = performance.now();
  let sampled = 0;
  const result = await capture(['/bin/sh', '-c', '/bin/sleep 30 & /bin/sleep 30'], { timeout: 0.3 }, (pid: number) => { sampled = pid; });
  check(result.timeout && result.returncode === -9 && sampled > 0, 'timeout result');
  check(performance.now() - started < 5000, 'the group kill ended the wait (no 30 s grandchild)');
  let rejected = false;
  try {
    await streams.capture(['/bin/sleep', '30'], { timeout: 0.3 });
  } catch (error) {
    rejected = String(error).includes('process timeout: /bin/sleep 30');
  }
  check(rejected, 'stream-process capture rejects at the deadline');
});

await test('keepalive holds only while children run', async () => {
  check(trackedChildren() === 0, 'idle');
  const pending = spawnCapture(['/bin/sleep', '0.2'], { stdio: 'pipe', timeout: 10 }, startDirect);
  check(trackedChildren() === 1, 'one tracked child');
  const exit = await pending;
  check(exit.code === 0 && trackedChildren() === 0, 'released at close');
  const many: Promise<Exit>[] = [];
  for (let i = 0; i < 16; i += 1) {
    many.push(spawnCapture(['/usr/bin/true'], { stdio: i % 2 ? 'pipe' : 'ignore-stdin', timeout: 10 }, startDirect));
  }
  await Promise.all(many);
  check(trackedChildren() === 0, 'released after concurrent children');
});

await test('spawn failure rejects without waiting for close', async () => {
  let message = '';
  try {
    await spawnCapture(['/nonexistent/tslib-binary'], { stdio: 'pipe', timeout: 10 }, startDirect);
  } catch (error) {
    message = String(error);
  }
  check(message.includes('ENOENT'), 'ENOENT: ' + message);
  await sleep(10);
  check(trackedChildren() === 0, 'failed spawn released');
});

await test('onOutput stops the child early; tee and inherit run', async () => {
  const exit = await spawnCapture(['/bin/sh', '-c', 'echo ready; exec /bin/sleep 30'], {
    stdio: 'pipe',
    timeout: 10,
    onOutput: (stdout: Buffer) => stdout.toString().includes('ready'),
  }, startDirect);
  check(exit.signal === 'SIGKILL' && !exit.timedOut, 'stopped by onOutput');
  const inherited = await spawnCapture(['/usr/bin/true'], { stdio: 'inherit', timeout: 10 }, startEnvArgv);
  check(inherited.code === 0 && inherited.stdout.length === 0, 'inherit');
  const stream = new streams.StreamProcess(['/bin/sh', '-c', 'echo one; echo two']);
  check((await stream.line(5)) === 'one' && (await stream.line(5)) === 'two', 'stream lines');
  check((await stream.wait(5)) === 0, 'stream exit');
});

await test('a skip fails unless JITK_ALLOW_SKIP names it', async () => {
  const saved = process.env.JITK_ALLOW_SKIP;
  process.env.JITK_ALLOW_SKIP = 'other, census';
  skipOrFail('census', 'allowed');
  process.env.JITK_ALLOW_SKIP = 'censusx';
  let failed = false;
  try {
    skipOrFail('census', 'not allowed');
  } catch {
    failed = true;
  }
  check(failed, 'an unlisted skip throws');
  process.env.JITK_ALLOW_SKIP = saved ?? '';
});

console.log('PASS: ' + passed + ' tslib checks');
