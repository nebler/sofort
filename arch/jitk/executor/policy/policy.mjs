// jitk host policy + dispatcher hardening (v0). Trusted side only; the guest is the attacker.
// Wire framing/byte caps are 03's decoder; this module receives parsed call frames.
import { createHash, randomUUID } from 'node:crypto';

export class Violation extends Error {} // any Violation => SIGKILL the VM, fail the run
// A tool failure as the guest sees it: the tool's declared error() redaction, else only its name.
// Never the raw error, which may carry private data or a credential the output() redaction never saw.
export class ToolError extends Error { name = 'ToolError'; }
// A refusal the guest sees as DENIED. Every one counts against the run's denial budget.
export class Denial extends Error { name = 'Denial'; }
export function denial(run, reason) {
  if (++run.denials > run.limits.denials) { run.dead = true; throw new Violation('denial budget'); }
  return new Denial(reason);
}
// Calls produced by decide(allow)/approve() -> the label reasons their grant covered.
// dispatch is single-use and refuses a call whose reasons grew since it was granted.
const granted = new WeakMap();
const grantReasons = new WeakMap(); // approval-pending call -> reasons it was approved for

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
//   timeoutMs, invoke(args, cred, {signal, idempotencyKey}), output: validator(result)->value,
//   error?: redactor(thrown)->string (default: '<ns>.<fn> failed') }
// Per-run policy budgets. The call budget sits below the protocol's own (LIMIT.calls): a run is
// admitted far fewer host calls than the wire could carry.
export const DEFAULT_LIMITS = Object.freeze({ calls: 256, outstanding: 64, denials: 16 });
// tainted: labels the run starts with, e.g. carried from an earlier run of the same conversation:
// a model that saw private or untrusted data writes the next run's code under that influence.
export function createRun({ tools, deadline, now = Date.now, limits = {}, tainted = {} }) {
  return { id: randomUUID(), tools, deadline, now, nextId: 1, outstanding: 0, calls: 0, denials: 0,
    tainted: { privateRead: !!tainted.privateRead, untrusted: !!tainted.untrusted }, approvals: new Map(),
    limits: { ...DEFAULT_LIMITS, ...limits }, dead: false };
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
  const e = effects(run, tool);
  if (e.blocked) return deny('private data may not leave via this tool');
  if (e.reasons.length) {
    const d = digest(call); run.approvals.set(d, call); grantReasons.set(call, e.reasons); return { kind: 'approve', digest: d, call };
  }
  granted.set(call, e.reasons);
  return { kind: 'allow', call };
}
// What the run's current labels require of this tool: blocked outright, or approval for these reasons.
function effects(run, tool) {
  const conf = tool.egress && run.tainted.privateRead, integ = tool.writes && run.tainted.untrusted;
  const reasons = [];
  if (conf) reasons.push('private-egress');
  if (integ) reasons.push('untrusted-write');
  if (tool.approval === 'always') reasons.push('always');
  return { blocked: conf && !tool.endorsable, reasons };
}

// Approval is decided by an authenticated human/host service, bound to the exact call digest.
export function approve(run, d) {
  const c = run.approvals.get(d); run.approvals.delete(d);
  if (!c || run.dead) return null;
  granted.set(c, grantReasons.get(c) ?? []); return c;
}

// Execute an allowed call. Credentials are minted per call, never serialized to the guest.
export async function dispatch(run, call, { issuer, signal }) {
  const covered = granted.get(call);
  if (run.dead || !granted.delete(call)) throw new Violation('call not granted (forged, replayed or dead run)');
  const tool = run.tools[call.ns][call.fn];
  const remaining = run.deadline - run.now();
  if (remaining <= 0) throw new Violation('deadline');
  if (signal?.aborted) throw new Error('call cancelled before invocation');
  run.outstanding++;
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), Math.min(tool.timeoutMs, remaining));
  const cancel = () => ac.abort(); signal?.addEventListener('abort', cancel, { once: true });
  let cred;
  try {
    // A broker failure reaches the guest only as this fixed text: its own message may carry
    // secrets, and nothing has been read into the run to label it.
    try { cred = await issuer.issue({ run: run.id, scope: `${call.ns}.${call.fn}`, ttlMs: Math.min(tool.timeoutMs, remaining) }); }
    catch { throw new ToolError(`${call.ns}.${call.fn} credential unavailable`); }
    // Cancelled, timed out or killed while the credential was minted: the tool never starts.
    if (ac.signal.aborted || run.dead || run.now() >= run.deadline) throw new Error('call cancelled before invocation');
    // Labels may have risen while this call waited (policy hook, approver, issuer): other calls of
    // the run read private or untrusted data meanwhile. The grant covers only the labels it saw.
    const e = effects(run, tool);
    if (e.blocked || e.reasons.some(r => !covered.includes(r))) throw denial(run, 'labels changed before invocation');
    // Labels before invoke: a result, an error or a timeout can each carry what the tool read.
    if (tool.reads === 'private') run.tainted.privateRead = true;
    if (tool.reads !== 'none') run.tainted.untrusted = true;
    try {
      const raw = await tool.invoke(call.args, cred, { signal: ac.signal, idempotencyKey: `${run.id}:${call.id}` });
      return tool.output(raw); // output schema + redaction
    } catch (e) {
      let text; try { text = tool.error ? String(tool.error(e)).slice(0, 4096) : undefined; } catch {}
      throw new ToolError(text ?? `${call.ns}.${call.fn} failed`);
    }
  } finally {
    clearTimeout(t); signal?.removeEventListener('abort', cancel); run.outstanding--;
    if (cred) await issuer.revoke(cred).catch(() => {});
  }
}
