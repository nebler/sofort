// Demo host tool provider. A provider module default-exports {namespace: {fn: Tool}}
// in the canonical policy format (executor/policy/README.md): a strict args
// validator, declared effects, a host-only invoke and an output validator.
// `signature`/`description` only feed the MCP tool description shown to clients.
const store = new Map(); // in-memory, per server process
const str = (v, max) => { if (typeof v !== 'string' || v.length > max) throw Error('schema'); return v; };
const num = v => { if (typeof v !== 'number' || !Number.isFinite(v)) throw Error('schema'); return v; };
const arity = n => a => { if (!Array.isArray(a) || a.length !== n) throw Error('schema'); return a; };
const same = v => v;
const pure = {reads: 'none', egress: false, writes: false, timeoutMs: 1000, output: same};

export default {
  math: {
    add: {...pure, signature: 'add(a: number, b: number): number', description: 'Sum of two finite numbers.',
      args: a => arity(2)(a).map(num), invoke: async ([a, b]) => a + b},
  },
  kv: {
    // Stored values may come from earlier runs: reads are private, so a later
    // kv.set in the same run needs approval (07 integrity rule; no approver => denied).
    get: {reads: 'private', egress: false, writes: false, timeoutMs: 1000, output: same,
      signature: 'get(key: string): unknown | null', description: 'Read a value from the in-memory store.',
      args: a => [str(arity(1)(a)[0], 256)], invoke: async ([k]) => store.has(k) ? structuredClone(store.get(k)) : null},
    set: {reads: 'none', egress: false, writes: true, timeoutMs: 1000, output: same,
      signature: 'set(key: string, value: JSON): true', description: 'Write a JSON value (<= 64 KiB) to the in-memory store.',
      args: a => { const [k, v] = arity(2)(a); str(k, 256); if (JSON.stringify(v ?? null).length > 65536) throw Error('schema'); return [k, v ?? null]; },
      invoke: async ([k, v]) => { store.set(k, v); return true; }},
  },
};
