#!/usr/bin/env node
// jitk MCP server: execute runs code-mode JS; run uses native Linux ring VMs.
// resources expose a markdown directory. stdio by default; `--http PORT` serves
// Streamable HTTP (stateless, JSON responses) on 127.0.0.1.
import {readdirSync, readFileSync, realpathSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema,
  ReadResourceRequestSchema, McpError, ErrorCode} from '@modelcontextprotocol/sdk/types.js';
import {loadConfig, createJitk, describeTools, describeLimits} from './jitk.mjs';

const PREFIX = 'jitk://resources/', MAX_RESOURCE = 1 << 20;

// Resources are plain files under one root. URIs are root-relative paths, so the
// same directory can be packed into the guest filesystem unchanged.
function listResources(root) {
  const out = [];
  const walk = dir => {
    for (const e of readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name < b.name ? -1 : 1)) {
      if (e.name.startsWith('.')) continue;
      const path = join(dir, e.name);
      if (e.isDirectory()) walk(path);
      else if (e.isFile()) {
        const rel = relative(root, path).split(sep).join('/');
        out.push({uri: PREFIX + rel, name: rel, mimeType: mime(rel), size: statSync(path).size});
      }
    }
  };
  walk(root);
  return out;
}
const mime = p => p.endsWith('.md') ? 'text/markdown' : 'text/plain';
function readResource(root, uri) {
  if (!uri.startsWith(PREFIX)) throw new McpError(ErrorCode.InvalidParams, 'unknown resource: ' + uri);
  const rel = decodeURIComponent(uri.slice(PREFIX.length));
  let path;
  try { path = realpathSync(join(root, rel)); } catch { throw new McpError(ErrorCode.InvalidParams, 'unknown resource: ' + uri); }
  // realpath on both sides: no `..` or symlink escapes from the root.
  if (!path.startsWith(root + sep) || !statSync(path).isFile() || statSync(path).size > MAX_RESOURCE)
    throw new McpError(ErrorCode.InvalidParams, 'unknown resource: ' + uri);
  return {contents: [{uri, mimeType: mime(path), text: readFileSync(path, 'utf8')}]};
}

function mcpServer(jitk, cfg) {
  const root = realpathSync(cfg.resources);
  const server = new Server({name: 'jitk', version: '0.1.0'}, {capabilities: {tools: {}, resources: {}}});
  const execute = {
    name: 'execute',
    description: `Run JavaScript in a fresh single-use microVM (QuickJS, no network, no filesystem). ` +
      `The code is an async function body: use await and \`return\` a JSON value. console.log output is returned as logs. ` +
      `Deadline ${cfg.timeoutMs} ms.${describeLimits(jitk.limits)} Host tools (call with await; Promise.all runs them concurrently):\n${describeTools(cfg.tools)}\n` +
      `Errors carry a code: TIMEOUT, POLICY, LIMIT, SANDBOX, CANCELLED or GUEST_ERROR.`,
    inputSchema: {type: 'object', properties: {code: {type: 'string', description: 'JavaScript async function body'}},
      required: ['code'], additionalProperties: false},
  };
  const run = {
    name: 'run',
    description: 'Run a prepared static native tool in a fresh Linux arm64 KVM microVM. args excludes argv[0]. ' +
      'files maps relative read-only guest paths to canonical base64 bytes (64 files, 4 MiB archive). ' +
      'Returns stdout/stderr as {encoding:"base64",data}, exitCode, outputLimited (1 MiB combined cap). ' +
      'macOS v1 returns UNSUPPORTED. Configured profiles: ' + Object.keys(cfg.native?.profiles ?? {}).join(', '),
    inputSchema: {type: 'object', properties: {tool: {type: 'string'}, args: {type: 'array', maxItems: 31, items: {type: 'string'}},
      files: {type: 'object', maxProperties: 64, additionalProperties: {type: 'string'}}}, required: ['tool'], additionalProperties: false},
  };
  server.setRequestHandler(ListToolsRequestSchema, async () => ({tools: [execute, run]}));
  server.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
    if (req.params.name === 'run') {
      const input = req.params.arguments;
      if (!input || typeof input.tool !== 'string' || Object.keys(input).some(k => !['tool', 'args', 'files'].includes(k)))
        throw new McpError(ErrorCode.InvalidParams, 'run: tool, args, files required');
      const out = await jitk.runNative(input, extra.signal);
      return {content: [{type: 'text', text: JSON.stringify(out)}], structuredContent: out, isError: 'error' in out};
    }
    if (req.params.name !== 'execute') throw new McpError(ErrorCode.InvalidParams, 'unknown tool: ' + req.params.name);
    const code = req.params.arguments?.code;
    if (typeof code !== 'string') throw new McpError(ErrorCode.InvalidParams, 'execute: `code` must be a string');
    const out = await jitk.run(code, extra.signal);
    // Spec: structured content plus its serialized form for text-only clients.
    return {content: [{type: 'text', text: JSON.stringify(out)}], structuredContent: out, isError: 'error' in out};
  });
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({resources: listResources(root)}));
  server.setRequestHandler(ReadResourceRequestSchema, async req => readResource(root, req.params.uri));
  server.onerror = e => process.stderr.write(`jitk-mcp: ${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 200)}\n`);
  return server;
}

async function main() {
  const cfg = await loadConfig();
  const jitk = await createJitk(cfg);
  let closing;
  const shutdown = () => closing ??= jitk.close().catch(() => {}).finally(() => process.exit(0));
  process.once('SIGINT', shutdown).once('SIGTERM', shutdown);
  const http = process.argv.indexOf('--http');
  if (http === -1) {
    // stdin EOF is the stdio client's close signal; the SDK transport does not watch it.
    process.stdin.once('end', shutdown);
    await mcpServer(jitk, cfg).connect(new StdioServerTransport());
  } else {
    const port = Number(process.argv[http + 1]);
    const {createServer} = await import('node:http');
    const {StreamableHTTPServerTransport} = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    createServer(async (req, res) => {
      // Stateless: one Server+transport per request; the pool is shared.
      const server = mcpServer(jitk, cfg);
      const transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined, enableJsonResponse: true,
        enableDnsRebindingProtection: true, allowedHosts});
      res.on('close', () => { void transport.close(); void server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    }).listen(port, '127.0.0.1', () => process.stderr.write(`jitk-mcp: http://127.0.0.1:${port}/mcp\n`));
  }
  process.stderr.write(`jitk-mcp: ${jitk.selection}; warm=${cfg.warm}\n`);
}

await main();
