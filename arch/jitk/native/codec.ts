// The host accepts binary tags used by the canonical guest codec.
const tag='__codemode_binary_v1__';
export function stringify(value:any):string {
  return JSON.stringify(value,(_k:string,v:any)=>{
    if(v instanceof ArrayBuffer||ArrayBuffer.isView(v)){
      const bytes=v instanceof ArrayBuffer?new Uint8Array(v):new Uint8Array(v.buffer,v.byteOffset,v.byteLength);
      return {[tag]:v instanceof ArrayBuffer?'ArrayBuffer':v instanceof Uint8Array?'Uint8Array':'ArrayBufferView',data:Buffer.from(bytes).toString('base64')};
    }return v;
  });
}
export function parse(text:string):any {
  return JSON.parse(text,(_k:string,v:any)=>{
    if(v&&typeof v==='object'&&tag in v&&typeof v.data==='string'){
      const bytes=new Uint8Array(Buffer.from(v.data,'base64'));return v[tag]==='ArrayBuffer'?bytes.buffer:bytes;
    }return v;
  });
}
