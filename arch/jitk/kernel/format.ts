import { join } from 'node:path';
import { files, run } from './lib.ts';
const root = import.meta.dirname;
await run(['rustfmt', '+1.95.0', '--edition', '2024', ...process.argv.slice(2), join(root, 'build.rs'), ...files(join(root, 'src')).filter(path => path.endsWith('.rs')).sort()], { inherit: true });
