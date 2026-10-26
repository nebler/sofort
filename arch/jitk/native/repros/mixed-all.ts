class S {
 readonly confined:Promise<void>=Promise.resolve();
 readonly watchdogReady:Promise<void>=Promise.resolve();
 read():Promise<unknown>{return Promise.resolve(JSON.parse('{"t":"ready"}'));}
}
const s=new S();
const [first]:any[]=await Promise.all([s.read(),s.confined,s.watchdogReady]);
console.log(first);
