import {readFileSync,existsSync,openSync,readSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Keep source composition identical in the executor and offline preparer.
export const helperSource='(()=>{\n'+readFileSync(new URL('./codec.mjs',import.meta.url),'utf8').replaceAll('export function ','function ')+'\n'+readFileSync(new URL('./shard-helpers.js',import.meta.url),'utf8')+'\n})();\n';
// The identity also covers the ring bootstrap the helpers are spliced into, so a
// snapshot prepared from an older bootstrap is refused too. build.mjs copies it
// next to the bundle; the offline preparer reads it from the source tree.
const bootstrapUrl=['./ring-bootstrap.js','../kernel/ring-bootstrap.js'].map(p=>new URL(p,import.meta.url)).find(u=>existsSync(u));
if(!bootstrapUrl)throw Error('ring-bootstrap.js not found next to the executor');
export const bootstrapSource=readFileSync(bootstrapUrl,'utf8');
export const helperHash=createHash('sha256').update(helperSource).update('\0').update(bootstrapSource).digest('hex');
export function fileHash(path) {
  const hash=createHash('sha256'),buffer=Buffer.alloc(65536),fd=openSync(path,'r');
  try{let n;while((n=readSync(fd,buffer,0,buffer.length,null)))hash.update(buffer.subarray(0,n));}
  finally{closeSync(fd);}
  return hash.digest('hex');
}
export function verifyPreparedSnapshot(base) {
  const stale=()=>Error('stale shard snapshot: prepared helper identity mismatch; run make -C arch/jitk/shard snapshot');
  let identity;
  try{identity=JSON.parse(readFileSync(base+'.identity','utf8'));}catch{throw stale();}
  if(identity.version!==1||identity.helperSha256!==helperHash)throw stale();
  for(const ext of ['mem','regs','layout']){
    if(identity.files?.[ext]!==fileHash(base+'.'+ext))throw Error('shard snapshot identity mismatch: '+ext+'; run make -C arch/jitk/shard snapshot');
  }
}
