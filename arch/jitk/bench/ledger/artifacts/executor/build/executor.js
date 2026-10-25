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
function sanitizeToolName(name2) {
  if (!name2) return "_";
  let sanitized = name2.replace(/[-.\s]/g, "_");
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
function parse2(text2) {
  return JSON.parse(text2, (_k, v) => {
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
var ProtocolError = class extends Error {
  code;
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
};
function bad(code) {
  throw new ProtocolError(code);
}
var own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
var object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var ident = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
var reserved = new Set("await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield arguments eval then console print setTimeout clearTimeout globalThis".split(" "));
var name = (v) => typeof v === "string" && ident.test(v);
var utf8 = (s) => new TextEncoder().encode(s).length;
var levels = /* @__PURE__ */ new Set(["log", "info", "warn", "error", "debug"]);
function keys(v, required) {
  if (!object(v) || Object.keys(v).length !== required.length || required.some((k) => !own(v, k))) bad("SCHEMA");
}
function text(v, max) {
  if (typeof v !== "string" || v.length > max) bad("SCHEMA");
}
function scalar(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 55296 && c <= 56319) {
      const n = s.charCodeAt(++i);
      if (!(n >= 56320 && n <= 57343)) bad("UNICODE");
    } else if (c >= 56320 && c <= 57343) bad("UNICODE");
  }
}
function parseFrame(s) {
  if (!s.length || s.length > LIMIT.frame) bad("FRAME_LIMIT");
  const stack = [];
  let budget = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 32 || c > 126) bad("ASCII");
    if (c === 34) {
      if (++budget > LIMIT.structure) bad("STRUCTURE");
      const start = i, parent = stack[stack.length - 1];
      for (i++; i < s.length; i++) {
        const b = s.charCodeAt(i);
        if (b < 32 || b > 126) bad("ASCII");
        if (b === 34) break;
        if (b === 92) {
          i++;
          if (i >= s.length) bad("JSON");
          const escaped = s.charCodeAt(i);
          if (escaped < 32 || escaped > 126) bad("ASCII");
        }
      }
      if (i === s.length) bad("JSON");
      if (parent?.object && parent.key) {
        let key;
        try {
          key = JSON.parse(s.slice(start, i + 1));
        } catch {
          return bad("JSON");
        }
        if (parent.seen.has(key)) bad("DUPLICATE");
        parent.seen.add(key);
        parent.key = false;
      }
    } else if (c === 123 || c === 91) {
      if (++budget > LIMIT.structure) bad("STRUCTURE");
      stack.push({ object: c === 123, key: c === 123, seen: /* @__PURE__ */ new Set() });
      if (stack.length > LIMIT.depth) bad("DEPTH");
    } else if (c === 125 || c === 93) {
      if (++budget > LIMIT.structure) bad("STRUCTURE");
      const p = stack.pop();
      if (!p || p.object !== (c === 125)) bad("JSON");
    } else if (c === 44 || c === 58) {
      if (++budget > LIMIT.structure) bad("STRUCTURE");
      const p = stack[stack.length - 1];
      if (c === 44 && p?.object) p.key = true;
    }
  }
  let value;
  try {
    value = JSON.parse(s);
  } catch {
    return bad("JSON");
  }
  if (!object(value)) bad("SCHEMA");
  const walk = (v) => {
    if (typeof v === "number" && (!Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER)) bad("NUMBER");
    if (typeof v === "string") scalar(v);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        scalar(k);
        walk(x);
      }
    }
  };
  walk(value);
  return value;
}
function schema(m, direction) {
  switch (m.t) {
    case "ready":
      keys(m, ["t", "v"]);
      if (direction !== "guest" || m.v !== 1) bad("SCHEMA");
      break;
    case "run": {
      keys(m, ["t", "code", "ns"]);
      if (direction !== "host") bad("SCHEMA");
      text(m.code, LIMIT.code);
      if (utf8(m.code) > LIMIT.code) bad("SCHEMA");
      if (!object(m.ns)) bad("SCHEMA");
      const entries = Object.entries(m.ns);
      if (entries.length > 64) bad("SCHEMA");
      let count = 0;
      for (const [ns, fns] of entries) {
        if (!name(ns) || reserved.has(ns) || !Array.isArray(fns) || fns.length > 256) bad("SCHEMA");
        const seen = /* @__PURE__ */ new Set();
        for (const fn of fns) {
          if (!name(fn) || fn === "then" || seen.has(fn)) bad("SCHEMA");
          seen.add(fn);
          if (++count > 1024) bad("SCHEMA");
        }
      }
      break;
    }
    case "call":
      keys(m, ["t", "id", "ns", "fn", "args"]);
      if (direction !== "guest" || !name(m.ns) || !name(m.fn) || !Array.isArray(m.args)) bad("SCHEMA");
      break;
    case "ret":
      keys(m, own(m, "ok") ? ["t", "id", "ok"] : ["t", "id", "err"]);
      if (direction !== "host") bad("SCHEMA");
      if (own(m, "err")) {
        keys(m.err, ["code", "message"]);
        text(m.err.code, 64);
        text(m.err.message, 4096);
        if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(m.err.code)) bad("SCHEMA");
      }
      break;
    case "log":
      keys(m, ["t", "level", "msg"]);
      text(m.msg, LIMIT.log);
      if (utf8(m.msg) > LIMIT.log) bad("SCHEMA");
      if (direction !== "guest" || typeof m.level !== "string" || !levels.has(m.level)) bad("SCHEMA");
      break;
    case "done":
      keys(m, own(m, "ok") ? ["t", "ok"] : ["t", "err"]);
      if (direction !== "guest") bad("SCHEMA");
      if (own(m, "err")) {
        keys(m.err, ["name", "message"]);
        text(m.err.name, 128);
        text(m.err.message, 4096);
      }
      break;
    default:
      bad("SCHEMA");
  }
  if (m.t === "call" || m.t === "ret") {
    if (typeof m.id !== "number" || !Number.isSafeInteger(m.id) || m.id < 1 || m.id > LIMIT.calls) bad("ID");
  }
}
function encode(m) {
  let s;
  try {
    s = JSON.stringify(m);
  } catch {
    return bad("SERIALIZE");
  }
  if (s === void 0) bad("SERIALIZE");
  s = s.replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  parseFrame(s);
  return new TextEncoder().encode(s + "\n");
}
var Dispatcher = class {
  state = "ready";
  buf = new Uint8Array(1024);
  used = 0;
  inBytes = 0;
  outBytes = 0;
  frames = 0;
  next = 1;
  pending = /* @__PURE__ */ new Map();
  inflight = 0;
  logs = 0;
  logBytes = 0;
  fault;
  hooks;
  constructor(hooks) {
    this.hooks = hooks;
  }
  snapshot() {
    return {
      state: this.state,
      buffered: this.used,
      capacity: this.buf.length,
      outstanding: this.pending.size,
      inflight: this.inflight,
      next: this.next,
      inBytes: this.inBytes,
      outBytes: this.outBytes,
      frames: this.frames,
      logs: this.logs,
      logBytes: this.logBytes
    };
  }
  cancel(code = "CANCELLED") {
    if (this.state === "dead") return;
    this.state = "dead";
    this.used = 0;
    this.buf = new Uint8Array(0);
    this.pending.clear();
    this.inflight = 0;
    this.fault = { code, message: code };
    this.hooks.kill(this.fault);
  }
  fail(e) {
    const code = e instanceof ProtocolError ? e.code : "HOST_ERROR";
    this.cancel(code);
    throw new ProtocolError(this.fault?.code ?? code);
  }
  alive() {
    if (this.state === "dead") bad(this.fault?.code ?? "STATE");
  }
  feed(chunk) {
    try {
      this.alive();
      if (this.inBytes + chunk.length > LIMIT.wire) bad("WIRE_LIMIT");
      this.inBytes += chunk.length;
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk[i];
        if (c === 10) {
          if (++this.frames > LIMIT.frames) bad("FRAME_COUNT");
          const line = new TextDecoder().decode(this.buf.subarray(0, this.used));
          this.used = 0;
          if (line.charCodeAt(0) === 30) {
            if (line.length - 1 > LIMIT.kernel) bad("KERNEL_LIMIT");
            this.hooks.kernel?.(line.slice(1));
            continue;
          }
          const m = parseFrame(line);
          schema(m, "guest");
          this.accept(m, line.length + 1);
          this.hooks.message(m);
          continue;
        }
        if (c < 32 && !(c === 30 && this.used === 0) || c > 126) bad("ASCII");
        const max = this.used && this.buf[0] === 30 ? LIMIT.kernel + 1 : LIMIT.frame;
        if (this.used >= max) bad(this.buf[0] === 30 ? "KERNEL_LIMIT" : "FRAME_LIMIT");
        if (this.used === this.buf.length) {
          const b = new Uint8Array(Math.min(max, this.buf.length * 2));
          b.set(this.buf);
          this.buf = b;
        }
        this.buf[this.used++] = c;
      }
    } catch (e) {
      this.fail(e);
    }
  }
  accept(m, bytes) {
    if (m.t === "ready" && this.state === "ready") {
      this.state = "parked";
      return;
    }
    if (this.state !== "running") bad("STATE");
    if (m.t === "call") {
      if (this.next > LIMIT.calls) bad("CALL_LIMIT");
      if (m.id !== this.next) bad("ID");
      if (this.pending.size >= LIMIT.outstanding) bad("OUTSTANDING");
      if (this.inflight + bytes > LIMIT.inflight) bad("INFLIGHT");
      this.pending.set(m.id, bytes);
      this.next++;
      this.inflight += bytes;
    } else if (m.t === "log") {
      if (this.logs + 1 > LIMIT.logs || this.logBytes + utf8(m.msg) > LIMIT.logBytes) bad("LOG_LIMIT");
      this.logs++;
      this.logBytes += utf8(m.msg);
    } else if (m.t === "done") {
      if (own(m, "ok") && this.pending.size) bad("OUTSTANDING_DONE");
      this.state = "done";
      this.pending.clear();
      this.inflight = 0;
    } else bad("STATE");
  }
  // enqueue is synchronous, bounded, all-or-nothing; false means retry this frame.
  // It must never invoke feed. No state/credit is released until it accepts bytes.
  send(value, enqueue) {
    try {
      this.alive();
      const wire = encode(value);
      const m = parseFrame(new TextDecoder().decode(wire.subarray(0, -1)));
      schema(m, "host");
      if (m.t === "run" ? this.state !== "parked" : this.state !== "running") bad("STATE");
      if (m.t === "ret" && !this.pending.has(m.id)) bad("ID");
      if (this.outBytes + wire.length > LIMIT.wire) bad("WIRE_LIMIT");
      if (!enqueue(wire)) return false;
      this.outBytes += wire.length;
      if (m.t === "run") this.state = "running";
      else {
        this.inflight -= this.pending.get(m.id);
        this.pending.delete(m.id);
      }
      return true;
    } catch (e) {
      return this.fail(e);
    }
  }
  eof() {
    try {
      this.alive();
      if (this.used || this.state !== "done") bad("EOF");
    } catch (e) {
      this.fail(e);
    }
  }
};

