import pathlib,shutil
r=pathlib.Path(__file__).resolve().parent
src=r/'quickjs-2026-06-04';dst=r/'trace-src';dst.mkdir(exist_ok=True)
for p in src.iterdir():
    if p.is_file() and p.suffix in ('.c','.h'):shutil.copy2(p,dst/p.name)
h=(dst/'quickjs.h').read_text().replace('static inline JSRefCountHeader *__js_rc(void *ptr)','void bench_touch(const void *,int);\nstatic inline JSRefCountHeader *__js_rc(void *ptr)')
h=h.replace('p->ref_count++;','(bench_touch(p,1),p)->ref_count++;').replace('--p->ref_count','--(bench_touch(p,1),p)->ref_count')
(dst/'quickjs.h').write_text(h)
s=(dst/'quickjs.c').read_text()
lo=s.index('static JSAtom JS_DupAtomRT(');hi=s.index('void JS_FreeAtomRT(',lo)
parts=[s[:lo],s[lo:hi],s[hi:]]
for i,part in enumerate(parts):
    k=2 if i==1 else 1
    part=part.replace('js_rc(p)->ref_count++',f'(bench_touch(js_rc(p),{k}),js_rc(p))->ref_count++')
    part=part.replace('js_rc(p)->ref_count--',f'(bench_touch(js_rc(p),{k}),js_rc(p))->ref_count--')
    part=part.replace('--js_rc(p)->ref_count',f'--(bench_touch(js_rc(p),{k}),js_rc(p))->ref_count')
    parts[i]=part
s=''.join(parts)
for lhs in ['ar->first_free_block =','ar->n_used_blocks++','ar->n_used_blocks--']:
    s=s.replace(lhs,lhs.replace('ar->','(bench_touch(ar,3),ar)->'))
for lhs in ['b->u.free_next = ar->','b->u.block_idx = block_idx']:
    s=s.replace(lhs,lhs.replace('b->','(bench_touch(b,3),b)->',1))
lo=s.index('static void gc_decref_child(');hi=s.index('void JS_RunGC(',lo)
g=s[lo:hi]
g=g.replace('(bench_touch(js_rc(p),1)', '(bench_touch(js_rc(p),4)')
g=g.replace('js_rc(p)->mark =','(bench_touch(js_rc(p),4),js_rc(p))->mark =')
g=g.replace('static void JS_RunGCInternal(JSRuntime *rt, BOOL remove_weak_objects)\n{','static void JS_RunGCInternal(JSRuntime *rt, BOOL remove_weak_objects)\n{\nbench_touch(NULL,5);')
s=s[:lo]+g+s[hi:]
(dst/'quickjs.c').write_text(s)
