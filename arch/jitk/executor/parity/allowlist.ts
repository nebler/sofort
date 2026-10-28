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
  {case:'t-timer',backends:['hyperlight-js'],expect:{error:'GUEST_ERROR',match:'setTimeout is not defined'},limit:HL,
    reason:'the Hyperlight guest has no event-loop timers'},
  {case:'t-timer-typeof',backends:['hyperlight-js'],expect:{ok:['undefined','undefined']},limit:HL,
    reason:'the Hyperlight guest has no event-loop timers'},
  {case:'t-memory-64m',backends:['hyperlight-js'],expect:{error:'SANDBOX',match:'protocol EOF'},limit:'bench/hyperlight/worker.rs guest heap 16 MiB',
    reason:'allocation failure in the 16 MiB guest heap aborts the worker instead of raising a QuickJS out-of-memory error'},
  {case:'t-log-undefined',backends:['hyperlight-js'],expect:{ok:1,logs:['u ']},limit:HL,
    reason:'console joins JSON.stringify results, which drops undefined'},
  {case:'t-log-unserializable',backends:['hyperlight-js'],expect:{error:'GUEST_ERROR',match:'BigInt'},limit:HL,
    reason:'console calls JSON.stringify without a fallback, so a BigInt argument throws in the tenant'},
];

export const ALLOWLIST:Difference[]=[...hyperlight];
void IPC;void ARENA_CLASSES;
