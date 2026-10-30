// T1 oracle: recomputes the triage answer from the recorded GitHub data
// (every recorded issue page and comment page), then compares field by field.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CUTOFF = '2026-09-30T00:00:00Z';
const LABEL = 'gh-extension';

interface Issue {
  number: number;
  title: string;
  comments: number;
  created_at: string;
  pull_request?: unknown;
  labels: { name: string }[];
}
interface Comment {
  id: number;
  created_at: string;
  user: { login: string } | null;
}
interface Row {
  number: number;
  title: string;
  comments: number;
  lastCommentAt: string | null;
  lastCommenter: string | null;
}

let expected: { cutoff: string; totalMatching: number; issues: Row[] } | undefined;

function compute() {
  const issues = new Map<number, Issue>();
  const comments = new Map<number, Map<number, Comment>>();
  for (const line of readFileSync(join(HERE, 'responses.jsonl'), 'utf8').split('\n')) {
    if (!line) continue;
    const call = JSON.parse(line);
    const args = call.args[0];
    if (call.tool === 'listIssues') {
      for (const issue of call.response as Issue[]) issues.set(issue.number, issue);
    } else if (call.tool === 'listIssueComments') {
      const seen = comments.get(args.issue_number) ?? new Map<number, Comment>();
      for (const comment of call.response as Comment[]) seen.set(comment.id, comment);
      comments.set(args.issue_number, seen);
    }
  }
  const cutoff = Date.parse(CUTOFF);
  const matching = [...issues.values()].filter(
    issue =>
      issue.pull_request === undefined &&
      issue.labels.some(label => label.name === LABEL) &&
      Date.parse(issue.created_at) < cutoff,
  );
  matching.sort((a, b) => {
    if (a.comments !== b.comments) return b.comments - a.comments;
    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
  const rows = matching.slice(0, 20).map(issue => {
    let last: Comment | undefined;
    for (const comment of comments.get(issue.number)?.values() ?? []) {
      const t = Date.parse(comment.created_at);
      if (!last || t > Date.parse(last.created_at) || (t === Date.parse(last.created_at) && comment.id > last.id)) {
        last = comment;
      }
    }
    if (issue.comments > 0 && !last) throw new Error('recording lacks the comments of #' + issue.number);
    return {
      number: issue.number,
      title: issue.title,
      comments: issue.comments,
      lastCommentAt: last ? last.created_at : null,
      lastCommenter: last ? (last.user?.login ?? null) : null,
    };
  });
  return { cutoff: CUTOFF, totalMatching: matching.length, issues: rows };
}

export function check(result: unknown): { ok: boolean; reason: string } {
  expected ??= compute();
  const got = result as { cutoff?: unknown; totalMatching?: unknown; issues?: unknown };
  if (!got || typeof got !== 'object') return { ok: false, reason: 'result is not an object' };
  if (typeof got.cutoff !== 'string' || Date.parse(got.cutoff) !== Date.parse(expected.cutoff)) {
    return { ok: false, reason: 'cutoff ' + JSON.stringify(got.cutoff) + ' != ' + expected.cutoff };
  }
  if (got.totalMatching !== expected.totalMatching) {
    return { ok: false, reason: 'totalMatching ' + got.totalMatching + ' != ' + expected.totalMatching };
  }
  if (!Array.isArray(got.issues) || got.issues.length !== expected.issues.length) {
    return { ok: false, reason: 'expected ' + expected.issues.length + ' issues' };
  }
  for (let i = 0; i < expected.issues.length; i++) {
    const want = expected.issues[i];
    const have = got.issues[i] as Record<string, unknown>;
    for (const field of ['number', 'title', 'comments', 'lastCommentAt', 'lastCommenter'] as const) {
      if (have?.[field] !== want[field]) {
        return {
          ok: false,
          reason: `issues[${i}].${field} ${JSON.stringify(have?.[field])} != ${JSON.stringify(want[field])}`,
        };
      }
    }
  }
  return { ok: true, reason: 'top ' + expected.issues.length + ' of ' + expected.totalMatching + ' match' };
}

export default check;
