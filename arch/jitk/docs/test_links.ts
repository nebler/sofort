// Link check for the jitk docs (`make -C arch/jitk/docs test`): every relative
// markdown link in an arch/jitk/**/*.md file (tracked, or new and not ignored)
// must name such a file or directory, or a file moved to the evidence store
// (evidence/manifest.json), and every #anchor must match a heading (GitHub
// slug) or an explicit id in the target. URLs with a scheme are not fetched.
// Code spans and fenced blocks are skipped.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { git, readManifest, repoRoot } from '../tslib/evidence.ts';

const ROOT = repoRoot(import.meta.dirname);
const SCOPE = 'arch/jitk/';

// Tracked files plus new ones not yet added (but never ignored ones), as long
// as they exist in the working tree.
const tracked = new Set(git(ROOT, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(path => path && existsSync(join(ROOT, path))));
const manifest = readManifest(ROOT);
const known = new Set<string>(tracked);
for (const entry of manifest ? manifest.files : []) {
  known.add(entry.path);
}
const directories = new Set<string>();
for (const path of known) {
  for (let dir = dirname(path); dir !== '.' && !directories.has(dir); dir = dirname(dir)) {
    directories.add(dir);
  }
}

// Text with fenced blocks and code spans blanked, so their contents are
// neither links nor headings.
function prose(text: string): string[] {
  const lines = text.split('\n');
  let fence = '';
  return lines.map(line => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) {
        fence = marker[1][0];
        return '';
      }
      if (marker[1][0] === fence) {
        fence = '';
        return '';
      }
    }
    return fence ? '' : line.replace(/(`+)[^`]*?\1/g, '');
  });
}

// GitHub's heading anchors: lower case, punctuation dropped except - and _,
// spaces to hyphens, a -N suffix for repeats.
function anchors(path: string): Set<string> {
  const result = new Set<string>();
  const counts = new Map<string, number>();
  const raw = readFileSync(join(ROOT, path), 'utf8');
  for (const match of raw.matchAll(/<a\s+(?:name|id)="([^"]+)"/g)) {
    result.add(match[1]);
  }
  const lines = raw.split('\n');
  let fence = '';
  for (const line of lines) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (marker) {
      fence = !fence ? marker[1][0] : marker[1][0] === fence ? '' : fence;
      continue;
    }
    const heading = fence ? null : /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!heading) {
      continue;
    }
    const text = heading[1].replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '');
    const slug = text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
    const seen = counts.get(slug) || 0;
    counts.set(slug, seen + 1);
    result.add(seen ? slug + '-' + seen : slug);
  }
  return result;
}

const cache = new Map<string, Set<string>>();
function anchorsOf(path: string): Set<string> {
  let result = cache.get(path);
  if (!result) {
    result = anchors(path);
    cache.set(path, result);
  }
  return result;
}

function targets(lines: string[]): { line: number; target: string }[] {
  const found: { line: number; target: string }[] = [];
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      found.push({ line: index + 1, target: match[1] });
    }
    const definition = /^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(\s|$)/.exec(line);
    if (definition) {
      found.push({ line: index + 1, target: definition[1] });
    }
  });
  return found;
}

const problems: string[] = [];
let links = 0;
const docs = [...tracked].filter(path => path.startsWith(SCOPE) && path.endsWith('.md')).sort();
for (const doc of docs) {
  for (const { line, target } of targets(prose(readFileSync(join(ROOT, doc), 'utf8')))) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
      continue;
    }
    links += 1;
    const hash = target.indexOf('#');
    const file = decodeURIComponent(hash >= 0 ? target.slice(0, hash) : target).replace(/\?.*$/, '');
    const anchor = hash >= 0 ? decodeURIComponent(target.slice(hash + 1)) : '';
    const path = file ? normalize(join(dirname(doc), file)).replace(/\/+$/, '') : doc;
    const where = doc + ':' + line + ': ' + target;
    if (path.startsWith('..')) {
      problems.push(where + ' (leaves the repository)');
    } else if (!known.has(path) && !directories.has(path)) {
      problems.push(where + ' (no such tracked file, directory or evidence entry)');
    } else if (anchor && path.endsWith('.md') && tracked.has(path) && !anchorsOf(path).has(anchor)) {
      problems.push(where + ' (no heading #' + anchor + ' in ' + path + ')');
    }
  }
}
for (const problem of problems) {
  console.error('docs links: ' + problem);
}
console.log('docs links: ' + docs.length + ' files, ' + links + ' relative links, ' + problems.length + ' broken');
process.exitCode = problems.length ? 1 : 0;
