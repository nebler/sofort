#!/usr/bin/env python3
"""Pinned, patch-only libkrun build. No source/vendor tree is written to the repo."""
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess

ROOT = Path(__file__).resolve().parent
REV = "a1d8616765da03980f3be1bb8714bfdd3842f33c"
SYSTEM = platform.system()
OUT = Path(os.environ.get("JITK_VMM_BUILD", f"/tmp/jitk-01/r3/{SYSTEM.lower()}"))
LIB = OUT / "libkrun"
ENV = dict(os.environ, RUSTUP_TOOLCHAIN="1.95.0", CARGO_PROFILE_RELEASE_PANIC="abort")

def run(*args, **kwargs):
    return subprocess.run(args, env=ENV, check=True, **kwargs)

OUT.mkdir(parents=True, exist_ok=True)
if not (LIB / ".git").exists():
    run("git", "clone", "--no-checkout", os.environ.get("LIBKRUN_SOURCE", "https://github.com/containers/libkrun.git"), str(LIB))
patches = [ROOT / "patches" / name for name in (ROOT / "patches/series").read_text().splitlines() if name]
fingerprint = hashlib.sha256(b"".join(p.read_bytes() for p in patches)).hexdigest()
stamp = OUT / "patch-set.sha256"
if not stamp.exists() or stamp.read_text().strip() != fingerprint:
    # This checkout is disposable and exclusively owned by this build script.
    run("git", "-C", str(LIB), "reset", "--hard", REV)
    run("git", "-C", str(LIB), "clean", "-fd", "--", "src", "Makefile")
    for patch in patches:
        run("git", "-C", str(LIB), "apply", "--check", str(patch))
        run("git", "-C", str(LIB), "apply", str(patch))
    stamp.write_text(fingerprint + "\n")
assert subprocess.check_output(["git", "-C", str(LIB), "rev-parse", "HEAD"], text=True).strip() == REV
target = "libkrun.2.0.0.dylib" if SYSTEM == "Darwin" else "libkrun.so.2.0.0"
run("make", "-C", str(LIB), "FFI=0", f"target/release/{target}")
deps = LIB / "target/release/deps"
args = ["rustc", "--edition=2024", "-O", "-C", "lto=fat", "-C", "panic=abort",
        str(ROOT / "src/main.rs"), "--extern", f"krun={deps}/libkrun.rlib",
        "-L", f"dependency={deps}", "-o", str(OUT / "jitk-vmm")]
for crate, pattern in [("libc", "liblibc-*.rlib"), ("utils", "libkrun_utils-*.rlib")]:
    matches = list(deps.glob(pattern))
    assert len(matches) == 1, (crate, matches)
    args += ["--extern", f"{crate}={matches[0]}"]
ready = (ROOT / "sandbox/.READY").exists()
if ready:
    args += ["--cfg", "sandbox_ready"]
run(*args)
if SYSTEM == "Linux" and ready:
    probe_args = args.copy()
    probe_args[probe_args.index(str(ROOT / "src/main.rs"))] = str(ROOT / "tests/seccomp-probe.rs")
    probe_args[probe_args.index(str(OUT / "jitk-vmm"))] = str(OUT / "seccomp-probe")
    run(*probe_args)
if SYSTEM == "Darwin":
    run("strip", "-x", str(OUT / "jitk-vmm"))
    run("codesign", "--force", "--sign", "-", "--entitlements", str(ROOT / "hypervisor.entitlements"), str(OUT / "jitk-vmm"))
else:
    run("strip", str(OUT / "jitk-vmm"))
metadata = {"revision": REV, "patches_sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in patches},
            "panic": "abort", "features": [], "sandbox_ready": ready,
            "binary": str(OUT / "jitk-vmm"), "binary_sha256": hashlib.sha256((OUT / "jitk-vmm").read_bytes()).hexdigest(),
            "rustc": subprocess.check_output(["rustc", "--version"], env=ENV, text=True).strip()}
(OUT / "build.json").write_text(json.dumps(metadata, indent=2) + "\n")
print(json.dumps(metadata, indent=2))
