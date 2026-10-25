// mcp/test: drives server.mjs with the official SDK client (stdio and HTTP) and raw stdio bytes.
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const here = new URL('./', import.meta.url).pathname, server = here + 'server.mjs';
const dir = mkdtempSync(join(tmpdir(), 'jitk-mcp-test-')), config = join(dir, 'config.json');
writeFileSync(config, JSON.stringify({timeoutMs: 2000, warm: 2, maxLive: 8,
  providers: [here + 'providers/demo.mjs'], resources: here + 'resources'}));
const env = {...process.env, JITK_MCP_CONFIG: config};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const passed = [];
const ok = (name, cond, detail) => { assert(cond, `${name}: ${JSON.stringify(detail)}`); passed.push(name); console.log('ok -', name); };

// Every live descendant pid: VMMs (own process groups) and the shared watchdog.
const descendants = root => {
  const rows = execFileSync('/bin/ps', ['-A', '-o', 'pid=,ppid=,command='], {encoding: 'utf8'}).trim().split('\n')
    .map(l => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean).map(m => ({pid: +m[1], ppid: +m[2], cmd: m[3]}));
  const out = [], todo = [root];
  while (todo.length) { const p = todo.pop(); for (const r of rows) if (r.ppid === p) { out.push(r); todo.push(r.pid); } }
  return out;
};
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; } };
async function untilWarm(pid) {
  for (let i = 0; i < 200; i++) {
    const d = descendants(pid);
    if (d.some(r => r.cmd.includes('--watchdog')) && d.filter(r => r.cmd.includes('--image')).length >= 2) return d;
    await sleep(25);
  }
  throw Error('pool never warmed');
}
async function allGone(pids, label) {
  for (let i = 0; i < 120 && pids.some(alive); i++) await sleep(25);
  const left = pids.filter(alive);
  ok(`${label}: no VMM/watchdog left (${pids.length} pids checked)`, left.length === 0, left);
}

// 1. Official SDK client over stdio.
{
  const transport = new StdioClientTransport({command: process.execPath, args: [server], env, stderr: 'inherit'});
  const client = new Client({name: 'jitk-mcp-test', version: '0'});
  await client.connect(transport);
  const pid = transport.pid;
  const seen = await untilWarm(pid);
  const run = async code => (await client.callTool({name: 'execute', arguments: {code}})).structuredContent;

  let r = await run('return 1+1');
  ok('execute return 1+1 == 2', r.result === 2 && !r.error, r);
  r = await run("console.log('hi'); return await math.add(40, 2)");
  ok('guest->host tool round-trip', r.result === 42 && r.logs[0] === 'hi', r);
  r = await run("await kv.set('k', {v: 7}); return await kv.get('k')");
  ok('kv set/get round-trip', r.result?.v === 7, r);
  r = await run('return await Promise.all(Array.from({length: 10}, (_, i) => math.add(i, 100)))');
  ok('Promise.all over 10 tool calls', JSON.stringify(r.result) === JSON.stringify(Array.from({length: 10}, (_, i) => i + 100)), r);
  const started = Date.now();
  r = await run('while (true) {}');
  ok('timeout -> TIMEOUT', r.error?.code === 'TIMEOUT' && Date.now() - started < 4000, r);
  r = await run("return await math.add('x', 1)");
  ok('schema denial -> POLICY', r.error?.code === 'POLICY' && /policy denied: schema/.test(r.error.message), r);
  r = await run("await kv.get('k'); return await kv.set('k', 1)");
  ok('taint rule (private read then write, no approver) -> POLICY', r.error?.code === 'POLICY' && /approval required/.test(r.error.message), r);
  r = await run("throw new Error('boom')");
  ok('guest throw -> GUEST_ERROR', r.error?.code === 'GUEST_ERROR' && /boom/.test(r.error.message), r);
  const full = await client.callTool({name: 'execute', arguments: {code: 'return 3'}});
  ok('text content mirrors structuredContent', JSON.parse(full.content[0].text).result === 3 && full.isError === false, full);

  const {resources} = await client.listResources();
  const doc = resources.find(x => x.uri === 'jitk://resources/code-mode.md');
  ok('resources/list', doc?.mimeType === 'text/markdown', resources);
  const read = await client.readResource({uri: doc.uri});
  ok('resources/read', read.contents[0].text.startsWith('# Code mode on jitk'), read.contents[0].text.slice(0, 40));
  await assert.rejects(client.readResource({uri: 'jitk://resources/../jitk-mcp.json'}), /unknown resource/);
  await assert.rejects(client.readResource({uri: 'jitk://resources/%2e%2e/server.mjs'}), /unknown resource/);
  ok('resource path traversal rejected', true);

  await assert.rejects(client.callTool({name: 'execute', arguments: {code: 42}}), /must be a string/);
  await assert.rejects(client.callTool({name: 'nope', arguments: {}}), /unknown tool/);
  ok('invalid params rejected as JSON-RPC errors', true);
  r = await run('return 5');
  ok('server alive after rejected requests', r.result === 5, r);
  const tools = await client.listTools();
  ok('tools/list describes guest tools', /math\.add/.test(tools.tools[0].description) && /kv\.set/.test(tools.tools[0].description));

  const pids = [...new Set([...seen, ...descendants(pid)].map(r => r.pid))];
  await client.close();
  for (let i = 0; i < 120 && alive(pid); i++) await sleep(25);
  ok('client close -> server exits', !alive(pid));
  await allGone(pids, 'stdio close');
}

