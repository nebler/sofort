#!/usr/bin/env python3
from pathlib import Path
for engine in ('quickjs','quickjs-ng'):
    p=Path('/work')/engine/'bootstrap.c'
    s=p.read_text()
    s=s.replace('int main(int argc, char **argv)\n{','#include "../bench_qjs.h"\nint main(int argc, char **argv)\n{\n  bench_start=bench_ns();')
    s=s.replace('  js_std_add_helpers(ctx, argc, argv);','  bench_install(ctx);\n  js_std_add_helpers(ctx, argc, argv);')
    # Some generators create the context via an inlined raw intrinsic setup.
    if '  bench_install(ctx);' not in s:
        at=s.index('  js_std_eval_binary(ctx,')
        s=s[:at]+'  bench_install(ctx);\n'+s[at:]
    p.write_text(s)
