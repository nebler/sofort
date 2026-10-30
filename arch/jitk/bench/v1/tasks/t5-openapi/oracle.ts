// T5 oracle: reads the recorded community-profile and list-releases replies
// for BurntSushi/ripgrep and recomputes health, missing files and per-release
// download totals.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = ['code_of_conduct', 'contributing', 'issue_template', 'pull_request_template', 'license', 'readme'];

type Rec = Record<string, any>;
let cached:
  | { health: number; missing: string[]; releases: { tag: string; publishedAt: string; downloads: number }[] }
  | undefined;

function expected() {
  if (cached) return cached;
  let profile: Rec | undefined;
  let releases: Rec[] | undefined;
  for (const line of readFileSync(join(HERE, 'responses.jsonl'), 'utf8').split('\n')) {
    if (!line) continue;
    const call = JSON.parse(line);
    if (call.tool !== 'request' || call.error !== undefined) continue;
    const { path, query } = call.args[0];
    if (path === '/repos/BurntSushi/ripgrep/community/profile') profile = call.response.body;
    if (path === '/repos/BurntSushi/ripgrep/releases' && Number(query?.per_page) === 3) releases = call.response.body;
  }
  if (!profile || !releases) throw new Error('recording lacks the profile or the releases page');
  cached = {
    health: profile.health_percentage,
    missing: FILES.filter(name => profile.files[name] === null || profile.files[name] === undefined),
    releases: releases.map(r => ({
      tag: r.tag_name,
      publishedAt: r.published_at,
      downloads: r.assets.reduce((sum: number, a: Rec) => sum + a.download_count, 0),
    })),
  };
  return cached;
}

export function check(result: unknown): { ok: boolean; reason: string } {
  const want = expected();
  const got = result as { healthPercentage?: unknown; missingFiles?: unknown; releases?: Rec[] };
  if (!got || typeof got !== 'object') return { ok: false, reason: 'result is not an object' };
  if (got.healthPercentage !== want.health)
    return { ok: false, reason: `healthPercentage ${got.healthPercentage} != ${want.health}` };
  const missing = Array.isArray(got.missingFiles) ? [...got.missingFiles].sort() : null;
  if (JSON.stringify(missing) !== JSON.stringify([...want.missing].sort())) {
    return { ok: false, reason: `missingFiles ${JSON.stringify(got.missingFiles)} != ${JSON.stringify(want.missing)}` };
  }
  if (!Array.isArray(got.releases) || got.releases.length !== want.releases.length)
    return { ok: false, reason: 'expected 3 releases' };
  for (let i = 0; i < want.releases.length; i++) {
    for (const field of ['tag', 'publishedAt', 'downloads'] as const) {
      if (got.releases[i]?.[field] !== want.releases[i][field]) {
        return {
          ok: false,
          reason: `releases[${i}].${field} ${JSON.stringify(got.releases[i]?.[field])} != ${JSON.stringify(want.releases[i][field])}`,
        };
      }
    }
  }
  return {
    ok: true,
    reason: `health ${want.health}, ${want.missing.length} missing, ${want.releases.length} releases`,
  };
}

export default check;
