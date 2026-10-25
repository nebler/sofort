// mcp/bench: parked-path latency, MCP stdio round-trip vs in-process executor.
// Arms (same guest code, interleaved in shuffled blocks, 5 warmups excluded):
//   executor  MicroVMExecutor.execute, legacy fns          (bench/ executor-parked shape)
//   core      jitk.mjs run(): 07-declared demo tools        (what the server runs)
//   mcp       SDK client callTool -> stdio -> server.mjs   (end-to-end MCP)
import {writeFileSync} from 'node:fs';
import {loadavg} from 'node:os';
import {performance} from 'node:perf_hooks';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {loadConfig, createJitk} from './jitk.mjs';

const N = +(process.env.N ?? 30), WARMUP = 5, GAP_MS = 50;
const cases = {return2: 'return 2;', one_tool: 'return await math.add(1, 1);'};
const expected = {return2: 2, one_tool: 2};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cfg = await loadConfig();

const core = await createJitk(cfg);
const bare = await createJitk({...cfg, tools: undefined});  // no 07 registry: legacy fns below
const fns = [{name: 'math', fns: {add: async (a, b) => a + b}}];
const transport = new StdioClientTransport({command: process.execPath, args: [new URL('./server.mjs', import.meta.url).pathname],
  env: {...process.env}, stderr: 'inherit'});
const client = new Client({name: 'jitk-mcp-bench', version: '0'});
await client.connect(transport);
await Promise.all([core.warmed, bare.warmed]);

const arms = {
  executor: async code => (await bare.executor.execute(code, fns)).result,
  core: async code => (await core.run(code)).result,
  mcp: async code => (await client.callTool({name: 'execute', arguments: {code}})).structuredContent.result,
};
const samples = Object.fromEntries(Object.keys(arms).flatMap(a => Object.keys(cases).map(c => [`${a}/${c}`, []])));
const loadStart = loadavg();
for (let i = 0; i < N + WARMUP; i++) {
  const block = Object.keys(arms).flatMap(a => Object.keys(cases).map(c => [a, c])).sort(() => Math.random() - .5);
  for (const [arm, c] of block) {
    // Let every pool (in-process and server) finish kill/reap/refill: parked path only.
    await Promise.all([core.pool.warm(), bare.pool.warm()]);
    await sleep(GAP_MS);
    const load1 = loadavg()[0], t0 = performance.now();
    const result = await arms[arm](cases[c]);
    const ms = performance.now() - t0;
    if (result !== expected[c]) throw Error(`${arm}/${c}: ${JSON.stringify(result)}`);
    if (i >= WARMUP) samples[`${arm}/${c}`].push({ms, load1});
  }
}
const loadEnd = loadavg();
await client.close();
await Promise.all([core.close(), bare.close()]);

const q = (a, p) => { const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const rows = Object.entries(samples).map(([k, v]) => {
  const ms = v.map(x => x.ms), l = v.map(x => x.load1);
  return {arm: k, n: v.length, p50: q(ms, .5), p90: q(ms, .9), load1: [Math.min(...l), Math.max(...l)]};
});
const f = x => x.toFixed(3);
const table = ['| arm/case | n | p50 ms | p90 ms | load1 range |', '|---|---:|---:|---:|---:|',
  ...rows.map(r => `| ${r.arm} | ${r.n} | ${f(r.p50)} | ${f(r.p90)} | ${r.load1[0].toFixed(2)}–${r.load1[1].toFixed(2)} |`)];
for (const c of Object.keys(cases)) {
  const get = a => rows.find(r => r.arm === `${a}/${c}`);
  table.push(`\n${c}: MCP − core p50 ${f(get('mcp').p50 - get('core').p50)} ms; core − executor p50 ${f(get('core').p50 - get('executor').p50)} ms`);
}
console.log(`load averages start ${loadStart.map(x => x.toFixed(2)).join(' ')} end ${loadEnd.map(x => x.toFixed(2)).join(' ')}\n` + table.join('\n'));
writeFileSync(new URL('./bench-results.json', import.meta.url), JSON.stringify({date: new Date().toISOString(), N, WARMUP, GAP_MS,
  loadStart, loadEnd, selection: core.selection, rows, samples}, null, 2) + '\n');
