import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {JitkBackend} from './backend.js';
import type {Backend} from './types.js';
import type {ParkingGate} from './pool.js';
import {requireArtifact} from '../tslib/deps.ts';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function selectBackend():{backend:Backend;gate?:ParkingGate;selection:string;integrated:boolean} {
  if(process.platform!=='darwin')throw Error('native core currently supports macOS HVF only');
  if(process.env.JITK_BACKEND&&process.env.JITK_BACKEND!=='jitk')throw Error('native core supports only JITK_BACKEND=jitk');
  const vmm=requireArtifact('JITK_VMM_BINARY');
  const image=process.env.JITK_KERNEL_IMAGE||resolve(root,'kernel/dist/kernel.bin');
  if(!existsSync(vmm)||!existsSync(image))throw Error('missing VMM/kernel '+vmm+', '+image+'; run make -C arch/jitk deps build, or set JITK_VMM_BINARY and JITK_KERNEL_IMAGE');
  const hash=(p:string):string=>createHash('sha256').update(readFileSync(p)).digest('hex');
  const vh=hash(vmm),kh=hash(image);
  let gate:ParkingGate|undefined;
  const paths=[resolve(root,'kernel/parking-0.json'),resolve(root,'kernel/evidence/parking-0.json'),resolve(root,'executor/fixtures/parking-gate.json')];
  for(const path of paths)if(existsSync(path)){
    const m:any=JSON.parse(readFileSync(path,'utf8'));
    if((!m.image_sha256||m.image_sha256===kh)&&(!m.vmm_sha256||m.vmm_sha256===vh)&&m.status==='PASS'&&m.exchanges>=1000&&m.idle_core_percent<2){gate={idleCorePercent:m.idle_core_percent,evidence:path};break;}
  }
  // Same fallback as the current selector: kernel READY's measured G1.
  const marker=resolve(root,'kernel/.READY');
  if(!gate&&existsSync(marker)){
    const km:any=JSON.parse(readFileSync(marker,'utf8')),s=String(km.gates?.G1??'');
    const pct=s.match(/^([0-9.]+)%.*?(\d+)\/(\d+)/),below=s.match(/^(\d+)\/(\d+); idle CPU below ps resolution/);
    if(pct&&Number(pct[1])<2&&Number(pct[2])>=1000&&pct[2]===pct[3])gate={idleCorePercent:Number(pct[1]),evidence:marker+': '+s};
    if(below&&Number(below[1])>=1000&&below[1]===below[2])gate={idleCorePercent:0,evidence:marker+': '+s};
  }
  return {backend:new JitkBackend(vmm,{launcher:'01-vmm',image,requireSandboxAck:true}),gate,selection:'native macOS HVF / confined VMM / QuickJS',integrated:true};
}
