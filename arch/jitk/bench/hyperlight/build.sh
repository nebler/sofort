#!/bin/sh
set -eu
cd "$(dirname "$0")"
: "${HYPERLIGHT_JS_SRC:?Set HYPERLIGHT_JS_SRC to the pinned Hyperlight JS checkout (see README.md)}"
: "${CARGO:?Set CARGO to a verified absolute cargo executable}"
: "${RUSTC:?Set RUSTC to a verified absolute rustc executable}"
for tool in "$CARGO" "$RUSTC"; do
  case "$tool" in /*) test -x "$tool" || exit 2;; *) echo 'CARGO and RUSTC must be absolute executable paths' >&2; exit 2;; esac
done
# Cargo does not expand environment variables inside dependency paths. Stage
# the tiny adapter crate and link its external source input beside the manifest.
export HYPERLIGHT_BUILD_DIR="${HYPERLIGHT_BUILD_DIR:-$PWD/build}"
/usr/bin/python3 - <<'PY'
import json,os,shutil,subprocess
from pathlib import Path
root=Path.cwd();src=Path(os.environ['HYPERLIGHT_JS_SRC']).resolve()
if not (src/'src/hyperlight-js/Cargo.toml').is_file():
    raise SystemExit('HYPERLIGHT_JS_SRC must contain src/hyperlight-js/Cargo.toml')
build=Path(os.environ['HYPERLIGHT_BUILD_DIR']).resolve();crate=build/'crate'
crate.mkdir(parents=True,exist_ok=True)
for name in ('Cargo.toml','Cargo.lock','worker.rs','load_linux.rs','bootstrap.js'):
    shutil.copy2(root/name,crate/name)
link=crate/'hyperlight-js'
if link.is_symlink():link.unlink()
link.symlink_to(src,target_is_directory=True)
worker=Path(os.environ.get('HYPERLIGHT_WORKER',str(build/'target/release/r2-worker'))).resolve()
snapshot=Path(os.environ.get('HYPERLIGHT_SNAPSHOT',str(build/'snapshot'))).resolve()
subprocess.run([os.environ['CARGO'],'build','--offline','--locked','--release','--manifest-path',str(crate/'Cargo.toml')],
    env={**os.environ,'CARGO_TARGET_DIR':str(build/'target')},check=True)
built=build/'target/release/r2-worker'
if worker!=built:
    worker.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(built,worker)
subprocess.run(['/usr/bin/codesign','--force','--sign','-','--entitlements',str(root.parents[1]/'vmm/hypervisor.entitlements'),str(worker)],check=True)
# Use a fresh temporary snapshot; never recursively delete a user override.
snapshot.parent.mkdir(parents=True,exist_ok=True)
if snapshot.exists():raise SystemExit('Snapshot output already exists; choose a fresh HYPERLIGHT_SNAPSHOT')
subprocess.run([str(worker),'save',str(snapshot)],check=True,timeout=30)
descriptor=json.loads((root/'adapter.json').read_text())
descriptor.update(strict_argv=[str(worker),'strict',str(snapshot)],clone_argv=[str(worker),'clone',str(snapshot)],
    files=[str(root/name) for name in ('worker.rs','bootstrap.js','Cargo.lock')]+[str(worker),str(snapshot/'index.json')])
(root/'adapter.json').write_text(json.dumps(descriptor,indent=2)+'\n')
PY
