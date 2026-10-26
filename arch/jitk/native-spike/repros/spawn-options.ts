import {spawn} from 'node:child_process';
const options:{cwd?:string;env?:Record<string,string>} = {};
const child = spawn('/bin/echo',['hello'],{stdio:'pipe',cwd:options.cwd,env:{PATH:'/usr/bin:/bin',...options.env}});
child.stdout!.on('data',chunk=>console.log(chunk.toString()));
