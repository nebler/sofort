// Routable-command kill test: which real agent shell commands run unchanged on
// the promoted kernel. routable/workloads.json instantiates the most common
// argument shapes from the agent shell census on routable/fixture/; each runs
// once on Linux (oracle(), so replayed from grow/oracle-golden on the Mac and
// recorded in CI) and once in the guest, and must match byte for byte
// (stdout, stderr, exit). A shape is proven when every instance matches.
//
//   routable --run-id ID --artifacts DIR [--linux-only] [--only ID]...
//
// DIR holds the pinned binaries named by sha256 (routable/fetch.sh DIR).
// --linux-only runs only the Linux side: CI records with JITK_ORACLE=record.
// Writes results/<ID>/summary.json and proven.json, the input of
// arch/research/agent-fs/scripts/routable_census.py measure.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, utimesSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check, detail, dump, readJSON } from './lib.ts';
import { ROOT, build, checkHost, cleanup, copyKernel, hostCommand, processGuest, scratch, selectHost, sha } from './runtime.ts';
import { oracle } from './oracle.ts';
import { observe, outcome, type Outcome } from './observations.ts';
import { guestStdout } from '../scriptc-corpus/guest-output.ts';

interface Artifact {
  url: string;
  archive_sha256: string;
  member: string;
  sha256: string;
}

interface Workload {
  id: string;
  shape: string;
  artifact: string;
  argv: string[];
  stdin: string | null;
}

interface Workloads {
  artifacts: { [name: string]: Artifact };
  workloads: Workload[];
}

interface Result {
  id: string;
  shape: string;
  verdict: string; // match | mismatch | linux-only | build-failed | guest-failed | unrecorded
  linux: Outcome | null;
  guest: Outcome | null;
  missing: number[];
  registered_enosys: number[];
  detail: string;
}

interface Contract {
  nr: number;
  name: string;
}

// Fixture mtimes are pinned, so `ls -l` reads the same times on every host.
const FIXED_TIME = new Date('2026-01-01T00:00:00Z');

function pinTimes(path: string): void {
  if (statSync(path).isDirectory()) for (const name of readdirSync(path)) pinTimes(join(path, name));
  utimesSync(path, FIXED_TIME, FIXED_TIME);
}

// aarch64 numbers of syscalls the kernel may not register (for reports only).
const UNREGISTERED: [number, string][] = [[17, 'getcwd'], [23, 'dup'], [24, 'dup3'], [25, 'fcntl'], [29, 'ioctl'], [48, 'faccessat'], [61, 'getdents64'], [62, 'lseek'], [64, 'write'], [66, 'writev'], [67, 'pread64'], [71, 'sendfile'], [78, 'readlinkat'], [79, 'newfstatat'], [80, 'fstat'], [96, 'set_tid_address'], [98, 'futex'], [99, 'set_robust_list'], [101, 'nanosleep'], [113, 'clock_gettime'], [123, 'sched_getaffinity'], [124, 'sched_yield'], [129, 'kill'], [130, 'tkill'], [131, 'tgkill'], [132, 'sigaltstack'], [134, 'rt_sigaction'], [135, 'rt_sigprocmask'], [139, 'rt_sigreturn'], [144, 'setgid'], [146, 'setuid'], [160, 'uname'], [163, 'getrlimit'], [166, 'umask'], [167, 'prctl'], [172, 'getpid'], [173, 'getppid'], [174, 'getuid'], [175, 'geteuid'], [176, 'getgid'], [177, 'getegid'], [178, 'gettid'], [179, 'sysinfo'], [214, 'brk'], [215, 'munmap'], [216, 'mremap'], [220, 'clone'], [221, 'execve'], [222, 'mmap'], [226, 'mprotect'], [233, 'madvise'], [260, 'wait4'], [261, 'prlimit64'], [278, 'getrandom'], [291, 'statx'], [293, 'rseq']];

function names(): Map<number, string> {
  const manifest = readJSON<{ contracts: Contract[] }>(join(ROOT, '../kernel/syscalls.manifest.json'));
  const map = new Map<number, string>(UNREGISTERED);
  for (const c of manifest.contracts) map.set(c.nr, c.name);
  return map;
}

function brief(value: Outcome | null): string {
  if (value === null) return 'none';
  const text = (hex: string) => JSON.stringify(Buffer.from(hex, 'hex').toString('latin1').slice(0, 160));
  return 'exit=' + value.exit + ' stdout=' + text(value.stdout_hex) + ' stderr=' + text(value.stderr_hex);
}

