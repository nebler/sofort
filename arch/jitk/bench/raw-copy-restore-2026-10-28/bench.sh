#!/bin/sh
# bench.sh: R9-style shard A/B. `real bench` sequential on one slot, n=1 and
# n=201 under perf stat (per-run counts = (n201 - n1) / 200), variants
# interleaved within each rep. Caller holds /home/dev/bench.lock.
set -eu
cd /home/dev/r10-reset
export PATH=$PATH:$HOME/.cargo/bin JITK_CACHE=/home/dev/r10-reset/cache
eval "$(cd after/arch/jitk/shard && /home/dev/r10-reset/cache/node/v24.22.1-linux-arm64/bin/node snapshot.ts env)"
S=$JITK_SHARD_TEST_SNAPSHOT
O=out/bench; mkdir -p $O
EV=task-clock,page-faults,context-switches,kvm:kvm_exit,kvm:kvm_guest_fault,kvm:kvm_mmio,kvm:kvm_unmap_hva_range,raw_syscalls:sys_enter
for rep in ${REPS:-1 2 3}; do
  for fx in ${FIXTURES:-return2 one_tool promise10}; do
    for v in before after after-discard; do
      case $v in
        before) bin=before/arch/jitk/shard/target/release/real; pol= ;;
        after) bin=after/arch/jitk/shard/target/release/real; pol= ;;
        after-discard) bin=after/arch/jitk/shard/target/release/real; pol=copy-limit=0 ;;
      esac
      for n in 1 201; do
        f=$O/$v-$fx-$rep-$n
        sudo perf stat -x, -e $EV -o $f.perf -- sudo -u dev env JITK_SHARD_RESET=$pol $bin bench $S $fx $n > $f.jsonl 2> $f.err
      done
    done
  done
done
# One row per variant/fixture/rep: perf deltas per run and the n=201 summary.
for f in $O/*-201.jsonl; do
  b=${f%-201.jsonl}; base=$(basename $b)
  v=${base%-*-*}; rest=${base#$v-}; fx=${rest%-*}; rep=${rest##*-}
  awk -F, -v tag="$v,$fx,$rep" 'FNR==1{file++} /^[0-9.]+,/{val[file,$3]=$1} END{
    split("task-clock kvm:kvm_exit kvm:kvm_guest_fault kvm:kvm_mmio kvm:kvm_unmap_hva_range raw_syscalls:sys_enter page-faults context-switches", e, " ");
    printf "%s", tag; for (i=1;i<=8;i++) printf ",%.2f", (val[2,e[i]]-val[1,e[i]])/200; printf "\n"}' $b-1.perf $b-201.perf > $b.perfrow
  jq -r --arg tag "$(cat $b.perfrow)" 'select(.event=="summary") | "\($tag),\(.cpu_ns/.n/1e6),\(.reset.p50_ns/1e6),\(.run_to_done.p50_ns/1e6),\(.reset_bind_run.p50_ns/1e6),\(.reset_bind_run.p99_ns/1e6)"' $f
done | sort > $O/rows.csv
echo "variant,fixture,rep,task_ms,exits,guest_faults,mmio,unmap_hva,syscalls,minflt,cs,owner_cpu_ms,reset_p50_ms,run_p50_ms,rbr_p50_ms,rbr_p99_ms" > $O/ab-reset.csv
cat $O/rows.csv >> $O/ab-reset.csv
cat $O/ab-reset.csv