// backend.ts
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync as readFileSync2, rmSync } from "node:fs";
var Watchdog = class _Watchdog {
  static shared = /* @__PURE__ */ new Map();
  static for(bin) {
    let w = _Watchdog.shared.get(bin);
    if (!w || w.dead) {
      w = new _Watchdog(bin);
      _Watchdog.shared.set(bin, w);
    }
    return w;
  }
  ready;
  dead;
  proc;
  vms = /* @__PURE__ */ new Map();
  constructor(bin) {
    this.proc = spawn(bin, ["--watchdog"], { stdio: "pipe", env: { PATH: "/usr/bin:/bin" } });
    this.proc.unref();
    for (const p of [this.proc.stdin, this.proc.stdout, this.proc.stderr]) p.unref?.();
    this.proc.stdin.on("error", () => {
    });
    this.proc.stderr.resume();
    this.ready = new Promise((resolve, reject) => {
      let lines = "";
      this.proc.stdout.on("data", (b) => {
        lines += b.toString();
        let pos;
        while ((pos = lines.indexOf("\n")) !== -1) {
          const line = lines.slice(0, pos);
          lines = lines.slice(pos + 1);
          let m;
          try {
            m = JSON.parse(line);
          } catch {
            this.die(Error("invalid watchdog response"));
            return;
          }
          if (m.ready === true) {
            resolve();
            continue;
          }
          const vm = this.vms.get(m.pid);
          if (!vm) continue;
          if (vm.armed && m.armed === vm.armed.deadline) {
            vm.armed.resolve();
            vm.armed = void 0;
          }
          if (m.timeout) {
            this.vms.delete(m.pid);
            vm.timeout(m);
          }
        }
      });
      this.proc.once("error", (e) => {
        reject(e);
        this.die(e);
      });
      this.proc.once("close", () => {
        const e = Error("watchdog exited");
        reject(e);
        this.die(e);
      });
    });
    this.ready.catch(() => {
    });
  }
  die(e) {
    if (this.dead) return;
    this.dead = e;
    try {
      this.proc.kill("SIGKILL");
    } catch {
    }
    for (const vm of this.vms.values()) {
      vm.armed?.reject(e);
      vm.fail(e);
    }
    this.vms.clear();
  }
  write(line, onError) {
    if (this.dead) {
      onError(this.dead);
      return;
    }
    this.proc.stdin.write(line, (e) => {
      if (e) onError(e);
    });
  }
  add(pid, lifetimeMs, timeout, fail) {
    this.vms.set(pid, { timeout, fail });
    this.write(`add ${pid} ${Math.max(1, Math.round(lifetimeMs))}
`, fail);
  }
  arm(pid, deadline) {
    const vm = this.vms.get(pid);
    if (!vm) return Promise.reject(this.dead ?? Error("sandbox exited"));
    return new Promise((resolve, reject) => {
      vm.armed = { deadline, resolve, reject };
      this.write(`arm ${pid} ${deadline}
`, reject);
    });
  }
  del(pid) {
    const vm = this.vms.get(pid);
    if (!vm) return;
    this.vms.delete(pid);
    vm.armed?.reject(Error("sandbox exited"));
    this.write(`del ${pid}
`, () => {
    });
  }
};
function watchdogBinary(options) {
  const bin = options.watchdog ?? process.env.JITK_WATCHDOG ?? process.env.JITK_VMM_BINARY;
  if (!bin) throw Error("watchdog: set ProcessOptions.watchdog, JITK_WATCHDOG or JITK_VMM_BINARY to a jitk-vmm binary");
  return bin;
}
var ProcessBackend = class {
  constructor(kind, command, argv, memoryLimitMB = 32, options = {}) {
    this.kind = kind;
    this.command = command;
    this.argv = argv;
    this.memoryLimitMB = memoryLimitMB;
    this.options = options;
  }
  kind;
  command;
  argv;
  memoryLimitMB;
  options;
  async park(signal, deadline) {
    if (signal?.aborted) throw Error("aborted");
    const child = spawn(this.command, this.argv, {
      stdio: "pipe",
      detached: true,
      cwd: this.options.cwd,
      env: { PATH: "/usr/bin:/bin", ...this.options.env }
    });
    const s = new ProcessSandbox(child, Watchdog.for(watchdogBinary(this.options)), this.options.lifetimeMs ?? 6e4, this.options.requireSandboxAck ?? false, deadline);
    const abort = () => s.kill();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, this.options.startupMs ?? 5e3);
    try {
      const [first] = await Promise.all([s.read(), s.confined, s.watchdogReady]);
      if (first.t !== "ready" || first.v !== 1) throw Error("bad ready");
      if (signal?.aborted) throw Error("aborted");
      return s;
    } catch (e) {
      s.kill();
      await s.exited;
      throw e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
};
var LocalProcessQjsBackend = class extends ProcessBackend {
  constructor(qjs, memoryLimitMB = 32, options = {}) {
    super("local-qjs", qjs, [
      "--memory-limit",
      String(memoryLimitMB * 1048576),
      "--stack-size",
      "524288",
      "--std",
      "-e",
      readFileSync2(new URL("../../protocol/bootstrap.js", import.meta.url), "utf8")
    ], memoryLimitMB, options);
  }
};
var profiles = /* @__PURE__ */ new Map();
var profileDirectory;
function compiledProfile(vmm, image) {
  const key = createHash("sha256").update(readFileSync2(vmm)).update(dirname(image)).digest("hex");
  const cached = profiles.get(key);
  if (cached) return cached;
  if (!profileDirectory) {
    profileDirectory = mkdtempSync(join(tmpdir(), "jitk-executor-profiles-"));
    process.once("exit", () => rmSync(profileDirectory, { recursive: true, force: true }));
  }
  const path = join(profileDirectory, `${key}.sbbin`);
  execFileSync(vmm, ["--compile-profile", path, "--images", dirname(image)], { stdio: "pipe", timeout: 1e4 });
  profiles.set(key, path);
  return path;
}
var JitkBackend = class extends ProcessBackend {
  constructor(vmm, config) {
    const mem = config.memoryLimitMB ?? 32;
    if (mem !== 32 && mem !== 64) throw Error("jitk RAM must be 32 or 64 MiB");
    if (config.launcher === "02-r2" && mem !== 32) throw Error("02 launcher supports only 32 MiB");
    const requireSandboxAck = config.requireSandboxAck ?? config.launcher === "01-vmm";
    const sandboxProfile = config.sandboxProfile ?? (requireSandboxAck && process.platform === "darwin" ? compiledProfile(vmm, config.image) : void 0);
    config = { ...config, requireSandboxAck, sandboxProfile };
    if (config.launcher === "01-vmm") config.watchdog ??= vmm;
    super("jitk", vmm, config.launcher === "01-vmm" ? ["--image", config.image, "--mem-mib", String(mem), ...sandboxProfile ? ["--sandbox-profile", sandboxProfile] : []] : [config.image], mem, config);
  }
};
var ProcessSandbox = class {
  constructor(child, watchdog, lifetimeMs, requireSandboxAck, deadline) {
    this.child = child;
    this.watchdog = watchdog;
    this.deadline = deadline;
    let acknowledge = () => {
    };
    this.confined = requireSandboxAck ? new Promise((resolve, reject) => {
      acknowledge = resolve;
      this.rejectConfined = reject;
    }) : Promise.resolve();
    this.dispatcher = new Dispatcher({
      kill: (f) => {
        this.fail(Error("protocol " + f.code));
        this.kill();
      },
      message: (m) => {
        const w = this.waiters.shift();
        if (w) w.resolve(m);
        else {
          const bytes = JSON.stringify(m).length;
          if (this.queue.length >= LIMIT.frames || this.queueBytes + bytes > LIMIT.wire) throw Error("receive queue limit");
          this.queue.push(m);
          this.queueBytes += bytes;
        }
      }
    });
    const closed = new Promise((resolve) => child.once("close", () => {
      this.fail(Error("sandbox exited"), true);
      resolve();
    }));
    child.once("error", (e) => {
      this.fail(e);
      this.kill();
    });
    child.stdout.on("data", (b) => {
      try {
        this.dispatcher.feed(b);
      } catch {
      }
    });
    child.stdout.once("end", () => {
      try {
        this.dispatcher.eof();
      } catch {
      }
    });
    child.stdin.on("error", () => {
    });
    let stderr = 0;
    let hostLines = "";
    child.stderr.on("data", (b) => {
      stderr += b.length;
      if (stderr > 65536) {
        this.fail(Error("stderr limit"));
        this.kill();
        return;
      }
      hostLines += b.toString("utf8");
      let pos;
      while ((pos = hostLines.indexOf("\n")) !== -1) {
        const line = hostLines.slice(0, pos);
        hostLines = hostLines.slice(pos + 1);
        if (line === '{"sandbox":"ok"}') acknowledge();
      }
    });
    this.watchdogReady = Promise.resolve();
    if (child.pid) {
      const pid = child.pid;
      this.watchdogReady = watchdog.ready.then(() => {
        watchdog.add(pid, lifetimeMs, (m) => {
          this.deadlineReceipt = m;
          this.fail(Error("Execution timed out"));
        }, (e) => {
          this.fail(e);
          this.kill();
        });
        if (deadline !== void 0) return watchdog.arm(pid, deadline);
      });
      this.watchdogReady.catch((e) => {
        this.fail(e);
        this.kill();
      });
      void closed.then(() => watchdog.del(pid));
    }
    this.exited = closed;
  }
  child;
  watchdog;
  exited;
  confined;
  watchdogReady;
  deadlineReceipt;
  deadline;
  rejectConfined;
  queue = [];
  queueBytes = 0;
  waiters = [];
  error;
  fatalError = false;
  output = Promise.resolve();
  writes = 0;
  dispatcher;
  async armDeadline(deadline) {
    if (!Number.isFinite(deadline)) throw Error("invalid deadline");
    await this.watchdogReady;
    if (this.error) throw this.error;
    if (Date.now() >= deadline) throw Error("Execution timed out");
    if (this.deadline === deadline) return;
    if (this.deadline !== void 0) throw Error("deadline already armed");
    this.deadline = deadline;
    await this.watchdog.arm(this.child.pid, deadline);
    if (Date.now() >= deadline) throw Error("Execution timed out");
  }
  fail(e, drain = false) {
    if (this.error) return;
    this.error = e;
    this.fatalError = !drain;
    this.rejectConfined?.(e);
    if (!drain) {
      this.queue = [];
      this.queueBytes = 0;
    }
    for (const w of this.waiters.splice(0)) w.reject(e);
  }
  read() {
    let p;
    if (this.queue.length) {
      const m = this.queue.shift();
      this.queueBytes -= JSON.stringify(m).length;
      p = Promise.resolve(m);
    } else if (this.error) p = Promise.reject(this.error);
    else p = new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
    return p.then((m) => {
      if (this.fatalError) throw this.error;
      return m;
    });
  }
  send(frame) {
    if (++this.writes > 65) {
      this.writes--;
      this.kill();
      return Promise.reject(Error("writer producer limit"));
    }
    const p = this.output.then(async () => {
      if (frame && typeof frame === "object" && frame.t === "ret" && this.dispatcher.snapshot().state === "done") return;
      if (this.error) throw this.error;
      let wire;
      this.dispatcher.send(frame, (bytes) => {
        wire = bytes;
        return true;
      });
      await new Promise((resolve, reject) => this.child.stdin.write(wire, (e) => e ? reject(e) : resolve()));
    });
    this.output = p.catch((e) => {
      this.fail(e);
      this.kill();
    });
    return p.finally(() => {
      this.writes--;
    });
  }
  kill() {
    try {
      if (this.child.pid) process.kill(-this.child.pid, "SIGKILL");
    } catch {
    }
  }
};

// pool.ts
function recommendedWarmCount(lambda, refillP99Seconds, burst, cap) {
  if ([lambda, refillP99Seconds, burst, cap].some((x) => !Number.isFinite(x) || x < 0)) throw Error("invalid sizing inputs");
  return Math.min(Math.ceil(lambda * refillP99Seconds) + Math.ceil(burst), Math.floor(cap));
}
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
    let s;
    try {
      s = await p;
    } catch (e) {
      this.tokens--;
      throw e;
    } finally {
      this.creating--;
      this.startups.delete(p);
    }
    this.live.add(s);
    void s.exited.then(() => {
      this.live.delete(s);
      this.parked = this.parked.filter((x) => x !== s);
      this.tokens--;
    });
    if (this.closed) {
      s.kill();
      await s.exited;
      throw Error("pool closed");
    }
    return s;
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
          const s = await this.start();
          if (!this.closed && this.live.has(s)) this.parked.push(s);
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
    const prepare = async (s) => {
      if (deadline !== void 0) try {
        await s.armDeadline?.(deadline);
      } catch (e) {
        s.kill();
        await s.exited;
        throw e;
      }
      return s;
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
      const s = this.parked.pop();
      if (s) return prepare(s);
    }
    return this.start(signal, deadline);
  }
  retire(s, beforeKill = () => {
  }) {
    const task = new Promise((resolve) => setImmediate(() => {
      beforeKill();
      void this.release(s).catch(() => {
      }).finally(resolve);
    }));
    this.disposals.add(task);
    void task.finally(() => this.disposals.delete(task));
  }
  async drain() {
    await Promise.all([...this.disposals]);
  }
  async release(s) {
    if (!this.live.has(s)) return;
    try {
      this.options.onEvent?.("kill", s, performance.now());
    } catch {
    }
    s.kill();
    await s.exited;
    try {
      this.options.onEvent?.("reaped", s, performance.now());
    } catch {
    }
    if (!this.closed) void this.warm().catch(() => {
    });
  }
  async close() {
    this.closed = true;
    this.lifecycle.abort();
    for (const s of this.live) s.kill();
    await Promise.allSettled([...this.startups]);
    await this.warming?.catch(() => {
    });
    await Promise.all([...this.live].map((s) => s.exited));
    await this.drain();
  }
};

