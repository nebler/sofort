import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, dump, run, sha, readJSON, SAFE_ENV, type ProcessResult } from './lib.ts';
import { ROOT } from './runtime.ts';

interface HostOrigin {
  python_source_sha256: string;
  rust_source_sha256: string;
}
function origin(): HostOrigin {
  return readJSON<HostOrigin>(join(ROOT, 'host-tests-origin.json'));
}

// The immutable Rust assertions are independent of the candidate and no longer
// depend on the retired kernel Python wrapper. Check provenance before adapting.
export function hostHarness(work: string): string {
  const fixture = join(ROOT, 'host-tests.rs');
  check(sha(fixture) === origin().rust_source_sha256, 'trusted Rust host fixture changed');
  let source = readFileSync(fixture, 'utf8');
  const declarations = source.split('\n').filter((line) => line.startsWith('#[path = "SYS/'));
  check(declarations.length === 7, 'host harness layout changed; update the adapter');
  for (const line of declarations) {
    source = source.replace(line + '\n', '');
  }
  const marker = '}\n#[path = "FS"] mod fs;';
  check(source.split(marker).length === 2, 'host harness marker changed');
  const nested = declarations.map((line) => line.replace(' mod ', ' pub mod ')).join('\n');
  source = source.replace(marker, 'pub fn writable(a: usize, n: usize) -> bool { range(a,n).is_ok() }\n' + nested + '\n' + marker);
  const names = declarations.map((line) => {
    const match = / mod (\w+);/.exec(line);
    check(match, 'handler declaration');
    return match[1];
  });
  source = source.replace('const CWD:', 'use syscalls::{' + names.join(',') + '};\nconst CWD:');
  return source.replaceAll('FS"', join(work, 'src/fs.rs') + '"').replaceAll('SYS/', join(work, 'src/syscalls') + '/');
}

// The kernel harness fixture, in the documented JITKFS01 breadth-first format.
export function hostArchive(): Buffer {
  const names = ['', 'a.txt', 'b', 'c', 'y', 'z'];
  const parents = [0, 0, 0, 2, 2, 3];
  const directories = [true, false, true, true, false, false];
  const first = [1, 0, 3, 5, 0, 0];
  const counts = [2, 0, 2, 1, 0, 0];
  const contents = ['', 'hi', '', '', '', 'zz'];
  const nameBytes = Buffer.from(names.join(''));
  const dataStart = 16 + 24 * names.length + nameBytes.length;
  const result = Buffer.alloc(dataStart + 4);
  result.write('JITKFS01');
  result.writeUInt32LE(names.length, 8);
  let nameOffset = 16 + 24 * names.length;
  let dataOffset = dataStart;
  for (let i = 0; i < names.length; i += 1) {
    const bytes = Buffer.from(contents[i]);
    const values = [nameOffset, Buffer.byteLength(names[i]), parents[i], directories[i] ? 1 : 0, directories[i] ? first[i] : dataOffset, directories[i] ? counts[i] : bytes.length];
    for (let j = 0; j < values.length; j += 1) {
      result.writeUInt32LE(values[j], 16 + i * 24 + j * 4);
    }
    result.write(names[i], nameOffset);
    nameOffset += Buffer.byteLength(names[i]);
    if (!directories[i]) {
      bytes.copy(result, dataOffset);
      dataOffset += bytes.length;
    }
  }
  return result;
}
export async function hostHandlerTests(work: string, out: string): Promise<ProcessResult> {
  const source = join(out, 'sealed-host-tests.rs');
  const archive = join(out, 'host-fs.bin');
  const binary = join(out, 'host-tests');
  writeFileSync(source, hostHarness(work));
  writeFileSync(archive, hostArchive());
  // Preserve the baseline receipt's source-origin identity. Current fixture
  // bytes are independently checked against the pinned rust_source_sha256.
  dump(join(out, 'host-tests-source.json'), { sha256: origin().python_source_sha256 });
  await run(['rustc', '+1.95.0', '--edition=2024', '--test', '-A', 'static_mut_refs', source, '-o', binary]);
  return await run([binary], { env: { ...SAFE_ENV, ARCHIVE: archive } });
}
