Date.now=()=>1700000000000;Math.random=()=>0.5;
// Simulates a code-mode script: tool calls go over stdin/stdout as JSON lines.
import * as std from 'qjs:std';
let nextId = 0;
function call(ns, fn, args) {
  const id = nextId++;
  std.out.puts(JSON.stringify({ t: "call", id, ns, fn, args }) + "\n");
  std.out.flush();
  const line = std.in.getline();
  const msg = JSON.parse(line);
  if (msg.err) throw new Error(msg.err);
  return Promise.resolve(msg.ok);
}
const github = new Proxy({}, { get: (_, fn) => (args) => call("github", fn, args) });
async function main() {
  const prs = await github.listPRs({ repo: "acme/api", state: "open" });
  const stale = prs.filter(p => /fix|chore/i.test(p.title)).map(p => ({ ...p, age: Date.now() - p.created }));
  const m = new Map(stale.map(p => [p.id, p]));
  await github.comment({ id: [...m.keys()][0], body: `ping ${Math.round(Math.random()*100)}` });
  return { count: m.size };
}
main().then(r => { std.out.puts(JSON.stringify({ t: "done", result: r }) + "\n"); std.out.flush(); },
            e => { std.out.puts(JSON.stringify({ t: "done", error: String(e) }) + "\n"); std.out.flush(); });