// ../bench/hyperlight/backend.ts
var HyperlightBackend = class {
  constructor(worker, snapshot, watchdogMs = 5e3) {
    this.worker = worker;
    this.snapshot = snapshot;
    this.watchdogMs = watchdogMs;
  }
  worker;
  snapshot;
  watchdogMs;
  kind = "hyperlight-js";
  isolation = "strict-single-use";
  memoryLimitMB = 16;
  async park(signal) {
    if (signal?.aborted) throw Error("aborted");
    const { ProcessBackend: ProcessBackend2 } = await import(new URL("../../executor/build/backend.js", import.meta.url).href);
    return new ProcessBackend2(
      this.kind,
      this.worker,
      ["strict", this.snapshot],
      this.memoryLimitMB,
      { lifetimeMs: this.watchdogMs, startupMs: this.watchdogMs }
    ).park(signal);
  }
};

// executor.ts
var MicroVMExecutor = class {
  constructor(pool, policy, timeout = 3e4, security = {}) {
    this.pool = pool;
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
        for (const [name2, fn] of Object.entries(p.fns)) {
          const nsTools = this.security.tools && Object.hasOwn(this.security.tools, p.name) ? this.security.tools[p.name] : void 0;
          const declared = nsTools && Object.hasOwn(nsTools, name2) ? nsTools[name2] : void 0;
          if (this.security.tools && !declared) throw Error("missing tool effects: " + p.name + "." + name2);
          tools[p.name][name2] = declared ?? {
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
      const s = sandbox;
      kill = () => s.kill();
      ctx.signal.addEventListener("abort", kill, { once: true });
      if (expired()) abort();
      if (ctx.signal.aborted) throw new Error("aborted");
      await s.armDeadline?.(deadline);
      const body = executionBody(code, providers);
      if (body.length > LIMIT.code) throw Error("code limit including trusted adapters");
      await s.send({ t: "run", code: body, ns: Object.fromEntries(providers.map((p) => [p.name, Object.keys(p.fns)])) });
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
            await s.send({ t: "ret", id: call.id, ok: JSON.parse(stringify(ok === void 0 ? null : ok)) });
            if (firstRet) {
              firstRet = false;
              mark("firstRet");
            }
          }
        } catch (e) {
          if (e instanceof rules.Violation) {
            run.dead = true;
            s.kill();
            return;
          }
          if (live && !ctx.signal.aborted) await s.send({ t: "ret", id: call.id, err: { code: String(e).includes("policy denied") || String(e).includes("approval required") ? "DENIED" : "TOOL_ERROR", message: String(e).slice(0, 4096) } }).catch(() => s.kill());
        }
      };
      while (true) {
        const m = await s.read();
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
    const fns = Object.fromEntries(Object.entries(config.bindings).map(([key, b]) => [key, async (...args) => b.execute(args[0])]));
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
export {
  HyperlightBackend,
  JitkBackend,
  LocalProcessQjsBackend,
  MicroVMExecutor,
  ProcessBackend,
  SandboxPool,
  recommendedWarmCount
};
//# sourceMappingURL=executor.js.map
