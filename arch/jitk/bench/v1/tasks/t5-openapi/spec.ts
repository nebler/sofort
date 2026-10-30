// The OpenAPI tools of T5, the way Cloudflare's code-mode MCP server puts a
// large spec behind `search` and `execute`: the spec (GitHub's REST API
// description, MIT, 13.9 MB) stays on the tool host; the program searches it
// and reads single operations. The spec is downloaded at a pinned commit into
// ../.work/openapi/ and checked against spec.json.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SPEC = JSON.parse(readFileSync(join(HERE, 'spec.json'), 'utf8')) as {
  url: string;
  commit: string;
  sha256: string;
  bytes: number;
};
const FILE = join(HERE, '..', '.work', 'openapi', 'api.github.com.json');

type Json = Record<string, any>;

export function loadSpec(): Json {
  if (!existsSync(FILE)) {
    mkdirSync(dirname(FILE), { recursive: true });
    execFileSync('curl', ['-sSfL', '-o', FILE, SPEC.url]);
  }
  const data = readFileSync(FILE);
  const hash = createHash('sha256').update(data).digest('hex');
  if (hash !== SPEC.sha256) throw new Error(`spec sha256 ${hash} != ${SPEC.sha256}`);
  return JSON.parse(data.toString('utf8'));
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export interface Operation {
  operationId: string;
  method: string;
  path: string;
  op: Json;
}

export function operations(spec: Json): Operation[] {
  const out: Operation[] = [];
  for (const [path, item] of Object.entries(spec.paths as Json)) {
    for (const method of METHODS) {
      if (item[method])
        out.push({ operationId: item[method].operationId, method: method.toUpperCase(), path, op: item[method] });
    }
  }
  return out;
}

// Resolves local $refs; a ref already on the current path is left as {$ref}
// (GitHub's spec has a few recursive schemas).
export function deref(spec: Json, value: unknown, seen: string[] = []): unknown {
  if (Array.isArray(value)) return value.map(item => deref(spec, item, seen));
  if (value === null || typeof value !== 'object') return value;
  const ref = (value as Json).$ref;
  if (typeof ref === 'string') {
    if (seen.includes(ref)) return { $ref: ref };
    const target = ref
      .slice(2)
      .split('/')
      .reduce((node: Json, key) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], spec);
    return deref(spec, target, [...seen, ref]);
  }
  const out: Json = {};
  for (const [key, item] of Object.entries(value)) out[key] = deref(spec, item, seen);
  return out;
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

const STOP = new Set([
  'a',
  'an',
  'the',
  'of',
  'for',
  'to',
  'in',
  'on',
  'and',
  'or',
  'by',
  'with',
  'is',
  'its',
  'my',
  'me',
]);

// Keyword relevance: summary words weigh 3, operationId words 2, path and tag
// words 1, the first 400 characters of the description 0.5. Ties keep spec order.
export function search(spec: Json, query: string, limit = 10) {
  const terms = [...new Set(words(query).filter(word => !STOP.has(word)))];
  const scored = operations(spec).map((o, index) => {
    const summary = new Set(words(o.op.summary ?? ''));
    const id = new Set(words(o.operationId));
    const path = new Set([...words(o.path), ...(o.op.tags ?? []).flatMap((tag: string) => words(tag))]);
    const description = new Set(words((o.op.description ?? '').slice(0, 400)));
    let score = 0;
    for (const term of terms) {
      if (summary.has(term)) score += 3;
      if (id.has(term)) score += 2;
      if (path.has(term)) score += 1;
      if (description.has(term)) score += 0.5;
    }
    return { o, index, score };
  });
  const hits = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  return {
    query,
    total: hits.length,
    results: hits.slice(0, limit).map(({ o, score }) => ({
      operationId: o.operationId,
      method: o.method,
      path: o.path,
      summary: o.op.summary,
      description: o.op.description,
      tags: o.op.tags,
      score,
      parameters: ((deref(spec, o.op.parameters ?? []) as Json[]) ?? []).map(p => ({
        name: p.name,
        in: p.in,
        required: p.required ?? false,
        description: p.description,
        schema: p.schema,
      })),
      responses: Object.fromEntries(
        Object.entries((o.op.responses ?? {}) as Json).map(([code, r]) => [code, (deref(spec, r) as Json).description]),
      ),
      documentationUrl: o.op.externalDocs?.url,
    })),
  };
}

export function listOperations(spec: Json, tag?: string) {
  const ops = operations(spec).filter(o => !tag || (o.op.tags ?? []).includes(tag));
  return {
    total: ops.length,
    operations: ops.map(o => ({
      operationId: o.operationId,
      method: o.method,
      path: o.path,
      summary: o.op.summary,
      tags: o.op.tags,
    })),
  };
}

export function getOperation(spec: Json, operationId: string) {
  const found = operations(spec).find(o => o.operationId === operationId);
  if (!found) throw new Error(`unknown operationId: ${operationId}`);
  return { operationId, method: found.method, path: found.path, ...(deref(spec, found.op) as Json) };
}
