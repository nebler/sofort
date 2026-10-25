// resolve-check.ts
import assert from "node:assert/strict";

// vendor/codemode.mjs
import * as acorn from "acorn";
function stripCodeFences(code) {
  const match = code.match(/^```(?:js|javascript|typescript|ts|tsx|jsx)?\s*\n([\s\S]*?)```\s*$/);
  return match ? match[1] : code;
}
function normalizeCode(code) {
  const trimmed = stripCodeFences(code.trim());
  if (!trimmed.trim()) return "async () => {}";
  const source = trimmed.trim();
  try {
    const ast = acorn.parse(source, {
      ecmaVersion: "latest",
      sourceType: "module"
    });
    if (ast.body.length === 1 && ast.body[0].type === "ExpressionStatement") {
      if (ast.body[0].expression.type === "ArrowFunctionExpression") return source;
    }
    if (ast.body.length === 1 && ast.body[0].type === "ExportDefaultDeclaration") {
      const decl = ast.body[0].declaration;
      const inner = source.slice(decl.start, decl.end);
      if (decl.type === "FunctionDeclaration" && !decl.id) return `async () => {
return (${inner})();
}`;
      if (decl.type === "ClassDeclaration" && !decl.id) return `async () => {
return (${inner});
}`;
      return normalizeCode(inner);
    }
    if (ast.body.length === 1 && ast.body[0].type === "FunctionDeclaration") return `async () => {
${source}
return ${ast.body[0].id?.name ?? "fn"}();
}`;
    const last = ast.body[ast.body.length - 1];
    if (last?.type === "ExpressionStatement") {
      const exprStmt = last;
      return `async () => {
${source.slice(0, last.start)}return (${source.slice(exprStmt.expression.start, exprStmt.expression.end)})
}`;
    }
    return `async () => {
${source}
}`;
  } catch {
    return `async () => {
${source}
}`;
  }
}
var JS_RESERVED = /* @__PURE__ */ new Set([
  "abstract",
  "arguments",
  "await",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "double",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "final",
  "finally",
  "float",
  "for",
  "function",
  "goto",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "int",
  "interface",
  "let",
  "long",
  "native",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "volatile",
  "while",
  "with",
  "yield"
]);
function sanitizeToolName(name) {
  if (!name) return "_";
  let sanitized = name.replace(/[-.\s]/g, "_");
  sanitized = sanitized.replace(/[^a-zA-Z0-9_$]/g, "");
  if (!sanitized) return "_";
  if (/^[0-9]/.test(sanitized)) sanitized = "_" + sanitized;
  if (JS_RESERVED.has(sanitized)) sanitized = sanitized + "_";
  return sanitized;
}

// upstream.ts
var normalizeCode2 = normalizeCode;
var sanitizeToolName2 = sanitizeToolName;

// codec.mjs
var tag = "__codemode_binary_v1__";
function stringify(value) {
  return JSON.stringify(value, (_k, v) => {
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
      const bytes = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return { [tag]: v instanceof ArrayBuffer ? "ArrayBuffer" : v instanceof Uint8Array ? "Uint8Array" : "ArrayBufferView", data: btoa(binary) };
    }
    return v;
  });
}
function parse2(text) {
  return JSON.parse(text, (_k, v) => {
    if (v && typeof v === "object" && tag in v && typeof v.data === "string") {
      const binary = atob(v.data), bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return v[tag] === "ArrayBuffer" ? bytes.buffer : bytes;
    }
    return v;
  });
}

// code.ts
import { readFileSync } from "node:fs";
var codec = readFileSync(new URL("./codec.mjs", import.meta.url), "utf8").replaceAll("export function ", "function ");
function executionBody(code, providers) {
  const declarations = providers.map((p) => {
    const key = JSON.stringify(p.name), allowed = JSON.stringify(Object.keys(p.fns));
    return `const ${p.name}=new Proxy(Object.create(null),{get:(t,k)=>Object.hasOwn(t,k)?t[k]:k!=='then'&&${allowed}.includes(k)?async(...a)=>parse(JSON.stringify(await __wire[${key}][k](...JSON.parse(stringify(a))))):undefined});`;
  }).join("\n");
  return `return await (async (__wire)=>{
${codec}
installBase64();
${declarations}
${providers.map((p) => p.prelude ?? "").join("\n")}
const result=await (${normalizeCode2(code)})();
return JSON.parse(stringify(result===undefined?null:result));
})({${providers.map((p) => p.name).join(",")}});`;
}