async function main(argv: string[]): Promise<void> {
  let runId = '';
  let artifacts = '';
  let linuxOnly = false;
  const only: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--linux-only') {
      linuxOnly = true;
      continue;
    }
    check(['--run-id', '--artifacts', '--only'].includes(flag) && i + 1 < argv.length, 'usage: routable --run-id ID --artifacts DIR [--linux-only] [--only ID]...');
    const value = argv[++i];
    if (flag === '--run-id') runId = value;
    else if (flag === '--artifacts') artifacts = resolve(value);
    else only.push(value);
  }
  check(/^[A-Za-z0-9._-]+$/.test(runId) && !runId.includes('heldout'), '--run-id is required (letters, digits, . _ -)');
  check(artifacts !== '' && existsSync(artifacts), '--artifacts DIR is required (routable/fetch.sh DIR)');
  const spec = readJSON<Workloads>(join(ROOT, 'routable/workloads.json'));
  const workloads = spec.workloads.filter((w) => only.length === 0 || only.includes(w.id));
  check(workloads.length > 0, 'no workloads selected');
  const elves = new Map<string, string>();
  for (const [name, artifact] of Object.entries(spec.artifacts)) {
    const path = join(artifacts, artifact.sha256);
    check(existsSync(path) && sha(path) === artifact.sha256, name + ': missing or wrong binary ' + path);
    elves.set(name, path);
  }
  const out = join(ROOT, 'results', runId);
  check(!existsSync(out), 'results/' + runId + ' exists');
  mkdirSync(out, { recursive: true });
  const temporary = scratch('jitk-routable-');
  const resources = join(temporary, 'resources');
  cpSync(join(ROOT, 'routable/fixture'), resources, { recursive: true });
  pinTimes(resources);
  const slots = names();
  const results: Result[] = [];
  try {
    let work = '';
    if (!linuxOnly) {
      selectHost();
      work = join(temporary, 'kernel');
      copyKernel(work);
    }
    for (const w of workloads) {
      const dir = join(out, w.id);
      mkdirSync(dir);
      const elf = elves.get(w.artifact);
      check(elf !== undefined, w.id + ': unknown artifact ' + w.artifact);
      const data = w.stdin === null ? Buffer.alloc(0) : readFileSync(join(resources, w.stdin));
      const result: Result = { id: w.id, shape: w.shape, verdict: 'linux-only', linux: null, guest: null, missing: [], registered_enosys: [], detail: '' };
      try {
        result.linux = outcome((await oracle(elf!, w.argv, join(dir, 'linux'), null, { resources, data, stdinEof: true, payloadPath: w.artifact === 'busybox' ? '/busybox' : undefined }))[0]);
      } catch (error) {
        // A replay miss leaves the call in grow/.work/oracle-pending for CI; the
        // guest still runs, so its missing syscalls are known before then.
        check(!linuxOnly, detail(error));
        result.detail = 'no Linux reference: ' + detail(error).slice(0, 200);
      }
      if (!linuxOnly) {
        let image = '';
        try {
          image = await build(work, join(dir, 'image'), elf!, w.argv, resources);
        } catch (error) {
          result.verdict = 'build-failed';
          result.detail = detail(error).slice(0, 400);
        }
        if (image !== '') {
          const run = await processGuest(hostCommand(image), join(dir, 'guest'), data, 10, false);
          try {
            checkHost(run.info, run.err);
            const value = observe(run.raw);
            // Grow's probe observer drops blank lines by design; stdout comes from the
            // corpus's byte-exact decoder (exit, stderr and the trace from observe()).
            result.guest = { stdout_hex: guestStdout(run.raw).toString('hex'), stderr_hex: value.stderr_hex, exit: value.exit };
            result.missing = [...new Set(value.missing.map((r) => r.nr))].sort((a, b) => a - b);
            result.registered_enosys = [...new Set(value.registered_enosys.map((r) => r.nr))].sort((a, b) => a - b);
            if (result.linux === null) {
              result.verdict = 'unrecorded';
            } else {
              const linux = result.linux;
              const same = value.trace_complete && result.guest.exit === linux.exit && result.guest.stdout_hex === linux.stdout_hex && result.guest.stderr_hex === linux.stderr_hex;
              result.verdict = same ? 'match' : 'mismatch';
              if (!same) result.detail = (value.trace_complete ? '' : 'incomplete trace; ') + 'linux ' + brief(linux) + ' / guest ' + brief(result.guest);
            }
          } catch (error) {
            result.verdict = 'guest-failed';
            result.detail = detail(error).slice(0, 400);
          }
        }
      }
      dump(join(dir, 'result.json'), result);
      results.push(result);
      const missing = result.missing.map((nr) => slots.get(nr) ?? String(nr)).join(',');
      const enosys = result.registered_enosys.map((nr) => slots.get(nr) ?? String(nr)).join(',');
      console.log(result.verdict.padEnd(12) + ' ' + w.id.padEnd(9) + ' ' + w.shape + (missing ? '  missing=' + missing : '') + (enosys ? '  enosys=' + enosys : ''));
    }
  } finally {
    cleanup(temporary);
  }
  const shapes = [...new Set(workloads.map((w) => w.shape))];
  const proven = shapes.filter((s) => results.filter((r) => r.shape === s).every((r) => r.verdict === 'match'));
  const tally = new Map<string, number>();
  for (const r of results) tally.set(r.verdict, (tally.get(r.verdict) ?? 0) + 1);
  const missing = new Map<string, number>();
  for (const r of results) for (const nr of r.missing) missing.set(slots.get(nr) ?? String(nr), (missing.get(slots.get(nr) ?? String(nr)) ?? 0) + 1);
  dump(join(out, 'summary.json'), {
    run_id: runId,
    kernel_ready: readFileSync(join(ROOT, '../kernel/.READY'), 'utf8').trim().slice(0, 200),
    linux_only: linuxOnly,
    workloads: results.length,
    verdicts: Object.fromEntries(tally),
    shapes: shapes.length,
    proven_shapes: proven,
    missing_syscalls_by_workloads: Object.fromEntries([...missing].sort((a, b) => b[1] - a[1])),
    results,
  });
  dump(join(out, 'proven.json'), { label: 'proven on the kernel: ' + runId, shapes: proven });
  console.log(Object.entries(Object.fromEntries(tally)).map(([k, v]) => k + '=' + v).join(' ') + '; proven shapes ' + proven.length + '/' + shapes.length + ' -> results/' + runId);
}

main(process.argv.slice(2)).catch((error: unknown) => { console.error(detail(error)); process.exitCode = 1; });
