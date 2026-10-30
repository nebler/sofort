// The backend-parity corpus (R10 #7, R9 N6): one list of cases that
// parity-check.ts runs on every available Engine through the canonical
// MicroVMExecutor. `expect` is the product contract (protocol v1's limits, what
// the former libkrun path did and the ring profile is lifted toward); a
// backend that differs needs an entry in allowlist.ts.
//
// Sources: executor/verify.ts (v-), bench/hyperlight checks (h-),
// bench/cases.json (b-), executor/shard-check.ts (s-), mcp/test.mjs (m-), and
// targeted cases at each documented difference (t-). Sizes at a limit are
// derived from the generated ABI table, never typed in.
import {IPC,ARENA_CLASSES} from '../abi.js';
import {LIMIT} from '../../protocol/dispatcher.js';
import {executionBody,jsJob} from '../code.js';
import {DEFAULT_SHARD_CLASS,shardWire} from '../shard-backend.js';
import bench from '../../bench/cases.json' with {type:'json'};

/** Error classes are the MCP server's stable codes (mcp/jitk.mjs classify). */
export type ErrorClass='TIMEOUT'|'CANCELLED'|'POLICY'|'LIMIT'|'SANDBOX'|'GUEST_ERROR';
export type Expect=
  | {ok:unknown;logs?:string[];effects?:number}
  | {error:ErrorClass;match?:string;logs?:string[];effects?:number}
  /** burst cases: how many of the concurrent executes ended in each class */
  | {counts:Record<string,number>};
export type Case={
  id:string;
  /** Where the case came from: a file, or `targeted: <limit>`. */
  source:string;
  code:string;
  /** Namespace -> fixture tool names (parity-check.ts FIXTURES); default none.
   *  The `mcp` fixture always exposes the demo provider (mcp/providers/demo.mjs). */
  tools?:Record<string,string[]>;
  prelude?:Record<string,string>;
  fixture?:'exec'|'mcp';
  /** execute() timeout in ms (default 5000). */
  timeout?:number;
  /** Host approves requireApproval calls. */
  approve?:boolean;
  /** Run first on the same backend (state must not leak into `code`). */
  before?:string;
  /** Run `n` executes at once on a dedicated pool of this shape. */
  burst?:{n:number;maxLive:number;maxWaiting:number};
  expect:Expect;
};

const nest=(k:number)=>'['.repeat(k)+'0'+']'.repeat(k);
const nested=(k:number):unknown=>k?[nested(k-1)]:0;
/** The longest tenant code of `k` two-byte characters (é: six bytes each in a
 *  JSON-escaped START source) that both paths accept: the console path's
 *  body (the larger, with its embedded codec) is at most LIMIT.code UTF-8
 *  bytes; the shard's START source for it must fit ring::SOURCE_LIMIT. */
const codeOf=(k:number)=>`return '${'é'.repeat(k)}'.length`;
const bodyBytes=(k:number)=>{try{return Buffer.byteLength(executionBody(jsJob(codeOf(k),[]),false));}catch{return Infinity;}};
let atCodeChars=0;
while(bodyBytes(atCodeChars+1)<=LIMIT.code)atCodeChars+=bodyBytes(atCodeChars+256)<=LIMIT.code?256:1;
const atCode=codeOf(atCodeChars);
if(Buffer.byteLength(shardWire(executionBody(jsJob(atCode,[]),true),[]))>IPC.sourceBytes)throw Error('parity: LIMIT.code does not fit the ring source');
/** Reply string length whose `{"ok":"..."}` encoding is exactly `bytes`. */
const replyString=(bytes:number)=>bytes-'{"ok":""}'.length;
/** executor/policy/policy.mjs createRun: limits.calls defaults to 256 per run. */
const POLICY_CALLS=256;
const t1=['echo'];
const T={t:['echo','add1','big','fail','delay','hang']};

