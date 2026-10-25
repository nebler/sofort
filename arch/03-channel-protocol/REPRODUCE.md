# Reproduce 03 channel experiments

Run from this directory. All writable caches/builds stay here or in `/tmp/jitk-03`.
The named container is task-owned; create it once, remove it at the end.
Versions and measurements are recorded in PROPOSAL.md and adjacent result files.

```sh
cd /Users/noah/.t3/scratch/2026-10-23-is-there-a-way-we-5a54f52b/arch/03-channel-protocol
mkdir -p /tmp/jitk-03
cp /tmp/jitk-spike/sc/qjs-static /tmp/jitk-03/qjs-static
curl -fsSL https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz -o /tmp/jitk-03/quickjs.tar.xz
tar -xf /tmp/jitk-03/quickjs.tar.xz -C /tmp/jitk-03
make -C /tmp/jitk-03/quickjs-2026-06-04 -j4 qjs qjsc libquickjs.a

docker run --name jitk-03-lab --platform linux/arm64 -d \
  -v /tmp/jitk-03:/work -v "$PWD":/proposal alpine:3.22 sleep 20000
docker exec jitk-03-lab apk add --no-cache strace python3 build-base
docker exec jitk-03-lab python3 /proposal/experiments.py concurrency --trace /work/async.trace
docker exec jitk-03-lab python3 /proposal/experiments.py concurrency --n 64
docker exec jitk-03-lab python3 /proposal/experiments.py pipes
docker exec jitk-03-lab /work/qjs-static -m /proposal/parse-bench.js

export CARGO_HOME=/tmp/jitk-03/cargo
export CARGO_TARGET_DIR=/tmp/jitk-03/target
export CARGO_INCREMENTAL=0
cargo test --locked
cargo build --release --locked
/tmp/jitk-03/target/release/parser bench
```

Bytecode (same source content but filename atom changes slightly with invocation path):

```sh
/tmp/jitk-03/quickjs-2026-06-04/qjsc -s -c -m -N bootstrap_bytecode \
  -o /tmp/jitk-03/bootstrap-bytecode.c bootstrap.js
/tmp/jitk-03/quickjs-2026-06-04/qjsc -s -e -m -N bootstrap_bytecode \
  -o /tmp/jitk-03/bootstrap-main.c bootstrap.js
python3 - <<'PY'
import pathlib,re
p=pathlib.Path('/tmp/jitk-03')
s=(p/'bootstrap-bytecode.c').read_text().split('= {',1)[1]
(p/'bootstrap.qbc').write_bytes(bytes(int(x,16) for x in re.findall(r'0x([0-9a-f]{2})',s)))
PY
# Expected FAIL: stock qjs treats the bytes as JavaScript source.
docker exec jitk-03-lab /work/qjs-static /work/bootstrap.qbc

# Fresh Linux objects; do not reuse macOS .o files.
docker exec jitk-03-lab sh -c 'mkdir -p /work/linux && tar -xf /work/quickjs.tar.xz -C /work/linux && make -C /work/linux/quickjs-2026-06-04 -j4 qjs qjsc libquickjs.a'
docker exec jitk-03-lab cc -O2 -static -I/work/linux/quickjs-2026-06-04 \
  /work/bootstrap-main.c /work/linux/quickjs-2026-06-04/libquickjs.a \
  -lm -lpthread -ldl -o /work/bootstrap-static
docker exec jitk-03-lab cp /work/bootstrap-static /work/bootstrap-static-stripped
docker exec jitk-03-lab strip /work/bootstrap-static-stripped
docker exec jitk-03-lab cp /work/qjs-static /work/qjs-static-stripped
docker exec jitk-03-lab strip /work/qjs-static-stripped
docker exec jitk-03-lab python3 /proposal/experiments.py concurrency \
  --qjs /work/bootstrap-static-stripped --executable
docker exec jitk-03-lab python3 /proposal/experiments.py startup \
  --qjs /work/qjs-static-stripped --compare /work/bootstrap-static-stripped
docker exec jitk-03-lab cc -O2 -static -I/work/linux/quickjs-2026-06-04 \
  /proposal/bytecode-bench.c /work/linux/quickjs-2026-06-04/libquickjs.a \
  -lm -lpthread -ldl -o /work/bytecode-bench
docker exec jitk-03-lab /work/bytecode-bench /proposal/bootstrap.js /work/bootstrap.qbc
```

For native comparison, compile generated main with clang and the native
libquickjs.a, then pass `--qjs /tmp/jitk-03/quickjs-2026-06-04/qjs
--bootstrap ./bootstrap.js --compare /tmp/jitk-03/bootstrap-native` to startup.
Use `--memory-limit 32M --stack-size 512K` in a small `/tmp/jitk-03` shell wrapper
around qjs-static for the capped concurrency check (pass wrapper as `--qjs`).
The `parser` binary's `bench` mode measures parsing; its default stdin dump mode
is not a complete dispatcher. Use the public decoder methods for live integration.

```sh
docker rm -f jitk-03-lab
```
