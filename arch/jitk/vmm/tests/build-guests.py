#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess

ROOT = Path(__file__).resolve().parent / "fixtures"
OUT = Path(os.environ.get("JITK_TEST_IMAGES", "/tmp/jitk-01/r3/images"))
OUT.mkdir(parents=True, exist_ok=True)
def run(*args):
    subprocess.run(args, check=True)
run("clang", "--target=aarch64-none-elf", "-c", str(ROOT / "start.S"), "-o", str(OUT / "start.o"))
for name, flags in [("first", []), ("parking", ["-DPARK"]), ("byteecho", ["-DPARK", "-DCLI_BUF_ECHO"])]:
    run("clang", "--target=aarch64-none-elf", *flags, "-O2", "-mstrict-align", "-mgeneral-regs-only",
        "-ffreestanding", "-fno-builtin", "-nostdlib", "-c", str(ROOT / "parking-guest.c"), "-o", str(OUT / f"{name}.o"))
    run("ld.lld", "-T", str(ROOT / "probe.ld"), str(OUT / "start.o"), str(OUT / f"{name}.o"), "--oformat=binary", "-o", str(OUT / f"{name}.bin"))
# 07 console-abuse guests (control queue / descriptor abuse), one binary per MODE.
for mode in range(1, 10):
    run("clang", "--target=aarch64-none-elf", f"-DMODE={mode}", "-O2", "-mstrict-align", "-mgeneral-regs-only",
        "-ffreestanding", "-fno-builtin", "-nostdlib", "-c", str(ROOT / "console-abuse.c"), "-o", str(OUT / f"console-abuse-{mode}.o"))
    run("ld.lld", "-T", str(ROOT / "probe.ld"), str(OUT / "start.o"), str(OUT / f"console-abuse-{mode}.o"), "--oformat=binary", "-o", str(OUT / f"console-abuse-{mode}.bin"))
for source in ROOT.glob("*.S"):
    if source.name == "start.S":
        continue
    run("clang", "--target=aarch64-none-elf", "-c", str(source), "-o", str(OUT / f"{source.stem}.o"))
    run("ld.lld", "-T", str(ROOT / "link.ld"), str(OUT / f"{source.stem}.o"), "--oformat=binary", "-o", str(OUT / f"{source.stem}.bin"))
print(OUT)
