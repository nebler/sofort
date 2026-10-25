// The main codemode runtime imports cloudflare:workers. Only this inspection
// adapter reaches into pinned dist files; do not ship these private paths.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
export const cfDir = dirname(require.resolve('@cloudflare/codemode'));
export const normalizeCode: (code: string) => string = (await import(pathToFileURL(join(cfDir, 'json-schema-types-D_m9tVnI.js')).href)).s;
const schema = await import(pathToFileURL(join(cfDir, 'json-schema-types-D_m9tVnI.js')).href);
export const sanitizeToolName:(name:string)=>string=schema.a;
export const generateTypesFromJsonSchema:(tools:Record<string,unknown>)=>string=schema.t;
