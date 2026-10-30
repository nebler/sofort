// The child side of isolate.ts: runs one adapter, answers the harness over IPC.
// Tool calls go back to the harness, which owns replay and its accounting.
import { resolveAdapter } from './run.ts';
import { startToolServer } from './replay.ts';
import type { BenchExecutor, ResolvedProvider } from './contract.ts';

const send = (m: Record<string, unknown>) => process.send!(m);
const adapter = await resolveAdapter(process.argv[2]!);
const executors = new Map<number, BenchExecutor>();
let exSeq = 0, callSeq = 0;
const returns = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let server: Awaited<ReturnType<typeof startToolServer>> | undefined;

function proxy(exec: number, p: { name: string; prelude?: string; tools: string[] }): ResolvedProvider {
  const fns: ResolvedProvider['fns'] = {};
  for (const tool of p.tools) fns[tool] = (...args: unknown[]) => new Promise((resolve, reject) => {
    const call = ++callSeq; returns.set(call, { resolve, reject });
    send({ t: 'call', exec, call, ns: p.name, tool, args });
  });
  return { name: p.name, fns, ...(p.prelude === undefined ? {} : { prelude: p.prelude }) };
}

async function handle(m: any): Promise<unknown> {
  switch (m.t) {
    case 'meta': return { name: adapter.name, isolation: adapter.isolation, where: adapter.where, available: await adapter.available?.() };
    case 'provenance': return adapter.provenance();
    case 'open': {
      if (m.opts.toolServer && !server) server = await startToolServer();
      const ex = await adapter.open({ concurrency: m.opts.concurrency, memoryClass: m.opts.memoryClass, timeoutMs: m.opts.timeoutMs, toolEndpoint: m.opts.toolServer ? server : undefined });
      const id = ++exSeq; executors.set(id, ex); return id;
    }
    case 'exec': {
      const ex = executors.get(m.ex);
      if (!ex) throw Error('executor closed');
      const providers = m.providers.map((p: any) => proxy(m.exec, p));
      return ex.execute(m.code, m.legacy ? providers[0].fns : providers);
    }
    case 'close': { const ex = executors.get(m.ex); executors.delete(m.ex); await ex?.close(); return null; }
    default: throw Error('unknown request ' + m.t);
  }
}

process.on('message', (m: any) => {
  if (m.t === 'ret') {
    const r = returns.get(m.call); returns.delete(m.call);
    if (r) { if (m.error !== undefined) r.reject(Error(m.error)); else r.resolve(m.value); }
    return;
  }
  handle(m).then(value => send({ t: 'reply', id: m.id, value }), e => send({ t: 'reply', id: m.id, error: e instanceof Error ? e.message : String(e) }));
});
process.on('disconnect', () => process.exit(0));
