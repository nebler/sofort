// The guest's memory syscalls per task program, from a diagnostic snapshot
// whose kernel is built with `--features heap-trace` (kernel/src/heap_trace.rs):
// every mmap, munmap, mremap, brk and madvise call, the pages mapped in the
// mmap window after it, and the window's layout at the first ENOMEM.
//
//   JITK_SHARD_SNAPSHOT=<heap-trace snapshot> $JITK_NODE bench/v1/harness/heap-trace.ts \
//     --class glue-16m [--out trace.json] [task-id[:program-number]...]
//
// Prints one summary line per program: calls by kind, mapped-pages peak, the
// window's high-water, and at an ENOMEM the request, the free pages and the
// largest free run of the window.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ledger, Replay } from './replay.ts';
import { loadTask } from './task.ts';
import type { ResolvedProvider } from './contract.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const memoryClass = flag('--class') ?? 'glue-16m';
const out = flag('--out');
const selected = argv.length
  ? argv
  : ['t1-issue-triage', 't2-ci-triage', 't3-crm-join', 't4-otel-rollup', 't5-openapi'];

const OPS = ['', 'mmap', 'munmap', 'mremap', 'brk', 'madvise', '', 'mremap-ret'] as const;
type Rec = { op: string; a: number; b: number; c: number };
export type Trace = {
  summary: Record<string, number>;
  records: Rec[];
  oomMapped?: number[];
};
function decode(logs: string[]): Trace | undefined {
  const parts = logs.filter(l => l.startsWith('HT:'));
  if (!parts.length) return undefined;
  const bytes = (tag: string) =>
    Buffer.concat(
      parts.filter(l => l.startsWith('HT:' + tag + ':')).map(l => Buffer.from(l.slice(tag.length + 4), 'hex')),
    );
  const s = bytes('S');
  const names = [
    'records',
    'dropped',
    'mmap',
    'munmap',
    'mremap',
    'brk',
    'madvise',
    'peakLivePages',
    'enomem',
    'enomemRequestPages',
    'enomemLivePages',
    'windowStart',
    'windowEnd',
    'heapStart',
  ];
  const summary = Object.fromEntries(names.map((n, i) => [n, Number(s.readBigUInt64LE(i * 8))]));
  const t = bytes('T');
  const records: Rec[] = [];
  for (let i = 0; i < t.length; i += 8) {
    const w = t.readBigUInt64LE(i);
    records.push({
      op: OPS[Number(w >> 60n)] || '?',
      a: Number((w >> 40n) & 0xfffffn),
      b: Number((w >> 20n) & 0xfffffn),
      c: Number(w & 0xfffffn),
    });
  }
  const trace: Trace = { summary, records };
  if (summary.enomem) {
    const bm = Buffer.concat([0, 1, 2, 3].map(i => bytes('B' + i)));
    const mapped: number[] = [];
    for (let p = summary.windowStart / 4096; p < summary.windowEnd / 4096; p++) {
      if ((bm[p >> 3]! >> (p & 7)) & 1) mapped.push(p);
    }
    trace.oomMapped = mapped;
  }
  return trace;
}

/** The window at the first ENOMEM: free pages, its free runs (largest first), and a 1-char-per-16-pages map. */
export function layout(t: Trace) {
  const start = t.summary.windowStart / 4096,
    end = t.summary.windowEnd / 4096;
  const mapped = new Set(t.oomMapped ?? []);
  const runs: number[] = [];
  let run = 0;
  for (let p = start; p < end; p++) {
    if (mapped.has(p)) {
      if (run) runs.push(run);
      run = 0;
    } else run++;
  }
  if (run) runs.push(run);
  runs.sort((x, y) => y - x);
  let map = '';
  for (let p = start; p < end; p += 16) {
    let n = 0;
    for (let q = p; q < Math.min(p + 16, end); q++) n += mapped.has(q) ? 1 : 0;
    map += n === 0 ? '.' : n === 16 ? '#' : '+';
  }
  return {
    windowPages: end - start,
    mappedPages: mapped.size,
    freePages: end - start - mapped.size,
    freeRuns: runs.length,
    largestFreeRuns: runs.slice(0, 8),
    map,
  };
}

type ExecutorModule = {
  SandboxPool: new (b: unknown, warm: number, max: number) => { drain(): Promise<void>; close(): Promise<void> };
  MicroVMExecutor: new (
    pool: unknown,
    policy: () => 'allow',
    timeout: number,
  ) => {
    execute(code: string, p: ResolvedProvider[]): Promise<{ result: unknown; error?: string; logs?: string[] }>;
  };
};
type ShardModule = {
  ShardBackend: new (o: {
    binary: string;
    snapshot: string;
    slots: number;
    memoryClass: string;
    onMetrics(m: { heapPeakBytes?: number }): void;
  }) => {
    ready: Promise<void>;
    close(): Promise<void>;
  };
};

const build = new URL('../../../executor/build/', import.meta.url);
const { ShardBackend } = (await import(new URL('shard-backend.js', build).href)) as ShardModule;
const { MicroVMExecutor, SandboxPool } = (await import(new URL('executor.js', build).href)) as ExecutorModule;
const binary = process.env.JITK_SHARD_BINARY,
  snapshot = process.env.JITK_SHARD_SNAPSHOT;
if (!binary || !snapshot) throw Error('set JITK_SHARD_BINARY and JITK_SHARD_SNAPSHOT (a heap-trace snapshot)');
const peaks: number[] = [];
const backend = new ShardBackend({
  binary,
  snapshot,
  slots: 1,
  memoryClass,
  onMetrics: m => {
    if (m.heapPeakBytes !== undefined) peaks.push(m.heapPeakBytes);
  },
});
const pool = new SandboxPool(backend, 0, 1);
const ex = new MicroVMExecutor(pool, () => 'allow', 60000);
const results: unknown[] = [];
try {
  await backend.ready;
  for (const sel of selected) {
    const [id, only] = sel.split(':');
    const task = await loadTask(join(here, '../tasks', id!));
    for (const [i, p] of task.programs.entries()) {
      if (only && Number(only) !== i + 1) continue;
      const ledger = new Ledger();
      const replay = new Replay(task.spec, task.responses, 0);
      const r = await ex.execute(p.code, replay.providers(ledger));
      await pool.drain();
      const ok = r.error === undefined && task.oracle(JSON.parse(JSON.stringify(r.result ?? null))).ok;
      const trace = decode(r.logs ?? []);
      const s = trace?.summary ?? {};
      const row = {
        task: id,
        program: i + 1,
        ok,
        error: r.error?.slice(0, 120),
        heapPeakBytes: peaks.at(-1),
        ...s,
        ...(trace?.oomMapped ? { oom: layout(trace) } : {}),
      };
      console.log(JSON.stringify({ ...row, oom: row.oom ? { ...row.oom, map: undefined } : undefined }));
      results.push({ ...row, records: trace?.records });
    }
  }
} finally {
  await pool.close();
  await backend.close();
}
if (out) writeFileSync(out, JSON.stringify(results) + '\n');
