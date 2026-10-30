/** Worker-side client for SPEC v1's host callback; no Node APIs. */
export interface ToolCall {executionId:string;namespace:string;tool:string;args:unknown[]}
export interface ToolEndpoint {url:string;token:string}
export interface WireCodec {stringify(value:unknown):string;parse(text:string):any}
/** JSON is the harness replay protocol; cf-worker passes codemode's binary
 * codec as a backward-compatible extension for Uint8Array/ArrayBuffer. */
export async function callHost(endpoint:ToolEndpoint,call:ToolCall,codec:WireCodec=JSON):Promise<unknown> {
  const response=await fetch(`${endpoint.url}/call`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${endpoint.token}`},body:codec.stringify(call)});
  const reply=codec.parse(await response.text());
  if(!response.ok||reply.error!==undefined)throw Error(reply.error??`host callback HTTP ${response.status}`);
  return reply.result;
}
