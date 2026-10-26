import { check } from './lib.ts';

// This is a conservative source lint, not a proof of non-interference. The
// differential still has to catch arithmetic encodings and unseen constants.
// ABI constants (stdio fds, zero, poll masks, structure widths) are legitimate.
const FIXTURE: Record<string, number[]> = {
  ppoll: [999, 0x41414141],
  fstat: [999, 9000, 17],
  pread64: [999, 9000, 8993, 10000, 4091, 23, 17, 5000],
};

export interface LintFinding { kind: string; condition: string; constant: string }

// Lex comments before strings, so comments inside a string cannot hide code.
export function rustTokens(source: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i += 1; continue; }
    if (source.slice(i, i + 2) === '//') {
      const end = source.indexOf('\n', i); i = end < 0 ? source.length : end; continue;
    }
    if (source.slice(i, i + 2) === '/*') {
      i += 2; let depth = 1;
      while (i < source.length && depth) {
        if (source.slice(i, i + 2) === '/*') { depth += 1; i += 2; }
        else if (source.slice(i, i + 2) === '*/') { depth -= 1; i += 2; }
        else i += 1;
      }
      check(!depth, 'unterminated Rust comment'); continue;
    }
    const rest = source.slice(i);
    const token = rest.match(/^(?:b?r#*"[\s\S]*?"#*|b?"(?:\\.|[^"\\])*"|b?'(?:\\.|[^'\\])'|[A-Za-z_][A-Za-z_0-9]*|0x[0-9a-fA-F_]+(?:[ui](?:8|16|32|64|128|size))?|0b[01_]+|[0-9][0-9_]*(?:[ui](?:8|16|32|64|128|size))?|=>|==|!=|<=|>=|&&|\|\||::|.)/);
    check(token, 'Rust tokenization failed'); tokens.push(token[0]); i += token[0].length;
  }
  return tokens;
}

function numeric(token: string): number | undefined {
  const clean = token.replace(/(?:[ui](?:8|16|32|64|128|size))$/, '').replaceAll('_', '');
  return /^(?:0x[0-9a-fA-F]+|0b[01]+|\d+)$/.test(clean) ? Number(clean) : undefined;
}

export function lintProbeConstants(name: string, source: string): LintFinding[] {
  const watched = FIXTURE[name] || [];
  const tokens = rustTokens(source);
  const aliases: Record<string, number> = {};
  const roles: Record<string, string> = {};
  const argRoles = name === 'pread64' ? ['fd', 'pointer', 'size', 'offset'] : name === 'fstat' ? ['fd', 'pointer'] : ['pointer', 'nfds', 'pointer', 'pointer', 'abi'];
  const code = tokens.join(' ');
  for (let round = 0; round < tokens.length; round += 1) {
    let changed = false;
    for (const match of code.matchAll(/let\s+(?:mut\s+)?(\w+)\s*(?::[^=;]+)?=\s*([^;]+);/g)) {
      const direct = /\ba\s*\[\s*(\d+)\s*\]/.exec(match[2]);
      const role = direct ? (argRoles[Number(direct[1])] || '') : (roles[match[2].trim()] || '');
      if (role && roles[match[1]] !== role) { roles[match[1]] = role; changed = true; }
    }
    if (!changed) break;
  }
  // Propagate simple constant aliases without depending on source formatting.
  for (let round = 0; round < tokens.length; round += 1) {
    let changed = false;
    for (let i = 0; i < tokens.length - 3; i += 1) {
      if (!['let', 'const', 'static'].includes(tokens[i])) continue;
      const id = tokens[i + 1] === 'mut' ? tokens[i + 2] : tokens[i + 1];
      const end = tokens.indexOf(';', i);
      const eq = tokens.indexOf('=', i);
      if (eq < 0 || end < eq || end - eq !== 2) continue;
      const value = numeric(tokens[eq + 1]) ?? aliases[tokens[eq + 1]];
      if (value !== undefined && aliases[id] !== value) { aliases[id] = value; changed = true; }
    }
    if (!changed) break;
  }
  const findings: LintFinding[] = [];
  function inspect(condition: string[], kind: string): void {
    let expression = condition.join(' ').replace(/\ba\s*\[\s*(\d+)\s*\]/g, (_text: string, index: string) => 'ARG_' + index);
    // Eliminate numeric layout indices before looking at comparisons.
    expression = expression.replace(/\[\s*\d+\s*\]/g, '[INDEX]');
    for (const match of expression.matchAll(/\b(\w+)\s*(==|!=|<=|>=|<|>)\s*(-?\s*(?:0x[\da-fA-F_]+|\d[\d_]*)(?:[ui](?:8|16|32|64|128|size))?)/g)) {
      const role = match[1].startsWith('ARG_') ? (argRoles[Number(match[1].slice(4))] || '') : (roles[match[1]] || '');
      const value = Number(match[3].replaceAll(' ', '').replaceAll('_', '').replace(/(?:[ui](?:8|16|32|64|128|size))$/, ''));
      const legitimateFd = role === 'fd' && ([-1, 0, 1, 2].includes(value) || value === 3 && ['<', '>='].includes(match[2]));
      const allowed = value === 0 || legitimateFd || role === 'nfds' && value === 16 || role === 'abi';
      const fixtureValue = watched.includes(value) || [1, 3, 4, 5, 8, 16, 32].includes(value);
      if (role && fixtureValue && !allowed) findings.push({ kind: 'argument-' + role, condition: condition.join(' '), constant: match[3] });
    }
    let bracket = 0;
    for (const token of condition) {
      if (token === '[') bracket += 1;
      if (token === ']') bracket -= 1;
      // A layout byte offset is not itself a predicate on a probe value.
      if (bracket || token === ']') continue;
      const value = numeric(token) ?? aliases[token];
      if (value !== undefined && watched.includes(value)) findings.push({ kind, condition: condition.join(' '), constant: token });
      if (/^(?:b)?"/.test(token) && /AAAAA|ping\\n|data\.bin/.test(token)) findings.push({ kind: 'fixture-bytes', condition: condition.join(' '), constant: token });
    }
  }
  for (let i = 0; i < tokens.length; i += 1) {
    if (['if', 'while', 'match'].includes(tokens[i])) {
      let end = i + 1;
      while (end < tokens.length && tokens[end] !== '{') end += 1;
      inspect(tokens.slice(i + 1, end), tokens[i]);
    }
    if (tokens[i] === '=>') {
      let start = i - 1;
      while (start >= 0 && !['{', '}', ',', ';'].includes(tokens[start])) start -= 1;
      inspect(tokens.slice(start + 1, i), 'match-arm');
    }
  }
  return findings;
}

export function requireNoProbeBranches(name: string, source: string): void {
  check(lintProbeConstants(name, source).length === 0, 'probe-constant branch rejected (fixture values must not determine behavior)');
}
