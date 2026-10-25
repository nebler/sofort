// code.ts
import { readFileSync } from "node:fs";

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

// upstream.ts
var normalizeCode2 = normalizeCode;

// code.ts
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
export {
  executionBody
};
//# sourceMappingURL=code.js.map
