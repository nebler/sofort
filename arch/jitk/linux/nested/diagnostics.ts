import { mkdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  capture,
  check,
  dump,
  read,
  sleep,
  StreamProcess,
  type ObjectValue,
} from "../lib.ts";
import {
  BASE,
  BIN,
  VM,
  cleanupCgroups,
  parking,
  setupCgroups,
} from "../suite.ts";
export async function parkingCheck(): Promise<void> {
  try {
    setupCgroups();
    const result = await parking();
    console.log("PARKING_REPORT " + JSON.stringify(result));
    process.exitCode = result.pass ? 0 : 1;
  } finally {
    await cleanupCgroups();
  }
}
export async function reproduce(): Promise<void> {
  setupCgroups();
  try {
    for (let i = 0; i < 200; i++) {
      console.log("REPRO_START " + i);
      const vm = new VM();
      try {
        await vm.ready();
        await vm.run();
      } finally {
        await vm.close();
      }
      console.log("REPRO_DONE " + i);
    }
  } finally {
    await cleanupCgroups();
  }
}
export async function preflight(): Promise<void> {
  const base = "/work";
  const cg = "/sys/fs/cgroup/jitk-05-preflight";
  mkdirSync(cg);
  const rows: ObjectValue[] = [];
  const p = await capture(
    [join(base, "spawn-cg"), cg, "/bin/sh", "-c", "cat /proc/self/cgroup"],
    { timeout: 30 },
  );
  check(
    p.returncode === 0 && p.stdout.toString().includes("jitk-05-preflight"),
    "CLONE_INTO_CGROUP",
  );
  rows.push({
    case: "CLONE_INTO_CGROUP",
    pass: true,
    stdout: p.stdout.toString(),
  });
  rmdirSync(cg);
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
      const probe = await capture(
        [join(base, "seccomp-probe"), join(base, role + ".bpf"), action],
        { timeout: 30 },
      );
      rows.push({
        role,
        action,
        rc: probe.returncode,
        expected,
        pass: probe.returncode === expected,
      });
    }
  }
  check(
    rows.every((r) => Boolean(r.pass)),
    "preflight gates",
  );
  console.log(
    "PREFLIGHT_PASS " +
      JSON.stringify({
        label: "NESTED",
        rows,
        uptime:
          read("/proc/uptime").trim() +
          " loadavg=" +
          read("/proc/loadavg").trim(),
      }),
  );
}
export async function cleanupChild(): Promise<void> {
  const root = "/sys/fs/cgroup/jitk-05-" + process.pid;
  mkdirSync(root);
  const cg = join(root, "escaped");
  mkdirSync(cg);
  const wrapper = new StreamProcess(["./spawn-cg", cg, "/bin/sleep", "60"]);
  let pids: number[] = [];
  for (let i = 0; i < 100; i++) {
    pids = read(join(cg, "cgroup.procs"))
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0)
      .map((s) => Number(s));
    if (pids.length) {
      break;
    }
    await sleep(0.01);
  }
  dump(
    "victims.json",
    { group: root, pids: [wrapper.child.pid, ...pids] },
    false,
  );
  process.on("SIGTERM", () => {});
  console.log('JITK_GATE {"gate":"injected_stall","event":"start"}');
  await sleep(60);
}
