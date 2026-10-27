// R9 measurement only: the shard-bench execute loop without its deadline
// section, so a Node --cpu-prof covers just execute()+drain. Copy next to
// executor/build/*.js. Hold /home/dev/bench.lock when invoking.
import assert from 'node:assert/strict';
import {MicroVMExecutor} from './executor.js';
import {SandboxPool} from './pool.js';
import {ShardBackend} from './shard-backend.js';
const n = Number(process.env.N ?? 500);
const code = process.env.CODE ?? 'return (await codemode.echo(41))+1';
const expect = Number(process.env.EXPECT ?? 42);
const backend = new ShardBackend({binary: process.env.JITK_SHARD_BINARY, snapshot: process.env.JITK_SHARD_SNAPSHOT, slots: 1});
const pool = new SandboxPool(backend, 0, 1);
const ex = new MicroVMExecutor(pool, () => 'allow', 5000);
const providers = {echo: async x => x};
try {
  await backend.ready;
  for (let i = 0; i < 20; i++) { const r = await ex.execute(code, providers); assert.equal(r.result, expect); await pool.drain(); }
  const c0 = process.cpuUsage(), t0 = performance.now();
  for (let i = 0; i < n; i++) { const r = await ex.execute(code, providers); assert.equal(r.result, expect); await pool.drain(); }
  const c = process.cpuUsage(c0);
  console.log(JSON.stringify({n, code, nodeUsPerRun: (c.user + c.system) / n, nodeUserUs: c.user / n, nodeSysUs: c.system / n, wallUsPerRun: (performance.now() - t0) * 1000 / n}));
} finally { await pool.close(); }
