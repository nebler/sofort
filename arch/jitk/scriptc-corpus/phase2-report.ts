// Phase-2 census tables from local journals (markdown on stdout). Held-out
// programs appear only in aggregate counts; no held-out name is printed.
//   phase2-report --before full --run LABEL=ID [--run LABEL=ID ...] --grown a,b,c
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check } from './lib.ts';

interface Row {
  name: string; held: boolean; build: string; tier: string; node?: string; jitk: string; cause?: string;
  syscalls: string[]; absent: string[]; guestErrors?: string[]; guestMissing?: string[]; crash?: string;
}
const WORK = join(resolve(import.meta.dirname), '.work');
function journal(id: string): Map<string, Row> {
  const rows = new Map<string, Row>();
  for (const line of readFileSync(join(WORK, id + '.jsonl'), 'utf8').trim().split('\n').filter(Boolean)) {
    const row = JSON.parse(line) as Row;
    rows.set(row.name, row);
  }
  return rows;
}
function table(header: string[], body: string[][]): string {
  return '| ' + header.join(' | ') + ' |\n| ' + header.map(() => '---').join(' | ') + ' |\n' + body.map((r) => '| ' + r.join(' | ') + ' |').join('\n') + '\n';
}
function pct(n: number, d: number): string { return d ? (100 * n / d).toFixed(1) + '%' : '-'; }
function count(values: string[]): [string, number][] {
  const result = new Map<string, number>();
  for (const v of values) result.set(v, (result.get(v) || 0) + 1);
  return Array.from(result.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
// Changes a newly passing program exercised: the placement fix (it was a loader
// refusal), the mmap hint fix (the old kernel returned EINVAL to a hint), and
// each grown syscall its Linux run used that the old kernel lacked.
export function changes(before: Row, grown: string[]): string[] {
  const used: string[] = [];
  if (before.jitk === 'loader-refusal') used.push('placement');
  if ((before.guestErrors || []).includes('mmap:-22') && grown.includes('mmap')) used.push('mmap');
  for (const s of grown) if (s !== 'mmap' && before.absent.includes(s)) used.push(s);
  return used;
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv[0] === 'test') {
    const r: Row = { name: 'x', held: false, build: 'compiled', tier: 'T1', jitk: 'crash', syscalls: ['getrandom'], absent: ['getrandom', 'pipe2'], guestErrors: ['mmap:-22'] };
    check(changes(r, ['mmap', 'getrandom', 'uname']).join(',') === 'mmap,getrandom', 'attribution');
    check(changes({ ...r, jitk: 'loader-refusal', guestErrors: [] }, ['mmap']).join(',') === 'placement', 'placement attribution');
    console.log('ok'); return;
  }
  let beforeId = 'full';
  const runs: [string, string][] = [];
  let grown: string[] = [];
  // Programs whose rebuilt ELF embeds another checkout path (elf-drift in these runs).
  const drift = new Set<string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] === '--before') beforeId = argv[i + 1];
    else if (argv[i] === '--run') { const [label, id] = argv[i + 1].split('='); runs.push([label, id]); }
    else if (argv[i] === '--grown') grown = argv[i + 1].split(',').filter(Boolean);
    else if (argv[i] === '--drift-from') { for (const id of argv[i + 1].split(',')) for (const r of journal(id).values()) if (r.jitk === 'elf-drift') drift.add(r.name); }
    else throw new Error('unknown argument ' + argv[i]);
  }
  const before = journal(beforeId);
  let out = '';
  for (const [label, id] of runs) {
    const after = journal(id);
    const all = Array.from(after.values());
    for (const r of all) if (r.jitk === 'elf-drift') drift.add(r.name);
    // Like for like: programs whose ELF embeds the checkout path are excluded.
    const rows = all.filter((r) => !drift.has(r.name));
    check(all.every((r) => before.has(r.name)), 'run contains programs outside the source census');
    const held = all.length > 0 && all[0].held;
    check(all.every((r) => r.held === held), 'a run mixes visible and held-out programs');
    out += '### ' + label + ' (' + (held ? 'held-out' : 'visible') + ', ' + rows.length + ' comparable compiled programs; ' + (all.length - rows.length) + ' excluded: ELF embeds the checkout path)\n\n';
    const lower = all.filter((r) => r.jitk === 'pass').length;
    out += 'Lower bound over all ' + all.length + ' compiled programs (excluded counted as not passing): ' + lower + ' (' + pct(lower, all.length) + '); before: ' + all.filter((r) => before.get(r.name)!.jitk === 'pass').length + '.\n\n';
    const tiers = ['T1', 'T2', 'T3', 'T4', 'T1+T2', 'all'].map((t) => {
      const sel = rows.filter((r) => t === 'all' || (t === 'T1+T2' ? r.tier === 'T1' || r.tier === 'T2' : r.tier === t));
      const b = sel.filter((r) => before.get(r.name)!.jitk === 'pass').length, a = sel.filter((r) => r.jitk === 'pass').length;
      const nodeOk = sel.filter((r) => r.jitk === 'pass' && r.node === 'match').length;
      return [t, String(sel.length), b + ' (' + pct(b, sel.length) + ')', a + ' (' + pct(a, sel.length) + ')', String(nodeOk)];
    });
    out += table(['Tier', 'Compiled', 'Pass before', 'Pass after', 'After, also = Node'], tiers) + '\n';
    const regressions = rows.filter((r) => before.get(r.name)!.jitk === 'pass' && r.jitk !== 'pass');
    out += 'Regressions (pass before, not after): ' + regressions.length + (regressions.length && !held ? ' (' + regressions.map((r) => r.name + ':' + r.jitk).join(', ') + ')' : '') + '\n\n';
    const unlocked = rows.filter((r) => before.get(r.name)!.jitk !== 'pass' && r.jitk === 'pass');
    const sets = unlocked.map((r) => changes(before.get(r.name)!, grown));
    const names = ['placement', 'mmap', ...grown.filter((g) => g !== 'mmap')];
    out += table(['Change', 'Unlocked programs that exercised it', 'Unlocked by it alone'], names.map((n) => [n, String(sets.filter((s) => s.includes(n)).length), String(sets.filter((s) => s.length === 1 && s[0] === n).length)]).filter((r) => r[1] !== '0')) + '\n';
    out += 'Newly passing: ' + unlocked.length + '; combinations: ' + count(sets.map((s) => s.join('+') || 'none-attributed')).map(([k, v]) => k + ' ' + v).join(', ') + '\n\n';
    out += table(['Outcome after', 'Programs'], count(rows.map((r) => r.jitk)).map(([k, v]) => [k, String(v)])) + '\n';
    out += table(['First cause after (not passing)', 'Programs'], count(rows.filter((r) => r.jitk !== 'pass').map((r) => r.cause || r.jitk)).slice(0, 25).map(([k, v]) => [k, String(v)])) + '\n';
    out += table(['Missing syscall seen by the guest', 'Programs'], count(rows.flatMap((r) => r.guestMissing || [])).slice(0, 20).map(([k, v]) => [k, String(v)])) + '\n';
  }
  console.log(out);
}
main();
