import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
const transport = new StdioServerTransport();
transport.onmessage = message => { console.error(JSON.stringify(message)); void transport.close(); };
await transport.start();
