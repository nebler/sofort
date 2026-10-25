# jitk arm64 Linux/KVM benchmark

Status: FAILED
KVM-dependent measurements: UNVERIFIED

Source/versions and all raw samples: report.json. CPU-ms/VM is getrusage(RUSAGE_CHILDREN) user+system; guest CPU is charged in VMM threads. It excludes Python/broker CPU and kernel work outside child accounting.

Error: FileNotFoundError(2, 'No such file or directory')


UNVERIFIED until this report contains successful KVM runs: arm64 boot, timer/IRQ wakeup, rates, density, PSS, cgroup accounting and production capacity. This is a benchmark launcher, not the production jailer.
