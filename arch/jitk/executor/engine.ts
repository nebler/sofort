// The executor's host interface (R10 §3.1): typed guest events, no wire frames.
// Each engine adapter decodes its own transport (v1 frames for the process
// backends, binary IPC records for the shard, JNR7 frames for the native
// worker) and validates all guest content before an event exists. Bad guest
// content ends that session only, as 'fail'.
import {LIMIT} from '../protocol/dispatcher.js';
export type JsJob={kind:'js';
  /** Tenant code: a codemode function expression or a TanStack body wrapper. */
  source:string;
  /** Namespace -> tool names; the guest gets exactly these proxies. */
  tools:Record<string,string[]>;
  /** Trusted per-provider preludes, evaluated before source. */
  prelude:string};
/** A whole static program from a prepared profile; no tool calls. */
export type NativeJob={kind:'native';
  /** A prepared profile the engine loaded; it is also argv[0]. */
  profile:string;
  /** argv after argv[0]. */
  args:string[];
  /** Relative read-only guest paths -> contents. */
  files:Record<string,Uint8Array>};
export type Job=JsJob|NativeJob;
export type GuestEvent=
  | {kind:'call';id:number;ns:string;fn:string;args:unknown[]}
  | {kind:'log';level:string;msg:string}
  /** Native jobs: the program's output streams, before its 'done'. */
  | {kind:'stdout'|'stderr';bytes:Uint8Array}
  /** JS: the guest's JSON value. Native: {exitCode, outputLimited}. */
  | {kind:'done';ok:unknown}
  /** guest: thrown or invalid guest content; limit: a host bound; deadline; engine: transport or process. */
  | {kind:'fail';cause:'guest'|'limit'|'deadline'|'engine';message:string};
export type Reply={ok:unknown}|{err:{code:string;message:string}};
/** parked: no job yet; running: started, no outcome yet; done: the guest
 *  completed (or threw) and the session is intact; ended: failed, killed,
 *  reset or exited. */
export type Phase='parked'|'running'|'done'|'ended';
export interface Session {
  readonly phase:Phase;
  /** Resolves once the session's capacity is free again (process reaped, slot reset). */
  readonly released:Promise<void>;
  armDeadline?(deadline:number):Promise<void>;
  readonly deadlineReceipt?:{deadline:number;firedAt:number;killAt:number};
  start(job:Job):Promise<void>;
  /** One reader. After a 'done' or 'fail' event the session yields nothing new. */
  next():Promise<GuestEvent>;
  /** Answer the call event with this id; each id exactly once. */
  reply(id:number,r:Reply):Promise<void>;
  /** Idempotent: kill the process or reset the slot; `released` resolves after. */
  release():void;
}
/** What one session of an engine admits for a JS job. Each engine reports its
 *  own: the jitk-abi ring limits (abi.ts) for the shard, protocol v1 (LIMIT)
 *  for the process backends. Callers read these instead of hard-coding them. */
export type JsLimits={
  /** Tenant source characters before the trusted adapters. */
  code:number;
  /** Guest source the engine accepts including its trusted adapters. */
  sourceBytes:number;
  /** Tool calls per run. */
  calls:number;
  /** One encoded call, one tool reply, the completion value. */
  callBytes:number;
  replyBytes:number;
  doneBytes:number;
  /** Console lines per run, and bytes per line. */
  logs:number;
  logBytes:number;
  /** Whether the guest has event-loop timers (setTimeout). */
  timers:boolean;
  /** Writable guest arena, when the engine has a fixed one. */
  arenaBytes?:number;
};
/** What one native job may carry and produce. */
export type NativeLimits={
  /** The prepared profiles a job may name. */
  profiles:readonly string[];
  /** Arguments after argv[0], and the bytes of argv including NULs. */
  args:number;
  argvBytes:number;
  /** Input files, bytes per path, components per path, total content bytes. */
  files:number;
  pathBytes:number;
  pathComponents:number;
  inputBytes:number;
  /** Combined stdout and stderr; past it the run reports outputLimited. */
  outputBytes:number;
};
export type Limits={
  /** Guest RAM class in MiB, when the engine has a fixed one. */
  memoryMB?:number;
  /** Sessions the engine runs at once (Infinity: one process each, the pool bounds them). */
  sessions:number;
  /** park() calls worth running at once: a slot claim is cheap, a process start is not. */
  parallelStarts:number;
  /** Longest run deadline the engine admits, in ms. */
  deadlineMs:number;
  /** Present for each job kind the engine runs. */
  js?:JsLimits;
  native?:NativeLimits;
};
export interface Engine {
  readonly kind:'process'|'hyperlight-js'|'shard'|'hvf'|'native';
  close?():Promise<void>;
  readonly limits:Limits;
  park(signal?:AbortSignal,deadline?:number):Promise<Session>;
}
/** Protocol v1 limits (protocol/dispatcher.ts LIMIT) of a process backend. */
export function v1Limits(memoryMB:number,deadlineMs:number,timers=true):Limits {
  return {memoryMB,sessions:Infinity,parallelStarts:2,deadlineMs,js:{code:LIMIT.code,sourceBytes:LIMIT.code,calls:LIMIT.calls,
    callBytes:LIMIT.frame,replyBytes:LIMIT.frame,doneBytes:LIMIT.frame,logs:LIMIT.logs,logBytes:LIMIT.log,timers}};
}
/** A session failure from an Error (an adapter's own failure path). */
export function failure(e:unknown):Extract<GuestEvent,{kind:'fail'}> {
  const message=e instanceof Error?e.message:String(e);
  const cause=/timed out|deadline/.test(message)?'deadline':/^protocol /.test(message)?'guest':/limit|bound|budget/.test(message)?'limit':'engine';
  return {kind:'fail',cause,message};
}
