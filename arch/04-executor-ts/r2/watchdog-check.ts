import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {ProcessBackend} from './backend.js';
const loadBefore=execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
const backend=new ProcessBackend('local-qjs',process.execPath,[fileURLToPath(new URL('../fixtures/protocol-peer.mjs',import.meta.url)),'watchdog'],32,{lifetimeMs:250});
const s=await backend.park();
try {
  const start=performance.now();
  // This blocks the trusted Node event loop without burning a CPU core. The
  // separate watchdog must kill the child while Node cannot run timers.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1500);
  let timer:ReturnType<typeof setTimeout>|undefined;
  const reaped=await Promise.race([s.exited.then(()=>true),new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),500);})]);
  clearTimeout(timer);assert(reaped,'external watchdog must fire independently of host event loop');
  const result={loadBefore,loadAfter:execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),watchdogDeadlineMs:250,hostEventLoopBlockedMs:1500,observedReapAfterHostUnblockMs:performance.now()-start,reaped,killLatency:'UNVERIFIED: host event loop intentionally blocked'};
  writeFileSync('watchdog-check-results.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{s.kill();await s.exited;}
