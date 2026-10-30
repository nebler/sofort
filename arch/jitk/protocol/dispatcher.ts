// Protocol v1; no imports or runtime dependencies. Callbacks must not reenter.
export const LIMIT = Object.freeze({frame:1048576, depth:32, structure:32768,
  code:65536, outstanding:64, calls:4096, inflight:2097152,
  wire:16777216, frames:8192, log:4096, logs:1024, logBytes:262144, kernel:4096});
export type Json = null | boolean | number | string | Json[] | {[k:string]:Json};
export type Frame = {[k:string]:Json};
export type Fault = {code:string; message:string};
export class ProtocolError extends Error {
  code:string;
  constructor(code:string, message = code) { super(message); this.code = code; }
}
function bad(code:string):never { throw new ProtocolError(code); }
const own = (v:object,k:string) => Object.prototype.hasOwnProperty.call(v,k);
const object = (v:unknown):v is Frame => !!v && typeof v === 'object' && !Array.isArray(v);
const ident = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
const reserved = new Set(('await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield arguments eval then console print setTimeout clearTimeout globalThis').split(' '));
const name = (v:unknown):v is string => typeof v === 'string' && ident.test(v);
const utf8 = (s:string) => new TextEncoder().encode(s).length;
const levels = new Set(['log','info','warn','error','debug']);
function keys(v:unknown, required:string[]):asserts v is Frame {
  if (!object(v) || Object.keys(v).length !== required.length || required.some(k=>!own(v,k))) bad('SCHEMA');
}
function text(v:unknown, max:number):asserts v is string {
  if (typeof v !== 'string' || v.length > max) bad('SCHEMA');
}
function scalar(s:string) {
  for (let i=0;i<s.length;i++) {
    const c=s.charCodeAt(i);
    if (c>=0xd800 && c<=0xdbff) {
      const n=s.charCodeAt(++i); if (!(n>=0xdc00 && n<=0xdfff)) bad('UNICODE');
    } else if (c>=0xdc00 && c<=0xdfff) bad('UNICODE');
  }
}
// This is a structural/duplicate-key pre-scan, not an alternate JSON decoder.
// Only JSON.parse interprets escapes, key identity, numbers, and JSON grammar.
export function parseFrame(s:string):Frame { return decode(s,true) as Frame; }
// Same limits for a bare JSON value (shard binary records carry no frame object).
export function parseJson(s:string):Json { return decode(s,false); }
// Host output (run, ret: replies from trusted host tools) keeps the frame, depth,
// ASCII, duplicate-key and scalar checks but has no structure budget. That budget
// bounds the host's parse work on untrusted guest frames before JSON.parse; host
// frames are not adversarial, the frame bound already bounds their parse, and real
// tool replies exceed it (a GitHub workflow-runs page: 38,746 values; an OTLP
// metrics page: 212,119; bench/v1/results/2026-10-30-fit-matrix.md).
// A host reply may have a larger frame than LIMIT.frame where the receiver's
// heap can hold one (the shard's larger arena classes: `frame`, their
// ARENA_CLASSES replyBytes); guest frames never do.
export function parseHostFrame(s:string):Frame { return decode(s,true,Infinity) as Frame; }
export function parseHostJson(s:string, frame:number=LIMIT.frame):Json { return decode(s,false,Infinity,frame); }
function decode(s:string, frame:boolean, structure:number=LIMIT.structure, max:number=LIMIT.frame):Json {
  if (!s.length || s.length>max) bad('FRAME_LIMIT');
  const stack:{object:boolean; key:boolean; seen:Set<string>}[]=[];
  let budget=0;
  for (let i=0;i<s.length;i++) {
    const c=s.charCodeAt(i);
    if (c<32 || c>126) bad('ASCII');
    if (c===34) {
      if (++budget>structure) bad('STRUCTURE');
      const start=i, parent=stack[stack.length-1];
      for (i++;i<s.length;i++) {
        const b=s.charCodeAt(i);
        if (b<32 || b>126) bad('ASCII');
        if (b===34) break;
        if (b===92) {
          i++; if (i>=s.length) bad('JSON');
          const escaped=s.charCodeAt(i); if (escaped<32 || escaped>126) bad('ASCII');
        }
      }
      if (i===s.length) bad('JSON');
      if (parent?.object && parent.key) {
        let key:string; try { key=JSON.parse(s.slice(start,i+1)); } catch { return bad('JSON'); }
        if (parent.seen.has(key)) bad('DUPLICATE');
        parent.seen.add(key); parent.key=false;
      }
    } else if (c===123 || c===91) {
      if (++budget>structure) bad('STRUCTURE');
      stack.push({object:c===123,key:c===123,seen:new Set()});
      if (stack.length>LIMIT.depth) bad('DEPTH');
    } else if (c===125 || c===93) {
      if (++budget>structure) bad('STRUCTURE');
      const p=stack.pop(); if (!p || p.object!==(c===125)) bad('JSON');
    } else if (c===44 || c===58) {
      if (++budget>structure) bad('STRUCTURE');
      const p=stack[stack.length-1]; if (c===44 && p?.object) p.key=true;
    }
  }
  let value:unknown; try { value=JSON.parse(s); } catch { return bad('JSON'); }
  if (frame && !object(value)) bad('SCHEMA');
  const walk=(v:unknown):void=> {
    if (typeof v==='number' && (!Number.isFinite(v) || Math.abs(v)>Number.MAX_SAFE_INTEGER)) bad('NUMBER');
    if (typeof v==='string') scalar(v);
    else if (v && typeof v==='object') {
      for (const [k,x] of Object.entries(v)) { scalar(k); walk(x); }
    }
  };
  walk(value); return value as Json;
}
export function schema(m:Frame, direction:'guest'|'host'):void {
  switch (m.t) {
    case 'ready': keys(m,['t','v']); if (direction!=='guest' || m.v!==1) bad('SCHEMA'); break;
    case 'run':
      keys(m,['t','code','ns']); if (direction!=='host') bad('SCHEMA');
      checkCode(m.code); checkTools(m.ns);
      break;
    case 'call':
      keys(m,['t','id','ns','fn','args']); if (direction!=='guest') bad('SCHEMA');
      checkCall(m.ns,m.fn,m.args);
      break;
    case 'ret': checkReply(m,['t','id']); if (direction!=='host') bad('SCHEMA'); break;
    case 'log':
      keys(m,['t','level','msg']); if (direction!=='guest') bad('SCHEMA');
      checkLog(m.level,m.msg);
      break;
    case 'done': checkDone(m,['t']); if (direction!=='guest') bad('SCHEMA'); break;
    default: bad('SCHEMA');
  }
  if (m.t==='call' || m.t==='ret') {
    if (typeof m.id!=='number' || !Number.isSafeInteger(m.id) || m.id<1 || m.id>LIMIT.calls) bad('ID');
  }
}
// Field validators. schema() applies them to v1 frames; the shard adapter, which
// decodes binary records rather than frames, applies the same ones directly.
export function checkCode(code:unknown):void {
  text(code,LIMIT.code); if (utf8(code)>LIMIT.code) bad('SCHEMA'); scalar(code);
}
export function checkTools(ns:unknown):void {
  if (!object(ns)) bad('SCHEMA');
  const entries=Object.entries(ns); if (entries.length>64) bad('SCHEMA');
  let count=0;
  for (const [n,fns] of entries) {
    if (!name(n) || reserved.has(n) || !Array.isArray(fns) || fns.length>256) bad('SCHEMA');
    const seen=new Set<string>();
    for (const fn of fns) {
      if (!name(fn) || fn==='then' || seen.has(fn)) bad('SCHEMA');
      seen.add(fn); if (++count>1024) bad('SCHEMA');
    }
  }
}
export function checkCall(ns:unknown, fn:unknown, args:unknown):void {
  if (!name(ns) || !name(fn) || !Array.isArray(args)) bad('SCHEMA');
}
export function checkLog(level:unknown, msg:unknown):void {
  text(msg,LIMIT.log); if (utf8(msg)>LIMIT.log) bad('SCHEMA');
  if (typeof level!=='string' || !levels.has(level)) bad('SCHEMA');
}
// Exactly `extra` plus one of ok | err; err is {name,message} (done) or {code,message} (reply).
function outcome(m:unknown, extra:string[]):asserts m is Frame {
  if (!object(m)) bad('SCHEMA');
  keys(m,[...extra, own(m,'ok')?'ok':'err']);
}
export function checkDone(m:unknown, extra:string[]=[]):asserts m is Frame {
  outcome(m,extra);
  if (own(m,'err')) { keys(m.err,['name','message']); text(m.err.name,128); text(m.err.message,4096); }
}
export function checkReply(m:unknown, extra:string[]=[]):asserts m is Frame {
  outcome(m,extra);
  if (own(m,'err')) {
    keys(m.err,['code','message']); text(m.err.code,64); text(m.err.message,4096);
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(m.err.code as string)) bad('SCHEMA');
  }
}
/** One guest run's host-side state, independent of transport: call ids (in order
 * from 1), open calls and their bytes, and the log budget. The v1 Dispatcher and
 * the shard adapter each keep one, so both enforce the same limits and codes. */
