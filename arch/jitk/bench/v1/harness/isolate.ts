// Each adapter in its own Node process (the default; --in-process turns it off).
// Adapters load native addons (isolated-vm, Hyperlight) and spawn engines
// (Sofort, workerd); in one process they share a heap, a GC and signal
// handlers, and isolated-vm next to Sofort's engine crashes Node (SIGSEGV).
// A separate process also keeps each adapter's CPU apart.
//
// The child (adapter-host.ts) runs the real adapter. Tools stay here, in the
// harness: the child forwards every tool call over IPC, so replay accounting
// (latency, bytes, matching) is unchanged. The IPC hop is the same for every
// adapter and lands in executor overhead.
import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Adapter, BenchExecutor, BenchResult, OpenOptions, ResolvedProvider } from './contract.ts';

const hostFile = fileURLToPath(new URL('./adapter-host.ts', import.meta.url));
type Fns = Record<string, (...args: unknown[]) => Promise<unknown>>;
type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };

class Host {
  child!: ChildProcess;
  private seq = 0;
  private waiting = new Map<number, Pending>();
  readonly calls = new Map<number, ResolvedProvider[]>();
  exited?: string;
  readonly ref: string;
  constructor(ref: string) { this.ref = ref; this.spawn(); }
  spawn() {
    this.exited = undefined;
    this.child = fork(hostFile, [this.ref], { execArgv: ['--no-node-snapshot', '--no-warnings'], serialization: 'advanced', stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    const child = this.child;
    child.on('message', (m: any) => void this.message(m));
    child.once('exit', (code, signal) => {
      if (this.child !== child) return;
      this.exited = `adapter process ${this.ref} exited (${code ?? signal})`;
      for (const w of this.waiting.values()) w.reject(Error(this.exited));
      this.waiting.clear();
    });
  }
  request(m: Record<string, unknown>): Promise<any> {
    if (this.exited) return Promise.reject(Error(this.exited));
    return new Promise((resolve, reject) => { const id = ++this.seq; this.waiting.set(id, { resolve, reject }); this.child.send({ ...m, id }); });
  }
  private async message(m: any) {
    if (m.t === 'reply') {
      const w = this.waiting.get(m.id); this.waiting.delete(m.id);
      if (!w) return;
      if (m.error !== undefined) w.reject(Error(m.error)); else w.resolve(m.value);
      return;
    }
    if (m.t !== 'call') return;
    const providers = this.calls.get(m.exec);
    const fn = providers?.find(p => p.name === m.ns)?.fns[m.tool];
    let reply: Record<string, unknown>;
    if (!fn) reply = { error: `unknown tool ${m.ns}.${m.tool}` };
    else try { reply = { value: await fn(...m.args) }; } catch (e) { reply = { error: e instanceof Error ? e.message : String(e) }; }
    if (!this.exited) this.child.send({ t: 'ret', call: m.call, ...reply });
  }
  kill() { this.child.kill('SIGKILL'); }
}

const hosts = new Set<Host>();
process.once('exit', () => { for (const h of hosts) h.kill(); });

/** The adapter named `ref`, run in its own process. */
export async function isolatedAdapter(ref: string): Promise<Adapter> {
  const host = new Host(ref); hosts.add(host);
  const meta = await host.request({ t: 'meta' });
  let provenance: Record<string, string> = {};
  let execSeq = 0;
  return {
    name: meta.name, isolation: meta.isolation, where: meta.where,
    available: () => meta.available,
    provenance: () => ({ ...provenance, process: 'own Node process (--no-node-snapshot), tools over IPC' }),
    async open(opts: OpenOptions): Promise<BenchExecutor> {
      // A crashed adapter process (a memory bomb, a native fault) is replaced at the next cell.
      if (host.exited) { host.spawn(); await host.request({ t: 'meta' }); }
      const ex = await host.request({ t: 'open', opts: { concurrency: opts.concurrency, memoryClass: opts.memoryClass, timeoutMs: opts.timeoutMs, toolServer: !!opts.toolEndpoint } });
      provenance = await host.request({ t: 'provenance' });
      return {
        async execute(code, providersOrFns): Promise<BenchResult> {
          const legacy = !Array.isArray(providersOrFns);
          const providers: ResolvedProvider[] = legacy ? [{ name: 'codemode', fns: providersOrFns as Fns }] : providersOrFns as ResolvedProvider[];
          const exec = ++execSeq; host.calls.set(exec, providers);
          try {
            return await host.request({ t: 'exec', ex, exec, code, legacy, providers: providers.map(p => ({ name: p.name, prelude: p.prelude, tools: Object.keys(p.fns) })) });
          } catch (e) {
            return { result: undefined, logs: [], error: e instanceof Error ? e.message : String(e), errorClass: 'sandbox' };
          } finally { host.calls.delete(exec); }
        },
        async close() { await host.request({ t: 'close', ex }).catch(() => {}); },
        pids: () => (host.exited || !host.child.pid ? [] : [host.child.pid]),
      };
    },
  };
}
