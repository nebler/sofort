// normalizeCode from @cloudflare/codemode 0.5.5 (Cloudflare, Inc., MIT).
// Kept here because its public Node entrypoint imports cloudflare:workers.
// Source/license: https://github.com/cloudflare/agents/tree/main/packages/codemode
import {parse} from 'acorn';
export function normalizeCode(code:string):string {
  const match=code.trim().match(/^```(?:js|javascript|typescript|ts|tsx|jsx)?\s*\n([\s\S]*?)```\s*$/);
  const source=(match?match[1]:code).trim();
  if(!source)return 'async () => {}';
  try {
    const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
    if(ast.body.length===1) {
      const only=ast.body[0];
      if(only.type==='ExpressionStatement'&&only.expression.type==='ArrowFunctionExpression')return source;
      if(only.type==='ExportDefaultDeclaration') {
        const d=only.declaration, inner=source.slice(d.start,d.end);
        if(d.type==='FunctionDeclaration'&&!d.id)return `async()=>{return (${inner})();}`;
        if(d.type==='ClassDeclaration'&&!d.id)return `async()=>{return (${inner});}`;
        return normalizeCode(inner);
      }
      if(only.type==='FunctionDeclaration')return `async()=>{${source}\nreturn ${only.id?.name??'fn'}();}`;
    }
    const last=ast.body.at(-1);
    if(last?.type==='ExpressionStatement')return `async()=>{${source.slice(0,last.start)}return (${source.slice(last.expression.start,last.expression.end)})\n}`;
  } catch {}
  return `async()=>{\n${source}\n}`;
}
