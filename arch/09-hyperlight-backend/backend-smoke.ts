import { HyperlightBackend } from './backend.ts';
let checked = 0;
const backend = new HyperlightBackend('/tmp/jitk-09/adapter-target/release/jitk-hyperlight-spike', async () => {checked++;});
const providers = [{ name: 'math', fns: {
  add: async (a:number,b:number) => { await new Promise(r=>setTimeout(r,1)); return a+b; },
  fail: async () => { throw new Error('expected tool failure'); },
}}];
const result = await backend.execute('return await math.add(20,22)', providers, 2000);
if (result !== 42 || checked !== 1) throw new Error('async tool bridge failed');
const errors = await backend.execute('try { await math.fail() } catch(e) { return String(e).includes("expected tool failure") }', providers, 2000);
if (errors !== true) throw new Error('error bridge failed');
const promises = await backend.execute('return await Promise.all([math.add(1,2),math.add(3,4)])', providers, 2000);
if (JSON.stringify(promises) !== '[3,7]') throw new Error('Promise.all failed');
const t=performance.now();
try { await backend.execute('while(true){}',providers,100); throw new Error('deadline missing'); }
catch(e) { if (String(e) !== 'Error: deadline') throw e; }
console.log(JSON.stringify({result,checked,errors,promises,deadline_ms:performance.now()-t}));
