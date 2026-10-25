import pathlib,json,hashlib
r=pathlib.Path(__file__).resolve().parent
bs=(r/'bootstrap.js').read_text()
assert bs.count('std.exit(status)')==1
(r/'bootstrap-bench.js').write_text(bs.replace('std.exit(status)','__bench_finish(status)').replace('function finish(ok,value) {','function finish(ok,value) { __bench_result(ok);'))
codec=(r/'codec.mjs').read_text().replace('export function ','function ')
prepared='globalThis.__codec=(()=>{\n'+codec+'\ninstallBase64();return {parse,stringify};})();\n'
(r/'codec-prepared.js').write_text(prepared)
f=r/'fixtures';f.mkdir(exist_ok=True)
def data(n,count):
    rows=[dict(id=i,name=f'item-{i:05}',active=i%2==0,score=i*5,tags=['one','two','three'],nested=dict(x=i%17,y='hello')) for i in range(count)]
    s=json.dumps(dict(items=rows,padding=''),separators=(',',':'))
    assert len(s)<n,(len(s),n)
    return s[:-2]+'x'*(n-len(s))+s[-2:]
cases={
 'empty':'',
 'return2':'return 2;',
 'one_tool':"const a=JSON.parse(__codec.stringify([new Uint8Array([1,2,3,4]),{query:'hello'}]));const r=__codec.parse(JSON.stringify(await tool.echo(...a)));if(r.value!==1||r.binary[2]!==3)throw Error('bad reply');return r.value;",
 'promise10':"const rs=await Promise.all(Array.from({length:10},(_,i)=>tool.echo(i,{query:'hello'})));if(rs.reduce((a,r)=>a+r.value,0)!==55)throw Error('bad sum');return rs.length;",
 'source8k':'let total=0;\n'+''.join(f'total+={i};\n' for i in range(500))+'return total;',
 'json64k':"const o=JSON.parse(__input);const s=JSON.stringify(o);if(o.items.length!==400||s.length!==65536)throw Error('bad json');__bench_live();return s.length;",
 'json1m':"const o=JSON.parse(__input);const s=JSON.stringify(o);if(o.items.length!==7000||s.length!==1048576)throw Error('bad json');__bench_live();return s.length;",
}
cases['source8k']+=' '*(8192-len(cases['source8k']))
assert len(cases['source8k'])==8192
for k,code in cases.items():
    (f/(k+'.run')).write_text(json.dumps(dict(t='run',code=code,ns={'tool':['echo']}),separators=(',',':')))
    (f/(k+'.json')).write_text(data(65536,400) if k=='json64k' else data(1048576,7000) if k=='json1m' else '{}')
# A current-executor comparison: codec is parsed inside the submitted AsyncFunction.
for k in ('return2','one_tool','promise10'):
    c='const __codec=(()=>{'+codec+';installBase64();return {parse,stringify};})();'+cases[k]
    (f/(k+'-codec.run')).write_text(json.dumps(dict(t='run',code=c,ns={'tool':['echo']}),separators=(',',':')))
    (f/(k+'-codec.json')).write_text('{}')
# Baseline address ranges, to intersect with actual child dirty page addresses.
q=r/'quickjs-2026-06-04'/'quickjs.c'
s=q.read_text()
s+='''
/* Measurement-only exports: no changes to the engine's allocation policy. */
static void brange(int f,const char *kind,const void *p,size_t n) {
 if(p&&n)dprintf(f,"{\\"kind\\":\\"%s\\",\\"start\\":%lu,\\"end\\":%lu}\\n",kind,(unsigned long)p,(unsigned long)p+n);
}
void bench_ranges(JSRuntime *rt,int f) {
 brange(f,"runtime",rt,sizeof(*rt));
 brange(f,"atom_table",rt->atom_array,rt->atom_size*sizeof(void*));
 brange(f,"atom_table",rt->atom_hash,rt->atom_hash_size*sizeof(uint32_t));
 for(int i=0;i<rt->atom_size;i++){JSAtomStruct*p=rt->atom_array[i];if(!atom_is_free(p))brange(f,"atom",(char*)p-8,8+sizeof(*p)+(p->len<<p->is_wide_char));}
 struct list_head *el;
 list_for_each(el,&rt->gc_obj_list){JSGCObjectHeader*p=list_entry(el,JSGCObjectHeader,link);brange(f,"gc_header",(char*)p-8,8+sizeof(*p));}
 for(int i=0;i<JS_MALLOC_BLOCK_SIZE_COUNT;i++)list_for_each(el,&rt->malloc_ctx.arena_list[i]){JSMallocArena*p=list_entry(el,JSMallocArena,link);brange(f,"qjs_arena_header",p,sizeof(*p));brange(f,"qjs_arena",p,JS_MALLOC_ARENA_SIZE);}
}
void bench_detach(JSRuntime *rt){for(int i=0;i<JS_MALLOC_BLOCK_SIZE_COUNT;i++)init_list_head(&rt->malloc_ctx.free_arena_list[i]);}
'''
if 'void bench_ranges(' not in q.read_text():q.write_text(s)
print('input hashes',json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (r/'bootstrap.js',r/'codec.mjs',r/'qjs',r/'quickjs-2026-06-04.tar.xz')},indent=2))
