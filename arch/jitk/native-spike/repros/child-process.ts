import {spawn} from 'node:child_process';
const child = spawn('/bin/cat',[],{stdio:['pipe','pipe','pipe']});
let text = '';
child.stdout.on('data',data=>{ text+=data.toString(); });
child.on('close',()=>{ if (text !== 'hello\n') throw Error(text); console.log('PASS child pipe roundtrip'); });
child.stdin.end('hello\n');
