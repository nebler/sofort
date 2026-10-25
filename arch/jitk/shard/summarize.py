#!/usr/bin/env python3
"""Offline conversion/summary. No Python or subprocess is used by the shard."""
import json
import math
from pathlib import Path
import sys


def distribution(values):
    a = sorted(values)
    return {"n": len(a), **{f"p{p}_us": a[max(0, math.ceil(len(a) * p / 100) - 1)] / 1000
                              for p in (50, 95, 99)}, "max_us": a[-1] / 1000}


def mix(x):
    mask = (1 << 64) - 1
    x = (x + 0x9e3779b97f4a7c15) & mask
    x = ((x ^ (x >> 30)) * 0xbf58476d1ce4e5b9) & mask
    x = ((x ^ (x >> 27)) * 0x94d049bb133111eb) & mask
    return x ^ (x >> 31)


def main():
    directory = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "results"
    for source in sorted(directory.glob("*.jsonl")):
        if source.name.endswith("progress.jsonl"):
            continue
        records = [json.loads(line) for line in source.read_text().splitlines() if line.strip()]
        source.with_suffix(".json").write_text(json.dumps(records, separators=(",", ":")) + "\n")
    result = {"density": [], "reset": [], "wait": [], "wait_pooled": [], "idle": []}
    pooled = {}
    for source in sorted(directory.glob("*.json")):
        if source.name in ("summary.json", "environment.json"):
            continue
        records = json.loads(source.read_text())
        if not isinstance(records, list):
            continue
        baseline = next((r["metrics"] for r in records if r["event"] == "density_baseline"), None)
        for r in records:
            if r["event"] == "density":
                n = r["n"]
                m = r["metrics"]
                mi, b = m["meminfo_kib"], baseline["meminfo_kib"]
                delta = lambda key: mi[key] - b[key]
                pss = m["smaps_rollup_kib"]["Pss"] - baseline["smaps_rollup_kib"]["Pss"]
                pd = m["smaps_rollup_kib"]["Private_Dirty"] - baseline["smaps_rollup_kib"]["Private_Dirty"]
                row = {"source": source.name, "n": n,
                       "global_available_delta_kib_per_vm": -delta("MemAvailable") / n,
                       "global_free_delta_kib_per_vm": -delta("MemFree") / n,
                       "process_pss_delta_kib_per_vm": pss / n,
                       "process_private_dirty_delta_kib_per_vm": pd / n,
                       "snapshot_private_dirty_kib_per_vm": m["snapshot_smaps_kib"]["Private_Dirty"] / n,
                       "page_tables_delta_kib_per_vm": delta("PageTables") / n,
                       "sec_page_tables_delta_kib_per_vm": delta("SecPageTables") / n,
                       "sunreclaim_delta_kib_per_vm": delta("SUnreclaim") / n,
                       "ledger_sum_kib_per_vm": (pss + delta("PageTables") + delta("SecPageTables") + delta("SUnreclaim") + delta("KernelStack")) / n,
                       "fds": m["fds"], "threads": m["threads"],
                       "create_cumulative_ms": r["create_cumulative_ns"] / 1e6,
                       "create_batch_ms": r["create_batch_ns"] / 1e6}
                result["density"].append(row)
            elif r["event"] == "reset":
                row = {"source": source.name, "iterations": r["iterations"], "k_max": r["k_max"],
                       "reset": distribution(r["reset_ns"]),
                       "guest_run_validate": distribution(r["guest_run_validate_ns"]),
                       "host_pristine_verify": distribution(r["host_pristine_verify_ns"]),
                       "reset_verify_guest_paired_sum": distribution([sum(t) for t in zip(r["reset_ns"], r["host_pristine_verify_ns"], r["guest_run_validate_ns"])]),
                       "baseline_snapshot_private_dirty_kib": r["baseline"]["snapshot_smaps_kib"].get("Private_Dirty", 0),
                       "dirty_snapshot_private_dirty_kib": r["dirty"]["snapshot_smaps_kib"].get("Private_Dirty", 0),
                       "after_snapshot_private_dirty_kib": r["after_discard"]["snapshot_smaps_kib"].get("Private_Dirty", 0),
                       "baseline_process_private_dirty_kib": r["baseline"]["smaps_rollup_kib"]["Private_Dirty"],
                       "after_process_private_dirty_kib": r["after_discard"]["smaps_rollup_kib"]["Private_Dirty"],
                       "loop_process_cpu_ms_per_run": (r["dirty"]["cpu_ticks"] - r["baseline"]["cpu_ticks"]) * 10 / r["iterations"],
                       "leaks": r["leaks"]}
                result["reset"].append(row)
            elif r["event"] == "wait_done":
                row = {"source": source.name, "n": r["n"], "calls": r["calls_per_vm"], "round": r["round"],
                                       "completion_to_entry": distribution(r["completion_to_entry_ns"]),
                                       "completion_to_finish": distribution(r["completion_to_finish_ns"]),
                                       "elapsed_completion_ms": r["elapsed_completion_ns"] / 1e6,
                                       "completions": r["completions"], "lost": r["lost"], "duplicates": r["duplicates"], "threads": r["threads"]}
                if r["n"] == 1:
                    generation = r["calls_per_vm"] * 100 + r["round"] + 1
                    delays = [mix(i ^ generation) % 100_000_000 for i in range(r["calls_per_vm"])]
                    row["planned_max_delay_ms"] = max(delays) / 1e6
                    row["planned_sum_delay_ms"] = sum(delays) / 1e6
                result["wait"].append(row)
                if source.name == "wait-1024.json":
                    bucket = pooled.setdefault(r["calls_per_vm"], {"entry": [], "finish": []})
                    bucket["entry"].extend(r["completion_to_entry_ns"])
                    bucket["finish"].extend(r["completion_to_finish_ns"])
            elif r["event"] == "idle":
                result["idle"].append({"source": source.name, **r,
                                       "one_core_cpu_percent": r["cpu_ticks"] / r["clock_ticks_per_s"] / (r["elapsed_ns"] / 1e9) * 100})
    for calls, values in sorted(pooled.items()):
        result["wait_pooled"].append({"calls": calls, "completion_to_entry": distribution(values["entry"]), "completion_to_finish": distribution(values["finish"])})
    (directory / "summary.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
