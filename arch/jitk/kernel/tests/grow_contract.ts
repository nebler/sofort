import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { workspace, copyTree, environment, run, capture, check, dump, readJSON } from '../lib.ts';
import { ROOT as area, HOST, uptime } from './measure.ts';
import { pins } from '../../tslib/deps.ts';
const root = resolve(import.meta.dirname, '..');
const work = workspace('JITK_GROW_CONTRACT_WORK', 'grow-contract');
const copy = join(work, 'kernel');
copyTree(root, copy, new Set(['.work', '.scriptc', 'node_modules', 'dist', 'target', 'test-results', 'test-work', '__pycache__', '.READY', '.R4']));
const link = join(work, 'probe.ld');
writeFileSync(link, `ENTRY(_start)
PHDRS { text PT_LOAD FILEHDR PHDRS FLAGS(5); data PT_LOAD FLAGS(6); }
SECTIONS { . = 0x400000 + SIZEOF_HEADERS;
.text : { *(.text*) } :text .rodata : { *(.rodata*) } :text
. = ALIGN(4096); .data : { *(.data*) } :data .bss : { *(.bss*) } :data
/DISCARD/ : { *(.comment*) *(.eh_frame*) } }
`);
interface RecordEvent { kind: string; nr?: number; code?: number }
interface Manifest { syscalls: { nr: number; name: string; registered: boolean; sha256: string | null }[] }
async function build(name: string, asm: string): Promise<string> {
  const source = join(work, name + '.S');
  const obj = join(work, name + '.o');
  const elf = join(work, name + '.elf');
  writeFileSync(source, asm);
  await run(['clang', '--target=aarch64-none-elf', '-c', source, '-o', obj]);
  await run(['/opt/homebrew/bin/ld.lld', '-T', link, obj, '-o', elf]);
  const env = environment();
  env.JITK_ELF = elf;
  env.JITK_ARGV_JSON = '["probe"]';
  env.CARGO_TARGET_DIR = join(work, 'target');
  env.JITK_OUT_DIR = join(work, name);
  env.JITK_TOOLS_DIR = join(root, '.work/bin');
  env.RUST_TOOLCHAIN = pins().rust_toolchain;
  await run(['sh', join(copy, 'build.sh'), '--features', 'grow-trace'], { env });
  return join(work, name, 'kernel.bin');
}
async function guest(image: string, data = Buffer.alloc(0)): Promise<{ records: RecordEvent[]; app: string }> {
  const result = await capture([HOST, image], { input: data, timeout: 10 });
  check(result.returncode === 0, result.stderr.toString());
  const records: RecordEvent[] = [];
  const app: string[] = [];
  for (const line of result.stdout.toString().split('\n')) {
    if (line.startsWith('\x1e')) {
      records.push(JSON.parse(line.slice(1)) as RecordEvent);
    } else if (line) {
      app.push(line);
    }
  }
  check(records[records.length - 1].kind === 'done' && records[records.length - 1].code === 0, result.stdout.toString());
  return { records, app: app.join('\n') };
}
const results: Record<string, unknown> = { load: uptime() };
for (const name of ['ioctl', 'ppoll']) {
  const image = await build(name, readFileSync(join(root, 'tests/fixtures/grow', name + '.S'), 'utf8'));
  const { records, app } = await guest(image, Buffer.from(name === 'ppoll' ? 'ping\n' : ''));
  check(!records.some(record => record.kind === 'missing') && app.includes(name + ' OK'));
  const manifest = readJSON<Manifest>(join(work, name, 'manifest.json'));
  const exits = manifest.syscalls.filter(slot => slot.nr === 93 || slot.nr === 94);
  check(exits.length === 2 && exits.every(slot => slot.registered && slot.name === 'exit') && exits[0].sha256 === exits[1].sha256);
  results[name] = { status: 'PASS', records: records.length, stdout: app, exit_slot: name === 'ioctl' ? 93 : 94 };
}
const asm = readFileSync(join(root, 'tests/fixtures/grow/registered-enosys.S'), 'utf8');
let image = await build('registered-enosys', asm);
let events = (await guest(image)).records;
check(JSON.stringify(events.filter(record => record.kind === 'missing').map(record => record.nr)) === '[511]');
results.registered_enosys = { status: 'PASS', missing: [511], registered_enosys: [29, 134, 135, 216] };
unlinkSync(join(copy, 'src/syscalls/ioctl.rs'));
image = await build('deleted-ioctl', asm);
events = (await guest(image)).records;
check(JSON.stringify(events.filter(record => record.kind === 'missing').map(record => record.nr)) === '[29,511]');
check(readJSON<Manifest>(join(work, 'deleted-ioctl/manifest.json')).syscalls.find(slot => slot.nr === 29)!.registered === false);
results.deleted_ioctl = { status: 'PASS', missing: [29, 511], manifest_registered: false };
results.status = 'PASS';
dump(join(area, 'grow-contract.json'), results);
console.log(JSON.stringify(results, null, 2));