export class RunBudget {
  next=1; readonly pending=new Map<number,number>(); inflight=0; logs=0; logBytes=0;
  call(id:number, bytes:number) {
    if (this.next>LIMIT.calls) bad('CALL_LIMIT');
    if (id!==this.next) bad('ID');
    if (this.pending.size>=LIMIT.outstanding) bad('OUTSTANDING');
    if (this.inflight+bytes>LIMIT.inflight) bad('INFLIGHT');
    this.pending.set(id,bytes); this.next++; this.inflight+=bytes;
  }
  log(msg:string) {
    if (this.logs+1>LIMIT.logs || this.logBytes+utf8(msg)>LIMIT.logBytes) bad('LOG_LIMIT');
    this.logs++; this.logBytes+=utf8(msg);
  }
  open(id:number):boolean { return this.pending.has(id); }
  reply(id:number) {
    const bytes=this.pending.get(id); if (bytes===undefined) bad('ID');
    this.inflight-=bytes; this.pending.delete(id);
  }
  done(ok:boolean) { if (ok && this.pending.size) bad('OUTSTANDING_DONE'); this.clear(); }
  clear() { this.pending.clear(); this.inflight=0; }
}
export function encode(m:unknown):Uint8Array {
  let s:string|undefined;
  try { s=JSON.stringify(m); } catch { return bad('SERIALIZE'); }
  if (s===undefined) bad('SERIALIZE');
  s=s.replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  parseHostFrame(s); // Host-output limits and the same scalar-value semantics.
  return new TextEncoder().encode(s+'\n');
}
export type Hooks = {
  kill:(fault:Fault)=>void;
  message:(frame:Frame)=>void; // Must admit bounded work synchronously; never await tools here.
  kernel?:(record:string)=>void; // Diagnostics only; never dispatch or infer success.
};
export class Dispatcher {
  private state:'ready'|'parked'|'running'|'done'|'dead'='ready';
  private buf=new Uint8Array(1024);
  private used=0;
  private inBytes=0; private outBytes=0; private frames=0;
  private run=new RunBudget();
  private fault:Fault|undefined;
  private hooks:Hooks;
  constructor(hooks:Hooks) { this.hooks=hooks; }
  snapshot() { return {state:this.state,buffered:this.used,capacity:this.buf.length,
    outstanding:this.run.pending.size,inflight:this.run.inflight,next:this.run.next,
    inBytes:this.inBytes,outBytes:this.outBytes,frames:this.frames,logs:this.run.logs,logBytes:this.run.logBytes}; }
  cancel(code='CANCELLED') {
    if (this.state==='dead') return;
    this.state='dead'; this.used=0; this.buf=new Uint8Array(0); this.run.clear();
    this.fault={code,message:code}; this.hooks.kill(this.fault);
  }
  private fail(e:unknown):never {
    const code=e instanceof ProtocolError?e.code:'HOST_ERROR'; this.cancel(code);
    throw new ProtocolError(this.fault?.code??code);
  }
  private alive() { if (this.state==='dead') bad(this.fault?.code??'STATE'); }
  feed(chunk:Uint8Array):void {
    try {
      this.alive();
      // Entire input byte budget is checked before retaining ANY chunk bytes.
      if (this.inBytes+chunk.length>LIMIT.wire) bad('WIRE_LIMIT');
      this.inBytes+=chunk.length;
      for (let i=0;i<chunk.length;i++) {
        const c=chunk[i];
        if (c===10) {
          if (++this.frames>LIMIT.frames) bad('FRAME_COUNT');
          const line=new TextDecoder().decode(this.buf.subarray(0,this.used)); this.used=0;
          if (line.charCodeAt(0)===30) {
            if (line.length-1>LIMIT.kernel) bad('KERNEL_LIMIT');
            this.hooks.kernel?.(line.slice(1)); continue;
          }
          const m=parseFrame(line); schema(m,'guest'); this.accept(m,line.length+1); this.hooks.message(m);
          continue;
        }
        if (c<32 && !(c===30 && this.used===0) || c>126) bad('ASCII');
        const max=this.used && this.buf[0]===30?LIMIT.kernel+1:LIMIT.frame;
        if (this.used>=max) bad(this.buf[0]===30?'KERNEL_LIMIT':'FRAME_LIMIT');
        if (this.used===this.buf.length) {
          const b=new Uint8Array(Math.min(max,this.buf.length*2)); b.set(this.buf); this.buf=b;
        }
        this.buf[this.used++]=c;
      }
    } catch(e) { this.fail(e); }
  }
  private accept(m:Frame, bytes:number) {
    if (m.t==='ready' && this.state==='ready') { this.state='parked'; return; }
    if (this.state!=='running') bad('STATE');
    if (m.t==='call') this.run.call(m.id as number,bytes);
    else if (m.t==='log') this.run.log(m.msg as string);
    else if (m.t==='done') { this.run.done(own(m,'ok')); this.state='done'; }
    else bad('STATE');
  }
  // enqueue is synchronous, bounded, all-or-nothing; false means retry this frame.
  // It must never invoke feed. No state/credit is released until it accepts bytes.
  send(value:unknown, enqueue:(wire:Uint8Array)=>boolean):boolean {
    try {
      this.alive(); const wire=encode(value);
      const m=parseHostFrame(new TextDecoder().decode(wire.subarray(0,-1))); schema(m,'host');
      if (m.t==='run' ? this.state!=='parked' : this.state!=='running') bad('STATE');
      if (m.t==='ret' && !this.run.open(m.id as number)) bad('ID');
      if (this.outBytes+wire.length>LIMIT.wire) bad('WIRE_LIMIT');
      if (!enqueue(wire)) return false;
      this.outBytes+=wire.length;
      if (m.t==='run') this.state='running';
      else this.run.reply(m.id as number);
      return true;
    } catch(e) { return this.fail(e); }
  }
  eof():void {
    try { this.alive(); if (this.used || this.state!=='done') bad('EOF'); }
    catch(e) { this.fail(e); }
  }
}
