import os,sys,pathlib,json,subprocess,signal,time,struct,collections,hashlib
R=pathlib.Path(__file__).resolve().parent
RAW=R/'raw';RAW.mkdir(exist_ok=True)
def stopped(pid):
    for _ in range(2000):
        if pathlib.Path(f'/proc/{pid}/stat').read_text().rsplit(')',1)[1].split()[0] in ('T','t'):return
        time.sleep(.001)
    raise RuntimeError(f'{pid} did not stop')
def stat(pid):
    a=pathlib.Path(f'/proc/{pid}/stat').read_text().rsplit(')',1)[1].split()
    return dict(minflt=int(a[7]),majflt=int(a[9]),utime_ticks=int(a[11]),stime_ticks=int(a[12]))
def snap(pid,ranges):
    stopped(pid)
    sm=pathlib.Path(f'/proc/{pid}/smaps_rollup').read_text()
    vals={k.strip():int(v.split()[0])*1024 for ln in sm.splitlines()[1:] if ':' in ln for k,v in [ln.split(':',1)]}
    maps=pathlib.Path(f'/proc/{pid}/maps').read_text()
    sets=collections.defaultdict(set)
    for r in ranges:
        for p in range(r['start']//4096,(r['end']-1)//4096+1):sets[r['kind']].add(p)
    rows=[]
    with open(f'/proc/{pid}/pagemap','rb',buffering=0) as pm:
        for ln in maps.splitlines():
            cols=ln.split(maxsplit=5);lo,hi=[int(x,16) for x in cols[0].split('-')]
            if 'w' not in cols[1] or cols[1][3]!='p':continue
            name=cols[5] if len(cols)>5 else ''
            pm.seek(lo//4096*8);buf=pm.read((hi-lo)//4096*8)
            for i,(v,) in enumerate(struct.iter_unpack('Q',buf)):
                present=bool(v>>63&1);anonymous=not bool(v>>61&1);ex=bool(v>>56&1);soft=bool(v>>55&1)
                if not present or not (ex and anonymous):continue
                p=lo//4096+i
                tags=[k for k,ps in sets.items() if p in ps]
                cat='stack' if name=='[stack]' else 'qjs_heap' if tags else 'heap_other' if name=='[heap]' else 'image_data' if name.startswith(str(R/'bin')) else 'anonymous_other' if not name else 'other'
                rows.append(dict(addr=p*4096,soft_dirty=soft,category=cat,tags=tags,mapping=name))
    return dict(stat=stat(pid),smaps=vals,maps=maps,pages=rows,private4=len(rows)*4096,private16=len({p['addr']//16384 for p in rows})*16384,by_category={k:len([x for x in rows if x['category']==k])*4096 for k in sorted({x['category'] for x in rows})},by_tag_overlap={k:len([x for x in rows if k in x['tags']])*4096 for k in sets})
def env():
    return dict(time=time.strftime('%Y-%m-%dT%H:%M:%S%z'),uname=list(os.uname()),page_size=os.sysconf('SC_PAGE_SIZE'),load=os.getloadavg(),uptime=pathlib.Path('/proc/uptime').read_text().strip())
def one(binary,mode,w,n,opt,label):
    dest=RAW/(label+'.jsonl');p=subprocess.Popen([str(R/'bin'/binary),str(R),mode,w,str(n),opt],stdout=subprocess.PIPE,text=True)
    ranges=[];evs=[]
    with dest.open('w') as out:
        out.write(json.dumps(dict(event='environment',binary=binary,mode=mode,workload=w,n=n,options=opt,environment=env(),binary_sha256=hashlib.sha256((R/'bin'/binary).read_bytes()).hexdigest()))+'\n')
        for ln in p.stdout:
            e=json.loads(ln);evs.append(e)
            if e['event']=='template':
                stopped(e['pid']);ranges=[json.loads(s) for s in (RAW/f"ranges-{e['pid']}.jsonl").read_text().splitlines()]
                e['snapshot']=snap(e['pid'],ranges);e['ranges']=ranges
                pathlib.Path(f"/proc/{e['pid']}/clear_refs").write_text('4')
                os.kill(e['pid'],signal.SIGCONT)
            if e['event']=='point':
                e['snapshot']=snap(e['pid'],ranges)
                if e['phase']=='start':pathlib.Path(f"/proc/{e['pid']}/clear_refs").write_text('4')
                os.kill(e['pid'],signal.SIGCONT)
            out.write(json.dumps(e)+'\n');out.flush()
    rc=p.wait();assert rc==0,(label,rc)
    print(label,len(evs),'ok',flush=True)
    return evs
if __name__=='__main__':
    # All timing-sensitive invocations are launched under flock by the caller.
    selection=sys.argv[1] if len(sys.argv)>1 and sys.argv[1] in ('memory-only','timing-only') else 'all'
    if len(sys.argv)>1 and selection=='all':
        binary,mode,w,n,opt,label=sys.argv[1:];one(binary,mode,w,int(n),opt,label)
    else:
        cases=['empty','return2','one_tool','promise10','source8k','json64k','json1m']
        configs=[('O2','default'),('O2','gc-before'),('O2','no-gc'),('O2','gc-before,no-gc'),('O2','bump'),('O2','bump,detach'),('O2','bytecode'),('Os','default'),('minimal','minimal')]
        for binary,opt in configs:
            tag=binary+'-'+opt.replace(',','-')
            for w in cases:
                if selection!='timing-only':one(binary,'census',w,10,opt+(',peak-hooks' if 'bump' not in opt else ''),tag+'-'+w+'-memory')
                if selection!='memory-only':one(binary,'cpu',w,100,opt,tag+'-'+w+'-cpu')
        for w in ['return2-codec','one_tool-codec','promise10-codec']:
            for mode,n in [('census',10),('cpu',100)]:
                if selection=='memory-only' and mode!='census' or selection=='timing-only' and mode!='cpu':continue
                one('O2',mode,w,n,'per-run-codec'+(',peak-hooks' if mode=='census' else ''),'O2-per-run-'+w+'-'+mode)
        if selection!='memory-only':
            for binary,opt in [('O2','default'),('O2','gc-before'),('O2','bump'),('Os','default'),('minimal','minimal')]:one(binary,'init','empty',100,opt,binary+'-'+opt+'-init')
            one('O2','core-init','empty',100,'default','O2-core-init')
        if selection!='timing-only':
            for repeat in (2,3):
                for w in cases:one('O2','census',w,10,'default,peak-hooks',f'O2-default-{w}-memory-template{repeat}')
            for opt in ['default','no-gc']:
                for w in cases:one('trace','census',w,2,opt+',peak-hooks',f'trace-{opt}-{w}')
