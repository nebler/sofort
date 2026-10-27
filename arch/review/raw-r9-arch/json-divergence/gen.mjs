// Emits candidate payloads; checks them against Node's parseFrame and prints both inputs.
import {parseFrame} from '/Users/noah/code/sofort/.claude/worktrees/agent-a214807b8e2e71ea3/arch/jitk/protocol/dispatcher.js';
import {writeFileSync} from 'node:fs';
const n = k => '['.repeat(k) + '0' + ']'.repeat(k);
const cases = [
  ['args', `["call","ns","fn",${n(31)}]`],
  ['req', `["call","ns","fn",${n(31)}]`],
  ['args', `["call","ns","fn",${n(30)}]`],
  ['reply', `{"ok":${n(31)}}`],
  ['reply', `{"ok":${n(32)}}`],
  ['reply', `{"ok":1e20}`],
  ['reply', `{"ok":"\\u0000"}`],
  ['reply', `{"ok":-0}`],
  ['reply', `{"ok":1E2}`],
  ['args', `["call","ns","fn",[" \\/ "]]`],
];
const node = [];
for (const [k, b] of cases) {
  const wrapped = k === 'reply' ? `{"t":"ret","id":1,${b.slice(1)}` : `{"args":${b}}`;
  let ok = true;
  try { parseFrame(wrapped); } catch { ok = false; }
  node.push(`${k} ${ok}`);
}
writeFileSync('/tmp/r9-json/in.txt', cases.map(([k, b]) => k + ' ' + b).join('\n') + '\n');
writeFileSync('/tmp/r9-json/node.txt', node.join('\n') + '\n');
