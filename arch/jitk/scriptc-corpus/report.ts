// Regenerates RESULTS.md from the completed local `full` journal and the
// public aggregate summary. Held-out identities never appear in the output.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readJSON, check } from './lib.ts';

interface Missing {
  syscall: string; programs: number; t1t2: number; blocks: number; t1t2Blocks: number; single: number;
  jitkSeen: number; jitkBlocks: number; jitkT1T2Blocks: number; jitkSingle: number;
}
interface Tier { tier: string; programs: number; compiled: number; linuxComplete: number; nodeMatch: number; jitkPass: number }
interface Summary {
  total: number; completed: number; complete: boolean; heldout: number;
  stages: Record<string, number>; node: Record<string, number>; jitk: Record<string, number>;
  tiers: Tier[]; missing: Missing[]; limitations: Record<string, number>; loader: Record<string, number>;
  cloneFallback: Record<string, number>; unstableLinux: number; diskBefore: string; diskAfter: string;
  stockLoader: Record<string, number>; causes: Record<string, number>; divergent: Record<string, number>;
  crashes: Record<string, number>; covered: { programs: number; nodeMatch: number; jitk: Record<string, number> };
  t1t2: Record<string, number>; nodeVerifiedPass: number;
}
interface Row {
  name: string; held: boolean; build: string; diagnostic: string; node?: string; tier: string; injection?: string;
  jitk: string; cause?: string; absent: string[]; blockers: string[]; tolerated: string[]; guestBlocking?: string[];
  guestMissing?: string[]; stockLoader?: string; loader?: string;
}
const root = resolve(import.meta.dirname);
const s = readJSON<Summary>(join(root, 'summary.json'));
check(s.complete && s.completed === s.total, 'refuse to publish incomplete results');
const latest = new Map<string, Row>();
for (const line of readFileSync(join(root, '.work/full.jsonl'), 'utf8').trim().split('\n')) {
  const row = JSON.parse(line) as Row;
  latest.set(row.name, row);
}
const rows = Array.from(latest.values());
check(rows.length === s.total, 'journal count differs');
const compiled = rows.filter(r => r.build === 'compiled');
const lines: string[] = [];
function add(text: string): void { lines.push(text); }
function table(header: string[], body: string[][]): string {
  return '| ' + header.join(' | ') + ' |\n| ' + header.map(() => '---').join(' | ') + ' |\n' + body.map(r => '| ' + r.join(' | ') + ' |').join('\n');
}
function counts(c: Record<string, number>): string { return Object.keys(c).sort().map(k => k + ': ' + c[k]).join('; '); }
function pct(a: number, b: number): string { return b ? (a / b * 100).toFixed(1) + '%' : 'n/a'; }
function ranked(c: Record<string, number>): string[][] { return Object.keys(c).sort((a, b) => c[b] - c[a] || a.localeCompare(b)).map(k => [k, String(c[k])]); }
const t12 = (r: Row): boolean => r.tier === 'T1' || r.tier === 'T2';
const pass = s.jitk.pass || 0;
const nCompiled = s.stages.compiled || 0;

add('# scriptc 0.4.5 corpus on jitk\n');
add('Measured 2026-10-26 on a macOS arm64 host: corpus **v0.4.5 / 4ee477d11eb9a71f0a018e5f5bed171a954fc2f7** (flat entries plus directory `main.*`), compiled by scriptc 0.4.5 to static aarch64-linux-musl ELFs. Linux reference: the same ELF under strace in `jitk-oracle:08`; Node reference: Node 24.22.0 in the pinned bookworm image. jitk: the unchanged canonical kernel (copied into `.work/kernel`, canonical release profile, `qjs,grow-trace` features) under `/tmp/jitk-r8/vmm-mac/jitk-vmm`. No corpus source, kernel or grow file was changed.\n');
add(`**jitk pass rate today: ${pass}/${nCompiled} compiled programs (${pct(pass, nCompiled)}) with the jitk link layout; 0/${nCompiled} with scriptc's stock link layout.** A pass means byte-identical stdout, stderr and exit code to Linux with a complete guest trace. ${s.nodeVerifiedPass} of the passes also match Node. Every compiled ELF was attempted.\n`);
add('"jitk link layout" means only the image base changes: `zig-link.sh` passes `-Wl,--image-base=0x400000` to the same Zig linker. Source, compiler, runtime pack and code generation are unchanged. The same relinked ELF is used for Linux, Node comparison and jitk, so every comparison is like for like. Stock ELFs are refused by the packer, so all jitk results below use the relinked layout; see "Loader and packer gaps".\n');
add(`Stages: ${s.total} entries; build ${counts(s.stages)}. Linux versus Node (compiled): ${counts(s.node)}. jitk (compiled): ${counts(s.jitk)}.\n`);

