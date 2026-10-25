import * as std from 'qjs:std';
const text=std.loadFile('/case/payload.json');
const data=JSON.parse(text);
let blocks=[];
for(let i=0;i<16;i++){let a=new Uint8Array(4*1024*1024); a.fill(i);blocks.push(a);}
let sum=0;for(const a of blocks)sum+=a[0]+a[a.length-1];
print(JSON.stringify({records:data.length,bytes:blocks.reduce((s,a)=>s+a.length,0),checksum:sum}));