// 2. Raw bytes: malformed JSON and bad JSON-RPC must not crash the server; stdin EOF shuts it down.
{
  const child = spawn(process.execPath, [server], {env, stdio: ['pipe', 'pipe', 'inherit']});
  const replies = new Map();
  let buf = '';
  child.stdout.on('data', b => { buf += b; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); if (m.id !== undefined) replies.set(m.id, m); } });
  const send = s => child.stdin.write(s + '\n');
  const reply = async id => { for (let i = 0; i < 400 && !replies.has(id); i++) await sleep(10); return replies.get(id); };
  send('this is not json');
  send('{"jsonrpc":"2.0","id":');
  send('');
  send('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"raw","version":"0"}}}');
  ok('initialize after garbage', (await reply(1))?.result?.serverInfo?.name === 'jitk');
  send('{"jsonrpc":"2.0","method":"notifications/initialized"}');
  send('{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{}}');
  send('{"jsonrpc":"2.0","id":3,"method":"no/such/method"}');
  send('[1,2,3]');
  send('{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"execute","arguments":{"code":"return 1+1"}}}');
  const [r2, r3, r4] = [await reply(2), await reply(3), await reply(4)];
  ok('malformed requests answered with JSON-RPC errors', r2?.error && r3?.error?.code === -32601, {r2, r3});
  ok('execute after malformed input', r4?.result?.structuredContent?.result === 2, r4);
  const pids = (await untilWarm(child.pid)).map(r => r.pid);
  const exited = new Promise(r => child.once('exit', code => r(code)));
  child.stdin.end();
  ok('stdin EOF -> exit 0', await exited === 0);
  await allGone(pids, 'stdin EOF');
}

// 3. Streamable HTTP with the official SDK client; SIGTERM shuts it down.
{
  const port = 40000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [server, '--http', String(port)], {env, stdio: ['ignore', 'ignore', 'pipe']});
  await new Promise((res, rej) => { child.stderr.on('data', b => { process.stderr.write(b); if (String(b).includes('http://')) res(); }); child.once('exit', rej); });
  const client = new Client({name: 'jitk-mcp-test-http', version: '0'});
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
  const r = (await client.callTool({name: 'execute', arguments: {code: 'return await math.add(1, 1)'}})).structuredContent;
  ok('streamable HTTP execute', r.result === 2, r);
  // fetch() drops Host; node:http sends it verbatim, as a DNS-rebinding browser would.
  const {request} = await import('node:http');
  const bad = await new Promise((res, rej) => request({host: '127.0.0.1', port, path: '/mcp', method: 'POST',
    headers: {host: 'evil.example', 'content-type': 'application/json', accept: 'application/json, text/event-stream'}},
    r => { r.resume(); res({status: r.statusCode}); }).on('error', rej).end('{"jsonrpc":"2.0","id":1,"method":"tools/list"}'));
  ok('HTTP rejects foreign Host (DNS rebinding)', bad.status === 403, bad.status);
  const pids = (await untilWarm(child.pid)).map(r => r.pid);
  await client.close();
  const exited = new Promise(r => child.once('exit', code => r(code)));
  child.kill('SIGTERM');
  ok('SIGTERM -> exit 0', await exited === 0);
  await allGone(pids, 'SIGTERM');
}

rmSync(dir, {recursive: true, force: true});
console.log(`mcp: ${passed.length} checks passed`);
