import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readJSON } from './lib.ts';

interface Host {
  corpus: { cases: number; runs: number };
  boundaries: { checks: number };
  fuzz: { mutations: number; chunkDifferentialRuns: number; accepted: number; rejected: number };
  uptime: string;
  node: string;
  version: string;
}
interface Case {
  name: string;
  pass: number;
  fail: number;
  totalMs: { p50: number; p90: number; p99: number } | null;
  loadBefore: string;
  loadAfter: string;
}
interface Config {
  imageSha256: string;
  originalImage?: string;
  image: string;
  source: string;
  host: string;
  hostSha256: string;
  bootstrapSha256: string;
}
interface Suite {
  cases: Case[];
  config: Config;
}
const root = process.env.JITK_PROTOCOL_ROOT || import.meta.dirname;
const host = readJSON<Host>(join(root, 'test-results.json'));
const suites: [string, Suite][] = [['Guest', readJSON<Suite>(join(root, 'vm-results.json'))], ['Hostile', readJSON<Suite>(join(root, 'hostile/results.json'))]];
function load(text: string): string {
  return text.split('load averages:').pop()!.trim();
}
const lines: string[] = [
  "# 03 — Round 3 protocol owner",
  "",
  "## Fixed and integration",
  "",
  "- **FIXED:** canonical protocol now lives in `arch/jitk/protocol/`; old spec is a redirect. `dispatcher.ts` is sole trusted decoder; `dispatcher.js` is generated, never maintained separately.",
  "- **FIXED:** raw DEL rejected in parser, incremental decoder, guest input, and integrated kernel stdout. Escaped DEL remains valid data. Kernel stdout now validates printable ASCII/LF before emission, including writev.",
  "- **FIXED:** guest log clipping uses decoded UTF-8 bytes/scalar boundaries (4096 per log, 262144 total), matching host accounting; lone surrogates become U+FFFD in convenience logs.",
  "- **FIXED:** executor and Hyperlight import the canonical dispatcher; kernel/build.rs reads canonical bootstrap. `import-check.mjs` verifies references and absence of private parser copies. No writes to other owners’ subtrees.",
  "- **FIXED:** real-VM conformance from `vectors.json.guestCases`; protocol hostile subset shared with 07 under `hostile/README.md`. No local-qjs substitute.",
  "- **FIXED:** `.READY` records item 1 build/test readiness; VM evidence below is separately reproducible. Strict TypeScript noEmit passes; generated JS build passes.",
  "- No objection rejected; no disagreement with DECISIONS-R1/R2. No new Rust decoder.",
  "",
  "## Host conformance",
  "",
  `- ${host["corpus"]["cases"]} generated cases × 2 chunkings = ${host["corpus"]["runs"]}/${host["corpus"]["runs"]} passing. ${host["boundaries"]["checks"]} boundary checks include 4096 calls, exact 1 MiB, refused ret queue, raw/escaped DEL and poisoned dispatcher.`,
  `- ${host["fuzz"]["mutations"]} deterministic mutations / ${host["fuzz"]["chunkDifferentialRuns"]} executions pass differential invariants; ${host["fuzz"]["accepted"]} accepted and ${host["fuzz"]["rejected"]} rejected. Mutation smoke test, not exhaustive audit.`,
  `- Uptime at host test: \`${host["uptime"]}\`. Node \`${host["node"]}\` / \`${host["version"]}\`.`,
  "",
  "## Real VM pass/fail and load",
  "",
  "These are fresh hardware VMs running stock qjs at EL0. Each row has n=30; medians are conventional, p90/p99 nearest-rank (p99 is the maximum at n=30). Total wall time includes spawn, VM execution, shutdown and reap. Contended functional durations only, **not H4 performance claims**. Every sample/load is retained in JSON. No watchdog kill counts as a pass.",
  "",
  "| Suite / case | Pass | Fail | Total ms median / p90 / p99 | Load 1/5/15 before → after |",
  "|---|---:|---:|---|---|"
];
for (const [kind, suite] of suites) {
  for (const c of suite.cases) {
    const timing = c.totalMs ? [c.totalMs.p50, c.totalMs.p90, c.totalMs.p99].map(n => n.toFixed(3)).join(' / ') : 'UNVERIFIED';
    lines.push(`| ${kind}: ${c.name} | ${c.pass} | ${c.fail} | ${timing} | ${load(c.loadBefore)} → ${load(c.loadAfter)} |`);
  }
}
lines.push('', '## Artifacts, containment scope and cleanup', '');
for (const [kind, suite] of suites) {
  const a = suite.config;
  lines.push(`- ${kind}: image SHA256 \`${a.imageSha256}\`; original \`${a.originalImage || a.image}\`; selected \`${a.source}\`.`, `  Host \`${a.host}\`, SHA256 \`${a.hostSha256}\`; bootstrap SHA256 \`${a.bootstrapSha256}\`. Images are pinned under \`/tmp/jitk-03/r3/\` to avoid concurrent rebuild drift.`);
}
const tail: string[] = [
  "",
  "- Hostile cases require the expected dispatcher fault + SIGKILL, or natural kernel kill with diagnostic and no done. fd2 attacks require no injected call, followed by an intentional stdout schema violation so the dispatcher kills the VM.",
  "- All fixture tool-effect counts are zero. Calls in flood tests are held/answered in memory only; no provider/credential/network invocation. Atomically validated control writes include a valid call prefix and must yield zero callbacks.",
  "- **UNVERIFIED here:** broader H5 filesystem/network/device containment, Linux/KVM, and quiet-host performance. The 02 R2 native host is a real one-port panic=abort VMM but is not the integrated 01/07 confinement launcher. This report does not claim full H5 until 07 runs the shared suite on that launcher.",
  "- Reproduction: `make -C arch/jitk/protocol build test vm hostile`; use verified absolute Node, default n=30. See README for launcher overrides. External independent watchdog; all owned VMM/watchdog children killed/reaped in finally.",
  "- Preserved R2 fallback guest evidence reproduces Unicode LOG_LIMIT drift; R2 hostile diagnostics reproduce DEL/high-byte partial-output acceptance. Earlier hostile harness string-escaping and oversized-write errors were corrected before final n=30 results; these diagnostics are not counted as product conformance failures.",
  "",
  "Evidence: `test-results.json`, `vm-results.json`, `hostile/results.json`; `hostile/integrated-smoke-results.json` is initial n=1 only."
];
for (const line of tail) {
  lines.push(line);
}
const report = lines.join('\n') + '\n';
writeFileSync(process.env.JITK_PROTOCOL_REPORT || resolve(root, '../../03-channel-protocol/R3.md'), report);
process.stdout.write(report);
