// Run from copied executor runtime/build in the review scratch directory.
import {executionBody} from './code.js';
import {shardSource} from './shard-backend.js';
import {writeFileSync} from 'node:fs';
const providers=[{name:'codemode',fns:{echo:async x=>x}}];
const cases={raw_return2:'return 2;',raw_one_tool:'return (await tools.echo(41))[0]+1;'};
for(const [name,code] of [['return2','return 2;'],['one_tool','return (await codemode.echo(41))+1']]) {
  const body=executionBody(code,providers);
  cases['body_'+name]=body;
  cases['wire_'+name]=shardSource({t:'run',code:body,ns:{codemode:['echo']}});
}
for(const [name,code] of Object.entries(cases)) {
  writeFileSync(new URL('../../'+name+'.js',import.meta.url),code);
  console.log(JSON.stringify({case:name,bytes:Buffer.byteLength(code)}));
}
