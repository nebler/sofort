// The executor's host interface (R10 §3.1): typed guest events, no wire frames.
// Each engine adapter decodes its own transport (v1 frames for the process
// backends, binary IPC records for the shard) and validates all guest content
// before an event exists. Bad guest content ends that session only, as 'fail'.
export type Job={kind:'js';
  /** Tenant code: a codemode function expression or a TanStack body wrapper. */
  source:string;
  /** Namespace -> tool names; the guest gets exactly these proxies. */
  tools:Record<string,string[]>;
  /** Trusted per-provider preludes, evaluated before source. */
  prelude:string};
export type GuestEvent=
  | {kind:'call';id:number;ns:string;fn:string;args:unknown[]}
  | {kind:'log';level:string;msg:string}
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
  readonly exited:Promise<void>;
  armDeadline?(deadline:number):Promise<void>;
  readonly deadlineReceipt?:{deadline:number;firedAt:number;killAt:number};
  start(job:Job):Promise<void>;
  /** One reader. After a 'done' or 'fail' event the session yields nothing new. */
  next():Promise<GuestEvent>;
  /** Answer the call event with this id; each id exactly once. */
  reply(id:number,r:Reply):Promise<void>;
  /** Idempotent kill/reset. */
  kill():void;
}
export interface Engine {
  readonly kind:'jitk'|'process'|'hyperlight-js'|'shard';
  close?():Promise<void>;
  readonly memoryLimitMB:number;
  park(signal?:AbortSignal,deadline?:number):Promise<Session>;
}
/** A session failure from an Error (an adapter's own failure path). */
export function failure(e:unknown):Extract<GuestEvent,{kind:'fail'}> {
  const message=e instanceof Error?e.message:String(e);
  const cause=/timed out|deadline/.test(message)?'deadline':/^protocol /.test(message)?'guest':/limit|bound|budget/.test(message)?'limit':'engine';
  return {kind:'fail',cause,message};
}
