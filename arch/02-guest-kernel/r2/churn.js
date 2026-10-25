// Supply this as the body of a protocol-v1 run frame (not compiled into qjs).
let sum=0;
for (let i=0;i<128;i++) {
  let a=new Uint8Array(1024*1024);
  a[0]=i; a[a.length-1]=i; sum+=a[0];
  a=null; std.gc();
}
return sum; // 8128; 128 MiB cumulative with one 1 MiB user buffer live.
