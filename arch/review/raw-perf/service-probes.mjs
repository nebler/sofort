// Copy to runtime/build. Attribution/counting probes, not a replacement benchmark.
import {ShardBackend} from './shard-backend.js';
import {SandboxPool} from './pool.js';
import {MicroVMExecutor} from './executor.js';
const binary=process.env.JITK_SHARD_BINARY,snapshot=process.env.JITK_SHARD_SNAPSHOT;
const mode=process.argv[2];
const backend=new ShardBackend({binary,snapshot,slots:2,owners:1});
const pool=new SandboxPool(backend,0,2),ex=new MicroVMExecutor(pool,()=> 'allow',5000);
await backend.ready;
try {
  if(mode==='hol') {
    // Warm both physical slots, then start a CPU-bound generation on owner 0.
    await Promise.all([ex.execute('return 2;',{}),ex.execute('return 2;',{})]);await pool.drain();
    const t=performance.now();
    const busy=ex.execute('while(true){}',{}, {timeout:300});
    await new Promise(r=>setTimeout(r,30));
    const tinyStart=performance.now(),tiny=await ex.execute('return 2;',{});
    console.log(JSON.stringify({event:'hol',busyDeadlineMs:300,tinySubmittedMs:tinyStart-t,tinyWallMs:performance.now()-tinyStart,tiny,busy:await busy}));
  } else if(mode==='counts') {
    const providers={echo:async x=>x};
    for(let i=0;i<5;i++){await ex.execute('return (await codemode.echo(41))+1',providers);await pool.drain();}
    const original={parse:JSON.parse,stringify:JSON.stringify,clone:globalThis.structuredClone};
    const counts={parse:0,stringify:0,clone:0,stringifyBytes:0};
    JSON.parse=(...a)=>{counts.parse++;return original.parse(...a);};
    JSON.stringify=(...a)=>{counts.stringify++;const s=original.stringify(...a);counts.stringifyBytes+=Buffer.byteLength(s??'');return s;};
    globalThis.structuredClone=(...a)=>{counts.clone++;return original.clone(...a);};
    for(let i=0;i<10;i++){const r=await ex.execute('return (await codemode.echo(41))+1',providers);if(r.result!==42)throw Error('bad result');await pool.drain();}
    Object.assign(JSON,{parse:original.parse,stringify:original.stringify});globalThis.structuredClone=original.clone;
    console.log(JSON.stringify({event:'counts',n:10,counts}));
  } else if(mode==='batch') {
    for(const n of [1,10]) {
      const result=await ex.execute(`return await Promise.all(Array.from({length:${n}},(_,i)=>codemode.echo(i)));`,{echo:async x=>x});
      await pool.drain();console.log(JSON.stringify({event:'batch',calls:n,result}));
    }
  } else throw Error('unknown mode');
} finally {await pool.close();}
