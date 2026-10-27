// R9 measurement only: Node CPU per cold execute() on the macOS libkrun
// backend (one fresh VM process per execute). Usage:
//   node mac-exloop.mjs EXECUTOR_BUILD VMM IMAGE PROFILE N CODE EXPECT
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [build, vmm, image, profile, n0, code, expect0] = process.argv.slice(2);
const n = Number(n0), expect = JSON.parse(expect0);
const {MicroVMExecutor, SandboxPool, JitkBackend} = await import(pathToFileURL(build + '/executor.js'));
const backend = new JitkBackend(vmm, {launcher: '01-vmm', image, requireSandboxAck: true, sandboxProfile: profile, startupMs: 10000, lifetimeMs: 15000});
const pool = new SandboxPool(backend, 0, 2, {refillConcurrency: 1});
const ex = new MicroVMExecutor(pool, () => 'allow', 10000);
const providers = [{name: 'codemode', fns: {echo: async v => v}}];
try {
  for (let i = 0; i < 10; i++) { const r = await ex.execute(code, providers); assert.deepEqual(r.result, expect, JSON.stringify(r)); await pool.drain(); }
  const c0 = process.cpuUsage(), t0 = performance.now();
  for (let i = 0; i < n; i++) { const r = await ex.execute(code, providers); assert.deepEqual(r.result, expect); await pool.drain(); }
  const c = process.cpuUsage(c0), wall = performance.now() - t0;
  console.log(JSON.stringify({n, code, nodeCpuUsPerExecute: (c.user + c.system) / n, nodeUserUs: c.user / n, nodeSysUs: c.system / n, wallMsPerExecute: wall / n}));
} finally { await pool.close(); }
