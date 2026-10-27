import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { check, capture, run, json, environment } from './lib.ts';

const ROOT = import.meta.dirname;
function workspace(): string {
  return mkdtempSync(join(tmpdir(), 'jitk-build-check-'));
}
let work = workspace();
try {
  const out = join(work, 'out');
  mkdirSync(out);
  cpSync(join(ROOT, 'src/syscalls'), join(work, 'src/syscalls'), { recursive: true });
  const tools = join(work, '.work/bin');
  mkdirSync(tools, { recursive: true });
  writeFileSync(join(tools, 'prepare'), '#!/bin/sh\n: > "$2/packed.rs"\n');
  chmodSync(join(tools, 'prepare'), 0o755);
  cpSync(join(ROOT, '.work/bin/build-args'), join(tools, 'build-args'));
  const exe = join(work, 'build');
  await run(['rustc', '+1.95.0', '--edition=2024', join(ROOT, 'build.rs'), '-o', exe]);
  const env = environment();
  env.CARGO_MANIFEST_DIR = work;
  env.OUT_DIR = out;
  env.CARGO_CFG_TARGET_ARCH = 'aarch64';
  env.JITK_SCRIPT = '0';
  env.JITK_TOOLS_DIR = tools;
  async function generate(value: string): Promise<number> {
    writeFileSync(join(work, 'slots.json'), value);
    return (await capture([exe], { env })).returncode;
  }
  const source = readFileSync(join(ROOT, 'slots.json'), 'utf8');
  check(await generate(source) === 0);
  const dispatch = readFileSync(join(out, 'dispatch.rs'));
  const manifest = readFileSync(join(out, 'syscalls.json'));
  check(await generate(JSON.stringify(JSON.parse(source))) === 0);
  check(readFileSync(join(out, 'dispatch.rs')).equals(dispatch));
  check(readFileSync(join(out, 'syscalls.json')).equals(manifest));
  for (const invalid of ['[]', '{"63":"read","63":"write"}', '{"063":"read"}', '{"-1":"read"}', '{"63":1}', '{"63":"../read"}', '{"63":"read"} trailing', '{"63":"type"}']) {
    check(await generate(invalid) !== 0, 'accepted invalid slots: ' + invalid);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
work = workspace();
try {
  const fs = readFileSync(join(ROOT, 'src/fs.rs'), 'utf8');
  const body = fs.includes("Result<&'static mut Open") ? 'let a = fs::get(3).unwrap(); let b = fs::get(3).unwrap(); a.pos = 1; b.pos = 2;' : 'let _a = fs::with_open(3, |o| o);';
  const harness = `#![allow(dead_code, static_mut_refs)]
mod syscalls {
 pub fn copyin(_:usize,_:&mut [u8])->Result<(),isize>{Ok(())}
 pub fn copyout(_:usize,_:&[u8])->Result<(),isize>{Ok(())}
}
mod mmu {pub fn physical(n:usize)->usize{n}}
mod user {pub const FS:usize=0;pub const FS_LEN:usize=0;}
#[path=${json(join(ROOT, 'src/fs.rs'), 0)}] mod fs;
fn main(){ ${body} }`;
  writeFileSync(join(work, 'check.rs'), harness);
  const result = await capture(['rustc', '+1.95.0', '--edition=2024', join(work, 'check.rs'), '-o', join(work, 'check')]);
  check(result.returncode !== 0 && result.stderr.toString().includes('lifetime may not live long enough'), 'mutable Open escaped the safe API');
} finally {
  rmSync(work, { recursive: true, force: true });
}
work = workspace();
try {
  let harness = `#![allow(dead_code)]
mod syscalls {
 pub fn copyin(_:usize,_:&mut [u8])->Result<(),isize>{Ok(())}
 pub fn copyout(_:usize,_:&[u8])->Result<(),isize>{Ok(())}
}
mod mmu {pub fn physical(n:usize)->usize{n}}
mod user {pub const FS:usize=0;pub const FS_LEN:usize=0;}
mod console {pub unsafe fn native()->bool{false}pub unsafe fn load(_:usize)->u64{0}}
`;
  for (const [file, name] of [['ring_abi.rs', 'ring_abi'], ['fs.rs', 'fs'], ['fs_checks.rs', 'checks']]) {
    harness += `#[path=${json(join(ROOT, 'src', file), 0)}] mod ${name};`;
  }
  writeFileSync(join(work, 'check.rs'), harness);
  for (const features of [[], ['--cfg', 'feature="transport-ring"']]) {
    await run(['rustc', '+1.95.0', '--edition=2024', '--test', ...features, join(work, 'check.rs'), '-o', join(work, 'check')], { inherit: true });
    await run([join(work, 'check')], { inherit: true });
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
work = workspace();
try {
  const harness = '#![allow(dead_code, reason="Boot wrapper is unused by host parser checks.")]\n' + [['arch/aarch64/fdt.rs', 'fdt'], ['arch/aarch64/fdt_checks.rs', 'checks']].map(row => `#[path=${json(join(ROOT, 'src', row[0]), 0)}] mod ${row[1]};`).join('\n');
  writeFileSync(join(work, 'test.rs'), harness);
  await run(['rustc', '+1.95.0', '--edition=2024', '--test', join(work, 'test.rs'), '-o', join(work, 'test')], { inherit: true });
  await run([join(work, 'test')], { inherit: true });
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log('4 build checks passed');
