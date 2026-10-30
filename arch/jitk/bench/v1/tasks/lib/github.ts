// Live GitHub REST access for capture scripts. The token comes from the
// logged-in `gh` CLI and is never recorded. Every request is counted so a
// capture can report how much of the rate limit it used.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let token = '';
export let requests = 0;

function auth(): string {
  if (!token) token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  return token;
}

export function query(params: Record<string, unknown>, skip: string[]): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (skip.includes(key) || value === undefined) continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? '?' + text : '';
}

async function request(path: string, accept: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    requests++;
    const response = await fetch('https://api.github.com' + path, {
      headers: {
        accept,
        authorization: 'Bearer ' + auth(),
        'x-github-api-version': '2022-11-28',
        'user-agent': 'sofort-bench-capture',
      },
    });
    const remaining = Number(response.headers.get('x-ratelimit-remaining') ?? '1000');
    if (remaining < 200) throw new Error('rate limit nearly used up: ' + remaining + ' left');
    if ((response.status === 502 || response.status === 503) && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      continue;
    }
    return response;
  }
}

export interface Fetched {
  status: number;
  text: string;
  ms: number;
}

// Raw responses are kept under .work/github-cache/ (gitignored): a re-run of
// a capture script reuses them, with their original latency, instead of
// spending rate limit. Delete the directory to re-record from scratch.
const CACHE = join(dirname(dirname(fileURLToPath(import.meta.url))), '.work', 'github-cache');

// When the data was fetched from GitHub (first and last request, cached or not).
export const window = { first: '', last: '', paths: new Set<string>() };
function seen(at: string) {
  if (!window.first || at < window.first) window.first = at;
  if (!window.last || at > window.last) window.last = at;
}

export async function fetchTimed(path: string): Promise<Fetched> {
  const file = join(CACHE, createHash('sha256').update(path).digest('hex') + '.json');
  window.paths.add(path);
  if (existsSync(file)) {
    seen(statSync(file).mtime.toISOString());
    return JSON.parse(readFileSync(file, 'utf8')) as Fetched;
  }
  seen(new Date().toISOString());
  const started = performance.now();
  const response = await request(path, 'application/vnd.github+json');
  const text = await response.text();
  const fetched = { status: response.status, text, ms: Math.round((performance.now() - started) * 10) / 10 };
  if (fetched.status === 200) {
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(file, JSON.stringify({ path, ...fetched }));
  }
  return fetched;
}

export async function getJson(path: string): Promise<{ value: any; ms: number }> {
  const fetched = await fetchTimed(path);
  if (fetched.status !== 200) {
    throw new Error('GitHub ' + fetched.status + ' for ' + path + ': ' + fetched.text.slice(0, 200));
  }
  return { value: JSON.parse(fetched.text), ms: fetched.ms };
}

// Email addresses are the one personal field beyond public usernames that
// GitHub returns (commit author/committer emails, addresses typed into issue
// bodies). They are replaced in every string; nothing else is changed.
const EMAIL = /[A-Za-z0-9._%+[\]-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
export const REDACTED = 'redacted@example.invalid';

export function scrub<T>(value: T): T {
  if (typeof value === 'string') return value.replace(EMAIL, REDACTED) as T;
  if (Array.isArray(value)) return value.map(item => scrub(item)) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = scrub(item);
    return out as T;
  }
  return value;
}
