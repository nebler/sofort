import { join } from "node:path";
import {
  ROOT,
  array,
  check,
  dump,
  items,
  json,
  nested,
  num,
  object,
  read,
  sha,
  str,
  type ObjectValue,
} from "./lib.ts";
export function analyzeR7(): void {
  const root = process.env.JITK_R7_ROOT || join(ROOT, "out/r7");
  const expected = [
    "parking",
    "smoke",
    "tool_smoke",
    "boot",
    "one_tool",
    ...Array.from({ length: 8 }, (_, i) => "concurrency_" + (i + 1)),
    "density",
    "cpu_controls",
    "seccomp_kill",
    "fault_guests",
  ];
  const runs: Record<string, ObjectValue> = {};
  for (const name of ["final-1", "final-2"]) {
    const directory = join(root, name);
    const report = json(join(directory, "report.json")) as ObjectValue;
    const timing = json(join(directory, "run-timing.json")) as ObjectValue;
    const staged = json(join(directory, "nested-command.json")) as ObjectValue;
    const ready = json(join(directory, "READY.json")) as ObjectValue;
    const gates = nested(report, "gates");
    check(
      report.status === "PASS" && num(report, "children_remaining") === 0,
      "report PASS and cleanup",
    );
    check(
      !report.performance_claim && report.label === "NESTED",
      "NESTED only",
    );
    check(
      JSON.stringify(Object.keys(gates)) === JSON.stringify(expected) &&
        Object.values(gates).every((g) => Boolean(object(g).pass)),
      "17 gates in order",
    );
    check(
      ready.report_sha256 === sha(join(directory, "report.json")),
      "ready report digest",
    );
    check(
      num(object(gates.smoke), "completed") === 1 &&
        num(object(gates.tool_smoke), "completed") === 1,
      "smokes",
    );
    check(
      num(object(gates.boot), "completed") === 100 &&
        num(object(gates.one_tool), "completed") === 30,
      "boot and tool count",
    );
    for (let n = 1; n <= 8; n++) {
      check(
        num(object(gates["concurrency_" + n]), "completed") === 100,
        "concurrency count",
      );
    }
    const parking = object(gates.parking);
    check(
      num(parking, "exchanges") === 1000 &&
        num(parking, "delayed_replies") === 10 &&
        num(parking, "stalls") === 0,
      "parking counts",
    );
    const density = object(gates.density);
    check(
      JSON.stringify(items(density, "rows").map((r) => num(r, "parked"))) ===
        "[1,32,64,128,256]",
      "density targets",
    );
    check(num(density, "completed_after_park") === 256, "density completion");
    const controls = items(object(gates.cpu_controls), "rows");
    check(
      controls.length === 2 &&
        controls.every(
          (r) =>
            ["setup_only", "bare_vm"].includes(str(r, "mode")) &&
            num(r, "n") === 100,
        ),
      "CPU controls",
    );
    const seccomp = items(object(gates.seccomp_kill), "samples");
    check(
      seccomp.length === 720 && seccomp.every((r) => Boolean(r.pass)),
      "720 seccomp probes",
    );
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
        check(
          seccomp.filter((r) => r.role === role && r.action === action)
            .length === 30,
          "30 probes per role/action",
        );
      }
    }
    const faults = items(object(gates.fault_guests), "samples");
    check(
      faults.length === 180 && faults.every((r) => Boolean(r.pass)),
      "180 hostile guests",
    );
    for (const fixture of [
      "unknown-hvc",
      "unknown-smc",
      "mmio-halfword",
      "bad-sysreg",
      "console_avail_oob",
      "rtc_oob_read",
    ]) {
      check(
        faults.filter((r) => r.case === fixture).length === 30,
        "30 faults per case",
      );
    }
    check(
      faults.filter((r) => Boolean(r.watchdog_killed)).length === 30,
      "30 watchdog kills",
    );
    const start = items(timing, "events").find(
      (e) => e.gate === "suite_startup",
    );
    check(start !== undefined, "suite startup observed");
    const queue = num(object(start), "observer_elapsed_s");
    const loads = json(join(directory, "host-load.json")) as ObjectValue[];
    const walls: Record<string, unknown> = {};
    for (const key of Object.keys(gates)) {
      walls[key] = object(gates[key]).elapsed_s;
    }
    const load = loads.map((r) => (r.loadavg as number[])[0]);
    runs[name] = {
      status: report.status,
      implementation: name === "final-1" ? "1714909" : "bb668af",
      observer_wall_s: timing.wall_s,
      queue_s: queue,
      suite_after_lock_s: num(timing, "wall_s") - queue,
      gate_wall_s: walls,
      mac_load_1_min_max: Math.max(...load),
      mac_load_1_min_min: Math.min(...load),
      inner_uptime_before: report.uptime_start,
      inner_uptime_after: report.uptime_end,
      vm_hashes: report.hashes,
      staged_sha256: staged.source_sha256,
      watchdog_kills: 30,
      children_remaining: 0,
    };
  }
  check(
    JSON.stringify(runs["final-1"].vm_hashes) ===
      JSON.stringify(runs["final-2"].vm_hashes),
    "stable VM hashes",
  );
  const a = nested(runs["final-1"], "staged_sha256");
  const b = nested(runs["final-2"], "staged_sha256");
  const changed = Object.keys(a).filter((name) => a[name] !== b[name]);
  check(
    JSON.stringify(changed) === '["watch.py","seccomp-probe"]',
    "expected historical staged changes",
  );
  const comparison = json(
    join(root, "probe-binary-comparison.json"),
  ) as ObjectValue;
  const binaries = items(comparison, "binaries");
  check(
    Boolean(comparison.allocated_sections_identical) &&
      JSON.stringify(binaries[0].allocated_sections) ===
        JSON.stringify(binaries[1].allocated_sections),
    "identical probe allocated sections",
  );
  const result: ObjectValue = {
    status: "PASS",
    n_full_post_probe_fix_runs: 2,
    runs,
    changed_staged_files: changed,
  };
  for (const pair of [
    ["aggregate_command_wall_s", "aggregate-command.log"],
    ["direct_command_wall_s", "final-2-command.log"],
  ]) {
    const matches = Array.from(
      read(join(root, pair[1])).matchAll(/^real ([0-9.]+)$/gm),
    );
    result[pair[0]] = Number(matches[matches.length - 1][1]);
  }
  dump(join(root, "summary.json"), result);
  const displayed: ObjectValue = {};
  for (const key of Object.keys(result)) {
    if (key !== "runs") {
      displayed[key] = result[key];
    }
  }
  console.log(JSON.stringify(displayed, null, 2));
  for (const gate of expected) {
    console.log(
      "| " +
        gate +
        " | " +
        num(nested(runs["final-1"], "gate_wall_s"), gate).toFixed(3) +
        " | " +
        num(nested(runs["final-2"], "gate_wall_s"), gate).toFixed(3) +
        " |",
    );
  }
}
