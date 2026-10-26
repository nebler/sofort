"""Five unchanged, validate-only baseline runs; retain failed-run receipts too."""
import csv
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
FIELDS = "run_id,date,host,model,cli,spec_level,target,attempt,accepted,rejecting_gate,visible_pass,heldout_pass,mutants_rejected,integration_pass,wall_s,cli_calls,human_minutes,handler_lines,human_lines".split(",")


def capture(*command):
    return subprocess.check_output(command, text=True).strip()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    model = "gpt-6.1-sol"
    vmm = Path("/tmp/jitk-01/r3/darwin/jitk-vmm")
    protected = {name: sha(ROOT / name) for name in ("release.json", ".READY")}
    environment = {
        "date": datetime.datetime.now().astimezone().isoformat(),
        "host": platform.platform(),
        "disk_before": capture("df", "-h", "/System/Volumes/Data"),
        "uptime_before": capture("uptime"),
        "oracle_image": capture("docker", "image", "inspect", "jitk-oracle:08", "--format", "{{.Id}}"),
        "vmm": str(vmm), "vmm_sha256": sha(vmm),
        "cli": capture("codex", "--version"), "model": model,
        "git_head": capture("git", "rev-parse", "HEAD"),
        "protected_before": protected,
        "baseline_tests": "make -C arch/jitk/grow test: 22 grow + 4 oracle PASS",
    }
    env_path = ROOT / "experiments/E0-environment.json"
    env_path.write_text(json.dumps(environment, indent=2) + "\n")
    csv_path = ROOT / "experiments/E0.csv"
    with csv_path.open("x", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        writer.writeheader()
        file.flush()
        for index in range(1, 6):
            # A batch is one fresh run. Never start one below the stop threshold.
            disk = capture("df", "-h", "/System/Volumes/Data")
            if shutil.disk_usage("/System/Volumes/Data").free < 15 * 1024**3:
                raise RuntimeError("STOP: less than 15 GiB free")
            run_id = f"e0-live-20261026-{index:02}"
            out = ROOT / "results" / run_id
            metadata = {"disk_before": disk, "uptime_before": capture("uptime")}
            cmd = [sys.executable, "-B", str(ROOT / "loop.py"), "--run-id", run_id, "--validate-only", "--live"]
            metadata["command"] = cmd
            started = time.monotonic()
            with (ROOT / "experiments" / f"{run_id}.log").open("wb") as log:
                result = subprocess.run(cmd, env=dict(os.environ, JITK_VMM_BINARY=str(vmm), JITK_GROW_MODEL=model), stdout=log, stderr=subprocess.STDOUT)
            elapsed = time.monotonic() - started
            metadata.update(returncode=result.returncode, wall_s=elapsed, uptime_after=capture("uptime"), disk_after=capture("df", "-h", "/System/Volumes/Data"))
            metadata["prompt_sha256"] = {str(p.relative_to(out)): sha(p) for p in out.rglob("agent-prompt.txt")}
            (out / "experiment.json").write_text(json.dumps(metadata, indent=2) + "\n")
            for target in ("ppoll", "rt_sigaction", "rt_sigprocmask"):
                tx = out / ("tx-" + target)
                report = json.loads((tx / "report.json").read_text()) if (tx / "report.json").exists() else None
                stages = json.loads((tx / "stages.json").read_text()) if (tx / "stages.json").exists() else {}
                modes = list(tx.rglob("agent-mode.json")) if tx.exists() else []
                proposal = json.loads((tx / "proposal.json").read_text()) if (tx / "proposal.json").exists() else None
                gate = "" if report else (list(stages)[-1] if stages else "not_reached")
                writer.writerow(dict(run_id=run_id, date=environment["date"], host=environment["host"], model=model, cli=environment["cli"], spec_level="full", target=target, attempt=1, accepted=int(report is not None), rejecting_gate=gate, visible_pass=int(any(k.startswith("semantic_error_state_") for k in stages) and report is not None), heldout_pass="NA:no_split_yet", mutants_rejected=len(report["acceptance"]["mutations"]) if report else "", integration_pass=int(report is not None), wall_s=report["seconds"] if report else elapsed if tx.exists() else "", cli_calls=len(modes), human_minutes="not_measured", handler_lines=len(proposal["source"].splitlines()) if proposal else "", human_lines=0))
            file.flush()
            assert all(sha(ROOT / name) == digest for name, digest in protected.items())
            print(run_id, "rc", result.returncode, "wall_s", round(elapsed, 2), flush=True)
    environment.update(disk_after=capture("df", "-h", "/System/Volumes/Data"), uptime_after=capture("uptime"), protected_after={name: sha(ROOT / name) for name in protected})
    env_path.write_text(json.dumps(environment, indent=2) + "\n")


if __name__ == "__main__":
    main()
