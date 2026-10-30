// Tool replay (SPEC-V1 §3): every tool a task declares answers from the
// task's recorded responses, after the recorded latency.
//
// Matching policy (deterministic):
// 1. Key = namespace + '.' + tool + ' ' + canonical(args), where canonical is
//    JSON with object keys sorted recursively and undefined members dropped
//    (what the call looks like after any executor's JSON boundary).
// 2. Several recordings under one key are served in recorded order per
//    attempt: the k-th identical call within one attempt gets recording
//    k mod n (so a re-fetched page gets the same data every attempt).
// 3. No recording under the key:
//    - match 'strict' (default): the call is UNMATCHED. The guest's call
//      rejects with "replay: no recorded response for ns.tool(args)", the
//      ledger counts it, and the attempt fails (errorClass 'unmatched')
//      whatever the oracle says.
//    - match 'nearest': among the tool's recordings, the one sharing the most
//      top-level argument fields (by canonical value), ties to the earliest
//      recorded; counted as `fallbacks`, not unmatched. No recording for the
//      tool at all is still unmatched.
// 4. A tool name the task does not declare cannot be called in-process (it is
//    not in fns); over HTTP it is answered 404 and counted as `forbidden`.
//
// Latency: the recorded latencyMs x scale is waited with a timer (scale 0:
// no timer, answered on the next microtask). The response is a fresh
// JSON.parse of the recorded text per call. Tool time per attempt is the
// union of in-flight call intervals (`toolMs`, used for executor overhead:
// parallel calls are not double-counted) and their plain sum (`toolSumMs`).
import { createServer, type Server } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { RecordedCall, ResolvedProvider, TaskSpec, ToolEndpoint } from './contract.ts';

export function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value)) ?? 'null';
}
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(x => (x === undefined ? null : sortKeys(x)));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined && typeof x !== 'function') out[k] = sortKeys(x);
    }
    return out;
  }
  return v;
}

interface Entry { text: string | undefined; error?: string; latencyMs: number; bytes: number; args: unknown[] }

/** Per-attempt accounting. */
export class Ledger {
  calls = 0;
  bytes = 0;
  unmatched = 0;
  fallbacks = 0;
  forbidden = 0;
  toolErrors = 0;
  toolSumMs = 0;
  unmatchedKeys: string[] = [];
  private seen = new Map<string, number>();
  private inFlight = 0;
  private busySince = 0;
  private busyMs = 0;
  get toolMs(): number { return this.busyMs + (this.inFlight ? performance.now() - this.busySince : 0); }
  next(key: string): number { const k = this.seen.get(key) ?? 0; this.seen.set(key, k + 1); return k; }
  begin(): number { const t = performance.now(); if (this.inFlight++ === 0) this.busySince = t; return t; }
  end(start: number): void {
    const t = performance.now();
    this.toolSumMs += t - start;
    if (--this.inFlight === 0) this.busyMs += t - this.busySince;
  }
}

export class Replay {
  private byKey = new Map<string, Entry[]>();
  private byTool = new Map<string, Entry[]>();
  readonly declared = new Map<string, Set<string>>();
  readonly sizeWarnings: string[] = [];
  readonly scale: number;
  readonly match: 'strict' | 'nearest';
  constructor(spec: TaskSpec, responses: RecordedCall[], scale = 1, match: 'strict' | 'nearest' = spec.match ?? 'strict') {
    this.scale = scale;
    this.match = match;
    if (!(scale >= 0)) throw Error('latency scale must be >= 0');
    for (const p of spec.providers ?? []) this.declared.set(p.name, new Set(Object.keys(p.tools)));
    for (const r of responses) {
      if (!this.declared.get(r.namespace)?.has(r.tool)) throw Error(`${spec.id}: recorded call to undeclared ${r.namespace}.${r.tool}`);
      const text = r.error === undefined ? JSON.stringify(r.response ?? null) : undefined;
      const bytes = text === undefined ? 0 : Buffer.byteLength(text);
      if (text !== undefined && r.bytes !== undefined && r.bytes !== bytes && this.sizeWarnings.length < 5)
        this.sizeWarnings.push(`${r.namespace}.${r.tool}: recorded bytes ${r.bytes}, response is ${bytes}`);
      const e: Entry = { text, error: r.error, latencyMs: r.latencyMs, bytes, args: r.args };
      const key = `${r.namespace}.${r.tool} ${canonical(r.args)}`;
      (this.byKey.get(key) ?? this.byKey.set(key, []).get(key)!).push(e);
      const tool = `${r.namespace}.${r.tool}`;
      (this.byTool.get(tool) ?? this.byTool.set(tool, []).get(tool)!).push(e);
    }
  }

