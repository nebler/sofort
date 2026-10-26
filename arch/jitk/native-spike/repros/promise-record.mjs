class Pool {
  constructor(backend) { this.backend=backend; }
}
const sandbox = {exited:Promise.resolve(),read:async()=>({t:'done',ok:2}),send:async()=>{},kill:()=>{}};
const backend = {kind:'jitk',memoryLimitMB:32,park:async()=>sandbox};
console.log(new Pool(backend).backend.kind);
