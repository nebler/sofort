// Shared by record.ts and gate.ts: the recording format, the native entry a
// program is wrapped in, and where scriptc and the work files live.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RecordedCall } from '../tasks/lib/tasks.ts';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const WORK = join(HERE, '..', '.work', 'promote');

// One finished run of a program on the tier that ran it first (QuickJS in
// production; Node here). `calls` holds only the calls that run made, so a
// promoted binary can be replayed against exactly what the first tier saw.
export interface Recording {
  task: string;
  program: string;
  source: string; // sha256 of the program text
  tier: string;
  calls: RecordedCall[];
  keys: string[]; // canonical call keys in issue order
  result: string; // JSON.stringify(result ?? null)
}

// The pinned scriptc (arch/jitk/tools). A worktree without its own install can
// point SCRIPTC at another checkout's.
export function scriptc(): string {
  const path = process.env.SCRIPTC ?? join(HERE, '..', '..', '..', 'tools', 'node_modules', '.bin', 'scriptc');
  if (!existsSync(path)) throw new Error(`scriptc not found at ${path}; run make -C arch/jitk/tools or set SCRIPTC`);
  return path;
}

export function scriptcVersion(path: string): string {
  return execFileSync(path, ['--version'], { encoding: 'utf8' }).trim();
}

// Marks the result line, so a program's own console.log output above it
// doesn't matter.
export const RESULT_MARK = '@@result ';

// A standalone entry for one program. argv[2] is a JSONL file of RecordedCall
// lines to replay; argv[3] is where the canonical keys of the calls made go.
// canonical() must stay identical to tasks/lib/tasks.ts.
export function nativeEntry(program: string, providers: { name: string; tools: string[] }[]): string {
  const namespaces = providers
    .map(p => {
      const tools = p.tools.map(t => `  ${t}: (...args) => call('${p.name}', '${t}', args),`).join('\n');
      return `const ${p.name} = {\n${tools}\n};`;
    })
    .join('\n');
  return `import { readFileSync, writeFileSync } from 'node:fs';
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(item => (item === undefined ? 'null' : canonical(item))).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).filter(key => value[key] !== undefined).sort();
    return '{' + keys.map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}
const table = new Map();
for (const line of readFileSync(process.argv[2], 'utf8').split('\\n')) {
  if (!line) continue;
  const r = JSON.parse(line);
  table.set(r.namespace + '.' + r.tool + ' ' + canonical(r.args), r);
}
const made = [];
function call(ns, tool, args) {
  const key = ns + '.' + tool + ' ' + canonical(JSON.parse(JSON.stringify(args)));
  made.push(key);
  const r = table.get(key);
  if (!r) return Promise.reject(new Error('unrecorded call: ' + key.slice(0, 200)));
  if (r.error !== undefined) return Promise.reject(new Error(r.error));
  return Promise.resolve(JSON.parse(JSON.stringify(r.response)));
}
${namespaces}
const main = ${program.trim().replace(/;$/, '')};
main().then(
  result => {
    writeFileSync(process.argv[3], JSON.stringify(made));
    process.stdout.write('\\n${RESULT_MARK}' + JSON.stringify(result ?? null));
  },
  error => {
    writeFileSync(process.argv[3], JSON.stringify(made));
    process.stderr.write('program error: ' + (error && error.message) + '\\n');
    process.exit(2);
  },
);
`;
}
