import {jsonSchema, tool} from 'ai';
const t = tool({description:'echo',inputSchema:jsonSchema({type:'object',properties:{n:{type:'number'}}}),execute:async (args:any)=>args});
console.log(JSON.stringify(await t.execute!({n:2},{toolCallId:'offline',messages:[]})));
