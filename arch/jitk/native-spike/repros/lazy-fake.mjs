let Fake;
async function init() {
  Fake = class {
    instances=[];
    async park(signal) {
      let reap;
      const exited=new Promise(resolve=>reap=resolve);
      const sandbox={exited,reap,read:async()=>null,send:async()=>{},kill:()=>sandbox.reap()};
      this.instances.push(sandbox);
      if(signal?.aborted)sandbox.reap();
      return sandbox;
    }
  };
}
await init();
console.log((await new Fake().park()).exited!==undefined);
