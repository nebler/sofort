import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  capture,
  check,
  dump,
  env,
  read,
  run,
  saveResult,
  sleep,
  StreamProcess,
  tool,
  type Json,
} from "./lib.ts";
interface Event {
  event: string;
  pid: number;
  n: number;
  lost: number;
  [key: string]: unknown;
}
export async function waitDeadlineR6(): Promise<void> {
  const root = "/home/dev/r6-shard";
  const binary = join(root, "arch/jitk/shard/target/release/real");
  const p = new StreamProcess(
    [binary, "hold", join(root, "final-r6"), "wait", "1024", "3"],
    { cwd: root },
  );
  const events: Event[] = [];
  let pid = 0;
  try {
    while (true) {
      const row = JSON.parse(await p.line(120)) as Event;
      events.push(row);
      if (row.event === "environment") {
        pid = row.pid;
      }
      if (row.event === "held") {
        break;
      }
    }
    function sample(): Record<string, string> {
      return {
        status: read("/proc/" + pid + "/status"),
        stat: read("/proc/" + pid + "/stat"),
        smaps: read("/proc/" + pid + "/smaps_rollup"),
        loadavg: read("/proc/loadavg"),
        uptime: read("/proc/uptime"),
      };
    }
    const a = sample();
    await sleep(1);
    const b = sample();
    check(
      a.status.includes("Threads:\t1\n") && b.status.includes("Threads:\t1\n"),
      "one R6 owner thread",
    );
    check((await p.wait(30)) === 0, "R6 holder exit");
    for (const line of p.queue) {
      events.push(JSON.parse(line) as Event);
    }
    const last = events[events.length - 1];
    check(
      last.event === "released" && last.n === 1024 && last.lost === 0,
      "R6 releases",
    );
    dump(join(root, "raw/wait-observed.json"), { events, samples: [a, b] });
  } finally {
    await p.cleanup();
  }
  const spin = new StreamProcess(
    [binary, "bench", join(root, "final-r6"), "spin", "1"],
    { cwd: root },
  );
  try {
    const first = await spin.line(120);
    check(
      (JSON.parse(first) as Event).event === "environment",
      "spin environment",
    );
    await sleep(0.2);
    const before = process.hrtime.bigint();
    spin.child.kill("SIGKILL");
    check((await spin.wait(2)) === -9, "external SIGKILL");
    const after = process.hrtime.bigint();
    dump(
      join(root, "raw/external-kill.json"),
      {
        returncode: spin.returncode,
        signal: "SIGKILL",
        observation: "external supervisor, not watchdog leases",
        kill_to_reap_ns: Number(after - before),
        delay_before_kill_s: 0.2,
        stdout: first + "\n",
        stderr: Buffer.concat(spin.stderr).toString(),
        loadavg: read("/proc/loadavg"),
      },
      false,
    );
  } finally {
    await spin.cleanup();
  }
}
export async function traceMemory(): Promise<void> {
  const root = String(process.env.JITK_NATIVE_ROOT);
  const real = join(root, "arch/jitk/shard/target/release/real");
  const results: Record<string, unknown>[] = [];
  for (const pair of [
    ["zstd-4m", "zstd"],
    ["micropython-2m", "micropython"],
    ["zstd-8m", "zstd"],
  ]) {
    const base = join(root, "trace-" + pair[0]);
    saveResult(
      await run([real, "prepare", base + ".bin", base]),
      join(root, "raw/trace-prepare-" + pair[0] + ".jsonl"),
    );
    const request = readFileSync(join(root, "ledger-" + pair[1] + ".request"));
    const size = Buffer.alloc(4);
    size.writeUInt32LE(request.length, 0);
    const p = await run([real, "native-worker", pair[1] + "=" + base], {
      input: Buffer.concat([size, request]),
      env: env({ JITK_NATIVE_DIAGNOSTICS: "1" }),
      timeout: 60,
    });
    saveResult(
      p,
      join(root, "raw/trace-" + pair[0] + ".response"),
      join(root, "raw/trace-" + pair[0] + ".stderr"),
    );
    const row = {
      profile: pair[0],
      worker_status: p.stdout.readUInt32LE(4),
      exit_code: p.stdout.readUInt32LE(8),
      stdout_bytes: p.stdout.readUInt32LE(12),
      stderr_bytes: p.stdout.readUInt32LE(16),
      limited: p.stdout.readUInt32LE(20),
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
  dump(join(root, "raw/memory-trace-results.json"), results);
}
function copyPilot(source: string, dest: string): void {
  mkdirSync(dest);
  for (const name of readdirSync(source)) {
    if (
      name.startsWith("target") ||
      name.startsWith("results-") ||
      name.startsWith("._") ||
      ["dist", "test-work", "test-results", "__pycache__"].includes(name)
    ) {
      continue;
    }
    const from = join(source, name);
    const to = join(dest, name);
    if (lstatSync(from).isDirectory()) {
      copyPilot(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}
export async function pilotBrk(): Promise<void> {
  const root = "/home/dev/r7-shard";
  const pilot = join(root, "pilot-kernel");
  copyPilot(join(root, "arch/jitk/kernel"), pilot);
  const page = join(pilot, "src/arch/aarch64/page_tables.rs");
  const original = read(page);
  for (const kb of [128, 256]) {
    writeFileSync(
      page,
      original.replace(
        "const BRK_BYTES: usize = 0x10000;",
        "const BRK_BYTES: usize = " + kb * 1024 + ";",
      ),
    );
    const out = join(root, "raw-pilot-brk" + kb);
    mkdirSync(out);
    const build = await run(["sh", "build-ring.sh"], {
      cwd: pilot,
      env: env({
        PATH: "/home/dev/.cargo/bin:" + process.env.PATH,
        RUSTUP_TOOLCHAIN: "stable",
      }),
    });
    writeFileSync(
      join(out, "kernel-build.log"),
      Buffer.concat([build.stdout, build.stderr]),
    );
    const binary = join(root, "arch/jitk/shard/target/release/real");
    const snapshot = "pilot-brk" + kb;
    saveResult(
      await run(
        [binary, "prepare", join(pilot, "dist/kernel-ring.bin"), snapshot],
        { cwd: root },
      ),
      join(out, "prepare.jsonl"),
    );
    for (const fixture of ["return2", "one_tool", "promise10", "canary"]) {
      saveResult(
        await run([binary, "bench", snapshot, fixture, "3"], { cwd: root }),
        join(out, "bench-" + fixture + ".jsonl"),
      );
    }
    await run(
      [
        "sudo",
        "-n",
        "env",
        "JITK_SHARD_THREADS=4",
        "JITK_LEDGER_ROOT=" + root,
        "JITK_LEDGER_CGROUP=/sys/fs/cgroup/r7-shard-pilot" + kb,
        "JITK_LEDGER_SNAPSHOT=" + snapshot,
        "JITK_LEDGER_OUTPUT=" + out,
        "JITK_LEDGER_FIXTURES=return2 one_tool promise10",
        "JITK_LEDGER_COUNTS=1,64",
        ...tool("ledger-r6"),
      ],
      { cwd: root, inherit: true },
    );
    await run(["sudo", "-n", "rmdir", "/sys/fs/cgroup/r7-shard-pilot" + kb]);
  }
}
