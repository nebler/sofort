// Adapter sketch. A production supervisor must sandbox/limit the signed worker.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export type Call = { t: 'call'; id: number; ns: string; fn: string; args: unknown[] };
export type Provider = { name: string; fns: Record<string, (...a: any[]) => any> };
export interface Backend {
  execute(body: string, providers: Provider[], timeoutMs: number): Promise<unknown>;
}
export class HyperlightBackend implements Backend {
  constructor(private worker: string,
    private authorize: (call: Call) => Promise<void>) {}
  execute(body: string, providers: Provider[], timeoutMs = 1000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // One execution per process enforces fresh hardware-VM identity on HVF.
      const p = spawn(this.worker, ['sidecar'], { stdio: ['pipe', 'pipe', 'pipe'], env: {} });
      let settled = false, calls = 0, bytes = 0, inFlight = false;
      const finish = (error?: unknown, result?: unknown) => {
        if (settled) return;
        settled = true; clearTimeout(timer); p.kill('SIGKILL');
        error ? reject(error) : resolve(result);
      };
      const timer = setTimeout(() => finish(new Error('deadline')), timeoutMs);
      p.on('error', finish);
      p.on('exit', () => { if (!settled) finish(new Error('worker exited')); });
      p.stderr.on('data', () => {}); // Drain; bounded diagnostics belong in supervisor.
      // Cap before readline buffers an attacker-controlled unbounded line.
      p.stdout.on('data', b => {
        bytes += b.length;
        if (bytes > 1024 * 1024) finish(new Error('output budget'));
      });
      createInterface({ input: p.stdout, crlfDelay: Infinity }).on('line', async line => {
        try {
          if (settled) return;
          const m = JSON.parse(line);
          if (m.t === 'done') {
            if (inFlight) throw new Error('done during host call');
            finish(undefined, m.result); return;
          }
          if (m.t !== 'call' || !Number.isSafeInteger(m.id) || m.id !== calls ||
              typeof m.ns !== 'string' || typeof m.fn !== 'string' ||
              !Array.isArray(m.args) || inFlight || ++calls > 100)
            throw new Error('invalid call or call budget');
          inFlight = true;
          const provider = providers.find(v => v.name === m.ns);
          if (!provider || !Object.hasOwn(provider.fns, m.fn)) throw new Error('unknown tool');
          await this.authorize(m);
          // Host credentials stay in the callback process. No guest I/O API.
          let response;
          try { response = { id: m.id, ok: (await provider.fns[m.fn](...m.args)) ?? null }; }
          catch (e) { response = { id: m.id, err: String(e) }; }
          const encoded = JSON.stringify(response);
          if (encoded.length > 65536) throw new Error('tool reply budget');
          if (!settled) p.stdin.write(encoded + '\n');
          inFlight = false;
        } catch (e) { finish(e); }
      });
      const names = providers.map(p => [p.name, Object.keys(p.fns)]);
      const code = `import * as bridge from 'jitk';
        for (const [ns, names] of ${JSON.stringify(names)}) {
          const mod = Object.create(null);
          for (const fn of names) mod[fn] = async (...args) => bridge.call(ns, fn, args);
          Object.defineProperty(globalThis, ns, {value:Object.freeze(mod)});
        }
        export async function handler(event) { ${body}\n }`;
      p.stdin.write(JSON.stringify({code, event: {}}) + '\n');
    });
  }
}