  private lookup(ns: string, tool: string, args: unknown[], ledger: Ledger): Entry | undefined {
    const argText = canonical(args);
    const key = `${ns}.${tool} ${argText}`;
    const list = this.byKey.get(key);
    if (list) return list[ledger.next(key) % list.length];
    const candidates = this.match === 'nearest' ? this.byTool.get(`${ns}.${tool}`) : undefined;
    if (!candidates?.length) return undefined;
    const want = sortKeys(args[0]) as Record<string, unknown> | undefined;
    let best = candidates[0], score = -1;
    for (const c of candidates) {
      const have = sortKeys(c.args[0]) as Record<string, unknown> | undefined;
      let s = 0;
      if (want && have && typeof want === 'object' && typeof have === 'object')
        for (const k of Object.keys(want)) if (k in have && canonical(want[k]) === canonical(have[k])) s++;
      if (s > score) { best = c; score = s; }
    }
    ledger.fallbacks++;
    return best;
  }

  /** One tool call, accounted to `ledger`. Resolves with a fresh copy of the
   *  recorded response or rejects with the recorded/unmatched error. */
  async call(ns: string, tool: string, args: unknown[], ledger: Ledger): Promise<unknown> {
    const start = ledger.begin();
    ledger.calls++;
    try {
      const e = this.lookup(ns, tool, args, ledger);
      if (!e) {
        ledger.unmatched++;
        const what = `${ns}.${tool}(${canonical(args).slice(1, -1).slice(0, 200)})`;
        if (ledger.unmatchedKeys.length < 3) ledger.unmatchedKeys.push(what);
        throw Error('replay: no recorded response for ' + what);
      }
      const wait = e.latencyMs * this.scale;
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      if (e.error !== undefined) { ledger.toolErrors++; throw Error(e.error); }
      ledger.bytes += e.bytes;
      return JSON.parse(e.text!);
    } finally {
      ledger.end(start);
    }
  }

  /** The providers for one attempt: every declared tool, accounted to `ledger`. */
  providers(ledger: Ledger): ResolvedProvider[] {
    return [...this.declared].map(([name, tools]) => {
      const fns: ResolvedProvider['fns'] = Object.create(null);
      for (const tool of tools) fns[tool] = (...args: unknown[]) => this.call(name, tool, args, ledger);
      return { name, fns };
    });
  }
}

/** HTTP mode (contract.ts ToolEndpoint): POST /call on 127.0.0.1, routed to
 *  the providers registered for an executionId. Calls the registered fns, so
 *  accounting is the same as in-process. Calls to undeclared tools are 404
 *  and counted in `forbidden` (the driver adds the delta to the attempt row,
 *  exact in sequential cells). */
export interface ToolServer extends ToolEndpoint {
  forbidden: number;
  close(): Promise<void>;
}
export async function startToolServer(): Promise<ToolServer> {
  const token = randomBytes(16).toString('hex');
  const registry = new Map<string, ResolvedProvider[]>();
  const state = { forbidden: 0 };
  const server: Server = createServer((req, res) => {
    const reply = (status: number, body: unknown) => {
      const text = JSON.stringify(body);
      res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
      res.end(text);
    };
    if (req.method !== 'POST' || req.url !== '/call') return reply(404, { error: 'POST /call only' });
    if (req.headers.authorization !== 'Bearer ' + token) return reply(401, { error: 'bad token' });
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: any;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(400, { error: 'bad json' }); }
      if (!body || typeof body.executionId !== 'string' || typeof body.namespace !== 'string' || typeof body.tool !== 'string' || !Array.isArray(body.args))
        return reply(400, { error: 'body must be {executionId, namespace, tool, args[]}' });
      const providers = registry.get(body.executionId);
      if (!providers) return reply(404, { error: 'unknown executionId' });
      const fn = providers.find(p => p.name === body.namespace)?.fns;
      if (!fn || !Object.hasOwn(fn, body.tool)) { state.forbidden++; return reply(404, { error: `undeclared tool ${body.namespace}.${body.tool}` }); }
      fn[body.tool]!(...body.args).then(
        (result: unknown) => reply(200, { result: result === undefined ? null : result }),
        (e: unknown) => reply(200, { error: e instanceof Error ? e.message : String(e) }),
      );
    });
  });
  server.keepAliveTimeout = 60_000;
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('tool server address');
  return {
    url: `http://127.0.0.1:${address.port}`,
    token,
    get forbidden() { return state.forbidden; },
    register(providers: ResolvedProvider[]) {
      const executionId = randomUUID();
      registry.set(executionId, providers);
      return { executionId, release: () => { registry.delete(executionId); } };
    },
    close: () => new Promise<void>(r => { server.closeAllConnections(); server.close(() => r()); }),
  };
}
