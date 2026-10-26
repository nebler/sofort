import {Server} from '@modelcontextprotocol/sdk/server/index.js';
console.log(new Server({name:'spike',version:'0'},{capabilities:{tools:{}}}) !== undefined);
