#!/usr/bin/env python3
from pathlib import Path
import shutil
here=Path(__file__).resolve().parent
root=Path('/tmp/jitk-06')
shutil.copy(here/'bench_qjs.h',root/'bench_qjs.h')
for engine in ('quickjs','quickjs-ng'):
    f=root/engine/'qjs.c'
    s=f.read_text()
    s=s.replace('int main(int argc, char **argv)\n{', '#include "../bench_qjs.h"\nint main(int argc, char **argv)\n{\n    bench_start=bench_ns();',1)
    s=s.replace('        js_std_add_helpers(ctx, argc - optind, argv + optind);', '        bench_install(ctx);\n        js_std_add_helpers(ctx, argc - optind, argv + optind);',1)
    f.write_text(s)
    code=(here/'bootstrap.js').read_text()
    if engine=='quickjs-ng': code=code.replace("from 'std'", "from 'qjs:std'")
    (root/engine/'bootstrap.js').write_text(code)
