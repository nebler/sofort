import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { cpus } from "node:os";
import {
  ROOT,
  array,
  capture,
  check,
  dump,
  env,
  items,
  json,
  kill,
  nested,
  num,
  object,
  read,
  run,
  sha,
  sleep,
  str,
  StreamProcess,
  type ObjectValue,
} from "./lib.ts";
import { clockTicks, kvmProbe, usage } from "./sys.ts";
export const BIN = resolve(process.env.JITK_BIN || join(ROOT, ".work"));
const IMAGE = join(BIN, "kernel.bin");
export const BASE = join(
  process.env.JITK_CGROUP_ROOT || "/sys/fs/cgroup",
  "jitk-05-" + process.pid,
);
const TIMEOUT = Number(process.env.JITK_TIMEOUT_S || 30);
export const LIVE = new Set<VM>();
let serial = 0;
let activeGate: string | null = null;
const LABEL = process.env.JITK_LABEL || "METAL";
const GATES: Record<string, ObjectValue> = {};
const REPORT: ObjectValue = {
  label: LABEL,
  performance_claim: LABEL !== "NESTED",
  status: "STARTED",
  gates: GATES,
  host_uptime: process.env.JITK_HOST_UPTIME || "UNVERIFIED",
};
const OUT =
  process.env.JITK_REPORT ||
  join(
    ROOT,
    process.env.JITK_RECORD === "1"
      ? "out/report.json"
      : ".work/out/report.json",
  );
