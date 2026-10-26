import { existsSync, mkdirSync, realpathSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { check, dump, readJSON, sha } from './lib.ts';

const root = process.env.JITK_ARTIFACT_ROOT || import.meta.dirname;
const elf = process.argv[2];
let out = process.argv[3];
const dep = readFileSync(elf.slice(0, elf.length - extname(elf).length) + '.d', 'utf8');
const match = /(\/[^\s]+\/out\/packed\.rs)/.exec(dep);
check(match, 'missing packed.rs dependency');
const packed = dirname(match[1]);
const bytes = readFileSync(join(out, 'kernel.bin'));
const hash = sha(bytes);
const manifest: Record<string, unknown> = {};
manifest.version = 3;
manifest.sha256 = hash;
manifest.image = 'kernel-' + hash + '.bin';
manifest.bytes = bytes.length;
manifest.ram_mib = 32;
manifest.features = readJSON<unknown>(join(packed, 'features.json'));
manifest.syscalls = readJSON<unknown>(join(packed, 'syscalls.json'));
manifest.packed = readJSON<unknown>(join(packed, 'packed.json'));
manifest.argv = readJSON<unknown>(join(packed, 'argv.json'));
const verification = join(root, 'syscalls.manifest.json');
if (existsSync(verification)) {
  const raw = readFileSync(verification);
  const contracts = JSON.parse(raw.toString()) as { contracts: { name: string; source_sha256: string }[] };
  for (const contract of contracts.contracts) {
    const source = join(root, 'src/syscalls', contract.name + '.rs');
    if (existsSync(source)) {
      check(sha(readFileSync(source)) === contract.source_sha256, 'stale verification: ' + contract.name);
    }
  }
  manifest.verification = JSON.parse(raw.toString()) as unknown;
  manifest.verification_sha256 = sha(raw);
}
if (realpathSync(out) === join(realpathSync(root), 'dist') && process.env.JITK_RECORD !== '1') {
  out = join(dirname(out), '.work/dist');
}
mkdirSync(out, { recursive: true });
writeFileSync(join(out, String(manifest.image)), bytes);
dump(join(out, 'kernel-' + hash + '.json'), manifest);
dump(join(out, 'manifest.json'), manifest);
console.log(JSON.stringify({ image: join(out, String(manifest.image)), sha256: hash, bytes: bytes.length }));
