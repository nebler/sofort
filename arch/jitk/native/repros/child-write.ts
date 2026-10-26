import {spawn} from 'node:child_process';
const p=spawn('/bin/cat',[],{cwd:process.cwd(),stdio:'pipe'});
p.stdin!.write('hello',(e:Error|null|undefined)=>console.log(e));
p.stdin!.end();