add('## Tiers\n');
add(table(['Tier', 'Entries', 'Compiled', 'Linux completed', 'Linux = Node', 'jitk pass', 'jitk pass / compiled'],
  s.tiers.map(t => [t.tier, String(t.programs), String(t.compiled), String(t.linuxComplete), String(t.nodeMatch), String(t.jitkPass), pct(t.jitkPass, t.compiled)])) + '\n');
add('T1 is stdio plus compute; T2 adds files, timers and clocks; T3 adds Workers, threads, subprocesses and async rename; T4 adds networking. Tiers are a conservative classification from source features and the observed Linux syscall set. The allocator\'s CPU-count probe and optional helper thread do not promote a compute program out of T1. Refused programs have source-only tiers.\n');
add(table(['Tier', 'jitk outcome counts'], ['T1', 'T2', 'T3', 'T4'].map(t => {
  const c: Record<string, number> = {};
  for (const r of compiled.filter(r => r.tier === t)) c[r.jitk] = (c[r.jitk] || 0) + 1;
  return [t, counts(c)];
})) + '\n');
add(`Programs whose whole Linux syscall set is already registered in jitk: **${s.covered.programs}** (${s.covered.nodeMatch} match Node). jitk outcomes for them: ${counts(s.covered.jitk)}. All T1/T2 compiled programs: ${counts(s.t1t2)}.\n`);

add('## Why programs fail on jitk\n');
add('Outcome classes:\n\n- **pass**: byte-identical output and exit, with a complete trace.\n- **missing-syscall**: the guest hit an unregistered syscall that Linux also executed, and the Linux single-syscall ENOSYS experiment did not show that call to be tolerated.\n- **crash**: a fault, abort, deadline expiry, or a guest terminated by the stdout transport.\n- **mismatch**: a complete run with different bytes or exit.\n- **loader-refusal**: the canonical packer rejected the ELF.\n\nA missing call that only the guest made, such as `tkill` from `abort()`, is a consequence and is not counted as a blocker. The cause column is a heuristic: the blocking missing syscall if there is one; otherwise the stdout transport limit; otherwise the **last** registered-syscall error that Linux never returned for the same call.\n');
add(table(['First cause (compiled, not passing)', 'Programs'], ranked(s.causes)) + '\n');
add(table(['Crash kind', 'Programs'], ranked(s.crashes)) + '\n');
add(table(['Guest error that Linux never returned (call:ret)', 'Programs'], ranked(s.divergent).slice(0, 25)) + '\n');
add('`mmap:-22` is the dominant blocker. The scriptc runtime allocator passes a non-NULL **address hint** without MAP_FIXED, e.g. `mmap(0x7e1000, 0x1f000, RW, PRIVATE|ANONYMOUS)` to grow downward next to an existing region. Linux treats the hint as advisory. The jitk handler returns EINVAL for any non-NULL address. The runtime then reports the allocation failure on fd2 and calls `abort()`; `tkill(SIGABRT)` is ENOSYS, and musl\'s `a_crash()` faults. `mmap:-12` comes from the runtime\'s multi-GiB NORESERVE reservation probes, which exceed jitk\'s 32 MiB guest. The runtime falls back from these; they appear in passing programs too. `stdout-control-byte` is the printable-ASCII stdout protocol: any UTF-8 or control byte on fd1 terminates the guest.\n');

add('## Missing-syscall frequency\n');
add('Each row counts programs, not calls.\n\n- **Linux seen**: the ELF executed the syscall on Linux and jitk has no slot for it. The initial launcher execve is excluded.\n- **Linux changed**: for a stable, Node-matching baseline, returning ENOSYS for that one syscall changed stdout, stderr or exit. This is a Linux counterfactual.\n- **Single (Linux)**: the program\'s only causal Linux blocker.\n- **jitk blocked**: programs classified missing-syscall on jitk with this call among the blocking calls; **jitk single**: the only blocking call.\n\nRows are sorted single-blocker first.\n');
const missing = s.missing.filter(m => m.programs > 0 || m.jitkSeen > 0).sort((a, b) =>
  b.jitkSingle - a.jitkSingle || b.single - a.single || b.jitkBlocks - a.jitkBlocks || b.t1t2Blocks - a.t1t2Blocks || b.blocks - a.blocks || b.programs - a.programs || a.syscall.localeCompare(b.syscall));
add(table(['Syscall', 'Linux seen', 'T1/T2 seen', 'Linux changed', 'T1/T2 changed', 'Single (Linux)', 'jitk seen', 'jitk blocked', 'jitk single'],
  missing.map(m => [m.syscall, String(m.programs), String(m.t1t2), String(m.blocks), String(m.t1t2Blocks), String(m.single), String(m.jitkSeen), String(m.jitkBlocks), String(m.jitkSingle)])) + '\n');
