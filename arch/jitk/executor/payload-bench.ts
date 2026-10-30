// Payload cost and memory class measurement on this host's ring engine (one
// slot, JITK_SHARD_CLASS, default glue-2m): guest CPU (STATS owner CPU) and
// wall time of runs that move a big source, tool reply or completion through
// the guest codec (kernel/ring-bootstrap.js.in), then the class's usable heap
// and heap capacity (STATS heapPeakBytes at out of memory), the largest reply
// (up to the class's reply bound) and completion, and the engine's resident memory.
// Offline measurement: run one at a time on a quiet host (shard/README.md
// "Limits"). `run.sh payload-bench [sizes|memory]`, default both.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {MicroVMExecutor} from './executor.js';
import {SandboxPool} from './pool.js';
import {ShardBackend,type ShardMetrics} from './shard-backend.js';
import {shardClass} from './select-backend.js';

const mode=process.argv[2]??'all';
const memoryClass=shardClass();
const rows:ShardMetrics[]=[];
const backend=new ShardBackend({binary:process.env.JITK_SHARD_BINARY!,snapshot:process.env.JITK_SHARD_SNAPSHOT!,slots:1,memoryClass,onMetrics:m=>rows.push(m)});
backend.child.stderr!.on('data',(b:Buffer)=>process.stderr.write(b));
const pool=new SandboxPool(backend,0,1);
const ex=new MicroVMExecutor(pool,()=> 'allow',20000);
const load=()=>execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim().replace(/.*load averages?: /,'');
const median=(a:number[])=>[...a].sort((x,y)=>x-y)[Math.ceil(a.length/2)-1];
type Fns=Record<string,(...a:unknown[])=>Promise<unknown>>;
type Outcome={result?:unknown;error?:string};
async function run(code:string,fns:Fns={}):Promise<Outcome&{cpuUs:number;wallMs:number;heapPeakBytes?:number}> {
  rows.length=0;const t=performance.now();
  const r=await ex.execute(code,fns);const wallMs=performance.now()-t;await pool.drain();
  return {result:r.result,error:r.error,cpuUs:rows.length?Number(rows[0].ownerCpuNs)/1e3:NaN,wallMs,heapPeakBytes:rows[0]?.heapPeakBytes};
}
/** p50 guest CPU and wall over n runs after 3 warmups; null when the run fails (the class's heap). */
async function measure(code:string,fns:Fns,check:(r:unknown)=>boolean,n:number) {
  for(let i=0;i<3;i++){const r=await run(code,fns);if(r.error||!check(r.result))return {error:r.error??'wrong result'};}
  const cpu:number[]=[],wall:number[]=[];
  for(let i=0;i<n;i++){const r=await run(code,fns);assert.ok(!r.error&&check(r.result),r.error??"wrong result");cpu.push(r.cpuUs);wall.push(r.wallMs);}
  return {cpuUsP50:Math.round(median(cpu)),wallMsP50:Number(median(wall).toFixed(3))};
}
const KB=1024;
try {
  await backend.ready;
  console.log(JSON.stringify({event:'environment',memoryClass,limits:backend.limits,platform:process.platform,load:load()}));
  if(mode==='all'||mode==='sizes'){
    const base=await measure('return 2',{},r=>r===2,200);
    console.log(JSON.stringify({event:'size',case:'return 2',bytes:0,...base}));
    for(const bytes of [1*KB,8*KB,60*KB,500*KB]){
      const n=bytes>100*KB?20:bytes>10*KB?50:100;
      // Source: tenant code of `bytes` UTF-8 bytes (ASCII), decoded once by the bootstrap.
      if(bytes<=60*KB){
        const code='return 1;//'+'x'.repeat(bytes-11);
        console.log(JSON.stringify({event:'size',case:'source',bytes,...await measure(code,{},r=>r===1,n)}));
      }
      // Reply: a tool result whose JSON is `bytes` long, decoded and parsed by the guest.
      const text='x'.repeat(bytes-'{"ok":""}'.length);
      console.log(JSON.stringify({event:'size',case:'reply',bytes,...await measure('return (await codemode.big()).length',{big:async()=>text},r=>r===text.length,n)}));
      // Completion: a value whose DONE JSON is `bytes` long, encoded by the guest.
      console.log(JSON.stringify({event:'size',case:'completion',bytes,...await measure(`return 'x'.repeat(${text.length})`,{},r=>r===text,n)}));
    }
  }
  if(mode==='all'||mode==='memory'){
    // Usable heap: 16 KiB buffers until QuickJS runs out of memory.
    const heap=await run('const keep=[];try{for(;;)keep.push(new ArrayBuffer(16384));}catch{}const n=keep.length;keep.length=0;return n*16384');
    // The largest reply (to the class's reply bound) and completion (to the
    // 1 MiB frame) in JSON bytes that still work, to 1 KiB.
    const largest=async(ok:(bytes:number)=>Promise<boolean>,hi=1024*KB)=>{let lo=0;if(await ok(hi))return hi;while(hi-lo>KB){const mid=Math.floor((lo+hi)/2/KB)*KB;if(await ok(mid))lo=mid;else hi=mid;}return lo;};
    const replyBound=backend.limits.js!.replyBytes;
    const reply=await largest(async bytes=>{const text='x'.repeat(bytes-9);const r=await run('return (await codemode.big()).length',{big:async()=>text});return r.result===text.length;},replyBound);
    const completion=await largest(async bytes=>{const r=await run(`return 'x'.repeat(${bytes-9})`);return typeof r.result==='string';});
    const echo=await largest(async bytes=>{const r=await run(`const s='x'.repeat(${bytes-9});return (await codemode.echo(s)).length`,{echo:async x=>x});return r.result===bytes-9;});
    // macOS footprint (dirty memory charged to the process), in KiB; RSS also counts clean file pages.
    const footprint=(pid:number)=>{if(process.platform!=='darwin')return undefined;try{const m=/Footprint: ([\d.]+) (KB|MB)/.exec(execFileSync('/usr/bin/footprint',['-p',String(pid)],{encoding:'utf8'}));return m?Math.round(Number(m[1])*(m[2]==='MB'?1024:1)):undefined;}catch{return undefined;}};
    // Resident memory of the engine processes (macOS: the zygote, its template and the slot's engine process).
    const rss=()=>{
      const pids=execFileSync('/bin/ps',['-A','-o','pid=,ppid=,rss=,comm='],{encoding:'utf8'}).trim().split('\n').map(l=>l.trim().split(/\s+/)).map(([pid,ppid,kb,comm])=>({pid:Number(pid),ppid:Number(ppid),kb:Number(kb),comm}));
      const tree=new Set([backend.child.pid!]);let grew=true;
      while(grew){grew=false;for(const p of pids)if(tree.has(p.ppid)&&!tree.has(p.pid)){tree.add(p.pid);grew=true;}}
      return pids.filter(p=>tree.has(p.pid)).map(p=>({pid:p.pid,ppid:p.ppid,kb:p.kb,footprintKiB:footprint(p.pid)}));
    };
    const idle=rss();
    await run(`return 'x'.repeat(${Math.max(0,completion-64*KB)})`);
    const afterLarge=rss();
    console.log(JSON.stringify({event:'memory',memoryClass,heapBytes:heap.result,heapCapacityBytes:heap.heapPeakBytes,replyBoundBytes:replyBound,largestReplyBytes:reply,largestCompletionBytes:completion,largestEchoBytes:echo,rssKiB:{idle,afterLarge},load:load()}));
  }
} finally {await pool.close();}
