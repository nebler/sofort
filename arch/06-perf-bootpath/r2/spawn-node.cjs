const fs=require('fs'),cp=require('child_process'),path=require('path');
const R=__dirname,T='/tmp/jitk-06/r2';
const now=()=>process.hrtime.bigint();
const uptime=()=>cp.execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim();
const timebase=JSON.parse(fs.readFileSync(path.join(R,'spawn-python.json'))).timebase;
const bridge=cp.execFileSync(`${T}/control`,{encoding:'utf8'}).trim().split(/\s+/);
const clockOffset=BigInt(bridge[1])-BigInt(bridge[2]); // checked against mach_timebase_info in spawn-python.json
async function sample(binary){
 const args=binary==='host'?['/tmp/jitk-06/r2/print.bin']:(binary.startsWith('vmm-')?['--image','/tmp/jitk-01/r2/first.bin']:[]);
 const start=now();const p=cp.spawn(`${T}/${binary}`,args,{stdio:['ignore','pipe','pipe']});const returned=now();
 let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);
 const timer=setTimeout(()=>p.kill('SIGKILL'),10000);
 try {await new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',(code,signal)=>code===0?resolve():reject(Error(`${binary}: ${code} ${signal} ${err}`)))})}finally{clearTimeout(timer)}
 const end=now();let main;
 if(binary.startsWith('vmm-')){
  const ticks=BigInt(err.match(/MAIN_TICKS (\d+)/)[1]);
  main=ticks*BigInt(timebase[0])/BigInt(timebase[1])+clockOffset;
  return {spawn_main_ms:Number(main-start)/1e6,spawn_return_ms:Number(returned-start)/1e6,whole_ms:Number(end-start)/1e6};
 }
 main=binary==='host'?BigInt(JSON.parse(err.trim()).events.find(x=>x[0]==='main')[1]):BigInt(out.match(/MAIN (\d+)/)[1]);const elapsed=Number(main-start)/1e6;
 if(elapsed<0)throw Error('clock mismatch');
 return {spawn_main_ms:elapsed,spawn_return_ms:Number(returned-start)/1e6,whole_ms:Number(end-start)/1e6};
}
function stats(a){a.sort((a,b)=>a-b);return {n:a.length,p50:(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2,p90:a[Math.ceil(a.length*.90)-1],p99:a[Math.ceil(a.length*.99)-1],min:a[0]}}
(async()=>{
 const binaries=process.argv.length>2?process.argv.slice(2):['control','control-hvf','control-krun','control-rust','host','vmm-dynamic','vmm-static-baseline','vmm-static-strip','vmm-static-lto','vmm-static-minimal'];
 const data={execPath:process.execPath,uptime_start:uptime(),timebase,clock_bridge:bridge,clock_offset_ns:String(clockOffset),rows:{},first:{}};
 for(const b of binaries){data.rows[b]=[];data.first[b]=await sample(b)}
 for(let i=0;i<100;i++)for(const b of [...binaries.slice(i%binaries.length),...binaries.slice(0,i%binaries.length)])data.rows[b].push(await sample(b));
 data.uptime_end=uptime();data.summary={};
 for(const [b,rows] of Object.entries(data.rows)){data.summary[b]={};for(const m of Object.keys(rows[0]))data.summary[b][m]=stats(rows.map(r=>r[m]))}
 fs.writeFileSync(path.join(R,process.env.BENCH_OUT||'spawn-node.json'),JSON.stringify(data,null,2));console.log(JSON.stringify(data.summary,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
