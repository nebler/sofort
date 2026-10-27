// Architecture boundary lint (ARCH.md). Kernel code outside src/arch/ must not
// contain assembly, AArch64 register/instruction/system names, or raw syscall
// numbers. Comments and string literals are ignored; attributes that mount an
// arch file (`path = "arch/..."`) are the one allowed mention of an arch.
// `arch-lint [--self-test] [SRC_DIR]`: --self-test checks the rules against fixed
// samples first; SRC_DIR defaults to this kernel's src/.
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { check, files } from './lib.ts';

const RULES: [RegExp, string][] = [
  [/\b(?:asm|global_asm|naked_asm)!/, 'inline or global assembly'],
  [/\b(?:core|std)::arch\b/, 'core::arch intrinsics'],
  [/\b(?:target_arch|aarch64|arm64)\b/i, 'architecture selection outside an arch mount'],
  [/\b[a-z0-9]+_el[0-3]\b|\bel[0-3]\b/i, 'AArch64 system register or exception level'],
  [/\b(?:dsb|dmb|isb|tlbi|eret|hvc|smc|svc|wfi|wfe|sev|mrs|msr|ldar|stlr|dc|ic)\b/i, 'AArch64 instruction'],
  [/\b(?:daif|spsr|elr|esr|far|vbar|ttbr[01]|tcr|mair|sctlr|cntv\w*|cntp\w*|cntfrq\w*|cntvct\w*|icc_\w+|gicd|gicr|psci|pan)\b/i, 'AArch64 system state or platform name'],
  [/\b[xw](?:[0-9]|[12][0-9]|30)\b|\bxzr\b|\bwzr\b|\bsp_el\d\b/, 'AArch64 register name'],
  [/\bdispatch\(\s*\d|\bnr\s*==\s*\d|\bn\s*==\s*\d/, 'raw syscall number (use syscalls::nr)'],
];

// Replace comments and string/char literal contents with spaces, keeping offsets
// and newlines so findings report the right line.
function strip(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && next === '*') {
      let depth = 0;
      do {
        if (source[i] === '/' && source[i + 1] === '*') { depth++; out += '  '; i += 2; }
        else if (source[i] === '*' && source[i + 1] === '/') { depth--; out += '  '; i += 2; }
        else { out += source[i] === '\n' ? '\n' : ' '; i++; }
      } while (depth > 0 && i < source.length);
    } else if (c === '"') {
      out += '"'; i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\') { out += ' '; i++; }
        out += source[i] === '\n' ? '\n' : ' '; i++;
      }
      out += '"'; i++;
    } else if (c === '\'' && (source[i + 2] === '\'' || (next === '\\' && source[i + 3] === '\''))) {
      const len = next === '\\' ? 4 : 3;
      out += '\'' + ' '.repeat(len - 2) + '\''; i += len;
    } else {
      out += c; i++;
    }
  }
  return out;
}
// Blank attributes that mount an architecture file. `source` is already
// stripped, so read the path from the original text at the same offsets.
function unmount(code: string, original: string): string {
  let out = code;
  let at = code.indexOf('#[');
  while (at >= 0) {
    let depth = 0;
    let end = at + 1;
    for (; end < code.length; end++) {
      if (code[end] === '[') depth++;
      else if (code[end] === ']' && --depth === 0) break;
    }
    if (/path\s*=\s*"arch\//.test(original.slice(at, end + 1))) {
      out = out.slice(0, at) + out.slice(at, end + 1).replace(/[^\n]/g, ' ') + out.slice(end + 1);
    }
    at = code.indexOf('#[', end);
  }
  return out;
}
export function findings(name: string, source: string): string[] {
  const result: string[] = [];
  if (name.endsWith('.S') || name.endsWith('.s')) return [name + ': assembly source outside src/arch/'];
  const lines = unmount(strip(source), source).split('\n');
  for (let n = 0; n < lines.length; n++) {
    for (const [rule, what] of RULES) {
      const match = rule.exec(lines[n]);
      if (match) result.push(`${name}:${n + 1}: ${what}: ${match[0]}`);
    }
  }
  return result;
}

function selfTest(): void {
  const bad: [string, string][] = [
    ['asm!("wfi");', 'assembly'],
    ['core::arch::global_asm!(include_str!("x.S"));', 'global assembly'],
    ['let v = read_sysreg(cntvct_el0);', 'system register'],
    ['unsafe { barrier_dsb(); dsb() }', 'instruction'],
    ['#[cfg(target_arch = "aarch64")] fn f() {}', 'arch cfg without a mount'],
    ['if n == 63 { return 0; }', 'raw syscall number'],
    ['crate::syscalls::dispatch(64, &a)', 'raw dispatch'],
    ['let r = x8;', 'register'],
  ];
  for (const [code, what] of bad) check(findings('t.rs', code).length > 0, 'self-test missed ' + what + ': ' + code);
  const good = [
    '// EL1 with DAIF masked; dsb then isb, x0 holds the FDT.',
    'crate::console::print("\\x1eFAULT esr=");',
    '#[cfg_attr(\n    all(target_arch = "aarch64", not(feature = "ring")),\n    path = "arch/aarch64/mmu.rs"\n)]\nmod mmu;',
    'if n == nr::WRITE { bytes(a[1], a[2]); }',
    'let c = \'"\'; let s = "a // b"; let far_away = 0x18;',
    '/* nested /* asm!() */ wfi */ let ok = 1;',
  ];
  for (const code of good) check(findings('t.rs', code).length === 0, 'self-test false positive: ' + code + ' -> ' + findings('t.rs', code).join('; '));
  check(findings('boot.S', '').length === 1, 'self-test missed an assembly file');
}

const operand = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const root = operand ?? join(import.meta.dirname, 'src');
if (process.argv.includes('--self-test')) selfTest();
const errors: string[] = [];
let scanned = 0;
for (const path of files(root).sort()) {
  const rel = relative(root, path);
  if (rel.startsWith('arch/') || !/\.(rs|S|s)$/.test(rel)) continue;
  scanned++;
  errors.push(...findings('src/' + rel, readFileSync(path, 'utf8')));
}
for (const error of errors) console.error(error);
check(errors.length === 0, errors.length + ' architecture-boundary violations outside src/arch/');
console.log(`arch-lint: ${scanned} core files clean`);
