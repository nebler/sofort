// Measurement helper for 04's integrated executor. No provider credentials.
import {pathToFileURL} from 'node:url';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import {loadavg} from 'node:os';
import {HyperlightBackend} from './backend.ts';
import {hyperlightConfig} from './config.ts';
const [build, mode, cJSON, cfgJSON] = process.argv.slice(2);
const c=JSON.parse(cJSON),cfg=JSON.parse(cfgJSON);
const {worker,snapshot}=cfg.hyperlight??hyperlightConfig();
const {MicroVMExecutor,SandboxPool,JitkBackend}=await import(pathToFileURL(build+'/executor.js'));
const backend=mode.startsWith('hl-') ? new HyperlightBackend(worker,snapshot,20000) :
  new JitkBackend(cfg.vmm,{launcher:cfg.launcher,image:cfg.image,sandboxProfile:cfg.sandboxProfile,startupMs:10000,lifetimeMs:20000});
const parked=mode==='jitk-parked'||mode==='hl-strict-prespawned';
let workerPid;
const park=backend.park.bind(backend);
backend.park=async(...args)=>{const s=await park(...args);workerPid=s.child?.pid;return s;};
const pool=new SandboxPool(backend,parked?1:0,1,{refillConcurrency:1,
  parkingGate:{idleCorePercent:0,evidence:cfg.parkingEvidence}});
const ex=new MicroVMExecutor(pool,()=> 'allow',10000);
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
try {
  if(parked){await pool.warm();await new Promise(r=>setTimeout(r,5));}
  console.log(JSON.stringify({t:'prepared',worker_pid:workerPid??null}));
  for await(const line of rl){assert.equal(JSON.parse(line).t,'go');break;}
  let calls=0,active=0,maxPending=0;const stamps=[];
  const providers=[{name:'test',fns:{echo:async x=>{
    calls++;active++;maxPending=Math.max(active,maxPending);stamps.push(performance.now());
    await new Promise(r=>setTimeout(r,5));active--;return x;
  }}}];
  const start=performance.now();const result=await ex.execute(c.code,providers);const ms=performance.now()-start;
  assert(!result.error,JSON.stringify(result));assert.deepEqual(result.result,c.expected);
  assert.equal(calls,c.calls);
  console.log(JSON.stringify({t:'measurement',latency_ms:ms,tool_calls:calls,max_pending:maxPending,
    call_stamps_ms:stamps,load_at_result:loadavg(),pool_at_resolve:pool.snapshot(),worker_pid:workerPid??null}));
} catch(e){console.log(JSON.stringify({t:'measurement',error:String(e)}));}
finally{await pool.close();rl.close();}
