/* A feasibility probe: engine embedding without qjs.c or quickjs-libc.c.
 * No host I/O. This is not a complete code-mode executor or security boundary. */
#include "quickjs.h"
#include <string.h>
int jitk_eval_probe(void) {
    JSRuntime *rt = JS_NewRuntime();
    if (!rt) return 1;
    JS_SetMemoryLimit(rt, 8 * 1024 * 1024);
    JS_SetMaxStackSize(rt, 128 * 1024);
    JSContext *ctx = JS_NewContext(rt);
    if (!ctx) { JS_FreeRuntime(rt); return 2; }
    const char *code = "JSON.stringify({v: new Proxy({x:21},{get:(t,k)=>t[k]*2}).x})";
    JSValue value = JS_Eval(ctx, code, strlen(code), "probe.js", JS_EVAL_TYPE_GLOBAL);
    int rc = 3;
    if (!JS_IsException(value)) {
        const char *str = JS_ToCString(ctx, value);
        if (str) { rc = strcmp(str, "{\"v\":42}") ? 4 : 0; JS_FreeCString(ctx, str); }
    }
    JS_FreeValue(ctx, value);
    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    return rc;
}
#ifdef PROBE_MAIN
int main(void) { return jitk_eval_probe(); }
#endif
