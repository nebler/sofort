// Writes every <task>/responses.jsonl (gitignored) from what is committed:
// responses.jsonl.gz for captured tasks, or generate.ts (seeded, deterministic)
// for synthetic ones. Each result is checked against manifest.json. Run it
// before check.ts or the harness driver.
//
//   node bench/v1/tasks/materialize.ts            write + verify
//   node bench/v1/tasks/materialize.ts --update   write + record new hashes
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { readTask, sha256, TASKS, taskIds } from './lib/tasks.ts';

interface ManifestEntry {
  file: string;
  bytes: number;
  sha256: string;
  from: string;
}

const MANIFEST = join(TASKS, 'manifest.json');
const update = process.argv.includes('--update');
const manifest: Record<string, ManifestEntry[]> = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : {};
let bad = 0;

function verify(id: string, file: string, from: string, data: Uint8Array) {
  const entry = { file, bytes: data.length, sha256: sha256(data), from };
  manifest[id] ??= [];
  const list = manifest[id];
  const index = list.findIndex(item => item.file === file);
  if (update) {
    if (index >= 0) list[index] = entry;
    else list.push(entry);
    return;
  }
  const want = list[index];
  if (!want) {
    console.log(`MISSING ${id}/${file}: not in manifest.json (run with --update)`);
    bad++;
  } else if (want.sha256 !== entry.sha256) {
    console.log(`MISMATCH ${id}/${file}: sha256 ${entry.sha256} != ${want.sha256}`);
    bad++;
  }
}

for (const id of taskIds()) {
  const task = readTask(id);
  const dir = join(TASKS, id);
  if (task.kind === 'sql') {
    const file = task.database ?? 'db.sqlite';
    verify(id, file, 'generate.ts', readFileSync(join(dir, file)));
    console.log(id, 'database', file, 'verified');
    continue;
  }
  const out = join(dir, 'responses.jsonl');
  let from: string;
  if (existsSync(join(dir, 'responses.jsonl.gz'))) {
    writeFileSync(out, gunzipSync(readFileSync(join(dir, 'responses.jsonl.gz'))));
    from = 'responses.jsonl.gz';
  } else if (existsSync(join(dir, 'generate.ts'))) {
    execFileSync(process.execPath, [join(dir, 'generate.ts')], { stdio: 'inherit' });
    from = 'generate.ts';
  } else {
    throw new Error(id + ': neither responses.jsonl.gz nor generate.ts');
  }
  const data = readFileSync(out);
  verify(id, 'responses.jsonl', from, data);
  console.log(id, 'responses.jsonl', data.length, 'bytes from', from);
}

if (update) {
  const sorted = Object.fromEntries(
    Object.keys(manifest)
      .sort()
      .map(id => [id, manifest[id]]),
  );
  writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
  console.log('manifest.json updated');
} else if (bad) {
  process.exit(1);
}
