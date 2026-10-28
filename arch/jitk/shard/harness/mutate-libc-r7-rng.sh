#!/bin/sh
# Run under flock "${JITK_BENCH_LOCK:-/home/dev/bench.lock}" after the main measurements.
# Mutates a task-owned copy, never the measured payload or source.
set -eu
ulimit -c 0
cd "${JITK_R7_ROOT:-$HOME/r7-rng}"
. "${CARGO_HOME:-$HOME/.cargo}/env"
mutation_dir=${1:-$PWD/mutations}
mkdir "$mutation_dir"
cp -a payload-final/quickjs/quickjs-2026-06-04 "$mutation_dir/libc-omitted"
arch/jitk/shard/tool.sh mutate-libc "$mutation_dir"
rm -f "$mutation_dir/libc-omitted/.obj/quickjs-libc.o" "$mutation_dir/libc-omitted/qjs"
make -C "$mutation_dir/libc-omitted" qjs CC="$PWD/payload-final/musl-install/bin/musl-gcc" \
 CFLAGS='-O2 -g -Wall -fwrapv -fno-strict-aliasing -fno-stack-protector -D_GNU_SOURCE -DCONFIG_VERSION=\"2026-06-04\"' \
 LDFLAGS='-static -no-pie -Wl,-z,max-page-size=4096' LDEXPORT= >raw/mutation-build.log 2>&1
strip -o "$mutation_dir/qjs-libc-omitted" "$mutation_dir/libc-omitted/qjs"
(
 cd arch/jitk/kernel
 CARGO_TARGET_DIR="$mutation_dir/target" \
 JITK_ELF="$mutation_dir/qjs-libc-omitted" \
 cargo "+$(sh ../tools/rust-toolchain.sh)" build --locked --offline --release --target aarch64-unknown-none --features transport-ring
 llvm-objcopy -O binary "$mutation_dir/target/aarch64-unknown-none/release/jitk-02" \
 "$mutation_dir/kernel-libc-omitted.bin"
) >raw/mutation-kernel-build.log 2>&1
bin=arch/jitk/shard/target/release/real
"$bin" prepare "$mutation_dir/kernel-libc-omitted.bin" "$mutation_dir/prepared" >raw/mutation-prepare.jsonl 2>raw/mutation-prepare.stderr
set +e
"$bin" bench "$mutation_dir/prepared" rng_negative 1 >raw/mutation-libc.jsonl 2>raw/mutation-libc.stderr
status=$?
set -e
test "$status" -ne 0
grep -q 'FINISH without completion' raw/mutation-libc.stderr
printf '{"omitted":"__jitk_reseed_libc","exit_status":%s,"rejected_before_tenant_result":true}\n' "$status" >raw/mutation-libc-result.json
