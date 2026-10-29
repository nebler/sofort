// Demo host tool provider. A provider module default-exports {namespace: {fn: Tool}}
// in the canonical policy format (executor/policy/README.md): a strict args
// validator, declared effects, a host-only invoke and an output validator.
// `signature`/`description` only feed the MCP tool description shown to clients.
const store = new Map(); // in-memory, per server process, shared by every client
const MAX_KEYS = 1024, MAX_BYTES = 16 << 20, sizes = new Map(); let bytes = 0;
// JSON size of a stored value; binary values are not JSON (and JSON.stringify would size an ArrayBuffer as '{}').
const jsonBytes = v => JSON.stringify(v, (_k, x) => { if (x instanceof ArrayBuffer || ArrayBuffer.isView(x)) throw Error('schema'); return x; }).length;
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
      signature: 'set(key: string, value: JSON): true', description: 'Write a JSON value (<= 64 KiB; store <= 1024 keys, 16 MiB) to the in-memory store.',
      args: a => { const [k, v] = arity(2)(a); str(k, 256); if (jsonBytes(v ?? null) > 65536) throw Error('schema'); return [k, v ?? null]; },
      invoke: async ([k, v]) => {
        const size = k.length + jsonBytes(v), total = bytes - (sizes.get(k) ?? 0) + size;
        if ((!store.has(k) && store.size >= MAX_KEYS) || total > MAX_BYTES) throw Error(`kv store full (${MAX_KEYS} keys, ${MAX_BYTES} bytes)`);
        store.set(k, v); sizes.set(k, size); bytes = total; return true;
      },
      error: e => String(e?.message).startsWith('kv store full') ? e.message : 'kv.set failed'},
  },
};
