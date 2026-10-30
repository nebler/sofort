// Live GitHub REST access for capture scripts. The token comes from the
// logged-in `gh` CLI and is never recorded. Every request is counted so a
// capture can report how much of the rate limit it used.
import { execFileSync } from 'node:child_process';

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
    if ((response.status === 502 || response.status === 503) && attempt < 2) continue;
    return response;
  }
}

export async function getJson(path: string): Promise<unknown> {
  const response = await request(path, 'application/vnd.github+json');
  const body = await response.text();
  if (!response.ok) throw new Error('GitHub ' + response.status + ' for ' + path + ': ' + body.slice(0, 200));
  return JSON.parse(body);
}

export async function getText(path: string): Promise<{ status: number; text: string }> {
  const response = await request(path, 'application/vnd.github+json');
  return { status: response.status, text: await response.text() };
}

// Email addresses are the one personal field beyond public usernames that
// GitHub returns (commit author/committer emails, addresses typed into issue
// bodies). They are replaced in every string; nothing else is changed.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
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
