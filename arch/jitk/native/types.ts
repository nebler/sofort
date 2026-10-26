export type Frame = Record<string,any>;
export interface Sandbox {
  readonly exited:Promise<void>;
  armDeadline?(deadline:number):Promise<void>;
  readonly deadlineReceipt?:{deadline:number;firedAt:number;killAt:number};
  read():Promise<unknown>; send(frame:unknown):Promise<void>; kill():void;
}
export interface Backend {
  readonly kind:string; readonly memoryLimitMB:number;
  close?():Promise<void>;
  park(signal?:AbortSignal,deadline?:number):Promise<Sandbox>;
}
export interface Provider {name:string;fns:Record<string,(...a:any[])=>Promise<any>>;prelude?:string}
export interface Call {id:number;ns:string;fn:string;args:any[]}
export interface Context {executionId:string;signal:AbortSignal;provenance:readonly string[]}
export type Policy=(call:Call,ctx:Context)=>string|Promise<string>;
export interface Tool {
  args:(a:any)=>any;reads:string;egress:boolean;writes:boolean;endorsable?:boolean;approval?:string;
  timeoutMs:number;invoke:(a:any,credential:any,context:{signal:AbortSignal;idempotencyKey:string})=>Promise<any>;
  output:(r:any)=>any;signature?:string;description?:string;
}
export interface Issuer {issue:(scope:{run:string;scope:string;ttlMs:number})=>Promise<any>;revoke:(credential:any)=>Promise<void>}
export interface PolicyConfig {tools?:Record<string,Record<string,Tool>>;issuer?:Issuer;limits?:{calls?:number;outstanding?:number;denials?:number}}
export interface RunOptions {
  signal?:AbortSignal;timeout?:number;provenance?:readonly string[];connectors?:unknown[];
  onTiming?:(event:string,atMs:number)=>void;
  approve?:(call:Call,ctx:Context)=>Promise<boolean>;
}
