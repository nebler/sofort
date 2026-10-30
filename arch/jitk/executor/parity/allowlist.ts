// Documented backend differences (R10 #7). Each entry names one case, the
// backends that differ, the outcome they produce instead of the case's
// `expect`, the limit behind it (in the jitk-abi crate where one exists) and
// why. parity-check.ts fails on any difference not listed here, and on an
// entry whose difference no longer occurs, so the list only shrinks.
import {ARENA_CLASSES} from '../abi.js';
import {DEFAULT_SHARD_CLASS} from '../shard-backend.js';
import {LIMIT} from '../../protocol/dispatcher.js';
import type {Expect} from './cases.js';
import type {Engine} from '../engine.js';

export type Difference={
  case:string;
  backends:Engine['kind'][];
  /** Only on these hosts (`process.platform`); default every host. */
  platforms?:string[];
  expect:Expect;
  /** The limit: `abi ring::<CONST>` (generated into executor/abi.ts as IPC.*), or the file that sets it. */
  limit:string;
  value?:number;
  reason:string;
};
const HL='bench/hyperlight/bootstrap.js (research baseline)';
const hyperlight:Difference[]=[
  {case:'s-throw-null',backends:['hyperlight-js'],expect:{error:'SANDBOX',match:'protocol EOF'},limit:HL,
    reason:'the handler reads e.name of a thrown null inside its catch; the worker exits without a done frame'},
  {case:'s-unawaited-call',backends:['hyperlight-js'],expect:{ok:2},limit:HL,
    reason:'tool calls are synchronous exchanges, so no call is outstanding at completion'},
  {case:'s-lone-surrogate',backends:['hyperlight-js'],expect:{error:'GUEST_ERROR',match:'hex escape'},limit:'bench/hyperlight/worker.rs frame decoding',
    reason:'frames cross the host-function boundary as one JSON string, and the worker\'s JSON decoding rejects the unpaired surrogate escape before the v1 dispatcher sees it; still fails closed'},
  {case:'t-calls-over-outstanding',backends:['hyperlight-js'],expect:{ok:LIMIT.outstanding+1},limit:HL,
    reason:'tool calls are synchronous exchanges, so no call is outstanding and the outstanding bound never applies'},
  ...['t-timer','t-timer-zero','t-timer-elapsed','t-timer-order','t-timer-with-call'].map((id):Difference=>({case:id,backends:['hyperlight-js'],expect:{error:'GUEST_ERROR',match:'setTimeout is not defined'},limit:HL,
    reason:'the Hyperlight guest has no event-loop timers'})),
  {case:'t-timer-interval',backends:['hyperlight-js'],expect:{error:'GUEST_ERROR',match:'setInterval is not defined'},limit:HL,
    reason:'the Hyperlight guest has no event-loop timers'},
  {case:'t-timer-typeof',backends:['hyperlight-js'],expect:{ok:['undefined','undefined','undefined','undefined']},limit:HL,
    reason:'the Hyperlight guest has no event-loop timers'},
  {case:'t-log-undefined',backends:['hyperlight-js'],expect:{ok:1,logs:['u ']},limit:HL,
    reason:'console joins JSON.stringify results, which drops undefined'},
  ...['t-stack-overflow','t-stack-overflow-caught','t-stack-after-overflow','t-stack-overflow-paths'].map((id):Difference=>({case:id,backends:['hyperlight-js'],expect:{error:'LIMIT',match:'Out of physical memory'},limit:HL,
    reason:'unbounded recursion grows the worker stack until the guest runs out of physical memory (Hyperlight stops it, code 13) before QuickJS\'s stack limit; jitk sets --stack-size below its guest stack (kernel/generate.ts)'})),
  {case:'t-memory-over-arena',backends:['hyperlight-js'],expect:{error:'LIMIT',match:'out of memory'},limit:'bench/hyperlight/worker.rs guest heap 16 MiB',
    reason:'twice the default ring arena (13.5 MiB) does not fit beside QuickJS in the 16 MiB Hyperlight guest heap'},
  {case:'t-stack-overflow-json',backends:['hyperlight-js'],expect:{ok:null},limit:HL,
    reason:'the worker stack holds 500 nested JSON.stringify levels, so nothing throws'},
  {case:'t-log-unserializable',backends:['hyperlight-js'],expect:{error:'GUEST_ERROR',match:'BigInt'},limit:HL,
    reason:'console calls JSON.stringify without a fallback, so a BigInt argument throws in the tenant'},
];

// The shard's ring profile (executor/ipc/ABI.md, shard/ABI-R7.md). Both ring
// engines run the same kernel, prepared helpers, IPC and limits (the KVM shard
// on Linux, the HVF engine on macOS), so neither has an entry of its own.
// Since ABI 11 the ring has the console path's call, reply, completion,
// source, log and timer limits; what remains is the memory class.
const ring:Engine['kind'][]=['shard','hvf'];
const arena=`abi arena class ${DEFAULT_SHARD_CLASS} (arena ${ARENA_CLASSES[DEFAULT_SHARD_CLASS].arenaBytes} bytes, admission ${ARENA_CLASSES[DEFAULT_SHARD_CLASS].admissionBytes})`;
const shard:Difference[]=[
  ...['t-memory-over-arena'].map((id):Difference=>({case:id,backends:ring,expect:{error:'LIMIT',match:'out of memory'},limit:arena,
    reason:`the ${DEFAULT_SHARD_CLASS} arena class bounds the guest heap (per-VM memory and reset cost scale with it); the v1 QuickJS runs with --memory-limit 16M`})),
];

// Known bugs, listed so the run stays green while they are open. Each is in
// the R14 parity report; fix and delete.
// (The one entry, libkrun's never-firing setTimeout on Linux, went with libkrun.)
const bugs:Difference[]=[];

export const ALLOWLIST:Difference[]=[...hyperlight,...shard,...bugs];
