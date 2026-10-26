import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dump, readJSON } from './lib.ts';
import { ASSETS, capture, run } from './runtime.ts';
import { type Outcome } from './observations.ts';

export interface OracleOptions {
  samples?: number;
  injections?: string[];
  data?: Buffer;
  resources?: string;
}
export type Oracle = (elf: string, argv: string[], out: string, expected: Buffer | null, options?: OracleOptions) => Promise<Outcome[]>;

export const oracle: Oracle = async (elf, argv, out, expected, options = {}) => {
  out = resolve(out);
  mkdirSync(out, { recursive: true });
  dump(join(out, 'oracle-config.json'), { argv, expected_hex: expected === null ? null : expected.toString('hex'), stdin_hex: (options.data ?? Buffer.from('ping\n')).toString('hex'), samples: options.samples ?? 1, injections: options.injections || [] });
  const info = await run(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{json .}}']);
  writeFileSync(join(out, 'oracle-image.json'), info.stdout);
  const container = 'jitk-08-' + process.pid + '-' + Date.now();
  const command = ['docker', 'run', '--rm', '-i', '--name', container, '--platform', 'linux/arm64', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '16', '--memory', '512m', '--cpus', '1', '--user', '65534:65534', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m', '-v', `${resolve(elf)}:/payload:ro`, '-v', `${ASSETS}/oracle:/oracle:ro`, '-v', `${out}:/out:rw`];
  if (options.resources) {
    for (const child of readdirSync(options.resources).sort()) {
      command.push('-v', `${realpathSync(join(options.resources, child))}:/${child}:ro`);
    }
  }
  command.push('--entrypoint', 'python3', 'jitk-oracle:08', '-B', '/oracle/run_profile.py');
  try {
    const result = await run(command, { timeout: 90 });
    writeFileSync(join(out, 'driver.stdout'), result.stdout);
    writeFileSync(join(out, 'driver.stderr'), result.stderr);
  } finally {
    await capture(['docker', 'rm', '-f', container], { timeout: 10 });
  }
  return readJSON<Outcome[]>(join(out, 'linux-summary.json'));
};
