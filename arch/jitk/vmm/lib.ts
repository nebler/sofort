import { spawn } from 'node:child_process';
import { check } from '../tslib/assert.ts';
import { sleep, track } from '../tslib/process.ts';
import { vmmBuildDir } from '../tslib/deps.ts';
import { join } from 'node:path';

// Shared helpers live in ../tslib; the VMM session and report formatting are vmm's.
export { check } from '../tslib/assert.ts';
export { digest as sha } from '../tslib/hash.ts';
export { readJSON, asciiJSON as json, dumpASCII as dump } from '../tslib/json.ts';
export { files } from '../tslib/fs.ts';
export { environment, sleep, track } from '../tslib/process.ts';
export { median } from '../tslib/stats.ts';
export { capture, run, output } from '../tslib/subprocess.ts';
export type { Result, Options } from '../tslib/subprocess.ts';

export function argument(name: string, fallback = ''): string {
  const index = process.argv.indexOf('--' + name);
  return index < 0 ? fallback : String(process.argv[index + 1]);
}

export class Session {
  child: ReturnType<typeof spawn>;
  stderr = '';
  private buffer = '';
  private lines: string[] = [];
  private ended = false;
  private closed: Promise<void>;
  constructor(command: string[]) {
    this.child = spawn(command[0], command.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });
    // Lifetime bound; sessions normally close within seconds.
    track(this.child, 3600);
    this.child.stdout!.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      let end = this.buffer.indexOf('\n');
      while (end >= 0) {
        this.lines.push(this.buffer.slice(0, end));
        this.buffer = this.buffer.slice(end + 1);
        end = this.buffer.indexOf('\n');
      }
    });
    this.child.stderr!.on('data', (data: Buffer) => { this.stderr += data.toString(); });
    this.child.stdin!.on('error', () => {});
    this.closed = new Promise<void>(resolve => {
      this.child.on('error', () => { this.ended = true; });
      this.child.on('close', () => { this.ended = true; resolve(); });
    });
  }
  async line(timeout = 30): Promise<string> {
    const end = performance.now() + timeout * 1000;
    while (this.lines.length === 0) {
      check(!this.ended && performance.now() < end, 'session EOF/timeout: ' + this.stderr);
      await sleep(1);
    }
    return this.lines.shift()!;
  }
  send(frame: unknown): void {
    this.child.stdin!.write(JSON.stringify(frame) + '\n');
  }
  async close(): Promise<void> {
    if (!this.ended) {
      this.child.kill('SIGKILL');
    }
    await this.closed;
    this.child.stdin!.destroy();
  }
}

export function fixed3(value: number): string {
  const rounded = Math.round(value * 1000);
  return String(Math.floor(rounded / 1000)) + '.' + String(rounded % 1000).padStart(3, '0');
}

// Defaults matching the Makefile: the cache VMM build (../tslib/deps.ts) and
// this checkout's .work/ test images and compiled profile.
export function defaultBinary(): string {
  return join(process.env.JITK_VMM_BUILD || vmmBuildDir(), 'jitk-vmm');
}
export function defaultImages(): string {
  return process.env.JITK_TEST_IMAGES || join(import.meta.dirname, '.work/test-images');
}
export function defaultProfile(): string {
  return join(import.meta.dirname, '.work/test.sbbin');
}
