// jitk host policy + dispatcher hardening (v0). Trusted side only; the guest is the attacker.
// Wire framing/byte caps are 03's decoder; this module receives parsed call frames.
import { createHash, randomUUID } from 'node:crypto';

export class Violation extends Error {} // any Violation => SIGKILL the VM, fail the run
const granted = new WeakSet(); // calls produced by decide(allow)/approve(); dispatch is single-use

// Frame cap BEFORE accumulation: never buffer more than cap bytes without a LF.
export class LineReader {
  constructor(cap = 1 << 20) { this.cap = cap; this.parts = []; this.len = 0; }
  push(chunk, onLine) {
    let start = 0, nl;
    while ((nl = chunk.indexOf(10, start)) !== -1) {
      if (this.len + nl - start > this.cap) throw new Violation('frame too large');
      this.parts.push(chunk.subarray(start, nl));
      onLine(Buffer.concat(this.parts).toString('latin1')); this.parts = []; this.len = 0;
      start = nl + 1;
    }
    if (this.len + chunk.length - start > this.cap) throw new Violation('frame too large');
    if (start < chunk.length) { this.parts.push(chunk.subarray(start)); this.len += chunk.length - start; }
  }
}

const NAME = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
export const digest = v => createHash('sha256').update(canon(v)).digest('hex');

// Tool registry is host config. Each tool declares effects; nothing is inferred from the guest.
// { args: strictValidator(args)->normalized|throws, reads:'none'|'public'|'private',
//   egress: bool (can move data outside the tenant), writes: bool (state-changing), endorsable: bool
//   (a human may approve it after taint), approval: 'always'|undefined,
//   timeoutMs, invoke(args, cred, {signal, idempotencyKey}), output: validator(result)->value }
export function createRun({ tools, deadline, now = Date.now, limits = {} }) {
  return { id: randomUUID(), tools, deadline, now, nextId: 1, outstanding: 0, calls: 0, denials: 0,
    tainted: { privateRead: false, untrusted: false }, approvals: new Map(),
    limits: { calls: 256, outstanding: 64, denials: 16, ...limits }, dead: false };
}

// Decide a parsed guest call. Returns {kind:'allow'|'deny'|'approve', ...}; throws Violation to kill.
export function decide(run, f) {
  try { return decide1(run, f); } catch (e) { if (e instanceof Violation) run.dead = true; throw e; }
}
function decide1(run, f) {
  if (run.dead) throw new Violation('run is dead');
  if (run.now() >= run.deadline) throw new Violation('deadline');
  // Strict envelope (03 already rejects extra fields; re-check: defense in depth, cheap).
  if (!f || f.t !== 'call' || Object.keys(f).sort().join() !== 'args,fn,id,ns,t') throw new Violation('envelope');
  if (f.id !== run.nextId) throw new Violation('id sequence');
  run.nextId++;
  if (!NAME.test(f.ns) || !NAME.test(f.fn)) throw new Violation('name');
  if (++run.calls > run.limits.calls) throw new Violation('call budget');
  if (run.outstanding >= run.limits.outstanding) throw new Violation('outstanding');
  const tool = Object.hasOwn(run.tools, f.ns) && Object.hasOwn(run.tools[f.ns], f.fn) ? run.tools[f.ns][f.fn] : null;
  if (!tool) throw new Violation('unknown tool'); // generated API never calls unknown tools: forged
  const deny = reason => { if (++run.denials > run.limits.denials) throw new Violation('denial budget');
    return { kind: 'deny', reason }; };
  let args;
  try { args = tool.args(structuredClone(f.args)); } catch { return deny('schema'); }
  // v0 provenance: sticky whole-run labels, host-owned. Confidentiality: private data + egress.
  // Integrity: untrusted content (any tool output) steering a state-changing (writes) tool.
  const call = { run: run.id, id: f.id, ns: f.ns, fn: f.fn, args };
  const conf = tool.egress && run.tainted.privateRead, integ = tool.writes && run.tainted.untrusted;
  if (conf && !tool.endorsable) return deny('private data may not leave via this tool');
  if (conf || integ || tool.approval === 'always') {
    const d = digest(call); run.approvals.set(d, call); return { kind: 'approve', digest: d, call };
  }
  granted.add(call);
  return { kind: 'allow', call };
}

// Approval is decided by an authenticated human/host service, bound to the exact call digest.
export function approve(run, d) {
  const c = run.approvals.get(d); run.approvals.delete(d);
  if (!c || run.dead) return null;
  granted.add(c); return c;
}

// Execute an allowed call. Credentials are minted per call, never serialized to the guest.
export async function dispatch(run, call, { issuer, signal }) {
  if (run.dead || !granted.delete(call)) throw new Violation('call not granted (forged, replayed or dead run)');
  const tool = run.tools[call.ns][call.fn];
  const remaining = run.deadline - run.now();
  if (remaining <= 0) throw new Violation('deadline');
  run.outstanding++;
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), Math.min(tool.timeoutMs, remaining));
  signal?.addEventListener('abort', () => ac.abort(), { once: true });
  let cred;
  try {
    cred = await issuer.issue({ run: run.id, scope: `${call.ns}.${call.fn}`, ttlMs: Math.min(tool.timeoutMs, remaining) });
    const raw = await tool.invoke(call.args, cred, { signal: ac.signal, idempotencyKey: `${run.id}:${call.id}` });
    const value = tool.output(raw); // output schema + redaction; throws => deny
    if (tool.reads === 'private') run.tainted.privateRead = true; // label set before guest sees data
    if (tool.reads !== 'none') run.tainted.untrusted = true;
    return value;
  } finally {
    clearTimeout(t); run.outstanding--;
    if (cred) await issuer.revoke(cred).catch(() => {});
  }
}
