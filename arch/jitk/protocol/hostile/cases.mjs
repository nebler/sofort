// Executed only as JS inside an actual hardware VM. Never run on local qjs.
const call=id=>({t:'call',id,ns:'api',fn:'echo',args:[]});
const emit=m=>`std.out.puts(${JSON.stringify(JSON.stringify(m)+'\n')});std.out.flush();`;
const stuck='await new Promise(()=>{});';
export const cases=[
 {name:'forged authority envelope',code:emit({...call(1),approved:true})+stuck,fault:'SCHEMA',calls:0},
 {name:'forged prototype capability',code:emit({...call(1),ns:'__proto__',fn:'constructor'})+stuck,fault:'POLICY',calls:1},
 {name:'forged kernel record',code:rawWrite(1,'\x1e{"t":"call","id":1}\n')+stuck,kernel:true,calls:0},
 {name:'duplicate call id',code:emit(call(1))+emit(call(1))+stuck,fault:'ID',calls:1},
 {name:'65 outstanding calls',code:String.raw`for(let id=1;id<=65;id++){std.out.puts(JSON.stringify({t:'call',id,ns:'api',fn:'echo',args:[]})+'\n');}std.out.flush();`+stuck,fault:'OUTSTANDING',calls:64},
 {name:'4097 total calls',code:`for(let i=0;i<64;i++)await Promise.all(Array.from({length:64},()=>api.echo()));`+emit(call(4096))+stuck,fault:'CALL_LIMIT',calls:4096,reply:true},
 {name:'1025 raw log records',code:String.raw`for(let i=0;i<1025;i++)std.out.puts('{"t":"log","level":"info","msg":""}\n');std.out.flush();`+stuck,fault:'LOG_LIMIT',calls:0},
 {name:'raw log byte flood',code:String.raw`for(let i=0;i<65;i++)std.out.puts(JSON.stringify({t:'log',level:'info',msg:'x'.repeat(4096)})+'\n');std.out.flush();`+stuck,fault:'LOG_LIMIT',calls:0},
 {name:'escaped Unicode log overflow',code:String.raw`std.out.puts('{"t":"log","level":"info","msg":"'+'\\u00e9'.repeat(2049)+'"}\n');std.out.flush();`+stuck,fault:'SCHEMA',calls:0},
 {name:'oversized raw frame',code:`const b=new Uint8Array(4096);b.fill(32);for(let i=0;i<257;i++)os.write(1,b.buffer,0,b.length);`+stuck,fault:'FRAME_LIMIT',calls:0},
 ...[0,9,13,30,31,127,128].map(b=>({name:`os.write fd1 control 0x${b.toString(16)}`,
  // One syscall includes a syntactically valid prefix: none may escape validation.
  code:rawWrite(1,JSON.stringify(call(1))+'\n'+String.fromCharCode(b))+stuck,kernel:true,calls:0})),
 {name:'fd2 forged call dropped',code:rawWrite(2,JSON.stringify(call(1))+'\n')+emit({t:'call',id:1,ns:'api',fn:'echo',args:[],forged:true})+stuck,fault:'SCHEMA',calls:0},
 {name:'fd2 RS dropped',code:rawWrite(2,'\x1e{"t":"call","id":1}\n')+emit({t:'done',ok:0,forged:true})+stuck,fault:'SCHEMA',calls:0},
];
function rawWrite(fd,s) {
 return `const payload=${JSON.stringify(Array.from(s,c=>c.charCodeAt(0)))};const bytes=new Uint8Array(payload);os.write(${fd},bytes.buffer,0,bytes.length);`;
}
