import {z} from 'zod';
import type {ResolvedProvider} from '@cloudflare/codemode';
import {generateTypesFromJsonSchema,sanitizeToolName} from './upstream.js';
export function defineTool<I,O>(inputSchema:z.ZodType<I>,outputSchema:z.ZodType<O>,execute:(args:I)=>Promise<O>,description='') {
  return {inputSchema,outputSchema,description,execute:async(args:unknown):Promise<unknown>=>outputSchema.parseAsync(await execute(await inputSchema.parseAsync(args)))};
}
type TypedTool={inputSchema:z.ZodType;outputSchema:z.ZodType;description:string;execute:(args:unknown)=>Promise<unknown>};
export function prepareProviders(items:{name:string;tools:Record<string,TypedTool>;prelude?:string}[]):{types:string;providers:ResolvedProvider[]} {
  const types:string[]=[],providers:ResolvedProvider[]=[];
  for(const p of items){
    if(!/^[A-Za-z_$][\w$]*$/.test(p.name))throw new Error('invalid namespace');
    const schemas=Object.fromEntries(Object.entries(p.tools).map(([k,t])=>[k,{description:t.description,inputSchema:z.toJSONSchema(t.inputSchema),outputSchema:z.toJSONSchema(t.outputSchema,{io:'output'})}]));
    // Scope input/output aliases per provider so identical method names in
    // different namespaces don't produce duplicate global TS aliases.
    const generated=generateTypesFromJsonSchema(schemas).replace('declare const codemode','const api');
    types.push(`declare namespace __schema_${p.name} {\n${generated}\n}\ndeclare const ${p.name}: typeof __schema_${p.name}.api;`);
    const fns:ResolvedProvider['fns']=Object.create(null);
    for(const [key,t] of Object.entries(p.tools)){
      const safe=sanitizeToolName(key);if(Object.hasOwn(fns,safe))throw new Error('sanitized tool collision');
      fns[safe]=async(...args)=>t.execute(args[0]);
    }
    providers.push({name:p.name,fns,prelude:p.prelude});
  }
  return {types:types.join('\n\n'),providers};
}