// Corpus-tolerated: exercised by ENOSYS experiments in >= 10 programs and never changed output.
const corpusTolerated = s.missing.filter(m => m.blocks === 0 && rows.filter(r => r.tolerated.includes(m.syscall)).length >= 10).map(m => m.syscall);
const weak = compiled.filter(r => r.jitk === 'missing-syscall' && (r.guestBlocking || []).every(n => corpusTolerated.includes(n)));
add(`Strictness note: a missing call counts as blocking unless **this program's** experiment showed it tolerated. Programs without an experiment (Linux≠Node, reference errors, unstable baselines) therefore count even ubiquitous calls as blockers. **${weak.length}** of the ${s.jitk['missing-syscall'] || 0} missing-syscall programs are blocked only by calls that every corpus experiment tolerated (${corpusTolerated.join(', ') || 'none'}). Their real cause is elsewhere: ${weak.filter(r => (r.guestMissing || []).includes('tkill')).length} of them end in the same \`tkill(SIGABRT)\` abort as the mmap-hint programs. By Linux-vs-Node status: ${counts(weak.reduce((c: Record<string, number>, r) => { c[r.node || 'n/a'] = (c[r.node || 'n/a'] || 0) + 1; return c; }, {}))}.\n`);
add(`Unstable repeated Linux baselines: **${s.unstableLinux}**. Programs whose Linux baseline differs from Node, times out or is unstable give usage evidence but no causal claim. ENOSYS experiments use one syscall at a time; combinations are not tested. The jitk columns are lower bounds today, because most programs stop at the mmap hint before reaching later calls.\n`);

add('## Loader and packer gaps\n');
add(table(['Stock scriptc link (base 0x1000000): canonical packer', 'Programs'], ranked(s.stockLoader)) + '\n');
add(table(['jitk link layout (base 0x400000): canonical packer refusal', 'Programs'], ranked(s.loader)) + '\n');
add('The packer admits only static ET_EXEC PT_LOAD segments inside **[0x400000, 0x680000]** (2.5 MiB), with no page sharing between segments and no W+X. scriptc/Zig links at 0x1000000, so every unmodified ELF is refused before VM launch. These are loader results, not syscall results. Relinking at 0x400000 fixes placement. A refusal that remains under the jitk layout means the image plus .bss does not fit the 2.5 MiB window. Other layout limits: 32 MiB guest RAM, a fixed 128 KiB EL0 stack window (the ELF requests a 16 MiB GNU_STACK), no file mmap, and a read-only filesystem.\n');
add('Runner bug fixed in this round: the previous run built images with an incremental Cargo profile. Rust incremental compilation does not track the `.incbin` payload inside `global_asm!`, so every image silently carried the **first** payload while the constants (entry, segments) came from the new ELF. The resulting faults were artifacts. `guest.ts` now uses the canonical non-incremental profile and refuses any image whose `kernel.bin` does not contain the packed ELF byte for byte. This would also affect any other tool that reuses an incremental jitk target dir across payloads.\n');

add('## clone returning ENOSYS\n');
add('On Linux, every traced clone in a stable, Node-matching baseline is re-run with clone forced to ENOSYS: ' + counts(s.cloneFallback) + '. "survives" means stdout, stderr and exit are unchanged for that exact program. The changes come from Worker, subprocess and thread programs (T3). Unresolved labels make no claim.\n');
if (existsSync(join(root, 'fallback-summary.json'))) {
  const f = readJSON<{ cloneObserved: boolean; cloneENOSYSInjected: boolean; survives: boolean; nodeMatch: boolean; jitk?: Record<string, unknown> }>(join(root, 'fallback-summary.json'));
  add(`Supplemental allocator diagnostic (\`allocator-probe.ts\`, excluded from corpus counts). It keeps 400,000 objects live, which crosses the allocator's 1 MiB pre-fault threshold and makes the runtime try its optional helper thread. Linux: clone observed **${f.cloneObserved}**, ENOSYS injected **${f.cloneENOSYSInjected}**, output and exit preserved **${f.survives}**, matches Node **${f.nodeMatch}**. So on Linux the runtime survives clone returning ENOSYS. jitk, same ELF: ${f.jitk ? '`' + JSON.stringify(f.jitk) + '`' : 'not run'}. Reproduce with \`make fallback\`.\n`);
}

