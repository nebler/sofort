// This adapter runs under Node, because Node IS the corpus reference. The
// controller and container driver are native scriptc executables.
import { readFileSync, writeFileSync, globSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const [root, file, out] = process.argv.slice(2);
const require = createRequire(join(root, 'package.json'));
const ts = require('typescript');
const head = readFileSync(file, 'utf8').split('\n', 2);
const args: string[] = [];
const inputs = /\/main\.(ts|js|mjs|cjs)$/.test(file) ? globSync(join(file, '../**/*.{ts,js,mjs,cjs,tsx,jsx}')) : [file];
if (head.includes('// @transform-types') || inputs.some(f => /\benum\s+[A-Za-z_$]/.test(readFileSync(f, 'utf8'))))
  args.push('--experimental-transform-types', '--disable-warning=ExperimentalWarning');
if (head.includes('// @no-deprecation')) args.push('--no-deprecation');
if (head.includes('// @disallow-code-generation')) args.push('--disallow-code-generation-from-strings');
if (!head.includes('// @no-node-shims')) args.push('--import', pathToFileURL(join(root, 'tests/harness/comptime-shim.mjs')).href);
let entry = file;
if (head.includes('// @tsc-decorators')) {
  entry = join(out, 'decorators.mjs');
  writeFileSync(entry, ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, fileName: file,
  }).outputText);
}
if (head.includes('// @tsc-jsx')) {
  // Use exactly the pinned upstream helper, with only its import suffix fixed
  // for Node's TypeScript loader (the source itself is otherwise untouched).
  const helper = join(root, 'tests/harness/jsx-oracle.ts');
  const mod = await import(pathToFileURL(helper).href);
  mkdirSync(join(out, 'jsx'), { recursive: true });
  entry = mod.tscJsxOracleEntry(file, join(out, 'jsx'));
}
args.push(entry);
const result = spawnSync('node', args, { cwd: join(out, 'cwd'), env: {
  PATH: process.env.PATH, HOME: '/tmp', LC_ALL: 'C', LANG: 'C', TZ: 'UTC', SCRIPTC_TEST_ENV: 'from-harness',
}, timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
writeFileSync(join(out, 'node.stdout'), result.stdout || Buffer.alloc(0));
writeFileSync(join(out, 'node.stderr'), result.stderr || Buffer.alloc(0));
writeFileSync(join(out, 'node.json'), JSON.stringify({ exit: result.status, signal: result.signal,
  error: result.error?.message || null, version: process.version }));
