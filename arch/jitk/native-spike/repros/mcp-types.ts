import {InitializeRequestSchema} from '@modelcontextprotocol/sdk/types.js';
console.log(JSON.stringify(InitializeRequestSchema.parse({method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'spike',version:'0'}}})));
