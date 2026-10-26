import {readFileSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {root} from './select-backend.js';
import {demo} from './demo.js';
import type {Tool} from './types.js';
export interface Config {timeoutMs:number;warm:number;maxLive:number;execute:boolean;resources:string;tools:Record<string,Record<string,Tool>>;profiles:string[]}
export function loadConfig():Config {
  const path=process.env.JITK_MCP_CONFIG||resolve(root,'mcp/jitk-mcp.json');
  const raw:any=JSON.parse(readFileSync(path,'utf8')),base=dirname(resolve(path));
  const cfg:Config={timeoutMs:raw.timeoutMs??10000,warm:raw.warm??2,maxLive:raw.maxLive??8,execute:raw.execute!==false,
    resources:realpathSync(resolve(base,raw.resources??'./resources')),tools:{},profiles:Object.keys(raw.native?.profiles??{})};
  for(const value of [cfg.timeoutMs,cfg.warm,cfg.maxLive])if(!Number.isInteger(value)||value<0)throw Error('config: non-negative integer required');
  // Static provider graph: dynamic arbitrary imports are unsupported by scriptc.
  // Validate the exact canonical demo module path; never silently substitute it.
  for(const p of (raw.providers??[]) as string[]){
    if(realpathSync(resolve(base,p))!==realpathSync(resolve(root,'mcp/providers/demo.mjs')))throw Error('native provider must be compiled in: '+p);
    if(Object.keys(cfg.tools).length)throw Error('config: namespace math declared twice');cfg.tools=demo;
  }
  return cfg;
}
export function describeTools(tools:Record<string,Record<string,Tool>>):string {
  const lines:string[]=[];
  for(const ns of Object.keys(tools))for(const fn of Object.keys(tools[ns])){const t=tools[ns][fn];lines.push('- '+ns+'.'+(t.signature??fn+'(...)')+(t.description?' — '+t.description:''));}
  return lines.join('\n');
}
