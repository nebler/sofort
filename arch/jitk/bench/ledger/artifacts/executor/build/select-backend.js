// select-backend.ts
import { existsSync, readFileSync as readFileSync2, writeFileSync } from "node:fs";
import { createHash as createHash2 } from "node:crypto";
import { fileURLToPath } from "node:url";

// backend.ts
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";

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
      readFileSync(new URL("../../protocol/bootstrap.js", import.meta.url), "utf8")
    ], memoryLimitMB, options);
  }
};
var profiles = /* @__PURE__ */ new Map();
var profileDirectory;
function compiledProfile(vmm, image) {
  const key = createHash("sha256").update(readFileSync(vmm)).update(dirname(image)).digest("hex");
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

// select-backend.ts
var here = fileURLToPath(new URL("../", import.meta.url));
var jitk = fileURLToPath(new URL("../../", import.meta.url));
function artifact(path) {
  if (!existsSync(path)) throw Error("missing artifact " + path);
  return { path, sha256: createHash2("sha256").update(readFileSync2(path)).digest("hex") };
}
function marker(dir) {
  try {
    return JSON.parse(readFileSync2(dir + ".READY", "utf8"));
  } catch {
    return {};
  }
}
function artifactPath(dir, keys2, defaults, env) {
  if (process.env[env]) return process.env[env];
  for (const path of defaults) if (existsSync(dir + path)) return dir + path;
  const data = marker(dir);
  for (const key of keys2) if (typeof data[key] === "string" && !data[key].startsWith("/") && existsSync(dir + data[key])) return dir + data[key];
  throw Error(`missing built artifact in ${dir}; build that subtree or set ${env} to its absolute path`);
}
function selectBackend() {
  const selected = process.env.JITK_BACKEND ?? "jitk";
  if (selected === "local-qjs") {
    if (!process.env.QJS) throw Error("UNSAFE local-qjs requires QJS=/absolute/path/to/qjs");
    return { backend: new LocalProcessQjsBackend(process.env.QJS), selection: "UNSAFE local-qjs", integrated: false };
  }
  if (selected !== "jitk") throw Error("unsupported JITK_BACKEND: " + selected);
  const vmmReady = existsSync(jitk + "vmm/.READY"), kernelReady = existsSync(jitk + "kernel/.READY");
  const host = artifact(artifactPath(jitk + "vmm/", ["binary", "vmm", "host"], ["jitk-vmm", "build/jitk-vmm", "target/release/jitk-vmm"], "JITK_VMM_BINARY"));
  const image = artifact(artifactPath(jitk + "kernel/", ["image", "kernel"], ["dist/kernel.bin", "kernel.bin", "build/kernel.bin"], "JITK_KERNEL_IMAGE"));
  let gate;
  for (const path of [jitk + "kernel/parking-0.json", jitk + "kernel/evidence/parking-0.json", here + "fixtures/parking-gate.json"]) if (existsSync(path)) {
    const m = JSON.parse(readFileSync2(path, "utf8"));
    if ((!m.image_sha256 || m.image_sha256 === image.sha256) && (!m.vmm_sha256 || m.vmm_sha256 === host.sha256) && m.status === "PASS" && m.exchanges >= 1e3 && m.idle_core_percent < 2) {
      gate = { idleCorePercent: m.idle_core_percent, evidence: path };
      break;
    }
  }
  const km = marker(jitk + "kernel/"), vm = marker(jitk + "vmm/");
  if (!process.env.JITK_KERNEL_IMAGE && km.sha256 && km.sha256 !== image.sha256) throw Error("kernel READY hash mismatch");
  if (!process.env.JITK_VMM_BINARY && vm.binary_sha256 && vm.binary_sha256 !== host.sha256) throw Error("VMM READY hash mismatch");
  const g1s = typeof km.gates?.G1 === "string" ? km.gates.G1 : "";
  const pct = g1s.match(/^([0-9.]+)%.*?(\d+)\/(\d+)/), below = g1s.match(/^(\d+)\/(\d+); idle CPU below ps resolution/);
  const g1 = pct ? { idle: Number(pct[1]), n: pct[2], m: pct[3] } : below ? { idle: 0, n: below[1], m: below[2] } : null;
  if (!gate && g1 && g1.idle < 2 && Number(g1.n) >= 1e3 && g1.n === g1.m) gate = { idleCorePercent: g1.idle, evidence: jitk + "kernel/.READY: " + g1s };
  const integrated = vmmReady && kernelReady;
  const selection = `${integrated ? "integrated" : "built"} jitk / confined VMM / current kernel`;
  writeFileSync(here + "integration-selection.json", JSON.stringify({ selection, integrated, host, image, gate, vmmReady, kernelReady }, null, 2) + "\n");
  return { backend: new JitkBackend(host.path, { launcher: "01-vmm", image: image.path, requireSandboxAck: true }), gate, selection, integrated };
}
export {
  selectBackend
};
//# sourceMappingURL=select-backend.js.map
