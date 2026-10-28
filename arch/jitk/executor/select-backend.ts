import {receiptPath} from './receipt-path.js';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {JitkBackend,type Backend} from './backend.js';
import {ShardBackend} from './shard-backend.js';
import type {ParkingGate} from './pool.js';
// Every emitted entry lives in executor/build; no checkout-name assumptions.
const here=fileURLToPath(new URL('../',import.meta.url));
const jitk=fileURLToPath(new URL('../../',import.meta.url));
function artifact(path:string){if(!existsSync(path))throw Error('missing artifact '+path);return {path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')};}
function marker(dir:string):any {
  try{return JSON.parse(readFileSync(dir+'.READY','utf8'));}catch{return {};}
}
function artifactPath(dir:string,keys:string[],defaults:string[],env:string):string {
  if(process.env[env])return process.env[env]!;
  // Prefer local build outputs over stale absolute paths in copied receipts.
  for(const path of defaults)if(existsSync(dir+path))return dir+path;
  const data=marker(dir);
  for(const key of keys)if(typeof data[key]==='string'&&!data[key].startsWith('/')&&existsSync(dir+data[key]))return dir+data[key];
  throw Error(`missing built artifact in ${dir}; build that subtree or set ${env} to its absolute path`);
}
export function selectBackend():{backend:Backend;gate?:ParkingGate;selection:string;integrated:boolean} {
  const selected=process.env.JITK_BACKEND??'jitk';
  if(selected==='shard'){
    if(process.platform!=='linux')throw Error('shard backend requires Linux (on macOS: JITK_BACKEND=hvf)');
    const binary=process.env.JITK_SHARD_BINARY??jitk+'shard/target/release/real';
    const snapshot=process.env.JITK_SHARD_SNAPSHOT;
    if(!snapshot)throw Error('shard backend requires JITK_SHARD_SNAPSHOT=/absolute/path/to/prepared-base');
    return {backend:new ShardBackend({binary,snapshot}),selection:'experimental Linux KVM shard / shared-memory Node policy',integrated:false};
  }
  // The same ring engine on Hypervisor.framework (shard/src/hvf/zygote.rs):
  // JITK_SHARD_BINARY is the signed `hvf` engine and JITK_SHARD_SNAPSHOT a
  // darwin-arm64 prepared snapshot (make -C arch/jitk deps; make -C
  // arch/jitk/shard snapshot). JITK_HVF_SLOTS engine processes (default 8).
  if(selected==='hvf'){
    if(process.platform!=='darwin'||process.arch!=='arm64')throw Error('hvf backend requires macOS arm64');
    const binary=process.env.JITK_SHARD_BINARY,snapshot=process.env.JITK_SHARD_SNAPSHOT;
    if(!binary||!snapshot)throw Error('hvf backend requires JITK_SHARD_BINARY (the signed hvf engine) and JITK_SHARD_SNAPSHOT (make -C arch/jitk deps; make -C arch/jitk/shard snapshot)');
    const slots=Number(process.env.JITK_HVF_SLOTS??8);
    return {backend:new ShardBackend({binary,snapshot,slots}),selection:'experimental macOS HVF engine (one confined process per slot) / socket Node policy',integrated:false};
  }
  if(selected!=='jitk')throw Error('unsupported JITK_BACKEND: '+selected);
  const vmmReady=existsSync(jitk+'vmm/.READY'),kernelReady=existsSync(jitk+'kernel/.READY');
  const host=artifact(artifactPath(jitk+'vmm/',['binary','vmm','host'],['jitk-vmm','build/jitk-vmm','target/release/jitk-vmm'],'JITK_VMM_BINARY'));
  const image=artifact(artifactPath(jitk+'kernel/',['image','kernel'],['dist/kernel.bin','kernel.bin','build/kernel.bin'],'JITK_KERNEL_IMAGE'));
  let gate:ParkingGate|undefined;
  for(const path of [jitk+'kernel/parking-0.json',jitk+'kernel/evidence/parking-0.json',here+'fixtures/parking-gate.json'])if(existsSync(path)){
    const m=JSON.parse(readFileSync(path,'utf8'));
    if((!m.image_sha256||m.image_sha256===image.sha256)&&(!m.vmm_sha256||m.vmm_sha256===host.sha256)&&m.status==='PASS'&&m.exchanges>=1000&&m.idle_core_percent<2){gate={idleCorePercent:m.idle_core_percent,evidence:path};break;}
  }
  const km=marker(jitk+'kernel/'),vm=marker(jitk+'vmm/');
  if(!process.env.JITK_KERNEL_IMAGE&&km.sha256&&km.sha256!==image.sha256)throw Error('kernel READY hash mismatch');
  if(!process.env.JITK_VMM_BINARY&&vm.binary_sha256&&vm.binary_sha256!==host.sha256)throw Error('VMM READY hash mismatch');
  // kernel/.READY G1 is either "X% ... N/M" or "N/N; idle CPU below ps resolution" (= 0%).
  const g1s=typeof km.gates?.G1==='string'?km.gates.G1:'';
  const pct=g1s.match(/^([0-9.]+)%.*?(\d+)\/(\d+)/),below=g1s.match(/^(\d+)\/(\d+); idle CPU below ps resolution/);
  const g1=pct?{idle:Number(pct[1]),n:pct[2],m:pct[3]}:below?{idle:0,n:below[1],m:below[2]}:null;
  if(!gate&&g1&&g1.idle<2&&Number(g1.n)>=1000&&g1.n===g1.m)gate={idleCorePercent:g1.idle,evidence:jitk+'kernel/.READY: '+g1s};
  const integrated=vmmReady&&kernelReady;
  const selection=`${integrated?'integrated':'built'} jitk / confined VMM / current kernel`;
  writeFileSync(receiptPath('integration-selection.json'),JSON.stringify({selection,integrated,host,image,gate,vmmReady,kernelReady},null,2)+'\n');
  return {backend:new JitkBackend(host.path,{launcher:'01-vmm',image:image.path,requireSandboxAck:true}),gate,selection,integrated};
}
