// Documented backend differences (R10 #7). Each entry names one case, the
// backends that differ, the outcome they produce instead of the case's
// `expect`, the limit behind it (in the jitk-abi crate where one exists) and
// why. parity-check.ts fails on any difference not listed here, and on an
// entry whose difference no longer occurs, so the list only shrinks.
import {IPC,ARENA_CLASSES} from '../abi.js';
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
  {case:'s-lone-surrogate',backends:['hyperlight-js'],expect:{error:'GUEST_ERROR',match:'invalid utf-8'},limit:'hyperlight-js host function string conversion',
    reason:'the host-function boundary rejects the unpaired surrogate as a guest exception before the v1 dispatcher sees it; still fails closed'},
  {case:'t-reply-64k',backends:['hyperlight-js'],expect:{error:'GUEST_ERROR',match:'virtqueue capacity'},limit:'hyperlight-js host response virtqueue',
    reason:'a 64 KiB reply exceeds the Hyperlight host-call response buffer'},
  ...['t-timer','t-timer-zero'].map((id):Difference=>({case:id,backends:['hyperlight-js'],expect:{error:'GUEST_ERROR',match:'setTimeout is not defined'},limit:HL,
    reason:'the Hyperlight guest has no event-loop timers'})),
  {case:'t-timer-typeof',backends:['hyperlight-js'],expect:{ok:['undefined','undefined']},limit:HL,
    reason:'the Hyperlight guest has no event-loop timers'},
  {case:'t-memory-64m',backends:['hyperlight-js'],expect:{error:'SANDBOX',match:'protocol EOF'},limit:'bench/hyperlight/worker.rs guest heap 16 MiB',
    reason:'allocation failure in the 16 MiB guest heap aborts the worker instead of raising a QuickJS out-of-memory error'},
  {case:'t-log-undefined',backends:['hyperlight-js'],expect:{ok:1,logs:['u ']},limit:HL,
    reason:'console joins JSON.stringify results, which drops undefined'},
  {case:'t-log-unserializable',backends:['hyperlight-js'],expect:{error:'GUEST_ERROR',match:'BigInt'},limit:HL,
    reason:'console calls JSON.stringify without a fallback, so a BigInt argument throws in the tenant'},
];

