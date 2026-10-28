import { mkdtempSync, readFileSync, renameSync, symlinkSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { check, copyTree, dump, environment, files, json, run, sha, writable } from './lib.ts';
const root = import.meta.dirname;
const record = process.env.JITK_RECORD === '1';
const out = join(root, record ? 'dist/r8' : '.work/r8');
const ignored = new Set(['.work', '.scriptc', 'node_modules', 'dist', 'target', 'target-ring', 'test-work', 'test-results', '__pycache__', '.READY', '.R4', 'syscalls.manifest.json']);
function inputs(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const path of files(root).sort()) {
    const rel = relative(root, path);
    if (!rel.split('/').some(part => ignored.has(part))) {
      result[rel] = sha(readFileSync(path));
    }
  }
  return result;
}
mkdirSync(out, { recursive: true });
const before = inputs();
const manifest = join(root, 'syscalls.manifest.json');
const manifestHash = sha(readFileSync(manifest));
const value = JSON.parse(readFileSync(manifest, 'utf8')) as Record<string, unknown>;
const contracts = value.contracts as { name: string; source_sha256: string }[];
const work = mkdtempSync(join(tmpdir(), 'jitk-contract-refresh-'));
try {
  const kernel = join(work, 'kernel');
  copyTree(root, kernel, ignored);
  for (const sibling of ['protocol', 'grow', 'bench', 'docs', 'shard']) {
    symlinkSync(resolve(root, '..', sibling), join(work, sibling));
  }
  const env = environment();
  for (const key of ['JITK_ELF', 'JITK_ARGV_JSON', 'JITK_SCRIPT', 'JITK_RESOURCES', 'JITK_OUT_DIR', 'CARGO_TARGET_DIR', 'JITK_TEST_KERNEL', 'JITK_KERNEL_IMAGE', 'JITK_FS_WORK', 'JITK_GROW_CONTRACT_WORK', 'JITK_PROBE_WORK', 'JITK_TOOLS_DIR']) {
    delete env[key];
  }
  env.JITK_TEST_OUTPUT = join(out, 'contracts');
  const result = await run(['make', '-C', kernel, 'test'], { env });
  writeFileSync(join(out, 'contracts.log'), Buffer.concat([result.stdout, result.stderr]));
  check(JSON.stringify(inputs()) === JSON.stringify(before), 'kernel sources changed during contract verification');
  check(sha(readFileSync(manifest)) === manifestHash, 'verification manifest changed during verification');
  const changed: Record<string, { old: string; new: string }> = {};
  for (const row of contracts) {
    const current = sha(readFileSync(join(root, 'src/syscalls', row.name + '.rs')));
    if (row.source_sha256 !== current) {
      changed[row.name] = { old: row.source_sha256, new: current };
      row.source_sha256 = current;
    }
  }
  const receipt = { status: 'PASS', at: new Date().toISOString(), command: 'make -C SCRATCH/kernel test', sources: before, changed_hashes: changed, log_sha256: sha(readFileSync(join(out, 'contracts.log'))) };
  const raw = json(receipt) + '\n';
  writeFileSync(join(out, 'contract-refresh.json'), raw);
  value.r8_amendment = { scope: 'Historical gates retained; source digests refreshed only after the complete R8 kernel contract suite passed on an unverified scratch build.', generator: 'refresh-contracts.ts', receipt: 'dist/r8/contract-refresh.json', receipt_sha256: sha(Buffer.from(raw)), changed_hashes: changed };
  if (record) {
    const pending = manifest + '.tmp';
    writeFileSync(pending, json(value) + '\n');
    renameSync(pending, manifest);
  }
  console.log(json({ status: 'PASS', changed_hashes: changed }));
} finally {
  writable(work);
  rmSync(work, { recursive: true, force: true });
}
