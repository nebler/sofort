import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check } from '../../lib.ts';
const root = process.argv[2];
let path = join(root, 'quickjs.c');
let source = readFileSync(path, 'utf8');
let marker = 'static void js_random_init(JSContext *ctx)';
check(source.split(marker).length === 2, 'expected one js_random_init');
source = source.replace(marker, `/* R7: overwrite the existing context, including saved Math.random references. */
void JS_SetSnapshotRandomSeed(JSContext *ctx, uint64_t seed)
{
    ctx->random_state = seed ? seed : 1;
}

` + marker);
writeFileSync(path, source);
path = join(root, 'quickjs-libc.c');
source = readFileSync(path, 'utf8');
marker = 'static const JSCFunctionListEntry js_os_funcs[] = {';
check(source.split(marker).length === 2, 'expected one js_os_funcs');
writeFileSync(path, source.replace(marker, '#include "checkpoint.h"\n\n' + marker + '\n    JS_CFUNC_DEF("snapshotCheckpoint", 0, js_os_snapshot_checkpoint ),'));