// The shard's ring profile (executor/ipc/ABI.md, shard/ABI-R7.md): the
// product-parity gaps of R9 N6, now one table in jitk-abi.
const replyLimit:Expect={error:'LIMIT',match:`shard tool reply limit \\(${IPC.replyBytes} bytes\\)`};
const sourceLimit:Expect={error:'LIMIT',match:`shard source limit including trusted adapters \\(${IPC.sourceBytes} bytes\\)`};
const arena=`abi arena::Class::Glue2m (arena ${ARENA_CLASSES['glue-2m'].arenaBytes} bytes, admission ${ARENA_CLASSES['glue-2m'].admissionBytes})`;
const numbered=(n:number)=>Array.from({length:n},(_,i)=>String(i));
const shard:Difference[]=[
  ...['s-reply-2000','t-reply-over-limit','t-reply-64k'].map((id):Difference=>({case:id,backends:['shard'],expect:replyLimit,limit:'abi ring::REPLY_BYTES',value:IPC.replyBytes,
    reason:'a provider reply over the ring reply size becomes a LIMIT tool error (shard-backend.ts reply())'})),
  {case:'t-reply-limit-to-guest',backends:['shard'],expect:{ok:'LIMIT'},limit:'abi ring::REPLY_BYTES',value:IPC.replyBytes,
    reason:'the oversized reply reaches the guest as a catchable tool error with code LIMIT'},
  ...['s-calls-33','t-calls-over-budget'].map((id):Difference=>({case:id,backends:['shard'],expect:{error:'LIMIT',match:'call budget'},limit:'abi ring::MAX_CALLS',value:IPC.calls,
    reason:'one ring call id per tool call; v1 allows LIMIT.calls (4096)'})),
  {case:'t-call-args-over-limit',backends:['shard'],expect:{error:'LIMIT',match:`shard tool call limit \\(${IPC.callBytes} bytes\\)`},limit:'abi ring::CALL_BYTES',value:IPC.callBytes,
    reason:'the encoded call must fit one ring record; the prepared helper turns the ring bootstrap refusal into a LIMIT tool error (shard-helpers.js.in call())'},
  {case:'t-call-limit-to-guest',backends:['shard'],expect:{ok:'LIMIT'},limit:'abi ring::CALL_BYTES',value:IPC.callBytes,
    reason:'the oversized call reaches the guest as a catchable tool error with code LIMIT'},
  ...['s-source-8000','t-source-over-limit'].map((id):Difference=>({case:id,backends:['shard'],expect:sourceLimit,limit:'abi ring::SOURCE_LIMIT',value:IPC.sourceBytes,
    reason:'the START source, tenant code plus the prepared-helper binding, must fit the ring source page; v1 allows LIMIT.code (64 KiB)'})),
  ...['b-json1m','t-memory-over-arena'].map((id):Difference=>({case:id,backends:['shard'],expect:{error:'LIMIT',match:'out of memory'},limit:arena,
    reason:'the glue-2m arena class bounds the guest heap; the v1 QuickJS runs with --memory-limit 16M'})),
  ...['t-timer','t-timer-zero'].map((id):Difference=>({case:id,backends:['shard'],expect:{error:'GUEST_ERROR',match:"'setTimeout' is not defined"},limit:'kernel/ring-bootstrap.js (no timers)',
    reason:'the ring profile has deliberately no timers'})),
  {case:'t-timer-typeof',backends:['shard'],expect:{ok:['undefined','undefined']},limit:'kernel/ring-bootstrap.js (no timers)',reason:'the ring profile has deliberately no timers'},
  ...['t-stack-overflow','t-stack-overflow-caught'].map((id):Difference=>({case:id,backends:['shard'],expect:{error:'GUEST_ERROR',match:'guest_fatal'},limit:'abi arena::STACK_BYTES',value:0x20000,
    reason:'both paths end the guest on unbounded recursion; the shard reports it as a guest_fatal ERROR record (class GUEST_ERROR), the console path as EOF (SANDBOX)'})),
  {case:'t-done-over-limit',backends:['shard'],expect:{error:'GUEST_ERROR',match:'guest_fatal'},limit:'abi ring::DONE_BYTES',value:IPC.doneBytes,
    reason:'a completion over one ring record cannot be written; the guest stops without DONE'},
  // Logs are ring CALL records: they share the call budget and the record size.
  {case:'v-logs-bounded',backends:['shard'],expect:{ok:1,logs:Array(IPC.calls).fill('a')},limit:'abi ring::MAX_CALLS',value:IPC.calls,
    reason:'logs past the ring call budget are dropped (v1 keeps LIMIT.logs = 1024)'},
  {case:'t-logs-over-budget',backends:['shard'],expect:{ok:1,logs:numbered(IPC.calls)},limit:'abi ring::MAX_CALLS',value:IPC.calls,
    reason:'logs past the ring call budget are dropped'},
  {case:'t-logs-and-calls',backends:['shard'],expect:{error:'LIMIT',match:'call budget',logs:numbered(IPC.calls/2)},limit:'abi ring::MAX_CALLS',value:IPC.calls,
    reason:'logs and tool calls share the ring call budget, so the 17th call has no id left'},
  {case:'t-log-long',backends:['shard'],expect:{ok:1,logs:[]},limit:'abi ring::CALL_BYTES',value:IPC.callBytes,
    reason:'a log record over the ring record size is dropped (v1 clips it to LIMIT.log = 4096)'},
];

// Known bugs, listed so the run stays green while they are open. Each is in
// the R14 parity report; fix and delete.
const bugs:Difference[]=[
  {case:'t-timer',backends:['jitk'],platforms:['linux'],expect:{error:'TIMEOUT'},limit:'BUG: libkrun on Linux (kvm-dev, nested KVM)',
    reason:'a setTimeout with a delay never fires in the Linux libkrun guest (setTimeout 0 does, and Date.now advances), so the run hits its deadline; the Mac libkrun guest is fine. Not checked on metal'},
];

export const ALLOWLIST:Difference[]=[...hyperlight,...shard,...bugs];
