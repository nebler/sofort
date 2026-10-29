// One measurement per adapter process; Node startup and parked preparation excluded.
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import readline from 'node:readline';
import assert from 'node:assert/strict';
const [build,mode,caseName,selectionJSON]=process.argv.slice(2);
const selection=JSON.parse(selectionJSON);
const {MicroVMExecutor,SandboxPool}=await import(pathToFileURL(build+'/executor.js'));
const {ShardBackend}=await import(pathToFileURL(build+'/shard-backend.js'));
const c=JSON.parse(readFileSync(new URL('./cases.json',import.meta.url),'utf8'))[caseName];
// The executor's default engine: the ring engine (HVF on macOS) the controller
// froze, two slots (cold: a slot per run; parked: one claimed ahead).
const backend=new ShardBackend({binary:selection.executor.engine,snapshot:selection.executor.snapshot,slots:2});
const lifecycle={};
const pool=new SandboxPool(backend,mode==='executor-parked'?1:0,2,{refillConcurrency:1,
    onEvent:(event,_sandbox,at)=>{lifecycle[event]=at;},
    parkingGate:{idleCorePercent:0,evidence:'kernel/.READY: G1 idle 0%, 1000 exchanges (functional gate)'}});
const ex=new MicroVMExecutor(pool,()=> 'allow',10000);
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
let measurement;
try {
    if(mode==='executor-parked'){await pool.warm();await new Promise(r=>setTimeout(r,5));}
    console.log(JSON.stringify({t:'prepared'}));
    for await (const line of rl){assert.equal(JSON.parse(line).t,'go');break;}
    let toolCalls=0,active=0,maxPending=0;
    const providers=[{name:'test',fns:{echo:async(value)=>{
        toolCalls++;active++;maxPending=Math.max(maxPending,active);
        if(c.tool_delay_ms)await new Promise(r=>setTimeout(r,c.tool_delay_ms));
        active--;return value;
    }}}];
    const loadAtTimingStart=(await import('node:os')).loadavg();
    const marks={};const start=performance.now();
    const result=await ex.execute(c.code,providers,{onTiming:(event,at)=>{marks[event]=at;}});
    const callerResolve=performance.now();const latency=callerResolve-start;
    assert(!result.error,JSON.stringify(result));assert.deepEqual(result.result,c.expected);
    assert.equal(toolCalls,caseName==='promise10_5ms'?10:caseName.startsWith('one_tool')?1:0);
    if(selection.executor.integrated)assert.equal(lifecycle.kill,undefined,'kill must be off successful resolution path');
    measurement={t:'measurement',latency_ms:latency,tool_calls:toolCalls,max_pending:maxPending,
        load_at_timing_start:loadAtTimingStart,load_at_result:(await import('node:os')).loadavg(),pool_at_resolve:pool.snapshot(),
        timing_marks:{...marks,callerResolve},done_to_resolve_ms:marks.done===undefined?undefined:callerResolve-marks.done};
} catch(e){measurement={t:'measurement',error:String(e)};}
finally{await pool.close();await backend.close();rl.close();if(measurement)measurement.cleanup_events=lifecycle;}
console.log(JSON.stringify(measurement));
