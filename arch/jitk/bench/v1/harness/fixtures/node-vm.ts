// The floor (SPEC-V1 §2 `node-vm`), harness-test copy: a fresh node:vm
// context per execute, tools called in-process. No isolation: a memory bomb
// takes the harness down, so never run S3 hostile programs against it.
// The adapters agent owns the real one (bench/v1/adapters/node-vm.ts).
import * as vm from 'node:vm';
import type { Adapter, BenchExecutor, BenchResult, ResolvedProvider } from '../contract.ts';

const adapter: Adapter = {
  name: 'node-vm-fixture',
  isolation: 'none',
  where: 'local',
  async open({ timeoutMs }) {
    const ex: BenchExecutor = {
      async execute(code, providersOrFns): Promise<BenchResult> {
        const providers: ResolvedProvider[] = Array.isArray(providersOrFns) ? providersOrFns : [{ name: 'codemode', fns: providersOrFns }];
        const logs: string[] = [];
        const sandbox: Record<string, unknown> = {
          console: { log: (...a: unknown[]) => logs.push(a.map(String).join(' ')) },
        };
        for (const p of providers) {
          // Undeclared names reject like codemode's proxy does.
          sandbox[p.name] = new Proxy(p.fns, {
            get: (fns, k) => (typeof k === 'string' && Object.hasOwn(fns, k) ? fns[k] : async () => { throw Error(`tool ${p.name}.${String(k)} not found`); }),
          });
        }
        const context = vm.createContext(sandbox);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const run = vm.runInContext(`(${code})()`, context, { timeout: timeoutMs }) as Promise<unknown>;
          const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Execution timed out')), timeoutMs); });
          // Values cross a JSON boundary, as in every isolating executor.
          const result = await Promise.race([run, deadline]);
          return { result: result === undefined ? undefined : JSON.parse(JSON.stringify(result)), logs };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return { result: undefined, error: message, logs, errorClass: /timed out/i.test(message) ? 'timeout' : 'guest' };
        } finally { clearTimeout(timer); }
      },
      async close() {},
    };
    return ex;
  },
  provenance: () => ({ node: process.version, v8: process.versions.v8 }),
};
export default adapter;
