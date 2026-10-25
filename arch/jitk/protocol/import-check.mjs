import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const base=new URL('../',import.meta.url);
for(const [file,pattern] of [
 ['executor/backend.ts',/from ['"]\.\.\/protocol\/dispatcher\.js['"]/],
 // Hyperlight reuses the executor's ProcessBackend, which consumes the canonical dispatcher.
 ['bench/hyperlight/backend.ts',/\.\.\/\.\.\/executor\/(build\/)?backend\.(ts|js)['"]/],
 ['kernel/build.rs',/protocol\/bootstrap\.js/],
]) {
 assert(pattern.test(readFileSync(new URL(file,base),'utf8')),file+' must consume canonical protocol');
}
for(const file of ['executor/dispatcher.ts','executor/protocol.ts','bench/hyperlight/protocol.ts','bench/hyperlight/dispatcher.ts'])
 assert(!existsSync(new URL(file,base)),file+' is a forbidden parser copy');
console.log('Canonical imports: executor, Hyperlight and kernel pass');