export const CASES:Case[]=[
  // executor/verify.ts
  {id:'v-demo',source:'executor/verify.ts',code:"const r=await github.listIssues({repo:'x'});return r.length",tools:{github:['listIssues']},expect:{ok:2}},
  {id:'v-binary',source:'executor/verify.ts',code:'return await github.echo(new Uint8Array([0,127,255]))',tools:{github:t1},expect:{ok:new Uint8Array([0,127,255])}},
  {id:'v-fanout-utf8',source:'executor/verify.ts',code:"return await Promise.all([github.echo('größer 🌍'), github.echo(2)])",tools:{github:t1},expect:{ok:['größer 🌍',2]}},
  {id:'v-console-prelude',source:'executor/verify.ts',code:"console.warn('a',2);return github.local(3)",tools:{github:t1},prelude:{github:'github.local=x=>x+2;'},expect:{ok:5,logs:['[warn] a 2']}},
  {id:'v-deny',source:'executor/verify.ts',code:'return await github.blocked()',tools:{github:['blocked']},expect:{error:'POLICY',match:'policy denied',effects:0}},
  {id:'v-approval-closed',source:'executor/verify.ts',code:'return await github.write()',tools:{github:['write']},expect:{error:'POLICY',match:'approval required',effects:0}},
  {id:'v-approved-once',source:'executor/verify.ts',code:'return await github.write()',tools:{github:['write']},approve:true,expect:{ok:'written',effects:1}},
  {id:'v-cpu-loop',source:'executor/verify.ts',code:'while(true){}',timeout:200,expect:{error:'TIMEOUT'}},
  {id:'v-hang-tool',source:'executor/verify.ts',code:'return await tools.hang()',tools:{tools:['hang']},timeout:200,expect:{error:'TIMEOUT'}},
  {id:'v-fresh-state',source:'executor/verify.ts',before:'globalThis.leak=42;return 1',code:'return typeof globalThis.leak',expect:{ok:'undefined'}},
  {id:'v-inherited-method',source:'executor/verify.ts',code:'return await github.toString()',tools:{github:t1},expect:{error:'GUEST_ERROR',match:'not a function'}},
  {id:'v-sanitized-name',source:'executor/verify.ts',code:'return await github.list_issues()',tools:{github:['list-issues']},expect:{ok:5}},
  {id:'v-name-collision',source:'executor/verify.ts',code:'return 1',tools:{github:['a-b','a_b']},expect:{error:'GUEST_ERROR',match:'collision'}},
  {id:'v-logs-bounded',source:'executor/verify.ts',code:"for(let i=0;i<10000;i++)console.log('a');return 1",expect:{ok:1,logs:Array(LIMIT.logs).fill('a')}},
  // bench/hyperlight (executor/hyperlight-check.ts)
  {id:'h-unicode',source:'executor/hyperlight-check.ts',code:'return await api.echo("🌍")',tools:{api:t1},expect:{ok:'🌍'}},
  // bench/cases.json, the benchmark workloads
  {id:'b-return2',source:'bench/cases.json',code:bench.return2.code,expect:{ok:bench.return2.expected}},
  {id:'b-one-tool',source:'bench/cases.json',code:bench.one_tool.code,tools:{test:t1},expect:{ok:bench.one_tool.expected}},
  {id:'b-one-tool-5ms',source:'bench/cases.json',code:'return await test.delay(5,2);',tools:{test:['delay']},expect:{ok:bench.one_tool_5ms.expected}},
  {id:'b-promise10-5ms',source:'bench/cases.json',code:'return await Promise.all(Array.from({length:10},(_,i)=>test.delay(5,i)));',tools:{test:['delay']},expect:{ok:bench.promise10_5ms.expected}},
  {id:'b-json1m',source:'bench/cases.json',code:bench.json1m.code,expect:{ok:bench.json1m.expected}},
  // executor/shard-check.ts (engine semantics; its hostile raw-fd cases stay there)
  {id:'s-provider-reply',source:'executor/shard-check.ts',code:'return await codemode.add1(41)',tools:{codemode:['add1']},expect:{ok:42}},
  ...['tools','run','__jitk_ring_custom'].map((ns):Case=>({id:'s-namespace-'+ns,source:'executor/shard-check.ts',code:`return await ${ns}.add1(3)`,tools:{[ns]:['add1']},expect:{ok:4}})),
  {id:'s-throw-null',source:'executor/shard-check.ts',code:'throw null',expect:{error:'GUEST_ERROR',match:'Error: null'}},
  {id:'s-unawaited-call',source:'executor/shard-check.ts',code:'codemode.delay(10,1);return 2',tools:{codemode:['delay']},expect:{error:'GUEST_ERROR',match:'unawaited calls at completion'}},
  {id:'s-out-of-order',source:'executor/shard-check.ts',code:'return await Promise.all(Array.from({length:10},(_,i)=>codemode.delay((10-i)*2,i*2)))',tools:{codemode:['delay']},expect:{ok:Array.from({length:10},(_,i)=>i*2)}},
  {id:'s-scalar-unicode',source:'executor/shard-check.ts',code:'return await codemode.echo("Grüße 😀")',tools:{codemode:t1},expect:{ok:'Grüße 😀'}},
  {id:'s-raw-unicode-source',source:'executor/shard-check.ts',code:'return String.raw`Grüße 😀`',expect:{ok:'Grüße 😀'}},
  {id:'s-binary',source:'executor/shard-check.ts',code:'const v=await codemode.echo(new Uint8Array([0,127,128,255]));return Array.from(v)',tools:{codemode:t1},expect:{ok:[0,127,128,255]}},
  {id:'s-tool-error',source:'executor/shard-check.ts',code:'try{await codemode.fail()}catch(e){return [e.code,e.message]}',tools:{codemode:['fail']},expect:{ok:['TOOL_ERROR','Error: provider failure']}},
  {id:'s-denial-to-guest',source:'executor/shard-check.ts',code:'try{await codemode.blocked()}catch(e){return e.code}',tools:{codemode:['blocked']},expect:{ok:'DENIED',effects:0}},
  {id:'s-console',source:'executor/shard-check.ts',code:'console.log("hello",2);console.warn("warning");return 7',expect:{ok:7,logs:['hello 2','[warn] warning']}},
  {id:'s-reply-2000',source:'executor/shard-check.ts',code:'return (await codemode.big(2000)).length',tools:{codemode:['big']},expect:{ok:2000}},
  {id:'s-calls-33',source:'executor/shard-check.ts',code:'return await Promise.all(Array.from({length:33},()=>codemode.echo(0)))',tools:{codemode:t1},expect:{ok:Array(33).fill(0)}},
  {id:'s-source-8000',source:'executor/shard-check.ts',code:'const a='+JSON.stringify('x'.repeat(8000))+';return a.length',expect:{ok:8000}},
  {id:'s-global-restored',source:'executor/shard-check.ts',before:'globalThis.btoa=()=>"poison";globalThis.helperCanary=42;return 1',code:'return [btoa("a"),typeof globalThis.helperCanary]',expect:{ok:['YQ==','undefined']}},
  {id:'s-depth-32-valid',source:'executor/shard-check.ts',code:`return await ns.echo(${nest(30)})`,tools:{ns:t1},expect:{ok:nested(30)}},
  {id:'s-depth-33-array',source:'executor/shard-check.ts',code:`return await ns.echo(${nest(31)})`,tools:{ns:t1},expect:{error:'SANDBOX',match:'protocol DEPTH'}},
  {id:'s-depth-33-object',source:'executor/shard-check.ts',code:`return await ns.echo(${'{"a":'.repeat(31)}0${'}'.repeat(31)})`,tools:{ns:t1},expect:{error:'SANDBOX',match:'protocol DEPTH'}},
  {id:'s-unsafe-number',source:'executor/shard-check.ts',code:'return await ns.echo(2**60)',tools:{ns:t1},expect:{error:'SANDBOX',match:'protocol NUMBER'}},
  {id:'s-lone-surrogate',source:'executor/shard-check.ts',code:'return await ns.echo("\\ud800")',tools:{ns:t1},expect:{error:'SANDBOX',match:'protocol UNICODE'}},
  // mcp/test.mjs, through the MCP core's policy-declared demo tools
  {id:'m-arith',source:'mcp/test.mjs',fixture:'mcp',code:'return 1+1',expect:{ok:2}},
  {id:'m-tool-roundtrip',source:'mcp/test.mjs',fixture:'mcp',code:"console.log('hi'); return await math.add(40, 2)",expect:{ok:42,logs:['hi']}},
  {id:'m-kv',source:'mcp/test.mjs',fixture:'mcp',code:"await kv.set('k', {v: 7}); return await kv.get('k')",expect:{ok:{v:7}}},
  {id:'m-promise10',source:'mcp/test.mjs',fixture:'mcp',code:'return await Promise.all(Array.from({length: 10}, (_, i) => math.add(i, 100)))',expect:{ok:Array.from({length:10},(_,i)=>i+100)}},
  {id:'m-timeout',source:'mcp/test.mjs',fixture:'mcp',code:'while (true) {}',timeout:200,expect:{error:'TIMEOUT'}},
  {id:'m-schema-denial',source:'mcp/test.mjs',fixture:'mcp',code:"return await math.add('x', 1)",expect:{error:'POLICY',match:'policy denied: schema'}},
  {id:'m-taint',source:'mcp/test.mjs',fixture:'mcp',code:"await kv.get('k'); return await kv.set('k', 1)",expect:{error:'POLICY',match:'approval required'}},
  {id:'m-guest-throw',source:'mcp/test.mjs',fixture:'mcp',code:"throw new Error('boom')",expect:{error:'GUEST_ERROR',match:'boom'}},
  // Targeted: tool replies. One reply spans IPC and ring records (IPC.payload,
  // ring MAX_PAYLOAD 16,352); the bound is LIMIT.frame on both paths, which the
  // glue-2m arena reaches first on the ring (b-json1m).
  {id:'t-reply-at-record',source:'targeted: IPC.payload',code:`return (await t.big(${replyString(IPC.payload)})).length`,tools:T,expect:{ok:replyString(IPC.payload)}},
  {id:'t-reply-over-record',source:'targeted: IPC.payload',code:`return (await t.big(${replyString(IPC.payload)+1})).length`,tools:T,expect:{ok:replyString(IPC.payload)+1}},
  {id:'t-reply-64k',source:'targeted: IPC.replyBytes',code:'return (await t.big(65536)).length',tools:T,expect:{ok:65536}},
  {id:'t-reply-limit-to-guest',source:'targeted: IPC.replyBytes',code:'try{return (await t.big(2000)).length}catch(e){return e.code}',tools:T,expect:{ok:2000}},
  {id:'t-replies-parallel',source:'targeted: IPC.replyBytes',code:'return (await Promise.all(Array.from({length:4},()=>t.big(20000)))).map(s=>s.length)',tools:T,expect:{ok:Array(4).fill(20000)}},
  // Targeted: call arguments (one call spans records) and the call budget (LIMIT.calls, LIMIT.outstanding)
  {id:'t-call-args-40k',source:'targeted: IPC.callBytes',code:`return (await t.echo('x'.repeat(40000))).length`,tools:T,expect:{ok:40000}},
  {id:'t-call-args-at-record',source:'targeted: IPC.payload',code:`try{return (await t.echo('x'.repeat(${IPC.payload}))).length}catch(e){return e.code}`,tools:T,expect:{ok:IPC.payload}},
  // The canonical executor's policy run admits POLICY_CALLS calls (below the
  // protocol's LIMIT.calls); past it the run is dead, its sandbox released, and
  // the result names the policy budget (LIMIT), not a bare sandbox exit.
  {id:'t-calls-at-budget',source:'targeted: policy calls',code:`let n=0;for(let i=0;i<${POLICY_CALLS};i++)n+=await t.add1(0);return n`,tools:T,expect:{ok:POLICY_CALLS}},
  {id:'t-calls-over-budget',source:'targeted: policy calls',code:`let n=0;for(let i=0;i<${POLICY_CALLS+1};i++)n+=await t.add1(0);return n`,tools:T,expect:{error:'LIMIT',match:'policy violation: call budget'}},
  {id:'t-calls-outstanding',source:'targeted: LIMIT.outstanding',code:`return (await Promise.all(Array.from({length:${LIMIT.outstanding}},()=>t.add1(0)))).length`,tools:T,expect:{ok:LIMIT.outstanding}},
  {id:'t-calls-over-outstanding',source:'targeted: LIMIT.outstanding',code:`return (await Promise.all(Array.from({length:${LIMIT.outstanding+1}},()=>t.delay(5,0)))).length`,tools:T,expect:{error:'LIMIT',match:'call budget'}},
  // Targeted: timers
  {id:'t-timer',source:'targeted: timers',code:'await new Promise(r=>setTimeout(r,5));return 1',timeout:1000,expect:{ok:1}},
  {id:'t-timer-zero',source:'targeted: timers',code:'await new Promise(r=>setTimeout(r,0));return 1',expect:{ok:1}},
  {id:'t-timer-elapsed',source:'targeted: timers',code:'const a=Date.now();await new Promise(r=>setTimeout(r,30));return Date.now()-a>=29',timeout:1000,expect:{ok:true}},
  {id:'t-timer-order',source:'targeted: timers',code:'const r=[];await new Promise(d=>{setTimeout(()=>r.push(2),20);setTimeout(()=>r.push(1),5);const c=setTimeout(()=>r.push(9),10);clearTimeout(c);setTimeout(d,40);});return r',timeout:1000,expect:{ok:[1,2]}},
  {id:'t-timer-interval',source:'targeted: timers',code:'let n=0;await new Promise(d=>{const h=setInterval(()=>{if(++n===3){clearInterval(h);d();}},2);});return n',timeout:1000,expect:{ok:3}},
  {id:'t-timer-with-call',source:'targeted: timers',code:'const [a,b]=await Promise.all([new Promise(r=>setTimeout(()=>r(1),10)),t.delay(20,2)]);return a+b',tools:T,timeout:1000,expect:{ok:3}},
  {id:'t-clock-advances',source:'targeted: clocks (CUTOVER-PLAN §2.4)',code:'const a=Date.now();let i=0;while(Date.now()-a<20&&i<2e6)i++;return Date.now()-a>=20',expect:{ok:true}},
  {id:'t-timer-typeof',source:'targeted: timers',code:'return [typeof setTimeout,typeof clearTimeout,typeof setInterval,typeof clearInterval]',expect:{ok:['function','function','function','function']}},
  // Targeted: tenant source. LIMIT.code is the bound on both paths: the ring
  // START source binds the code as base64, so it always fits ring::SOURCE_LIMIT.
  {id:'t-code-at-limit',source:'targeted: LIMIT.code',code:atCode,expect:{ok:atCodeChars}},
  {id:'t-code-over-limit',source:'targeted: LIMIT.code',code:`return ${JSON.stringify('x'.repeat(LIMIT.code))}.length`,expect:{error:'LIMIT',match:'code limit'}},
  // Targeted: memory class (the default ring class's arena vs a 32 MiB VM)
  {id:'t-memory-256k',source:'targeted: ARENA_CLASSES',code:'return new Uint8Array(256*1024).length',expect:{ok:256*1024}},
  {id:'t-memory-over-arena',source:'targeted: ARENA_CLASSES',code:`return new Uint8Array(${2*ARENA_CLASSES[DEFAULT_SHARD_CLASS].arenaBytes}).length`,expect:{ok:2*ARENA_CLASSES[DEFAULT_SHARD_CLASS].arenaBytes}},
  {id:'t-memory-64m',source:'targeted: memoryLimitMB',code:'return new Uint8Array(64*1024*1024).length',expect:{error:'LIMIT',match:'out of memory'}},
  // Unbounded recursion: QuickJS's --stack-size limit (kernel/generate.ts) throws a
  // catchable InternalError before the 96 KiB guest stack runs out.
  {id:'t-stack-overflow',source:'targeted: error classes',code:'function f(){return f()}return f()',expect:{error:'LIMIT',match:'InternalError: stack overflow'}},
  // Targeted: completion size, across records (one ring record was the bound before ABI 11)
  {id:'t-done-near-record',source:'targeted: ring MAX_PAYLOAD',code:'return \'x\'.repeat(16352-1024)',expect:{ok:'x'.repeat(16352-1024)}},
  {id:'t-done-over-record',source:'targeted: ring MAX_PAYLOAD',code:'return \'x\'.repeat(16352)',expect:{ok:'x'.repeat(16352)}},
  {id:'t-done-64k',source:'targeted: IPC.doneBytes',code:'return \'x\'.repeat(65536)',expect:{ok:'x'.repeat(65536)}},
  // Targeted: logs (LIMIT.logs/LIMIT.log; on the ring a log is a one-way CONSOLE message)
  {id:'t-logs-at-budget',source:'targeted: LIMIT.logs',code:`for(let i=0;i<${LIMIT.logs};i++)console.log(i);return 1`,expect:{ok:1,logs:Array.from({length:LIMIT.logs},(_,i)=>String(i))}},
  {id:'t-logs-over-budget',source:'targeted: LIMIT.logs',code:`for(let i=0;i<${LIMIT.logs+1};i++)console.log(i);return 1`,expect:{ok:1,logs:Array.from({length:LIMIT.logs},(_,i)=>String(i))}},
  {id:'t-logs-and-calls',source:'targeted: LIMIT.logs, LIMIT.calls',code:'for(let i=0;i<40;i++){console.log(i);await t.add1(i)}return 1',tools:T,expect:{ok:1,logs:Array.from({length:40},(_,i)=>String(i))}},
  {id:'t-log-burst-with-calls',source:'targeted: LIMIT.logs, LIMIT.outstanding',code:'const p=[];for(let i=0;i<200;i++){console.log(i);if(i<50)p.push(t.add1(i))}return (await Promise.all(p)).length',tools:T,expect:{ok:50,logs:Array.from({length:200},(_,i)=>String(i))}},
  {id:'t-log-long',source:'targeted: LIMIT.log',code:"console.log('x'.repeat(5000));return 1",expect:{ok:1,logs:['x'.repeat(LIMIT.log)]}},
  {id:'t-log-values',source:'targeted: log formatting',code:'console.log({a:1},[1,"b"],null,true,3.5);return 1',expect:{ok:1,logs:['{"a":1} [1,"b"] null true 3.5']}},
  {id:'t-log-undefined',source:'targeted: log formatting',code:'console.log("u",undefined);return 1',expect:{ok:1,logs:['u undefined']}},
  {id:'t-log-unserializable',source:'targeted: log formatting',code:'console.log("n",1n);return 1',expect:{ok:1,logs:['n [unserializable]']}},
  {id:'t-stack-overflow-caught',source:'targeted: error classes',code:'function f(){return f()}try{f()}catch(e){return e.name}',expect:{ok:'InternalError'}},
  {id:'t-stack-overflow-json',source:'targeted: error classes',code:'let a=[];for(let i=0;i<500;i++)a=[a];try{JSON.stringify(a)}catch(e){return e.name}',expect:{ok:'InternalError'}},
  {id:'t-stack-after-overflow',source:'targeted: error classes',code:'function f(n){return f(n+1)}try{f(0)}catch{}function g(n){return n?g(n-1)+1:0}return g(50)',expect:{ok:50}},
  {id:'t-stack-overflow-paths',source:'targeted: error classes',code:'const r=[],t=g=>{try{g();r.push("none")}catch(e){r.push(e.name)}};let a=[];for(let i=0;i<500;i++)a=[a];t(()=>String(a));t(()=>JSON.parse("[".repeat(5000)));t(()=>(0,eval)("(".repeat(5000)+"1"+")".repeat(5000)));const p=new Proxy({},{get:(o,k,q)=>q[k]});t(()=>p.x);t(()=>/(a|b)*c/.test("ab".repeat(100000)));function s(){[2,1].sort(s)}t(s);async function f(){return await f()}try{await f()}catch(e){r.push(e.name)}return r',expect:{ok:['InternalError','SyntaxError','SyntaxError','InternalError','InternalError','InternalError','InternalError']}},
  // Targeted: error classes
  {id:'t-syntax-error',source:'targeted: error classes',code:'return (',expect:{error:'GUEST_ERROR'}},
  {id:'t-reference-error',source:'targeted: error classes',code:'return nope',expect:{error:'GUEST_ERROR',match:'ReferenceError'}},
  {id:'t-uncaught-tool-error',source:'targeted: error classes',code:'return await t.fail()',tools:T,expect:{error:'GUEST_ERROR',match:'provider failure'}},
  {id:'t-undefined-result',source:'targeted: error classes',code:'return undefined',expect:{ok:null}},
  // Targeted: saturation is a bounded FIFO queue, not an error (pool.ts AdmissionQueue)
  {id:'t-burst-queued',source:'targeted: admission queue',code:'return await t.delay(20,1)',tools:T,burst:{n:8,maxLive:2,maxWaiting:64},expect:{counts:{OK:8}}},
  {id:'t-burst-overloaded',source:'targeted: admission queue',code:'return await t.delay(20,1)',tools:T,burst:{n:8,maxLive:1,maxWaiting:2},expect:{counts:{OK:3,LIMIT:5}}},
];
{
  const ids=new Set<string>();
  for(const c of CASES){if(ids.has(c.id))throw Error('parity: duplicate case '+c.id);ids.add(c.id);}
}
