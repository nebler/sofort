#!/bin/sh
# experf.sh: per-run KVM events and ioctls through MicroVMExecutor+ShardBackend
# (R9 exloop, one tool): system-wide perf stat at N=500 and N=0; per run =
# difference / 500. Takes the bench lock.
set -eu
R=/home/dev/r10-reset
export JITK_CACHE=$R/cache PATH=$R/cache/node/v24.22.1-linux-arm64/bin:$PATH
O=$R/out/ex; mkdir -p $O
EV=kvm:kvm_guest_fault,kvm:kvm_exit,kvm:kvm_unmap_hva_range,kvm:kvm_mmio,syscalls:sys_enter_ioctl,syscalls:sys_enter_madvise,syscalls:sys_enter_pread64
exec 9</home/dev/bench.lock
flock 9
for rep in 1 2 3; do
  for t in before after; do
    JITK_NODE=$R/cache/node/v24.22.1-linux-arm64/bin/node
    JITK_SHARD_SNAPSHOT=$R/cache/shard-snapshot/linux-arm64-glue-2m-6b051eae939501e5/helpers
    case $t in
      before) JITK_SHARD_BINARY=$R/cache/shard/linux-arm64-c99473fa8ea35bb4/real ;;
      after) JITK_SHARD_BINARY=$R/cache/shard/linux-arm64-9093502f2c402988/real ;;
    esac
    cd $R/$t/arch/jitk/executor
    for n in 0 500; do
      sudo perf stat -a -x, -e $EV -o $O/perf-$t-$rep-$n.txt -- sudo -u dev env PATH=$PATH JITK_SHARD_BINARY=$JITK_SHARD_BINARY JITK_SHARD_SNAPSHOT=$JITK_SHARD_SNAPSHOT N=$n $JITK_NODE build/exloop.mjs > /dev/null
    done
    awk -F, -v tag="$t,$rep" 'FNR==1{file++} /^[0-9.]+,/{val[file,$3]=$1; ev[$3]=1} END{
      printf "%s", tag; for (e in ev) printf ",%s=%.2f", e, (val[2,e]-val[1,e])/500; printf "\n"}' $O/perf-$t-$rep-0.txt $O/perf-$t-$rep-500.txt >> $O/experf.csv
  done
done
cat $O/experf.csv
