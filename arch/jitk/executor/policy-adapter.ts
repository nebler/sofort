// Thin loader only: area 07 owns every policy rule and its canonical subtree.
import {fileURLToPath} from 'node:url';
const canonical=new URL('../policy/policy.mjs',import.meta.url);
export const policySource=fileURLToPath(canonical);
export const rules:any=await import(policySource);
export type Tool={
  args:(args:unknown[])=>unknown[]; reads:'none'|'public'|'private'; egress:boolean; writes:boolean;
  endorsable?:boolean; approval?:'always'; timeoutMs:number;
  invoke:(args:any,credential:any,context:{signal:AbortSignal;idempotencyKey:string})=>Promise<any>;
  output:(result:any)=>any;
};
export type Issuer={issue:(scope:{run:string;scope:string;ttlMs:number})=>Promise<any>;revoke:(credential:any)=>Promise<void>};
export type PolicyConfig={tools?:Record<string,Record<string,Tool>>;issuer?:Issuer;limits?:{calls?:number;outstanding?:number;denials?:number}};
// Compatibility functions receive no credentials. Credentialed tools use explicit
// host Tool.invoke declarations; tokens never become provider or guest arguments.
export const noCredentials:Issuer={issue:async()=>undefined,revoke:async()=>{}};
