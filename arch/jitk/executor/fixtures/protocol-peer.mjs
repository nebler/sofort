const mode=process.argv[2];
const send=m=>process.stdout.write(JSON.stringify(m)+'\n');
if(mode==='badready')send({t:'ready',version:1});else send({t:'ready',v:1});
let input='',ran=false;
process.stdin.on('data',b=>{
 input+=b;let pos;
 while((pos=input.indexOf('\n'))>=0){const m=JSON.parse(input.slice(0,pos));input=input.slice(pos+1);
  if(m.t==='run'&&!ran){ran=true;
   if(mode==='del')process.stdout.write('{"t":"done","ok":"'+String.fromCharCode(127)+'"}\n');
   if(mode==='trailing')process.stdout.write('{"t":"done","ok":2}\n{"t":"done","ok":3}\n');
   if(mode==='duplicate')process.stdout.write('{"t":"call","id":1,"ns":"api","fn":"effect","args":[{"x":1,"x":2}]}\n');
   if(mode==='unknown')send({t:'call',id:1,ns:'__proto__',fn:'constructor',args:[]});
   if(mode==='replay')send({t:'call',id:1,ns:'api',fn:'effect',args:[]});
  }else if(m.t==='ret'){
   if(mode==='unknown')send({t:'done',err:{name:'Error',message:m.err?.message??'unsafe call allowed'}});
   if(mode==='replay')send({t:'call',id:1,ns:'api',fn:'effect',args:[]});
  }
 }
});
