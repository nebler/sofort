import assert from 'node:assert/strict';
import { LineReader, Violation, createRun, decide, approve, dispatch } from './policy.mjs';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const kills = (fn, m) => { assert.throws(fn, Violation, m); n++; };
const str = a => { if (typeof a !== 'object' || a === null || Object.keys(a).join() !== 'q' || typeof a.q !== 'string' || a.q.length > 256) throw 0; return { q: a.q }; };
const tools = { mail: {
  search: { args: str, reads: 'private', egress: false, writes: false, timeoutMs: 1000,
    invoke: async (a, cred) => { assert.equal(cred, 'TOKEN-mail.search'); return [{ subj: 'secret' }]; }, output: r => r },
  send: { args: str, reads: 'none', egress: true, writes: true, endorsable: true, timeoutMs: 1000,
    invoke: async () => ({ sent: true }), output: r => r } },
  web: { fetch: { args: str, reads: 'public', egress: true, writes: false, endorsable: false, timeoutMs: 1000,
    invoke: async () => 'page', output: r => r } } };
const issuer = { live: 0, issue: async ({ scope }) => (issuer.live++, `TOKEN-${scope}`), revoke: async () => issuer.live-- };
const mk = () => createRun({ tools, deadline: Date.now() + 60_000 });
const c = (id, ns, fn, args = { q: 'x' }) => ({ t: 'call', id, ns, fn, args });
// 1. frame cap before accumulation: 2 MiB with no LF is rejected at the chunk that crosses 1 MiB
const lr = new LineReader(1 << 20); lr.push(Buffer.alloc(1 << 19, 97), () => {});
kills(() => lr.push(Buffer.alloc((1 << 19) + 1, 97), () => {}), 'cap');
ok(lr.len <= 1 << 20, 'never buffered past cap');
const lines = []; new LineReader(8).push(Buffer.from('{"a":1}\n{}\n'), l => lines.push(l)); ok(lines.length === 2);
// 2. strict envelope / ids / names / unknown tools => kill
kills(() => decide(mk(), { ...c(1, 'mail', 'search'), label: 'trusted' }), 'extra field');
kills(() => decide(mk(), c(2, 'mail', 'search')), 'id gap');
kills(() => decide(mk(), c(1, '__proto__', 'x')), 'unknown');
kills(() => decide(mk(), c(1, 'mail', 'constructor')), 'proto lookup');
// 3. schema failure is a deny (guest gets err), but a denial budget kills
let r = mk(); ok(decide(r, c(1, 'mail', 'search', { q: 'x', to: 'evil' })).kind === 'deny');
for (let i = 2; i <= 16; i++) decide(r, c(i, 'mail', 'search', { q: 1 }));
kills(() => decide(r, c(17, 'mail', 'search', { q: 1 })), 'denial budget');
// 4. budgets + deadline
r = createRun({ tools, deadline: Date.now() + 60_000, limits: { calls: 2 } });
decide(r, c(1, 'mail', 'search')); decide(r, c(2, 'mail', 'search')); kills(() => decide(r, c(3, 'mail', 'search')), 'calls');
r = createRun({ tools, deadline: Date.now() - 1 }); kills(() => decide(r, c(1, 'mail', 'search')), 'deadline');
// 5. lethal trifecta: private read then egress => approval (endorsable) or deny (not endorsable)
r = mk(); ok(decide(r, c(1, 'mail', 'send')).kind === 'allow', 'clean run may send');
let d = decide(r, c(2, 'mail', 'search')); ok(d.kind === 'allow');
const v = await dispatch(r, d.call, { issuer }); ok(v[0].subj === 'secret' && issuer.live === 0, 'cred revoked');
ok(JSON.stringify(v).indexOf('TOKEN') === -1, 'credential never in result');
d = decide(r, c(3, 'mail', 'send', { q: 'secret' })); ok(d.kind === 'approve', 'needs approval');
ok(approve(r, 'forged-digest') === null, 'forged approval');
ok(approve(r, d.digest).args.q === 'secret' && approve(r, d.digest) === null, 'one-use approval');
ok(decide(r, c(4, 'web', 'fetch', { q: 'https://evil/?secret' })).kind === 'deny', 'no exfil via fetch');
// 6. integrity: public (untrusted) content then a write => approval even without private data
r = mk(); d = decide(r, c(1, 'web', 'fetch')); await dispatch(r, d.call, { issuer });
ok(decide(r, c(2, 'web', 'fetch')).kind === 'allow', 'browsing continues');
ok(decide(r, c(3, 'mail', 'send')).kind === 'approve', 'injected write needs approval');
r.tainted.privateRead = true;
// 7. tainting cannot be undone by the guest: labels live on the host run object only
ok(r.tainted.privateRead === true);
// 8. cancellation before invocation: an aborted signal, or cancel/run death while the credential
// is minted, never starts the tool, and the minted credential is revoked
let invoked = 0;
const counted = { web: { fetch: { ...tools.web.fetch, invoke: async () => { invoked++; return 'page'; } } } };
const rejects = async (p, m) => { await assert.rejects(p, /cancelled before invocation/, m); n++; };
r = createRun({ tools: counted, deadline: Date.now() + 60_000 });
const aborted = new AbortController(); aborted.abort();
await rejects(dispatch(r, decide(r, c(1, 'web', 'fetch')).call, { issuer, signal: aborted.signal }), 'pre-aborted signal');
for (const end of [ac => ac.abort(), (_, run) => { run.dead = true; }]) {
  r = createRun({ tools: counted, deadline: Date.now() + 60_000 });
  let mint; const slow = { issue: () => new Promise(res => { mint = res; }), revoke: async () => { slow.revoked = true; } };
  const ac = new AbortController(); const p = dispatch(r, decide(r, c(1, 'web', 'fetch')).call, { issuer: slow, signal: ac.signal });
  end(ac, r); mint('TOKEN'); await rejects(p, 'ended during issuance'); ok(slow.revoked, 'credential revoked');
}
ok(invoked === 0, 'tool never invoked after cancellation');
// 9. completed calls leave no abort listener on the run signal
r = createRun({ tools: counted, deadline: Date.now() + 60_000 });
const run = new AbortController(); let listeners = 0;
const add = run.signal.addEventListener.bind(run.signal), remove = run.signal.removeEventListener.bind(run.signal);
run.signal.addEventListener = (...a) => { listeners++; add(...a); }; run.signal.removeEventListener = (...a) => { listeners--; remove(...a); };
for (let i = 1; i <= 20; i++) await dispatch(r, decide(r, c(i, 'web', 'fetch')).call, { issuer, signal: run.signal });
ok(listeners === 0 && invoked === 20, 'abort listeners removed');
console.log(`${n} policy assertions passed`);
