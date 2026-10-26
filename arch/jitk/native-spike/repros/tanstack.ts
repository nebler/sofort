import {toolDefinition} from '@tanstack/ai';
import {z} from 'zod';
const t = toolDefinition({name:'echo',description:'echo',inputSchema:z.object({n:z.number()})}).server(async args=>args);
console.log(JSON.stringify(await t.execute!({n:2},undefined as never)));
