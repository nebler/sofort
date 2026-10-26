#!/usr/bin/env python3
"""Delegate top-level commands; all implementation stays with subtree owners."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def node_binary():
    node = os.environ.get("JITK_NODE", "")
    if not os.path.isabs(node) or not Path(node).is_file():
        sys.exit("jitk: set JITK_NODE to a verified absolute Node >=24 executable; see executor/README.md")
    return node


def main():
    subtree, action = sys.argv[1:]
    # Make runs recursive-marked recipes even under -n. Do not let this Python
    # wrapper execute real build scripts when a caller requests a dry run.
    makeflags = os.environ.get("MAKEFLAGS", "").split()
    if any(flag == "--just-print" or (not flag.startswith("-") and "=" not in flag and "n" in flag)
           or (flag.startswith("-") and not flag.startswith("--") and "n" in flag)
           for flag in makeflags):
        print(f"jitk: dry-run delegation {subtree}/{action}")
        return 0
    directory = ROOT / subtree
    readme = directory / "README.md"
    if not directory.is_dir() or not readme.is_file():
        sys.exit(f"jitk: {subtree} is incomplete: missing {readme}; owner must supply documented {action} entrypoint")
    # Public integrated entrypoints must not silently select owners' R2 fallbacks.
    # Build/test remain callable before READY so certification is not circular.
    prerequisites = {
        ("executor", "demo"): ["kernel", "vmm", "vmm/sandbox", "executor", "executor/policy"],
        ("grow", "grow"): ["kernel", "vmm", "vmm/sandbox"],
        ("grow", "demo"): ["grow"],
        ("bench", "bench"): ["kernel", "vmm", "vmm/sandbox", "executor", "executor/policy", "bench/hyperlight"],
        ("linux", "nested"): ["kernel", "vmm/sandbox"],
        ("linux", "test"): ["kernel", "vmm/sandbox"],
    }.get((subtree, action), [])
    missing = [str(ROOT / part / ".READY") for part in prerequisites if not (ROOT / part / ".READY").is_file()]
    if missing:
        sys.exit(f"jitk: {subtree}/{action} needs canonical ready inputs: {', '.join(missing)}; see {readme}")
    commands = None
    if subtree == "vmm/sandbox" and action == "test":
        command = ["/bin/sh", str(directory / "tests/run-unit.sh")]
    elif subtree == "executor/policy" and action == "test":
        node = node_binary()
        commands = [[node, str(directory / script)] for script in ("policy-test.mjs", "policy-hostile.mjs")]
    elif subtree == "bench/hyperlight" and action == "test":
        command = [node_binary(),
                   "--experimental-transform-types", str(directory / "adapter-test.ts")]
    elif subtree == "executor" and action == "dependencies":
        modules = directory / "node_modules"
        if modules.is_symlink() and modules.exists():
            print("jitk: existing development dependency link retained; clean copies use a local locked install")
            return 0
        if modules.is_symlink():
            modules.unlink()  # copied dangling link must not redirect installation
        node = node_binary()
        npm = Path(os.environ.get("JITK_NPM_CLI") or shutil.which("npm") or "/missing/npm").resolve()
        if not os.path.isabs(node) or not Path(node).is_file() or npm.suffix != ".js" or not npm.is_file():
            sys.exit("jitk: locked dependency install needs absolute JITK_NODE >=24 and JITK_NPM_CLI pointing to npm-cli.js; see executor/README.md")
        # Exact owner README prerequisite; scripts stay disabled as documented.
        command = [node, str(npm), "ci", "--ignore-scripts", "--no-audit", "--no-fund",
                   "--cache", os.environ.get("JITK_NPM_CACHE", str(Path(tempfile.gettempdir()) / "jitk-npm-cache"))]
    elif subtree == "linux" and action in {"nested", "test"} and (directory / "run.sh").is_file():
        command = ["/bin/bash", str(directory / "run.sh"), "--nested"]
    elif (directory / "Makefile").is_file():
        command = [os.environ.get("MAKE", "make"), "-C", str(directory), action]
        if subtree == "vmm" and os.environ.get("JITK_VMM_BUILD"):
            output = Path(os.environ["JITK_VMM_BUILD"])
            command += [f"BUILD_DIR={output}", f"JITK_VMM={output / 'jitk-vmm'}",
                        f"PROFILE={output / 'test.sbbin'}"]
            if os.environ.get("JITK_TEST_IMAGES"):
                command += [f"IMAGES={os.environ['JITK_TEST_IMAGES']}"]
    elif (directory / f"{action}.sh").is_file():
        script = directory / f"{action}.sh"
        shell = "/bin/bash" if "bash" in script.read_text().splitlines()[0] else "/bin/sh"
        command = [shell, str(script)]
    else:
        sys.exit(f"jitk: no {action} entrypoint in {subtree}; see {readme}; expected Makefile target '{action}' or {action}.sh")
    print(f"jitk: delegating {subtree}/{action} (see {readme})", flush=True)
    env = os.environ.copy()
    if subtree == "protocol" and env.get("JITK_NODE"):
        env["NODE"] = env["JITK_NODE"]
    if subtree == "kernel" and env.get("JITK_KERNEL_CARGO_TARGET_DIR"):
        env["CARGO_TARGET_DIR"] = env["JITK_KERNEL_CARGO_TARGET_DIR"]
    for item in commands or [command]:
        status = subprocess.call(item, cwd=directory, env=env)
        if status:
            return status
    return 0


if __name__ == "__main__":
    sys.exit(main())
