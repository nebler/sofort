import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readJSON, check } from './lib.ts';

interface Missing { syscall: string; programs: number; t1t2: number; blocks: number; t1t2Blocks: number; single: number }
interface Tier { tier: string; programs: number; compiled: number; linuxComplete: number; nodeMatch: number; jitkPass: number }
interface Summary {
  total: number; completed: number; complete: boolean; heldout: number;
  stages: Record<string, number>; node: Record<string, number>; jitk: Record<string, number>;
  tiers: Tier[]; missing: Missing[]; limitations: Record<string, number>; loader: Record<string, number>;
  cloneFallback: Record<string, number>; unstableLinux: number; diskBefore: string; diskAfter: string;
}
interface Row { name: string; held: boolean; build: string; diagnostic: string; node?: string; tier: string; injection?: string }
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
const lines: string[] = [];
function add(text: string): void { lines.push(text); }
function table(header: string[], body: string[][]): string {
  return '| ' + header.join(' | ') + ' |\n| ' + header.map(() => '---').join(' | ') + ' |\n' + body.map(r => '| ' + r.join(' | ') + ' |').join('\n');
}
function counts(c: Record<string, number>): string { return Object.keys(c).sort().map(k => k + ': ' + c[k]).join('; '); }
add('# scriptc 0.4.5 corpus on jitk\n');
add('Measured on 2026-10-26, macOS arm64 host, static aarch64-musl payloads in the existing pinned Alpine oracle. Corpus: **v0.4.5 / 4ee477d11eb9a71f0a018e5f5bed171a954fc2f7**, selected with upstream\'s flat-entry plus directory-main convention. No corpus source was changed.\n');
add(`**Today: ${s.jitk.pass || 0}/${s.stages.compiled || 0} compiled programs pass jitk (${((s.jitk.pass || 0) / (s.stages.compiled || 1) * 100).toFixed(2)}%).** ${s.total} corpus entries were processed. Build outcomes: ${counts(s.stages)}. Linux-versus-Node: ${counts(s.node)}. Jitk outcomes: ${counts(s.jitk)}.\n`);
add('## Tiers\n');
add(table(['Tier', 'Entries', 'Compiled', 'Linux completed', 'Node match', 'jitk pass'], s.tiers.map(t => [t.tier, String(t.programs), String(t.compiled), String(t.linuxComplete), String(t.nodeMatch), String(t.jitkPass)])) + '\n');
add('Tiering is conservative workload classification from source features and observed calls: T1 compute/stdio; T2 files/timers/clocks; T3 Workers, threads, subprocesses and async rename; T4 networking. Optional allocator probes do not promote a compute workload. Refused programs have provisional source-only tiers. Linux completed means no deadline expiry, not necessarily successful exit or equality.\n');
add('## Loader and transport gaps\n');
add(table(['Canonical packer refusal', 'Programs'], Object.keys(s.loader).map(k => [k, String(s.loader[k])])) + '\n');
add('The unmodified scriptc/Zig linker places PT_LOAD at **0x1000000**, while jitk admits static ET_EXEC segments only in **[0x400000, 0x680000]**. `001-hello.ts` already fails this check. Every compiled ELF is passed through the canonical packer, including every T1/T2 program and all programs with apparently covered syscall sets. A packer rejection ends that attempt before VMM launch; these are measured loader refusals, not guest crashes or missing-syscall failures. No source relinking or kernel edits were used to manufacture a pass.\n');
add('Other current constraints remain: 32 MiB guest RAM; no shared PT_LOAD pages; loaded PHDR requirement; writable filesystem absent; stdout limited to printable ASCII plus LF and complete framing. Developer grow-trace can recover fd2 bytes, but arbitrary-byte production transport requires separate work. A successful future loader fix must be retested rather than assumed sufficient.\n');
add('## Missing syscall frequency and ENOSYS experiments\n');
add('Each row counts programs, not calls. "Seen" includes all traced payloads; "changed" counts only stable, Node-matching Linux baselines whose stdout/stderr/exit changed when that one syscall returned ENOSYS. "Single" means the only independently observed missing-syscall blocker, not the only remaining kernel incompatibility. Initial launcher execve is excluded; real child execve injection starts at occurrence 2. Unstable, failed-reference and already mismatching programs supply usage evidence but no causal blocker claim.\n');
add(table(['Syscall', 'Seen', 'T1/T2 seen', 'Changed', 'T1/T2 changed', 'Single'], s.missing.map(m => [m.syscall, String(m.programs), String(m.t1t2), String(m.blocks), String(m.t1t2Blocks), String(m.single)])) + '\n');
add(`Repeated Linux baselines with unstable output/exit: **${s.unstableLinux}**. This matters for PIDs, paths, timing, random values and child-process diagnostics. Single-syscall injection measures fallback behavior in Linux; it does not establish that jitk can run the program or that combinations of ENOSYS returns compose safely.\n`);
add('## Registered syscall limits\n');
add(table(['Shape observed (conservative parser)', 'Programs'], Object.keys(s.limitations).sort().map(k => [k, String(s.limitations[k])])) + '\n');
add('The 26 slots include clock_gettime, but only the kernel\'s supported clock IDs are equivalent. rt_sigaction, rt_sigprocmask and mremap are registered ENOSYS stubs. ppoll handles only fds 0/1/2, at most 16 descriptors and no non-null sigmask. The mmap shape bucket flags protected/fixed/file mappings and conservative extra-flag candidates; it is not an ENOSYS blocker count. The present mmap handler accepts only NULL-address, read/write anonymous non-fixed allocations. Filesystem syscalls are read-only and need matching resources.\n');
add('## clone / allocator fallback\n');
add(counts(s.cloneFallback) + '.\n');
add('For every traced clone in a stable Node-matching baseline, the driver injects ENOSYS and compares all output bytes and exit. "survives" establishes fallback for that exact program, while "changes-output-or-exit" establishes a dependency under this experiment. Worker/subprocess failures must not be generalized to allocator helpers. Linux-node-mismatch, timeout and unstable-baseline labels are unresolved. Since the default ELFs fail the loader, none of this is a direct jitk clone-survival result.\n');
add('## scriptc versus Node\n');
add(counts(s.node) + '.\n');
const mismatches = rows.filter(r => !r.held && r.node && r.node !== 'match');
add(table(['Visible program', 'Reference outcome'], mismatches.map(r => [r.name, r.node || ''])) + '\n');
add('These are scriptc investigation candidates, not jitk mismatches. Node runs as Linux Node 24.22.0 from the pinned existing bookworm image; payloads use musl in the pinned Alpine image. Both use the same closed stdin, environment and fresh writable cwd. Networking is disabled, /tmp is private container tmpfs, corpus source/fixtures are read-only and Node dependencies come from the recorded installed checkout. libc-sensitive formatting, missing Alpine subprocess tools, source-directory writes, package resolution, temporary names and nondeterministic timing need environmental triage. Node reference errors are not compiler bugs. Nonzero-exit corpus cases intentionally compare stdout/declared exit, following upstream; Linux-versus-jitk always compares stderr too. See SCRIPTC-GAPS.md for minimal repros and qualifications.\n');
const refusal = new Map<string, number>();
for (const r of rows.filter(r => r.build === 'refused')) for (const code of r.diagnostic.split('+')) refusal.set(code, (refusal.get(code) || 0) + 1);
add(table(['Compiler refusal code', 'Programs (codes can overlap)'], Array.from(refusal.keys()).sort().map(k => [k, String(refusal.get(k))])) + '\n');
add('## What to grow first\n');
add('**Fix or adapt the default ELF address/layout first.** Until then, growing a syscall unlocks zero unmodified corpus ELFs. Keep the compiler flags/ELF hashes explicit if choosing a relink adapter; that is a separate baseline.\n');
const ranked = s.missing.filter(m => m.t1t2Blocks > 0).sort((a,b) => b.single - a.single || b.t1t2Blocks - a.t1t2Blocks);
add(table(['Rank', 'Syscall', 'T1/T2 changed', 'Single (all tiers)'], ranked.map((m,i) => [String(i+1), m.syscall, String(m.t1t2Blocks), String(m.single)])) + '\n');
add('Next address mmap address/protection semantics and memory budget, then timer sleeps (nanosleep/clock_nanosleep), pipe2 plus pollable descriptors/wider ppoll, entropy and clock variants as the table justifies. Writable filesystem operations form a separate prerequisite for filesystem cases. A zero causal ENOSYS count may mean a fallback (including busy waiting), lack of stable cases or an unexercised path; it is not proof that a syscall is unnecessary. Threads/futex/epoll remain the T3/T4 phase.\n');
add('## Reproduction and disk\n');
add('Run `make -C arch/jitk/scriptc-corpus census` (or `run`); `make ... test` checks parser/tier/split invariants. Native binaries, manifests, journals, injection hashes and private mismatch snippets live only under ignored `.work/`. Per-program ELF/LLVM/trace/image artifacts are removed after sealing receipts. No raw output is committed. `summary.json` is aggregate evidence; `census.csv` includes only visible program status/call names.\n');
add(`The private seeded held-out subset contains **${s.heldout}** entries. Its seed and raw results stay outside proposer inputs. Use \`--selection visible\` and \`--selection heldout\` with separate run IDs; see README.md.\n`);
add('Disk before:\n```text\n' + s.diskBefore + '\n```\n\nDisk after:\n```text\n' + s.diskAfter + '\n```\n');
add('Disk is checked every 100 completions; the runner stops below 15 GiB. Containers use init-based orphan reaping and are recycled after each 100-program batch. Neither Docker image was rebuilt/retagged, no Docker prune ran, no kernel/grow files changed and no syscalls were grown.\n');
add('Aggregate Makefile recipe needed (not added): `+@$(MAKE) -C "$(ROOT)/scriptc-corpus" census` under a dedicated `scriptc-corpus: tools` target.\n');
writeFileSync(join(root, 'RESULTS.md'), lines.join('\n'));
console.log('wrote RESULTS.md');
