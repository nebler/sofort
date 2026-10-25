// Reviewable host-side sketch; bind a fresh instance to one VM's inherited pipe.
// Transport/kill hooks, VM sandbox, source/result/log channels are separate work.
export class Gate {
  #seen = new Set(); #used = 0; #dead = false;
  constructor(policy, execute) { this.policy = policy; this.execute = execute; }
  async call(frame) {
    if (this.#dead) throw new Error('closed');
    try {
      if (!Buffer.isBuffer(frame) || frame.length > 65536) throw new Error('frame');
      const req = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(frame));
      if (!req || Array.isArray(req) || Object.keys(req).sort().join(',') !== 'args,id,tool') throw new Error('shape');
      if (!Number.isSafeInteger(req.id) || req.id < 0 || this.#seen.has(req.id)) throw new Error('id');
      if (req.tool !== 'inventory.lookup' || !req.args || Array.isArray(req.args) ||
          Object.keys(req.args).join(',') !== 'sku' || typeof req.args.sku !== 'string' ||
          !/^[A-Z0-9-]{1,32}$/.test(req.args.sku)) throw new Error('schema');
      if (++this.#used > 8) throw new Error('budget');
      this.#seen.add(req.id); // Reserve before awaiting; replay cannot race policy.
      if (!await this.policy(req.tool, req.args)) throw new Error('policy');
      if (this.#dead) throw new Error('closed');
      const result = await this.execute(req.tool, req.args); // Host closes over credentials.
      const encoded = Buffer.from(JSON.stringify({ id: req.id, result }));
      if (encoded.length > 65536) throw new Error('result budget');
      return encoded;
    } catch (err) { this.#dead = true; throw err; } // Supervisor kills bound VM.
  }
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const assert = (await import('node:assert/strict')).default;
  const valid = id => Buffer.from(JSON.stringify({ id, tool: 'inventory.lookup', args: { sku: 'ABC-1' } }));
  let sideEffects = 0;
  const make = () => new Gate(async () => true, async () => ({ stock: ++sideEffects }));
  const gate = make();
  assert.equal(JSON.parse(await gate.call(valid(1))).result.stock, 1);
  await assert.rejects(() => gate.call(valid(1)), /id/);
  await assert.rejects(() => gate.call(valid(2)), /closed/);
  for (const bad of [Buffer.alloc(65537), Buffer.from([255]), Buffer.from('null'),
    Buffer.from('{"id":1,"tool":"__proto__","args":{}}'),
    Buffer.from('{"id":1,"tool":"inventory.lookup","args":{"sku":"../../secret"}}')]) {
    await assert.rejects(() => make().call(bad));
  }
  const denied = new Gate(async () => false, async () => { throw new Error('executed denied call'); });
  await assert.rejects(() => denied.call(valid(0)), /policy/);
  const budgeted = make();
  for (let i=0;i<8;i++) await budgeted.call(valid(i));
  await assert.rejects(() => budgeted.call(valid(8)), /budget/);
  assert.equal(sideEffects, 9);
  console.log('PASS: valid request; replay; fail-closed state; oversize; invalid UTF-8; null; unknown tool; path args; policy; budget');
}
