// Reruns every recorded Linux oracle run (oracle-store.ts) from its stored
// inputs and fails unless Linux still gives the recorded outcomes. Runs where
// Docker may run (CI's linux-oracle job), never on the Mac.
//
//   oracle-verify [--sealed] [--inputs-only]
//
// --sealed also checks the held-out store (JITK_ORACLE_SEALED). --inputs-only
// runs no Linux: it checks that every recording has its payload (in
// oracle-golden/payloads/ or JITK_ORACLE_PAYLOADS/<sha256>) and mounts, and that
// they hash to the recording's key. Payloads over 1 MiB are not in git; CI
// fetches them into JITK_ORACLE_PAYLOADS.
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, hashBytes, readJSON } from './lib.ts';
import { oracle } from './oracle.ts';
import { GOLDEN, mountHash, oracleKey, payloadPath, type Recorded, sealedStore } from './oracle-store.ts';

interface Config {
  argv: string[];
  expected_hex: string | null;
  stdin_hex: string;
  samples: number;
  injections: string[];
  annotate: boolean;
  memory_kib: number;
  root: string | null;
}

const args = process.argv.slice(2);
const inputsOnly = args.includes('--inputs-only');
const stores = [GOLDEN, ...(args.includes('--sealed') ? [sealedStore()] : [])];
let failures = 0;
let checked = 0;
for (const root of stores) {
  if (!existsSync(root)) continue;
  for (const key of readdirSync(root).sort()) {
    if (key === 'payloads' || !existsSync(join(root, key, 'recorded.json'))) continue;
    const dir = join(root, key);
    const recorded = readJSON<Recorded>(join(dir, 'recorded.json'));
    const config = recorded.inputs.config as Config;
    const label = (root === GOLDEN ? '' : 'sealed ') + key.slice(0, 12) + ' ' + config.argv.join(' ').slice(0, 60);
    try {
      check(oracleKey(recorded.inputs) === key, 'recorded inputs do not hash to the key');
      check(config.root === null, 'shared-tree recordings are not supported yet');
      const sha = recorded.inputs.payload_sha256;
      const payload = [payloadPath(root, sha), ...(process.env.JITK_ORACLE_PAYLOADS ? [join(process.env.JITK_ORACLE_PAYLOADS, sha)] : [])].find(existsSync);
      check(payload !== undefined, 'payload ' + sha + ' missing (over 1 MiB? set JITK_ORACLE_PAYLOADS)');
      check(hashBytes(readFileSync(payload!)) === sha, 'payload bytes do not match ' + sha);
      const mounts = recorded.inputs.mounts_sha256 === null ? undefined : join(dir, 'mounts');
      check(mounts === undefined || mountHash(mounts) === recorded.inputs.mounts_sha256, 'stored mounts do not hash to the recording');
      if (!inputsOnly) {
        process.env.JITK_ORACLE = 'verify';
        // Same store layout under a temp root, so verify finds the recording.
        const out = join(mkdtempSync(join(tmpdir(), 'oracle-verify-')), root === GOLDEN ? 'run' : 'heldout');
        await oracle(payload!, config.argv, out, config.expected_hex === null ? null : Buffer.from(config.expected_hex, 'hex'), {
          samples: config.samples,
          injections: config.injections,
          data: Buffer.from(config.stdin_hex, 'hex'),
          resources: mounts,
          annotate: config.annotate,
          memoryKib: config.memory_kib || undefined,
        });
      }
      checked++;
      console.log('OK   ' + label);
    } catch (error) {
      failures++;
      console.log('FAIL ' + label + ': ' + String(error).slice(0, 300));
    }
  }
}
console.log(`${checked} ${inputsOnly ? 'complete' : 'verified against Linux'}, ${failures} failed`);
if (failures) process.exit(1);
