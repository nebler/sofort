/* The working-set reference (tasks/README.md "Working sets"): Bellard QuickJS,
 * the guest's version, 64-bit, run natively with allocation accounting by
 * requested bytes (no allocator overhead or fragmentation), so its peak is
 * what QuickJS itself holds at once. quickjs-ref.ts drives it.
 *
 *   ws HARNESS.js PROGRAM.js REPLY_DIR   peak on stderr: "peak <bytes> floor <bytes>"
 *   WS_TRACE=FILE   also writes every allocation (A/F/R with ids and sizes)
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "quickjs-libc.h"

#define HDR 16
static size_t cur, peak;
static unsigned long long ids;
static FILE *trace;

static size_t *head(void *p) { return (size_t *)((char *)p - HDR); }
static void *ws_malloc(JSMallocState *s, size_t size)
{
    if (s->malloc_size + size > s->malloc_limit)
        return NULL;
    char *p = malloc(size + HDR);
    if (!p)
        return NULL;
    ((size_t *)p)[0] = size;
    ((size_t *)p)[1] = ++ids;
    s->malloc_count++;
    s->malloc_size += size;
    cur += size;
    if (cur > peak)
        peak = cur;
    if (trace)
        fprintf(trace, "A %llu %zu\n", ids, size);
    return p + HDR;
}
static void ws_free(JSMallocState *s, void *ptr)
{
    if (!ptr)
        return;
    size_t size = head(ptr)[0];
    if (trace)
        fprintf(trace, "F %zu\n", head(ptr)[1]);
    s->malloc_count--;
    s->malloc_size -= size;
    cur -= size;
    free(head(ptr));
}
static void *ws_realloc(JSMallocState *s, void *ptr, size_t size)
{
    if (!ptr)
        return size ? ws_malloc(s, size) : NULL;
    if (!size) {
        ws_free(s, ptr);
        return NULL;
    }
    size_t old = head(ptr)[0];
    if (s->malloc_size + size - old > s->malloc_limit)
        return NULL;
    char *p = realloc(head(ptr), size + HDR);
    if (!p)
        return NULL;
    ((size_t *)p)[0] = size;
    s->malloc_size += size - old;
    cur += size - old;
    if (cur > peak)
        peak = cur;
    if (trace)
        fprintf(trace, "R %zu %zu\n", ((size_t *)p)[1], size);
    return p + HDR;
}
static size_t ws_usable(const void *ptr)
{
    return ((const size_t *)((const char *)ptr - HDR))[0];
}
static const JSMallocFunctions mf = { ws_malloc, ws_free, ws_realloc, ws_usable };

static int eval_module(JSContext *ctx, const char *src, const char *name)
{
    JSValue v = JS_Eval(ctx, src, strlen(src), name, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
    if (!JS_IsException(v)) {
        js_module_set_import_meta(ctx, v, 0, 1);
        v = JS_EvalFunction(ctx, v);
        if (!JS_IsException(v))
            v = js_std_await(ctx, v);
    }
    if (JS_IsException(v)) {
        js_std_dump_error(ctx);
        return -1;
    }
    JS_FreeValue(ctx, v);
    return 0;
}

int main(int argc, char **argv)
{
    if (argc != 4) {
        fprintf(stderr, "usage: ws HARNESS.js PROGRAM.js REPLY_DIR\n");
        return 2;
    }
    if (getenv("WS_TRACE"))
        trace = fopen(getenv("WS_TRACE"), "w");
    JSRuntime *rt = JS_NewRuntime2(&mf, NULL);
    if (getenv("WS_LIMIT"))
        JS_SetMemoryLimit(rt, strtoull(getenv("WS_LIMIT"), NULL, 10));
    js_std_init_handlers(rt);
    JSContext *ctx = JS_NewContext(rt);
    js_init_module_std(ctx, "std");
    js_init_module_os(ctx, "os");
    JS_SetModuleLoaderFunc2(rt, NULL, js_module_loader, js_module_check_attributes, NULL);
    js_std_add_helpers(ctx, argc - 1, argv + 1);
    size_t floor = cur;
    size_t len;
    uint8_t *harness = js_load_file(ctx, &len, argv[1]);
    if (!harness || eval_module(ctx, (const char *)harness, argv[1]))
        return 1;
    js_free(ctx, harness);
    js_std_loop(ctx);
    fprintf(stderr, "peak %zu floor %zu\n", peak, floor);
    if (trace)
        fclose(trace);
    return 0;
}
