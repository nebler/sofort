// verify.ts
import assert from "node:assert/strict";
import { performance as performance3 } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { z as z2 } from "zod";
import { toolDefinition } from "@tanstack/ai";
import { stripTypeScript, createCodeModeTool } from "@tanstack/ai-code-mode";

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
function toPascalCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^[a-z]/, (letter) => letter.toUpperCase());
}
function escapeControlChar(ch) {
  const code = ch.charCodeAt(0);
  if (code <= 31 || code === 127) return "\\u" + code.toString(16).padStart(4, "0");
  return ch;
}
function quoteProp(name2) {
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name2)) {
    let escaped = "";
    for (const ch of name2) if (ch === "\\") escaped += "\\\\";
    else if (ch === '"') escaped += '\\"';
    else if (ch === "\n") escaped += "\\n";
    else if (ch === "\r") escaped += "\\r";
    else if (ch === "	") escaped += "\\t";
    else if (ch === "\u2028") escaped += "\\u2028";
    else if (ch === "\u2029") escaped += "\\u2029";
    else escaped += escapeControlChar(ch);
    return `"${escaped}"`;
  }
  return name2;
}
function escapeStringLiteral(s) {
  let out = "";
  for (const ch of s) if (ch === "\\") out += "\\\\";
  else if (ch === '"') out += '\\"';
  else if (ch === "\n") out += "\\n";
  else if (ch === "\r") out += "\\r";
  else if (ch === "	") out += "\\t";
  else if (ch === "\u2028") out += "\\u2028";
  else if (ch === "\u2029") out += "\\u2029";
  else out += escapeControlChar(ch);
  return out;
}
function escapeJsDoc(text2) {
  return text2.replace(/\*\//g, "*\\/");
}
function resolveRef(ref, root) {
  if (ref === "#") return root;
  if (!ref.startsWith("#/")) return null;
  const segments = ref.slice(2).split("/").map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current = root;
  for (const seg of segments) {
    if (current === null || typeof current !== "object") return null;
    current = current[seg];
    if (current === void 0) return null;
  }
  if (typeof current === "boolean") return current;
  if (current === null || typeof current !== "object") return null;
  return current;
}
function applyNullable(result, schema2) {
  if (result !== "unknown" && result !== "never" && schema2?.nullable === true) return `${result} | null`;
  return result;
}
function jsonSchemaToTypeString(schema2, indent, ctx) {
  if (typeof schema2 === "boolean") return schema2 ? "unknown" : "never";
  if (ctx.depth >= ctx.maxDepth) return "unknown";
  if (ctx.seen.has(schema2)) return "unknown";
  ctx.seen.add(schema2);
  const nextCtx = {
    ...ctx,
    depth: ctx.depth + 1
  };
  try {
    if (schema2.$ref) {
      const resolved = resolveRef(schema2.$ref, ctx.root);
      if (!resolved) return "unknown";
      return applyNullable(jsonSchemaToTypeString(resolved, indent, nextCtx), schema2);
    }
    if (schema2.anyOf) return applyNullable(schema2.anyOf.map((s) => jsonSchemaToTypeString(s, indent, nextCtx)).join(" | "), schema2);
    if (schema2.oneOf) return applyNullable(schema2.oneOf.map((s) => jsonSchemaToTypeString(s, indent, nextCtx)).join(" | "), schema2);
    if (schema2.allOf) return applyNullable(schema2.allOf.map((s) => jsonSchemaToTypeString(s, indent, nextCtx)).join(" & "), schema2);
    if (schema2.enum) {
      if (schema2.enum.length === 0) return "never";
      return applyNullable(schema2.enum.map((v) => {
        if (v === null) return "null";
        if (typeof v === "string") return '"' + escapeStringLiteral(v) + '"';
        if (typeof v === "object") return JSON.stringify(v) ?? "unknown";
        return String(v);
      }).join(" | "), schema2);
    }
    if (schema2.const !== void 0) return applyNullable(schema2.const === null ? "null" : typeof schema2.const === "string" ? '"' + escapeStringLiteral(schema2.const) + '"' : typeof schema2.const === "object" ? JSON.stringify(schema2.const) ?? "unknown" : String(schema2.const), schema2);
    const type = schema2.type;
    if (type === "string") return applyNullable("string", schema2);
    if (type === "number" || type === "integer") return applyNullable("number", schema2);
    if (type === "boolean") return applyNullable("boolean", schema2);
    if (type === "null") return "null";
    if (type === "array") {
      const prefixItems = schema2.prefixItems;
      if (Array.isArray(prefixItems)) return applyNullable(`[${prefixItems.map((s) => jsonSchemaToTypeString(s, indent, nextCtx)).join(", ")}]`, schema2);
      if (Array.isArray(schema2.items)) return applyNullable(`[${schema2.items.map((s) => jsonSchemaToTypeString(s, indent, nextCtx)).join(", ")}]`, schema2);
      if (schema2.items) return applyNullable(`${jsonSchemaToTypeString(schema2.items, indent, nextCtx)}[]`, schema2);
      return applyNullable("unknown[]", schema2);
    }
    if (type === "object" || schema2.properties) {
      const props = schema2.properties || {};
      const required = new Set(schema2.required || []);
      const lines = [];
      for (const [propName, propSchema] of Object.entries(props)) {
        if (typeof propSchema === "boolean") {
          const boolType = propSchema ? "unknown" : "never";
          const optionalMark2 = required.has(propName) ? "" : "?";
          lines.push(`${indent}    ${quoteProp(propName)}${optionalMark2}: ${boolType};`);
          continue;
        }
        const isRequired = required.has(propName);
        const propType = jsonSchemaToTypeString(propSchema, indent + "    ", nextCtx);
        const desc = propSchema.description;
        const format = propSchema.format;
        if (desc || format) {
          const descText = desc ? escapeJsDoc(desc.replace(/\r?\n/g, " ")) : void 0;
          const formatTag = format ? `@format ${escapeJsDoc(format)}` : void 0;
          if (descText && formatTag) {
            lines.push(`${indent}    /**`);
            lines.push(`${indent}     * ${descText}`);
            lines.push(`${indent}     * ${formatTag}`);
            lines.push(`${indent}     */`);
          } else lines.push(`${indent}    /** ${descText ?? formatTag} */`);
        }
        const quotedName = quoteProp(propName);
        const optionalMark = isRequired ? "" : "?";
        lines.push(`${indent}    ${quotedName}${optionalMark}: ${propType};`);
      }
      if (schema2.additionalProperties) {
        const valueType = schema2.additionalProperties === true ? "unknown" : jsonSchemaToTypeString(schema2.additionalProperties, indent + "    ", nextCtx);
        lines.push(`${indent}    [key: string]: ${valueType};`);
      }
      if (lines.length === 0) {
        if (schema2.additionalProperties === false) return applyNullable("{}", schema2);
        return applyNullable("Record<string, unknown>", schema2);
      }
      return applyNullable(`{
${lines.join("\n")}
${indent}}`, schema2);
    }
    if (Array.isArray(type)) return applyNullable(type.map((t) => {
      if (t === "string") return "string";
      if (t === "number" || t === "integer") return "number";
      if (t === "boolean") return "boolean";
      if (t === "null") return "null";
      if (t === "array") return "unknown[]";
      if (t === "object") return "Record<string, unknown>";
      return "unknown";
    }).join(" | "), schema2);
    return "unknown";
  } finally {
    ctx.seen.delete(schema2);
  }
}
function jsonSchemaToType(schema2, typeName) {
  return `type ${typeName} = ${jsonSchemaToTypeString(schema2, "", {
    root: schema2,
    depth: 0,
    seen: /* @__PURE__ */ new Set(),
    maxDepth: 20
  })}`;
}
function extractJsonSchemaDescriptions(schema2) {
  const descriptions = {};
  if (schema2.properties) {
    for (const [fieldName, propSchema] of Object.entries(schema2.properties)) if (propSchema && typeof propSchema === "object" && propSchema.description) descriptions[fieldName] = propSchema.description;
  }
  return descriptions;
}
function generateTypesFromJsonSchema(tools) {
  let availableTools = "";
  let availableTypes = "";
  for (const [toolName, tool] of Object.entries(tools)) {
    const safeName = sanitizeToolName(toolName);
    const typeName = toPascalCase(safeName);
    try {
      const inputType = jsonSchemaToType(tool.inputSchema, `${typeName}Input`);
      const outputType = tool.outputSchema ? jsonSchemaToType(tool.outputSchema, `${typeName}Output`) : `type ${typeName}Output = unknown`;
      availableTypes += `
${inputType.trim()}`;
      availableTypes += `
${outputType.trim()}`;
      const paramLines = (() => {
        try {
          const paramDescs = extractJsonSchemaDescriptions(tool.inputSchema);
          return Object.entries(paramDescs).map(([fieldName, desc]) => `@param input.${fieldName} - ${desc}`);
        } catch {
          return [];
        }
      })();
      const jsdocLines = [];
      if (tool.description?.trim()) jsdocLines.push(escapeJsDoc(tool.description.trim().replace(/\r?\n/g, " ")));
      else jsdocLines.push(escapeJsDoc(toolName));
      for (const pd of paramLines) jsdocLines.push(escapeJsDoc(pd.replace(/\r?\n/g, " ")));
      const jsdocBody = jsdocLines.map((l) => `	 * ${l}`).join("\n");
      availableTools += `
	/**
${jsdocBody}
	 */`;
      availableTools += `
	${safeName}: (input: ${typeName}Input) => Promise<${typeName}Output>;`;
      availableTools += "\n";
    } catch {
      availableTypes += `
type ${typeName}Input = unknown`;
      availableTypes += `
type ${typeName}Output = unknown`;
      availableTools += `
	/**
	 * ${escapeJsDoc(toolName)}
	 */`;
      availableTools += `
	${safeName}: (input: ${typeName}Input) => Promise<${typeName}Output>;`;
      availableTools += "\n";
    }
  }
  availableTools = `
declare const codemode: {${availableTools}}`;
  return `
${availableTypes}
${availableTools}
  `.trim();
}

// upstream.ts
var normalizeCode2 = normalizeCode;
var sanitizeToolName2 = sanitizeToolName;
var generateTypesFromJsonSchema2 = generateTypesFromJsonSchema;

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
function executionBody(code, providers2) {
  const declarations = providers2.map((p) => {
    const key = JSON.stringify(p.name), allowed = JSON.stringify(Object.keys(p.fns));
    return `const ${p.name}=new Proxy(Object.create(null),{get:(t,k)=>Object.hasOwn(t,k)?t[k]:k!=='then'&&${allowed}.includes(k)?async(...a)=>parse(JSON.stringify(await __wire[${key}][k](...JSON.parse(stringify(a))))):undefined});`;
  }).join("\n");
  return `return await (async (__wire)=>{
${codec}
installBase64();
${declarations}
${providers2.map((p) => p.prelude ?? "").join("\n")}
const result=await (${normalizeCode2(code)})();
return JSON.parse(stringify(result===undefined?null:result));
})({${providers2.map((p) => p.name).join(",")}});`;
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
        const seen2 = /* @__PURE__ */ new Set();
        for (const fn of fns) {
          if (!name(fn) || fn === "then" || seen2.has(fn)) bad("SCHEMA");
          seen2.add(fn);
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
      const providers2 = source.map((p) => {
        const fns = /* @__PURE__ */ Object.create(null);
        for (const [key, fn] of Object.entries(p.fns)) {
          const safe = sanitizeToolName2(key);
          if (Object.hasOwn(fns, safe)) throw new Error("sanitized tool collision");
          fns[safe] = fn;
        }
        return { ...p, fns };
      });
      const seen2 = /* @__PURE__ */ new Set();
      for (const p of providers2) {
        if (!/^[A-Za-z_$][\w$]*$/.test(p.name) || ["console", "__rpc", "__bindings", "Promise", "Object", "globalThis", "setTimeout", "undefined"].includes(p.name) || seen2.has(p.name)) throw new Error("invalid/duplicate namespace");
        seen2.add(p.name);
      }
      const tools = /* @__PURE__ */ Object.create(null);
      for (const p of providers2) {
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
      const body = executionBody(code, providers2);
      if (body.length > LIMIT.code) throw Error("code limit including trusted adapters");
      await s.send({ t: "run", code: body, ns: Object.fromEntries(providers2.map((p) => [p.name, Object.keys(p.fns)])) });
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

// select-backend.ts
import { existsSync, readFileSync as readFileSync3, writeFileSync } from "node:fs";
import { createHash as createHash2 } from "node:crypto";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var here = fileURLToPath2(new URL("../", import.meta.url));
var jitk = fileURLToPath2(new URL("../../", import.meta.url));
function artifact(path) {
  if (!existsSync(path)) throw Error("missing artifact " + path);
  return { path, sha256: createHash2("sha256").update(readFileSync3(path)).digest("hex") };
}
function marker(dir) {
  try {
    return JSON.parse(readFileSync3(dir + ".READY", "utf8"));
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
  const selected2 = process.env.JITK_BACKEND ?? "jitk";
  if (selected2 === "local-qjs") {
    if (!process.env.QJS) throw Error("UNSAFE local-qjs requires QJS=/absolute/path/to/qjs");
    return { backend: new LocalProcessQjsBackend(process.env.QJS), selection: "UNSAFE local-qjs", integrated: false };
  }
  if (selected2 !== "jitk") throw Error("unsupported JITK_BACKEND: " + selected2);
  const vmmReady = existsSync(jitk + "vmm/.READY"), kernelReady = existsSync(jitk + "kernel/.READY");
  const host = artifact(artifactPath(jitk + "vmm/", ["binary", "vmm", "host"], ["jitk-vmm", "build/jitk-vmm", "target/release/jitk-vmm"], "JITK_VMM_BINARY"));
  const image = artifact(artifactPath(jitk + "kernel/", ["image", "kernel"], ["dist/kernel.bin", "kernel.bin", "build/kernel.bin"], "JITK_KERNEL_IMAGE"));
  let gate;
  for (const path of [jitk + "kernel/parking-0.json", jitk + "kernel/evidence/parking-0.json", here + "fixtures/parking-gate.json"]) if (existsSync(path)) {
    const m = JSON.parse(readFileSync3(path, "utf8"));
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

// verify.ts
import { execFileSync as execFileSync2 } from "node:child_process";

// providers.ts
import { z } from "zod";
function defineTool(inputSchema, outputSchema, execute, description = "") {
  return { inputSchema, outputSchema, description, execute: async (args) => outputSchema.parseAsync(await execute(await inputSchema.parseAsync(args))) };
}
function prepareProviders(items) {
  const types = [], providers2 = [];
  for (const p of items) {
    if (!/^[A-Za-z_$][\w$]*$/.test(p.name)) throw new Error("invalid namespace");
    const schemas = Object.fromEntries(Object.entries(p.tools).map(([k, t]) => [k, { description: t.description, inputSchema: z.toJSONSchema(t.inputSchema), outputSchema: z.toJSONSchema(t.outputSchema, { io: "output" }) }]));
    const generated = generateTypesFromJsonSchema2(schemas).replace("declare const codemode", "const api");
    types.push(`declare namespace __schema_${p.name} {
${generated}
}
declare const ${p.name}: typeof __schema_${p.name}.api;`);
    const fns = /* @__PURE__ */ Object.create(null);
    for (const [key, t] of Object.entries(p.tools)) {
      const safe = sanitizeToolName2(key);
      if (Object.hasOwn(fns, safe)) throw new Error("sanitized tool collision");
      fns[safe] = async (...args) => t.execute(args[0]);
    }
    providers2.push({ name: p.name, fns, prelude: p.prelude });
  }
  return { types: types.join("\n\n"), providers: providers2 };
}

// verify.ts
var selected = selectBackend();
console.log(selected.selection);
var pool = new SandboxPool(selected.backend, selected.gate ? 1 : 0, 3, { parkingGate: selected.gate });
var loadBefore = execFileSync2("/usr/bin/uptime", [], { encoding: "utf8" }).trim();
var seen = [];
var ex = new MicroVMExecutor(pool, (call, ctx) => {
  seen.push({ fn: call.fn, labels: ctx.provenance });
  return call.fn === "write" ? "requireApproval" : call.fn === "blocked" ? "deny" : "allow";
});
var rows = [];
async function test(name2, fn) {
  const t = performance3.now();
  await fn();
  rows.push({ name: name2, ok: true, ms: performance3.now() - t });
  console.log("PASS " + name2);
}
var effects = 0;
var providers = [{ name: "github", fns: { listIssues: async () => [{ id: 1 }, { id: 2 }], slow: async () => new Promise((r) => setTimeout(() => r("ok"), 200)), write: async () => ++effects, blocked: async () => ++effects, echo: async (...a) => a[0] } }];
try {
  await pool.warm();
  await test("exact requested demo", async () => {
    assert.equal((await ex.execute("const r=await github.listIssues({repo:'x'});return r.length", providers)).result, 2);
  });
  await test("binary codec roundtrip", async () => {
    const r = await ex.execute("return await github.echo(new Uint8Array([0,127,255]))", providers);
    assert.deepEqual(r.result, new Uint8Array([0, 127, 255]));
  });
  await test("async fanout and UTF8", async () => {
    const r = await ex.execute("return await Promise.all([github.echo('gr\xF6\xDFer \u{1F30D}'), github.echo(2)])", providers);
    assert(!r.error, JSON.stringify(r));
    assert.deepEqual(r.result, ["gr\xF6\xDFer \u{1F30D}", 2]);
  });
  await test("capture console + provider prelude closure", async () => {
    const r = await ex.execute("console.warn('a',2);return github.local(3)", [{ ...providers[0], prelude: "github.local=x=>x+2;" }]);
    assert.equal(r.result, 5);
    assert.deepEqual(r.logs, ["[warn] a 2"]);
  });
  await test("deny has no side effect", async () => {
    const r = await ex.execute("return await github.blocked()", providers);
    assert.match(r.error, /policy denied/);
    assert.equal(effects, 0);
  });
  await test("approval is fail closed", async () => {
    const r = await ex.execute("return await github.write()", providers);
    assert.match(r.error, /approval required/);
    assert.equal(effects, 0);
  });
  await test("approved call executes once", async () => {
    const r = await ex.execute("return await github.write()", providers, { approve: async () => true });
    assert.equal(r.result, 1);
    assert.equal(effects, 1);
  });
  await test("provenance accumulates across calls", async () => {
    await ex.execute("await github.echo(1);return await github.echo(2)", providers);
    assert(seen.at(-1).labels.includes("tool-untrusted"));
  });
  await test("CPU infinite loop SIGKILL", async () => {
    const t = performance3.now();
    const r = await ex.execute("while(true){}", providers, { timeout: 30 });
    assert.match(r.error, /timed out/);
    assert(performance3.now() - t < 1e3);
  });
  await test("AbortSignal kills awaiting guest", async () => {
    const c = new AbortController();
    setTimeout(() => c.abort(), 30);
    const r = await ex.execute("return await github.slow()", providers, { signal: c.signal });
    assert.match(r.error, /aborted/);
  });
  await test("tool that never settles cannot defeat deadline", async () => {
    const r = await ex.execute("return await tools.hang()", [{ name: "tools", fns: { hang: async () => new Promise(() => {
    }) } }], { timeout: 30 });
    assert.match(r.error, /timed out/);
  });
  await test("fresh process per execute", async () => {
    await ex.execute("globalThis.leak=42;return 1", providers);
    assert.equal((await ex.execute("return typeof globalThis.leak", providers)).result, "undefined");
  });
  await test("unknown inherited method denied", async () => {
    const r = await ex.execute("return await github.toString()", providers);
    assert.match(r.error, /unknown tool|not a function/);
  });
  await test("sanitized names and collisions", async () => {
    assert.equal((await ex.execute("return await github.list_issues()", [{ name: "github", fns: { "list-issues": async () => 5 } }])).result, 5);
    assert.match((await ex.execute("return 1", [{ name: "github", fns: { "a-b": async () => 1, a_b: async () => 2 } }])).error, /collision/);
  });
  await test("generated types + host validation", async () => {
    const t = defineTool(z2.object({ repo: z2.string() }), z2.array(z2.object({ id: z2.number() })), async () => [{ id: 1 }]);
    const p = prepareProviders([{ name: "github", tools: { listIssues: t } }, { name: "gitlab", tools: { listIssues: t } }]);
    await writeFile(process.cwd() + "/generated-tools.d.ts", p.types + "\n");
    assert(p.types.includes("declare const github"));
    assert.equal((await ex.execute("return (await github.listIssues({repo:'x'})).length", p.providers)).result, 1);
    assert.match((await ex.execute("return await github.listIssues({repo:5})", p.providers)).error, /invalid_type/);
  });
  await test("TanStack driver on actual stripped body", async () => {
    const context = await ex.createContext({ bindings: { external_echo: { name: "external_echo", description: "echo", inputSchema: { type: "object" }, execute: async (x) => x } }, memoryLimit: selected.backend.memoryLimitMB });
    const r = await context.execute(await stripTypeScript("const n: number = 7; return await external_echo({n});"));
    assert.deepEqual(r, { success: true, value: { n: 7 }, logs: [] });
    const again = await context.execute("return 'a plain string'");
    assert.equal(again.value, "a plain string");
    await context.dispose();
    assert.equal((await context.execute("return 1")).success, false);
  });
  await test("TanStack memory mismatch fails explicitly", async () => {
    await assert.rejects(() => ex.createContext({ bindings: {}, memoryLimit: 64 }), /matching backend/);
  });
  await test("TanStack createCodeModeTool integration", async () => {
    const tool = createCodeModeTool({ driver: ex, memoryLimit: selected.backend.memoryLimitMB, tools: [toolDefinition({ name: "echo", description: "echo", inputSchema: z2.object({ n: z2.number() }) }).server(async (args) => args)], debug: false });
    const r = await tool.execute({ typescriptCode: "const n: number = 9; console.log(n); return (await external_echo({n})).n+1;" }, void 0);
    assert.equal(r.success, true);
    assert.equal(r.result, 10);
  });
  await test("bounded log capture (v1 truncates/drops)", async () => {
    const r = await ex.execute("for(let i=0;i<10000;i++)console.log('a');return 1", providers);
    assert.equal(r.result, 1);
    assert(!r.error);
    assert.equal(r.logs?.length, 1024);
  });
  await test("warm pool capacity and single use", async () => {
    const p = new SandboxPool(selected.backend, selected.gate ? 1 : 0, 1, { parkingGate: selected.gate });
    await p.warm();
    const s = await p.acquire();
    await assert.rejects(() => p.acquire(), /saturated/);
    await p.release(s);
    await p.close();
  });
} finally {
  await pool.close();
}
await writeFile(process.cwd() + "/verification-results.json", JSON.stringify({ selection: selected.selection, loadBefore, loadAfter: execFileSync2("/usr/bin/uptime", [], { encoding: "utf8" }).trim(), rows }, null, 2) + "\n");
console.log(`${rows.length} checks passed`);
//# sourceMappingURL=verify.js.map
