#!/usr/bin/env python3
"""Run INSIDE Linux container for pipe timings, not through Docker's stdio relay."""
import argparse, json, os, statistics, subprocess, time

p = argparse.ArgumentParser()
p.add_argument('mode', choices=['concurrency', 'pipes', 'startup'])
p.add_argument('--qjs', default='/work/qjs-static')
p.add_argument('--bootstrap', default='/proposal/bootstrap.js')
p.add_argument('--trace')
p.add_argument('--executable', action='store_true')
p.add_argument('--compare', help='startup: alternate source qjs with this bytecode executable')
p.add_argument('--n', type=int, default=32)
a = p.parse_args()

def wire(m):
    return (json.dumps(m, ensure_ascii=True, separators=(',', ':')) + '\n').encode()

def spawn():
    cmd = [a.qjs] if a.executable else [a.qjs, '-m', a.bootstrap]
    if a.trace:
        cmd = ['strace', '-f', '-qq', '-o', a.trace] + cmd
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def session(source, answer, fragment=False):
    start = time.perf_counter_ns()
    proc = spawn()
    hello = json.loads(proc.stdout.readline())
    ready = json.loads(proc.stdout.readline())
    assert hello == {'t':'hello','v':1} and ready == {'t':'ready'}, (hello, ready)
    parked = time.perf_counter_ns()
    msg = wire({'t':'code','source':source,'providers':[{'name':'api','fns':['echo','fail']}]})
    if fragment:
        for pos in range(0,len(msg),7):
            proc.stdin.write(msg[pos:pos+7]); proc.stdin.flush()
            time.sleep(.0001)
    else:
        proc.stdin.write(msg); proc.stdin.flush()
    calls, logs, done = [], [], None
    for raw in proc.stdout:
        m = json.loads(raw)
        if m['t'] == 'call':
            calls.append(m); answer(proc, m)
        elif m['t'] == 'log': logs.append(m)
        elif m['t'] == 'done': done = m; break
        else: raise AssertionError(m)
    end = time.perf_counter_ns()
    proc.stdin.close()
    rc = proc.wait(timeout=10)
    errors = proc.stderr.read().decode()
    assert rc == 0 and done and done['ok'], (rc, done, errors)
    return done['value'], calls, logs, (parked-start)/1e6, (end-parked)/1e6

def send(proc,m):
    proc.stdin.write(wire(m)); proc.stdin.flush()

if a.mode == 'concurrency':
    waiting = []
    response_order = []
    def answer(proc,m):
        waiting.append(m)
        if len(waiting) == a.n:
            # The guest MUST emit all calls without receiving any answers.
            time.sleep(.02)
            for c in reversed(waiting):
                response_order.append(c['id'])
                send(proc, {'t':'result','id':c['id'],'value':c['args']['i']*2})
        elif len(waiting) > a.n:
            if m['fn']=='fail':
                send(proc, {'t':'err','id':m['id'],'code':'DENIED','message':'policy'})
            else:
                send(proc, {'t':'result','id':m['id'],'value':m['args']})
    source = '''
      console.log("before\\nlog", "日本語😀");
      const r = await Promise.all(Array.from({length:32},(_,i)=>api.echo({i})));
      const next = await api.echo({unicode:"日本語😀",nested:r[31]});
      let denied=false; try { await api.fail(null); } catch(e) { denied=String(e).includes('DENIED'); }
      await new Promise(resolve=>setTimeout(resolve,1));
      console.info('after');
      return {r,next,denied,then:typeof api.then};
    '''
    source=source.replace('length:32',f'length:{a.n}').replace('r[31]',f'r[{a.n-1}]')
    value,calls,logs,boot,ms = session(source,answer,fragment=True)
    assert value['r'] == list(range(0,a.n*2,2)) and value['denied']
    assert value['next'] == {'unicode':'日本語😀','nested':2*(a.n-1)} and value['then']=='undefined'
    assert len(calls)==a.n+2 and len(logs)==2
    print(json.dumps({'PASS':True,'max_inflight':a.n,'response_order':response_order,
                      'calls':len(calls),'logs':len(logs),'parked_ms':boot,'run_ms':ms}))
elif a.mode == 'pipes':
    for size,count,window in [(0,2000,1),(1024,1000,1),(102400,100,1),(1048400,20,1),(0,4096,64)]:
        samples=[];starts={};total_bytes=[0]
        def answer(proc,m):
            t=time.perf_counter_ns()
            # Guest timestamps bracket both directions; host keeps total bytes.
            response={'t':'result','id':m['id'],'value':m['args']}
            total_bytes[0] += len(wire(m))+len(wire(response))
            send(proc,response)
        source=f'''
          const s='x'.repeat({size}); let samples=[];
          for(let i=0;i<{count};i+={window}) {{
            const t=Date.now();
            await Promise.all(Array.from({{length:{window}}},()=>api.echo(s)));
          }} return true;
        '''
        runs=[]
        for _ in range(3):
            value,calls,logs,boot,ms=session(source,answer)
            assert len(calls)==count
            runs.append(ms)
        med=statistics.median(runs)
        print(json.dumps({'payload':size,'count':count,'window':window,'runs_ms':runs,
            'median_us_per_call':med*1000/count,'calls_per_s':count*1000/med,
            'MiB_per_s':total_bytes[0]/3/1048576/(med/1000)}),flush=True)
elif a.mode == 'startup':
    boots=[];runs=[]
    other_boots=[];other_runs=[]
    for _ in range(100):
        modes=[False,True] if a.compare and _%2==0 else ([True,False] if a.compare else [False])
        original=(a.qjs,a.executable)
        for other in modes:
            if other:a.qjs,a.executable=a.compare,True
            else:a.qjs,a.executable=original
            value,calls,logs,boot,ms=session('return 42;',lambda *_:None)
            assert value==42
            (other_boots if other else boots).append(boot)
            (other_runs if other else runs).append(ms)
        a.qjs,a.executable=original
    def stats(v):return {'median':statistics.median(v),'p90':sorted(v)[89]}
    result={'n':100,'spawn_to_ready_ms':stats(boots),'code_to_done_ms':stats(runs)}
    if a.compare:result['bytecode']={'spawn_to_ready_ms':stats(other_boots),'code_to_done_ms':stats(other_runs)}
    print(json.dumps(result))