// policy-adapter.ts
import { fileURLToPath } from "node:url";
var canonical = new URL("../policy/policy.mjs", import.meta.url);
var policySource = fileURLToPath(canonical);
var rules = await import(policySource);
var noCredentials = { issue: async () => void 0, revoke: async () => {
} };

// executor.ts
import { performance as performance2 } from "node:perf_hooks";

// ../protocol/dispatcher.ts
var LIMIT = Object.freeze({
  frame: 1048576,
  depth: 32,
  structure: 32768,
  code: 65536,
  outstanding: 64,
  calls: 4096,
  inflight: 2097152,
  wire: 16777216,
  frames: 8192,
  log: 4096,
  logs: 1024,
  logBytes: 262144,
  kernel: 4096
});
var reserved = new Set("await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield arguments eval then console print setTimeout clearTimeout globalThis".split(" "));

// pool.ts
var SandboxPool = class {
  constructor(backend, warmCount, maxLive, options = {}) {
    this.backend = backend;
    this.warmCount = warmCount;
    this.maxLive = maxLive;
    this.options = options;
    if (!Number.isInteger(warmCount) || !Number.isInteger(maxLive) || warmCount < 0 || maxLive < 1 || warmCount > maxLive) throw Error("invalid pool size");
    this.refillConcurrency = options.refillConcurrency ?? 2;
    if (!Number.isInteger(this.refillConcurrency) || this.refillConcurrency < 1) throw Error("invalid refill concurrency");
    const gate = options.parkingGate;
    if (warmCount && (!gate || !Number.isFinite(gate.idleCorePercent) || gate.idleCorePercent < 0 || gate.idleCorePercent >= 2 || !gate.evidence)) throw Error("parking G1 evidence below 2% required");
  }
  backend;
  warmCount;
  maxLive;
  options;
  parked = [];
  live = /* @__PURE__ */ new Set();
  tokens = 0;
  creating = 0;
  acquiring = 0;
  maxTokens = 0;
  maxCreating = 0;
  closed = false;
  lifecycle = new AbortController();
  disposals = /* @__PURE__ */ new Set();
  startups = /* @__PURE__ */ new Set();
  warming;
  refillConcurrency;
  snapshot() {
    return { tokens: this.tokens, creating: this.creating, parked: this.parked.length, live: this.live.size, maxTokens: this.maxTokens, maxCreating: this.maxCreating, closed: this.closed };
  }
  async start(signal, deadline) {
    if (this.closed || this.tokens >= this.maxLive || this.creating >= this.refillConcurrency) throw Error("pool saturated");
    this.tokens++;
    this.creating++;
    this.maxTokens = Math.max(this.tokens, this.maxTokens);
    this.maxCreating = Math.max(this.creating, this.maxCreating);
    const p = Promise.resolve().then(() => this.backend.park(signal ? AbortSignal.any([signal, this.lifecycle.signal]) : this.lifecycle.signal, deadline));
    this.startups.add(p);
    let s2;
    try {
      s2 = await p;
    } catch (e) {
      this.tokens--;
      throw e;
    } finally {
      this.creating--;
      this.startups.delete(p);
    }
    this.live.add(s2);
    void s2.exited.then(() => {
      this.live.delete(s2);
      this.parked = this.parked.filter((x) => x !== s2);
      this.tokens--;
    });
    if (this.closed) {
      s2.kill();
      await s2.exited;
      throw Error("pool closed");
    }
    return s2;
  }
  warm() {
    if (this.warming) return this.warming;
    const fill = async () => {
      while (!this.closed) {
        const n = Math.min(
          this.warmCount - this.parked.length - this.creating,
          this.maxLive - this.tokens,
          this.refillConcurrency - this.creating
        );
        if (n <= 0) return;
        const results = await Promise.allSettled(Array.from({ length: n }, async () => {
          const s2 = await this.start();
          if (!this.closed && this.live.has(s2)) this.parked.push(s2);
        }));
        const failed = results.find((r) => r.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
      }
    };
    this.warming = fill().finally(() => {
      this.warming = void 0;
    });
    return this.warming;
  }
  async acquire(signal, deadline) {
    if (this.closed || signal?.aborted) throw Error("pool closed/aborted");
    const prepare = async (s2) => {
      if (deadline !== void 0) try {
        await s2.armDeadline?.(deadline);
      } catch (e) {
        s2.kill();
        await s2.exited;
        throw e;
      }
      return s2;
    };
    const ready = this.parked.pop();
    if (ready) return prepare(ready);
    if (this.warming && this.creating) {
      if (this.acquiring >= this.maxLive) throw Error("pool saturated");
      this.acquiring++;
      const combined = signal ? AbortSignal.any([signal, this.lifecycle.signal]) : this.lifecycle.signal;
      let abort;
      try {
        await Promise.race([this.warming, new Promise((_, reject) => {
          abort = () => reject(Error("pool closed/aborted"));
          combined.addEventListener("abort", abort, { once: true });
          if (combined.aborted) abort();
        })]);
      } finally {
        this.acquiring--;
        combined.removeEventListener("abort", abort);
      }
      if (this.closed || signal?.aborted) throw Error("pool closed/aborted");
      const s2 = this.parked.pop();
      if (s2) return prepare(s2);
    }
    return this.start(signal, deadline);
  }
  retire(s2, beforeKill = () => {
  }) {
    const task = new Promise((resolve) => setImmediate(() => {
      beforeKill();
      void this.release(s2).catch(() => {
      }).finally(resolve);
    }));
    this.disposals.add(task);
    void task.finally(() => this.disposals.delete(task));
  }
  async drain() {
    await Promise.all([...this.disposals]);
  }
  async release(s2) {
    if (!this.live.has(s2)) return;
    try {
      this.options.onEvent?.("kill", s2, performance.now());
    } catch {
    }
    s2.kill();
    await s2.exited;
    try {
      this.options.onEvent?.("reaped", s2, performance.now());
    } catch {
    }
    if (!this.closed) void this.warm().catch(() => {
    });
  }
  async close() {
    this.closed = true;
    this.lifecycle.abort();
    for (const s2 of this.live) s2.kill();
    await Promise.allSettled([...this.startups]);
    await this.warming?.catch(() => {
    });
    await Promise.all([...this.live].map((s2) => s2.exited));
    await this.drain();
  }
};

// executor.ts
var MicroVMExecutor = class {
  constructor(pool2, policy, timeout = 3e4, security = {}) {
    this.pool = pool2;
    this.policy = policy;
    this.timeout = timeout;
    this.security = security;
  }
  pool;
  policy;
  timeout;
  security;
  async execute(code, providersOrFns, options = {}) {
    const mark = (event) => {
      try {
        options.onTiming?.(event, performance2.now());
      } catch {
      }
    };
    mark("start");
    const controller = new AbortController(), logs = [];
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const timeout = options.timeout ?? this.timeout;
    const deadline = Date.now() + timeout;
    const expired = () => Date.now() >= deadline;
    const timer = setTimeout(abort, timeout);
    const labels = new Set(options.provenance ?? ["model"]);
    const baseContext = { executionId: crypto.randomUUID(), signal: controller.signal };
    const getContext = () => Object.freeze({ ...baseContext, provenance: Object.freeze([...labels]) });
    const ctx = getContext();
    let sandbox;
    let kill;
    let live = true;
    let run;
    let firstCall = true, firstRet = true;
    try {
      if (code.length > LIMIT.code) throw new Error("code limit");
      if (options.connectors?.length) throw new Error("connector RPC unsupported: adapt to ResolvedProvider");
      const source = Array.isArray(providersOrFns) ? providersOrFns : [{ name: "codemode", fns: providersOrFns }];
      const providers = source.map((p) => {
        const fns = /* @__PURE__ */ Object.create(null);
        for (const [key, fn] of Object.entries(p.fns)) {
          const safe = sanitizeToolName2(key);
          if (Object.hasOwn(fns, safe)) throw new Error("sanitized tool collision");
          fns[safe] = fn;
        }
        return { ...p, fns };
      });
      const seen = /* @__PURE__ */ new Set();
      for (const p of providers) {
        if (!/^[A-Za-z_$][\w$]*$/.test(p.name) || ["console", "__rpc", "__bindings", "Promise", "Object", "globalThis", "setTimeout", "undefined"].includes(p.name) || seen.has(p.name)) throw new Error("invalid/duplicate namespace");
        seen.add(p.name);
      }
      const tools = /* @__PURE__ */ Object.create(null);
      for (const p of providers) {
        tools[p.name] = /* @__PURE__ */ Object.create(null);
        for (const [name, fn] of Object.entries(p.fns)) {
          const nsTools = this.security.tools && Object.hasOwn(this.security.tools, p.name) ? this.security.tools[p.name] : void 0;
          const declared = nsTools && Object.hasOwn(nsTools, name) ? nsTools[name] : void 0;
          if (this.security.tools && !declared) throw Error("missing tool effects: " + p.name + "." + name);
          tools[p.name][name] = declared ?? {
            args: (a) => a,
            reads: "public",
            egress: false,
            writes: false,
            timeoutMs: options.timeout ?? this.timeout,
            invoke: async (a, _credential, context) => fn.apply(Object.freeze({ signal: context.signal }), a),
            output: (v) => v
          };
        }
      }
      run = rules.createRun({ tools, deadline, limits: this.security.limits });
      sandbox = await this.pool.acquire(ctx.signal, deadline);
      mark("acquired");
      const s2 = sandbox;
      kill = () => s2.kill();
      ctx.signal.addEventListener("abort", kill, { once: true });
      if (expired()) abort();
      if (ctx.signal.aborted) throw new Error("aborted");
      await s2.armDeadline?.(deadline);
      const body = executionBody(code, providers);
      if (body.length > LIMIT.code) throw Error("code limit including trusted adapters");
      await s2.send({ t: "run", code: body, ns: Object.fromEntries(providers.map((p) => [p.name, Object.keys(p.fns)])) });
      mark("runSent");
      let nextId = 1;
      const pending = /* @__PURE__ */ new Set();
      const dispatch = async (call) => {
        try {
          const decision = rules.decide(run, { t: "call", id: call.id, ns: call.ns, fn: call.fn, args: parse2(JSON.stringify(call.args)) });
          if (decision.kind === "deny") throw Error("policy denied: " + decision.reason);
          const frozen = deepFreeze({ ...call, args: structuredClone(decision.call.args) });
          const callContext = getContext();
          const d = await this.policy(frozen, callContext);
          if (d !== "allow" && d !== "requireApproval") throw new Error("policy denied");
          if (decision.kind === "approve" || d === "requireApproval") {
            if (!await options.approve?.(frozen, callContext)) throw Error("approval required");
            if (decision.kind === "approve" && !rules.approve(run, decision.digest)) throw new rules.Violation("approval digest");
          }
          if (expired()) abort();
          if (!live || ctx.signal.aborted) throw new Error("execution ended");
          const ok = await rules.dispatch(run, decision.call, { issuer: this.security.issuer ?? noCredentials, signal: ctx.signal });
          if (run.tainted.untrusted) labels.add("tool-untrusted");
          if (expired()) abort();
          if (live && !ctx.signal.aborted) {
            await s2.send({ t: "ret", id: call.id, ok: JSON.parse(stringify(ok === void 0 ? null : ok)) });
            if (firstRet) {
              firstRet = false;
              mark("firstRet");
            }
          }
        } catch (e) {
          if (e instanceof rules.Violation) {
            run.dead = true;
            s2.kill();
            return;
          }
          if (live && !ctx.signal.aborted) await s2.send({ t: "ret", id: call.id, err: { code: String(e).includes("policy denied") || String(e).includes("approval required") ? "DENIED" : "TOOL_ERROR", message: String(e).slice(0, 4096) } }).catch(() => s2.kill());
        }
      };
      while (true) {
        const m = await s2.read();
        if (expired()) abort();
        if (ctx.signal.aborted) throw new Error("aborted");
        if (!m || typeof m !== "object" || Array.isArray(m)) throw new Error("invalid frame");
        if (m.t === "log") {
          logs.push(m.level === "log" ? m.msg : `[${m.level}] ${m.msg}`);
        } else if (m.t === "call") {
          if (firstCall) {
            firstCall = false;
            mark("firstCall");
          }
          if (m.id !== nextId++) throw Error("invalid/budgeted call");
          const p = dispatch(m);
          pending.add(p);
          void p.then(() => pending.delete(p), () => pending.delete(p));
        } else if (m.t === "done") {
          mark("done");
          if (Object.hasOwn(m, "err")) throw Error(`${m.err.name}: ${m.err.message}`);
          return { result: parse2(JSON.stringify(m.ok)), logs };
        } else throw new Error("unknown frame");
      }
    } catch (e) {
      if (expired()) abort();
      return { result: void 0, error: ctx.signal.aborted ? "Execution aborted or timed out" : String(e), logs };
    } finally {
      live = false;
      if (run) {
        run.dead = true;
        run.approvals.clear();
      }
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (kill) ctx.signal.removeEventListener("abort", kill);
      if (sandbox) this.pool.retire(sandbox, () => controller.abort());
      else controller.abort();
      mark("resolve");
    }
  }
  async createContext(config) {
    if (config.memoryLimit !== void 0 && config.memoryLimit !== this.pool.backend.memoryLimitMB) throw new Error("memory limit requires a matching backend pool");
    const lifetime = new AbortController();
    let running = false;
    let active;
    const fns = Object.fromEntries(Object.entries(config.bindings).map(([key, b2]) => [key, async (...args) => b2.execute(args[0])]));
    const aliases = Object.keys(fns);
    for (const key of aliases) if (!/^[A-Za-z_$][\w$]*$/.test(key)) throw new Error("invalid binding");
    const prelude = aliases.map((key) => `const ${key}=(...a)=>__bindings[${JSON.stringify(key)}](...a);`).join("\n");
    return {
      execute: async (code) => {
        if (lifetime.signal.aborted || running) return { success: false, error: { name: "Error", message: "context disposed/busy" } };
        running = true;
        try {
          active = this.execute(`async()=>{${code}
}`, [{ name: "bindings", fns, prelude: prelude.replaceAll("__bindings[", "bindings[") }], { signal: lifetime.signal, timeout: config.timeout });
          const r = await active;
          if (r.error) return { success: false, error: { name: "Error", message: r.error }, logs: r.logs };
          return { success: true, value: r.result, logs: r.logs };
        } catch (e) {
          return { success: false, error: { name: "Error", message: String(e) } };
        } finally {
          running = false;
        }
      },
      dispose: async () => {
        lifetime.abort();
        await active;
      }
    };
  }
};
function deepFreeze(v) {
  if (v && typeof v === "object" && !ArrayBuffer.isView(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) deepFreeze(x);
  }
  return v;
}

// resolve-check.ts
var vmmReap;
var watchdogReap;
var kills = 0;
var vmm = new Promise((r) => vmmReap = r);
var watchdog = new Promise((r) => watchdogReap = r);
var s = { exited: Promise.all([vmm, watchdog]).then(() => {
}), read: async () => ({ t: "done", ok: 2 }), send: async () => {
}, kill: () => {
  kills++;
} };
var b = { kind: "jitk", memoryLimitMB: 32, park: async () => s };
var pool = new SandboxPool(b, 0, 1);
var ex = new MicroVMExecutor(pool, () => "allow");
var result = await ex.execute("return 2", []);
assert.equal(result.result, 2);
assert.equal(kills, 0, "execute resolved before even SIGKILL");
assert.equal(pool.snapshot().tokens, 1);
await assert.rejects(() => pool.acquire(), /saturated/);
await new Promise((r) => setImmediate(r));
assert.equal(kills, 1);
vmmReap();
await new Promise((r) => setImmediate(r));
assert.equal(pool.snapshot().tokens, 1, "watchdog still owns capacity");
watchdogReap();
await new Promise((r) => setImmediate(r));
assert.equal(pool.snapshot().tokens, 0);
await pool.close();
console.log("PASS resolve before kill/reap; VMM AND watchdog hold token");
//# sourceMappingURL=resolve-check.js.map
