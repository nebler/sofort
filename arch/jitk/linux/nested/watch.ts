import { ignoreHup, stdoutWritable } from "../sys.ts";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { loadavg } from "node:os";
import { check, dump, kill, read, run, sleep, StreamProcess } from "../lib.ts";
interface GateEvent {
  gate: string;
  event: string;
  completed?: number;
  observer_elapsed_s?: number;
  [key: string]: unknown;
}
interface Limits {
  startup_s: number;
  progress_s: number;
  gate_s: number;
  suite_s: number;
}
export interface WatchOptions {
  relay?: boolean;
  sampleLoad?: boolean;
  progressTimeout?: number;
  startupAllowance?: number;
  suiteAllowance?: number;
  suiteCgroups?: boolean;
}
export class DeadlineError extends Error {}
export class BrokenPipeError extends Error {}
function now(): number {
  return performance.now() / 1000;
}
function removeGroups(group: string): void {
  for (const name of readdirSync(group).sort().reverse()) {
    const path = join(group, name);
    if (statSync(path).isDirectory()) {
      removeGroups(path);
    }
  }
  rmdirSync(group);
}
export async function watchRun(
  command: string[],
  log: string,
  options: WatchOptions = {},
): Promise<number> {
  const limits: Limits = {
    startup_s:
      Number(process.env.JITK_STARTUP_TIMEOUT_S || 90) +
      (options.startupAllowance || 0),
    progress_s:
      options.progressTimeout ?? Number(process.env.JITK_GATE_TIMEOUT_S || 60),
    gate_s: Number(process.env.JITK_GATE_DEADLINE_S || 300),
    suite_s:
      Number(process.env.JITK_NESTED_TIMEOUT || 900) +
      (options.suiteAllowance || 0),
  };
  if (!Object.values(limits).every((value) => value > 0)) {
    throw new DeadlineError("watchdog deadlines must be positive");
  }
  mkdirSync(dirname(log), { recursive: true });
  const started = now();
  let lastProgress = started;
  let gateStarted = started;
  let gate = "startup";
  let completed = -1;
  const loads: { unix: number; loadavg: number[]; uptime: string }[] = [];
  const events: GateEvent[] = [];
  let error: string | null = null;
  let lastLoad = 0;
  let written = 0;
  let interrupted = false;
  const p = new StreamProcess([
    "/bin/sh",
    "-c",
    'exec "$@" 2>&1',
    "sh",
    ...command,
  ]);
  p.child.stdin!.end();
  const signalHandler = (): void => {
    interrupted = true;
  };
  process.on("SIGTERM", signalHandler);
  function flush(): void {
    if (options.relay && !stdoutWritable()) {
      throw new BrokenPipeError("[Errno 32] Broken pipe");
    }
    for (; written < p.stdout.length; written++) {
      if (options.relay) {
        const chunk = p.stdout[written];
        if (chunk !== undefined) {
          process.stdout.write(chunk);
        }
      }
    }
    // The log is persisted on every observation, including partial last lines.
    writeFileSync(log, Buffer.concat(p.stdout));
  }
  try {
    while (!p.ended || p.queue.length > 0) {
      if (interrupted) {
        throw new DeadlineError("watchdog interrupted by signal 15");
      }
      if (options.sampleLoad !== false && now() - lastLoad >= 1) {
        const uptime = (await run(["uptime"], { timeout: 5 })).stdout
          .toString()
          .trim();
        loads.push({ unix: Date.now() / 1000, loadavg: loadavg(), uptime });
        lastLoad = now();
      }
      flush();
      while (p.queue.length) {
        const line = String(p.queue.shift());
        if (!line.startsWith("JITK_GATE ")) {
          continue;
        }
        const event = JSON.parse(line.slice("JITK_GATE ".length)) as GateEvent;
        event.observer_elapsed_s = now() - started;
        events.push(event);
        if (event.event === "start") {
          gate = event.gate;
          gateStarted = now();
          lastProgress = gateStarted;
          completed = -1;
        } else if (event.gate === gate) {
          if (event.event === "end") {
            gate = "between gates / report / shutdown";
            gateStarted = now();
            lastProgress = gateStarted;
            completed = -1;
          } else if ((event.completed ?? -1) > completed) {
            completed = Number(event.completed);
            lastProgress = now();
          }
        }
      }
      const current = now();
      const idle = gate === "startup" ? limits.startup_s : limits.progress_s;
      if (current - lastProgress > idle) {
        throw new DeadlineError(
          "gate " +
            gate +
            ": no completed-work progress for " +
            idle +
            "s (last completed=" +
            completed +
            ")",
        );
      }
      if (current - gateStarted > limits.gate_s && gate !== "startup") {
        throw new DeadlineError(
          "gate " +
            gate +
            ": exceeded absolute " +
            limits.gate_s +
            "s deadline",
        );
      }
      if (current - started > limits.suite_s) {
        throw new DeadlineError(
          "suite exceeded " + limits.suite_s + "s deadline at gate " + gate,
        );
      }
      await sleep(0.02);
    }
    return await p.wait(5);
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    const kind =
      exc instanceof DeadlineError
        ? "TimeoutError"
        : exc instanceof BrokenPipeError
          ? "BrokenPipeError"
          : "Error";
    error = kind + "(" + JSON.stringify(message) + ")";
    console.error("JITK_TIMEOUT " + error + "; log=" + log);
    throw exc;
  } finally {
    process.removeListener("SIGTERM", signalHandler);
    if (!p.ended) {
      kill(p.child, "SIGTERM");
      try {
        await p.wait(5);
      } catch {
        await p.cleanup();
      }
    }
    // A closed SSH stream must not prevent owned-cgroup cleanup or receipts.
    writeFileSync(log, Buffer.concat(p.stdout));
    const group = "/sys/fs/cgroup/jitk-05-" + p.child.pid;
    if (options.suiteCgroups && existsSync(group)) {
      writeFileSync(join(group, "cgroup.kill"), "1");
      const until = now() + 5;
      while (read(join(group, "cgroup.events")).includes("populated 1")) {
        check(now() < until, "watchdog could not empty owned cgroup " + group);
        await sleep(0.05);
      }
      removeGroups(group);
    }
    dump(join(dirname(log), "run-timing.json"), {
      wall_s: now() - started,
      limits,
      error,
      returncode: p.returncode,
      events,
    });
    if (options.sampleLoad !== false) {
      dump(join(dirname(log), "host-load.json"), loads);
    }
  }
}
export async function watchCli(args: string[]): Promise<void> {
  check(
    args[0] === "--log" && args.length >= 3,
    "usage: watch --log FILE -- COMMAND...",
  );
  const command = args.slice(args[2] === "--" ? 3 : 2);
  ignoreHup();
  console.log(
    "JITK_GATE " + JSON.stringify({ gate: "suite_startup", event: "start" }),
  );
  try {
    process.exitCode = await watchRun(command, args[1], {
      relay: true,
      sampleLoad: false,
      suiteCgroups: true,
    });
  } catch (error) {
    if (error instanceof DeadlineError) {
      process.exitCode = 124;
    } else if (error instanceof BrokenPipeError) {
      process.exitCode = 120;
    } else {
      throw error;
    }
  }
}
