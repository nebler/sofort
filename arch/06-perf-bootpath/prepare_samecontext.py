#!/usr/bin/env python3
from pathlib import Path
p=Path('/work/quickjs/qjs.c')
s=p.read_text().replace('#include "../bench_qjs.h"','#include "../bench_qjs.h"\n#include "bootstrap-data.c"')
s=s.replace('        for(i = 0; i < include_count; i++) {','        if (getenv("JITK_BYTECODE")) {\n            js_std_eval_binary(ctx,qjsc_bootstrap,qjsc_bootstrap_size,0);\n            goto bench_loop;\n        }\n        for(i = 0; i < include_count; i++) {')
s=s.replace('        js_std_loop(ctx);','bench_loop:\n        js_std_loop(ctx);')
p.write_text(s)
