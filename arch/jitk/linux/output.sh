# Source after setting ROOT to the linux subtree.
if [[ ${JITK_RECORD:-} == 1 ]]; then
 export JITK_LINUX_OUT=${JITK_LINUX_OUT:-$ROOT/out}
 export JITK_LINUX_READY=$ROOT/.READY
else
 export JITK_LINUX_OUT=${JITK_LINUX_OUT:-$ROOT/.work/out}
 export JITK_LINUX_READY=$JITK_LINUX_OUT/READY.json
fi
mkdir -p "$JITK_LINUX_OUT"
