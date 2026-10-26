import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ROOT,
  canonical,
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
import { WORK } from "./build.ts";
export const OUT = canonical(
  process.env.JITK_LINUX_OUT ||
    join(ROOT, process.env.JITK_RECORD === "1" ? "out" : ".work/out"),
);
export function cpuAnalysis(): void {
  const reportPath = join(OUT, "report.json");
  const report = json(reportPath) as ObjectValue;
  const gates = nested(report, "gates");
  const rows: ObjectValue[] = [];
  for (const name of Object.keys(gates)) {
    const gate = object(gates[name]);
    if (!gate.cpu_ms_vm || Number(gate.n || 0) < 30) {
      continue;
    }
    const c = nested(gate, "cpu_ms_vm");
    const rawUser = num(c, "total") - num(c, "vmm_system");
    const residual = rawUser - num(c, "guest");
    rows.push({
      case: name,
      n: gate.n,
      label: "NESTED",
      vmm_user_including_guest_ms: rawUser,
      vmm_system_ms: c.vmm_system,
      vmm_total_ms: c.total,
      guest_estimate_ms: c.guest,
      host_user_residual_ms: residual,
      residual_is_exact: false,
      guest_counter_resolution_ms_vm: c.guest_resolution_ms_vm,
      negative_residual: residual < 0,
      outer_load: gate.outer_host_started_unix || null,
    });
  }
  const result = {
    label: "NESTED",
    performance: false,
    raw_report_sha256: sha(reportPath),
    status:
      "TOTAL_USER_SYSTEM_MEASURED; PRECISE_HOST_USER_GUEST_SPLIT_UNVERIFIED",
    warning:
      "Linux global guest ticks can include foreign workloads in the shared VM and do not close exactly with wait4 adjusted task user. Negative residuals are preserved in raw data, never treated as physical negative CPU. VMM user/system totals are measured; guest estimates and host-user residuals are UNVERIFIED, not an additive high-resolution profile. Tick resolution alone is not a sufficient error bound.",
    negative_residual_cases: rows
      .filter((r) => Boolean(r.negative_residual))
      .map((r) => r.case),
    rows,
  };
  dump(join(OUT, "cpu-analysis.json"), result);
  console.log(JSON.stringify(result, null, 2));
}
function loadDescription(gate: ObjectValue): string {
  const records = array(gate.rows || gate.samples || []);
  const first = records[0] || {};
  const inner =
    gate.uptime_before || first.uptime_before || first.uptime || "UNVERIFIED";
  const outer =
    object(
      gate.outer_host_started_unix ||
        gate.outer_host_ended_unix ||
        first.outer_host ||
        {},
    ).loadavg || "UNVERIFIED";
  const text = Array.isArray(outer)
    ? "[" + (outer as number[]).join(", ") + "]"
    : String(outer);
  return "inner: " + String(inner) + "; outer: " + text;
}
function cpuLine(name: string, gate: ObjectValue): string {
  const c = nested(gate, "cpu_ms_vm");
  const values = [
    num(c, "total") - num(c, "vmm_system"),
    num(c, "vmm_system"),
    num(c, "guest"),
    num(c, "total"),
  ];
  return (
    "| " +
    name +
    " | " +
    values.map((v) => v.toFixed(3)).join(" | ") +
    " | " +
    loadDescription(gate) +
    " |"
  );
}
export function summarizeLinux(): void {
  const r = json(join(OUT, "report.json")) as ObjectValue;
  const gates = nested(r, "gates");
  const lines = [
    "# Linux functional suite",
    "",
    "**" +
      str(r, "label") +
      " — non-performance data. Status: " +
      str(r, "status") +
      ".**",
    "",
    "Outer host: `" + str(r, "host_uptime") + "`",
    "",
    "| Gate | Result | Count | Wall s | p50 / p90 / p99 ms | Load |",
    "|---|---|---:|---:|---|---|",
  ];
  for (const name of Object.keys(gates)) {
    const g = object(gates[name]);
    const q = g.latency_ms ? nested(g, "latency_ms") : null;
    const latency = q
      ? ["p50", "p90", "p99"].map((k) => num(q, k).toFixed(3)).join(" / ")
      : "—";
    const count =
      g.completed !== undefined
        ? String(g.completed) + "/" + String(g.n)
        : g.exchanges !== undefined
          ? String(g.exchanges) + " exchanges"
          : String(g.completed_after_park || "—");
    lines.push(
      "| " +
        name +
        " | " +
        (g.pass ? "PASS" : "FAIL") +
        " | " +
        count +
        " | " +
        num(g, "elapsed_s").toFixed(3) +
        " | " +
        latency +
        " | " +
        loadDescription(g) +
        " |",
    );
  }
  lines.push(
    "",
    "Each gate’s inner uptime/load, samples, hashes and CPU accounting: `report.json`.",
    "Owned children remaining: " + str(r, "children_remaining") + ".",
    "",
    "## CPU-ms/VM (NESTED)",
    "",
    "| Case | VMM user including guest | VMM system | Guest estimate† | Total | Load |",
    "|---|---:|---:|---:|---:|---|",
  );
  for (const name of Object.keys(gates)) {
    const g = object(gates[name]);
    if (g.cpu_ms_vm) {
      lines.push(cpuLine(name, g));
    }
  }
  const controls = object(gates.cpu_controls || {});
  for (const row of array(controls.rows || [])) {
    lines.push(cpuLine(str(row, "mode"), row));
  }
  lines.push(
    "",
    "† Guest delta is Linux /proc/stat, tick-quantized and potentially includes foreign KVM workloads in the shared VM. Some guest/host-user residuals are negative: the counters do not close exactly. Precise host-user/guest attribution is UNVERIFIED; see cpu-analysis.json. The guest estimate is already included in user, not added again.",
    "CPU excludes supervisor, spawn wrapper, and L0 QEMU/HVF; this cannot decide the metal 5 CPU-ms kill line.",
  );
  let text = lines.join("\n") + "\n";
  if (gates.parking) {
    const p = object(gates.parking);
    text +=
      "\nParking image: `" +
      str(p, "image_sha256") +
      "`. Idle " +
      num(p, "idle_seconds").toFixed(6) +
      " s, VMM process CPU " +
      num(p, "idle_cpu_pct_core").toFixed(6) +
      "% core; high-resolution VMM cgroup CPU " +
      num(p, "idle_cgroup_cpu_pct_core").toFixed(6) +
      "% core. " +
      str(p, "exchanges") +
      "/1000 exchanges, " +
      str(p, "delayed_replies") +
      " delayed replies, " +
      str(p, "stalls") +
      " stalls. vCPU wait state: kvm_vcpu_block.\n";
  }
  writeFileSync(join(OUT, "report.md"), text);
}
export function collectReport(directory: string): void {
  const reports = read(join(directory, "nested.log"))
    .split("\n")
    .filter((line) => line.startsWith("JITK_REPORT "));
  check(reports.length > 0, "no report from nested guest");
  const report = JSON.parse(
    reports[reports.length - 1].slice("JITK_REPORT ".length),
  ) as ObjectValue;
  const loads = json(join(directory, "host-load.json")) as ObjectValue[];
  function nearest(time: number): ObjectValue {
    let best = loads[0];
    for (const row of loads) {
      if (
        Math.abs(num(row, "unix") - time) < Math.abs(num(best, "unix") - time)
      ) {
        best = row;
      }
    }
    return best;
  }
  const gates = nested(report, "gates");
  for (const name of Object.keys(gates)) {
    const gate = object(gates[name]);
    for (const key of ["started_unix", "ended_unix"]) {
      if (gate[key] !== undefined && loads.length > 0) {
        gate["outer_host_" + key] = nearest(num(gate, key));
      }
    }
    for (const row of [
      ...array(gate.rows || []),
      ...array(gate.samples || []),
    ]) {
      if (row.unix !== undefined && loads.length > 0) {
        row.outer_host = nearest(num(row, "unix"));
      }
    }
  }
  dump(join(directory, "report.json"), report, false);
  check(report.status === "PASS", String(report.error));
}
export function certify(): void {
  const path = join(OUT, "report.json");
  const r = json(path) as ObjectValue;
  const gates = nested(r, "gates");
  check(
    r.status === "PASS" && num(r, "children_remaining") === 0,
    "PASS and no remaining children",
  );
  check(num(object(gates.boot), "completed") >= 100, "100 boots");
  check(num(object(gates.one_tool), "completed") >= 30, "30 tool boots");
  check(
    num(object(gates.density), "completed_after_park") >= 256,
    "256 density",
  );
  for (let c = 1; c <= 8; c++) {
    check(
      num(object(gates["concurrency_" + c]), "completed") >= 100,
      "100 concurrent runs at " + c,
    );
  }
  const targets = items(object(gates.density), "rows").map((x) =>
    num(x, "parked"),
  );
  check(
    [1, 32, 64, 128, 256].every((n) => targets.includes(n)),
    "density targets",
  );
  const controls = items(object(gates.cpu_controls), "rows");
  check(
    controls.length === 2 &&
      controls.every(
        (x) =>
          ["setup_only", "bare_vm"].includes(str(x, "mode")) &&
          num(x, "n") === 100,
      ),
    "CPU controls",
  );
  check(
    num(object(gates.seccomp_kill), "completed") === 720,
    "720 seccomp kills",
  );
  check(
    num(object(gates.fault_guests), "completed") === 180,
    "180 fault guests",
  );
  check(
    Boolean(object(gates.parking).pass) &&
      num(object(gates.parking), "exchanges") === 1000,
    "1000 parking exchanges",
  );
  check(
    Boolean(object(gates.seccomp_kill).pass) &&
      Boolean(object(gates.fault_guests).pass),
    "containment gates",
  );
  dump(
    process.env.JITK_LINUX_READY ||
      (process.env.JITK_RECORD === "1"
        ? join(ROOT, ".READY")
        : join(OUT, "READY.json")),
    {
      created_utc: new Date().toISOString().replace("Z", "+00:00"),
      label: "NESTED",
      performance: false,
      backend: process.env.JITK_NESTED_BACKEND || "ssh",
      outer_linux_vcpus: r.online_cpus,
      parking_image_sha256: object(gates.parking).image_sha256,
      limitations: [
        "nested non-performance only",
        "second QEMU/HVF assertion spin remains; SSH replacement used by default",
        "shared VM guest CPU attribution unverified; see cpu-analysis.json beside report",
      ],
      report: path,
      report_sha256: sha(path),
      artifacts: r.hashes,
      canonical_build: json(join(WORK, "build.json")),
    },
  );
}
