import {receiptPath} from './receipt-path.js';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {type Backend} from './backend.js';
import {ShardBackend} from './shard-backend.js';
import {ShardSet} from './shard-set.js';
import type {ParkingGate} from './pool.js';
// Every emitted entry lives in executor/build; no checkout-name assumptions.
const here=fileURLToPath(new URL('../',import.meta.url));
const jitk=fileURLToPath(new URL('../../',import.meta.url));
function artifact(path:string){if(!existsSync(path))throw Error('missing artifact '+path);return {path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')};}
/** The HVF engine's parking gate (hvf-parking-gate.ts): a PASS receipt for
 *  this engine binary and prepared snapshot, measured with at least these
 *  slots: JITK_HVF_PARKING_GATE when set (only it), else the .work receipt or a
 *  recorded executor/hvf-parking-gate.json. None: the pool runs unwarmed. */
export function hvfGate(binary:string,snapshot:string,slots:number):ParkingGate|undefined {
  const explicit=process.env.JITK_HVF_PARKING_GATE;
  const paths=explicit?[explicit]:[here+'.work/hvf-parking-gate.json',here+'hvf-parking-gate.json'];
  for(const path of paths)if(existsSync(path)){
    const m=JSON.parse(readFileSync(path,'utf8'));
    if(m.engine==='hvf'&&m.status==='PASS'&&m.exchanges>=1000&&m.idle_core_percent<2&&slots<=m.slots&&
      m.engine_sha256===artifact(binary).sha256&&m.snapshot_identity_sha256===artifact(snapshot+'.identity').sha256)
      return {idleCorePercent:m.idle_core_percent,evidence:path};
  }
  return undefined;
}
/** The ring engine for this host: the HVF engine on macOS arm64 (the
 *  default there), the KVM shard on Linux arm64. JITK_BACKEND=hvf|shard
 *  names one explicitly. The selection, engine and snapshot hashes and the
 *  parking gate go to integration-selection.json. */
export function selectBackend():{backend:Backend;gate?:ParkingGate;selection:string} {
  const mac=process.platform==='darwin'&&process.arch==='arm64';
  const selected=process.env.JITK_BACKEND??(mac?'hvf':process.platform==='linux'?'shard':'');
  let backend:ShardBackend|ShardSet,gate:ParkingGate|undefined,selection:string,binary:string,snapshot:string|undefined;
  if(selected==='shard'){
    if(process.platform!=='linux')throw Error('shard backend requires Linux (on macOS: JITK_BACKEND=hvf)');
    binary=process.env.JITK_SHARD_BINARY??jitk+'shard/target/release/real';
    snapshot=process.env.JITK_SHARD_SNAPSHOT;
    if(!snapshot)throw Error('shard backend requires JITK_SHARD_SNAPSHOT=/absolute/path/to/prepared-base');
    // One engine process maps every guest it runs: JITK_SHARD_PROCESS_SLOTS
    // (1..64) splits JITK_SHARD_SLOTS (default 64) across engine processes,
    // each its own trust and failure domain (shard-set.ts).
    const slots=Number(process.env.JITK_SHARD_SLOTS??64),perProcess=Number(process.env.JITK_SHARD_PROCESS_SLOTS??slots);
    if(perProcess>=slots){backend=new ShardBackend({binary,snapshot,slots});selection='Linux KVM shard / shared-memory Node policy';}
    else{backend=new ShardSet({binary,snapshot,slots,slotsPerProcess:perProcess});selection=`Linux KVM shard set (${backend.processes.length} engine processes of up to ${perProcess} slots) / shared-memory Node policy`;}
  }
  // The ring engine on Hypervisor.framework (shard/src/hvf/zygote.rs):
  // JITK_SHARD_BINARY is the signed `hvf` engine and JITK_SHARD_SNAPSHOT a
  // darwin-arm64 prepared snapshot (make -C arch/jitk deps; make -C
  // arch/jitk/shard snapshot). JITK_HVF_SLOTS engine processes (default 8).
  else if(selected==='hvf'){
    if(!mac)throw Error('hvf backend requires macOS arm64');
    binary=process.env.JITK_SHARD_BINARY??'';snapshot=process.env.JITK_SHARD_SNAPSHOT;
    if(!binary||!snapshot)throw Error('hvf backend requires JITK_SHARD_BINARY (the signed hvf engine) and JITK_SHARD_SNAPSHOT (make -C arch/jitk deps; make -C arch/jitk/shard snapshot)');
    const slots=Number(process.env.JITK_HVF_SLOTS??8);
    backend=new ShardBackend({binary,snapshot,slots});gate=hvfGate(binary,snapshot,slots);
    selection='macOS HVF engine (one confined process per slot) / socket Node policy';
  }
  else if(selected==='jitk')throw Error('JITK_BACKEND=jitk (libkrun) was removed; the ring engine is the default (hvf on macOS arm64, shard on Linux)');
  else throw Error('unsupported JITK_BACKEND: '+(selected||'(none for this host)'));
  writeFileSync(receiptPath('integration-selection.json'),JSON.stringify({selection,engine:artifact(binary),snapshot:artifact(snapshot+'.identity'),gate},null,2)+'\n');
  return {backend,gate,selection};
}
