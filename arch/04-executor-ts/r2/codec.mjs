// Same wire tag/semantics as codemode 0.5.5's SANDBOX_CODEC.
const tag='__codemode_binary_v1__', alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function installBase64() {
  globalThis.btoa ??= function(s) {
    let out='';
    for(let i=0;i<s.length;i+=3){
      const a=s.charCodeAt(i),b=s.charCodeAt(i+1),c=s.charCodeAt(i+2);
      if(a>255||b>255||c>255)throw new Error('invalid base64 input');
      const n=(a<<16)|((b||0)<<8)|(c||0);
      out+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63]+(i+1<s.length?alphabet[(n>>>6)&63]:'=')+(i+2<s.length?alphabet[n&63]:'=');
    }return out;
  };
  globalThis.atob ??= function(s) {
    if(s.length%4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw new Error('invalid base64');
    let out='';for(let i=0;i<s.length;i+=4){const n=(alphabet.indexOf(s[i])<<18)|(alphabet.indexOf(s[i+1])<<12)|((alphabet.indexOf(s[i+2])&63)<<6)|(alphabet.indexOf(s[i+3])&63);out+=String.fromCharCode((n>>>16)&255);if(s[i+2]!=='=')out+=String.fromCharCode((n>>>8)&255);if(s[i+3]!=='=')out+=String.fromCharCode(n&255);}return out;
  };
}
export function stringify(value) {
  return JSON.stringify(value,(_k,v)=>{
    if(v instanceof ArrayBuffer||ArrayBuffer.isView(v)){
      const bytes=v instanceof ArrayBuffer?new Uint8Array(v):new Uint8Array(v.buffer,v.byteOffset,v.byteLength);
      let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      return {[tag]:v instanceof ArrayBuffer?'ArrayBuffer':v instanceof Uint8Array?'Uint8Array':'ArrayBufferView',data:btoa(binary)};
    }return v;
  });
}
export function parse(text) {
  return JSON.parse(text,(_k,v)=>{
    if(v&&typeof v==='object'&&tag in v&&typeof v.data==='string'){
      const binary=atob(v.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return v[tag]==='ArrayBuffer'?bytes.buffer:bytes;
    }return v;
  });
}
