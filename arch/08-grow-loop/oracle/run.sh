#!/bin/sh
set -eu
# run.sh BINARY CASE_DIR OUT_DIR STDIN_FILE [QJS_ARGS...]
oracle=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
make -s -C "$oracle" .work/entry
bin=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
case_dir=$(cd "$2" && pwd)
mkdir -p "$3"
out=$(cd "$3" && pwd)
input=$4
shift 4
docker run --rm -i --platform linux/arm64 --network none --read-only \
  --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 16 --memory 512m --cpus 1 --ulimit fsize=33554432:33554432 \
  --user 65534:65534 --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  -e INJECT_ERRNO="${INJECT_ERRNO:-}" -e INJECT_SYSCALL="${INJECT_SYSCALL:-ioctl}" \
  -v "$case_dir:/case:ro" -v "$bin:/case/qjs-static:ro" -v "$out:/out:rw" \
  -v "$oracle/.work/entry:/opt/entry:ro" --entrypoint /opt/entry \
  jitk-oracle:08 "$@" < "$input"
