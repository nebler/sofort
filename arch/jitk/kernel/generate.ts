import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, dump, sha, json } from './lib.ts';

const keywords = new Set('as break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while async await dyn abstract become box do final macro override priv typeof unsized virtual yield try gen'.split(' '));
export function generate(root: string, out: string): void {
  const raw = readFileSync(join(root, 'slots.json'), 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  check(parsed && !Array.isArray(parsed) && typeof parsed === 'object' && Object.keys(parsed).length > 0, 'slots.json must be a nonempty object');
  const slots = new Map<string, string>();
  const pattern = /("(?:\\.|[^"\\])*")\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    const nr = JSON.parse(match[1]) as string;
    check(!slots.has(nr), 'duplicate syscall number: ' + nr);
    check(/^(?:0|[1-9][0-9]*)$/.test(nr) && Number(nr) <= 0xffffffff, 'invalid syscall number: ' + nr);
    const name = parsed[nr];
    check(typeof name === 'string' && /^[a-z][a-z0-9_]*$/.test(name) && !keywords.has(name), 'invalid handler identifier: ' + String(name));
    slots.set(nr, name);
  }
  const rows: { nr: number; name: string; registered: boolean; sha256: string | null }[] = [];
  const modules: string[] = [];
  const arms: string[] = [];
  const present: string[] = [];
  const emitted = new Set<string>();
  for (const nr of [...slots.keys()].sort((a, b) => Number(a) - Number(b))) {
    const name = slots.get(nr)!;
    const path = join(root, 'src/syscalls', name + '.rs');
    console.log('cargo:rerun-if-changed=' + path);
    const registered = existsSync(path);
    rows.push({ nr: Number(nr), name, registered, sha256: registered ? sha(readFileSync(path)) : null });
    if (registered) {
      if (!emitted.has(name)) {
        modules.push(`#[path=${json(path, 0)}] mod ${name};`);
        emitted.add(name);
      }
      arms.push(`${nr} => ${name}::call(a),`);
      present.push(nr);
    } else {
      arms.push(`${nr} => -38,`);
    }
  }
  let dispatch = 'mod handlers {\n' + modules.join('\n') + '\n';
  dispatch += '#[allow(unused_imports, reason="Candidate handlers may be deleted by the grow gate.")]\nuse super::{copyin, copyout, now_ns, park_poll, poll_fd, writable};\n';
  dispatch += `pub fn registered(n:usize)->bool { matches!(n, ${present.join(' | ') || '_ if false'}) }\n`;
  dispatch += 'pub fn dispatch(n:usize,a:&[usize; 6])->isize { match n {\n' + arms.join('\n') + '\n_=>-38\n}}\n}\npub use handlers::{registered,dispatch};\n';
  writeFileSync(join(out, 'dispatch.rs'), dispatch);
  dump(join(out, 'syscalls.json'), rows);
}

export function buildArgs(root: string, out: string): void {
  const ring = process.env.CARGO_FEATURE_TRANSPORT_RING !== undefined;
  const bootstrap = ring ? 'ring-bootstrap.js' : '../protocol/bootstrap.js';
  const args = process.env.JITK_ARGV_JSON !== undefined
    ? JSON.parse(process.env.JITK_ARGV_JSON) as unknown
    : ['qjs', '--std', '--memory-limit', '16777216', '-e', process.env.JITK_SCRIPT || readFileSync(join(root, bootstrap), 'utf8')];
  check(Array.isArray(args) && args.length > 0 && args.length <= 32 && args.every((a: unknown) => typeof a === 'string' && !a.includes('\0')), 'invalid argv');
  const argv = args as string[];
  check(argv.reduce((sum, arg) => sum + Buffer.byteLength(arg) + 1, 0) < 30000, 'argv too large');
  const canonical = process.env.JITK_ARGV_JSON === undefined && process.env.JITK_SCRIPT === undefined && !ring;
  const rust = canonical
    ? 'pub const ARGV: &[&str] = &["qjs","--std","--memory-limit","16777216","-e",include_str!(concat!(env!("CARGO_MANIFEST_DIR"),"/../protocol/bootstrap.js"))];\n'
    : 'pub const ARGV: &[&str] = &' + JSON.stringify(argv).replace(/,(?=")/g, ', ').replaceAll('\\b', '\\u{8}').replaceAll('\\f', '\\u{c}') + ';\n';
  appendFileSync(join(out, 'packed.rs'), rust);
  generate(root, out);
  const features = Object.keys(process.env).filter(key => key.startsWith('CARGO_FEATURE_')).map(key => key.slice(14).toLowerCase().replaceAll('_', '-')).sort();
  // Python's unindented JSON uses a space after commas/colons.
  writeFileSync(join(out, 'features.json'), JSON.stringify(features).replaceAll('","', '", "') + '\n');
  writeFileSync(join(out, 'argv.json'), json(argv, 0).replaceAll('","', '", "') + '\n');
}
