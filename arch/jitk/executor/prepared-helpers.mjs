import {readFileSync,openSync,readSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Keep source composition identical in the executor and offline preparer.
export const helperSource='(()=>{\n'+readFileSync(new URL('./codec.mjs',import.meta.url),'utf8').replaceAll('export function ','function ')+'\n'+readFileSync(new URL('./shard-helpers.js',import.meta.url),'utf8')+'\n})();\n';
export const helperHash=createHash('sha256').update(helperSource).digest('hex');
export function fileHash(path) {
  const hash=createHash('sha256'),buffer=Buffer.alloc(65536),fd=openSync(path,'r');
  try{let n;while((n=readSync(fd,buffer,0,buffer.length,null)))hash.update(buffer.subarray(0,n));}
  finally{closeSync(fd);}
  return hash.digest('hex');
}
export function verifyPreparedSnapshot(base) {
  const stale=()=>Error('stale shard snapshot: prepared helper identity mismatch; re-run shard/harness/prepare-helpers.mjs');
  let identity;
  try{identity=JSON.parse(readFileSync(base+'.identity','utf8'));}catch{throw stale();}
  if(identity.version!==1||identity.helperSha256!==helperHash)throw stale();
  for(const ext of ['mem','regs','layout']){
    if(identity.files?.[ext]!==fileHash(base+'.'+ext))throw Error('shard snapshot identity mismatch: '+ext+'; prepare a new snapshot');
  }
}