add('## scriptc versus Node\n');
add(counts(s.node) + '.\n');
const mismatches = rows.filter(r => !r.held && r.node && r.node !== 'match').sort((a, b) => a.name.localeCompare(b.name));
add(table(['Visible program', 'Linux vs Node'], mismatches.map(r => [r.name, r.node || ''])) + '\n');
add(`${rows.filter(r => r.held && r.node && r.node !== 'match').length} further non-matching programs are in the held-out subset and are not named. A mismatch means the scriptc ELF on Linux/musl and Node disagree on stdout or declared exit, and on stderr when the exit is 0. These are scriptc investigation candidates, not jitk results; triage is in SCRIPTC-GAPS.md. A reference-error means Node itself failed or did not match the corpus' declared exit, which is environmental (no network, read-only source, Alpine without subprocess tools).\n`);
const refusal = new Map<string, number>();
for (const r of rows.filter(r => r.build === 'refused')) for (const code of r.diagnostic.split('+')) refusal.set(code, (refusal.get(code) || 0) + 1);
if (refusal.size) add(table(['Compiler refusal code', 'Programs (codes overlap)'], Array.from(refusal.keys()).sort().map(k => [k, String(refusal.get(k))])) + '\n');

add('## What to grow first\n');
const hint = s.causes['divergent:mmap:-22'] || 0;
const t12hint = compiled.filter(r => t12(r) && r.cause === 'divergent:mmap:-22').length;
const control = s.causes['stdout-control-byte'] || 0;
add(`1. **mmap address hints (a registered-syscall semantic gap, not a new syscall).** Treat a non-NULL hint without MAP_FIXED as advisory, as Linux does. This is the first cause for **${hint}** compiled programs (${t12hint} T1/T2). Nothing else is reachable until it is fixed.`);
add(`2. **Image placement and size.** Either accept scriptc's stock base (0x1000000) or keep the relink adapter as a pinned build step; ${(s.stockLoader['segment outside payload arena'] || 0)} stock ELFs are refused today.`);
add(`3. **Transport.** Non-ASCII stdout terminates **${control}** programs. Production stdout needs a byte-exact framing.`);
const syscalls = missing.filter(m => !corpusTolerated.includes(m.syscall)).filter(m => m.single > 0 || m.jitkBlocks > 0 || m.t1t2Blocks > 0).sort((a, b) =>
  (b.jitkSingle + b.single) - (a.jitkSingle + a.single) || b.t1t2Blocks - a.t1t2Blocks || b.blocks - a.blocks).slice(0, 15);
add('4. **Syscalls**, ranked by single-blocker programs (jitk plus Linux counterfactual), then by T1/T2 programs changed under ENOSYS. Corpus-tolerated calls are excluded:\n');
add(table(['Rank', 'Syscall', 'Single (jitk + Linux)', 'T1/T2 changed', 'All changed', 'Linux seen'],
  syscalls.map((m, i) => [String(i + 1), m.syscall, String(m.jitkSingle + m.single), String(m.t1t2Blocks), String(m.blocks), String(m.programs)])) + '\n');
add('`sched_getaffinity`, `madvise` and `prlimit64` appear in almost every program but are tolerated: ENOSYS leaves the output unchanged, so they belong in the grow loop\'s tolerated set, not its targets. A zero causal count can also mean a busy-wait fallback, an unexercised path, or no stable baseline; it does not prove a syscall unnecessary. Threads, futex and epoll stay in the T3/T4 phase.\n');

add('## Held-out subset\n');
add(`A private seed in \`.work/split-seed\` (mode 0600) selects **${s.heldout}** of ${s.total} entries (SHA256(seed, NUL, name), first 32 bits mod 100 < 20). Public \`census.csv\` and this file contain only visible names. Aggregate counts include held-out programs. \`summary.json\` records only a seed commitment. The grow loop's proposer gets visible evidence only; the trusted gate runs \`make heldout\` (\`run --id heldout --selection heldout\`). Never mount \`.work/\`, the corpus snapshot or the seed into a proposer checkout.\n`);

add('## Reproduction and disk\n');
add('`make -C arch/jitk/scriptc-corpus census` (or `run`) resumes the full pipeline: build, Node, Linux, ENOSYS experiments, packer, jitk. It then runs the allocator diagnostic. `make report` regenerates this file; `make test` checks the parser, classifier, tier, split and embedding invariants; `make audit` cross-checks journal, summary, CSV and pins. Per-program ELFs, traces and images are deleted after each receipt; receipts, journals and bounded mismatch snippets stay in ignored `.work/`.\n');
add('Disk before:\n```text\n' + s.diskBefore.trim() + '\n```\n\nDisk after:\n```text\n' + s.diskAfter.trim() + '\n```\n');
add('Neither Docker image was rebuilt or retagged; no prune ran. At most three census containers ran at once (two oracle, one Node).\n');
writeFileSync(join(root, 'RESULTS.md'), lines.join('\n'));
console.log('wrote RESULTS.md');
