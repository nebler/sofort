import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { check, readJSON, sha } from './lib.ts';
interface Stream { stdout: string; stderr: string; exit: number | null; timeout: boolean }
interface Row {
  name: string; held: boolean; source: string; elf?: string; trace?: string; build: string; node?: string;
  tier: string; jitk: string; linux?: Stream; syscalls: string[]; absent: string[]; blockers: string[]; tolerated: string[];
  guestTrace?: string; guest?: Stream; stockLoader?: string; guestBlocking?: string[]; guestMissing?: string[];
}
interface Tier { tier: string; programs: number; compiled: number; jitkPass: number }
interface Summary {
  complete: boolean; total: number; completed: number; heldout: number;
  stages: Record<string, number>; jitk: Record<string, number>; tiers: Tier[];
}
interface Manifest { runner: string; oracle: string; reference: string; compiler: string; count: number; seedCommitment: string }
function hex(s: string | undefined): boolean { return s !== undefined && /^[0-9a-f]{64}$/.test(s); }
const root = resolve(import.meta.dirname);
const work = join(root, '.work');
const summary = readJSON<Summary>(join(root, 'summary.json'));
const latest = new Map<string, Row>();
for (const line of readFileSync(join(work, 'full.jsonl'), 'utf8').trim().split('\n')) {
  const row = JSON.parse(line) as Row;
  latest.set(row.name, row);
}
const rows = Array.from(latest.values());
check(summary.complete && rows.length === summary.total && summary.completed === summary.total, 'incomplete census');
check(rows.filter(r => r.held).length === summary.heldout, 'held-out count');
for (const r of rows) {
  check(hex(r.source), 'missing source digest');
  check(['T1', 'T2', 'T3', 'T4'].includes(r.tier), 'invalid tier');
  check(r.node !== 'oracle-error', 'unresolved oracle infrastructure error');
  check(r.blockers.every(n => r.absent.includes(n)), 'causal blocker not absent');
  check(r.blockers.every(n => !r.tolerated.includes(n)), 'contradictory injection result');
  if (r.build === 'compiled') {
    check(hex(r.elf) && hex(r.trace) && r.linux !== undefined, 'compiled ELF missing Linux evidence');
    check(hex(r.linux.stdout) && hex(r.linux.stderr), 'missing Linux stream digests');
    check(['pass', 'mismatch', 'missing-syscall', 'loader-refusal', 'crash', 'build-error'].includes(r.jitk), 'compiled ELF lacks jitk attempt');
    check(r.stockLoader !== undefined, 'compiled ELF lacks stock-layout packer result');
    if (r.jitk !== 'loader-refusal' && r.jitk !== 'build-error') check(hex(r.guestTrace) && r.guest !== undefined, 'jitk attempt lacks guest evidence');
    if (r.jitk === 'pass') check(r.guest!.stdout === r.linux.stdout && r.guest!.stderr === r.linux.stderr && r.guest!.exit === r.linux.exit, 'pass without identical streams');
    if (r.jitk === 'missing-syscall') check((r.guestBlocking || []).length > 0 && r.guestBlocking!.every(n => (r.guestMissing || []).includes(n) && r.absent.includes(n)), 'blocking syscall not observed on both sides');
  }
}
for (const stage of Object.keys(summary.stages)) check(summary.stages[stage] === rows.filter(r => r.build === stage).length, 'build total differs');
for (const outcome of Object.keys(summary.jitk)) check(summary.jitk[outcome] === rows.filter(r => r.build === 'compiled' && r.jitk === outcome).length, 'guest total differs');
for (const t of summary.tiers) {
  check(t.programs === rows.filter(r => r.tier === t.tier).length, 'tier entries differ');
  check(t.compiled === rows.filter(r => r.tier === t.tier && r.build === 'compiled').length, 'tier compiled differs');
}
const csv = readFileSync(join(root, 'census.csv'), 'utf8');
const publicNames = csv.trim().split('\n').slice(1).map(line => {
  const match = /^"([^"]+)",/.exec(line);
  check(match, 'malformed public CSV record');
  return match[1];
});
check(publicNames.length === rows.filter(r => !r.held).length, 'public CSV count');
for (const name of publicNames) check(latest.has(name) && !latest.get(name)!.held, 'held-out identity leaked into public CSV');
check(new Set(publicNames).size === publicNames.length, 'duplicate public CSV record');
check(Buffer.byteLength(csv) < 1024 * 1024 && readFileSync(join(root, 'summary.json')).length < 1024 * 1024, 'public summary above 1 MiB');
const manifest = readJSON<Manifest>(join(work, 'full-manifest.json'));
check(manifest.count === summary.total, 'selection count differs');
check(manifest.runner === sha(readFileSync(join(root, 'census.ts'))), 'runner changed after evidence');
check(manifest.oracle === sha(readFileSync(join(work, 'bin/oracle'))), 'driver changed after evidence');
check(manifest.reference === sha(readFileSync(join(root, 'node-reference.ts'))), 'reference changed after evidence');
check(manifest.compiler === sha(readFileSync(join(root, 'node_modules/.bin/scriptc'))), 'compiler changed after evidence');
check(manifest.seedCommitment === sha(readFileSync(join(work, 'split-seed'))), 'private split seed changed');
console.log('audit ok: ' + rows.length + ' unique receipts; ' + publicNames.length + ' visible CSV rows; pins and counts agree');
