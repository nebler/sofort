import {existsSync,readFileSync,copyFileSync,mkdirSync,chmodSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {JitkBackend,LocalProcessQjsBackend,type Backend} from './backend.js';
import type {ParkingGate} from './pool.js';
const arch=fileURLToPath(new URL('../../../',import.meta.url));
const here=fileURLToPath(new URL('../',import.meta.url));
export function selectBackend():{backend:Backend;gate?:ParkingGate;selection:string} {
  const selected=process.env.JITK_BACKEND??'best';
  if(selected!=='local-qjs'&&existsSync(arch+'02-guest-kernel/r2/READY')) {
    const owner=arch+'02-guest-kernel/r2/';
    const candidates=['parking-0.json','parking-1000.json'].filter(n=>existsSync(owner+n)).map(name=>({name,...JSON.parse(readFileSync(owner+name,'utf8'))})).filter(m=>m.status==='PASS'&&m.exchanges>=1000).sort((a,b)=>a.idle_core_percent-b.idle_core_percent);
    const measurement=candidates[0];
    const tick=measurement?.tick_us??0;
    const host=snapshot('/tmp/jitk-02/r2/host',true),image=snapshot('/tmp/jitk-02/r2/kernel.bin');
    const gate=measurement?{idleCorePercent:measurement.idle_core_percent,evidence:owner+measurement.name}:undefined;
    writeFileSync(here+'integration-selection.json',JSON.stringify({host,image,tick,gate,ownerReady:readFileSync(owner+'READY','utf8'),ownerReadme:owner+'README.md'},null,2)+'\n');
    if(measurement)writeFileSync(here+'jitk-owner-parking.json',JSON.stringify(measurement,null,2)+'\n');
    return {backend:new JitkBackend(host.path,{launcher:'02-r2',image:image.path,env:{JITK_TICK_US:String(tick)}}),gate,
      selection:`02 r2 READY / native Rust host / tick=${tick}us (panic=abort; containment integration pending)`};
  }
  if(selected==='jitk')throw Error('jitk protocol-v1 READY artifact unavailable');
  return {backend:new LocalProcessQjsBackend(process.env.QJS??'/tmp/jitk-04/quickjs-2026-06-04/qjs'),
    selection:selected==='local-qjs'?'local-qjs UNSAFE development only':'local-qjs UNSAFE fallback; G3 UNVERIFIED (no kernel READY)',gate:loadGate('local-idle.json')};
}
function snapshot(source:string,executable=false) {
  const sha256=createHash('sha256').update(readFileSync(source)).digest('hex');
  const dir='/tmp/jitk-04/r2';mkdirSync(dir,{recursive:true});
  const path=dir+'/'+sha256+(executable?'-host':'-kernel.bin');
  if(!existsSync(path)){copyFileSync(source,path);if(executable)chmodSync(path,0o755);}
  return {source,path,sha256};
}
function loadGate(name:string):ParkingGate|undefined {
  const path=here+name;if(!existsSync(path))return;
  const r=JSON.parse(readFileSync(path,'utf8'));
  return {idleCorePercent:r.idleCorePercent,evidence:path};
}
