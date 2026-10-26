import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
console.log(new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true}) !== undefined);
