// providers.ts
import { z } from "zod";

// vendor/codemode.mjs
import * as acorn from "acorn";
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
function toPascalCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^[a-z]/, (letter) => letter.toUpperCase());
}
function escapeControlChar(ch) {
  const code = ch.charCodeAt(0);
  if (code <= 31 || code === 127) return "\\u" + code.toString(16).padStart(4, "0");
  return ch;
}
function quoteProp(name) {
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    let escaped = "";
    for (const ch of name) if (ch === "\\") escaped += "\\\\";
    else if (ch === '"') escaped += '\\"';
    else if (ch === "\n") escaped += "\\n";
    else if (ch === "\r") escaped += "\\r";
    else if (ch === "	") escaped += "\\t";
    else if (ch === "\u2028") escaped += "\\u2028";
    else if (ch === "\u2029") escaped += "\\u2029";
    else escaped += escapeControlChar(ch);
    return `"${escaped}"`;
  }
  return name;
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
function escapeJsDoc(text) {
  return text.replace(/\*\//g, "*\\/");
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
function applyNullable(result, schema) {
  if (result !== "unknown" && result !== "never" && schema?.nullable === true) return `${result} | null`;
  return result;
}
function jsonSchemaToTypeString(schema, indent, ctx) {
  if (typeof schema === "boolean") return schema ? "unknown" : "never";
  if (ctx.depth >= ctx.maxDepth) return "unknown";
  if (ctx.seen.has(schema)) return "unknown";
  ctx.seen.add(schema);
  const nextCtx = {
    ...ctx,
    depth: ctx.depth + 1
  };
  try {
    if (schema.$ref) {
      const resolved = resolveRef(schema.$ref, ctx.root);
      if (!resolved) return "unknown";
      return applyNullable(jsonSchemaToTypeString(resolved, indent, nextCtx), schema);
    }
    if (schema.anyOf) return applyNullable(schema.anyOf.map((s) => jsonSchemaToTypeString(s, indent, nextCtx)).join(" | "), schema);
    if (schema.oneOf) return applyNullable(schema.oneOf.map((s) => jsonSchemaToTypeString(s, indent, nextCtx)).join(" | "), schema);
    if (schema.allOf) return applyNullable(schema.allOf.map((s) => jsonSchemaToTypeString(s, indent, nextCtx)).join(" & "), schema);
    if (schema.enum) {
      if (schema.enum.length === 0) return "never";
      return applyNullable(schema.enum.map((v) => {
        if (v === null) return "null";
        if (typeof v === "string") return '"' + escapeStringLiteral(v) + '"';
        if (typeof v === "object") return JSON.stringify(v) ?? "unknown";
        return String(v);
      }).join(" | "), schema);
    }
    if (schema.const !== void 0) return applyNullable(schema.const === null ? "null" : typeof schema.const === "string" ? '"' + escapeStringLiteral(schema.const) + '"' : typeof schema.const === "object" ? JSON.stringify(schema.const) ?? "unknown" : String(schema.const), schema);
    const type = schema.type;
    if (type === "string") return applyNullable("string", schema);
    if (type === "number" || type === "integer") return applyNullable("number", schema);
    if (type === "boolean") return applyNullable("boolean", schema);
    if (type === "null") return "null";
    if (type === "array") {
      const prefixItems = schema.prefixItems;
      if (Array.isArray(prefixItems)) return applyNullable(`[${prefixItems.map((s) => jsonSchemaToTypeString(s, indent, nextCtx)).join(", ")}]`, schema);
      if (Array.isArray(schema.items)) return applyNullable(`[${schema.items.map((s) => jsonSchemaToTypeString(s, indent, nextCtx)).join(", ")}]`, schema);
      if (schema.items) return applyNullable(`${jsonSchemaToTypeString(schema.items, indent, nextCtx)}[]`, schema);
      return applyNullable("unknown[]", schema);
    }
    if (type === "object" || schema.properties) {
      const props = schema.properties || {};
      const required = new Set(schema.required || []);
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
      if (schema.additionalProperties) {
        const valueType = schema.additionalProperties === true ? "unknown" : jsonSchemaToTypeString(schema.additionalProperties, indent + "    ", nextCtx);
        lines.push(`${indent}    [key: string]: ${valueType};`);
      }
      if (lines.length === 0) {
        if (schema.additionalProperties === false) return applyNullable("{}", schema);
        return applyNullable("Record<string, unknown>", schema);
      }
      return applyNullable(`{
${lines.join("\n")}
${indent}}`, schema);
    }
    if (Array.isArray(type)) return applyNullable(type.map((t) => {
      if (t === "string") return "string";
      if (t === "number" || t === "integer") return "number";
      if (t === "boolean") return "boolean";
      if (t === "null") return "null";
      if (t === "array") return "unknown[]";
      if (t === "object") return "Record<string, unknown>";
      return "unknown";
    }).join(" | "), schema);
    return "unknown";
  } finally {
    ctx.seen.delete(schema);
  }
}
function jsonSchemaToType(schema, typeName) {
  return `type ${typeName} = ${jsonSchemaToTypeString(schema, "", {
    root: schema,
    depth: 0,
    seen: /* @__PURE__ */ new Set(),
    maxDepth: 20
  })}`;
}
function extractJsonSchemaDescriptions(schema) {
  const descriptions = {};
  if (schema.properties) {
    for (const [fieldName, propSchema] of Object.entries(schema.properties)) if (propSchema && typeof propSchema === "object" && propSchema.description) descriptions[fieldName] = propSchema.description;
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
var sanitizeToolName2 = sanitizeToolName;
var generateTypesFromJsonSchema2 = generateTypesFromJsonSchema;

// providers.ts
function defineTool(inputSchema, outputSchema, execute, description = "") {
  return { inputSchema, outputSchema, description, execute: async (args) => outputSchema.parseAsync(await execute(await inputSchema.parseAsync(args))) };
}
function prepareProviders(items) {
  const types = [], providers = [];
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
    providers.push({ name: p.name, fns, prelude: p.prelude });
  }
  return { types: types.join("\n\n"), providers };
}
export {
  defineTool,
  prepareProviders
};
//# sourceMappingURL=providers.js.map
