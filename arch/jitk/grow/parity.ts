import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { check, detail, dump, equal, files, hashBytes, parseJSON, sha, stringify } from './lib.ts';
import { observe } from './observations.ts';

const TIMING = new Set(['seconds', 'wall_s', 'uptime', 'uptime_before', 'uptime_after', 'benchmark', 'load_gate', 'commit', 'controller_sha256']);
export function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonical(item)).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
  }
  return stringify(value, 0);
}
export function normalizeReceipt(value: unknown, roots: string[], repo: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeReceipt(item, roots, repo));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    if (record.discovery_kill_expected) {
      check(record.missing && (record.returncode === 0 || record.returncode === -9), 'unexpected discovery termination');
    }
    for (const key of Object.keys(record).sort()) {
      if (!TIMING.has(key)) {
        result[key] = record.discovery_kill_expected && key === 'returncode' ? 'completed-or-killed-after-first-miss' : normalizeReceipt(record[key], roots, repo);
      }
    }
    return result;
  }
  if (typeof value === 'string') {
    let text = value;
    for (const root of roots) {
      text = text.replaceAll(root, '<run>');
    }
    return text.replaceAll(repo, '<repo>').replace(/(?:\/private)?\/var\/folders\/[^\s"']+\/jitk-grow-[^/\s"']+/g, '<scratch>').replace(/\/tmp\/jitk-grow-[^/\s"']+/g, '<scratch>');
  }
  return value;
}
function verificationBytes(text: string): Buffer {
  const marker = '"verification": ';
  const start = text.indexOf(marker) + marker.length;
  check(start >= marker.length && text[start] === '{', 'verification object missing');
  let quoted = false;
  let escaped = false;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === '"') {
        quoted = false;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === '{' || c === '[') {
      depth += 1;
    } else if (c === '}' || c === ']') {
      depth -= 1;
      if (depth === 0) {
        return Buffer.from(text.slice(start, i + 1).replace(/^  /gm, '') + '\n');
      }
    }
  }
  throw new Error('unterminated verification');
}
function receipt(base: string, name: string, roots: string[], repo: string): unknown {
  const path = join(base, name);
  if (name.endsWith('.observations.json')) {
    const stem = path.slice(0, -'.observations.json'.length);
    let rawPath = stem + '.stdout';
    if (!existsSync(rawPath) && stem.endsWith('/integration')) {
      rawPath = stem + '-run.stdout';
    }
    const raw = readFileSync(rawPath);
    const stored = parseJSON(readFileSync(path, 'utf8'));
    check(equal(stored, observe(raw)), 'observation receipt lost evidence: ' + path);
    if (name.startsWith('before-')) {
      const lines: string[] = [];
      for (const line of raw.toString().split('\n')) {
        lines.push(line);
        const marker = line.indexOf('\x1e');
        if (marker >= 0 && (JSON.parse(line.slice(marker + 1)) as { kind?: string }).kind === 'missing') {
          break;
        }
      }
      return normalizeReceipt(observe(Buffer.from(lines.join('\n') + '\n')), roots, repo);
    }
    return normalizeReceipt(stored, roots, repo);
  }
  const text = readFileSync(path, 'utf8');
  const value = parseJSON(text);
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (record.verification_sha256 && record.verification) {
      check(hashBytes(verificationBytes(text)) === record.verification_sha256, 'invalid verification hash: ' + path);
      record.verification_sha256 = hashBytes(Buffer.from(canonical(normalizeReceipt(record.verification, roots, repo))));
    }
    if (name.endsWith('/heldout/sealed.json')) {
      const reference = join(dirname(path), 'oracle/linux-summary.json');
      check(sha(reference) === record.reference_sha256, 'invalid held-out reference hash: ' + path);
      record.reference_sha256 = hashBytes(Buffer.from(canonical(normalizeReceipt(parseJSON(readFileSync(reference, 'utf8')), roots, repo))));
    }
  }
  return normalizeReceipt(value, roots, repo);
}
export function compareReceipts(left: string, right: string, output: string, repo: string): boolean {
  const leftNames = files(left).filter((path) => path.endsWith('.json')).map((path) => relative(left, path));
  const rightNames = files(right).filter((path) => path.endsWith('.json')).map((path) => relative(right, path));
  const differences: unknown[] = [];
  if (!equal(leftNames, rightNames)) {
    differences.push({ file_set_difference: [...new Set([...leftNames, ...rightNames])].filter((name) => !leftNames.includes(name) || !rightNames.includes(name)) });
  }
  const hashes: Record<string, { python: string; typescript: string }> = {};
  const roots = [left, right];
  for (const name of leftNames.filter((name) => rightNames.includes(name))) {
    const a = receipt(left, name, roots, repo);
    const b = receipt(right, name, roots, repo);
    hashes[name] = { python: hashBytes(Buffer.from(canonical(a))), typescript: hashBytes(Buffer.from(canonical(b))) };
    if (!equal(a, b)) {
      differences.push({ file: name, python: a, typescript: b });
    }
  }
  mkdirSync(dirname(output), { recursive: true });
  dump(output, { status: differences.length ? 'FAIL' : 'PASS', python: left, typescript: right, json_receipts_compared: Object.keys(hashes).length, differences, normalized_sha256: hashes });
  console.log(differences.length ? 'FAIL' : 'PASS', Object.keys(hashes).length, 'JSON receipts;', differences.length, 'differences');
  return !differences.length;
}