export class TimeoutError extends Error {}
function now(): number {
  return performance.now() / 1000;
}
async function uptime(): Promise<string> {
  try {
    return (await run(["uptime"], { timeout: 5 })).stdout.toString().trim();
  } catch {
    return (
      "uptime_seconds=" +
      read("/proc/uptime").trim() +
      " loadavg=" +
      read("/proc/loadavg").trim()
    );
  }
}
function quant(values: number[]): ObjectValue | null {
  if (!values.length) {
    return null;
  }
  const a = values.slice().sort((x, y) => x - y);
  return {
    p50: a[Math.max(0, Math.ceil(0.5 * a.length) - 1)],
    p90: a[Math.max(0, Math.ceil(0.9 * a.length) - 1)],
    p99: a[Math.max(0, Math.ceil(0.99 * a.length) - 1)],
  };
}
function progress(completed: number, detail: string | null = null): void {
  if (activeGate !== null) {
    console.log(
      "JITK_GATE " +
        JSON.stringify({
          gate: activeGate,
          event: "progress",
          completed,
          detail,
        }),
    );
  }
}
function save(): void {
  mkdirSync(resolve(OUT, ".."), { recursive: true });
  dump(OUT, REPORT, false);
  const gates: Record<string, unknown> = {};
  for (const name of Object.keys(GATES)) {
    const row = GATES[name];
    gates[name] = row.completed ?? row.pass;
  }
  const density = array(REPORT.density_progress || []);
  console.log(
    "JITK_PROGRESS " +
      JSON.stringify({
        status: REPORT.status,
        gates,
        density: density.slice(-1),
      }),
  );
}
async function executeGate(
  name: string,
  action: () => Promise<ObjectValue>,
  passed: (r: ObjectValue) => boolean,
): Promise<void> {
  activeGate = name;
  const started = now();
  const unix = Date.now() / 1000;
  console.log(
    "JITK_GATE " + JSON.stringify({ gate: name, event: "start", unix }),
  );
  try {
    const data = await action();
    if (data.started_unix === undefined) {
      data.started_unix = unix;
    }
    data.elapsed_s = now() - started;
    if (data.ended_unix === undefined) {
      data.ended_unix = Date.now() / 1000;
    }
    const okay = passed(data);
    const row: ObjectValue = { pass: okay };
    for (const key of Object.keys(data)) {
      row[key] = data[key];
    }
    GATES[name] = row;
    save();
    if (name === "parking") {
      console.log("JITK_PARKING_DETAIL " + JSON.stringify(data));
    }
    check(okay, "gate failed: " + name);
  } catch (error) {
    if (!GATES[name]) {
      GATES[name] = {
        pass: false,
        started_unix: unix,
        ended_unix: Date.now() / 1000,
        elapsed_s: now() - started,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    throw error;
  } finally {
    console.log(
      "JITK_GATE " +
        JSON.stringify({
          gate: name,
          event: "end",
          elapsed_s: now() - started,
        }),
    );
    activeGate = null;
  }
}
function guestMs(): number {
  const fields = read("/proc/stat").split("\n")[0].trim().split(/\s+/);
  return (Number(fields[9]) * 1000) / clockTicks();
}
function cgstat(path: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const line of read(join(path, "cpu.stat")).trim().split("\n")) {
    const pair = line.split(/\s+/);
    result[pair[0]] = Number(pair[1]);
  }
  return result;
}
interface Usage {
  user_ms_including_guest: number;
  system_ms: number;
  guest_ticks: number;
  tick_hz: number;
}
interface Phase {
  name: string;
  value: number;
}
interface CpuPhase {
  name: string;
  user: number;
  system: number;
}
export class VM {
  cg: string;
  p: StreamProcess;
  frames: string[] = [];
  errors: string[] = [];
  ack = false;
  pid = 0;
  usage: Usage | null = null;
  phases: Phase[] = [];
  cpuPhases: CpuPhase[] = [];
  private errIndex = 0;
  private errPending = "";
  constructor(image = IMAGE, variables: Record<string, string> = {}) {
    serial++;
    this.cg = join(BASE, "vm-" + serial);
    mkdirSync(this.cg);
    writeFileSync(join(this.cg, "memory.max"), String(128 * 1024 ** 2));
    writeFileSync(join(this.cg, "memory.swap.max"), "0");
    this.p = new StreamProcess(
      [join(BIN, "spawn-cg"), this.cg, join(BIN, "jitk-vmm"), "--image", image],
      { env: env({ JITK_ROLES: "1", ...variables }) },
    );
    LIVE.add(this);
  }
  async pump(seconds: number): Promise<void> {
    if (!this.p.queue.length && !this.p.ended) {
      await sleep(seconds);
    }
    check(Buffer.byteLength(this.p.pending) <= 1048576, "frame exceeds 1 MiB");
    while (this.p.queue.length) {
      const line = String(this.p.queue.shift());
      check(Buffer.byteLength(line) <= 1048576, "frame exceeds 1 MiB");
      if (line.startsWith("\x1e")) {
        continue;
      }
      this.frames.push(line);
    }
    for (; this.errIndex < this.p.stderr.length; this.errIndex++) {
      const chunk = this.p.stderr[this.errIndex];
      if (chunk) {
        this.errPending += chunk.toString();
      }
    }
    check(Buffer.byteLength(this.errPending) <= 1048576, "frame exceeds 1 MiB");
    let index = this.errPending.indexOf("\n");
    while (index >= 0) {
      const line = this.errPending.slice(0, index);
      this.errPending = this.errPending.slice(index + 1);
      this.errors.push(line);
      if (line === '{"sandbox":"ok"}') {
        this.ack = true;
      } else if (line.startsWith("P ")) {
        this.pid = Number(line.slice(2));
      } else if (line.startsWith("R ")) {
        this.usage = JSON.parse(line.slice(2)) as Usage;
      } else if (line.startsWith("C ")) {
        const parts = line.split(" ");
        this.cpuPhases.push({
          name: parts[1],
          user: Number(parts[2]),
          system: Number(parts[3]),
        });
      } else if (line.startsWith("T ")) {
        const parts = line.split(" ");
        this.phases.push({ name: parts[1], value: Number(parts[2]) / 1e6 });
      }
      index = this.errPending.indexOf("\n");
    }
    // Consumed diagnostic bytes need not be retained throughout a density run.
    if (this.errIndex > 0) {
      this.p.stderr = [];
      this.errIndex = 0;
    }
  }
  async ready(): Promise<void> {
    const deadline = now() + TIMEOUT;
    let ready = false;
    while (now() < deadline) {
      await this.pump(0.001);
      while (this.frames.length) {
        const m = this.frames.shift();
        check(m === '{"t":"ready","v":1}', "bad READY: " + m);
        ready = true;
      }
      if (ready && this.ack) {
        const actual = read("/proc/" + this.pid + "/cgroup").trim();
        check(
          actual.includes(relative("/sys/fs/cgroup", this.cg)),
          "wrong cgroup " + actual,
        );
        return;
      }
      check(
        !this.p.ended,
        "died before ack+READY: rc=" +
          this.p.returncode +
          " " +
          this.errors.slice(-8).join("\n"),
      );
    }
    throw new TimeoutError("external watchdog: ack+READY");
  }
  send(message: ObjectValue): void {
    this.p.child.stdin!.write(JSON.stringify(message) + "\n");
  }
  async run(tool = false): Promise<void> {
    this.send({
      t: "run",
      code: tool ? "return await test.echo(41)" : "return 1+1",
      ns: tool ? { test: ["echo"] } : {},
    });
    const deadline = now() + TIMEOUT;
    let calls = 0;
    while (now() < deadline) {
      await this.pump(0.001);
      while (this.frames.length) {
        const text = this.frames.shift();
        if (text === undefined) {
          continue;
        }
        const message = JSON.parse(text) as ObjectValue;
        if (message.t === "call" && tool) {
          check(
            JSON.stringify(message) ===
              '{"t":"call","id":1,"ns":"test","fn":"echo","args":[41]}',
            "bad tool call",
          );
          calls++;
          this.send({ t: "ret", id: 1, ok: 42 });
        } else if (message.t === "done") {
          check(num(message, "ok") === (tool ? 42 : 2), "bad done value");
          check(calls === (tool ? 1 : 0), "tool call count");
          await this.finish();
          check(this.p.returncode === 0, "VMM exit: " + this.p.returncode);
          return;
        } else {
          throw new Error("unexpected frame " + JSON.stringify(message));
        }
      }
    }
    throw new TimeoutError("external watchdog: result");
  }
  async finish(timeout = TIMEOUT): Promise<void> {
    const deadline = now() + timeout;
    while (!this.p.ended && now() < deadline) {
      await this.pump(0.002);
    }
    if (!this.p.ended) {
      throw new TimeoutError("external watchdog: reap");
    }
    await this.pump(0);
  }
  async close(): Promise<void> {
    if (!LIVE.has(this)) {
      return;
    }
    if (!this.p.ended) {
      kill(this.p.child);
    }
    if (existsSync(join(this.cg, "cgroup.kill"))) {
      writeFileSync(join(this.cg, "cgroup.kill"), "1");
    }
    await this.p.wait(5);
    for (let i = 0; i < 100; i++) {
      try {
        rmdirSync(this.cg);
        break;
      } catch {
        await sleep(0.01);
      }
    }
    LIVE.delete(this);
  }
}
async function one(tool: boolean): Promise<ObjectValue> {
  const started = now();
  let v: VM | null = null;
  try {
    v = new VM(IMAGE, { JITK_TIME: "1" });
    await v.ready();
    const ready = (now() - started) * 1000;
    await v.run(tool);
    const phases: Record<string, number> = {};
    const cpuPhases: Record<string, ObjectValue> = {};
    for (const phase of v.phases) {
      phases[phase.name] = phase.value;
    }
    for (const phase of v.cpuPhases) {
      cpuPhases[phase.name] = {
        user_ms_including_guest: phase.user,
        system_ms: phase.system,
      };
    }
    return {
      ok: true,
      ms: (now() - started) * 1000,
      ready_ms: ready,
      usage: v.usage,
      phases_wall_ms: phases,
      phases_cpu_ms: cpuPhases,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stderr: v ? v.errors.slice(-12) : [],
    };
  } finally {
    if (v) {
      await v.close();
    }
  }
}
function totalUsage(rows: ObjectValue[], key: string): number {
  let total = 0;
  for (const row of rows) {
    if (row.usage) {
      total += num(nested(row, "usage"), key);
    }
  }
  return total;
}
async function batch(
  n: number,
  concurrency: number,
  tool = false,
): Promise<ObjectValue> {
  const started = Date.now() / 1000;
  const up = await uptime();
  const g = guestMs();
  const t = now();
  const parent0 = usage(false);
  const child0 = usage(true);
  const rows: ObjectValue[] = [];
  let next = 0;
  let failed = false;
  async function worker(): Promise<void> {
    while (next < n && !failed) {
      next++;
      const row = await one(tool);
      rows.push(row);
      if (rows.length % 10 === 0 || rows.length === n) {
        progress(rows.length);
      }
      if (!row.ok) {
        failed = true;
      }
    }
  }
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    jobs.push(worker());
  }
  await Promise.all(jobs);
  check(
    !failed,
    "batch failed after " +
      rows.length +
      "/" +
      n +
      ": " +
      JSON.stringify(rows.find((r) => !r.ok)),
  );
  const parent1 = usage(false);
  const child1 = usage(true);
  const elapsed = now() - t;
  const guest = guestMs() - g;
  const ok = rows.filter((r) => Boolean(r.ok));
  const count = ok.length;
  const user = totalUsage(ok, "user_ms_including_guest");
  const system = totalUsage(ok, "system_ms");
  return {
    started_unix: started,
    ended_unix: Date.now() / 1000,
    label: LABEL,
    n,
    concurrency,
    completed: count,
    uptime_before: up,
    uptime_after: await uptime(),
    elapsed_s: elapsed,
    latency_ms: quant(ok.map((r) => num(r, "ms"))),
    ready_ms: quant(ok.map((r) => num(r, "ready_ms"))),
    cpu_ms_vm: {
      vmm_user_excluding_guest: count ? (user - guest) / count : null,
      vmm_user_including_guest: count ? user / count : null,
      guest_attribution_status:
        "ESTIMATE; precise host-user/guest split UNVERIFIED; negative residuals possible",
      vmm_system: count ? system / count : null,
      guest: count ? guest / count : null,
      total: count ? (user + system) / count : null,
      supervisor: count ? ((parent1 - parent0) * 1000) / count : null,
      vmm_plus_clone_wrapper: count ? ((child1 - child0) * 1000) / count : null,
      guest_counter:
        "L1 /proc/stat guest delta; may include foreign KVM workloads; nominal tick resolution is not a complete error bound",
      guest_resolution_ms_vm: count
        ? (cpus().length * 1000) / clockTicks() / count
        : null,
    },
    samples: rows,
  };
}
async function density(targets: number[]): Promise<ObjectValue> {
  const vms: VM[] = [];
  const rows: ObjectValue[] = [];
  try {
    for (const target of targets) {
      const up = await uptime();
      while (vms.length < target) {
        const line =
          read("/proc/meminfo")
            .split("\n")
            .find((l) => l.startsWith("MemAvailable:")) || "";
        const available = Number(line.trim().split(/\s+/)[1]);
        const floor = LABEL === "NESTED" ? 128 * 1024 : 8 * 1024 ** 2;
        check(available >= floor, "density headroom: " + available + " KiB");
        const v = new VM();
        vms.push(v);
        await v.ready();
        if (vms.length % 16 === 0) {
          progress(vms.length, "parked READY");
        }
      }
      const before = cgstat(BASE);
      const t = now();
      await sleep(3);
      const dt = now() - t;
      const after = cgstat(BASE);
      const pss: number[] = [];
      for (const v of vms) {
        check(!v.p.ended, "parked VM exited");
        const line =
          read("/proc/" + v.pid + "/smaps_rollup")
            .split("\n")
            .find((l) => l.startsWith("Pss:")) || "";
        pss.push(Number(line.trim().split(/\s+/)[1]) * 1024);
      }
      const row: ObjectValue = {
        unix: Date.now() / 1000,
        parked: target,
        label: LABEL,
        uptime_before: up,
        uptime_after: await uptime(),
        idle_seconds: dt,
        idle_cpu_pct_core_vm:
          ((after.usage_usec - before.usage_usec) / 1e6 / dt / target) * 100,
        pss_bytes_vm: quant(pss),
        memory_current_sum: vms.reduce(
          (s, v) => s + Number(read(join(v.cg, "memory.current"))),
          0,
        ),
      };
      rows.push(row);
      REPORT.density_progress = rows;
      save();
      check(num(row, "idle_cpu_pct_core_vm") < 2, "idle CPU >=2%");
    }
    for (let i = 0; i < vms.length; i++) {
      await vms[i].run();
      if ((i + 1) % 16 === 0) {
        progress(Math.max(...targets) + i + 1, "validated after park");
      }
    }
    return { rows, completed_after_park: vms.length };
  } finally {
    for (const v of vms) {
      await v.close();
    }
  }
}
export async function containment(repetitions = 30): Promise<ObjectValue> {
  const rows: ObjectValue[] = [];
  for (const role of ["main", "vcpu", "console"]) {
    for (const action of [
      "exit",
      "openat",
      "socket",
      "execve",
      "kvm-create-vm",
      "kvm-run",
      "mmap-exec",
      "kill",
    ]) {
      const expected =
        action === "exit" || (role === "vcpu" && action === "kvm-run")
          ? 0
          : -31;
      const up = await uptime();
      for (let i = 0; i < repetitions; i++) {
        const p = await capture(
          [join(BIN, "seccomp-probe"), join(BIN, role + ".bpf"), action],
          { timeout: TIMEOUT },
        );
        rows.push({
          role,
          action,
          rc: p.returncode,
          pass: p.returncode === expected,
          uptime: up,
          unix: Date.now() / 1000,
        });
      }
      progress(rows.length, role + "/" + action);
    }
  }
  return {
    samples: rows,
    completed: rows.filter((r) => Boolean(r.pass)).length,
    n: rows.length,
    provenance:
      "Standalone syscall probe of exact canonical owner-07 sandbox module; canonical VMM tested separately for boot/tool/faults",
  };
}
async function faults(): Promise<ObjectValue> {
  const rows: ObjectValue[] = [];
  for (const name of [
    "unknown-hvc",
    "unknown-smc",
    "mmio-halfword",
    "bad-sysreg",
    "console_avail_oob",
    "rtc_oob_read",
  ]) {
    const up = await uptime();
    for (let i = 0; i < 30; i++) {
      const v = new VM(join(BIN, name + ".bin"));
      try {
        await v.finish(3);
        rows.push({
          case: name,
          rc: v.p.returncode,
          pass: [0, 1, 75].includes(Number(v.p.returncode)),
          stderr: v.errors.slice(-4),
          uptime: up,
          unix: Date.now() / 1000,
        });
      } catch (error) {
        if (!(error instanceof TimeoutError)) {
          throw error;
        }
        await v.close();
        rows.push({
          case: name,
          pass: v.p.returncode === -9,
          watchdog_killed: true,
          rc: v.p.returncode,
          deadline_s: 3,
          stderr: v.errors.slice(-4),
          uptime: up,
          unix: Date.now() / 1000,
        });
      } finally {
        await v.close();
      }
      progress(rows.length, name);
    }
    const cases = rows.filter((r) => r.case === name);
    console.log(
      "JITK_FAULT_CASE " +
        JSON.stringify({
          case: name,
          n: 30,
          pass: cases.filter((r) => Boolean(r.pass)).length,
          watchdog_kills: cases.filter((r) => Boolean(r.watchdog_killed))
            .length,
        }),
    );
  }
  return {
    samples: rows,
    completed: rows.filter((r) => Boolean(r.pass)).length,
    n: rows.length,
  };
}
function threadState(
  pid: number,
  names: string[],
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  const root = "/proc/" + pid + "/task";
  for (const tid of readdirSync(root)) {
    const values: Record<string, string> = {};
    for (const name of names) {
      const path = join(root, tid, name);
      if (existsSync(path)) {
        values[name] = read(path).trim();
      }
    }
    result[tid] = values;
  }
  return result;
}
export async function parking(): Promise<ObjectValue> {
  const r: ObjectValue = {
    label: LABEL,
    image_sha256: sha(IMAGE),
    started_unix: Date.now() / 1000,
    uptime_before: await uptime(),
    exchanges: 0,
    stalls: 0,
    delayed_replies: 0,
    vmm_user_sys_method:
      "/proc/PID/stat thread-group utime+stime, with VMM-only cgroup cpu.stat high-resolution cross-check",
  };
  const v = new VM(IMAGE);
  const rtt: number[] = [];
  async function receive(): Promise<ObjectValue> {
    const deadline = now() + TIMEOUT;
    while (now() < deadline) {
      if (v.frames.length) {
        return JSON.parse(String(v.frames.shift())) as ObjectValue;
      }
      await v.pump(0.001);
      check(
        !v.p.ended || v.frames.length > 0,
        "parking VMM exited " +
          v.p.returncode +
          ": " +
          v.errors.slice(-6).join("\n"),
      );
    }
    throw new TimeoutError("parking exchange watchdog");
  }
  function processCpu(): number {
    const text = read("/proc/" + v.pid + "/stat");
    const fields = text
      .slice(text.lastIndexOf(")") + 1)
      .trim()
      .split(/\s+/);
    return (Number(fields[11]) + Number(fields[12])) / clockTicks();
  }
  try {
    await v.ready();
    const before = processCpu();
    const cg0 = cgstat(v.cg);
    const t = now();
    await sleep(10);
    const elapsed = now() - t;
    const after = processCpu();
    const cg1 = cgstat(v.cg);
    r.idle_seconds = elapsed;
    r.idle_cpu_seconds = after - before;
    r.idle_cpu_pct_core = ((after - before) / elapsed) * 100;
    r.idle_cgroup_user_seconds = (cg1.user_usec - cg0.user_usec) / 1e6;
    r.idle_cgroup_system_seconds = (cg1.system_usec - cg0.system_usec) / 1e6;
    r.idle_cgroup_cpu_pct_core =
      ((cg1.usage_usec - cg0.usage_usec) / 1e6 / elapsed) * 100;
    r.idle_thread_state = threadState(v.pid, ["comm", "wchan"]);
    v.send({
      t: "run",
      code: 'for(let i=0;i<1000;i++) await test.echo(i); return "ok";',
      ns: { test: ["echo"] },
    });
    let start = process.hrtime.bigint();
    for (let i = 0; i < 1000; i++) {
      const m = await receive();
      check(
        JSON.stringify(m) ===
          JSON.stringify({
            t: "call",
            id: i + 1,
            ns: "test",
            fn: "echo",
            args: [i],
          }),
        "parking call " + i,
      );
      rtt.push(Number(process.hrtime.bigint() - start) / 1e3);
      if ((i + 1) % 100 === 0) {
        await sleep(0.003);
        r.delayed_replies = num(r, "delayed_replies") + 1;
      }
      start = process.hrtime.bigint();
      v.send({ t: "ret", id: i + 1, ok: i });
      r.exchanges = i + 1;
      if ((i + 1) % 100 === 0) {
        progress(i + 1, "tool exchanges");
      }
    }
    check(
      JSON.stringify(await receive()) === '{"t":"done","ok":"ok"}',
      "parking done",
    );
    await v.finish();
    check(v.p.returncode === 0, "parking exit");
    r.pass =
      num(r, "idle_cpu_pct_core") < 2 && num(r, "idle_cgroup_cpu_pct_core") < 2;
  } catch (error) {
    r.pass_ = false;
    r.error = error instanceof Error ? error.message : String(error);
    r.stalls = error instanceof TimeoutError ? 1 : 0;
    r.pass = false;
    if (v.pid && existsSync("/proc/" + v.pid + "/task")) {
      r.thread_state = threadState(v.pid, ["stat", "wchan"]);
    }
  } finally {
    await v.close();
  }
  r.rtt_us = quant(rtt);
  r.ended_unix = Date.now() / 1000;
  r.uptime_after = await uptime();
  return r;
}
async function cpuControls(): Promise<ObjectValue> {
  const rows: ObjectValue[] = [];
  for (const mode of ["setup_only", "bare_vm"]) {
    const up = await uptime();
    const g = guestMs();
    const samples: ObjectValue[] = [];
    for (let i = 0; i < 100; i++) {
      serial++;
      const cg = join(BASE, "control-" + serial);
      mkdirSync(cg);
      const image = mode === "setup_only" ? IMAGE : join(BIN, "kk.bin");
      const p = await capture(
        [
          join(BIN, "spawn-cg"),
          cg,
          join(BIN, "jitk-vmm"),
          "--image",
          image,
          ...(mode === "setup_only" ? ["--wait-go"] : []),
        ],
        { timeout: TIMEOUT },
      );
      const expected = mode === "setup_only" ? 70 : 0;
      const text = p.stderr.toString();
      const record = text.split("\n").find((line) => line.startsWith("R "));
      samples.push({
        pass: p.returncode === expected,
        rc: p.returncode,
        usage: record ? (JSON.parse(record.slice(2)) as ObjectValue) : null,
        stderr: p.returncode !== expected ? text.slice(-500) : "",
      });
      rmdirSync(cg);
      if ((i + 1) % 10 === 0) {
        progress(rows.length * 100 + i + 1, mode);
      }
    }
    const guest = guestMs() - g;
    check(
      samples.every((r) => Boolean(r.pass) && Boolean(r.usage)),
      "CPU control samples",
    );
    const user =
      totalUsage(samples, "user_ms_including_guest") / samples.length;
    const system = totalUsage(samples, "system_ms") / samples.length;
    rows.push({
      mode,
      n: samples.length,
      unix: Date.now() / 1000,
      uptime_before: up,
      uptime_after: await uptime(),
      cpu_ms_vm: {
        vmm_user_excluding_guest: user - guest / samples.length,
        vmm_system: system,
        guest: guest / samples.length,
        total: user + system,
      },
      samples,
    });
  }
  return { rows };
}
export function setupCgroups(): void {
  writeFileSync(join(BASE, "../cgroup.subtree_control"), "+memory +cpu");
  mkdirSync(BASE);
  writeFileSync(join(BASE, "cgroup.subtree_control"), "+memory +cpu");
}
export async function cleanupCgroups(): Promise<void> {
  for (const v of Array.from(LIVE)) {
    await v.close();
  }
  if (existsSync(BASE)) {
    rmdirSync(BASE);
  }
}
export async function suiteMain(): Promise<void> {
  let interrupted = false;
  const stop = (): void => {
    interrupted = true;
    for (const v of LIVE) {
      kill(v.p.child);
    }
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  try {
    REPORT.uptime_start = await uptime();
    const uname = (await run(["uname", "-s", "-n", "-r", "-v", "-m"])).stdout
      .toString()
      .trim()
      .split(" ");
    REPORT.uname = [
      uname[0],
      uname[1],
      uname[2],
      uname.slice(3, -1).join(" "),
      uname[uname.length - 1],
    ];
    REPORT.hashes = {
      "jitk-vmm": sha(join(BIN, "jitk-vmm")),
      "spawn-cg": sha(join(BIN, "spawn-cg")),
      "kernel.bin": sha(IMAGE),
    };
    REPORT.online_cpus = cpus().length;
    REPORT.cpu_attribution =
      "Shared nested VM: global guest ticks may include foreign KVM workloads. VMM wait4 user+system totals remain measured; host-user/guest split is UNVERIFIED.";
    check(kvmProbe() === 12, "KVM API version and VM creation");
    setupCgroups();
    await executeGate("parking", parking, (r) => Boolean(r.pass));
    await executeGate(
      "smoke",
      () => batch(1, 1),
      (r) => num(r, "completed") === 1,
    );
    await executeGate(
      "tool_smoke",
      () => batch(1, 1, true),
      (r) => num(r, "completed") === 1,
    );
    await executeGate(
      "boot",
      () => batch(Number(process.env.JITK_BOOT_N || 100), 1),
      (r) => num(r, "completed") === num(r, "n"),
    );
    await executeGate(
      "one_tool",
      () => batch(30, 1, true),
      (r) => num(r, "completed") === 30,
    );
    for (let c = 1; c <= Number(process.env.JITK_MAX_CONCURRENCY || 8); c++) {
      const concurrency = c;
      await executeGate(
        "concurrency_" + c,
        () => batch(Number(process.env.JITK_SWEEP_N || 100), concurrency),
        (r) => num(r, "completed") === num(r, "n"),
      );
    }
    await executeGate(
      "density",
      () =>
        density(
          (process.env.JITK_DENSITY || "1,32,64,128,256")
            .split(",")
            .map((s) => Number(s)),
        ),
      (r) =>
        num(r, "completed_after_park") ===
        Math.max(...items(r, "rows").map((x) => num(x, "parked"))),
    );
    await executeGate("cpu_controls", cpuControls, (r) => true);
    await executeGate(
      "seccomp_kill",
      () => containment(),
      (r) => num(r, "completed") === num(r, "n"),
    );
    await executeGate(
      "fault_guests",
      faults,
      (r) => num(r, "completed") === num(r, "n"),
    );
    check(!interrupted, "interrupted");
    REPORT.status = "PASS";
  } catch (error) {
    REPORT.status = "FAILED";
    REPORT.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await cleanupCgroups();
    REPORT.children_remaining = LIVE.size;
    REPORT.uptime_end = await uptime();
    save();
    console.log("JITK_REPORT " + JSON.stringify(REPORT));
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
  }
}
