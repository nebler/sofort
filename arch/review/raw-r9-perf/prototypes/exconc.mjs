// R9 measurement only: executor throughput with C concurrent execute() calls
// over one ShardBackend with S slots and O owners. Reports runs/s and CPU per
// run for Node and the shard process (incl. guest time). Copy next to
// executor/build/*.js; hold /home/dev/bench.lock.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MicroVMExecutor} from './executor.js';
import {SandboxPool} from './pool.js';
import {ShardBackend} from './shard-backend.js';
const S = Number(process.env.SLOTS ?? 64), C = Number(process.env.CONC ?? 64), M = Number(process.env.M ?? 2000);
const O = Number(process.env.OWNERS ?? 4);
const code = process.env.CODE ?? 'return (await codemode.echo(41))+1';
const expect = Number(process.env.EXPECT ?? 42);
const backend = new ShardBackend({binary: process.env.JITK_SHARD_BINARY, snapshot: process.env.JITK_SHARD_SNAPSHOT, slots: S, owners: O});
const pool = new SandboxPool(backend, 0, S, {refillConcurrency: S});
const ex = new MicroVMExecutor(pool, () => 'allow', 10000);
const providers = {echo: async x => x};
const ticks = pid => { const t = readFileSync(`/proc/${pid}/stat`, 'utf8'); const f = t.slice(t.lastIndexOf(')') + 2).split(' '); return Number(f[11]) + Number(f[12]); };
try {
  await backend.ready;
  const pid = backend.child.pid;
  let shed = 0;
  const one = async () => { for (;;) { const r = await ex.execute(code, providers); if (r.error === 'Error: pool saturated') { shed++; await new Promise(res => setImmediate(res)); continue; } assert.equal(r.error, undefined); assert.equal(r.result, expect); return; } };
  await Promise.all(Array.from({length: C}, one)); // warm every slot once
  let started = 0;
  const lane = async () => { while (started < M) { started++; await one(); } };
  const c0 = process.cpuUsage(), s0 = ticks(pid), t0 = performance.now();
  await Promise.all(Array.from({length: C}, lane));
  const wall = (performance.now() - t0) / 1000, c = process.cpuUsage(c0), s = (ticks(pid) - s0) / 100;
  console.log(JSON.stringify({slots: S, owners: O, conc: C, runs: M, runsPerSec: M / wall, shedRetries: shed, nodeCpuUsPerRun: (c.user + c.system) / M, shardCpuUsPerRun: s * 1e6 / M, wallS: wall}));
} finally { await pool.close(); }
