#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
WORK=${JITK_WORK:-$ROOT/.work}
source "$ROOT/output.sh"
rm -f "$JITK_LINUX_READY"
rm -f "$JITK_LINUX_OUT/report.json" "$JITK_LINUX_OUT/report.md"
[[ -s $WORK/kernel.bin && -s $WORK/jitk-vmm ]]
BACKEND=${JITK_NESTED_BACKEND:-ssh}
if [[ $BACKEND == qemu ]]; then
[[ -s $WORK/vmlinuz && -s $WORK/base.cpio.gz ]]
mkdir -p "$WORK/stage/work"
cp "$ROOT/nested/init" "$WORK/stage/init"
cp "$ROOT/build/linux/linux-tools" "$WORK/stage/work/"
cp "$WORK/"{jitk-vmm,spawn-cg,kernel.bin} "$WORK/stage/work/"
cp "$WORK/"*.bin "$WORK/stage/work/"
printf 'export JITK_HOST_UPTIME=%q\n' "$(uptime)" > "$WORK/stage/work/env.sh"
cp "$WORK/seccomp-probe" "$WORK/"*.bpf "$WORK/stage/work/"
# macOS ships cpio; use it directly rather than installing a packer in another VM.
(cd "$WORK/stage"; find . | cpio -o -H newc 2>/dev/null | gzip -1) > "$WORK/overlay.cpio.gz"
cat "$WORK/base.cpio.gz" "$WORK/overlay.cpio.gz" > "$WORK/test.cpio.gz"
"$ROOT/tool.sh" run-qemu "$WORK" "$JITK_LINUX_OUT/nested.log"
elif [[ $BACKEND == ssh ]]; then
 "$ROOT/tool.sh" run-ssh "$WORK" "$JITK_LINUX_OUT/nested.log"
else
 echo 'JITK_NESTED_BACKEND must be ssh or qemu' >&2; exit 1
fi
"$ROOT/tool.sh" collect-report "$JITK_LINUX_OUT"

"$ROOT/tool.sh" cpu-analysis > "$JITK_LINUX_OUT/cpu-analysis.log"
"$ROOT/tool.sh" summarize
"$ROOT/tool.sh" certify
