import type {Tool} from './types.js';
const store=new Map<string,string>();
function str(v:any,max:number):string {if(typeof v!=='string'||v.length>max)throw Error('schema');return v;}
function arity(a:any,n:number):any[] {if(!Array.isArray(a)||a.length!==n)throw Error('schema');return a;}
const same=(v:any):any=>v;
export const demo:Record<string,Record<string,Tool>>={
  math:{add:{reads:'none',egress:false,writes:false,timeoutMs:1000,output:same,
    signature:'add(a: number, b: number): number',description:'Sum of two finite numbers.',
    args:(v:any):any=>{const a=arity(v,2);for(const n of a)if(typeof n!=='number'||!Number.isFinite(n))throw Error('schema');return a;},
    invoke:async(a:any):Promise<any>=>a[0]+a[1]}},
  kv:{
    get:{reads:'private',egress:false,writes:false,timeoutMs:1000,output:same,
      signature:'get(key: string): unknown | null',description:'Read a value from the in-memory store.',
      args:(a:any):any=>[str(arity(a,1)[0],256)],
      invoke:async(a:any):Promise<any>=>{const v=store.get(a[0]);return v===undefined?null:JSON.parse(v);}},
    set:{reads:'none',egress:false,writes:true,timeoutMs:1000,output:same,
      signature:'set(key: string, value: JSON): true',description:'Write a JSON value (<= 64 KiB) to the in-memory store.',
      args:(v:any):any=>{const a=arity(v,2);str(a[0],256);if(JSON.stringify(a[1]??null).length>65536)throw Error('schema');return [a[0],a[1]??null];},
      invoke:async(a:any):Promise<any>=>{store.set(a[0],JSON.stringify(a[1]));return true;}}
  }
};
