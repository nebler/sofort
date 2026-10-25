#!/usr/bin/env python3
"""Area 07's nested-HVF/KVM environment, with an area 01-owned work overlay."""
import argparse
import gzip
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument("--binary", default="/tmp/jitk-01/r3/linux/jitk-vmm")
p.add_argument("--kernel", default=str(ROOT.parent / "kernel/dist/kernel.bin"))
p.add_argument("--base", default="/tmp/jitk-07/kvm")
p.add_argument("--probe")
p.add_argument("--repeats", type=int, default=30)
a = p.parse_args()
out = Path("/tmp/jitk-01/r3/nested")
stage = out / "stage"
work = stage / "work"
work.mkdir(parents=True, exist_ok=True)
shutil.copy2(a.binary, work / "jitk-vmm")
shutil.copy2(a.probe or Path(a.binary).parent / "seccomp-probe", work / "seccomp-probe")
shutil.copy2(a.kernel, work / "kernel.bin")
shutil.copytree("/tmp/jitk-01/r3/images", work / "images", dirs_exist_ok=True)
(work / "tests").mkdir(exist_ok=True)
(work / "src").mkdir(exist_ok=True)
shutil.copy2(ROOT / "tests/check.py", work / "tests/check.py")
shutil.copy2(ROOT / "tests/console-abuse.py", work / "tests/console-abuse.py")
shutil.copy2(ROOT / "src/main.rs", work / "src/main.rs")
(work / "run.sh").write_text(f'''#!/bin/sh
cd /work
echo "NESTED-LOAD: $(cat /proc/loadavg) UPTIME: $(cat /proc/uptime)"
python3 tests/check.py --binary /work/jitk-vmm --images /work/images --kernel /work/kernel.bin --output /tmp/checks.json --repeats {a.repeats}
status=$?
echo "CHECK-EXIT $status"
if [ "$status" = 0 ]; then echo CHECKS-PASS; cat /tmp/checks.json; fi
python3 tests/console-abuse.py --binary /work/jitk-vmm --images /work/images --output /tmp/console.json --repeats {a.repeats} && echo CONSOLE-PASS
python3 -c 'import subprocess; p=subprocess.run(["/work/seccomp-probe","/work/images/parking.bin"],input=b"",capture_output=True,timeout=30); print("SECCOMP-PROBE",p.returncode,p.stderr); assert p.returncode == -31 and b"SECCOMP-PROBE-CONFINED" in p.stderr; print("SECCOMP-PASS")'
''')
(stage / "init").write_text('''#!/bin/sh
mkdir -p /proc /sys /dev /tmp
mount -t proc proc /proc
mount -t sysfs sys /sys
mount -t devtmpfs dev /dev 2>/dev/null
mount -t tmpfs tmp /tmp
mkdir -p /sys/fs/cgroup
mount -t cgroup2 none /sys/fs/cgroup
echo "KVMCHECK: $(ls -la /dev/kvm 2>&1)"
/work/run.sh
echo INIT-DONE
echo o > /proc/sysrq-trigger
sleep 10
''')
for path in [work / "run.sh", stage / "init", work / "jitk-vmm"]:
    path.chmod(0o755)
files = subprocess.check_output(["find", "."], cwd=stage)
archive = subprocess.run(["cpio", "-o", "-H", "newc"], input=files, capture_output=True, cwd=stage, check=True).stdout
initrd = out / "test.cpio.gz"
with initrd.open("wb") as target, (Path(a.base) / "base.cpio.gz").open("rb") as base:
    shutil.copyfileobj(base, target)
    target.write(gzip.compress(archive, compresslevel=1))
load = subprocess.check_output(["uptime"], text=True).strip()
command = ["qemu-system-aarch64", "-M", "virt,virtualization=on,gic-version=3", "-accel", "hvf", "-cpu", "host",
           "-smp", "4", "-m", "3072", "-kernel", str(Path(a.base) / "vmlinuz"), "-initrd", str(initrd),
           "-append", "console=ttyAMA0 rdinit=/init quiet", "-nographic", "-no-reboot"]
started = time.time()
proc = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
try:
    transcript, _ = proc.communicate(timeout=480)
except subprocess.TimeoutExpired:
    proc.kill()
    transcript, _ = proc.communicate(timeout=10)
finally:
    if proc.poll() is None:
        proc.kill()
        proc.wait(timeout=10)
text = transcript.decode(errors="replace").replace("\r", "")
(ROOT / "evidence/nested-kvm.log").write_text(text)
(ROOT / "evidence/nested-kvm-meta.json").write_text(json.dumps({"uptime": load, "command": command, "elapsed_s": time.time()-started,
                                                              "qemu_rc": proc.returncode, "functional_only": True}, indent=2) + "\n")
print(text[-4000:])
assert "CHECKS-PASS" in text and "CONSOLE-PASS" in text and "SECCOMP-PASS" in text and "INIT-DONE" in text, "nested suite failed; see evidence/nested-kvm.log"
checks, _ = json.JSONDecoder().raw_decode(text.split("CHECKS-PASS\n", 1)[1].lstrip())
(ROOT / "evidence/checks-linux.json").write_text(json.dumps(checks, indent=2) + "\n")
