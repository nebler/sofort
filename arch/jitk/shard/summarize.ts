import { readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  array,
  items,
  load,
  nested,
  num,
  numbers,
  object,
  type ObjectValue,
} from "./evidence.ts";
import { dump, read } from "./lib.ts";
function distribution(values: number[]): ObjectValue {
  const a = values.slice().sort((x, y) => x - y);
  const result: ObjectValue = { n: a.length };
  for (const p of [50, 95, 99]) {
    result["p" + p + "_us"] =
      a[Math.max(0, Math.ceil((a.length * p) / 100) - 1)] / 1000;
  }
  result.max_us = a[a.length - 1] / 1000;
  return result;
}
function mix(value: bigint): bigint {
  const mask = (1n << 64n) - 1n;
  let x = (value + 0x9e3779b97f4a7c15n) & mask;
  x = ((x ^ (x >> 30n)) * 0xbf58476d1ce4e5b9n) & mask;
  x = ((x ^ (x >> 27n)) * 0x94d049bb133111ebn) & mask;
  return x ^ (x >> 31n);
}
export function summarize(directory: string): void {
  for (const name of readdirSync(directory).sort()) {
    if (!name.endsWith(".jsonl") || name.endsWith("progress.jsonl")) {
      continue;
    }
    const records = read(join(directory, name))
      .split("\n")
      .filter((s) => s.trim().length > 0)
      .map((s) => JSON.parse(s) as ObjectValue);
    dump(join(directory, name.replace(/\.jsonl$/, ".json")), records, false);
  }
  const density: ObjectValue[] = [];
  const reset: ObjectValue[] = [];
  const wait: ObjectValue[] = [];
  const waitPooled: ObjectValue[] = [];
  const idle: ObjectValue[] = [];
  const pooled = new Map<number, { entry: number[]; finish: number[] }>();
  for (const name of readdirSync(directory).sort()) {
    if (
      !name.endsWith(".json") ||
      ["summary.json", "environment.json"].includes(name)
    ) {
      continue;
    }
    const text = read(join(directory, name));
    if (!text.trim().startsWith("[")) {
      continue;
    }
    const records = JSON.parse(text) as ObjectValue[];
    const base = records.find((r) => r.event === "density_baseline");
    const baseline = base ? nested(base, "metrics") : {};
    for (const r of records) {
      const event = r.event;
      if (event === "density") {
        const n = num(r, "n");
        const m = nested(r, "metrics");
        const mi = nested(m, "meminfo_kib");
        const b = nested(baseline, "meminfo_kib");
        const smaps = nested(m, "smaps_rollup_kib");
        const bs = nested(baseline, "smaps_rollup_kib");
        const pss = num(smaps, "Pss") - num(bs, "Pss");
        const pd = num(smaps, "Private_Dirty") - num(bs, "Private_Dirty");
        const delta = (key: string): number => num(mi, key) - num(b, key);
        density.push({
          source: name,
          n,
          global_available_delta_kib_per_vm: -delta("MemAvailable") / n,
          global_free_delta_kib_per_vm: -delta("MemFree") / n,
          process_pss_delta_kib_per_vm: pss / n,
          process_private_dirty_delta_kib_per_vm: pd / n,
          snapshot_private_dirty_kib_per_vm:
            num(nested(m, "snapshot_smaps_kib"), "Private_Dirty") / n,
          page_tables_delta_kib_per_vm: delta("PageTables") / n,
          sec_page_tables_delta_kib_per_vm: delta("SecPageTables") / n,
          sunreclaim_delta_kib_per_vm: delta("SUnreclaim") / n,
          ledger_sum_kib_per_vm:
            (pss +
              delta("PageTables") +
              delta("SecPageTables") +
              delta("SUnreclaim") +
              delta("KernelStack")) /
            n,
          fds: m.fds,
          threads: m.threads,
          create_cumulative_ms: num(r, "create_cumulative_ns") / 1e6,
          create_batch_ms: num(r, "create_batch_ns") / 1e6,
        });
      } else if (event === "reset") {
        const a = numbers(r, "reset_ns");
        const b = numbers(r, "host_pristine_verify_ns");
        const c = numbers(r, "guest_run_validate_ns");
        const baseline = nested(r, "baseline");
        const dirty = nested(r, "dirty");
        const after = nested(r, "after_discard");
        const privateDirty = (m: ObjectValue): number =>
          Number(nested(m, "snapshot_smaps_kib").Private_Dirty || 0);
        reset.push({
          source: name,
          iterations: r.iterations,
          k_max: r.k_max,
          reset: distribution(a),
          guest_run_validate: distribution(c),
          host_pristine_verify: distribution(b),
          reset_verify_guest_paired_sum: distribution(
            a
              .slice(0, Math.min(a.length, b.length, c.length))
              .map((v, i) => v + b[i] + c[i]),
          ),
          baseline_snapshot_private_dirty_kib: privateDirty(baseline),
          dirty_snapshot_private_dirty_kib: privateDirty(dirty),
          after_snapshot_private_dirty_kib: privateDirty(after),
          baseline_process_private_dirty_kib: nested(
            baseline,
            "smaps_rollup_kib",
          ).Private_Dirty,
          after_process_private_dirty_kib: nested(after, "smaps_rollup_kib")
            .Private_Dirty,
          loop_process_cpu_ms_per_run:
            ((num(dirty, "cpu_ticks") - num(baseline, "cpu_ticks")) * 10) /
            num(r, "iterations"),
          leaks: r.leaks,
        });
      } else if (event === "wait_done") {
        const calls = num(r, "calls_per_vm");
        const row: ObjectValue = {
          source: name,
          n: r.n,
          calls,
          round: r.round,
          completion_to_entry: distribution(
            numbers(r, "completion_to_entry_ns"),
          ),
          completion_to_finish: distribution(
            numbers(r, "completion_to_finish_ns"),
          ),
          elapsed_completion_ms: num(r, "elapsed_completion_ns") / 1e6,
          completions: r.completions,
          lost: r.lost,
          duplicates: r.duplicates,
          threads: r.threads,
        };
        if (num(r, "n") === 1) {
          const generation = calls * 100 + num(r, "round") + 1;
          const delays: number[] = [];
          for (let i = 0; i < calls; i++) {
            delays.push(Number(mix(BigInt(i ^ generation)) % 100000000n));
          }
          row.planned_max_delay_ms = Math.max(...delays) / 1e6;
          row.planned_sum_delay_ms = delays.reduce((a, b) => a + b, 0) / 1e6;
        }
        wait.push(row);
        if (name === "wait-1024.json") {
          const bucket = pooled.get(calls) || { entry: [], finish: [] };
          bucket.entry = bucket.entry.concat(
            numbers(r, "completion_to_entry_ns"),
          );
          bucket.finish = bucket.finish.concat(
            numbers(r, "completion_to_finish_ns"),
          );
          pooled.set(calls, bucket);
        }
      } else if (event === "idle") {
        const row: ObjectValue = { source: name };
        for (const key of Object.keys(r)) {
          row[key] = r[key];
        }
        row.one_core_cpu_percent =
          (num(r, "cpu_ticks") /
            num(r, "clock_ticks_per_s") /
            (num(r, "elapsed_ns") / 1e9)) *
          100;
        idle.push(row);
      }
    }
  }
  for (const calls of Array.from(pooled.keys()).sort((a, b) => a - b)) {
    const values = pooled.get(calls);
    if (values) {
      waitPooled.push({
        calls,
        completion_to_entry: distribution(values.entry),
        completion_to_finish: distribution(values.finish),
      });
    }
  }
  const result = { density, reset, wait, wait_pooled: waitPooled, idle };
  dump(join(directory, "summary.json"), result);
  console.log(JSON.stringify(result, null, 2));
}
